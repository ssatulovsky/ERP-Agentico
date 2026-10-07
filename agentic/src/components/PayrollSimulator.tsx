import React, { useState, useMemo } from 'react';
import { 
  Calculator, 
  Users, 
  DollarSign, 
  Briefcase, 
  Shield, 
  Building2, 
  ArrowRight, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  Check, 
  Printer, 
  Sliders, 
  FileCode, 
  UserPlus, 
  Layers, 
  TrendingUp,
  Percent,
  HelpCircle,
  FileText,
  X
} from 'lucide-react';
import { 
  ChileIndicators, 
  EmployeePayroll, 
  AccountingEntry, 
  CompanyProfile 
} from '../types';
import { 
  AFP_RATES, 
  formatCLP, 
  formatNumberCL, 
  formatNormalizedAccountingEntry, 
  calculatePayroll, 
  calculateImpuestoUnico,
  createPayrollCentralizationEntry 
} from '../utils/chileanAccounting';
import { StandardJournalEntryModal } from './accounting/StandardJournalEntryModal';

interface PayrollSimulatorProps {
  indicators: ChileIndicators;
  company: CompanyProfile;
  onAddEmployeeToPayroll?: (employee: EmployeePayroll) => void;
  onAddEntry?: (entry: AccountingEntry) => void;
}

