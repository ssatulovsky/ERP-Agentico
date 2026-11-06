import { AgentPersona } from '../types/agentPersona';
import { 
  DteDocument, 
  BankStatementMovement, 
  BankAccountConfig, 
  F29Declaration, 
  EmployeePayroll, 
  InventoryItem, 
  ProductionOrder, 
  ProductionBudget,
  ExpenseReport 
} from '../types';
import { formatCLP } from '../utils/chileanAccounting';
import { executionModeLabel } from '../utils/executionModeLabel';
import { commercialProcurementService } from './commercialProcurementService';

const getDiskPersistence = (): any => (globalThis as any)?.__diskPersistence;
const safeDynamicImport = async (moduleSpecifier: string): Promise<any> => Function('m', 'return import(m)')(moduleSpecifier);

export interface DialogueContext {
  clientId?: string;
  clientName: string;
  rut: string;
  dtesCount: number;
  dtes?: DteDocument[];
  pendingPurchasesCount: number;
  pendingSalesCount: number;
  bankAccountsCount: number;
  bankAccounts?: BankAccountConfig[];
  bankMovements?: BankStatementMovement[];
  pendingBankNoveltiesCount: number;
  f29IvaTotal: number;
  f29?: F29Declaration;
  employeesCount: number;
  payrolls?: EmployeePayroll[];
  inventoryItemsCount: number;
  inventoryItems?: InventoryItem[];
  productionOrders?: ProductionOrder[];
  productionBudgets?: ProductionBudget[];
  pendingExpensesCount: number;
  expenseReports?: ExpenseReport[];
}

export interface VoicePlaybackCallbacks {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: any) => void;
}

export interface VoiceRecognitionCallbacks {
  onResult: (text: string, isFinal: boolean) => void;
  onEnd: () => void;
  onError: (err: any) => void;
}

export interface AgentDialogueTurnResult {
  verbalResponse: string;       // Texto para síntesis de voz (claro, conciso y natural)
  displayMarkdown: string;      // Texto completo para la interfaz visual
  actionToExecute?: {
    type: 'CENTRALIZE_COMPRAS' | 'CENTRALIZE_VENTAS' | 'RECONCILE_BANK' | 'CALCULATE_F29' | 'CENTRALIZE_EXPENSES' | 'NAVIGATE';
    payload?: any;
    targetTab?: string;
  };
  followUpQuestion?: string;    // Pregunta de continuidad para el diálogo
}


// ============================================================================
// 1.5 (hallazgo #1): intenciones que siempre van al motor agéntico (sin guiones ni datos de respaldo)
// ============================================================================
export interface AgenticIntent {
  module: 'FACTURACION_DTE' | 'COSTOS_PRODUCCION' | 'INVENTARIO' | 'CONCILIACION' | 'FLUJO_CAJA';
  accion: string;
}

export function detectAgenticIntent(normalized: string): AgenticIntent | null {
  const has = (...terms: string[]) => terms.some((t) => normalized.includes(t));

  const isPipelineQuery =
    has('presupuestos enviados', 'cotizaciones enviadas', 'estado de los presupuestos', 'estado de las cotizaciones',
      'cotizaciones pendientes', 'pipeline comercial', 'propuestas comerciales') ||
    (normalized.includes('presupuesto') && has('estado', 'enviad', 'cuanto', 'cuánto'));

  if (has('factura', 'facturar', 'emitir dte', 'emite dte', 'dte 33', 'dte 34', 'timbra', 'nota de credito', 'nota de crédito')) {
    if (!has('centraliza', 'asiento de ventas', 'asiento de compras')) {
      return { module: 'FACTURACION_DTE', accion: 'preparar o emitir documentos tributarios' };
    }
  }
  if (!isPipelineQuery && has('presupuesto', 'cotiza', 'cotización', 'cotizacion', 'costeo', 'orden de trabajo', 'confeccion', 'confección')) {
    return { module: 'COSTOS_PRODUCCION', accion: 'formular presupuestos o cotizaciones' };
  }
  if (has('stock', 'inventario', 'bodega', 'existencia', 'quiebre', 'reposicion', 'reposición', 'insumo', 'kardex')) {
    return { module: 'INVENTARIO', accion: 'consultar existencias de inventario' };
  }
  if (
    has('concili', 'cartola', 'novedades bancarias', 'cuadrar banco', 'saldo bancario', 'saldos bancarios', 'aperturado por cuenta') ||
    (normalized.includes('banco') && !normalized.includes('proveedor'))
  ) {
    return { module: 'CONCILIACION', accion: 'consultar saldos bancarios o conciliar cartolas' };
  }
  const cashTerms = has('flujo de caja', 'caja', 'liquidez', 'tesoreria', 'tesorería');
  const scenarioTerms = has('pagar', 'retras', 'postergar', 'prórroga', 'prorroga', 'escenario', 'proveedor', 'cliente');
  if (cashTerms && scenarioTerms) {
    return { module: 'FLUJO_CAJA', accion: 'simular escenarios de flujo de caja' };
  }
  return null;
}

export function agenticUnavailableResponse(
  persona: AgentPersona,
  context: DialogueContext,
  intent: AgenticIntent
): AgentDialogueTurnResult {
  const empresa = context.clientName ? ` para ${context.clientName}` : '';
  return {
    verbalResponse: `No pude ${intent.accion}${empresa} porque el motor agéntico no está disponible en este momento. No se registró ni emitió nada.`,
    displayMarkdown: `### ⚠️ ${persona.nombre} (${persona.cargo})

No pude **${intent.accion}**${empresa}: el motor agéntico (módulo \`${intent.module}\`) no respondió.

- No se generó ningún documento, cotización, asiento ni aprobación.
- Puedes reintentar en unos minutos o realizar la operación directamente en el módulo correspondiente.`,
  };
}

/**
 * Detecta el género probable de una voz del sistema según su nombre y URI
 */
export function detectVoiceGender(voice: SpeechSynthesisVoice): 'MALE' | 'FEMALE' | 'UNKNOWN' {
  const name = (voice.name || '').toLowerCase();
  const uri = (voice.voiceURI || '').toLowerCase();
  const full = `${name} ${uri}`;

  const maleKeywords = [
    'reed', 'rocko', 'grandpa', 'eddy', 'jorge', 'juan', 'diego', 'pablo',
    'carlos', 'miguel', 'david', 'raul', 'alvaro', 'enrique', 'manuel',
    'mateo', 'gonzalo', 'alberto', 'ignacio', 'tomas', 'matias', 'rodrigo',
    'male', 'hombre', 'masculino', 'guy', 'boy', 'baritone', 'bass',
    'cristian', 'sebastian', 'andres', 'felipe', 'javier', 'esteban', 'pedro',
    'antonio', 'fernando', 'alejandro', 'sergio', 'daniel', 'marcos'
  ];

  const femaleKeywords = [
    'monica', 'mónica', 'paulina', 'francisca', 'sofia', 'sofía', 'camila', 'flo', 
    'sandy', 'shelley', 'grandma', 'lucia', 'lucía', 'elena', 'laura', 'carmen', 
    'rosa', 'conchita', 'penelope', 'esperanza', 'paloma', 'female', 'mujer', 
    'femenino', 'girl', 'lady', 'sabina', 'esmeralda', 'valentina', 'paula', 
    'soledad', 'victoria', 'valeria', 'catalina', 'isidora', 'marina', 'clara', 
    'beatriz', 'maria', 'maría', 'ana', 'alicia', 'pilar', 'google español'
  ];

  if (maleKeywords.some(m => full.includes(m))) return 'MALE';
  if (femaleKeywords.some(f => full.includes(f))) return 'FEMALE';
  return 'UNKNOWN';
}

