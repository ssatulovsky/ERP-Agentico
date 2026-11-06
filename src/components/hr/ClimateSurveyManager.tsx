import React, { useState } from 'react';
import {
  HeartPulse,
  Smile,
  Users,
  Award,
  Sparkles,
  TrendingUp,
  AlertCircle,
  Lightbulb,
  CheckCircle2,
  Calendar,
  BarChart3,
  ThumbsUp,
} from 'lucide-react';
import type { CompanyProfile, HrClimateSurvey } from '../../types';
import { HrManagementService } from '../../services/hrManagementService';

interface Props {
  company: CompanyProfile;
}

export const ClimateSurveyManager: React.FC<Props> = ({ company }) => {
  const [surveys, setSurveys] = useState<HrClimateSurvey[]>(() =>
    HrManagementService.getClimateSurveys(company.rut)
  );
  const [selectedSurvey, setSelectedSurvey] = useState<HrClimateSurvey | null>(
    surveys[0] || null
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <HeartPulse className="w-5 h-5 text-rose-500" />
            Clima Organizacional, Diagnóstico de Personas & eNPS
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Agente Especialista: <strong>Ignacio Parra Sepúlveda</strong> (Monitoreo continuo de bienestar, compromiso y retención).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs bg-rose-50 text-rose-700 font-bold px-3 py-1.5 rounded-lg border border-rose-200 flex items-center gap-1.5">
            <Smile className="w-4 h-4 text-rose-600" />
            eNPS Promedio Empresa: <strong>+{selectedSurvey?.indiceEnpsLaboral || 62}</strong> (Excelente)
          </span>
        </div>
      </div>

      {selectedSurvey && (
        <div className="space-y-6">
          {/* Tarjetas de Dimensiones Clave */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
              <div className="text-xs text-slate-500 font-medium">Liderazgo & Jefaturas</div>
              <div className="text-xl font-bold text-slate-900 mt-1">
                {selectedSurvey.dimensiones.liderazgo}%
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
                <div
                  className="bg-blue-600 h-1.5 rounded-full"
                  style={{ width: `${selectedSurvey.dimensiones.liderazgo}%` }}
                />
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
              <div className="text-xs text-slate-500 font-medium">Compensaciones & Ben.</div>
              <div className="text-xl font-bold text-slate-900 mt-1">
                {selectedSurvey.dimensiones.remuneracionesBeneficios}%
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
                <div
                  className="bg-emerald-600 h-1.5 rounded-full"
                  style={{ width: `${selectedSurvey.dimensiones.remuneracionesBeneficios}%` }}
                />
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
              <div className="text-xs text-slate-500 font-medium">Ambiente Laboral</div>
              <div className="text-xl font-bold text-slate-900 mt-1">
                {selectedSurvey.dimensiones.ambienteLaboral}%
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
                <div
                  className="bg-indigo-600 h-1.5 rounded-full"
                  style={{ width: `${selectedSurvey.dimensiones.ambienteLaboral}%` }}
                />
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
              <div className="text-xs text-slate-500 font-medium">Balance Vida-Trabajo</div>
              <div className="text-xl font-bold text-slate-900 mt-1">
                {selectedSurvey.dimensiones.balanceVidaTrabajo}%
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
                <div
                  className="bg-purple-600 h-1.5 rounded-full"
                  style={{ width: `${selectedSurvey.dimensiones.balanceVidaTrabajo}%` }}
                />
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs col-span-2 sm:col-span-1">
              <div className="text-xs text-slate-500 font-medium">Desarrollo Profesional</div>
              <div className="text-xl font-bold text-slate-900 mt-1">
                {selectedSurvey.dimensiones.desarrolloCarrera}%
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
                <div
                  className="bg-amber-600 h-1.5 rounded-full"
                  style={{ width: `${selectedSurvey.dimensiones.desarrolloCarrera}%` }}
                />
              </div>
            </div>
          </div>

          {/* Diagnóstico Agéntico & Recomendaciones */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-5 space-y-3">
              <h4 className="text-xs font-bold text-amber-900 flex items-center gap-2 uppercase tracking-wider">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                Alertas Detectadas por el Agente
              </h4>
              <ul className="space-y-2">
                {selectedSurvey.alertasDetectadas.map((alerta, idx) => (
                  <li key={idx} className="text-xs text-amber-950 flex items-start gap-2">
                    <span className="text-amber-500 font-bold">•</span>
                    <span>{alerta}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-5 space-y-3">
              <h4 className="text-xs font-bold text-blue-900 flex items-center gap-2 uppercase tracking-wider">
                <Lightbulb className="w-4 h-4 text-blue-600" />
                Plan de Acción Recomendado (Agente de Clima)
              </h4>
              <ul className="space-y-2">
                {selectedSurvey.recomendacionesAgenteClima.map((rec, idx) => (
                  <li key={idx} className="text-xs text-blue-950 flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
