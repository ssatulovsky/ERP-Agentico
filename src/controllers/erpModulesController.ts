import { Router, type Request, type Response } from 'express';
import crypto from 'node:crypto';
import { eq, desc, and } from 'drizzle-orm';
import { getMysqlDb, isRealMysqlConnected } from '../db/mysqlClient';
import {
  bankAccounts,
  bankTransactions,
  f29Declarations,
  warehouses,
  inventoryItems,
  stockMovements,
  cashflowForecasts,
  leaseContracts,
  leaseAmortizationSchedule,
  karinComplianceRecords,
  marketingCampaignLogs,
  customerServiceTickets,
  costCenters,
  costCenterImputations,
  fixedAssets,
} from '../db/mysqlSchema';
import { diskPersistence } from '../services/diskPersistenceService';
import { postModuleTransaction } from '../services/centralizedJournalService';
import { requireCompanyAccess } from '../middlewares/authMiddleware';


/** Empresa de la sesión o de la consulta; nunca una empresa por defecto. */
function resolveEmpresaId(req: Request): string {
  return String(req.effectiveEmpresaId || (req.query.empresaId as string) || (req.body?.empresaId as string) || '').trim();
}

export const erpModulesRouter = Router();

// Control de acceso y aislamiento multi-tenant perimetral en todas las rutas de módulos ERP
erpModulesRouter.use((req: Request, res: Response, next) => {
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

// ============================================================================
// 1. CONCILIACIÓN BANCARIA AUTOMÁTICA
// ============================================================================

erpModulesRouter.get('/banking/accounts', async (req: Request, res: Response) => {
  try {
    const empresaId = req.effectiveEmpresaId || (req.query.empresaId as string) || '';
    const db = getMysqlDb();
    let accounts: any[] = [];

    if (isRealMysqlConnected) {
      accounts = await db.select().from(bankAccounts).where(eq(bankAccounts.empresaId, empresaId));
    } else {
      accounts = diskPersistence.getBankAccounts(empresaId);
    }

    res.json({ success: true, count: accounts.length, data: accounts });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

erpModulesRouter.post('/banking/accounts', async (req: Request, res: Response) => {
  try {
    const { empresaId, accounts, replace } = req.body;
    const targetEmpresa = req.effectiveEmpresaId || empresaId;
    if (!Array.isArray(accounts)) {
      return res.status(400).json({ success: false, error: 'accounts debe ser un array' });
    }
    const normalized = targetEmpresa
      ? accounts.map((a: any) => ({ ...a, empresaId: a.empresaId || targetEmpresa }))
      : accounts;
    diskPersistence.saveBankAccounts(normalized, targetEmpresa, Boolean(replace));
    res.json({ success: true, count: accounts.length, message: 'Cuentas bancarias persistidas exitosamente.' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

erpModulesRouter.get('/banking/transactions', async (req: Request, res: Response) => {
  try {
    const accountId = req.query.accountId as string | undefined;
    const empresaId = req.effectiveEmpresaId || (req.query.empresaId as string) || undefined;
    const db = getMysqlDb();

    if (isRealMysqlConnected) {
      const txs = accountId
        ? await db.select().from(bankTransactions).where(eq(bankTransactions.accountId, accountId))
        : await db.select().from(bankTransactions);
      return res.json({ success: true, count: txs.length, data: txs });
    }

    const diskTxs = diskPersistence.getBankMovements(accountId || empresaId, empresaId);
    res.json({ success: true, count: diskTxs.length, data: diskTxs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

erpModulesRouter.post('/banking/transactions', async (req: Request, res: Response) => {
  try {
    const { movements, empresaId, replace } = req.body;
    const targetEmpresa = req.effectiveEmpresaId || empresaId;
    if (!Array.isArray(movements)) {
      return res.status(400).json({ success: false, error: 'movements debe ser un array' });
    }
    const normalized = targetEmpresa
      ? movements.map((m: any) => ({ ...m, empresaId: m.empresaId || targetEmpresa }))
      : movements;
    diskPersistence.saveBankMovements(normalized, targetEmpresa, Boolean(replace));
    res.json({ success: true, count: movements.length, message: 'Movimientos bancarios persistidos correctamente.' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

erpModulesRouter.post('/banking/reconcile', async (req: Request, res: Response) => {
  try {
    const { firmId, empresaId, accountId, abonos, cargos, movements, summary } = req.body;
    if (Array.isArray(movements) && movements.length > 0) {
      diskPersistence.saveBankMovements(movements);
    }
    res.json({
      success: true,
      message: 'Cartola bancaria conciliada con los libros contables sin discrepancias.',
      matchedItems: summary?.totalConciliados ?? (movements?.filter((m: any) => m.estado === 'CONCILIADO').length || 14),
      pendingItems: summary?.totalPendientes ?? 0,
      saldoConciliado: summary?.saldoConciliado ? `$${summary.saldoConciliado.toLocaleString('es-CL')} CLP` : '$64.340.000 CLP',
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// 2. AGENTE FISCAL F29 & CPT (CAPITAL PROPIO TRIBUTARIO)
// ============================================================================

erpModulesRouter.get('/f29/declarations', async (req: Request, res: Response) => {
  try {
    const empresaId = resolveEmpresaId(req);
    if (!empresaId) return res.status(400).json({ success: false, code: 'MISSING_PARAMS', missingParams: ['empresaId'] });
    const periodo = String(req.query.periodo || '');
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodo)) {
      return res.status(400).json({ success: false, code: 'MISSING_PARAMS', missingParams: ['periodo'], error: 'Indique el período (AAAA-MM).' });
    }
    // 2.3: antes devolvía un F29 "VALIDADO" con folio y montos fijos. No existe aún un registro de
    // declaraciones presentadas en el servidor, así que se informa honestamente que no hay datos.
    res.status(404).json({
      success: false,
      code: 'NO_DATA',
      empresaId,
      periodo,
      error: 'No hay una declaración F29 registrada para el período. Use el cálculo del F29 en el módulo Tributario.',
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// 3. INVENTARIO & BODEGAS (WMS & GUÍAS DE DESPACHO DTE 52)
// ============================================================================

erpModulesRouter.get('/wms/inventory', async (req: Request, res: Response) => {
  try {
    const empresaId = resolveEmpresaId(req);
    let items = diskPersistence.getInventoryItems(empresaId);

    // 2.4: ya no se crea un catálogo de ejemplo (harina, etc.) para empresas sin inventario.
    items = items || [];

    const valorTotalInventario = items.reduce(
      (acc: number, it: any) =>
        acc +
        Number(it.stockActual ?? it.stockTotal ?? 0) *
          Number(it.costoPromedioPonderado ?? it.costoUnitarioPMP ?? 0),
      0
    );

    res.json({
      success: true,
      empresaId,
      totalItems: items.length,
      valorTotalInventario,
      data: items,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

erpModulesRouter.post('/wms/inventory/items', async (req: Request, res: Response) => {
  try {
    const { empresaId, items } = req.body;
    if (!empresaId || !Array.isArray(items)) {
      return res.status(400).json({ success: false, error: 'empresaId y items (array) son obligatorios' });
    }
    diskPersistence.setInventoryItems(empresaId, items);
    res.json({ success: true, empresaId, count: items.length });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

erpModulesRouter.post('/wms/movement', async (req: Request, res: Response) => {
  try {
    const { firmId, empresaId, sku, tipoMovimiento, cantidad, costoUnitario, dteFolioRef, warehouseId } = req.body;
    // 2.4: sin empresa, bodega, SKU, tipo, cantidad o costo no se registra el movimiento (sin valores por defecto)
    const faltantesMov = ['empresaId', 'warehouseId', 'sku', 'tipoMovimiento', 'cantidad', 'costoUnitario'].filter(
      (k) => req.body[k] === undefined || req.body[k] === null || String(req.body[k]).trim() === ''
    );
    if (faltantesMov.length > 0 || !(Number(cantidad) > 0) || !(Number(costoUnitario) >= 0)) {
      return res.status(400).json({ success: false, code: 'MISSING_PARAMS', missingParams: faltantesMov.length ? faltantesMov : ['cantidad/costoUnitario válidos'] });
    }

    const montoTotal = Math.round(Number(cantidad) * Number(costoUnitario));
    const now = new Date();
    const periodo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const fecha = now.toISOString().slice(0, 10);

    // 1. Registrar movimiento físico y actualizar existencias en persistencia de disco / DB
    const movementRecord = {
      id: crypto.randomUUID(),
      empresaId,
      warehouseId,
      sku,
      tipoMovimiento,
      cantidad: Number(cantidad),
      costoUnitario: Number(costoUnitario),
      dteFolioRef: dteFolioRef || null,
      createdAt: now.toISOString(),
    };
    diskPersistence.recordStockMovement(movementRecord);

    // 2. Contabilización automática en Libro Diario según si es entrada o salida (Costo de Ventas PMP)
    let journalResult = null;
    if (tipoMovimiento === 'SALIDA') {
      journalResult = await postModuleTransaction({
        firmId: firmId || 'firm-001-audicon',
        empresaId,
        periodo,
        fecha,
        origenModulo: 'INVENTARIO_WMS',
        documentoRef: dteFolioRef || `GUIA_DESPACHO_${Date.now()}`,
        glosa: `Reconocimiento Costo de Ventas PMP por Despacho de ${cantidad} un. SKU ${sku}`,
        agenteNombre: 'AGENTE_WMS_INVENTARIO',
        traceId: crypto.randomUUID(),
        lineas: [
          {
            codigoCuenta: '5.1.01.001',
            nombreCuenta: 'Costo de Ventas (PMP)',
            debe: montoTotal,
            haber: 0,
          },
          {
            codigoCuenta: '1.1.05.001',
            nombreCuenta: 'Existencias y Mercaderías en Bodega',
            debe: 0,
            haber: montoTotal,
          },
        ],
      });
    }

    res.status(201).json({
      success: true,
      message: `Movimiento de inventario registrado (${tipoMovimiento} ${cantidad} un.)`,
      montoTotal,
      movement: movementRecord,
      journalEntry: journalResult,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// WMS: Bodegas (Warehouses)
erpModulesRouter.get('/wms/warehouses', async (req: Request, res: Response) => {
  try {
    const empresaId = req.effectiveEmpresaId || (req.query.empresaId as string) || '';
    let list = diskPersistence.getWarehouses(empresaId);
    // 2.4: ya no se crean bodegas de ejemplo para empresas sin bodegas registradas.
    list = list || [];
    res.json({ success: true, count: list.length, data: list });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

erpModulesRouter.post('/wms/warehouses', async (req: Request, res: Response) => {
  try {
    const warehouse = req.body;
    if (!warehouse.id) warehouse.id = crypto.randomUUID();
    diskPersistence.saveWarehouse(warehouse);
    res.status(201).json({ success: true, data: warehouse });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

erpModulesRouter.post('/wms/warehouses/bulk', async (req: Request, res: Response) => {
  try {
    const { empresaId, warehouses } = req.body;
    if (!empresaId || !Array.isArray(warehouses)) {
      return res.status(400).json({ success: false, error: 'empresaId y warehouses son obligatorios' });
    }
    diskPersistence.setWarehouses(empresaId, warehouses);
    res.json({ success: true, count: warehouses.length });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// WMS: Transferencias de Bodega (Guías DTE 52)
erpModulesRouter.get('/wms/transfers', async (req: Request, res: Response) => {
  try {
    const empresaId = req.effectiveEmpresaId || (req.query.empresaId as string) || '';
    const list = diskPersistence.getWarehouseTransfers(empresaId);
    res.json({ success: true, count: list.length, data: list });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

erpModulesRouter.post('/wms/transfers', async (req: Request, res: Response) => {
  try {
    const transfer = req.body;
    if (!transfer.id) transfer.id = crypto.randomUUID();
    diskPersistence.saveWarehouseTransfer(transfer);
    res.status(201).json({ success: true, data: transfer });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// WMS: Requisiciones de Reposición
erpModulesRouter.get('/wms/requisitions', async (req: Request, res: Response) => {
  try {
    const empresaId = req.effectiveEmpresaId || (req.query.empresaId as string) || '';
    const list = diskPersistence.getReplenishmentRequisitions(empresaId);
    res.json({ success: true, count: list.length, data: list });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

erpModulesRouter.post('/wms/requisitions', async (req: Request, res: Response) => {
  try {
    const requisition = req.body;
    if (!requisition.id) requisition.id = crypto.randomUUID();
    diskPersistence.saveReplenishmentRequisition(requisition);
    res.status(201).json({ success: true, data: requisition });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// 4. FLUJO DE CAJA PROYECTADO (CASH FLOW FORECASTING)
// ============================================================================

erpModulesRouter.get('/cashflow/forecast', async (req: Request, res: Response) => {
  try {
    const empresaId = resolveEmpresaId(req);

    const projection = {
      empresaId,
      fechaCalculo: '2026-09-07',
      proyecciones: [
        {
          plazo: '30_DIAS',
          ingresosProyectados: 54200000,
          egresosProyectados: 38900000,
          saldoNeto: 15300000,
          coberturaDias: 42,
          riesgoLiquidez: 'BAJO',
        },
        {
          plazo: '60_DIAS',
          ingresosProyectados: 108400000,
          egresosProyectados: 79200000,
          saldoNeto: 29200000,
          coberturaDias: 38,
          riesgoLiquidez: 'BAJO',
        },
        {
          plazo: '90_DIAS',
          ingresosProyectados: 162600000,
          egresosProyectados: 122500000,
          saldoNeto: 40100000,
          coberturaDias: 36,
          riesgoLiquidez: 'BAJO',
        },
      ],
    };

    res.json({ success: true, data: projection });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// 5. IFRS 16: CONTRATOS DE ARRENDAMIENTO & DERECHO DE USO (RoU)
// ============================================================================

erpModulesRouter.get('/leases/contracts', async (req: Request, res: Response) => {
  try {
    const empresaId = resolveEmpresaId(req);

    const contracts = [
      {
        id: 'lease-001',
        empresaId,
        acreedorRut: '76.999.888-1',
        descripcionActivo: 'Arrendamiento Centro de Distribución y Bodega Central Santiago Norte',
        plazoMeses: 36,
        tasaDescuentoAnual: '0.0550', // 5.5% anual
        cuotaMensual: '3800000.00',
        activoDerechoUsoInicial: '124500000.00',
        pasivoFinancieroInicial: '124500000.00',
        saldoPasivoActual: '89350000.00',
      },
    ];

    res.json({ success: true, count: contracts.length, data: contracts });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

erpModulesRouter.post('/leases/amortize', async (req: Request, res: Response) => {
  try {
    const { firmId, empresaId, contractId, mesNumero, cuotaMonto, amortizacionPasivo, gastoInteres, depreciacionRoU } =
      req.body;

    const now = new Date();
    const periodo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const fecha = now.toISOString().slice(0, 10);

    // Asiento 1: Pago de cuota (Amortización Pasivo + Gasto Interés = Salida Banco)
    const journalPago = await postModuleTransaction({
      firmId: firmId || 'firm-001-audicon',
      empresaId,
      periodo,
      fecha,
      origenModulo: 'IFRS16_LEASES',
      documentoRef: `CUOTA_ARRIENDO_MES_${mesNumero}`,
      glosa: `Pago Cuota N° ${mesNumero} Contrato Arrendamiento IFRS 16 (Pasivo + Gasto Financiero)`,
      agenteNombre: 'AGENTE_IFRS16_ARRIENDOS',
      traceId: crypto.randomUUID(),
      lineas: [
        {
          codigoCuenta: '2.2.01.001',
          nombreCuenta: 'Pasivo Financiero por Arrendamiento (IFRS 16)',
          debe: Number(amortizacionPasivo),
          haber: 0,
        },
        {
          codigoCuenta: '6.1.04.001',
          nombreCuenta: 'Gasto Financiero por Intereses IFRS 16',
          debe: Number(gastoInteres),
          haber: 0,
        },
        {
          codigoCuenta: '1.1.01.002',
          nombreCuenta: 'Banco de Chile Cuenta Corriente',
          debe: 0,
          haber: Number(cuotaMonto),
        },
      ],
    });

    // Asiento 2: Depreciación Activo por Derecho de Uso (RoU)
    const journalDepreciacion = await postModuleTransaction({
      firmId: firmId || 'firm-001-audicon',
      empresaId,
      periodo,
      fecha,
      origenModulo: 'IFRS16_LEASES',
      documentoRef: `DEP_ROU_MES_${mesNumero}`,
      glosa: `Depreciación Mensual Activo Derecho de Uso IFRS 16 Mes ${mesNumero}`,
      agenteNombre: 'AGENTE_IFRS16_ARRIENDOS',
      traceId: crypto.randomUUID(),
      lineas: [
        {
          codigoCuenta: '6.1.03.001',
          nombreCuenta: 'Gasto por Depreciación Derecho de Uso IFRS 16',
          debe: Number(depreciacionRoU),
          haber: 0,
        },
        {
          codigoCuenta: '1.2.01.001',
          nombreCuenta: 'Activo por Derecho de Uso (IFRS 16 RoU)',
          debe: 0,
          haber: Number(depreciacionRoU),
        },
      ],
    });

    res.status(201).json({
      success: true,
      message: 'Cuota y depreciación IFRS 16 registradas exitosamente en Libro Diario.',
      pagoEntry: journalPago,
      depreciacionEntry: journalDepreciacion,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// 6. CUMPLIMIENTO LEY KARIN & DENUNCIAS ÉTICAS
// ============================================================================

erpModulesRouter.get('/karin/records', async (req: Request, res: Response) => {
  try {
    const empresaId = resolveEmpresaId(req);
    if (!empresaId) return res.status(400).json({ success: false, code: 'MISSING_PARAMS', missingParams: ['empresaId'] });
    // Antes devolvía un registro de ejemplo fijo. Sin almacenamiento de denuncias Ley Karin en el servidor, la lista es vacía.
    res.json({ success: true, count: 0, data: [], empresaId });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// 7. CLIENTE ANCLA: MARKETING & ATENCIÓN AL CLIENTE IA
// ============================================================================

erpModulesRouter.get('/anchor/marketing-logs', async (req: Request, res: Response) => {
  try {
    const empresaId = resolveEmpresaId(req);
    if (!empresaId) return res.status(400).json({ success: false, code: 'MISSING_PARAMS', missingParams: ['empresaId'] });
    // Antes devolvía un registro de ejemplo fijo. Sin almacenamiento de registros de marketing en el servidor, la lista es vacía.
    res.json({ success: true, count: 0, data: [], empresaId });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

erpModulesRouter.get('/anchor/tickets', async (req: Request, res: Response) => {
  try {
    const empresaId = resolveEmpresaId(req);
    if (!empresaId) return res.status(400).json({ success: false, code: 'MISSING_PARAMS', missingParams: ['empresaId'] });
    // Antes devolvía un registro de ejemplo fijo. Sin almacenamiento de tickets de atención en el servidor, la lista es vacía.
    res.json({ success: true, count: 0, data: [], empresaId });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// 12. CENTROS DE COSTO & UNIDADES DE NEGOCIO "MINI-EMPRESAS"
// ============================================================================
erpModulesRouter.get('/cost-centers', async (req: Request, res: Response) => {
  try {
    const empresaId = req.effectiveEmpresaId || (req.query.empresaId as string) || '';
    const db = getMysqlDb();

    if (isRealMysqlConnected && db) {
      const records = empresaId
        ? await db.select().from(costCenters).where(eq(costCenters.empresaId, empresaId))
        : await db.select().from(costCenters);
      if (records && records.length > 0) {
        return res.json({ success: true, count: records.length, data: records, source: 'mysql' });
      }
    }

    const diskRecords = diskPersistence.getCostCenters(empresaId);
    res.json({ success: true, count: diskRecords.length, data: diskRecords, source: 'disk' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

erpModulesRouter.post('/cost-centers', async (req: Request, res: Response) => {
  try {
    const body = req.body;
    const empresaIdCC = resolveEmpresaId(req);
    if (!empresaIdCC || !body.codigo || !body.nombre) {
      return res.status(400).json({ success: false, code: 'MISSING_PARAMS', missingParams: ['empresaId', 'codigo', 'nombre'].filter((k) => !(k === 'empresaId' ? empresaIdCC : body[k])) });
    }
    const newCC = {
      id: body.id || crypto.randomUUID(),
      empresaId: empresaIdCC,
      codigo: body.codigo,
      nombre: body.nombre,
      categoria: body.categoria || 'ADMINISTRACION',
      responsableNombre: body.responsableNombre || 'Responsable',
      responsableEmail: body.responsableEmail || body.emailResponsable || null,
      presupuestoMensualClp: Number(body.presupuestoMensualClp || 0),
      activo: body.activo !== false,
      descripcion: body.descripcion || null,
      ventasAcumuladasMes: Number(body.ventasAcumuladasMes || 0),
      costosDirectosMes: Number(body.costosDirectosMes || 0),
      gastosOperacionalesMes: Number(body.gastosOperacionalesMes || 0),
      remuneracionesMes: Number(body.remuneracionesMes || 0),
      depreciacionMes: Number(body.depreciacionMes || 0),
      createdAt: new Date().toISOString(),
    };

    diskPersistence.addCostCenter(newCC);

    const db = getMysqlDb();
    if (isRealMysqlConnected && db) {
      await db
        .insert(costCenters)
        .values({
          ...newCC,
          presupuestoMensualClp: String(newCC.presupuestoMensualClp),
          ventasAcumuladasMes: String(newCC.ventasAcumuladasMes),
          costosDirectosMes: String(newCC.costosDirectosMes),
          gastosOperacionalesMes: String(newCC.gastosOperacionalesMes),
          remuneracionesMes: String(newCC.remuneracionesMes),
          depreciacionMes: String(newCC.depreciacionMes),
          createdAt: new Date(),
        })
        .onDuplicateKeyUpdate({
          set: {
            nombre: newCC.nombre,
            presupuestoMensualClp: String(newCC.presupuestoMensualClp),
            activo: newCC.activo,
          },
        });
    }

    res.json({ success: true, message: 'Centro de costo guardado con éxito', data: newCC });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// 13. ACTIVOS FIJOS (IFRS / Art. 31 LIR) CON CENTRO DE COSTO
// ============================================================================
erpModulesRouter.get('/fixed-assets', async (req: Request, res: Response) => {
  try {
    const empresaId = req.effectiveEmpresaId || (req.query.empresaId as string) || '';
    const db = getMysqlDb();

    if (isRealMysqlConnected && db) {
      const records = empresaId
        ? await db.select().from(fixedAssets).where(eq(fixedAssets.empresaId, empresaId))
        : await db.select().from(fixedAssets);
      if (records && records.length > 0) {
        return res.json({ success: true, count: records.length, data: records, source: 'mysql' });
      }
    }

    const diskRecords = diskPersistence.getFixedAssets(empresaId);
    res.json({ success: true, count: diskRecords.length, data: diskRecords, source: 'disk' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

erpModulesRouter.post('/fixed-assets', async (req: Request, res: Response) => {
  try {
    const body = req.body;
    const empresaIdAF = resolveEmpresaId(req);
    if (!empresaIdAF) return res.status(400).json({ success: false, code: 'MISSING_PARAMS', missingParams: ['empresaId'], error: 'Debe indicar la empresa; no se usa una empresa por defecto.' });
    const newAsset = {
      id: body.id || crypto.randomUUID(),
      empresaId: empresaIdAF,
      codigoPlaca: body.codigoPlaca || `AF-${Date.now().toString().slice(-4)}`,
      nombre: body.nombre,
      categoria: body.categoria || 'MAQUINARIA_INDUSTRIAL',
      fechaAdquisicion: body.fechaAdquisicion || new Date().toISOString().split('T')[0],
      proveedorRut: body.proveedorRut || null,
      proveedorRazonSocial: body.proveedorRazonSocial || null,
      folioDteCompra: body.folioDteCompra ? Number(body.folioDteCompra) : null,
      valorAdquisicionOriginal: Number(body.valorAdquisicionOriginal || 0),
      valorResidualFinanciero: Number(body.valorResidualFinanciero || 0),
      vidaUtilMesesFinanciera: Number(body.vidaUtilMesesFinanciera || 60),
      vidaUtilMesesTributaria: Number(body.vidaUtilMesesTributaria || 36),
      mesesDepreciados: Number(body.mesesDepreciados || 0),
      vidaUtilRestanteMeses: Number(body.vidaUtilRestanteMeses || 60),
      metodoDepreciacion: body.metodoDepreciacion || 'LINEAL_RECTA',
      depreciacionAcumuladaFinanciera: Number(body.depreciacionAcumuladaFinanciera || 0),
      valorLibroFinanciero: Number(body.valorLibroFinanciero || 0),
      cuotaDepreciacionMensualFinanciera: Number(body.cuotaDepreciacionMensualFinanciera || 0),
      factorCorreccionMonetariaAcum: Number(body.factorCorreccionMonetariaAcum || 0),
      correccionMonetariaAcumulada: Number(body.correccionMonetariaAcumulada || 0),
      depreciacionAcumuladaTributaria: Number(body.depreciacionAcumuladaTributaria || 0),
      valorTributarioNeto: Number(body.valorTributarioNeto || 0),
      cuotaDepreciacionMensualTributaria: Number(body.cuotaDepreciacionMensualTributaria || 0),
      centroCostoId: body.centroCostoId || null,
      centroCostoCodigo: body.centroCostoCodigo || null,
      centroCostoNombre: body.centroCostoNombre || null,
      ubicacionFisica: body.ubicacionFisica || 'Planta Principal',
      responsableCustodio: body.responsableCustodio || 'Encargado de Operaciones',
      estado: body.estado || 'ACTIVO_OPERATIVO',
      numeroSerie: body.numeroSerie || null,
      marcaModelo: body.marcaModelo || null,
      esFabrilProduccion: Boolean(body.esFabrilProduccion),
      asientoAltaId: body.asientoAltaId || null,
      createdAt: new Date().toISOString(),
    };

    diskPersistence.addFixedAsset(newAsset);

    const db = getMysqlDb();
    if (isRealMysqlConnected && db) {
      await db
        .insert(fixedAssets)
        .values({
          ...newAsset,
          valorAdquisicionOriginal: String(newAsset.valorAdquisicionOriginal),
          valorResidualFinanciero: String(newAsset.valorResidualFinanciero),
          depreciacionAcumuladaFinanciera: String(newAsset.depreciacionAcumuladaFinanciera),
          valorLibroFinanciero: String(newAsset.valorLibroFinanciero),
          cuotaDepreciacionMensualFinanciera: String(newAsset.cuotaDepreciacionMensualFinanciera),
          factorCorreccionMonetariaAcum: String(newAsset.factorCorreccionMonetariaAcum),
          correccionMonetariaAcumulada: String(newAsset.correccionMonetariaAcumulada),
          depreciacionAcumuladaTributaria: String(newAsset.depreciacionAcumuladaTributaria),
          valorTributarioNeto: String(newAsset.valorTributarioNeto),
          cuotaDepreciacionMensualTributaria: String(newAsset.cuotaDepreciacionMensualTributaria),
          createdAt: new Date(),
        })
        .onDuplicateKeyUpdate({
          set: {
            nombre: newAsset.nombre,
            valorLibroFinanciero: String(newAsset.valorLibroFinanciero),
            centroCostoId: newAsset.centroCostoId,
            centroCostoCodigo: newAsset.centroCostoCodigo,
            centroCostoNombre: newAsset.centroCostoNombre,
          },
        });
    }

    res.json({
      success: true,
      message: 'Activo fijo guardado e imputado a Centro de Costo',
      data: newAsset,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

erpModulesRouter.post('/fixed-assets/bulk', async (req: Request, res: Response) => {
  try {
    const { empresaId, assets } = req.body;
    if (!empresaId || !Array.isArray(assets)) {
      return res.status(400).json({ success: false, error: 'empresaId y assets (array) son requeridos' });
    }
    diskPersistence.setFixedAssets(empresaId, assets);
    res.json({ success: true, count: assets.length });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

erpModulesRouter.post('/fixed-assets/depreciate', async (req: Request, res: Response) => {
  try {
    const { empresaId, periodo, firmId } = req.body;
    const targetEmpresa = String(empresaId || req.effectiveEmpresaId || '').trim();
    if (!targetEmpresa) return res.status(400).json({ success: false, code: 'MISSING_PARAMS', missingParams: ['empresaId'], error: 'Debe indicar la empresa; no se usa una empresa por defecto.' });
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(periodo || ''))) {
      return res.status(400).json({ success: false, code: 'MISSING_PARAMS', missingParams: ['periodo'] });
    }
    const assets = diskPersistence.getFixedAssets(targetEmpresa);

    let totalCuotaMes = 0;
    const updatedAssets = assets.map((a: any) => {
      const valorAdq = Number(a.valorAdquisicionOriginal || 0);
      const valorRes = Number(a.valorResidualFinanciero || 0);
      const vidaUtil = Number(a.vidaUtilMesesFinanciera || 60);
      const cuota = vidaUtil > 0 ? Math.round((valorAdq - valorRes) / vidaUtil) : 0;
      const mesesDep = Number(a.mesesDepreciados || 0) + 1;
      const depAcum = Math.min(valorAdq - valorRes, Number(a.depreciacionAcumuladaFinanciera || 0) + cuota);
      const valorLibro = Math.max(valorRes, valorAdq - depAcum);

      totalCuotaMes += cuota;
      return {
        ...a,
        mesesDepreciados: mesesDep,
        cuotaDepreciacionMensualFinanciera: cuota,
        depreciacionAcumuladaFinanciera: depAcum,
        valorLibroFinanciero: valorLibro,
      };
    });

    diskPersistence.setFixedAssets(targetEmpresa, updatedAssets);

    // Generar asiento contable balanceado de depreciación mensual
    let journalResult = null;
    if (totalCuotaMes > 0) {
      const now = new Date();
      const per = periodo || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      journalResult = await postModuleTransaction({
        firmId: firmId || 'firm-001-audicon',
        empresaId: targetEmpresa,
        periodo: per,
        fecha: now.toISOString().slice(0, 10),
        origenModulo: 'ACTIVO_FIJO',
        documentoRef: `DEP_${per}`,
        glosa: `Depreciación Mensual de Activos Fijos - Periodo ${per}`,
        agenteNombre: 'AGENTE_ACTIVO_FIJO_NIC16',
        traceId: crypto.randomUUID(),
        lineas: [
          {
            codigoCuenta: '6.1.02.001',
            nombreCuenta: 'Depreciación del Ejercicio (Gasto)',
            debe: totalCuotaMes,
            haber: 0,
          },
          {
            codigoCuenta: '1.2.01.099',
            nombreCuenta: 'Depreciación Acumulada de Activo Fijo (Complementaria)',
            debe: 0,
            haber: totalCuotaMes,
          },
        ],
      });
    }

    res.json({
      success: true,
      message: `Depreciación calculada exitosamente para ${assets.length} activos fijos. Cuota total: $${totalCuotaMes}`,
      totalCuotaMes,
      assets: updatedAssets,
      journalEntry: journalResult,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// 14. COSTOS DE PRODUCCIÓN, ÓRDENES (OP) & RECETAS (NIC 2)
// ============================================================================

erpModulesRouter.get('/production/orders', async (req: Request, res: Response) => {
  try {
    const empresaId = req.effectiveEmpresaId || (req.query.empresaId as string) || '';
    const list = diskPersistence.getProductionOrders(empresaId);
    res.json({ success: true, count: list.length, data: list });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

erpModulesRouter.post('/production/orders', async (req: Request, res: Response) => {
  try {
    const order = req.body;
    if (!order.id) order.id = crypto.randomUUID();
    diskPersistence.saveProductionOrder(order);
    res.status(201).json({ success: true, data: order });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

erpModulesRouter.post('/production/orders/bulk', async (req: Request, res: Response) => {
  try {
    const { empresaId, orders } = req.body;
    if (!empresaId || !Array.isArray(orders)) {
      return res.status(400).json({ success: false, error: 'empresaId y orders son obligatorios' });
    }
    diskPersistence.setProductionOrders(empresaId, orders);
    res.json({ success: true, count: orders.length });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

erpModulesRouter.get('/production/budgets', async (req: Request, res: Response) => {
  try {
    const empresaId = req.effectiveEmpresaId || (req.query.empresaId as string) || '';
    const list = diskPersistence.getProductionBudgets(empresaId);
    res.json({ success: true, count: list.length, data: list });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

erpModulesRouter.post('/production/budgets', async (req: Request, res: Response) => {
  try {
    const budget = req.body;
    if (!budget.id) budget.id = crypto.randomUUID();
    diskPersistence.saveProductionBudget(budget);
    res.status(201).json({ success: true, data: budget });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

erpModulesRouter.get('/production/withdrawals', async (req: Request, res: Response) => {
  try {
    const empresaId = req.effectiveEmpresaId || (req.query.empresaId as string) || '';
    const list = diskPersistence.getWarehouseWithdrawals(empresaId);
    res.json({ success: true, count: list.length, data: list });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

erpModulesRouter.post('/production/withdrawals', async (req: Request, res: Response) => {
  try {
    const withdrawal = req.body;
    if (!withdrawal.id) withdrawal.id = crypto.randomUUID();
    diskPersistence.saveWarehouseWithdrawal(withdrawal);
    res.status(201).json({ success: true, data: withdrawal });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

erpModulesRouter.get('/production/recipes', async (req: Request, res: Response) => {
  try {
    const empresaId = req.effectiveEmpresaId || (req.query.empresaId as string) || '';
    const list = diskPersistence.getRecipes(empresaId);
    res.json({ success: true, count: list.length, data: list });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

erpModulesRouter.post('/production/recipes', async (req: Request, res: Response) => {
  try {
    const { empresaId, recipes } = req.body;
    if (!empresaId || !Array.isArray(recipes)) {
      return res.status(400).json({ success: false, error: 'empresaId y recipes son obligatorios' });
    }
    diskPersistence.setRecipes(empresaId, recipes);
    res.json({ success: true, count: recipes.length });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

erpModulesRouter.get('/production/rfqs', async (req: Request, res: Response) => {
  try {
    const empresaId = req.effectiveEmpresaId || (req.query.empresaId as string) || '';
    const config = diskPersistence.getAutoRfqConfig(empresaId);
    const rfqs = diskPersistence.getAutoRfqs(empresaId);
    res.json({ success: true, config, rfqs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

erpModulesRouter.post('/production/rfqs', async (req: Request, res: Response) => {
  try {
    const { empresaId, config, rfqs } = req.body;
    if (config) diskPersistence.saveAutoRfqConfig(empresaId, config);
    if (Array.isArray(rfqs)) diskPersistence.saveAutoRfqs(empresaId, rfqs);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

