import React, { useState, useMemo, useEffect } from 'react';
import {
  FileSpreadsheet,
  Download,
  Calendar,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  RefreshCw,
  Plus,
  Eye,
  Edit3,
  HelpCircle,
  Sliders,
  ChevronRight,
  ChevronLeft,
  X,
  FileText,
  Building2,
  Layers,
  Sparkles,
  Palette,
  Loader2,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { CashFlowExcelDesignerModal } from './CashFlowExcelDesignerModal';
import {
  EXCEL_PRESET_THEMES,
  MatrixExportData,
  generateStyledCashFlowExcel,
  downloadBlobAsFile,
} from '../../utils/cashFlowExcelStylingEngine';
import {
  CashFlowMovement,
  DteDocument,
  ChileIndicators,
  CompanyProfile,
  BankAccountConfig,
  CashAccountConfig,
  CashFlowHorizonType,
  CashFlowInclusionParameters,
  ChequeCartera,
  ChequeEmitido,
  DeudaFinanciera,
  ProvisionEgreso,
  EmployeePayroll,
  F29Declaration,
  ProductionBudget,
  ProductionOrder,
  LeaseContract,
  CashFlowCategory,
} from '../../types';

interface CashFlowSpreadsheetMatrixProps {
  movements: CashFlowMovement[];
  onUpdateMovement: (mov: CashFlowMovement) => void;
  onAddMovement?: (mov: CashFlowMovement) => void;
  dtes?: DteDocument[];
  indicators?: ChileIndicators;
  company: CompanyProfile;
  initialBalance: number;
  bankAccounts?: BankAccountConfig[];
  cashAccounts?: CashAccountConfig[];
  payrolls?: EmployeePayroll[];
  f29?: F29Declaration;
  chequesCartera?: ChequeCartera[];
  chequesEmitidos?: ChequeEmitido[];
  deudasFinancieras?: DeudaFinanciera[];
  provisionesEgresos?: ProvisionEgreso[];
  leases?: LeaseContract[];
  parameters: CashFlowInclusionParameters;
  onOpenParamsModal?: () => void;
  onOpenProvisionesModal?: () => void;
  scenario?: 'BASE' | 'OPTIMISTA' | 'ESTRESADO';
  onScenarioChange?: (scenario: 'BASE' | 'OPTIMISTA' | 'ESTRESADO') => void;
  horizon?: MatrixHorizonType;
  onHorizonChange?: (horizon: MatrixHorizonType) => void;
}

export type MatrixHorizonType =
  | '15_DIAS'
  | '30_DIAS'
  | '60_DIAS'
  | '90_DIAS'
  | '1_ANIO'
  | 'MES_COMPLETO'
  | 'PROXIMO_MES';

interface MatrixConceptRow {
  id: string;
  nombre: string;
  grupo: 'INGRESO' | 'EGRESO';
  esSubtotal?: boolean;
  categoriaCodigo?: string;
  cuentaContableRef?: string;
}

export const CashFlowSpreadsheetMatrix: React.FC<CashFlowSpreadsheetMatrixProps> = ({
  movements = [],
  onUpdateMovement,
  onAddMovement,
  dtes = [],
  company,
  initialBalance = 0,
  bankAccounts = [],
  cashAccounts = [],
  provisionesEgresos = [],
  parameters,
  onOpenParamsModal,
  onOpenProvisionesModal,
  scenario: propScenario,
  onScenarioChange,
  horizon: propHorizon,
  onHorizonChange,
}) => {
  // 1. Estados de Control de la Matriz (Inicia por defecto con la fecha de hoy)
  const [baseDateStr, setBaseDateStr] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [internalHorizonType, setInternalHorizonType] = useState<MatrixHorizonType>(
    propHorizon || '30_DIAS'
  );
  const horizonType = propHorizon || internalHorizonType;

  // Escuchar eventos globales para actualizar la fecha base (disparados por Vera o botones de la UI)
  useEffect(() => {
    const handleUpdateBaseDate = (e: any) => {
      const targetDate = e.detail?.date || new Date().toISOString().split('T')[0];
      setBaseDateStr(targetDate);
      setToastMessage({
        type: 'success',
        text: `Flujo de caja actualizado e iniciado a partir de hoy (${targetDate})`,
      });
      setTimeout(() => setToastMessage(null), 3500);
    };

    window.addEventListener('update-cashflow-base-date', handleUpdateBaseDate);
    return () => window.removeEventListener('update-cashflow-base-date', handleUpdateBaseDate);
  }, []);

  const handleHorizonChange = (newH: MatrixHorizonType) => {
    setInternalHorizonType(newH);
    if (onHorizonChange) onHorizonChange(newH);
  };

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterOnlyWithBalance, setFilterOnlyWithBalance] = useState<boolean>(false);
  const [internalScenario, setInternalScenario] = useState<'BASE' | 'OPTIMISTA' | 'ESTRESADO'>('BASE');
  const scenario = propScenario || internalScenario;

  const handleScenarioChange = (s: 'BASE' | 'OPTIMISTA' | 'ESTRESADO') => {
    setInternalScenario(s);
    if (onScenarioChange) onScenarioChange(s);
  };

  // 2. Estados de Modal de Drill-Down y Reprogramación
  const [selectedCell, setSelectedCell] = useState<{
    dateStr: string;
    dayNumber: number;
    conceptRowId?: string;
    conceptNombre?: string;
    movements: CashFlowMovement[];
    type: 'INGRESO' | 'EGRESO' | 'SALDO_DIARIO' | 'SALDO_ACUM' | 'CONCEPTO';
    amount: number;
  } | null>(null);

  const [reschedulingMovement, setReschedulingMovement] = useState<CashFlowMovement | null>(null);
  const [newTargetDate, setNewTargetDate] = useState<string>('');
  const [rescheduleReason, setRescheduleReason] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'info'; text: string } | null>(null);
  const [isDesignerModalOpen, setIsDesignerModalOpen] = useState<boolean>(false);
  const [isExportingQuickExcel, setIsExportingQuickExcel] = useState<boolean>(false);

  // Formateador estándar de moneda chilena
  const formatCLP = (val: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  const formatNumberShort = (val: number) => {
    if (val === 0) return '-';
    return new Intl.NumberFormat('es-CL', {
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Multiplicador por escenario
  const mult = useMemo(() => {
    if (scenario === 'OPTIMISTA') return { ing: 1.15, egr: 0.95 };
    if (scenario === 'ESTRESADO') return { ing: 0.70, egr: 1.10 };
    return { ing: 1.0, egr: 1.0 };
  }, [scenario]);

  // 3. Generación de Columnas de Días según horizonte
  const daysColumns = useMemo(() => {
    const [y, m, d] = baseDateStr.split('-').map(Number);
    const start = new Date(y, m - 1, d, 12, 0, 0);

    let daysCount = 30;
    let actualStartDate = new Date(start);

    if (horizonType === '15_DIAS') {
      daysCount = 15;
    } else if (horizonType === '30_DIAS') {
      daysCount = 30;
    } else if (horizonType === '60_DIAS') {
      daysCount = 60;
    } else if (horizonType === '90_DIAS') {
      daysCount = 90;
    } else if (horizonType === '1_ANIO') {
      daysCount = 365;
    } else if (horizonType === 'MES_COMPLETO') {
      // Desde el 1 del mes actual hasta el último día
      actualStartDate = new Date(y, m - 1, 1, 12, 0, 0);
      const lastDay = new Date(y, m, 0, 12, 0, 0).getDate();
      daysCount = lastDay;
    } else if (horizonType === 'PROXIMO_MES') {
      // Mes siguiente completo
      actualStartDate = new Date(y, m, 1, 12, 0, 0);
      const lastDay = new Date(y, m + 1, 0, 12, 0, 0).getDate();
      daysCount = lastDay;
    }

    const daysOfWeekShort = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const cols = [];

    for (let i = 0; i < daysCount; i++) {
      const cur = new Date(actualStartDate.getTime() + i * 86400000);
      const year = cur.getFullYear();
      const month = String(cur.getMonth() + 1).padStart(2, '0');
      const day = String(cur.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      const dayDisplay = `${day}-${month}-${year}`;
      const dayOfWeek = daysOfWeekShort[cur.getDay()];
      const isWeekend = cur.getDay() === 0 || cur.getDay() === 6;

      cols.push({
        index: i + 1,
        dateStr,
        dayDisplay,
        dayOfWeek,
        dayNumber: cur.getDate(),
        isWeekend,
      });
    }

    return cols;
  }, [baseDateStr, horizonType]);

  // 4. Catálogo de Conceptos Fila (Estructura Contable del Excel del Usuario)
  const conceptRows: MatrixConceptRow[] = useMemo(() => [
    // --- INGRESOS ---
    { id: 'ING_CHEQUES', nombre: 'VALORES PENDIENTES DE COBRO (CHEQUES)', grupo: 'INGRESO', cuentaContableRef: '1.1.02.001', categoriaCodigo: 'CHEQUE_CARTERA_COBRO' },
    { id: 'ING_FACT_DIA', nombre: 'COBRANZA (FACTURAS AL DÍA)', grupo: 'INGRESO', cuentaContableRef: '1.1.03.001', categoriaCodigo: 'VENTAS_OPERACIONALES' },
    { id: 'ING_VENC_1_15', nombre: 'COBRANZA VENCIDA 1-15 DIAS (FACTURAS)', grupo: 'INGRESO', cuentaContableRef: '1.1.03.002' },
    { id: 'ING_VENC_16_30', nombre: 'COBRANZA VENCIDA 16-30 DIAS (FACTURAS)', grupo: 'INGRESO', cuentaContableRef: '1.1.03.003' },
    { id: 'ING_VENC_30_MAS', nombre: 'COBRANZA VENCIDA SOBRE 30 DIAS (FACTURAS)', grupo: 'INGRESO', cuentaContableRef: '1.1.03.004' },
    { id: 'ING_PROY_VENTAS', nombre: 'PROYECCION DE LAS VENTAS (RECURRENTES)', grupo: 'INGRESO', cuentaContableRef: '4.1.01.001', categoriaCodigo: 'VENTAS_OPERACIONALES' },
    { id: 'ING_OTROS', nombre: 'OTROS INGRESOS DE OPERACION', grupo: 'INGRESO', cuentaContableRef: '4.2.01.001' },
    // --- EGRESOS ---
    { id: 'EGR_PROV_DIA', nombre: 'PROVEEDORES (FACTURAS X PAGAR AL DÍA)', grupo: 'EGRESO', cuentaContableRef: '2.1.01.001', categoriaCodigo: 'PROVEEDORES' },
    { id: 'EGR_PROV_VENC_1_15', nombre: 'FACTURAS PROVEEDOR VENCIDAS (1-15 DÍAS)', grupo: 'EGRESO', cuentaContableRef: '2.1.01.002' },
    { id: 'EGR_PROV_VENC_MAS', nombre: 'FACTURAS PROVEEDOR VENCIDAS (> 15 DÍAS)', grupo: 'EGRESO', cuentaContableRef: '2.1.01.003' },
    { id: 'EGR_CHEQUES', nombre: 'CHEQUES EMITIDOS PENDIENTES DE COBRO', grupo: 'EGRESO', cuentaContableRef: '2.1.02.001', categoriaCodigo: 'CHEQUE_EMITIDO_PAGO' },
    { id: 'EGR_SUELDOS', nombre: 'REMUNERACIONES Y SUELDOS LÍQUIDOS', grupo: 'EGRESO', cuentaContableRef: '2.1.03.001', categoriaCodigo: 'REMUNERACIONES' },
    { id: 'EGR_PREVIRED', nombre: 'LEYES SOCIALES (PREVIRED / AFP / FONASA)', grupo: 'EGRESO', cuentaContableRef: '2.1.03.002', categoriaCodigo: 'PREVIRED_LEYES_SOCIALES' },
    { id: 'EGR_F29', nombre: 'IMPUESTOS MENSUALES (F29 IVA / PPM)', grupo: 'EGRESO', cuentaContableRef: '2.1.04.001', categoriaCodigo: 'IMPUESTOS_F29' },
    { id: 'EGR_ARRIENDOS', nombre: 'ARRIENDOS Y LEASING (IFRS 16)', grupo: 'EGRESO', cuentaContableRef: '5.1.02.001', categoriaCodigo: 'ARRIENDOS' },
    { id: 'EGR_DEUDA_BANCOS', nombre: 'CUOTAS CRÉDITOS & DEUDA BANCARIA', grupo: 'EGRESO', cuentaContableRef: '2.1.05.001', categoriaCodigo: 'DEUDA_FINANCIERA_CUOTA' },
    { id: 'EGR_PROVISIONES', nombre: 'PROVISIONES Y OTROS EGRESOS', grupo: 'EGRESO', cuentaContableRef: '2.1.06.001', categoriaCodigo: 'PROVISION_EGRESO' },
  ], []);

  // 5. Mapeo y Clasificación de Partidas en las Filas del Concepto
  const mapMovementToConceptRow = (m: CashFlowMovement, todayStr: string): string => {
    if (m.tipo === 'INGRESO') {
      if (m.categoria === 'CHEQUE_CARTERA_COBRO' || m.origenModulo === 'CHEQUES_CARTERA') {
        return 'ING_CHEQUES';
      }
      if (m.estado === 'VENCIDO') {
        // Calcular antigüedad respecto a todayStr
        const diffDays = Math.round((new Date(todayStr).getTime() - new Date(m.fechaEstimada).getTime()) / 86400000);
        if (diffDays <= 15) return 'ING_VENC_1_15';
        if (diffDays <= 30) return 'ING_VENC_16_30';
        return 'ING_VENC_30_MAS';
      }
      if (m.categoria === 'PRODUCCION_HITO_VENTA' || m.concepto?.toLowerCase().includes('proyecc') || m.concepto?.toLowerCase().includes('estimad')) {
        return 'ING_PROY_VENTAS';
      }
      if (m.categoria === 'VENTAS_OPERACIONALES' || m.origenModulo === 'DTE_SII' || m.dteFolioAsociado) {
        return 'ING_FACT_DIA';
      }
      return 'ING_OTROS';
    } else {
      // EGRESOS
      if (m.categoria === 'CHEQUE_EMITIDO_PAGO' || m.origenModulo === 'CHEQUES_EMITIDOS') {
        return 'EGR_CHEQUES';
      }
      if (m.categoria === 'REMUNERACIONES') {
        return 'EGR_SUELDOS';
      }
      if (m.categoria === 'PREVIRED_LEYES_SOCIALES') {
        return 'EGR_PREVIRED';
      }
      if (m.categoria === 'IMPUESTOS_F29') {
        return 'EGR_F29';
      }
      if (m.categoria === 'ARRIENDOS') {
        return 'EGR_ARRIENDOS';
      }
      if (m.categoria === 'DEUDA_FINANCIERA_CUOTA' || m.origenModulo === 'DEUDA_FINANCIERA') {
        return 'EGR_DEUDA_BANCOS';
      }
      if (m.categoria === 'PROVISION_EGRESO' || m.origenModulo === 'PROVISIONES') {
        return 'EGR_PROVISIONES';
      }
      if (m.estado === 'VENCIDO') {
        const diffDays = Math.round((new Date(todayStr).getTime() - new Date(m.fechaEstimada).getTime()) / 86400000);
        if (diffDays <= 15) return 'EGR_PROV_VENC_1_15';
        return 'EGR_PROV_VENC_MAS';
      }
      return 'EGR_PROV_DIA';
    }
  };

  // 6. Matriz de Datos en Memoria (Día x Concepto) y Totales Diarios
  const matrixData = useMemo(() => {
    const todayStr = baseDateStr;
    const safeMovs = Array.isArray(movements) ? movements : [];

    // Estructuras indexadas:
    // cellValues: [rowId][dateStr] = { total: number, movements: CashFlowMovement[] }
    const cellMap: Record<string, Record<string, { total: number; count: number; movements: CashFlowMovement[] }>> = {};

    // Inicializar cellMap
    conceptRows.forEach((r) => {
      cellMap[r.id] = {};
      daysColumns.forEach((col) => {
        cellMap[r.id][col.dateStr] = { total: 0, count: 0, movements: [] };
      });
    });

    // Totales Diarios superiores
    const dailyTotals: Record<
      string,
      {
        totalIngresos: number;
        totalEgresos: number;
        saldoDiario: number;
        saldoArrastrado: number;
        movementsIngreso: CashFlowMovement[];
        movementsEgreso: CashFlowMovement[];
      }
    > = {};

    daysColumns.forEach((col) => {
      dailyTotals[col.dateStr] = {
        totalIngresos: 0,
        totalEgresos: 0,
        saldoDiario: 0,
        saldoArrastrado: 0,
        movementsIngreso: [],
        movementsEgreso: [],
      };
    });

    // Distribuir cada movimiento
    safeMovs.forEach((m) => {
      const dateKey = m.fechaEstimada;
      if (!dailyTotals[dateKey]) return; // Fuera del horizonte visible

      const rowId = mapMovementToConceptRow(m, todayStr);
      const isIngreso = m.tipo === 'INGRESO';
      const adjustedAmount = Math.round(m.montoTotal * (isIngreso ? mult.ing : mult.egr));

      if (cellMap[rowId] && cellMap[rowId][dateKey]) {
        cellMap[rowId][dateKey].total += adjustedAmount;
        cellMap[rowId][dateKey].count += 1;
        cellMap[rowId][dateKey].movements.push(m);
      }

      if (isIngreso) {
        dailyTotals[dateKey].totalIngresos += adjustedAmount;
        dailyTotals[dateKey].movementsIngreso.push(m);
      } else {
        dailyTotals[dateKey].totalEgresos += adjustedAmount;
        dailyTotals[dateKey].movementsEgreso.push(m);
      }
    });

    // Calcular Saldos Diarios y Saldos Arrastrados Acumulativos
    let runningAccum = initialBalance;
    daysColumns.forEach((col) => {
      const dayData = dailyTotals[col.dateStr];
      dayData.saldoDiario = dayData.totalIngresos - dayData.totalEgresos;
      runningAccum += dayData.saldoDiario;
      dayData.saldoArrastrado = runningAccum;
    });

    // Totales por fila de concepto
    const rowTotals: Record<string, { total: number; count: number }> = {};
    conceptRows.forEach((r) => {
      let rTotal = 0;
      let rCount = 0;
      daysColumns.forEach((col) => {
        const c = cellMap[r.id][col.dateStr];
        rTotal += c.total;
        rCount += c.count;
      });
      rowTotals[r.id] = { total: rTotal, count: rCount };
    });

    // Gran Totales del Período
    const grandTotalIngresos = daysColumns.reduce((sum, col) => sum + dailyTotals[col.dateStr].totalIngresos, 0);
    const grandTotalEgresos = daysColumns.reduce((sum, col) => sum + dailyTotals[col.dateStr].totalEgresos, 0);
    const grandNetFlow = grandTotalIngresos - grandTotalEgresos;
    const finalSaldo = runningAccum;

    return {
      cellMap,
      dailyTotals,
      rowTotals,
      grandTotalIngresos,
      grandTotalEgresos,
      grandNetFlow,
      finalSaldo,
    };
  }, [movements, baseDateStr, daysColumns, conceptRows, mult, initialBalance]);

  // Manejo de Reprogramación de Partida (Mover Fecha)
  const handleOpenReschedule = (mov: CashFlowMovement) => {
    setReschedulingMovement(mov);
    setNewTargetDate(mov.fechaEstimada);
    setRescheduleReason(mov.motivoReprogramacion || '');
  };

  const handleConfirmReschedule = () => {
    if (!reschedulingMovement || !newTargetDate) return;

    const oldDate = reschedulingMovement.fechaEstimada;
    const updated: CashFlowMovement = {
      ...reschedulingMovement,
      fechaEstimada: newTargetDate,
      fechaOriginal: reschedulingMovement.fechaOriginal || oldDate,
      reprogramado: true,
      motivoReprogramacion: rescheduleReason || 'Reprogramado por acuerdo de tesorería/cliente',
    };

    onUpdateMovement(updated);

    // Toast de confirmación
    setToastMessage({
      type: 'success',
      text: `Partida "${updated.concepto.slice(0, 36)}..." movida del ${oldDate} al ${newTargetDate}. El flujo diario y saldos arrastrados fueron recalculados.`,
    });

    // Cerrar modales
    setReschedulingMovement(null);
    if (selectedCell) {
      // Actualizar listado en el drilldown
      setSelectedCell((prev) => {
        if (!prev) return null;
        const remaining = prev.movements.filter((m) => m.id !== updated.id);
        const newAmt = remaining.reduce((s, m) => s + m.montoTotal, 0);
        return {
          ...prev,
          movements: remaining,
          amount: newAmt,
        };
      });
    }

    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // 7. Payload estructurado para el Diseñador Gráfico de Excel y exportador nativo ExcelJS
  const matrixExportPayload = useMemo<MatrixExportData>(
    () => ({
      daysColumns,
      conceptRows,
      dailyTotals: matrixData.dailyTotals,
      cellMap: matrixData.cellMap,
      rowTotals: matrixData.rowTotals,
      grandTotalIngresos: matrixData.grandTotalIngresos,
      grandTotalEgresos: matrixData.grandTotalEgresos,
      grandNetFlow: matrixData.grandNetFlow,
      finalSaldo: matrixData.finalSaldo,
      initialBalance,
      scenario,
      baseDateStr,
      rawMovements: movements,
    }),
    [daysColumns, conceptRows, matrixData, initialBalance, scenario, baseDateStr, movements]
  );

  // 8. Exportador a Planilla Excel (.xlsx) con Formato Profesional ExcelJS
  const handleExportMatrixExcel = async () => {
    try {
      setIsExportingQuickExcel(true);
      const blob = await generateStyledCashFlowExcel({
        company,
        theme: EXCEL_PRESET_THEMES.NAVY_CORPORATE,
        matrixData: matrixExportPayload,
      });

      const dateClean = baseDateStr || new Date().toISOString().split('T')[0];
      const rutClean = company.rut.replace(/[^a-zA-Z0-9]/g, '');
      downloadBlobAsFile(blob, `Flujo_Caja_${daysColumns.length}Dias_${rutClean}_${dateClean}.xlsx`);

      setToastMessage({
        type: 'success',
        text: `Planilla Excel de ${daysColumns.length} días diarios descargada con éxito (estilo Azul Corporativo, cabeceras, colores, formatos contables e inmovilización de paneles).`,
      });
    } catch (err) {
      console.error('Error al exportar matriz en Excel:', err);
    } finally {
      setIsExportingQuickExcel(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Toast de Notificación Flotante */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-3 p-3.5 bg-slate-900 border border-emerald-500/60 text-white rounded-xl shadow-2xl animate-fade-in max-w-md">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <p className="text-xs font-medium leading-relaxed">{toastMessage.text}</p>
          <button onClick={() => setToastMessage(null)} className="text-slate-400 hover:text-white ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 1. BARRA SUPERIOR DE CONTROL & HERRAMIENTAS FINANCIERAS */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full">
                Vista Excel Financiero (Matriz {daysColumns.length} Días Diarios)
              </span>
              <span className="text-slate-300">|</span>
              <span className="text-xs text-slate-500">
                Saldo Inicial Consolidado:{' '}
                <strong className="text-slate-900 font-mono">{formatCLP(initialBalance)}</strong>
              </span>
              <span className="text-slate-300">|</span>
              <span className="text-xs text-slate-500">
                Escenario:{' '}
                <strong className={scenario === 'ESTRESADO' ? 'text-rose-600' : 'text-slate-900'}>
                  {scenario}
                </strong>
              </span>
            </div>
            <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-amber-600" />
              Matriz Diaria de Flujo de Caja & Arrastre ({daysColumns.length} Días Diarios Proyectados)
            </h3>
            <p className="text-xs text-slate-500">
              Visualiza totales diarios a 30, 60, 90 días o 1 año corrido. Haz clic en cualquier celda para
              auditar partidas y reprogramar fechas con recálculo automático instantáneo.
            </p>
          </div>

          {/* Acciones Principales y Diseñador Gráfico */}
          <div className="flex flex-wrap items-center gap-2">
            {/* BOTÓN ESTRELLA: DISEÑADOR GRÁFICO EXCEL */}
            <button
              type="button"
              onClick={() => setIsDesignerModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-indigo-600 via-indigo-700 to-slate-900 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-lg text-xs font-bold transition-all shadow-md cursor-pointer border border-indigo-400/30 group"
              title="Abrir Diseñador Gráfico de Excel para personalizar paletas, colores, fuentes y formatos antes de descargar"
            >
              <Palette className="w-3.5 h-3.5 text-indigo-300 group-hover:rotate-12 transition-transform" />
              <span>Diseñador Gráfico Excel</span>
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-emerald-400 text-slate-950 font-black text-[9px] uppercase tracking-wider">
                Diseñar
              </span>
            </button>

            {/* Descarga Rápida (.xlsx) */}
            <button
              type="button"
              onClick={handleExportMatrixExcel}
              disabled={isExportingQuickExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
              title="Descargar matriz en Excel con estilo corporativo predeterminado"
            >
              {isExportingQuickExcel ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Compilando...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Descarga Rápida (.xlsx)</span>
                </>
              )}
            </button>

            {onOpenParamsModal && (
              <button
                type="button"
                onClick={onOpenParamsModal}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all border border-slate-300 cursor-pointer"
              >
                <Sliders className="w-3.5 h-3.5 text-slate-600" />
                <span>Parámetros ERP</span>
              </button>
            )}

            {onOpenProvisionesModal && (
              <button
                type="button"
                onClick={onOpenProvisionesModal}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-900 rounded-lg text-xs font-bold transition-all border border-purple-300 cursor-pointer shadow-xs"
                title="Gestor ABM de Provisiones de Egresos (Contables vs. Extracontables, IVA 19% y Partidas No Periódicas)"
              >
                <FileText className="w-3.5 h-3.5 text-purple-600" />
                <span>ABM Provisiones ({provisionesEgresos.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* Filtros de Horizonte y Fecha Base */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-500 font-semibold flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              Fecha Inicio:
            </span>
            <input
              type="date"
              value={baseDateStr}
              onChange={(e) => setBaseDateStr(e.target.value)}
              className="px-2.5 py-1 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
            />
            <button
              type="button"
              onClick={() => {
                const today = new Date().toISOString().split('T')[0];
                setBaseDateStr(today);
                setToastMessage({
                  type: 'success',
                  text: `Fecha base actualizada a Hoy (${today})`,
                });
                setTimeout(() => setToastMessage(null), 3000);
              }}
              className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold rounded-lg text-xs transition-colors flex items-center gap-1 shadow-xs cursor-pointer"
              title="Iniciar flujo de caja a partir del día de hoy"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Hoy</span>
            </button>

            {/* Rango de Proyección Diaria de la Planilla */}
            <div className="flex flex-wrap items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 ml-2 gap-0.5">
              <span className="text-slate-500 text-[11px] px-1.5 font-semibold">Proyección Diaria:</span>
              <button
                type="button"
                onClick={() => handleHorizonChange('30_DIAS')}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  horizonType === '30_DIAS'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
                title="Proyección de 30 días corridos día por día"
              >
                30 Días
              </button>
              <button
                type="button"
                onClick={() => handleHorizonChange('60_DIAS')}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  horizonType === '60_DIAS'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
                title="Proyección de 60 días corridos día por día"
              >
                60 Días
              </button>
              <button
                type="button"
                onClick={() => handleHorizonChange('90_DIAS')}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  horizonType === '90_DIAS'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
                title="Proyección de 90 días corridos día por día"
              >
                90 Días
              </button>
              <button
                type="button"
                onClick={() => handleHorizonChange('1_ANIO')}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  horizonType === '1_ANIO'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
                title="Proyección anual de 365 días corridos día por día"
              >
                1 Año (365 Días)
              </button>
              <span className="text-slate-300 mx-0.5">|</span>
              <button
                type="button"
                onClick={() => handleHorizonChange('MES_COMPLETO')}
                className={`px-2 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  horizonType === 'MES_COMPLETO'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
                title="Desde el día 1 hasta fin del mes calendario actual"
              >
                Mes Completo
              </button>
              <button
                type="button"
                onClick={() => handleHorizonChange('15_DIAS')}
                className={`px-2 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  horizonType === '15_DIAS'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
                title="Quincenal (15 días corridos)"
              >
                15 Días
              </button>
              <button
                type="button"
                onClick={() => handleHorizonChange('PROXIMO_MES')}
                className={`px-2 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  horizonType === 'PROXIMO_MES'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
                title="Mes siguiente completo día por día"
              >
                Próximo Mes
              </button>
            </div>
          </div>

          {/* Quick Scenario & Info */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <span className="text-slate-500 text-[11px] px-1.5 font-semibold">Simulación:</span>
              <button
                type="button"
                onClick={() => handleScenarioChange('BASE')}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                  scenario === 'BASE'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
                title="Flujo de caja base (100% de compromisos reales)"
              >
                Base
              </button>
              <button
                type="button"
                onClick={() => handleScenarioChange('OPTIMISTA')}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                  scenario === 'OPTIMISTA'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
                title="Cobranzas +15%, pagos adelantados 5%"
              >
                Optimista (+15%)
              </button>
              <button
                type="button"
                onClick={() => handleScenarioChange('ESTRESADO')}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                  scenario === 'ESTRESADO'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
                title="Mora de cobranzas 30%, sobrecostos de egresos 10%"
              >
                Estresado (-30%)
              </button>
            </div>

            <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={filterOnlyWithBalance}
                onChange={(e) => setFilterOnlyWithBalance(e.target.checked)}
                className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
              />
              <span>Ocultar filas sin movimientos</span>
            </label>
          </div>
        </div>
      </div>

      {/* 2. LA MATRIZ EXCEL FINANCIERA (CONTENEDOR DE ALTA DENSIDAD CON FREEZE HEADERS) */}
      <div className="bg-white border-2 border-slate-800 rounded-xl shadow-lg overflow-hidden flex flex-col">
        {/* Leyenda y Barra de Estado */}
        <div className="bg-slate-900 text-white px-4 py-2.5 flex flex-wrap items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-4">
            <span className="text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              PLANILLA DE CAJA: {daysColumns.length} DÍAS ({daysColumns[0]?.dayDisplay} AL{' '}
              {daysColumns[daysColumns.length - 1]?.dayDisplay})
            </span>
            <span className="text-slate-500">|</span>
            <span className="text-slate-300 text-[11px]">
              Tip: Haz clic en cualquier monto para ver partidas individuales y reprogramar fechas.
            </span>
          </div>

          <div className="flex items-center gap-4 text-[11px]">
            <span>
              Saldo Inicial:{' '}
              <strong className="text-amber-300">{formatCLP(initialBalance)}</strong>
            </span>
            <span>
              Flujo Neto Período:{' '}
              <strong className={matrixData.grandNetFlow >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                {formatCLP(matrixData.grandNetFlow)}
              </strong>
            </span>
            <span>
              Saldo Final Proyectado:{' '}
              <strong className={matrixData.finalSaldo >= 0 ? 'text-emerald-300' : 'text-rose-400'}>
                {formatCLP(matrixData.finalSaldo)}
              </strong>
            </span>
          </div>
        </div>

        {/* Scroll Horizontal de la Matriz */}
        <div className="overflow-x-auto max-h-[70vh] border-t border-slate-700">
          <table className="w-full border-collapse text-xs select-none">
            {/* Cabecera Fija */}
            <thead className="sticky top-0 z-30 shadow-md">
              {/* FILA 1: DÍAS (1, 2, 3...) Y HEADER AMARILLO TIPO EXCEL */}
              <tr className="bg-amber-400 text-slate-900 border-b border-amber-500 font-black text-center text-xs">
                <th
                  scope="col"
                  className="sticky left-0 z-40 bg-amber-400 p-2 text-left w-72 min-w-72 border-r-2 border-slate-800 uppercase tracking-wider"
                >
                  RESUMEN FLUJO
                </th>
                <th scope="col" className="p-2 border-r border-amber-500 w-28 min-w-28 uppercase text-[11px]">
                  FECHA FLUJO
                </th>
                {daysColumns.map((c) => (
                  <th
                    key={c.dateStr}
                    scope="col"
                    className={`p-2 border-r border-amber-500 min-w-32 text-center ${
                      c.isWeekend ? 'bg-amber-400/80 text-slate-700' : ''
                    }`}
                  >
                    <div className="font-black text-sm">{c.index}</div>
                    <div className="text-[10px] font-medium text-slate-800">
                      {c.dayOfWeek} {c.dayNumber}
                    </div>
                  </th>
                ))}
                <th scope="col" className="p-2 bg-amber-500 text-slate-950 font-black min-w-36 text-right pr-3">
                  TOTAL PERÍODO
                </th>
              </tr>

              {/* FILA 2: FECHAS REALES DD-MM-YYYY (Azul Oscuro en la imagen del usuario) */}
              <tr className="bg-blue-900 text-white border-b-2 border-blue-950 font-mono text-[11px]">
                <th
                  scope="row"
                  className="sticky left-0 z-40 bg-blue-900 p-2 text-left border-r-2 border-slate-800 font-bold uppercase tracking-wider"
                >
                  FECHA DE FLUJO
                </th>
                <th className="p-2 border-r border-blue-800 text-center font-bold">-</th>
                {daysColumns.map((c) => (
                  <th
                    key={c.dateStr}
                    className="p-1.5 border-r border-blue-800/80 text-center font-bold tracking-tight text-[10px]"
                  >
                    {c.dayDisplay}
                  </th>
                ))}
                <th className="p-2 bg-blue-950 text-right pr-3 font-bold font-mono">
                  {daysColumns.length} DÍAS
                </th>
              </tr>

              {/* FILA 3: TOTAL EGRESOS (Texto Rojo con Signo Negativo como en la imagen) */}
              <tr className="bg-white hover:bg-rose-50/50 border-b border-slate-300 font-mono font-bold text-xs transition-colors">
                <th
                  scope="row"
                  className="sticky left-0 z-40 bg-white p-2 text-left border-r-2 border-slate-800 text-rose-700 font-black uppercase flex items-center justify-between"
                >
                  <span className="flex items-center gap-1.5">
                    <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
                    TOTAL EGRESOS
                  </span>
                  <span className="text-[10px] font-normal text-slate-400">(-)</span>
                </th>
                <td className="p-2 border-r border-slate-200 text-center text-slate-400 font-medium">Diario</td>
                {daysColumns.map((c) => {
                  const egr = matrixData.dailyTotals[c.dateStr].totalEgresos;
                  return (
                    <td
                      key={c.dateStr}
                      onClick={() => {
                        if (egr > 0) {
                          setSelectedCell({
                            dateStr: c.dateStr,
                            dayNumber: c.index,
                            type: 'EGRESO',
                            amount: egr,
                            movements: matrixData.dailyTotals[c.dateStr].movementsEgreso,
                          });
                        }
                      }}
                      className={`p-2 border-r border-slate-200 text-right font-black ${
                        egr > 0
                          ? 'text-rose-600 hover:bg-rose-100/60 cursor-pointer underline decoration-dotted'
                          : 'text-slate-400'
                      }`}
                      title={egr > 0 ? `Ver detalle de ${matrixData.dailyTotals[c.dateStr].movementsEgreso.length} pagos del ${c.dayDisplay}` : undefined}
                    >
                      {egr > 0 ? `-${formatNumberShort(egr)}` : '0'}
                    </td>
                  );
                })}
                <td className="p-2 bg-rose-50 border-l border-slate-300 text-right pr-3 font-black text-rose-700">
                  -{formatNumberShort(matrixData.grandTotalEgresos)}
                </td>
              </tr>

              {/* FILA 4: TOTAL INGRESOS (Texto Azul / Verde en la imagen) */}
              <tr className="bg-white hover:bg-blue-50/50 border-b-2 border-blue-600 font-mono font-bold text-xs transition-colors">
                <th
                  scope="row"
                  className="sticky left-0 z-40 bg-white p-2 text-left border-r-2 border-slate-800 text-blue-800 font-black uppercase flex items-center justify-between"
                >
                  <span className="flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
                    TOTAL INGRESOS
                  </span>
                  <span className="text-[10px] font-normal text-slate-400">(+)</span>
                </th>
                <td className="p-2 border-r border-slate-200 text-center text-slate-400 font-medium">Diario</td>
                {daysColumns.map((c) => {
                  const ing = matrixData.dailyTotals[c.dateStr].totalIngresos;
                  return (
                    <td
                      key={c.dateStr}
                      onClick={() => {
                        if (ing > 0) {
                          setSelectedCell({
                            dateStr: c.dateStr,
                            dayNumber: c.index,
                            type: 'INGRESO',
                            amount: ing,
                            movements: matrixData.dailyTotals[c.dateStr].movementsIngreso,
                          });
                        }
                      }}
                      className={`p-2 border-r border-slate-200 text-right font-black ${
                        ing > 0
                          ? 'text-blue-700 hover:bg-blue-100/60 cursor-pointer underline decoration-dotted'
                          : 'text-slate-400'
                      }`}
                      title={ing > 0 ? `Ver detalle de ${matrixData.dailyTotals[c.dateStr].movementsIngreso.length} cobranzas del ${c.dayDisplay}` : undefined}
                    >
                      {ing > 0 ? formatNumberShort(ing) : '-'}
                    </td>
                  );
                })}
                <td className="p-2 bg-blue-50 border-l border-slate-300 text-right pr-3 font-black text-blue-800">
                  {formatNumberShort(matrixData.grandTotalIngresos)}
                </td>
              </tr>

              {/* FILA 5: SALDO DIARIO (Flujo Neto) */}
              <tr className="bg-slate-100 hover:bg-slate-200/60 border-b-2 border-slate-300 font-mono font-bold text-xs transition-colors">
                <th
                  scope="row"
                  className="sticky left-0 z-40 bg-slate-100 p-2 text-left border-r-2 border-slate-800 text-slate-900 font-black uppercase tracking-wider"
                >
                  SALDO DIARIO
                </th>
                <td className="p-2 border-r border-slate-300 text-center text-slate-500 font-medium">Neto</td>
                {daysColumns.map((c) => {
                  const net = matrixData.dailyTotals[c.dateStr].saldoDiario;
                  const allDayMovs = [
                    ...matrixData.dailyTotals[c.dateStr].movementsIngreso,
                    ...matrixData.dailyTotals[c.dateStr].movementsEgreso,
                  ];
                  return (
                    <td
                      key={c.dateStr}
                      onClick={() => {
                        if (allDayMovs.length > 0) {
                          setSelectedCell({
                            dateStr: c.dateStr,
                            dayNumber: c.index,
                            type: 'SALDO_DIARIO',
                            amount: net,
                            movements: allDayMovs,
                          });
                        }
                      }}
                      className={`p-2 border-r border-slate-300 text-right font-black ${
                        net > 0
                          ? 'text-emerald-700 bg-emerald-50/40'
                          : net < 0
                          ? 'text-rose-700 bg-rose-50/40'
                          : 'text-slate-500'
                      } ${allDayMovs.length > 0 ? 'cursor-pointer hover:underline' : ''}`}
                    >
                      {net !== 0 ? (net < 0 ? `-${formatNumberShort(Math.abs(net))}` : formatNumberShort(net)) : '0'}
                    </td>
                  );
                })}
                <td
                  className={`p-2 border-l border-slate-300 text-right pr-3 font-black ${
                    matrixData.grandNetFlow >= 0 ? 'text-emerald-800 bg-emerald-100' : 'text-rose-800 bg-rose-100'
                  }`}
                >
                  {formatNumberShort(matrixData.grandNetFlow)}
                </td>
              </tr>

              {/* FILA 6: SALDOS ARRASTRADOS ACUM (Línea Azul con Saldos Progresivos) */}
              <tr className="bg-blue-600 text-white border-b-4 border-slate-900 font-mono font-black text-xs">
                <th
                  scope="row"
                  className="sticky left-0 z-40 bg-blue-600 p-2 text-left border-r-2 border-slate-800 text-white font-black uppercase tracking-wider shadow-md flex items-center justify-between"
                >
                  <span>SALDOS ARRASTRADOS ACUM</span>
                  <span className="text-[10px] text-blue-200 font-normal">Cierre Día</span>
                </th>
                <td className="p-2 border-r border-blue-500 text-center text-blue-200 font-bold">Acum</td>
                {daysColumns.map((c) => {
                  const acum = matrixData.dailyTotals[c.dateStr].saldoArrastrado;
                  const isDeficit = acum < 0;
                  return (
                    <td
                      key={c.dateStr}
                      className={`p-2 border-r border-blue-500 text-right font-mono font-black text-xs tracking-tight ${
                        isDeficit ? 'bg-rose-600 text-white animate-pulse' : 'text-white'
                      }`}
                      title={`Saldo al cierre del ${c.dayDisplay}: ${formatCLP(acum)}`}
                    >
                      {formatNumberShort(acum)}
                    </td>
                  );
                })}
                <td
                  className={`p-2 text-right pr-3 font-black border-l-2 border-slate-900 ${
                    matrixData.finalSaldo >= 0 ? 'bg-blue-900 text-emerald-300' : 'bg-rose-900 text-white'
                  }`}
                >
                  {formatNumberShort(matrixData.finalSaldo)}
                </td>
              </tr>
            </thead>

            {/* CUERPO DE LA MATRIZ: DETALLE POR CONCEPTO */}
            <tbody className="divide-y divide-slate-200 font-mono text-xs">
              {/* SECCIÓN 1: INGRESOS */}
              <tr className="bg-slate-800 text-white font-bold text-xs uppercase tracking-wider">
                <td colSpan={daysColumns.length + 3} className="p-2 px-3 flex items-center gap-2">
                  <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
                  <span>1. INGRESOS DE CAJA & COBRANZAS OPERACIONALES</span>
                </td>
              </tr>

              {conceptRows
                .filter((r) => r.grupo === 'INGRESO')
                .filter((r) => !filterOnlyWithBalance || matrixData.rowTotals[r.id].total > 0)
                .map((r, idx) => (
                  <tr
                    key={r.id}
                    className={`hover:bg-blue-50/40 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}`}
                  >
                    <td className="sticky left-0 z-20 bg-inherit p-2 pl-4 text-left border-r-2 border-slate-800 text-slate-800 font-semibold tracking-tight truncate max-w-72">
                      <div className="flex items-center justify-between">
                        <span className="truncate" title={r.nombre}>
                          {r.nombre}
                        </span>
                        {matrixData.rowTotals[r.id].count > 0 && (
                          <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-1.5 py-0.2 rounded-full shrink-0 ml-1">
                            {matrixData.rowTotals[r.id].count}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-1.5 border-r border-slate-200 text-center text-slate-400 font-mono text-[10px]">
                      {r.cuentaContableRef}
                    </td>

                    {daysColumns.map((c) => {
                      const cell = matrixData.cellMap[r.id][c.dateStr];
                      const hasVal = cell.total > 0;
                      return (
                        <td
                          key={c.dateStr}
                          onClick={() => {
                            if (hasVal) {
                              setSelectedCell({
                                dateStr: c.dateStr,
                                dayNumber: c.index,
                                conceptRowId: r.id,
                                conceptNombre: r.nombre,
                                type: 'CONCEPTO',
                                amount: cell.total,
                                movements: cell.movements,
                              });
                            }
                          }}
                          className={`p-2 border-r border-slate-200 text-right font-medium ${
                            hasVal
                              ? 'text-blue-900 font-bold bg-blue-50/70 hover:bg-blue-100 cursor-pointer underline decoration-dotted'
                              : 'text-slate-300'
                          }`}
                          title={hasVal ? `${cell.count} partidas por ${formatCLP(cell.total)}. Clic para auditar/mover.` : undefined}
                        >
                          {hasVal ? formatNumberShort(cell.total) : '-'}
                        </td>
                      );
                    })}

                    <td className="p-2 bg-slate-100 border-l border-slate-300 text-right pr-3 font-bold text-blue-900">
                      {formatNumberShort(matrixData.rowTotals[r.id].total)}
                    </td>
                  </tr>
                ))}

              {/* SECCIÓN 2: EGRESOS */}
              <tr className="bg-slate-800 text-white font-bold text-xs uppercase tracking-wider">
                <td colSpan={daysColumns.length + 3} className="p-2 px-3 flex items-center gap-2">
                  <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                  <span>2. EGRESOS DE CAJA & PAGOS DE PROVEEDORES / NÓMINA / IMPUESTOS</span>
                </td>
              </tr>

              {conceptRows
                .filter((r) => r.grupo === 'EGRESO')
                .filter((r) => !filterOnlyWithBalance || matrixData.rowTotals[r.id].total > 0)
                .map((r, idx) => (
                  <tr
                    key={r.id}
                    className={`hover:bg-rose-50/40 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}`}
                  >
                    <td className="sticky left-0 z-20 bg-inherit p-2 pl-4 text-left border-r-2 border-slate-800 text-slate-800 font-semibold tracking-tight truncate max-w-72">
                      <div className="flex items-center justify-between">
                        <span className="truncate" title={r.nombre}>
                          {r.nombre}
                        </span>
                        {matrixData.rowTotals[r.id].count > 0 && (
                          <span className="text-[10px] bg-rose-100 text-rose-700 font-bold px-1.5 py-0.2 rounded-full shrink-0 ml-1">
                            {matrixData.rowTotals[r.id].count}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-1.5 border-r border-slate-200 text-center text-slate-400 font-mono text-[10px]">
                      {r.cuentaContableRef}
                    </td>

                    {daysColumns.map((c) => {
                      const cell = matrixData.cellMap[r.id][c.dateStr];
                      const hasVal = cell.total > 0;
                      return (
                        <td
                          key={c.dateStr}
                          onClick={() => {
                            if (hasVal) {
                              setSelectedCell({
                                dateStr: c.dateStr,
                                dayNumber: c.index,
                                conceptRowId: r.id,
                                conceptNombre: r.nombre,
                                type: 'CONCEPTO',
                                amount: cell.total,
                                movements: cell.movements,
                              });
                            }
                          }}
                          className={`p-2 border-r border-slate-200 text-right font-medium ${
                            hasVal
                              ? 'text-rose-900 font-bold bg-rose-50/70 hover:bg-rose-100 cursor-pointer underline decoration-dotted'
                              : 'text-slate-300'
                          }`}
                          title={hasVal ? `${cell.count} pagos por ${formatCLP(cell.total)}. Clic para auditar/mover.` : undefined}
                        >
                          {hasVal ? formatNumberShort(cell.total) : '-'}
                        </td>
                      );
                    })}

                    <td className="p-2 bg-slate-100 border-l border-slate-300 text-right pr-3 font-bold text-rose-900">
                      {formatNumberShort(matrixData.rowTotals[r.id].total)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. MODAL DE DRILL-DOWN: AUDITORÍA DE PARTIDAS DIARIAS */}
      {selectedCell && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-300 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-scale-in">
            {/* Header del Modal */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm ${
                    selectedCell.type === 'EGRESO'
                      ? 'bg-rose-600 text-white'
                      : selectedCell.type === 'INGRESO'
                      ? 'bg-blue-600 text-white'
                      : 'bg-amber-500 text-slate-900'
                  }`}
                >
                  {selectedCell.dayNumber}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>
                      {selectedCell.conceptNombre
                        ? selectedCell.conceptNombre
                        : selectedCell.type === 'EGRESO'
                        ? 'Total Egresos del Día'
                        : selectedCell.type === 'INGRESO'
                        ? 'Total Ingresos del Día'
                        : 'Movimientos del Día'}
                    </span>
                    <span className="text-xs text-amber-300 font-mono font-normal">
                      ({selectedCell.dateStr})
                    </span>
                  </h4>
                  <p className="text-xs text-slate-400">
                    {selectedCell.movements.length} partidas individuales que componen el saldo total de{' '}
                    <strong className="text-white font-mono">{formatCLP(selectedCell.amount)}</strong>.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedCell(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Listado de Partidas */}
            <div className="p-4 overflow-y-auto space-y-3 flex-1">
              {selectedCell.movements.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                  No hay partidas registradas en esta fecha.
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">Tipo</th>
                        <th className="p-2.5">Contraparte / RUT</th>
                        <th className="p-2.5">Concepto / Glosa</th>
                        <th className="p-2.5 text-center">Folio / Doc</th>
                        <th className="p-2.5 text-right">Monto CLP</th>
                        <th className="p-2.5 text-center">Fecha Actual</th>
                        <th className="p-2.5 text-center">Estado</th>
                        <th className="p-2.5 text-center">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-medium text-slate-800">
                      {selectedCell.movements.map((m) => (
                        <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-2.5">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                m.tipo === 'INGRESO'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {m.tipo}
                            </span>
                          </td>
                          <td className="p-2.5">
                            <div className="font-bold text-slate-900 truncate max-w-44">{m.contraparte}</div>
                            {m.rutContraparte && (
                              <div className="text-[10px] text-slate-500 font-mono">{m.rutContraparte}</div>
                            )}
                          </td>
                          <td className="p-2.5">
                            <div className="text-slate-800 truncate max-w-64" title={m.concepto}>
                              {m.concepto}
                            </div>
                            {m.reprogramado && (
                              <div className="flex items-center gap-1 text-[10px] text-amber-700 font-semibold mt-0.5">
                                <Clock className="w-3 h-3 text-amber-600" />
                                <span>Reprogramado (Origen: {m.fechaOriginal})</span>
                              </div>
                            )}
                          </td>
                          <td className="p-2.5 text-center font-mono">
                            {m.dteFolioAsociado ? (
                              <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded">
                                DTE #{m.dteFolioAsociado}
                              </span>
                            ) : m.documentoReferencia ? (
                              <span className="text-[11px] text-slate-600 font-mono">
                                {m.documentoReferencia}
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                            {formatCLP(m.montoTotal)}
                          </td>
                          <td className="p-2.5 text-center font-mono text-slate-600 font-semibold">
                            {m.fechaEstimada}
                          </td>
                          <td className="p-2.5 text-center">
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                m.estado === 'COBRADO' || m.estado === 'PAGADO'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : m.estado === 'VENCIDO'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {m.estado}
                            </span>
                          </td>
                          <td className="p-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleOpenReschedule(m)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs"
                              title="Cambiar fecha de cobro/pago para recalcular el flujo"
                            >
                              <Calendar className="w-3 h-3 text-amber-700" />
                              <span>Mover Fecha</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer del Modal */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-mono">
                Al mover una fecha, el saldo diario y arrastrado se recalcularán al instante.
              </span>
              <button
                type="button"
                onClick={() => setSelectedCell(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold cursor-pointer"
              >
                Cerrar Detalle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. MODAL PARA REPROGRAMAR FECHA DE PARTIDA (MOVER PARTIDA) */}
      {reschedulingMovement && (
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-amber-500 rounded-2xl p-5 max-w-lg w-full shadow-2xl text-slate-900 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-100 rounded-lg text-amber-800">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Reprogramar Fecha de Partida de Flujo
                  </h4>
                  <p className="text-xs text-slate-500">
                    Reubica la partida en otro día del mes o en meses futuros.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReschedulingMovement(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Ficha Resumen de la Partida a Mover */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Contraparte:</span>
                <strong className="text-slate-900">{reschedulingMovement.contraparte}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Concepto:</span>
                <span className="text-slate-800 truncate max-w-64 font-medium">
                  {reschedulingMovement.concepto}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Monto:</span>
                <strong className="text-slate-900 font-mono text-sm text-emerald-700">
                  {formatCLP(reschedulingMovement.montoTotal)}
                </strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Fecha Estimada Actual:</span>
                <strong className="text-rose-700 font-mono">
                  {reschedulingMovement.fechaEstimada}
                </strong>
              </div>
            </div>

            {/* Selector de Nueva Fecha */}
            <div className="space-y-2 text-xs">
              <label className="block text-slate-700 font-bold">
                Nueva Fecha Proyectada de Pago/Cobro:
              </label>
              <input
                type="date"
                value={newTargetDate}
                onChange={(e) => setNewTargetDate(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer text-sm"
              />

              {/* Botones de Atajo Rápido de Fechas */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] text-slate-500 font-semibold mr-1">Atajos:</span>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date(reschedulingMovement.fechaEstimada);
                    d.setDate(d.getDate() + 7);
                    setNewTargetDate(d.toISOString().split('T')[0]);
                  }}
                  className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded text-[11px] font-bold text-slate-700 cursor-pointer"
                >
                  +7 Días
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date(reschedulingMovement.fechaEstimada);
                    d.setDate(d.getDate() + 15);
                    setNewTargetDate(d.toISOString().split('T')[0]);
                  }}
                  className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded text-[11px] font-bold text-slate-700 cursor-pointer"
                >
                  +15 Días
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // Fin del mes de la fecha actual
                    const d = new Date(reschedulingMovement.fechaEstimada);
                    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    setNewTargetDate(`${d.getFullYear()}-${month}-${lastDay}`);
                  }}
                  className="px-2 py-0.5 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded text-[11px] font-bold text-amber-900 cursor-pointer"
                >
                  Fin de Mes (30-09)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // Día 5 del mes siguiente
                    const d = new Date(reschedulingMovement.fechaEstimada);
                    const nextMonth = d.getMonth() + 2;
                    const monthStr = String(nextMonth > 12 ? 1 : nextMonth).padStart(2, '0');
                    const year = nextMonth > 12 ? d.getFullYear() + 1 : d.getFullYear();
                    setNewTargetDate(`${year}-${monthStr}-05`);
                  }}
                  className="px-2 py-0.5 bg-blue-100 hover:bg-blue-200 border border-blue-300 rounded text-[11px] font-bold text-blue-900 cursor-pointer"
                >
                  Día 5 Próx. Mes
                </button>
              </div>
            </div>

            {/* Motivo de la Reprogramación */}
            <div className="space-y-1.5 text-xs">
              <label className="block text-slate-700 font-bold">
                Motivo / Nota del Contador o Cliente:
              </label>
              <textarea
                rows={2}
                value={rescheduleReason}
                onChange={(e) => setRescheduleReason(e.target.value)}
                placeholder="Ej: Cliente avisa que pagará el 30 en vez del 5 según acuerdo telefónico."
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* Simulación de Impacto Contable */}
            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs space-y-1 text-amber-900">
              <div className="font-bold flex items-center gap-1.5 text-amber-950">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                <span>Impacto en la Matriz Diaria:</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                • El día original <strong>{reschedulingMovement.fechaEstimada}</strong> restará{' '}
                <strong>{formatCLP(reschedulingMovement.montoTotal)}</strong>.
              </p>
              <p className="text-[11px] leading-relaxed">
                • El nuevo día <strong>{newTargetDate || '---'}</strong> sumará{' '}
                <strong>{formatCLP(reschedulingMovement.montoTotal)}</strong>.
              </p>
              <p className="text-[11px] text-slate-600 italic">
                * El saldo final acumulado al cierre del horizonte no varía, pero se ajustan los saldos diarios
                intermedios evitando o alertando posibles quiebres de caja.
              </p>
            </div>

            {/* Botones de Acción */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setReschedulingMovement(null)}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmReschedule}
                disabled={!newTargetDate || newTargetDate === reschedulingMovement.fechaEstimada}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 rounded-lg text-xs font-black shadow-md flex items-center gap-2 cursor-pointer transition-all"
              >
                <CheckCircle2 className="w-4 h-4 text-slate-950" />
                <span>Confirmar y Recalcular Flujo</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Diseñador Gráfico de Excel */}
      <CashFlowExcelDesignerModal
        isOpen={isDesignerModalOpen}
        onClose={() => setIsDesignerModalOpen(false)}
        company={company}
        matrixData={matrixExportPayload}
      />
    </div>
  );
};
