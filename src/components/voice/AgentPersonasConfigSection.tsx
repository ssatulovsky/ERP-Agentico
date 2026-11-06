import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Volume2, 
  Play, 
  RotateCcw, 
  Check, 
  Sliders, 
  MessageSquare, 
  Sparkles, 
  ShieldCheck, 
  Radio, 
  Mic, 
  Edit3,
  Bot,
  Download,
  RefreshCw
} from 'lucide-react';

interface PiperVoiceItem {
  id: string;
  name: string;
  lang: string;
  gender: 'FEMENINO' | 'MASCULINO';
  quality: 'high' | 'medium' | 'low' | 'x_low';
  region: string;
  description: string;
  sampleSentence: string;
  isInstalled?: boolean;
  fileSizeMb?: number;
}

const DEFAULT_PIPER_VOICES: PiperVoiceItem[] = [
  {
    id: 'es_AR-daniela-high',
    name: 'Vera / Daniela High (Femenina Ejecutiva 22kHz)',
    lang: 'es-AR',
    gender: 'FEMENINO',
    quality: 'high',
    region: 'Argentina / Latam',
    description: 'Voz femenina de alta fidelidad (22kHz), cálida, ejecutiva y sumamente natural.',
    sampleSentence: 'Hola socio, tengo las proyecciones de flujo de caja y compromisos bancarios listos para revisar.',
  },
  {
    id: 'es_MX-ald-medium',
    name: 'Sofía / Camila / Ald Medium (Femenina Neutra)',
    lang: 'es-MX',
    gender: 'FEMENINO',
    quality: 'medium',
    region: 'México / Latam',
    description: 'Voz femenina hispana neutra, ágil y de baja latencia.',
    sampleSentence: 'Conciliación bancaria procesada con éxito en las cuentas de la empresa.',
  },
  {
    id: 'es_MX-ald-x_low',
    name: 'Ald Ultrarrápida (Femenina x_low Ligera)',
    lang: 'es-MX',
    gender: 'FEMENINO',
    quality: 'x_low',
    region: 'México / Latam',
    description: 'Voz femenina ultraligera (~16MB), consumo mínimo de CPU.',
    sampleSentence: 'Órdenes de compra y facturas procesadas en el sistema.',
  },
  {
    id: 'es_MX-claude-high',
    name: 'Claude Consultor Directivo (Masculina High 22kHz)',
    lang: 'es-MX',
    gender: 'MASCULINO',
    quality: 'high',
    region: 'México / Latam',
    description: 'Voz masculina de alta definición (22kHz), dicción impecable y porte corporativo.',
    sampleSentence: 'Hemos completado la revisión fiscal y la proyección del estado de resultados del trimestre.',
  },
  {
    id: 'es_ES-sharvard-medium',
    name: 'Rodrigo / Tomás / Sharvard Medium (Masculina Sobria)',
    lang: 'es-ES',
    gender: 'MASCULINO',
    quality: 'medium',
    region: 'España',
    description: 'Voz masculina sobria, profesional y pausada.',
    sampleSentence: 'Los asientos del Libro Diario y el cálculo de impuestos se encuentran cuadrados y sellados.',
  },
  {
    id: 'es_ES-davefx-medium',
    name: 'Matías / Juan Pablo / Davefx Medium (Masculina Barítono)',
    lang: 'es-ES',
    gender: 'MASCULINO',
    quality: 'medium',
    region: 'España',
    description: 'Voz masculina sobria, profesional y con excelente articulación.',
    sampleSentence: 'El saldo oficial en bancos y la emisión de facturas electrónicas están sincronizados.',
  },
  {
    id: 'es_ES-carlfm-x_low',
    name: 'Ignacio / Carlfm x_low (Masculina Ultrarrápida)',
    lang: 'es-ES',
    gender: 'MASCULINO',
    quality: 'x_low',
    region: 'España',
    description: 'Voz masculina ultraligera y rápida, optimizada para mínima latencia.',
    sampleSentence: 'Stock de materias primas y órdenes de producción verificadas en bodega.',
  },
  {
    id: 'es_ES-mls_10246-low',
    name: 'Elena / MLS 10246 (Femenina Low Ligera)',
    lang: 'es-ES',
    gender: 'FEMENINO',
    quality: 'low',
    region: 'España',
    description: 'Voz femenina natural basada en corpus MLS, ligera y fluida.',
    sampleSentence: 'Informe de remuneraciones e imposiciones listo para su aprobación.',
  },
  {
    id: 'es_ES-mls_9972-low',
    name: 'Gonzalo / MLS 9972 (Masculina Low Ligera)',
    lang: 'es-ES',
    gender: 'MASCULINO',
    quality: 'low',
    region: 'España',
    description: 'Voz masculina ligera basada en corpus MLS, rápida y clara.',
    sampleSentence: 'Verificación de existencias y pedidos de compra actualizados.',
  },
];
import { AgentPersona, AgentGender } from '../../types/agentPersona';
import { agentPersonasStorage } from '../../services/agentPersonasStorage';
import { voiceAssistantEngine, detectVoiceGender } from '../../services/voiceAssistantEngine';

