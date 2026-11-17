/**
 * Voces de los agentes: motor por empresa.
 *
 * Cada empresa elige su proveedor de voz:
 *   GEMINI      incluido en el ERP (clave GEMINI_API_KEY del servidor)
 *   ELEVENLABS  cuenta propia de la empresa: la empresa paga su plan de ElevenLabs y registra su clave
 *               (se guarda cifrada en la bóveda); se elige el modelo y una voz por agente.
 *
 * Si el proveedor elegido falla, /api/voice/tts sigue con Gemini → Piper → voz del navegador e informa
 * qué motor habló realmente (campo `motor`), para que nunca parezca ElevenLabs lo que no lo es.
 */
import { diskPersistence } from './diskPersistenceService';
import { decryptFromVaultString, encryptToVaultString, isVaultString } from '../utils/vaultCrypto';
import { normalizeCompanyKey, companyKeys } from './companyRegistryService';

export type VoiceProvider = 'GEMINI' | 'ELEVENLABS';

/** Indicación de estilo para Gemini TTS (detecta el idioma solo; esto fija acento y registro). */
export const GEMINI_TTS_STYLE = 'Habla en español de Chile, con tono profesional, cálido y natural, a ritmo conversacional';

/** Gemini TTS entrega PCM 16 bits mono a 24 kHz salvo que el tipo MIME indique otra frecuencia. */
export const GEMINI_TTS_DEFAULT_SAMPLE_RATE = 24_000;

export const ELEVENLABS_MODELS = [
  { id: 'eleven_multilingual_v2', nombre: 'Multilingual v2 (calidad alta, recomendado)' },
  { id: 'eleven_flash_v2_5', nombre: 'Flash v2.5 (baja latencia, menor costo)' },
  { id: 'eleven_v3', nombre: 'Eleven v3 (más expresivo)' },
];

export interface CompanyVoiceSettings {
  empresaId: string;
  proveedor: VoiceProvider;
  elevenlabs?: {
    apiKey?: string; // vault:v1:…
    modelId: string;
    /** voz por agente (id de persona → voice_id de ElevenLabs); "default" para el resto */
    voces: Record<string, string>;
  };
  actualizadoEn: string;
  actualizadoPor?: string;
}

const COLLECTION = 'companyVoiceSettings';

function all(): CompanyVoiceSettings[] {
  return (((diskPersistence.getSnapshot() as any)[COLLECTION] as CompanyVoiceSettings[]) || []);
}

export function getCompanyVoiceSettings(empresaId?: string): CompanyVoiceSettings | null {
  if (!empresaId) return null;
  const keys = new Set(companyKeys(empresaId));
  keys.add(normalizeCompanyKey(empresaId));
  return all().find((s) => keys.has(normalizeCompanyKey(s.empresaId))) || null;
}

/** Vista para el navegador: la clave nunca sale, solo si existe. */
export function publicVoiceSettings(empresaId: string) {
  const s = getCompanyVoiceSettings(empresaId);
  return {
    empresaId,
    proveedor: s?.proveedor || 'GEMINI',
    elevenlabs: {
      hasApiKey: Boolean(s?.elevenlabs?.apiKey),
      modelId: s?.elevenlabs?.modelId || 'eleven_multilingual_v2',
      voces: s?.elevenlabs?.voces || {},
    },
    modelos: ELEVENLABS_MODELS,
    actualizadoEn: s?.actualizadoEn || null,
  };
}

export class VoiceSettingsError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export function saveCompanyVoiceSettings(
  empresaId: string,
  input: { proveedor?: string; elevenlabs?: { apiKey?: string; borrarApiKey?: boolean; modelId?: string; voces?: Record<string, string> } },
  usuarioId?: string
) {
  const actual = getCompanyVoiceSettings(empresaId);
  const proveedor = (input.proveedor || actual?.proveedor || 'GEMINI') as VoiceProvider;
  if (proveedor !== 'GEMINI' && proveedor !== 'ELEVENLABS') throw new VoiceSettingsError(400, 'PROVEEDOR_INVALIDO', 'Proveedor de voz inválido.');

  const el = input.elevenlabs || {};
  let apiKey = actual?.elevenlabs?.apiKey;
  if (el.borrarApiKey) apiKey = undefined;
  const nueva = String(el.apiKey || '').trim();
  if (nueva && !/^\*+$/.test(nueva)) apiKey = isVaultString(nueva) ? nueva : encryptToVaultString(nueva);
  const modelId = el.modelId || actual?.elevenlabs?.modelId || 'eleven_multilingual_v2';
  if (!ELEVENLABS_MODELS.some((m) => m.id === modelId)) throw new VoiceSettingsError(400, 'MODELO_INVALIDO', 'Modelo de ElevenLabs no soportado.');
  const voces: Record<string, string> = {};
  for (const [k, v] of Object.entries(el.voces ?? actual?.elevenlabs?.voces ?? {})) {
    if (typeof v === 'string' && /^[A-Za-z0-9]{8,40}$/.test(v.trim())) voces[k] = v.trim();
  }
  if (proveedor === 'ELEVENLABS') {
    if (!apiKey) throw new VoiceSettingsError(400, 'MISSING_PARAMS', 'Para usar ElevenLabs registre la clave API de la cuenta de la empresa.');
    if (!voces.default && Object.keys(voces).length === 0) {
      throw new VoiceSettingsError(400, 'MISSING_PARAMS', 'Elija al menos la voz por defecto de ElevenLabs.');
    }
  }
  const registro: CompanyVoiceSettings = {
    empresaId,
    proveedor,
    elevenlabs: { apiKey, modelId, voces },
    actualizadoEn: new Date().toISOString(),
    actualizadoPor: usuarioId,
  };
  const otros = all().filter((s) => normalizeCompanyKey(s.empresaId) !== normalizeCompanyKey(actual?.empresaId || empresaId));
  diskPersistence.updateCollection(COLLECTION, [...otros, registro]);
  return publicVoiceSettings(empresaId);
}

