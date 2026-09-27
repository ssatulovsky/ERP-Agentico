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
  ChevronRight,
  Sliders,
  Coins,
  Receipt,
  Settings,
  HelpCircle,
  BarChart3,
  Percent,
  Scale,
  CreditCard,
  Landmark,
  Palette,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  ComposedChart,
  Line,
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
  CashAccountConfig,
  CashFlowHorizonType,
  CashFlowInclusionParameters,
  MonthlyCashFlowPoint,
  EmployeePayroll,
  F29Declaration,
  ProductionBudget,
  ProductionOrder,
  LeaseContract,
  CashFlowCategory,
  CashFlowOriginModule,
  ChequeCartera,
  ChequeEmitido,
  DeudaFinanciera,
  CuotaDeudaFinanciera,
  ProvisionEgreso,
  AccountingEntry,
} from '../types';
import { downloadCashFlowPdf, downloadCashFlowExcel } from '../utils/reportGenerators';
import {
  calculateConsolidatedCashPosition,
  analyzeHistoricalSales,
  buildDailyCashFlowProjection,
  buildAnnualCashFlowProjection,
  scanErpCommitments,
  DEFAULT_CASH_FLOW_INCLUSION_PARAMS,
} from '../utils/cashFlowProjectionEngine';
import { CashFlowAutonomousAgentModal } from './CashFlowAutonomousAgentModal';
import { CashFlowParamsModal } from './CashFlowParamsModal';
import { CashAccountsManagerModal } from './CashAccountsManagerModal';
import { CashFlowSpreadsheetMatrix } from './cashflow/CashFlowSpreadsheetMatrix';
import { ProvisionesEgresosManagerModal } from './cashflow/ProvisionesEgresosManagerModal';

