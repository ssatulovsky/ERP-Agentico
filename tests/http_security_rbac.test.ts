import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import assert from 'node:assert';
import crypto from 'node:crypto';
import { app } from '../server';
import { diskPersistence } from '../src/services/diskPersistenceService';
import { HrManagementService } from '../src/services/hrManagementService';
import { whatsappBridgeService } from '../src/services/whatsappBridgeService';
import { hashPassword } from '../src/utils/passwordCrypto';

process.env.NODE_ENV = 'test';

function makeRequest(
  method: string,
  url: string,
  headers: Record<string, string> = {},
  body?: any
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    try {
      const socket = new Socket();
      const req = new IncomingMessage(socket);
      req.method = method;
      req.url = url;
      const lowerHeaders: Record<string, string> = {};
      for (const [k, v] of Object.entries(headers)) {
        lowerHeaders[k.toLowerCase()] = v;
      }
      const bodyStr = body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : '';
      if (bodyStr) {
        lowerHeaders['content-type'] = lowerHeaders['content-type'] || 'application/json';
        lowerHeaders['content-length'] = String(Buffer.byteLength(bodyStr));
      }
      req.headers = lowerHeaders;

      const res = new ServerResponse(req);
      let buf = '';
      res.write = (c: any) => {
        if (c) buf += c.toString();
        return true;
      };
      res.end = (c?: any) => {
        if (c) buf += c.toString();
        let parsed: any = buf;
        try {
          parsed = JSON.parse(buf);
        } catch {}
        resolve({ status: res.statusCode, body: parsed });
        return res;
      };

      process.nextTick(() => {
        if (bodyStr) req.push(bodyStr);
        req.push(null);
      });

      app(req, res);
    } catch (err) {
      reject(err);
    }
  });
}

// Credenciales efímeras generadas aleatoriamente por ejecución para evitar contraseñas fijas
const ephemeralComprasSecret = crypto.randomBytes(16).toString('base64url');
const ephemeralAdminSecret = crypto.randomBytes(16).toString('base64url');
const ephemeralNewSecret = crypto.randomBytes(16).toString('base64url');

