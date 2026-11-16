import { ChartError, getCompanyChartState, saveCompanyChart } from '../services/chartOfAccountsServerService';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import {
  postModuleTransaction,
  getAccountingEntryById,
  listAccountingEntries,
} from '../services/centralizedJournalService';
import { chartOfAccounts, moduleSourceEnumValues } from '../db/schema/accountingLedgerSchema';
import { getMysqlDb, isRealMysqlConnected } from '../db/mysqlClient';
import { diskPersistence } from '../services/diskPersistenceService';
import { requireCompanyAccess } from '../middlewares/authMiddleware';

export const accountingJournalRouter = Router();

accountingJournalRouter.use((req: Request, res: Response, next) => {
  const targetEmpresaId = req.effectiveEmpresaId || (req.query.empresaId as string);

  if (targetEmpresaId) {
    const check = requireCompanyAccess(req, targetEmpresaId);
    if (!check.allowed) {
      return res.status(403).json({
        success: false,
        error: 'ACCESO_DENEGADO_EMPRESA',
        message: check.reason,
      });
    }
  }
  next();
});

const postTransactionSchema = z.object({
  firmId: z.string().min(1, 'firmId requerido'),
  empresaId: z.string().min(1, 'empresaId requerido'),
  periodo: z.string().regex(/^\d{4}-\d{2}$/, 'periodo debe ser AAAA-MM'),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'fecha debe ser AAAA-MM-DD'),
  origenModulo: z.enum(moduleSourceEnumValues),
  documentoRef: z.string().min(1, 'documentoRef requerido'),
  documentoReferencia: z.string().optional(),
  tipoDocumentoRef: z.string().optional(),
  folioDocumentoRef: z.string().optional(),
  glosa: z.string().min(3, 'glosa requerida'),
  agenteNombre: z.string().default('AGENTE_CENTRALIZADOR_IA'),
  traceId: z.string().optional(),
  lineas: z
    .array(
      z.object({
        codigoCuenta: z.string(),
        nombreCuenta: z.string(),
        debe: z.number().nonnegative(),
        haber: z.number().nonnegative(),
        glosa: z.string().optional(),
        rutAuxiliar: z.string().optional(),
        nombreAuxiliar: z.string().optional(),
        centroCosto: z.string().optional(),
        proyecto: z.string().optional(),
        documentoRef: z.string().optional(),
        dteIdAsociado: z.string().optional(),
        tipoDocumentoRef: z.string().optional(),
        folioDocumentoRef: z.string().optional(),
        montoDocumentoRef: z.number().optional(),
        documentoOperacion: z.string().optional(),
        tipoDocumentoOperacion: z.string().optional(),
        documentoConciliacion: z.string().optional(),
        tipoDocumentoConciliacion: z.string().optional(),
        monedaOriginal: z.string().optional(),
        montoMonedaOriginal: z.number().optional(),
        tipoCambio: z.number().optional(),
      })
    )
    .min(2, 'Se requieren al menos 2 líneas para la partida doble'),
});

/**
 * POST /api/accounting/centralize
 * Centraliza una transacción patrimonial de cualquier módulo mediante motor transaccional ACID
 */
accountingJournalRouter.post('/centralize', async (req: Request, res: Response) => {
  try {
    const validated = postTransactionSchema.parse(req.body);
    const result = await postModuleTransaction({
      firmId: validated.firmId,
      empresaId: validated.empresaId,
      periodo: validated.periodo,
      fecha: validated.fecha,
      origenModulo: validated.origenModulo,
      documentoRef: validated.documentoRef,
      documentoReferencia: validated.documentoReferencia,
      tipoDocumentoRef: validated.tipoDocumentoRef,
      folioDocumentoRef: validated.folioDocumentoRef,
      glosa: validated.glosa,
      agenteNombre: validated.agenteNombre,
      traceId: validated.traceId || crypto.randomUUID(),
      lineas: validated.lineas,
    });

    res.status(201).json({
      success: true,
      message: `Asiento contable registrado exitosamente bajo normativa IFRS y Código de Comercio chileno.`,
      data: result,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'VALIDACION_FALLIDA',
        details: error.format(),
      });
    }
    res.status(422).json({
      success: false,
      error: error.message || 'Error en motor de partida doble',
    });
  }
});

