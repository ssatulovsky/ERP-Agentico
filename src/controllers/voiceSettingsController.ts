/**
 * Voces de los agentes por empresa.
 *
 *   GET  /api/voice-settings/:empresaId                    proveedor, modelo y voces (la clave nunca sale)
 *   PUT  /api/voice-settings/:empresaId                    guarda proveedor, clave ElevenLabs (cifrada), modelo y voces
 *   POST /api/voice-settings/:empresaId/elevenlabs-voices  voces de la cuenta ElevenLabs (clave guardada o la recién escrita)
 *   POST /api/voice-settings/:empresaId/test               sintetiza una frase con la configuración guardada
 *
 * Lee cualquier usuario con acceso a la empresa; modifica el administrador (o SuperAdmin).
 */
import { Router, type Request, type Response } from 'express';
import { requireCompanyAccess } from '../middlewares/authMiddleware';
import { findCompany } from '../services/companyRegistryService';
import {
  listElevenLabsVoices,
  publicVoiceSettings,
  saveCompanyVoiceSettings,
  synthesizeElevenLabs,
  VoiceSettingsError,
} from '../services/ttsProviderService';

export const voiceSettingsRouter = Router();

function guard(req: Request, res: Response, write: boolean): string | null {
  const user = (req as any).user;
  if (!user) {
    res.status(401).json({ success: false, error: 'AUTH_REQUIRED', errorMessage: 'Autenticación requerida.' });
    return null;
  }
  const empresaId = String(req.params.empresaId || '');
  const empresa = findCompany(empresaId);
  if (!empresa) {
    res.status(404).json({ success: false, error: 'EMPRESA_NO_EXISTE', errorMessage: 'La empresa no existe.' });
    return null;
  }
  if (!user.isSuperAdmin && !requireCompanyAccess(req, empresa.id).allowed) {
    res.status(403).json({ success: false, error: 'EMPRESA_NO_PERMITIDA', errorMessage: 'No tiene acceso a esta empresa.' });
    return null;
  }
  if (write && !user.isSuperAdmin && !user.isAdmin) {
    res.status(403).json({ success: false, error: 'ROL_NO_PERMITIDO', errorMessage: 'Solo el administrador configura las voces de la empresa.' });
    return null;
  }
  return empresa.id;
}

function fail(res: Response, err: any) {
  if (err instanceof VoiceSettingsError) return res.status(err.status).json({ success: false, error: err.code, code: err.code, errorMessage: err.message });
  console.error('[Voces]', err);
  return res.status(500).json({ success: false, error: 'ERROR_INTERNO', errorMessage: err?.message || String(err) });
}

voiceSettingsRouter.get('/:empresaId', (req, res) => {
  const id = guard(req, res, false);
  if (!id) return;
  res.json({ success: true, ajustes: publicVoiceSettings(id) });
});

voiceSettingsRouter.put('/:empresaId', (req, res) => {
  const id = guard(req, res, true);
  if (!id) return;
  try {
    res.json({ success: true, ajustes: saveCompanyVoiceSettings(id, req.body || {}, (req as any).user?.userId) });
  } catch (err) {
    fail(res, err);
  }
});

voiceSettingsRouter.post('/:empresaId/elevenlabs-voices', async (req, res) => {
  const id = guard(req, res, true);
  if (!id) return;
  try {
    res.json({ success: true, voces: await listElevenLabsVoices(id, req.body?.apiKey) });
  } catch (err) {
    fail(res, err);
  }
});

voiceSettingsRouter.post('/:empresaId/test', async (req, res) => {
  const id = guard(req, res, true);
  if (!id) return;
  try {
    const texto = String(req.body?.texto || 'Hola, soy Vera, la asistente ejecutiva de su empresa. Así sonará mi voz.').slice(0, 400);
    const r = await synthesizeElevenLabs(id, texto, req.body?.personaId);
    res.json({ success: true, audioBase64: r.audio.toString('base64'), mimeType: r.mimeType, motor: r.motor, detalle: r.detalle });
  } catch (err) {
    fail(res, err);
  }
});
