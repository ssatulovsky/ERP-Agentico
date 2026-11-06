import React, { useState, useMemo } from 'react';
import {
  Calendar,
  History,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  FileText,
  DollarSign,
  TrendingUp,
  ArrowRight,
  ShieldCheck,
  Send,
  Eye,
  Info,
  Clock,
  Sparkles,
  Layers,
  FileCheck2,
  Printer,
  ChevronRight,
  UserCheck,
  CreditCard,
  Building2,
  Users
} from 'lucide-react';
import type { 
  EmployeePayroll, 
  ChileIndicators, 
  AccountingEntry, 
  CompanyProfile,
  PayrollReliquidationAdjustment,
  SocialSecurityHistoricalPayment,
  PayrollConceptEvolutionPoint
} from '../../types';
import { formatCLP, formatNumberCL } from '../../utils/chileanAccounting';
import { HrManagementService, RetroactiveAdjustmentInput } from '../../services/hrManagementService';
import { HistoricalPayslipModal } from './HistoricalPayslipModal';
import { HistoricalPreviredPaymentModal } from './HistoricalPreviredPaymentModal';
import { periodoActual, etiquetaPeriodo } from '../../utils/periodo';

interface Props {
  company: CompanyProfile;
  indicators: ChileIndicators;
  payrolls: EmployeePayroll[];
  onAddAccountingEntry: (entry: AccountingEntry) => void;
}

