import React, { useState } from 'react';
import {
  Sliders,
  Save,
  CheckCircle2,
  AlertTriangle,
  X,
  RotateCcw,
  Calendar,
  Lock,
  Building,
  Package,
  Truck,
  DollarSign,
  FileText,
  ShieldCheck
} from 'lucide-react';
import { SystemGeneralParameters } from '../../types';
import { DEFAULT_SYSTEM_PARAMETERS } from '../../config/erpMasterConfig';
import { STANDARD_ACCOUNT_PLAN } from '../../utils/chileanAccounting';

interface SystemGeneralConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  parameters: SystemGeneralParameters;
  onSaveParameters: (updatedParams: SystemGeneralParameters) => void;
}

export const SystemGeneralConfigModal: React.FC<SystemGeneralConfigModalProps> = ({
  isOpen,
  onClose,
  parameters,
  onSaveParameters,
}) => {
  const [formData, setFormData] = useState<SystemGeneralParameters>({
    ...DEFAULT_SYSTEM_PARAMETERS,
    ...parameters,
  });

  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleChange = <K extends keyof SystemGeneralParameters>(
    field: K,
    value: SystemGeneralParameters[K]
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveParameters(formData);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1200);
  };

  const handleResetToDefaults = () => {
    setFormData(DEFAULT_SYSTEM_PARAMETERS);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-slate-100 rounded-xl shadow-2xl border border-slate-300 w-full max-w-5xl overflow-hidden flex flex-col max-h-[95vh]">
        {/* Header matching Page 10 */}
        <div className="bg-[#0b192c] text-white px-5 py-3.5 flex items-center justify-between border-b-2 border-blue-500 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-xs">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold tracking-wide uppercase">
                Configuración de Sistema y Contabilidad General
              </h2>
              <p className="text-[10px] text-blue-300 font-mono tracking-wider">
                TENANT ID: {formData.tenantId || '001-A | DAIBUDA XI ENGINE'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider shadow-xs transition-colors cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Guardar Cambios</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-md transition-colors cursor-pointer ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {savedSuccess && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-5 py-2 flex items-center justify-between text-xs text-emerald-800 animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span className="font-bold">
                Parámetros generales de sistema y cierre Art. 16 CT guardados exitosamente.
              </span>
            </div>
          </div>
        )}

        {/* Modal Form Body - Layout matching Page 10 Screenshot */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* COLUMN 1 */}
            <div className="space-y-5">
              {/* SECTION: MAYOR GENERAL & CIERRE ART. 16 CT */}
              <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs space-y-3">
                <div className="border-b border-slate-100 pb-2 flex items-center justify-between">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    <span>Mayor General & Cierre Ejercicio (Art. 16 CT)</span>
                  </h3>
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">
                    SII COD. TRIBUTARIO
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Intervalo Días Vencimiento
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={formData.intervaloDiasVencimiento}
                        onChange={(e) => handleChange('intervaloDiasVencimiento', Number(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono font-bold focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <span className="absolute right-2.5 top-2 text-[10px] text-slate-400 font-bold">DÍAS</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Ejercicio Activo
                    </label>
                    <input
                      type="number"
                      value={formData.ejercicioActivo}
                      onChange={(e) => handleChange('ejercicioActivo', Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono font-bold text-blue-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-blue-50/50 p-2.5 rounded-md border border-blue-100">
                  <div>
                    <label className="block text-[10px] font-bold text-blue-900 uppercase mb-1">
                      Mes Cierre (Art. 16 CT)
                    </label>
                    <select
                      value={formData.mesCierreEjercicio}
                      onChange={(e) => handleChange('mesCierreEjercicio', Number(e.target.value))}
                      className="w-full bg-white border border-blue-200 rounded-md px-2.5 py-1 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value={12}>12 - Diciembre (Estándar Legal General)</option>
                      <option value={6}>06 - Junio (Agrícola / Cierre Especial)</option>
                      <option value={3}>03 - Marzo (Pesca / Estacional)</option>
                      <option value={9}>09 - Septiembre (Educación / Especial)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-blue-900 uppercase mb-1">
                      Día Cierre
                    </label>
                    <input
                      type="number"
                      value={formData.diaCierreEjercicio}
                      onChange={(e) => handleChange('diaCierreEjercicio', Number(e.target.value))}
                      className="w-full bg-white border border-blue-200 rounded-md px-2.5 py-1 text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div className="sm:col-span-2 flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="chk-bloqueo-cierre"
                        checked={formData.bloqueoPeriodoCerrado}
                        onChange={(e) => handleChange('bloqueoPeriodoCerrado', e.target.checked)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <label htmlFor="chk-bloqueo-cierre" className="text-xs font-medium text-slate-700 cursor-pointer flex items-center gap-1">
                        <Lock className="w-3 h-3 text-slate-500" />
                        <span>Bloquear transacciones e imputaciones en períodos cerrados</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Resultados Acumulados
                    </label>
                    <select
                      value={formData.cuentaResultadosAcumulados}
                      onChange={(e) => handleChange('cuentaResultadosAcumulados', e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {STANDARD_ACCOUNT_PLAN.map((acc) => (
                        <option key={acc.codigo} value={acc.codigo}>
                          {acc.codigo} - {acc.nombre}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Ganancia / Pérdida Año
                    </label>
                    <select
                      value={formData.cuentaGananciaPerdidaAno}
                      onChange={(e) => handleChange('cuentaGananciaPerdidaAno', e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {STANDARD_ACCOUNT_PLAN.map((acc) => (
                        <option key={acc.codigo} value={acc.codigo}>
                          {acc.codigo} - {acc.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Cuenta Variación Tipo Cambio
                    </label>
                    <select
                      value={formData.cuentaVariacionTipoCambio}
                      onChange={(e) => handleChange('cuentaVariacionTipoCambio', e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {STANDARD_ACCOUNT_PLAN.map((acc) => (
                        <option key={acc.codigo} value={acc.codigo}>
                          {acc.codigo} - {acc.nombre}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Cuenta para Cargos Bancarios
                    </label>
                    <select
                      value={formData.cuentaCargosBancarios}
                      onChange={(e) => handleChange('cuentaCargosBancarios', e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {STANDARD_ACCOUNT_PLAN.map((acc) => (
                        <option key={acc.codigo} value={acc.codigo}>
                          {acc.codigo} - {acc.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* SECTION: CLIENTES Y VENTAS */}
              <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs space-y-3">
                <div className="border-b border-slate-100 pb-2 flex items-center justify-between">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                    <span>Clientes y Ventas</span>
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Límite de Crédito por Defecto
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={formData.limiteCreditoDefecto}
                        onChange={(e) => handleChange('limiteCreditoDefecto', Number(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono font-bold focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <span className="absolute right-2.5 top-2 text-[10px] text-slate-400 font-bold">CLP</span>
                    </div>
                  </div>

                  <div className="flex items-center pt-5">
                    <input
                      type="checkbox"
                      id="chk-envio-lotes"
                      checked={formData.envioAcumuladoLotes}
                      onChange={(e) => handleChange('envioAcumuladoLotes', e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <label htmlFor="chk-envio-lotes" className="ml-2 text-xs font-medium text-slate-700 cursor-pointer">
                      Envío acumulado por lotes
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Texto Legal en la Factura (Pie de Documento DTE)
                  </label>
                  <textarea
                    rows={2}
                    value={formData.textoLegalFactura}
                    onChange={(e) => handleChange('textoLegalFactura', e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-md p-2 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Cuenta de Gastos de Envío
                  </label>
                  <select
                    value={formData.cuentaGastosEnvio}
                    onChange={(e) => handleChange('cuentaGastosEnvio', e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {STANDARD_ACCOUNT_PLAN.map((acc) => (
                      <option key={acc.codigo} value={acc.codigo}>
                        {acc.codigo} - {acc.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* SECTION: CLIENTES Y VENTAS POR DEFECTO */}
              <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs space-y-3">
                <div className="border-b border-slate-100 pb-2">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                    Clientes y Ventas por Defecto
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Cuentas por Cobrar
                    </label>
                    <select
                      value={formData.cuentasPorCobrarDefecto}
                      onChange={(e) => handleChange('cuentasPorCobrarDefecto', e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {STANDARD_ACCOUNT_PLAN.filter(a => a.tipo === 'ACTIVO').map((acc) => (
                        <option key={acc.codigo} value={acc.codigo}>
                          {acc.codigo} - {acc.nombre}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Cuenta de Ventas
                    </label>
                    <select
                      value={formData.cuentaVentasDefecto}
                      onChange={(e) => handleChange('cuentaVentasDefecto', e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {STANDARD_ACCOUNT_PLAN.filter(a => a.tipo === 'INGRESO').map((acc) => (
                        <option key={acc.codigo} value={acc.codigo}>
                          {acc.codigo} - {acc.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Cuenta Descuento en Ventas
                    </label>
                    <select
                      value={formData.cuentaDescuentoVentasDefecto}
                      onChange={(e) => handleChange('cuentaDescuentoVentasDefecto', e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {STANDARD_ACCOUNT_PLAN.map((acc) => (
                        <option key={acc.codigo} value={acc.codigo}>
                          {acc.codigo} - {acc.nombre}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Cuenta Descuento Pronto Pago
                    </label>
                    <select
                      value={formData.cuentaDescuentoProntoPagoDefecto}
                      onChange={(e) => handleChange('cuentaDescuentoProntoPagoDefecto', e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {STANDARD_ACCOUNT_PLAN.map((acc) => (
                        <option key={acc.codigo} value={acc.codigo}>
                          {acc.codigo} - {acc.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Despacho Requerido por
                  </label>
                  <div className="relative w-full sm:w-1/2">
                    <input
                      type="number"
                      value={formData.despachoRequeridoDias}
                      onChange={(e) => handleChange('despachoRequeridoDias', Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono font-bold focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <span className="absolute right-2.5 top-2 text-[10px] text-slate-400 font-bold">DÍAS</span>
                  </div>
                </div>
              </div>
            </div>

            {/* COLUMN 2 */}
            <div className="space-y-5">
              {/* SECTION: CENTRO DE COSTOS POR DEFECTO */}
              <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs space-y-3">
                <div className="border-b border-slate-100 pb-2">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                    Centro de Costos por Defecto
                  </h3>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Centro de Costos Requeridos Después de
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={formData.centroCostosRequeridosDespuesDias}
                      onChange={(e) => handleChange('centroCostosRequeridosDespuesDias', Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono font-bold focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <span className="absolute right-2.5 top-2 text-[10px] text-slate-400 font-bold">DÍAS</span>
                  </div>
                </div>
              </div>

              {/* SECTION: PROVEEDORES Y COMPRADORES */}
              <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs space-y-3">
                <div className="border-b border-slate-100 pb-2">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-amber-600" />
                    <span>Proveedores y Compradores</span>
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Rango de Tolerancia Entrega sobre Recepción
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={formData.rangoToleranciaEntregaSobreRecepcionPorc}
                        onChange={(e) => handleChange('rangoToleranciaEntregaSobreRecepcionPorc', Number(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono font-bold focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <span className="absolute right-2.5 top-2 text-[10px] text-slate-400 font-bold">%</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Rango de Tolerancia Factura sobre la Carga
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={formData.rangoToleranciaFacturaSobreCargaPorc}
                        onChange={(e) => handleChange('rangoToleranciaFacturaSobreCargaPorc', Number(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono font-bold focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <span className="absolute right-2.5 top-2 text-[10px] text-slate-400 font-bold">%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION: PROVEEDORES Y COMPRADORES POR DEFECTO */}
              <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs space-y-3">
                <div className="border-b border-slate-100 pb-2">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                    Proveedores y Compradores por Defecto
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Cuenta Pagable (Proveedores)
                    </label>
                    <select
                      value={formData.cuentaPagableDefecto}
                      onChange={(e) => handleChange('cuentaPagableDefecto', e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {STANDARD_ACCOUNT_PLAN.filter(a => a.tipo === 'PASIVO').map((acc) => (
                        <option key={acc.codigo} value={acc.codigo}>
                          {acc.codigo} - {acc.nombre}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Cuenta Descuento en Compras
                    </label>
                    <select
                      value={formData.cuentaDescuentoComprasDefecto}
                      onChange={(e) => handleChange('cuentaDescuentoComprasDefecto', e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {STANDARD_ACCOUNT_PLAN.map((acc) => (
                        <option key={acc.codigo} value={acc.codigo}>
                          {acc.codigo} - {acc.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Cuenta de Guía de Entrada (Recepción Prov.)
                  </label>
                  <select
                    value={formData.cuentaGuiaEntradaDefecto}
                    onChange={(e) => handleChange('cuentaGuiaEntradaDefecto', e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {STANDARD_ACCOUNT_PLAN.map((acc) => (
                      <option key={acc.codigo} value={acc.codigo}>
                        {acc.codigo} - {acc.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* SECTION: INVENTARIO */}
              <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs space-y-3">
                <div className="border-b border-slate-100 pb-2">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-indigo-600" />
                    <span>Inventario</span>
                  </h3>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="chk-inventario-negativo"
                    checked={formData.permitirInventarioNegativo}
                    onChange={(e) => handleChange('permitirInventarioNegativo', e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <label htmlFor="chk-inventario-negativo" className="ml-2 text-xs font-medium text-slate-700 cursor-pointer">
                    Permitir Inventario Negativo
                  </label>
                </div>

                {formData.permitirInventarioNegativo && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-800 p-2.5 rounded text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      Advertencia: Esto puede causar descuadres en las imputaciones del mayor general por descalce de existencias.
                    </span>
                  </div>
                )}
              </div>

              {/* SECTION: PRODUCTOS POR DEFECTO */}
              <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs space-y-3">
                <div className="border-b border-slate-100 pb-2">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                    Productos por Defecto
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Cuentas de Inventario
                    </label>
                    <select
                      value={formData.cuentaInventarioDefecto}
                      onChange={(e) => handleChange('cuentaInventarioDefecto', e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {STANDARD_ACCOUNT_PLAN.filter(a => a.tipo === 'ACTIVO').map((acc) => (
                        <option key={acc.codigo} value={acc.codigo}>
                          {acc.codigo} - {acc.nombre}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Cuenta de Costo de Venta
                    </label>
                    <select
                      value={formData.cuentaCostoVentaDefecto}
                      onChange={(e) => handleChange('cuentaCostoVentaDefecto', e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {STANDARD_ACCOUNT_PLAN.filter(a => a.tipo === 'COSTO').map((acc) => (
                        <option key={acc.codigo} value={acc.codigo}>
                          {acc.codigo} - {acc.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Cuenta Ajustes de Inventario
                    </label>
                    <select
                      value={formData.cuentaAjustesInventarioDefecto}
                      onChange={(e) => handleChange('cuentaAjustesInventarioDefecto', e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {STANDARD_ACCOUNT_PLAN.map((acc) => (
                        <option key={acc.codigo} value={acc.codigo}>
                          {acc.codigo} - {acc.nombre}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Cuenta Costos Ensamble Artículos
                    </label>
                    <select
                      value={formData.cuentaCostosEnsambleArticulosDefecto}
                      onChange={(e) => handleChange('cuentaCostosEnsambleArticulosDefecto', e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {STANDARD_ACCOUNT_PLAN.map((acc) => (
                        <option key={acc.codigo} value={acc.codigo}>
                          {acc.codigo} - {acc.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* SECTION: FABRICACIÓN POR DEFECTO */}
              <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs space-y-3">
                <div className="border-b border-slate-100 pb-2">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                    Fabricación por Defecto
                  </h3>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Orden de Trabajo Requerida Después de
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={formData.ordenTrabajoRequeridaDespuesDias}
                      onChange={(e) => handleChange('ordenTrabajoRequeridaDespuesDias', Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono font-bold focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <span className="absolute right-2.5 top-2 text-[10px] text-slate-400 font-bold">DÍAS</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer banner matching Page 10 bottom */}
          <div className="bg-[#0f172a] text-slate-400 p-3 rounded-lg flex items-center justify-between text-[11px] font-mono shrink-0">
            <div className="flex items-center gap-2 text-slate-300">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>AUDIT LOG: IFRS COMPLIANCE ENGINE ACTIVE</span>
            </div>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={handleResetToDefaults}
                className="hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Restaurar Valores por Defecto</span>
              </button>
              <span className="text-blue-400 font-bold">VERSION 1.1.0-CL</span>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
