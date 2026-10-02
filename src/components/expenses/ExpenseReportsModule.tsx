import React, { useState, useMemo } from 'react';
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
} from 'lucide-react';
import {
  ExpenseReport,
  ExpenseItem,
  ExpenseProject,
  CostCenterMaster,
  AccountingEntry,
  HierarchicalAccountItem,
} from '../../types';
import {
  formatCLP,
  exportExpenseReportToCSV,
  exportExpenseSummaryByCostCenterCSV,
  downloadFile,
  auditExpenseReport,
} from '../../utils/expenseManagementAgent';
import { CreateExpenseReportModal } from './CreateExpenseReportModal';
import { AddExpenseItemModal } from './AddExpenseItemModal';
import { ExpenseReportDetailModal } from './ExpenseReportDetailModal';

interface ExpenseReportsModuleProps {
  costCenters: CostCenterMaster[];
  onAddEntry?: (entry: AccountingEntry) => void;
  chartOfAccounts?: HierarchicalAccountItem[];
}

export const ExpenseReportsModule: React.FC<ExpenseReportsModuleProps> = ({
  costCenters = [],
  onAddEntry,
  chartOfAccounts = [],
}) => {
  // Proyectos iniciales de demostración
  const [projects, setProjects] = useState<ExpenseProject[]>([
    {
      id: 'pry-01',
      empresaId: 'client-retail-01',
      codigo: 'PRY-QUELLON-26',
      nombre: 'Mantención Mayor Redes y Jaulas Balsas Quellón',
      clienteNombre: 'Salmones Antártica S.A.',
      presupuestoTotalClp: 45000000,
      activo: true,
      descripcion: 'Servicio integral de fondeos y redes loberas.',
    },
    {
      id: 'pry-02',
      empresaId: 'client-retail-01',
      codigo: 'PRY-STGO-EXP',
      nombre: 'Expansión Comercial & Distribución Retail Santiago',
      clienteNombre: 'Cencosud / Walmart Chile',
      presupuestoTotalClp: 25000000,
      activo: true,
      descripcion: 'Apertura de nuevos canales de congelados y mariscos.',
    },
    {
      id: 'pry-03',
      empresaId: 'client-retail-01',
      codigo: 'PRY-LOG-FLOTA',
      nombre: 'Habilitación Barcazas y Motores Fuera de Borda',
      clienteNombre: 'Interno Flota Austral',
      presupuestoTotalClp: 18000000,
      activo: true,
      descripcion: 'Overhaul mecánico preventivo de barcazas.',
    },
  ]);

  // Rendiciones iniciales de demostración ("RindeGastos")
  const [reports, setReports] = useState<ExpenseReport[]>([
    {
      id: 'rdg-001',
      empresaId: 'client-retail-01',
      folio: 'RDG-2026-001',
      titulo: 'Visita Técnica Clientes Salmoaustral y Supervisión Centro Dalcahue',
      rendidorId: 'emp-001',
      rendidorNombre: 'Gonzalo Silva Valenzuela',
      rendidorRut: '14.238.192-8',
      rendidorEmail: 'gonzalo.silva@maraustral.cl',
      rendidorCargo: 'Supervisor Comercial & Operaciones',
      centroCostoId: 'cc-02',
      centroCostoCodigo: 'CC-VTA-STGO',
      centroCostoNombre: 'Ventas & Distribución Zona Central',
      proyectoId: 'pry-01',
      proyectoCodigo: 'PRY-QUELLON-26',
      proyectoNombre: 'Mantención Mayor Redes y Jaulas Balsas Quellón',
      fondoAsignadoClp: 150000,
      montoTotalRendidoClp: 184500,
      saldoReembolsarClp: 34500,
      saldoReintegrarClp: 0,
      moneda: 'CLP',
      estado: 'PENDIENTE_APROBACION',
      fechaInicio: '2026-09-24',
      fechaCierre: '2026-09-28',
      aprobadorNombre: 'Carla Morales Troncoso',
      agenteAuditorScore: 95,
      agenteAuditorDiagnostico: {
        calificacion: 'APROBADO_LIMPIO',
        scoreGlobal: 95,
        totalComprobantesValidos: 4,
        totalComprobantesObjetados: 0,
        montoIvaCreditoRecuperable: 16150,
        montoGastoRechazadoArt21: 0,
        alertas: [],
        recomendaciones: ['Gasto de combustible rendido con boleta. Se sugiere solicitar Factura para recuperar IVA Crédito.'],
        verificacionRutDuplicados: true,
        resumenTributario: 'Comprobantes íntegros con respaldo fidedigno Art. 31 LIR. Saldo a reembolsar: $34.500 CLP.',
      },
    },
    {
      id: 'rdg-002',
      empresaId: 'client-retail-01',
      folio: 'RDG-2026-002',
      titulo: 'Adquisición de Insumos y Repuestos Urgentes Maestranza Quellón',
      rendidorId: 'emp-002',
      rendidorNombre: 'Ing. Rodrigo Cárdenas Soto',
      rendidorRut: '13.914.882-K',
      rendidorEmail: 'rodrigo.cardenas@maraustral.cl',
      rendidorCargo: 'Jefe de Planta Quellón',
      centroCostoId: 'cc-03',
      centroCostoCodigo: 'CC-PRD-QUELLON',
      centroCostoNombre: 'Planta Fabril & Maestranza Quellón',
      proyectoId: 'pry-01',
      proyectoCodigo: 'PRY-QUELLON-26',
      proyectoNombre: 'Mantención Mayor Redes y Jaulas Balsas Quellón',
      fondoAsignadoClp: 200000,
      montoTotalRendidoClp: 165000,
      saldoReembolsarClp: 0,
      saldoReintegrarClp: 35000,
      moneda: 'CLP',
      estado: 'APROBADA',
      fechaInicio: '2026-09-15',
      fechaCierre: '2026-09-18',
      fechaAprobacion: '2026-09-20',
      aprobadorNombre: 'Carla Morales Troncoso',
      agenteAuditorScore: 100,
      agenteAuditorDiagnostico: {
        calificacion: 'APROBADO_LIMPIO',
        scoreGlobal: 100,
        totalComprobantesValidos: 2,
        totalComprobantesObjetados: 0,
        montoIvaCreditoRecuperable: 26345,
        montoGastoRechazadoArt21: 0,
        alertas: [],
        recomendaciones: [],
        verificacionRutDuplicados: true,
        resumenTributario: 'Aprobado por jefatura. El colaborador debe reintegrar $35.000 a la cuenta corriente de la empresa.',
      },
    },
    {
      id: 'rdg-003',
      empresaId: 'client-retail-01',
      folio: 'RDG-2026-003',
      titulo: 'Gira Comercial Cuentas Clave Mayoristas Santiago & Valparaíso',
      rendidorId: 'emp-001',
      rendidorNombre: 'Gonzalo Silva Valenzuela',
      rendidorRut: '14.238.192-8',
      rendidorEmail: 'gonzalo.silva@maraustral.cl',
      rendidorCargo: 'Supervisor Comercial & Operaciones',
      centroCostoId: 'cc-02',
      centroCostoCodigo: 'CC-VTA-STGO',
      centroCostoNombre: 'Ventas & Distribución Zona Central',
      proyectoId: 'pry-02',
      proyectoCodigo: 'PRY-STGO-EXP',
      proyectoNombre: 'Expansión Comercial & Distribución Retail Santiago',
      fondoAsignadoClp: 100000,
      montoTotalRendidoClp: 148000,
      saldoReembolsarClp: 48000,
      saldoReintegrarClp: 0,
      moneda: 'CLP',
      estado: 'CONTABILIZADA_PAGADA',
      fechaInicio: '2026-09-02',
      fechaCierre: '2026-09-06',
      fechaAprobacion: '2026-09-08',
      fechaPagoReembolso: '2026-09-10',
      aprobadorNombre: 'Carla Morales Troncoso',
      agenteAuditorScore: 100,
    },
  ]);

  // Comprobantes de las rendiciones
  const [items, setItems] = useState<ExpenseItem[]>([
    {
      id: 'item-01',
      expenseReportId: 'rdg-001',
      empresaId: 'client-retail-01',
      fecha: '2026-09-25',
      tipoDocumento: 'BOLETA_ELECTRONICA',
      folioDocumento: 'B-481920',
      proveedorRut: '99.520.000-7',
      proveedorRazonSocial: 'Compañía de Petróleos de Chile COPEC S.A.',
      categoria: 'COMBUSTIBLE',
      descripcionGlosa: 'Carga de Diesel camioneta terreno traslado Chiloé',
      montoNeto: 37815,
      montoIva: 7185,
      montoExento: 0,
      montoTotalClp: 45000,
      centroCostoId: 'cc-02',
      centroCostoCodigo: 'CC-VTA-STGO',
      proyectoId: 'pry-01',
      proyectoCodigo: 'PRY-QUELLON-26',
      cuentaContableCodigo: '4.2.01.009',
      cuentaContableNombre: 'Combustibles & Lubricantes',
      comprobanteArchivoNombre: 'boleta_copec_diesel_45000.jpg',
      esGastoRechazadoArt21: false,
      validadoPorAgente: true,
    },
    {
      id: 'item-02',
      expenseReportId: 'rdg-001',
      empresaId: 'client-retail-01',
      fecha: '2026-09-26',
      tipoDocumento: 'FACTURA_ELECTRONICA_33',
      folioDocumento: '91283',
      proveedorRut: '76.128.490-2',
      proveedorRazonSocial: 'Hotelera & Turismo del Sur SpA (Hotel Castro)',
      categoria: 'ALOJAMIENTO',
      descripcionGlosa: 'Hospedaje 2 noches personal técnico en terreno',
      montoNeto: 85000,
      montoIva: 16150,
      montoExento: 0,
      montoTotalClp: 101150,
      centroCostoId: 'cc-02',
      centroCostoCodigo: 'CC-VTA-STGO',
      proyectoId: 'pry-01',
      proyectoCodigo: 'PRY-QUELLON-26',
      cuentaContableCodigo: '4.2.01.007',
      cuentaContableNombre: 'Alojamiento & Estadía Terreno',
      comprobanteArchivoNombre: 'factura_hotel_castro_101150.pdf',
      esGastoRechazadoArt21: false,
      validadoPorAgente: true,
    },
    {
      id: 'item-03',
      expenseReportId: 'rdg-001',
      empresaId: 'client-retail-01',
      fecha: '2026-09-26',
      tipoDocumento: 'BOLETA_ELECTRONICA',
      folioDocumento: 'B-12839',
      proveedorRut: '77.819.200-5',
      proveedorRazonSocial: 'Restaurante Rincón Chilote Castro',
      categoria: 'ALIMENTACION',
      descripcionGlosa: 'Cena y almuerzo en terreno durante supervisión',
      montoNeto: 23824,
      montoIva: 4526,
      montoExento: 0,
      montoTotalClp: 28350,
      centroCostoId: 'cc-02',
      centroCostoCodigo: 'CC-VTA-STGO',
      proyectoId: 'pry-01',
      proyectoCodigo: 'PRY-QUELLON-26',
      cuentaContableCodigo: '4.2.01.006',
      cuentaContableNombre: 'Gastos de Alimentación & Viáticos',
      comprobanteArchivoNombre: 'boleta_restaurante_rincon_28350.jpg',
      esGastoRechazadoArt21: false,
      validadoPorAgente: true,
    },
    {
      id: 'item-04',
      expenseReportId: 'rdg-001',
      empresaId: 'client-retail-01',
      fecha: '2026-09-27',
      tipoDocumento: 'TICKET_PEAJE',
      folioDocumento: 'TAG-98124',
      proveedorRut: '96.812.390-1',
      proveedorRazonSocial: 'Sociedad Concesionaria Ruta del Canal S.A.',
      categoria: 'PEAJES_ESTACIONAMIENTOS',
      descripcionGlosa: 'Peajes y transbordo canal de Chacao ida y vuelta',
      montoNeto: 0,
      montoIva: 0,
      montoExento: 10000,
      montoTotalClp: 10000,
      centroCostoId: 'cc-02',
      centroCostoCodigo: 'CC-VTA-STGO',
      proyectoId: 'pry-01',
      proyectoCodigo: 'PRY-QUELLON-26',
      cuentaContableCodigo: '4.2.01.010',
      cuentaContableNombre: 'Peajes & Tag Autopistas',
      comprobanteArchivoNombre: 'ticket_peaje_chacao.jpg',
      esGastoRechazadoArt21: false,
      validadoPorAgente: true,
    },
    {
      id: 'item-05',
      expenseReportId: 'rdg-002',
      empresaId: 'client-retail-01',
      fecha: '2026-09-16',
      tipoDocumento: 'FACTURA_ELECTRONICA_33',
      folioDocumento: 'F-78192',
      proveedorRut: '76.992.110-3',
      proveedorRazonSocial: 'Ferretería Industrial Austral Ltda.',
      categoria: 'MATERIALES_INSUMOS',
      descripcionGlosa: 'Pernos de acero inox 316 y electrodos para balsas',
      montoNeto: 138655,
      montoIva: 26345,
      montoExento: 0,
      montoTotalClp: 165000,
      centroCostoId: 'cc-03',
      centroCostoCodigo: 'CC-PRD-QUELLON',
      proyectoId: 'pry-01',
      proyectoCodigo: 'PRY-QUELLON-26',
      cuentaContableCodigo: '4.1.02.001',
      cuentaContableNombre: 'Materiales Menores & Consumibles',
      comprobanteArchivoNombre: 'factura_ferreteria_165000.pdf',
      esGastoRechazadoArt21: false,
      validadoPorAgente: true,
    },
  ]);

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

  // Cálculos consolidados en tiempo real
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

  // Manejador crear reporte
  const handleCreateReport = (newRepData: Omit<ExpenseReport, 'id' | 'createdAt' | 'updatedAt' | 'comprobantes'>) => {
    const newReport: ExpenseReport = {
      ...newRepData,
      id: `rdg-${Date.now().toString(36)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      comprobantes: [],
    };
    setReports((prev) => [newReport, ...prev]);
    setSelectedReportDetail(newReport);
  };

  // Manejador agregar comprobante
  const handleAddExpenseItem = (newItemData: Omit<ExpenseItem, 'id' | 'createdAt'>) => {
    const newItem: ExpenseItem = {
      ...newItemData,
      id: `item-${Date.now().toString(36)}`,
      createdAt: new Date().toISOString(),
    };

    setItems((prev) => [newItem, ...prev]);

    // Recalcular montos en la rendición padre
    setReports((prev) =>
      prev.map((r) => {
        if (r.id === newItem.expenseReportId) {
          const reportItems = [...items.filter((i) => i.expenseReportId === r.id), newItem];
          const totalRendido = reportItems.reduce((acc, i) => acc + i.montoTotalClp, 0);
          const saldoReembolsar = Math.max(0, totalRendido - r.fondoAsignadoClp);
          const saldoReintegrar = Math.max(0, r.fondoAsignadoClp - totalRendido);
          const diag = auditExpenseReport(r, reportItems, prev);

          const updated = {
            ...r,
            montoTotalRendidoClp: totalRendido,
            saldoReembolsarClp: saldoReembolsar,
            saldoReintegrarClp: saldoReintegrar,
            agenteAuditorScore: diag.scoreGlobal,
            agenteAuditorDiagnostico: diag,
          };
          if (selectedReportDetail?.id === r.id) {
            setSelectedReportDetail(updated);
          }
          return updated;
        }
        return r;
      })
    );
  };

  // Manejador eliminar comprobante
  const handleDeleteExpenseItem = (itemId: string) => {
    const itemToDelete = items.find((i) => i.id === itemId);
    if (!itemToDelete) return;

    const remainingItems = items.filter((i) => i.id !== itemId);
    setItems(remainingItems);

    setReports((prev) =>
      prev.map((r) => {
        if (r.id === itemToDelete.expenseReportId) {
          const repItems = remainingItems.filter((i) => i.expenseReportId === r.id);
          const totalRendido = repItems.reduce((acc, i) => acc + i.montoTotalClp, 0);
          const saldoReembolsar = Math.max(0, totalRendido - r.fondoAsignadoClp);
          const saldoReintegrar = Math.max(0, r.fondoAsignadoClp - totalRendido);
          const diag = auditExpenseReport(r, repItems, prev);

          const updated = {
            ...r,
            montoTotalRendidoClp: totalRendido,
            saldoReembolsarClp: saldoReembolsar,
            saldoReintegrarClp: saldoReintegrar,
            agenteAuditorScore: diag.scoreGlobal,
            agenteAuditorDiagnostico: diag,
          };
          if (selectedReportDetail?.id === r.id) {
            setSelectedReportDetail(updated);
          }
          return updated;
        }
        return r;
      })
    );
  };

  // Manejador cambiar estado
  const handleUpdateReportStatus = (
    reportId: string,
    newStatus: ExpenseReport['estado'],
    observations?: string
  ) => {
    setReports((prev) =>
      prev.map((r) => {
        if (r.id === reportId) {
          const updated = {
            ...r,
            estado: newStatus,
            observacionesAprobador: observations || r.observacionesAprobador,
            fechaAprobacion: newStatus === 'APROBADA' ? new Date().toISOString().substring(0, 10) : r.fechaAprobacion,
            fechaPagoReembolso: newStatus === 'CONTABILIZADA_PAGADA' ? new Date().toISOString().substring(0, 10) : r.fechaPagoReembolso,
          };
          if (selectedReportDetail?.id === r.id) {
            setSelectedReportDetail(updated);
          }
          return updated;
        }
        return r;
      })
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Superior con Branding y KPIs */}
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
                Flujo de aprobación, comprobantes con OCR, imputación a Centros de Costo & Proyectos y centralización en Libro Diario
              </p>
            </div>
          </div>
        </div>

        {/* Botones de Acción */}
        <div className="flex flex-wrap items-center gap-2.5">
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
            <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full">
              Requiere Firma
            </span>
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
            <span className="text-2xl font-black text-slate-900 font-mono">98%</span>
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

          {/* Listado de Rendiciones */}
          <div className="p-4 space-y-3">
            {filteredReports.length === 0 ? (
              <div className="p-12 text-center bg-slate-50 border border-dashed border-slate-300 rounded-2xl">
                <CreditCard className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-slate-700">No se encontraron rendiciones</h4>
                <p className="text-xs text-slate-500 mt-1">Ajuste los filtros o cree una nueva rendición con el botón superior.</p>
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

                        <h3 className="text-sm font-bold text-slate-900 hover:text-blue-600 transition-colors cursor-pointer"
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
                            {reportComprobantes.length} comprobantes
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
                Trazabilidad completa con desglose de IVA Crédito Fiscal, comprobante fotográfico y cuenta contable
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-lg">
              {items.length} Documentos Digitalizados
            </span>
          </div>

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
            </div>

            <div className="space-y-3">
              {projects.map((pry) => {
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
              })}
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
        nextFolioNumber={reports.length + 1}
      />

      {selectedReportDetail && (
        <ExpenseReportDetailModal
          isOpen={!!selectedReportDetail}
          onClose={() => setSelectedReportDetail(null)}
          report={selectedReportDetail}
          comprobantes={items.filter((i) => i.expenseReportId === selectedReportDetail.id)}
          onAddComprobanteClick={() => setShowAddItemModal(true)}
          onDeleteComprobante={handleDeleteExpenseItem}
          onUpdateReportStatus={handleUpdateReportStatus}
          onCommitAccountingEntry={onAddEntry}
          chartOfAccounts={chartOfAccounts}
        />
      )}

      {showAddItemModal && selectedReportDetail && (
        <AddExpenseItemModal
          isOpen={showAddItemModal}
          onClose={() => setShowAddItemModal(false)}
          onAdd={handleAddExpenseItem}
          report={selectedReportDetail}
          costCenters={costCenters}
          projects={projects}
        />
      )}
    </div>
  );
};
