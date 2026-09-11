import mysql from 'mysql2/promise';
import { drizzle, type MySql2Database } from 'drizzle-orm/mysql2';
import * as schema from './mysqlSchema';
import { diskPersistence } from '../services/diskPersistenceService';
import dotenv from 'dotenv';

dotenv.config({ override: true });

// ============================================================================
// CONFIGURACIÓN RESILIENTE DEL CONNECTION POOL MYSQL 8.0
// ============================================================================
const connectionUri = process.env.MYSQL_URL || process.env.DATABASE_URL;

const poolConfig: mysql.PoolOptions = connectionUri
  ? {
      uri: connectionUri,
      connectionLimit: 10,
      waitForConnections: true,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
    }
  : {
      host: process.env.MYSQL_HOST || '127.0.0.1',
      port: Number(process.env.MYSQL_PORT) || 3306,
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || 'chile_erp',
      connectionLimit: 10,
      waitForConnections: true,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
    };

/**
 * Pool de conexiones nativo mysql2/promise configurado para alta concurrencia
 */
export const pool: mysql.Pool = mysql.createPool(poolConfig);

/**
 * Instancia Drizzle ORM conectada al pool de MySQL 8.0
 */
export const db: MySql2Database<typeof schema> = drizzle(pool, {
  schema,
  mode: 'default',
});

// ============================================================================
// ALMACENAMIENTO RESILIENTE EN MEMORIA (FALLBACK CUANDO MYSQL NO ESTÁ ACTIVO)
// ============================================================================
export const inMemoryIndicators: Array<{
  id: number;
  codigo: string;
  valor: string;
  fecha: string;
  fuente: string;
  createdAt: Date;
}> = [
  {
    id: 1,
    codigo: 'UF',
    valor: '40885.6300',
    fecha: '2026-09-09',
    fuente: 'sii.cl-oficial',
    createdAt: new Date(),
  },
  {
    id: 2,
    codigo: 'USD',
    valor: '928.1000',
    fecha: '2026-09-09',
    fuente: 'dolarapi.cl-oficial',
    createdAt: new Date(),
  },
  {
    id: 3,
    codigo: 'UTM',
    valor: '71721.0000',
    fecha: '2026-09-09',
    fuente: 'sii.cl-oficial',
    createdAt: new Date(),
  },
  {
    id: 4,
    codigo: 'IPC',
    valor: '0.6000',
    fecha: '2026-09-09',
    fuente: 'sii.cl-oficial',
    createdAt: new Date(),
  },
  {
    id: 5,
    codigo: 'UF',
    valor: '40883.0000',
    fecha: '2026-09-07',
    fuente: 'mindicador.cl-oficial',
    createdAt: new Date(),
  },
  {
    id: 2,
    codigo: 'USD',
    valor: '934.3500',
    fecha: '2026-09-07',
    fuente: 'mindicador.cl-oficial',
    createdAt: new Date(),
  },
  {
    id: 3,
    codigo: 'UTM',
    valor: '71721.0000',
    fecha: '2026-09-07',
    fuente: 'mindicador.cl-oficial',
    createdAt: new Date(),
  },
  {
    id: 4,
    codigo: 'IPC',
    valor: '-0.2000',
    fecha: '2026-09-07',
    fuente: 'mindicador.cl-oficial',
    createdAt: new Date(),
  },
  {
    id: 5,
    codigo: 'UF',
    valor: '39150.5000',
    fecha: '2026-09-04',
    fuente: 'mindicador.cl-fallback',
    createdAt: new Date(),
  },
  {
    id: 6,
    codigo: 'USD',
    valor: '955.2000',
    fecha: '2026-09-04',
    fuente: 'mindicador.cl-fallback',
    createdAt: new Date(),
  },
  {
    id: 7,
    codigo: 'UTM',
    valor: '68320.0000',
    fecha: '2026-09-04',
    fuente: 'mindicador.cl-fallback',
    createdAt: new Date(),
  },
  {
    id: 8,
    codigo: 'IPC',
    valor: '0.3000',
    fecha: '2026-09-04',
    fuente: 'mindicador.cl-fallback',
    createdAt: new Date(),
  },
  {
    id: 9,
    codigo: 'UF',
    valor: '40883.0000',
    fecha: '2026-09-01',
    fuente: 'mindicador.cl-oficial',
    createdAt: new Date(),
  },
  {
    id: 10,
    codigo: 'UTM',
    valor: '71721.0000',
    fecha: '2026-09-01',
    fuente: 'mindicador.cl-oficial',
    createdAt: new Date(),
  },
];

