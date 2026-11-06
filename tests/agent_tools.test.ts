import assert from 'node:assert';
import crypto from 'node:crypto';
import { AutonomousAgentEngine, type AutonomousAgentRequest } from '../src/services/autonomousAgentEngine';
import { diskPersistence } from '../src/services/diskPersistenceService';
import { MODULE_AGENTS_REGISTRY } from '../src/services/moduleAgentGovernanceService';
import { HrManagementService } from '../src/services/hrManagementService';
import { HttpDteBillingService } from '../src/services/httpDteBillingService';
import { DEFAULT_INDICATORS } from '../src/utils/chileanAccounting';
import type { CompanyProfile } from '../src/types';

async function runAutomatedAgentSuite() {
  console.log('============================================================');
  console.log('   SUITE FORMAL DE PRUEBAS: 8 TOOLS AGÉNTICAS Y GOBERNANZA  ');
  console.log('============================================================\n');

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

  const defaultCompany: CompanyProfile = {
    id: '761045509',
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
    empresaId: '761045509',
    module: 'CONTABILIDAD',
    agentRole: 'Agente Auditor Contable y Tributario Senior',
    query: 'Auditoría automatizada de herramientas del ERP',
    context: {
      company: defaultCompany,
      empresa: defaultCompany,
      indicators: DEFAULT_INDICATORS,
    },
  };

  // ==========================================================================
  // 1. GOBERNANZA: 11 AGENTES ESPECIALISTAS DE MÓDULO REGISTRADOS
  // ==========================================================================
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

  // ==========================================================================
  // 2. TOOL 1: tool_hr_calculate_finiquito
  // ==========================================================================
  await test('Tool 1 [tool_hr_calculate_finiquito]: Cálculo legal de finiquito con tope 90 UF y descuento AFC', async () => {
    const res = await (AutonomousAgentEngine as any).executeTool(
      'tool_hr_calculate_finiquito',
      {
        colaboradorId: 'emp-1',
        fechaTermino: '2026-03-31',
        causalLegal: 'NECESIDADES_EMPRESA_ART_161',
        diasVacacionesPendientes: 14.5,
      },
      baseRequest
    );

    assert.strictEqual(res.status, 'SUCCESS', 'Cálculo de finiquito debe retornar SUCCESS');
    assert.ok(res.indemnizacionAnosServicio > 0, 'Indemnización por años de servicio calculada');
    assert.ok(res.indemnizacionAvisoPrevio > 0, 'Indemnización sustitutiva de preaviso calculada');
    assert.ok(res.descuentoAfcEmpleador > 0, 'Descuento AFC empleador aplicado conforme Art. 13 Ley 19.728');
    assert.ok(res.totalFiniquitoLiquido > 0, 'Líquido de finiquito positivo');
  });

  // ==========================================================================
  // 3. TOOL 2: tool_hr_calculate_payroll
  // ==========================================================================
  await test('Tool 2 [tool_hr_calculate_payroll]: Liquidación de sueldos con aportes patronales y previsionales', async () => {
    const res = await (AutonomousAgentEngine as any).executeTool(
      'tool_hr_calculate_payroll',
      {
        colaboradorId: 'emp-1',
        periodo: '2026-03',
        sueldoBase: 950000,
        horasExtrasCantidad: 6,
      },
      baseRequest
    );

    assert.strictEqual(res.status, 'SUCCESS', 'Debe retornar SUCCESS');
    assert.ok(res.sueldoLiquido > 0, 'Debe computar sueldo líquido');
    assert.ok(res.totalHaberesImponibles >= 950000, 'Imponible debe incluir base');
    assert.ok(res.totalDescuentosLegales > 0, 'Descuentos previsionales obligatorios aplicados');
  });

  // ==========================================================================
  // 4. TOOL 3: tool_accounting_propose_entry (Balanceado vs Descuadrado)
  // ==========================================================================
  await test('Tool 3 [tool_accounting_propose_entry]: Asiento balanceado valida y retorna SUCCESS', async () => {
    const res = await (AutonomousAgentEngine as any).executeTool(
      'tool_accounting_propose_entry',
      {
        glosa: 'Centralización Compra Equipamiento Servidores',
        fecha: '2026-03-31',
        lineas: [
          { cuentaCodigo: '1.2.01.004', cuentaNombre: 'Equipos Computacionales', debe: 1000000, haber: 0 },
          { cuentaCodigo: '1.1.05.001', cuentaNombre: 'IVA Crédito Fiscal', debe: 190000, haber: 0 },
          { cuentaCodigo: '2.1.02.001', cuentaNombre: 'Proveedores Nacionales', debe: 0, haber: 1190000 },
        ],
      },
      baseRequest
    );

    assert.strictEqual(res.status, 'SUCCESS');
    assert.strictEqual(res.asientoContable.totalDebe, 1190000);
    assert.strictEqual(res.asientoContable.totalHaber, 1190000);
  });

  await test('Tool 3 [tool_accounting_propose_entry]: Asiento descuadrado NO aborta el bucle y devuelve UNBALANCED_ENTRY_ERROR', async () => {
    const res = await (AutonomousAgentEngine as any).executeTool(
      'tool_accounting_propose_entry',
      {
        glosa: 'Asiento con descuadre deliberado',
        fecha: '2026-03-31',
        lineas: [
          { cuentaCodigo: '1.1.01.001', cuentaNombre: 'Caja General', debe: 500000, haber: 0 },
          { cuentaCodigo: '4.1.01.001', cuentaNombre: 'Ventas del Giro', debe: 0, haber: 400000 },
        ],
      },
      baseRequest
    );

    assert.strictEqual(res.status, 'UNBALANCED_ENTRY_ERROR', 'Debe retornar UNBALANCED_ENTRY_ERROR');
    assert.ok(res.diferencia === 100000 || res.diferencia === -100000, 'Debe indicar la diferencia exacta de $100.000');
    assert.ok(res.sugerenciaCorreccion, 'Debe proveer sugerencia para auto-corrección del LLM');
  });

  // ==========================================================================
  // 5. TOOL 4: tool_sii_query_rcv (Honestidad de datos y trazabilidad)
  // ==========================================================================
  await test('Tool 4 [tool_sii_query_rcv]: Responde honestamente NO_DATA cuando no hay documentos locales ni remotos', async () => {
    const res = await (AutonomousAgentEngine as any).executeTool(
      'tool_sii_query_rcv',
      {
        periodo: '2026-08',
        tipoOperacion: 'VENTAS',
      },
      baseRequest
    );

    assert.strictEqual(res.status, 'NO_DATA', 'Debe retornar NO_DATA cuando no hay documentos');
    assert.strictEqual(res.totalDocumentos, 0);
    assert.ok(Array.isArray(res.documentos));
    assert.notStrictEqual(res.origenDatos, 'REGISTRO_OFICIAL_SII_SIN_MOVIMIENTOS', 'NO debe afirmar ser registro oficial sin consulta remota');
  });

  await test('Tool 4 [tool_sii_query_rcv]: Retorna SUCCESS y origen local cuando existen documentos en contexto o base local', async () => {
    const reqWithDocs: AutonomousAgentRequest = {
      ...baseRequest,
      context: {
        ...baseRequest.context,
        dtes: [
          { id: 'dte-rcv-1', tipoDte: 33, folio: 120, montoNeto: 500000, montoIva: 95000, montoTotal: 595000, tipoOperacion: 'VENTA' }
        ],
      },
    };

    const res = await (AutonomousAgentEngine as any).executeTool(
      'tool_sii_query_rcv',
      {
        periodo: '2026-08',
        tipoOperacion: 'VENTAS',
      },
      reqWithDocs
    );

    assert.strictEqual(res.status, 'SUCCESS');
    assert.strictEqual(res.totalDocumentos, 1);
    assert.strictEqual(res.origenDatos, 'BASE_DATOS_LOCAL_ERP');
  });

  // ==========================================================================
  // 6. TOOL 5: tool_tax_calculate_f29 (DL 825, Proporcionalidad y Remanente)
  // ==========================================================================
  await test('Tool 5 [tool_tax_calculate_f29]: Cálculo completo con proporcionalidad, notas de crédito y remanente reajustado', async () => {
    const sampleDtes = [
      {
        id: 'dte-v1',
        tipoDte: 33,
        folio: 101,
        emisorRut: '76.104.550-9',
        receptorRut: '77.798.901-4',
        tipoOperacion: 'VENTA',
        montoNeto: 1000000,
        montoIva: 190000,
        montoTotal: 1190000,
      },
      {
        id: 'dte-nc1',
        tipoDte: 61,
        folio: 5,
        emisorRut: '76.104.550-9',
        receptorRut: '77.798.901-4',
        tipoOperacion: 'VENTA',
        montoNeto: 100000,
        montoIva: 19000,
        montoTotal: 119000,
      },
      {
        id: 'dte-c1',
        tipoDte: 33,
        folio: 550,
        emisorRut: '76.888.999-1',
        receptorRut: '76.104.550-9',
        tipoOperacion: 'COMPRA',
        montoNeto: 500000,
        montoIva: 95000,
        montoIvaRecuperable: 95000,
        montoTotal: 595000,
      },
    ];

    const reqWithDtes: AutonomousAgentRequest = {
      ...baseRequest,
      context: {
        ...baseRequest.context,
        dtes: sampleDtes,
        payrolls: [],
      },
    };

    const res = await (AutonomousAgentEngine as any).executeTool(
      'tool_tax_calculate_f29',
      {
        periodo: '2026-08',
        empresaRut: '76.104.550-9',
        tasaPpm: 0.005,
      },
      reqWithDtes
    );

    assert.strictEqual(res.status, 'SUCCESS');
    assert.strictEqual(res.ventasNetas, 900000, 'Ventas netas: $1.000.000 - $100.000 NC = $900.000');
    assert.strictEqual(res.debitoFiscalIva, 171000, 'Débito fiscal IVA: $190.000 - $19.000 NC = $171.000');
    assert.ok(res.creditoFiscalIva >= 95000, 'Crédito fiscal incluye compras acreditadas');
    assert.ok(res.remanenteReajustadoClp >= 0, 'Remanente reajustado por UTM computado');
    assert.ok(res.f29Mapeo, 'Debe mapear códigos oficiales de F29');
  });

  // ==========================================================================
  // 7. TOOL 6: tool_inventory_kardex
  // ==========================================================================
  await test('Tool 6 [tool_inventory_kardex]: Kardex y valorización PMP con alertas de reposición', async () => {
    const res = await (AutonomousAgentEngine as any).executeTool(
      'tool_inventory_kardex',
      {},
      baseRequest
    );

    assert.ok(res.status === 'SUCCESS' || res.status === 'NO_DATA');
    assert.strictEqual(res.metodoValorizacion, 'PMP_PROMEDIO_PONDERADO_ACREDITADO_SII');
    assert.ok(typeof res.valorizacionTotalInventarioClp === 'number');
  });

  // ==========================================================================
  // 8. TOOL 7: tool_bank_reconcile_movement (Anti Doble-Calce Garantizado)
  // ==========================================================================
  await test('Tool 7 [tool_bank_reconcile_movement]: No reutilizar asientos (anti doble calce)', async () => {
    const mockEntries = [
      {
        id: 'entry-tef-100k',
        fecha: '2026-03-15',
        totalDebe: 100000,
        totalHaber: 100000,
        concepto: 'Pago Proveedor Servicios TI',
        lineas: [
          { cuentaCodigo: '2.1.02', cuentaNombre: 'Proveedores', debe: 100000, haber: 0, rutAuxiliar: '77.798.901-4' },
          { cuentaCodigo: '1.1.02', cuentaNombre: 'Banco de Chile', debe: 0, haber: 100000 },
        ],
      },
    ];

    // Dos movimientos bancarios idénticos de $100.000
    const mockMovements = [
      { id: 'mov-1', monto: 100000, cargo: 100000, abono: 0, fecha: '2026-03-15', descripcion: 'TEF Servicios TI', rut: '77.798.901-4' },
      { id: 'mov-2', monto: 100000, cargo: 100000, abono: 0, fecha: '2026-03-16', descripcion: 'TEF Servicios TI', rut: '77.798.901-4' },
    ];

    const reqReconcil: AutonomousAgentRequest = {
      ...baseRequest,
      context: {
        ...baseRequest.context,
        entries: mockEntries,
        movements: mockMovements,
      },
    };

    const res = await (AutonomousAgentEngine as any).executeTool(
      'tool_bank_reconcile_movement',
      { cuentaBancaria: 'Cta Cte 00-123456-7' },
      reqReconcil
    );

    assert.strictEqual(res.status, 'SUCCESS');
    assert.strictEqual(res.movimientosCartolaAuditados, 2);
    // CRÍTICO: Exactamente 1 movimiento debe conciliarse; el segundo debe quedar pendiente por falta de asiento libre
    assert.strictEqual(res.movimientosConciliadosAutomaticamente, 1, 'Un solo movimiento debe conciliarse contra el único asiento');
    assert.strictEqual(res.movimientosPendientes, 1, 'El segundo movimiento debe quedar pendiente (no doble calce)');
    assert.strictEqual(res.tasaEfectividadCalce, 50, '50% conciliado');
  });

  // ==========================================================================
  // 9. TOOL 8: tool_submit_governance_approval
  // ==========================================================================
  await test('Tool 8 [tool_submit_governance_approval]: Registro de solicitud con riesgo e impacto', async () => {
    const res = await (AutonomousAgentEngine as any).executeTool(
      'tool_submit_governance_approval',
      {
        titulo: 'Pago Finiquito Operario Planta',
        descripcion: 'Aprobación de liquidación de término',
        impactoFinancieroClp: 2150000,
        nivelRiesgo: 'ALTO',
        datosOperacion: {
          asientoContable: {
            id: 'entry-finiquito-test-tool8',
            fecha: '2026-03-31',
            concepto: 'Centralización Finiquito Legal',
            lineas: [
              { cuentaCodigo: '5.2.07', cuentaNombre: 'Indemnizaciones Legales', debe: 2150000, haber: 0 },
              { cuentaCodigo: '2.1.07', cuentaNombre: 'Finiquitos por Pagar', debe: 0, haber: 2150000 },
            ],
          },
        },
      },
      baseRequest
    );

    assert.strictEqual(res.status, 'SUCCESS');
    assert.strictEqual(res.estado, 'PENDIENTE');
    assert.ok(res.approvalId);
  });

  // ==========================================================================
  // 10. GOBERNANZA: Cierre Exitoso Propuesta -> Aprobación -> Asiento en Mayor
  // ==========================================================================
  await test('Gobernanza Human-in-the-Loop: Aprobación exitosa impacta efectivamente en Libro Mayor', async () => {
    const entriesBefore = diskPersistence.getJournalEntries('761045509').length;

    // El agente puede enviar el asiento directamente en datosOperacion (sin subclave)
    const req = HrManagementService.requestModuleApproval({
      empresaId: '761045509',
      modulo: 'CONTABILIDAD',
      agenteNombre: 'Agente Contable Autónomo',
      operacionTipo: 'CENTRALIZACION_GASTO_CLOUD',
      titulo: 'Provisión Servicios Cloud AWS',
      descripcion: 'Validación de servidor y servicios cloud devengados',
      datosOperacion: {
        id: `entry-cloud-${Date.now()}`,
        fecha: '2026-03-31',
        concepto: 'Provisión Servicios Cloud AWS Oficial',
        lineas: [
          { cuentaCodigo: '6.1.04.002', cuentaNombre: 'Software y Cloud', debe: 450000, haber: 0 },
          { cuentaCodigo: '2.1.02.001', cuentaNombre: 'Proveedores Nacionales', debe: 0, haber: 450000 },
        ],
      },
      impactoFinancieroClp: 450000,
      riesgoNivel: 'MEDIO',
      nivelRiesgo: 'MEDIO',
    });

    const resolution = await HrManagementService.resolveApproval(req.id, 'USR-CONTADOR-SENIOR', true);
    assert.strictEqual(resolution.estado, 'EJECUTADO', 'El estado debe ser EJECUTADO');
    assert.ok(resolution.resultadoEjecucion?.toLowerCase().includes('asiento contable formal centralizado exitosamente'), 'Debe confirmar asiento');

    const entriesAfter = diskPersistence.getJournalEntries('761045509').length;
    assert.strictEqual(entriesAfter, entriesBefore + 1, 'El Libro Mayor debe registrar exactamente 1 asiento adicional');

    // Verificar persistencia de aprobaciones
    const persisted = diskPersistence.getApprovalById(req.id);
    assert.ok(persisted, 'La aprobación debe estar persistida en disco');
    assert.strictEqual(persisted.estado, 'EJECUTADO');
  });

  // ==========================================================================
  // 11. GOBERNANZA: Honestidad Total (Fallo Transiciona a ERROR_EJECUCION)
  // ==========================================================================
  await test('Gobernanza Human-in-the-Loop: Asiento descuadrado transiciona a ERROR_EJECUCION y NO asienta', async () => {
    const entriesBefore = diskPersistence.getJournalEntries('761045509').length;

    const reqFail = HrManagementService.requestModuleApproval({
      empresaId: '761045509',
      modulo: 'CONTABILIDAD',
      agenteNombre: 'Agente Auditor',
      operacionTipo: 'PROVISION_ERRONEA',
      titulo: 'Provisión Descuadrada Rechazable',
      descripcion: 'Asiento con descuadre en datos de operación',
      datosOperacion: {
        id: `entry-unbalanced-${Date.now()}`,
        fecha: '2026-03-31',
        concepto: 'Asiento con Descuadre Inadmisible',
        lineas: [
          { cuentaCodigo: '6.1.04.002', cuentaNombre: 'Gasto Invalido', debe: 500000, haber: 0 },
          { cuentaCodigo: '2.1.02.001', cuentaNombre: 'Proveedores', debe: 0, haber: 400000 },
        ],
      },
      impactoFinancieroClp: 500000,
      riesgoNivel: 'ALTO',
      nivelRiesgo: 'ALTO',
    });

    const resolution = await HrManagementService.resolveApproval(reqFail.id, 'USR-AUDITOR-JEFE', true);
    assert.strictEqual(resolution.estado, 'ERROR_EJECUCION', 'No debe marcarse como EJECUTADO si el asiento falló');
    assert.ok(resolution.resultadoEjecucion?.includes('descuadrado'), 'Debe reportar descuadre contable');

    const entriesAfter = diskPersistence.getJournalEntries('761045509').length;
    assert.strictEqual(entriesAfter, entriesBefore, 'El Libro Mayor NO debe registrar asientos descuadrados');
  });

  // ==========================================================================
  // 12. GOBERNANZA: Aprobación No Contable transiciona a APROBADO (no EJECUTADO)
  // ==========================================================================
  await test('Gobernanza Human-in-the-Loop: Aprobación no contable transiciona a APROBADO (no EJECUTADO) sin acción inventada', async () => {
    const entriesBefore = diskPersistence.getJournalEntries('761045509').length;

    const reqNonAccounting = HrManagementService.requestModuleApproval({
      empresaId: '761045509',
      modulo: 'RRHH',
      agenteNombre: 'Agente de Compensaciones',
      operacionTipo: 'AUTORIZACION_PAGO_FINIQUITO',
      titulo: 'Autorización Pago Finiquito Operario Planta',
      descripcion: 'Autorización administrativa de finiquito sin orden de pago bancario automatizada',
      datosOperacion: {
        colaboradorId: 'emp-101',
        montoFiniquito: 2500000,
        motivo: 'NECESIDADES_EMPRESA',
      },
      impactoFinancieroClp: 2500000,
      riesgoNivel: 'MEDIO',
      nivelRiesgo: 'MEDIO',
    });

    const resolution = await HrManagementService.resolveApproval(reqNonAccounting.id, 'USR-GERENTE-RRHH', true);
    assert.strictEqual(resolution.estado, 'APROBADO', 'Operación no contable debe quedar como APROBADO y NO como EJECUTADO');
    assert.ok(!resolution.resultadoEjecucion?.includes('concretada'), 'NO debe afirmar ejecución completada falsamente');
    assert.ok(resolution.resultadoEjecucion?.includes('APROBADO'), 'Debe indicar estado APROBADO');

    const entriesAfter = diskPersistence.getJournalEntries('761045509').length;
    assert.strictEqual(entriesAfter, entriesBefore, 'No deben crearse asientos en el Libro Mayor para operaciones sin asiento');
  });

  // ==========================================================================
  // 13. SEGURIDAD TRIBUTARIA CAF: Rechazar firmas simuladas o inventadas
  // ==========================================================================
  await test('Seguridad Tributaria CAF: Rechazar firmas simuladas o inventadas (QUJDREVGRw==)', () => {
    const fakeCaf = `<?xml version="1.0" encoding="ISO-8859-1"?>
<AUTORIZACION>
  <CAF version="1.0">
    <DA>
      <RE>76104550-9</RE>
      <RS>RETAIL SOLUTIONS CHILE SPA</RS>
      <TD>33</TD>
      <RNG><D>1</D><H>100</H></RNG>
      <FA>2026-01-01</FA>
      <RSAPK><M>dummy==</M><E>Aw==</E></RSAPK>
      <IDK>100</IDK>
    </DA>
    <FRMA algoritmo="SHA1withRSA">QUJDREVGRw==</FRMA>
  </CAF>
</AUTORIZACION>`;

    const res = HttpDteBillingService.verifyCafSignature(fakeCaf);
    assert.strictEqual(res.valid, false, 'CAF con firma inventada debe ser inválido (valid: false)');
    assert.strictEqual(res.status, 'INVALID_CORRUPT', 'Debe marcar status INVALID_CORRUPT');
  });

  // ==========================================================================
  // 14. SEGURIDAD TRIBUTARIA CAF: No certificar como válido sin clave pública oficial
  // ==========================================================================
  await test('Seguridad Tributaria CAF: No afirmar validez oficial sin clave pública del SII', () => {
    const unverifiedCaf = `<?xml version="1.0" encoding="ISO-8859-1"?>
<AUTORIZACION>
  <CAF version="1.0">
    <DA>
      <RE>76104550-9</RE>
      <RS>RETAIL SOLUTIONS CHILE SPA</RS>
      <TD>33</TD>
      <RNG><D>1</D><H>500</H></RNG>
      <FA>2026-01-01</FA>
      <RSAPK><M>MIICXAIBAAKCAQEA0sampleKeyModulusForTestPurposesOnlyXYZ1234567890ABCDEF==</M><E>Aw==</E></RSAPK>
      <IDK>100</IDK>
    </DA>
    <FRMA algoritmo="SHA1withRSA">MIIB...SignatureDataLongerThan64CharactersWithoutSampleKeywordHereForTest==</FRMA>
  </CAF>
</AUTORIZACION>`;

    const res = HttpDteBillingService.verifyCafSignature(unverifiedCaf);
    assert.strictEqual(res.valid, false, 'No debe certificar como válido sin verificar criptográficamente contra el SII');
    assert.strictEqual(res.status, 'UNVERIFIED_NO_SII_KEY');
    assert.notStrictEqual(res.status, 'VALID_OFFICIAL');
  });

  // ==========================================================================
  // 15. SEGURIDAD TRIBUTARIA CAF: Verificación criptográfica real con par de claves RSA
  // ==========================================================================
  await test('Seguridad Tributaria CAF: Verificación criptográfica real con par de claves RSA', () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const daText = '<DA><RE>76104550-9</RE><RS>EMPRESA REAL SPA</RS><TD>33</TD><RNG><D>1</D><H>1000</H></RNG><FA>2026-03-01</FA><RSAPK><M>modulus</M><E>Aw==</E></RSAPK><IDK>100</IDK></DA>';

    const signer = crypto.createSign('RSA-SHA1');
    signer.update(daText);
    const validSignatureB64 = signer.sign(privateKey, 'base64');

    const validXml = `<?xml version="1.0" encoding="ISO-8859-1"?>
<AUTORIZACION>
  <CAF version="1.0">
    ${daText}
    <FRMA algoritmo="SHA1withRSA">${validSignatureB64}</FRMA>
  </CAF>
</AUTORIZACION>`;

    // 1. Con la clave pública correcta: Valida exitosamente
    const pubPem = publicKey.export({ type: 'spki', format: 'pem' }) as string;
    const resValid = HttpDteBillingService.verifyCafSignature(validXml, pubPem);
    assert.strictEqual(resValid.valid, true, 'Firma criptográfica válida debe ser aceptada');
    assert.strictEqual(resValid.status, 'VALID_OFFICIAL');

    // 2. Si se altera el contenido de <DA> (tampering): Falla criptográficamente
    const tamperedXml = validXml.replace('<H>1000</H>', '<H>9999</H>');
    const resTampered = HttpDteBillingService.verifyCafSignature(tamperedXml, pubPem);
    assert.strictEqual(resTampered.valid, false, 'CAF alterado debe fallar la verificación criptográfica');
    assert.strictEqual(resTampered.status, 'INVALID_CORRUPT');
  });

  // ==========================================================================
  // 16. CONTRATO UI-SERVIDOR: Conciliación Bancaria sin truncar calces a 5
  // ==========================================================================
  await test('Contrato UI-Servidor [tool_bank_reconcile_movement]: Retornar todos los calces en detallesCalce sin corte arbitrario', async () => {
    // Generar 8 movimientos y 8 asientos para asegurar que los 8 se entregan en detallesCalce
    const testMovements = Array.from({ length: 8 }, (_, i) => ({
      id: `mov-${i + 1}`,
      fecha: '2026-03-10',
      descripcion: `Transferencia Operativa Proveedor ${i + 1}`,
      cargo: 100000 * (i + 1),
      abono: 0,
      saldo: 1000000,
      cuentaBancaria: 'Cta Cte Principal',
      rutContraparte: `76.543.21${i}-9`,
      folio: `TEF-88${i}`,
    }));

    const testEntries = Array.from({ length: 8 }, (_, i) => ({
      id: `asiento-calce-${i + 1}`,
      fecha: '2026-03-10',
      glosa: `Pago Factura Proveedor ${i + 1}`,
      debe: 0,
      haber: 100000 * (i + 1),
      lineas: [
        { cuentaCodigo: '1.1.02.01', cuentaNombre: 'Banco Santander', debe: 0, haber: 100000 * (i + 1) },
        { cuentaCodigo: '2.1.01.01', cuentaNombre: 'Proveedores Nacionales', debe: 100000 * (i + 1), haber: 0 },
      ],
    }));

    const req8: AutonomousAgentRequest = {
      ...baseRequest,
      module: 'CONCILIACION',
      context: {
        ...baseRequest.context,
        movements: testMovements,
        entries: testEntries,
      },
    };

    const res = await (AutonomousAgentEngine as any).executeTool(
      'tool_bank_reconcile_movement',
      { cuentaBancaria: 'Cta Cte Principal' },
      req8
    );

    assert.strictEqual(res.status, 'SUCCESS');
    assert.strictEqual(res.movimientosConciliadosAutomaticamente, 8, 'Deben calzarse los 8 movimientos');
    assert.ok(Array.isArray(res.detallesCalce), 'Debe retornar el arreglo detallesCalce');
    assert.strictEqual(res.detallesCalce.length, 8, 'detallesCalce debe incluir los 8 calces completos sin truncar a 5');
    assert.ok(Array.isArray(res.calcesMuestra), 'Debe mantener calcesMuestra para compatibilidad hacia atrás');
    assert.strictEqual(res.calcesMuestra.length, 5, 'calcesMuestra debe tener máximo 5 elementos');

    // Validar contrato estricto de campos esperados por BankReconciliation.tsx
    for (const calce of res.detallesCalce) {
      assert.ok(calce.movimientoId, 'Cada calce debe tener movimientoId');
      assert.ok(calce.asientoId, 'Cada calce debe tener asientoId');
      assert.ok(typeof calce.monto === 'number', 'Cada calce debe tener monto numérico');
      assert.ok(['ALTA_CONFIANZA', 'CONFIANZA_MEDIA'].includes(calce.calidadCalce), 'calidadCalce válida');
      assert.ok(typeof calce.score === 'number' && calce.score > 0, 'score numérico');
    }
  });

  // ==========================================================================
  // 17. SEGURIDAD TRIBUTARIA DTE: Bloqueo de Emisión ante CAF no verificado
  // ==========================================================================
  await test('Seguridad Tributaria DTE: emitirDte aborta ante CAF apócrifo o no certificado por el SII', async () => {
    const invalidPayload: any = {
      tipoDte: 33,
      fechaEmision: '2026-03-31',
      emisor: { rut: '76.104.550-9', razonSocial: 'RETAIL SOLUTIONS' },
      receptor: { rut: '76.543.210-9', razonSocial: 'CLIENTE PRUEBA' },
      detalles: [{ NroLinDet: 1, NmbItem: 'Item Test', QtyItem: 1, PrcItem: 10000, MontoItem: 10000 }],
      firma: { certBase64: 'dummy', certPassword: crypto.randomBytes(16).toString('hex') },
      caf: `<?xml version="1.0"?><AUTORIZACION><CAF><DA><RE>76104550-9</RE><TD>33</TD></DA><FRMA>QUJDREVGRw==</FRMA></CAF></AUTORIZACION>`,
      ambiente: 1,
    };

    await assert.rejects(
      async () => {
        await HttpDteBillingService.emitirDte(invalidPayload);
      },
      /Bloqueo tributario estricto/,
      'emitirDte debe rechazar la emisión y abortar si el CAF no cuenta con firma oficial válida'
    );
  });

  // ==========================================================================
  // 18. CONTRATO UI-SERVIDOR: Formulario 29, RRHH e Inventario
  // ==========================================================================
  await test('Contrato UI-Servidor: Estructuras íntegras en F29, RRHH e Inventario', async () => {
    // 1. F29 Contract
    const f29Res = await (AutonomousAgentEngine as any).executeTool(
      'tool_tax_calculate_f29',
      { periodo: '2026-03' },
      baseRequest
    );
    assert.strictEqual(f29Res.status, 'SUCCESS');
    assert.ok(f29Res.f29_mapeo, 'Debe incluir f29_mapeo');
    assert.ok(typeof f29Res.f29_mapeo.c538_total_debito === 'number');
    assert.ok(typeof f29Res.f29_mapeo.c537_total_credito === 'number');
    assert.ok(typeof f29Res.f29_mapeo.c091_total_a_pagar_f29 === 'number');
    assert.ok(Array.isArray(f29Res.asiento_contable_f29), 'Debe incluir asiento_contable_f29');

    // 2. RRHH Payroll Contract
    const hrRes = await (AutonomousAgentEngine as any).executeTool(
      'tool_hr_calculate_payroll',
      { mes: 3, anio: 2026 },
      baseRequest
    );
    assert.strictEqual(hrRes.status, 'SUCCESS');
    assert.ok(typeof hrRes.sueldoLiquido === 'number' && hrRes.sueldoLiquido > 0, 'Debe incluir sueldoLiquido numérico');
    assert.ok(typeof hrRes.totalHaberesImponibles === 'number', 'Debe incluir totalHaberesImponibles');
    assert.ok(typeof hrRes.totalDescuentosLegales === 'number', 'Debe incluir totalDescuentosLegales');
    assert.ok(typeof hrRes.costoTotalEmpresa === 'number', 'Debe incluir costoTotalEmpresa');

    // 3. Inventory Kardex Contract
    const invRes = await (AutonomousAgentEngine as any).executeTool(
      'tool_inventory_kardex',
      { sku: 'TEST-SKU-01', nombre: 'Insumo Test', unidadMedida: 'UN' },
      {
        ...baseRequest,
        context: {
          ...baseRequest.context,
          items: [
            { id: 'it-1', sku: 'TEST-SKU-01', nombre: 'Insumo Test', stockTotal: 50, costoUnitarioPMP: 12000, stockMinimo: 10 },
          ],
        },
      }
    );
    assert.strictEqual(invRes.status, 'SUCCESS');
    assert.ok(typeof invRes.valorizacionTotalInventarioClp === 'number', 'Debe incluir valorizacionTotalInventarioClp');
    assert.ok(Array.isArray(invRes.alertasStock), 'Debe incluir alertasStock');
    assert.ok(typeof invRes.totalItemsActivos === 'number', 'Debe incluir totalItemsActivos');
    assert.strictEqual(invRes.sku, 'TEST-SKU-01');
    assert.strictEqual(invRes.pmpCalculado, 12000);
    assert.strictEqual(invRes.stockTotalActual, 50);
  });

  console.log('\n============================================================');
  console.log(`🎉 RESULTADO: ${passed} de ${total} pruebas pasaron exitosamente (100%).`);
  console.log('============================================================\n');
  process.exit(0);
}

runAutomatedAgentSuite().catch((err) => {
  console.error('\n❌ ERROR EN LA EJECUCIÓN DE PRUEBAS:', err);
  process.exit(1);
});
