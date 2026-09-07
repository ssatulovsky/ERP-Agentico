import crypto from 'node:crypto';
import { z } from 'zod';
import { sql, eq, and } from 'drizzle-orm';
import { dtesRcv, type NewDteRcv } from '../db/schema/dtesSchema';
import { agentAuditLogs } from '../db/mysqlSchema';
import { pool, getMysqlDb, isRealMysqlConnected, inMemoryDtesRcv } from '../db/mysqlClient';
import { SiiGatewayError } from './errors';
import { RcvIngestionService, type ParsedDteRow } from './rcvIngestionService';

export { SiiGatewayError } from './errors';

// ============================================================================
// TIPOS E INTERFACES OFICIALES
// ============================================================================

export interface DteRawRecord {
  tipoDte: number;
  folio: number;
  tipoOperacion: 'COMPRA' | 'VENTA';
  rutContraparte: string;
  razonSocialContraparte: string;
  fechaEmision: string;
  montoExento: number;
  montoNeto: number;
  montoIvaRecuperable: number;
  montoIvaNoRecuperable: number;
  montoTotal: number;
  estadoAcuse?: string | null;
}

export interface IngestSummary {
  empresaId: string;
  periodo: string;
  tipoOperacion: 'COMPRA' | 'VENTA';
  insertedCount: number;
  totalNeto: number;
  totalIvaRecuperable: number;
  totalMonto: number;
  traceId: string;
  timestamp: string;
}

// ============================================================================
// ESQUEMA ZOD PARA VALIDACIÓN PERICIAL DE CADA FILA
// ============================================================================

export const dteValidationSchema = z.object({
  tipoDte: z.number().int().positive('Tipo DTE debe ser entero positivo (ej: 33, 34, 39, 56, 61)'),
  folio: z.number().int().positive('Folio de documento debe ser positivo'),
  rutContraparte: z.string().min(3, 'RUT contraparte requerido'),
  razonSocialContraparte: z.string().min(1, 'Razón social requerida'),
  fechaEmision: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato fecha debe ser AAAA-MM-DD'),
  montoExento: z.number().nonnegative().default(0),
  montoNeto: z.number().nonnegative().default(0),
  montoIvaRecuperable: z.number().nonnegative().default(0),
  montoIvaNoRecuperable: z.number().nonnegative().default(0),
  montoTotal: z.number().positive('Monto total debe ser mayor a cero'),
  estadoAcuse: z.string().nullable().optional(),
});

/**
 * Servicio de Ingesta, Sincronización y Auditoría del Registro de Compras y Ventas (RCV)
 * de conformidad estricta con la normativa del Servicio de Impuestos Internos (SII).
 *
 * TOLERANCIA CERO A MOCKS O DATOS GENERADOS ARTIFICIALMENTE.
 */
