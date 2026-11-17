/**
 * K6 · Consola "Mi cliente ERP": usuarios y accesos limitados al propio cliente ERP.
 * El administrador de un cliente (p. ej. un estudio contable) administra los usuarios de sus empresas
 * y ve su plan y sus facturas, sin ver ni tocar nada de otro cliente ERP.
 * Se ejecuta en un directorio temporal.
 */
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import type { AddressInfo } from 'node:net';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'erp-k6-'));
process.chdir(tmp);
delete process.env.DEMO_MODE;
delete process.env.SMTP_HOST;

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

async function run() {
  console.log('\nK6 · CONSOLA MI CLIENTE ERP\n');
  await import('../src/services/saasHooks');
  const { accountRouter } = await import('../src/controllers/accountController');
  const { centralizedAuthorizationMiddleware } = await import('../src/middlewares/centralizedAuthorizationMiddleware');
  const { diskPersistence } = await import('../src/services/diskPersistenceService');
  const { whatsappBridgeService } = await import('../src/services/whatsappBridgeService');
  const saas = await import('../src/services/saasAccountService');
  const billing = await import('../src/services/saasBillingService');

  const rOwner = rutConDv(76910000 + Math.floor(Math.random() * 9000));
  const rSiex1 = rutConDv(77410000 + Math.floor(Math.random() * 9000));
  const rSiex2 = rutConDv(77420000 + Math.floor(Math.random() * 9000));
  const rOtro = rutConDv(77510000 + Math.floor(Math.random() * 9000));
  diskPersistence.updateCollection('clients', [
    { id: rOwner, rut: rOwner, razonSocial: 'InnovAgile Group SpA', esEmpresaDuenaErp: true, estadoEmpresa: 'ACTIVA' },
    { id: rSiex1, rut: rSiex1, razonSocial: 'Siex Consultores SpA', estadoEmpresa: 'ACTIVA' },
    { id: rSiex2, rut: rSiex2, razonSocial: 'Cliente de Siex Ltda', estadoEmpresa: 'ACTIVA' },
    { id: rOtro, rut: rOtro, razonSocial: 'Otro Cliente SpA', estadoEmpresa: 'ACTIVA' },
  ]);
  saas.ensureOwnerAccount();
  const datos = (rut: string, razonSocial: string, limiteUsuarios: number) => ({
    tipo: 'ESTUDIO_CONTABLE' as any,
    rut,
    razonSocial,
    giro: 'Servicios contables',
    direccion: 'Calle 1',
    comuna: 'Santiago',
    emailFacturacion: 'pagos@x.cl',
    contactoCobranza: { nombre: 'Ana', email: 'ana@x.cl' },
    planId: 'PLAN_STARTER',
    condiciones: { limiteEmpresas: 5, limiteUsuarios },
    contrato: { fechaInicio: '2026-01-01', diaFacturacion: 1, diasPlazoPago: 10 },
  });
  const siex = saas.createAccount(datos(rutConDv(78410000), 'Siex Consultores SpA', 3) as any, 'sa');
  const otro = saas.createAccount(datos(rutConDv(78510000), 'Otro Cliente SpA', 5) as any, 'sa');
  saas.assignCompanies(siex.id, [rSiex1, rSiex2], 'sa');
  saas.assignCompanies(otro.id, [rOtro], 'sa');

  whatsappBridgeService.saveRbacStore({
    ...whatsappBridgeService.getRbacState(),
    users: [
      { id: 'u-sa', username: 'sa', nombreCompleto: 'Súper', estado: 'ACTIVO', rolId: 'role-superadmin', empresaPrincipalId: rOwner, empresasAnclasPermitidas: [] },
      { id: 'u-siex-admin', username: 'siexadmin', nombreCompleto: 'Admin Siex', estado: 'ACTIVO', rolId: 'role-admin', empresaPrincipalId: rSiex1, empresasAnclasPermitidas: [] },
      { id: 'u-siex-cont', username: 'siexcont', nombreCompleto: 'Contador Siex', estado: 'ACTIVO', rolId: 'role-contabilidad', empresaPrincipalId: rSiex2, empresasAnclasPermitidas: [] },
      { id: 'u-otro', username: 'otroadmin', nombreCompleto: 'Admin Otro', estado: 'ACTIVO', rolId: 'role-admin', empresaPrincipalId: rOtro, empresasAnclasPermitidas: [] },
    ],
  } as any);

  // Factura emitida a Siex y otra al otro cliente
  const fSiex = billing.createInvoiceDraft(siex, '2026-10', 'sa');
  billing.registerExternalEmission(fSiex.id, { folio: 101, fechaEmision: '2026-10-01' }, 'sa');
  const fOtro = billing.createInvoiceDraft(otro, '2026-10', 'sa');
  billing.registerExternalEmission(fOtro.id, { folio: 202, fechaEmision: '2026-10-01' }, 'sa');

  let currentUser: any = null;
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.user = currentUser;
    next();
  });
  app.use(centralizedAuthorizationMiddleware);
  app.use('/api/account', accountRouter);
  const server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const call = async (method: string, url: string, body?: any) => {
    const res = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: await res.json() };
  };
  const adminSiex = { userId: 'u-siex-admin', username: 'siexadmin', isSuperAdmin: false, isAdmin: true, roleCodigo: 'ADMIN', empresaPrincipalId: rSiex1, empresasPermitidas: [rSiex1, rSiex2], modulosPermitidos: [] };
  const contadorSiex = { userId: 'u-siex-cont', username: 'siexcont', isSuperAdmin: false, isAdmin: false, roleCodigo: 'CONTABILIDAD', empresaPrincipalId: rSiex2, empresasPermitidas: [rSiex2], modulosPermitidos: ['CONTABILIDAD'] };
  const superadmin = { userId: 'u-sa', username: 'sa', isSuperAdmin: true, isAdmin: true, empresaPrincipalId: rOwner, empresasPermitidas: [rOwner], modulosPermitidos: [] };

  await test('K6.1: el administrador de Siex ve solo los usuarios, empresas y roles de su cliente ERP', async () => {
    currentUser = adminSiex;
    const r = await call('GET', '/api/account/users');
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    assert.strictEqual(r.body.cuenta.id, siex.id);
    assert.deepStrictEqual(r.body.usuarios.map((u: any) => u.username).sort(), ['siexadmin', 'siexcont']);
    assert.deepStrictEqual(r.body.empresas.map((e: any) => e.id).sort(), [rSiex1, rSiex2].sort());
    assert.ok(!r.body.roles.some((x: any) => x.tipoSistema === 'SUPERADMIN'), 'no ofrece el rol SuperAdmin');
    assert.ok(!JSON.stringify(r.body).includes('password'), 'nunca devuelve claves');
  });

  await test('K6.1: un usuario sin rol de administrador no entra a la consola', async () => {
    currentUser = contadorSiex;
    const r = await call('GET', '/api/account/users');
    assert.strictEqual(r.status, 403);
    assert.strictEqual(r.body.error, 'ROL_NO_PERMITIDO');
  });

  await test('K6.1: no puede consultar otro cliente ERP aunque lo pida por parámetro', async () => {
    currentUser = adminSiex;
    const r = await call('GET', `/api/account/users?cuentaId=${otro.id}`);
    assert.strictEqual(r.status, 403);
    assert.strictEqual(r.body.error, 'CLIENTE_ERP_AJENO');
  });

  let nuevoId = '';
  await test('K6.1: crea un usuario de sus empresas con clave temporal y cambio obligatorio', async () => {
    currentUser = adminSiex;
    const falta = await call('POST', '/api/account/users', { username: 'x' });
    assert.strictEqual(falta.body.code, 'MISSING_PARAMS');
    const r = await call('POST', '/api/account/users', {
      username: 'siex.asistente',
      nombreCompleto: 'Asistente Siex',
      email: 'asistente@siex.cl',
      rolId: 'role-contabilidad',
      empresaPrincipalId: rSiex2,
      empresasAnclasPermitidas: [rSiex1],
    });
    assert.strictEqual(r.status, 201, JSON.stringify(r.body));
    assert.ok(r.body.claveTemporal && r.body.claveTemporal.length >= 10);
    assert.strictEqual(r.body.usuario.debeCambiarPassword, true);
    nuevoId = r.body.usuario.id;
    const guardado = whatsappBridgeService.getRbacState().users.find((u: any) => u.id === nuevoId);
    assert.ok(String(guardado.password).startsWith('scrypt:'), 'la clave se guarda con hash');
  });

  await test('K6.1: no puede dar acceso a empresas de otro cliente ni asignar SuperAdmin', async () => {
    currentUser = adminSiex;
    const ajena = await call('POST', '/api/account/users', { username: 'intruso', nombreCompleto: 'X', email: 'x@x.cl', rolId: 'role-admin', empresaPrincipalId: rSiex1, empresasAnclasPermitidas: [rOtro] });
    assert.strictEqual(ajena.status, 403);
    assert.strictEqual(ajena.body.error, 'EMPRESA_FUERA_DEL_CLIENTE');
    const sa = await call('POST', '/api/account/users', { username: 'intruso2', nombreCompleto: 'X', email: 'x@x.cl', rolId: 'role-superadmin', empresaPrincipalId: rSiex1 });
    assert.strictEqual(sa.status, 403);
    assert.strictEqual(sa.body.error, 'ROL_NO_ASIGNABLE');
    const mover = await call('PUT', `/api/account/users/${nuevoId}`, { empresaPrincipalId: rOtro });
    assert.strictEqual(mover.status, 403);
  });

  await test('K6.1: respeta el límite de usuarios activos del plan', async () => {
    currentUser = adminSiex;
    const r = await call('POST', '/api/account/users', { username: 'cuarto', nombreCompleto: 'Cuarto', email: 'c@siex.cl', rolId: 'role-contabilidad', empresaPrincipalId: rSiex1 });
    assert.strictEqual(r.status, 409, JSON.stringify(r.body));
    assert.strictEqual(r.body.error, 'LIMITE_USUARIOS');
  });

  await test('K6.1: un usuario de otro cliente ERP se trata como inexistente', async () => {
    currentUser = adminSiex;
    const r = await call('PUT', '/api/account/users/u-otro', { estado: 'INACTIVO' });
    assert.strictEqual(r.status, 404);
    const rp = await call('POST', '/api/account/users/u-otro/reset-password');
    assert.strictEqual(rp.status, 404);
    assert.strictEqual(whatsappBridgeService.getRbacState().users.find((u: any) => u.id === 'u-otro').estado, 'ACTIVO');
  });

  await test('K6.1: cambia rol y estado de sus usuarios, pero no los suyos propios', async () => {
    currentUser = adminSiex;
    const r = await call('PUT', `/api/account/users/${nuevoId}`, { rolId: 'role-rrhh', estado: 'INACTIVO' });
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    assert.strictEqual(r.body.usuario.rolId, 'role-rrhh');
    assert.strictEqual(r.body.usuario.estado, 'INACTIVO');
    const yo = await call('PUT', '/api/account/users/u-siex-admin', { rolId: 'role-contabilidad' });
    assert.strictEqual(yo.status, 403);
    assert.strictEqual(yo.body.error, 'AUTOMODIFICACION_PROHIBIDA');
    const yoDatos = await call('PUT', '/api/account/users/u-siex-admin', { cargo: 'Socio' });
    assert.strictEqual(yoDatos.status, 200, 'sí puede cambiar sus propios datos de contacto');
  });

  await test('K6.1: al editar se conservan accesos a otro cliente dados por la administración del ERP', async () => {
    const st = whatsappBridgeService.getRbacState();
    whatsappBridgeService.saveRbacStore({
      ...st,
      users: st.users.map((u: any) => (u.id === 'u-siex-cont' ? { ...u, empresasAnclasPermitidas: [rOtro] } : u)),
    } as any);
    currentUser = adminSiex;
    const lista = await call('GET', '/api/account/users');
    const cont = lista.body.usuarios.find((u: any) => u.id === 'u-siex-cont');
    const r = await call('PUT', '/api/account/users/u-siex-cont', { ...cont, empresasAnclasPermitidas: [...cont.empresasAnclasPermitidas, rSiex1], cargo: 'Contador' });
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    const guardado = whatsappBridgeService.getRbacState().users.find((u: any) => u.id === 'u-siex-cont');
    assert.deepStrictEqual([...guardado.empresasAnclasPermitidas].sort(), [rOtro, rSiex1].sort());
  });

  await test('K6.1: restablecer la clave entrega una temporal y obliga a cambiarla', async () => {
    currentUser = adminSiex;
    const antes = whatsappBridgeService.getRbacState().users.find((u: any) => u.id === 'u-siex-cont').password;
    const r = await call('POST', '/api/account/users/u-siex-cont/reset-password');
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    assert.ok(r.body.claveTemporal);
    const despues = whatsappBridgeService.getRbacState().users.find((u: any) => u.id === 'u-siex-cont');
    assert.notStrictEqual(despues.password, antes);
    assert.strictEqual(despues.debeCambiarPassword, true);
  });

  await test('K6.2: el resumen muestra su plan, consumo y solo sus facturas', async () => {
    currentUser = adminSiex;
    const r = await call('GET', '/api/account/overview');
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    assert.strictEqual(r.body.cuenta.razonSocial, 'Siex Consultores SpA');
    assert.strictEqual(r.body.consumo.empresas, 2);
    assert.deepStrictEqual(r.body.facturas.map((f: any) => f.folio), [101]);
    assert.ok(!JSON.stringify(r.body).includes('Otro Cliente'), 'no expone datos de otro cliente');
  });

  await test('K6: el SuperAdmin administra cualquier cliente con ?cuentaId=', async () => {
    currentUser = superadmin;
    const r = await call('GET', `/api/account/users?cuentaId=${otro.id}`);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    assert.deepStrictEqual(r.body.usuarios.map((u: any) => u.username), ['otroadmin']);
    const propio = await call('GET', '/api/account/overview');
    assert.strictEqual(propio.body.cuenta.esPropietario, true, 'sin cuentaId: el cliente ERP de la empresa dueña');
  });

  await test('K6: un cliente ERP suspendido no usa la consola (bloqueo total)', async () => {
    saas.changeAccountState(siex.id, 'SUSPENDIDA', 'Prueba de bloqueo', { usuarioId: 'sa' });
    currentUser = adminSiex;
    const r = await call('GET', '/api/account/overview');
    assert.strictEqual(r.status, 403, JSON.stringify(r.body));
    assert.strictEqual(r.body.error, 'CLIENTE_SUSPENDIDO');
  });

  server.close();
  console.log(`\nRESULTADO K6: ${passed} de ${total} pruebas pasaron.\n`);
  process.exit(passed === total ? 0 : 1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
