import { Worker, type Job } from 'bullmq';
import crypto from 'node:crypto';
import { getRedisConnectionOptions } from '../queues/redisConfig';
import {
  QUEUE_NAMES,
  type RcvSyncJobData,
  type AgentJobResult,
} from '../queues/types';
import { SiiRcvService, SiiGatewayError } from '../services/siiRcvService';
import { RcvIngestionService, type ParsedDteRow } from '../services/rcvIngestionService';
import { getMysqlDb } from '../db/mysqlClient';
import { agentAuditLogs } from '../db/mysqlSchema';

/**
 * Función central de procesamiento de sincronización e ingesta RCV.
 * Conectada al servicio de producción SiiRcvService sin mocks ni datos sintéticos.
 */
export async function processRcvSyncJob(job: {
  id?: string;
  attemptsMade: number;
  data: RcvSyncJobData;
  updateProgress?: (progress: number | object) => Promise<void>;
}): Promise<AgentJobResult> {
  const startTime = Date.now();
  const {
    traceId = crypto.randomUUID(),
    empresaId,
    periodo,
    modo = 'COMPRAS',
    source = 'DIRECT_API',
    payloadBase64,
  } = job.data;

  const activeDb = getMysqlDb();

  console.log(`[Worker:RCV] Procesando lote real de RCV para ${empresaId} (${periodo} - ${modo}) vía ${source}`, {
    jobId: job.id,
    traceId,
    intento: job.attemptsMade + 1,
  });

  if (job.updateProgress) {
    await job.updateProgress(10).catch(() => {});
  }

  // 1. Registrar inicio de la ingesta en auditoría inmutable
  try {
    await activeDb.insert(agentAuditLogs).values({
      id: crypto.randomUUID(),
      traceId,
      empresaId,
      agenteNombre: 'AGENTE_WORKER_RCV_SII',
      accion: `INICIO_INGESTA_RCV_${source}`,
      estadoTransicion: 'EJECUTANDO',
      modelName: 'sii-rcv-ingestion-pipeline',
      payloadInput: {
        jobId: job.id,
        empresaId,
        periodo,
        modo,
        source,
      },
      payloadOutput: { estado: 'PROCESANDO' },
      tiempoEjecucionMs: 0,
    }).execute();
  } catch (err) {
    console.warn('[Worker:RCV] Advertencia al registrar log de inicio:', err);
  }

  let parsedDtes: ParsedDteRow[] = [];
  const operaciones: ('COMPRA' | 'VENTA')[] =
    modo === 'CONSOLIDADO' ? ['COMPRA', 'VENTA'] : [modo === 'COMPRAS' ? 'COMPRA' : 'VENTA'];

  // ==========================================================================
  // CASO 1: Ingesta directa de archivo oficial exportado del SII (FILE_UPLOAD)
  // ==========================================================================
  if (source === 'FILE_UPLOAD') {
    if (!payloadBase64 || payloadBase64.trim() === '') {
      const errorMsg = 'SIN_DATOS: Se especificó source FILE_UPLOAD pero no se adjuntó contenido payloadBase64.';
      try {
        await activeDb.insert(agentAuditLogs).values({
          id: crypto.randomUUID(),
          traceId,
          empresaId,
          agenteNombre: 'AGENTE_WORKER_RCV_SII',
          accion: 'ERROR_ARCHIVO_RCV',
          estadoTransicion: 'SIN_DATOS',
          modelName: 'sii-rcv-ingestion-pipeline',
          payloadInput: { source, periodo, modo },
          payloadOutput: { error: errorMsg },
          supervisorVeredicto: 'RECHAZADO_PAYLOAD_VACIO',
          tiempoEjecucionMs: Date.now() - startTime,
        }).execute();
      } catch (logErr) {
        console.warn('[Worker:RCV] Error al registrar log de payload vacío:', logErr);
      }
      throw new Error(errorMsg);
    }

    if (job.updateProgress) {
      await job.updateProgress(30).catch(() => {});
    }

    const fileBuffer = Buffer.from(payloadBase64, 'base64');
    const primaryOp: 'COMPRA' | 'VENTA' = operaciones[0];
    parsedDtes = await RcvIngestionService.parseRcvFile(fileBuffer, primaryOp, periodo, empresaId);

    if (job.updateProgress) {
      await job.updateProgress(60).catch(() => {});
    }
  }

  // ==========================================================================
  // CASO 2: Ingesta mediante API Gateway Directo del SII (DIRECT_API)
  // ==========================================================================
  else if (source === 'DIRECT_API') {
    if (job.updateProgress) {
      await job.updateProgress(25).catch(() => {});
    }

    for (const operacion of operaciones) {
      try {
        const rawRecords = await SiiRcvService.fetchRemoteRcv(empresaId, periodo, operacion);
        
        for (const item of rawRecords) {
          parsedDtes.push({
            empresaId,
            periodo,
            tipoOperacion: operacion,
            tipoDte: item.tipoDte,
            folio: item.folio,
            rutContraparte: item.rutContraparte,
            razonSocialContraparte: item.razonSocialContraparte,
            fechaEmision: item.fechaEmision,
            montoExento: item.montoExento,
            montoNeto: item.montoNeto,
            montoIvaRecuperable: item.montoIvaRecuperable,
            montoIvaNoRecuperable: item.montoIvaNoRecuperable,
            montoTotal: item.montoTotal,
            estadoAcuse: item.estadoAcuse || null,
          });
        }
      } catch (gatewayErr: any) {
        try {
          await activeDb.insert(agentAuditLogs).values({
            id: crypto.randomUUID(),
            traceId,
            empresaId,
            agenteNombre: 'AGENTE_WORKER_RCV_SII',
            accion: 'FALLO_CONEXION_GATEWAY_SII',
            estadoTransicion: 'ERROR_GATEWAY',
            modelName: 'sii-direct-gateway',
            payloadInput: { source, periodo, modo, operacion },
            payloadOutput: { error: gatewayErr.message, code: gatewayErr.code },
            supervisorVeredicto: 'RECHAZADO_ERROR_CONEXION',
            tiempoEjecucionMs: Date.now() - startTime,
          }).execute();
        } catch (logErr) {
          console.warn('[Worker:RCV] Error al registrar log de fallo de gateway:', logErr);
        }

        throw gatewayErr;
      }
    }

    if (job.updateProgress) {
      await job.updateProgress(65).catch(() => {});
    }
  } else {
    throw new Error(`MODO_INVALIDO: Origen de datos '${source}' no es soportado. Use 'FILE_UPLOAD' o 'DIRECT_API'.`);
  }

  // ==========================================================================
  // INGESTA ATÓMICA Y CÁLCULO DE TOTALES EN SQL
  // ==========================================================================
  if (job.updateProgress) {
    await job.updateProgress(80).catch(() => {});
  }

  const ingestionResult = await RcvIngestionService.ingestDteBatch(empresaId, parsedDtes, traceId);

  if (job.updateProgress) {
    await job.updateProgress(100).catch(() => {});
  }

  const tiempoEjecucionMs = Date.now() - startTime;

  return {
    success: true,
    traceId,
    payloadGenerado: {
      empresaId,
      periodo,
      modo,
      source,
      documentosInsertadosOActualizados: ingestionResult.insertedCount,
      totalNeto: ingestionResult.totalNeto,
      totalIvaRecuperable: ingestionResult.totalIvaRecuperable,
      totalMonto: ingestionResult.totalMonto,
      auditLogId: ingestionResult.auditLogId,
      fechaProcesamiento: new Date().toISOString(),
    },
    tiempoEjecucionMs,
  };
}