export const inMemoryEntries: any[] = [];
export const inMemoryLines: any[] = [];
export const inMemoryAuditLogs: any[] = [];
export const inMemoryDtesRcv: any[] = [];

export const inMemoryAgentConfigs: any[] = [
  {
    id: 'cfg-001-rrhh',
    empresaId: '76.892.410-K',
    moduloCodigo: 'RRHH',
    instruccionesEspeciales:
      'Revisar carpeta de anexos de contratos; verificar que el pacto de horas extra no exceda 2 horas diarias según Dictamen DT. Validar estricto cumplimiento Ley Karin 21.643.',
    parametrosOperativos: {
      rutaDocumentosContratos: '/docs/rrhh/2026/anexos',
      limiteHorasExtraDiarias: 2,
      protocoloKarinActivo: true,
      centroCostoPorDefecto: 'CC-ADMIN-01',
    },
    activo: true,
    updatedAt: new Date(),
  },
  {
    id: 'cfg-002-sii',
    empresaId: '76.892.410-K',
    moduloCodigo: 'SII_RCV',
    instruccionesEspeciales:
      'No dar acuse comercial automático a facturas de proveedores de áridos o fletes sin confirmación de bodega previa. Para compras de servicios en la nube (AWS, Google Cloud, Microsoft Azure), imputar en la cuenta 5.1.02.015 en vez de gastos generales.',
    parametrosOperativos: {
      excluirProveedoresAcuse: ['77.890.123-4', '76.456.789-1'],
      reglasImputacionEspecificas: [
        {
          tipoGasto: 'SERVICIOS_NUBE',
          codigoCuentaSugerido: '5.1.02.015',
          nombreCuentaSugerido: 'Servicios de Infraestructura Cloud y SaaS',
          justificacion: 'Requerimiento de auditoría del estudio para control de costos tecnológicos',
        },
      ],
      limiteMontoAutoAprobacion: 5000000,
    },
    activo: true,
    updatedAt: new Date(),
  },
  {
    id: 'cfg-003-f29',
    empresaId: '76.892.410-K',
    moduloCodigo: 'F29_TAX',
    instruccionesEspeciales:
      'Empresa acogida a Régimen Pro Pyme General Art. 14 D N° 3 LIR. Aplicar tasa de PPM del 0.25% anual. Solicitar postergación de pago de IVA hasta por 2 meses por beneficio Pro Pyme si el flujo lo amerita.',
    parametrosOperativos: {
      tasaPpmFija: 0.0025,
      aplicaPostergacionIva: true,
      retencionHonorariosTasa: 0.145,
    },
    activo: true,
    updatedAt: new Date(),
  },
];

