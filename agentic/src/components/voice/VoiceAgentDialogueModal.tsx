import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Send, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  Layers, 
  RotateCcw, 
  Sliders, 
  ArrowRight,
  Bot,
  User,
  ShieldCheck,
  Building2,
  Calendar,
  MessageSquare
} from 'lucide-react';
import { AgentPersona } from '../../types/agentPersona';
import { agentPersonasStorage } from '../../services/agentPersonasStorage';
import { voiceAssistantEngine, AgentDialogueTurnResult } from '../../services/voiceAssistantEngine';
import { CompanyProfile, DteDocument, CashFlowMovement, BankStatementMovement, F29Declaration } from '../../types';
import { formatCLP } from '../../utils/chileanAccounting';

interface VoiceAgentDialogueModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeClientId: string;
  company: CompanyProfile;
  initialPersonaId?: string;
  onOpenConfig?: () => void;
  // Acciones reales de negocio del ERP que los agentes pueden ejecutar
  onCentralizePurchases?: () => Promise<string | void> | void;
  onCentralizeSales?: () => Promise<string | void> | void;
  onReconcileBank?: () => Promise<string | void> | void;
  onCalculateF29?: () => Promise<string | void> | void;
  onCentralizeExpenses?: () => Promise<string | void> | void;
  onNavigateToTab?: (tabId: string) => void;
  // Datos contextuales del ERP para auditoría en tiempo real
  dtes?: DteDocument[];
  bankMovements?: BankStatementMovement[];
  f29?: F29Declaration;
  employeesCount?: number;
  inventoryCount?: number;
  expensesCount?: number;
}

interface ChatMessage {
  id: string;
  sender: 'AGENT' | 'USER';
  personaName: string;
  text: string;
  markdown?: string;
  timestamp: string;
  isExecuting?: boolean;
  actionResult?: string;
}