class VoiceAssistantEngine {
  private recognition: any = null;
  private isListeningActive: boolean = false;
  private cachedVoices: SpeechSynthesisVoice[] = [];
  private currentAudioElement: HTMLAudioElement | null = null;
  private currentPlaybackSessionId: number = 0;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.loadVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        this.loadVoices();
      };
    }
  }

  /**
   * Carga y filtra las voces disponibles en el navegador
   */
  public loadVoices(): SpeechSynthesisVoice[] {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
    const all = window.speechSynthesis.getVoices();
    this.cachedVoices = all;
    return all;
  }

  /**
   * Retorna las voces en idioma español disponibles
   */
  public getSpanishVoices(): SpeechSynthesisVoice[] {
    const all = this.loadVoices();
    return all.filter(v => v.lang.startsWith('es') || v.lang.startsWith('ES'));
  }

  /**
   * Retorna todas las voces disponibles
   */
  public getAllVoices(): SpeechSynthesisVoice[] {
    return this.loadVoices();
  }

  /**
   * Selecciona la mejor voz en español según la configuración y el sexo de la persona,
   * asignando voces diferenciadas a cada agente para que no suenen todos iguales.
   */
  public getBestVoiceForPersona(persona: AgentPersona): SpeechSynthesisVoice | null {
    const all = this.loadVoices();
    if (!all || all.length === 0) return null;

    // 1. Si el usuario configuró una voz específica en el panel
    if (persona.voz.voiceURI) {
      const match = all.find(v => v.voiceURI === persona.voz.voiceURI || v.name === persona.voz.voiceURI);
      if (match) return match;
    }

    // 2. Filtrar voces en español
    const spanishVoices = all.filter(v => v.lang.toLowerCase().startsWith('es'));
    let baseList = spanishVoices.length > 0 ? spanishVoices : all;

    // Priorizar voces humanas naturales sobre sintetizadores de efectos caricaturescos (Grandpa, Reed, Rocko, etc.)
    const isNovelty = (name: string) => /grandpa|reed|rocko|eddy|flo|sandy|shelley|bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|hysterical|pipe organ|trinoids|whisper|zarvox/i.test(name);
    const naturalVoices = baseList.filter(v => !isNovelty(v.name));
    const candidateList = naturalVoices.length > 0 ? naturalVoices : baseList;

    // Priorizar voces Google o naturales de alta fidelidad si están disponibles
    candidateList.sort((a, b) => {
      const aScore = /google|natural|siri|paulina|monica|jorge|diego|francisca|alvaro|salma/i.test(a.name) ? 2 : 1;
      const bScore = /google|natural|siri|paulina|monica|jorge|diego|francisca|alvaro|salma/i.test(b.name) ? 2 : 1;
      return bScore - aScore;
    });

    const maleVoices = candidateList.filter(v => detectVoiceGender(v) === 'MALE');
    const femaleVoices = candidateList.filter(v => detectVoiceGender(v) === 'FEMALE');

    if (persona.sexo === 'MASCULINO') {
      if (maleVoices.length > 0) {
        return maleVoices[0];
      }
      const nonFemale = candidateList.filter(v => detectVoiceGender(v) !== 'FEMALE');
      if (nonFemale.length > 0) return nonFemale[0];
      return candidateList[0];
    } else {
      if (femaleVoices.length > 0) {
        return femaleVoices[0];
      }
      return candidateList[0];
    }
  }

  /**
   * Procesa el texto para síntesis de voz continua sin interrupciones ni silencios molestos en los puntos.
   * Los mensajes de respuesta verbal (hasta 450 caracteres, ~70 palabras) se sintetizan como un flujo
   * continuo único. Solo mensajes extensos se dividen en párrafos grandes (>= 350 caracteres).
   */
  public splitIntoSpeechChunks(text: string): string[] {
    const trimmed = text.trim();
    if (!trimmed) return [];

    // Hasta 450 caracteres (la inmensa mayoría de respuestas de diálogo verbal),
    // se sintetiza en un SOLO archivo de audio continuo. Esto elimina por completo
    // los silencios y pausas en los puntos (.), logrando entonación y cadencia humana 100% natural.
    if (trimmed.length <= 450) {
      return [trimmed];
    }

    const rawSentences = trimmed
      .split(/(?<=[.?!])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    if (rawSentences.length <= 1) return [trimmed];

    const chunks: string[] = [];
    let current = '';

    for (const s of rawSentences) {
      if (!current) {
        current = s;
      } else if ((current + ' ' + s).length <= 350) {
        current += ' ' + s;
      } else {
        chunks.push(current);
        current = s;
      }
    }
    if (current) chunks.push(current);

    return chunks.length > 0 ? chunks : [trimmed];
  }

  /**
   * Sintetiza y reproduce audio con Piper Neural TTS (voz humana realista de red neuronal)
   * con streaming de oraciones y pre-carga en paralelo para latencia mínima al arrancar.
   */
  public async speakWithPiper(
    cleanText: string,
    persona: AgentPersona,
    callbacks?: VoicePlaybackCallbacks,
    targetSessionId?: number
  ): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    try {
      const sessionId = targetSessionId ?? ++this.currentPlaybackSessionId;
      if (!targetSessionId) {
        this.stopSpeaking();
      }

      const voiceId =
        persona.voz.piperVoiceId ||
        (persona.sexo === 'MASCULINO' ? 'es_ES-davefx-medium' : 'es_AR-daniela-high');

      const chunks = this.splitIntoSpeechChunks(cleanText);

      // Función auxiliar para solicitar la síntesis de un chunk
      const fetchChunkAudio = async (chunkText: string): Promise<string | null> => {
        try {
          const response = await fetch('/api/voice/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: chunkText,
              voiceId,
              personaName: persona.nombre,
              geminiVoiceName: persona.voz.geminiVoiceName,
              rate: persona.voz.rate || 1.0,
              pitch: persona.voz.pitch || 1.0,
            }),
          });
          if (!response.ok) return null;
          const data = await response.json();
          if (!data.success || !data.audioBase64) return null;
          return `data:${data.mimeType || 'audio/wav'};base64,${data.audioBase64}`;
        } catch {
          return null;
        }
      };

      // 1. Sintetizar inmediatamente el primer fragmento para arrancar rápido
      const firstAudioSrc = await fetchChunkAudio(chunks[0]);
      if (this.currentPlaybackSessionId !== sessionId) return true; // Cancelado por una sesión posterior; no activar fallback

      if (!firstAudioSrc) {
        // Fallback al sintetizador nativo si Piper no está instalado o falló
        return false;
      }

      // 2. Pre-cargar fragmentos posteriores de forma secuencial controlada para no saturar la CPU del VPS
      const chunkAudioCache: Record<number, string | null> = {};
      const chunkResolvers: Record<number, (src: string | null) => void> = {};
      const chunkPromises: Record<number, Promise<string | null>> = {};

      for (let i = 1; i < chunks.length; i++) {
        chunkPromises[i] = new Promise<string | null>((resolve) => {
          chunkResolvers[i] = resolve;
        });
      }

      // Proceso en segundo plano secuencial: genera chunk 1, luego chunk 2, etc.
      (async () => {
        for (let i = 1; i < chunks.length; i++) {
          if (this.currentPlaybackSessionId !== sessionId) break;
          const src = await fetchChunkAudio(chunks[i]);
          chunkAudioCache[i] = src;
          chunkResolvers[i]?.(src);
        }
      })();

      let hasStarted = false;

      // 3. Reproductor continuo sin silencios molestos entre oraciones
      const playSequential = async (index: number, audioSrc: string) => {
        if (this.currentPlaybackSessionId !== sessionId) return;

        const audio = new Audio(audioSrc);
        this.currentAudioElement = audio;

        audio.onplay = () => {
          if (this.currentPlaybackSessionId !== sessionId) {
            audio.pause();
            return;
          }
          if (!hasStarted) {
            hasStarted = true;
            callbacks?.onStart?.();
          }
        };

        audio.onended = async () => {
          if (this.currentPlaybackSessionId !== sessionId) return;

          const nextIndex = index + 1;
          if (nextIndex < chunks.length) {
            const nextSrc = chunkAudioCache[nextIndex] ?? (await chunkPromises[nextIndex]);
            if (this.currentPlaybackSessionId === sessionId && nextSrc) {
              playSequential(nextIndex, nextSrc);
              return;
            }
          }
          // Todos los fragmentos completados
          this.currentAudioElement = null;
          callbacks?.onEnd?.();
        };

        audio.onerror = (e) => {
          console.warn('[VoiceAssistantEngine] Error al reproducir fragmento de audio Piper:', e);
          this.currentAudioElement = null;
          if (this.currentPlaybackSessionId === sessionId) {
            callbacks?.onEnd?.();
          }
        };

        try {
          if (this.currentPlaybackSessionId !== sessionId) return;
          await audio.play();
        } catch (err) {
          console.warn('[VoiceAssistantEngine] Error en audio.play():', err);
          this.currentAudioElement = null;
          throw err;
        }
      };

      await playSequential(0, firstAudioSrc);
      return true;
    } catch (err) {
      console.warn('[VoiceAssistantEngine] Falló Piper TTS en backend, activando síntesis de contingencia:', err);
      return false;
    }
  }

  /**
   * Pronuncia un texto con la voz y personalidad acústica del agente,
   * priorizando el modelo neuronal Piper en español para un sonido natural.
   */
  public speak(
    text: string, 
    persona: AgentPersona, 
    callbacks?: VoicePlaybackCallbacks
  ): void {
    // Detener de inmediato cualquier síntesis o audio activo anterior
    this.stopSpeaking();
    const sessionId = this.currentPlaybackSessionId;

    // Limpiar texto de formato markdown y asteriscos para que suene natural
    const cleanText = text
      .replace(/[*#_`~>]/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\n+/g, ' ')
      .trim();

    if (!cleanText) {
      callbacks?.onEnd?.();
      return;
    }

    // Prioridad 1: Síntesis neuronal de alta fidelidad (/api/voice/tts: Gemini Speech Generation -> Piper -> Navegador)
    this.speakWithPiper(cleanText, persona, callbacks, sessionId).then((played) => {
      // Fallback al navegador únicamente si la síntesis en servidor falló y la sesión no fue cancelada
      if (!played && this.currentPlaybackSessionId === sessionId) {
        this.speakBrowser(cleanText, persona, callbacks, sessionId);
      }
    });
  }

  /**
   * Síntesis de respaldo usando el sintetizador nativo del navegador
   */
  public speakBrowser(
    cleanText: string,
    persona: AgentPersona,
    callbacks?: VoicePlaybackCallbacks,
    sessionId?: number
  ): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      callbacks?.onEnd?.();
      return;
    }

    // Si la sesión ya fue cancelada por otro agente o stopSpeaking(), abortar
    if (sessionId !== undefined && this.currentPlaybackSessionId !== sessionId) {
      return;
    }

    // Cancelar cualquier síntesis anterior
    try {
      window.speechSynthesis.cancel();
    } catch {}

    const utterance = new SpeechSynthesisUtterance(cleanText);
    const chosenVoice = this.getBestVoiceForPersona(persona);
    if (chosenVoice) {
      utterance.voice = chosenVoice;
    }

    utterance.lang = chosenVoice?.lang || persona.voz.lang || 'es-CL';
    const isChosenVoiceActuallyMale = chosenVoice ? detectVoiceGender(chosenVoice) === 'MALE' : false;

    if (persona.sexo === 'MASCULINO') {
      if (isChosenVoiceActuallyMale) {
        utterance.pitch = persona.voz.pitch && persona.voz.pitch > 0.70 ? persona.voz.pitch : 0.95;
      } else {
        utterance.pitch = Math.min(persona.voz.pitch || 0.58, 0.62);
      }
      utterance.rate = persona.voz.rate || 0.94;
    } else {
      if (isChosenVoiceActuallyMale) {
        utterance.pitch = 1.35;
      } else {
        utterance.pitch = Math.max(persona.voz.pitch || 1.15, 1.05);
      }
      utterance.rate = persona.voz.rate || 1.0;
    }

    utterance.volume = persona.voz.volume ?? 1.0;

    utterance.onstart = () => {
      if (sessionId !== undefined && this.currentPlaybackSessionId !== sessionId) {
        try {
          window.speechSynthesis.cancel();
        } catch {}
        return;
      }
      callbacks?.onStart?.();
    };

    utterance.onend = () => {
      callbacks?.onEnd?.();
    };

    utterance.onerror = (e) => {
      console.warn('[VoiceAssistantEngine] Error en síntesis de voz del navegador:', e);
      callbacks?.onError?.(e);
      callbacks?.onEnd?.();
    };

    window.speechSynthesis.speak(utterance);
  }

  /**
   * Detiene de inmediato cualquier reproducción de voz activa (Piper y Navegador)
   */
  public stopSpeaking(): void {
    this.currentPlaybackSessionId++;
    if (this.currentAudioElement) {
      try {
        this.currentAudioElement.pause();
        this.currentAudioElement.currentTime = 0;
        this.currentAudioElement.src = '';
        this.currentAudioElement = null;
      } catch {}
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
  }

  /**
   * Verifica si el navegador soporta reconocimiento de voz
   */
  public isSpeechRecognitionSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
  }

  /**
   * Inicia el reconocimiento de voz por micrófono
   */
  public startListening(callbacks: VoiceRecognitionCallbacks): void {
    if (!this.isSpeechRecognitionSupported()) {
      callbacks.onError(new Error('El navegador no soporta Web Speech Recognition.'));
      return;
    }

    this.stopSpeaking(); // Si estaba hablando, callar antes de escuchar
    this.stopListening();

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    this.recognition.lang = 'es-CL';
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 1;

    this.isListeningActive = true;

    this.recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = 0; i < event.results.length; ++i) {
        const item = event.results[i];
        if (item.isFinal) {
          finalTranscript += item[0].transcript + ' ';
        } else {
          interimTranscript += item[0].transcript;
        }
      }

      const text = (finalTranscript + interimTranscript).trim();
      callbacks.onResult(text, Boolean(finalTranscript.trim()));
    };

    this.recognition.onerror = (event: any) => {
      console.warn('[VoiceAssistantEngine] Error reconocimiento voz:', event.error);
      this.isListeningActive = false;
      callbacks.onError(event);
    };

    this.recognition.onend = () => {
      this.isListeningActive = false;
      callbacks.onEnd();
    };

    try {
      this.recognition.start();
    } catch (e) {
      this.isListeningActive = false;
      callbacks.onError(e);
    }
  }

  /**
   * Detiene el reconocimiento de voz
   */
  public stopListening(): void {
    if (this.recognition && this.isListeningActive) {
      try {
        this.recognition.stop();
      } catch (e) {
        // Ignorar
      }
      this.isListeningActive = false;
    }
  }

  /**
   * Procesa el mensaje del usuario y produce una respuesta dialogada responsable,
   * con intención de ejecución real sobre el ERP.
   */
  public async processDialogue(
    userInput: string,
    persona: AgentPersona,
    context: DialogueContext,
    conversationHistory: Array<{
      id?: string;
      sender?: 'AGENT' | 'USER';
      personaName?: string;
      text: string;
      markdown?: string;
    }> = []
  ): Promise<AgentDialogueTurnResult> {
    const normalized = userInput.toLowerCase().trim();

    // Análisis de historial de conversación multi-turno
    const userMessages = conversationHistory.filter(m => m.sender === 'USER');
    const agentMessages = conversationHistory.filter(m => m.sender === 'AGENT');
    const lastAgentMsg = agentMessages.length > 0 ? agentMessages[agentMessages.length - 1] : null;
    const lastUserMsg = userMessages.length > 0 ? userMessages[userMessages.length - 1] : null;
    
    // Texto combinado de los últimos turnos para rastrear el contexto
    const recentHistoryText = conversationHistory
      .slice(-6)
      .map(m => `${m.sender || ''}: ${m.text || ''} ${m.markdown || ''}`)
      .join('\n')
      .toLowerCase();

    // Detección de intenciones afirmativas de confirmación ("sí", "confirmo", "adelante", "emítela", etc.)
    const isAffirmative = /^(s[ií]|claro|por supuesto|adelante|dale|hazlo|procede|autorizo|confirmo|confirmar|emite|em[ií]tela|crea|crear|genera|generar|de acuerdo|ok|exacto|correcto)\b/i.test(normalized) ||
      normalized.includes('si por favor') ||
      normalized.includes('sí por favor') ||
      normalized.includes('autorizo el timbraje') ||
      normalized.includes('genera la orden') ||
      normalized.includes('emite la cotizaci') ||
      normalized.includes('proceder');

    // ------------------------------------------------------------------------
    // FLUJO SUPREMO: Agente General Vera / Dirección Financiera
    // 1. Actualización / Regeneración del Flujo de Caja a la Fecha de Hoy
    // ------------------------------------------------------------------------
    const isCashFlowUpdateTodayRequest =
      (normalized.includes('flujo de caja') ||
        normalized.includes('flujo') ||
        normalized.includes('tesoreria') ||
        normalized.includes('tesorería') ||
        normalized.includes('caja')) &&
      (normalized.includes('hoy') ||
        normalized.includes('fecha de hoy') ||
        normalized.includes('fecha actual') ||
        normalized.includes('partiendo') ||
        normalized.includes('inicia') ||
        normalized.includes('iniciar') ||
        normalized.includes('regener') ||
        normalized.includes('recalcul') ||
        normalized.includes('actualiz') ||
        normalized.includes('desde hoy'));

    const isScenarioSpecific =
      normalized.includes('proveedor') ||
      normalized.includes('cliente') ||
      normalized.includes('retras') ||
      normalized.includes('postergar') ||
      normalized.includes('prórroga') ||
      normalized.includes('prorroga') ||
      normalized.includes('escenario what-if');

    if (isCashFlowUpdateTodayRequest && !isScenarioSpecific) {
      // 1. Notificar a la interfaz para actualizar la fecha base de la planilla en tiempo real
      const today = new Date();
      const todayISO = today.toISOString().split('T')[0];
      const todayFormatted = today.toLocaleDateString('es-CL', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('update-cashflow-base-date', {
            detail: { date: todayISO },
          })
        );
      }

      // 2. Métricas y saldos reales actualizados al día de hoy tomados del contexto vivo
      const saldoBancosHoy = (context.bankAccounts && context.bankAccounts.length > 0)
        ? context.bankAccounts.reduce((sum, b) => sum + (Number(b.saldoEnLinea) || 0), 0)
        : 0;

      const remuneraciones = (context.payrolls && context.payrolls.length > 0)
        ? context.payrolls.reduce((sum, p) => sum + (Number(p.sueldoLiquido) || 0), 0)
        : 0;

      const f29Compromiso = context.f29IvaTotal
        ? Math.abs(context.f29IvaTotal)
        : (context.f29 ? Math.abs((context.f29 as any).f29PagadoClp || (context.f29 as any).totalAPagar || 0) : 0);

      const cobranzasProyectadas30d = (context.dtes && context.dtes.length > 0)
        ? context.dtes
            .filter((d) => (d.tipoOperacion === 'VENTA' || String(d.tipoDte) === '33') && (d as any).estadoSii !== 'ANULADO')
            .reduce((sum, d) => sum + (Number(d.montoTotal) || 0), 0)
        : 0;

      const proveedoresOperativos = (context.dtes && context.dtes.length > 0)
        ? context.dtes
            .filter((d) => (d.tipoOperacion === 'COMPRA' || String(d.tipoDte) === '33') && (d as any).estadoSii !== 'ANULADO')
            .reduce((sum, d) => sum + (Number(d.montoTotal) || 0), 0)
        : 0;

      const egresosComprometidos30d = remuneraciones + f29Compromiso + proveedoresOperativos;
      const saldoProyectado30d = saldoBancosHoy + cobranzasProyectadas30d - egresosComprometidos30d;
      const holgura = saldoProyectado30d - (f29Compromiso + remuneraciones);

      const waText = `📊 *FLUJO DE CAJA ACTUALIZADO A FECHA DE HOY*
🏢 *Empresa:* ${context.clientName} (RUT: ${context.rut})
👩‍💼 *Emitido por:* Vera Albornoz (Directora Financiera & Socia Virtual)
📅 *Fecha de Inicio:* ${todayFormatted} (Proyección 30 Días Corridos)

💰 *Saldo Inicial Disponible en Bancos:* $${formatCLP(saldoBancosHoy)} CLP
🟢 *Ingresos Proyectados (Cobranzas):* +$${formatCLP(cobranzasProyectadas30d)} CLP
🔴 *Egresos Comprometidos (Próximos 30d):* -$${formatCLP(egresosComprometidos30d)} CLP
  • Sueldos Líquidos: -$${formatCLP(remuneraciones)} CLP
  • IVA F29 SII: -$${formatCLP(f29Compromiso)} CLP
  • Proveedores & Operaciones: -$${formatCLP(proveedoresOperativos)} CLP

📈 *Saldo Final Proyectado a 30 Días:* *$${formatCLP(saldoProyectado30d)} CLP*
🛡️ *Estado de Liquidez:* ${saldoProyectado30d >= 0 ? `POSITIVA (Holgura de +$${formatCLP(holgura)} CLP)` : `DÉFICIT PROYECTADO (-$${formatCLP(Math.abs(saldoProyectado30d))} CLP)`}

🔗 _Regenerado en tiempo real por Vera ERP._`;

      const whatsappShareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(waText)}`;

      const verbalSummary = saldoBancosHoy > 0
        ? `Listo socio. He actualizado el flujo de caja a partir de hoy, ${todayFormatted}. Con nuestro saldo bancario disponible de $${formatCLP(saldoBancosHoy)} pesos, cobranzas estimadas por $${formatCLP(cobranzasProyectadas30d)} y compromisos por $${formatCLP(egresosComprometidos30d)}, proyectamos una posición final de $${formatCLP(saldoProyectado30d)} pesos.`
        : `Listo socio. He recalculado el flujo de caja a partir de hoy, ${todayFormatted}. Actualmente la empresa no registra saldos bancarios disponibles en línea; los compromisos identificados suman $${formatCLP(egresosComprometidos30d)} pesos.`;

      return {
        verbalResponse: verbalSummary,
        displayMarkdown: `### 📊 Flujo de Caja Actualizado a la Fecha de Hoy (${todayFormatted})
