/**
 * 4.5 Instalación real sin datos de ejemplo (sin DEMO_MODE).
 *
 * Esta suite NO activa DEMO_MODE: verifica lo que ve una instalación real.
 */
import assert from 'node:assert';
import express from 'express';
import type { AddressInfo } from 'node:net';

delete process.env.DEMO_MODE;

async function run() {
  // Importación dinámica: DEMO_MODE debe estar apagado antes de cargar los módulos.
  const rbac = await import('../src/services/securityRbacService');
  const { buildFirstInstallState } = await import('../src/scripts/installSystem');
  const { clientsRouter } = await import('../src/controllers/clientsController');
  const { diskPersistence } = await import('../src/services/diskPersistenceService');
  const { verifyPassword } = await import('../src/utils/passwordCrypto');

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
  console.log('=== 4.5 INSTALACIÓN REAL SIN DATOS DE EJEMPLO ===\n');

  await test('Sin DEMO_MODE el estado de seguridad por defecto no trae empresas ni usuarios de ejemplo', () => {
    assert.deepStrictEqual(rbac.DEFAULT_SECURITY_RBAC_STATE.users, []);
    assert.deepStrictEqual(rbac.DEFAULT_SECURITY_RBAC_STATE.companiesConfig, []);
    assert.ok(rbac.DEFAULT_SECURITY_RBAC_STATE.roles.some((r) => r.id === 'role-superadmin'), 'Los roles estándar sí se incluyen');
  });

  const temp = 'Init_PruebaTemporal!26';
  const inst = buildFirstInstallState({ empresaRut: '76.123.456-0', razonSocial: 'Prueba Instalación SpA', adminUsername: 'sergio' }, temp);

  await test('El instalador crea solo la empresa indicada y su administrador, con id propio y clave temporal', () => {
    assert.deepStrictEqual(inst.state.companiesConfig.map((c: any) => c.empresaId), ['76123456-0']);
    assert.strictEqual(inst.state.users.length, 1);
    const u: any = inst.state.users[0];
    assert.strictEqual(u.username, 'sergio');
    assert.notStrictEqual(u.id, 'usr-superadmin', 'No debe compartir id con el usuario de la demostración');
    assert.strictEqual(u.debeCambiarPassword, true);
    assert.ok(verifyPassword(temp, u.password));
    assert.strictEqual(inst.client.id, '76123456-0');
  });

  await test('El instalador rechaza un RUT inválido o una empresa sin razón social', () => {
    assert.throws(() => buildFirstInstallState({ empresaRut: '76.123.456-1', razonSocial: 'X' }, temp), /RUT de empresa inválido/);
    assert.throws(() => buildFirstInstallState({ empresaRut: '76.123.456-0', razonSocial: ' ' }, temp), /razón social/);
  });

  await test('Al fusionar con el estado guardado no reaparecen los usuarios de la demostración', () => {
    const merged = rbac.mergeSecurityRbacStates(inst.state as any, rbac.DEFAULT_SECURITY_RBAC_STATE);
    assert.deepStrictEqual(merged.users.map((u) => u.username), ['sergio']);
    assert.deepStrictEqual(merged.companiesConfig.map((c) => c.empresaId), ['76123456-0']);
  });

  await test('Un usuario de la instalación ingresa sin elegir empresa (se usa su empresa principal)', () => {
    const r = rbac.authenticateErpLogin({ usernameInput: 'sergio', passwordInput: temp, empresaId: (inst.state.users[0] as any).empresaPrincipalId, state: inst.state as any });
    assert.strictEqual(r.ok, true, r.errorMessage);
  });

  // Cartera de empresas en el servidor
  const app = express();
  app.use(express.json());
  let currentUser: any = null;
  app.use((req: any, _res, next) => {
    req.user = currentUser;
    next();
  });
  app.use('/api/clients', clientsRouter);
  const server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/clients`;
  const call = async (method: string, path = '', body?: any) => {
    const res = await fetch(`${base}${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: await res.json() };
  };
  const rut = `${70 + Math.floor(Math.random() * 9)}${String(Date.now()).slice(-6)}`;
  const dv = (n: string) => {
    let s = 0;
    let m = 2;
    for (const d of n.split('').reverse()) {
      s += Number(d) * m;
      m = m === 7 ? 2 : m + 1;
    }
    const r = 11 - (s % 11);
    return r === 11 ? '0' : r === 10 ? 'K' : String(r);
  };
  const nuevaId = `${rut}-${dv(rut)}`;
  const superadmin = { userId: 'u1', isSuperAdmin: true, isAdmin: true, empresaPrincipalId: 'X', empresasPermitidas: [] };
  const admin = { userId: 'u2', isSuperAdmin: false, isAdmin: true, empresaPrincipalId: nuevaId, empresasPermitidas: [nuevaId] };
  const otro = { userId: 'u3', isSuperAdmin: false, isAdmin: false, empresaPrincipalId: 'OTRA-1', empresasPermitidas: ['OTRA-1'] };

  await test('La cartera se guarda en el servidor: el SuperAdmin registra, el administrador actualiza la suya', async () => {
    currentUser = superadmin;
    const crear = await call('PUT', `/${nuevaId}`, { id: nuevaId, rut: nuevaId, razonSocial: 'Cartera Servidor SpA' });
    assert.strictEqual(crear.status, 201, JSON.stringify(crear.body));
    currentUser = admin;
    const upd = await call('PUT', `/${nuevaId}`, { id: nuevaId, rut: nuevaId, razonSocial: 'Cartera Servidor SpA', giro: 'Servicios' });
    assert.strictEqual(upd.status, 200);
    const lista = await call('GET');
    assert.ok(lista.body.clientes.some((c: any) => c.id === nuevaId && c.giro === 'Servicios'));
  });

  await test('Un usuario no ve ni modifica empresas ajenas; un administrador no crea empresas nuevas', async () => {
    currentUser = otro;
    const lista = await call('GET');
    assert.ok(!lista.body.clientes.some((c: any) => c.id === nuevaId));
    const mod = await call('PUT', `/${nuevaId}`, { id: nuevaId, rut: nuevaId, razonSocial: 'Hackeo' });
    assert.strictEqual(mod.status, 403);
    currentUser = admin;
    const crear = await call('PUT', '/76123456-0', { id: '76123456-0', rut: '76.123.456-0', razonSocial: 'Otra' });
    assert.strictEqual(crear.status, 403);
    currentUser = superadmin;
    const malRut = await call('PUT', '/X-1', { id: 'X-1', rut: '1.111.111-2', razonSocial: 'X' });
    assert.strictEqual(malRut.status, 400);
  });

  server.close();
  {
    const snap: any = diskPersistence.getSnapshot();
    diskPersistence.updateCollection('clients', (snap.clients || []).filter((c: any) => c.id !== nuevaId));
    diskPersistence.flushToDiskSync();
  }
  console.log(`\nRESULTADO 4.5 INSTALACIÓN: ${passed} de ${total} pruebas pasaron.`);
  process.exit(passed === total ? 0 : 1);
}

run();
