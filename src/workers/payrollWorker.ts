import { Worker, type Job } from 'bullmq';
import { getRedisConnectionOptions } from '../queues/redisConfig';
import {
  QUEUE_NAMES,
  type PayrollBatchJobData,
  type AgentJobResult,
} from '../queues/types';
import { db } from '../db';
import { agentAuditLogs } from '../db/schema';
import { PayrollCalculationService } from '../services/payrollCalculationService';

/**
 * Función central de procesamiento de cálculo de nómina en lote.
 * Conectada al motor laboral pericial chileno con persistencia en MySQL y Libro Diario.
 */
export async function processPayrollJob(job: {
  id?: string;
  attemptsMade: number;
  data: PayrollBatchJobData;
}): Promise<AgentJobResult> {
  const startTime = Date.now();
  const { traceId, empresaId, periodo, totalTrabajadores } = job.data;

  console.log(`[Worker:Payroll] Procesando liquidaciones reales para empresa ${empresaId} (${periodo})`, {
    jobId: job.id,
    traceId,
  });

  // 1. Registrar inicio de la liquidación masiva en auditoría forense
  try {
    await db.insert(agentAuditLogs).values({
      traceId,
      empresaId,
      agenteNombre: 'AGENTE_WORKER_RRHH',
      accion: 'INICIO_CALCULO_NOMINA_BATCH',
      estadoTransicion: 'EJECUTANDO',
      modelName: 'labor-engine-cl',
      payloadInput: job.data,
      payloadOutput: { estado: 'CALCULANDO_HABERES_Y_DESCUENTOS_REALES' },
      tiempoEjecucionMs: 0,
    });
  } catch (err) {
    console.warn('[Worker:Payroll] Advertencia en log inicial:', err);
  }

  // 2. Ejecución del motor laboral chileno real (Contratos, AFPs, Fonasa/Isapre, AFC, Impuesto Único)
  const payrollSummary = await PayrollCalculationService.calculateRealPayroll(empresaId, periodo);

  const tiempoEjecucionMs = Date.now() - startTime;

  // 3. Registrar auditoría con resultados reales consolidados
  try {
    await db.insert(agentAuditLogs).values({
      traceId,
      empresaId,
      agenteNombre: 'AGENTE_WORKER_RRHH',
      accion: 'FINALIZACION_CALCULO_NOMINA_BATCH',
      estadoTransicion: 'APROBADO',
      modelName: 'labor-engine-cl',
      payloadInput: job.data,
      payloadOutput: {
        totalTrabajadores: payrollSummary.totalTrabajadores,
        totalHaberesImponibles: payrollSummary.totalHaberesImponibles,
        totalHaberesBrutos: payrollSummary.totalHaberesBrutos,
        totalSueldoLiquido: payrollSummary.totalSueldosLiquidos,
        totalImpuestoUnico: payrollSummary.totalImpuestoUnico,
        totalLeyesSociales:
          payrollSummary.totalAfp +
          payrollSummary.totalSalud +
          payrollSummary.totalAfcTrabajador +
          payrollSummary.totalAfcEmpleador +
          payrollSummary.totalSisEmpleador +
          payrollSummary.totalMutualEmpleador,
        costoTotalEmpresa: payrollSummary.costoTotalEmpresa,
        asientoCentralizacionId: payrollSummary.asientoCentralizacionId,
      },
      tiempoEjecucionMs,
    });
  } catch (err) {
    console.warn('[Worker:Payroll] Advertencia en log de cierre:', err);
  }

  return {
    success: true,
    traceId,
    payloadGenerado: {
      empresaId,
      periodo,
      totalTrabajadores: payrollSummary.totalTrabajadores,
      totalHaberesImponibles: payrollSummary.totalHaberesImponibles,
      totalHaberesBrutos: payrollSummary.totalHaberesBrutos,
      totalSueldoLiquido: payrollSummary.totalSueldosLiquidos,
      totalImpuestoUnico: payrollSummary.totalImpuestoUnico,
      costoTotalEmpresa: payrollSummary.costoTotalEmpresa,
      asientoCentralizacionId: payrollSummary.asientoCentralizacionId,
      fechaCalculo: new Date().toISOString(),
    },
    tiempoEjecucionMs,
  };
}

/**
 * Worker para el cálculo masivo de remuneraciones, imposiciones de AFP, Fonasa/Isapre,
 * AFC, Mutual de Seguridad y SIS conforme a la normativa laboral chilena.
 */
export function createPayrollWorker(): Worker<PayrollBatchJobData, AgentJobResult> {
  const worker = new Worker<PayrollBatchJobData, AgentJobResult>(
    QUEUE_NAMES.PAYROLL_PROCESSING,
    async (job: Job<PayrollBatchJobData, AgentJobResult>): Promise<AgentJobResult> => {
      return processPayrollJob(job);
    },
    {
      connection: getRedisConnectionOptions(),
      concurrency: 4,
    }
  );

  worker.on('completed', (job, result) => {
    console.log(`[Worker:Payroll:Completed] Nómina procesada exitosamente para Job #${job.id}`, {
      traceId: result.traceId,
      tiempoEjecucionMs: result.tiempoEjecucionMs,
    });
  });

  worker.on('failed', (job, err) => {
    console.error(`[Worker:Payroll:Failed] Error procesando nómina en Job #${job?.id}:`, err.message);
  });

  worker.on('error', (err: Error) => {
    console.warn(`[Worker:Payroll:Error] Advertencia de conexión Worker Nómina: ${err.message}`);
  });

  return worker;
}

let payrollWorkerInstance: Worker<PayrollBatchJobData, AgentJobResult> | null = null;
export function getPayrollWorker(): Worker<PayrollBatchJobData, AgentJobResult> {
  if (!payrollWorkerInstance) {
    payrollWorkerInstance = createPayrollWorker();
  }
  return payrollWorkerInstance;
}
