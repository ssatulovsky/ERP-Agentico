import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  DollarSign,
  Download,
  Filter,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
  X,
  FileSpreadsheet,
  FileText,
  Building2,
  Bot,
  ShieldCheck,
  Users,
  Hammer,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Activity,
  Layers,
  ChevronRight
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts';
import {
  CashFlowMovement,
  DteDocument,
  ChileIndicators,
  CompanyProfile,
  BankAccountConfig,
  EmployeePayroll,
  F29Declaration,
  ProductionBudget,
  ProductionOrder,
  LeaseContract,
  CashFlowCategory,
  CashFlowOriginModule,
} from '../types';
import { downloadCashFlowPdf, downloadCashFlowExcel } from '../utils/reportGenerators';
import {
  calculateConsolidatedBankBalance,
  buildDailyCashFlowProjection,
  scanErpCommitments,
} from '../utils/cashFlowProjectionEngine';
import { CashFlowAutonomousAgentModal } from './CashFlowAutonomousAgentModal';

interface CashFlowProjectionsProps {
  movements: CashFlowMovement[];
  onAddMovement: (mov: CashFlowMovement) => void;
  onAddMultipleMovements?: (movs: CashFlowMovement[]) => void;
  onUpdateMovement: (mov: CashFlowMovement) => void;
  dtes: DteDocument[];
  indicators: ChileIndicators;
  company: CompanyProfile;
  bankAccounts?: BankAccountConfig[];
  payrolls?: EmployeePayroll[];
  f29?: F29Declaration;
  productionBudgets?: ProductionBudget[];
  productionOrders?: ProductionOrder[];
  leases?: LeaseContract[];
}

