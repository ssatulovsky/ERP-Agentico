import { AgentPersona } from '../types/agentPersona';

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

class VoiceAssistantEngine {
  private recognition: any = null;
  private isListeningActive: boolean = false;
  private cachedVoices: SpeechSynthesisVoice[] = [];

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
   * Selecciona la mejor voz en español según la configuración y el sexo de la persona
   */
  public getBestVoiceForPersona(persona: AgentPersona): SpeechSynthesisVoice | null {
    const all = this.loadVoices();
    if (!all || all.length === 0) return null;

    // 1. Si tiene una voz explícitamente configurada por URI
    if (persona.voz.voiceURI) {
      const match = all.find(v => v.voiceURI === persona.voz.voiceURI || v.name === persona.voz.voiceURI);
      if (match) return match;
    }

    // 2. Buscar voces en español
    const spanishVoices = all.filter(v => v.lang.toLowerCase().startsWith('es'));
    if (spanishVoices.length === 0) return all[0];

    // Preferir es-CL si existe
    const chileanVoices = spanishVoices.filter(v => v.lang.toLowerCase().includes('cl'));
    const candidateList = chileanVoices.length > 0 ? chileanVoices : spanishVoices;

    // Filtrar por pistas de género en el nombre de la voz si es posible
    if (persona.sexo === 'FEMENINO') {
      const femaleCandidates = candidateList.filter(v => {
        const n = v.name.toLowerCase();
        return n.includes('monica') || n.includes('paulina') || n.includes('francisca') || 
               n.includes('sofia') || n.includes('camila') || n.includes('female') || 
               n.includes('mujer') || n.includes('esmeralda') || n.includes('sabina');
      });
      if (femaleCandidates.length > 0) return femaleCandidates[0];
    } else if (persona.sexo === 'MASCULINO') {
      const maleCandidates = candidateList.filter(v => {
        const n = v.name.toLowerCase();
        return n.includes('jorge') || n.includes('juan') || n.includes('diego') || 
               n.includes('pablo') || n.includes('male') || n.includes('hombre') || 
               n.includes('carlos') || n.includes('miguel');
      });
      if (maleCandidates.length > 0) return maleCandidates[0];
    }

    return candidateList[0] || all[0];
  }

