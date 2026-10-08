import React, { useState, useMemo } from 'react';
import {
  X,
  Coins,
  TrendingUp,
  History,
  Plus,
  Trash2,
  Calendar,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  RefreshCw,
  Building2,
} from 'lucide-react';
import {
  CurrencyDefinition,
  ExchangeRateRecord,
  AccountingEntry,
  HierarchicalAccountItem,
} from '../../types';
import {
  getAvailableCurrencies,
  saveCurrencies,
  addOrUpdateCurrency,
  toggleCurrencyStatus,
  getExchangeRateHistory,
  saveExchangeRateRecord,
  deleteExchangeRateRecord,
  getExchangeRateForDate,
  formatCurrencyAmount,
  calculateExchangeDifferenceForAccounts,
  generateExchangeDifferenceAdjustmentEntry,
} from '../../services/currencyService';

interface CurrencyManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  empresaRut?: string;
  entries: AccountingEntry[];
  accounts: HierarchicalAccountItem[];
  onApplyAdjustmentEntry: (entry: AccountingEntry) => Promise<void> | void;
}

export const CurrencyManagerModal: React.FC<CurrencyManagerModalProps> = ({
  isOpen,
  onClose,
  empresaRut,
  entries,
  accounts,
  onApplyAdjustmentEntry,
}) => {
  const [activeTab, setActiveTab] = useState<'CATALOG' | 'HISTORY' | 'NIC21'>('CATALOG');

  // Currencies state
  const [currencies, setCurrencies] = useState<CurrencyDefinition[]>(() =>
    getAvailableCurrencies(empresaRut)
  );

  // Exchange rates history state
  const [historyFilterMoneda, setHistoryFilterMoneda] = useState<string>('ALL');
  const [historySearchDate, setHistorySearchDate] = useState<string>('');
  const [exchangeHistory, setExchangeHistory] = useState<ExchangeRateRecord[]>(() =>
    getExchangeRateHistory(undefined, empresaRut)
  );

  // Form for New Currency
  const [showNewCurrencyForm, setShowNewCurrencyForm] = useState(false);
  const [newCurrCode, setNewCurrCode] = useState('');
  const [newCurrName, setNewCurrName] = useState('');
  const [newCurrSymbol, setNewCurrSymbol] = useState('');
  const [newCurrDecimals, setNewCurrDecimals] = useState<number>(2);
  const [newCurrRate, setNewCurrRate] = useState<number>(950);
  const [newCurrDesc, setNewCurrDesc] = useState('');

  // Form for New Historical Rate
  const [rateDate, setRateDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [rateCurrency, setRateCurrency] = useState<string>('USD');
  const [rateValue, setRateValue] = useState<number>(955.20);
  const [rateSource, setRateSource] = useState<string>('Banco Central de Chile');
  const [rateObs, setRateObs] = useState<string>('');

  // NIC 21 Evaluation State
  const [closingDate, setClosingDate] = useState<string>(() => {
    // Default to last day of current month or today
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-${String(now.getDate()).padStart(2, '0')}`;
  });
  const [closingRateOverride, setClosingRateOverride] = useState<number | ''>('');
  const [isApplyingAdjustment, setIsApplyingAdjustment] = useState<boolean>(false);
  const [adjustmentSuccessMsg, setAdjustmentSuccessMsg] = useState<string | null>(null);

  // Reload data helper
  const reloadData = () => {
    setCurrencies(getAvailableCurrencies(empresaRut));
    setExchangeHistory(getExchangeRateHistory(undefined, empresaRut));
  };

  // Filtered history list
  const filteredHistory = useMemo(() => {
    return exchangeHistory.filter((rec) => {
      const matchMoneda =
        historyFilterMoneda === 'ALL' ||
        rec.monedaCodigo.toUpperCase() === historyFilterMoneda.toUpperCase();
      const matchDate = !historySearchDate || rec.fecha.includes(historySearchDate);
      return matchMoneda && matchDate;
    });
  }, [exchangeHistory, historyFilterMoneda, historySearchDate]);

  // Handle Save New Currency
  const handleCreateCurrency = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCurrCode.trim() || !newCurrName.trim() || !newCurrSymbol.trim()) return;

    const created = addOrUpdateCurrency(
      {
        codigo: newCurrCode.trim().toUpperCase(),
        nombre: newCurrName.trim(),
        simbolo: newCurrSymbol.trim(),
        decimales: Number(newCurrDecimals) || 2,
        esMonedaBase: false,
        activo: true,
        ultimaCotizacion: Number(newCurrRate) || 1,
        descripcion: newCurrDesc.trim(),
      },
      empresaRut
    );

    // Guardar también cotización inicial en histórico
    saveExchangeRateRecord(
      {
        fecha: new Date().toISOString().split('T')[0],
        monedaCodigo: created.codigo,
        valor: created.ultimaCotizacion,
        fuente: 'Registro Inicial Catálogo',
        observacion: 'Alta de moneda en el sistema',
      },
      empresaRut
    );

    reloadData();
    setShowNewCurrencyForm(false);
    setNewCurrCode('');
    setNewCurrName('');
    setNewCurrSymbol('');
    setNewCurrDesc('');
  };

  // Handle Save New Historical Rate
  const handleSaveRate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rateDate || !rateCurrency || !rateValue || rateValue <= 0) return;

    saveExchangeRateRecord(
      {
        fecha: rateDate,
        monedaCodigo: rateCurrency,
        valor: Number(rateValue),
        fuente: rateSource,
        observacion: rateObs.trim() || 'Ingreso manual por usuario',
      },
      empresaRut
    );

    reloadData();
    setRateObs('');
  };

  // Handle Delete Rate
  const handleDeleteRate = (id: string) => {
    if (confirm('¿Está seguro de eliminar este registro histórico de cotización?')) {
      deleteExchangeRateRecord(id, empresaRut);
      reloadData();
    }
  };

  // Handle Toggle Active Currency
  const handleToggleCurrency = (code: string, currentActive: boolean) => {
    if (code === 'CLP') return; // CLP no se desactiva
    toggleCurrencyStatus(code, !currentActive, empresaRut);
    reloadData();
  };

  // NIC 21 Calculations
  const nic21Calculations = useMemo(() => {
    const overrides: Record<string, number> = {};
    if (closingRateOverride && Number(closingRateOverride) > 0) {
      overrides['USD'] = Number(closingRateOverride);
    }
    return calculateExchangeDifferenceForAccounts(
      entries,
      accounts,
      closingDate,
      overrides,
      empresaRut
    );
  }, [entries, accounts, closingDate, closingRateOverride, empresaRut, exchangeHistory]);

  const totalDiferenciaNeta = useMemo(() => {
    return nic21Calculations.reduce((acc, curr) => acc + curr.diferenciaCLP, 0);
  }, [nic21Calculations]);

  // Handle Apply NIC 21 Entry
  const handleApplyAdjustment = async () => {
    if (nic21Calculations.length === 0) return;
    setIsApplyingAdjustment(true);
    setAdjustmentSuccessMsg(null);
    try {
      const entry = generateExchangeDifferenceAdjustmentEntry(nic21Calculations, closingDate);
      if (entry) {
        await onApplyAdjustmentEntry(entry);
        setAdjustmentSuccessMsg(
          `¡Asiento de Diferencia de Cambio contabilizado exitosamente por $${Math.abs(
            totalDiferenciaNeta
          ).toLocaleString('es-CL')} CLP! Folio: ${entry.documento}`
        );
      }
    } catch (err: any) {
      alert(`Error al generar asiento de ajuste: ${err?.message || err}`);
    } finally {
      setIsApplyingAdjustment(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl my-auto overflow-hidden flex flex-col max-h-[92vh]">
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-linear-to-r from-slate-900 via-slate-800 to-indigo-950 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-indigo-300">
              <Coins className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  Gestión Multimoneda & Histórico de Paridades
                </h2>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                  NIC 21 / SII
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Definición de divisas operacionales, historial de cotizaciones oficiales y revalorización por diferencia de cambio.
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

        {/* MODAL TABS */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-slate-200 bg-slate-50/80 shrink-0 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('CATALOG')}
            className={`pb-2.5 px-3 border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'CATALOG'
                ? 'border-indigo-600 text-indigo-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Coins className="w-4 h-4" />
            <span>Monedas Habilitadas ({currencies.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('HISTORY')}
            className={`pb-2.5 px-3 border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'HISTORY'
                ? 'border-indigo-600 text-indigo-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Histórico de Tipos de Cambio ({exchangeHistory.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('NIC21')}
            className={`pb-2.5 px-3 border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'NIC21'
                ? 'border-indigo-600 text-indigo-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Agente Diferencia de Cambio (NIC 21)</span>
            {nic21Calculations.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 text-amber-800 font-bold">
                {nic21Calculations.length}
              </span>
            )}
          </button>
        </div>

        {/* TAB CONTENTS (SCROLLABLE) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: CATÁLOGO DE MONEDAS */}
          {activeTab === 'CATALOG' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Header con botón para nueva moneda */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-indigo-50/70 border border-indigo-200/80 p-4 rounded-xl">
                <div>
                  <h3 className="text-sm font-bold text-indigo-950 flex items-center gap-1.5">
                    <Coins className="w-4 h-4 text-indigo-600" />
                    Catálogo de Divisas de la Empresa
                  </h3>
                  <p className="text-xs text-indigo-800/80 mt-0.5">
                    Configure las monedas extranjeras admitidas en cuentas corrientes, facturas y partidas del balance.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowNewCurrencyForm(!showNewCurrencyForm)}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>{showNewCurrencyForm ? 'Ocultar Formulario' : 'Nueva Moneda'}</span>
                </button>
              </div>

              {/* Formulario Agregar Nueva Moneda */}
              {showNewCurrencyForm && (
                <form
                  onSubmit={handleCreateCurrency}
                  className="p-4 bg-white border-2 border-indigo-200 rounded-xl shadow-sm space-y-3 animate-in fade-in text-xs"
                >
                  <div className="font-bold text-slate-800 border-b border-slate-100 pb-2">
                    Registrar Nueva Divisa
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Código ISO (3 letras) *
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={4}
                        placeholder="ej: GBP, BRL, JPY"
                        value={newCurrCode}
                        onChange={(e) => setNewCurrCode(e.target.value.toUpperCase())}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono font-bold uppercase"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Nombre de la Moneda *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="ej: Libra Esterlina, Real Brasileño"
                        value={newCurrName}
                        onChange={(e) => setNewCurrName(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Símbolo *
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={5}
                        placeholder="ej: £, R$, ¥"
                        value={newCurrSymbol}
                        onChange={(e) => setNewCurrSymbol(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-bold font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Decimales
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={6}
                        value={newCurrDecimals}
                        onChange={(e) => setNewCurrDecimals(Number(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Cotización Inicial (CLP)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={newCurrRate}
                        onChange={(e) => setNewCurrRate(Number(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Descripción o Uso
                      </label>
                      <input
                        type="text"
                        placeholder="ej: Pagos de proveedores en UK"
                        value={newCurrDesc}
                        onChange={(e) => setNewCurrDesc(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setShowNewCurrencyForm(false)}
                      className="px-3 py-1.5 text-slate-600 hover:text-slate-800 cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg cursor-pointer shadow-xs"
                    >
                      Guardar Moneda
                    </button>
                  </div>
                </form>
              )}

              {/* Grid de Monedas */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {currencies.map((curr) => {
                  return (
                    <div
                      key={curr.codigo}
                      className={`p-4 rounded-xl border transition-all ${
                        curr.esMonedaBase
                          ? 'bg-emerald-50/50 border-emerald-300 shadow-xs'
                          : curr.activo
                          ? 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                          : 'bg-slate-50 border-slate-200 opacity-60'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center font-bold font-mono text-slate-800 text-sm">
                            {curr.simbolo}
                          </span>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-extrabold text-sm text-slate-900">
                                {curr.codigo}
                              </span>
                              {curr.esMonedaBase && (
                                <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                                  Moneda Base (CLP)
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-600 font-medium">
                              {curr.nombre}
                            </div>
                          </div>
                        </div>

                        {!curr.esMonedaBase && (
                          <button
                            type="button"
                            onClick={() => handleToggleCurrency(curr.codigo, curr.activo)}
                            className={`text-[10px] font-bold px-2 py-0.5 rounded cursor-pointer transition-colors ${
                              curr.activo
                                ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                                : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                            }`}
                          >
                            {curr.activo ? 'Activa' : 'Inactiva'}
                          </button>
                        )}
                      </div>

                      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                        <div>
                          <span className="text-[10px] text-slate-400 block">Última Cotización</span>
                          <span className="font-mono font-bold text-slate-900 text-sm">
                            {curr.esMonedaBase
                              ? '$1.00 CLP'
                              : `$${Number(curr.ultimaCotizacion).toLocaleString('es-CL', {
                                  minimumFractionDigits: curr.decimales,
                                  maximumFractionDigits: 4,
                                })} CLP`}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block">Actualizado</span>
                          <span className="font-mono text-[11px] text-slate-600">
                            {curr.fechaActualizacion || '2026-10-07'}
                          </span>
                        </div>
                      </div>

                      {curr.descripcion && (
                        <p className="mt-2 text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                          {curr.descripcion}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: HISTÓRICO DE COTIZACIONES */}
          {activeTab === 'HISTORY' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Formulario Registro Rápido de Cotización */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="font-bold text-xs text-slate-800 mb-2 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  Registrar Cotización / Paridad Histórica Oficial
                </div>
                <form
                  onSubmit={handleSaveRate}
                  className="grid grid-cols-1 sm:grid-cols-5 gap-2.5 text-xs items-end"
                >
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Fecha Contable *
                    </label>
                    <input
                      type="date"
                      required
                      value={rateDate}
                      onChange={(e) => setRateDate(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Divisa *
                    </label>
                    <select
                      value={rateCurrency}
                      onChange={(e) => setRateCurrency(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-bold"
                    >
                      {currencies
                        .filter((c) => !c.esMonedaBase && c.activo)
                        .map((c) => (
                          <option key={c.codigo} value={c.codigo}>
                            {c.codigo} ({c.simbolo} - {c.nombre})
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Valor en CLP ($) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      min={0.01}
                      placeholder="ej: 955.20"
                      value={rateValue}
                      onChange={(e) => setRateValue(Number(e.target.value))}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono font-bold text-xs text-right"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Fuente Oficial
                    </label>
                    <select
                      value={rateSource}
                      onChange={(e) => setRateSource(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs"
                    >
                      <option value="Banco Central de Chile">Banco Central de Chile</option>
                      <option value="SII">SII (Servicio de Impuestos Internos)</option>
                      <option value="CMF">CMF (Comisión para el Mercado Financiero)</option>
                      <option value="Registro Manual">Registro Manual / Certificado</option>
                    </select>
                  </div>
                  <div>
                    <button
                      type="submit"
                      className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg cursor-pointer text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Guardar Cotización</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Filtros de Histórico */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <span className="text-slate-500 font-semibold">Filtrar por Moneda:</span>
                  <select
                    value={historyFilterMoneda}
                    onChange={(e) => setHistoryFilterMoneda(e.target.value)}
                    className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold text-slate-800"
                  >
                    <option value="ALL">Todas las Divisas</option>
                    {currencies
                      .filter((c) => !c.esMonedaBase)
                      .map((c) => (
                        <option key={c.codigo} value={c.codigo}>
                          {c.codigo} - {c.nombre}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <span className="text-slate-500 font-semibold">Buscar Fecha:</span>
                  <input
                    type="text"
                    placeholder="ej: 2026-01"
                    value={historySearchDate}
                    onChange={(e) => setHistorySearchDate(e.target.value)}
                    className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono text-xs w-32"
                  />
                </div>
              </div>

              {/* Tabla de Histórico */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3">Fecha</th>
                      <th className="py-2.5 px-3">Divisa</th>
                      <th className="py-2.5 px-3 text-right">Cotización en CLP</th>
                      <th className="py-2.5 px-3">Fuente Oficial</th>
                      <th className="py-2.5 px-3">Observación</th>
                      <th className="py-2.5 px-3 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredHistory.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          No se encontraron cotizaciones para los filtros seleccionados.
                        </td>
                      </tr>
                    ) : (
                      filteredHistory.map((rec) => {
                        const curr = currencies.find((c) => c.codigo === rec.monedaCodigo);
                        return (
                          <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2 px-3 font-mono font-bold text-slate-800">
                              {rec.fecha}
                            </td>
                            <td className="py-2 px-3">
                              <span className="inline-flex items-center gap-1 font-mono font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
                                {rec.monedaCodigo}
                              </span>
                            </td>
                            <td className="py-2 px-3 font-mono font-bold text-slate-900 text-right">
                              ${Number(rec.valor).toLocaleString('es-CL', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 4,
                              })}{' '}
                              CLP
                            </td>
                            <td className="py-2 px-3 text-slate-600">{rec.fuente || 'Oficial'}</td>
                            <td className="py-2 px-3 text-slate-500 text-[11px]">
                              {rec.observacion || '—'}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleDeleteRate(rec.id)}
                                className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                                title="Eliminar registro"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: AGENTE DE DIFERENCIA DE CAMBIO (NIC 21) */}
          {activeTab === 'NIC21' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Banner Normativo NIC 21 */}
              <div className="p-4 bg-linear-to-r from-amber-50 to-orange-50 border border-amber-300 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>Marco Normativo Contable & Tributario (NIC 21 / Art. 41 N° 4 LIR)</span>
                </div>
                <p className="text-xs text-amber-800/90 leading-relaxed">
                  Las partidas monetarias expresadas en moneda extranjera (cuentas corrientes bancarias, clientes y proveedores internacionales) deben reexpresarse al tipo de cambio de cierre de cada período contable. La variación entre el valor en libros y el valor de cierre se reconoce obligatoriamente en resultados como <strong>Ganancia por Diferencia de Cambio (7.1.01.002)</strong> o <strong>Pérdida por Diferencia de Cambio (7.2.01.002)</strong>.
                </p>
              </div>

              {/* Controles de Cierre */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-500" />
                  <span className="font-semibold text-slate-700">Fecha de Cierre:</span>
                  <input
                    type="date"
                    value={closingDate}
                    onChange={(e) => setClosingDate(e.target.value)}
                    className="bg-white border border-slate-300 rounded-lg p-1.5 font-mono text-xs font-bold"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-700">T/C Cierre USD ($):</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder={`Automático: $${getExchangeRateForDate('USD', closingDate, empresaRut)}`}
                    value={closingRateOverride}
                    onChange={(e) => setClosingRateOverride(e.target.value ? Number(e.target.value) : '')}
                    className="bg-white border border-slate-300 rounded-lg p-1.5 font-mono text-xs w-36 text-right"
                  />
                  {closingRateOverride !== '' && (
                    <button
                      type="button"
                      onClick={() => setClosingRateOverride('')}
                      className="text-[10px] text-blue-600 hover:underline cursor-pointer"
                    >
                      Restablecer
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={reloadData}
                  className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-bold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Actualizar Auditoría</span>
                </button>
              </div>

              {/* Mensaje de Asiento Generado */}
              {adjustmentSuccessMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center gap-2 text-xs text-emerald-900 font-semibold animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{adjustmentSuccessMsg}</span>
                </div>
              )}

              {/* Tabla de Evaluación de Cuentas */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3">Cuenta Contable</th>
                      <th className="py-2.5 px-3">Divisa</th>
                      <th className="py-2.5 px-3 text-right">Saldo Moneda Orig.</th>
                      <th className="py-2.5 px-3 text-right">Saldo en Libros (CLP)</th>
                      <th className="py-2.5 px-3 text-right">T/C Cierre</th>
                      <th className="py-2.5 px-3 text-right">Valor Cierre (CLP)</th>
                      <th className="py-2.5 px-3 text-right">Ajuste Dif. Cambio</th>
                      <th className="py-2.5 px-3">Cuenta de Resultado Destino</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {nic21Calculations.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400">
                          No se detectaron cuentas con saldos pendientes en moneda extranjera al corte de {closingDate}.
                        </td>
                      </tr>
                    ) : (
                      nic21Calculations.map((c) => {
                        const isGain = c.diferenciaCLP >= 0;
                        return (
                          <tr key={c.cuentaCodigo} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2.5 px-3">
                              <span className="font-mono font-bold text-slate-900">
                                {c.cuentaCodigo}
                              </span>
                              <div className="text-[11px] text-slate-500 font-medium">
                                {c.cuentaNombre}
                              </div>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="font-mono font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px]">
                                {c.monedaCodigo}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-800 text-right">
                              {formatCurrencyAmount(c.saldoMonedaExtranjera, c.monedaCodigo, currencies)}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-600 text-right">
                              ${c.saldoLibroCLP.toLocaleString('es-CL')}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-600 text-right">
                              ${c.tipoCambioCierre.toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-900 text-right">
                              ${c.valorCierreCLP.toLocaleString('es-CL')}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-extrabold text-right">
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] ${
                                  isGain
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                    : 'bg-rose-100 text-rose-800 border border-rose-300'
                                }`}
                              >
                                {isGain ? '+' : ''}${c.diferenciaCLP.toLocaleString('es-CL')}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-[11px]">
                              <span
                                className={`font-semibold ${
                                  isGain ? 'text-emerald-700' : 'text-rose-700'
                                }`}
                              >
                                {c.cuentaAjusteCodigo} - {c.cuentaAjusteNombre}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  {nic21Calculations.length > 0 && (
                    <tfoot className="bg-slate-50 border-t-2 border-slate-300 font-bold text-xs">
                      <tr>
                        <td colSpan={6} className="py-3 px-3 text-right text-slate-700">
                          Efecto Neto Total en Resultados por Diferencia de Cambio:
                        </td>
                        <td
                          className={`py-3 px-3 text-right font-mono text-sm font-black ${
                            totalDiferenciaNeta >= 0 ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {totalDiferenciaNeta >= 0 ? '+' : ''}$
                          {totalDiferenciaNeta.toLocaleString('es-CL')} CLP
                        </td>
                        <td className="py-3 px-3 text-[11px] text-slate-500">
                          {totalDiferenciaNeta >= 0
                            ? 'Ganancia Neta del Ejercicio'
                            : 'Pérdida Neta del Ejercicio'}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {/* Botón de Ejecución del Agente */}
              {nic21Calculations.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                  <div className="text-xs text-slate-500">
                    Se generará un asiento contable oficial en el Libro Diario con imputación a partidas monetarias y cuentas de resultado (7.1.01 / 7.2.01).
                  </div>
                  <button
                    type="button"
                    disabled={isApplyingAdjustment || Math.abs(totalDiferenciaNeta) === 0}
                    onClick={handleApplyAdjustment}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>
                      {isApplyingAdjustment
                        ? 'Contabilizando Asiento...'
                        : 'Contabilizar Asiento de Diferencia de Cambio'}
                    </span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200 bg-slate-50/90 text-xs shrink-0">
          <div className="text-slate-500 flex items-center gap-1.5 text-[11px]">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            <span>Moneda Funcional: CLP • Normativa: NIC 21 / NIIF</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
