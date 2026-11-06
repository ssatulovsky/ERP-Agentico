import React, { useState } from 'react';
import { X, Briefcase, Plus, CheckCircle2 } from 'lucide-react';
import type { ExpenseProject } from '../../types';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (project: ExpenseProject) => void;
  empresaId: string;
}

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  isOpen,
  onClose,
  onSave,
  empresaId,
}) => {
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [clienteNombre, setClienteNombre] = useState('');
  const [presupuestoTotalClp, setPresupuestoTotalClp] = useState<number | ''>('');
  const [descripcion, setDescripcion] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

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
      const newProject: ExpenseProject = {
        id: `pry-${Date.now().toString(36)}`,
        empresaId,
        codigo: cleanCodigo,
        nombre: cleanNombre,
        clienteNombre: clienteNombre.trim() || undefined,
        presupuestoTotalClp: Number(presupuestoTotalClp) || 0,
        activo: true,
        descripcion: descripcion.trim() || undefined,
      };

      // Intentar persistir en el servidor vía API
      try {
        await fetch('/api/expenses/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newProject),
        });
      } catch (apiErr) {
        console.warn('[CreateProjectModal] Advertencia al persistir en servidor:', apiErr);
      }

      onSave(newProject);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al guardar el proyecto.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-600/30 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Briefcase className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Nuevo Centro de Proyecto / Obra</h3>
              <p className="text-[11px] text-slate-400 font-mono">Control de Costos, WIP y Obras en Curso (Art. 31 / IFRS)</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white rounded-lg p-1 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 font-medium">
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Código de Proyecto / Obra *
              </label>
              <input
                type="text"
                placeholder="Ej: PRY-AUSTRAL-26"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono font-bold focus:ring-1 focus:ring-cyan-500 focus:outline-hidden"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Cliente / Mandante Asociado
              </label>
              <input
                type="text"
                placeholder="Ej: Salmones Austral S.A."
                value={clienteNombre}
                onChange={(e) => setClienteNombre(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 focus:ring-1 focus:ring-cyan-500 focus:outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Nombre / Descripción del Proyecto *
            </label>
            <input
              type="text"
              placeholder="Ej: Proyecto de confección para cliente"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 focus:ring-1 focus:ring-cyan-500 focus:outline-hidden"
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Presupuesto Total Estimado (CLP)
            </label>
            <input
              type="number"
              min="0"
              placeholder="Ej: 45000000"
              value={presupuestoTotalClp}
              onChange={(e) => setPresupuestoTotalClp(e.target.value ? Number(e.target.value) : '')}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono text-right focus:ring-1 focus:ring-cyan-500 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Alcance / Observaciones Operativas
            </label>
            <textarea
              rows={2}
              placeholder="Notas técnicas, contratos o plazos de ejecución..."
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 focus:ring-1 focus:ring-cyan-500 focus:outline-hidden resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 rounded-lg cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Guardando...' : 'Crear y Asignar Proyecto'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
