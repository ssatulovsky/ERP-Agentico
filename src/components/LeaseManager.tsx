import React, { useState } from 'react';
import { 
  Home, 
  Plus, 
  FileCode, 
  CheckCircle2, 
  Copy, 
  Check, 
  Layers, 
  X,
  TrendingDown,
  Download,
  FileSpreadsheet
} from 'lucide-react';
import { LeaseContract, ChileIndicators, AccountingEntry } from '../types';
import { 
  formatCLP, 
  formatNormalizedAccountingEntry,
  createLeaseIfrs16Entry,
  createSimpleLeaseExpenseEntry,
  createLeaseInitialRecognitionEntry
} from '../utils/chileanAccounting';
import { downloadLeasesPdf, downloadLeasesExcel } from '../utils/reportGenerators';

interface LeaseManagerProps {
  leases: LeaseContract[];
  onAddLease: (lease: LeaseContract) => void;
  indicators: ChileIndicators;
  onAddEntry: (entry: AccountingEntry) => void;
}

export const LeaseManager: React.FC<LeaseManagerProps> = ({
  leases,
  onAddLease,
  indicators,
  onAddEntry,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [viewEntryModal, setViewEntryModal] = useState<AccountingEntry | null>(null);
  const [copied, setCopied] = useState(false);

  // Form state
  const [newLease, setNewLease] = useState<Partial<LeaseContract>>({
    inmuebleDescripcion: 'Oficina Central y Laboratorio de Desarrollo',
    arrendadorNombre: 'Inmobiliaria y Rentas Financieras S.A.',
    arrendadorRut: '76.889.900-4',
    montoMensualMoneda: 'UF',
    montoMensualValor: 45,
    montoMensualClp: 45 * indicators.uf,
    plazoMeses: 36,
    fechaInicio: '2024-01-01',
    fechaTermino: '2026-12-31',
    tasaDescuentoAnual: 0.055,
    esIfrs16: true,
    activoDerechoUso: 45 * indicators.uf * 32,
    pasivoArrendamiento: 45 * indicators.uf * 32,
    amortizacionMensual: Math.round((45 * indicators.uf * 32) / 36),
    interesMensual: Math.round((45 * indicators.uf * 32) * (0.055 / 12)),
    reajusteTipo: 'UF',
    afectoIva: false,
  });

  const totalCanonMensualClp = leases.reduce((s, l) => s + (l.montoMensualMoneda === 'UF' ? l.montoMensualValor * indicators.uf : l.montoMensualValor), 0);
  const totalActivoRou = leases.filter(l => l.esIfrs16).reduce((s, l) => s + (l.activoDerechoUso || 0), 0);
  const totalPasivoArrendamiento = leases.filter(l => l.esIfrs16).reduce((s, l) => s + (l.pasivoArrendamiento || 0), 0);

  const handleCreateLease = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLease.inmuebleDescripcion || !newLease.arrendadorRut) return;

    const valorClp = newLease.montoMensualMoneda === 'UF'
      ? Number(newLease.montoMensualValor) * indicators.uf
      : Number(newLease.montoMensualValor);

    const plazo = Number(newLease.plazoMeses || 12);
    const tasa = Number(newLease.tasaDescuentoAnual || 0.05);

    // PV Calculation approximation for IFRS 16
    const pvFactor = (1 - Math.pow(1 + tasa / 12, -plazo)) / (tasa / 12);
    const vp = Math.round(valorClp * pvFactor);
    const amort = Math.round(vp / plazo);
    const interes = Math.round(vp * (tasa / 12));

    const created: LeaseContract = {
      id: `lease-${Date.now()}`,
      inmuebleDescripcion: newLease.inmuebleDescripcion!,
      arrendadorNombre: newLease.arrendadorNombre!,
      arrendadorRut: newLease.arrendadorRut!,
      montoMensualMoneda: newLease.montoMensualMoneda as any,
      montoMensualValor: Number(newLease.montoMensualValor),
      montoMensualClp: valorClp,
      plazoMeses: plazo,
      fechaInicio: newLease.fechaInicio || '2024-01-01',
      fechaTermino: newLease.fechaTermino || '2026-12-31',
      tasaDescuentoAnual: tasa,
      esIfrs16: Boolean(newLease.esIfrs16),
      activoDerechoUso: vp,
      pasivoArrendamiento: vp,
      amortizacionMensual: amort,
      interesMensual: interes,
      reajusteTipo: newLease.reajusteTipo as any,
      afectoIva: Boolean(newLease.afectoIva),
    };

    onAddLease(created);
    setShowAddModal(false);
  };

  const handleGenerateIfrs16Entry = (lease: LeaseContract) => {
    const entry = createLeaseIfrs16Entry(lease);
    onAddEntry(entry);
    setViewEntryModal(entry);
  };

  const handleGenerateSimpleEntry = (lease: LeaseContract) => {
    const entry = createSimpleLeaseExpenseEntry(lease);
    onAddEntry(entry);
    setViewEntryModal(entry);
  };

  const handleGenerateInitialEntry = (lease: LeaseContract) => {
    const entry = createLeaseInitialRecognitionEntry(lease, indicators);
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
      {/* Top 3 Geometric Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Canon Mensual Total */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Canon Mensual Arriendos</span>
            <div className="p-1.5 rounded-md bg-emerald-50 text-emerald-600 border border-emerald-200">
              <Home className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-[#0f172a]">{formatCLP(totalCanonMensualClp)}</div>
          <div className="mt-1 text-xs text-slate-500">
            {leases.length} contratos activos (Oficinas, Bodegas y Equipos)
          </div>
        </div>

        {/* Activo por Derecho de Uso (ROU) */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Activo ROU (IFRS 16)</span>
            <div className="p-1.5 rounded-md bg-blue-50 text-blue-600 border border-blue-200">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-[#2563eb]">{formatCLP(totalActivoRou)}</div>
          <div className="mt-1 text-xs text-slate-500">
            Valor Presente descontado a tasa incremental
          </div>
        </div>

        {/* Pasivo por Arrendamiento */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Pasivo Arrendamiento</span>
            <div className="p-1.5 rounded-md bg-purple-50 text-purple-600 border border-purple-200">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-purple-700">{formatCLP(totalPasivoArrendamiento)}</div>
          <div className="mt-1 text-xs text-slate-500">
            Obligación financiera a corto y largo plazo
          </div>
        </div>
      </div>

      {/* Control Bar: Add Contract */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-extrabold text-[#0f172a] text-sm sm:text-base flex items-center gap-2">
            <Home className="w-5 h-5 text-[#2563eb]" />
            <span>Contratos de Arrendamiento & Tratamiento IFRS 16</span>
          </h3>
          <p className="text-xs text-slate-500 font-medium">
            Modelación de cánones en UF o CLP, control de IPC, registro de pasivo financiero y amortización de activo ROU.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => downloadLeasesPdf(leases, undefined, indicators)}
            className="flex items-center gap-1.5 bg-rose-700 hover:bg-rose-800 text-white px-3 py-1.5 rounded-md text-xs font-semibold transition-colors shadow-xs cursor-pointer"
            title="Descargar Cartera de Contratos y Activos ROU (IFRS 16) en PDF"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Informe IFRS 16 (PDF)</span>
          </button>

          <button
            onClick={() => downloadLeasesExcel(leases, undefined, indicators)}
            className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1.5 rounded-md text-xs font-semibold transition-colors shadow-xs cursor-pointer"
            title="Descargar Contratos de Arrendamiento en formato Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Excel</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 bg-[#2563eb] hover:bg-blue-600 text-white px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Registrar Contrato de Arriendo</span>
          </button>
        </div>
      </div>

      {/* Leases List Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-[#f1f5f9] text-slate-600 font-semibold border-b border-slate-200 text-[11px]">
              <tr>
                <th className="px-4 py-3">Inmueble / Bien</th>
                <th className="px-4 py-3">Arrendador (RUT & Razón Social)</th>
                <th className="px-4 py-3">Canon Mensual</th>
                <th className="px-4 py-3">Vigencia & Plazo</th>
                <th className="px-4 py-3">Tratamiento Contable</th>
                <th className="px-4 py-3 text-right">Activo ROU / Pasivo</th>
                <th className="px-4 py-3 text-right">Generar Asientos Normalizados</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {leases.map((lease) => {
                const canonClp = lease.montoMensualMoneda === 'UF' 
                  ? lease.montoMensualValor * indicators.uf 
                  : lease.montoMensualValor;

                return (
                  <tr key={lease.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Inmueble */}
                    <td className="px-4 py-3 font-sans">
                      <div className="font-bold text-slate-900">{lease.inmuebleDescripcion}</div>
                      <span className="text-[10px] text-slate-500 font-medium">
                        {lease.afectoIva ? 'Afecto a IVA 19%' : 'Exento / Sin IVA'}
                      </span>
                    </td>

                    {/* Arrendador */}
                    <td className="px-4 py-3 font-sans">
                      <div className="text-slate-800 font-semibold">{lease.arrendadorNombre}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{lease.arrendadorRut}</div>
                    </td>

                    {/* Canon Mensual */}
                    <td className="px-4 py-3 font-mono">
                      <div className="font-black text-[#0f172a]">
                        {lease.montoMensualMoneda === 'UF' ? `${lease.montoMensualValor} UF` : formatCLP(lease.montoMensualValor)}
                      </div>
                      {lease.montoMensualMoneda === 'UF' && (
                        <div className="text-[10px] text-slate-500">
                          Equiv: {formatCLP(canonClp)}
                        </div>
                      )}
                    </td>

                    {/* Vigencia */}
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-600">
                      <div>{lease.fechaInicio} al {lease.fechaTermino}</div>
                      <span className="text-slate-500 font-medium">{lease.plazoMeses} meses ({lease.reajusteTipo})</span>
                    </td>

                    {/* Tratamiento Contable */}
                    <td className="px-4 py-3 font-sans">
                      {lease.esIfrs16 ? (
                        <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                          <Layers className="w-3 h-3 text-[#2563eb]" />
                          <span>IFRS 16 (ROU)</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded text-[10px]">
                          <span>Gasto Simple</span>
                        </span>
                      )}
                    </td>

                    {/* Activo ROU */}
                    <td className="px-4 py-3 text-right font-mono">
                      {lease.esIfrs16 && lease.activoDerechoUso ? (
                        <div>
                          <div className="font-bold text-[#2563eb]">{formatCLP(lease.activoDerechoUso)}</div>
                          <div className="text-[10px] text-slate-500 font-medium">
                            Amort: {formatCLP(lease.amortizacionMensual || 0)}/mes
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400 font-sans text-xs">N/A</span>
                      )}
                    </td>

                    {/* Botones de Asiento */}
                    <td className="px-4 py-3 text-right font-sans">
                      <div className="flex items-center justify-end gap-1.5">
                        {lease.esIfrs16 && (
                          <>
                            <button
                              onClick={() => handleGenerateInitialEntry(lease)}
                              className="inline-flex items-center gap-1 bg-white hover:bg-slate-50 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer shadow-xs"
                              title="Generar Asiento Inicial IFRS 16: Reconocimiento de Activo por Derecho de Uso (ADU) vs Pasivo Financiero"
                            >
                              <FileCode className="w-3 h-3 text-indigo-600" />
                              <span>Alta ADU</span>
                            </button>
                            <button
                              onClick={() => handleGenerateIfrs16Entry(lease)}
                              className="inline-flex items-center gap-1 bg-white hover:bg-slate-50 text-[#2563eb] border border-blue-200 px-2.5 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer shadow-xs"
                              title="Generar Asiento Mensual IFRS 16 (Amortización + Interés con cargo a Banco)"
                            >
                              <FileCode className="w-3 h-3 text-[#2563eb]" />
                              <span>Cuota IFRS 16</span>
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleGenerateSimpleEntry(lease)}
                          className="inline-flex items-center gap-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-2.5 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer shadow-xs"
                          title="Generar Asiento Devengo / Pago Simple de Gasto de Arriendo con cargo a Banco"
                        >
                          <FileCode className="w-3 h-3 text-emerald-600" />
                          <span>Asiento Gasto</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: Registro de Contrato */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg w-full max-w-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="px-6 py-4 bg-[#0f172a] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Home className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-white text-sm sm:text-base">
                  Registrar Contrato de Arrendamiento
                </h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-300 hover:text-white text-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateLease} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Descripción del Inmueble / Bien:</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Oficina 402, Av. Providencia 1200"
                  value={newLease.inmuebleDescripcion}
                  onChange={(e) => setNewLease(prev => ({ ...prev, inmuebleDescripcion: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-md p-2 text-slate-900 focus:outline-none focus:border-[#2563eb]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">RUT Arrendador:</label>
                  <input
                    type="text"
                    required
                    placeholder="76.123.456-7"
                    value={newLease.arrendadorRut}
                    onChange={(e) => setNewLease(prev => ({ ...prev, arrendadorRut: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-md p-2 font-mono text-slate-900 focus:outline-none focus:border-[#2563eb]"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Razón Social Arrendador:</label>
                  <input
                    type="text"
                    required
                    placeholder="Inmobiliaria Central SpA"
                    value={newLease.arrendadorNombre}
                    onChange={(e) => setNewLease(prev => ({ ...prev, arrendadorNombre: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-md p-2 text-slate-900 focus:outline-none focus:border-[#2563eb]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Moneda:</label>
                  <select
                    value={newLease.montoMensualMoneda}
                    onChange={(e) => setNewLease(prev => ({ ...prev, montoMensualMoneda: e.target.value as any }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-md p-2 text-slate-900 focus:outline-none focus:border-[#2563eb]"
                  >
                    <option value="UF">UF (Unidad de Fomento)</option>
                    <option value="CLP">CLP ($ Pesos Chilenos)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Monto Mensual:</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newLease.montoMensualValor}
                    onChange={(e) => setNewLease(prev => ({ ...prev, montoMensualValor: Number(e.target.value) }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-md p-2 font-mono text-slate-900 font-bold focus:outline-none focus:border-[#2563eb]"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Plazo (Meses):</label>
                  <input
                    type="number"
                    required
                    value={newLease.plazoMeses}
                    onChange={(e) => setNewLease(prev => ({ ...prev, plazoMeses: Number(e.target.value) }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-md p-2 font-mono text-slate-900 focus:outline-none focus:border-[#2563eb]"
                  />
                </div>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newLease.esIfrs16}
                    onChange={(e) => setNewLease(prev => ({ ...prev, esIfrs16: e.target.checked }))}
                    className="rounded text-[#2563eb]"
                  />
                  <span className="font-bold text-slate-800">
                    Aplicar IFRS 16 (Reconocimiento de Activo por Derecho de Uso y Pasivo Financiero)
                  </span>
                </label>

                {newLease.esIfrs16 && (
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="block text-slate-600 text-[10px] font-semibold mb-1">Tasa de Descuento Anual (%):</label>
                      <input
                        type="number"
                        step="0.001"
                        value={newLease.tasaDescuentoAnual}
                        onChange={(e) => setNewLease(prev => ({ ...prev, tasaDescuentoAnual: Number(e.target.value) }))}
                        className="w-full bg-white border border-slate-300 rounded-md p-1.5 font-mono text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 text-[10px] font-semibold mb-1">Tipo de Reajuste:</label>
                      <select
                        value={newLease.reajusteTipo}
                        onChange={(e) => setNewLease(prev => ({ ...prev, reajusteTipo: e.target.value as any }))}
                        className="w-full bg-white border border-slate-300 rounded-md p-1.5 text-slate-900"
                      >
                        <option value="UF">UF Diaria</option>
                        <option value="IPC_SEMESTRAL">IPC Semestral</option>
                        <option value="IPC_ANUAL">IPC Anual</option>
                        <option value="FIJO">Fijo sin reajuste</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-md font-medium cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#2563eb] hover:bg-blue-600 text-white rounded-md font-semibold shadow-xs cursor-pointer"
                >
                  Registrar Contrato
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Visor de Asiento Normalizado */}
      {viewEntryModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="px-6 py-4 bg-[#0f172a] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-white text-sm sm:text-base">
                  Asiento Contable Normalizado (Arriendos & IFRS 16)
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
