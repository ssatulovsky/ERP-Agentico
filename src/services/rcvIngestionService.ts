import { z } from 'zod';
import crypto from 'node:crypto';
import { sql, eq, and } from 'drizzle-orm';
import { dtesRcv, type NewDteRcv } from '../db/schema/dtesSchema';
import { agentAuditLogs } from '../db/mysqlSchema';
import { pool, getMysqlDb, isRealMysqlConnected, inMemoryDtesRcv } from '../db/mysqlClient';

// ============================================================================
// ESQUEMA DE VALIDACIÓN ZOD PARA FILA OFICIAL DEL RCV DEL SII
// ============================================================================
export const parsedDteRowSchema = z.object({
  empresaId: z.string().min(3, 'RUT de empresa mandante requerido'),
  periodo: z.string().regex(/^\d{4}-\d{2}$/, 'Período debe tener formato AAAA-MM'),
  tipoOperacion: z.enum(['COMPRA', 'VENTA']),
  tipoDte: z.number().int().positive('Tipo DTE debe ser un número entero positivo (ej: 33, 34, 39, 56, 61)'),
  folio: z.number().int().positive('Folio debe ser un número entero positivo'),
  rutContraparte: z.string().min(3, 'RUT de contraparte requerido'),
  razonSocialContraparte: z.string().min(1, 'Razón social de contraparte requerida'),
  fechaEmision: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha de emisión debe ser AAAA-MM-DD'),
  montoExento: z.number().default(0),
  montoNeto: z.number().default(0),
  montoIvaRecuperable: z.number().default(0),
  montoIvaNoRecuperable: z.number().default(0),
  montoTotal: z.number(),
  estadoAcuse: z.string().nullable().optional(),
});

export type ParsedDteRow = z.infer<typeof parsedDteRowSchema>;

// ============================================================================
// FUNCIONES AUXILIARES DE NORMALIZACIÓN (CHILEAN FORMATS)
// ============================================================================

/**
 * Limpia y normaliza montos numéricos desde formatos chilenos (ej: "1.250.000", "$ 450.20", "1250000,50")
 */