export const inMemoryAgentLearnings: any[] = [
  {
    id: 'learn-001',
    empresaId: '76.892.410-K',
    moduloCodigo: 'SII_RCV',
    categoria: 'ERROR_IMPUTACION',
    descripcionError:
      'En el período 2026-05 el agente imputó factura DTE 33 de AWS en 6.1.01.001 (Gastos Generales Administración) en lugar de la cuenta específica de servidores.',
    solucionAplicada:
      'Imputar siempre servicios en la nube en la cuenta 5.1.02.015 (Servicios de Infraestructura Cloud y SaaS) con auxiliar de proveedor extranjero o representante en Chile.',
    asientoIncorrectoJson: { debeCuenta: '6.1.01.001', nombre: 'Gastos Generales' },
    asientoCorregidoJson: { debeCuenta: '5.1.02.015', nombre: 'Servicios de Infraestructura Cloud y SaaS' },
    vecesEvitado: 7,
    activo: true,
    createdAt: new Date('2026-05-15T10:00:00Z'),
  },
  {
    id: 'learn-002',
    empresaId: '76.892.410-K',
    moduloCodigo: 'ACCOUNTING_LEDGER',
    categoria: 'DESCUADRE_PARTIDA_DOBLE',
    descripcionError:
      'El agente intentó enviar un asiento con descuadre por diferencia de redondeo de $1 peso en el IVA Débito Fiscal al prorratear ítems exentos y afectos.',
    solucionAplicada:
      'Ajustar siempre la diferencia de centavos/redondeo contra la cuenta de mayor valor neto o en Ajuste por Redondeo (6.1.05.999), garantizando SUM(Debe) === SUM(Haber) sin excepción.',
    asientoIncorrectoJson: { debe: 1190000, haber: 1189999 },
    asientoCorregidoJson: { debe: 1190000, haber: 1190000 },
    vecesEvitado: 12,
    activo: true,
    createdAt: new Date('2026-06-02T14:30:00Z'),
  },
  {
    id: 'learn-003',
    empresaId: null, // Global del sistema
    moduloCodigo: 'F29_TAX',
    categoria: 'NORMATIVA_SII',
    descripcionError:
      'El agente utilizó la tasa de retención de Boletas de Honorarios del 13.75% correspondiente al año 2024 en lugar de la tasa legal 2026.',
    solucionAplicada:
      'Bajo la Ley 21.133, a partir del 1 de enero de 2026 la tasa de retención para boletas de honorarios y segunda categoría es estrictamente del 14.50%.',
    asientoIncorrectoJson: { tasaRetencion: 0.1375 },
    asientoCorregidoJson: { tasaRetencion: 0.145 },
    vecesEvitado: 28,
    activo: true,
    createdAt: new Date('2026-01-02T08:00:00Z'),
  },
];

export let isRealMysqlConnected = false;

