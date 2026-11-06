/**
 * Fase 1 — Éxitos falsos de gravedad alta. Una prueba (o más) por hallazgo de la auditoría.
 * Cada prueba reproduce el caso original y espera el comportamiento honesto.
 */
import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { HttpDteBillingService } from '../src/services/httpDteBillingService';
import { diskPersistence } from '../src/services/diskPersistenceService';
import { assertDteSimulationPolicy, isOfflineDteSimulationAllowed } from '../src/config/dteSimulationPolicy';
import { calculatePreF29 } from '../src/utils/f29SeniorEngine';
import { DEFAULT_INDICATORS } from '../src/utils/chileanAccounting';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { expenseReportsRouter } from '../src/controllers/expenseReportsController';
import { parseReceiptOcrResponse } from '../src/services/receiptOcrService';
import http from 'node:http';
import { SiiPlaywrightRunner } from '../src/services/siiPlaywrightRunner';
import { voiceAssistantEngine, detectAgenticIntent } from '../src/services/voiceAssistantEngine';
import { DEFAULT_AGENT_PERSONAS } from '../src/config/defaultAgentPersonas';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

function withEnv<T>(vars: Record<string, string | undefined>, fn: () => T): T {
  const prev: Record<string, string | undefined> = {};
  for (const k of Object.keys(vars)) {
    prev[k] = process.env[k];
    if (vars[k] === undefined) delete process.env[k];
    else process.env[k] = vars[k];
  }
  const restore = () => {
    for (const k of Object.keys(prev)) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  };
  try {
    const r = fn();
    if (r instanceof Promise) return r.finally(restore) as any;
    restore();
    return r;
  } catch (e) {
    restore();
    throw e;
  }
}

