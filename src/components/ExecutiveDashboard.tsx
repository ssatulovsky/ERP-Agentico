import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  ClientCompany,
  DteDocument,
  CashFlowMovement,
  BankAccountConfig,
  CashAccountConfig,
  EmployeePayroll,
  F29Declaration,
  ProductionOrder,
  ProductionBudget,
  CostCenterMaster,
  MedicalLeave,
  VacationRecord,
  AbsenteeismRecord,
  InventoryItem,
  DeudaFinanciera,
  ProvisionEgreso,
  ChequeCartera,
  ChequeEmitido,
} from '../types';
import { formatCLP } from '../utils/chileanAccounting';
import {
  calculateExecutiveDashboardMetrics,
  ExecutiveDashboardSummary,
} from '../utils/executiveDashboardEngine';
import {
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  PieChart as PieChartIcon,
  Scale,
  Users,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Building2,
  Factory,
  FileSpreadsheet,
  Layers,
  ShieldCheck,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRight,
  Sparkles,
  Clock,
  Target,
  ChevronRight,
  Download,
  RefreshCw,
  SlidersHorizontal,
  Info,
  HeartPulse,
  Calendar,
  AlertCircle,
  Briefcase,
  FileText,
  Boxes,
} from 'lucide-react';

interface ExecutiveDashboardProps {
  company: ClientCompany;
  dtes?: DteDocument[];
  movements?: CashFlowMovement[];
  bankAccounts?: BankAccountConfig[];
  cashAccounts?: CashAccountConfig[];
  payrolls?: EmployeePayroll[];
  f29?: F29Declaration;
  productionOrders?: ProductionOrder[];
  productionBudgets?: ProductionBudget[];
  costCenters?: CostCenterMaster[];
  medicalLeaves?: MedicalLeave[];
  vacations?: VacationRecord[];
  absenteeismList?: AbsenteeismRecord[];
  inventoryItems?: InventoryItem[];
  deudasFinancieras?: DeudaFinanciera[];
  provisionesEgresos?: ProvisionEgreso[];
  chequesCartera?: ChequeCartera[];
  chequesEmitidos?: ChequeEmitido[];
  onNavigateToTab?: (tabId: string) => void;
}

