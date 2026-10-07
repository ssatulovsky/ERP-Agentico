import React, { useState } from 'react';
import { 
  Palmtree, 
  Plus, 
  Calendar, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Printer, 
  X, 
  FileCheck, 
  User,
  ShieldAlert,
  ChevronRight
} from 'lucide-react';
import { VacationRecord, VacationRequest, CompanyProfile } from '../../types';

interface VacationsManagerProps {
  vacations: VacationRecord[];
  onAddRequest: (employeeId: string, request: VacationRequest) => void;
  onApproveRequest: (employeeId: string, requestId: string) => void;
  company: CompanyProfile;
}

export const VacationsManager: React.FC<VacationsManagerProps> = ({
  vacations,
  onAddRequest,
  onApproveRequest,
  company,
}) => {
  const [selectedRecord, setSelectedRecord] = useState<VacationRecord | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showProofModal, setShowProofModal] = useState<{ record: VacationRecord; req: VacationRequest } | null>(null);

  // Form state
  const [formEmployeeId, setFormEmployeeId] = useState(vacations[0]?.employeeId || '');
  const [formFechaInicio, setFormFechaInicio] = useState(new Date().toISOString().split('T')[0]);
  const [formDiasHabiles, setFormDiasHabiles] = useState(10);
  const [formComentario, setFormComentario] = useState('');

  const excessArt70Count = vacations.filter(v => v.alertaExcesoPeriodosArt70).length;
  const totalDiasDisponibles = vacations.reduce((acc, v) => acc + v.diasDisponibles, 0);
  const activeRequests = vacations.flatMap(v => v.solicitudes.filter(r => r.estado === 'SOLICITADA' || r.estado === 'APROBADA_JEFE'));

  const handleCreateRequest = (e: React.FormEvent) => {
    e.preventDefault();
    const record = vacations.find(v => v.employeeId === formEmployeeId);
    if (!record) return;

    // Calcular fecha de retorno estimada
    const start = new Date(formFechaInicio);
    let count = 0;
    const current = new Date(start);
    while (count < formDiasHabiles) {
      current.setDate(current.getDate() + 1);
      const day = current.getDay();
      // En Chile: sábado (6) y domingo (0) son inhábiles conforme al Art. 69
      if (day !== 0 && day !== 6) {
        count++;
      }
    }
    const fechaRetorno = current.toISOString().split('T')[0];

    const newReq: VacationRequest = {
      id: `req-vac-${Date.now()}`,
      fechaSolicitud: new Date().toISOString().split('T')[0],
      fechaInicio: formFechaInicio,
      fechaRetorno,
      diasHabilesTomados: formDiasHabiles,
      estado: 'AUTORIZADA_RRHH',
      comprobanteFirmado: false,
      comentario: formComentario || 'Solicitud de feriado legal anual.',
    };

    onAddRequest(formEmployeeId, newReq);
    setShowNewModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Días Totales Disponibles</span>
            <Palmtree className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-2">{totalDiasDisponibles} días</div>
          <div className="text-[11px] text-slate-500 mt-1">
            Saldo acumulado de la dotación
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Infracción Art. 70 DT</span>
            <ShieldAlert className={`w-4 h-4 ${excessArt70Count > 0 ? 'text-rose-600' : 'text-slate-400'}`} />
          </div>
          <div className={`text-2xl font-black mt-2 ${excessArt70Count > 0 ? 'text-rose-700' : 'text-slate-900'}`}>
            {excessArt70Count} caso(s)
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Acumulación &gt; 2 períodos continuos
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Solicitudes Pendientes</span>
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-700 mt-2">
            {activeRequests.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Por autorizar en RRHH
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Días Hábiles Legales</span>
            <Calendar className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-indigo-700 mt-2">
            15 días / año
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Sábados siempre inhábiles (Art. 69)
          </div>
        </div>
      </div>

      {/* Control Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-extrabold text-slate-900 text-sm sm:text-base flex items-center gap-2">
            <Palmtree className="w-5 h-5 text-emerald-600" />
            <span>Control de Feriado Legal & Vacaciones Progresivas (Código del Trabajo)</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Artículos 67 al 70 del Código del Trabajo. Vigilancia estricta del tope de 2 períodos acumulados y emisión de comprobantes oficiales de feriado.
          </p>
        </div>

        <button
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Nueva Solicitud de Feriado</span>
        </button>
      </div>

      {/* Table: Vacation Balance per Employee */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-[11px]">
              <tr>
                <th className="px-4 py-3">Colaborador / RUT</th>
                <th className="px-4 py-3 text-center">Antigüedad</th>
                <th className="px-4 py-3 text-center">Días Legales + Progresivos</th>
                <th className="px-4 py-3 text-center">Días Acumulados</th>
                <th className="px-4 py-3 text-center">Días Tomados</th>
                <th className="px-4 py-3 text-center font-bold">Saldo Disponible</th>
                <th className="px-4 py-3 text-center">Períodos Acumulados</th>
                <th className="px-4 py-3 text-center">Historial Solicitudes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {vacations.map((record) => {
                const hasAlert = record.alertaExcesoPeriodosArt70;
                return (
                  <tr key={record.id} className={`hover:bg-slate-50/80 transition-colors ${hasAlert ? 'bg-rose-50/40' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-900">{record.nombreCompleto}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{record.rut}</div>
                      <div className="text-[10px] text-slate-400">Ingreso: {record.fechaIngreso}</div>
                    </td>

                    <td className="px-4 py-3 text-center font-semibold text-slate-800">
                      {record.antiguedadAnos} años
                    </td>

                    <td className="px-4 py-3 text-center">
                      <span className="font-mono font-bold text-slate-800">{record.diasLegalesPorAno}</span>
                      {record.diasProgresivos > 0 ? (
                        <span className="text-emerald-700 font-bold ml-1">+{record.diasProgresivos} prog.</span>
                      ) : (
                        <span className="text-slate-400 text-[10px] ml-1">(0 prog.)</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-center font-mono text-slate-700">
                      {record.diasAcumuladosTotales} d
                    </td>

                    <td className="px-4 py-3 text-center font-mono text-slate-700">
                      {record.diasTomadosHistorico} d
                    </td>

                    <td className="px-4 py-3 text-center">
                      <span className="font-mono font-black text-sm px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                        {record.diasDisponibles} días
                      </span>
                    </td>

                    <td className="px-4 py-3 text-center">
                      <div className="inline-flex items-center gap-1">
                        <span className={`font-mono font-bold text-xs ${hasAlert ? 'text-rose-700 font-black' : 'text-slate-700'}`}>
                          {record.periodosPendientes.toFixed(1)} períodos
                        </span>
                        {hasAlert && (
                          <span 
                            className="bg-rose-100 text-rose-800 text-[9px] font-extrabold px-1.5 py-0.5 rounded border border-rose-300"
                            title="Infracción gravísima Art. 70 Código del Trabajo: No se pueden acumular más de 2 períodos"
                          >
                            ⚠️ &gt; 2 PERÍODOS
                          </span>
                        )}
                      </div>
                      {hasAlert && (
                        <div className="text-[10px] text-rose-600 mt-0.5 font-medium">
                          Riesgo Multa DT (60 UTM)
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3 text-center">
                      <div className="space-y-1">
                        {record.solicitudes.length === 0 ? (
                          <span className="text-slate-400 text-[10px]">Sin solicitudes</span>
                        ) : (
                          record.solicitudes.map((req) => (
                            <div key={req.id} className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 px-2 py-1 rounded text-[10px]">
                              <span className="font-mono text-slate-800">
                                {req.fechaInicio} ({req.diasHabilesTomados}d)
                              </span>
                              <div className="flex items-center gap-1">
                                <span className={`px-1.5 py-0.2 rounded font-bold ${
                                  req.estado === 'TOMADA' ? 'bg-slate-200 text-slate-700' : 'bg-emerald-100 text-emerald-800'
                                }`}>
                                  {req.estado}
                                </span>
                                <button
                                  onClick={() => setShowProofModal({ record, req })}
                                  className="text-blue-600 hover:text-blue-800 p-0.5"
                                  title="Ver Comprobante de Feriado"
                                >
                                  <FileCheck className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Comprobante Oficial de Feriado Legal */}
      {showProofModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-150">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <h3 className="font-bold text-white text-sm sm:text-base flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-emerald-400" />
                <span>Comprobante Oficial de Feriado Legal (Dirección del Trabajo)</span>
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir</span>
                </button>
                <button
                  onClick={() => setShowProofModal(null)}
                  className="text-slate-400 hover:text-white p-1 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs font-sans text-slate-900">
              <div className="text-center pb-3 border-b border-slate-200">
                <div className="font-extrabold text-sm uppercase tracking-wider text-slate-900">
                  COMPROBANTE DE FERIADO LEGAL ANUAL
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Conforme a los Artículos 67, 68, 69 y 70 del Código del Trabajo
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
                <div><strong>Empleador:</strong> {company.razonSocial} (RUT: {company.rut})</div>
                <div><strong>Trabajador:</strong> {showProofModal.record.nombreCompleto} (RUT: {showProofModal.record.rut})</div>
                <div><strong>Fecha de Solicitud:</strong> {showProofModal.req.fechaSolicitud}</div>
              </div>

              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left">
                  <tbody className="divide-y divide-slate-200">
                    <tr className="bg-slate-50 font-semibold">
                      <td className="p-2">Días Hábiles Solicitados (Excluye Sábados y Domingos):</td>
                      <td className="p-2 font-mono font-bold text-emerald-700 text-right">
                        {showProofModal.req.diasHabilesTomados} días
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2">Fecha Inicio del Feriado:</td>
                      <td className="p-2 font-mono text-right">{showProofModal.req.fechaInicio}</td>
                    </tr>
                    <tr>
                      <td className="p-2">Fecha de Retorno a Labores:</td>
                      <td className="p-2 font-mono text-right font-bold">{showProofModal.req.fechaRetorno}</td>
                    </tr>
                    <tr>
                      <td className="p-2">Saldo de Días Pendientes tras Feriado:</td>
                      <td className="p-2 font-mono font-bold text-right">
                        {showProofModal.record.diasDisponibles - showProofModal.req.diasHabilesTomados} días hábiles
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <p className="text-[11px] text-slate-600 leading-relaxed">
                El Trabajador deja constancia de haber convenido libremente con el Empleador el uso de su feriado anual correspondiente, el que será íntegramente remunerado conforme al Artículo 71 del Código del Trabajo.
              </p>

              <div className="pt-10 grid grid-cols-2 gap-8 text-center text-[10px] text-slate-600">
                <div className="border-t border-slate-300 pt-2">
                  <strong>{company.razonSocial}</strong>
                  <br />Firma y Timbre Empleador
                </div>
                <div className="border-t border-slate-300 pt-2">
                  <strong>{showProofModal.record.nombreCompleto}</strong>
                  <br />RUT: {showProofModal.record.rut}
                  <br />Firma Trabajador
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Nueva Solicitud de Feriado */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg overflow-hidden shadow-2xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-150">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <h3 className="font-bold text-white text-sm sm:text-base flex items-center gap-2">
                <Palmtree className="w-5 h-5 text-emerald-400" />
                <span>Registrar Solicitud de Vacaciones</span>
              </h3>
              <button
                onClick={() => setShowNewModal(false)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRequest} className="p-6 overflow-y-auto space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Colaborador:</label>
                <select
                  value={formEmployeeId}
                  onChange={(e) => setFormEmployeeId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 font-semibold"
                >
                  {vacations.map((v) => (
                    <option key={v.employeeId} value={v.employeeId}>
                      {v.nombreCompleto} (Saldo disponible: {v.diasDisponibles} días)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Fecha de Inicio:</label>
                  <input
                    type="date"
                    required
                    value={formFechaInicio}
                    onChange={(e) => setFormFechaInicio(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Días Hábiles Solicitados:</label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    required
                    value={formDiasHabiles}
                    onChange={(e) => setFormDiasHabiles(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Glosa / Motivo:</label>
                <input
                  type="text"
                  value={formComentario}
                  onChange={(e) => setFormComentario(e.target.value)}
                  placeholder="Ej: Feriado legal período estival / descanso familiar"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900"
                />
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-[11px] text-emerald-900">
                <strong>Cálculo Automático según Art. 69:</strong> Se computan exclusivamente días hábiles (lunes a viernes). Los sábados, domingos y feriados no consumen saldo de vacaciones.
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
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold shadow-xs cursor-pointer"
                >
                  Aprobar Solicitud & Emitir Comprobante
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
