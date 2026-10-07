import React, { useState, useMemo } from 'react';
import {
  FileText,
  Plus,
  Search,
  BookOpen,
  Sparkles,
  Download,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Trash2,
  Check,
  Building,
  Tag,
  Scale,
  FileCheck2,
  Layers,
} from 'lucide-react';
import {
  FinancialStatementNote,
  FinancialNoteCategory,
  FinancialNoteNorm,
  HierarchicalAccountItem,
  Balance8ColumnasReport,
  ClientCompany,
} from '../../types';
import {
  computeNoteBreakdown,
  generateAgentNoteDraft,
  DEFAULT_FINANCIAL_NOTES_CATALOG,
} from '../../utils/financialNotesService';
import { downloadFinancialNotesBookletPdf, fmtClp } from '../../utils/reportGenerators';

interface FinancialStatementNotesViewProps {
  notes: FinancialStatementNote[];
  chartOfAccounts: HierarchicalAccountItem[];
  balance8Col: Balance8ColumnasReport;
  company: ClientCompany;
  onUpdateNotes: (updatedNotes: FinancialStatementNote[]) => void;
  onUpdateChartOfAccounts: (updatedChart: HierarchicalAccountItem[]) => void;
  selectedNoteNumber?: number | null;
  onSelectNoteNumber?: (num: number | null) => void;
  onNavigateToMayor?: (accountCode: string) => void;
}

const CATEGORY_LABELS: Record<FinancialNoteCategory, string> = {
  IDENTIFICACION_EMPRESA: 'Identificación y Objeto Social',
  POLITICAS_CONTABLES: 'Políticas Contables (NIC 1)',
  ACTIVO_CORRIENTE: 'Activos Corrientes (Circulante)',
  ACTIVO_NO_CORRIENTE: 'Activos No Corrientes (Fijos)',
  PASIVO_CORRIENTE: 'Pasivos Corrientes (Corto Plazo)',
  PASIVO_NO_CORRIENTE: 'Pasivos No Corrientes (Largo Plazo)',
  PATRIMONIO_NETO: 'Patrimonio Neto',
  INGRESOS_OPERACIONALES: 'Ingresos Operacionales (NIIF 15)',
  COSTOS_Y_GASTOS: 'Costos y Gastos de Explotación',
  RESULTADO_FINANCIERO: 'Resultados Financieros (NIC 21)',
  CONTINGENCIAS_Y_HECHOS_POSTERIORES: 'Contingencias y Hechos Posteriores (NIC 10)',
};

const NORMA_OPTIONS: { value: FinancialNoteNorm; label: string }[] = [
  { value: 'NIC_1', label: 'NIC 1 - Presentación de EE.FF.' },
  { value: 'NIC_2', label: 'NIC 2 - Inventarios / Existencias' },
  { value: 'NIC_7', label: 'NIC 7 - Flujos de Efectivo' },
  { value: 'NIC_16', label: 'NIC 16 - Propiedades, Planta y Equipo' },
  { value: 'NIC_21', label: 'NIC 21 - Efectos de Tasa de Cambio (Moneda Extranjera)' },
  { value: 'NIC_12', label: 'NIC 12 - Impuesto a las Ganancias' },
  { value: 'NIC_19', label: 'NIC 19 - Beneficios a los Empleados' },
  { value: 'NIC_37', label: 'NIC 37 - Provisiones y Contingencias' },
  { value: 'NIC_10', label: 'NIC 10 - Hechos Posteriores al Cierre' },
  { value: 'NIIF_9', label: 'NIIF 9 - Instrumentos Financieros' },
  { value: 'NIIF_15', label: 'NIIF 15 - Ingresos de Contratos con Clientes' },
  { value: 'NIIF_16', label: 'NIIF 16 - Arrendamientos' },
  { value: 'CMF_CIRCULAR_1501', label: 'Circular CMF N° 1.501 (Chile)' },
  { value: 'POLITICA_GENERAL', label: 'Bases y Políticas Generales' },
];

