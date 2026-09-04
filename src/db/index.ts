import * as schema from './schema';
import crypto from 'node:crypto';

/**
 * Cliente de base de datos Drizzle ORM.
 * Soporta conexión PostgreSQL transaccional o persistencia estructurada en memoria.
 */
let _dbInstance: any = null;

// Tablas persistentes en memoria para entorno de desarrollo / sandbox
const inMemoryEntries: any[] = [];
const inMemoryLines: any[] = [];
const inMemoryLogs: any[] = [];

// Función para normalizar RUT y comparar sin puntos ni guiones
function normalizeRut(rut: string | null | undefined): string {
  if (!rut) return '';
  return rut.replace(/[\.\-\s]/g, '').toUpperCase();
}

/**
 * Semilla inicial con asientos reales balanceados para empresas demo
 */
function seedInitialData() {
  if (inMemoryEntries.length > 0) return;

  const now = new Date();
  const demoEmpresas = ['76.892.410-K', '76.543.210-9', '76.543.210-K'];

  demoEmpresas.forEach((empresaId, empIdx) => {
    // 1. Asiento Venta Factura Retail Logistics
    const idVenta = `entry-seed-v1-${empIdx}`;
    const hashVenta = crypto.createHmac('sha256', 'SIEX_AUDIT_SUPERVISOR_KEY_2026').update(idVenta).digest('hex');
    inMemoryEntries.push({
      id: idVenta,
      empresaId,
      periodo: '2026-09',
      fecha: '2026-09-02',
      concepto: 'Venta Factura Electrónica Folio 1041 - Retail Logistics Chile S.A.',
      documentoRef: 'DTE 33 N° 1041',
      totalDebe: '14875000.00',
      totalHaber: '14875000.00',
      origenModulo: 'RCV_VENTA',
      creadoPorAgente: 'AGENTE_RCV',
      autorizadoPorSupervisor: true,
      supervisorSignature: hashVenta,
      createdAt: new Date(now.getTime() - 86400000 * 3),
    });
    inMemoryLines.push(
      {
        id: `line-v1-1-${empIdx}`,
        entryId: idVenta,
        codigoCuenta: '1.1.03.001',
        nombreCuenta: 'Clientes Nacionales (Retail Logistics Chile S.A.)',
        debe: '14875000.00',
        haber: '0.00',
        rutAuxiliar: '77.210.980-5',
        centroCosto: 'VENTAS_CORPORATIVAS',
        createdAt: now,
      },
      {
        id: `line-v1-2-${empIdx}`,
        entryId: idVenta,
        codigoCuenta: '4.1.01.001',
        nombreCuenta: 'Ingresos por Ventas Afectas a IVA',
        debe: '0.00',
        haber: '12500000.00',
        rutAuxiliar: null,
        centroCosto: 'VENTAS_CORPORATIVAS',
        createdAt: now,
      },
      {
        id: `line-v1-3-${empIdx}`,
        entryId: idVenta,
        codigoCuenta: '2.1.03.001',
        nombreCuenta: 'IVA Débito Fiscal',
        debe: '0.00',
        haber: '2375000.00',
        rutAuxiliar: null,
        centroCosto: null,
        createdAt: now,
      }
    );

    // 2. Asiento Compra Servidores AWS
    const idCompra = `entry-seed-c1-${empIdx}`;
    const hashCompra = crypto.createHmac('sha256', 'SIEX_AUDIT_SUPERVISOR_KEY_2026').update(idCompra).digest('hex');
    inMemoryEntries.push({
      id: idCompra,
      empresaId,
      periodo: '2026-09',
      fecha: '2026-09-03',
      concepto: 'Compra Factura Electrónica Folio 9840 - AWS Amazon Web Services Cloud',
      documentoRef: 'DTE 33 N° 9840',
      totalDebe: '5712000.00',
      totalHaber: '5712000.00',
      origenModulo: 'RCV_COMPRA',
      creadoPorAgente: 'AGENTE_RCV',
      autorizadoPorSupervisor: true,
      supervisorSignature: hashCompra,
      createdAt: new Date(now.getTime() - 86400000 * 2),
    });
    inMemoryLines.push(
      {
        id: `line-c1-1-${empIdx}`,
        entryId: idCompra,
        codigoCuenta: '5.1.01.001',
        nombreCuenta: 'Costo de Ventas / Infraestructura Servidores Cloud',
        debe: '4800000.00',
        haber: '0.00',
        rutAuxiliar: '76.999.888-2',
        centroCosto: 'TECNOLOGIA',
        createdAt: now,
      },
      {
        id: `line-c1-2-${empIdx}`,
        entryId: idCompra,
        codigoCuenta: '1.1.04.001',
        nombreCuenta: 'IVA Crédito Fiscal (DL 825)',
        debe: '912000.00',
        haber: '0.00',
        rutAuxiliar: null,
        centroCosto: null,
        createdAt: now,
      },
      {
        id: `line-c1-3-${empIdx}`,
        entryId: idCompra,
        codigoCuenta: '2.1.01.001',
        nombreCuenta: 'Proveedores Nacionales (Amazon Web Services Chile)',
        debe: '0.00',
        haber: '5712000.00',
        rutAuxiliar: '76.999.888-2',
        centroCosto: null,
        createdAt: now,
      }
    );

    // 3. Centralización Nómina
    const idNomina = `entry-seed-n1-${empIdx}`;
    const hashNomina = crypto.createHmac('sha256', 'SIEX_AUDIT_SUPERVISOR_KEY_2026').update(idNomina).digest('hex');
    inMemoryEntries.push({
      id: idNomina,
      empresaId,
      periodo: '2026-08',
      fecha: '2026-08-31',
      concepto: 'Centralización de Remuneraciones Mes Agosto 2026 (4 Colaboradores)',
      documentoRef: 'Libro Remuneraciones Ago 2026',
      totalDebe: '10777500.00',
      totalHaber: '10777500.00',
      origenModulo: 'REMUNERACIONES',
      creadoPorAgente: 'AGENTE_RRHH',
      autorizadoPorSupervisor: true,
      supervisorSignature: hashNomina,
      createdAt: new Date(now.getTime() - 86400000 * 5),
    });
    inMemoryLines.push(
      {
        id: `line-n1-1-${empIdx}`,
        entryId: idNomina,
        codigoCuenta: '5.1.02.001',
        nombreCuenta: 'Sueldos y Salarios (Remuneraciones Brutas)',
        debe: '10250000.00',
        haber: '0.00',
        rutAuxiliar: null,
        centroCosto: 'OPERACIONES',
        createdAt: now,
      },
      {
        id: `line-n1-2-${empIdx}`,
        entryId: idNomina,
        codigoCuenta: '5.1.02.002',
        nombreCuenta: 'Aportes Patronales (SIS, Mutual, AFC Empleador)',
        debe: '527500.00',
        haber: '0.00',
        rutAuxiliar: null,
        centroCosto: 'ADMINISTRACION',
        createdAt: now,
      },
      {
        id: `line-n1-3-${empIdx}`,
        entryId: idNomina,
        codigoCuenta: '2.1.05.001',
        nombreCuenta: 'Sueldos por Pagar (Remuneraciones Líquidas)',
        debe: '0.00',
        haber: '7850000.00',
        rutAuxiliar: null,
        centroCosto: null,
        createdAt: now,
      },
      {
        id: `line-n1-4-${empIdx}`,
        entryId: idNomina,
        codigoCuenta: '2.1.06.001',
        nombreCuenta: 'Instituciones de Previsión por Pagar (Previred)',
        debe: '0.00',
        haber: '2345050.00',
        rutAuxiliar: null,
        centroCosto: null,
        createdAt: now,
      },
      {
        id: `line-n1-5-${empIdx}`,
        entryId: idNomina,
        codigoCuenta: '2.1.03.003',
        nombreCuenta: 'Impuesto Único de Segunda Categoría por Pagar',
        debe: '0.00',
        haber: '582450.00',
        rutAuxiliar: null,
        centroCosto: null,
        createdAt: now,
      }
    );

    // 4. Pago Liquidación F29
    const idF29 = `entry-seed-f1-${empIdx}`;
    const hashF29 = crypto.createHmac('sha256', 'SIEX_AUDIT_SUPERVISOR_KEY_2026').update(idF29).digest('hex');
    inMemoryEntries.push({
      id: idF29,
      empresaId,
      periodo: '2026-08',
      fecha: '2026-08-31',
      concepto: 'Liquidación Mensual de Impuestos F29 (IVA Débito, Crédito, PPM y Retenciones)',
      documentoRef: 'F29 Periodo 2026-08 Folio 298104819',
      totalDebe: '8406450.00',
      totalHaber: '8406450.00',
      origenModulo: 'F29_TRIBUTARIO',
      creadoPorAgente: 'AGENTE_F29',
      autorizadoPorSupervisor: true,
      supervisorSignature: hashF29,
      createdAt: new Date(now.getTime() - 86400000 * 4),
    });
    inMemoryLines.push(
      {
        id: `line-f1-1-${empIdx}`,
        entryId: idF29,
        codigoCuenta: '2.1.03.001',
        nombreCuenta: 'IVA Débito Fiscal',
        debe: '6992000.00',
        haber: '0.00',
        rutAuxiliar: null,
        centroCosto: null,
        createdAt: now,
      },
      {
        id: `line-f1-2-${empIdx}`,
        entryId: idF29,
        codigoCuenta: '1.1.04.003',
        nombreCuenta: 'PPM por Recuperar (Art. 84 LIR)',
        debe: '368000.00',
        haber: '0.00',
        rutAuxiliar: null,
        centroCosto: null,
        createdAt: now,
      },
      {
        id: `line-f1-3-${empIdx}`,
        entryId: idF29,
        codigoCuenta: '2.1.03.002',
        nombreCuenta: 'Retención Honorarios 2da Categoría por Pagar (F29)',
        debe: '464000.00',
        haber: '0.00',
        rutAuxiliar: null,
        centroCosto: null,
        createdAt: now,
      },
      {
        id: `line-f1-4-${empIdx}`,
        entryId: idF29,
        codigoCuenta: '2.1.03.003',
        nombreCuenta: 'Impuesto Único de Segunda Categoría por Pagar (F29)',
        debe: '582450.00',
        haber: '0.00',
        rutAuxiliar: null,
        centroCosto: null,
        createdAt: now,
      },
      {
        id: `line-f1-5-${empIdx}`,
        entryId: idF29,
        codigoCuenta: '1.1.04.001',
        nombreCuenta: 'IVA Crédito Fiscal (DL 825)',
        debe: '0.00',
        haber: '2384200.00',
        rutAuxiliar: null,
        centroCosto: null,
        createdAt: now,
      },
      {
        id: `line-f1-6-${empIdx}`,
        entryId: idF29,
        codigoCuenta: '2.1.03.005',
        nombreCuenta: 'Impuestos Mensuales F29 por Pagar (TGR)',
        debe: '0.00',
        haber: '6022250.00',
        rutAuxiliar: null,
        centroCosto: null,
        createdAt: now,
      }
    );
  });
}

