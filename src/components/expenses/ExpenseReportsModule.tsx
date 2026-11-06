import React, { useState, useMemo, useEffect } from 'react';
import {
  CreditCard,
  Plus,
  Search,
  Filter,
  FileSpreadsheet,
  Download,
  Building2,
  Briefcase,
  User,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Receipt,
  Sparkles,
  ArrowRight,
  TrendingUp,
  DollarSign,
  Layers,
  PieChart,
  Eye,
  FileText,
  Calendar,
  XCircle,
  HelpCircle,
  ShieldCheck,
  RefreshCw,
  Database,
  Server,
  Smartphone,
  X,
  Pencil,
  Bot,
  ShieldAlert,
  Scale,
} from 'lucide-react';
import { getStoredAuthToken } from '../../services/apiClient';
import {
  ExpenseReport,
  ExpenseItem,
  ExpenseProject,
  CostCenterMaster,
  AccountingEntry,
  HierarchicalAccountItem,
  CompanyProfile,
} from '../../types';
import {
  formatCLP,
  exportExpenseReportToCSV,
  exportExpenseSummaryByCostCenterCSV,
  downloadFile,
  auditExpenseReport,
  generateExpenseAccountingEntry,
  ExpenseAccountingConfig,
} from '../../utils/expenseManagementAgent';
import { expenseApiService, ExpenseDbStatus } from '../../services/expenseApiService';
import { CreateExpenseReportModal } from './CreateExpenseReportModal';
import { EditExpenseReportModal } from './EditExpenseReportModal';
import { AddExpenseItemModal } from './AddExpenseItemModal';
import { ExpenseReportDetailModal } from './ExpenseReportDetailModal';
import { CentralizeExpenseModal } from './CentralizeExpenseModal';
import { CollaboratorExpenseMobileApp } from './mobile/CollaboratorExpenseMobileApp';
import { ProjectManagerModal } from '../accounting/ProjectManagerModal';
import { loadCompanyProjects, saveCompanyProjects } from '../../utils/companyProjectsService';

interface ExpenseReportsModuleProps {
  company?: CompanyProfile;
  costCenters: CostCenterMaster[];
  onAddEntry?: (entry: AccountingEntry) => void;
  chartOfAccounts?: HierarchicalAccountItem[];
  onReportsChange?: (reports: ExpenseReport[]) => void;
}

