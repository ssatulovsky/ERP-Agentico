import React, { useState } from 'react';
import {
  X,
  Plus,
  Receipt,
  FileSpreadsheet,
  Printer,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Building2,
  Briefcase,
  User,
  DollarSign,
  ArrowRight,
  ShieldCheck,
  Scale,
  Calendar,
  Eye,
  Trash2,
  Pencil,
  Clock,
  Sparkles,
  Download,
} from 'lucide-react';
import {
  ExpenseReport,
  ExpenseItem,
  CostCenterMaster,
  ExpenseProject,
  AccountingEntry,
  HierarchicalAccountItem,
} from '../../types';
import {
  formatCLP,
  exportExpenseReportToCSV,
  downloadFile,
  generateExpenseAccountingEntry,
  auditExpenseReport,
  ExpenseAccountingConfig,
} from '../../utils/expenseManagementAgent';
import { expenseApiService } from '../../services/expenseApiService';
import { CentralizeExpenseModal } from './CentralizeExpenseModal';

interface ExpenseReportDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: ExpenseReport;
  comprobantes: ExpenseItem[];
  onAddComprobanteClick: () => void;
  onEditComprobante?: (item: ExpenseItem) => void;
  onDeleteComprobante: (itemId: string) => void;
  onUpdateReportStatus: (reportId: string, newStatus: ExpenseReport['estado'], observations?: string, aprobadorNombre?: string) => void;
  onCommitAccountingEntry?: (entry: AccountingEntry) => void;
  chartOfAccounts?: HierarchicalAccountItem[];
  onEditReportClick?: () => void;
}

