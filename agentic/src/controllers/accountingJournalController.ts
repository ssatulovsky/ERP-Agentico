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

export const accountingJournalRouter = Router();

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
    const empresaId = (req.query.empresaId as string) || '76.892.410-K';
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
 * Plan de cuentas IFRS parametrizado por empresa
 */
accountingJournalRouter.get('/chart-of-accounts', async (req: Request, res: Response) => {
  try {
    const empresaId = (req.query.empresaId as string) || '76.892.410-K';
    const db = getMysqlDb();

    if (isRealMysqlConnected) {
      const accounts = await db
        .select()
        .from(chartOfAccounts)
        .where(eq(chartOfAccounts.empresaId, empresaId));
      return res.json({ success: true, count: accounts.length, data: accounts });
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
      count: standardPlan.length,
      data: standardPlan,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
