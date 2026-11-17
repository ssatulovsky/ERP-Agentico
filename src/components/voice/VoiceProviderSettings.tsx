/**
 * Proveedor de voz de la empresa activa.
 *
 * Gemini viene incluido en el ERP. Si la empresa paga su propia cuenta de ElevenLabs, el administrador
 * registra aquí la clave (queda cifrada en el servidor y no vuelve al navegador), elige el modelo y una
 * voz por agente, y la prueba antes de guardar.
 */
import React, { useEffect, useState } from 'react';
import { Volume2, KeyRound, Loader2, CheckCircle2, AlertTriangle, Play } from 'lucide-react';
import type { AgentPersona } from '../../types/agentPersona';

async function api(method: string, url: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.success === false) throw new Error(json?.errorMessage || `HTTP ${res.status}`);
  return json;
}

interface Voz {
  voiceId: string;
  nombre: string;
  genero: string;
  acento: string;
  idioma: string;
  muestra: string;
}

interface Props {
  empresaId: string;
  empresaNombre: string;
  personas: AgentPersona[];
}

const input = 'w-full border border-slate-300 rounded px-2 py-1.5 text-xs';
const label = 'block text-[10px] font-bold text-slate-500 uppercase mb-0.5';

export const VoiceProviderSettings: React.FC<Props> = ({ empresaId, empresaNombre, personas }) => {
  const [proveedor, setProveedor] = useState<'GEMINI' | 'ELEVENLABS'>('GEMINI');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [modelId, setModelId] = useState('eleven_multilingual_v2');
  const [modelos, setModelos] = useState<Array<{ id: string; nombre: string }>>([]);
  const [voces, setVoces] = useState<Record<string, string>>({});
  const [catalogo, setCatalogo] = useState<Voz[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [motor, setMotor] = useState<{ motor: string; detalle?: string; aviso?: string } | null>(null);

  const base = `/api/voice-settings/${encodeURIComponent(empresaId)}`;

  useEffect(() => {
    if (!empresaId) return;
    setMsg(null);
    setCatalogo([]);
    setApiKey('');
    api('GET', base)
      .then((d) => {
        setProveedor(d.ajustes.proveedor);
        setHasApiKey(d.ajustes.elevenlabs.hasApiKey);
        setModelId(d.ajustes.elevenlabs.modelId);
        setVoces(d.ajustes.elevenlabs.voces || {});
        setModelos(d.ajustes.modelos || []);
      })
      .catch((e) => setMsg({ ok: false, text: e.message }));
  }, [base, empresaId]);

  // Muestra qué motor habló realmente en la última respuesta de un agente.
  useEffect(() => {
    const on = (e: Event) => setMotor((e as CustomEvent).detail);
    window.addEventListener('erp:voice-engine', on);
    return () => window.removeEventListener('erp:voice-engine', on);
  }, []);

  const cargarVoces = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const d = await api('POST', `${base}/elevenlabs-voices`, apiKey ? { apiKey } : {});
      setCatalogo(d.voces);
      setMsg({ ok: true, text: `${d.voces.length} voces disponibles en la cuenta de ElevenLabs.` });
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setBusy(false);
    }
  };

  const guardar = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const d = await api('PUT', base, { proveedor, elevenlabs: { apiKey: apiKey || undefined, modelId, voces } });
      setHasApiKey(d.ajustes.elevenlabs.hasApiKey);
      setApiKey('');
      setMsg({ ok: true, text: proveedor === 'ELEVENLABS' ? 'Voces de ElevenLabs guardadas para esta empresa.' : 'La empresa usa las voces de Gemini incluidas en el ERP.' });
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setBusy(false);
    }
  };

  const probar = async (personaId?: string) => {
    setBusy(true);
    setMsg(null);
    try {
      const d = await api('POST', `${base}/test`, { personaId });
      await new Audio(`data:${d.mimeType};base64,${d.audioBase64}`).play();
      setMsg({ ok: true, text: `Reproduciendo: ${d.detalle}` });
    } catch (e: any) {
      setMsg({ ok: false, text: `${e.message}. Guarde la configuración antes de probar.` });
    } finally {
      setBusy(false);
    }
  };

  const vozSelect = (key: string, etiqueta: string) => (
    <div key={key} className="flex items-center gap-2">
      <span className="w-48 shrink-0 text-slate-700 truncate" title={etiqueta}>
        {etiqueta}
      </span>
      {catalogo.length > 0 ? (
        <select className={input} value={voces[key] || ''} onChange={(e) => setVoces({ ...voces, [key]: e.target.value })}>
          <option value="">{key === 'default' ? 'Seleccione…' : '— Usar la voz por defecto —'}</option>
          {catalogo.map((v) => (
            <option key={v.voiceId} value={v.voiceId}>
              {v.nombre}
              {[v.genero, v.acento, v.idioma].filter(Boolean).length ? ` · ${[v.genero, v.acento, v.idioma].filter(Boolean).join(', ')}` : ''}
            </option>
          ))}
        </select>
      ) : (
        <input className={input} placeholder={key === 'default' ? 'voice_id' : 'voice_id (opcional)'} value={voces[key] || ''} onChange={(e) => setVoces({ ...voces, [key]: e.target.value.trim() })} />
      )}
      {proveedor === 'ELEVENLABS' && voces[key] && (
        <button type="button" disabled={busy} className="p-1.5 border border-slate-300 rounded" title="Probar esta voz" onClick={() => void probar(key === 'default' ? undefined : key)}>
          <Play className="w-3 h-3" />
        </button>
      )}
    </div>
  );

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4 text-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
            <Volume2 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-800 text-sm">Proveedor de voz de {empresaNombre}</h3>
            <p className="text-slate-500">
              Gemini viene incluido en el ERP. Si la empresa contrata ElevenLabs, registre su clave para usar voces más naturales; el consumo se cobra en la cuenta de ElevenLabs de la empresa.
            </p>
          </div>
        </div>
        {motor && (
          <span className={`px-2 py-1 rounded font-bold ${motor.motor === 'NAVEGADOR' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`} title={motor.aviso || motor.detalle}>
            Última voz: {motor.motor === 'NAVEGADOR' ? 'navegador (contingencia)' : motor.motor}
            {motor.detalle ? ` · ${motor.detalle}` : ''}
          </span>
        )}
      </div>

      <div className="flex gap-2">
        {(
          [
            ['GEMINI', 'Gemini (incluido)'],
            ['ELEVENLABS', 'ElevenLabs (cuenta de la empresa)'],
          ] as const
        ).map(([id, texto]) => (
          <button
            key={id}
            type="button"
            onClick={() => setProveedor(id)}
            className={`px-3 py-2 rounded-lg border font-bold ${proveedor === id ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}
          >
            {texto}
          </button>
        ))}
      </div>

      {proveedor === 'ELEVENLABS' && (
        <div className="space-y-3 border-t border-slate-100 pt-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={label}>Clave API de ElevenLabs</label>
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  className={input}
                  type="password"
                  autoComplete="off"
                  placeholder={hasApiKey ? 'Registrada en la bóveda (escriba para reemplazarla)' : 'xi-api-key de la cuenta de la empresa'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className={label}>Modelo</label>
              <select className={input} value={modelId} onChange={(e) => setModelId(e.target.value)}>
                {modelos.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" disabled={busy || (!hasApiKey && !apiKey)} className="px-3 py-1.5 border border-slate-300 rounded font-bold disabled:opacity-50" onClick={() => void cargarVoces()}>
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin inline" /> : null} Cargar voces de la cuenta
            </button>
            <span className="text-slate-500">Para Chile conviene elegir voces en español latinoamericano.</span>
          </div>
          <div className="space-y-1.5">
            {vozSelect('default', 'Voz por defecto (todos los agentes)')}
            {personas.map((p) => vozSelect(p.id, `${p.nombre} · ${p.cargo}`))}
          </div>
        </div>
      )}

      {msg && (
        <div className={`rounded px-3 py-2 flex items-center gap-2 ${msg.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>
          {msg.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />} {msg.text}
        </div>
      )}

      <div className="flex justify-end gap-2">
        {proveedor === 'ELEVENLABS' && (
          <button type="button" disabled={busy} className="px-3 py-1.5 border border-slate-300 rounded font-bold disabled:opacity-50" onClick={() => void probar()}>
            Probar voz guardada
          </button>
        )}
        <button type="button" disabled={busy} className="px-3 py-1.5 bg-indigo-600 text-white rounded font-bold disabled:opacity-50" onClick={() => void guardar()}>
          Guardar proveedor de voz
        </button>
      </div>
    </div>
  );
};