/**
 * GET /api/accounting/entries
 * Lista los asientos de libro diario con aislamiento multi-tenant
 */
accountingJournalRouter.get('/entries', async (req: Request, res: Response) => {
  try {
    const firmId = (req.query.firmId as string) || 'firm-001-audicon';
    const empresaId = String(req.effectiveEmpresaId || (req.query.empresaId as string) || '').trim();
    if (!empresaId) return res.status(400).json({ success: false, code: 'MISSING_PARAMS', missingParams: ['empresaId'], error: 'Debe indicar la empresa; no se usa una empresa por defecto.' });
    const periodo = req.query.periodo as string | undefined;

    const entries = await listAccountingEntries(firmId, empresaId, periodo);

    res.json({
      success: true,
      count: entries.length,
      data: entries,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/accounting/entries/:id
 * Retorna el detalle canónico de un asiento con sus líneas ordenadas
 */
accountingJournalRouter.get('/entries/:id', async (req: Request, res: Response) => {
  try {
    const entryData = await getAccountingEntryById(req.params.id);
    if (!entryData) {
      return res.status(404).json({
        success: false,
        error: 'ASIENTO_NO_ENCONTRADO',
      });
    }

    res.json({
      success: true,
      data: entryData,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * K2: rutas heredadas del plan de cuentas. Delegan en el servicio único (/api/companies/:id/chart):
 * sin plan de respaldo (antes devolvían un plan de 25 cuentas con otra codificación) y con las
 * mismas validaciones y protecciones que el editor.
 */
function chartLegacyFail(res: Response, err: any) {
  if (err instanceof ChartError) {
    return res.status(err.status).json({ success: false, error: err.code, code: err.code, errorMessage: err.message, ...(err.details || {}) });
  }
  return res.status(500).json({ success: false, error: err?.message || String(err) });
}

accountingJournalRouter.get('/chart-of-accounts', async (req: Request, res: Response) => {
  const empresaId = String(req.effectiveEmpresaId || (req.query.empresaId as string) || '').trim();
  if (!empresaId) return res.status(400).json({ success: false, code: 'MISSING_PARAMS', missingParams: ['empresaId'], error: 'Debe indicar la empresa; no se usa una empresa por defecto.' });
  const state = getCompanyChartState(empresaId);
  return res.json({ success: true, estado: state.estado, source: 'COMPANY_CHART', data: state.chart });
});

accountingJournalRouter.post('/chart-of-accounts', async (req: Request, res: Response) => {
  const { empresaId, chart } = req.body || {};
  if (!empresaId || !Array.isArray(chart)) {
    return res.status(400).json({ success: false, code: 'MISSING_PARAMS', error: 'empresaId y chart (array) son requeridos' });
  }
  try {
    const state = saveCompanyChart(empresaId, chart, undefined, (req as any).user?.userId);
    return res.json({ success: true, count: state.chart.length });
  } catch (err) {
    return chartLegacyFail(res, err);
  }
});

accountingJournalRouter.put('/chart-of-accounts/account', async (req: Request, res: Response) => {
  const { empresaId, account } = req.body || {};
  if (!empresaId || !account || !account.codigo) {
    return res.status(400).json({ success: false, code: 'MISSING_PARAMS', error: 'empresaId y account con codigo son requeridos' });
  }
  try {
    const current = getCompanyChartState(empresaId).chart;
    const exists = current.some((a: any) => a.codigo === account.codigo);
    const next = exists ? current.map((a: any) => (a.codigo === account.codigo ? { ...a, ...account } : a)) : [...current, account];
    const state = saveCompanyChart(empresaId, next, undefined, (req as any).user?.userId);
    return res.json({ success: true, count: state.chart.length });
  } catch (err) {
    return chartLegacyFail(res, err);
  }
});

/**
 * GET /api/accounting/auxiliaries
 * Obtiene el padrón de auxiliares (Clientes, Proveedores, Honorarios) de una empresa
 */
accountingJournalRouter.get('/auxiliaries', async (req: Request, res: Response) => {
  try {
    const empresaId = String(req.effectiveEmpresaId || (req.query.empresaId as string) || '').trim();
    if (!empresaId) return res.status(400).json({ success: false, code: 'MISSING_PARAMS', missingParams: ['empresaId'], error: 'Debe indicar la empresa; no se usa una empresa por defecto.' });
    const db = getMysqlDb();

    // 1. Revisar persistencia física en disco
    const diskAuxiliaries = diskPersistence.getCompanyAuxiliaries(empresaId);
    if (diskAuxiliaries && Array.isArray(diskAuxiliaries) && diskAuxiliaries.length > 0) {
      return res.json({ success: true, source: 'LOCAL_DISK', count: diskAuxiliaries.length, data: diskAuxiliaries });
    }

    // 2. Si MySQL está conectado, consultar base de datos
    if (isRealMysqlConnected) {
      try {
        const { clientAuxiliariesMaster } = await import('../db/mysqlSchema');
        const rows = await db
          .select()
          .from(clientAuxiliariesMaster)
          .where(eq(clientAuxiliariesMaster.empresaId, empresaId));
        if (rows && rows.length > 0) {
          const mapped = rows.map((r: any) => ({
            id: r.id,
            rut: r.rutCompleto,
            rutCompleto: r.rutCompleto,
            codigoAuxiliar: r.codigoAuxiliar,
            razonSocial: r.razonSocial,
            nombreFantasia: r.nombreFantasia,
            giroComercial: r.giroComercial,
            inactivo: Boolean(r.inactivo),
            telefonoPrincipal: r.telefonoPrincipal,
            emailContacto: r.emailContacto,
            nombreContacto: r.nombreContacto,
            emailDte: r.emailDte,
            direccion: r.direccion,
            region: r.region,
            ciudad: r.ciudad,
            comuna: r.comuna,
            tipo: r.tipoAuxiliar,
            tipoAuxiliar: r.tipoAuxiliar,
            limiteCredito: Number(r.limiteCredito) || 0,
            terminosPago: r.terminosPago,
            vendedor: r.vendedor,
            descuentoPorcentaje: Number(r.descuentoPorcentaje) || 0,
            sucursales: typeof r.sucursales === 'string' ? JSON.parse(r.sucursales) : r.sucursales,
          }));
          diskPersistence.saveCompanyAuxiliaries(empresaId, mapped);
          return res.json({ success: true, source: 'MYSQL_8_0', count: mapped.length, data: mapped });
        }
      } catch (sqlErr: any) {
        console.warn('[AccountingJournalController] Advertencia leyendo clientAuxiliariesMaster:', sqlErr.message);
      }
    }

    // 3. Sin registros: lista vacía. Los auxiliares de ejemplo solo existen en la demostración
    //    (antes cualquier empresa real recibía clientes y proveedores ficticios).
    const { isDemoModeEnabled } = await import('../config/demoMode');
    if (!isDemoModeEnabled()) {
      return res.json({ success: true, empresaId, source: 'SIN_REGISTROS', count: 0, data: [] });
    }
    const { INITIAL_CLIENT_AUXILIARIES } = await import('../data/seedClientAuxiliaries');
    const defaultList = INITIAL_CLIENT_AUXILIARIES.map((a: any) => ({
      id: a.id,
      rut: a.rutCompleto,
      rutCompleto: a.rutCompleto,
      codigoAuxiliar: a.codigoAuxiliar,
      razonSocial: a.razonSocial,
      nombreFantasia: a.nombreFantasia,
      giroComercial: a.giroComercial,
      inactivo: Boolean(a.inactivo),
      telefonoPrincipal: a.telefonoPrincipal,
      emailContacto: a.emailContacto,
      nombreContacto: a.nombreContacto,
      emailDte: a.emailDte,
      direccion: a.direccion,
      region: a.region,
      ciudad: a.ciudad,
      comuna: a.comuna,
      tipo: a.tipoAuxiliar,
      tipoAuxiliar: a.tipoAuxiliar,
      limiteCredito: Number(a.limiteCredito) || 0,
      terminosPago: a.terminosPago,
      vendedor: a.vendedor,
      descuentoPorcentaje: Number(a.descuentoPorcentaje) || 0,
      sucursales: a.sucursales,
    }));

    return res.json({
      success: true,
      empresaId,
      source: 'DEMO',
      count: defaultList.length,
      data: defaultList,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/accounting/auxiliaries
 * Guarda o actualiza el padrón de auxiliares (o un auxiliar individual) de una empresa
 */
accountingJournalRouter.post('/auxiliaries', async (req: Request, res: Response) => {
  try {
    const { empresaId, auxiliaries, auxiliary } = req.body;
    if (!empresaId) {
      return res.status(400).json({ success: false, error: 'empresaId es requerido' });
    }

    let resultList: any[] = [];
    if (Array.isArray(auxiliaries)) {
      diskPersistence.saveCompanyAuxiliaries(empresaId, auxiliaries);
      resultList = auxiliaries;
    } else if (auxiliary && (auxiliary.rut || auxiliary.rutCompleto)) {
      resultList = diskPersistence.addOrUpdateCompanyAuxiliary(empresaId, auxiliary);
    } else {
      return res.status(400).json({ success: false, error: 'Se requiere un arreglo auxiliaries o un objeto auxiliary' });
    }

    return res.json({ success: true, count: resultList.length, data: resultList });
  } catch (error: any) {
    console.error('[AccountingJournalController] Error guardando auxiliares:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/accounting/client-state
 * Obtiene el estado o configuración multi-tenant persistida de una empresa
 */
accountingJournalRouter.get('/client-state', async (req: Request, res: Response) => {
  try {
    const empresaId = (req.query.empresaId as string) || 'default';
    const key = req.query.key as string;
    if (!key) {
      return res.status(400).json({ success: false, error: 'key es requerido' });
    }

    const data = diskPersistence.getClientState(empresaId, key);
    return res.json({ success: true, empresaId, key, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/accounting/client-state
 * Guarda el estado o configuración multi-tenant en el servidor para que todos los usuarios lo compartan
 */
accountingJournalRouter.post('/client-state', async (req: Request, res: Response) => {
  try {
    const { empresaId, key, data } = req.body;
    if (!empresaId || !key) {
      return res.status(400).json({ success: false, error: 'empresaId y key son requeridos' });
    }

    diskPersistence.saveClientState(empresaId, key, data);
    return res.json({ success: true, empresaId, key });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/accounting/chart-groups
 */
accountingJournalRouter.get('/chart-groups', async (req: Request, res: Response) => {
  try {
    const empresaId = String(req.effectiveEmpresaId || (req.query.empresaId as string) || '').trim();
    if (!empresaId) return res.status(400).json({ success: false, code: 'MISSING_PARAMS', missingParams: ['empresaId'], error: 'Debe indicar la empresa; no se usa una empresa por defecto.' });
    return res.json({ success: true, data: getCompanyChartState(empresaId).groups });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/accounting/chart-groups
 */
accountingJournalRouter.post('/chart-groups', async (req: Request, res: Response) => {
  try {
    const { empresaId, groups } = req.body;
    if (!empresaId || !Array.isArray(groups)) {
      return res.status(400).json({ success: false, error: 'empresaId y groups (array) son requeridos' });
    }
    const state = getCompanyChartState(empresaId);
    if (state.estado === 'SIN_PLAN') {
      return res.status(409).json({ success: false, error: 'PLAN_NO_INICIALIZADO', errorMessage: 'Inicialice el plan de cuentas antes de editar sus grupos.' });
    }
    diskPersistence.saveCompanyGroups(state.empresaId, groups);
    return res.json({ success: true, count: groups.length });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/accounting/financial-notes
 */
accountingJournalRouter.get('/financial-notes', async (req: Request, res: Response) => {
  try {
    const empresaId = String(req.effectiveEmpresaId || (req.query.empresaId as string) || '').trim();
    if (!empresaId) return res.status(400).json({ success: false, code: 'MISSING_PARAMS', missingParams: ['empresaId'], error: 'Debe indicar la empresa; no se usa una empresa por defecto.' });
    const notes = diskPersistence.getCompanyFinancialNotes(empresaId);
    return res.json({ success: true, data: notes || [] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/accounting/financial-notes
 */
accountingJournalRouter.post('/financial-notes', async (req: Request, res: Response) => {
  try {
    const { empresaId, notes } = req.body;
    if (!empresaId || !Array.isArray(notes)) {
      return res.status(400).json({ success: false, error: 'empresaId y notes (array) son requeridos' });
    }
    diskPersistence.saveCompanyFinancialNotes(empresaId, notes);
    return res.json({ success: true, count: notes.length });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
