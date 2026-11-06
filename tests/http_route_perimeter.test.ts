import './setup/enableDemoMode';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import assert from 'node:assert';
import crypto from 'node:crypto';
import { app } from '../server';
import { diskPersistence } from '../src/services/diskPersistenceService';
import { whatsappBridgeService } from '../src/services/whatsappBridgeService';
import { hashPassword } from '../src/utils/passwordCrypto';
import {
  ROUTE_MODULE_MAP,
  AUTH_SESSION_EXEMPT_PATHS,
  resolveCanonicalModuleForPath,
  userHasModuleAccess,
} from '../src/middlewares/centralizedAuthorizationMiddleware';

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

/**
 * Extrae dinámicamente todas las rutas registradas en el router de Express
 */
interface DiscoveredRoute {
  method: string;
  path: string;
}

function extractAllRegisteredRoutes(expressApp: any): DiscoveredRoute[] {
  const routes: DiscoveredRoute[] = [];

  function walkStack(stack: any[], prefix = '') {
    for (const layer of stack || []) {
      if (layer.route) {
        const fullPath = prefix + (layer.route.path === '/' ? '' : layer.route.path);
        for (const method of Object.keys(layer.route.methods)) {
          routes.push({ method: method.toUpperCase(), path: fullPath });
        }
      } else if (layer.name === 'router' && layer.handle?.stack) {
        let subPrefix = prefix;
        if (layer.regexp && !layer.regexp.fast_slash) {
          const s = layer.regexp.source
            .replace('^\\/', '/')
            .replace('\\/?(?=\\/|$)', '')
            .replace(/\\\//g, '/')
            .replace('(?=\\/|$)', '')
            .replace('^', '')
            .replace('\\/?$', '');
          subPrefix = prefix + s.split('?')[0].replace(/\/+$/, '');
        }
        walkStack(layer.handle.stack, subPrefix);
      }
    }
  }

  walkStack(expressApp._router?.stack);
  return routes;
}

// Generación de credenciales efímeras seguras para la prueba
const ephemeralComprasInitialSecret = crypto.randomBytes(16).toString('base64url');
const ephemeralComprasActiveSecret = crypto.randomBytes(16).toString('base64url');
const ephemeralAdminSecret = crypto.randomBytes(16).toString('base64url');

async function runPerimeterTestSuite() {
  console.log('========================================================================');
  console.log('   SUITE FORMAL A6: VERIFICACIÓN AUTOMÁTICA DE PERÍMETRO Y SEGURIDAD    ');
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

  diskPersistence.loadFromDisk();

  // Configurar credenciales aleatorias en el almacén físico
  const state = whatsappBridgeService.getRbacState();
  const comprasUser = state.users.find((u) => u.username === 'compras');
  if (comprasUser) {
    comprasUser.password = hashPassword(ephemeralComprasActiveSecret);
    comprasUser.debeCambiarPassword = false;
  }
  const adminUser = state.users.find((u) => u.username === 'admin');
  if (adminUser) {
    adminUser.password = hashPassword(ephemeralAdminSecret);
    adminUser.debeCambiarPassword = false;
  }
  const ephemeralTenantAdminSecret = 'TenantAdmin!' + crypto.randomBytes(8).toString('hex');
  const existingTenantAdmin = state.users.find((u) => u.username === 'tenant_admin');
  if (existingTenantAdmin) {
    existingTenantAdmin.password = hashPassword(ephemeralTenantAdminSecret);
    existingTenantAdmin.debeCambiarPassword = false;
  } else {
    state.users.push({
      id: 'usr-tenant-admin-test',
      username: 'tenant_admin',
      password: hashPassword(ephemeralTenantAdminSecret),
      nombreCompleto: 'Admin Tenant A',
      cargo: 'Administrador Local',
      email: 'admin_local@retail.cl',
      telefonoWhatsapp: '56999887766',
      estado: 'ACTIVO',
      rolId: 'role-admin',
      empresaPrincipalId: 'client-retail-logistics',
      empresasAnclasPermitidas: ['client-retail-logistics'],
      recibirAudioWhatsapp: false,
      debeCambiarPassword: false,
    });
  }
  whatsappBridgeService.saveRbacStore(state);

  // Obtener tokens de prueba
  const loginCompras = await makeRequest('POST', '/api/auth/login', {}, {
    username: 'compras',
    password: ephemeralComprasActiveSecret,
    empresaId: 'client-retail-logistics',
  });
  assert.strictEqual(loginCompras.status, 200, 'Login de compras debe ser 200');
  const tokenCompras = loginCompras.body.token;

  const loginTenantAdmin = await makeRequest('POST', '/api/auth/login', {}, {
    username: 'tenant_admin',
    password: ephemeralTenantAdminSecret,
    empresaId: 'client-retail-logistics',
  });
  assert.strictEqual(loginTenantAdmin.status, 200, 'Login de tenant_admin debe ser 200');
  const tokenTenantAdmin = loginTenantAdmin.body.token;

  const loginAdmin = await makeRequest('POST', '/api/auth/login', {}, {
    username: 'admin',
    password: ephemeralAdminSecret,
    empresaId: 'client-retail-logistics',
  });
  assert.strictEqual(loginAdmin.status, 200, 'Login de admin debe ser 200');
  const tokenAdmin = loginAdmin.body.token;

  // ------------------------------------------------------------------------
  // A6.1: Enumeración dinámica y exhaustiva de rutas registradas en Express
  // ------------------------------------------------------------------------
  const allRoutes = extractAllRegisteredRoutes(app);
  const apiRoutes = allRoutes.filter((r) => r.path.startsWith('/api'));

  await test(`A6.1 Enumeración dinámica: Se descubrieron ${apiRoutes.length} rutas en el stack de Express`, async () => {
    assert.ok(apiRoutes.length >= 40, `Se esperaba al menos 40 rutas API en Express, se encontraron ${apiRoutes.length}`);
  });

  // ------------------------------------------------------------------------
  // A6.2: Clasificación estricta de rutas (Falla si hay ruta nueva sin clasificar)
  // ------------------------------------------------------------------------
  await test('A6.2 Clasificación estricta: Toda ruta /api debe estar registrada en el mapa canónico o exenciones de sesión', async () => {
    const unclassified: string[] = [];

    for (const r of apiRoutes) {
      const isExempt =
        AUTH_SESSION_EXEMPT_PATHS.some((p) => r.path === p || r.path.startsWith(p + '/')) ||
        r.path.startsWith('/api/jobs') ||
        r.path.startsWith('/api/governance') ||
        r.path.startsWith('/api/agents/governance') ||
        r.path.startsWith('/api/agents/autonomous') ||
        r.path === '/api/voice/status' ||
        r.path === '/api/voice/tts' ||
        r.path === '/api/voice/piper-voices' ||
        r.path === '/api/gemini/chat';

      if (!isExempt) {
        const rule = resolveCanonicalModuleForPath(r.path);
        if (!rule) {
          unclassified.push(`${r.method} ${r.path}`);
        }
      }
    }

    assert.strictEqual(
      unclassified.length,
      0,
      `Se detectaron ${unclassified.length} rutas en Express NO clasificadas en el mapa canónico: \n${unclassified.join('\n')}`
    );
  });

  // ------------------------------------------------------------------------
  // A6.3: Prueba de perímetro cross-tenant sobre todas las rutas descubiertas
  // ------------------------------------------------------------------------
  await test('A6.3 Perímetro Cross-Tenant: Ninguna ruta permite a compras acceder a empresa ajena (client-innovagile)', async () => {
    let violations = 0;
    const violationPaths: string[] = [];

    // Muestra de rutas API para verificación exhaustiva
    for (const route of apiRoutes) {
      if (AUTH_SESSION_EXEMPT_PATHS.includes(route.path) || route.path.startsWith('/api/auth/')) {
        continue;
      }

      // Reemplazar parámetros de ruta tipo :id o :empresaId con valor ajeno
      const targetUrl = route.path
        .replace(':empresaId', 'client-innovagile')
        .replace(':idOrRut', 'client-innovagile')
        .replace(':id', 'client-innovagile')
        .replace(':periodo', '2026-03');

      const urlWithQuery = targetUrl.includes('?')
        ? `${targetUrl}&empresaId=client-innovagile`
        : `${targetUrl}?empresaId=client-innovagile`;

      const res = await makeRequest(
        route.method,
        urlWithQuery,
        {
          Authorization: `Bearer ${tokenCompras}`,
          'x-empresa-id': 'client-innovagile',
        },
        route.method === 'POST' || route.method === 'PUT' ? { empresaId: 'client-innovagile' } : undefined
      );

      // Toda ruta API llamada por compras hacia empresa ajena DEBE responder 401 o 403
      if (res.status !== 401 && res.status !== 403) {
        violations++;
        violationPaths.push(`${route.method} ${urlWithQuery} -> HTTP ${res.status}`);
      }
    }

    assert.strictEqual(
      violations,
      0,
      `Violación de perímetro multi-tenant en ${violations} rutas: \n${violationPaths.join('\n')}`
    );
  });

  // ------------------------------------------------------------------------
  // A6.4: ATAQUE 1 DE AUDITORÍA — Autoasignarse SuperAdmin vía POST /api/security/state
  // ------------------------------------------------------------------------
  await test('A6.4 Auditoría Ataque 1: Usuario compras no puede autoasignarse SuperAdmin (POST /api/security/state)', async () => {
    const maliciousPayload = {
      users: [
        {
          id: 'user-compras',
          username: 'compras',
          nombreCompleto: 'Usuario Compras Hacker',
          cargo: 'SuperAdmin Hacker',
          estado: 'ACTIVO',
          rolId: 'role-superadmin',
          empresaPrincipalId: 'client-innovagile',
        },
      ],
      roles: [],
      companiesConfig: [],
    };

    const res = await makeRequest(
      'POST',
      '/api/security/state',
      { Authorization: `Bearer ${tokenCompras}` },
      maliciousPayload
    );

    assert.strictEqual(res.status, 403, `Esperaba 403 al intentar autoasignarse SuperAdmin, obtuvo ${res.status}`);
    assert.strictEqual(res.body.success, false);
  });

  // ------------------------------------------------------------------------
  // A6.5: ATAQUE 2 DE AUDITORÍA — Leer claveSii de otra empresa en texto plano
  // ------------------------------------------------------------------------
  await test('A6.5 Auditoría Ataque 2: No se puede leer claveSii ajena y nunca se entrega en texto plano', async () => {
    // Intento 1: Usuario compras consulta empresa ajena -> 403
    const foreignRes = await makeRequest(
      'GET',
      '/api/companies/client-innovagile/sii-config',
      { Authorization: `Bearer ${tokenCompras}` }
    );
    assert.strictEqual(foreignRes.status, 403, 'Acceso a sii-config de empresa ajena debe retornar 403');

    // Intento 2: Usuario admin consulta su propia empresa -> retorna 200 pero claveSii está oculta
    const ownRes = await makeRequest(
      'GET',
      '/api/companies/client-retail-logistics/sii-config',
      { Authorization: `Bearer ${tokenAdmin}` }
    );
    assert.strictEqual(ownRes.status, 200, 'Admin debe poder consultar sii-config de su empresa');
    assert.strictEqual(ownRes.body.empresa.claveSii, undefined, 'claveSii NUNCA debe entregarse en texto plano');
    assert.strictEqual(ownRes.body.empresa.hasClaveSii, true, 'Debe retornar bandera hasClaveSii: true');
  });

  // ------------------------------------------------------------------------
  // A6.6: ATAQUE 3 DE AUDITORÍA — Agregar teléfonos a WhatsApp
  // ------------------------------------------------------------------------
  await test('A6.6 Auditoría Ataque 3: Usuario compras no puede agregar teléfonos a WhatsApp (POST /api/whatsapp/whitelist)', async () => {
    const res = await makeRequest(
      'POST',
      '/api/whatsapp/whitelist',
      { Authorization: `Bearer ${tokenCompras}` },
      {
        telefono: '56911223344',
        nombreContacto: 'Infiltrado',
        cargo: 'Tester',
        empresaRut: 'client-retail-logistics',
        rolId: 'role-compras-comercial',
      }
    );

    assert.strictEqual(res.status, 403, `Esperaba 403 SuperAdmin requerido, obtuvo ${res.status}`);
    assert.strictEqual(res.body.success, false);
  });

  // ------------------------------------------------------------------------
  // A6.7: ATAQUE 4 DE AUDITORÍA — Cambiar la configuración de IA
  // ------------------------------------------------------------------------
  await test('A6.7 Auditoría Ataque 4: Usuario compras no puede modificar configuración de IA (POST /api/admin/ai-config)', async () => {
    const res = await makeRequest(
      'POST',
      '/api/admin/ai-config',
      { Authorization: `Bearer ${tokenCompras}` },
      {
        provider: 'LOCAL',
        localBaseUrl: 'http://malicious-server:8000',
      }
    );

    assert.strictEqual(res.status, 403, `Esperaba 403 SuperAdmin requerido, obtuvo ${res.status}`);
    assert.strictEqual(res.body.success, false);
  });

  // ------------------------------------------------------------------------
  // A6.8: ATAQUE 5 DE AUDITORÍA — Ver sueldos de su empresa sin tener módulo RRHH
  // ------------------------------------------------------------------------
  await test('A6.8 Auditoría Ataque 5: Usuario compras no puede consultar nómina de su propia empresa (sin módulo RRHH)', async () => {
    const res = await makeRequest(
      'GET',
      '/api/payroll/settlements?empresaId=client-retail-logistics&periodo=2026-03',
      { Authorization: `Bearer ${tokenCompras}` }
    );

    assert.strictEqual(res.status, 403, `Esperaba 403 MODULO_NO_PERMITIDO, obtuvo ${res.status}`);
    assert.strictEqual(res.body.error, 'MODULO_NO_PERMITIDO');
  });

  // ------------------------------------------------------------------------
  // A6.9: ATAQUE 6 DE AUDITORÍA — Operar en el ERP con la contraseña inicial
  // ------------------------------------------------------------------------
  await test('A6.9 Auditoría Ataque 6: Usuario no puede operar rutas de negocio si debeCambiarPassword es true', async () => {
    // Configurar usuario temporal con contraseña inicial sin cambiar
    const localState = whatsappBridgeService.getRbacState();
    const targetUser = localState.users.find((u) => u.username === 'compras');
    if (targetUser) {
      targetUser.password = hashPassword(ephemeralComprasInitialSecret);
      targetUser.debeCambiarPassword = true;
      whatsappBridgeService.saveRbacStore(localState);
    }

    const loginRes = await makeRequest('POST', '/api/auth/login', {}, {
      username: 'compras',
      password: ephemeralComprasInitialSecret,
      empresaId: 'client-retail-logistics',
    });

    assert.strictEqual(loginRes.status, 200);
    assert.strictEqual(loginRes.body.debeCambiarPassword, true);
    const initialToken = loginRes.body.token;

    // Intento de operación de negocio
    const opRes = await makeRequest(
      'GET',
      '/api/commercial-procurement/state',
      { Authorization: `Bearer ${initialToken}` }
    );

    assert.strictEqual(opRes.status, 403, 'Debe rechazar operación de negocio con contraseña inicial');
    assert.strictEqual(opRes.body.error, 'PASSWORD_CHANGE_REQUIRED');

    // Restaurar usuario a contraseña activa
    if (targetUser) {
      targetUser.password = hashPassword(ephemeralComprasActiveSecret);
      targetUser.debeCambiarPassword = false;
      whatsappBridgeService.saveRbacStore(localState);
    }
  });

  // ------------------------------------------------------------------------
  // A6.10: PERÍMETRO DE IDENTIFICADORES — Rechazo con 400 de listas (arrays) en todos los parámetros
  // ------------------------------------------------------------------------
  await test('A6.10 Perímetro de Identificadores: Rechazar con 400 cualquier lista (array) en empresaId, rut, companyId, firmId, idOrRut', async () => {
    const identifierKeys = ['empresaId', 'rut', 'companyId', 'firmId', 'idOrRut'];
    
    for (const key of identifierKeys) {
      // 1. Probar en query como array (?key[]=val1&key[]=val2)
      const resQueryArray = await makeRequest(
        'GET',
        `/api/accounting/entries?${key}[]=client-innovagile&${key}[]=client-retail-logistics`,
        { Authorization: `Bearer ${tokenAdmin}` }
      );
      assert.strictEqual(
        resQueryArray.status,
        400,
        `Esperaba 400 para array en query '${key}', obtuvo ${resQueryArray.status}`
      );
      assert.strictEqual(resQueryArray.body.error, 'IDENTIFICADOR_EMPRESA_INVALIDO');

      // 2. Probar en body como array ({ [key]: ['val1', 'val2'] })
      const resBodyArray = await makeRequest(
        'POST',
        '/api/agents/autonomous/execute',
        { Authorization: `Bearer ${tokenAdmin}` },
        {
          [key]: ['client-innovagile', 'client-retail-logistics'],
          module: 'CONTABILIDAD',
          action: 'AUDITAR',
        }
      );
      assert.strictEqual(
        resBodyArray.status,
        400,
        `Esperaba 400 para array en body '${key}', obtuvo ${resBodyArray.status}`
      );
      assert.strictEqual(resBodyArray.body.error, 'IDENTIFICADOR_EMPRESA_INVALIDO');
    }
  });

  // ------------------------------------------------------------------------
  // A6.11: PERÍMETRO DE IDENTIFICADORES — Rechazo con 400 de valores repetidos en query string
  // ------------------------------------------------------------------------
  await test('A6.11 Perímetro de Identificadores: Rechazar con 400 valores repetidos en query string para todos los parámetros', async () => {
    const identifierKeys = ['empresaId', 'rut', 'companyId', 'firmId', 'idOrRut'];

    for (const key of identifierKeys) {
      // Valores distintos repetidos: ?key=a&key=b
      const resDistinct = await makeRequest(
        'GET',
        `/api/accounting/entries?${key}=client-innovagile&${key}=client-retail-logistics`,
        { Authorization: `Bearer ${tokenAdmin}` }
      );
      assert.strictEqual(
        resDistinct.status,
        400,
        `Esperaba 400 para repetición distinta en query '${key}', obtuvo ${resDistinct.status}`
      );
      assert.strictEqual(resDistinct.body.error, 'IDENTIFICADOR_EMPRESA_INVALIDO');

      // Valores idénticos repetidos: ?key=a&key=a
      const resIdentical = await makeRequest(
        'GET',
        `/api/accounting/entries?${key}=client-innovagile&${key}=client-innovagile`,
        { Authorization: `Bearer ${tokenAdmin}` }
      );
      assert.strictEqual(
        resIdentical.status,
        400,
        `Esperaba 400 para repetición idéntica en query '${key}', obtuvo ${resIdentical.status}`
      );
      assert.strictEqual(resIdentical.body.error, 'IDENTIFICADOR_EMPRESA_INVALIDO');
    }
  });

  // ------------------------------------------------------------------------
  // A6.12: PERÍMETRO DE IDENTIFICADORES — Rechazo con 400 de tipos inválidos, delimitados y conflictivos
  // ------------------------------------------------------------------------
  await test('A6.12 Perímetro de Identificadores: Rechazar con 400 objetos, números, delimitados y valores conflictivos', async () => {
    // 1. Objeto en body (NoSQL injection pattern)
    const resObject = await makeRequest(
      'POST',
      '/api/agents/autonomous/execute',
      { Authorization: `Bearer ${tokenAdmin}` },
      { empresaId: { $ne: null }, module: 'CONTABILIDAD' }
    );
    assert.strictEqual(resObject.status, 400, 'Debe rechazar empresaId como objeto con 400');
    assert.strictEqual(resObject.body.error, 'IDENTIFICADOR_EMPRESA_INVALIDO');

    // 2. Número en body
    const resNumber = await makeRequest(
      'POST',
      '/api/agents/autonomous/execute',
      { Authorization: `Bearer ${tokenAdmin}` },
      { empresaId: 76104550, module: 'CONTABILIDAD' }
    );
    assert.strictEqual(resNumber.status, 400, 'Debe rechazar empresaId numérico con 400');
    assert.strictEqual(resNumber.body.error, 'IDENTIFICADOR_EMPRESA_INVALIDO');

    // 3. Cadena vacía o whitespace
    const resEmpty = await makeRequest(
      'GET',
      '/api/accounting/entries?empresaId=%20%20%20',
      { Authorization: `Bearer ${tokenAdmin}` }
    );
    assert.strictEqual(resEmpty.status, 400, 'Debe rechazar empresaId vacío con 400');
    assert.strictEqual(resEmpty.body.error, 'IDENTIFICADOR_EMPRESA_INVALIDO');

    // 4. Delimitadores en query (coma, punto y coma, tubería)
    const resComma = await makeRequest(
      'GET',
      '/api/accounting/entries?empresaId=client-innovagile,client-retail-logistics',
      { Authorization: `Bearer ${tokenAdmin}` }
    );
    assert.strictEqual(resComma.status, 400, 'Debe rechazar valores delimitados por coma con 400');
    assert.strictEqual(resComma.body.error, 'IDENTIFICADOR_EMPRESA_INVALIDO');

    // 5. Parámetros conflictivos entre query y body
    const resConflictQueryBody = await makeRequest(
      'POST',
      '/api/agents/autonomous/execute?empresaId=client-innovagile',
      { Authorization: `Bearer ${tokenAdmin}` },
      { empresaId: 'client-retail-logistics', module: 'CONTABILIDAD' }
    );
    assert.strictEqual(resConflictQueryBody.status, 400, 'Debe rechazar valores conflictivos query vs body con 400');
    assert.strictEqual(resConflictQueryBody.body.error, 'IDENTIFICADOR_EMPRESA_INVALIDO');

    // 6. Parámetros conflictivos entre identificadores diferentes (empresaId vs rut)
    const resConflictIdentifiers = await makeRequest(
      'GET',
      '/api/accounting/entries?empresaId=client-innovagile&rut=76543210-9',
      { Authorization: `Bearer ${tokenAdmin}` }
    );
    assert.strictEqual(resConflictIdentifiers.status, 400, 'Debe rechazar empresaId vs rut con valores distintos con 400');
    assert.strictEqual(resConflictIdentifiers.body.error, 'IDENTIFICADOR_EMPRESA_INVALIDO');

    // 7. Parámetros conflictivos entre query y headers
    const resConflictHeader = await makeRequest(
      'GET',
      '/api/accounting/entries?empresaId=client-innovagile',
      {
        Authorization: `Bearer ${tokenAdmin}`,
        'x-empresa-id': 'client-retail-logistics',
      }
    );
    assert.strictEqual(resConflictHeader.status, 400, 'Debe rechazar query vs x-empresa-id conflictivos con 400');
    assert.strictEqual(resConflictHeader.body.error, 'IDENTIFICADOR_EMPRESA_INVALIDO');
  });

  // ------------------------------------------------------------------------
  // A6.13: PERÍMETRO EXHAUSTIVO SOBRE TODAS LAS RUTAS DE LA API
  // ------------------------------------------------------------------------
  await test('A6.13 Perímetro Exhaustivo: Toda ruta API rechaza con 400 listas y valores repetidos en identificadores', async () => {
    let checked = 0;
    for (const route of apiRoutes) {
      if (AUTH_SESSION_EXEMPT_PATHS.includes(route.path) || route.path.startsWith('/api/auth/')) {
        continue;
      }

      // Probar envío de query repetido en cada ruta
      const targetUrl = route.path
        .replace(':empresaId', 'client-retail-logistics')
        .replace(':idOrRut', 'client-retail-logistics')
        .replace(':id', 'item-001')
        .replace(':periodo', '2026-03');

      const repeatedQueryUrl = `${targetUrl}?empresaId=client-innovagile&empresaId=client-retail-logistics`;

      const res = await makeRequest(
        route.method,
        repeatedQueryUrl,
        { Authorization: `Bearer ${tokenAdmin}` },
        route.method === 'POST' || route.method === 'PUT'
          ? { empresaId: ['client-innovagile', 'client-retail-logistics'] }
          : undefined
      );

      assert.strictEqual(
        res.status,
        400,
        `Ruta ${route.method} ${targetUrl} DEBE retornar 400 ante identificadores repetidos/listas, obtuvo ${res.status}`
      );
      assert.strictEqual(res.body.error, 'IDENTIFICADOR_EMPRESA_INVALIDO');
      checked++;
    }

    assert(checked > 0, 'Debe haberse verificado el perímetro en al menos una ruta');
  });

  // ------------------------------------------------------------------------
  // A6.14: AUDITORÍA ESPECÍFICA — Aislamiento multi-tenant ante listas y sin query
  // ------------------------------------------------------------------------
  await test('A6.14 Auditoría: Usuario de empresa A no puede leer libro contable ($14.875.000) ni sobrescribir facturas de empresa B', async () => {
    // 1. Intento de evasión con array en query para leer libro contable ajeno: ?empresaId[]=client-innovagile
    const resArrayQuery = await makeRequest(
      'GET',
      '/api/accounting/entries?empresaId[]=client-innovagile',
      { Authorization: `Bearer ${tokenTenantAdmin}` }
    );
    assert.strictEqual(resArrayQuery.status, 400, 'Debe rechazar array en query con 400');
    assert.strictEqual(resArrayQuery.body.error, 'IDENTIFICADOR_EMPRESA_INVALIDO');

    // 2. Consulta de libro contable sin especificar empresaId en query:
    // Debe restringirse AUTOMÁTICAMENTE a la empresa autorizada del usuario (req.effectiveEmpresaId)
    const resEntriesNoQuery = await makeRequest(
      'GET',
      '/api/accounting/entries',
      { Authorization: `Bearer ${tokenTenantAdmin}` }
    );
    assert.strictEqual(resEntriesNoQuery.status, 200);
    const returnedEntries = resEntriesNoQuery.body.entries || [];
    // Verificar que NINGÚN asiento pertenezca a client-innovagile (como las ventas de $14.875.000)
    const leakedInnovagile = returnedEntries.some(
      (e: any) => e.empresaId === 'client-innovagile' || e.empresaId === 'CLIENT-INNOVAGILE'
    );
    assert.strictEqual(leakedInnovagile, false, 'No debe filtrar ningún asiento contable de client-innovagile');

    // 3. Intento de evasión con array en body para sobrescribir DTEs de empresa ajena
    const resOverwriteArray = await makeRequest(
      'POST',
      '/api/rcv/dtes',
      { Authorization: `Bearer ${tokenTenantAdmin}` },
      {
        empresaRut: ['client-innovagile'],
        dtes: [{ folio: 9999, tipo: 'FACTURA', montoTotal: 100 }],
      }
    );
    assert.strictEqual(resOverwriteArray.status, 400, 'Debe rechazar empresaRut array con 400');
    assert.strictEqual(resOverwriteArray.body.error, 'IDENTIFICADOR_EMPRESA_INVALIDO');

    // 4. Intento directo de sobrescribir DTEs de empresa ajena
    const resOverwriteDirect = await makeRequest(
      'POST',
      '/api/rcv/dtes',
      { Authorization: `Bearer ${tokenTenantAdmin}` },
      {
        empresaId: 'client-innovagile',
        dtes: [{ folio: 9999, tipo: 'FACTURA', montoTotal: 100 }],
      }
    );
    assert.strictEqual(resOverwriteDirect.status, 403, 'Debe denegar acceso a empresa ajena con 403');
  });

  console.log('\n========================================================================');
  console.log(`🎉 RESULTADO A6: ${passed} de ${total} pruebas de perímetro pasaron exitosamente (100%).`);
  console.log('========================================================================\n');
  process.exit(0);
}

runPerimeterTestSuite().catch((err) => {
  console.error('Fallo en la suite de pruebas de perímetro A6:', err);
  process.exit(1);
});
