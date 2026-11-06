import assert from 'node:assert';
import { AutonomousAgentEngine } from '../src/services/autonomousAgentEngine';
import { diskPersistence } from '../src/services/diskPersistenceService';
import { MODULE_AGENTS_REGISTRY } from '../src/services/moduleAgentGovernanceService';
import { HrManagementService } from '../src/services/hrManagementService';

async function runTests() {
  console.log('🧪 ============================================================');
  console.log('   SUITE DE PRUEBAS AUTOMATIZADAS: MOTOR AGÉNTICO Y TOOLS ERP  ');
  console.log('============================================================\n');

  let passed = 0;
  let total = 0;

  function test(name: string, fn: () => void | Promise<void>) {
    total++;
    try {
      const res = fn();
      if (res instanceof Promise) {
        return res
          .then(() => {
            console.log(`  ✅ [PASS] ${name}`);
            passed++;
          })
          .catch((err) => {
            console.error(`  ❌ [FAIL] ${name}:`, err.message);
            throw err;
          });
      }
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ❌ [FAIL] ${name}:`, err.message);
      throw err;
    }
  }

  // TEST 1: Cobertura de Gobernanza de los 11 Módulos ERP
  await test('Gobernanza: Registro completo de 11 Agentes Especialistas', () => {
    assert.strictEqual(MODULE_AGENTS_REGISTRY.length, 11, 'Deben existir exactamente 11 agentes de módulo registrados');
    const moduleIds = MODULE_AGENTS_REGISTRY.map(a => a.moduloId);
    const required = [
      'CONTABILIDAD',
      'TRIBUTARIO_SII',
      'TESORERIA',
      'COMERCIAL_COMPRAS',
      'RRHH',
      'INVENTARIO',
      'ACTIVO_FIJO',
      'FLUJO_CAJA',
      'COSTOS_PRODUCCION',
      'CONCILIACION',
      'RENDICIONES',
    ];
    for (const req of required) {
      assert.ok(moduleIds.includes(req), `Módulo ${req} debe estar registrado en la gobernanza`);
    }
  });

  // TEST 2: F29 Cálculo con segregación Ventas vs Compras, Notas de Crédito y sin payrolls
  await test('Tool F29: Segregación Ventas/Compras y Deducción de Notas de Crédito (Tipo 61)', async () => {
    const testRut = '761045509';
    const periodo = '2026-03';

    // Inyectar DTEs en disco para el test
    diskPersistence.addDtes([
      {
        id: 'dte-venta-1',
        empresaId: testRut,
        periodo,
        tipoOperacion: 'VENTA',
        tipoDte: 33,
        folio: 1001,
        rutEmisor: '76.104.550-9',
        rutReceptor: '12.345.678-5',
        montoNeto: 1000000,
        montoIva: 190000,
        montoTotal: 1190000,
      },
      {
        id: 'dte-nc-venta-1',
        empresaId: testRut,
        periodo,
        tipoOperacion: 'VENTA',
        tipoDte: 61, // Nota de Crédito resta a las ventas
        folio: 50,
        rutEmisor: '76.104.550-9',
        rutReceptor: '12.345.678-5',
        montoNeto: 100000,
        montoIva: 19000,
        montoTotal: 119000,
      },
      {
        id: 'dte-compra-1',
        empresaId: testRut,
        periodo,
        tipoOperacion: 'COMPRA',
        tipoDte: 33,
        folio: 8820,
        rutEmisor: '99.555.444-1',
        rutReceptor: '76.104.550-9',
        montoNeto: 500000,
        montoIva: 95000,
        montoTotal: 595000,
      },
    ]);

    const res = await (AutonomousAgentEngine as any).executeTool(
      'tool_tax_calculate_f29',
      {
        rutEmpresa: testRut,
        periodo,
        ppmTasa: 0.015,
        remanenteMesAnterior: 0,
      },
      { company: { rut: testRut, razonSocial: 'Empresa Test SpA' } }
    );

    assert.strictEqual(res.status, 'SUCCESS');
    // Débito = 190.000 (Venta) - 19.000 (NC) = 171.000
    assert.strictEqual(res.debitoFiscalIva, 171000, 'El débito fiscal debe restar la nota de crédito');
    // Crédito = 95.000
    assert.strictEqual(res.creditoFiscalIva, 95000, 'El crédito fiscal debe considerar solo compras');
    // Base Imponible Ventas = 1.000.000 - 100.000 = 900.000
    assert.strictEqual(res.ventasNetas, 900000, 'Base de ventas debe descontar nota de crédito');
    // PPM = 900.000 * 1.5% = 13.500
    assert.strictEqual(res.ppmDeterminado, 13500, 'PPM calculado sobre ventas netas');
    // IVA a pagar = 171.000 - 95.000 = 76.000 + 13.500 PPM = 89.500
    assert.strictEqual(res.totalPagarF29, 89500, 'Total a pagar cuadra exactamente');
  });

  // TEST 3: Asientos Contables: Asiento balanceado retorna SUCCESS
  await test('Tool Asiento: Asiento balanceado valida y retorna SUCCESS', async () => {
    const res = await (AutonomousAgentEngine as any).executeTool(
      'tool_accounting_propose_entry',
      {
        periodo: '2026-03',
        glosa: 'Centralización de Ventas del Período',
        lineas: [
          { codigoCuenta: '1.1.03', nombreCuenta: 'Clientes Nacionales', debe: 1190000, haber: 0 },
          { codigoCuenta: '4.1.01', nombreCuenta: 'Ingresos por Ventas', debe: 0, haber: 1000000 },
          { codigoCuenta: '2.1.05', nombreCuenta: 'IVA Débito Fiscal', debe: 0, haber: 190000 },
        ],
      },
      { company: { rut: '76.104.550-9', razonSocial: 'Empresa Test' } }
    );

    assert.strictEqual(res.status, 'SUCCESS', 'Asiento cuadrado debe retornar SUCCESS');
    assert.strictEqual(res.partidaDobleValida, true);
    assert.strictEqual(res.totalDebe, 1190000);
    assert.strictEqual(res.totalHaber, 1190000);
    assert.strictEqual(res.diferencia, 0);
  });

  // TEST 4: Asiento Descuadrado NO arroja excepción ni aborta el bucle; devuelve UNBALANCED_ENTRY_ERROR
  await test('Tool Asiento: Asiento descuadrado NO aborta el bucle y devuelve UNBALANCED_ENTRY_ERROR para auto-corrección', async () => {
    const res = await (AutonomousAgentEngine as any).executeTool(
      'tool_accounting_propose_entry',
      {
        periodo: '2026-03',
        glosa: 'Asiento intencionalmente descuadrado',
        lineas: [
          { codigoCuenta: '1.1.03', nombreCuenta: 'Clientes Nacionales', debe: 1000000, haber: 0 },
          { codigoCuenta: '4.1.01', nombreCuenta: 'Ingresos por Ventas', debe: 0, haber: 900000 },
        ],
      },
      { company: { rut: '76.104.550-9', razonSocial: 'Empresa Test' } }
    );

    assert.strictEqual(res.status, 'UNBALANCED_ENTRY_ERROR', 'Debe retornar UNBALANCED_ENTRY_ERROR');
    assert.strictEqual(res.partidaDobleValida, false);
    assert.strictEqual(res.diferencia, 100000, 'Diferencia de 100.000 reportada');
    assert.ok(res.observacion, 'Debe incluir observación con instrucciones de auto-corrección para el LLM');
  });

  // TEST 5: Conciliación Bancaria con Multi-Criterio (RUT, Tolerancia Fechas y Monto)
  await test('Tool Conciliación: Match multi-criterio de movimiento bancario con asiento contable', async () => {
    const testEmpresa = '761045509';
    // Registrar asiento previo en disco para conciliar
    diskPersistence.addAccountingEntry(
      {
        id: 'entry-test-conc-1',
        empresaId: testEmpresa,
        periodo: '2026-03',
        fecha: '2026-03-12',
        concepto: 'Pago Factura Proveedor 77.888.999-0',
        rutContraparte: '77.888.999-0',
        totalDebe: 350000,
        totalHaber: 350000,
      },
      [
        { id: 'line-1', entryId: 'entry-test-conc-1', codigoCuenta: '2.1.01', nombreCuenta: 'Proveedores', debe: '350000', haber: '0', rutAuxiliar: '77.888.999-0' },
        { id: 'line-2', entryId: 'entry-test-conc-1', codigoCuenta: '1.1.01', nombreCuenta: 'Banco Santander', debe: '0', haber: '350000', rutAuxiliar: '77.888.999-0' },
      ]
    );

    const res = await (AutonomousAgentEngine as any).executeTool(
      'tool_bank_reconcile_movement',
      {
        rutEmpresa: testEmpresa,
        cuentaBancaria: 'Banco Santander',
      },
      {
        empresaId: testEmpresa,
        company: { rut: testEmpresa },
        context: {
          movements: [
            {
              id: 'mov-banco-99',
              monto: 350000,
              cargo: 350000,
              fecha: '2026-03-14', // 2 días después (dentro del clearing bancario de 3 días)
              rutAuxiliar: '77.888.999-0',
              descripcion: 'Transferencia a Proveedor Insumos',
            },
          ],
        },
      }
    );

    assert.strictEqual(res.status, 'SUCCESS', 'Debe ejecutar la conciliación con éxito');
    assert.strictEqual(res.movimientosConciliadosAutomaticamente, 1, 'Debe calzar exactamente 1 movimiento');
    assert.strictEqual(res.calcesMuestra[0].asientoId, 'entry-test-conc-1', 'Debe vincular al asiento correcto');
    assert.ok(res.calcesMuestra[0].score >= 75, 'Score de alta confianza alcanzado');
  });

  // TEST 6: Finiquito Legal Art. 161 & Descuento AFC Art. 13 Ley 19.728
  await test('Tool Finiquito: Cálculo con tope de 90 UF e imputación aporte AFC empleador', async () => {
    const res = await (AutonomousAgentEngine as any).executeTool(
      'tool_hr_calculate_finiquito',
      {
        empresaId: '761045509',
        rutColaborador: '15.678.901-2',
        nombreCompleto: 'Carlos Mendoza Silva',
        fechaIngreso: '2023-01-01',
        fechaDespido: '2026-03-31',
        causal: 'ART_161_NECESIDADES_DE_LA_EMPRESA',
        sueldoBase: 1200000,
        promedioGratificacion: 200000,
        diasVacacionesPendientes: 10,
        diasAvisoPrevioOtorgados: 0,
        afpNombre: 'HABITAT',
        tipoContrato: 'INDEFINIDO',
      },
      { company: { rut: '761045509', razonSocial: 'Empresa Test' }, indicators: { uf: 38500, imm: 500000 } }
    );

    assert.strictEqual(res.status, 'SUCCESS');
    assert.strictEqual(res.aniosComputables, 3, '3 años de antigüedad completa');
    assert.ok(res.indemnizacionAnosServicio > 0, 'Indemnización por años de servicio calculada');
    assert.ok(res.indemnizacionAvisoPrevio > 0, 'Indemnización sustitutiva de preaviso calculada');
    assert.ok(res.descuentoAfcEmpleador > 0, 'Descuento AFC empleador aplicado conforme Art. 13 Ley 19.728');
    assert.ok(res.totalFiniquitoLiquido > 0, 'Líquido de finiquito positivo');
  });

  // TEST 7: Cierre del Ciclo de Gobernanza Human-in-the-Loop
  await test('Gobernanza: Cierre del bucle al aprobar solicitud (impacto real en Libro Mayor)', async () => {
    const req = HrManagementService.requestModuleApproval({
      empresaId: '761045509',
      modulo: 'RRHH',
      agenteNombre: 'Sofía Castro',
      operacionTipo: 'CENTRALIZACION_FINIQUITO',
      titulo: 'Finiquito Operario Planta',
      descripcion: 'Aprobación de liquidación de término',
      datosOperacion: {
        asientoContable: {
          id: 'entry-finiquito-approved',
          fecha: '2026-03-31',
          concepto: 'Centralización Finiquito Legal',
          lineas: [
            { cuentaCodigo: '5.2.07', cuentaNombre: 'Indemnizaciones Legales', debe: 1500000, haber: 0 },
            { cuentaCodigo: '2.1.07', cuentaNombre: 'Finiquitos por Pagar', debe: 0, haber: 1500000 },
          ],
        },
      },
      impactoFinancieroClp: 1500000,
      riesgoNivel: 'ALTO',
      nivelRiesgo: 'ALTO',
    });

    const resolution = await HrManagementService.resolveApproval(req.id, 'USR-CEO-01', true);
    assert.strictEqual(resolution.estado, 'EJECUTADO', 'El estado debe transicionar a EJECUTADO');

    // Verificar que el asiento ingresó a diskPersistence
    const entries = diskPersistence.getJournalEntries('761045509');
    const match = entries.find((e: any) => e.concepto === 'Centralización Finiquito Legal');
    assert.ok(match, 'El asiento contable aprobado debe registrarse en el Libro Diario');
  });

  console.log('\n============================================================');
  console.log(`🎉 RESULTADO: ${passed} de ${total} pruebas pasaron exitosamente (100%).`);
  console.log('============================================================\n');
}

runTests().catch((err) => {
  console.error('FATAL TEST ERROR:', err);
  process.exit(1);
});