export const FinancialStatementNotesView: React.FC<FinancialStatementNotesViewProps> = ({
  notes,
  chartOfAccounts,
  balance8Col,
  company,
  onUpdateNotes,
  onUpdateChartOfAccounts,
  selectedNoteNumber,
  onSelectNoteNumber,
  onNavigateToMayor,
}) => {
  // Estado local para selección de nota activa
  const [internalSelectedNumber, setInternalSelectedNumber] = useState<number>(
    selectedNoteNumber || (notes.length > 0 ? notes[0].numero : 1)
  );

  // Sincronizar si cambia desde prop externa
  React.useEffect(() => {
    if (selectedNoteNumber !== undefined && selectedNoteNumber !== null) {
      setInternalSelectedNumber(selectedNoteNumber);
    }
  }, [selectedNoteNumber]);

  const activeNoteNumber = selectedNoteNumber ?? internalSelectedNumber;

  const handleSelectNote = (num: number) => {
    setInternalSelectedNumber(num);
    if (onSelectNoteNumber) {
      onSelectNoteNumber(num);
    }
  };

  // Filtros de búsqueda
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('TODAS');

  // Estado de edición de la nota activa
  const activeNote = useMemo(() => {
    return notes.find((n) => n.numero === activeNoteNumber) || notes[0];
  }, [notes, activeNoteNumber]);

  const [draftContent, setDraftContent] = useState(activeNote?.contenido || '');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(false);

  React.useEffect(() => {
    if (activeNote) {
      setDraftContent(activeNote.contenido || '');
      setSaveSuccessMsg(false);
    }
  }, [activeNote]);

  // Modal para agregar cuenta a la nota
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
  const [accountSearchInModal, setAccountSearchInModal] = useState('');

  // Modal para crear nueva nota
  const [isCreateNoteModalOpen, setIsCreateNoteModalOpen] = useState(false);
  const [newNoteNumber, setNewNoteNumber] = useState<number>(
    notes.length > 0 ? Math.max(...notes.map((n) => n.numero)) + 1 : 1
  );
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteCategory, setNewNoteCategory] = useState<FinancialNoteCategory>('ACTIVO_CORRIENTE');
  const [newNoteNorm, setNewNoteNorm] = useState<FinancialNoteNorm>('NIC_1');

  // Calcular desglose de partidas de la nota activa
  const noteBreakdown = useMemo(() => {
    if (!activeNote) return { items: [], totalDebe: 0, totalHaber: 0, totalSaldoFinal: 0 };
    return computeNoteBreakdown(activeNote, balance8Col, chartOfAccounts);
  }, [activeNote, balance8Col, chartOfAccounts]);

  // Filtrado de notas en la barra lateral
  const filteredNotes = useMemo(() => {
    return notes
      .filter((n) => {
        if (selectedCategoryFilter !== 'TODAS' && n.categoria !== selectedCategoryFilter) {
          return false;
        }
        if (!searchTerm.trim()) return true;
        const q = searchTerm.toLowerCase();
        const matchesTitle = n.titulo.toLowerCase().includes(q);
        const matchesNum = String(n.numero).includes(q);
        const matchesContent = (n.contenido || '').toLowerCase().includes(q);
        const matchesAccount = (n.cuentasAsociadas || []).some((code) => code.toLowerCase().includes(q));
        return matchesTitle || matchesNum || matchesContent || matchesAccount;
      })
      .sort((a, b) => a.numero - b.numero);
  }, [notes, selectedCategoryFilter, searchTerm]);

  // Guardar redacción de la nota activa
  const handleSaveDraft = () => {
    if (!activeNote) return;
    const updated = notes.map((n) =>
      n.id === activeNote.id
        ? {
            ...n,
            contenido: draftContent,
            ultimaModificacion: new Date().toISOString(),
            modificadoPor: 'Usuario Contador / Auditor',
          }
        : n
    );
    onUpdateNotes(updated);
    setSaveSuccessMsg(true);
    setTimeout(() => setSaveSuccessMsg(false), 2500);
  };

  // Asistente IA para generar redacción con cifras
  const handleGenerateWithAi = () => {
    if (!activeNote) return;
    const aiDraft = generateAgentNoteDraft(activeNote, noteBreakdown, company);
    setDraftContent(aiDraft);
    const updated = notes.map((n) =>
      n.id === activeNote.id
        ? {
            ...n,
            contenido: aiDraft,
            ultimaModificacion: new Date().toISOString(),
            modificadoPor: 'Agente Asistente IA Contable',
          }
        : n
    );
    onUpdateNotes(updated);
    setSaveSuccessMsg(true);
    setTimeout(() => setSaveSuccessMsg(false), 2500);
  };

  // Cambiar estado de auditoría de la nota (Borrador, En Revisión, Dictaminada)
  const handleChangeStatus = (status: 'BORRADOR' | 'EN_REVISION' | 'DICTAMINADA') => {
    if (!activeNote) return;
    const updated = notes.map((n) =>
      n.id === activeNote.id
        ? {
            ...n,
            estado: status,
            ultimaModificacion: new Date().toISOString(),
          }
        : n
    );
    onUpdateNotes(updated);
  };

  // Desvincular una cuenta de la nota activa
  const handleRemoveAccountFromNote = (accountCode: string) => {
    if (!activeNote) return;
    const newAccounts = activeNote.cuentasAsociadas.filter((c) => c !== accountCode);
    const updatedNotes = notes.map((n) =>
      n.id === activeNote.id ? { ...n, cuentasAsociadas: newAccounts } : n
    );
    onUpdateNotes(updatedNotes);

    // Actualizar también en el plan de cuentas
    const updatedChart = chartOfAccounts.map((acc) => {
      if (acc.codigo === accountCode && acc.notasExplicativas) {
        const filtered = acc.notasExplicativas.filter((num) => num !== activeNote.numero);
        return {
          ...acc,
          notasExplicativas: filtered.length > 0 ? filtered : undefined,
        };
      }
      return acc;
    });
    onUpdateChartOfAccounts(updatedChart);
  };

  // Vincular cuenta a la nota activa
  const handleAddAccountToNote = (accountCode: string) => {
    if (!activeNote) return;
    if (activeNote.cuentasAsociadas.includes(accountCode)) return;

    const newAccounts = [...activeNote.cuentasAsociadas, accountCode].sort();
    const updatedNotes = notes.map((n) =>
      n.id === activeNote.id ? { ...n, cuentasAsociadas: newAccounts } : n
    );
    onUpdateNotes(updatedNotes);

    // Actualizar también en el plan de cuentas
    const updatedChart = chartOfAccounts.map((acc) => {
      if (acc.codigo === accountCode) {
        const existingNotes = acc.notasExplicativas || [];
        const merged = Array.from(new Set([...existingNotes, activeNote.numero])).sort((a, b) => a - b);
        return {
          ...acc,
          notasExplicativas: merged,
        };
      }
      return acc;
    });
    onUpdateChartOfAccounts(updatedChart);
    setIsAddAccountModalOpen(false);
  };

  // Restaurar notas estándar NIIF / CMF
  const handleResetDefaultNotes = () => {
    if (
      window.confirm(
        '¿Desea restaurar el catálogo oficial de Notas a los Estados Financieros según NIIF / CMF Chile? Se mantendrán las cuentas vinculadas que apliquen.'
      )
    ) {
      const restored = DEFAULT_FINANCIAL_NOTES_CATALOG.map((base) => {
        const matchingCodes = chartOfAccounts
          .filter((acc) => acc.notasExplicativas && acc.notasExplicativas.includes(base.numero))
          .map((a) => a.codigo);

        const mergedAccounts = Array.from(new Set([...base.cuentasAsociadas, ...matchingCodes]));
        return {
          ...base,
          id: `note-${base.numero}-${Date.now()}`,
          empresaRut: company.rut,
          cuentasAsociadas: mergedAccounts,
          ultimaModificacion: new Date().toISOString(),
          modificadoPor: 'Restauración Estándar NIIF/CMF',
        } as FinancialStatementNote;
      });
      onUpdateNotes(restored);
      if (restored.length > 0) {
        handleSelectNote(restored[0].numero);
      }
    }
  };

  // Crear nueva nota explicativa personalizada
  const handleCreateNewNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteTitle.trim()) return;

    const exists = notes.some((n) => n.numero === newNoteNumber);
    if (exists) {
      alert(`Ya existe la Nota N° ${newNoteNumber}. Ingrese un número diferente.`);
      return;
    }

    const newNote: FinancialStatementNote = {
      id: `note-${newNoteNumber}-${Date.now()}`,
      numero: newNoteNumber,
      titulo: newNoteTitle.trim(),
      categoria: newNoteCategory,
      normaReferencia: newNoteNorm,
      contenido: `Detalle y políticas específicas correspondientes a ${newNoteTitle.trim()} conforme a las normas de auditoría y contabilidad vigentes.`,
      cuentasAsociadas: [],
      empresaRut: company.rut,
      estado: 'BORRADOR',
      ultimaModificacion: new Date().toISOString(),
      modificadoPor: 'Usuario Contador Auditor',
    };

    const updated = [...notes, newNote].sort((a, b) => a.numero - b.numero);
    onUpdateNotes(updated);
    setIsCreateNoteModalOpen(false);
    setNewNoteTitle('');
    setNewNoteNumber(newNoteNumber + 1);
    handleSelectNote(newNote.numero);
  };

  return (
    <div className="space-y-5">
      {/* Top Banner & Actions */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-blue-100 text-blue-800 text-[11px] font-bold px-2 py-0.5 rounded font-mono">
              NIIF / IFRS & CIRCULAR CMF 1.501
            </span>
            <span className="text-xs text-slate-500 font-medium">
              {company.razonSocial || company.nombreCorto} (RUT: {company.rut})
            </span>
          </div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-600" />
            <span>Notas Explicativas a los Estados Financieros</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Estructuración y redacción técnica de notas según NIC 1 y NIIF con desglose en tiempo real de partidas contables conciliadas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsCreateNoteModalOpen(true)}
            className="bg-[#0f172a] hover:bg-slate-800 text-white text-xs font-bold px-3.5 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4 text-emerald-400" />
            <span>Nueva Nota</span>
          </button>

          <button
            onClick={() => downloadFinancialNotesBookletPdf(notes, balance8Col, chartOfAccounts, company)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3.5 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
            title="Descargar Cuadernillo Completo de Notas en formato PDF formal para la memoria anual"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Descargar Cuadernillo PDF</span>
          </button>

          <button
            onClick={handleResetDefaultNotes}
            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors"
            title="Restaurar al catálogo maestro oficial chileno CMF 1.501"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span>Restaurar Estándar CMF</span>
          </button>
        </div>
      </div>

      {/* Main Split Layout: Sidebar of Notes + Note Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Sidebar: List of Notes (4 cols) */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-slate-500" />
              <span>Índice de Notas ({filteredNotes.length})</span>
            </h4>
            <span className="text-[11px] text-slate-400 font-mono">NIC 1 / CMF</span>
          </div>

          {/* Search & Filter */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Buscar nota por título, n° o cuenta..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>

            <select
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className="w-full text-[11px] bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-500 text-slate-700 font-medium"
            >
              <option value="TODAS">Todas las Categorías (EE.FF.)</option>
              {Object.entries(CATEGORY_LABELS).map(([catKey, label]) => (
                <option key={catKey} value={catKey}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Notes Scrollable List */}
          <div className="space-y-1.5 overflow-y-auto max-h-[620px] pr-1">
            {filteredNotes.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                No se encontraron notas con los criterios de búsqueda.
              </div>
            ) : (
              filteredNotes.map((n) => {
                const isSelected = n.numero === activeNoteNumber;
                const bdown = computeNoteBreakdown(n, balance8Col, chartOfAccounts);
                const hasAccounts = n.cuentasAsociadas && n.cuentasAsociadas.length > 0;

                return (
                  <button
                    key={n.id}
                    onClick={() => handleSelectNote(n.numero)}
                    className={`w-full text-left p-2.5 rounded-lg border transition-all cursor-pointer flex items-start gap-2.5 ${
                      isSelected
                        ? 'bg-blue-50/80 border-blue-500 shadow-xs'
                        : 'bg-white hover:bg-slate-50 border-slate-200'
                    }`}
                  >
                    {/* Note Number Badge */}
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono font-bold text-xs shrink-0 ${
                        isSelected
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      {String(n.numero).padStart(2, '0')}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={`text-xs font-semibold truncate ${
                            isSelected ? 'text-blue-900' : 'text-slate-900'
                          }`}
                        >
                          {n.titulo}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-500">
                        <span className="font-mono text-blue-700 font-medium">
                          {n.normaReferencia.replace('_', ' ')}
                        </span>
                        <span>•</span>
                        <span>{n.cuentasAsociadas.length} ctas</span>
                        {hasAccounts && bdown.totalSaldoFinal !== 0 && (
                          <>
                            <span>•</span>
                            <span className="font-mono font-bold text-slate-800">
                              {fmtClp(bdown.totalSaldoFinal)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Area: Active Note Editor & Breakdown Table (8 cols) */}
        <div className="lg:col-span-8 space-y-5">
          {activeNote ? (
            <>
              {/* Note Header Details */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-600 text-white font-mono font-bold text-base flex items-center justify-center shadow-xs">
                      {activeNote.numero}
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-slate-900">{activeNote.titulo}</h4>
                      <div className="flex flex-wrap items-center gap-2 mt-0.5">
                        <span className="bg-blue-50 text-blue-800 border border-blue-200 text-[10px] font-bold px-2 py-0.5 rounded">
                          {activeNote.normaReferencia.replace('_', ' ')}
                        </span>
                        <span className="text-xs text-slate-400">•</span>
                        <span className="text-[11px] text-slate-600 font-medium">
                          {CATEGORY_LABELS[activeNote.categoria] || activeNote.categoria}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-medium">Estado:</span>
                    <select
                      value={activeNote.estado}
                      onChange={(e) => handleChangeStatus(e.target.value as any)}
                      className={`text-xs font-bold px-2.5 py-1 rounded-lg border focus:outline-none cursor-pointer ${
                        activeNote.estado === 'DICTAMINADA'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : activeNote.estado === 'EN_REVISION'
                          ? 'bg-amber-50 text-amber-800 border-amber-300'
                          : 'bg-slate-100 text-slate-700 border-slate-300'
                      }`}
                    >
                      <option value="BORRADOR">📝 Borrador</option>
                      <option value="EN_REVISION">🔍 En Revisión</option>
                      <option value="DICTAMINADA">✅ Dictaminada / Auditada</option>
                    </select>
                  </div>
                </div>

                {/* Technical Text Disclosure Editor */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-indigo-600" />
                      <span>Redacción Técnica y Revelación de Políticas (NIC 1)</span>
                    </label>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleGenerateWithAi}
                        className="bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                        title="Redactar automáticamente la nota técnica considerando los saldos reales de las cuentas asociadas"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                        <span>Redactar con Agente IA</span>
                      </button>

                      <button
                        onClick={handleSaveDraft}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold px-3 py-1 rounded-lg flex items-center gap-1 cursor-pointer shadow-xs transition-colors"
                      >
                        {saveSuccessMsg ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-300" />
                            <span>¡Guardado!</span>
                          </>
                        ) : (
                          <>
                            <FileCheck2 className="w-3.5 h-3.5" />
                            <span>Guardar Redacción</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <textarea
                    rows={5}
                    value={draftContent}
                    onChange={(e) => setDraftContent(e.target.value)}
                    placeholder="Escriba la redacción formal de la nota técnica, bases contables y revelaciones de acuerdo a normas IFRS/CMF..."
                    className="w-full text-xs text-slate-800 bg-slate-50 border border-slate-300 rounded-lg p-3 leading-relaxed focus:bg-white focus:outline-none focus:border-blue-500 font-sans"
                  />
                  {activeNote.ultimaModificacion && (
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>Última modificación: {new Date(activeNote.ultimaModificacion).toLocaleString('es-CL')}</span>
                      <span>Responsable: {activeNote.modificadoPor || 'Contador Auditor'}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Breakdown Table: Detalle de las Partidas Contables */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Scale className="w-4 h-4 text-emerald-600" />
                      <span>Detalle de Partidas Contables Vinculadas</span>
                    </h4>
                    <p className="text-xs text-slate-500">
                      Cuentas del catálogo asignadas a la Nota {activeNote.numero}. Los saldos se calculan automáticamente desde el Mayor General.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsAddAccountModalOpen(true)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Vincular Cuenta</span>
                    </button>
                  </div>
                </div>

                {/* Totals Summary Banner */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Cargos Acumulados (Debe)</span>
                    <div className="text-sm font-bold font-mono text-emerald-700 mt-0.5">
                      {fmtClp(noteBreakdown.totalDebe)}
                    </div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Abonos Acumulados (Haber)</span>
                    <div className="text-sm font-bold font-mono text-blue-700 mt-0.5">
                      {fmtClp(noteBreakdown.totalHaber)}
                    </div>
                  </div>
                  <div className="bg-blue-50/70 border border-blue-200 rounded-lg p-3">
                    <span className="text-[10px] text-blue-800 font-bold uppercase">Saldo Final Nota Conciliado</span>
                    <div className="text-base font-bold font-mono text-blue-900 mt-0.5">
                      {fmtClp(noteBreakdown.totalSaldoFinal)}
                    </div>
                  </div>
                </div>

                {/* Items Table */}
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase text-[10px]">
                        <th className="py-2.5 px-3 font-mono">Código</th>
                        <th className="py-2.5 px-3">Cuenta Contable</th>
                        <th className="py-2.5 px-2 text-center">Naturaleza</th>
                        <th className="py-2.5 px-3 text-right font-mono">Debe (Cargos)</th>
                        <th className="py-2.5 px-3 text-right font-mono">Haber (Abonos)</th>
                        <th className="py-2.5 px-3 text-right font-mono">Saldo Cierre</th>
                        <th className="py-2.5 px-2 text-center font-mono">% Part.</th>
                        <th className="py-2.5 px-2 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {noteBreakdown.items.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-slate-400 font-sans text-xs">
                            No hay cuentas contables vinculadas a esta nota explicativa.{' '}
                            <button
                              onClick={() => setIsAddAccountModalOpen(true)}
                              className="text-blue-600 underline font-semibold hover:text-blue-800 ml-1 cursor-pointer"
                            >
                              Vincule una cuenta ahora
                            </button>
                            .
                          </td>
                        </tr>
                      ) : (
                        noteBreakdown.items.map((item) => (
                          <tr key={item.codigoCuenta} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2 px-3 font-bold text-slate-900">{item.codigoCuenta}</td>
                            <td className="py-2 px-3 font-sans font-medium text-slate-900">
                              {item.nombreCuenta}
                            </td>
                            <td className="py-2 px-2 text-center">
                              <span
                                className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                                  item.naturaleza === 'DEUDORA'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-blue-50 text-blue-700'
                                }`}
                              >
                                {item.naturaleza}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right text-emerald-700 font-mono">
                              {fmtClp(item.debe)}
                            </td>
                            <td className="py-2 px-3 text-right text-blue-700 font-mono">
                              {fmtClp(item.haber)}
                            </td>
                            <td className="py-2 px-3 text-right font-bold text-slate-900 font-mono">
                              {fmtClp(item.saldoFinal)}
                            </td>
                            <td className="py-2 px-2 text-center text-slate-500 text-[11px] font-mono">
                              {item.porcentajeDelTotal.toFixed(1)}%
                            </td>
                            <td className="py-2 px-2 text-right">
                              <div className="flex items-center justify-end gap-1">
                                {onNavigateToMayor && (
                                  <button
                                    onClick={() => onNavigateToMayor(item.codigoCuenta)}
                                    className="p-1 rounded hover:bg-blue-50 text-blue-600 cursor-pointer"
                                    title={`Ver movimientos en Libro Mayor de ${item.codigoCuenta}`}
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleRemoveAccountFromNote(item.codigoCuenta)}
                                  className="p-1 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600 cursor-pointer"
                                  title={`Desvincular cuenta ${item.codigoCuenta} de Nota ${activeNote.numero}`}
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
            </>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-400">
              Seleccione una nota del índice o cree una nueva nota explicativa.
            </div>
          )}
        </div>
      </div>

      {/* MODAL: Vincular Cuenta Contable a la Nota */}
      {isAddAccountModalOpen && activeNote && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-600" />
                <span>Vincular Cuenta a Nota N° {activeNote.numero}</span>
              </h4>
              <button
                onClick={() => setIsAddAccountModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar cuenta por código o nombre..."
                  value={accountSearchInModal}
                  onChange={(e) => setAccountSearchInModal(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                  autoFocus
                />
              </div>

              <div className="overflow-y-auto max-h-72 divide-y divide-slate-100 border border-slate-200 rounded-lg">
                {chartOfAccounts
                  .filter((acc) => {
                    const isAlreadyLinked = activeNote.cuentasAsociadas.includes(acc.codigo);
                    if (isAlreadyLinked) return false;
                    if (!accountSearchInModal.trim()) return true;
                    const q = accountSearchInModal.toLowerCase();
                    return acc.codigo.toLowerCase().includes(q) || acc.nombre.toLowerCase().includes(q);
                  })
                  .slice(0, 50)
                  .map((acc) => (
                    <div
                      key={acc.codigo}
                      className="p-2.5 hover:bg-blue-50/60 flex items-center justify-between gap-2 transition-colors"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs text-slate-900">{acc.codigo}</span>
                          <span
                            className={`text-[9px] px-1 py-0.2 rounded font-bold ${
                              acc.naturaleza === 'DEUDORA'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-blue-50 text-blue-700'
                            }`}
                          >
                            {acc.naturaleza}
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 font-medium">{acc.nombre}</p>
                      </div>

                      <button
                        onClick={() => handleAddAccountToNote(acc.codigo)}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer shadow-xs"
                      >
                        Vincular
                      </button>
                    </div>
                  ))}
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 text-right">
              <button
                onClick={() => setIsAddAccountModalOpen(false)}
                className="text-xs font-semibold text-slate-600 hover:text-slate-800 px-3 py-1.5 rounded-lg border border-slate-300 cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Crear Nueva Nota Explicativa */}
      {isCreateNoteModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateNewNote}
            className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-600" />
                <span>Crear Nueva Nota a los Estados Financieros</span>
              </h4>
              <button
                type="button"
                onClick={() => setIsCreateNoteModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Número de la Nota</label>
                <input
                  type="number"
                  min={1}
                  value={newNoteNumber}
                  onChange={(e) => setNewNoteNumber(Number(e.target.value))}
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono font-bold text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Título de la Nota</label>
                <input
                  type="text"
                  placeholder="Ej: Nota 19 - Operaciones con Partes Relacionadas"
                  value={newNoteTitle}
                  onChange={(e) => setNewNoteTitle(e.target.value)}
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-medium focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Categoría del Estado Financiero</label>
                <select
                  value={newNoteCategory}
                  onChange={(e) => setNewNoteCategory(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-medium focus:outline-none focus:border-blue-500"
                >
                  {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Norma de Referencia</label>
                <select
                  value={newNoteNorm}
                  onChange={(e) => setNewNoteNorm(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-medium focus:outline-none focus:border-blue-500"
                >
                  {NORMA_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCreateNoteModalOpen(false)}
                className="text-xs font-semibold text-slate-600 hover:text-slate-800 px-3 py-1.5 rounded-lg border border-slate-300 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-1.5 rounded-lg cursor-pointer shadow-xs"
              >
                Crear Nota
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