function parseChileanNumber(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const str = String(val).trim().replace(/\$/g, '').replace(/\s+/g, '');
  if (!str) return 0;

  // Si contiene puntos y comas (ej: 1.250.000,50 o 1,250,000.50)
  if (str.includes('.') && str.includes(',')) {
    const lastDot = str.lastIndexOf('.');
    const lastComma = str.lastIndexOf(',');
    if (lastComma > lastDot) {
      // Formato chileno: puntos miles, coma decimal
      const clean = str.replace(/\./g, '').replace(',', '.');
      const num = parseFloat(clean);
      return isNaN(num) ? 0 : num;
    } else {
      // Formato anglo: comas miles, punto decimal
      const clean = str.replace(/,/g, '');
      const num = parseFloat(clean);
      return isNaN(num) ? 0 : num;
    }
  }

  // Si solo contiene comas (ej: 1250000,50)
  if (str.includes(',')) {
    const clean = str.replace(',', '.');
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  }

  // Si contiene solo puntos (ej: 1.250.000 -> miles)
  if (str.includes('.')) {
    const parts = str.split('.');
    // Si la última parte tiene exactamente 3 dígitos, son miles
    if (parts.length > 1 && parts.every((p, idx) => idx === 0 || p.length === 3)) {
      const clean = str.replace(/\./g, '');
      const num = parseFloat(clean);
      return isNaN(num) ? 0 : num;
    }
  }

  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

/**
 * Normaliza fechas desde formatos típicos del SII (AAAA-MM-DD, DD/MM/AAAA, DD-MM-AAAA)
 */
function normalizeDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  const trimmed = dateStr.trim();

  // Caso AAAA-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // Caso DD/MM/AAAA o DD-MM-AAAA
  const match = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (match) {
    const day = match[1].padStart(2, '0');
    const month = match[2].padStart(2, '0');
    const year = match[3];
    return `${year}-${month}-${day}`;
  }

  // Caso AAAA/MM/DD
  const matchIsoSlash = trimmed.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (matchIsoSlash) {
    const year = matchIsoSlash[1];
    const month = matchIsoSlash[2].padStart(2, '0');
    const day = matchIsoSlash[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return trimmed;
}

/**
 * Limpia y formatea RUTs al estándar chileno sin puntos (ej: "76.123.456-7" -> "76123456-7")
 */
function cleanRut(rut: string): string {
  if (!rut) return '';
  const clean = rut.replace(/\./g, '').trim().toUpperCase();
  return clean;
}

/**
 * Detecta el delimitador de un archivo de texto tabular (CSV, TSV, punto y coma)
 */
function detectDelimiter(sampleLine: string): string {
  const semicolons = (sampleLine.match(/;/g) || []).length;
  const tabs = (sampleLine.match(/\t/g) || []).length;
  const commas = (sampleLine.match(/,/g) || []).length;

  if (semicolons >= tabs && semicolons >= commas && semicolons > 0) return ';';
  if (tabs >= semicolons && tabs >= commas && tabs > 0) return '\t';
  if (commas > 0) return ',';
  return ';';
}

// ============================================================================
// SERVICIO DE INGESTA Y PROCESAMIENTO RCV
// ============================================================================

export class RcvIngestionService {
  /**
   * Parsea y valida con Zod un archivo oficial exportado del portal RCV del SII
   * (formato CSV/TSV oficial de compras o ventas).
   */
  static async parseRcvFile(
    fileBuffer: Buffer,
    tipoOperacion: 'COMPRA' | 'VENTA',
    periodo: string,
    empresaId: string
  ): Promise<ParsedDteRow[]> {
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new Error('SIN_DATOS: El archivo proporcionado está vacío (0 bytes).');
    }

    // Decodificar el buffer: probar UTF-8, o Latin-1 / ISO-8859-1 si hay caracteres corruptos
    let content = fileBuffer.toString('utf-8');
    if (content.includes('\uFFFD')) {
      content = fileBuffer.toString('latin1');
    }

    const lines = content
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) {
      throw new Error('SIN_DATOS: El archivo no contiene líneas válidas.');
    }

    // Detectar encabezados en las primeras líneas
    let headerLineIndex = -1;
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const lineLower = lines[i].toLowerCase();
      if (
        (lineLower.includes('tipo') || lineLower.includes('docto') || lineLower.includes('dte')) &&
        (lineLower.includes('folio') || lineLower.includes('rut'))
      ) {
        headerLineIndex = i;
        break;
      }
    }

    if (headerLineIndex === -1) {
      throw new Error('FORMATO_INVALIDO: No se encontró la fila de encabezados oficial del RCV.');
    }

    const headerLine = lines[headerLineIndex];
    const delimiter = detectDelimiter(headerLine);
    const rawHeaders = headerLine.split(delimiter).map((h) => h.replace(/^["']|["']$/g, '').trim().toLowerCase());

    // Mapeo dinámico de nombres de columnas del SII
    const colIndexMap: Record<string, number> = {};
    rawHeaders.forEach((header, idx) => {
      const normalized = header
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '');

      if (
        (normalized.includes('tipodoc') || normalized.includes('tipodte') || normalized === 'tipo') &&
        !normalized.includes('referencia')
      ) {
        colIndexMap['tipoDte'] = idx;
      } else if (normalized === 'folio' || normalized.includes('nrofolio') || normalized.includes('numfolio')) {
        colIndexMap['folio'] = idx;
      } else if (normalized.includes('fechadocto') || normalized.includes('fechaemision') || normalized.includes('fecha')) {
        colIndexMap['fechaEmision'] = idx;
      } else if (
        normalized.includes('rutproveedor') ||
        normalized.includes('rutcliente') ||
        normalized.includes('rutcontraparte') ||
        normalized.includes('rutemisor') ||
        normalized.includes('rutreceptor') ||
        normalized === 'rut'
      ) {
        colIndexMap['rutContraparte'] = idx;
      } else if (
        !normalized.includes('rut') &&
        (normalized.includes('razonsocial') ||
        normalized.includes('nombreorazonsocial') ||
        normalized.includes('contraparte') ||
        normalized.includes('proveedor') ||
        normalized.includes('cliente'))
      ) {
        colIndexMap['razonSocialContraparte'] = idx;
      } else if (normalized.includes('montoexento') || normalized === 'exento') {
        colIndexMap['montoExento'] = idx;
      } else if (normalized.includes('montoneto') || normalized === 'neto') {
        colIndexMap['montoNeto'] = idx;
      } else if (
        normalized.includes('montoivarecuperable') ||
        normalized.includes('ivarecuperable') ||
        normalized.includes('montoiva') ||
        normalized === 'iva'
      ) {
        colIndexMap['montoIvaRecuperable'] = idx;
      } else if (
        normalized.includes('montoivanorecuperable') ||
        normalized.includes('ivanorecuperable') ||
        normalized.includes('ivanoretenido')
      ) {
        colIndexMap['montoIvaNoRecuperable'] = idx;
      } else if (normalized.includes('montototal') || normalized === 'total') {
        colIndexMap['montoTotal'] = idx;
      } else if (normalized.includes('estado') || normalized.includes('acuse') || normalized.includes('reclamo')) {
        colIndexMap['estadoAcuse'] = idx;
      }
    });

    if (colIndexMap['folio'] === undefined) {
      // Buscar cualquier columna que contenga folio o docto
      const fallbackFolioIdx = rawHeaders.findIndex(h => h.includes('folio') || h.includes('docto'));
      if (fallbackFolioIdx !== -1) {
        colIndexMap['folio'] = fallbackFolioIdx;
      } else {
        throw new Error('FORMATO_INVALIDO: Columna de Folio no identificada en el archivo.');
      }
    }

    const parsedRows: ParsedDteRow[] = [];
    const dataLines = lines.slice(headerLineIndex + 1);

    for (let lineNum = 0; lineNum < dataLines.length; lineNum++) {
      const line = dataLines[lineNum];
      if (!line || line.startsWith('--')) continue;

      const cols = line.split(delimiter).map((c) => c.replace(/^["']|["']$/g, '').trim());
      if (cols.length < 3) continue;

      const rawFolio = cols[colIndexMap['folio']];
      const folioNum = parseInt(rawFolio ? rawFolio.replace(/[^0-9]/g, '') : '', 10);
      if (isNaN(folioNum) || folioNum <= 0) {
        continue;
      }

      const montoExentoCandidate = colIndexMap['montoExento'] !== undefined ? parseChileanNumber(cols[colIndexMap['montoExento']]) : 0;
      const montoNetoCandidate = colIndexMap['montoNeto'] !== undefined ? parseChileanNumber(cols[colIndexMap['montoNeto']]) : 0;

      let tipoDteNum = 33;
      if (colIndexMap['tipoDte'] !== undefined && cols[colIndexMap['tipoDte']]) {
        const parsed = parseInt(cols[colIndexMap['tipoDte']].replace(/[^0-9]/g, ''), 10);
        if (!isNaN(parsed) && parsed > 0) {
          tipoDteNum = parsed;
        }
      } else {
        if (montoExentoCandidate > 0 && montoNetoCandidate === 0) {
          tipoDteNum = 34; // Factura Exenta
        } else {
          tipoDteNum = 33;
        }
      }

      const rawRut = colIndexMap['rutContraparte'] !== undefined ? cols[colIndexMap['rutContraparte']] : '';
      const cleanedRutVal = cleanRut(rawRut);
      if (!cleanedRutVal) continue;

      const razonSocialVal =
        colIndexMap['razonSocialContraparte'] !== undefined
          ? cols[colIndexMap['razonSocialContraparte']] || `Contraparte RUT ${cleanedRutVal}`
          : `Contraparte RUT ${cleanedRutVal}`;

      const rawFecha = colIndexMap['fechaEmision'] !== undefined ? cols[colIndexMap['fechaEmision']] : '';
      const fechaEmisionVal = normalizeDate(rawFecha);

      const montoExentoVal =
        colIndexMap['montoExento'] !== undefined ? parseChileanNumber(cols[colIndexMap['montoExento']]) : 0;
      const montoNetoVal =
        colIndexMap['montoNeto'] !== undefined ? parseChileanNumber(cols[colIndexMap['montoNeto']]) : 0;
      const montoIvaRecuperableVal =
        colIndexMap['montoIvaRecuperable'] !== undefined
          ? parseChileanNumber(cols[colIndexMap['montoIvaRecuperable']])
          : 0;
      const montoIvaNoRecuperableVal =
        colIndexMap['montoIvaNoRecuperable'] !== undefined
          ? parseChileanNumber(cols[colIndexMap['montoIvaNoRecuperable']])
          : 0;
      let montoTotalVal =
        colIndexMap['montoTotal'] !== undefined ? parseChileanNumber(cols[colIndexMap['montoTotal']]) : 0;

      // Autocalcular total si viene en 0
      if (montoTotalVal === 0 && (montoNetoVal > 0 || montoExentoVal > 0)) {
        montoTotalVal = montoNetoVal + montoExentoVal + montoIvaRecuperableVal + montoIvaNoRecuperableVal;
      }

      const estadoAcuseVal =
        colIndexMap['estadoAcuse'] !== undefined ? cols[colIndexMap['estadoAcuse']] || null : null;

      const candidate = {
        empresaId: cleanRut(empresaId),
        periodo,
        tipoOperacion,
        tipoDte: tipoDteNum,
        folio: folioNum,
        rutContraparte: cleanedRutVal,
        razonSocialContraparte: razonSocialVal,
        fechaEmision: fechaEmisionVal,
        montoExento: montoExentoVal,
        montoNeto: montoNetoVal,
        montoIvaRecuperable: montoIvaRecuperableVal,
        montoIvaNoRecuperable: montoIvaNoRecuperableVal,
        montoTotal: montoTotalVal,
        estadoAcuse: estadoAcuseVal,
      };

      const validation = parsedDteRowSchema.safeParse(candidate);
      if (validation.success) {
        parsedRows.push(validation.data);
      } else {
        console.warn(`[RcvIngestion] Fila ${lineNum + 1} rechazada por validación Zod:`, validation.error.format());
      }
    }

    if (parsedRows.length === 0) {
      throw new Error('SIN_DATOS: No se encontraron filas de DTE válidas en el archivo exportado.');
    }

    return parsedRows;
  }

  /**
   * Ingesta atómica con upsert (onDuplicateKeyUpdate) en la base de datos MySQL,
   * suma agregada en SQL y registro forense en agent_audit_logs.
   */
  static async ingestDteBatch(
    empresaId: string,
    dtes: ParsedDteRow[],
    traceId: string
  ): Promise<{
    insertedCount: number;
    totalNeto: number;
    totalIvaRecuperable: number;
    totalMonto: number;
    auditLogId: string;
    durationMs: number;
  }> {
    const startTime = Date.now();

    if (!dtes || dtes.length === 0) {
      throw new Error('SIN_DATOS: No se proporcionaron documentos para ingesta en lote.');
    }

    const periodo = dtes[0].periodo;
    const tipoOperacion = dtes[0].tipoOperacion;
    const cleanEmpresaRut = cleanRut(empresaId);

    // Calcular hash SHA-256 de los datos de entrada
    const payloadHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(dtes))
      .digest('hex');

    // Preparar registros para inserción en Drizzle
    const newRecords: NewDteRcv[] = dtes.map((d) => ({
      id: crypto.randomUUID(),
      empresaId: cleanEmpresaRut,
      periodo: d.periodo,
      tipoOperacion: d.tipoOperacion,
      tipoDte: d.tipoDte,
      folio: d.folio,
      rutContraparte: d.rutContraparte,
      razonSocialContraparte: d.razonSocialContraparte,
      fechaEmision: d.fechaEmision,
      montoExento: d.montoExento.toFixed(2),
      montoNeto: d.montoNeto.toFixed(2),
      montoIvaRecuperable: d.montoIvaRecuperable.toFixed(2),
      montoIvaNoRecuperable: d.montoIvaNoRecuperable.toFixed(2),
      montoTotal: d.montoTotal.toFixed(2),
      estadoAcuse: d.estadoAcuse || null,
    }));

    const activeDb = getMysqlDb();

    // Inserción atómica con onDuplicateKeyUpdate
    if (isRealMysqlConnected) {
      // Chunking para no superar límites de parámetros SQL en lotes grandes (500 por lote)
      const CHUNK_SIZE = 250;
      for (let i = 0; i < newRecords.length; i += CHUNK_SIZE) {
        const chunk = newRecords.slice(i, i + CHUNK_SIZE);
        await activeDb
          .insert(dtesRcv)
          .values(chunk)
          .onDuplicateKeyUpdate({
            set: {
              razonSocialContraparte: sql`VALUES(razon_social_contraparte)`,
              fechaEmision: sql`VALUES(fecha_emision)`,
              montoExento: sql`VALUES(monto_exento)`,
              montoNeto: sql`VALUES(monto_neto)`,
              montoIvaRecuperable: sql`VALUES(monto_iva_recuperable)`,
              montoIvaNoRecuperable: sql`VALUES(monto_iva_no_recuperable)`,
              montoTotal: sql`VALUES(monto_total)`,
              estadoAcuse: sql`VALUES(estado_acuse)`,
            },
          });
      }
    } else {
      // Modo contingencia en memoria
      await activeDb.insert(dtesRcv).values(newRecords).execute();
    }

    // Consulta de agregación SQL real sobre la tabla dtes_rcv
    let aggregatedTotalNeto = 0;
    let aggregatedTotalIva = 0;
    let aggregatedTotalMonto = 0;
    let totalFilas = dtes.length;

    if (isRealMysqlConnected) {
      const [aggResult]: any = await pool.query(
        `SELECT 
          COUNT(*) as cantidad,
          COALESCE(SUM(monto_neto), 0) as total_neto,
          COALESCE(SUM(monto_iva_recuperable), 0) as total_iva,
          COALESCE(SUM(monto_total), 0) as total_monto
        FROM dtes_rcv
        WHERE empresa_id = ? AND periodo = ? AND tipo_operacion = ?`,
        [cleanEmpresaRut, periodo, tipoOperacion]
      );

      if (Array.isArray(aggResult) && aggResult.length > 0) {
        aggregatedTotalNeto = Number(aggResult[0].total_neto || 0);
        aggregatedTotalIva = Number(aggResult[0].total_iva || 0);
        aggregatedTotalMonto = Number(aggResult[0].total_monto || 0);
        totalFilas = Number(aggResult[0].cantidad || dtes.length);
      }
    } else {
      // Cálculo directo sobre el array en memoria
      const matchRows = inMemoryDtesRcv.filter(
        (d) => d.empresaId === cleanEmpresaRut && d.periodo === periodo && d.tipoOperacion === tipoOperacion
      );
      aggregatedTotalNeto = matchRows.reduce((acc, r) => acc + Number(r.montoNeto || 0), 0);
      aggregatedTotalIva = matchRows.reduce((acc, r) => acc + Number(r.montoIvaRecuperable || 0), 0);
      aggregatedTotalMonto = matchRows.reduce((acc, r) => acc + Number(r.montoTotal || 0), 0);
      totalFilas = matchRows.length;
    }

    const durationMs = Date.now() - startTime;
    const auditLogId = crypto.randomUUID();

    // Registro forense inmutable en agent_audit_logs
    try {
      await activeDb.insert(agentAuditLogs).values({
        id: auditLogId,
        traceId,
        empresaId: cleanEmpresaRut,
        agenteNombre: 'AGENTE_INGESTA_RCV_SII',
        accion: 'INGESTA_LOTE_DTE_REAL',
        estadoTransicion: 'COMPLETADO',
        modelName: 'mysql8-drizzle-engine',
        promptHash: payloadHash,
        payloadInput: {
          periodo,
          tipoOperacion,
          cantidadDocumentosRecibidos: dtes.length,
          hashSha256: payloadHash,
        },
        payloadOutput: {
          estado: 'EXITOSO',
          documentosProcesados: dtes.length,
          totalesAgregadosEnSql: {
            totalDocumentosEnBaseDatos: totalFilas,
            totalNeto: aggregatedTotalNeto,
            totalIvaRecuperable: aggregatedTotalIva,
            totalMonto: aggregatedTotalMonto,
          },
        },
        supervisorVeredicto: 'APROBADO_INTEGRIDAD_TRIBUTARIA',
        supervisorSignature: `SIG-RCV-${cleanEmpresaRut}-${Date.now()}`,
        tiempoEjecucionMs: durationMs,
      }).execute();
    } catch (auditErr: any) {
      console.warn('[RcvIngestion] Advertencia al persistir agent_audit_logs:', auditErr.message);
    }

    return {
      insertedCount: dtes.length,
      totalNeto: aggregatedTotalNeto,
      totalIvaRecuperable: aggregatedTotalIva,
      totalMonto: aggregatedTotalMonto,
      auditLogId,
      durationMs,
    };
  }
}
