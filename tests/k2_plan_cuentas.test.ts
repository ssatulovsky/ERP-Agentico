/**
 * K2 · Plan de cuentas único por empresa (hallazgos C2–C5, C7–C11 de la revisión del 16 nov 2026).
 * Se ejecuta en un directorio temporal: no toca los datos del repositorio.
 */
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import express from 'express';
import type { AddressInfo } from 'node:net';

const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'erp-k2-'));
process.chdir(tmp);
delete process.env.DEMO_MODE;

let passed = 0;
let total = 0;
async function test(name: string, fn: () => Promise<void> | void) {
  total++;
  try {
    await fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (e: any) {
    console.error(`  ❌ ${name}\n     ${e?.stack || e}`);
  }
}

function rutConDv(base: number): string {
  const n = String(base);
  let s = 0;
  let m = 2;
  for (const d of n.split('').reverse()) {
    s += Number(d) * m;
    m = m === 7 ? 2 : m + 1;
  }
  const r = 11 - (s % 11);
  return `${n}-${r === 11 ? '0' : r === 10 ? 'K' : String(r)}`;
}
const conPuntos = (rut: string) => {
  const [n, dv] = rut.split('-');
  return `${n.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${dv}`;
};

async function run() {
  console.log('\nK2 · PLAN DE CUENTAS ÚNICO POR EMPRESA\n');
  const { chartOfAccountsRouter } = await import('../src/controllers/chartOfAccountsController');
  const { accountingJournalRouter } = await import('../src/controllers/accountingJournalController');
  const { diskPersistence } = await import('../src/services/diskPersistenceService');
  const svc = await import('../src/services/chartOfAccountsServerService');
  const { normalizeAndValidateJournalEntry } = await import('../src/services/journalEntryNormalizer');
  const { buildStandardChartTemplate, DEFAULT_CHILEAN_GROUPS } = await import('../src/utils/companyChartOfAccountsService');
  const mapper = await import('../src/utils/chartImportMapper');

  let currentUser: any = null;
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use((req: any, _res, next) => {
    req.user = currentUser;
    next();
  });
  app.use('/api/companies', chartOfAccountsRouter);
  app.use('/api/accounting', accountingJournalRouter);
  const server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const call = async (method: string, url: string, body?: any) => {
    const res = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: await res.json() };
  };

  // Empresas: A y B del mismo cliente; C ajena; L antigua con id client-… (C4)
  const rA = rutConDv(76100000 + Math.floor(Math.random() * 90000));
  const rB = rutConDv(76200000 + Math.floor(Math.random() * 90000));
  const rC = rutConDv(76300000 + Math.floor(Math.random() * 90000));
  const rL = rutConDv(76400000 + Math.floor(Math.random() * 90000));
  diskPersistence.updateCollection('clients', [
    { id: rA, rut: conPuntos(rA), razonSocial: 'Empresa A SpA' },
    { id: rB, rut: conPuntos(rB), razonSocial: 'Empresa B SpA' },
    { id: rC, rut: conPuntos(rC), razonSocial: 'Empresa C SpA' },
    { id: 'client-1731000000', rut: conPuntos(rL), razonSocial: 'Empresa Antigua SpA' },
  ]);
  const superadmin = { userId: 'sa', isSuperAdmin: true, isAdmin: true, empresasPermitidas: [] };
  const contador = { userId: 'ct', isSuperAdmin: false, isAdmin: false, roleCodigo: 'CONTADOR', empresasPermitidas: [rA, rB, 'client-1731000000'] };

  await test('C3/K2.3: la plantilla estándar es coherente (sin errores ni advertencias) y sus grupos describen sus cuentas', () => {
    const t = buildStandardChartTemplate();
    const { errores, advertencias } = svc.validateChart(t.chart);
    assert.deepStrictEqual(errores, []);
    assert.deepStrictEqual(advertencias, [], JSON.stringify(advertencias.slice(0, 3)));
    const g = new Map(DEFAULT_CHILEAN_GROUPS.map((x) => [x.codigo, x.nombre]));
    assert.match(String(g.get('1.1.02')), /Bancos/);
    assert.match(String(g.get('1.1.04')), /IVA/);
    assert.match(String(g.get('1.1.05')), /Existencias/);
    assert.ok(!t.chart.some((a) => a.codigo === '4.2.01.006'), 'un gasto no puede estar en la clase 4');
    for (const a of t.chart) assert.ok(g.has(a.subgrupo), `subgrupo sin nombre: ${a.subgrupo}`);
  });

  await test('C5: una empresa sin plan está SIN_PLAN y no recibe un plan de respaldo', async () => {
    currentUser = superadmin;
    const r = await call('GET', `/api/companies/${rA}/chart`);
    assert.strictEqual(r.body.estado, 'SIN_PLAN');
    assert.strictEqual(r.body.chart.length, 0);
    const legacy = await call('GET', `/api/accounting/chart-of-accounts?empresaId=${rA}`);
    assert.strictEqual(legacy.body.estado, 'SIN_PLAN');
    assert.strictEqual(legacy.body.data.length, 0);
    const ctrl = fs.readFileSync(path.join(repo, 'src/controllers/accountingJournalController.ts'), 'utf8');
    assert.ok(!ctrl.includes('STANDARD_FALLBACK'));
    // El maestro de auxiliares tampoco entrega clientes y proveedores de ejemplo fuera de la demo
    assert.ok(ctrl.includes("source: 'SIN_REGISTROS'"));
  });

  await test('K2.3: no queda el plan "estándar" paralelo en src/', () => {
    const out = spawnSync('grep', ['-rln', 'STANDARD_ACCOUNT_PLAN', path.join(repo, 'src'), path.join(repo, 'server.ts')], { encoding: 'utf8' }).stdout.trim();
    assert.strictEqual(out, '');
  });

  await test('K2.1: el contador inicializa con la plantilla y el plan queda en el servidor', async () => {
    currentUser = contador;
    const r = await call('POST', `/api/companies/${rA}/chart/initialize`, { origen: 'PLANTILLA_ESTANDAR' });
    assert.strictEqual(r.status, 201, JSON.stringify(r.body));
    assert.strictEqual(r.body.estado, 'CONFIGURADO');
    assert.ok(r.body.chart.length > 50);
    const again = await call('POST', `/api/companies/${rA}/chart/initialize`, { origen: 'VACIO' });
    assert.strictEqual(again.status, 409);
    assert.strictEqual(again.body.code, 'PLAN_EXISTENTE');
  });

  await test('C4: una empresa con id antiguo se reconoce por su RUT (con puntos) para un usuario no SuperAdmin', async () => {
    currentUser = contador;
    const init = await call('POST', `/api/companies/${encodeURIComponent(conPuntos(rL))}/chart/initialize`, { origen: 'PLANTILLA_ESTANDAR' });
    assert.strictEqual(init.status, 201, JSON.stringify(init.body));
    const porId = await call('GET', '/api/companies/client-1731000000/chart');
    assert.strictEqual(porId.body.estado, 'CONFIGURADO');
    assert.strictEqual(porId.body.empresaId, 'client-1731000000');
  });

  await test('K2.1: los planes guardados por RUT en versiones anteriores se migran al id de la empresa', async () => {
    currentUser = superadmin;
    const snap: any = diskPersistence.getSnapshot();
    diskPersistence.updateCollection('chartsOfAccounts', { ...(snap.chartsOfAccounts || {}), [conPuntos(rC)]: buildStandardChartTemplate().chart.slice(0, 5) } as any);
    const r = await call('GET', `/api/companies/${rC}/chart`);
    assert.strictEqual(r.body.estado, 'CONFIGURADO');
    assert.strictEqual(r.body.chart.length, 5);
    assert.strictEqual(r.body.meta.origen, 'MIGRADO');
  });

  await test('C11: copiar el plan de otra empresa del mismo cliente; sin acceso, 403', async () => {
    currentUser = contador;
    const fuentes = await call('GET', `/api/companies/${rB}/chart/copy-sources`);
    assert.ok(fuentes.body.fuentes.some((f: any) => f.empresaId === rA));
    assert.ok(!fuentes.body.fuentes.some((f: any) => f.empresaId === rC), 'no debe ofrecer empresas sin acceso');
    const ajena = await call('POST', `/api/companies/${rB}/chart/initialize`, { origen: 'COPIA_EMPRESA', empresaOrigenId: rC });
    assert.strictEqual(ajena.status, 403);
    const copia = await call('POST', `/api/companies/${rB}/chart/initialize`, { origen: 'COPIA_EMPRESA', empresaOrigenId: rA });
    assert.strictEqual(copia.status, 201, JSON.stringify(copia.body));
    const a = svc.getCompanyChartState(rA).chart;
    const b = svc.getCompanyChartState(rB).chart;
    assert.strictEqual(b.length, a.length);
    const banco = b.find((x: any) => x.codigo === '1.1.02.001');
    assert.strictEqual(banco.esConciliableBancaria, a.find((x: any) => x.codigo === '1.1.02.001').esConciliableBancaria);
    assert.strictEqual(svc.getCompanyChartState(rB).meta?.empresaOrigenId, rA);
  });

  await test('C7: importar sin tipo ni naturaleza se rechaza; no se asume ACTIVO/DEUDORA', async () => {
    currentUser = superadmin;
    const rows = [
      ['Código', 'Descripción'],
      ['1-01-001', 'Caja'],
      ['4-01-001', 'Ventas'],
    ];
    const sinTipo = mapper.mapRowsToAccounts(rows, { headerRow: 0, mapping: { codigo: 0, nombre: 1 }, codeFormat: { tipo: 'SEPARADOR', separador: '-' } });
    assert.strictEqual(sinTipo.cuentas[1].tipo, undefined);
    const v = await call('POST', `/api/companies/${rC}/chart/validate`, { cuentas: sinTipo.cuentas });
    assert.strictEqual(v.body.valido, false);
    assert.ok(v.body.errores.some((e: any) => e.campo === 'tipo'));
    const src = fs.readFileSync(path.join(repo, 'src/components/accounting/ImportExportChartModal.tsx'), 'utf8');
    assert.ok(!src.includes("item.tipo || 'ACTIVO'") && !src.includes("item.naturaleza || 'DEUDORA'"));
  });

  await test('K2.5: importación desde otro sistema con tipo por clase explícito, máscara de código y equivalencias', async () => {
    currentUser = superadmin;
    const rows = [
      ['Plan de cuentas exportado'],
      ['Cuenta', 'Nombre cuenta', 'Saldo'],
      ['1101001', 'Caja', 'D'],
      ['2101001', 'Proveedores', 'A'],
      ['4101001', 'Ventas', 'A'],
    ];
    const profile = mapper.CHART_IMPORT_PROFILES.find((p) => p.id === 'SOFTLAND')!;
    const headerRow = mapper.detectHeaderRow(rows, profile);
    assert.strictEqual(headerRow, 1);
    const mapping = mapper.guessMapping(rows[headerRow], profile);
    const res = mapper.mapRowsToAccounts(rows, {
      headerRow,
      mapping,
      codeFormat: { tipo: 'MASCARA', mascara: '1-1-2-3' },
      tipoPorClase: mapper.DEFAULT_TIPO_POR_CLASE,
    });
    assert.deepStrictEqual(res.cuentas.map((c) => c.codigo), ['1.1.01.001', '2.1.01.001', '4.1.01.001']);
    assert.deepStrictEqual(res.cuentas.map((c) => c.naturaleza), ['DEUDORA', 'ACREEDORA', 'ACREEDORA']);
    // Reemplazar el plan migrado de C (sin movimientos) por el importado
    const r = await call('POST', `/api/companies/${rC}/chart/initialize`, {
      origen: 'IMPORTACION',
      sistemaOrigen: 'SOFTLAND',
      cuentas: res.cuentas,
      equivalencias: res.equivalencias,
      reemplazar: true,
    });
    assert.strictEqual(r.status, 201, JSON.stringify(r.body));
    assert.strictEqual(r.body.meta.sistemaOrigen, 'SOFTLAND');
    assert.ok(r.body.meta.equivalencias.some((e: any) => e.codigoExterno === '1101001' && e.codigo === '1.1.01.001'));
  });

  await test('K2.8/C3: una cuenta con movimientos no se elimina y el plan no se reemplaza completo', async () => {
    currentUser = contador;
    const snap: any = diskPersistence.getSnapshot();
    diskPersistence.updateCollection('entries', [...(snap.entries || []), { id: 'e-k2', empresaId: conPuntos(rA), lineas: [{ codigoCuenta: '1.1.02.001', debe: 100 }, { codigoCuenta: '4.1.01.001', haber: 100 }] }]);
    const chart = svc.getCompanyChartState(rA).chart.filter((a: any) => a.codigo !== '1.1.02.001');
    const del = await call('PUT', `/api/companies/${rA}/chart`, { chart });
    assert.strictEqual(del.status, 409);
    assert.strictEqual(del.body.code, 'CUENTAS_CON_MOVIMIENTOS');
    const reemplazo = await call('POST', `/api/companies/${rA}/chart/initialize`, { origen: 'VACIO', reemplazar: true });
    assert.strictEqual(reemplazo.body.code, 'PLAN_CON_MOVIMIENTOS');
    // Agregar una cuenta sí se permite
    const nueva = { codigo: '1.1.02.004', nombre: 'Banco Estado Cta Cte', tipo: 'ACTIVO', naturaleza: 'DEUDORA', clase: 1, clasificacion: 'CIRCULANTE' };
    const add = await call('PUT', `/api/companies/${rA}/chart`, { chart: [...svc.getCompanyChartState(rA).chart, nueva] });
    assert.strictEqual(add.status, 200, JSON.stringify(add.body));
  });

  await test('K2.7: los asientos se validan contra el plan de la empresa', () => {
    assert.strictEqual(svc.validateEntryAccounts(rA, ['1.1.02.001', '4.1.01.001']).ok, true);
    assert.strictEqual(svc.validateEntryAccounts(rA, ['9.9.99.99']).code, 'CUENTA_NO_EXISTE');
    // En el plan de A, 1.1.02.004 es imputable; se agrega 1.1.02.004.01 → 1.1.02.004 pasa a ser de agrupación
    const chart = svc.getCompanyChartState(rA).chart;
    svc.saveCompanyChart(rA, [...chart, { codigo: '1.1.02.004.01', nombre: 'Sub', tipo: 'ACTIVO', naturaleza: 'DEUDORA' }], undefined, 'test');
    assert.strictEqual(svc.validateEntryAccounts(rA, ['1.1.02.004']).code, 'CUENTA_NO_IMPUTABLE');
    const sinPlan = rutConDv(76500000 + Math.floor(Math.random() * 90000));
    assert.strictEqual(svc.validateEntryAccounts(sinPlan, ['1.1.01.001']).code, 'PLAN_CUENTAS_NO_CONFIGURADO');
    const ledger = fs.readFileSync(path.join(repo, 'src/services/accountingLedgerService.ts'), 'utf8');
    assert.ok(ledger.includes('validateEntryAccounts(header.empresaId'));
    const sup = fs.readFileSync(path.join(repo, 'src/controllers/supervisorLedgerController.ts'), 'utf8');
    assert.ok(!sup.includes("|| '1.1.01.001'"), 'sin cuenta Caja por defecto');
  });

  await test('C2: el normalizador resuelve contra el plan de la empresa y no inventa cuentas', () => {
    const base = { empresaId: rA, fecha: '2026-11-16', glosaGeneral: 'Prueba' };
    // Código heredado de otro plan con nombre → se resuelve por nombre en el plan de la empresa
    const ok = normalizeAndValidateJournalEntry({
      ...base,
      lineas: [
        { codigoCuenta: '5.2.01', nombreCuenta: 'Sueldos y Remuneraciones Base', debe: 1000, haber: 0 },
        { codigoCuenta: '2.1.07', nombreCuenta: 'Sueldos Líquidos por Pagar', debe: 0, haber: 1000 },
      ],
    } as any);
    assert.deepStrictEqual(ok.lineas.map((l) => l.codigoCuenta).sort(), ['2.1.02.001', '6.1.01.001']);
    const banco = normalizeAndValidateJournalEntry({
      ...base,
      lineas: [
        { nombreCuenta: 'Banco de Chile', debe: 500, haber: 0 },
        { nombreCuenta: 'Clientes', debe: 0, haber: 500 },
      ],
    } as any);
    assert.strictEqual(banco.lineas.find((l) => l.debe > 0)?.codigoCuenta, '1.1.02.002', 'Banco de Chile no puede ir a Santander');
    assert.throws(
      () =>
        normalizeAndValidateJournalEntry({
          ...base,
          lineas: [
            { nombreCuenta: 'Cuenta que no existe en ningún plan', debe: 10, haber: 0 },
            { codigoCuenta: '1.1.02.001', debe: 0, haber: 10 },
          ],
        } as any),
      (e: any) => e.code === 'CUENTA_NO_RESUELTA'
    );
    const src = fs.readFileSync(path.join(repo, 'src/services/journalEntryNormalizer.ts'), 'utf8');
    assert.ok(!src.includes("'9.9.99.99'"));
  });

  await test('K2.6/C10: los parámetros y cuentas por defecto son por empresa y se validan contra su plan', async () => {
    currentUser = contador;
    const malo = await call('PUT', `/api/companies/${rA}/system-parameters`, { parametros: { mesCierreEjercicio: 12, cuentaVentasDefecto: '4.1.01' } });
    assert.strictEqual(malo.status, 400);
    assert.strictEqual(malo.body.code, 'PARAMETROS_INVALIDOS');
    const agrup = await call('PUT', `/api/companies/${rA}/system-parameters`, { parametros: { cuentaPagableDefecto: '1.1.02.004' } });
    assert.strictEqual(agrup.status, 400, 'una cuenta de agrupación no es válida');
    const ok = await call('PUT', `/api/companies/${rA}/system-parameters`, { parametros: { mesCierreEjercicio: 6, cuentaVentasDefecto: '4.1.01.001', cuentaPagableDefecto: '' } });
    assert.strictEqual(ok.status, 200, JSON.stringify(ok.body));
    const b = await call('GET', `/api/companies/${rB}/system-parameters`);
    assert.strictEqual(b.body.parametros, null, 'los parámetros de A no afectan a B');
    const a = await call('GET', `/api/companies/${rA}/system-parameters`);
    assert.strictEqual(a.body.parametros.mesCierreEjercicio, 6);
    const cfg = fs.readFileSync(path.join(repo, 'src/config/erpMasterConfig.ts'), 'utf8');
    assert.ok(!/cuentaVentasDefecto: '4\.1\.01'/.test(cfg), 'sin cuentas por defecto de otro plan');
  });

  await test('Sin acceso a la empresa, el plan no se lee ni se modifica', async () => {
    currentUser = contador;
    const r = await call('GET', `/api/companies/${rC}/chart`);
    assert.strictEqual(r.status, 403);
    currentUser = { ...contador, roleCodigo: 'VENDEDOR' };
    const w = await call('PUT', `/api/companies/${rA}/chart`, { chart: [] });
    assert.strictEqual(w.status, 403);
  });

  server.close();
  diskPersistence.flushToDiskSync();
  console.log(`\nRESULTADO K2: ${passed} de ${total} pruebas pasaron.`);
  process.exit(passed === total ? 0 : 1);
}

run();
