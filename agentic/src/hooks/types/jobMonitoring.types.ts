/**
 * Tipos y contratos fuertemente tipados para el monitoreo reactivo de
 * background jobs en arquitecturas frontend corporativas (SaaS / ERP).
 */

/**
 * Estados unívocos del ciclo de vida del trabajo asíncrono.
 */
export type JobStatus = 'idle' | 'enqueued' | 'processing' | 'completed' | 'failed' | 'timeout';

/**
 * Representación del progreso emitido por el worker durante la ejecución del job.
 */
export interface JobProgress<T = unknown> {
  percentage: number;
  currentStep?: string;
  metadata?: T;
}

/**
 * Contrato de respuesta estándar retornado por los endpoints de consulta de jobs
 * (tanto polling como streams SSE).
 */
export interface JobApiResponse<TResult = unknown, TProgress = unknown> {
  status: 'ACCEPTED' | 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  jobId: string;
  traceId: string;
  progress?: JobProgress<TProgress>;
  result?: TResult;
  error?: string;
  tiempoTranscurridoMs?: number;
}

/**
 * Opciones de configuración para el hook `useJobMonitor`.
 */
export interface UseJobMonitorOptions<TResult = unknown, TProgress = unknown> {
  /**
   * Modo de conexión preferente:
   * - 'auto': intenta SSE primero (`/api/jobs/stream/...`) y degrada a polling con backoff exponencial.
   * - 'sse': intenta estrictamente Server-Sent Events. Si falla, reporta error.
   * - 'polling': utiliza únicamente polling con retroceso exponencial y jitter.
   * @default 'auto'
   */
  mode?: 'auto' | 'sse' | 'polling';

  /**
   * Intervalo inicial de consulta para polling en milisegundos.
   * @default 1500
   */
  pollingIntervalMs?: number;

  /**
   * Límite superior máximo que puede alcanzar el intervalo de polling tras el backoff.
   * @default 15000
   */
  maxPollingIntervalMs?: number;

  /**
   * Tiempo máximo en milisegundos antes de declarar el trabajo en estado 'timeout'.
   * @default 180000 (3 minutos)
   */
  timeoutMs?: number;

  /**
   * Callback invocado inmediatamente al finalizar el trabajo con éxito.
   */
  onSuccess?: (data: TResult, traceId: string) => void;

  /**
   * Callback invocado si el worker reporta una falla o si la consulta agota reintentos.
   */
  onError?: (errorMessage: string, traceId?: string) => void;

  /**
   * Callback invocado cada vez que se detecta una actualización en el porcentaje o paso de progreso.
   */
  onProgress?: (progress: JobProgress<TProgress>) => void;
}

/**
 * Estado y controladores expuestos por el hook `useJobMonitor`.
 */
export interface UseJobMonitorReturn<TResult = unknown, TProgress = unknown> {
  /**
   * Estado actual unívoco del ciclo de vida del job.
   */
  status: JobStatus;

  /**
   * Indica si el trabajo está pendiente de tomar por un worker o activamente ejecutándose.
   */
  isLoading: boolean;

  /**
   * Indica si el trabajo concluyó exitosamente.
   */
  isCompleted: boolean;

  /**
   * Indica si el trabajo falló por error en el worker o rechazo.
   */
  isFailed: boolean;

  /**
   * Objeto de progreso tipado o null.
   */
  progress: JobProgress<TProgress> | null;

  /**
   * Resultado final generado por el background job una vez en 'completed'.
   */
  result: TResult | null;

  /**
   * Mensaje de error sanitizado si el estado es 'failed' o 'timeout'.
   */
  error: string | null;

  /**
   * Identificador de trazabilidad distribuida (X-Trace-Id) de la operación.
   */
  traceId: string | null;

  /**
   * Cancela activamente la suscripción o polling en el cliente y marca el estado como 'idle'.
   */
  cancelMonitoring: () => void;

  /**
   * Reinicia el ciclo de monitoreo para el `jobId` actual (reseteando temporizadores y backoff).
   */
  retry: () => void;
}
