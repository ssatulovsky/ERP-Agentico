import React, { useState } from 'react';
import { 
  TrendingUp, 
  Plus, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Calendar, 
  AlertTriangle, 
  Search, 
  RefreshCw,
  X
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend
} from 'recharts';
import { CashFlowMovement, DteDocument, ChileIndicators, CompanyProfile } from '../types';
import { formatCLP, formatNumberCL } from '../utils/chileanAccounting';

interface CashFlowProjectionsProps {
  movements: CashFlowMovement[];
  onAddMovement: (mov: CashFlowMovement) => void;
  onUpdateMovement: (mov: CashFlowMovement) => void;
  dtes: DteDocument[];
  indicators: ChileIndicators;
  company: CompanyProfile;
}

export const CashFlowProjections: React.FC<CashFlowProjectionsProps> = ({
  movements = [],
  onAddMovement,
  onUpdateMovement,
  dtes = [],
  indicators,
}) => {
  const safeMovements = Array.isArray(movements) ? movements : [];
  const safeDtes = Array.isArray(dtes) ? dtes : [];

  const [scenario, setScenario] = useState<'BASE' | 'OPTIMISTA' | 'ESTRESADO'>('BASE');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'INGRESO' | 'EGRESO'>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // New Movement Form
  const [newMov, setNewMov] = useState<Partial<CashFlowMovement>>({
    tipo: 'INGRESO',
    concepto: '',
    contraparte: '',
    rutContraparte: '',
    categoria: 'VENTAS_OPERACIONALES',
    fechaEstimada: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
    montoNeto: 1000000,
    montoIva: 190000,
    montoTotal: 1190000,
    moneda: 'CLP',
    estado: 'PENDIENTE',
  });

  // Calculate totals
  const totalIngresos = safeMovements
    .filter(m => m.tipo === 'INGRESO')
    .reduce((s, m) => s + m.montoTotal, 0);

  const totalEgresos = safeMovements
    .filter(m => m.tipo === 'EGRESO')
    .reduce((s, m) => s + m.montoTotal, 0);

  const saldoNetoCaja = totalIngresos - totalEgresos;

  const getMultiplier = () => {
    if (scenario === 'OPTIMISTA') return { ing: 1.15, egr: 0.95 };
    if (scenario === 'ESTRESADO') return { ing: 0.70, egr: 1.10 };
    return { ing: 1.0, egr: 1.0 };
  };

  const mult = getMultiplier();

  // Weekly/Monthly chart points
  const chartData = [
    {
      periodo: 'Semana 1',
      ingresos: Math.round(14500000 * mult.ing),
      egresos: Math.round(6200000 * mult.egr),
      saldoAcumulado: Math.round(8300000 * mult.ing),
    },
    {
      periodo: 'Semana 2',
      ingresos: Math.round(8900000 * mult.ing),
      egresos: Math.round(11400000 * mult.egr),
      saldoAcumulado: Math.round(5800000 * mult.ing),
    },
    {
      periodo: '30 Días',
      ingresos: Math.round(26000000 * mult.ing),
      egresos: Math.round(17000000 * mult.egr),
      saldoAcumulado: Math.round(14800000 * mult.ing),
    },
    {
      periodo: '60 Días',
      ingresos: Math.round(48000000 * mult.ing),
      egresos: Math.round(31000000 * mult.egr),
      saldoAcumulado: Math.round(31800000 * mult.ing),
    },
    {
      periodo: '90 Días',
      ingresos: Math.round(69000000 * mult.ing),
      egresos: Math.round(44500000 * mult.egr),
      saldoAcumulado: Math.round(56300000 * mult.ing),
    },
  ];

  // Inconsistency detection between RCV & Cash Flow
  const pendingSalesDtes = safeDtes.filter(d => d.tipoOperacion === 'VENTA' && d.estadoPago === 'PENDIENTE');
  const dtesNotInCashFlow = pendingSalesDtes.filter(
    d => !safeMovements.some(m => m.dteFolioAsociado === d.folio || m.concepto.includes(d.folio.toString()))
  );

  const handleSyncDtesToCashflow = () => {
    let count = 0;
    dtesNotInCashFlow.forEach((d) => {
      const mov: CashFlowMovement = {
        id: `mov-sync-${Date.now()}-${Math.random()}`,
        fechaEstimada: d.fechaVencimiento || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
        concepto: `Cobranza Factura Venta N° ${d.folio} - ${d.razonSocialContraparte}`,
        contraparte: d.razonSocialContraparte,
        rutContraparte: d.rutContraparte,
        tipo: 'INGRESO',
        categoria: 'VENTAS_OPERACIONALES',
        montoNeto: d.montoNeto,
        montoIva: d.montoIva,
        montoTotal: d.montoTotal,
        moneda: 'CLP',
        estado: 'FACTURADO',
        dteFolioAsociado: d.folio,
      };
      onAddMovement(mov);
      count++;
    });
    alert(`¡Se sincronizaron exitosamente ${count} facturas por cobrar desde el RCV al Flujo de Caja!`);
  };

  const handleCreateMovement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMov.concepto || !newMov.contraparte) return;

    const neto = Number(newMov.montoNeto || 0);
    const iva = Number(newMov.montoIva || Math.round(neto * 0.19));
    const total = Number(newMov.montoTotal || neto + iva);

    const created: CashFlowMovement = {
      id: `mov-${Date.now()}`,
      fechaEstimada: newMov.fechaEstimada || new Date().toISOString().split('T')[0],
      fechaReal: newMov.fechaReal,
      concepto: newMov.concepto!,
      contraparte: newMov.contraparte!,
      rutContraparte: newMov.rutContraparte || '76.000.000-0',
      tipo: newMov.tipo as any,
      categoria: (newMov.categoria as any) || 'VENTAS_OPERACIONALES',
      montoNeto: neto,
      montoIva: iva,
      montoTotal: total,
      moneda: (newMov.moneda as any) || 'CLP',
      valorUfReferencia: newMov.moneda === 'UF' ? indicators.uf : undefined,
      estado: (newMov.estado as any) || 'PENDIENTE',
    };

    onAddMovement(created);
    setShowAddModal(false);
  };

  // Filtered movements
  const filteredMovements = safeMovements.filter((m) => {
    const matchesType = typeFilter === 'ALL' || m.tipo === typeFilter;
    const matchesStatus = statusFilter === 'ALL' || m.estado === statusFilter;
    const matchesSearch = 
      m.concepto.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.contraparte.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.rutContraparte && m.rutContraparte.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesType && matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Top 4 Geometric Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Ingresos Proyectados */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Ingresos Proyectados</span>
            <div className="p-1.5 rounded-md bg-emerald-50 text-emerald-600 border border-emerald-200">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-700">{formatCLP(totalIngresos)}</div>
          <div className="mt-1 text-xs text-slate-500">
            Cobranzas y facturación proyectada
          </div>
        </div>

        {/* Total Egresos Proyectados */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Egresos Proyectados</span>
            <div className="p-1.5 rounded-md bg-rose-50 text-rose-600 border border-rose-200">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-rose-700">{formatCLP(totalEgresos)}</div>
          <div className="mt-1 text-xs text-slate-500">
            Nóminas, F29, arriendos y proveedores
          </div>
        </div>

        {/* Saldo Neto Proyectado */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Posición Neta de Caja</span>
            <div className="p-1.5 rounded-md bg-blue-50 text-blue-600 border border-blue-200">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className={`mt-2 text-2xl font-bold ${saldoNetoCaja >= 0 ? 'text-[#0f172a]' : 'text-rose-700'}`}>
            {formatCLP(saldoNetoCaja)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {saldoNetoCaja >= 0 ? 'Superávit estimado de liquidez' : 'Déficit proyectado - Requiere financiamiento'}
          </div>
        </div>

        {/* Proyección 90 Días */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Saldo a 90 Días ({scenario})</span>
            <div className="p-1.5 rounded-md bg-purple-50 text-purple-600 border border-purple-200">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-purple-700">
            {formatCLP(chartData[4].saldoAcumulado)}
          </div>
          <div className="mt-1 text-xs text-slate-500 font-mono">
            Escenario: <span className="font-semibold text-slate-800">{scenario}</span>
          </div>
        </div>
      </div>

      {/* Inconsistency Alert: DTEs in RCV not in Cash Flow */}
      {dtesNotInCashFlow.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 text-xs text-amber-900 flex items-start justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-amber-900">
                ¡{dtesNotInCashFlow.length} Facturas de Venta emitidas en el RCV no están agendadas en el Flujo de Caja!
              </div>
              <p className="text-slate-600 mt-0.5 font-medium">
                Para proyectar la liquidez con exactitud, todas las cuentas por cobrar del SII deben incorporarse con su fecha estimada de pago.
              </p>
            </div>
          </div>
          <button
            onClick={handleSyncDtesToCashflow}
            className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold px-3 py-1.5 rounded-md shrink-0 cursor-pointer shadow-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Sincronizar {dtesNotInCashFlow.length} DTEs</span>
          </button>
        </div>
      )}

      {/* Projections Chart & Scenario Selector */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)] space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h3 className="font-extrabold text-[#0f172a] text-sm sm:text-base flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#2563eb]" />
              <span>Curva de Liquidez Proyectada (30, 60 y 90 Días)</span>
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Evolución acumulada de ingresos operacionales, cumplimiento de F29, nóminas y pagos fijos.
            </p>
          </div>

          {/* Scenario Buttons */}
          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-md border border-slate-200">
            <button
              onClick={() => setScenario('BASE')}
              className={`px-3 py-1 rounded text-xs font-bold transition-colors cursor-pointer ${
                scenario === 'BASE' ? 'bg-white text-[#0f172a] shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Base (100%)
            </button>
            <button
              onClick={() => setScenario('OPTIMISTA')}
              className={`px-3 py-1 rounded text-xs font-bold transition-colors cursor-pointer ${
                scenario === 'OPTIMISTA' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Optimista (+15%)
            </button>
            <button
              onClick={() => setScenario('ESTRESADO')}
              className={`px-3 py-1 rounded text-xs font-bold transition-colors cursor-pointer ${
                scenario === 'ESTRESADO' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Estresado (-30% mora)
            </button>
          </div>
        </div>

        {/* Recharts Area */}
        <div className="h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorSaldo" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0}/>
                </linearGradient>
                <linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="periodo" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} tickFormatter={(v) => `$${(v / 1000000).toFixed(1)}M`} />
              <Tooltip
                formatter={(value: any) => [formatCLP(Number(value)), '']}
                contentStyle={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', borderRadius: '6px', fontSize: '12px', color: '#0f172a', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
              />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              <Area type="monotone" dataKey="saldoAcumulado" name="Saldo Acumulado de Caja" stroke="#2563eb" strokeWidth={2.5} fillOpacity={1} fill="url(#colorSaldo)" />
              <Area type="monotone" dataKey="ingresos" name="Ingresos Periódicos" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorIngresos)" />
              <Area type="monotone" dataKey="egresos" name="Egresos Periódicos" stroke="#e11d48" strokeWidth={2} fillOpacity={0} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Control Bar: Filter Movements & Add Movement */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Type & Status Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-md border border-slate-200">
            <button
              onClick={() => setTypeFilter('ALL')}
              className={`px-3 py-1 rounded text-xs font-semibold cursor-pointer ${typeFilter === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
            >
              Todos ({movements.length})
            </button>
            <button
              onClick={() => setTypeFilter('INGRESO')}
              className={`px-3 py-1 rounded text-xs font-semibold cursor-pointer ${typeFilter === 'INGRESO' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600'}`}
            >
              Ingresos ({safeMovements.filter(m => m.tipo === 'INGRESO').length})
            </button>
            <button
              onClick={() => setTypeFilter('EGRESO')}
              className={`px-3 py-1 rounded text-xs font-semibold cursor-pointer ${typeFilter === 'EGRESO' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600'}`}
            >
              Egresos ({safeMovements.filter(m => m.tipo === 'EGRESO').length})
            </button>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white border border-slate-300 text-slate-700 text-xs rounded-md p-1.5 focus:outline-none focus:border-[#2563eb]"
          >
            <option value="ALL">Todos los Estados</option>
            <option value="PENDIENTE">Pendiente</option>
            <option value="FACTURADO">Facturado</option>
            <option value="COBRADO">Cobrado</option>
            <option value="PAGADO">Pagado</option>
            <option value="VENCIDO">Vencido</option>
          </select>
        </div>

        {/* Search & Add Movement */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 sm:w-60">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar concepto o RUT..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-md pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#2563eb]"
            />
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 bg-[#2563eb] hover:bg-blue-600 text-white px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nuevo Movimiento de Flujo</span>
          </button>
        </div>
      </div>

      {/* Movements Table (5 Required Fields Strictly Represented) */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-[#f1f5f9] text-slate-600 font-semibold border-b border-slate-200 text-[11px]">
              <tr>
                <th className="px-4 py-3">1. Fechas (Estimada / Real)</th>
                <th className="px-4 py-3">2. Concepto & Glosa Detallada</th>
                <th className="px-4 py-3">3. Entidad (Cliente / Proveedor / RUT)</th>
                <th className="px-4 py-3 text-right">4. Monto Neto ($)</th>
                <th className="px-4 py-3 text-right">IVA (19%)</th>
                <th className="px-4 py-3 text-right">Total ($ CLP / UF)</th>
                <th className="px-4 py-3 text-center">5. Estado de Flujo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {filteredMovements.map((mov) => {
                const isIngreso = mov.tipo === 'INGRESO';

                return (
                  <tr key={mov.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* 1. Fechas */}
                    <td className="px-4 py-3 text-slate-700">
                      <div className="flex items-center gap-1 font-semibold text-slate-900">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{mov.fechaEstimada}</span>
                      </div>
                      {mov.fechaReal && (
                        <div className="text-[10px] text-emerald-700 font-bold">
                          Real: {mov.fechaReal}
                        </div>
                      )}
                    </td>

                    {/* 2. Concepto */}
                    <td className="px-4 py-3 font-sans">
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${isIngreso ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                        <span>{mov.concepto}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">{mov.categoria}</span>
                    </td>

                    {/* 3. Entidad & RUT */}
                    <td className="px-4 py-3 font-sans">
                      <div className="font-semibold text-slate-800">{mov.contraparte}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{mov.rutContraparte}</div>
                    </td>

                    {/* 4. Neto */}
                    <td className="px-4 py-3 text-right text-slate-700 font-medium">
                      {mov.montoNeto > 0 ? formatNumberCL(mov.montoNeto) : '-'}
                    </td>

                    {/* IVA */}
                    <td className="px-4 py-3 text-right">
                      {mov.montoIva > 0 ? (
                        <span className={isIngreso ? 'text-emerald-700 font-semibold' : 'text-rose-700 font-semibold'}>
                          {formatNumberCL(mov.montoIva)}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-sans">Exento</span>
                      )}
                    </td>

                    {/* Total CLP / UF */}
                    <td className="px-4 py-3 text-right font-bold text-slate-900">
                      <div className={isIngreso ? 'text-emerald-700 font-black' : 'text-rose-700 font-black'}>
                        {isIngreso ? '+' : '-'}{formatCLP(mov.montoTotal)}
                      </div>
                      {mov.moneda === 'UF' && mov.valorUfReferencia ? (
                        <div className="text-[10px] text-slate-500 font-normal">UF Ref: {formatCLP(mov.valorUfReferencia)}</div>
                      ) : null}
                    </td>

                    {/* 5. Estado */}
                    <td className="px-4 py-3 text-center font-sans">
                      <button
                        onClick={() => {
                          const next = mov.estado === 'COBRADO' || mov.estado === 'PAGADO' ? 'PENDIENTE' : isIngreso ? 'COBRADO' : 'PAGADO';
                          onUpdateMovement({ ...mov, estado: next as any, fechaReal: next === 'PENDIENTE' ? undefined : new Date().toISOString().split('T')[0] });
                        }}
                        className={`px-2.5 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                          mov.estado === 'COBRADO' || mov.estado === 'PAGADO'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : mov.estado === 'FACTURADO'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : mov.estado === 'VENCIDO'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                        title="Click para alternar estado"
                      >
                        {mov.estado}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: Nuevo Movimiento de Flujo */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg w-full max-w-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="px-6 py-4 bg-[#0f172a] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-white text-sm sm:text-base">
                  Registrar Nuevo Flujo de Caja (5 Campos Obligatorios)
                </h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-300 hover:text-white text-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateMovement} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Tipo de Flujo:</label>
                  <select
                    value={newMov.tipo}
                    onChange={(e) => setNewMov(prev => ({ ...prev, tipo: e.target.value as any }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-md p-2 text-slate-900 focus:outline-none focus:border-[#2563eb]"
                  >
                    <option value="INGRESO">Ingreso (+)</option>
                    <option value="EGRESO">Egreso (-)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Categoría:</label>
                  <select
                    value={newMov.categoria}
                    onChange={(e) => setNewMov(prev => ({ ...prev, categoria: e.target.value as any }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-md p-2 text-slate-900 focus:outline-none focus:border-[#2563eb]"
                  >
                    <option value="VENTAS_OPERACIONALES">Cobranza Clientes DTE</option>
                    <option value="PROVEEDORES">Pago Proveedores DTE</option>
                    <option value="REMUNERACIONES">Nómina y Remuneraciones</option>
                    <option value="IMPUESTOS_F29">Impuesto F29 (TGR)</option>
                    <option value="ARRIENDOS">Arriendo y Servicios</option>
                    <option value="HONORARIOS">Boletas de Honorarios</option>
                    <option value="OTRO">Otros Gastos Operacionales</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Concepto o Glosa Detallada:</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Cobranza Factura 1050 por desarrollo software"
                  value={newMov.concepto}
                  onChange={(e) => setNewMov(prev => ({ ...prev, concepto: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-md p-2 text-slate-900 focus:outline-none focus:border-[#2563eb]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">RUT Entidad:</label>
                  <input
                    type="text"
                    placeholder="76.123.456-7"
                    value={newMov.rutContraparte}
                    onChange={(e) => setNewMov(prev => ({ ...prev, rutContraparte: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-md p-2 font-mono text-slate-900 focus:outline-none focus:border-[#2563eb]"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Nombre / Razón Social:</label>
                  <input
                    type="text"
                    required
                    placeholder="Nombre del Cliente, Proveedor o Entidad"
                    value={newMov.contraparte}
                    onChange={(e) => setNewMov(prev => ({ ...prev, contraparte: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-md p-2 text-slate-900 focus:outline-none focus:border-[#2563eb]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Fecha Estimada:</label>
                  <input
                    type="date"
                    required
                    value={newMov.fechaEstimada}
                    onChange={(e) => setNewMov(prev => ({ ...prev, fechaEstimada: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-md p-2 font-mono text-slate-900 focus:outline-none focus:border-[#2563eb]"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Estado de Pago:</label>
                  <select
                    value={newMov.estado}
                    onChange={(e) => setNewMov(prev => ({ ...prev, estado: e.target.value as any }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-md p-2 text-slate-900 focus:outline-none focus:border-[#2563eb]"
                  >
                    <option value="PENDIENTE">Pendiente</option>
                    <option value="FACTURADO">Facturado</option>
                    <option value="COBRADO">Cobrado</option>
                    <option value="PAGADO">Pagado</option>
                    <option value="VENCIDO">Vencido</option>
                  </select>
                </div>
              </div>

              {/* Montos */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-600 text-[10px] font-semibold mb-1">Monto Neto ($):</label>
                  <input
                    type="number"
                    value={newMov.montoNeto}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      const iva = Math.round(n * 0.19);
                      setNewMov(prev => ({ ...prev, montoNeto: n, montoIva: iva, montoTotal: n + iva }));
                    }}
                    className="w-full bg-white border border-slate-300 rounded-md p-1.5 font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 text-[10px] font-semibold mb-1">IVA 19% ($):</label>
                  <input
                    type="number"
                    value={newMov.montoIva}
                    onChange={(e) => setNewMov(prev => ({ ...prev, montoIva: Number(e.target.value) }))}
                    className="w-full bg-white border border-slate-300 rounded-md p-1.5 font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 text-[10px] font-semibold mb-1">Monto Total ($):</label>
                  <input
                    type="number"
                    value={newMov.montoTotal}
                    onChange={(e) => setNewMov(prev => ({ ...prev, montoTotal: Number(e.target.value) }))}
                    className="w-full bg-white border border-slate-300 rounded-md p-1.5 font-mono font-bold text-slate-900"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-md font-medium cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#2563eb] hover:bg-blue-600 text-white rounded-md font-semibold shadow-xs cursor-pointer"
                >
                  Registrar en Flujo de Caja
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