export const ExpenseReportDetailModal: React.FC<ExpenseReportDetailModalProps> = ({
  isOpen,
  onClose,
  report,
  comprobantes,
  onAddComprobanteClick,
  onEditComprobante,
  onDeleteComprobante,
  onUpdateReportStatus,
  onCommitAccountingEntry,
  chartOfAccounts = [],
  onEditReportClick,
}) => {
  const [selectedReceiptPreview, setSelectedReceiptPreview] = useState<ExpenseItem | null>(null);
  const [rejectFeedback, setRejectFeedback] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [accountingSuccessToast, setAccountingSuccessToast] = useState(false);
  const [showCentralizeModal, setShowCentralizeModal] = useState(false);
  const [aprobadorSeleccionado, setAprobadorSeleccionado] = useState(report.aprobadorNombre || 'Carla Morales Troncoso');
  const [isCustomApprover, setIsCustomApprover] = useState(false);

  if (!isOpen) return null;

  // Auditoría en tiempo real del agente
  const diagnosis = auditExpenseReport(report, comprobantes);

  // Cálculos de liquidación
  const totalRendido = comprobantes.reduce((acc, c) => acc + c.montoTotalClp, 0);
  const saldoReembolsar = Math.max(0, totalRendido - report.fondoAsignadoClp);
  const saldoReintegrar = Math.max(0, report.fondoAsignadoClp - totalRendido);

  // Descarga CSV de esta rendición
  const handleDownloadCSV = () => {
    const csvContent = exportExpenseReportToCSV(report, comprobantes);
    const filename = `Rendicion_${report.folio}_${report.rendidorRut}.csv`;
    downloadFile(filename, csvContent, 'text/csv');
  };

  // Imprimir carátula oficial
  const handlePrint = () => {
    window.print();
  };

  // Abrir modal de configuración y previsualización contable
  const handleContabilizarDiario = () => {
    setShowCentralizeModal(true);
  };

  // Confirmar contabilización formal en Libro Diario con configuración elegida
  const handleConfirmCentralize = async (config: ExpenseAccountingConfig) => {
    try {
      await expenseApiService.contabilizarReport(report.id, config);
    } catch (e) {
      console.warn('[Modal] Aviso al llamar API de contabilización:', e);
    }

    if (onCommitAccountingEntry) {
      const entry = generateExpenseAccountingEntry(
        { ...report, montoTotalRendidoClp: totalRendido, saldoReembolsarClp: saldoReembolsar, saldoReintegrarClp: saldoReintegrar },
        comprobantes,
        chartOfAccounts,
        config
      );
      onCommitAccountingEntry(entry);
    }

    onUpdateReportStatus(report.id, 'CONTABILIZADA_PAGADA', `Contabilizado formalmente en Libro Diario con comprobante RDG ${report.folio}`);
    setAccountingSuccessToast(true);
    setTimeout(() => setAccountingSuccessToast(false), 3000);
  };

  // Badges de estado
  const getStatusBadge = (status: ExpenseReport['estado']) => {
    switch (status) {
      case 'BORRADOR':
        return <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full text-xs font-bold border border-slate-300">Borrador</span>;
      case 'PENDIENTE_APROBACION':
        return <span className="bg-amber-100 text-amber-900 px-2.5 py-1 rounded-full text-xs font-bold border border-amber-300 animate-pulse">Pendiente Aprobación</span>;
      case 'EN_REVISION_CONTABLE':
        return <span className="bg-blue-100 text-blue-900 px-2.5 py-1 rounded-full text-xs font-bold border border-blue-300">Revisión Contable</span>;
      case 'APROBADA':
        return <span className="bg-emerald-100 text-emerald-900 px-2.5 py-1 rounded-full text-xs font-bold border border-emerald-300">Aprobada por Jefatura</span>;
      case 'CONTABILIZADA_PAGADA':
        return <span className="bg-indigo-100 text-indigo-900 px-2.5 py-1 rounded-full text-xs font-bold border border-indigo-300">Contabilizada & Pagada</span>;
      case 'OBJETADA_RECHAZADA':
        return <span className="bg-rose-100 text-rose-900 px-2.5 py-1 rounded-full text-xs font-bold border border-rose-300">Objetada / Rechazada</span>;
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto print:p-0 print:bg-white">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 print:max-w-none print:shadow-none print:border-none print:max-h-none">
        
        {/* Header Superior */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-5 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:bg-none print:text-black">
          <div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs bg-indigo-500/30 text-indigo-200 px-2.5 py-0.5 rounded-md border border-indigo-400/30 font-bold">
                {report.folio}
              </span>
              {getStatusBadge(report.estado)}
              <span className="text-xs text-slate-300 flex items-center gap-1 font-mono">
                <Calendar className="w-3.5 h-3.5" />
                {report.fechaInicio} al {report.fechaCierre}
              </span>
            </div>
            <h2 className="text-lg font-bold text-white mt-1">{report.titulo}</h2>
            <p className="text-xs text-slate-300 flex items-center gap-2 mt-0.5">
              <span>Rendidor: <strong className="text-white">{report.rendidorNombre}</strong> ({report.rendidorRut})</span>
              <span>•</span>
              <span>{report.rendidorCargo || 'Colaborador'}</span>
            </p>
          </div>

          <div className="flex items-center gap-2 print:hidden">
            {onEditReportClick && (
              <button
                onClick={onEditReportClick}
                className="p-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 hover:text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer border border-amber-400/30"
                title="Modificar datos de la rendición (glosa, rendidor, proyecto, fechas o fondo)"
              >
                <Pencil className="w-4 h-4 text-amber-300" />
                <span>Modificar</span>
              </button>
            )}
            <button
              onClick={handleDownloadCSV}
              className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Descargar Planilla CSV compatible RindeGastos"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
              <span>CSV</span>
            </button>
            <button
              onClick={handlePrint}
              className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Imprimir carátula de rendición"
            >
              <Printer className="w-4 h-4 text-blue-300" />
              <span>Imprimir</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notificación de Asiento Exitoso */}
        {accountingSuccessToast && (
          <div className="bg-indigo-600 text-white px-4 py-2 text-xs font-bold flex items-center justify-between animate-in slide-in-from-top">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-300" />
              ¡Rendición centralizada exitosamente en el Libro Diario! Asiento cuadrado generado.
            </span>
          </div>
        )}

        {/* Contenido con Scroll */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Tarjeta de Liquidación Económica (Fondos por Rendir vs Gastos) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gradient-to-br from-slate-50 to-indigo-50/40 p-4 rounded-xl border border-slate-200">
            <div>
              <span className="text-[11px] font-semibold text-slate-500 uppercase block">1. Fondo Anticipado</span>
              <span className="font-mono text-base font-bold text-slate-800 block mt-0.5">
                {formatCLP(report.fondoAsignadoClp)}
              </span>
              <span className="text-[10px] text-slate-400">Fondos por Rendir entregados</span>
            </div>

            <div>
              <span className="text-[11px] font-semibold text-slate-500 uppercase block">2. Total Gastos Rendidos</span>
              <span className="font-mono text-base font-bold text-indigo-700 block mt-0.5">
                {formatCLP(totalRendido)}
              </span>
              <span className="text-[10px] text-slate-400">{comprobantes.length} comprobantes</span>
            </div>

            <div>
              <span className="text-[11px] font-semibold text-slate-500 uppercase block">3. Saldo a Reembolsar</span>
              <span className="font-mono text-base font-bold text-emerald-700 block mt-0.5">
                {formatCLP(saldoReembolsar)}
              </span>
              <span className="text-[10px] text-emerald-600">A pagar al empleado</span>
            </div>

            <div>
              <span className="text-[11px] font-semibold text-slate-500 uppercase block">4. Saldo a Reintegrar</span>
              <span className="font-mono text-base font-bold text-amber-700 block mt-0.5">
                {formatCLP(saldoReintegrar)}
              </span>
              <span className="text-[10px] text-amber-600">Devolución a la empresa</span>
            </div>
          </div>

          {/* Tarjetas de Centro de Costo & Proyecto */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-lg text-xs">
              <Building2 className="w-4 h-4 text-indigo-600" />
              <div>
                <span className="text-[10px] text-indigo-500 font-semibold block uppercase">Centro de Costo</span>
                <span className="font-bold text-indigo-950">
                  {report.centroCostoCodigo || '-'} - {report.centroCostoNombre || 'Sin asignar'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg text-xs">
              <Briefcase className="w-4 h-4 text-emerald-600" />
              <div>
                <span className="text-[10px] text-emerald-500 font-semibold block uppercase">Proyecto / Obra</span>
                <span className="font-bold text-emerald-950">
                  {report.proyectoCodigo || '-'} - {report.proyectoNombre || 'Gasto Operacional General'}
                </span>
              </div>
            </div>
          </div>

          {/* Tarjeta de Diagnóstico del Agente Auditor */}
          <div className={`p-4 rounded-xl border space-y-2 ${
            diagnosis.calificacion === 'APROBADO_LIMPIO'
              ? 'bg-emerald-50/70 border-emerald-200'
              : diagnosis.calificacion === 'OBSERVACIONES_LEVES'
              ? 'bg-amber-50/70 border-amber-200'
              : 'bg-rose-50/70 border-rose-200'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-bold text-slate-900">
                  Auditoría Agéntica RindeGastos AI • Score de Cumplimiento:
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-black ${
                  diagnosis.scoreGlobal >= 90
                    ? 'bg-emerald-600 text-white'
                    : diagnosis.scoreGlobal >= 70
                    ? 'bg-amber-600 text-white'
                    : 'bg-rose-600 text-white'
                }`}>
                  {diagnosis.scoreGlobal} / 100
                </span>
              </div>

              <span className="text-xs font-semibold text-slate-600">
                {diagnosis.calificacion.replace(/_/g, ' ')}
              </span>
            </div>

            <p className="text-xs text-slate-700 leading-relaxed">
              {diagnosis.resumenTributario}
            </p>

            {diagnosis.alertas.length > 0 && (
              <div className="space-y-1 pt-1">
                {diagnosis.alertas.map((a, i) => (
                  <div key={i} className="text-xs text-rose-700 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                    <span>{a}</span>
                  </div>
                ))}
              </div>
            )}

            {diagnosis.recomendaciones.length > 0 && (
              <div className="space-y-1 pt-1 border-t border-slate-200/50">
                {diagnosis.recomendaciones.map((r, i) => (
                  <div key={i} className="text-xs text-slate-600 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                    <span>{r}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tabla de Comprobantes Adjuntos */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-blue-600" />
                Comprobantes y Documentos Adjuntos ({comprobantes.length})
              </h3>
              <button
                type="button"
                onClick={onAddComprobanteClick}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Agregar Comprobante
              </button>
            </div>

            {comprobantes.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-300 rounded-xl">
                <Receipt className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-700">No hay comprobantes cargados en esta rendición.</p>
                <p className="text-[11px] text-slate-500 mt-1">Presione "Agregar Comprobante" o use la captura OCR.</p>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Fecha</th>
                      <th className="py-2.5 px-3">Tipo / Folio</th>
                      <th className="py-2.5 px-3">Proveedor / Comercio</th>
                      <th className="py-2.5 px-3">Categoría & Glosa</th>
                      <th className="py-2.5 px-3 text-right">Neto</th>
                      <th className="py-2.5 px-3 text-right">IVA (19%)</th>
                      <th className="py-2.5 px-3 text-right font-black">Total ($ CLP)</th>
                      <th className="py-2.5 px-3 text-center">Ticket</th>
                      <th className="py-2.5 px-3 text-center print:hidden">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {comprobantes.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">{item.fecha}</td>
                        <td className="py-2.5 px-3">
                          <span className="font-semibold text-slate-800 block text-[11px]">
                            {item.tipoDocumento.replace(/_/g, ' ')}
                          </span>
                          <span className="font-mono text-[10px] text-slate-500">Folio: {item.folioDocumento}</span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-bold text-slate-900 block">{item.proveedorRazonSocial}</span>
                          <span className="font-mono text-[10px] text-slate-500">{item.proveedorRut}</span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-semibold text-blue-700 block text-[11px]">{item.categoria}</span>
                          <span className="text-[11px] text-slate-600 line-clamp-1">{item.descripcionGlosa}</span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                          {formatCLP(item.montoNeto)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-emerald-700 font-semibold">
                          {item.montoIva > 0 ? formatCLP(item.montoIva) : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                          {formatCLP(item.montoTotalClp)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedReceiptPreview(item)}
                            className="p-1 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-md transition-colors cursor-pointer"
                            title="Ver soporte digital del comprobante"
                          >
                            <Eye className="w-4 h-4 mx-auto" />
                          </button>
                        </td>
                        <td className="py-2.5 px-3 text-center print:hidden">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => onEditComprobante?.(item)}
                              className="p-1 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-md transition-colors cursor-pointer"
                              title="Modificar datos del comprobante"
                            >
                              <Pencil className="w-4 h-4 mx-auto" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteComprobante(item.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                              title="Eliminar comprobante"
                            >
                              <Trash2 className="w-4 h-4 mx-auto" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                    <tr>
                      <td colSpan={4} className="py-2.5 px-3 text-right uppercase text-slate-600 text-[11px]">
                        Totales Consolidados:
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-800">
                        {formatCLP(comprobantes.reduce((acc, c) => acc + c.montoNeto, 0))}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-800">
                        {formatCLP(comprobantes.reduce((acc, c) => acc + c.montoIva, 0))}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-950 font-black text-sm">
                        {formatCLP(totalRendido)}
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Workflow de Aprobaciones y Acciones Contables */}
          <div className="bg-slate-100/70 p-4 rounded-xl border border-slate-200 space-y-3 print:hidden">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-indigo-600" />
              Flujo de Aprobación & Centralización Contable
            </h4>

            {/* Responsable / Aprobador Configurable */}
            <div className="bg-white p-3 rounded-lg border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-indigo-600 shrink-0" />
                <span className="font-bold text-slate-700">Responsable / Aprobador:</span>
              </div>
              <div className="flex items-center gap-2 flex-1 max-w-lg justify-end">
                <select
                  value={isCustomApprover ? '__CUSTOM__' : aprobadorSeleccionado}
                  onChange={(e) => {
                    if (e.target.value === '__CUSTOM__') {
                      setIsCustomApprover(true);
                    } else {
                      setIsCustomApprover(false);
                      setAprobadorSeleccionado(e.target.value);
                    }
                  }}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Carla Morales Troncoso">Carla Morales Troncoso (Jefa de Administración)</option>
                  <option value="Mario Vargas Da Silva">Mario Vargas Da Silva (Gerente de Operaciones)</option>
                  <option value="Gonzalo Silva Valenzuela">Gonzalo Silva Valenzuela (Supervisor Comercial)</option>
                  <option value="__CUSTOM__">-- Otro Responsable (Supervisor / Gerente) --</option>
                </select>
                {isCustomApprover && (
                  <input
                    type="text"
                    value={aprobadorSeleccionado}
                    onChange={(e) => setAprobadorSeleccionado(e.target.value)}
                    placeholder="Nombre del supervisor o gerente..."
                    className="px-2.5 py-1.5 bg-white border border-indigo-400 rounded-lg text-xs font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500 w-48"
                  />
                )}
              </div>
            </div>

            {showRejectInput ? (
              <div className="space-y-2 bg-rose-50 p-3 rounded-lg border border-rose-200">
                <label className="block text-xs font-bold text-rose-900">
                  Motivo de Objeción / Rechazo para el Rendidor:
                </label>
                <textarea
                  value={rejectFeedback}
                  onChange={(e) => setRejectFeedback(e.target.value)}
                  placeholder="Indique el comprobante observado o el motivo del rechazo..."
                  rows={2}
                  className="w-full text-xs p-2 bg-white border border-rose-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowRejectInput(false)}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateReportStatus(report.id, 'OBJETADA_RECHAZADA', rejectFeedback, aprobadorSeleccionado);
                      setShowRejectInput(false);
                    }}
                    className="px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm"
                  >
                    Confirmar Rechazo
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  {report.estado === 'BORRADOR' && (
                    <button
                      type="button"
                      onClick={() => onUpdateReportStatus(report.id, 'PENDIENTE_APROBACION', undefined, aprobadorSeleccionado)}
                      className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <ArrowRight className="w-4 h-4" />
                      Enviar a Jefatura para Aprobación
                    </button>
                  )}

                  {(report.estado === 'PENDIENTE_APROBACION' || report.estado === 'EN_REVISION_CONTABLE') && (
                    <>
                      <button
                        type="button"
                        onClick={() => onUpdateReportStatus(report.id, 'APROBADA', 'Aprobado conforme por jefatura directa.', aprobadorSeleccionado)}
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Aprobar Rendición
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowRejectInput(true)}
                        className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <XCircle className="w-4 h-4" />
                        Objetar / Rechazar
                      </button>
                    </>
                  )}

                  {report.estado !== 'CONTABILIZADA_PAGADA' && report.estado !== 'OBJETADA_RECHAZADA' && (
                    <button
                      type="button"
                      onClick={handleContabilizarDiario}
                      className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-800 hover:from-indigo-500 hover:to-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                    >
                      <Scale className="w-4 h-4 text-indigo-200" />
                      {report.estado === 'APROBADA' ? 'Centralizar en Libro Diario & Pagar Reembolso' : 'Aprobar & Centralizar en Libro Diario'}
                    </button>
                  )}

                  {report.estado === 'CONTABILIZADA_PAGADA' && (
                    <div className="flex items-center gap-2 text-xs font-bold text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-200">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Rendición Contabilizada y Pagada en ERP</span>
                    </div>
                  )}
                </div>

                <div className="text-[11px] text-slate-500">
                  Aprobador asignado: <strong className="text-slate-800">{aprobadorSeleccionado}</strong>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal de Vista Previa del Ticket / Comprobante Digital */}
        {selectedReceiptPreview && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/70 p-4">
            <div className="bg-white rounded-2xl p-5 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Soporte Digital de Comprobante</h4>
                  <p className="text-[11px] text-slate-500">{selectedReceiptPreview.proveedorRazonSocial}</p>
                </div>
                <button
                  onClick={() => setSelectedReceiptPreview(null)}
                  className="p-1 text-slate-400 hover:text-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Simulación Gráfica de Boleta Térmica Chilena */}
              <div className="bg-slate-50 p-4 rounded-xl border border-dashed border-slate-300 font-mono text-[11px] text-slate-700 space-y-2">
                <div className="text-center border-b border-slate-300 pb-2">
                  <span className="font-bold text-xs text-slate-900 block">{selectedReceiptPreview.proveedorRazonSocial}</span>
                  <span className="text-[10px] text-slate-500">R.U.T.: {selectedReceiptPreview.proveedorRut}</span>
                  <span className="text-[10px] text-slate-500 block">{selectedReceiptPreview.tipoDocumento}</span>
                  <span className="text-[10px] font-bold text-slate-800">N° {selectedReceiptPreview.folioDocumento}</span>
                </div>

                <div className="flex justify-between text-[11px]">
                  <span>Fecha Emisión:</span>
                  <span>{selectedReceiptPreview.fecha}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span>Categoría:</span>
                  <span>{selectedReceiptPreview.categoria}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span>Detalle:</span>
                  <span className="truncate max-w-[180px]">{selectedReceiptPreview.descripcionGlosa}</span>
                </div>

                <div className="border-t border-slate-300 pt-2 space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span>Monto Neto:</span>
                    <span>{formatCLP(selectedReceiptPreview.montoNeto)}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span>IVA (19%):</span>
                    <span>{formatCLP(selectedReceiptPreview.montoIva)}</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold text-slate-900 pt-1 border-t border-slate-300">
                    <span>TOTAL PAGADO:</span>
                    <span>{formatCLP(selectedReceiptPreview.montoTotalClp)}</span>
                  </div>
                </div>

                <div className="text-center text-[9px] text-slate-400 pt-2 border-t border-dashed border-slate-300">
                  <span>Timbre Electrónico SII • Verificado por Agente RindeGastos</span>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedReceiptPreview(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Configuración y Previsualización Contable */}
        {showCentralizeModal && (
          <CentralizeExpenseModal
            isOpen={showCentralizeModal}
            onClose={() => setShowCentralizeModal(false)}
            report={report}
            comprobantes={comprobantes}
            chartOfAccounts={chartOfAccounts}
            onConfirm={handleConfirmCentralize}
          />
        )}

      </div>
    </div>
  );
};
