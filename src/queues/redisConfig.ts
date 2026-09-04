import { Redis, type RedisOptions } from 'ioredis';

/**
 * Configuración centralizada de IORedis optimizada para BullMQ v5+
 * y procesamiento asíncrono en sistemas distribuidos.
 *
 * REGLAS CRÍTICAS DE BULLMQ:
 * 1. `maxRetriesPerRequest: null`: Mandatorio. BullMQ gestiona sus propios reintentos y comandos bloqueantes.
 * 2. `enableReadyCheck: false`: Previene retardos al reconectar workers y colas.
 * 3. Backoff exponencial con jitter en la estrategia de reconexión para evitar el efecto 'thundering herd'.
 */

export interface AppRedisConfig {
  host: string;
  port: number;
  password?: string;
  tls?: boolean;
  url?: string;
}

/**
 * Determina si las variables de entorno de Redis están efectivamente configuradas.
 */
export function isRedisConfigured(): boolean {
  const hasHost = Boolean(process.env.REDIS_HOST && process.env.REDIS_HOST.trim() !== '');
  const hasUrl = Boolean(process.env.REDIS_URL && process.env.REDIS_URL.trim() !== '');
  return hasHost || hasUrl;
}

/**
 * Obtiene las variables de entorno de Redis con valores por defecto seguros.
 */
export function getRedisEnvConfig(): AppRedisConfig {
  const host = process.env.REDIS_HOST || '127.0.0.1';
  const port = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379;
  const password = process.env.REDIS_PASSWORD || undefined;
  const tls = process.env.REDIS_TLS === 'true';
  const url = process.env.REDIS_URL || undefined;

  return { host, port, password, tls, url };
}

/**
 * Genera el objeto de opciones de IORedis estrictamente compatible con BullMQ.
 */
export function getRedisConnectionOptions(): RedisOptions {
  const env = getRedisEnvConfig();

  const baseOptions: RedisOptions = {
    host: env.host,
    port: env.port,
    password: env.password,
    tls: env.tls ? {} : undefined,
    // REQUISITOS OBLIGATORIOS PARA BULLMQ:
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
    // Reconexión resiliente con límite estricto para no generar bucles infinitos si Redis no está activo
    retryStrategy: (times: number) => {
      if (times > 3) {
        // Detiene reconexiones automáticas si el servidor Redis no está disponible
        return null;
      }
      const jitter = Math.floor(Math.random() * 200);
      const delay = Math.min(times * 250 + jitter, 2500);
      return delay;
    },
    reconnectOnError: (err: Error) => {
      const targetErrors = ['READONLY', 'ETIMEDOUT', 'ECONNRESET'];
      return targetErrors.some((target) => err.message.includes(target));
    },
    connectTimeout: 5000,
  };

  return baseOptions;
}

/**
 * Instancia un nuevo cliente IORedis con manejadores de eventos configurados.
 */
export function createRedisClient(customLabel = 'QueueClient'): Redis {
  const options = getRedisConnectionOptions();
  const client = process.env.REDIS_URL
    ? new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        lazyConnect: true,
      })
    : new Redis(options);

  client.on('connect', () => {
    console.log(`[Redis:${customLabel}] Conectando a Redis...`);
  });

  client.on('ready', () => {
    console.log(`[Redis:${customLabel}] Conexión establecida y lista (READY)`);
  });

  client.on('error', (err: Error) => {
    // Registro estructurado sin tumbar el proceso si Redis no está disponible
    console.warn(`[Redis:${customLabel}] Advertencia de conexión Redis: ${err.message}`);
  });

  client.on('close', () => {
    // Evento de cierre sin elevar errores
  });

  return client;
}

// Instancia compartida perezosa (singleton) para consultas o health-checks generales
let sharedClientInstance: Redis | null = null;

export function getSharedRedisClient(): Redis | null {
  if (!isRedisConfigured()) {
    return null;
  }
  if (!sharedClientInstance) {
    sharedClientInstance = createRedisClient('SharedGlobalClient');
  }
  return sharedClientInstance;
}

/**
 * Verifica la conectividad con el cluster o instancia de Redis sin arrojar excepciones no controladas.
 */
export async function checkRedisHealth(): Promise<{
  status: 'connected' | 'disconnected' | 'error';
  latencyMs?: number;
  message?: string;
}> {
  if (!isRedisConfigured()) {
    return {
      status: 'disconnected',
      message: 'Redis no configurado (REDIS_HOST / REDIS_URL vacíos). Modo asíncrono en memoria activo.',
    };
  }

  let testClient: Redis | null = null;
  try {
    const options = getRedisConnectionOptions();
    testClient = process.env.REDIS_URL
      ? new Redis(process.env.REDIS_URL, {
          maxRetriesPerRequest: null,
          enableReadyCheck: false,
          lazyConnect: true,
          connectTimeout: 3000,
        })
      : new Redis({
          ...options,
          connectTimeout: 3000,
          retryStrategy: () => null, // No reintentar en health-check puntual
        });

    testClient.on('error', () => {
      // Ignorar para evitar unhandled error event
    });

    const start = Date.now();
    await testClient.connect();
    const pong = await testClient.ping();
    const latencyMs = Date.now() - start;

    await testClient.quit().catch(() => testClient?.disconnect());

    if (pong === 'PONG') {
      return { status: 'connected', latencyMs };
    }
    return { status: 'disconnected', message: `Respuesta inesperada: ${pong}` };
  } catch (error) {
    if (testClient) {
      try {
        testClient.disconnect();
      } catch {
        // Ignorar
      }
    }
    const msg = error instanceof Error ? error.message : String(error);
    return { status: 'error', message: msg };
  }
}
