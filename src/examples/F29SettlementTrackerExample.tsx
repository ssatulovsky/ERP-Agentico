import React, { useState, useEffect } from 'react';
import {
  Calculator,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  ShieldCheck,
  FileSpreadsheet,
  FileCheck2,
  Wifi,
  Radio,
  StopCircle,
  Calendar,
  Building2,
  Info,
} from 'lucide-react';
import { useJobMonitor } from '../hooks/useJobMonitor';
import type { AgentJobResult, F29SettlementOutput } from '../queues/types';
import type { JobProgress } from '../hooks/types/jobMonitoring.types';
import type { CompanyProfile, ClientCompany } from '../types';
import { StandardJournalEntryTable } from '../components/accounting/StandardJournalEntryTable';

export interface F29SettlementTrackerExampleProps {
  company?: CompanyProfile | ClientCompany;
  periodo?: string;
}

/**
 * Componente visual de ejemplo para monitorear el ciclo de vida reactivo
 * de una liquidación tributaria mensual de F29 (Formulario 29 del SII).
 *
 * Demuestra:
 * 1. Mutación `POST /api/jobs/f29/settle` (con alias a `/f29-settlement`) con retorno `HTTP 202 Accepted`.
 * 2. Suscripción automática a través del hook `useJobMonitor<AgentJobResult, any>`.
 * 3. Degradación transparente entre SSE (`/api/jobs/stream/...`) y Polling con retroceso exponencial.
 * 4. Presentación accesible de estados ('idle', 'enqueued', 'processing', 'completed', 'failed', 'timeout').
 * 5. Visualización del resultado contable (`f29_mapeo` y asientos asociados).
 */