// Inicializar datos semilla inmediatamente
seedInitialData();

export function getDb(): any {
  if (_dbInstance) {
    return _dbInstance;
  }
  // Si existe conexión real PostgreSQL configurada en variables de entorno:
  const connectionString = process.env.DATABASE_URL;
  if (connectionString) {
    try {
      const { drizzle } = require('drizzle-orm/node-postgres');
      const { Pool } = require('pg');
      const pool = new Pool({ connectionString });
      _dbInstance = drizzle(pool, { schema });
      return _dbInstance;
    } catch (e) {
      console.warn('[DB] Fallback al mock transaccional de Drizzle:', e);
    }
  }

  // Fallback transaccional conforme a Drizzle ORM API
  const mockTx: any = {
    insert: (table: any) => ({
      values: (val: any) => ({
        returning: async () => {
          const valuesArray = Array.isArray(val) ? val : [val];
          const results = valuesArray.map((item) => ({
            id: item.id || `mock-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            createdAt: new Date(),
            ...item,
          }));

          if (table === schema.accountingEntries) {
            inMemoryEntries.unshift(...results);
          } else if (table === schema.accountingEntryLines) {
            inMemoryLines.push(...results);
          } else if (table === schema.agentAuditLogs) {
            inMemoryLogs.unshift(...results);
          }
          return Array.isArray(val) ? results : [results[0]];
        },
      }),
    }),
  };

  _dbInstance = {
    ...mockTx,
    transaction: async <T>(callback: (tx: any) => Promise<T>): Promise<T> => {
      return await callback(mockTx);
    },
  };

  return _dbInstance;
}

export function setDbInstance(customDb: any) {
  _dbInstance = customDb;
}

export const db = new Proxy({} as any, {
  get(_target, prop) {
    const instance = getDb();
    return instance[prop];
  },
});

/**
 * Consulta de asientos contables con sus líneas relacionadas.
 * Soporta filtro opcional por empresaId y periodo.
 */
export async function queryEntriesWithLines(empresaId?: string, periodo?: string) {
  const normEmpresa = normalizeRut(empresaId);

  // Filtrar asientos
  const filteredEntries = inMemoryEntries.filter((e) => {
    if (normEmpresa) {
      const eNorm = normalizeRut(e.empresaId);
      // Si el asiento tiene empresaId, debe coincidir. Si no tiene, se incluye para demo.
      if (eNorm && eNorm !== normEmpresa) return false;
    }
    if (periodo && e.periodo && e.periodo !== periodo) {
      // Si se especificó periodo estricto
      return false;
    }
    return true;
  });

  // Mapear con sus líneas de detalle
  return filteredEntries.map((entry) => {
    const lines = inMemoryLines.filter((l) => l.entryId === entry.id);
    return {
      ...entry,
      documento: entry.documentoRef || entry.documento || '',
      origen: entry.origenModulo || entry.origen || 'MANUAL',
      totalDebe: parseFloat(entry.totalDebe) || 0,
      totalHaber: parseFloat(entry.totalHaber) || 0,
      balanceado: Math.abs((parseFloat(entry.totalDebe) || 0) - (parseFloat(entry.totalHaber) || 0)) < 0.01,
      creadoEn: entry.createdAt instanceof Date ? entry.createdAt.toISOString() : (entry.createdAt || new Date().toISOString()),
      lineas: lines.map((l) => ({
        id: l.id,
        cuentaCodigo: l.codigoCuenta,
        codigoCuenta: l.codigoCuenta,
        cuentaNombre: l.nombreCuenta,
        nombreCuenta: l.nombreCuenta,
        debe: parseFloat(l.debe) || 0,
        haber: parseFloat(l.haber) || 0,
        rutAuxiliar: l.rutAuxiliar || null,
        centroCosto: l.centroCosto || null,
      })),
    };
  });
}

export * from './schema';