export const PayrollSimulator: React.FC<PayrollSimulatorProps> = ({
  indicators,
  company,
  onAddEmployeeToPayroll,
  onAddEntry,
}) => {
  // Mode: Direct (Bruto -> Líquido) or Reverse (Líquido Deseado -> Bruto)
  const [calculationMode, setCalculationMode] = useState<'DIRECT' | 'REVERSE'>('DIRECT');
  const [activeSubTab, setActiveSubTab] = useState<'SIMULATOR' | 'SCENARIOS' | 'TAX_TABLE'>('SIMULATOR');

  // Simulator Inputs (State)
  const [nombreCompleto, setNombreCompleto] = useState('Juan Carlos Morales');
  const [rut, setRut] = useState('16.892.411-5');
  const [cargo, setCargo] = useState('Ingeniero de Proyectos');
  const [tipoContrato, setTipoContrato] = useState<'INDEFINIDO' | 'PLAZO_FIJO'>('INDEFINIDO');
  const [jornadaSemanal, setJornadaSemanal] = useState<number>(44); // 44 o 40 hrs (Ley 40 Horas)
  const [diasTrabajados, setDiasTrabajados] = useState<number>(30);

  // Direct Mode Inputs
  const [sueldoBase, setSueldoBase] = useState<number>(1500000);
  const [gratificacionModalidad, setGratificacionModalidad] = useState<'ART_50' | 'ART_47' | 'PACTADA' | 'NINGUNA'>('ART_50');
  const [gratificacionPactada, setGratificacionPactada] = useState<number>(0);
  const [horasExtrasCantidad, setHorasExtrasCantidad] = useState<number>(10);
  const [comisionesBonos, setComisionesBonos] = useState<number>(200000);

  // Non-taxable allowances
  const [colacion, setColacion] = useState<number>(90000);
  const [movilizacion, setMovilizacion] = useState<number>(80000);
  const [viaticos, setViaticos] = useState<number>(0);

  // Social Security & Health
  const [afpNombre, setAfpNombre] = useState<keyof typeof AFP_RATES>('HABITAT');
  const [saludTipo, setSaludTipo] = useState<'FONASA' | 'ISAPRE'>('FONASA');
  const [saludPlanUf, setSaludPlanUf] = useState<number>(4.2);

  // Other deductions (APV, Loan, etc.)
  const [apvMonto, setApvMonto] = useState<number>(0);
  const [otrosDescuentos, setOtrosDescuentos] = useState<number>(0);

  // Reverse Mode Inputs
  const [sueldoLiquidoDeseado, setSueldoLiquidoDeseado] = useState<number>(1600000);

  // Additional Employer Costs Configuration
  const [mutualAdicionalTasa, setMutualAdicionalTasa] = useState<number>(0.0); // e.g., 0.0% + 0.93% base

  // Scenarios for Side-by-Side Comparison
  const [scenarioA, setScenarioA] = useState({
    title: 'Escenario A (Indefinido + Art. 50 + Fonasa)',
    sueldoBase: 1200000,
    tipoContrato: 'INDEFINIDO' as const,
    gratificacionModalidad: 'ART_50' as const,
    afpNombre: 'HABITAT' as const,
    saludTipo: 'FONASA' as const,
    saludPlanUf: 0,
    horasExtras: 0,
    bonos: 0,
  });

  const [scenarioB, setScenarioB] = useState({
    title: 'Escenario B (Indefinido + Horas Extras + Isapre)',
    sueldoBase: 1800000,
    tipoContrato: 'INDEFINIDO' as const,
    gratificacionModalidad: 'ART_50' as const,
    afpNombre: 'CUPRUM' as const,
    saludTipo: 'ISAPRE' as const,
    saludPlanUf: 4.8,
    horasExtras: 15,
    bonos: 300000,
  });

  const [scenarioC, setScenarioC] = useState({
    title: 'Escenario C (Plazo Fijo + Sueldo Elevado)',
    sueldoBase: 3200000,
    tipoContrato: 'PLAZO_FIJO' as const,
    gratificacionModalidad: 'ART_50' as const,
    afpNombre: 'MODELO' as const,
    saludTipo: 'ISAPRE' as const,
    saludPlanUf: 6.5,
    horasExtras: 0,
    bonos: 500000,
  });

  // Modals & feedback
  const [showPayslipModal, setShowPayslipModal] = useState(false);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [addedSuccessMsg, setAddedSuccessMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Topes Imponibles en Pesos ($ CLP)
  const topeAfpSaludCLP = Math.round(indicators.topeImponibleAfpUf * indicators.uf);
  const topeAfcCLP = Math.round(indicators.topeImponibleAfcUf * indicators.uf);

  // Function to solve Reverse calculation (find Sueldo Base that yields desired Net)
  const solvedBaseFromDesiredNet = useMemo(() => {
    if (calculationMode !== 'REVERSE') return sueldoBase;
    
    // Binary search / iterative approximation
    let low = Math.max(indicators.imm, sueldoLiquidoDeseado * 0.8);
    let high = sueldoLiquidoDeseado * 2.5;
    let target = sueldoLiquidoDeseado;
    let bestBase = sueldoLiquidoDeseado;

    for (let i = 0; i < 40; i++) {
      const mid = Math.round((low + high) / 2);
      const testPayroll = calculatePayroll(
        {
          sueldoBase: mid,
          tipoContrato,
          gratificacionModalidad: gratificacionModalidad === 'NINGUNA' ? 'PACTADA' : gratificacionModalidad,
          gratificacionMonto: gratificacionModalidad === 'PACTADA' ? gratificacionPactada : gratificacionModalidad === 'NINGUNA' ? 0 : undefined,
          horasExtrasCantidad,
          comisionesBonosImponibles: comisionesBonos,
          asignacionColacion: colacion,
          asignacionMovilizacion: movilizacion,
          viaticosAsignacionFamiliar: viaticos,
          afpNombre,
          saludTipo,
          saludPlanUf: saludTipo === 'ISAPRE' ? saludPlanUf : 0,
          otrosDescuentos: otrosDescuentos + apvMonto,
          diasTrabajados,
        },
        indicators
      );

      const net = testPayroll.sueldoLiquido;
      if (Math.abs(net - target) < 100) {
        bestBase = mid;
        break;
      }
      if (net < target) {
        low = mid;
      } else {
        high = mid;
      }
      bestBase = mid;
    }
    return bestBase;
  }, [
    calculationMode,
    sueldoLiquidoDeseado,
    tipoContrato,
    gratificacionModalidad,
    gratificacionPactada,
    horasExtrasCantidad,
    comisionesBonos,
    colacion,
    movilizacion,
    viaticos,
    afpNombre,
    saludTipo,
    saludPlanUf,
    otrosDescuentos,
    apvMonto,
    diasTrabajados,
    indicators,
    sueldoBase
  ]);

  // Actual Base used for primary calculation
  const effectiveBaseSalary = calculationMode === 'REVERSE' ? solvedBaseFromDesiredNet : sueldoBase;

  // Primary Calculated Payroll Record
  const simulatedPayroll: EmployeePayroll = useMemo(() => {
    // Custom Hora Extra Factor based on weekly hours
    const factorHoraExtra = (1 / 30) * (28 / jornadaSemanal) * 1.5;
    const valorHoraExtra = Math.round(effectiveBaseSalary * factorHoraExtra);
    const horasExtrasMonto = horasExtrasCantidad * valorHoraExtra;

    let gratMonto = 0;
    if (gratificacionModalidad === 'ART_50') {
      const topeMensualArt50 = Math.round((4.75 * indicators.imm) / 12);
      const subtotalParaGratif = effectiveBaseSalary + horasExtrasMonto + comisionesBonos;
      gratMonto = Math.min(Math.round(subtotalParaGratif * 0.25), topeMensualArt50);
    } else if (gratificacionModalidad === 'PACTADA') {
      gratMonto = gratificacionPactada;
    }

    const totalHaberesImponibles = effectiveBaseSalary + horasExtrasMonto + comisionesBonos + gratMonto;
    const totalHaberesNoImponibles = colacion + movilizacion + viaticos;
    const totalHaberesBrutos = totalHaberesImponibles + totalHaberesNoImponibles;

    const baseAfpSalud = Math.min(totalHaberesImponibles, topeAfpSaludCLP);
    const baseAfc = Math.min(totalHaberesImponibles, topeAfcCLP);

    const afpTasa = AFP_RATES[afpNombre] || 0.1127;
    const afpMonto = Math.round(baseAfpSalud * afpTasa);

    let saludMonto = Math.round(baseAfpSalud * 0.07);
    if (saludTipo === 'ISAPRE' && saludPlanUf > 0) {
      const planPactadoCLP = Math.round(saludPlanUf * indicators.uf);
      saludMonto = Math.max(saludMonto, planPactadoCLP);
    }

    const afcTrabajadorTasa = tipoContrato === 'INDEFINIDO' ? 0.006 : 0.0;
    const afcTrabajadorMonto = Math.round(baseAfc * afcTrabajadorTasa);

    // Impuesto Único Calculation
    const topeSaludDeducible = Math.min(saludMonto, Math.round(baseAfpSalud * 0.07));
    const baseTributable = Math.max(0, totalHaberesImponibles - afpMonto - topeSaludDeducible - afcTrabajadorMonto - apvMonto);
    const impuestoUnicoMonto = calculateImpuestoUnico(baseTributable, indicators.utm);

    const totalDesc = afpMonto + saludMonto + afcTrabajadorMonto + impuestoUnicoMonto + otrosDescuentos + apvMonto;
    const sueldoLiquido = totalHaberesBrutos - totalDesc;

    // Employer Social Costs
    const sisEmpleadorMonto = Math.round(baseAfpSalud * indicators.sisTasa);
    const mutualTasaEfectiva = indicators.mutualBaseTasa + mutualAdicionalTasa;
    const mutualEmpleadorMonto = Math.round(baseAfpSalud * mutualTasaEfectiva);
    const afcEmpleadorTasa = tipoContrato === 'INDEFINIDO' ? 0.024 : 0.030;
    const afcEmpleadorMonto = Math.round(baseAfc * afcEmpleadorTasa);

    const costoTotalEmpresa = totalHaberesBrutos + sisEmpleadorMonto + mutualEmpleadorMonto + afcEmpleadorMonto;

    return {
      id: `sim-${Date.now()}`,
      rut: rut || '16.892.411-5',
      nombreCompleto: nombreCompleto || 'Colaborador Simulado',
      cargo: cargo || 'Cargo Simulado',
      departamento: 'Operaciones',
      fechaIngreso: new Date().toISOString().split('T')[0],
      tipoContrato,
      diasTrabajados,
      sueldoBase: effectiveBaseSalary,
      gratificacionModalidad: gratificacionModalidad === 'NINGUNA' ? 'PACTADA' : gratificacionModalidad,
      gratificacionMonto: gratMonto,
      horasExtrasCantidad,
      horasExtrasMonto,
      comisionesBonosImponibles: comisionesBonos,
      totalHaberesImponibles,
      asignacionColacion: colacion,
      asignacionMovilizacion: movilizacion,
      viaticosAsignacionFamiliar: viaticos,
      totalHaberesNoImponibles,
      totalHaberesBrutos,
      afpNombre,
      afpTasa,
      afpMonto,
      saludTipo,
      saludPlanUf: saludTipo === 'ISAPRE' ? saludPlanUf : 0,
      saludMonto,
      afcTrabajadorMonto,
      impuestoUnicoMonto,
      otrosDescuentos: otrosDescuentos + apvMonto,
      totalDescuentos: totalDesc,
      sueldoLiquido,
      sisEmpleadorMonto,
      mutualEmpleadorMonto,
      afcEmpleadorMonto,
      costoTotalEmpresa,
    };
  }, [
    effectiveBaseSalary,
    jornadaSemanal,
    horasExtrasCantidad,
    comisionesBonos,
    gratificacionModalidad,
    gratificacionPactada,
    colacion,
    movilizacion,
    viaticos,
    topeAfpSaludCLP,
    topeAfcCLP,
    afpNombre,
    saludTipo,
    saludPlanUf,
    tipoContrato,
    apvMonto,
    otrosDescuentos,
    diasTrabajados,
    indicators,
    mutualAdicionalTasa,
    rut,
    nombreCompleto,
    cargo
  ]);

  // Taxable Base in UTM for Tax Bracket Inspector
  const baseTributablePesos = Math.max(
    0, 
    simulatedPayroll.totalHaberesImponibles - 
    simulatedPayroll.afpMonto - 
    Math.min(simulatedPayroll.saludMonto, Math.round(Math.min(simulatedPayroll.totalHaberesImponibles, topeAfpSaludCLP) * 0.07)) - 
    simulatedPayroll.afcTrabajadorMonto - 
    apvMonto
  );
  const baseTributableUtm = baseTributablePesos / indicators.utm;

  // Chilean Impuesto Único 8-Bracket Reference
  const taxBrackets = [
    { tramo: 1, desdeUtm: 0, hastaUtm: 13.5, factor: 0.0, rebajaUtm: 0, desc: 'Exento' },
    { tramo: 2, desdeUtm: 13.5, hastaUtm: 30, factor: 0.04, rebajaUtm: 0.54, desc: '4%' },
    { tramo: 3, desdeUtm: 30, hastaUtm: 50, factor: 0.08, rebajaUtm: 1.74, desc: '8%' },
    { tramo: 4, desdeUtm: 50, hastaUtm: 70, factor: 0.135, rebajaUtm: 4.49, desc: '13.5%' },
    { tramo: 5, desdeUtm: 70, hastaUtm: 90, factor: 0.23, rebajaUtm: 11.14, desc: '23%' },
    { tramo: 6, desdeUtm: 90, hastaUtm: 120, factor: 0.304, rebajaUtm: 17.80, desc: '30.4%' },
    { tramo: 7, desdeUtm: 120, hastaUtm: 310, factor: 0.35, rebajaUtm: 23.32, desc: '35%' },
    { tramo: 8, desdeUtm: 310, hastaUtm: 9999, factor: 0.40, rebajaUtm: 38.82, desc: '40%' },
  ];

  // Helper to calculate scenario
  const calcScenario = (sc: typeof scenarioA) => {
    return calculatePayroll(
      {
        sueldoBase: sc.sueldoBase,
        tipoContrato: sc.tipoContrato,
        gratificacionModalidad: sc.gratificacionModalidad,
        afpNombre: sc.afpNombre,
        saludTipo: sc.saludTipo,
        saludPlanUf: sc.saludPlanUf,
        horasExtrasCantidad: sc.horasExtras,
        comisionesBonosImponibles: sc.bonos,
        asignacionColacion: 80000,
        asignacionMovilizacion: 70000,
        diasTrabajados: 30,
      },
      indicators
    );
  };

  const resA = useMemo(() => calcScenario(scenarioA), [scenarioA, indicators]);
  const resB = useMemo(() => calcScenario(scenarioB), [scenarioB, indicators]);
  const resC = useMemo(() => calcScenario(scenarioC), [scenarioC, indicators]);

  // Handle Add to Main Payroll
  const handleAddToPayroll = () => {
    if (onAddEmployeeToPayroll) {
      onAddEmployeeToPayroll(simulatedPayroll);
      setAddedSuccessMsg(`¡Colaborador "${simulatedPayroll.nombreCompleto}" incorporado exitosamente a la Nómina Activa!`);
      setTimeout(() => setAddedSuccessMsg(null), 3000);
    }
  };

  // Generate Centralization Entry
  const handleCentralizeSimulation = () => {
    const period = new Date().toISOString().substring(0, 7);
    const entry = createPayrollCentralizationEntry([simulatedPayroll], period);
    if (onAddEntry) {
      onAddEntry(entry);
    }
    setShowEntryModal(true);
  };

  const copyNormalizedText = (entry: AccountingEntry) => {
    const text = formatNormalizedAccountingEntry(entry);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header & Sub-Navigation */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-[#eff6ff] text-[#2563eb] border border-blue-200">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-[#0f172a] tracking-tight">
                SIMULADOR PREVISIONAL & LABORAL CHILENO
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Cálculo integral de Impuesto Único en UTM, Gratificación Art. 50, Horas Extras, Leyes Sociales y Costo Empresa.
              </p>
            </div>
          </div>
        </div>

        {/* SubTabs */}
        <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg border border-slate-200 overflow-x-auto w-full md:w-auto">
          <button
            onClick={() => setActiveSubTab('SIMULATOR')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'SIMULATOR'
                ? 'bg-white text-[#2563eb] shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5" />
              <span>Simulador Interactivo</span>
            </span>
          </button>
          <button
            onClick={() => setActiveSubTab('SCENARIOS')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'SCENARIOS'
                ? 'bg-white text-purple-700 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />
              <span>Comparador Multi-Escenario</span>
            </span>
          </button>
          <button
            onClick={() => setActiveSubTab('TAX_TABLE')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'TAX_TABLE'
                ? 'bg-white text-amber-700 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Percent className="w-3.5 h-3.5" />
              <span>Tramos Impuesto Único (UTM)</span>
            </span>
          </button>
        </div>
      </div>

      {/* Top Indicators & Reference Topes Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
        <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs">
          <span className="text-[10px] text-slate-500 font-sans block font-semibold">TOPE IMPONIBLE AFP/SALUD</span>
          <span className="font-bold text-[#0f172a] text-sm">{indicators.topeImponibleAfpUf} UF</span>
          <span className="text-[10px] text-slate-500 block">({formatCLP(topeAfpSaludCLP)})</span>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs">
          <span className="text-[10px] text-slate-500 font-sans block font-semibold">TOPE IMPONIBLE AFC</span>
          <span className="font-bold text-[#0f172a] text-sm">{indicators.topeImponibleAfcUf} UF</span>
          <span className="text-[10px] text-slate-500 block">({formatCLP(topeAfcCLP)})</span>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs">
          <span className="text-[10px] text-slate-500 font-sans block font-semibold">INGRESO MÍNIMO MENSUAL (IMM)</span>
          <span className="font-bold text-emerald-700 text-sm">{formatCLP(indicators.imm)}</span>
          <span className="text-[10px] text-slate-500 block">Tope Art. 50: {formatCLP((4.75 * indicators.imm) / 12)}/mes</span>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs">
          <span className="text-[10px] text-slate-500 font-sans block font-semibold">VALOR UTM / UF DEL MES</span>
          <span className="font-bold text-blue-700 text-sm">UTM: {formatCLP(indicators.utm)}</span>
          <span className="text-[10px] text-slate-500 block">UF: {formatCLP(indicators.uf)}</span>
        </div>
      </div>

      {addedSuccessMsg && (
        <div className="bg-emerald-50 border border-emerald-300 rounded-lg p-3.5 text-xs text-emerald-900 font-medium flex items-center justify-between gap-3 shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{addedSuccessMsg}</span>
          </div>
          <button
            onClick={() => setAddedSuccessMsg(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* VIEW 1: INTERACTIVE SIMULATOR */}
      {activeSubTab === 'SIMULATOR' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Interactive Inputs (7 cols) */}
          <div className="lg:col-span-7 space-y-5">
            {/* Mode Switcher: Bruto vs Inverso Líquido */}
            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                  Modalidad de Simulación
                </span>
                <span className="text-[11px] text-slate-500">
                  {calculationMode === 'DIRECT' ? 'Sueldo Bruto → Descuentos → Líquido' : 'Líquido Deseado → Cálculo Inverso Sueldo Bruto'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setCalculationMode('DIRECT')}
                  className={`py-2 px-3 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    calculationMode === 'DIRECT'
                      ? 'bg-[#2563eb] text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <DollarSign className="w-4 h-4" />
                  <span>Partir de Sueldo Bruto</span>
                </button>
                <button
                  onClick={() => setCalculationMode('REVERSE')}
                  className={`py-2 px-3 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    calculationMode === 'REVERSE'
                      ? 'bg-purple-700 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Cálculo Inverso (Partir de Líquido)</span>
                </button>
              </div>

              {calculationMode === 'REVERSE' && (
                <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded-md text-xs space-y-1">
                  <label className="block font-bold text-purple-900">
                    Sueldo Líquido que el Trabajador Desea Recibir en su Cuenta ($):
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      step="10000"
                      value={sueldoLiquidoDeseado}
                      onChange={(e) => setSueldoLiquidoDeseado(Math.max(0, Number(e.target.value)))}
                      className="w-full bg-white border border-purple-300 rounded-md p-2 font-mono text-base font-extrabold text-purple-900 focus:outline-none focus:border-purple-600"
                    />
                    <span className="shrink-0 font-bold text-purple-700 font-mono">
                      {formatCLP(sueldoLiquidoDeseado)}
                    </span>
                  </div>
                  <p className="text-[10px] text-purple-700">
                    El motor resolverá iterativamente el Sueldo Base Bruto necesario considerando AFP, Fonasa/Isapre, AFC e Impuesto Único.
                  </p>
                </div>
              )}
            </div>

            {/* General Employee Data */}
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4 text-xs">
              <h3 className="font-extrabold text-[#0f172a] text-xs uppercase tracking-wider flex items-center gap-2 border-b border-slate-200 pb-2">
                <Users className="w-4 h-4 text-[#2563eb]" />
                <span>1. Datos del Colaborador & Contrato</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-slate-700 font-semibold mb-1">Nombre Completo:</label>
                  <input
                    type="text"
                    value={nombreCompleto}
                    onChange={(e) => setNombreCompleto(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-md p-2 text-slate-900 font-medium focus:outline-none focus:border-[#2563eb] focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">RUT:</label>
                  <input
                    type="text"
                    value={rut}
                    onChange={(e) => setRut(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-md p-2 font-mono text-slate-900 focus:outline-none focus:border-[#2563eb] focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Cargo:</label>
                  <input
                    type="text"
                    value={cargo}
                    onChange={(e) => setCargo(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-md p-2 text-slate-900 focus:outline-none focus:border-[#2563eb] focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Tipo de Contrato:</label>
                  <select
                    value={tipoContrato}
                    onChange={(e) => setTipoContrato(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-md p-2 text-slate-900 font-medium focus:outline-none focus:border-[#2563eb]"
                  >
                    <option value="INDEFINIDO">Indefinido (AFC 0.6% trab / 2.4% emp)</option>
                    <option value="PLAZO_FIJO">Plazo Fijo / Obra (AFC 0% trab / 3.0% emp)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Jornada Semanal:</label>
                  <select
                    value={jornadaSemanal}
                    onChange={(e) => setJornadaSemanal(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-md p-2 text-slate-900 font-medium focus:outline-none focus:border-[#2563eb]"
                  >
                    <option value={44}>44 Horas (Jornada General)</option>
                    <option value={40}>40 Horas (Ley 40 Horas)</option>
                    <option value={45}>45 Horas (Régimen Anterior)</option>
                    <option value={30}>30 Horas (Jornada Parcial)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Haberes Imponibles */}
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4 text-xs">
              <h3 className="font-extrabold text-[#0f172a] text-xs uppercase tracking-wider flex items-center gap-2 border-b border-slate-200 pb-2">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                <span>2. Haberes Imponibles & Gratificación</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Sueldo Base Mensual ($):
                    {calculationMode === 'REVERSE' && (
                      <span className="ml-1 text-[10px] text-purple-700 font-bold font-mono">
                        (Calculado automáticamente)
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    step="10000"
                    disabled={calculationMode === 'REVERSE'}
                    value={effectiveBaseSalary}
                    onChange={(e) => setSueldoBase(Math.max(0, Number(e.target.value)))}
                    className={`w-full border rounded-md p-2 font-mono text-sm font-bold ${
                      calculationMode === 'REVERSE'
                        ? 'bg-purple-50 text-purple-900 border-purple-300'
                        : 'bg-white border-slate-300 text-slate-900 focus:border-[#2563eb]'
                    }`}
                  />
                  <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                    <span>IMM de Referencia: {formatCLP(indicators.imm)}</span>
                    <span className="font-bold text-slate-800">{formatCLP(effectiveBaseSalary)}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Modalidad de Gratificación:</label>
                  <select
                    value={gratificacionModalidad}
                    onChange={(e) => setGratificacionModalidad(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-md p-2 text-slate-900 font-medium focus:outline-none focus:border-[#2563eb]"
                  >
                    <option value="ART_50">Art. 50 (25% con tope 4.75 IMM / 12 = {formatCLP((4.75 * indicators.imm) / 12)})</option>
                    <option value="PACTADA">Gratificación Fija Pactada</option>
                    <option value="NINGUNA">Sin Gratificación Mensual (o Art. 47 anual)</option>
                  </select>
                  {gratificacionModalidad === 'PACTADA' && (
                    <div className="mt-2">
                      <input
                        type="number"
                        placeholder="Monto Gratificación Pactada ($)"
                        value={gratificacionPactada}
                        onChange={(e) => setGratificacionPactada(Number(e.target.value))}
                        className="w-full bg-white border border-slate-300 rounded-md p-1.5 font-mono text-slate-900"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Variables: Horas Extras & Bonos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-700 font-semibold">Horas Extras al 50%:</label>
                    <span className="text-[10px] text-slate-500 font-mono font-bold">
                      Valor/Hora: {formatCLP(Math.round(effectiveBaseSalary * ((1 / 30) * (28 / jornadaSemanal) * 1.5)))}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="60"
                      value={horasExtrasCantidad}
                      onChange={(e) => setHorasExtrasCantidad(Math.max(0, Number(e.target.value)))}
                      className="w-24 bg-white border border-slate-300 rounded-md p-1.5 font-mono text-slate-900 font-bold"
                    />
                    <span className="text-slate-500 text-xs">horas</span>
                    <span className="ml-auto font-bold text-emerald-700 font-mono text-xs">
                      +{formatCLP(simulatedPayroll.horasExtrasMonto)}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Bonos / Comisiones Imponibles ($):</label>
                  <input
                    type="number"
                    step="10000"
                    value={comisionesBonos}
                    onChange={(e) => setComisionesBonos(Math.max(0, Number(e.target.value)))}
                    className="w-full bg-white border border-slate-300 rounded-md p-1.5 font-mono text-slate-900"
                  />
                  <div className="mt-1 text-right text-[11px] text-emerald-700 font-mono font-bold">
                    +{formatCLP(comisionesBonos)}
                  </div>
                </div>
              </div>
            </div>

            {/* Haberes No Imponibles (Asignaciones) */}
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4 text-xs">
              <h3 className="font-extrabold text-[#0f172a] text-xs uppercase tracking-wider flex items-center gap-2 border-b border-slate-200 pb-2">
                <Shield className="w-4 h-4 text-blue-600" />
                <span>3. Asignaciones No Imponibles (Colación / Movilización)</span>
              </h3>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Colación ($):</label>
                  <input
                    type="number"
                    step="5000"
                    value={colacion}
                    onChange={(e) => setColacion(Math.max(0, Number(e.target.value)))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-md p-1.5 font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Movilización ($):</label>
                  <input
                    type="number"
                    step="5000"
                    value={movilizacion}
                    onChange={(e) => setMovilizacion(Math.max(0, Number(e.target.value)))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-md p-1.5 font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Viáticos / Familiar ($):</label>
                  <input
                    type="number"
                    step="5000"
                    value={viaticos}
                    onChange={(e) => setViaticos(Math.max(0, Number(e.target.value)))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-md p-1.5 font-mono text-slate-900"
                  />
                </div>
              </div>
            </div>

            {/* Previsión (AFP) & Salud (Fonasa / Isapre) */}
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4 text-xs">
              <h3 className="font-extrabold text-[#0f172a] text-xs uppercase tracking-wider flex items-center gap-2 border-b border-slate-200 pb-2">
                <Briefcase className="w-4 h-4 text-purple-600" />
                <span>4. Institución Previsional (AFP) & Salud</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Administradora de Fondos de Pensiones (AFP):</label>
                  <select
                    value={afpNombre}
                    onChange={(e) => setAfpNombre(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-md p-2 text-slate-900 font-semibold focus:outline-none focus:border-[#2563eb]"
                  >
                    <option value="HABITAT">AFP Habitat (11.27% = 10% + 1.27% com.)</option>
                    <option value="CUPRUM">AFP Cuprum (11.44% = 10% + 1.44% com.)</option>
                    <option value="CAPITAL">AFP Capital (11.44% = 10% + 1.44% com.)</option>
                    <option value="PROVIDA">AFP Provida (11.45% = 10% + 1.45% com.)</option>
                    <option value="PLANVITAL">AFP PlanVital (11.16% = 10% + 1.16% com.)</option>
                    <option value="MODELO">AFP Modelo (10.58% = 10% + 0.58% com.)</option>
                    <option value="UNO">AFP Uno (10.49% = 10% + 0.49% com.)</option>
                  </select>
                  <div className="mt-1 text-[11px] text-slate-500 font-mono flex justify-between">
                    <span>Tasa Aplicada: {(AFP_RATES[afpNombre] * 100).toFixed(2)}%</span>
                    <span className="text-purple-700 font-bold">-{formatCLP(simulatedPayroll.afpMonto)}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Sistema de Salud:</label>
                  <select
                    value={saludTipo}
                    onChange={(e) => setSaludTipo(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-md p-2 text-slate-900 font-semibold focus:outline-none focus:border-[#2563eb]"
                  >
                    <option value="FONASA">Fonasa (7.00% Legal)</option>
                    <option value="ISAPRE">Isapre (Plan en UF)</option>
                  </select>

                  {saludTipo === 'ISAPRE' && (
                    <div className="mt-2 flex items-center gap-2">
                      <label className="text-slate-600 text-[11px] font-semibold shrink-0">Plan Pactado (UF):</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        value={saludPlanUf}
                        onChange={(e) => setSaludPlanUf(Math.max(0, Number(e.target.value)))}
                        className="w-full bg-white border border-slate-300 rounded-md p-1.5 font-mono text-slate-900 font-bold"
                      />
                    </div>
                  )}

                  <div className="mt-1 text-[11px] text-slate-500 font-mono flex justify-between">
                    <span>{saludTipo === 'ISAPRE' ? `${saludPlanUf} UF` : '7% imponible'}</span>
                    <span className="text-rose-700 font-bold">-{formatCLP(simulatedPayroll.saludMonto)}</span>
                  </div>
                </div>
              </div>

              {/* APV & Otros Descuentos */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">APV Ahorro Voluntario ($):</label>
                  <input
                    type="number"
                    step="10000"
                    value={apvMonto}
                    onChange={(e) => setApvMonto(Math.max(0, Number(e.target.value)))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-md p-1.5 font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Otros Descuentos (Préstamos, etc.) ($):</label>
                  <input
                    type="number"
                    step="5000"
                    value={otrosDescuentos}
                    onChange={(e) => setOtrosDescuentos(Math.max(0, Number(e.target.value)))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-md p-1.5 font-mono text-slate-900"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Detailed Breakdown, Worker vs Employer, Actions (5 cols) */}
          <div className="lg:col-span-5 space-y-5">
            {/* Primary Result Hero Card */}
            <div className="bg-[#0f172a] text-white rounded-lg p-5 shadow-md border-t-4 border-[#2563eb] space-y-4">
              <div>
                <span className="text-[10px] font-bold text-blue-300 uppercase tracking-widest block">
                  RESULTADO FINAL DE LA SIMULACIÓN
                </span>
                <div className="mt-1 text-3xl sm:text-4xl font-black text-white font-mono tracking-tight">
                  {formatCLP(simulatedPayroll.sueldoLiquido)}
                </div>
                <div className="text-xs text-slate-300 mt-0.5">
                  Líquido a pagar en cuenta bancaria del colaborador
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/10 font-mono text-xs">
                <div>
                  <span className="text-slate-400 text-[10px] block">TOTAL HABERES BRUTOS:</span>
                  <span className="text-emerald-400 font-bold">{formatCLP(simulatedPayroll.totalHaberesBrutos)}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">COSTO TOTAL EMPRESA:</span>
                  <span className="text-amber-400 font-bold">{formatCLP(simulatedPayroll.costoTotalEmpresa)}</span>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="pt-2 flex flex-col gap-2">
                <button
                  onClick={handleAddToPayroll}
                  className="w-full py-2.5 px-4 bg-[#2563eb] hover:bg-blue-600 text-white rounded-md text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center justify-center gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Incorporar a la Nómina Activa de la Empresa</span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setShowPayslipModal(true)}
                    className="py-2 px-3 bg-white/10 hover:bg-white/20 text-slate-200 rounded-md text-xs font-semibold cursor-pointer flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5 text-blue-300" />
                    <span>Ver Liquidación</span>
                  </button>
                  <button
                    onClick={handleCentralizeSimulation}
                    className="py-2 px-3 bg-white/10 hover:bg-white/20 text-slate-200 rounded-md text-xs font-semibold cursor-pointer flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <FileCode className="w-3.5 h-3.5 text-emerald-300" />
                    <span>Asiento Contable</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Waterfall Breakdown: Haberes vs Descuentos vs Costos Empleador */}
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4 text-xs">
              <h3 className="font-extrabold text-[#0f172a] text-xs uppercase tracking-wider border-b border-slate-200 pb-2">
                Desglose Analítico Completo
              </h3>

              {/* 1. Haberes */}
              <div className="space-y-1.5 font-mono">
                <div className="font-sans font-bold text-slate-800 text-[11px] flex justify-between">
                  <span>1. Haberes Imponibles & No Imponibles</span>
                  <span className="text-emerald-700">{formatCLP(simulatedPayroll.totalHaberesBrutos)}</span>
                </div>
                <div className="pl-2 space-y-1 text-[11px] text-slate-600">
                  <div className="flex justify-between">
                    <span>• Sueldo Base:</span>
                    <span>{formatNumberCL(simulatedPayroll.sueldoBase)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>• Gratificación Legal (Art. 50):</span>
                    <span>+{formatNumberCL(simulatedPayroll.gratificacionMonto)}</span>
                  </div>
                  {simulatedPayroll.horasExtrasMonto > 0 && (
                    <div className="flex justify-between">
                      <span>• Horas Extras ({simulatedPayroll.horasExtrasCantidad} hrs al 50%):</span>
                      <span>+{formatNumberCL(simulatedPayroll.horasExtrasMonto)}</span>
                    </div>
                  )}
                  {simulatedPayroll.comisionesBonosImponibles > 0 && (
                    <div className="flex justify-between">
                      <span>• Bonos y Comisiones:</span>
                      <span>+{formatNumberCL(simulatedPayroll.comisionesBonosImponibles)}</span>
                    </div>
                  )}
                  <div className="pt-1 border-t border-slate-100 flex justify-between font-bold text-slate-800">
                    <span>Subtotal Imponible:</span>
                    <span>{formatNumberCL(simulatedPayroll.totalHaberesImponibles)}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>• No Imponibles (Colación/Mov/Viáticos):</span>
                    <span>+{formatNumberCL(simulatedPayroll.totalHaberesNoImponibles)}</span>
                  </div>
                </div>
              </div>

              {/* 2. Descuentos Trabajador */}
              <div className="space-y-1.5 font-mono pt-3 border-t border-slate-200">
                <div className="font-sans font-bold text-slate-800 text-[11px] flex justify-between">
                  <span>2. Descuentos Obligatorios al Trabajador</span>
                  <span className="text-rose-600">-{formatCLP(simulatedPayroll.totalDescuentos)}</span>
                </div>
                <div className="pl-2 space-y-1 text-[11px] text-slate-600">
                  <div className="flex justify-between">
                    <span>• Previsión AFP {simulatedPayroll.afpNombre} ({(simulatedPayroll.afpTasa * 100).toFixed(2)}%):</span>
                    <span className="text-purple-700 font-bold">-{formatNumberCL(simulatedPayroll.afpMonto)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>• Salud ({simulatedPayroll.saludTipo}):</span>
                    <span className="text-rose-700 font-bold">-{formatNumberCL(simulatedPayroll.saludMonto)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>• Seguro de Cesantía AFC Trabajador ({tipoContrato === 'INDEFINIDO' ? '0.6%' : '0%'}):</span>
                    <span>-{formatNumberCL(simulatedPayroll.afcTrabajadorMonto)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>• Impuesto Único 2da Categoría (UTM):</span>
                    <span className="text-amber-700 font-bold">
                      {simulatedPayroll.impuestoUnicoMonto > 0 ? `-${formatNumberCL(simulatedPayroll.impuestoUnicoMonto)}` : 'Exento ($0)'}
                    </span>
                  </div>
                  {simulatedPayroll.otrosDescuentos > 0 && (
                    <div className="flex justify-between">
                      <span>• APV / Otros Descuentos:</span>
                      <span>-{formatNumberCL(simulatedPayroll.otrosDescuentos)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 3. Costos Empleador (Aporte Patronal) */}
              <div className="space-y-1.5 font-mono pt-3 border-t border-slate-200 bg-amber-50/60 p-3 rounded-lg border border-amber-200">
                <div className="font-sans font-bold text-amber-900 text-[11px] flex justify-between">
                  <span>3. Aportes Patronales (Costos Empresa)</span>
                  <span className="text-amber-800">
                    +{formatCLP(simulatedPayroll.sisEmpleadorMonto + simulatedPayroll.mutualEmpleadorMonto + simulatedPayroll.afcEmpleadorMonto)}
                  </span>
                </div>
                <div className="space-y-1 text-[10.5px] text-amber-950">
                  <div className="flex justify-between">
                    <span>• SIS (Seguro Invalidez y Sobrevivencia - {((indicators.sisTasa || 0.0149) * 100).toFixed(2)}%):</span>
                    <span>+{formatNumberCL(simulatedPayroll.sisEmpleadorMonto)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>• Mutual de Seguridad Ley 16.744 ({(((indicators.mutualBaseTasa || 0.0093) + mutualAdicionalTasa) * 100).toFixed(2)}%):</span>
                    <span>+{formatNumberCL(simulatedPayroll.mutualEmpleadorMonto)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>• AFC Empleador ({tipoContrato === 'INDEFINIDO' ? '2.40%' : '3.00%'}):</span>
                    <span>+{formatNumberCL(simulatedPayroll.afcEmpleadorMonto)}</span>
                  </div>
                </div>
                <div className="pt-2 border-t border-amber-200 flex justify-between font-bold text-amber-950 text-xs">
                  <span>COSTO TOTAL REAL PARA LA EMPRESA:</span>
                  <span>{formatCLP(simulatedPayroll.costoTotalEmpresa)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: MULTI-SCENARIO COMPARISON */}
      {activeSubTab === 'SCENARIOS' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
            <h3 className="font-extrabold text-[#0f172a] text-sm flex items-center gap-2 mb-2">
              <Layers className="w-5 h-5 text-purple-600" />
              <span>Comparador de Escenarios Laborales Lado a Lado</span>
            </h3>
            <p className="text-xs text-slate-500">
              Analiza cómo impactan las variables de tipo de contrato, jornada, horas extras, AFPs y planes de Isapre en el sueldo líquido y en el costo total de la empresa.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Escenario A */}
            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-4 text-xs">
              <div className="border-b border-slate-200 pb-2">
                <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold text-[10px] border border-blue-200">
                  Escenario 1
                </span>
                <input
                  type="text"
                  value={scenarioA.title}
                  onChange={(e) => setScenarioA(prev => ({ ...prev, title: e.target.value }))}
                  className="font-bold text-[#0f172a] text-xs w-full mt-1 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-[#2563eb] focus:outline-none"
                />
              </div>

              <div className="space-y-2">
                <div>
                  <label className="text-slate-600 font-semibold block text-[11px]">Sueldo Base ($):</label>
                  <input
                    type="number"
                    step="50000"
                    value={scenarioA.sueldoBase}
                    onChange={(e) => setScenarioA(prev => ({ ...prev, sueldoBase: Number(e.target.value) }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 font-mono text-slate-900 font-bold"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-slate-600 font-semibold block text-[10px]">Contrato:</label>
                    <select
                      value={scenarioA.tipoContrato}
                      onChange={(e) => setScenarioA(prev => ({ ...prev, tipoContrato: e.target.value as any }))}
                      className="w-full bg-slate-50 border border-slate-300 rounded p-1 text-slate-900"
                    >
                      <option value="INDEFINIDO">Indefinido</option>
                      <option value="PLAZO_FIJO">Plazo Fijo</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-600 font-semibold block text-[10px]">Salud:</label>
                    <select
                      value={scenarioA.saludTipo}
                      onChange={(e) => setScenarioA(prev => ({ ...prev, saludTipo: e.target.value as any }))}
                      className="w-full bg-slate-50 border border-slate-300 rounded p-1 text-slate-900"
                    >
                      <option value="FONASA">Fonasa</option>
                      <option value="ISAPRE">Isapre</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Metric Card A */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 font-mono space-y-1.5">
                <div className="flex justify-between font-sans">
                  <span className="text-slate-500 font-medium">Líquido a Pagar:</span>
                  <span className="font-extrabold text-[#2563eb] text-sm">{formatCLP(resA.sueldoLiquido)}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500">Impuesto Único:</span>
                  <span className="text-amber-700 font-bold">{resA.impuestoUnicoMonto > 0 ? formatCLP(resA.impuestoUnicoMonto) : '$0'}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500">Descuentos Prev.:</span>
                  <span className="text-rose-600 font-bold">{formatCLP(resA.totalDescuentos)}</span>
                </div>
                <div className="pt-1.5 border-t border-slate-200 flex justify-between font-sans font-bold text-slate-900">
                  <span>Costo Empresa:</span>
                  <span className="text-amber-800">{formatCLP(resA.costoTotalEmpresa)}</span>
                </div>
              </div>
            </div>

            {/* Escenario B */}
            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-4 text-xs">
              <div className="border-b border-slate-200 pb-2">
                <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 font-bold text-[10px] border border-purple-200">
                  Escenario 2
                </span>
                <input
                  type="text"
                  value={scenarioB.title}
                  onChange={(e) => setScenarioB(prev => ({ ...prev, title: e.target.value }))}
                  className="font-bold text-[#0f172a] text-xs w-full mt-1 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-[#2563eb] focus:outline-none"
                />
              </div>

              <div className="space-y-2">
                <div>
                  <label className="text-slate-600 font-semibold block text-[11px]">Sueldo Base ($):</label>
                  <input
                    type="number"
                    step="50000"
                    value={scenarioB.sueldoBase}
                    onChange={(e) => setScenarioB(prev => ({ ...prev, sueldoBase: Number(e.target.value) }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 font-mono text-slate-900 font-bold"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-slate-600 font-semibold block text-[10px]">Horas Extras:</label>
                    <input
                      type="number"
                      value={scenarioB.horasExtras}
                      onChange={(e) => setScenarioB(prev => ({ ...prev, horasExtras: Number(e.target.value) }))}
                      className="w-full bg-slate-50 border border-slate-300 rounded p-1 font-mono text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-slate-600 font-semibold block text-[10px]">Plan Isapre (UF):</label>
                    <input
                      type="number"
                      step="0.1"
                      value={scenarioB.saludPlanUf}
                      onChange={(e) => setScenarioB(prev => ({ ...prev, saludPlanUf: Number(e.target.value) }))}
                      className="w-full bg-slate-50 border border-slate-300 rounded p-1 font-mono text-slate-900"
                    />
                  </div>
                </div>
              </div>

              {/* Metric Card B */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 font-mono space-y-1.5">
                <div className="flex justify-between font-sans">
                  <span className="text-slate-500 font-medium">Líquido a Pagar:</span>
                  <span className="font-extrabold text-[#2563eb] text-sm">{formatCLP(resB.sueldoLiquido)}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500">Impuesto Único:</span>
                  <span className="text-amber-700 font-bold">{resB.impuestoUnicoMonto > 0 ? formatCLP(resB.impuestoUnicoMonto) : '$0'}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500">Descuentos Prev.:</span>
                  <span className="text-rose-600 font-bold">{formatCLP(resB.totalDescuentos)}</span>
                </div>
                <div className="pt-1.5 border-t border-slate-200 flex justify-between font-sans font-bold text-slate-900">
                  <span>Costo Empresa:</span>
                  <span className="text-amber-800">{formatCLP(resB.costoTotalEmpresa)}</span>
                </div>
              </div>
            </div>

            {/* Escenario C */}
            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-4 text-xs">
              <div className="border-b border-slate-200 pb-2">
                <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold text-[10px] border border-emerald-200">
                  Escenario 3
                </span>
                <input
                  type="text"
                  value={scenarioC.title}
                  onChange={(e) => setScenarioC(prev => ({ ...prev, title: e.target.value }))}
                  className="font-bold text-[#0f172a] text-xs w-full mt-1 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-[#2563eb] focus:outline-none"
                />
              </div>

              <div className="space-y-2">
                <div>
                  <label className="text-slate-600 font-semibold block text-[11px]">Sueldo Base ($):</label>
                  <input
                    type="number"
                    step="100000"
                    value={scenarioC.sueldoBase}
                    onChange={(e) => setScenarioC(prev => ({ ...prev, sueldoBase: Number(e.target.value) }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 font-mono text-slate-900 font-bold"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-slate-600 font-semibold block text-[10px]">Bonos Imponibles:</label>
                    <input
                      type="number"
                      step="50000"
                      value={scenarioC.bonos}
                      onChange={(e) => setScenarioC(prev => ({ ...prev, bonos: Number(e.target.value) }))}
                      className="w-full bg-slate-50 border border-slate-300 rounded p-1 font-mono text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-slate-600 font-semibold block text-[10px]">Contrato:</label>
                    <select
                      value={scenarioC.tipoContrato}
                      onChange={(e) => setScenarioC(prev => ({ ...prev, tipoContrato: e.target.value as any }))}
                      className="w-full bg-slate-50 border border-slate-300 rounded p-1 text-slate-900"
                    >
                      <option value="INDEFINIDO">Indefinido</option>
                      <option value="PLAZO_FIJO">Plazo Fijo</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Metric Card C */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 font-mono space-y-1.5">
                <div className="flex justify-between font-sans">
                  <span className="text-slate-500 font-medium">Líquido a Pagar:</span>
                  <span className="font-extrabold text-[#2563eb] text-sm">{formatCLP(resC.sueldoLiquido)}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500">Impuesto Único:</span>
                  <span className="text-amber-700 font-bold">{resC.impuestoUnicoMonto > 0 ? formatCLP(resC.impuestoUnicoMonto) : '$0'}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500">Descuentos Prev.:</span>
                  <span className="text-rose-600 font-bold">{formatCLP(resC.totalDescuentos)}</span>
                </div>
                <div className="pt-1.5 border-t border-slate-200 flex justify-between font-sans font-bold text-slate-900">
                  <span>Costo Empresa:</span>
                  <span className="text-amber-800">{formatCLP(resC.costoTotalEmpresa)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: OFFICIAL TAX BRACKET INSPECTOR */}
      {activeSubTab === 'TAX_TABLE' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
            <h3 className="font-extrabold text-[#0f172a] text-sm flex items-center gap-2 mb-1">
              <Percent className="w-5 h-5 text-amber-600" />
              <span>Tabla Oficial de Impuesto Único de Segunda Categoría (SII Chile)</span>
            </h3>
            <p className="text-xs text-slate-500">
              Valor UTM vigente de referencia: <span className="font-mono font-bold text-slate-800">{formatCLP(indicators.utm)}</span>. 
              La base imponible tributable del trabajador actual es de <span className="font-mono font-bold text-blue-700">{formatCLP(baseTributablePesos)}</span> ({baseTributableUtm.toFixed(2)} UTM).
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-[#f1f5f9] text-slate-600 font-semibold border-b border-slate-200 text-[11px]">
                  <tr>
                    <th className="px-4 py-3">Tramo</th>
                    <th className="px-4 py-3">Desde (UTM)</th>
                    <th className="px-4 py-3">Hasta (UTM)</th>
                    <th className="px-4 py-3 text-right">Rango en Pesos ($ CLP)</th>
                    <th className="px-4 py-3 text-center">Factor Tasa</th>
                    <th className="px-4 py-3 text-right">Cantidad a Rebajar (UTM)</th>
                    <th className="px-4 py-3 text-center">Estado Trabajador</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {taxBrackets.map((b) => {
                    const isCurrent = baseTributableUtm > b.desdeUtm && (b.hastaUtm >= 9999 ? true : baseTributableUtm <= b.hastaUtm);
                    const minCLP = Math.round(b.desdeUtm * indicators.utm);
                    const maxCLP = b.hastaUtm >= 9999 ? 'En adelante' : formatCLP(Math.round(b.hastaUtm * indicators.utm));

                    return (
                      <tr key={b.tramo} className={isCurrent ? 'bg-amber-50/80 font-bold' : 'hover:bg-slate-50'}>
                        <td className="px-4 py-3 font-sans">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isCurrent ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-600'
                          }`}>
                            Tramo {b.tramo}
                          </span>
                        </td>
                        <td className="px-4 py-3">{b.desdeUtm.toFixed(2)} UTM</td>
                        <td className="px-4 py-3">{b.hastaUtm >= 9999 ? 'Más' : `${b.hastaUtm.toFixed(2)} UTM`}</td>
                        <td className="px-4 py-3 text-right">
                          {formatCLP(minCLP)} - {maxCLP}
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-slate-900">
                          {b.factor === 0 ? 'Exento (0%)' : `${(b.factor * 100).toFixed(1)}%`}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600">
                          {b.rebajaUtm > 0 ? `${b.rebajaUtm.toFixed(2)} UTM (${formatCLP(b.rebajaUtm * indicators.utm)})` : '$0'}
                        </td>
                        <td className="px-4 py-3 text-center font-sans">
                          {isCurrent ? (
                            <span className="inline-flex items-center gap-1 text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full text-[10px] font-bold border border-amber-300">
                              <CheckCircle2 className="w-3 h-3 text-amber-700" />
                              <span>Tramo Activo</span>
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Liquidación Oficial de Sueldo */}
      {showPayslipModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg w-full max-w-3xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-150">
            <div className="px-6 py-4 bg-[#0f172a] text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-white text-sm sm:text-base">
                  Liquidación Oficial de Sueldo DT (Simulación)
                </h3>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-md text-xs font-semibold cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-blue-300" />
                  <span>Imprimir / PDF</span>
                </button>
                <button
                  onClick={() => setShowPayslipModal(false)}
                  className="text-slate-300 hover:text-white text-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-xs font-mono bg-white text-slate-800">
              {/* Header Empresa y Colaborador */}
              <div className="border-b border-slate-200 pb-4 grid grid-cols-2 gap-4">
                <div>
                  <div className="font-bold text-[#0f172a] text-sm">{company.razonSocial}</div>
                  <div className="text-slate-500">RUT: {company.rut}</div>
                  <div className="text-slate-500">{company.direccion}, {company.comuna}</div>
                  <div className="text-slate-500">Giro: {company.giro}</div>
                </div>
                <div className="text-right">
                  <div className="text-[#2563eb] font-extrabold text-sm">LIQUIDACIÓN DE SUELDO</div>
                  <div className="text-slate-600 font-bold">Periodo: {new Date().toISOString().substring(0, 7)}</div>
                  <div className="text-slate-500">Días Trabajados: {simulatedPayroll.diasTrabajados}</div>
                </div>
              </div>

              {/* Datos Trabajador */}
              <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 grid grid-cols-3 gap-3">
                <div>
                  <span className="text-slate-500 block text-[10px] font-semibold">TRABAJADOR:</span>
                  <span className="font-bold text-slate-900 font-sans">{simulatedPayroll.nombreCompleto}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] font-semibold">RUT:</span>
                  <span className="font-bold text-slate-900">{simulatedPayroll.rut}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] font-semibold">CARGO:</span>
                  <span className="font-sans text-slate-800">{simulatedPayroll.cargo}</span>
                </div>
              </div>

              {/* Grid Haberes vs Descuentos */}
              <div className="grid grid-cols-2 gap-4">
                {/* Haberes */}
                <div className="border border-slate-200 rounded-lg p-3.5 bg-slate-50/50 space-y-2">
                  <div className="font-bold text-emerald-700 border-b border-slate-200 pb-1.5 uppercase text-[11px]">
                    1. Haberes ($)
                  </div>
                  <div className="space-y-1 text-slate-700 text-[11px]">
                    <div className="flex justify-between">
                      <span>Sueldo Base:</span>
                      <span>{formatNumberCL(simulatedPayroll.sueldoBase)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Gratificación Legal Art. 50:</span>
                      <span>{formatNumberCL(simulatedPayroll.gratificacionMonto)}</span>
                    </div>
                    {simulatedPayroll.horasExtrasMonto > 0 && (
                      <div className="flex justify-between">
                        <span>Horas Extras ({simulatedPayroll.horasExtrasCantidad} hrs):</span>
                        <span>{formatNumberCL(simulatedPayroll.horasExtrasMonto)}</span>
                      </div>
                    )}
                    {simulatedPayroll.comisionesBonosImponibles > 0 && (
                      <div className="flex justify-between">
                        <span>Bonos Imponibles:</span>
                        <span>{formatNumberCL(simulatedPayroll.comisionesBonosImponibles)}</span>
                      </div>
                    )}
                    <div className="pt-1.5 border-t border-slate-200 font-bold text-slate-900 flex justify-between">
                      <span>TOTAL IMPONIBLE:</span>
                      <span className="text-emerald-700">{formatNumberCL(simulatedPayroll.totalHaberesImponibles)}</span>
                    </div>

                    <div className="pt-2 text-slate-500 text-[10px] font-semibold">Haberes No Imponibles:</div>
                    <div className="flex justify-between text-slate-600">
                      <span>Colación:</span>
                      <span>{formatNumberCL(simulatedPayroll.asignacionColacion)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Movilización:</span>
                      <span>{formatNumberCL(simulatedPayroll.asignacionMovilizacion)}</span>
                    </div>
                    <div className="pt-1.5 border-t border-slate-200 font-black text-slate-900 flex justify-between">
                      <span>TOTAL HABERES:</span>
                      <span>{formatCLP(simulatedPayroll.totalHaberesBrutos)}</span>
                    </div>
                  </div>
                </div>

                {/* Descuentos Legales */}
                <div className="border border-slate-200 rounded-lg p-3.5 bg-slate-50/50 space-y-2">
                  <div className="font-bold text-rose-700 border-b border-slate-200 pb-1.5 uppercase text-[11px]">
                    2. Descuentos Legales ($)
                  </div>
                  <div className="space-y-1 text-slate-700 text-[11px]">
                    <div className="flex justify-between">
                      <span>AFP {simulatedPayroll.afpNombre} ({(simulatedPayroll.afpTasa * 100).toFixed(2)}%):</span>
                      <span>{formatNumberCL(simulatedPayroll.afpMonto)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Salud {simulatedPayroll.saludTipo}:</span>
                      <span>{formatNumberCL(simulatedPayroll.saludMonto)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Seguro Cesantía AFC ({tipoContrato === 'INDEFINIDO' ? '0.6%' : '0%'}):</span>
                      <span>{formatNumberCL(simulatedPayroll.afcTrabajadorMonto)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Impuesto Único 2da Cat:</span>
                      <span className="text-amber-700 font-bold">{formatNumberCL(simulatedPayroll.impuestoUnicoMonto)}</span>
                    </div>
                    <div className="pt-3 border-t border-slate-200 font-black text-slate-900 flex justify-between">
                      <span>TOTAL DESCUENTOS:</span>
                      <span className="text-rose-600">-{formatCLP(simulatedPayroll.totalDescuentos)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Total Líquido a Recibir */}
              <div className="bg-[#eff6ff] p-4 rounded-lg border border-[#2563eb]/30 flex items-center justify-between">
                <div>
                  <span className="text-slate-600 text-xs font-bold uppercase tracking-wider block">
                    ALCANCE LÍQUIDO A PAGAR:
                  </span>
                  <span className="text-[10px] text-slate-500 font-sans">
                    Son: {formatCLP(simulatedPayroll.sueldoLiquido)} pesos chilenos.
                  </span>
                </div>
                <div className="text-2xl font-black text-[#2563eb]">
                  {formatCLP(simulatedPayroll.sueldoLiquido)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Visor Asiento Contable Normalizado en Formato Estándar Oficial */}
      {showEntryModal && (() => {
        const entry = createPayrollCentralizationEntry([simulatedPayroll], new Date().toISOString().substring(0, 7));
        return (
          <StandardJournalEntryModal
            isOpen={showEntryModal}
            onClose={() => setShowEntryModal(false)}
            title="Asiento de Centralización de Remuneraciones"
            subtitle={`Folio N° ${entry.id} • Fecha ${entry.fecha}`}
            entry={{
              id: entry.id,
              fecha: entry.fecha,
              glosaGeneral: entry.concepto,
              documentoRef: entry.documento,
              origenModulo: entry.origen || 'REMUNERACIONES',
              lineas: entry.lineas.map((l) => ({
                codigoCuenta: l.cuentaCodigo,
                nombreCuenta: l.cuentaNombre,
                debe: l.debe,
                haber: l.haber,
                rutAuxiliar: l.rutAuxiliar,
                centroCosto: l.centroCosto,
              })),
              totalDebe: entry.totalDebe,
              totalHaber: entry.totalHaber,
              supervisorSignature: entry.supervisorSignature,
            }}
          />
        );
      })()}
    </div>
  );
};
