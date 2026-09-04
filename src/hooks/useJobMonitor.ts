import { useState, useEffect, useRef, useCallback } from 'react';
import type {
  JobStatus,
  JobProgress,
  JobApiResponse,
  UseJobMonitorOptions,
  UseJobMonitorReturn,
} from './types/jobMonitoring.types';

/**
 * Hook personalizado para monitorear procesos asíncronos en segundo plano (BullMQ).
 * 
 * Implementa una arquitectura resiliente e híbrida:
 * 1. Intento primario mediante Server-Sent Events (SSE) en `/api/jobs/stream/:queueName/:jobId`.
 * 2. Fallback automático a Polling Inteligente con retroceso exponencial (exponential backoff)
 *    y factor de dispersión aleatorio (jitter) para mitigar el efecto "thundering herd".
 * 3. Prevención estricta de memory leaks: limpia timeouts, aborta solicitudes fetch en vuelo
 *    y cierra conexiones de EventSource al desmontar el componente o cambiar de job.
 * 4. Control de tiempo límite global (timeout) configurable.
 */
export function useJobMonitor<TResult = unknown, TProgress = unknown>(
  queueName: string | null,
  jobId: string | null,
  options?: UseJobMonitorOptions<TResult, TProgress>
): UseJobMonitorReturn<TResult, TProgress> {
  const {
    mode = 'auto',
    pollingIntervalMs = 1500,
    maxPollingIntervalMs = 15000,
    timeoutMs = 180000,
    onSuccess,
    onError,
    onProgress,
  } = options || {};

  // Estado reactivo principal
  const [status, setStatus] = useState<JobStatus>('idle');
  const [progress, setProgress] = useState<JobProgress<TProgress> | null>(null);
  const [result, setResult] = useState<TResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [traceId, setTraceId] = useState<string | null>(null);

  // Clave de reinicio forzado para la función `retry()`
  const [retryCount, setRetryCount] = useState<number>(0);

  // Refs de callbacks estables para evitar re-suscripciones innecesarias del effect principal
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  const onProgressRef = useRef(onProgress);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    onProgressRef.current = onProgress;
  }, [onProgress]);

  // Refs para control de recursos del ciclo de vida
  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const globalTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const isCancelledRef = useRef<boolean>(false);
  const currentIntervalRef = useRef<number>(pollingIntervalMs);

  // Función de limpieza de todos los recursos asíncronos en vuelo
  const cleanupResources = useCallback(() => {
    if (pollingTimerRef.current) {
      clearTimeout(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
    if (globalTimeoutRef.current) {
      clearTimeout(globalTimeoutRef.current);
      globalTimeoutRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  // Función de cancelación manual invocada por el consumidor
  const cancelMonitoring = useCallback(() => {
    isCancelledRef.current = true;
    cleanupResources();
    setStatus('idle');
  }, [cleanupResources]);

  // Función para reintentar el monitoreo
  const retry = useCallback(() => {
    cleanupResources();
    isCancelledRef.current = false;
    currentIntervalRef.current = pollingIntervalMs;
    setStatus('enqueued');
    setError(null);
    setResult(null);
    setProgress(null);
    setRetryCount((prev) => prev + 1);
  }, [cleanupResources, pollingIntervalMs]);

  // EFECTO PRINCIPAL DE MONITOREO
  useEffect(() => {
    // 1. Condición de guarda: parámetros nulos o vacíos
    if (!queueName || !jobId || queueName.trim() === '' || jobId.trim() === '') {
      cleanupResources();
      setStatus('idle');
      setProgress(null);
      setResult(null);
      setError(null);
      setTraceId(null);
      return;
    }

    isCancelledRef.current = false;
    currentIntervalRef.current = pollingIntervalMs;
    setStatus('enqueued');
    setProgress(null);
    setResult(null);
    setError(null);

    // Configurar Timeout Global
    globalTimeoutRef.current = setTimeout(() => {
      if (isCancelledRef.current) return;
      cleanupResources();
      setStatus('timeout');
      const timeoutMsg = `El monitoreo del trabajo '${jobId}' excedió el umbral máximo de ${timeoutMs / 1000}s.`;
      setError(timeoutMsg);
      onErrorRef.current?.(timeoutMsg, traceId || undefined);
    }, timeoutMs);

    // ========================================================================
    // MOTOR DE PROCESAMIENTO: FALLBACK A POLLING CON EXPONENTIAL BACKOFF & JITTER
    // ========================================================================
    const executePolling = async () => {
      if (isCancelledRef.current) return;

      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      try {
        const response = await fetch(`/api/jobs/${encodeURIComponent(queueName)}/${encodeURIComponent(jobId)}?includeResult=true`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
          signal,
        });

        if (isCancelledRef.current) return;

        if (!response.ok) {
          // Si es 404, el trabajo puede no haber sido persistido aún o haber expirado
          if (response.status === 404) {
            const errorJson = await response.json().catch(() => ({}));
            const notFoundMsg = errorJson.message || `Trabajo '${jobId}' no encontrado en la cola '${queueName}'.`;
            cleanupResources();
            setStatus('failed');
            setError(notFoundMsg);
            onErrorRef.current?.(notFoundMsg);
            return;
          }

          throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        const jobPayload: JobApiResponse<TResult, TProgress> | null = data.data || data;
        const currentTraceId = data.traceId || response.headers.get('X-Trace-Id') || '';

        if (currentTraceId) {
          setTraceId(currentTraceId);
        }

        if (!jobPayload) {
          throw new Error('Estructura de respuesta inválida desde la API de jobs.');
        }

        // Mapear estado
        const apiStatus = jobPayload.status;

        // Manejo de progreso
        let rawProgress: number = 0;
        let progressStep: string | undefined = undefined;
        let progressMeta: TProgress | undefined = undefined;

        if (typeof (jobPayload as any).progress === 'number') {
          rawProgress = (jobPayload as any).progress;
        } else if (jobPayload.progress) {
          rawProgress = jobPayload.progress.percentage ?? 0;
          progressStep = jobPayload.progress.currentStep;
          progressMeta = jobPayload.progress.metadata;
        }

        const newProgressObj: JobProgress<TProgress> = {
          percentage: rawProgress,
          currentStep: progressStep,
          metadata: progressMeta,
        };

        setProgress(newProgressObj);
        onProgressRef.current?.(newProgressObj);

        // EVALUACIÓN DE ESTADOS TERMINALES
        if (apiStatus === 'COMPLETED') {
          cleanupResources();
          setStatus('completed');
          setProgress({ percentage: 100, currentStep: 'Finalizado', metadata: progressMeta });

          const finalResult = (jobPayload.result ?? (jobPayload as any).returnvalue ?? null) as TResult;
          setResult(finalResult);
          onSuccessRef.current?.(finalResult, currentTraceId);
          return;
        }

        if (apiStatus === 'FAILED') {
          cleanupResources();
          setStatus('failed');
          const errorMsg = jobPayload.error || (jobPayload as any).failedReason || 'El proceso en segundo plano finalizó con error.';
          setError(errorMsg);
          onErrorRef.current?.(errorMsg, currentTraceId);
          return;
        }

        // Si está en PENDING o PROCESSING, actualizar estado visual
        if (apiStatus === 'PROCESSING') {
          setStatus('processing');
        } else {
          setStatus('enqueued');
        }

        // CALCULAR SIGUIENTE INTERVALO CON EXPONENTIAL BACKOFF Y JITTER
        // nextInterval = Math.min(current * 1.5, max) + Math.random() * 500
        const backoffInterval = Math.min(
          currentIntervalRef.current * 1.5,
          maxPollingIntervalMs
        );
        const jitter = Math.random() * 500;
        const nextInterval = Math.round(backoffInterval + jitter);
        currentIntervalRef.current = nextInterval;

        // Programar siguiente ciclo de consulta
        pollingTimerRef.current = setTimeout(executePolling, nextInterval);
      } catch (err: unknown) {
        if (isCancelledRef.current) return;

        // Ignorar abortos provocados por el cleanup
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }

        // Si ocurre un error de red transitorio, seguir intentando con retroceso
        const backoffInterval = Math.min(
          currentIntervalRef.current * 1.5,
          maxPollingIntervalMs
        );
        const jitter = Math.random() * 500;
        currentIntervalRef.current = Math.round(backoffInterval + jitter);
        pollingTimerRef.current = setTimeout(executePolling, currentIntervalRef.current);
      }
    };

    // ========================================================================
    // MOTOR PRIMARIO: SERVER-SENT EVENTS (SSE) CON DEGRADACIÓN A POLLING
    // ========================================================================
    const startSseConnection = () => {
      const sseUrl = `/api/jobs/stream/${encodeURIComponent(queueName)}/${encodeURIComponent(jobId)}`;

      try {
        const es = new EventSource(sseUrl);
        eventSourceRef.current = es;

        const handleIncomingSseEvent = (event: MessageEvent) => {
          if (isCancelledRef.current) return;

          try {
            const parsedData = JSON.parse(event.data);
            const jobData: JobApiResponse<TResult, TProgress> = parsedData.data || parsedData;
            const currentTraceId = parsedData.traceId || traceId || '';

            if (currentTraceId) setTraceId(currentTraceId);

            // Mapear progreso
            if (jobData.progress) {
              setProgress(jobData.progress);
              onProgressRef.current?.(jobData.progress);
            }

            if (jobData.status === 'PROCESSING') {
              setStatus('processing');
            } else if (jobData.status === 'PENDING' || jobData.status === 'ACCEPTED') {
              setStatus('enqueued');
            } else if (jobData.status === 'COMPLETED') {
              cleanupResources();
              setStatus('completed');
              setProgress({ percentage: 100, currentStep: 'Finalizado' });
              const res = (jobData.result ?? (jobData as any).returnvalue ?? null) as TResult;
              setResult(res);
              onSuccessRef.current?.(res, currentTraceId);
            } else if (jobData.status === 'FAILED') {
              cleanupResources();
              setStatus('failed');
              const errText = jobData.error || 'Falla reportada por el worker vía SSE.';
              setError(errText);
              onErrorRef.current?.(errText, currentTraceId);
            }
          } catch (parseError) {
            console.warn('[useJobMonitor:SSE] Error parseando evento SSE:', parseError);
          }
        };

        // Escucha tanto eventos estándar como eventos W3C tipados
        es.onmessage = handleIncomingSseEvent;
        es.addEventListener('connected', handleIncomingSseEvent as EventListener);
        es.addEventListener('progress', handleIncomingSseEvent as EventListener);
        es.addEventListener('completed', handleIncomingSseEvent as EventListener);
        es.addEventListener('failed', handleIncomingSseEvent as EventListener);
        es.addEventListener('error', ((errEvent: any) => {
          // Si el evento tiene datos SSE con error estructurado
          if (errEvent && errEvent.data) {
            handleIncomingSseEvent(errEvent);
          }
        }) as EventListener);

        es.onerror = () => {
          // Si falla la conexión SSE (por ejemplo, endpoint no disponible o corte de red):
          if (isCancelledRef.current) return;

          if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
          }

          if (mode === 'sse') {
            // Modo estricto SSE: notificar error directamente
            cleanupResources();
            setStatus('failed');
            const sseError = 'Conexión SSE fallida o no soportada por el servidor.';
            setError(sseError);
            onErrorRef.current?.(sseError);
          } else {
            // Modo 'auto': fallback transparente a polling con exponential backoff
            executePolling();
          }
        };
      } catch (sseInitError) {
        if (mode === 'sse') {
          cleanupResources();
          setStatus('failed');
          const initErr = 'No se pudo inicializar EventSource en el cliente.';
          setError(initErr);
          onErrorRef.current?.(initErr);
        } else {
          executePolling();
        }
      }
    };

    // DETERMINAR ESTRATEGIA INICIAL
    if (mode === 'polling') {
      executePolling();
    } else {
      // mode === 'auto' o mode === 'sse'
      startSseConnection();
    }

    // Cleanup estricto al desmontar componente o cambiar dependencias
    return () => {
      isCancelledRef.current = true;
      cleanupResources();
    };
  }, [
    queueName,
    jobId,
    mode,
    pollingIntervalMs,
    maxPollingIntervalMs,
    timeoutMs,
    retryCount,
    cleanupResources,
  ]);

  return {
    status,
    isLoading: status === 'enqueued' || status === 'processing',
    isCompleted: status === 'completed',
    isFailed: status === 'failed' || status === 'timeout',
    progress,
    result,
    error,
    traceId,
    cancelMonitoring,
    retry,
  };
}
