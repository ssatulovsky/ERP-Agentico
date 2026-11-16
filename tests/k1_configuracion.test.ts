/**
 * K1 · Configuración de clientes sin éxitos falsos ni datos inventados.
 * Una prueba por hallazgo de la revisión del 16 nov 2026 (A1–A10, C1, C6).
 *
 * Se ejecuta en un directorio temporal: la persistencia de disco y el estado RBAC de la prueba
 * no tocan los datos del repositorio.
 */
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import type { AddressInfo } from 'node:net';

const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'erp-k1-'));
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
    console.error(`  ❌ ${name}\n     ${e?.message || e}`);
  }
}
const src = (rel: string) => fs.readFileSync(path.join(repo, rel), 'utf8');

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

async function run() {
  console.log('\nK1 · CONFIGURACIÓN DE CLIENTES HONESTA\n');
  const { clientsRouter } = await import('../src/controllers/clientsController');
  const { tenancyRouter } = await import('../src/controllers/tenancyController');
  const { diskPersistence } = await import('../src/services/diskPersistenceService');
  const { whatsappBridgeService } = await import('../src/services/whatsappBridgeService');
  const { assertVaultSecretPolicy, isVaultString } = await import('../src/utils/vaultCrypto');
  const { resolveClaveSii } = await import('../src/services/siiCredentialResolver');

  let currentUser: any = null;
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.user = currentUser;
    next();
  });
  app.use('/api/clients', clientsRouter);
  app.use('/api/tenancy', tenancyRouter);
  const server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const call = async (method: string, url: string, body?: any) => {
    const res = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: await res.json() };
  };

  const rut = rutConDv(77000000 + Math.floor(Math.random() * 900000));
  const superadmin = { userId: 'sa', isSuperAdmin: true, isAdmin: true, empresasPermitidas: [] };
  const lector = { userId: 'lec', isSuperAdmin: false, isAdmin: false, empresasPermitidas: [rut] };

  await test('A1/A2/A7: los modales de configuración reciben las props que esperan', () => {
    const cfg = src('src/components/AgentClientConfig.tsx');
    assert.ok(cfg.includes('onSaveMasterClient={'), 'la ficha ancla debe recibir onSaveMasterClient');
    assert.ok(cfg.includes('parameters={systemParams}'), 'parámetros de sistema debe recibir parameters');
    assert.ok(cfg.includes('existingClientsCount={clients.length}'), 'el alta debe recibir existingClientsCount');
    assert.ok(!cfg.includes('initialParameters='));
  });

  await test('C1: no existe el modal IFRS que mostraba éxito sin guardar', () => {
    assert.ok(!fs.existsSync(path.join(repo, 'src/components/tenancy/IfrsChartOfAccountsModal.tsx')));
    assert.ok(!src('src/components/AgentClientConfig.tsx').includes("console.log('Nueva cuenta IFRS"));
  });

  await test('C6: restaurar el plan ya no entrega un objeto como lista de cuentas (pasa por el asistente del servidor)', () => {
    const sao = src('src/components/SeniorAccountingOrchestrator.tsx');
    assert.ok(!sao.includes('setChartOfAccounts(def)'));
    assert.ok(sao.includes('<ChartInitializationWizard'));
  });

  await test('A5: el alta no trae una empresa ficticia ni inventa banco, cuenta, régimen o PPM', () => {
    const m = src('src/components/tenancy/NewErpClientOnboardingModal.tsx');
    for (const marcador of ['77.543.890-2', 'PACÍFICO', '00-129481-0', "bancoPrincipal: 'Banco de Chile'", "regimenTributario: '14D3_PROPYME_GENERAL'", 'tasaPpm: 0.01', 'Andrea Morales', '5000000']) {
      assert.ok(!m.includes(marcador), `quedó el dato inventado "${marcador}"`);
    }
  });

  await test('A9: la ficha ancla no usa un RUT de respaldo', () => {
    const m = src('src/components/tenancy/AnchorClientMasterModal.tsx');
    assert.ok(!m.includes("|| '76.123.456-7'"));
    assert.ok(!m.includes("numeroCuenta: client?.numeroCuenta || '00-000000-0'"));
  });

  await test('A3: la clave SII se guarda cifrada y nunca se devuelve', async () => {
    currentUser = superadmin;
    const crear = await call('PUT', `/api/clients/${rut}`, { id: rut, rut, razonSocial: 'Prueba K1 SpA', claveSii: 'ClaveReal#2026' });
    assert.strictEqual(crear.status, 201, JSON.stringify(crear.body));
    assert.strictEqual(crear.body.cliente.claveSii, '');
    assert.strictEqual(crear.body.cliente.hasClaveSii, true);
    const guardada = (diskPersistence.getSnapshot() as any).clients.find((c: any) => c.id === rut);
    assert.ok(isVaultString(guardada.claveSii), 'en disco debe quedar cifrada');
    assert.ok(!JSON.stringify(diskPersistence.getSnapshot()).includes('ClaveReal#2026'));
    assert.strictEqual(resolveClaveSii(guardada, rut), 'ClaveReal#2026', 'el agente SII debe poder descifrarla');
    // Guardar de nuevo sin clave conserva la registrada
    const upd = await call('PUT', `/api/clients/${rut}`, { id: rut, rut, razonSocial: 'Prueba K1 SpA', giro: 'Servicios', claveSii: '' });
    assert.strictEqual(upd.status, 200);
    const despues = (diskPersistence.getSnapshot() as any).clients.find((c: any) => c.id === rut);
    assert.strictEqual(resolveClaveSii(despues, rut), 'ClaveReal#2026');
    currentUser = lector;
    const lista = await call('GET', '/api/clients');
    const vista = lista.body.clientes.find((c: any) => c.id === rut);
    assert.ok(vista && vista.claveSii === '' && vista.hasClaveSii === true);
  });

  await test('K1: el id de una empresa nueva es su RUT sin puntos', async () => {
    currentUser = superadmin;
    const otro = rutConDv(78000000 + Math.floor(Math.random() * 900000));
    const r = await call('PUT', `/api/clients/client-${Date.now()}`, { id: undefined, rut: otro, razonSocial: 'Id Antiguo SpA' });
    assert.strictEqual(r.status, 400);
    assert.strictEqual(r.body.error, 'ID_DEBE_SER_RUT');
  });

  await test('K1.6: en producción la bóveda exige una clave maestra propia', () => {
    assert.throws(() => assertVaultSecretPolicy({ NODE_ENV: 'production' } as any));
    assert.throws(() => assertVaultSecretPolicy({ NODE_ENV: 'production', VAULT_MASTER_SECRET: 'SIEX_VAULT_AES256_MASTER_SECRET_2026_PROD' } as any));
    assert.throws(() => assertVaultSecretPolicy({ NODE_ENV: 'production', VAULT_MASTER_SECRET: '9f8b4c2d1e0a7e6f5d4c3b2a19807f6e5d4c3b2a10987e6d5c4b3a2f1e0d9c8b' } as any));
    assert.doesNotThrow(() => assertVaultSecretPolicy({ NODE_ENV: 'production', VAULT_MASTER_SECRET: 'a'.repeat(16) + 'b'.repeat(24) } as any));
    assert.ok(!src('.env.example').includes('9f8b4c2d1e0a7e6f'));
  });

  await test('A4: el acceso inicial crea de verdad el usuario administrador', async () => {
    currentUser = superadmin;
    const username = `admin.k1.${Date.now()}`;
    const r = await call('POST', `/api/clients/${rut}/initial-admin`, { username, nombreCompleto: 'Admin K1', email: 'admin@k1.cl' });
    assert.strictEqual(r.status, 201, JSON.stringify(r.body));
    assert.ok(r.body.claveTemporal && r.body.claveTemporal.length >= 12);
    const user = whatsappBridgeService.getRbacState().users.find((u: any) => u.username === username);
    assert.ok(user, 'el usuario debe existir en el estado RBAC');
    assert.strictEqual(user.empresaPrincipalId, rut);
    assert.strictEqual(user.debeCambiarPassword, true);
    assert.notStrictEqual(user.password, r.body.claveTemporal, 'la clave se guarda con hash');
    const dup = await call('POST', `/api/clients/${rut}/initial-admin`, { username, nombreCompleto: 'X', email: 'x@x.cl' });
    assert.strictEqual(dup.status, 409);
    const falta = await call('POST', `/api/clients/${rut}/initial-admin`, { username: 'nuevo' });
    assert.strictEqual(falta.body.code, 'MISSING_PARAMS');
    currentUser = { ...lector, isAdmin: true };
    const noSa = await call('POST', `/api/clients/${rut}/initial-admin`, { username: 'otro.k1', nombreCompleto: 'X', email: 'x@x.cl' });
    assert.strictEqual(noSa.status, 403);
  });

  await test('A8: dar de baja una empresa la saca de la cartera del servidor', async () => {
    currentUser = { ...lector, isAdmin: true };
    const sinMotivo = await call('POST', `/api/clients/${rut}/baja`, {});
    assert.strictEqual(sinMotivo.status, 400);
    const baja = await call('POST', `/api/clients/${rut}/baja`, { motivo: 'Término de contrato' });
    assert.strictEqual(baja.status, 200, JSON.stringify(baja.body));
    const lista = await call('GET', '/api/clients');
    assert.ok(!lista.body.clientes.some((c: any) => c.id === rut));
    assert.ok(src('src/App.tsx').includes('/baja`'), 'la UI debe llamar al servidor');
  });

  await test('A8: el borrado definitivo solo procede sin movimientos', async () => {
    currentUser = superadmin;
    const snap: any = diskPersistence.getSnapshot();
    diskPersistence.updateCollection('entries', [...(snap.entries || []), { id: 'e-k1', empresaId: rut, glosa: 'x' }]);
    const conMov = await call('DELETE', `/api/clients/${rut}`);
    assert.strictEqual(conMov.status, 409);
    diskPersistence.updateCollection('entries', (snap.entries || []).filter((e: any) => e.id !== 'e-k1'));
    const ok = await call('DELETE', `/api/clients/${rut}`);
    assert.strictEqual(ok.status, 200);
  });

  await test('A10: tenancy sin MySQL no inventa estudios ni módulos y guarda lo que recibe', async () => {
    currentUser = superadmin;
    const firms = await call('GET', '/api/tenancy/firms');
    assert.ok(!JSON.stringify(firms.body).includes('Audicon'));
    const mods = await call('GET', '/api/tenancy/companies/EMPRESA-SIN-MODULOS/modules');
    assert.strictEqual(mods.body.count, 0);
    const sinFecha = await call('POST', '/api/tenancy/companies/EMP-1/modules', { moduloCodigo: 'CONTABILIDAD', pagadoPor: 'ESTUDIO' });
    assert.strictEqual(sinFecha.body.code, 'MISSING_PARAMS');
    const firmRut = rutConDv(76000000 + Math.floor(Math.random() * 900000));
    const crear = await call('POST', '/api/tenancy/firms', { rut: firmRut, razonSocial: 'Estudio K1', emailContacto: 'e@k1.cl', plan: 'PROFESIONAL' });
    assert.strictEqual(crear.status, 201);
    const lista = await call('GET', '/api/tenancy/firms');
    assert.ok(lista.body.data.some((f: any) => f.rut === firmRut), 'el estudio debe quedar guardado');
  });

  await test('A10: la bóveda cifra cada secreto con su propio IV, incluidas las credenciales bancarias', async () => {
    currentUser = superadmin;
    const r = await call('POST', '/api/tenancy/companies/VAULT-K1/vault', { claveSii: 'sii-1', claveCertificado: 'cert-2', apiBancosJson: { token: 'banco-3' } });
    assert.strictEqual(r.status, 200);
    const entry = diskPersistence.getVaultEntry('VAULT-K1');
    assert.ok(isVaultString(entry.claveSii) && isVaultString(entry.claveCertificado) && isVaultString(entry.apiBancos));
    const ivs = [entry.claveSii, entry.claveCertificado, entry.apiBancos].map((v: string) => v.split(':')[2]);
    assert.strictEqual(new Set(ivs).size, 3);
    assert.ok(!JSON.stringify(entry).includes('banco-3'));
  });

  server.close();
  diskPersistence.flushToDiskSync();
  console.log(`\nRESULTADO K1: ${passed} de ${total} pruebas pasaron.`);
  process.exit(passed === total ? 0 : 1);
}

run();
