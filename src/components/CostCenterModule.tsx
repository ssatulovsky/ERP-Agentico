import React, { useState, useMemo } from 'react';
import {
  CostCenterMaster,
  CostCenterImputation,
  CostCenterCategory,
  ClientCompany,
  DteDocument,
  EmployeePayroll,
  WarehouseWithdrawal,
  FixedAsset,
} from '../types';
import { formatCLP } from '../utils/chileanAccounting';
import { SEED_COST_CENTERS } from '../data/seedCostCenters';
import {
  Building2,
  PieChart,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Briefcase,
  Users,
  ShoppingBag,
  PackageMinus,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Search,
  Filter,
  FileSpreadsheet,
  Target,
  FileCode,
} from 'lucide-react';
import { folioInterno } from '../utils/folioInterno';

interface CostCenterModuleProps {
  activeClient: ClientCompany;
  costCenters?: CostCenterMaster[];
  onUpdateCostCenters?: (ccs: CostCenterMaster[]) => void;
  invoices?: DteDocument[];
  withdrawals?: WarehouseWithdrawal[];
  payrollPeriods?: EmployeePayroll[];
  fixedAssets?: FixedAsset[];
}

export const CostCenterModule: React.FC<CostCenterModuleProps> = ({
  activeClient,
  costCenters = SEED_COST_CENTERS,
  onUpdateCostCenters,
  invoices = [],
  withdrawals = [],
  payrollPeriods = [],
  fixedAssets = [],
}) => {
  const [ccList, setCcList] = useState<CostCenterMaster[]>(costCenters);
  const [selectedCcId, setSelectedCcId] = useState<string>(ccList[0]?.id || '');
  const [activeTab, setActiveTab] = useState<'kpi' | 'abm' | 'pl' | 'imputaciones'>('kpi');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');

  // ABM Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCcId, setEditingCcId] = useState<string | null>(null);
  const [ccForm, setCcForm] = useState<Partial<CostCenterMaster>>({
    codigo: '',
    nombre: '',
    categoria: 'OPERACIONES',
    responsableNombre: '',
    responsableEmail: '',
    presupuestoMensualClp: 10000000,
    activo: true,
  });

  // Sync props
  React.useEffect(() => {
    if (costCenters && costCenters.length > 0) {
      setCcList(costCenters);
      if (!selectedCcId) setSelectedCcId(costCenters[0]?.id || '');
    }
  }, [costCenters]);

  const updateAndNotify = (newList: CostCenterMaster[]) => {
    setCcList(newList);
    if (onUpdateCostCenters) onUpdateCostCenters(newList);
  };

  const selectedCc = ccList.find((c) => c.id === selectedCcId) || ccList[0];

  // Activos Fijos vinculados al Centro de Costos seleccionado
  const selectedCcAssets = useMemo(() => {
    if (!selectedCc) return [];
    return fixedAssets.filter(
      (fa) =>
        fa.centroCostoId === selectedCc.id ||
        fa.centroCostoCodigo === selectedCc.codigo
    );
  }, [fixedAssets, selectedCc]);

  const selectedCcDeprecMensual = useMemo(() => {
    return selectedCcAssets.reduce(
      (sum, fa) => sum + (fa.cuotaDepreciacionMensualFinanciera || 0),
      0
    );
  }, [selectedCcAssets]);

  const selectedCcPpeValorLibro = useMemo(() => {
    return selectedCcAssets.reduce(
      (sum, fa) => sum + (fa.valorLibroFinanciero || 0),
      0
    );
  }, [selectedCcAssets]);

  // Facturas y líneas de factura (ítems) vinculadas al Centro de Costos seleccionado
  const selectedCcInvoices = useMemo(() => {
    if (!selectedCc) return [];
    const results: Array<{
      dte: DteDocument;
      itemName?: string;
      montoImputado: number;
      isItemLevel: boolean;
      cuentaCodigo?: string;
    }> = [];

    invoices.forEach((doc) => {
      let hasItemMatch = false;
      if (doc.items && doc.items.length > 0) {
        doc.items.forEach((it) => {
          if (
            it.centroCostoId === selectedCc.id ||
            it.centroCostoCodigo === selectedCc.codigo
          ) {
            hasItemMatch = true;
            results.push({
              dte: doc,
              itemName: it.nombre,
              montoImputado: it.montoTotal,
              isItemLevel: true,
              cuentaCodigo: it.cuentaCodigo,
            });
          }
        });
      }

      if (!hasItemMatch) {
        if (
          doc.centroCostoId === selectedCc.id ||
          doc.centroCostoCodigo === selectedCc.codigo
        ) {
          results.push({
            dte: doc,
            itemName: doc.glosa || 'Total Documento',
            montoImputado: (doc.montoNeto || 0) + (doc.montoExento || 0) || doc.montoTotal,
            isItemLevel: false,
            cuentaCodigo: doc.tipoOperacion === 'VENTA' ? '4.1.01' : (doc.cuentaGastoImputadaCodigo || '5.1.01'),
          });
        }
      }
    });

    return results;
  }, [invoices, selectedCc]);

  // Consolidate totals across all mini-enterprises
  const totalVentasAllCC = ccList.reduce((acc, c) => acc + c.ventasAcumuladasMes, 0);
  const totalCostosAllCC = ccList.reduce((acc, c) => acc + c.costosDirectosMes, 0);
  const totalGastosAllCC = ccList.reduce((acc, c) => acc + c.gastosOperacionalesMes, 0);
  const totalNominaAllCC = ccList.reduce((acc, c) => acc + c.remuneracionesMes, 0);
  const totalResultadoAllCC = totalVentasAllCC - totalCostosAllCC - totalGastosAllCC - totalNominaAllCC;

  // Filtered CCs
  const filteredCcs = ccList.filter((c) => {
    const matchesSearch =
      c.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.codigo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.responsableNombre.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = filterCategory === 'ALL' || c.categoria === filterCategory;
    return matchesSearch && matchesCat;
  });

  // Open Create
  const handleOpenCreate = () => {
    setEditingCcId(null);
    setCcForm({
      codigo: folioInterno('CC'),
      nombre: '',
      categoria: 'OPERACIONES',
      responsableNombre: 'Jefatura Departamental',
      responsableEmail: 'departamento@maraustral.cl',
      presupuestoMensualClp: 12000000,
      activo: true,
    });
    setIsModalOpen(true);
  };

  // Open Edit
  const handleOpenEdit = (cc: CostCenterMaster) => {
    setEditingCcId(cc.id);
    setCcForm({ ...cc });
    setIsModalOpen(true);
  };

  // Delete / Inactivate
  const handleDeleteCc = (id: string, nombre: string) => {
    if (ccList.length <= 1) {
      alert('La empresa debe mantener al menos un Centro de Costo activo.');
      return;
    }
    if (!window.confirm(`¿Confirmas la baja del Centro de Costo / Mini-Empresa "${nombre}"?`)) return;
    const updated = ccList.filter((c) => c.id !== id);
    updateAndNotify(updated);
    if (selectedCcId === id) setSelectedCcId(updated[0]?.id || '');
  };

  // Save CC
  const handleSaveCc = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ccForm.codigo || !ccForm.nombre) {
      alert('Código y Nombre de Centro de Costo son requeridos.');
      return;
    }

    if (editingCcId) {
      const updated = ccList.map((c) =>
        c.id === editingCcId
          ? ({
              ...c,
              ...ccForm,
              codigo: (ccForm.codigo || c.codigo).toUpperCase(),
            } as CostCenterMaster)
          : c
      );
      updateAndNotify(updated);
    } else {
      const newCc: CostCenterMaster = {
        id: `cc-${Date.now()}`,
        empresaId: activeClient.id,
        codigo: (ccForm.codigo || 'CC-NEW').toUpperCase(),
        nombre: ccForm.nombre || 'Nuevo Centro de Costo',
        categoria: (ccForm.categoria as CostCenterCategory) || 'OPERACIONES',
        responsableNombre: ccForm.responsableNombre || 'Encargado',
        responsableEmail: ccForm.responsableEmail || '',
        presupuestoMensualClp: Number(ccForm.presupuestoMensualClp) || 0,
        ventasAcumuladasMes: 0,
        costosDirectosMes: 0,
        gastosOperacionalesMes: 0,
        remuneracionesMes: 0,
        margenContribucionClp: 0,
        margenContribucionPct: 0,
        desviacionPresupuestariaClp: 0,
        activo: ccForm.activo ?? true,
      };
      const updated = [...ccList, newCc];
      updateAndNotify(updated);
      setSelectedCcId(newCc.id);
    }
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-indigo-100 text-indigo-800 border border-indigo-200 flex items-center gap-1">
                <PieChart className="w-3.5 h-3.5" />
                Departamentalización & Mini-Empresas
              </span>
              <span className="text-slate-400 text-xs">|</span>
              <span className="text-xs text-slate-500 font-mono">
                Cliente: <strong className="text-slate-800">{activeClient.razonSocial}</strong> ({activeClient.rut})
              </span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
              <span>Centros de Costo & Mini-Empresas Descentralizadas</span>
            </h1>
            <p className="text-xs text-slate-500 max-w-3xl leading-relaxed">
              Permite a la organización operar como una confederación de subunidades autónomas (mini-empresas).
              Cada centro de costo agrupa en tiempo real sus propias Ventas (DTE 33), Compras e Insumos (DTE 34/46 y Bodega),
              y Nómina de Remuneraciones, generando balances de resultados y márgenes de contribución individuales.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenCreate}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow-sm transition-all cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>+ Nuevo Centro de Costo</span>
            </button>
          </div>
        </div>

        {/* Global Mini-Enterprises Consolidation KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4 pt-4 border-t border-slate-100 text-xs">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <span className="text-slate-400 block text-[11px]">Ventas Consolidadas CC</span>
            <strong className="text-base font-black text-slate-900 font-mono">
              {formatCLP(totalVentasAllCC)}
            </strong>
            <span className="text-[10px] text-emerald-600 block mt-0.5">Ingresos DTE 33 Facturados</span>
          </div>

          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <span className="text-slate-400 block text-[11px]">Costos Directos & Materiales</span>
            <strong className="text-base font-black text-amber-700 font-mono">
              {formatCLP(totalCostosAllCC)}
            </strong>
            <span className="text-[10px] text-amber-700 block mt-0.5">Bodega + Facturas Proveedor</span>
          </div>

          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <span className="text-slate-400 block text-[11px]">Nómina & Remuneraciones</span>
            <strong className="text-base font-black text-blue-700 font-mono">
              {formatCLP(totalNominaAllCC)}
            </strong>
            <span className="text-[10px] text-blue-600 block mt-0.5">Sueldos Imputados por CC</span>
          </div>

          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <span className="text-slate-400 block text-[11px]">Gastos Operacionales</span>
            <strong className="text-base font-black text-slate-800 font-mono">
              {formatCLP(totalGastosAllCC)}
            </strong>
            <span className="text-[10px] text-slate-500 block mt-0.5">Arriendos, Luz, Fletes</span>
          </div>

          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <span className="text-slate-400 block text-[11px]">Resultado Neto Global CC</span>
            <strong
              className={`text-base font-black font-mono ${
                totalResultadoAllCC >= 0 ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {formatCLP(totalResultadoAllCC)}
            </strong>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              Margen: {totalVentasAllCC > 0 ? ((totalResultadoAllCC / totalVentasAllCC) * 100).toFixed(1) : 0}%
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 text-xs font-bold">
        <button
          onClick={() => setActiveTab('kpi')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition-all cursor-pointer ${
            activeTab === 'kpi'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Tablero de Mini-Empresas</span>
        </button>

        <button
          onClick={() => setActiveTab('pl')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition-all cursor-pointer ${
            activeTab === 'pl'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Estado de Resultados (P&L) por Subunidad</span>
        </button>

        <button
          onClick={() => setActiveTab('abm')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition-all cursor-pointer ${
            activeTab === 'abm'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Maestro de Centros de Costo (ABM)</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 text-slate-800">
            {ccList.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('imputaciones')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition-all cursor-pointer ${
            activeTab === 'imputaciones'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Target className="w-4 h-4" />
          <span>Activos Fijos & DTE Vinculados</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-100 text-indigo-800 font-bold">
            {selectedCcAssets.length + selectedCcInvoices.length}
          </span>
        </button>
      </div>

      {/* TAB 1: TABLERO DE MINI-EMPRESAS */}
      {activeTab === 'kpi' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Subunits List */}
          <div className="lg:col-span-5 space-y-3">
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar mini-empresa o centro de costo..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:bg-white"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                {['ALL', 'VENTAS', 'PRODUCCION', 'OPERACIONES', 'LOGISTICA', 'ADMINISTRACION'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setFilterCategory(cat)}
                    className={`px-2 py-1 rounded text-[10px] font-bold whitespace-nowrap cursor-pointer ${
                      filterCategory === cat
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat === 'ALL' ? 'Todas' : cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {filteredCcs.map((cc) => {
                const isSelected = selectedCc?.id === cc.id;
                const isProfit = cc.margenContribucionClp >= 0;
                return (
                  <div
                    key={cc.id}
                    onClick={() => setSelectedCcId(cc.id)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50/70 border-indigo-500 shadow-sm ring-1 ring-indigo-400'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-xs text-indigo-900 bg-indigo-100 px-2 py-0.5 rounded">
                            {cc.codigo}
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            {cc.categoria}
                          </span>
                        </div>
                        <h4 className="font-extrabold text-xs text-slate-900 mt-1">{cc.nombre}</h4>
                      </div>

                      <span
                        className={`text-xs font-mono font-black px-2.5 py-0.5 rounded-full ${
                          isProfit
                            ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                            : 'bg-rose-100 text-rose-900 border border-rose-300'
                        }`}
                      >
                        {formatCLP(cc.margenContribucionClp)}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-2.5 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Ventas Mes</span>
                        <strong className="text-slate-900 font-mono font-bold">
                          {formatCLP(cc.ventasAcumuladasMes)}
                        </strong>
                      </div>

                      <div>
                        <span className="text-slate-400 block text-[10px]">Gastos + Costos</span>
                        <strong className="text-amber-700 font-mono font-bold">
                          {formatCLP(cc.costosDirectosMes + cc.gastosOperacionalesMes + cc.remuneracionesMes)}
                        </strong>
                      </div>

                      <div className="text-right">
                        <span className="text-slate-400 block text-[10px]">Margen (%)</span>
                        <strong
                          className={`font-mono font-black ${
                            cc.margenContribucionPct >= 0 ? 'text-emerald-600' : 'text-rose-600'
                          }`}
                        >
                          {cc.margenContribucionPct}%
                        </strong>
                      </div>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                      <span>Líder: {cc.responsableNombre}</span>
                      <span className="font-mono">Ppto: {formatCLP(cc.presupuestoMensualClp)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Detailed View for Selected Mini-Enterprise */}
          <div className="lg:col-span-7">
            {selectedCc ? (
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-sm text-indigo-900 bg-indigo-100 px-2 py-0.5 rounded">
                        {selectedCc.codigo}
                      </span>
                      <span className="text-xs font-bold text-slate-500 uppercase">{selectedCc.categoria}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                        AUTÓNOMA
                      </span>
                    </div>
                    <h3 className="text-lg font-black text-slate-900 mt-1">{selectedCc.nombre}</h3>
                    <p className="text-xs text-slate-500">
                      Responsable de la Mini-Empresa: <strong>{selectedCc.responsableNombre}</strong> (
                      {selectedCc.responsableEmail})
                    </p>
                  </div>

                  <button
                    onClick={() => handleOpenEdit(selectedCc)}
                    className="p-2 border border-slate-200 text-slate-600 hover:text-indigo-600 rounded-lg cursor-pointer"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>

                {/* Subunit P&L Breakdown */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-indigo-600" />
                    <span>Desglose de Ingresos, Costos y Gastos de la Mini-Empresa</span>
                  </h4>

                  <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                        <tr>
                          <th className="py-2 px-3">Rubro Operacional</th>
                          <th className="py-2 px-3">Módulo de Origen</th>
                          <th className="py-2 px-3 text-right">Monto CLP</th>
                          <th className="py-2 px-3 text-right">% s/ Venta</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        <tr className="bg-emerald-50/40">
                          <td className="py-2 px-3 font-bold text-slate-900">
                            (+) Ingresos por Ventas Facturadas
                          </td>
                          <td className="py-2 px-3 text-slate-500">Facturas DTE 33 (Ventas)</td>
                          <td className="py-2 px-3 text-right font-mono font-black text-emerald-800">
                            {formatCLP(selectedCc.ventasAcumuladasMes)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-emerald-800">100.0%</td>
                        </tr>

                        <tr>
                          <td className="py-2 px-3 font-medium text-slate-800 pl-6">
                            (-) Costos Directos & Consumo Insumos
                          </td>
                          <td className="py-2 px-3 text-slate-500">Bodega & Facturas Proveedor</td>
                          <td className="py-2 px-3 text-right font-mono font-semibold text-rose-700">
                            -{formatCLP(selectedCc.costosDirectosMes)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-600">
                            {selectedCc.ventasAcumuladasMes > 0
                              ? ((selectedCc.costosDirectosMes / selectedCc.ventasAcumuladasMes) * 100).toFixed(1)
                              : 0}
                            %
                          </td>
                        </tr>

                        <tr>
                          <td className="py-2 px-3 font-medium text-slate-800 pl-6">
                            (-) Remuneraciones & Cargas Sociales
                          </td>
                          <td className="py-2 px-3 text-slate-500">Módulo Nómina & Previred</td>
                          <td className="py-2 px-3 text-right font-mono font-semibold text-rose-700">
                            -{formatCLP(selectedCc.remuneracionesMes)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-600">
                            {selectedCc.ventasAcumuladasMes > 0
                              ? ((selectedCc.remuneracionesMes / selectedCc.ventasAcumuladasMes) * 100).toFixed(1)
                              : 0}
                            %
                          </td>
                        </tr>

                        <tr>
                          <td className="py-2 px-3 font-medium text-slate-800 pl-6">
                            (-) Gastos Operacionales Departamentales
                          </td>
                          <td className="py-2 px-3 text-slate-500">Compras Administrativas</td>
                          <td className="py-2 px-3 text-right font-mono font-semibold text-rose-700">
                            -{formatCLP(selectedCc.gastosOperacionalesMes)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-600">
                            {selectedCc.ventasAcumuladasMes > 0
                              ? ((selectedCc.gastosOperacionalesMes / selectedCc.ventasAcumuladasMes) * 100).toFixed(
                                  1
                                )
                              : 0}
                            %
                          </td>
                        </tr>

                        {/* Result Row */}
                        <tr className="bg-slate-100 font-bold">
                          <td className="py-2.5 px-3 text-slate-900">
                            (=) Margen de Contribución Operativa (EBITDA Mini-Empresa)
                          </td>
                          <td className="py-2.5 px-3 text-indigo-700 font-mono">Consolidado CC</td>
                          <td
                            className={`py-2.5 px-3 text-right font-mono font-black text-sm ${
                              selectedCc.margenContribucionClp >= 0 ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            {formatCLP(selectedCc.margenContribucionClp)}
                          </td>
                          <td
                            className={`py-2.5 px-3 text-right font-mono font-black text-sm ${
                              selectedCc.margenContribucionPct >= 0 ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            {selectedCc.margenContribucionPct}%
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Budget vs Real Watchdog */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
                  <div className="flex items-center justify-between font-bold">
                    <span className="text-slate-700">Control de Ejecución Presupuestaria Mensual:</span>
                    <span className="font-mono text-indigo-900">
                      Gasto Acumulado:{' '}
                      {formatCLP(
                        selectedCc.costosDirectosMes +
                          selectedCc.gastosOperacionalesMes +
                          selectedCc.remuneracionesMes
                      )}{' '}
                      / Ppto: {formatCLP(selectedCc.presupuestoMensualClp)}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  {(() => {
                    const totalGasto =
                      selectedCc.costosDirectosMes +
                      selectedCc.gastosOperacionalesMes +
                      selectedCc.remuneracionesMes;
                    const pct =
                      selectedCc.presupuestoMensualClp > 0
                        ? (totalGasto / selectedCc.presupuestoMensualClp) * 100
                        : 0;
                    const isExceeded = pct > 100;
                    return (
                      <>
                        <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              isExceeded ? 'bg-rose-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[11px] text-slate-500">
                          <span>Ejecutado: {pct.toFixed(1)}%</span>
                          <span
                            className={`font-mono font-bold ${
                              selectedCc.desviacionPresupuestariaClp >= 0 ? 'text-emerald-600' : 'text-rose-600'
                            }`}
                          >
                            {selectedCc.desviacionPresupuestariaClp >= 0
                              ? `Ahorro Disponible: ${formatCLP(selectedCc.desviacionPresupuestariaClp)}`
                              : `Sobregiro: ${formatCLP(Math.abs(selectedCc.desviacionPresupuestariaClp))}`}
                          </span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-400">
                <Building2 className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                <p>Selecciona una mini-empresa para ver su desglose contable</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: P&L COMPARATIVE MATRIX */}
      {activeTab === 'pl' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-600" />
              <span>Matriz Comparativa de Mini-Empresas (P&L Descentralizado)</span>
            </h3>
            <span className="text-xs text-slate-500 font-mono">Moneda: CLP</span>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                <tr>
                  <th className="py-3 px-3">Código</th>
                  <th className="py-3 px-3">Mini-Empresa / Centro Costo</th>
                  <th className="py-3 px-3 text-right">Ventas (DTE 33)</th>
                  <th className="py-3 px-3 text-right">Costos Directos</th>
                  <th className="py-3 px-3 text-right">Remuneraciones</th>
                  <th className="py-3 px-3 text-right">Gastos Op.</th>
                  <th className="py-3 px-3 text-right">Resultado Neto</th>
                  <th className="py-3 px-3 text-right">Margen (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ccList.map((cc) => (
                  <tr key={cc.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-mono font-bold text-indigo-900">{cc.codigo}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">
                      {cc.nombre}
                      <span className="text-slate-400 block text-[10px]">{cc.responsableNombre}</span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-900">
                      {formatCLP(cc.ventasAcumuladasMes)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-amber-700">
                      -{formatCLP(cc.costosDirectosMes)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-blue-700">
                      -{formatCLP(cc.remuneracionesMes)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                      -{formatCLP(cc.gastosOperacionalesMes)}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right font-mono font-bold ${
                        cc.margenContribucionClp >= 0 ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {formatCLP(cc.margenContribucionClp)}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right font-mono font-black ${
                        cc.margenContribucionPct >= 0 ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {cc.margenContribucionPct}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: ABM MAESTRO DE CENTROS DE COSTO */}
      {activeTab === 'abm' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Building2 className="w-4 h-4 text-indigo-600" />
                <span>Catálogo Maestro de Centros de Costo (Altas, Bajas y Modificaciones)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Crea, edita o inactiva subunidades departamentales de la empresa.
              </p>
            </div>

            <button
              onClick={handleOpenCreate}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-2 rounded-lg cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Crear Centro de Costo</span>
            </button>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                <tr>
                  <th className="py-2.5 px-3">Código</th>
                  <th className="py-2.5 px-3">Nombre</th>
                  <th className="py-2.5 px-3">Categoría</th>
                  <th className="py-2.5 px-3">Responsable</th>
                  <th className="py-2.5 px-3 text-right">Presupuesto Mensual</th>
                  <th className="py-2.5 px-3 text-center">Estado</th>
                  <th className="py-2.5 px-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ccList.map((cc) => (
                  <tr key={cc.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-mono font-bold text-indigo-900">{cc.codigo}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">{cc.nombre}</td>
                    <td className="py-2.5 px-3">
                      <span className="bg-slate-100 px-2 py-0.5 rounded text-[10px] font-bold text-slate-700">
                        {cc.categoria}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-700">{cc.responsableNombre}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                      {formatCLP(cc.presupuestoMensualClp)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          cc.activo ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {cc.activo ? 'ACTIVO' : 'INACTIVO'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleOpenEdit(cc)}
                          className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded cursor-pointer"
                          title="Editar"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteCc(cc.id, cc.nombre)}
                          className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                          title="Eliminar"
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
      )}

      {/* TAB 4: IMPUTACIONES DIRECTAS (ACTIVOS FIJOS & DTE) */}
      {activeTab === 'imputaciones' && (
        <div className="space-y-6">
          {/* Header & CC Selector */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Imputaciones Directas: Activos Fijos & Facturas Electrónicas
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                Trazabilidad integral de activos fijos (propiedad, planta y equipos) y líneas de detalle de facturas electrónicas atribuidas a esta unidad de negocio.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600">Centro de Costo:</span>
              <select
                value={selectedCc?.id}
                onChange={(e) => setSelectedCcId(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-bold text-indigo-900 focus:outline-none focus:border-indigo-600 cursor-pointer"
              >
                {ccList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.codigo} - {c.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
              <span className="text-xs text-slate-500 block font-medium">Activos Fijos Asignados</span>
              <div className="text-2xl font-black text-slate-900 mt-1 font-mono flex items-baseline gap-2">
                {selectedCcAssets.length}
                <span className="text-xs font-normal text-slate-500 font-sans">bienes de capital</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Patrimonio operativo en esta faena
              </p>
            </div>

            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
              <span className="text-xs text-slate-500 block font-medium">Valor Libro IFRS en Operación</span>
              <div className="text-2xl font-black text-emerald-700 mt-1 font-mono">
                {formatCLP(selectedCcPpeValorLibro)}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Costo neto según normas contables
              </p>
            </div>

            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
              <span className="text-xs text-slate-500 block font-medium">Depreciación Mensual PPE</span>
              <div className="text-2xl font-black text-rose-600 mt-1 font-mono">
                {formatCLP(selectedCcDeprecMensual)}
                <span className="text-xs font-normal text-slate-500 font-sans">/mes</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Carga periódica en P&L analítico
              </p>
            </div>

            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
              <span className="text-xs text-slate-500 block font-medium">DTEs & Ítems Imputados</span>
              <div className="text-2xl font-black text-indigo-700 mt-1 font-mono flex items-baseline gap-2">
                {selectedCcInvoices.length}
                <span className="text-xs font-normal text-slate-500 font-sans">registros</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Partidas asignadas con trazabilidad
              </p>
            </div>
          </div>

          {/* SECCIÓN 1: ACTIVOS FIJOS VINCULADOS */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm space-y-3 p-5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-indigo-600" />
                  Activos Fijos Vinculados al Centro de Costos ({selectedCc?.codigo} - {selectedCc?.nombre})
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Maquinarias, equipos e instalaciones asignadas cuya depreciación amortiza contra este centro.
                </p>
              </div>
              <span className="px-2.5 py-1 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg text-xs font-bold font-mono">
                {selectedCcAssets.length} activo(s)
              </span>
            </div>

            {selectedCcAssets.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-lg border border-dashed border-slate-300 space-y-2">
                <Building2 className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-xs font-semibold text-slate-700">No hay activos fijos asignados a este centro de costos</p>
                <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                  Para vincular un bien de uso, vaya al módulo de <strong>Activos Fijos</strong>, seleccione el activo o dé de alta uno nuevo asignando este centro de costo.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-semibold uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Placa / Código</th>
                      <th className="py-2.5 px-3">Nombre del Activo</th>
                      <th className="py-2.5 px-3">Ubicación / Custodio</th>
                      <th className="py-2.5 px-3 text-right">Costo Histórico</th>
                      <th className="py-2.5 px-3 text-right">Deprec. Acumulada</th>
                      <th className="py-2.5 px-3 text-right">Valor Libro IFRS</th>
                      <th className="py-2.5 px-3 text-right">Deprec. Mensual</th>
                      <th className="py-2.5 px-3 text-center">Clasificación Contable</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {selectedCcAssets.map((asset) => (
                      <tr key={asset.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-indigo-700">
                          {asset.codigoPlaca}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-900">
                          {asset.nombre}
                          {asset.marcaModelo && (
                            <span className="text-[10px] text-slate-400 block">{asset.marcaModelo}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          <div>{asset.ubicacionFisica}</div>
                          <span className="text-[10px] text-slate-400">{asset.responsableCustodio}</span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-800">
                          {formatCLP(asset.valorAdquisicionOriginal)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-rose-600">
                          {formatCLP(asset.depreciacionAcumuladaFinanciera)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                          {formatCLP(asset.valorLibroFinanciero)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-700">
                          {formatCLP(asset.cuotaDepreciacionMensualFinanciera)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {asset.esFabrilProduccion ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-50 text-cyan-800 border border-cyan-200">
                              CIF Fabril (5.1.04)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                              Gasto Admin (5.2.13)
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* SECCIÓN 2: FACTURAS ELECTRÓNICAS E ÍTEMS ASIGNADOS */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm space-y-3 p-5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-indigo-600" />
                  Facturas Electrónicas (DTE) e Ítems Imputados a este Centro de Costos
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Ventas y compras imputadas a nivel de documento completo o partidas específicas de detalle.
                </p>
              </div>
              <span className="px-2.5 py-1 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg text-xs font-bold font-mono">
                {selectedCcInvoices.length} partida(s)
              </span>
            </div>

            {selectedCcInvoices.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-lg border border-dashed border-slate-300 space-y-2">
                <FileCode className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-xs font-semibold text-slate-700">No hay facturas ni ítems imputados a este centro de costos</p>
                <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                  En el módulo de <strong>Facturación y DTE</strong>, use el botón "Ítems & CC" en cualquier factura para asignar el centro de costo a partidas específicas de la factura.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-semibold uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Tipo</th>
                      <th className="py-2.5 px-3">Folio</th>
                      <th className="py-2.5 px-3">Fecha</th>
                      <th className="py-2.5 px-3">Contraparte</th>
                      <th className="py-2.5 px-3">Partida / Ítem de Factura</th>
                      <th className="py-2.5 px-3">Cuenta Contable</th>
                      <th className="py-2.5 px-3 text-right">Monto Imputado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {selectedCcInvoices.map((inv, idx) => (
                      <tr key={`${inv.dte.id}-${idx}`} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            inv.dte.tipoOperacion === 'VENTA'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-blue-50 text-blue-800 border border-blue-200'
                          }`}>
                            {inv.dte.tipoOperacion}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                          {inv.dte.folio}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">
                          {inv.dte.fechaEmision}
                        </td>
                        <td className="py-2.5 px-3 text-slate-800 font-medium">
                          {inv.dte.razonSocialContraparte}
                          <span className="text-[10px] text-slate-400 block font-mono">{inv.dte.rutContraparte}</span>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1.5">
                            {inv.isItemLevel ? (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                Ítem Factura
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                                Cabecera
                              </span>
                            )}
                            <span className="font-medium text-slate-800">{inv.itemName}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600 text-[11px]">
                          {inv.cuentaCodigo || '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                          {formatCLP(inv.montoImputado)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Crear / Editar Centro de Costo */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 my-8 space-y-4 text-xs">
            <h3 className="text-base font-extrabold text-slate-900">
              {editingCcId ? 'Editar Centro de Costo / Mini-Empresa' : 'Crear Nuevo Centro de Costo'}
            </h3>
            <p className="text-slate-500">
              Define la subunidad departamental para agrupamiento de ventas, compras, nómina y existencias.
            </p>

            <form onSubmit={handleSaveCc} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Código (ej: CC-VTA-01)</label>
                  <input
                    type="text"
                    required
                    value={ccForm.codigo}
                    onChange={(e) => setCcForm({ ...ccForm, codigo: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Categoría</label>
                  <select
                    value={ccForm.categoria}
                    onChange={(e) =>
                      setCcForm({ ...ccForm, categoria: e.target.value as CostCenterCategory })
                    }
                    className="w-full p-2 border border-slate-300 rounded font-semibold"
                  >
                    <option value="ADMINISTRACION">ADMINISTRACION</option>
                    <option value="VENTAS">VENTAS</option>
                    <option value="OPERACIONES">OPERACIONES</option>
                    <option value="PRODUCCION">PRODUCCION</option>
                    <option value="LOGISTICA">LOGISTICA</option>
                    <option value="SUCURSAL">SUCURSAL</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Nombre Descriptivo</label>
                <input
                  type="text"
                  required
                  placeholder="ej: Ventas & Retail Zona Metropolitana"
                  value={ccForm.nombre}
                  onChange={(e) => setCcForm({ ...ccForm, nombre: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Responsable / Jefe</label>
                  <input
                    type="text"
                    required
                    value={ccForm.responsableNombre}
                    onChange={(e) => setCcForm({ ...ccForm, responsableNombre: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Email del Responsable</label>
                  <input
                    type="email"
                    value={ccForm.responsableEmail}
                    onChange={(e) => setCcForm({ ...ccForm, responsableEmail: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Presupuesto Mensual Asignado ($ CLP)</label>
                <input
                  type="number"
                  min="0"
                  value={ccForm.presupuestoMensualClp}
                  onChange={(e) => setCcForm({ ...ccForm, presupuestoMensualClp: Number(e.target.value) })}
                  className="w-full p-2 border border-slate-300 rounded font-mono font-bold text-indigo-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow cursor-pointer transition"
                >
                  Guardar Centro de Costo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
