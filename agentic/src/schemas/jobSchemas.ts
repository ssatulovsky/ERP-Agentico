import { z } from 'zod';
import { QUEUE_NAMES, type QueueName } from '../queues/types';

/**
 * Expresión regular para validar el formato de periodo contable y tributario chileno (YYYY-MM).
 */
export const PERIODO_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Expresión regular para validar RUT chileno con o sin puntos y con guión.
 */
export const RUT_REGEX = /^(\d{1,2}(?:\.\d{3}){2}-[\dkK]|\d{7,8}-[\dkK])$/;

/**
 * Validador estricto de dígito verificador de RUT chileno (módulo 11).
 */
export function validateChileanRut(rutCompleto: string): boolean {
  if (!RUT_REGEX.test(rutCompleto)) return false;
  const limpio = rutCompleto.replace(/\./g, '').toUpperCase();
  const [cuerpo, dv] = limpio.split('-');
  if (!cuerpo || !dv) return false;

  let suma = 0;
  let multiplo = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * multiplo;
    multiplo = multiplo < 7 ? multiplo + 1 : 2;
  }

  const dvEsperado = 11 - (suma % 11);
  const dvCalculado =
    dvEsperado === 11 ? '0' : dvEsperado === 10 ? 'K' : String(dvEsperado);

  return dv === dvCalculado;
}

/**
 * Estados estandarizados de la API para los trabajos encolados.
 */
export type ApiJobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

/**
 * Mapea los estados nativos de BullMQ (waiting, active, completed, failed, delayed, paused)
 * al contrato estándar de la API REST.
 */
export function mapBullMQStateToApiStatus(
  state: string | null | undefined
): ApiJobStatus {
  switch (state) {
    case 'active':
      return 'PROCESSING';
    case 'completed':
      return 'COMPLETED';
    case 'failed':
      return 'FAILED';
    case 'waiting':
    case 'delayed':
    case 'paused':
    case 'prioritized':
    case 'waiting-children':
    default:
      return 'PENDING';
  }
}

/**
 * Sanitiza mensajes de error y razones de fallo eliminando stack traces internos,
 * rutas de servidor local o detalles sensibles del backend.
 */
export function sanitizeErrorMessage(rawMessage?: string | null): string | null {
  if (!rawMessage) return null;

  // Remueve líneas con rutas de archivos (/root/..., C:\..., at Function...)
  const lines = rawMessage.split('\n');
  const cleanFirstLine = lines[0]?.replace(/(?:at\s.*|\/[\w.-]+)+/g, '').trim();

  // Elimina posibles cadenas con credenciales o passwords
  return cleanFirstLine?.replace(/password=([^&\s]+)/gi, 'password=***') || 'Error interno durante el procesamiento del trabajo.';
}

// ============================================================================
// ESQUEMAS ZOD PARA VALIDACIÓN DE ENTRADAS
// ============================================================================

/**
 * Validación de parámetros de ruta para consulta de jobs.
 */
export const jobParamsSchema = z.object({
  queueName: z.enum(
    [
      QUEUE_NAMES.RCV_SYNC,
      QUEUE_NAMES.F29_SETTLEMENT,
      QUEUE_NAMES.PAYROLL_PROCESSING,
    ],
    {
      message: `El parámetro 'queueName' debe ser una de las colas válidas: ${Object.values(
        QUEUE_NAMES
      ).join(', ')}`,
    }
  ),
  jobId: z
    .string()
    .trim()
    .min(3, { message: "El parámetro 'jobId' debe tener al menos 3 caracteres." })
    .max(128, { message: "El parámetro 'jobId' no puede exceder 128 caracteres." }),
});

export type JobParamsInput = z.infer<typeof jobParamsSchema>;

/**
 * Validación de consulta query para estado de jobs.
 */
export const jobQuerySchema = z.object({
  includeResult: z
    .enum(['true', 'false'])
    .optional()
    .transform((val) => val !== 'false'),
});

export type JobQueryInput = z.infer<typeof jobQuerySchema>;

/**
 * Esquema de validación para encolar Liquidación F29.
 */
export const enqueueF29Schema = z.object({
  empresaId: z
    .string()
    .trim()
    .min(3, { message: "El campo 'empresaId' es obligatorio." })
    .refine((val) => RUT_REGEX.test(val) || val.length >= 3, {
      message: "El campo 'empresaId' debe ser un RUT o identificador válido.",
    }),
  periodo: z
    .string()
    .trim()
    .regex(PERIODO_REGEX, {
      message: "El campo 'periodo' debe cumplir con el formato 'YYYY-MM' (ej: '2026-09').",
    }),
  aplicarPostergacionIva: z
    .boolean()
    .optional()
    .default(false),
  traceId: z
    .string()
    .trim()
    .optional(),
  forceRecompute: z
    .boolean()
    .optional()
    .default(false),
});

export type EnqueueF29Input = z.infer<typeof enqueueF29Schema>;

/**
 * Esquema de validación para encolar Sincronización RCV.
 */
export const enqueueRcvSchema = z.object({
  rutEmpresa: z
    .string()
    .trim()
    .regex(RUT_REGEX, {
      message: "El campo 'rutEmpresa' debe tener un formato de RUT válido (ej: '76.892.410-K' o '76892410-K').",
    }),
  empresaId: z
    .string()
    .trim()
    .optional(),
  periodo: z
    .string()
    .trim()
    .regex(PERIODO_REGEX, {
      message: "El campo 'periodo' debe cumplir con el formato 'YYYY-MM' (ej: '2026-09').",
    }),
  modo: z
    .enum(['COMPRAS', 'VENTAS', 'CONSOLIDADO'], {
      message: "El campo 'modo' debe ser 'COMPRAS', 'VENTAS' o 'CONSOLIDADO'.",
    })
    .default('CONSOLIDADO'),
  traceId: z
    .string()
    .trim()
    .optional(),
  forceRecompute: z
    .boolean()
    .optional()
    .default(false),
});

export type EnqueueRcvInput = z.infer<typeof enqueueRcvSchema>;

/**
 * Esquema de validación para encolar Liquidación de Nómina masiva.
 */
export const enqueuePayrollSchema = z.object({
  empresaId: z
    .string()
    .trim()
    .min(3, { message: "El campo 'empresaId' es obligatorio." }),
  periodo: z
    .string()
    .trim()
    .regex(PERIODO_REGEX, {
      message: "El campo 'periodo' debe cumplir con el formato 'YYYY-MM' (ej: '2026-09').",
    }),
  totalTrabajadores: z
    .number({ message: "El campo 'totalTrabajadores' debe ser un número entero." })
    .int({ message: "El total de trabajadores debe ser entero." })
    .min(1, { message: 'Debe procesar al menos 1 trabajador.' })
    .max(50000, { message: 'El límite máximo por lote es de 50.000 trabajadores.' })
    .default(10),
  traceId: z
    .string()
    .trim()
    .optional(),
  forceRecompute: z
    .boolean()
    .optional()
    .default(false),
});

export type EnqueuePayrollInput = z.infer<typeof enqueuePayrollSchema>;
