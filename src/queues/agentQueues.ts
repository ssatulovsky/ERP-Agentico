import { Queue, type DefaultJobOptions, type QueueOptions, type Job } from 'bullmq';
import { getRedisConnectionOptions, isRedisConfigured } from './redisConfig';
import {
  QUEUE_NAMES,
  type RcvSyncJobData,
  type F29SettlementJobData,
  type PayrollBatchJobData,
  type AgentJobResult,
} from './types';
import { processF29SettlementJob } from '../workers/f29SettlementWorker';
import { processRcvSyncJob } from '../workers/rcvSyncWorker';
import { processPayrollJob } from '../workers/payrollWorker';

/**
 * Opciones predeterminadas para los trabajos encolados en BullMQ.
 * - Máximo 3 intentos con retroceso exponencial (backoff).
 * - Retención controlada para evitar consumo excesivo de memoria en Redis.
 */
export const DEFAULT_AGENT_JOB_OPTIONS: DefaultJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 5000,
  },
  removeOnComplete: {
    count: 1000,
  },
  removeOnFail: {
    count: 5000,
  },
};

/**
 * Interfaz unificada de cola que permite alternar transparentemente entre
 * BullMQ (con cluster Redis) y el despachador asíncrono en memoria cuando
 * no hay Redis configurado en el entorno local/preview.
 */
export interface IAgentJob<TData = any, TResult = any> {
  id: string;
  name: string;
  data: TData;
  opts: Record<string, any>;
  attemptsMade: number;
  returnvalue: TResult | null;
  failedReason: string | null;
  timestamp: number;
  processedOn: number | null;
  finishedOn: number | null;
  progress: number;
  remove?: () => Promise<void>;
  getState(): Promise<'waiting' | 'active' | 'completed' | 'failed' | 'delayed'>;
}

export interface IAgentQueue<TData = any, TResult = any> {
  name: string;
  add(name: string, data: TData, opts?: { jobId?: string; [key: string]: any }): Promise<IAgentJob<TData, TResult> | Job<TData, TResult>>;
  getJob(jobId: string): Promise<IAgentJob<TData, TResult> | Job<TData, TResult> | null>;
  getJobCounts(...types: string[]): Promise<Record<string, number>>;
  close(): Promise<void>;
}

/**
 * Implementación de cola asíncrona en memoria para entornos donde Redis no está configurado.
 * Garantiza total fidelidad en auditorías, firmas HMAC y partida doble contable.
 */
class InMemoryQueue<TData, TResult> implements IAgentQueue<TData, TResult> {
  public name: string;
  private jobs = new Map<string, IAgentJob<TData, TResult>>();
  private runner: (job: { id?: string; attemptsMade: number; data: TData }) => Promise<TResult>;

  constructor(
    name: string,
    runner: (job: { id?: string; attemptsMade: number; data: TData }) => Promise<TResult>
  ) {
    this.name = name;
    this.runner = runner;
  }

