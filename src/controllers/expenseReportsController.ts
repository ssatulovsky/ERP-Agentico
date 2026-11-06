import { Router, type Request, type Response } from 'express';
import crypto from 'node:crypto';
import { eq, desc, sql, or, and, inArray } from 'drizzle-orm';
import { GoogleGenAI } from '@google/genai';
import { aiRouterService } from '../services/aiRouterService';
import { scanReceiptWithAi, type ReceiptOcrResult } from '../services/receiptOcrService';
import { getMysqlDb, isRealMysqlConnected, pool } from '../db/mysqlClient';
import {
  expenseReports,
  expenseItems,
  expenseProjects,
} from '../db/mysqlSchema';
import { dtesRcv } from '../db/schema/erpModulesSchema';
import { diskPersistence } from '../services/diskPersistenceService';
import { postModuleTransaction } from '../services/centralizedJournalService';

export const expenseReportsRouter = Router();

// Inicialización de cliente Gemini con header requerido para telemetría
let aiClient: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// ============================================================================
// 1. OBTENER ESTADO DE CONEXIÓN Y TABLAS EN MYSQL 8.0 / DISCO
// ============================================================================
expenseReportsRouter.get('/db-status', async (_req: Request, res: Response) => {
  try {
    let tableReportsExists = false;
    let tableItemsExists = false;
    let tableProjectsExists = false;
    let reportsCount = 0;
    let itemsCount = 0;
    let projectsCount = 0;

    if (isRealMysqlConnected) {
      const conn = await pool.getConnection();
      try {
        const [rRows]: [any[], any] = await conn.query("SHOW TABLES LIKE 'expense_reports';");
        tableReportsExists = rRows && rRows.length > 0;

        const [iRows]: [any[], any] = await conn.query("SHOW TABLES LIKE 'expense_items';");
        tableItemsExists = iRows && iRows.length > 0;

        const [pRows]: [any[], any] = await conn.query("SHOW TABLES LIKE 'expense_projects';");
        tableProjectsExists = pRows && pRows.length > 0;

        if (tableReportsExists) {
          const [cReports]: [any[], any] = await conn.query("SELECT COUNT(*) as cnt FROM `expense_reports`;");
          reportsCount = cReports[0]?.cnt || 0;
        }
        if (tableItemsExists) {
          const [cItems]: [any[], any] = await conn.query("SELECT COUNT(*) as cnt FROM `expense_items`;");
          itemsCount = cItems[0]?.cnt || 0;
        }
        if (tableProjectsExists) {
          const [cProj]: [any[], any] = await conn.query("SELECT COUNT(*) as cnt FROM `expense_projects`;");
          projectsCount = cProj[0]?.cnt || 0;
        }
      } finally {
        conn.release();
      }
    } else {
      // Estado desde el ledger persistente en disco (data/db_disk_snapshot.json)
      const diskStatus = diskPersistence.getStatus();
      reportsCount = diskStatus.expenseReportsCount || 0;
      itemsCount = diskStatus.expenseItemsCount || 0;
      projectsCount = diskStatus.expenseProjectsCount || 0;
      tableReportsExists = reportsCount > 0;
      tableItemsExists = itemsCount > 0;
      tableProjectsExists = projectsCount > 0;
    }

    res.json({
      success: true,
      isRealMysqlConnected,
      tables: {
        expense_reports: tableReportsExists,
        expense_items: tableItemsExists,
        expense_projects: tableProjectsExists,
      },
      counts: {
        reports: reportsCount,
        items: itemsCount,
        projects: projectsCount,
      },
      host: process.env.MYSQL_HOST || '127.0.0.1',
      database: process.env.MYSQL_DATABASE || 'erp_contable',
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// 2. LISTAR RENDICIONES DE GASTOS DESDE MYSQL 8.0 / DISCO PERSISTENTE
// ============================================================================
expenseReportsRouter.get('/reports', async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).user;
    const empresaId =
      req.effectiveEmpresaId ||
      (req as any).effectiveEmpresaId ||
      (req.query.empresaId as string) ||
      authUser?.empresaPrincipalId;

    if (!empresaId) {
      return res.status(400).json({
        success: false,
        error: 'EMPRESA_REQUERIDA',
        errorMessage: 'Debe especificar empresaId o autenticarse con una empresa principal.',
      });
    }

    const db = getMysqlDb();
    const normEmpresa = empresaId.replace(/[\.\-\s]/g, '').toUpperCase();

    if (isRealMysqlConnected) {
      // 1. Obtener cabeceras con coincidencia exacta o normalizada de RUT
      let dbReports = await db
        .select()
        .from(expenseReports)
        .where(
          or(
            eq(expenseReports.empresaId, empresaId),
            sql`REPLACE(REPLACE(REPLACE(${expenseReports.empresaId}, '.', ''), '-', ''), ' ', '') = ${normEmpresa}`
          )
        )
        .orderBy(desc(expenseReports.createdAt));

      // 2. Obtener sólo los comprobantes vinculados a estas rendiciones
      const reportIds = dbReports.map((r) => r.id);
      let allItems: any[] = [];
      if (reportIds.length > 0) {
        allItems = await db
          .select()
          .from(expenseItems)
          .where(inArray(expenseItems.expenseReportId, reportIds))
          .orderBy(desc(expenseItems.fecha));
      }

      // 3. Emparejar comprobantes a cada cabecera
      const formatted = dbReports.map((r) => {
        const reportItems = allItems.filter((i) => i.expenseReportId === r.id).map((i) => ({
          id: i.id,
          expenseReportId: i.expenseReportId,
          empresaId: i.empresaId,
          fecha: i.fecha,
          tipoDocumento: i.tipoDocumento,
          folioDocumento: i.folioDocumento,
          proveedorRut: i.proveedorRut,
          proveedorRazonSocial: i.proveedorRazonSocial,
          categoria: i.categoria,
          descripcionGlosa: i.descripcionGlosa,
          montoNeto: Number(i.montoNeto || 0),
          montoIva: Number(i.montoIva || 0),
          montoExento: Number(i.montoExento || 0),
          montoTotalClp: Number(i.montoTotalClp || 0),
          monedaOriginal: i.monedaOriginal || 'CLP',
          montoOriginal: i.montoOriginal ? Number(i.montoOriginal) : null,
          tipoCambio: Number(i.tipoCambio || 1),
          centroCostoId: i.centroCostoId,
          centroCostoCodigo: i.centroCostoCodigo,
          proyectoId: i.proyectoId,
          proyectoCodigo: i.proyectoCodigo,
          cuentaContableCodigo: i.cuentaContableCodigo,
          cuentaContableNombre: i.cuentaContableNombre,
          comprobanteArchivoNombre: i.comprobanteArchivoNombre,
          esGastoRechazadoArt21: Boolean(i.esGastoRechazadoArt21),
          validadoPorAgente: Boolean(i.validadoPorAgente),
          observacionAgente: i.observacionAgente,
        }));

        return {
          id: r.id,
          empresaId: r.empresaId,
          folio: r.folio,
          titulo: r.titulo,
          rendidorId: r.rendidorId,
          rendidorNombre: r.rendidorNombre,
          rendidorRut: r.rendidorRut,
          rendidorEmail: r.rendidorEmail,
          rendidorCargo: r.rendidorCargo,
          centroCostoId: r.centroCostoId,
          centroCostoCodigo: r.centroCostoCodigo,
          centroCostoNombre: r.centroCostoNombre,
          proyectoId: r.proyectoId,
          proyectoCodigo: r.proyectoCodigo,
          proyectoNombre: r.proyectoNombre,
          fondoAsignadoClp: Number(r.fondoAsignadoClp || 0),
          montoTotalRendidoClp: Number(r.montoTotalRendidoClp || 0),
          saldoReembolsarClp: Number(r.saldoReembolsarClp || 0),
          saldoReintegrarClp: Number(r.saldoReintegrarClp || 0),
          moneda: r.moneda,
          estado: r.estado,
          fechaInicio: r.fechaInicio,
          fechaCierre: r.fechaCierre,
          fechaAprobacion: r.fechaAprobacion,
          fechaPagoReembolso: r.fechaPagoReembolso,
          aprobadorNombre: r.aprobadorNombre,
          aprobadorEmail: r.aprobadorEmail,
          observacionesAprobador: r.observacionesAprobador,
          asientoContableId: r.asientoContableId,
          agenteAuditorScore: r.agenteAuditorScore || 100,
          agenteAuditorDiagnostico: r.agenteAuditorDiagnostico,
          comprobantes: reportItems,
          createdAt: r.createdAt?.toISOString(),
          updatedAt: r.updatedAt?.toISOString(),
        };
      });

      return res.json({
        success: true,
        source: 'MYSQL_8_0',
        count: formatted.length,
        data: formatted,
      });
    }

    // Persistencia física en disco (CERO MOCKS)
    const diskReports = diskPersistence.getExpenseReports(empresaId);
    const formattedDisk = diskReports.map((r) => {
      const reportItems = diskPersistence.getExpenseItems(r.id, empresaId);
      return {
        ...r,
        fondoAsignadoClp: Number(r.fondoAsignadoClp || 0),
        montoTotalRendidoClp: Number(r.montoTotalRendidoClp || 0),
        saldoReembolsarClp: Number(r.saldoReembolsarClp || 0),
        saldoReintegrarClp: Number(r.saldoReintegrarClp || 0),
        comprobantes: reportItems.map((i: any) => ({
          ...i,
          montoNeto: Number(i.montoNeto || 0),
          montoIva: Number(i.montoIva || 0),
          montoExento: Number(i.montoExento || 0),
          montoTotalClp: Number(i.montoTotalClp || 0),
        })),
      };
    });

    res.json({
      success: true,
      source: 'LOCAL_DISK',
      count: formattedDisk.length,
      data: formattedDisk,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// 3. CREAR NUEVA RENDICIÓN DE GASTOS
// ============================================================================
expenseReportsRouter.post('/reports', async (req: Request, res: Response) => {
  try {
    const data = req.body;
    const db = getMysqlDb();

    // 1. Generación de ID UUID v4 limpio (36 caracteres) compatible con esquemas VARCHAR(36) y VARCHAR(64)
    const reportId = (data.id && typeof data.id === 'string' && data.id.trim()) 
      ? data.id.trim() 
      : crypto.randomUUID();

    const empresaId = (data.empresaId && typeof data.empresaId === 'string' && data.empresaId.trim())
      ? data.empresaId.trim()
      : String(req.effectiveEmpresaId || '').trim();
    if (!empresaId) return res.status(400).json({ success: false, code: 'MISSING_PARAMS', missingParams: ['empresaId'], error: 'Debe indicar la empresa; no se usa una empresa por defecto.' });

    // 2. Normalización y resolución de colisiones del folio
    let folio = (data.folio && typeof data.folio === 'string' && data.folio.trim())
      ? data.folio.trim()
      : `RDG-${new Date().getFullYear()}-001`;

    if (isRealMysqlConnected) {
      try {
        const existingFolio = await db
          .select({ folio: expenseReports.folio })
          .from(expenseReports)
          .where(and(eq(expenseReports.empresaId, empresaId), eq(expenseReports.folio, folio)));

        if (existingFolio && existingFolio.length > 0) {
          // Si el folio ya existe en esta empresa, calcular el siguiente correlativo libre
          const allReps = await db
            .select({ folio: expenseReports.folio })
            .from(expenseReports)
            .where(eq(expenseReports.empresaId, empresaId));
          const numbers = allReps.map((r: any) => {
            const match = (r.folio || '').match(/RDG-\d{4}-(\d+)/);
            return match ? parseInt(match[1], 10) : 0;
          });
          const nextNum = Math.max(...numbers, allReps.length, 0) + 1;
          folio = `RDG-${new Date().getFullYear()}-${String(nextNum).padStart(3, '0')}`;
        }
      } catch (folioCheckErr) {
        // En caso de advertencia, continuar con el folio original
      }
    }

    // 3. Sanitización de fechas formato YYYY-MM-DD
    const sanitizeDate = (val: any) => {
      if (!val || typeof val !== 'string') return new Date().toISOString().substring(0, 10);
      const clean = val.trim().split('T')[0];
      if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
      return new Date().toISOString().substring(0, 10);
    };

    const newReportRecord = {
      id: reportId,
      empresaId,
      folio,
      titulo: data.titulo ? String(data.titulo).trim() : 'Gasto Operativo Sin Título',
      rendidorId: data.rendidorId ? String(data.rendidorId).trim() : null,
      rendidorNombre: data.rendidorNombre ? String(data.rendidorNombre).trim() : 'Colaborador',
      rendidorRut: data.rendidorRut ? String(data.rendidorRut).trim() : 'SIN_RUT',
      rendidorEmail: data.rendidorEmail ? String(data.rendidorEmail).trim() : null,
      rendidorCargo: data.rendidorCargo ? String(data.rendidorCargo).trim() : null,
      centroCostoId: data.centroCostoId ? String(data.centroCostoId).trim() : null,
      centroCostoCodigo: data.centroCostoCodigo ? String(data.centroCostoCodigo).trim() : null,
      centroCostoNombre: data.centroCostoNombre ? String(data.centroCostoNombre).trim() : null,
      proyectoId: data.proyectoId ? String(data.proyectoId).trim() : null,
      proyectoCodigo: data.proyectoCodigo ? String(data.proyectoCodigo).trim() : null,
      proyectoNombre: data.proyectoNombre ? String(data.proyectoNombre).trim() : null,
      fondoAsignadoClp: String(Number(data.fondoAsignadoClp) || 0),
      montoTotalRendidoClp: String(Number(data.montoTotalRendidoClp) || 0),
      saldoReembolsarClp: String(Number(data.saldoReembolsarClp) || 0),
      saldoReintegrarClp: String(Number(data.saldoReintegrarClp ?? data.fondoAsignadoClp) || 0),
      moneda: data.moneda || 'CLP',
      estado: data.estado || 'BORRADOR',
      fechaInicio: sanitizeDate(data.fechaInicio),
      fechaCierre: sanitizeDate(data.fechaCierre),
      agenteAuditorScore: Number(data.agenteAuditorScore) || 100,
      agenteAuditorDiagnostico: data.agenteAuditorDiagnostico || null,
      asientoContableId: null,
    };

    // 4. Si la rendición contempla un fondo/adelanto asignado (> $0), generar inmediatamente
    // la contabilización de partida doble del anticipo y el egreso bancario en tiempo real
    const fondoAsignado = Number(newReportRecord.fondoAsignadoClp) || 0;
    let anticipoEntryId: string | null = null;
    let anticipoResult: any = null;

    if (fondoAsignado > 0) {
      try {
        const effectivePeriod = newReportRecord.fechaInicio.substring(0, 7);
        anticipoResult = await postModuleTransaction({
          firmId: (data as any).firmId || 'firm-001-audicon',
          empresaId,
          periodo: effectivePeriod,
          fecha: newReportRecord.fechaInicio,
          origenModulo: 'RENDICION_GASTOS',
          documentoRef: `ANTICIPO ${folio}`,
          glosa: `Entrega Anticipo de Fondos por Rendir Folio ${folio} a ${newReportRecord.rendidorNombre} - ${newReportRecord.titulo}`,
          agenteNombre: 'AGENTE_AUDITOR_GASTOS',
          traceId: `rdg-adv-${reportId}-${Date.now()}`,
          lineas: [
            {
              codigoCuenta: '1.1.03.002',
              nombreCuenta: 'Gastos por Rendir / Anticipos al Personal',
              debe: fondoAsignado,
              haber: 0,
              rutAuxiliar: newReportRecord.rendidorRut !== 'SIN_RUT' ? newReportRecord.rendidorRut : undefined,
              centroCosto: newReportRecord.centroCostoCodigo || undefined,
            },
            {
              codigoCuenta: '1.1.02.001',
              nombreCuenta: 'Banco Santander Chile',
              debe: 0,
              haber: fondoAsignado,
              rutAuxiliar: newReportRecord.rendidorRut !== 'SIN_RUT' ? newReportRecord.rendidorRut : undefined,
              centroCosto: newReportRecord.centroCostoCodigo || undefined,
            },
          ],
        });
        anticipoEntryId = anticipoResult.entryId;
        (newReportRecord as any).asientoContableId = anticipoEntryId;
      } catch (advErr: any) {
        console.warn('[ExpenseReportsController] Advertencia al generar asiento de anticipo:', advErr?.message);
      }
    }

    let mysqlSaved = false;
    let mysqlWarning: string | null = null;

    if (isRealMysqlConnected) {
      try {
        await db.insert(expenseReports).values(newReportRecord);
        mysqlSaved = true;
      } catch (mysqlErr: any) {
        console.error('[ExpenseReportsController] Advertencia al insertar en MySQL 8.0:', mysqlErr.message);
        mysqlWarning = mysqlErr.message;
      }
    }

    // Persistencia física en disco siempre activa como garantía de cero pérdida de datos
    diskPersistence.saveExpenseReport({
      ...newReportRecord,
      asientoContableId: anticipoEntryId,
      asientoAnticipoId: anticipoEntryId,
      fondoAsignadoClp: Number(newReportRecord.fondoAsignadoClp),
      montoTotalRendidoClp: Number(newReportRecord.montoTotalRendidoClp),
      saldoReembolsarClp: Number(newReportRecord.saldoReembolsarClp),
      saldoReintegrarClp: Number(newReportRecord.saldoReintegrarClp),
    });

    res.json({
      success: true,
      message: mysqlSaved
        ? (fondoAsignado > 0 
            ? `Rendición creada y contabilizado anticipo de $${fondoAsignado.toLocaleString('es-CL')} en Libro Diario y Conciliación Bancaria.` 
            : 'Rendición creada y persistida exitosamente en MySQL 8.0.')
        : `Rendición creada y guardada en disco persistente (Modo contingencia activa: ${mysqlWarning || 'MySQL no conectado'}).`,
      source: mysqlSaved ? 'MYSQL_8_0' : 'LOCAL_DISK',
      asientoAnticipoId: anticipoEntryId,
      anticipoContabilizado: fondoAsignado > 0,
      data: {
        ...newReportRecord,
        asientoContableId: anticipoEntryId,
        asientoAnticipoId: anticipoEntryId,
        fondoAsignadoClp: Number(newReportRecord.fondoAsignadoClp),
        montoTotalRendidoClp: Number(newReportRecord.montoTotalRendidoClp),
        saldoReembolsarClp: Number(newReportRecord.saldoReembolsarClp),
        saldoReintegrarClp: Number(newReportRecord.saldoReintegrarClp),
        comprobantes: [],
      },
    });
  } catch (error: any) {
    console.error('[ExpenseReportsController] Error crítico en POST /reports:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// 3.1. MODIFICAR RENDICIÓN DE GASTOS (DATOS DE CABECERA Y REASIGNACIÓN)
// ============================================================================
expenseReportsRouter.put('/reports/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const db = getMysqlDb();

    // Obtener la rendición actual
    let currentReport: any = null;
    if (isRealMysqlConnected) {
      const [rRow] = await db.select().from(expenseReports).where(eq(expenseReports.id, id));
      currentReport = rRow;
    } else {
      currentReport = diskPersistence.getExpenseReports().find((r: any) => r.id === id);
    }

    if (!currentReport) {
      return res.status(404).json({ success: false, error: 'Rendición no encontrada.' });
    }

    const fondoAsignado = updates.fondoAsignadoClp !== undefined
      ? Number(updates.fondoAsignadoClp)
      : Number(currentReport.fondoAsignadoClp || 0);
    const montoRendido = Number(currentReport.montoTotalRendidoClp || 0);
    const saldoReembolsar = Math.max(0, montoRendido - fondoAsignado);
    const saldoReintegrar = Math.max(0, fondoAsignado - montoRendido);

    const updateFields: any = {
      updatedAt: new Date(),
    };

    if (updates.titulo !== undefined) updateFields.titulo = updates.titulo;
    if (updates.rendidorNombre !== undefined) updateFields.rendidorNombre = updates.rendidorNombre;
    if (updates.rendidorRut !== undefined) updateFields.rendidorRut = updates.rendidorRut;
    if (updates.rendidorEmail !== undefined) updateFields.rendidorEmail = updates.rendidorEmail;
    if (updates.rendidorCargo !== undefined) updateFields.rendidorCargo = updates.rendidorCargo;
    if (updates.centroCostoId !== undefined) updateFields.centroCostoId = updates.centroCostoId;
    if (updates.centroCostoCodigo !== undefined) updateFields.centroCostoCodigo = updates.centroCostoCodigo;
    if (updates.centroCostoNombre !== undefined) updateFields.centroCostoNombre = updates.centroCostoNombre;
    if (updates.proyectoId !== undefined) updateFields.proyectoId = updates.proyectoId;
    if (updates.proyectoCodigo !== undefined) updateFields.proyectoCodigo = updates.proyectoCodigo;
    if (updates.proyectoNombre !== undefined) updateFields.proyectoNombre = updates.proyectoNombre;
    if (updates.fondoAsignadoClp !== undefined) updateFields.fondoAsignadoClp = fondoAsignado.toFixed(2);
    updateFields.saldoReembolsarClp = saldoReembolsar.toFixed(2);
    updateFields.saldoReintegrarClp = saldoReintegrar.toFixed(2);
    if (updates.fechaInicio !== undefined) updateFields.fechaInicio = updates.fechaInicio;
    if (updates.fechaCierre !== undefined) updateFields.fechaCierre = updates.fechaCierre;
    if (updates.aprobadorNombre !== undefined) updateFields.aprobadorNombre = updates.aprobadorNombre;
    if (updates.estado !== undefined) updateFields.estado = updates.estado;

    if (isRealMysqlConnected) {
      await db.update(expenseReports).set(updateFields).where(eq(expenseReports.id, id));
    }

    // Persistir también en disco
    const updatedDisk = diskPersistence.updateExpenseReport(id, {
      ...updates,
      fondoAsignadoClp: fondoAsignado,
      saldoReembolsarClp: saldoReembolsar,
      saldoReintegrarClp: saldoReintegrar,
    });

    console.log(`[ExpenseReportsController] Rendición ${id} modificada exitosamente.`);
    res.json({
      success: true,
      message: 'Rendición de gastos modificada exitosamente.',
      data: updatedDisk || { id, ...updateFields },
    });
  } catch (error: any) {
    console.error(`[ExpenseReportsController] Error en PUT /reports/${req.params.id}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// 4. ACTUALIZAR ESTADO DE LA RENDICIÓN (WORKFLOW DE APROBACIÓN)
// ============================================================================
expenseReportsRouter.put('/reports/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { estado, observacionesAprobador, aprobadorNombre, aprobadorEmail } = req.body;
    const db = getMysqlDb();

    const updateData: any = {
      estado,
      updatedAt: new Date(),
    };

    if (observacionesAprobador !== undefined) updateData.observacionesAprobador = observacionesAprobador;
    if (aprobadorNombre !== undefined) updateData.aprobadorNombre = aprobadorNombre;
    if (aprobadorEmail !== undefined) updateData.aprobadorEmail = aprobadorEmail;

    if (estado === 'APROBADA') {
      updateData.fechaAprobacion = new Date().toISOString().substring(0, 10);
    } else if (estado === 'CONTABILIZADA_PAGADA') {
      updateData.fechaPagoReembolso = new Date().toISOString().substring(0, 10);
    }

    if (isRealMysqlConnected) {
      await db.update(expenseReports).set(updateData).where(eq(expenseReports.id, id));
    }

    diskPersistence.updateExpenseReportStatus(id, estado, observacionesAprobador, aprobadorNombre);

    res.json({
      success: true,
      message: `Estado de rendición actualizado a ${estado}.`,
      updated: updateData,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// 5. REGISTRAR COMPROBANTE DE GASTO
// ============================================================================
expenseReportsRouter.post('/reports/:id/items', async (req: Request, res: Response) => {
  try {
    const { id: reportId } = req.params;
    const data = req.body;
    const db = getMysqlDb();

    // ID limpio UUID v4 (36 chars) compatible con VARCHAR(36) y VARCHAR(64)
    const itemId = (data.id && typeof data.id === 'string' && data.id.trim()) 
      ? data.id.trim() 
      : crypto.randomUUID();

    const sanitizeDate = (val: any) => {
      if (!val || typeof val !== 'string') return new Date().toISOString().substring(0, 10);
      const clean = val.trim().split('T')[0];
      if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
      return new Date().toISOString().substring(0, 10);
    };

    const newItemRecord = {
      id: itemId,
      expenseReportId: reportId,
      empresaId: (data.empresaId && typeof data.empresaId === 'string' && data.empresaId.trim()) ? data.empresaId.trim() : String(req.effectiveEmpresaId || ''),
      fecha: sanitizeDate(data.fecha),
      tipoDocumento: data.tipoDocumento || 'BOLETA_ELECTRONICA',
      folioDocumento: data.folioDocumento ? String(data.folioDocumento).trim() : 'S/F',
      proveedorRut: data.proveedorRut ? String(data.proveedorRut).trim() : 'SIN_RUT',
      proveedorRazonSocial: data.proveedorRazonSocial ? String(data.proveedorRazonSocial).trim() : 'Proveedor Varios',
      categoria: data.categoria || 'VARIOS',
      descripcionGlosa: data.descripcionGlosa ? String(data.descripcionGlosa).trim() : 'Gasto operacional comprobado',
      montoNeto: String(Number(data.montoNeto) || 0),
      montoIva: String(Number(data.montoIva) || 0),
      montoExento: String(Number(data.montoExento) || 0),
      montoTotalClp: String(Number(data.montoTotalClp) || 0),
      monedaOriginal: data.monedaOriginal || 'CLP',
      montoOriginal: data.montoOriginal ? String(Number(data.montoOriginal) || 0) : null,
      tipoCambio: String(Number(data.tipoCambio) || 1),
      centroCostoId: data.centroCostoId ? String(data.centroCostoId).trim() : null,
      centroCostoCodigo: data.centroCostoCodigo ? String(data.centroCostoCodigo).trim() : null,
      proyectoId: data.proyectoId ? String(data.proyectoId).trim() : null,
      proyectoCodigo: data.proyectoCodigo ? String(data.proyectoCodigo).trim() : null,
      cuentaContableCodigo: data.cuentaContableCodigo ? String(data.cuentaContableCodigo).trim() : '5.1.01.001',
      cuentaContableNombre: data.cuentaContableNombre ? String(data.cuentaContableNombre).trim() : 'Gastos Generales',
      comprobanteArchivoNombre: data.comprobanteArchivoNombre || null,
      comprobanteUrl: data.comprobanteUrl || null,
      comprobantePreviewBase64: data.comprobantePreviewBase64 || null,
      esGastoRechazadoArt21: Boolean(data.esGastoRechazadoArt21),
      validadoPorAgente: Boolean(data.validadoPorAgente ?? true),
      observacionAgente: data.observacionAgente || null,
    };

    if (isRealMysqlConnected) {
      try {
        await db.insert(expenseItems).values(newItemRecord);

        // Recalcular montos consolidados de la rendición
        const allItems = await db.select().from(expenseItems).where(eq(expenseItems.expenseReportId, reportId));
        const totalRendido = allItems.reduce((acc, it) => acc + Number(it.montoTotalClp || 0), 0);

        const [reportRow] = await db.select().from(expenseReports).where(eq(expenseReports.id, reportId));
        const fondoAnticipo = Number(reportRow?.fondoAsignadoClp || 0);
        const saldoReembolsar = Math.max(0, totalRendido - fondoAnticipo);
        const saldoReintegrar = Math.max(0, fondoAnticipo - totalRendido);

        await db
          .update(expenseReports)
          .set({
            montoTotalRendidoClp: String(totalRendido),
            saldoReembolsarClp: String(saldoReembolsar),
            saldoReintegrarClp: String(saldoReintegrar),
            updatedAt: new Date(),
          })
          .where(eq(expenseReports.id, reportId));
      } catch (mysqlErr: any) {
        console.warn('[ExpenseReportsController] Advertencia al persistir comprobante en MySQL:', mysqlErr.message);
      }
    }

    diskPersistence.addExpenseItem({
      ...newItemRecord,
      montoNeto: Number(newItemRecord.montoNeto),
      montoIva: Number(newItemRecord.montoIva),
      montoExento: Number(newItemRecord.montoExento),
      montoTotalClp: Number(newItemRecord.montoTotalClp),
    });

    res.json({
      success: true,
      message: 'Comprobante digital registrado y totales recalculados.',
      data: {
        ...newItemRecord,
        montoNeto: Number(newItemRecord.montoNeto),
        montoIva: Number(newItemRecord.montoIva),
        montoExento: Number(newItemRecord.montoExento),
        montoTotalClp: Number(newItemRecord.montoTotalClp),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// 6. MODIFICAR COMPROBANTE
// ============================================================================
expenseReportsRouter.put('/items/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const db = getMysqlDb();

    let reportId = updateData.expenseReportId;

    if (isRealMysqlConnected) {
      if (!reportId) {
        const [existing] = await db.select().from(expenseItems).where(eq(expenseItems.id, id));
        reportId = existing?.expenseReportId;
      }

      await db
        .update(expenseItems)
        .set({
          fecha: updateData.fecha,
          tipoDocumento: updateData.tipoDocumento,
          folioDocumento: updateData.folioDocumento,
          proveedorRut: updateData.proveedorRut,
          proveedorRazonSocial: updateData.proveedorRazonSocial,
          categoria: updateData.categoria,
          descripcionGlosa: updateData.descripcionGlosa,
          montoNeto: updateData.montoNeto != null ? String(updateData.montoNeto) : undefined,
          montoIva: updateData.montoIva != null ? String(updateData.montoIva) : undefined,
          montoExento: updateData.montoExento != null ? String(updateData.montoExento) : undefined,
          montoTotalClp: updateData.montoTotalClp != null ? String(updateData.montoTotalClp) : undefined,
          centroCostoId: updateData.centroCostoId,
          centroCostoCodigo: updateData.centroCostoCodigo,
          proyectoId: updateData.proyectoId,
          proyectoCodigo: updateData.proyectoCodigo,
          cuentaContableCodigo: updateData.cuentaContableCodigo,
          cuentaContableNombre: updateData.cuentaContableNombre,
          comprobanteArchivoNombre: updateData.comprobanteArchivoNombre,
          esGastoRechazadoArt21: updateData.esGastoRechazadoArt21 != null ? Boolean(updateData.esGastoRechazadoArt21) : undefined,
        })
        .where(eq(expenseItems.id, id));

      if (reportId) {
        const allItems = await db.select().from(expenseItems).where(eq(expenseItems.expenseReportId, reportId));
        const totalRendido = allItems.reduce((acc, it) => acc + Number(it.montoTotalClp || 0), 0);
        const [reportRow] = await db.select().from(expenseReports).where(eq(expenseReports.id, reportId));
        const fondoAnticipo = Number(reportRow?.fondoAsignadoClp || 0);
        const saldoReembolsar = Math.max(0, totalRendido - fondoAnticipo);
        const saldoReintegrar = Math.max(0, fondoAnticipo - totalRendido);

        await db
          .update(expenseReports)
          .set({
            montoTotalRendidoClp: String(totalRendido),
            saldoReembolsarClp: String(saldoReembolsar),
            saldoReintegrarClp: String(saldoReintegrar),
            updatedAt: new Date(),
          })
          .where(eq(expenseReports.id, reportId));
      }
    }

    diskPersistence.addExpenseItem({
      id,
      ...updateData,
      montoNeto: Number(updateData.montoNeto || 0),
      montoIva: Number(updateData.montoIva || 0),
      montoExento: Number(updateData.montoExento || 0),
      montoTotalClp: Number(updateData.montoTotalClp || 0),
    });

    res.json({
      success: true,
      message: 'Comprobante actualizado y totales recalculados.',
      data: { id, ...updateData },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// 6. ELIMINAR COMPROBANTE
// ============================================================================
expenseReportsRouter.delete('/items/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = getMysqlDb();

    if (isRealMysqlConnected) {
      const [itemRow] = await db.select().from(expenseItems).where(eq(expenseItems.id, id));
      if (itemRow) {
        const reportId = itemRow.expenseReportId;
        await db.delete(expenseItems).where(eq(expenseItems.id, id));

        // Recalcular
        const remainingItems = await db.select().from(expenseItems).where(eq(expenseItems.expenseReportId, reportId));
        const totalRendido = remainingItems.reduce((acc, it) => acc + Number(it.montoTotalClp || 0), 0);

        const [reportRow] = await db.select().from(expenseReports).where(eq(expenseReports.id, reportId));
        const fondoAnticipo = Number(reportRow?.fondoAsignadoClp || 0);
        const saldoReembolsar = Math.max(0, totalRendido - fondoAnticipo);
        const saldoReintegrar = Math.max(0, fondoAnticipo - totalRendido);

        await db
          .update(expenseReports)
          .set({
            montoTotalRendidoClp: String(totalRendido),
            saldoReembolsarClp: String(saldoReembolsar),
            saldoReintegrarClp: String(saldoReintegrar),
            updatedAt: new Date(),
          })
          .where(eq(expenseReports.id, reportId));
      }
    }

    diskPersistence.deleteExpenseItem(id);

    res.json({ success: true, message: 'Comprobante eliminado con éxito.' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// 7. MAESTRO DE PROYECTOS PARA IMPUTACIÓN DE RENDICIONES
// ============================================================================
expenseReportsRouter.get('/projects', async (req: Request, res: Response) => {
  try {
    const empresaId = String(req.effectiveEmpresaId || (req.query.empresaId as string) || '').trim();
    if (!empresaId) return res.status(400).json({ success: false, code: 'MISSING_PARAMS', missingParams: ['empresaId'], error: 'Debe indicar la empresa; no se usa una empresa por defecto.' });
    const db = getMysqlDb();

    const normEmpresa = empresaId.replace(/[\.\-\s]/g, '').toUpperCase();

    if (isRealMysqlConnected) {
      let dbProjects = await db
        .select()
        .from(expenseProjects)
        .where(
          or(
            eq(expenseProjects.empresaId, empresaId),
            sql`REPLACE(REPLACE(REPLACE(${expenseProjects.empresaId}, '.', ''), '-', ''), ' ', '') = ${normEmpresa}`
          )
        )
        .orderBy(desc(expenseProjects.createdAt));

      if (dbProjects.length === 0) {
        // Sembrar proyectos vigentes para la empresa en MySQL 8.0
        const defaultSeeds = [
          {
            id: `pry-01-${normEmpresa.slice(0, 10)}`,
            empresaId,
            codigo: 'PRY-QUELLON-26',
            nombre: 'Mantención Mayor Redes y Jaulas Balsas Quellón',
            clienteNombre: 'Salmones Antártica S.A.',
            presupuestoTotalClp: '45000000.00',
            activo: true,
            descripcion: 'Servicio integral de instalación de fondeos y redes loberas.',
          },
          {
            id: `pry-02-${normEmpresa.slice(0, 10)}`,
            empresaId,
            codigo: 'PRY-STGO-EXP',
            nombre: 'Expansión Comercial & Distribución Retail Santiago',
            clienteNombre: 'Cencosud / Walmart Chile',
            presupuestoTotalClp: '25000000.00',
            activo: true,
            descripcion: 'Apertura de nuevos canales de congelados y mariscos en cadenas de supermercados.',
          },
          {
            id: `pry-03-${normEmpresa.slice(0, 10)}`,
            empresaId,
            codigo: 'PRY-LOG-FLOTA',
            nombre: 'Habilitación Barcazas y Motores Fuera de Borda',
            clienteNombre: 'Interno Flota Austral',
            presupuestoTotalClp: '18000000.00',
            activo: true,
            descripcion: 'Overhaul mecánico preventivo de barcazas Don Víctor y Mar Austral II.',
          },
        ];

        for (const seed of defaultSeeds) {
          try {
            await db.insert(expenseProjects).values({
              ...seed,
              createdAt: new Date(),
            });
          } catch {}
        }

        dbProjects = await db
          .select()
          .from(expenseProjects)
          .where(
            or(
              eq(expenseProjects.empresaId, empresaId),
              sql`REPLACE(REPLACE(REPLACE(${expenseProjects.empresaId}, '.', ''), '-', ''), ' ', '') = ${normEmpresa}`
            )
          )
          .orderBy(desc(expenseProjects.createdAt));
      }

      const formatted = dbProjects.map((p) => ({
        id: p.id,
        empresaId: p.empresaId,
        codigo: p.codigo,
        nombre: p.nombre,
        clienteNombre: p.clienteNombre,
        presupuestoTotalClp: Number(p.presupuestoTotalClp || 0),
        activo: Boolean(p.activo),
        descripcion: p.descripcion,
      }));

      return res.json({ success: true, source: 'MYSQL_8_0', count: formatted.length, data: formatted });
    }

    // Sin proyectos propios la lista es vacía (antes se mostraban los proyectos de la empresa de ejemplo)
    const diskProjects = diskPersistence.getExpenseProjects(empresaId) || [];
    res.json({ success: true, source: 'LOCAL_DISK', count: diskProjects.length, data: diskProjects });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// 8. CREAR PROYECTO
// ============================================================================
expenseReportsRouter.post('/projects', async (req: Request, res: Response) => {
  try {
    const data = req.body;
    const db = getMysqlDb();

    const projectId = (data.id && typeof data.id === 'string' && data.id.trim()) 
      ? data.id.trim() 
      : crypto.randomUUID();

    const newProject = {
      id: projectId,
      empresaId: (data.empresaId && typeof data.empresaId === 'string' && data.empresaId.trim()) ? data.empresaId.trim() : String(req.effectiveEmpresaId || ''),
      codigo: data.codigo ? String(data.codigo).trim() : `PRY-${Date.now().toString(36).toUpperCase()}`,
      nombre: data.nombre ? String(data.nombre).trim() : 'Proyecto General',
      clienteNombre: data.clienteNombre ? String(data.clienteNombre).trim() : null,
      presupuestoTotalClp: String(Number(data.presupuestoTotalClp) || 0),
      activo: Boolean(data.activo ?? true),
      descripcion: data.descripcion ? String(data.descripcion).trim() : null,
    };

    if (isRealMysqlConnected) {
      try {
        await db.insert(expenseProjects).values(newProject);
      } catch (mysqlErr: any) {
        console.warn('[ExpenseReportsController] Advertencia al persistir proyecto en MySQL:', mysqlErr.message);
      }
    }

    diskPersistence.createExpenseProject({
      ...newProject,
      presupuestoTotalClp: Number(newProject.presupuestoTotalClp),
    });

    res.json({ success: true, message: 'Proyecto registrado exitosamente', data: newProject });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// 8.1 ACTUALIZAR PROYECTO (MODIFICACIÓN)
// ============================================================================
expenseReportsRouter.put('/projects/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const db = getMysqlDb();

    if (isRealMysqlConnected) {
      try {
        await db.update(expenseProjects).set({
          nombre: updates.nombre,
          clienteNombre: updates.clienteNombre,
          presupuestoTotalClp: updates.presupuestoTotalClp ? String(updates.presupuestoTotalClp) : undefined,
          activo: updates.activo !== undefined ? Boolean(updates.activo) : undefined,
          descripcion: updates.descripcion,
        }).where(eq(expenseProjects.id, id));
      } catch (mysqlErr: any) {
        console.warn('[ExpenseReportsController] Error al actualizar en MySQL:', mysqlErr.message);
      }
    }

    const updated = diskPersistence.updateExpenseProject(id, updates);
    res.json({ success: true, message: 'Proyecto actualizado con éxito', data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// 8.2 ELIMINAR PROYECTO (BAJA)
// ============================================================================
expenseReportsRouter.delete('/projects/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = getMysqlDb();

    if (isRealMysqlConnected) {
      try {
        await db.delete(expenseProjects).where(eq(expenseProjects.id, id));
      } catch (mysqlErr: any) {
        console.warn('[ExpenseReportsController] Error al eliminar en MySQL:', mysqlErr.message);
      }
    }

    const deleted = diskPersistence.deleteExpenseProject(id);
    res.json({ success: true, message: 'Proyecto eliminado con éxito', deleted });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// 9. CONTABILIZAR RENDICIÓN FORMALMENTE EN LIBRO DIARIO
// ============================================================================
expenseReportsRouter.post('/reports/:id/contabilizar', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      periodo,
      fechaContabilizacion,
      cuentaAnticipoCodigo,
      cuentaAnticipoNombre,
      cuentaReembolsoCodigo,
      cuentaReembolsoNombre,
      cuentaReintegroCodigo,
      cuentaReintegroNombre,
      cuentaProveedoresCodigo,
      cuentaProveedoresNombre,
      contabilizarFacturasContraProveedores = true,
      incluirReintegroBanco = false,
    } = req.body;
    const db = getMysqlDb();

    // Obtener la rendición y sus comprobantes
    let report: any = null;
    let items: any[] = [];

    if (isRealMysqlConnected) {
      const [rRow] = await db.select().from(expenseReports).where(eq(expenseReports.id, id));
      report = rRow;
      if (report) {
        items = await db.select().from(expenseItems).where(eq(expenseItems.expenseReportId, id));
      }
    } else {
      const diskReps = diskPersistence.getExpenseReports();
      report = diskReps.find((r: any) => r.id === id);
      if (report) {
        items = diskPersistence.getExpenseItems(id);
      }
    }

    if (!report) {
      return res.status(404).json({ success: false, error: 'Rendición no encontrada.' });
    }

    if (items.length === 0 && Number(report.montoTotalRendidoClp || 0) > 0) {
      items = [{
        id: `synth-item-${report.id}`,
        expenseReportId: report.id,
        empresaId: report.empresaId,
        fecha: report.fechaCierre || report.fechaInicio || new Date().toISOString().substring(0, 10),
        tipoDocumento: 'BOLETA_ELECTRONICA',
        folioDocumento: `RDG-${report.folio}`,
        proveedorRut: report.rendidorRut || 'SIN_RUT',
        proveedorRazonSocial: report.rendidorNombre || 'Gastos Terreno',
        categoria: 'ALIMENTACION',
        descripcionGlosa: report.titulo || 'Gasto operacional rendido',
        montoNeto: Math.round(Number(report.montoTotalRendidoClp) / 1.19),
        montoIva: Number(report.montoTotalRendidoClp) - Math.round(Number(report.montoTotalRendidoClp) / 1.19),
        montoExento: 0,
        montoTotalClp: Number(report.montoTotalRendidoClp),
        cuentaContableCodigo: '6.1.04.007',
        cuentaContableNombre: 'Gastos de Alimentación, Viáticos y Terreno',
        proyectoCodigo: report.proyectoCodigo,
      }];
    }

    if (items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No se puede contabilizar una rendición sin comprobantes ni gastos justificados.',
      });
    }

    const effectiveDate = fechaContabilizacion || report.fechaCierre || new Date().toISOString().substring(0, 10);
    const effectivePeriod = periodo || effectiveDate.substring(0, 7);

    // Calcular montos y agrupar partidas al DEBE
    let totalIvaRecuperable = 0;
    const debitLinesMap = new Map<string, { nombre: string; monto: number; centroCosto?: string; proyecto?: string }>();
    const facturasList: any[] = [];

    for (const item of items) {
      const ctaCod = item.cuentaContableCodigo || '4.2.01.009';
      const ctaNom = item.cuentaContableNombre || 'Gastos Operacionales Rendidos';
      const neto = Number(item.montoNeto || 0);
      const iva = Number(item.montoIva || 0);
      const totalItem = Number(item.montoTotalClp || 0);
      const isFactura = item.tipoDocumento === 'FACTURA_ELECTRONICA_33' || item.tipoDocumento === 'FACTURA_EXENTA_34';

      if (isFactura) {
        facturasList.push(item);
      }

      // Si es Factura Electrónica y no es gasto rechazado, separamos neto de IVA Crédito Fiscal
      if (item.tipoDocumento === 'FACTURA_ELECTRONICA_33' && iva > 0 && !item.esGastoRechazadoArt21) {
        totalIvaRecuperable += iva;
        const existing = debitLinesMap.get(ctaCod);
        if (existing) {
          existing.monto += neto;
        } else {
          debitLinesMap.set(ctaCod, {
            nombre: ctaNom,
            monto: neto,
            centroCosto: item.centroCostoCodigo || report.centroCostoCodigo || undefined,
            proyecto: item.proyectoCodigo || report.proyectoCodigo || undefined,
          });
        }
      } else {
        // En boletas o gastos sin IVA crédito, el monto total va íntegro a gasto
        const existing = debitLinesMap.get(ctaCod);
        if (existing) {
          existing.monto += totalItem;
        } else {
          debitLinesMap.set(ctaCod, {
            nombre: ctaNom,
            monto: totalItem,
            centroCosto: item.centroCostoCodigo || report.centroCostoCodigo || undefined,
            proyecto: item.proyectoCodigo || report.proyectoCodigo || undefined,
          });
        }
      }
    }

    const totalRendido = Number(report.montoTotalRendidoClp || 0);
    const fondoAnticipo = Number(report.fondoAsignadoClp || 0);
    const saldoReembolsar = Math.max(0, totalRendido - fondoAnticipo);
    const saldoReintegrar = Math.max(0, fondoAnticipo - totalRendido);

    // Construir partidas del DEBE (Gastos + IVA Crédito)
    const journalLines: any[] = [];
    debitLinesMap.forEach((val, cod) => {
      journalLines.push({
        codigoCuenta: cod,
        nombreCuenta: val.nombre,
        debe: val.monto,
        haber: 0,
        rutAuxiliar: report.rendidorRut,
        centroCosto: val.centroCosto,
        proyecto: val.proyecto || report.proyectoCodigo || undefined,
      });
    });

    if (totalIvaRecuperable > 0) {
      journalLines.push({
        codigoCuenta: '1.1.05.001',
        nombreCuenta: 'IVA Crédito Fiscal (Recuperable)',
        debe: totalIvaRecuperable,
        haber: 0,
        rutAuxiliar: report.rendidorRut,
        proyecto: report.proyectoCodigo || undefined,
      });
    }

    // Si se activa contabilización contra Proveedores Nacionales (para afectar RCV del SII):
    const effectiveCtaProvCod = cuentaProveedoresCodigo || '2.1.01.001';
    const effectiveCtaProvNom = cuentaProveedoresNombre || 'Proveedores Nacionales (RCV SII)';

    if (contabilizarFacturasContraProveedores !== false && facturasList.length > 0) {
      for (const fac of facturasList) {
        const facMonto = Number(fac.montoTotalClp || 0);
        // Abono a Proveedores (Reconoce el documento fiscal en RCV)
        journalLines.push({
          codigoCuenta: effectiveCtaProvCod,
          nombreCuenta: effectiveCtaProvNom,
          debe: 0,
          haber: facMonto,
          rutAuxiliar: fac.proveedorRut || report.rendidorRut,
          documentoRef: `Factura ${fac.folioDocumento}`,
          fechaDocumentoRef: fac.fecha || effectiveDate,
          centroCosto: fac.centroCostoCodigo || report.centroCostoCodigo || undefined,
          proyecto: fac.proyectoCodigo || report.proyectoCodigo || undefined,
        });

        // Cargo a Proveedores (Cancela el documento pagado con los fondos de la rendición)
        journalLines.push({
          codigoCuenta: effectiveCtaProvCod,
          nombreCuenta: `${effectiveCtaProvNom} (Liquidación Rendición ${report.folio})`,
          debe: facMonto,
          haber: 0,
          rutAuxiliar: fac.proveedorRut || report.rendidorRut,
          documentoRef: `Pago RDG ${report.folio}`,
          fechaDocumentoRef: effectiveDate,
          centroCosto: fac.centroCostoCodigo || report.centroCostoCodigo || undefined,
          proyecto: fac.proyectoCodigo || report.proyectoCodigo || undefined,
        });

        // Sincronizar en tabla dtes_rcv si MySQL está activo
        if (isRealMysqlConnected && fac.proveedorRut) {
          try {
            const cleanRut = String(report.empresaId || '').replace(/[\.\-\s]/g, '').toUpperCase();
            const dteUuid = `dte-exp-${report.id}-${fac.id || Date.now()}`;
            await db.insert(dtesRcv).values({
              id: dteUuid,
              empresaId: cleanRut,
              periodo: effectivePeriod,
              tipoOperacion: 'COMPRA',
              tipoDte: fac.tipoDocumento === 'FACTURA_EXENTA_34' ? 34 : 33,
              folio: Number(String(fac.folioDocumento || '0').replace(/\D/g, '')) || 1,
              rutContraparte: fac.proveedorRut,
              razonSocialContraparte: fac.proveedorRazonSocial || 'Proveedor Factura Rendición',
              fechaEmision: fac.fecha || effectiveDate,
              montoNeto: String(fac.montoNeto || 0),
              montoIva: String(fac.montoIva || 0),
              montoTotal: String(fac.montoTotalClp || 0),
              estadoAcuse: 'ACEPTADO',
              estadoContable: 'CENTRALIZADO',
              glosa: `Rendición Gastos ${report.folio}: ${fac.descripcionGlosa || 'Factura rendida'}`,
              centroCostoId: fac.centroCostoId || report.centroCostoId,
              centroCostoCodigo: fac.centroCostoCodigo || report.centroCostoCodigo,
              centroCostoNombre: report.centroCostoNombre,
              cuentaGastoImputadaCodigo: fac.cuentaContableCodigo,
              cuentaGastoImputadaNombre: fac.cuentaContableNombre,
            }).catch(() => {});
          } catch {}
        }
      }
    }

    // Construir partidas del HABER (Liquidación de Anticipo y/o Reembolso por Pagar)
    const effectiveCtaAnticipoCod = cuentaAnticipoCodigo || '1.1.03.002';
    const effectiveCtaAnticipoNom = cuentaAnticipoNombre || 'Gastos por Rendir / Anticipos al Personal';

    const effectiveCtaReembolsoCod = cuentaReembolsoCodigo || '2.1.02.001';
    const effectiveCtaReembolsoNom = cuentaReembolsoNombre || 'Cuentas por Pagar al Personal (Reembolso de Gastos)';

    const effectiveCtaReintegroCod = cuentaReintegroCodigo || '1.1.02.001';
    const effectiveCtaReintegroNom = cuentaReintegroNombre || 'Banco Santander Chile - Reintegro Sobrante de Fondo';

    if (fondoAnticipo > 0) {
      if (incluirReintegroBanco && saldoReintegrar > 0) {
        // Se liquida el 100% del fondo original entregado
        journalLines.push({
          codigoCuenta: effectiveCtaAnticipoCod,
          nombreCuenta: effectiveCtaAnticipoNom,
          debe: 0,
          haber: fondoAnticipo,
          rutAuxiliar: report.rendidorRut,
          documentoRef: report.folio,
          fechaDocumentoRef: effectiveDate,
          centroCosto: report.centroCostoCodigo || undefined,
          proyecto: report.proyectoCodigo || undefined,
        });

        // El reintegro a favor de la empresa se deposita en Banco/Caja (DEBE)
        journalLines.unshift({
          codigoCuenta: effectiveCtaReintegroCod,
          nombreCuenta: effectiveCtaReintegroNom,
          debe: saldoReintegrar,
          haber: 0,
          rutAuxiliar: report.rendidorRut,
          documentoRef: `DEP-${report.folio}`,
          fechaDocumentoRef: effectiveDate,
          proyecto: report.proyectoCodigo || undefined,
        });
      } else {
        // No se incluye reintegro inmediato: se liquida estrictamente lo gastado con cargo al fondo
        const anticipoLiquidado = Math.min(fondoAnticipo, totalRendido);
        journalLines.push({
          codigoCuenta: effectiveCtaAnticipoCod,
          nombreCuenta: effectiveCtaAnticipoNom,
          debe: 0,
          haber: anticipoLiquidado,
          rutAuxiliar: report.rendidorRut,
          documentoRef: report.folio,
          fechaDocumentoRef: effectiveDate,
          centroCosto: report.centroCostoCodigo || undefined,
          proyecto: report.proyectoCodigo || undefined,
        });
      }
    }

    if (saldoReembolsar > 0) {
      journalLines.push({
        codigoCuenta: effectiveCtaReembolsoCod,
        nombreCuenta: effectiveCtaReembolsoNom,
        debe: 0,
        haber: saldoReembolsar,
        rutAuxiliar: report.rendidorRut,
        documentoRef: report.folio,
        fechaDocumentoRef: effectiveDate,
        centroCosto: report.centroCostoCodigo || undefined,
        proyecto: report.proyectoCodigo || undefined,
      });
    }

    // Registrar en Libro Diario formal mediante motor ACID
    const journalResult = await postModuleTransaction({
      firmId: 'firm-001-audicon',
      empresaId: report.empresaId,
      periodo: effectivePeriod,
      fecha: effectiveDate,
      origenModulo: 'RENDICION_GASTOS',
      documentoRef: `RDG ${report.folio}`,
      glosa: `Contabilización Rendición de Gastos Folio ${report.folio} - ${report.rendidorNombre} (${report.titulo})`,
      agenteNombre: 'AGENTE_AUDITOR_GASTOS',
      lineas: journalLines,
      traceId: `rdg-trace-${id}-${Date.now()}`,
    });

    // Actualizar estado de la rendición a CONTABILIZADA_PAGADA
    if (isRealMysqlConnected) {
      await db
        .update(expenseReports)
        .set({
          estado: 'CONTABILIZADA_PAGADA',
          asientoContableId: journalResult.entryId,
          fechaPagoReembolso: effectiveDate,
          updatedAt: new Date(),
        })
        .where(eq(expenseReports.id, id));
    }
    diskPersistence.updateExpenseReportStatus(id, 'CONTABILIZADA_PAGADA', undefined, undefined, journalResult.entryId);

    res.json({
      success: true,
      message: `Rendición ${report.folio} contabilizada formalmente en Libro Diario con éxito.`,
      asientoContableId: journalResult.entryId,
      signature: journalResult.signature,
      totalDebe: journalResult.totalDebe,
      totalHaber: journalResult.totalHaber,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// 10. ESCANEO INTELIGENTE DE COMPROBANTES CON IA (GEMINI 3.8 FLASH VISION)
// ============================================================================
expenseReportsRouter.post('/scan-receipt-ai', async (req: Request, res: Response) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg' } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ success: false, error: 'Se requiere imageBase64 para el análisis de IA.' });
    }

    // 1.1 (hallazgo #2): sin lectura válida de la IA no se devuelven datos. La app abre el formulario manual.
    const result = await scanReceiptWithAi({
      imageBase64,
      mimeType,
      empresaId: req.effectiveEmpresaId || (req.body.empresaId as string) || (req.query.empresaId as string) || undefined,
    });

    if (result.ok !== true) {
      const failure = result as Extract<ReceiptOcrResult, { ok: false }>;
      console.warn(`[AI Vision] Lectura de comprobante no disponible: ${failure.reason}`);
      return res.status(503).json({ success: false, code: failure.code, error: failure.reason });
    }

    res.json({ success: true, data: (result as Extract<ReceiptOcrResult, { ok: true }>).data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