interface AgentPersonasConfigSectionProps {
  activeClientId: string;
  clientName: string;
  onOpenVoiceDialogue?: (personaId?: string) => void;
}

export const AgentPersonasConfigSection: React.FC<AgentPersonasConfigSectionProps> = ({
  activeClientId,
  clientName,
  onOpenVoiceDialogue,
}) => {
  const [personas, setPersonas] = useState<AgentPersona[]>(() => 
    agentPersonasStorage.getPersonas(activeClientId)
  );
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [playingPersonaId, setPlayingPersonaId] = useState<string | null>(null);
  const [savedNotification, setSavedNotification] = useState<string | null>(null);
  const [piperVoices, setPiperVoices] = useState<PiperVoiceItem[]>(DEFAULT_PIPER_VOICES);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [downloadProgressMsg, setDownloadProgressMsg] = useState<string | null>(null);

  const fetchPiperVoices = async () => {
    try {
      const res = await fetch('/api/voice/piper-voices');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          setPiperVoices(data.data);
        }
      }
    } catch {}
  };

  useEffect(() => {
    fetchPiperVoices();
  }, []);

  const handleDownloadAllVoices = async () => {
    setIsDownloadingAll(true);
    setDownloadProgressMsg('Iniciando descarga de las 9 voces desde Hugging Face... Aguarde unos instantes.');
    try {
      const res = await fetch('/api/voice/download-all', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setDownloadProgressMsg('¡Descarga completada con éxito! Todas las voces en español están disponibles en el servidor.');
        await fetchPiperVoices();
      } else {
        setDownloadProgressMsg(`Aviso: ${data.error || 'Verifique conexión en VPS'}`);
      }
    } catch {
      setDownloadProgressMsg('Error al conectar con la API de descarga del servidor.');
    } finally {
      setIsDownloadingAll(false);
      setTimeout(() => setDownloadProgressMsg(null), 6000);
    }
  };

  // Cargar voces del navegador
  useEffect(() => {
    const updateVoices = () => {
      const v = voiceAssistantEngine.getAllVoices();
      setAvailableVoices(v);
    };

    updateVoices();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, []);

  // Cargar personas cuando cambia el cliente
  useEffect(() => {
    setPersonas(agentPersonasStorage.getPersonas(activeClientId));
  }, [activeClientId]);

  // Actualizar campo de una persona
  const handleUpdateField = (id: string, field: keyof AgentPersona, value: any) => {
    const updated = personas.map(p => {
      if (p.id === id) {
        return { ...p, [field]: value };
      }
      return p;
    });
    setPersonas(updated);
    agentPersonasStorage.saveAllPersonas(activeClientId, updated);
    triggerSaveToast('Cambios guardados correctamente');
  };

  // Actualizar configuración de voz
  const handleUpdateVoiceConfig = (id: string, key: string, value: any) => {
    const updated = personas.map(p => {
      if (p.id === id) {
        return {
          ...p,
          voz: {
            ...p.voz,
            [key]: value,
          },
        };
      }
      return p;
    });
    setPersonas(updated);
    agentPersonasStorage.saveAllPersonas(activeClientId, updated);
    triggerSaveToast('Voz configurada y guardada');
  };

  const triggerSaveToast = (msg: string) => {
    setSavedNotification(msg);
    setTimeout(() => {
      setSavedNotification(null);
    }, 2500);
  };

  // Probar voz de la persona
  const handleTestVoice = (persona: AgentPersona) => {
    setPlayingPersonaId(persona.id);
    const textToSpeak = `Hola, soy ${persona.nombre}, ${persona.cargo} de ${clientName}. Mi voz, tono y velocidad han sido configurados correctamente.`;
    
    voiceAssistantEngine.speak(textToSpeak, persona, {
      onEnd: () => setPlayingPersonaId(null),
      onError: () => setPlayingPersonaId(null),
    });
  };

  // Restaurar valores por defecto
  const handleResetDefaults = () => {
    if (window.confirm('¿Deseas restaurar los nombres, géneros y voces originales de los agentes a los valores iniciales?')) {
      const def = agentPersonasStorage.resetToDefaults(activeClientId);
      setPersonas(def);
      triggerSaveToast('Personas restablecidas a valores por defecto');
    }
  };

  // Filtrar voces en español para el selector, pero incluir todas si no hay
  const spanishVoices = availableVoices.filter(v => v.lang.toLowerCase().startsWith('es'));
  const voicesToShow = spanishVoices.length > 0 ? spanishVoices : availableVoices;

  return (
    <div className="space-y-6">
      {/* Header del Panel de Personas */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-indigo-400" />
                Equipo Ejecutivo de IA Humanizado
              </span>
              <span className="text-xs text-slate-400">• Empresa: {clientName}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
              Personas a Cargo & Configuración de Voces
            </h2>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Transforma los módulos en <strong>jefaturas humanas responsables</strong>. Personaliza el nombre, sexo y voz del sistema para cada área. El dueño y el contador pueden dialogar directamente por voz con cada persona a cargo.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {onOpenVoiceDialogue && (
              <button
                type="button"
                onClick={() => onOpenVoiceDialogue()}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 transition-all flex items-center gap-2 cursor-pointer"
              >
                <Mic className="w-4 h-4 animate-pulse" />
                <span>Iniciar Diálogo por Voz</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleResetDefaults}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Restablecer nombres y voces por defecto"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restablecer</span>
            </button>
          </div>
        </div>

        {/* Notificación flotante de guardado */}
        {savedNotification && (
          <div className="mt-4 px-3.5 py-1.5 bg-emerald-500/20 border border-emerald-500/40 rounded-lg text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-200 w-fit">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>{savedNotification}</span>
          </div>
        )}

        {/* Banner de Estado de Voces Piper en el Servidor */}
        <div className="mt-4 pt-3 border-t border-indigo-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-teal-400 shrink-0" />
            <span>
              Catálogo de Voces Piper en Español (Hugging Face):{' '}
              <strong className="text-teal-300 font-mono">
                {piperVoices.filter(v => v.isInstalled).length > 0
                  ? `${piperVoices.filter(v => v.isInstalled).length}/${piperVoices.length} instaladas en el VPS`
                  : '1 instalada (sharvard-medium)'}
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              disabled={isDownloadingAll}
              onClick={handleDownloadAllVoices}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                isDownloadingAll
                  ? 'bg-amber-600 text-white cursor-wait'
                  : 'bg-teal-600 hover:bg-teal-500 text-white'
              }`}
              title="Descargar automáticamente todas las 9 voces de Hugging Face en /opt/agentic/piper"
            >
              {isDownloadingAll ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>{isDownloadingAll ? 'Descargando...' : 'Descargar Todas las Voces en Servidor'}</span>
            </button>
          </div>
        </div>

        {downloadProgressMsg && (
          <div className="mt-2.5 px-3 py-1.5 rounded-lg bg-teal-900/60 border border-teal-500/40 text-teal-200 text-xs font-medium flex items-center gap-2 animate-in fade-in">
            <Sparkles className="w-3.5 h-3.5 text-teal-400 shrink-0" />
            <span>{downloadProgressMsg}</span>
          </div>
        )}
      </div>

      {/* Grid de Personas a Cargo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
        {personas.map(persona => {
          const isPlaying = playingPersonaId === persona.id;

          return (
            <div
              key={persona.id}
              className="bg-white border border-slate-200 hover:border-indigo-300 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
            >
              {/* Header de la tarjeta */}
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-extrabold text-base shadow-sm shrink-0 ${persona.avatarBg}`}
                      style={{ backgroundColor: persona.color }}
                    >
                      {persona.nombre
                        .split(' ')
                        .map(n => n[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()}
                    </div>
                    <div>
                      <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
                        {persona.area}
                      </div>
                      <h3 className="font-bold text-slate-900 text-base leading-tight">
                        {persona.nombre}
                      </h3>
                      <p className="text-xs text-slate-500 font-medium">
                        {persona.cargo}
                      </p>
                    </div>
                  </div>

                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    En línea
                  </span>
                </div>

                <p className="text-xs text-slate-600 line-clamp-2 mb-4 bg-slate-50 p-2.5 rounded-lg border border-slate-100 italic">
                  "{persona.saludoPersonal}"
                </p>

                {/* Formulario de Configuración de la Persona */}
                <div className="space-y-3 border-t border-slate-100 pt-3 text-xs">
                  {/* Edición de Nombre y Sexo */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Nombre de la Persona
                      </label>
                      <input
                        type="text"
                        value={persona.nombre}
                        onChange={e => handleUpdateField(persona.id, 'nombre', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                        placeholder="Ej: Camila Valenzuela"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Sexo / Género
                      </label>
                      <select
                        value={persona.sexo}
                        onChange={e => handleUpdateField(persona.id, 'sexo', e.target.value as AgentGender)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:ring-1 focus:ring-indigo-500 focus:outline-hidden cursor-pointer"
                      >
                        <option value="FEMENINO">Femenino (Jefa)</option>
                        <option value="MASCULINO">Masculino (Jefe)</option>
                        <option value="NEUTRO">Neutro</option>
                      </select>
                    </div>
                  </div>

                  {/* Selector de Motor de Voz (Piper Neural TTS vs Navegador) */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                        Motor de Voz de Síntesis
                      </span>
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-teal-100 text-teal-800 border border-teal-200">
                        {persona.voz.neuralModel === 'browser' ? 'Nativo' : (persona.voz.neuralModel === 'piper' ? 'Neural VITS' : 'Gemini HD')}
                      </span>
                    </label>
                    <select
                      value={persona.voz.neuralModel || 'gemini'}
                      onChange={e => handleUpdateVoiceConfig(persona.id, 'neuralModel', e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-semibold focus:ring-1 focus:ring-teal-500 focus:outline-hidden cursor-pointer"
                    >
                      <option value="gemini">🌟 Gemini Ultra-Natural HD (Locutor Humano en Tiempo Real)</option>
                      <option value="piper">✨ Piper Neural TTS (Modelo Humano VITS en Español)</option>
                      <option value="browser">🔊 Síntesis Nativa del Navegador (Web Speech API)</option>
                    </select>
                  </div>

                  {/* Selector según el Motor Elegido */}
                  {(persona.voz.neuralModel || 'gemini') === 'gemini' ? (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Voz Gemini Ultra-Natural en Español
                      </label>
                      <select
                        value={persona.voz.geminiVoiceName || (persona.sexo === 'MASCULINO' ? 'Fenrir' : 'Aoede')}
                        onChange={e => handleUpdateVoiceConfig(persona.id, 'geminiVoiceName', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:ring-1 focus:ring-teal-500 focus:outline-hidden cursor-pointer"
                      >
                        <optgroup label="👩 Voces Femeninas Naturales (Alta Fidelidad)">
                          <option value="Aoede">Aoede — Ejecutiva, fluida y empática (Vera Albornoz)</option>
                          <option value="Kore">Kore — Analítica, metódica y precisa (Camila Valenzuela)</option>
                        </optgroup>
                        <optgroup label="👨 Voces Masculinas Naturales (Alta Fidelidad)">
                          <option value="Fenrir">Fenrir — Barítono formal y autoritativo (Jorge Silva / Tributario)</option>
                          <option value="Puck">Puck — Dinámico, comercial y ágil (Esteban Morales / Compras)</option>
                          <option value="Charon">Charon — Grave, analítico y profundo (Roberto Lagos / Costos)</option>
                        </optgroup>
                      </select>
                      <p className="text-[10px] text-teal-700 mt-1 font-medium flex items-center gap-1">
                        <Check className="w-3 h-3 text-teal-600" />
                        Voz neuronal ultra-realista con cadencia, pausas y modulación humana profesional.
                      </p>
                    </div>
                  ) : persona.voz.neuralModel === 'piper' ? (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Modelo Piper Neural en Español
                      </label>
                      <select
                        value={persona.voz.piperVoiceId || (persona.sexo === 'MASCULINO' ? 'es_ES-davefx-medium' : 'es_AR-daniela-high')}
                        onChange={e => handleUpdateVoiceConfig(persona.id, 'piperVoiceId', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:ring-1 focus:ring-teal-500 focus:outline-hidden cursor-pointer"
                      >
                        <optgroup label="👩 Voces Femeninas (Vera, Camila, Auditoría, RRHH)">
                          {piperVoices.filter(v => v.gender === 'FEMENINO').map(v => (
                            <option key={v.id} value={v.id}>
                              {v.name} {v.isInstalled ? '✓' : ''} ({v.region})
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="👨 Voces Masculinas (Dirección, Costos, Tributario, Bodega)">
                          {piperVoices.filter(v => v.gender === 'MASCULINO').map(v => (
                            <option key={v.id} value={v.id}>
                              {v.name} {v.isInstalled ? '✓' : ''} ({v.region})
                            </option>
                          ))}
                        </optgroup>
                      </select>
                      <p className="text-[10px] text-teal-700 mt-1 font-medium flex items-center gap-1">
                        <Check className="w-3 h-3 text-teal-600" />
                        Voz neural local VITS sin conexión a internet.
                      </p>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center justify-between">
                        <span>Voz del Sistema (TTS)</span>
                        <span className="text-[10px] text-slate-400 font-normal">
                          {voicesToShow.length} voces detectadas
                        </span>
                      </label>
                      <select
                        value={persona.voz.voiceURI || ''}
                        onChange={e => handleUpdateVoiceConfig(persona.id, 'voiceURI', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:ring-1 focus:ring-indigo-500 focus:outline-hidden cursor-pointer"
                      >
                        <option value="">
                          Asignación automática ({persona.sexo === 'MASCULINO' ? '👨 Masculina' : '👩 Femenina'})
                        </option>
                        {voicesToShow.map((v, idx) => {
                          const gender = detectVoiceGender(v);
                          const genderTag = gender === 'MALE' ? '👨 [Masc]' : gender === 'FEMALE' ? '👩 [Fem]' : '⚪ [Auto]';
                          return (
                            <option key={`${v.voiceURI}-${idx}`} value={v.voiceURI || v.name}>
                              {genderTag} {v.name} ({v.lang})
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  )}

                  {/* Sliders de Tono (Pitch) y Velocidad (Rate) */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <div className="flex items-center justify-between text-[10px] text-slate-600 mb-1">
                        <span>Tono (Pitch)</span>
                        <span className="font-mono font-bold text-indigo-600">{persona.voz.pitch.toFixed(2)}</span>
                      </div>
                      <input
                        type="range"
                        min="0.45"
                        max="1.50"
                        step="0.02"
                        value={persona.voz.pitch}
                        onChange={e => handleUpdateVoiceConfig(persona.id, 'pitch', parseFloat(e.target.value))}
                        className="w-full accent-indigo-600 cursor-pointer"
                      />
                      <div className="flex justify-between text-[9px] text-slate-400">
                        <span>Grave / Barítono (0.45)</span>
                        <span>Agudo (1.50)</span>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-[10px] text-slate-600 mb-1">
                        <span>Velocidad (Rate)</span>
                        <span className="font-mono font-bold text-indigo-600">{persona.voz.rate.toFixed(2)}x</span>
                      </div>
                      <input
                        type="range"
                        min="0.75"
                        max="1.30"
                        step="0.02"
                        value={persona.voz.rate}
                        onChange={e => handleUpdateVoiceConfig(persona.id, 'rate', parseFloat(e.target.value))}
                        className="w-full accent-indigo-600 cursor-pointer"
                      />
                      <div className="flex justify-between text-[9px] text-slate-400">
                        <span>Lento (0.75x)</span>
                        <span>Rápido (1.30x)</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Botones de Acción de la Persona */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => handleTestVoice(persona)}
                  className={`flex-1 px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    isPlaying
                      ? 'bg-amber-100 text-amber-900 border border-amber-300 animate-pulse'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                  }`}
                  title="Escuchar prueba de voz"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>{isPlaying ? 'Reproduciendo...' : 'Probar Voz'}</span>
                </button>

                {onOpenVoiceDialogue && (
                  <button
                    type="button"
                    onClick={() => onOpenVoiceDialogue(persona.id)}
                    className="flex-1 px-3 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    title={`Iniciar diálogo directo con ${persona.nombre}`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Dialogar</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