async function runHttpSecurityRbacSuite() {
  console.log('========================================================================');
  console.log('   SUITE FORMAL HTTP & RBAC: SEGURIDAD MULTI-TENANT Y GOBERNANZA REAL   ');
  console.log('========================================================================\n');

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
      throw err;
    }
  }

  // Inicializar almacén físico en disco
  diskPersistence.loadFromDisk();

  // Resetear credenciales con hashes scrypt aleatorios para idempotencia
  const rbacState = whatsappBridgeService.getRbacState();
  const comprasUser = rbacState.users.find(u => u.username === 'compras');
  if (comprasUser) {
    comprasUser.password = hashPassword(ephemeralComprasSecret);
    comprasUser.debeCambiarPassword = true;
  }
  const adminUser = rbacState.users.find(u => u.username === 'admin');
  if (adminUser) {
    adminUser.password = hashPassword(ephemeralAdminSecret);
    adminUser.debeCambiarPassword = false;
  }
  whatsappBridgeService.saveRbacStore(rbacState);

  let tokenCompras = '';
  let tokenAdmin = '';

  // ------------------------------------------------------------------------
  // TEST 1: Login de usuario compras con scrypt y debeCambiarPassword
  // ------------------------------------------------------------------------
  await test('1. Autenticación: Login de usuario compras retorna JWT, empresa asignada y debeCambiarPassword: true', async () => {
    const res = await makeRequest('POST', '/api/auth/login', {}, {
      username: 'compras',
      password: ephemeralComprasSecret,
      empresaId: 'client-retail-logistics',
    });

    assert.strictEqual(res.status, 200, `Login falló con status ${res.status}: ${JSON.stringify(res.body)}`);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.token, 'Debe retornar un token de autenticación');
    assert.strictEqual(res.body.user.empresaPrincipalId, 'client-retail-logistics');
    assert.strictEqual(res.body.user.debeCambiarPassword, true, 'Usuario por defecto debe tener debeCambiarPassword=true');
    tokenCompras = res.body.token;
  });

  // ------------------------------------------------------------------------
  // TEST 2: Login de usuario admin
  // ------------------------------------------------------------------------
  await test('2. Autenticación: Login de administrador retorna privilegios de superadmin', async () => {
    const res = await makeRequest('POST', '/api/auth/login', {}, {
      username: 'admin',
      password: ephemeralAdminSecret,
      empresaId: 'client-retail-logistics',
    });

    assert.strictEqual(res.status, 200, `Login admin falló con status ${res.status}: ${JSON.stringify(res.body)}`);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.token);
    tokenAdmin = res.body.token;
  });

  // ------------------------------------------------------------------------
  // TEST 3: Exigencia de cambio de contraseña antes de operar
  // ------------------------------------------------------------------------
  await test('3. Seguridad de Acceso: Usuario con debeCambiarPassword no puede operar rutas de negocio (403 PASSWORD_CHANGE_REQUIRED)', async () => {
    const res = await makeRequest(
      'GET',
      '/api/commercial-procurement/state',
      { Authorization: `Bearer ${tokenCompras}` }
    );
    assert.strictEqual(res.status, 403, 'Ruta de negocio debe exigir cambio de contraseña previo');
    assert.strictEqual(res.body.error, 'PASSWORD_CHANGE_REQUIRED');
  });

  // ------------------------------------------------------------------------
  // TEST 4: Cambio obligatorio de contraseña con nueva clave aleatoria de 12+ chars
  // ------------------------------------------------------------------------
  await test('4. Credenciales & Scrypt: Cambio obligatorio de contraseña actualiza hash scrypt y apaga debeCambiarPassword', async () => {
    // 1. Cambiar contraseña de compras
    const changeRes = await makeRequest(
      'POST',
      '/api/auth/change-password',
      { Authorization: `Bearer ${tokenCompras}` },
      {
        currentPassword: ephemeralComprasSecret,
        newPassword: ephemeralNewSecret,
      }
    );

    assert.strictEqual(changeRes.status, 200, `Cambio de contraseña falló: ${changeRes.status}`);
    assert.strictEqual(changeRes.body.success, true);
    assert.strictEqual(changeRes.body.debeCambiarPassword, false);

    // 2. Intentar login con la clave antigua -> 401
    const oldLoginRes = await makeRequest('POST', '/api/auth/login', {}, {
      username: 'compras',
      password: ephemeralComprasSecret,
      empresaId: 'client-retail-logistics',
    });
    assert.strictEqual(oldLoginRes.status, 401, 'Clave antigua debe ser rechazada');

    // 3. Login con la nueva clave -> 200 y debeCambiarPassword: false
    const newLoginRes = await makeRequest('POST', '/api/auth/login', {}, {
      username: 'compras',
      password: ephemeralNewSecret,
      empresaId: 'client-retail-logistics',
    });
    assert.strictEqual(newLoginRes.status, 200, 'Nueva clave debe permitir acceso');
    assert.strictEqual(newLoginRes.body.user.debeCambiarPassword, false);
    // Actualizar token para siguientes peticiones operativas
    tokenCompras = newLoginRes.body.token;
  });

  // ------------------------------------------------------------------------
  // TEST 5: Bloqueo de creación cross-company por usuario compras
  // ------------------------------------------------------------------------
  await test('5. Seguridad Multi-Tenant: Usuario compras no puede crear aprobaciones para empresa ajena (client-innovagile)', async () => {
    const res = await makeRequest(
      'POST',
      '/api/governance/request-approval',
      { Authorization: `Bearer ${tokenCompras}` },
      {
        empresaId: 'client-innovagile',
        modulo: 'CONTABILIDAD',
        agenteNombre: 'Agente Contable Infiltrado',
        operacionTipo: 'ASIENTO_MANUAL',
        titulo: 'Intento de Inyección Contable en Empresa Ajena',
        descripcion: 'Asiento de prueba para verificar aislamiento de tenant',
        datosOperacion: {
          asientoContable: {
            concepto: 'Asiento Ficticio Vulnerabilidad',
            totalDebe: 5000000,
            totalHaber: 5000000,
            lineas: [
              { cuentaCodigo: '1.1.1.01', cuentaNombre: 'Caja', debe: 5000000, haber: 0 },
              { cuentaCodigo: '4.1.1.01', cuentaNombre: 'Ingresos', debe: 0, haber: 5000000 },
            ],
          },
        },
        impactoFinanciero: 5000000,
        riesgoNivel: 'ALTO',
      }
    );

    assert.strictEqual(res.status, 403, `Esperaba 403 Forbidden pero recibió ${res.status}`);
    assert.strictEqual(res.body.success, false);
    assert.ok(res.body.error === 'ACCESO_EMPRESA_DENEGADO' || res.body.error === 'ACCESO_DENEGADO');
  });

  // ------------------------------------------------------------------------
  // TEST 6: Bloqueo de listado cross-company por usuario compras
  // ------------------------------------------------------------------------
  await test('6. Seguridad Multi-Tenant: Usuario compras no puede listar solicitudes de empresa ajena', async () => {
    const res = await makeRequest(
      'GET',
      '/api/governance/approvals?empresaId=client-innovagile',
      { Authorization: `Bearer ${tokenCompras}` }
    );

    assert.strictEqual(res.status, 403, `Esperaba 403 al listar solicitudes de empresa ajena, obtuvo ${res.status}`);
    assert.strictEqual(res.body.success, false);
  });

  // ------------------------------------------------------------------------
  // TEST 7: Anti-Spoofing en resolución de aprobaciones
  // ------------------------------------------------------------------------
  await test('7. Seguridad Multi-Tenant & Anti-Spoofing: Usuario compras no puede resolver solicitud de empresa ajena fingiendo ser Gerente General', async () => {
    // 1. Crear solicitud legítima en client-innovagile
    const legitApproval = HrManagementService.requestModuleApproval({
      empresaId: 'client-innovagile',
      modulo: 'CONTABILIDAD',
      agenteNombre: 'Camila Valenzuela',
      operacionTipo: 'CENTRALIZACION_HONORARIOS',
      titulo: 'Centralización de Boletas de Honorarios',
      descripcion: 'Pago a consultores externos de desarrollo',
      datosOperacion: {
        asientoContable: {
          concepto: 'Honorarios InnovAgile',
          totalDebe: 2500000,
          totalHaber: 2500000,
          lineas: [
            { cuentaCodigo: '5.1.2.01', cuentaNombre: 'Honorarios', debe: 2500000, haber: 0 },
            { cuentaCodigo: '1.1.1.02', cuentaNombre: 'Banco Santander', debe: 0, haber: 2500000 },
          ],
        },
      },
      impactoFinanciero: 2500000,
      riesgoNivel: 'MEDIO',
    });

    // 2. Usuario compras intenta resolverla fingiendo ser 'Gerente General'
    const spoofRes = await makeRequest(
      'POST',
      `/api/governance/approvals/${legitApproval.id}/resolve`,
      { Authorization: `Bearer ${tokenCompras}` },
      {
        action: 'APROBAR',
        userId: 'Gerente General',
        nombreAprobador: 'Gerente General Ficticio',
        comentario: 'Aprobación suplantada',
      }
    );

    assert.strictEqual(spoofRes.status, 403, `Esperaba 403 pero recibió ${spoofRes.status}`);
    assert.strictEqual(spoofRes.body.success, false);
  });

  // ------------------------------------------------------------------------
  // TEST 8: Control RBAC de aprobación en la propia empresa
  // ------------------------------------------------------------------------
  await test('8. Control RBAC: Usuario compras no puede aprobar solicitudes en su propia empresa (rol no facultado)', async () => {
    // Crear solicitud en su propia empresa client-retail-logistics
    const ownApproval = HrManagementService.requestModuleApproval({
      empresaId: 'client-retail-logistics',
      modulo: 'COMERCIAL',
      agenteNombre: 'Esteban Morales',
      operacionTipo: 'ORDEN_COMPRA_MAYOR',
      titulo: 'Aprobación de Compra Mayor de Insumos',
      descripcion: 'Adquisición de insumos de empaque por \$8.000.000',
      datosOperacion: {},
      impactoFinanciero: 8000000,
      riesgoNivel: 'ALTO',
    });

    // Usuario compras intenta aprobarla
    const res = await makeRequest(
      'POST',
      `/api/governance/approvals/${ownApproval.id}/resolve`,
      { Authorization: `Bearer ${tokenCompras}` },
      {
        action: 'APROBAR',
        comentario: 'Auto-aprobación indebida',
      }
    );

    assert.strictEqual(res.status, 403, `Esperaba 403 ROL_NO_AUTORIZADO pero recibió ${res.status}`);
    assert.strictEqual(res.body.success, false);
  });

  // ------------------------------------------------------------------------
  // TEST 9: Trazabilidad Pericial con Identidad del Administrador
  // ------------------------------------------------------------------------
  await test('9. Trazabilidad Real: Administrador aprueba legítimamente y el sistema toma su identidad de la sesión JWT', async () => {
    // 1. Crear solicitud válida en client-retail-logistics
    const validApproval = HrManagementService.requestModuleApproval({
      empresaId: 'client-retail-logistics',
      modulo: 'CONTABILIDAD',
      agenteNombre: 'Camila Valenzuela',
      operacionTipo: 'CENTRALIZACION_MENSUAL',
      titulo: 'Asiento de Ajuste Mensual Auditado',
      descripcion: 'Ajuste de amortización de seguros devengados',
      datosOperacion: {
        asientoContable: {
          concepto: 'Ajuste Seguros Devengados Retail Logistics',
          totalDebe: 1200000,
          totalHaber: 1200000,
          lineas: [
            { cuentaCodigo: '5.1.3.01', cuentaNombre: 'Gasto Seguros', debe: 1200000, haber: 0 },
            { cuentaCodigo: '1.1.3.05', cuentaNombre: 'Seguros Anticipados', debe: 0, haber: 1200000 },
          ],
        },
      },
      impactoFinanciero: 1200000,
      riesgoNivel: 'MEDIO',
    });

    // 2. Administrador resuelve con tokenAdmin intentando enviar nombre ficticio
    const res = await makeRequest(
      'POST',
      `/api/governance/approvals/${validApproval.id}/resolve`,
      { Authorization: `Bearer ${tokenAdmin}` },
      {
        action: 'APROBAR',
        userId: 'Nombre Falso Inyectado',
        nombreAprobador: 'Persona Inexistente',
        comentario: 'Aprobado conforme a auditoría',
      }
    );

    assert.strictEqual(res.status, 200, `Resolución legítima falló con status ${res.status}: ${JSON.stringify(res.body)}`);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.estado, 'EJECUTADO');
    assert.ok(
      res.body.data.resueltoPor.includes('admin') || res.body.data.resueltoPor.includes('Administrador'),
      `El resolutor debe reflejar la identidad de la sesión JWT y no la inyectada: ${res.body.data.resueltoPor}`
    );

    // Verificar asiento en el libro diario de la empresa correcta
    assert.ok(res.body.data.asientoContableId, 'Debe haber generado asiento contable');
    const entries = diskPersistence.getJournalEntries('client-retail-logistics');
    const entryFound = entries.find((e: any) => e.id === res.body.data.asientoContableId);
    assert.ok(entryFound, 'El asiento debe estar registrado en el libro diario de client-retail-logistics');
  });

  // ------------------------------------------------------------------------
  // TEST 10: Aislamiento Perimetral en Rutas de Módulos ERP
  // ------------------------------------------------------------------------
  await test('10. Perímetro Multi-Tenant: Rutas bloquean acceso a empresas ajenas y módulos no autorizados', async () => {
    // 1. Acceso de compras a empresa ajena client-innovagile -> 403
    const bankForeignRes = await makeRequest(
      'GET',
      '/api/modules/banking/accounts?empresaId=client-innovagile',
      { Authorization: `Bearer ${tokenCompras}` }
    );
    assert.strictEqual(bankForeignRes.status, 403, 'Cuentas bancarias de empresa ajena deben retornar 403');

    // 2. Acceso de compras a nómina de su propia empresa (no tiene módulo RRHH) -> 403
    const payrollOwnRes = await makeRequest(
      'GET',
      '/api/payroll/settlements?empresaId=client-retail-logistics&periodo=2026-03',
      { Authorization: `Bearer ${tokenCompras}` }
    );
    assert.strictEqual(payrollOwnRes.status, 403, 'Liquidaciones sin tener módulo RRHH deben retornar 403');

    // 3. Acceso de compras a su propio módulo COMERCIAL_COMPRAS -> Permitido 200
    const ownCommRes = await makeRequest(
      'GET',
      '/api/commercial-procurement/state?empresaId=client-retail-logistics',
      { Authorization: `Bearer ${tokenCompras}` }
    );
    assert.strictEqual(ownCommRes.status, 200, 'Módulo comercial de la propia empresa debe retornar 200');
  });

  console.log('\n========================================================================');
  console.log(`🎉 RESULTADO: ${passed} de ${total} pruebas HTTP pasaron exitosamente (100%).`);
  console.log('========================================================================\n');
  process.exit(0);
}

runHttpSecurityRbacSuite().catch((err) => {
  console.error('Fallo en la suite de pruebas HTTP de seguridad:', err);
  process.exit(1);
});
