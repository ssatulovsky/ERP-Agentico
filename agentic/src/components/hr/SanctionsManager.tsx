import React, { useState } from 'react';
import { 
  FileWarning, 
  Plus, 
  Scale, 
  Printer, 
  Send, 
  CheckCircle2, 
  AlertTriangle, 
  Building2, 
  ShieldCheck, 
  User, 
  X,
  FileText
} from 'lucide-react';
import { DisciplinarySanction, SanctionType, EmployeePayroll, CompanyProfile } from '../../types';
import { formatCLP } from '../../utils/chileanAccounting';

interface SanctionsManagerProps {
  sanctions: DisciplinarySanction[];
  onAddSanction: (sanction: DisciplinarySanction) => void;
  onUpdateSanction: (sanction: DisciplinarySanction) => void;
  employees: EmployeePayroll[];
  company: CompanyProfile;
}

export const SanctionsManager: React.FC<SanctionsManagerProps> = ({
  sanctions,
  onAddSanction,
  onUpdateSanction,
  employees,
  company,
}) => {
  const [showNewModal, setShowNewModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState<DisciplinarySanction | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    employeeId: employees[0]?.id || '',
    fechaInfraccion: new Date().toISOString().split('T')[0],
    tipo: 'AMONESTACION_ESCRITA_CON_COPIA_DT' as SanctionType,
    motivoInfraccion: '',
    articuloRiohs: 'Art. 18 RIOHS sobre puntualidad y asistencia',
    montoMulta: 0,
    remitidoInspeccionDelTrabajo: true,
  });

  const totalSanctions = sanctions.length;
  const sanctionsWithDtCopy = sanctions.filter(s => s.remitidoInspeccionDelTrabajo).length;
  const totalMultas = sanctions.reduce((acc, s) => acc + (s.montoMulta || 0), 0);

  const handleCreateSanction = (e: React.FormEvent) => {
    e.preventDefault();
    const emp = employees.find(e => e.id === formData.employeeId);
    if (!emp) return;

    // Calcular tope legal de multa (Art. 157 Código del Trabajo: max 25% de la remuneración diaria)
    const sueldoDiario = emp.sueldoBase / 30;
    const topeLegalMulta = Math.round(sueldoDiario * 0.25);
    const montoMultaFinal = Math.min(formData.montoMulta, topeLegalMulta);

    const carta = `CARTA FORMAL DE AMONESTACIÓN LABORAL
${company.ciudad}, ${new Date().toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' })}

Señor(a): ${emp.nombreCompleto}
R.U.T.: ${emp.rut}
Cargo: ${emp.cargo}
Presente

Por medio de la presente, la Administración de ${company.razonSocial} procede a notificarle la siguiente sanción disciplinaria: ${formData.tipo.replace(/_/g, ' ')}, debido a los hechos constatados con fecha ${formData.fechaInfraccion}:

${formData.motivoInfraccion}

Dicha falta contraviene expresamente lo prescrito en el ${formData.articuloRiohs} de nuestro Reglamento Interno de Orden, Higiene y Seguridad (RIOHS) y las obligaciones esenciales emanadas de su Contrato Individual de Trabajo.
${formData.tipo === 'MULTA_REGLAMENTO_INTERNO' && montoMultaFinal > 0 ? `\nSe aplica una multa reglamentaria de $${montoMultaFinal.toLocaleString('es-CL')} (conforme al tope del Art. 157 del Código del Trabajo), cuyo monto será enterado íntegramente en el Fondo de Bienestar de los Trabajadores.` : ''}
${formData.remitidoInspeccionDelTrabajo ? '\nSe remite copia de la presente a la Inspección del Trabajo correspondiente para constancia legal en su hoja de vida funcionaria.' : ''}

Se le advierte expresamente que la reiteración de estas conductas facultará a esta parte para invocar las causales de término de contrato de trabajo establecidas en el Artículo 160 del Código del Trabajo, sin derecho a indemnización alguna.

Atentamente,

____________________________________
${company.razonSocial}
R.U.T.: ${company.rut}
EMPLEADOR`;

    const newSanction: DisciplinarySanction = {
      id: `sanct-${Date.now()}`,
      employeeId: emp.id,
      rut: emp.rut,
      nombreCompleto: emp.nombreCompleto,
      fechaInfraccion: formData.fechaInfraccion,
      fechaEmision: new Date().toISOString().split('T')[0],
      tipo: formData.tipo,
      motivoInfraccion: formData.motivoInfraccion,
      articuloRiohs: formData.articuloRiohs,
      montoMulta: formData.tipo === 'MULTA_REGLAMENTO_INTERNO' ? montoMultaFinal : undefined,
      destinatarioMulta: formData.tipo === 'MULTA_REGLAMENTO_INTERNO' ? 'Fondo de Bienestar de los Trabajadores (Art. 157)' : undefined,
      notificadoAlTrabajador: true,
      fechaNotificacion: new Date().toISOString().split('T')[0],
      remitidoInspeccionDelTrabajo: formData.remitidoInspeccionDelTrabajo,
      folioConstanciaDt: formData.remitidoInspeccionDelTrabajo ? `CONST-DT-${Date.now().toString().slice(-6)}` : undefined,
      estado: formData.remitidoInspeccionDelTrabajo ? 'REGISTRADO_DT' : 'NOTIFICADO',
      textoCartaFormal: carta,
    };

    onAddSanction(newSanction);
    setShowNewModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Sanciones Emitidas</span>
            <Scale className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">{totalSanctions}</div>
          <div className="text-[11px] text-slate-500 mt-1">
            Conforme al RIOHS de la empresa
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Con Copia a Inspección DT</span>
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-indigo-700 mt-2">
            {sanctionsWithDtCopy}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Respaldo para causales Art. 160
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Multas RIOHS Aplicadas</span>
            <FileWarning className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-black text-rose-700 mt-2">
            {formatCLP(totalMultas)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Destinado a Fondo de Bienestar (Art. 157)
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Límite Legal Multas (Art. 157)</span>
            <Scale className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-2">
            Tope 25%
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            De la remuneración diaria del infractor
          </div>
        </div>
      </div>

      {/* Control Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-extrabold text-slate-900 text-sm sm:text-base flex items-center gap-2">
            <Scale className="w-5 h-5 text-amber-600" />
            <span>Régimen Disciplinario & Amonestaciones RIOHS (Dirección del Trabajo)</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Amonestaciones verbales, escritas y con copia a la Inspección Comunal del Trabajo, garantizando el debido proceso y topes legales del Art. 157.
          </p>
        </div>

        <button
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Emitir Amonestación / Multa</span>
        </button>
      </div>

      {/* Sanctions Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-[11px]">
              <tr>
                <th className="px-4 py-3">Fecha / Trabajador</th>
                <th className="px-4 py-3">Tipo de Medida Disciplinaria</th>
                <th className="px-4 py-3">Motivo & Artículo RIOHS</th>
                <th className="px-4 py-3 text-center">Multa ($)</th>
                <th className="px-4 py-3 text-center">Copia Inspección DT</th>
                <th className="px-4 py-3 text-center">Estado Notificación</th>
                <th className="px-4 py-3 text-center">Carta Formal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sanctions.map((sanction) => (
                <tr key={sanction.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-mono text-slate-800 font-semibold">{sanction.fechaEmision}</div>
                    <div className="font-bold text-slate-900 mt-0.5">{sanction.nombreCompleto}</div>
                    <div className="text-[11px] text-slate-500 font-mono">{sanction.rut}</div>
                  </td>

                  <td className="px-4 py-3">
                    <span className="inline-block text-[10px] px-2 py-0.5 rounded-md font-bold uppercase bg-amber-100 text-amber-900 border border-amber-300">
                      {sanction.tipo.replace(/_/g, ' ')}
                    </span>
                  </td>

                  <td className="px-4 py-3 max-w-xs">
                    <div className="text-slate-800 font-medium line-clamp-2">{sanction.motivoInfraccion}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5 font-mono">{sanction.articuloRiohs}</div>
                  </td>

                  <td className="px-4 py-3 text-center font-mono font-bold">
                    {sanction.montoMulta ? (
                      <span className="text-rose-700">{formatCLP(sanction.montoMulta)}</span>
                    ) : (
                      <span className="text-slate-400 font-normal">Sin multa</span>
                    )}
                  </td>

                  <td className="px-4 py-3 text-center">
                    {sanction.remitidoInspeccionDelTrabajo ? (
                      <div>
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-bold text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Remitido a DT</span>
                        </span>
                        {sanction.folioConstanciaDt && (
                          <div className="text-[9px] text-slate-400 font-mono">{sanction.folioConstanciaDt}</div>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-400 text-[11px]">Interna</span>
                    )}
                  </td>

                  <td className="px-4 py-3 text-center">
                    <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">
                      {sanction.estado}
                    </span>
                  </td>

                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => setShowPrintModal(sanction)}
                      className="p-1.5 bg-white hover:bg-slate-50 text-blue-600 rounded border border-slate-300 shadow-xs cursor-pointer inline-flex items-center gap-1 text-[11px] font-semibold"
                      title="Ver / Imprimir Carta Formal de Amonestación"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Ver Carta</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Carta de Amonestación Oficial */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-150">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <h3 className="font-bold text-white text-sm sm:text-base flex items-center gap-2">
                <FileWarning className="w-5 h-5 text-amber-400" />
                <span>Carta de Amonestación Laboral Oficial</span>
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir / PDF</span>
                </button>
                <button
                  onClick={() => setShowPrintModal(null)}
                  className="text-slate-400 hover:text-white p-1 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-8 overflow-y-auto space-y-4 font-serif text-xs leading-relaxed text-slate-900 bg-white">
              <pre className="font-serif whitespace-pre-wrap text-slate-900 text-xs leading-relaxed">
                {showPrintModal.textoCartaFormal}
              </pre>

              <div className="pt-8 grid grid-cols-2 gap-10 text-center font-sans text-[10px] text-slate-600">
                <div className="border-t border-slate-300 pt-2">
                  <strong>{company.razonSocial}</strong>
                  <br />Firma y Timbre Empleador
                </div>
                <div className="border-t border-slate-300 pt-2">
                  <strong>{showPrintModal.nombreCompleto}</strong>
                  <br />RUT: {showPrintModal.rut}
                  <br />Firma Trabajador (Toma de Conocimiento)
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Emitir Nueva Sanción */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-150">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <h3 className="font-bold text-white text-sm sm:text-base flex items-center gap-2">
                <Scale className="w-5 h-5 text-amber-400" />
                <span>Aplicar Medida Disciplinaria RIOHS</span>
              </h3>
              <button
                onClick={() => setShowNewModal(false)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSanction} className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Colaborador Sancionado:</label>
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
                  <label className="block font-semibold text-slate-700 mb-1">Tipo de Sanción:</label>
                  <select
                    value={formData.tipo}
                    onChange={(e) => setFormData({ ...formData, tipo: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 font-semibold"
                  >
                    <option value="AMONESTACION_ESCRITA_CON_COPIA_DT">Amonestación Escrita con Copia a la DT</option>
                    <option value="AMONESTACION_ESCRITA">Amonestación Escrita Interna</option>
                    <option value="AMONESTACION_VERBAL">Amonestación Verbal</option>
                    <option value="MULTA_REGLAMENTO_INTERNO">Multa Reglamentaria RIOHS (Art. 157)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Fecha de la Infracción:</label>
                  <input
                    type="date"
                    required
                    value={formData.fechaInfraccion}
                    onChange={(e) => setFormData({ ...formData, fechaInfraccion: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Artículo del RIOHS Infringido:</label>
                  <input
                    type="text"
                    required
                    value={formData.articuloRiohs}
                    onChange={(e) => setFormData({ ...formData, articuloRiohs: e.target.value })}
                    placeholder="Ej: Art. 19 y 48 sobre asistencia laboral"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900"
                  />
                </div>
              </div>

              {formData.tipo === 'MULTA_REGLAMENTO_INTERNO' && (
                <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                  <label className="block font-semibold text-amber-900 mb-1">Monto de la Multa ($):</label>
                  <input
                    type="number"
                    value={formData.montoMulta}
                    onChange={(e) => setFormData({ ...formData, montoMulta: Number(e.target.value) })}
                    className="w-full bg-white border border-amber-300 rounded-lg p-2 font-mono font-bold text-amber-900"
                  />
                  <div className="text-[10px] text-amber-700 mt-1">
                    Tope Legal Art. 157: Máximo 25% del sueldo diario del trabajador. Destinado íntegramente a Fondo de Bienestar.
                  </div>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Descripción Circunstanciada de los Hechos:</label>
                <textarea
                  rows={3}
                  required
                  value={formData.motivoInfraccion}
                  onChange={(e) => setFormData({ ...formData, motivoInfraccion: e.target.value })}
                  placeholder="Detallar hechos precisos, fechas, horas y testigos de la falta cometida..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 leading-relaxed"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="copiaDtCheck"
                  checked={formData.remitidoInspeccionDelTrabajo}
                  onChange={(e) => setFormData({ ...formData, remitidoInspeccionDelTrabajo: e.target.checked })}
                  className="rounded text-amber-600 focus:ring-amber-500"
                />
                <label htmlFor="copiaDtCheck" className="text-slate-700 font-semibold">
                  Remitir copia electrónica a la Inspección Comunal del Trabajo (Mi DT)
                </label>
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
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold shadow-xs cursor-pointer"
                >
                  Emitir Amonestación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