// Adaptador de contingencia con soporte transaccional y compatibilidad de tipos
const mockTx: any = {
  insert: (table: any) => ({
    values: (val: any) => {
      const exec = async () => {
        if (table === schema.economicIndicators) {
          const nextId = inMemoryIndicators.length + 1;
          inMemoryIndicators.push({ ...val, id: nextId, createdAt: new Date() });
          return [{ insertId: nextId }];
        }
        if (table === schema.accountingEntries) {
          inMemoryEntries.push({ ...val, createdAt: new Date() });
          diskPersistence.addAccountingEntry({ ...val }, []);
          return [{ insertId: val.id }];
        }
        if (table === schema.accountingEntryLines) {
          if (Array.isArray(val)) {
            val.forEach((item, idx) => {
              const line = { ...item, id: item.id || `line-${Date.now()}-${idx}` };
              inMemoryLines.push(line);
              diskPersistence.getLinesForEntry(line.entryId).push(line);
            });
          } else {
            const line = { ...val, id: val.id || `line-${Date.now()}` };
            inMemoryLines.push(line);
            diskPersistence.getLinesForEntry(line.entryId).push(line);
          }
          diskPersistence.scheduleFlush();
          return [{ insertId: 1 }];
        }
        if (table === schema.agentAuditLogs) {
          inMemoryAuditLogs.push({ ...val, createdAt: new Date() });
          diskPersistence.addAuditLog({ ...val });
          return [{ insertId: val.id }];
        }
        if (table === schema.dtesRcv) {
          const rows = Array.isArray(val) ? val : [val];
          for (const row of rows) {
            const existingIdx = inMemoryDtesRcv.findIndex(
              (d) =>
                d.empresaId === row.empresaId &&
                d.tipoOperacion === row.tipoOperacion &&
                d.tipoDte === row.tipoDte &&
                d.folio === row.folio &&
                d.rutContraparte === row.rutContraparte
            );
            if (existingIdx >= 0) {
              inMemoryDtesRcv[existingIdx] = { ...inMemoryDtesRcv[existingIdx], ...row };
            } else {
              inMemoryDtesRcv.push({ ...row, createdAt: new Date() });
            }
            diskPersistence.addDte(row);
          }
          return [{ insertId: 1 }];
        }
        if (table === schema.companyAgentConfigs) {
          const existingIdx = inMemoryAgentConfigs.findIndex(
            (c) => c.empresaId === val.empresaId && c.moduloCodigo === val.moduloCodigo
          );
          if (existingIdx >= 0) {
            inMemoryAgentConfigs[existingIdx] = { ...inMemoryAgentConfigs[existingIdx], ...val, updatedAt: new Date() };
          } else {
            inMemoryAgentConfigs.push({ ...val, updatedAt: new Date() });
          }
          return [{ insertId: val.id }];
        }
        if (table === schema.agentLearnings) {
          inMemoryAgentLearnings.push({ ...val, createdAt: new Date() });
          return [{ insertId: val.id }];
        }
        return [{ insertId: 1 }];
      };
      return {
        $returningId: () => ({ id: val.id || 1 }),
        onDuplicateKeyUpdate: () => ({ execute: exec }),
        execute: exec,
      };
    },
  }),
  select: () => ({
    from: (table: any) => ({
      where: (_condition: any) => ({
        orderBy: () => ({
          limit: async (num: number) => {
            if (table === schema.economicIndicators) {
              return inMemoryIndicators.slice(-num);
            }
            if (table === schema.dtesRcv) {
              return inMemoryDtesRcv.slice(-num);
            }
            if (table === schema.agentLearnings) {
              return inMemoryAgentLearnings.slice(-num);
            }
            return [];
          },
        }),
        limit: async (_limit: number) => {
          if (table === schema.economicIndicators) {
            return inMemoryIndicators;
          }
          if (table === schema.dtesRcv) {
            return inMemoryDtesRcv;
          }
          if (table === schema.companyAgentConfigs) {
            return inMemoryAgentConfigs;
          }
          if (table === schema.agentLearnings) {
            return inMemoryAgentLearnings;
          }
          return [];
        },
        groupBy: () => ({
          execute: async () => {
            if (table === schema.dtesRcv) {
              return inMemoryDtesRcv;
            }
            return [];
          },
        }),
        execute: async () => {
          if (table === schema.economicIndicators) return inMemoryIndicators;
          if (table === schema.accountingEntries) return inMemoryEntries;
          if (table === schema.dtesRcv) return inMemoryDtesRcv;
          if (table === schema.companyAgentConfigs) return inMemoryAgentConfigs;
          if (table === schema.agentLearnings) return inMemoryAgentLearnings;
          return [];
        },
      }),
    }),
  }),
};


const inMemoryDb: any = {
  ...mockTx,
  transaction: async <T>(callback: (tx: any) => Promise<T>): Promise<T> => {
    return await callback(mockTx);
  },
};

/**
 * Retorna la instancia activa de base de datos (Drizzle sobre pool real o contingencia en memoria)
 */
export function getMysqlDb() {
  if (isRealMysqlConnected) {
    return db;
  }
  return inMemoryDb;
}

export function getMysqlPool(): mysql.Pool {
  return pool;
}

export const mysqlDb = new Proxy({} as any, {
  get(_target, prop) {
    const activeDb = getMysqlDb();
    return activeDb[prop];
  },
});

// ============================================================================
// VERIFICACIÓN DE CONEXIÓN (PING SELECT 1) CON MANEJO DE ERRORES MYSQL
// ============================================================================
/**
 * Comprueba la disponibilidad del servidor MySQL 8.0 ejecutando SELECT 1.
 * Captura y diagnostica errores comunes (ECONNREFUSED, ER_ACCESS_DENIED_ERROR, etc.).
 * @returns Promise<boolean> true si la conexión es exitosa, false en caso contrario.
 */
