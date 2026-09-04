import React, { useState } from 'react';
import { 
  Users, 
  UserPlus, 
  FileText, 
  FileCode, 
  CheckCircle2, 
  Copy, 
  Check, 
  Printer, 
  Building2, 
  DollarSign, 
  Briefcase,
  Shield,
  X,
  Edit2,
  Trash2
} from 'lucide-react';
import { EmployeePayroll, ChileIndicators, AccountingEntry, CompanyProfile } from '../types';
import { 
  formatCLP, 
  formatNumberCL, 
  formatNormalizedAccountingEntry,
  calculatePayroll,
  createPayrollCentralizationEntry
} from '../utils/chileanAccounting';

interface PayrollManagerProps {
  payrolls: EmployeePayroll[];
  onAddEmployee: (emp: EmployeePayroll) => void;
  onUpdateEmployee: (emp: EmployeePayroll) => void;
  onDeleteEmployee: (id: string) => void;
  indicators: ChileIndicators;
  company: CompanyProfile;
  onAddEntry: (entry: AccountingEntry) => void;
}

export const PayrollManager: React.FC<PayrollManagerProps> = ({
  payrolls,
  onAddEmployee,
  onUpdateEmployee,
  onDeleteEmployee,
  indicators,
  company,
  onAddEntry,
}) => {
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeePayroll | null>(null);
  const [selectedPayslip, setSelectedPayslip] = useState<EmployeePayroll | null>(null);
  const [viewEntryModal, setViewEntryModal] = useState<AccountingEntry | null>(null);
  const [copied, setCopied] = useState(false);

  // Form state
  const [formData, setFormData] = useState<Partial<EmployeePayroll>>({
    nombreCompleto: '',
    rut: '',
    cargo: '',
    departamento: 'Operaciones',
    fechaIngreso: new Date().toISOString().split('T')[0],
    tipoContrato: 'INDEFINIDO',
    sueldoBase: 1200000,
    gratificacionModalidad: 'ART_50',
    horasExtrasCantidad: 0,
    comisionesBonosImponibles: 0,
    asignacionColacion: 80000,
    asignacionMovilizacion: 70000,
    afpNombre: 'HABITAT',
    saludTipo: 'FONASA',
    saludPlanUf: 0,
    otrosDescuentos: 0,
  });

  // Calculate totals for summary cards
  const totalSueldosLiquidos = payrolls.reduce((s, p) => s + p.sueldoLiquido, 0);
  const totalImponible = payrolls.reduce((s, p) => s + p.totalHaberesImponibles, 0);
  const totalDescuentosPrevisionales = payrolls.reduce((s, p) => s + p.afpMonto + p.saludMonto + p.afcTrabajadorMonto, 0);
  const totalImpuestoUnico = payrolls.reduce((s, p) => s + p.impuestoUnicoMonto, 0);
  const totalAportesPatronales = payrolls.reduce((s, p) => s + p.sisEmpleadorMonto + p.mutualEmpleadorMonto + p.afcEmpleadorMonto, 0);
  const totalCostoEmpresa = payrolls.reduce((s, p) => s + p.costoTotalEmpresa, 0);

  const handleOpenAddModal = () => {
    setEditingEmployee(null);
    setFormData({
      nombreCompleto: '',
      rut: '',
      cargo: '',
      departamento: 'Operaciones',
      fechaIngreso: new Date().toISOString().split('T')[0],
      tipoContrato: 'INDEFINIDO',
      sueldoBase: 1200000,
      gratificacionModalidad: 'ART_50',
      horasExtrasCantidad: 0,
      comisionesBonosImponibles: 0,
      asignacionColacion: 80000,
      asignacionMovilizacion: 70000,
      afpNombre: 'HABITAT',
      saludTipo: 'FONASA',
      saludPlanUf: 0,
      otrosDescuentos: 0,
    });
    setShowEmployeeModal(true);
  };

  const handleOpenEditModal = (emp: EmployeePayroll) => {
    setEditingEmployee(emp);
    setFormData(emp);
    setShowEmployeeModal(true);
  };

  const handleSaveEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombreCompleto || !formData.rut) return;

    const calculated = calculatePayroll(
      {
        ...formData,
        id: editingEmployee ? editingEmployee.id : `emp-${Date.now()}`,
      },
      indicators
    );

    if (editingEmployee) {
      onUpdateEmployee(calculated);
    } else {
      onAddEmployee(calculated);
    }

    setShowEmployeeModal(false);
  };

  const handleGenerateCentralizationEntry = () => {
    const currentPeriod = new Date().toISOString().substring(0, 7);
    const entry = createPayrollCentralizationEntry(payrolls, currentPeriod);
    onAddEntry(entry);
    setViewEntryModal(entry);
  };

  const copyNormalizedText = (entry: AccountingEntry) => {
    const text = formatNormalizedAccountingEntry(entry);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top 4 Geometric Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Sueldos Líquidos a Pagar */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Líquido a Pagar (Colaboradores)</span>
            <div className="p-1.5 rounded-md bg-emerald-50 text-emerald-600 border border-emerald-200">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-[#0f172a]">{formatCLP(totalSueldosLiquidos)}</div>
          <div className="mt-1 text-xs text-slate-500">
            {payrolls.length} colaboradores activos en nómina
          </div>
        </div>

        {/* Total Imponible */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Masa Imponible Bruta</span>
            <div className="p-1.5 rounded-md bg-blue-50 text-blue-600 border border-blue-200">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-[#0f172a]">{formatCLP(totalImponible)}</div>
          <div className="mt-1 text-xs text-slate-500">
            Base cálculo AFP, Salud, AFC y Gratificación
          </div>
        </div>

        {/* Previred & Retenciones F29 */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Leyes Sociales + Retención</span>
            <div className="p-1.5 rounded-md bg-purple-50 text-purple-600 border border-purple-200">
              <Shield className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-[#0f172a]">
            {formatCLP(totalDescuentosPrevisionales + totalAportesPatronales + totalImpuestoUnico)}
          </div>
          <div className="mt-1 text-xs text-slate-500 flex justify-between font-mono">
            <span>Imp. Único (F29):</span>
            <span className="text-purple-700 font-bold">{formatCLP(totalImpuestoUnico)}</span>
          </div>
        </div>

        {/* Costo Total Empleador */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Costo Total Empresa</span>
            <div className="p-1.5 rounded-md bg-amber-50 text-amber-600 border border-amber-200">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-700">{formatCLP(totalCostoEmpresa)}</div>
          <div className="mt-1 text-xs text-slate-500 flex justify-between font-mono">
            <span>Aporte Patronal (SIS/Mut/AFC):</span>
            <span className="text-amber-800 font-bold">{formatCLP(totalAportesPatronales)}</span>
          </div>
        </div>
      </div>

      {/* Control Header: Add Employee & Centralization Action */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-extrabold text-[#0f172a] text-sm sm:text-base flex items-center gap-2">
            <Users className="w-5 h-5 text-[#2563eb]" />
            <span>Libro de Remuneraciones & Nómina Laboral Chilena</span>
          </h3>
          <p className="text-xs text-slate-500 font-medium">
            Cálculo automatizado con Gratificación Art. 50 (tope 4.75 IMM), AFC, AFP, Isapre/Fonasa e Impuesto Único en UTM.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleGenerateCentralizationEntry}
            className="flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer shadow-xs"
          >
            <FileCode className="w-4 h-4 text-[#2563eb]" />
            <span>Centralizar Remuneraciones (Asiento Normalizado)</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-1.5 bg-[#2563eb] hover:bg-blue-600 text-white px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors shadow-xs cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Agregar Colaborador</span>
          </button>
        </div>
      </div>

      {/* Payroll Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-[#f1f5f9] text-slate-600 font-semibold border-b border-slate-200 text-[11px]">
              <tr>
                <th className="px-4 py-3">Colaborador / RUT</th>
                <th className="px-4 py-3">Cargo & Contrato</th>
                <th className="px-4 py-3 text-right">Sueldo Base</th>
                <th className="px-4 py-3 text-right">Gratificación Art. 50</th>
                <th className="px-4 py-3 text-right">Total Imponible</th>
                <th className="px-4 py-3">Previsión / Salud</th>
                <th className="px-4 py-3 text-right">Imp. Único UTM</th>
                <th className="px-4 py-3 text-right">Sueldo Líquido</th>
                <th className="px-4 py-3 text-right">Costo Empresa</th>
                <th className="px-4 py-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {payrolls.map((emp) => (
                <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                  {/* Colaborador */}
                  <td className="px-4 py-3 font-sans">
                    <div className="font-bold text-slate-900">{emp.nombreCompleto}</div>
                    <div className="text-[11px] text-slate-500 font-mono">{emp.rut}</div>
                  </td>

                  {/* Cargo */}
                  <td className="px-4 py-3 font-sans">
                    <div className="text-slate-800 font-medium">{emp.cargo}</div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 font-semibold">
                      {emp.tipoContrato === 'INDEFINIDO' ? 'Indefinido' : 'Plazo Fijo'}
                    </span>
                  </td>

                  {/* Sueldo Base */}
                  <td className="px-4 py-3 text-right text-slate-800 font-medium">
                    {formatNumberCL(emp.sueldoBase)}
                  </td>

                  {/* Gratificación */}
                  <td className="px-4 py-3 text-right text-emerald-700 font-bold">
                    +{formatNumberCL(emp.gratificacionMonto)}
                  </td>

                  {/* Total Imponible */}
                  <td className="px-4 py-3 text-right text-blue-700 font-black">
                    {formatNumberCL(emp.totalHaberesImponibles)}
                  </td>

                  {/* Previsión */}
                  <td className="px-4 py-3 font-sans text-[11px]">
                    <div className="text-purple-700 font-mono font-semibold">
                      AFP {emp.afpNombre} ({(emp.afpTasa * 100).toFixed(2)}%)
                    </div>
                    <div className="text-slate-500 font-medium">
                      {emp.saludTipo} {emp.saludPlanUf ? `(${emp.saludPlanUf} UF)` : '(7%)'}
                    </div>
                  </td>

                  {/* Impuesto Único */}
                  <td className="px-4 py-3 text-right font-mono">
                    {emp.impuestoUnicoMonto > 0 ? (
                      <span className="text-amber-700 font-bold">
                        -{formatNumberCL(emp.impuestoUnicoMonto)}
                      </span>
                    ) : (
                      <span className="text-slate-400 font-sans text-[11px]">Exento</span>
                    )}
                  </td>

                  {/* Sueldo Líquido */}
                  <td className="px-4 py-3 text-right font-black text-emerald-700 text-sm">
                    {formatCLP(emp.sueldoLiquido)}
                  </td>

                  {/* Costo Empresa */}
                  <td className="px-4 py-3 text-right font-bold text-[#0f172a]">
                    {formatCLP(emp.costoTotalEmpresa)}
                  </td>

                  {/* Acciones */}
                  <td className="px-4 py-3 text-center font-sans">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => setSelectedPayslip(emp)}
                        className="p-1.5 bg-white hover:bg-slate-50 text-[#2563eb] rounded border border-slate-300 shadow-xs cursor-pointer"
                        title="Ver / Imprimir Liquidación de Sueldo"
                      >
                        <FileText className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleOpenEditModal(emp)}
                        className="p-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded border border-slate-300 shadow-xs cursor-pointer"
                        title="Editar Colaborador"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDeleteEmployee(emp.id)}
                        className="p-1.5 bg-white hover:bg-rose-50 text-rose-600 rounded border border-slate-300 hover:border-rose-300 shadow-xs cursor-pointer"
                        title="Eliminar de Nómina"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: Formulario Colaborador (Nuevo / Editar) */}
      {showEmployeeModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="px-6 py-4 bg-[#0f172a] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-white text-sm sm:text-base">
                  {editingEmployee ? 'Editar Colaborador en Nómina' : 'Registrar Nuevo Colaborador (Ley Laboral)'}
                </h3>
              </div>
              <button
                onClick={() => setShowEmployeeModal(false)}
                className="text-slate-300 hover:text-white text-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEmployee} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Nombre Completo:</label>
                  <input
                    type="text"
                    required
                    value={formData.nombreCompleto}
                    onChange={(e) => setFormData(prev => ({ ...prev, nombreCompleto: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-md p-2 text-slate-900 focus:outline-none focus:border-[#2563eb]"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">RUT:</label>
                  <input
                    type="text"
                    required
                    placeholder="12.345.678-9"
                    value={formData.rut}
                    onChange={(e) => setFormData(prev => ({ ...prev, rut: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-md p-2 font-mono text-slate-900 focus:outline-none focus:border-[#2563eb]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Cargo:</label>
                  <input
                    type="text"
                    value={formData.cargo}
                    onChange={(e) => setFormData(prev => ({ ...prev, cargo: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-md p-2 text-slate-900 focus:outline-none focus:border-[#2563eb]"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Tipo de Contrato:</label>
                  <select
                    value={formData.tipoContrato}
                    onChange={(e) => setFormData(prev => ({ ...prev, tipoContrato: e.target.value as any }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-md p-2 text-slate-900 focus:outline-none focus:border-[#2563eb]"
                  >
                    <option value="INDEFINIDO">Indefinido (AFC 0.6% trab / 2.4% emp)</option>
                    <option value="PLAZO_FIJO">Plazo Fijo (AFC 0.0% trab / 3.0% emp)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Sueldo Base ($):</label>
                  <input
                    type="number"
                    required
                    value={formData.sueldoBase}
                    onChange={(e) => setFormData(prev => ({ ...prev, sueldoBase: Number(e.target.value) }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-md p-2 font-mono text-slate-900 font-bold focus:outline-none focus:border-[#2563eb]"
                  />
                </div>
              </div>

              {/* Haberes variables y no imponibles */}
              <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-3">
                <span className="font-bold text-slate-800 block text-[11px] uppercase tracking-wider">
                  Haberes Adicionales & Asignaciones
                </span>
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <label className="block text-slate-600 text-[10px] font-semibold mb-1">Horas Extras (Cant.):</label>
                    <input
                      type="number"
                      value={formData.horasExtrasCantidad}
                      onChange={(e) => setFormData(prev => ({ ...prev, horasExtrasCantidad: Number(e.target.value) }))}
                      className="w-full bg-white border border-slate-300 rounded-md p-1.5 font-mono text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 text-[10px] font-semibold mb-1">Bonos Imponibles ($):</label>
                    <input
                      type="number"
                      value={formData.comisionesBonosImponibles}
                      onChange={(e) => setFormData(prev => ({ ...prev, comisionesBonosImponibles: Number(e.target.value) }))}
                      className="w-full bg-white border border-slate-300 rounded-md p-1.5 font-mono text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 text-[10px] font-semibold mb-1">Colación (No Imp.):</label>
                    <input
                      type="number"
                      value={formData.asignacionColacion}
                      onChange={(e) => setFormData(prev => ({ ...prev, asignacionColacion: Number(e.target.value) }))}
                      className="w-full bg-white border border-slate-300 rounded-md p-1.5 font-mono text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 text-[10px] font-semibold mb-1">Movilización (No Imp.):</label>
                    <input
                      type="number"
                      value={formData.asignacionMovilizacion}
                      onChange={(e) => setFormData(prev => ({ ...prev, asignacionMovilizacion: Number(e.target.value) }))}
                      className="w-full bg-white border border-slate-300 rounded-md p-1.5 font-mono text-slate-900"
                    />
                  </div>
                </div>
              </div>

              {/* Previsión & Salud */}
              <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-3">
                <span className="font-bold text-slate-800 block text-[11px] uppercase tracking-wider">
                  Institución Previsional (AFP) y Salud (Fonasa / Isapre)
                </span>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-600 text-[10px] font-semibold mb-1">AFP:</label>
                    <select
                      value={formData.afpNombre}
                      onChange={(e) => setFormData(prev => ({ ...prev, afpNombre: e.target.value as any }))}
                      className="w-full bg-white border border-slate-300 rounded-md p-1.5 text-slate-900"
                    >
                      <option value="HABITAT">Habitat (11.27%)</option>
                      <option value="CUPRUM">Cuprum (11.44%)</option>
                      <option value="CAPITAL">Capital (11.44%)</option>
                      <option value="PROVIDA">Provida (11.45%)</option>
                      <option value="PLANVITAL">PlanVital (11.16%)</option>
                      <option value="MODELO">Modelo (10.58%)</option>
                      <option value="UNO">Uno (10.49%)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-600 text-[10px] font-semibold mb-1">Salud:</label>
                    <select
                      value={formData.saludTipo}
                      onChange={(e) => setFormData(prev => ({ ...prev, saludTipo: e.target.value as any }))}
                      className="w-full bg-white border border-slate-300 rounded-md p-1.5 text-slate-900"
                    >
                      <option value="FONASA">Fonasa (7% legal)</option>
                      <option value="ISAPRE">Isapre (Plan en UF)</option>
                    </select>
                  </div>
                  {formData.saludTipo === 'ISAPRE' && (
                    <div>
                      <label className="block text-slate-600 text-[10px] font-semibold mb-1">Plan Pactado (UF):</label>
                      <input
                        type="number"
                        step="0.1"
                        value={formData.saludPlanUf}
                        onChange={(e) => setFormData(prev => ({ ...prev, saludPlanUf: Number(e.target.value) }))}
                        className="w-full bg-white border border-slate-300 rounded-md p-1.5 font-mono text-slate-900"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEmployeeModal(false)}
                  className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-md font-medium cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#2563eb] hover:bg-blue-600 text-white rounded-md font-semibold shadow-xs cursor-pointer"
                >
                  Guardar y Recalcular Leyes Sociales
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Liquidación de Sueldo Oficial Imprimible */}
      {selectedPayslip && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg w-full max-w-3xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-150">
            <div className="px-6 py-4 bg-[#0f172a] text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-white text-sm sm:text-base">
                  Liquidación Oficial de Remuneraciones (Dirección del Trabajo)
                </h3>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-md text-xs font-semibold cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-blue-300" />
                  <span>Imprimir / PDF</span>
                </button>
                <button
                  onClick={() => setSelectedPayslip(null)}
                  className="text-slate-300 hover:text-white text-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-xs font-mono bg-white text-slate-800">
              {/* Header Empresa y Colaborador */}
              <div className="border-b border-slate-200 pb-4 grid grid-cols-2 gap-4">
                <div>
                  <div className="font-bold text-[#0f172a] text-sm">{company.razonSocial}</div>
                  <div className="text-slate-500">RUT: {company.rut}</div>
                  <div className="text-slate-500">{company.direccion}, {company.comuna}</div>
                  <div className="text-slate-500">Giro: {company.giro}</div>
                </div>
                <div className="text-right">
                  <div className="text-[#2563eb] font-extrabold text-sm">LIQUIDACIÓN DE SUELDO</div>
                  <div className="text-slate-600 font-bold">Periodo: {new Date().toISOString().substring(0, 7)}</div>
                  <div className="text-slate-500">Días Trabajados: {selectedPayslip.diasTrabajados}</div>
                </div>
              </div>

              {/* Datos Trabajador */}
              <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 grid grid-cols-3 gap-3">
                <div>
                  <span className="text-slate-500 block text-[10px] font-semibold">TRABAJADOR:</span>
                  <span className="font-bold text-slate-900 font-sans">{selectedPayslip.nombreCompleto}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] font-semibold">RUT:</span>
                  <span className="font-bold text-slate-900">{selectedPayslip.rut}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] font-semibold">CARGO:</span>
                  <span className="font-sans text-slate-800">{selectedPayslip.cargo}</span>
                </div>
              </div>

              {/* Grid Haberes vs Descuentos */}
              <div className="grid grid-cols-2 gap-4">
                {/* Haberes */}
                <div className="border border-slate-200 rounded-lg p-3.5 bg-slate-50/50 space-y-2">
                  <div className="font-bold text-emerald-700 border-b border-slate-200 pb-1.5 uppercase text-[11px]">
                    1. Haberes ($)
                  </div>
                  <div className="space-y-1 text-slate-700 text-[11px]">
                    <div className="flex justify-between">
                      <span>Sueldo Base:</span>
                      <span>{formatNumberCL(selectedPayslip.sueldoBase)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Gratificación Legal Art. 50:</span>
                      <span>{formatNumberCL(selectedPayslip.gratificacionMonto)}</span>
                    </div>
                    {selectedPayslip.horasExtrasMonto > 0 && (
                      <div className="flex justify-between">
                        <span>Horas Extras ({selectedPayslip.horasExtrasCantidad} hrs):</span>
                        <span>{formatNumberCL(selectedPayslip.horasExtrasMonto)}</span>
                      </div>
                    )}
                    {selectedPayslip.comisionesBonosImponibles > 0 && (
                      <div className="flex justify-between">
                        <span>Bonos Imponibles:</span>
                        <span>{formatNumberCL(selectedPayslip.comisionesBonosImponibles)}</span>
                      </div>
                    )}
                    <div className="pt-1.5 border-t border-slate-200 font-bold text-slate-900 flex justify-between">
                      <span>TOTAL IMPONIBLE:</span>
                      <span className="text-emerald-700">{formatNumberCL(selectedPayslip.totalHaberesImponibles)}</span>
                    </div>

                    <div className="pt-2 text-slate-500 text-[10px] font-semibold">Haberes No Imponibles:</div>
                    <div className="flex justify-between text-slate-600">
                      <span>Colación:</span>
                      <span>{formatNumberCL(selectedPayslip.asignacionColacion)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Movilización:</span>
                      <span>{formatNumberCL(selectedPayslip.asignacionMovilizacion)}</span>
                    </div>
                    <div className="pt-1.5 border-t border-slate-200 font-black text-slate-900 flex justify-between">
                      <span>TOTAL HABERES:</span>
                      <span>{formatCLP(selectedPayslip.totalHaberesBrutos)}</span>
                    </div>
                  </div>
                </div>

                {/* Descuentos Legales */}
                <div className="border border-slate-200 rounded-lg p-3.5 bg-slate-50/50 space-y-2">
                  <div className="font-bold text-rose-700 border-b border-slate-200 pb-1.5 uppercase text-[11px]">
                    2. Descuentos Legales ($)
                  </div>
                  <div className="space-y-1 text-slate-700 text-[11px]">
                    <div className="flex justify-between">
                      <span>AFP {selectedPayslip.afpNombre} ({(selectedPayslip.afpTasa * 100).toFixed(2)}%):</span>
                      <span>{formatNumberCL(selectedPayslip.afpMonto)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Salud {selectedPayslip.saludTipo}:</span>
                      <span>{formatNumberCL(selectedPayslip.saludMonto)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Seguro Cesantía AFC (0.6%):</span>
                      <span>{formatNumberCL(selectedPayslip.afcTrabajadorMonto)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Impuesto Único 2da Cat (UTM):</span>
                      <span className="text-amber-700 font-bold">{formatNumberCL(selectedPayslip.impuestoUnicoMonto)}</span>
                    </div>
                    <div className="pt-3 border-t border-slate-200 font-black text-slate-900 flex justify-between">
                      <span>TOTAL DESCUENTOS:</span>
                      <span className="text-rose-600">-{formatCLP(selectedPayslip.totalDescuentos)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Total Líquido a Recibir */}
              <div className="bg-[#eff6ff] p-4 rounded-lg border border-[#2563eb]/30 flex items-center justify-between">
                <div>
                  <span className="text-slate-600 text-xs font-bold uppercase tracking-wider block">
                    ALCANCE LÍQUIDO A PAGAR:
                  </span>
                  <span className="text-[10px] text-slate-500 font-sans">
                    Son: {formatCLP(selectedPayslip.sueldoLiquido)} pesos chilenos.
                  </span>
                </div>
                <div className="text-2xl font-black text-[#2563eb]">
                  {formatCLP(selectedPayslip.sueldoLiquido)}
                </div>
              </div>

              {/* Firmas */}
              <div className="pt-10 grid grid-cols-2 gap-12 text-center text-[10px] text-slate-500">
                <div className="border-t border-slate-300 pt-2">
                  FIRMA EMPLEADOR
                </div>
                <div className="border-t border-slate-300 pt-2">
                  FIRMA TRABAJADOR
                  <br />(Certifico haber recibido conforme el importe indicado)
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Visor Asiento de Centralización de Remuneraciones */}
      {viewEntryModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="px-6 py-4 bg-[#0f172a] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-white text-sm sm:text-base">
                  Asiento de Centralización de Remuneraciones Normalizado
                </h3>
              </div>
              <button
                onClick={() => setViewEntryModal(null)}
                className="text-slate-300 hover:text-white text-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-[#1e293b] p-4 rounded-md border-l-4 border-[#2563eb] overflow-x-auto">
                <pre className="font-mono text-xs text-[#cbd5e1] leading-relaxed">
                  {formatNormalizedAccountingEntry(viewEntryModal)}
                </pre>
              </div>

              <div className="flex items-center justify-between text-xs pt-2">
                <span className="text-emerald-700 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Asiento Balanceado (Debe = Haber)
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyNormalizedText(viewEntryModal)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#2563eb] hover:bg-blue-600 text-white rounded-md font-semibold transition-colors cursor-pointer shadow-xs"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copied ? '¡Copiado al Portapapeles!' : 'Copiar Formato Normalizado'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
