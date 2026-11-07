import { GoogleGenAI } from '@google/genai';

const getDiskPersistence = (): any => (globalThis as any)?.__diskPersistence;

export type AiCapability = 'CODE_JSON' | 'VISION_OCR' | 'REASONING_AUDIT' | 'GENERAL_CHAT';
export type AiProviderType = 'GEMINI' | 'LOCAL_OLLAMA' | 'CUSTOM_OPENAI';

export interface AiRouterConfig {
  activeProvider: AiProviderType;
  geminiModel: string;
  geminiApiKey?: string;
  localBaseUrl: string;
  localModelCode: string;
  localModelVision: string;
  localModelVisionFallback: string;
  localTimeoutMs: number;
  cloudFallbackEnabled: boolean;
  perCompanyOverrides: Record<string, {
    activeProvider?: AiProviderType;
    localBaseUrl?: string;
    localModelCode?: string;
    localModelVision?: string;
    /** 3.5: límites propios de la empresa (reemplazan los generales). */
    agentBudget?: Partial<AgentBudgetLimits>;
  }>;
  /** 3.5: límites generales de los agentes por empresa y por día (hora de Chile). */
  agentBudget?: Partial<AgentBudgetLimits>;
}

/** 3.5 Límites y costos de los agentes. Un valor 0 desactiva ese límite. */
export interface AgentBudgetLimits {
  /** Llamadas al modelo por ejecución del bucle agéntico. */
  maxIteracionesPorEjecucion: number;
  /** Tokens (entrada + salida) por empresa y por día. */
  maxTokensDiariosPorEmpresa: number;
  /** Gasto estimado en CLP por empresa y por día. */
  maxGastoDiarioClpPorEmpresa: number;
  /** Ejecuciones programadas por empresa y por día. */
  maxEjecucionesProgramadasDiarias: number;
}

export interface AgentBudgetCheck {
  allowed: boolean;
  code?: 'BUDGET_EXCEEDED';
  reason?: string;
  dia: string;
  uso: { tokens: number; gastoClp: number; llamadas: number };
  limites: AgentBudgetLimits;
}

const envNumber = (name: string, fallback: number) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v >= 0 && process.env[name] !== undefined && process.env[name] !== '' ? v : fallback;
};

export function defaultAgentBudget(): AgentBudgetLimits {
  return {
    maxIteracionesPorEjecucion: envNumber('AGENT_MAX_ITERATIONS', 6),
    maxTokensDiariosPorEmpresa: envNumber('AGENT_MAX_DAILY_TOKENS_PER_COMPANY', 200_000),
    maxGastoDiarioClpPorEmpresa: envNumber('AGENT_MAX_DAILY_SPEND_CLP_PER_COMPANY', 5_000),
    maxEjecucionesProgramadasDiarias: envNumber('AGENT_MAX_SCHEDULED_RUNS_PER_DAY', 24),
  };
}

