import { eq, and, desc, sql } from 'drizzle-orm';
import { economicIndicators, type NewEconomicIndicator } from '../db/mysqlSchema';
import { getMysqlDb, isRealMysqlConnected, inMemoryIndicators } from '../db/mysqlClient';
import { ExternalServiceError } from './errors';

export type SupportedIndicatorCode = 'UF' | 'USD' | 'UTM' | 'IPC';

export interface IndicatorDataResponse {
  codigo: SupportedIndicatorCode;
  valor: number;
  fecha: string;
  fuente: string;
  cached: boolean;
}

// Mapeo entre códigos estándar del ERP y slugs de la API pública de mindicador.cl
const INDICATOR_API_MAP: Record<string, string> = {
  UF: 'uf',
  uf: 'uf',
  USD: 'dolar',
  dolar: 'dolar',
  usd: 'dolar',
  UTM: 'utm',
  utm: 'utm',
  IPC: 'ipc',
  ipc: 'ipc',
};

/**
 * Normaliza cualquier formato de fecha a 'YYYY-MM-DD'
 */
function normalizeDateString(dateInput: Date | string): string {
  if (dateInput instanceof Date) {
    return dateInput.toISOString().split('T')[0];
  }
  const clean = dateInput.trim();
  if (clean.includes('T')) {
    return clean.split('T')[0];
  }
  return clean;
}

/**
 * Convierte fecha YYYY-MM-DD a formato DD-MM-YYYY requerido por mindicador.cl
 */
