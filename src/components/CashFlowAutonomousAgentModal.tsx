import React, { useState } from 'react';
import {
  X,
  Bot,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  DollarSign,
  Users,
  ShieldCheck,
  FileText,
  Hammer,
  ArrowRight,
  TrendingDown,
  Building2,
  HelpCircle
} from 'lucide-react';
import {
  CashFlowMovement,
  EmployeePayroll,
  F29Declaration,
  ProductionBudget,
  ProductionOrder,
  DteDocument,
  LeaseContract,
  ErpCommitmentsScanResult,
} from '../types';
import { scanErpCommitments } from '../utils/cashFlowProjectionEngine';

interface CashFlowAutonomousAgentModalProps {
  payrolls?: EmployeePayroll[];
  f29?: F29Declaration;
  productionBudgets?: ProductionBudget[];
  productionOrders?: ProductionOrder[];
  dtes?: DteDocument[];
  leases?: LeaseContract[];
  existingMovements: CashFlowMovement[];
  onClose: () => void;
  onSyncMovements: (movementsToSync: CashFlowMovement[]) => void;
}

export const CashFlowAutonomousAgentModal: React.FC<CashFlowAutonomousAgentModalProps> = ({
  payrolls = [],
  f29,
  productionBudgets = [],
  productionOrders = [],
  dtes = [],
  leases = [],
  existingMovements = [],
  onClose,
  onSyncMovements,
}) => {
  const { scanResult, projectedMovements } = scanErpCommitments({
    payrolls,
    f29,
    productionBudgets,
    productionOrders,
    dtes,
    leases,
    existingMovements,
  });

  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(projectedMovements.map(m => m.id))
  );

  const toggleSelectAll = () => {
    if (selectedIds.size === projectedMovements.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(projectedMovements.map(m => m.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleConfirmSync = () => {
    const selectedMovements = projectedMovements.filter(m => selectedIds.has(m.id));
    onSyncMovements(selectedMovements);
    onClose();
  };

  const formatCLP = (val: number) => `$${Math.round(val).toLocaleString('es-CL')}`;

  const totalIngresosSync = projectedMovements
    .filter(m => selectedIds.has(m.id) && m.tipo === 'INGRESO')
    .reduce((acc, m) => acc + m.montoTotal, 0);

  const totalEgresosSync = projectedMovements
    .filter(m => selectedIds.has(m.id) && m.tipo === 'EGRESO')
    .reduce((acc, m) => acc + m.montoTotal, 0);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-slate-100">
        {/* Header */}
        <div className="p-4 sm:p-6 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white">
                  Agente Autónomo de Proyección de Compromisos ERP
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                  Rolling Forecast
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Auditoría proactiva del modelo ERP: Nómina, Previred, F29, Hitos de Producción y Facturas RCV
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80 space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Users className="w-3.5 h-3.5 text-blue-400" />
                <span>Nómina Sueldos</span>
              </div>
              <strong className="text-sm font-bold font-mono text-white block">
                {formatCLP(scanResult.nominaSueldos.totalLiquidoMensual)}
              </strong>
              <span className="text-[10px] text-slate-500 block">
                {scanResult.nominaSueldos.totalTrabajadores} trabajadores • Fin de mes
              </span>
            </div>

            <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80 space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                <span>Previred / Leyes</span>
              </div>
              <strong className="text-sm font-bold font-mono text-amber-300 block">
                {formatCLP(scanResult.previredLeyesSociales.totalPreviredMensual)}
              </strong>
              <span className="text-[10px] text-slate-500 block">
                Vence {scanResult.previredLeyesSociales.fechaVencimientoPrevired} (Día 13)
              </span>
            </div>

            <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80 space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <FileText className="w-3.5 h-3.5 text-emerald-400" />
                <span>F29 SII / TGR</span>
              </div>
              <strong className="text-sm font-bold font-mono text-emerald-300 block">
                {formatCLP(scanResult.f29Impuestos.totalAPagarF29)}
              </strong>
              <span className="text-[10px] text-slate-500 block">
                IVA + PPM • Vence día 20
              </span>
            </div>

            <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80 space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Hammer className="w-3.5 h-3.5 text-purple-400" />
                <span>Hitos Producción</span>
              </div>
              <strong className="text-sm font-bold font-mono text-purple-300 block">
                +{formatCLP(scanResult.produccionHitos.montoTotalHitosCobro)}
              </strong>
              <span className="text-[10px] text-slate-500 block">
                {scanResult.produccionHitos.totalPresupuestosAprobados} presupuestos aprobados
              </span>
            </div>
          </div>

          {/* List of Detected Commitments */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <span>Compromisos Identificados para Integración ({projectedMovements.length})</span>
                <span className="text-slate-500 text-[11px] font-normal">
                  • {selectedIds.size} seleccionados
                </span>
              </h4>

              <button
                onClick={toggleSelectAll}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors font-medium cursor-pointer"
              >
                {selectedIds.size === projectedMovements.length ? 'Deseleccionar Todos' : 'Seleccionar Todos'}
              </button>
            </div>

            {projectedMovements.length === 0 ? (
              <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-8 text-center text-slate-400 space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                <h5 className="font-semibold text-slate-200">El Flujo de Caja ya está al día con el ERP</h5>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  No se han detectado nuevos compromisos pendientes de nómina, Previred, F29 o presupuestos que no estén ya incorporados.
                </p>
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-800/40">
                {projectedMovements.map(m => {
                  const isSelected = selectedIds.has(m.id);
                  const isIngreso = m.tipo === 'INGRESO';

                  return (
                    <div
                      key={m.id}
                      onClick={() => toggleSelectOne(m.id)}
                      className={`p-3 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-slate-950/80 border-indigo-500/40 shadow-sm'
                          : 'bg-slate-950/30 border-slate-800/60 opacity-60 hover:opacity-100'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer"
                        />
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                isIngreso
                                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60'
                                  : 'bg-rose-950/80 text-rose-300 border border-rose-800/60'
                              }`}
                            >
                              {m.tipo}
                            </span>
                            <span className="text-xs font-semibold text-white">{m.concepto}</span>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-slate-400">
                            <span className="flex items-center gap-1 font-mono">
                              <Calendar className="w-3 h-3 text-slate-500" />
                              {m.fechaEstimada}
                            </span>
                            <span>•</span>
                            <span className="text-slate-300">{m.contraparte}</span>
                            {m.alertaRiesgo && (
                              <>
                                <span>•</span>
                                <span className="text-amber-400/90 flex items-center gap-1 text-[10px]">
                                  <AlertTriangle className="w-3 h-3" />
                                  {m.alertaRiesgo}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <strong
                          className={`font-mono text-xs font-bold block ${
                            isIngreso ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {isIngreso ? '+' : '-'}
                          {formatCLP(m.montoTotal)}
                        </strong>
                        <span className="text-[10px] text-slate-500 uppercase">{m.categoria}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Forecast Impact Box */}
          <div className="bg-slate-950 p-4 rounded-xl border border-indigo-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-1">
              <span className="font-semibold text-indigo-300 flex items-center gap-1.5">
                <Bot className="w-4 h-4 text-indigo-400" />
                Impacto en la Proyección de Liquidez
              </span>
              <p className="text-slate-400 text-[11px]">
                Al sincronizar estos compromisos, la curva diaria se alimentará con las fechas reales del ciclo comercial y tributario chileno.
              </p>
            </div>

            <div className="flex items-center gap-4 text-right">
              <div>
                <span className="text-slate-500 text-[10px] block">Ingresos a Sumar</span>
                <strong className="font-mono text-emerald-400 font-bold">+{formatCLP(totalIngresosSync)}</strong>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] block">Egresos a Comprometer</span>
                <strong className="font-mono text-rose-400 font-bold">-{formatCLP(totalEgresosSync)}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          <button
            onClick={handleConfirmSync}
            disabled={selectedIds.size === 0}
            className={`px-5 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all shadow-md cursor-pointer ${
              selectedIds.size > 0
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Sincronizar {selectedIds.size} Compromisos al Flujo Proyectado</span>
          </button>
        </div>
      </div>
    </div>
  );
};
