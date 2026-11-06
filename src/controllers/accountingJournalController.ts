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
    const empresaId = req.effectiveEmpresaId || (req.query.empresaId as string) || '76.892.410-K';
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
 * GET /api/accounting/chart-of-accounts
 * Plan de cuentas IFRS parametrizado por empresa (Multi-Tenant & Multi-Usuario)
 */
accountingJournalRouter.get('/chart-of-accounts', async (req: Request, res: Response) => {
  try {
    const empresaId = req.effectiveEmpresaId || (req.query.empresaId as string) || '76.892.410-K';
    const db = getMysqlDb();

    // 1. Revisar persistencia física en disco
    const diskAccounts = diskPersistence.getCompanyChart(empresaId);
    if (diskAccounts && Array.isArray(diskAccounts) && diskAccounts.length > 0) {
      return res.json({ success: true, source: 'LOCAL_DISK', count: diskAccounts.length, data: diskAccounts });
    }

    // 2. Si hay MySQL real conectado, buscar en MySQL
    if (isRealMysqlConnected) {
      const accounts = await db
        .select()
        .from(chartOfAccounts)
        .where(eq(chartOfAccounts.empresaId, empresaId));
      if (accounts && accounts.length > 0) {
        diskPersistence.saveCompanyChart(empresaId, accounts);
        return res.json({ success: true, source: 'MYSQL_8_0', count: accounts.length, data: accounts });
      }
    }

    // Plan de cuentas oficial estándar IFRS PYME chileno
    const standardPlan = [
      { codigoCuenta: '1.1.01.001', nombreCuenta: 'Caja Moneda Nacional', clasificacion: 'ACTIVO', aceptaAuxiliar: false },
      { codigoCuenta: '1.1.01.002', nombreCuenta: 'Banco de Chile Cuenta Corriente', clasificacion: 'ACTIVO', aceptaAuxiliar: false },
      { codigoCuenta: '1.1.01.003', nombreCuenta: 'Banco Santander Cuenta Corriente', clasificacion: 'ACTIVO', aceptaAuxiliar: false },
      { codigoCuenta: '1.1.03.001', nombreCuenta: 'Clientes Nacionales', clasificacion: 'ACTIVO', aceptaAuxiliar: true },
      { codigoCuenta: '1.1.05.001', nombreCuenta: 'Existencias y Mercaderías en Bodega', clasificacion: 'ACTIVO', aceptaAuxiliar: true },
      { codigoCuenta: '1.1.07.001', nombreCuenta: 'IVA Crédito Fiscal (19%)', clasificacion: 'ACTIVO', aceptaAuxiliar: false },
      { codigoCuenta: '1.2.01.001', nombreCuenta: 'Activo por Derecho de Uso (IFRS 16 RoU)', clasificacion: 'ACTIVO', aceptaAuxiliar: true },
      { codigoCuenta: '2.1.01.001', nombreCuenta: 'Proveedores Nacionales por Pagar', clasificacion: 'PASIVO', aceptaAuxiliar: true },
      { codigoCuenta: '2.1.02.001', nombreCuenta: 'Honorarios por Pagar', clasificacion: 'PASIVO', aceptaAuxiliar: true },
      { codigoCuenta: '2.1.03.001', nombreCuenta: 'IVA Débito Fiscal (19%)', clasificacion: 'PASIVO', aceptaAuxiliar: false },
      { codigoCuenta: '2.1.03.002', nombreCuenta: 'Retención Impuesto de Segunda Categoría (14.5%)', clasificacion: 'PASIVO', aceptaAuxiliar: false },
      { codigoCuenta: '2.1.03.003', nombreCuenta: 'PPM por Enterar en F29', clasificacion: 'PASIVO', aceptaAuxiliar: false },
      { codigoCuenta: '2.1.04.001', nombreCuenta: 'Remuneraciones por Pagar', clasificacion: 'PASIVO', aceptaAuxiliar: true },
      { codigoCuenta: '2.1.04.002', nombreCuenta: 'Instituciones de Previsión (AFP y Fonasa) por Pagar', clasificacion: 'PASIVO', aceptaAuxiliar: false },
      { codigoCuenta: '2.2.01.001', nombreCuenta: 'Pasivo Financiero por Arrendamiento (IFRS 16)', clasificacion: 'PASIVO', aceptaAuxiliar: true },
      { codigoCuenta: '3.1.01.001', nombreCuenta: 'Capital Social Pagado', clasificacion: 'PATRIMONIO', aceptaAuxiliar: false },
      { codigoCuenta: '3.1.02.001', nombreCuenta: 'Resultados Acumulados', clasificacion: 'PATRIMONIO', aceptaAuxiliar: false },
      { codigoCuenta: '4.1.01.001', nombreCuenta: 'Ingresos por Ventas Facturadas Afectas', clasificacion: 'INGRESOS', aceptaAuxiliar: false },
      { codigoCuenta: '4.1.01.002', nombreCuenta: 'Ingresos por Ventas Facturadas Exentas', clasificacion: 'INGRESOS', aceptaAuxiliar: false },
      { codigoCuenta: '5.1.01.001', nombreCuenta: 'Costo de Ventas (PMP)', clasificacion: 'COSTOS', aceptaAuxiliar: false },
      { codigoCuenta: '6.1.01.001', nombreCuenta: 'Gasto en Sueldos y Salarios', clasificacion: 'GASTOS', aceptaAuxiliar: true },
      { codigoCuenta: '6.1.01.002', nombreCuenta: 'Gasto en Leyes Sociales Empleador (SIS, AFC, Mutual)', clasificacion: 'GASTOS', aceptaAuxiliar: false },
      { codigoCuenta: '6.1.02.001', nombreCuenta: 'Gasto por Servicios de Honorarios', clasificacion: 'GASTOS', aceptaAuxiliar: true },
      { codigoCuenta: '6.1.03.001', nombreCuenta: 'Gasto por Depreciación Derecho de Uso IFRS 16', clasificacion: 'GASTOS', aceptaAuxiliar: false },
      { codigoCuenta: '6.1.04.001', nombreCuenta: 'Gasto Financiero por Intereses IFRS 16', clasificacion: 'GASTOS', aceptaAuxiliar: false },
    ];

    res.json({
      success: true,
      empresaId,
      source: 'STANDARD_FALLBACK',
      count: standardPlan.length,
      data: standardPlan,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/accounting/chart-of-accounts
 * Guarda o actualiza el Plan de Cuentas completo de una empresa
 */
accountingJournalRouter.post('/chart-of-accounts', async (req: Request, res: Response) => {
  try {
    const { empresaId, chart } = req.body;
    if (!empresaId || !Array.isArray(chart)) {
      return res.status(400).json({ success: false, error: 'empresaId y chart (array) son requeridos' });
    }

    // Guardar en persistencia física en disco
    diskPersistence.saveCompanyChart(empresaId, chart);

    // Guardar en MySQL si está conectado
    if (isRealMysqlConnected) {
      try {
        const db = getMysqlDb();
        for (const acc of chart) {
          const accountId = acc.id || `acc-${empresaId}-${acc.codigo}`.replace(/[^a-zA-Z0-9_-]/g, '_');
          const clasif = (acc.tipo === 'ACTIVO' ? 'ACTIVO' : acc.tipo === 'PASIVO' ? 'PASIVO' : acc.tipo === 'PATRIMONIO' ? 'PATRIMONIO' : acc.tipo === 'INGRESO' ? 'INGRESOS' : acc.tipo === 'COSTO' ? 'COSTOS' : 'GASTOS') as any;
          await db.insert(chartOfAccounts).values({
            id: accountId,
            empresaId,
            codigoCuenta: acc.codigo,
            nombreCuenta: acc.nombre,
            clasificacion: clasif,
            aceptaAuxiliar: Boolean(acc.requiereAuxiliarRut),
            manejaMultimoneda: Boolean(acc.manejaMultimoneda),
            monedaCodigo: acc.monedaCodigo || 'CLP',
            requiereDocReferencia: Boolean(acc.requiereDocReferencia),
            esEfectivoEquivalente: Boolean(acc.esEfectivoEquivalente),
            esContracuentaEfectivo: Boolean(acc.esContracuentaEfectivo),
            requiereProyecto: Boolean(acc.requiereProyecto),
            notasExplicativas: acc.notasExplicativas || null,
          }).onDuplicateKeyUpdate({
            set: {
              nombreCuenta: acc.nombre,
              aceptaAuxiliar: Boolean(acc.requiereAuxiliarRut),
              manejaMultimoneda: Boolean(acc.manejaMultimoneda),
              monedaCodigo: acc.monedaCodigo || 'CLP',
              requiereDocReferencia: Boolean(acc.requiereDocReferencia),
              esEfectivoEquivalente: Boolean(acc.esEfectivoEquivalente),
              esContracuentaEfectivo: Boolean(acc.esContracuentaEfectivo),
              requiereProyecto: Boolean(acc.requiereProyecto),
              notasExplicativas: acc.notasExplicativas || null,
            }
          });
        }
      } catch (mysqlErr: any) {
        console.warn('[AccountingJournalController] Advertencia al sincronizar plan en MySQL:', mysqlErr.message);
      }
    }

    return res.json({ success: true, count: chart.length });
  } catch (error: any) {
    console.error('[AccountingJournalController] Error guardando plan de cuentas:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/accounting/chart-of-accounts/account
 * Actualiza una cuenta individual en el Plan de Cuentas de la empresa
 */
accountingJournalRouter.put('/chart-of-accounts/account', async (req: Request, res: Response) => {
  try {
    const { empresaId, account } = req.body;
    if (!empresaId || !account || !account.codigo) {
      return res.status(400).json({ success: false, error: 'empresaId y account con codigo son requeridos' });
    }

    diskPersistence.updateCompanyAccount(empresaId, account);

    if (isRealMysqlConnected) {
      try {
        const db = getMysqlDb();
        const accountId = account.id || `acc-${empresaId}-${account.codigo}`.replace(/[^a-zA-Z0-9_-]/g, '_');
        const clasif = (account.tipo === 'ACTIVO' ? 'ACTIVO' : account.tipo === 'PASIVO' ? 'PASIVO' : account.tipo === 'PATRIMONIO' ? 'PATRIMONIO' : account.tipo === 'INGRESO' ? 'INGRESOS' : account.tipo === 'COSTO' ? 'COSTOS' : 'GASTOS') as any;
        await db.insert(chartOfAccounts).values({
          id: accountId,
          empresaId,
          codigoCuenta: account.codigo,
          nombreCuenta: account.nombre,
          clasificacion: clasif,
          aceptaAuxiliar: Boolean(account.requiereAuxiliarRut),
          manejaMultimoneda: Boolean(account.manejaMultimoneda),
          monedaCodigo: account.monedaCodigo || 'CLP',
          requiereDocReferencia: Boolean(account.requiereDocReferencia),
          esEfectivoEquivalente: Boolean(account.esEfectivoEquivalente),
          esContracuentaEfectivo: Boolean(account.esContracuentaEfectivo),
          requiereProyecto: Boolean(account.requiereProyecto),
          notasExplicativas: account.notasExplicativas || null,
        }).onDuplicateKeyUpdate({
          set: {
            nombreCuenta: account.nombre,
            aceptaAuxiliar: Boolean(account.requiereAuxiliarRut),
            manejaMultimoneda: Boolean(account.manejaMultimoneda),
            monedaCodigo: account.monedaCodigo || 'CLP',
            requiereDocReferencia: Boolean(account.requiereDocReferencia),
            esEfectivoEquivalente: Boolean(account.esEfectivoEquivalente),
            esContracuentaEfectivo: Boolean(account.esContracuentaEfectivo),
            requiereProyecto: Boolean(account.requiereProyecto),
            notasExplicativas: account.notasExplicativas || null,
          }
        });
      } catch (mysqlErr: any) {
        console.warn('[AccountingJournalController] Advertencia al sincronizar cuenta en MySQL:', mysqlErr.message);
      }
    }

    return res.json({ success: true, data: account });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/accounting/auxiliaries
 * Obtiene el padrón de auxiliares (Clientes, Proveedores, Honorarios) de una empresa
 */
accountingJournalRouter.get('/auxiliaries', async (req: Request, res: Response) => {
  try {
    const empresaId = req.effectiveEmpresaId || (req.query.empresaId as string) || '76.892.410-K';
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

    // 3. Semilla predeterminada si no hay registros
    const { INITIAL_CLIENT_AUXILIARIES } = await import('../data/erpMasterConfig');
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
      source: 'STANDARD_FALLBACK',
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
    const empresaId = req.effectiveEmpresaId || (req.query.empresaId as string) || '76.892.410-K';
    const groups = diskPersistence.getCompanyGroups(empresaId);
    return res.json({ success: true, data: groups || [] });
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
    diskPersistence.saveCompanyGroups(empresaId, groups);
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
    const empresaId = req.effectiveEmpresaId || (req.query.empresaId as string) || '76.892.410-K';
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
