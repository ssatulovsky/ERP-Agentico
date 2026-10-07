import { Router, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import {
  rcvQueue,
  f29Queue,
  payrollQueue,
  scheduleRcvSync,
  scheduleF29Settlement,
  schedulePayrollBatch,
  generateF29JobId,
  generateRcvJobId,
  generatePayrollJobId,
  type IAgentQueue,
} from '../queues/agentQueues';
import { checkRedisHealth } from '../queues/redisConfig';
import { QUEUE_NAMES, type QueueName } from '../queues/types';
import {
  enqueueF29Schema,
  enqueueRcvSchema,
  enqueuePayrollSchema,
  jobParamsSchema,
  jobQuerySchema,
  mapBullMQStateToApiStatus,
  sanitizeErrorMessage,
  type EnqueueF29Input,
  type EnqueueRcvInput,
  type EnqueuePayrollInput,
  type JobParamsInput,
  type JobQueryInput,
} from '../schemas/jobSchemas';
import { validateRequest } from '../middlewares/validateRequest';

export const asyncJobsRouter = Router();

/**
 * Helper para resolver la cola correspondiente según el identificador de dominio.
 */
function resolveQueueByName(queueName: QueueName): IAgentQueue | null {
  switch (queueName) {
    case QUEUE_NAMES.RCV_SYNC:
      return rcvQueue;
    case QUEUE_NAMES.F29_SETTLEMENT:
      return f29Queue;
    case QUEUE_NAMES.PAYROLL_PROCESSING:
      return payrollQueue;
    default:
      return null;
  }
}

// ============================================================================
// 1. HEALTH & METRICS ENDPOINT
// ============================================================================

/**
 * GET /api/jobs/health
 * Diagnóstico de conectividad con Redis, estado operativo de workers y métricas
 * de backlog en las colas.
 */
asyncJobsRouter.get('/health', async (req: Request, res: Response) => {
  const traceId = (res.locals.traceId as string) || (req.headers['x-trace-id'] as string) || `trace-${randomUUID().slice(0, 8)}`;
  res.setHeader('X-Trace-Id', traceId);

  try {
    const redisHealth = await checkRedisHealth();

    const emptyCounts = { active: 0, completed: 0, failed: 0, delayed: 0, waiting: 0 };
    const safeCounts = async (q: IAgentQueue) => {
      try {
        return await q.getJobCounts('active', 'completed', 'failed', 'delayed', 'waiting');
      } catch {
        return emptyCounts;
      }
    };

    const [rcvCounts, f29Counts, payrollCounts] = await Promise.all([
      safeCounts(rcvQueue),
      safeCounts(f29Queue),
      safeCounts(payrollQueue),
    ]);

    const queueMetrics = {
      [QUEUE_NAMES.RCV_SYNC]: {
        ...rcvCounts,
        status: rcvCounts.active > 0 ? 'PROCESSING' : 'IDLE',
      },
      [QUEUE_NAMES.F29_SETTLEMENT]: {
        ...f29Counts,
        status: f29Counts.active > 0 ? 'PROCESSING' : 'IDLE',
      },
      [QUEUE_NAMES.PAYROLL_PROCESSING]: {
        ...payrollCounts,
        status: payrollCounts.active > 0 ? 'PROCESSING' : 'IDLE',
      },
    };

    res.status(200).json({
      success: true,
      traceId,
      timestamp: new Date().toISOString(),
      redis: redisHealth,
      queues: queueMetrics,
    });
  } catch (error) {
    const message = sanitizeErrorMessage(error instanceof Error ? error.message : String(error));
    console.error(`[Jobs:Health:Error] [${traceId}]`, error);
    res.status(500).json({
      success: false,
      code: 'HEALTH_CHECK_FAILURE',
      traceId,
      error: message,
    });
  }
});

// ============================================================================
// 2. ENCOLAMIENTO ASÍNCRONO SEMÁNTICO (HTTP 202 ACCEPTED)
// ============================================================================

/**
 * POST /api/jobs/f29-settlement
 * Encola la liquidación mensual de F29 y la propuesta de asiento contable.
 * Aplica idempotencia para evitar cálculos duplicados en el mismo periodo.
 */
asyncJobsRouter.post(
  '/f29-settlement',
  validateRequest<EnqueueF29Input>({ body: enqueueF29Schema }),
  async (req: Request, res: Response): Promise<void> => {
    const traceId = res.locals.traceId as string;
    const { empresaId, periodo, aplicarPostergacionIva, forceRecompute } = req.body as EnqueueF29Input;

    try {
      const deduplicationKey = generateF29JobId({
        traceId,
        empresaId,
        periodo,
        aplicarPostergacionIva,
      });

      // Verificación de Idempotencia: ¿Ya existe este trabajo en curso o finalizado?
      const existingJob = await f29Queue.getJob(deduplicationKey);
      if (existingJob && !forceRecompute) {
        const rawState = await existingJob.getState();
        if (rawState !== 'failed') {
          const apiStatus = mapBullMQStateToApiStatus(rawState);
          const statusUrl = `/api/jobs/${QUEUE_NAMES.F29_SETTLEMENT}/${existingJob.id}`;

          console.log(`[API:F29:Idempotency] [${traceId}] Trabajo existente detectado: ${existingJob.id} (${apiStatus})`);

          res.setHeader('Location', statusUrl);
          res.status(202).json({
            success: true,
            status: 'ACCEPTED',
            code: 'JOB_ALREADY_EXISTS',
            traceId,
            message: 'Existe un cálculo de liquidación F29 registrado o en ejecución para este periodo.',
            data: {
              jobId: existingJob.id,
              queue: QUEUE_NAMES.F29_SETTLEMENT,
              status: apiStatus,
              statusUrl,
              empresaId,
              periodo,
              isExisting: true,
              createdAt: new Date(existingJob.timestamp).toISOString(),
            },
          });
          return;
        }
        console.log(`[API:F29:Idempotency] [${traceId}] Trabajo previo ${existingJob.id} falló. Permitiendo reintentar cálculo.`);
        try { await existingJob.remove(); } catch (_) {}
      }

      console.log(`[API:F29:Dispatch] [${traceId}] Encolando liquidación F29 para empresa ${empresaId} (${periodo})`);

      const job = await scheduleF29Settlement({
        traceId,
        empresaId,
        periodo,
        aplicarPostergacionIva,
      });

      const statusUrl = `/api/jobs/${QUEUE_NAMES.F29_SETTLEMENT}/${job.id}`;
      res.setHeader('Location', statusUrl);

      res.status(202).json({
        success: true,
        status: 'ACCEPTED',
        code: 'JOB_ENQUEUED',
        traceId,
        message: 'Liquidación tributaria F29 encolada para procesamiento en segundo plano.',
        data: {
          jobId: job.id,
          queue: QUEUE_NAMES.F29_SETTLEMENT,
          status: 'PENDING',
          statusUrl,
          empresaId,
          periodo,
          isExisting: false,
          estimatedWaitMs: 2500,
          createdAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      const message = sanitizeErrorMessage(error instanceof Error ? error.message : String(error));
      console.error(`[API:F29:Error] [${traceId}] Error al encolar F29:`, error);
      res.status(500).json({
        success: false,
        code: 'DISPATCH_ERROR',
        traceId,
        error: message,
      });
    }
  }
);

// Alias de retrocompatibilidad para /f29/settle
asyncJobsRouter.post(
  '/f29/settle',
  validateRequest<EnqueueF29Input>({ body: enqueueF29Schema }),
  async (req: Request, res: Response): Promise<void> => {
    // Redirige internamente al mismo manejador que /f29-settlement
    const traceId = res.locals.traceId as string;
    const { empresaId, periodo, aplicarPostergacionIva, forceRecompute } = req.body as EnqueueF29Input;

    try {
      const deduplicationKey = generateF29JobId({
        traceId,
        empresaId,
        periodo,
        aplicarPostergacionIva,
      });

      const existingJob = await f29Queue.getJob(deduplicationKey);
      if (existingJob && !forceRecompute) {
        const rawState = await existingJob.getState();
        if (rawState !== 'failed') {
          const apiStatus = mapBullMQStateToApiStatus(rawState);
          const statusUrl = `/api/jobs/${QUEUE_NAMES.F29_SETTLEMENT}/${existingJob.id}`;

          res.setHeader('Location', statusUrl);
          res.status(202).json({
            success: true,
            status: 'ACCEPTED',
            code: 'JOB_ALREADY_EXISTS',
            traceId,
            message: 'Existe un cálculo de liquidación F29 registrado o en ejecución para este periodo.',
            data: {
              jobId: existingJob.id,
              queue: QUEUE_NAMES.F29_SETTLEMENT,
              status: apiStatus,
              statusUrl,
              empresaId,
              periodo,
              isExisting: true,
              createdAt: new Date(existingJob.timestamp).toISOString(),
            },
          });
          return;
        }
        console.log(`[API:F29:Idempotency] [${traceId}] Reintentando trabajo previo fallido ${existingJob.id}`);
        try { await existingJob.remove(); } catch (_) {}
      }

      const job = await scheduleF29Settlement({
        traceId,
        empresaId,
        periodo,
        aplicarPostergacionIva,
      });

      const statusUrl = `/api/jobs/${QUEUE_NAMES.F29_SETTLEMENT}/${job.id}`;
      res.setHeader('Location', statusUrl);

      res.status(202).json({
        success: true,
        status: 'ACCEPTED',
        code: 'JOB_ENQUEUED',
        traceId,
        message: 'Liquidación tributaria F29 encolada para procesamiento en segundo plano.',
        data: {
          jobId: job.id,
          queue: QUEUE_NAMES.F29_SETTLEMENT,
          status: 'PENDING',
          statusUrl,
          empresaId,
          periodo,
          isExisting: false,
          estimatedWaitMs: 2500,
          createdAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      const message = sanitizeErrorMessage(error instanceof Error ? error.message : String(error));
      res.status(500).json({
        success: false,
        code: 'DISPATCH_ERROR',
        traceId,
        error: message,
      });
    }
  }
);

/**
 * POST /api/jobs/rcv-sync
 * Encola una sincronización asistida con el SII (Registro de Compras y Ventas).
 */
asyncJobsRouter.post(
  '/rcv-sync',
  validateRequest<EnqueueRcvInput>({ body: enqueueRcvSchema }),
  async (req: Request, res: Response): Promise<void> => {
    const traceId = res.locals.traceId as string;
    const { rutEmpresa, empresaId, periodo, modo, forceRecompute } = req.body as EnqueueRcvInput;

    try {
      const deduplicationKey = generateRcvJobId({
        traceId,
        empresaId: empresaId || rutEmpresa,
        rutEmpresa,
        periodo,
        modo,
      });

      const existingJob = await rcvQueue.getJob(deduplicationKey);
      if (existingJob && !forceRecompute) {
        const rawState = await existingJob.getState();
        const apiStatus = mapBullMQStateToApiStatus(rawState);
        const statusUrl = `/api/jobs/${QUEUE_NAMES.RCV_SYNC}/${existingJob.id}`;

        console.log(`[API:RCV:Idempotency] [${traceId}] Trabajo existente: ${existingJob.id} (${apiStatus})`);

        res.setHeader('Location', statusUrl);
        res.status(202).json({
          success: true,
          status: 'ACCEPTED',
          code: 'JOB_ALREADY_EXISTS',
          traceId,
          message: 'Existe una sincronización RCV en curso o previa para este periodo y modo.',
          data: {
            jobId: existingJob.id,
            queue: QUEUE_NAMES.RCV_SYNC,
            status: apiStatus,
            statusUrl,
            rutEmpresa,
            periodo,
            modo,
            isExisting: true,
            createdAt: new Date(existingJob.timestamp).toISOString(),
          },
        });
        return;
      }

      console.log(`[API:RCV:Dispatch] [${traceId}] Encolando sincronización RCV para ${rutEmpresa} (${periodo} - ${modo})`);

      const job = await scheduleRcvSync({
        traceId,
        empresaId: empresaId || rutEmpresa,
        rutEmpresa,
        periodo,
        modo,
      });

      const statusUrl = `/api/jobs/${QUEUE_NAMES.RCV_SYNC}/${job.id}`;
      res.setHeader('Location', statusUrl);

      res.status(202).json({
        success: true,
        status: 'ACCEPTED',
        code: 'JOB_ENQUEUED',
        traceId,
        message: 'Sincronización RCV encolada para procesamiento asíncrono.',
        data: {
          jobId: job.id,
          queue: QUEUE_NAMES.RCV_SYNC,
          status: 'PENDING',
          statusUrl,
          rutEmpresa,
          periodo,
          modo,
          isExisting: false,
          estimatedWaitMs: 3500,
          createdAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      const message = sanitizeErrorMessage(error instanceof Error ? error.message : String(error));
      console.error(`[API:RCV:Error] [${traceId}] Error al encolar RCV:`, error);
      res.status(500).json({
        success: false,
        code: 'DISPATCH_ERROR',
        traceId,
        error: message,
      });
    }
  }
);

/**
 * POST /api/jobs/payroll-batch
 * Encola un cálculo masivo de liquidaciones de sueldos y leyes sociales.
 */
asyncJobsRouter.post(
  '/payroll-batch',
  validateRequest<EnqueuePayrollInput>({ body: enqueuePayrollSchema }),
  async (req: Request, res: Response): Promise<void> => {
    const traceId = res.locals.traceId as string;
    const { empresaId, periodo, totalTrabajadores, forceRecompute } = req.body as EnqueuePayrollInput;

    try {
      const deduplicationKey = generatePayrollJobId({
        traceId,
        empresaId,
        periodo,
        totalTrabajadores,
      });

      const existingJob = await payrollQueue.getJob(deduplicationKey);
      if (existingJob && !forceRecompute) {
        const rawState = await existingJob.getState();
        const apiStatus = mapBullMQStateToApiStatus(rawState);
        const statusUrl = `/api/jobs/${QUEUE_NAMES.PAYROLL_PROCESSING}/${existingJob.id}`;

        console.log(`[API:Payroll:Idempotency] [${traceId}] Trabajo existente: ${existingJob.id} (${apiStatus})`);

        res.setHeader('Location', statusUrl);
        res.status(202).json({
          success: true,
          status: 'ACCEPTED',
          code: 'JOB_ALREADY_EXISTS',
          traceId,
          message: 'Existe un lote de nómina activo para esta empresa y periodo.',
          data: {
            jobId: existingJob.id,
            queue: QUEUE_NAMES.PAYROLL_PROCESSING,
            status: apiStatus,
            statusUrl,
            empresaId,
            periodo,
            totalTrabajadores,
            isExisting: true,
            createdAt: new Date(existingJob.timestamp).toISOString(),
          },
        });
        return;
      }

      console.log(`[API:Payroll:Dispatch] [${traceId}] Encolando nómina para ${totalTrabajadores} trabajadores (${periodo})`);

      const job = await schedulePayrollBatch({
        traceId,
        empresaId,
        periodo,
        totalTrabajadores,
      });

      const statusUrl = `/api/jobs/${QUEUE_NAMES.PAYROLL_PROCESSING}/${job.id}`;
      res.setHeader('Location', statusUrl);

      res.status(202).json({
        success: true,
        status: 'ACCEPTED',
        code: 'JOB_ENQUEUED',
        traceId,
        message: 'Lote de nómina encolado satisfactoriamente.',
        data: {
          jobId: job.id,
          queue: QUEUE_NAMES.PAYROLL_PROCESSING,
          status: 'PENDING',
          statusUrl,
          empresaId,
          periodo,
          totalTrabajadores,
          isExisting: false,
          estimatedWaitMs: 3000,
          createdAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      const message = sanitizeErrorMessage(error instanceof Error ? error.message : String(error));
      console.error(`[API:Payroll:Error] [${traceId}] Error al encolar nómina:`, error);
      res.status(500).json({
        success: false,
        code: 'DISPATCH_ERROR',
        traceId,
        error: message,
      });
    }
  }
);

// ============================================================================
// 3. CONSULTA ESTANDARIZADA DEL CICLO DE VIDA (JOB STATUS PATTERN)
// ============================================================================

/**
 * Función controladora unificada para la consulta del ciclo de vida de un trabajo.
 * Responde a `/api/jobs/:queueName/:jobId` y `/api/jobs/status/:queueName/:jobId`.
 */
async function handleGetJobStatus(req: Request, res: Response): Promise<void> {
  const traceId = (res.locals.traceId as string) || (req.headers['x-trace-id'] as string) || `trace-${randomUUID().slice(0, 8)}`;
  res.setHeader('X-Trace-Id', traceId);

  const { queueName, jobId } = req.params as JobParamsInput;
  const { includeResult } = (req.query as unknown as JobQueryInput) || { includeResult: true };

  const targetQueue = resolveQueueByName(queueName);
  if (!targetQueue) {
    res.status(404).json({
      success: false,
      code: 'QUEUE_NOT_FOUND',
      traceId,
      message: `La cola '${queueName}' no existe o no está registrada.`,
      availableQueues: Object.values(QUEUE_NAMES),
    });
    return;
  }

  try {
    const job = await targetQueue.getJob(jobId);

    // Caso Borde 1: Trabajo inexistente o expirado por TTL en Redis
    if (!job) {
      res.status(404).json({
        success: false,
        code: 'JOB_NOT_FOUND',
        traceId,
        message: `El trabajo con identificador '${jobId}' no fue encontrado en la cola '${queueName}'. Puede haber expirado o sido depurado.`,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const rawState = await job.getState();
    const status = mapBullMQStateToApiStatus(rawState);

    // Métricas temporales
    const queuedAt = new Date(job.timestamp).toISOString();
    const startedAt = job.processedOn ? new Date(job.processedOn).toISOString() : null;
    const finishedAt = job.finishedOn ? new Date(job.finishedOn).toISOString() : null;
    const durationMs =
      job.processedOn && job.finishedOn ? job.finishedOn - job.processedOn : null;

    // Sanitización estricta del stack trace si el trabajo falló
    const sanitizedError = status === 'FAILED' ? sanitizeErrorMessage(job.failedReason) : null;

    res.status(200).json({
      success: true,
      traceId,
      data: {
        jobId: job.id,
        queue: queueName,
        name: job.name,
        status,
        rawState,
        progress: typeof job.progress === 'number' ? job.progress : status === 'COMPLETED' ? 100 : 0,
        attemptsMade: job.attemptsMade,
        timestamps: {
          queuedAt,
          startedAt,
          finishedAt,
        },
        durationMs,
        result: includeResult ? job.returnvalue : undefined,
        error: sanitizedError,
      },
    });
  } catch (error) {
    const message = sanitizeErrorMessage(error instanceof Error ? error.message : String(error));
    console.error(`[API:JobStatus:Error] [${traceId}] Error consultando job ${jobId}:`, error);
    res.status(500).json({
      success: false,
      code: 'JOB_QUERY_FAILURE',
      traceId,
      error: message,
    });
  }
}

// Registro de endpoints con validación estricta Zod en Params y Query
asyncJobsRouter.get(
  '/:queueName/:jobId',
  validateRequest<any, JobParamsInput, JobQueryInput>({
    params: jobParamsSchema,
    query: jobQuerySchema,
  }),
  handleGetJobStatus
);

// Alias de retrocompatibilidad
asyncJobsRouter.get(
  '/status/:queueName/:jobId',
  validateRequest<any, JobParamsInput, JobQueryInput>({
    params: jobParamsSchema,
    query: jobQuerySchema,
  }),
  handleGetJobStatus
);

// ============================================================================
// 4. GESTIÓN Y CANCELACIÓN DE TRABAJOS (DELETE /api/jobs/:queueName/:jobId)
// ============================================================================

/**
 * DELETE /api/jobs/:queueName/:jobId
 * Permite cancelar un trabajo si se encuentra en cola ('PENDING') o eliminarlo.
 */
asyncJobsRouter.delete(
  '/:queueName/:jobId',
  validateRequest<any, JobParamsInput>({ params: jobParamsSchema }),
  async (req: Request, res: Response): Promise<void> => {
    const traceId = res.locals.traceId as string;
    const { queueName, jobId } = req.params as JobParamsInput;

    const targetQueue = resolveQueueByName(queueName);
    if (!targetQueue) {
      res.status(404).json({
        success: false,
        code: 'QUEUE_NOT_FOUND',
        traceId,
        message: `Cola '${queueName}' no encontrada.`,
      });
      return;
    }

    try {
      const job = await targetQueue.getJob(jobId);
      if (!job) {
        res.status(404).json({
          success: false,
          code: 'JOB_NOT_FOUND',
          traceId,
          message: `El trabajo '${jobId}' no existe en la cola '${queueName}'.`,
        });
        return;
      }

      const rawState = await job.getState();
      const apiStatus = mapBullMQStateToApiStatus(rawState);

      if (apiStatus === 'PROCESSING') {
        res.status(409).json({
          success: false,
          code: 'JOB_IN_PROGRESS',
          traceId,
          message: 'No es posible cancelar un trabajo que se encuentra actualmente en ejecución.',
        });
        return;
      }

      // Si tiene método remove (BullMQ Job)
      if (typeof (job as any).remove === 'function') {
        await (job as any).remove();
      }

      console.log(`[API:JobDelete] [${traceId}] Trabajo ${jobId} removido de ${queueName}.`);

      res.status(200).json({
        success: true,
        traceId,
        message: `Trabajo '${jobId}' removido exitosamente de la cola '${queueName}'.`,
        data: {
          jobId,
          queue: queueName,
          previousStatus: apiStatus,
        },
      });
    } catch (error) {
      const message = sanitizeErrorMessage(error instanceof Error ? error.message : String(error));
      console.error(`[API:JobDelete:Error] [${traceId}] Error al cancelar job:`, error);
      res.status(500).json({
        success: false,
        code: 'JOB_DELETION_FAILURE',
        traceId,
        error: message,
      });
    }
  }
);
