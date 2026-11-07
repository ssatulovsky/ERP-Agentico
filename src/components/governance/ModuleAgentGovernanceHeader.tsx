import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  Bot,
  UserCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  ChevronRight,
  Info,
  DollarSign,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import type { ModuleAgentApprovalRequest } from '../../types';
import {
  ModuleAgentGovernanceService,
  MODULE_AGENTS_REGISTRY,
} from '../../services/moduleAgentGovernanceService';
import { formatCLP } from '../../utils/chileanAccounting';

interface Props {
  moduloId: string;
  empresaId: string;
  onOperationExecuted?: (approval: ModuleAgentApprovalRequest) => void;
}

export const ModuleAgentGovernanceHeader: React.FC<Props> = ({
  moduloId,
  empresaId,
  onOperationExecuted,
}) => {
  const [showApprovalsModal, setShowApprovalsModal] = useState(false);
  const [approvals, setApprovals] = useState<ModuleAgentApprovalRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchApprovals = useCallback(async () => {
    if (!empresaId) return;
    setIsLoading(true);
    try {
      const items = await ModuleAgentGovernanceService.fetchPendingApprovalsFromApi(empresaId, moduloId);
      setApprovals(items);
    } catch (err: any) {
      console.warn('Error fetching governance approvals:', err);
    } finally {
      setIsLoading(false);
    }
  }, [empresaId, moduloId]);

  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  const agentDef = ModuleAgentGovernanceService.getAgentByModule(moduloId);
  const pendingCount = approvals.filter((a) => a.estado === 'PENDIENTE').length;

  const handleResolve = async (approvalId: string, approved: boolean) => {
    setResolvingId(approvalId);
    setActionMessage(null);
    try {
      const resolved = await ModuleAgentGovernanceService.executeApprovedOperationViaApi(
        approvalId,
        'Usuario Autenticado (Aprobador)',
        approved
      );

      setActionMessage({
        type: resolved.estado === 'ERROR_EJECUCION' ? 'error' : 'success',
        text: resolved.resultadoEjecucion || (approved ? 'Operación aprobada y centralizada exitosamente.' : 'Operación rechazada.'),
      });

      await fetchApprovals();

      if (onOperationExecuted) {
        onOperationExecuted(resolved);
      }
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: `Fallo al procesar aprobación: ${err.message}`,
      });
    } finally {
      setResolvingId(null);
    }
  };

  if (!agentDef) return null;

  return (
    <>
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-xl p-4 shadow-sm border border-slate-700/60 mb-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Perfil del Agente Responsable */}
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-indigo-300 shrink-0 shadow-inner">
            <Bot className="w-6 h-6" />
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm text-white tracking-wide">
                {agentDef.agenteNombre}
              </span>
              <span className="text-[11px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full font-medium">
                {agentDef.agenteCargo}
              </span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                Agente Responsable
              </span>
            </div>

            <p className="text-xs text-slate-300 mt-1 line-clamp-1 max-w-2xl font-sans">
              {agentDef.responsabilidad}
            </p>
          </div>
        </div>

        {/* Gobernanza & Aprobaciones */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right hidden lg:block">
            <div className="text-[11px] text-slate-400 font-mono">Modo de Operación</div>
            <div className="text-xs font-bold text-emerald-400 flex items-center gap-1 justify-end">
              <span>Autonomía con Aprobación Humana</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowApprovalsModal(true)}
            className={`relative flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs ${
              pendingCount > 0
                ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold animate-pulse'
                : 'bg-slate-700/80 hover:bg-slate-700 text-slate-200 border border-slate-600'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Aprobaciones ({pendingCount})</span>
            {pendingCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-red-600 absolute -top-1 -right-1" />
            )}
          </button>
        </div>
      </div>

      {/* Modal de Aprobaciones Pendientes */}
      {showApprovalsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header del Modal */}
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-300">
                  <ShieldCheck className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">
                    Gobernanza Agéntica: Aprobaciones Pendientes ({agentDef.moduloNombre})
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    El agente ha preparado la operación y solicita autorización humana para concretarla.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowApprovalsModal(false)}
                className="text-slate-400 hover:text-white font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Contenido */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {actionMessage && (
                <div
                  className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                    actionMessage.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-rose-50 text-rose-800 border-rose-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {actionMessage.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span>{actionMessage.text}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActionMessage(null)}
                    className="text-xs font-bold text-slate-500 hover:text-slate-700 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              )}

              {isLoading && approvals.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <Loader2 className="w-8 h-8 text-indigo-500 mx-auto mb-2 animate-spin" />
                  <p className="text-xs font-semibold text-slate-600">Sincronizando aprobaciones con el servidor...</p>
                </div>
              ) : approvals.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2 opacity-80" />
                  <p className="text-sm font-bold text-slate-700">No hay operaciones pendientes de aprobación</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Todas las acciones propuestas por {agentDef.agenteNombre} están al día y autorizadas en el servidor.
                  </p>
                </div>
              ) : (
                approvals.map((appr) => (
                  <div
                    key={appr.id}
                    className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900">{appr.titulo}</span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              appr.nivelRiesgo === 'CRITICO'
                                ? 'bg-red-100 text-red-800'
                                : appr.nivelRiesgo === 'ALTO'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            Riesgo: {appr.nivelRiesgo}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1">{appr.descripcion}</p>
                      </div>

                      {appr.impactoFinancieroClp !== undefined && appr.impactoFinancieroClp > 0 && (
                        <div className="text-right font-mono shrink-0">
                          <div className="text-[10px] text-slate-400 font-sans">Impacto Caja</div>
                          <div className="text-xs font-bold text-slate-900">
                            {formatCLP(appr.impactoFinancieroClp)}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Detalle Operacional */}
                    <div className="bg-white p-3 rounded-lg border border-slate-200 text-xs font-mono text-slate-600 space-y-1">
                      <div className="font-sans font-semibold text-slate-800 text-[11px] mb-1">
                        Datos Técnicos de la Operación:
                      </div>
                      <pre className="text-[11px] overflow-x-auto text-slate-700">
                        {JSON.stringify(appr.datosOperacion, null, 2)}
                      </pre>
                    </div>

                    {/* Acciones de Aprobación */}
                    <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200">
                      <button
                        type="button"
                        disabled={resolvingId === appr.id}
                        onClick={() => handleResolve(appr.id, false)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {resolvingId === appr.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5" />
                        )}
                        <span>Rechazar</span>
                      </button>

                      <button
                        type="button"
                        disabled={resolvingId === appr.id}
                        onClick={() => handleResolve(appr.id, true)}
                        className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {resolvingId === appr.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        )}
                        <span>Aprobar y Concretar Operación</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setShowApprovalsModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
