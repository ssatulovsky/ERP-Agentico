import { Worker, type Job } from 'bullmq';
import { getRedisConnectionOptions } from '../queues/redisConfig';
import {
  QUEUE_NAMES,
  type RcvSyncJobData,
  type AgentJobResult,
} from '../queues/types';
import { db } from '../db';
import { agentAuditLogs } from '../db/schema';

/**
 * Función central de procesamiento de sincronización RCV.
 */
export async function processRcvSyncJob(job: {
  id?: string;
  attemptsMade: number;
  data: RcvSyncJobData;
}): Promise<AgentJobResult> {
  const startTime = Date.now();
  const { traceId, empresaId, rutEmpresa, periodo, modo } = job.data;

  console.log(`[Worker:RCV] Sincronizando documentos del SII para ${rutEmpresa} (${periodo} - ${modo})`, {
    jobId: job.id,
    traceId,
    intento: job.attemptsMade + 1,
  });

  // Registrar inicio de la sincronización en auditoría
  try {
    await db.insert(agentAuditLogs).values({
      traceId,
      empresaId,
      agenteNombre: 'AGENTE_WORKER_RCV_SII',
      accion: 'SCRAPING_RCV_ASINCRONO',
      estadoTransicion: 'EJECUTANDO',
      modelName: 'playwright-sii-bot',
      payloadInput: job.data,
      payloadOutput: { estado: 'CONECTANDO_PORTAL_SII' },
      tiempoEjecucionMs: 0,
    });
  } catch (err) {
    console.warn('[Worker:RCV] Advertencia al registrar log de inicio:', err);
  }

  // Simulación de interacción con SII / APIs de DTEs
  const documentosDescargados = modo === 'COMPRAS' ? 42 : modo === 'VENTAS' ? 128 : 170;
  const totalNeto = modo === 'COMPRAS' ? 18450000 : modo === 'VENTAS' ? 45200000 : 63650000;
  const totalIva = Math.round(totalNeto * 0.19);

  const tiempoEjecucionMs = Date.now() - startTime;

  // Registrar finalización
  try {
    await db.insert(agentAuditLogs).values({
      traceId,
      empresaId,
      agenteNombre: 'AGENTE_WORKER_RCV_SII',
      accion: 'FINALIZACION_RCV_SINCRONIZADO',
      estadoTransicion: 'APROBADO',
      modelName: 'playwright-sii-bot',
      payloadInput: job.data,
      payloadOutput: {
        documentosDescargados,
        totalNeto,
        totalIva,
        modo,
      },
      tiempoEjecucionMs,
    });
  } catch (err) {
    console.warn('[Worker:RCV] Advertencia al registrar log de cierre:', err);
  }

  return {
    success: true,
    traceId,
    payloadGenerado: {
      empresaId,
      periodo,
      modo,
      documentosDescargados,
      totalNeto,
      totalIva,
      fechaSincronizacion: new Date().toISOString(),
    },
    tiempoEjecucionMs,
  };
}

/**
 * Worker para sincronización asíncrona de DTEs y RCV (Compras y Ventas) desde el SII
 * sin bloquear el bucle principal de Express.
 */
export function createRcvSyncWorker(): Worker<RcvSyncJobData, AgentJobResult> {
  const worker = new Worker<RcvSyncJobData, AgentJobResult>(
    QUEUE_NAMES.RCV_SYNC,
    async (job: Job<RcvSyncJobData, AgentJobResult>): Promise<AgentJobResult> => {
      return processRcvSyncJob(job);
    },
    {
      connection: getRedisConnectionOptions(),
      concurrency: 3, // Controla límites de scraping para evitar bloqueos del SII
    }
  );

  worker.on('completed', (job, result) => {
    console.log(`[Worker:RCV:Completed] RCV sincronizado para Job #${job.id}`, {
      traceId: result.traceId,
      tiempoEjecucionMs: result.tiempoEjecucionMs,
    });
  });

  worker.on('failed', (job, err) => {
    console.error(`[Worker:RCV:Failed] Error sincronizando RCV en Job #${job?.id}:`, err.message);
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
