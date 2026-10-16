import React, { useState } from 'react';
import { CheckCircle2, AlertTriangle, Copy, Check, FileText, Calendar, Building2, Hash } from 'lucide-react';
import { formatCLP, formatNumberCL } from '../../utils/chileanAccounting';

export interface StandardJournalLine {
  linea?: number;
  codigoCuenta?: string;
  cuentaCodigo?: string;
  nombreCuenta?: string;
  cuentaNombre?: string;
  cuenta?: string;
  debe: number | string;
  haber: number | string;
  rutAuxiliar?: string | null;
  centroCosto?: string | null;
  proyecto?: string | null;
  glosaDetalle?: string | null;
}

export interface StandardJournalEntryData {
  id?: string;
  folio?: number | string;
  empresaId?: string;
  periodo?: string;
  fecha?: string;
  glosaGeneral?: string;
  concepto?: string;
  documentoRef?: string | null;
  documento?: string | null;
  origenModulo?: string;
  origen?: string;
  lineas: StandardJournalLine[];
  totalDebe?: number;
  totalHaber?: number;
  supervisorSignature?: string;
}

interface StandardJournalEntryTableProps {
  entry: StandardJournalEntryData;
  className?: string;
  showGlosaHeader?: boolean;
  showCopyButton?: boolean;
  compact?: boolean;
}

