import React, { useState } from 'react';
import { 
  HeartPulse, 
  Plus, 
  Calendar, 
  FileText, 
  Building2, 
  AlertCircle, 
  CheckCircle2, 
  DollarSign, 
  ShieldCheck, 
  Clock, 
  X,
  Send,
  User
} from 'lucide-react';
import { MedicalLeave, MedicalLeaveType, MedicalLeaveEntity, EmployeePayroll } from '../../types';
import { formatCLP } from '../../utils/chileanAccounting';

interface MedicalLeavesManagerProps {
  medicalLeaves: MedicalLeave[];
  onAddMedicalLeave: (leave: MedicalLeave) => void;
  onUpdateMedicalLeave: (leave: MedicalLeave) => void;
  employees: EmployeePayroll[];
}

export const MedicalLeavesManager: React.FC<MedicalLeavesManagerProps> = ({
  medicalLeaves,
  onAddMedicalLeave,
  onUpdateMedicalLeave,
  employees,
}) => {
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState<MedicalLeave | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    employeeId: employees[0]?.id || '',
    folioLicencia: `LME-${Math.floor(100000 + Math.random() * 900000)}-${Math.floor(Math.random() * 9)}`,
    tipoLicencia: 'ENFERMEDAD_COMUN' as MedicalLeaveType,
    entidadTramitadora: 'FONASA_COMPIN' as MedicalLeaveEntity,
    fechaInicio: new Date().toISOString().split('T')[0],
    diasReposo: 7,
    medicoNombre: 'Dr. Alejandro Soto Valdivia',
    medicoRut: '12.450.982-1',
    diagnosticoCie10: 'J06.9 - Infección respiratoria aguda no especificada',
    observaciones: '',
  });

  const totalDiasReposo = medicalLeaves.reduce((acc, l) => acc + l.diasReposo, 0);
  const totalDescuentoNomina = medicalLeaves.reduce((acc, l) => acc + l.descuentoNominaEstimado, 0);
  const leavesPending = medicalLeaves.filter(l => l.estado === 'RECIBIDA' || l.estado === 'TRAMITADA_EMPLEADOR').length;

  const handleCreateLeave = (e: React.FormEvent) => {
    e.preventDefault();
    const emp = employees.find(e => e.id === formData.employeeId);
    if (!emp) return;

    // Calcular días fecha término
    const start = new Date(formData.fechaInicio);
    const end = new Date(start);
    end.setDate(start.getDate() + formData.diasReposo - 1);
    const fechaTermino = end.toISOString().split('T')[0];

    // Regla chilena del SIL (Subsidio por Incapacidad Laboral):
    // Si es enfermedad común y son 10 días o menos: los primeros 3 días no tienen subsidio SIL
    // Si son 11 o más días: se subsidian todos los días.
    // Si es accidente laboral / trayecto (Ley 16.744): se subsidia el 100% desde el día 1.
    let diasSIL = formData.diasReposo;
    if (formData.tipoLicencia === 'ENFERMEDAD_COMUN') {
      if (formData.diasReposo <= 10) {
        diasSIL = Math.max(0, formData.diasReposo - 3);
      }
    }

    // Descuento en nómina por días no trabajados (sueldo base / 30 * días reposo)
    const valorDia = emp.sueldoBase / 30;
    const descuentoNomina = Math.round(valorDia * formData.diasReposo);

    const newLeave: MedicalLeave = {
      id: `lme-${Date.now()}`,
      folioLicencia: formData.folioLicencia,
      employeeId: emp.id,
      rut: emp.rut,
      nombreCompleto: emp.nombreCompleto,
      tipoLicencia: formData.tipoLicencia,
      entidadTramitadora: formData.entidadTramitadora,
      fechaInicio: formData.fechaInicio,
      fechaTermino,
      diasReposo: formData.diasReposo,
      diasDescuentoRemuneracion: formData.diasReposo,
      diasSubsidioSIL: diasSIL,
      descuentoNominaEstimado: descuentoNomina,
      medicoNombre: formData.medicoNombre,
      medicoRut: formData.medicoRut,
      diagnosticoCie10: formData.diagnosticoCie10,
      estado: 'TRAMITADA_EMPLEADOR',
      fechaTramitacionEmpleador: new Date().toISOString().split('T')[0],
      observaciones: formData.observaciones || 'Tramitada electrónicamente vía portal empleador (Medipass / I-Med).',
    };

    onAddMedicalLeave(newLeave);
    setShowNewModal(false);
  };

  const handleApproveCompin = (leave: MedicalLeave) => {
    const updated: MedicalLeave = {
      ...leave,
      estado: 'APROBADA_COMPIN_ISAPRE',
    };
    onUpdateMedicalLeave(updated);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Licencias Médicas (LME)</span>
            <HeartPulse className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">{medicalLeaves.length}</div>
          <div className="text-[11px] text-slate-500 mt-1">
            Electrónicas tramitadas en el período
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Días Totales de Reposo</span>
            <Calendar className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-700 mt-2">
            {totalDiasReposo} días
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Impacto en continuidad operacional
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Ajuste Descuento Nómina</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-2">
            {formatCLP(totalDescuentoNomina)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Subsidio SIL asumido por Fonasa/Isapre
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Plazo Tramitación Empleador</span>
            <Clock className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-indigo-700 mt-2">
            3 días
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Obligación legal D.S. N° 3 de Salud
          </div>
        </div>
      </div>

      {/* Control Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-extrabold text-slate-900 text-sm sm:text-base flex items-center gap-2">
            <HeartPulse className="w-5 h-5 text-rose-600" />
            <span>Licencias Médicas Electrónicas (LME / SIL - Compin, Isapre & Mutualidades)</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Tramitación de subsidio por incapacidad laboral (SIL), rebaja proporcional de días en la nómina y control de plazos legales.
          </p>
        </div>

        <button
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Ingresar Licencia Médica</span>
        </button>
      </div>

      {/* Medical Leaves Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-[11px]">
              <tr>
                <th className="px-4 py-3">Folio LME / Trabajador</th>
                <th className="px-4 py-3">Tipo de Licencia & Diagnóstico</th>
                <th className="px-4 py-3">Entidad Tramitadora</th>
                <th className="px-4 py-3 text-center">Período de Reposo</th>
                <th className="px-4 py-3 text-center">Días SIL vs Días Desc.</th>
                <th className="px-4 py-3 text-right">Descuento Sueldo</th>
                <th className="px-4 py-3 text-center">Estado Tramitación</th>
                <th className="px-4 py-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {medicalLeaves.map((leave) => (
                <tr key={leave.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-mono font-bold text-blue-700">{leave.folioLicencia}</div>
                    <div className="font-bold text-slate-900 mt-0.5">{leave.nombreCompleto}</div>
                    <div className="text-[11px] text-slate-500 font-mono">{leave.rut}</div>
                  </td>

                  <td className="px-4 py-3">
                    <span className="inline-block text-[10px] px-2 py-0.5 rounded-md font-bold uppercase bg-rose-50 text-rose-800 border border-rose-200">
                      {leave.tipoLicencia.replace(/_/g, ' ')}
                    </span>
                    <div className="text-[11px] text-slate-600 mt-1 font-medium line-clamp-1">
                      {leave.diagnosticoCie10 || 'No especificado'}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Médico: {leave.medicoNombre}
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-800">
                      {leave.entidadTramitadora.replace(/_/g, ' ')}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Tramitada el {leave.fechaTramitacionEmpleador || leave.fechaInicio}
                    </div>
                  </td>

                  <td className="px-4 py-3 text-center">
                    <div className="font-mono text-xs font-bold text-slate-800">
                      {leave.diasReposo} días
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      {leave.fechaInicio} al {leave.fechaTermino}
                    </div>
                  </td>

                  <td className="px-4 py-3 text-center">
                    <div className="inline-flex items-center gap-1 font-mono text-xs">
                      <span className="text-emerald-700 font-bold" title="Días pagados por subsidio SIL">{leave.diasSubsidioSIL} SIL</span>
                      <span className="text-slate-300">/</span>
                      <span className="text-rose-700 font-bold" title="Días no trabajados a descontar">{leave.diasDescuentoRemuneracion} Desc</span>
                    </div>
                    {leave.diasReposo <= 10 && leave.tipoLicencia === 'ENFERMEDAD_COMUN' && (
                      <div className="text-[9px] text-amber-700 font-semibold mt-0.5">
                        Primeros 3 días sin SIL
                      </div>
                    )}
                  </td>

                  <td className="px-4 py-3 text-right font-mono font-bold text-rose-700">
                    -{formatCLP(leave.descuentoNominaEstimado)}
                  </td>

                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      leave.estado === 'APROBADA_COMPIN_ISAPRE'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {leave.estado === 'APROBADA_COMPIN_ISAPRE' ? 'Aprobada Compin' : 'Tramitada Empleador'}
                    </span>
                  </td>

                  <td className="px-4 py-3 text-center">
                    {leave.estado !== 'APROBADA_COMPIN_ISAPRE' ? (
                      <button
                        onClick={() => handleApproveCompin(leave)}
                        className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold shadow-xs cursor-pointer"
                        title="Marcar como Aprobada por Compin / Isapre"
                      >
                        Marcar Aprobada
                      </button>
                    ) : (
                      <span className="text-emerald-600 text-xs font-bold inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>En regla</span>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Ingreso de Licencia Médica */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-150">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <h3 className="font-bold text-white text-sm sm:text-base flex items-center gap-2">
                <HeartPulse className="w-5 h-5 text-rose-400" />
                <span>Ingreso de Licencia Médica Electrónica (LME)</span>
              </h3>
              <button
                onClick={() => setShowNewModal(false)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateLeave} className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Colaborador / Trabajador:</label>
                  <select
                    value={formData.employeeId}
                    onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 font-semibold"
                  >
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.nombreCompleto} ({emp.rut})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Folio LME:</label>
                  <input
                    type="text"
                    required
                    value={formData.folioLicencia}
                    onChange={(e) => setFormData({ ...formData, folioLicencia: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono text-blue-700 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tipo de Licencia:</label>
                  <select
                    value={formData.tipoLicencia}
                    onChange={(e) => setFormData({ ...formData, tipoLicencia: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900"
                  >
                    <option value="ENFERMEDAD_COMUN">Enfermedad Común</option>
                    <option value="PRONATAL_POSTNATAL">Pre y Post Natal (Maternidad)</option>
                    <option value="ACCIDENTE_DE_TRAYECTO">Accidente de Trayecto (Mutual)</option>
                    <option value="ACCIDENTE_DEL_TRABAJO">Accidente del Trabajo (Ley 16.744)</option>
                    <option value="PATOLOGIA_EMBARAZO">Patología del Embarazo</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Entidad Pagadora SIL:</label>
                  <select
                    value={formData.entidadTramitadora}
                    onChange={(e) => setFormData({ ...formData, entidadTramitadora: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900"
                  >
                    <option value="FONASA_COMPIN">FONASA / COMPIN</option>
                    <option value="ISAPRE_BANMEDICA">ISAPRE Banmédica</option>
                    <option value="ISAPRE_COLMENA">ISAPRE Colmena Golden Cross</option>
                    <option value="ISAPRE_CONSALUD">ISAPRE Consalud</option>
                    <option value="MUTUAL_DE_SEGURIDAD">Mutual de Seguridad CChC</option>
                    <option value="ACHS">Asociación Chilena de Seguridad (ACHS)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Fecha Inicio de Reposo:</label>
                  <input
                    type="date"
                    required
                    value={formData.fechaInicio}
                    onChange={(e) => setFormData({ ...formData, fechaInicio: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Días de Reposo Otorgados:</label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    required
                    value={formData.diasReposo}
                    onChange={(e) => setFormData({ ...formData, diasReposo: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono font-bold text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Médico Tratante:</label>
                  <input
                    type="text"
                    value={formData.medicoNombre}
                    onChange={(e) => setFormData({ ...formData, medicoNombre: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Diagnóstico CIE-10:</label>
                  <input
                    type="text"
                    value={formData.diagnosticoCie10}
                    onChange={(e) => setFormData({ ...formData, diagnosticoCie10: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900"
                  />
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-[11px] text-amber-900 space-y-1">
                <div className="font-bold flex items-center gap-1 text-amber-950">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                  <span>Regla Legal Chilena de Subsidio SIL:</span>
                </div>
                <p>
                  En licencias médicas por enfermedad común de hasta 10 días, los primeros 3 días no son cubiertos por el Subsidio de Incapacidad Laboral (D.F.L. N° 44). El descuento salarial se calculará automáticamente sobre el total de días de reposo.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 cursor-pointer font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold shadow-xs cursor-pointer"
                >
                  Registrar & Calcular SIL
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
