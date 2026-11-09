/**
 * 4.3 (preparación) Emisión DTE y consulta del Track ID sin resultados fabricados.
 *
 * El servicio HTTP-DTE y el SII se reemplazan por respuestas controladas (fetch). La prueba en el
 * ambiente de certificación real se hace con scripts/certificacion-sii.ts.
 */
import './setup/enableDemoMode';
import assert from 'node:assert';
import { HttpDteBillingService } from '../src/services/httpDteBillingService';
import { AutonomousAgentEngine } from '../src/services/autonomousAgentEngine';
import { diskPersistence } from '../src/services/diskPersistenceService';
import { agentSchedulerService } from '../src/services/agentSchedulerService';
import { calculatePreF29 } from '../src/utils/f29SeniorEngine';
import { DEFAULT_INDICATORS } from '../src/utils/chileanAccounting';

type Fake = (url: string, init: any) => { status: number; body: any };
const realFetch = globalThis.fetch;
function mockFetch(fn: Fake) {
  (globalThis as any).fetch = async (url: string, init: any) => {
    const { status, body } = fn(String(url), init);
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  };
}

const payload = (folio: number): any => ({
  tipoDte: 33,
  folio,
  fechaEmision: '2026-11-05',
  ambiente: 1,
  emisor: { rut: '76.123.456-0', razonSocial: 'Emisor Prueba SpA' },
  receptor: { rut: '77.111.222-3', razonSocial: 'Receptor Prueba Ltda.' },
  detalles: [{ NmbItem: 'Servicio', QtyItem: 1, PrcItem: 100000, MontoItem: 100000 }],
  totales: { montoNeto: 100000, iva: 19000, montoTotal: 119000 },
});