const samplePayload = (folio: number): any => ({
  tipoDte: 33,
  folio,
  fechaEmision: '2026-10-15',
  ambiente: 1,
  emisor: { rut: '76999888-1', razonSocial: 'EMISOR PRUEBA SPA' },
  receptor: { rut: '11111111-1', razonSocial: 'RECEPTOR PRUEBA' },
  detalles: [{ NmbItem: 'Servicio', QtyItem: 1, PrcItem: 100000, MontoItem: 100000 }],
  totales: { montoNeto: 100000, montoExento: 0, montoIva: 19000, montoTotal: 119000 },
  formaPago: 2,
});

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

  console.log('=== FASE 1: REGRESIONES DE ÉXITOS FALSOS ===\n');

  // ---------------------------------------------------------------- Hallazgo #4 (tarea 1.4)
  await test('#4 La simulación de DTE no se admite en producción ni con DTE_AMBIENTE=2', () => {
    withEnv({ NODE_ENV: 'production', ALLOW_OFFLINE_DTE_SIMULATION: 'true', DTE_AMBIENTE: '1' }, () => {
      assert.throws(() => assertDteSimulationPolicy(), /NODE_ENV=production/);
      assert.strictEqual(isOfflineDteSimulationAllowed(), false);
    });
    withEnv({ NODE_ENV: 'development', ALLOW_OFFLINE_DTE_SIMULATION: 'true', DTE_AMBIENTE: '2' }, () => {
      assert.throws(() => assertDteSimulationPolicy(), /DTE_AMBIENTE=2/);
      assert.strictEqual(isOfflineDteSimulationAllowed(), false);
    });
    withEnv({ NODE_ENV: 'production', ALLOW_OFFLINE_DTE_SIMULATION: 'false', DTE_AMBIENTE: '2' }, () => {
      assert.doesNotThrow(() => assertDteSimulationPolicy());
    });
  });

  await test('#4 Con NODE_ENV=production y simulación activa el servidor no arranca', () => {
    const r = spawnSync(process.execPath, [path.join(ROOT, 'node_modules/tsx/dist/cli.mjs'), path.join(ROOT, 'server.ts')], {
      cwd: ROOT,
      env: { ...process.env, NODE_ENV: 'production', ALLOW_OFFLINE_DTE_SIMULATION: 'true', PORT: '0', DEMO_MODE: 'false' },
      timeout: 90000,
      encoding: 'utf8',
    });
    assert.notStrictEqual(r.status, 0, 'El servidor debió terminar con error');
    assert.match(`${r.stdout}\n${r.stderr}`, /ALLOW_OFFLINE_DTE_SIMULATION=true no está permitido/);
  });

  await test('#4 Sin certificado real no hay certificado de demostración fuera de desarrollo', () => {
    withEnv({ ALLOW_OFFLINE_DTE_SIMULATION: 'false', DTE_CERT_BASE64: undefined, DTE_CERT_PATH: undefined }, () => {
      const cert = HttpDteBillingService.loadDigitalCertificate(undefined, { rut: '76999888-1' });
      assert.strictEqual(cert, null);
    });
    withEnv({ NODE_ENV: 'production', ALLOW_OFFLINE_DTE_SIMULATION: 'true', DTE_CERT_BASE64: undefined, DTE_CERT_PATH: undefined }, () => {
      assert.strictEqual(HttpDteBillingService.loadDigitalCertificate(undefined, { rut: '76999888-1' }), null);
    });
  });

  await test('#4 Sin simulación, una emisión sin servicio HTTP-DTE falla (no inventa timbre)', async () => {
    await withEnv({ ALLOW_OFFLINE_DTE_SIMULATION: 'false', NODE_ENV: 'test' }, async () => {
      await assert.rejects(
        () => HttpDteBillingService.emitirDte(samplePayload(910001), { baseUrl: 'http://127.0.0.1:1', maxRetries: 0, timeoutMs: 1000 }),
        /CAF/
      );
    });
  });

  await test('#4 Un DTE simulado se guarda SIMULADO y nunca ACEPTADO', async () => {
    await withEnv({ ALLOW_OFFLINE_DTE_SIMULATION: 'true', NODE_ENV: 'development', DTE_AMBIENTE: '1' }, async () => {
      const payload = samplePayload(910002);
      const res = await HttpDteBillingService.emitirDte(payload, { baseUrl: 'http://127.0.0.1:1', maxRetries: 0, timeoutMs: 1000 });
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.simulated, true);
      assert.ok(res.ted?.includes('SIMULATED_TED_KEY_OK'));
      const dteId = await HttpDteBillingService.persistEmittedDte(res, payload);
      const stored = diskPersistence.getDtes().find((d: any) => d.id === dteId);
      assert.ok(stored, 'DTE no persistido');
      assert.strictEqual(stored.estadoSii, 'SIMULADO');
      const acceptedSimulated = diskPersistence
        .getDtes()
        .filter((d: any) => (d.tedXml || '').includes('SIMULATED_TED_KEY_OK') && String(d.estadoSii).startsWith('ACEPTADO'));
      assert.strictEqual(acceptedSimulated.length, 0, 'Hay DTEs con firma simulada marcados como aceptados');
    });
  });

  await test('#4 Un DTE enviado de verdad queda ENVIADO (no ACEPTADO) hasta consultar el Track ID', async () => {
    const payload = samplePayload(910003);
    const dteId = await HttpDteBillingService.persistEmittedDte(
      { success: true, folio: 910003, tipoDte: 33, trackId: '0123456789', ted: '<TED>firma-real</TED>', ambiente: 1 },
      payload
    );
    const stored = diskPersistence.getDtes().find((d: any) => d.id === dteId);
    assert.strictEqual(stored.estadoSii, 'ENVIADO');
  });

  await test('#4 El F29 no declara DTEs simulados', () => {
    const base = {
      tipoOperacion: 'VENTA',
      tipoDte: '33',
      fechaEmision: '2026-10-10',
      periodo: '2026-10',
      rutContraparte: '11111111-1',
      razonSocialContraparte: 'X',
      montoExento: 0,
      estadoPago: 'PENDIENTE',
      glosa: '',
    };
    const dtes: any[] = [
      { ...base, id: 'real', folio: 1, montoNeto: 100000, montoIva: 19000, montoTotal: 119000, estadoSii: 'ENVIADO' },
      { ...base, id: 'sim', folio: 2, montoNeto: 500000, montoIva: 95000, montoTotal: 595000, estadoSii: 'SIMULADO' },
      {
        ...base, id: 'sim-ted', folio: 3, montoNeto: 300000, montoIva: 57000, montoTotal: 357000, estadoSii: 'ACEPTADO',
        tedXml: '<TED><FRMT>SIMULATED_TED_KEY_OK</FRMT></TED>',
      },
    ];
    const company: any = { rut: '76999888-1', razonSocial: 'EMISOR PRUEBA SPA', tasaPpm: 0.01 };
    const r = calculatePreF29(company, dtes, [], DEFAULT_INDICATORS as any, { periodo: '2026-10' });
    assert.strictEqual(r.detalle_debito?.debitoFacturasIva, 19000);
  });

  // ---------------------------------------------------------------- Hallazgo #2 (tarea 1.1)
  await test('#2 OCR: sin IA disponible el endpoint responde 503 OCR_UNAVAILABLE y ningún monto', async () => {
    const prevKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = '';
    const app = express();
    app.use(express.json({ limit: '5mb' }));
    app.use('/api/expenses', expenseReportsRouter);
    const server = app.listen(0);
    try {
      const port = (server.address() as AddressInfo).port;
      const resp = await fetch(`http://127.0.0.1:${port}/api/expenses/scan-receipt-ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8U',
          mimeType: 'image/jpeg',
          fileName: 'copec.jpg',
        }),
      });
      const body: any = await resp.json();
      assert.strictEqual(resp.status, 503);
      assert.strictEqual(body.success, false);
      assert.strictEqual(body.code, 'OCR_UNAVAILABLE');
      assert.strictEqual(body.data, undefined, 'No debe devolver datos');
      assert.ok(!JSON.stringify(body).includes('35000'), 'No debe aparecer el monto heurístico de COPEC');
    } finally {
      server.close();
      process.env.GEMINI_API_KEY = prevKey;
    }
  });

  await test('#2 OCR: respuestas inválidas de la IA se rechazan y los campos ausentes no se inventan', () => {
    assert.strictEqual(parseReceiptOcrResponse('no es json').ok, false);
    assert.strictEqual(parseReceiptOcrResponse('{"error":"ILEGIBLE"}').ok, false);
    assert.strictEqual(parseReceiptOcrResponse('{"tipoDocumento":"BOLETA_ELECTRONICA","montoTotalClp":null}').ok, false);
    const ok = parseReceiptOcrResponse(
      JSON.stringify({
        tipoDocumento: 'BOLETA_ELECTRONICA', proveedorRut: null, proveedorRazonSocial: 'COPEC', folioDocumento: null,
        fecha: null, montoTotalClp: 41990, montoNeto: null, montoIva: null, montoExento: null, categoria: 'COMBUSTIBLE',
        descripcionGlosa: null, cuentaContableCodigo: null, cuentaContableNombre: null, esGastoRechazadoArt21: null,
        diagnosticoAgente: null, confianzaScore: 71,
      })
    );
    assert.strictEqual(ok.ok, true);
    const data = (ok as any).data;
    assert.strictEqual(data.montoTotalClp, 41990);
    assert.strictEqual(data.proveedorRut, null);
    assert.strictEqual(data.folioDocumento, null);
    assert.strictEqual(data.fecha, null);
  });

  await test('#2 OCR: el controlador ya no contiene la heurística de respaldo', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src/controllers/expenseReportsController.ts'), 'utf8');
    assert.ok(!/Heurística de respaldo|totalSim|Math\.random\(\) \* 900000/.test(src));
  });

  // ---------------------------------------------------------------- Hallazgo #3 (tareas 1.2 y 1.3)
  await test('#3 Prueba SII: sin clave registrada no hay CONECTADO', async () => {
    const r = await SiiPlaywrightRunner.testLogin({ rut: '76.104.550-9', password: '' });
    assert.strictEqual(r.success, false);
    assert.strictEqual(r.estado, 'SIN_CREDENCIALES');
  });

  await test('#3 Prueba SII: el estado lo decide la respuesta del portal, no la longitud de la clave', async () => {
    // Portal SII de prueba: acepta solo la clave "abc" (3 caracteres) y rechaza el resto con su propio mensaje.
    let logoutCalls = 0;
    const portal = http.createServer((req, res) => {
      if (req.url?.startsWith('/login') && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        return res.end('<form method="POST" action="/login"><input id="rutcntr" name="rut"><input id="clave" name="clave" type="password"><button id="bt_ingresar" type="submit">Ingresar</button></form>');
      }
      if (req.url?.startsWith('/login') && req.method === 'POST') {
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
          const clave = new URLSearchParams(body).get('clave');
          if (clave === 'abc') {
            res.writeHead(302, { Location: '/home' });
            return res.end();
          }
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<div class="alert-danger">Clave Tributaria incorrecta (mensaje del portal)</div>');
        });
        return;
      }
      if (req.url?.startsWith('/logout')) logoutCalls++;
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<h1>Mi SII</h1>');
    });
    await new Promise<void>((r) => portal.listen(0, '127.0.0.1', () => r()));
    const port = (portal.address() as AddressInfo).port;
    const prev = { login: process.env.SII_LOGIN_URL, logout: process.env.SII_LOGOUT_URL };
    process.env.SII_LOGIN_URL = `http://127.0.0.1:${port}/login`;
    process.env.SII_LOGOUT_URL = `http://127.0.0.1:${port}/logout`;
    try {
      const wrong = await SiiPlaywrightRunner.testLogin({ rut: '76104550-9', password: 'ClaveSii*2026-larga' });
      if (wrong.estado === 'ERROR_PORTAL' && /Executable doesn't exist|browserType\.launch/.test(wrong.mensajeSii || '')) {
        if (process.env.CI) throw new Error('Chromium de Playwright no instalado en CI');
        console.warn('     (omitida: Chromium de Playwright no instalado en este equipo)');
        return;
      }
      assert.strictEqual(wrong.success, false);
      assert.strictEqual(wrong.estado, 'ERROR_CREDENCIALES');
      assert.match(String(wrong.mensajeSii), /mensaje del portal/);

      const right = await SiiPlaywrightRunner.testLogin({ rut: '76104550-9', password: 'abc' });
      assert.strictEqual(right.success, true, right.mensajeSii || '');
      assert.strictEqual(right.estado, 'CONECTADO');
      assert.ok(logoutCalls >= 1, 'La prueba debe cerrar la sesión (forceLogout)');
    } finally {
      process.env.SII_LOGIN_URL = prev.login;
      process.env.SII_LOGOUT_URL = prev.logout;
      if (prev.login === undefined) delete process.env.SII_LOGIN_URL;
      if (prev.logout === undefined) delete process.env.SII_LOGOUT_URL;
      portal.close();
    }
  });

  await test('#3/#10 La UI no simula autenticación ni bitácoras con esperas artificiales', () => {
    const ui = fs.readFileSync(path.join(ROOT, 'src/components/AgentClientConfig.tsx'), 'utf8');
    assert.ok(!/setTimeout\(r, \d+\)/.test(ui), 'AgentClientConfig usa setTimeout como espera de "procesamiento"');
    assert.ok(!/claveSii\.length >= 4/.test(ui), 'La validez de la clave no puede depender de su longitud');
    assert.ok(ui.includes("/api/sii/test-login"));
    for (const f of ['src/components/tenancy/NewErpClientOnboardingModal.tsx', 'src/components/tenancy/AnchorClientMasterModal.tsx']) {
      const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
      assert.ok(!src.includes('ClaveSii*2026'), `${f} asigna una clave SII de ejemplo`);
      assert.ok(!src.includes("estadoConexionSii: 'CONECTADO'"), `${f} marca CONECTADO sin probar la conexión`);
    }
  });

  // ---------------------------------------------------------------- Hallazgo #1 (tarea 1.5)
  await test('#1 Vera: sin guiones (1542, VeHiCe, Dyneema, 10150000) fuera de src/data/seed*', () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(e.name) && !/src[\\/]data[\\/]seed/.test(full)) {
          const src = fs.readFileSync(full, 'utf8');
          if (/1542|VeHiCe|Dyneema|10150000/i.test(src)) offenders.push(path.relative(ROOT, full));
        }
      }
    };
    walk(path.join(ROOT, 'src'));
    assert.deepStrictEqual(offenders, []);
  });

  await test('#1 Vera: facturar, cotizar, inventario, bancos y escenarios van al motor agéntico', () => {
    assert.strictEqual(detectAgenticIntent('emite una factura a vehice por 3.500.000')?.module, 'FACTURACION_DTE');
    assert.strictEqual(detectAgenticIntent('necesito un presupuesto para salmones austral')?.module, 'COSTOS_PRODUCCION');
    assert.strictEqual(detectAgenticIntent('cuánto stock queda en bodega')?.module, 'INVENTARIO');
    assert.strictEqual(detectAgenticIntent('concilia la cartola del banco')?.module, 'CONCILIACION');
    assert.strictEqual(detectAgenticIntent('qué pasa con la caja si el cliente paga 15 días después')?.module, 'FLUJO_CAJA');
    assert.strictEqual(detectAgenticIntent('estado de las cotizaciones enviadas'), null);
  });

  const ctx: any = {
    clientId: 'client-test-vera',
    clientName: 'Empresa Prueba SpA',
    rut: '76.999.888-1',
    dtesCount: 0, pendingPurchasesCount: 0, pendingSalesCount: 0, bankAccountsCount: 0,
    pendingBankNoveltiesCount: 0, f29IvaTotal: 0, employeesCount: 0, inventoryItemsCount: 0,
    inventoryItems: [], payrolls: [], bankAccounts: [],
  };
  const persona = DEFAULT_AGENT_PERSONAS[0];
  const textOf = (r: any) => `${r.verbalResponse || ''} ${r.displayMarkdown || ''}`;

  await test('#1 Vera: una orden de facturar nunca responde "timbrada" ni un folio inventado', async () => {
    const r = await voiceAssistantEngine.processDialogue('Emite una factura a VeHiCe por 3.500.000 neto', persona, ctx);
    const t = textOf(r);
    assert.ok(!/timbrada exitosamente|Folio 1542|76\.543\.210-K/i.test(t), t.slice(0, 300));
    const confirm = await voiceAssistantEngine.processDialogue('sí, autorizo el timbraje', persona, ctx, [
      { sender: 'AGENT', text: 'Borrador de factura DTE 33 por $4.165.000' },
    ]);
    assert.ok(!/timbrada exitosamente|Folio 1542/i.test(textOf(confirm)));
  });

  await test('#1 Vera: inventario y remuneraciones sin datos no muestran existencias ni montos de respaldo', async () => {
    const inv = textOf(await voiceAssistantEngine.processDialogue('¿cuánto stock queda en bodega?', persona, ctx));
    assert.ok(!/RED-DYN-80|CABO-POL-32|48\.500|Bodega Central Quilicura/.test(inv), inv.slice(0, 300));
    const pay = textOf(await voiceAssistantEngine.processDialogue('dame el resumen de sueldos y previred', persona, ctx));
    assert.ok(!/4\.850\.000|6\.200\.000|713\.000/.test(pay), pay.slice(0, 300));
    const bank = textOf(await voiceAssistantEngine.processDialogue('dame los saldos bancarios', persona, ctx));
    assert.ok(!/44\.382\.013|2\.150\.000|Caja Central Oficina Principal|100% CUADRADO/.test(bank), bank.slice(0, 300));
  });

  // ---------------------------------------------------------------- 1.6 (#1, #10) y cierre 0.2
  await test('1.6 Franja DEMOSTRACIÓN en toda la UI solo con DEMO_MODE; sin DEMO_MODE no hay cartera ni estudio de ejemplo', () => {
    const main = fs.readFileSync(path.join(ROOT, 'src/main.tsx'), 'utf8');
    assert.ok(main.includes('<DemoModeBanner />'));
    const banner = fs.readFileSync(path.join(ROOT, 'src/components/DemoModeBanner.tsx'), 'utf8');
    assert.ok(banner.includes('if (!isDemoModeEnabled()) return null;'));
    const app = fs.readFileSync(path.join(ROOT, 'src/App.tsx'), 'utf8');
    assert.ok(app.includes("isDemoModeEnabled() ? seedClients : []"), 'La cartera de ejemplo debe depender de DEMO_MODE');
    assert.ok(app.includes("isDemoModeEnabled() ? seedFirm : EMPTY_FIRM"), 'El estudio de ejemplo debe depender de DEMO_MODE');
    assert.ok(!app.includes("['2026-01', '2026-02']"), 'Períodos cerrados inventados');
  });

  await test('Cierre: la app compilada no usa node:crypto en el navegador (antes: pantalla en blanco)', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src/services/securityRbacService.ts'), 'utf8');
    assert.ok(src.includes("typeof (crypto as any)?.randomBytes !== 'function'"));
  });

  console.log(`\nRESULTADO FASE 1: ${passed} de ${total} pruebas pasaron.`);
  process.exit(passed === total ? 0 : 1);
}

run();