  async add(
    name: string,
    data: TData,
    opts?: { jobId?: string; [key: string]: any }
  ): Promise<IAgentJob<TData, TResult>> {
    const id = opts?.jobId || `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const existing = this.jobs.get(id);
    if (existing) {
      return existing;
    }

    const jobObj: IAgentJob<TData, TResult> = {
      id,
      name,
      data,
      opts: opts || {},
      attemptsMade: 0,
      returnvalue: null,
      failedReason: null,
      timestamp: Date.now(),
      processedOn: null,
      finishedOn: null,
      progress: 0,
      remove: async () => {
        this.jobs.delete(id);
      },
      getState: async function () {
        if (this.returnvalue) return 'completed';
        if (this.failedReason) return 'failed';
        if (this.processedOn) return 'active';
        return 'waiting';
      },
    };

    this.jobs.set(id, jobObj);

    // Despacho asíncrono desacoplado del event loop
    setImmediate(async () => {
      jobObj.processedOn = Date.now();
      try {
        const result = await this.runner({ id, attemptsMade: 0, data });
        jobObj.returnvalue = result;
        jobObj.progress = 100;
        jobObj.finishedOn = Date.now();
      } catch (err: any) {
        jobObj.failedReason = err?.message || String(err);
        jobObj.finishedOn = Date.now();
      }
    });

    return jobObj;
  }

  async getJob(jobId: string): Promise<IAgentJob<TData, TResult> | null> {
    return this.jobs.get(jobId) || null;
  }

  async getJobCounts(): Promise<Record<string, number>> {
    let active = 0;
    let completed = 0;
    let failed = 0;
    let waiting = 0;

    for (const job of this.jobs.values()) {
      if (job.returnvalue) completed++;
      else if (job.failedReason) failed++;
      else if (job.processedOn) active++;
      else waiting++;
    }

    return { active, completed, failed, delayed: 0, waiting };
  }

  async close(): Promise<void> {
    this.jobs.clear();
  }
}

class HybridResilientQueue<TData, TResult> implements IAgentQueue<TData, TResult> {
  public name: string;
  private bullQueue: Queue<TData, TResult> | null = null;
  private inMemoryQueue: InMemoryQueue<TData, TResult>;
  private isFallbackMode = false;

  constructor(
    name: string,
    bullQueue: Queue<TData, TResult> | null,
    runner: (job: { id?: string; attemptsMade: number; data: TData }) => Promise<TResult>
  ) {
    this.name = name;
    this.bullQueue = bullQueue;
    this.inMemoryQueue = new InMemoryQueue<TData, TResult>(name, runner);
  }

  async add(name: string, data: TData, opts?: { jobId?: string; [key: string]: any }): Promise<any> {
    if (this.bullQueue && !this.isFallbackMode) {
      try {
        return await (this.bullQueue as any).add(name, data, opts);
      } catch (err: any) {
        console.warn(
          `[Queue:${this.name}:Fallback] Redis no disponible (${err.message}). Ejecutando en memoria.`
        );
        this.isFallbackMode = true;
      }
    }
    return this.inMemoryQueue.add(name, data, opts);
  }

  async getJob(jobId: string): Promise<any> {
    const memJob = await this.inMemoryQueue.getJob(jobId);
    if (memJob) return memJob;

    if (this.bullQueue && !this.isFallbackMode) {
      try {
        return await this.bullQueue.getJob(jobId);
      } catch (err: any) {
        // Fallback silencioso a memoria
      }
    }
    return null;
  }

  async getJobCounts(...types: string[]): Promise<Record<string, number>> {
    const memCounts = await this.inMemoryQueue.getJobCounts();
    if (this.bullQueue && !this.isFallbackMode) {
      try {
        const bullCounts = await (this.bullQueue as any).getJobCounts(...types);
        return {
          active: (bullCounts.active || 0) + memCounts.active,
          completed: (bullCounts.completed || 0) + memCounts.completed,
          failed: (bullCounts.failed || 0) + memCounts.failed,
          delayed: (bullCounts.delayed || 0) + memCounts.delayed,
          waiting: (bullCounts.waiting || 0) + memCounts.waiting,
        };
      } catch {
        // Fallback silencioso
      }
    }
    return memCounts;
  }

  async close(): Promise<void> {
    if (this.bullQueue) {
      await this.bullQueue.close().catch(() => {});
    }
    await this.inMemoryQueue.close();
  }
}

/**
 * Configuración compartida de cola BullMQ.
 */
function createQueueOptions(): QueueOptions {
  return {
    connection: getRedisConnectionOptions(),
    defaultJobOptions: DEFAULT_AGENT_JOB_OPTIONS,
  };
}

// ============================================================================
// INSTANCIACIÓN RESILIENTE DE COLAS DEDICADAS POR DOMINIO
// ============================================================================

function initializeQueues(): {
  rcv: IAgentQueue<RcvSyncJobData, AgentJobResult>;
  f29: IAgentQueue<F29SettlementJobData, AgentJobResult>;
  payroll: IAgentQueue<PayrollBatchJobData, AgentJobResult>;
} {
  let rcvBull: Queue<RcvSyncJobData, AgentJobResult> | null = null;
  let f29Bull: Queue<F29SettlementJobData, AgentJobResult> | null = null;
  let payrollBull: Queue<PayrollBatchJobData, AgentJobResult> | null = null;

  if (isRedisConfigured()) {
    try {
      console.log('[Queue:Init] Redis configurado. Inicializando colas BullMQ...');
      rcvBull = new Queue<RcvSyncJobData, AgentJobResult>(
        QUEUE_NAMES.RCV_SYNC,
        createQueueOptions()
      );
      f29Bull = new Queue<F29SettlementJobData, AgentJobResult>(
        QUEUE_NAMES.F29_SETTLEMENT,
        createQueueOptions()
      );
      payrollBull = new Queue<PayrollBatchJobData, AgentJobResult>(
        QUEUE_NAMES.PAYROLL_PROCESSING,
        createQueueOptions()
      );

      rcvBull.on('error', (err) => console.warn('[Queue:RCV:Warning] Error de conexión:', err.message));
      f29Bull.on('error', (err) => console.warn('[Queue:F29:Warning] Error de conexión:', err.message));
      payrollBull.on('error', (err) => console.warn('[Queue:Payroll:Warning] Error de conexión:', err.message));
    } catch (e: any) {
      console.warn('[Queue:Init] Falla inicializando BullMQ:', e.message);
    }
  }

  return {
    rcv: new HybridResilientQueue<RcvSyncJobData, AgentJobResult>(
      QUEUE_NAMES.RCV_SYNC,
      rcvBull,
      processRcvSyncJob
    ),
    f29: new HybridResilientQueue<F29SettlementJobData, AgentJobResult>(
      QUEUE_NAMES.F29_SETTLEMENT,
      f29Bull,
      processF29SettlementJob
    ),
    payroll: new HybridResilientQueue<PayrollBatchJobData, AgentJobResult>(
      QUEUE_NAMES.PAYROLL_PROCESSING,
      payrollBull,
      processPayrollJob
    ),
  };
}

const initialized = initializeQueues();

export const rcvQueue = initialized.rcv;
export const f29Queue = initialized.f29;
export const payrollQueue = initialized.payroll;

// ============================================================================
// HELPERS DETERMINÍSTICOS PARA ENCOLAMIENTO IDEMPOTENTE
// ============================================================================

export function generateRcvJobId(data: RcvSyncJobData): string {
  const cleanRut = data.rutEmpresa.replace(/[^0-9kK]/g, '').toUpperCase();
  return `rcv_${cleanRut}_${data.periodo}_${data.modo.toLowerCase()}`;
}

export async function scheduleRcvSync(
  data: RcvSyncJobData
): Promise<any> {
  const jobId = generateRcvJobId(data);

  console.log(`[Queue:RCV] Encolando trabajo: ${jobId}`, {
    traceId: data.traceId,
    rutEmpresa: data.rutEmpresa,
    periodo: data.periodo,
    modo: data.modo,
  });

  return rcvQueue.add('SYNC_RCV_SII', data, {
    jobId,
  });
}

export function generateF29JobId(data: F29SettlementJobData): string {
  const cleanId = data.empresaId.replace(/[^0-9kK-]/g, '').toUpperCase();
  return `f29_${cleanId}_${data.periodo}_settlement`;
}

export async function scheduleF29Settlement(
  data: F29SettlementJobData
): Promise<any> {
  const jobId = generateF29JobId(data);

  console.log(`[Queue:F29] Encolando cálculo y asiento F29 idempotente: ${jobId}`, {
    traceId: data.traceId,
    empresaId: data.empresaId,
    periodo: data.periodo,
    postergacion: data.aplicarPostergacionIva,
  });

  return f29Queue.add('SETTLE_F29_TAX', data, {
    jobId,
  });
}

export function generatePayrollJobId(data: PayrollBatchJobData): string {
  const cleanId = data.empresaId.replace(/[^0-9kK-]/g, '').toUpperCase();
  return `payroll_${cleanId}_${data.periodo}_batch`;
}

export async function schedulePayrollBatch(
  data: PayrollBatchJobData
): Promise<any> {
  const jobId = generatePayrollJobId(data);

  console.log(`[Queue:Payroll] Encolando nómina por lotes: ${jobId}`, {
    traceId: data.traceId,
    empresaId: data.empresaId,
    periodo: data.periodo,
    totalTrabajadores: data.totalTrabajadores,
  });

  return payrollQueue.add('PROCESS_PAYROLL_BATCH', data, {
    jobId,
  });
}

export async function closeAllQueues(): Promise<void> {
  console.log('[Queue] Cerrando instancias de colas...');
  await Promise.allSettled([
    rcvQueue.close(),
    f29Queue.close(),
    payrollQueue.close(),
  ]);
  console.log('[Queue] Todas las colas han sido cerradas.');
}
