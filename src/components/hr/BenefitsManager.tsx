import React, { useState } from 'react';
import { 
  Gift, 
  Plus, 
  ShieldCheck, 
  Users, 
  DollarSign, 
  Building2, 
  Heart, 
  CheckCircle2, 
  Baby, 
  Laptop, 
  Sparkles,
  X,
  FileText
} from 'lucide-react';
import { HrBenefit, BenefitCategory } from '../../types';
import { formatCLP } from '../../utils/chileanAccounting';

interface BenefitsManagerProps {
  benefits: HrBenefit[];
  onAddBenefit: (benefit: HrBenefit) => void;
  onToggleBenefit: (benefitId: string) => void;
}

export const BenefitsManager: React.FC<BenefitsManagerProps> = ({
  benefits,
  onAddBenefit,
  onToggleBenefit,
}) => {
  const [showNewModal, setShowNewModal] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('TODOS');

  // Form state
  const [formData, setFormData] = useState<Partial<HrBenefit>>({
    nombre: '',
    categoria: 'SALUD_BIENESTAR',
    descripcion: '',
    normaLegalChilena: 'Convenio colectivo / Política interna de bienestar',
    montoAporteEmpresaPorTrabajador: 50000,
    esImponible: false,
    beneficiariosActivos: 4,
    proveedorConvenio: '',
    frecuencia: 'MENSUAL',
    activo: true,
  });

  const filteredBenefits = benefits.filter(b => {
    if (filterCategory === 'TODOS') return true;
    return b.categoria === filterCategory;
  });

  const totalInversionMensual = benefits
    .filter(b => b.activo && b.frecuencia === 'MENSUAL')
    .reduce((acc, b) => acc + (b.montoAporteEmpresaPorTrabajador * b.beneficiariosActivos), 0);

  const totalBeneficiosActivos = benefits.filter(b => b.activo).length;

  const handleCreateBenefit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombre) return;

    const newBenefit: HrBenefit = {
      id: `ben-${Date.now()}`,
      nombre: formData.nombre,
      categoria: formData.categoria as BenefitCategory || 'SALUD_BIENESTAR',
      descripcion: formData.descripcion || '',
      normaLegalChilena: formData.normaLegalChilena || 'Política de bienestar laboral',
      montoAporteEmpresaPorTrabajador: Number(formData.montoAporteEmpresaPorTrabajador) || 0,
      esImponible: !!formData.esImponible,
      beneficiariosActivos: Number(formData.beneficiariosActivos) || 1,
      proveedorConvenio: formData.proveedorConvenio,
      frecuencia: formData.frecuencia as any || 'MENSUAL',
      activo: true,
    };

    onAddBenefit(newBenefit);
    setShowNewModal(false);
  };

  const getCategoryIcon = (cat: BenefitCategory) => {
    switch (cat) {
      case 'SALUD_BIENESTAR': return Heart;
      case 'SALA_CUNA_ART203': return Baby;
      case 'CAJA_COMPENSACION': return Building2;
      case 'TELETRABAJO_CONECTIVIDAD': return Laptop;
      case 'AGUINALDO_FESTIVIDAD': return Sparkles;
      default: return Gift;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Beneficios Activos</span>
            <Gift className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">{totalBeneficiosActivos}</div>
          <div className="text-[11px] text-slate-500 mt-1">
            Programas y convenios corporativos
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Inversión Mensual Empresa</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-2">
            {formatCLP(totalInversionMensual)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Aporte total en nómina y convenios
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Sala Cuna Art. 203 CT</span>
            <Baby className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-black text-rose-700 mt-2">
            Vigente
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Convenio Sala Cuna / Dictamen DT
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Caja de Compensación</span>
            <Building2 className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-indigo-700 mt-2">
            Caja Los Andes
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Ley 18.833 de Beneficios Sociales
          </div>
        </div>
      </div>

      {/* Control Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-extrabold text-slate-900 text-sm sm:text-base flex items-center gap-2">
            <Gift className="w-5 h-5 text-purple-600" />
            <span>Catálogo de Beneficios, Compensaciones & Convenios Laborales</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Administración de asignaciones no imponibles (Art. 41 CT), sala cuna (Art. 203), seguros complementarios y aguinaldos patrios/navideños.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="bg-slate-50 border border-slate-300 text-slate-700 text-xs rounded-lg px-3 py-1.5 font-medium"
          >
            <option value="TODOS">Todas las Categorías</option>
            <option value="ASIGNACION_NO_IMPONIBLE">Asignaciones No Imponibles</option>
            <option value="SALUD_BIENESTAR">Salud & Bienestar</option>
            <option value="SALA_CUNA_ART203">Sala Cuna (Art. 203)</option>
            <option value="CAJA_COMPENSACION">Caja de Compensación</option>
            <option value="AGUINALDO_FESTIVIDAD">Aguinaldos & Festividades</option>
            <option value="TELETRABAJO_CONECTIVIDAD">Teletrabajo (Ley 21.220)</option>
          </select>

          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Crear Nuevo Beneficio</span>
          </button>
        </div>
      </div>

      {/* Benefits Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredBenefits.map((benefit) => {
          const Icon = getCategoryIcon(benefit.categoria);
          return (
            <div 
              key={benefit.id} 
              className={`bg-white border rounded-xl p-5 shadow-xs transition-all flex flex-col justify-between ${
                benefit.activo ? 'border-slate-200' : 'border-slate-200 opacity-60 bg-slate-50'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="p-2.5 rounded-xl bg-purple-50 text-purple-700">
                    <Icon className="w-5 h-5" />
                  </div>
                  <button
                    onClick={() => onToggleBenefit(benefit.id)}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full cursor-pointer transition-colors ${
                      benefit.activo ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {benefit.activo ? 'Activo' : 'Pausado'}
                  </button>
                </div>

                <h4 className="font-extrabold text-slate-900 text-sm mt-3">{benefit.nombre}</h4>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">{benefit.descripcion}</p>

                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 mt-3 text-[11px] space-y-1">
                  <div className="text-slate-500 font-semibold">Marco Legal:</div>
                  <div className="text-slate-800 font-mono text-[10px] leading-tight">{benefit.normaLegalChilena}</div>
                  {benefit.proveedorConvenio && (
                    <div className="text-purple-700 font-semibold pt-1">
                      Convenio con: {benefit.proveedorConvenio}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <div>
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">Monto por Trabajador</div>
                  <div className="font-mono font-black text-slate-900 text-sm">
                    {benefit.montoAporteEmpresaPorTrabajador > 0 ? formatCLP(benefit.montoAporteEmpresaPorTrabajador) : 'Sin costo directo'}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {benefit.esImponible ? 'Imponible para Previsión' : 'No imponible (Exento)'}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">Beneficiarios</div>
                  <div className="font-bold text-slate-800 flex items-center gap-1 justify-end">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <span>{benefit.beneficiariosActivos} pers.</span>
                  </div>
                  <div className="text-[10px] text-purple-700 font-medium">{benefit.frecuencia}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Crear Beneficio */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg overflow-hidden shadow-2xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-150">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <h3 className="font-bold text-white text-sm sm:text-base flex items-center gap-2">
                <Plus className="w-5 h-5 text-purple-400" />
                <span>Incorporar Nuevo Beneficio o Convenio</span>
              </h3>
              <button
                onClick={() => setShowNewModal(false)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateBenefit} className="p-6 overflow-y-auto space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nombre del Beneficio:</label>
                <input
                  type="text"
                  required
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  placeholder="Ej: Seguro Dental y Oftalmológico"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Categoría:</label>
                  <select
                    value={formData.categoria}
                    onChange={(e) => setFormData({ ...formData, categoria: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900"
                  >
                    <option value="SALUD_BIENESTAR">Salud & Bienestar</option>
                    <option value="ASIGNACION_NO_IMPONIBLE">Asignación No Imponible</option>
                    <option value="CAJA_COMPENSACION">Caja de Compensación</option>
                    <option value="SALA_CUNA_ART203">Sala Cuna (Art. 203)</option>
                    <option value="AGUINALDO_FESTIVIDAD">Aguinaldo Festividades</option>
                    <option value="TELETRABAJO_CONECTIVIDAD">Teletrabajo (Ley 21.220)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Frecuencia de Pago:</label>
                  <select
                    value={formData.frecuencia}
                    onChange={(e) => setFormData({ ...formData, frecuencia: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900"
                  >
                    <option value="MENSUAL">Mensual</option>
                    <option value="ANUAL_FIESTAS_PATRIAS">Anual Fiestas Patrias</option>
                    <option value="ANUAL_NAVIDAD">Anual Navidad</option>
                    <option value="PAGO_EVENTUAL">Pago Eventual / Único</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Aporte por Trabajador ($):</label>
                  <input
                    type="number"
                    value={formData.montoAporteEmpresaPorTrabajador}
                    onChange={(e) => setFormData({ ...formData, montoAporteEmpresaPorTrabajador: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Trabajadores Beneficiados:</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={formData.beneficiariosActivos}
                    onChange={(e) => setFormData({ ...formData, beneficiariosActivos: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Institución / Proveedor del Convenio:</label>
                <input
                  type="text"
                  value={formData.proveedorConvenio || ''}
                  onChange={(e) => setFormData({ ...formData, proveedorConvenio: e.target.value })}
                  placeholder="Ej: Bupa Dental / BICE Vida / Caja Los Andes"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Descripción y Condiciones:</label>
                <textarea
                  rows={2}
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  placeholder="Detallar condiciones de acceso, porcentaje de copago, etc."
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="esImponibleCheck"
                  checked={formData.esImponible}
                  onChange={(e) => setFormData({ ...formData, esImponible: e.target.checked })}
                  className="rounded text-purple-600 focus:ring-purple-500"
                />
                <label htmlFor="esImponibleCheck" className="text-slate-700 font-medium">
                  Beneficio imponible para cotizaciones previsionales e Impuesto Único (desmarcar si es exento según Art. 41)
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
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold shadow-xs cursor-pointer"
                >
                  Crear Beneficio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
