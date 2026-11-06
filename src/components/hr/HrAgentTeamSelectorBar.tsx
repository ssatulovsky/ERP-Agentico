import React, { useState } from 'react';
import {
  Users,
  ShieldCheck,
  Calculator,
  Gift,
  HeartPulse,
  Palmtree,
  FileCheck,
  FileText,
  ChevronRight,
  Info,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import { HR_AGENT_TEAM, HrAgentRole, HrAgentProfile } from '../../services/hrAgentTeamService';

interface Props {
  activeRole: HrAgentRole;
  onSelectAgentRole: (role: HrAgentRole) => void;
  onNavigateSubtab?: (subtab: string) => void;
}

export const HrAgentTeamSelectorBar: React.FC<Props> = ({
  activeRole,
  onSelectAgentRole,
  onNavigateSubtab,
}) => {
  const [showDetailModal, setShowDetailModal] = useState<HrAgentProfile | null>(null);

  const roleToSubtabMap: Record<HrAgentRole, string> = {
    GERENTE_RRHH: 'console',
    COMPENSACIONES_REMUNERACIONES: 'payroll_historical',
    BENEFICIOS_CORPORATIVOS: 'benefits',
    CLIMA_EVALUACIONES: 'climate_surveys',
    VACACIONES_PERMISOS: 'vacations',
    LICENCIAS_MEDICAS: 'medical_leaves',
    CONTRATOS_RELACIONES_LABORALES: 'contracts',
  };

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'ShieldCheck':
        return <ShieldCheck className="w-4 h-4 text-emerald-400" />;
      case 'Calculator':
        return <Calculator className="w-4 h-4 text-blue-400" />;
      case 'Gift':
        return <Gift className="w-4 h-4 text-purple-400" />;
      case 'HeartPulse':
        return <HeartPulse className="w-4 h-4 text-rose-400" />;
      case 'Palmtree':
        return <Palmtree className="w-4 h-4 text-amber-400" />;
      case 'FileCheck':
        return <FileCheck className="w-4 h-4 text-teal-400" />;
      default:
        return <FileText className="w-4 h-4 text-indigo-400" />;
    }
  };

  return (
    <>
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-xs mb-5">
        <div className="flex items-center justify-between mb-2.5 px-1">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Equipo de Agentes Especialistas de RRHH & Gobernanza
            </span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            7 Agentes Autónomos con Aprobación Humana
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {HR_AGENT_TEAM.map((agent) => {
            const isActive = activeRole === agent.id;
            return (
              <div
                key={agent.id}
                onClick={() => {
                  onSelectAgentRole(agent.id);
                  if (onNavigateSubtab) {
                    onNavigateSubtab(roleToSubtabMap[agent.id]);
                  }
                }}
                className={`p-2.5 rounded-lg border transition-all cursor-pointer flex flex-col justify-between ${
                  isActive
                    ? 'bg-indigo-950/80 border-indigo-500 shadow-xs'
                    : 'bg-slate-800/60 border-slate-700/70 hover:bg-slate-800 hover:border-slate-600'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="p-1.5 rounded-md bg-slate-900/80 border border-slate-700">
                      {getIcon(agent.avatarIcon)}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDetailModal(agent);
                      }}
                      className="text-slate-400 hover:text-white p-0.5 cursor-pointer"
                      title="Ver perfil y atribuciones de gobernanza"
                    >
                      <Info className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="font-bold text-xs text-white leading-tight line-clamp-1">
                    {agent.nombre}
                  </div>
                  <div className="text-[10px] text-slate-300 line-clamp-1 mt-0.5">
                    {agent.cargo}
                  </div>
                </div>

                <div className="mt-2 pt-1.5 border-t border-slate-700/50 flex items-center justify-between text-[9px]">
                  <span className={isActive ? 'text-indigo-300 font-bold' : 'text-slate-400'}>
                    {isActive ? 'Activo' : 'Gestionar'}
                  </span>
                  <ChevronRight className="w-3 h-3 text-slate-500" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal de Detalle de Atribuciones del Agente */}
      {showDetailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-300">
                  {getIcon(showDetailModal.avatarIcon)}
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">{showDetailModal.nombre}</h3>
                  <p className="text-xs text-indigo-300">{showDetailModal.cargo}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDetailModal(null)}
                className="text-slate-400 hover:text-white font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              <div>
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Especialidad Normativa
                </div>
                <div className="text-xs text-slate-700 font-medium mt-1">
                  {showDetailModal.especialidad}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Descripción del Rol
                </div>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {showDetailModal.descripcion}
                </p>
              </div>

              <div className="space-y-2">
                <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Acciones Autónomas que Ejecuta
                </div>
                <ul className="text-xs text-slate-600 space-y-1 pl-4 list-disc">
                  {showDetailModal.accionesAutonomas.map((acc, i) => (
                    <li key={i}>{acc}</li>
                  ))}
                </ul>
              </div>

              <div className="space-y-2">
                <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  Acciones que Requieren Aprobación Humana
                </div>
                <ul className="text-xs text-slate-600 space-y-1 pl-4 list-disc">
                  {showDetailModal.requiereAprobacionHumanaPara.map((req, i) => (
                    <li key={i}>{req}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setShowDetailModal(null)}
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
