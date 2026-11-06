import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { loadClientState, saveClientState } from '../utils/storageService';
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
  ShieldAlert,
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
  CreditCard,
  ArrowLeftRight,
  Coins,
  RotateCcw,
  Briefcase,
  Link2,
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
  FinancialStatementNote,
  ExpenseReport,
  TipoDocumentoRespaldo,
} from '../types';
import { generateExpenseAccountingEntry } from '../utils/expenseManagementAgent';
import { expenseApiService } from '../services/expenseApiService';
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
  downloadFinancialNotesBookletPdf,
  downloadLibroAuxiliarPdf,
  downloadLibroAuxiliarExcel,
  downloadLibroAuxiliarCsv,
  type AuxiliaryBookReportConfig,
  type AuxiliaryDetailedMovement,
  type AuxiliaryLegalSummaryItem,
  type AuxiliaryRangedSummaryRow,
  type AuxiliaryBookReportPayload,
} from '../utils/reportGenerators';
import { getStoredAuthToken } from '../services/apiClient';
import {
  CHILE_HIERARCHICAL_CHART_OF_ACCOUNTS,
  buildOfficial8ColumnBalance,
  buildIFRSFinancialStatements,
  auditPeripheralModules,
  generatePeriodClosingAdjustments,
  validateAndBalanceEntry,
  buildTransactionalAccountingProposalJSON,
  findAccountInChart,
  isAccountCostCenterRequired as checkIsAccountCostCenterRequired,
  validateEntryFiscalPeriod,
  getFiscalYearDates,
  getDefaultAccountingDate,
} from '../utils/accountingOrchestratorEngine';
import { FiscalYearClosingModule } from './FiscalYearClosingModule';
import {
  loadCompanyChartOfAccounts,
  saveCompanyChartOfAccounts,
  loadCompanyGroups,
  saveCompanyGroups,
  resetCompanyChartToDefault,
  buildGroupedBalanceReport,
  normalizeAccountCodeKey,
  fetchCompanyChartOfAccounts,
} from '../utils/companyChartOfAccountsService';
import {
  loadCompanyAuxiliaries,
  saveCompanyAuxiliaries,
  saveSingleCompanyAuxiliary,
  fetchCompanyAuxiliaries,
} from '../utils/companyAuxiliariesService';
import { AccountEditModal } from './accounting/AccountEditModal';
import { CreateProjectModal } from './accounting/CreateProjectModal';
import { ProjectManagerModal } from './accounting/ProjectManagerModal';
import { loadCompanyProjects, saveCompanyProjects } from '../utils/companyProjectsService';
import type { ExpenseProject } from '../types';
import { GroupManagerModal } from './accounting/GroupManagerModal';
import { ImportExportChartModal } from './accounting/ImportExportChartModal';
import { MassJournalEntryImportModal } from './accounting/MassJournalEntryImportModal';
import { GroupedBalanceView } from './accounting/GroupedBalanceView';
import { seedF29 } from '../data/seedData';
import { AccountingEventAssistant } from './accounting/AccountingEventAssistant';
import { EditClosingAdjustmentModal } from './accounting/EditClosingAdjustmentModal';
import { CashFlowIndirectView } from './accounting/CashFlowIndirectView';
import { SearchableAccountSelect } from './accounting/SearchableAccountSelect';
import { SearchableAuxiliarySelect, type AuxiliaryOption } from './accounting/SearchableAuxiliarySelect';
import { AuxiliaryManagerModal } from './accounting/AuxiliaryManagerModal';
import { ModuleAgentGovernanceHeader } from './governance/ModuleAgentGovernanceHeader';
import { ExtraordinaryFiscalYearReopenModal } from './accounting/ExtraordinaryFiscalYearReopenModal';
import { EditAccountingEntryModal } from './accounting/EditAccountingEntryModal';
import { SEED_COST_CENTERS } from '../data/seedCostCenters';
import { INITIAL_CLIENT_AUXILIARIES } from '../data/seedClientAuxiliaries';
import { FinancialStatementNotesView } from './accounting/FinancialStatementNotesView';
import {
  loadCompanyFinancialNotes,
  saveCompanyFinancialNotes,
  syncChartWithNotes,
} from '../utils/financialNotesService';
import { CurrencyManagerModal } from './accounting/CurrencyManagerModal';
import {
  getExchangeRateForDate,
  resolveAccountCurrency,
  formatCurrencyAmount,
  getAvailableCurrencies,
} from '../services/currencyService';

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
  onUpdateEntry?: (id: string, payload: any) => Promise<any>;
  onDeleteEntry?: (id: string, motivo?: string) => Promise<any>;
  onReverseEntry?: (id: string, motivo?: string, fecha?: string) => Promise<any>;
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
  expenseReports?: ExpenseReport[];
}

