import { type Request, type Response } from 'express';
import { QueueEvents } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { getRedisConnectionOptions, isRedisConfigured } from '../queues/redisConfig';
import {
  rcvQueue,
  f29Queue,
  payrollQueue,
  type IAgentQueue,
} from '../queues/agentQueues';
import { QUEUE_NAMES, type QueueName } from '../queues/types';
import {
  jobParamsSchema,
  mapBullMQStateToApiStatus,
  sanitizeErrorMessage,
} from '../schemas/jobSchemas';

// ============================================================================
// GESTIÓN COMPARTIDA DE INSTANCIAS QueueEvents DE BULLMQ (SINGLETON POR COLA)
// ============================================================================

/**
 * Cache centralizado de instancias QueueEvents para prevenir fugas de memoria
 * y creación descontrolada de conexiones Redis para Pub/Sub.
 */
const queueEventsCache = new Map<string, QueueEvents>();

/**
 * Obtiene o inicializa perezosamente la instancia QueueEvents para la cola especificada.
 * Si Redis no está disponible o configurado en el entorno, retorna null.
 */
export function getOrCreateQueueEvents(queueName: string): QueueEvents | null {
  if (!isRedisConfigured()) {
    return null;
  }

  const existing = queueEventsCache.get(queueName);
  if (existing) {
    return existing;
  }

  try {
    const connectionOptions = getRedisConnectionOptions();
    const qe = new QueueEvents(queueName, {
      connection: connectionOptions,
    });

    qe.on('error', (err: Error) => {
      console.warn(`[BullMQ:QueueEvents:${queueName}] Advertencia de conexión Redis: ${err.message}`);
    });

    queueEventsCache.set(queueName, qe);
    return qe;
  } catch (err) {
    console.warn(`[BullMQ:QueueEvents:${queueName}] No se pudo inicializar QueueEvents:`, err);
    return null;
  }
}

/**
 * Resuelve la cola de dominio correspondiente según su identificador tipado.
 */
