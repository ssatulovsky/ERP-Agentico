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

    const syncedResults: Record<string, number> = {};
    const [year, monthStr, dayStr] = targetDate.split('-');
    const monthNum = parseInt(monthStr, 10) || 1;
    const dayNum = parseInt(dayStr, 10) || 1;
    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    const targetMonthName = monthNames[monthNum - 1] || 'Enero';

    // 1. Intentar proveedor principal mindicador.cl (timeout de 2.5s para no bloquear peticiones)
    let mindicadorData: any = null;
    try {
      const response = await fetch('https://mindicador.cl/api', {
        method: 'GET',
        headers: commonHeaders,
        signal: AbortSignal.timeout(2500),
      });

      if (response.ok) {
        mindicadorData = await response.json();
      }
    } catch (_err: any) {
      // mindicador.cl timeout o caída momentánea: proceder con los proveedores oficiales del SII y DolarAPI
      console.info(`[IndicatorSyncService] mindicador.cl no disponible en 2.5s. Activando proveedores oficiales chilenos (SII / DolarAPI).`);
    }

    // Estructura para consolidar valores verificados
    const extracted: {
      UF?: { valor: number; fuente: string };
      USD?: { valor: number; fuente: string };
      UTM?: { valor: number; fuente: string };
      IPC?: { valor: number; fuente: string };
    } = {};

    if (mindicadorData) {
      if (typeof mindicadorData.uf?.valor === 'number' && mindicadorData.uf.valor > 0) {
        extracted.UF = { valor: mindicadorData.uf.valor, fuente: 'mindicador.cl-oficial' };
      }
      if (typeof mindicadorData.dolar?.valor === 'number' && mindicadorData.dolar.valor > 0) {
        extracted.USD = { valor: mindicadorData.dolar.valor, fuente: 'mindicador.cl-oficial' };
      }
      if (typeof mindicadorData.utm?.valor === 'number' && mindicadorData.utm.valor > 0) {
        extracted.UTM = { valor: mindicadorData.utm.valor, fuente: 'mindicador.cl-oficial' };
      }
      if (typeof mindicadorData.ipc?.valor === 'number') {
        extracted.IPC = { valor: mindicadorData.ipc.valor, fuente: 'mindicador.cl-oficial' };
      }
    }

    // 2. Si faltan indicadores, consultar fuentes oficiales chilenas en paralelo: DolarAPI y SII Oficial
    const missingCodes = (['UF', 'USD', 'UTM', 'IPC'] as SupportedIndicatorCode[]).filter((c) => !extracted[c]);

    if (missingCodes.length > 0) {
      const fetchTasks: Promise<void>[] = [];

      // A. DolarAPI para USD
      if (missingCodes.includes('USD')) {
        fetchTasks.push((async () => {
          try {
            const res = await fetch('https://cl.dolarapi.com/v1/cotizaciones/usd', {
              headers: commonHeaders,
              signal: AbortSignal.timeout(3000),
            });
            if (res.ok) {
              const data = await res.json();
              const val = Number(data.venta || data.compra || data.ultimoCierre);
              if (val > 0 && !isNaN(val)) {
                extracted.USD = { valor: val, fuente: 'dolarapi.cl-oficial' };
              }
            }
          } catch (_e) {}
        })());
      }

      // B. SII Oficial para UF
      if (missingCodes.includes('UF')) {
        fetchTasks.push((async () => {
          try {
            const res = await fetch(`https://www.sii.cl/valores_y_fechas/uf/uf${year}.htm`, {
              headers: { ...commonHeaders, 'Accept': 'text/html' },
              signal: AbortSignal.timeout(3000),
            });
            if (res.ok) {
              const html = await res.text();
              const mPos = html.indexOf(`<h2>${targetMonthName}</h2>`);
              if (mPos !== -1) {
                const slice = html.slice(mPos, mPos + 8000);
                const dayRegex = new RegExp(`<th[^>]*><strong>${dayNum}<\\/strong><\\/th>\\s*<td[^>]*>([0-9.,]+)<\\/td>`, 'i');
                const match = slice.match(dayRegex);
                if (match && match[1]) {
                  const parsed = parseFloat(match[1].replace(/\./g, '').replace(',', '.'));
                  if (parsed > 0 && !isNaN(parsed)) {
                    extracted.UF = { valor: parsed, fuente: 'sii.cl-oficial' };
                  }
                }
              }
            }
          } catch (_e) {}
        })());
      }

      // C. SII Oficial para UTM e IPC
      if (missingCodes.includes('UTM') || missingCodes.includes('IPC')) {
        fetchTasks.push((async () => {
          try {
            const res = await fetch(`https://www.sii.cl/valores_y_fechas/utm/utm${year}.htm`, {
              headers: { ...commonHeaders, 'Accept': 'text/html' },
              signal: AbortSignal.timeout(3000),
            });
            if (res.ok) {
              const html = await res.text();
              const rowRegex = /<tr>\s*<th>([^<]+)<\/th>([\s\S]*?)<\/tr>/gi;
              let m;
              let lastIpc: number | null = null;
              while ((m = rowRegex.exec(html)) !== null) {
                const mes = m[1].trim();
                const row = m[2];
                const tds = [...row.matchAll(/<td[^>]*>(.*?)<\/td>/gi)].map((x) => x[1].replace(/&nbsp;/g, '').trim());
                if (tds.length >= 1 && mes.toLowerCase() === targetMonthName.toLowerCase()) {
                  const val = parseFloat(tds[0].replace(/\./g, '').replace(',', '.'));
                  if (val > 0 && !isNaN(val)) {
                    extracted.UTM = { valor: val, fuente: 'sii.cl-oficial' };
                  }
                }
                if (tds.length >= 4 && tds[3] !== '') {
                  const val = parseFloat(tds[3].replace(/\./g, '').replace(',', '.'));
                  if (!isNaN(val)) lastIpc = val;
                }
              }
              if (lastIpc !== null && !extracted.IPC) {
                extracted.IPC = { valor: lastIpc, fuente: 'sii.cl-oficial' };
              }
            }
          } catch (_e) {}
        })());
      }

      await Promise.allSettled(fetchTasks);
    }

    // 3. Validación y persistencia en MySQL o memoria
    for (const [codeKey, data] of Object.entries(extracted)) {
      const code = codeKey as SupportedIndicatorCode;
      const value = data.valor;
      const fuente = data.fuente;

      const isValidValue =
        code === 'IPC'
          ? value !== null && !isNaN(value) && value >= -20 && value <= 100
          : value !== null && !isNaN(value) && value > 0;

      if (isValidValue && value !== null) {
        syncedResults[code.toLowerCase()] = value;
        syncedResults[code] = value;

        try {
          const valorStr = value.toFixed(4);
          if (isRealMysqlConnected) {
            await db
              .insert(economicIndicators)
              .values({
                codigo: code,
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
              (ind) => ind.codigo === code && ind.fecha === targetDate
            );
            if (existingIdx >= 0) {
              inMemoryIndicators[existingIdx].valor = valorStr;
              inMemoryIndicators[existingIdx].fuente = fuente;
            } else {
              inMemoryIndicators.push({
                id: inMemoryIndicators.length + 1,
                codigo: code,
                valor: valorStr,
                fecha: targetDate,
                fuente,
                createdAt: new Date(),
              });
            }
          }
        } catch (upsertErr: any) {
          console.warn(`[IndicatorSyncService] Error al guardar indicador ${code} en MySQL:`, upsertErr.message);
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
      'sii.cl / mindicador.cl',
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
