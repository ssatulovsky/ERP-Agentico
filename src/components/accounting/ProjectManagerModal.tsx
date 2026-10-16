import React, { useState, useMemo } from 'react';
import {
  X,
  Briefcase,
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  Building,
  Coins,
  DollarSign,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import type { ExpenseProject } from '../../types';
import { expenseApiService } from '../../services/expenseApiService';
import { formatCLP } from '../../utils/chileanAccounting';

interface ProjectManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: ExpenseProject[];
  onProjectsChange: (updated: ExpenseProject[]) => void;
  empresaId: string;
}

export const ProjectManagerModal: React.FC<ProjectManagerModalProps> = ({
  isOpen,
  onClose,
  projects,
  onProjectsChange,
  empresaId,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'TODOS' | 'ACTIVOS' | 'INACTIVOS'>('TODOS');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);

  // Form state
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [clienteNombre, setClienteNombre] = useState('');
  const [presupuestoTotalClp, setPresupuestoTotalClp] = useState<number | ''>('');
  const [descripcion, setDescripcion] = useState('');
  const [activo, setActivo] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filtrado de proyectos
  const filteredProjects = useMemo(() => {
    return (projects || []).filter((p) => {
      if (statusFilter === 'ACTIVOS' && p.activo === false) return false;
      if (statusFilter === 'INACTIVOS' && p.activo !== false) return false;

      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        p.codigo.toLowerCase().includes(term) ||
        p.nombre.toLowerCase().includes(term) ||
        (p.clienteNombre || '').toLowerCase().includes(term) ||
        (p.descripcion || '').toLowerCase().includes(term)
      );
    });
  }, [projects, statusFilter, searchTerm]);

  // Estadísticas consolidadas
  const totalPresupuesto = useMemo(() => {
    return (projects || []).reduce((s, p) => s + (Number(p.presupuestoTotalClp) || 0), 0);
  }, [projects]);

  const activeCount = useMemo(() => {
    return (projects || []).filter((p) => p.activo !== false).length;
  }, [projects]);

  if (!isOpen) return null;

  const resetForm = () => {
    setCodigo('');
    setNombre('');
    setClienteNombre('');
    setPresupuestoTotalClp('');
    setDescripcion('');
    setActivo(true);
    setEditingProjectId(null);
    setIsFormOpen(false);
    setErrorMsg(null);
  };

  const handleStartCreate = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const handleStartEdit = (p: ExpenseProject) => {
    setEditingProjectId(p.id || p.codigo);
    setCodigo(p.codigo);
    setNombre(p.nombre);
    setClienteNombre(p.clienteNombre || '');
    setPresupuestoTotalClp(p.presupuestoTotalClp || '');
    setDescripcion(p.descripcion || '');
    setActivo(p.activo !== false);
    setIsFormOpen(true);
    setErrorMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanCodigo = codigo.trim().toUpperCase();
    const cleanNombre = nombre.trim();

    if (!cleanCodigo) {
      setErrorMsg('Debe indicar un código de Proyecto u Obra (ej: PRY-QUELLON-26).');
      return;
    }
    if (!cleanNombre) {
      setErrorMsg('Debe indicar el nombre o descripción del Proyecto.');
      return;
    }

    setIsSaving(true);
    try {
      if (editingProjectId) {
        // Modificación
        const updates: Partial<ExpenseProject> = {
          nombre: cleanNombre,
          clienteNombre: clienteNombre.trim() || undefined,
          presupuestoTotalClp: Number(presupuestoTotalClp) || 0,
          activo,
          descripcion: descripcion.trim() || undefined,
        };

        await expenseApiService.updateExpenseProject(editingProjectId, updates);

        const updatedList = projects.map((p) =>
          (p.id === editingProjectId || p.codigo === editingProjectId)
            ? { ...p, ...updates }
            : p
        );
        onProjectsChange(updatedList);
        setSuccessMsg(`Proyecto "${cleanCodigo}" actualizado con éxito.`);
      } else {
        // Alta
        const duplicate = projects.some(
          (p) => p.codigo.trim().toUpperCase() === cleanCodigo
        );
        if (duplicate) {
          setErrorMsg(`Ya existe un proyecto con el código "${cleanCodigo}".`);
          setIsSaving(false);
          return;
        }

        const newPry: ExpenseProject = {
          id: `pry-${Date.now().toString(36)}`,
          empresaId,
          codigo: cleanCodigo,
          nombre: cleanNombre,
          clienteNombre: clienteNombre.trim() || undefined,
          presupuestoTotalClp: Number(presupuestoTotalClp) || 0,
          activo,
          descripcion: descripcion.trim() || undefined,
        };

        const created = await expenseApiService.createExpenseProject(newPry);
        const finalPry = created || newPry;

        onProjectsChange([finalPry, ...projects]);
        setSuccessMsg(`Proyecto "${cleanCodigo} - ${cleanNombre}" creado con éxito.`);
      }

      resetForm();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al procesar el proyecto.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (p: ExpenseProject) => {
    if (!confirm(`¿Confirma que desea eliminar el proyecto "${p.codigo} - ${p.nombre}"?`)) {
      return;
    }
    try {
      await expenseApiService.deleteExpenseProject(p.id || p.codigo);
      const updatedList = projects.filter((item) => (item.id || item.codigo) !== (p.id || p.codigo));
      onProjectsChange(updatedList);
      setSuccessMsg(`Proyecto "${p.codigo}" eliminado del catálogo.`);
    } catch (err: any) {
      setErrorMsg(`Error al eliminar proyecto: ${err.message}`);
    }
  };

  const handleToggleActive = async (p: ExpenseProject) => {
    const nextStatus = !p.activo;
    try {
      await expenseApiService.updateExpenseProject(p.id || p.codigo, { activo: nextStatus });
      const updatedList = projects.map((item) =>
        (item.id || item.codigo) === (p.id || p.codigo) ? { ...item, activo: nextStatus } : item
      );
      onProjectsChange(updatedList);
    } catch (err: any) {
      setErrorMsg(`Error al cambiar estado: ${err.message}`);
    }
  };


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Encabezado */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-600/30 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base">ABM: Catálogo de Proyectos / Obras</h3>
                <span className="text-[10px] font-mono uppercase bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded border border-cyan-500/30 font-bold">
                  IFRS / WIP Art. 31 LIR
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Administración de Centros de Proyectos, Faenas y Obras en Curso para imputaciones del Libro Diario y Rendiciones.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white rounded-lg p-1.5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de Estadísticas */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-2.5 flex flex-wrap items-center justify-between gap-4 text-xs shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">Total Proyectos:</span>
              <span className="font-bold text-slate-800">{projects.length}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">Activos:</span>
              <span className="font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full text-[11px]">
                {activeCount}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">Presupuesto Consolidado:</span>
              <span className="font-bold text-cyan-800 font-mono bg-cyan-100 px-2 py-0.5 rounded-md text-[11px]">
                ${formatCLP(totalPresupuesto)} CLP
              </span>
            </div>
          </div>

          {!isFormOpen && (
            <button
              type="button"
              onClick={handleStartCreate}
              className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Proyecto / Obra</span>
            </button>
          )}
        </div>

        {/* Notificaciones */}
        {errorMsg && (
          <div className="mx-6 mt-3 p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-800 text-xs flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span className="font-medium">{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="mx-6 mt-3 p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-800 text-xs flex items-center gap-2 shrink-0">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span className="font-medium">{successMsg}</span>
          </div>
        )}

        {/* Formulario de Alta / Modificación */}
        {isFormOpen && (
          <form
            onSubmit={handleSubmit}
            className="mx-6 mt-3 p-4 bg-cyan-50/70 border border-cyan-200 rounded-xl space-y-3 shrink-0 animate-in fade-in"
          >
            <div className="flex items-center justify-between border-b border-cyan-200/80 pb-2">
              <h4 className="font-bold text-xs text-cyan-950 flex items-center gap-1.5">
                <Briefcase className="w-4 h-4 text-cyan-700" />
                {editingProjectId ? 'Modificar Proyecto / Obra' : 'Alta de Nuevo Proyecto / Obra'}
              </h4>
              <button
                type="button"
                onClick={resetForm}
                className="text-xs text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
              >
                Cancelar
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Código de Proyecto *
                </label>
                <input
                  type="text"
                  placeholder="Ej: PRY-QUELLON-26"
                  value={codigo}
                  disabled={Boolean(editingProjectId)}
                  onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                  className={`w-full bg-white border border-slate-300 rounded-lg p-2 font-mono font-bold text-xs focus:ring-1 focus:ring-cyan-500 ${
                    editingProjectId ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'text-slate-900'
                  }`}
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Nombre de la Obra o Faena *
                </label>
                <input
                  type="text"
                  placeholder="Ej: Mantención Mayor Redes y Balsas"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-900 focus:ring-1 focus:ring-cyan-500"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Cliente Mandante (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej: Salmones Antártica S.A."
                  value={clienteNombre}
                  onChange={(e) => setClienteNombre(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-900 focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Presupuesto Total CLP ($)
                </label>
                <input
                  type="number"
                  min={0}
                  step="1000"
                  placeholder="Ej: 45000000"
                  value={presupuestoTotalClp}
                  onChange={(e) => setPresupuestoTotalClp(e.target.value ? Number(e.target.value) : '')}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-mono font-semibold text-slate-900 focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="font-bold text-slate-700 block mb-1">
                  Descripción / Objeto de la Obra
                </label>
                <input
                  type="text"
                  placeholder="Detalles sobre el contrato, faena o servicio integral..."
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-900 focus:ring-1 focus:ring-cyan-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none text-xs">
                <input
                  type="checkbox"
                  checked={activo}
                  onChange={(e) => setActivo(e.target.checked)}
                  className="rounded text-cyan-600 focus:ring-cyan-500 w-4 h-4"
                />
                <span className="font-semibold text-slate-700">Proyecto Activo (Disponible para imputaciones)</span>
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-700 font-semibold hover:bg-slate-50 transition-colors cursor-pointer text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-lg transition-colors cursor-pointer text-xs flex items-center gap-1.5 shadow-xs"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{isSaving ? 'Guardando...' : editingProjectId ? 'Guardar Cambios' : 'Crear Proyecto'}</span>
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Barra de Filtros y Búsqueda */}
        <div className="px-6 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 shrink-0">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar por código, nombre o cliente mandante..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-1 focus:ring-cyan-500 focus:outline-hidden"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-semibold">
            <button
              type="button"
              onClick={() => setStatusFilter('TODOS')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                statusFilter === 'TODOS' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todos ({projects.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('ACTIVOS')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                statusFilter === 'ACTIVOS' ? 'bg-white text-emerald-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Activos ({activeCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('INACTIVOS')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                statusFilter === 'INACTIVOS' ? 'bg-white text-slate-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Inactivos ({projects.length - activeCount})
            </button>
          </div>
        </div>

        {/* Tabla del Catálogo de Proyectos */}
        <div className="flex-1 overflow-y-auto px-6 py-3">
          {filteredProjects.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Briefcase className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="text-xs font-semibold">No se encontraron proyectos u obras que coincidan.</p>
              <button
                type="button"
                onClick={handleStartCreate}
                className="mt-3 text-cyan-600 hover:text-cyan-800 text-xs font-bold underline cursor-pointer"
              >
                + Crear el primer proyecto
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-600 font-bold border-b border-slate-200 text-[11px]">
                    <th className="py-2.5 px-3">Código</th>
                    <th className="py-2.5 px-3">Nombre del Proyecto / Obra</th>
                    <th className="py-2.5 px-3">Cliente Mandante</th>
                    <th className="py-2.5 px-3 text-right">Presupuesto CLP</th>
                    <th className="py-2.5 px-3 text-center">Estado</th>
                    <th className="py-2.5 px-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {filteredProjects.map((p) => {
                    const isActivo = p.activo !== false;
                    return (
                      <tr key={p.id || p.codigo} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3">
                          <span className="font-mono font-bold text-cyan-900 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200 text-[11px]">
                            {p.codigo}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-slate-900">{p.nombre}</div>
                          {p.descripcion && (
                            <div className="text-[11px] text-slate-500 line-clamp-1">{p.descripcion}</div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">
                          {p.clienteNombre ? (
                            <span className="flex items-center gap-1">
                              <Building className="w-3 h-3 text-slate-400" />
                              <span>{p.clienteNombre}</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                          {p.presupuestoTotalClp ? `$${formatCLP(p.presupuestoTotalClp)}` : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleActive(p)}
                            className="cursor-pointer"
                            title={isActivo ? 'Click para pausar/desactivar' : 'Click para activar'}
                          >
                            {isActivo ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Activo
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                Inactivo
                              </span>
                            )}
                          </button>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleStartEdit(p)}
                              className="p-1 text-slate-500 hover:text-cyan-700 hover:bg-cyan-50 rounded transition-colors cursor-pointer"
                              title="Modificar proyecto"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(p)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                              title="Eliminar proyecto"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 flex items-center justify-between text-xs shrink-0">
          <span className="text-[11px] text-slate-500">
            Los cambios se sincronizan en caliente en MySQL y disco para todos los usuarios.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg transition-colors cursor-pointer text-xs"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
