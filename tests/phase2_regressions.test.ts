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

  process.env.GEMINI_API_KEY = prevKey;
  console.log(`\nRESULTADO FASE 2: ${passed} de ${total} pruebas pasaron.`);
  process.exit(passed === total ? 0 : 1);
}

run();