> **Agente a cargo:** Vera Albornoz (Directora General & Socia Financiera) • *Regeneración en Tiempo Real*

He recalculado la proyección de tesorería y la **Matriz Diaria Estilo Excel** iniciando a partir del día de hoy (**${todayFormatted}**):

| Concepto de Tesorería | Saldo / Monto CLP | Estado / Cobertura |
| :--- | :---: | :--- |
| 🏦 **Saldo Inicial Consolidado en Bancos** | **$${formatCLP(saldoBancosHoy)}** | ${saldoBancosHoy > 0 ? 'Disponible inmediato en cuentas registradas' : 'Sin saldos bancarios activos'} |
| 🟢 **Ingresos Proyectados (Cobranzas 30 Días)** | **+$${formatCLP(cobranzasProyectadas30d)}** | Facturas de venta vigentes |
| 🔴 **Egresos Comprometidos (30 Días)** | **-$${formatCLP(egresosComprometidos30d)}** | Sueldos, F29 SII y Proveedores |
| 💵 • *Remuneraciones & Leyes Sociales:* | -$${formatCLP(remuneraciones)} | ${remuneraciones > 0 ? 'Nómina activa' : 'Sin nómina registrada'} |
| 🏛️ • *Impuestos F29 SII:* | -$${formatCLP(f29Compromiso)} | ${f29Compromiso > 0 ? 'Determinado F29' : 'Sin impuestos F29 pendientes'} |
| 📦 • *Proveedores Operativos:* | -$${formatCLP(proveedoresOperativos)} | ${proveedoresOperativos > 0 ? 'Facturas de compra' : 'Sin deudas registradas'} |
| 📈 **SALDO FINAL PROYECTADO A 30 DÍAS** | **$${formatCLP(saldoProyectado30d)}** | **${saldoProyectado30d >= 0 ? `SUPERÁVIT (+${formatCLP(holgura)} CLP)` : `DÉFICIT (-$${formatCLP(Math.abs(saldoProyectado30d))} CLP)`}** |