/** Día calendario en Chile (AAAA-MM-DD) de un instante. */
export function chileDayKey(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

/** Costo estimado en USD por tokens (tarifa de referencia de modelos flash). */
export function estimateCostUsd(tokensIn: number, tokensOut: number): number {
  return (tokensIn * 0.000075 + tokensOut * 0.0003) / 1000;
}

export interface AiUsageLogEntry {
  id: string;
  empresaId: string;
  userId?: string;
  modulo: string;
  capability: AiCapability;
  modeloIntentado: string;
  modeloUtilizado: string;
  proveedorUtilizado: AiProviderType;
  fueFallback: boolean;
  motivoFallback?: string;
  promptTokensEstimados: number;
  completionTokensEstimados: number;
  tiempoRespuestaMs: number;
  costoEstimadoUsd: number;
  costoEstimadoClp: number;
  timestamp: string;
}

export interface ExecuteAiTaskParams {
  capability: AiCapability;
  prompt: string;
  systemInstruction?: string;
  inlineData?: {
    mimeType: string;
    data: string; // Base64
  };
  temperature?: number;
  empresaId?: string;
  userId?: string;
  modulo: string;
}

export interface ExecuteAiTaskResult {
  text: string;
  modelUsed: string;
  providerUsed: AiProviderType;
  isFallback: boolean;
  costUsd: number;
  latencyMs: number;
}

class AiRouterService {
  private config: AiRouterConfig;
  private logs: AiUsageLogEntry[] = [];
  private aiClient: GoogleGenAI | null = null;
  private readonly usdToClpRate = 955.0;
  private isLoaded = false;

  constructor() {
    this.config = {
      // Por defecto sigue usando GEMINI para total estabilidad y cero interrupción
      activeProvider: (process.env.AI_PROVIDER as AiProviderType) || 'GEMINI',
      geminiModel: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
      geminiApiKey: process.env.GEMINI_API_KEY || '',
      localBaseUrl: process.env.AI_LOCAL_BASE_URL || 'http://127.0.0.1:11434/v1',
      localModelCode: process.env.AI_LOCAL_MODEL_CODE || 'qwen2.5-coder:7b',
      localModelVision: process.env.AI_LOCAL_MODEL_VISION || 'llama3.2-vision:11b',
      localModelVisionFallback: process.env.AI_LOCAL_MODEL_VISION_FALLBACK || 'minicpm-v',
      localTimeoutMs: Number(process.env.AI_LOCAL_TIMEOUT_MS) || 25000,
      cloudFallbackEnabled: process.env.AI_CLOUD_FALLBACK_ENABLED !== 'false',
      perCompanyOverrides: {},
    };

    this.loadPersistedState();
  }

  private loadPersistedState() {
    try {
      const dp = getDiskPersistence();
      if (typeof dp?.getSnapshot === 'function') {
        const snap = dp.getSnapshot();
        if ((snap as any)?.aiConfig) {
          this.config = { ...this.config, ...(snap as any).aiConfig };
        }
        if (Array.isArray((snap as any)?.aiUsageLogs)) {
          this.logs = (snap as any).aiUsageLogs;
        }
        this.isLoaded = true;
      }
    } catch {
      // Si la persistencia en disco aún se está inicializando, se cargará perezosamente al primer acceso
    }
  }

  private persistState() {
    try {
      const dp = getDiskPersistence();
      if (typeof dp?.updateCollection === 'function') {
        dp.updateCollection('aiConfig' as any, [this.config]);
        dp.updateCollection('aiUsageLogs' as any, this.logs);
      }
      if (typeof dp?.scheduleDiskSave === 'function') {
        dp.scheduleDiskSave();
      }
    } catch (e) {
      console.warn('[AiRouterService] Error guardando estado de IA en snapshot:', e);
    }
  }

  public getConfig(): AiRouterConfig {
    if (!this.isLoaded) {
      this.loadPersistedState();
    }
    return { ...this.config };
  }

  public getMaskedConfig(): AiRouterConfig & { hasGeminiApiKey: boolean } {
    if (!this.isLoaded) {
      this.loadPersistedState();
    }
    const rawKey = this.config.geminiApiKey || process.env.GEMINI_API_KEY || '';
    return {
      ...this.config,
      geminiApiKey: rawKey ? `${rawKey.slice(0, 8)}...****` : '',
      hasGeminiApiKey: Boolean(rawKey),
      // 3.5: límites generales vigentes (variables de entorno + configuración guardada).
      agentBudget: this.getAgentBudgetLimits(),
    };
  }

  public updateConfig(patch: Partial<AiRouterConfig>): AiRouterConfig {
    const cleanPatch = { ...patch };
    if (cleanPatch.geminiApiKey && cleanPatch.geminiApiKey.includes('****')) {
      delete cleanPatch.geminiApiKey;
    }
    this.config = {
      ...this.config,
      ...cleanPatch,
      perCompanyOverrides: {
        ...this.config.perCompanyOverrides,
        ...(cleanPatch.perCompanyOverrides || {}),
      },
    };
    this.persistState();
    return this.getConfig();
  }

  public setCompanyOverride(empresaId: string, override: Partial<AiRouterConfig['perCompanyOverrides'][string]>) {
    this.config.perCompanyOverrides[empresaId] = {
      ...(this.config.perCompanyOverrides[empresaId] || {}),
      ...override,
    };
    this.persistState();
  }

  private getEffectiveConfig(empresaId?: string): {
    provider: AiProviderType;
    baseUrl: string;
    codeModel: string;
    visionModel: string;
  } {
    const override = empresaId ? this.config.perCompanyOverrides[empresaId] : undefined;
    return {
      provider: override?.activeProvider || this.config.activeProvider,
      baseUrl: override?.localBaseUrl || this.config.localBaseUrl,
      codeModel: override?.localModelCode || this.config.localModelCode,
      visionModel: override?.localModelVision || this.config.localModelVision,
    };
  }

  private getGoogleClient(): GoogleGenAI {
    if (!this.aiClient) {
      const key = this.config.geminiApiKey || process.env.GEMINI_API_KEY;
      if (!key) {
        throw new Error('GEMINI_API_KEY no está configurada.');
      }
      this.aiClient = new GoogleGenAI({
        apiKey: key,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    }
    return this.aiClient;
  }

  /**
   * Ejecuta una tarea de IA seleccionando automáticamente el modelo idóneo y
   * realizando fallback resiliente a Gemini en caso de fallo.
   */
  public async executeAiTask(params: ExecuteAiTaskParams): Promise<ExecuteAiTaskResult> {
    // 3.5: sin presupuesto diario de la empresa no se llama al modelo.
    if (params.empresaId) {
      const budget = this.checkAgentBudget(params.empresaId);
      if (!budget.allowed) {
        throw Object.assign(new Error(budget.reason), { code: 'BUDGET_EXCEEDED' });
      }
    }
    const startTime = Date.now();
    const effective = this.getEffectiveConfig(params.empresaId);
    const empresaKey = params.empresaId || 'DEFAULT_COMPANY';

    // Determinar modelo local objetivo según capacidad
    let targetLocalModel = effective.codeModel;
    if (params.capability === 'VISION_OCR') {
      targetLocalModel = effective.visionModel;
    }

    // MODO 1: Si el proveedor activo es GEMINI (por defecto)
    if (effective.provider === 'GEMINI') {
      try {
        const geminiRes = await this.callGemini(params);
        const latency = Date.now() - startTime;
        const tokensIn = Math.round(params.prompt.length / 4);
        const tokensOut = Math.round((geminiRes.text?.length || 0) / 4);
        const costUsd = (tokensIn * 0.000075 + tokensOut * 0.0003) / 1000;

        this.recordLog({
          id: `ai-log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          empresaId: empresaKey,
          userId: params.userId,
          modulo: params.modulo,
          capability: params.capability,
          modeloIntentado: this.config.geminiModel,
          modeloUtilizado: this.config.geminiModel,
          proveedorUtilizado: 'GEMINI',
          fueFallback: false,
          promptTokensEstimados: tokensIn,
          completionTokensEstimados: tokensOut,
          tiempoRespuestaMs: latency,
          costoEstimadoUsd: costUsd,
          costoEstimadoClp: Math.round(costUsd * this.usdToClpRate),
          timestamp: new Date().toISOString(),
        });

        return {
          text: geminiRes.text,
          modelUsed: this.config.geminiModel,
          providerUsed: 'GEMINI',
          isFallback: false,
          costUsd,
          latencyMs: latency,
        };
      } catch (geminiError: any) {
        console.error('[AiRouter] Error en Gemini principal:', geminiError);
        throw geminiError;
      }
    }

    // MODO 2: Proveedor Local (Ollama / OpenAI Compatible) con Fallback a Gemini
    let localErrorMsg = '';
    try {
      // 1. Intento con el modelo local principal
      const localResult = await this.callLocalOpenAiCompatible(
        effective.baseUrl,
        targetLocalModel,
        params,
        this.config.localTimeoutMs
      );

      const latency = Date.now() - startTime;
      const tokensIn = Math.round(params.prompt.length / 4);
      const tokensOut = Math.round(localResult.length / 4);

      this.recordLog({
        id: `ai-log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        empresaId: empresaKey,
        userId: params.userId,
        modulo: params.modulo,
        capability: params.capability,
        modeloIntentado: targetLocalModel,
        modeloUtilizado: targetLocalModel,
        proveedorUtilizado: 'LOCAL_OLLAMA',
        fueFallback: false,
        promptTokensEstimados: tokensIn,
        completionTokensEstimados: tokensOut,
        tiempoRespuestaMs: latency,
        costoEstimadoUsd: 0, // Modelos locales = $0 costo API
        costoEstimadoClp: 0,
        timestamp: new Date().toISOString(),
      });

      return {
        text: localResult,
        modelUsed: targetLocalModel,
        providerUsed: 'LOCAL_OLLAMA',
        isFallback: false,
        costUsd: 0,
        latencyMs: latency,
      };
    } catch (localErr: any) {
      localErrorMsg = localErr.message || String(localErr);
      console.warn(`[AiRouter] Falló modelo local '${targetLocalModel}' (${localErrorMsg}).`);

      // 2. Si es visión, intentar segundo modelo local de visión antes de ir a nube
      if (params.capability === 'VISION_OCR' && this.config.localModelVisionFallback) {
        try {
          console.info(`[AiRouter] Reintentando con modelo local secundario de visión: '${this.config.localModelVisionFallback}'...`);
          const fbLocalRes = await this.callLocalOpenAiCompatible(
            effective.baseUrl,
            this.config.localModelVisionFallback,
            params,
            this.config.localTimeoutMs
          );

          const latency = Date.now() - startTime;
          const tokensIn = Math.round(params.prompt.length / 4);
          const tokensOut = Math.round(fbLocalRes.length / 4);

          this.recordLog({
            id: `ai-log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            empresaId: empresaKey,
            userId: params.userId,
            modulo: params.modulo,
            capability: params.capability,
            modeloIntentado: targetLocalModel,
            modeloUtilizado: this.config.localModelVisionFallback,
            proveedorUtilizado: 'LOCAL_OLLAMA',
            fueFallback: true,
            motivoFallback: `Modelo local primario falló: ${localErrorMsg}`,
            promptTokensEstimados: tokensIn,
            completionTokensEstimados: tokensOut,
            tiempoRespuestaMs: latency,
            costoEstimadoUsd: 0,
            costoEstimadoClp: 0,
            timestamp: new Date().toISOString(),
          });

          return {
            text: fbLocalRes,
            modelUsed: this.config.localModelVisionFallback,
            providerUsed: 'LOCAL_OLLAMA',
            isFallback: true,
            costUsd: 0,
            latencyMs: latency,
          };
        } catch (visionFbErr: any) {
          console.warn('[AiRouter] Modelo local secundario también falló:', visionFbErr.message);
        }
      }
    }

    // 3. Fallback a Google Gemini si está activado
    if (this.config.cloudFallbackEnabled) {
      console.info('[AiRouter] Conmutando a Fallback Cloud (Google Gemini 3.8)...');
      const geminiRes = await this.callGemini(params);
      const latency = Date.now() - startTime;
      const tokensIn = Math.round(params.prompt.length / 4);
      const tokensOut = Math.round((geminiRes.text?.length || 0) / 4);
      const costUsd = (tokensIn * 0.000075 + tokensOut * 0.0003) / 1000;

      this.recordLog({
        id: `ai-log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        empresaId: empresaKey,
        userId: params.userId,
        modulo: params.modulo,
        capability: params.capability,
        modeloIntentado: targetLocalModel,
        modeloUtilizado: this.config.geminiModel,
        proveedorUtilizado: 'GEMINI',
        fueFallback: true,
        motivoFallback: `Servidor local inaccesible o error: ${localErrorMsg}`,
        promptTokensEstimados: tokensIn,
        completionTokensEstimados: tokensOut,
        tiempoRespuestaMs: latency,
        costoEstimadoUsd: costUsd,
        costoEstimadoClp: Math.round(costUsd * this.usdToClpRate),
        timestamp: new Date().toISOString(),
      });

      return {
        text: geminiRes.text,
        modelUsed: this.config.geminiModel,
        providerUsed: 'GEMINI',
        isFallback: true,
        costUsd,
        latencyMs: latency,
      };
    }

    throw new Error(`Servidor local de IA no respondió (${localErrorMsg}) y el fallback a la nube se encuentra deshabilitado.`);
  }

  private async callGemini(params: ExecuteAiTaskParams): Promise<{ text: string }> {
    const ai = this.getGoogleClient();

    if (params.inlineData) {
      const response = await ai.models.generateContent({
        model: this.config.geminiModel,
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: params.inlineData.mimeType,
                  data: params.inlineData.data,
                },
              },
              {
                text: params.prompt,
              },
            ],
          },
        ],
        config: {
          systemInstruction: params.systemInstruction,
          temperature: params.temperature ?? 0.2,
        },
      });
      return { text: response.text || '' };
    }

    const response = await ai.models.generateContent({
      model: this.config.geminiModel,
      contents: params.prompt,
      config: {
        systemInstruction: params.systemInstruction,
        temperature: params.temperature ?? 0.2,
      },
    });

    return { text: response.text || '' };
  }

  private async callLocalOpenAiCompatible(
    baseUrl: string,
    model: string,
    params: ExecuteAiTaskParams,
    timeoutMs: number
  ): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const messages: any[] = [];
      if (params.systemInstruction) {
        messages.push({ role: 'system', content: params.systemInstruction });
      }

      if (params.inlineData) {
        messages.push({
          role: 'user',
          content: [
            { type: 'text', text: params.prompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:${params.inlineData.mimeType};base64,${params.inlineData.data}`,
              },
            },
          ],
        });
      } else {
        messages.push({ role: 'user', content: params.prompt });
      }

      const cleanUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      const endpoint = cleanUrl.endsWith('/chat/completions') ? cleanUrl : `${cleanUrl}/chat/completions`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ollama',
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: params.temperature ?? 0.2,
          stream: false,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status} desde servidor local: ${errText.substring(0, 150)}`);
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (typeof content !== 'string') {
        throw new Error('Respuesta inválida desde servidor local de IA.');
      }
      return content;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // ==========================================================================
  // 3.5 LÍMITES Y COSTOS POR EMPRESA Y POR DÍA
  // ==========================================================================

  /** Límites efectivos de una empresa: generales (env + configuración) y los propios de la empresa. */
  public getAgentBudgetLimits(empresaId?: string): AgentBudgetLimits {
    const cfg = this.getConfig();
    const override = empresaId ? cfg.perCompanyOverrides?.[empresaId]?.agentBudget : undefined;
    const merged = { ...defaultAgentBudget(), ...(cfg.agentBudget || {}), ...(override || {}) };
    const clean = (v: any, d: number) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : d);
    const base = defaultAgentBudget();
    return {
      maxIteracionesPorEjecucion: Math.max(1, clean(merged.maxIteracionesPorEjecucion, base.maxIteracionesPorEjecucion)),
      maxTokensDiariosPorEmpresa: clean(merged.maxTokensDiariosPorEmpresa, base.maxTokensDiariosPorEmpresa),
      maxGastoDiarioClpPorEmpresa: clean(merged.maxGastoDiarioClpPorEmpresa, base.maxGastoDiarioClpPorEmpresa),
      maxEjecucionesProgramadasDiarias: clean(merged.maxEjecucionesProgramadasDiarias, base.maxEjecucionesProgramadasDiarias),
    };
  }

  /** Consumo de IA de la empresa en el día (hora de Chile). */
  public getDailyUsage(empresaId: string, now: Date = new Date()): AgentBudgetCheck['uso'] & { dia: string } {
    if (!this.isLoaded) this.loadPersistedState();
    const dia = chileDayKey(now);
    const norm = (v: string) => String(v || '').replace(/[^0-9kK]/g, '').toUpperCase() || String(v || '');
    const target = norm(empresaId);
    let tokens = 0;
    let gastoClp = 0;
    let llamadas = 0;
    for (const l of this.logs) {
      if (norm(l.empresaId) !== target) continue;
      if (chileDayKey(new Date(l.timestamp)) !== dia) continue;
      tokens += (Number(l.promptTokensEstimados) || 0) + (Number(l.completionTokensEstimados) || 0);
      // Sin redondear por llamada: el costo de cada llamada suele ser menor a $1.
      gastoClp += (Number(l.costoEstimadoUsd) || 0) * this.usdToClpRate;
      llamadas++;
    }
    return { dia, tokens, gastoClp: Math.round(gastoClp * 100) / 100, llamadas };
  }

  /** ¿Puede la empresa seguir usando IA hoy? Un límite en 0 no se aplica. */
  public checkAgentBudget(empresaId: string, now: Date = new Date()): AgentBudgetCheck {
    const limites = this.getAgentBudgetLimits(empresaId);
    const { dia, ...uso } = this.getDailyUsage(empresaId, now);
    const motivos: string[] = [];
    if (limites.maxTokensDiariosPorEmpresa > 0 && uso.tokens >= limites.maxTokensDiariosPorEmpresa) {
      motivos.push(`tokens del día ${uso.tokens.toLocaleString('es-CL')} de ${limites.maxTokensDiariosPorEmpresa.toLocaleString('es-CL')}`);
    }
    if (limites.maxGastoDiarioClpPorEmpresa > 0 && uso.gastoClp >= limites.maxGastoDiarioClpPorEmpresa) {
      motivos.push(`gasto del día $${uso.gastoClp.toLocaleString('es-CL')} de $${limites.maxGastoDiarioClpPorEmpresa.toLocaleString('es-CL')}`);
    }
    if (motivos.length === 0) return { allowed: true, dia, uso, limites };
    return {
      allowed: false,
      code: 'BUDGET_EXCEEDED',
      reason: `Presupuesto diario de IA agotado para la empresa ${empresaId} (${motivos.join('; ')}). Se reanuda mañana o al ampliar el límite.`,
      dia,
      uso,
      limites,
    };
  }

  /** Registra el consumo de una llamada del motor agéntico (tokens reales si el modelo los informa). */
  public recordAgentModelCall(params: {
    empresaId: string;
    modulo: string;
    userId?: string;
    model: string;
    tokensIn: number;
    tokensOut: number;
    latencyMs: number;
  }): AiUsageLogEntry {
    const costUsd = estimateCostUsd(params.tokensIn, params.tokensOut);
    const entry: AiUsageLogEntry = {
      id: `ai-log-agent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      empresaId: params.empresaId,
      userId: params.userId,
      modulo: `AGENTE_${params.modulo}`,
      capability: 'REASONING_AUDIT',
      modeloIntentado: params.model,
      modeloUtilizado: params.model,
      proveedorUtilizado: 'GEMINI',
      fueFallback: false,
      promptTokensEstimados: Math.max(0, Math.round(params.tokensIn)),
      completionTokensEstimados: Math.max(0, Math.round(params.tokensOut)),
      tiempoRespuestaMs: params.latencyMs,
      costoEstimadoUsd: costUsd,
      costoEstimadoClp: Math.round(costUsd * this.usdToClpRate),
      timestamp: new Date().toISOString(),
    };
    this.recordLog(entry);
    return entry;
  }

  public recordLog(logEntry: AiUsageLogEntry) {
    this.logs.unshift(logEntry);
    if (this.logs.length > 3000) {
      this.logs = this.logs.slice(0, 3000);
    }
    this.persistState();
  }

  /**
   * Genera el reporte de consumo mensual consolidado por cliente
   */
  public getUsageReport(options?: { empresaId?: string; periodo?: string }) {
    let filtered = this.logs;
    if (options?.empresaId && options.empresaId !== 'TODAS') {
      filtered = filtered.filter((l) => l.empresaId === options.empresaId);
    }
    if (options?.periodo) {
      filtered = filtered.filter((l) => l.timestamp.startsWith(options.periodo!));
    }

    const byCompany: Record<
      string,
      {
        empresaId: string;
        totalLlamadas: number;
        llamadasLocales: number;
        llamadasGemini: number;
        fallbacks: number;
        totalTokens: number;
        costoTotalUsd: number;
        costoTotalClp: number;
        tiempoPromedioMs: number;
        porModelo: Record<string, number>;
        porModulo: Record<string, number>;
      }
    > = {};

    let grandTotalLlamadas = 0;
    let grandTotalLocales = 0;
    let grandTotalGemini = 0;
    let grandTotalFallbacks = 0;
    let grandTotalUsd = 0;
    let grandTotalClp = 0;

    filtered.forEach((log) => {
      grandTotalLlamadas++;
      if (log.proveedorUtilizado === 'LOCAL_OLLAMA') grandTotalLocales++;
      if (log.proveedorUtilizado === 'GEMINI') grandTotalGemini++;
      if (log.fueFallback) grandTotalFallbacks++;
      grandTotalUsd += log.costoEstimadoUsd;
      grandTotalClp += log.costoEstimadoClp;

      if (!byCompany[log.empresaId]) {
        byCompany[log.empresaId] = {
          empresaId: log.empresaId,
          totalLlamadas: 0,
          llamadasLocales: 0,
          llamadasGemini: 0,
          fallbacks: 0,
          totalTokens: 0,
          costoTotalUsd: 0,
          costoTotalClp: 0,
          tiempoPromedioMs: 0,
          porModelo: {},
          porModulo: {},
        };
      }

      const c = byCompany[log.empresaId];
      c.totalLlamadas++;
      if (log.proveedorUtilizado === 'LOCAL_OLLAMA') c.llamadasLocales++;
      if (log.proveedorUtilizado === 'GEMINI') c.llamadasGemini++;
      if (log.fueFallback) c.fallbacks++;
      c.totalTokens += (log.promptTokensEstimados + log.completionTokensEstimados);
      c.costoTotalUsd += log.costoEstimadoUsd;
      c.costoTotalClp += log.costoEstimadoClp;
      c.porModelo[log.modeloUtilizado] = (c.porModelo[log.modeloUtilizado] || 0) + 1;
      c.porModulo[log.modulo] = (c.porModulo[log.modulo] || 0) + 1;
    });

    return {
      totalesGenerales: {
        totalLlamadas: grandTotalLlamadas,
        llamadasLocales: grandTotalLocales,
        llamadasGemini: grandTotalGemini,
        fallbacks: grandTotalFallbacks,
        ahorroEstimadoUsd: (grandTotalLocales * 0.0002), // Ahorro calculado por no pagar API externa
        ahorroEstimadoClp: Math.round((grandTotalLocales * 0.0002) * this.usdToClpRate),
        costoTotalUsd: Number(grandTotalUsd.toFixed(4)),
        costoTotalClp: grandTotalClp,
      },
      empresas: Object.values(byCompany),
      ultimasLlamadas: filtered.slice(0, 50),
    };
  }

  /**
   * Exporta el reporte de consumo a formato CSV para entregar al cliente
   */
  public exportUsageReportCsv(empresaId?: string, periodo?: string): string {
    const report = this.getUsageReport({ empresaId, periodo });
    const lines: string[] = [];

    lines.push('REPORTE MENSUAL DE CONSUMO Y GASTO DE INTELIGENCIA ARTIFICIAL');
    lines.push(`Generado: ${new Date().toLocaleString('es-CL')}`);
    lines.push(`Filtro Empresa: ${empresaId || 'TODAS'} | Periodo: ${periodo || 'HISTORICO'}`);
    lines.push('');
    lines.push('RESUMEN GENERAL:');
    lines.push(`Total Peticiones:;${report.totalesGenerales.totalLlamadas}`);
    lines.push(`Peticiones Servidor Local ($0):;${report.totalesGenerales.llamadasLocales}`);
    lines.push(`Peticiones Gemini Cloud:;${report.totalesGenerales.llamadasGemini}`);
    lines.push(`Peticiones con Fallback:;${report.totalesGenerales.fallbacks}`);
    lines.push(`Gasto Total Cloud (USD):;$${report.totalesGenerales.costoTotalUsd}`);
    lines.push(`Gasto Total Cloud (CLP):;$${report.totalesGenerales.costoTotalClp.toLocaleString('es-CL')}`);
    lines.push(`Ahorro por Modelos Locales (CLP):;$${report.totalesGenerales.ahorroEstimadoClp.toLocaleString('es-CL')}`);
    lines.push('');
    lines.push('DETALLE POR EMPRESA / CLIENTE:');
    lines.push('RUT Empresa;Total Llamadas;Locales ($0);Gemini;Fallbacks;Tokens;Gasto USD;Gasto CLP');

    report.empresas.forEach((e) => {
      lines.push(
        `${e.empresaId};${e.totalLlamadas};${e.llamadasLocales};${e.llamadasGemini};${e.fallbacks};${e.totalTokens};$${e.costoTotalUsd.toFixed(4)};$${e.costoTotalClp.toLocaleString('es-CL')}`
      );
    });

    lines.push('');
    lines.push('REGISTRO AUDITABLE DE ULTIMAS PETICIONES:');
    lines.push('Fecha;Empresa;Modulo;Capacidad;Modelo Solicitado;Modelo Utilizado;Proveedor;Fue Fallback;Costo USD;Costo CLP');

    report.ultimasLlamadas.forEach((l) => {
      lines.push(
        `${l.timestamp};${l.empresaId};${l.modulo};${l.capability};${l.modeloIntentado};${l.modeloUtilizado};${l.proveedorUtilizado};${l.fueFallback ? 'SI' : 'NO'};$${l.costoEstimadoUsd.toFixed(4)};$${l.costoEstimadoClp}`
      );
    });

    return lines.join('\n');
  }

  /**
   * Prueba de conectividad con el servidor local Ollama / vLLM
   */
  public async testLocalServer(): Promise<{
    reachable: boolean;
    models: string[];
    latencyMs: number;
    error?: string;
  }> {
    const start = Date.now();
    try {
      const cleanUrl = this.config.localBaseUrl.endsWith('/')
        ? this.config.localBaseUrl.slice(0, -1)
        : this.config.localBaseUrl;
      const endpoint = cleanUrl.endsWith('/models') ? cleanUrl : `${cleanUrl}/models`;

      const res = await fetch(endpoint, {
        headers: { Authorization: 'Bearer ollama' },
        signal: AbortSignal.timeout(4000),
      });

      if (!res.ok) {
        return {
          reachable: false,
          models: [],
          latencyMs: Date.now() - start,
          error: `HTTP ${res.status}: Servidor local no disponible.`,
        };
      }

      const data = await res.json();
      const models = Array.isArray(data.data) ? data.data.map((m: any) => m.id) : [];

      return {
        reachable: true,
        models,
        latencyMs: Date.now() - start,
      };
    } catch (e: any) {
      return {
        reachable: false,
        models: [],
        latencyMs: Date.now() - start,
        error: e.message || 'No se pudo conectar al endpoint local de Ollama.',
      };
    }
  }
}

export const aiRouterService = new AiRouterService();
