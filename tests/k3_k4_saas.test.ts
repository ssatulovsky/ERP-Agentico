/**
 * K3/K4 · Cliente ERP, estado único, límites, módulos del plan, facturación y cobranza automática.
 * Hallazgos S1–S9 de la revisión del 16 nov 2026 y decisiones del mismo día (bloqueo total,
 * plazos 5/10/15 parametrizables, respaldo de 10 años en la baja).
 * Se ejecuta en un directorio temporal.
 */
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import express from 'express';
import type { AddressInfo } from 'node:net';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'erp-k3-'));
process.chdir(tmp);
delete process.env.DEMO_MODE;
delete process.env.SMTP_HOST;
process.env.SAAS_BACKUP_DIR = path.join(tmp, 'respaldos');

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
const addDays = (d: string, n: number) => new Date(new Date(`${d}T12:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10);
const at = (d: string) => new Date(`${d}T12:00:00Z`);

async function run() {
  console.log('\nK3/K4 · ADMINISTRACIÓN COMERCIAL DEL ERP\n');
  await import('../src/services/saasHooks');
  const { clientsRouter } = await import('../src/controllers/clientsController');
  const { saasRouter } = await import('../src/controllers/saasController');
  const { centralizedAuthorizationMiddleware } = await import('../src/middlewares/centralizedAuthorizationMiddleware');
  const { diskPersistence } = await import('../src/services/diskPersistenceService');
  const { whatsappBridgeService } = await import('../src/services/whatsappBridgeService');
  const saas = await import('../src/services/saasAccountService');
  const billing = await import('../src/services/saasBillingService');
  const notif = await import('../src/services/saasNotificationService');
  const { resolveAllowedCompanyIdsForUser } = await import('../src/services/securityRbacService');
  const { HrManagementService } = await import('../src/services/hrManagementService');

  // Estado RBAC mínimo
  whatsappBridgeService.saveRbacStore({ ...whatsappBridgeService.getRbacState(), companiesConfig: [], users: [] } as any);

  // Empresa dueña
  const rOwner = rutConDv(76900000 + Math.floor(Math.random() * 9000));
  diskPersistence.updateCollection('clients', [
    { id: rOwner, rut: rOwner, razonSocial: 'Dueña ERP SpA', giro: 'Software', direccion: 'Calle 1', comuna: 'Santiago', esEmpresaDuenaErp: true, estadoEmpresa: 'ACTIVA' },
  ]);

  let currentUser: any = null;
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.user = currentUser;
    next();
  });
  app.use(centralizedAuthorizationMiddleware);
  app.use('/api/clients', clientsRouter);
  app.use('/api/saas', saasRouter);
  app.get('/api/accounting/ping', (_req, res) => res.json({ success: true }));
  app.get('/api/modules/inventory/ping', (_req, res) => res.json({ success: true }));
  const server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const call = async (method: string, url: string, body?: any) => {
    const res = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: await res.json() };
  };
  const superadmin = { userId: 'sa', username: 'sa', isSuperAdmin: true, isAdmin: true, empresaPrincipalId: rOwner, empresasPermitidas: [rOwner], modulosPermitidos: [] };

  let accId = '';
  const rC1 = rutConDv(77100000 + Math.floor(Math.random() * 9000));
  const rC2 = rutConDv(77200000 + Math.floor(Math.random() * 9000));
  const rC3 = rutConDv(77300000 + Math.floor(Math.random() * 9000));
  const rCliente = rutConDv(78100000 + Math.floor(Math.random() * 9000));

  await test('K3.1: la empresa dueña queda como cliente ERP propietario (sin facturación ni límites)', async () => {
    currentUser = superadmin;
    const o = await call('GET', '/api/saas/overview');
    assert.strictEqual(o.status, 200, JSON.stringify(o.body));
    const owner = o.body.clientes.find((c: any) => c.esPropietario);
    assert.ok(owner, 'debe existir el propietario');
    assert.ok(owner.empresas.some((e: any) => e.id === rOwner));
  });

  await test('K3.1: crear un cliente ERP exige sus datos; el plan fija condiciones y módulos', async () => {
    currentUser = superadmin;
    const falta = await call('POST', '/api/saas/accounts', { rut: rCliente });
    assert.strictEqual(falta.body.code, 'MISSING_PARAMS');
    const r = await call('POST', '/api/saas/accounts', {
      tipo: 'ESTUDIO_CONTABLE',
      rut: rCliente,
      razonSocial: 'Estudio Cliente Ltda',
      giro: 'Servicios contables',
      direccion: 'Av. Siempre Viva 123',
      comuna: 'Providencia',
      emailFacturacion: 'pagos@estudio.cl',
      contactoCobranza: { nombre: 'Ana', email: 'ana@estudio.cl' },
      planId: 'PLAN_STARTER',
      condiciones: { limiteEmpresas: 2, limiteUsuarios: 1 },
      contrato: { fechaInicio: '2026-01-01', diaFacturacion: 1, diasPlazoPago: 10 },
    });
    assert.strictEqual(r.status, 201, JSON.stringify(r.body));
    accId = r.body.cliente.id;
    assert.strictEqual(r.body.cliente.estado, 'ACTIVA');
    assert.strictEqual(r.body.cliente.condiciones.precioMensualNetoClp, 25000);
    assert.deepStrictEqual(r.body.cliente.cobranza, { diasAvisoAtraso: 5, diasUltimoRecordatorio: 10, diasBloqueo: 15 });
    assert.ok(!r.body.cliente.condiciones.modulos.includes('INVENTARIO'));
  });

  await test('S4: el límite de empresas del plan se aplica en el servidor', async () => {
    currentUser = superadmin;
    const c1 = await call('PUT', `/api/clients/${rC1}`, { id: rC1, rut: rC1, razonSocial: 'Cliente Uno SpA', clienteErpId: accId });
    assert.strictEqual(c1.status, 201, JSON.stringify(c1.body));
    const c2 = await call('PUT', `/api/clients/${rC2}`, { id: rC2, rut: rC2, razonSocial: 'Cliente Dos SpA', clienteErpId: accId });
    assert.strictEqual(c2.status, 201);
    const c3 = await call('PUT', `/api/clients/${rC3}`, { id: rC3, rut: rC3, razonSocial: 'Cliente Tres SpA', clienteErpId: accId });
    assert.strictEqual(c3.status, 409);
    assert.strictEqual(c3.body.error, 'LIMITE_EMPRESAS');
  });

  const adminCliente = { userId: 'adm', username: 'adm', isSuperAdmin: false, isAdmin: true, roleCodigo: 'ADMIN', empresaPrincipalId: rC1, empresasPermitidas: [rC1, rC2], modulosPermitidos: [] };

  await test('S2: un administrador no cambia estado, cliente ERP, anclas ni contrato de su empresa', async () => {
    currentUser = adminCliente;
    const actual = (await call('GET', '/api/clients')).body.clientes.find((c: any) => c.id === rC1);
    for (const [campo, valor] of [
      ['estadoCuentaEmpresa', 'ACTIVA'],
      ['clienteErpId', 'otra-cuenta'],
      ['empresasAnclasIds', [rOwner]],
      ['esEmpresaDuenaErp', true],
      ['contrato', { limiteEmpresas: 999 }],
    ] as const) {
      const r = await call('PUT', `/api/clients/${rC1}`, { ...actual, [campo]: valor });
      assert.strictEqual(r.status, 403, `${campo}: ${JSON.stringify(r.body)}`);
      assert.strictEqual(r.body.error, 'CAMPO_PROTEGIDO');
    }
    const ok = await call('PUT', `/api/clients/${rC1}`, { ...actual, giro: 'Comercio' });
    assert.strictEqual(ok.status, 200);
  });

  await test('K3.6: un administrador registra empresas en su cliente ERP solo dentro del límite', async () => {
    currentUser = adminCliente;
    const r = await call('PUT', `/api/clients/${rC3}`, { id: rC3, rut: rC3, razonSocial: 'Cliente Tres SpA' });
    assert.strictEqual(r.status, 409);
    assert.strictEqual(r.body.error, 'LIMITE_EMPRESAS');
    currentUser = superadmin;
    await call('PUT', `/api/saas/accounts/${accId}`, { condiciones: { limiteEmpresas: 3, limiteUsuarios: 1, precioMensualNetoClp: 25000, modulos: ['CONTABILIDAD', 'TRIBUTARIO_SII', 'CONCILIACION'] } });
    currentUser = adminCliente;
    const ok = await call('PUT', `/api/clients/${rC3}`, { id: rC3, rut: rC3, razonSocial: 'Cliente Tres SpA' });
    assert.strictEqual(ok.status, 201, JSON.stringify(ok.body));
    assert.strictEqual(ok.body.cliente.clienteErpId, accId, 'queda en el cliente ERP del administrador');
  });

  await test('S3/K3.5: un usuario sin empresas asignadas no recibe ninguna', () => {
    const ids = resolveAllowedCompanyIdsForUser(
      { id: 'u', rolId: 'role-x', empresaPrincipalId: '', empresasAnclasPermitidas: [] } as any,
      { id: 'role-x', tipoSistema: 'CUSTOM' } as any,
      [{ empresaId: 'A' }, { empresaId: 'B' }] as any
    );
    assert.deepStrictEqual(ids, []);
  });

  await test('S9: un módulo fuera del plan responde MODULO_NO_CONTRATADO', async () => {
    currentUser = { ...adminCliente };
    const ok = await call('GET', `/api/accounting/ping?empresaId=${rC1}`);
    assert.strictEqual(ok.status, 200, JSON.stringify(ok.body));
    const inv = await call('GET', `/api/modules/inventory/ping?empresaId=${rC1}`);
    assert.strictEqual(inv.status, 403);
    assert.strictEqual(inv.body.error, 'MODULO_NO_CONTRATADO');
  });

  await test('S4: límite de usuarios activos al crear el acceso inicial y al guardar seguridad', async () => {
    currentUser = superadmin;
    const a = await call('POST', `/api/clients/${rC1}/initial-admin`, { username: `u1.${Date.now()}`, nombreCompleto: 'Uno', email: 'u1@x.cl' });
    assert.strictEqual(a.status, 201, JSON.stringify(a.body));
    const b = await call('POST', `/api/clients/${rC2}/initial-admin`, { username: `u2.${Date.now()}`, nombreCompleto: 'Dos', email: 'u2@x.cl' });
    assert.strictEqual(b.status, 409);
    assert.strictEqual(b.body.error, 'LIMITE_USUARIOS');
    const users = [...whatsappBridgeService.getRbacState().users, { id: 'x2', estado: 'ACTIVO', empresaPrincipalId: rC2 }];
    assert.throws(() => saas.assertUserLimits(users), (e: any) => e.code === 'LIMITE_USUARIOS');
  });

  await test('S1/S7: suspender bloquea la sesión abierta en la petición siguiente; el estado del navegador no manda', async () => {
    currentUser = adminCliente;
    assert.strictEqual((await call('GET', `/api/accounting/ping?empresaId=${rC1}`)).status, 200);
    currentUser = superadmin;
    const s = await call('POST', `/api/saas/accounts/${accId}/state`, { estado: 'SUSPENDIDA', motivo: 'Prueba de bloqueo' });
    assert.strictEqual(s.status, 200, JSON.stringify(s.body));
    currentUser = adminCliente;
    const bloqueado = await call('GET', `/api/accounting/ping?empresaId=${rC1}`);
    assert.strictEqual(bloqueado.status, 403);
    assert.strictEqual(bloqueado.body.error, 'CLIENTE_SUSPENDIDO');
    // El estado de seguridad enviado por un navegador con 'ACTIVA' se reemplaza por el del servidor
    const cfg = saas.applyCommercialStatus([{ empresaId: rC1, estadoCuenta: 'ACTIVA' }]);
    assert.strictEqual(cfg[0].estadoCuenta, 'SUSPENDIDA_PAGO');
    currentUser = superadmin;
    assert.strictEqual((await call('GET', `/api/accounting/ping?empresaId=${rC1}`)).status, 200, 'el SuperAdmin sigue operando');
    await call('POST', `/api/saas/accounts/${accId}/state`, { estado: 'ACTIVA', motivo: 'Fin de la prueba' });
    currentUser = adminCliente;
    assert.strictEqual((await call('GET', `/api/accounting/ping?empresaId=${rC1}`)).status, 200);
  });

  await test('K4.5: los plazos de cobranza son parametrizables y deben ser coherentes', async () => {
    currentUser = superadmin;
    const malo = await call('PUT', `/api/saas/accounts/${accId}`, { cobranza: { diasAvisoAtraso: 10, diasUltimoRecordatorio: 5, diasBloqueo: 15 } });
    assert.strictEqual(malo.body.code, 'PLAZOS_INVALIDOS');
  });

  let invId = '';
  let vence = '';
  await test('K4.1: el ciclo genera la factura del mes y la envía a aprobación con el DTE de la empresa dueña', async () => {
    const r = await billing.runDailyBillingCycle(at('2026-12-02'), { force: true });
    assert.strictEqual(r.facturasGeneradas, 1, JSON.stringify(r));
    assert.strictEqual(r.emisionesSolicitadas, 1, JSON.stringify(r.errores));
    const inv = billing.listInvoices(accId)[0];
    assert.strictEqual(inv.estado, 'PENDIENTE_APROBACION');
    assert.strictEqual(inv.total, 25000 + Math.round(25000 * 0.19));
    const ap = HrManagementService.getApprovalById(inv.approvalId!)!;
    assert.strictEqual(ap.operacionTipo, 'EMITIR_DTE');
    assert.strictEqual(ap.empresaId, rOwner, 'la emite la empresa dueña');
    assert.strictEqual(ap.datosOperacion.receptorRut, rCliente);
    // Repetir el ciclo el mismo período no duplica
    const r2 = await billing.runDailyBillingCycle(at('2026-12-03'), { force: true });
    assert.strictEqual(r2.facturasGeneradas, 0);
    // Simular la aprobación ejecutada (emisión DTE con folio)
    Object.assign(ap, { estado: 'EJECUTADO', folioEmitido: 1201, trackId: 'TRK-REAL-1', resueltoEn: '2026-12-02T15:00:00.000Z' });
    await billing.syncInvoicesWithApprovals();
    const emitida = billing.listInvoices(accId)[0];
    assert.strictEqual(emitida.estado, 'EMITIDA');
    assert.strictEqual(emitida.folio, 1201);
    assert.strictEqual(emitida.fechaVencimiento, '2026-12-12');
    invId = emitida.id;
    vence = emitida.fechaVencimiento!;
  });

  await test('K4.3/K4.4: mora el día 1, aviso a los 5, último recordatorio a los 10 y bloqueo total a los 15', async () => {
    const enviados: any[] = [];
    notif.setMailTransportForTests({ sendMail: async (m: any) => enviados.push(m) });
    await billing.runDailyBillingCycle(at(addDays(vence, 1)), { force: true });
    assert.strictEqual(saas.getAccount(accId)!.estado, 'EN_MORA');
    assert.strictEqual(enviados.length, 0, 'sin aviso el primer día');
    await billing.runDailyBillingCycle(at(addDays(vence, 5)), { force: true });
    assert.strictEqual(enviados.length, 1);
    assert.match(enviados[0].subject, /5 días de atraso/);
    assert.ok(String(enviados[0].to).includes('ana@estudio.cl'));
    await billing.runDailyBillingCycle(at(addDays(vence, 6)), { force: true });
    assert.strictEqual(enviados.length, 1, 'el aviso no se repite');
    await billing.runDailyBillingCycle(at(addDays(vence, 10)), { force: true });
    assert.strictEqual(enviados.length, 2);
    assert.match(enviados[1].subject, /Último recordatorio/);
    assert.strictEqual(saas.getAccount(accId)!.estado, 'EN_MORA');
    await billing.runDailyBillingCycle(at(addDays(vence, 15)), { force: true });
    assert.strictEqual(saas.getAccount(accId)!.estado, 'SUSPENDIDA');
    assert.strictEqual(enviados.length, 3);
    assert.match(enviados[2].subject, /bloqueado/);
    currentUser = adminCliente;
    const r = await call('GET', `/api/accounting/ping?empresaId=${rC1}`);
    assert.strictEqual(r.body.error, 'CLIENTE_SUSPENDIDO', 'bloqueo total');
    notif.setMailTransportForTests(undefined);
  });

  await test('K4.2: el pago reactiva de inmediato la suspensión por mora', async () => {
    currentUser = superadmin;
    const parcial = await call('POST', '/api/saas/payments', { invoiceId: invId, monto: 10000, fecha: addDays(vence, 16), medio: 'Transferencia' });
    assert.strictEqual(parcial.status, 201, JSON.stringify(parcial.body));
    assert.strictEqual(parcial.body.cliente.estado, 'SUSPENDIDA', 'un pago parcial no reactiva');
    const excede = await call('POST', '/api/saas/payments', { invoiceId: invId, monto: 999999, fecha: addDays(vence, 16), medio: 'Transferencia' });
    assert.strictEqual(excede.body.code, 'MONTO_EXCEDE_SALDO');
    const resto = await call('POST', '/api/saas/payments', { invoiceId: invId, monto: 29750 - 10000, fecha: addDays(vence, 16), medio: 'Transferencia' });
    assert.strictEqual(resto.body.factura.estado, 'PAGADA');
    assert.strictEqual(resto.body.cliente.estado, 'ACTIVA');
    currentUser = adminCliente;
    assert.strictEqual((await call('GET', `/api/accounting/ping?empresaId=${rC1}`)).status, 200);
  });

  await test('K4: una suspensión manual no se levanta sola con el ciclo', async () => {
    currentUser = superadmin;
    await call('POST', `/api/saas/accounts/${accId}/state`, { estado: 'SUSPENDIDA', motivo: 'Uso indebido' });
    await billing.runDailyBillingCycle(at('2026-12-31'), { force: true });
    assert.strictEqual(saas.getAccount(accId)!.estado, 'SUSPENDIDA');
    await call('POST', `/api/saas/accounts/${accId}/state`, { estado: 'ACTIVA', motivo: 'Aclarado' });
  });

  await test('K4.4: sin SMTP el aviso queda registrado como SIN_CANAL, no como enviado', async () => {
    const n = await notif.sendSaasNotification({ clienteErpId: accId, tipo: 'AVISO_ATRASO', para: ['x@y.cl'], asunto: 'a', cuerpo: 'b' });
    assert.strictEqual(n.estado, 'SIN_CANAL');
    assert.ok(n.error);
  });

  await test('K4.1: factura emitida fuera del ERP y reglas de anulación', async () => {
    currentUser = superadmin;
    const inv = billing.createInvoiceDraft(saas.getAccount(accId)!, '2027-01');
    const sinDatos = await call('POST', `/api/saas/invoices/${inv.id}/external`, { folio: '' });
    assert.strictEqual(sinDatos.body.code, 'MISSING_PARAMS');
    const ok = await call('POST', `/api/saas/invoices/${inv.id}/external`, { folio: '1300', fechaEmision: '2027-01-02' });
    assert.strictEqual(ok.body.factura.estado, 'EMITIDA');
    assert.strictEqual(ok.body.factura.fechaVencimiento, '2027-01-12');
    const anular = await call('POST', `/api/saas/invoices/${inv.id}/void`, { motivo: 'error' });
    assert.strictEqual(anular.body.code, 'FACTURA_EMITIDA');
  });

  await test('K4.2: sugiere el calce con el abono de la cartola de la empresa dueña', () => {
    const inv = billing.listInvoices(accId).find((i) => i.periodo === '2027-01')!;
    const snap: any = diskPersistence.getSnapshot();
    diskPersistence.updateCollection('bankMovements', [
      ...(snap.bankMovements || []),
      { id: 'mov-k4', empresaId: rOwner, fecha: '2027-01-05', glosaBancaria: `TRANSF ${rCliente.replace('-', '')} ESTUDIO`, abono: inv.total, cargo: 0 },
    ]);
    const sug = billing.suggestPaymentMatches();
    const s = sug.find((x) => x.invoiceId === inv.id);
    assert.ok(s, 'debe sugerir el calce');
    assert.strictEqual(s!.confianza, 'ALTA');
  });

  await test('K4: baja total con respaldo verificado de 10 años y retiro de la base de trabajo', async () => {
    currentUser = superadmin;
    const snap: any = diskPersistence.getSnapshot();
    diskPersistence.updateCollection('entries', [...(snap.entries || []), { id: 'e-baja', empresaId: rC1, glosa: 'Asiento del cliente' }]);
    const mal = await call('POST', `/api/saas/accounts/${accId}/close`, { motivo: 'Término', confirmacionRut: '1-9' });
    assert.strictEqual(mal.body.code, 'CONFIRMACION_INVALIDA');
    const r = await call('POST', `/api/saas/accounts/${accId}/close`, { motivo: 'Término de contrato', confirmacionRut: rCliente, retirarDeOperacion: true });
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    const acc = saas.getAccount(accId)!;
    assert.strictEqual(acc.estado, 'BAJA');
    const rb = acc.respaldoBaja!;
    assert.ok(fs.existsSync(rb.archivo), 'el respaldo existe');
    const buf = fs.readFileSync(rb.archivo);
    assert.strictEqual(crypto.createHash('sha256').update(buf).digest('hex'), rb.sha256);
    const contenido = JSON.parse(zlib.gunzipSync(buf).toString('utf8'));
    assert.ok(contenido.datos.entries.some((e: any) => e.id === 'e-baja'), 'el respaldo contiene los asientos');
    assert.ok(contenido.usuarios.every((u: any) => !('password' in u)), 'sin claves en el respaldo');
    assert.strictEqual(Number(rb.conservarHasta.slice(0, 4)) - new Date().getFullYear(), 10);
    assert.ok(!(diskPersistence.getSnapshot() as any).entries.some((e: any) => e.id === 'e-baja'), 'retirado de la base de trabajo');
    assert.ok(whatsappBridgeService.getRbacState().users.filter((u: any) => u.empresaPrincipalId === rC1).every((u: any) => u.estado === 'INACTIVO'));
    currentUser = adminCliente;
    const bloqueado = await call('GET', `/api/accounting/ping?empresaId=${rC1}`);
    assert.strictEqual(bloqueado.status, 403);
    currentUser = superadmin;
    const react = await call('POST', `/api/saas/accounts/${accId}/state`, { estado: 'ACTIVA', motivo: 'x' });
    assert.strictEqual(react.body.code, 'CLIENTE_DADO_DE_BAJA');
  });

  await test('La administración comercial es exclusiva del SuperAdmin; el administrador solo ve su consumo', async () => {
    currentUser = { ...adminCliente, empresaPrincipalId: rOwner, empresasPermitidas: [rOwner] };
    const o = await call('GET', '/api/saas/overview');
    assert.strictEqual(o.status, 403);
    const me = await call('GET', '/api/saas/my-account');
    assert.strictEqual(me.status, 200);
  });

  server.close();
  diskPersistence.flushToDiskSync();
  console.log(`\nRESULTADO K3/K4: ${passed} de ${total} pruebas pasaron.`);
  process.exit(passed === total ? 0 : 1);
}

run();
