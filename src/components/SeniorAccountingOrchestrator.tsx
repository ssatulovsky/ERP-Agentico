import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  Scale,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Plus,
  Copy,
  Check,
  Search,
  RefreshCw,
  Send,
  Bot,
  Sparkles,
  DollarSign,
  PieChart,
  Layers,
  ArrowRight,
  Table,
  Building2,
  Landmark,
  ShieldCheck,
  Download,
  Info,
  Calendar,
  Sliders,
  ChevronRight,
  TrendingUp,
  Boxes,
  Factory,
  UserCheck,
  Users,
  Receipt,
  FileText,
  Edit2,
  Edit3,
  Trash2,
  FolderTree,
  FileUp,
  Globe,
  Building,
  CheckSquare,
  ListTree,
  ChevronDown,
  ChevronUp,
  Lock,
  Unlock,
  Activity,
  Wallet,
} from 'lucide-react';
import {
  AccountingEntry,
  AccountingEntryLine,
  CompanyProfile,
  AccountingFirmProfile,
  ChileIndicators,
  DteDocument,
  EmployeePayroll,
  F29Declaration,
  LeaseContract,
  BankStatementMovement,
  HierarchicalAccountItem,
  TrialBalance8ColAccount,
  Balance8ColumnasReport,
  OrchestratorAuditItem,
  AccountingProposalResponse,
  PeriodClosingAdjustment,
  AccountGroupDefinition,
  BalanceGroupingMode,
  GroupedBalanceReport,
  ClientCompany,
  FixedAsset,
  ProductionOrder,
  LaborContract,
  MedicalLeave,
  VacationRecord,
  AbsenteeismRecord,
  HrBenefit,
  SystemGeneralParameters,
} from '../types';
import { formatCLP, formatNumberCL, formatNormalizedAccountingEntry } from '../utils/chileanAccounting';
import { normalizeAndValidateJournalEntry } from '../services/journalEntryNormalizer';
import {
  downloadBalance8ColPdf,
  downloadBalance8ColExcel,
  downloadBalance8ColCsv,
  downloadFinancialStatementsPdf,
  downloadFinancialStatementsExcel,
  downloadLibroDiarioPdf,
  downloadLibroDiarioExcel,
  downloadLibroMayorPdf,
} from '../utils/reportGenerators';
import {
  CHILE_HIERARCHICAL_CHART_OF_ACCOUNTS,
  buildOfficial8ColumnBalance,
  buildIFRSFinancialStatements,
  auditPeripheralModules,
  generatePeriodClosingAdjustments,
  validateAndBalanceEntry,
  buildTransactionalAccountingProposalJSON,
  findAccountInChart,
  validateEntryFiscalPeriod,
} from '../utils/accountingOrchestratorEngine';
import { FiscalYearClosingModule } from './FiscalYearClosingModule';
import {
  loadCompanyChartOfAccounts,
  saveCompanyChartOfAccounts,
  loadCompanyGroups,
  saveCompanyGroups,
  resetCompanyChartToDefault,
  buildGroupedBalanceReport,
} from '../utils/companyChartOfAccountsService';
import { AccountEditModal } from './accounting/AccountEditModal';
import { GroupManagerModal } from './accounting/GroupManagerModal';
import { ImportExportChartModal } from './accounting/ImportExportChartModal';
import { GroupedBalanceView } from './accounting/GroupedBalanceView';
import { seedF29 } from '../data/seedData';
import { AccountingEventAssistant } from './accounting/AccountingEventAssistant';
import { EditClosingAdjustmentModal } from './accounting/EditClosingAdjustmentModal';
import { CashFlowIndirectView } from './accounting/CashFlowIndirectView';
import { SearchableAccountSelect } from './accounting/SearchableAccountSelect';
import { SEED_COST_CENTERS } from '../data/seedCostCenters';
import { INITIAL_CLIENT_AUXILIARIES } from '../data/erpMasterConfig';

interface SeniorAccountingOrchestratorProps {
  company: CompanyProfile;
  onUpdateCompany?: (updated: Partial<CompanyProfile>) => void;
  firm: AccountingFirmProfile;
  indicators: ChileIndicators;
  entries: AccountingEntry[];
  onAddEntry: (entry: AccountingEntry) => void;
  commitEntry?: (
    payloadOrEntry: any,
    auditContextOverrides?: any
  ) => Promise<any>;
  isLedgerLoading?: boolean;
  isLedgerCommitting?: boolean;
  refetchLedger?: () => Promise<void>;
  dtes?: DteDocument[];
  onUpdateDte?: (dte: DteDocument) => void;
  payrolls?: EmployeePayroll[];
  f29?: F29Declaration;
  leases?: LeaseContract[];
  bankStatements?: BankStatementMovement[];
  fixedAssets?: FixedAsset[];
  productionOrders?: ProductionOrder[];
  contracts?: LaborContract[];
  medicalLeaves?: MedicalLeave[];
  vacations?: VacationRecord[];
  absenteeismList?: AbsenteeismRecord[];
  benefits?: HrBenefit[];
  systemParams?: SystemGeneralParameters;
  onUpdateSystemParams?: (params: SystemGeneralParameters) => void;
}

