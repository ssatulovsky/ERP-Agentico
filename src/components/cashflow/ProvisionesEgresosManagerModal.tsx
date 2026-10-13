import React, { useState, useMemo } from 'react';
import {
  X,
  FileSpreadsheet,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  Info,
  DollarSign,
  Percent,
  Calendar,
  Building2,
  Sliders,
  Sparkles,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  Check,
  Search,
  Filter,
  RefreshCw,
  FileText,
} from 'lucide-react';
import {
  ProvisionEgreso,
  TipoProvisionEgreso,
  NaturalezaProvisionEgreso,
  AfectacionIvaProvision,
  PeriodicidadProvision,
  AccountingEntry,
} from '../../types';

interface ProvisionesEgresosManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  provisiones: ProvisionEgreso[];
  onUpdateProvisiones: (provisiones: ProvisionEgreso[]) => void;
  empresaId: string;
  onAddEntry?: (entry: AccountingEntry) => void;
  authorName?: string;
}

export const ProvisionesEgresosManagerModal: React.FC<ProvisionesEgresosManagerModalProps> = ({
  isOpen,
  onClose,
  provisiones = [],
  onUpdateProvisiones,
  empresaId,
  onAddEntry,
  authorName = 'Auditor ERP',
}) => {
  // Estados de Filtros y Búsqueda
  const [searchTerm, setSearchTerm] = useState('');
  const [filterNaturaleza, setFilterNaturaleza] = useState<'ALL' | 'CONTABLE' | 'EXTRACONTABLE'>('ALL');
  const [filterPeriodicidad, setFilterPeriodicidad] = useState<'ALL' | 'NO_PERIODICA' | 'PERIODICA'>('ALL');
  const [filterIva, setFilterIva] = useState<'ALL' | 'AFECTO' | 'EXENTO'>('ALL');
  const [filterEstado, setFilterEstado] = useState<'ALL' | 'PENDIENTE' | 'LIQUIDADA'>('ALL');

  // Estado del Formulario ABM (Alta / Modificación)
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Campos del formulario
  const [formData, setFormData] = useState<{
    concepto: string;
    tipoProvision: TipoProvisionEgreso;
    naturaleza: NaturalezaProvisionEgreso;
    afectacionIva: AfectacionIvaProvision;
    periodicidad: PeriodicidadProvision;
    fechaEstimadaPago: string;
    montoNeto: number;
    montoIva: number;
    montoTotal: number;
    tasaIvaPct: number;
    simularCreditoFiscalF29: boolean;
    proveedorNombre: string;
    proveedorRut: string;
    probabilidadMaterializacionPct: number;
    cuentaContableProvision: string;
    cuentaGastoAsociada: string;
    centroCostoId: string;
    estado: 'PENDIENTE' | 'LIQUIDADA' | 'REVERSADA';
    observaciones: string;
    generarAsientoDevengo: boolean;
  }>({
    concepto: '',
    tipoProvision: 'HONORARIOS_AUDITORIA',
    naturaleza: 'CONTABLE',
    afectacionIva: 'AFECTO_IVA_19',
    periodicidad: 'NO_PERIODICA_PUNTUAL',
    fechaEstimadaPago: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    montoNeto: 1000000,
    montoIva: 190000,
    montoTotal: 1190000,
    tasaIvaPct: 19,
    simularCreditoFiscalF29: true,
    proveedorNombre: '',
    proveedorRut: '',
    probabilidadMaterializacionPct: 90,
    cuentaContableProvision: '2.1.03.015',
    cuentaGastoAsociada: '6.1.02.001',
    centroCostoId: 'CC-FIN-01',
    estado: 'PENDIENTE',
    observaciones: '',
    generarAsientoDevengo: false,
  });

  // Mensaje flotante de confirmación (toast)
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Cuentas sugeridas por tipo de provisión
  const getCuentasSugeridas = (tipo: TipoProvisionEgreso) => {
    switch (tipo) {
      case 'GRATIFICACIONES':
        return { provision: '2.1.03.005', gasto: '6.1.01.005', iva: 'EXENTO' as AfectacionIvaProvision };
      case 'INDEMNIZACION_IAS':
        return { provision: '2.1.03.010', gasto: '6.1.01.010', iva: 'EXENTO' as AfectacionIvaProvision };
      case 'HONORARIOS_AUDITORIA':
        return { provision: '2.1.03.015', gasto: '6.1.02.001', iva: 'AFECTO_IVA_19' as AfectacionIvaProvision };
      case 'MANTENCION_MAYOR':
        return { provision: '2.1.03.020', gasto: '6.1.03.004', iva: 'AFECTO_IVA_19' as AfectacionIvaProvision };
      case 'ASESORIA_LEGAL_TRIBUTARIA':
        return { provision: '2.1.03.025', gasto: '6.1.02.005', iva: 'AFECTO_IVA_19' as AfectacionIvaProvision };
      case 'LICENCIAS_SOFTWARE':
        return { provision: '2.1.03.030', gasto: '6.1.03.010', iva: 'EXENTO' as AfectacionIvaProvision };
      case 'SEGUROS_GENERALES':
        return { provision: '2.1.03.035', gasto: '6.1.03.008', iva: 'EXENTO' as AfectacionIvaProvision };
      case 'EVENTOS_CORPORATIVOS':
        return { provision: '2.1.03.040', gasto: '6.1.03.015', iva: 'AFECTO_IVA_19' as AfectacionIvaProvision };
      default:
        return { provision: '2.1.03.099', gasto: '6.1.03.099', iva: 'AFECTO_IVA_19' as AfectacionIvaProvision };
    }
  };

  // Recalcular montos (Neto, IVA, Total) al cambiar valores
  const handleMontoNetoChange = (newNeto: number, afectacion = formData.afectacionIva) => {
    let iva = 0;
    let total = newNeto;

    if (afectacion === 'AFECTO_IVA_19') {
      iva = Math.round(newNeto * 0.19);
      total = newNeto + iva;
    } else if (afectacion === 'HONORARIOS_RETENCION') {
      const retencion = Math.round(newNeto * 0.145); // Tasa retención honorarios
      iva = 0;
      total = newNeto - retencion; // Monto líquido a pagar en caja
    }

    setFormData((prev) => ({
      ...prev,
      montoNeto: newNeto,
      montoIva: iva,
      montoTotal: total,
    }));
  };

  const handleAfectacionIvaChange = (afectacion: AfectacionIvaProvision) => {
    let iva = 0;
    let total = formData.montoNeto;

    if (afectacion === 'AFECTO_IVA_19') {
      iva = Math.round(formData.montoNeto * 0.19);
      total = formData.montoNeto + iva;
    } else if (afectacion === 'HONORARIOS_RETENCION') {
      const retencion = Math.round(formData.montoNeto * 0.145);
      iva = 0;
      total = formData.montoNeto - retencion;
    }

    setFormData((prev) => ({
      ...prev,
      afectacionIva: afectacion,
      montoIva: iva,
      montoTotal: total,
      simularCreditoFiscalF29: afectacion === 'AFECTO_IVA_19',
    }));
  };

  // Abrir formulario para Nueva Provisión
  const handleOpenNew = () => {
    const defaultTipo: TipoProvisionEgreso = 'HONORARIOS_AUDITORIA';
    const sugeridas = getCuentasSugeridas(defaultTipo);
    setEditingId(null);
    setFormData({
      concepto: '',
      tipoProvision: defaultTipo,
      naturaleza: 'CONTABLE',
      afectacionIva: sugeridas.iva,
      periodicidad: 'NO_PERIODICA_PUNTUAL',
      fechaEstimadaPago: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      montoNeto: 1000000,
      montoIva: sugeridas.iva === 'AFECTO_IVA_19' ? 190000 : 0,
      montoTotal: sugeridas.iva === 'AFECTO_IVA_19' ? 1190000 : 1000000,
      tasaIvaPct: 19,
      simularCreditoFiscalF29: sugeridas.iva === 'AFECTO_IVA_19',
      proveedorNombre: '',
      proveedorRut: '',
      probabilidadMaterializacionPct: 90,
      cuentaContableProvision: sugeridas.provision,
      cuentaGastoAsociada: sugeridas.gasto,
      centroCostoId: 'CC-FIN-01',
      estado: 'PENDIENTE',
      observaciones: '',
      generarAsientoDevengo: false,
    });
    setIsFormOpen(true);
  };

  // Abrir formulario para Editar
  const handleOpenEdit = (p: ProvisionEgreso) => {
    setEditingId(p.id);
    const montoNeto = p.montoNeto !== undefined ? p.montoNeto : p.montoEstimado;
    const afectacion = p.afectacionIva || (p.tipoProvision === 'GRATIFICACIONES' || p.tipoProvision === 'INDEMNIZACION_IAS' ? 'EXENTO' : 'AFECTO_IVA_19');
    const esAfecto = afectacion === 'AFECTO_IVA_19';
    const montoIva = p.montoIva !== undefined ? p.montoIva : (esAfecto ? Math.round(montoNeto * 0.19) : 0);
    const montoTotal = p.montoTotal !== undefined ? p.montoTotal : (montoNeto + montoIva);

    setFormData({
      concepto: p.concepto,
      tipoProvision: p.tipoProvision,
      naturaleza: p.naturaleza || 'CONTABLE',
      afectacionIva: afectacion,
      periodicidad: p.periodicidad || 'NO_PERIODICA_PUNTUAL',
      fechaEstimadaPago: p.fechaEstimadaPago,
      montoNeto: montoNeto,
      montoIva: montoIva,
      montoTotal: montoTotal,
      tasaIvaPct: p.tasaIvaPct !== undefined ? p.tasaIvaPct : 19,
      simularCreditoFiscalF29: p.simularCreditoFiscalF29 !== undefined ? p.simularCreditoFiscalF29 : esAfecto,
      proveedorNombre: p.proveedorNombre || '',
      proveedorRut: p.proveedorRut || '',
      probabilidadMaterializacionPct: p.probabilidadMaterializacionPct || 90,
      cuentaContableProvision: p.cuentaContableProvision,
      cuentaGastoAsociada: p.cuentaGastoAsociada || '6.1.02.001',
      centroCostoId: p.centroCostoId || 'CC-ADM-01',
      estado: p.estado,
      observaciones: p.observaciones || '',
      generarAsientoDevengo: false,
    });
    setIsFormOpen(true);
  };

  // Guardar Provisión (Crear o Actualizar)
  const handleSave = () => {
    if (!formData.concepto.trim()) {
      alert('Por favor ingrese un concepto o glosa para la provisión.');
      return;
    }

    if (formData.montoNeto <= 0) {
      alert('El monto de la provisión debe ser mayor a cero.');
      return;
    }

    let updatedList: ProvisionEgreso[];

    if (editingId) {
      // Modificación
      updatedList = provisiones.map((p) => {
        if (p.id === editingId) {
          return {
            ...p,
            concepto: formData.concepto,
            tipoProvision: formData.tipoProvision,
            naturaleza: formData.naturaleza,
            afectacionIva: formData.afectacionIva,
            periodicidad: formData.periodicidad,
            fechaEstimadaPago: formData.fechaEstimadaPago,
            montoEstimado: formData.montoNeto,
            montoNeto: formData.montoNeto,
            montoIva: formData.montoIva,
            montoTotal: formData.montoTotal,
            tasaIvaPct: formData.tasaIvaPct,
            simularCreditoFiscalF29: formData.simularCreditoFiscalF29,
            proveedorNombre: formData.proveedorNombre,
            proveedorRut: formData.proveedorRut,
            probabilidadMaterializacionPct: formData.probabilidadMaterializacionPct,
            cuentaContableProvision: formData.cuentaContableProvision,
            cuentaGastoAsociada: formData.cuentaGastoAsociada,
            centroCostoId: formData.centroCostoId,
            estado: formData.estado,
            observaciones: formData.observaciones,
          };
        }
        return p;
      });
      showToast('Provisión modificada exitosamente. Flujo de caja recalculado.');
    } else {
      // Alta
      const newId = `prov-${Date.now()}`;
      const newProvision: ProvisionEgreso = {
        id: newId,
        empresaId: empresaId || '',
        concepto: formData.concepto,
        tipoProvision: formData.tipoProvision,
        naturaleza: formData.naturaleza,
        afectacionIva: formData.afectacionIva,
        periodicidad: formData.periodicidad,
        fechaEstimadaPago: formData.fechaEstimadaPago,
        montoEstimado: formData.montoNeto,
        montoNeto: formData.montoNeto,
        montoIva: formData.montoIva,
        montoTotal: formData.montoTotal,
        tasaIvaPct: formData.tasaIvaPct,
        simularCreditoFiscalF29: formData.simularCreditoFiscalF29,
        proveedorNombre: formData.proveedorNombre,
        proveedorRut: formData.proveedorRut,
        probabilidadMaterializacionPct: formData.probabilidadMaterializacionPct,
        cuentaContableProvision: formData.cuentaContableProvision,
        cuentaGastoAsociada: formData.cuentaGastoAsociada,
        centroCostoId: formData.centroCostoId,
        estado: 'PENDIENTE',
        observaciones: formData.observaciones,
      };

      // Si el usuario solicitó generar asiento de devengo contable inmediato
      if (formData.naturaleza === 'CONTABLE' && formData.generarAsientoDevengo && onAddEntry) {
        const todayStr = new Date().toISOString().split('T')[0];
        const asientoId = `asiento-prov-${newId}`;
        const newEntry: AccountingEntry = {
          id: asientoId,
          fecha: todayStr,
          concepto: `Devengo Contable Provisión NIC 37: ${formData.concepto}`,
          documento: `Provisión N° ${newId}`,
          totalDebe: formData.montoNeto,
          totalHaber: formData.montoNeto,
          balanceado: true,
          origen: 'PROVISIONES',
          creadoEn: todayStr,
          lineas: [
            {
              cuentaCodigo: formData.cuentaGastoAsociada || '6.1.02.001',
              cuentaNombre: 'Gasto por Servicios / Provisiones Devengadas',
              debe: formData.montoNeto,
              haber: 0,
              centroCosto: formData.centroCostoId,
            },
            {
              cuentaCodigo: formData.cuentaContableProvision || '2.1.03.015',
              cuentaNombre: 'Provisión Pasivo Estimado por Pagar',
              debe: 0,
              haber: formData.montoNeto,
              centroCosto: formData.centroCostoId,
            },
          ],
        };
        onAddEntry(newEntry);
        newProvision.asientoContableGenerado = true;
        newProvision.asientoContableId = asientoId;
      }

      updatedList = [newProvision, ...provisiones];
      showToast('Nueva provisión creada e incorporada al flujo de caja.');
    }

    onUpdateProvisiones(updatedList);
    setIsFormOpen(false);
  };

  // Baja (Eliminar Provisión)
  const handleDelete = (id: string, concepto: string) => {
    if (confirm(`¿Confirma eliminar la provisión "${concepto}" del ERP y del flujo de caja?`)) {
      const updatedList = provisiones.filter((p) => p.id !== id);
      onUpdateProvisiones(updatedList);
      showToast('Provisión eliminada del flujo de caja.');
    }
  };

  // Marcar como Liquidada / Reversada
  const handleToggleEstado = (p: ProvisionEgreso) => {
    const nextEstado = p.estado === 'PENDIENTE' ? 'LIQUIDADA' : 'PENDIENTE';
    const updatedList = provisiones.map((item) => (item.id === p.id ? { ...item, estado: nextEstado } : item));
    onUpdateProvisiones(updatedList);
    showToast(`Provisión marcada como ${nextEstado}.`);
  };

  // Contabilizar Provisión Contable pendiente de asiento
  const handleGenerarAsiento = (p: ProvisionEgreso) => {
    if (!onAddEntry) return;
    const todayStr = new Date().toISOString().split('T')[0];
    const asientoId = `asiento-prov-${p.id}-${Date.now()}`;
    const montoNeto = p.montoNeto !== undefined ? p.montoNeto : p.montoEstimado;

    const newEntry: AccountingEntry = {
      id: asientoId,
      fecha: todayStr,
      concepto: `Devengo Contable Provisión NIC 37: ${p.concepto}`,
      documento: `Provisión N° ${p.id}`,
      totalDebe: montoNeto,
      totalHaber: montoNeto,
      balanceado: true,
      origen: 'PROVISIONES',
      creadoEn: todayStr,
      lineas: [
        {
          cuentaCodigo: p.cuentaGastoAsociada || '6.1.02.001',
          cuentaNombre: 'Gasto por Servicios / Provisiones Devengadas',
          debe: montoNeto,
          haber: 0,
          centroCosto: p.centroCostoId,
        },
        {
          cuentaCodigo: p.cuentaContableProvision || '2.1.03.015',
          cuentaNombre: 'Provisión Pasivo Estimado por Pagar',
          debe: 0,
          haber: montoNeto,
          centroCosto: p.centroCostoId,
        },
      ],
    };

    onAddEntry(newEntry);
    const updatedList = provisiones.map((item) =>
      item.id === p.id ? { ...item, asientoContableGenerado: true, asientoContableId: asientoId } : item
    );
    onUpdateProvisiones(updatedList);
    showToast('Asiento de devengo contable generado en el Libro Diario.');
  };

  // Filtrado de partidas
  const filteredProvisiones = useMemo(() => {
    return provisiones.filter((p) => {
      // Búsqueda texto
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchConcepto = p.concepto.toLowerCase().includes(term);
        const matchProv = (p.proveedorNombre || '').toLowerCase().includes(term);
        const matchCuenta = (p.cuentaContableProvision || '').toLowerCase().includes(term);
        if (!matchConcepto && !matchProv && !matchCuenta) return false;
      }

      // Naturaleza
      if (filterNaturaleza === 'CONTABLE' && p.naturaleza !== 'CONTABLE') return false;
      if (filterNaturaleza === 'EXTRACONTABLE' && p.naturaleza !== 'EXTRACONTABLE') return false;

      // Periodicidad
      if (filterPeriodicidad === 'NO_PERIODICA' && p.periodicidad !== 'NO_PERIODICA_PUNTUAL') return false;
      if (filterPeriodicidad === 'PERIODICA' && (p.periodicidad === 'NO_PERIODICA_PUNTUAL' || !p.periodicidad)) return false;

      // IVA
      if (filterIva === 'AFECTO' && p.afectacionIva !== 'AFECTO_IVA_19') return false;
      if (filterIva === 'EXENTO' && p.afectacionIva === 'AFECTO_IVA_19') return false;

      // Estado
      if (filterEstado !== 'ALL' && p.estado !== filterEstado) return false;

      return true;
    });
  }, [provisiones, searchTerm, filterNaturaleza, filterPeriodicidad, filterIva, filterEstado]);

  // Cálculos KPIs Totales
  const stats = useMemo(() => {
    const activas = provisiones.filter((p) => p.estado === 'PENDIENTE');

    let totalNeto = 0;
    let totalIva = 0;
    let totalCaja = 0;
    let countContables = 0;
    let countExtracontables = 0;
    let countNoPeriodicas = 0;

    activas.forEach((p) => {
      const neto = p.montoNeto !== undefined ? p.montoNeto : p.montoEstimado;
      const esAfecto = p.afectacionIva === 'AFECTO_IVA_19';
      const iva = p.montoIva !== undefined ? p.montoIva : (esAfecto ? Math.round(neto * 0.19) : 0);
      const total = p.montoTotal !== undefined ? p.montoTotal : (neto + iva);

      totalNeto += neto;
      totalIva += iva;
      totalCaja += total;

      if (p.naturaleza === 'CONTABLE' || !p.naturaleza) countContables++;
      else countExtracontables++;

      if (p.periodicidad === 'NO_PERIODICA_PUNTUAL') countNoPeriodicas++;
    });

    return {
      totalActivas: activas.length,
      totalNeto,
      totalIva,
      totalCaja,
      countContables,
      countExtracontables,
      countNoPeriodicas,
    };
  }, [provisiones]);

  const formatCLP = (val?: number) => `$ ${Math.round(val || 0).toLocaleString('es-CL')}`;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full border border-slate-200 overflow-hidden my-4 flex flex-col max-h-[92vh]">
        {/* Toast Notificación */}
        {toastMessage && (
          <div className="fixed top-6 right-6 z-60 bg-slate-900 border border-emerald-500 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-slide-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="text-xs font-medium">{toastMessage}</span>
          </div>
        )}

        {/* 1. Header con Branding Contable */}
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white p-5 flex items-center justify-between border-b border-indigo-900/40">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg border border-indigo-400/30 text-white">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black tracking-tight text-white">
                  Gestor ABM de Provisiones de Egresos
                </h3>
                <span className="text-[10px] bg-indigo-500/30 text-indigo-300 font-mono font-bold px-2 py-0.5 rounded-full border border-indigo-400/30">
                  NIC 37 & Flujo de Caja
                </span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-400/30">
                  IVA 19% Simulado
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Configura partidas Contables (con devengo) vs. Extracontables (presupuestarias de flujo), cálculo de IVA 19% y partidas no periódicas.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenNew}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-xs font-bold transition-all shadow-md cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Provisión</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 2. Ribbon de KPIs Ejecutivos */}
        <div className="bg-slate-50 border-b border-slate-200 p-4 grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-500 block uppercase">Egreso Total en Caja</span>
            <span className="text-base font-black font-mono text-rose-600 block mt-0.5">
              {formatCLP(stats.totalCaja)}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              {stats.totalActivas} partidas pendientes
            </span>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-500 block uppercase">Monto Neto Devengado</span>
            <span className="text-base font-black font-mono text-slate-800 block mt-0.5">
              {formatCLP(stats.totalNeto)}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Base imponible de gasto</span>
          </div>

          <div className="bg-white p-3 rounded-xl border border-emerald-200 bg-emerald-50/30 shadow-xs">
            <span className="text-[11px] font-semibold text-emerald-800 block uppercase flex items-center gap-1">
              <Percent className="w-3 h-3 text-emerald-600" />
              IVA Crédito Fiscal (19%)
            </span>
            <span className="text-base font-black font-mono text-emerald-600 block mt-0.5">
              +{formatCLP(stats.totalIva)}
            </span>
            <span className="text-[10px] text-emerald-700 block mt-0.5">Impacta proyección F29</span>
          </div>

          <div className="bg-white p-3 rounded-xl border border-blue-200 bg-blue-50/20 shadow-xs">
            <span className="text-[11px] font-semibold text-blue-900 block uppercase">Provisiones Contables</span>
            <span className="text-base font-black text-blue-700 block mt-0.5">
              {stats.countContables} partidas
            </span>
            <span className="text-[10px] text-blue-600 block mt-0.5">Con pasivo estimado NIC 37</span>
          </div>

          <div className="bg-white p-3 rounded-xl border border-purple-200 bg-purple-50/20 shadow-xs">
            <span className="text-[11px] font-semibold text-purple-900 block uppercase">Extracontables / Puntuales</span>
            <span className="text-base font-black text-purple-700 block mt-0.5">
              {stats.countExtracontables} ({stats.countNoPeriodicas} puntuales)
            </span>
            <span className="text-[10px] text-purple-600 block mt-0.5">Solo presupuestarias de caja</span>
          </div>
        </div>

        {/* 3. Panel Didáctico y Criterio del Contador */}
        <div className="px-5 py-3 bg-indigo-50/60 border-b border-indigo-100 flex items-start gap-3 text-xs text-indigo-950">
          <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p>
              <strong className="text-indigo-900">Doctrina Contable & Financiera Aplicada:</strong> Las{' '}
              <strong className="text-blue-800">Provisiones Contables</strong> se devengan por su monto neto (gasto sin IVA en el balance), pero en el Flujo de Caja se liquida el monto bruto con IVA (19% Crédito Fiscal).
              Las <strong className="text-purple-800">Partidas Extracontables</strong> permiten a la tesorería proyectar egresos no periódicos (mantenciones extraordinarias, consultorías o eventos) sin generar pasivos prematuros en el balance contable.
            </p>
          </div>
        </div>

        {/* 4. Barra de Herramientas, Filtros y Búsqueda */}
        <div className="p-4 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
            {/* Buscador */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar por concepto, proveedor o cuenta..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            {/* Filtro Naturaleza */}
            <select
              value={filterNaturaleza}
              onChange={(e) => setFilterNaturaleza(e.target.value as any)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="ALL">Naturaleza: Todas</option>
              <option value="CONTABLE">Solo Contables (NIC 37)</option>
              <option value="EXTRACONTABLE">Solo Extracontables (Flujo)</option>
            </select>

            {/* Filtro Periodicidad */}
            <select
              value={filterPeriodicidad}
              onChange={(e) => setFilterPeriodicidad(e.target.value as any)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="ALL">Periodicidad: Todas</option>
              <option value="NO_PERIODICA">Solo No Periódicas (Puntuales)</option>
              <option value="PERIODICA">Solo Periódicas</option>
            </select>

            {/* Filtro IVA */}
            <select
              value={filterIva}
              onChange={(e) => setFilterIva(e.target.value as any)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="ALL">Régimen IVA: Todos</option>
              <option value="AFECTO">Afectas a IVA (19%)</option>
              <option value="EXENTO">Exentas / Sin IVA</option>
            </select>

            {/* Filtro Estado */}
            <select
              value={filterEstado}
              onChange={(e) => setFilterEstado(e.target.value as any)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="ALL">Estado: Todos</option>
              <option value="PENDIENTE">Pendientes</option>
              <option value="LIQUIDADA">Liquidadas</option>
            </select>
          </div>

          <div className="text-slate-500 font-medium">
            Mostrando <strong>{filteredProvisiones.length}</strong> de {provisiones.length} partidas
          </div>
        </div>

        {/* 5. Contenido Principal: Formulario ABM (si está abierto) o Tabla de Partidas */}
        <div className="flex-1 overflow-y-auto p-5">
          {isFormOpen ? (
            /* ============================================================== */
            /* FORMULARIO ABM (ALTA / MODIFICACIÓN DE PROVISIÓN)               */
            /* ============================================================== */
            <div className="bg-slate-50 rounded-xl p-5 border-2 border-indigo-200 shadow-md space-y-5 animate-fade-in max-w-4xl mx-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-indigo-600" />
                  <h4 className="text-sm font-bold text-slate-900">
                    {editingId ? 'Modificar Provisión de Egreso' : 'Alta de Nueva Provisión de Egreso'}
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="text-slate-400 hover:text-slate-600 text-xs font-bold px-2 py-1 rounded-md hover:bg-slate-200 cursor-pointer"
                >
                  Cancelar
                </button>
              </div>

              {/* Fila 1: Concepto y Tipo */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Concepto / Glosa de la Provisión <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.concepto}
                    onChange={(e) => setFormData({ ...formData, concepto: e.target.value })}
                    placeholder="Ej: Honorarios Auditoría Externa Ejercicio 2026"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tipo de Provisión
                  </label>
                  <select
                    value={formData.tipoProvision}
                    onChange={(e) => {
                      const newTipo = e.target.value as TipoProvisionEgreso;
                      const sug = getCuentasSugeridas(newTipo);
                      setFormData({
                        ...formData,
                        tipoProvision: newTipo,
                        cuentaContableProvision: sug.provision,
                        cuentaGastoAsociada: sug.gasto,
                        afectacionIva: sug.iva,
                        simularCreditoFiscalF29: sug.iva === 'AFECTO_IVA_19',
                        montoIva: sug.iva === 'AFECTO_IVA_19' ? Math.round(formData.montoNeto * 0.19) : 0,
                        montoTotal: sug.iva === 'AFECTO_IVA_19' ? formData.montoNeto * 1.19 : formData.montoNeto,
                      });
                    }}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                  >
                    <option value="HONORARIOS_AUDITORIA">Honorarios Auditoría Externa</option>
                    <option value="MANTENCION_MAYOR">Mantención Mayor Infraestructura / TI</option>
                    <option value="ASESORIA_LEGAL_TRIBUTARIA">Asesoría Legal / Tributaria</option>
                    <option value="LICENCIAS_SOFTWARE">Licencias Software / SaaS Anual</option>
                    <option value="GRATIFICACIONES">Gratificaciones Legales (Art. 50)</option>
                    <option value="INDEMNIZACION_IAS">Indemnizaciones Años Servicio (IAS)</option>
                    <option value="SERVICIOS_DEVENGADOS">Servicios Generales Devengados</option>
                    <option value="SEGUROS_GENERALES">Primas de Seguros Generales</option>
                    <option value="EVENTOS_CORPORATIVOS">Eventos / Capacitaciones</option>
                    <option value="OTRO">Otro Egreso Operativo</option>
                  </select>
                </div>
              </div>

              {/* Fila 2: Naturaleza (Contable vs Extracontable) y Periodicidad */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 bg-white rounded-xl border border-slate-200">
                {/* Selector Naturaleza */}
                <div>
                  <span className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                    Naturaleza de la Partida (Propuesta del Contador)
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, naturaleza: 'CONTABLE' })}
                      className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                        formData.naturaleza === 'CONTABLE'
                          ? 'bg-blue-50 border-blue-500 text-blue-900 ring-1 ring-blue-500'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">Provisión Contable</span>
                        {formData.naturaleza === 'CONTABLE' && <Check className="w-4 h-4 text-blue-600" />}
                      </div>
                      <span className="text-[10px] text-slate-500 block mt-0.5">
                        Devengo formal con pasivo estimado (NIC 37)
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, naturaleza: 'EXTRACONTABLE' })}
                      className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                        formData.naturaleza === 'EXTRACONTABLE'
                          ? 'bg-purple-50 border-purple-500 text-purple-900 ring-1 ring-purple-500'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">Partida Extracontable</span>
                        {formData.naturaleza === 'EXTRACONTABLE' && <Check className="w-4 h-4 text-purple-600" />}
                      </div>
                      <span className="text-[10px] text-slate-500 block mt-0.5">
                        Presupuestaria pura para Flujo de Caja (sin asiento)
                      </span>
                    </button>
                  </div>
                </div>

                {/* Selector Periodicidad */}
                <div>
                  <span className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-amber-600" />
                    Periodicidad de la Partida
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, periodicidad: 'NO_PERIODICA_PUNTUAL' })}
                      className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                        formData.periodicidad === 'NO_PERIODICA_PUNTUAL'
                          ? 'bg-amber-50 border-amber-500 text-amber-900 ring-1 ring-amber-500'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">No Periódica (Puntual)</span>
                        {formData.periodicidad === 'NO_PERIODICA_PUNTUAL' && <Check className="w-4 h-4 text-amber-600" />}
                      </div>
                      <span className="text-[10px] text-slate-500 block mt-0.5">
                        Gasto extraordinario o de ocurrencia única
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, periodicidad: 'ANUAL' })}
                      className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                        formData.periodicidad !== 'NO_PERIODICA_PUNTUAL'
                          ? 'bg-slate-100 border-slate-400 text-slate-900 ring-1 ring-slate-400'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">Periódica / Recurrente</span>
                        {formData.periodicidad !== 'NO_PERIODICA_PUNTUAL' && <Check className="w-4 h-4 text-slate-700" />}
                      </div>
                      <span className="text-[10px] text-slate-500 block mt-0.5">
                        Mensual, semestral o anual programada
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Fila 3: Tratamiento de IVA y Desglose Financiero */}
              <div className="p-4 bg-emerald-50/40 rounded-xl border border-emerald-200 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-emerald-200">
                  <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                    <Percent className="w-4 h-4 text-emerald-600" />
                    Tratamiento y Simulación de IVA (Requerimiento del Contador)
                  </span>

                  {/* Selector Régimen IVA */}
                  <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-emerald-300 text-xs">
                    <button
                      type="button"
                      onClick={() => handleAfectacionIvaChange('AFECTO_IVA_19')}
                      className={`px-2.5 py-1 rounded font-bold cursor-pointer transition-all ${
                        formData.afectacionIva === 'AFECTO_IVA_19'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Afecto IVA 19% (Servicios)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAfectacionIvaChange('EXENTO')}
                      className={`px-2.5 py-1 rounded font-bold cursor-pointer transition-all ${
                        formData.afectacionIva === 'EXENTO'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Exento / Sin IVA
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAfectacionIvaChange('HONORARIOS_RETENCION')}
                      className={`px-2.5 py-1 rounded font-bold cursor-pointer transition-all ${
                        formData.afectacionIva === 'HONORARIOS_RETENCION'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Boleta Honorarios (Retención)
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Monto Neto (Base de Gasto) <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-2 text-slate-400 font-mono text-xs">$</span>
                      <input
                        type="number"
                        value={formData.montoNeto || ''}
                        onChange={(e) => handleMontoNetoChange(Number(e.target.value))}
                        className="w-full pl-6 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      IVA Crédito Fiscal (19%)
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-2 text-slate-400 font-mono text-xs">$</span>
                      <input
                        type="text"
                        readOnly
                        value={formData.montoIva.toLocaleString('es-CL')}
                        className="w-full pl-6 pr-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs font-mono font-bold text-emerald-700"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-900 mb-1">
                      Total a Liquidar en Caja <span className="text-rose-600">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-2 text-slate-400 font-mono text-xs">$</span>
                      <input
                        type="text"
                        readOnly
                        value={formData.montoTotal.toLocaleString('es-CL')}
                        className="w-full pl-6 pr-3 py-1.5 bg-rose-50 border border-rose-300 rounded-lg text-xs font-mono font-black text-rose-700"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Fecha Estimada Pago en Banco <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.fechaEstimadaPago}
                      onChange={(e) => setFormData({ ...formData, fechaEstimadaPago: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-1 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                    />
                  </div>
                </div>

                {formData.afectacionIva === 'AFECTO_IVA_19' && (
                  <label className="flex items-center gap-2 text-xs text-emerald-900 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={formData.simularCreditoFiscalF29}
                      onChange={(e) => setFormData({ ...formData, simularCreditoFiscalF29: e.target.checked })}
                      className="rounded border-emerald-400 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                    <span>
                      <strong>Simular Crédito Fiscal en F29:</strong> El IVA de esta provisión ({formatCLP(formData.montoIva)}) se rebajará del IVA Débito proyectado en el mes de vencimiento.
                    </span>
                  </label>
                )}
              </div>

              {/* Fila 4: Proveedor y Cuentas Contables */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Proveedor Estimado (Nombre)
                  </label>
                  <input
                    type="text"
                    value={formData.proveedorNombre}
                    onChange={(e) => setFormData({ ...formData, proveedorNombre: e.target.value })}
                    placeholder="Ej: KPMG Auditores / Proveedor Cloud"
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    RUT Proveedor (Opcional)
                  </label>
                  <input
                    type="text"
                    value={formData.proveedorRut}
                    onChange={(e) => setFormData({ ...formData, proveedorRut: e.target.value })}
                    placeholder="76.123.456-7"
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Cuenta Pasivo Provisión
                  </label>
                  <input
                    type="text"
                    value={formData.cuentaContableProvision}
                    onChange={(e) => setFormData({ ...formData, cuentaContableProvision: e.target.value })}
                    placeholder="2.1.03.015"
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Cuenta Gasto Asociada
                  </label>
                  <input
                    type="text"
                    value={formData.cuentaGastoAsociada}
                    onChange={(e) => setFormData({ ...formData, cuentaGastoAsociada: e.target.value })}
                    placeholder="6.1.02.001"
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Fila 5: Probabilidad, Centro de Costos y Devengo Inmediato */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-200">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Probabilidad de Ocurrencia ({formData.probabilidadMaterializacionPct}%)
                  </label>
                  <input
                    type="range"
                    min="30"
                    max="100"
                    step="5"
                    value={formData.probabilidadMaterializacionPct}
                    onChange={(e) => setFormData({ ...formData, probabilidadMaterializacionPct: Number(e.target.value) })}
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Centro de Costo
                  </label>
                  <select
                    value={formData.centroCostoId}
                    onChange={(e) => setFormData({ ...formData, centroCostoId: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs cursor-pointer"
                  >
                    <option value="CC-ADM-01">CC-ADM-01: Administración Central</option>
                    <option value="CC-FIN-01">CC-FIN-01: Finanzas & Auditoría</option>
                    <option value="CC-TI-01">CC-TI-01: Infraestructura & TI</option>
                    <option value="CC-OPER-01">CC-OPER-01: Operaciones & Planta</option>
                    <option value="CC-LEGAL-01">CC-LEGAL-01: Asuntos Legales</option>
                  </select>
                </div>

                {formData.naturaleza === 'CONTABLE' && !editingId && onAddEntry && (
                  <div className="flex items-center pt-4">
                    <label className="flex items-center gap-2 text-xs text-indigo-950 font-bold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.generarAsientoDevengo}
                        onChange={(e) => setFormData({ ...formData, generarAsientoDevengo: e.target.checked })}
                        className="rounded border-indigo-400 text-indigo-600 focus:ring-indigo-500 cursor-pointer w-4 h-4"
                      />
                      <span>Generar Asiento Contable de Devengo en Libro Diario</span>
                    </label>
                  </div>
                )}
              </div>

              {/* Botones de Acción */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{editingId ? 'Guardar Cambios' : 'Crear e Incorporar a Flujo de Caja'}</span>
                </button>
              </div>
            </div>
          ) : (
            /* ============================================================== */
            /* TABLA CRUD DE PARTIDAS DE PROVISIÓN                            */
            /* ============================================================== */
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-900 text-white border-b border-slate-800">
                    <th className="p-3 font-bold">Fecha Pago</th>
                    <th className="p-3 font-bold">Concepto & Contraparte</th>
                    <th className="p-3 font-bold text-center">Naturaleza</th>
                    <th className="p-3 font-bold text-center">Periodicidad</th>
                    <th className="p-3 font-bold text-right">Monto Neto</th>
                    <th className="p-3 font-bold text-right">IVA (19%)</th>
                    <th className="p-3 font-bold text-right">Egreso Caja Total</th>
                    <th className="p-3 font-bold text-center">Probabilidad</th>
                    <th className="p-3 font-bold text-center">Estado</th>
                    <th className="p-3 font-bold text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProvisiones.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-slate-400">
                        <FileSpreadsheet className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                        <p className="font-semibold">No se encontraron provisiones con los filtros seleccionados.</p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Haga clic en "+ Nueva Provisión" para dar de alta una partida contable o extracontable.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredProvisiones.map((p) => {
                      const montoNeto = p.montoNeto !== undefined ? p.montoNeto : p.montoEstimado;
                      const esAfecto = p.afectacionIva === 'AFECTO_IVA_19';
                      const montoIva = p.montoIva !== undefined ? p.montoIva : (esAfecto ? Math.round(montoNeto * 0.19) : 0);
                      const montoTotal = p.montoTotal !== undefined ? p.montoTotal : (montoNeto + montoIva);
                      const esContable = p.naturaleza === 'CONTABLE' || !p.naturaleza;
                      const esPuntual = p.periodicidad === 'NO_PERIODICA_PUNTUAL';

                      return (
                        <tr
                          key={p.id}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            p.estado === 'LIQUIDADA' ? 'opacity-60 bg-slate-50/40' : ''
                          }`}
                        >
                          {/* Fecha */}
                          <td className="p-3 font-mono font-semibold text-slate-800 whitespace-nowrap">
                            {p.fechaEstimadaPago}
                          </td>

                          {/* Concepto y Proveedor */}
                          <td className="p-3 max-w-xs">
                            <span className="font-bold text-slate-900 block leading-tight">{p.concepto}</span>
                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                              {p.proveedorNombre && (
                                <span className="font-medium text-slate-600">
                                  Prov: {p.proveedorNombre}
                                </span>
                              )}
                              <span className="font-mono text-[10px] text-slate-400">
                                Cta: {p.cuentaContableProvision}
                              </span>
                            </div>
                          </td>

                          {/* Naturaleza */}
                          <td className="p-3 text-center whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                                esContable
                                  ? 'bg-blue-100 text-blue-800 border-blue-300'
                                  : 'bg-purple-100 text-purple-800 border-purple-300'
                              }`}
                            >
                              {esContable ? 'Contable (NIC 37)' : 'Extracontable'}
                            </span>
                          </td>

                          {/* Periodicidad */}
                          <td className="p-3 text-center whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                esPuntual
                                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                                  : 'bg-slate-100 text-slate-700 border-slate-300'
                              }`}
                            >
                              {esPuntual ? 'Puntual' : p.periodicidad || 'Periódica'}
                            </span>
                          </td>

                          {/* Monto Neto */}
                          <td className="p-3 text-right font-mono font-medium text-slate-700">
                            {formatCLP(montoNeto)}
                          </td>

                          {/* IVA */}
                          <td className="p-3 text-right font-mono">
                            {montoIva > 0 ? (
                              <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                +{formatCLP(montoIva)}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[11px]">Exento / $0</span>
                            )}
                          </td>

                          {/* Total Caja */}
                          <td className="p-3 text-right font-mono font-black text-rose-600 whitespace-nowrap">
                            {formatCLP(montoTotal)}
                          </td>

                          {/* Probabilidad */}
                          <td className="p-3 text-center font-mono text-[11px]">
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 font-bold border border-slate-200">
                              {p.probabilidadMaterializacionPct || 90}%
                            </span>
                          </td>

                          {/* Estado */}
                          <td className="p-3 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleToggleEstado(p)}
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border cursor-pointer transition-all ${
                                p.estado === 'PENDIENTE'
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200'
                                  : 'bg-slate-200 text-slate-700 border-slate-300 hover:bg-slate-300'
                              }`}
                              title="Clic para cambiar entre Pendiente y Liquidada"
                            >
                              {p.estado === 'PENDIENTE' ? 'Pendiente' : 'Liquidada'}
                            </button>
                          </td>

                          {/* Acciones */}
                          <td className="p-3 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Asiento devengo si es Contable */}
                              {esContable && onAddEntry && (
                                <button
                                  type="button"
                                  onClick={() => handleGenerarAsiento(p)}
                                  className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                    p.asientoContableGenerado
                                      ? 'text-emerald-600 bg-emerald-50 border-emerald-300'
                                      : 'text-indigo-600 hover:bg-indigo-50 border-indigo-200'
                                  }`}
                                  title={
                                    p.asientoContableGenerado
                                      ? 'Asiento contable ya generado en Libro Diario'
                                      : 'Generar Asiento Contable formal de devengo en Libro Diario'
                                  }
                                >
                                  <BookOpen className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* Editar */}
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(p)}
                                className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                title="Editar provisión y parámetros"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              {/* Eliminar */}
                              <button
                                type="button"
                                onClick={() => handleDelete(p.id, p.concepto)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="Eliminar del ERP y flujo de caja"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 6. Footer con Resumen y Cierre */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="text-slate-600">
            <span>
              💡 <strong>Integración en tiempo real:</strong> Cualquier cambio en este ABM actualiza inmediatamente la Matriz de Flujo de Caja, los arrastres de saldos y la exportación de Excel.
            </span>
          </div>

          <div className="flex items-center gap-2">
            {!isFormOpen && (
              <button
                type="button"
                onClick={handleOpenNew}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>+ Agregar Provisión</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-bold transition-all cursor-pointer"
            >
              Cerrar ABM
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