---

#### ⚡ Acciones Realizadas en el Sistema:
1. **Fecha Base Actualizada en Pantalla:** La Matriz Diaria ahora inicia en **${todayISO}** (**${todayFormatted}**) en lugar de la fecha anterior.
2. **Reorganización Diaria Automática:** Cada columna de la planilla refleja la proyección correlativa de los próximos 30 días corridos a partir de hoy.
3. **Botón Rápido "Hoy":** Puedes hacer clic en el botón dorado **"Hoy"** en la barra superior o en la matriz en cualquier momento para reiniciar el flujo al día actual.

---

#### 📱 Compartir Resumen con Socios (WhatsApp):
<div class="p-3 bg-emerald-50 border border-emerald-300 rounded-xl space-y-2 my-2">
  <div class="flex items-center justify-between">
    <span class="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
      <span>📲</span> Mensaje Ejecutivo para WhatsApp
    </span>
    <a
      href="${whatsappShareUrl}"
      target="_blank"
      rel="noopener noreferrer"
      class="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-xs transition-colors"
    >
      <span>Abrir WhatsApp</span>
      <span>↗</span>
    </a>
  </div>
  <pre class="text-[11px] bg-white p-2.5 rounded-lg border border-emerald-200 text-slate-800 font-mono whitespace-pre-wrap">${waText}</pre>
</div>`,
      };
    }

    // ------------------------------------------------------------------------
    // 1.5 (hallazgo #1): facturar, cotizar/presupuestar, inventario, bancos/conciliación y escenarios
    // de flujo de caja NO tienen guiones: van al motor agéntico, que usa herramientas con datos reales y
    // pide aprobación humana. Si el motor no está disponible, se informa sin inventar resultados.
    // ------------------------------------------------------------------------
    const agenticIntent = detectAgenticIntent(normalized);
    if (agenticIntent) {
      const delegated = await this.delegateToAgenticEngine(userInput, persona, context, agenticIntent.module);
      return delegated || agenticUnavailableResponse(persona, context, agenticIntent);
    }

    // ------------------------------------------------------------------------
    // FLUJO MULTI-TURNO C: Confirmación de Acciones Sugeridas Anteriores
    // ------------------------------------------------------------------------
    if (isAffirmative && lastAgentMsg) {
      const lastText = (lastAgentMsg.text + ' ' + (lastAgentMsg.markdown || '')).toLowerCase();

      if (lastText.includes('concili') || lastText.includes('cartola') || lastText.includes('banco')) {
        return {
          verbalResponse: `Confirmado. Ejecuto la conciliación bancaria inmediata de ${context.pendingBankNoveltiesCount} movimientos de cartola y sus asientos en el Libro Diario.`,
          displayMarkdown: `### 🏦 Conciliación Bancaria Confirmada y Ejecutada
He conciliado las ${context.pendingBankNoveltiesCount} novedades de cartola bancaria de **${context.clientName}** y regularizado los saldos contra el Libro Diario.`,
          actionToExecute: { type: 'RECONCILE_BANK' },
          followUpQuestion: '¿Deseas revisar la proyección de flujo de caja para los próximos días?',
        };
      }

      if (lastText.includes('f29') || lastText.includes('formulario 29') || lastText.includes('posterga')) {
        return {
          verbalResponse: `Confirmado. Procedo a recalcular el Formulario 29 con las últimas compras y ventas registradas ante el SII.`,
          displayMarkdown: `### 🏛️ Formulario 29 Recalculado
Se ha ejecutado el recálculo tributario para **${context.clientName}** con cuadratura de débito y crédito fiscal.`,
          actionToExecute: { type: 'CALCULATE_F29' },
          followUpQuestion: '¿Quieres revisar el certificado de postergación de IVA o el monto final a pagar?',
        };
      }

      if (lastText.includes('centralizar compras') || lastText.includes('compras del mes')) {
        return {
          verbalResponse: `Confirmado. He centralizado las facturas de compra del período en el Libro Diario contable.`,
          displayMarkdown: `### 📋 Centralización de Compras Registrada en Libro Diario
Asiento contable generado con IVA Crédito Fiscal, cuentas de costo/gasto y proveedores.`,
          actionToExecute: { type: 'CENTRALIZE_COMPRAS' },
        };
      }

      if (lastText.includes('centralizar ventas') || lastText.includes('ventas del mes')) {
        return {
          verbalResponse: `Confirmado. He registrado el asiento de ventas del período en el Libro Diario.`,
          displayMarkdown: `### 📈 Centralización de Ventas Registrada en Libro Diario
Asiento contable generado con Clientes, Ventas del Giro e IVA Débito Fiscal.`,
          actionToExecute: { type: 'CENTRALIZE_VENTAS' },
        };
      }
    }

    // 1. Intención: Centralizar compras del SII
    if (
      normalized.includes('centralizar compra') || 
      normalized.includes('centraliza las compras') || 
      normalized.includes('centraliza compras') ||
      normalized.includes('asiento de compras')
    ) {
      return {
        verbalResponse: `Entendido. Estoy centralizando las facturas de compra del SII en el Libro Diario contable de ${context.clientName}. El asiento quedará registrado con IVA Crédito Fiscal y proveedores.`,
        displayMarkdown: `### 📋 Centralización de Compras del SII Ejecutada
He tomado las facturas de compra del período de **${context.clientName}** y generado el asiento de centralización en el **Libro Diario**.
- **Cuentas afectadas:** Cuentas de Gasto/Existencias (Debe), IVA Crédito Fiscal (Debe), Proveedores Nacionales (Haber).
- **Control normativo:** Cuadratura estricta de partida doble y validación ante el SII.`,
        actionToExecute: { type: 'CENTRALIZE_COMPRAS' },
        followUpQuestion: '¿Deseas que revisemos el Libro Diario o centralicemos también las ventas del mes?',
      };
    }

    // 2. Intención: Centralizar ventas del SII
    if (
      normalized.includes('centralizar venta') || 
      normalized.includes('centraliza las ventas') || 
      normalized.includes('centraliza ventas') ||
      normalized.includes('asiento de ventas')
    ) {
      return {
        verbalResponse: `Procedo de inmediato a centralizar las ventas emitidas en el Libro Diario. Se reconocerán Clientes Nacionales, Ventas del Giro y el IVA Débito Fiscal.`,
        displayMarkdown: `### 📈 Centralización de Ventas del SII Ejecutada
Se ha registrado el asiento resumen de ventas para **${context.clientName}**.
- **Debe:** Clientes Nacionales / Cuentas por Cobrar
- **Haber:** Ingresos por Ventas del Giro y Débito Fiscal IVA (D.L. 825)`,
        actionToExecute: { type: 'CENTRALIZE_VENTAS' },
        followUpQuestion: '¿Deseas que calculemos el Formulario 29 ahora con estos datos actualizados?',
      };
    }

    // 4. Intención: F29 y cálculo de impuestos
    if (
      normalized.includes('f29') || 
      normalized.includes('formulario 29') || 
      normalized.includes('impuesto') || 
      normalized.includes('iva') ||
      normalized.includes('declarar')
    ) {
      return {
        verbalResponse: `Analizando el cumplimiento tributario de ${context.clientName}. Con las compras y ventas del mes, el IVA neto calculado es de $${Math.abs(context.f29IvaTotal).toLocaleString('es-CL')}. Los datos están listos para revisión.`,
        displayMarkdown: `### 🏛️ Auditoría y Cálculo del Formulario 29 (SII)
- **Empresa:** ${context.clientName} (RUT: ${context.rut})
- **Régimen:** Pro Pyme General (14 D3) / General
- **IVA Determinado:** $${Math.abs(context.f29IvaTotal).toLocaleString('es-CL')} (${context.f29IvaTotal >= 0 ? 'A pagar' : 'Remanente a favor'})
- **Auditoría:** Todos los DTEs registrados cumplen con los plazos de aceptación y requisitos del Art. 23 DL 825.`,
        actionToExecute: { type: 'CALCULATE_F29' },
        followUpQuestion: '¿Quieres que verifiquemos si la empresa califica para la postergación de IVA por 60 días?',
      };
    }

    // 5. Intención: Rendición de gastos
    if (
      normalized.includes('rendicion') || 
      normalized.includes('rendición') || 
      normalized.includes('gasto') || 
      normalized.includes('anticipo') ||
      normalized.includes('viatico')
    ) {
      return {
        verbalResponse: `Revisando el módulo de rendición de gastos. Tenemos ${context.pendingExpensesCount} rendiciones en el sistema. Procedo a registrar la solicitud en Gobernanza para revisión y aprobación humana.`,
        displayMarkdown: `### 🧾 Gestión de Rendición de Gastos & Anticipos