function elevenKey(empresaId: string): string {
  const k = getCompanyVoiceSettings(empresaId)?.elevenlabs?.apiKey;
  if (!k) throw new VoiceSettingsError(400, 'SIN_CLAVE', 'La empresa no tiene clave de ElevenLabs registrada.');
  return isVaultString(k) ? decryptFromVaultString(k) : k;
}

/** Voces disponibles en la cuenta ElevenLabs de la empresa. */
export async function listElevenLabsVoices(empresaId: string, apiKeyDirecta?: string) {
  const key = apiKeyDirecta?.trim() || elevenKey(empresaId);
  const res = await fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': key } });
  if (res.status === 401) throw new VoiceSettingsError(400, 'CLAVE_RECHAZADA', 'ElevenLabs rechazó la clave API.');
  if (!res.ok) throw new VoiceSettingsError(502, 'ELEVENLABS_ERROR', `ElevenLabs respondió HTTP ${res.status}.`);
  const json: any = await res.json();
  return (json.voices || []).map((v: any) => ({
    voiceId: v.voice_id,
    nombre: v.name,
    categoria: v.category || '',
    genero: v.labels?.gender || '',
    acento: v.labels?.accent || '',
    idioma: v.labels?.language || v.fine_tuning?.language || '',
    muestra: v.preview_url || '',
  }));
}

export interface SynthResult {
  audio: Buffer;
  mimeType: string;
  motor: 'ELEVENLABS' | 'GEMINI' | 'PIPER';
  detalle: string;
}

/** Síntesis con la cuenta ElevenLabs de la empresa (MP3 44,1 kHz). */
export async function synthesizeElevenLabs(empresaId: string, text: string, personaId?: string): Promise<SynthResult> {
  const s = getCompanyVoiceSettings(empresaId);
  if (!s || s.proveedor !== 'ELEVENLABS' || !s.elevenlabs) throw new VoiceSettingsError(400, 'NO_CONFIGURADO', 'ElevenLabs no está configurado para la empresa.');
  const voiceId = (personaId && s.elevenlabs.voces[personaId]) || s.elevenlabs.voces.default || Object.values(s.elevenlabs.voces)[0];
  if (!voiceId) throw new VoiceSettingsError(400, 'SIN_VOZ', 'No hay voz de ElevenLabs asignada.');
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': elevenKey(empresaId), 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text, model_id: s.elevenlabs.modelId }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new VoiceSettingsError(502, 'ELEVENLABS_ERROR', `ElevenLabs HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  return { audio: Buffer.from(await res.arrayBuffer()), mimeType: 'audio/mpeg', motor: 'ELEVENLABS', detalle: `ElevenLabs ${s.elevenlabs.modelId} (${voiceId})` };
}

/**
 * Modelos de voz de Gemini a probar, en orden. Solo modelos TTS reales: los modelos de texto no
 * generan audio y antes se probaban en vano. GEMINI_TTS_MODEL permite fijar uno.
 */
export function geminiTtsModels(): string[] {
  return [
    process.env.GEMINI_TTS_MODEL,
    'gemini-3.8-flash-tts',
    'gemini-3.8-flash-lite-tts',
    'gemini-3.1-flash-tts-preview',
    'gemini-2.5-flash-preview-tts',
  ].filter((m, i, arr): m is string => Boolean(m) && arr.indexOf(m) === i);
}

/**
 * Normaliza el audio que devuelve Gemini a algo que el navegador reproduce tal cual:
 *  - WAV (con cabecera RIFF): se devuelve igual.
 *  - PCM crudo (audio/pcm, audio/l16): se envuelve en WAV con la frecuencia que declara el tipo MIME
 *    (24 kHz si no la declara).
 *  - Otros formatos (mp3, ogg, mu-law, a-law): se devuelven con su tipo, sin tocarlos.
 */
export function normalizeGeminiAudio(data: Buffer, mime: string): { audio: Buffer; mimeType: string } {
  const m = (mime || '').toLowerCase();
  if (data.length >= 4 && data.toString('ascii', 0, 4) === 'RIFF') return { audio: data, mimeType: 'audio/wav' };
  if (m.includes('pcm') || m.includes('l16') || m === 'audio/raw') {
    // Frecuencia documentada de Gemini TTS cuando el tipo MIME no la declara (parámetro técnico de audio).
    const declarada = m.match(/rate=(\d+)/)?.[1];
    const rate = declarada ? Number(declarada) : GEMINI_TTS_DEFAULT_SAMPLE_RATE;
    const canales = m.match(/channels=(\d+)/)?.[1];
    const channels = canales ? Number(canales) : 1;
    return { audio: pcmToWav(data, rate, channels), mimeType: 'audio/wav' };
  }
  return { audio: data, mimeType: m.split(';')[0] || 'application/octet-stream' };
}

export function pcmToWav(pcm: Buffer, sampleRate = GEMINI_TTS_DEFAULT_SAMPLE_RATE, channels = 1, bitsPerSample = 16): Buffer {
  const header = Buffer.alloc(44);
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE((channels * bitsPerSample) / 8, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}
