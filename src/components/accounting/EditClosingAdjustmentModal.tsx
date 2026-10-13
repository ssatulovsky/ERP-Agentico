import React, { useState } from 'react';
import { X, Check, Calculator, AlertCircle, Save, Plus, Trash2, Edit3 } from 'lucide-react';
import { PeriodClosingAdjustment, AccountingProposalLine } from '../../types';
import { formatCLP } from '../../utils/chileanAccounting';

interface EditClosingAdjustmentModalProps {
  isOpen: boolean;
  adjustment: PeriodClosingAdjustment;
  onClose: () => void;
  onSave: (updated: PeriodClosingAdjustment) => void;
}

export const EditClosingAdjustmentModal: React.FC<EditClosingAdjustmentModalProps> = ({
  isOpen,
  adjustment,
  onClose,
  onSave,
}) => {
  if (!isOpen) return null;

  const [glosa, setGlosa] = useState(adjustment.asientoPropuesto.glosa);
  const [lineas, setLineas] = useState<AccountingProposalLine[]>(() =>
    adjustment.asientoPropuesto.lineas.map(l => ({ ...l }))
  );
  const [error, setError] = useState<string | null>(null);

  const totalDebe = lineas.reduce((s, l) => s + (Number(l.debe) || 0), 0);
  const totalHaber = lineas.reduce((s, l) => s + (Number(l.haber) || 0), 0);
  const isCuadrado = Math.abs(totalDebe - totalHaber) < 1 && totalDebe > 0;

  const handleUpdateLine = (index: number, field: keyof AccountingProposalLine, val: any) => {
    setError(null);
    setLineas(prev => {
      const copy = [...prev];
      if (field === 'debe') {
        const num = Math.max(0, Number(val) || 0);
        copy[index] = {
          ...copy[index],
          debe: num,
          ...(num > 0 ? { haber: 0 } : {}),
        };
      } else if (field === 'haber') {
        const num = Math.max(0, Number(val) || 0);
        copy[index] = {
          ...copy[index],
          haber: num,
          ...(num > 0 ? { debe: 0 } : {}),
        };
      } else {
        copy[index] = { ...copy[index], [field]: val };
      }
      return copy;
    });
  };

  const handleAddLine = () => {
    setError(null);
    setLineas(prev => [
      ...prev,
      {
        codigo_cuenta: '6.1.04.999',
        nombre_cuenta: 'Otros Gastos Operacionales Devengados',
        debe: 0,
        haber: 0,
        centro_costo: 'ADMINISTRACION',
      },
    ]);
  };

  const handleRemoveLine = (index: number) => {
    if (lineas.length <= 2) {
      setError('Un asiento contable debe tener al menos 2 líneas para cumplir con la partida doble.');
      return;
    }
    setError(null);
    setLineas(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (!glosa.trim()) {
      setError('La glosa general del asiento es obligatoria.');
      return;
    }

    // Validación rigurosa de exclusividad Debe/Haber por cada partida
    for (let i = 0; i < lineas.length; i++) {
      const l = lineas[i];
      const d = Number(l.debe) || 0;
      const h = Number(l.haber) || 0;
      if (d > 0 && h > 0) {
        setError(`Línea #${i + 1} (${l.nombre_cuenta || l.codigo_cuenta}): No puede tener montos simultáneos en el Debe y en el Haber.`);
        return;
      }
      if (d <= 0 && h <= 0) {
        setError(`Línea #${i + 1} (${l.nombre_cuenta || l.codigo_cuenta}): Ingrese un monto mayor a cero en el Debe o en el Haber.`);
        return;
      }
    }

    if (!isCuadrado) {
      setError(`El asiento no está cuadrado: Debe ($${totalDebe.toLocaleString('es-CL')}) vs Haber ($${totalHaber.toLocaleString('es-CL')}). La diferencia es de $${Math.abs(totalDebe - totalHaber).toLocaleString('es-CL')}.`);
      return;
    }

    const updated: PeriodClosingAdjustment = {
      ...adjustment,
      montoAjuste: totalDebe,
      asientoPropuesto: {
        glosa: glosa.trim(),
        lineas: lineas.map(l => ({
          ...l,
          debe: Number(l.debe) || 0,
          haber: Number(l.haber) || 0,
        })),
      },
    };

    onSave(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8">
        {/* Encabezado */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-900/60 text-blue-300 border border-blue-700/50">
                  {adjustment.tipo}
                </span>
                <span className="text-[11px] text-slate-400 font-mono">ID: {adjustment.id}</span>
              </div>
              <h3 className="text-base font-bold text-white mt-0.5">
                Personalizar Cifras Reales del Ajuste de Cierre
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Alerta de Veracidad */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 flex items-start gap-3 text-xs text-blue-900">
            <Calculator className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Ajuste a la realidad de la empresa:</span> Adapte los montos de la provisión o devengo a los consumos y contratos efectivos de su organización antes de oficializar el asiento en el Libro Diario.
            </div>
          </div>

          {/* Glosa */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 font-mono uppercase tracking-wider">
              Glosa Explicativa del Asiento:
            </label>
            <input
              type="text"
              value={glosa}
              onChange={(e) => setGlosa(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white"
              placeholder="Descripción del ajuste contable..."
            />
          </div>

          {/* Tabla de Cuentas e Importes */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700 font-mono uppercase tracking-wider">
                Partidas Contables (Partida Doble):
              </span>
              <button
                type="button"
                onClick={handleAddLine}
                className="text-xs text-blue-700 hover:text-blue-900 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Agregar Cuenta</span>
              </button>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-700 font-mono font-bold text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Código</th>
                    <th className="py-2.5 px-3">Cuenta Contable</th>
                    <th className="py-2.5 px-3">Centro Costo</th>
                    <th className="py-2.5 px-3 text-right">Debe ($)</th>
                    <th className="py-2.5 px-3 text-right">Haber ($)</th>
                    <th className="py-2.5 px-2 text-center w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {lineas.map((line, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70">
                      <td className="py-2 px-2 w-28">
                        <input
                          type="text"
                          value={line.codigo_cuenta}
                          onChange={(e) => handleUpdateLine(idx, 'codigo_cuenta', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs font-mono font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="text"
                          value={line.nombre_cuenta}
                          onChange={(e) => handleUpdateLine(idx, 'nombre_cuenta', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                        />
                      </td>
                      <td className="py-2 px-2 w-32">
                        <input
                          type="text"
                          value={line.centro_costo || ''}
                          onChange={(e) => handleUpdateLine(idx, 'centro_costo', e.target.value)}
                          placeholder="CC (Opcional)"
                          className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs text-slate-700 focus:outline-none focus:border-blue-500 font-mono"
                        />
                      </td>
                      <td className="py-2 px-2 w-32">
                        <input
                          type="number"
                          min="0"
                          step="1000"
                          disabled={Number(line.haber) > 0}
                          value={line.debe || ''}
                          onChange={(e) => handleUpdateLine(idx, 'debe', Number(e.target.value) || 0)}
                          placeholder={Number(line.haber) > 0 ? '—' : '0'}
                          title={
                            Number(line.haber) > 0
                              ? 'No editable: esta partida ya tiene saldo en el Haber. Deje el Haber en 0 para habilitar el Debe.'
                              : 'Monto al Debe'
                          }
                          className={`w-full rounded px-2 py-1 text-xs text-right font-mono transition-colors ${
                            Number(line.haber) > 0
                              ? 'bg-slate-100 text-slate-300 border border-slate-200 cursor-not-allowed select-none opacity-60'
                              : Number(line.debe) > 0
                              ? 'bg-blue-50/80 border-2 border-blue-400 font-bold text-blue-900 focus:outline-none'
                              : 'bg-slate-50 border border-slate-200 font-medium text-slate-900 focus:outline-none focus:border-blue-500'
                          }`}
                        />
                      </td>
                      <td className="py-2 px-2 w-32">
                        <input
                          type="number"
                          min="0"
                          step="1000"
                          disabled={Number(line.debe) > 0}
                          value={line.haber || ''}
                          onChange={(e) => handleUpdateLine(idx, 'haber', Number(e.target.value) || 0)}
                          placeholder={Number(line.debe) > 0 ? '—' : '0'}
                          title={
                            Number(line.debe) > 0
                              ? 'No editable: esta partida ya tiene saldo en el Debe. Deje el Debe en 0 para habilitar el Haber.'
                              : 'Monto al Haber'
                          }
                          className={`w-full rounded px-2 py-1 text-xs text-right font-mono transition-colors ${
                            Number(line.debe) > 0
                              ? 'bg-slate-100 text-slate-300 border border-slate-200 cursor-not-allowed select-none opacity-60'
                              : Number(line.haber) > 0
                              ? 'bg-emerald-50/80 border-2 border-emerald-400 font-bold text-emerald-900 focus:outline-none'
                              : 'bg-slate-50 border border-slate-200 font-medium text-slate-900 focus:outline-none focus:border-emerald-500'
                          }`}
                        />
                      </td>
                      <td className="py-2 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(idx)}
                          className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Eliminar partida"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 font-mono font-bold text-xs border-t-2 border-slate-300">
                  <tr>
                    <td colSpan={3} className="py-3 px-3 text-slate-700">
                      Sumas Iguales:
                    </td>
                    <td className="py-3 px-3 text-right text-slate-900">
                      {formatCLP(totalDebe)}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-900">
                      {formatCLP(totalHaber)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Cuadre status */}
            <div className="mt-2 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                {isCuadrado ? (
                  <span className="text-emerald-700 font-bold flex items-center gap-1 font-mono">
                    <Check className="w-4 h-4 text-emerald-600" />
                    Partida Doble Cuadrada ($0 diferencia)
                  </span>
                ) : (
                  <span className="text-rose-600 font-bold flex items-center gap-1 font-mono">
                    <AlertCircle className="w-4 h-4 text-rose-500" />
                    Descuadrado por {formatCLP(Math.abs(totalDebe - totalHaber))}
                  </span>
                )}
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!isCuadrado}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-xs font-bold px-5 py-2 rounded-lg flex items-center gap-2 transition-all cursor-pointer shadow-xs disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            <span>Guardar Ajuste Personalizado</span>
          </button>
        </div>
      </div>
    </div>
  );
};
