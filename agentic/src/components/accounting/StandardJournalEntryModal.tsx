import React from 'react';
import { CheckCircle2, X } from 'lucide-react';
import {
  StandardJournalEntryTable,
  type StandardJournalEntryData,
} from './StandardJournalEntryTable';

interface StandardJournalEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  entry: StandardJournalEntryData | null;
  onViewInLedger?: () => void;
}

export const StandardJournalEntryModal: React.FC<StandardJournalEntryModalProps> = ({
  isOpen,
  onClose,
  title = 'Asiento Contable Registrado con Éxito en el Libro Diario',
  subtitle,
  entry,
  onViewInLedger,
}) => {
  if (!isOpen || !entry) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Cabecera del Modal */}
        <div className="px-5 py-4 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 leading-tight">
                {title}
              </h3>
              {subtitle && (
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo del Modal con la Tabla de Asiento Estándar */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
          <StandardJournalEntryTable
            entry={entry}
            showGlosaHeader={true}
            showCopyButton={true}
          />
        </div>

        {/* Pie del Modal con Acciones */}
        <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 hidden sm:block">
            Normativa Código de Comercio &amp; Resolución Ex. SII N° 65
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {onViewInLedger && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onViewInLedger();
                }}
                className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Ver en Libro Diario
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-white transition-colors cursor-pointer shadow-2xs"
            >
              Entendido
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