export const ExecutiveDashboard: React.FC<ExecutiveDashboardProps> = ({
  company,
  dtes = [],
  movements = [],
  bankAccounts = [],
  cashAccounts = [],
  payrolls = [],
  f29,
  productionOrders = [],
  productionBudgets = [],
  costCenters = [],
  medicalLeaves = [],
  vacations = [],
  absenteeismList = [],
  inventoryItems = [],
  deudasFinancieras = [],
  provisionesEgresos = [],
  chequesCartera = [],
  chequesEmitidos = [],
  onNavigateToTab,
}) => {
  // Navigation / View Tabs inside Executive Dashboard
  const [activeView, setActiveView] = useState<
    'OVERVIEW' | 'CASHFLOW_LIQUIDITY' | 'COST_CENTERS' | 'HR_PEOPLE' | 'COMMERCIAL_BUDGETS' | 'PRODUCTION_OTS'
  >('OVERVIEW');

  const [timeHorizon, setTimeHorizon] = useState<'CURRENT_MONTH' | 'LAST_3_MONTHS' | 'ANNUAL'>('CURRENT_MONTH');
  const [selectedCostCenterId, setSelectedCostCenterId] = useState<string | null>(null);
  const [selectedOtFolio, setSelectedOtFolio] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Recalculate metrics dynamically based on real data
  const metrics: ExecutiveDashboardSummary = useMemo(() => {
    return calculateExecutiveDashboardMetrics({
      company,
      dtes,
      movements,
      bankAccounts,
      cashAccounts,
      payrolls,
      f29,
      productionOrders,
      productionBudgets,
      costCenters,
      medicalLeaves,
      vacations,
      absenteeismList,
      inventoryItems,
      deudasFinancieras,
      provisionesEgresos,
      chequesCartera,
      chequesEmitidos,
    });
  }, [
    company,
    dtes,
    movements,
    bankAccounts,
    cashAccounts,
    payrolls,
    f29,
    productionOrders,
    productionBudgets,
    costCenters,
    medicalLeaves,
    vacations,
    absenteeismList,
    inventoryItems,
    deudasFinancieras,
    provisionesEgresos,
    chequesCartera,
    chequesEmitidos,
  ]);


  // Custom tooltips for Recharts
  const formatClpCompact = (val: number) => {
    if (Math.abs(val) >= 1_000_000) {
      return `$${(val / 1_000_000).toFixed(1)}M`;
    }
    if (Math.abs(val) >= 1_000) {
      return `$${(val / 1_000).toFixed(0)}k`;
    }
    return `$${val.toLocaleString('es-CL')}`;
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* ========================================================================= */}
      {/* 1. TOP HEADER & MULTI-AGENT STATUS BAR */}
      {/* ========================================================================= */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-50 text-indigo-700 rounded-lg">
                <LayoutDashboard className="w-5 h-5" />
              </div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                Dashboard Ejecutivo Agéntico
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                  Control Integral 360°
                </span>
              </h1>
            </div>
            <p className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
              <span>Empresa activa: <strong className="text-slate-800 font-semibold">{company.razonSocial}</strong> ({company.rut})</span>
              <span>•</span>
              <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                <ShieldCheck className="w-3.5 h-3.5" />
                Agentes Autónomos Sincronizados
              </span>
              <span>•</span>
              <span>Régimen: <strong className="text-slate-700">{company.regimenTributario === '14D3_PROPYME_GENERAL' ? '14 D3 ProPyme' : '14 A General'}</strong></span>
            </p>
          </div>

          {/* Quick Actions & Time Horizon */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
              <button
                onClick={() => setTimeHorizon('CURRENT_MONTH')}
                className={`px-3 py-1.5 rounded-md font-bold transition-all cursor-pointer ${
                  timeHorizon === 'CURRENT_MONTH' ? 'bg-white text-indigo-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Mes Actual
              </button>
              <button
                onClick={() => setTimeHorizon('LAST_3_MONTHS')}
                className={`px-3 py-1.5 rounded-md font-bold transition-all cursor-pointer ${
                  timeHorizon === 'LAST_3_MONTHS' ? 'bg-white text-indigo-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Trimestral
              </button>
              <button
                onClick={() => setTimeHorizon('ANNUAL')}
                className={`px-3 py-1.5 rounded-md font-bold transition-all cursor-pointer ${
                  timeHorizon === 'ANNUAL' ? 'bg-white text-indigo-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Año Móvil
              </button>
            </div>

            {/* 4.4: se quitó el botón "recalcular" que solo mostraba un giro de 450 ms (las métricas ya se calculan en vivo) */}
          </div>
        </div>

        {/* Navigation View Sub-tabs */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto text-xs font-semibold">
          {[
            { id: 'OVERVIEW', label: 'Resumen 360°', icon: Sparkles },
            { id: 'CASHFLOW_LIQUIDITY', label: 'Flujo de Caja & Liquidez', icon: TrendingUp },
            { id: 'COST_CENTERS', label: 'Margen por Centro de Costo', icon: PieChartIcon },
            { id: 'HR_PEOPLE', label: 'RRHH & Ausentismo Laboral', icon: Users },
            { id: 'COMMERCIAL_BUDGETS', label: 'Presupuestos & Cotizaciones', icon: Target },
            { id: 'PRODUCTION_OTS', label: 'Costos Estimados vs Real (OTs)', icon: Factory },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeView === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveView(tab.id as any)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-xs font-bold'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. TOP STRATEGIC KPI CARDS */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Ratio Corriente & Liquidez */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs hover:border-indigo-200 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Ratio Corriente (Liquidez)
            </span>
            <div
              className={`p-1.5 rounded-lg text-xs font-black ${
                metrics.currentLiquidity.estadoSaludLiquidez === 'OPTIMO'
                  ? 'bg-emerald-50 text-emerald-700'
                  : metrics.currentLiquidity.estadoSaludLiquidez === 'ADECUADO'
                  ? 'bg-blue-50 text-blue-700'
                  : 'bg-amber-50 text-amber-700'
              }`}
            >
              <Scale className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 font-mono">
              {metrics.currentLiquidity.ratioCorriente.toFixed(2)}x
            </span>
            <span
              className={`text-[11px] font-bold ${
                metrics.currentLiquidity.ratioCorriente >= 1.5 ? 'text-emerald-600' : 'text-amber-600'
              }`}
            >
              {metrics.currentLiquidity.ratioCorriente >= 1.5 ? 'Saludable (> 1.5x)' : 'Bajo Observación'}
            </span>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Prueba Ácida: <strong className="text-slate-800 font-mono">{metrics.currentLiquidity.pruebaAcida.toFixed(2)}x</strong></span>
            <span>Runway: <strong className="text-slate-800 font-mono">{metrics.currentLiquidity.diasCoberturaCaja} días</strong></span>
          </div>
        </div>

        {/* KPI 2: Margen de Contribución Global */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs hover:border-indigo-200 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Margen Contribución Global
            </span>
            <div className="p-1.5 bg-blue-50 text-blue-700 rounded-lg">
              <PieChartIcon className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 font-mono">
              {metrics.resumenEjecutivo.margenContribucionGlobalPct.toFixed(1)}%
            </span>
            <span className="text-xs font-bold text-slate-600 font-mono truncate">
              {formatCLP(metrics.resumenEjecutivo.margenContribucionGlobalClp)}
            </span>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Centros evaluados: <strong className="text-slate-800">{costCenters.length}</strong></span>
            <span className="text-emerald-600 font-bold flex items-center gap-0.5">
              <ArrowUpRight className="w-3.5 h-3.5" />
              Sano
            </span>
          </div>
        </div>

        {/* KPI 3: Tasa de Conversión Presupuestos */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs hover:border-indigo-200 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Conversión Cotizaciones (OPs)
            </span>
            <div className="p-1.5 bg-purple-50 text-purple-700 rounded-lg">
              <Target className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 font-mono">
              {metrics.commercialBudgets.tasaConversionVolumenPct.toFixed(1)}%
            </span>
            <span className="text-xs text-slate-500">
              ({metrics.commercialBudgets.aprobadosCount}/{metrics.commercialBudgets.totalPresupuestos} aprobados)
            </span>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Aprobado: <strong className="text-emerald-700 font-mono">{formatCLP(metrics.commercialBudgets.montoTotalAprobado)}</strong></span>
            <span>Margen: <strong className="text-slate-800 font-mono">{metrics.commercialBudgets.margenPromedioAprobadoPct}%</strong></span>
          </div>
        </div>

        {/* KPI 4: Ausentismo Laboral (Días Totales) */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs hover:border-indigo-200 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Ausencias & Licencias (RRHH)
            </span>
            <div className="p-1.5 bg-rose-50 text-rose-700 rounded-lg">
              <HeartPulse className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 font-mono">
              {metrics.hrAbsenceMetrics.totalDiasAusencia} días
            </span>
            <span className="text-xs text-slate-500">
              ({metrics.hrAbsenceMetrics.totalColaboradoresAfectados} colaboradores)
            </span>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>LME: <strong className="text-purple-700 font-mono">{metrics.hrAbsenceMetrics.diasLicenciasMedicas}d</strong></span>
            <span>Vacaciones: <strong className="text-blue-700 font-mono">{metrics.hrAbsenceMetrics.diasVacacionesTomadas}d</strong></span>
            <span>Inasist.: <strong className="text-rose-700 font-mono">{metrics.hrAbsenceMetrics.diasInasistenciasInjustificadas}d</strong></span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. ALERTS & RECOMMENDATIONS STRIP */}
      {/* ========================================================================= */}
      {metrics.alertasEstrategicas.length > 0 && (
        <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-900 uppercase tracking-wide flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              Alertas Estratégicas y Recomendaciones del Agente Supervisor Principal ({metrics.alertasEstrategicas.length})
            </span>
            <span className="text-[11px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-300">
              Prioridad Ejecutiva
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {metrics.alertasEstrategicas.map((alerta) => (
              <div
                key={alerta.id}
                className="bg-white border border-amber-200/80 rounded-lg p-3 shadow-2xs space-y-1 hover:border-amber-300 transition-all text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-900 flex items-center gap-1">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        alerta.nivel === 'CRITICO' ? 'bg-rose-500' : alerta.nivel === 'ALERTA' ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                    />
                    {alerta.titulo}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">
                    {alerta.modulo}
                  </span>
                </div>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  {alerta.descripcion}
                </p>
                <div className="mt-1 pt-1 border-t border-slate-100 text-[11px] text-indigo-700 font-medium flex items-center gap-1">
                  <ArrowRight className="w-3 h-3 text-indigo-500 shrink-0" />
                  <strong>Acción sugerida:</strong> {alerta.accionRecomendada}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. MAIN VISUAL GRAPHS SECTION (SWITCHABLE VIEWS) */}
      {/* ========================================================================= */}

      {/* VIEW: OVERVIEW OR CASHFLOW */}
      {(activeView === 'OVERVIEW' || activeView === 'CASHFLOW_LIQUIDITY') && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Chart 1: Evolución del Flujo de Caja Mensual */}
          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-indigo-600" />
                  Evolución del Flujo de Caja Mensual & Saldo Acumulado
                </h3>
                <p className="text-xs text-slate-500">
                  Ingresos netos por cobranzas vs Egresos operativos y Saldo Disponible arrastrado
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="flex items-center gap-1 text-slate-500">
                  <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 inline-block" /> Ingresos
                </span>
                <span className="flex items-center gap-1 text-slate-500">
                  <span className="w-2.5 h-2.5 rounded-xs bg-rose-500 inline-block" /> Egresos
                </span>
                <span className="flex items-center gap-1 text-slate-500">
                  <span className="w-2.5 h-0.5 bg-indigo-600 inline-block" /> Saldo Acum.
                </span>
              </div>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={metrics.monthlyCashFlow} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="mesNombre" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} />
                  <YAxis
                    yAxisId="left"
                    tickFormatter={formatClpCompact}
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={{ stroke: '#cbd5e1' }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tickFormatter={formatClpCompact}
                    tick={{ fontSize: 11, fill: '#6366f1' }}
                    axisLine={{ stroke: '#cbd5e1' }}
                  />
                  <Tooltip
                    formatter={(val: any, name: any) => [
                      formatCLP(Number(val)),
                      name === 'ingresos' ? 'Ingresos de Caja' : name === 'egresos' ? 'Egresos Totales' : 'Saldo Acumulado',
                    ]}
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                  />
                  <Bar yAxisId="left" dataKey="ingresos" name="ingresos" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={32} />
                  <Bar yAxisId="left" dataKey="egresos" name="egresos" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={32} />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="saldoAcumulado"
                    name="saldoAcumulado"
                    stroke="#4f46e5"
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#4f46e5', strokeWidth: 2, stroke: '#ffffff' }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Saldo disponible consolidado actual: <strong className="text-slate-900 font-mono">{formatCLP(metrics.currentLiquidity.cajaYBancos)}</strong></span>
              {onNavigateToTab && (
                <button
                  onClick={() => onNavigateToTab('cashflow')}
                  className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
                >
                  Abrir Matriz Flujo de Caja
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Chart 2: Estructura de Liquidez (Activo Corriente vs Pasivo Corriente) */}
          <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <Scale className="w-4 h-4 text-emerald-600" />
                Estructura de Liquidez & Cobertura
              </h3>
              <p className="text-xs text-slate-500">
                Desglose analítico de Activo vs Pasivo de Corto Plazo
              </p>
            </div>

            <div className="space-y-3 text-xs">
              {/* Activo Corriente */}
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-3 space-y-1.5">
                <div className="flex items-center justify-between font-bold text-emerald-900">
                  <span>ACTIVO CORRIENTE TOTAL</span>
                  <span className="font-mono text-sm">{formatCLP(metrics.currentLiquidity.totalActivoCorriente)}</span>
                </div>
                <div className="space-y-1 text-[11px] text-emerald-800 pt-1 border-t border-emerald-200/60">
                  <div className="flex justify-between">
                    <span>• Disponible (Bancos & Cajas):</span>
                    <span className="font-mono font-semibold">{formatCLP(metrics.currentLiquidity.cajaYBancos)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>• Cuentas por Cobrar (CxC):</span>
                    <span className="font-mono font-semibold">{formatCLP(metrics.currentLiquidity.cuentasPorCobrar)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>• Inventarios / Stock:</span>
                    <span className="font-mono font-semibold">{formatCLP(metrics.currentLiquidity.inventarioValorizado)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>• Remanente IVA / Crédito Fiscal:</span>
                    <span className="font-mono font-semibold">{formatCLP(metrics.currentLiquidity.creditoFiscalIvaYOtros)}</span>
                  </div>
                </div>
              </div>

              {/* Pasivo Corriente */}
              <div className="bg-rose-50/70 border border-rose-200 rounded-lg p-3 space-y-1.5">
                <div className="flex items-center justify-between font-bold text-rose-900">
                  <span>PASIVO CORRIENTE TOTAL</span>
                  <span className="font-mono text-sm">{formatCLP(metrics.currentLiquidity.totalPasivoCorriente)}</span>
                </div>
                <div className="space-y-1 text-[11px] text-rose-800 pt-1 border-t border-rose-200/60">
                  <div className="flex justify-between">
                    <span>• Cuentas por Pagar (CxP):</span>
                    <span className="font-mono font-semibold">{formatCLP(metrics.currentLiquidity.cuentasPorPagar)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>• Leyes Sociales (Previred):</span>
                    <span className="font-mono font-semibold">{formatCLP(metrics.currentLiquidity.leyesSocialesPrevired)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>• Impuestos por Pagar (F29):</span>
                    <span className="font-mono font-semibold">{formatCLP(metrics.currentLiquidity.impuestosF29PorPagar)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>• Deuda Bancaria & Provisiones:</span>
                    <span className="font-mono font-semibold">
                      {formatCLP(metrics.currentLiquidity.deudaFinancieraCortoPlazo + metrics.currentLiquidity.provisionesCortoPlazo)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Capital de Trabajo */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs font-bold text-slate-800">
                <span>Capital de Trabajo Neto:</span>
                <span className={`font-mono text-sm ${metrics.currentLiquidity.capitalDeTrabajoNeto >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {formatCLP(metrics.currentLiquidity.capitalDeTrabajoNeto)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW: OVERVIEW OR COST_CENTERS */}
      {(activeView === 'OVERVIEW' || activeView === 'COST_CENTERS') && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <PieChartIcon className="w-4 h-4 text-blue-600" />
                Margen de Contribución por Centro de Costo (Mini-Empresas)
              </h3>
              <p className="text-xs text-slate-500">
                Ingresos vs Costos Directos, Margen de Contribución ($ CLP) y Porcentaje de Rentabilidad por Unidad
              </p>
            </div>
            {onNavigateToTab && (
              <button
                onClick={() => onNavigateToTab('cost_centers')}
                className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 cursor-pointer"
              >
                Módulo Centros de Costo
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* Visual Recharts BarChart */}
            <div className="lg:col-span-7 h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.costCenterContributions} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="codigo" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} />
                  <YAxis tickFormatter={formatClpCompact} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} />
                  <Tooltip
                    formatter={(val: any, name: any) => [
                      formatCLP(Number(val)),
                      name === 'ventas' ? 'Ventas Netas' : name === 'costosDirectos' ? 'Costos Directos' : 'Margen Contribución',
                    ]}
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                  />
                  <Bar dataKey="ventas" name="ventas" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="costosDirectos" name="costosDirectos" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="margenContribucion" name="margenContribucion" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Detailed Table / Ranking */}
            <div className="lg:col-span-5 space-y-2 text-xs overflow-y-auto max-h-72 pr-1">
              {metrics.costCenterContributions.map((cc) => (
                <div
                  key={cc.id}
                  onClick={() => setSelectedCostCenterId(cc.id === selectedCostCenterId ? null : cc.id)}
                  className={`p-3 rounded-lg border transition-all cursor-pointer ${
                    selectedCostCenterId === cc.id
                      ? 'bg-blue-50/80 border-blue-300 ring-1 ring-blue-300'
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 truncate max-w-[220px]">
                      {cc.codigo} - {cc.nombre}
                    </span>
                    <span
                      className={`font-black font-mono text-[11px] px-2 py-0.5 rounded-full ${
                        cc.margenPct >= 30
                          ? 'bg-emerald-100 text-emerald-800'
                          : cc.margenPct >= 15
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {cc.margenPct}% Margen
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-slate-500 pt-1.5 border-t border-slate-200/60">
                    <div>
                      <span>Ventas:</span>
                      <p className="font-mono font-bold text-slate-800">{formatCLP(cc.ventas)}</p>
                    </div>
                    <div>
                      <span>Costos Dir.:</span>
                      <p className="font-mono font-bold text-rose-700">{formatCLP(cc.costosDirectos)}</p>
                    </div>
                    <div>
                      <span>Margen $:</span>
                      <p className="font-mono font-bold text-emerald-700">{formatCLP(cc.margenContribucion)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* VIEW: OVERVIEW OR HR_PEOPLE */}
      {(activeView === 'OVERVIEW' || activeView === 'HR_PEOPLE') && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Chart 3: Agente RRHH - Días de Ausencias, Licencias Médicas & Vacaciones */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-600" />
                  Agente RRHH: Días de Ausencias, Licencias Médicas & Vacaciones
                </h3>
                <p className="text-xs text-slate-500">
                  Desglose de días no trabajados por causal legal (LME COMPIN, Feriado Art. 67, Inasistencias Art. 160)
                </p>
              </div>
              {onNavigateToTab && (
                <button
                  onClick={() => onNavigateToTab('hr_agent')}
                  className="text-xs text-purple-600 hover:text-purple-800 font-bold flex items-center gap-1 cursor-pointer"
                >
                  Módulo RRHH
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.hrAbsenceMetrics.chartData} layout="vertical" margin={{ top: 10, right: 30, left: 40, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} />
                  <YAxis dataKey="tipo" type="category" tick={{ fontSize: 10, fill: '#334155' }} width={160} axisLine={{ stroke: '#cbd5e1' }} />
                  <Tooltip
                    formatter={(val: any, name: any, item: any) => [
                      `${val} días (Impacto nómina: ${formatCLP(item?.payload?.costo || 0)})`,
                      'Días de Ausencia',
                    ]}
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                  />
                  <Bar dataKey="dias" name="dias" radius={[0, 4, 4, 0]} maxBarSize={24}>
                    {metrics.hrAbsenceMetrics.chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="pt-3 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
              <div className="p-2 bg-purple-50 rounded-lg">
                <span className="text-[10px] text-purple-700 font-bold block">LICENCIAS (LME)</span>
                <strong className="text-sm font-mono text-purple-900">{metrics.hrAbsenceMetrics.diasLicenciasMedicas} días</strong>
              </div>
              <div className="p-2 bg-blue-50 rounded-lg">
                <span className="text-[10px] text-blue-700 font-bold block">VACACIONES TOMADAS</span>
                <strong className="text-sm font-mono text-blue-900">{metrics.hrAbsenceMetrics.diasVacacionesTomadas} días</strong>
              </div>
              <div className="p-2 bg-rose-50 rounded-lg">
                <span className="text-[10px] text-rose-700 font-bold block">INASISTENCIAS</span>
                <strong className="text-sm font-mono text-rose-900">{metrics.hrAbsenceMetrics.diasInasistenciasInjustificadas} días</strong>
              </div>
              <div className="p-2 bg-emerald-50 rounded-lg">
                <span className="text-[10px] text-emerald-700 font-bold block">PERMISOS LEGALES</span>
                <strong className="text-sm font-mono text-emerald-900">{metrics.hrAbsenceMetrics.diasPermisosLegales} días</strong>
              </div>
            </div>
          </div>

          {/* Legal Compliance & Vacation Excess Alerts */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <HeartPulse className="w-4 h-4 text-rose-600" />
                Fiscalización Laboral DT & Subsidios SIL
              </h3>
              <p className="text-xs text-slate-500">
                Cumplimiento normativo y montos recuperables ante Isapre/Fonasa/Mutual
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
                <div className="flex justify-between items-center text-slate-700">
                  <span>Descuento total en nómina por ausencias:</span>
                  <strong className="font-mono text-rose-700 text-sm">
                    {formatCLP(metrics.hrAbsenceMetrics.descuentoNominaTotal)}
                  </strong>
                </div>
                <div className="flex justify-between items-center text-slate-700">
                  <span>Subsidio SIL recuperable (Compin/Mutual):</span>
                  <strong className="font-mono text-emerald-700 text-sm">
                    {formatCLP(metrics.hrAbsenceMetrics.subsidioSilRecuperable)}
                  </strong>
                </div>
              </div>

              {/* Alerta de Vacaciones Art. 70 */}
              <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-lg space-y-1">
                <div className="flex items-center justify-between font-bold text-amber-900">
                  <span className="flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    Alerta Art. 70 Código del Trabajo
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 text-[10px] font-black">
                    {metrics.hrAbsenceMetrics.empleadosConVacacionesExcesoArt70} Casos
                  </span>
                </div>
                <p className="text-[11px] text-amber-800">
                  Colaboradores con 2 o más períodos de feriado legal acumulados. La ley prohíbe acumular más de dos períodos y sanciona a la empresa con multas graves ante fiscalizaciones de la DT.
                </p>
              </div>

              {/* Alerta Inasistencias Art. 160 N° 3 */}
              <div className="p-3 bg-rose-50/80 border border-rose-200 rounded-lg space-y-1">
                <div className="flex items-center justify-between font-bold text-rose-900">
                  <span className="flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                    Causal de Término Art. 160 N° 3
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-rose-200 text-rose-900 text-[10px] font-black">
                    {metrics.hrAbsenceMetrics.casosInasistenciaRiesgoArt160N3} Casos
                  </span>
                </div>
                <p className="text-[11px] text-rose-800">
                  Inasistencias injustificadas en días lunes o consecutivas con carta de amonestación emitida y copia remitida a la Inspección del Trabajo.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW: OVERVIEW OR COMMERCIAL_BUDGETS */}
      {(activeView === 'OVERVIEW' || activeView === 'COMMERCIAL_BUDGETS') && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <Target className="w-4 h-4 text-emerald-600" />
                Agente Comercial: Presupuestos Enviados vs Aprobados & Pipeline
              </h3>
              <p className="text-xs text-slate-500">
                Evolución de cotizaciones a clientes, tasa de conversión comercial y montos pactados
              </p>
            </div>
            {onNavigateToTab && (
              <button
                onClick={() => onNavigateToTab('production')}
                className="text-xs text-emerald-600 hover:text-emerald-800 font-bold flex items-center gap-1 cursor-pointer"
              >
                Módulo Presupuestos & OTs
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* Chart: BarChart by Status */}
            <div className="lg:col-span-7 h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.commercialBudgets.chartDataByStatus} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="estado" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} />
                  <YAxis tickFormatter={formatClpCompact} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} />
                  <Tooltip
                    formatter={(val: any, name: any, it: any) => [
                      `${formatCLP(Number(val))} (${it?.payload?.cantidad || 0} presupuestos)`,
                      'Monto Total',
                    ]}
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                  />
                  <Bar dataKey="monto" name="monto" radius={[4, 4, 0, 0]} maxBarSize={36}>
                    {metrics.commercialBudgets.chartDataByStatus.map((entry, index) => (
                      <Cell key={`cell-budget-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Pipeline KPI Summary */}
            <div className="lg:col-span-5 space-y-3 text-xs">
              <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-lg flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-emerald-800 font-bold uppercase block">PRESUPUESTOS APROBADOS (OPs)</span>
                  <span className="text-lg font-black text-emerald-950 font-mono">
                    {formatCLP(metrics.commercialBudgets.montoTotalAprobado)}
                  </span>
                </div>
                <span className="text-xs font-bold px-2 py-1 rounded-md bg-emerald-200 text-emerald-900">
                  {metrics.commercialBudgets.aprobadosCount} Cotizaciones
                </span>
              </div>

              <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-lg flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-amber-800 font-bold uppercase block">EN NEGOCIACIÓN (PIPELINE)</span>
                  <span className="text-lg font-black text-amber-950 font-mono">
                    {formatCLP(metrics.commercialBudgets.montoEnNegociacion)}
                  </span>
                </div>
                <span className="text-xs font-bold px-2 py-1 rounded-md bg-amber-200 text-amber-900">
                  {metrics.commercialBudgets.enNegociacionCount} Cotizaciones
                </span>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-slate-700">
                <span>Tasa de Conversión (Monto Ganado):</span>
                <strong className="font-mono text-slate-900 text-sm">
                  {metrics.commercialBudgets.tasaConversionMontoPct}%
                </strong>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-slate-700">
                <span>Margen Bruto Promedio Cotizado:</span>
                <strong className="font-mono text-indigo-700 text-sm">
                  {metrics.commercialBudgets.margenPromedioCotizadoPct}%
                </strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW: OVERVIEW OR PRODUCTION_OTS */}
      {(activeView === 'OVERVIEW' || activeView === 'PRODUCTION_OTS') && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <Factory className="w-4 h-4 text-indigo-600" />
                Agente de Operaciones: Costos Estimados vs Costo Real por Orden de Trabajo (OT)
              </h3>
              <p className="text-xs text-slate-500">
                Varianza analítica de costos de fabricación (MPD + MOD + CIF) y desviación de margen real
              </p>
            </div>
            {onNavigateToTab && (
              <button
                onClick={() => onNavigateToTab('production')}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
              >
                Auditar Órdenes en Detalle
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* Chart: Comparative Bars per OT */}
            <div className="lg:col-span-7 h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.productionCostDeviations} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="folioOp" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} />
                  <YAxis tickFormatter={formatClpCompact} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} />
                  <Tooltip
                    formatter={(val: any, name: any) => [
                      formatCLP(Number(val)),
                      name === 'costoPresupuestado' ? 'Costo Estimado' : 'Costo Real Ejecutado',
                    ]}
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Bar dataKey="costoPresupuestado" name="Costo Estimado (Presupuesto)" fill="#94a3b8" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="costoReal" name="Costo Real de Fabricación" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* OTs Table / Breakdown */}
            <div className="lg:col-span-5 space-y-2 text-xs overflow-y-auto max-h-72 pr-1">
              {metrics.productionCostDeviations.map((ot) => (
                <div
                  key={ot.id}
                  onClick={() => setSelectedOtFolio(ot.folioOp === selectedOtFolio ? null : ot.folioOp)}
                  className={`p-3 rounded-lg border transition-all cursor-pointer ${
                    selectedOtFolio === ot.folioOp
                      ? 'bg-indigo-50/80 border-indigo-300 ring-1 ring-indigo-300'
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-extrabold text-slate-900">{ot.folioOp}</span>
                      <span className="text-[11px] text-slate-500 block truncate max-w-[180px]">
                        {ot.productoNombre} ({ot.clienteNombre})
                      </span>
                    </div>
                    <span
                      className={`font-black font-mono text-[11px] px-2 py-0.5 rounded-full ${
                        ot.varianzaPct > 5
                          ? 'bg-rose-100 text-rose-800'
                          : ot.varianzaPct < -5
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-800'
                      }`}
                    >
                      {ot.varianzaPct > 0 ? `+${ot.varianzaPct}% Desvío` : `${ot.varianzaPct}%`}
                    </span>
                  </div>

                  <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-slate-500 pt-1.5 border-t border-slate-200/60">
                    <div>
                      <span>Estimado:</span>
                      <p className="font-mono font-bold text-slate-700">{formatCLP(ot.costoPresupuestado)}</p>
                    </div>
                    <div>
                      <span>Real:</span>
                      <p className="font-mono font-bold text-indigo-700">{formatCLP(ot.costoReal)}</p>
                    </div>
                    <div>
                      <span>Varianza:</span>
                      <p className={`font-mono font-bold ${ot.varianzaClp > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                        {ot.varianzaClp > 0 ? `+${formatCLP(ot.varianzaClp)}` : formatCLP(ot.varianzaClp)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
