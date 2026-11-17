/**
 * Voces por empresa: Gemini incluido o ElevenLabs con la cuenta de la empresa.
 * Se ejecuta en un directorio temporal; las llamadas a ElevenLabs se simulan con un fetch falso.
 */
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import type { AddressInfo } from 'node:net';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'erp-voz-'));
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

async function run() {
  console.log('\nVOCES POR EMPRESA\n');
  const { voiceSettingsRouter } = await import('../src/controllers/voiceSettingsController');
  const { diskPersistence } = await import('../src/services/diskPersistenceService');
  const tts = await import('../src/services/ttsProviderService');

  diskPersistence.updateCollection('clients', [
    { id: '76111111-6', rut: '76111111-6', razonSocial: 'Empresa Voz SpA', estadoEmpresa: 'ACTIVA' },
    { id: '76222222-1', rut: '76222222-1', razonSocial: 'Otra SpA', estadoEmpresa: 'ACTIVA' },
  ]);

  let currentUser: any = null;
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.user = currentUser;
    next();
  });
  app.use('/api/voice-settings', voiceSettingsRouter);
  const server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const realFetch = globalThis.fetch;
  const call = async (method: string, url: string, body?: any) => {
    const res = await realFetch(base + url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: await res.json() };
  };
  const admin = { userId: 'a', isSuperAdmin: false, isAdmin: true, empresaPrincipalId: '76111111-6', empresasPermitidas: ['76111111-6'] };
  const contador = { userId: 'c', isSuperAdmin: false, isAdmin: false, empresaPrincipalId: '76111111-6', empresasPermitidas: ['76111111-6'] };

  await test('Por defecto la empresa usa Gemini (incluido)', async () => {
    currentUser = contador;
    const r = await call('GET', '/api/voice-settings/76111111-6');
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    assert.strictEqual(r.body.ajustes.proveedor, 'GEMINI');
    assert.strictEqual(r.body.ajustes.elevenlabs.hasApiKey, false);
  });

  await test('Solo el administrador cambia el proveedor, y solo de sus empresas', async () => {
    currentUser = contador;
    const r = await call('PUT', '/api/voice-settings/76111111-6', { proveedor: 'GEMINI' });
    assert.strictEqual(r.status, 403);
    currentUser = admin;
    const otra = await call('PUT', '/api/voice-settings/76222222-1', { proveedor: 'GEMINI' });
    assert.strictEqual(otra.status, 403);
  });

  await test('ElevenLabs exige clave y voz; la clave se guarda cifrada y nunca vuelve al navegador', async () => {
    currentUser = admin;
    const sinClave = await call('PUT', '/api/voice-settings/76111111-6', { proveedor: 'ELEVENLABS', elevenlabs: { voces: { default: 'VozDefault12345' } } });
    assert.strictEqual(sinClave.body.code, 'MISSING_PARAMS');
    const ok = await call('PUT', '/api/voice-settings/76111111-6', {
      proveedor: 'ELEVENLABS',
      elevenlabs: { apiKey: 'sk_clave_secreta_123', modelId: 'eleven_multilingual_v2', voces: { default: 'VozDefault12345', AGENTE_GENERAL_VERA: 'VozVera1234567' } },
    });
    assert.strictEqual(ok.status, 200, JSON.stringify(ok.body));
    assert.strictEqual(ok.body.ajustes.elevenlabs.hasApiKey, true);
    assert.ok(!JSON.stringify(ok.body).includes('sk_clave_secreta_123'));
    const guardado = JSON.stringify((diskPersistence.getSnapshot() as any).companyVoiceSettings);
    assert.ok(!guardado.includes('sk_clave_secreta_123'), 'no queda en texto plano en disco');
    assert.ok(guardado.includes('vault:v1'));
  });

  await test('La síntesis usa la clave, el modelo y la voz del agente de esa empresa', async () => {
    let llamada: any = null;
    (globalThis as any).fetch = async (url: string, init: any) => {
      llamada = { url, init };
      return new Response(Buffer.from('ID3-mp3-falso'), { status: 200, headers: { 'Content-Type': 'audio/mpeg' } });
    };
    try {
      const r = await tts.synthesizeElevenLabs('76111111-6', 'Hola', 'AGENTE_GENERAL_VERA');
      assert.strictEqual(r.motor, 'ELEVENLABS');
      assert.strictEqual(r.mimeType, 'audio/mpeg');
      assert.ok(llamada.url.includes('/v1/text-to-speech/VozVera1234567'));
      assert.strictEqual(llamada.init.headers['xi-api-key'], 'sk_clave_secreta_123');
      assert.strictEqual(JSON.parse(llamada.init.body).model_id, 'eleven_multilingual_v2');
      const otro = await tts.synthesizeElevenLabs('76111111-6', 'Hola', 'AGENTE_SIN_VOZ');
      assert.ok(otro.detalle.includes('VozDefault12345'), 'sin voz propia usa la voz por defecto');
    } finally {
      (globalThis as any).fetch = realFetch;
    }
  });

  await test('Una empresa sin ElevenLabs no usa la cuenta de otra', async () => {
    await assert.rejects(() => tts.synthesizeElevenLabs('76222222-1', 'Hola'), /no está configurado/);
  });

  await test('Audio de Gemini: WAV se respeta, PCM se envuelve con su frecuencia, otros formatos no se tocan', () => {
    const pcm = Buffer.alloc(4800);
    const w = tts.normalizeGeminiAudio(pcm, 'audio/L16;codec=pcm;rate=24000');
    assert.strictEqual(w.mimeType, 'audio/wav');
    assert.strictEqual(w.audio.readUInt32LE(24), 24000);
    const sinRate = tts.normalizeGeminiAudio(pcm, 'audio/l16');
    assert.strictEqual(sinRate.audio.readUInt32LE(24), 24000);
    const r16 = tts.normalizeGeminiAudio(pcm, 'audio/pcm;rate=16000');
    assert.strictEqual(r16.audio.readUInt32LE(24), 16000, 'respeta 16 kHz (antes sonaba acelerado)');
    const wav = tts.pcmToWav(pcm, 24000);
    assert.strictEqual(tts.normalizeGeminiAudio(wav, 'audio/wav').audio, wav);
    const mp3 = Buffer.from('ID3xxxx');
    assert.deepStrictEqual(tts.normalizeGeminiAudio(mp3, 'audio/mpeg'), { audio: mp3, mimeType: 'audio/mpeg' });
  });

  await test('Solo se prueban modelos de voz reales de Gemini (no modelos de texto)', () => {
    const m = tts.geminiTtsModels();
    assert.ok(m.length >= 3);
    assert.ok(m.every((x) => x.includes('tts')), m.join(', '));
  });

  server.close();
  console.log(`\nRESULTADO VOCES: ${passed} de ${total} pruebas pasaron.\n`);
  process.exit(passed === total ? 0 : 1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