export const SeniorAccountingOrchestrator: React.FC<SeniorAccountingOrchestratorProps> = ({
  company,
  onUpdateCompany = () => {},
  firm,
  indicators,
  entries = [],
  onAddEntry,
  commitEntry,
  isLedgerLoading = false,
  isLedgerCommitting = false,
  refetchLedger,
  dtes = [],
  onUpdateDte,
  payrolls = [],
  f29 = seedF29,
  leases = [],
  bankStatements = [],
  fixedAssets = [],
  productionOrders = [],
  contracts = [],
  medicalLeaves = [],
  vacations = [],
  absenteeismList = [],
  benefits = [],
  systemParams,
  onUpdateSystemParams,
}) => {
  const safeEntries = Array.isArray(entries) ? entries : [];
  const safeDtes = Array.isArray(dtes) ? dtes : [];
  const safePayrolls = Array.isArray(payrolls) ? payrolls : [];
  const safeBankStatements = Array.isArray(bankStatements) ? bankStatements : [];
  const safeLeases = Array.isArray(leases) ? leases : [];
  const safeFixedAssets = Array.isArray(fixedAssets) ? fixedAssets : [];
  const safeProductionOrders = Array.isArray(productionOrders) ? productionOrders : [];
  const safeContracts = Array.isArray(contracts) ? contracts : [];
  const safeMedicalLeaves = Array.isArray(medicalLeaves) ? medicalLeaves : [];
  const safeVacations = Array.isArray(vacations) ? vacations : [];
  const safeAbsenteeism = Array.isArray(absenteeismList) ? absenteeismList : [];
  const safeBenefits = Array.isArray(benefits) ? benefits : [];
  // Navigation tabs of the orchestrator
  const [activeTab, setActiveTab] = useState<'AUDIT' | 'DIARIO' | 'MAYOR' | 'AUXILIARES' | 'PLAN_CUENTAS' | 'BALANCE_8COL' | 'FLUJO_EFECTIVO' | 'IFRS' | 'AI_ROUTING' | 'EJERCICIO_CIERRE'>('AUDIT');
  const [aiRoutingSubTab, setAiRoutingSubTab] = useState<'CONVERSACIONAL' | 'GLOSA_DIRECTA'>('CONVERSACIONAL');

  // Multi-currency display mode (CLP, UF, USD)
  const [currencyMode, setCurrencyMode] = useState<'CLP' | 'UF' | 'USD'>('CLP');

  // Filters for Diario
  const [sourceFilter, setSourceFilter] = useState<string>('TODOS');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Mayor account selector
  const [selectedMayorAccountCode, setSelectedMayorAccountCode] = useState<string>('1.1.02.001');

  // Libros Auxiliares state
  const [auxiliarSubTab, setAuxiliarSubTab] = useState<'PROVEEDORES' | 'CLIENTES'>('PROVEEDORES');
  const [auxiliarSearchTerm, setAuxiliarSearchTerm] = useState<string>('');
  const [auxiliarFilterStatus, setAuxiliarFilterStatus] = useState<'TODOS' | 'CON_SALDO' | 'SALDADO'>('TODOS');
  const [selectedAuxiliarRut, setSelectedAuxiliarRut] = useState<string | null>(null);

  // Plan de cuentas filter & search
  const [planClassFilter, setPlanClassFilter] = useState<number | 'TODOS'>('TODOS');
  const [planAttributeFilter, setPlanAttributeFilter] = useState<string>('TODOS');
  const [planSearchTerm, setPlanSearchTerm] = useState<string>('');
  
  // Plan de Cuentas Jerárquico Custom por Empresa y Gestión de Grupos
  const [chartOfAccounts, setChartOfAccounts] = useState<HierarchicalAccountItem[]>(() =>
    loadCompanyChartOfAccounts(company.rut)
  );
  const [chartGroups, setChartGroups] = useState<AccountGroupDefinition[]>(() =>
    loadCompanyGroups(company.rut)
  );

  // Sincronizar plan de cuentas y grupos al cambiar de empresa
  React.useEffect(() => {
    setChartOfAccounts(loadCompanyChartOfAccounts(company.rut));
    setChartGroups(loadCompanyGroups(company.rut));
  }, [company.rut]);

  // Modales de Plan de Cuentas
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [accountToEdit, setAccountToEdit] = useState<HierarchicalAccountItem | null>(null);
  const [subaccountParentCode, setSubaccountParentCode] = useState<string | undefined>(undefined);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [importExportModalOpen, setImportExportModalOpen] = useState(false);

  // Modo de agrupación de Balance (Tradicional CMF, Fiscal SII, Casa Matriz HQ, Personalizado)
  const [balanceGroupingMode, setBalanceGroupingMode] = useState<BalanceGroupingMode>('TRADICIONAL_CMF');
  const [isGroupedView, setIsGroupedView] = useState<boolean>(true);

  // Helper para inicializar un asiento manual limpio
  const getInitialManualEntry = () => ({
    fecha: '2026-09-15',
    concepto: '',
    documentoReferencia: '',
    origen: 'MANUAL' as AccountingEntry['origen'],
    lineas: [
      {
        cuentaCodigo: '1.1.02.001',
        cuentaNombre: 'Banco Santander Chile Cta Cte M/N',
        debe: 0,
        haber: 0,
        rutAuxiliar: '',
        centroCosto: '',
        documentoRef: '',
        dteIdAsociado: '',
      },
      {
        cuentaCodigo: '2.1.01.001',
        cuentaNombre: 'Proveedores Nacionales (Cuentas por Pagar)',
        debe: 0,
        haber: 0,
        rutAuxiliar: '',
        centroCosto: '',
        documentoRef: '',
        dteIdAsociado: '',
      },
    ],
  });

  // Modal for Manual Entry
  const [showManualModal, setShowManualModal] = useState<boolean>(false);
  const [manualEntry, setManualEntry] = useState(getInitialManualEntry());
  const [manualEntryError, setManualEntryError] = useState<string | null>(null);
  const [isSavingManual, setIsSavingManual] = useState<boolean>(false);

  // AI Routing state
  const [rawGlosaInput, setRawGlosaInput] = useState<string>('Compra de servidores cloud en AWS para infraestructura web según factura afecta con IVA');
  const [rawMontoInput, setRawMontoInput] = useState<number>(1450000);
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [aiProposalResponse, setAiProposalResponse] = useState<{
    humanLayer: string;
    transactionalLayer: AccountingProposalResponse | null;
  } | null>(null);

  // Copy notification state
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Toast notification state
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ type, message });
    setTimeout(() => setToastMessage(null), 4500);
  };

  // Period Closing Adjustments
  const [closingAdjustments, setClosingAdjustments] = useState<PeriodClosingAdjustment[]>(() =>
    generatePeriodClosingAdjustments(indicators, company, leases)
  );
  const [editingAdjustment, setEditingAdjustment] = useState<PeriodClosingAdjustment | null>(null);

  // Formatter helper for canonical text adjustment voucher
  const getFormattedAdjustmentVoucher = (adj: PeriodClosingAdjustment): string => {
    const sumDebe = adj.asientoPropuesto.lineas.reduce((s, l) => s + (l.debe || 0), 0);
    const sumHaber = adj.asientoPropuesto.lineas.reduce((s, l) => s + (l.haber || 0), 0);
    const mockEntry: AccountingEntry = {
      id: adj.id,
      fecha: new Date().toISOString().split('T')[0],
      concepto: adj.asientoPropuesto.glosa,
      documento: `Comprobante Ajuste #${adj.id.toUpperCase()}`,
      origen: 'MANUAL',
      lineas: adj.asientoPropuesto.lineas.map(l => ({
        cuentaCodigo: l.codigo_cuenta,
        cuentaNombre: l.nombre_cuenta,
        debe: l.debe,
        haber: l.haber,
        centroCosto: l.centro_costo,
        rutAuxiliar: l.rut_auxiliar,
      })),
      totalDebe: sumDebe,
      totalHaber: sumHaber,
      balanceado: Math.abs(sumDebe - sumHaber) < 1,
      creadoEn: new Date().toISOString(),
    };
    return formatNormalizedAccountingEntry(mockEntry);
  };

  // Totals of all entries
  const totalDebe = safeEntries.reduce((s, e) => s + (e.totalDebe || 0), 0);
  const totalHaber = safeEntries.reduce((s, e) => s + (e.totalHaber || 0), 0);
  const isAllBalanced = Math.abs(totalDebe - totalHaber) < 1;

  // 8-Columns Balance computation
  const balance8Col: Balance8ColumnasReport = useMemo(() => {
    return buildOfficial8ColumnBalance(safeEntries, company, '2026-12-31', chartOfAccounts);
  }, [safeEntries, company, chartOfAccounts]);

  // Reporte de Balance Agrupado con subtotales por grupo y subgrupo (Tradicional CMF, Fiscal SII, Casa Matriz HQ, Personalizado)
  const groupedBalanceReport: GroupedBalanceReport = useMemo(() => {
    return buildGroupedBalanceReport(balance8Col, chartOfAccounts, chartGroups, balanceGroupingMode);
  }, [balance8Col, chartOfAccounts, chartGroups, balanceGroupingMode]);

  // IFRS Financial Statements
  const ifrsStatements = useMemo(() => {
    return buildIFRSFinancialStatements(balance8Col);
  }, [balance8Col]);

  // Audit items across peripheral modules
  const auditItems: OrchestratorAuditItem[] = useMemo(() => {
    return auditPeripheralModules(
      safeEntries,
      safeDtes,
      safePayrolls,
      f29,
      safeBankStatements,
      safeLeases,
      safeFixedAssets,
      safeProductionOrders,
      safeContracts,
      safeMedicalLeaves,
      safeVacations,
      safeAbsenteeism,
      safeBenefits
    );
  }, [
    safeEntries,
    safeDtes,
    safePayrolls,
    f29,
    safeBankStatements,
    safeLeases,
    safeFixedAssets,
    safeProductionOrders,
    safeContracts,
    safeMedicalLeaves,
    safeVacations,
    safeAbsenteeism,
    safeBenefits,
  ]);

  const totalInTransit = auditItems.reduce((s, i) => s + i.enTransito, 0);

  // Currency converter helper
  const convertAmount = (clpAmount: number): string => {
    if (currencyMode === 'UF') {
      const ufVal = clpAmount / (indicators.uf || 39150.50);
      return `${formatNumberCL(ufVal, 2)} UF`;
    }
    if (currencyMode === 'USD') {
      const usdVal = clpAmount / (indicators.dolar || 955.20);
      return `US$${formatNumberCL(usdVal, 2)}`;
    }
    return formatCLP(clpAmount);
  };

  const handleCopyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2500);
  };

  // Helper para despachar comprobantes contables con trazabilidad o fallback a onAddEntry
  const dispatchEntry = async (
    entry: AccountingEntry,
    context?: { agenteNombre?: string; accion?: string; modelName?: string; payloadInput?: any }
  ) => {
    // Validación estricta de ejercicio fiscal y períodos bloqueados (Art. 16 Código Tributario)
    const periodCheck = validateEntryFiscalPeriod(entry.fecha, company);
    if (!periodCheck.permitido) {
      const msg = `BLOQUEO FISCAL: ${periodCheck.motivo}. ${periodCheck.sugerencia || ''}`;
      showToast(msg, 'error');
      throw new Error(msg);
    }

    if (commitEntry) {
      try {
        await commitEntry(entry, {
          agenteNombre: context?.agenteNombre || 'AGENTE_ORQUESTADOR_SENIOR',
          accion: context?.accion || `ASIENTO_${entry.origen}`,
          modelName: context?.modelName,
          payloadInput: context?.payloadInput,
          companyConfig: company,
        });
      } catch (err: any) {
        console.error('[SeniorOrchestrator] Error al autorizar comprobante contable:', err);
        // Fallback local por seguridad si el endpoint rechaza
        try {
          await onAddEntry(entry);
        } catch {
          // Fallback no crítico
        }
        throw err;
      }
    } else {
      await onAddEntry(entry);
    }
  };

  // Handle Centralization of Peripheral Module
  const handleCentralizeModule = (modulo: OrchestratorAuditItem['modulo']) => {
    const today = new Date().toISOString().split('T')[0];

    if (modulo === 'VENTAS') {
      const salesDtes = safeDtes.filter(d => d.tipoOperacion === 'VENTA');
      const totalVentaNeto = salesDtes.reduce((s, d) => s + (d.montoNeto || 0), 0);
      const totalVentaIva = salesDtes.reduce((s, d) => s + (d.montoIva || 0), 0);
      const totalVentaTotal = salesDtes.reduce((s, d) => s + (d.montoTotal || 0), 0);

      const entry: AccountingEntry = {
        id: `centraliza-ventas-${Date.now()}`,
        fecha: today,
        concepto: `Centralización Mensual RCV Ventas (${salesDtes.length} DTEs emitidos del giro)`,
        documento: 'Resumen RCV Ventas SII Folios 33/34',
        origen: 'RCV_VENTA',
        lineas: [
          {
            cuentaCodigo: '1.1.03.001',
            cuentaNombre: 'Clientes Nacionales (Cuentas por Cobrar)',
            debe: totalVentaTotal,
            haber: 0,
          },
          {
            cuentaCodigo: '4.1.01.001',
            cuentaNombre: 'Ingresos por Ventas Afectas a IVA',
            debe: 0,
            haber: totalVentaNeto,
          },
          {
            cuentaCodigo: '2.1.03.001',
            cuentaNombre: 'IVA Débito Fiscal',
            debe: 0,
            haber: totalVentaIva,
          },
        ],
        totalDebe: totalVentaTotal,
        totalHaber: totalVentaNeto + totalVentaIva,
        balanceado: true,
        creadoEn: new Date().toISOString(),
      };
      dispatchEntry(entry, { agenteNombre: 'AGENTE_RCV', accion: 'CENTRALIZACION_RCV_VENTAS' });
    } else if (modulo === 'COMPRAS') {
      const purchaseDtes = safeDtes.filter(d => d.tipoOperacion === 'COMPRA');
      const totalCompraNeto = purchaseDtes.reduce((s, d) => s + (d.montoNeto || 0), 0);
      const totalCompraIva = purchaseDtes.reduce((s, d) => s + (d.montoIva || 0), 0);
      const totalCompraTotal = purchaseDtes.reduce((s, d) => s + (d.montoTotal || 0), 0);

      const entry: AccountingEntry = {
        id: `centraliza-compras-${Date.now()}`,
        fecha: today,
        concepto: `Centralización Mensual RCV Compras Proveedores (${purchaseDtes.length} Facturas)`,
        documento: 'Registro RCV Compras SII',
        origen: 'RCV_COMPRA',
        lineas: [
          {
            cuentaCodigo: '5.1.01.001',
            cuentaNombre: 'Costo de Ventas Mercaderías',
            debe: totalCompraNeto,
            haber: 0,
          },
          {
            cuentaCodigo: '1.1.04.001',
            cuentaNombre: 'IVA Crédito Fiscal (DL 825)',
            debe: totalCompraIva,
            haber: 0,
          },
          {
            cuentaCodigo: '2.1.01.001',
            cuentaNombre: 'Proveedores Nacionales (Cuentas por Pagar)',
            debe: 0,
            haber: totalCompraTotal,
          },
        ],
        totalDebe: totalCompraNeto + totalCompraIva,
        totalHaber: totalCompraTotal,
        balanceado: true,
        creadoEn: new Date().toISOString(),
      };
      dispatchEntry(entry, { agenteNombre: 'AGENTE_RCV', accion: 'CENTRALIZACION_RCV_COMPRAS' });
    } else if (modulo === 'RRHH') {
      const totalSueldoLiquido = safePayrolls.reduce((s, p) => s + p.sueldoLiquido, 0);
      const totalImposiciones = safePayrolls.reduce((s, p) => s + p.totalDescuentosLegales, 0);
      const totalAportePatronal = safePayrolls.reduce(
        (s, p) => s + p.sisEmpleadorMonto + p.mutualEmpleadorMonto + p.afcEmpleadorMonto,
        0
      );
      const totalCostoEmpresa = safePayrolls.reduce((s, p) => s + p.costoTotalEmpresa, 0);

      const entry: AccountingEntry = {
        id: `centraliza-rrhh-${Date.now()}`,
        fecha: today,
        concepto: `Centralización Mensual Libro de Remuneraciones (${payrolls.length} colaboradores)`,
        documento: 'Nómina DT & Previred Centralizada',
        origen: 'REMUNERACIONES',
        lineas: [
          {
            cuentaCodigo: '6.1.01.001',
            cuentaNombre: 'Sueldos y Remuneraciones Base Personal',
            debe: totalCostoEmpresa - totalAportePatronal,
            haber: 0,
          },
          {
            cuentaCodigo: '6.1.01.004',
            cuentaNombre: 'Aportes Patronales (SIS, Mutual, AFC Empleador)',
            debe: totalAportePatronal,
            haber: 0,
          },
          {
            cuentaCodigo: '2.1.02.001',
            cuentaNombre: 'Sueldos Líquidos por Pagar',
            debe: 0,
            haber: totalSueldoLiquido,
          },
          {
            cuentaCodigo: '2.1.02.002',
            cuentaNombre: 'Instituciones Previsionales (AFP) por Pagar (Previred)',
            debe: 0,
            haber: totalImposiciones + totalAportePatronal,
          },
        ],
        totalDebe: totalCostoEmpresa,
        totalHaber: totalSueldoLiquido + totalImposiciones + totalAportePatronal,
        balanceado: true,
        creadoEn: new Date().toISOString(),
      };
      dispatchEntry(entry, { agenteNombre: 'AGENTE_RRHH', accion: 'CENTRALIZACION_REMUNERACIONES' });
    } else if (modulo === 'F29') {
      const debito = f29.debitoFiscalIva || 0;
      const credito = f29.creditoFiscalIva || 0;
      const retencion = f29.retencionHonorariosSegundaCat || 0;
      const impuestoUnico = f29.retencionImpuestoUnicoSueldos || 0;
      const ppm = f29.montoPpm || 0;
      const totalPagar = f29.totalAPagar || 0;

      const entry: AccountingEntry = {
        id: `centraliza-f29-${Date.now()}`,
        fecha: today,
        concepto: 'Liquidación Mensual de Impuestos F29 (IVA, PPM y Retenciones TGR)',
        documento: 'Declaración F29 SII Folio 889210',
        origen: 'F29_TRIBUTARIO',
        lineas: [
          {
            cuentaCodigo: '2.1.03.001',
            cuentaNombre: 'IVA Débito Fiscal',
            debe: debito,
            haber: 0,
          },
          {
            cuentaCodigo: '1.1.04.003',
            cuentaNombre: 'PPM por Recuperar (Art. 84 LIR)',
            debe: ppm,
            haber: 0,
          },
          {
            cuentaCodigo: '1.1.04.001',
            cuentaNombre: 'IVA Crédito Fiscal (DL 825)',
            debe: 0,
            haber: Math.min(debito, credito),
          },
          {
            cuentaCodigo: '2.1.03.002',
            cuentaNombre: 'Retención Honorarios 2da Categoría por Pagar (F29)',
            debe: retencion,
            haber: 0,
          },
          {
            cuentaCodigo: '2.1.03.003',
            cuentaNombre: 'Impuesto Único de Segunda Categoría por Pagar (F29)',
            debe: impuestoUnico,
            haber: 0,
          },
          {
            cuentaCodigo: '2.1.03.005',
            cuentaNombre: 'Impuestos Mensuales F29 por Pagar (TGR)',
            debe: 0,
            haber: totalPagar,
          },
        ],
        totalDebe: debito + ppm + retencion + impuestoUnico,
        totalHaber: Math.min(debito, credito) + totalPagar,
        balanceado: true,
        creadoEn: new Date().toISOString(),
      };
      dispatchEntry(entry, { agenteNombre: 'AGENTE_F29', accion: 'LIQUIDACION_F29_TRIBUTARIO' });
    } else if (modulo === 'ACTIVO_FIJO') {
      const totalDepreciacion = safeFixedAssets.reduce((s, a) => s + (a.depreciacionAcumulada || 185000), 0);
      const entry: AccountingEntry = {
        id: `centraliza-activo-fijo-${Date.now()}`,
        fecha: today,
        concepto: `Centralización Depreciación Lineal y Corrección Monetaria Activo Fijo (${safeFixedAssets.length} bienes NIC 16 / Art. 41 LIR)`,
        documento: 'Cuadro de Activo Fijo Tributario y Financiero',
        origen: 'ACTIVO_FIJO',
        lineas: [
          {
            cuentaCodigo: '6.1.05.001',
            cuentaNombre: 'Gasto por Depreciación del Ejercicio (NIC 16)',
            debe: totalDepreciacion,
            haber: 0,
            centroCosto: 'ADMINISTRACION',
          },
          {
            cuentaCodigo: '1.2.02.001',
            cuentaNombre: 'Depreciación Acumulada Activo Fijo',
            debe: 0,
            haber: totalDepreciacion,
          },
        ],
        totalDebe: totalDepreciacion,
        totalHaber: totalDepreciacion,
        balanceado: true,
        creadoEn: new Date().toISOString(),
      };
      dispatchEntry(entry, { agenteNombre: 'AGENTE_ACTIVO_FIJO', accion: 'CENTRALIZACION_DEPRECIACION_NIC16' });
    } else if (modulo === 'PRODUCCION') {
      const totalCostoOP = safeProductionOrders.reduce((s, op) => s + (op.costoTotalReal || 850000), 0);
      const entry: AccountingEntry = {
        id: `centraliza-produccion-${Date.now()}`,
        fecha: today,
        concepto: `Cierre y Activación de Órdenes de Fabricación (${safeProductionOrders.length} OPs finalizadas)`,
        documento: 'Hoja de Costos de Producción NIC 2',
        origen: 'PRODUCCION',
        lineas: [
          {
            cuentaCodigo: '1.1.05.002',
            cuentaNombre: 'Inventario de Productos Terminados',
            debe: totalCostoOP,
            haber: 0,
          },
          {
            cuentaCodigo: '1.1.05.003',
            cuentaNombre: 'Trabajos y Productos en Proceso (Costos Directos e Indirectos)',
            debe: 0,
            haber: totalCostoOP,
          },
        ],
        totalDebe: totalCostoOP,
        totalHaber: totalCostoOP,
        balanceado: true,
        creadoEn: new Date().toISOString(),
      };
      dispatchEntry(entry, { agenteNombre: 'AGENTE_PRODUCCION', accion: 'CENTRALIZACION_COSTO_FABRICACION' });
    } else if (modulo === 'RRHH_PERSONAS') {
      const provVacaciones = safeVacations.reduce((s, v) => s + (v.diasDisponibles * 45000), 0);
      const entry: AccountingEntry = {
        id: `centraliza-provision-vacaciones-${Date.now()}`,
        fecha: today,
        concepto: `Provisión Legal de Feriado y Vacaciones Acumuladas Art. 67/73 Código del Trabajo`,
        documento: 'Control de Feriados y Nómina DT',
        origen: 'REMUNERACIONES',
        lineas: [
          {
            cuentaCodigo: '6.1.01.003',
            cuentaNombre: 'Gasto por Provisión de Vacaciones Legales',
            debe: provVacaciones,
            haber: 0,
          },
          {
            cuentaCodigo: '2.1.02.003',
            cuentaNombre: 'Provisión Feriado Proporcional y Vacaciones por Pagar',
            debe: 0,
            haber: provVacaciones,
          },
        ],
        totalDebe: provVacaciones,
        totalHaber: provVacaciones,
        balanceado: true,
        creadoEn: new Date().toISOString(),
      };
      dispatchEntry(entry, { agenteNombre: 'AGENTE_RRHH', accion: 'PROVISION_VACACIONES_ART67' });
    }
  };

  // Handle Apply Period Closing Adjustment
  const handleApplyAdjustment = (adj: PeriodClosingAdjustment) => {
    const today = new Date().toISOString().split('T')[0];
    const sumDebe = adj.asientoPropuesto.lineas.reduce((s, l) => s + l.debe, 0);
    const sumHaber = adj.asientoPropuesto.lineas.reduce((s, l) => s + l.haber, 0);

    const entry: AccountingEntry = {
      id: `adj-entry-${Date.now()}`,
      fecha: today,
      concepto: adj.asientoPropuesto.glosa,
      documento: `Comprobante Ajuste Cierre #${adj.id.toUpperCase()}`,
      origen: 'MANUAL',
      lineas: adj.asientoPropuesto.lineas.map(l => ({
        cuentaCodigo: l.codigo_cuenta,
        cuentaNombre: l.nombre_cuenta,
        debe: l.debe,
        haber: l.haber,
        centroCosto: l.centro_costo,
        rutAuxiliar: l.rut_auxiliar,
      })),
      totalDebe: sumDebe,
      totalHaber: sumHaber,
      balanceado: Math.abs(sumDebe - sumHaber) < 1,
      creadoEn: new Date().toISOString(),
    };

    dispatchEntry(entry, {
      agenteNombre: 'AGENTE_ORQUESTADOR_SENIOR',
      accion: `AJUSTE_CIERRE_${adj.id}`,
    });
    setClosingAdjustments(prev =>
      prev.map(a => (a.id === adj.id ? { ...a, aplicado: true } : a))
    );
    showToast(`Ajuste "${adj.titulo}" asentado y cuadrado con éxito en el Libro Diario.`, 'success');
  };

  // Handle AI Routing Simulation
  const handleSimulateAiRouting = async () => {
    if (!rawGlosaInput.trim()) {
      showToast('Por favor ingrese la descripción o glosa de la operación económica.', 'info');
      return;
    }
    if (!rawMontoInput || rawMontoInput <= 0) {
      showToast('Debe ingresar el monto real en dinero ($ CLP) de la transacción para formular la imputación contable.', 'info');
      return;
    }
    setIsAiLoading(true);

    try {
      const response = await fetch('/api/accounting/senior-orchestrator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresa: company,
          query: rawGlosaInput,
          mode: 'route_glosa',
          rawGlosa: rawGlosaInput,
          monto: rawMontoInput,
          indicators,
        }),
      });

      const resJson = await response.json();
      const aiText = resJson.text || '';

      // Extract JSON if present
      let extractedJSON: AccountingProposalResponse | null = null;
      try {
        const match = aiText.match(/```json\s*([\s\S]*?)\s*```/);
        if (match && match[1]) {
          extractedJSON = JSON.parse(match[1]);
        }
      } catch (err) {
        console.warn('Failed to parse AI JSON:', err);
      }

      // Fallback deterministic if no JSON extracted
      if (!extractedJSON) {
        const isCompra = rawGlosaInput.toLowerCase().includes('compra') || rawGlosaInput.toLowerCase().includes('proveedor') || rawGlosaInput.toLowerCase().includes('pago');
        const isVenta = rawGlosaInput.toLowerCase().includes('venta') || rawGlosaInput.toLowerCase().includes('cliente') || rawGlosaInput.toLowerCase().includes('factura emitida');
        const iva = Math.round(rawMontoInput * 0.19);
        const neto = rawMontoInput;
        const total = neto + iva;

        // Clasificación inteligente según texto de glosa real
        let cuentaCod = '6.1.04.006';
        let cuentaNom = 'Gastos Operacionales Generales';
        const lowerGlosa = rawGlosaInput.toLowerCase();
        if (lowerGlosa.includes('software') || lowerGlosa.includes('licencia') || lowerGlosa.includes('cloud') || lowerGlosa.includes('servidor')) {
          cuentaCod = '6.1.04.002';
          cuentaNom = 'Software, Servidores Cloud y Licencias';
        } else if (lowerGlosa.includes('arriendo') || lowerGlosa.includes('alquiler')) {
          cuentaCod = '6.1.04.001';
          cuentaNom = 'Arriendos de Inmuebles y Oficinas';
        } else if (lowerGlosa.includes('honorario') || lowerGlosa.includes('asesor')) {
          cuentaCod = '6.1.03.001';
          cuentaNom = 'Honorarios Profesionales de Terceros';
        } else if (lowerGlosa.includes('impresora') || lowerGlosa.includes('computador') || lowerGlosa.includes('equipo')) {
          cuentaCod = '1.2.01.004';
          cuentaNom = 'Equipos Computacionales y Servidores';
        } else if (lowerGlosa.includes('papel') || lowerGlosa.includes('tinta') || lowerGlosa.includes('utiles')) {
          cuentaCod = '6.1.04.006';
          cuentaNom = 'Útiles de Oficina, Papelería y Suministros Menores';
        }

        extractedJSON = {
          empresa_id: company.rut || '77.798.901-4',
          accion: 'propuesta_asiento',
          origen_modulo: isVenta ? 'VENTAS' : (isCompra ? 'COMPRAS' : 'MANUAL'),
          periodo: new Date().toISOString().substring(0, 7),
          asiento: {
            fecha: new Date().toISOString().split('T')[0],
            tipo_comprobante: isVenta ? 'INGRESO' : (isCompra ? 'EGRESO' : 'TRASPASO'),
            glosa_general: rawGlosaInput,
            cuadre_valido: true,
            total_debe: total,
            total_haber: total,
            lineas: [
              {
                codigo_cuenta: cuentaCod,
                nombre_cuenta: cuentaNom,
                debe: neto,
                haber: 0,
                centro_costo: 'ADMINISTRACION',
              },
              {
                codigo_cuenta: '1.1.04.001',
                nombre_cuenta: 'IVA Crédito Fiscal (DL 825)',
                debe: iva,
                haber: 0,
              },
              {
                codigo_cuenta: '2.1.01.001',
                nombre_cuenta: 'Proveedores Nacionales (Cuentas por Pagar)',
                debe: 0,
                haber: total,
                rut_auxiliar: company.rut || 'Pendiente de RUT Auxiliar',
              },
            ],
          },
          alertas_auditoria: [
            'Asiento formulado con montos reales suministrados: IVA Crédito Fiscal sujeto a respaldo de DTE en RCV según Art. 23 DL 825.',
          ],
        };
      }

      setAiProposalResponse({
        humanLayer: aiText.replace(/```json[\s\S]*?```/, '').trim() ||
          `Como Agente Orquestador Contable y Financiero Senior, he determinado la imputación para "${rawGlosaInput}". Se clasificó el gasto operacional con crédito fiscal IVA afecto y pasivo en Proveedores Nacionales con centro de costo.`,
        transactionalLayer: extractedJSON,
      });
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Handle Commit Proposal from AI to Ledger
  const handleCommitAiProposal = () => {
    if (!aiProposalResponse?.transactionalLayer?.asiento) return;
    const a = aiProposalResponse.transactionalLayer.asiento;

    const entry: AccountingEntry = {
      id: `entry-ai-${Date.now()}`,
      fecha: a.fecha,
      concepto: a.glosa_general,
      documento: 'Comprobante Propuesta IA Autorizada',
      origen: (aiProposalResponse.transactionalLayer.origen_modulo as any) || 'MANUAL',
      lineas: a.lineas.map(l => ({
        cuentaCodigo: l.codigo_cuenta,
        cuentaNombre: l.nombre_cuenta,
        debe: l.debe,
        haber: l.haber,
      })),
      totalDebe: a.total_debe,
      totalHaber: a.total_haber,
      balanceado: a.cuadre_valido,
      creadoEn: new Date().toISOString(),
    };

    dispatchEntry(entry, {
      agenteNombre: 'AGENTE_SUPERVISOR_AI',
      accion: 'IMPUTACION_ASIENTO_INTELIGENTE',
      modelName: 'gemini-3.8-flash',
      payloadInput: { glosa: rawGlosaInput },
    });
    showToast('Asiento contable imputado y sincronizado con éxito en el Libro Diario.', 'success');
  };

  // Manejadores del Plan de Cuentas Personalizado por Empresa
  const handleOpenCreateAccountModal = () => {
    setAccountToEdit(null);
    setSubaccountParentCode(undefined);
    setAccountModalOpen(true);
  };

  const handleOpenEditAccountModal = (acc: HierarchicalAccountItem) => {
    setAccountToEdit(acc);
    setSubaccountParentCode(undefined);
    setAccountModalOpen(true);
  };

  const handleOpenSubaccountModal = (parentAcc: HierarchicalAccountItem) => {
    setAccountToEdit(null);
    setSubaccountParentCode(parentAcc.codigo);
    setAccountModalOpen(true);
  };

  // Guardar (crear o editar) cuenta contable
  const handleSaveAccount = (account: HierarchicalAccountItem) => {
    const existingIndex = chartOfAccounts.findIndex((a) => a.codigo === account.codigo);
    let updated: HierarchicalAccountItem[];
    if (existingIndex >= 0) {
      updated = [...chartOfAccounts];
      updated[existingIndex] = account;
      showToast(`Cuenta "${account.codigo} - ${account.nombre}" actualizada con éxito.`, 'success');
    } else {
      updated = [...chartOfAccounts, account];
      showToast(`Cuenta "${account.codigo} - ${account.nombre}" creada y agregada al plan.`, 'success');
    }
    setChartOfAccounts(updated);
    saveCompanyChartOfAccounts(company.rut, updated);
  };

  // Eliminar cuenta contable con validación de asientos
  const handleDeleteAccount = (acc: HierarchicalAccountItem) => {
    const entriesWithAccount = entries.filter((e) =>
      e.lineas.some((l) => l.cuentaCodigo === acc.codigo)
    );
    if (entriesWithAccount.length > 0) {
      alert(
        `No se puede eliminar la cuenta ${acc.codigo} porque registra ${entriesWithAccount.length} movimiento(s) en el Libro Diario. Debe reclasificar o anular dichos asientos antes de eliminarla.`
      );
      return;
    }

    if (confirm(`¿Confirma que desea eliminar permanentemente la cuenta contable "${acc.codigo} - ${acc.nombre}" del plan de la empresa?`)) {
      const updated = chartOfAccounts.filter((a) => a.codigo !== acc.codigo);
      setChartOfAccounts(updated);
      saveCompanyChartOfAccounts(company.rut, updated);
      showToast(`Cuenta "${acc.codigo}" eliminada del plan de cuentas.`, 'info');
    }
  };

  // Guardar cambios en Grupos y Subgrupos
  const handleSaveGroups = (updatedGroups: AccountGroupDefinition[]) => {
    setChartGroups(updatedGroups);
    saveCompanyGroups(company.rut, updatedGroups);

    // Sincronizar nombres de grupo y subgrupo en las cuentas existentes
    const grpMap = new Map(updatedGroups.map((g) => [g.codigo, g.nombre]));
    const updatedAccounts = chartOfAccounts.map((a) => {
      const gName = grpMap.get(a.grupo) || a.nombreGrupo;
      const sName = grpMap.get(a.subgrupo) || a.nombreSubgrupo;
      return { ...a, nombreGrupo: gName, nombreSubgrupo: sName };
    });
    setChartOfAccounts(updatedAccounts);
    saveCompanyChartOfAccounts(company.rut, updatedAccounts);
    showToast('Estructura de grupos y subgrupos actualizada y sincronizada.', 'success');
  };

  // Restaurar al estándar CMF
  const handleResetChartToDefault = () => {
    if (confirm(`¿Desea restaurar el plan de cuentas de "${company.razonSocial}" al catálogo base oficial chileno (CMF / SII)? Esta acción sobreescribirá personalizaciones.`)) {
      const def = resetCompanyChartToDefault(company.rut);
      setChartOfAccounts(def);
      const defGroups = loadCompanyGroups(company.rut);
      setChartGroups(defGroups);
      showToast('Plan de cuentas restaurado al catálogo estándar chileno.', 'success');
    }
  };

  // Importar plan desde archivo o JSON
  const handleImportChart = (imported: HierarchicalAccountItem[]) => {
    setChartOfAccounts(imported);
    saveCompanyChartOfAccounts(company.rut, imported);
    showToast(`Plan de cuentas importado (${imported.length} cuentas cargadas).`, 'success');
  };

  // Filtered Chart of Accounts
  const filteredPlan = useMemo(() => {
    return chartOfAccounts.filter(acc => {
      const matchClass = planClassFilter === 'TODOS' || acc.clase === planClassFilter;
      const matchSearch =
        acc.nombre.toLowerCase().includes(planSearchTerm.toLowerCase()) ||
        acc.codigo.toLowerCase().includes(planSearchTerm.toLowerCase());

      let matchAttr = true;
      if (planAttributeFilter === 'MULTIMONEDA') matchAttr = Boolean(acc.manejaMultimoneda);
      else if (planAttributeFilter === 'DOC_REF') matchAttr = Boolean(acc.requiereDocReferencia);
      else if (planAttributeFilter === 'EFECTIVO') matchAttr = Boolean(acc.esEfectivoEquivalente);
      else if (planAttributeFilter === 'CONTRACUENTA') matchAttr = Boolean(acc.esContracuentaEfectivo);
      else if (planAttributeFilter === 'PROYECTO') matchAttr = Boolean(acc.requiereProyecto);
      else if (planAttributeFilter === 'AUXILIAR') matchAttr = Boolean(acc.requiereAuxiliarRut);
      else if (planAttributeFilter === 'CENTRO_COSTO') matchAttr = Boolean(acc.requiereCentroCosto);
      else if (planAttributeFilter === 'CONCILIABLE') matchAttr = Boolean(acc.esConciliableBancaria);

      return matchClass && matchSearch && matchAttr;
    });
  }, [chartOfAccounts, planClassFilter, planSearchTerm, planAttributeFilter]);

  // Filtered Entries for Diario
  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      const matchSource = sourceFilter === 'TODOS' || e.origen === sourceFilter;
      const matchSearch =
        e.concepto.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.documento.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.lineas.some(l => l.cuentaNombre.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchSource && matchSearch;
    });
  }, [entries, sourceFilter, searchTerm]);

  // Mayor account details
  const mayorAccountMovements = useMemo(() => {
    const list: Array<{
      fecha: string;
      asientoId: string;
      concepto: string;
      documento: string;
      debe: number;
      haber: number;
      saldoAcumulado: number;
      rutAuxiliar?: string;
      centroCosto?: string;
      documentoRef?: string;
    }> = [];

    let runningBalance = 0;
    const selectedAcc = findAccountInChart(selectedMayorAccountCode);
    const isDeudora = selectedAcc?.naturaleza === 'DEUDORA';

    safeEntries.forEach(entry => {
      entry.lineas.forEach(line => {
        if (line.cuentaCodigo === selectedMayorAccountCode) {
          if (isDeudora) {
            runningBalance += (line.debe || 0) - (line.haber || 0);
          } else {
            runningBalance += (line.haber || 0) - (line.debe || 0);
          }

          list.push({
            fecha: entry.fecha,
            asientoId: entry.id,
            concepto: entry.concepto,
            documento: line.documentoRef || entry.documento,
            debe: line.debe,
            haber: line.haber,
            saldoAcumulado: runningBalance,
            rutAuxiliar: line.rutAuxiliar,
            centroCosto: line.centroCosto,
            documentoRef: line.documentoRef,
          });
        }
      });
    });

    return list;
  }, [safeEntries, selectedMayorAccountCode]);

  // Auxiliar & Cost Center Detection Helpers
  const isAccountAuxiliarRequired = (code: string, name: string): boolean => {
    const acc = findAccountInChart(code) || findAccountInChart(name);
    if (acc?.requiereAuxiliarRut) return true;
    if (
      code.startsWith('1.1.03') ||
      code.startsWith('2.1.01') ||
      code.startsWith('2.1.02') ||
      code.startsWith('1.1.09') ||
      code.startsWith('2.1.05')
    ) {
      return true;
    }
    return /auxiliar|proveedor|cliente|honorarios por pagar|cuentas por cobrar|cuentas por pagar/i.test(name);
  };

  const isAccountCostCenterRequired = (code: string, name: string): boolean => {
    if (code.startsWith('4.') || code.startsWith('5.')) return true;
    return /costo|gasto|remuneraci|servicios|arriendo|honorario|operaci|fabricaci|mantenimiento/i.test(name);
  };

  // Memoized directory of all auxiliaries (from Master Padron and DTEs)
  const availableAuxiliaries = useMemo(() => {
    const map = new Map<string, { rut: string; razonSocial: string; tipo: 'PROVEEDOR' | 'CLIENTE' | 'AMBOS' }>();

    INITIAL_CLIENT_AUXILIARIES.forEach(aux => {
      map.set(aux.rutCompleto.trim().toUpperCase(), {
        rut: aux.rutCompleto.trim(),
        razonSocial: aux.razonSocial,
        tipo: (aux.tipoAuxiliar === 'PROVEEDOR' ? 'PROVEEDOR' : aux.tipoAuxiliar === 'CLIENTE' ? 'CLIENTE' : 'AMBOS') as any,
      });
    });

    safeDtes.forEach(d => {
      if (d.rutContraparte) {
        const norm = d.rutContraparte.trim().toUpperCase();
        const existing = map.get(norm);
        const tipo = d.tipoOperacion === 'COMPRA' ? 'PROVEEDOR' : 'CLIENTE';
        if (existing) {
          if (existing.tipo !== tipo) existing.tipo = 'AMBOS';
        } else {
          map.set(norm, {
            rut: d.rutContraparte.trim(),
            razonSocial: d.razonSocialContraparte || d.rutContraparte,
            tipo,
          });
        }
      }
    });

    return Array.from(map.values());
  }, [safeDtes]);

  // Helper de normalización de RUT para cruces seguros
  const normRut = (r?: string | null) => (r || '').replace(/[\.\-\s]/g, '').toUpperCase();

  // Libro Mayor Auxiliar de Proveedores (Pasivos / Cuentas por Pagar 2.1.01)
  const auxiliarSuppliersSummary = useMemo(() => {
    const supplierRuts = new Set<string>();
    safeDtes.filter(d => d.tipoOperacion === 'COMPRA').forEach(d => {
      if (d.rutContraparte) supplierRuts.add(normRut(d.rutContraparte));
    });
    availableAuxiliaries.filter(a => a.tipo === 'PROVEEDOR' || a.tipo === 'AMBOS').forEach(a => {
      supplierRuts.add(normRut(a.rut));
    });
    safeEntries.forEach(e => {
      e.lineas.forEach(l => {
        if ((l.cuentaCodigo.startsWith('2.1.01') || l.cuentaCodigo.startsWith('2.1.02')) && l.rutAuxiliar) {
          supplierRuts.add(normRut(l.rutAuxiliar));
        }
      });
    });

    const result = Array.from(supplierRuts).map(rutKey => {
      const matchedAux = availableAuxiliaries.find(a => normRut(a.rut) === rutKey);
      const supplierDtes = safeDtes.filter(d => d.tipoOperacion === 'COMPRA' && normRut(d.rutContraparte) === rutKey);
      const sampleDte = supplierDtes[0];
      const rutDisplay = matchedAux?.rut || sampleDte?.rutContraparte || rutKey;
      const razonSocial = matchedAux?.razonSocial || sampleDte?.razonSocialContraparte || `Proveedor RUT ${rutDisplay}`;

      const totalDtesMonto = supplierDtes.reduce((s, d) => s + (d.montoTotal || 0), 0);
      const totalDtesPagados = supplierDtes.filter(d => d.estadoPago === 'PAGADO').reduce((s, d) => s + (d.montoTotal || 0), 0);

      let journalCreditos = 0;
      let journalDebitos = 0;
      const journalMovements: Array<{
        fecha: string;
        asientoId: string;
        concepto: string;
        documento: string;
        debe: number;
        haber: number;
      }> = [];

      safeEntries.forEach(entry => {
        entry.lineas.forEach(line => {
          if ((line.cuentaCodigo.startsWith('2.1.01') || line.cuentaCodigo.startsWith('2.1.02')) && normRut(line.rutAuxiliar) === rutKey) {
            journalDebitos += line.debe || 0;
            journalCreditos += line.haber || 0;
            journalMovements.push({
              fecha: entry.fecha,
              asientoId: entry.id,
              concepto: entry.concepto,
              documento: line.documentoRef || entry.documento,
              debe: line.debe,
              haber: line.haber,
            });
          }
        });
      });

      const facturacionTotal = Math.max(totalDtesMonto, journalCreditos);
      const pagosTotales = journalDebitos > 0 ? journalDebitos : totalDtesPagados;
      const saldoPendiente = Math.max(0, facturacionTotal - pagosTotales);

      return {
        rut: rutDisplay,
        razonSocial,
        totalFacturado: facturacionTotal,
        totalPagado: pagosTotales,
        saldoPendiente,
        dtes: supplierDtes,
        journalMovements,
      };
    });

    return result.sort((a, b) => b.saldoPendiente - a.saldoPendiente);
  }, [safeDtes, availableAuxiliaries, safeEntries]);

  // Libro Mayor Auxiliar de Clientes (Activos / Cuentas por Cobrar 1.1.03)
  const auxiliarClientsSummary = useMemo(() => {
    const clientRuts = new Set<string>();
    safeDtes.filter(d => d.tipoOperacion === 'VENTA').forEach(d => {
      if (d.rutContraparte) clientRuts.add(normRut(d.rutContraparte));
    });
    availableAuxiliaries.filter(a => a.tipo === 'CLIENTE' || a.tipo === 'AMBOS').forEach(a => {
      clientRuts.add(normRut(a.rut));
    });
    safeEntries.forEach(e => {
      e.lineas.forEach(l => {
        if (l.cuentaCodigo.startsWith('1.1.03') && l.rutAuxiliar) {
          clientRuts.add(normRut(l.rutAuxiliar));
        }
      });
    });

    const result = Array.from(clientRuts).map(rutKey => {
      const matchedAux = availableAuxiliaries.find(a => normRut(a.rut) === rutKey);
      const clientDtes = safeDtes.filter(d => d.tipoOperacion === 'VENTA' && normRut(d.rutContraparte) === rutKey);
      const sampleDte = clientDtes[0];
      const rutDisplay = matchedAux?.rut || sampleDte?.rutContraparte || rutKey;
      const razonSocial = matchedAux?.razonSocial || sampleDte?.razonSocialContraparte || `Cliente RUT ${rutDisplay}`;

      const totalDtesMonto = clientDtes.reduce((s, d) => s + (d.montoTotal || 0), 0);
      const totalDtesCobrados = clientDtes.filter(d => d.estadoPago === 'COBRADO' || d.estadoPago === 'PAGADO').reduce((s, d) => s + (d.montoTotal || 0), 0);

      let journalDebitos = 0;
      let journalCreditos = 0;
      const journalMovements: Array<{
        fecha: string;
        asientoId: string;
        concepto: string;
        documento: string;
        debe: number;
        haber: number;
      }> = [];

      safeEntries.forEach(entry => {
        entry.lineas.forEach(line => {
          if (line.cuentaCodigo.startsWith('1.1.03') && normRut(line.rutAuxiliar) === rutKey) {
            journalDebitos += line.debe || 0;
            journalCreditos += line.haber || 0;
            journalMovements.push({
              fecha: entry.fecha,
              asientoId: entry.id,
              concepto: entry.concepto,
              documento: line.documentoRef || entry.documento,
              debe: line.debe,
              haber: line.haber,
            });
          }
        });
      });

      const facturacionTotal = Math.max(totalDtesMonto, journalDebitos);
      const cobrosTotales = journalCreditos > 0 ? journalCreditos : totalDtesCobrados;
      const saldoPorCobrar = Math.max(0, facturacionTotal - cobrosTotales);

      return {
        rut: rutDisplay,
        razonSocial,
        totalFacturado: facturacionTotal,
        totalCobrado: cobrosTotales,
        saldoPorCobrar,
        dtes: clientDtes,
        journalMovements,
      };
    });

    return result.sort((a, b) => b.saldoPorCobrar - a.saldoPorCobrar);
  }, [safeDtes, availableAuxiliaries, safeEntries]);

  // Manual Entry Form Line Handlers
  const handleAddManualLine = () => {
    setManualEntry(prev => ({
      ...prev,
      lineas: [
        ...prev.lineas,
        {
          cuentaCodigo: '1.1.01.001',
          cuentaNombre: 'Caja Central Moneda Nacional',
          debe: 0,
          haber: 0,
          rutAuxiliar: '',
          centroCosto: '',
          documentoRef: '',
          dteIdAsociado: '',
        },
      ],
    }));
    setManualEntryError(null);
  };

  const handleUpdateManualAccount = (index: number, account: HierarchicalAccountItem) => {
    const updated = [...manualEntry.lineas];
    const isCc = isAccountCostCenterRequired(account.codigo, account.nombre);
    updated[index] = {
      ...updated[index],
      cuentaNombre: account.nombre,
      cuentaCodigo: account.codigo,
      centroCosto: isCc && !updated[index].centroCosto ? 'CC-ADM-01' : updated[index].centroCosto,
    };
    setManualEntry(prev => ({ ...prev, lineas: updated }));
    setManualEntryError(null);
  };

  const handleUpdateManualLine = (index: number, field: keyof AccountingEntryLine, value: any) => {
    const updated = [...manualEntry.lineas];
    if (field === 'cuentaNombre') {
      const found = findAccountInChart(value);
      updated[index] = {
        ...updated[index],
        cuentaNombre: value,
        cuentaCodigo: found?.codigo || updated[index].cuentaCodigo || '9.9.99.999',
      };
    } else if (field === 'debe' || field === 'haber') {
      updated[index] = { ...updated[index], [field]: Number(value) || 0 };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setManualEntry(prev => ({ ...prev, lineas: updated }));
    setManualEntryError(null);
  };

  const handleRemoveManualLine = (index: number) => {
    if (manualEntry.lineas.length <= 2) return;
    setManualEntry(prev => ({
      ...prev,
      lineas: prev.lineas.filter((_, i) => i !== index),
    }));
    setManualEntryError(null);
  };

  const handleAutoBalanceCentavos = () => {
    const res = validateAndBalanceEntry(manualEntry.lineas);
    if (res.lineasCorregidas) {
      setManualEntry(prev => ({ ...prev, lineas: res.lineasCorregidas }));
      setManualEntryError(null);
    }
  };

  const handleSaveManualEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setManualEntryError(null);

    if (!manualEntry.concepto.trim()) {
      setManualEntryError('La glosa o concepto descriptivo del asiento es obligatoria.');
      return;
    }

    if (manualEntry.lineas.length < 2) {
      setManualEntryError('Un asiento contable requiere al menos 2 cuentas para cumplir con la partida doble.');
      return;
    }

    const manualDebe = manualEntry.lineas.reduce((s, l) => s + (Number(l.debe) || 0), 0);
    const manualHaber = manualEntry.lineas.reduce((s, l) => s + (Number(l.haber) || 0), 0);

    if (manualDebe <= 0 && manualHaber <= 0) {
      setManualEntryError('Debe ingresar montos mayores a cero en las partidas del asiento (Debe o Haber).');
      return;
    }

    const diff = Math.abs(manualDebe - manualHaber);
    if (diff >= 1) {
      setManualEntryError(
        `El asiento no cumple con la partida doble: Debe ($${formatCLP(manualDebe)}) vs Haber ($${formatCLP(manualHaber)}). Descuadre de $${formatCLP(diff)}. Ajuste los montos antes de guardar.`
      );
      return;
    }

    // Validación rigurosa de Auxiliares y Centros de Costos según normativa SII / IFRS
    for (let i = 0; i < manualEntry.lineas.length; i++) {
      const l = manualEntry.lineas[i];
      if (isAccountAuxiliarRequired(l.cuentaCodigo, l.cuentaNombre)) {
        if (!l.rutAuxiliar || !l.rutAuxiliar.trim()) {
          setManualEntryError(
            `La cuenta "${l.cuentaCodigo} - ${l.cuentaNombre}" (Línea #${i + 1}) exige especificar el Auxiliar (RUT y Comprobante de respaldo a cancelar). Por favor seleccione el auxiliar correspondiente.`
          );
          return;
        }
      }
      if (isAccountCostCenterRequired(l.cuentaCodigo, l.cuentaNombre)) {
        if (!l.centroCosto || !l.centroCosto.trim()) {
          setManualEntryError(
            `La cuenta de resultado "${l.cuentaCodigo} - ${l.cuentaNombre}" (Línea #${i + 1}) exige asignación de Centro de Costos. Por favor seleccione el Centro de Costos antes de guardar.`
          );
          return;
        }
      }
    }

    setIsSavingManual(true);
    try {
      const normalized = normalizeAndValidateJournalEntry({
        fecha: manualEntry.fecha,
        glosaGeneral: manualEntry.concepto,
        documentoRef: manualEntry.documentoReferencia || 'Comprobante Diario Interno',
        origenModulo: manualEntry.origen,
        creadoPorAgente: 'OPERADOR_MANUAL',
        lineas: manualEntry.lineas.map(l => ({
          codigoCuenta: l.cuentaCodigo,
          nombreCuenta: l.cuentaNombre,
          debe: l.debe,
          haber: l.haber,
          rutAuxiliar: l.rutAuxiliar,
          centroCosto: l.centroCosto,
          glosaDetalle: l.documentoRef,
        }))
      });

      const created: AccountingEntry = {
        id: `entry-man-${Date.now()}`,
        fecha: normalized.fecha,
        concepto: normalized.glosaGeneral,
        documento: normalized.documentoRef || 'Comprobante Diario Interno',
        origen: manualEntry.origen,
        lineas: normalized.lineas.map(l => {
          const originalLine = manualEntry.lineas.find(orig => orig.cuentaCodigo === l.codigoCuenta);
          return {
            cuentaCodigo: l.codigoCuenta,
            cuentaNombre: l.nombreCuenta,
            debe: l.debe,
            haber: l.haber,
            rutAuxiliar: l.rutAuxiliar || originalLine?.rutAuxiliar,
            centroCosto: l.centroCosto || originalLine?.centroCosto,
            documentoRef: l.glosaDetalle || originalLine?.documentoRef || manualEntry.documentoReferencia,
            dteIdAsociado: originalLine?.dteIdAsociado,
          };
        }),
        totalDebe: normalized.totalDebe,
        totalHaber: normalized.totalHaber,
        balanceado: true,
        creadoEn: new Date().toISOString(),
      };

      await dispatchEntry(created, {
        agenteNombre: 'OPERADOR_MANUAL',
        accion: 'ASIENTO_MANUAL_DIARIO',
      });

      // Si se imputó cancelación de comprobantes DTE, actualizar su estado a PAGADO/COBRADO
      if (onUpdateDte) {
        manualEntry.lineas.forEach(l => {
          if (l.dteIdAsociado) {
            const foundDte = safeDtes.find(d => d.id === l.dteIdAsociado);
            if (foundDte) {
              onUpdateDte({
                ...foundDte,
                estadoPago: foundDte.tipoOperacion === 'COMPRA' ? 'PAGADO' : 'COBRADO',
              });
            }
          }
        });
      }

      // Sincronizar desde backend para actualizar Libro Diario y Mayor
      if (refetchLedger) {
        await refetchLedger();
      }

      // Restablecer formulario limpio
      setManualEntry(getInitialManualEntry());
      setManualEntryError(null);
      setShowManualModal(false);
      setActiveTab('DIARIO'); // Llevar de inmediato al Libro Diario para ver el asiento
      showToast('Asiento manual registrado con éxito, firmado por el Agente Supervisor y reflejado en el Libro Diario y Mayor.', 'success');
    } catch (err: any) {
      const errorMsg = err?.message || 'Error al validar y registrar el comprobante contable.';
      setManualEntryError(errorMsg);
      showToast(`Error al guardar asiento: ${errorMsg}`, 'error');
    } finally {
      setIsSavingManual(false);
    }
  };

  const manualDebe = manualEntry.lineas.reduce((s, l) => s + (l.debe || 0), 0);
  const manualHaber = manualEntry.lineas.reduce((s, l) => s + (l.haber || 0), 0);
  const manualDiff = manualDebe - manualHaber;
  const isManualBalanced = Math.abs(manualDiff) < 1;

  return (
    <div className="space-y-6">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div
          className={`px-4 py-3 rounded-lg flex items-center justify-between border shadow-sm transition-all animate-fadeIn ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : toastMessage.type === 'error'
              ? 'bg-rose-50 border-rose-300 text-rose-900'
              : 'bg-blue-50 border-blue-300 text-blue-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {toastMessage.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />}
            {toastMessage.type === 'error' && <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />}
            {toastMessage.type === 'info' && <Info className="w-5 h-5 text-blue-600 shrink-0" />}
            <span className="text-sm font-medium">{toastMessage.message}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-xs font-bold px-2 py-1 rounded hover:bg-black/5 cursor-pointer ml-3"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Banner: Senior Orchestrator Identity & Context */}
      <div className="bg-gradient-to-r from-[#0f172a] via-[#1e293b] to-[#0f172a] text-white border border-slate-700 rounded-xl p-6 shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs px-2.5 py-0.5 rounded-full font-mono font-semibold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                NÚCLEO CONTABLE AUTÓNOMO ERP
              </span>
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs px-2.5 py-0.5 rounded-full font-mono flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Drizzle ORM & Node HMAC
              </span>
              <span className="bg-slate-800 text-slate-300 border border-slate-700 text-xs px-2.5 py-0.5 rounded-full font-mono">
                RUT: {company.rut || '77.798.901-4'}
              </span>
              <span className="bg-slate-800 text-slate-300 border border-slate-700 text-xs px-2.5 py-0.5 rounded-full font-mono">
                Régimen: {company.regimenTributario || '14 D3 Pro Pyme General'}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white mt-2 flex items-center gap-2">
              <Scale className="w-6 h-6 text-blue-400" />
              Agente Orquestador Contable & Financiero Senior
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-3xl">
              Autoridad técnica central sobre el Libro Mayor, Libro Diario, Plan de Cuentas Jerárquico y Balances Oficiales (Balance 8 Columnas SII e IFRS). Supervisa y centraliza operaciones de RRHH, RCV, F29, Bancos y Arriendos garantizando partida doble estricta.
            </p>
          </div>

          {/* Currency Switcher & Quick Actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            {refetchLedger && (
              <button
                onClick={() => refetchLedger()}
                disabled={isLedgerLoading || isLedgerCommitting}
                className="px-3 py-2 rounded-lg bg-slate-800/90 text-xs text-slate-300 hover:text-white border border-slate-700 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition-colors shadow-sm"
                title="Sincronizar libro diario desde base de datos PostgreSQL / Drizzle ORM"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLedgerLoading || isLedgerCommitting ? 'animate-spin text-blue-400' : 'text-slate-400'}`} />
                <span className="font-medium">
                  {isLedgerCommitting ? 'Firmando HMAC...' : isLedgerLoading ? 'Cargando API...' : 'Sincronizar BD'}
                </span>
              </button>
            )}

            <div className="bg-slate-800/90 border border-slate-700 rounded-lg p-1 flex items-center gap-1">
              <button
                onClick={() => setCurrencyMode('CLP')}
                className={`px-3 py-1.5 rounded text-xs font-semibold cursor-pointer transition-all ${
                  currencyMode === 'CLP' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'
                }`}
              >
                $ CLP
              </button>
              <button
                onClick={() => setCurrencyMode('UF')}
                className={`px-3 py-1.5 rounded text-xs font-semibold cursor-pointer transition-all ${
                  currencyMode === 'UF' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'
                }`}
                title={`UF al cierre: ${formatCLP(indicators.uf)}`}
              >
                UF ({formatNumberCL(indicators.uf, 0)})
              </button>
              <button
                onClick={() => setCurrencyMode('USD')}
                className={`px-3 py-1.5 rounded text-xs font-semibold cursor-pointer transition-all ${
                  currencyMode === 'USD' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'
                }`}
                title={`Dólar observado: $${indicators.dolar}`}
              >
                USD (${indicators.dolar})
              </button>
            </div>

            <button
              onClick={() => setShowManualModal(true)}
              className="bg-[#2563eb] hover:bg-blue-600 text-white text-xs font-bold px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Asiento Manual</span>
            </button>
          </div>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-slate-800 text-xs">
          <div className="bg-slate-800/60 rounded-lg p-3 border border-slate-700/60">
            <span className="text-slate-400 block font-medium">Total Sumas Débito</span>
            <span className="text-lg font-bold font-mono text-emerald-400 mt-1 block">
              {convertAmount(totalDebe)}
            </span>
            <span className="text-[11px] text-slate-400">{entries.length} Asientos contables</span>
          </div>

          <div className="bg-slate-800/60 rounded-lg p-3 border border-slate-700/60">
            <span className="text-slate-400 block font-medium">Total Sumas Crédito</span>
            <span className="text-lg font-bold font-mono text-blue-400 mt-1 block">
              {convertAmount(totalHaber)}
            </span>
            <span className="text-[11px] text-slate-400">Partida doble SII</span>
          </div>

          <div className="bg-slate-800/60 rounded-lg p-3 border border-slate-700/60">
            <span className="text-slate-400 block font-medium">Cuadratura Partida Doble</span>
            <div className={`mt-1 font-bold flex items-center gap-1.5 ${isAllBalanced ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isAllBalanced ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Libro Mayor Cuadrado</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  <span>Descuadre ({formatCLP(Math.abs(totalDebe - totalHaber))})</span>
                </>
              )}
            </div>
            <span className="text-[11px] text-slate-400">Σ Débitos == Σ Créditos</span>
          </div>

          <div className="bg-slate-800/60 rounded-lg p-3 border border-slate-700/60">
            <span className="text-slate-400 block font-medium">Resultado del Ejercicio</span>
            <div className="mt-1 font-bold font-mono flex items-center gap-1.5">
              <span className={balance8Col.resultado_del_ejercicio.tipo === 'UTILIDAD' ? 'text-emerald-400' : 'text-amber-400'}>
                {balance8Col.resultado_del_ejercicio.tipo}: {convertAmount(balance8Col.resultado_del_ejercicio.monto)}
              </span>
            </div>
            <span className="text-[11px] text-slate-400">
              {totalInTransit > 0 ? `${totalInTransit} operaciones en tránsito` : 'Módulos 100% al día'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="bg-white border border-slate-200 rounded-xl p-2 shadow-xs flex flex-wrap items-center gap-1.5 overflow-x-auto">
        <button
          onClick={() => setActiveTab('AUDIT')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
            activeTab === 'AUDIT'
              ? 'bg-[#0f172a] text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-blue-400" />
          <span>Orquestación & Auditoría Continua</span>
          {totalInTransit > 0 && (
            <span className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
              {totalInTransit}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('DIARIO')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
            activeTab === 'DIARIO'
              ? 'bg-[#0f172a] text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <BookOpen className="w-4 h-4 text-emerald-400" />
          <span>Libro Diario Normalizado</span>
        </button>

        <button
          onClick={() => setActiveTab('MAYOR')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
            activeTab === 'MAYOR'
              ? 'bg-[#0f172a] text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-4 h-4 text-indigo-400" />
          <span>Libro Mayor Analítico (T)</span>
        </button>

        <button
          onClick={() => setActiveTab('AUXILIARES')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
            activeTab === 'AUXILIARES'
              ? 'bg-[#0f172a] text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4 text-violet-400" />
          <span>Libros Auxiliares (Proveedores & Clientes)</span>
        </button>

        <button
          onClick={() => setActiveTab('PLAN_CUENTAS')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
            activeTab === 'PLAN_CUENTAS'
              ? 'bg-[#0f172a] text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Sliders className="w-4 h-4 text-amber-400" />
          <span>Plan de Cuentas (Chile 5 Niveles)</span>
        </button>

        <button
          onClick={() => setActiveTab('BALANCE_8COL')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
            activeTab === 'BALANCE_8COL'
              ? 'bg-[#0f172a] text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Table className="w-4 h-4 text-blue-500" />
          <span>Balance Oficial 8 Columnas (SII)</span>
        </button>

        <button
          onClick={() => setActiveTab('FLUJO_EFECTIVO')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
            activeTab === 'FLUJO_EFECTIVO'
              ? 'bg-[#0f172a] text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Activity className="w-4 h-4 text-emerald-400" />
          <span>Flujo Efectivo (NIC 7)</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
        </button>

        <button
          onClick={() => setActiveTab('IFRS')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
            activeTab === 'IFRS'
              ? 'bg-[#0f172a] text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <PieChart className="w-4 h-4 text-rose-400" />
          <span>Estados Financieros IFRS</span>
        </button>

        <button
          onClick={() => setActiveTab('AI_ROUTING')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
            activeTab === 'AI_ROUTING'
              ? 'bg-[#0f172a] text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Bot className="w-4 h-4 text-purple-400" />
          <span>Asesor Contable IA & Routing</span>
        </button>

        <button
          onClick={() => setActiveTab('EJERCICIO_CIERRE')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
            activeTab === 'EJERCICIO_CIERRE'
              ? 'bg-[#0f172a] text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Calendar className="w-4 h-4 text-amber-500" />
          <span>Ejercicio Fiscal, Cierre & Catch-Up</span>
          {(company.periodosCerrados?.length || 0) > 0 && (
            <span className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.5 rounded-full font-bold flex items-center gap-0.5">
              <Lock className="w-2.5 h-2.5" />
              {company.periodosCerrados?.length}
            </span>
          )}
        </button>
      </div>

      {/* VIEW 1: AUDITORÍA CONTINUA Y ORQUESTACIÓN */}
      {activeTab === 'AUDIT' && (
        <div className="space-y-6">
          {/* Peripheral Module Matrix */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-[#2563eb]" />
                  Matriz de Supervisión y Centralización de Módulos Periféricos
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Monitoreo en tiempo real de operaciones en tránsito provenientes de RRHH, Compras/Ventas SII, F29, Bancos y Arriendos.
                </p>
              </div>
              <div className="text-xs text-slate-500 font-mono">
                Empresa: <strong className="text-slate-800">{company.razonSocial}</strong>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold uppercase text-[11px] tracking-wider">
                    <th className="py-3 px-4">Módulo Periférico</th>
                    <th className="py-3 px-4">Documentos</th>
                    <th className="py-3 px-4">Monto Global</th>
                    <th className="py-3 px-4 text-center">Asentados</th>
                    <th className="py-3 px-4 text-center">En Tránsito</th>
                    <th className="py-3 px-4">Diagnóstico Auditor</th>
                    <th className="py-3 px-4 text-right">Acción Orquestador</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {auditItems.map((item) => (
                    <tr key={item.modulo} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-900 flex items-center gap-2">
                        {item.modulo === 'VENTAS' && <Receipt className="w-4 h-4 text-blue-600" />}
                        {item.modulo === 'COMPRAS' && <FileSpreadsheet className="w-4 h-4 text-amber-600" />}
                        {item.modulo === 'HONORARIOS' && <FileText className="w-4 h-4 text-indigo-600" />}
                        {item.modulo === 'RRHH' && <Users className="w-4 h-4 text-emerald-600" />}
                        {item.modulo === 'F29' && <Scale className="w-4 h-4 text-purple-600" />}
                        {item.modulo === 'TESORERIA' && <Landmark className="w-4 h-4 text-sky-600" />}
                        {item.modulo === 'ARRIENDO' && <Building2 className="w-4 h-4 text-teal-600" />}
                        {item.modulo === 'ACTIVO_FIJO' && <Boxes className="w-4 h-4 text-orange-600" />}
                        {item.modulo === 'PRODUCCION' && <Factory className="w-4 h-4 text-amber-700" />}
                        {item.modulo === 'RRHH_PERSONAS' && <UserCheck className="w-4 h-4 text-emerald-700" />}
                        <span>{item.nombre}</span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700">{item.totalDocumentos}</td>
                      <td className="py-3 px-4 font-mono font-semibold text-slate-900">{convertAmount(item.montoTotal)}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[11px] font-bold">
                          {item.contabilizados}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {item.enTransito > 0 ? (
                          <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded text-[11px] font-bold">
                            {item.enTransito} pendientes
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono">0</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600 max-w-xs">{item.observacion}</td>
                      <td className="py-3 px-4 text-right">
                        {item.enTransito > 0 ? (
                          <button
                            onClick={() => handleCentralizeModule(item.modulo)}
                            className="bg-[#2563eb] hover:bg-blue-700 text-white px-3 py-1 rounded text-xs font-semibold cursor-pointer transition-all shadow-2xs"
                          >
                            Centralizar Ahora
                          </button>
                        ) : (
                          <span className="text-emerald-700 font-semibold flex items-center justify-end gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Al Día</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Period End Adjustments (Devengos, UF, USD, Depreciaciones) */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-indigo-600" />
                  Cierres y Ajustes de Período Automáticos (IFRS / LIR)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Ajustes automáticos de devengos mensuales, corrección monetaria USD, reajustes UF y depreciación de activo fijo bajo NIC 16.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mt-4">
              {closingAdjustments.map((adj) => {
                const sumDebe = adj.asientoPropuesto.lineas.reduce((s, l) => s + (l.debe || 0), 0);
                const sumHaber = adj.asientoPropuesto.lineas.reduce((s, l) => s + (l.haber || 0), 0);
                const isCuadrado = Math.abs(sumDebe - sumHaber) < 1;
                const sortedLines = [...adj.asientoPropuesto.lineas].sort((a, b) => {
                  if (a.debe > 0 && b.haber > 0) return -1;
                  if (a.haber > 0 && b.debe > 0) return 1;
                  return 0;
                });
                const voucherText = getFormattedAdjustmentVoucher(adj);
                const isApplied = adj.aplicado || entries.some(e =>
                  (e.concepto && e.concepto.trim() === adj.asientoPropuesto.glosa.trim()) ||
                  (e.documento && e.documento.toUpperCase().includes(adj.id.toUpperCase()))
                );

                return (
                  <div
                    key={adj.id}
                    className={`border rounded-xl p-4 sm:p-5 transition-all flex flex-col justify-between ${
                      isApplied ? 'bg-slate-50/90 border-slate-200' : 'bg-white border-slate-300 hover:border-blue-400 shadow-2xs'
                    }`}
                  >
                    <div>
                      {/* Top Meta & Action */}
                      <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                              {adj.tipo}
                            </span>
                            <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                              ID: {adj.id}
                            </span>
                            {adj.normaReferencia && (
                              <span className="text-[10px] font-mono font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                                {adj.normaReferencia.split(':')[0]}
                              </span>
                            )}
                          </div>
                          <h4 className="text-sm font-bold text-slate-900 mt-2">{adj.titulo}</h4>
                          <p className="text-xs text-slate-600 mt-0.5">{adj.descripcion}</p>

                          {/* Memoria de Cálculo & Datos de Origen */}
                          {(adj.fuenteDatos || adj.memoriaCalculo) && (
                            <div className="mt-2.5 p-2.5 rounded-lg bg-slate-100/70 border border-slate-200 text-[11px] space-y-1 text-slate-700">
                              {adj.fuenteDatos && (
                                <div>
                                  <span className="font-semibold text-slate-800">Origen de datos:</span>{' '}
                                  <span className="text-slate-600">{adj.fuenteDatos}</span>
                                </div>
                              )}
                              {adj.memoriaCalculo && (
                                <div>
                                  <span className="font-semibold text-slate-800">Cálculo aplicado:</span>{' '}
                                  <span className="font-mono text-[10.5px] text-slate-700">{adj.memoriaCalculo}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-sm font-bold font-mono text-slate-900 block">
                            {convertAmount(adj.montoAjuste)}
                          </span>
                          {isApplied ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-bold mt-1 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Asentado
                            </span>
                          ) : (
                            <div className="mt-1.5 flex flex-wrap items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setEditingAdjustment(adj)}
                                className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-2.5 py-1.5 rounded-lg cursor-pointer transition-all border border-slate-300 inline-flex items-center gap-1"
                                title="Personalizar glosa, cuentas o montos reales según la empresa"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                                <span>Personalizar</span>
                              </button>
                              <button
                                onClick={() => handleApplyAdjustment(adj)}
                                className="bg-[#0f172a] hover:bg-slate-800 text-white text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer transition-all shadow-2xs inline-flex items-center gap-1.5"
                              >
                                <BookOpen className="w-3.5 h-3.5" />
                                <span>Asentar Ajuste</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Comprobante de Asiento Contable (Formato Estándar Normalizado) */}
                      <div className="mt-3.5">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-1.5 overflow-hidden">
                            <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span className="text-[11px] text-slate-700 font-medium italic truncate" title={adj.asientoPropuesto.glosa}>
                              Glosa: "{adj.asientoPropuesto.glosa}"
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCopyText(voucherText, `voucher-${adj.id}`)}
                            className="inline-flex items-center gap-1 text-[11px] text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded transition-colors cursor-pointer shrink-0 font-medium"
                            title="Copiar comprobante contable canónico"
                          >
                            {copiedText === `voucher-${adj.id}` ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span className="text-emerald-700 font-bold">Copiado</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3 text-slate-500" />
                                <span>Copiar Asiento</span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* Standard 4-Column Accounting Voucher Table */}
                        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-slate-100/80 text-slate-600 text-[10px] uppercase border-b border-slate-200 font-mono font-bold tracking-wider">
                                <th className="py-2 px-3 text-left w-24 sm:w-28">Código</th>
                                <th className="py-2 px-3 text-left">Cuenta Contable</th>
                                <th className="py-2 px-3 text-right w-24 sm:w-28">Debe ($)</th>
                                <th className="py-2 px-3 text-right w-24 sm:w-28">Haber ($)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                              {sortedLines.map((line, lIdx) => {
                                const isHaber = line.haber > 0;
                                return (
                                  <tr
                                    key={lIdx}
                                    className={`hover:bg-slate-50/70 transition-colors ${
                                      isHaber ? 'bg-amber-50/20' : ''
                                    }`}
                                  >
                                    <td className="py-1.5 px-3 text-slate-500 font-medium whitespace-nowrap">
                                      {line.codigo_cuenta}
                                    </td>
                                    <td className="py-1.5 px-3 text-slate-800 font-sans">
                                      <div className={`flex flex-wrap items-center gap-1.5 ${isHaber ? 'pl-4 sm:pl-6' : ''}`}>
                                        {isHaber && <span className="text-slate-400 italic font-mono text-[11px]">a</span>}
                                        <span className={isHaber ? 'font-normal text-slate-700' : 'font-semibold text-slate-900'}>
                                          {line.nombre_cuenta}
                                        </span>
                                        {line.centro_costo && (
                                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-mono border border-slate-200">
                                            CC: {line.centro_costo}
                                          </span>
                                        )}
                                        {line.rut_auxiliar && (
                                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 font-mono border border-indigo-200">
                                            RUT: {line.rut_auxiliar}
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="py-1.5 px-3 text-right font-semibold text-emerald-700 whitespace-nowrap">
                                      {line.debe > 0 ? convertAmount(line.debe) : '-'}
                                    </td>
                                    <td className="py-1.5 px-3 text-right font-semibold text-blue-700 whitespace-nowrap">
                                      {line.haber > 0 ? convertAmount(line.haber) : '-'}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot>
                              <tr className="border-t-2 border-slate-200 bg-slate-50 font-mono font-bold text-slate-900 text-[11px]">
                                <td colSpan={2} className="py-2 px-3 text-right uppercase text-[10px] text-slate-600 tracking-wider">
                                  Sumas Iguales (Partida Doble):
                                </td>
                                <td className="py-2 px-3 text-right text-emerald-700 whitespace-nowrap">
                                  {convertAmount(sumDebe)}
                                </td>
                                <td className="py-2 px-3 text-right text-blue-700 whitespace-nowrap">
                                  {convertAmount(sumHaber)}
                                </td>
                              </tr>
                            </tfoot>
                          </table>

                          {/* Footer Validation Status */}
                          <div className="px-3 py-1.5 bg-slate-50/90 border-t border-slate-200 flex items-center justify-between text-[10px]">
                            <span className="text-slate-500 font-sans italic">
                              Criterio:{' '}
                              {adj.tipo === 'DEVENGOS'
                                ? 'NIC 1 / Principio de Devengado'
                                : adj.tipo === 'CORRECCION_MONETARIA_USD'
                                ? 'NIC 21 / Diferencia de Cambio Moneda Extranjera'
                                : adj.tipo === 'REAJUSTE_UF'
                                ? 'IFRS 16 / Reajuste Pasivos Financieros UF'
                                : 'NIC 16 / Depreciación Lineal Propiedades, Planta y Equipo'}
                            </span>
                            {isCuadrado ? (
                              <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Cuadrado (Dif. $0)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 font-bold text-rose-700">
                                <AlertTriangle className="w-3.5 h-3.5" /> Descuadrado
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: LIBRO DIARIO NORMALIZADO */}
      {activeTab === 'DIARIO' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar por glosa, cuenta o documento..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 w-64"
                />
              </div>

              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500"
              >
                <option value="TODOS">Todos los Orígenes</option>
                <option value="RCV_VENTA">RCV Ventas (DTE 33/34)</option>
                <option value="RCV_COMPRA">RCV Compras Proveedores</option>
                <option value="HONORARIOS">Boletas de Honorarios</option>
                <option value="REMUNERACIONES">Nómina y RRHH</option>
                <option value="F29_TRIBUTARIO">Liquidación F29</option>
                <option value="CAJA_BANCO">Bancos y Tesorería</option>
                <option value="ARRIENDO_IFRS16">Contratos IFRS 16</option>
                <option value="MANUAL">Asientos Manuales / Ajustes</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => downloadLibroDiarioPdf(filteredEntries, company as ClientCompany)}
                className="bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                title="Descargar Libro Diario Oficial en PDF timbrado"
              >
                <Download className="w-3.5 h-3.5" />
                <span>PDF</span>
              </button>

              <button
                onClick={() => downloadLibroDiarioExcel(filteredEntries, company as ClientCompany)}
                className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                title="Descargar Libro Diario en formato Excel (.xlsx)"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Excel</span>
              </button>

              <button
                onClick={() => {
                  const allFormatted = filteredEntries.map(formatNormalizedAccountingEntry).join('\n\n');
                  handleCopyText(allFormatted, 'diario_all');
                }}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                {copiedText === 'diario_all' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-600" />}
                <span>Copiar Todo el Libro Diario</span>
              </button>
            </div>
          </div>

          {/* Entries Cards */}
          <div className="space-y-4">
            {filteredEntries.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-slate-500 text-xs">
                No se encontraron asientos contables que coincidan con los filtros aplicados.
              </div>
            ) : (
              filteredEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs hover:border-slate-300 transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                        {entry.fecha}
                      </span>
                      <span className="text-xs font-bold text-slate-900">{entry.concepto}</span>
                      <span className="text-[11px] text-slate-500 font-mono">[{entry.documento}]</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-semibold">
                        {entry.origen}
                      </span>
                      {entry.balanceado ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 text-[11px] font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Cuadrado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-700 text-[11px] font-bold">
                          <AlertTriangle className="w-3.5 h-3.5" /> Descuadrado
                        </span>
                      )}
                      <button
                        onClick={() => handleCopyText(formatNormalizedAccountingEntry(entry), entry.id)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 rounded transition-colors cursor-pointer"
                        title="Copiar comprobante normalizado"
                      >
                        {copiedText === entry.id ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Lines Table */}
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-slate-400 text-[11px] uppercase border-b border-slate-100 font-mono">
                          <th className="pb-1.5 text-left font-semibold">Código</th>
                          <th className="pb-1.5 text-left font-semibold">Cuenta Contable</th>
                          <th className="pb-1.5 text-right font-semibold">Debe ($)</th>
                          <th className="pb-1.5 text-right font-semibold">Haber ($)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 font-mono">
                        {[...entry.lineas]
                          .sort((a, b) => {
                            if (a.debe > 0 && b.haber > 0) return -1;
                            if (a.haber > 0 && b.debe > 0) return 1;
                            return 0;
                          })
                          .map((line, lIdx) => {
                            const isHaber = line.haber > 0;
                            return (
                              <tr key={lIdx} className={`hover:bg-slate-50/50 ${isHaber ? 'bg-amber-50/20' : ''}`}>
                                <td className="py-1.5 text-slate-500">{line.cuentaCodigo}</td>
                                <td className="py-1.5 text-slate-800 font-sans">
                                  <span className={`flex items-center gap-1.5 flex-wrap ${isHaber ? 'pl-4 sm:pl-6' : ''}`}>
                                    {isHaber && <span className="text-slate-400 italic text-[11px]">a</span>}
                                    <span className={isHaber ? 'font-normal text-slate-700' : 'font-semibold text-slate-900'}>
                                      {line.cuentaNombre}
                                    </span>
                                    {line.rutAuxiliar && (
                                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-mono border border-indigo-200">
                                        Aux: {line.rutAuxiliar}
                                      </span>
                                    )}
                                    {line.documentoRef && (
                                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-sans border border-blue-200">
                                        Doc: {line.documentoRef}
                                      </span>
                                    )}
                                    {line.centroCosto && (
                                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-mono border border-purple-200">
                                        CC: {line.centroCosto}
                                      </span>
                                    )}
                                  </span>
                                </td>
                                <td className="py-1.5 text-right text-emerald-700 font-semibold">
                                  {line.debe > 0 ? convertAmount(line.debe) : '-'}
                                </td>
                                <td className="py-1.5 text-right text-blue-700 font-semibold">
                                  {line.haber > 0 ? convertAmount(line.haber) : '-'}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-slate-200 font-mono font-bold text-slate-900 bg-slate-50/50">
                          <td colSpan={2} className="py-2 text-right uppercase text-[11px]">
                            Sumas Iguales:
                          </td>
                          <td className="py-2 text-right text-emerald-700">{convertAmount(entry.totalDebe)}</td>
                          <td className="py-2 text-right text-blue-700">{convertAmount(entry.totalHaber)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* VIEW 3: LIBRO MAYOR ANALÍTICO */}
      {activeTab === 'MAYOR' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-600" />
                Libro Mayor Analítico por Cuenta (Esquema de Mayor / Cuentas T)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Seguimiento analítico de débitos, créditos y saldo acumulado por cuenta contable.
              </p>
            </div>

            {/* Mayor Action Buttons & Account Selector */}
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => downloadLibroMayorPdf(safeEntries, company as ClientCompany)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                title="Descargar Libro Mayor analítico de todas las cuentas en PDF oficial"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Descargar Mayor (PDF)</span>
              </button>

              <div className="w-full sm:w-72">
                <select
                  value={selectedMayorAccountCode}
                  onChange={(e) => setSelectedMayorAccountCode(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono focus:outline-none focus:border-blue-500"
                >
                  {chartOfAccounts.map((acc) => (
                    <option key={acc.codigo} value={acc.codigo}>
                      {acc.codigo} - {acc.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Account Card Details */}
          {(() => {
            const acc = findAccountInChart(selectedMayorAccountCode);
            const totalDebeMayor = mayorAccountMovements.reduce((s, m) => s + m.debe, 0);
            const totalHaberMayor = mayorAccountMovements.reduce((s, m) => s + m.haber, 0);
            const saldoFinal = acc?.naturaleza === 'DEUDORA'
              ? totalDebeMayor - totalHaberMayor
              : totalHaberMayor - totalDebeMayor;

            return (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg">
                    <span className="text-[11px] text-slate-500 uppercase font-semibold">Cuenta</span>
                    <div className="font-bold text-slate-900 text-sm mt-1">{acc?.nombre || selectedMayorAccountCode}</div>
                    <div className="text-[11px] font-mono text-slate-500">{selectedMayorAccountCode}</div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg">
                    <span className="text-[11px] text-slate-500 uppercase font-semibold">Total Débitos</span>
                    <div className="font-bold font-mono text-emerald-700 text-base mt-1">{convertAmount(totalDebeMayor)}</div>
                    <div className="text-[11px] text-slate-500">{mayorAccountMovements.filter(m => m.debe > 0).length} cargos</div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg">
                    <span className="text-[11px] text-slate-500 uppercase font-semibold">Total Créditos</span>
                    <div className="font-bold font-mono text-blue-700 text-base mt-1">{convertAmount(totalHaberMayor)}</div>
                    <div className="text-[11px] text-slate-500">{mayorAccountMovements.filter(m => m.haber > 0).length} abonos</div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg">
                    <span className="text-[11px] text-slate-500 uppercase font-semibold">Saldo ({acc?.naturaleza})</span>
                    <div className="font-bold font-mono text-slate-900 text-base mt-1">{convertAmount(saldoFinal)}</div>
                    <div className="text-[11px] text-slate-500">Naturaleza: {acc?.naturaleza}</div>
                  </div>
                </div>

                {/* Table of Movements */}
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase text-[11px]">
                        <th className="py-2.5 px-3 font-mono">Fecha</th>
                        <th className="py-2.5 px-3">Concepto / Glosa</th>
                        <th className="py-2.5 px-3">Documento</th>
                        <th className="py-2.5 px-3">Auxiliar (RUT)</th>
                        <th className="py-2.5 px-3">Centro Costo</th>
                        <th className="py-2.5 px-3 text-right font-mono">Debe ($)</th>
                        <th className="py-2.5 px-3 text-right font-mono">Haber ($)</th>
                        <th className="py-2.5 px-3 text-right font-mono">Saldo Acumulado ($)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {mayorAccountMovements.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-6 text-center text-slate-400 font-sans">
                            No se registran movimientos en el período para esta cuenta.
                          </td>
                        </tr>
                      ) : (
                        mayorAccountMovements.map((mov, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/60">
                            <td className="py-2 px-3 text-slate-600 whitespace-nowrap">{mov.fecha}</td>
                            <td className="py-2 px-3 text-slate-900 font-sans">{mov.concepto}</td>
                            <td className="py-2 px-3 text-slate-500 font-sans">{mov.documento || '-'}</td>
                            <td className="py-2 px-3">
                              {mov.rutAuxiliar ? (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-mono border border-indigo-200">
                                  {mov.rutAuxiliar}
                                </span>
                              ) : (
                                <span className="text-slate-300 text-[11px]">-</span>
                              )}
                            </td>
                            <td className="py-2 px-3">
                              {mov.centroCosto ? (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-mono border border-purple-200">
                                  {mov.centroCosto}
                                </span>
                              ) : (
                                <span className="text-slate-300 text-[11px]">-</span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-right text-emerald-700 font-semibold whitespace-nowrap">
                              {mov.debe > 0 ? convertAmount(mov.debe) : '-'}
                            </td>
                            <td className="py-2 px-3 text-right text-blue-700 font-semibold whitespace-nowrap">
                              {mov.haber > 0 ? convertAmount(mov.haber) : '-'}
                            </td>
                            <td className="py-2 px-3 text-right font-bold text-slate-900 whitespace-nowrap">
                              {convertAmount(mov.saldoAcumulado)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* VIEW: LIBROS AUXILIARES (PROVEEDORES & CLIENTES) */}
      {activeTab === 'AUXILIARES' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-5">
          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-violet-100 text-violet-900 text-[11px] font-bold px-2 py-0.5 rounded font-mono">
                  LIBROS AUXILIARES OFICIALES
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  {company.razonSocial} (RUT: {company.rut})
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-violet-600" />
                Control de Auxiliares: Cuentas por Pagar (2.1.01) y Cuentas por Cobrar (1.1.03)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Seguimiento analítico individual por RUT y contraparte, vinculando Facturas de Compra/Venta SII (RCV) con cancelaciones en el Libro Diario.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setManualEntry(getInitialManualEntry());
                  setManualEntryError(null);
                  setShowManualModal(true);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nuevo Asiento / Pago con Auxiliar</span>
              </button>
            </div>
          </div>

          {/* Sub-tab Switcher & Filter Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setAuxiliarSubTab('PROVEEDORES');
                  setSelectedAuxiliarRut(null);
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                  auxiliarSubTab === 'PROVEEDORES'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Building2 className="w-3.5 h-3.5 text-amber-600" />
                <span>Auxiliar de Proveedores (CxP)</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 font-mono">
                  {auxiliarSuppliersSummary.filter(s => s.saldoPendiente > 0).length} pendientes
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAuxiliarSubTab('CLIENTES');
                  setSelectedAuxiliarRut(null);
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                  auxiliarSubTab === 'CLIENTES'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-3.5 h-3.5 text-blue-600" />
                <span>Auxiliar de Clientes (CxC)</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-800 font-mono">
                  {auxiliarClientsSummary.filter(c => c.saldoPorCobrar > 0).length} por cobrar
                </span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar por RUT o razón social..."
                  value={auxiliarSearchTerm}
                  onChange={(e) => setAuxiliarSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <select
                value={auxiliarFilterStatus}
                onChange={(e) => setAuxiliarFilterStatus(e.target.value as any)}
                className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-700 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
              >
                <option value="TODOS">Todos los saldos</option>
                <option value="CON_SALDO">Solo con Saldo Exigible</option>
                <option value="SALDADO">Solo Saldados (Al Día)</option>
              </select>
            </div>
          </div>

          {/* KPI Summary Cards */}
          {(() => {
            const isSuppliers = auxiliarSubTab === 'PROVEEDORES';
            const dataList = isSuppliers ? auxiliarSuppliersSummary : auxiliarClientsSummary;
            const totalFact = dataList.reduce((s, d) => s + d.totalFacturado, 0);
            const totalCancelado = dataList.reduce(
              (s, d) => s + (isSuppliers ? (d as any).totalPagado : (d as any).totalCobrado),
              0
            );
            const totalSaldo = dataList.reduce(
              (s, d) => s + (isSuppliers ? (d as any).saldoPendiente : (d as any).saldoPorCobrar),
              0
            );

            return (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                    {isSuppliers ? 'Total Compras Facturadas (SII)' : 'Total Ventas Facturadas (SII)'}
                  </span>
                  <div className="font-mono font-bold text-slate-900 text-lg mt-1">
                    {convertAmount(totalFact)}
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {dataList.length} {isSuppliers ? 'proveedores registrados' : 'clientes registrados'}
                  </span>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                    {isSuppliers ? 'Total Pagos Imputados' : 'Total Cobros Imputados'}
                  </span>
                  <div className="font-mono font-bold text-emerald-700 text-lg mt-1">
                    {convertAmount(totalCancelado)}
                  </div>
                  <span className="text-[10px] text-slate-400">
                    Comprobantes bancarios y de caja
                  </span>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                    {isSuppliers ? 'Saldo Total por Pagar (Pasivo)' : 'Saldo Total por Cobrar (Activo)'}
                  </span>
                  <div className={`font-mono font-bold text-lg mt-1 ${totalSaldo > 0 ? 'text-amber-600' : 'text-emerald-700'}`}>
                    {convertAmount(totalSaldo)}
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {isSuppliers ? 'Exigible ante proveedores' : 'Cartera vigente a cobrar'}
                  </span>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                    Estado de Cuadre Auxiliar
                  </span>
                  <div className="font-bold text-sm mt-1 text-slate-800 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Sincronizado con Mayor</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">
                    Partida doble &amp; DTE correlacionados
                  </span>
                </div>
              </div>
            );
          })()}

          {/* Tabla de Auxiliares */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase text-[11px]">
                  <th className="py-2.5 px-3 font-mono">RUT Auxiliar</th>
                  <th className="py-2.5 px-3">Razón Social / Contraparte</th>
                  <th className="py-2.5 px-3 text-center">DTEs SII</th>
                  <th className="py-2.5 px-3 text-right font-mono">
                    {auxiliarSubTab === 'PROVEEDORES' ? 'Facturado ($)' : 'Facturado ($)'}
                  </th>
                  <th className="py-2.5 px-3 text-right font-mono">
                    {auxiliarSubTab === 'PROVEEDORES' ? 'Pagado ($)' : 'Cobrado ($)'}
                  </th>
                  <th className="py-2.5 px-3 text-right font-mono">Saldo Pendiente ($)</th>
                  <th className="py-2.5 px-3 text-center">Estado</th>
                  <th className="py-2.5 px-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {(() => {
                  const isSuppliers = auxiliarSubTab === 'PROVEEDORES';
                  let list = isSuppliers ? auxiliarSuppliersSummary : auxiliarClientsSummary;

                  if (auxiliarSearchTerm.trim()) {
                    const q = auxiliarSearchTerm.toLowerCase().trim();
                    list = list.filter(
                      (item) =>
                        item.rut.toLowerCase().includes(q) ||
                        item.razonSocial.toLowerCase().includes(q)
                    );
                  }

                  if (auxiliarFilterStatus === 'CON_SALDO') {
                    list = list.filter((item) =>
                      isSuppliers ? (item as any).saldoPendiente > 0 : (item as any).saldoPorCobrar > 0
                    );
                  } else if (auxiliarFilterStatus === 'SALDADO') {
                    list = list.filter((item) =>
                      isSuppliers ? (item as any).saldoPendiente === 0 : (item as any).saldoPorCobrar === 0
                    );
                  }

                  if (list.length === 0) {
                    return (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400 font-sans">
                          No se encontraron auxiliares que coincidan con los filtros seleccionados.
                        </td>
                      </tr>
                    );
                  }

                  return list.map((item) => {
                    const saldo = isSuppliers ? (item as any).saldoPendiente : (item as any).saldoPorCobrar;
                    const pagado = isSuppliers ? (item as any).totalPagado : (item as any).totalCobrado;
                    const isExpanded = selectedAuxiliarRut === item.rut;

                    return (
                      <React.Fragment key={item.rut}>
                        <tr className={`hover:bg-slate-50/80 transition-colors ${isExpanded ? 'bg-blue-50/30' : ''}`}>
                          <td className="py-2 px-3 font-bold text-slate-800 whitespace-nowrap">
                            {item.rut}
                          </td>
                          <td className="py-2 px-3 font-sans font-medium text-slate-900 max-w-xs truncate">
                            {item.razonSocial}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px] font-bold">
                              {item.dtes.length} DTE
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right font-semibold text-slate-900 whitespace-nowrap">
                            {convertAmount(item.totalFacturado)}
                          </td>
                          <td className="py-2 px-3 text-right font-semibold text-emerald-700 whitespace-nowrap">
                            {convertAmount(pagado)}
                          </td>
                          <td className="py-2 px-3 text-right font-bold whitespace-nowrap">
                            <span className={saldo > 0 ? 'text-amber-600' : 'text-emerald-700'}>
                              {convertAmount(saldo)}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center whitespace-nowrap">
                            {saldo === 0 ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                AL DÍA
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900">
                                PENDIENTE
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right whitespace-nowrap font-sans">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setSelectedAuxiliarRut(isExpanded ? null : item.rut)}
                                className="px-2 py-1 rounded text-xs font-semibold text-blue-600 hover:text-blue-800 hover:bg-blue-50 cursor-pointer transition-colors"
                              >
                                {isExpanded ? 'Ocultar' : 'Ver Detalle'}
                              </button>

                              {saldo > 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    // Abrir modal de nuevo asiento con este auxiliar pre-seleccionado
                                    const isProv = auxiliarSubTab === 'PROVEEDORES';
                                    const pendingDte = item.dtes.find(d => d.estadoPago === 'PENDIENTE') || item.dtes[0];
                                    setManualEntry({
                                      fecha: '2026-09-15',
                                      concepto: isProv
                                        ? `Pago a Proveedor ${item.razonSocial} - ${pendingDte ? `F. ${pendingDte.folio}` : 'Factura pendiente'}`
                                        : `Cobranza de Cliente ${item.razonSocial} - ${pendingDte ? `F. ${pendingDte.folio}` : 'Factura'}`,
                                      documentoReferencia: pendingDte ? `Factura Electrónica F.${pendingDte.folio}` : '',
                                      origen: 'CAJA_BANCO',
                                      lineas: isProv
                                        ? [
                                            {
                                              cuentaCodigo: '2.1.01.001',
                                              cuentaNombre: 'Proveedores Nacionales (Cuentas por Pagar)',
                                              debe: pendingDte ? pendingDte.montoTotal : saldo,
                                              haber: 0,
                                              rutAuxiliar: item.rut,
                                              centroCosto: '',
                                              documentoRef: pendingDte ? `Factura F.${pendingDte.folio}` : '',
                                              dteIdAsociado: pendingDte?.id || '',
                                            },
                                            {
                                              cuentaCodigo: '1.1.02.001',
                                              cuentaNombre: 'Banco Santander Chile Cta Cte M/N',
                                              debe: 0,
                                              haber: pendingDte ? pendingDte.montoTotal : saldo,
                                              rutAuxiliar: '',
                                              centroCosto: '',
                                              documentoRef: '',
                                              dteIdAsociado: '',
                                            },
                                          ]
                                        : [
                                            {
                                              cuentaCodigo: '1.1.02.001',
                                              cuentaNombre: 'Banco Santander Chile Cta Cte M/N',
                                              debe: pendingDte ? pendingDte.montoTotal : saldo,
                                              haber: 0,
                                              rutAuxiliar: '',
                                              centroCosto: '',
                                              documentoRef: '',
                                              dteIdAsociado: '',
                                            },
                                            {
                                              cuentaCodigo: '1.1.03.001',
                                              cuentaNombre: 'Clientes Nacionales (Cuentas por Cobrar)',
                                              debe: 0,
                                              haber: pendingDte ? pendingDte.montoTotal : saldo,
                                              rutAuxiliar: item.rut,
                                              centroCosto: '',
                                              documentoRef: pendingDte ? `Factura F.${pendingDte.folio}` : '',
                                              dteIdAsociado: pendingDte?.id || '',
                                            },
                                          ],
                                    });
                                    setManualEntryError(null);
                                    setShowManualModal(true);
                                  }}
                                  className="px-2 py-1 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 cursor-pointer border border-emerald-300 transition-colors"
                                >
                                  {isSuppliers ? 'Pagar' : 'Cobrar'}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Detalle Desplegable del Auxiliar (Comprobantes SII y Movimientos Diario) */}
                        {isExpanded && (
                          <tr className="bg-slate-50/90 font-sans">
                            <td colSpan={8} className="p-4 border-b border-slate-200">
                              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                  <div className="flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-violet-600" />
                                    <span className="font-bold text-xs text-slate-800">
                                      Detalle de Documentos Tributarios (SII RCV) y Comprobantes de Diario para {item.razonSocial} ({item.rut})
                                    </span>
                                  </div>
                                  <span className="text-[11px] font-mono font-bold text-slate-700">
                                    Saldo Exigible: {convertAmount(saldo)}
                                  </span>
                                </div>

                                {/* Listado de DTEs de la contraparte */}
                                <div>
                                  <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                                    1. Documentos Tributarios Electrónicos Registrados ({item.dtes.length} DTEs)
                                  </span>
                                  {item.dtes.length === 0 ? (
                                    <p className="text-xs text-slate-400 italic">No hay DTEs directos asociados.</p>
                                  ) : (
                                    <div className="overflow-x-auto border border-slate-200 rounded-lg">
                                      <table className="w-full text-xs">
                                        <thead className="bg-slate-50 text-slate-500 font-mono text-[10px]">
                                          <tr>
                                            <th className="py-1.5 px-3 text-left">Folio</th>
                                            <th className="py-1.5 px-3 text-left">Tipo DTE</th>
                                            <th className="py-1.5 px-3 text-left">Emisión</th>
                                            <th className="py-1.5 px-3 text-left">Vencimiento</th>
                                            <th className="py-1.5 px-3 text-right">Neto ($)</th>
                                            <th className="py-1.5 px-3 text-right">IVA ($)</th>
                                            <th className="py-1.5 px-3 text-right">Total ($)</th>
                                            <th className="py-1.5 px-3 text-center">Estado Pago</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 font-mono">
                                          {item.dtes.map((d) => (
                                            <tr key={d.id} className="hover:bg-slate-50">
                                              <td className="py-1.5 px-3 font-bold text-slate-900">
                                                F. {d.folio}
                                              </td>
                                              <td className="py-1.5 px-3 text-slate-600 font-sans">
                                                {d.tipoDte === '33' ? 'Factura Electrónica' : d.tipoDte === '34' ? 'Factura Exenta' : `DTE ${d.tipoDte}`}
                                              </td>
                                              <td className="py-1.5 px-3 text-slate-600">{d.fechaEmision}</td>
                                              <td className="py-1.5 px-3 text-slate-600">{d.fechaVencimiento || '-'}</td>
                                              <td className="py-1.5 px-3 text-right">{formatCLP(d.montoNeto)}</td>
                                              <td className="py-1.5 px-3 text-right">{formatCLP(d.montoIva)}</td>
                                              <td className="py-1.5 px-3 text-right font-bold text-slate-900">{formatCLP(d.montoTotal)}</td>
                                              <td className="py-1.5 px-3 text-center">
                                                <span
                                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                    d.estadoPago === 'PAGADO' || d.estadoPago === 'COBRADO'
                                                      ? 'bg-emerald-100 text-emerald-800'
                                                      : 'bg-amber-100 text-amber-900'
                                                  }`}
                                                >
                                                  {d.estadoPago}
                                                </span>
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </div>

                                {/* Listado de Movimientos del Libro Diario */}
                                <div>
                                  <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                                    2. Comprobantes Imputados en Libro Diario ({item.journalMovements.length} asientos)
                                  </span>
                                  {item.journalMovements.length === 0 ? (
                                    <p className="text-xs text-slate-400 italic">No hay asientos de cancelación o ajuste registrados aún.</p>
                                  ) : (
                                    <div className="overflow-x-auto border border-slate-200 rounded-lg">
                                      <table className="w-full text-xs">
                                        <thead className="bg-slate-50 text-slate-500 font-mono text-[10px]">
                                          <tr>
                                            <th className="py-1.5 px-3 text-left">Fecha</th>
                                            <th className="py-1.5 px-3 text-left">Concepto / Glosa</th>
                                            <th className="py-1.5 px-3 text-left">Documento Ref</th>
                                            <th className="py-1.5 px-3 text-right">Debe ($)</th>
                                            <th className="py-1.5 px-3 text-right">Haber ($)</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 font-mono">
                                          {item.journalMovements.map((jm, jIdx) => (
                                            <tr key={jIdx} className="hover:bg-slate-50">
                                              <td className="py-1.5 px-3 text-slate-600">{jm.fecha}</td>
                                              <td className="py-1.5 px-3 font-sans text-slate-900">{jm.concepto}</td>
                                              <td className="py-1.5 px-3 font-sans text-slate-600">{jm.documento || '-'}</td>
                                              <td className="py-1.5 px-3 text-right text-emerald-700 font-semibold">
                                                {jm.debe > 0 ? convertAmount(jm.debe) : '-'}
                                              </td>
                                              <td className="py-1.5 px-3 text-right text-blue-700 font-semibold">
                                                {jm.haber > 0 ? convertAmount(jm.haber) : '-'}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {activeTab === 'PLAN_CUENTAS' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-amber-100 text-amber-900 text-[11px] font-bold px-2 py-0.5 rounded font-mono">
                  PLAN CUSTOM POR EMPRESA
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  {company.razonSocial} (RUT: {company.rut})
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Sliders className="w-5 h-5 text-amber-600" />
                Catálogo y Plan de Cuentas Jerárquico Personalizado
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Edite cuentas, subcuentas analíticas, y configure agrupaciones y subagrupaciones para balances fiscales (SII F22) y casa matriz internacional.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleOpenCreateAccountModal}
                className="bg-[#0f172a] hover:bg-slate-800 text-white text-xs font-bold px-3.5 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4 text-emerald-400" />
                <span>Nueva Cuenta Contable</span>
              </button>

              <button
                onClick={() => setGroupModalOpen(true)}
                className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Administrar grupos de Nivel 2 y subgrupos de Nivel 3 del plan"
              >
                <FolderTree className="w-4 h-4 text-amber-600" />
                <span>Gestionar Grupos / Subgrupos</span>
              </button>

              <button
                onClick={() => setImportExportModalOpen(true)}
                className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Exportar plan a Excel/JSON o importar un catálogo completo"
              >
                <Download className="w-4 h-4 text-blue-600" />
                <span>Importar / Exportar</span>
              </button>

              <button
                onClick={handleResetChartToDefault}
                className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold p-2 rounded-lg cursor-pointer transition-colors"
                title="Restaurar al plan base estándar chileno CMF / SII"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar por código, nombre o grupo..."
                  value={planSearchTerm}
                  onChange={(e) => setPlanSearchTerm(e.target.value)}
                  className="pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 w-72"
                />
              </div>

              <select
                value={planClassFilter}
                onChange={(e) => setPlanClassFilter(e.target.value === 'TODOS' ? 'TODOS' : Number(e.target.value))}
                className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500 font-medium"
              >
                <option value="TODOS">Todas las Clases (1 a 7)</option>
                <option value="1">Clase 1: ACTIVO (Corriente y No Corriente)</option>
                <option value="2">Clase 2: PASIVO (Corriente y No Corriente)</option>
                <option value="3">Clase 3: PATRIMONIO NETO</option>
                <option value="4">Clase 4: INGRESOS DE LA OPERACIÓN</option>
                <option value="5">Clase 5: COSTOS DE EXPLOTACIÓN</option>
                <option value="6">Clase 6: GASTOS DE ADMINISTRACIÓN Y VENTAS</option>
                <option value="7">Clase 7: OTROS INGRESOS / GASTOS NO OPERACIONALES</option>
              </select>

              <select
                value={planAttributeFilter}
                onChange={(e) => setPlanAttributeFilter(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500 font-medium text-slate-700"
              >
                <option value="TODOS">Todos los Atributos ERP</option>
                <option value="MULTIMONEDA">🪙 Maneja Multimoneda (USD/EUR/UF)</option>
                <option value="DOC_REF">📄 Exige Documento Referencia</option>
                <option value="EFECTIVO">💵 Efectivo y Equivalente (NIC 7)</option>
                <option value="CONTRACUENTA">🔄 Contracuenta Efectivo (Puente)</option>
                <option value="PROYECTO">🏗️ Exige Proyecto / Obra</option>
                <option value="AUXILIAR">👤 Exige Auxiliar RUT</option>
                <option value="CENTRO_COSTO">🏢 Exige Centro de Costo</option>
                <option value="CONCILIABLE">🏦 Conciliable Cartola Banco</option>
              </select>
            </div>

            <span className="text-xs text-slate-500 font-mono">
              Mostrando <strong>{filteredPlan.length}</strong> de <strong>{chartOfAccounts.length}</strong> cuentas
            </span>
          </div>

          {/* Accounts Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase text-[11px]">
                  <th className="py-2.5 px-3 font-mono w-32">Código</th>
                  <th className="py-2.5 px-3">Nombre de la Cuenta</th>
                  <th className="py-2.5 px-3">Jerarquía (Grupo / Subgrupo)</th>
                  <th className="py-2.5 px-2 text-center">Naturaleza</th>
                  <th className="py-2.5 px-3">Mapeo Fiscal SII</th>
                  <th className="py-2.5 px-3">Casa Matriz HQ</th>
                  <th className="py-2.5 px-2 text-center">Atributos ERP</th>
                  <th className="py-2.5 px-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {filteredPlan.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400 font-sans">
                      No se encontraron cuentas contables con los filtros especificados.
                    </td>
                  </tr>
                ) : (
                  filteredPlan.map((acc) => (
                    <tr key={acc.codigo} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="py-2 px-3 font-bold text-slate-900">{acc.codigo}</td>
                      <td className="py-2 px-3 font-sans font-semibold text-slate-900">
                        {acc.nombre}
                        {acc.agrupacionPersonalizada && (
                          <span className="ml-1.5 text-[10px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded font-normal">
                            {acc.agrupacionPersonalizada}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 font-sans text-slate-500 text-[11px]">
                        <span className="font-mono text-slate-700">{acc.grupo}</span> {acc.nombreGrupo || ''}
                        <br />
                        <span className="text-slate-400 font-mono text-[10px]">└─ {acc.subgrupo}</span>{' '}
                        <span className="text-[10px] text-slate-600">{acc.nombreSubgrupo || ''}</span>
                      </td>
                      <td className="py-2 px-2 text-center">
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                            acc.naturaleza === 'DEUDORA'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-blue-50 text-blue-700'
                          }`}
                        >
                          {acc.naturaleza}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-sans text-slate-600 text-[11px] max-w-[150px] truncate" title={acc.agrupacionFiscal || 'No asignado'}>
                        {acc.agrupacionFiscal ? (
                          <span className="bg-blue-50 text-blue-800 px-1.5 py-0.5 rounded text-[10px] font-medium">
                            {acc.agrupacionFiscal}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="py-2 px-3 font-sans text-slate-600 text-[11px] max-w-[150px] truncate" title={acc.agrupacionMatrizExtranjera || 'No asignado'}>
                        {acc.agrupacionMatrizExtranjera ? (
                          <span className="bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded text-[10px] font-medium">
                            {acc.agrupacionMatrizExtranjera}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-center font-sans">
                        <div className="flex flex-wrap items-center justify-center gap-1 max-w-[170px] mx-auto">
                          {acc.manejaMultimoneda && (
                            <span className="text-[9px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-bold" title="Maneja Multimoneda (USD/EUR/UF / NIC 21)">
                              USD
                            </span>
                          )}
                          {acc.requiereDocReferencia && (
                            <span className="text-[9px] bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded font-bold" title="Exige Documento Referencia (Factura, Boleta, NC, ND)">
                              DOC
                            </span>
                          )}
                          {acc.esEfectivoEquivalente && (
                            <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold" title="Efectivo y Efectivo Equivalente (NIC 7 / FECU)">
                              EFE
                            </span>
                          )}
                          {acc.esContracuentaEfectivo && (
                            <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold" title="Contracuenta Efectivo y Equivalente (Puente Tesorería)">
                              PTE
                            </span>
                          )}
                          {acc.requiereProyecto && (
                            <span className="text-[9px] bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded font-bold" title="Exige Proyecto / Obra / Contrato">
                              PRY
                            </span>
                          )}
                          {acc.requiereAuxiliarRut && (
                            <span className="text-[9px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-bold" title="Exige RUT Auxiliar">
                              RUT
                            </span>
                          )}
                          {acc.requiereCentroCosto && (
                            <span className="text-[9px] bg-cyan-100 text-cyan-800 px-1.5 py-0.5 rounded font-bold" title="Exige Centro de Costo">
                              CC
                            </span>
                          )}
                          {acc.esConciliableBancaria && (
                            <span className="text-[9px] bg-teal-100 text-teal-800 px-1.5 py-0.5 rounded font-bold" title="Conciliable Banco">
                              BCO
                            </span>
                          )}
                          {!acc.manejaMultimoneda &&
                            !acc.requiereDocReferencia &&
                            !acc.esEfectivoEquivalente &&
                            !acc.esContracuentaEfectivo &&
                            !acc.requiereProyecto &&
                            !acc.requiereAuxiliarRut &&
                            !acc.requiereCentroCosto &&
                            !acc.esConciliableBancaria && (
                              <span className="text-slate-300">-</span>
                            )}
                        </div>
                      </td>
                      {/* Botones de Acción para Editar, Crear Subcuenta o Eliminar */}
                      <td className="py-2 px-3 text-right">
                        <div className="flex items-center justify-end gap-1 font-sans">
                          <button
                            onClick={() => handleOpenSubaccountModal(acc)}
                            className="p-1 rounded hover:bg-blue-50 text-blue-600 cursor-pointer"
                            title={`Crear subcuenta hija de ${acc.codigo}`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenEditAccountModal(acc)}
                            className="p-1 rounded hover:bg-slate-200 text-slate-700 cursor-pointer"
                            title={`Editar cuenta ${acc.codigo}`}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteAccount(acc)}
                            className="p-1 rounded hover:bg-rose-100 text-slate-400 hover:text-rose-600 cursor-pointer"
                            title={`Eliminar cuenta ${acc.codigo}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 5: BALANCE GENERAL TRIBUTARIO DE 8 COLUMNAS Y BALANCES AGRUPADOS */}
      {activeTab === 'BALANCE_8COL' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-blue-100 text-blue-800 text-[11px] font-bold px-2 py-0.5 rounded font-mono">
                  FORMATO OFICIAL SII CHILE
                </span>
                <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2 py-0.5 rounded font-mono">
                  PARTIDA DOBLE GARANTIZADA
                </span>
                <span className="bg-purple-100 text-purple-800 text-[11px] font-bold px-2 py-0.5 rounded font-mono">
                  AGRUPACIONES DINÁMICAS
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                <Table className="w-5 h-5 text-blue-600" />
                Balance Tributario 8 Columnas y Estados Agrupados por Rubro
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Genere el balance con sumas por grupos/subgrupos según normativa tradicional chilena CMF, formato tributario SII (F22), casa matriz en el extranjero o agrupaciones custom.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="bg-slate-100 p-1 rounded-lg flex items-center gap-1 text-xs">
                <button
                  onClick={() => setIsGroupedView(true)}
                  className={`px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${
                    isGroupedView
                      ? 'bg-white text-slate-900 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Vista Agrupada
                </button>
                <button
                  onClick={() => setIsGroupedView(false)}
                  className={`px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${
                    !isGroupedView
                      ? 'bg-white text-slate-900 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Tabla Plana (8 Col)
                </button>
              </div>

              <button
                onClick={() => downloadBalance8ColExcel(balance8Col, company as ClientCompany)}
                className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                title="Descargar Balance 8 Columnas en formato Excel (.xlsx)"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Exportar Excel</span>
              </button>

              <button
                onClick={() => downloadBalance8ColPdf(balance8Col, company as ClientCompany)}
                className="bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                title="Descargar Balance Tributario 8 Columnas oficial en PDF timbrado"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Descargar PDF</span>
              </button>

              <button
                onClick={() => downloadBalance8ColCsv(balance8Col)}
                className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold px-2.5 py-2 rounded-lg flex items-center gap-1 cursor-pointer shadow-xs transition-colors"
                title="Descargar Balance en formato CSV"
              >
                <span>CSV</span>
              </button>

              <button
                onClick={() => {
                  const jsonReport = JSON.stringify(isGroupedView ? groupedBalanceReport : balance8Col, null, 2);
                  handleCopyText(jsonReport, 'balance_json');
                }}
                className="bg-[#0f172a] hover:bg-slate-800 text-white text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                {copiedText === 'balance_json' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Download className="w-3.5 h-3.5" />}
                <span>Copiar JSON ERP</span>
              </button>
            </div>
          </div>

          {/* Selector de Modo de Agrupación para el Balance */}
          <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="font-bold text-slate-800">Criterio de Agrupación del Balance:</span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'TRADICIONAL_CMF', label: '🏛️ Tradicional CMF (5 Niveles)' },
                  { id: 'FISCAL_SII', label: '💼 Fiscal SII (F22 / RLI)' },
                  { id: 'CASA_MATRIZ_HQ', label: '🌐 Casa Matriz (HQ US GAAP / IFRS)' },
                  { id: 'PERSONALIZADO', label: '⚙️ Agrupación Personalizada' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => {
                    setBalanceGroupingMode(opt.id);
                    setIsGroupedView(true);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                    balanceGroupingMode === opt.id
                      ? 'bg-[#0f172a] text-white shadow-2xs font-bold'
                      : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Render de Balance Agrupado vs Tabla Plana */}
          {isGroupedView ? (
            <GroupedBalanceView
              report={groupedBalanceReport}
              convertAmount={convertAmount}
              onCopyJSON={() => {
                const jsonReport = JSON.stringify(groupedBalanceReport, null, 2);
                handleCopyText(jsonReport, 'balance_json');
              }}
              copiedText={copiedText}
            />
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-xs text-right border-collapse">
                <thead>
                  {/* Main Header */}
                  <tr className="bg-[#0f172a] text-white text-[11px] font-semibold uppercase tracking-wider">
                    <th rowSpan={2} className="py-2.5 px-3 text-left border-r border-slate-700">Código</th>
                    <th rowSpan={2} className="py-2.5 px-3 text-left border-r border-slate-700">Cuenta Contable</th>
                    <th colSpan={2} className="py-2 px-3 text-center border-r border-slate-700 bg-slate-800">1-2. Sumas</th>
                    <th colSpan={2} className="py-2 px-3 text-center border-r border-slate-700 bg-slate-800">3-4. Saldos</th>
                    <th colSpan={2} className="py-2 px-3 text-center border-r border-slate-700 bg-blue-900/60">5-6. Inventario</th>
                    <th colSpan={2} className="py-2 px-3 text-center bg-emerald-900/60">7-8. Resultado</th>
                  </tr>
                  {/* Sub Header */}
                  <tr className="bg-slate-100 text-slate-700 text-[10px] font-bold uppercase border-b border-slate-300">
                    <th className="py-1.5 px-2.5 border-r border-slate-200">Débito ($)</th>
                    <th className="py-1.5 px-2.5 border-r border-slate-200">Crédito ($)</th>
                    <th className="py-1.5 px-2.5 border-r border-slate-200">Deudor ($)</th>
                    <th className="py-1.5 px-2.5 border-r border-slate-200">Acreedor ($)</th>
                    <th className="py-1.5 px-2.5 border-r border-slate-200 bg-blue-50 text-blue-900">Activo ($)</th>
                    <th className="py-1.5 px-2.5 border-r border-slate-200 bg-blue-50 text-blue-900">Pasivo ($)</th>
                    <th className="py-1.5 px-2.5 border-r border-slate-200 bg-rose-50 text-rose-900">Pérdida ($)</th>
                    <th className="py-1.5 px-2.5 bg-emerald-50 text-emerald-900">Ganancia ($)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                  {balance8Col.cuentas.map((c) => (
                    <tr key={c.codigo} className="hover:bg-slate-50/70">
                      <td className="py-2 px-3 text-left font-bold text-slate-800 border-r border-slate-100">{c.codigo}</td>
                      <td className="py-2 px-3 text-left font-sans text-slate-900 border-r border-slate-100 truncate max-w-xs">{c.nombre}</td>
                      {/* Sumas */}
                      <td className="py-2 px-2.5 text-slate-700 border-r border-slate-100">{c.debitos > 0 ? convertAmount(c.debitos) : '-'}</td>
                      <td className="py-2 px-2.5 text-slate-700 border-r border-slate-100">{c.creditos > 0 ? convertAmount(c.creditos) : '-'}</td>
                      {/* Saldos */}
                      <td className="py-2 px-2.5 text-emerald-800 font-semibold border-r border-slate-100">{c.saldo_deudor > 0 ? convertAmount(c.saldo_deudor) : '-'}</td>
                      <td className="py-2 px-2.5 text-blue-800 font-semibold border-r border-slate-100">{c.saldo_acreedor > 0 ? convertAmount(c.saldo_acreedor) : '-'}</td>
                      {/* Inventario */}
                      <td className="py-2 px-2.5 text-blue-900 font-bold bg-blue-50/30 border-r border-slate-100">{c.activo > 0 ? convertAmount(c.activo) : '-'}</td>
                      <td className="py-2 px-2.5 text-blue-900 font-bold bg-blue-50/30 border-r border-slate-100">{c.pasivo > 0 ? convertAmount(c.pasivo) : '-'}</td>
                      {/* Resultado */}
                      <td className="py-2 px-2.5 text-rose-800 font-bold bg-rose-50/30 border-r border-slate-100">{c.perdida > 0 ? convertAmount(c.perdida) : '-'}</td>
                      <td className="py-2 px-2.5 text-emerald-800 font-bold bg-emerald-50/30">{c.ganancia > 0 ? convertAmount(c.ganancia) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="font-mono text-[11px] font-bold">
                  {/* Subtotales */}
                  <tr className="bg-slate-100 text-slate-900 border-t-2 border-slate-300">
                    <td colSpan={2} className="py-2.5 px-3 text-left uppercase text-[11px] border-r border-slate-200">
                      Subtotales de Columnas:
                    </td>
                    <td className="py-2.5 px-2.5 border-r border-slate-200 text-emerald-800">{convertAmount(balance8Col.totales.total_debitos)}</td>
                    <td className="py-2.5 px-2.5 border-r border-slate-200 text-blue-800">{convertAmount(balance8Col.totales.total_creditos)}</td>
                    <td className="py-2.5 px-2.5 border-r border-slate-200 text-emerald-800">{convertAmount(balance8Col.totales.total_saldo_deudor)}</td>
                    <td className="py-2.5 px-2.5 border-r border-slate-200 text-blue-800">{convertAmount(balance8Col.totales.total_saldo_acreedor)}</td>
                    <td className="py-2.5 px-2.5 border-r border-slate-200 bg-blue-100/50 text-blue-950">{convertAmount(balance8Col.totales.total_activo)}</td>
                    <td className="py-2.5 px-2.5 border-r border-slate-200 bg-blue-100/50 text-blue-950">{convertAmount(balance8Col.totales.total_pasivo)}</td>
                    <td className="py-2.5 px-2.5 border-r border-slate-200 bg-rose-100/50 text-rose-950">{convertAmount(balance8Col.totales.total_perdida)}</td>
                    <td className="py-2.5 px-2.5 bg-emerald-100/50 text-emerald-950">{convertAmount(balance8Col.totales.total_ganancia)}</td>
                  </tr>

                  {/* Línea Oficial de Utilidad / Pérdida del Ejercicio con Cuadre Simétrico */}
                  <tr className="bg-amber-50 text-amber-900 border-t border-amber-200 font-bold">
                    <td colSpan={2} className="py-2.5 px-3 text-left uppercase text-[11px] border-r border-amber-200 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                      <span>
                        {balance8Col.resultado_del_ejercicio.tipo === 'UTILIDAD' ? 'Utilidad del Ejercicio Actual' : 'Pérdida del Ejercicio Actual'}
                      </span>
                    </td>
                    <td colSpan={4} className="py-2.5 px-2.5 text-center text-slate-400 border-r border-amber-200 font-sans text-xs">
                      (Cuadre simétrico entre Inventario y Resultado)
                    </td>
                    {/* Inventario Balance Line */}
                    <td className="py-2.5 px-2.5 border-r border-amber-200 text-amber-950">
                      {balance8Col.resultado_del_ejercicio.tipo === 'PERDIDA' ? convertAmount(balance8Col.resultado_del_ejercicio.monto) : '-'}
                    </td>
                    <td className="py-2.5 px-2.5 border-r border-amber-200 text-amber-950">
                      {balance8Col.resultado_del_ejercicio.tipo === 'UTILIDAD' ? convertAmount(balance8Col.resultado_del_ejercicio.monto) : '-'}
                    </td>
                    {/* Resultado Balance Line */}
                    <td className="py-2.5 px-2.5 border-r border-amber-200 text-amber-950">
                      {balance8Col.resultado_del_ejercicio.tipo === 'UTILIDAD' ? convertAmount(balance8Col.resultado_del_ejercicio.monto) : '-'}
                    </td>
                    <td className="py-2.5 px-2.5 text-amber-950">
                      {balance8Col.resultado_del_ejercicio.tipo === 'PERDIDA' ? convertAmount(balance8Col.resultado_del_ejercicio.monto) : '-'}
                    </td>
                  </tr>

                  {/* Totales Iguales Finales */}
                  <tr className="bg-[#0f172a] text-white text-[11px] border-t-2 border-slate-900 font-mono">
                    <td colSpan={2} className="py-3 px-3 text-left uppercase text-[11px] border-r border-slate-700">
                      Totales Iguales Cuadrados:
                    </td>
                    <td className="py-3 px-2.5 border-r border-slate-700 text-emerald-400">{convertAmount(balance8Col.totales.total_debitos)}</td>
                    <td className="py-3 px-2.5 border-r border-slate-700 text-blue-400">{convertAmount(balance8Col.totales.total_creditos)}</td>
                    <td className="py-3 px-2.5 border-r border-slate-700 text-emerald-400">{convertAmount(balance8Col.totales.total_saldo_deudor)}</td>
                    <td className="py-3 px-2.5 border-r border-slate-700 text-blue-400">{convertAmount(balance8Col.totales.total_saldo_acreedor)}</td>
                    <td className="py-3 px-2.5 border-r border-slate-700 text-blue-300">
                      {convertAmount(
                        balance8Col.resultado_del_ejercicio.tipo === 'PERDIDA'
                          ? balance8Col.totales.total_activo + balance8Col.resultado_del_ejercicio.monto
                          : balance8Col.totales.total_activo
                      )}
                    </td>
                    <td className="py-3 px-2.5 border-r border-slate-700 text-blue-300">
                      {convertAmount(
                        balance8Col.resultado_del_ejercicio.tipo === 'UTILIDAD'
                          ? balance8Col.totales.total_pasivo + balance8Col.resultado_del_ejercicio.monto
                          : balance8Col.totales.total_pasivo
                      )}
                    </td>
                    <td className="py-3 px-2.5 border-r border-slate-700 text-rose-300">
                      {convertAmount(
                        balance8Col.resultado_del_ejercicio.tipo === 'UTILIDAD'
                          ? balance8Col.totales.total_perdida + balance8Col.resultado_del_ejercicio.monto
                          : balance8Col.totales.total_perdida
                      )}
                    </td>
                    <td className="py-3 px-2.5 text-emerald-300">
                      {convertAmount(
                        balance8Col.resultado_del_ejercicio.tipo === 'PERDIDA'
                          ? balance8Col.totales.total_ganancia + balance8Col.resultado_del_ejercicio.monto
                          : balance8Col.totales.total_ganancia
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* VIEW 5.5: ESTADO DE FLUJOS DE EFECTIVO MÉTODO INDIRECTO (NIF / NIC 7) */}
      {activeTab === 'FLUJO_EFECTIVO' && (
        <CashFlowIndirectView
          empresaRut={company.rut}
          empresaNombre={company.razonSocial}
          chartOfAccounts={chartOfAccounts}
          entries={entries}
          balance8Col={balance8Col}
          periodoSeleccionado={company?.periodoActual || '2026-10'}
        />
      )}

      {/* VIEW 6: ESTADOS FINANCIEROS IFRS / CMF */}
      {activeTab === 'IFRS' && (
        <div className="space-y-6">
          {/* Top Action Bar: Header & Download Buttons */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <PieChart className="w-5 h-5 text-rose-500" />
                <span>Estados Financieros Clasificados (NIIF / IFRS)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Estado de Situación Financiera clasificado (NIC 1) y Estado de Resultados por Función.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => downloadFinancialStatementsPdf(ifrsStatements, company as ClientCompany)}
                className="bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold px-3.5 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                title="Descargar Estados Financieros en formato PDF formal con pie de firma"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Descargar PDF (IFRS)</span>
              </button>
              <button
                onClick={() => downloadFinancialStatementsExcel(ifrsStatements, company as ClientCompany)}
                className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold px-3.5 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                title="Descargar Estados Financieros en formato Excel (.xlsx)"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Exportar Excel</span>
              </button>
            </div>
          </div>

          {/* Ratios Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
              <span className="text-[11px] text-slate-500 font-medium uppercase">Razón Corriente</span>
              <div className="text-lg font-bold text-slate-900 mt-1 font-mono">
                {ifrsStatements.ratios.razonCorriente.toFixed(2)}x
              </div>
              <span className="text-[10px] text-slate-400">Activo Cte / Pasivo Cte</span>
            </div>

            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
              <span className="text-[11px] text-slate-500 font-medium uppercase">Capital de Trabajo</span>
              <div className="text-lg font-bold text-emerald-700 mt-1 font-mono">
                {convertAmount(ifrsStatements.ratios.capitalTrabajo)}
              </div>
              <span className="text-[10px] text-slate-400">Liquidez Neta Operacional</span>
            </div>

            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
              <span className="text-[11px] text-slate-500 font-medium uppercase">Margen Bruto</span>
              <div className="text-lg font-bold text-blue-700 mt-1 font-mono">
                {ifrsStatements.ratios.margenBrutoPct.toFixed(1)}%
              </div>
              <span className="text-[10px] text-slate-400">Utilidad Bruta / Ventas</span>
            </div>

            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
              <span className="text-[11px] text-slate-500 font-medium uppercase">Margen Neto</span>
              <div className="text-lg font-bold text-indigo-700 mt-1 font-mono">
                {ifrsStatements.ratios.margenNetoPct.toFixed(1)}%
              </div>
              <span className="text-[10px] text-slate-400">Resultado Neto / Ventas</span>
            </div>

            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
              <span className="text-[11px] text-slate-500 font-medium uppercase">Endeudamiento</span>
              <div className="text-lg font-bold text-amber-700 mt-1 font-mono">
                {ifrsStatements.ratios.ratioEndeudamiento.toFixed(2)}x
              </div>
              <span className="text-[10px] text-slate-400">Pasivo Total / Patrimonio</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Estado de Situación Financiera */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
              <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-[#2563eb]" />
                    Estado de Situación Financiera Clasificado (NIC 1)
                  </h4>
                  <p className="text-[11px] text-slate-500">Balance General Clasificado en Corriente y No Corriente</p>
                </div>
                {ifrsStatements.estadoSituacion.cuadrado && (
                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Ecuación Patrimonial Cuadrada
                  </span>
                )}
              </div>

              {/* Activos */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-800 uppercase tracking-wider bg-slate-50 px-2 py-1 rounded">
                  ACTIVOS
                </div>
                <div className="pl-2 space-y-1 text-xs">
                  <div className="flex justify-between text-slate-700 font-medium">
                    <span>Activo Corriente:</span>
                    <span className="font-mono font-bold text-slate-900">
                      {convertAmount(ifrsStatements.estadoSituacion.activoCorriente.total)}
                    </span>
                  </div>
                  {ifrsStatements.estadoSituacion.activoCorriente.items.map((i, idx) => (
                    <div key={idx} className="flex justify-between text-slate-500 text-[11px] pl-2">
                      <span>{i.nombre}</span>
                      <span className="font-mono">{convertAmount(i.saldo)}</span>
                    </div>
                  ))}

                  <div className="flex justify-between text-slate-700 font-medium pt-2">
                    <span>Activo No Corriente (Activo Fijo + IFRS 16):</span>
                    <span className="font-mono font-bold text-slate-900">
                      {convertAmount(ifrsStatements.estadoSituacion.activoNoCorriente.total)}
                    </span>
                  </div>
                  {ifrsStatements.estadoSituacion.activoNoCorriente.items.map((i, idx) => (
                    <div key={idx} className="flex justify-between text-slate-500 text-[11px] pl-2">
                      <span>{i.nombre}</span>
                      <span className="font-mono">{convertAmount(i.saldo)}</span>
                    </div>
                  ))}

                  <div className="flex justify-between text-slate-900 font-bold pt-2 border-t border-slate-200 text-xs">
                    <span>TOTAL ACTIVOS:</span>
                    <span className="font-mono text-emerald-700">
                      {convertAmount(ifrsStatements.estadoSituacion.totalActivos)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Pasivos y Patrimonio */}
              <div className="space-y-2 pt-3 border-t border-slate-100">
                <div className="text-xs font-bold text-slate-800 uppercase tracking-wider bg-slate-50 px-2 py-1 rounded">
                  PASIVOS Y PATRIMONIO
                </div>
                <div className="pl-2 space-y-1 text-xs">
                  <div className="flex justify-between text-slate-700 font-medium">
                    <span>Pasivo Corriente:</span>
                    <span className="font-mono font-bold text-slate-900">
                      {convertAmount(ifrsStatements.estadoSituacion.pasivoCorriente.total)}
                    </span>
                  </div>

                  <div className="flex justify-between text-slate-700 font-medium pt-1">
                    <span>Pasivo No Corriente:</span>
                    <span className="font-mono font-bold text-slate-900">
                      {convertAmount(ifrsStatements.estadoSituacion.pasivoNoCorriente.total)}
                    </span>
                  </div>

                  <div className="flex justify-between text-slate-700 font-medium pt-1">
                    <span>Patrimonio Neto:</span>
                    <span className="font-mono font-bold text-slate-900">
                      {convertAmount(ifrsStatements.estadoSituacion.patrimonioNeto.total)}
                    </span>
                  </div>
                  {ifrsStatements.estadoSituacion.patrimonioNeto.items.map((i, idx) => (
                    <div key={idx} className="flex justify-between text-slate-500 text-[11px] pl-2">
                      <span>{i.nombre}</span>
                      <span className="font-mono">{convertAmount(i.saldo)}</span>
                    </div>
                  ))}

                  <div className="flex justify-between text-slate-900 font-bold pt-2 border-t border-slate-200 text-xs">
                    <span>TOTAL PASIVOS Y PATRIMONIO:</span>
                    <span className="font-mono text-blue-700">
                      {convertAmount(ifrsStatements.estadoSituacion.totalPasivoYPatrimonio)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Estado de Resultados por Función */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
              <div className="pb-3 border-b border-slate-100">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  Estado de Resultados por Función (NIC 1)
                </h4>
                <p className="text-[11px] text-slate-500">Estructura oficial de margen, EBITDA y resultado del ejercicio</p>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-700 font-medium">Ingresos de Actividades Ordinarias:</span>
                  <span className="font-mono font-bold text-emerald-700">
                    {convertAmount(ifrsStatements.estadoResultados.ingresosOperacionales)}
                  </span>
                </div>

                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-600">(-) Costo de Ventas:</span>
                  <span className="font-mono text-rose-700">
                    -{convertAmount(ifrsStatements.estadoResultados.costoVentas)}
                  </span>
                </div>

                <div className="flex justify-between py-1.5 bg-slate-50 px-2 rounded font-bold">
                  <span className="text-slate-900">MARGEN BRUTO:</span>
                  <span className="font-mono text-slate-900">
                    {convertAmount(ifrsStatements.estadoResultados.margenBruto)}
                  </span>
                </div>

                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-600">(-) Gastos de Administración y Ventas:</span>
                  <span className="font-mono text-rose-700">
                    -{convertAmount(ifrsStatements.estadoResultados.gastosAdministracionVentas)}
                  </span>
                </div>

                <div className="flex justify-between py-1.5 bg-blue-50/60 px-2 rounded font-bold">
                  <span className="text-blue-900">EBITDA:</span>
                  <span className="font-mono text-blue-900">
                    {convertAmount(ifrsStatements.estadoResultados.ebitda)}
                  </span>
                </div>

                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-600">(-) Depreciación y Amortización (NIC 16 / IFRS 16):</span>
                  <span className="font-mono text-rose-700">
                    -{convertAmount(ifrsStatements.estadoResultados.depreciacionAmortizacion)}
                  </span>
                </div>

                <div className="flex justify-between py-1.5 bg-slate-50 px-2 rounded font-bold">
                  <span className="text-slate-900">RESULTADO OPERACIONAL:</span>
                  <span className="font-mono text-slate-900">
                    {convertAmount(ifrsStatements.estadoResultados.resultadoOperacional)}
                  </span>
                </div>

                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-600">(+) Otros Ingresos Fuera de Explotación:</span>
                  <span className="font-mono text-emerald-700">
                    {convertAmount(ifrsStatements.estadoResultados.otrosIngresos)}
                  </span>
                </div>

                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-600">(-) Gastos Financieros y Reajustes:</span>
                  <span className="font-mono text-rose-700">
                    -{convertAmount(ifrsStatements.estadoResultados.otrosGastosFinancieros)}
                  </span>
                </div>

                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-600">(-) Provisión Impuesto a la Renta (IDPC):</span>
                  <span className="font-mono text-rose-700">
                    -{convertAmount(ifrsStatements.estadoResultados.impuestoRenta)}
                  </span>
                </div>

                <div className="flex justify-between py-2 bg-emerald-50 px-2 rounded font-bold text-sm border border-emerald-200">
                  <span className="text-emerald-900">RESULTADO NETO DEL EJERCICIO:</span>
                  <span className="font-mono text-emerald-900">
                    {convertAmount(ifrsStatements.estadoResultados.resultadoNeto)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 7: CONSOLA ASESORA IA & ROUTING DE ASIENTOS (DOS CAPAS) */}
      {activeTab === 'AI_ROUTING' && (
        <div className="space-y-6">
          {/* Sub-navigation Switcher between Conversational Assistant and Direct Glosa Terminal */}
          <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-xl border border-slate-200 w-fit">
            <button
              onClick={() => setAiRoutingSubTab('CONVERSACIONAL')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                aiRoutingSubTab === 'CONVERSACIONAL'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Bot className="w-4 h-4" />
              <span>Asistente Conversacional & Asientos IA</span>
            </button>
            <button
              onClick={() => setAiRoutingSubTab('GLOSA_DIRECTA')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                aiRoutingSubTab === 'GLOSA_DIRECTA'
                  ? 'bg-[#0f172a] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Terminal de Glosa Cruda (JSON ERP)</span>
            </button>
          </div>

          {/* MODO 1: ASISTENTE CONVERSACIONAL DE CONTABILIZACIÓN */}
          {aiRoutingSubTab === 'CONVERSACIONAL' && (
            <AccountingEventAssistant
              company={company}
              firm={firm}
              indicators={indicators}
              onCommitEntry={(entry) =>
                dispatchEntry(entry, {
                  agenteNombre: 'ASESOR_CONTABLE_IA',
                  accion: 'CONTABILIZACION_CONVERSACIONAL',
                  modelName: 'gemini-3.8-flash',
                })
              }
              onViewLedger={() => setActiveTab('DIARIO')}
            />
          )}

          {/* MODO 2: TERMINAL DIRECTA DE ROUTING DE GLOSA */}
          {aiRoutingSubTab === 'GLOSA_DIRECTA' && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-6">
              <div className="pb-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="bg-purple-100 text-purple-800 text-[11px] font-bold px-2 py-0.5 rounded font-mono">
                    DOS CAPAS: HUMANA + JSON ERP TRANSACCIONAL
                  </span>
                  <h3 className="text-base font-bold text-slate-900 mt-1 flex items-center gap-2">
                    <Bot className="w-5 h-5 text-purple-600" />
                    Terminal Asesora de Routing Contable & Imputaciones IA
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Ingresa cualquier glosa cruda, factura o contrato para que el Agente Orquestador determine las cuentas exactas, centro de costo y emita la propuesta transaccional.
                  </p>
                </div>
              </div>

              {/* Glosa Input Form */}
              <div className="bg-slate-50 border border-slate-200 p-5 rounded-xl space-y-3">
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                  Glosa u Operación Económica Cruda
                </label>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <input
                    type="text"
                    value={rawGlosaInput}
                    onChange={(e) => setRawGlosaInput(e.target.value)}
                    placeholder="Ej: Pago arriendo de oficina en Las Condes según contrato UF..."
                    className="flex-1 text-xs bg-white border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:border-blue-500 font-sans"
                  />
                  <div className="w-48">
                    <input
                      type="number"
                      value={rawMontoInput}
                      onChange={(e) => setRawMontoInput(Number(e.target.value))}
                      placeholder="Monto $ CLP"
                      className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2.5 font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <button
                    onClick={handleSimulateAiRouting}
                    disabled={isAiLoading}
                    className="bg-[#2563eb] hover:bg-blue-700 disabled:bg-slate-400 text-white text-xs font-bold px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-all shadow-xs shrink-0"
                  >
                    {isAiLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Analizando Imputación...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Ejecutar Routing IA</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* AI Response Display (2 Layers) */}
              {aiProposalResponse && (
                <div className="space-y-4 pt-2">
                  {/* Capa 1: Capa Humana */}
                  <div className="bg-blue-50/50 border border-blue-200 rounded-xl p-5">
                    <div className="flex items-center gap-2 text-xs font-bold text-blue-900 uppercase font-mono mb-2">
                      <Info className="w-4 h-4 text-blue-600" />
                      CAPA HUMANA · EXPLICACIÓN TÉCNICA Y NORMATIVA CHILENA
                    </div>
                    <div className="text-xs text-slate-800 leading-relaxed whitespace-pre-line font-sans">
                      {aiProposalResponse.humanLayer}
                    </div>
                  </div>

                  {/* Capa 2: Capa Transaccional JSON */}
                  <div className="bg-[#0f172a] text-slate-200 rounded-xl p-5 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                      <div className="flex items-center gap-2 text-xs font-bold text-purple-400 font-mono">
                        <FileSpreadsheet className="w-4 h-4" />
                        CAPA TRANSACCIONAL ERP (JSON PROTOCOL A)
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            handleCopyText(JSON.stringify(aiProposalResponse.transactionalLayer, null, 2), 'ai_json')
                          }
                          className="text-xs text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer font-mono bg-slate-800 px-2.5 py-1 rounded"
                        >
                          {copiedText === 'ai_json' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>Copiar JSON</span>
                        </button>
                        <button
                          onClick={handleCommitAiProposal}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Asentar en Libro Diario</span>
                        </button>
                      </div>
                    </div>

                    <pre className="text-xs font-mono text-emerald-400 overflow-x-auto max-h-96 p-2">
                      {JSON.stringify(aiProposalResponse.transactionalLayer, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* VIEW 8: EJERCICIO FISCAL, CIERRE, APERTURA Y REGISTRO RETROACTIVO (CATCH-UP) */}
      {activeTab === 'EJERCICIO_CIERRE' && (
        <FiscalYearClosingModule
          company={company}
          onUpdateCompany={onUpdateCompany}
          entries={safeEntries}
          balance8Col={balance8Col}
          payrolls={safePayrolls}
          f29={f29}
          onAddEntry={onAddEntry}
          dispatchEntry={dispatchEntry}
          onShowToast={showToast}
          convertAmount={convertAmount}
          systemParams={systemParams}
          onUpdateSystemParams={onUpdateSystemParams}
        />
      )}

      {/* MODAL: NUEVO ASIENTO MANUAL */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] overflow-y-auto p-5 sm:p-6 space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                    Registrar Nuevo Asiento Contable Manual
                  </h3>
                  <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                    Validación formal de Partida Doble, Firma Agéntica y Persistencia en MySQL
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowManualModal(false);
                  setManualEntryError(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                title="Cerrar ventana"
              >
                ✕
              </button>
            </div>

            {/* Banner de error visible y explícito para el usuario */}
            {manualEntryError && (
              <div className="p-3 bg-rose-50 border border-rose-300 text-rose-900 rounded-xl text-xs flex items-start gap-2.5 animate-in fade-in">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="font-bold">Observación de Auditoría / Validación:</span>
                  <div className="mt-0.5 text-rose-800">{manualEntryError}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setManualEntryError(null)}
                  className="text-rose-400 hover:text-rose-700 text-xs font-bold"
                >
                  ✕
                </button>
              </div>
            )}

            <form onSubmit={handleSaveManualEntry} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Fecha Contable</label>
                  <input
                    type="date"
                    value={manualEntry.fecha}
                    onChange={(e) => {
                      setManualEntry({ ...manualEntry, fecha: e.target.value });
                      setManualEntryError(null);
                    }}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Tipo de Origen</label>
                  <select
                    value={manualEntry.origen}
                    onChange={(e) => {
                      setManualEntry({ ...manualEntry, origen: e.target.value as any });
                      setManualEntryError(null);
                    }}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                  >
                    <option value="MANUAL">Manual / Ajuste Interno</option>
                    <option value="RCV_VENTA">RCV Ventas</option>
                    <option value="RCV_COMPRA">RCV Compras</option>
                    <option value="REMUNERACIONES">Remuneraciones</option>
                    <option value="F29_TRIBUTARIO">F29 Tributario</option>
                    <option value="CAJA_BANCO">Bancos / Tesorería</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Documento Respaldo</label>
                  <input
                    type="text"
                    value={manualEntry.documentoReferencia}
                    onChange={(e) => {
                      setManualEntry({ ...manualEntry, documentoReferencia: e.target.value });
                      setManualEntryError(null);
                    }}
                    placeholder="Ej: Factura #1420 / Comprobante #10"
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Concepto / Glosa General *</label>
                <input
                  type="text"
                  value={manualEntry.concepto}
                  onChange={(e) => {
                    setManualEntry({ ...manualEntry, concepto: e.target.value });
                    setManualEntryError(null);
                  }}
                  placeholder="Descripción clara y normativa de la operación económica..."
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2.5 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                  required
                />
              </div>

              {/* Lines table with SearchableAccountSelect and Delete Line */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Partidas del Asiento ({manualEntry.lineas.length} cuentas)
                    </span>
                    <p className="text-[10px] text-slate-400">
                      Escriba en el buscador para filtrar cuentas por código o nombre instantáneamente
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddManualLine}
                    className="text-blue-600 hover:text-blue-800 text-xs font-semibold flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors cursor-pointer border border-blue-200"
                  >
                    <Plus className="w-3.5 h-3.5" /> Agregar Cuenta
                  </button>
                </div>

                <div className="space-y-2.5">
                  {manualEntry.lineas.map((line, idx) => {
                    const reqAux = isAccountAuxiliarRequired(line.cuentaCodigo, line.cuentaNombre);
                    const reqCc = isAccountCostCenterRequired(line.cuentaCodigo, line.cuentaNombre);

                    return (
                      <div
                        key={idx}
                        className={`p-2.5 rounded-xl border transition-all ${
                          reqAux || reqCc
                            ? 'bg-slate-50/90 border-slate-300 shadow-2xs'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {/* Fila Principal: Cuenta, Debe, Haber, Eliminar */}
                        <div className="flex items-center gap-2">
                          <span className="w-5 text-[11px] font-mono text-slate-400 text-center font-bold shrink-0">
                            {idx + 1}
                          </span>

                          {/* Selector de Cuentas Buscable con Filtro Dinámico */}
                          <div className="flex-1 min-w-[220px]">
                            <SearchableAccountSelect
                              value={line.cuentaNombre}
                              selectedCode={line.cuentaCodigo}
                              accounts={chartOfAccounts}
                              onChange={(acc) => handleUpdateManualAccount(idx, acc)}
                              placeholder="Buscar por código (ej: 1.1.02) o nombre..."
                            />
                            {/* Badges de exigencia normativa */}
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              {reqAux && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                                  <Users className="w-3 h-3 text-amber-600" />
                                  Exige Auxiliar (RUT / DTE)
                                </span>
                              )}
                              {reqCc && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-300">
                                  <PieChart className="w-3 h-3 text-purple-600" />
                                  Exige Centro de Costos
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Monto Debe (Ingreso manual sin spinup/spindown) */}
                          <div className="relative w-28 sm:w-32 shrink-0">
                            <span className="absolute left-2.5 top-2 text-[10px] text-slate-400 font-bold">$</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              placeholder="Debe $0"
                              value={line.debe ? Number(line.debe).toLocaleString('es-CL') : ''}
                              onChange={(e) => {
                                const clean = e.target.value.replace(/\D/g, '');
                                handleUpdateManualLine(idx, 'debe', clean ? parseInt(clean, 10) : 0);
                              }}
                              className="w-full pl-6 pr-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-right font-mono font-medium focus:ring-1 focus:ring-blue-500 focus:outline-hidden [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                          </div>

                          {/* Monto Haber (Ingreso manual sin spinup/spindown) */}
                          <div className="relative w-28 sm:w-32 shrink-0">
                            <span className="absolute left-2.5 top-2 text-[10px] text-slate-400 font-bold">$</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              placeholder="Haber $0"
                              value={line.haber ? Number(line.haber).toLocaleString('es-CL') : ''}
                              onChange={(e) => {
                                const clean = e.target.value.replace(/\D/g, '');
                                handleUpdateManualLine(idx, 'haber', clean ? parseInt(clean, 10) : 0);
                              }}
                              className="w-full pl-6 pr-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-right font-mono font-medium focus:ring-1 focus:ring-blue-500 focus:outline-hidden [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                          </div>

                          {/* Botón para Eliminar Cuenta / Partida */}
                          <button
                            type="button"
                            disabled={manualEntry.lineas.length <= 2}
                            onClick={() => handleRemoveManualLine(idx)}
                            className={`p-1.5 rounded-lg border transition-colors shrink-0 ${
                              manualEntry.lineas.length > 2
                                ? 'border-rose-200 text-rose-500 hover:bg-rose-50 hover:text-rose-700 cursor-pointer shadow-2xs'
                                : 'border-slate-200 text-slate-300 cursor-not-allowed bg-slate-100'
                            }`}
                            title={
                              manualEntry.lineas.length > 2
                                ? `Eliminar cuenta "${line.cuentaNombre || line.cuentaCodigo}" (Línea ${idx + 1})`
                                : 'No se puede eliminar: el asiento contable requiere mínimo 2 cuentas para partida doble (Debe y Haber)'
                            }
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Sub-panel Analítico de Imputación (Auxiliares y Centros de Costos) */}
                        {(reqAux || reqCc) && (
                          <div className="mt-2.5 pt-2.5 border-t border-slate-200/80 grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
                            {/* Panel Auxiliar: RUT y Comprobante a Cancelar */}
                            {reqAux && (
                              <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-2.5 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-bold text-amber-900 flex items-center gap-1.5">
                                    <Users className="w-3.5 h-3.5 text-amber-700" />
                                    Detalle Auxiliar (Obligatorio) *
                                  </span>
                                  <span className="text-[9px] uppercase tracking-wider font-semibold text-amber-800 bg-amber-200/60 px-1.5 py-0.5 rounded">
                                    Mayor Auxiliar SII
                                  </span>
                                </div>

                                {/* Selección o digitación de Auxiliar */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                  <select
                                    value={line.rutAuxiliar || ''}
                                    onChange={(e) => {
                                      handleUpdateManualLine(idx, 'rutAuxiliar', e.target.value);
                                    }}
                                    className="w-full text-xs bg-white border border-amber-300 rounded-md p-1.5 text-slate-800 focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                                  >
                                    <option value="">-- Padrón de Auxiliares --</option>
                                    {availableAuxiliaries.map((aux) => (
                                      <option key={aux.rut} value={aux.rut}>
                                        {aux.rut} - {aux.razonSocial}
                                      </option>
                                    ))}
                                  </select>

                                  <input
                                    type="text"
                                    placeholder="O ingresar RUT (ej: 76.123.456-7)..."
                                    value={line.rutAuxiliar || ''}
                                    onChange={(e) => handleUpdateManualLine(idx, 'rutAuxiliar', e.target.value)}
                                    className="w-full text-xs bg-white border border-amber-300 rounded-md p-1.5 text-slate-800 focus:ring-1 focus:ring-amber-500 focus:outline-hidden font-mono"
                                  />
                                </div>

                                {/* Selección de Comprobante / DTE a Cancelar */}
                                <div>
                                  <label className="text-[10px] font-bold text-amber-900 block mb-1">
                                    Comprobante(s) a Cancelar / Documento de Respaldo:
                                  </label>
                                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5">
                                    <select
                                      value={line.dteIdAsociado || ''}
                                      onChange={(e) => {
                                        const dteId = e.target.value;
                                        if (!dteId) {
                                          handleUpdateManualLine(idx, 'dteIdAsociado', '');
                                          return;
                                        }
                                        const doc = safeDtes.find((d) => d.id === dteId);
                                        if (doc) {
                                          const updated = [...manualEntry.lineas];
                                          const isSupplier = updated[idx].cuentaCodigo.startsWith('2.1');
                                          updated[idx] = {
                                            ...updated[idx],
                                            dteIdAsociado: doc.id,
                                            rutAuxiliar: doc.rutContraparte,
                                            documentoRef: `Factura ${doc.tipoDte === '33' ? 'Electrónica' : ''} F.${doc.folio}`,
                                            debe: isSupplier ? (updated[idx].debe || doc.montoTotal) : updated[idx].debe,
                                            haber: !isSupplier ? (updated[idx].haber || doc.montoTotal) : updated[idx].haber,
                                          };
                                          setManualEntry((prev) => ({ ...prev, lineas: updated }));
                                        }
                                      }}
                                      className="flex-1 text-xs bg-white border border-amber-300 rounded-md p-1.5 text-slate-800 focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                                    >
                                      <option value="">-- Seleccionar Factura SII a Cancelar --</option>
                                      {safeDtes
                                        .filter((d) =>
                                          line.cuentaCodigo.startsWith('2.1')
                                            ? d.tipoOperacion === 'COMPRA'
                                            : d.tipoOperacion === 'VENTA'
                                        )
                                        .map((d) => (
                                          <option key={d.id} value={d.id}>
                                            Folio {d.folio} | {d.razonSocialContraparte} | {formatCLP(d.montoTotal)} ({d.estadoPago})
                                          </option>
                                        ))}
                                    </select>

                                    <input
                                      type="text"
                                      placeholder="Ref. documento manual..."
                                      value={line.documentoRef || ''}
                                      onChange={(e) => handleUpdateManualLine(idx, 'documentoRef', e.target.value)}
                                      className="w-full sm:w-44 text-xs bg-white border border-amber-300 rounded-md p-1.5 text-slate-800 focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                                    />
                                  </div>

                                  {line.dteIdAsociado && (
                                    <div className="mt-1 flex items-center gap-1.5 text-[10px] text-emerald-800 font-medium bg-emerald-50 border border-emerald-200 p-1.5 rounded">
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                      <span>
                                        Cancelando: <strong>{line.documentoRef}</strong>. El DTE quedará marcado como pagado y el auxiliar saldado.
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Panel Centro de Costos */}
                            {reqCc && (
                              <div className="bg-purple-50/70 border border-purple-200 rounded-lg p-2.5 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-bold text-purple-900 flex items-center gap-1.5">
                                    <PieChart className="w-3.5 h-3.5 text-purple-700" />
                                    Centro de Costos Requerido *
                                  </span>
                                  <span className="text-[9px] uppercase tracking-wider font-semibold text-purple-800 bg-purple-200/60 px-1.5 py-0.5 rounded">
                                    Contabilidad de Gestión
                                  </span>
                                </div>

                                <select
                                  value={line.centroCosto || ''}
                                  onChange={(e) => handleUpdateManualLine(idx, 'centroCosto', e.target.value)}
                                  className="w-full text-xs bg-white border border-purple-300 rounded-md p-1.5 text-slate-800 focus:ring-1 focus:ring-purple-500 focus:outline-hidden font-medium"
                                >
                                  <option value="">-- Seleccionar Centro de Costos --</option>
                                  {SEED_COST_CENTERS.map((cc) => (
                                    <option key={cc.id} value={cc.codigo}>
                                      {cc.codigo} - {cc.nombre} ({cc.categoria})
                                    </option>
                                  ))}
                                </select>
                                <p className="text-[10px] text-purple-700">
                                  Asigna la pérdida o ganancia a la unidad operativa correspondiente para el Estado de Resultados analítico.
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Balancing Checker */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
                <div className="font-mono flex items-center gap-3 flex-wrap">
                  <span>Debe: <strong className="text-slate-900">{formatCLP(manualDebe)}</strong></span>
                  <span className="text-slate-300">|</span>
                  <span>Haber: <strong className="text-slate-900">{formatCLP(manualHaber)}</strong></span>
                  <span className="text-slate-300">|</span>
                  <span
                    className={`px-2 py-0.5 rounded-full font-bold text-[11px] border ${
                      isManualBalanced
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                        : 'bg-rose-50 text-rose-700 border-rose-300'
                    }`}
                  >
                    {isManualBalanced ? 'CUADRADO EXACTO ($0)' : `DESCUADRE (${formatCLP(Math.abs(manualDiff))})`}
                  </span>
                </div>

                {/* Si la discrepancia es <= $2, botón de balance automático de centavos */}
                {!isManualBalanced && Math.abs(manualDiff) <= 2 && (
                  <button
                    type="button"
                    onClick={handleAutoBalanceCentavos}
                    className="bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 px-3 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-colors"
                  >
                    Ajustar Centavos / Redondeo ($1)
                  </button>
                )}
              </div>

              {/* Botonera de acciones */}
              <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setManualEntry(getInitialManualEntry());
                    setManualEntryError(null);
                    showToast('Formulario restablecido a valores iniciales.', 'info');
                  }}
                  className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer"
                >
                  Limpiar / Restablecer
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowManualModal(false);
                      setManualEntryError(null);
                    }}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={!isManualBalanced || isSavingManual}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold cursor-pointer shadow-sm transition-colors flex items-center gap-2"
                  >
                    {isSavingManual && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>{isSavingManual ? 'Validando y Registrando...' : 'Guardar Asiento Contable'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREAR / EDITAR CUENTA O SUBCUENTA CONTABLE */}
      <AccountEditModal
        isOpen={accountModalOpen}
        onClose={() => {
          setAccountModalOpen(false);
          setAccountToEdit(null);
          setSubaccountParentCode(undefined);
        }}
        onSave={handleSaveAccount}
        accountToEdit={accountToEdit}
        parentAccountCode={subaccountParentCode}
        existingAccounts={chartOfAccounts}
        groups={chartGroups}
      />

      {/* MODAL: GESTOR DE GRUPOS Y SUBGRUPOS */}
      <GroupManagerModal
        isOpen={groupModalOpen}
        onClose={() => setGroupModalOpen(false)}
        groups={chartGroups}
        onSaveGroups={handleSaveGroups}
      />

      {/* MODAL: IMPORTAR / EXPORTAR PLAN DE CUENTAS */}
      <ImportExportChartModal
        isOpen={importExportModalOpen}
        onClose={() => setImportExportModalOpen(false)}
        accounts={chartOfAccounts}
        company={company}
        onImport={handleImportChart}
      />

      {/* MODAL: EDITAR / PERSONALIZAR CIFRAS REALES DEL AJUSTE DE CIERRE */}
      {editingAdjustment && (
        <EditClosingAdjustmentModal
          isOpen={!!editingAdjustment}
          adjustment={editingAdjustment}
          onClose={() => setEditingAdjustment(null)}
          onSave={(updatedAdj) => {
            setClosingAdjustments(prev =>
              prev.map(a => (a.id === updatedAdj.id ? updatedAdj : a))
            );
            showToast(`Ajuste "${updatedAdj.titulo}" actualizado con cifras personalizadas.`, 'success');
          }}
        />
      )}
    </div>
  );
};