/**
 * Worker BullMQ para sincronización e ingesta asíncrona de DTEs y RCV
 */
export function createRcvSyncWorker(): Worker<RcvSyncJobData, AgentJobResult> {
  const worker = new Worker<RcvSyncJobData, AgentJobResult>(
    QUEUE_NAMES.RCV_SYNC,
    async (job: Job<RcvSyncJobData, AgentJobResult>): Promise<AgentJobResult> => {
      return processRcvSyncJob(job);
    },
    {
      connection: getRedisConnectionOptions(),
      concurrency: 3,
    }
  );

  worker.on('completed', (job, result) => {
    console.log(`[Worker:RCV:Completed] RCV procesado con éxito para Job #${job.id}`, {
      traceId: result.traceId,
      tiempoEjecucionMs: result.tiempoEjecucionMs,
    });
  });

  worker.on('failed', (job, err) => {
    console.error(`[Worker:RCV:Failed] Error procesando RCV en Job #${job?.id}:`, err.message);
  });

  worker.on('error', (err: Error) => {
    console.warn(`[Worker:RCV:Error] Advertencia de conexión Worker RCV: ${err.message}`);
  });

  return worker;
}

let rcvWorkerInstance: Worker<RcvSyncJobData, AgentJobResult> | null = null;
export function getRcvSyncWorker(): Worker<RcvSyncJobData, AgentJobResult> {
  if (!rcvWorkerInstance) {
    rcvWorkerInstance = createRcvSyncWorker();
  }
  return rcvWorkerInstance;
}