export const F29SettlementTrackerExample: React.FC<F29SettlementTrackerExampleProps> = ({
  company,
  periodo: initialPeriodo,
}) => {
  // Parámetros del formulario de liquidación F29 sincronizados con la empresa activa
  const [empresaId, setEmpresaId] = useState<string>(company?.rut || '');
  const [periodo, setPeriodo] = useState<string>(initialPeriodo || '2026-09');
  const [aplicarPostergacionIva, setAplicarPostergacionIva] = useState<boolean>(false);
  const [forceRecompute, setForceRecompute] = useState<boolean>(true);

  // Sincronizar automáticamente si cambia la empresa o período en el contexto principal
  useEffect(() => {
    if (company?.rut) {
      setEmpresaId(company.rut);
    }
  }, [company?.rut]);

  useEffect(() => {
    if (initialPeriodo) {
      setPeriodo(initialPeriodo);
    }
  }, [initialPeriodo]);

  // Modo de monitoreo configurable
  const [monitorMode, setMonitorMode] = useState<'auto' | 'sse' | 'polling'>('auto');

  // Identificadores de cola y trabajo para el hook
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Consumo del custom hook genérico useJobMonitor
  const {
    status,
    isLoading,
    isCompleted,
    isFailed,
    progress,
    result,
    error,
    traceId,
    cancelMonitoring,
    retry,
  } = useJobMonitor<AgentJobResult, { stepDetail?: string }>(
    'f29-settlement-queue',
    activeJobId,
    {
      mode: monitorMode,
      pollingIntervalMs: 1200,
      maxPollingIntervalMs: 10000,
      timeoutMs: 120000,
      onSuccess: (data, tId) => {
        console.log('[F29Tracker] Liquidación exitosa:', { data, tId });
      },
      onError: (err, tId) => {
        console.error('[F29Tracker] Error en liquidación:', { err, tId });
      },
      onProgress: (p: JobProgress<{ stepDetail?: string }>) => {
        console.log('[F29Tracker] Progreso reportado:', p.percentage, p.currentStep);
      },
    }
  );

  // Disparo de la mutación asíncrona hacia el backend
  const handleEnqueueF29 = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch('/api/jobs/f29/settle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          empresaId,
          periodo,
          aplicarPostergacionIva,
          forceRecompute,
        }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(
          responseData.message || responseData.error || `Error HTTP ${response.status}`
        );
      }

      if (responseData.data?.jobId) {
        setActiveJobId(responseData.data.jobId);
      } else {
        throw new Error('No se recibió jobId en la respuesta del servidor.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error inesperado al encolar trabajo.';
      setSubmitError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper para tipar la carga útil de salida generada con tolerancia a estructuras anidadas
  const f29Output = (result?.payloadGenerado as any) || (result as any) || undefined;

  return (
    <div id="f29-settlement-tracker-container" className="w-full max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Cabecera del Panel */}
      <div id="f29-tracker-header" className="bg-white border border-neutral-200 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-700">
              <Calculator className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-neutral-900">
                Monitor de Liquidación F29 y Propuesta Contable
              </h2>
              <p className="text-sm text-neutral-500">
                Orquestador reactivo de background workers con arquitectura híbrida SSE + Polling Backoff.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-500 font-medium">Modo de Transporte:</span>
            <div className="inline-flex rounded-lg border border-neutral-200 p-1 bg-neutral-50 text-xs">
              <button
                type="button"
                id="mode-auto-btn"
                onClick={() => setMonitorMode('auto')}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  monitorMode === 'auto'
                    ? 'bg-white text-blue-700 shadow-sm border border-neutral-200'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                Auto (SSE ➔ Polling)
              </button>
              <button
                type="button"
                id="mode-sse-btn"
                onClick={() => setMonitorMode('sse')}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  monitorMode === 'sse'
                    ? 'bg-white text-blue-700 shadow-sm border border-neutral-200'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                SSE Estricto
              </button>
              <button
                type="button"
                id="mode-polling-btn"
                onClick={() => setMonitorMode('polling')}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  monitorMode === 'polling'
                    ? 'bg-white text-blue-700 shadow-sm border border-neutral-200'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                Polling Jitter
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Formulario de Despacho (POST /api/jobs/f29/settle) */}
        <div id="f29-dispatch-card" className="lg:col-span-5 bg-white border border-neutral-200 rounded-xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="mb-4">
              <h3 className="text-base font-semibold text-neutral-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-neutral-600" />
                Parámetros de Liquidación F29
              </h3>
              {company && (
                <div className="mt-2.5 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800">{company.razonSocial}</span>
                    <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">{company.rut}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Autenticación SII configurada con RUT {company.rutAutenticacion || company.rut}</span>
                  </div>
                </div>
              )}
            </div>

            <form id="f29-dispatch-form" onSubmit={handleEnqueueF29} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  RUT / Identificador de Empresa (Heredado de sesión)
                </label>
                <input
                  id="empresaId-input"
                  type="text"
                  value={empresaId}
                  onChange={(e) => setEmpresaId(e.target.value)}
                  placeholder="Ej. 77.798.901-4"
                  className="w-full px-3 py-2 text-sm font-mono border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-50"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Periodo Tributario (YYYY-MM)
                </label>
                <div className="relative">
                  <input
                    id="periodo-input"
                    type="text"
                    value={periodo}
                    onChange={(e) => setPeriodo(e.target.value)}
                    placeholder="2026-09"
                    className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    pattern="^[0-9]{4}-(0[1-9]|1[0-2])$"
                    required
                  />
                  <Calendar className="w-4 h-4 text-neutral-400 absolute right-3 top-2.5 pointer-events-none" />
                </div>
              </div>

              <div className="pt-2 space-y-2">
                <label className="flex items-center gap-2 text-xs text-neutral-700 cursor-pointer">
                  <input
                    id="postergacion-checkbox"
                    type="checkbox"
                    checked={aplicarPostergacionIva}
                    onChange={(e) => setAplicarPostergacionIva(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                  />
                  <span>Aplicar postergación de IVA (Art. 64 bis Ley de IVA)</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-neutral-700 cursor-pointer">
                  <input
                    id="forcerecompute-checkbox"
                    type="checkbox"
                    checked={forceRecompute}
                    onChange={(e) => setForceRecompute(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                  />
                  <span>Forzar re-cálculo si ya existe en cola (Bypass Idempotencia)</span>
                </label>
              </div>

              {submitError && (
                <div id="submit-error-banner" className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{submitError}</span>
                </div>
              )}

              <button
                type="submit"
                id="dispatch-job-btn"
                disabled={isSubmitting || isLoading}
                className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-300 text-white font-medium text-sm rounded-lg transition-colors shadow-sm"
              >
                {isSubmitting ? (
                  <>
                    <RotateCcw className="w-4 h-4 animate-spin" />
                    Encolando trabajo en Express...
                  </>
                ) : (
                  <>
                    <span>Disparar Liquidación F29 (HTTP 202)</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="mt-6 pt-4 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
            <span className="flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-blue-600" />
              Cola: <strong className="font-mono text-neutral-800">f29-settlement-queue</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <Wifi className="w-3.5 h-3.5 text-emerald-600" />
              Estrategia: <span className="uppercase font-semibold">{monitorMode}</span>
            </span>
          </div>
        </div>

        {/* Panel Reactivo de Monitoreo en Vivo */}
        <div id="f29-monitor-card" className="lg:col-span-7 bg-white border border-neutral-200 rounded-xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-neutral-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-neutral-600" />
                Estado del Proceso en Segundo Plano
              </h3>

              {/* Badges de Estado Unívoco */}
              <div id="job-status-badge">
                {status === 'idle' && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-neutral-100 text-neutral-600 border border-neutral-200">
                    Inactivo (Idle)
                  </span>
                )}
                {status === 'enqueued' && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                    En cola (Enqueued)
                  </span>
                )}
                {status === 'processing' && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                    <RotateCcw className="w-3 h-3 animate-spin" />
                    En ejecución (Processing)
                  </span>
                )}
                {status === 'completed' && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Completado (Completed)
                  </span>
                )}
                {status === 'failed' && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Falla (Failed)
                  </span>
                )}
                {status === 'timeout' && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Excedió límite (Timeout)
                  </span>
                )}
              </div>
            </div>

            {/* Metadatos de la Tarea Actual */}
            <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3 space-y-1.5 text-xs font-mono mb-4">
              <div className="flex justify-between">
                <span className="text-neutral-500 font-sans">Job ID:</span>
                <span className="text-neutral-800 font-semibold truncate max-w-[280px]">
                  {activeJobId || 'Ningún trabajo en seguimiento'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500 font-sans">Trace ID:</span>
                <span className="text-neutral-800 truncate max-w-[280px]">
                  {traceId || '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500 font-sans">Paso actual:</span>
                <span className="text-neutral-800 font-sans font-medium">
                  {progress?.currentStep || (isLoading ? 'Determinando saldo tributario...' : '—')}
                </span>
              </div>
            </div>

            {/* Barra de Progreso Dinámica */}
            <div id="progress-container" className="space-y-1.5 mb-6">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-neutral-600">Avance de cálculo:</span>
                <span className="text-neutral-900 font-mono">
                  {progress ? `${Math.round(progress.percentage)}%` : isCompleted ? '100%' : '0%'}
                </span>
              </div>
              <div className="w-full bg-neutral-200 h-2.5 rounded-full overflow-hidden">
                <div
                  id="progress-bar-fill"
                  className={`h-full transition-all duration-300 ${
                    isCompleted
                      ? 'bg-emerald-600'
                      : isFailed
                      ? 'bg-red-600'
                      : 'bg-blue-600'
                  }`}
                  style={{
                    width: `${
                      isCompleted ? 100 : progress ? Math.max(progress.percentage, 5) : status === 'enqueued' ? 10 : 0
                    }%`,
                  }}
                />
              </div>
            </div>

            {/* Banner de Error o Falla */}
            {error && (
              <div id="monitor-error-banner" className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2 mb-4">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-semibold">Error reportado:</strong> {error}
                </div>
              </div>
            )}

            {/* Renderizado de Resultado Contable (f29_mapeo) */}
            {isCompleted && f29Output && (
              <div id="f29-result-panel" className="bg-emerald-50/50 border border-emerald-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                    <FileCheck2 className="w-4 h-4 text-emerald-700" />
                    Liquidación F29 Determinada con Éxito
                  </h4>
                  <span className="text-[11px] font-mono text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                    Asiento: {f29Output.asientoContableId || f29Output.asientoId || 'Generado'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-2.5 bg-white rounded border border-emerald-100">
                    <span className="text-neutral-500 block">Débito Fiscal (IVA Vtas):</span>
                    <strong className="text-neutral-900 font-mono text-sm">
                      ${Number(f29Output.debitoFiscal ?? f29Output.casillas?.c538_debitoFiscal ?? 0).toLocaleString('es-CL')}
                    </strong>
                  </div>
                  <div className="p-2.5 bg-white rounded border border-emerald-100">
                    <span className="text-neutral-500 block">Crédito Fiscal (IVA Compras):</span>
                    <strong className="text-neutral-900 font-mono text-sm">
                      ${Number(f29Output.creditoFiscal ?? f29Output.casillas?.c537_totalCreditoFiscal ?? 0).toLocaleString('es-CL')}
                    </strong>
                  </div>
                  <div className="p-2.5 bg-white rounded border border-emerald-100">
                    <span className="text-neutral-500 block">IVA Determinado:</span>
                    <strong className="text-neutral-900 font-mono text-sm">
                      ${Number(f29Output.ivaDeterminado ?? f29Output.casillas?.c089_impuestoDeterminado ?? 0).toLocaleString('es-CL')}
                    </strong>
                  </div>
                  <div className="p-2.5 bg-white rounded border border-emerald-100">
                    <span className="text-neutral-500 block">PPM (Tasa {Number((f29Output.tasaPpm ?? 0.01) * 100).toFixed(2)}%):</span>
                    <strong className="text-neutral-900 font-mono text-sm">
                      ${Number(f29Output.montoPpm ?? f29Output.casillas?.c062_ppmDeterminado ?? 0).toLocaleString('es-CL')}
                    </strong>
                  </div>
                  <div className="p-2.5 bg-white rounded border border-emerald-100">
                    <span className="text-neutral-500 block">Retención Honorarios:</span>
                    <strong className="text-neutral-900 font-mono text-sm">
                      ${Number(f29Output.retencionHonorarios ?? f29Output.casillas?.c151_retencionSegundaCategoria ?? 0).toLocaleString('es-CL')}
                    </strong>
                  </div>
                  <div className="p-2.5 bg-blue-50/80 rounded border border-blue-200">
                    <span className="text-blue-800 font-medium block">Total Impuesto a Pagar:</span>
                    <strong className="text-blue-900 font-mono text-sm font-bold">
                      ${Number(f29Output.totalImpuestoPagar ?? f29Output.casillas?.c091_totalAPagar ?? 0).toLocaleString('es-CL')}
                    </strong>
                  </div>
                </div>

                <div className="pt-2 border-t border-emerald-200/60 flex items-center justify-between text-[11px] text-emerald-800">
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Firma Contable: <code className="font-mono">{String(f29Output.supervisorSignature || 'SUPERVISOR-FIRMA-OK').slice(0, 16)}...</code>
                  </span>
                  <span>Tiempo Worker: <strong>{result?.tiempoEjecucionMs ?? 0}ms</strong></span>
                </div>

                {/* Asiento Oficial F29 en Formato Estándar Canónico */}
                {result?.comprobanteContable && (
                  <div className="mt-3 pt-3 border-t border-emerald-200">
                    <h5 className="text-xs font-bold text-slate-800 mb-2">
                      Comprobante Contable F29 Centralizado (Libro Diario)
                    </h5>
                    <StandardJournalEntryTable
                      entry={{
                        id: result.comprobanteContable.asientoId,
                        folio: result.comprobanteContable.asientoId,
                        periodo: periodo,
                        empresaId: company?.rut,
                        glosaGeneral: result.comprobanteContable.concepto,
                        documentoRef: `F29 SII Folio Electrónico`,
                        origenModulo: 'F29_CENTRALIZACION',
                        lineas: result.comprobanteContable.lineasContables.map((l) => ({
                          codigoCuenta: l.codigoCuenta,
                          nombreCuenta: l.nombreCuenta,
                          debe: l.debe,
                          haber: l.haber,
                        })),
                        totalDebe: result.comprobanteContable.totalDebe,
                        totalHaber: result.comprobanteContable.totalHaber,
                        supervisorSignature: result.comprobanteContable.supervisorSignature,
                      }}
                      showGlosaHeader={true}
                      showCopyButton={true}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Botones de Control de Monitoreo */}
          <div id="monitor-controls" className="mt-6 pt-4 border-t border-neutral-100 flex items-center justify-between gap-3">
            <div className="text-xs text-neutral-500 flex items-center gap-1">
              <Info className="w-3.5 h-3.5" />
              <span>Resiliencia reactiva ante pérdidas de conexión</span>
            </div>

            <div className="flex items-center gap-2">
              {isLoading && (
                <button
                  type="button"
                  id="cancel-monitoring-btn"
                  onClick={cancelMonitoring}
                  className="px-3 py-1.5 border border-neutral-300 hover:bg-neutral-50 text-neutral-700 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors"
                >
                  <StopCircle className="w-3.5 h-3.5 text-neutral-500" />
                  Pausar Escucha
                </button>
              )}

              {(isFailed || status === 'timeout' || isCompleted) && activeJobId && (
                <button
                  type="button"
                  id="retry-monitoring-btn"
                  onClick={retry}
                  className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reintentar Monitoreo
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