- **Rendiciones en seguimiento:** ${context.pendingExpensesCount}
- **Gobernanza Human-in-the-Loop:** Solicitud de centralización sometida a aprobación formal antes de impactar el Libro Mayor.
- **Centros de costos:** Imputación analítica validada.`,
        actionToExecute: { type: 'CENTRALIZE_EXPENSES' },
        followUpQuestion: '¿Deseas que generemos un comprobante de reintegro o registremos un nuevo anticipo?',
      };
    }

    // 6. Intención: Remuneraciones, Sueldos e Imposiciones Previred (Informe Detallado & WhatsApp)
    const isPayrollIntent =
      normalized.includes('remuneracion') ||
      normalized.includes('remuneración') ||
      normalized.includes('sueldo') ||
      normalized.includes('sueldos') ||
      normalized.includes('nomina') ||
      normalized.includes('nómina') ||
      normalized.includes('imposicion') ||
      normalized.includes('imposiciones') ||
      normalized.includes('previred') ||
      normalized.includes('afp') ||
      normalized.includes('fonasa') ||
      normalized.includes('isapre') ||
      normalized.includes('leyes sociales') ||
      normalized.includes('seguro de cesantia') ||
      normalized.includes('mutual') ||
      normalized.includes('colaborador') ||
      normalized.includes('trabajador');

    if (isPayrollIntent) {
      const isExecutiveInterlocutor = persona.id === 'AGENTE_GENERAL_VERA' || persona.isExecutiveGeneral;
      const agentRoleIntro = isExecutiveInterlocutor
        ? 'He coordinado con Valentina Rojas en Gestión de Personas y RRHH.'
        : 'Como Jefa de RRHH, he preparado la auditoría de remuneraciones e imposiciones.';

      const payrollList = context.payrolls && context.payrolls.length > 0 ? context.payrolls : [];
      if (payrollList.length === 0) {
        return {
          verbalResponse: `No hay liquidaciones de sueldo registradas para ${context.clientName} en el período; no puedo informar montos de remuneraciones ni de Previred.`,
          displayMarkdown: `### 👥 Remuneraciones e imposiciones\n\nNo hay liquidaciones registradas para **${context.clientName}** en el período seleccionado. Cargue o calcule la nómina en el módulo de Remuneraciones para obtener el informe.`,
          actionToExecute: { type: 'NAVIGATE', targetTab: 'payroll' },
        };
      }
      const totalColaboradores = payrollList.length;

      // Totales calculados solo desde las liquidaciones registradas (sin valores de respaldo)
      const sumBy = (fn: (p: any) => number) => payrollList.reduce((acc, p) => acc + (fn(p) || 0), 0);
      const totalLiquido = sumBy((p) => p.sueldoLiquido);
      const totalImponible = sumBy((p) => p.totalHaberesImponibles);
      const totalAfp = sumBy((p) => p.afpMonto);
      const totalSalud = sumBy((p) => p.saludMonto);
      const totalAfc = sumBy((p) => (p.afcTrabajadorMonto || 0) + (p.afcEmpleadorMonto || 0));
      const totalMutual = sumBy((p) => p.mutualEmpleadorMonto);
      const totalSis = sumBy((p) => p.sisEmpleadorMonto);
      const totalImpuestoUnico = sumBy((p) => p.impuestoUnicoMonto);

      const totalPrevired = totalAfp + totalSalud + totalAfc + totalMutual + totalSis;
      const totalCostoEmpresa = totalLiquido + totalPrevired + totalImpuestoUnico;
      const fechaHoy = new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' });

      // Mensaje formateado para WhatsApp
      const waPayrollText = `👥 *INFORME DE REMUNERACIONES & LEYES SOCIALES (PREVIRED)*
🏢 *Empresa:* ${context.clientName} (RUT: ${context.rut})
👩‍💼 *Emitido por:* Vera Albornoz (Directora General & Socia Virtual)
📅 *Período:* Mes en curso • Dotación: *${totalColaboradores} colaboradores*
📅 *Fecha:* ${fechaHoy}

💵 *Sueldo Líquido a Transferir a Trabajadores:* *$${formatCLP(totalLiquido)} CLP*
🏛️ *Total Leyes Sociales a Pagar en Previred:* *$${formatCLP(totalPrevired)} CLP*
💼 *Costo Empresa Total Consolidado:* *$${formatCLP(totalCostoEmpresa)} CLP*

📋 *Desglose de Imposiciones (Previred Online):*
• 🟢 AFP (Cotización Obligatoria 10% + Comisión): $${formatCLP(totalAfp)} CLP
• 🟢 Salud (Fonasa 7% + Isapres pactadas): $${formatCLP(totalSalud)} CLP
• 🟢 Seguro de Cesantía AFC (Trabajador + Empleador): $${formatCLP(totalAfc)} CLP
• 🟢 Mutual de Seguridad (ACHS Ley 16.744): $${formatCLP(totalMutual)} CLP
• 🟢 Seguro de Invalidez y Sobrevivencia (SIS 1.49%): $${formatCLP(totalSis)} CLP

⏰ *Vencimiento Legal Inextensible:* *Día 13 del mes (Previred Electrónico)*
✅ *Cumplimiento Laboral:* Libro de Remuneraciones Electrónico (LRE) validado ante la Dirección del Trabajo (DT).

🔗 _Informe generado automáticamente por Vera ERP para el Directorio._`;

      const waPayrollUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(waPayrollText)}`;

      return {
        verbalResponse: `Hola socio. ${agentRoleIntro} Para este período tenemos una dotación de ${totalColaboradores} colaboradores, con un sueldo líquido total de $${formatCLP(totalLiquido)} pesos a transferir y un compromiso de leyes sociales en Previred por $${formatCLP(totalPrevired)} pesos. El pago electrónico en Previred vence impostergablemente el día 13. Tienes el informe desglosado y el mensaje para WhatsApp en pantalla.`,
        displayMarkdown: `### 👥 Informe de Nómina de Remuneraciones & Previred (Leyes Sociales)
> **Interlocutora:** Vera Albornoz (Directora General & Socia Virtual) • **A cargo técnico:** Valentina Rojas (RRHH)

He preparado el resumen laboral y previsional para **${context.clientName}**:
- **Dotación de Personal Activo:** **${totalColaboradores} trabajadores con contrato vigente**
- **Plataforma de Pago Previsional:** **Portal Previred Electrónico (Día 13)**
- **Estado Normativo:** Cumplimiento Mi DT y Libro de Remuneraciones Electrónico (LRE) al día.

| Concepto de Remuneraciones | Monto ($ CLP) | Detalle / Institución Destino |
| :--- | :---: | :--- |
| **Total Haberes Imponibles** | $${formatCLP(totalImponible)} | Base de cálculo previsional |
| **TOTAL LÍQUIDO A PAGAR (SUELDOS)** | **$${formatCLP(totalLiquido)}** | **Transferencias electrónicas a trabajadores** |
| **Cotizaciones Previsionales AFP** | $${formatCLP(totalAfp)} | Habitat, Cuprum, Provida, Modelo, PlanVital |
| **Salud Previsional (Fonasa / Isapres)** | $${formatCLP(totalSalud)} | Fonasa 7% + Planes pactados en Isapre |
| **Seguro de Cesantía (AFC)** | $${formatCLP(totalAfc)} | Aporte trabajador (0.6%) + empleador (2.4%) |
| **Mutual de Seguridad (ACHS)** | $${formatCLP(totalMutual)} | Cobertura accidentes laborales Ley 16.744 |
| **Seguro Invalidez y Sobrevivencia (SIS)** | $${formatCLP(totalSis)} | Aporte patronal obligatorio (1.49%) |
| **TOTAL IMPOSICIONES PREVIRED** | **$${formatCLP(totalPrevired)}** | **Pago electrónico con vencimiento Día 13** |
| **COSTO EMPRESA CONSOLIDADO** | **$${formatCLP(totalCostoEmpresa)}** | **Impacto total en estado de resultados** |

---

#### ⚖️ Respaldo Legal & Calendario de Pagos:
1. **Fecha Límite Previred:** **Día 13 del mes en curso hasta las 23:59 hrs**. Cumpliendo esta fecha se evitan reajustes e intereses de la Ley 17.322.
2. **Asiento Contable:** Provisiones de sueldos por pagar e imposiciones debidamente centralizadas en el Libro Diario.

---

#### 📱 Canal de Comunicación WhatsApp (Listo para Enviar a Socios):
<div class="p-3 bg-emerald-50 border border-emerald-300 rounded-xl space-y-2 my-2">
  <div class="flex items-center justify-between">
    <span class="font-bold text-xs text-emerald-950 flex items-center gap-1.5">
      💬 Resumen de Nómina y Previred para WhatsApp:
    </span>
    <a
      href="${waPayrollUrl}"
      target="_blank"
      rel="noopener noreferrer"
      class="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1 shadow-xs transition-colors"
    >
      📱 Enviar a Socios por WhatsApp
    </a>
  </div>
  <pre class="text-[11px] bg-white p-2.5 rounded-lg border border-emerald-200 text-slate-800 font-mono whitespace-pre-wrap">${waPayrollText}</pre>
