import * as schema from './mysqlSchema';
import { getMysqlDb, isRealMysqlConnected, pool } from './mysqlClient';
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
            documentoReferencia: entry.documentoReferencia || entry.documentoRef || '',
            tipoDocumentoRef: entry.tipoDocumentoRef || null,
            folioDocumentoRef: entry.folioDocumentoRef || null,
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
              glosa: l.glosa || null,
              rutAuxiliar: l.rutAuxiliar || null,
              nombreAuxiliar: l.nombreAuxiliar || null,
              centroCosto: l.centroCosto || null,
              documentoRef: l.documentoRef || entry.documentoRef || null,
              dteIdAsociado: l.dteIdAsociado || null,
              tipoDocumentoRef: l.tipoDocumentoRef || null,
              folioDocumentoRef: l.folioDocumentoRef || null,
              montoDocumentoRef: l.montoDocumentoRef !== undefined && l.montoDocumentoRef !== null ? parseFloat(String(l.montoDocumentoRef)) : null,
              fechaDocumentoRef: l.fechaDocumentoRef || null,
              fechaVencimientoRef: l.fechaVencimientoRef || null,
              documentoOperacion: l.documentoOperacion || null,
              tipoDocumentoOperacion: l.tipoDocumentoOperacion || null,
              fechaDocumentoOperacion: l.fechaDocumentoOperacion || null,
              documentoConciliacion: l.documentoConciliacion || null,
              tipoDocumentoConciliacion: l.tipoDocumentoConciliacion || null,
              monedaOriginal: l.monedaOriginal || null,
              montoMonedaOriginal: l.montoMonedaOriginal !== undefined && l.montoMonedaOriginal !== null ? parseFloat(String(l.montoMonedaOriginal)) : null,
              tipoCambio: l.tipoCambio !== undefined && l.tipoCambio !== null ? parseFloat(String(l.tipoCambio)) : null,
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
              documentoReferencia: entry.documentoReferencia || entry.documentoRef || '',
              tipoDocumentoRef: entry.tipoDocumentoRef || null,
              folioDocumentoRef: entry.folioDocumentoRef || null,
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
                glosa: l.glosa || null,
                rutAuxiliar: l.rutAuxiliar || null,
                nombreAuxiliar: l.nombreAuxiliar || null,
                centroCosto: l.centroCosto || null,
                documentoRef: l.documentoRef || entry.documentoRef || null,
                dteIdAsociado: l.dteIdAsociado || null,
                tipoDocumentoRef: l.tipoDocumentoRef || null,
                folioDocumentoRef: l.folioDocumentoRef || null,
                montoDocumentoRef: l.montoDocumentoRef !== undefined && l.montoDocumentoRef !== null ? parseFloat(String(l.montoDocumentoRef)) : null,
                fechaDocumentoRef: l.fechaDocumentoRef || null,
                fechaVencimientoRef: l.fechaVencimientoRef || null,
                documentoOperacion: l.documentoOperacion || null,
                tipoDocumentoOperacion: l.tipoDocumentoOperacion || null,
                fechaDocumentoOperacion: l.fechaDocumentoOperacion || null,
                documentoConciliacion: l.documentoConciliacion || null,
                tipoDocumentoConciliacion: l.tipoDocumentoConciliacion || null,
                monedaOriginal: l.monedaOriginal || null,
                montoMonedaOriginal: l.montoMonedaOriginal !== undefined && l.montoMonedaOriginal !== null ? parseFloat(String(l.montoMonedaOriginal)) : null,
                tipoCambio: l.tipoCambio !== undefined && l.tipoCambio !== null ? parseFloat(String(l.tipoCambio)) : null,
              })),
            };
          });

        return [...mappedDbEntries, ...extraDiskEntries];
      }
    } catch (mysqlErr: any) {
      console.warn('[queryEntriesWithLines] Advertencia al consultar MySQL:', mysqlErr?.message);
      // Auto-reparación y consulta raw defensiva si MySQL aún no tiene las columnas nuevas (Error 1054 / Unknown column)
      const isMissingCol = 
        mysqlErr?.code === 'ER_BAD_FIELD_ERROR' || 
        mysqlErr?.errno === 1054 || 
        (mysqlErr?.message && mysqlErr.message.includes('Unknown column'));

      if (isMissingCol) {
        try {
          console.log('[queryEntriesWithLines] Discrepancia de columnas detectada. Disparando actualización automática y consulta raw defensiva...');
          // Lanzar auto-migración preventiva de fondo
          import('../scripts/updateMysqlDb')
            .then(m => m.updateMysqlDatabase())
            .catch(e => console.warn('[Auto-Migrate Background]:', e?.message));

          // Consulta raw defensiva que nunca falla por columnas faltantes
          let sqlEntries = 'SELECT * FROM `accounting_entries`';
          const params: any[] = [];
          const whereParts: string[] = [];
          if (normEmpresa && normEmpresa !== 'TODAS' && normEmpresa !== 'ALL') {
            whereParts.push("REPLACE(REPLACE(REPLACE(`empresa_id`, '.', ''), '-', ''), ' ', '') = ?");
            params.push(normEmpresa);
          }
          if (periodo && periodo !== 'TODOS' && periodo !== 'ALL') {
            whereParts.push("`periodo` = ?");
            params.push(periodo);
          }
          if (whereParts.length > 0) {
            sqlEntries += ' WHERE ' + whereParts.join(' AND ');
          }
          sqlEntries += ' ORDER BY `fecha` DESC, `created_at` DESC';

          const [rawEntries]: [any[], any] = await pool.query(sqlEntries, params);
          if (rawEntries && rawEntries.length > 0) {
            const ids = rawEntries.map((e: any) => e.id);
            const placeholders = ids.map(() => '?').join(',');
            const [rawLines]: [any[], any] = await pool.query(
              `SELECT * FROM \`accounting_entry_lines\` WHERE \`entry_id\` IN (${placeholders}) ORDER BY \`linea_numero\` ASC`,
              ids
            );

            const linesMap = new Map<string, any[]>();
            for (const l of rawLines || []) {
              const eid = l.entry_id || l.entryId;
              if (!linesMap.has(eid)) linesMap.set(eid, []);
              linesMap.get(eid)!.push(l);
            }

            return rawEntries.map((e: any) => {
              const lines = linesMap.get(e.id) || [];
              const totalDebe = parseFloat(String(e.total_debe || e.totalDebe || 0)) || 0;
              const totalHaber = parseFloat(String(e.total_haber || e.totalHaber || 0)) || 0;
              return {
                id: e.id,
                empresaId: e.empresa_id || e.empresaId,
                periodo: e.periodo,
                fecha: e.fecha,
                concepto: e.concepto,
                documento: e.documento_ref || e.documentoRef || e.documento || '',
                documentoRef: e.documento_ref || e.documentoRef || '',
                documentoReferencia: e.documento_referencia || e.documentoReferencia || e.documento_ref || '',
                tipoDocumentoRef: e.tipo_documento_ref || e.tipoDocumentoRef || null,
                folioDocumentoRef: e.folio_documento_ref || e.folioDocumentoRef || null,
                origen: e.origen_modulo || e.origenModulo || e.origen || 'MANUAL',
                origenModulo: e.origen_modulo || e.origenModulo || e.origen || 'MANUAL',
                totalDebe,
                totalHaber,
                balanceado: Math.abs(totalDebe - totalHaber) < 0.01,
                creadoEn: e.created_at || e.createdAt || new Date().toISOString(),
                lineas: lines.map((l: any) => ({
                  id: l.id,
                  cuentaCodigo: l.codigo_cuenta || l.codigoCuenta,
                  codigoCuenta: l.codigo_cuenta || l.codigoCuenta,
                  cuentaNombre: l.nombre_cuenta || l.nombreCuenta,
                  nombreCuenta: l.nombre_cuenta || l.nombreCuenta,
                  debe: parseFloat(String(l.debe || 0)) || 0,
                  haber: parseFloat(String(l.haber || 0)) || 0,
                  glosa: l.glosa || null,
                  rutAuxiliar: l.rut_auxiliar || l.rutAuxiliar || null,
                  nombreAuxiliar: l.nombre_auxiliar || l.nombreAuxiliar || null,
                  centroCosto: l.centro_costo || l.centroCosto || null,
                  documentoRef: l.documento_ref || l.documentoRef || null,
                  dteIdAsociado: l.dte_id_asociado || l.dteIdAsociado || null,
                  tipoDocumentoRef: l.tipo_documento_ref || l.tipoDocumentoRef || null,
                  folioDocumentoRef: l.folio_documento_ref || l.folioDocumentoRef || null,
                  montoDocumentoRef: l.monto_documento_ref !== undefined && l.monto_documento_ref !== null ? parseFloat(String(l.monto_documento_ref)) : null,
                  fechaDocumentoRef: l.fecha_documento_ref || l.fechaDocumentoRef || null,
                  fechaVencimientoRef: l.fecha_vencimiento_ref || l.fechaVencimientoRef || null,
                  documentoOperacion: l.documento_operacion || l.documentoOperacion || null,
                  tipoDocumentoOperacion: l.tipo_documento_operacion || l.tipoDocumentoOperacion || null,
                  fechaDocumentoOperacion: l.fecha_documento_operacion || l.fechaDocumentoOperacion || null,
                  documentoConciliacion: l.documento_conciliacion || l.documentoConciliacion || null,
                  tipoDocumentoConciliacion: l.tipo_documento_conciliacion || l.tipoDocumentoConciliacion || null,
                  monedaOriginal: l.moneda_original || l.monedaOriginal || null,
                  montoMonedaOriginal: l.monto_moneda_original !== undefined && l.monto_moneda_original !== null ? parseFloat(String(l.monto_moneda_original)) : null,
                  tipoCambio: l.tipo_cambio !== undefined && l.tipo_cambio !== null ? parseFloat(String(l.tipo_cambio)) : null,
                })),
              };
            });
          }
        } catch (rawFallbackErr: any) {
          console.warn('[queryEntriesWithLines] Consulta defensiva raw falló:', rawFallbackErr?.message);
        }
      }
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
      documentoReferencia: entry.documentoReferencia || entry.documentoRef || '',
      tipoDocumentoRef: entry.tipoDocumentoRef || null,
      folioDocumentoRef: entry.folioDocumentoRef || null,
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
        documentoRef: l.documentoRef || entry.documentoRef || null,
        dteIdAsociado: l.dteIdAsociado || null,
        tipoDocumentoRef: l.tipoDocumentoRef || null,
        folioDocumentoRef: l.folioDocumentoRef || null,
        monedaOriginal: l.monedaOriginal || null,
        montoMonedaOriginal: l.montoMonedaOriginal !== undefined && l.montoMonedaOriginal !== null ? parseFloat(String(l.montoMonedaOriginal)) : null,
        tipoCambio: l.tipoCambio !== undefined && l.tipoCambio !== null ? parseFloat(String(l.tipoCambio)) : null,
      })),
    };
  });
}

export * from './mysqlSchema';
