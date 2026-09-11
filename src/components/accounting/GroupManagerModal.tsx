import React, { useState } from 'react';
import { FolderTree, Plus, Edit2, Trash2, Check, X, Layers, AlertCircle } from 'lucide-react';
import { AccountGroupDefinition, HierarchicalAccountItem } from '../../types';

interface GroupManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  groups: AccountGroupDefinition[];
  onSaveGroups: (groups: AccountGroupDefinition[]) => void;
  accounts: HierarchicalAccountItem[];
}

export const GroupManagerModal: React.FC<GroupManagerModalProps> = ({
  isOpen,
  onClose,
  groups,
  onSaveGroups,
  accounts,
}) => {
  const [selectedClase, setSelectedClase] = useState<1 | 2 | 3 | 4 | 5 | 6 | 7>(1);
  const [localGroups, setLocalGroups] = useState<AccountGroupDefinition[]>(groups);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editDescripcion, setEditDescripcion] = useState('');

  // Form para nuevo grupo o subgrupo
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newTipoNivel, setNewTipoNivel] = useState<2 | 3>(2); // 2 = Grupo, 3 = Subgrupo
  const [newCodigo, setNewCodigo] = useState('');
  const [newNombre, setNewNombre] = useState('');
  const [newPadreCodigo, setNewPadreCodigo] = useState('');
  const [newDescripcion, setNewDescripcion] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  if (!isOpen) return null;

  const claseNames: Record<number, string> = {
    1: '1. ACTIVO',
    2: '2. PASIVO',
    3: '3. PATRIMONIO NETO',
    4: '4. INGRESOS',
    5: '5. COSTOS',
    6: '6. GASTOS DE ADMINISTRACIÓN Y VENTAS',
    7: '7. OTROS INGRESOS / GASTOS',
  };

  // Grupos de la clase activa
  const classLevel2Groups = localGroups.filter((g) => g.nivel === 2 && g.clase === selectedClase);

  // Iniciar edición de grupo
  const handleStartEdit = (grp: AccountGroupDefinition) => {
    setEditingGroupId(grp.id);
    setEditNombre(grp.nombre);
    setEditDescripcion(grp.descripcion || '');
    setIsCreatingNew(false);
    setFormError(null);
  };

  // Guardar edición
  const handleSaveEdit = (id: string) => {
    if (!editNombre.trim()) return;
    const updated = localGroups.map((g) =>
      g.id === id ? { ...g, nombre: editNombre.trim(), descripcion: editDescripcion.trim() } : g
    );
    setLocalGroups(updated);
    onSaveGroups(updated);
    setEditingGroupId(null);
  };

  // Cancelar edición
  const handleCancelEdit = () => {
    setEditingGroupId(null);
    setEditNombre('');
    setEditDescripcion('');
  };

  // Eliminar grupo o subgrupo
  const handleDeleteGroup = (grp: AccountGroupDefinition) => {
    // Comprobar si hay cuentas que usan este grupo o subgrupo
    const hasAccounts = accounts.some(
      (a) => a.grupo === grp.codigo || a.subgrupo === grp.codigo
    );
    if (hasAccounts) {
      alert(`No se puede eliminar ${grp.codigo} porque existen cuentas asociadas a este grupo o subgrupo.`);
      return;
    }

    if (grp.nivel === 2) {
      // Comprobar si tiene subgrupos hijos
      const hasChildren = localGroups.some((g) => g.padreCodigo === grp.codigo);
      if (hasChildren) {
        alert(`No se puede eliminar el Grupo ${grp.codigo} porque contiene subgrupos. Elimine primero los subgrupos.`);
        return;
      }
    }

    if (confirm(`¿Confirma que desea eliminar "${grp.codigo} - ${grp.nombre}"?`)) {
      const updated = localGroups.filter((g) => g.id !== grp.id);
      setLocalGroups(updated);
      onSaveGroups(updated);
    }
  };

  // Iniciar creación
  const handleStartCreate = (nivel: 2 | 3, defaultPadre?: string) => {
    setIsCreatingNew(true);
    setEditingGroupId(null);
    setNewTipoNivel(nivel);
    setFormError(null);
    setNewNombre('');
    setNewDescripcion('');

    if (nivel === 2) {
      const existingGrpCodes = classLevel2Groups.map((g) => g.codigo);
      const nextNum = existingGrpCodes.length + 1;
      setNewCodigo(`${selectedClase}.${nextNum}`);
      setNewPadreCodigo('');
    } else {
      const pCode = defaultPadre || (classLevel2Groups[0]?.codigo || `${selectedClase}.1`);
      setNewPadreCodigo(pCode);
      const siblings = localGroups.filter((g) => g.nivel === 3 && g.padreCodigo === pCode);
      const nextSub = String(siblings.length + 1).padStart(2, '0');
      setNewCodigo(`${pCode}.${nextSub}`);
    }
  };

  const handleSaveNew = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanCodigo = newCodigo.trim();
    const cleanNombre = newNombre.trim();

    if (!cleanCodigo || !cleanNombre) {
      setFormError('Código y nombre son obligatorios.');
      return;
    }

    // Validar duplicado
    if (localGroups.some((g) => g.codigo.toLowerCase() === cleanCodigo.toLowerCase())) {
      setFormError(`El código ${cleanCodigo} ya existe.`);
      return;
    }

    const newDef: AccountGroupDefinition = {
      id: `grp-${cleanCodigo}-${Date.now()}`,
      codigo: cleanCodigo,
      nombre: cleanNombre,
      clase: selectedClase,
      nivel: newTipoNivel,
      padreCodigo: newTipoNivel === 3 ? newPadreCodigo : undefined,
      descripcion: newDescripcion.trim() || undefined,
    };

    const updated = [...localGroups, newDef];
    setLocalGroups(updated);
    onSaveGroups(updated);
    setIsCreatingNew(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl my-8 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FolderTree className="w-5 h-5 text-amber-600" />
              Gestión Jerárquica de Grupos y Subgrupos (Plan de Cuentas)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Administre la estructura de agrupación para la empresa: cree nuevos grupos (Nivel 2), subgrupos (Nivel 3) o modifique sus descripciones.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Clase Navigation Tabs */}
        <div className="flex flex-wrap gap-1 px-6 py-2.5 bg-slate-100/70 border-b border-slate-200 text-xs">
          {([1, 2, 3, 4, 5, 6, 7] as const).map((cls) => (
            <button
              key={cls}
              onClick={() => {
                setSelectedClase(cls);
                setIsCreatingNew(false);
                setEditingGroupId(null);
              }}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                selectedClase === cls
                  ? 'bg-[#0f172a] text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-200/80 border border-slate-200'
              }`}
            >
              {claseNames[cls]}
            </button>
          ))}
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h4 className="text-sm font-bold text-slate-900">
                Estructura de {claseNames[selectedClase]}
              </h4>
              <p className="text-xs text-slate-500">
                {classLevel2Groups.length} Grupos principales configurados para esta clase.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleStartCreate(2)}
                className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-amber-400" />
                <span>Nuevo Grupo (Nivel 2)</span>
              </button>
              <button
                onClick={() => handleStartCreate(3)}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nuevo Subgrupo (Nivel 3)</span>
              </button>
            </div>
          </div>

          {/* Form de Creación */}
          {isCreatingNew && (
            <form onSubmit={handleSaveNew} className="p-4 rounded-xl bg-amber-50/60 border border-amber-200 space-y-3 text-xs">
              <div className="flex items-center justify-between font-bold text-amber-900">
                <span>Crear {newTipoNivel === 2 ? 'Nuevo Grupo Principal (Nivel 2)' : 'Nuevo Subgrupo Analítico (Nivel 3)'}</span>
                <button type="button" onClick={() => setIsCreatingNew(false)} className="text-slate-400 hover:text-slate-600">✕</button>
              </div>

              {formError && (
                <div className="p-2 rounded bg-rose-100 text-rose-800 text-[11px] font-medium flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {newTipoNivel === 3 && (
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Grupo Padre (Nivel 2)</label>
                    <select
                      value={newPadreCodigo}
                      onChange={(e) => {
                        setNewPadreCodigo(e.target.value);
                        const sibs = localGroups.filter((g) => g.nivel === 3 && g.padreCodigo === e.target.value);
                        setNewCodigo(`${e.target.value}.${String(sibs.length + 1).padStart(2, '0')}`);
                      }}
                      className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs font-medium"
                    >
                      {classLevel2Groups.map((g) => (
                        <option key={g.codigo} value={g.codigo}>
                          {g.codigo} - {g.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Código Jerárquico</label>
                  <input
                    type="text"
                    value={newCodigo}
                    onChange={(e) => setNewCodigo(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded p-1.5 font-mono font-bold text-xs"
                    required
                  />
                </div>

                <div className={newTipoNivel === 2 ? 'sm:col-span-2' : ''}>
                  <label className="font-semibold text-slate-700 block mb-1">Nombre Oficial del {newTipoNivel === 2 ? 'Grupo' : 'Subgrupo'}</label>
                  <input
                    type="text"
                    value={newNombre}
                    onChange={(e) => setNewNombre(e.target.value)}
                    placeholder="Ej: Inversiones Financieras Corto Plazo"
                    className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Descripción / Criterio Contable (Opcional)</label>
                <input
                  type="text"
                  value={newDescripcion}
                  onChange={(e) => setNewDescripcion(e.target.value)}
                  placeholder="Detalle o nota explicativa para el balance..."
                  className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-amber-200/60">
                <button
                  type="button"
                  onClick={() => setIsCreatingNew(false)}
                  className="px-3 py-1.5 bg-slate-200/80 text-slate-700 rounded text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#0f172a] hover:bg-slate-800 text-white rounded text-xs font-bold"
                >
                  Guardar en el Plan
                </button>
              </div>
            </form>
          )}

          {/* Árbol de Grupos y Subgrupos */}
          <div className="space-y-4">
            {classLevel2Groups.map((grp) => {
              const subgrupos = localGroups.filter((g) => g.nivel === 3 && g.padreCodigo === grp.codigo);
              const isEditingThisGrp = editingGroupId === grp.id;
              const accountsInGroup = accounts.filter((a) => a.grupo === grp.codigo);

              return (
                <div key={grp.id} className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                  {/* Fila Encabezado del Grupo Nivel 2 */}
                  <div className="bg-slate-50/90 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200">
                    <div className="flex-1">
                      {isEditingThisGrp ? (
                        <div className="space-y-2 py-1">
                          <input
                            type="text"
                            value={editNombre}
                            onChange={(e) => setEditNombre(e.target.value)}
                            className="w-full bg-white border border-blue-400 rounded px-2.5 py-1 text-xs font-bold text-slate-900"
                          />
                          <input
                            type="text"
                            value={editDescripcion}
                            onChange={(e) => setEditDescripcion(e.target.value)}
                            placeholder="Descripción..."
                            className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-xs text-slate-600"
                          />
                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={() => handleSaveEdit(grp.id)}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Guardar</span>
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="px-3 py-1 bg-slate-200 text-slate-700 rounded text-[11px] font-semibold cursor-pointer"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-900 text-xs px-2 py-0.5 rounded bg-slate-200/80">
                              {grp.codigo}
                            </span>
                            <span className="font-bold text-slate-900 text-xs">
                              {grp.nombre}
                            </span>
                            <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-semibold">
                              {accountsInGroup.length} cuentas
                            </span>
                          </div>
                          {grp.descripcion && (
                            <p className="text-[11px] text-slate-500 mt-1 pl-1">
                              {grp.descripcion}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {!isEditingThisGrp && (
                      <div className="flex items-center gap-1.5 self-end sm:self-auto">
                        <button
                          onClick={() => handleStartCreate(3, grp.codigo)}
                          title="Añadir Subgrupo a este grupo"
                          className="px-2.5 py-1 rounded bg-white hover:bg-blue-50 border border-slate-200 text-blue-700 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>+ Subgrupo</span>
                        </button>
                        <button
                          onClick={() => handleStartEdit(grp)}
                          title="Editar nombre del Grupo"
                          className="p-1.5 rounded hover:bg-slate-200/80 text-slate-600 hover:text-slate-900 cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteGroup(grp)}
                          title="Eliminar Grupo"
                          className="p-1.5 rounded hover:bg-rose-100 text-slate-400 hover:text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Subgrupos de Nivel 3 */}
                  <div className="p-3 bg-white space-y-2">
                    {subgrupos.length === 0 ? (
                      <div className="text-center py-3 text-slate-400 text-xs italic">
                        No hay subgrupos definidos en este grupo. Haga clic en "+ Subgrupo".
                      </div>
                    ) : (
                      subgrupos.map((sub) => {
                        const isEditingThisSub = editingGroupId === sub.id;
                        const accountsInSub = accounts.filter((a) => a.subgrupo === sub.codigo);

                        return (
                          <div
                            key={sub.id}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg hover:bg-slate-50 border border-slate-100"
                          >
                            <div className="flex-1">
                              {isEditingThisSub ? (
                                <div className="space-y-1.5 py-1">
                                  <input
                                    type="text"
                                    value={editNombre}
                                    onChange={(e) => setEditNombre(e.target.value)}
                                    className="w-full bg-white border border-blue-400 rounded px-2.5 py-1 text-xs font-semibold"
                                  />
                                  <div className="flex gap-2 pt-1">
                                    <button
                                      onClick={() => handleSaveEdit(sub.id)}
                                      className="px-2.5 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                                    >
                                      <Check className="w-3 h-3" />
                                      <span>Guardar</span>
                                    </button>
                                    <button
                                      onClick={handleCancelEdit}
                                      className="px-2.5 py-0.5 bg-slate-200 text-slate-700 rounded text-[10px] font-semibold cursor-pointer"
                                    >
                                      Cancelar
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 pl-3">
                                  <span className="text-slate-400 font-mono text-xs">└─</span>
                                  <span className="font-mono font-bold text-slate-700 text-xs">
                                    {sub.codigo}
                                  </span>
                                  <span className="text-xs text-slate-800 font-medium">
                                    {sub.nombre}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    ({accountsInSub.length} cuentas hijas)
                                  </span>
                                </div>
                              )}
                            </div>

                            {!isEditingThisSub && (
                              <div className="flex items-center gap-1 self-end sm:self-auto">
                                <button
                                  onClick={() => handleStartEdit(sub)}
                                  title="Editar nombre del Subgrupo"
                                  className="p-1 rounded hover:bg-slate-200/80 text-slate-500 hover:text-slate-900 cursor-pointer"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => handleDeleteGroup(sub)}
                                  title="Eliminar Subgrupo"
                                  className="p-1 rounded hover:bg-rose-100 text-slate-400 hover:text-rose-600 cursor-pointer"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#0f172a] hover:bg-slate-800 text-white rounded-lg text-xs font-bold cursor-pointer"
          >
            Listo / Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
