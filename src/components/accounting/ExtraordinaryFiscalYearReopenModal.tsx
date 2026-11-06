import React, { useState } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  Lock,
  Unlock,
  CheckCircle2,
  X,
  FileText,
  KeyRound,
  FileCheck,
  AlertOctagon,
} from 'lucide-react';
import type { CompanyProfile } from '../../types';

interface ExtraordinaryFiscalYearReopenModalProps {
  isOpen: boolean;
  onClose: () => void;
  company: CompanyProfile;
  initialYear?: number;
  onConfirmReopen: (params: {
    ejercicio: number;
    motivoLegal: string;
    usuario: string;
    resolucionSii?: string;
  }) => void;
}

export const ExtraordinaryFiscalYearReopenModal: React.FC<ExtraordinaryFiscalYearReopenModalProps> = ({
  isOpen,
  onClose,
  company,
  initialYear,
  onConfirmReopen,
}) => {
  if (!isOpen) return null;

  const currentYear = company.ejercicioActivo || new Date().getFullYear();
  const closedYears = company.ejerciciosCerrados && company.ejerciciosCerrados.length > 0
    ? company.ejerciciosCerrados
    : [currentYear - 2, currentYear - 1]; // ej: [2024, 2025]

  const [selectedYear, setSelectedYear] = useState<number>(
    initialYear && closedYears.includes(initialYear)
      ? initialYear
      : closedYears[closedYears.length - 1] || currentYear - 1
  );

  const [usuario, setUsuario] = useState('Socio Auditor Principal / Administrador General');
  const [motivoLegal, setMotivoLegal] = useState('');
  const [resolucionSii, setResolucionSii] = useState('');
  const [confirmationCode, setConfirmationCode] = useState('');
  const [checkBalance, setCheckBalance] = useState(false);
  const [checkLegal, setCheckLegal] = useState(false);

  const requiredCode = `REABRIR-EJERCICIO-${selectedYear}`;
  const isCodeCorrect = confirmationCode.trim() === requiredCode;
  const isMotivoValid = motivoLegal.trim().length >= 30;
  const canSubmit = isCodeCorrect && isMotivoValid && checkBalance && checkLegal;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    onConfirmReopen({
      ejercicio: selectedYear,
      motivoLegal: motivoLegal.trim(),
      usuario: usuario.trim(),
      resolucionSii: resolucionSii.trim() || undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border-2 border-rose-300 w-full max-w-2xl max-h-[92vh] overflow-y-auto p-5 sm:p-6 space-y-4 animate-in fade-in duration-150">
        {/* Cabecera con advertencia de alta seguridad */}
        <div className="flex items-start justify-between pb-3 border-b border-rose-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 border border-rose-300 flex items-center justify-center text-rose-700 shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                  Reapertura Extraordinaria de Ejercicio Cerrado
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-300 uppercase tracking-wider">
                  Acceso Total
                </span>
              </div>
              <p className="text-xs text-rose-800 font-mono mt-0.5">
                Régimen Excepcional de Subsanación • NIC 8 / Art. 16 Código Tributario
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Banner Informativo y Advertencia Legal */}
        <div className="p-3.5 bg-rose-50 border border-rose-300 text-rose-950 rounded-xl text-xs space-y-1.5">
          <div className="flex items-center gap-2 font-bold text-rose-900">
            <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0" />
            <span>ADVERTENCIA DE RESPONSABILIDAD TÉCNICO-LEGAL Y TRIBUTARIA</span>
          </div>
          <p className="leading-relaxed text-rose-900">
            La reapertura de un ejercicio fiscal formalmente concluido altera los saldos del <strong>Balance General de 8 Columnas</strong>, el <strong>Estado de Resultados</strong> y las bases de <strong>Renta Líquida Imponible (F22)</strong> ya presentadas al SII.
          </p>
          <p className="text-[11px] text-rose-800">
            Este procedimiento solo debe ejecutarse ante <strong>errores materiales graves</strong>, rectificatorias tributarias formales o mandato judicial. Cada reapertura queda registrada de forma <strong>inmutable</strong> en la auditoría del sistema con fecha, firma y justificación.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Fila 1: Ejercicio y Perfil */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-800 block mb-1">
                Ejercicio Fiscal a Reabrir: *
              </label>
              <select
                value={selectedYear}
                onChange={(e) => {
                  setSelectedYear(Number(e.target.value));
                  setConfirmationCode('');
                }}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono font-bold text-slate-900 focus:ring-1 focus:ring-rose-500 focus:outline-hidden"
              >
                {closedYears.map((yr) => (
                  <option key={yr} value={yr}>
                    Ejercicio Fiscal {yr} (CERRADO)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-800 block mb-1">
                Perfil de Autorización (Accesos Totales): *
              </label>
              <input
                type="text"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                placeholder="Nombre o cargo del autorizador..."
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-medium text-slate-800 focus:ring-1 focus:ring-rose-500 focus:outline-hidden"
                required
              />
            </div>
          </div>

          {/* Fila 2: Folio de Rectificatoria o Resolución SII */}
          <div>
            <label className="font-bold text-slate-800 block mb-1">
              N° de Folio Rectificatoria SII / Expediente / Resolución Exenta:
            </label>
            <input
              type="text"
              value={resolucionSii}
              onChange={(e) => setResolucionSii(e.target.value)}
              placeholder="Ej: RECT-F22-FOLIO-8819203 / Res. Ex. N° 451 Regional Santiago"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono text-slate-800 focus:ring-1 focus:ring-rose-500 focus:outline-hidden"
            />
          </div>

          {/* Fila 3: Justificación Técnico-Legal Obligatoria (Mínimo 30 caracteres) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-bold text-slate-800">
                Fundamentación Técnico-Legal y Causa del Error Grave: *
              </label>
              <span
                className={`font-mono text-[10px] ${
                  isMotivoValid ? 'text-emerald-700 font-bold' : 'text-rose-600 font-medium'
                }`}
              >
                {motivoLegal.trim().length} / mín. 30 caracteres
              </span>
            </div>
            <textarea
              rows={3}
              value={motivoLegal}
              onChange={(e) => setMotivoLegal(e.target.value)}
              placeholder="Explique detalladamente la causa del error material, partidas a corregir y los trámites legales o tributarios que respaldan esta reapertura extraordinaria..."
              className={`w-full bg-slate-50 border rounded-lg p-2.5 text-slate-800 focus:ring-1 focus:outline-hidden ${
                isMotivoValid ? 'border-emerald-300 focus:ring-emerald-500' : 'border-rose-300 focus:ring-rose-500'
              }`}
              required
            />
          </div>

          {/* Fila 4: Declaración Jurada y Checkboxes de Responsabilidad */}
          <div className="space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={checkBalance}
                onChange={(e) => setCheckBalance(e.target.checked)}
                className="mt-0.5 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
              />
              <span className="text-slate-700 text-[11px] leading-tight">
                Confirmo que esta reapertura modificará los libros contables históricos de <strong>{selectedYear}</strong> y obligará a recalcular el Asiento de Apertura del ejercicio siguiente.
              </span>
            </label>

            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={checkLegal}
                onChange={(e) => setCheckLegal(e.target.checked)}
                className="mt-0.5 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
              />
              <span className="text-slate-700 text-[11px] leading-tight">
                Declaro bajo fe pública y responsabilidad profesional que este procedimiento responde a un error sustancial justificado ante el SII o las autoridades competentes.
              </span>
            </label>
          </div>

          {/* Fila 5: Confirmación Escrita Obligatoria */}
          <div className="p-3 bg-amber-50/70 border border-amber-300 rounded-xl space-y-1.5">
            <label className="block text-amber-950 font-bold text-[11px]">
              Confirmación de Seguridad Estricta:
            </label>
            <p className="text-[11px] text-amber-900">
              Para desbloquear este ejercicio, escriba exactamente: <code className="bg-amber-200 px-1.5 py-0.5 rounded font-mono font-black text-rose-950">{requiredCode}</code>
            </p>
            <input
              type="text"
              value={confirmationCode}
              onChange={(e) => setConfirmationCode(e.target.value)}
              placeholder={`Escriba "${requiredCode}" para autorizar`}
              className={`w-full bg-white border rounded-lg p-2 font-mono font-bold text-xs focus:ring-1 focus:outline-hidden ${
                isCodeCorrect
                  ? 'border-emerald-500 text-emerald-950 focus:ring-emerald-500'
                  : 'border-amber-400 text-slate-800 focus:ring-amber-500'
              }`}
            />
          </div>

          {/* Botones de Acción */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 font-semibold cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={!canSubmit}
              className={`px-5 py-2 rounded-lg font-bold text-white flex items-center gap-2 transition-all shadow-sm ${
                canSubmit
                  ? 'bg-rose-600 hover:bg-rose-700 cursor-pointer shadow-rose-600/20'
                  : 'bg-slate-300 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Unlock className="w-4 h-4" />
              <span>Ejecutar Reapertura Extraordinaria {selectedYear}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
