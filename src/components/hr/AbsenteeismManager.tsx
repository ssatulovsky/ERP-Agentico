import React, { useState } from 'react';
import { 
  UserX, 
  Plus, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Calendar, 
  DollarSign, 
  FileWarning, 
  ShieldAlert, 
  X,
  FileText
} from 'lucide-react';
import { AbsenteeismRecord, AbsenteeismType, EmployeePayroll } from '../../types';
import { formatCLP } from '../../utils/chileanAccounting';

interface AbsenteeismManagerProps {
  absenteeism: AbsenteeismRecord[];
  onAddRecord: (record: AbsenteeismRecord) => void;
  onGenerateSanction: (record: AbsenteeismRecord) => void;
  employees: EmployeePayroll[];
}

export const AbsenteeismManager: React.FC<AbsenteeismManagerProps> = ({
  absenteeism,
  onAddRecord,
  onGenerateSanction,
  employees,
}) => {
  const [showNewModal, setShowNewModal] = useState(false);
  const [filterType, setFilterType] = useState<string>('TODOS');

  // Form state
  const [formData, setFormData] = useState({
    employeeId: employees[0]?.id || '',
    fecha: new Date().toISOString().split('T')[0],
    tipo: 'INASISTENCIA_INJUSTIFICADA' as AbsenteeismType,
    duracionTexto: '1 día completo',
    minutosAtraso: 0,
    diasInasistencia: 1,
    justificativoPresentado: '',
    observaciones: '',
  });

  const filteredRecords = absenteeism.filter(a => {
    if (filterType === 'TODOS') return true;
    if (filterType === 'CAUSAL_ART160') return a.alertaCausalArt160N3;
    return a.tipo === filterType;
  });

  const totalInasistenciasInjustificadas = absenteeism.filter(a => a.tipo === 'INASISTENCIA_INJUSTIFICADA').length;
  const criticalCausalCount = absenteeism.filter(a => a.alertaCausalArt160N3).length;
  const totalDescuentos = absenteeism.reduce((acc, a) => acc + a.impactoDescuentoPesos, 0);

  const handleCreateRecord = (e: React.FormEvent) => {
    e.preventDefault();
    const emp = employees.find(e => e.id === formData.employeeId);
    if (!emp) return;

    // Calcular impacto de descuento:
    // Sueldo base / 30 por cada día de inasistencia no justificada
    // O (sueldo base / 30 / 8.8) * horas de atraso
    let impacto = 0;
    if (formData.tipo === 'INASISTENCIA_INJUSTIFICADA' || formData.tipo === 'PERMISO_SIN_GOCE_SUELDO') {
      impacto = Math.round((emp.sueldoBase / 30) * formData.diasInasistencia);
    } else if (formData.tipo === 'ATRASO_REITERADO') {
      const valorHora = (emp.sueldoBase / 30) / 8.8;
      impacto = Math.round((valorHora / 60) * formData.minutosAtraso);
    }

    // Verificar si es día lunes o inasistencia que configure alerta Art. 160 N° 3
    const dateObj = new Date(formData.fecha);
    const isMonday = dateObj.getDay() === 1;
    const isCritical = (formData.tipo === 'INASISTENCIA_INJUSTIFICADA' && (isMonday || formData.diasInasistencia >= 2));

    const newRec: AbsenteeismRecord = {
      id: `abs-${Date.now()}`,
      employeeId: emp.id,
      rut: emp.rut,
      nombreCompleto: emp.nombreCompleto,
      fecha: formData.fecha,
      tipo: formData.tipo,
      duracionTexto: formData.tipo === 'ATRASO_REITERADO' ? `${formData.minutosAtraso} minutos` : `${formData.diasInasistencia} día(s)`,
      minutosAtraso: formData.tipo === 'ATRASO_REITERADO' ? formData.minutosAtraso : undefined,
      diasInasistencia: formData.tipo !== 'ATRASO_REITERADO' ? formData.diasInasistencia : undefined,
      justificativoPresentado: formData.justificativoPresentado,
      impactoDescuentoPesos: impacto,
      alertaCausalArt160N3: isCritical,
      estado: isCritical ? 'AMONESTACION_GENERADA' : 'PENDIENTE_REVISION',
      observaciones: formData.observaciones || (isMonday ? 'Inasistencia en día lunes (monitorear Art. 160 N° 3)' : ''),
    };

    onAddRecord(newRec);
    setShowNewModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Inasistencias Injustificadas</span>
            <UserX className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-black text-rose-700 mt-2">{totalInasistenciasInjustificadas}</div>
          <div className="text-[11px] text-slate-500 mt-1">
            Faltas sin respaldo legal o médico
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Riesgo Causal Art. 160 N° 3</span>
            <ShieldAlert className={`w-4 h-4 ${criticalCausalCount > 0 ? 'text-amber-600' : 'text-slate-400'}`} />
          </div>
          <div className={`text-2xl font-black mt-2 ${criticalCausalCount > 0 ? 'text-amber-700' : 'text-slate-900'}`}>
            {criticalCausalCount} caso(s)
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            2 días seguidos, 2 lunes o 3 días
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Descuentos en Nómina</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-2">
            {formatCLP(totalDescuentos)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Deducciones por horas/días no laborados
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Permisos Legales Pagados</span>
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-700 mt-2">
            100%
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Art. 66 (duelo), Art. 195 (paternidad)
          </div>
        </div>
      </div>

      {/* Control Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-extrabold text-slate-900 text-sm sm:text-base flex items-center gap-2">
            <UserX className="w-5 h-5 text-rose-600" />
            <span>Control de Ausentismo, Atrasos & Permisos Laborales (Art. 160 N° 3)</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Seguimiento de cumplimiento de jornada, permisos con goce legal (fallecimiento, paternidad) y semáforo preventivo de causales de despido.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-slate-50 border border-slate-300 text-slate-700 text-xs rounded-lg px-3 py-1.5 font-medium"
          >
            <option value="TODOS">Todos los Registros</option>
            <option value="CAUSAL_ART160">⚠️ Riesgo Causal Art. 160 N° 3</option>
            <option value="INASISTENCIA_INJUSTIFICADA">Inasistencias Injustificadas</option>
            <option value="ATRASO_REITERADO">Atrasos Reiterados</option>
            <option value="PERMISO_PATERNIDAD_ART195">Permisos Legales Pagados</option>
          </select>

          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Registrar Novedad / Inasistencia</span>
          </button>
        </div>
      </div>

      {/* Absenteeism Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-[11px]">
              <tr>
                <th className="px-4 py-3">Fecha / Trabajador</th>
                <th className="px-4 py-3">Tipo de Novedad</th>
                <th className="px-4 py-3">Duración / Impacto</th>
                <th className="px-4 py-3">Justificativo Presentado</th>
                <th className="px-4 py-3 text-right">Descuento Remuneración</th>
                <th className="px-4 py-3 text-center">Riesgo Art. 160 N° 3</th>
                <th className="px-4 py-3 text-center">Estado</th>
                <th className="px-4 py-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRecords.map((record) => (
                <tr key={record.id} className={`hover:bg-slate-50/80 transition-colors ${record.alertaCausalArt160N3 ? 'bg-amber-50/40' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="font-mono text-slate-800 font-semibold">{record.fecha}</div>
                    <div className="font-bold text-slate-900 mt-0.5">{record.nombreCompleto}</div>
                    <div className="text-[11px] text-slate-500 font-mono">{record.rut}</div>
                  </td>

                  <td className="px-4 py-3">
                    <span className={`inline-block text-[10px] px-2 py-0.5 rounded-md font-bold uppercase ${
                      record.tipo === 'INASISTENCIA_INJUSTIFICADA' 
                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                        : record.tipo === 'ATRASO_REITERADO'
                        ? 'bg-amber-100 text-amber-900 border border-amber-200'
                        : 'bg-blue-100 text-blue-800 border border-blue-200'
                    }`}>
                      {record.tipo.replace(/_/g, ' ')}
                    </span>
                  </td>

                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-800">{record.duracionTexto}</div>
                    {record.observaciones && (
                      <div className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">{record.observaciones}</div>
                    )}
                  </td>

                  <td className="px-4 py-3 text-[11px] text-slate-600">
                    {record.justificativoPresentado || <span className="text-slate-400 italic">Sin justificativo</span>}
                  </td>

                  <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                    {record.impactoDescuentoPesos > 0 ? (
                      <span className="text-rose-700">-{formatCLP(record.impactoDescuentoPesos)}</span>
                    ) : (
                      <span className="text-emerald-700 font-semibold">$0 (Con goce)</span>
                    )}
                  </td>

                  <td className="px-4 py-3 text-center">
                    {record.alertaCausalArt160N3 ? (
                      <div className="inline-flex items-center gap-1 bg-amber-100 border border-amber-300 text-amber-900 text-[10px] px-2 py-0.5 rounded-full font-bold">
                        <AlertTriangle className="w-3 h-3 text-amber-600" />
                        <span>Alerta Causal Despido</span>
                      </div>
                    ) : (
                      <span className="text-slate-400 text-[11px]">Normal</span>
                    )}
                  </td>

                  <td className="px-4 py-3 text-center">
                    <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">
                      {record.estado.replace(/_/g, ' ')}
                    </span>
                  </td>

                  <td className="px-4 py-3 text-center">
                    {record.tipo === 'INASISTENCIA_INJUSTIFICADA' && (
                      <button
                        onClick={() => onGenerateSanction(record)}
                        className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-bold shadow-xs cursor-pointer flex items-center gap-1 mx-auto"
                        title="Generar Carta de Amonestación con copia a la Inspección del Trabajo"
                      >
                        <FileWarning className="w-3 h-3" />
                        <span>Amonestar DT</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Registrar Novedad / Inasistencia */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg overflow-hidden shadow-2xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-150">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <h3 className="font-bold text-white text-sm sm:text-base flex items-center gap-2">
                <UserX className="w-5 h-5 text-rose-400" />
                <span>Registrar Inasistencia, Atraso o Permiso</span>
              </h3>
              <button
                onClick={() => setShowNewModal(false)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRecord} className="p-6 overflow-y-auto space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Colaborador:</label>
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Fecha del Evento:</label>
                  <input
                    type="date"
                    required
                    value={formData.fecha}
                    onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tipo de Ausencia / Permiso:</label>
                  <select
                    value={formData.tipo}
                    onChange={(e) => setFormData({ ...formData, tipo: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 font-semibold"
                  >
                    <option value="INASISTENCIA_INJUSTIFICADA">Inasistencia Injustificada</option>
                    <option value="ATRASO_REITERADO">Atraso a la Jornada</option>
                    <option value="PERMISO_PATERNIDAD_ART195">Permiso Paternidad (Art. 195 - Con goce)</option>
                    <option value="PERMISO_MATRIMONIO_ART207BIS">Permiso Matrimonio (Art. 207 bis - Con goce)</option>
                    <option value="PERMISO_FALLECIMIENTO_ART66">Permiso Duelo (Art. 66 - Con goce)</option>
                    <option value="PERMISO_SIN_GOCE_SUELDO">Permiso Particular sin Goce de Sueldo</option>
                  </select>
                </div>
              </div>

              {formData.tipo === 'ATRASO_REITERADO' ? (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Minutos de Atraso:</label>
                  <input
                    type="number"
                    min="1"
                    max="480"
                    value={formData.minutosAtraso}
                    onChange={(e) => setFormData({ ...formData, minutosAtraso: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono text-slate-900"
                  />
                </div>
              ) : (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Días de Ausencia:</label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={formData.diasInasistencia}
                    onChange={(e) => setFormData({ ...formData, diasInasistencia: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono text-slate-900"
                  />
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Justificativo / Documento Acompañado:</label>
                <input
                  type="text"
                  value={formData.justificativoPresentado}
                  onChange={(e) => setFormData({ ...formData, justificativoPresentado: e.target.value })}
                  placeholder="Ej: Certificado de Matrimonio / Constancia de Metro / Ninguno"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900"
                />
              </div>

              <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-[11px] text-rose-900 space-y-1">
                <div className="font-bold flex items-center gap-1 text-rose-950">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                  <span>Advertencia Legal Art. 160 N° 3 Código del Trabajo:</span>
                </div>
                <p>
                  Si la falta se produce en día lunes o dos días seguidos, el sistema activará la alerta legal preventiva de causal de despido sin derecho a indemnización.
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
                  Guardar Novedad
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
