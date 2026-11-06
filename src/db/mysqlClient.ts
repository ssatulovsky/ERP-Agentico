import mysql from 'mysql2/promise';
import { drizzle, type MySql2Database } from 'drizzle-orm/mysql2';
import * as schema from './mysqlSchema';
import { diskPersistence } from '../services/diskPersistenceService';
import dotenv from 'dotenv';
import { isDemoModeEnabled } from '../config/demoMode';

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
      database: process.env.MYSQL_DATABASE || 'erp_contable',
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

// ============================================================================
// ADAPTADOR DE CONTINGENCIA COMPATIBLE CON DRIZZLE ORM Y PERSISTENCIA EN DISCO
// ============================================================================
function extractIdFromCondition(condition: any): string | null {
  if (!condition) return null;
  if (condition.value !== undefined) return String(condition.value);
  if (condition.right !== undefined) {
    if (condition.right.value !== undefined) return String(condition.right.value);
    return String(condition.right);
  }
  return null;
}

const mockTx: any = {
  insert: (table: any) => ({
    values: (val: any) => {
      const rows = Array.isArray(val) ? val : [val];
      const exec = async () => {
        if (table === schema.economicIndicators) {
          for (const item of rows) {
            const nextId = inMemoryIndicators.length + 1;
            inMemoryIndicators.push({ ...item, id: nextId, createdAt: new Date() });
          }
          return rows.map((r) => ({ insertId: r.id || 1, ...r }));
        }

        if (table === schema.accountingEntries) {
          for (const item of rows) {
            const existingIdx = inMemoryEntries.findIndex((e) => e.id === item.id);
            if (existingIdx >= 0) {
              inMemoryEntries[existingIdx] = { ...inMemoryEntries[existingIdx], ...item };
            } else {
              inMemoryEntries.unshift({ ...item, createdAt: item.createdAt || new Date() });
            }
            diskPersistence.addAccountingEntry({ ...item }, []);
          }
          return rows.map((r) => ({ insertId: r.id, ...r }));
        }

        if (table === schema.accountingEntryLines) {
          const fullRows = rows.map((line: any) => ({
            ...line,
            id: line.id || `line-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          }));
          for (const line of fullRows) {
            inMemoryLines.push(line);
          }
          diskPersistence.addAccountingLines(fullRows);
          return fullRows;
        }

        if (table === schema.agentAuditLogs) {
          for (const log of rows) {
            const fullLog = { ...log, id: log.id || `log-${Date.now()}`, createdAt: new Date() };
            inMemoryAuditLogs.push(fullLog);
            diskPersistence.addAuditLog(fullLog);
          }
          return rows.map((r) => ({ insertId: r.id, ...r }));
        }

        if (table === schema.expenseReports) {
          for (const rep of rows) {
            diskPersistence.saveExpenseReport({
              ...rep,
              fondoAsignadoClp: Number(rep.fondoAsignadoClp || 0),
              montoTotalRendidoClp: Number(rep.montoTotalRendidoClp || 0),
              saldoReembolsarClp: Number(rep.saldoReembolsarClp || 0),
              saldoReintegrarClp: Number(rep.saldoReintegrarClp || 0),
            });
          }
          return rows.map((r) => ({ insertId: r.id, ...r }));
        }

        if (table === schema.expenseItems) {
          for (const item of rows) {
            diskPersistence.addExpenseItem({
              ...item,
              montoNeto: Number(item.montoNeto || 0),
              montoIva: Number(item.montoIva || 0),
              montoExento: Number(item.montoExento || 0),
              montoTotalClp: Number(item.montoTotalClp || 0),
            });
          }
          return rows.map((r) => ({ insertId: r.id, ...r }));
        }

        if (table === schema.expenseProjects) {
          for (const pry of rows) {
            diskPersistence.createExpenseProject({ ...pry });
          }
          return rows.map((r) => ({ insertId: r.id, ...r }));
        }

        if (table === schema.dtesRcv) {
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
          return rows.map((r) => ({ insertId: r.id, ...r }));
        }

        if (table === schema.companyAgentConfigs) {
          for (const item of rows) {
            const existingIdx = inMemoryAgentConfigs.findIndex(
              (c) => c.empresaId === item.empresaId && c.moduloCodigo === item.moduloCodigo
            );
            if (existingIdx >= 0) {
              inMemoryAgentConfigs[existingIdx] = { ...inMemoryAgentConfigs[existingIdx], ...item, updatedAt: new Date() };
            } else {
              inMemoryAgentConfigs.push({ ...item, updatedAt: new Date() });
            }
          }
          return rows.map((r) => ({ insertId: r.id, ...r }));
        }

        if (table === schema.agentLearnings) {
          for (const item of rows) {
            inMemoryAgentLearnings.push({ ...item, createdAt: new Date() });
          }
          return rows.map((r) => ({ insertId: r.id, ...r }));
        }

        return rows.map((r) => ({ insertId: r.id || 1, ...r }));
      };

      const queryObj: any = {
        $returningId: () => ({ id: val?.id || 1 }),
        onDuplicateKeyUpdate: () => queryObj,
        returning: async () => {
          await exec();
          return rows;
        },
        execute: exec,
        then: (onfulfilled?: any, onrejected?: any) => exec().then(onfulfilled, onrejected),
      };

      return queryObj;
    },
  }),

  update: (table: any) => ({
    set: (updateValues: any) => {
      let whereCondition: any = null;

      const exec = async () => {
        const targetId = extractIdFromCondition(whereCondition);

        if (table === schema.expenseReports) {
          const reports = diskPersistence.getExpenseReports();
          for (const r of reports) {
            if (!targetId || r.id === targetId) {
              Object.assign(r, updateValues, {
                updatedAt: updateValues.updatedAt instanceof Date ? updateValues.updatedAt.toISOString() : (updateValues.updatedAt || new Date().toISOString()),
              });
              if (updateValues.estado === 'APROBADA' && !r.fechaAprobacion) {
                r.fechaAprobacion = new Date().toISOString().substring(0, 10);
              } else if (updateValues.estado === 'CONTABILIZADA_PAGADA' && !r.fechaPagoReembolso) {
                r.fechaPagoReembolso = new Date().toISOString().substring(0, 10);
              }
            }
          }
          diskPersistence.scheduleFlush();
          return [{ affectedRows: 1 }];
        }

        if (table === schema.accountingEntries) {
          const entries = diskPersistence.getAccountingEntries();
          for (const e of entries) {
            if (!targetId || e.id === targetId) {
              Object.assign(e, updateValues);
            }
          }
          for (const e of inMemoryEntries) {
            if (!targetId || e.id === targetId) {
              Object.assign(e, updateValues);
            }
          }
          diskPersistence.scheduleFlush();
          return [{ affectedRows: 1 }];
        }

        if (table === schema.dtesRcv) {
          const dtes = diskPersistence.getDtes();
          for (const d of dtes) {
            if (!targetId || d.id === targetId) {
              Object.assign(d, updateValues);
            }
          }
          for (const d of inMemoryDtesRcv) {
            if (!targetId || d.id === targetId) {
              Object.assign(d, updateValues);
            }
          }
          diskPersistence.scheduleFlush();
          return [{ affectedRows: 1 }];
        }

        return [{ affectedRows: 1 }];
      };

      const updateBuilder: any = {
        where: (cond: any) => {
          whereCondition = cond;
          return updateBuilder;
        },
        returning: async () => {
          await exec();
          return [updateValues];
        },
        execute: exec,
        then: (onfulfilled?: any, onrejected?: any) => exec().then(onfulfilled, onrejected),
      };

      return updateBuilder;
    },
  }),

  delete: (table: any) => ({
    where: (condition: any) => {
      const exec = async () => {
        const targetId = extractIdFromCondition(condition);

        if (table === schema.expenseItems && targetId) {
          diskPersistence.deleteExpenseItem(targetId);
        }
        if (table === schema.expenseReports && targetId) {
          const reports = diskPersistence.getExpenseReports();
          const idx = reports.findIndex((r: any) => r.id === targetId);
          if (idx >= 0) {
            reports.splice(idx, 1);
            diskPersistence.scheduleFlush();
          }
        }
        return [{ affectedRows: 1 }];
      };

      return {
        execute: exec,
        then: (onfulfilled?: any, onrejected?: any) => exec().then(onfulfilled, onrejected),
      };
    },
  }),

  select: () => ({
    from: (table: any) => {
      let whereCondition: any = null;
      let limitNum: number | null = null;

      const getSourceData = () => {
        if (table === schema.economicIndicators) return inMemoryIndicators;
        if (table === schema.accountingEntries) {
          const diskList = diskPersistence.getAccountingEntries();
          return diskList.length > 0 ? diskList : inMemoryEntries;
        }
        if (table === schema.accountingEntryLines) {
          return diskPersistence.getAllLines ? diskPersistence.getAllLines() : inMemoryLines;
        }
        if (table === schema.expenseReports) return diskPersistence.getExpenseReports();
        if (table === schema.expenseItems) return diskPersistence.getExpenseItems();
        if (table === schema.expenseProjects) return diskPersistence.getExpenseProjects();
        if (table === schema.dtesRcv) {
          const diskDtes = diskPersistence.getDtes();
          return diskDtes.length > 0 ? diskDtes : inMemoryDtesRcv;
        }
        if (table === schema.companyAgentConfigs) return inMemoryAgentConfigs;
        if (table === schema.agentLearnings) return inMemoryAgentLearnings;
        return [];
      };

      const exec = async () => {
        let result = [...getSourceData()];
        const targetId = extractIdFromCondition(whereCondition);

        if (targetId) {
          result = result.filter((item: any) => {
            return (
              item.id === targetId ||
              item.empresaId === targetId ||
              item.expenseReportId === targetId ||
              item.entryId === targetId ||
              item.codigo === targetId
            );
          });
        }

        if (limitNum !== null && limitNum > 0) {
          result = result.slice(0, limitNum);
        }

        return result;
      };

      const selectBuilder: any = {
        where: (cond: any) => {
          whereCondition = cond;
          return selectBuilder;
        },
        orderBy: () => selectBuilder,
        limit: (n: number) => {
          limitNum = n;
          return selectBuilder;
        },
        groupBy: () => selectBuilder,
        execute: exec,
        then: (onfulfilled?: any, onrejected?: any) => exec().then(onfulfilled, onrejected),
      };

      return selectBuilder;
    },
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

    // Auto-verificación preventiva de compatibilidad con Agente SII (dtes_rcv.periodo), auditoría agéntica, auxiliares, firm_id y multimoneda
    try {
      const [colRows]: [any[], any] = await connection.query("SHOW COLUMNS FROM `dtes_rcv` LIKE 'periodo';");
      const [auditColRows]: [any[], any] = await connection.query("SHOW COLUMNS FROM `agent_audit_logs` LIKE 'accion';");
      const [auditFirmRows]: [any[], any] = await connection.query("SHOW COLUMNS FROM `agent_audit_logs` LIKE 'firm_id';");
      const [entryFirmRows]: [any[], any] = await connection.query("SHOW COLUMNS FROM `accounting_entries` LIKE 'firm_id';");
      const [entriesDocRows]: [any[], any] = await connection.query("SHOW COLUMNS FROM `accounting_entries` LIKE 'documento_referencia';");
      const [linesNumRows]: [any[], any] = await connection.query("SHOW COLUMNS FROM `accounting_entry_lines` LIKE 'linea_numero';");
      const [linesMontoRows]: [any[], any] = await connection.query("SHOW COLUMNS FROM `accounting_entry_lines` LIKE 'monto_documento_ref';");
      const [linesOpRows]: [any[], any] = await connection.query("SHOW COLUMNS FROM `accounting_entry_lines` LIKE 'documento_operacion';");
      if (
        !colRows || colRows.length === 0 ||
        !auditColRows || auditColRows.length === 0 ||
        !auditFirmRows || auditFirmRows.length === 0 ||
        !entryFirmRows || entryFirmRows.length === 0 ||
        !entriesDocRows || entriesDocRows.length === 0 ||
        !linesNumRows || linesNumRows.length === 0 ||
        !linesMontoRows || linesMontoRows.length === 0 ||
        !linesOpRows || linesOpRows.length === 0
      ) {
        console.log('[MySQL 8.0] Discrepancia de esquemas detectada (faltan columnas de comprobantes, firm_id, auxiliares o multimoneda). Ejecutando actualización incremental de esquemas...');
        const { updateMysqlDatabase } = await import('../scripts/updateMysqlDb');
        await updateMysqlDatabase();
      }

      // Asegurar liberación de índices únicos restrictivos en accounting_entries
      try {
        await connection.query("ALTER TABLE `accounting_entries` DROP INDEX `uq_entries_empresa_origen_doc`;");
      } catch {}
      try {
        await connection.query("ALTER TABLE `accounting_entries` DROP INDEX `uq_entries_empresa_doc`;");
      } catch {}
      try {
        await connection.query("ALTER TABLE `accounting_entries` ADD KEY `idx_entries_empresa_origen_doc` (`empresa_id`, `periodo`, `origen_modulo`, `documento_ref`);");
      } catch {}
    } catch (colErr: any) {
      console.warn(`[MySQL 8.0] Aviso al verificar columnas (${colErr.message}). Ejecutando actualización preventiva...`);
      try {
        const { updateMysqlDatabase } = await import('../scripts/updateMysqlDb');
        await updateMysqlDatabase();
      } catch {}
    }

    // Auto-verificación de tablas de Rendición de Gastos (RindeGastos)
    try {
      const [expenseRows]: [any[], any] = await connection.query("SHOW TABLES LIKE 'expense_reports';");
      if (!expenseRows || expenseRows.length === 0) {
        console.log('[MySQL 8.0] Tablas de Rendición de Gastos (RindeGastos) no encontradas. Creando automáticamente DDL...');
        await connection.query(`
          CREATE TABLE IF NOT EXISTS \`expense_projects\` (
            \`id\` VARCHAR(64) NOT NULL,
            \`empresa_id\` VARCHAR(64) NOT NULL,
            \`codigo\` VARCHAR(50) NOT NULL,
            \`nombre\` VARCHAR(200) NOT NULL,
            \`cliente_nombre\` VARCHAR(200) NULL,
            \`presupuesto_total_clp\` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
            \`activo\` BOOLEAN NOT NULL DEFAULT TRUE,
            \`descripcion\` TEXT NULL,
            \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
            PRIMARY KEY (\`id\`),
            UNIQUE KEY \`uq_expense_project_empresa_codigo\` (\`empresa_id\`, \`codigo\`),
            KEY \`idx_expense_project_empresa\` (\`empresa_id\`)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        await connection.query(`
          CREATE TABLE IF NOT EXISTS \`expense_reports\` (
            \`id\` VARCHAR(64) NOT NULL,
            \`empresa_id\` VARCHAR(64) NOT NULL,
            \`folio\` VARCHAR(50) NOT NULL,
            \`titulo\` VARCHAR(255) NOT NULL,
            \`rendidor_id\` VARCHAR(64) NULL,
            \`rendidor_nombre\` VARCHAR(200) NOT NULL,
            \`rendidor_rut\` VARCHAR(20) NOT NULL,
            \`rendidor_email\` VARCHAR(255) NULL,
            \`rendidor_cargo\` VARCHAR(150) NULL,
            \`centro_costo_id\` VARCHAR(64) NULL,
            \`centro_costo_codigo\` VARCHAR(50) NULL,
            \`centro_costo_nombre\` VARCHAR(200) NULL,
            \`proyecto_id\` VARCHAR(64) NULL,
            \`proyecto_codigo\` VARCHAR(50) NULL,
            \`proyecto_nombre\` VARCHAR(200) NULL,
            \`fondo_asignado_clp\` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
            \`monto_total_rendido_clp\` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
            \`saldo_reembolsar_clp\` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
            \`saldo_reintegrar_clp\` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
            \`moneda\` VARCHAR(10) NOT NULL DEFAULT 'CLP',
            \`estado\` VARCHAR(40) NOT NULL DEFAULT 'BORRADOR',
            \`fecha_inicio\` DATE NOT NULL,
            \`fecha_cierre\` DATE NOT NULL,
            \`fecha_aprobacion\` DATE NULL,
            \`fecha_pago_reembolso\` DATE NULL,
            \`aprobador_nombre\` VARCHAR(200) NULL,
            \`aprobador_email\` VARCHAR(255) NULL,
            \`observaciones_aprobador\` TEXT NULL,
            \`asiento_contable_id\` VARCHAR(64) NULL,
            \`agente_auditor_score\` INT NOT NULL DEFAULT 100,
            \`agente_auditor_diagnostico\` JSON NULL,
            \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
            \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
            PRIMARY KEY (\`id\`),
            UNIQUE KEY \`uq_expense_report_empresa_folio\` (\`empresa_id\`, \`folio\`),
            KEY \`idx_expense_report_empresa_estado\` (\`empresa_id\`, \`estado\`),
            KEY \`idx_expense_report_rendidor\` (\`empresa_id\`, \`rendidor_rut\`),
            KEY \`idx_expense_report_cc\` (\`centro_costo_id\`),
            KEY \`idx_expense_report_proyecto\` (\`proyecto_id\`)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        await connection.query(`
          CREATE TABLE IF NOT EXISTS \`expense_items\` (
            \`id\` VARCHAR(64) NOT NULL,
            \`expense_report_id\` VARCHAR(64) NOT NULL,
            \`empresa_id\` VARCHAR(64) NOT NULL,
            \`fecha\` DATE NOT NULL,
            \`tipo_documento\` VARCHAR(50) NOT NULL,
            \`folio_documento\` VARCHAR(100) NOT NULL,
            \`proveedor_rut\` VARCHAR(20) NOT NULL,
            \`proveedor_razon_social\` VARCHAR(255) NOT NULL,
            \`categoria\` VARCHAR(50) NOT NULL,
            \`descripcion_glosa\` VARCHAR(255) NOT NULL,
            \`monto_neto\` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
            \`monto_iva\` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
            \`monto_exento\` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
            \`monto_total_clp\` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
            \`moneda_original\` VARCHAR(10) NOT NULL DEFAULT 'CLP',
            \`monto_original\` DECIMAL(15, 2) NULL,
            \`tipo_cambio\` DECIMAL(12, 4) NOT NULL DEFAULT 1.0000,
            \`centro_costo_id\` VARCHAR(64) NULL,
            \`centro_costo_codigo\` VARCHAR(50) NULL,
            \`proyecto_id\` VARCHAR(64) NULL,
            \`proyecto_codigo\` VARCHAR(50) NULL,
            \`cuenta_contable_codigo\` VARCHAR(50) NOT NULL,
            \`cuenta_contable_nombre\` VARCHAR(150) NULL,
            \`comprobante_archivo_nombre\` VARCHAR(255) NULL,
            \`comprobante_url\` TEXT NULL,
            \`comprobante_preview_base64\` MEDIUMTEXT NULL,
            \`es_gasto_rechazado_art21\` BOOLEAN NOT NULL DEFAULT FALSE,
            \`validado_por_agente\` BOOLEAN NOT NULL DEFAULT TRUE,
            \`observacion_agente\` VARCHAR(255) NULL,
            \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
            PRIMARY KEY (\`id\`),
            KEY \`idx_expense_item_report\` (\`expense_report_id\`),
            KEY \`idx_expense_item_empresa_fecha\` (\`empresa_id\`, \`fecha\`),
            KEY \`idx_expense_item_proveedor\` (\`proveedor_rut\`),
            KEY \`idx_expense_item_cuenta\` (\`cuenta_contable_codigo\`),
            CONSTRAINT \`fk_expense_item_report\` FOREIGN KEY (\`expense_report_id\`) REFERENCES \`expense_reports\` (\`id\`) ON DELETE CASCADE
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('[MySQL 8.0] Tablas expense_projects, expense_reports y expense_items inicializadas con éxito.');
      } else {
        // Auto-reparación defensiva: asegurar VARCHAR(64) en tablas existentes
        try {
          await connection.query("ALTER TABLE \`expense_reports\` MODIFY COLUMN \`id\` VARCHAR(64) NOT NULL;");
          await connection.query("ALTER TABLE \`expense_reports\` MODIFY COLUMN \`empresa_id\` VARCHAR(64) NOT NULL;");
          await connection.query("ALTER TABLE \`expense_reports\` MODIFY COLUMN \`rendidor_id\` VARCHAR(64) NULL;");
          await connection.query("ALTER TABLE \`expense_reports\` MODIFY COLUMN \`centro_costo_id\` VARCHAR(64) NULL;");
          await connection.query("ALTER TABLE \`expense_reports\` MODIFY COLUMN \`proyecto_id\` VARCHAR(64) NULL;");
          await connection.query("ALTER TABLE \`expense_reports\` MODIFY COLUMN \`asiento_contable_id\` VARCHAR(64) NULL;");
          await connection.query("ALTER TABLE \`expense_items\` MODIFY COLUMN \`id\` VARCHAR(64) NOT NULL;");
          await connection.query("ALTER TABLE \`expense_items\` MODIFY COLUMN \`expense_report_id\` VARCHAR(64) NOT NULL;");
          await connection.query("ALTER TABLE \`expense_items\` MODIFY COLUMN \`empresa_id\` VARCHAR(64) NOT NULL;");
          await connection.query("ALTER TABLE \`expense_items\` MODIFY COLUMN \`centro_costo_id\` VARCHAR(64) NULL;");
          await connection.query("ALTER TABLE \`expense_items\` MODIFY COLUMN \`proyecto_id\` VARCHAR(64) NULL;");
          await connection.query("ALTER TABLE \`expense_projects\` MODIFY COLUMN \`id\` VARCHAR(64) NOT NULL;");
          await connection.query("ALTER TABLE \`expense_projects\` MODIFY COLUMN \`empresa_id\` VARCHAR(64) NOT NULL;");
        } catch (alterColErr: any) {
          // Si las tablas no existían o ya tienen el tipo correcto
        }
      }

      // Comprobar e insertar semillas si la tabla expense_reports está vacía
      try {
        const [repCount]: [any[], any] = await connection.query("SELECT COUNT(*) as cnt FROM `expense_reports`;");
        // Datos de ejemplo de rendiciones: solo con DEMO_MODE=true (antes se insertaban en cualquier base vacía como "datos reales")
        if ((!repCount || repCount[0]?.cnt === 0) && isDemoModeEnabled()) {
          console.log('[MySQL 8.0] DEMO_MODE: insertando rendiciones de ejemplo de la empresa de demostración...');
          await connection.query(`
            INSERT IGNORE INTO \`expense_projects\` (\`id\`, \`empresa_id\`, \`codigo\`, \`nombre\`, \`cliente_nombre\`, \`presupuesto_total_clp\`, \`activo\`, \`descripcion\`, \`created_at\`)
            VALUES
            ('pry-01', 'client-retail-01', 'PRY-QUELLON-26', 'Mantención Mayor Redes y Jaulas Balsas Quellón', 'Salmones Antártica S.A.', 45000000.00, TRUE, 'Servicio integral de instalación de fondeos y redes loberas.', NOW()),
            ('pry-02', 'client-retail-01', 'PRY-STGO-EXP', 'Expansión Comercial & Distribución Retail Santiago', 'Cencosud / Walmart Chile', 25000000.00, TRUE, 'Apertura de nuevos canales de congelados y mariscos en cadenas de supermercados.', NOW()),
            ('pry-03', 'client-retail-01', 'PRY-LOG-FLOTA', 'Habilitación Barcazas y Motores Fuera de Borda', 'Interno Flota Austral', 18000000.00, TRUE, 'Overhaul mecánico preventivo de barcazas Don Víctor y Mar Austral II.', NOW());
          `);
          await connection.query(`
            INSERT IGNORE INTO \`expense_reports\` (
              \`id\`, \`empresa_id\`, \`folio\`, \`titulo\`, \`rendidor_id\`, \`rendidor_nombre\`, \`rendidor_rut\`, \`rendidor_email\`, \`rendidor_cargo\`,
              \`centro_costo_id\`, \`centro_costo_codigo\`, \`centro_costo_nombre\`, \`proyecto_id\`, \`proyecto_codigo\`, \`proyecto_nombre\`,
              \`fondo_asignado_clp\`, \`monto_total_rendido_clp\`, \`saldo_reembolsar_clp\`, \`saldo_reintegrar_clp\`, \`moneda\`, \`estado\`,
              \`fecha_inicio\`, \`fecha_cierre\`, \`fecha_aprobacion\`, \`aprobador_nombre\`, \`agente_auditor_score\`, \`agente_auditor_diagnostico\`, \`created_at\`
            )
            VALUES
            (
              'rdg-001', 'client-retail-01', 'RDG-2026-001', 'Visita Técnica Clientes Salmoaustral y Supervisión Centro Dalcahue',
              'emp-001', 'Gonzalo Silva Valenzuela', '14.238.192-8', 'gonzalo.silva@maraustral.cl', 'Supervisor Comercial & Operaciones',
              'cc-02', 'CC-VTA-STGO', 'Ventas & Distribución Zona Central', 'pry-01', 'PRY-QUELLON-26', 'Mantención Mayor Redes y Jaulas Balsas Quellón',
              150000.00, 184500.00, 34500.00, 0.00, 'CLP', 'PENDIENTE_APROBACION',
              '2026-09-24', '2026-09-28', NULL, 'Carla Morales Troncoso', 95,
              '{"calificacion": "APROBADO_LIMPIO", "scoreGlobal": 95, "totalComprobantesValidos": 4, "totalComprobantesObjetados": 0, "montoIvaCreditoRecuperable": 16150, "montoGastoRechazadoArt21": 0, "alertas": [], "recomendaciones": ["Gasto de combustible rendido con boleta. Se sugiere solicitar Factura para recuperar IVA Crédito."], "verificacionRutDuplicados": true, "resumenTributario": "Comprobantes íntegros con respaldo fidedigno Art. 31 LIR. Saldo a reembolsar: $34.500 CLP."}',
              NOW()
            ),
            (
              'rdg-002', 'client-retail-01', 'RDG-2026-002', 'Adquisición de Insumos y Repuestos Urgentes Maestranza Quellón',
              'emp-002', 'Ing. Rodrigo Cárdenas Soto', '13.914.882-K', 'rodrigo.cardenas@maraustral.cl', 'Jefe de Planta Quellón',
              'cc-03', 'CC-PRD-QUELLON', 'Planta Fabril & Maestranza Quellón', 'pry-01', 'PRY-QUELLON-26', 'Mantención Mayor Redes y Jaulas Balsas Quellón',
              200000.00, 165000.00, 0.00, 35000.00, 'CLP', 'APROBADA',
              '2026-09-15', '2026-09-18', '2026-09-20', 'Carla Morales Troncoso', 100,
              '{"calificacion": "APROBADO_LIMPIO", "scoreGlobal": 100, "totalComprobantesValidos": 2, "totalComprobantesObjetados": 0, "montoIvaCreditoRecuperable": 26345, "montoGastoRechazadoArt21": 0, "alertas": [], "recomendaciones": [], "verificacionRutDuplicados": true, "resumenTributario": "Aprobado por jefatura. El colaborador debe reintegrar $35.000 a la cuenta corriente de la empresa."}',
              NOW()
            );
          `);
          await connection.query(`
            INSERT IGNORE INTO \`expense_items\` (
              \`id\`, \`expense_report_id\`, \`empresa_id\`, \`fecha\`, \`tipo_documento\`, \`folio_documento\`,
              \`proveedor_rut\`, \`proveedor_razon_social\`, \`categoria\`, \`descripcion_glosa\`,
              \`monto_neto\`, \`monto_iva\`, \`monto_exento\`, \`monto_total_clp\`,
              \`centro_costo_id\`, \`centro_costo_codigo\`, \`proyecto_id\`, \`proyecto_codigo\`,
              \`cuenta_contable_codigo\`, \`cuenta_contable_nombre\`, \`es_gasto_rechazado_art21\`, \`validado_por_agente\`, \`created_at\`
            )
            VALUES
            ('item-01', 'rdg-001', 'client-retail-01', '2026-09-25', 'BOLETA_ELECTRONICA', 'B-481920', '99.520.000-7', 'Compañía de Petróleos de Chile COPEC S.A.', 'COMBUSTIBLE', 'Carga de Diesel camioneta terreno traslado Chiloé', 37815.00, 7185.00, 0.00, 45000.00, 'cc-02', 'CC-VTA-STGO', 'pry-01', 'PRY-QUELLON-26', '4.2.01.009', 'Combustibles & Lubricantes', FALSE, TRUE, NOW()),
            ('item-02', 'rdg-001', 'client-retail-01', '2026-09-26', 'FACTURA_ELECTRONICA_33', '91283', '76.128.490-2', 'Hotelera & Turismo del Sur SpA (Hotel Castro)', 'ALOJAMIENTO', 'Hospedaje 2 noches personal técnico en terreno', 85000.00, 16150.00, 0.00, 101150.00, 'cc-02', 'CC-VTA-STGO', 'pry-01', 'PRY-QUELLON-26', '4.2.01.007', 'Alojamiento & Estadía Terreno', FALSE, TRUE, NOW()),
            ('item-03', 'rdg-001', 'client-retail-01', '2026-09-26', 'BOLETA_ELECTRONICA', 'B-12839', '77.819.200-5', 'Restaurante Rincón Chilote Castro', 'ALIMENTACION', 'Cena y almuerzo en terreno durante supervisión', 23824.00, 4526.00, 0.00, 28350.00, 'cc-02', 'CC-VTA-STGO', 'pry-01', 'PRY-QUELLON-26', '4.2.01.006', 'Gastos de Alimentación & Viáticos', FALSE, TRUE, NOW()),
            ('item-04', 'rdg-001', 'client-retail-01', '2026-09-27', 'TICKET_PEAJE', 'TAG-98124', '96.812.390-1', 'Sociedad Concesionaria Ruta del Canal S.A.', 'PEAJES_ESTACIONAMIENTOS', 'Peajes y transbordo canal de Chacao ida y vuelta', 0.00, 0.00, 10000.00, 10000.00, 'cc-02', 'CC-VTA-STGO', 'pry-01', 'PRY-QUELLON-26', '4.2.01.010', 'Peajes & Tag Autopistas', FALSE, TRUE, NOW()),
            ('item-05', 'rdg-002', 'client-retail-01', '2026-09-16', 'FACTURA_ELECTRONICA_33', 'F-78192', '76.992.110-3', 'Ferretería Industrial Austral Ltda.', 'MATERIALES_INSUMOS', 'Pernos de acero inox 316 y electrodos para balsas', 138655.00, 26345.00, 0.00, 165000.00, 'cc-03', 'CC-PRD-QUELLON', 'pry-01', 'PRY-QUELLON-26', '4.1.02.001', 'Materiales Menores & Consumibles', FALSE, TRUE, NOW());
          `);
        }
      } catch (seedErr: any) {
        console.warn(`[MySQL 8.0] Aviso al verificar o insertar semillas de gastos: ${seedErr.message}`);
      }
    } catch (expTableErr: any) {
      console.warn(`[MySQL 8.0] Verificación de tablas expense: ${expTableErr.message}`);
    }

    // Tablas de Gestión Comercial, Aprovisionamiento, RFQ y Adjudicación de Proveedores
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS \`rfq_requests\` (
          \`id\` VARCHAR(64) NOT NULL,
          \`empresa_id\` VARCHAR(64) NOT NULL,
          \`folio_rfq\` VARCHAR(50) NOT NULL,
          \`titulo\` VARCHAR(255) NOT NULL,
          \`fecha_emision\` DATE NOT NULL,
          \`fecha_limite_respuesta\` DATE NOT NULL,
          \`dias_plazo_respuesta\` INT NOT NULL DEFAULT 3,
          \`estado\` VARCHAR(30) NOT NULL DEFAULT 'ENVIADA',
          \`items_json\` JSON NOT NULL,
          \`proveedor_ganador_rut\` VARCHAR(20) NULL,
          \`proveedor_ganador_nombre\` VARCHAR(255) NULL,
          \`orden_compra_generada_id\` VARCHAR(64) NULL,
          \`folio_orden_compra\` VARCHAR(50) NULL,
          \`motivo_adjudicacion\` TEXT NULL,
          \`recomendacion_agente_sr\` TEXT NULL,
          \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          PRIMARY KEY (\`id\`),
          UNIQUE KEY \`uq_rfq_folio_empresa\` (\`empresa_id\`, \`folio_rfq\`),
          KEY \`idx_rfq_empresa_estado\` (\`empresa_id\`, \`estado\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS \`rfq_supplier_responses\` (
          \`id\` VARCHAR(64) NOT NULL,
          \`rfq_id\` VARCHAR(64) NOT NULL,
          \`empresa_id\` VARCHAR(64) NOT NULL,
          \`proveedor_rut\` VARCHAR(20) NOT NULL,
          \`proveedor_razon_social\` VARCHAR(255) NOT NULL,
          \`email_contacto\` VARCHAR(150) NOT NULL,
          \`telefono_contacto\` VARCHAR(50) NULL,
          \`estado_seguimiento\` VARCHAR(40) NOT NULL DEFAULT 'ENVIADA',
          \`fecha_envio\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          \`fecha_lectura\` DATETIME(3) NULL,
          \`fecha_respuesta\` DATETIME(3) NULL,
          \`cantidad_reiteraciones\` INT NOT NULL DEFAULT 0,
          \`ultimo_recordatorio_at\` DATETIME(3) NULL,
          \`monto_neto_ofertado\` DECIMAL(15,2) NULL,
          \`plazo_entrega_dias_ofertado\` INT NULL,
          \`condicion_pago_ofertada\` VARCHAR(100) NULL,
          \`costo_flete_clp\` DECIMAL(15,2) DEFAULT '0.00',
          \`scoring_ponderado_total\` DECIMAL(5,2) NULL,
          \`items_cotizados_json\` JSON NULL,
          \`observaciones_proveedor\` TEXT NULL,
          \`es_oferta_ganadora\` BOOLEAN NOT NULL DEFAULT FALSE,
          \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          PRIMARY KEY (\`id\`),
          KEY \`idx_rfq_supplier\` (\`rfq_id\`, \`proveedor_rut\`),
          KEY \`idx_rfq_supplier_estado\` (\`estado_seguimiento\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS \`purchase_orders\` (
          \`id\` VARCHAR(64) NOT NULL,
          \`empresa_id\` VARCHAR(64) NOT NULL,
          \`folio_oc\` VARCHAR(50) NOT NULL,
          \`rfq_origen_id\` VARCHAR(64) NULL,
          \`proveedor_rut\` VARCHAR(20) NOT NULL,
          \`proveedor_razon_social\` VARCHAR(255) NOT NULL,
          \`fecha_emision\` DATE NOT NULL,
          \`fecha_entrega_pactada\` DATE NOT NULL,
          \`condicion_pago\` VARCHAR(100) NOT NULL DEFAULT 'Crédito 30 días',
          \`items_json\` JSON NOT NULL,
          \`monto_neto\` DECIMAL(15,2) NOT NULL,
          \`monto_iva\` DECIMAL(15,2) NOT NULL,
          \`monto_total\` DECIMAL(15,2) NOT NULL,
          \`estado\` VARCHAR(40) NOT NULL DEFAULT 'EMITIDA',
          \`aprobado_por_agente\` BOOLEAN NOT NULL DEFAULT TRUE,
          \`firma_agente\` VARCHAR(100) DEFAULT 'Esteban Morales (Gerente Comercial & Aprovisionamiento Sr.)',
          \`motivo_generacion\` TEXT NULL,
          \`asiento_contable_ref_id\` VARCHAR(64) NULL,
          \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          PRIMARY KEY (\`id\`),
          UNIQUE KEY \`uq_oc_folio_empresa\` (\`empresa_id\`, \`folio_oc\`),
          KEY \`idx_oc_empresa_fecha\` (\`empresa_id\`, \`fecha_emision\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS \`commercial_quotes\` (
          \`id\` VARCHAR(64) NOT NULL,
          \`empresa_id\` VARCHAR(64) NOT NULL,
          \`folio_cotizacion\` VARCHAR(50) NOT NULL,
          \`cliente_rut\` VARCHAR(20) NOT NULL,
          \`cliente_razon_social\` VARCHAR(255) NOT NULL,
          \`fecha_emision\` DATE NOT NULL,
          \`fecha_vencimiento\` DATE NOT NULL,
          \`validez_dias\` INT NOT NULL DEFAULT 15,
          \`items_json\` JSON NOT NULL,
          \`monto_neto\` DECIMAL(15,2) NOT NULL,
          \`monto_iva\` DECIMAL(15,2) NOT NULL,
          \`monto_total\` DECIMAL(15,2) NOT NULL,
          \`margen_bruto_promedio_porcentaje\` DECIMAL(5,2) NOT NULL,
          \`estado\` VARCHAR(40) NOT NULL DEFAULT 'ENVIADA',
          \`stock_validado\` BOOLEAN NOT NULL DEFAULT TRUE,
          \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          PRIMARY KEY (\`id\`),
          UNIQUE KEY \`uq_cotizacion_folio_empresa\` (\`empresa_id\`, \`folio_cotizacion\`),
          KEY \`idx_cotizacion_cliente\` (\`cliente_rut\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      console.log('[MySQL 8.0] Tablas de Gestión Comercial, Aprovisionamiento, RFQ y Cotizaciones inicializadas.');
    } catch (procErr: any) {
      console.warn(`[MySQL 8.0] Verificación de tablas procurement: ${procErr.message}`);
    }

    // Tablas de CAF / Secuencia Atómica DTE, RRHH Histórico y Gobernanza Agéntica
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS \`dte_caf_sequences\` (
          \`id\` VARCHAR(36) NOT NULL,
          \`empresa_id\` VARCHAR(36) NOT NULL,
          \`tipo_dte\` INT NOT NULL,
          \`ultimo_folio_emitido\` BIGINT NOT NULL DEFAULT 0,
          \`folio_desde\` BIGINT NOT NULL DEFAULT 1,
          \`folio_hasta\` BIGINT NOT NULL DEFAULT 5000,
          \`caf_xml\` MEDIUMTEXT NULL,
          \`fecha_autorizacion\` DATE NULL,
          \`ambiente\` INT DEFAULT 1,
          \`activo\` BOOLEAN NOT NULL DEFAULT TRUE,
          \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
          PRIMARY KEY (\`id\`),
          UNIQUE KEY \`uq_caf_empresa_tipo_ambiente\` (\`empresa_id\`, \`tipo_dte\`, \`ambiente\`),
          KEY \`idx_caf_empresa\` (\`empresa_id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS \`payroll_historical_settlements\` (
          \`id\` VARCHAR(64) NOT NULL,
          \`empresa_id\` VARCHAR(64) NOT NULL,
          \`periodo\` VARCHAR(7) NOT NULL,
          \`trabajador_id\` VARCHAR(64) NOT NULL,
          \`trabajador_rut\` VARCHAR(20) NOT NULL,
          \`trabajador_nombre\` VARCHAR(255) NOT NULL,
          \`cargo\` VARCHAR(150) NULL,
          \`sueldo_base\` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
          \`dias_trabajados\` INT NOT NULL DEFAULT 30,
          \`total_haberes_imponibles\` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
          \`total_haberes_no_imponibles\` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
          \`total_haberes\` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
          \`cotizacion_afp\` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
          \`cotizacion_salud\` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
          \`cotizacion_afc\` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
          \`impuesto_unico_segunda_categoria\` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
          \`otros_descuentos\` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
          \`total_descuentos\` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
          \`alcance_liquido\` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
          \`aporte_patronal_sis\` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
          \`aporte_patronal_mutual\` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
          \`aporte_patronal_afc\` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
          \`aporte_patronal_ley21735\` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
          \`costo_empresa_total\` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
          \`uf_valor\` DECIMAL(10,2) NULL,
          \`utm_valor\` DECIMAL(10,2) NULL,
          \`tope_imponible_afp_uf\` DECIMAL(6,2) NULL,
          \`tope_imponible_afc_uf\` DECIMAL(6,2) NULL,
          \`asiento_contable_ref_id\` VARCHAR(64) NULL,
          \`estado\` VARCHAR(30) NOT NULL DEFAULT 'CERRADA',
          \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          PRIMARY KEY (\`id\`),
          UNIQUE KEY \`uq_payroll_emp_periodo_trab\` (\`empresa_id\`, \`periodo\`, \`trabajador_rut\`),
          KEY \`idx_payroll_empresa_periodo\` (\`empresa_id\`, \`periodo\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS \`payroll_reliquidations\` (
          \`id\` VARCHAR(64) NOT NULL,
          \`empresa_id\` VARCHAR(64) NOT NULL,
          \`trabajador_id\` VARCHAR(64) NOT NULL,
          \`trabajador_rut\` VARCHAR(20) NOT NULL,
          \`trabajador_nombre\` VARCHAR(255) NOT NULL,
          \`periodo_afectado\` VARCHAR(7) NOT NULL,
          \`periodo_pago_reliquidacion\` VARCHAR(7) NOT NULL,
          \`motivo\` VARCHAR(255) NOT NULL,
          \`diferencia_sueldo_base\` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
          \`diferencia_gratificacion\` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
          \`diferencia_horas_extras\` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
          \`diferencia_bonos\` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
          \`diferencia_imponible_total\` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
          \`recalculo_afp\` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
          \`recalculo_salud\` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
          \`recalculo_afc\` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
          \`recalculo_iusc\` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
          \`diferencia_liquida_a_pagar\` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
          \`diferencia_ley21735_empleador\` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
          \`diferencia_sis_empleador\` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
          \`diferencia_mutual_empleador\` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
          \`asiento_ajuste_ref_id\` VARCHAR(64) NULL,
          \`estado\` VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE',
          \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          PRIMARY KEY (\`id\`),
          KEY \`idx_reliq_empresa_periodo\` (\`empresa_id\`, \`periodo_afectado\`),
          KEY \`idx_reliq_trabajador\` (\`trabajador_rut\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS \`hr_climate_surveys\` (
          \`id\` VARCHAR(64) NOT NULL,
          \`empresa_id\` VARCHAR(64) NOT NULL,
          \`periodo\` VARCHAR(7) NOT NULL,
          \`dimension\` VARCHAR(100) NOT NULL,
          \`puntaje_promedio\` DECIMAL(4,2) NOT NULL,
          \`participacion_porcentaje\` DECIMAL(5,2) NOT NULL,
          \`total_encuestados\` INT NOT NULL,
          \`nivel_alerta\` VARCHAR(30) NOT NULL DEFAULT 'NORMAL',
          \`comentarios_destacados\` JSON NULL,
          \`acciones_propuestas_agente\` JSON NULL,
          \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          PRIMARY KEY (\`id\`),
          KEY \`idx_climate_empresa_periodo\` (\`empresa_id\`, \`periodo\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS \`module_agent_approvals\` (
          \`id\` VARCHAR(64) NOT NULL,
          \`empresa_id\` VARCHAR(64) NOT NULL,
          \`modulo\` VARCHAR(50) NOT NULL,
          \`agente_origen_id\` VARCHAR(100) NOT NULL,
          \`agente_origen_nombre\` VARCHAR(150) NOT NULL,
          \`agente_origen_rol\` VARCHAR(150) NOT NULL,
          \`tipo_operacion\` VARCHAR(100) NOT NULL,
          \`entidad_tipo\` VARCHAR(60) NOT NULL,
          \`entidad_id\` VARCHAR(64) NOT NULL,
          \`resumen_operacion\` TEXT NOT NULL,
          \`impacto_financiero_clp\` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
          \`detalles_json\` JSON NULL,
          \`estado\` VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE',
          \`requiere_aprobacion_humana\` BOOLEAN NOT NULL DEFAULT TRUE,
          \`aprobado_por_rut\` VARCHAR(20) NULL,
          \`aprobado_por_nombre\` VARCHAR(255) NULL,
          \`aprobado_por_rol\` VARCHAR(100) NULL,
          \`fecha_decision\` DATETIME(3) NULL,
          \`motivo_rechazo\` TEXT NULL,
          \`ejecutado\` BOOLEAN NOT NULL DEFAULT FALSE,
          \`fecha_ejecucion\` DATETIME(3) NULL,
          \`resultado_ejecucion\` TEXT NULL,
          \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          PRIMARY KEY (\`id\`),
          KEY \`idx_agent_appr_empresa_modulo\` (\`empresa_id\`, \`modulo\`, \`estado\`),
          KEY \`idx_agent_appr_entidad\` (\`entidad_tipo\`, \`entidad_id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      console.log('[MySQL 8.0] Tablas dte_caf_sequences, RRHH histórico y gobernanza agéntica inicializadas.');
    } catch (hrErr: any) {
      console.warn(`[MySQL 8.0] Verificación de tablas caf/rrhh/approvals: ${hrErr.message}`);
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
