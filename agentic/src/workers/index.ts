import { type Worker } from 'bullmq';
import { getF29SettlementWorker } from './f29SettlementWorker';
import { getRcvSyncWorker } from './rcvSyncWorker';
import { getPayrollWorker } from './payrollWorker';
import { closeAllQueues } from '../queues/agentQueues';
import { getSharedRedisClient, isRedisConfigured, checkRedisHealth } from '../queues/redisConfig';

let activeWorkers: Worker[] = [];
let isStopping = false;
let signalsRegistered = false;

/**
 * Inicia todos los workers de segundo plano del ERP y registra los listeners
 * para apagado elegante (Graceful Shutdown).
 */
export async function startWorkers(): Promise<Worker[]> {
  if (activeWorkers.length > 0) {
    console.log('[Workers:Manager] Los workers ya se encuentran en ejecución.');
    return activeWorkers;
  }

  if (!isRedisConfigured()) {
    console.log('[Workers:Manager] Redis no configurado en este entorno. Modo asíncrono en memoria activo.');
    return [];
  }

  const health = await checkRedisHealth();
  if (health.status !== 'connected') {
    console.warn(`[Workers:Manager] Redis no accesible (${health.message || 'desconectado'}). Modo asíncrono en memoria activo.`);
    return [];
  }

  console.log('[Workers:Manager] Inicializando capa de procesamiento asíncrono BullMQ...');

  try {
    const f29Worker = getF29SettlementWorker();
    const rcvWorker = getRcvSyncWorker();
    const payrollWorker = getPayrollWorker();

    activeWorkers = [f29Worker, rcvWorker, payrollWorker];

    console.log(`[Workers:Manager] ${activeWorkers.length} workers iniciados exitosamente:`, [
      f29Worker.name,
      rcvWorker.name,
      payrollWorker.name,
    ]);

    // Registrar gestión de señales de terminación si aún no se han registrado
    if (!signalsRegistered) {
      registerShutdownSignals();
      signalsRegistered = true;
    }

    return activeWorkers;
  } catch (error) {
    console.error('[Workers:Manager] Error al inicializar workers:', error);
    throw error;
  }
}

/**
 * Detiene todos los workers y conexiones de forma ordenada sin perder trabajos activos.
 */
export async function stopWorkers(signal?: string): Promise<void> {
  if (isStopping) {
    console.log('[Workers:Manager] Proceso de detención ya en curso...');
    return;
  }
  isStopping = true;

  console.log(`[Workers:Manager] Iniciando apagado elegante (Graceful Shutdown)${signal ? ` por señal ${signal}` : ''}...`);

  try {
    // 1. Detener recepción de nuevos trabajos y esperar finalización de los activos
    console.log(`[Workers:Manager] Cerrando ${activeWorkers.length} workers activos...`);
    await Promise.all(
      activeWorkers.map(async (worker) => {
        try {
          await worker.close();
          console.log(`[Workers:Manager] Worker '${worker.name}' cerrado.`);
        } catch (wErr) {
          console.warn(`[Workers:Manager] Advertencia cerrando worker '${worker.name}':`, wErr);
        }
      })
    );
    activeWorkers = [];

    // 2. Cerrar instancias de colas BullMQ
    await closeAllQueues();

    // 3. Cerrar conexión compartida de Redis
    const sharedRedis = getSharedRedisClient();
    if (sharedRedis && sharedRedis.status !== 'end') {
      console.log('[Workers:Manager] Cerrando conexión Redis...');
      await sharedRedis.quit().catch(() => sharedRedis.disconnect());
    }

    console.log('[Workers:Manager] Apagado elegante completado exitosamente.');
  } catch (err) {
    console.error('[Workers:Manager] Error durante el cierre de workers/colas:', err);
  } finally {
    isStopping = false;
  }
}

/**
 * Registra los escuchadores de eventos SIGTERM y SIGINT del sistema operativo.
 */
function registerShutdownSignals(): void {
  const handleSignal = async (signal: string) => {
    console.log(`[Workers:Process] Señal ${signal} interceptada.`);
    await stopWorkers(signal);
    // Permitir que el proceso termine naturalmente si no hay más handles
  };

  process.once('SIGTERM', () => {
    handleSignal('SIGTERM').then(() => {
      process.exit(0);
    });
  });

  process.once('SIGINT', () => {
    handleSignal('SIGINT').then(() => {
      process.exit(0);
    });
  });
}

export { getF29SettlementWorker } from './f29SettlementWorker';
export { getRcvSyncWorker } from './rcvSyncWorker';
export { getPayrollWorker } from './payrollWorker';