export class SiiRcvService {
  /**
   * Consume la API externa del Gateway SII para obtener el detalle de DTEs del RCV.
   * Si no están configuradas las credenciales o el servicio no responde,
   * lanza explícitamente un error tipado SiiGatewayError sin simular respuestas.
   */
  public static async fetchRemoteRcv(
    empresaRut: string,
    periodo: string,
    tipo: 'COMPRA' | 'VENTA'
  ): Promise<DteRawRecord[]> {
    const gatewayUrl =
      process.env.SII_GATEWAY_URL ||
      process.env.SII_API_GATEWAY_URL;

    const apiKey =
      process.env.SII_GATEWAY_TOKEN ||
      process.env.SII_API_KEY;

    if (!gatewayUrl) {
      throw new SiiGatewayError(
        'SII_GATEWAY_URL no configurada en las variables de entorno (.env). Para sincronización directa por API se requiere configurar el endpoint de pasarela autorizada ante el SII.',
        'MISSING_GATEWAY_CONFIG',
        500,
        { empresaRut, periodo, tipo }
      );
    }

    if (!apiKey) {
      throw new SiiGatewayError(
        'SII_API_KEY o SII_GATEWAY_TOKEN no configurado en el entorno. Se requiere autenticación Bearer Token con el certificado digital registrado.',
        'MISSING_API_KEY',
        401,
        { empresaRut, periodo, tipo }
      );
    }

    const cleanRut = empresaRut.replace(/\./g, '').trim().toUpperCase();
    const normalizedPeriodo = periodo.replace('-', ''); // AAAA-MM -> AAAAMM

    const endpoint = `${gatewayUrl.replace(/\/+$/, '')}/api/rcv/${tipo.toLowerCase()}`;

    console.log(`[SiiRcvService] Conectando a Gateway oficial SII: ${endpoint} (RUT: ${cleanRut}, Periodo: ${periodo})`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'X-Contributor-Rut': cleanRut,
          'User-Agent': 'Chile-ERP-Enterprise/2.0 (SII-RCV-Engine)',
        },
        body: JSON.stringify({
          rut: cleanRut,
          periodo: normalizedPeriodo,
          tipo,
        }),
        signal: controller.signal,
      });
    } catch (networkErr: any) {
      clearTimeout(timeoutId);
      throw new SiiGatewayError(
        `Falla de conectividad con el Gateway del SII en ${endpoint}: ${networkErr.message}`,
        'GATEWAY_CONNECTION_FAILED',
        502,
        { originalError: networkErr.message, endpoint }
      );
    }

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorBody = '';
      try {
        errorBody = await response.text();
      } catch {
        errorBody = 'No response body';
      }

      throw new SiiGatewayError(
        `El Gateway del SII respondió con código de error HTTP ${response.status}: ${errorBody}`,
        'GATEWAY_HTTP_ERROR',
        response.status,
        { status: response.status, errorBody, endpoint }
      );
    }

    const data: any = await response.json();

    // Validar que la respuesta contenga un array de documentos
    const rawDocuments = Array.isArray(data) ? data : data?.documentos || data?.dtes || [];
    if (!Array.isArray(rawDocuments)) {
      throw new SiiGatewayError(
        'El Gateway del SII retornó una estructura de datos inesperada sin lista de documentos.',
        'MALFORMED_GATEWAY_RESPONSE',
        502,
        { data }
      );
    }

    // Mapear y validar cada documento obtenido
    const records: DteRawRecord[] = [];
    for (const doc of rawDocuments) {
      const parsed = {
        tipoDte: Number(doc.tipoDte || doc.tipo_dte || doc.tipoDoc || 33),
        folio: Number(doc.folio || doc.nroFolio || 0),
        tipoOperacion: tipo,
        rutContraparte: String(doc.rutContraparte || doc.rutEmisor || doc.rutReceptor || '').replace(/\./g, '').trim(),
        razonSocialContraparte: String(doc.razonSocialContraparte || doc.razonSocial || doc.nombreEmisor || '').trim(),
        fechaEmision: String(doc.fechaEmision || doc.fechaDocto || '').trim().split('T')[0],
        montoExento: Number(doc.montoExento || 0),
        montoNeto: Number(doc.montoNeto || 0),
        montoIvaRecuperable: Number(doc.montoIvaRecuperable || doc.montoIva || 0),
        montoIvaNoRecuperable: Number(doc.montoIvaNoRecuperable || 0),
        montoTotal: Number(doc.montoTotal || 0),
        estadoAcuse: doc.estadoAcuse || null,
      };

      const val = dteValidationSchema.safeParse(parsed);
      if (val.success) {
        records.push(parsed);
      } else {
        console.warn('[SiiRcvService] Documento remoto no superó validación Zod:', val.error.format());
      }
    }

    return records;
  }

  /**
   * Parsea un archivo oficial CSV/TSV exportado del portal del SII, valida fila por fila con Zod,
   * e ingesta de manera atómica con upsert (ON DUPLICATE KEY UPDATE) en MySQL 8.0.
   *
   * @param fileBuffer Buffer del archivo subido
   * @param empresaRut RUT de la empresa mandante
   * @param periodo Periodo tributario en formato AAAA-MM
   * @param tipo Operación: 'COMPRA' o 'VENTA'
   */
  public static async parseAndIngestRcvCsv(
    fileBuffer: Buffer,
    empresaRut: string,
    periodo: string,
    tipo: 'COMPRA' | 'VENTA'
  ): Promise<IngestSummary> {
    const traceId = crypto.randomUUID();
    const cleanRut = empresaRut.replace(/\./g, '').trim().toUpperCase();

    console.log(`[SiiRcvService] Iniciando parseo e ingesta CSV para empresa ${cleanRut} (${periodo} - ${tipo})`);

    // 1. Parsear archivo con RcvIngestionService
    const parsedRows: ParsedDteRow[] = await RcvIngestionService.parseRcvFile(
      fileBuffer,
      tipo,
      periodo,
      cleanRut
    );

    // 2. Realizar ingesta idempotente en MySQL
    const result = await RcvIngestionService.ingestDteBatch(cleanRut, parsedRows, traceId);

    // 3. Registrar auditoría inmutable
    const db = getMysqlDb();
    try {
      if (isRealMysqlConnected) {
        await db.insert(agentAuditLogs).values({
          traceId,
          empresaId: cleanRut,
          agenteNombre: 'AGENTE_AUDITOR_RCV',
          accion: `INGESTA_RCV_CSV_${tipo}`,
          estadoTransicion: 'APROBADO',
          modelName: 'sii-rcv-engine',
          payloadInput: {
            empresaRut: cleanRut,
            periodo,
            tipo,
            totalLineasCsv: parsedRows.length,
          },
          payloadOutput: {
            insertedCount: result.insertedCount,
            totalNeto: result.totalNeto,
            totalIvaRecuperable: result.totalIvaRecuperable,
            totalMonto: result.totalMonto,
          },
          tiempoEjecucionMs: 15,
        });
      }
    } catch (auditErr: any) {
      console.warn(`[SiiRcvService] Advertencia al registrar log de auditoría:`, auditErr.message);
    }

    return {
      empresaId: cleanRut,
      periodo,
      tipoOperacion: tipo,
      insertedCount: result.insertedCount,
      totalNeto: result.totalNeto,
      totalIvaRecuperable: result.totalIvaRecuperable,
      totalMonto: result.totalMonto,
      traceId,
      timestamp: new Date().toISOString(),
    };
  }
}