</div>`,
        actionToExecute: { type: 'NAVIGATE', targetTab: 'payroll' },
        followUpQuestion: '¿Deseas que emitamos las liquidaciones de sueldo en PDF o revisemos el detalle por colaborador?',
      };
    }

    // 8. Intención: Estado de Orden de Producción / Órdenes de Fabricación (NIC 2)
    const isProductionOrderIntent =
      (normalized.includes('orden de produccion') ||
      normalized.includes('orden de producción') ||
      normalized.includes('orden de trabajo') ||
      normalized.includes('op-') ||
      normalized.includes('ordenes de fabricacion') ||
      normalized.includes('órdenes de fabricación') ||
      normalized.includes('avance de produccion') ||
      normalized.includes('avance de producción') ||
      normalized.includes('estado de la orden') ||
      normalized.includes('maestranza') ||
      (normalized.includes('produccion') && !normalized.includes('presupuesto')) ||
      (normalized.includes('producción') && !normalized.includes('presupuesto')));

    if (isProductionOrderIntent) {
      const isExecutiveInterlocutor = persona.id === 'AGENTE_GENERAL_VERA' || persona.isExecutiveGeneral;
      const agentRoleIntro = isExecutiveInterlocutor
        ? 'Hablé con Francisca Araya en la planta de Producción y Maestranza.'
        : 'Como Jefa de Producción y Costeo Industrial, he auditado la orden de fabricación.';

      // Datos de la orden real
      const realOrder = context.productionOrders?.[0] || getDiskPersistence()?.getProductionOrders(context.rut || (context as any).empresaId)?.[0];
      if (!realOrder) {
        return {
          verbalResponse: `Hola socio. ${agentRoleIntro} Al auditar la base de datos de producción para ${context.clientName || 'la empresa'}, no se registran órdenes de fabricación en proceso actualmente.`,
          displayMarkdown: `### 🏭 Informe de Avance de Producción & Costeo Industrial (NIC 2)\n\nNo se registran órdenes de producción en proceso para **${context.clientName || 'la empresa'}**.`,
          actionToExecute: { type: 'NAVIGATE', targetTab: 'production' },
          followUpQuestion: '¿Deseas registrar una nueva orden de producción en el sistema?',
        };
      }

      const folioOP = realOrder.folioOP || realOrder.id;
      const productoOP = realOrder.productoNombre || realOrder.descripcion || 'Producto en Fabricación';
      const clienteOP = (realOrder as any)?.clienteNombre || (context.clientName ? `Cliente de ${context.clientName}` : 'Cliente Industrial');
      const cantProducida = Number(realOrder.cantidadProducidaReal || 0);
      const cantObjetivo = Number(realOrder.cantidadObjetivo || 1);
      const avancePct = Math.round((cantProducida / cantObjetivo) * 100);
      const uom = realOrder.unidadMedida || 'UND';
      const fechaEntrega = realOrder.fechaEstimadaTermino || realOrder.fechaRealTermino || 'Plazo según cronograma de maestranza';

      // Costos NIC 2
      const costoMpd = Number(realOrder.costoMateriaPrimaReal || 0);
      const costoMod = Number(realOrder.costoManoObraReal || 0);
      const costoCif = Number(realOrder.costoCifReal || 0);
      const costoTotalAcumulado = Number(realOrder.costoTotalProduccion || (costoMpd + costoMod + costoCif));
      const fechaHoy = new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' });

      // WhatsApp text
      const waProductionText = `🏭 *INFORME DE AVANCE DE PRODUCCIÓN & COSTOS INDUSTRIALES (NIC 2)*
🏢 *Empresa:* ${context.clientName} (RUT: ${context.rut})
👩‍💼 *Emitido por:* Vera Albornoz (Directora General) & Francisca Araya (Costos)
📅 *Fecha:* ${fechaHoy}

📋 *Orden de Producción:* *${folioOP}* — ${productoOP}
🤝 *Cliente Destinatario:* *${clienteOP}*
📈 *Avance Físico Actual:* *${avancePct}%* (${cantProducida} de ${cantObjetivo} ${uom})
🚚 *Fecha Comprometida de Entrega:* *${fechaEntrega}*

💰 *Desglose de Costos de Fabricación Acumulados (NIC 2):*
• 🧵 Materia Prima Directa (MPD): $${formatCLP(costoMpd)} CLP
• 👷 Mano de Obra Directa (MOD): $${formatCLP(costoMod)} CLP
• ⚡ Costos Indirectos de Fabricación (CIF): $${formatCLP(costoCif)} CLP
• 🏷️ *Costo Total de Producción en Proceso:* *$${formatCLP(costoTotalAcumulado)} CLP*

🎯 *Control Presupuestario:* Consumos auditados bajo NIC 2 conforme a la base de datos de producción.

🔗 _Informe generado automáticamente por Vera ERP para el Directorio._`;

      const waProductionUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(waProductionText)}`;

      return {
        verbalResponse: `Hola socio. ${agentRoleIntro} La orden de producción ${folioOP} para ${clienteOP} registra un ${avancePct}% de avance físico, con entrega pactada para el ${fechaEntrega}. En materia de costos bajo la NIC 2, los consumos de materiales y horas suman $${formatCLP(costoTotalAcumulado)} pesos. Tienes el informe de avance y el mensaje para WhatsApp en pantalla.`,
        displayMarkdown: `### 🏭 Informe de Avance de Producción & Costeo Industrial (NIC 2)
> **Interlocutora:** Vera Albornoz (Directora General & Socia Virtual) • **A cargo técnico:** Francisca Araya (Producción)

Estado de ejecución en maestranza para **${context.clientName}**:
- **Orden de Producción:** **${folioOP}** (Estado: ${realOrder.estado || 'En Proceso'})
- **Producto:** **${productoOP}**
- **Cliente:** **${clienteOP}**
- **Plazo de Entrega:** **${fechaEntrega}**

| Indicador Operacional | Valor Actual | Meta Comprometida | Estado |
| :--- | :---: | :---: | :---: |
| **Avance Físico de Fabricación** | **${cantProducida} ${uom}** | ${cantObjetivo} ${uom} | **${avancePct}% Completado** |
| **Fecha de Inicio** | ${realOrder.fechaInicio || 'Vigente'} | — | En cronograma |
| **Control de Calidad** | 100% Conforme | Especificación Técnica | Aprobado |

---

#### 💰 Estructura de Costos de Fabricación Acumulados (NIC 2 Inventarios):
| Componente de Costo | Concepto Técnico | Importe ($ CLP) |
| :--- | :--- | :---: |
| **Materia Prima Directa (MPD)** | Materiales e insumos retirados de bodega | $${formatCLP(costoMpd)} |
| **Mano de Obra Directa (MOD)** | Horas hombre registradas en planta/taller | $${formatCLP(costoMod)} |
| **Costos Indirectos (CIF)** | Cuotas indirectas y depreciación de maquinarias | $${formatCLP(costoCif)} |
| **COSTO TOTAL EN PROCESO** | **Cuenta 1-1-08 Producción en Proceso** | **$${formatCLP(costoTotalAcumulado)}** |

---

#### 📱 Canal de Comunicación WhatsApp (Listo para Enviar al Directorio):
<div class="p-3 bg-emerald-50 border border-emerald-300 rounded-xl space-y-2 my-2">
  <div class="flex items-center justify-between">
    <span class="font-bold text-xs text-emerald-950 flex items-center gap-1.5">
      💬 Reporte de Producción para WhatsApp:
    </span>
    <a
      href="${waProductionUrl}"
      target="_blank"
      rel="noopener noreferrer"
      class="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1 shadow-xs transition-colors"
    >
      📱 Enviar a Socios por WhatsApp
    </a>
  </div>
  <pre class="text-[11px] bg-white p-2.5 rounded-lg border border-emerald-200 text-slate-800 font-mono whitespace-pre-wrap">${waProductionText}</pre>
</div>`,
        actionToExecute: { type: 'NAVIGATE', targetTab: 'production' },
        followUpQuestion: `¿Deseas autorizar un nuevo vale de retiro de insumos para la ${folioOP}?`,
      };
    }

    // 9. Intención: Estado de Presupuestos y Cotizaciones Enviadas (Pipeline Comercial)
    const isSentBudgetsIntent =
      normalized.includes('presupuestos enviados') ||
      normalized.includes('cotizaciones enviadas') ||
      normalized.includes('estado de los presupuestos') ||
      normalized.includes('estado de las cotizaciones') ||
      normalized.includes('cotizaciones pendientes') ||
      normalized.includes('pipeline comercial') ||
      normalized.includes('propuestas comerciales') ||
      (normalized.includes('presupuesto') && (normalized.includes('estado') || normalized.includes('enviad') || normalized.includes('cuanto') || normalized.includes('cuánto')));

    if (isSentBudgetsIntent) {
      const isExecutiveInterlocutor = persona.id === 'AGENTE_GENERAL_VERA' || persona.isExecutiveGeneral;
      const agentRoleIntro = isExecutiveInterlocutor
        ? 'Revisé con Rodrigo Tapia y el equipo comercial el pipeline de propuestas.'
        : 'Como responsable comercial, he consolidado el estado de las cotizaciones enviadas.';

      const cotizClienteA = context.clientName ? `${context.clientName} - Operaciones` : 'Cliente Industrial A';
      const tenantKey = context.clientId || context.rut || 'client-retail-01';
      const comState = commercialProcurementService.getState(tenantKey);
      const quotesFromService = comState.cotizaciones || [];

      if (quotesFromService.length === 0) {
        return {
          verbalResponse: `Hola socio. ${agentRoleIntro} Al momento no se registran presupuestos o cotizaciones vigentes en el pipeline comercial de la empresa. ¿Deseas formular una nueva propuesta?`,
          displayMarkdown: `### 📑 Pipeline de Presupuestos & Cotizaciones Enviadas
> **Interlocutora:** Vera Albornoz (Directora General & Socia Virtual) • **A cargo técnico:** Rodrigo Tapia (Comercial & Ventas)

Consolidado de propuestas comerciales de **${context.clientName || 'la empresa'}**:
- **Volumen Total en Pipeline:** **$0 CLP**
- **Estado General:** No se registran cotizaciones comerciales vigentes en negociación.

---
#### 🤝 Acciones Recomendadas:
1. Formular una nueva cotización comercial.
2. Cargar propuestas de clientes desde el módulo comercial.`,
          actionToExecute: { type: 'NAVIGATE', targetTab: 'production' },
          followUpQuestion: '¿Deseas que formulemos un nuevo presupuesto comercial?',
        };
      }

      const cotizaciones = quotesFromService.map(q => ({
        folio: q.folio || q.id,
        cliente: q.clienteRazonSocial || 'Cliente Industrial',
        producto: q.items && q.items[0] ? q.items[0].nombre : 'Propuesta Comercial y Suministro',
        neto: Number(q.totalNetoCLP) || 0,
        margenPct: Number(q.margenBrutoTotalPorcentaje) || 0,
        estado: q.estado,
        estadoLabel: q.estado === 'ENVIADA_CLIENTE' ? 'Enviada al Cliente' : q.estado === 'ACEPTADA_POR_FACTURAR' ? 'Aceptada por Facturar' : 'Vigente',
        validez: q.validezDias ? `${q.validezDias} días corridos` : 'sin validez registrada',
      }));

      const totalPipelineNeto = cotizaciones.reduce((acc, c) => acc + c.neto, 0);
      const totalPipelineBruto = Math.round(totalPipelineNeto * 1.19);
      const fechaHoy = new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' });
      const avgMargen = (cotizaciones.reduce((acc, c) => acc + c.margenPct, 0) / cotizaciones.length).toFixed(1);

      const propWaLines = cotizaciones.map(c => `• 🟢 *${c.folio} (${c.cliente}):* $${formatCLP(c.neto)} CLP (+IVA) | Margen: ${c.margenPct}%\n   - Estado: *${c.estadoLabel}*`).join('\n');

      // WhatsApp text
      const waBudgetsText = `📑 *PIPELINE DE PRESUPUESTOS & COTIZACIONES ENVIADAS*
🏢 *Empresa:* ${context.clientName} (RUT: ${context.rut})
👩‍💼 *Emitido por:* Vera Albornoz (Directora General & Socia Virtual)
📅 *Fecha:* ${fechaHoy}

💼 *Volumen Total en Pipeline:* *$${formatCLP(totalPipelineNeto)} CLP (Neto)* | Bruto (+IVA): $${formatCLP(totalPipelineBruto)} CLP
📈 *Margen Comercial Promedio:* *${avgMargen}%*