async function run() {
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
    }
  }
  console.log('=== 4.3 EMISIÓN DTE Y TRACK ID SIN RESULTADOS FABRICADOS ===\n');
  const prevSim = process.env.ALLOW_OFFLINE_DTE_SIMULATION;
  process.env.ALLOW_OFFLINE_DTE_SIMULATION = 'true'; // solo para no exigir un CAF real; el servicio sí responde
  const opts = { baseUrl: 'http://http-dte.prueba', maxRetries: 0 };

  await test('Si HTTP-DTE responde sin timbre ni XML, la emisión falla (antes: TED TED_SIGNATURE_OK fabricado)', async () => {
    mockFetch(() => ({ status: 200, body: { folio: 901 } }));
    const r = await HttpDteBillingService.emitirDte(payload(901), opts);
    assert.strictEqual(r.success, false);
    assert.match(r.error!, /sin timbre/);
    assert.ok(!JSON.stringify(r).includes('TED_SIGNATURE_OK'));
  });

  await test('Sin Track ID no se inventa uno: el DTE queda PENDIENTE (timbrado, sin envío al SII)', async () => {
    mockFetch(() => ({ status: 200, body: { folio: 902, ted: '<TED version="1.0">real</TED>' } }));
    const r = await HttpDteBillingService.emitirDte(payload(902), opts);
    assert.strictEqual(r.success, true);
    assert.strictEqual(r.trackId, null);
    assert.strictEqual(r.estadoSii, 'PENDIENTE');
  });

  await test('Con Track ID el DTE queda ENVIADO, nunca ACEPTADO sin consultar', async () => {
    mockFetch(() => ({ status: 200, body: { folio: 903, ted: '<TED version="1.0">real</TED>', track_id: '0123456789' } }));
    const r = await HttpDteBillingService.emitirDte(payload(903), opts);
    assert.strictEqual(r.trackId, '0123456789');
    assert.strictEqual(r.estadoSii, 'ENVIADO');
  });

  await test('Códigos de estado del SII: EPR aceptado, RPR con reparos, RCH/RFR rechazo, SOK/REC en proceso', () => {
    const m = (c: string) => HttpDteBillingService.mapEstadoEnvioSii(c);
    assert.deepStrictEqual(
      ['EPR', 'RPR', 'RCH', 'RFR', 'RCT', 'SOK', 'REC', ''].map(m),
      ['ACEPTADO', 'ACEPTADO_CON_REPAROS', 'RECHAZADO', 'RECHAZADO', 'RECHAZADO', 'ENVIADO', 'ENVIADO', 'ENVIADO']
    );
  });

  await test('Una consulta fallida o sin estado no cambia nada', async () => {
    mockFetch(() => ({ status: 500, body: { error: 'caído' } }));
    const a = await HttpDteBillingService.consultarEstadoEnvio({ rutEmisor: '76.123.456-0', trackId: '1', baseUrl: opts.baseUrl });
    assert.strictEqual(a.ok, false);
    mockFetch(() => ({ status: 200, body: {} }));
    const b = await HttpDteBillingService.consultarEstadoEnvio({ rutEmisor: '76.123.456-0', trackId: '1', baseUrl: opts.baseUrl });
    assert.strictEqual(b.ok, false);
  });

  // Empresa con tres DTE enviados
  const EMP = `74${String(Date.now()).slice(-6)}-2`;
  const enviado = (folio: number, trackId: string) => ({
    id: `${EMP}-v${folio}`, tipoOperacion: 'VENTA', tipoDte: '33', folio, periodo: '2026-11', fechaEmision: '2026-11-04',
    montoNeto: 100000, montoIva: 19000, montoTotal: 119000, rutEmisor: EMP, estadoSii: 'ENVIADO', trackId, ambienteSii: 1,
  });
  diskPersistence.saveDtes(EMP, [enviado(1, 'T-ACEPTA'), enviado(2, 'T-RECHAZA'), enviado(3, 'T-PROCESO')]);
  const estadoPor: Record<string, any> = {
    'T-ACEPTA': { estado: 'EPR', glosa: 'Envío procesado' },
    'T-RECHAZA': { estado: 'RCH', glosa: 'DTE rechazado por error en firma' },
    'T-PROCESO': { estado: 'SOK', glosa: 'Schema validado' },
  };
  const siiFake: Fake = (_url, init) => ({ status: 200, body: estadoPor[JSON.parse(init.body).track_id] });
  const req: any = { empresaId: EMP, module: 'FACTURACION_DTE', agentRole: 't', query: 't', context: {} };

  await test('El agente de facturación consulta los Track ID y actualiza cada DTE con el resultado del SII', async () => {
    mockFetch(siiFake);
    const r = await AutonomousAgentEngine.executeToolForAgent('FACTURACION_DTE', 'tool_billing_check_dte_status', {}, req);
    assert.strictEqual(r.status, 'SUCCESS');
    assert.deepStrictEqual([r.revisados, r.aceptados, r.rechazados, r.enProceso], [3, 1, 1, 1]);
    const est = Object.fromEntries(diskPersistence.getDtes(EMP).map((d: any) => [d.folio, d.estadoSii]));
    assert.deepStrictEqual(est, { 1: 'ACEPTADO', 2: 'RECHAZADO', 3: 'ENVIADO' });
  });

  await test('La herramienta de Track ID solo la tiene el agente de facturación', async () => {
    const r = await AutonomousAgentEngine.executeToolForAgent('INVENTARIO', 'tool_billing_check_dte_status', {}, { ...req, module: 'INVENTARIO' });
    assert.strictEqual(r.status, 'TOOL_NOT_ALLOWED');
  });

  await test('Un DTE rechazado por el SII no cuenta en el F29', () => {
    const dtes = diskPersistence.getDtes(EMP);
    const f29: any = calculatePreF29({ rut: EMP, razonSocial: 'X', regimenTributario: '14A_GENERAL', tasaPpm: 0.01 } as any, dtes as any, [], DEFAULT_INDICATORS as any, { periodo: '2026-11' });
    // Cuentan el aceptado y el que sigue en proceso (2 × $19.000), no el rechazado.
    assert.strictEqual(Math.round(f29.detalle_debito.totalDebitoCalculado), 38000);
  });

  await test('Tarea programada: un rechazo del SII queda como alerta para el responsable', async () => {
    estadoPor['T-PROCESO'] = { estado: 'RFR', glosa: 'Rechazado por error en firma' };
    mockFetch(siiFake);
    const r = await agentSchedulerService.runTask({ empresaId: EMP, tareaId: 'ESTADO_DTE', usuarioId: 'test' });
    assert.strictEqual(r.estado, 'REQUIERE_ATENCION', r.resumen);
    assert.match(r.resumen, /Folio 3/);
    assert.ok(r.requiereAccion);
  });

  await test('Sin DTE enviados, la tarea informa SIN_DATOS', async () => {
    const vacia = `73${String(Date.now()).slice(-6)}-1`;
    const r = await agentSchedulerService.runTask({ empresaId: vacia, tareaId: 'ESTADO_DTE', usuarioId: 'test' });
    assert.strictEqual(r.estado, 'SIN_DATOS');
  });

  (globalThis as any).fetch = realFetch;
  process.env.ALLOW_OFFLINE_DTE_SIMULATION = prevSim;
  {
    const snap: any = diskPersistence.getSnapshot();
    diskPersistence.updateCollection('agentScheduleRuns', (snap.agentScheduleRuns || []).filter((x: any) => x.usuarioId !== 'test'));
    diskPersistence.flushToDiskSync();
  }
  console.log(`\nRESULTADO 4.3: ${passed} de ${total} pruebas pasaron.`);
  process.exit(passed === total ? 0 : 1);
}

run();
