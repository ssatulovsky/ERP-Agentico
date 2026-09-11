import * as schema from './mysqlSchema';
import { getMysqlDb, isRealMysqlConnected } from './mysqlClient';
import { diskPersistence } from '../services/diskPersistenceService';

/**
 * Cliente de base de datos Drizzle ORM con persistencia dual MySQL 8.0 y Disco Local.
 */
let _dbInstance: any = null;

// Función para normalizar RUT y comparar sin puntos ni guiones
function normalizeRut(rut: string | null | undefined): string {
  if (!rut) return '';
  return rut.replace(/[\.\-\s]/g, '').toUpperCase();
}

export function getDb(): any {
  if (_dbInstance) {
    return _dbInstance;
  }
  return getMysqlDb();
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
 * Consulta de asientos contables con sus líneas relacionadas y persistencia garantizada.
 * Soporta filtro opcional por empresaId y periodo.
 */
export async function queryEntriesWithLines(empresaId?: string, periodo?: string) {
  const normEmpresa = normalizeRut(empresaId);

  // Obtener asientos desde el almacenamiento persistente en disco / MySQL
  const allEntries = diskPersistence.getAccountingEntries();

  // Filtrar asientos
  const filteredEntries = allEntries.filter((e) => {
    if (normEmpresa) {
      const eNorm = normalizeRut(e.empresaId);
      if (eNorm && eNorm !== normEmpresa) return false;
    }
    if (periodo && e.periodo && e.periodo !== periodo) {
      return false;
    }
    return true;
  });

  // Mapear con sus líneas de detalle
  return filteredEntries.map((entry) => {
    const lines = diskPersistence.getLinesForEntry(entry.id);
    const totalDebe = parseFloat(String(entry.totalDebe)) || 0;
    const totalHaber = parseFloat(String(entry.totalHaber)) || 0;

    return {
      ...entry,
      documento: entry.documentoRef || entry.documento || '',
      origen: entry.origenModulo || entry.origen || 'MANUAL',
      totalDebe,
      totalHaber,
      balanceado: Math.abs(totalDebe - totalHaber) < 0.01,
      creadoEn: entry.createdAt instanceof Date ? entry.createdAt.toISOString() : (entry.createdAt || new Date().toISOString()),
      lineas: lines.map((l) => ({
        id: l.id,
        cuentaCodigo: l.codigoCuenta,
        codigoCuenta: l.codigoCuenta,
        cuentaNombre: l.nombreCuenta,
        nombreCuenta: l.nombreCuenta,
        debe: parseFloat(String(l.debe)) || 0,
        haber: parseFloat(String(l.haber)) || 0,
        rutAuxiliar: l.rutAuxiliar || null,
        centroCosto: l.centroCosto || null,
      })),
    };
  });
}

export * from './mysqlSchema';