export function resolveQueueByName(queueName: string): IAgentQueue | null {
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
// FORMATEO ESTRICTO DE MENSAJES SEGÚN ESPECIFICACIÓN W3C SSE
// ============================================================================

export type SseEventType = 'connected' | 'progress' | 'completed' | 'failed' | 'ping' | 'error';

/**
 * Escribe un evento estructurado en el stream HTTP siguiendo la especificación W3C:
 *   event: <nombre_evento>\n
 *   data: <json_string>\n\n
 */
export function sendSseEvent(
  res: Response,
  event: SseEventType,
  payload: Record<string, any>
): boolean {
  if (res.writableEnded || res.closed) {
    return false;
  }

  const enrichedPayload = {
    event,
    ...payload,
  };

  const message = `event: ${event}\ndata: ${JSON.stringify(enrichedPayload)}\n\n`;
  res.write(message);
  return true;
}

// ============================================================================
// CONTROLADOR PRINCIPAL SSE: streamJobStatus
// ============================================================================

/**
 * GET /api/jobs/stream/:queueName/:jobId
 *
 * Endpoint de streaming reactivo unidireccional (Server-Sent Events) para
 * monitorear el ciclo de vida y avance de tareas en segundo plano.
 *
 * Arquitectura:
 * 1. Validación estricta Zod de parámetros y generación de Trace ID.
 * 2. Encabezados SSE con desactivación de buffering ('X-Accel-Buffering: no').
 * 3. Detección temprana: resolución inmediata de estados terminales ('completed', 'failed', 'not_found').
 * 4. Suscripción a BullMQ QueueEvents para eventos en tiempo real.
 * 5. Capa de resiliencia local para colas en memoria o entornos sin Redis.
 * 6. Heartbeat / ping periódico cada 20 segundos para evitar timeouts de proxies.
 * 7. Limpieza estricta de memoria al desconectar el socket ('req.on close').
 */
export async function streamJobStatus(req: Request, res: Response): Promise<void> {
  // a) Observabilidad: Obtener o generar Trace ID
  const incomingTraceId =
    (req.headers['x-trace-id'] as string) ||
    (req.query?.traceId as string);

  const traceId =
    incomingTraceId && incomingTraceId.trim() !== ''
      ? incomingTraceId.trim()
      : `trace-${randomUUID().slice(0, 8)}`;

  // b) Validación estricta con Zod de los parámetros de ruta
  const parsedParams = jobParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    const validationMessage =
      parsedParams.error.issues[0]?.message || 'Parámetros de ruta inválidos.';

    res.status(400).json({
      success: false,
      code: 'INVALID_JOB_PARAMS',
      traceId,
      error: validationMessage,
    });
    return;
  }

  const { queueName, jobId } = parsedParams.data;

  // c) Configuración obligatoria de cabeceras HTTP para SSE y desactivación de buffering
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('X-Trace-Id', traceId);
  res.flushHeaders?.();

  // Flag de control de ciclo de vida de la conexión del cliente
  let isClosed = false;
  let heartbeatTimer: NodeJS.Timeout | null = null;
  let fallbackPollingTimer: NodeJS.Timeout | null = null;

  // Resolver la cola de procesamiento
  const targetQueue = resolveQueueByName(queueName);
  if (!targetQueue) {
    sendSseEvent(res, 'error', {
      status: 'FAILED',
      jobId,
      traceId,
      message: `La cola '${queueName}' no existe o no está registrada en el sistema.`,
    });
    res.end();
    return;
  }

  // d) Cleanup Handler: Prevención de conexiones zombie y fugas de memoria
  const queueEvents = getOrCreateQueueEvents(queueName);

  // Funciones de escucha tipadas para BullMQ QueueEvents
  let onProgressEvent: ((args: { jobId: string; data: any }) => void) | null = null;
  let onCompletedEvent: ((args: { jobId: string; returnvalue: any }) => void) | null = null;
  let onFailedEvent: ((args: { jobId: string; failedReason: string }) => void) | null = null;

  const cleanup = () => {
    if (isClosed) return;
    isClosed = true;

    // Limpiar temporizadores
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    if (fallbackPollingTimer) {
      clearTimeout(fallbackPollingTimer);
      fallbackPollingTimer = null;
    }

    // Desuscribir listeners de BullMQ QueueEvents
    if (queueEvents) {
      if (onProgressEvent) queueEvents.off('progress', onProgressEvent);
      if (onCompletedEvent) queueEvents.off('completed', onCompletedEvent);
      if (onFailedEvent) queueEvents.off('failed', onFailedEvent);
    }
  };

  // Registrar detector de desconexión del cliente HTTP
  req.on('close', () => {
    cleanup();
  });
  res.on('finish', () => {
    cleanup();
  });

  try {
    // e) Detección Temprana y Casos Borde: Inspección del estado actual antes de escuchar eventos
    const initialJob = await targetQueue.getJob(jobId);

    if (!initialJob) {
      sendSseEvent(res, 'error', {
        status: 'FAILED',
        jobId,
        traceId,
        message: `El trabajo '${jobId}' no fue encontrado en la cola '${queueName}'.`,
      });
      cleanup();
      res.end();
      return;
    }

    const rawInitialState = await initialJob.getState();
    const initialApiStatus = mapBullMQStateToApiStatus(rawInitialState);

    // Caso Borde 1: El trabajo ya concluyó antes de abrir la conexión SSE
    if (initialApiStatus === 'COMPLETED') {
      sendSseEvent(res, 'completed', {
        status: 'COMPLETED',
        jobId,
        traceId,
        progress: { percentage: 100, currentStep: 'Finalizado' },
        result: initialJob.returnvalue,
      });
      cleanup();
      res.end();
      return;
    }

    // Caso Borde 2: El trabajo ya falló antes de abrir la conexión SSE
    if (initialApiStatus === 'FAILED') {
      sendSseEvent(res, 'failed', {
        status: 'FAILED',
        jobId,
        traceId,
        error: sanitizeErrorMessage(initialJob.failedReason || 'Falla no detallada en ejecución.'),
      });
      cleanup();
      res.end();
      return;
    }

    // Caso Normal: El trabajo está activo, en espera o demorado -> Emitir 'connected'
    let currentPercentage = 0;
    let currentStepText = initialApiStatus === 'PROCESSING' ? 'En ejecución' : 'En cola';

    if (typeof initialJob.progress === 'number') {
      currentPercentage = initialJob.progress;
    } else if (initialJob.progress && typeof initialJob.progress === 'object') {
      currentPercentage = (initialJob.progress as any).percentage ?? 0;
      currentStepText = (initialJob.progress as any).currentStep ?? currentStepText;
    }

    sendSseEvent(res, 'connected', {
      status: initialApiStatus,
      jobId,
      traceId,
      progress: {
        percentage: currentPercentage,
        currentStep: currentStepText,
      },
      connectedAt: new Date().toISOString(),
    });

    // f) Configuración del Heartbeat / Ping cada 20 segundos
    heartbeatTimer = setInterval(() => {
      if (isClosed) {
        clearInterval(heartbeatTimer!);
        return;
      }
      sendSseEvent(res, 'ping', {
        timestamp: new Date().toISOString(),
      });
    }, 20000);

    // g) Suscripción reactiva mediante BullMQ QueueEvents (cuando Redis está conectado)
    if (queueEvents) {
      onProgressEvent = ({ jobId: eventJobId, data }: { jobId: string; data: any }) => {
        if (isClosed || eventJobId !== jobId) return;

        let percentage = 0;
        let step = 'En ejecución';
        let metadata: any = undefined;

        if (typeof data === 'number') {
          percentage = data;
        } else if (data && typeof data === 'object') {
          percentage = data.percentage ?? percentage;
          step = data.currentStep ?? step;
          metadata = data.metadata;
        }

        sendSseEvent(res, 'progress', {
          status: 'PROCESSING',
          jobId,
          traceId,
          progress: {
            percentage,
            currentStep: step,
            metadata,
          },
        });
      };

      onCompletedEvent = ({ jobId: eventJobId, returnvalue }: { jobId: string; returnvalue: any }) => {
        if (isClosed || eventJobId !== jobId) return;

        sendSseEvent(res, 'completed', {
          status: 'COMPLETED',
          jobId,
          traceId,
          progress: { percentage: 100, currentStep: 'Finalizado' },
          result: returnvalue,
        });

        cleanup();
        res.end();
      };

      onFailedEvent = ({ jobId: eventJobId, failedReason }: { jobId: string; failedReason: string }) => {
        if (isClosed || eventJobId !== jobId) return;

        sendSseEvent(res, 'failed', {
          status: 'FAILED',
          jobId,
          traceId,
          error: sanitizeErrorMessage(failedReason || 'Falla no detallada en worker.'),
        });

        cleanup();
        res.end();
      };

      queueEvents.on('progress', onProgressEvent);
      queueEvents.on('completed', onCompletedEvent);
      queueEvents.on('failed', onFailedEvent);
    }

    // h) Capa de Resiliencia / Fallback Poller en memoria:
    // Permite soportar colas en memoria cuando Redis no está presente o en caso de desincronización
    let lastPercentage = currentPercentage;
    const checkJobStateFallback = async () => {
      if (isClosed) return;

      try {
        const currentJob = await targetQueue.getJob(jobId);
        if (!currentJob) {
          sendSseEvent(res, 'error', {
            status: 'FAILED',
            jobId,
            traceId,
            message: `El trabajo '${jobId}' no fue encontrado durante el seguimiento.`,
          });
          cleanup();
          res.end();
          return;
        }

        const state = await currentJob.getState();
        const apiStatus = mapBullMQStateToApiStatus(state);

        // Si completó
        if (apiStatus === 'COMPLETED') {
          sendSseEvent(res, 'completed', {
            status: 'COMPLETED',
            jobId,
            traceId,
            progress: { percentage: 100, currentStep: 'Finalizado' },
            result: currentJob.returnvalue,
          });
          cleanup();
          res.end();
          return;
        }

        // Si falló
        if (apiStatus === 'FAILED') {
          sendSseEvent(res, 'failed', {
            status: 'FAILED',
            jobId,
            traceId,
            error: sanitizeErrorMessage(currentJob.failedReason || 'Falla en tarea en segundo plano.'),
          });
          cleanup();
          res.end();
          return;
        }

        // Progreso incremental
        let pVal = 0;
        let sVal = apiStatus === 'PROCESSING' ? 'En ejecución' : 'En cola';
        if (typeof currentJob.progress === 'number') {
          pVal = currentJob.progress;
        } else if (currentJob.progress && typeof currentJob.progress === 'object') {
          pVal = (currentJob.progress as any).percentage ?? 0;
          sVal = (currentJob.progress as any).currentStep ?? sVal;
        }

        if (pVal !== lastPercentage) {
          lastPercentage = pVal;
          sendSseEvent(res, 'progress', {
            status: apiStatus,
            jobId,
            traceId,
            progress: {
              percentage: pVal,
              currentStep: sVal,
            },
          });
        }

        // Programar siguiente comprobación periódica si el socket sigue activo
        if (!isClosed) {
          fallbackPollingTimer = setTimeout(checkJobStateFallback, 1000);
        }
      } catch (checkErr) {
        if (!isClosed) {
          fallbackPollingTimer = setTimeout(checkJobStateFallback, 2000);
        }
      }
    };

    // Iniciar el verificador de respaldo
    fallbackPollingTimer = setTimeout(checkJobStateFallback, 800);

  } catch (error: any) {
    const errorMsg = sanitizeErrorMessage(error?.message || String(error));
    sendSseEvent(res, 'error', {
      status: 'FAILED',
      jobId,
      traceId,
      error: errorMsg,
    });
    cleanup();
    res.end();
  }
}
