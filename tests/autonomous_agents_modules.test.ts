import './setup/enableDemoMode';
import assert from 'node:assert';
import crypto from 'node:crypto';
import { AutonomousAgentEngine, type AutonomousAgentRequest } from '../src/services/autonomousAgentEngine';
import { diskPersistence } from '../src/services/diskPersistenceService';
import { MODULE_AGENTS_REGISTRY } from '../src/services/moduleAgentGovernanceService';
import { HrManagementService } from '../src/services/hrManagementService';
import { HttpDteBillingService } from '../src/services/httpDteBillingService';
import { commercialProcurementService } from '../src/services/commercialProcurementService';
import { voiceAssistantEngine } from '../src/services/voiceAssistantEngine';
import { whatsappBridgeService } from '../src/services/whatsappBridgeService';
import { DEFAULT_AGENT_PERSONAS } from '../src/config/defaultAgentPersonas';
import { DEFAULT_INDICATORS } from '../src/utils/chileanAccounting';
import type { CompanyProfile, FixedAsset, ProductionOrder, ExpenseReport } from '../src/types';

async function runAutonomousModulesSuite() {
  console.log('========================================================================');
  console.log('   SUITE FORMAL PARTE B & C: AGENTES AUTÓNOMOS, HERRAMIENTAS Y GOBERNANZA');
  console.log('========================================================================\n');

  let passed = 0;
  let total = 0;

  async function test(name: string, fn: () => void | Promise<void>) {
    total++;
    process.stderr.write(`  ➡️ [START] ${name}\n`);
    try {
      await fn();
      process.stderr.write(`  ✅ [PASS] ${name}\n`);
      passed++;
    } catch (err: any) {
      process.stderr.write(`  ❌ [FAIL] ${name}: ${err.message}\n`);
      throw err;
    }
  }

  const tenantRut = '761045509';
  const tenantCompany: CompanyProfile = {
    id: tenantRut,
    rut: '76.104.550-9',
    razonSocial: 'Retail Solutions Chile SpA',
    giro: 'Venta Minorista y Logística',
    direccion: 'Av. El Bosque Norte 500',
    comuna: 'Las Condes',
    ciudad: 'Santiago',
    region: 'Metropolitana',
    telefono: '+56 2 2999 8888',
    email: 'contacto@retailsolutions.cl',
    regimenTributario: '14D3_PROPYME_GENERAL',
    tasaPpm: 0.005,
    remanenteCreditoFiscalClp: 341600,
    remanenteCreditoFiscalUtm: 5.0,
    esExportador: false,
    retencionCambioSujeto: false,
  };

  const baseRequest: AutonomousAgentRequest = {
    empresaId: tenantRut,
    module: 'CONTABILIDAD',
    agentRole: 'Agente Auditor Contable y Tributario Senior',
    query: 'Verificación integral de agentes de módulo',
    context: {
      company: tenantCompany,
      empresa: tenantCompany,
      indicators: DEFAULT_INDICATORS,
    },
  };

  // ==========================================================================
  // 1. ACTIVO FIJO (NIC 16): DEPRECIACIÓN Y GOBERNANZA EJECUTADA
  // ==========================================================================
  await test('Parte B.1 [Activo Fijo]: tool_fixed_assets_depreciate_period calcula cuota mensual NIC 16 real', async () => {
    const testAsset: any = {
      id: `AF-TEST-${Date.now()}`,
      empresaId: tenantRut,
      codigoPlaca: `PLACA-${Date.now().toString().slice(-4)}`,
      nombre: 'Servidor Dell PowerEdge R750',
      categoria: 'EQUIPOS_COMPUTACION',
      ubicacion: 'Data Center Santiago',
      responsableRut: '15.342.119-4',
      fechaAdquisicion: '2025-01-01',
      valorAdquisicionOriginal: 6000000,
      valorResidualEstimado: 0,
      vidaUtilMesesFinanciera: 36,
      vidaUtilMesesTributaria: 12,
      vidaUtilRestanteMeses: 36,
      depreciacionAcumuladaFinanciera: 0,
      depreciacionAcumuladaTributaria: 0,
      valorLibroFinanciero: 6000000,
      metodoDepreciacion: 'LINEAL',
      esFabrilProduccion: false,
      estado: 'OPERATIVO',
      cuotaDepreciacionMensualFinanciera: 166667,
      cuotaDepreciacionMensualTributaria: 500000,
    };
    diskPersistence.saveFixedAsset(tenantRut, testAsset);

    const res = await (AutonomousAgentEngine as any).executeTool(
      'tool_fixed_assets_depreciate_period',
      { periodo: '2026-03' },
      baseRequest
    );

    assert.strictEqual(res.status, 'SUCCESS');
    assert.ok(res.totalActivosAuditados >= 1);
    assert.ok(res.depreciacionFinancieraTotal > 0);
    assert.strictEqual(res.calculosNIC16, true);
  });

  await test('Parte B.1 [Activo Fijo]: tool_fixed_assets_propose_entry y ejecutor DEPRECIACION_ACTIVO_FIJO', async () => {
    const testAsset: any = {
      id: `AF-DEP-${Date.now()}`,
      empresaId: tenantRut,
      codigoPlaca: `PLC-${Date.now().toString().slice(-4)}`,
      nombre: 'Montacargas Crown Eléctrico',
      categoria: 'MAQUINARIAS_Y_EQUIPOS',
      ubicacion: 'Bodega Central',
      responsableRut: '15.342.119-4',
      fechaAdquisicion: '2025-01-01',
      valorAdquisicionOriginal: 12000000,
      valorResidualEstimado: 0,
      vidaUtilMesesFinanciera: 60,
      vidaUtilMesesTributaria: 24,
      vidaUtilRestanteMeses: 48,
      depreciacionAcumuladaFinanciera: 2400000,
      depreciacionAcumuladaTributaria: 6000000,
      valorLibroFinanciero: 9600000,
      metodoDepreciacion: 'LINEAL',
      esFabrilProduccion: false,
      estado: 'OPERATIVO',
      cuotaDepreciacionMensualFinanciera: 200000,
      cuotaDepreciacionMensualTributaria: 500000,
    };
    diskPersistence.saveFixedAsset(tenantRut, testAsset);

    const prop = await (AutonomousAgentEngine as any).executeTool(
      'tool_fixed_assets_propose_entry',
      { periodo: '2026-03' },
      baseRequest
    );

    assert.strictEqual(prop.status, 'SUCCESS');
    assert.strictEqual(prop.partidaDobleValida, true);
    assert.ok(prop.approvalId, 'Debe generar solicitud de aprobación humana');

    const entriesBefore = diskPersistence.getJournalEntries(tenantRut).length;
    const resolution = await HrManagementService.resolveApproval(prop.approvalId, 'USR-ADMIN', true);

    assert.strictEqual(resolution.estado, 'EJECUTADO');
    assert.ok(resolution.resultadoEjecucion?.includes('depreciación'));

    const entriesAfter = diskPersistence.getJournalEntries(tenantRut).length;
    assert.strictEqual(entriesAfter, entriesBefore + 1, 'Debe asentar formalmente en Libro Diario');

    // Verificar actualización del activo en disco
    const updatedAsset = diskPersistence.getFixedAssets(tenantRut).find(a => a.id === testAsset.id);
    assert.ok(updatedAsset);
    assert.ok(updatedAsset!.depreciacionAcumuladaFinanciera > 2400000, 'Debe incrementar depreciación acumulada');
    assert.ok(updatedAsset!.vidaUtilRestanteMeses < 48, 'Debe decrementar vida útil restante');
  });

  await test('Parte B.1 [Activo Fijo]: tool_fixed_assets_propose_writeoff y ejecutor BAJA_ACTIVO_FIJO', async () => {
    const testAsset: any = {
      id: `AF-BAJA-${Date.now()}`,
      empresaId: tenantRut,
      codigoPlaca: `PLC-BAJA-${Date.now().toString().slice(-4)}`,
      nombre: 'Impresora Térmica Obsoleta',
      categoria: 'EQUIPOS_COMPUTACION',
      ubicacion: 'Oficina Central',
      responsableRut: '15.342.119-4',
      fechaAdquisicion: '2022-01-01',
      valorAdquisicionOriginal: 1000000,
      valorResidualEstimado: 0,
      vidaUtilMesesFinanciera: 36,
      vidaUtilMesesTributaria: 12,
      vidaUtilRestanteMeses: 0,
      depreciacionAcumuladaFinanciera: 1000000,
      depreciacionAcumuladaTributaria: 1000000,
      valorLibroFinanciero: 0,
      metodoDepreciacion: 'LINEAL',
      esFabrilProduccion: false,
      estado: 'OPERATIVO',
      cuotaDepreciacionMensualFinanciera: 0,
      cuotaDepreciacionMensualTributaria: 0,
    };
    diskPersistence.saveFixedAsset(tenantRut, testAsset);

    const prop = await (AutonomousAgentEngine as any).executeTool(
      'tool_fixed_assets_propose_writeoff',
      { activoId: testAsset.id, motivoBaja: 'Término de ciclo y falla irreparable', precioVentaNeto: 0 },
      baseRequest
    );

    assert.strictEqual(prop.status, 'SUCCESS');
    assert.ok(prop.approvalId);

    const resolution = await HrManagementService.resolveApproval(prop.approvalId, 'USR-ADMIN', true);
    assert.strictEqual(resolution.estado, 'EJECUTADO');

    const updated = diskPersistence.getFixedAssets(tenantRut).find(a => a.id === testAsset.id);
    assert.ok(updated);
    assert.strictEqual(updated!.estado, 'DADO_DE_BAJA');
    assert.strictEqual(updated!.valorLibroFinanciero, 0);
  });

  // ==========================================================================
  // 2. COSTOS DE PRODUCCIÓN (NIC 2): COSTEO Y CIERRE DE ORDEN
  // ==========================================================================
  await test('Parte B.2 [Producción]: tool_production_cost_order y variance sin datos simulados', async () => {
    const testOp: any = {
      id: `OP-${Date.now()}`,
      empresaId: tenantRut,
      folioOP: `OP-AUDIT-${Date.now().toString().slice(-4)}`,
      productoSku: 'SKU-IND-01',
      productoNombre: 'Pintura Epóxica Industrial Alto Tráfico',
      cantidadObjetivo: 500,
      cantidadProducidaReal: 500,
      unidadMedida: 'GALON',
      estado: 'EN_PROCESO',
      fechaInicio: '2026-03-01',
      costoMateriaPrimaReal: 4500000,
      costoManoObraReal: 1800000,
      costoCifReal: 700000,
      costoTotalProduccion: 7000000,
      costoUnitarioReal: 14000,
      creadoPor: 'USR-JEFE-PLANTA',
      creadoEn: new Date().toISOString(),
      actualizadoEn: new Date().toISOString(),
    };
    diskPersistence.saveProductionOrders(tenantRut, [testOp]);

    const costRes = await (AutonomousAgentEngine as any).executeTool(
      'tool_production_cost_order',
      { folioOP: testOp.folioOP },
      baseRequest
    );

    assert.strictEqual(costRes.status, 'SUCCESS');
    assert.strictEqual(costRes.costosNIC2.materiaPrimaDirectaMPD, 4500000);
    assert.strictEqual(costRes.costosNIC2.manoObraDirectaMOD, 1800000);
    assert.strictEqual(costRes.costosNIC2.costoCifReal ?? costRes.costosNIC2.costosIndirectosFabricacionCIF, 700000);
    assert.strictEqual(costRes.costosNIC2.costoUnitarioReal, 14000);

    const varRes = await (AutonomousAgentEngine as any).executeTool(
      'tool_production_variance_standard_vs_real',
      { folioOP: testOp.folioOP },
      baseRequest
    );

    // 4.5: sin presupuesto estándar no hay variación (antes se suponía estándar = real × 0,95).
    assert.strictEqual(varRes.status, 'NO_DATA');

    diskPersistence.saveProductionBudget({
      id: `PPTO-${testOp.id}`,
      empresaId: tenantRut,
      ordenProduccionId: testOp.id,
      folioOP: testOp.folioOP,
      presupuestoMpdClp: 4200000,
      presupuestoModClp: 1800000,
      presupuestoCifClp: 650000,
    });
    const varConPpto = await (AutonomousAgentEngine as any).executeTool(
      'tool_production_variance_standard_vs_real',
      { folioOP: testOp.folioOP },
      baseRequest
    );
    assert.strictEqual(varConPpto.status, 'SUCCESS');
    assert.strictEqual(varConPpto.folioOP, testOp.folioOP);
    assert.strictEqual(varConPpto.costoEstandarPresupuestado, 6650000);
    assert.strictEqual(varConPpto.desviacionTotalClp, 350000);
  });

  await test('Parte B.2 [Producción]: tool_production_propose_closure_entry y ejecutor CIERRE_ORDEN_PRODUCCION', async () => {
    const testOp: any = {
      id: `OP-CLOSE-${Date.now()}`,
      empresaId: tenantRut,
      folioOP: `OP-CL-${Date.now().toString().slice(-4)}`,
      productoSku: 'SKU-IND-02',
      productoNombre: 'Sellador Acrílico Especial',
      cantidadObjetivo: 200,
      cantidadProducidaReal: 200,
      unidadMedida: 'TINACO',
      estado: 'EN_PROCESO',
      fechaInicio: '2026-03-01',
      costoMateriaPrimaReal: 2000000,
      costoManoObraReal: 800000,
      costoCifReal: 200000,
      costoTotalProduccion: 3000000,
      costoUnitarioReal: 15000,
      creadoPor: 'USR-JEFE-PLANTA',
      creadoEn: new Date().toISOString(),
      actualizadoEn: new Date().toISOString(),
    };
    const currentOps = diskPersistence.getProductionOrders(tenantRut);
    diskPersistence.saveProductionOrders(tenantRut, [...currentOps, testOp]);

    let prop = await (AutonomousAgentEngine as any).executeTool(
      'tool_production_propose_closure_entry',
      { folioOP: testOp.folioOP },
      baseRequest
    );
    // 2.4: la fecha de cierre ya no se supone "hoy"
    assert.strictEqual(prop.status, 'MISSING_PARAMS');
    assert.ok(prop.faltantes.includes('fechaCierre'));
    prop = await (AutonomousAgentEngine as any).executeTool(
      'tool_production_propose_closure_entry',
      { folioOP: testOp.folioOP, fechaCierre: '2026-10-31' },
      baseRequest
    );

    assert.strictEqual(prop.status, 'SUCCESS');
    assert.strictEqual(prop.costoTotalLiquidado, 3000000);
    assert.ok(prop.approvalId);

    const entriesBefore = diskPersistence.getJournalEntries(tenantRut).length;
    const resolution = await HrManagementService.resolveApproval(prop.approvalId, 'USR-ADMIN', true);

    assert.strictEqual(resolution.estado, 'EJECUTADO');
    assert.ok(resolution.resultadoEjecucion?.toLowerCase().includes('liquidaci'));

    const entriesAfter = diskPersistence.getJournalEntries(tenantRut).length;
    assert.strictEqual(entriesAfter, entriesBefore + 1, 'Debe registrar asiento formal WIP a PT');

    const opsAfter = diskPersistence.getProductionOrders(tenantRut);
    const updatedOp = opsAfter.find(o => o.id === testOp.id);
    assert.ok(updatedOp);
    assert.strictEqual(updatedOp!.estado, 'LIQUIDADA_TERMINADA');
  });

  // ==========================================================================
  // 3. FLUJO DE CAJA: PROYECCIÓN 30/60/90 Y SIMULACIÓN DE ESCENARIOS
  // ==========================================================================
  await test('Parte B.3 [Flujo de Caja]: tool_cashflow_project_30_60_90 y simulación sin métricas fijas', async () => {
    const projRes = await (AutonomousAgentEngine as any).executeTool(
      'tool_cashflow_project_30_60_90',
      {},
      baseRequest
    );

    assert.strictEqual(projRes.status, 'SUCCESS');
    assert.ok(typeof projRes.saldoDisponibleHoy === 'number');
    assert.ok(projRes.proyeccion.dias30);
    assert.ok(projRes.proyeccion.dias60);
    assert.ok(projRes.proyeccion.dias90);

    const simRes = await (AutonomousAgentEngine as any).executeTool(
      'tool_cashflow_simulate_scenario',
      {
        variacionVentasPct: -15,
        retrasoCobranzaDias: 30,
        aumentoCostosPct: 10,
      },
      baseRequest
    );

    assert.strictEqual(simRes.status, 'SUCCESS');
    assert.strictEqual(simRes.parametrosEscenario.variacionVentasPorcentaje, -15);
    assert.ok(simRes.impactoSimulado30Dias.cobrosEsperados >= 0);
    assert.ok(simRes.impactoSimulado30Dias.diagnostico);
  });

  // ==========================================================================
  // 4. ABASTECIMIENTO: MARGEN, RFQ Y ADJUDICACIÓN DE ORDEN DE COMPRA
  // ==========================================================================
  await test('Parte B.4 [Abastecimiento]: RFQ, análisis y ejecutor EMITIR_ORDEN_COMPRA', async () => {
    const marginRes = await (AutonomousAgentEngine as any).executeTool(
      'tool_procurement_margin_analysis',
      {},
      baseRequest
    );
    assert.strictEqual(marginRes.status, 'SUCCESS');

    const rfqRes = await (AutonomousAgentEngine as any).executeTool(
      'tool_procurement_create_rfq',
      {
        titulo: 'Adquisición de Papel Continuo y Etiquetas',
        items: [{ sku: 'INS-01', descripcion: 'Rollo Etiquetas Térmicas', cantidad: 100, unidadMedida: 'ROLLO' }],
        proveedoresRuts: ['77.798.901-4', '96.540.320-1'],
      },
      baseRequest
    );

    assert.strictEqual(rfqRes.status, 'SUCCESS');
    assert.ok(rfqRes.folio);

    const awardRes = await (AutonomousAgentEngine as any).executeTool(
      'tool_procurement_award_purchase_order',
      {
        rfqId: rfqRes.folio,
        proveedorRut: '77.798.901-4',
        montoTotalNeto: 1850000,
        motivoAdjudicacion: 'Mejor scoring técnico y menor plazo de entrega',
      },
      baseRequest
    );

    assert.strictEqual(awardRes.status, 'SUCCESS');
    assert.ok(awardRes.approvalId);

    const poCountBefore = commercialProcurementService.getState(tenantRut).ordenesCompra.length;
    const resolution = await HrManagementService.resolveApproval(awardRes.approvalId, 'USR-ADMIN', true);

    assert.strictEqual(resolution.estado, 'EJECUTADO');
    assert.ok(resolution.resultadoEjecucion?.includes('Orden de Compra'));

    const poCountAfter = commercialProcurementService.getState(tenantRut).ordenesCompra.length;
    assert.strictEqual(poCountAfter, poCountBefore + 1, 'Debe crear orden de compra en el servicio');

    const latestPo = commercialProcurementService.getState(tenantRut).ordenesCompra[0];
    assert.ok(latestPo);
    assert.strictEqual(latestPo.estado, 'EMITIDA', 'El estado inicial debe ser EMITIDA, no ENVIADA_PROVEEDOR');
    assert.strictEqual(latestPo.items[0].precioUnitarioCLP, 18500, 'Precio unitario calculado correctamente');
    assert.strictEqual(latestPo.totalNetoCLP, 1850000, 'Total neto debe coincidir con monto aprobado');
  });

  await test('Parte B.4 [Abastecimiento]: Validaciones estrictas del ejecutor EMITIR_ORDEN_COMPRA (rechazos sin defaults y discrepancia)', async () => {
    // 1. Rechazo por falta de proveedor (sin defaults)
    const reqNoProv = HrManagementService.requestModuleApproval({
      empresaId: tenantRut,
      modulo: 'COMERCIAL_COMPRAS',
      agenteNombre: 'Agente Compras',
      operacionTipo: 'EMITIR_ORDEN_COMPRA',
      titulo: 'OC sin proveedor',
      descripcion: 'Prueba de validación',
      datosOperacion: {
        items: [{ sku: 'INS-01', cantidad: 10, precioUnitarioCLP: 1000 }],
        montoTotalNeto: 10000,
      },
      impactoFinancieroClp: 10000,
      nivelRiesgo: 'MEDIO',
    });
    const resNoProv = await HrManagementService.resolveApproval(reqNoProv.id, 'USR-ADMIN', true);
    assert.strictEqual(resNoProv.estado, 'ERROR_EJECUCION');
    assert.ok(resNoProv.resultadoEjecucion?.toLowerCase().includes('proveedor'));

    // 2. Rechazo por falta de SKU (sin defaults)
    const reqNoSku = HrManagementService.requestModuleApproval({
      empresaId: tenantRut,
      modulo: 'COMERCIAL_COMPRAS',
      agenteNombre: 'Agente Compras',
      operacionTipo: 'EMITIR_ORDEN_COMPRA',
      titulo: 'OC sin SKU',
      descripcion: 'Prueba de validación',
      datosOperacion: {
        proveedorRut: '77.798.901-4',
        items: [{ cantidad: 10, precioUnitarioCLP: 1000 }],
        montoTotalNeto: 10000,
      },
      impactoFinancieroClp: 10000,
      nivelRiesgo: 'MEDIO',
    });
    const resNoSku = await HrManagementService.resolveApproval(reqNoSku.id, 'USR-ADMIN', true);
    assert.strictEqual(resNoSku.estado, 'ERROR_EJECUCION');
    assert.ok(resNoSku.resultadoEjecucion?.includes('SKU'));

    // 3. Rechazo por falta o invalidez de cantidad (sin defaults)
    const reqNoQty = HrManagementService.requestModuleApproval({
      empresaId: tenantRut,
      modulo: 'COMERCIAL_COMPRAS',
      agenteNombre: 'Agente Compras',
      operacionTipo: 'EMITIR_ORDEN_COMPRA',
      titulo: 'OC sin cantidad',
      descripcion: 'Prueba de validación',
      datosOperacion: {
        proveedorRut: '77.798.901-4',
        items: [{ sku: 'INS-01', precioUnitarioCLP: 1000 }],
        montoTotalNeto: 10000,
      },
      impactoFinancieroClp: 10000,
      nivelRiesgo: 'MEDIO',
    });
    const resNoQty = await HrManagementService.resolveApproval(reqNoQty.id, 'USR-ADMIN', true);
    assert.strictEqual(resNoQty.estado, 'ERROR_EJECUCION');
    assert.ok(resNoQty.resultadoEjecucion?.toLowerCase().includes('cantidad'));

    // 4. Rechazo por falta de precio (sin defaults)
    const reqNoPrice = HrManagementService.requestModuleApproval({
      empresaId: tenantRut,
      modulo: 'COMERCIAL_COMPRAS',
      agenteNombre: 'Agente Compras',
      operacionTipo: 'EMITIR_ORDEN_COMPRA',
      titulo: 'OC sin precio',
      descripcion: 'Prueba de validación',
      datosOperacion: {
        proveedorRut: '77.798.901-4',
        items: [{ sku: 'INS-01', cantidad: 5, precioUnitarioCLP: 0 }],
        montoTotalNeto: 50000,
      },
      impactoFinancieroClp: 50000,
      nivelRiesgo: 'MEDIO',
    });
    const resNoPrice = await HrManagementService.resolveApproval(reqNoPrice.id, 'USR-ADMIN', true);
    assert.strictEqual(resNoPrice.estado, 'ERROR_EJECUCION');
    assert.ok(resNoPrice.resultadoEjecucion?.toLowerCase().includes('precio'));

    // 5. Rechazo por discrepancia entre total de ítems y monto aprobado
    const reqDiscrepancy = HrManagementService.requestModuleApproval({
      empresaId: tenantRut,
      modulo: 'COMERCIAL_COMPRAS',
      agenteNombre: 'Agente Compras',
      operacionTipo: 'EMITIR_ORDEN_COMPRA',
      titulo: 'OC con discrepancia de monto',
      descripcion: 'Prueba de validación',
      datosOperacion: {
        proveedorRut: '77.798.901-4',
        items: [{ sku: 'INS-01', cantidad: 10, precioUnitarioCLP: 50000 }], // total = 500.000
        montoTotalNeto: 800000, // no coincide
      },
      impactoFinancieroClp: 800000,
      nivelRiesgo: 'MEDIO',
    });
    const resDiscrepancy = await HrManagementService.resolveApproval(reqDiscrepancy.id, 'USR-ADMIN', true);
    assert.strictEqual(resDiscrepancy.estado, 'ERROR_EJECUCION');
    assert.ok(resDiscrepancy.resultadoEjecucion?.includes('Discrepancia financiera'));
  });

  // ==========================================================================
  // 5. RENDICIÓN DE GASTOS: AUDITORÍA Y CENTRALIZACIÓN CONTABLE
  // ==========================================================================
  await test('Parte B.5 [Rendiciones]: Validación y ejecutor CENTRALIZAR_RENDICION', async () => {
    const report: any = {
      id: `RDG-${Date.now()}`,
      empresaId: tenantRut,
      folio: `RDG-${Date.now().toString().slice(-4)}`,
      rendidorNombre: 'Carlos Morales',
      rendidorRut: '14.223.456-7',
      fechaRendicion: '2026-03-31',
      totalRendido: 145000,
      totalAprobado: 145000,
      totalRechazado: 0,
      estado: 'APROBADA',
      items: [
        {
          id: 'item-1',
          informeId: '',
          concepto: 'Combustible y Peajes Visita a Clientes',
          montoTotal: 95000,
          montoIva: 0,
          tipoComprobante: 'BOLETA_COMBUSTIBLE',
          rutEmisor: '76.123.456-0',
          estadoValidacion: 'VALIDADO',
        },
        {
          id: 'item-2',
          informeId: '',
          concepto: 'Almuerzo Trabajo Equipo Terreno',
          montoTotal: 50000,
          montoIva: 0,
          tipoComprobante: 'BOLETA_ELECTRONICA',
          rutEmisor: '77.234.567-8',
          estadoValidacion: 'VALIDADO',
        },
      ],
      creadoEn: new Date().toISOString(),
      actualizadoEn: new Date().toISOString(),
    };

    const existingReports = diskPersistence.getExpenseReports ? diskPersistence.getExpenseReports(tenantRut) : [];
    diskPersistence.saveExpenseReports(tenantRut, [...existingReports, report]);

    const valRes = await (AutonomousAgentEngine as any).executeTool(
      'tool_expenses_validate_report',
      { reportId: report.id },
      baseRequest
    );

    assert.strictEqual(valRes.status, 'SUCCESS');
    assert.strictEqual(valRes.consistenciaAritmetica, true);
    assert.strictEqual(valRes.dictamenAuditor, 'CONFORME_PARA_CENTRALIZAR');

    const prop = await (AutonomousAgentEngine as any).executeTool(
      'tool_expenses_propose_entry',
      { reportId: report.id },
      baseRequest
    );

    assert.strictEqual(prop.status, 'SUCCESS');
    assert.ok(prop.approvalId);

    const entriesBefore = diskPersistence.getJournalEntries(tenantRut).length;
    const resolution = await HrManagementService.resolveApproval(prop.approvalId, 'USR-ADMIN', true);

    assert.strictEqual(resolution.estado, 'EJECUTADO');

    const entriesAfter = diskPersistence.getJournalEntries(tenantRut).length;
    assert.strictEqual(entriesAfter, entriesBefore + 1, 'Debe asentar centralización en el Libro Mayor');

    const updatedReports = diskPersistence.getExpenseReports(tenantRut);
    const updated = updatedReports.find(r => r.id === report.id);
    assert.ok(updated);
    assert.strictEqual(updated!.estado, 'CONTABILIZADA_PAGADA');
  });

  // ==========================================================================
  // 6. FACTURACIÓN DTE: SEGURIDAD CAF OFICIAL EN EJECUCIÓN
  // ==========================================================================
  await test('Parte B.6 [Facturación DTE]: EMITIR_DTE aborta con ERROR_EJECUCION ante CAF no oficial', async () => {
    // Proponemos emisión DTE 33 para tenant sin CAF oficial
    const req = HrManagementService.requestModuleApproval({
      empresaId: tenantRut,
      modulo: 'CONTABILIDAD',
      agenteNombre: 'Agente de Facturación',
      operacionTipo: 'EMITIR_DTE',
      titulo: 'Emisión de Factura Electrónica Folio 150',
      descripcion: 'Facturación a cliente corporativo',
      datosOperacion: {
        tipoDte: 33,
        receptorRut: '77.798.901-4',
        items: [{ descripcion: 'Consultoría TI', cantidad: 1, precioUnitario: 2500000 }],
        montoTotal: 2975000,
      },
      impactoFinancieroClp: 2975000,
      nivelRiesgo: 'ALTO',
    });

    const resolution = await HrManagementService.resolveApproval(req.id, 'USR-ADMIN', true);
    // Dado que no hay CAF con estado VALID_OFFICIAL cargado para tipo 33 en 761045509:
    assert.strictEqual(resolution.estado, 'ERROR_EJECUCION', 'Debe abortar si el CAF no es oficial y válido');
    assert.ok(resolution.resultadoEjecucion?.toLowerCase().includes('caf'));
  });

  await test('Parte B.6 [Facturación DTE]: Ejecutor DTE transiciona a EJECUTADO solo con trackId o timbre oficial', async () => {
    const originalEmitir = HttpDteBillingService.emitirDte;
    const originalMap = HttpDteBillingService.mapErpToHttpDtePayload;
    const originalPersist = HttpDteBillingService.persistEmittedDte;

    try {
      (HttpDteBillingService as any).persistEmittedDte = async () => 'dte-test-persisted';
      // 1. Caso de Éxito con Track ID y TED
      (HttpDteBillingService as any).emitirDte = async () => ({
        success: true,
        folio: 501,
        tipoDte: 33,
        trackId: 'TRK-SII-987654321',
        ted: '<TED version="1.0"><DD><RE>76.104.550-9</RE></DD></TED>',
      });
      (HttpDteBillingService as any).mapErpToHttpDtePayload = () => ({
        tipoDte: 33,
        folio: 501,
        fechaEmision: '2026-03-30',
        formaPago: 1,
        emisor: { rut: '76104550-9', razonSocial: 'Retail Solutions' },
        receptor: { rut: '77798901-4', razonSocial: 'InnovAgile' },
        detalles: [],
        firma: { data: 'fake', password: crypto.randomBytes(16).toString('hex') },
        ambiente: 1,
      });

      const reqSuccess = HrManagementService.requestModuleApproval({
        empresaId: tenantRut,
        modulo: 'FACTURACION_DTE',
        agenteNombre: 'Agente Facturador SII',
        operacionTipo: 'EMITIR_DTE',
        titulo: 'Factura Electrónica Válida',
        descripcion: 'Factura con CAF y timbraje verificado',
        datosOperacion: {
          tipoDte: 33,
          receptorRut: '77.798.901-4',
          receptorRazonSocial: 'InnovAgile SpA',
          giroReceptor: 'Servicios de Informática',
          direccionReceptor: 'Av. Providencia 1234',
          comunaReceptor: 'Providencia',
          montoTotal: 100000,
          items: [
            {
              nombre: 'Consultoría Tecnológica Especializada',
              cantidad: 1,
              precioUnitario: 84034,
              montoTotal: 84034,
              esExento: false,
            },
          ],
        },
        impactoFinancieroClp: 100000,
        nivelRiesgo: 'ALTO',
      });

      const resSuccess = await HrManagementService.resolveApproval(reqSuccess.id, 'USR-ADMIN', true);
      assert.strictEqual(resSuccess.estado, 'EJECUTADO', 'Debe marcar EJECUTADO si emitirDte retorna trackId y TED');
      assert.strictEqual(resSuccess.trackId, 'TRK-SII-987654321');
      assert.ok(resSuccess.ted?.includes('TED'));
      assert.strictEqual(resSuccess.folioEmitido, 501);

      // Verificación de Idempotencia: No se puede re-ejecutar una solicitud ya resuelta
      await assert.rejects(
        async () => {
          await HrManagementService.resolveApproval(reqSuccess.id, 'USR-ADMIN', true);
        },
        /ya fue resuelta previamente/
      );

      // 2. Caso de Falla si emitirDte no retorna ni trackId ni TED
      (HttpDteBillingService as any).emitirDte = async () => ({
        success: false,
        error: 'Conexión rechazada por el servidor SII',
      });

      const reqFail = HrManagementService.requestModuleApproval({
        empresaId: tenantRut,
        modulo: 'FACTURACION_DTE',
        agenteNombre: 'Agente Facturador SII',
        operacionTipo: 'EMITIR_DTE',
        titulo: 'Factura Rechazada SII',
        descripcion: 'Falla de emisión',
        datosOperacion: {
          tipoDte: 33,
          receptorRut: '77.798.901-4',
          receptorRazonSocial: 'InnovAgile SpA',
          giroReceptor: 'Servicios de Informática',
          direccionReceptor: 'Av. Providencia 1234',
          comunaReceptor: 'Providencia',
          montoTotal: 100000,
          items: [
            {
              nombre: 'Consultoría Tecnológica Especializada',
              cantidad: 1,
              precioUnitario: 84034,
              montoTotal: 84034,
              esExento: false,
            },
          ],
        },
        impactoFinancieroClp: 100000,
        nivelRiesgo: 'ALTO',
      });

      const resFail = await HrManagementService.resolveApproval(reqFail.id, 'USR-ADMIN', true);
      assert.strictEqual(resFail.estado, 'ERROR_EJECUCION', 'Debe marcar ERROR_EJECUCION si la emisión falla');
      assert.ok(resFail.resultadoEjecucion?.includes('Conexión rechazada'));

      // 3. Caso de Rechazo estricto si el borrador solo trae monto o le faltan receptor e ítems (sin inventar datos)
      const reqIncomplete = HrManagementService.requestModuleApproval({
        empresaId: tenantRut,
        modulo: 'FACTURACION_DTE',
        agenteNombre: 'Agente Facturador SII',
        operacionTipo: 'EMITIR_DTE',
        titulo: 'Factura Sin Receptor Ni Ítems',
        descripcion: 'Borrador con solo monto',
        datosOperacion: { tipoDte: 33, montoTotal: 100000 },
        impactoFinancieroClp: 100000,
        nivelRiesgo: 'ALTO',
      });

      const resIncomplete = await HrManagementService.resolveApproval(reqIncomplete.id, 'USR-ADMIN', true);
      assert.strictEqual(resIncomplete.estado, 'ERROR_EJECUCION', 'Debe rechazar con ERROR_EJECUCION si faltan receptor o ítems');
      assert.ok(resIncomplete.resultadoEjecucion?.includes('Rechazo DTE'), 'Debe declarar formalmente el rechazo sin inventar datos');
    } finally {
      (HttpDteBillingService as any).emitirDte = originalEmitir;
      (HttpDteBillingService as any).mapErpToHttpDtePayload = originalMap;
      (HttpDteBillingService as any).persistEmittedDte = originalPersist;
    }
  });

  // ==========================================================================
  // 7. ASISTENTE DE VOZ: CERO "COMO SI", RESPUESTA HONESTA NO_DATA
  // ==========================================================================
  await test('Parte B.7 [Voz & WhatsApp]: VoiceAssistantEngine y WhatsAppBridge ejecutan el motor agéntico con datos reales', async () => {
    // 1. Asistente de Voz: Cero datos inventados o NO_DATA honesto
    const persona = DEFAULT_AGENT_PERSONAS[0];
    const turnResult = await voiceAssistantEngine.processDialogue(
      '¿cuál es el estado de la producción y órdenes en planta?',
      persona,
      {
        clientId: tenantRut,
        clientName: 'Retail Solutions Chile SpA',
        rut: '76.104.550-9',
        productionOrders: [],
      } as any
    );

    const fullText = `${turnResult.verbalResponse || ''} ${turnResult.displayMarkdown || ''}`;
    assert.ok(
      !fullText.includes('68%') && !fullText.includes('OP-2026-101') && !fullText.includes('1.360'),
      'NO debe inventar avance del 68%, folio OP-2026-101 ni 1.360 unidades'
    );

    // 2. WhatsApp Bridge: Enrutamiento al motor agéntico con aislamiento tenant
    whatsappBridgeService.upsertWhitelistEntry({
      id: 'wl-test-b7-user',
      telefono: '56911223344',
      nombre: 'Gerente General Retail',
      cargo: 'Gerente General',
      empresaId: tenantRut,
      rolPreset: 'SOCIO_DIRECTOR_TOTAL',
      agentesPermitidos: ['FLUJO_CAJA', 'PRODUCCION_COSTEO', 'BODEGA_INVENTARIO', 'TRIBUTARIO_F29', 'RENDICIONES_GASTOS'],
      activo: true,
      recibirReportesDirectos: true,
      responderConAudio: false,
    });

    const waResponse = await whatsappBridgeService.executeIncomingMessageWithAgent({
      remoteJid: '56911223344@s.whatsapp.net',
      messageText: '¿Cuál es el saldo y proyección de flujo de caja para este mes?',
      fromMe: false,
      simulateBypassPrefix: true,
    });

    assert.strictEqual(waResponse.allowed, true, 'El usuario en lista blanca debe ser autorizado');
    assert.ok(waResponse.responseText, 'Debe contener la respuesta del agente');
    assert.ok(waResponse.responseText?.includes('Vera') || waResponse.responseText?.includes('FLUJO_CAJA'), 'Debe identificarse la agente Vera o el módulo de Flujo de Caja');
  });

  // ==========================================================================
  // 8. PARTE C: PERSISTENCIA EN DISCO SOBREVIVE Y UMBRAL FINANCIERO
  // ==========================================================================
  await test('Parte C.1 [Persistencia]: resolveApproval busca en disco si no está en memoria viva', async () => {
    const req = HrManagementService.requestModuleApproval({
      empresaId: tenantRut,
      modulo: 'CONTABILIDAD',
      agenteNombre: 'Agente Contable',
      operacionTipo: 'REGISTRO_PRESUPUESTO',
      titulo: 'Presupuesto Operacional Q2',
      descripcion: 'Aprobación presupuestaria',
      datosOperacion: { concepto: 'Presupuesto Q2' },
      impactoFinancieroClp: 1000000,
      nivelRiesgo: 'BAJO',
    });

    // Simulamos que la memoria RAM del servicio no lo tiene (búsqueda en disco)
    (HrManagementService as any).approvalsStore = ((HrManagementService as any).approvalsStore || []).filter((a: any) => a.id !== req.id);

    const resolution = await HrManagementService.resolveApproval(req.id, 'USR-ADMIN', true);
    assert.strictEqual(resolution.estado, 'APROBADO');

    const persisted = diskPersistence.getApprovalById(req.id);
    assert.ok(persisted);
    assert.strictEqual(persisted!.estado, 'APROBADO');
  });

  await test('Parte C.2 [Gobernanza RBAC]: Solicitud > $5.000.000 requiere autorización de Administrador', async () => {
    const { requireApprovalPermission } = await import('../src/middlewares/authMiddleware');

    // Mock Express Request y Response
    let blocked = false;
    let statusCode = 200;

    const reqHighImpact: any = {
      user: {
        id: 'usr-analista',
        username: 'analista_compras',
        nombreCompleto: 'Analista Compras',
        email: 'analista@empresa.cl',
        empresaPrincipalId: tenantRut,
        empresasPermitidas: [tenantRut],
        roleCodigo: 'COMPRAS',
        modulosPermitidos: ['COMERCIAL_COMPRAS'],
        role: 'Compras',
        roles: ['Compras'],
        permisos: ['APROBACIONES:RESOLVER', 'COMPRAS:ADMIN'],
        isAdmin: false,
        isSuperAdmin: false,
      },
      params: { id: 'app-high-impact' },
      body: { aprobado: true },
    };

    // Crear solicitud con impacto de $8.000.000 CLP (supera el umbral de 5M)
    const highApproval = HrManagementService.requestModuleApproval({
      empresaId: tenantRut,
      modulo: 'COMERCIAL_COMPRAS',
      agenteNombre: 'Agente Compras',
      operacionTipo: 'EMITIR_ORDEN_COMPRA',
      titulo: 'Adquisición Maquinaria Mayor',
      descripcion: 'Compra de equipamiento pesado',
      datosOperacion: { monto: 8000000 },
      impactoFinancieroClp: 8000000,
      nivelRiesgo: 'ALTO',
    });
    const checkCompras = requireApprovalPermission(reqHighImpact, highApproval);
    assert.strictEqual(checkCompras.allowed, false, 'Usuario con rol Compras DEBE ser bloqueado ante monto > $5.000.000 CLP');
    assert.ok(checkCompras.reason?.includes('Umbral') || checkCompras.reason?.includes('insuficientes'));

    // Ahora con Administrador:
    const reqAdmin: any = {
      ...reqHighImpact,
      user: {
        ...reqHighImpact.user,
        role: 'Administrador',
        roles: ['Administrador'],
        isAdmin: true,
      },
    };
    const checkAdmin = requireApprovalPermission(reqAdmin, highApproval);
    assert.strictEqual(checkAdmin.allowed, true, 'Usuario con rol Administrador debe poder aprobar solicitudes sobre el umbral');
  });

  // ==========================================================================
  // PARTE C.3: PERSISTENCIA DE DTE, REMUNERACIONES Y BANCOS EN EL SERVIDOR (FUENTE DE VERDAD)
  // ==========================================================================
  await test('Parte C.3 [Persistencia Servidor]: DTEs, Remuneraciones y Bancos se persisten y consultan en el servidor como Fuente de Verdad con aislamiento multi-tenant', async () => {
    const tenantC1 = '765432109';
    const tenantC2 = '76892410K';

    // 1. DTEs: Persistencia en servidor y consulta por empresa
    const dtesPayload = [
      {
        id: `dte-test-${tenantC1}-01`,
        empresaId: tenantC1,
        tipoDte: 33,
        folio: 9901,
        rutContraparte: '77.798.901-4',
        razonSocialContraparte: 'Proveedora Austral SpA',
        fechaEmision: '2026-09-10',
        montoNeto: 1000000,
        montoIva: 190000,
        montoTotal: 1190000,
        tipoOperacion: 'COMPRA',
        estadoPago: 'PENDIENTE',
      },
      {
        id: `dte-test-${tenantC1}-02`,
        empresaId: tenantC1,
        tipoDte: 33,
        folio: 9902,
        rutContraparte: '76.123.456-7',
        razonSocialContraparte: 'Cliente Comercial Puerto Varas',
        fechaEmision: '2026-09-12',
        montoNeto: 2000000,
        montoIva: 380000,
        montoTotal: 2380000,
        tipoOperacion: 'VENTA',
        estadoPago: 'COBRADO',
      },
    ];

    diskPersistence.saveDtes(tenantC1, dtesPayload, true);
    const loadedDtes = diskPersistence.getDtes(tenantC1);
    assert.strictEqual(loadedDtes.length, 2, 'El servidor debe retornar exactamente los 2 DTEs guardados');
    assert.ok(loadedDtes.some((d: any) => d.folio === 9901), 'Debe contener el DTE folio 9901');
    assert.ok(loadedDtes.some((d: any) => d.folio === 9902), 'Debe contener el DTE folio 9902');

    // Verificar aislamiento multi-tenant: tenantC2 no debe ver los DTEs de tenantC1
    const dtesC2 = diskPersistence.getDtes(tenantC2);
    const leakedDte = dtesC2.some((d: any) => d.empresaId === tenantC1);
    assert.strictEqual(leakedDte, false, 'Tenant C2 no debe ver DTEs de Tenant C1');

    // 2. Remuneraciones (Nóminas): Persistencia en servidor
    const payrollPayload = [
      {
        id: `pay-test-${tenantC1}-01`,
        empresaId: tenantC1,
        rut: '15.234.567-8',
        nombreCompleto: 'Juan Carlos Operario',
        cargo: 'Técnico de Redes',
        departamento: 'Operaciones',
        fechaIngreso: '2024-03-01',
        tipoContrato: 'INDEFINIDO',
        diasTrabajados: 30,
        sueldoBase: 850000,
        sueldoLiquido: 720000,
        totalHaberesBrutos: 980000,
        totalDescuentos: 260000,
      },
    ];

    diskPersistence.savePayrolls(payrollPayload, tenantC1, true);
    const loadedPayrolls = diskPersistence.getPayrolls(tenantC1);
    assert.strictEqual(loadedPayrolls.length, 1, 'El servidor debe retornar la nómina persistida');
    assert.strictEqual(loadedPayrolls[0].rut, '15.234.567-8');
    assert.strictEqual(loadedPayrolls[0].cargo, 'Técnico de Redes');

    const payrollsC2 = diskPersistence.getPayrolls(tenantC2);
    const leakedPayroll = payrollsC2.some((p: any) => p.empresaId === tenantC1);
    assert.strictEqual(leakedPayroll, false, 'Tenant C2 no debe ver remuneraciones de Tenant C1');

    // 3. Bancos: Cuentas y Movimientos Bancarios en el servidor
    const bankAccountsPayload = [
      {
        id: `bank-acc-${tenantC1}-01`,
        empresaId: tenantC1,
        banco: 'Banco de Chile',
        tipoCuenta: 'CUENTA_CORRIENTE',
        numeroCuenta: '00-12345678-01',
        moneda: 'CLP',
        saldoLibro: 45000000,
        saldoCartola: 45000000,
      },
    ];

    diskPersistence.saveBankAccounts(bankAccountsPayload, tenantC1, true);
    const loadedAccounts = diskPersistence.getBankAccounts(tenantC1);
    assert.ok(loadedAccounts.length >= 1, 'El servidor debe retornar las cuentas bancarias persistidas');
    const myAccount = loadedAccounts.find((a: any) => a.id === `bank-acc-${tenantC1}-01`);
    assert.ok(myAccount, 'La cuenta bancaria específica debe encontrarse en el servidor');
    assert.strictEqual(myAccount.numeroCuenta, '00-12345678-01');

    const bankMovementsPayload = [
      {
        id: `bmov-test-${tenantC1}-01`,
        empresaId: tenantC1,
        cuentaId: `bank-acc-${tenantC1}-01`,
        fecha: '2026-09-15',
        glosaBancaria: 'TRANSFERENCIA RECIBIDA CLIENTE RETAIL',
        cargo: 0,
        abono: 2380000,
        estado: 'PENDIENTE',
        moneda: 'CLP',
      },
    ];

    diskPersistence.saveBankMovements(bankMovementsPayload, tenantC1, true);
    const loadedMovements = diskPersistence.getBankMovements(tenantC1);
    assert.strictEqual(loadedMovements.length, 1, 'El servidor debe retornar el movimiento bancario persistido');
    assert.strictEqual(loadedMovements[0].abono, 2380000);
    assert.strictEqual(loadedMovements[0].glosaBancaria, 'TRANSFERENCIA RECIBIDA CLIENTE RETAIL');

    const movsC2 = diskPersistence.getBankMovements(tenantC2);
    const leakedMov = movsC2.some((m: any) => m.empresaId === tenantC1);
    assert.strictEqual(leakedMov, false, 'Tenant C2 no debe ver movimientos bancarios de Tenant C1');
  });

  // ==========================================================================
  // PARTE B.8: AUDITORÍA DE EJECUTORES (MONTO APROBADO VS EJECUTADO Y EFECTO)
  // ==========================================================================

  // 1. DEPRECIACION_ACTIVO_FIJO
  await test('Parte B.8.1 [Ejecutor Depreciación]: Compara monto aprobado vs ejecutado y rechaza discrepancias', async () => {
    // Caso discrepancia
    const reqDiscrepancy = HrManagementService.requestModuleApproval({
      empresaId: tenantRut,
      modulo: 'ACTIVO_FIJO',
      agenteNombre: 'Agente Activo Fijo',
      operacionTipo: 'DEPRECIACION_ACTIVO_FIJO',
      titulo: 'Depreciación con Discrepancia',
      descripcion: 'Prueba de discrepancia de monto',
      impactoFinancieroClp: 200000,
      datosOperacion: {
        activosAfectados: [],
        lines: [
          { cuentaCodigo: '5.2.13', debe: 250000, haber: 0 },
          { cuentaCodigo: '1.2.99', debe: 0, haber: 250000 },
        ],
      },
      solicitadoPor: 'Agente Activo Fijo',
    });

    const resDisc = await HrManagementService.resolveApproval(reqDiscrepancy.id, 'USR-ADMIN', true);
    assert.strictEqual(resDisc.estado, 'ERROR_EJECUCION');
    assert.ok(resDisc.resultadoEjecucion?.includes('Discrepancia financiera'));

    // Caso coincidencia
    const reqOk = HrManagementService.requestModuleApproval({
      empresaId: tenantRut,
      modulo: 'ACTIVO_FIJO',
      agenteNombre: 'Agente Activo Fijo',
      operacionTipo: 'DEPRECIACION_ACTIVO_FIJO',
      titulo: 'Depreciación Coincidente',
      descripcion: 'Prueba de monto coincidente',
      impactoFinancieroClp: 200000,
      datosOperacion: {
        activosAfectados: ['act-01'],
        lines: [
          { cuentaCodigo: '5.2.13', debe: 200000, haber: 0 },
          { cuentaCodigo: '1.2.99', debe: 0, haber: 200000 },
        ],
      },
      solicitadoPor: 'Agente Activo Fijo',
    });

    const resOk = await HrManagementService.resolveApproval(reqOk.id, 'USR-ADMIN', true);
    assert.strictEqual(resOk.estado, 'EJECUTADO');
    assert.strictEqual(resOk.montoAprobadoClp, 200000);
    assert.strictEqual(resOk.montoEjecutadoClp, 200000);
    assert.strictEqual(resOk.montoAprobadoClp, resOk.montoEjecutadoClp);
    assert.ok(resOk.asientoContableId);

    // Caso Idempotencia: No se puede re-ejecutar una solicitud ya resuelta
    await assert.rejects(
      async () => {
        await HrManagementService.resolveApproval(reqOk.id, 'USR-ADMIN', true);
      },
      /ya fue resuelta previamente/
    );

    // Caso rechazo por lista de activos vacía
    const reqEmptyAssets = HrManagementService.requestModuleApproval({
      empresaId: tenantRut,
      modulo: 'ACTIVO_FIJO',
      agenteNombre: 'Agente Activo Fijo',
      operacionTipo: 'DEPRECIACION_ACTIVO_FIJO',
      titulo: 'Depreciación Lista Vacía',
      descripcion: 'Prueba lista vacía',
      impactoFinancieroClp: 200000,
      datosOperacion: {
        activosAfectados: [],
        lines: [
          { cuentaCodigo: '5.2.13', debe: 200000, haber: 0 },
          { cuentaCodigo: '1.2.99', debe: 0, haber: 200000 },
        ],
      },
      solicitadoPor: 'Agente Activo Fijo',
    });
    const resEmptyAssets = await HrManagementService.resolveApproval(reqEmptyAssets.id, 'USR-ADMIN', true);
    assert.strictEqual(resEmptyAssets.estado, 'ERROR_EJECUCION');
    assert.ok(resEmptyAssets.resultadoEjecucion?.includes('Falta especificar la lista de activos fijos'));

    // Caso rechazo por falta de cuenta contable
    const reqNoAccount = HrManagementService.requestModuleApproval({
      empresaId: tenantRut,
      modulo: 'ACTIVO_FIJO',
      agenteNombre: 'Agente Activo Fijo',
      operacionTipo: 'DEPRECIACION_ACTIVO_FIJO',
      titulo: 'Depreciación Sin Cuenta',
      descripcion: 'Prueba sin cuenta',
      impactoFinancieroClp: 200000,
      datosOperacion: {
        activosAfectados: ['act-01'],
        lines: [
          { debe: 200000, haber: 0 },
          { debe: 0, haber: 200000 },
        ],
      },
      solicitadoPor: 'Agente Activo Fijo',
    });
    const resNoAccount = await HrManagementService.resolveApproval(reqNoAccount.id, 'USR-ADMIN', true);
    assert.strictEqual(resNoAccount.estado, 'ERROR_EJECUCION');
    assert.ok(resNoAccount.resultadoEjecucion?.includes('no especifica código de cuenta contable'));
  });

  // 2. BAJA_ACTIVO_FIJO
  await test('Parte B.8.2 [Ejecutor Baja]: Compara monto aprobado vs ejecutado y rechaza discrepancia o falta de activoId', async () => {
    // Falta activoId
    const reqNoAsset = HrManagementService.requestModuleApproval({
      empresaId: tenantRut,
      modulo: 'ACTIVO_FIJO',
      agenteNombre: 'Agente Activo Fijo',
      operacionTipo: 'BAJA_ACTIVO_FIJO',
      titulo: 'Baja sin activo',
      descripcion: 'Prueba',
      impactoFinancieroClp: 100000,
      datosOperacion: {
        lines: [
          { cuentaCodigo: '5.2.14', debe: 100000, haber: 0 },
          { cuentaCodigo: '1.2.01', debe: 0, haber: 100000 },
        ],
      },
      solicitadoPor: 'Agente Activo Fijo',
    });
    const resNoAsset = await HrManagementService.resolveApproval(reqNoAsset.id, 'USR-ADMIN', true);
    assert.strictEqual(resNoAsset.estado, 'ERROR_EJECUCION');
    assert.ok(resNoAsset.resultadoEjecucion?.includes('Falta el identificador'));

    // Discrepancia
    const reqDisc = HrManagementService.requestModuleApproval({
      empresaId: tenantRut,
      modulo: 'ACTIVO_FIJO',
      agenteNombre: 'Agente Activo Fijo',
      operacionTipo: 'BAJA_ACTIVO_FIJO',
      titulo: 'Baja Discrepancia',
      descripcion: 'Prueba',
      impactoFinancieroClp: 100000,
      datosOperacion: {
        activoId: 'AF-FAKE-01',
        lines: [
          { cuentaCodigo: '5.2.14', debe: 180000, haber: 0 },
          { cuentaCodigo: '1.2.01', debe: 0, haber: 180000 },
        ],
      },
      solicitadoPor: 'Agente Activo Fijo',
    });
    const resDisc = await HrManagementService.resolveApproval(reqDisc.id, 'USR-ADMIN', true);
    assert.strictEqual(resDisc.estado, 'ERROR_EJECUCION');
    assert.ok(resDisc.resultadoEjecucion?.includes('Discrepancia financiera'));

    // Coincidente con efecto verificable
    const assetToRetire: any = {
      id: `AF-RET-${Date.now()}`,
      empresaId: tenantRut,
      codigoPlaca: `PLC-${Date.now().toString().slice(-4)}`,
      nombre: 'Mueble de Oficina',
      valorAdquisicionOriginal: 100000,
      valorLibroFinanciero: 50000,
      estado: 'OPERATIVO',
    };
    diskPersistence.saveFixedAsset(tenantRut, assetToRetire);

    const reqOk = HrManagementService.requestModuleApproval({
      empresaId: tenantRut,
      modulo: 'ACTIVO_FIJO',
      agenteNombre: 'Agente Activo Fijo',
      operacionTipo: 'BAJA_ACTIVO_FIJO',
      titulo: 'Baja Coincidente',
      descripcion: 'Prueba',
      impactoFinancieroClp: 50000,
      datosOperacion: {
        activoId: assetToRetire.id,
        lines: [
          { cuentaCodigo: '5.2.14', debe: 50000, haber: 0 },
          { cuentaCodigo: '1.2.01', debe: 0, haber: 50000 },
        ],
      },
      solicitadoPor: 'Agente Activo Fijo',
    });
    const resOk = await HrManagementService.resolveApproval(reqOk.id, 'USR-ADMIN', true);
    assert.strictEqual(resOk.estado, 'EJECUTADO');
    assert.strictEqual(resOk.montoAprobadoClp, 50000);
    assert.strictEqual(resOk.montoEjecutadoClp, 50000);
    assert.strictEqual(resOk.montoAprobadoClp, resOk.montoEjecutadoClp);

    const updated = diskPersistence.getFixedAssets(tenantRut).find(a => a.id === assetToRetire.id);
    assert.strictEqual(updated?.estado, 'DADO_DE_BAJA');
    assert.strictEqual(updated?.valorLibroFinanciero, 0);
  });

  // 3. CIERRE_ORDEN_PRODUCCION
  await test('Parte B.8.3 [Ejecutor Producción]: Compara monto aprobado vs ejecutado y rechaza discrepancia o falta de ordenId', async () => {
    // Falta ordenId
    const reqNoOp = HrManagementService.requestModuleApproval({
      empresaId: tenantRut,
      modulo: 'COSTOS_PRODUCCION',
      agenteNombre: 'Agente Producción',
      operacionTipo: 'CIERRE_ORDEN_PRODUCCION',
      titulo: 'Liquidación sin OP',
      descripcion: 'Prueba',
      impactoFinancieroClp: 1200000,
      datosOperacion: {
        lines: [
          { cuentaCodigo: '1.1.07', debe: 1200000, haber: 0 },
          { cuentaCodigo: '1.1.08', debe: 0, haber: 1200000 },
        ],
      },
      solicitadoPor: 'Agente Producción',
    });
    const resNoOp = await HrManagementService.resolveApproval(reqNoOp.id, 'USR-ADMIN', true);
    assert.strictEqual(resNoOp.estado, 'ERROR_EJECUCION');
    assert.ok(resNoOp.resultadoEjecucion?.includes('Falta el folio'));

    // Discrepancia
    const reqDisc = HrManagementService.requestModuleApproval({
      empresaId: tenantRut,
      modulo: 'COSTOS_PRODUCCION',
      agenteNombre: 'Agente Producción',
      operacionTipo: 'CIERRE_ORDEN_PRODUCCION',
      titulo: 'Liquidación Discrepancia',
      descripcion: 'Prueba',
      impactoFinancieroClp: 1000000,
      datosOperacion: {
        ordenId: 'OP-FAKE-01',
        lines: [
          { cuentaCodigo: '1.1.07', debe: 1400000, haber: 0 },
          { cuentaCodigo: '1.1.08', debe: 0, haber: 1400000 },
        ],
      },
      solicitadoPor: 'Agente Producción',
    });
    const resDisc = await HrManagementService.resolveApproval(reqDisc.id, 'USR-ADMIN', true);
    assert.strictEqual(resDisc.estado, 'ERROR_EJECUCION');
    assert.ok(resDisc.resultadoEjecucion?.includes('Discrepancia financiera'));

    // Coincidente con efecto verificable
    const opToClose: any = {
      id: `OP-CLOSE-${Date.now()}`,
      empresaId: tenantRut,
      folioOP: `OP-${Date.now().toString().slice(-4)}`,
      productoSku: 'SKU-PROD-99',
      productoNombre: 'Producto Prueba',
      cantidadObjetivo: 100,
      estado: 'EN_PROCESO',
    };
    diskPersistence.saveProductionOrder(opToClose);

    const reqOk = HrManagementService.requestModuleApproval({
      empresaId: tenantRut,
      modulo: 'COSTOS_PRODUCCION',
      agenteNombre: 'Agente Producción',
      operacionTipo: 'CIERRE_ORDEN_PRODUCCION',
      titulo: 'Liquidación Coincidente',
      descripcion: 'Prueba',
      impactoFinancieroClp: 850000,
      datosOperacion: {
        ordenId: opToClose.id,
        lines: [
          { cuentaCodigo: '1.1.07', debe: 850000, haber: 0 },
          { cuentaCodigo: '1.1.08', debe: 0, haber: 850000 },
        ],
      },
      solicitadoPor: 'Agente Producción',
    });
    const resOk = await HrManagementService.resolveApproval(reqOk.id, 'USR-ADMIN', true);
    assert.strictEqual(resOk.estado, 'EJECUTADO');
    assert.strictEqual(resOk.montoAprobadoClp, 850000);
    assert.strictEqual(resOk.montoEjecutadoClp, 850000);
    assert.strictEqual(resOk.montoAprobadoClp, resOk.montoEjecutadoClp);

    const opUpdated = diskPersistence.getProductionOrders(tenantRut).find(o => o.id === opToClose.id);
    assert.strictEqual(opUpdated?.estado, 'LIQUIDADA_TERMINADA');
    assert.ok(opUpdated?.fechaRealTermino);
  });

  // 4. EMITIR_ORDEN_COMPRA
  await test('Parte B.8.4 [Ejecutor Orden de Compra]: Compara monto aprobado vs ejecutado y rechaza discrepancia', async () => {
    // Discrepancia
    const reqDisc = HrManagementService.requestModuleApproval({
      empresaId: tenantRut,
      modulo: 'COMERCIAL_COMPRAS',
      agenteNombre: 'Agente Compras',
      operacionTipo: 'EMITIR_ORDEN_COMPRA',
      titulo: 'Emisión OC Discrepancia',
      descripcion: 'Prueba',
      impactoFinancieroClp: 500000,
      datosOperacion: {
        proveedorRut: '76.123.456-7',
        items: [{ sku: 'SKU-01', cantidad: 10, precioUnitarioCLP: 60000 }], // 600.000 != 500.000
      },
      solicitadoPor: 'Agente Compras',
    });
    const resDisc = await HrManagementService.resolveApproval(reqDisc.id, 'USR-ADMIN', true);
    assert.strictEqual(resDisc.estado, 'ERROR_EJECUCION');
    assert.ok(resDisc.resultadoEjecucion?.includes('Discrepancia financiera'));

    // Coincidente con efecto verificable
    const reqOk = HrManagementService.requestModuleApproval({
      empresaId: tenantRut,
      modulo: 'COMERCIAL_COMPRAS',
      agenteNombre: 'Agente Compras',
      operacionTipo: 'EMITIR_ORDEN_COMPRA',
      titulo: 'Emisión OC Coincidente',
      descripcion: 'Prueba',
      impactoFinancieroClp: 500000,
      datosOperacion: {
        proveedorRut: '76.123.456-7',
        proveedorRazonSocial: 'Proveedor Insumos Industriales SpA',
        items: [{ sku: 'SKU-01', cantidad: 10, precioUnitarioCLP: 50000 }], // 500.000 == 500.000
      },
      solicitadoPor: 'Agente Compras',
    });
    const resOk = await HrManagementService.resolveApproval(reqOk.id, 'USR-ADMIN', true);
    assert.strictEqual(resOk.estado, 'EJECUTADO');
    assert.strictEqual(resOk.montoAprobadoClp, 500000);
    assert.strictEqual(resOk.montoEjecutadoClp, 500000);
    assert.strictEqual(resOk.montoAprobadoClp, resOk.montoEjecutadoClp);

    const comState = commercialProcurementService.getState(tenantRut);
    const poCreated = (comState.ordenesCompra || []).find((po: any) => po.folio === (resOk as any).ordenCompraFolio);
    assert.ok(poCreated, 'La orden de compra emitida debe existir en ordenesCompra del estado comercial');
    assert.strictEqual(poCreated?.estado, 'EMITIDA');
    assert.strictEqual(poCreated?.totalNetoCLP, 500000);
  });

  // 5. CENTRALIZAR_RENDICION
  await test('Parte B.8.5 [Ejecutor Rendición]: Compara monto aprobado vs ejecutado y rechaza discrepancia o falta de reportId', async () => {
    // Falta reportId
    const reqNoRep = HrManagementService.requestModuleApproval({
      empresaId: tenantRut,
      modulo: 'RENDICIONES',
      agenteNombre: 'Agente Rendiciones',
      operacionTipo: 'CENTRALIZAR_RENDICION',
      titulo: 'Rendición sin ID',
      descripcion: 'Prueba',
      impactoFinancieroClp: 150000,
      datosOperacion: {
        lines: [
          { cuentaCodigo: '5.2.05', debe: 150000, haber: 0 },
          { cuentaCodigo: '1.1.01', debe: 0, haber: 150000 },
        ],
      },
      solicitadoPor: 'Agente Rendiciones',
    });
    const resNoRep = await HrManagementService.resolveApproval(reqNoRep.id, 'USR-ADMIN', true);
    assert.strictEqual(resNoRep.estado, 'ERROR_EJECUCION');
    assert.ok(resNoRep.resultadoEjecucion?.includes('Falta el identificador'));

    // Discrepancia
    const reqDisc = HrManagementService.requestModuleApproval({
      empresaId: tenantRut,
      modulo: 'RENDICIONES',
      agenteNombre: 'Agente Rendiciones',
      operacionTipo: 'CENTRALIZAR_RENDICION',
      titulo: 'Rendición Discrepancia',
      descripcion: 'Prueba',
      impactoFinancieroClp: 120000,
      datosOperacion: {
        reportId: 'REP-FAKE-01',
        lines: [
          { cuentaCodigo: '5.2.05', debe: 180000, haber: 0 },
          { cuentaCodigo: '1.1.01', debe: 0, haber: 180000 },
        ],
      },
      solicitadoPor: 'Agente Rendiciones',
    });
    const resDisc = await HrManagementService.resolveApproval(reqDisc.id, 'USR-ADMIN', true);
    assert.strictEqual(resDisc.estado, 'ERROR_EJECUCION');
    assert.ok(resDisc.resultadoEjecucion?.includes('Discrepancia financiera'));

    // Coincidente con efecto verificable
    const testReport: any = {
      id: `EXP-REP-${Date.now()}`,
      empresaId: tenantRut,
      rutEmpleado: '16.234.567-8',
      nombreEmpleado: 'Colaborador Gastos',
      fechaPresentacion: '2026-03-25',
      montoTotal: 175000,
      estado: 'APROBADA_POR_GERENCIA',
      comprobantes: [],
    };
    diskPersistence.saveExpenseReport(testReport);

    const reqOk = HrManagementService.requestModuleApproval({
      empresaId: tenantRut,
      modulo: 'RENDICIONES',
      agenteNombre: 'Agente Rendiciones',
      operacionTipo: 'CENTRALIZAR_RENDICION',
      titulo: 'Rendición Coincidente',
      descripcion: 'Prueba',
      impactoFinancieroClp: 175000,
      datosOperacion: {
        reportId: testReport.id,
        lines: [
          { cuentaCodigo: '5.2.05', debe: 175000, haber: 0 },
          { cuentaCodigo: '1.1.01', debe: 0, haber: 175000 },
        ],
      },
      solicitadoPor: 'Agente Rendiciones',
    });
    const resOk = await HrManagementService.resolveApproval(reqOk.id, 'USR-ADMIN', true);
    assert.strictEqual(resOk.estado, 'EJECUTADO');
    assert.strictEqual(resOk.montoAprobadoClp, 175000);
    assert.strictEqual(resOk.montoEjecutadoClp, 175000);
    assert.strictEqual(resOk.montoAprobadoClp, resOk.montoEjecutadoClp);

    const updatedRep = diskPersistence.getExpenseReports(tenantRut).find(r => r.id === testReport.id);
    assert.strictEqual(updatedRep?.estado, 'CONTABILIZADA_PAGADA');
  });

  // 6. EMITIR_DTE
  await test('Parte B.8.6 [Ejecutor DTE]: Compara monto aprobado vs ejecutado y rechaza discrepancia de monto', async () => {
    // Discrepancia: Aprobado por $800.000 pero el DTE totaliza $1.190.000 ($1.000.000 neto + IVA)
    const reqDisc = HrManagementService.requestModuleApproval({
      empresaId: tenantRut,
      modulo: 'FACTURACION_DTE',
      agenteNombre: 'Agente Facturador',
      operacionTipo: 'EMITIR_DTE',
      titulo: 'DTE Discrepancia',
      descripcion: 'Prueba',
      impactoFinancieroClp: 800000,
      datosOperacion: {
        tipoDte: 33,
        receptorRut: '77.798.901-4',
        montoTotal: 1190000,
        montoNeto: 1000000,
        montoIva: 190000,
        items: [{ nombre: 'Servicio', cantidad: 1, precioUnitario: 1000000, montoTotal: 1000000 }],
      },
      solicitadoPor: 'Agente Facturador',
    });

    const resDisc = await HrManagementService.resolveApproval(reqDisc.id, 'USR-ADMIN', true);
    assert.strictEqual(resDisc.estado, 'ERROR_EJECUCION');
    assert.ok(resDisc.resultadoEjecucion?.includes('Discrepancia financiera'));
  });

  console.log('\n========================================================================');
  console.log(`🎉 RESULTADO SUITE PARTE B & C: ${passed} de ${total} pruebas pasaron exitosamente (100%).`);
  console.log('========================================================================\n');
}

runAutonomousModulesSuite().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('\n❌ ERROR EN LA SUITE:', err);
  process.exit(1);
});