interface CashFlowProjectionsProps {
  movements: CashFlowMovement[];
  onAddMovement: (mov: CashFlowMovement) => void;
  onAddMultipleMovements?: (movs: CashFlowMovement[]) => void;
  onUpdateMovement: (mov: CashFlowMovement) => void;
  dtes: DteDocument[];
  indicators: ChileIndicators;
  company: CompanyProfile;
  bankAccounts?: BankAccountConfig[];
  cashAccounts?: CashAccountConfig[];
  onUpdateCashAccounts?: (accounts: CashAccountConfig[]) => void;
  payrolls?: EmployeePayroll[];
  f29?: F29Declaration;
  productionBudgets?: ProductionBudget[];
  productionOrders?: ProductionOrder[];
  leases?: LeaseContract[];
  chequesCartera?: ChequeCartera[];
  chequesEmitidos?: ChequeEmitido[];
  deudasFinancieras?: DeudaFinanciera[];
  provisionesEgresos?: ProvisionEgreso[];
  onUpdateProvisionesEgresos?: (provisiones: ProvisionEgreso[]) => void;
  onAddEntry?: (entry: AccountingEntry) => void;
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
  cashAccounts = [],
  onUpdateCashAccounts,
  payrolls = [],
  f29,
  productionBudgets = [],
  productionOrders = [],
  leases = [],
  chequesCartera = [],
  chequesEmitidos = [],
  deudasFinancieras = [],
  provisionesEgresos = [],
  onUpdateProvisionesEgresos,
  onAddEntry,
}) => {
  const safeMovements = Array.isArray(movements) ? movements : [];
  const safeDtes = Array.isArray(dtes) ? dtes : [];

  // State
  const [scenario, setScenario] = useState<'BASE' | 'OPTIMISTA' | 'ESTRESADO'>('BASE');
  const [horizon, setHorizon] = useState<CashFlowHorizonType>('60_DIAS');
  const [activeViewTab, setActiveViewTab] = useState<'MATRIZ_EXCEL' | 'INFORME_CONTADOR' | 'CHART' | 'TIMELINE' | 'TABLE' | 'ANNUAL_MATRIX'>('MATRIZ_EXCEL');
  const [expandedPillar, setExpandedPillar] = useState<'ALL' | 'BANCOS' | 'VENTAS' | 'CHEQUES_CARTERA' | 'CHEQUES_EMITIDOS' | 'DEUDA' | 'PROVISIONES'>('ALL');
  const [parameters, setParameters] = useState<CashFlowInclusionParameters>(DEFAULT_CASH_FLOW_INCLUSION_PARAMS);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'INGRESO' | 'EGRESO'>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [originFilter, setOriginFilter] = useState<string>('ALL');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAgentScannerModal, setShowAgentScannerModal] = useState(false);
  const [showParamsModal, setShowParamsModal] = useState(false);
  const [showCashAccountModal, setShowCashAccountModal] = useState(false);
  const [showProvisionesModal, setShowProvisionesModal] = useState(false);

  // Consolidated Cash Position (Bancos + Efectivo/Caja/Fondo Fijo)
  const cashConsolidated = useMemo(() => {
    return calculateConsolidatedCashPosition(bankAccounts, cashAccounts);
  }, [bankAccounts, cashAccounts]);

  // Historical Sales Analysis from RCV
  const historicalSales = useMemo(() => {
    return analyzeHistoricalSales(safeDtes, parameters.tasaCrecimientoVentasPct);
  }, [safeDtes, parameters.tasaCrecimientoVentasPct]);

  // ERP Scanner preview for badge
  const commitmentsPreview = useMemo(() => {
    return scanErpCommitments({
      payrolls,
      f29,
      productionBudgets,
      productionOrders,
      dtes: safeDtes,
      leases,
      cashAccounts,
      chequesCartera,
      chequesEmitidos,
      deudasFinancieras,
      provisionesEgresos,
      existingMovements: safeMovements,
      params: parameters,
    });
  }, [
    payrolls,
    f29,
    productionBudgets,
    productionOrders,
    safeDtes,
    leases,
    cashAccounts,
    chequesCartera,
    chequesEmitidos,
    deudasFinancieras,
    provisionesEgresos,
    safeMovements,
    parameters,
  ]);

  // Movements to project in daily/horizon view based on user parameters
  const effectiveDailyMovements = useMemo(() => {
    const existingRefs = new Set(safeMovements.map(m => m.documentoReferencia || m.id));
    const unpersisted = (commitmentsPreview.projectedMovements || []).filter(
      p => !existingRefs.has(p.documentoReferencia || p.id)
    );
    const all = [...safeMovements, ...unpersisted];

    return all.filter(m => {
      if (!parameters.incluirCobranzaDtePendientes && m.origenModulo === 'DTE_SII' && m.tipo === 'INGRESO') return false;
      if (!parameters.incluirPagoProveedoresDte && m.origenModulo === 'DTE_SII' && m.tipo === 'EGRESO') return false;
      if (!parameters.incluirNominaSueldos && m.categoria === 'REMUNERACIONES') return false;
      if (!parameters.incluirPreviredLeyesSociales && m.categoria === 'PREVIRED_LEYES_SOCIALES') return false;
      if (!parameters.incluirF29Impuestos && m.categoria === 'IMPUESTOS_F29') return false;
      if (!parameters.incluirArriendosIfrs16 && m.categoria === 'ARRIENDOS') return false;
      if (!parameters.incluirHitosProduccion && (m.categoria === 'PRODUCCION_HITO_VENTA' || m.origenModulo === 'PRESUPUESTO_PRODUCCION')) return false;
      if (!parameters.incluirChequesCartera && (m.categoria === 'CHEQUE_CARTERA_COBRO' || m.origenModulo === 'CHEQUES_CARTERA')) return false;
      if (!parameters.incluirChequesEmitidos && (m.categoria === 'CHEQUE_EMITIDO_PAGO' || m.origenModulo === 'CHEQUES_EMITIDOS')) return false;
      if (!parameters.incluirDeudaFinanciera && (m.categoria === 'DEUDA_FINANCIERA_CUOTA' || m.origenModulo === 'DEUDA_FINANCIERA')) return false;
      if (!parameters.incluirProvisionesEgresos && (m.categoria === 'PROVISION_EGRESO' || m.origenModulo === 'PROVISIONES')) return false;
      return true;
    });
  }, [safeMovements, commitmentsPreview.projectedMovements, parameters]);

  // Projections: Daily vs Annual
  const dailyProjection = useMemo(() => {
    return buildDailyCashFlowProjection(
      effectiveDailyMovements,
      cashConsolidated.totalSaldoConsolidado,
      horizon,
      scenario,
      2000000
    );
  }, [
    effectiveDailyMovements,
    cashConsolidated.totalSaldoConsolidado,
    horizon,
    scenario,
  ]);

  const annualProjection = useMemo(() => {
    return buildAnnualCashFlowProjection({
      initialBalance: cashConsolidated.totalSaldoConsolidado,
      historicalSales,
      payrolls,
      f29,
      leases,
      dtes: safeDtes,
      productionBudgets,
      chequesCartera,
      chequesEmitidos,
      deudasFinancieras,
      provisionesEgresos,
      params: parameters,
      scenario,
    });
  }, [
    cashConsolidated.totalSaldoConsolidado,
    historicalSales,
    payrolls,
    f29,
    leases,
    safeDtes,
    productionBudgets,
    chequesCartera,
    chequesEmitidos,
    deudasFinancieras,
    provisionesEgresos,
    parameters,
    scenario,
  ]);

  // Formatters
  const formatCLP = (val?: number) => `$${Math.round(val || 0).toLocaleString('es-CL')}`;
  const formatNumberCL = (val?: number) => Math.round(val || 0).toLocaleString('es-CL');

  // Horizon display label
  const horizonLabel = useMemo(() => {
    switch (horizon) {
      case '15_DIAS':
        return '15 Días (Quincenal)';
      case '30_DIAS':
        return '30 Días';
      case '60_DIAS':
        return '60 Días';
      case '90_DIAS':
        return '90 Días';
      case '1_ANIO':
        return '1 Año (365 Días)';
      case 'MES_COMPLETO':
        return 'Mes Completo';
      case 'PROXIMO_MES':
        return 'Próximo Mes';
      case 'DIA_DEL_MES':
        return 'Día a Día del Mes';
      default:
        return '60 Días';
    }
  }, [horizon]);

  // --- 6 PILARES AUDITADOS PARA EL INFORME DEL CONTADOR ---
  // Pilar 1: Saldo Inicial Bancario y Cajas de Efectivo
  const saldoInicialBancos = cashConsolidated.totalSaldoBancos || 0;
  const saldoInicialCajas = cashConsolidated.totalSaldoEfectivo || 0;
  const saldoInicialTotal = cashConsolidated.totalSaldoConsolidado || 0;

  // Pilar 2: Proyecciones de Ventas (Facturas emitidas pendientes + estimación según historia RCV)
  const pendingSalesDtes = useMemo(() => {
    return safeDtes.filter(d => (d.tipoOperacion === 'VENTA' || d.tipoDte === '33' || d.tipoDte === '34' || d.tipoDte === '39') && d.estadoPago === 'PENDIENTE');
  }, [safeDtes]);

  const totalPendingSalesDtesMonto = useMemo(() => {
    return pendingSalesDtes.reduce((s, d) => s + (d.montoTotal || 0), 0);
  }, [pendingSalesDtes]);

  const horizonMonthsCount = useMemo(() => {
    switch (horizon) {
      case 'DIA_DEL_MES':
      case '30_DIAS':
        return 1;
      case '60_DIAS':
        return 2;
      case '90_DIAS':
        return 3;
      case '1_ANIO':
        return 12;
      default:
        return 2;
    }
  }, [horizon]);

  const projectedNewSalesHorizon = useMemo(() => {
    const monthlyAvg = historicalSales.promedioMensualVentasHistoricas || 25000000;
    const factorCrecimiento = 1 + (parameters.tasaCrecimientoVentasPct || 0) / 100;
    return Math.round(monthlyAvg * factorCrecimiento * horizonMonthsCount);
  }, [historicalSales, parameters.tasaCrecimientoVentasPct, horizonMonthsCount]);

  // Pilar 3: Cheques en Cartera por Cobrar (Custodia)
  const pendingChequesCartera = useMemo(() => {
    return (chequesCartera || []).filter(c => c.estado === 'EN_CARTERA');
  }, [chequesCartera]);

  const totalChequesCarteraMonto = useMemo(() => {
    return pendingChequesCartera.reduce((s, c) => s + (c.monto || 0), 0);
  }, [pendingChequesCartera]);

  // Pilar 4: Cheques Emitidos por Pagar (Diferidos)
  const pendingChequesEmitidos = useMemo(() => {
    return (chequesEmitidos || []).filter(c => c.estado === 'GIRADO_PENDIENTE');
  }, [chequesEmitidos]);

  const totalChequesEmitidosMonto = useMemo(() => {
    return pendingChequesEmitidos.reduce((s, c) => s + (c.monto || 0), 0);
  }, [pendingChequesEmitidos]);

  // Pilar 5: Deudas con Instituciones Financieras (Servicio de Deuda)
  const activeDeudasFinancieras = useMemo(() => {
    return (deudasFinancieras || []).filter(d => d.estado === 'VIGENTE');
  }, [deudasFinancieras]);

  const pendingCuotasDeuda = useMemo(() => {
    const list: { deuda: DeudaFinanciera; cuota: CuotaDeudaFinanciera }[] = [];
    activeDeudasFinancieras.forEach(d => {
      (d.cuotas || []).filter(c => c.estado === 'PENDIENTE').forEach(c => {
        list.push({ deuda: d, cuota: c });
      });
    });
    return list;
  }, [activeDeudasFinancieras]);

  const totalDeudaCuotasMonto = useMemo(() => {
    return pendingCuotasDeuda.reduce((s, item) => s + (item.cuota.montoCuota || 0), 0);
  }, [pendingCuotasDeuda]);

  // Pilar 6: Provisiones de Egresos
  const pendingProvisiones = useMemo(() => {
    return (provisionesEgresos || []).filter(p => p.estado === 'PENDIENTE');
  }, [provisionesEgresos]);

  const totalProvisionesMonto = useMemo(() => {
    return pendingProvisiones.reduce((s, p) => s + (p.montoEstimado || 0), 0);
  }, [pendingProvisiones]);

  // Consolidado para el Informe del Contador
  const totalIngresosContador = useMemo(() => {
    let sum = 0;
    if (parameters.incluirCobranzaDtePendientes) sum += totalPendingSalesDtesMonto;
    if (parameters.incluirVentasProyectadasHistoria) sum += projectedNewSalesHorizon;
    if (parameters.incluirChequesCartera) sum += totalChequesCarteraMonto;
    return sum;
  }, [parameters.incluirCobranzaDtePendientes, totalPendingSalesDtesMonto, parameters.incluirVentasProyectadasHistoria, projectedNewSalesHorizon, parameters.incluirChequesCartera, totalChequesCarteraMonto]);

  const totalEgresosOperativosOrdinarios = useMemo(() => {
    return effectiveDailyMovements
      .filter(m => m.tipo === 'EGRESO' && m.categoria !== 'CHEQUE_EMITIDO_PAGO' && m.categoria !== 'DEUDA_FINANCIERA_CUOTA' && m.categoria !== 'PROVISION_EGRESO')
      .reduce((s, m) => s + (m.montoTotal || 0), 0);
  }, [effectiveDailyMovements]);

  const totalEgresosContador = useMemo(() => {
    return totalEgresosOperativosOrdinarios + 
      (parameters.incluirChequesEmitidos ? totalChequesEmitidosMonto : 0) + 
      (parameters.incluirDeudaFinanciera ? totalDeudaCuotasMonto : 0) + 
      (parameters.incluirProvisionesEgresos ? totalProvisionesMonto : 0);
  }, [totalEgresosOperativosOrdinarios, parameters.incluirChequesEmitidos, totalChequesEmitidosMonto, parameters.incluirDeudaFinanciera, totalDeudaCuotasMonto, parameters.incluirProvisionesEgresos, totalProvisionesMonto]);

  const flujoNetoContador = totalIngresosContador - totalEgresosContador;
  const saldoFinalContador = saldoInicialTotal + flujoNetoContador;

  // Export handlers
  const handleExportExcel = () => {
    downloadCashFlowExcel(safeMovements, company as any, {
      saldoInicialBancos: cashConsolidated.totalSaldoBancos,
      saldoInicialCajas: cashConsolidated.totalSaldoEfectivo,
      saldoInicialTotal: cashConsolidated.totalSaldoConsolidado,
      horizonteLabel: horizonLabel,
      scenario: scenario,
      timeline: horizon === '1_ANIO' ? annualProjection.monthlyPoints : dailyProjection.dailyTimeline,
      monthlyPoints: horizon === '1_ANIO' ? annualProjection.monthlyPoints : undefined,
    });
  };

  const handleExportPdf = () => {
    downloadCashFlowPdf(safeMovements, company as any, {
      saldoInicialBancos: cashConsolidated.totalSaldoBancos,
      saldoInicialCajas: cashConsolidated.totalSaldoEfectivo,
      saldoInicialTotal: cashConsolidated.totalSaldoConsolidado,
      horizonteLabel: horizonLabel,
      scenario: scenario,
      timeline: horizon === '1_ANIO' ? annualProjection.monthlyPoints : dailyProjection.dailyTimeline,
      monthlyPoints: horizon === '1_ANIO' ? annualProjection.monthlyPoints : undefined,
    });
  };

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
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-black text-slate-900 tracking-tight">
                  Flujo de Caja Proyectado Real (Rolling Cash Forecast)
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                  Agente Autónomo de Liquidez
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {horizonLabel}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Integración de Saldos Bancarios + Cajas/Fondos Fijos, Proyección de Ventas RCV, Nómina, Previred, F29, OP y DTEs
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Parametrization Button */}
          <button
            onClick={() => setShowParamsModal(true)}
            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 px-3 py-2 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
            title="Configurar qué partidas entran en la proyección del flujo"
          >
            <Sliders className="w-4 h-4 text-indigo-600" />
            <span>Parametrizar Partidas</span>
          </button>

          {/* ABM Provisiones de Egresos Button (Contables vs Extracontables, IVA 19%) */}
          <button
            onClick={() => setShowProvisionesModal(true)}
            className="flex items-center gap-1.5 bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-300 px-3 py-2 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
            title="Gestor ABM de Provisiones de Egresos (Contables vs. Extracontables, IVA 19% y Partidas No Periódicas)"
          >
            <FileSpreadsheet className="w-4 h-4 text-purple-600" />
            <span>ABM Provisiones ({provisionesEgresos.length})</span>
            <span className="bg-purple-200 text-purple-900 text-[10px] font-black px-1.5 py-0.2 rounded-full">
              IVA 19%
            </span>
          </button>

          {/* Cash accounts manager button */}
          <button
            onClick={() => setShowCashAccountModal(true)}
            className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 px-3 py-2 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
            title="Administrar Cajas, Fondos Fijos y Efectivo"
          >
            <Coins className="w-4 h-4 text-emerald-600" />
            <span>Cajas & Fondos ({cashAccounts.length})</span>
          </button>

          {/* ERP Scanner */}
          <button
            onClick={() => setShowAgentScannerModal(true)}
            className="flex items-center gap-1.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white px-3.5 py-2 rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer"
          >
            <Bot className="w-4 h-4" />
            <span>Escanear ERP</span>
            {commitmentsPreview.projectedMovements.length > 0 && (
              <span className="bg-white text-indigo-700 px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ml-0.5">
                {commitmentsPreview.projectedMovements.length}
              </span>
            )}
          </button>

          {/* Manual Movement */}
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-xs font-bold transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Movimiento</span>
          </button>

          {/* Export Reports & Diseñador Gráfico */}
          <div className="flex items-center gap-1.5 border-l border-slate-200 pl-2">
            <button
              onClick={() => setActiveViewTab('MATRIZ_EXCEL')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-indigo-600 via-indigo-700 to-slate-900 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer border border-indigo-400/40"
              title="Abrir Matriz Diaria y Diseñador Gráfico de Excel"
            >
              <Palette className="w-3.5 h-3.5 text-indigo-200" />
              <span>Diseñador Excel</span>
              <span className="px-1.5 py-0.2 rounded-full bg-emerald-400 text-slate-950 font-black text-[9px] uppercase tracking-wider">
                Diseñar
              </span>
            </button>
            <button
              onClick={handleExportExcel}
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer border border-slate-200"
              title="Exportar Flujo a Excel (incluye desglose de bancos y cajas)"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            </button>
            <button
              onClick={handleExportPdf}
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer border border-slate-200"
              title="Exportar Flujo a PDF Oficial"
            >
              <FileText className="w-4 h-4 text-rose-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Connected Bank Accounts & Cash On Hand Real Baseline */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white rounded-xl p-5 shadow-md border border-slate-700 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-700/80 pb-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shrink-0">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-400 font-bold flex items-center gap-2">
                <span>Saldo Inicial Consolidado (Bancos + Efectivo / Cajas)</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              </div>
              <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-white mt-0.5 flex items-baseline gap-2 flex-wrap">
                <span>{formatCLP(cashConsolidated.totalSaldoConsolidado)}</span>
                <span className="text-xs text-indigo-300 font-sans font-medium">
                  (Bancos: {formatCLP(cashConsolidated.totalSaldoBancos)} | Efectivo: {formatCLP(cashConsolidated.totalSaldoEfectivo)})
                </span>
              </div>
            </div>
          </div>

          {/* Quick Bank & Cash Account Pills */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Bank pills */}
            {(cashConsolidated.cuentasBancos || cashConsolidated.cuentasBancarias || []).map((c) => (
              <div
                key={c.id}
                className="bg-slate-800/90 hover:bg-slate-800 border border-slate-700 px-2.5 py-1.5 rounded-lg text-xs space-y-0.5"
              >
                <div className="flex items-center justify-between gap-2 text-[10px] text-slate-400">
                  <span className="font-semibold text-slate-200">{c.banco}</span>
                  <span className="font-mono text-slate-400">Cta {c.numero}</span>
                </div>
                <div className="font-mono font-bold text-white text-xs">
                  {formatCLP(c.saldo)}
                </div>
              </div>
            ))}

            {/* Cash account pills */}
            {(cashConsolidated.cuentasEfectivo || []).map((c) => (
              <div
                key={c.id}
                className="bg-emerald-950/80 hover:bg-emerald-950 border border-emerald-600/50 px-2.5 py-1.5 rounded-lg text-xs space-y-0.5 cursor-pointer"
                onClick={() => setShowCashAccountModal(true)}
                title="Haga clic para editar saldo o custodio"
              >
                <div className="flex items-center justify-between gap-2 text-[10px] text-emerald-300">
                  <span className="font-semibold">{c.nombre}</span>
                  <span className="text-[9px] uppercase font-mono">{c.tipo.replace('_', ' ')}</span>
                </div>
                <div className="font-mono font-bold text-emerald-200 text-xs">
                  {formatCLP(c.saldo ?? (c as any).saldoInicial)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Rolling Forecast Indicators depending on Horizon */}
        {horizon === '1_ANIO' ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1 text-xs">
            <div>
              <span className="text-slate-400 block text-[11px]">Ingresos Proyectados 12 Meses</span>
              <span className="font-mono text-emerald-400 font-bold text-base block mt-0.5">
                +{formatCLP(annualProjection.totalIngresos12m)}
              </span>
            </div>

            <div>
              <span className="text-slate-400 block text-[11px]">Egresos Comprometidos 12 Meses</span>
              <span className="font-mono text-rose-400 font-bold text-base block mt-0.5">
                -{formatCLP(annualProjection.totalEgresos12m)}
              </span>
            </div>

            <div>
              <span className="text-slate-400 block text-[11px]">Flujo Neto 12 Meses</span>
              <span
                className={`font-mono font-bold text-base block mt-0.5 ${
                  annualProjection.flujoNeto12m < 0 ? 'text-rose-400' : 'text-emerald-400'
                }`}
              >
                {annualProjection.flujoNeto12m >= 0 ? '+' : ''}
                {formatCLP(annualProjection.flujoNeto12m)}
              </span>
              <span className="text-[10px] text-slate-400">
                Mínimo: {formatCLP(annualProjection.minimoSaldo12m)}
              </span>
            </div>

            <div>
              <span className="text-slate-400 block text-[11px]">Saldo Proyectado al Cierre de 1 Año</span>
              <span
                className={`font-mono font-bold text-base block mt-0.5 ${
                  annualProjection.saldoFinal12m < 0 ? 'text-rose-400' : 'text-white'
                }`}
              >
                {formatCLP(annualProjection.saldoFinal12m)}
              </span>
              <span className="text-[10px] text-indigo-300">
                {annualProjection.quiebresDeCajaDetectados > 0
                  ? `⚠️ ${annualProjection.quiebresDeCajaDetectados} quiebre(s) detectados`
                  : '✓ Posición superavitaria'}
              </span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1 text-xs">
            <div>
              <span className="text-slate-400 block text-[11px]">Ingresos Proyectados ({horizonLabel})</span>
              <span className="font-mono text-emerald-400 font-bold text-base block mt-0.5">
                +{formatCLP(dailyProjection.totalIngresosPeriodo)}
              </span>
            </div>

            <div>
              <span className="text-slate-400 block text-[11px]">Egresos Comprometidos ({horizonLabel})</span>
              <span className="font-mono text-rose-400 font-bold text-base block mt-0.5">
                -{formatCLP(dailyProjection.totalEgresosPeriodo)}
              </span>
            </div>

            <div>
              <span className="text-slate-400 block text-[11px]">Saldo Mínimo Previsto</span>
              <span
                className={`font-mono font-bold text-base block mt-0.5 ${
                  dailyProjection.saldoMinimo < 0 ? 'text-rose-400' : 'text-indigo-300'
                }`}
              >
                {formatCLP(dailyProjection.saldoMinimo)}
              </span>
              <span className="text-[10px] text-slate-400">el {dailyProjection.fechaSaldoMinimo}</span>
            </div>

            <div>
              <span className="text-slate-400 block text-[11px]">Saldo Proyectado al Cierre</span>
              <span
                className={`font-mono font-bold text-base block mt-0.5 ${
                  dailyProjection.saldoFinalProyectado < 0 ? 'text-rose-400' : 'text-white'
                }`}
              >
                {formatCLP(dailyProjection.saldoFinalProyectado)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Historical Sales Analysis Banner */}
      {parameters.incluirVentasProyectadasHistoria && historicalSales.totalFacturadoPeriodo > 0 && (
        <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-700 shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-sm">
                  Proyección de Ventas en base a Historia del Registro de Ventas (RCV)
                </span>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-200 text-emerald-800">
                  Activa (+{parameters.tasaCrecimientoVentasPct}% crecimiento)
                </span>
              </div>
              <p className="text-slate-600 text-[11px] mt-0.5">
                Basado en {historicalSales.cantidadDtesAnalizados} facturas emitidas en los últimos 12 meses. Promedio mensual histórico:{' '}
                <strong className="font-mono text-emerald-900">{formatCLP(historicalSales.promedioMensualVentas)}</strong>.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 border-t sm:border-t-0 pt-2 sm:pt-0 border-emerald-200 text-right">
            <div>
              <span className="text-[10px] uppercase text-slate-500 block">Venta Mensual Proyectada</span>
              <span className="font-mono font-bold text-emerald-800 text-sm">
                {formatCLP(historicalSales.proyeccionMensualAjustada)} / mes
              </span>
            </div>
            <button
              onClick={() => setShowParamsModal(true)}
              className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 underline cursor-pointer"
            >
              Ajustar %
            </button>
          </div>
        </div>
      )}

      {/* Liquidity Crisis / Overdraft Alert Banner */}
      {dailyProjection.alert && horizon !== '1_ANIO' && (
        <div
          className={`p-5 rounded-xl border transition-all ${
            dailyProjection.alert.nivelGravedad === 'CRITICO'
              ? 'bg-rose-950/90 border-rose-500/80 text-rose-100 shadow-lg shadow-rose-950/40'
              : dailyProjection.alert.nivelGravedad === 'ALERTA'
              ? 'bg-amber-950/80 border-amber-500/70 text-amber-100 shadow-md'
              : 'bg-indigo-950/80 border-indigo-500/60 text-indigo-100 shadow-sm'
          }`}
        >
          <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div
                className={`p-2 rounded-lg shrink-0 ${
                  dailyProjection.alert.nivelGravedad === 'CRITICO'
                    ? 'bg-rose-600 text-white'
                    : 'bg-amber-600 text-white'
                }`}
              >
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm sm:text-base">
                    {dailyProjection.alert.deficitMaximo > 0
                      ? `¡Alerta de Quiebre de Caja Previsto para el ${dailyProjection.alert.fechaQuiebre}!`
                      : `Precaución: Saldo Proyectado cercano al límite de seguridad operacional`}
                  </h4>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                      dailyProjection.alert.nivelGravedad === 'CRITICO'
                        ? 'bg-rose-500 text-white'
                        : 'bg-amber-500 text-black'
                    }`}
                  >
                    En {dailyProjection.alert.diasParaQuiebre} días
                  </span>
                </div>

                <p className="text-xs opacity-90">
                  {dailyProjection.alert.deficitMaximo > 0 ? (
                    <>
                      El saldo consolidado en bancos y cajas caerá bajo la línea de flotación a un déficit de{' '}
                      <strong className="font-mono underline">
                        -{formatCLP(dailyProjection.alert.deficitMaximo)}
                      </strong>{' '}
                      debido a la concurrencia de pagos sin cobranzas previas compensatorias.
                    </>
                  ) : (
                    'El saldo proyectado descenderá por debajo del colchón de seguridad operacional de $2.000.000 CLP.'
                  )}
                </p>

                {/* Root Causes */}
                <div className="pt-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider block opacity-75">
                    Principales compromisos que presionan la liquidez:
                  </span>
                  <ul className="list-disc list-inside text-xs space-y-0.5 mt-1 opacity-90">
                    {(dailyProjection.alert.causasPrincipales || []).map((c, i) => (
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
                {(dailyProjection.alert.accionesRecomendadas || []).slice(0, 2).map((rec, i) => (
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
          <div className="flex flex-wrap items-center gap-1 bg-slate-200/80 p-1 rounded-lg">
            <button
              onClick={() => setActiveViewTab('MATRIZ_EXCEL')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeViewTab === 'MATRIZ_EXCEL'
                  ? 'bg-amber-500 text-slate-950 shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-slate-950" />
              <span>Matriz Diaria Estilo Excel ({horizonLabel})</span>
              <span className="text-[10px] bg-slate-900 text-amber-300 font-black px-1.5 py-0.2 rounded-full">
                Planilla
              </span>
            </button>

            <button
              onClick={() => setActiveViewTab('INFORME_CONTADOR')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeViewTab === 'INFORME_CONTADOR'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Proyección Contador (6 Pilares)</span>
              <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
                activeViewTab === 'INFORME_CONTADOR' ? 'bg-white text-blue-700' : 'bg-blue-100 text-blue-700'
              }`}>
                Auditor
              </span>
            </button>

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
              <span>{horizon === '1_ANIO' ? 'Evolución 12 Meses' : 'Calendario Diario'}</span>
            </button>

            {horizon === '1_ANIO' && (
              <button
                onClick={() => setActiveViewTab('ANNUAL_MATRIX')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeViewTab === 'ANNUAL_MATRIX'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5 text-purple-600" />
                <span>Matriz Anual (12M)</span>
              </button>
            )}

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

          {/* Scenario & Horizon Selectors (Visibles en Vistas Gráficas, Contador y Libro de Movimientos; en la Matriz Excel residen en la barra superior de la matriz) */}
          {activeViewTab !== 'MATRIZ_EXCEL' && (
            <div className="flex flex-wrap items-center gap-3">
              {/* Horizon Selector */}
              <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-lg p-1 text-xs">
                <span className="text-slate-400 text-[11px] px-1 font-semibold">Horizonte:</span>
                <button
                  onClick={() => setHorizon('30_DIAS')}
                  className={`px-2 py-0.5 rounded text-xs font-bold transition-colors cursor-pointer ${
                    horizon === '30_DIAS' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Proyección de 30 días corridos día por día"
                >
                  30 Días
                </button>
                <button
                  onClick={() => setHorizon('60_DIAS')}
                  className={`px-2 py-0.5 rounded text-xs font-bold transition-colors cursor-pointer ${
                    horizon === '60_DIAS' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Proyección de 60 días corridos día por día"
                >
                  60 Días
                </button>
                <button
                  onClick={() => setHorizon('90_DIAS')}
                  className={`px-2 py-0.5 rounded text-xs font-bold transition-colors cursor-pointer ${
                    horizon === '90_DIAS' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Proyección de 90 días con apertura y detalle diario"
                >
                  90 Días
                </button>
                <button
                  onClick={() => setHorizon('1_ANIO')}
                  className={`px-2 py-0.5 rounded text-xs font-bold transition-colors cursor-pointer ${
                    horizon === '1_ANIO' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Proyección Anual completa de 12 meses / 365 días"
                >
                  1 Año (12M)
                </button>
                <span className="text-slate-300 mx-0.5">|</span>
                <button
                  onClick={() => setHorizon('MES_COMPLETO')}
                  className={`px-2 py-0.5 rounded text-xs font-bold transition-colors cursor-pointer ${
                    horizon === 'MES_COMPLETO' || horizon === 'DIA_DEL_MES'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Desde el día 1 hasta fin del mes calendario actual"
                >
                  Mes Completo
                </button>
                <button
                  onClick={() => setHorizon('15_DIAS')}
                  className={`px-2 py-0.5 rounded text-xs font-bold transition-colors cursor-pointer ${
                    horizon === '15_DIAS' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Quincenal (15 días corridos)"
                >
                  15 Días
                </button>
                <button
                  onClick={() => setHorizon('PROXIMO_MES')}
                  className={`px-2 py-0.5 rounded text-xs font-bold transition-colors cursor-pointer ${
                    horizon === 'PROXIMO_MES' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Mes siguiente completo día por día"
                >
                  Próximo Mes
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
          )}
        </div>

        {/* View 0: Matriz Diaria Estilo Excel (Planilla Financiera con Freeze Header) */}
        {activeViewTab === 'MATRIZ_EXCEL' && (
          <div className="p-5">
            <CashFlowSpreadsheetMatrix
              movements={effectiveDailyMovements}
              onUpdateMovement={onUpdateMovement}
              onAddMovement={onAddMovement}
              dtes={safeDtes}
              indicators={indicators}
              company={company}
              initialBalance={cashConsolidated.totalSaldoConsolidado}
              bankAccounts={bankAccounts}
              cashAccounts={cashAccounts}
              payrolls={payrolls}
              f29={f29}
              chequesCartera={chequesCartera}
              chequesEmitidos={chequesEmitidos}
              deudasFinancieras={deudasFinancieras}
              provisionesEgresos={provisionesEgresos}
              leases={leases}
              parameters={parameters}
              onOpenParamsModal={() => setShowParamsModal(true)}
              onOpenProvisionesModal={() => setShowProvisionesModal(true)}
              scenario={scenario}
              onScenarioChange={setScenario}
              horizon={horizon as any}
              onHorizonChange={(newH) => {
                setHorizon(newH as any);
              }}
            />
          </div>
        )}

        {/* View 1: Chart (Annual vs Daily) */}
        {activeViewTab === 'CHART' && (
          <div className="p-5 space-y-6">
            <div className="h-84 w-full">
              {horizon === '1_ANIO' ? (
                /* Annual Chart: 12 Months Composed Chart */
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={annualProjection.monthlyPoints}
                    margin={{ top: 15, right: 20, left: 15, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="mesLabel"
                      stroke="#64748b"
                      fontSize={11}
                    />
                    <YAxis
                      stroke="#64748b"
                      fontSize={11}
                      tickFormatter={(v) => `$${(v / 1000000).toFixed(1)}M`}
                    />
                    <Tooltip
                      formatter={(value: any, name: string) => [
                        formatCLP(Number(value)),
                        name === 'saldoFinal'
                          ? 'Saldo Proyectado al Cierre del Mes'
                          : name === 'totalIngresos'
                          ? 'Ingresos Totales del Mes'
                          : 'Egresos Comprometidos del Mes',
                      ]}
                      labelFormatter={(label) => `Mes: ${label}`}
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        borderColor: '#cbd5e1',
                        borderRadius: '8px',
                        fontSize: '12px',
                        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                    <ReferenceLine
                      y={0}
                      stroke="#e11d48"
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                      label={{ value: 'Línea de Flotación ($0)', fill: '#e11d48', fontSize: 10, position: 'insideBottomLeft' }}
                    />
                    <Bar
                      dataKey="totalIngresos"
                      name="totalIngresos"
                      fill="#10b981"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="totalEgresos"
                      name="totalEgresos"
                      fill="#f43f5e"
                      radius={[4, 4, 0, 0]}
                    />
                    <Line
                      type="monotone"
                      dataKey="saldoFinal"
                      name="saldoFinal"
                      stroke="#4f46e5"
                      strokeWidth={3}
                      dot={{ r: 4, fill: '#4f46e5' }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                /* Daily Area Chart */
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={dailyProjection.dailyTimeline}
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
                          ? 'Saldo Proyectado en Bancos y Cajas'
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
                    <ReferenceLine
                      y={0}
                      stroke="#e11d48"
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                      label={{ value: 'Línea de Flotación ($0)', fill: '#e11d48', fontSize: 10, position: 'insideBottomLeft' }}
                    />
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
              )}
            </div>

            {/* Summary Cards: Weekly (if daily) or 12-Month Cards (if annual) */}
            <div className="border-t border-slate-200 pt-5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                {horizon === '1_ANIO'
                  ? 'Proyección Mensual Resumida (Próximos 12 Meses)'
                  : 'Resumen Semanal de Tesorería (Time-Bucketing Proyectado)'}
              </h4>

              {horizon === '1_ANIO' ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                  {(annualProjection?.monthlyPoints || []).map((m, i) => (
                    <div
                      key={i}
                      className={`p-3 rounded-xl border transition-all text-xs space-y-1.5 ${
                        m.estaEnDeficit
                          ? 'bg-rose-50 border-rose-300'
                          : 'bg-slate-50 border-slate-200 hover:border-indigo-300'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-slate-800">{m.mesLabel}</span>
                        <span className="text-[10px] text-slate-500 font-mono">{m.mesAnio || m.periodo}</span>
                      </div>

                      <div className="font-mono font-black text-sm">
                        <span className={m.saldoFinal < 0 ? 'text-rose-600' : 'text-slate-900'}>
                          {formatCLP(m.saldoFinal)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-200/60 font-mono">
                        <span className="text-emerald-700">+{formatNumberCL(m.totalIngresos ?? m.ingresosTotales)}</span>
                        <span className="text-rose-700">-{formatNumberCL(m.totalEgresos ?? m.egresosTotales)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                  {(dailyProjection?.weeklyTimeline || []).slice(0, 6).map((w, i) => (
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
              )}
            </div>
          </div>
        )}

        {/* View 2: Timeline (Daily Calendar or Monthly Cards) */}
        {activeViewTab === 'TIMELINE' && (
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm text-slate-900">
                  {horizon === '1_ANIO'
                    ? 'Evolución Mensual & Apertura de Compromisos (12 Meses)'
                    : 'Calendario Diario de Liquidez & Compromisos Clave'}
                </h4>
                <p className="text-xs text-slate-500">
                  {horizon === '1_ANIO'
                    ? 'Desglose mes a mes de ingresos proyectados, nóminas, leyes sociales, F29, arriendos y compras'
                    : 'Visualización detallada de los días con movimientos, hitos tributarios y balance de cierre'}
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

            {horizon === '1_ANIO' ? (
              /* Annual Monthly Timeline Breakdown */
              <div className="max-h-[550px] overflow-y-auto space-y-3 pr-1">
                {(annualProjection?.monthlyPoints || []).map((m, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                      m.estaEnDeficit
                        ? 'bg-rose-50/80 border-rose-300'
                        : 'bg-white border-slate-200 hover:border-indigo-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="text-center p-2.5 rounded-lg bg-slate-100 border border-slate-200 shrink-0 min-w-[70px]">
                        <span className="text-xs font-black text-slate-900 font-mono block leading-none">
                          {m.mesLabel.substring(0, 3).toUpperCase()}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono block mt-1">
                          {m.mesAnio || m.periodo}
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900">{m.mesLabel}</span>
                          {m.estaEnDeficit && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-600 text-white">
                              QUIEBRE DE CAJA
                            </span>
                          )}
                          <span className="text-xs text-slate-500">
                            Saldo Inicial: <strong className="font-mono text-slate-800">{formatCLP(m.saldoInicial)}</strong>
                          </span>
                        </div>

                        {/* Breakdown pills */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-[11px] pt-1">
                          <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-1 rounded">
                            <span className="block text-[9px] uppercase font-bold text-emerald-600">Ventas RCV</span>
                            <span className="font-mono font-bold">+{formatCLP(m.ventasHistoria)}</span>
                          </div>
                          <div className="bg-blue-50 text-blue-800 border border-blue-200 px-2 py-1 rounded">
                            <span className="block text-[9px] uppercase font-bold text-blue-600">Cobranza DTE</span>
                            <span className="font-mono font-bold">+{formatCLP(m.cobranzasDte)}</span>
                          </div>
                          {(m.chequesCartera || 0) > 0 && (
                            <div className="bg-teal-50 text-teal-800 border border-teal-200 px-2 py-1 rounded">
                              <span className="block text-[9px] uppercase font-bold text-teal-600">Cheques Cartera</span>
                              <span className="font-mono font-bold">+{formatCLP(m.chequesCartera)}</span>
                            </div>
                          )}
                          <div className="bg-rose-50 text-rose-800 border border-rose-200 px-2 py-1 rounded">
                            <span className="block text-[9px] uppercase font-bold text-rose-600">Nómina & Previred</span>
                            <span className="font-mono font-bold">-{formatCLP(m.nominaSueldos + m.previredLeyesSociales)}</span>
                          </div>
                          <div className="bg-purple-50 text-purple-800 border border-purple-200 px-2 py-1 rounded">
                            <span className="block text-[9px] uppercase font-bold text-purple-600">F29 Impuestos</span>
                            <span className="font-mono font-bold">-{formatCLP(m.f29Impuestos)}</span>
                          </div>
                          {(m.chequesEmitidos || 0) > 0 && (
                            <div className="bg-amber-50 text-amber-800 border border-amber-200 px-2 py-1 rounded">
                              <span className="block text-[9px] uppercase font-bold text-amber-600">Cheques Emitidos</span>
                              <span className="font-mono font-bold">-{formatCLP(m.chequesEmitidos)}</span>
                            </div>
                          )}
                          {(m.deudaFinanciera || 0) > 0 && (
                            <div className="bg-orange-50 text-orange-800 border border-orange-200 px-2 py-1 rounded">
                              <span className="block text-[9px] uppercase font-bold text-orange-600">Deuda Bancaria</span>
                              <span className="font-mono font-bold">-{formatCLP(m.deudaFinanciera)}</span>
                            </div>
                          )}
                          {(m.provisionesEgresos || 0) > 0 && (
                            <div className="bg-slate-50 text-slate-800 border border-slate-200 px-2 py-1 rounded">
                              <span className="block text-[9px] uppercase font-bold text-slate-600">Provisiones</span>
                              <span className="font-mono font-bold">-{formatCLP(m.provisionesEgresos)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Final Balance */}
                    <div className="text-right shrink-0 border-t md:border-t-0 pt-2 md:pt-0 border-slate-100">
                      <span className="text-[10px] text-slate-500 block uppercase">Saldo al Cierre del Mes</span>
                      <span
                        className={`font-mono font-black text-base block ${
                          m.saldoFinal < 0 ? 'text-rose-600' : 'text-indigo-900'
                        }`}
                      >
                        {formatCLP(m.saldoFinal)}
                      </span>
                      <span className={`text-[10px] font-mono ${m.flujoNeto >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        Flujo Neto: {m.flujoNeto >= 0 ? '+' : ''}{formatCLP(m.flujoNeto)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Daily Timeline */
              <div className="max-h-[500px] overflow-y-auto space-y-2.5 pr-1 divide-y divide-slate-100">
                {(dailyProjection?.dailyTimeline || [])
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
                              {(day.eventosClave || []).map((ev, k) => (
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
            )}
          </div>
        )}

        {/* View 3: Annual 12-Month Matrix View */}
        {activeViewTab === 'ANNUAL_MATRIX' && horizon === '1_ANIO' && (
          <div className="p-5 space-y-4">
            <div>
              <h4 className="font-bold text-sm text-slate-900">
                Matriz Consolidada de Flujo de Caja a 1 Año (12 Meses)
              </h4>
              <p className="text-xs text-slate-500">
                Desglose analítico de todas las partidas de ingresos, egresos y evolución de liquidez proyectada
              </p>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 uppercase text-[10px] tracking-wider">
                    <th className="p-3 font-bold sticky left-0 bg-slate-100">Mes / Período</th>
                    <th className="p-3 font-bold text-right">Saldo Inicial</th>
                    <th className="p-3 font-bold text-right text-emerald-800">Ventas RCV</th>
                    <th className="p-3 font-bold text-right text-emerald-800">Cobranza DTE</th>
                    <th className="p-3 font-bold text-right text-emerald-800">Cheques Cartera</th>
                    <th className="p-3 font-bold text-right text-emerald-900 bg-emerald-50/80">Total Ingresos</th>
                    <th className="p-3 font-bold text-right text-rose-800">Nómina</th>
                    <th className="p-3 font-bold text-right text-rose-800">Previred</th>
                    <th className="p-3 font-bold text-right text-rose-800">F29 Impuestos</th>
                    <th className="p-3 font-bold text-right text-rose-800">Proveedores</th>
                    <th className="p-3 font-bold text-right text-rose-800">Arriendos</th>
                    <th className="p-3 font-bold text-right text-rose-800">Cheques Emitidos</th>
                    <th className="p-3 font-bold text-right text-rose-800">Deuda Bancaria</th>
                    <th className="p-3 font-bold text-right text-rose-800">Provisiones</th>
                    <th className="p-3 font-bold text-right text-rose-900 bg-rose-50/80">Total Egresos</th>
                    <th className="p-3 font-bold text-right">Flujo Neto</th>
                    <th className="p-3 font-bold text-right">Saldo Final</th>
                    <th className="p-3 font-bold text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {(annualProjection?.monthlyPoints || []).map((row, idx) => (
                    <tr
                      key={idx}
                      className={`hover:bg-slate-50/80 ${row.estaEnDeficit ? 'bg-rose-50/50' : ''}`}
                    >
                      <td className="p-3 font-bold text-slate-900 font-sans sticky left-0 bg-white">
                        {row.mesLabel}
                      </td>
                      <td className="p-3 text-right text-slate-700">{formatCLP(row.saldoInicial)}</td>
                      <td className="p-3 text-right text-emerald-700 font-medium">+{formatCLP(row.ventasHistoria)}</td>
                      <td className="p-3 text-right text-emerald-700 font-medium">+{formatCLP(row.cobranzasDte)}</td>
                      <td className="p-3 text-right text-emerald-700 font-medium">+{formatCLP(row.chequesCartera || 0)}</td>
                      <td className="p-3 text-right text-emerald-900 font-bold bg-emerald-50/40">
                        +{formatCLP(row.totalIngresos)}
                      </td>
                      <td className="p-3 text-right text-rose-700">-{formatCLP(row.nominaSueldos)}</td>
                      <td className="p-3 text-right text-rose-700">-{formatCLP(row.previredLeyesSociales)}</td>
                      <td className="p-3 text-right text-rose-700">-{formatCLP(row.f29Impuestos)}</td>
                      <td className="p-3 text-right text-rose-700">-{formatCLP(row.pagoProveedores)}</td>
                      <td className="p-3 text-right text-rose-700">-{formatCLP(row.arriendos)}</td>
                      <td className="p-3 text-right text-rose-700">-{formatCLP(row.chequesEmitidos || 0)}</td>
                      <td className="p-3 text-right text-rose-700">-{formatCLP(row.deudaFinanciera || 0)}</td>
                      <td className="p-3 text-right text-rose-700">-{formatCLP(row.provisionesEgresos || 0)}</td>
                      <td className="p-3 text-right text-rose-900 font-bold bg-rose-50/40">
                        -{formatCLP(row.totalEgresos)}
                      </td>
                      <td
                        className={`p-3 text-right font-bold ${
                          row.flujoNeto >= 0 ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {row.flujoNeto >= 0 ? '+' : ''}{formatCLP(row.flujoNeto)}
                      </td>
                      <td
                        className={`p-3 text-right font-black ${
                          row.saldoFinal < 0 ? 'text-rose-600' : 'text-indigo-900'
                        }`}
                      >
                        {formatCLP(row.saldoFinal)}
                      </td>
                      <td className="p-3 text-center">
                        {row.estaEnDeficit ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-600 text-white font-sans">
                            DÉFICIT
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 font-sans">
                            SUPERÁVIT
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* View: Informe del Contador / Auditor (6 Pilares Requeridos) */}
        {activeViewTab === 'INFORME_CONTADOR' && (
          <div className="p-5 space-y-6">
            {/* Header del Informe */}
            <div className="bg-gradient-to-r from-blue-900 via-slate-900 to-indigo-950 rounded-xl p-5 text-white shadow-md">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="bg-blue-500/30 text-blue-200 border border-blue-400/40 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full">
                      Informe Auditor Financiero
                    </span>
                    <span className="text-slate-400 text-xs">|</span>
                    <span className="text-xs text-blue-200 font-medium">
                      Horizonte: <span className="font-bold text-white">{horizonLabel}</span>
                    </span>
                    <span className="text-slate-400 text-xs">|</span>
                    <span className="text-xs text-blue-200 font-medium">
                      Escenario: <span className="font-bold text-white">{scenario}</span>
                    </span>
                  </div>
                  <h3 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-blue-400" />
                    Proyección de Flujo de Caja & Posición de Liquidez
                  </h3>
                  <p className="text-xs text-slate-300 mt-1 max-w-3xl">
                    Estructura contable solicitada por el Contador que integra los 6 pilares de liquidez: 
                    <strong className="text-white"> (1) Saldo Inicial Bancos/Cajas</strong>, 
                    <strong className="text-white"> (2) Proyecciones de Ventas RCV</strong>, 
                    <strong className="text-white"> (3) Cheques en Cartera (Cobro)</strong>, 
                    <strong className="text-white"> (4) Cheques Emitidos (Pago)</strong>, 
                    <strong className="text-white"> (5) Deudas con Instituciones Financieras</strong> y 
                    <strong className="text-white"> (6) Provisiones de Egresos</strong>.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleExportExcel}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Excel</span>
                  </button>
                  <button
                    onClick={handleExportPdf}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>PDF</span>
                  </button>
                  <button
                    onClick={() => setShowParamsModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition-all border border-white/20 cursor-pointer"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Ajustar Parámetros</span>
                  </button>
                </div>
              </div>

              {/* Quick Pillar Filter Buttons */}
              <div className="mt-4 pt-3 border-t border-slate-700/60 flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-slate-400 text-[11px] font-semibold mr-1">Filtrar Vista:</span>
                <button
                  onClick={() => setExpandedPillar('ALL')}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                    expandedPillar === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'bg-slate-800/80 text-slate-300 hover:text-white'
                  }`}
                >
                  Ver los 6 Pilares
                </button>
                <button
                  onClick={() => setExpandedPillar('BANCOS')}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                    expandedPillar === 'BANCOS' ? 'bg-blue-500 text-white' : 'bg-slate-800/80 text-slate-300 hover:text-white'
                  }`}
                >
                  1. Bancos y Cajas
                </button>
                <button
                  onClick={() => setExpandedPillar('VENTAS')}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                    expandedPillar === 'VENTAS' ? 'bg-emerald-500 text-white' : 'bg-slate-800/80 text-slate-300 hover:text-white'
                  }`}
                >
                  2. Proyección Ventas
                </button>
                <button
                  onClick={() => setExpandedPillar('CHEQUES_CARTERA')}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                    expandedPillar === 'CHEQUES_CARTERA' ? 'bg-teal-500 text-white' : 'bg-slate-800/80 text-slate-300 hover:text-white'
                  }`}
                >
                  3. Cheques Cartera ({pendingChequesCartera.length})
                </button>
                <button
                  onClick={() => setExpandedPillar('CHEQUES_EMITIDOS')}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                    expandedPillar === 'CHEQUES_EMITIDOS' ? 'bg-amber-500 text-white' : 'bg-slate-800/80 text-slate-300 hover:text-white'
                  }`}
                >
                  4. Cheques Emitidos ({pendingChequesEmitidos.length})
                </button>
                <button
                  onClick={() => setExpandedPillar('DEUDA')}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                    expandedPillar === 'DEUDA' ? 'bg-rose-500 text-white' : 'bg-slate-800/80 text-slate-300 hover:text-white'
                  }`}
                >
                  5. Deuda Bancaria ({pendingCuotasDeuda.length})
                </button>
                <button
                  onClick={() => setExpandedPillar('PROVISIONES')}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                    expandedPillar === 'PROVISIONES' ? 'bg-purple-500 text-white' : 'bg-slate-800/80 text-slate-300 hover:text-white'
                  }`}
                >
                  6. Provisiones ({pendingProvisiones.length})
                </button>
              </div>
            </div>

            {/* KPI Cards Strip (Los 6 Pilares + Saldo Final Proyectado) */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {/* 1. Saldo Inicial */}
              <div 
                onClick={() => setExpandedPillar('BANCOS')}
                className="bg-blue-50/70 border border-blue-200 rounded-xl p-3 cursor-pointer hover:bg-blue-100/70 transition-all shadow-xs"
              >
                <div className="flex items-center justify-between text-blue-700 mb-1">
                  <span className="text-[11px] font-black uppercase">1. Saldo Inicial</span>
                  <Landmark className="w-4 h-4" />
                </div>
                <div className="text-base font-black text-blue-950 font-mono">
                  {formatCLP(saldoInicialTotal)}
                </div>
                <div className="text-[10px] text-blue-800 font-medium mt-1">
                  Bancos: {formatCLP(saldoInicialBancos)} | Cajas: {formatCLP(saldoInicialCajas)}
                </div>
              </div>

              {/* 2. Proyecciones Ventas */}
              <div 
                onClick={() => setExpandedPillar('VENTAS')}
                className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 cursor-pointer hover:bg-emerald-100/70 transition-all shadow-xs"
              >
                <div className="flex items-center justify-between text-emerald-700 mb-1">
                  <span className="text-[11px] font-black uppercase">2. Proy. Ventas</span>
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div className="text-base font-black text-emerald-950 font-mono">
                  +{formatCLP(totalPendingSalesDtesMonto + (parameters.incluirVentasProyectadasHistoria ? projectedNewSalesHorizon : 0))}
                </div>
                <div className="text-[10px] text-emerald-800 font-medium mt-1">
                  DTEs: {formatCLP(totalPendingSalesDtesMonto)} | Est: +{formatCLP(projectedNewSalesHorizon)}
                </div>
              </div>

              {/* 3. Cheques Cartera */}
              <div 
                onClick={() => setExpandedPillar('CHEQUES_CARTERA')}
                className="bg-teal-50/70 border border-teal-200 rounded-xl p-3 cursor-pointer hover:bg-teal-100/70 transition-all shadow-xs"
              >
                <div className="flex items-center justify-between text-teal-700 mb-1">
                  <span className="text-[11px] font-black uppercase">3. Chq. Cartera</span>
                  <Receipt className="w-4 h-4" />
                </div>
                <div className="text-base font-black text-teal-950 font-mono">
                  +{formatCLP(totalChequesCarteraMonto)}
                </div>
                <div className="text-[10px] text-teal-800 font-medium mt-1">
                  {pendingChequesCartera.length} cheques por cobrar en custodia
                </div>
              </div>

              {/* 4. Cheques Emitidos */}
              <div 
                onClick={() => setExpandedPillar('CHEQUES_EMITIDOS')}
                className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 cursor-pointer hover:bg-amber-100/70 transition-all shadow-xs"
              >
                <div className="flex items-center justify-between text-amber-800 mb-1">
                  <span className="text-[11px] font-black uppercase">4. Chq. Emitidos</span>
                  <CreditCard className="w-4 h-4" />
                </div>
                <div className="text-base font-black text-amber-950 font-mono">
                  -{formatCLP(totalChequesEmitidosMonto)}
                </div>
                <div className="text-[10px] text-amber-800 font-medium mt-1">
                  {pendingChequesEmitidos.length} cheques diferidos girados
                </div>
              </div>

              {/* 5. Deuda Financiera */}
              <div 
                onClick={() => setExpandedPillar('DEUDA')}
                className="bg-rose-50/70 border border-rose-200 rounded-xl p-3 cursor-pointer hover:bg-rose-100/70 transition-all shadow-xs"
              >
                <div className="flex items-center justify-between text-rose-700 mb-1">
                  <span className="text-[11px] font-black uppercase">5. Deuda Bancos</span>
                  <Building2 className="w-4 h-4" />
                </div>
                <div className="text-base font-black text-rose-950 font-mono">
                  -{formatCLP(totalDeudaCuotasMonto)}
                </div>
                <div className="text-[10px] text-rose-800 font-medium mt-1">
                  {pendingCuotasDeuda.length} cuotas créditos y leasing
                </div>
              </div>

              {/* 6. Provisiones Egresos */}
              <div 
                onClick={() => setExpandedPillar('PROVISIONES')}
                className="bg-purple-50/70 border border-purple-200 rounded-xl p-3 cursor-pointer hover:bg-purple-100/70 transition-all shadow-xs"
              >
                <div className="flex items-center justify-between text-purple-700 mb-1">
                  <span className="text-[11px] font-black uppercase">6. Provisiones</span>
                  <Clock className="w-4 h-4" />
                </div>
                <div className="text-base font-black text-purple-950 font-mono">
                  -{formatCLP(totalProvisionesMonto)}
                </div>
                <div className="text-[10px] text-purple-800 font-medium mt-1">
                  {pendingProvisiones.length} provisiones devengadas
                </div>
              </div>

              {/* Saldo Final */}
              <div className={`rounded-xl p-3 border shadow-xs ${
                saldoFinalContador >= 0 ? 'bg-indigo-900 border-indigo-950 text-white' : 'bg-rose-900 border-rose-950 text-white'
              }`}>
                <div className="flex items-center justify-between text-indigo-200 mb-1">
                  <span className="text-[11px] font-black uppercase text-white">Saldo Proyectado</span>
                  <Wallet className="w-4 h-4 text-white" />
                </div>
                <div className="text-base font-black font-mono">
                  {formatCLP(saldoFinalContador)}
                </div>
                <div className="text-[10px] text-indigo-200 font-medium mt-1">
                  Flujo: {flujoNetoContador >= 0 ? '+' : ''}{formatCLP(flujoNetoContador)}
                </div>
              </div>
            </div>

            {/* TABLERO DETALLADO DE LOS 6 PILARES */}
            <div className="space-y-5">
              {/* PILAR 1: SALDO INICIAL BANCARIO Y CAJAS */}
              {(expandedPillar === 'ALL' || expandedPillar === 'BANCOS') && (
                <div className="bg-white border border-blue-200 rounded-xl overflow-hidden shadow-xs">
                  <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-200 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-blue-600 text-white rounded-lg">
                        <Landmark className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                          Pilar 1: Saldo Inicial Bancario y Cajas de Efectivo
                          <span className="bg-blue-100 text-blue-800 text-[10px] font-black px-2 py-0.5 rounded-full">
                            Punto de Partida
                          </span>
                        </h4>
                        <p className="text-xs text-slate-500">
                          Disponibilidad líquida inmediata en cuentas corrientes bancarias, cajas chicas y fondos fijos
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 uppercase block font-semibold">Total Disponible</span>
                      <span className="text-base font-black text-blue-900 font-mono">
                        {formatCLP(saldoInicialTotal)}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Cuentas Bancarias */}
                    <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-blue-600" />
                          Cuentas Corrientes Bancarias ({bankAccounts.length})
                        </span>
                        <span className="text-xs font-bold text-blue-900 font-mono">
                          {formatCLP(saldoInicialBancos)}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {bankAccounts.map(acc => (
                          <div key={acc.id} className="flex items-center justify-between text-xs bg-white p-2 rounded border border-slate-200">
                            <div>
                              <div className="font-semibold text-slate-800">{acc.banco}</div>
                              <div className="text-[11px] text-slate-500 font-mono">Cta Cte N° {acc.numeroCuenta} ({acc.moneda})</div>
                            </div>
                            <div className="text-right font-mono font-bold text-slate-900">
                              {formatCLP(acc.saldoDisponible)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Cuentas de Efectivo / Cajas */}
                    <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <Coins className="w-3.5 h-3.5 text-amber-600" />
                          Cajas de Efectivo y Fondos Fijos ({cashAccounts.length})
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-amber-900 font-mono">
                            {formatCLP(saldoInicialCajas)}
                          </span>
                          <button
                            onClick={() => setShowCashAccountModal(true)}
                            className="text-[10px] bg-white border border-slate-300 text-slate-700 px-2 py-0.5 rounded hover:bg-slate-100 font-medium cursor-pointer"
                          >
                            Administrar
                          </button>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        {cashAccounts.map(acc => (
                          <div key={acc.id} className="flex items-center justify-between text-xs bg-white p-2 rounded border border-slate-200">
                            <div>
                              <div className="font-semibold text-slate-800">{acc.nombre}</div>
                              <div className="text-[11px] text-slate-500">
                                {acc.tipo === 'CAJA_CENTRAL' ? 'Caja Central Efectivo' : 'Fondo Fijo Rendición'} • Resp: {acc.responsable}
                              </div>
                            </div>
                            <div className="text-right font-mono font-bold text-slate-900">
                              {formatCLP(acc.saldoActual)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* PILAR 2: PROYECCIONES DE VENTAS (FACTURACIÓN ESTIMADA & RCV) */}
              {(expandedPillar === 'ALL' || expandedPillar === 'VENTAS') && (
                <div className="bg-white border border-emerald-200 rounded-xl overflow-hidden shadow-xs">
                  <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-200 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-emerald-600 text-white rounded-lg">
                        <TrendingUp className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                          Pilar 2: Proyecciones de Ventas (Facturas Emitidas & Modelación RCV)
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full">
                            Ingresos Operacionales
                          </span>
                        </h4>
                        <p className="text-xs text-slate-500">
                          Cobranzas pendientes de DTEs de ventas en RCV sumado a la proyección econométrica de ventas según estacionalidad y crecimiento
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 uppercase block font-semibold">Total Ventas Proyectadas</span>
                      <span className="text-base font-black text-emerald-900 font-mono">
                        +{formatCLP(totalPendingSalesDtesMonto + (parameters.incluirVentasProyectadasHistoria ? projectedNewSalesHorizon : 0))}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 space-y-4">
                    {/* Parámetros de Proyección de Ventas */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
                      <div>
                        <span className="text-slate-500 block text-[11px]">Venta Promedio Mensual RCV:</span>
                        <span className="font-mono font-bold text-slate-800">
                          {formatCLP(historicalSales.promedioMensualVentasHistoricas)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">Crecimiento Estimado:</span>
                        <span className="font-mono font-bold text-emerald-700">
                          +{parameters.tasaCrecimientoVentasPct}% mensual
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">Plazo de Cobro Promedio:</span>
                        <span className="font-mono font-bold text-slate-800">
                          {parameters.diasCreditoVentasPromedio} días
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">Ventas Contado vs Crédito:</span>
                        <span className="font-mono font-bold text-slate-800">
                          {parameters.pctVentasContado}% Contado / {100 - parameters.pctVentasContado}% Crédito
                        </span>
                      </div>
                    </div>

                    {/* Tabla de Facturas Emitidas Pendientes de Cobro (RCV) */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <Receipt className="w-3.5 h-3.5 text-emerald-600" />
                          Facturas Emitidas Pendientes de Cobranza ({pendingSalesDtes.length})
                        </span>
                        <span className="text-xs font-bold text-emerald-800 font-mono">
                          Subtotal Cobranza: {formatCLP(totalPendingSalesDtesMonto)}
                        </span>
                      </div>
                      <div className="overflow-x-auto border border-slate-200 rounded-lg">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-100 text-slate-600 text-[10px] uppercase border-b border-slate-200">
                              <th className="p-2.5">Folio DTE</th>
                              <th className="p-2.5">Cliente / Contraparte</th>
                              <th className="p-2.5">RUT</th>
                              <th className="p-2.5">Emisión</th>
                              <th className="p-2.5">Vencimiento</th>
                              <th className="p-2.5 text-right">Total ($ CLP)</th>
                              <th className="p-2.5 text-center">Estado</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-mono">
                            {pendingSalesDtes.length === 0 ? (
                              <tr>
                                <td colSpan={7} className="p-4 text-center text-slate-500 font-sans">
                                  No hay facturas de venta pendientes de cobro en el RCV.
                                </td>
                              </tr>
                            ) : (
                              pendingSalesDtes.map(dte => (
                                <tr key={dte.id} className="hover:bg-slate-50">
                                  <td className="p-2.5 font-bold text-slate-900">F-{dte.folio}</td>
                                  <td className="p-2.5 font-sans font-medium text-slate-800">{dte.razonSocialContraparte}</td>
                                  <td className="p-2.5 text-slate-500">{dte.rutContraparte}</td>
                                  <td className="p-2.5 text-slate-600">{dte.fechaEmision}</td>
                                  <td className="p-2.5 text-emerald-700 font-bold">{dte.fechaVencimiento || 'Al Contado'}</td>
                                  <td className="p-2.5 text-right font-black text-emerald-800">{formatCLP(dte.montoTotal)}</td>
                                  <td className="p-2.5 text-center">
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 font-sans">
                                      PENDIENTE
                                    </span>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* PILAR 3: CHEQUES EN CARTERA POR COBRAR (CUSTODIA DE CLIENTES) */}
              {(expandedPillar === 'ALL' || expandedPillar === 'CHEQUES_CARTERA') && (
                <div className="bg-white border border-teal-200 rounded-xl overflow-hidden shadow-xs">
                  <div className="p-4 bg-gradient-to-r from-teal-50 to-cyan-50 border-b border-teal-200 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-teal-600 text-white rounded-lg">
                        <Receipt className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                          Pilar 3: Cheques en Cartera por Cobrar (Custodia a Fecha)
                          <span className="bg-teal-100 text-teal-800 text-[10px] font-black px-2 py-0.5 rounded-full">
                            Documentos en Custodia
                          </span>
                        </h4>
                        <p className="text-xs text-slate-500">
                          Cheques a fecha recibidos de clientes en garantía o pago diferido pendientes de depósito
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 uppercase block font-semibold">Total en Cartera</span>
                      <span className="text-base font-black text-teal-900 font-mono">
                        +{formatCLP(totalChequesCarteraMonto)}
                      </span>
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="overflow-x-auto border border-slate-200 rounded-lg">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-100 text-slate-600 text-[10px] uppercase border-b border-slate-200">
                            <th className="p-2.5">N° Cheque</th>
                            <th className="p-2.5">Banco Emisor</th>
                            <th className="p-2.5">Girador (Cliente)</th>
                            <th className="p-2.5">RUT Girador</th>
                            <th className="p-2.5">Fecha Depósito / Cobro</th>
                            <th className="p-2.5 text-right">Monto ($ CLP)</th>
                            <th className="p-2.5 text-center">Estado Custodia</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono">
                          {pendingChequesCartera.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="p-4 text-center text-slate-500 font-sans">
                                No se registran cheques en cartera en este momento.
                              </td>
                            </tr>
                          ) : (
                            pendingChequesCartera.map(chq => (
                              <tr key={chq.id} className="hover:bg-slate-50">
                                <td className="p-2.5 font-bold text-slate-900">CHQ-{chq.numeroCheque}</td>
                                <td className="p-2.5 font-sans font-medium text-slate-700">{chq.bancoEmisor}</td>
                                <td className="p-2.5 font-sans font-bold text-slate-800">{chq.giradorNombre}</td>
                                <td className="p-2.5 text-slate-500">{chq.giradorRut}</td>
                                <td className="p-2.5 text-teal-700 font-bold">{chq.fechaCobro}</td>
                                <td className="p-2.5 text-right font-black text-teal-900">+{formatCLP(chq.monto)}</td>
                                <td className="p-2.5 text-center">
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-800 font-sans">
                                    EN CARTERA
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* PILAR 4: CHEQUES EMITIDOS POR PAGAR (DIFERIDOS A PROVEEDORES) */}
              {(expandedPillar === 'ALL' || expandedPillar === 'CHEQUES_EMITIDOS') && (
                <div className="bg-white border border-amber-200 rounded-xl overflow-hidden shadow-xs">
                  <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-amber-600 text-white rounded-lg">
                        <CreditCard className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                          Pilar 4: Cheques Emitidos por Pagar (Cheques Diferidos a Proveedores)
                          <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2 py-0.5 rounded-full">
                            Compromisos de Pago Girados
                          </span>
                        </h4>
                        <p className="text-xs text-slate-500">
                          Cheques a fecha emitidos contra nuestras cuentas bancarias con fecha de cobro programada
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 uppercase block font-semibold">Total Emitidos por Pagar</span>
                      <span className="text-base font-black text-amber-950 font-mono">
                        -{formatCLP(totalChequesEmitidosMonto)}
                      </span>
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="overflow-x-auto border border-slate-200 rounded-lg">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-100 text-slate-600 text-[10px] uppercase border-b border-slate-200">
                            <th className="p-2.5">N° Cheque Girado</th>
                            <th className="p-2.5">Cuenta de Origen</th>
                            <th className="p-2.5">Beneficiario (Proveedor)</th>
                            <th className="p-2.5">RUT Beneficiario</th>
                            <th className="p-2.5">Fecha Cobro Pactada</th>
                            <th className="p-2.5 text-right">Monto ($ CLP)</th>
                            <th className="p-2.5 text-center">Estado Cobro</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono">
                          {pendingChequesEmitidos.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="p-4 text-center text-slate-500 font-sans">
                                No se registran cheques emitidos pendientes de cobro.
                              </td>
                            </tr>
                          ) : (
                            pendingChequesEmitidos.map(chq => (
                              <tr key={chq.id} className="hover:bg-slate-50">
                                <td className="p-2.5 font-bold text-slate-900">CHQ-{chq.numeroCheque}</td>
                                <td className="p-2.5 font-sans font-medium text-slate-700">{chq.bancoNombre}</td>
                                <td className="p-2.5 font-sans font-bold text-slate-800">{chq.beneficiarioNombre}</td>
                                <td className="p-2.5 text-slate-500">{chq.beneficiarioRut}</td>
                                <td className="p-2.5 text-amber-700 font-bold">{chq.fechaPago}</td>
                                <td className="p-2.5 text-right font-black text-amber-900">-{formatCLP(chq.monto)}</td>
                                <td className="p-2.5 text-center">
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 font-sans">
                                    GIRADO PENDIENTE
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* PILAR 5: DEUDAS CON INSTITUCIONES FINANCIERAS */}
              {(expandedPillar === 'ALL' || expandedPillar === 'DEUDA') && (
                <div className="bg-white border border-rose-200 rounded-xl overflow-hidden shadow-xs">
                  <div className="p-4 bg-gradient-to-r from-rose-50 to-red-50 border-b border-rose-200 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-rose-600 text-white rounded-lg">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                          Pilar 5: Deudas con Instituciones Financieras (Servicio de la Deuda)
                          <span className="bg-rose-100 text-rose-800 text-[10px] font-black px-2 py-0.5 rounded-full">
                            Créditos, Leasing & Pagarés
                          </span>
                        </h4>
                        <p className="text-xs text-slate-500">
                          Cuotas exigibles de créditos comerciales, contratos de leasing operativo/financiero y pagarés bancarios
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 uppercase block font-semibold">Total Servicio Deuda</span>
                      <span className="text-base font-black text-rose-950 font-mono">
                        -{formatCLP(totalDeudaCuotasMonto)}
                      </span>
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="overflow-x-auto border border-slate-200 rounded-lg">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-100 text-slate-600 text-[10px] uppercase border-b border-slate-200">
                            <th className="p-2.5">Institución Financiera</th>
                            <th className="p-2.5">Tipo Crédito</th>
                            <th className="p-2.5">N° Operación</th>
                            <th className="p-2.5">Cuota N°</th>
                            <th className="p-2.5">Fecha Vencimiento</th>
                            <th className="p-2.5 text-right">Amort. Capital</th>
                            <th className="p-2.5 text-right">Intereses</th>
                            <th className="p-2.5 text-right">Total Cuota ($ CLP)</th>
                            <th className="p-2.5 text-center">Estado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono">
                          {pendingCuotasDeuda.length === 0 ? (
                            <tr>
                              <td colSpan={9} className="p-4 text-center text-slate-500 font-sans">
                                No se registran deudas financieras vigentes ni cuotas pendientes.
                              </td>
                            </tr>
                          ) : (
                            pendingCuotasDeuda.map((item, idx) => (
                              <tr key={idx} className="hover:bg-slate-50">
                                <td className="p-2.5 font-bold font-sans text-slate-900">{item.deuda.institucionFinanciera}</td>
                                <td className="p-2.5 font-sans text-slate-600">{item.deuda.tipoCredito.replace(/_/g, ' ')}</td>
                                <td className="p-2.5 text-slate-500">{item.deuda.numeroOperacion}</td>
                                <td className="p-2.5 text-center font-bold text-slate-800">#{item.cuota.numeroCuota}</td>
                                <td className="p-2.5 text-rose-700 font-bold">{item.cuota.fechaVencimiento}</td>
                                <td className="p-2.5 text-right text-slate-700">{formatCLP(item.cuota.montoCapital)}</td>
                                <td className="p-2.5 text-right text-slate-500">{formatCLP(item.cuota.montoInteres)}</td>
                                <td className="p-2.5 text-right font-black text-rose-900">-{formatCLP(item.cuota.montoCuota)}</td>
                                <td className="p-2.5 text-center">
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 font-sans">
                                    PENDIENTE
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* PILAR 6: PROVISIONES DE EGRESOS (GASTOS DEVENGADOS) */}
              {(expandedPillar === 'ALL' || expandedPillar === 'PROVISIONES') && (
                <div className="bg-white border border-purple-200 rounded-xl overflow-hidden shadow-xs">
                  <div className="p-4 bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-purple-200 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-purple-600 text-white rounded-lg">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                          Pilar 6: Provisiones de Egresos (Gastos Devengados & Contingencias)
                          <span className="bg-purple-100 text-purple-800 text-[10px] font-black px-2 py-0.5 rounded-full">
                            Devengo & Pasivos Estimados
                          </span>
                        </h4>
                        <p className="text-xs text-slate-500">
                          Gratificaciones legales (Art. 50 Código del Trabajo), Indemnizaciones IAS, auditorías externas y mantenciones mayores
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 uppercase block font-semibold">Total Provisiones Estimadas</span>
                      <span className="text-base font-black text-purple-950 font-mono">
                        -{formatCLP(totalProvisionesMonto)}
                      </span>
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="overflow-x-auto border border-slate-200 rounded-lg">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-100 text-slate-600 text-[10px] uppercase border-b border-slate-200">
                            <th className="p-2.5">Tipo de Provisión</th>
                            <th className="p-2.5">Concepto / Glosa</th>
                            <th className="p-2.5">Cuenta Contable</th>
                            <th className="p-2.5">Fecha Est. Materialización</th>
                            <th className="p-2.5 text-center">Probabilidad</th>
                            <th className="p-2.5 text-right">Monto Estimado ($ CLP)</th>
                            <th className="p-2.5 text-center">Estado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono">
                          {pendingProvisiones.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="p-4 text-center text-slate-500 font-sans">
                                No se registran provisiones de egresos pendientes.
                              </td>
                            </tr>
                          ) : (
                            pendingProvisiones.map(prov => (
                              <tr key={prov.id} className="hover:bg-slate-50">
                                <td className="p-2.5 font-bold font-sans text-purple-900">
                                  {prov.tipoProvision.replace(/_/g, ' ')}
                                </td>
                                <td className="p-2.5 font-sans text-slate-800 max-w-xs">{prov.concepto}</td>
                                <td className="p-2.5 text-slate-500">{prov.cuentaContableProvision}</td>
                                <td className="p-2.5 text-purple-700 font-bold">{prov.fechaEstimadaPago}</td>
                                <td className="p-2.5 text-center">
                                  <span className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-700 font-bold">
                                    {prov.probabilidadMaterializacionPct}%
                                  </span>
                                </td>
                                <td className="p-2.5 text-right font-black text-purple-950">
                                  -{formatCLP(prov.montoEstimado)}
                                </td>
                                <td className="p-2.5 text-center">
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 font-sans">
                                    DEVENGADA
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ESTADO CONSOLIDADO DE FLUJO DE CAJA PROYECTADO (ROLLFORWARD CONTABLE) */}
            <div className="bg-slate-900 text-white rounded-xl p-5 shadow-lg space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Scale className="w-5 h-5 text-indigo-400" />
                  <h4 className="font-black text-sm tracking-wide text-white uppercase">
                    Liquidación Consolidada de Flujo de Caja Proyectado (Rollforward Auditor)
                  </h4>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-slate-400">Horizonte de Auditoría: <strong className="text-white">{horizonLabel}</strong></span>
                </div>
              </div>

              {/* Rollforward Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono">
                  <tbody className="divide-y divide-slate-800">
                    {/* Saldo Inicial */}
                    <tr className="bg-slate-800/40">
                      <td className="p-2.5 font-bold font-sans text-slate-300">
                        1. SALDO INICIAL CONSOLIDADO (Bancos + Cajas de Efectivo)
                      </td>
                      <td className="p-2.5 text-right font-black text-blue-300 text-sm">
                        {formatCLP(saldoInicialTotal)}
                      </td>
                    </tr>

                    {/* Ingresos Operacionales */}
                    <tr>
                      <td className="p-2.5 pl-6 font-sans text-slate-300">
                        (+) Cobranzas de Facturas de Venta Emitidas (DTEs RCV)
                      </td>
                      <td className="p-2.5 text-right font-bold text-emerald-400">
                        +{formatCLP(totalPendingSalesDtesMonto)}
                      </td>
                    </tr>
                    {parameters.incluirVentasProyectadasHistoria && (
                      <tr>
                        <td className="p-2.5 pl-6 font-sans text-slate-300">
                          (+) Proyecciones de Nuevas Ventas del Giro (según Historia RCV & Crecimiento)
                        </td>
                        <td className="p-2.5 text-right font-bold text-emerald-400">
                          +{formatCLP(projectedNewSalesHorizon)}
                        </td>
                      </tr>
                    )}
                    {parameters.incluirChequesCartera && (
                      <tr>
                        <td className="p-2.5 pl-6 font-sans text-slate-300">
                          (+) Cobro / Depósito de Cheques en Cartera de Clientes
                        </td>
                        <td className="p-2.5 text-right font-bold text-teal-400">
                          +{formatCLP(totalChequesCarteraMonto)}
                        </td>
                      </tr>
                    )}

                    {/* Subtotal Disponibilidad */}
                    <tr className="bg-emerald-950/40 border-t border-b border-emerald-800/60 font-bold">
                      <td className="p-2.5 font-sans text-emerald-300">
                        (=) TOTAL DISPONIBILIDAD BRUTA ESTIMADA (Saldo Inicial + Entradas Proyectadas)
                      </td>
                      <td className="p-2.5 text-right text-emerald-300 font-black text-sm">
                        {formatCLP(saldoInicialTotal + totalIngresosContador)}
                      </td>
                    </tr>

                    {/* Egresos */}
                    <tr>
                      <td className="p-2.5 pl-6 font-sans text-slate-300">
                        (-) Egresos Operacionales Ordinarios (Proveedores DTE, Nómina, Previred, F29, Arriendos)
                      </td>
                      <td className="p-2.5 text-right font-bold text-rose-400">
                        -{formatCLP(totalEgresosOperativosOrdinarios)}
                      </td>
                    </tr>
                    {parameters.incluirChequesEmitidos && (
                      <tr>
                        <td className="p-2.5 pl-6 font-sans text-slate-300">
                          (-) Pago de Cheques Emitidos Diferidos a Proveedores
                        </td>
                        <td className="p-2.5 text-right font-bold text-amber-400">
                          -{formatCLP(totalChequesEmitidosMonto)}
                        </td>
                      </tr>
                    )}
                    {parameters.incluirDeudaFinanciera && (
                      <tr>
                        <td className="p-2.5 pl-6 font-sans text-slate-300">
                          (-) Servicio de Deuda con Instituciones Financieras (Créditos, Leasing & Pagarés)
                        </td>
                        <td className="p-2.5 text-right font-bold text-rose-400">
                          -{formatCLP(totalDeudaCuotasMonto)}
                        </td>
                      </tr>
                    )}
                    {parameters.incluirProvisionesEgresos && (
                      <tr>
                        <td className="p-2.5 pl-6 font-sans text-slate-300">
                          (-) Materialización de Provisiones de Egresos Devengados (Gratificaciones, IAS, Mantenciones)
                        </td>
                        <td className="p-2.5 text-right font-bold text-purple-400">
                          -{formatCLP(totalProvisionesMonto)}
                        </td>
                      </tr>
                    )}

                    {/* Total Egresos */}
                    <tr className="bg-rose-950/40 border-t border-b border-rose-800/60 font-bold">
                      <td className="p-2.5 font-sans text-rose-300">
                        (=) TOTAL COMPROMISOS Y EGRESOS PROYECTADOS
                      </td>
                      <td className="p-2.5 text-right text-rose-300 font-black text-sm">
                        -{formatCLP(totalEgresosContador)}
                      </td>
                    </tr>

                    {/* Flujo Neto */}
                    <tr className="bg-slate-800/80 font-bold">
                      <td className="p-2.5 font-sans text-white">
                        (=) FLUJO NETO PROYECTADO DEL PERÍODO (Ingresos Proyectados - Egresos Totales)
                      </td>
                      <td className={`p-2.5 text-right font-black text-sm ${
                        flujoNetoContador >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                        {flujoNetoContador >= 0 ? '+' : ''}{formatCLP(flujoNetoContador)}
                      </td>
                    </tr>

                    {/* Saldo Final */}
                    <tr className="bg-indigo-950 border-t-2 border-indigo-500 font-black">
                      <td className="p-3 font-sans text-white text-sm flex items-center justify-between">
                        <span>(=) SALDO FINAL ESTIMADO EN BANCOS Y CAJAS AL CIERRE DEL PERÍODO</span>
                        <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase ${
                          saldoFinalContador >= 0 ? 'bg-emerald-500 text-white' : 'bg-rose-600 text-white'
                        }`}>
                          {saldoFinalContador >= 0 ? 'SUPERÁVIT DE LIQUIDEZ' : 'DÉFICIT FINANCIERO'}
                        </span>
                      </td>
                      <td className={`p-3 text-right font-black text-base ${
                        saldoFinalContador >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                        {formatCLP(saldoFinalContador)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Ratios & Métricas de Auditoría */}
              <div className="pt-3 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                  <span className="text-slate-400 block text-[11px]">Días de Cobertura de Caja (Cash Runway):</span>
                  <span className="text-base font-bold text-white font-mono">
                    {totalEgresosContador > 0 
                      ? `${Math.round((saldoInicialTotal / (totalEgresosContador / (horizonMonthsCount * 30))))} días`
                      : 'Indefinido'}
                  </span>
                </div>
                <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                  <span className="text-slate-400 block text-[11px]">Ratio de Cobertura de Cheques Emitidos:</span>
                  <span className="text-base font-bold text-white font-mono">
                    {totalChequesEmitidosMonto > 0 
                      ? `${(saldoInicialBancos / totalChequesEmitidosMonto).toFixed(2)}x fondos`
                      : '100% Cubierto'}
                  </span>
                </div>
                <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                  <span className="text-slate-400 block text-[11px]">Carga Financiera sobre Ingresos:</span>
                  <span className="text-base font-bold text-white font-mono">
                    {totalIngresosContador > 0 
                      ? `${((totalDeudaCuotasMonto / totalIngresosContador) * 100).toFixed(1)}%`
                      : '0%'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* View 4: Table of Movements */}
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
                  <option value="CHEQUES_CARTERA">Cheques en Cartera (Cobro)</option>
                  <option value="CHEQUES_EMITIDOS">Cheques Emitidos (Pago)</option>
                  <option value="DEUDA_FINANCIERA">Deudas Bancarias & Financieras</option>
                  <option value="PROVISIONES">Provisiones de Egreso</option>
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
                </select>
              </div>

              {/* Search input */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por concepto o RUT..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-3 py-1.5 bg-white border border-slate-300 text-slate-900 text-xs rounded-lg focus:outline-none focus:border-indigo-600 w-full sm:w-64"
                />
              </div>
            </div>

            {/* Movements Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 border-b border-slate-200 uppercase text-[10px] tracking-wider">
                    <th className="p-3 font-bold">Fecha Est.</th>
                    <th className="p-3 font-bold">Concepto & Contraparte</th>
                    <th className="p-3 font-bold">Tipo</th>
                    <th className="p-3 font-bold">Categoría</th>
                    <th className="p-3 font-bold">Origen ERP</th>
                    <th className="p-3 font-bold text-right">Neto</th>
                    <th className="p-3 font-bold text-right">Total ($ CLP)</th>
                    <th className="p-3 font-bold text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredMovements.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-500">
                        No se encontraron movimientos con los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    filteredMovements.map((mov) => (
                      <tr key={mov.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 font-mono font-medium text-slate-700 whitespace-nowrap">
                          {mov.fechaEstimada}
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-slate-900">{mov.concepto}</div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                            <span>{mov.contraparte}</span>
                            {mov.rutContraparte && (
                              <span className="font-mono text-slate-400">({mov.rutContraparte})</span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              mov.tipo === 'INGRESO'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {mov.tipo}
                          </span>
                        </td>
                        <td className="p-3 text-[11px] text-slate-600 whitespace-nowrap">
                          {mov.categoria.replace(/_/g, ' ')}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-700 border border-slate-200">
                            {mov.origenModulo || 'MANUAL'}
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono text-slate-600 whitespace-nowrap">
                          {formatCLP(mov.montoNeto)}
                        </td>
                        <td className="p-3 text-right font-mono font-bold whitespace-nowrap">
                          <span className={mov.tipo === 'INGRESO' ? 'text-emerald-700' : 'text-rose-700'}>
                            {mov.tipo === 'INGRESO' ? '+' : '-'}{formatCLP(mov.montoTotal)}
                          </span>
                        </td>
                        <td className="p-3 text-center whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              mov.estado === 'COBRADO' || mov.estado === 'PAGADO'
                                ? 'bg-emerald-100 text-emerald-800'
                                : mov.estado === 'FACTURADO'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {mov.estado}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Manual Movement Creation Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-fadeIn">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-400" />
                Registrar Movimiento de Flujo de Caja
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateMovement} className="p-5 space-y-4 text-xs">
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
                    <option value="VENTAS_OPERACIONALES">Ventas Operacionales</option>
                    <option value="COBRANZA_CLIENTES">Cobranza Clientes</option>
                    <option value="PAGO_PROVEEDORES">Pago Proveedores</option>
                    <option value="REMUNERACIONES">Remuneraciones / Sueldos</option>
                    <option value="LEYES_SOCIALES">Previred / Leyes Sociales</option>
                    <option value="IMPUESTOS_F29">Impuestos F29 / TGR</option>
                    <option value="LEASING_ARRIENDOS">Arriendos / Leasing</option>
                    <option value="GASTOS_ADMINISTRATIVOS">Gastos Administrativos</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Concepto o Glosa:</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Cobranza Factura 1054 Minera Centinela"
                  value={newMov.concepto}
                  onChange={(e) =>
                    setNewMov((prev) => ({ ...prev, concepto: e.target.value }))
                  }
                  className="w-full bg-slate-50 border border-slate-300 rounded-md p-2 text-slate-900 focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">RUT Contraparte:</label>
                  <input
                    type="text"
                    placeholder="76.123.456-7"
                    value={newMov.rutContraparte}
                    onChange={(e) =>
                      setNewMov((prev) => ({ ...prev, rutContraparte: e.target.value }))
                    }
                    className="w-full bg-slate-50 border border-slate-300 rounded-md p-2 text-slate-900 focus:outline-none focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Nombre Contraparte:</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Constructora del Pacífico SpA"
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
          chequesCartera={chequesCartera}
          chequesEmitidos={chequesEmitidos}
          deudasFinancieras={deudasFinancieras}
          provisionesEgresos={provisionesEgresos}
          existingMovements={safeMovements}
          onClose={() => setShowAgentScannerModal(false)}
          onSyncMovements={handleSyncCommitments}
        />
      )}

      {/* Parameters Configuration Modal */}
      {showParamsModal && (
        <CashFlowParamsModal
          parameters={parameters}
          onChangeParameters={setParameters}
          onClose={() => setShowParamsModal(false)}
          historicalAverageMonthlySales={historicalSales.promedioMensualVentas}
        />
      )}

      {/* Cash Accounts Manager Modal */}
      {showCashAccountModal && (
        <CashAccountsManagerModal
          cashAccounts={cashAccounts}
          onUpdateCashAccounts={(updated) => {
            if (onUpdateCashAccounts) {
              onUpdateCashAccounts(updated);
            }
          }}
          onClose={() => setShowCashAccountModal(false)}
        />
      )}

      {/* Provisiones de Egresos Manager Modal (ABM Contable vs Extracontable e IVA 19%) */}
      {showProvisionesModal && (
        <ProvisionesEgresosManagerModal
          isOpen={showProvisionesModal}
          onClose={() => setShowProvisionesModal(false)}
          provisiones={provisionesEgresos}
          onUpdateProvisiones={(updated) => {
            if (onUpdateProvisionesEgresos) {
              onUpdateProvisionesEgresos(updated);
            }
          }}
          empresaId={company?.id || 'client-innovagile'}
          onAddEntry={onAddEntry}
          authorName={company?.razonSocial || 'Auditor ERP'}
        />
      )}
    </div>
  );
};
