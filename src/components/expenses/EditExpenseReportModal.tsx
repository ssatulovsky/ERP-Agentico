import React, { useState, useEffect } from 'react';
import { X, Save, Building2, Briefcase, User, Mail, CreditCard, ShieldCheck, AlertCircle } from 'lucide-react';
import { ExpenseReport, ExpenseProject, CostCenterMaster } from '../../types';
import { formatCLP } from '../../utils/expenseManagementAgent';
import { loadCompanyAuxiliaries, CompanyAuxiliaryItem } from '../../utils/companyAuxiliariesService';
import { loadCompanyProjects } from '../../utils/companyProjectsService';

interface EditExpenseReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: ExpenseReport | null;
  onUpdate: (reportId: string, updates: Partial<ExpenseReport>) => Promise<void> | void;
  costCenters: CostCenterMaster[];
  projects: ExpenseProject[];
  empresaId?: string;
}

export const EditExpenseReportModal: React.FC<EditExpenseReportModalProps> = ({
  isOpen,
  onClose,
  report,
  onUpdate,
  costCenters,
  projects,
  empresaId = '',
}) => {
  const [titulo, setTitulo] = useState('');
  const [rendidorNombre, setRendidorNombre] = useState('');
  const [rendidorRut, setRendidorRut] = useState('');
  const [rendidorEmail, setRendidorEmail] = useState('');
  const [rendidorCargo, setRendidorCargo] = useState('');
  const [centroCostoId, setCentroCostoId] = useState('');
  const [proyectoId, setProyectoId] = useState('');
  const [fondoAsignadoClp, setFondoAsignadoClp] = useState<number>(0);
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaCierre, setFechaCierre] = useState('');
  const [aprobadorNombre, setAprobadorNombre] = useState('');
  const [isCustomApprover, setIsCustomApprover] = useState(false);

  const [auxiliaries, setAuxiliaries] = useState<CompanyAuxiliaryItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const activeProjects = (projects && projects.length > 0) ? projects : loadCompanyProjects(empresaId);

  useEffect(() => {
    if (isOpen && report) {
      setErrorMessage(null);
      setTitulo(report.titulo || '');
      setRendidorNombre(report.rendidorNombre || '');
      setRendidorRut(report.rendidorRut || '');
      setRendidorEmail(report.rendidorEmail || '');
      setRendidorCargo(report.rendidorCargo || '');
      setCentroCostoId(report.centroCostoId || costCenters[0]?.id || '');
      setProyectoId(report.proyectoId || activeProjects[0]?.id || '');
      setFondoAsignadoClp(Number(report.fondoAsignadoClp) || 0);
      setFechaInicio(report.fechaInicio || new Date().toISOString().substring(0, 10));
      setFechaCierre(report.fechaCierre || new Date().toISOString().substring(0, 10));
      
      const currentApprover = report.aprobadorNombre || 'Carla Morales Troncoso';
      setAprobadorNombre(currentApprover);
      const isKnown = ['Carla Morales Troncoso', 'Mario Vargas Da Silva', 'Gonzalo Silva Valenzuela'].includes(currentApprover);
      setIsCustomApprover(!isKnown);

      const loadedAux = loadCompanyAuxiliaries(empresaId);
      setAuxiliaries(loadedAux);
    }
  }, [isOpen, report, costCenters, projects, empresaId]);

  if (!isOpen || !report) return null;

  // Clasificar auxiliares: Rendiciones/Empleados primero
  const rendicionAuxiliaries = auxiliaries.filter(
    (a) => a.tipo === 'RENDICION' || a.tipo === 'RENDICIONES' || a.tipo === 'EMPLEADO' || a.tipoAuxiliar === 'RENDICION' || a.tipoAuxiliar === 'EMPLEADO'
  );
  const otherAuxiliaries = auxiliaries.filter(
    (a) => !rendicionAuxiliaries.includes(a)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim() || !rendidorNombre.trim() || !rendidorRut.trim()) {
      setErrorMessage('Por favor complete los campos obligatorios (*).');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const selectedCc = costCenters.find((c) => c.id === centroCostoId);
      const selectedPry = activeProjects.find((p) => p.id === proyectoId);
      const fondo = Number(fondoAsignadoClp) || 0;
      const totalRendido = Number(report.montoTotalRendidoClp) || 0;
      const saldoReembolsar = Math.max(0, totalRendido - fondo);
      const saldoReintegrar = Math.max(0, fondo - totalRendido);

      await onUpdate(report.id, {
        titulo: titulo.trim(),
        rendidorNombre: rendidorNombre.trim(),
        rendidorRut: rendidorRut.trim(),
        rendidorEmail: rendidorEmail.trim(),
        rendidorCargo: rendidorCargo.trim(),
        centroCostoId,
        centroCostoCodigo: selectedCc?.codigo || report.centroCostoCodigo || '',
        centroCostoNombre: selectedCc?.nombre || report.centroCostoNombre || '',
        proyectoId,
        proyectoCodigo: selectedPry?.codigo || report.proyectoCodigo || '',
        proyectoNombre: selectedPry?.nombre || report.proyectoNombre || '',
        fondoAsignadoClp: fondo,
        saldoReembolsarClp: saldoReembolsar,
        saldoReintegrarClp: saldoReintegrar,
        fechaInicio,
        fechaCierre,
        aprobadorNombre: aprobadorNombre.trim(),
      });

      onClose();
    } catch (err: any) {
      console.error('[EditExpenseReportModal] Error al actualizar rendición:', err);
      setErrorMessage(err?.message || 'Error al guardar los cambios en la base de datos.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-slate-900 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl border border-white/20">
              <CreditCard className="w-5 h-5 text-amber-200" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Modificar Rendición de Gastos
                <span className="text-xs bg-amber-500/40 text-amber-100 font-mono px-2 py-0.5 rounded-full border border-amber-300/30">
                  {report.folio}
                </span>
              </h3>
              <p className="text-xs text-amber-200">
                Ajuste de datos de cabecera, rendidor, proyecto, imputación analítica o fondo entregado
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 text-amber-200 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mensaje de error si falla */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

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
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
            />
          </div>

          {/* Datos del Colaborador Rendidor */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-amber-600" />
                Datos del Rendidor (Trabajador)
              </span>
              <span className="text-[10px] text-slate-500 font-medium">
                Auxiliar Contable Registrado
              </span>
            </div>

            {/* Selector de Auxiliares Registrados (Rendiciones / Empleados) */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Seleccionar Rendidor desde Auxiliares Registrados
              </label>
              <select
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) return;
                  const aux = auxiliaries.find(
                    (a) => a.id === val || a.rut === val || a.rutCompleto === val
                  );
                  if (aux) {
                    setRendidorNombre(aux.razonSocial || aux.nombreContacto || '');
                    setRendidorRut(aux.rutCompleto || aux.rut || '');
                    setRendidorEmail(aux.emailContacto || aux.emailDte || '');
                    setRendidorCargo(aux.giroComercial || (aux.tipo === 'EMPLEADO' ? 'Colaborador' : 'Rendidor Autorizado'));
                  }
                }}
                className="w-full px-3 py-1.5 text-xs bg-white border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              >
                <option value="">-- Proponer desde Auxiliares Registrados (Personal / Rendiciones) --</option>
                {rendicionAuxiliaries.length > 0 && (
                  <optgroup label="⭐ Auxiliares de Rendición / Personal (Recomendados)">
                    {rendicionAuxiliaries.map((aux, idx) => (
                      <option key={aux.id || aux.rut || idx} value={aux.id || aux.rutCompleto || aux.rut}>
                        {aux.razonSocial} ({aux.rutCompleto || aux.rut}) • [{aux.tipo || aux.tipoAuxiliar || 'PERSONAL'}]
                      </option>
                    ))}
                  </optgroup>
                )}
                {otherAuxiliaries.length > 0 && (
                  <optgroup label="Otros Auxiliares">
                    {otherAuxiliaries.map((aux, idx) => (
                      <option key={aux.id || aux.rut || idx} value={aux.id || aux.rutCompleto || aux.rut}>
                        {aux.razonSocial} ({aux.rutCompleto || aux.rut}) {aux.tipo ? `• [${aux.tipo}]` : ''}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                Seleccione un auxiliar registrado para autocompletar o modifique los campos libremente.
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Nombre Completo <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  value={rendidorNombre}
                  onChange={(e) => setRendidorNombre(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">RUT Chileno <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  value={rendidorRut}
                  onChange={(e) => setRendidorRut(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Cargo</label>
                <input
                  type="text"
                  value={rendidorCargo}
                  onChange={(e) => setRendidorCargo(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Email Corporativo</label>
                <input
                  type="email"
                  value={rendidorEmail}
                  onChange={(e) => setRendidorEmail(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Imputación Analítica */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                Centro de Costo
              </label>
              <select
                value={centroCostoId}
                onChange={(e) => setCentroCostoId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
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
                Proyecto / Faena / Obra
              </label>
              <select
                value={proyectoId}
                onChange={(e) => setProyectoId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              >
                {activeProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.codigo} - {p.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Fechas y Fondo Asignado */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Fecha Inicio
              </label>
              <input
                type="date"
                required
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Fecha Cierre
              </label>
              <input
                type="date"
                required
                value={fechaCierre}
                onChange={(e) => setFechaCierre(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Fondo Entregado (CLP)
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={fondoAsignadoClp ? fondoAsignadoClp.toLocaleString('es-CL') : ''}
                onChange={(e) => {
                  const rawVal = e.target.value.replace(/[^0-9]/g, '');
                  setFondoAsignadoClp(rawVal ? parseInt(rawVal, 10) : 0);
                }}
                placeholder="$ 0"
                className="w-full px-3 py-1.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Supervisor / Responsable de Aprobación */}
          <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-200 space-y-2">
            <label className="block text-xs font-bold text-amber-900">
              Responsable / Supervisor de Aprobación
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <select
                value={isCustomApprover ? '__CUSTOM__' : aprobadorNombre}
                onChange={(e) => {
                  if (e.target.value === '__CUSTOM__') {
                    setIsCustomApprover(true);
                  } else {
                    setIsCustomApprover(false);
                    setAprobadorNombre(e.target.value);
                  }
                }}
                className="px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-amber-500"
              >
                <option value="Carla Morales Troncoso">Carla Morales Troncoso (Jefa de Administración)</option>
                <option value="Mario Vargas Da Silva">Mario Vargas Da Silva (Gerente de Operaciones)</option>
                <option value="Gonzalo Silva Valenzuela">Gonzalo Silva Valenzuela (Supervisor Comercial)</option>
                <option value="__CUSTOM__">-- Ingresar Otro Responsable / Supervisor --</option>
              </select>
              {isCustomApprover && (
                <input
                  type="text"
                  value={aprobadorNombre}
                  onChange={(e) => setAprobadorNombre(e.target.value)}
                  placeholder="Nombre y cargo del supervisor..."
                  className="px-3 py-1.5 bg-white border border-amber-400 rounded-lg text-xs font-medium text-slate-800 focus:ring-2 focus:ring-amber-500 flex-1"
                />
              )}
            </div>
          </div>

          {/* Footer de Acciones */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-all shadow-md shadow-amber-600/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSubmitting ? 'Guardando...' : 'Guardar Modificaciones'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