function toMindicadorDateFormat(isoDate: string): string {
  const parts = isoDate.split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${day}-${month}-${year}`;
  }
  return isoDate;
}

export class IndicatorSyncService {
  private static inFlightSyncs = new Map<string, Promise<Record<string, number>>>();

  /**
   * Sincroniza en línea todos los indicadores económicos chilenos principales para la fecha indicada
   * consultando la API pública oficial (mindicador.cl) y realizando un upsert atómico en MySQL.
   * Cuenta con deduplicación en vuelo (in-flight) para prevenir múltiples consultas simultáneas.
   *
   * @param fecha Fecha en formato YYYY-MM-DD (por defecto hoy)
   * @returns Diccionario con los valores numéricos sincronizados
   */
  public static async syncDailyIndicators(fecha?: string): Promise<Record<string, number>> {
    const targetDate = fecha ? normalizeDateString(fecha) : new Date().toISOString().split('T')[0];

    // Deduplicación en vuelo: Si ya hay una consulta ejecutándose para la misma fecha, reutilizar la misma promesa
    const existing = this.inFlightSyncs.get(targetDate);
    if (existing) {
      return existing;
    }

    const syncPromise = this.executeSyncDailyIndicators(targetDate);
    this.inFlightSyncs.set(targetDate, syncPromise);

    try {
      return await syncPromise;
    } finally {
      this.inFlightSyncs.delete(targetDate);
    }
  }

  private static async executeSyncDailyIndicators(targetDate: string): Promise<Record<string, number>> {
    const db = getMysqlDb();
    const commonHeaders = {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    };

    console.log(`[IndicatorSyncService] Sincronizando indicadores económicos en línea para la fecha: ${targetDate}`);

    // 1. Consultar endpoint consolidado de mindicador.cl (entrega UF, USD, UTM e IPC en un único llamado)
    let apiData: any = null;
    try {
      const response = await fetch('https://mindicador.cl/api', {
        method: 'GET',
        headers: commonHeaders,
        signal: AbortSignal.timeout(6000),
      });

      if (response.ok) {
        apiData = await response.json();
      }
    } catch (err: any) {
      console.warn(`[IndicatorSyncService] Aviso en consulta a mindicador.cl consolidado (${err.name || 'Error'}): ${err.message}`);
    }

    const syncedResults: Record<string, number> = {};
    const codesToSync: Array<{ code: SupportedIndicatorCode; apiKey: string; isMonthly?: boolean }> = [
      { code: 'UF', apiKey: 'uf', isMonthly: false },
      { code: 'USD', apiKey: 'dolar', isMonthly: false },
      { code: 'UTM', apiKey: 'utm', isMonthly: true },
      { code: 'IPC', apiKey: 'ipc', isMonthly: true },
    ];

    const targetMonth = targetDate.slice(0, 7);

    for (const item of codesToSync) {
      let value: number | null = null;
      let fuente = 'mindicador.cl';

      // 1. Intentar extraer del payload consolidado
      if (apiData && apiData[item.apiKey] && typeof apiData[item.apiKey].valor === 'number') {
        value = Number(apiData[item.apiKey].valor);
      }

      // 2. Si no se obtuvo del consolidado, consultar el endpoint de serie reciente de la API (/api/{indicador})
      // Nota: /api/{indicador} entrega la serie de los últimos 30 días/meses con caché CDN de alta velocidad,
      // evitando timeouts o fallos causados por búsquedas puntuales no indexadas.
      if (value === null || isNaN(value)) {
        try {
          const detailRes = await fetch(`https://mindicador.cl/api/${item.apiKey}`, {
            headers: commonHeaders,
            signal: AbortSignal.timeout(4000),
          });

          if (detailRes.ok) {
            const detailData: any = await detailRes.json();
            if (Array.isArray(detailData?.serie) && detailData.serie.length > 0) {
              if (item.isMonthly) {
                // Para UTM e IPC buscar coincidencia con el mes YYYY-MM o tomar el más reciente
                const matchedMonth = detailData.serie.find(
                  (s: any) => typeof s?.fecha === 'string' && s.fecha.startsWith(targetMonth)
                );
                const chosen = matchedMonth || detailData.serie[0];
                if (typeof chosen?.valor === 'number') {
                  value = Number(chosen.valor);
                  fuente = `mindicador.cl/${item.apiKey}/${chosen.fecha?.slice(0, 10) || targetDate}`;
                }
              } else {
                // Para UF y USD buscar por fecha exacta YYYY-MM-DD o tomar el último valor disponible
                const matchedDay = detailData.serie.find(
                  (s: any) => typeof s?.fecha === 'string' && s.fecha.startsWith(targetDate)
                );
                const chosen = matchedDay || detailData.serie[0];
                if (typeof chosen?.valor === 'number') {
                  value = Number(chosen.valor);
                  fuente = `mindicador.cl/${item.apiKey}/${chosen.fecha?.slice(0, 10) || targetDate}`;
                }
              }
            }
          }
        } catch (detailErr: any) {
          console.warn(`[IndicatorSyncService] Fallback de serie ${item.code} (${targetDate}): ${detailErr.message}`);
        }
      }

      // 3. Validación y persistencia (para IPC se admiten valores negativos o 0; para UF/USD/UTM se exige > 0)
      const isValidValue =
        item.code === 'IPC'
          ? value !== null && !isNaN(value) && value >= -20 && value <= 100
          : value !== null && !isNaN(value) && value > 0;

      if (isValidValue && value !== null) {
        syncedResults[item.code.toLowerCase()] = value;
        syncedResults[item.code] = value;

        try {
          const valorStr = value.toFixed(4);
          if (isRealMysqlConnected) {
            await db
              .insert(economicIndicators)
              .values({
                codigo: item.code,
                valor: valorStr,
                fecha: targetDate,
                fuente,
              })
              .onDuplicateKeyUpdate({
                set: {
                  valor: valorStr,
                  fuente,
                },
              });
          } else {
            const existingIdx = inMemoryIndicators.findIndex(
              (ind) => ind.codigo === item.code && ind.fecha === targetDate
            );
            if (existingIdx >= 0) {
              inMemoryIndicators[existingIdx].valor = valorStr;
              inMemoryIndicators[existingIdx].fuente = fuente;
            } else {
              inMemoryIndicators.push({
                id: inMemoryIndicators.length + 1,
                codigo: item.code,
                valor: valorStr,
                fecha: targetDate,
                fuente,
                createdAt: new Date(),
              });
            }
          }
        } catch (upsertErr: any) {
          console.warn(`[IndicatorSyncService] Error al guardar indicador ${item.code} en MySQL:`, upsertErr.message);
        }
      }
    }

    return syncedResults;
  }

  /**
   * Obtiene un indicador económico ('uf' | 'dolar' | 'utm' | 'ipc') para una fecha.
   * Consulta primero la base de datos MySQL local; si no existe, invoca la sincronización en línea.
   * Si la API externa no está disponible, recupera el último valor registrado históricamente en la base de datos.
   * Si no existe ningún registro histórico y la API externa falla, lanza ExternalServiceError.
   * TOLERANCIA CERO A VALORES INVENTADOS O MOCKS.
   */
  public static async getIndicator(
    codigo: 'uf' | 'dolar' | 'utm' | 'ipc' | string,
    fecha: Date | string = new Date()
  ): Promise<number> {
    const targetDate = normalizeDateString(fecha);
    const rawCode = codigo.trim().toUpperCase();
    const standardCode: SupportedIndicatorCode =
      rawCode === 'DOLAR' || rawCode === 'USD' ? 'USD' : (rawCode as SupportedIndicatorCode);

    const db = getMysqlDb();

    // 1. CONSULTA EN BASE DE DATOS LOCAL
    try {
      if (isRealMysqlConnected) {
        const [cachedRecord] = await db
          .select()
          .from(economicIndicators)
          .where(and(eq(economicIndicators.codigo, standardCode), eq(economicIndicators.fecha, targetDate)))
          .limit(1);

        if (cachedRecord && cachedRecord.valor) {
          return parseFloat(cachedRecord.valor);
        }
      } else {
        const localFound = inMemoryIndicators.find(
          (ind) => ind.codigo === standardCode && ind.fecha === targetDate
        );
        if (localFound && localFound.valor) {
          return parseFloat(localFound.valor);
        }
      }
    } catch (dbErr: any) {
      console.warn(`[IndicatorSyncService] Error al leer MySQL para ${standardCode} (${targetDate}):`, dbErr.message);
    }

    // 2. SI NO EXISTE EN LA BASE DE DATOS, SINCRONIZAR EN LÍNEA
    try {
      const synced = await this.syncDailyIndicators(targetDate);
      const codeKey = standardCode.toLowerCase();
      if (synced[codeKey] && !isNaN(synced[codeKey])) {
        return synced[codeKey];
      }
      if (synced[standardCode] && !isNaN(synced[standardCode])) {
        return synced[standardCode];
      }
    } catch (syncErr: any) {
      console.warn(`[IndicatorSyncService] Falla al sincronizar en línea indicador ${standardCode}:`, syncErr.message);
    }

    // 3. CONSULTA HISTÓRICA RECIENTE EN BASE DE DATOS (Mismo mes o anterior más cercano)
    try {
      if (isRealMysqlConnected) {
        const [lastRecord] = await db
          .select()
          .from(economicIndicators)
          .where(eq(economicIndicators.codigo, standardCode))
          .orderBy(desc(economicIndicators.fecha))
          .limit(1);

        if (lastRecord && lastRecord.valor) {
          const val = parseFloat(lastRecord.valor);
          console.warn(`[IndicatorSyncService] Utilizando último registro oficial persistido para ${standardCode} (${lastRecord.fecha}): ${val}`);
          return val;
        }
      } else {
        const matching = inMemoryIndicators.filter((i) => i.codigo === standardCode);
        matching.sort((a, b) => b.fecha.localeCompare(a.fecha));
        const lastLocal = matching[0];
        if (lastLocal && lastLocal.valor) {
          const val = parseFloat(lastLocal.valor);
          console.warn(`[IndicatorSyncService] Utilizando registro en memoria oficial para ${standardCode} (${lastLocal.fecha}): ${val}`);
          return val;
        }
      }
    } catch (histErr: any) {
      console.error(`[IndicatorSyncService] Error al consultar histórico MySQL de ${standardCode}:`, histErr.message);
    }

    // 4. SI NO HAY NINGÚN DATO EN BD Y LA RED FALLÓ, FALLAR EXPLÍCITAMENTE (CERO MOCKS)
    throw new ExternalServiceError(
      'mindicador.cl',
      `No se pudo obtener el indicador ${standardCode} para la fecha ${targetDate} ni se encontraron registros históricos en la base de datos local.`,
      'INDICATOR_UNAVAILABLE',
      503,
      { codigo: standardCode, fecha: targetDate }
    );
  }

  /**
   * Alias retrocompatible para getIndicator
   */
  public static async getDailyIndicator(
    codigo: SupportedIndicatorCode,
    fecha: string = new Date().toISOString().split('T')[0]
  ): Promise<number> {
    return this.getIndicator(codigo, fecha);
  }

  /**
   * Sincroniza en lote los indicadores del día y devuelve estructura consolidada
   */
  public static async syncAllCurrentIndicators(fecha?: string): Promise<{
    uf: number;
    dolar: number;
    utm: number;
    ipc: number;
    fecha: string;
  }> {
    const targetDate = fecha ? normalizeDateString(fecha) : new Date().toISOString().split('T')[0];

    // Intentar sincronizar en línea
    await this.syncDailyIndicators(targetDate).catch((e) => {
      console.warn(`[IndicatorSyncService] Aviso en syncAllCurrentIndicators:`, e.message);
    });

    const [uf, dolar, utm, ipc] = await Promise.all([
      this.getIndicator('UF', targetDate),
      this.getIndicator('USD', targetDate),
      this.getIndicator('UTM', targetDate),
      this.getIndicator('IPC', targetDate),
    ]);

    return {
      uf,
      dolar,
      utm,
      ipc,
      fecha: targetDate,
    };
  }
}
