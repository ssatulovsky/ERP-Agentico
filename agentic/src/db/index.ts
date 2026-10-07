import * as schema from './mysqlSchema';
import { getMysqlDb, isRealMysqlConnected } from './mysqlClient';
import { diskPersistence } from '../services/diskPersistenceService';
import { sql, eq, and, desc, inArray } from 'drizzle-orm';

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
 * Soporta filtro opcional por empresaId y periodo, consultando MySQL 8.0 cuando está conectado
 * y respaldando con el almacenamiento local persistente en disco.
 */
export async function queryEntriesWithLines(empresaId?: string, periodo?: string) {
  const normEmpresa = normalizeRut(empresaId);

  // 1. Consulta directa a MySQL 8.0 si está conectado
  if (isRealMysqlConnected) {
    try {
      const dbInstance = getMysqlDb();
      const conditions: any[] = [];
      if (normEmpresa && normEmpresa !== 'TODAS' && normEmpresa !== 'ALL') {
        conditions.push(
          sql`REPLACE(REPLACE(REPLACE(${schema.accountingEntries.empresaId}, '.', ''), '-', ''), ' ', '') = ${normEmpresa}`
        );
      }
      if (periodo && periodo !== 'TODOS' && periodo !== 'ALL') {
        conditions.push(eq(schema.accountingEntries.periodo, periodo));
      }

      const dbEntries = await dbInstance
        .select()
        .from(schema.accountingEntries)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(schema.accountingEntries.fecha), desc(schema.accountingEntries.createdAt));

      if (dbEntries && dbEntries.length > 0) {
        const entryIds = dbEntries.map((e: any) => e.id);
        const dbLines = await dbInstance
          .select()
          .from(schema.accountingEntryLines)
          .where(inArray(schema.accountingEntryLines.entryId, entryIds))
          .orderBy(schema.accountingEntryLines.lineaNumero);

        const linesByEntry = new Map<string, any[]>();
        for (const l of dbLines) {
          if (!linesByEntry.has(l.entryId)) {
            linesByEntry.set(l.entryId, []);
          }
          linesByEntry.get(l.entryId)!.push(l);
        }

        const mappedDbEntries = dbEntries.map((entry: any) => {
          const lines = linesByEntry.get(entry.id) || diskPersistence.getLinesForEntry(entry.id) || [];
          const totalDebe = parseFloat(String(entry.totalDebe)) || 0;
          const totalHaber = parseFloat(String(entry.totalHaber)) || 0;

          return {
            ...entry,
            documento: entry.documentoRef || entry.documento || '',
            documentoRef: entry.documentoRef || '',
            origen: entry.origenModulo || entry.origen || 'MANUAL',
            origenModulo: entry.origenModulo || entry.origen || 'MANUAL',
            totalDebe,
            totalHaber,
            balanceado: Math.abs(totalDebe - totalHaber) < 0.01,
            creadoEn: entry.createdAt instanceof Date ? entry.createdAt.toISOString() : (entry.createdAt || new Date().toISOString()),
            lineas: lines.map((l: any) => ({
              id: l.id,
              cuentaCodigo: l.codigoCuenta,
              codigoCuenta: l.codigoCuenta,
              cuentaNombre: l.nombreCuenta,
              nombreCuenta: l.nombreCuenta,
              debe: parseFloat(String(l.debe)) || 0,
              haber: parseFloat(String(l.haber)) || 0,
              rutAuxiliar: l.rutAuxiliar || null,
              centroCosto: l.centroCosto || null,
              documentoRef: entry.documentoRef || null,
              dteIdAsociado: l.dteIdAsociado || null,
            })),
          };
        });

        // Combinar con asientos en disco no existentes en MySQL (como datos iniciales o de contingencia)
        const diskEntries = diskPersistence.getAccountingEntries();
        const existingIds = new Set(mappedDbEntries.map((e: any) => e.id));
        const extraDiskEntries = diskEntries
          .filter((e: any) => {
            if (existingIds.has(e.id)) return false;
            if (normEmpresa && normEmpresa !== 'TODAS' && normEmpresa !== 'ALL') {
              const eNorm = normalizeRut(e.empresaId);
              if (eNorm && eNorm !== normEmpresa) return false;
            }
            if (periodo && periodo !== 'TODOS' && periodo !== 'ALL' && e.periodo && e.periodo !== periodo) {
              return false;
            }
            return true;
          })
          .map((entry: any) => {
            const lines = diskPersistence.getLinesForEntry(entry.id);
            const totalDebe = parseFloat(String(entry.totalDebe)) || 0;
            const totalHaber = parseFloat(String(entry.totalHaber)) || 0;
            return {
              ...entry,
              documento: entry.documentoRef || entry.documento || '',
              documentoRef: entry.documentoRef || '',
              origen: entry.origenModulo || entry.origen || 'MANUAL',
              origenModulo: entry.origenModulo || entry.origen || 'MANUAL',
              totalDebe,
              totalHaber,
              balanceado: Math.abs(totalDebe - totalHaber) < 0.01,
              creadoEn: entry.createdAt instanceof Date ? entry.createdAt.toISOString() : (entry.createdAt || new Date().toISOString()),
              lineas: lines.map((l: any) => ({
                id: l.id,
                cuentaCodigo: l.codigoCuenta,
                codigoCuenta: l.codigoCuenta,
                cuentaNombre: l.nombreCuenta,
                nombreCuenta: l.nombreCuenta,
                debe: parseFloat(String(l.debe)) || 0,
                haber: parseFloat(String(l.haber)) || 0,
                rutAuxiliar: l.rutAuxiliar || null,
                centroCosto: l.centroCosto || null,
                documentoRef: entry.documentoRef || null,
                dteIdAsociado: l.dteIdAsociado || null,
              })),
            };
          });

        return [...mappedDbEntries, ...extraDiskEntries];
      }
    } catch (mysqlErr: any) {
      console.warn('[queryEntriesWithLines] Advertencia al consultar MySQL, recurriendo a contingencia:', mysqlErr?.message);
    }
  }

  // 2. Almacenamiento en disco / contingencia
  const allEntries = diskPersistence.getAccountingEntries();
  const filteredEntries = allEntries.filter((e) => {
    if (normEmpresa && normEmpresa !== 'TODAS' && normEmpresa !== 'ALL') {
      const eNorm = normalizeRut(e.empresaId);
      if (eNorm && eNorm !== normEmpresa) return false;
    }
    if (periodo && periodo !== 'TODOS' && periodo !== 'ALL' && e.periodo && e.periodo !== periodo) {
      return false;
    }
    return true;
  });

  return filteredEntries.map((entry) => {
    const lines = diskPersistence.getLinesForEntry(entry.id);
    const totalDebe = parseFloat(String(entry.totalDebe)) || 0;
    const totalHaber = parseFloat(String(entry.totalHaber)) || 0;

    return {
      ...entry,
      documento: entry.documentoRef || entry.documento || '',
      documentoRef: entry.documentoRef || '',
      origen: entry.origenModulo || entry.origen || 'MANUAL',
      origenModulo: entry.origenModulo || entry.origen || 'MANUAL',
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
        documentoRef: entry.documentoRef || null,
        dteIdAsociado: l.dteIdAsociado || null,
      })),
    };
  });
}

export * from './mysqlSchema';
