#!/usr/bin/env node
/**
 * K0 · Chequeo de tipos con trinquete.
 *
 * Hasta noviembre de 2026 el proyecto no tenía @types/react: tsc tipaba todos los componentes como
 * `any` y "npm run lint" pasaba aunque hubiera props equivocadas. Con los tipos instalados aparecen
 * errores heredados en archivos que todavía no se revisan. Este script:
 *   1. Ejecuta tsc --noEmit sobre todo el proyecto.
 *   2. Falla si un archivo de la lista ESTRICTA tiene cualquier error.
 *   3. Falla si un archivo heredado tiene más errores que los registrados en typecheck-baseline.json
 *      (o si aparece un archivo nuevo con errores). Bajar errores siempre está permitido.
 *   --update-baseline reescribe la línea base con los conteos actuales (solo para bajar la deuda).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baselinePath = path.join(root, 'scripts', 'typecheck-baseline.json');

// Archivos que deben compilar sin errores (área de configuración de clientes y administración SaaS).
const STRICT = [
  /^src\/components\/tenancy\//,
  /^src\/components\/saas\//,
  /^src\/components\/AgentClientConfig\.tsx$/,
  /^src\/components\/accounting\/ImportExportChartModal\.tsx$/,
  /^src\/components\/accounting\/ChartOfAccountsEditor\.tsx$/,
  /^src\/components\/accounting\/ChartInitializationWizard\.tsx$/,
  /^src\/controllers\/(clients|tenancy|chartOfAccounts|saas)Controller\.ts$/,
  /^src\/services\/(saas|chartOfAccountsServer|journalEntryNormalizer)[A-Za-z]*\.ts$/,
  /^src\/middlewares\//,
  /^src\/utils\/companyChartOfAccountsService\.ts$/,
  /^src\/utils\/chartImport[A-Za-z]*\.ts$/,
  /^tests\//,
];

let output = '';
try {
  output = execFileSync(process.execPath, [path.join(root, 'node_modules/typescript/bin/tsc'), '--noEmit', '--pretty', 'false'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
} catch (err) {
  output = String(err.stdout || '') + String(err.stderr || '');
}

const counts = {};
const lines = output.split('\n').filter((l) => /error TS\d+/.test(l));
for (const line of lines) {
  const file = line.split('(')[0].trim().replace(/\\/g, '/');
  counts[file] = (counts[file] || 0) + 1;
}

if (process.argv.includes('--update-baseline')) {
  const sorted = Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(baselinePath, JSON.stringify(sorted, null, 2) + '\n');
  console.log(`Línea base actualizada: ${lines.length} errores en ${Object.keys(sorted).length} archivos.`);
  process.exit(0);
}

const baseline = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, 'utf8')) : {};
const problems = [];
for (const [file, n] of Object.entries(counts)) {
  if (STRICT.some((re) => re.test(file))) {
    problems.push(`${file}: ${n} error(es) en un archivo que debe compilar sin errores`);
  } else if (n > (baseline[file] || 0)) {
    problems.push(`${file}: ${n} error(es), la línea base permite ${baseline[file] || 0}`);
  }
}

const total = lines.length;
const baseTotal = Object.values(baseline).reduce((s, n) => s + n, 0);
if (problems.length > 0) {
  console.error('Chequeo de tipos: FALLA\n');
  for (const l of lines) {
    const file = l.split('(')[0].trim();
    if (problems.some((p) => p.startsWith(file + ':'))) console.error('  ' + l);
  }
  console.error('\n' + problems.map((p) => ' - ' + p).join('\n'));
  process.exit(1);
}
console.log(`Chequeo de tipos: OK (${total} errores heredados, línea base ${baseTotal}; archivos estrictos sin errores).`);