export const StandardJournalEntryTable: React.FC<StandardJournalEntryTableProps> = ({
  entry,
  className = '',
  showGlosaHeader = true,
  showCopyButton = true,
  compact = false,
}) => {
  const [copied, setCopied] = useState(false);
  const [showAscii, setShowAscii] = useState(false);

  const glosa = entry.glosaGeneral || entry.concepto || 'Asiento de Diario Oficial';
  const folio = entry.folio || entry.id;
  const fecha = entry.fecha || new Date().toISOString().split('T')[0];
  const periodo = entry.periodo || '';
  const origen = entry.origenModulo || entry.origen || 'DIARIO';
  const documento = entry.documentoRef || entry.documento;

  // Sanitizar y separar canónicamente: Cuentas del DEBE primero, cuentas del HABER después
  const rawLines = entry.lineas || [];
  const debitLines: Array<{
    codigo: string;
    nombre: string;
    debe: number;
    haber: number;
    rutAuxiliar?: string | null;
    centroCosto?: string | null;
    proyecto?: string | null;
  }> = [];

  const creditLines: Array<{
    codigo: string;
    nombre: string;
    debe: number;
    haber: number;
    rutAuxiliar?: string | null;
    centroCosto?: string | null;
    proyecto?: string | null;
  }> = [];

  rawLines.forEach((l) => {
    let d = Number(l.debe) || 0;
    let h = Number(l.haber) || 0;

    // Normalizar si viniese con signo negativo
    if (d < 0) {
      h += Math.abs(d);
      d = 0;
    }
    if (h < 0) {
      d += Math.abs(h);
      h = 0;
    }

    const codigo = l.codigoCuenta || l.cuentaCodigo || '9.9.99';
    const nombre = l.nombreCuenta || l.cuentaNombre || l.cuenta || 'Cuenta Contable';
    const rutAuxiliar = l.rutAuxiliar || null;
    const centroCosto = l.centroCosto || null;
    const proyecto = l.proyecto || (l as any).centroProyecto || null;

    if (d > 0) {
      debitLines.push({ codigo, nombre, debe: d, haber: 0, rutAuxiliar, centroCosto, proyecto });
    } else if (h > 0) {
      creditLines.push({ codigo, nombre, debe: 0, haber: h, rutAuxiliar, centroCosto, proyecto });
    } else {
      // Línea neutra o con cero
      debitLines.push({ codigo, nombre, debe: 0, haber: 0, rutAuxiliar, centroCosto, proyecto });
    }
  });

  const totalDebeCalc = debitLines.reduce((acc, l) => acc + l.debe, 0);
  const totalHaberCalc = creditLines.reduce((acc, l) => acc + l.haber, 0);
  const diff = Math.abs(totalDebeCalc - totalHaberCalc);
  const isBalanced = diff < 0.01;

  // Generación de texto ASCII canónico para portapapeles o peritaje
  const generateAsciiVoucher = (): string => {
    const sep = '--------------------------------------------------------------------------------';
    const linesText: string[] = [];
    let idx = 1;

    debitLines.forEach((l) => {
      const idxStr = String(idx++).padStart(2, ' ');
      const codStr = l.codigo.padEnd(9, ' ');
      const extra = [
        l.centroCosto ? `[CC: ${l.centroCosto}]` : '',
        l.proyecto ? `[Pry: ${l.proyecto}]` : '',
        l.rutAuxiliar ? `[RUT: ${l.rutAuxiliar}]` : '',
      ]
        .filter(Boolean)
        .join(' ');
      const fullNom = extra ? `${l.nombre} ${extra}` : l.nombre;
      const nomStr = (fullNom.length > 36 ? fullNom.slice(0, 33) + '...' : fullNom).padEnd(38, ' ');
      const dStr = formatNumberCL(l.debe).padStart(13, ' ');
      const hStr = ''.padStart(13, ' ');
      linesText.push(`${idxStr}  ${codStr} ${nomStr} ${dStr} ${hStr}`);
    });

    creditLines.forEach((l) => {
      const idxStr = String(idx++).padStart(2, ' ');
      const codStr = l.codigo.padEnd(9, ' ');
      const extra = [
        l.centroCosto ? `[CC: ${l.centroCosto}]` : '',
        l.proyecto ? `[Pry: ${l.proyecto}]` : '',
        l.rutAuxiliar ? `[RUT: ${l.rutAuxiliar}]` : '',
      ]
        .filter(Boolean)
        .join(' ');
      const fullNom = extra ? `  a ${l.nombre} ${extra}` : `  a ${l.nombre}`;
      const nomStr = (fullNom.length > 36 ? fullNom.slice(0, 33) + '...' : fullNom).padEnd(38, ' ');
      const dStr = ''.padStart(13, ' ');
      const hStr = formatNumberCL(l.haber).padStart(13, ' ');
      linesText.push(`${idxStr}  ${codStr} ${nomStr} ${dStr} ${hStr}`);
    });

    const totDebeStr = formatNumberCL(totalDebeCalc).padStart(13, ' ');
    const totHaberStr = formatNumberCL(totalHaberCalc).padStart(13, ' ');

    return [
      sep,
      `LIBRO DIARIO OFICIAL - COMPROBANTE DE ASIENTO CONTABLE`,
      `GLOSA: ${glosa}`,
      `FECHA: ${fecha} | PERÍODO: ${periodo || 'N/A'} | ORIGEN: ${origen}`,
      folio ? `FOLIO: ${folio}` : '',
      documento ? `DOC. RESPALDO: ${documento}` : '',
      sep,
      `LÍN CÓDIGO    CUENTA CONTABLE OFICIAL                 DEBE ($)     HABER ($)`,
      sep,
      ...linesText,
      sep,
      `SUMAS IGUALES (PARTIDA DOBLE):              ${totDebeStr} ${totHaberStr}`,
      `ESTADO: ${isBalanced ? 'CUADRADO (DIFERENCIA $0.00)' : `DESCUADRADO (DIFERENCIA $${diff.toFixed(2)})`}`,
      sep,
    ].filter(Boolean).join('\n');
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generateAsciiVoucher());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Error al copiar comprobante contable:', e);
    }
  };

  return (
    <div className={`border border-slate-200 bg-white rounded-xl shadow-xs overflow-hidden ${className}`}>
      {/* 1. GLOSA DE CABECERA Y METADATOS ESTÁNDAR */}
      {showGlosaHeader && (
        <div className="bg-slate-50/90 border-b border-slate-200 p-3.5 sm:p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1 max-w-xl">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold font-mono tracking-wider uppercase px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {origen}
                </span>
                {periodo && (
                  <span className="text-[11px] font-medium text-slate-600 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    Período: <strong className="text-slate-800 font-mono">{periodo}</strong>
                  </span>
                )}
                {folio && (
                  <span className="text-[11px] font-mono text-slate-600 flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-slate-200">
                    <Hash className="w-3 h-3 text-slate-400" />
                    Folio: <strong className="text-slate-800">{String(folio)}</strong>
                  </span>
                )}
              </div>

              {/* Glosa de Cabecera Principal */}
              <h4 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                {glosa}
              </h4>

              <div className="flex items-center gap-3 text-[11px] text-slate-500 flex-wrap">
                <span>Fecha: <strong className="text-slate-700 font-mono">{fecha}</strong></span>
                {entry.empresaId && (
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3 h-3 text-slate-400" />
                    RUT: <strong className="text-slate-700 font-mono">{entry.empresaId}</strong>
                  </span>
                )}
                {documento && (
                  <span>Doc. Ref: <strong className="text-slate-700 font-mono">{documento}</strong></span>
                )}
              </div>
            </div>

            {/* Badges de Cuadre y Acciones */}
            <div className="flex items-center gap-2 shrink-0">
              {isBalanced ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Cuadrado
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                  Descuadre ({formatCLP(diff)})
                </span>
              )}

              {showCopyButton && (
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer shadow-2xs"
                  title="Copiar comprobante contable oficial"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700 font-semibold">Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                      <span>Copiar Asiento</span>
                    </>
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowAscii(!showAscii)}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                title="Alternar vista ASCII / Libro Diario impreso"
              >
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[11px]">{showAscii ? 'Tabla' : 'ASCII'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. CONTENIDO: VISTA ASCII O TABLA ESTÁNDAR EN COLUMNAS */}
      {showAscii ? (
        <div className="p-4 bg-slate-950 text-emerald-400 font-mono text-xs overflow-x-auto selection:bg-emerald-900 selection:text-white">
          <pre className="whitespace-pre leading-relaxed">{generateAsciiVoucher()}</pre>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            {/* ENCABEZADOS DE COLUMNA ESTÁNDAR */}
            <thead>
              <tr className="bg-slate-100/80 text-slate-700 font-semibold border-b border-slate-200">
                <th className="w-12 px-3.5 py-2 text-center text-slate-500 text-[11px]">Lín.</th>
                <th className="w-24 px-3.5 py-2 font-mono text-slate-600 text-[11px]">Código</th>
                <th className="px-3.5 py-2 text-[11px]">Cuenta Contable Oficial / Glosa</th>
                <th className="w-32 px-3.5 py-2 text-right font-mono text-[11px] text-emerald-800">
                  DEBE ($)
                </th>
                <th className="w-32 px-3.5 py-2 text-right font-mono text-[11px] text-blue-800">
                  HABER ($)
                </th>
              </tr>
            </thead>

            {/* CUERPO DEL ASIENTO: BLOQUE 1 DEUDORAS (DEBE) + BLOQUE 2 ACREEDORAS (HABER) */}
            <tbody className="divide-y divide-slate-100 font-mono text-xs">
              {/* BLOQUE 1: CUENTAS DEL DEBE (CARGOS) */}
              {debitLines.map((line, idx) => (
                <tr key={`debe-${idx}`} className="hover:bg-slate-50/80 transition-colors bg-white">
                  <td className="px-3.5 py-2 text-center text-slate-400 text-[11px]">
                    {idx + 1}
                  </td>
                  <td className="px-3.5 py-2 text-slate-600 font-medium">
                    {line.codigo}
                  </td>
                  <td className="px-3.5 py-2 font-sans">
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-900">
                        {line.nombre}
                      </span>
                      <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                        {line.rutAuxiliar && (
                          <span className="text-[10px] text-slate-500 font-mono">
                            RUT: {line.rutAuxiliar}
                          </span>
                        )}
                        {line.centroCosto && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 font-mono border border-purple-200">
                            CC: {line.centroCosto}
                          </span>
                        )}
                        {line.proyecto && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-cyan-50 text-cyan-700 font-mono border border-cyan-200">
                            Pry: {line.proyecto}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-3.5 py-2 text-right font-bold text-slate-900">
                    {formatCLP(line.debe)}
                  </td>
                  <td className="px-3.5 py-2 text-right text-slate-300">
                    —
                  </td>
                </tr>
              ))}

              {/* BLOQUE 2: CUENTAS DEL HABER (ABONOS, CON SANGRÍA Y PREFIJO "a ") */}
              {creditLines.map((line, idx) => (
                <tr key={`haber-${idx}`} className="hover:bg-amber-50/40 transition-colors bg-amber-50/15">
                  <td className="px-3.5 py-2 text-center text-slate-400 text-[11px]">
                    {debitLines.length + idx + 1}
                  </td>
                  <td className="px-3.5 py-2 text-slate-600 font-medium">
                    {line.codigo}
                  </td>
                  <td className="px-3.5 py-2 font-sans">
                    <div className="flex flex-col pl-4 sm:pl-6">
                      <span className="text-slate-800 flex items-center gap-1.5 font-medium">
                        <span className="text-slate-400 italic text-[11px]">a</span>
                        <span>{line.nombre}</span>
                      </span>
                      <div className="flex items-center gap-1.5 flex-wrap mt-0.5 pl-3">
                        {line.rutAuxiliar && (
                          <span className="text-[10px] text-slate-500 font-mono">
                            RUT: {line.rutAuxiliar}
                          </span>
                        )}
                        {line.centroCosto && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 font-mono border border-purple-200">
                            CC: {line.centroCosto}
                          </span>
                        )}
                        {line.proyecto && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-cyan-50 text-cyan-700 font-mono border border-cyan-200">
                            Pry: {line.proyecto}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-3.5 py-2 text-right text-slate-300">
                    —
                  </td>
                  <td className="px-3.5 py-2 text-right font-bold text-slate-900">
                    {formatCLP(line.haber)}
                  </td>
                </tr>
              ))}
            </tbody>

            {/* 3. FILA DE SUMAS IGUALES AL PIE */}
            <tfoot>
              <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold text-slate-900">
                <td colSpan={3} className="px-3.5 py-2.5 text-right font-sans uppercase tracking-wider text-[11px] text-slate-600">
                  Sumas Iguales (Partida Doble):
                </td>
                <td className="px-3.5 py-2.5 text-right font-mono text-sm text-slate-900 border-t border-slate-400">
                  {formatCLP(totalDebeCalc)}
                </td>
                <td className="px-3.5 py-2.5 text-right font-mono text-sm text-slate-900 border-t border-slate-400">
                  {formatCLP(totalHaberCalc)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
};