export const VoiceAgentDialogueModal: React.FC<VoiceAgentDialogueModalProps> = ({
  isOpen,
  onClose,
  activeClientId,
  company,
  initialPersonaId = 'CONTABILIDAD_SENIOR',
  onOpenConfig,
  onCentralizePurchases,
  onCentralizeSales,
  onReconcileBank,
  onCalculateF29,
  onCentralizeExpenses,
  onNavigateToTab,
  dtes = [],
  bankMovements = [],
  f29,
  employeesCount = 6,
  inventoryCount = 18,
  expensesCount = 2,
}) => {
  const [personas, setPersonas] = useState<AgentPersona[]>(() => 
    agentPersonasStorage.getPersonas(activeClientId)
  );
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>(initialPersonaId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [transcribedText, setTranscribedText] = useState<string>('');
  const [textInput, setTextInput] = useState<string>('');
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const latestTranscribedTextRef = useRef<string>('');
  const isListeningRef = useRef<boolean>(false);
  const selectedPersona = personas.find(p => p.id === selectedPersonaId) || personas[0];

  const clearSilenceTimer = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  // Auto-scroll al último mensaje
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, transcribedText]);

  // Cargar personas al abrir el modal o cambiar de cliente
  useEffect(() => {
    if (isOpen) {
      const list = agentPersonasStorage.getPersonas(activeClientId);
      setPersonas(list);
      if (initialPersonaId) {
        setSelectedPersonaId(initialPersonaId);
      }
    }
  }, [isOpen, activeClientId, initialPersonaId]);

  // Inicializar conversación cuando cambia la persona seleccionada
  useEffect(() => {
    if (!isOpen || !selectedPersona) return;

    // Detener cualquier audio previo
    clearSilenceTimer();
    voiceAssistantEngine.stopSpeaking();
    voiceAssistantEngine.stopListening();
    setIsListening(false);
    isListeningRef.current = false;

    // Mensaje de apertura de la persona
    const initialGreeting = selectedPersona.saludoPersonal;
    const initialMsg: ChatMessage = {
      id: `msg-agent-init-${Date.now()}`,
      sender: 'AGENT',
      personaName: selectedPersona.nombre,
      text: initialGreeting,
      markdown: `### 🎙️ ${selectedPersona.nombre} (${selectedPersona.cargo})\n\n> *"${initialGreeting}"*\n\n¿Qué acción deseas que ejecutemos hoy? Puedes presionar el **micrófono para hablar** o seleccionar una de las acciones sugeridas a continuación:`,
      timestamp: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages([initialMsg]);

    // Pronunciar saludo inicial con la voz de la persona si no está silenciado
    if (!isAudioMuted) {
      setIsSpeaking(true);
      voiceAssistantEngine.speak(initialGreeting, selectedPersona, {
        onEnd: () => setIsSpeaking(false),
        onError: () => setIsSpeaking(false),
      });
    }
  }, [selectedPersonaId, isOpen]);

  // Cleanup al cerrar el modal o desmontar componente
  useEffect(() => {
    return () => {
      clearSilenceTimer();
      voiceAssistantEngine.stopSpeaking();
      voiceAssistantEngine.stopListening();
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      clearSilenceTimer();
      voiceAssistantEngine.stopSpeaking();
      voiceAssistantEngine.stopListening();
      setIsSpeaking(false);
      setIsListening(false);
      isListeningRef.current = false;
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Manejar envío de mensaje del usuario (por voz o texto)
  const handleUserSubmit = async (inputQuery: string) => {
    const trimmed = inputQuery.trim();
    if (!trimmed || isProcessing) return;

    clearSilenceTimer();
    voiceAssistantEngine.stopListening();
    setIsListening(false);
    isListeningRef.current = false;
    setTranscribedText('');
    latestTranscribedTextRef.current = '';
    setTextInput('');

    // Agregar mensaje del usuario
    const userMsg: ChatMessage = {
      id: `msg-user-${Date.now()}`,
      sender: 'USER',
      personaName: 'Tú',
      text: trimmed,
      timestamp: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages(prev => [...prev, userMsg]);
    setIsProcessing(true);

    try {
      // Calcular métricas contextuales para el motor agéntico
      const purchasesPending = dtes.filter(d => d.tipoOperacion === 'COMPRA').length;
      const salesPending = dtes.filter(d => d.tipoOperacion === 'VENTA').length;
      const bankNoveltiesPending = bankMovements.filter(m => m.estado !== 'CONCILIADO').length;
      const f29Iva = f29 ? (f29.debitoFiscalIva - f29.creditoFiscalIva) : 0;

      // Procesar intención del diálogo con memoria multi-turno completa
      const result: AgentDialogueTurnResult = await voiceAssistantEngine.processDialogue(
        trimmed,
        selectedPersona,
        {
          clientName: company.razonSocial || company.nombreFantasia,
          rut: company.rut,
          dtesCount: dtes.length,
          pendingPurchasesCount: purchasesPending,
          pendingSalesCount: salesPending,
          bankAccountsCount: 2,
          pendingBankNoveltiesCount: bankNoveltiesPending,
          f29IvaTotal: f29Iva,
          employeesCount,
          inventoryItemsCount: inventoryCount,
          pendingExpensesCount: expensesCount,
        },
        [...messages, userMsg]
      );

      // Ejecutar acción real en el ERP si aplica
      let actionFeedback = '';
      if (result.actionToExecute) {
        if (result.actionToExecute.type === 'CENTRALIZE_COMPRAS' && onCentralizePurchases) {
          await onCentralizePurchases();
          actionFeedback = '✅ Asiento de centralización de compras registrado en Libro Diario.';
        } else if (result.actionToExecute.type === 'CENTRALIZE_VENTAS' && onCentralizeSales) {
          await onCentralizeSales();
          actionFeedback = '✅ Asiento de centralización de ventas registrado en Libro Diario.';
        } else if (result.actionToExecute.type === 'RECONCILE_BANK' && onReconcileBank) {
          await onReconcileBank();
          actionFeedback = '✅ Novedades bancarias conciliadas y asientos generados.';
        } else if (result.actionToExecute.type === 'CALCULATE_F29' && onCalculateF29) {
          await onCalculateF29();
          actionFeedback = '✅ F29 recalculado y actualizado en el sistema.';
        } else if (result.actionToExecute.type === 'CENTRALIZE_EXPENSES' && onCentralizeExpenses) {
          await onCentralizeExpenses();
          actionFeedback = '✅ Rendiciones de gastos aprobadas y centralizadas.';
        } else if (result.actionToExecute.type === 'NAVIGATE' && onNavigateToTab && result.actionToExecute.targetTab) {
          onNavigateToTab(result.actionToExecute.targetTab);
          actionFeedback = `✅ Te he redirigido al módulo correspondiente.`;
        }
      }

      // Agregar respuesta del agente
      const agentMsg: ChatMessage = {
        id: `msg-agent-${Date.now()}`,
        sender: 'AGENT',
        personaName: selectedPersona.nombre,
        text: result.verbalResponse,
        markdown: result.displayMarkdown,
        actionResult: actionFeedback,
        timestamp: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, agentMsg]);

      // Pronunciar respuesta del agente por voz
      if (!isAudioMuted) {
        setIsSpeaking(true);
        voiceAssistantEngine.speak(result.verbalResponse, selectedPersona, {
          onEnd: () => setIsSpeaking(false),
          onError: () => setIsSpeaking(false),
        });
      }
    } catch (err: any) {
      console.error('[VoiceAgentDialogueModal] Error procesando turno:', err);
      const errorMsg: ChatMessage = {
        id: `msg-error-${Date.now()}`,
        sender: 'AGENT',
        personaName: selectedPersona.nombre,
        text: 'Disculpa, ocurrió un inconveniente temporal al ejecutar la acción.',
        markdown: `⚠️ **Aviso:** Ocurrió un error al procesar la solicitud: ${err?.message || 'Error desconocido'}.`,
        timestamp: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsProcessing(false);
    }
  };

  // Activar o desactivar escucha por micrófono con debounce de silencio de 2.8s
  const handleToggleListening = () => {
    if (isListening) {
      clearSilenceTimer();
      voiceAssistantEngine.stopListening();
      setIsListening(false);
      isListeningRef.current = false;
      const textToSend = latestTranscribedTextRef.current.trim() || transcribedText.trim();
      if (textToSend) {
        handleUserSubmit(textToSend);
      }
    } else {
      clearSilenceTimer();
      voiceAssistantEngine.stopSpeaking();
      setIsSpeaking(false);
      setTranscribedText('');
      latestTranscribedTextRef.current = '';
      setIsListening(true);
      isListeningRef.current = true;

      voiceAssistantEngine.startListening({
        onResult: (text, _isFinal) => {
          latestTranscribedTextRef.current = text;
          setTranscribedText(text);

          clearSilenceTimer();

          // Solo programar auto-envío si hay texto detectado
          if (text.trim().length > 0) {
            // Pausa de 2.8 segundos de silencio antes de auto-enviar
            // Esto permite al usuario pensar 1-2 segundos sin ser interrumpido
            silenceTimerRef.current = setTimeout(() => {
              const textToSubmit = latestTranscribedTextRef.current.trim();
              if (textToSubmit && isListeningRef.current) {
                clearSilenceTimer();
                voiceAssistantEngine.stopListening();
                setIsListening(false);
                isListeningRef.current = false;
                handleUserSubmit(textToSubmit);
              }
            }, 2800);
          }
        },
        onEnd: () => {
          // Si el micro se desconectó y hay texto pendiente
          if (isListeningRef.current && latestTranscribedTextRef.current.trim()) {
            const textToSubmit = latestTranscribedTextRef.current.trim();
            clearSilenceTimer();
            setIsListening(false);
            isListeningRef.current = false;
            handleUserSubmit(textToSubmit);
          } else {
            setIsListening(false);
            isListeningRef.current = false;
            clearSilenceTimer();
          }
        },
        onError: (err) => {
          console.warn('[VoiceAgentDialogueModal] Micrófono error:', err);
          setIsListening(false);
          isListeningRef.current = false;
          clearSilenceTimer();
        },
      });
    }
  };

  // Silenciar o activar voz
  const handleToggleMute = () => {
    if (isSpeaking) {
      voiceAssistantEngine.stopSpeaking();
      setIsSpeaking(false);
    }
    setIsAudioMuted(!isAudioMuted);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col h-[90vh] max-h-[820px] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header Superior: Persona Activa, Selector de Área & Controles de Audio */}
        <div className="px-5 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700/80 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3.5 min-w-0">
            {/* Avatar Pulsante de la Persona */}
            <div className="relative">
              <div 
                className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-extrabold text-base shadow-lg transition-transform ${isSpeaking ? 'scale-105 ring-4 ring-blue-500/50' : ''}`}
                style={{ backgroundColor: selectedPersona.color }}
              >
                {selectedPersona.nombre.split(' ').map(n => n[0]).slice(0, 2).join('')}
              </div>
              <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-slate-900 ${isSpeaking ? 'bg-blue-400 animate-ping' : 'bg-emerald-400'}`} />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-white truncate">
                  {selectedPersona.nombre}
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 shrink-0">
                  {selectedPersona.sexo === 'FEMENINO' ? 'Jefa' : 'Jefe'} de Área
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate">
                {selectedPersona.cargo}
              </p>
            </div>
          </div>

          {/* Selector de Persona y Botones de Control */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Dropdown de Cambio Rápido de Agente */}
            <select
              value={selectedPersonaId}
              onChange={(e) => setSelectedPersonaId(e.target.value)}
              className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs rounded-xl px-2.5 py-1.5 font-medium focus:ring-1 focus:ring-blue-500 focus:outline-hidden cursor-pointer"
            >
              {personas.map(p => (
                <option key={p.id} value={p.id}>
                  {p.nombre} ({p.area.split(',')[0]})
                </option>
              ))}
            </select>

            {/* Botón Silenciar Voz */}
            <button
              type="button"
              onClick={handleToggleMute}
              className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                isAudioMuted
                  ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                  : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
              }`}
              title={isAudioMuted ? 'Activar voz del agente' : 'Silenciar voz del agente'}
            >
              {isAudioMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {/* Botón Configuración de Personas y Voces */}
            {onOpenConfig && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenConfig();
                }}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors cursor-pointer"
                title="Configurar nombres, sexos y voces de los agentes"
              >
                <Sliders className="w-4 h-4" />
              </button>
            )}

            {/* Cerrar Modal */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Barra de Visualización de Audio y Ondas de Voz */}
        <div className="bg-slate-950/60 border-b border-slate-800/80 px-6 py-2.5 flex items-center justify-between text-xs font-mono shrink-0">
          <div className="flex items-center gap-3">
            {isSpeaking ? (
              <div className="flex items-center gap-2 text-blue-400 font-bold">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-3 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-4 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  <span className="w-1.5 h-6 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '450ms' }} />
                </span>
                <span>{selectedPersona.nombre} está hablando...</span>
              </div>
            ) : isListening ? (
              <div className="flex items-center gap-2 text-rose-400 font-bold animate-pulse">
                <Mic className="w-4 h-4 text-rose-500" />
                <span>Escuchándote... (pausa de 2.8s para enviar o pulsa "Enviar ahora")</span>
              </div>
            ) : isProcessing ? (
              <div className="flex items-center gap-2 text-amber-400 font-bold">
                <Sparkles className="w-4 h-4 animate-spin text-amber-400" />
                <span>Ejecutando acción responsable en el ERP...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-slate-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>Listo para dialogar con {company.razonSocial || company.nombreFantasia}</span>
              </div>
            )}
          </div>

          <div className="text-[11px] text-slate-500 hidden sm:block">
            Voz: {selectedPersona.voz.voiceURI ? selectedPersona.voz.voiceURI.slice(0, 25) : 'Auto'} • Tono: {selectedPersona.voz.pitch.toFixed(2)}
          </div>
        </div>

        {/* Área Central de Conversación */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-gradient-to-b from-slate-900 to-slate-950">
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex gap-3 max-w-[88%] ${
                msg.sender === 'USER' ? 'ml-auto flex-row-reverse' : 'mr-auto'
              }`}
            >
              {/* Avatar del Emisor */}
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${
                  msg.sender === 'USER'
                    ? 'bg-blue-600 text-white'
                    : 'text-white'
                }`}
                style={msg.sender === 'AGENT' ? { backgroundColor: selectedPersona.color } : {}}
              >
                {msg.sender === 'USER' ? <User className="w-4 h-4" /> : selectedPersona.nombre[0]}
              </div>

              {/* Burbuja de Mensaje */}
              <div
                className={`rounded-2xl p-4 text-xs sm:text-sm leading-relaxed ${
                  msg.sender === 'USER'
                    ? 'bg-blue-600 text-white shadow-md rounded-tr-none'
                    : 'bg-slate-800/90 text-slate-200 border border-slate-700 shadow-md rounded-tl-none'
                }`}
              >
                <div className="flex items-center justify-between gap-3 text-[10px] text-slate-400 mb-1.5 font-mono">
                  <span className="font-bold text-slate-300">{msg.personaName}</span>
                  <span>{msg.timestamp}</span>
                </div>

                {/* Contenido en Markdown o Texto */}
                <div className="whitespace-pre-wrap space-y-2">
                  {msg.markdown ? (
                    <div className="prose prose-invert prose-xs max-w-none">
                      {msg.markdown}
                    </div>
                  ) : (
                    <p>{msg.text}</p>
                  )}
                </div>

                {/* Banner de Acción Ejecutada si aplica */}
                {msg.actionResult && (
                  <div className="mt-3 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-medium flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{msg.actionResult}</span>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Transcripción en vivo del micrófono con botón de envío instantáneo */}
          {transcribedText && (
            <div className="flex gap-3 max-w-[85%] ml-auto flex-row-reverse animate-in fade-in">
              <div className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center text-xs font-bold shrink-0 animate-pulse">
                <Mic className="w-4 h-4" />
              </div>
              <div className="bg-rose-500/20 border border-rose-500/40 rounded-2xl p-3.5 text-rose-200 text-xs font-mono space-y-2">
                <p className="italic font-sans text-sm">"{transcribedText}..."</p>
                <div className="flex items-center justify-between gap-3 pt-1 border-t border-rose-500/30 text-[11px]">
                  <span className="text-rose-300/80">Pausa para enviar o pulsa:</span>
                  <button
                    type="button"
                    onClick={() => {
                      clearSilenceTimer();
                      voiceAssistantEngine.stopListening();
                      setIsListening(false);
                      isListeningRef.current = false;
                      const textToSend = latestTranscribedTextRef.current.trim() || transcribedText.trim();
                      if (textToSend) handleUserSubmit(textToSend);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-sm"
                  >
                    <Send className="w-3 h-3" />
                    <span>Enviar ahora</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Barra de Acciones Sugeridas ("One-Touch Prompts") */}
        <div className="bg-slate-900/90 border-t border-slate-800 px-4 py-2.5 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 shrink-0 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-indigo-400" />
            Acciones de {selectedPersona.nombre.split(' ')[0]}:
          </span>
          {selectedPersona.accionesSugeridas.map(act => (
            <button
              key={act.id}
              type="button"
              onClick={() => handleUserSubmit(act.prompt)}
              className="text-xs px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-indigo-600/30 hover:border-indigo-500 text-slate-300 hover:text-white border border-slate-700 transition-all shrink-0 cursor-pointer flex items-center gap-1.5 font-medium"
            >
              <span>{act.label}</span>
              <ArrowRight className="w-3 h-3 text-slate-500" />
            </button>
          ))}
        </div>

        {/* Barra Inferior: Micrófono y Entrada de Texto */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 shrink-0 flex items-center gap-3">
          {/* Botón Principal de Micrófono */}
          <button
            type="button"
            onClick={handleToggleListening}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-lg shrink-0 cursor-pointer ${
              isListening
                ? 'bg-rose-600 hover:bg-rose-500 text-white ring-4 ring-rose-500/40 animate-pulse'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white hover:scale-105'
            }`}
            title={isListening ? 'Detener micrófono' : 'Hablar por micrófono con el agente'}
          >
            {isListening ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>

          {/* Input de Texto como Fallback / Complemento */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleUserSubmit(textInput);
            }}
            className="flex-1 flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-2xl px-3.5 py-1.5 focus-within:border-indigo-500 transition-colors"
          >
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder={isListening ? 'Escuchando tu voz...' : `Escribe una instrucción para ${selectedPersona.nombre} o habla con el micrófono...`}
              disabled={isListening || isProcessing}
              className="flex-1 bg-transparent text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-hidden"
            />
            <button
              type="submit"
              disabled={!textInput.trim() || isProcessing}
              className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white transition-colors cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};