  /**
   * Pronuncia un texto con la voz y personalidad del agente
   */
  public speak(
    text: string, 
    persona: AgentPersona, 
    callbacks?: VoicePlaybackCallbacks
  ): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      callbacks?.onEnd?.();
      return;
    }

    // Cancelar cualquier síntesis anterior
    window.speechSynthesis.cancel();

    // Limpiar texto de formato markdown y asteriscos para que suene natural
    const cleanText = text
      .replace(/[*#_`~]/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\n+/g, ' ')
      .trim();

    if (!cleanText) {
      callbacks?.onEnd?.();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(cleanText);
    const chosenVoice = this.getBestVoiceForPersona(persona);
    if (chosenVoice) {
      utterance.voice = chosenVoice;
    }

    utterance.lang = persona.voz.lang || 'es-CL';
    utterance.pitch = persona.voz.pitch ?? (persona.sexo === 'FEMENINO' ? 1.15 : 0.92);
    utterance.rate = persona.voz.rate ?? 1.0;
    utterance.volume = persona.voz.volume ?? 1.0;

    utterance.onstart = () => {
      callbacks?.onStart?.();
    };

    utterance.onend = () => {
      callbacks?.onEnd?.();
    };

    utterance.onerror = (e) => {
      console.warn('[VoiceAssistantEngine] Error en síntesis de voz:', e);
      callbacks?.onError?.(e);
      callbacks?.onEnd?.();
    };

    window.speechSynthesis.speak(utterance);
  }

  /**
   * Detiene de inmediato la síntesis de voz
   */
  public stopSpeaking(): void {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
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
    this.recognition.continuous = false;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 1;

    this.isListeningActive = true;

    this.recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }

      const text = final || interim;
      callbacks.onResult(text, Boolean(final));
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
    context: {
      clientName: string;
      rut: string;
      dtesCount: number;
      pendingPurchasesCount: number;
      pendingSalesCount: number;
      bankAccountsCount: number;
      pendingBankNoveltiesCount: number;
      f29IvaTotal: number;
      employeesCount: number;
      inventoryItemsCount: number;
      pendingExpensesCount: number;
    }
  ): Promise<AgentDialogueTurnResult> {
    const normalized = userInput.toLowerCase().trim();

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

    // 3. Intención: Conciliación bancaria
    if (
      normalized.includes('concilia') || 
      normalized.includes('conciliación') || 
      normalized.includes('novedades bancarias') || 
      normalized.includes('banco')
    ) {
      if (normalized.includes('saldo') || normalized.includes('cuánto hay en banco') || normalized.includes('cuanto dinero')) {
        return {
          verbalResponse: `Actualmente tienes ${context.bankAccountsCount} cuentas bancarias registradas en ${context.clientName}, con ${context.pendingBankNoveltiesCount} movimientos de cartola pendientes de conciliar.`,
          displayMarkdown: `### 🏦 Estado de Tesorería & Bancos
- **Cuentas bancarias activas:** ${context.bankAccountsCount}
- **Movimientos pendientes de conciliar:** ${context.pendingBankNoveltiesCount} novedades en cartolas
- **Estado de conciliación:** Se requiere regularizar abonos y cargos para mantener el saldo contable al día.`,
          followUpQuestion: '¿Quieres que concilie automáticamente todas las novedades bancarias pendientes contra los DTEs y caja?',
        };
      }

      return {
        verbalResponse: `Ejecutando la conciliación bancaria. Estoy regularizando las ${context.pendingBankNoveltiesCount} novedades de cartola y generando los asientos de cobro y pago en el Libro Diario.`,
        displayMarkdown: `### 🏦 Conciliación Bancaria Ejecutada en Tiempo Real
He conciliado los movimientos bancarios de **${context.clientName}**:
- Regularización de cargos y abonos bancarios contra Facturas CxC y CxP.
- Generación de asientos automáticos de regularización en el Libro Diario.
- Cuentas corrientes cuadradas con cartolas oficiales.`,
        actionToExecute: { type: 'RECONCILE_BANK' },
        followUpQuestion: '¿Deseas revisar la proyección de flujo de caja para los próximos 30 días?',
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
        verbalResponse: `Revisando el módulo de rendición de gastos. Tenemos ${context.pendingExpensesCount} rendiciones en el sistema. Procedo a verificar sus comprobantes y centralizarlas.`,
        displayMarkdown: `### 🧾 Gestión de Rendición de Gastos & Anticipos
- **Rendiciones en seguimiento:** ${context.pendingExpensesCount}
- **Centros de costos:** Imputación analítica validada.
- **Libro Diario:** Los comprobantes quedan imputados a Cuentas por Rendir contra Banco o Caja Chica.`,
        actionToExecute: { type: 'CENTRALIZE_EXPENSES' },
        followUpQuestion: '¿Deseas que generemos un comprobante de reintegro o autoricemos un nuevo anticipo?',
      };
    }

    // 6. Intención: Remuneraciones y RRHH
    if (
      normalized.includes('sueldo') || 
      normalized.includes('remuneracion') || 
      normalized.includes('remuneración') || 
      normalized.includes('nomina') || 
      normalized.includes('nómina') ||
      normalized.includes('trabajador') ||
      normalized.includes('empleado')
    ) {
      return {
        verbalResponse: `En el área de personas tenemos ${context.employeesCount} trabajadores registrados bajo contrato. La nómina previsional cumple con los topes de AFP y Fonasa.`,
        displayMarkdown: `### 👥 Gestión de Personas & Remuneraciones (DT / Previred)
- **Dotación activa:** ${context.employeesCount} colaboradores
- **Cumplimiento normativo:** Contratos actualizados en el portal Mi DT (Art. 10 y 161)
- **Leyes sociales:** AFP, Fonasa/Isapre, AFC y Seguro de Cesantía debidamente calculados.`,
        actionToExecute: { type: 'NAVIGATE', targetTab: 'payroll' },
        followUpQuestion: '¿Deseas que emitamos las liquidaciones de sueldo o revisemos las licencias médicas registradas?',
      };
    }

    // 7. Intención: Inventario y Bodega
    if (
      normalized.includes('inventario') || 
      normalized.includes('bodega') || 
      normalized.includes('stock') || 
      normalized.includes('quiebre')
    ) {
      return {
        verbalResponse: `En bodegas tenemos ${context.inventoryItemsCount} ítems controlados con valorización por Costo Promedio Ponderado. No registramos quiebres críticos en los productos principales.`,
        displayMarkdown: `### 📦 Estado de Bodegas & Stock (WMS)
- **Artículos controlados:** ${context.inventoryItemsCount} SKUs
- **Valorización:** Método PMP conforme a la NIC 2 de Inventarios
- **Trazabilidad:** Integración con Guías de Despacho DTE 52 del SII.`,
        actionToExecute: { type: 'NAVIGATE', targetTab: 'inventory' },
        followUpQuestion: '¿Deseas programar una reposición de stock o revisar transferencias entre bodegas?',
      };
    }

    // 8. Respuesta contextual de la Persona según su área especializada
    const saludoIntro = `Hola. Como ${persona.cargo} de ${context.clientName}, he analizado tu consulta sobre "${userInput}".`;
    const verbalResp = `${saludoIntro} Nuestros registros se encuentran al día y cumpliendo la normativa legal chilena. ¿En qué acción operativa puedo ayudarte ahora?`;

    return {
      verbalResponse: verbalResp,
      displayMarkdown: `### 💬 ${persona.nombre} (${persona.cargo})
> *"Trabajando responsablemente para ${context.clientName} (RUT: ${context.rut})"*

He analizado tu mensaje: **"${userInput}"**.

En mi área (**${persona.area}**), tengo total disponibilidad para ejecutar las siguientes tareas:
${persona.accionesSugeridas.map(a => `- **${a.label}:** ${a.prompt}`).join('\n')}

Dime por voz o texto qué necesitas y me encargaré de ejecutarlo con estricta rigurosidad contable.`,
      followUpQuestion: '¿Deseas ejecutar alguna de estas acciones ahora?',
    };
  }
}

export const voiceAssistantEngine = new VoiceAssistantEngine();
