import React, { useState } from 'react';
import { X, Plus, Calendar, DollarSign, Building2, Briefcase, User, Mail, CreditCard, ShieldCheck } from 'lucide-react';
import { ExpenseReport, ExpenseProject, CostCenterMaster } from '../../types';

interface CreateExpenseReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (report: Omit<ExpenseReport, 'id' | 'createdAt' | 'updatedAt' | 'comprobantes'>) => void;
  costCenters: CostCenterMaster[];
  projects: ExpenseProject[];
  nextFolioNumber: number;
}

export const CreateExpenseReportModal: React.FC<CreateExpenseReportModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  costCenters,
  projects,
  nextFolioNumber,
}) => {
  const [titulo, setTitulo] = useState('');
  const [rendidorNombre, setRendidorNombre] = useState('Gonzalo Silva Valenzuela');
  const [rendidorRut, setRendidorRut] = useState('14.238.192-8');
  const [rendidorEmail, setRendidorEmail] = useState('gonzalo.silva@maraustral.cl');
  const [rendidorCargo, setRendidorCargo] = useState('Supervisor Comercial & Operaciones');
  
  const [centroCostoId, setCentroCostoId] = useState(costCenters[0]?.id || 'cc-02');
  const [proyectoId, setProyectoId] = useState(projects[0]?.id || 'pry-01');
  const [fondoAsignadoClp, setFondoAsignadoClp] = useState<number>(150000);
  
  const todayStr = new Date().toISOString().substring(0, 10);
  const [fechaInicio, setFechaInicio] = useState(todayStr);
  const [fechaCierre, setFechaCierre] = useState(todayStr);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim() || !rendidorNombre.trim() || !rendidorRut.trim()) return;

    const selectedCc = costCenters.find((c) => c.id === centroCostoId);
    const selectedPry = projects.find((p) => p.id === proyectoId);

    const folioStr = `RDG-2026-${String(nextFolioNumber).padStart(3, '0')}`;

    onCreate({
      empresaId: 'client-retail-01',
      folio: folioStr,
      titulo: titulo.trim(),
      rendidorNombre: rendidorNombre.trim(),
      rendidorRut: rendidorRut.trim(),
      rendidorEmail: rendidorEmail.trim(),
      rendidorCargo: rendidorCargo.trim(),
      centroCostoId,
      centroCostoCodigo: selectedCc?.codigo || '',
      centroCostoNombre: selectedCc?.nombre || '',
      proyectoId,
      proyectoCodigo: selectedPry?.codigo || '',
      proyectoNombre: selectedPry?.nombre || '',
      fondoAsignadoClp: Number(fondoAsignadoClp) || 0,
      montoTotalRendidoClp: 0,
      saldoReembolsarClp: 0,
      saldoReintegrarClp: Number(fondoAsignadoClp) || 0,
      moneda: 'CLP',
      estado: 'BORRADOR',
      fechaInicio,
      fechaCierre,
      agenteAuditorScore: 100,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl border border-white/20">
              <CreditCard className="w-5 h-5 text-blue-200" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Nueva Rendición de Gastos
                <span className="text-xs bg-blue-500/40 text-blue-100 font-mono px-2 py-0.5 rounded-full border border-blue-300/30">
                  RDG-2026-{String(nextFolioNumber).padStart(3, '0')}
                </span>
              </h3>
              <p className="text-xs text-blue-200">
                Apertura de informe de gastos con imputación a Centro de Costo y Proyecto
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-blue-200 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Título / Motivo del Gasto o Viaje <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ej: Visita Supervisión Planta Quellón y Mantenimiento Balsas"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>

          {/* Datos del Colaborador */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-blue-600" />
              Datos del Rendidor (Trabajador)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Nombre Completo</label>
                <input
                  type="text"
                  required
                  value={rendidorNombre}
                  onChange={(e) => setRendidorNombre(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">RUT Chileno</label>
                <input
                  type="text"
                  required
                  value={rendidorRut}
                  onChange={(e) => setRendidorRut(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Cargo</label>
                <input
                  type="text"
                  value={rendidorCargo}
                  onChange={(e) => setRendidorCargo(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Email Corporativo</label>
                <input
                  type="email"
                  value={rendidorEmail}
                  onChange={(e) => setRendidorEmail(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Imputación Analítica */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                Centro de Costo Principal <span className="text-rose-500">*</span>
              </label>
              <select
                value={centroCostoId}
                onChange={(e) => setCentroCostoId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              >
                {costCenters.map((cc) => (
                  <option key={cc.id} value={cc.id}>
                    {cc.codigo} - {cc.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-emerald-600" />
                Proyecto / Obra / Contrato
              </label>
              <select
                value={proyectoId}
                onChange={(e) => setProyectoId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              >
                <option value="">-- Sin Proyecto Específico (Gasto General) --</option>
                {projects.map((pry) => (
                  <option key={pry.id} value={pry.id}>
                    {pry.codigo} - {pry.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Fechas y Anticipo de Fondos */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Fecha Inicio</label>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Fecha Cierre</label>
              <input
                type="date"
                value={fechaCierre}
                onChange={(e) => setFechaCierre(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Fondo Anticipado ($ CLP)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-xs text-slate-400 font-bold">$</span>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={fondoAsignadoClp}
                  onChange={(e) => setFondoAsignadoClp(Number(e.target.value))}
                  placeholder="0"
                  className="w-full pl-7 pr-3 py-2 text-xs border border-slate-300 rounded-lg font-mono font-bold focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">Anticipo entregado para liquidar</p>
            </div>
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
            <span className="text-[11px] text-slate-500 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Auditoría agéntica NIF / SII activa
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Crear Rendición
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
