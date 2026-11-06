import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  FileCode, 
  Copy, 
  Check, 
  Info,
  X
} from 'lucide-react';
import { F29Declaration, DteDocument, EmployeePayroll, AccountingEntry, CompanyProfile } from '../types';
import { 
  formatCLP, 
  formatNumberCL, 
  formatNormalizedAccountingEntry,
  createF29PaymentEntry
} from '../utils/chileanAccounting';

interface F29SimulatorProps {
  f29: F29Declaration;
  onUpdateF29: (f29: F29Declaration) => void;
  dtes: DteDocument[];
  payrolls: EmployeePayroll[];
  company: CompanyProfile;
  onAddEntry: (entry: AccountingEntry) => void;
}

export const F29Simulator: React.FC<F29SimulatorProps> = ({
  f29,
  onUpdateF29,
  dtes = [],
  payrolls = [],
  company,
  onAddEntry,
}) => {
  const safeDtes = Array.isArray(dtes) ? dtes : [];
  const safePayrolls = Array.isArray(payrolls) ? payrolls : [];
  const [copied, setCopied] = useState(false);
  const [viewEntryModal, setViewEntryModal] = useState<AccountingEntry | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // RCV Calculations for reconciliation
  const rcvVentasNeto = safeDtes
    .filter(d => d.tipoOperacion === 'VENTA' && d.tipoDte !== '34')
    .reduce((s, d) => s + (d.tipoDte === '61' ? -d.montoNeto : d.montoNeto), 0);
  
  const rcvDebitoFiscal = safeDtes
    .filter(d => d.tipoOperacion === 'VENTA')
    .reduce((s, d) => s + (d.tipoDte === '61' ? -d.montoIva : d.montoIva), 0);

  const rcvVentasExentas = safeDtes
    .filter(d => d.tipoOperacion === 'VENTA' && d.tipoDte === '34')
    .reduce((s, d) => s + (d.montoExento || 0), 0);

  const rcvComprasNeto = safeDtes
    .filter(d => d.tipoOperacion === 'COMPRA')
    .reduce((s, d) => s + (d.montoNeto || 0), 0);

  const rcvCreditoFiscal = safeDtes
    .filter(d => d.tipoOperacion === 'COMPRA')
    .reduce((s, d) => s + (d.montoIva || 0), 0);

  const rcvHonorariosRetencion = safeDtes
    .filter(d => d.tipoOperacion === 'HONORARIOS')
    .reduce((s, d) => s + (d.retencionMonto || Math.round((d.montoTotal || 0) * (d.retencionTasa || 0.145))), 0);

  const payrollImpuestoUnico = safePayrolls.reduce((s, p) => s + (p.impuestoUnicoMonto || 0), 0);

  // Inconsistency checks
  const diffDebito = Math.abs(f29.debitoFiscalIva - rcvDebitoFiscal);
  const diffCredito = Math.abs(f29.creditoFiscalIva - rcvCreditoFiscal);
  const diffHonorarios = Math.abs(f29.retencionHonorariosSegundaCat - rcvHonorariosRetencion);
  const diffImpuestoUnico = Math.abs(f29.retencionImpuestoUnicoSueldos - payrollImpuestoUnico);

  const hasInconsistencies = diffDebito > 10 || diffCredito > 10 || diffHonorarios > 10 || diffImpuestoUnico > 10;

  // Recalculate F29 totals
  const handleFieldChange = (field: keyof F29Declaration, value: number) => {
    const updated = { ...f29, [field]: value };

    // Recompute IVA balance
    const totalCreditoConRemanente = updated.creditoFiscalIva + updated.comprasActivoFijoIva + updated.remanenteMesAnterior;
    if (updated.debitoFiscalIva > totalCreditoConRemanente) {
      updated.impuestoDeterminadoIva = updated.debitoFiscalIva - totalCreditoConRemanente;
      updated.nuevoRemanenteCredito = 0;
    } else {
      updated.impuestoDeterminadoIva = 0;
      updated.nuevoRemanenteCredito = totalCreditoConRemanente - updated.debitoFiscalIva;
    }

    // Recompute PPM
    updated.montoPpm = Math.round(updated.baseImponiblePpm * updated.tasaPpm);

    // Recompute Total a Pagar
    updated.totalAPagar = 
      updated.impuestoDeterminadoIva + 
      updated.montoPpm + 
      updated.retencionHonorariosSegundaCat + 
      updated.retencionImpuestoUnicoSueldos + 
      updated.otrasRetenciones;

    onUpdateF29(updated);
  };

  // Sync with RCV & Payroll
  const handleSyncWithRcv = () => {
    // 4.4: sin espera artificial y sin tasa PPM supuesta (antes 1 % por defecto)
    const tasaPpmEmpresa = f29.tasaPpm || company.tasaPpm;
    if (!tasaPpmEmpresa) {
      alert('Configure la tasa PPM de la empresa antes de sincronizar el F29.');
      return;
    }
    setIsSyncing(true);
    {
      const baseVentasPpm = rcvVentasNeto;
      const montoPpm = Math.round(baseVentasPpm * tasaPpmEmpresa);
      const totalCred = rcvCreditoFiscal + f29.remanenteMesAnterior;

      let impDet = 0;
      let nuevoRem = 0;
      if (rcvDebitoFiscal > totalCred) {
        impDet = rcvDebitoFiscal - totalCred;
      } else {
        nuevoRem = totalCred - rcvDebitoFiscal;
      }

      const totalAPagar = impDet + montoPpm + rcvHonorariosRetencion + payrollImpuestoUnico;

      const synced: F29Declaration = {
        ...f29,
        ventasAfectasNeto: rcvVentasNeto,
        debitoFiscalIva: rcvDebitoFiscal,
        ventasExentasTotal: rcvVentasExentas,
        comprasNetoAfecto: rcvComprasNeto,
        creditoFiscalIva: rcvCreditoFiscal,
        impuestoDeterminadoIva: impDet,
        nuevoRemanenteCredito: nuevoRem,
        baseImponiblePpm: baseVentasPpm,
        montoPpm,
        retencionHonorariosSegundaCat: rcvHonorariosRetencion,
        retencionImpuestoUnicoSueldos: payrollImpuestoUnico,
        totalAPagar,
        inconsistenciasDetectadas: [],
      };

      onUpdateF29(synced);
      setIsSyncing(false);
    }
  };

  const handleGeneratePaymentEntry = () => {
    const entry = createF29PaymentEntry(f29);
    onAddEntry(entry);
    setViewEntryModal(entry);
  };

  const copyNormalizedText = (entry: AccountingEntry) => {
    const text = formatNormalizedAccountingEntry(entry);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header & Status Banner */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-md bg-blue-50 text-[#2563eb] border border-blue-200">
              <FileSpreadsheet className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-[#0f172a] flex items-center gap-2">
                <span>Formulario 29 (F29) - Declaración y Pago Mensual</span>
                <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                  Periodo: {f29.periodo}
                </span>
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Liquidación oficial de Débitos, Créditos de IVA, PPM y Retenciones de 2da Categoría para el SII y TGR.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleSyncWithRcv}
            disabled={isSyncing}
            className="flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer shadow-xs disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#2563eb] ${isSyncing ? 'animate-spin' : ''}`} />
            <span>Conciliar con RCV & Nómina</span>
          </button>

          <button
            onClick={handleGeneratePaymentEntry}
            className="flex items-center gap-1.5 bg-[#2563eb] hover:bg-blue-600 text-white px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors shadow-xs cursor-pointer"
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>Generar Asiento F29 Normalizado</span>
          </button>
        </div>
      </div>

      {/* Inconsistency Warning Alert */}
      {hasInconsistencies && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 text-xs text-amber-900 flex items-start gap-3 shadow-xs">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold text-amber-900">
              ¡Alerta de Discrepancias entre RCV y Formulario 29!
            </div>
            <p className="text-amber-800">
              Se detectaron diferencias entre los libros electrónicos del SII y la declaración F29:
            </p>
            <ul className="list-disc pl-5 space-y-0.5 text-amber-800 font-mono text-[11px]">
              {diffDebito > 10 && (
                <li>IVA Débito: RCV registra {formatCLP(rcvDebitoFiscal)} vs F29 {formatCLP(f29.debitoFiscalIva)} (Dif: {formatCLP(diffDebito)})</li>
              )}
              {diffCredito > 10 && (
                <li>IVA Crédito: RCV registra {formatCLP(rcvCreditoFiscal)} vs F29 {formatCLP(f29.creditoFiscalIva)} (Dif: {formatCLP(diffCredito)})</li>
              )}
              {diffHonorarios > 10 && (
                <li>Retención Honorarios: BHE registra {formatCLP(rcvHonorariosRetencion)} vs F29 {formatCLP(f29.retencionHonorariosSegundaCat)}</li>
              )}
              {diffImpuestoUnico > 10 && (
                <li>Impuesto Único Sueldos: Nómina registra {formatCLP(payrollImpuestoUnico)} vs F29 {formatCLP(f29.retencionImpuestoUnicoSueldos)}</li>
              )}
            </ul>
            <button
              onClick={handleSyncWithRcv}
              className="mt-2 inline-flex items-center gap-1 text-[#2563eb] hover:underline font-bold cursor-pointer"
            >
              Haga clic aquí para auto-sincronizar y corregir discrepancias automáticamente.
            </button>
          </div>
        </div>
      )}

      {/* Main F29 Form Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Official F29 Sections */}
        <div className="lg:col-span-2 space-y-5">
          {/* Section 1: Débito Fiscal IVA (Ventas) */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
            <div className="px-5 py-3 bg-[#f1f5f9] border-b border-slate-200 flex items-center justify-between">
              <span className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                1. Débito Fiscal IVA (Ventas y Servicios Emitidos)
              </span>
              <span className="text-[11px] font-mono text-emerald-700 font-bold">
                Línea 503 / Cód. 538
              </span>
            </div>

            <div className="p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Ventas Netas Afectas a IVA (Cód. 503):
                  </label>
                  <input
                    type="number"
                    value={f29.ventasAfectasNeto}
                    onChange={(e) => handleFieldChange('ventasAfectasNeto', Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-md p-2 font-mono text-slate-900 font-bold focus:outline-none focus:border-[#2563eb] focus:bg-white"
                  />
                  <span className="text-[10px] text-slate-500 font-mono">RCV: {formatCLP(rcvVentasNeto)}</span>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    IVA Débito Fiscal Determinado (19%) (Cód. 538):
                  </label>
                  <input
                    type="number"
                    value={f29.debitoFiscalIva}
                    onChange={(e) => handleFieldChange('debitoFiscalIva', Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-md p-2 font-mono text-emerald-700 font-black focus:outline-none focus:border-[#2563eb] focus:bg-white"
                  />
                  <span className="text-[10px] text-slate-500 font-mono">RCV: {formatCLP(rcvDebitoFiscal)}</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Ventas y Servicios Exentos o No Gravados (Cód. 514):
                </label>
                <input
                  type="number"
                  value={f29.ventasExentasTotal}
                  onChange={(e) => handleFieldChange('ventasExentasTotal', Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-md p-2 font-mono text-slate-900 focus:outline-none focus:border-[#2563eb] focus:bg-white"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Crédito Fiscal IVA (Compras) */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
            <div className="px-5 py-3 bg-[#f1f5f9] border-b border-slate-200 flex items-center justify-between">
              <span className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                2. Crédito Fiscal IVA (Compras y Servicios Recibidos)
              </span>
              <span className="text-[11px] font-mono text-blue-700 font-bold">
                Línea 519 / Cód. 520
              </span>
            </div>

            <div className="p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Compras Netas con Derecho a Crédito (Cód. 519):
                  </label>
                  <input
                    type="number"
                    value={f29.comprasNetoAfecto}
                    onChange={(e) => handleFieldChange('comprasNetoAfecto', Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-md p-2 font-mono text-slate-900 font-bold focus:outline-none focus:border-[#2563eb] focus:bg-white"
                  />
                  <span className="text-[10px] text-slate-500 font-mono">RCV: {formatCLP(rcvComprasNeto)}</span>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    IVA Crédito Fiscal (19%) (Cód. 520):
                  </label>
                  <input
                    type="number"
                    value={f29.creditoFiscalIva}
                    onChange={(e) => handleFieldChange('creditoFiscalIva', Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-md p-2 font-mono text-blue-700 font-black focus:outline-none focus:border-[#2563eb] focus:bg-white"
                  />
                  <span className="text-[10px] text-slate-500 font-mono">RCV: {formatCLP(rcvCreditoFiscal)}</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Remanente de Crédito Fiscal Mes Anterior (Cód. 504 / 563):
                </label>
                <input
                  type="number"
                  value={f29.remanenteMesAnterior}
                  onChange={(e) => handleFieldChange('remanenteMesAnterior', Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-md p-2 font-mono text-slate-900 focus:outline-none focus:border-[#2563eb] focus:bg-white"
                />
              </div>
            </div>
          </div>

          {/* Section 3: PPM y Retenciones */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
            <div className="px-5 py-3 bg-[#f1f5f9] border-b border-slate-200 flex items-center justify-between">
              <span className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                3. Pagos Provisorios Mensuales (PPM) & Retenciones
              </span>
              <span className="text-[11px] font-mono text-purple-700 font-bold">
                Art. 84 LIR / Retenciones
              </span>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Base Imponible PPM:</label>
                  <input
                    type="number"
                    value={f29.baseImponiblePpm}
                    onChange={(e) => handleFieldChange('baseImponiblePpm', Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-md p-1.5 font-mono text-slate-900 focus:outline-none focus:border-[#2563eb]"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Tasa PPM (%):</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={f29.tasaPpm}
                    onChange={(e) => handleFieldChange('tasaPpm', Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-md p-1.5 font-mono text-slate-900 focus:outline-none focus:border-[#2563eb]"
                  />
                  <span className="text-[10px] text-slate-500 font-mono">{(f29.tasaPpm * 100).toFixed(2)}%</span>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Monto PPM (Cód. 62):</label>
                  <input
                    type="number"
                    readOnly
                    value={f29.montoPpm}
                    className="w-full bg-slate-100 border border-slate-200 rounded-md p-1.5 font-mono text-purple-700 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Retención Boletas de Honorarios 2da Cat (Línea 151 / 152):
                  </label>
                  <input
                    type="number"
                    value={f29.retencionHonorariosSegundaCat}
                    onChange={(e) => handleFieldChange('retencionHonorariosSegundaCat', Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-md p-2 font-mono text-purple-700 font-bold focus:outline-none focus:border-[#2563eb]"
                  />
                  <span className="text-[10px] text-slate-500 font-mono">BHE Registrado: {formatCLP(rcvHonorariosRetencion)}</span>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Retención Impuesto Único Sueldos (Cód. 48):
                  </label>
                  <input
                    type="number"
                    value={f29.retencionImpuestoUnicoSueldos}
                    onChange={(e) => handleFieldChange('retencionImpuestoUnicoSueldos', Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-md p-2 font-mono text-indigo-700 font-bold focus:outline-none focus:border-[#2563eb]"
                  />
                  <span className="text-[10px] text-slate-500 font-mono">Nómina Registrada: {formatCLP(payrollImpuestoUnico)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right 1 Column: Summary & Total to Pay Card */}
        <div className="space-y-5">
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)] space-y-4">
            <h3 className="font-bold text-slate-900 text-sm border-b border-slate-200 pb-3 flex items-center justify-between">
              <span>Liquidación Tributaria F29</span>
              <span className="text-xs text-slate-500 font-mono">{f29.periodo}</span>
            </h3>

            {/* IVA Liquidado */}
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span>(+) IVA Débito Fiscal:</span>
                <span className="font-mono text-emerald-700 font-bold">{formatCLP(f29.debitoFiscalIva)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>(-) IVA Crédito Fiscal:</span>
                <span className="font-mono text-blue-700 font-bold">-{formatCLP(f29.creditoFiscalIva)}</span>
              </div>
              {f29.remanenteMesAnterior > 0 && (
                <div className="flex items-center justify-between text-slate-600">
                  <span>(-) Remanente Anterior:</span>
                  <span className="font-mono text-blue-600 font-medium">-{formatCLP(f29.remanenteMesAnterior)}</span>
                </div>
              )}
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between font-bold">
                <span className="text-slate-800">Impuesto Determinado IVA:</span>
                <span className="font-mono text-amber-700">{formatCLP(f29.impuestoDeterminadoIva)}</span>
              </div>
              {f29.nuevoRemanenteCredito > 0 && (
                <div className="flex items-center justify-between text-emerald-700 font-bold">
                  <span>Nuevo Remanente a Favor:</span>
                  <span className="font-mono">{formatCLP(f29.nuevoRemanenteCredito)}</span>
                </div>
              )}
            </div>

            {/* Otros Conceptos */}
            <div className="space-y-2 text-xs pt-3 border-t border-slate-200">
              <div className="flex items-center justify-between text-slate-600">
                <span>(+) PPM ({(f29.tasaPpm * 100).toFixed(2)}%):</span>
                <span className="font-mono text-purple-700 font-bold">{formatCLP(f29.montoPpm)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>(+) Retención Boletas Honorarios:</span>
                <span className="font-mono text-purple-700 font-bold">{formatCLP(f29.retencionHonorariosSegundaCat)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>(+) Retención Impuesto Único:</span>
                <span className="font-mono text-purple-700 font-bold">{formatCLP(f29.retencionImpuestoUnicoSueldos)}</span>
              </div>
            </div>

            {/* Total a Pagar en Tesorería */}
            <div className="bg-[#eff6ff] p-4 rounded-lg border border-[#2563eb]/30 text-center space-y-1">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                Total a Enterar en TGR (Cód. 91)
              </span>
              <div className="text-2xl font-black text-[#2563eb] font-mono">
                {formatCLP(f29.totalAPagar)}
              </div>
              <div className="text-[10px] text-slate-500 font-mono pt-1">
                Vence: {f29.fechaVencimiento} (Folio: {f29.folioTgr || '298104819'})
              </div>
            </div>

            <button
              onClick={handleGeneratePaymentEntry}
              className="w-full py-2.5 bg-[#2563eb] hover:bg-blue-600 text-white rounded-md text-xs font-semibold transition-all shadow-xs cursor-pointer flex items-center justify-center gap-2"
            >
              <FileCode className="w-4 h-4" />
              <span>Ver Asiento Contable F29</span>
            </button>
          </div>

          {/* Legal Reference Note */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 text-xs text-slate-600 space-y-2 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
            <div className="flex items-center gap-1.5 text-slate-800 font-bold">
              <Info className="w-4 h-4 text-[#2563eb]" />
              <span>Fundamento Tributario Legal</span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-500">
              • <strong>IVA (DL 825):</strong> Tasa general del 19%. Art. 23 establece los requisitos del derecho al Crédito Fiscal.
              <br />• <strong>PPM (Art. 84 LIR):</strong> Pago provisional mensual sobre los ingresos brutos del mes para cubrir el Impuesto de Primera Categoría anual.
              <br />• <strong>Retención 2da Categoría:</strong> Tasa progresiva obligatoria a enterar en F29 antes del día 20 de cada mes (con DTE).
            </p>
          </div>
        </div>
      </div>

      {/* MODAL: Visor Asiento F29 Normalizado */}
      {viewEntryModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="px-6 py-4 bg-[#0f172a] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-white text-sm sm:text-base">
                  Asiento Contable F29 Normalizado (Cierre y Pago TGR)
                </h3>
              </div>
              <button
                onClick={() => setViewEntryModal(null)}
                className="text-slate-300 hover:text-white text-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-[#1e293b] p-4 rounded-md border-l-4 border-[#2563eb] overflow-x-auto">
                <pre className="font-mono text-xs text-[#cbd5e1] leading-relaxed">
                  {formatNormalizedAccountingEntry(viewEntryModal)}
                </pre>
              </div>

              <div className="flex items-center justify-between text-xs pt-2">
                <span className="text-emerald-700 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Asiento Balanceado (Debe = Haber)
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyNormalizedText(viewEntryModal)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#2563eb] hover:bg-blue-600 text-white rounded-md font-semibold transition-colors cursor-pointer shadow-xs"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copied ? '¡Copiado al Portapapeles!' : 'Copiar Formato Normalizado'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
