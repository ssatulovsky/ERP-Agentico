import React, { useState, useEffect } from 'react';
import {
  X,
  Cpu,
  Sparkles,
  Server,
  Cloud,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Download,
  FileSpreadsheet,
  Building2,
  Clock,
  DollarSign,
  TrendingUp,
  Activity,
  Layers,
  Settings2,
  HelpCircle,
  Eye,
  Code2,
  MessageSquare,
  ShieldAlert
} from 'lucide-react';
import { ClientCompany } from '../../types';

interface AiModelManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: ClientCompany[];
  activeClientId?: string;
}

interface AiConfig {
  activeProvider: 'GEMINI' | 'LOCAL_OLLAMA' | 'CUSTOM_OPENAI';
  geminiModel: string;
  localBaseUrl: string;
  localModelCode: string;
  localModelVision: string;
  localModelVisionFallback: string;
  localTimeoutMs: number;
  cloudFallbackEnabled: boolean;
  perCompanyOverrides: Record<string, {
    activeProvider?: 'GEMINI' | 'LOCAL_OLLAMA';
    localBaseUrl?: string;
    localModelCode?: string;
    localModelVision?: string;
  }>;
}

interface LocalStatus {
  reachable: boolean;
  models: string[];
  latencyMs: number;
  error?: string;
}

interface UsageReport {
  totalesGenerales: {
    totalLlamadas: number;
    llamadasLocales: number;
    llamadasGemini: number;
    fallbacks: number;
    ahorroEstimadoUsd: number;
    ahorroEstimadoClp: number;
    costoTotalUsd: number;
    costoTotalClp: number;
  };
  empresas: Array<{
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
  }>;
  ultimasLlamadas: Array<{
    id: string;
    empresaId: string;
    modulo: string;
    capability: string;
    modeloIntentado: string;
    modeloUtilizado: string;
    proveedorUtilizado: string;
    fueFallback: boolean;
    motivoFallback?: string;
    promptTokensEstimados: number;
    completionTokensEstimados: number;
    tiempoRespuestaMs: number;
    costoEstimadoUsd: number;
    costoEstimadoClp: number;
    timestamp: string;
  }>;
}

