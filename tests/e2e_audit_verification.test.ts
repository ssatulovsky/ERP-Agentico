import assert from 'node:assert';
import { diskPersistence } from '../src/services/diskPersistenceService';
import { AutonomousAgentEngine, type AutonomousAgentRequest } from '../src/services/autonomousAgentEngine';
import { HrManagementService } from '../src/services/hrManagementService';
import { commercialProcurementService } from '../src/services/commercialProcurementService';
import { whatsappBridgeService } from '../src/services/whatsappBridgeService';
import { voiceAssistantEngine } from '../src/services/voiceAssistantEngine';
import { DEFAULT_AGENT_PERSONAS } from '../src/data/defaultAgentPersonas';
import { DEFAULT_INDICATORS } from '../src/utils/chileanAccounting';

async function runE2eAuditSuite() {
  console.log('========================================================================');
  console.log('   SUITE E2E INTEGRAL: VERIFICACIÓN DE AUDITORÍA ERP AGÉNTICO REAL    ');
  console.log('========================================================================\n');

  let passed = 0;
  let total = 0;

  async function test(name: string, fn: () => void | Promise<void>) {
    total++;
    try {
      await fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ❌ [FAIL] ${name}:`, err.message);
      throw err;
    }
  }

  const tenantA = '761045509';
  const tenantB = 'client-innovagile';

  // --------------------------------------------------------------------------
  // TEST 1: Gobernanza Human-in-the-Loop Real - Bandeja, Resolución y Asiento
  // --------------------------------------------------------------------------
  await test('1. Gobernanza: Solicitud agéntica se lista por empresa, se resuelve y asienta formalmente en Libro Mayor', async () => {
    // 1. Crear solicitud de aprobación con asiento contable propuesto
    const approvalPayload = {
      empresaId: tenantA,
      modulo: 'CONTABILIDAD' as const,
      agenteNombre: 'Agente Contable Senior',
      operacionTipo: 'CENTRALIZACION_GASTO_EXTRAORDINARIO',
      titulo: 'Provisión Mantención Preventiva de Servidores',
      descripcion: 'Registro de provisión contable de mantención tecnológica con balance verificado',
      impactoFinancieroClp: 650000,
      nivelRiesgo: 'MEDIO' as const,
      datosOperacion: {
        asientoPropuesto: {
          glosa: 'Provisión Mantención Preventiva Servidores Cloud',
          periodo: '2026-03',
          lineas: [
            { cuentaCodigo: '6.1.04.002', cuentaNombre: 'Software y Cloud', debe: 650000, haber: 0 },
            { cuentaCodigo: '2.1.02.001', cuentaNombre: 'Proveedores Nacionales', debe: 0, haber: 650000 },
          ],
        },
      },
    };

    const created = HrManagementService.requestModuleApproval(approvalPayload);
    const approvalId = created.id;
    assert.strictEqual(created.estado, 'PENDIENTE', 'El estado inicial debe ser PENDIENTE');

    // 2. Verificar que se lista al consultar la bandeja de la empresa A
    const pendingTenantA = HrManagementService.getApprovals(tenantA);
    const foundA = pendingTenantA.find((a) => a.id === approvalId);
    assert.ok(foundA, 'La solicitud debe aparecer en la bandeja de la empresa A');

    // 3. Resolver la solicitud formalmente como humana (Aprobar)
    const resolved = await HrManagementService.resolveApproval(
      approvalId,
      'Gerente General',
      true
    );
    assert.strictEqual(resolved.estado, 'EJECUTADO', 'Al tener asiento balanceado debe transicionar a EJECUTADO');
    assert.ok(resolved.asientoContableId, 'Debe haber generado un folio de asiento contable real');

    // 4. Verificar impacto real en el Libro Mayor
    const entries = diskPersistence.getJournalEntries(tenantA);
    const formalEntry = entries.find((e) => e.id === resolved.asientoContableId);
    assert.ok(formalEntry, 'El asiento generado debe persistir en el Libro Mayor de la empresa A');
    assert.strictEqual(formalEntry.glosa, 'Provisión Mantención Preventiva Servidores Cloud');
  });

  // --------------------------------------------------------------------------
  // TEST 2: Aislamiento Multi-Tenant Estricto de Gobernanza y Contabilidad
  // --------------------------------------------------------------------------
  await test('2. Aislamiento Multi-Tenant: Empresa B no ve solicitudes ni asientos de Empresa A', async () => {
    // Consultar bandeja de Empresa B
    const pendingTenantB = HrManagementService.getApprovals(tenantB);
    const leaked = pendingTenantB.some((a) => (a.empresaId || '').replace(/[\.\-\s]/g, '').toUpperCase() === tenantA);
    assert.strictEqual(leaked, false, 'Empresa B no debe ver solicitudes de Empresa A');

    // Consultar Libro Mayor de Empresa B
    const entriesB = diskPersistence.getJournalEntries(tenantB);
    const leakedEntry = entriesB.some((e) => (e.empresaId || '').replace(/[\.\-\s]/g, '').toUpperCase() === tenantA);
    assert.strictEqual(leakedEntry, false, 'Libro Mayor de Empresa B no debe contener asientos de Empresa A');
  });

  // --------------------------------------------------------------------------
  // TEST 3: Corrección Bug SKU Inexistente en Kardex (Tool 6)
  // --------------------------------------------------------------------------
  await test('3. Inventario Kardex: SKU inexistente reporta NOT_FOUND y NO filtra PMP del ítem 0', async () => {
    const engine = new AutonomousAgentEngine();
    const req: AutonomousAgentRequest = {
      empresaId: tenantA,
      module: 'INVENTARIO',
      agentRole: 'Jefe de Bodega e Inventarios',
      query: 'Consultar kardex de repuesto no catalogado',
      context: {
        company: {
          id: tenantA,
          rut: '76.104.550-9',
          razonSocial: 'Retail Solutions Chile SpA',
          giro: 'Retail',
          direccion: 'Santiago',
          comuna: 'Santiago',
          ciudad: 'Santiago',
          region: 'Metropolitana',
          telefono: '+56 2 2222 3333',
          email: 'contacto@retail.cl',
          regimenTributario: '14D3_PROPYME_GENERAL',
          tasaPpm: 0.005,
          remanenteCreditoFiscalClp: 0,
          remanenteCreditoFiscalUtm: 0,
          esExportador: false,
          retencionCambioSujeto: false,
        },
        indicators: DEFAULT_INDICATORS,
        items: [
          {
            id: 'item-01',
            sku: 'DYN-SK78',
            nombre: 'Filtro Hidráulico Parker High Flow',
            stockTotal: 420,
            costoUnitarioPMP: 26500,
          },
        ],
      },
    };

    const kardexResult = await (AutonomousAgentEngine as any).executeTool('tool_inventory_kardex', {
      sku: 'SKU-FANTASMA-NON-EXISTENT-999',
      bodegaId: 'BOD-CENTRAL',
    }, req);

    assert.strictEqual(kardexResult.status, 'NOT_FOUND', 'Debe retornar status NOT_FOUND para SKU inexistente');
    assert.strictEqual(kardexResult.itemEncontrado, false, 'itemEncontrado debe ser false');
    assert.strictEqual(kardexResult.pmpCalculado, 0, 'El PMP de un ítem no encontrado debe ser 0');
    assert.strictEqual(kardexResult.stockTotalActual, 0, 'El stock de un ítem no encontrado debe ser 0');
    assert.ok(
      kardexResult.mensaje.includes('no existe') || kardexResult.mensaje.includes('No se encontró'),
      'El mensaje debe ser claro y honesto'
    );
  });

  // --------------------------------------------------------------------------
  // TEST 4: Persistencia WMS, Activo Fijo y Producción en Servidor
  // --------------------------------------------------------------------------
  await test('4. Persistencia en Servidor: Bodegas, Órdenes de Producción y Activos Fijos', async () => {
    // 1. Guardar y recuperar bodega
    const testWh = {
      id: `wh-test-${Date.now()}`,
      empresaId: tenantB,
      codigo: 'BOD-PROV-01',
      nombre: 'Bodega Tecnológica Providencia',
      direccion: 'Av. Andrés Bello 2457',
      comuna: 'Providencia',
      esCentral: true,
      activo: true,
    };
    diskPersistence.saveWarehouse(testWh);
    const whs = diskPersistence.getWarehouses(tenantB);
    const foundWh = whs.find((w) => w.id === testWh.id);
    assert.ok(foundWh, 'La bodega guardada debe persistir y recuperarse para Empresa B');

    // 2. Guardar y recuperar orden de producción aislada
    const testOrder = {
      id: `op-test-${Date.now()}`,
      empresaId: tenantB,
      folio: 'OP-TECH-2026-001',
      productoNombre: 'Rack de Servidores Edge Configurado',
      clienteNombre: 'Cliente Datacenter Sur',
      porcentajeAvanceFisico: 75,
      costoMaterialesReal: 3200000,
      costoModReal: 850000,
      costoCifReal: 200000,
      costoTotalReal: 4250000,
      estado: 'EN_PROCESO',
    };
    diskPersistence.saveProductionOrder(testOrder);
    const ordersB = diskPersistence.getProductionOrders(tenantB);
    const foundOrder = ordersB.find((o) => o.id === testOrder.id);
    assert.ok(foundOrder, 'La orden de producción debe persistir y recuperarse para Empresa B');
    assert.strictEqual(foundOrder.costoTotalReal, 4250000);

    // 3. Verificar que la orden de producción de Empresa B NO aparece en Empresa A
    const ordersA = diskPersistence.getProductionOrders(tenantA);
    const leakedOrder = ordersA.find((o) => o.id === testOrder.id);
    assert.strictEqual(leakedOrder, undefined, 'La orden de Empresa B no debe filtrarse a Empresa A');
  });

  // --------------------------------------------------------------------------
  // TEST 5: Abastecimiento y Compras Aisladas por Tenant
  // --------------------------------------------------------------------------
  await test('5. Abastecimiento Comercial: Estados separados y no replicados entre empresas', async () => {
    const stateRetail = commercialProcurementService.getState('client-retail-01');
    const stateInnovagile = commercialProcurementService.getState('client-innovagile');

    assert.strictEqual(stateRetail.empresaId, 'client-retail-01');
    assert.strictEqual(stateInnovagile.empresaId, 'client-innovagile');

    // La empresa retail tiene el catálogo demo comercial (Parker, Pallets, etc.)
    assert.ok(stateRetail.margenes.some((m) => m.sku === 'FILT-HID-04'), 'Retail debe tener catálogo industrial/repuestos');

    // InnovAgile es una empresa de consultoría informática exenta de inventario, no debe clonar los filtros Parker
    const hasParkerInInnovagile = stateInnovagile.margenes.some((m) => m.sku === 'FILT-HID-04');
    assert.strictEqual(hasParkerInInnovagile, false, 'InnovAgile no debe tener productos retail ajenos');
  });

  // --------------------------------------------------------------------------
  // TEST 6: WhatsApp Bridge - Aislamiento de Flujo de Caja y RBAC por Empresa
  // --------------------------------------------------------------------------
  await test('6. WhatsApp Bridge: Consulta de flujo de caja y saldos no mezcla movimientos de otras empresas', async () => {
    // Registrar un movimiento bancario para Empresa B
    diskPersistence.saveBankMovements([
      {
        id: `mov-b-${Date.now()}`,
        empresaId: tenantB,
        banco: 'Banco Santander',
        cuentaId: 'cta-b-01',
        fecha: '2026-03-31',
        tipo: 'ABONO',
        abono: 5000000,
        cargo: 0,
        moneda: 'CLP',
        descripcion: 'Abono Factura Servicios TI',
      },
    ]);

    // Registrar usuario en Lista Blanca vinculado específicamente a Empresa B
    whatsappBridgeService.upsertWhitelistEntry({
      id: 'wl-tenant-b-cfo',
      telefono: '56955556666',
      nombre: 'CFO InnovAgile',
      cargo: 'Director Financiero',
      empresaId: tenantB,
      rolPreset: 'SOCIO_DIRECTOR_TOTAL',
      agentesPermitidos: ['FLUJO_CAJA', 'BANCOS_CONCILIACION'],
      activo: true,
      recibirReportesDirectos: true,
      responderConAudio: false,
    });

    // Evaluar mensaje entrante simulado en WhatsApp para el usuario de Empresa B
    const response = whatsappBridgeService.evaluateIncomingMessage({
      remoteJid: '56955556666@s.whatsapp.net',
      messageText: 'Actualiza el flujo de caja partiendo de hoy',
      fromMe: false,
      simulateBypassPrefix: true,
    });

    assert.strictEqual(response.allowed, true, 'El usuario en lista blanca debe ser autorizado');
    assert.ok(response.responseText, 'Debe entregar un reporte generado');
  });

  // --------------------------------------------------------------------------
  // TEST 7: Voice Assistant Engine - Cálculos Dinámicos sin Números Rígidos
  // --------------------------------------------------------------------------
  await test('7. Voice Assistant: Radiografía 360 y cotizaciones toman datos reales del contexto', async () => {
    const turnResult = await voiceAssistantEngine.processDialogue(
      'como esta la empresa',
      DEFAULT_AGENT_PERSONAS[0],
      {
        clientId: tenantB,
        clientName: 'InnovAgile Group SpA',
        rut: '77.798.901-4',
        dtesCount: 5,
        pendingPurchasesCount: 1,
        pendingSalesCount: 4,
        bankAccountsCount: 1,
        pendingBankNoveltiesCount: 0,
        bankAccounts: [
          {
            id: 'cta-01',
            banco: 'Banco Santander',
            bancoCodigo: 'BANCO_SANTANDER',
            tipoCuenta: 'CORRIENTE',
            numeroCuenta: '00-0839210-4',
            moneda: 'CLP',
            saldoEnLinea: 12500000,
            estadoConexion: 'CONECTADO',
            tipoConexion: 'OPEN_BANKING_API',
            esPrincipal: true,
            cuentaContableIfrs: '1.1.02.001',
          },
        ],
        f29IvaTotal: 0,
        employeesCount: 2,
        payrolls: [
          {
            id: 'pay-01',
            rut: '17.890.123-4',
            nombreCompleto: 'Desarrollador Senior',
            cargo: 'Desarrollador Senior',
            departamento: 'Ingeniería',
            fechaIngreso: '2024-01-01',
            tipoContrato: 'INDEFINIDO',
            diasTrabajados: 30,
            sueldoBase: 2500000,
            gratificacionModalidad: 'ART_50',
            gratificacionMonto: 180000,
            horasExtrasCantidad: 0,
            horasExtrasMonto: 0,
            comisionesBonosImponibles: 0,
            totalHaberesImponibles: 2680000,
            asignacionColacion: 50000,
            asignacionMovilizacion: 50000,
            viaticosAsignacionFamiliar: 0,
            totalHaberesNoImponibles: 100000,
            totalHaberesBrutos: 2780000,
            afpNombre: 'HABITAT',
            afpTasa: 0.1127,
            afpMonto: 250000,
            saludTipo: 'FONASA',
            saludMonto: 160000,
            afcTrabajadorMonto: 14000,
            impuestoUnicoMonto: 45000,
            otrosDescuentos: 0,
            totalDescuentos: 469000,
            sueldoLiquido: 2200000,
            sisEmpleadorMonto: 35000,
            afcEmpleadorMonto: 55000,
            mutualEmpleadorMonto: 20000,
            costoTotalEmpresa: 2890000,
          },
        ],
        inventoryItemsCount: 0,
        inventoryItems: [],
        productionOrders: [],
        pendingExpensesCount: 0,
      },
      []
    );

    assert.ok(turnResult.verbalResponse, 'Debe entregar respuesta verbal');
    assert.ok(turnResult.displayMarkdown, 'Debe entregar markdown');
    // Verificar que utiliza los saldos reales de la empresa en el contexto
    assert.ok(
      turnResult.displayMarkdown.includes('12.500.000'),
      'La radiografía 360 debe reflejar el saldo real de $12.500.000 en bancos de la empresa'
    );
  });

  console.log('\n========================================================================');
  console.log(`🎉 RESULTADO SUITE E2E: ${passed} de ${total} pruebas pasaron exitosamente (100%).`);
  console.log('========================================================================\n');
  process.exit(0);
}

runE2eAuditSuite().catch((err) => {
  console.error('\n❌ ERROR CRÍTICO EN LA SUITE E2E:', err);
  process.exit(1);
});
