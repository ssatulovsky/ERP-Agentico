/**
 * Fase 0 — Repositorio ejecutable.
 * 0.1: src/data/ no puede quedar ignorado por git (el .gitignore solo ignora /data/ de la raíz).
 * 0.3: El puente WhatsApp declara sus dependencias como opcionales y, si faltan,
 *      informa NOT_INSTALLED en lugar de instalar paquetes en tiempo de ejecución.
 */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { whatsappBridgeService, WhatsAppBridgeService } from '../src/services/whatsappBridgeService';
import { demoSeed, isDemoModeEnabled } from '../src/config/demoMode';
import { getDemoClients } from '../src/data/seedData';
import { PayrollCalculationService } from '../src/services/payrollCalculationService';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

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
      process.exitCode = 1;
    }
  }

  console.log('=== FASE 0: REPOSITORIO EJECUTABLE ===\n');

  await test('0.1 .gitignore no ignora src/data/', () => {
    const lines = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8').split('\n').map((l) => l.trim());
    assert.ok(!lines.includes('data/'), 'La regla "data/" ignora también src/data/; usar "/data/"');
    assert.ok(lines.includes('/data/'), 'Debe ignorarse solo el snapshot de la raíz (/data/)');
    let gitAvailable = true;
    try {
      execSync('git rev-parse --is-inside-work-tree', { cwd: ROOT, stdio: 'ignore' });
    } catch {
      gitAvailable = false;
    }
    if (gitAvailable) {
      let ignored = true;
      try {
        execSync('git check-ignore -q src/data/seedData.ts', { cwd: ROOT, stdio: 'ignore' });
      } catch {
        ignored = false; // exit 1 = no ignorado
      }
      assert.strictEqual(ignored, false, 'git sigue ignorando src/data/seedData.ts');
    }
  });

  await test('0.1/0.2 Módulos de datos presentes: semillas en src/data/, maestros en src/config/', () => {
    const seeds = fs.readdirSync(path.join(ROOT, 'src/data')).filter((f) => f.endsWith('.ts'));
    for (const f of seeds) assert.ok(f.startsWith('seed'), `src/data/ solo debe contener semillas (seed*): ${f}`);
    assert.ok(seeds.length >= 8, `Se esperaban al menos 8 módulos semilla y hay ${seeds.length}`);
    for (const f of ['erpMasterConfig.ts', 'defaultAgentPersonas.ts', 'defaultInvoiceLayouts.ts', 'demoMode.ts']) {
      assert.ok(fs.existsSync(path.join(ROOT, 'src/config', f)), `Falta src/config/${f}`);
    }
    const master = fs.readFileSync(path.join(ROOT, 'src/config/erpMasterConfig.ts'), 'utf8');
    assert.ok(!master.includes('INITIAL_CLIENT_AUXILIARIES'), 'Los auxiliares de ejemplo no son datos maestros');
  });

  await test('0.2 Con DEMO_MODE=false ninguna empresa recibe datos semilla', async () => {
    const prev = process.env.DEMO_MODE;
    process.env.DEMO_MODE = 'false';
    try {
      assert.strictEqual(isDemoModeEnabled(), false);
      assert.deepStrictEqual(demoSeed('client-innovagile', [1, 2, 3]), []);
      assert.deepStrictEqual(demoSeed({ id: 'client-retail-01' }, () => [1]), []);
      assert.deepStrictEqual(getDemoClients(), []);
      const employees = await PayrollCalculationService.getOrSeedEmployees('client-agro-nuevo');
      assert.strictEqual(employees.length, 0, 'Se sembró nómina de ejemplo con DEMO_MODE=false');
    } finally {
      process.env.DEMO_MODE = prev;
    }
  });

  await test('0.2 Con DEMO_MODE=true un cliente nuevo tampoco recibe datos semilla', async () => {
    const prev = process.env.DEMO_MODE;
    process.env.DEMO_MODE = 'true';
    try {
      assert.deepStrictEqual(demoSeed('client-1730912345-nuevo', [1]), []);
      assert.deepStrictEqual(demoSeed({ id: 'c-nuevo', rut: '11.111.111-1' }, [1]), []);
      assert.deepStrictEqual(demoSeed('client-innovagile', [1]), [1], 'Las empresas de ejemplo sí reciben la semilla en demo');
      assert.ok(getDemoClients().length > 0);
      const employees = await PayrollCalculationService.getOrSeedEmployees('client-nuevo-agrovalle');
      assert.strictEqual(employees.length, 0, 'Un cliente nuevo con "agro" en su id no debe recibir la nómina de ejemplo');
    } finally {
      process.env.DEMO_MODE = prev;
    }
  });

  await test('0.2 App.tsx no usa semillas como respaldo directo de datos por empresa', () => {
    const app = fs.readFileSync(path.join(ROOT, 'src/App.tsx'), 'utf8');
    const raw = app.match(/loadClientState<[^>]+>\([^,]+,\s*'[A-Za-z]+',\s*(seed[A-Z]\w*|INITIAL_[A-Z_]+|SEED_[A-Z_]+|getInitial\w+ForClient\([^)]*\))\s*\)/g) || [];
    assert.deepStrictEqual(raw, [], `Respaldos semilla sin demoSeed(): ${raw.join(' | ')}`);
    const payrollFallbacks = app.match(/\?\s*getInitial\w+ForClient\(/g) || [];
    assert.deepStrictEqual(payrollFallbacks, [], 'getInitial*ForClient debe pasar por demoSeed()');
  });

  await test('0.3 Dependencias del puente WhatsApp declaradas como opcionales', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    for (const dep of ['@whiskeysockets/baileys', 'qrcode', 'ffmpeg-static']) {
      assert.ok(pkg.optionalDependencies?.[dep], `Falta ${dep} en optionalDependencies`);
    }
  });

  await test('0.3 El servidor no instala paquetes npm en tiempo de ejecución', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src/services/whatsappBridgeService.ts'), 'utf8');
    assert.ok(!/npm install [^"'`]*--no-save/.test(src), 'whatsappBridgeService ejecuta npm install');
  });

  await test('0.3 Sin dependencias, el puente informa NOT_INSTALLED (no éxito)', async () => {
    const original = whatsappBridgeService.getMissingBridgeDependencies.bind(whatsappBridgeService);
    (whatsappBridgeService as any).getMissingBridgeDependencies = () => ['@whiskeysockets/baileys'];
    try {
      const result = await whatsappBridgeService.startWhatsAppLink();
      assert.strictEqual(result.status, 'NOT_INSTALLED');
      const status = whatsappBridgeService.getStatusAndConfig();
      assert.strictEqual(status.connectionState, 'NOT_INSTALLED');
      assert.deepStrictEqual(status.missingDependencies, ['@whiskeysockets/baileys']);
      assert.match(String(status.lastErrorMessage), /no instalado/i);
    } finally {
      (whatsappBridgeService as any).getMissingBridgeDependencies = original;
      (whatsappBridgeService as any).connectionState = 'DISCONNECTED';
      (whatsappBridgeService as any).lastErrorMessage = null;
    }
  });

  await test('0.3 La detección de dependencias es real (resuelve módulos instalados)', () => {
    const missing = whatsappBridgeService.getMissingBridgeDependencies();
    assert.ok(Array.isArray(missing));
    for (const dep of WhatsAppBridgeService.REQUIRED_OPTIONAL_DEPENDENCIES) {
      const installed = fs.existsSync(path.join(ROOT, 'node_modules', ...dep.split('/'), 'package.json'));
      assert.strictEqual(missing.includes(dep), !installed, `Detección incorrecta para ${dep}`);
    }
  });

  console.log(`\nRESULTADO FASE 0: ${passed} de ${total} pruebas pasaron.`);
  if (passed !== total) process.exit(1);
  process.exit(0);
}

run();