export const AiModelManagerModal: React.FC<AiModelManagerModalProps> = ({
  isOpen,
  onClose,
  clients,
  activeClientId
}) => {
  const [activeTab, setActiveTab] = useState<'config' | 'report' | 'routing'>('config');
  const [config, setConfig] = useState<AiConfig>({
    activeProvider: 'GEMINI',
    geminiModel: 'gemini-3.8-flash',
    localBaseUrl: 'http://127.0.0.1:11434/v1',
    localModelCode: 'qwen2.5-coder:7b',
    localModelVision: 'llama3.2-vision:11b',
    localModelVisionFallback: 'minicpm-v',
    localTimeoutMs: 25000,
    cloudFallbackEnabled: true,
    perCompanyOverrides: {}
  });

  const [localStatus, setLocalStatus] = useState<LocalStatus | null>(null);
  const [report, setReport] = useState<UsageReport | null>(null);
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string>('ALL');
  const [isTestingLocal, setIsTestingLocal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Cargar configuración inicial y reporte
  const loadData = async () => {
    try {
      const confRes = await fetch('/api/admin/ai-config');
      if (confRes.ok) {
        const confData = await confRes.json();
        if (confData.config) setConfig(confData.config);
        if (confData.localStatus) setLocalStatus(confData.localStatus);
      }

      const repRes = await fetch(
        selectedCompanyFilter && selectedCompanyFilter !== 'ALL'
          ? `/api/admin/ai-usage-report?empresaId=${encodeURIComponent(selectedCompanyFilter)}`
          : '/api/admin/ai-usage-report'
      );
      if (repRes.ok) {
        const repData = await repRes.json();
        if (repData.report) setReport(repData.report);
      }
    } catch (e) {
      console.warn('[AiModelManager] Error cargando configuración:', e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, selectedCompanyFilter]);

  if (!isOpen) return null;

  // Probar conectividad con Ollama Local
  const handleTestLocal = async () => {
    setIsTestingLocal(true);
    try {
      const res = await fetch('/api/admin/ai-test-local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ localBaseUrl: config.localBaseUrl })
      });
      const data = await res.json();
      if (data.result) {
        setLocalStatus(data.result);
      }
    } catch (e: any) {
      setLocalStatus({
        reachable: false,
        models: [],
        latencyMs: 0,
        error: e.message || 'Error de conexión con el backend.'
      });
    } finally {
      setIsTestingLocal(false);
    }
  };

  // Guardar configuración
  const handleSaveConfig = async () => {
    setIsSaving(true);
    setSaveSuccessMsg(null);
    try {
      const res = await fetch('/api/admin/ai-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.config) setConfig(data.config);
        if (data.localStatus) setLocalStatus(data.localStatus);
        setSaveSuccessMsg('¡Configuración de IA guardada y sincronizada exitosamente!');
        setTimeout(() => setSaveSuccessMsg(null), 4000);
      }
    } catch (e: any) {
      alert('Error guardando configuración: ' + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Descargar CSV de reporte
  const handleDownloadCsv = () => {
    const url =
      selectedCompanyFilter && selectedCompanyFilter !== 'ALL'
        ? `/api/admin/ai-usage-report/csv?empresaId=${encodeURIComponent(selectedCompanyFilter)}`
        : '/api/admin/ai-usage-report/csv';
    window.open(url, '_blank');
  };

  const getCompanyName = (empresaId: string) => {
    const c = clients.find((x) => x.id === empresaId || x.rut === empresaId);
    return c ? `${c.nombreCorto} (${c.rut})` : empresaId;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-5xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-[#0f172a] text-white px-6 py-4 flex items-center justify-between border-b-2 border-blue-600 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/30 border border-blue-400/30 rounded-lg text-blue-400">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  Administrador de Modelos IA & Control de Gastos por Cliente
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {config.activeProvider === 'GEMINI' ? 'Gemini Nube (Activo)' : 'Ollama Local (Activo)'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Parametriza modelos locales (Qwen, Llama Vision, MiniCPM) o Gemini Cloud, con fallback resiliente y telemetría de costos.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="bg-slate-100 border-b border-slate-200 px-6 py-2 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('config')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'config'
                  ? 'bg-white text-blue-700 shadow-sm border border-slate-200'
                  : 'text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              <Settings2 className="w-4 h-4 text-blue-600" />
              <span>Configuración de Proveedor & Modelos</span>
            </button>

            <button
              onClick={() => setActiveTab('routing')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'routing'
                  ? 'bg-white text-blue-700 shadow-sm border border-slate-200'
                  : 'text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              <Layers className="w-4 h-4 text-purple-600" />
              <span>Mapeo de Capacidades por Agente</span>
            </button>

            <button
              onClick={() => setActiveTab('report')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'report'
                  ? 'bg-white text-blue-700 shadow-sm border border-slate-200'
                  : 'text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              <DollarSign className="w-4 h-4 text-emerald-600" />
              <span>Reporte de Consumo y Gastos Mensual</span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 font-medium">Estado Local:</span>
            {localStatus?.reachable ? (
              <span className="flex items-center gap-1 font-bold text-emerald-600">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                Ollama Online ({localStatus.latencyMs}ms)
              </span>
            ) : (
              <span className="flex items-center gap-1 font-bold text-amber-600">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                Ollama Offline (Usa Gemini Nube)
              </span>
            )}
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {saveSuccessMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{saveSuccessMsg}</span>
            </div>
          )}

          {/* TAB 1: CONFIGURACIÓN DE PROVEEDOR Y MODELOS */}
          {activeTab === 'config' && (
            <div className="space-y-6">
              {/* Proveedor Principal Selector */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  1. Selección de Proveedor Principal de Inteligencia Artificial
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Card Gemini */}
                  <div
                    onClick={() => setConfig({ ...config, activeProvider: 'GEMINI' })}
                    className={`p-4 rounded-xl border-2 transition-all cursor-pointer relative ${
                      config.activeProvider === 'GEMINI'
                        ? 'border-blue-600 bg-blue-50/50 shadow-md ring-2 ring-blue-500/20'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                          <Cloud className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-900">Google Gemini (Nube)</h4>
                          <span className="text-[11px] font-semibold text-blue-700">gemini-3.8-flash (Recomendado hoy)</span>
                        </div>
                      </div>
                      {config.activeProvider === 'GEMINI' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-600 text-white">
                          ACTIVO
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-xs text-slate-600">
                      Máxima precisión en legislación tributaria chilena (SII, F29, Art. 64) y OCR multiformato instantáneo. Mantiene la operación del estudio 100% estable.
                    </p>
                  </div>

                  {/* Card Ollama Local */}
                  <div
                    onClick={() => setConfig({ ...config, activeProvider: 'LOCAL_OLLAMA' })}
                    className={`p-4 rounded-xl border-2 transition-all cursor-pointer relative ${
                      config.activeProvider === 'LOCAL_OLLAMA'
                        ? 'border-indigo-600 bg-indigo-50/50 shadow-md ring-2 ring-indigo-500/20'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
                          <Server className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-900">Servidor Local Ollama / vLLM</h4>
                          <span className="text-[11px] font-semibold text-indigo-700">
                            Qwen 2.5 Coder + Llama 3.2 Vision + MiniCPM
                          </span>
                        </div>
                      </div>
                      {config.activeProvider === 'LOCAL_OLLAMA' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-600 text-white">
                          ACTIVO
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-xs text-slate-600">
                      Gasto API $0 CLP. Privacidad 100% local en hardware propio. Cuando el cliente confirme la activación, basta con seleccionar esta opción.
                    </p>
                  </div>
                </div>
              </div>

              {/* Parámetros del Servidor Local y Modelos Asignados */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-indigo-600" />
                      <span>2. Configuración de Modelos Locales y Endpoint</span>
                    </h3>
                    <p className="text-xs text-slate-500">
                      Puedes cambiar libremente los nombres de los modelos si el cliente instala versiones cuantizadas o afinadas.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleTestLocal}
                    disabled={isTestingLocal}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isTestingLocal ? 'animate-spin' : ''}`} />
                    <span>{isTestingLocal ? 'Probando...' : 'Probar Conexión con Ollama'}</span>
                  </button>
                </div>

                {/* Local Status Banner */}
                {localStatus && (
                  <div
                    className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
                      localStatus.reachable
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-amber-50 border-amber-200 text-amber-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {localStatus.reachable ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      )}
                      <div>
                        <span className="font-bold">
                          {localStatus.reachable
                            ? `Conexión exitosa con Ollama (${localStatus.latencyMs} ms)`
                            : 'No se pudo conectar con el servidor local Ollama'}
                        </span>
                        {localStatus.reachable && localStatus.models.length > 0 && (
                          <div className="text-[11px] text-emerald-700 mt-0.5">
                            Modelos instalados detectados: <strong>{localStatus.models.join(', ')}</strong>
                          </div>
                        )}
                        {localStatus.error && (
                          <div className="text-[11px] text-amber-700 mt-0.5 font-mono">
                            {localStatus.error}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="text-[10px] uppercase font-mono px-2 py-1 bg-white/80 rounded border">
                      {localStatus.reachable ? 'STATUS: 200 OK' : 'STATUS: OFFLINE'}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Endpoint URL */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      URL del Servidor Ollama / vLLM (API Compatible con OpenAI)
                    </label>
                    <input
                      type="text"
                      value={config.localBaseUrl}
                      onChange={(e) => setConfig({ ...config, localBaseUrl: e.target.value })}
                      placeholder="http://127.0.0.1:11434/v1"
                      className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-500">
                      Puerto estándar de Ollama: 11434 con sufijo /v1.
                    </span>
                  </div>

                  {/* Timeout */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Timeout Máximo para Modelos Locales (Milisegundos)
                    </label>
                    <input
                      type="number"
                      value={config.localTimeoutMs}
                      onChange={(e) => setConfig({ ...config, localTimeoutMs: Number(e.target.value) })}
                      step="1000"
                      min="5000"
                      max="120000"
                      className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-500">
                      Si el modelo local tarda más de {config.localTimeoutMs / 1000}s, salta a Gemini sin cortar la petición.
                    </span>
                  </div>

                  {/* Modelo Local Código / JSON */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Code2 className="w-3.5 h-3.5 text-blue-600" />
                        <span>Modelo Local: Código, Contabilidad & JSON</span>
                      </span>
                      <span className="text-[10px] text-blue-600 font-bold">Capacidad: CODE_JSON</span>
                    </label>
                    <input
                      type="text"
                      value={config.localModelCode}
                      onChange={(e) => setConfig({ ...config, localModelCode: e.target.value })}
                      className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-500">
                      Predeterminado: <strong>qwen2.5-coder:7b</strong> (Excelente precisión en generación de JSON y balance contable).
                    </span>
                  </div>

                  {/* Modelo Local Visión Primario */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5 text-purple-600" />
                        <span>Modelo Local: Visión & OCR Primario</span>
                      </span>
                      <span className="text-[10px] text-purple-600 font-bold">Capacidad: VISION_OCR</span>
                    </label>
                    <input
                      type="text"
                      value={config.localModelVision}
                      onChange={(e) => setConfig({ ...config, localModelVision: e.target.value })}
                      className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-500">
                      Predeterminado: <strong>llama3.2-vision:11b</strong> (Lectura de facturas, boletas y rendición de gastos).
                    </span>
                  </div>

                  {/* Modelo Local Visión Secundario (Fallback) */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5 text-amber-600" />
                        <span>Modelo Local: Visión Secundario (Fallback Ligero)</span>
                      </span>
                      <span className="text-[10px] text-amber-600 font-bold">Fallback Local</span>
                    </label>
                    <input
                      type="text"
                      value={config.localModelVisionFallback}
                      onChange={(e) => setConfig({ ...config, localModelVisionFallback: e.target.value })}
                      className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-500">
                      Predeterminado: <strong>minicpm-v</strong> (Ultrarrápido y ligero para no saturar memoria VRAM).
                    </span>
                  </div>

                  {/* Modelo Gemini Cloud de Respaldo */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Cloud className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Modelo Gemini Cloud (Nube / Respaldo)</span>
                      </span>
                      <span className="text-[10px] text-emerald-600 font-bold">Google Cloud AI</span>
                    </label>
                    <input
                      type="text"
                      value={config.geminiModel}
                      onChange={(e) => setConfig({ ...config, geminiModel: e.target.value })}
                      className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-500">
                      Predeterminado: <strong>gemini-3.8-flash</strong> (Fallback resiliente automático).
                    </span>
                  </div>
                </div>

                {/* Switch de Fallback a Nube */}
                <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="cloudFallbackCheck"
                      checked={config.cloudFallbackEnabled}
                      onChange={(e) => setConfig({ ...config, cloudFallbackEnabled: e.target.checked })}
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                    />
                    <label htmlFor="cloudFallbackCheck" className="text-xs font-semibold text-slate-800 cursor-pointer">
                      Habilitar Fallback Automático a Google Gemini Cloud en caso de fallo local o timeout
                    </label>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Garantiza cero caídas en la experiencia del usuario.
                  </span>
                </div>
              </div>

              {/* Botón de Guardado */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleSaveConfig}
                  disabled={isSaving}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-md transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isSaving ? 'Guardando...' : 'Guardar y Aplicar Configuración'}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: MAPEO DE CAPACIDADES POR AGENTE */}
          {activeTab === 'routing' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-1">
                  Matriz de Enrutamiento Inteligente por Capacidad y Agente
                </h3>
                <p className="text-xs text-slate-500">
                  El sistema no envía todas las tareas al mismo modelo de forma ciega; selecciona dinámicamente el modelo óptimo según el tipo de cálculo y tarea:
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Capacidad 1: CODE_JSON */}
                <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                        <Code2 className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">1. Generación de Asientos & JSON ERP</h4>
                        <span className="text-[10px] font-mono text-blue-600">Capacidad: CODE_JSON</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600">
                    Utilizado por: <strong>Orquestador Contable Senior</strong>, <strong>Asesor Conversacional de Diálogo</strong>, y <strong>Sugerencia de Imputación SII</strong>.
                  </p>
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Modelo Local Asignado:</span>
                      <span className="font-mono font-bold text-slate-800">{config.localModelCode}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Modelo Cloud (Fallback):</span>
                      <span className="font-mono font-bold text-slate-800">{config.geminiModel}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 pt-1">
                      <strong>Por qué:</strong> Qwen 2.5 Coder 7B lidera en benchmarks de razonamiento sintáctico y estructuración estricta de JSON sin alucinaciones.
                    </div>
                  </div>
                </div>

                {/* Capacidad 2: VISION_OCR */}
                <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-purple-100 text-purple-700 rounded-lg">
                        <Eye className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">2. Rendición de Gastos & OCR de Boletas</h4>
                        <span className="text-[10px] font-mono text-purple-600">Capacidad: VISION_OCR</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600">
                    Utilizado por: <strong>Módulo RindeGastos</strong>, <strong>Rinde Móvil (Cámara)</strong> y extracción de comprobantes DTE.
                  </p>
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Modelo Local Primario:</span>
                      <span className="font-mono font-bold text-slate-800">{config.localModelVision}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Modelo Local Secundario:</span>
                      <span className="font-mono font-bold text-slate-800">{config.localModelVisionFallback}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Modelo Cloud (Fallback):</span>
                      <span className="font-mono font-bold text-slate-800">{config.geminiModel}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 pt-1">
                      <strong>Por qué:</strong> Llama 3.2 Vision 11B procesa fotos con alta resolución; si hay alta carga de GPU, MiniCPM-V actúa de buffer ultrarrápido antes de escalar a Gemini.
                    </div>
                  </div>
                </div>

                {/* Capacidad 3: REASONING_AUDIT */}
                <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-amber-100 text-amber-700 rounded-lg">
                        <ShieldAlert className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">3. Auditoría Tributaria F29 & Discrepancias</h4>
                        <span className="text-[10px] font-mono text-amber-600">Capacidad: REASONING_AUDIT</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600">
                    Utilizado por: <strong>Agente Fiscal F29</strong>, <strong>Auditor de Discrepancias RCV vs F29</strong> y cruce de leyes tributarias (DL 825, LIR).
                  </p>
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Modelo Local Asignado:</span>
                      <span className="font-mono font-bold text-slate-800">{config.localModelCode}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Modelo Cloud (Fallback):</span>
                      <span className="font-mono font-bold text-slate-800">{config.geminiModel}</span>
                    </div>
                  </div>
                </div>

                {/* Capacidad 4: GENERAL_CHAT */}
                <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
                        <MessageSquare className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">4. Diálogo de Voz (Vera) & Consultoría</h4>
                        <span className="text-[10px] font-mono text-emerald-600">Capacidad: GENERAL_CHAT</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600">
                    Utilizado por: <strong>Vera (Socia Virtual / Piper TTS)</strong> y chat interactivo contable en tiempo real.
                  </p>
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Modelo Local Asignado:</span>
                      <span className="font-mono font-bold text-slate-800">{config.localModelCode}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Modelo Cloud (Fallback):</span>
                      <span className="font-mono font-bold text-slate-800">{config.geminiModel}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: REPORTE DE CONSUMO Y GASTOS POR CLIENTE */}
          {activeTab === 'report' && (
            <div className="space-y-6">
              {/* Filtro y Botón de Exportación */}
              <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-50 p-4 border border-slate-200 rounded-xl">
                <div className="flex items-center gap-3">
                  <Building2 className="w-4 h-4 text-slate-500" />
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-0.5">
                      Filtrar por Empresa Cliente:
                    </label>
                    <select
                      value={selectedCompanyFilter}
                      onChange={(e) => setSelectedCompanyFilter(e.target.value)}
                      className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="ALL">Todas las Empresas (Estudio Completo)</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.rut}>
                          {c.nombreCorto} ({c.rut})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={loadData}
                    className="p-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold shadow-xs transition-all cursor-pointer"
                    title="Actualizar datos"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadCsv}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-md transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Descargar Reporte Mensual (CSV)</span>
                  </button>
                </div>
              </div>

              {/* KPI Strip */}
              {report && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Total Peticiones
                    </span>
                    <p className="text-lg font-black text-slate-900 mt-0.5">
                      {report.totalesGenerales.totalLlamadas.toLocaleString('es-CL')}
                    </p>
                  </div>

                  <div className="p-3 bg-indigo-50/60 border border-indigo-200 rounded-xl shadow-xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                      Consultas Locales ($0)
                    </span>
                    <p className="text-lg font-black text-indigo-900 mt-0.5">
                      {report.totalesGenerales.llamadasLocales.toLocaleString('es-CL')}
                    </p>
                  </div>

                  <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl shadow-xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
                      Consultas Gemini
                    </span>
                    <p className="text-lg font-black text-blue-900 mt-0.5">
                      {report.totalesGenerales.llamadasGemini.toLocaleString('es-CL')}
                    </p>
                  </div>

                  <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl shadow-xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
                      Fallbacks Resilientes
                    </span>
                    <p className="text-lg font-black text-amber-900 mt-0.5">
                      {report.totalesGenerales.fallbacks.toLocaleString('es-CL')}
                    </p>
                  </div>

                  <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Gasto Cloud Total
                    </span>
                    <p className="text-sm font-black text-rose-600 mt-0.5">
                      ${report.totalesGenerales.costoTotalUsd.toFixed(4)} USD
                    </p>
                    <span className="text-[10px] text-slate-500 font-semibold">
                      (${report.totalesGenerales.costoTotalClp.toLocaleString('es-CL')} CLP)
                    </span>
                  </div>

                  <div className="p-3 bg-emerald-50/80 border border-emerald-300 rounded-xl shadow-xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                      Ahorro Estimado Local
                    </span>
                    <p className="text-sm font-black text-emerald-700 mt-0.5">
                      ${report.totalesGenerales.ahorroEstimadoClp.toLocaleString('es-CL')} CLP
                    </p>
                    <span className="text-[10px] text-emerald-600 font-semibold">
                      (${report.totalesGenerales.ahorroEstimadoUsd.toFixed(3)} USD)
                    </span>
                  </div>
                </div>
              )}

              {/* Tabla de Desglose por Cliente */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                    <span>Consumo y Costos Desglosados por Empresa Cliente</span>
                  </h4>
                  <span className="text-[11px] text-slate-500 font-medium">
                    {report?.empresas.length || 0} empresa(s) con registro de actividad
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100/75 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Empresa / RUT</th>
                        <th className="py-2.5 px-3 text-center">Total Peticiones</th>
                        <th className="py-2.5 px-3 text-center">Local (Ollama)</th>
                        <th className="py-2.5 px-3 text-center">Gemini Cloud</th>
                        <th className="py-2.5 px-3 text-center">Fallbacks</th>
                        <th className="py-2.5 px-3 text-right">Tokens Est.</th>
                        <th className="py-2.5 px-3 text-right">Gasto USD</th>
                        <th className="py-2.5 px-3 text-right">Gasto Real CLP</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {report?.empresas && report.empresas.length > 0 ? (
                        report.empresas.map((emp) => (
                          <tr key={emp.empresaId} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2.5 px-3 font-semibold text-slate-900">
                              {getCompanyName(emp.empresaId)}
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold text-slate-800">
                              {emp.totalLlamadas}
                            </td>
                            <td className="py-2.5 px-3 text-center font-semibold text-indigo-700">
                              {emp.llamadasLocales}
                            </td>
                            <td className="py-2.5 px-3 text-center font-semibold text-blue-700">
                              {emp.llamadasGemini}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {emp.fallbacks > 0 ? (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                                  {emp.fallbacks}
                                </span>
                              ) : (
                                <span className="text-slate-400">0</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                              {emp.totalTokens.toLocaleString('es-CL')}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                              ${emp.costoTotalUsd.toFixed(4)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                              ${emp.costoTotalClp.toLocaleString('es-CL')} CLP
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-slate-500">
                            No se registran llamadas de IA para el período seleccionado.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Registro Auditable de Últimas Peticiones */}
              {report?.ultimasLlamadas && report.ultimasLlamadas.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                      <Clock className="w-4 h-4 text-indigo-600" />
                      <span>Auditoría de Últimas Consultas Procesadas</span>
                    </h4>
                    <span className="text-[11px] text-slate-500">
                      Últimas {report.ultimasLlamadas.length} transacciones
                    </span>
                  </div>

                  <div className="overflow-x-auto max-h-60 overflow-y-auto">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-slate-100 text-slate-600 font-semibold sticky top-0 border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-3">Fecha/Hora</th>
                          <th className="py-2 px-3">Empresa</th>
                          <th className="py-2 px-3">Módulo</th>
                          <th className="py-2 px-3">Capacidad</th>
                          <th className="py-2 px-3">Modelo Usado</th>
                          <th className="py-2 px-3">Proveedor</th>
                          <th className="py-2 px-3 text-right">Latencia</th>
                          <th className="py-2 px-3 text-right">Costo CLP</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        {report.ultimasLlamadas.map((l) => (
                          <tr key={l.id} className="hover:bg-slate-50">
                            <td className="py-1.5 px-3 text-slate-500">
                              {new Date(l.timestamp).toLocaleTimeString('es-CL')}
                            </td>
                            <td className="py-1.5 px-3 font-sans font-medium text-slate-800">
                              {l.empresaId}
                            </td>
                            <td className="py-1.5 px-3 font-sans text-slate-600">{l.modulo}</td>
                            <td className="py-1.5 px-3">
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-700">
                                {l.capability}
                              </span>
                            </td>
                            <td className="py-1.5 px-3 font-bold text-slate-800">
                              {l.modeloUtilizado}
                              {l.fueFallback && (
                                <span className="ml-1 text-[9px] text-amber-600 font-sans font-bold">
                                  (Fallback)
                                </span>
                              )}
                            </td>
                            <td className="py-1.5 px-3">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                  l.proveedorUtilizado === 'LOCAL_OLLAMA'
                                    ? 'bg-indigo-100 text-indigo-700'
                                    : 'bg-blue-100 text-blue-700'
                                }`}
                              >
                                {l.proveedorUtilizado}
                              </span>
                            </td>
                            <td className="py-1.5 px-3 text-right text-slate-600">
                              {l.tiempoRespuestaMs}ms
                            </td>
                            <td className="py-1.5 px-3 text-right font-bold text-slate-900">
                              ${l.costoEstimadoClp}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <HelpCircle className="w-4 h-4 text-slate-400" />
            <span>
              La selección entre Gemini y Ollama puede cambiarse en cualquier momento sin reiniciar el servidor.
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
          >
            Cerrar Panel
          </button>
        </div>
      </div>
    </div>
  );
};
