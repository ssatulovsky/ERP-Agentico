import React from 'react';
import { X, Sliders, CheckCircle2, RotateCcw, TrendingUp, DollarSign, Users, Landmark, FileText, Factory, ShieldCheck } from 'lucide-react';
import { CashFlowInclusionParameters } from '../types';
import { DEFAULT_CASH_FLOW_INCLUSION_PARAMS } from '../utils/cashFlowProjectionEngine';

interface CashFlowParamsModalProps {
  parameters: CashFlowInclusionParameters;
  onChangeParameters: (params: CashFlowInclusionParameters) => void;
  onClose: () => void;
  historicalAverageMonthlySales?: number;
}

export const CashFlowParamsModal: React.FC<CashFlowParamsModalProps> = ({
  parameters = DEFAULT_CASH_FLOW_INCLUSION_PARAMS,
  onChangeParameters,
  onClose,
  historicalAverageMonthlySales = 0,
}) => {
  const safeParams = parameters || DEFAULT_CASH_FLOW_INCLUSION_PARAMS;

  const handleChange = <K extends keyof CashFlowInclusionParameters>(
    key: K,
    value: CashFlowInclusionParameters[K]
  ) => {
    onChangeParameters({
      ...safeParams,
      [key]: value,
    });
  };

  const handleReset = () => {
    onChangeParameters(DEFAULT_CASH_FLOW_INCLUSION_PARAMS);
  };

  const formatCLP = (val?: number) => `$${Math.round(val || 0).toLocaleString('es-CL')}`;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden my-8 animate-fadeIn">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 flex items-center justify-between border-b border-indigo-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Parametrización del Flujo de Caja
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                  Configuración Modular
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Seleccione las partidas que participarán en la proyección de ingresos, egresos y saldos
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 max-h-[72vh] overflow-y-auto text-slate-800">
          {/* Section 1: Baseline Inicial de Disponibilidad */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Landmark className="w-4 h-4 text-indigo-600" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                1. Partidas de Disponibilidad Inicial (Cash Baseline)
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={parameters.incluirCuentasBancarias}
                  onChange={(e) => handleChange('incluirCuentasBancarias', e.target.checked)}
                  className="mt-1 rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Cuentas Corrientes Bancarias</span>
                  <span className="text-[11px] text-slate-500">
                    Saldos conciliados en línea (Banco de Chile, BCI, Santander, etc.)
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={parameters.incluirCuentasEfectivo}
                  onChange={(e) => handleChange('incluirCuentasEfectivo', e.target.checked)}
                  className="mt-1 rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Cuentas de Efectivo & Fondos Fijos</span>
                  <span className="text-[11px] text-slate-500">
                    Caja Central, Fondos Fijos de Gerencia y Cajas Chicas operativas
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Section 2: Proyección de Ingresos & Ventas Históricas */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                2. Proyección de Ingresos & Ventas
              </h4>
            </div>

            {/* Ventas en base a historia RCV */}
            <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40 space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={parameters.incluirVentasProyectadasHistoria}
                  onChange={(e) => handleChange('incluirVentasProyectadasHistoria', e.target.checked)}
                  className="mt-1 rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-2">
                    Proyectar Ventas en base a Historia del Registro de Ventas (RCV / SII)
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-200 text-emerald-800">
                      Recomendado
                    </span>
                  </span>
                  <span className="text-[11px] text-slate-600 block mt-0.5">
                    Modela la facturación futura a partir del promedio mensual real de ventas emitidas en el RCV.
                  </span>
                </div>
              </label>

              {parameters.incluirVentasProyectadasHistoria && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-emerald-200/60 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Tasa Crecimiento Ventas (%):
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="-50"
                        max="100"
                        value={parameters.tasaCrecimientoVentasPct}
                        onChange={(e) => handleChange('tasaCrecimientoVentasPct', Number(e.target.value) || 0)}
                        className="w-full bg-white border border-slate-300 rounded-lg p-1.5 font-mono text-center font-bold text-slate-900 focus:border-emerald-600"
                      />
                      <span className="text-xs font-bold text-slate-500">%</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Días de Crédito Promedio:
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max="120"
                        value={parameters.diasCreditoVentasPromedio}
                        onChange={(e) => handleChange('diasCreditoVentasPromedio', Number(e.target.value) || 0)}
                        className="w-full bg-white border border-slate-300 rounded-lg p-1.5 font-mono text-center font-bold text-slate-900 focus:border-emerald-600"
                      />
                      <span className="text-xs text-slate-500">días</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      % Ventas al Contado:
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={parameters.pctVentasContado}
                        onChange={(e) => handleChange('pctVentasContado', Number(e.target.value) || 0)}
                        className="w-full bg-white border border-slate-300 rounded-lg p-1.5 font-mono text-center font-bold text-slate-900 focus:border-emerald-600"
                      />
                      <span className="text-xs font-bold text-slate-500">%</span>
                    </div>
                  </div>

                  {historicalAverageMonthlySales > 0 && (
                    <div className="sm:col-span-3 bg-white/80 rounded-lg p-2 border border-emerald-300/80 text-[11px] text-slate-600 flex items-center justify-between">
                      <span>Base Histórica Promedio Mensual RCV:</span>
                      <strong className="font-mono text-emerald-800 font-bold">
                        {formatCLP(historicalAverageMonthlySales)} / mes
                      </strong>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Other income items */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={parameters.incluirCobranzaDtePendientes}
                  onChange={(e) => handleChange('incluirCobranzaDtePendientes', e.target.checked)}
                  className="mt-1 rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Cobranza Facturas DTE</span>
                  <span className="text-[11px] text-slate-500">
                    Facturas de venta emitidas aún no cobradas según vencimiento
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={parameters.incluirHitosProduccion}
                  onChange={(e) => handleChange('incluirHitosProduccion', e.target.checked)}
                  className="mt-1 rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Hitos de Producción</span>
                  <span className="text-[11px] text-slate-500">
                    Cobranzas por hitos de entrega o presupuestos aprobados
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-xl border border-emerald-300 bg-emerald-50/50 hover:bg-emerald-100/50 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={parameters.incluirChequesCartera}
                  onChange={(e) => handleChange('incluirChequesCartera', e.target.checked)}
                  className="mt-1 rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Cheques en Cartera por Cobrar</span>
                  <span className="text-[11px] text-slate-500">
                    Documentos en custodia de clientes con fecha futura de depósito
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Section 3: Compromisos de Egresos */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <DollarSign className="w-4 h-4 text-rose-600" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                3. Compromisos de Egreso Operacional y Financiero
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={parameters.incluirNominaSueldos}
                  onChange={(e) => handleChange('incluirNominaSueldos', e.target.checked)}
                  className="mt-1 rounded text-rose-600 focus:ring-rose-500 w-4 h-4 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Nómina y Sueldos Líquidos</span>
                  <span className="text-[11px] text-slate-500">
                    Pago de remuneraciones a colaboradores a fin de cada mes
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={parameters.incluirPreviredLeyesSociales}
                  onChange={(e) => handleChange('incluirPreviredLeyesSociales', e.target.checked)}
                  className="mt-1 rounded text-rose-600 focus:ring-rose-500 w-4 h-4 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Previred e Imposiciones Sociales</span>
                  <span className="text-[11px] text-slate-500">
                    Vencimiento legal los días 10 al 13 de cada mes (AFP, Fonasa, Isapre, AFC, Mutual)
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={parameters.incluirF29Impuestos}
                  onChange={(e) => handleChange('incluirF29Impuestos', e.target.checked)}
                  className="mt-1 rounded text-rose-600 focus:ring-rose-500 w-4 h-4 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Impuestos Formulario 29 (F29 / TGR)</span>
                  <span className="text-[11px] text-slate-500">
                    IVA determinado, retención boletas honorarios y PPM obligatorio los días 20
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={parameters.incluirPagoProveedoresDte}
                  onChange={(e) => handleChange('incluirPagoProveedoresDte', e.target.checked)}
                  className="mt-1 rounded text-rose-600 focus:ring-rose-500 w-4 h-4 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Pago a Proveedores (Facturas DTE)</span>
                  <span className="text-[11px] text-slate-500">
                    Facturas de compra recibidas en el RCV pendientes de liquidación
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={parameters.incluirInsumosMpdProduccion}
                  onChange={(e) => handleChange('incluirInsumosMpdProduccion', e.target.checked)}
                  className="mt-1 rounded text-rose-600 focus:ring-rose-500 w-4 h-4 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Insumos & Materiales de Producción</span>
                  <span className="text-[11px] text-slate-500">
                    Adquisición de materia prima directa (MPD) para órdenes activas
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={parameters.incluirArriendosIfrs16}
                  onChange={(e) => handleChange('incluirArriendosIfrs16', e.target.checked)}
                  className="mt-1 rounded text-rose-600 focus:ring-rose-500 w-4 h-4 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Arriendos Operativos / IFRS 16</span>
                  <span className="text-[11px] text-slate-500">
                    Cánones mensuales de arriendo de inmuebles, galpones o vehículos
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-xl border border-rose-300 bg-rose-50/40 hover:bg-rose-100/40 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={parameters.incluirChequesEmitidos}
                  onChange={(e) => handleChange('incluirChequesEmitidos', e.target.checked)}
                  className="mt-1 rounded text-rose-600 focus:ring-rose-500 w-4 h-4 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Cheques Emitidos por Pagar</span>
                  <span className="text-[11px] text-slate-500">
                    Cheques diferidos girados a proveedores pendientes de cobro bancario
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-xl border border-rose-300 bg-rose-50/40 hover:bg-rose-100/40 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={parameters.incluirDeudaFinanciera}
                  onChange={(e) => handleChange('incluirDeudaFinanciera', e.target.checked)}
                  className="mt-1 rounded text-rose-600 focus:ring-rose-500 w-4 h-4 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Deudas con Inst. Financieras</span>
                  <span className="text-[11px] text-slate-500">
                    Cuotas de créditos comerciales, leasing bancario, pagarés y líneas
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-xl border border-rose-300 bg-rose-50/40 hover:bg-rose-100/40 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={parameters.incluirProvisionesEgresos}
                  onChange={(e) => handleChange('incluirProvisionesEgresos', e.target.checked)}
                  className="mt-1 rounded text-rose-600 focus:ring-rose-500 w-4 h-4 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-bold text-slate-900 block">
                    Provisiones de Egresos (Contables & Extracontables)
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Honorarios de auditoría, mantenciones, gratificaciones legales, IAS y partidas no periódicas con cálculo de IVA (19%)
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={parameters.incluirGastosFondoFijo}
                  onChange={(e) => handleChange('incluirGastosFondoFijo', e.target.checked)}
                  className="mt-1 rounded text-rose-600 focus:ring-rose-500 w-4 h-4 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Reposición de Fondos Fijos & Cajas Chicas</span>
                  <span className="text-[11px] text-slate-500">
                    Gastos menores operativos y rendiciones periódicas de efectivo
                  </span>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 font-semibold px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restablecer Valores por Defecto</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-2 text-xs font-bold text-white px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Aplicar Parámetros al Flujo</span>
          </button>
        </div>
      </div>
    </div>
  );
};
