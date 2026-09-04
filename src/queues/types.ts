/**
 * Definición estricta de contratos de datos para colas asíncronas BullMQ
 * en el ERP Contable Agéntico chileno.
 */

// ============================================================================
// CONSTANTES DE COLAS POR DOMINIO OPERATIVO
// ============================================================================

export const QUEUE_NAMES = {
  RCV_SYNC: 'rcv-sync-queue',
  F29_SETTLEMENT: 'f29-settlement-queue',
  PAYROLL_PROCESSING: 'payroll-processing-queue',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

// ============================================================================
// PAYLOADS DE TRABAJO (JOB DATA INTERFACES)
// ============================================================================

/**
 * Payload para sincronización y scraping asistido de RCV (Registro de Compras y Ventas) desde el SII.
 */
export interface RcvSyncJobData {
  traceId: string;
  empresaId: string;
  rutEmpresa: string;
  periodo: string; // Formato 'YYYY-MM', ej: '2026-09'
  modo: 'COMPRAS' | 'VENTAS' | 'CONSOLIDADO';
}

/**
 * Payload para el cálculo de liquidación tributaria F29 mensual y determinación de IVA/PPM.
 */
export interface F29SettlementJobData {
  traceId: string;
  empresaId: string;
  periodo: string; // Formato 'YYYY-MM', ej: '2026-09'
  aplicarPostergacionIva: boolean;
}

/**
 * Payload para el procesamiento masivo de liquidaciones de sueldos y leyes sociales.
 */
export interface PayrollBatchJobData {
  traceId: string;
  empresaId: string;
  periodo: string; // Formato 'YYYY-MM', ej: '2026-09'
  totalTrabajadores: number;
}

// ============================================================================
// RESULTADO ESTANDARIZADO DE TRABAJO (JOB RESULT INTERFACES)
// ============================================================================

/**
 * Resultado genérico y fuertemente tipado de un trabajo procesado por un agente en segundo plano.
 */
export interface AgentJobResult {
  success: boolean;
  traceId: string;
  payloadGenerado: unknown;
  tiempoEjecucionMs: number;
  error?: string;
}

/**
 * Estructura tipada del resultado de la liquidación F29 generada por el Worker.
 */
export interface F29SettlementOutput {
  periodo: string;
  empresaId: string;
  debitoFiscal: number;
  creditoFiscal: number;
  remanenteMesAnterior: number;
  ivaDeterminado: number;
  postergado: boolean;
  montoPpm: number;
  tasaPpm: number;
  retencionHonorarios: number;
  totalImpuestoPagar: number;
  asientoContableId: string;
  auditLogId: string;
  supervisorSignature: string;
}