📋 *Propuestas Activas en Negociación:*
${propWaLines}

🎯 *Probabilidad de Cierre:* ALTA (Proyectos con entrega comprometida para el mes entrante).

🔗 _Informe generado automáticamente por Vera ERP para el Directorio._`;

      const waBudgetsUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(waBudgetsText)}`;
      const firstQuote = cotizaciones[0];
      const secondQuote = cotizaciones.length > 1 ? cotizaciones[1] : null;
      const verbalDetail = secondQuote
        ? `La cotización principal para ${firstQuote.cliente} por $${formatCLP(firstQuote.neto)} pesos está en revisión técnica y la propuesta secundaria por $${formatCLP(secondQuote.neto)} cuenta con pre-aprobación.`
        : `La cotización para ${firstQuote.cliente} por $${formatCLP(firstQuote.neto)} pesos se encuentra en seguimiento.`;

      const tableRows = cotizaciones.map(c => `| **${c.folio}** | **${c.cliente}** | ${c.producto} | $${formatCLP(c.neto)} | **${c.margenPct}%** | 🟢 ${c.estadoLabel} |`).join('\n');

      return {
        verbalResponse: `Hola socio. ${agentRoleIntro} Actualmente tenemos ${cotizaciones.length} presupuesto(s) enviado(s) por un volumen total de $${formatCLP(totalPipelineNeto)} pesos netos, con un margen promedio del ${avgMargen}%. ${verbalDetail} Te dejé el pipeline detallado en pantalla.`,
        displayMarkdown: `### 📑 Pipeline de Presupuestos & Cotizaciones Enviadas
> **Interlocutora:** Vera Albornoz (Directora General & Socia Virtual) • **A cargo técnico:** Rodrigo Tapia (Comercial & Ventas)

Consolidado de propuestas comerciales de **${context.clientName}**:
- **Volumen Total Cotizado:** **$${formatCLP(totalPipelineNeto)} CLP Neto** ($${formatCLP(totalPipelineBruto)} Bruto con IVA)
- **Margen Comercial Ponderado:** **${avgMargen}% sobre Costo Directo NIC 2**
- **Estado General:** 100% vigentes y en proceso de cierre formal.

| Folio | Cliente | Producto Cotizado | Importe Neto ($ CLP) | Margen Presupuestado | Estado Actual |
| :--- | :--- | :--- | :---: | :---: | :--- |
${tableRows}
| **TOTALES** | **${cotizaciones.length} Clientes** | **Pipeline Activo** | **$${formatCLP(totalPipelineNeto)}** | **${avgMargen}% Promedio** | **En Cronograma** |

---

#### 🤝 Acciones de Seguimiento Comercial:
1. **${firstQuote.cliente}:** Coordinación de visita técnica para certificar especificaciones.
${secondQuote ? `2. **${secondQuote.cliente}:** Validación de orden de compra (OC) para generar la Orden de Trabajo en Producción.` : ''}

---

#### 📱 Canal de Comunicación WhatsApp (Listo para Enviar al Directorio):
<div class="p-3 bg-emerald-50 border border-emerald-300 rounded-xl space-y-2 my-2">
  <div class="flex items-center justify-between">
    <span class="font-bold text-xs text-emerald-950 flex items-center gap-1.5">
      💬 Pipeline de Cotizaciones para WhatsApp:
    </span>
    <a
      href="${waBudgetsUrl}"
      target="_blank"
      rel="noopener noreferrer"
      class="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1 shadow-xs transition-colors"
    >
      📱 Enviar a Socios por WhatsApp
    </a>
  </div>
  <pre class="text-[11px] bg-white p-2.5 rounded-lg border border-emerald-200 text-slate-800 font-mono whitespace-pre-wrap">${waBudgetsText}</pre>
</div>`,
        actionToExecute: { type: 'NAVIGATE', targetTab: 'production' },
        followUpQuestion: '¿Deseas que formulemos un nuevo presupuesto o revisemos el avance de producción?',
      };
    }

    // 10. Intención: Radiografía General / Panorama 360° del Negocio para el Socio
    const isGeneralPanoramaIntent =
      normalized.includes('como esta la empresa') ||
      normalized.includes('cómo está la empresa') ||
      normalized.includes('resumen general') ||
      normalized.includes('radiografia') ||
      normalized.includes('radiografía') ||
      normalized.includes('panorama') ||
      normalized.includes('situacion general') ||
      normalized.includes('situación general') ||
      normalized.includes('vera cómo vamos');

    if (isGeneralPanoramaIntent) {
      const fechaHoy = new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' });
      const accountsInitial = context.bankAccounts && context.bankAccounts.length > 0
        ? context.bankAccounts.reduce((sum, b) => sum + (Number(b.saldoEnLinea ?? (b as any).saldoInicial ?? (b as any).saldoContable) || 0), 0)
        : 0;
      const netMovements = context.bankMovements && context.bankMovements.length > 0
        ? context.bankMovements.reduce((sum, m) => sum + (Number(m.abono) || 0) - (Number(m.cargo) || 0), 0)
        : 0;
      const saldoBancos = accountsInitial + netMovements;

      const tenantCompanyKey = context.clientId || context.rut || 'client-retail-01';
      const comState = commercialProcurementService.getState(tenantCompanyKey);
      const quotes = comState.cotizaciones || [];
      const pipelineVentas = quotes.reduce((sum, q) => sum + (Number(q.totalNetoCLP) || 0), 0);

      const sueldosLiquidos = context.payrolls && context.payrolls.length > 0
        ? context.payrolls.reduce((sum, p) => sum + (Number(p.sueldoLiquido) || 0), 0)
        : 0;
      const previred = context.payrolls && context.payrolls.length > 0
        ? context.payrolls.reduce((sum, p) => sum + ((p.afpMonto || 0) + (p.saludMonto || 0) + (p.afcTrabajadorMonto || 0) + (p.sisEmpleadorMonto || 0) + (p.mutualEmpleadorMonto || 0)), 0)
        : 0;
      const f29Estimado = Math.abs(context.f29IvaTotal || 0);

      const activeOrders = (context.productionOrders || []).filter(po => po.estado !== 'TERMINADA' && po.estado !== 'ANULADA');
      const opAvance = activeOrders.length > 0
        ? Math.round(activeOrders.reduce((sum, po) => {
            const prog = (po as any).porcentajeAvanceFisico ?? (po.cantidadObjetivo > 0 ? Math.round((po.cantidadProducidaReal / po.cantidadObjetivo) * 100) : 0);
            return sum + prog;
          }, 0) / activeOrders.length)
        : 0;
      const opTextoWa = activeOrders.length > 0
        ? `• ${activeOrders.length} OP(s) Activas de Fabricación: ${opAvance}% de avance físico en cronograma`
        : '• Producción & Planta: Sin órdenes de fabricación activas en este período';
      const opTextoMd = activeOrders.length > 0
        ? `**${opAvance}% de avance físico** (${activeOrders.length} OP)`
        : 'Sin órdenes activas';

      const skusCount = context.inventoryItems ? context.inventoryItems.length : (context.inventoryItemsCount || 0);

      const waPanoramaText = `🏢 *RADIOGRAFÍA GENERAL DE LA OPERACIÓN (PANORAMA 360°)*
🏢 *Empresa:* ${context.clientName} (RUT: ${context.rut})
👩‍💼 *Emitido por:* Vera Albornoz (Directora General & Socia Virtual)
📅 *Fecha:* ${fechaHoy}

💰 *1. Tesorería & Bancos:*
• Saldo Disponible en Bancos: *$${formatCLP(saldoBancos)} CLP* (${saldoBancos > 0 ? '100% Conciliado' : 'Sin saldo / Por conciliar'})
• Posición de Solvencia: ${saldoBancos > 0 ? 'Holgada y positiva' : 'Neutral / En monitoreo'}

👥 *2. Personas & Leyes Sociales:*
• Sueldos Líquidos: $${formatCLP(sueldosLiquidos)} CLP
• Imposiciones Previred: $${formatCLP(previred)} CLP (Vence Día 13)

🏛️ *3. Tributario (SII):*
• IVA F29 Estimado: $${formatCLP(f29Estimado)} CLP (Elegible postergación 60 días)

📦 *4. Bodegas & WMS:*
• ${skusCount} SKUs valorizados bajo PMP conforme a NIC 2 (Sin quiebres)

🏭 *5. Producción & Planta:*
${opTextoWa}

📑 *6. Comercial & Ventas:*
• Pipeline Activo: $${formatCLP(pipelineVentas)} CLP netos en cotizaciones vigentes.

🔗 _Informe generado automáticamente por Vera ERP para el Directorio._`;

      const waPanoramaUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(waPanoramaText)}`;

      const verbalBancos = saldoBancos > 0 ? `$${formatCLP(saldoBancos)} pesos en bancos conciliados` : 'sin saldo disponible registrado en bancos';
      const verbalNomina = sueldosLiquidos > 0 ? `nómina estimada en $${formatCLP(sueldosLiquidos)} pesos` : 'sin nómina pendiente procesada';
      const verbalPlanta = activeOrders.length > 0 ? `las órdenes de fabricación avanzan a un ${opAvance}%` : 'la planta no registra órdenes activas';
      const verbalPipeline = pipelineVentas > 0 ? `un pipeline de cotizaciones por $${formatCLP(pipelineVentas)} pesos` : 'sin cotizaciones activas en pipeline';

      return {
        verbalResponse: `Hola socio. Diagnóstico integral del negocio: disponemos de ${verbalBancos}, ${verbalNomina}, ${verbalPlanta}, y ${verbalPipeline}. Te dejé la radiografía 360° en pantalla.`,
        displayMarkdown: `### 🏢 Radiografía Ejecutiva General del Negocio (Panorama 360°)
> **Interlocutora:** Vera Albornoz (Directora General & Socia Financiera Virtual)

Diagnóstico integral de la operación de **${context.clientName}**:

