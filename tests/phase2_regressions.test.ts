/**
 * Fase 2 — Motor y herramientas honestos (hallazgos #5 a #10).
 * Las herramientas no completan datos contables con valores fijos y el motor no informa éxitos vacíos.
 */
import './setup/enableDemoMode';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { AutonomousAgentEngine } from '../src/services/autonomousAgentEngine';
import { DEFAULT_INDICATORS } from '../src/utils/chileanAccounting';
import { contarResultadoConciliacion, mensajeResultadoConciliacion, saldoLibroMayorCuenta } from '../src/utils/bankReconciliationReport';
import { executionModeLabel } from '../src/utils/executionModeLabel';
import { voiceAssistantEngine } from '../src/services/voiceAssistantEngine';
import { DEFAULT_AGENT_PERSONAS } from '../src/config/defaultAgentPersonas';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

const company: any = {
  id: 'client-retail-01',
  rut: '76.104.550-9',
  razonSocial: 'Retail Solutions Chile SpA',
  tasaPpm: 0.005,
};
const req = (over: any = {}): any => ({
  empresaId: '761045509',
  module: 'CONTABILIDAD',
  agentRole: 'Agente de prueba',
  query: 'prueba',
  context: { company, empresa: company, indicators: DEFAULT_INDICATORS },
  ...over,
});
const tool = (name: string, args: any, r: any = req()) => (AutonomousAgentEngine as any).executeTool(name, args, r);

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

  console.log('=== FASE 2: MOTOR Y HERRAMIENTAS HONESTOS ===\n');
  const prevKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = '';

  // ---------------------------------------------------------------- 2.1 (#5)
  await test('#5 Sin IA, "Analiza el balance" devuelve success: false con LLM_UNAVAILABLE', async () => {
    const r = await AutonomousAgentEngine.executeAutonomousAgentLoop(req({ query: 'Analiza el balance' }));
    assert.strictEqual(r.success, false);
    assert.strictEqual(r.code, 'LLM_UNAVAILABLE');
    assert.ok(!/ha procesado la consulta/i.test(r.finalText));
  });

  await test('#5 Las ramas por palabra clave conservan el modo DETERMINISTIC_COMPLIANCE_CORE', async () => {
    const r = await AutonomousAgentEngine.executeAutonomousAgentLoop(req({ module: 'INVENTARIO', query: 'kardex de bodega' }));
    assert.strictEqual(r.success, true);
    assert.strictEqual(r.executionMode, 'DETERMINISTIC_COMPLIANCE_CORE');
  });

  // ---------------------------------------------------------------- 2.2 (#6)
  await test('#6 Finiquito sin sueldo devuelve MISSING_PARAMS (antes $4.247.668)', async () => {
    const r = await tool('tool_hr_calculate_finiquito', { rut: '14.892.301-2', fechaTermino: '2026-03-31', causal: 'ART_161' });
    assert.strictEqual(r.status, 'MISSING_PARAMS');
    for (const f of ['sueldoBase', 'fechaIngreso', 'diasVacacionesPendientes', 'diasAvisoPrevioOtorgados']) {
      assert.ok(r.faltantes.includes(f), `Falta reportar ${f}`);
    }
    assert.strictEqual(r.totalFiniquitoLiquido, undefined);
  });

  await test('#6 El núcleo determinista no calcula finiquitos con fecha de ingreso supuesta', async () => {
    const r = await AutonomousAgentEngine.executeAutonomousAgentLoop(
      req({ module: 'RRHH', query: 'calcula el finiquito', context: { company, payroll: { rut: '1-9', sueldoBase: 900000 } } })
    );
    assert.strictEqual(r.success, false);
    assert.strictEqual(r.code, 'MISSING_PARAMS');
    assert.ok(r.missingParams?.includes('fechaIngreso'));
  });

  // ---------------------------------------------------------------- 2.3 (#8)
  await test('#8 RCV y F29 exigen período explícito (sin 2026-08 ni "mes actual")', async () => {
    const rcv = await tool('tool_sii_query_rcv', { tipoOperacion: 'COMPRAS' });
    assert.strictEqual(rcv.status, 'MISSING_PARAMS');
    assert.ok(rcv.faltantes.some((f: string) => f.startsWith('periodo')));
    const f29 = await tool('tool_tax_calculate_f29', {});
    assert.strictEqual(f29.status, 'MISSING_PARAMS');
    const conPeriodo = await tool('tool_tax_calculate_f29', {}, req({ context: { company, empresa: company, selectedPeriod: '2026-10' } }));
    assert.notStrictEqual(conPeriodo.status, 'MISSING_PARAMS', 'Con el período seleccionado en la UI debe calcular');
  });

  await test('#8 No queda "2026-08" como valor por defecto en el código', () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(e.name) && !/src[\\/]data[\\/]seed/.test(full)) {
          fs.readFileSync(full, 'utf8')
            .split('\n')
            .forEach((line, i) => {
              if (line.includes('2026-08')) offenders.push(`${path.relative(ROOT, full)}:${i + 1}`);
            });
        }
      }
    };
    walk(path.join(ROOT, 'src'));
    const server = fs.readFileSync(path.join(ROOT, 'server.ts'), 'utf8');
    if (server.includes('2026-08')) offenders.push('server.ts');
    assert.deepStrictEqual(offenders, []);
  });

  // ---------------------------------------------------------------- 2.4 (#6)
  await test('#6 Sin empresa registrada no se usa "Empresa Cliente SpA"', async () => {
    const r = await tool('tool_tax_calculate_f29', { periodo: '2026-10' }, req({ empresaId: '11111111-1', context: { indicators: DEFAULT_INDICATORS } }));
    assert.strictEqual(r.status, 'MISSING_PARAMS');
    assert.ok(r.faltantes.some((f: string) => f.startsWith('empresa')));
  });

  await test('#6 Borrador de DTE sin receptor, giro ni ítems valorizados devuelve MISSING_PARAMS', async () => {
    const r = await tool('tool_billing_draft_dte', { receptorRazonSocial: 'Cliente X', items: [{ nombre: 'Servicio' }] });
    assert.strictEqual(r.status, 'MISSING_PARAMS');
    for (const f of ['tipoDte', 'receptorRut', 'giroReceptor']) assert.ok(r.faltantes.includes(f), f);
    assert.ok(r.faltantes.some((f: string) => f.startsWith('items')));
  });

  await test('#6 Montos, fechas, RUT y empresa sin defaults en las herramientas', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src/services/autonomousAgentEngine.ts'), 'utf8');
    const prohibited = [
      /'Empresa Cliente SpA'/,
      /'Empresa Contribuyente SpA'/,
      /fechaIngreso \|\| '2024-01-01'/,
      /Number\(args\.sueldoBase\) \|\| \d/,
      /args\.rut \|\| '/,
      /Number\(args\.tasaPpm\) \|\| 0\.0\d+/,
      /args\.periodo \|\| (new Date|')/,
      /giroReceptor \|\| '/,
      /Number\(args\.tipoDte \|\| 33\)/,
    ];
    const hits = prohibited.filter((re) => re.test(src)).map(String);
    assert.deepStrictEqual(hits, []);
  });

  await test('#6 La ingesta de CSV RCV guarda documentos reales (ya no solo cuenta líneas)', async () => {
    const empty = await tool('tool_sii_ingest_csv', { tipoOperacion: 'COMPRAS', periodo: '2026-10', csvContent: 'encabezado\n' });
    assert.notStrictEqual(empty.status, 'SUCCESS', 'Un CSV sin documentos no puede informar éxito');
  });

  const read = (f: string) => fs.readFileSync(path.join(ROOT, f), 'utf8');

  // ---------------------------------------------------------------- 2.5 / 2.6 (#7)
  await test('#7 "Sincronizar API" ya no marca cuentas como CONECTADO', () => {
    const src = read('src/components/BankReconciliation.tsx');
    assert.ok(!src.includes("'Sincronizar API'"), 'El botón debe ser "Importar cartola"');
    const sync = src.slice(src.indexOf('const handleSyncBankApi'), src.indexOf('// Automated Smart Reconciliation Engine'));
    assert.ok(!sync.includes("'CONECTADO'"), 'handleSyncBankApi no puede asignar CONECTADO');
    assert.ok(!src.includes('saldoEnLinea: 44382013'), 'No debe existir una cuenta de respaldo con saldo inventado');
  });

  await test('#7 Con 1 movimiento sin calce el mensaje muestra 1 pendiente y no "100% cuadrado"', () => {
    const movs: any[] = [
      { id: 'a', estado: 'CONCILIADO', abono: 1000, cargo: 0, saldo: 1000 },
      { id: 'b', estado: 'PENDIENTE', abono: 500, cargo: 0, saldo: 1500 },
    ];
    const r = contarResultadoConciliacion(movs, 1500, 1500);
    assert.deepStrictEqual([r.conciliados, r.ambiguos, r.pendientes], [1, 0, 1]);
    const m = mensajeResultadoConciliacion('Banco X', r);
    assert.strictEqual(m.cuadrado, false);
    assert.match(m.texto, /1 pendientes/);
    assert.ok(!/100% cuadrado/i.test(m.texto));
  });

  await test('#7 "100% cuadrado" solo con 0 pendientes y diferencia de saldo $0', () => {
    const movs: any[] = [{ id: 'a', estado: 'CONCILIADO', abono: 1000, cargo: 0, saldo: 1000 }];
    const entries: any[] = [{ id: 'e', lineas: [{ cuentaCodigo: '1.1.02.001', debe: 1000, haber: 0 }] }];
    const libro = saldoLibroMayorCuenta(entries, '1.1.02.001');
    assert.strictEqual(mensajeResultadoConciliacion('B', contarResultadoConciliacion(movs, 1000, libro)).cuadrado, true);
    assert.strictEqual(mensajeResultadoConciliacion('B', contarResultadoConciliacion(movs, 1200, libro)).cuadrado, false);
    assert.strictEqual(mensajeResultadoConciliacion('B', contarResultadoConciliacion(movs, 1000, saldoLibroMayorCuenta(entries, undefined))).cuadrado, false);
  });

  // ---------------------------------------------------------------- 2.7 (#9)
  await test('#9 El prompt del chat ya no pide "cifras numéricas realistas"', () => {
    const src = read('server.ts');
    assert.ok(!src.includes('cifras numéricas realistas'));
    assert.match(src, /SOLO cifras que estén en el contexto/);
  });

  // ---------------------------------------------------------------- 2.8 (#10)
  await test('#10 Formularios nuevos sin folio aleatorio ni $1.000.000; cartolas de ejemplo solo en demo', () => {
    const dte = read('src/components/DteManager.tsx');
    assert.ok(!/folio: Math\.floor\(Math\.random/.test(dte), 'Folio aleatorio en el formulario DTE');
    assert.ok(!/montoNeto: 1000000/.test(dte), 'Monto de ejemplo en el formulario DTE');
    assert.ok(!/'76\.000\.000-0'/.test(dte), 'RUT inventado en la ingesta');
    const bank = read('src/components/BankReconciliation.tsx');
    assert.ok(bank.includes("importMethod === 'PRESET' && isDemoModeEnabled()"));
  });

  // ---------------------------------------------------------------- 2.9 (#5)
  await test('#5 Cada respuesta del motor muestra su modo de ejecución', async () => {
    const prev = process.env.DEMO_MODE;
    process.env.DEMO_MODE = 'false';
    try {
      assert.strictEqual(executionModeLabel('AUTONOMOUS_REACT_LOOP'), 'IA + herramientas');
      assert.strictEqual(executionModeLabel('DETERMINISTIC_COMPLIANCE_CORE'), 'Reglas');
      assert.match(executionModeLabel('DETERMINISTIC_COMPLIANCE_CORE', { success: false, code: 'LLM_UNAVAILABLE' }), /sin ejecución \(LLM_UNAVAILABLE\)/);
    } finally {
      process.env.DEMO_MODE = prev;
    }
    assert.match(executionModeLabel('DETERMINISTIC_COMPLIANCE_CORE'), /^Demostración · Reglas$/);
    const ctrl = read('src/controllers/autonomousAgentsController.ts');
    assert.ok(ctrl.includes('withExecutionModeTag') && ctrl.includes('executionModeLabel: modeLabel'));
    const r = await voiceAssistantEngine.processDialogue('¿cuánto stock queda en bodega?', DEFAULT_AGENT_PERSONAS[0], {
      clientId: '761045509', clientName: 'Retail', rut: '76.104.550-9', inventoryItems: [],
    } as any);
    assert.match(r.displayMarkdown, /Modo: Demostración · Reglas/);
  });

  process.env.GEMINI_API_KEY = prevKey;
  console.log(`\nRESULTADO FASE 2: ${passed} de ${total} pruebas pasaron.`);
  process.exit(passed === total ? 0 : 1);
}

run();