export const SeniorAccountingOrchestrator: React.FC<SeniorAccountingOrchestratorProps> = ({
  company,
  onUpdateCompany = (_updated?: Partial<CompanyProfile>) => {},
  firm,
  indicators,
  entries = [],
  onAddEntry,
  commitEntry,
  onUpdateEntry,
  onDeleteEntry,
  onReverseEntry,
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
  expenseReports = [],
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
  const safeExpenseReports = Array.isArray(expenseReports) ? expenseReports : [];

  // Configuración de Períodos y Perfil Efectivo de la Empresa
  const effectivePeriodos = useMemo(
    () => company?.periodosCerrados || ['2026-01', '2026-02'],
    [company?.periodosCerrados]
  );
  const effectiveCompany: CompanyProfile = useMemo(
    () => ({
      ...company,
      periodosCerrados: effectivePeriodos,
      bloqueoPeriodoCerrado: company?.bloqueoPeriodoCerrado !== false,
    }),
    [company, effectivePeriodos]
  );
  const dates = useMemo(() => getFiscalYearDates(effectiveCompany), [effectiveCompany]);

  // Navigation tabs of the orchestrator
  const [activeTab, setActiveTab] = useState<'AUDIT' | 'DIARIO' | 'MAYOR' | 'AUXILIARES' | 'PLAN_CUENTAS' | 'BALANCE_8COL' | 'FLUJO_EFECTIVO' | 'IFRS' | 'NOTAS_EEFF' | 'AI_ROUTING' | 'EJERCICIO_CIERRE'>('AUDIT');
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
  const [auxiliarViewMode, setAuxiliarViewMode] = useState<'RESUMEN_RUT' | 'DETALLADO_FECHAS' | 'LIBRO_SEGUN_LEY'>('RESUMEN_RUT');
  const [auxiliarDateFrom, setAuxiliarDateFrom] = useState<string>(() => dates.startDate || '2026-01-01');
  const [auxiliarDateTo, setAuxiliarDateTo] = useState<string>(() => dates.endDate || '2026-12-31');
  const [showAuxReportCustomizer, setShowAuxReportCustomizer] = useState<boolean>(false);
  const [auxReportConfig, setAuxReportConfig] = useState<AuxiliaryBookReportConfig>(() => ({
    bookScope: 'PROVEEDORES',
    reportMode: 'LIBRO_SEGUN_LEY',
    fechaDesde: dates.startDate || '2026-01-01',
    fechaHasta: dates.endDate || '2026-12-31',
    selectedRut: null,
    customTitle: '',
    folioInicial: 101,
    orientation: 'landscape',
    sortBy: 'FECHA_ASC',
    includeZeroBalance: true,
    includeLegalSummary: true,
    includeSignatures: true,
    observacionesAuditoria:
      'Libro Auxiliar electrónico emitido conforme al Art. 25 del Código de Comercio, Art. 59 del D.L. 825 y Resoluciones Exentas SII N° 45 y N° 61. Cuadrado íntegramente con el Libro Mayor y RCV SII.',
    columns: {
      correlativo: true,
      fecha: true,
      tipoDocSii: true,
      folioDoc: true,
      fechaVencimiento: true,
      rutAuxiliar: true,
      razonSocial: true,
      cuentaContable: true,
      glosaConcepto: true,
      desgloseIva: true,
      debeHaber: true,
      saldoProgresivo: true,
      trazabilidadBancaria: true,
      centroCosto: false,
    },
  }));

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

  // Notas a los Estados Financieros (NIIF / IFRS - CMF Chile)
  const [financialNotes, setFinancialNotes] = useState<FinancialStatementNote[]>(() =>
    loadCompanyFinancialNotes(company.rut, chartOfAccounts)
  );
  const [selectedNoteNumber, setSelectedNoteNumber] = useState<number | null>(null);

  // Centros de Proyectos / Obras vigentes (WIP / IFRS / Art. 31)
  const [availableProjects, setAvailableProjects] = useState<ExpenseProject[]>(() =>
    loadCompanyProjects(company.rut || 'default')
  );
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState(false);
  const [isProjectManagerModalOpen, setIsProjectManagerModalOpen] = useState(false);
  const [activeProjectLineIdx, setActiveProjectLineIdx] = useState<number | null>(null);

  // Sincronizar plan de cuentas, grupos, notas y proyectos al cambiar de empresa (Multi-Tenant & Multi-Usuario)
  React.useEffect(() => {
    const loadedChart = loadCompanyChartOfAccounts(company.rut);
    setChartOfAccounts(loadedChart);
    setChartGroups(loadCompanyGroups(company.rut));
    setFinancialNotes(loadCompanyFinancialNotes(company.rut, loadedChart));
    setAvailableProjects(loadCompanyProjects(company.rut || 'default'));

    let isMounted = true;

    // Cargar proyectos vigentes de la empresa desde MySQL / Servidor
    expenseApiService.getExpenseProjects(company.rut).then((prys) => {
      if (isMounted && Array.isArray(prys) && prys.length > 0) {
        setAvailableProjects(prys);
        saveCompanyProjects(company.rut || 'default', prys);
      }
    }).catch(() => {});

    // Sincronizar asíncronamente el Plan de Cuentas desde el servidor para reflejar cambios del contador o entre usuarios
    fetchCompanyChartOfAccounts(company.rut).then((remoteChart) => {
      if (isMounted && remoteChart && Array.isArray(remoteChart) && remoteChart.length > 0) {
        setChartOfAccounts(remoteChart);
      }
    }).catch(() => {});

    // Escuchar actualizaciones de plan de cuentas despachadas en la misma ventana u otras pestañas
    const handleChartUpdated = (e: any) => {
      if (e?.detail?.empresaRut === company.rut && Array.isArray(e?.detail?.chart)) {
        setChartOfAccounts(e.detail.chart);
      } else {
        const fresh = loadCompanyChartOfAccounts(company.rut);
        setChartOfAccounts(fresh);
      }
    };

    const handleWindowFocus = () => {
      fetchCompanyChartOfAccounts(company.rut).then((remoteChart) => {
        if (isMounted && remoteChart && Array.isArray(remoteChart) && remoteChart.length > 0) {
          setChartOfAccounts(remoteChart);
        }
      }).catch(() => {});
    };

    window.addEventListener('companyChartUpdated', handleChartUpdated);
    window.addEventListener('storage', handleChartUpdated);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      isMounted = false;
      window.removeEventListener('companyChartUpdated', handleChartUpdated);
      window.removeEventListener('storage', handleChartUpdated);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [company.rut]);

  // Actualizar notas y sincronizar con plan de cuentas
  const handleUpdateFinancialNotes = (updatedNotes: FinancialStatementNote[]) => {
    setFinancialNotes(updatedNotes);
    saveCompanyFinancialNotes(company.rut, updatedNotes);
    const { syncedChart } = syncChartWithNotes(chartOfAccounts, updatedNotes);
    setChartOfAccounts(syncedChart);
    saveCompanyChartOfAccounts(company.rut, syncedChart);
  };

  // Actualizar plan de cuentas y sincronizar con notas
  const handleUpdateChartAndSyncNotes = (updatedChart: HierarchicalAccountItem[]) => {
    setChartOfAccounts(updatedChart);
    saveCompanyChartOfAccounts(company.rut, updatedChart);
    const { syncedNotes } = syncChartWithNotes(updatedChart, financialNotes);
    setFinancialNotes(syncedNotes);
    saveCompanyFinancialNotes(company.rut, syncedNotes);
  };

  // Navegar directamente a una nota específica desde cualquier módulo
  const navigateToNote = (noteNum: number) => {
    setSelectedNoteNumber(noteNum);
    setActiveTab('NOTAS_EEFF');
  };

  // Helper para obtener los botones / badges de notas de una cuenta
  const getAccountNoteBadges = (accountCode?: string) => {
    if (!accountCode) return null;
    const acc = chartOfAccounts.find((a) => a.codigo === accountCode);
    const explicitNotes = acc?.notasExplicativas || [];
    const notesFromList = financialNotes
      .filter((n) => n.cuentasAsociadas.includes(accountCode))
      .map((n) => n.numero);
    const merged = Array.from(new Set([...explicitNotes, ...notesFromList])).sort((a, b) => a - b);

    if (merged.length === 0) return null;

    return (
      <div className="inline-flex items-center gap-1 shrink-0 ml-1">
        {merged.map((num) => (
          <button
            key={num}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              navigateToNote(num);
            }}
            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[9px] font-mono font-bold px-1.5 py-0.2 rounded transition-colors cursor-pointer"
            title={`Ver Nota ${num} en detalle`}
          >
            Nota {num}
          </button>
        ))}
      </div>
    );
  };

  // Modales de Plan de Cuentas
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [accountToEdit, setAccountToEdit] = useState<HierarchicalAccountItem | null>(null);
  const [subaccountParentCode, setSubaccountParentCode] = useState<string | undefined>(undefined);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [importExportModalOpen, setImportExportModalOpen] = useState(false);
  const [isMassImportModalOpen, setIsMassImportModalOpen] = useState(false);

  // Modal de Edición de Asientos del Libro Diario
  const [editingEntry, setEditingEntry] = useState<AccountingEntry | null>(null);
  const [isEditEntryModalOpen, setIsEditEntryModalOpen] = useState(false);

  // Modo de agrupación de Balance (Tradicional CMF, Fiscal SII, Casa Matriz HQ, Personalizado)
  const [balanceGroupingMode, setBalanceGroupingMode] = useState<BalanceGroupingMode>('TRADICIONAL_CMF');
  const [isGroupedView, setIsGroupedView] = useState<boolean>(true);

  // Helper para inicializar un asiento manual limpio con fecha contable del día o período abierto
  const getInitialManualEntry = useCallback(() => ({
    fecha: getDefaultAccountingDate(effectiveCompany),
    concepto: '',
    documentoReferencia: '',
    tipoDocumentoRef: undefined as TipoDocumentoRespaldo | undefined,
    origen: 'MANUAL' as AccountingEntry['origen'],
    lineas: [
      {
        cuentaCodigo: '1.1.02.001',
        cuentaNombre: 'Banco Santander Chile Cta Cte M/N',
        debe: 0,
        haber: 0,
        rutAuxiliar: '',
        nombreAuxiliar: '',
        centroCosto: '',
        proyecto: '',
        documentoRef: '',
        dteIdAsociado: '',
        tipoDocumentoRef: undefined,
        folioDocumentoRef: '',
        montoDocumentoRef: undefined as number | undefined,
        documentoOperacion: '',
        tipoDocumentoOperacion: '',
        documentoConciliacion: '',
        tipoDocumentoConciliacion: '',
      },
      {
        cuentaCodigo: '2.1.01.001',
        cuentaNombre: 'Proveedores Nacionales (Cuentas por Pagar)',
        debe: 0,
        haber: 0,
        rutAuxiliar: '',
        nombreAuxiliar: '',
        centroCosto: '',
        proyecto: '',
        documentoRef: '',
        dteIdAsociado: '',
        tipoDocumentoRef: undefined,
        folioDocumentoRef: '',
        montoDocumentoRef: undefined as number | undefined,
        documentoOperacion: '',
        tipoDocumentoOperacion: '',
        documentoConciliacion: '',
        tipoDocumentoConciliacion: '',
      },
    ],
  }), [effectiveCompany]);

  // Modal for Manual Entry
  const [showManualModal, setShowManualModal] = useState<boolean>(false);
  const [manualEntry, setManualEntry] = useState(getInitialManualEntry());
  const [manualEntryError, setManualEntryError] = useState<string | null>(null);
  const [isSavingManual, setIsSavingManual] = useState<boolean>(false);
  const [showReopenModal, setShowReopenModal] = useState<boolean>(false);

  // Auxiliares personalizados guardados en caliente y sincronizados Multi-Usuario / Multi-Tenant
  const [customAuxiliaries, setCustomAuxiliaries] = useState<any[]>(() => {
    return loadCompanyAuxiliaries(company?.rut || 'default');
  });

  useEffect(() => {
    const targetRut = effectiveCompany?.rut || company?.rut || 'default';
    setCustomAuxiliaries(loadCompanyAuxiliaries(targetRut));
    if (effectiveCompany?.rut) {
      setManualEntry(getInitialManualEntry());
    }

    let isMounted = true;
    fetchCompanyAuxiliaries(targetRut).then((remoteAuxs) => {
      if (isMounted && Array.isArray(remoteAuxs) && remoteAuxs.length > 0) {
        setCustomAuxiliaries(remoteAuxs);
      }
    }).catch(() => {});

    const handleAuxUpdated = (e: any) => {
      if (e?.detail?.empresaRut === targetRut && Array.isArray(e?.detail?.auxiliaries)) {
        setCustomAuxiliaries(e.detail.auxiliaries);
      } else {
        setCustomAuxiliaries(loadCompanyAuxiliaries(targetRut));
      }
    };

    const handleWindowFocus = () => {
      fetchCompanyAuxiliaries(targetRut).then((remoteAuxs) => {
        if (isMounted && Array.isArray(remoteAuxs) && remoteAuxs.length > 0) {
          setCustomAuxiliaries(remoteAuxs);
        }
      }).catch(() => {});
    };

    window.addEventListener('companyAuxiliariesUpdated', handleAuxUpdated);
    window.addEventListener('storage', handleAuxUpdated);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      isMounted = false;
      window.removeEventListener('companyAuxiliariesUpdated', handleAuxUpdated);
      window.removeEventListener('storage', handleAuxUpdated);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [effectiveCompany?.rut, company?.rut, getInitialManualEntry]);

  const handleAddNewAuxiliary = (newAux: any) => {
    const targetRut = effectiveCompany?.rut || company?.rut || 'default';
    setCustomAuxiliaries((prev) => {
      const cleanNew = (newAux.rut || newAux.rutCompleto || '').trim().toUpperCase();
      const exists = prev.some((a) => (a.rut || a.rutCompleto || '').trim().toUpperCase() === cleanNew);
      const next = exists
        ? prev.map((a) => ((a.rut || a.rutCompleto || '').trim().toUpperCase() === cleanNew ? { ...a, ...newAux } : a))
        : [newAux, ...prev];
      saveCompanyAuxiliaries(targetRut, next);
      return next;
    });
    saveSingleCompanyAuxiliary(targetRut, newAux);
    showToast(`Auxiliar "${newAux.razonSocial || newAux.rut}" incorporado con éxito al padrón auxiliar de la empresa.`, 'success');
  };

  // Gestor y ABM Maestro de Auxiliares (Padrón ERP)
  const [isAuxiliaryManagerModalOpen, setIsAuxiliaryManagerModalOpen] = useState<boolean>(false);
  const [auxiliaryManagerFilter, setAuxiliaryManagerFilter] = useState<'ALL' | 'CLIENTE' | 'PROVEEDOR'>('ALL');

  const handleSaveAuxiliaryFromManager = (aux: any, allUpdatedList?: any[]) => {
    const targetRut = effectiveCompany?.rut || company?.rut || 'default';
    if (allUpdatedList) {
      setCustomAuxiliaries(allUpdatedList);
      saveCompanyAuxiliaries(targetRut, allUpdatedList);
    } else {
      handleAddNewAuxiliary(aux);
    }
  };

  // Manejo de Reapertura Extraordinaria Justificada desde el formulario de asiento
  const handleConfirmReopenFromModal = ({
    ejercicio,
    motivoLegal,
    usuario,
    resolucionSii,
  }: {
    ejercicio: number;
    motivoLegal: string;
    usuario: string;
    resolucionSii?: string;
  }) => {
    const currentClosed =
      effectiveCompany.ejerciciosCerrados && effectiveCompany.ejerciciosCerrados.length > 0
        ? effectiveCompany.ejerciciosCerrados
        : [dates.ejercicioActivo - 2, dates.ejercicioActivo - 1];
    const newClosed = currentClosed.filter((y) => y !== ejercicio);
    const auditEntry = {
      id: `reopen-${ejercicio}-${Date.now()}`,
      fecha: new Date().toISOString().substring(0, 10),
      ejercicio,
      usuario,
      motivoLegal,
      resolucionSii,
      timestamp: new Date().toISOString(),
    };
    const updatedAudit = [auditEntry, ...(effectiveCompany.auditoriaReaperturas || [])];

    if (onUpdateCompany) {
      onUpdateCompany({
        ejerciciosCerrados: newClosed,
        auditoriaReaperturas: updatedAudit,
        reaperturaExtraordinariaActiva: {
          ejercicio,
          fechaReapertura: new Date().toISOString().substring(0, 10),
          motivoLegal,
          usuario,
          resolucionSii,
        },
      });
    }

    setManualEntryError(null);
    showToast(
      `Ejercicio fiscal ${ejercicio} reabierto extraordinariamente con registro de auditoría. Ya puede registrar el asiento de ajuste legal.`,
      'info'
    );
  };

  // Modal de confirmación para reapertura de período mensual cerrado
  const [periodReopenModal, setPeriodReopenModal] = useState<{
    isOpen: boolean;
    periodo: string;
    fecha: string;
    ejercicio: number;
    onConfirm: () => Promise<void>;
  } | null>(null);

  // Modal Multimoneda, Histórico de Tipos de Cambio y Agente NIC 21
  const [isCurrencyModalOpen, setIsCurrencyModalOpen] = useState<boolean>(false);

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

  // Manejadores de Edición, Eliminación y Reversión de Asientos del Libro Diario
  const handleOpenEditEntry = (entry: AccountingEntry) => {
    setEditingEntry(entry);
    setIsEditEntryModalOpen(true);
  };

  const handleSaveEditedEntry = async (id: string, payload: any) => {
    try {
      if (onUpdateEntry) {
        await onUpdateEntry(id, payload);
      }
      showToast('Asiento contable actualizado exitosamente con respaldo de auditoría.', 'success');
      if (refetchLedger) {
        await refetchLedger();
      }
    } catch (err: any) {
      showToast(err.message || 'Error al actualizar asiento contable.', 'error');
      throw err;
    }
  };

  const handleDeleteEntryConfirm = async (entry: AccountingEntry) => {
    const confirmMsg = `¿Está seguro de eliminar el comprobante [${entry.documento || entry.id}]?\n\nConcepto: "${entry.concepto}"\nTotal: $${formatCLP(entry.totalDebe)}\n\nEsta acción registrará un evento de auditoría del comprobante suprimido.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      if (onDeleteEntry) {
        await onDeleteEntry(entry.id, 'Eliminación manual por corrección de usuario');
      }
      showToast(`Comprobante [${entry.documento || entry.id}] eliminado del Libro Diario.`, 'success');
      if (refetchLedger) {
        await refetchLedger();
      }
    } catch (err: any) {
      showToast(err.message || 'Error al eliminar asiento contable.', 'error');
    }
  };

  const handleReverseEntryConfirm = async (entry: AccountingEntry) => {
    const confirmMsg = `¿Desea generar un contra-asiento de anulación / reversión para el comprobante [${entry.documento || entry.id}]?\n\nSe creará un nuevo comprobante invirtiendo el Debe y Haber para anular su efecto contable manteniendo la trazabilidad histórica IFRS.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      if (onReverseEntry) {
        await onReverseEntry(entry.id, 'Anulación voluntaria de comprobante');
      }
      showToast(`Contra-asiento de reversión registrado con éxito en el Libro Diario.`, 'success');
      if (refetchLedger) {
        await refetchLedger();
      }
    } catch (err: any) {
      showToast(err.message || 'Error al revertir asiento contable.', 'error');
    }
  };

  // Period Closing Adjustments
  const [closingAdjustments, setClosingAdjustments] = useState<PeriodClosingAdjustment[]>(() =>
    generatePeriodClosingAdjustments(indicators, company, leases, safeExpenseReports, safeEntries)
  );
  const [editingAdjustment, setEditingAdjustment] = useState<PeriodClosingAdjustment | null>(null);

  // Mantener sincronizados los ajustes propuestos en tiempo real
  React.useEffect(() => {
    setClosingAdjustments(generatePeriodClosingAdjustments(indicators, company, leases, safeExpenseReports, safeEntries));
  }, [indicators, company, leases, safeExpenseReports, safeEntries]);

  // Formatter helper for canonical text adjustment voucher
  const getFormattedAdjustmentVoucher = (adj: PeriodClosingAdjustment): string => {
    const sumDebe = adj.asientoPropuesto.lineas.reduce((s, l) => s + (l.debe || 0), 0);
    const sumHaber = adj.asientoPropuesto.lineas.reduce((s, l) => s + (l.haber || 0), 0);
    const mockEntry: AccountingEntry = {
      id: adj.id,
      fecha: getDefaultAccountingDate(effectiveCompany),
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
      safeBenefits,
      safeExpenseReports
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
    safeExpenseReports,
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
    context?: { agenteNombre?: string; accion?: string; modelName?: string; payloadInput?: any; overridePeriodos?: string[] }
  ) => {
    // Validación estricta de ejercicio fiscal y períodos bloqueados (Art. 16 Código Tributario)
    const basePeriodos = context?.overridePeriodos || company.periodosCerrados || [];
    let currentPeriodos = [...basePeriodos];
    const companyToCheck: CompanyProfile = {
      ...company,
      periodosCerrados: currentPeriodos,
      bloqueoPeriodoCerrado: company.bloqueoPeriodoCerrado !== false,
    };

    const periodCheck = validateEntryFiscalPeriod(entry.fecha, companyToCheck);
    if (!periodCheck.permitido) {
      if (periodCheck.codigoError === 'PERIODO_CERRADO') {
        const periodo = entry.fecha.substring(0, 7);
        const confirmReopen = window.confirm(
          `CONTROL CONTABLE TRIBUTARIO (SII):\n\nEl período mensual ${periodo} se encuentra cerrado y bloqueado, aunque el ejercicio fiscal está abierto.\n\n¿Desea reabrir el período mensual ${periodo} para permitir el registro y centralización de este comprobante en el Libro Diario?`
        );
        if (confirmReopen) {
          currentPeriodos = currentPeriodos.filter(p => p !== periodo);
          onUpdateCompany({ periodosCerrados: currentPeriodos });
          showToast(`Período mensual ${periodo} reabierto con éxito por el Contador Auditor.`, 'info');
        } else {
          const msg = `BLOQUEO FISCAL: ${periodCheck.motivo}. ${periodCheck.sugerencia || ''}`;
          showToast(msg, 'error');
          throw new Error(msg);
        }
      } else {
        const msg = `BLOQUEO FISCAL: ${periodCheck.motivo}. ${periodCheck.sugerencia || ''}`;
        showToast(msg, 'error');
        throw new Error(msg);
      }
    }

    const companyToCommit: CompanyProfile = {
      ...company,
      periodosCerrados: currentPeriodos,
      bloqueoPeriodoCerrado: company.bloqueoPeriodoCerrado !== false,
    };

    if (commitEntry) {
      try {
        await commitEntry(entry, {
          agenteNombre: context?.agenteNombre || 'AGENTE_ORQUESTADOR_SENIOR',
          accion: context?.accion || `ASIENTO_${entry.origen}`,
          modelName: context?.modelName,
          payloadInput: context?.payloadInput,
          companyConfig: companyToCommit,
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
      const totalDepreciacion = safeFixedAssets.reduce((s, a) => s + (Number(a.depreciacionAcumulada) || 0), 0);
      // 4.4: sin depreciación registrada no se centraliza nada (antes $185.000 por bien supuestos)
      if (totalDepreciacion <= 0) {
        alert('No hay depreciación calculada en el módulo de Activo Fijo para centralizar.');
        return;
      }
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
      const totalCostoOP = safeProductionOrders.reduce((s, op) => s + (Number(op.costoTotalReal) || 0), 0);
      // 4.4: sin costo real de las órdenes no se activa nada (antes $850.000 por OP supuestos)
      if (totalCostoOP <= 0) {
        alert('Las órdenes de producción no tienen costo real registrado para activar.');
        return;
      }
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
    } else if (modulo === 'RENDICION_GASTOS') {
      const pendingReports = safeExpenseReports.filter(r => {
        if (r.estado === 'CONTABILIZADA_PAGADA' || (r as any).asientoContableId) return false;
        const isBooked = safeEntries.some(e => {
          const doc = (e.documento || '').toLowerCase();
          const conc = (e.concepto || '').toLowerCase();
          const folio = (r.folio || '').toLowerCase();
          const id = (r.id || '').toLowerCase();
          return (folio && (doc.includes(folio) || conc.includes(folio))) ||
                 (id && (e.id.includes(id) || doc.includes(id)));
        });
        return !isBooked;
      });

      const reportsToCentralize = pendingReports.length > 0 ? pendingReports : safeExpenseReports.filter(r => r.montoTotalRendidoClp > 0 || r.fondoAsignadoClp > 0);

      if (reportsToCentralize.length === 0) {
        showToast('No hay rendiciones de gastos pendientes de centralizar.', 'info');
        return;
      }

      let count = 0;
      for (const rep of reportsToCentralize) {
        const entry = generateExpenseAccountingEntry(rep, rep.comprobantes || [], chartOfAccounts);
        dispatchEntry(entry, { agenteNombre: 'AGENTE_RINDE_GASTOS', accion: 'CENTRALIZACION_RENDICION_GASTOS' });
        try {
          expenseApiService.contabilizarReport(rep.id);
        } catch (e) {
          console.warn('[SeniorAccountingOrchestrator] Error al marcar rendición como contabilizada:', e);
        }
        count++;
      }

      showToast(`✓ ${count} Rendición(es) de gastos centralizada(s) exitosamente en el Libro Diario.`, 'success');
    }
  };

  // Handle Apply Period Closing Adjustment
  const handleApplyAdjustment = (adj: PeriodClosingAdjustment) => {
    const today = getDefaultAccountingDate(effectiveCompany);
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

    if (adj.id.includes('rdg')) {
      safeExpenseReports.forEach(r => {
        try {
          expenseApiService.contabilizarReport(r.id);
        } catch (e) {
          // ignore
        }
      });
    }

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
      const authToken = getStoredAuthToken();
      // Invocar motor agéntico real con bucle ReAct y Function Calling
      const response = await fetch('/api/agents/autonomous/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          module: 'CONTABILIDAD',
          modulo: 'CONTABILIDAD',
          empresaId: company.rut || company.id,
          query: `Formular e imputar asiento contable para: "${rawGlosaInput}" por monto $${rawMontoInput.toLocaleString('es-CL')}. Aplicar partida doble estricta y plan de cuentas chileno.`,
          prompt: rawGlosaInput,
          context: {
            empresa: company,
            monto: rawMontoInput,
            rawGlosa: rawGlosaInput,
            indicators,
          },
          contextData: {
            empresa: company,
            monto: rawMontoInput,
            rawGlosa: rawGlosaInput,
            indicators,
          },
        }),
      });

      const resJson = await response.json();
      const aiText = resJson.finalText || resJson.text || '';
      const technicalPayload = resJson.technicalPayload || resJson.data?.technicalPayload;

      let extractedJSON: AccountingProposalResponse | null = null;
      if (technicalPayload && technicalPayload.lineas && technicalPayload.lineas.length > 0) {
        extractedJSON = {
          empresa_id: company.rut || company.id || '',
          accion: 'propuesta_asiento',
          origen_modulo: 'MANUAL',
          periodo: new Date().toISOString().slice(0, 7),
          asiento: {
            fecha: technicalPayload.fecha || new Date().toISOString().split('T')[0],
            tipo_comprobante: 'TRASPASO',
            glosa_general: technicalPayload.glosa || technicalPayload.concepto || rawGlosaInput,
            cuadre_valido: true,
            total_debe: technicalPayload.totalDebe || rawMontoInput,
            total_haber: technicalPayload.totalHaber || rawMontoInput,
            lineas: technicalPayload.lineas.map((l: any) => ({
              codigo_cuenta: l.cuentaCodigo || l.codigoCuenta || '6.1.04.006',
              nombre_cuenta: l.cuentaNombre || l.nombreCuenta || 'Gastos Operacionales',
              debe: Number(l.debe) || 0,
              haber: Number(l.haber) || 0,
              glosa_detalle: l.glosa || rawGlosaInput,
              rut_auxiliar: l.rutAuxiliar || '',
            })),
          },
          alertas_auditoria: resJson.steps ? resJson.steps.map((s: any) => s.thought).filter(Boolean) : ['Asiento generado por Agente Autónomo Especialista en Contabilidad.'],
        };
      } else {
        // Extract JSON if present in text
        try {
          const match = aiText.match(/```json\s*([\s\S]*?)\s*```/);
          if (match && match[1]) {
            extractedJSON = JSON.parse(match[1]);
          }
        } catch (err) {
          console.warn('Failed to parse AI JSON:', err);
        }
      }

      if (!extractedJSON) {
        showToast('El agente autónomo no generó una propuesta contable válida o estructurada para esta operación.', 'info');
        setAiProposalResponse({
          humanLayer: aiText.replace(/```json[\s\S]*?```/, '').trim() ||
            `El agente contable procesó la consulta para "${rawGlosaInput}", pero no formuló una propuesta contable estructurada. Por favor proporcione más detalles de la operación.`,
          transactionalLayer: null,
        });
        return;
      }

      setAiProposalResponse({
        humanLayer: aiText.replace(/```json[\s\S]*?```/, '').trim() ||
          `Como Agente Orquestador Contable y Financiero Senior, he determinado la imputación para "${rawGlosaInput}". Se validó la partida doble y la consistencia técnica de las cuentas.`,
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
    const norm = normalizeAccountCodeKey(account.codigo);
    const existingIndex = chartOfAccounts.findIndex(
      (a) => a.codigo === account.codigo || (norm && normalizeAccountCodeKey(a.codigo) === norm)
    );
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

  // Importación y registro masivo de asientos contables (Migración de sistemas)
  const handleMassCommitEntries = async (importedEntries: AccountingEntry[]) => {
    let successCount = 0;
    let failedCount = 0;
    for (const entry of importedEntries) {
      try {
        await dispatchEntry(entry, {
          agenteNombre: 'MIGRACION_MASIVA_SISTEMAS',
          accion: 'ASIENTO_MIGRACION_HISTORICA',
          payloadInput: { totalLineas: entry.lineas?.length, glosa: entry.glosa, numero: entry.numero },
        });
        successCount++;
      } catch (err) {
        failedCount++;
        console.error('[MassImport] Error registrando asiento migrado:', entry.numero, err);
      }
    }
    if (refetchLedger) {
      try {
        await refetchLedger();
      } catch {
        // Refetch silencioso
      }
    }
    if (failedCount === 0) {
      showToast(`Migración masiva completada: ${successCount} asientos registrados con éxito en el Libro Diario.`, 'success');
    } else {
      showToast(`Migración masiva parcial: ${successCount} registrados, ${failedCount} con error o período bloqueado.`, 'info');
    }
  };

  // Filtered Chart of Accounts
  const filteredPlan = useMemo(() => {
    return chartOfAccounts.filter(acc => {
      const matchClass = planClassFilter === 'TODOS' || acc.clase === planClassFilter;
      const matchSearch =
        acc.nombre.toLowerCase().includes(planSearchTerm.toLowerCase()) ||
        acc.codigo.toLowerCase().includes(planSearchTerm.toLowerCase()) ||
        (acc.notasExplicativas || []).some((n) => `nota ${n}`.includes(planSearchTerm.toLowerCase()) || String(n) === planSearchTerm.trim());

      let matchAttr = true;
      if (planAttributeFilter === 'MULTIMONEDA') matchAttr = Boolean(acc.manejaMultimoneda);
      else if (planAttributeFilter === 'DOC_REF') matchAttr = Boolean(acc.requiereDocReferencia);
      else if (planAttributeFilter === 'EFECTIVO') matchAttr = Boolean(acc.esEfectivoEquivalente);
      else if (planAttributeFilter === 'CONTRACUENTA') matchAttr = Boolean(acc.esContracuentaEfectivo);
      else if (planAttributeFilter === 'PROYECTO') matchAttr = Boolean(acc.requiereProyecto);
      else if (planAttributeFilter === 'AUXILIAR') matchAttr = Boolean(acc.requiereAuxiliarRut);
      else if (planAttributeFilter === 'CENTRO_COSTO') matchAttr = Boolean(acc.requiereCentroCosto);
      else if (planAttributeFilter === 'CONCILIABLE') matchAttr = Boolean(acc.esConciliableBancaria);
      else if (planAttributeFilter === 'NOTAS') matchAttr = Boolean(acc.notasExplicativas && acc.notasExplicativas.length > 0);

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

  // Auxiliar, Cost Center & Bank Reconcilable Detection Helpers (con soporte de Plan de Cuentas activo y personalizado)
  const findActiveAccount = (code?: string, name?: string): HierarchicalAccountItem | undefined => {
    const cClean = (code || '').trim().toLowerCase();
    const nClean = (name || '').trim().toLowerCase();
    if (!cClean && !nClean) return undefined;
    const cNorm = normalizeAccountCodeKey(code || '');
    return (
      chartOfAccounts.find(
        (a) =>
          (cClean && (a.codigo.trim().toLowerCase() === cClean || normalizeAccountCodeKey(a.codigo) === cNorm)) ||
          (nClean && a.nombre.trim().toLowerCase() === nClean)
      ) ||
      (cClean ? findAccountInChart(cClean) : undefined) ||
      (nClean ? findAccountInChart(nClean) : undefined)
    );
  };

  const isAccountBankReconcilable = (code: string, name: string): boolean => {
    const acc = findActiveAccount(code, name);
    if (acc?.esConciliableBancaria) return true;
    if (code.startsWith('1.1.02')) return true;
    return /banco|cuenta corriente|cta\.? ?cte|bancari/i.test(name) && !/caja chica|efectivo|reintegro/i.test(name);
  };

  const isAccountAuxiliarRequired = (code: string, name: string): boolean => {
    // Las cuentas bancarias se concilian con cartola, no con auxiliar mercantil
    if (code.startsWith('1.1.02') || (/banco|cuenta corriente|cta\.? ?cte/i.test(name) && !/caja chica|efectivo/i.test(name))) {
      return false;
    }
    const acc = findActiveAccount(code, name);
    // PRIORIDAD ABSOLUTA: Si el usuario configuró explícitamente requiereAuxiliarRut en el Plan de Cuentas (true o false), respetar su elección sin caer en heurísticas
    if (acc && typeof acc.requiereAuxiliarRut === 'boolean') {
      return acc.requiereAuxiliarRut;
    }
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
    return checkIsAccountCostCenterRequired(code, name, chartOfAccounts);
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

    customAuxiliaries.forEach(aux => {
      const rutKey = (aux.rut || aux.rutCompleto || '').trim().toUpperCase();
      if (rutKey) {
        map.set(rutKey, {
          rut: (aux.rut || aux.rutCompleto || '').trim(),
          razonSocial: aux.razonSocial || aux.nombreFantasia || rutKey,
          tipo: (aux.tipo === 'CLIENTE' || aux.tipo === 'PROVEEDOR' ? aux.tipo : 'AMBOS') as any,
        });
      }
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
  }, [safeDtes, customAuxiliaries]);

  // Helper de normalización de RUT para cruces seguros
  const normRut = (r?: string | null) => (r || '').replace(/[\.\-\s]/g, '').toUpperCase();

  // Resolutor experto de medio de pago bancario (TEF vs Cheque vs Depósito vs Devengo)
  const resolveAuxiliaryPaymentTrace = (
    entry: AccountingEntry,
    line: AccountingEntryLine,
    bankLine: AccountingEntryLine | undefined,
    isSupplierSide: boolean
  ) => {
    const isPaymentMove = isSupplierSide ? (Number(line.debe) || 0) > 0 : (Number(line.haber) || 0) > 0;
    const isDevengoMove = isSupplierSide
      ? (Number(line.haber) || 0) > 0 && (Number(line.debe) || 0) === 0
      : (Number(line.debe) || 0) > 0 && (Number(line.haber) || 0) === 0;

    // Si es un devengo (contabilización de factura por pagar / cobrar) y no tiene línea de banco/caja
    if (isDevengoMove && !bankLine) {
      const fEmis = line.fechaDocumentoRef || entry.fecha;
      const fVenc = line.fechaVencimientoRef || fEmis;
      const docLabel = line.documentoRef || (line.folioDocumentoRef ? `F.${line.folioDocumentoRef}` : entry.documento || '-');
      return {
        esPagoBancario: false,
        instrumentoCodigo: 'DEVENGO' as const,
        tipoMedio: isSupplierSide ? 'DEVENGO FACTURA (POR PAGAR)' : 'DEVENGO FACTURA (POR COBRAR)',
        bancoNombre: isSupplierSide ? 'Provisión Cuentas por Pagar (Sin Pago)' : 'Devengo Cuentas por Cobrar (Sin Cobro)',
        folioOperacion: docLabel,
        fechaOperacion: fEmis,
        fechaCobro: fVenc,
        resumenTexto: `Devengo Documentario (${docLabel}) | Emisión: ${fEmis} | Vencimiento: ${fVenc}`,
      };
    }

    const rawBankType = bankLine?.tipoDocumentoConciliacion || '';
    const rawAuxType = line.tipoDocumentoOperacion || '';
    const cleanBankType = /FACTURA|BOLETA|NOTA|DTE|DOCUMENTO/i.test(rawBankType) ? '' : rawBankType;
    const cleanAuxType = /FACTURA|BOLETA|NOTA|DTE|DOCUMENTO/i.test(rawAuxType) ? '' : rawAuxType;

    const rawBankDoc =
      bankLine?.documentoConciliacion ||
      bankLine?.folioDocumentoRef ||
      (bankLine?.documentoRef && !/factura|boleta|nota/i.test(bankLine.documentoRef) ? bankLine.documentoRef : '') ||
      '';
    const rawAuxDoc =
      (line.documentoOperacion && !/factura|boleta|nota/i.test(line.documentoOperacion) ? line.documentoOperacion : '') ||
      line.folioDocumentoRef ||
      '';
    const combinedHint = `${cleanBankType} ${cleanAuxType} ${rawBankDoc} ${rawAuxDoc} ${entry.concepto || ''} ${entry.documento || ''}`;

    const isCheque =
      cleanBankType === 'CHEQUE' ||
      cleanAuxType === 'CHEQUE' ||
      /cheque|\bchq\b|ch\.\s*\d|vale[\s_]*vista/i.test(combinedHint);
    const isCaja =
      Boolean(bankLine?.cuentaCodigo?.startsWith('1.1.01')) &&
      /caja|efectivo/i.test(bankLine?.cuentaNombre || '');
    const isDeposito =
      cleanBankType === 'DEPOSITO' ||
      cleanAuxType === 'DEPOSITO_BANCARIO' ||
      /deposito|depósito/i.test(combinedHint);
    const isCartola =
      cleanBankType === 'CARGO_CARTOLA' ||
      cleanBankType === 'ABONO_CARTOLA' ||
      /\bpac\b|\bpat\b/i.test(combinedHint);

    const instrumentoCodigo: 'CHEQUE' | 'CAJA' | 'DEPOSITO' | 'PAC_CARTOLA' | 'TEF' = isCheque
      ? 'CHEQUE'
      : isCaja
      ? 'CAJA'
      : isDeposito
      ? 'DEPOSITO'
      : isCartola
      ? 'PAC_CARTOLA'
      : 'TEF';

    const tipoMedio =
      instrumentoCodigo === 'CHEQUE'
        ? 'CHEQUE BANCARIO'
        : instrumentoCodigo === 'CAJA'
        ? 'EFECTIVO / CAJA'
        : instrumentoCodigo === 'DEPOSITO'
        ? 'DEPÓSITO BANCARIO'
        : instrumentoCodigo === 'PAC_CARTOLA'
        ? 'CARGO / ABONO EN CARTOLA'
        : 'TEF (Transferencia Electrónica)';

    const rawOpNumber = (rawBankDoc || rawAuxDoc || entry.folioDocumentoRef || 'S/N').trim();
    const folioOperacion =
      instrumentoCodigo === 'TEF'
        ? /^\d+$/.test(rawOpNumber)
          ? `TEF-${rawOpNumber}`
          : rawOpNumber
        : instrumentoCodigo === 'CHEQUE'
        ? rawOpNumber.replace(/^cheque\s*(n[°º]?\s*)?/i, '').trim() || rawOpNumber
        : rawOpNumber;

    // Priorizar fechas del instrumento bancario (bankLine) sobre las fechas de la factura
    const fechaEmisionPago =
      bankLine?.fechaDocumentoRef ||
      line.fechaDocumentoOperacion ||
      entry.fecha;
    const fechaVencimientoPago =
      bankLine?.fechaVencimientoRef ||
      (instrumentoCodigo === 'CHEQUE' ? line.fechaVencimientoRef : undefined) ||
      fechaEmisionPago;

    const bancoNombre =
      bankLine?.cuentaNombre ||
      (isPaymentMove ? 'Banco / Tesorería' : 'Cuenta Corriente Bancaria');

    const resumenTexto =
      instrumentoCodigo === 'CHEQUE'
        ? `${bancoNombre} | CHEQUE N° ${folioOperacion} | F. Emisión: ${fechaEmisionPago} | F. Vencimiento: ${fechaVencimientoPago}`
        : instrumentoCodigo === 'TEF'
        ? `${bancoNombre} | TEF N° ${folioOperacion} | F. Emisión/Ejec.: ${fechaEmisionPago}${
            fechaVencimientoPago && fechaVencimientoPago !== fechaEmisionPago
              ? ` | F. Valor: ${fechaVencimientoPago}`
              : ''
          }`
        : `${bancoNombre} | ${tipoMedio}: ${folioOperacion} | Fecha: ${fechaEmisionPago}`;

    return {
      esPagoBancario: true,
      instrumentoCodigo,
      tipoMedio,
      bancoNombre,
      folioOperacion,
      fechaOperacion: fechaEmisionPago,
      fechaCobro: fechaVencimientoPago,
      resumenTexto,
    };
  };

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
        bancoInfo?: {
          esPagoBancario?: boolean;
          instrumentoCodigo?: 'TEF' | 'CHEQUE' | 'DEPOSITO' | 'CAJA' | 'PAC_CARTOLA' | 'DEVENGO';
          bancoNombre?: string;
          tipoMedio?: string;
          folioOperacion?: string;
          fechaOperacion?: string;
          fechaCobro?: string;
          resumenTexto?: string;
        };
      }> = [];

      // Mapeo de documentos de asientos para extraer deudas vivas por pagar
      const entryDocsMap = new Map<string, {
        folio: string;
        tipoLabel: string;
        tipo: string;
        montoTotal: number;
        haberTotal: number;
        debeTotal: number;
        fechaEmision: string;
        fechaVencimiento: string;
        concepto: string;
      }>();

      safeEntries.forEach(entry => {
        const bankLine = entry.lineas.find(l =>
          l.cuentaCodigo.startsWith('1.1.02') ||
          l.cuentaCodigo.startsWith('1.1.01') ||
          isAccountBankReconcilable(l.cuentaCodigo, l.cuentaNombre)
        );

        entry.lineas.forEach(line => {
          if ((line.cuentaCodigo.startsWith('2.1.01') || line.cuentaCodigo.startsWith('2.1.02')) && normRut(line.rutAuxiliar) === rutKey) {
            journalDebitos += line.debe || 0;
            journalCreditos += line.haber || 0;

            const trace = resolveAuxiliaryPaymentTrace(entry, line, bankLine, true);

            journalMovements.push({
              fecha: entry.fecha,
              asientoId: entry.id,
              concepto: entry.concepto,
              documento: line.documentoRef || entry.documento,
              debe: line.debe,
              haber: line.haber,
              bancoInfo: trace,
            });

            const docKey = (line.folioDocumentoRef || line.documentoRef || entry.documento || '').trim();
            if (docKey) {
              const existing = entryDocsMap.get(docKey) || {
                folio: line.folioDocumentoRef || line.documentoRef || entry.documento || '1',
                tipoLabel: String(line.tipoDocumentoRef || 'Factura Electrónica'),
                tipo: String(line.tipoDocumentoRef || 'FACTURA_ELECTRONICA_33'),
                montoTotal: line.montoDocumentoRef || 0,
                haberTotal: 0,
                debeTotal: 0,
                fechaEmision: line.fechaDocumentoRef || entry.fecha,
                fechaVencimiento: line.fechaVencimientoRef || line.fechaDocumentoRef || entry.fecha,
                concepto: entry.concepto || '',
              };
              existing.haberTotal += Number(line.haber) || 0;
              existing.debeTotal += Number(line.debe) || 0;
              if (line.montoDocumentoRef && Number(line.montoDocumentoRef) > existing.montoTotal) {
                existing.montoTotal = Number(line.montoDocumentoRef);
              }
              entryDocsMap.set(docKey, existing);
            }
          }
        });
      });

      const facturacionTotal = Math.max(totalDtesMonto, journalCreditos);
      const pagosTotales = journalDebitos > 0 ? journalDebitos : totalDtesPagados;
      const saldoPendiente = Math.max(0, facturacionTotal - pagosTotales);

      // Consolidar documentos con saldo pendiente de este proveedor
      const pendingDocuments: Array<{
        id: string;
        tipo: string;
        tipoLabel: string;
        folio: string;
        montoTotal: number;
        saldoPendiente: number;
        fechaEmision?: string;
        fechaVencimiento?: string;
        concepto?: string;
        dteId?: string;
        origen: 'DTE' | 'ASIENTO';
      }> = [];

      // 1. DTEs de compra no saldados
      supplierDtes.forEach(dte => {
        if (dte.estadoPago !== 'PAGADO') {
          const tipoLabel =
            dte.tipoDte === '33'
              ? 'Factura Electrónica'
              : dte.tipoDte === '34'
              ? 'Factura Exenta'
              : dte.tipoDte === '61'
              ? 'Nota de Crédito'
              : 'DTE SII';
          pendingDocuments.push({
            id: `dte-${dte.id}`,
            tipo: dte.tipoDte === '33' ? 'FACTURA_ELECTRONICA_33' : dte.tipoDte === '34' ? 'FACTURA_EXENTA_34' : 'DTE_SII',
            tipoLabel,
            folio: String(dte.folio),
            montoTotal: dte.montoTotal || 0,
            saldoPendiente: dte.montoTotal || 0,
            fechaEmision: dte.fechaEmision,
            fechaVencimiento: dte.fechaVencimiento || dte.fechaEmision,
            concepto: `DTE F.${dte.folio} - ${dte.razonSocialContraparte || razonSocial}`,
            dteId: dte.id,
            origen: 'DTE',
          });
        }
      });

      // 2. Deudas vivas de asientos contables
      entryDocsMap.forEach((val, docKey) => {
        const saldoVivo = Math.max(0, val.haberTotal - val.debeTotal);
        const alreadyInDtes = pendingDocuments.some(
          p => p.folio === val.folio || docKey.includes(p.folio)
        );
        if (saldoVivo > 0 && !alreadyInDtes) {
          pendingDocuments.push({
            id: `entry-doc-${docKey}`,
            tipo: val.tipo,
            tipoLabel: val.tipoLabel,
            folio: val.folio,
            montoTotal: val.montoTotal || val.haberTotal,
            saldoPendiente: saldoVivo,
            fechaEmision: val.fechaEmision,
            fechaVencimiento: val.fechaVencimiento,
            concepto: val.concepto,
            origen: 'ASIENTO',
          });
        }
      });

      // Si hay saldo pero no documentos detallados, crear un documento pendiente sintético
      if (pendingDocuments.length === 0 && saldoPendiente > 0) {
        const defaultDocDate = getDefaultAccountingDate(effectiveCompany);
        pendingDocuments.push({
          id: `saldo-${rutKey}`,
          tipo: 'FACTURA_ELECTRONICA_33',
          tipoLabel: 'Factura / Deuda Pendiente',
          folio: '1',
          montoTotal: saldoPendiente,
          saldoPendiente,
          fechaEmision: defaultDocDate,
          fechaVencimiento: defaultDocDate,
          concepto: `Saldo Pendiente ${razonSocial}`,
          origen: 'ASIENTO',
        });
      }

      return {
        rut: rutDisplay,
        razonSocial,
        totalFacturado: facturacionTotal,
        totalPagado: pagosTotales,
        saldoPendiente,
        dtes: supplierDtes,
        journalMovements,
        pendingDocuments,
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
        bancoInfo?: {
          esPagoBancario?: boolean;
          instrumentoCodigo?: 'TEF' | 'CHEQUE' | 'DEPOSITO' | 'CAJA' | 'PAC_CARTOLA' | 'DEVENGO';
          bancoNombre?: string;
          tipoMedio?: string;
          folioOperacion?: string;
          fechaOperacion?: string;
          fechaCobro?: string;
          resumenTexto?: string;
        };
      }> = [];

      const entryDocsMap = new Map<string, {
        folio: string;
        tipoLabel: string;
        tipo: string;
        montoTotal: number;
        debeTotal: number;
        haberTotal: number;
        fechaEmision: string;
        fechaVencimiento: string;
        concepto: string;
      }>();

      safeEntries.forEach(entry => {
        const bankLine = entry.lineas.find(l =>
          l.cuentaCodigo.startsWith('1.1.02') ||
          l.cuentaCodigo.startsWith('1.1.01') ||
          isAccountBankReconcilable(l.cuentaCodigo, l.cuentaNombre)
        );

        entry.lineas.forEach(line => {
          if (line.cuentaCodigo.startsWith('1.1.03') && normRut(line.rutAuxiliar) === rutKey) {
            journalDebitos += line.debe || 0;
            journalCreditos += line.haber || 0;

            const trace = resolveAuxiliaryPaymentTrace(entry, line, bankLine, false);

            journalMovements.push({
              fecha: entry.fecha,
              asientoId: entry.id,
              concepto: entry.concepto,
              documento: line.documentoRef || entry.documento,
              debe: line.debe,
              haber: line.haber,
              bancoInfo: trace,
            });

            const docKey = (line.folioDocumentoRef || line.documentoRef || entry.documento || '').trim();
            if (docKey) {
              const existing = entryDocsMap.get(docKey) || {
                folio: line.folioDocumentoRef || line.documentoRef || entry.documento || '1',
                tipoLabel: String(line.tipoDocumentoRef || 'Factura Electrónica'),
                tipo: String(line.tipoDocumentoRef || 'FACTURA_ELECTRONICA_33'),
                montoTotal: line.montoDocumentoRef || 0,
                debeTotal: 0,
                haberTotal: 0,
                fechaEmision: line.fechaDocumentoRef || entry.fecha,
                fechaVencimiento: line.fechaVencimientoRef || line.fechaDocumentoRef || entry.fecha,
                concepto: entry.concepto || '',
              };
              existing.debeTotal += Number(line.debe) || 0;
              existing.haberTotal += Number(line.haber) || 0;
              if (line.montoDocumentoRef && Number(line.montoDocumentoRef) > existing.montoTotal) {
                existing.montoTotal = Number(line.montoDocumentoRef);
              }
              entryDocsMap.set(docKey, existing);
            }
          }
        });
      });

      const facturacionTotal = Math.max(totalDtesMonto, journalDebitos);
      const cobrosTotales = journalCreditos > 0 ? journalCreditos : totalDtesCobrados;
      const saldoPorCobrar = Math.max(0, facturacionTotal - cobrosTotales);

      // Consolidar documentos con saldo pendiente de cobranza
      const pendingDocuments: Array<{
        id: string;
        tipo: string;
        tipoLabel: string;
        folio: string;
        montoTotal: number;
        saldoPendiente: number;
        fechaEmision?: string;
        fechaVencimiento?: string;
        concepto?: string;
        dteId?: string;
        origen: 'DTE' | 'ASIENTO';
      }> = [];

      // 1. DTEs de venta no cobrados
      clientDtes.forEach(dte => {
        if (dte.estadoPago !== 'PAGADO' && dte.estadoPago !== 'COBRADO') {
          const tipoLabel =
            dte.tipoDte === '33'
              ? 'Factura Electrónica'
              : dte.tipoDte === '34'
              ? 'Factura Exenta'
              : dte.tipoDte === '61'
              ? 'Nota de Crédito'
              : 'DTE SII';
          pendingDocuments.push({
            id: `dte-${dte.id}`,
            tipo: dte.tipoDte === '33' ? 'FACTURA_ELECTRONICA_33' : dte.tipoDte === '34' ? 'FACTURA_EXENTA_34' : 'DTE_SII',
            tipoLabel,
            folio: String(dte.folio),
            montoTotal: dte.montoTotal || 0,
            saldoPendiente: dte.montoTotal || 0,
            fechaEmision: dte.fechaEmision,
            fechaVencimiento: dte.fechaVencimiento || dte.fechaEmision,
            concepto: `DTE F.${dte.folio} - ${dte.razonSocialContraparte || razonSocial}`,
            dteId: dte.id,
            origen: 'DTE',
          });
        }
      });

      // 2. Cuentas por cobrar de asientos contables
      entryDocsMap.forEach((val, docKey) => {
        const saldoVivo = Math.max(0, val.debeTotal - val.haberTotal);
        const alreadyInDtes = pendingDocuments.some(
          p => p.folio === val.folio || docKey.includes(p.folio)
        );
        if (saldoVivo > 0 && !alreadyInDtes) {
          pendingDocuments.push({
            id: `entry-doc-${docKey}`,
            tipo: val.tipo,
            tipoLabel: val.tipoLabel,
            folio: val.folio,
            montoTotal: val.montoTotal || val.debeTotal,
            saldoPendiente: saldoVivo,
            fechaEmision: val.fechaEmision,
            fechaVencimiento: val.fechaVencimiento,
            concepto: val.concepto,
            origen: 'ASIENTO',
          });
        }
      });

      if (pendingDocuments.length === 0 && saldoPorCobrar > 0) {
        const defaultDocDate = getDefaultAccountingDate(effectiveCompany);
        pendingDocuments.push({
          id: `saldo-${rutKey}`,
          tipo: 'FACTURA_ELECTRONICA_33',
          tipoLabel: 'Factura / Cuenta por Cobrar',
          folio: '1',
          montoTotal: saldoPorCobrar,
          saldoPendiente: saldoPorCobrar,
          fechaEmision: defaultDocDate,
          fechaVencimiento: defaultDocDate,
          concepto: `Saldo por Cobrar ${razonSocial}`,
          origen: 'ASIENTO',
        });
      }

      return {
        rut: rutDisplay,
        razonSocial,
        totalFacturado: facturacionTotal,
        totalCobrado: cobrosTotales,
        saldoPorCobrar,
        dtes: clientDtes,
        journalMovements,
        pendingDocuments,
      };
    });

    return result.sort((a, b) => b.saldoPorCobrar - a.saldoPorCobrar);
  }, [safeDtes, availableAuxiliaries, safeEntries]);

  // Helper para recuperar los documentos con saldo pendiente de un auxiliar específico
  const getPendingDocsForAuxiliary = useCallback(
    (rut?: string, accountCode?: string) => {
      if (!rut) return [];
      const cleanRut = normRut(rut);
      if (accountCode && accountCode.startsWith('2.1')) {
        const found = auxiliarSuppliersSummary.find(s => normRut(s.rut) === cleanRut);
        return found?.pendingDocuments || [];
      }
      if (accountCode && (accountCode.startsWith('1.1.03') || accountCode.startsWith('1.1'))) {
        const found = auxiliarClientsSummary.find(c => normRut(c.rut) === cleanRut);
        return found?.pendingDocuments || [];
      }
      const supp = auxiliarSuppliersSummary.find(s => normRut(s.rut) === cleanRut);
      if (supp && supp.pendingDocuments?.length) return supp.pendingDocuments;
      const clie = auxiliarClientsSummary.find(c => normRut(c.rut) === cleanRut);
      return clie?.pendingDocuments || [];
    },
    [auxiliarSuppliersSummary, auxiliarClientsSummary]
  );

  // Motor de Generación de Libro Auxiliar Según Ley y Detallado por Rango de Fechas
  const auxiliaryBookReportPayload: AuxiliaryBookReportPayload = useMemo(() => {
    const effectiveScope = auxReportConfig.bookScope;
    const fromDate = auxiliarDateFrom || '2000-01-01';
    const toDate = auxiliarDateTo || '2099-12-31';
    const searchQ = auxiliarSearchTerm.trim().toLowerCase();

    const rawMovements: Omit<AuxiliaryDetailedMovement, 'correlativo' | 'saldoProgresivo'>[] = [];
    const registeredDteFolios = new Set<string>();

    // 1. Incorporar DTEs oficiales del Registro de Compras y Ventas (RCV SII)
    safeDtes.forEach((d) => {
      const isCompra = d.tipoOperacion === 'COMPRA';
      const isVenta = d.tipoOperacion === 'VENTA';
      if (effectiveScope === 'PROVEEDORES' && !isCompra) return;
      if (effectiveScope === 'CLIENTES' && !isVenta) return;
      if (effectiveScope === 'HONORARIOS') return; // Honorarios se extrae de 2.1.02

      const rutAux = d.rutContraparte || 'S/RUT';
      const matchedAux = availableAuxiliaries.find((a) => normRut(a.rut) === normRut(rutAux));
      const razonSocial = d.razonSocialContraparte || matchedAux?.razonSocial || `Auxiliar ${rutAux}`;
      const codigoSii = String(d.tipoDte || '33');
      const tipoDocLabel =
        codigoSii === '33'
          ? 'Factura Electrónica'
          : codigoSii === '34'
          ? 'Factura No Afecta o Exenta'
          : codigoSii === '61'
          ? 'Nota de Crédito Electrónica'
          : codigoSii === '56'
          ? 'Nota de Débito Electrónica'
          : `DTE SII (${codigoSii})`;

      const isNotaCredito = codigoSii === '61';
      const montoBruto = Number(d.montoTotal) || 0;

      // En Proveedores (Pasivo 2.1.01): Factura abona al Haber, Nota de Crédito carga al Debe
      // En Clientes (Activo 1.1.03): Factura carga al Debe, Nota de Crédito abona al Haber
      const debe = isCompra
        ? isNotaCredito
          ? montoBruto
          : 0
        : isNotaCredito
        ? 0
        : montoBruto;
      const haber = isCompra
        ? isNotaCredito
          ? 0
          : montoBruto
        : isNotaCredito
        ? montoBruto
        : 0;

      const dteKey = `${ isCompra ? 'C' : 'V' }-${normRut(rutAux)}-${d.folio}`;
      registeredDteFolios.add(dteKey);

      rawMovements.push({
        id: `dte-${d.id}`,
        fecha: d.fechaEmision || '2026-01-01',
        fechaVencimiento: d.fechaVencimiento || d.fechaEmision || '-',
        origen: 'DTE_SII',
        codigoSii,
        tipoDocLabel,
        folio: String(d.folio),
        rutAuxiliar: rutAux,
        razonSocial,
        tipoAuxiliar: isCompra ? 'PROVEEDOR' : 'CLIENTE',
        cuentaCodigo: isCompra ? '2.1.01.001' : '1.1.03.001',
        cuentaNombre: isCompra
          ? 'Proveedores Nacionales (Cuentas por Pagar)'
          : 'Clientes Nacionales (Cuentas por Cobrar)',
        concepto: `${tipoDocLabel} F.${d.folio} - ${razonSocial} (RCV SII)`,
        montoExento: Number(d.montoExento) || 0,
        montoNeto: Number(d.montoNeto) || 0,
        montoIva: Number(d.montoIva) || 0,
        montoRetencion: Number(d.retencionMonto) || 0,
        montoTotalBruto: montoBruto,
        debe,
        haber,
        estadoPago: d.estadoPago || 'PENDIENTE',
        bancoTrazabilidad:
          d.estadoPago === 'PAGADO' || d.estadoPago === 'COBRADO'
            ? `RCV SII: ${d.estadoPago}`
            : 'PENDIENTE DE PAGO/COBRO',
        centroCosto: 'ADM-CENTRAL',
      });
    });

    // 2. Incorporar movimientos del Libro Diario (Cancelaciones, Cobranzas, Honorarios y Asientos Directos)
    safeEntries.forEach((entry) => {
      const bankLine = entry.lineas.find(
        (l) =>
          l.cuentaCodigo.startsWith('1.1.02') ||
          l.cuentaCodigo.startsWith('1.1.01') ||
          isAccountBankReconcilable(l.cuentaCodigo, l.cuentaNombre)
      );

      entry.lineas.forEach((line, idx) => {
        const isProvAccount = line.cuentaCodigo.startsWith('2.1.01');
        const isHonAccount = line.cuentaCodigo.startsWith('2.1.02');
        const isCliAccount = line.cuentaCodigo.startsWith('1.1.03');

        if (!isProvAccount && !isHonAccount && !isCliAccount) return;

        if (effectiveScope === 'PROVEEDORES' && !isProvAccount && !isHonAccount) return;
        if (effectiveScope === 'CLIENTES' && !isCliAccount) return;
        if (effectiveScope === 'HONORARIOS' && !isHonAccount) return;

        const rutAux = line.rutAuxiliar || 'S/RUT';
        const matchedAux = availableAuxiliaries.find((a) => normRut(a.rut) === normRut(rutAux));
        const razonSocial =
          line.nombreAuxiliar || matchedAux?.razonSocial || `Auxiliar ${rutAux}`;

        const folioCand = String(
          line.folioDocumentoRef || line.documentoOperacion || line.documentoRef || entry.documento || entry.id
        ).replace(/[^0-9A-Za-z\-]/g, '');

        // Evitar duplicar el devengo si ya vino desde safeDtes con el mismo RUT y folio
        const isDevengo =
          (isProvAccount && (line.haber || 0) > 0 && (line.debe || 0) === 0) ||
          (isCliAccount && (line.debe || 0) > 0 && (line.haber || 0) === 0);

        const possibleDteKey = `${isProvAccount ? 'C' : 'V'}-${normRut(rutAux)}-${folioCand.replace(/\D/g, '')}`;
        if (isDevengo && registeredDteFolios.has(possibleDteKey)) {
          return;
        }

        const isPaymentOrCollection =
          (isProvAccount && (line.debe || 0) > 0) ||
          (isHonAccount && (line.debe || 0) > 0) ||
          (isCliAccount && (line.haber || 0) > 0);

        const codigoSii = isHonAccount
          ? 'BHE'
          : isPaymentOrCollection
          ? 'COMP'
          : line.tipoDocumentoRef?.includes('34')
          ? '34'
          : line.tipoDocumentoRef?.includes('61')
          ? '61'
          : '33';

        const tipoDocLabel =
          codigoSii === 'BHE'
            ? 'Boleta de Honorarios Electrónica'
            : codigoSii === 'COMP'
            ? isCliAccount
              ? 'Comprobante de Cobranza / Abono'
              : 'Comprobante de Pago / Cargo'
            : codigoSii === '34'
            ? 'Factura Exenta'
            : codigoSii === '61'
            ? 'Nota de Crédito'
            : 'Factura / Devengo Contable';

        const montoMov = Math.max(Number(line.debe) || 0, Number(line.haber) || 0);
        const netoEst =
          codigoSii === '33' ? Math.round(montoMov / 1.19) : codigoSii === 'BHE' ? Math.round(montoMov / 0.8625) : 0;
        const ivaEst = codigoSii === '33' ? montoMov - netoEst : 0;
        const retEst = codigoSii === 'BHE' ? montoMov - Math.round(montoMov * 0.8625) : 0;
        const exentoEst = codigoSii === '34' ? montoMov : 0;

        const trace = resolveAuxiliaryPaymentTrace(entry, line, bankLine, isProvAccount || isHonAccount);
        const trazabilidad = trace.resumenTexto || (isPaymentOrCollection ? 'Cancelación en Libro Diario' : 'Devengo en Libro Diario');

        rawMovements.push({
          id: `je-${entry.id}-${idx}`,
          fecha: entry.fecha,
          fechaVencimiento: trace.esPagoBancario
            ? trace.fechaCobro || entry.fecha
            : line.fechaVencimientoRef || line.fechaDocumentoRef || entry.fecha,
          origen: 'COMPROBANTE_DIARIO',
          codigoSii,
          tipoDocLabel,
          folio: folioCand || entry.id,
          rutAuxiliar: rutAux,
          razonSocial,
          tipoAuxiliar: isHonAccount ? 'HONORARIOS' : isProvAccount ? 'PROVEEDOR' : 'CLIENTE',
          cuentaCodigo: line.cuentaCodigo,
          cuentaNombre: line.cuentaNombre,
          concepto: entry.concepto || line.documentoRef || 'Movimiento Contable Auxiliar',
          montoExento: exentoEst,
          montoNeto: netoEst,
          montoIva: ivaEst,
          montoRetencion: retEst,
          montoTotalBruto: montoMov,
          debe: Number(line.debe) || 0,
          haber: Number(line.haber) || 0,
          estadoPago: isPaymentOrCollection ? 'IMPUTADO' : 'REGISTRADO',
          bancoTrazabilidad: trazabilidad,
          centroCosto: line.centroCosto || 'ADM-CENTRAL',
        });
      });
    });

    // 3. Para DTEs que figuran como PAGADO / COBRADO en el padrón SII pero no tienen asiento de pago explícito en Libro Diario,
    // reflejar su comprobante de pago/cobro implícito para cuadrar el saldo exigible con las tarjetas KPI.
    safeDtes.forEach((d) => {
      const isCompra = d.tipoOperacion === 'COMPRA';
      const isVenta = d.tipoOperacion === 'VENTA';
      if (effectiveScope === 'PROVEEDORES' && !isCompra) return;
      if (effectiveScope === 'CLIENTES' && !isVenta) return;
      if (effectiveScope === 'HONORARIOS') return;

      if (d.estadoPago === 'PAGADO' || d.estadoPago === 'COBRADO') {
        const rutKey = normRut(d.rutContraparte);
        const hasJournalPayment = rawMovements.some(
          (m) =>
            m.origen === 'COMPROBANTE_DIARIO' &&
            normRut(m.rutAuxiliar) === rutKey &&
            (isCompra ? m.debe > 0 : m.haber > 0)
        );
        if (!hasJournalPayment) {
          const montoBruto = Number(d.montoTotal) || 0;
          rawMovements.push({
            id: `dte-paid-${d.id}`,
            fecha: d.fechaVencimiento || d.fechaEmision || '2026-01-01',
            fechaVencimiento: d.fechaVencimiento || d.fechaEmision || '-',
            origen: 'COMPROBANTE_DIARIO',
            codigoSii: 'COMP',
            tipoDocLabel: isCompra ? 'Comprobante de Pago SII' : 'Comprobante de Cobro SII',
            folio: `PAG-${d.folio}`,
            rutAuxiliar: d.rutContraparte || 'S/RUT',
            razonSocial: d.razonSocialContraparte || `Auxiliar ${d.rutContraparte}`,
            tipoAuxiliar: isCompra ? 'PROVEEDOR' : 'CLIENTE',
            cuentaCodigo: isCompra ? '2.1.01.001' : '1.1.03.001',
            cuentaNombre: isCompra
              ? 'Proveedores Nacionales (Cuentas por Pagar)'
              : 'Clientes Nacionales (Cuentas por Cobrar)',
            concepto: `${isCompra ? 'Cancelación Factura Compra' : 'Cobranza Factura Venta'} F.${d.folio} (${d.razonSocialContraparte})`,
            montoExento: 0,
            montoNeto: 0,
            montoIva: 0,
            montoRetencion: 0,
            montoTotalBruto: montoBruto,
            debe: isCompra ? montoBruto : 0,
            haber: isCompra ? 0 : montoBruto,
            estadoPago: d.estadoPago,
            bancoTrazabilidad: 'Banco / Conciliación SII RCV',
            centroCosto: 'ADM-CENTRAL',
          });
        }
      }
    });

    // Filtrar por búsqueda o RUT seleccionado si aplica
    const filteredAllDates = rawMovements.filter((m) => {
      if (auxReportConfig.reportMode === 'ESTADO_CUENTA_RUT' && auxReportConfig.selectedRut) {
        if (normRut(m.rutAuxiliar) !== normRut(auxReportConfig.selectedRut)) return false;
      }
      if (searchQ) {
        const match =
          m.rutAuxiliar.toLowerCase().includes(searchQ) ||
          m.razonSocial.toLowerCase().includes(searchQ) ||
          m.folio.toLowerCase().includes(searchQ) ||
          m.concepto.toLowerCase().includes(searchQ);
        if (!match) return false;
      }
      return true;
    });

    // Ordenar cronológicamente para calcular Saldo Inicial y Saldo Progresivo
    filteredAllDates.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id.localeCompare(b.id));

    // Función de variación de saldo según naturaleza de la cuenta auxiliar:
    // En Proveedores/Honorarios (Pasivo): Haber aumenta deuda (+), Debe disminuye deuda (-)
    // En Clientes (Activo): Debe aumenta cuenta por cobrar (+), Haber disminuye (-)
    const getDelta = (m: Omit<AuxiliaryDetailedMovement, 'correlativo' | 'saldoProgresivo'>) => {
      if (m.tipoAuxiliar === 'CLIENTE') {
        return m.debe - m.haber;
      }
      return m.haber - m.debe;
    };

    let saldoInicialGlobal = 0;
    const inRangeRaw: Omit<AuxiliaryDetailedMovement, 'correlativo' | 'saldoProgresivo'>[] = [];

    // Mapa para resumen por RUT en el rango de fechas
    const rutSummaryMap = new Map<
      string,
      {
        rut: string;
        razonSocial: string;
        tipoAuxiliar: string;
        cuentaContable: string;
        cantidadDocs: number;
        saldoInicial: number;
        cargosPeriodo: number;
        abonosPeriodo: number;
      }
    >();

    filteredAllDates.forEach((m) => {
      const rutKey = normRut(m.rutAuxiliar) || m.razonSocial;
      const entryRut = rutSummaryMap.get(rutKey) || {
        rut: m.rutAuxiliar,
        razonSocial: m.razonSocial,
        tipoAuxiliar: m.tipoAuxiliar,
        cuentaContable: m.cuentaCodigo,
        cantidadDocs: 0,
        saldoInicial: 0,
        cargosPeriodo: 0,
        abonosPeriodo: 0,
      };

      if (m.fecha < fromDate) {
        const delta = getDelta(m);
        saldoInicialGlobal += delta;
        entryRut.saldoInicial += delta;
      } else if (m.fecha >= fromDate && m.fecha <= toDate) {
        inRangeRaw.push(m);
        if (m.origen === 'DTE_SII' || m.codigoSii !== 'COMP') {
          entryRut.cantidadDocs += 1;
        }
        if (m.tipoAuxiliar === 'CLIENTE') {
          entryRut.cargosPeriodo += m.debe;
          entryRut.abonosPeriodo += m.haber;
        } else {
          entryRut.cargosPeriodo += m.haber;
          entryRut.abonosPeriodo += m.debe;
        }
      }
      rutSummaryMap.set(rutKey, entryRut);
    });

    // Ordenar movimientos del período según preferencia del usuario
    const sortedInRange = [...inRangeRaw];
    if (auxReportConfig.sortBy === 'FECHA_DESC') {
      sortedInRange.sort((a, b) => b.fecha.localeCompare(a.fecha));
    } else if (auxReportConfig.sortBy === 'RUT') {
      sortedInRange.sort((a, b) => a.rutAuxiliar.localeCompare(b.rutAuxiliar) || a.fecha.localeCompare(b.fecha));
    } else if (auxReportConfig.sortBy === 'RAZON_SOCIAL') {
      sortedInRange.sort((a, b) => a.razonSocial.localeCompare(b.razonSocial) || a.fecha.localeCompare(b.fecha));
    } else if (auxReportConfig.sortBy === 'MONTO_DESC') {
      sortedInRange.sort((a, b) => b.montoTotalBruto - a.montoTotalBruto);
    }

    let runningSaldo = saldoInicialGlobal;
    let totalDebePeriodo = 0;
    let totalHaberPeriodo = 0;
    let totalExentoPeriodo = 0;
    let totalNetoPeriodo = 0;
    let totalIvaPeriodo = 0;
    let totalRetencionPeriodo = 0;
    let totalBrutoPeriodo = 0;

    const legalDocMap = new Map<string, AuxiliaryLegalSummaryItem>();

    const movements: AuxiliaryDetailedMovement[] = sortedInRange.map((m, idx) => {
      runningSaldo += getDelta(m);
      totalDebePeriodo += m.debe;
      totalHaberPeriodo += m.haber;
      totalExentoPeriodo += m.montoExento;
      totalNetoPeriodo += m.montoNeto;
      totalIvaPeriodo += m.montoIva;
      totalRetencionPeriodo += m.montoRetencion;
      if (m.codigoSii !== 'COMP') {
        totalBrutoPeriodo += m.montoTotalBruto;
      }

      const docGroup = legalDocMap.get(m.codigoSii) || {
        codigoSii: m.codigoSii,
        nombreDocumento: m.tipoDocLabel,
        cantidadDocumentos: 0,
        totalExento: 0,
        totalNeto: 0,
        totalIva: 0,
        totalRetencion: 0,
        totalBruto: 0,
        totalDebe: 0,
        totalHaber: 0,
      };
      docGroup.cantidadDocumentos += 1;
      docGroup.totalExento += m.montoExento;
      docGroup.totalNeto += m.montoNeto;
      docGroup.totalIva += m.montoIva;
      docGroup.totalRetencion += m.montoRetencion;
      docGroup.totalBruto += m.montoTotalBruto;
      docGroup.totalDebe += m.debe;
      docGroup.totalHaber += m.haber;
      legalDocMap.set(m.codigoSii, docGroup);

      return {
        ...m,
        correlativo: idx + 1,
        saldoProgresivo: runningSaldo,
      };
    });

    const rangedSummariesByRut: AuxiliaryRangedSummaryRow[] = Array.from(rutSummaryMap.values())
      .map((r) => {
        const saldoFinal = Math.max(0, r.saldoInicial + r.cargosPeriodo - r.abonosPeriodo);
        return {
          rut: r.rut,
          razonSocial: r.razonSocial,
          tipoAuxiliar: r.tipoAuxiliar,
          cuentaContable: r.cuentaContable,
          cantidadDocs: r.cantidadDocs,
          saldoInicial: Math.max(0, r.saldoInicial),
          cargosPeriodo: r.cargosPeriodo,
          abonosPeriodo: r.abonosPeriodo,
          saldoFinal,
          estado: saldoFinal > 0 ? 'PENDIENTE' : 'AL DÍA',
        };
      })
      .filter((r) => {
        if (!auxReportConfig.includeZeroBalance && r.saldoFinal === 0) return false;
        if (auxiliarFilterStatus === 'CON_SALDO' && r.saldoFinal <= 0) return false;
        if (auxiliarFilterStatus === 'SALDADO' && r.saldoFinal > 0) return false;
        return r.saldoInicial > 0 || r.cargosPeriodo > 0 || r.abonosPeriodo > 0 || r.saldoFinal > 0;
      })
      .sort((a, b) => b.saldoFinal - a.saldoFinal);

    return {
      config: {
        ...auxReportConfig,
        fechaDesde: fromDate,
        fechaHasta: toDate,
      },
      saldoInicialGlobal: Math.max(0, saldoInicialGlobal),
      totalDebePeriodo,
      totalHaberPeriodo,
      saldoFinalGlobal: Math.max(0, runningSaldo),
      totalExentoPeriodo,
      totalNetoPeriodo,
      totalIvaPeriodo,
      totalRetencionPeriodo,
      totalBrutoPeriodo,
      movements,
      legalSummaryByDocType: Array.from(legalDocMap.values()),
      rangedSummariesByRut,
    };
  }, [
    safeDtes,
    safeEntries,
    availableAuxiliaries,
    auxReportConfig,
    auxiliarDateFrom,
    auxiliarDateTo,
    auxiliarSearchTerm,
    auxiliarFilterStatus,
  ]);

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
          nombreAuxiliar: '',
          centroCosto: '',
          documentoRef: '',
          dteIdAsociado: '',
          tipoDocumentoRef: undefined,
          folioDocumentoRef: '',
          montoDocumentoRef: undefined as number | undefined,
          documentoOperacion: '',
          tipoDocumentoOperacion: '',
          documentoConciliacion: '',
          tipoDocumentoConciliacion: '',
        },
      ],
    }));
    setManualEntryError(null);
  };

  const handleUpdateManualAccount = (index: number, account: HierarchicalAccountItem) => {
    const updated = [...manualEntry.lineas];
    const isCc = isAccountCostCenterRequired(account.codigo, account.nombre);
    const currInfo = resolveAccountCurrency(account);
    const rate = currInfo.manejaMonedaExtranjera
      ? getExchangeRateForDate(currInfo.monedaCodigo, manualEntry.fecha, effectiveCompany?.rut)
      : undefined;

    const existingMontoOrig = updated[index].montoMonedaOriginal;
    const existingDebe = Number(updated[index].debe) || 0;
    const existingHaber = Number(updated[index].haber) || 0;

    let newMontoOrig = existingMontoOrig;
    let newDebe = existingDebe;
    let newHaber = existingHaber;

    if (currInfo.manejaMonedaExtranjera && rate && rate > 0) {
      if (!newMontoOrig && (existingDebe > 0 || existingHaber > 0)) {
        newMontoOrig = Number(((existingDebe || existingHaber) / rate).toFixed(2));
      } else if (newMontoOrig && newMontoOrig > 0 && !existingDebe && !existingHaber) {
        newDebe = Math.round(newMontoOrig * rate);
      }
    }

    const defaultRut = account.auxiliarPredeterminadoRut;
    let defaultNombre = updated[index].nombreAuxiliar;
    if (defaultRut) {
      const foundAux = availableAuxiliaries.find(a => normRut(a.rut) === normRut(defaultRut));
      if (foundAux) defaultNombre = foundAux.razonSocial;
    }

    const isBankAcc =
      account.codigo.startsWith('1.1.02') ||
      Boolean(account.esConciliableBancaria) ||
      isAccountBankReconcilable(account.codigo, account.nombre);

    updated[index] = {
      ...updated[index],
      cuentaNombre: account.nombre,
      cuentaCodigo: account.codigo,
      centroCosto: isCc && !updated[index].centroCosto ? 'CC-ADM-01' : updated[index].centroCosto,
      rutAuxiliar: defaultRut || updated[index].rutAuxiliar,
      nombreAuxiliar: defaultNombre,
      monedaOriginal: currInfo.manejaMonedaExtranjera ? currInfo.monedaCodigo : undefined,
      tipoCambio: rate,
      montoMonedaOriginal: currInfo.manejaMonedaExtranjera ? newMontoOrig : undefined,
      debe: newDebe,
      haber: newHaber,
      ...(isBankAcc
        ? {
            tipoDocumentoConciliacion:
              updated[index].tipoDocumentoConciliacion &&
              !/FACTURA|BOLETA|NOTA|DTE|DOCUMENTO/i.test(updated[index].tipoDocumentoConciliacion)
                ? updated[index].tipoDocumentoConciliacion
                : 'TRANSFERENCIA',
            fechaDocumentoRef: updated[index].fechaDocumentoRef || manualEntry.fecha,
            fechaVencimientoRef: updated[index].fechaVencimientoRef || manualEntry.fecha,
          }
        : {}),
    };
    setManualEntry(prev => ({ ...prev, lineas: updated }));
    setManualEntryError(null);
  };

  const handleUpdateManualLine = (index: number, field: keyof AccountingEntryLine, value: any) => {
    const updated = [...manualEntry.lineas];
    if (field === 'cuentaNombre') {
      const found = findAccountInChart(value);
      const currInfo = found ? resolveAccountCurrency(found) : { manejaMonedaExtranjera: false, monedaCodigo: 'CLP', simbolo: '$' };
      const rate = currInfo.manejaMonedaExtranjera
        ? getExchangeRateForDate(currInfo.monedaCodigo, manualEntry.fecha, effectiveCompany?.rut)
        : undefined;

      let autoRut = updated[index].rutAuxiliar;
      let autoNombre = updated[index].nombreAuxiliar;
      if (found?.auxiliarPredeterminadoRut && !autoRut) {
        autoRut = found.auxiliarPredeterminadoRut;
        const foundAux = availableAuxiliaries.find(a => normRut(a.rut) === normRut(found.auxiliarPredeterminadoRut));
        if (foundAux) autoNombre = foundAux.razonSocial;
      }

      updated[index] = {
        ...updated[index],
        cuentaNombre: value,
        cuentaCodigo: found?.codigo || updated[index].cuentaCodigo || '9.9.99.999',
        rutAuxiliar: autoRut,
        nombreAuxiliar: autoNombre,
        monedaOriginal: currInfo.manejaMonedaExtranjera ? currInfo.monedaCodigo : updated[index].monedaOriginal,
        tipoCambio: rate || updated[index].tipoCambio,
      };
    } else if (field === 'montoMonedaOriginal') {
      const valOrig = Number(value) || 0;
      const rate = Number(updated[index].tipoCambio) || getExchangeRateForDate(updated[index].monedaOriginal || 'USD', manualEntry.fecha, effectiveCompany?.rut);
      const clp = Math.round(valOrig * rate);
      const wasHaber = Number(updated[index].haber) > 0;
      updated[index] = {
        ...updated[index],
        montoMonedaOriginal: valOrig,
        tipoCambio: rate,
        debe: wasHaber ? 0 : clp,
        haber: wasHaber ? clp : 0,
      };
    } else if (field === 'tipoCambio') {
      const newRate = Number(value) || 0;
      const valOrig = Number(updated[index].montoMonedaOriginal) || 0;
      const clp = Math.round(valOrig * newRate);
      const wasHaber = Number(updated[index].haber) > 0;
      updated[index] = {
        ...updated[index],
        tipoCambio: newRate,
        debe: wasHaber ? 0 : clp,
        haber: wasHaber ? clp : 0,
      };
    } else if (field === 'debe') {
      const valDebe = Number(value) || 0;
      const rate = Number(updated[index].tipoCambio) || 0;
      updated[index] = {
        ...updated[index],
        debe: valDebe,
        // Si ingresa en el Debe (> 0), el Haber se fuerza automáticamente a 0
        ...(valDebe > 0 ? { haber: 0 } : {}),
        ...(rate > 0 && updated[index].monedaOriginal ? { montoMonedaOriginal: Number((valDebe / rate).toFixed(2)) } : {}),
      };
    } else if (field === 'haber') {
      const valHaber = Number(value) || 0;
      const rate = Number(updated[index].tipoCambio) || 0;
      updated[index] = {
        ...updated[index],
        haber: valHaber,
        // Si ingresa en el Haber (> 0), el Debe se fuerza automáticamente a 0
        ...(valHaber > 0 ? { debe: 0 } : {}),
        ...(rate > 0 && updated[index].monedaOriginal ? { montoMonedaOriginal: Number((valHaber / rate).toFixed(2)) } : {}),
      };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setManualEntry(prev => ({ ...prev, lineas: updated }));
    setManualEntryError(null);
  };

  const handleSwapManualLine = (index: number) => {
    const updated = [...manualEntry.lineas];
    const curDebe = Number(updated[index].debe) || 0;
    const curHaber = Number(updated[index].haber) || 0;
    updated[index] = {
      ...updated[index],
      debe: curHaber,
      haber: curDebe,
    };
    setManualEntry(prev => ({ ...prev, lineas: updated }));
    setManualEntryError(null);
  };

  const handleRemoveManualLine = (index: number) => {
    if (manualEntry.lineas.length <= 2) {
      // Si solo quedan 2 líneas (mínimo exigido para partida doble), no bloquear la interfaz: restablecer la partida a cero
      const updated = [...manualEntry.lineas];
      updated[index] = {
        cuentaCodigo: '',
        cuentaNombre: '',
        debe: 0,
        haber: 0,
        rutAuxiliar: '',
        centroCosto: '',
        documentoRef: '',
        dteIdAsociado: '',
      };
      setManualEntry(prev => ({ ...prev, lineas: updated }));
      setManualEntryError(null);
      showToast(`Partida #${index + 1} restablecida a cero.`, 'info');
      return;
    }
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

  const executeSaveManualEntry = async (overridePeriodos?: string[]) => {
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
          proyecto: l.proyecto,
          glosaDetalle: l.documentoRef,
        }))
      });

      const remainingOriginals = [...manualEntry.lineas];
      const createdLines: AccountingEntryLine[] = normalized.lineas.map(l => {
        const matchIdx = remainingOriginals.findIndex(orig =>
          orig.cuentaCodigo === l.codigoCuenta &&
          (Number(orig.debe) || 0) === l.debe &&
          (Number(orig.haber) || 0) === l.haber &&
          (orig.rutAuxiliar || '') === (l.rutAuxiliar || '')
        );
        let originalLine: AccountingEntryLine | undefined;
        if (matchIdx !== -1) {
          originalLine = remainingOriginals.splice(matchIdx, 1)[0];
        } else {
          const fallbackIdx = remainingOriginals.findIndex(orig => orig.cuentaCodigo === l.codigoCuenta);
          if (fallbackIdx !== -1) {
            originalLine = remainingOriginals.splice(fallbackIdx, 1)[0];
          } else {
            originalLine = remainingOriginals.shift();
          }
        }

        return {
          cuentaCodigo: l.codigoCuenta,
          cuentaNombre: l.nombreCuenta,
          debe: l.debe,
          haber: l.haber,
          glosa: originalLine?.glosa || l.glosaDetalle || undefined,
          rutAuxiliar: l.rutAuxiliar || originalLine?.rutAuxiliar || undefined,
          nombreAuxiliar: originalLine?.nombreAuxiliar || undefined,
          centroCosto: l.centroCosto || originalLine?.centroCosto || undefined,
          proyecto: l.proyecto || originalLine?.proyecto || undefined,
          documentoRef: originalLine?.documentoRef || l.glosaDetalle || manualEntry.documentoReferencia || undefined,
          dteIdAsociado: originalLine?.dteIdAsociado || undefined,
          tipoDocumentoRef: originalLine?.tipoDocumentoRef || undefined,
          folioDocumentoRef: originalLine?.folioDocumentoRef || undefined,
          montoDocumentoRef: originalLine?.montoDocumentoRef,
          fechaDocumentoRef: originalLine?.fechaDocumentoRef || undefined,
          fechaVencimientoRef: originalLine?.fechaVencimientoRef || undefined,
          documentoOperacion: originalLine?.documentoOperacion || undefined,
          tipoDocumentoOperacion: originalLine?.tipoDocumentoOperacion || undefined,
          fechaDocumentoOperacion: originalLine?.fechaDocumentoOperacion || undefined,
          documentoConciliacion: originalLine?.documentoConciliacion || undefined,
          tipoDocumentoConciliacion: originalLine?.tipoDocumentoConciliacion || undefined,
          monedaOriginal: originalLine?.monedaOriginal || undefined,
          montoMonedaOriginal: originalLine?.montoMonedaOriginal,
          tipoCambio: originalLine?.tipoCambio,
        };
      });

      // Trazabilidad y cruce bidireccional entre la contrapartida bancaria y el auxiliar:
      const auxLines = createdLines.filter(l => Boolean(l.rutAuxiliar));
      const bankLines = createdLines.filter(l =>
        l.cuentaCodigo.startsWith('1.1.02') ||
        Boolean(l.documentoConciliacion) ||
        Boolean(l.tipoDocumentoConciliacion) ||
        isAccountBankReconcilable(l.cuentaCodigo, l.cuentaNombre)
      );

      if (auxLines.length > 0 && bankLines.length > 0) {
        const primaryBank = bankLines[0];
        const primaryAux = auxLines[0];
        const cleanBankType =
          primaryBank.tipoDocumentoConciliacion &&
          !/FACTURA|BOLETA|NOTA|DTE|DOCUMENTO/i.test(primaryBank.tipoDocumentoConciliacion)
            ? primaryBank.tipoDocumentoConciliacion
            : 'TRANSFERENCIA';
        const cleanBankDoc =
          primaryBank.documentoConciliacion ||
          primaryBank.folioDocumentoRef ||
          primaryBank.documentoRef ||
          primaryAux.documentoOperacion ||
          '';

        // 1. Enlazar datos bancarios (TEF, cheque, banco, fechas) en la línea de auxiliar para la cartola del auxiliar
        auxLines.forEach(aLine => {
          if (cleanBankDoc) {
            aLine.documentoOperacion = cleanBankDoc;
          }
          aLine.tipoDocumentoOperacion = cleanBankType;
          aLine.fechaDocumentoOperacion = primaryBank.fechaDocumentoRef || normalized.fecha;
        });

        // 2. Enlazar datos del auxiliar en la línea de banco para la cartola bancaria y conciliación
        bankLines.forEach(bLine => {
          bLine.tipoDocumentoConciliacion = cleanBankType;
          if (!bLine.fechaDocumentoRef) {
            bLine.fechaDocumentoRef = normalized.fecha;
          }
          if (!bLine.fechaVencimientoRef) {
            bLine.fechaVencimientoRef = bLine.fechaDocumentoRef || normalized.fecha;
          }
          if (!bLine.rutAuxiliar && primaryAux.rutAuxiliar) {
            bLine.rutAuxiliar = primaryAux.rutAuxiliar;
            bLine.nombreAuxiliar = primaryAux.nombreAuxiliar;
          }
          if (!bLine.documentoConciliacion && cleanBankDoc) {
            bLine.documentoConciliacion = cleanBankDoc;
          }
        });
      }

      const firstLineWithDoc = createdLines.find(l => l.folioDocumentoRef || l.tipoDocumentoRef);
      const created: AccountingEntry = {
        id: `entry-man-${Date.now()}`,
        fecha: normalized.fecha,
        concepto: normalized.glosaGeneral,
        documento: normalized.documentoRef || 'Comprobante Diario Interno',
        documentoReferencia: manualEntry.documentoReferencia || normalized.documentoRef || 'Comprobante Diario Interno',
        tipoDocumentoRef: firstLineWithDoc?.tipoDocumentoRef as any,
        folioDocumentoRef: firstLineWithDoc?.folioDocumentoRef,
        origen: manualEntry.origen,
        lineas: createdLines,
        totalDebe: normalized.totalDebe,
        totalHaber: normalized.totalHaber,
        balanceado: true,
        creadoEn: new Date().toISOString(),
      };

      await dispatchEntry(created, {
        agenteNombre: 'OPERADOR_MANUAL',
        accion: 'ASIENTO_MANUAL_DIARIO',
        overridePeriodos,
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

    // Validación rigurosa de exclusividad Debe/Haber por cada partida
    for (let i = 0; i < manualEntry.lineas.length; i++) {
      const l = manualEntry.lineas[i];
      const d = Number(l.debe) || 0;
      const h = Number(l.haber) || 0;

      if (d > 0 && h > 0) {
        setManualEntryError(
          `Error en Línea #${i + 1} (${l.cuentaNombre || l.cuentaCodigo}): Una misma partida no puede tener movimientos simultáneos en el Debe ($${formatCLP(d)}) y en el Haber ($${formatCLP(h)}). Debe imputar a una sola columna.`
        );
        return;
      }
      if (d <= 0 && h <= 0) {
        setManualEntryError(
          `Error en Línea #${i + 1} (${l.cuentaNombre || l.cuentaCodigo}): Debe ingresar un monto mayor a cero en el Debe o en el Haber.`
        );
        return;
      }
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

      // Validación de Documento de Referencia según Plan de Cuentas (NIIF / CMF)
      const accMeta = findActiveAccount(l.cuentaCodigo, l.cuentaNombre);
      if (accMeta?.requiereDocReferencia) {
        const lineDoc = (l.documentoRef || '').trim();
        const headerDoc = (manualEntry.documentoReferencia || '').trim();
        if (!lineDoc && !headerDoc && !l.dteIdAsociado) {
          setManualEntryError(
            `La cuenta "${l.cuentaCodigo} - ${l.cuentaNombre}" (Línea #${i + 1}) exige Documento de Referencia obligatorio según el Plan de Cuentas. Puede respaldarse válidamente con un DTE del SII, Contrato (arriendo, mutuo, servicios), Rendición de Gastos (RDG), Transferencia Bancaria (TEF), Finiquito u otro documento mercantil. Por favor indique el documento en la partida o en el encabezado.`
          );
          return;
        }
      }

      // Validación de Proyecto / Obra según Plan de Cuentas (WIP / Art. 31 / IFRS)
      if (accMeta?.requiereProyecto) {
        if (!l.proyecto || !l.proyecto.trim()) {
          setManualEntryError(
            `La cuenta "${l.cuentaCodigo} - ${l.cuentaNombre}" (Línea #${i + 1}) exige asignación de Proyecto / Obra según el Plan de Cuentas. Por favor seleccione o cree el proyecto correspondiente.`
          );
          return;
        }
      }
    }

    // Validación rigurosa de ejercicio fiscal y período mensual (Art. 16 Código Tributario)
    const periodCheck = validateEntryFiscalPeriod(manualEntry.fecha, effectiveCompany);

    if (!periodCheck.permitido) {
      if (periodCheck.codigoError === 'PERIODO_CERRADO') {
        const periodo = manualEntry.fecha.substring(0, 7);
        const ejercicio = Number(manualEntry.fecha.substring(0, 4));
        setPeriodReopenModal({
          isOpen: true,
          periodo,
          fecha: manualEntry.fecha,
          ejercicio,
          onConfirm: async () => {
            const updatedPeriodos = effectivePeriodos.filter(p => p !== periodo);
            onUpdateCompany({ periodosCerrados: updatedPeriodos });
            setPeriodReopenModal(null);
            showToast(`Período mensual ${periodo} reabierto con éxito por el Contador Auditor.`, 'info');
            await executeSaveManualEntry(updatedPeriodos);
          }
        });
        return;
      } else {
        setManualEntryError(
          `Bloqueo Fiscal de Ejercicio: ${periodCheck.motivo}. ${periodCheck.sugerencia || ''}`
        );
        return;
      }
    }

    await executeSaveManualEntry(effectivePeriodos);
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

      {/* Gobernanza Agéntica del Módulo Contable (Camila Valenzuela - Auditora IFRS) */}
      <ModuleAgentGovernanceHeader
        moduloId="CONTABILIDAD"
        empresaId={company.id}
      />

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
                RUT: {company.rut || 'Sin especificar'}
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
              type="button"
              onClick={() => setIsCurrencyModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3.5 py-2.5 rounded-lg flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
              title="Gestión Multimoneda, Histórico de Tipos de Cambio y Agente de Diferencia de Cambio (NIC 21)"
            >
              <Coins className="w-4 h-4 text-amber-300" />
              <span>Multimoneda & T/C (NIC 21)</span>
            </button>

            <button
              type="button"
              onClick={() => setIsMassImportModalOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3.5 py-2.5 rounded-lg flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
              title="Importador Masivo de Asientos Contables desde Excel/CSV (Migración de Softland, Defontana, ERPs históricos)"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
              <span>Importación Masiva (Migración)</span>
            </button>

            <button
              onClick={() => {
                setManualEntry(getInitialManualEntry());
                setManualEntryError(null);
                setShowManualModal(true);
              }}
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
          onClick={() => setActiveTab('NOTAS_EEFF')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
            activeTab === 'NOTAS_EEFF'
              ? 'bg-[#0f172a] text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <BookOpen className="w-4 h-4 text-indigo-400" />
          <span>Notas EE.FF. (NIIF / CMF)</span>
          <span className="bg-indigo-100 text-indigo-800 text-[10px] px-1.5 py-0.2 rounded-full font-bold font-mono">
            {financialNotes.length}
          </span>
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
                        {item.modulo === 'RENDICION_GASTOS' && <CreditCard className="w-4 h-4 text-rose-600" />}
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

                      {/* Botón Editar Asiento */}
                      <button
                        onClick={() => handleOpenEditEntry(entry)}
                        className="px-2 py-1 text-slate-700 hover:text-blue-700 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                        title="Editar referencia de documento, concepto o cuentas de este asiento"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                        <span>Editar</span>
                      </button>

                      {/* Botón Reversar / Anular Asiento */}
                      <button
                        onClick={() => handleReverseEntryConfirm(entry)}
                        className="p-1.5 text-slate-400 hover:text-amber-700 hover:bg-amber-50 rounded transition-colors cursor-pointer"
                        title="Generar contra-asiento de anulación / reversión contable"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>

                      {/* Botón Eliminar Asiento */}
                      <button
                        onClick={() => handleDeleteEntryConfirm(entry)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                        title="Eliminar asiento contable del Libro Diario"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
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
                                    {line.montoDocumentoRef !== undefined && line.montoDocumentoRef !== null && Number(line.montoDocumentoRef) > 0 && (
                                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 font-mono border border-amber-200 font-semibold" title={`Importe Total del Documento: $${formatCLP(Number(line.montoDocumentoRef))}`}>
                                        Tot. Doc: ${formatCLP(Number(line.montoDocumentoRef))}
                                      </span>
                                    )}
                                    {line.documentoOperacion && (
                                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 font-mono border border-emerald-200 font-semibold" title={`Documento de Operación: ${line.tipoDocumentoOperacion || 'OPERACIÓN'} N° ${line.documentoOperacion}`}>
                                        Op: {line.tipoDocumentoOperacion ? `${line.tipoDocumentoOperacion} ` : ''}#{line.documentoOperacion}
                                      </span>
                                    )}
                                    {line.documentoConciliacion && (
                                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-50 text-cyan-800 font-mono border border-cyan-200 font-semibold" title={`Documento de Conciliación: ${line.tipoDocumentoConciliacion || 'CONCILIACIÓN'} N° ${line.documentoConciliacion}`}>
                                        Conc: {line.tipoDocumentoConciliacion ? `${line.tipoDocumentoConciliacion} ` : ''}#{line.documentoConciliacion}
                                      </span>
                                    )}
                                    {line.monedaOriginal && line.monedaOriginal !== 'CLP' && (
                                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-mono border border-blue-200 font-bold" title={`Paridad aplicada: $${line.tipoCambio || ''} CLP`}>
                                        {line.monedaOriginal} {Number(line.montoMonedaOriginal || 0).toLocaleString('es-CL', { minimumFractionDigits: 2 })} (T/C ${line.tipoCambio || ''})
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

      {/* VIEW: LIBROS AUXILIARES (PROVEEDORES, CLIENTES, LIBRO SEGÚN LEY & DETALLADO POR FECHAS) */}
      {activeTab === 'AUXILIARES' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-5">
          {/* Header */}
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="bg-violet-100 text-violet-900 text-[11px] font-bold px-2 py-0.5 rounded font-mono">
                  LIBROS AUXILIARES OFICIALES SII / CÓD. COMERCIO
                </span>
                <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded font-mono">
                  RES. EX. SII N° 45 / N° 61 &amp; ART. 25 CÓD. COMERCIO
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  {company.razonSocial} (RUT: {company.rut})
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-violet-600" />
                Control de Libros Auxiliares, Emisión Legal Timbrada y Detallado por Rango de Fechas
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Seguimiento analítico por RUT, generación del Libro Auxiliar Según Ley con cuadro de centralización SII y libro detallado cronológico por rango de fechas.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAuxReportCustomizer((prev) => !prev)}
                className={`text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors border shadow-2xs ${
                  showAuxReportCustomizer
                    ? 'bg-violet-600 text-white border-violet-700'
                    : 'bg-violet-50 hover:bg-violet-100 text-violet-900 border-violet-200'
                }`}
                title="Personalizar columnas, orientación, foliación legal, ordenamiento y formato del reporte"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>{showAuxReportCustomizer ? 'Ocultar Personalización' : 'Personalizar Reporte'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const legalPayload: AuxiliaryBookReportPayload = {
                    ...auxiliaryBookReportPayload,
                    config: {
                      ...auxiliaryBookReportPayload.config,
                      reportMode: 'LIBRO_SEGUN_LEY',
                      includeLegalSummary: true,
                      includeSignatures: true,
                    },
                  };
                  setAuxiliarViewMode('LIBRO_SEGUN_LEY');
                  setAuxReportConfig((prev) => ({
                    ...prev,
                    reportMode: 'LIBRO_SEGUN_LEY',
                    includeLegalSummary: true,
                    includeSignatures: true,
                  }));
                  downloadLibroAuxiliarPdf(legalPayload, effectiveCompany);
                }}
                className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                title="Generar y descargar Libro Auxiliar Oficial Según Ley (Art. 25 Cód. Comercio / Res. Ex. SII N° 45)"
              >
                <Scale className="w-3.5 h-3.5 text-amber-400" />
                <span>Generar Libro Según Ley (PDF)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const rangedPayload: AuxiliaryBookReportPayload = {
                    ...auxiliaryBookReportPayload,
                    config: {
                      ...auxiliaryBookReportPayload.config,
                      reportMode: 'DETALLADO_RANGO_FECHAS',
                    },
                  };
                  setAuxiliarViewMode('DETALLADO_FECHAS');
                  setAuxReportConfig((prev) => ({
                    ...prev,
                    reportMode: 'DETALLADO_RANGO_FECHAS',
                  }));
                  downloadLibroAuxiliarPdf(rangedPayload, effectiveCompany);
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                title="Generar y descargar Libro Auxiliar Detallado por Rango de Fechas"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Libro Detallado por Fechas (PDF)</span>
              </button>

              <button
                type="button"
                onClick={() => downloadLibroAuxiliarExcel(auxiliaryBookReportPayload, effectiveCompany)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                title="Exportar Libro Auxiliar Multi-Hoja a Excel (.xlsx) con Detalle por Fechas, Centralización SII y Saldos por RUT"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Excel SII (.xlsx)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAuxiliaryManagerFilter(auxiliarSubTab === 'PROVEEDORES' ? 'PROVEEDOR' : 'CLIENTE');
                  setIsAuxiliaryManagerModalOpen(true);
                }}
                className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                title="Administrar Padrón y Catálogo de Auxiliares (Proveedores, Clientes, Honorarios)"
              >
                <Users className="w-3.5 h-3.5 text-violet-600" />
                <span>Padrón Auxiliares</span>
              </button>

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
                <span>Nuevo Asiento / Pago</span>
              </button>
            </div>
          </div>

          {/* Barra de Rango de Fechas, Presets Rápidos y Selector de Vista del Libro */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
            {/* Selector de Rango de Fechas + Presets */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 shadow-2xs">
                <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span className="text-[11px] font-bold text-slate-600 uppercase">Desde:</span>
                <input
                  type="date"
                  value={auxiliarDateFrom}
                  onChange={(e) => {
                    const val = e.target.value;
                    setAuxiliarDateFrom(val);
                    setAuxReportConfig((prev) => ({ ...prev, fechaDesde: val }));
                  }}
                  className="text-xs font-mono font-semibold text-slate-800 bg-transparent focus:outline-hidden"
                />
                <span className="text-slate-300">|</span>
                <span className="text-[11px] font-bold text-slate-600 uppercase">Hasta:</span>
                <input
                  type="date"
                  value={auxiliarDateTo}
                  onChange={(e) => {
                    const val = e.target.value;
                    setAuxiliarDateTo(val);
                    setAuxReportConfig((prev) => ({ ...prev, fechaHasta: val }));
                  }}
                  className="text-xs font-mono font-semibold text-slate-800 bg-transparent focus:outline-hidden"
                />
              </div>

              {/* Presets rápidos de rango de fechas */}
              <div className="flex flex-wrap items-center gap-1">
                {[
                  { label: '1er Trim.', from: '2026-01-01', to: '2026-03-31' },
                  { label: '2do Trim.', from: '2026-04-01', to: '2026-06-30' },
                  { label: '3er Trim.', from: '2026-07-01', to: '2026-09-30' },
                  { label: 'Oct 2026', from: '2026-10-01', to: '2026-10-31' },
                  { label: 'Año 2026', from: '2026-01-01', to: '2026-12-31' },
                  { label: 'Histórico', from: '2020-01-01', to: '2026-12-31' },
                ].map((preset) => {
                  const isActive = auxiliarDateFrom === preset.from && auxiliarDateTo === preset.to;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setAuxiliarDateFrom(preset.from);
                        setAuxiliarDateTo(preset.to);
                        setAuxReportConfig((prev) => ({
                          ...prev,
                          fechaDesde: preset.from,
                          fechaHasta: preset.to,
                        }));
                      }}
                      className={`px-2 py-1 rounded-md text-[11px] font-semibold cursor-pointer transition-colors ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selector de Modalidad de Visualización en Pantalla */}
            <div className="flex items-center gap-1 bg-slate-200/80 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setAuxiliarViewMode('RESUMEN_RUT');
                  setAuxReportConfig((prev) => ({ ...prev, reportMode: 'RESUMEN_SALDOS' }));
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  auxiliarViewMode === 'RESUMEN_RUT'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-3.5 h-3.5 text-violet-600" />
                <span>Resumen por Auxiliar</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAuxiliarViewMode('DETALLADO_FECHAS');
                  setAuxReportConfig((prev) => ({ ...prev, reportMode: 'DETALLADO_RANGO_FECHAS' }));
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  auxiliarViewMode === 'DETALLADO_FECHAS'
                    ? 'bg-white text-indigo-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                <span>Detallado por Rango de Fechas</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-100 text-indigo-800 font-mono">
                  {auxiliaryBookReportPayload.movements.length} movs
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAuxiliarViewMode('LIBRO_SEGUN_LEY');
                  setAuxReportConfig((prev) => ({
                    ...prev,
                    reportMode: 'LIBRO_SEGUN_LEY',
                    includeLegalSummary: true,
                    includeSignatures: true,
                  }));
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  auxiliarViewMode === 'LIBRO_SEGUN_LEY'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                <Scale className="w-3.5 h-3.5 text-amber-500" />
                <span>Libro Oficial Según Ley</span>
              </button>
            </div>
          </div>

          {/* PANEL DE PERSONALIZACIÓN DEL REPORTE DE LIBROS AUXILIARES */}
          {showAuxReportCustomizer && (
            <div className="bg-violet-50/50 border border-violet-200 rounded-xl p-5 space-y-4 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-violet-200/70">
                <div>
                  <h4 className="text-xs font-bold text-violet-950 uppercase tracking-wider flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-violet-600" />
                    Configurador y Personalización del Reporte de Libros Auxiliares
                  </h4>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Personalice el alcance contable, modalidad normativa, columnas visibles, ordenamiento y timbraje de folios para vista en pantalla y exportación oficial.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => downloadLibroAuxiliarPdf(auxiliaryBookReportPayload, effectiveCompany)}
                    className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Download className="w-3.5 h-3.5 text-amber-400" />
                    <span>Descargar PDF Personalizado</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadLibroAuxiliarExcel(auxiliaryBookReportPayload, effectiveCompany)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Exportar Excel (.xlsx)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadLibroAuxiliarCsv(auxiliaryBookReportPayload, effectiveCompany)}
                    className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" />
                    <span>CSV SII</span>
                  </button>
                </div>
              </div>

              {/* Parámetros Principales del Reporte */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    1. Libro / Alcance Auxiliar
                  </label>
                  <select
                    value={auxReportConfig.bookScope}
                    onChange={(e) => {
                      const scope = e.target.value as AuxiliaryBookReportConfig['bookScope'];
                      setAuxReportConfig((prev) => ({ ...prev, bookScope: scope }));
                      if (scope === 'PROVEEDORES') setAuxiliarSubTab('PROVEEDORES');
                      if (scope === 'CLIENTES') setAuxiliarSubTab('CLIENTES');
                    }}
                    className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 font-semibold"
                  >
                    <option value="PROVEEDORES">Auxiliar Proveedores (2.1.01)</option>
                    <option value="CLIENTES">Auxiliar Clientes (1.1.03)</option>
                    <option value="HONORARIOS">Auxiliar Honorarios (2.1.02)</option>
                    <option value="CONSOLIDADO">Consolidado General (CxP + CxC)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    2. Modalidad del Reporte
                  </label>
                  <select
                    value={auxReportConfig.reportMode}
                    onChange={(e) => {
                      const mode = e.target.value as AuxiliaryBookReportConfig['reportMode'];
                      setAuxReportConfig((prev) => ({ ...prev, reportMode: mode }));
                      if (mode === 'LIBRO_SEGUN_LEY') setAuxiliarViewMode('LIBRO_SEGUN_LEY');
                      else if (mode === 'DETALLADO_RANGO_FECHAS' || mode === 'ESTADO_CUENTA_RUT')
                        setAuxiliarViewMode('DETALLADO_FECHAS');
                      else setAuxiliarViewMode('RESUMEN_RUT');
                    }}
                    className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 font-semibold"
                  >
                    <option value="LIBRO_SEGUN_LEY">Libro Oficial Según Ley (SII / Cód. Comercio)</option>
                    <option value="DETALLADO_RANGO_FECHAS">Libro Detallado por Rango de Fechas</option>
                    <option value="RESUMEN_SALDOS">Resumen de Saldos por Auxiliar en Rango</option>
                    <option value="ESTADO_CUENTA_RUT">Cartola Individual por RUT Auxiliar</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    3. Ordenamiento de Registros
                  </label>
                  <select
                    value={auxReportConfig.sortBy}
                    onChange={(e) =>
                      setAuxReportConfig((prev) => ({
                        ...prev,
                        sortBy: e.target.value as AuxiliaryBookReportConfig['sortBy'],
                      }))
                    }
                    className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 font-semibold"
                  >
                    <option value="FECHA_ASC">Cronológico Ascendente (Ley)</option>
                    <option value="FECHA_DESC">Cronológico Descendente</option>
                    <option value="RUT">Por RUT Auxiliar</option>
                    <option value="RAZON_SOCIAL">Por Razón Social (A-Z)</option>
                    <option value="MONTO_DESC">Por Mayor Monto Bruto</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    4. Orientación PDF &amp; Folio Legal
                  </label>
                  <div className="flex items-center gap-1.5">
                    <select
                      value={auxReportConfig.orientation}
                      onChange={(e) =>
                        setAuxReportConfig((prev) => ({
                          ...prev,
                          orientation: e.target.value as 'landscape' | 'portrait',
                        }))
                      }
                      className="flex-1 text-xs bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-slate-800 font-semibold"
                    >
                      <option value="landscape">Horizontal (Landscape)</option>
                      <option value="portrait">Vertical (Portrait)</option>
                    </select>
                    <input
                      type="number"
                      min={1}
                      value={auxReportConfig.folioInicial}
                      onChange={(e) =>
                        setAuxReportConfig((prev) => ({
                          ...prev,
                          folioInicial: Math.max(1, Number(e.target.value) || 1),
                        }))
                      }
                      className="w-20 text-xs font-mono bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-slate-800"
                      title="N° Folio Legal Inicial Timbrado"
                      placeholder="Folio"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    5. Título Personalizado (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Libro Auxiliar Oficial Octubre 2026"
                    value={auxReportConfig.customTitle}
                    onChange={(e) =>
                      setAuxReportConfig((prev) => ({ ...prev, customTitle: e.target.value }))
                    }
                    className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800"
                  />
                </div>
              </div>

              {/* Selector de Columnas Personalizables */}
              <div className="bg-white border border-violet-100 rounded-lg p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Columnas Visibles y Exportables del Libro Auxiliar
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setAuxReportConfig((prev) => ({
                          ...prev,
                          columns: {
                            correlativo: true,
                            fecha: true,
                            tipoDocSii: true,
                            folioDoc: true,
                            fechaVencimiento: true,
                            rutAuxiliar: true,
                            razonSocial: true,
                            cuentaContable: true,
                            glosaConcepto: true,
                            desgloseIva: true,
                            debeHaber: true,
                            saldoProgresivo: true,
                            trazabilidadBancaria: true,
                            centroCosto: true,
                          },
                        }))
                      }
                      className="text-[11px] font-semibold text-violet-700 hover:underline cursor-pointer"
                    >
                      Marcar todas
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() =>
                        setAuxReportConfig((prev) => ({
                          ...prev,
                          columns: {
                            correlativo: true,
                            fecha: true,
                            tipoDocSii: true,
                            folioDoc: true,
                            fechaVencimiento: false,
                            rutAuxiliar: true,
                            razonSocial: true,
                            cuentaContable: true,
                            glosaConcepto: false,
                            desgloseIva: true,
                            debeHaber: true,
                            saldoProgresivo: true,
                            trazabilidadBancaria: false,
                            centroCosto: false,
                          },
                        }))
                      }
                      className="text-[11px] font-semibold text-slate-600 hover:underline cursor-pointer"
                    >
                      Estándar Legal SII
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-xs">
                  {[
                    { key: 'correlativo', label: 'N° Correlativo' },
                    { key: 'fecha', label: 'Fecha Contable' },
                    { key: 'tipoDocSii', label: 'Código / Tipo SII' },
                    { key: 'folioDoc', label: 'Folio Documento' },
                    { key: 'fechaVencimiento', label: 'Fecha Vencimiento' },
                    { key: 'rutAuxiliar', label: 'RUT Auxiliar' },
                    { key: 'razonSocial', label: 'Razón Social' },
                    { key: 'cuentaContable', label: 'Cuenta Mayor IFRS' },
                    { key: 'glosaConcepto', label: 'Glosa / Concepto' },
                    { key: 'desgloseIva', label: 'Exento / Neto / IVA' },
                    { key: 'debeHaber', label: 'Debe / Haber ($)' },
                    { key: 'saldoProgresivo', label: 'Saldo Acumulado' },
                    { key: 'trazabilidadBancaria', label: 'Banco / Medio Pago' },
                    { key: 'centroCosto', label: 'Centro de Costo' },
                  ].map((col) => {
                    const checked =
                      auxReportConfig.columns[col.key as keyof AuxiliaryBookReportConfig['columns']];
                    return (
                      <label
                        key={col.key}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border cursor-pointer transition-colors ${
                          checked
                            ? 'bg-violet-50 border-violet-300 text-violet-950 font-semibold'
                            : 'bg-slate-50 border-slate-200 text-slate-500'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setAuxReportConfig((prev) => ({
                              ...prev,
                              columns: {
                                ...prev.columns,
                                [col.key]: e.target.checked,
                              },
                            }))
                          }
                          className="rounded text-violet-600 focus:ring-violet-500"
                        />
                        <span className="truncate text-[11px]">{col.label}</span>
                      </label>
                    );
                  })}
                </div>

                {/* Opciones de Certificación Legal */}
                <div className="flex flex-wrap items-center justify-between gap-3 mt-3 pt-3 border-t border-slate-100">
                  <div className="flex flex-wrap items-center gap-4 text-xs">
                    <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                      <input
                        type="checkbox"
                        checked={auxReportConfig.includeLegalSummary}
                        onChange={(e) =>
                          setAuxReportConfig((prev) => ({
                            ...prev,
                            includeLegalSummary: e.target.checked,
                          }))
                        }
                        className="rounded text-violet-600"
                      />
                      <span>Incluir Cuadro Legal de Centralización SII por Tipo DTE (Art. 59 DL 825)</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                      <input
                        type="checkbox"
                        checked={auxReportConfig.includeSignatures}
                        onChange={(e) =>
                          setAuxReportConfig((prev) => ({
                            ...prev,
                            includeSignatures: e.target.checked,
                          }))
                        }
                        className="rounded text-violet-600"
                      />
                      <span>Incluir Pie de Firmas (Contador General y Representante Legal)</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                      <input
                        type="checkbox"
                        checked={auxReportConfig.includeZeroBalance}
                        onChange={(e) =>
                          setAuxReportConfig((prev) => ({
                            ...prev,
                            includeZeroBalance: e.target.checked,
                          }))
                        }
                        className="rounded text-violet-600"
                      />
                      <span>Incluir Auxiliares Saldados ($0)</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Sub-tab Switcher & Filter Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setAuxiliarSubTab('PROVEEDORES');
                  setAuxReportConfig((prev) => ({ ...prev, bookScope: 'PROVEEDORES' }));
                  setSelectedAuxiliarRut(null);
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                  auxReportConfig.bookScope === 'PROVEEDORES'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Building2 className="w-3.5 h-3.5 text-amber-600" />
                <span>Auxiliar de Proveedores (CxP 2.1.01)</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 font-mono">
                  {auxiliarSuppliersSummary.filter(s => s.saldoPendiente > 0).length} pendientes
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAuxiliarSubTab('CLIENTES');
                  setAuxReportConfig((prev) => ({ ...prev, bookScope: 'CLIENTES' }));
                  setSelectedAuxiliarRut(null);
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                  auxReportConfig.bookScope === 'CLIENTES'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-3.5 h-3.5 text-blue-600" />
                <span>Auxiliar de Clientes (CxC 1.1.03)</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-800 font-mono">
                  {auxiliarClientsSummary.filter(c => c.saldoPorCobrar > 0).length} por cobrar
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAuxReportConfig((prev) => ({ ...prev, bookScope: 'CONSOLIDADO' }));
                  if (auxiliarViewMode === 'RESUMEN_RUT') {
                    setAuxiliarViewMode('DETALLADO_FECHAS');
                  }
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  auxReportConfig.bookScope === 'CONSOLIDADO'
                    ? 'bg-white text-violet-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-violet-600" />
                <span>Consolidado General</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar por RUT, razón social o folio..."
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
                    {auxiliarViewMode === 'RESUMEN_RUT'
                      ? isSuppliers
                        ? 'Total Compras Facturadas (SII)'
                        : 'Total Ventas Facturadas (SII)'
                      : `Saldo Inicial (al ${auxiliarDateFrom})`}
                  </span>
                  <div className="font-mono font-bold text-slate-900 text-lg mt-1">
                    {convertAmount(
                      auxiliarViewMode === 'RESUMEN_RUT'
                        ? totalFact
                        : auxiliaryBookReportPayload.saldoInicialGlobal
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {auxiliarViewMode === 'RESUMEN_RUT'
                      ? `${dataList.length} ${isSuppliers ? 'proveedores registrados' : 'clientes registrados'}`
                      : `Arrastre previo a ${auxiliarDateFrom}`}
                  </span>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                    {auxiliarViewMode === 'RESUMEN_RUT'
                      ? isSuppliers
                        ? 'Total Pagos Imputados'
                        : 'Total Cobros Imputados'
                      : 'Movimientos en Rango (Debe / Haber)'}
                  </span>
                  <div className="font-mono font-bold text-emerald-700 text-lg mt-1">
                    {auxiliarViewMode === 'RESUMEN_RUT'
                      ? convertAmount(totalCancelado)
                      : `${convertAmount(auxiliaryBookReportPayload.totalDebePeriodo)} / ${convertAmount(
                          auxiliaryBookReportPayload.totalHaberPeriodo
                        )}`}
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {auxiliarViewMode === 'RESUMEN_RUT'
                      ? 'Comprobantes bancarios y de caja'
                      : `${auxiliaryBookReportPayload.movements.length} registros entre ${auxiliarDateFrom} y ${auxiliarDateTo}`}
                  </span>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                    {isSuppliers ? 'Saldo Total por Pagar (Pasivo)' : 'Saldo Total por Cobrar (Activo)'}
                  </span>
                  <div className={`font-mono font-bold text-lg mt-1 ${totalSaldo > 0 ? 'text-amber-600' : 'text-emerald-700'}`}>
                    {convertAmount(
                      auxiliarViewMode === 'RESUMEN_RUT'
                        ? totalSaldo
                        : auxiliaryBookReportPayload.saldoFinalGlobal
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {isSuppliers ? 'Exigible ante proveedores' : 'Cartera vigente a cobrar'}
                  </span>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                    Estado de Cuadre Legal &amp; SII
                  </span>
                  <div className="font-bold text-sm mt-1 text-slate-800 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Sincronizado con Mayor</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">
                    Folio Legal N° {String(auxReportConfig.folioInicial).padStart(6, '0')} | RCV Cuadrado
                  </span>
                </div>
              </div>
            );
          })()}

          {/* ========================================================================= */}
          {/* VISTA 2 Y 3: LIBRO DETALLADO POR RANGO DE FECHAS Y LIBRO OFICIAL SEGÚN LEY */}
          {/* ========================================================================= */}
          {(auxiliarViewMode === 'DETALLADO_FECHAS' || auxiliarViewMode === 'LIBRO_SEGUN_LEY') && (
            <div className="space-y-5">
              {/* Encabezado Legal Oficial si estamos en LIBRO_SEGUN_LEY */}
              {auxiliarViewMode === 'LIBRO_SEGUN_LEY' && (
                <div className="bg-slate-900 text-white rounded-xl p-5 border border-slate-800 shadow-xs">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-700 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-mono text-[10px] font-extrabold uppercase">
                          TIMBRAJE ELECTRÓNICO SII — FOLIO N° {String(auxReportConfig.folioInicial).padStart(6, '0')}
                        </span>
                        <span className="text-xs text-slate-300 font-mono">
                          Art. 25 al 30 Código de Comercio | Art. 59 D.L. 825 | Res. Ex. SII N° 45 y N° 61
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-white mt-1.5 uppercase tracking-wide">
                        {auxReportConfig.customTitle?.trim() ||
                          (auxReportConfig.bookScope === 'PROVEEDORES'
                            ? 'LIBRO AUXILIAR OFICIAL DE PROVEEDORES Y CUENTAS POR PAGAR (CUENTA MAYOR 2.1.01)'
                            : auxReportConfig.bookScope === 'CLIENTES'
                            ? 'LIBRO AUXILIAR OFICIAL DE CLIENTES Y CUENTAS POR COBRAR (CUENTA MAYOR 1.1.03)'
                            : 'LIBRO AUXILIAR CONSOLIDADO DE CUENTAS CORRIENTES MERCANTILES')}
                      </h4>
                    </div>
                    <div className="text-left lg:text-right font-mono text-xs space-y-0.5 text-slate-300">
                      <div className="font-bold text-white">{effectiveCompany.razonSocial}</div>
                      <div>RUT: {effectiveCompany.rut} | Giro: {effectiveCompany.giro || 'Servicios y Comercio'}</div>
                      <div className="text-amber-300 font-semibold">
                        Período Tributario: {auxiliarDateFrom} al {auxiliarDateTo}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-3 text-xs font-mono">
                    <div>
                      <span className="text-slate-400 text-[10px] block uppercase">Monto Exento SII</span>
                      <span className="font-bold text-white">{convertAmount(auxiliaryBookReportPayload.totalExentoPeriodo)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block uppercase">Monto Neto Afecto</span>
                      <span className="font-bold text-white">{convertAmount(auxiliaryBookReportPayload.totalNetoPeriodo)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block uppercase">IVA 19% (D.L. 825)</span>
                      <span className="font-bold text-amber-300">{convertAmount(auxiliaryBookReportPayload.totalIvaPeriodo)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block uppercase">Total Bruto Documentado</span>
                      <span className="font-bold text-white">{convertAmount(auxiliaryBookReportPayload.totalBrutoPeriodo)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block uppercase">Saldo Cierre Libro Mayor</span>
                      <span className="font-bold text-emerald-400">{convertAmount(auxiliaryBookReportPayload.saldoFinalGlobal)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Tabla Cronológica Detallada por Rango de Fechas / Libro Según Ley */}
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="bg-slate-800 text-white font-semibold border-b border-slate-700 uppercase text-[10px] font-mono">
                      {(auxiliarViewMode === 'LIBRO_SEGUN_LEY' || auxReportConfig.columns.correlativo) && (
                        <th className="py-2.5 px-2.5 text-center">N°</th>
                      )}
                      {(auxiliarViewMode === 'LIBRO_SEGUN_LEY' || auxReportConfig.columns.fecha) && (
                        <th className="py-2.5 px-2.5">Fecha</th>
                      )}
                      {(auxiliarViewMode === 'LIBRO_SEGUN_LEY' || auxReportConfig.columns.tipoDocSii) && (
                        <th className="py-2.5 px-2.5">Cód. SII / Tipo Doc.</th>
                      )}
                      {(auxiliarViewMode === 'LIBRO_SEGUN_LEY' || auxReportConfig.columns.folioDoc) && (
                        <th className="py-2.5 px-2.5">Folio</th>
                      )}
                      {auxReportConfig.columns.fechaVencimiento && (
                        <th className="py-2.5 px-2.5">Vencim.</th>
                      )}
                      {(auxiliarViewMode === 'LIBRO_SEGUN_LEY' || auxReportConfig.columns.rutAuxiliar) && (
                        <th className="py-2.5 px-2.5">RUT Auxiliar</th>
                      )}
                      {(auxiliarViewMode === 'LIBRO_SEGUN_LEY' || auxReportConfig.columns.razonSocial) && (
                        <th className="py-2.5 px-2.5">Razón Social Contraparte</th>
                      )}
                      {(auxiliarViewMode === 'LIBRO_SEGUN_LEY' || auxReportConfig.columns.cuentaContable) && (
                        <th className="py-2.5 px-2.5">Cuenta Mayor</th>
                      )}
                      {auxReportConfig.columns.glosaConcepto && (
                        <th className="py-2.5 px-2.5">Glosa / Concepto Operación</th>
                      )}
                      {(auxiliarViewMode === 'LIBRO_SEGUN_LEY' || auxReportConfig.columns.desgloseIva) && (
                        <>
                          <th className="py-2.5 px-2.5 text-right">Exento ($)</th>
                          <th className="py-2.5 px-2.5 text-right">Neto ($)</th>
                          <th className="py-2.5 px-2.5 text-right">IVA 19% ($)</th>
                        </>
                      )}
                      {(auxiliarViewMode === 'LIBRO_SEGUN_LEY' || auxReportConfig.columns.debeHaber) && (
                        <>
                          <th className="py-2.5 px-2.5 text-right">Debe ($)</th>
                          <th className="py-2.5 px-2.5 text-right">Haber ($)</th>
                        </>
                      )}
                      {(auxiliarViewMode === 'LIBRO_SEGUN_LEY' || auxReportConfig.columns.saldoProgresivo) && (
                        <th className="py-2.5 px-2.5 text-right">Saldo Acum. ($)</th>
                      )}
                      {auxReportConfig.columns.trazabilidadBancaria && (
                        <th className="py-2.5 px-2.5">Trazabilidad / Estado</th>
                      )}
                      {auxReportConfig.columns.centroCosto && (
                        <th className="py-2.5 px-2.5">C. Costo</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    {/* Fila de Saldo Inicial de Apertura del Rango */}
                    <tr className="bg-slate-100/90 font-bold text-slate-800">
                      <td
                        colSpan={
                          (auxiliarViewMode === 'LIBRO_SEGUN_LEY' || auxReportConfig.columns.correlativo ? 1 : 0) +
                          (auxiliarViewMode === 'LIBRO_SEGUN_LEY' || auxReportConfig.columns.fecha ? 1 : 0) +
                          (auxiliarViewMode === 'LIBRO_SEGUN_LEY' || auxReportConfig.columns.tipoDocSii ? 1 : 0) +
                          (auxiliarViewMode === 'LIBRO_SEGUN_LEY' || auxReportConfig.columns.folioDoc ? 1 : 0) +
                          (auxReportConfig.columns.fechaVencimiento ? 1 : 0) +
                          (auxiliarViewMode === 'LIBRO_SEGUN_LEY' || auxReportConfig.columns.rutAuxiliar ? 1 : 0) +
                          (auxiliarViewMode === 'LIBRO_SEGUN_LEY' || auxReportConfig.columns.razonSocial ? 1 : 0) +
                          (auxiliarViewMode === 'LIBRO_SEGUN_LEY' || auxReportConfig.columns.cuentaContable ? 1 : 0) +
                          (auxReportConfig.columns.glosaConcepto ? 1 : 0)
                        }
                        className="py-2 px-3 font-sans text-xs text-slate-800"
                      >
                        SALDO INICIAL ACUMULADO ANTERIOR AL {auxiliarDateFrom}
                      </td>
                      {(auxiliarViewMode === 'LIBRO_SEGUN_LEY' || auxReportConfig.columns.desgloseIva) && (
                        <>
                          <td className="py-2 px-2.5 text-right text-slate-400">-</td>
                          <td className="py-2 px-2.5 text-right text-slate-400">-</td>
                          <td className="py-2 px-2.5 text-right text-slate-400">-</td>
                        </>
                      )}
                      {(auxiliarViewMode === 'LIBRO_SEGUN_LEY' || auxReportConfig.columns.debeHaber) && (
                        <>
                          <td className="py-2 px-2.5 text-right text-slate-400">-</td>
                          <td className="py-2 px-2.5 text-right text-slate-400">-</td>
                        </>
                      )}
                      {(auxiliarViewMode === 'LIBRO_SEGUN_LEY' || auxReportConfig.columns.saldoProgresivo) && (
                        <td className="py-2 px-2.5 text-right text-indigo-900 font-extrabold">
                          {convertAmount(auxiliaryBookReportPayload.saldoInicialGlobal)}
                        </td>
                      )}
                      {auxReportConfig.columns.trazabilidadBancaria && (
                        <td className="py-2 px-2.5 text-slate-500 font-sans text-[10px]">APERTURA RANGO</td>
                      )}
                      {auxReportConfig.columns.centroCosto && (
                        <td className="py-2 px-2.5 text-slate-400">-</td>
                      )}
                    </tr>

                    {auxiliaryBookReportPayload.movements.length === 0 ? (
                      <tr>
                        <td colSpan={18} className="py-8 text-center text-slate-400 font-sans">
                          No se registran movimientos auxiliares en el rango de fechas {auxiliarDateFrom} al {auxiliarDateTo}.
                        </td>
                      </tr>
                    ) : (
                      auxiliaryBookReportPayload.movements.map((m) => (
                        <tr key={m.id} className="hover:bg-slate-50/90 transition-colors">
                          {(auxiliarViewMode === 'LIBRO_SEGUN_LEY' || auxReportConfig.columns.correlativo) && (
                            <td className="py-2 px-2.5 text-center text-slate-500">{m.correlativo}</td>
                          )}
                          {(auxiliarViewMode === 'LIBRO_SEGUN_LEY' || auxReportConfig.columns.fecha) && (
                            <td className="py-2 px-2.5 text-slate-700 whitespace-nowrap">{m.fecha}</td>
                          )}
                          {(auxiliarViewMode === 'LIBRO_SEGUN_LEY' || auxReportConfig.columns.tipoDocSii) && (
                            <td className="py-2 px-2.5 whitespace-nowrap">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold mr-1 ${
                                  m.codigoSii === 'COMP'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : m.codigoSii === '61'
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-indigo-100 text-indigo-900'
                                }`}
                              >
                                {m.codigoSii}
                              </span>
                              <span className="font-sans text-slate-700">{m.tipoDocLabel}</span>
                            </td>
                          )}
                          {(auxiliarViewMode === 'LIBRO_SEGUN_LEY' || auxReportConfig.columns.folioDoc) && (
                            <td className="py-2 px-2.5 font-bold text-slate-900 whitespace-nowrap">
                              {m.folio}
                            </td>
                          )}
                          {auxReportConfig.columns.fechaVencimiento && (
                            <td className="py-2 px-2.5 text-slate-500 whitespace-nowrap">
                              {m.fechaVencimiento}
                            </td>
                          )}
                          {(auxiliarViewMode === 'LIBRO_SEGUN_LEY' || auxReportConfig.columns.rutAuxiliar) && (
                            <td className="py-2 px-2.5 font-bold text-slate-800 whitespace-nowrap">
                              {m.rutAuxiliar}
                            </td>
                          )}
                          {(auxiliarViewMode === 'LIBRO_SEGUN_LEY' || auxReportConfig.columns.razonSocial) && (
                            <td className="py-2 px-2.5 font-sans font-medium text-slate-900 max-w-xs truncate">
                              {m.razonSocial}
                            </td>
                          )}
                          {(auxiliarViewMode === 'LIBRO_SEGUN_LEY' || auxReportConfig.columns.cuentaContable) && (
                            <td className="py-2 px-2.5 text-slate-600 whitespace-nowrap" title={m.cuentaNombre}>
                              {m.cuentaCodigo}
                            </td>
                          )}
                          {auxReportConfig.columns.glosaConcepto && (
                            <td className="py-2 px-2.5 font-sans text-slate-600 max-w-xs truncate" title={m.concepto}>
                              {m.concepto}
                            </td>
                          )}
                          {(auxiliarViewMode === 'LIBRO_SEGUN_LEY' || auxReportConfig.columns.desgloseIva) && (
                            <>
                              <td className="py-2 px-2.5 text-right text-slate-600 whitespace-nowrap">
                                {m.montoExento > 0 ? convertAmount(m.montoExento) : '-'}
                              </td>
                              <td className="py-2 px-2.5 text-right text-slate-800 whitespace-nowrap">
                                {m.montoNeto > 0 ? convertAmount(m.montoNeto) : '-'}
                              </td>
                              <td className="py-2 px-2.5 text-right text-slate-700 whitespace-nowrap">
                                {m.montoIva > 0 ? convertAmount(m.montoIva) : '-'}
                              </td>
                            </>
                          )}
                          {(auxiliarViewMode === 'LIBRO_SEGUN_LEY' || auxReportConfig.columns.debeHaber) && (
                            <>
                              <td className="py-2 px-2.5 text-right font-semibold text-emerald-700 whitespace-nowrap">
                                {m.debe > 0 ? convertAmount(m.debe) : '-'}
                              </td>
                              <td className="py-2 px-2.5 text-right font-semibold text-blue-700 whitespace-nowrap">
                                {m.haber > 0 ? convertAmount(m.haber) : '-'}
                              </td>
                            </>
                          )}
                          {(auxiliarViewMode === 'LIBRO_SEGUN_LEY' || auxReportConfig.columns.saldoProgresivo) && (
                            <td className="py-2 px-2.5 text-right font-bold text-slate-900 whitespace-nowrap">
                              {convertAmount(m.saldoProgresivo)}
                            </td>
                          )}
                          {auxReportConfig.columns.trazabilidadBancaria && (
                            <td className="py-2 px-2.5 font-sans text-[11px] text-slate-600 whitespace-nowrap">
                              {m.bancoTrazabilidad}
                            </td>
                          )}
                          {auxReportConfig.columns.centroCosto && (
                            <td className="py-2 px-2.5 text-slate-500 whitespace-nowrap">
                              {m.centroCosto}
                            </td>
                          )}
                        </tr>
                      ))
                    )}

                    {/* Fila de Totales del Período */}
                    <tr className="bg-slate-800 text-white font-bold">
                      <td
                        colSpan={
                          (auxiliarViewMode === 'LIBRO_SEGUN_LEY' || auxReportConfig.columns.correlativo ? 1 : 0) +
                          (auxiliarViewMode === 'LIBRO_SEGUN_LEY' || auxReportConfig.columns.fecha ? 1 : 0) +
                          (auxiliarViewMode === 'LIBRO_SEGUN_LEY' || auxReportConfig.columns.tipoDocSii ? 1 : 0) +
                          (auxiliarViewMode === 'LIBRO_SEGUN_LEY' || auxReportConfig.columns.folioDoc ? 1 : 0) +
                          (auxReportConfig.columns.fechaVencimiento ? 1 : 0) +
                          (auxiliarViewMode === 'LIBRO_SEGUN_LEY' || auxReportConfig.columns.rutAuxiliar ? 1 : 0) +
                          (auxiliarViewMode === 'LIBRO_SEGUN_LEY' || auxReportConfig.columns.razonSocial ? 1 : 0) +
                          (auxiliarViewMode === 'LIBRO_SEGUN_LEY' || auxReportConfig.columns.cuentaContable ? 1 : 0) +
                          (auxReportConfig.columns.glosaConcepto ? 1 : 0)
                        }
                        className="py-2.5 px-3 font-sans text-xs"
                      >
                        SUMAS TOTALES DEL PERÍODO ({auxiliarDateFrom} AL {auxiliarDateTo}) — {auxiliaryBookReportPayload.movements.length} REGISTROS
                      </td>
                      {(auxiliarViewMode === 'LIBRO_SEGUN_LEY' || auxReportConfig.columns.desgloseIva) && (
                        <>
                          <td className="py-2.5 px-2.5 text-right whitespace-nowrap">
                            {convertAmount(auxiliaryBookReportPayload.totalExentoPeriodo)}
                          </td>
                          <td className="py-2.5 px-2.5 text-right whitespace-nowrap">
                            {convertAmount(auxiliaryBookReportPayload.totalNetoPeriodo)}
                          </td>
                          <td className="py-2.5 px-2.5 text-right text-amber-300 whitespace-nowrap">
                            {convertAmount(auxiliaryBookReportPayload.totalIvaPeriodo)}
                          </td>
                        </>
                      )}
                      {(auxiliarViewMode === 'LIBRO_SEGUN_LEY' || auxReportConfig.columns.debeHaber) && (
                        <>
                          <td className="py-2.5 px-2.5 text-right text-emerald-300 whitespace-nowrap">
                            {convertAmount(auxiliaryBookReportPayload.totalDebePeriodo)}
                          </td>
                          <td className="py-2.5 px-2.5 text-right text-sky-300 whitespace-nowrap">
                            {convertAmount(auxiliaryBookReportPayload.totalHaberPeriodo)}
                          </td>
                        </>
                      )}
                      {(auxiliarViewMode === 'LIBRO_SEGUN_LEY' || auxReportConfig.columns.saldoProgresivo) && (
                        <td className="py-2.5 px-2.5 text-right text-amber-300 font-extrabold whitespace-nowrap">
                          {convertAmount(auxiliaryBookReportPayload.saldoFinalGlobal)}
                        </td>
                      )}
                      {auxReportConfig.columns.trazabilidadBancaria && (
                        <td className="py-2.5 px-2.5 font-sans text-[10px] text-emerald-300">
                          CUADRADO SII / MAYOR
                        </td>
                      )}
                      {auxReportConfig.columns.centroCosto && <td className="py-2.5 px-2.5">-</td>}
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Cuadro Legal de Centralización Mensual por Tipo de Documento SII (Art. 59 DL 825 / Res. Ex. SII N° 45) */}
              {(auxiliarViewMode === 'LIBRO_SEGUN_LEY' || auxReportConfig.includeLegalSummary) &&
                auxiliaryBookReportPayload.legalSummaryByDocType.length > 0 && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h5 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                          <Scale className="w-4 h-4 text-violet-700" />
                          Resumen Legal de Centralización Contable y Tributaria por Tipo de Documento SII
                        </h5>
                        <p className="text-[11px] text-slate-500">
                          Exigido por Art. 59 D.L. 825 (Ley de IVA) y Resoluciones Exentas SII N° 45 y N° 61 para respaldo de centralización en Libro Diario y Libro Mayor.
                        </p>
                      </div>
                      <span className="text-[11px] font-mono font-bold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-lg">
                        Cuadratura Exacta con F29 / RCV SII
                      </span>
                    </div>

                    <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white">
                      <table className="w-full text-xs text-left font-mono">
                        <thead className="bg-slate-100 text-slate-700 text-[10px] uppercase border-b border-slate-200">
                          <tr>
                            <th className="py-2 px-3">Código SII</th>
                            <th className="py-2 px-3">Tipo de Documento / Comprobante</th>
                            <th className="py-2 px-3 text-center">N° Docs.</th>
                            <th className="py-2 px-3 text-right">Exento ($)</th>
                            <th className="py-2 px-3 text-right">Neto Afecto ($)</th>
                            <th className="py-2 px-3 text-right">IVA 19% ($)</th>
                            <th className="py-2 px-3 text-right">Retenciones ($)</th>
                            <th className="py-2 px-3 text-right">Total Bruto ($)</th>
                            <th className="py-2 px-3 text-right">Cargos Debe ($)</th>
                            <th className="py-2 px-3 text-right">Abonos Haber ($)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {auxiliaryBookReportPayload.legalSummaryByDocType.map((s) => (
                            <tr key={s.codigoSii} className="hover:bg-slate-50">
                              <td className="py-2 px-3 font-bold text-indigo-900">Código {s.codigoSii}</td>
                              <td className="py-2 px-3 font-sans font-medium text-slate-800">{s.nombreDocumento}</td>
                              <td className="py-2 px-3 text-center font-bold">{s.cantidadDocumentos}</td>
                              <td className="py-2 px-3 text-right">{convertAmount(s.totalExento)}</td>
                              <td className="py-2 px-3 text-right">{convertAmount(s.totalNeto)}</td>
                              <td className="py-2 px-3 text-right">{convertAmount(s.totalIva)}</td>
                              <td className="py-2 px-3 text-right">{convertAmount(s.totalRetencion)}</td>
                              <td className="py-2 px-3 text-right font-bold text-slate-900">{convertAmount(s.totalBruto)}</td>
                              <td className="py-2 px-3 text-right text-emerald-700 font-semibold">{convertAmount(s.totalDebe)}</td>
                              <td className="py-2 px-3 text-right text-blue-700 font-semibold">{convertAmount(s.totalHaber)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* VISTA 1: RESUMEN POR AUXILIAR (TABLA PRINCIPAL POR RUT CON DESPLEGABLE)   */}
          {/* ========================================================================= */}
          {auxiliarViewMode === 'RESUMEN_RUT' && (
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
                                    // Abrir modal de nuevo asiento con este auxiliar y su documento pendiente pre-seleccionado
                                    const isProv = auxiliarSubTab === 'PROVEEDORES';
                                    const pendingDoc = (item as any).pendingDocuments?.[0];
                                    const pendingDte = item.dtes.find(d => d.estadoPago === 'PENDIENTE') || item.dtes[0];

                                    const docRefLabel = pendingDoc
                                      ? `${pendingDoc.tipoLabel || 'Factura'} F.${pendingDoc.folio}`
                                      : pendingDte
                                      ? `Factura Electrónica F.${pendingDte.folio}`
                                      : 'Factura F.1';
                                    const docFolio = pendingDoc ? String(pendingDoc.folio) : pendingDte ? String(pendingDte.folio) : '1';
                                    const docTipo = pendingDoc ? pendingDoc.tipo : pendingDte ? (pendingDte.tipoDte === '33' ? 'FACTURA_ELECTRONICA_33' : 'DTE_SII') : 'FACTURA_ELECTRONICA_33';
                                    const docMontoTotal = pendingDoc ? pendingDoc.montoTotal : pendingDte ? pendingDte.montoTotal : saldo;
                                    const docMontoAplicar = pendingDoc ? pendingDoc.saldoPendiente : pendingDte ? pendingDte.montoTotal : saldo;
                                    const defaultAccountingDate = getDefaultAccountingDate(effectiveCompany);
                                    const docFechaEmision = pendingDoc ? (pendingDoc.fechaEmision || defaultAccountingDate) : pendingDte ? (pendingDte.fechaEmision || defaultAccountingDate) : defaultAccountingDate;
                                    const docFechaVenc = pendingDoc ? (pendingDoc.fechaVencimiento || pendingDoc.fechaEmision || defaultAccountingDate) : pendingDte ? (pendingDte.fechaVencimiento || pendingDte.fechaEmision || defaultAccountingDate) : defaultAccountingDate;
                                    const dteIdAsoc = pendingDoc?.dteId || pendingDte?.id || '';

                                    setManualEntry({
                                      fecha: defaultAccountingDate,
                                      concepto: isProv
                                        ? `Pago a Proveedor ${item.razonSocial} - ${docRefLabel}`
                                        : `Cobranza de Cliente ${item.razonSocial} - ${docRefLabel}`,
                                      documentoReferencia: docRefLabel,
                                      origen: 'CAJA_BANCO',
                                      lineas: isProv
                                        ? [
                                            {
                                              cuentaCodigo: '2.1.01.001',
                                              cuentaNombre: 'Proveedores Nacionales (Cuentas por Pagar)',
                                              debe: docMontoAplicar,
                                              haber: 0,
                                              rutAuxiliar: item.rut,
                                              nombreAuxiliar: item.razonSocial,
                                              centroCosto: '',
                                              documentoRef: docRefLabel,
                                              tipoDocumentoRef: docTipo,
                                              folioDocumentoRef: docFolio,
                                              montoDocumentoRef: docMontoTotal,
                                              fechaDocumentoRef: docFechaEmision,
                                              fechaVencimientoRef: docFechaVenc,
                                              documentoOperacion: `TEF-${docFolio}`,
                                              tipoDocumentoOperacion: 'TRANSFERENCIA',
                                              fechaDocumentoOperacion: defaultAccountingDate,
                                              dteIdAsociado: dteIdAsoc,
                                            },
                                            {
                                              cuentaCodigo: '1.1.02.001',
                                              cuentaNombre: 'Banco Santander Chile Cta Cte M/N',
                                              debe: 0,
                                              haber: docMontoAplicar,
                                              rutAuxiliar: item.rut,
                                              nombreAuxiliar: item.razonSocial,
                                              centroCosto: '',
                                              documentoRef: `TEF-${docFolio}`,
                                              tipoDocumentoConciliacion: 'TRANSFERENCIA',
                                              documentoConciliacion: `TEF-${docFolio}`,
                                              fechaDocumentoRef: defaultAccountingDate,
                                              fechaVencimientoRef: defaultAccountingDate,
                                              dteIdAsociado: '',
                                            },
                                          ]
                                        : [
                                            {
                                              cuentaCodigo: '1.1.02.001',
                                              cuentaNombre: 'Banco Santander Chile Cta Cte M/N',
                                              debe: docMontoAplicar,
                                              haber: 0,
                                              rutAuxiliar: item.rut,
                                              nombreAuxiliar: item.razonSocial,
                                              centroCosto: '',
                                              documentoRef: `TEF-${docFolio}`,
                                              tipoDocumentoConciliacion: 'TRANSFERENCIA',
                                              documentoConciliacion: `TEF-${docFolio}`,
                                              fechaDocumentoRef: defaultAccountingDate,
                                              fechaVencimientoRef: defaultAccountingDate,
                                              dteIdAsociado: '',
                                            },
                                            {
                                              cuentaCodigo: '1.1.03.001',
                                              cuentaNombre: 'Clientes Nacionales (Cuentas por Cobrar)',
                                              debe: 0,
                                              haber: docMontoAplicar,
                                              rutAuxiliar: item.rut,
                                              nombreAuxiliar: item.razonSocial,
                                              centroCosto: '',
                                              documentoRef: docRefLabel,
                                              tipoDocumentoRef: docTipo,
                                              folioDocumentoRef: docFolio,
                                              montoDocumentoRef: docMontoTotal,
                                              fechaDocumentoRef: docFechaEmision,
                                              fechaVencimientoRef: docFechaVenc,
                                              documentoOperacion: `TEF-${docFolio}`,
                                              tipoDocumentoOperacion: 'TRANSFERENCIA',
                                              fechaDocumentoOperacion: defaultAccountingDate,
                                              dteIdAsociado: dteIdAsoc,
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
                                            <th className="py-1.5 px-3 text-left">Medio Pago / Banco (Trazabilidad TEF / Cheque)</th>
                                            <th className="py-1.5 px-3 text-right">Debe ($)</th>
                                            <th className="py-1.5 px-3 text-right">Haber ($)</th>
                                            <th className="py-1.5 px-3 text-center">Acción</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 font-mono">
                                          {item.journalMovements.map((jm, jIdx) => {
                                            const bInfo = jm.bancoInfo;
                                            const instCode = bInfo?.instrumentoCodigo || 'TEF';
                                            const matchedEntry = safeEntries.find((e) => e.id === jm.asientoId);

                                            return (
                                              <tr key={jIdx} className="hover:bg-slate-50">
                                                <td className="py-2 px-3 text-slate-600 whitespace-nowrap">{jm.fecha}</td>
                                                <td className="py-2 px-3 font-sans text-slate-900">{jm.concepto}</td>
                                                <td className="py-2 px-3 font-sans text-slate-600 whitespace-nowrap">{jm.documento || '-'}</td>
                                                <td className="py-2 px-3 font-sans text-slate-700">
                                                  {bInfo ? (
                                                    instCode === 'DEVENGO' ? (
                                                      <div className="flex flex-col gap-0.5 text-[11px] leading-tight">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300 font-mono text-[10px] font-bold">
                                                            DEVENGO DOCUMENTARIO (SIN PAGO BANCARIO)
                                                          </span>
                                                        </div>
                                                        <div className="text-[10px] text-slate-500 font-mono">
                                                          <span>Doc: <strong>{bInfo.folioOperacion || '-'}</strong></span>
                                                          <span className="mx-1">•</span>
                                                          <span>F. Emisión: <strong>{bInfo.fechaOperacion || jm.fecha}</strong></span>
                                                          <span className="mx-1">•</span>
                                                          <span>F. Vencimiento: <strong>{bInfo.fechaCobro || jm.fecha}</strong></span>
                                                        </div>
                                                      </div>
                                                    ) : instCode === 'CHEQUE' ? (
                                                      <div className="flex flex-col gap-1 text-[11px] leading-tight">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                          <span className="font-bold text-slate-900 flex items-center gap-1">
                                                            <Landmark className="w-3.5 h-3.5 text-indigo-600 shrink-0 inline" />
                                                            {bInfo.bancoNombre || 'Banco / Cuenta Corriente'}
                                                          </span>
                                                          <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 font-mono text-[10px] font-extrabold uppercase">
                                                            CHEQUE
                                                          </span>
                                                        </div>
                                                        <div className="text-[10px] text-slate-700 font-mono bg-amber-50/70 border border-amber-200/80 rounded px-2 py-0.5 inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 w-fit">
                                                          <span>N° Cheque: <strong className="text-slate-950">{bInfo.folioOperacion || 'S/N'}</strong></span>
                                                          <span className="text-amber-400">|</span>
                                                          <span>F. Emisión: <strong className="text-slate-900">{bInfo.fechaOperacion || jm.fecha}</strong></span>
                                                          <span className="text-amber-400">|</span>
                                                          <span>F. Vencimiento: <strong className="text-amber-950">{bInfo.fechaCobro || bInfo.fechaOperacion || jm.fecha}</strong></span>
                                                        </div>
                                                      </div>
                                                    ) : (
                                                      <div className="flex flex-col gap-1 text-[11px] leading-tight">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                          <span className="font-bold text-slate-900 flex items-center gap-1">
                                                            <Landmark className="w-3.5 h-3.5 text-indigo-600 shrink-0 inline" />
                                                            {bInfo.bancoNombre || 'Banco / Cuenta Corriente'}
                                                          </span>
                                                          <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300 font-mono text-[10px] font-extrabold uppercase">
                                                            {instCode === 'TEF' ? 'TEF • Transferencia Electrónica' : bInfo.tipoMedio}
                                                          </span>
                                                        </div>
                                                        <div className="text-[10px] text-slate-700 font-mono bg-emerald-50/60 border border-emerald-200/80 rounded px-2 py-0.5 inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 w-fit">
                                                          <span>
                                                            {instCode === 'TEF' ? 'N° Operación TEF:' : 'N° Ref.:'}{' '}
                                                            <strong className="text-slate-950">{bInfo.folioOperacion || 'S/N'}</strong>
                                                          </span>
                                                          <span className="text-emerald-400">|</span>
                                                          <span>
                                                            {instCode === 'TEF' ? 'Fecha TEF:' : 'Fecha:'}{' '}
                                                            <strong className="text-slate-900">{bInfo.fechaOperacion || jm.fecha}</strong>
                                                          </span>
                                                          {bInfo.fechaCobro && bInfo.fechaCobro !== bInfo.fechaOperacion && (
                                                            <>
                                                              <span className="text-emerald-400">|</span>
                                                              <span>
                                                                Ejec./Cobro: <strong className="text-emerald-950">{bInfo.fechaCobro}</strong>
                                                              </span>
                                                            </>
                                                          )}
                                                        </div>
                                                      </div>
                                                    )
                                                  ) : (
                                                    <span className="text-slate-400 text-[11px]">-</span>
                                                  )}
                                                </td>
                                                <td className="py-2 px-3 text-right text-emerald-700 font-semibold whitespace-nowrap">
                                                  {jm.debe > 0 ? convertAmount(jm.debe) : '-'}
                                                </td>
                                                <td className="py-2 px-3 text-right text-blue-700 font-semibold whitespace-nowrap">
                                                  {jm.haber > 0 ? convertAmount(jm.haber) : '-'}
                                                </td>
                                                <td className="py-2 px-3 text-center whitespace-nowrap font-sans">
                                                  {matchedEntry && (
                                                    <button
                                                      type="button"
                                                      onClick={() => handleOpenEditEntry(matchedEntry)}
                                                      className="px-2 py-1 rounded text-[10px] font-bold bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 hover:border-blue-300 transition-colors cursor-pointer"
                                                      title="Editar medio de pago (TEF / Cheque, N° operación, fecha emisión y vencimiento)"
                                                    >
                                                      Editar TEF / Cheque
                                                    </button>
                                                  )}
                                                </td>
                                              </tr>
                                            );
                                          })}
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
          )}
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
                onClick={() => setIsProjectManagerModalOpen(true)}
                className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Catálogo y ABM de Proyectos y Obras para control WIP / IFRS Art. 31"
              >
                <Briefcase className="w-4 h-4 text-cyan-600" />
                <span>Gestionar Proyectos / Obras</span>
              </button>

              <button
                onClick={() => {
                  setAuxiliaryManagerFilter('ALL');
                  setIsAuxiliaryManagerModalOpen(true);
                }}
                className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Catálogo Maestro y ABM de Auxiliares (Proveedores, Clientes, Honorarios)"
              >
                <Users className="w-4 h-4 text-emerald-600" />
                <span>Gestionar Auxiliares</span>
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
                <option value="NOTAS">📑 Con Notas EE.FF. Asignadas</option>
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
                  <th className="py-2.5 px-3">Nombre de la Cuenta & Notas EE.FF.</th>
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
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span>{acc.nombre}</span>
                          {acc.agrupacionPersonalizada && (
                            <span className="text-[10px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded font-normal">
                              {acc.agrupacionPersonalizada}
                            </span>
                          )}
                          {getAccountNoteBadges(acc.codigo)}
                        </div>
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
                onClick={() => downloadFinancialNotesBookletPdf(financialNotes, balance8Col, chartOfAccounts, company as ClientCompany)}
                className="bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-semibold px-3.5 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                title="Descargar Cuadernillo Completo de Notas a los Estados Financieros en formato PDF"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Cuadernillo Notas (PDF)</span>
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
                    <div key={idx} className="flex justify-between items-center text-slate-500 text-[11px] pl-2 hover:bg-slate-50 rounded py-0.5">
                      <div className="flex items-center gap-1 min-w-0">
                        <span className="truncate">{i.nombre}</span>
                        {getAccountNoteBadges(i.codigo)}
                      </div>
                      <span className="font-mono font-medium text-slate-700 shrink-0">{convertAmount(i.saldo)}</span>
                    </div>
                  ))}

                  <div className="flex justify-between text-slate-700 font-medium pt-2">
                    <span>Activo No Corriente (Activo Fijo + IFRS 16):</span>
                    <span className="font-mono font-bold text-slate-900">
                      {convertAmount(ifrsStatements.estadoSituacion.activoNoCorriente.total)}
                    </span>
                  </div>
                  {ifrsStatements.estadoSituacion.activoNoCorriente.items.map((i, idx) => (
                    <div key={idx} className="flex justify-between items-center text-slate-500 text-[11px] pl-2 hover:bg-slate-50 rounded py-0.5">
                      <div className="flex items-center gap-1 min-w-0">
                        <span className="truncate">{i.nombre}</span>
                        {getAccountNoteBadges(i.codigo)}
                      </div>
                      <span className="font-mono font-medium text-slate-700 shrink-0">{convertAmount(i.saldo)}</span>
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
                  {ifrsStatements.estadoSituacion.pasivoCorriente.items.map((i, idx) => (
                    <div key={idx} className="flex justify-between items-center text-slate-500 text-[11px] pl-2 hover:bg-slate-50 rounded py-0.5">
                      <div className="flex items-center gap-1 min-w-0">
                        <span className="truncate">{i.nombre}</span>
                        {getAccountNoteBadges(i.codigo)}
                      </div>
                      <span className="font-mono font-medium text-slate-700 shrink-0">{convertAmount(i.saldo)}</span>
                    </div>
                  ))}

                  <div className="flex justify-between text-slate-700 font-medium pt-1">
                    <span>Pasivo No Corriente:</span>
                    <span className="font-mono font-bold text-slate-900">
                      {convertAmount(ifrsStatements.estadoSituacion.pasivoNoCorriente.total)}
                    </span>
                  </div>
                  {ifrsStatements.estadoSituacion.pasivoNoCorriente.items.map((i, idx) => (
                    <div key={idx} className="flex justify-between items-center text-slate-500 text-[11px] pl-2 hover:bg-slate-50 rounded py-0.5">
                      <div className="flex items-center gap-1 min-w-0">
                        <span className="truncate">{i.nombre}</span>
                        {getAccountNoteBadges(i.codigo)}
                      </div>
                      <span className="font-mono font-medium text-slate-700 shrink-0">{convertAmount(i.saldo)}</span>
                    </div>
                  ))}

                  <div className="flex justify-between text-slate-700 font-medium pt-1">
                    <span>Patrimonio Neto:</span>
                    <span className="font-mono font-bold text-slate-900">
                      {convertAmount(ifrsStatements.estadoSituacion.patrimonioNeto.total)}
                    </span>
                  </div>
                  {ifrsStatements.estadoSituacion.patrimonioNeto.items.map((i, idx) => (
                    <div key={idx} className="flex justify-between items-center text-slate-500 text-[11px] pl-2 hover:bg-slate-50 rounded py-0.5">
                      <div className="flex items-center gap-1 min-w-0">
                        <span className="truncate">{i.nombre}</span>
                        {getAccountNoteBadges(i.codigo)}
                      </div>
                      <span className="font-mono font-medium text-slate-700 shrink-0">{convertAmount(i.saldo)}</span>
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
                <p className="text-[11px] text-slate-500">Estructura oficial de margen, EBITDA y resultado del ejercicio vinculada a Notas</p>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-700 font-medium">Ingresos de Actividades Ordinarias:</span>
                    <button
                      onClick={() => navigateToNote(14)}
                      className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[9px] font-mono font-bold px-1.5 py-0.2 rounded transition-colors cursor-pointer"
                      title="Ver Nota 14: Ingresos de Actividades Ordinarias"
                    >
                      Nota 14
                    </button>
                  </div>
                  <span className="font-mono font-bold text-emerald-700">
                    {convertAmount(ifrsStatements.estadoResultados.ingresosOperacionales)}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-600">(-) Costo de Ventas:</span>
                    <button
                      onClick={() => navigateToNote(15)}
                      className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[9px] font-mono font-bold px-1.5 py-0.2 rounded transition-colors cursor-pointer"
                      title="Ver Nota 15: Costo de Ventas"
                    >
                      Nota 15
                    </button>
                  </div>
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

                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-600">(-) Gastos de Administración y Ventas:</span>
                    <button
                      onClick={() => navigateToNote(16)}
                      className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[9px] font-mono font-bold px-1.5 py-0.2 rounded transition-colors cursor-pointer"
                      title="Ver Nota 16: Gastos de Administración y Ventas"
                    >
                      Nota 16
                    </button>
                  </div>
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

                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-600">(-) Depreciación y Amortización (NIC 16 / IFRS 16):</span>
                    <button
                      onClick={() => navigateToNote(7)}
                      className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[9px] font-mono font-bold px-1.5 py-0.2 rounded transition-colors cursor-pointer"
                      title="Ver Nota 7 y 8: Activos Fijos y Arrendamientos"
                    >
                      Nota 7, 8
                    </button>
                  </div>
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

                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-600">(+) Otros Ingresos Fuera de Explotación:</span>
                    <button
                      onClick={() => navigateToNote(17)}
                      className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[9px] font-mono font-bold px-1.5 py-0.2 rounded transition-colors cursor-pointer"
                      title="Ver Nota 17: Resultados Financieros"
                    >
                      Nota 17
                    </button>
                  </div>
                  <span className="font-mono text-emerald-700">
                    {convertAmount(ifrsStatements.estadoResultados.otrosIngresos)}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-600">(-) Gastos Financieros y Reajustes:</span>
                    <button
                      onClick={() => navigateToNote(17)}
                      className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[9px] font-mono font-bold px-1.5 py-0.2 rounded transition-colors cursor-pointer"
                      title="Ver Nota 17: Resultados Financieros"
                    >
                      Nota 17
                    </button>
                  </div>
                  <span className="font-mono text-rose-700">
                    -{convertAmount(ifrsStatements.estadoResultados.otrosGastosFinancieros)}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-600">(-) Provisión Impuesto a la Renta (IDPC):</span>
                    <button
                      onClick={() => navigateToNote(6)}
                      className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[9px] font-mono font-bold px-1.5 py-0.2 rounded transition-colors cursor-pointer"
                      title="Ver Nota 6 y 11: Impuestos Corrientes y Fiscales"
                    >
                      Nota 6, 11
                    </button>
                  </div>
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

      {/* VIEW: NOTAS EXPLICATIVAS A LOS ESTADOS FINANCIEROS (NIIF / IFRS - CMF CHILE) */}
      {activeTab === 'NOTAS_EEFF' && (
        <FinancialStatementNotesView
          notes={financialNotes}
          chartOfAccounts={chartOfAccounts}
          balance8Col={balance8Col}
          company={company as ClientCompany}
          onUpdateNotes={handleUpdateFinancialNotes}
          onUpdateChartOfAccounts={handleUpdateChartAndSyncNotes}
          selectedNoteNumber={selectedNoteNumber}
          onSelectNoteNumber={(num) => setSelectedNoteNumber(num)}
          onNavigateToMayor={(accountCode) => {
            setSelectedMayorAccountCode(accountCode);
            setActiveTab('MAYOR');
          }}
        />
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
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setManualEntry(getInitialManualEntry());
                    setManualEntryError(null);
                    showToast('Formulario limpiado y restablecido a valores iniciales.', 'info');
                  }}
                  className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-300 cursor-pointer flex items-center gap-1.5"
                  title="Limpiar todos los campos del formulario"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Limpiar Formulario</span>
                </button>
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
                      const newDate = e.target.value;
                      const updatedLines = manualEntry.lineas.map(line => {
                        if (line.monedaOriginal && line.monedaOriginal !== 'CLP') {
                          const newRate = getExchangeRateForDate(line.monedaOriginal, newDate, effectiveCompany?.rut);
                          const valOrig = line.montoMonedaOriginal || 0;
                          const clp = Math.round(valOrig * newRate);
                          const wasHaber = Number(line.haber) > 0;
                          return {
                            ...line,
                            tipoCambio: newRate,
                            debe: wasHaber ? 0 : clp,
                            haber: wasHaber ? clp : 0,
                          };
                        }
                        return line;
                      });
                      setManualEntry({ ...manualEntry, fecha: newDate, lineas: updatedLines });
                      setManualEntryError(null);
                    }}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                    required
                  />
                  {/* Estado del Período Mensual vs Ejercicio */}
                  {(() => {
                    const p = manualEntry.fecha ? manualEntry.fecha.substring(0, 7) : '';
                    const yr = manualEntry.fecha ? parseInt(manualEntry.fecha.substring(0, 4), 10) : 0;
                    if (!p) return null;

                    const closedYears =
                      effectiveCompany.ejerciciosCerrados && effectiveCompany.ejerciciosCerrados.length > 0
                        ? effectiveCompany.ejerciciosCerrados
                        : [dates.ejercicioActivo - 2, dates.ejercicioActivo - 1];
                    const isYearClosed =
                      (closedYears.includes(yr) || yr < dates.ejercicioActivo) &&
                      effectiveCompany.reaperturaExtraordinariaActiva?.ejercicio !== yr;
                    const isYearReopened =
                      effectiveCompany.reaperturaExtraordinariaActiva?.ejercicio === yr;
                    const isPeriodClosed = effectivePeriodos.includes(p);

                    return (
                      <div className="space-y-1 mt-1">
                        {isYearClosed ? (
                          <div className="px-2 py-1 bg-rose-50 border border-rose-300 rounded text-[10px] text-rose-950 flex flex-col gap-1">
                            <div className="flex items-center justify-between">
                              <span className="flex items-center gap-1 font-bold text-rose-800">
                                <ShieldAlert className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                <span>Ejercicio {yr} CERRADO</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => setShowReopenModal(true)}
                                className="text-rose-700 hover:text-rose-900 font-extrabold underline cursor-pointer text-[10px]"
                              >
                                Reapertura Extraordinaria
                              </button>
                            </div>
                            <span className="text-[9px] text-rose-700">
                              Exige justificación legal fundada y perfil de máxima autoridad.
                            </span>
                          </div>
                        ) : isYearReopened ? (
                          <div className="px-2 py-0.5 bg-rose-100/80 border border-rose-300 rounded text-[10px] text-rose-900 flex items-center justify-between">
                            <span className="flex items-center gap-1 font-bold">
                              <Unlock className="w-3 h-3 text-rose-700 shrink-0" />
                              <span>Reapertura Extraordinaria Activa ({yr})</span>
                            </span>
                            <span className="text-[9px] text-rose-800 font-mono">NIC 8 / SII</span>
                          </div>
                        ) : null}

                        {isPeriodClosed ? (
                          <div className="px-2 py-0.5 bg-amber-50 border border-amber-300 rounded text-[10px] text-amber-900 flex items-center justify-between">
                            <span className="flex items-center gap-1">
                              <Lock className="w-3 h-3 text-amber-600 shrink-0" />
                              <span>Período {p} cerrado</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const updated = effectivePeriodos.filter((item) => item !== p);
                                if (onUpdateCompany) onUpdateCompany({ periodosCerrados: updated });
                                showToast(`Período mensual ${p} reabierto para edición.`, 'info');
                              }}
                              className="text-amber-800 hover:text-amber-950 font-bold underline cursor-pointer text-[10px]"
                            >
                              Reabrir
                            </button>
                          </div>
                        ) : (
                          <div className="px-1.5 py-0.5 text-[10px] text-emerald-700 font-medium flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                            <span>Período {p} abierto</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
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
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">Documento Respaldo</label>
                    <span className="text-[10px] text-indigo-700 font-bold bg-indigo-50 px-1 rounded">
                      SII • Contratos • RDG • Bancos
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    <select
                      value={manualEntry.tipoDocumentoRef || 'DTE_SII'}
                      onChange={(e) => {
                        const newTipo = e.target.value as TipoDocumentoRespaldo;
                        setManualEntry({
                          ...manualEntry,
                          tipoDocumentoRef: newTipo,
                        });
                        setManualEntryError(null);
                      }}
                      className="w-1/3 text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 focus:ring-1 focus:ring-blue-500 focus:outline-hidden font-medium"
                    >
                      <option value="DTE_SII">DTE SII (Factura/Boleta)</option>
                      <option value="CONTRATO">Contrato Mercantil/Arriendo</option>
                      <option value="RENDICION_GASTOS">Rendición Gastos (RDG)</option>
                      <option value="COMPROBANTE_BANCARIO">Comprobante Banco (TEF)</option>
                      <option value="DOCUMENTO_LABORAL">Laboral / Finiquito</option>
                      <option value="TRIBUTARIO_TGR">Tributario F29 / TGR</option>
                      <option value="OTRO_RESPALDO">Otro Respaldo</option>
                    </select>
                    <input
                      type="text"
                      value={manualEntry.documentoReferencia}
                      onChange={(e) => {
                        setManualEntry({ ...manualEntry, documentoReferencia: e.target.value });
                        setManualEntryError(null);
                      }}
                      placeholder={
                        manualEntry.tipoDocumentoRef === 'CONTRATO'
                          ? 'Ej: Contrato Arriendo #104 Notaría Díaz'
                          : manualEntry.tipoDocumentoRef === 'RENDICION_GASTOS'
                          ? 'Ej: RDG-2026-004 Fondo Operacional'
                          : manualEntry.tipoDocumentoRef === 'COMPROBANTE_BANCARIO'
                          ? 'Ej: TEF Banco Estado Op #892019'
                          : manualEntry.tipoDocumentoRef === 'DOCUMENTO_LABORAL'
                          ? 'Ej: Finiquito Notarial Juan Pérez'
                          : manualEntry.tipoDocumentoRef === 'TRIBUTARIO_TGR'
                          ? 'Ej: Folio F29 Declaración #28190'
                          : 'Ej: Factura #1420 / Comprobante #10'
                      }
                      className="flex-1 text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 focus:ring-1 focus:ring-blue-500 focus:outline-hidden font-mono"
                    />
                  </div>
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
                    <p className="text-[10px] text-slate-500">
                      Exclusividad contable: cada cuenta se imputa al Debe o al Haber. Si ingresa en Debe, Haber se bloquea; si escribe en Haber, Debe no se puede editar.
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

                {/* Encabezado descriptivo de columnas */}
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg text-[11px] font-bold text-slate-600 border border-slate-200">
                  <span className="w-5 text-center shrink-0">#</span>
                  <span className="flex-1">Cuenta Contable / Plan SII</span>
                  <span className="w-28 sm:w-32 text-right shrink-0 text-blue-700 font-extrabold">Debe ($)</span>
                  <span className="w-7 text-center shrink-0 text-slate-400" title="Invertir columna Debe/Haber">⇄</span>
                  <span className="w-28 sm:w-32 text-right shrink-0 text-emerald-700 font-extrabold">Haber ($)</span>
                  <span className="w-7 text-center shrink-0">Acción</span>
                </div>

                <div className="space-y-2.5">
                  {manualEntry.lineas.map((line, idx) => {
                    const reqAux = isAccountAuxiliarRequired(line.cuentaCodigo, line.cuentaNombre);
                    const reqCc = isAccountCostCenterRequired(line.cuentaCodigo, line.cuentaNombre);
                    const reqBank = isAccountBankReconcilable(line.cuentaCodigo, line.cuentaNombre);
                    const activeAcc = findActiveAccount(line.cuentaCodigo, line.cuentaNombre);
                    const reqDoc = !reqBank && Boolean(activeAcc?.requiereDocReferencia);
                    const reqPry = Boolean(activeAcc?.requiereProyecto);
                    const hasConflict = Number(line.debe) > 0 && Number(line.haber) > 0;
                    // Solo se deshabilita si la otra columna tiene saldo Y la columna actual está en cero.
                    // Si ambas tienen saldo (conflicto), AMBAS quedan editables para permitir corrección.
                    const isDebeDisabled = Number(line.haber) > 0 && Number(line.debe) === 0;
                    const isHaberDisabled = Number(line.debe) > 0 && Number(line.haber) === 0;

                    return (
                      <div
                        key={idx}
                        className={`p-2.5 rounded-xl border transition-all ${
                          hasConflict
                            ? 'bg-rose-50/50 border-rose-300 shadow-sm'
                            : reqAux || reqCc || reqDoc || reqBank || reqPry
                            ? 'bg-slate-50/90 border-slate-300 shadow-2xs'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {/* Fila Principal: Cuenta, Debe, Swap, Haber, Eliminar */}
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
                              {reqBank && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                                  <Landmark className="w-3 h-3 text-emerald-600" />
                                  Conciliable Bancaria (Cartola / TEF)
                                </span>
                              )}
                              {reqAux && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                                  <Users className="w-3 h-3 text-amber-600" />
                                  Exige Auxiliar (RUT / DTE)
                                </span>
                              )}
                              {reqDoc && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 border border-indigo-300">
                                  <FileText className="w-3 h-3 text-indigo-600" />
                                  Exige Doc. Referencia (DOC)
                                </span>
                              )}
                              {reqCc && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-300">
                                  <PieChart className="w-3 h-3 text-purple-600" />
                                  Exige Centro de Costos
                                </span>
                              )}
                              {reqPry && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-800 border border-cyan-300">
                                  <Briefcase className="w-3 h-3 text-cyan-600" />
                                  Exige Proyecto / Obra
                                </span>
                              )}
                              {line.monedaOriginal && line.monedaOriginal !== 'CLP' && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-300">
                                  <Coins className="w-3 h-3 text-blue-600" />
                                  Multimoneda ({line.monedaOriginal})
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Monto Debe (Ingreso manual con exclusividad y botón de limpieza) */}
                          <div className="relative w-28 sm:w-32 shrink-0">
                            <span className={`absolute left-2.5 top-2 text-[10px] font-bold ${isDebeDisabled ? 'text-slate-300' : 'text-slate-400'}`}>$</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              disabled={isDebeDisabled}
                              placeholder={isDebeDisabled ? '—' : 'Debe $0'}
                              value={line.debe ? Number(line.debe).toLocaleString('es-CL') : ''}
                              title={
                                isDebeDisabled
                                  ? 'No editable: esta partida ya tiene saldo asignado al Haber. Presione ✕ en Haber o ⇄ para transferir.'
                                  : 'Monto a imputar al Debe'
                              }
                              onChange={(e) => {
                                const clean = e.target.value.replace(/\D/g, '');
                                handleUpdateManualLine(idx, 'debe', clean ? parseInt(clean, 10) : 0);
                              }}
                              className={`w-full pl-6 pr-6 py-1.5 text-xs rounded-lg text-right font-mono transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                                isDebeDisabled
                                  ? 'bg-slate-100 text-slate-300 border border-slate-200 cursor-not-allowed select-none opacity-60'
                                  : Number(line.debe) > 0
                                  ? 'bg-blue-50/80 text-blue-900 border-2 border-blue-500 font-bold shadow-xs'
                                  : 'bg-white border border-slate-300 text-slate-800 font-medium focus:ring-1 focus:ring-blue-500 focus:outline-hidden'
                              }`}
                            />
                            {Number(line.debe) > 0 && (
                              <button
                                type="button"
                                onClick={() => handleUpdateManualLine(idx, 'debe', 0)}
                                className="absolute right-1.5 top-2 text-slate-400 hover:text-rose-600 font-bold text-[10px] p-0.5 rounded hover:bg-slate-100 cursor-pointer"
                                title="Limpiar monto Debe ($0)"
                              >
                                ✕
                              </button>
                            )}
                          </div>

                          {/* Botón Rápido de Inversión / Transferencia Debe <-> Haber */}
                          <button
                            type="button"
                            disabled={!line.debe && !line.haber}
                            onClick={() => handleSwapManualLine(idx)}
                            className={`p-1.5 rounded-lg border transition-colors shrink-0 ${
                              line.debe || line.haber
                                ? 'border-slate-200 text-slate-500 hover:text-blue-600 hover:bg-blue-50 cursor-pointer shadow-2xs'
                                : 'border-transparent text-slate-200 cursor-default opacity-30'
                            }`}
                            title={
                              line.debe || line.haber
                                ? 'Invertir columna: transferir monto entre Debe y Haber'
                                : 'Ingrese un monto en Debe o Haber para habilitar la inversión'
                            }
                          >
                            <ArrowLeftRight className="w-3.5 h-3.5" />
                          </button>

                          {/* Monto Haber (Ingreso manual con exclusividad y botón de limpieza) */}
                          <div className="relative w-28 sm:w-32 shrink-0">
                            <span className={`absolute left-2.5 top-2 text-[10px] font-bold ${isHaberDisabled ? 'text-slate-300' : 'text-slate-400'}`}>$</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              disabled={isHaberDisabled}
                              placeholder={isHaberDisabled ? '—' : 'Haber $0'}
                              value={line.haber ? Number(line.haber).toLocaleString('es-CL') : ''}
                              title={
                                isHaberDisabled
                                  ? 'No editable: esta partida ya tiene saldo asignado al Debe. Presione ✕ en Debe o ⇄ para transferir.'
                                  : 'Monto a imputar al Haber'
                              }
                              onChange={(e) => {
                                const clean = e.target.value.replace(/\D/g, '');
                                handleUpdateManualLine(idx, 'haber', clean ? parseInt(clean, 10) : 0);
                              }}
                              className={`w-full pl-6 pr-6 py-1.5 text-xs rounded-lg text-right font-mono transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                                isHaberDisabled
                                  ? 'bg-slate-100 text-slate-300 border border-slate-200 cursor-not-allowed select-none opacity-60'
                                  : Number(line.haber) > 0
                                  ? 'bg-emerald-50/80 text-emerald-900 border-2 border-emerald-500 font-bold shadow-xs'
                                  : 'bg-white border border-slate-300 text-slate-800 font-medium focus:ring-1 focus:ring-emerald-500 focus:outline-hidden'
                              }`}
                            />
                            {Number(line.haber) > 0 && (
                              <button
                                type="button"
                                onClick={() => handleUpdateManualLine(idx, 'haber', 0)}
                                className="absolute right-1.5 top-2 text-slate-400 hover:text-rose-600 font-bold text-[10px] p-0.5 rounded hover:bg-slate-100 cursor-pointer"
                                title="Limpiar monto Haber ($0)"
                              >
                                ✕
                              </button>
                            )}
                          </div>

                          {/* Botón para Eliminar / Restablecer Cuenta */}
                          <button
                            type="button"
                            onClick={() => handleRemoveManualLine(idx)}
                            className="p-1.5 rounded-lg border transition-colors shrink-0 border-rose-200 text-rose-500 hover:bg-rose-50 hover:text-rose-700 cursor-pointer shadow-2xs"
                            title={
                              manualEntry.lineas.length > 2
                                ? `Eliminar cuenta "${line.cuentaNombre || line.cuentaCodigo}" (Línea ${idx + 1})`
                                : `Restablecer cuenta "${line.cuentaNombre || line.cuentaCodigo}" a $0 (Mínimo 2 partidas requeridas)`
                            }
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Banner Informativo y Solucionador Rápido de Conflicto Debe/Haber */}
                        {hasConflict && (
                          <div className="mt-2 p-2 bg-amber-50 border border-amber-300 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900 animate-in fade-in">
                            <div className="flex items-center gap-1.5">
                              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                              <span className="font-semibold text-[11px]">
                                Conflicto detectado: Movimiento en Debe (${Number(line.debe).toLocaleString('es-CL')}) y Haber (${Number(line.haber).toLocaleString('es-CL')}). Seleccione una columna:
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleUpdateManualLine(idx, 'haber', 0)}
                                className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-bold cursor-pointer transition-colors"
                              >
                                Mantener solo Debe
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdateManualLine(idx, 'debe', 0)}
                                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold cursor-pointer transition-colors"
                              >
                                Mantener solo Haber
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  handleUpdateManualLine(idx, 'debe', 0);
                                  handleUpdateManualLine(idx, 'haber', 0);
                                }}
                                className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-[10px] font-bold cursor-pointer transition-colors"
                              >
                                Limpiar ambos ($0)
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Sub-panel Multimoneda & Tipo de Cambio Histórico (NIC 21) */}
                        {line.monedaOriginal && line.monedaOriginal !== 'CLP' && (
                          <div className="mt-2 p-2.5 bg-blue-50/70 border border-blue-200 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs animate-in fade-in">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded bg-blue-600 text-white font-mono font-bold text-[11px] shadow-2xs">
                                {line.monedaOriginal}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-semibold text-slate-700">Monto {line.monedaOriginal}:</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  min={0}
                                  placeholder={`0.00 ${line.monedaOriginal}`}
                                  value={line.montoMonedaOriginal !== undefined && line.montoMonedaOriginal > 0 ? line.montoMonedaOriginal : ''}
                                  onChange={(e) => handleUpdateManualLine(idx, 'montoMonedaOriginal', e.target.value)}
                                  className="w-28 bg-white border border-blue-300 rounded px-2 py-1 font-mono font-bold text-blue-950 text-right text-xs focus:ring-1 focus:ring-blue-500"
                                />
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-semibold text-slate-700">T/C Aplicado:</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  min={0.01}
                                  placeholder="955.20"
                                  value={line.tipoCambio || ''}
                                  onChange={(e) => handleUpdateManualLine(idx, 'tipoCambio', e.target.value)}
                                  className="w-24 bg-white border border-blue-300 rounded px-2 py-1 font-mono font-bold text-slate-800 text-right text-xs focus:ring-1 focus:ring-blue-500"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const officialRate = getExchangeRateForDate(line.monedaOriginal || 'USD', manualEntry.fecha, effectiveCompany?.rut);
                                    handleUpdateManualLine(idx, 'tipoCambio', officialRate);
                                  }}
                                  className="text-[10px] text-blue-700 hover:text-blue-900 underline font-semibold cursor-pointer"
                                  title="Restablecer a cotización oficial histórica de la fecha"
                                >
                                  T/C Oficial
                                </button>
                              </div>
                            </div>

                            <div className="text-[11px] text-blue-900 font-mono font-semibold bg-white/80 px-2 py-0.5 rounded border border-blue-200">
                              ≈ ${(Math.round((Number(line.montoMonedaOriginal) || 0) * (Number(line.tipoCambio) || 1))).toLocaleString('es-CL')} CLP
                            </div>
                          </div>
                        )}

                        {/* Sub-panel Analítico de Imputación (Cuentas Bancarias, Auxiliares, Documentos de Referencia, Centros de Costos y Proyectos) */}
                        {(reqAux || reqCc || reqDoc || reqBank || reqPry) && (
                          <div className="mt-2.5 pt-2.5 border-t border-slate-200/80 grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
                            {/* Panel Cuenta Bancaria: Referencia de Conciliación Bancaria y Cartola */}
                            {reqBank && (() => {
                              const otherAuxLine = manualEntry.lineas.find((l, i) => i !== idx && (l.rutAuxiliar || isAccountAuxiliarRequired(l.cuentaCodigo, l.cuentaNombre)));
                              const otherAuxLineIdx = manualEntry.lineas.findIndex((l, i) => i !== idx && (l.rutAuxiliar || isAccountAuxiliarRequired(l.cuentaCodigo, l.cuentaNombre)));

                              return (
                              <div className="bg-emerald-50/70 border border-emerald-300 rounded-lg p-2.5 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-bold text-emerald-950 flex items-center gap-1.5">
                                    <Landmark className="w-3.5 h-3.5 text-emerald-700" />
                                    Referencia de Conciliación Bancaria (Obligatorio) *
                                  </span>
                                  <span className="text-[9px] uppercase tracking-wider font-semibold text-emerald-800 bg-emerald-200/60 px-1.5 py-0.5 rounded">
                                    Cartola Bancaria / TEF
                                  </span>
                                </div>

                                {otherAuxLine && otherAuxLine.rutAuxiliar && (
                                  <div className="p-2 bg-emerald-100/90 border border-emerald-300 rounded-lg flex items-center justify-between gap-2 text-xs">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <Link2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                                      <div className="min-w-0">
                                        <span className="text-[10px] font-bold text-emerald-950 block">
                                          Operación bancaria vinculada al Auxiliar:
                                        </span>
                                        <span className="text-xs font-semibold text-emerald-900 truncate block">
                                          {otherAuxLine.nombreAuxiliar || otherAuxLine.rutAuxiliar} ({otherAuxLine.rutAuxiliar})
                                          {otherAuxLine.documentoRef ? ` • Respaldo: ${otherAuxLine.documentoRef}` : ''}
                                        </span>
                                      </div>
                                    </div>
                                    <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-200 text-emerald-900 shrink-0 uppercase tracking-wide">
                                      Trazabilidad Libro Auxiliar
                                    </span>
                                  </div>
                                )}

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                  <div>
                                    <label className="text-[10px] font-bold text-emerald-900 block mb-0.5">
                                      Medio de Pago / Movimiento Bancario:
                                    </label>
                                    <select
                                      value={line.tipoDocumentoConciliacion || 'TRANSFERENCIA'}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        const updated = [...manualEntry.lineas];
                                        const currentDoc = updated[idx].documentoConciliacion || updated[idx].documentoRef || '';
                                        const adjustedDoc =
                                          val === 'CHEQUE'
                                            ? currentDoc.replace(/^TEF-/i, 'CHQ-')
                                            : val === 'TRANSFERENCIA'
                                            ? currentDoc.replace(/^CHQ-/i, 'TEF-')
                                            : currentDoc;
                                        updated[idx] = {
                                          ...updated[idx],
                                          tipoDocumentoConciliacion: val,
                                          ...(adjustedDoc ? { documentoConciliacion: adjustedDoc, documentoRef: adjustedDoc, folioDocumentoRef: adjustedDoc } : {}),
                                        };
                                        if (otherAuxLineIdx !== -1) {
                                          updated[otherAuxLineIdx] = {
                                            ...updated[otherAuxLineIdx],
                                            tipoDocumentoOperacion: val,
                                            ...(adjustedDoc ? { documentoOperacion: adjustedDoc } : {}),
                                          };
                                        }
                                        setManualEntry((prev) => ({ ...prev, lineas: updated }));
                                      }}
                                      className="w-full text-xs bg-white border border-emerald-300 rounded px-2 py-1 text-slate-800 font-semibold"
                                    >
                                      <option value="TRANSFERENCIA">Transferencia Electrónica (TEF)</option>
                                      <option value="CHEQUE">Cheque Girado / Cobrado</option>
                                      <option value="DEPOSITO">Depósito en Cuenta Corriente</option>
                                      <option value="CARGO_CARTOLA">Cargo Directo en Cartola (PAC / Comisión)</option>
                                      <option value="ABONO_CARTOLA">Abono Directo en Cartola (Intereses / Transbank)</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="text-[10px] font-bold text-emerald-900 block mb-0.5">
                                      {line.tipoDocumentoConciliacion === 'CHEQUE'
                                        ? 'N° Serie / Folio del Cheque *:'
                                        : line.tipoDocumentoConciliacion === 'DEPOSITO'
                                        ? 'N° Comprobante de Depósito *:'
                                        : 'N° Operación TEF / ID Transferencia *:'}
                                    </label>
                                    <input
                                      type="text"
                                      placeholder={
                                        line.tipoDocumentoConciliacion === 'CHEQUE'
                                          ? 'Ej: 0045821, Chq-80'
                                          : 'Ej: TEF-892019, OP-4412'
                                      }
                                      value={line.documentoConciliacion || line.documentoRef || ''}
                                      onChange={(e) => {
                                        const refVal = e.target.value;
                                        const updated = [...manualEntry.lineas];
                                        updated[idx] = {
                                          ...updated[idx],
                                          documentoConciliacion: refVal,
                                          documentoRef: refVal,
                                          folioDocumentoRef: refVal,
                                          ...(otherAuxLine?.rutAuxiliar ? {
                                            rutAuxiliar: otherAuxLine.rutAuxiliar,
                                            nombreAuxiliar: otherAuxLine.nombreAuxiliar,
                                          } : {}),
                                        };
                                        if (otherAuxLineIdx !== -1) {
                                          updated[otherAuxLineIdx] = {
                                            ...updated[otherAuxLineIdx],
                                            documentoOperacion: refVal,
                                            tipoDocumentoOperacion: updated[idx].tipoDocumentoConciliacion || 'TRANSFERENCIA',
                                            fechaDocumentoOperacion: updated[idx].fechaDocumentoRef || manualEntry.fecha,
                                          };
                                        }
                                        setManualEntry((prev) => ({ ...prev, lineas: updated }));
                                      }}
                                      className="w-full text-xs bg-white border border-emerald-300 rounded px-2 py-1 text-slate-800 font-mono font-bold"
                                      required
                                    />
                                  </div>
                                </div>

                                {/* Fechas de Emisión y Vencimiento para Cheque / TEF (Especialmente en Egresos) */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1 border-t border-emerald-200">
                                  <div>
                                    <label className="text-[10px] font-bold text-emerald-900 block mb-0.5">
                                      {line.tipoDocumentoConciliacion === 'CHEQUE'
                                        ? 'Fecha de Emisión (Giro del Cheque):'
                                        : 'Fecha de Emisión / Ejecución TEF:'}
                                    </label>
                                    <input
                                      type="date"
                                      value={line.fechaDocumentoRef || manualEntry.fecha || ''}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        const updated = [...manualEntry.lineas];
                                        const shouldSyncVenc =
                                          !updated[idx].fechaVencimientoRef ||
                                          updated[idx].fechaVencimientoRef === updated[idx].fechaDocumentoRef;
                                        updated[idx] = {
                                          ...updated[idx],
                                          fechaDocumentoRef: val,
                                          ...(shouldSyncVenc ? { fechaVencimientoRef: val } : {}),
                                        };
                                        if (otherAuxLineIdx !== -1) {
                                          updated[otherAuxLineIdx] = {
                                            ...updated[otherAuxLineIdx],
                                            fechaDocumentoOperacion: val,
                                          };
                                        }
                                        setManualEntry((prev) => ({ ...prev, lineas: updated }));
                                      }}
                                      className="w-full text-xs bg-white border border-emerald-300 rounded px-2 py-1 text-slate-800 font-mono"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] font-bold text-emerald-900 block mb-0.5">
                                      {line.tipoDocumentoConciliacion === 'CHEQUE'
                                        ? 'Fecha de Vencimiento / Cobro Cheque:'
                                        : 'Fecha Valor / Disponibilidad TEF:'}
                                    </label>
                                    <input
                                      type="date"
                                      value={line.fechaVencimientoRef || line.fechaDocumentoRef || manualEntry.fecha || ''}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        const updated = [...manualEntry.lineas];
                                        updated[idx] = {
                                          ...updated[idx],
                                          fechaVencimientoRef: val,
                                        };
                                        setManualEntry((prev) => ({ ...prev, lineas: updated }));
                                      }}
                                      className="w-full text-xs bg-white border border-emerald-300 rounded px-2 py-1 text-slate-800 font-mono font-bold text-emerald-950"
                                    />
                                  </div>
                                </div>

                                <p className="text-[10px] text-emerald-800">
                                  Esta referencia y fechas quedan vinculadas directamente en el <strong>Libro Mayor Auxiliar</strong> (indicando si fue pagado con <strong>TEF</strong> o <strong>Cheque</strong> con su N°, emisión y vencimiento) y en la <strong>Conciliación Bancaria</strong>.
                                </p>
                              </div>
                              );
                            })()}

                            {/* Panel Auxiliar: Búsqueda de Auxiliar e Individualización de Documentos (DTE, Contratos, RDG, TEF) */}
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

                                <SearchableAuxiliarySelect
                                  selectedRut={line.rutAuxiliar || ''}
                                  selectedDteId={line.dteIdAsociado || ''}
                                  documentoRef={line.documentoRef || ''}
                                  tipoDocumentoRef={line.tipoDocumentoRef}
                                  folioDocumentoRef={line.folioDocumentoRef}
                                  montoDocumentoRef={line.montoDocumentoRef}
                                  fechaDocumentoRef={line.fechaDocumentoRef}
                                  fechaVencimientoRef={line.fechaVencimientoRef}
                                  documentoOperacion={line.documentoOperacion}
                                  tipoDocumentoOperacion={line.tipoDocumentoOperacion}
                                  fechaDocumentoOperacion={line.fechaDocumentoOperacion}
                                  lineAmount={Number(line.debe) || Number(line.haber) || 0}
                                  availableAuxiliaries={availableAuxiliaries}
                                  availableDtes={safeDtes}
                                  pendingDocuments={getPendingDocsForAuxiliary(line.rutAuxiliar, line.cuentaCodigo)}
                                  accountCode={line.cuentaCodigo}
                                  tipoAuxiliarPermitido={activeAcc?.tipoAuxiliarPermitido}
                                  onOpenAuxiliaryManager={() => {
                                    const expectedRole = activeAcc?.tipoAuxiliarPermitido === 'PROVEEDOR' ? 'PROVEEDOR' : activeAcc?.tipoAuxiliarPermitido === 'CLIENTE' ? 'CLIENTE' : line.cuentaCodigo.startsWith('2.1') ? 'PROVEEDOR' : line.cuentaCodigo.startsWith('1.1') ? 'CLIENTE' : 'ALL';
                                    setAuxiliaryManagerFilter(expectedRole);
                                    setIsAuxiliaryManagerModalOpen(true);
                                  }}
                                  onResetAuxiliary={() => {
                                    setManualEntry((prev) => {
                                      const updated = [...prev.lineas];
                                      updated[idx] = {
                                        ...updated[idx],
                                        rutAuxiliar: '',
                                        nombreAuxiliar: '',
                                        dteIdAsociado: '',
                                        documentoRef: '',
                                        tipoDocumentoRef: undefined,
                                        folioDocumentoRef: '',
                                        montoDocumentoRef: undefined,
                                        fechaDocumentoRef: '',
                                        fechaVencimientoRef: '',
                                        documentoOperacion: '',
                                        tipoDocumentoOperacion: '',
                                        fechaDocumentoOperacion: '',
                                      };
                                      const bankLineIdx = updated.findIndex((l, i) => i !== idx && isAccountBankReconcilable(l.cuentaCodigo, l.cuentaNombre));
                                      if (bankLineIdx !== -1) {
                                        updated[bankLineIdx] = {
                                          ...updated[bankLineIdx],
                                          rutAuxiliar: '',
                                          nombreAuxiliar: '',
                                        };
                                      }
                                      return { ...prev, lineas: updated };
                                    });
                                  }}
                                  onSelectAuxiliary={(rut, razonSocial) => {
                                    setManualEntry((prev) => {
                                      const updated = [...prev.lineas];
                                      if (!rut) {
                                        updated[idx] = {
                                          ...updated[idx],
                                          rutAuxiliar: '',
                                          nombreAuxiliar: '',
                                          dteIdAsociado: '',
                                          documentoRef: '',
                                          tipoDocumentoRef: undefined,
                                          folioDocumentoRef: '',
                                          montoDocumentoRef: undefined,
                                          fechaDocumentoRef: '',
                                          fechaVencimientoRef: '',
                                          documentoOperacion: '',
                                          tipoDocumentoOperacion: '',
                                          fechaDocumentoOperacion: '',
                                        };
                                      } else {
                                        updated[idx] = {
                                          ...updated[idx],
                                          rutAuxiliar: rut,
                                          nombreAuxiliar: razonSocial || updated[idx].nombreAuxiliar,
                                          dteIdAsociado: '',
                                        };
                                      }
                                      const bankLineIdx = updated.findIndex((l, i) => i !== idx && isAccountBankReconcilable(l.cuentaCodigo, l.cuentaNombre));
                                      if (bankLineIdx !== -1) {
                                        if (!rut) {
                                          updated[bankLineIdx] = {
                                            ...updated[bankLineIdx],
                                            rutAuxiliar: '',
                                            nombreAuxiliar: '',
                                          };
                                        } else {
                                          updated[bankLineIdx] = {
                                            ...updated[bankLineIdx],
                                            rutAuxiliar: rut,
                                            nombreAuxiliar: razonSocial || updated[idx].nombreAuxiliar,
                                          };
                                        }
                                      }
                                      return { ...prev, lineas: updated };
                                    });
                                  }}
                                  onSelectDocument={(doc) => {
                                    setManualEntry((prev) => {
                                      const updated = [...prev.lineas];
                                      if (!doc) {
                                        updated[idx] = {
                                          ...updated[idx],
                                          dteIdAsociado: '',
                                        };
                                        return { ...prev, lineas: updated };
                                      }
                                      const isSupplier = updated[idx].cuentaCodigo.startsWith('2.1');
                                      const dteTipoLabel =
                                        doc.tipoDte === '33'
                                          ? 'Factura Electrónica'
                                          : doc.tipoDte === '34'
                                          ? 'Factura Exenta'
                                          : doc.tipoDte === '61'
                                          ? 'Nota de Crédito'
                                          : doc.tipoDte === '56'
                                          ? 'Nota de Débito'
                                          : 'DTE';
                                      updated[idx] = {
                                        ...updated[idx],
                                        dteIdAsociado: doc.id,
                                        rutAuxiliar: doc.rutContraparte,
                                        nombreAuxiliar: doc.razonSocialContraparte,
                                        tipoDocumentoRef: `FACTURA_ELECTRONICA_${doc.tipoDte}` as any,
                                        folioDocumentoRef: String(doc.folio),
                                        montoDocumentoRef: doc.montoTotal,
                                        fechaDocumentoRef: doc.fechaEmision,
                                        fechaVencimientoRef: doc.fechaVencimiento || doc.fechaEmision,
                                        documentoRef: `${dteTipoLabel} F.${doc.folio}`,
                                        debe: !isSupplier ? doc.montoTotal : 0,
                                        haber: isSupplier ? doc.montoTotal : 0,
                                      };
                                      const bankLineIdx = updated.findIndex((l, i) => i !== idx && isAccountBankReconcilable(l.cuentaCodigo, l.cuentaNombre));
                                      if (bankLineIdx !== -1) {
                                        updated[bankLineIdx] = {
                                          ...updated[bankLineIdx],
                                          rutAuxiliar: doc.rutContraparte,
                                          nombreAuxiliar: doc.razonSocialContraparte,
                                        };
                                      }
                                      return { ...prev, lineas: updated };
                                    });
                                  }}
                                  onChangeManualDocRef={(ref) => {
                                    handleUpdateManualLine(idx, 'documentoRef', ref);
                                  }}
                                  onChangeDocDetails={(details) => {
                                    setManualEntry((prev) => {
                                      const updated = [...prev.lineas];
                                      updated[idx] = {
                                        ...updated[idx],
                                        ...details,
                                      };
                                      const bankLineIdx = updated.findIndex((l, i) => i !== idx && isAccountBankReconcilable(l.cuentaCodigo, l.cuentaNombre));
                                      if (bankLineIdx !== -1) {
                                        const curBankType = updated[bankLineIdx].tipoDocumentoConciliacion;
                                        const isBankTypeInvalid = !curBankType || /FACTURA|BOLETA|NOTA|DTE|DOCUMENTO/i.test(curBankType);
                                        const candidateOpType = details.tipoDocumentoOperacion && !/FACTURA|BOLETA|NOTA|DTE|DOCUMENTO/i.test(details.tipoDocumentoOperacion)
                                          ? (details.tipoDocumentoOperacion === 'TRANSFERENCIA_TEF' ? 'TRANSFERENCIA' : details.tipoDocumentoOperacion)
                                          : 'TRANSFERENCIA';
                                        const effectiveBankType = isBankTypeInvalid ? candidateOpType : curBankType;

                                        const defaultOpDoc =
                                          details.documentoOperacion ||
                                          (details.folioDocumentoRef
                                            ? effectiveBankType === 'CHEQUE'
                                              ? `CHQ-${details.folioDocumentoRef}`
                                              : `TEF-${details.folioDocumentoRef}`
                                            : '');

                                        updated[bankLineIdx] = {
                                          ...updated[bankLineIdx],
                                          tipoDocumentoConciliacion: effectiveBankType,
                                          ...(!updated[bankLineIdx].documentoConciliacion && defaultOpDoc
                                            ? {
                                                documentoConciliacion: defaultOpDoc,
                                                documentoRef: defaultOpDoc,
                                                folioDocumentoRef: defaultOpDoc,
                                              }
                                            : {}),
                                          ...(!updated[bankLineIdx].fechaDocumentoRef
                                            ? { fechaDocumentoRef: prev.fecha }
                                            : {}),
                                          ...(!updated[bankLineIdx].fechaVencimientoRef
                                            ? { fechaVencimientoRef: updated[bankLineIdx].fechaDocumentoRef || prev.fecha }
                                            : {}),
                                          ...(updated[idx].rutAuxiliar
                                            ? {
                                                rutAuxiliar: updated[idx].rutAuxiliar,
                                                nombreAuxiliar: updated[idx].nombreAuxiliar,
                                              }
                                            : {}),
                                        };
                                      }
                                      return { ...prev, lineas: updated };
                                    });
                                  }}
                                  onAddNewAuxiliary={handleAddNewAuxiliary}
                                  onApplyDocAmountToLine={(amount, targetColumn) => {
                                    setManualEntry((prev) => {
                                      const updated = [...prev.lineas];
                                      const isSupplier = updated[idx].cuentaCodigo.startsWith('2.1');
                                      const isClient = updated[idx].cuentaCodigo.startsWith('1.1');

                                      let applyToHaber = false;
                                      if (targetColumn === 'HABER') {
                                        applyToHaber = true;
                                      } else if (targetColumn === 'DEBE') {
                                        applyToHaber = false;
                                      } else {
                                        if (Number(updated[idx].haber) > 0 && Number(updated[idx].debe) === 0) {
                                          applyToHaber = true;
                                        } else if (Number(updated[idx].debe) > 0 && Number(updated[idx].haber) === 0) {
                                          applyToHaber = false;
                                        } else {
                                          // Por defecto según naturaleza contable:
                                          // Pasivo (2.1 Proveedores) nace al HABER
                                          // Activo (1.1 Clientes) nace al DEBE
                                          applyToHaber = isSupplier;
                                        }
                                      }

                                      if (applyToHaber) {
                                        updated[idx].haber = amount;
                                        updated[idx].debe = 0;
                                      } else {
                                        updated[idx].debe = amount;
                                        updated[idx].haber = 0;
                                      }

                                      const bankLineIdx = updated.findIndex((l, i) => i !== idx && isAccountBankReconcilable(l.cuentaCodigo, l.cuentaNombre));
                                      if (bankLineIdx !== -1) {
                                        if (Number(updated[bankLineIdx].debe) === 0 && Number(updated[bankLineIdx].haber) === 0) {
                                          if (!applyToHaber && isSupplier) {
                                            updated[bankLineIdx].haber = amount;
                                            updated[bankLineIdx].debe = 0;
                                          } else if (applyToHaber && isClient) {
                                            updated[bankLineIdx].debe = amount;
                                            updated[bankLineIdx].haber = 0;
                                          }
                                        }
                                        if (updated[idx].rutAuxiliar) {
                                          updated[bankLineIdx].rutAuxiliar = updated[idx].rutAuxiliar;
                                          updated[bankLineIdx].nombreAuxiliar = updated[idx].nombreAuxiliar;
                                        }
                                      }
                                      return { ...prev, lineas: updated };
                                    });
                                  }}
                                />

                                {line.dteIdAsociado && (
                                  <div className="mt-1 flex items-center gap-1.5 text-[10px] text-emerald-800 font-medium bg-emerald-50 border border-emerald-200 p-1.5 rounded">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                    <span>
                                      Cancelando: <strong>{line.documentoRef}</strong>. El DTE quedará marcado como pagado y el auxiliar saldado.
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Panel Documento de Referencia para cuentas que lo exigen sin requerir Auxiliar (ej: Valores en Tránsito, Arriendos, Contratos) */}
                            {reqDoc && !reqAux && (
                              <div className="bg-indigo-50/70 border border-indigo-200 rounded-lg p-2.5 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-bold text-indigo-900 flex items-center gap-1.5">
                                    <FileText className="w-3.5 h-3.5 text-indigo-700" />
                                    Documento de Respaldo Obligatorio *
                                  </span>
                                  <span className="text-[9px] uppercase tracking-wider font-semibold text-indigo-800 bg-indigo-200/60 px-1.5 py-0.5 rounded">
                                    Plan de Cuentas ERP
                                  </span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                  <div>
                                    <label className="text-[10px] font-bold text-indigo-900 block mb-0.5">Tipo de Respaldo:</label>
                                    <select
                                      value={line.tipoDocumentoRef || 'CONTRATO'}
                                      onChange={(e) => {
                                        const newTipo = e.target.value as TipoDocumentoRespaldo;
                                        handleUpdateManualLine(idx, 'tipoDocumentoRef', newTipo);
                                      }}
                                      className="w-full text-xs bg-white border border-indigo-300 rounded px-2 py-1 text-slate-800"
                                    >
                                      <option value="CONTRATO">Contrato (Arriendo / Mutuo / Servicios)</option>
                                      <option value="RENDICION_GASTOS">Rendición Gastos (RDG / Caja Chica)</option>
                                      <option value="COMPROBANTE_BANCARIO">Comprobante Banco (TEF / SWIFT)</option>
                                      <option value="DOCUMENTO_LABORAL">Documento Laboral / Finiquito</option>
                                      <option value="DTE_SII">DTE Electrónico SII (Factura / NC)</option>
                                      <option value="TRIBUTARIO_TGR">Tributario Formulario F29 / TGR</option>
                                      <option value="OTRO_RESPALDO">Otro Respaldo Mercantil</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="text-[10px] font-bold text-indigo-900 block mb-0.5">Folio / Identificador:</label>
                                    <input
                                      type="text"
                                      placeholder="Ej: CTR-2026-44 / RDG-002 / TEF-9901..."
                                      value={line.documentoRef || ''}
                                      onChange={(e) => handleUpdateManualLine(idx, 'documentoRef', e.target.value)}
                                      className="w-full text-xs bg-white border border-indigo-300 rounded px-2 py-1 text-slate-800 font-mono font-medium"
                                    />
                                  </div>
                                </div>
                                <div className="flex items-center justify-between text-[10px] text-indigo-700 pt-0.5">
                                  <span>Válido para respaldar transacciones sin DTE del SII.</span>
                                  {manualEntry.documentoReferencia && !line.documentoRef && (
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateManualLine(idx, 'documentoRef', manualEntry.documentoReferencia)}
                                      className="underline font-bold text-indigo-900 cursor-pointer"
                                    >
                                      Heredar del asiento
                                    </button>
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

                            {/* Panel Centro de Proyecto / Obra */}
                            {reqPry && (
                              <div className="bg-cyan-50/70 border border-cyan-300 rounded-lg p-2.5 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-bold text-cyan-950 flex items-center gap-1.5">
                                    <Briefcase className="w-3.5 h-3.5 text-cyan-700" />
                                    Proyecto / Obra Requerido *
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[9px] uppercase tracking-wider font-semibold text-cyan-800 bg-cyan-200/60 px-1.5 py-0.5 rounded">
                                      WIP / IFRS Art. 31
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setIsProjectManagerModalOpen(true)}
                                      className="text-[10px] font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-300 rounded px-2 py-0.5 flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                                      title="Abrir Catálogo y ABM de Proyectos"
                                    >
                                      <Briefcase className="w-3 h-3 text-cyan-600" /> Gestionar
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveProjectLineIdx(idx);
                                        setIsCreateProjectModalOpen(true);
                                      }}
                                      className="text-[10px] font-bold text-cyan-700 hover:text-cyan-900 bg-white hover:bg-cyan-100 border border-cyan-300 rounded px-2 py-0.5 flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                                    >
                                      <Plus className="w-3 h-3" /> + Nuevo
                                    </button>
                                  </div>
                                </div>

                                <select
                                  value={line.proyecto || ''}
                                  onChange={(e) => handleUpdateManualLine(idx, 'proyecto', e.target.value)}
                                  className="w-full text-xs bg-white border border-cyan-300 rounded-md p-1.5 text-slate-800 focus:ring-1 focus:ring-cyan-500 focus:outline-hidden font-medium"
                                  required
                                >
                                  <option value="">-- Seleccionar Proyecto / Obra --</option>
                                  {availableProjects.map((p) => (
                                    <option key={p.id || p.codigo} value={p.codigo}>
                                      {p.codigo} - {p.nombre} {p.clienteNombre ? `(${p.clienteNombre})` : ''}
                                    </option>
                                  ))}
                                  {line.proyecto && !availableProjects.some((p) => p.codigo === line.proyecto) && (
                                    <option value={line.proyecto}>{line.proyecto} (Asignado)</option>
                                  )}
                                </select>
                                <p className="text-[10px] text-cyan-800">
                                  Imputa el costo o ingreso directamente al centro de proyecto u obra en curso para control presupuestario y margen por faena.
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Botón Inferior para Agregar Cuenta (evita scroll al tener muchas partidas) */}
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={handleAddManualLine}
                    className="text-blue-600 hover:text-blue-800 text-xs font-semibold flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors cursor-pointer border border-blue-200 shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" /> + Agregar Cuenta / Partida
                  </button>
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
      {accountModalOpen && (
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
          availableAuxiliaries={availableAuxiliaries}
        />
      )}

      {/* MODAL: GESTOR DE GRUPOS Y SUBGRUPOS */}
      {groupModalOpen && (
        <GroupManagerModal
          isOpen={groupModalOpen}
          onClose={() => setGroupModalOpen(false)}
          groups={chartGroups}
          onSaveGroups={handleSaveGroups}
          accounts={chartOfAccounts}
        />
      )}

      {/* MODAL: IMPORTAR / EXPORTAR PLAN DE CUENTAS */}
      {importExportModalOpen && (
        <ImportExportChartModal
          isOpen={importExportModalOpen}
          onClose={() => setImportExportModalOpen(false)}
          chart={chartOfAccounts}
          accounts={chartOfAccounts}
          company={company}
          empresaNombre={company?.razonSocial || company?.nombreFantasia || 'Empresa'}
          empresaRut={company?.rut || ''}
          onImport={handleImportChart}
        />
      )}

      {/* MODAL: IMPORTACIÓN MASIVA DE ASIENTOS CONTABLES (MIGRACIÓN ERP HISTÓRICO) */}
      {isMassImportModalOpen && (
        <MassJournalEntryImportModal
          isOpen={isMassImportModalOpen}
          onClose={() => setIsMassImportModalOpen(false)}
          company={effectiveCompany}
          chartOfAccounts={chartOfAccounts}
          onCommitEntries={handleMassCommitEntries}
          onAutoAddAccounts={(newAccounts) => {
            const updated = [...chartOfAccounts, ...newAccounts];
            handleImportChart(updated);
          }}
        />
      )}

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

      {/* MODAL: CONFIRMACIÓN DE REAPERTURA DE PERÍODO MENSUAL CERRADO */}
      {periodReopenModal && periodReopenModal.isOpen && (
        <div className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-amber-300 max-w-lg w-full p-6 space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-700 shrink-0">
                <Lock className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                  Control Normativo de Períodos (SII)
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1">
                  Período Mensual Cerrado: {periodReopenModal.periodo}
                </h3>
              </div>
            </div>

            <div className="p-3.5 bg-amber-50/80 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-2">
              <p className="leading-relaxed">
                El período mensual <strong>{periodReopenModal.periodo}</strong> se encuentra formalmente cerrado y con bloqueo tributario.
              </p>
              <p className="leading-relaxed text-slate-700">
                No obstante, el <strong>ejercicio fiscal {periodReopenModal.ejercicio}</strong> se encuentra <strong>abierto</strong>.
              </p>
              <div className="pt-2 border-t border-amber-200/60 font-semibold text-slate-900">
                ¿Desea reabrir temporalmente el período mensual <strong>{periodReopenModal.periodo}</strong> para permitir el registro inmediato de este asiento contable en el Libro Diario?
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setPeriodReopenModal(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar (Mantener Cerrado)
              </button>
              <button
                type="button"
                onClick={() => periodReopenModal.onConfirm()}
                className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-md transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Unlock className="w-4 h-4" />
                <span>Reabrir Período y Guardar Asiento</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: GESTIÓN MULTIMONEDA, HISTÓRICO DE COTIZACIONES Y AGENTE NIC 21 */}
      {isCurrencyModalOpen && (
        <CurrencyManagerModal
          isOpen={isCurrencyModalOpen}
          onClose={() => setIsCurrencyModalOpen(false)}
          empresaRut={effectiveCompany?.rut}
          entries={safeEntries}
          accounts={chartOfAccounts}
          onApplyAdjustmentEntry={async (entry) => {
            await dispatchEntry(entry, {
              agenteNombre: 'AGENTE_NIC21',
              accion: 'AJUSTE_DIFERENCIA_CAMBIO',
            });
            if (refetchLedger) {
              await refetchLedger();
            }
            showToast('Asiento de Diferencia de Cambio (NIC 21) registrado y centralizado en el Libro Diario.', 'success');
          }}
        />
      )}

      {/* MODAL: REAPERTURA EXTRAORDINARIA DE EJERCICIO CERRADO */}
      <ExtraordinaryFiscalYearReopenModal
        isOpen={showReopenModal}
        onClose={() => setShowReopenModal(false)}
        company={effectiveCompany}
        onConfirmReopen={handleConfirmReopenFromModal}
      />

      {/* MODAL: EDICIÓN INTEGRAL DE ASIENTO CONTABLE */}
      {editingEntry && (
        <EditAccountingEntryModal
          isOpen={isEditEntryModalOpen}
          entry={editingEntry}
          accounts={chartOfAccounts}
          availableAuxiliaries={availableAuxiliaries}
          availableDtes={safeDtes}
          onClose={() => {
            setIsEditEntryModalOpen(false);
            setEditingEntry(null);
          }}
          onSave={handleSaveEditedEntry}
        />
      )}

      {/* MODAL: CREAR NUEVO CENTRO DE PROYECTO / OBRA */}
      {isCreateProjectModalOpen && (
        <CreateProjectModal
          isOpen={isCreateProjectModalOpen}
          onClose={() => {
            setIsCreateProjectModalOpen(false);
            setActiveProjectLineIdx(null);
          }}
          empresaId={effectiveCompany?.rut || company?.rut || 'default'}
          onSave={(newProject) => {
            const companyTarget = effectiveCompany?.rut || company?.rut || 'default';
            setAvailableProjects((prev) => {
              const exists = prev.some((p) => p.codigo === newProject.codigo);
              const updated = exists ? prev : [newProject, ...prev];
              saveCompanyProjects(companyTarget, updated);
              return updated;
            });
            if (activeProjectLineIdx !== null) {
              handleUpdateManualLine(activeProjectLineIdx, 'proyecto', newProject.codigo);
            }
            showToast(`Proyecto "${newProject.codigo} - ${newProject.nombre}" creado e imputado al asiento.`, 'success');
          }}
        />
      )}

      {/* MODAL: GESTOR Y ABM COMPLETO DE PROYECTOS / OBRAS */}
      {isProjectManagerModalOpen && (
        <ProjectManagerModal
          isOpen={isProjectManagerModalOpen}
          onClose={() => setIsProjectManagerModalOpen(false)}
          projects={availableProjects}
          onProjectsChange={(updated) => {
            setAvailableProjects(updated);
            saveCompanyProjects(effectiveCompany?.rut || company?.rut || 'default', updated);
          }}
          empresaId={effectiveCompany?.rut || company?.rut || 'default'}
        />
      )}

      {/* MODAL: GESTOR Y ABM MAESTRO DE AUXILIARES (PADRÓN ERP) */}
      {isAuxiliaryManagerModalOpen && (
        <AuxiliaryManagerModal
          isOpen={isAuxiliaryManagerModalOpen}
          onClose={() => setIsAuxiliaryManagerModalOpen(false)}
          companyRut={effectiveCompany?.rut || company?.rut || 'default'}
          companyName={effectiveCompany?.razonSocial || company?.razonSocial || 'Empresa Activa'}
          availableAuxiliaries={availableAuxiliaries}
          initialRoleFilter={auxiliaryManagerFilter}
          onSaveAuxiliary={handleSaveAuxiliaryFromManager}
        />
      )}
    </div>
  );
};