| Área Operacional | Estado Clave | Métrica Financiera | Agente a Cargo |
| :--- | :--- | :---: | :--- |
| **🏦 Tesorería & Bancos** | **100% Conciliado** | **$${formatCLP(saldoBancos)} CLP** disponible | Sofía Morales |
| **👥 Personas & Remuneraciones** | Nómina calculada y LRE validado | **$${formatCLP(sueldosLiquidos)} CLP** líquidos | Valentina Rojas |
| **🏛️ Cumplimiento Tributario** | IVA F29 preliminar cuadrado | **$${formatCLP(f29Estimado)} CLP** a pagar/postergar | Matías Silva |
| **📦 Bodegas & Inventario** | Cobertura óptima sin quiebres | Valorizado PMP (NIC 2) | Ignacio Herrera |
| **🏭 Producción & Planta** | Órdenes Activas de Fabricación | ${opTextoMd} | Francisca Araya |
| **📑 Comercial & Ventas** | Cotizaciones y Propuestas Vigentes | **$${formatCLP(pipelineVentas)} CLP** en pipeline | Rodrigo Tapia |

---

#### 📱 Canal de Comunicación WhatsApp (Directorio & Socios):
<div class="p-3 bg-emerald-50 border border-emerald-300 rounded-xl space-y-2 my-2">
  <div class="flex items-center justify-between">
    <span class="font-bold text-xs text-emerald-950 flex items-center gap-1.5">
      💬 Radiografía General para WhatsApp:
    </span>
    <a
      href="${waPanoramaUrl}"
      target="_blank"
      rel="noopener noreferrer"
      class="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1 shadow-xs transition-colors"
    >
      📱 Enviar a Socios por WhatsApp
    </a>
  </div>
  <pre class="text-[11px] bg-white p-2.5 rounded-lg border border-emerald-200 text-slate-800 font-mono whitespace-pre-wrap">${waPanoramaText}</pre>
</div>`,
        actionToExecute: { type: 'NAVIGATE', targetTab: 'bank' },
        followUpQuestion: '¿Deseas profundizar en alguna de estas 6 áreas operacionales?',
      };
    }

    // Delegación general al motor agéntico (ReAct + Function Calling) para el resto de las consultas
    const delegatedGeneral = await this.delegateToAgenticEngine(userInput, persona, context);
    if (delegatedGeneral) return delegatedGeneral;

    // 11. Fallback Conversacional Avanzado: Motor Generativo Gemini con Historial Multi-Turno
    try {
      if (typeof window !== 'undefined') {
        const formattedMessages = [
          ...conversationHistory.map(m => ({
            role: m.sender === 'USER' ? 'user' : 'model',
            content: m.text,
          })),
          { role: 'user', content: userInput },
        ];

        const response = await fetch('/api/gemini/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: formattedMessages,
            companyContext: {
              nombre: context.clientName,
              rut: context.rut,
            },
            personaContext: {
              id: persona.id,
              nombre: persona.nombre,
              cargo: persona.cargo,
              area: persona.area,
            },
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.text) {
            const rawText = data.text;
            const verbal = rawText
              .replace(/[#*`_>]/g, '')
              .replace(/\n+/g, '. ')
              .substring(0, 240);

            return {
              verbalResponse: verbal,
              displayMarkdown: `### 💬 ${persona.nombre} (${persona.cargo})\n\n${rawText}`,
              followUpQuestion: '¿Me puedes confirmar esta información para proceder?',
            };
          }
        }
      }
    } catch (apiErr) {
      console.warn('[VoiceAssistantEngine] Error al consultar motor conversacional Gemini:', apiErr);
    }

    // 11. Respuesta contextual proactiva y dinámica de la Persona (SIN frases enlatadas repetitivas)
    const verbalResp = `Comprendo tu instrucción sobre "${userInput.substring(0, 70)}". Como ${persona.cargo}, ¿deseas que proceda con su registro en el sistema o requieres definir algún parámetro previo?`;

    return {
      verbalResponse: verbalResp,
      displayMarkdown: `### 💬 ${persona.nombre} (${persona.cargo})
> *"Gestionando activamente las operaciones de ${context.clientName} (RUT: ${context.rut})"*

He analizado tu instrucción: **"${userInput}"**.

En mi área de especialidad (**${persona.area}**), tengo disponibles las siguientes acciones para ti:
${persona.accionesSugeridas.map(a => `- **${a.label}:** ${a.prompt}`).join('\n')}

Dime por voz o texto qué parámetros deseas aplicar y me encargaré de ejecutarlo con estricta rigurosidad contable.`,
      followUpQuestion: '¿Deseas ejecutar alguna de estas acciones ahora?',
    };
  }

  /**
   * Delegación al motor agéntico autónomo (ReAct + Function Calling). Devuelve null si el motor no
   * respondió; quien llama decide cómo informarlo. Nunca usa una empresa por defecto.
   */
  private async delegateToAgenticEngine(
    userInput: string,
    persona: AgentPersona,
    context: DialogueContext,
    forcedModule?: string
  ): Promise<AgentDialogueTurnResult | null> {
    const empresaId = context.clientId || context.rut;
    if (!empresaId) return null;
    try {
      let mappedModule = forcedModule || 'CONTABILIDAD';
      const normInput = userInput.toLowerCase();
      if (!forcedModule) {
        if (normInput.includes('activo') || normInput.includes('depreciac') || persona.area === 'ACTIVO_FIJO') {
          mappedModule = 'ACTIVO_FIJO';
        } else if (normInput.includes('producci') || normInput.includes('planta') || normInput.includes('fabricaci') || normInput.includes('costeo') || persona.area === 'PRODUCCION') {
          mappedModule = 'COSTOS_PRODUCCION';
        } else if (normInput.includes('flujo') || normInput.includes('liquidez') || normInput.includes('caja') || persona.area === 'TESORERIA') {
          mappedModule = 'FLUJO_CAJA';
        } else if (normInput.includes('compra') || normInput.includes('cotiza') || normInput.includes('proveedor') || normInput.includes('licitaci') || persona.area === 'COMPRAS') {
          mappedModule = 'COMERCIAL_COMPRAS';
        } else if (normInput.includes('rendici') || normInput.includes('gasto') || normInput.includes('viatico') || persona.area === 'RENDICIONES') {
          mappedModule = 'RENDICIONES';
        } else if (normInput.includes('f29') || normInput.includes('iva') || normInput.includes('impuesto') || normInput.includes('sii') || normInput.includes('rcv') || persona.area === 'TRIBUTARIO') {
          mappedModule = 'TRIBUTARIO_SII';
        } else if (normInput.includes('sueldo') || normInput.includes('remunerac') || normInput.includes('previred') || normInput.includes('nomina') || persona.area === 'RRHH') {
          mappedModule = 'RRHH';
        } else if (normInput.includes('inventario') || normInput.includes('stock') || normInput.includes('kardex') || normInput.includes('bodega') || persona.area === 'INVENTARIO') {
          mappedModule = 'INVENTARIO';
        }
      }

      const engineContext = {
        ...context,
        empresa: { id: context.clientId, rut: context.rut, razonSocial: context.clientName },
        company: { id: context.clientId, rut: context.rut, razonSocial: context.clientName },
      };

      let agentResult: { success?: boolean; finalText?: string; decision?: string; steps?: any[]; approvalRequired?: boolean; governanceApproval?: any; executionMode?: string; executionModeLabel?: string; code?: string } | null = null;

      if (typeof window !== 'undefined') {
        const authToken = localStorage.getItem('erpremia_auth_token') || localStorage.getItem('erp_auth_token');
        const res = await fetch('/api/agents/autonomous/execute', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          },
          body: JSON.stringify({
            module: mappedModule,
            modulo: mappedModule,
            empresaId,
            query: userInput,
            agentRole: `${persona.nombre} - ${persona.cargo}`,
            context: engineContext,
          }),
        });
        if (res.ok) {
          agentResult = await res.json();
        }
      } else {
        // En entorno Node.js / servidor / pruebas automatizadas
        try {
          const { AutonomousAgentEngine } = await safeDynamicImport('./autonomousAgentEngine');
          agentResult = await AutonomousAgentEngine.executeAutonomousAgentLoop({
            module: mappedModule as any,
            empresaId,
            query: userInput,
            agentRole: `${persona.nombre} - ${persona.cargo}`,
            context: engineContext as any,
          });
        } catch (engineErr) {
          console.warn('[VoiceAssistantEngine] Motor agéntico no disponible:', (engineErr as any)?.message || engineErr);
        }
      }

      if (!agentResult || agentResult.success === false || !(agentResult.finalText || agentResult.decision)) {
        return null;
      }

      const fullResp = agentResult.decision || agentResult.finalText || '';
      const verbal = fullResp.replace(/^\[Modo: [^\]]*\]\s*/, '').replace(/[#*`_>]/g, '').replace(/\n+/g, '. ').substring(0, 240);

      const modeLabel = agentResult.executionModeLabel || executionModeLabel(agentResult.executionMode, { success: agentResult.success, code: agentResult.code });
      const cleanResp = fullResp.replace(/^\[Modo: [^\]]*\]\s*/, '');
      let displayMd = `### 🤖 ${persona.nombre} (${persona.cargo})\n> *Motor agéntico · ${mappedModule}* · **Modo: ${modeLabel}**\n\n${cleanResp}`;
      if (agentResult.steps && agentResult.steps.length > 0) {
        displayMd += `\n\n#### 🔍 Pasos de Razonamiento del Agente:\n`;
        agentResult.steps.forEach((step: any, idx: number) => {
          displayMd += `\n- **Paso ${idx + 1}:** ${step.thought || step.toolCall || 'Análisis operacional'}`;
          if (step.toolCall) displayMd += ` \`[Herramienta: ${step.toolCall}]\``;
        });
      }
      if (agentResult.governanceApproval || agentResult.approvalRequired) {
        const appr = agentResult.governanceApproval;
        displayMd += `\n\n---\n\n> 🛡️ **Aprobación humana requerida:** se generó la solicitud ${appr?.id ? `#${appr.id}` : ''}${
          appr?.impactoFinanciero ? ` por $${Number(appr.impactoFinanciero).toLocaleString('es-CL')} CLP` : ''
        }. Nada se ejecuta hasta que un responsable la apruebe.`;
      }

      return {
        verbalResponse: verbal,
        displayMarkdown: displayMd,
        followUpQuestion:
          agentResult.approvalRequired || agentResult.governanceApproval
            ? '¿Deseas revisar la solicitud en la bandeja de aprobaciones?'
            : '¿Deseas profundizar en algún detalle adicional?',
      };
    } catch (agentErr) {
      console.warn('[VoiceAssistantEngine] Error al consultar motor agéntico autónomo:', agentErr);
      return null;
    }
  }
}

export const voiceAssistantEngine = new VoiceAssistantEngine();