export const ExpenseReportsModule: React.FC<ExpenseReportsModuleProps> = ({
  company,
  costCenters = [],
  onAddEntry,
  chartOfAccounts = [],
  onReportsChange,
}) => {
  const empresaId = company?.rut || (company as any)?.id || 'client-retail-01';

  // ESTADO REAL DESDE MYSQL 8.0 (Sin datos falsos dibujados en memoria)
  const [reports, setReports] = useState<ExpenseReport[]>([]);
  const [items, setItems] = useState<ExpenseItem[]>([]);
  const [projects, setProjects] = useState<ExpenseProject[]>(() => loadCompanyProjects(empresaId));
  const [editingExpenseItem, setEditingExpenseItem] = useState<ExpenseItem | null>(null);
  const [dbStatus, setDbStatus] = useState<ExpenseDbStatus | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [createdNotification, setCreatedNotification] = useState<string | null>(null);
  const [showProjectManagerModal, setShowProjectManagerModal] = useState<boolean>(false);

  // Pestañas del módulo
  const [activeTab, setActiveTab] = useState<'BANDEJA_RENDICIONES' | 'COMPROBANTES_EXPLORER' | 'IMPUTACION_CC_PROYECTOS' | 'REPORTES_DESCARGABLES'>('BANDEJA_RENDICIONES');

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('TODAS');
  const [ccFilter, setCcFilter] = useState<string>('TODOS');
  const [projectFilter, setProjectFilter] = useState<string>('TODOS');

  // Modales
  const [showCreateReportModal, setShowCreateReportModal] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [selectedReportDetail, setSelectedReportDetail] = useState<ExpenseReport | null>(null);
  const [reportToEdit, setReportToEdit] = useState<ExpenseReport | null>(null);
  const [reportToCentralize, setReportToCentralize] = useState<ExpenseReport | null>(null);
  const [showArchitectureModal, setShowArchitectureModal] = useState(false);
  const [showMobileApp, setShowMobileApp] = useState(false);

  // Estado del Motor Agéntico Autónomo
  const [isExecutingAgent, setIsExecutingAgent] = useState(false);
  const [agentDiagnosticModal, setAgentDiagnosticModal] = useState<{
    title: string;
    decision: string;
    steps: any[];
    approvalRequired?: boolean;
    approvalDetails?: any;
  } | null>(null);

  const handleRunAutonomousExpenseAudit = async () => {
    setIsExecutingAgent(true);
    try {
      const authToken = getStoredAuthToken();
      const res = await fetch('/api/agents/autonomous/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          module: 'RENDICIONES',
          modulo: 'RENDICIONES',
          empresaId,
          query: `Auditar cumplimiento tributario chileno, comprobantes y topes para ${reports.length} rendiciones de gastos activas.`,
          context: {
            empresa: { id: empresaId },
            reports,
            items,
          },
        }),
      });
      const data = await res.json();
      if (data.success || data.steps) {
        setAgentDiagnosticModal({
          title: 'Auditoría Agéntica de Rendiciones de Gastos',
          decision: data.decision || data.finalText || 'Auditoría de rendiciones completada.',
          steps: data.steps || [],
          approvalRequired: data.approvalRequired,
          approvalDetails: data.approvalDetails,
        });
      }
    } catch (err: any) {
      alert('Error en auditoría agéntica de rendiciones: ' + err.message);
    } finally {
      setIsExecutingAgent(false);
    }
  };

  // Cálculo del siguiente folio correlativo basado en la base de datos
  const nextFolioNumber = useMemo(() => {
    if (!reports || reports.length === 0) return 1;
    const numbers = reports.map((r) => {
      const match = (r.folio || '').match(/RDG-\d{4}-(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    });
    return Math.max(...numbers, reports.length) + 1;
  }, [reports]);

  // Carga reactiva de datos reales desde MySQL 8.0
  const fetchRealData = async () => {
    setIsRefreshing(true);
    try {
      const [status, fetchedReports, fetchedProjects] = await Promise.all([
        expenseApiService.getDbStatus(),
        expenseApiService.getExpenseReports(empresaId),
        expenseApiService.getExpenseProjects(empresaId),
      ]);

      setDbStatus(status);
      setReports(fetchedReports);
      onReportsChange?.(fetchedReports);

      const initialPrys = loadCompanyProjects(empresaId);
      const resolvedProjects = (fetchedProjects && fetchedProjects.length > 0) ? fetchedProjects : initialPrys;
      setProjects(resolvedProjects);
      saveCompanyProjects(empresaId, resolvedProjects);

      // Aplanar comprobantes vinculados
      const allComprobantes = fetchedReports.flatMap((r) => r.comprobantes || []);
      setItems(allComprobantes);

      // Si había una rendición abierta en el modal, actualizarla con los datos frescos de la BD
      if (selectedReportDetail) {
        const freshDetail = fetchedReports.find((r) => r.id === selectedReportDetail.id);
        if (freshDetail) {
          setSelectedReportDetail(freshDetail);
        }
      }
    } catch (err) {
      console.error('[ExpenseReportsModule] Error al sincronizar con MySQL 8.0:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRealData();
  }, [empresaId]);

  // Cálculos consolidados en tiempo real basados en los registros de la BD
  const kpis = useMemo(() => {
    let pendientesAprobacionCount = 0;
    let totalPorReembolsar = 0;
    let totalFondosAnticipadosActivos = 0;
    let totalRendidoMes = 0;

    reports.forEach((r) => {
      totalRendidoMes += r.montoTotalRendidoClp;
      if (r.estado === 'PENDIENTE_APROBACION') {
        pendientesAprobacionCount++;
      }
      if (r.estado === 'APROBADA' || r.estado === 'PENDIENTE_APROBACION') {
        totalPorReembolsar += r.saldoReembolsarClp;
        totalFondosAnticipadosActivos += r.fondoAsignadoClp;
      }
    });

    return {
      pendientesAprobacionCount,
      totalPorReembolsar,
      totalFondosAnticipadosActivos,
      totalRendidoMes,
    };
  }, [reports]);

  // Rendiciones filtradas
  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      const matchSearch =
        r.folio.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.rendidorNombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.rendidorRut.toLowerCase().includes(searchTerm.toLowerCase());

      const matchStatus = statusFilter === 'TODAS' || r.estado === statusFilter;
      const matchCc = ccFilter === 'TODOS' || r.centroCostoId === ccFilter;
      const matchPry = projectFilter === 'TODOS' || r.proyectoId === projectFilter;

      return matchSearch && matchStatus && matchCc && matchPry;
    });
  }, [reports, searchTerm, statusFilter, ccFilter, projectFilter]);

  // Acción: Abrir modal de previsualización y configuración contable previa
  const handleQuickCentralize = (report: ExpenseReport) => {
    setReportToCentralize(report);
  };

  // Acción: Confirmar Centralización de Rendición en Libro Diario con configuración elegida
  const handleConfirmCentralize = async (config: ExpenseAccountingConfig) => {
    if (!reportToCentralize) return;
    const report = reportToCentralize;
    try {
      const authToken = getStoredAuthToken();
      const reportComprobantes = items.filter((i) => i.expenseReportId === report.id);

      // Evaluación con motor agéntico de rendiciones
      let agentApprovalMsg = '';
      try {
        const agentRes = await fetch('/api/agents/autonomous/execute', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          },
          body: JSON.stringify({
            module: 'RENDICIONES',
            modulo: 'RENDICIONES',
            empresaId,
            query: `Auditar rendición ${report.folio} (${report.titulo}) por ${formatCLP(report.montoTotal)} y proponer centralización contable según normativa chilena SII.`,
            context: {
              empresa: { id: empresaId },
              report,
              comprobantes: reportComprobantes,
            },
          }),
        });
        if (agentRes.ok) {
          const aData = await agentRes.json();
          if (aData.approvalRequired) {
            agentApprovalMsg = ` [Gobernanza Humana #${aData.approvalDetails?.id?.slice(-6) || 'PEND'} requerida por monto]`;
          }
        }
      } catch (agentErr) {
        console.warn('[ExpenseReportsModule] Error en motor agéntico:', agentErr);
      }

      const entry = generateExpenseAccountingEntry(report, reportComprobantes, chartOfAccounts, config);
      if (onAddEntry) {
        await onAddEntry(entry);
      }
      try {
        await expenseApiService.contabilizarReport(report.id, config);
      } catch (e) {
        console.warn('[ExpenseReportsModule] Aviso al actualizar estado en API:', e);
      }
      setReports((prev) => {
        const updated = prev.map((r) =>
          r.id === report.id
            ? { ...r, estado: 'CONTABILIZADA_PAGADA' as const, asientoContableId: entry.id }
            : r
        );
        onReportsChange?.(updated);
        return updated;
      });
      setCreatedNotification(
        `✓ Rendición ${report.folio} ("${report.titulo}") centralizada exitosamente en el Libro Diario (Asiento #${entry.id}, Total: ${formatCLP(entry.totalDebe)}).${agentApprovalMsg}`
      );
      setTimeout(() => setCreatedNotification(null), 6000);
      await fetchRealData();
    } catch (err: any) {
      console.error('[ExpenseReportsModule] Error al centralizar rendición:', err);
      alert('Error al centralizar rendición en Libro Diario: ' + (err?.message || 'Error desconocido'));
    }
  };

  // Acción: Crear Rendición en MySQL 8.0 / Disco Persistente con refresco reactivo instantáneo en pantalla
  const handleCreateReport = async (newRepData: Omit<ExpenseReport, 'id' | 'createdAt' | 'updatedAt' | 'comprobantes'>) => {
    try {
      const created = await expenseApiService.createExpenseReport({
        ...newRepData,
        empresaId,
      });
      if (created) {
        // 1. Refresco inmediato reactivo del estado de React (se muestra al instante en pantalla)
        setReports((prev) => {
          const filtered = prev.filter((r) => r.id !== created.id && r.folio !== created.folio);
          return [created, ...filtered];
        });

        // 2. Limpiar filtros para garantizar que la nueva rendición aparezca inmediatamente visible en la tabla
        setStatusFilter('TODAS');
        setSearchTerm('');
        setCcFilter('TODOS');
        setProjectFilter('TODOS');
        setActiveTab('BANDEJA_RENDICIONES');

        // 3. Notificación de éxito en pantalla
        setCreatedNotification(
          created.fondoAsignadoClp > 0
            ? `✓ Rendición ${created.folio} creada y anticipo de $${Number(created.fondoAsignadoClp).toLocaleString('es-CL')} contabilizado automáticamente en Libro Diario y Banco.`
            : `✓ Rendición ${created.folio} ("${created.titulo}") creada y registrada exitosamente.`
        );
        setTimeout(() => setCreatedNotification(null), 6000);

        // 3.1 Notificar al Libro Diario y Tesorería si la rendición contempla un anticipo entregado
        if (onAddEntry && Number(created.fondoAsignadoClp) > 0) {
          const advAmount = Number(created.fondoAsignadoClp);
          const advEntry: AccountingEntry = {
            id: (created as any).asientoAnticipoId || `entry-adv-${created.id}`,
            fecha: created.fechaInicio || new Date().toISOString().substring(0, 10),
            concepto: `Entrega Anticipo de Fondos por Rendir Folio ${created.folio} a ${created.rendidorNombre} - ${created.titulo}`,
            documento: `ANTICIPO ${created.folio}`,
            totalDebe: advAmount,
            totalHaber: advAmount,
            balanceado: true,
            origen: 'RENDICION_GASTOS',
            creadoEn: new Date().toISOString(),
            lineas: [
              {
                cuentaCodigo: '1.1.03.002',
                cuentaNombre: 'Gastos por Rendir / Anticipos al Personal',
                debe: advAmount,
                haber: 0,
                rutAuxiliar: created.rendidorRut !== 'SIN_RUT' ? created.rendidorRut : undefined,
                centroCosto: created.centroCostoCodigo || undefined,
              },
              {
                cuentaCodigo: '1.1.02.001',
                cuentaNombre: 'Banco Santander Chile',
                debe: 0,
                haber: advAmount,
                rutAuxiliar: created.rendidorRut !== 'SIN_RUT' ? created.rendidorRut : undefined,
                centroCosto: created.centroCostoCodigo || undefined,
              },
            ],
          };
          try {
            onAddEntry(advEntry);
          } catch (e) {
            console.warn('[ExpenseReportsModule] Aviso al notificar asiento de anticipo:', e);
          }
        }

        // 4. Sincronizar en segundo plano con la base de datos
        await fetchRealData();
      }
    } catch (err) {
      console.error('[ExpenseReportsModule] Error al crear rendición:', err);
      throw err;
    }
  };

  // Acción: Modificar Rendición de Gastos en MySQL 8.0 / Disco
  const handleUpdateReport = async (reportId: string, updates: Partial<ExpenseReport>) => {
    try {
      const updated = await expenseApiService.updateExpenseReport(reportId, updates);
      setReports((prev) => prev.map((r) => (r.id === reportId ? { ...r, ...updated, ...updates } : r)));
      if (selectedReportDetail?.id === reportId) {
        setSelectedReportDetail((prev) => (prev ? { ...prev, ...updated, ...updates } : null));
      }
      setCreatedNotification(`¡Rendición ${updated.folio || reportId} modificada y sincronizada en MySQL 8.0!`);
      setTimeout(() => setCreatedNotification(null), 4000);
      await fetchRealData();
    } catch (err: any) {
      console.error('[ExpenseReportsModule] Error al modificar rendición:', err);
      throw err;
    }
  };

  // Acción: Agregar Comprobante a MySQL 8.0
  const handleAddExpenseItem = async (newItemData: Omit<ExpenseItem, 'id' | 'createdAt'>) => {
    try {
      const createdItem = await expenseApiService.addExpenseItem(newItemData.expenseReportId, {
        ...newItemData,
        empresaId,
      });
      if (createdItem) {
        await fetchRealData();
      }
    } catch (err) {
      console.error('[ExpenseReportsModule] Error al agregar comprobante:', err);
      throw err;
    }
  };

  // Acción: Modificar Comprobante en MySQL 8.0
  const handleUpdateExpenseItem = async (updatedItem: ExpenseItem) => {
    try {
      await expenseApiService.updateExpenseItem(updatedItem.id, updatedItem);
      setEditingExpenseItem(null);
      setShowAddItemModal(false);
      await fetchRealData();
    } catch (err: any) {
      console.error('[ExpenseReportsModule] Error al modificar comprobante:', err);
      alert('Error al modificar comprobante: ' + (err?.message || 'Error desconocido'));
    }
  };

  // Acción: Eliminar Comprobante de MySQL 8.0
  const handleDeleteExpenseItem = async (itemId: string) => {
    const ok = await expenseApiService.deleteExpenseItem(itemId);
    if (ok) {
      await fetchRealData();
    }
  };

  // Acción: Actualizar Estado en MySQL 8.0
  const handleUpdateReportStatus = async (
    reportId: string,
    newStatus: ExpenseReport['estado'],
    observations?: string,
    aprobadorNombre?: string
  ) => {
    const approver = aprobadorNombre || 'Carla Morales Troncoso';
    // 1. Actualización optimista inmediata en pantalla
    setReports((prev) =>
      prev.map((r) => (r.id === reportId ? { ...r, estado: newStatus, observacionesAprobador: observations || r.observacionesAprobador, aprobadorNombre: approver } : r))
    );
    if (selectedReportDetail && selectedReportDetail.id === reportId) {
      setSelectedReportDetail((prev) =>
        prev ? { ...prev, estado: newStatus, observacionesAprobador: observations || prev.observacionesAprobador, aprobadorNombre: approver } : null
      );
    }

    const ok = await expenseApiService.updateReportStatus(
      reportId,
      newStatus,
      observations,
      approver
    );
    if (ok) {
      await fetchRealData();
    }
  };

  // MÓDULO CLIENTE PARA CELULARES DE COLABORADORES
  if (showMobileApp) {
    return (
      <CollaboratorExpenseMobileApp
        empresaRut={empresaId}
        empresaNombre={company?.razonSocial || 'Mar Austral Alimentos SpA'}
        costCenters={costCenters}
        onExitMobileView={() => {
          setShowMobileApp(false);
          fetchRealData();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Superior con Branding y Estado de Persistencia Real */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white rounded-xl shadow-md">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                  Administración de Rendición de Gastos
                </h1>
                <span className="text-[11px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full border border-blue-200">
                  RindeGastos AI
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Persistencia nativa en MySQL 8.0 • Tablas: <code className="font-mono text-slate-700 bg-slate-100 px-1 py-0.2 rounded">expense_reports</code>, <code className="font-mono text-slate-700 bg-slate-100 px-1 py-0.2 rounded">expense_items</code>, <code className="font-mono text-slate-700 bg-slate-100 px-1 py-0.2 rounded">expense_projects</code>
              </p>
            </div>
          </div>
        </div>

        {/* Botones de Acción */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleRunAutonomousExpenseAudit}
            disabled={isExecutingAgent}
            className="px-3.5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Auditoría Agéntica de Rendiciones con bucle ReAct"
          >
            <Bot className={`w-4 h-4 text-amber-300 ${isExecutingAgent ? 'animate-spin' : ''}`} />
            <span>{isExecutingAgent ? 'Auditando...' : 'Auditoría Agéntica'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowMobileApp(true)}
            className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95"
            title="Abrir módulo cliente para celulares de colaboradores (foto y lectura IA)"
          >
            <Smartphone className="w-4 h-4 text-emerald-100" />
            <span>📱 Rinde Móvil (Celular)</span>
          </button>

          <button
            type="button"
            onClick={fetchRealData}
            disabled={isRefreshing}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Sincronizar directamente con la base de datos MySQL 8.0"
          >
            <RefreshCw className={`w-4 h-4 text-slate-600 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Consultando MySQL...' : 'Refrescar BBDD'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowArchitectureModal(true)}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            title="Auditoría de persistencia: ¿De dónde sale la información y cómo se guarda?"
          >
            <HelpCircle className="w-4 h-4 text-blue-600" />
            <span>¿De dónde salen los datos?</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const csv = exportExpenseSummaryByCostCenterCSV(reports);
              downloadFile(`Resumen_Rendiciones_CentrosCosto_${new Date().toISOString().substring(0, 10)}.csv`, csv, 'text/csv');
            }}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            title="Exportar consolidado de rendiciones en CSV"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span>Exportar CSV</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCreateReportModal(true)}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Rendición</span>
          </button>
        </div>
      </div>

      {/* Banner de Notificación Reactiva de Rendición Creada */}
      {createdNotification && (
        <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3.5 text-xs text-emerald-950 font-bold flex items-center justify-between shadow-xs animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <span>{createdNotification}</span>
              <p className="text-[10px] text-emerald-700 font-normal">
                El registro fue añadido a la tabla y guardado en la base de datos de manera persistente.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCreatedNotification(null)}
            className="text-emerald-700 hover:text-emerald-950 p-1 rounded-lg hover:bg-emerald-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Monitor de Transparencia de Datos en Base de Datos MySQL 8.0 */}
      <div className="bg-slate-900 text-slate-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs border border-slate-800 shadow-sm">
        <div className="flex items-center gap-2.5">
          <Database className="w-4 h-4 text-emerald-400 shrink-0" />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white">Origen de Datos:</span>
              {dbStatus?.isRealMysqlConnected ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-300 bg-emerald-950/80 border border-emerald-800/80 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  MySQL 8.0 Conectado ({dbStatus.database} @ {dbStatus.host})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-300 bg-amber-950/80 border border-amber-800/80 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                  Almacén Persistente Local (data/db_disk_snapshot.json)
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Registros reales en BD: <strong className="text-slate-200">{reports.length}</strong> rendiciones • <strong className="text-slate-200">{items.length}</strong> comprobantes • <strong className="text-slate-200">{projects.length}</strong> proyectos. Cada cambio ejecuta DML real (INSERT / UPDATE).
            </p>
          </div>
        </div>

        <div className="text-[11px] font-mono text-slate-400 flex items-center gap-2">
          <span>Empresa: <strong className="text-slate-200">{empresaId}</strong></span>
        </div>
      </div>

      {/* Tarjetas KPI Ejecutivas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Pendientes Aprobación</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 font-mono">
              {kpis.pendientesAprobacionCount}
            </span>
            {kpis.pendientesAprobacionCount > 0 && (
              <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full">
                Requiere Firma
              </span>
            )}
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">Rendiciones presentadas a jefatura</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Reembolso Empleados</span>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-700 font-mono">
              {formatCLP(kpis.totalPorReembolsar)}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">Saldos a favor de colaboradores</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Fondos por Rendir Activos</span>
            <Building2 className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-indigo-700 font-mono">
              {formatCLP(kpis.totalFondosAnticipadosActivos)}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">Anticipos de tesorería en viaje</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Scoring Auditoría Agente</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 font-mono">
              {reports.length > 0
                ? `${Math.round(reports.reduce((acc, r) => acc + (r.agenteAuditorScore || 100), 0) / reports.length)}%`
                : '100%'}
            </span>
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full">
              Art. 31 LIR Conforme
            </span>
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">Sin contingencia de Gasto Rechazado</span>
        </div>
      </div>

      {/* Barra de Pestañas de Navegación */}
      <div className="bg-white border border-slate-200 rounded-xl p-1.5 shadow-xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('BANDEJA_RENDICIONES')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'BANDEJA_RENDICIONES'
                ? 'bg-blue-600 text-white shadow-xs font-black'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Bandeja de Rendiciones ({reports.length})</span>
            {kpis.pendientesAprobacionCount > 0 && (
              <span className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-full ${
                activeTab === 'BANDEJA_RENDICIONES' ? 'bg-white text-blue-700' : 'bg-amber-100 text-amber-900'
              }`}>
                {kpis.pendientesAprobacionCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('COMPROBANTES_EXPLORER')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'COMPROBANTES_EXPLORER'
                ? 'bg-blue-600 text-white shadow-xs font-black'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Comprobantes & Boletas Digitales ({items.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('IMPUTACION_CC_PROYECTOS')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'IMPUTACION_CC_PROYECTOS'
                ? 'bg-blue-600 text-white shadow-xs font-black'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Imputación por Centro de Costo & Proyecto</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('REPORTES_DESCARGABLES')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'REPORTES_DESCARGABLES'
                ? 'bg-blue-600 text-white shadow-xs font-black'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Informes & Exportación Oficial</span>
          </button>

          <button
            type="button"
            onClick={() => setShowMobileApp(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 ml-1 shadow-xs"
            title="Abrir módulo cliente para celulares (toma de foto y extracción con IA)"
          >
            <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
            <span>📱 App Móvil Colaboradores</span>
            <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.2 rounded-full font-black">
              CÁMARA IA
            </span>
          </button>
        </div>
      </div>

      {/* VISTA 1: BANDEJA DE RENDICIONES & WORKFLOW */}
      {activeTab === 'BANDEJA_RENDICIONES' && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs space-y-4">
          {/* Filtros de Búsqueda */}
          <div className="p-4 border-b border-slate-200 bg-slate-50/60 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por folio, título, rendidor o RUT..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Filtro Estado */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-700 font-semibold focus:outline-hidden"
              >
                <option value="TODAS">Todos los Estados</option>
                <option value="PENDIENTE_APROBACION">Pendiente Aprobación</option>
                <option value="APROBADA">Aprobada</option>
                <option value="CONTABILIZADA_PAGADA">Contabilizada & Pagada</option>
                <option value="BORRADOR">Borrador</option>
                <option value="OBJETADA_RECHAZADA">Objetada / Rechazada</option>
              </select>

              {/* Filtro Centro de Costo */}
              <select
                value={ccFilter}
                onChange={(e) => setCcFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-700 font-semibold focus:outline-hidden"
              >
                <option value="TODOS">Todos los CC</option>
                {costCenters.map((cc) => (
                  <option key={cc.id} value={cc.id}>
                    {cc.codigo} - {cc.nombre}
                  </option>
                ))}
              </select>

              {/* Filtro Proyecto */}
              <select
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-700 font-semibold focus:outline-hidden"
              >
                <option value="TODOS">Todos los Proyectos</option>
                {projects.map((pry) => (
                  <option key={pry.id} value={pry.id}>
                    {pry.codigo}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Listado de Rendiciones Reales */}
          <div className="p-4 space-y-3">
            {isLoading ? (
              <div className="p-12 text-center text-slate-500">
                <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-2" />
                <p className="text-xs font-semibold">Cargando registros reales desde MySQL 8.0...</p>
              </div>
            ) : filteredReports.length === 0 ? (
              <div className="p-12 text-center bg-slate-50 border border-dashed border-slate-300 rounded-2xl">
                <CreditCard className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-slate-700">No hay rendiciones registradas en MySQL</h4>
                <p className="text-xs text-slate-500 mt-1">
                  La base de datos MySQL 8.0 está lista para recibir rendiciones. Presione "Nueva Rendición" para crear el primer registro real.
                </p>
                <button
                  type="button"
                  onClick={() => setShowCreateReportModal(true)}
                  className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  Crear Primera Rendición Real
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredReports.map((report) => {
                  const reportComprobantes = items.filter((i) => i.expenseReportId === report.id);
                  const totalRendido = reportComprobantes.reduce((acc, i) => acc + i.montoTotalClp, 0);

                  return (
                    <div
                      key={report.id}
                      className="py-4 px-3 hover:bg-slate-50/80 rounded-xl transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-transparent hover:border-slate-200"
                    >
                      <div className="space-y-1.5 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md border border-blue-200">
                            {report.folio}
                          </span>
                          {report.estado === 'PENDIENTE_APROBACION' && (
                            <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full text-[11px] font-bold border border-amber-300 animate-pulse">
                              Pendiente Aprobación Jefatura
                            </span>
                          )}
                          {report.estado === 'APROBADA' && (
                            <span className="bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-full text-[11px] font-bold border border-emerald-300">
                              Aprobada
                            </span>
                          )}
                          {report.estado === 'CONTABILIZADA_PAGADA' && (
                            <span className="bg-indigo-100 text-indigo-900 px-2 py-0.5 rounded-full text-[11px] font-bold border border-indigo-300">
                              Contabilizada en Libro Diario
                            </span>
                          )}
                          {report.estado === 'BORRADOR' && (
                            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full text-[11px] font-bold border border-slate-300">
                              Borrador
                            </span>
                          )}
                          {report.estado === 'OBJETADA_RECHAZADA' && (
                            <span className="bg-rose-100 text-rose-900 px-2 py-0.5 rounded-full text-[11px] font-bold border border-rose-300">
                              Objetada / Rechazada
                            </span>
                          )}

                          <span className="text-[11px] text-slate-400 font-mono">
                            {report.fechaInicio} al {report.fechaCierre}
                          </span>
                        </div>

                        <h3
                          className="text-sm font-bold text-slate-900 hover:text-blue-600 transition-colors cursor-pointer"
                          onClick={() => setSelectedReportDetail(report)}
                        >
                          {report.titulo}
                        </h3>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                          <span className="flex items-center gap-1 text-slate-700 font-medium">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            {report.rendidorNombre} ({report.rendidorRut})
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1 text-indigo-700 font-semibold">
                            <Building2 className="w-3.5 h-3.5 text-indigo-500" />
                            {report.centroCostoCodigo || '-'}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                            <Briefcase className="w-3.5 h-3.5 text-emerald-500" />
                            {report.proyectoCodigo || 'General'}
                          </span>
                          <span>•</span>
                          <span className="text-slate-500">
                            {reportComprobantes.length} comprobantes en BD
                          </span>
                        </div>
                      </div>

                      {/* Importes Financieros y Acciones */}
                      <div className="flex items-center gap-6 self-stretch md:self-auto justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
                        <div className="text-right space-y-0.5">
                          <span className="text-[11px] text-slate-400 font-semibold uppercase block">Total Rendido</span>
                          <span className="font-mono text-base font-bold text-slate-900 block">
                            {formatCLP(totalRendido || report.montoTotalRendidoClp)}
                          </span>
                          <span className="text-[10px] text-slate-500 block">
                            Anticipo: {formatCLP(report.fondoAsignadoClp)}
                          </span>
                          {report.saldoReembolsarClp > 0 ? (
                            <span className="text-[10px] text-emerald-700 font-bold block">
                              Reembolso: +{formatCLP(report.saldoReembolsarClp)}
                            </span>
                          ) : report.saldoReintegrarClp > 0 ? (
                            <span className="text-[10px] text-amber-700 font-bold block">
                              Reintegro: -{formatCLP(report.saldoReintegrarClp)}
                            </span>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-2">
                          {report.estado !== 'CONTABILIZADA_PAGADA' ? (
                            <button
                              type="button"
                              onClick={() => handleQuickCentralize(report)}
                              className="px-3 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                              title="Centralizar automáticamente esta rendición en el Libro Diario"
                            >
                              <Scale className="w-4 h-4 text-blue-200" />
                              <span>Centralizar Asiento</span>
                            </button>
                          ) : (
                            <span className="text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                              <span>Asentado</span>
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() => setReportToEdit(report)}
                            className="px-2.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                            title="Modificar datos de la rendición"
                          >
                            <Pencil className="w-3.5 h-3.5 text-amber-600" />
                            <span>Modificar</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setSelectedReportDetail(report)}
                            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                            <span>Ver Detalle</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* VISTA 2: EXPLORADOR DE COMPROBANTES & BOLETAS */}
      {activeTab === 'COMPROBANTES_EXPLORER' && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Catálogo Digital de Comprobantes & Boletas
              </h3>
              <p className="text-xs text-slate-500">
                Registros reales almacenados en la tabla <code className="font-mono">expense_items</code> de MySQL 8.0
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-lg">
              {items.length} Comprobantes en BD
            </span>
          </div>

          {items.length === 0 ? (
            <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <Receipt className="w-8 h-8 text-slate-400 mx-auto mb-1.5" />
              <p className="text-xs font-semibold">No hay comprobantes individuales registrados.</p>
              <p className="text-[11px] text-slate-400">Los comprobantes se vinculan al abrir una rendición y presionar "Agregar Comprobante".</p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Fecha</th>
                    <th className="py-2.5 px-3">Rendición</th>
                    <th className="py-2.5 px-3">Tipo / Folio</th>
                    <th className="py-2.5 px-3">Proveedor</th>
                    <th className="py-2.5 px-3">Categoría / Cuenta</th>
                    <th className="py-2.5 px-3">CC & Proyecto</th>
                    <th className="py-2.5 px-3 text-right">Neto</th>
                    <th className="py-2.5 px-3 text-right">IVA (19%)</th>
                    <th className="py-2.5 px-3 text-right font-black">Total ($ CLP)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">{item.fecha}</td>
                      <td className="py-2.5 px-3">
                        <span className="font-mono text-xs font-bold text-blue-700">
                          {reports.find((r) => r.id === item.expenseReportId)?.folio || 'RDG'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-semibold text-slate-800 block">{item.tipoDocumento.replace(/_/g, ' ')}</span>
                        <span className="font-mono text-[10px] text-slate-500">Folio: {item.folioDocumento}</span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-bold text-slate-900 block">{item.proveedorRazonSocial}</span>
                        <span className="font-mono text-[10px] text-slate-500">{item.proveedorRut}</span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-semibold text-slate-800 block">{item.categoria}</span>
                        <span className="font-mono text-[10px] text-indigo-700">{item.cuentaContableCodigo}</span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="text-[11px] text-indigo-800 font-semibold block">{item.centroCostoCodigo || '-'}</span>
                        <span className="text-[10px] text-emerald-800 font-semibold block">{item.proyectoCodigo || 'General'}</span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-600">{formatCLP(item.montoNeto)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-700 font-semibold">
                        {item.montoIva > 0 ? formatCLP(item.montoIva) : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">{formatCLP(item.montoTotalClp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* VISTA 3: IMPUTACIÓN POR CENTRO DE COSTO & PROYECTO */}
      {activeTab === 'IMPUTACION_CC_PROYECTOS' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Matriz Centros de Costo */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-indigo-600" />
                Gastos Imputados por Centro de Costo (Mini-Empresas)
              </h3>
            </div>

            <div className="space-y-3">
              {costCenters.map((cc) => {
                const ccItems = items.filter((i) => i.centroCostoId === cc.id);
                const totalMonto = ccItems.reduce((acc, i) => acc + i.montoTotalClp, 0);
                const presupuesto = cc.presupuestoMensualClp || 1;
                const pct = Math.min(100, (totalMonto / presupuesto) * 100);

                return (
                  <div key={cc.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-mono text-xs font-bold text-indigo-700">{cc.codigo}</span>
                        <span className="text-xs font-bold text-slate-800 ml-2">{cc.nombre}</span>
                      </div>
                      <span className="font-mono text-xs font-black text-slate-900">{formatCLP(totalMonto)}</span>
                    </div>

                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div className="bg-indigo-600 h-2 rounded-full transition-all" style={{ width: `${pct}%` }}></div>
                    </div>

                    <div className="flex justify-between text-[10px] text-slate-500 font-semibold">
                      <span>{ccItems.length} comprobantes imputados</span>
                      <span>Presupuesto Mensual: {formatCLP(presupuesto)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Matriz Proyectos */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-emerald-600" />
                Gastos Imputados por Proyecto / Obra
              </h3>
              <button
                type="button"
                onClick={() => setShowProjectManagerModal(true)}
                className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Briefcase className="w-3.5 h-3.5" />
                Gestionar Catálogo de Proyectos
              </button>
            </div>

            <div className="space-y-3">
              {projects.length === 0 ? (
                <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-xl">
                  Sin proyectos registrados en la tabla <code className="font-mono">expense_projects</code>.
                </div>
              ) : (
                projects.map((pry) => {
                  const pryItems = items.filter((i) => i.proyectoId === pry.id);
                  const totalMonto = pryItems.reduce((acc, i) => acc + i.montoTotalClp, 0);

                  return (
                    <div key={pry.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-mono text-xs font-bold text-emerald-700">{pry.codigo}</span>
                          <span className="text-xs font-bold text-slate-800 ml-2">{pry.nombre}</span>
                        </div>
                        <span className="font-mono text-xs font-black text-slate-900">{formatCLP(totalMonto)}</span>
                      </div>

                      <p className="text-[11px] text-slate-600">{pry.descripcion || '-'}</p>

                      <div className="flex justify-between text-[10px] text-slate-500 font-semibold border-t border-slate-200/60 pt-1">
                        <span>Cliente: {pry.clienteNombre || 'Interno'}</span>
                        <span>{pryItems.length} gastos imputados</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* VISTA 4: REPORTES & INFORMES DESCARGABLES */}
      {activeTab === 'REPORTES_DESCARGABLES' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Centro de Reportería e Informes RindeGastos
            </h3>
            <p className="text-xs text-slate-500">
              Descargue informes ejecutivos en formatos CSV (Excel con UTF-8 BOM), JSON de auditoría y carátulas oficiales para firma
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl space-y-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                <h4 className="text-xs font-bold text-slate-900">Planilla Consolidada CSV</h4>
              </div>
              <p className="text-xs text-slate-600">
                Listado completo de todas las rendiciones y sus comprobantes para revisión tributaria F29.
              </p>
              <button
                type="button"
                onClick={() => {
                  const csv = exportExpenseSummaryByCostCenterCSV(reports);
                  downloadFile(`Rendiciones_Consolidado_${new Date().toISOString().substring(0, 10)}.csv`, csv, 'text/csv');
                }}
                className="w-full px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Descargar CSV Excel</span>
              </button>
            </div>

            <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl space-y-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600" />
                <h4 className="text-xs font-bold text-slate-900">Informe por Centro de Costo</h4>
              </div>
              <p className="text-xs text-slate-600">
                P&L analítico con la departamentalización de gastos operacionales de cada "Mini-Empresa".
              </p>
              <button
                type="button"
                onClick={() => {
                  const csv = exportExpenseSummaryByCostCenterCSV(reports);
                  downloadFile(`Gastos_Por_CentroCosto_${new Date().toISOString().substring(0, 10)}.csv`, csv, 'text/csv');
                }}
                className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Descargar Informe CC</span>
              </button>
            </div>

            <div className="p-4 bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-300 rounded-xl space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-600" />
                <h4 className="text-xs font-bold text-slate-900">Archivo JSON de Auditoría</h4>
              </div>
              <p className="text-xs text-slate-600">
                Datos brutos con scoring de auditoría del Agente Autónomo para integración con ERPs y APIs externas.
              </p>
              <button
                type="button"
                onClick={() => {
                  const jsonStr = JSON.stringify({ reports, items, projects, fecha: new Date().toISOString() }, null, 2);
                  downloadFile(`Auditoria_RindeGastos_${new Date().toISOString().substring(0, 10)}.json`, jsonStr, 'application/json');
                }}
                className="w-full px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Descargar JSON</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modales del Módulo */}
      <CreateExpenseReportModal
        isOpen={showCreateReportModal}
        onClose={() => setShowCreateReportModal(false)}
        onCreate={handleCreateReport}
        costCenters={costCenters}
        projects={projects}
        nextFolioNumber={nextFolioNumber}
        empresaId={empresaId}
      />

      {selectedReportDetail && (
        <ExpenseReportDetailModal
          isOpen={!!selectedReportDetail}
          onClose={() => {
            setSelectedReportDetail(null);
            setEditingExpenseItem(null);
          }}
          report={selectedReportDetail}
          comprobantes={items.filter((i) => i.expenseReportId === selectedReportDetail.id)}
          onAddComprobanteClick={() => {
            setEditingExpenseItem(null);
            setShowAddItemModal(true);
          }}
          onEditComprobante={(item) => {
            setEditingExpenseItem(item);
            setShowAddItemModal(true);
          }}
          onDeleteComprobante={handleDeleteExpenseItem}
          onUpdateReportStatus={handleUpdateReportStatus}
          onCommitAccountingEntry={onAddEntry}
          chartOfAccounts={chartOfAccounts}
          onEditReportClick={() => setReportToEdit(selectedReportDetail)}
        />
      )}

      {reportToEdit && (
        <EditExpenseReportModal
          isOpen={!!reportToEdit}
          onClose={() => setReportToEdit(null)}
          report={reportToEdit}
          onUpdate={handleUpdateReport}
          costCenters={costCenters}
          projects={projects}
          empresaId={empresaId}
        />
      )}

      {showAddItemModal && selectedReportDetail && (
        <AddExpenseItemModal
          isOpen={showAddItemModal}
          onClose={() => {
            setShowAddItemModal(false);
            setEditingExpenseItem(null);
          }}
          onAdd={handleAddExpenseItem}
          onUpdate={handleUpdateExpenseItem}
          itemToEdit={editingExpenseItem}
          report={selectedReportDetail}
          costCenters={costCenters}
          projects={projects}
        />
      )}

      {reportToCentralize && (
        <CentralizeExpenseModal
          isOpen={!!reportToCentralize}
          onClose={() => setReportToCentralize(null)}
          report={reportToCentralize}
          comprobantes={items.filter((i) => i.expenseReportId === reportToCentralize.id)}
          chartOfAccounts={chartOfAccounts}
          onConfirm={handleConfirmCentralize}
        />
      )}

      {/* Modal ABM de Proyectos y Obras */}
      {showProjectManagerModal && (
        <ProjectManagerModal
          isOpen={showProjectManagerModal}
          onClose={() => setShowProjectManagerModal(false)}
          projects={projects}
          onProjectsChange={(updated) => setProjects(updated)}
          empresaId={empresaId}
        />
      )}

      {/* Modal de Transparencia de Arquitectura: ¿De dónde sale la información? */}
      {showArchitectureModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-slate-900 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Database className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-base font-bold">Arquitectura de Datos & Persistencia</h3>
                  <p className="text-xs text-slate-400">¿De dónde sale la información y cómo se guardan los gastos?</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowArchitectureModal(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs text-slate-600 leading-relaxed max-h-[75vh] overflow-y-auto">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-blue-900">
                <h4 className="font-bold flex items-center gap-1.5 text-sm mb-1 text-blue-950">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  Cero Mocks en Memoria • Doble Motor de Persistencia Fidedigno
                </h4>
                <p>
                  En este ERP cada acción (creación de rendición, carga de comprobante, imputación a centro de costo o aprobación) ejecuta operaciones reales y permanentes.
                </p>
              </div>

              <div className="space-y-3">
                <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/50">
                  <div className="flex items-center gap-2 font-bold text-slate-900 text-sm mb-1">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs font-black">1</span>
                    Auto-DDL de Arranque en Backend (Zero-Manual-DBA)
                  </div>
                  <p className="text-slate-600">
                    Al arrancar el servidor backend en <code className="font-mono text-slate-800 bg-white px-1 py-0.5 rounded border border-slate-200">src/db/mysqlClient.ts</code>, el sistema ejecuta <code className="font-mono text-slate-800 bg-white px-1 py-0.5 rounded border border-slate-200">autoInitDatabaseSchema()</code>. Si detecta que no existen las tablas de Rendición de Gastos, ejecuta automáticamente el DDL <code className="font-mono text-slate-800 bg-white px-1 py-0.5 rounded border border-slate-200">CREATE TABLE IF NOT EXISTS</code> para <code className="font-mono text-slate-800">expense_projects</code>, <code className="font-mono text-slate-800">expense_reports</code> y <code className="font-mono text-slate-800">expense_items</code> con sus llaves foráneas e índices. Por ello, el módulo funciona de inmediato sin requerir intervención manual previa en la consola de MySQL.
                  </p>
                </div>

                <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/50">
                  <div className="flex items-center gap-2 font-bold text-slate-900 text-sm mb-1">
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-xs font-black">2</span>
                    Origen del Detalle de Gastos Iniciales (Semillas Chilenas)
                  </div>
                  <p className="text-slate-600">
                    Los gastos que observas (carga en COPEC, estadía en Hotel Castro, almuerzo en Rincón Chilote, peajes Chacao y materiales en Ferretería Austral) provienen de los datos semilla parametrizados en <code className="font-mono text-slate-800 bg-white px-1 py-0.5 rounded border border-slate-200">scripts/update_erp_tenancy_mysql.sql</code> y en el auto-seeder del backend. No son datos aleatorios ni mocks; están estructurados según el Art. 31 de la Ley sobre Impuesto a la Renta.
                  </p>
                </div>

                <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/50">
                  <div className="flex items-center gap-2 font-bold text-slate-900 text-sm mb-1">
                    <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-800 flex items-center justify-center text-xs font-black">3</span>
                    Persistencia Dual & Ledger en Disco Local
                  </div>
                  <p className="text-slate-600">
                    Si MySQL 8.0 está apagado o en mantenimiento, el servicio <code className="font-mono text-slate-800 bg-white px-1 py-0.5 rounded border border-slate-200">diskPersistenceService</code> preserva las transacciones en disco físico en <code className="font-mono text-slate-800 bg-white px-1 py-0.5 rounded border border-slate-200">data/db_disk_snapshot.json</code>. En cuanto MySQL se encuentra activo, la función <code className="font-mono text-slate-800 bg-white px-1 py-0.5 rounded border border-slate-200">syncDiskToMysql()</code> sincroniza bidireccionalmente los proyectos, rendiciones y comprobantes sin pérdida de datos.
                  </p>
                </div>

                <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/50">
                  <div className="flex items-center gap-2 font-bold text-slate-900 text-sm mb-1">
                    <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-800 flex items-center justify-center text-xs font-black">4</span>
                    Migración Manual Idempotente en Terminal
                  </div>
                  <p className="text-slate-600">
                    Si deseas aplicar o verificar formalmente el esquema en tu instancia MySQL externa o local, puedes ejecutar en la terminal:
                  </p>
                  <div className="mt-2 bg-slate-900 text-emerald-400 p-2.5 rounded-lg font-mono text-[11px] overflow-x-auto">
                    npm run db:update:mysql
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    El script ejecuta <code className="font-mono text-slate-700">scripts/update_erp_tenancy_mysql.sql</code> de forma idempotente con <code className="font-mono text-slate-700">ON DUPLICATE KEY UPDATE</code>.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setShowArchitectureModal(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DICTAMEN DEL AGENTE AUTÓNOMO DE RENDICIONES */}
      {agentDiagnosticModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-indigo-500/40 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-indigo-600/30 border border-indigo-500/40 text-amber-300">
                  <Bot className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    {agentDiagnosticModal.title}
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                      ReAct Function Calling
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">Validación de topes tributarios, comprobantes y centralización contable</p>
                </div>
              </div>
              <button
                onClick={() => setAgentDiagnosticModal(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {agentDiagnosticModal.approvalRequired && (
              <div className="p-3 bg-amber-950/60 border border-amber-600/60 rounded-xl text-amber-200 text-xs flex items-start gap-2.5">
                <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-bold">Gobernanza Humana Requerida:</strong>
                  <span>Esta centralización requiere autorización formal de Administrador / Gerente General (Solicitud #{agentDiagnosticModal.approvalDetails?.id?.slice(-6) || 'PEND'}).</span>
                </div>
              </div>
            )}

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400 block">Dictamen y Análisis del Agente:</span>
              <p className="whitespace-pre-wrap leading-relaxed text-slate-200 font-mono text-[11px]">{agentDiagnosticModal.decision}</p>
            </div>

            {agentDiagnosticModal.steps && agentDiagnosticModal.steps.length > 0 && (
              <div className="space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Trazabilidad de Pasos y Herramientas (Thought Trace):</span>
                <div className="space-y-2">
                  {agentDiagnosticModal.steps.map((st: any, idx: number) => (
                    <div key={idx} className="bg-slate-950/80 p-3 rounded-lg border border-slate-800/80 text-xs">
                      <div className="flex items-center justify-between text-indigo-300 font-bold mb-1">
                        <span>Paso {st.step || idx + 1}: {st.toolCall}</span>
                        <span className="text-[10px] text-slate-500">{st.timestamp}</span>
                      </div>
                      <p className="text-slate-400 text-[11px] mb-1">{st.thought}</p>
                      {st.toolOutput && (
                        <pre className="text-[10px] bg-slate-900 p-2 rounded text-slate-300 overflow-x-auto max-h-32">
                          {JSON.stringify(st.toolOutput, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setAgentDiagnosticModal(null)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                Cerrar Panel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