export async function checkMySqlConnection(): Promise<boolean> {
  const startTime = Date.now();
  let connection: mysql.PoolConnection | null = null;

  try {
    connection = await pool.getConnection();
    await connection.query('SELECT 1 AS ping');
    const latencyMs = Date.now() - startTime;
    isRealMysqlConnected = true;
    console.log(`[MySQL 8.0] Conexión activa y verificada exitosamente con ping SELECT 1 (${latencyMs}ms).`);
    return true;
  } catch (err: any) {
    isRealMysqlConnected = false;
    const errorCode = err.code || 'UNKNOWN_ERROR';

    if (errorCode === 'ECONNREFUSED') {
      console.warn(
        `[MySQL 8.0] Servidor MySQL local no detectado en ${err.address || poolConfig.host}:${err.port || poolConfig.port}. Activando modo de contingencia en memoria resiliente.`
      );
    } else if (errorCode === 'ER_ACCESS_DENIED_ERROR') {
      console.warn(
        `[MySQL 8.0] Acceso denegado (ER_ACCESS_DENIED_ERROR) para el usuario '${poolConfig.user}'. Continuando en modo contingencia.`
      );
    } else if (errorCode === 'ER_BAD_DB_ERROR') {
      console.warn(
        `[MySQL 8.0] Base de datos no encontrada (ER_BAD_DB_ERROR): '${poolConfig.database}'. Continuando en modo contingencia.`
      );
    } else if (errorCode === 'PROTOCOL_CONNECTION_LOST') {
      console.warn('[MySQL 8.0] Conexión perdida con el servidor MySQL (PROTOCOL_CONNECTION_LOST).');
    } else if (errorCode === 'ETIMEDOUT') {
      console.warn('[MySQL 8.0] Tiempo de espera agotado al conectar al servidor MySQL (ETIMEDOUT).');
    } else {
      console.warn(`[MySQL 8.0] Verificación de conexión: [${errorCode}] ${err.message}. Continuando en modo contingencia.`);
    }

    return false;
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

/**
 * Verifica la existencia de las tablas maestras en MySQL 8.0 y ejecuta la inicialización
 * DDL si aún no han sido creadas, sincronizando además cualquier dato pendiente desde disco.
 */
export async function ensureMysqlSchemaInitialized(): Promise<void> {
  if (!isRealMysqlConnected) {
    return;
  }
  let connection: mysql.PoolConnection | null = null;
  try {
    connection = await pool.getConnection();
    const [rows]: [any[], any] = await connection.query("SHOW TABLES LIKE 'accounting_entries';");
    if (!rows || rows.length === 0) {
      console.log('[MySQL 8.0] Tablas principales no encontradas. Ejecutando creación automática del esquema...');
      const { initializeMysqlDatabase } = await import('../scripts/initMysqlDb');
      await initializeMysqlDatabase();
    }
    // Sincronizar datos de disco a MySQL
    await diskPersistence.syncDiskToMysql();
  } catch (err: any) {
    console.warn(`[MySQL 8.0] Aviso durante auto-inicialización de esquema: ${err.message}`);
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

// ============================================================================
// APAGADO ORDENADO (GRACEFUL SHUTDOWN)
// ============================================================================
let isPoolClosing = false;

/**
 * Cierra ordenadamente el connection pool liberando todas las conexiones activas.
 */
export async function closeMySqlConnection(): Promise<void> {
  if (isPoolClosing) {
    return;
  }

  isPoolClosing = true;
  console.log('[MySQL 8.0] Iniciando cierre ordenado del connection pool...');

  try {
    await pool.end();
    isRealMysqlConnected = false;
    console.log('[MySQL 8.0] Connection pool cerrado exitosamente.');
  } catch (err: any) {
    console.error('[MySQL 8.0] Error al cerrar el connection pool:', err.message);
  } finally {
    isPoolClosing = false;
  }
}

// Registro de señales de terminación del proceso
if (typeof process !== 'undefined') {
  process.on('SIGTERM', async () => {
    await closeMySqlConnection();
  });
  process.on('SIGINT', async () => {
    await closeMySqlConnection();
  });
}
