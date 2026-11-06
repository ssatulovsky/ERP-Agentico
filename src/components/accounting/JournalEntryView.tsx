import React, { useState } from 'react';
import {
  type JournalEntry,
  type RawJournalEntryInput,
} from '../../types/accountingEntryFormat.types';
import {
  normalizeAndValidateJournalEntry,
  formatJournalEntryToTextTable,
  UnbalancedJournalEntryError,
} from '../../services/journalEntryNormalizer';
import { formatCLP } from '../../utils/chileanAccounting';
import {
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  FileText,
  Building2,
  Calendar,
  ShieldCheck,
  Hash,
} from 'lucide-react';

interface JournalEntryViewProps {
  entry: JournalEntry | RawJournalEntryInput;
  className?: string;
  showExportButton?: boolean;
  onApprove?: (entry: JournalEntry) => void;
  isApprovalDisabled?: boolean;
}

export const JournalEntryView: React.FC<JournalEntryViewProps> = ({
  entry,
  className = '',
  showExportButton = true,
  onApprove,
  isApprovalDisabled = false,
}) => {
  const [copied, setCopied] = useState(false);
  const [showRawText, setShowRawText] = useState(false);

  // Normalizar y validar en tiempo de renderizado
  let normalizedEntry: JournalEntry;
  let imbalanceError: string | null = null;

  try {
    normalizedEntry = normalizeAndValidateJournalEntry(entry);
  } catch (err: any) {
    if (err instanceof UnbalancedJournalEntryError) {
      imbalanceError = err.message;
      // Para poder renderizar las líneas en pantalla a pesar del descuadre:
      normalizedEntry = {
        id: entry.id || 'error-entry',
        folio: entry.folio,
        empresaId: entry.empresaId || '',
        periodo: entry.periodo || String(entry.fecha || '').slice(0, 7),
        fecha: entry.fecha || new Date().toISOString().split('T')[0],
        glosaGeneral: entry.glosaGeneral || 'Asiento con descuadre contable',
        documentoRef: entry.documentoRef,
        origenModulo: (entry.origenModulo as any) || 'MANUAL',
        lineas: (entry.lineas || []).map((l, idx) => ({
          linea: idx + 1,
          codigoCuenta: l.codigoCuenta || '9.9.99',
          nombreCuenta: l.nombreCuenta || (l as any).cuenta || 'Cuenta',
          rutAuxiliar: l.rutAuxiliar,
          centroCosto: l.centroCosto,
          glosaDetalle: l.glosaDetalle,
          debe: Number(l.debe) || 0,
          haber: Number(l.haber) || 0,
        })),
        totalDebe: err.totalDebe,
        totalHaber: err.totalHaber,
        diferencia: err.diferencia,
        creadoPorAgente: entry.creadoPorAgente || 'Agente Auditor',
      };
    } else {
      imbalanceError = err.message || 'Error de validación en asiento contable';
      return (
        <div className={`rounded-xl border border-red-200 bg-red-50 p-4 text-red-900 ${className}`}>
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <span>Asiento Contable Inválido (Rechazado por Auditoría)</span>
          </div>
          <p className="mt-1 text-sm text-red-700">{imbalanceError}</p>
        </div>
      );
    }
  }

  const isBalanced = !imbalanceError && Math.abs(normalizedEntry.diferencia) < 0.001;
  const rawTextOutput = formatJournalEntryToTextTable(normalizedEntry);

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(rawTextOutput);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Error al copiar al portapapeles:', e);
    }
  };

  return (
    <div
      className={`overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:shadow-md ${className}`}
    >
      {/* CABECERA FORMAL DEL ASIENTO DE LIBRO DIARIO */}
      <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-3.5 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-700">
                  Libro Diario Oficial
                </span>
                {normalizedEntry.folio && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-slate-200/70 px-2 py-0.5 text-xs font-mono font-medium text-slate-700">
                    <Hash className="h-3 w-3" />
                    Folio {normalizedEntry.folio}
                  </span>
                )}
                <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                  {normalizedEntry.origenModulo}
                </span>
              </div>
              <h4 className="mt-0.5 text-sm font-semibold text-slate-900 line-clamp-1">
                {normalizedEntry.glosaGeneral}
              </h4>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* BADGE DE PARTIDA DOBLE */}
            {isBalanced ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                Partida Doble Cuadrada
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-800">
                <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                Descuadre (${Math.abs(normalizedEntry.diferencia).toFixed(2)})
              </span>
            )}

            {/* BOTÓN COPIAR TEXTO CANÓNICO */}
            {showExportButton && (
              <button
                type="button"
                onClick={handleCopyText}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                title="Copiar comprobante formal en texto plano para informes o peritaje"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="text-emerald-700">Copiado</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 text-slate-500" />
                    <span>Copiar Folio</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowRawText(!showRawText)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              title="Alternar vista ASCII / Libro Diario impreso"
            >
              <FileText className="h-3.5 w-3.5" />
              <span>{showRawText ? 'Ver Tabla' : 'Ver ASCII'}</span>
            </button>
          </div>
        </div>

        {/* METADATOS TRIBUTARIOS Y AUDITORÍA */}
        <div className="mt-2.5 flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-600 border-t border-slate-200/60 pt-2">
          <div className="flex items-center gap-1">
            <Building2 className="h-3.5 w-3.5 text-slate-400" />
            <span>RUT:</span>
            <span className="font-mono font-medium text-slate-800">{normalizedEntry.empresaId}</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
            <span>Fecha:</span>
            <span className="font-medium text-slate-800">{normalizedEntry.fecha}</span>
            <span className="text-slate-400">({normalizedEntry.periodo})</span>
          </div>
          {normalizedEntry.documentoRef && (
            <div className="flex items-center gap-1">
              <span className="text-slate-400">Doc. Respaldo:</span>
              <span className="font-mono font-medium text-slate-800">{normalizedEntry.documentoRef}</span>
            </div>
          )}
          {normalizedEntry.supervisorSignature && (
            <div className="flex items-center gap-1 text-emerald-700">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span className="font-mono text-[11px] truncate max-w-[180px]" title={normalizedEntry.supervisorSignature}>
                HMAC: {normalizedEntry.supervisorSignature.slice(0, 16)}...
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ALERTA DE DESCUADRE SI APLICA */}
      {imbalanceError && (
        <div className="border-b border-red-200 bg-red-50/90 px-4 py-2 text-xs text-red-800 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
          <span>{imbalanceError}</span>
        </div>
      )}

      {/* VISTA ASCII ALTERNATIVA */}
      {showRawText ? (
        <div className="p-4 bg-slate-950 text-emerald-400 font-mono text-xs overflow-x-auto selection:bg-emerald-800 selection:text-white">
          <pre className="whitespace-pre leading-relaxed">{rawTextOutput}</pre>
        </div>
      ) : (
        /* TABLA DE PARTIDA DOBLE FORMAL (LIBRO DIARIO) */
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-100/70 font-semibold text-slate-700">
              <tr>
                <th className="w-12 px-3.5 py-2.5 text-center">Lín.</th>
                <th className="w-28 px-3.5 py-2.5">Código</th>
                <th className="px-3.5 py-2.5">Cuenta Contable Oficial / Glosa</th>
                <th className="w-32 px-3.5 py-2.5">Auxiliar / C.Costo</th>
                <th className="w-36 px-3.5 py-2.5 text-right font-mono">DEBE ($)</th>
                <th className="w-36 px-3.5 py-2.5 text-right font-mono">HABER ($)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {normalizedEntry.lineas.map((line) => {
                const isHaber = line.haber > 0;
                return (
                  <tr
                    key={line.linea}
                    className={`transition-colors hover:bg-slate-50/70 ${
                      isHaber ? 'bg-amber-50/20' : 'bg-white'
                    }`}
                  >
                    <td className="px-3.5 py-2.5 text-center font-mono text-slate-400 text-[11px]">
                      {line.linea}
                    </td>
                    <td className="px-3.5 py-2.5 font-mono text-slate-600 font-medium">
                      {line.codigoCuenta}
                    </td>
                    <td className="px-3.5 py-2.5">
                      <div className={`flex flex-col ${isHaber ? 'pl-5 sm:pl-7' : ''}`}>
                        <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                          {isHaber && <span className="text-slate-400 italic text-[11px]">a</span>}
                          {line.nombreCuenta}
                        </span>
                        {line.glosaDetalle && (
                          <span className="text-[11px] text-slate-500 italic mt-0.5">
                            {line.glosaDetalle}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3.5 py-2.5 text-slate-600">
                      {line.rutAuxiliar && (
                        <div className="font-mono text-[11px] text-slate-700">{line.rutAuxiliar}</div>
                      )}
                      {line.centroCosto && (
                        <div className="text-[10px] text-indigo-600 font-medium uppercase">
                          {line.centroCosto}
                        </div>
                      )}
                      {!line.rutAuxiliar && !line.centroCosto && (
                        <span className="text-slate-300 text-[10px]">—</span>
                      )}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono font-medium text-slate-900">
                      {line.debe > 0 ? formatCLP(line.debe) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono font-medium text-slate-900">
                      {line.haber > 0 ? formatCLP(line.haber) : <span className="text-slate-300">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* FILA DE SUMAS IGUALES */}
            <tfoot className="border-t-2 border-slate-300 bg-slate-50/90 font-bold text-slate-900">
              <tr>
                <td colSpan={4} className="px-3.5 py-2.5 text-right uppercase tracking-wider text-[11px] text-slate-600">
                  Sumas Iguales (Partida Doble Canónica):
                </td>
                <td className="px-3.5 py-2.5 text-right font-mono text-sm text-slate-950 border-t border-slate-400">
                  {formatCLP(normalizedEntry.totalDebe)}
                </td>
                <td className="px-3.5 py-2.5 text-right font-mono text-sm text-slate-950 border-t border-slate-400">
                  {formatCLP(normalizedEntry.totalHaber)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* ACCIONES DE APROBACIÓN O NOTA AL PIE */}
      {onApprove && (
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3 sm:px-6">
          <span className="text-xs text-slate-500">
            {isBalanced
              ? 'El asiento cumple las reglas de la partida doble y está listo para ser centralizado en el Libro Mayor.'
              : 'El asiento no puede ser aprobado debido a que presenta un descuadre en sus sumas.'}
          </span>
          <button
            type="button"
            disabled={!isBalanced || isApprovalDisabled}
            onClick={() => onApprove(normalizedEntry)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Check className="h-4 w-4" />
            <span>Aprobar y Centralizar en Diario</span>
          </button>
        </div>
      )}
    </div>
  );
};