export const PayrollHistoricalAndReliquidationsManager: React.FC<Props> = ({
  company,
  indicators,
  payrolls,
  onAddAccountingEntry,
}) => {
  const [activeTab, setActiveTab] = useState<'HISTORICAL' | 'CONCEPT_EVOLUTION' | 'PREVIRED_PAYMENTS' | 'RELIQUIDATIONS' | 'NEW_RELIQUIDATION'>('HISTORICAL');
  const [selectedPeriodo, setSelectedPeriodo] = useState<string>(periodoActual());
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(payrolls[0]?.id || '');
  const [selectedEmployeeForEvolution, setSelectedEmployeeForEvolution] = useState<string>(payrolls[0]?.rut || payrolls[0]?.id || '17.890.342-8');
  
  // Modales
  const [selectedPayslipForModal, setSelectedPayslipForModal] = useState<{ payroll: EmployeePayroll; periodo: string } | null>(null);
  const [selectedPreviredForModal, setSelectedPreviredForModal] = useState<SocialSecurityHistoricalPayment | null>(null);

  const [reliquidations, setReliquidations] = useState<PayrollReliquidationAdjustment[]>(() =>
    HrManagementService.getReliquidations(company.rut || company.id)
  );

  const [previredPayments, setPreviredPayments] = useState<SocialSecurityHistoricalPayment[]>(() =>
    HrManagementService.getHistoricalSocialSecurityPayments(company.rut || company.id)
  );

  const availablePeriods = useMemo(() => {
    return HrManagementService.getAvailableHistoricalPeriods(company.rut || company.id);
  }, [company.rut, company.id]);

  React.useEffect(() => {
    setReliquidations(HrManagementService.getReliquidations(company.rut || company.id));
    setPreviredPayments(HrManagementService.getHistoricalSocialSecurityPayments(company.rut || company.id));
  }, [company.rut, company.id]);

  const currentSettlements = useMemo(() => {
    const historical = HrManagementService.getHistoricalSettlements(company.rut || company.id, selectedPeriodo);
    if (historical.length > 0) return historical;
    return payrolls;
  }, [company.rut, company.id, selectedPeriodo, payrolls]);

  // Concept Evolution Data para el colaborador seleccionado
  const conceptEvolutionData = useMemo(() => {
    return HrManagementService.getConceptEvolutionForEmployee(
      company.rut || company.id,
      selectedEmployeeForEvolution
    );
  }, [company.rut, company.id, selectedEmployeeForEvolution]);

  // Formulario de nueva reliquidación retroactiva
  const [periodoDevengado, setPeriodoDevengado] = useState<string>('2026-06');
  const [periodoPago, setPeriodoPago] = useState<string>(periodoActual());
  const [motivoAjuste, setMotivoAjuste] = useState<RetroactiveAdjustmentInput['motivoAjuste']>(
    'AUMENTO_SUELDO_RETROACTIVO'
  );
  const [detalleMotivo, setDetalleMotivo] = useState<string>(
    'Reajuste retroactivo pactado en anexo de contrato'
  );
  const [diferencialSueldo, setDiferencialSueldo] = useState<number>(150000);
  const [diferencialHorasExtras, setDiferencialHorasExtras] = useState<number>(0);
  const [diferencialComisiones, setDiferencialComisiones] = useState<number>(0);
  const [diferencialGratificacion, setDiferencialGratificacion] = useState<number>(37500);

  const [lastCalculatedAdjustment, setLastCalculatedAdjustment] = useState<PayrollReliquidationAdjustment | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const selectedEmployee = useMemo(() => {
    return currentSettlements.find(p => p.id === selectedEmployeeId || p.rut === selectedEmployeeId) || currentSettlements[0] || payrolls[0];
  }, [currentSettlements, selectedEmployeeId, payrolls]);

  // Conceptos históricos originales del mes devengado para el colaborador seleccionado
  const originalDevengadoSettlement = useMemo(() => {
    if (!selectedEmployee) return null;
    const historical = HrManagementService.getHistoricalSettlements(company.rut || company.id, periodoDevengado);
    return historical.find(p => p.id === selectedEmployee.id || p.rut === selectedEmployee.rut) || null;
  }, [company.rut, company.id, periodoDevengado, selectedEmployee]);

  // Manejo de cálculo de reliquidación
  const handleCalculateAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) return;

    const utmHistorica = periodoDevengado === '2026-05' ? 67450 : periodoDevengado === '2026-06' ? 67800 : periodoDevengado === '2026-07' ? 68100 : indicators.utm;
    const baseOriginal = originalDevengadoSettlement ? originalDevengadoSettlement.totalHaberesImponibles : selectedEmployee.totalHaberesImponibles;
    const impuestoOriginal = originalDevengadoSettlement ? originalDevengadoSettlement.impuestoUnicoMonto : selectedEmployee.impuestoUnicoMonto;

    const input: RetroactiveAdjustmentInput = {
      empresaId: company.rut,
      employeeId: selectedEmployee.id,
      rutEmpleado: selectedEmployee.rut,
      nombreEmpleado: selectedEmployee.nombreCompleto,
      periodoDevengado,
      periodoPago,
      motivoAjuste,
      detalleMotivo,
      diferencialSueldoBase: diferencialSueldo,
      diferencialHorasExtras,
      diferencialComisiones,
      diferencialGratificacion,
      afpNombre: selectedEmployee.afpNombre as any,
      saludTipo: selectedEmployee.saludTipo as any,
      tipoContrato: selectedEmployee.tipoContrato,
      utmPeriodoDevengado: utmHistorica,
      ufPeriodoDevengado: indicators.uf,
      baseImponibleOriginal: baseOriginal,
      impuestoUnicoOriginal: impuestoOriginal,
    };

    const adjustment = HrManagementService.calculateRetroactiveAdjustment(input);
    setLastCalculatedAdjustment(adjustment);
    setReliquidations(HrManagementService.getReliquidations(company.rut));
    setFeedbackMsg(`¡Reliquidación retroactiva calculada con éxito bajo Art. 46 LIR! Se requiere aprobación humana para concretar.`);
  };

  // Aprobar reliquidación y contabilizar
  const handleApproveAdjustment = async (adjustment: PayrollReliquidationAdjustment) => {
    await HrManagementService.resolveApproval(
      adjustment.id,
      'Director de Finanzas (Usuario Humano)',
      true
    );
    adjustment.estado = 'APROBADO_Y_PAGADO';

    // Generar y asentar en el Libro Diario
    const entry = HrManagementService.generateReliquidationAccountingEntry(adjustment);
    onAddAccountingEntry(entry);
    adjustment.asientoAjusteId = entry.id;

    setReliquidations([...HrManagementService.getReliquidations(company.rut)]);
    setFeedbackMsg(`¡Ajuste retroactivo aprobado y contabilizado en el Libro Diario con folio ${entry.id}!`);
  };

  // Traspasar datos desde la pestaña de evolución de conceptos hacia la de reliquidación
  const handleUseEvolutionPointForReliquidation = (point: PayrollConceptEvolutionPoint) => {
    setSelectedEmployeeId(point.employeeId || point.rut);
    setPeriodoDevengado(point.periodo);
    setActiveTab('NEW_RELIQUIDATION');
    setFeedbackMsg(`Parámetros de ${point.nombreCompleto} para el período devengado ${point.periodo} cargados automáticamente.`);
  };

  return (
    <div className="space-y-6">
      {/* Sub-Tabs de Navegación Principal */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-200 pb-3 gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('HISTORICAL')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'HISTORICAL'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Liquidaciones & Recibos DT</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('CONCEPT_EVOLUTION')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'CONCEPT_EVOLUTION'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Matriz y Evolución de Conceptos</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('PREVIRED_PAYMENTS')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'PREVIRED_PAYMENTS'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Historial de Imposiciones (PreviRed)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('RELIQUIDATIONS')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'RELIQUIDATIONS'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reliquidaciones Art. 46 LIR ({reliquidations.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('NEW_RELIQUIDATION')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'NEW_RELIQUIDATION'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-rose-50 text-rose-800 border border-rose-300 hover:bg-rose-100'
            }`}
          >
            <Sparkles className="w-4 h-4 text-rose-600" />
            <span>+ Formular Reliquidación</span>
          </button>
        </div>

        {/* Badge de Normativa 2026 */}
        <div className="flex items-center gap-2 text-xs bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 font-mono">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Topes 2026: AFP 90.0 UF | AFC 135.2 UF | Ley 21.735 (1%)</span>
        </div>
      </div>

      {feedbackMsg && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-3 rounded-lg text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{feedbackMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackMsg(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold ml-4 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VISTA 1: HISTÓRICO DE LIQUIDACIONES Y CONSULTA DE RECIBOS DT              */}
      {/* ========================================================================= */}
      {activeTab === 'HISTORICAL' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <History className="w-4 h-4 text-blue-600" />
                Historial Inmutable de Liquidaciones de Sueldo & Recibos DT
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Almacén auditado mes a mes con visualización legal y descarga de Recibos de Sueldo oficiales según Art. 54 del Código del Trabajo.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-600">Período Histórico:</label>
              <select
                value={selectedPeriodo}
                onChange={(e) => setSelectedPeriodo(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 font-mono font-bold text-slate-800 cursor-pointer"
              >
                {availablePeriods.map(p => (
                  <option key={p} value={p}>{p} ({etiquetaPeriodo(p)})</option>
                ))}
              </select>
            </div>
          </div>

          {/* Tarjetas de Resumen Consolidado del Mes */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Total Colaboradores:</span>
              <span className="text-lg font-black font-mono text-slate-900">{currentSettlements.length}</span>
            </div>
            <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl">
              <span className="text-[10px] font-bold text-blue-700 uppercase block">Total Renta Imponible:</span>
              <span className="text-lg font-black font-mono text-blue-900">
                {formatCLP(currentSettlements.reduce((s, p) => s + p.totalHaberesImponibles, 0))}
              </span>
            </div>
            <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl">
              <span className="text-[10px] font-bold text-emerald-700 uppercase block">Sueldos Líquidos Pagados:</span>
              <span className="text-lg font-black font-mono text-emerald-900">
                {formatCLP(currentSettlements.reduce((s, p) => s + p.sueldoLiquido, 0))}
              </span>
            </div>
            <div className="p-3 bg-indigo-50/60 border border-indigo-200 rounded-xl">
              <span className="text-[10px] font-bold text-indigo-700 uppercase block">Aporte Ley 21.735 (1%):</span>
              <span className="text-lg font-black font-mono text-indigo-900">
                {formatCLP(currentSettlements.reduce((s, p) => s + (p.reformaPrevisionalLey21735Monto || Math.round(p.totalHaberesImponibles * 0.01)), 0))}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-[11px]">
                <tr>
                  <th className="px-3 py-2.5">Colaborador</th>
                  <th className="px-3 py-2.5">Cargo & Depto</th>
                  <th className="px-3 py-2.5 text-right">Imponible ($)</th>
                  <th className="px-3 py-2.5 text-right">AFP / Salud ($)</th>
                  <th className="px-3 py-2.5 text-right">Imp. Único ($)</th>
                  <th className="px-3 py-2.5 text-right">Líquido ($)</th>
                  <th className="px-3 py-2.5 text-right">Ley 21.735 (1%)</th>
                  <th className="px-3 py-2.5 text-right">Costo Empresa ($)</th>
                  <th className="px-3 py-2.5 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {currentSettlements.map((emp) => {
                  const ley21735 = emp.reformaPrevisionalLey21735Monto || Math.round(emp.totalHaberesImponibles * 0.01);
                  return (
                    <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-3 py-2.5 font-sans font-semibold text-slate-900">
                        {emp.nombreCompleto}
                        <div className="text-[10px] text-slate-400 font-mono">{emp.rut}</div>
                      </td>
                      <td className="px-3 py-2.5 font-sans text-slate-600">
                        {emp.cargo}
                        <div className="text-[10px] text-slate-400">{emp.departamento}</div>
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium text-slate-800">
                        {formatNumberCL(emp.totalHaberesImponibles)}
                      </td>
                      <td className="px-3 py-2.5 text-right text-slate-600">
                        {formatNumberCL(emp.afpMonto + emp.saludMonto)}
                      </td>
                      <td className="px-3 py-2.5 text-right text-purple-700 font-semibold">
                        {emp.impuestoUnicoMonto > 0 ? formatNumberCL(emp.impuestoUnicoMonto) : '-'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-extrabold text-emerald-700">
                        {formatCLP(emp.sueldoLiquido)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold text-indigo-700">
                        {formatNumberCL(ley21735)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold text-slate-900">
                        {formatCLP(emp.costoTotalEmpresa + (emp.reformaPrevisionalLey21735Monto ? 0 : ley21735))}
                      </td>
                      <td className="px-3 py-2.5 text-center font-sans">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedPayslipForModal({ payroll: emp, periodo: selectedPeriodo })}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer"
                            title="Ver Recibo Oficial DT"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Ver Recibo DT</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedEmployeeForEvolution(emp.rut || emp.id);
                              setActiveTab('CONCEPT_EVOLUTION');
                            }}
                            className="p-1 text-slate-500 hover:text-purple-700 hover:bg-purple-50 rounded transition-colors cursor-pointer"
                            title="Ver Evolución de Conceptos"
                          >
                            <TrendingUp className="w-4 h-4" />
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
      )}

      {/* ========================================================================= */}
      {/* VISTA 2: MATRIZ Y VARIACIÓN HISTÓRICA DE CONCEPTOS                        */}
      {/* ========================================================================= */}
      {activeTab === 'CONCEPT_EVOLUTION' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-purple-600" />
                Matriz Histórica de Conceptos de Remuneración & Análisis de Variación
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Seguimiento analítico de cómo variaron mes a mes los haberes, descuentos y aportes patronales para alimentar ajustes retroactivos precisos.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-600">Seleccionar Colaborador:</label>
              <select
                value={selectedEmployeeForEvolution}
                onChange={(e) => setSelectedEmployeeForEvolution(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 font-bold text-slate-800 cursor-pointer"
              >
                {currentSettlements.map(e => (
                  <option key={e.rut} value={e.rut}>{e.nombreCompleto} ({e.rut})</option>
                ))}
              </select>
            </div>
          </div>

          {conceptEvolutionData.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Info className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <p className="text-xs">No se registran liquidaciones históricas para el colaborador seleccionado.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Resumen del colaborador seleccionado */}
              <div className="p-3 bg-purple-50/60 border border-purple-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
                <div>
                  <span className="font-bold text-slate-900 text-sm">{conceptEvolutionData[0].nombreCompleto}</span>
                  <span className="text-slate-500 ml-2 font-mono">({conceptEvolutionData[0].rut})</span>
                  <span className="text-purple-800 ml-2 font-medium">• {conceptEvolutionData[0].cargo} ({conceptEvolutionData[0].departamento})</span>
                </div>
                <div className="text-[11px] text-purple-900 font-mono font-bold">
                  Histórico Auditado: {conceptEvolutionData.length} meses ({conceptEvolutionData[0].periodo} a {conceptEvolutionData[conceptEvolutionData.length - 1].periodo})
                </div>
              </div>

              {/* Matriz Comparativa Detallada de Conceptos Mes a Mes */}
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs text-slate-800">
                  <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 border-b border-slate-200 uppercase">
                    <tr>
                      <th className="px-3 py-2.5">Concepto de Liquidación</th>
                      {conceptEvolutionData.map(pt => (
                        <th key={pt.periodo} className="px-3 py-2.5 text-right font-mono">
                          {pt.periodo}
                        </th>
                      ))}
                      <th className="px-3 py-2.5 text-right text-purple-700">Variación Neta ($\Delta$)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    {/* SECCIÓN 1: HABERES IMPONIBLES */}
                    <tr className="bg-slate-100/60 font-sans font-bold text-slate-700 text-[10px] uppercase">
                      <td colSpan={conceptEvolutionData.length + 2} className="px-3 py-1.5">
                        1. Haberes Imponibles
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-sans font-medium text-slate-900">Sueldo Base</td>
                      {conceptEvolutionData.map(pt => (
                        <td key={pt.periodo} className="px-3 py-2 text-right">
                          {formatNumberCL(pt.sueldoBase)}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right font-bold text-purple-700">
                        {(() => {
                          const diff = conceptEvolutionData[conceptEvolutionData.length - 1].sueldoBase - conceptEvolutionData[0].sueldoBase;
                          return `${diff > 0 ? '+' : ''}${formatCLP(diff)}`;
                        })()}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-sans text-slate-700">Gratificación Legal Art. 50</td>
                      {conceptEvolutionData.map(pt => (
                        <td key={pt.periodo} className="px-3 py-2 text-right">
                          {formatNumberCL(pt.gratificacionLegal)}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right text-slate-500">
                        {(() => {
                          const diff = conceptEvolutionData[conceptEvolutionData.length - 1].gratificacionLegal - conceptEvolutionData[0].gratificacionLegal;
                          return `${diff > 0 ? '+' : ''}${formatNumberCL(diff)}`;
                        })()}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-sans text-slate-700">Horas Extras ($)</td>
                      {conceptEvolutionData.map(pt => (
                        <td key={pt.periodo} className="px-3 py-2 text-right">
                          {formatNumberCL(pt.horasExtrasMonto)}
                          <span className="text-[9px] text-slate-400 block font-sans">({pt.horasExtrasCantidad} hrs)</span>
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right text-slate-500">
                        {(() => {
                          const diff = conceptEvolutionData[conceptEvolutionData.length - 1].horasExtrasMonto - conceptEvolutionData[0].horasExtrasMonto;
                          return `${diff > 0 ? '+' : ''}${formatNumberCL(diff)}`;
                        })()}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-sans text-slate-700">Bonos & Comisiones</td>
                      {conceptEvolutionData.map(pt => (
                        <td key={pt.periodo} className="px-3 py-2 text-right">
                          {formatNumberCL(pt.comisionesBonos)}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right text-slate-500">
                        {(() => {
                          const diff = conceptEvolutionData[conceptEvolutionData.length - 1].comisionesBonos - conceptEvolutionData[0].comisionesBonos;
                          return `${diff > 0 ? '+' : ''}${formatNumberCL(diff)}`;
                        })()}
                      </td>
                    </tr>
                    <tr className="bg-emerald-50/60 font-bold text-slate-900">
                      <td className="px-3 py-2 font-sans text-emerald-900">TOTAL IMPONIBLE</td>
                      {conceptEvolutionData.map(pt => (
                        <td key={pt.periodo} className="px-3 py-2 text-right text-emerald-900">
                          {formatCLP(pt.totalImponible)}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right font-black text-emerald-900">
                        {(() => {
                          const diff = conceptEvolutionData[conceptEvolutionData.length - 1].totalImponible - conceptEvolutionData[0].totalImponible;
                          return `${diff > 0 ? '+' : ''}${formatCLP(diff)}`;
                        })()}
                      </td>
                    </tr>

                    {/* SECCIÓN 2: DESCUENTOS LEGALES */}
                    <tr className="bg-slate-100/60 font-sans font-bold text-slate-700 text-[10px] uppercase">
                      <td colSpan={conceptEvolutionData.length + 2} className="px-3 py-1.5">
                        2. Descuentos Previsionales & Tributarios
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-sans text-slate-700">AFP ({conceptEvolutionData[0].afpNombre})</td>
                      {conceptEvolutionData.map(pt => (
                        <td key={pt.periodo} className="px-3 py-2 text-right text-blue-700">
                          {formatNumberCL(pt.afpMonto)}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right text-slate-500">
                        {(() => {
                          const diff = conceptEvolutionData[conceptEvolutionData.length - 1].afpMonto - conceptEvolutionData[0].afpMonto;
                          return `${diff > 0 ? '+' : ''}${formatNumberCL(diff)}`;
                        })()}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-sans text-slate-700">Salud ({conceptEvolutionData[0].saludTipo})</td>
                      {conceptEvolutionData.map(pt => (
                        <td key={pt.periodo} className="px-3 py-2 text-right text-teal-700">
                          {formatNumberCL(pt.saludMonto)}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right text-slate-500">
                        {(() => {
                          const diff = conceptEvolutionData[conceptEvolutionData.length - 1].saludMonto - conceptEvolutionData[0].saludMonto;
                          return `${diff > 0 ? '+' : ''}${formatNumberCL(diff)}`;
                        })()}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-sans text-slate-700">Impuesto Único 2da Cat. (IUSC)</td>
                      {conceptEvolutionData.map(pt => (
                        <td key={pt.periodo} className="px-3 py-2 text-right text-purple-700 font-semibold">
                          {pt.impuestoUnico > 0 ? formatNumberCL(pt.impuestoUnico) : '-'}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right text-purple-700 font-bold">
                        {(() => {
                          const diff = conceptEvolutionData[conceptEvolutionData.length - 1].impuestoUnico - conceptEvolutionData[0].impuestoUnico;
                          return `${diff > 0 ? '+' : ''}${formatNumberCL(diff)}`;
                        })()}
                      </td>
                    </tr>

                    {/* SECCIÓN 3: RESULTADO LÍQUIDO */}
                    <tr className="bg-blue-50/80 font-black text-xs text-blue-900 border-t-2 border-b-2 border-blue-200">
                      <td className="px-3 py-2.5 font-sans">SUELDO LÍQUIDO A PAGAR</td>
                      {conceptEvolutionData.map(pt => (
                        <td key={pt.periodo} className="px-3 py-2.5 text-right font-extrabold text-blue-900">
                          {formatCLP(pt.sueldoLiquido)}
                        </td>
                      ))}
                      <td className="px-3 py-2.5 text-right font-black text-blue-950">
                        {(() => {
                          const diff = conceptEvolutionData[conceptEvolutionData.length - 1].sueldoLiquido - conceptEvolutionData[0].sueldoLiquido;
                          return `${diff > 0 ? '+' : ''}${formatCLP(diff)}`;
                        })()}
                      </td>
                    </tr>

                    {/* SECCIÓN 4: APORTES PATRONALES */}
                    <tr className="bg-slate-100/60 font-sans font-bold text-slate-700 text-[10px] uppercase">
                      <td colSpan={conceptEvolutionData.length + 2} className="px-3 py-1.5">
                        3. Costos Patronales
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-sans text-slate-700">Ley 21.735 Reforma (1.0%)</td>
                      {conceptEvolutionData.map(pt => (
                        <td key={pt.periodo} className="px-3 py-2 text-right text-indigo-700 font-bold">
                          {formatNumberCL(pt.ley21735Monto)}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right text-indigo-800">
                        {(() => {
                          const diff = conceptEvolutionData[conceptEvolutionData.length - 1].ley21735Monto - conceptEvolutionData[0].ley21735Monto;
                          return `${diff > 0 ? '+' : ''}${formatNumberCL(diff)}`;
                        })()}
                      </td>
                    </tr>
                    <tr className="bg-slate-50 font-bold text-slate-900">
                      <td className="px-3 py-2 font-sans">COSTO TOTAL EMPRESA</td>
                      {conceptEvolutionData.map(pt => (
                        <td key={pt.periodo} className="px-3 py-2 text-right">
                          {formatCLP(pt.costoTotalEmpresa)}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right font-black text-slate-900">
                        {(() => {
                          const diff = conceptEvolutionData[conceptEvolutionData.length - 1].costoTotalEmpresa - conceptEvolutionData[0].costoTotalEmpresa;
                          return `${diff > 0 ? '+' : ''}${formatCLP(diff)}`;
                        })()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Bitácora de Variaciones Mes a Mes y Acceso a Reliquidaciones */}
              <div className="space-y-2 pt-2">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-purple-600" />
                  Hitos de Variación Mensual & Opciones de Reliquidación Retroactiva
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {conceptEvolutionData.slice(1).map(pt => {
                    const varInfo = pt.variacionMesAnterior;
                    if (!varInfo) return null;
                    return (
                      <div key={pt.periodo} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-900 font-mono">Mes: {pt.periodo}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            varInfo.imponibleDiff >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            $\Delta$ Imponible: {varInfo.imponibleDiff >= 0 ? '+' : ''}{varInfo.imponibleDiffPct.toFixed(1)}%
                          </span>
                        </div>

                        <div className="space-y-1 text-[11px] text-slate-600">
                          <div>
                            <span className="text-slate-500">Cambio Líquido:</span>{' '}
                            <strong className="font-mono text-slate-800">
                              {varInfo.liquidoDiff >= 0 ? '+' : ''}{formatCLP(varInfo.liquidoDiff)}
                            </strong>
                          </div>
                          <div>
                            <span className="text-slate-500">Conceptos alterados:</span>{' '}
                            <span className="font-sans font-semibold text-purple-800">
                              {varInfo.conceptosConCambio.join(', ') || 'Sin variaciones nominales'}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleUseEvolutionPointForReliquidation(pt)}
                          className="w-full mt-2 flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-[11px] font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors cursor-pointer"
                        >
                          <Sparkles className="w-3 h-3 text-purple-600" />
                          <span>Usar para Ajuste Retroactivo</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VISTA 3: HISTORIAL DE IMPOSICIONES Y LEYES SOCIALES PAGADAS (PREVIRED)    */}
      {/* ========================================================================= */}
      {activeTab === 'PREVIRED_PAYMENTS' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-600" />
                Historial de Imposiciones y Leyes Sociales Pagadas (PreviRed)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Certificados de Pago Electrónico (CPE) de cotizaciones previsionales, de salud, cesantía y Ley 21.735 acreditados ante las instituciones.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs bg-emerald-50 text-emerald-800 font-bold px-3 py-1 rounded-lg border border-emerald-200">
                Acreditación F30 Dirección del Trabajo: VIGENTE
              </span>
            </div>
          </div>

          <div className="space-y-3">
            {previredPayments.map((payment) => (
              <div
                key={payment.id}
                className="p-4 border border-slate-200 rounded-xl hover:border-emerald-300 transition-all bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm text-slate-900 font-mono">
                      Período {payment.periodo}
                    </span>
                    <span className="text-xs font-mono text-slate-500">
                      (Folio CPE: {payment.folioPrevired})
                    </span>
                    <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                      {payment.estado}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                    <span>
                      <strong>Banco:</strong> {payment.banco} ({payment.medioPago})
                    </span>
                    <span>•</span>
                    <span>
                      <strong>Fecha de Pago:</strong>{' '}
                      <span className="font-mono font-medium">{new Date(payment.fechaPago).toLocaleString('es-CL')}</span>
                    </span>
                    <span>•</span>
                    <span>
                      <strong>Nómina:</strong> {payment.totalTrabajadores} trabajadores
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono mt-1">
                    <span className="bg-blue-50 text-blue-900 px-2 py-0.5 rounded border border-blue-200">
                      AFP: {formatCLP(payment.montoAfpTotal)}
                    </span>
                    <span className="bg-teal-50 text-teal-900 px-2 py-0.5 rounded border border-teal-200">
                      Salud: {formatCLP(payment.montoSaludTotal)}
                    </span>
                    <span className="bg-indigo-50 text-indigo-900 px-2 py-0.5 rounded border border-indigo-200">
                      AFC: {formatCLP(payment.montoAfcTotal)}
                    </span>
                    <span className="bg-amber-50 text-amber-900 px-2 py-0.5 rounded border border-amber-200">
                      Mutual: {formatCLP(payment.montoMutualTotal)}
                    </span>
                    <span className="bg-emerald-50 text-emerald-900 px-2 py-0.5 rounded border border-emerald-300 font-bold">
                      Ley 21.735 (1%): {formatCLP(payment.montoLey21735Total)}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-end md:items-center gap-3">
                  <div className="text-right">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">TOTAL PAGADO CPE:</span>
                    <span className="text-lg font-black font-mono text-emerald-700">
                      {formatCLP(payment.montoTotalPagado)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedPreviredForModal(payment)}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors cursor-pointer shrink-0"
                  >
                    <FileCheck2 className="w-4 h-4" />
                    <span>Ver Certificado CPE</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VISTA 4: LISTADO DE RELIQUIDACIONES REGISTRADAS                          */}
      {/* ========================================================================= */}
      {activeTab === 'RELIQUIDATIONS' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-indigo-600" />
                Bitácora de Reliquidaciones y Ajustes Retroactivos
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Reliquidación de rentas según Art. 46 Ley de la Renta con asignación al período devengado.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('NEW_RELIQUIDATION')}
              className="text-xs font-bold bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer"
            >
              + Nueva Reliquidación
            </button>
          </div>

          {reliquidations.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <History className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="text-xs">No se registran reliquidaciones retroactivas para esta empresa.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reliquidations.map((reliq) => (
                <div
                  key={reliq.id}
                  className="p-4 border border-slate-200 rounded-xl hover:border-indigo-300 transition-all bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">{reliq.nombreEmpleado}</span>
                      <span className="text-xs font-mono text-slate-500">({reliq.rutEmpleado})</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          reliq.estado === 'APROBADO_Y_PAGADO'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {reliq.estado}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 font-sans">
                      <span className="font-semibold text-slate-700">{reliq.motivoAjuste}:</span> {reliq.detalleMotivo}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-mono mt-1">
                      <span>Devengado: <strong className="text-slate-800">{reliq.periodoDevengado}</strong></span>
                      <span>•</span>
                      <span>Pago: <strong className="text-slate-800">{reliq.periodoPago}</strong></span>
                      <span>•</span>
                      <span>$\Delta$ Imponible: <strong className="text-blue-800">{formatCLP(reliq.diferencialTotalImponible)}</strong></span>
                      <span>•</span>
                      <span>$\Delta$ Imp. Único: <strong className="text-purple-800">{formatCLP(reliq.diferencialImpuestoUnico)}</strong></span>
                      <span>•</span>
                      <span>Ley 21.735: <strong className="text-indigo-800">{formatCLP(reliq.diferencialLey21735)}</strong></span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-end md:items-center gap-3">
                    <div className="text-right">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">LÍQUIDO A PAGAR:</span>
                      <span className="text-base font-extrabold font-mono text-emerald-700">
                        {formatCLP(reliq.totalDiferencialLiquido)}
                      </span>
                    </div>

                    {reliq.estado === 'PENDIENTE_APROBACION_HUMANA' ? (
                      <button
                        type="button"
                        onClick={() => handleApproveAdjustment(reliq)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors cursor-pointer"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Aprobar & Asentar</span>
                      </button>
                    ) : (
                      <span className="text-[11px] text-emerald-700 font-bold flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Contabilizado ({reliq.asientoAjusteId})
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VISTA 5: FORMULAR NUEVA RELIQUIDACIÓN (ART. 46 LIR) CON HISTÓRICO REAL    */}
      {/* ========================================================================= */}
      {activeTab === 'NEW_RELIQUIDATION' && (
        <form onSubmit={handleCalculateAdjustment} className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                Motor de Reliquidación de Remuneraciones Retroactivas (Art. 46 LIR)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Calcula la renta devengada en el período original aplicando la tabla de Impuesto Único histórica en UTM para evitar salto de tramos abusivo.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('RELIQUIDATIONS')}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800"
            >
              ← Volver al listado
            </button>
          </div>

          {/* Selector de Colaborador y Períodos */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Colaborador Afecto:</label>
              <select
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-medium text-slate-800"
              >
                {currentSettlements.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.nombreCompleto} ({emp.rut})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Período Devengado (Mes Original):</label>
              <select
                value={periodoDevengado}
                onChange={(e) => setPeriodoDevengado(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-mono font-bold text-slate-800"
              >
                {availablePeriods.map(p => (
                  <option key={p} value={p}>{p} (UTM Histórica correspondiente)</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Período de Pago (Liquidación Actual):</label>
              <input
                type="text"
                value={periodoPago}
                onChange={(e) => setPeriodoPago(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-mono font-bold text-slate-800"
                placeholder="AAAA-MM"
              />
            </div>
          </div>

          {/* Panel Informativo: Conceptos Históricos Originales del Período Devengado */}
          {originalDevengadoSettlement && (
            <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2">
              <div className="text-[11px] font-bold text-blue-900 uppercase flex items-center justify-between">
                <span>Registro Histórico Original ({originalDevengadoSettlement.periodo}):</span>
                <span className="font-mono text-slate-600">AFP {originalDevengadoSettlement.afpNombre} • Salud {originalDevengadoSettlement.saludTipo}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs font-mono">
                <div className="bg-white p-2 rounded border border-blue-100">
                  <span className="text-[10px] text-slate-500 font-sans block">Sueldo Base:</span>
                  <span className="font-bold text-slate-800">{formatCLP(originalDevengadoSettlement.sueldoBase)}</span>
                </div>
                <div className="bg-white p-2 rounded border border-blue-100">
                  <span className="text-[10px] text-slate-500 font-sans block">Gratificación Art. 50:</span>
                  <span className="font-bold text-slate-800">{formatCLP(originalDevengadoSettlement.gratificacionMonto)}</span>
                </div>
                <div className="bg-white p-2 rounded border border-blue-100">
                  <span className="text-[10px] text-slate-500 font-sans block">Total Imponible:</span>
                  <span className="font-bold text-blue-900">{formatCLP(originalDevengadoSettlement.totalHaberesImponibles)}</span>
                </div>
                <div className="bg-white p-2 rounded border border-blue-100">
                  <span className="text-[10px] text-slate-500 font-sans block">Impuesto Único Pagado:</span>
                  <span className="font-bold text-purple-800">{formatCLP(originalDevengadoSettlement.impuestoUnicoMonto)}</span>
                </div>
                <div className="bg-white p-2 rounded border border-blue-100">
                  <span className="text-[10px] text-slate-500 font-sans block">Sueldo Líquido Pagado:</span>
                  <span className="font-bold text-emerald-800">{formatCLP(originalDevengadoSettlement.sueldoLiquido)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Motivo y Causa Legal */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Motivo de la Reliquidación:</label>
              <select
                value={motivoAjuste}
                onChange={(e) => setMotivoAjuste(e.target.value as any)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-medium text-slate-800"
              >
                <option value="AUMENTO_SUELDO_RETROACTIVO">Aumento de Sueldo Base Retroactivo</option>
                <option value="BONO_RETROACTIVO">Bono de Desempeño Extraordinario Retroactivo</option>
                <option value="CORRECCION_HORAS_EXTRAS">Corrección de Horas Extraordinarias</option>
                <option value="DIFERENCIAL_COMISIONES">Diferencial de Comisiones por Venta</option>
                <option value="ERROR_CALCULO">Corrección de Error Material de Cálculo</option>
                <option value="RESOLUCION_DT_TRIBUNAL">Resolución de la Dirección del Trabajo / Juzgado</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">Detalle / Fundamento del Ajuste:</label>
              <input
                type="text"
                value={detalleMotivo}
                onChange={(e) => setDetalleMotivo(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-medium text-slate-800"
                placeholder="Ej: Anexo de contrato N° 2 reajuste retroactivo..."
                required
              />
            </div>
          </div>

          {/* Desglose de Diferenciales de Haberes */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              Diferenciales de Conceptos Imponibles a Incorporar al Período Devengado ($ CLP)
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">$\Delta$ Sueldo Base:</label>
                <input
                  type="number"
                  value={diferencialSueldo}
                  onChange={(e) => setDiferencialSueldo(Number(e.target.value))}
                  className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-1.5 font-mono font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">$\Delta$ Horas Extras:</label>
                <input
                  type="number"
                  value={diferencialHorasExtras}
                  onChange={(e) => setDiferencialHorasExtras(Number(e.target.value))}
                  className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-1.5 font-mono font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">$\Delta$ Bonos / Comisiones:</label>
                <input
                  type="number"
                  value={diferencialComisiones}
                  onChange={(e) => setDiferencialComisiones(Number(e.target.value))}
                  className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-1.5 font-mono font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">$\Delta$ Gratificación Art. 50:</label>
                <input
                  type="number"
                  value={diferencialGratificacion}
                  onChange={(e) => setDiferencialGratificacion(Number(e.target.value))}
                  className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-1.5 font-mono font-bold text-slate-800"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs font-bold text-slate-800">
              <span>INCREMENTO TOTAL IMPONIBLE DEL AJUSTE:</span>
              <span className="font-mono text-sm text-emerald-700">
                {formatCLP(diferencialSueldo + diferencialHorasExtras + diferencialComisiones + diferencialGratificacion)}
              </span>
            </div>
          </div>

          {/* Botón de Cálculo */}
          <div className="flex justify-end gap-3">
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Calcular Reliquidación & Determinar Diferenciales Art. 46 LIR</span>
            </button>
          </div>

          {/* Resultado del Recálculo */}
          {lastCalculatedAdjustment && (
            <div className="p-4 border-2 border-emerald-300 bg-emerald-50/50 rounded-xl space-y-4">
              <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
                <span className="font-bold text-sm text-emerald-950 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Resultado del Recálculo Determinista Art. 46 LIR
                </span>
                <span className="text-xs font-mono font-bold text-emerald-800">
                  Folio: {lastCalculatedAdjustment.id}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div className="bg-white p-2.5 rounded-lg border border-emerald-200">
                  <span className="text-[10px] text-slate-500 font-sans block uppercase">$\Delta$ Imponible:</span>
                  <span className="font-bold text-slate-900">{formatCLP(lastCalculatedAdjustment.diferencialTotalImponible)}</span>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-emerald-200">
                  <span className="text-[10px] text-slate-500 font-sans block uppercase">$\Delta$ Previsión (AFP+Salud+AFC):</span>
                  <span className="font-bold text-slate-900">
                    {formatCLP(lastCalculatedAdjustment.diferencialAfp + lastCalculatedAdjustment.diferencialSalud + lastCalculatedAdjustment.diferencialAfcTrabajador)}
                  </span>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-emerald-200">
                  <span className="text-[10px] text-slate-500 font-sans block uppercase">$\Delta$ Impuesto Único (Art. 46):</span>
                  <span className="font-bold text-purple-700">{formatCLP(lastCalculatedAdjustment.diferencialImpuestoUnico)}</span>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-emerald-200">
                  <span className="text-[10px] text-slate-500 font-sans block uppercase">$\Delta$ Ley 21.735 (1% Emp):</span>
                  <span className="font-bold text-indigo-700">{formatCLP(lastCalculatedAdjustment.diferencialLey21735)}</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-lg border border-emerald-300">
                <div>
                  <span className="text-xs font-bold text-slate-700 block">LÍQUIDO A PAGAR POR EL AJUSTE:</span>
                  <span className="text-[10px] text-slate-500">Monto neto que se añadirá a la liquidación del período de pago</span>
                </div>
                <div className="text-xl font-black font-mono text-emerald-700">
                  {formatCLP(lastCalculatedAdjustment.totalDiferencialLiquido)}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => handleApproveAdjustment(lastCalculatedAdjustment)}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Aprobar Reliquidación y Contabilizar en Libro Diario</span>
                </button>
              </div>
            </div>
          )}
        </form>
      )}

      {/* MODAL 1: RECIBO DE SUELDO OFICIAL DT */}
      {selectedPayslipForModal && (
        <HistoricalPayslipModal
          payroll={selectedPayslipForModal.payroll}
          company={company}
          periodo={selectedPayslipForModal.periodo}
          onClose={() => setSelectedPayslipForModal(null)}
        />
      )}

      {/* MODAL 2: CERTIFICADO DE PAGO ELECTRONICO PREVIRED */}
      {selectedPreviredForModal && (
        <HistoricalPreviredPaymentModal
          payment={selectedPreviredForModal}
          onClose={() => setSelectedPreviredForModal(null)}
        />
      )}
    </div>
  );
};
