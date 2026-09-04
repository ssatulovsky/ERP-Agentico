import React, { useState } from 'react';
import { 
  FileText, 
  Plus, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Calendar, 
  Building, 
  User, 
  DollarSign, 
  Briefcase, 
  Printer, 
  X, 
  ShieldCheck,
  ChevronRight,
  Send,
  Download
} from 'lucide-react';
import { LaborContract, LaborContractType, CompanyProfile } from '../../types';
import { formatCLP, formatNumberCL } from '../../utils/chileanAccounting';

interface ContractsManagerProps {
  contracts: LaborContract[];
  onAddContract: (contract: LaborContract) => void;
  onUpdateContract: (contract: LaborContract) => void;
  company: CompanyProfile;
}

export const ContractsManager: React.FC<ContractsManagerProps> = ({
  contracts,
  onAddContract,
  onUpdateContract,
  company,
}) => {
  const [selectedContract, setSelectedContract] = useState<LaborContract | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [filterType, setFilterType] = useState<string>('TODOS');
  const [showPrintModal, setShowPrintModal] = useState<LaborContract | null>(null);

  // Form state for new contract
  const [formData, setFormData] = useState<Partial<LaborContract>>({
    nombreCompleto: '',
    rut: '',
    nacionalidad: 'Chilena',
    estadoCivil: 'Soltero(a)',
    fechaNacimiento: '1995-01-01',
    domicilio: '',
    comuna: 'Santiago',
    cargo: '',
    departamento: 'Operaciones',
    tipoContrato: 'INDEFINIDO',
    fechaInicio: new Date().toISOString().split('T')[0],
    sueldoBase: 1200000,
    jornadaHorasSemanales: 44,
    distribucionJornada: 'Lunes a Jueves de 08:30 a 18:30 hrs y Viernes de 08:30 a 16:30 hrs',
    lugarTrabajo: company.direccion + ', ' + company.comuna,
    gratificacionModalidad: 'ART_50',
    asignacionColacion: 80000,
    asignacionMovilizacion: 70000,
    clausulaConfidencialidad: true,
    clausulaTeletrabajo: false,
    registradoDtRel: false,
  });

  const filteredContracts = contracts.filter(c => {
    if (filterType === 'TODOS') return true;
    if (filterType === 'POR_VENCER') return c.estado === 'POR_VENCER';
    return c.tipoContrato === filterType;
  });

  const expiringCount = contracts.filter(c => c.estado === 'POR_VENCER').length;
  const indefiniteCount = contracts.filter(c => c.tipoContrato === 'INDEFINIDO').length;
  const relRegisteredCount = contracts.filter(c => c.registradoDtRel).length;

  const handleCreateContract = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombreCompleto || !formData.rut || !formData.cargo) return;

    const newContract: LaborContract = {
      id: `ctr-${Date.now()}`,
      employeeId: `emp-${Date.now()}`,
      rut: formData.rut,
      nombreCompleto: formData.nombreCompleto,
      nacionalidad: formData.nacionalidad || 'Chilena',
      estadoCivil: formData.estadoCivil || 'Soltero(a)',
      fechaNacimiento: formData.fechaNacimiento || '1995-01-01',
      domicilio: formData.domicilio || 'Av. Providencia 1200',
      comuna: formData.comuna || 'Providencia',
      cargo: formData.cargo,
      departamento: formData.departamento || 'Operaciones',
      tipoContrato: formData.tipoContrato as LaborContractType || 'INDEFINIDO',
      fechaInicio: formData.fechaInicio || new Date().toISOString().split('T')[0],
      fechaTermino: formData.tipoContrato === 'PLAZO_FIJO' ? formData.fechaTermino : undefined,
      sueldoBase: Number(formData.sueldoBase) || 1000000,
      jornadaHorasSemanales: Number(formData.jornadaHorasSemanales) || 44,
      distribucionJornada: formData.distribucionJornada || 'Lunes a Viernes de 08:30 a 18:00 hrs',
      lugarTrabajo: formData.lugarTrabajo || company.direccion,
      gratificacionModalidad: 'ART_50',
      asignacionColacion: Number(formData.asignacionColacion) || 80000,
      asignacionMovilizacion: Number(formData.asignacionMovilizacion) || 70000,
      estado: formData.tipoContrato === 'PLAZO_FIJO' ? 'POR_VENCER' : 'VIGENTE',
      registradoDtRel: !!formData.registradoDtRel,
      folioRegistroDt: formData.registradoDtRel ? `REL-${Date.now().toString().slice(-6)}-DT` : undefined,
      anexos: [],
      clausulaConfidencialidad: !!formData.clausulaConfidencialidad,
      clausulaTeletrabajo: !!formData.clausulaTeletrabajo,
      observaciones: formData.observaciones || '',
    };

    onAddContract(newContract);
    setShowNewModal(false);
  };

  const handleRegisterRel = (contract: LaborContract) => {
    const updated: LaborContract = {
      ...contract,
      registradoDtRel: true,
      folioRegistroDt: `REL-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}-DT`,
    };
    onUpdateContract(updated);
  };

  const handleRenewToIndefinite = (contract: LaborContract) => {
    const updated: LaborContract = {
      ...contract,
      tipoContrato: 'INDEFINIDO',
      estado: 'RENOVADO_INDEFINIDO',
      fechaTermino: undefined,
      anexos: [
        ...contract.anexos,
        {
          id: `anx-${Date.now()}`,
          contratoId: contract.id,
          fecha: new Date().toISOString().split('T')[0],
          tipo: 'CAMBIO_SUELDO',
          descripcion: 'Paso formal a Contrato Indefinido conforme al Artículo 159 N° 4 del Código del Trabajo.',
          registradoDtRel: true,
          folioRegistroDt: `ANX-INDEF-${Date.now().toString().slice(-5)}`,
        }
      ]
    };
    onUpdateContract(updated);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Total Contratos Activos</span>
            <Briefcase className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">{contracts.length}</div>
          <div className="text-[11px] text-slate-500 mt-1">
            {indefiniteCount} Indefinidos ({Math.round((indefiniteCount / (contracts.length || 1)) * 100)}%)
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Plazos Fijos por Vencer</span>
            <AlertTriangle className={`w-4 h-4 ${expiringCount > 0 ? 'text-amber-600' : 'text-slate-400'}`} />
          </div>
          <div className={`text-2xl font-black mt-2 ${expiringCount > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
            {expiringCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Atención: Art. 159 N° 4 Código del Trabajo
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Registro Electrónico (REL DT)</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-2">
            {relRegisteredCount} / {contracts.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Ley 21.327 de Modernización de la DT
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Jornada Legal 40/44 Horas</span>
            <Clock className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-indigo-700 mt-2">
            100%
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Adecuados al límite legal Ley 21.561
          </div>
        </div>
      </div>

      {/* Control Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-extrabold text-slate-900 text-sm sm:text-base flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <span>Gestión de Contratos de Trabajo & Anexos (Dirección del Trabajo)</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Cumplimiento estricto del Art. 10 del Código del Trabajo, registro en portal Mi DT (REL) y vigilancia de plazos fijos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Filter dropdown */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-slate-50 border border-slate-300 text-slate-700 text-xs rounded-lg px-3 py-1.5 font-medium"
          >
            <option value="TODOS">Todos los Contratos</option>
            <option value="POR_VENCER">⚠️ Alertas de Vencimiento</option>
            <option value="INDEFINIDO">Contratos Indefinidos</option>
            <option value="PLAZO_FIJO">Contratos a Plazo Fijo</option>
            <option value="POR_OBRA_FAENA">Por Obra o Faena</option>
          </select>

          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Contrato / Anexo</span>
          </button>
        </div>
      </div>

      {/* Contracts Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-[11px]">
              <tr>
                <th className="px-4 py-3">Trabajador / RUT</th>
                <th className="px-4 py-3">Cargo & Departamento</th>
                <th className="px-4 py-3">Modalidad / Vigencia</th>
                <th className="px-4 py-3 text-right">Sueldo Base</th>
                <th className="px-4 py-3 text-center">Jornada Semanal</th>
                <th className="px-4 py-3 text-center">Registro REL DT</th>
                <th className="px-4 py-3 text-center">Estado Legal</th>
                <th className="px-4 py-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredContracts.map((contract) => {
                const isExpiring = contract.estado === 'POR_VENCER';
                return (
                  <tr key={contract.id} className={`hover:bg-slate-50/80 transition-colors ${isExpiring ? 'bg-amber-50/40' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-900">{contract.nombreCompleto}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{contract.rut}</div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="text-slate-800 font-medium">{contract.cargo}</div>
                      <div className="text-[10px] text-slate-500">{contract.departamento}</div>
                    </td>

                    <td className="px-4 py-3">
                      <span className={`inline-block text-[10px] px-2 py-0.5 rounded-md font-bold uppercase ${
                        contract.tipoContrato === 'INDEFINIDO' 
                          ? 'bg-blue-100 text-blue-800 border border-blue-200'
                          : 'bg-amber-100 text-amber-900 border border-amber-300'
                      }`}>
                        {contract.tipoContrato === 'INDEFINIDO' ? 'Indefinido' : 'Plazo Fijo'}
                      </span>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                        Inicio: {contract.fechaInicio}
                        {contract.fechaTermino && (
                          <span className="text-rose-700 font-bold ml-1">
                            • Fin: {contract.fechaTermino}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                      {formatCLP(contract.sueldoBase)}
                    </td>

                    <td className="px-4 py-3 text-center">
                      <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        {contract.jornadaHorasSemanales} hrs/sem
                      </span>
                      {contract.jornadaHorasSemanales <= 40 && (
                        <div className="text-[9px] text-emerald-700 font-bold mt-0.5">Ley 40 Horas OK</div>
                      )}
                    </td>

                    <td className="px-4 py-3 text-center">
                      {contract.registradoDtRel ? (
                        <div className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Registrado DT</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleRegisterRel(contract)}
                          className="inline-flex items-center gap-1 text-[10px] bg-amber-100 hover:bg-amber-200 text-amber-800 font-semibold px-2 py-1 rounded cursor-pointer transition-colors"
                          title="Enviar Registro Electrónico Laboral a la DT"
                        >
                          <Send className="w-3 h-3" />
                          <span>Pendiente REL</span>
                        </button>
                      )}
                      {contract.folioRegistroDt && (
                        <div className="text-[9px] text-slate-400 font-mono">{contract.folioRegistroDt}</div>
                      )}
                    </td>

                    <td className="px-4 py-3 text-center">
                      {isExpiring ? (
                        <div className="inline-flex items-center gap-1 bg-rose-100 border border-rose-300 text-rose-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
                          <AlertTriangle className="w-3 h-3 text-rose-600" />
                          <span>Por Vencer</span>
                        </div>
                      ) : (
                        <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold">
                          Vigente
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setShowPrintModal(contract)}
                          className="p-1.5 bg-white hover:bg-slate-50 text-blue-600 rounded border border-slate-300 shadow-xs cursor-pointer"
                          title="Ver / Imprimir Contrato de Trabajo Oficial"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>

                        {isExpiring && (
                          <button
                            onClick={() => handleRenewToIndefinite(contract)}
                            className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold shadow-xs cursor-pointer"
                            title="Pasar legalmente a Contrato Indefinido (Art. 159 N° 4)"
                          >
                            Renovar Indefinido
                          </button>
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

      {/* Modal: Ver e Imprimir Contrato de Trabajo Oficial */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-3xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-150">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-white text-sm sm:text-base">
                  Contrato Individual de Trabajo (Art. 10 Código del Trabajo de Chile)
                </h3>
              </div>
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

            <div className="p-6 overflow-y-auto space-y-4 text-xs font-serif leading-relaxed text-slate-900 bg-white">
              <div className="text-center pb-4 border-b border-slate-200">
                <div className="font-bold text-sm tracking-widest uppercase">CONTRATO INDIVIDUAL DE TRABAJO</div>
                <div className="text-[11px] text-slate-500 font-sans mt-1">
                  En conformidad al Artículo 10 y siguientes del Código del Trabajo de la República de Chile
                </div>
              </div>

              <p>
                En <strong>{company.ciudad}</strong>, a <strong>{showPrintModal.fechaInicio}</strong>, entre <strong>{company.razonSocial}</strong>, R.U.T. N° <strong>{company.rut}</strong>, representada legalmente por don(ña) <strong>{company.contactoNombre || 'Representante Legal'}</strong>, domiciliados para estos efectos en <strong>{company.direccion}</strong>, comuna de <strong>{company.comuna}</strong>, en adelante el «EMPLEADOR»; y don(ña) <strong>{showPrintModal.nombreCompleto}</strong>, nacionalidad <strong>{showPrintModal.nacionalidad}</strong>, estado civil <strong>{showPrintModal.estadoCivil}</strong>, cédula nacional de identidad N° <strong>{showPrintModal.rut}</strong>, nacido(a) el <strong>{showPrintModal.fechaNacimiento}</strong>, domiciliado(a) en <strong>{showPrintModal.domicilio}</strong>, comuna de <strong>{showPrintModal.comuna}</strong>, en adelante el «TRABAJADOR», se ha convenido el siguiente Contrato de Trabajo:
              </p>

              <div>
                <strong className="block font-sans font-bold text-slate-900 uppercase text-[11px] mb-1">
                  PRIMERO: Funciones y Cargo.
                </strong>
                El TRABAJADOR se compromete a desempeñar las funciones correspondientes al cargo de <strong>{showPrintModal.cargo}</strong> en el departamento de <strong>{showPrintModal.departamento}</strong>, cumpliendo fielmente las instrucciones de su jefatura directa y las normas del Reglamento Interno de Orden, Higiene y Seguridad de la empresa.
              </div>

              <div>
                <strong className="block font-sans font-bold text-slate-900 uppercase text-[11px] mb-1">
                  SEGUNDO: Lugar de Prestación de Servicios.
                </strong>
                Los servicios serán prestados principalmente en <strong>{showPrintModal.lugarTrabajo}</strong>, sin perjuicio de la facultad que confiere el Artículo 12 del Código del Trabajo (ius variandi).
              </div>

              <div>
                <strong className="block font-sans font-bold text-slate-900 uppercase text-[11px] mb-1">
                  TERCERO: Jornada de Trabajo (Ley N° 21.561).
                </strong>
                La jornada ordinaria de trabajo será de <strong>{showPrintModal.jornadaHorasSemanales} horas semanales</strong>, distribuida en la siguiente forma: <em>{showPrintModal.distribucionJornada}</em>.
              </div>

              <div>
                <strong className="block font-sans font-bold text-slate-900 uppercase text-[11px] mb-1">
                  CUARTO: Remuneraciones y Beneficios.
                </strong>
                El EMPLEADOR pagará al TRABAJADOR una remuneración compuesta de:
                <ul className="list-disc pl-5 mt-1 space-y-0.5">
                  <li>Sueldo Base mensual de <strong>{formatCLP(showPrintModal.sueldoBase)}</strong>.</li>
                  <li>Gratificación Legal con arreglo a la modalidad del Artículo 50 del Código del Trabajo (25% de lo devengado con tope legal de 4.75 ingresos mínimos mensuales).</li>
                  <li>Asignación no imponible de Colación de <strong>{formatCLP(showPrintModal.asignacionColacion)}</strong>.</li>
                  <li>Asignación no imponible de Movilización de <strong>{formatCLP(showPrintModal.asignacionMovilizacion)}</strong>.</li>
                </ul>
              </div>

              <div>
                <strong className="block font-sans font-bold text-slate-900 uppercase text-[11px] mb-1">
                  QUINTO: Duración del Contrato.
                </strong>
                El presente contrato tendrá una duración de carácter <strong>{showPrintModal.tipoContrato === 'INDEFINIDO' ? 'INDEFINIDA' : `PLAZO FIJO con vencimiento el ${showPrintModal.fechaTermino}`}</strong>, rigiendo a contar del <strong>{showPrintModal.fechaInicio}</strong>.
              </div>

              <div className="pt-8 grid grid-cols-2 gap-10 text-center font-sans text-[11px] text-slate-600">
                <div className="border-t border-slate-300 pt-2">
                  <strong>{company.razonSocial}</strong>
                  <br />RUT: {company.rut}
                  <br />EMPLEADOR
                </div>
                <div className="border-t border-slate-300 pt-2">
                  <strong>{showPrintModal.nombreCompleto}</strong>
                  <br />RUT: {showPrintModal.rut}
                  <br />TRABAJADOR
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Nuevo Contrato */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-150">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <h3 className="font-bold text-white text-sm sm:text-base flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-400" />
                <span>Formalizar Nuevo Contrato de Trabajo</span>
              </h3>
              <button
                onClick={() => setShowNewModal(false)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateContract} className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nombre Completo:</label>
                  <input
                    type="text"
                    required
                    value={formData.nombreCompleto}
                    onChange={(e) => setFormData({ ...formData, nombreCompleto: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 font-medium"
                    placeholder="Ej: Carolina Andrea Muñoz Silva"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">RUT:</label>
                  <input
                    type="text"
                    required
                    value={formData.rut}
                    onChange={(e) => setFormData({ ...formData, rut: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono text-slate-900"
                    placeholder="18.920.312-5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Cargo:</label>
                  <input
                    type="text"
                    required
                    value={formData.cargo}
                    onChange={(e) => setFormData({ ...formData, cargo: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900"
                    placeholder="Ej: Contador Auditor"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Departamento:</label>
                  <select
                    value={formData.departamento}
                    onChange={(e) => setFormData({ ...formData, departamento: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900"
                  >
                    <option value="Operaciones">Operaciones</option>
                    <option value="Finanzas & Contabilidad">Finanzas & Contabilidad</option>
                    <option value="Tecnología & TI">Tecnología & TI</option>
                    <option value="Ventas & Comercial">Ventas & Comercial</option>
                    <option value="Recursos Humanos">Recursos Humanos</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tipo de Contrato:</label>
                  <select
                    value={formData.tipoContrato}
                    onChange={(e) => setFormData({ ...formData, tipoContrato: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 font-semibold"
                  >
                    <option value="INDEFINIDO">Indefinido</option>
                    <option value="PLAZO_FIJO">Plazo Fijo (Con fecha término)</option>
                    <option value="POR_OBRA_FAENA">Por Obra o Faena</option>
                    <option value="PART_TIME">Part-Time (Jornada Parcial)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Fecha de Inicio:</label>
                  <input
                    type="date"
                    required
                    value={formData.fechaInicio}
                    onChange={(e) => setFormData({ ...formData, fechaInicio: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 font-mono"
                  />
                </div>
                {formData.tipoContrato === 'PLAZO_FIJO' && (
                  <div>
                    <label className="block font-semibold text-rose-700 mb-1">Fecha de Término:</label>
                    <input
                      type="date"
                      required
                      value={formData.fechaTermino || ''}
                      onChange={(e) => setFormData({ ...formData, fechaTermino: e.target.value })}
                      className="w-full bg-rose-50 border border-rose-300 rounded-lg p-2 text-rose-900 font-mono"
                    />
                  </div>
                )}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Sueldo Base ($):</label>
                  <input
                    type="number"
                    required
                    value={formData.sueldoBase}
                    onChange={(e) => setFormData({ ...formData, sueldoBase: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono font-bold text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Jornada Horas Semanales:</label>
                  <input
                    type="number"
                    value={formData.jornadaHorasSemanales}
                    onChange={(e) => setFormData({ ...formData, jornadaHorasSemanales: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono text-slate-900"
                    placeholder="44 o 40"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Lugar de Prestación:</label>
                  <input
                    type="text"
                    value={formData.lugarTrabajo}
                    onChange={(e) => setFormData({ ...formData, lugarTrabajo: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900"
                  />
                </div>
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
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-xs cursor-pointer"
                >
                  Generar Contrato & Registrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
