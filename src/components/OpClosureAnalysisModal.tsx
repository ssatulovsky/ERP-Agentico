import React from 'react';
import { ProductionOrder, ProductionOrderClosureAnalysis } from '../types';
import { formatCLP } from '../utils/chileanAccounting';
import { generateProductionOrderClosureAnalysis } from '../data/seedBudgetsAndWithdrawals';
import {
  CheckCircle2,
  AlertTriangle,
  X,
  TrendingDown,
  TrendingUp,
  Percent,
  DollarSign,
  PackageCheck,
  FileSpreadsheet,
  Layers,
  ArrowRight,
} from 'lucide-react';

interface OpClosureAnalysisModalProps {
  order: ProductionOrder;
  onClose: () => void;
  onConfirmLiquidate: (orderId: string, analysis: ProductionOrderClosureAnalysis) => void;
}

export const OpClosureAnalysisModal: React.FC<OpClosureAnalysisModalProps> = ({
  order,
  onClose,
  onConfirmLiquidate,
}) => {
  const analysis = generateProductionOrderClosureAnalysis(order);

  const getDiagnosticBadge = (status: ProductionOrderClosureAnalysis['diagnosticoEficiencia']) => {
    switch (status) {
      case 'EXCELENTE':
        return {
          color: 'bg-emerald-100 text-emerald-800 border-emerald-300',
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-600" />,
          title: 'Eficiencia Sobresaliente',
        };
      case 'DENTRO_DE_TOLERANCIA':
        return {
          color: 'bg-blue-100 text-blue-800 border-blue-300',
          icon: <CheckCircle2 className="w-5 h-5 text-blue-600" />,
          title: 'Dentro del Estándar Técnico',
        };
      case 'DESVIO_MODERADO':
        return {
          color: 'bg-amber-100 text-amber-800 border-amber-300',
          icon: <AlertTriangle className="w-5 h-5 text-amber-600" />,
          title: 'Desvío Moderado de Costos',
        };
      case 'SOBRECOSTO_CRITICO':
        return {
          color: 'bg-rose-100 text-rose-800 border-rose-300',
          icon: <AlertTriangle className="w-5 h-5 text-rose-600" />,
          title: 'Sobrecosto Crítico / Erosión de Margen',
        };
    }
  };

  const badge = getDiagnosticBadge(analysis.diagnosticoEficiencia);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full p-6 my-8 max-h-[90vh] overflow-y-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-200 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-black bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded">
                {order.folioOP}
              </span>
              {order.presupuestoFolio && (
                <span className="font-mono text-xs text-slate-500">
                  Ref Presupuesto: <strong>{order.presupuestoFolio}</strong>
                </span>
              )}
            </div>
            <h2 className="text-lg font-black text-slate-900 mt-1">
              Liquidación y Análisis Financiero de Cierre de Producción
            </h2>
            <p className="text-xs text-slate-500">
              {order.productoNombre} • Cliente: {order.clienteNombre || 'Cliente General'}
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Efficiency Diagnostic Banner */}
        <div className={`p-4 rounded-xl border flex items-start gap-3.5 ${badge.color}`}>
          <div className="mt-0.5">{badge.icon}</div>
          <div className="space-y-1 text-xs">
            <h4 className="font-black text-sm">{badge.title}</h4>
            <p className="font-medium leading-relaxed">{analysis.resumenDiagnostico}</p>
          </div>
        </div>

        {/* KPI Financial Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <span className="text-[10px] font-bold text-slate-500 uppercase block">Costo Total Presupuestado</span>
            <div className="text-lg font-black text-slate-800 mt-1">
              {formatCLP(analysis.costoTotalPresupuestado)}
            </div>
            <span className="text-[10px] text-slate-400">Meta base</span>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <span className="text-[10px] font-bold text-slate-500 uppercase block">Costo Real Incurrido</span>
            <div className="text-lg font-black text-slate-900 mt-1">
              {formatCLP(analysis.costoTotalReal)}
            </div>
            <div
              className={`text-[10px] font-bold flex items-center gap-0.5 mt-0.5 ${
                analysis.varianzaCostoTotalClp > 0 ? 'text-rose-600' : 'text-emerald-600'
              }`}
            >
              {analysis.varianzaCostoTotalClp > 0 ? '+' : ''}
              {formatCLP(analysis.varianzaCostoTotalClp)} ({analysis.varianzaCostoTotalPct}%)
            </div>
          </div>

          <div className="bg-blue-50 p-3.5 rounded-xl border border-blue-200">
            <span className="text-[10px] font-bold text-blue-700 uppercase block">Margen Presupuestado</span>
            <div className="text-lg font-black text-blue-800 mt-1">
              {analysis.margenPresupuestadoPct.toFixed(1)}%
            </div>
            <span className="text-[10px] text-blue-600">{formatCLP(analysis.margenPresupuestadoClp)}</span>
          </div>

          <div
            className={`p-3.5 rounded-xl border ${
              analysis.erosionMargenPct > 3
                ? 'bg-rose-50 border-rose-200 text-rose-900'
                : 'bg-emerald-50 border-emerald-200 text-emerald-900'
            }`}
          >
            <span className="text-[10px] font-bold uppercase block">Margen Real Obtenido</span>
            <div className="text-lg font-black mt-1">{analysis.margenRealPct.toFixed(1)}%</div>
            <div className="text-[10px] font-bold mt-0.5">
              {analysis.erosionMargenPct > 0 ? (
                <span className="text-rose-700">Erosión: -{analysis.erosionMargenPct}%</span>
              ) : (
                <span className="text-emerald-700">Mejora: +{Math.abs(analysis.erosionMargenPct)}%</span>
              )}
            </div>
          </div>
        </div>

        {/* Cost Element Variance Table (MPD, MOD, CIF) */}
        <div>
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <FileSpreadsheet className="w-4 h-4 text-blue-600" />
            <span>Varianza por Elemento del Costo de Fabricación (NIC 2)</span>
          </h4>

          <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
            <table className="w-full text-left">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Elemento del Costo</th>
                  <th className="py-2.5 px-3 text-right">Presupuestado ($)</th>
                  <th className="py-2.5 px-3 text-right">Real Incurrido ($)</th>
                  <th className="py-2.5 px-3 text-right">Varianza ($ CLP)</th>
                  <th className="py-2.5 px-3 text-center">Desvío %</th>
                  <th className="py-2.5 px-3">Impacto en el Margen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                <tr>
                  <td className="py-2.5 px-3 font-semibold text-slate-800">
                    Materia Prima Directa (MPD)
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                    {formatCLP(analysis.costoMpdPresupuestado)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                    {formatCLP(analysis.costoMpdReal)}
                  </td>
                  <td
                    className={`py-2.5 px-3 text-right font-mono font-bold ${
                      analysis.varianzaMpdClp > 0 ? 'text-rose-600' : 'text-emerald-600'
                    }`}
                  >
                    {analysis.varianzaMpdClp > 0 ? '+' : ''}{formatCLP(analysis.varianzaMpdClp)}
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono font-bold">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] ${
                        analysis.varianzaMpdPct > 0 ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {analysis.varianzaMpdPct > 0 ? '+' : ''}
                      {analysis.varianzaMpdPct}%
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-600 text-[11px]">
                    {analysis.varianzaMpdClp > 0
                      ? `Erosionó el margen en ${formatCLP(analysis.varianzaMpdClp)} por insumos extra.`
                      : 'Consumo conforme a la norma técnica.'}
                  </td>
                </tr>

                <tr>
                  <td className="py-2.5 px-3 font-semibold text-slate-800">
                    Mano de Obra Directa (MOD)
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                    {formatCLP(analysis.costoModPresupuestado)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                    {formatCLP(analysis.costoModReal)}
                  </td>
                  <td
                    className={`py-2.5 px-3 text-right font-mono font-bold ${
                      analysis.varianzaModClp > 0 ? 'text-rose-600' : 'text-emerald-600'
                    }`}
                  >
                    {analysis.varianzaModClp > 0 ? '+' : ''}{formatCLP(analysis.varianzaModClp)}
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono font-bold">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] ${
                        analysis.varianzaModPct > 0 ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {analysis.varianzaModPct > 0 ? '+' : ''}
                      {analysis.varianzaModPct}%
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-600 text-[11px]">
                    {analysis.varianzaModClp > 0
                      ? 'Horas extras o retraso en etapa de armado/relingado.'
                      : 'Productividad de taller óptima.'}
                  </td>
                </tr>

                <tr>
                  <td className="py-2.5 px-3 font-semibold text-slate-800">
                    Costos Indirectos de Fabricación (CIF)
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                    {formatCLP(analysis.costoCifPresupuestado)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                    {formatCLP(analysis.costoCifReal)}
                  </td>
                  <td
                    className={`py-2.5 px-3 text-right font-mono font-bold ${
                      analysis.varianzaCifClp > 0 ? 'text-rose-600' : 'text-emerald-600'
                    }`}
                  >
                    {analysis.varianzaCifClp > 0 ? '+' : ''}{formatCLP(analysis.varianzaCifClp)}
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono font-bold">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] ${
                        analysis.varianzaCifPct > 0 ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {analysis.varianzaCifPct > 0 ? '+' : ''}
                      {analysis.varianzaCifPct}%
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-600 text-[11px]">
                    Prorrateo de absorción sobre horas de taller.
                  </td>
                </tr>
              </tbody>
              <tfoot className="bg-slate-50 font-black border-t-2 border-slate-300">
                <tr>
                  <td className="py-2.5 px-3 text-slate-900">TOTAL COSTO DE PRODUCCIÓN</td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                    {formatCLP(analysis.costoTotalPresupuestado)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-950">
                    {formatCLP(analysis.costoTotalReal)}
                  </td>
                  <td
                    className={`py-2.5 px-3 text-right font-mono ${
                      analysis.varianzaCostoTotalClp > 0 ? 'text-rose-700' : 'text-emerald-700'
                    }`}
                  >
                    {analysis.varianzaCostoTotalClp > 0 ? '+' : ''}
                    {formatCLP(analysis.varianzaCostoTotalClp)}
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono">
                    <span
                      className={`px-2.5 py-0.5 rounded ${
                        analysis.varianzaCostoTotalPct > 0
                          ? 'bg-rose-200 text-rose-900'
                          : 'bg-emerald-200 text-emerald-900'
                      }`}
                    >
                      {analysis.varianzaCostoTotalPct > 0 ? '+' : ''}
                      {analysis.varianzaCostoTotalPct}%
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-xs">
                    Precio Venta: {formatCLP(analysis.precioVentaFinal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Detailed Itemized Material Deviation Table */}
        {analysis.detalleDesviosMateriales.length > 0 && (
          <div>
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-emerald-600" />
              <span>Auditoría de Insumos: Consumo Real vs Presupuestado en Bodega</span>
            </h4>

            <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3">Insumo / Material</th>
                    <th className="py-2 px-3 text-center">Cant. Presup.</th>
                    <th className="py-2 px-3 text-center">Cant. Retirada</th>
                    <th className="py-2 px-3 text-center">Desvío Físico</th>
                    <th className="py-2 px-3 text-right">Costo Presup. ($)</th>
                    <th className="py-2 px-3 text-right">Costo Real ($)</th>
                    <th className="py-2 px-3 text-right">Impacto Margen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {analysis.detalleDesviosMateriales.map((m, idx) => (
                    <tr key={idx} className={m.desvioCantidad > 0 ? 'bg-rose-50/30' : ''}>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-800">{m.insumoNombre}</div>
                        <span className="font-mono text-[10px] text-slate-400">SKU: {m.insumoCodigo}</span>
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono">
                        {m.cantidadPresupuestada} {m.unidadMedida}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold">
                        {m.cantidadReal} {m.unidadMedida}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono">
                        {m.desvioCantidad !== 0 ? (
                          <span
                            className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                              m.desvioCantidad > 0
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {m.desvioCantidad > 0 ? '+' : ''}
                            {m.desvioCantidad} ({m.desvioCantidadPct}%)
                          </span>
                        ) : (
                          <span className="text-slate-400 font-medium">Exacto (0)</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                        {formatCLP(m.costoPresupuestado)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                        {formatCLP(m.costoReal)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold">
                        {m.desvioCostoClp !== 0 ? (
                          <span className={m.desvioCostoClp > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                            {m.desvioCostoClp > 0 ? '-' : '+'}
                            {Math.abs(m.impactoEnMargenPct)}%
                          </span>
                        ) : (
                          <span className="text-slate-400">0%</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-200">
          <div className="text-xs text-slate-500">
            Al liquidar la OP, se centraliza el stock en la bodega de productos terminados y se genera el asiento de
            cierre contable (WIP a PT).
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Cerrar Vista
            </button>
            <button
              onClick={() => onConfirmLiquidate(order.id, analysis)}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg text-xs font-black shadow-md cursor-pointer transition"
            >
              <PackageCheck className="w-4 h-4" />
              <span>Confirmar Cierre y Liquidar a Inventario PT</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