export const CashFlowProjections: React.FC<CashFlowProjectionsProps> = ({
  movements = [],
  onAddMovement,
  onAddMultipleMovements,
  onUpdateMovement,
  dtes = [],
  indicators,
  company,
  bankAccounts = [],
  payrolls = [],
  f29,
  productionBudgets = [],
  productionOrders = [],
  leases = [],
}) => {
  const safeMovements = Array.isArray(movements) ? movements : [];
  const safeDtes = Array.isArray(dtes) ? dtes : [];

  // State
  const [scenario, setScenario] = useState<'BASE' | 'OPTIMISTA' | 'ESTRESADO'>('BASE');
  const [horizonDays, setHorizonDays] = useState<number>(60);
  const [activeViewTab, setActiveViewTab] = useState<'CHART' | 'TIMELINE' | 'TABLE'>('CHART');
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'INGRESO' | 'EGRESO'>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [originFilter, setOriginFilter] = useState<string>('ALL');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAgentScannerModal, setShowAgentScannerModal] = useState(false);

  // Bank accounts calculation
  const bankConsolidated = useMemo(() => {
    return calculateConsolidatedBankBalance(bankAccounts);
  }, [bankAccounts]);

  // ERP Scanner preview for badge
  const commitmentsPreview = useMemo(() => {
    return scanErpCommitments({
      payrolls,
      f29,
      productionBudgets,
      productionOrders,
      dtes,
      leases,
      existingMovements: safeMovements,
    });
  }, [payrolls, f29, productionBudgets, productionOrders, dtes, leases, safeMovements]);

  // Rolling Forecast calculation using real bank balance
  const projection = useMemo(() => {
    return buildDailyCashFlowProjection(
      safeMovements,
      bankConsolidated.totalSaldo,
      horizonDays,
      scenario
    );
  }, [safeMovements, bankConsolidated.totalSaldo, horizonDays, scenario]);

  // Formatters
  const formatCLP = (val: number) => `$${Math.round(val).toLocaleString('es-CL')}`;
  const formatNumberCL = (val: number) => Math.round(val).toLocaleString('es-CL');

  // New Movement Form state (Strict 5 fields)
  const [newMov, setNewMov] = useState<Partial<CashFlowMovement>>({
    tipo: 'INGRESO',
    categoria: 'VENTAS_OPERACIONALES',
    concepto: '',
    contraparte: '',
    rutContraparte: '',
    fechaEstimada: new Date().toISOString().split('T')[0],
    montoNeto: 1000000,
    montoIva: 190000,
    montoTotal: 1190000,
    moneda: 'CLP',
    estado: 'PENDIENTE',
    origenModulo: 'MANUAL',
  });

  // Calculate totals
  const totalIngresos = safeMovements
    .filter(m => m.tipo === 'INGRESO')
    .reduce((s, m) => s + m.montoTotal, 0);

  const totalEgresos = safeMovements
    .filter(m => m.tipo === 'EGRESO')
    .reduce((s, m) => s + m.montoTotal, 0);

  // Filtered movements for Table view
  const filteredMovements = safeMovements.filter((m) => {
    const matchType = typeFilter === 'ALL' || m.tipo === typeFilter;
    const matchStatus = statusFilter === 'ALL' || m.estado === statusFilter;
    const matchOrigin = originFilter === 'ALL' || m.origenModulo === originFilter;
    const matchSearch =
      searchTerm === '' ||
      m.concepto.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.contraparte.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.rutContraparte && m.rutContraparte.includes(searchTerm));

    return matchType && matchStatus && matchOrigin && matchSearch;
  });

  const handleCreateMovement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMov.concepto || !newMov.contraparte || !newMov.fechaEstimada) return;

    const created: CashFlowMovement = {
      id: `mov-${Date.now()}`,
      fechaEstimada: newMov.fechaEstimada,
      concepto: newMov.concepto,
      contraparte: newMov.contraparte,
      rutContraparte: newMov.rutContraparte || undefined,
      montoNeto: Number(newMov.montoNeto) || 0,
      montoIva: Number(newMov.montoIva) || 0,
      montoTotal: Number(newMov.montoTotal) || 0,
      moneda: newMov.moneda || 'CLP',
      estado: newMov.estado as any || 'PENDIENTE',
      tipo: newMov.tipo as any || 'INGRESO',
      categoria: newMov.categoria as any || 'VENTAS_OPERACIONALES',
      origenModulo: 'MANUAL',
    };

    onAddMovement(created);
    setShowAddModal(false);
    setNewMov({
      tipo: 'INGRESO',
      categoria: 'VENTAS_OPERACIONALES',
      concepto: '',
      contraparte: '',
      rutContraparte: '',
      fechaEstimada: new Date().toISOString().split('T')[0],
      montoNeto: 1000000,
      montoIva: 190000,
      montoTotal: 1190000,
      moneda: 'CLP',
      estado: 'PENDIENTE',
      origenModulo: 'MANUAL',
    });
  };

  const handleSyncCommitments = (newCommitments: CashFlowMovement[]) => {
    if (onAddMultipleMovements) {
      onAddMultipleMovements(newCommitments);
    } else {
      newCommitments.forEach(m => onAddMovement(m));
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn text-slate-900 pb-12">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-slate-900 tracking-tight">
                  Flujo de Caja Proyectado Real (Rolling Cash Forecast)
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                  Agente Autónomo de Liquidez
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Integración directa con Saldos Bancarios, Nómina, Previred, F29, Hitos de Producción y Facturas RCV
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setShowAgentScannerModal(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white px-3.5 py-2 rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer"
          >
            <Bot className="w-4 h-4" />
            <span>Escanear Compromisos ERP</span>
            {commitmentsPreview.projectedMovements.length > 0 && (
              <span className="bg-white text-indigo-700 px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ml-1">
                {commitmentsPreview.projectedMovements.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-xs font-bold transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Movimiento</span>
          </button>

          <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
            <button
              onClick={() => downloadCashFlowExcel(safeMovements, company as any)}
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer border border-slate-200"
              title="Exportar a Excel"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            </button>
            <button
              onClick={() => downloadCashFlowPdf(safeMovements, company as any)}
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer border border-slate-200"
              title="Exportar a PDF"
            >
              <FileText className="w-4 h-4 text-rose-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Connected Bank Accounts Real Baseline */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white rounded-xl p-5 shadow-md border border-slate-700">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-700/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-400 font-bold flex items-center gap-2">
                <span>Saldo Inicial Consolidado en Bancos (Cash Baseline)</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              </div>
              <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-white mt-0.5">
                {formatCLP(bankConsolidated.totalSaldo)}
                <span className="text-xs text-indigo-300 font-sans font-medium ml-2">CLP Líquido Disponible</span>
              </div>
            </div>
          </div>

          {/* Quick bank pills */}
          <div className="flex flex-wrap items-center gap-2">
            {bankConsolidated.cuentas.map(c => (
              <div
                key={c.id}
                className="bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 px-3 py-1.5 rounded-lg text-xs space-y-0.5"
              >
                <div className="flex items-center justify-between gap-3 text-[11px] text-slate-400">
                  <span className="font-semibold text-slate-200">{c.banco}</span>
                  <span className="text-[10px] font-mono text-slate-400">Cta {c.numero}</span>
                </div>
                <div className="font-mono font-bold text-white text-xs">
                  {formatCLP(c.saldo)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Rolling Forecast Indicators & Horizon Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 text-xs">
          <div>
            <span className="text-slate-400 block text-[11px]">Ingresos Proyectados</span>
            <span className="font-mono text-emerald-400 font-bold text-base block mt-0.5">
              +{formatCLP(projection.totalIngresosPeriodo)}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block text-[11px]">Egresos Comprometidos</span>
            <span className="font-mono text-rose-400 font-bold text-base block mt-0.5">
              -{formatCLP(projection.totalEgresosPeriodo)}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block text-[11px]">Saldo Mínimo Previsto</span>
            <span
              className={`font-mono font-bold text-base block mt-0.5 ${
                projection.saldoMinimo < 0 ? 'text-rose-400' : 'text-indigo-300'
              }`}
            >
              {formatCLP(projection.saldoMinimo)}
            </span>
            <span className="text-[10px] text-slate-400">el {projection.fechaSaldoMinimo}</span>
          </div>

          <div>
            <span className="text-slate-400 block text-[11px]">Saldo Proyectado a {horizonDays} Días</span>
            <span
              className={`font-mono font-bold text-base block mt-0.5 ${
                projection.saldoFinalProyectado < 0 ? 'text-rose-400' : 'text-white'
              }`}
            >
              {formatCLP(projection.saldoFinalProyectado)}
            </span>
          </div>
        </div>
      </div>

      {/* Liquidity Crisis / Overdraft Alert Banner */}
      {projection.alert && (
        <div
          className={`p-5 rounded-xl border transition-all ${
            projection.alert.nivelGravedad === 'CRITICO'
              ? 'bg-rose-950/90 border-rose-500/80 text-rose-100 shadow-lg shadow-rose-950/40'
              : projection.alert.nivelGravedad === 'ALERTA'
              ? 'bg-amber-950/80 border-amber-500/70 text-amber-100 shadow-md'
              : 'bg-indigo-950/80 border-indigo-500/60 text-indigo-100 shadow-sm'
          }`}
        >
          <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div
                className={`p-2 rounded-lg shrink-0 ${
                  projection.alert.nivelGravedad === 'CRITICO'
                    ? 'bg-rose-600 text-white'
                    : 'bg-amber-600 text-white'
                }`}
              >
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm sm:text-base">
                    {projection.alert.deficitMaximo > 0
                      ? `¡Alerta de Quiebre de Caja Previsto para el ${projection.alert.fechaQuiebre}!`
                      : `Precaución: Saldo Proyectado cercano al límite de seguridad operacional`}
                  </h4>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                      projection.alert.nivelGravedad === 'CRITICO'
                        ? 'bg-rose-500 text-white'
                        : 'bg-amber-500 text-black'
                    }`}
                  >
                    En {projection.alert.diasParaQuiebre} días
                  </span>
                </div>

                <p className="text-xs opacity-90">
                  {projection.alert.deficitMaximo > 0 ? (
                    <>
                      El saldo consolidado en bancos caerá bajo la línea de flotación a un déficit de{' '}
                      <strong className="font-mono underline">
                        -{formatCLP(projection.alert.deficitMaximo)}
                      </strong>{' '}
                      debido a la concurrencia de pagos sin cobranzas previas compensatorias.
                    </>
                  ) : (
                    'El saldo proyectado descenderá por debajo del colchón de seguridad de $2.000.000 CLP.'
                  )}
                </p>

                {/* Root Causes */}
                <div className="pt-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider block opacity-75">
                    Principales compromisos que presionan la liquidez:
                  </span>
                  <ul className="list-disc list-inside text-xs space-y-0.5 mt-1 opacity-90">
                    {projection.alert.causasPrincipales.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Recommended Action Box */}
            <div className="bg-black/30 border border-white/10 rounded-xl p-3.5 max-w-sm shrink-0 space-y-2 text-xs">
              <span className="font-bold flex items-center gap-1.5 text-white">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Acciones Recomendadas por el Agente:
              </span>
              <ul className="space-y-1 text-[11px] opacity-85">
                {projection.alert.accionesRecomendadas.slice(0, 2).map((rec, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <ChevronRight className="w-3.5 h-3.5 shrink-0 mt-0.5 text-indigo-300" />
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Main Analysis Container with View Selector */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        {/* Navigation & Controls Bar */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* View Mode Tabs */}
          <div className="flex items-center gap-1 bg-slate-200/80 p-1 rounded-lg">
            <button
              onClick={() => setActiveViewTab('CHART')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeViewTab === 'CHART'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
              <span>Curva Gráfica</span>
            </button>

            <button
              onClick={() => setActiveViewTab('TIMELINE')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeViewTab === 'TIMELINE'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              <span>Calendario Diario</span>
            </button>

            <button
              onClick={() => setActiveViewTab('TABLE')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeViewTab === 'TABLE'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-slate-600" />
              <span>Libro de Movimientos ({filteredMovements.length})</span>
            </button>
          </div>

          {/* Scenario & Horizon Selectors */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Horizon Selector */}
            <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-lg p-1 text-xs">
              <span className="text-slate-400 text-[11px] px-1 font-semibold">Horizonte:</span>
              <button
                onClick={() => setHorizonDays(30)}
                className={`px-2 py-0.5 rounded text-xs font-bold transition-colors cursor-pointer ${
                  horizonDays === 30 ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                30 Días
              </button>
              <button
                onClick={() => setHorizonDays(60)}
                className={`px-2 py-0.5 rounded text-xs font-bold transition-colors cursor-pointer ${
                  horizonDays === 60 ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                60 Días
              </button>
              <button
                onClick={() => setHorizonDays(90)}
                className={`px-2 py-0.5 rounded text-xs font-bold transition-colors cursor-pointer ${
                  horizonDays === 90 ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                90 Días
              </button>
            </div>

            {/* Scenario Selector */}
            <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-lg p-1 text-xs">
              <span className="text-slate-400 text-[11px] px-1 font-semibold">Escenario:</span>
              <button
                onClick={() => setScenario('BASE')}
                className={`px-2.5 py-0.5 rounded text-xs font-bold transition-colors cursor-pointer ${
                  scenario === 'BASE' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Base
              </button>
              <button
                onClick={() => setScenario('OPTIMISTA')}
                className={`px-2.5 py-0.5 rounded text-xs font-bold transition-colors cursor-pointer ${
                  scenario === 'OPTIMISTA' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Optimista (+15%)
              </button>
              <button
                onClick={() => setScenario('ESTRESADO')}
                className={`px-2.5 py-0.5 rounded text-xs font-bold transition-colors cursor-pointer ${
                  scenario === 'ESTRESADO' ? 'bg-rose-600 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Estresado (-30% mora)
              </button>
            </div>
          </div>
        </div>

        {/* View 1: Projections Chart */}
        {activeViewTab === 'CHART' && (
          <div className="p-5 space-y-6">
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={projection.dailyTimeline}
                  margin={{ top: 10, right: 20, left: 10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorSaldoReal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="colorIngresosReal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="fecha"
                    stroke="#64748b"
                    fontSize={11}
                    tickFormatter={(val) => val.substring(5)}
                  />
                  <YAxis
                    stroke="#64748b"
                    fontSize={11}
                    tickFormatter={(v) => `$${(v / 1000000).toFixed(1)}M`}
                  />
                  <Tooltip
                    formatter={(value: any, name: string) => [
                      formatCLP(Number(value)),
                      name === 'saldoProyectado'
                        ? 'Saldo Proyectado en Bancos'
                        : name === 'ingresosDia'
                        ? 'Ingresos del Día'
                        : 'Egresos del Día',
                    ]}
                    labelFormatter={(label) => `Fecha: ${label}`}
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderColor: '#cbd5e1',
                      borderRadius: '8px',
                      fontSize: '12px',
                      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  <ReferenceLine y={0} stroke="#e11d48" strokeWidth={1.5} strokeDasharray="4 4" label={{ value: 'Línea de Flotación ($0)', fill: '#e11d48', fontSize: 10, position: 'insideBottomLeft' }} />
                  <Area
                    type="monotone"
                    dataKey="saldoProyectado"
                    name="saldoProyectado"
                    stroke="#4f46e5"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorSaldoReal)"
                  />
                  <Area
                    type="monotone"
                    dataKey="ingresosDia"
                    name="ingresosDia"
                    stroke="#10b981"
                    strokeWidth={1.5}
                    fillOpacity={0.5}
                    fill="url(#colorIngresosReal)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Weekly Summary Cards */}
            <div className="border-t border-slate-200 pt-5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                Resumen Semanal de Tesorería (Time-Bucketing Proyectado)
              </h4>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                {projection.weeklyTimeline.slice(0, 6).map((w, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-xl border transition-all text-xs space-y-1.5 ${
                      w.estaEnDeficit
                        ? 'bg-rose-50 border-rose-300'
                        : 'bg-slate-50 border-slate-200 hover:border-indigo-300'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-slate-800">{w.semanaLabel}</span>
                      <span className="text-[10px] text-slate-500">{w.fechaInicio.substring(5)}</span>
                    </div>

                    <div className="font-mono font-black text-sm">
                      <span className={w.saldoFinal < 0 ? 'text-rose-600' : 'text-slate-900'}>
                        {formatCLP(w.saldoFinal)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-200/60 font-mono">
                      <span className="text-emerald-700">+{formatNumberCL(w.ingresos)}</span>
                      <span className="text-rose-700">-{formatNumberCL(w.egresos)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* View 2: Daily Calendar Timeline */}
        {activeViewTab === 'TIMELINE' && (
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm text-slate-900">
                  Calendario Diario de Liquidez & Compromisos Clave
                </h4>
                <p className="text-xs text-slate-500">
                  Visualización detallada de los días con movimientos, hitos tributarios y balance de cierre
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="flex items-center gap-1 text-[11px] text-slate-500">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Ingreso
                </span>
                <span className="flex items-center gap-1 text-[11px] text-slate-500">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Egreso
                </span>
              </div>
            </div>

            <div className="max-h-[500px] overflow-y-auto space-y-2.5 pr-1 divide-y divide-slate-100">
              {projection.dailyTimeline
                .filter(d => d.ingresosDia > 0 || d.egresosDia > 0 || d.estaEnDeficit)
                .map((day, idx) => {
                  const dayNum = parseInt(day.fecha.split('-')[2], 10);
                  const isPreviredDay = dayNum >= 10 && dayNum <= 13;
                  const isF29Day = dayNum === 20;
                  const isPayday = dayNum >= 28;

                  return (
                    <div
                      key={idx}
                      className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        day.estaEnDeficit
                          ? 'bg-rose-50/80 border-rose-300'
                          : 'bg-white border-slate-200 hover:border-indigo-300'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="text-center p-2 rounded-lg bg-slate-100 border border-slate-200 shrink-0 min-w-[55px]">
                          <span className="text-[10px] font-bold text-slate-500 uppercase block">
                            {day.diaSemana}
                          </span>
                          <span className="text-base font-black text-slate-900 font-mono block leading-none mt-0.5">
                            {day.fecha.split('-')[2]}
                          </span>
                          <span className="text-[9px] text-slate-400 font-mono block mt-0.5">
                            {day.fecha.split('-')[1]}
                          </span>
                        </div>

                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono text-xs font-semibold text-slate-800">
                              {day.fecha}
                            </span>

                            {isPreviredDay && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                Ventana Previred
                              </span>
                            )}
                            {isF29Day && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-300">
                                Vencimiento F29
                              </span>
                            )}
                            {isPayday && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
                                Fin de Mes Nómina
                              </span>
                            )}
                            {day.estaEnDeficit && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-black bg-rose-600 text-white">
                                QUIEBRE DE CAJA
                              </span>
                            )}
                          </div>

                          <div className="text-xs space-y-1">
                            {day.eventosClave.map((ev, k) => (
                              <div key={k} className="flex items-center gap-2 text-slate-700">
                                <span
                                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                    ev.tipo === 'INGRESO' ? 'bg-emerald-500' : 'bg-rose-500'
                                  }`}
                                ></span>
                                <span className="font-medium">{ev.concepto}</span>
                                <span
                                  className={`font-mono font-bold text-[11px] ${
                                    ev.tipo === 'INGRESO' ? 'text-emerald-700' : 'text-rose-700'
                                  }`}
                                >
                                  ({ev.tipo === 'INGRESO' ? '+' : '-'}{formatCLP(ev.monto)})
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Day Balance Pill */}
                      <div className="text-right shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                        <span className="text-[10px] text-slate-500 block uppercase">
                          Saldo al Cierre del Día
                        </span>
                        <span
                          className={`font-mono font-black text-sm block ${
                            day.saldoProyectado < 0 ? 'text-rose-600' : 'text-indigo-900'
                          }`}
                        >
                          {formatCLP(day.saldoProyectado)}
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* View 3: Table of Movements */}
        {activeViewTab === 'TABLE' && (
          <div>
            {/* Control Bar: Filter Movements */}
            <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-md border border-slate-200 text-xs">
                  <button
                    onClick={() => setTypeFilter('ALL')}
                    className={`px-3 py-1 rounded font-semibold cursor-pointer ${
                      typeFilter === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    Todos ({safeMovements.length})
                  </button>
                  <button
                    onClick={() => setTypeFilter('INGRESO')}
                    className={`px-3 py-1 rounded font-semibold cursor-pointer ${
                      typeFilter === 'INGRESO' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    Ingresos
                  </button>
                  <button
                    onClick={() => setTypeFilter('EGRESO')}
                    className={`px-3 py-1 rounded font-semibold cursor-pointer ${
                      typeFilter === 'EGRESO' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    Egresos
                  </button>
                </div>

                <select
                  value={originFilter}
                  onChange={(e) => setOriginFilter(e.target.value)}
                  className="bg-white border border-slate-300 text-slate-700 text-xs rounded-md p-1.5 focus:outline-none focus:border-indigo-600"
                >
                  <option value="ALL">Todos los Orígenes</option>
                  <option value="NOMINA">Nómina y Sueldos</option>
                  <option value="PREVIRED">Previred e Imposiciones</option>
                  <option value="F29">F29 Impuestos TGR</option>
                  <option value="PRESUPUESTO_PRODUCCION">Presupuesto Producción</option>
                  <option value="ORDEN_PRODUCCION">Orden de Producción (OP)</option>
                  <option value="DTE_SII">Facturas RCV / SII</option>
                  <option value="LEASING_IFRS16">Leasing IFRS 16</option>
                  <option value="MANUAL">Manual</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-white border border-slate-300 text-slate-700 text-xs rounded-md p-1.5 focus:outline-none focus:border-indigo-600"
                >
                  <option value="ALL">Todos los Estados</option>
                  <option value="PENDIENTE">Pendiente</option>
                  <option value="FACTURADO">Facturado</option>
                  <option value="COBRADO">Cobrado</option>
                  <option value="PAGADO">Pagado</option>
                  <option value="VENCIDO">Vencido</option>
                </select>
              </div>

              {/* Search */}
              <div className="relative flex-1 sm:w-60">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar concepto o RUT..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-md pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600"
                />
              </div>
            </div>

            {/* Movements Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-[11px]">
                  <tr>
                    <th className="px-4 py-3">1. Fechas (Estimada / Real)</th>
                    <th className="px-4 py-3">2. Concepto & Origen</th>
                    <th className="px-4 py-3">3. Entidad / Contraparte</th>
                    <th className="px-4 py-3 text-right">4. Monto Neto ($)</th>
                    <th className="px-4 py-3 text-right">IVA (19%)</th>
                    <th className="px-4 py-3 text-right">Total ($ CLP)</th>
                    <th className="px-4 py-3 text-center">5. Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {filteredMovements.map((mov) => {
                    const isIngreso = mov.tipo === 'INGRESO';

                    return (
                      <tr key={mov.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 text-slate-700">
                          <div className="flex items-center gap-1 font-semibold text-slate-900">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>{mov.fechaEstimada}</span>
                          </div>
                          {mov.fechaReal && (
                            <div className="text-[10px] text-emerald-700 font-bold">
                              Real: {mov.fechaReal}
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-3 font-sans">
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                isIngreso ? 'bg-emerald-500' : 'bg-rose-500'
                              }`}
                            ></span>
                            <span>{mov.concepto}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-slate-500 font-mono">
                              {mov.categoria}
                            </span>
                            {mov.origenModulo && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                {mov.origenModulo}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3 font-sans">
                          <div className="font-semibold text-slate-800">{mov.contraparte}</div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            {mov.rutContraparte}
                          </div>
                        </td>

                        <td className="px-4 py-3 text-right text-slate-700 font-medium">
                          {mov.montoNeto > 0 ? formatNumberCL(mov.montoNeto) : '-'}
                        </td>

                        <td className="px-4 py-3 text-right">
                          {mov.montoIva > 0 ? (
                            <span
                              className={
                                isIngreso
                                  ? 'text-emerald-700 font-semibold'
                                  : 'text-rose-700 font-semibold'
                              }
                            >
                              {formatNumberCL(mov.montoIva)}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-sans">Exento</span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-right font-bold text-slate-900">
                          <div
                            className={
                              isIngreso ? 'text-emerald-700 font-black' : 'text-rose-700 font-black'
                            }
                          >
                            {isIngreso ? '+' : '-'}
                            {formatCLP(mov.montoTotal)}
                          </div>
                        </td>

                        <td className="px-4 py-3 text-center font-sans">
                          <button
                            onClick={() => {
                              const next =
                                mov.estado === 'COBRADO' || mov.estado === 'PAGADO'
                                  ? 'PENDIENTE'
                                  : isIngreso
                                  ? 'COBRADO'
                                  : 'PAGADO';
                              onUpdateMovement({
                                ...mov,
                                estado: next as any,
                                fechaReal:
                                  next === 'PENDIENTE'
                                    ? undefined
                                    : new Date().toISOString().split('T')[0],
                              });
                            }}
                            className={`px-2.5 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                              mov.estado === 'COBRADO' || mov.estado === 'PAGADO'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : mov.estado === 'FACTURADO'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : mov.estado === 'VENCIDO'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                            title="Click para alternar estado"
                          >
                            {mov.estado}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* MODAL: Nuevo Movimiento de Flujo */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-xl overflow-hidden shadow-2xl animate-fadeIn">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-white text-sm sm:text-base">
                  Registrar Nuevo Flujo de Caja (5 Campos Obligatorios)
                </h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateMovement} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Tipo de Flujo:</label>
                  <select
                    value={newMov.tipo}
                    onChange={(e) =>
                      setNewMov((prev) => ({ ...prev, tipo: e.target.value as any }))
                    }
                    className="w-full bg-slate-50 border border-slate-300 rounded-md p-2 text-slate-900 focus:outline-none focus:border-indigo-600"
                  >
                    <option value="INGRESO">Ingreso (+)</option>
                    <option value="EGRESO">Egreso (-)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Categoría:</label>
                  <select
                    value={newMov.categoria}
                    onChange={(e) =>
                      setNewMov((prev) => ({ ...prev, categoria: e.target.value as any }))
                    }
                    className="w-full bg-slate-50 border border-slate-300 rounded-md p-2 text-slate-900 focus:outline-none focus:border-indigo-600"
                  >
                    <option value="VENTAS_OPERACIONALES">Cobranza Clientes DTE</option>
                    <option value="PROVEEDORES">Pago Proveedores DTE</option>
                    <option value="REMUNERACIONES">Nómina y Remuneraciones</option>
                    <option value="PREVIRED_LEYES_SOCIALES">Previred / Leyes Sociales</option>
                    <option value="IMPUESTOS_F29">Impuesto F29 (TGR)</option>
                    <option value="PRODUCCION_HITO_VENTA">Producción - Hito Venta/Anticipo</option>
                    <option value="PRODUCCION_INSUMOS_COMPRA">Producción - Insumos MPD</option>
                    <option value="ARRIENDOS">Arriendo y Servicios</option>
                    <option value="HONORARIOS">Boletas de Honorarios</option>
                    <option value="OTRO">Otros Gastos Operacionales</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Concepto o Glosa Detallada:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Cobro Anticipo 40% Proyecto Jaula Circular 40m"
                  value={newMov.concepto}
                  onChange={(e) => setNewMov((prev) => ({ ...prev, concepto: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-md p-2 text-slate-900 focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">RUT Entidad:</label>
                  <input
                    type="text"
                    placeholder="76.123.456-7"
                    value={newMov.rutContraparte}
                    onChange={(e) =>
                      setNewMov((prev) => ({ ...prev, rutContraparte: e.target.value }))
                    }
                    className="w-full bg-slate-50 border border-slate-300 rounded-md p-2 font-mono text-slate-900 focus:outline-none focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Nombre / Razón Social:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Nombre del Cliente, Proveedor o Entidad"
                    value={newMov.contraparte}
                    onChange={(e) =>
                      setNewMov((prev) => ({ ...prev, contraparte: e.target.value }))
                    }
                    className="w-full bg-slate-50 border border-slate-300 rounded-md p-2 text-slate-900 focus:outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Monto Neto ($):</label>
                  <input
                    type="number"
                    required
                    value={newMov.montoNeto}
                    onChange={(e) => {
                      const neto = Number(e.target.value) || 0;
                      const iva = Math.round(neto * 0.19);
                      setNewMov((prev) => ({
                        ...prev,
                        montoNeto: neto,
                        montoIva: iva,
                        montoTotal: neto + iva,
                      }));
                    }}
                    className="w-full bg-slate-50 border border-slate-300 rounded-md p-2 font-mono text-slate-900 focus:outline-none focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">IVA (19%):</label>
                  <input
                    type="number"
                    value={newMov.montoIva}
                    onChange={(e) => {
                      const iva = Number(e.target.value) || 0;
                      setNewMov((prev) => ({
                        ...prev,
                        montoIva: iva,
                        montoTotal: (prev.montoNeto || 0) + iva,
                      }));
                    }}
                    className="w-full bg-slate-50 border border-slate-300 rounded-md p-2 font-mono text-slate-900 focus:outline-none focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Total ($ CLP):</label>
                  <input
                    type="number"
                    required
                    value={newMov.montoTotal}
                    onChange={(e) =>
                      setNewMov((prev) => ({ ...prev, montoTotal: Number(e.target.value) || 0 }))
                    }
                    className="w-full bg-slate-50 border border-slate-300 rounded-md p-2 font-mono font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Fecha Estimada:</label>
                  <input
                    type="date"
                    required
                    value={newMov.fechaEstimada}
                    onChange={(e) =>
                      setNewMov((prev) => ({ ...prev, fechaEstimada: e.target.value }))
                    }
                    className="w-full bg-slate-50 border border-slate-300 rounded-md p-2 text-slate-900 focus:outline-none focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Estado:</label>
                  <select
                    value={newMov.estado}
                    onChange={(e) =>
                      setNewMov((prev) => ({ ...prev, estado: e.target.value as any }))
                    }
                    className="w-full bg-slate-50 border border-slate-300 rounded-md p-2 text-slate-900 focus:outline-none focus:border-indigo-600"
                  >
                    <option value="PENDIENTE">Pendiente</option>
                    <option value="FACTURADO">Facturado</option>
                    <option value="COBRADO">Cobrado</option>
                    <option value="PAGADO">Pagado</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-md text-slate-700 font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-semibold transition-colors shadow-xs cursor-pointer"
                >
                  Guardar Movimiento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Autonomous Scanner Modal */}
      {showAgentScannerModal && (
        <CashFlowAutonomousAgentModal
          payrolls={payrolls}
          f29={f29}
          productionBudgets={productionBudgets}
          productionOrders={productionOrders}
          dtes={safeDtes}
          leases={leases}
          existingMovements={safeMovements}
          onClose={() => setShowAgentScannerModal(false)}
          onSyncMovements={handleSyncCommitments}
        />
      )}
    </div>
  );
};
