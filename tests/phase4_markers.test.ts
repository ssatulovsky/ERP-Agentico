/**
 * 4.4 Búsqueda de marcadores de simulación (plan de corrección, fase 4).
 * Sin coincidencias fuera de src/data/seed* y pruebas para:
 *  - Math.random en montos, folios, claves o contraseñas;
 *  - setTimeout usado como espera de "procesamiento";
 *  - success: true dentro de un catch.
 */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { generatePeriodClosingAdjustments } from '../src/utils/accountingOrchestratorEngine';
import { calculatePreF29 } from '../src/utils/f29SeniorEngine';
import { DEFAULT_INDICATORS } from '../src/utils/chileanAccounting';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(e.name) && !/src[\\/]data[\\/]seed/.test(full)) out.push(full);
    }
  };
  walk(path.join(ROOT, 'src'));
  out.push(path.join(ROOT, 'server.ts'));
  return out;
}

/** Archivos cuyo uso de Math.random/setTimeout está detrás de DEMO_MODE (comprobantes de ejemplo). */
const DEMO_ONLY = ['CollaboratorExpenseMobileApp.tsx', 'AddExpenseItemModal.tsx'];

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
  console.log('=== 4.4 BÚSQUEDA DE MARCADORES DE SIMULACIÓN (y 4.1 cobertura de regresiones) ===\n');
  const files = sourceFiles();

  await test('Sin Math.random en montos, folios, claves ni contraseñas', () => {
    const offenders: string[] = [];
    for (const f of files) {
      if (DEMO_ONLY.some((d) => f.endsWith(d))) continue;
      fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        if (/^\s*(\/\/|\*)/.test(line)) return;
        if (line.includes('Math.random') && !line.includes('Math.random().toString(36)') && /folio|monto|precio|total|saldo|neto|clave|pass|salt|codigo|sku|rut/i.test(line)) {
          offenders.push(`${path.relative(ROOT, f)}:${i + 1}`);
        }
      });
    }
    assert.deepStrictEqual(offenders, []);
  });

  await test('Sin setTimeout usado como espera de "procesamiento"', () => {
    const offenders: string[] = [];
    for (const f of files) {
      if (DEMO_ONLY.some((d) => f.endsWith(d))) continue;
      const src = fs.readFileSync(f, 'utf8');
      // await new Promise(r => setTimeout(r, N)): solo se admite el backoff de reintentos HTTP-DTE
      const awaits = src.match(/await new Promise\(\(?\w*\)? => setTimeout\(\w+, [^)]+\)\)/g) || [];
      for (const a of awaits) {
        if (!(f.endsWith('httpDteBillingService.ts') && a.includes('backoffMs'))) offenders.push(`${path.relative(ROOT, f)}: ${a}`);
      }
      // Simulaciones conocidas que se eliminaron
      for (const marker of ['Realistic simulation delay', 'Simular Captura OCR', 'Auto-completar desde SII', 'Datos extraídos del Registro Tributario SII', 'handleManualRefresh', 'handleReAudit']) {
        if (src.includes(marker)) offenders.push(`${path.relative(ROOT, f)}: ${marker}`);
      }
    }
    assert.deepStrictEqual(offenders, []);
  });

  await test('Sin success: true dentro de un catch', () => {
    const offenders: string[] = [];
    for (const f of files) {
      const src = fs.readFileSync(f, 'utf8');
      const re = /catch\s*(\([^)]*\))?\s*\{/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(src))) {
        let depth = 1;
        let j = m.index + m[0].length;
        while (depth > 0 && j < src.length) {
          if (src[j] === '{') depth++;
          else if (src[j] === '}') depth--;
          j++;
        }
        const block = src.slice(m.index + m[0].length, j);
        if (/success:\s*true|status:\s*['"]SUCCESS['"]/.test(block)) {
          offenders.push(`${path.relative(ROOT, f)}:${src.slice(0, m.index).split('\n').length}`);
        }
      }
    }
    assert.deepStrictEqual(offenders, []);
  });

  await test('Sin folios oficiales inventados (DT, licencias, REL)', () => {
    const offenders: string[] = [];
    for (const f of files) {
      const src = fs.readFileSync(f, 'utf8');
      for (const re of [/CERT-DT-\$\{/, /`LME-\$\{Math/, /`REL-\$\{new Date/, /'CERT-DT-\d+-\d+'/]) {
        if (re.test(src)) offenders.push(`${path.relative(ROOT, f)}: ${re}`);
      }
    }
    assert.deepStrictEqual(offenders, []);
  });

  await test('Sin montos de respaldo (|| 1234…) en montos, folios ni tasas', () => {
    const offenders: string[] = [];
    const permitido = /timeout|Timeout|TIMEOUT|Ms\b|ms\b|PORT|port|limit|Limit|retries|1000 \*|indicators|Indicators|\butm\b|\buf\b|UTM|imm|dolar|euro|umbral/;
    for (const f of files) {
      if (DEMO_ONLY.some((d) => f.endsWith(d))) continue;
      fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        if (/(\|\||\?\?) ?[0-9]{4,}(\.[0-9]+)?\b/.test(line) && !permitido.test(line)) offenders.push(`${path.relative(ROOT, f)}:${i + 1}`);
        if (/tasaPpm\)? \|\| 0\.0[0-9]+/.test(line)) offenders.push(`${path.relative(ROOT, f)}:${i + 1} (tasa PPM supuesta)`);
      });
    }
    assert.deepStrictEqual(offenders, []);
  });

  await test('Sin datos, el cierre de período no propone ajustes inventados', () => {
    const adj = generatePeriodClosingAdjustments({}, {} as any, [], [], []);
    assert.deepStrictEqual(adj, [], `Se propusieron ajustes sin datos: ${adj.map((a) => a.id).join(', ')}`);
  });

  await test('F29: postergación según el período y PPM sin tasa supuesta', () => {
    const company: any = { rut: '76.999.888-1', razonSocial: 'X', regimenTributario: '14A_GENERAL' };
    const r: any = calculatePreF29(company, [], [], DEFAULT_INDICATORS as any, { periodo: '2026-10' });
    assert.ok(r.alertas_fiscales.some((a: any) => /tasa PPM/.test(a.descripcion)), 'Debe alertar la falta de tasa PPM');
    const post = JSON.stringify(r);
    assert.ok(!post.includes('2026-11-20'), 'Fecha de postergación fija');
  });

  await test('4.1 Cada hallazgo #1 a #10 tiene al menos una prueba de regresión dentro de npm test', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    const suites: string[] = (pkg.scripts.test.match(/tests\/[\w.]+\.test\.ts/g) || []);
    const nombres = suites.flatMap((s) =>
      [...fs.readFileSync(path.join(ROOT, s), 'utf8').matchAll(/await test\('([^']+)'/g)].map((m) => m[1])
    );
    const sinPrueba = Array.from({ length: 10 }, (_, i) => i + 1).filter(
      (n) => !nombres.some((t) => new RegExp(`(^|[^0-9])#${n}([^0-9]|$)`).test(t))
    );
    assert.deepStrictEqual(sinPrueba, [], `Hallazgos sin prueba: ${sinPrueba.map((n) => '#' + n).join(', ')}`);
  });

  console.log(`\nRESULTADO 4.4: ${passed} de ${total} pruebas pasaron.`);
  process.exit(passed === total ? 0 : 1);
}

run();
