import React, { useState } from 'react';
import {
  ProductionBudget,
  ProductionBudgetItem,
  BudgetItemType,
  ProductionProductCategory,
  ClientCompany,
  InventoryItem,
} from '../types';
import { formatCLP } from '../utils/chileanAccounting';
import { recalculateBudgetMetrics } from '../data/seedBudgetsAndWithdrawals';
import {
  FileText,
  Plus,
  Send,
  CheckCircle2,
  AlertTriangle,
  Eye,
  EyeOff,
  DollarSign,
  TrendingUp,
  Percent,
  Clock,
  ArrowRight,
  Sparkles,
  Building2,
  Trash2,
  FileCheck,
  Download,
  Search,
} from 'lucide-react';

interface BudgetManagementSectionProps {
  budgets: ProductionBudget[];
  currentClient: ClientCompany;
  inventoryItems?: InventoryItem[];
  onAddBudget: (budget: ProductionBudget) => void;
  onUpdateBudget: (budget: ProductionBudget) => void;
  onApproveAndGenerateOp: (budget: ProductionBudget) => void;
}

export const BudgetManagementSection: React.FC<BudgetManagementSectionProps> = ({
  budgets,
  currentClient,
  inventoryItems = [],
  onAddBudget,
  onUpdateBudget,
  onApproveAndGenerateOp,
}) => {
  const [selectedBudget, setSelectedBudget] = useState<ProductionBudget | null>(budgets[0] || null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'INTERNA' | 'CLIENTE'>('INTERNA');

  // Form State para Nuevo Presupuesto
  const [newBudgetForm, setNewBudgetForm] = useState<Partial<ProductionBudget>>({
    folio: `PRE-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
    clienteNombre: currentClient?.razonSocial || 'Pesquera Chiloé Ltda.',
    clienteRut: currentClient?.rut || '77.654.321-K',
    contactoCliente: '',
    emailCliente: '',
    fechaEmision: new Date().toISOString().split('T')[0],
    fechaValidez: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    productoNombre: '',
    productoCodigo: 'PROD-RED-HDPE',
    categoria: 'REDES_Y_FONDEOS',
    unidadMedida: 'UNID',
    cantidad: 1,
    condicionesComerciales: '50% anticipo contra OC, saldo a 30 días contra entrega técnica y recepción conforme.',
    partidas: [
      {
        id: 'p-1',
        tipo: 'MPD',
        descripcion: 'Paño de Red HDPE Virgen Malla 1.5"',
        insumoCodigo: 'MAT-HDPE-PAÑO',
        unidadMedida: 'ROLLO',
        cantidadPresupuestada: 4,
        costoUnitarioEstimado: 1450000,
        costoTotalEstimado: 5800000,
        precioUnitarioSugerido: 2200000,
        precioTotalVenta: 8800000,
        visibleParaCliente: true,
      },
      {
        id: 'p-2',
        tipo: 'MOD',
        descripcion: 'Confección y Armado Redero Especialista',
        unidadMedida: 'HORAS',
        cantidadPresupuestada: 120,
        costoUnitarioEstimado: 13000,
        costoTotalEstimado: 1560000,
        precioUnitarioSugerido: 22500,
        precioTotalVenta: 2700000,
        visibleParaCliente: true,
      },
      {
        id: 'p-3',
        tipo: 'CIF',
        descripcion: 'Amortización y Desgaste de Maquinarias de Termofusión',
        unidadMedida: 'GL',
        cantidadPresupuestada: 1,
        costoUnitarioEstimado: 450000,
        costoTotalEstimado: 450000,
        precioUnitarioSugerido: 0,
        precioTotalVenta: 0,
        visibleParaCliente: false, // OCULTO PARA EL CLIENTE
        notasInternas: 'Costos indirectos y depreciación de banco fabril.',
      },
    ],
  });

  const filteredBudgets = budgets.filter((b) => {
    const matchesSearch =
      b.folio.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.clienteNombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.productoNombre.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || b.estado === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBudgetForm.productoNombre || !newBudgetForm.clienteNombre) return;

    const baseBudget: ProductionBudget = {
      id: `pre-custom-${Date.now()}`,
      empresaId: currentClient?.id || 'client-mar-austral',
      folio: newBudgetForm.folio || `PRE-${Date.now()}`,
      clienteNombre: newBudgetForm.clienteNombre,
      clienteRut: newBudgetForm.clienteRut || '76.000.000-0',
      contactoCliente: newBudgetForm.contactoCliente,
      emailCliente: newBudgetForm.emailCliente,
      fechaEmision: newBudgetForm.fechaEmision || new Date().toISOString().split('T')[0],
      fechaValidez: newBudgetForm.fechaValidez || '',
      estado: 'BORRADOR',
      productoNombre: newBudgetForm.productoNombre,
      productoCodigo: newBudgetForm.productoCodigo || 'PROD-GEN',
      categoria: newBudgetForm.categoria || 'REDES_Y_FONDEOS',
      unidadMedida: newBudgetForm.unidadMedida || 'UNID',
      cantidad: Number(newBudgetForm.cantidad) || 1,
      condicionesComerciales: newBudgetForm.condicionesComerciales,
      partidas: newBudgetForm.partidas || [],
      costoTotalMpd: 0,
      costoTotalMod: 0,
      costoTotalCif: 0,
      costoTotalInterno: 0,
      precioVentaNetoCliente: 0,
      margenBrutoEstimadoClp: 0,
      margenBrutoEstimadoPct: 0,
      markupPct: 0,
    };

    const calculated = recalculateBudgetMetrics(baseBudget);
    onAddBudget(calculated);
    setSelectedBudget(calculated);
    setShowCreateModal(false);
  };

  const handleAddPartida = () => {
    const newPartida: ProductionBudgetItem = {
      id: `p-${Date.now()}`,
      tipo: 'MPD',
      descripcion: 'Nuevo Insumo o Partida',
      unidadMedida: 'UNID',
      cantidadPresupuestada: 1,
      costoUnitarioEstimado: 100000,
      costoTotalEstimado: 100000,
      precioUnitarioSugerido: 150000,
      precioTotalVenta: 150000,
      visibleParaCliente: true,
    };

    if (selectedBudget) {
      const updated: ProductionBudget = {
        ...selectedBudget,
        partidas: [...selectedBudget.partidas, newPartida],
      };
      const recalculated = recalculateBudgetMetrics(updated);
      onUpdateBudget(recalculated);
      setSelectedBudget(recalculated);
    }
  };

  const handleToggleVisibility = (partidaId: string) => {
    if (!selectedBudget) return;
    const updatedPartidas = selectedBudget.partidas.map((p) =>
      p.id === partidaId ? { ...p, visibleParaCliente: !p.visibleParaCliente } : p
    );
    const updated = recalculateBudgetMetrics({ ...selectedBudget, partidas: updatedPartidas });
    onUpdateBudget(updated);
    setSelectedBudget(updated);
  };

  const handleRemovePartida = (partidaId: string) => {
    if (!selectedBudget) return;
    const updatedPartidas = selectedBudget.partidas.filter((p) => p.id !== partidaId);
    const updated = recalculateBudgetMetrics({ ...selectedBudget, partidas: updatedPartidas });
    onUpdateBudget(updated);
    setSelectedBudget(updated);
  };

  const handleSendToClient = () => {
    if (!selectedBudget) return;
    const updated: ProductionBudget = {
      ...selectedBudget,
      estado: 'ENVIADO',
      fechaEnvio: new Date().toISOString().replace('T', ' ').slice(0, 16),
      historialEnvio: [
        ...(selectedBudget.historialEnvio || []),
        {
          fecha: new Date().toISOString().replace('T', ' ').slice(0, 16),
          remitente: 'comercial@mar-austral.cl',
          destinatario: selectedBudget.emailCliente || 'cliente@empresa.cl',
          observaciones: 'Presupuesto y propuesta comercial enviada al cliente.',
        },
      ],
    };
    onUpdateBudget(updated);
    setSelectedBudget(updated);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner with KPIs */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                <FileText className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  Presupuestos de Producción & Cotizaciones Industriales
                </h2>
                <p className="text-xs text-slate-500">
                  Control de costos directos/indirectos, márgenes confidenciales y generación automática de OP/OT
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Nuevo Presupuesto</span>
            </button>
          </div>
        </div>

        {/* Global Budget KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-4 border-t border-slate-100">
          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Cotizaciones</span>
            <div className="text-xl font-black text-slate-800 mt-1">{budgets.length}</div>
            <span className="text-[10px] text-slate-400">En cartera activa</span>
          </div>

          <div className="bg-blue-50 p-3.5 rounded-lg border border-blue-200">
            <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">Monto Total Cotizado</span>
            <div className="text-xl font-black text-blue-800 mt-1">
              {formatCLP(budgets.reduce((acc, b) => acc + b.precioVentaNetoCliente, 0))}
            </div>
            <span className="text-[10px] text-blue-600">Precios netos propuestos</span>
          </div>

          <div className="bg-emerald-50 p-3.5 rounded-lg border border-emerald-200">
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Margen Bruto Promedio</span>
            <div className="text-xl font-black text-emerald-800 mt-1">
              {budgets.length > 0
                ? (
                    budgets.reduce((acc, b) => acc + b.margenBrutoEstimadoPct, 0) / budgets.length
                  ).toFixed(1)
                : 0}
              %
            </div>
            <span className="text-[10px] text-emerald-600">Rentabilidad interna esperada</span>
          </div>

          <div className="bg-amber-50 p-3.5 rounded-lg border border-amber-200">
            <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">OPs Generadas</span>
            <div className="text-xl font-black text-amber-800 mt-1">
              {budgets.filter((b) => b.estado === 'APROBADO' && b.ordenProduccionIdGenerada).length}
            </div>
            <span className="text-[10px] text-amber-600">Convertidas a producción</span>
          </div>
        </div>
      </div>

      {/* Main Content: Split Master-Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Budget List */}
        <div className="lg:col-span-4 space-y-3">
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar por folio, cliente o producto..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              {['ALL', 'BORRADOR', 'ENVIADO', 'APROBADO'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer whitespace-nowrap ${
                    statusFilter === st
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st === 'ALL' ? 'Todos' : st}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2.5">
            {filteredBudgets.map((budget) => {
              const isSelected = selectedBudget?.id === budget.id;
              const statusColors = {
                BORRADOR: 'bg-slate-100 text-slate-700 border-slate-300',
                ENVIADO: 'bg-blue-50 text-blue-700 border-blue-200',
                EN_NEGOCIACION: 'bg-amber-50 text-amber-700 border-amber-200',
                APROBADO: 'bg-emerald-50 text-emerald-700 border-emerald-300',
                RECHAZADO: 'bg-rose-50 text-rose-700 border-rose-200',
                CANCELADO: 'bg-slate-100 text-slate-500 border-slate-200',
              };

              return (
                <div
                  key={budget.id}
                  onClick={() => setSelectedBudget(budget)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50/50 border-blue-500 shadow-sm ring-1 ring-blue-400'
                      : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-black text-sm text-slate-800">{budget.folio}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        statusColors[budget.estado] || 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {budget.estado}
                    </span>
                  </div>

                  <h3 className="font-bold text-xs text-slate-900 mt-1 line-clamp-1">{budget.productoNombre}</h3>
                  <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                    <Building2 className="w-3 h-3 text-slate-400" />
                    <span>{budget.clienteNombre}</span>
                  </p>

                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Cotizado Cliente</span>
                      <span className="font-bold text-blue-700">{formatCLP(budget.precioVentaNetoCliente)}</span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block">Margen Interno</span>
                      <span
                        className={`font-black text-xs ${
                          budget.margenBrutoEstimadoPct >= 30
                            ? 'text-emerald-600'
                            : budget.margenBrutoEstimadoPct >= 15
                            ? 'text-blue-600'
                            : 'text-amber-600'
                        }`}
                      >
                        {budget.margenBrutoEstimadoPct}% ({formatCLP(budget.margenBrutoEstimadoClp)})
                      </span>
                    </div>
                  </div>

                  {budget.folioOpGenerada && (
                    <div className="mt-2 text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>Generó OP: {budget.folioOpGenerada}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Detail View of Selected Budget */}
        <div className="lg:col-span-8">
          {selectedBudget ? (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-6">
              {/* Header with Title and Actions */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-base font-black text-slate-900">{selectedBudget.folio}</span>
                    <span className="text-xs px-2.5 py-0.5 font-bold rounded-full bg-blue-100 text-blue-800">
                      {selectedBudget.estado}
                    </span>
                    <span className="text-xs text-slate-400">| Emisión: {selectedBudget.fechaEmision}</span>
                  </div>
                  <h3 className="text-base font-extrabold text-slate-800 mt-1">{selectedBudget.productoNombre}</h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Cliente: <strong>{selectedBudget.clienteNombre}</strong> (RUT: {selectedBudget.clienteRut})
                    {selectedBudget.contactoCliente ? ` • Contacto: ${selectedBudget.contactoCliente}` : ''}
                  </p>
                </div>

                {/* Switch Between Internal View and Client Proposal View */}
                <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
                  <button
                    onClick={() => setViewMode('INTERNA')}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer ${
                      viewMode === 'INTERNA'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Análisis Interno (Costos & Margen)
                  </button>
                  <button
                    onClick={() => setViewMode('CLIENTE')}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer ${
                      viewMode === 'CLIENTE'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Vista Propuesta Cliente (PDF)
                  </button>
                </div>
              </div>

              {/* Status Tracking and Action Bar */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-bold text-slate-700">Flujo de Aprobación:</span>
                  <span
                    className={`px-2 py-0.5 rounded font-mono font-semibold ${
                      selectedBudget.estado === 'BORRADOR' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    1. Borrador
                  </span>
                  <ArrowRight className="w-3 h-3 text-slate-400" />
                  <span
                    className={`px-2 py-0.5 rounded font-mono font-semibold ${
                      selectedBudget.estado === 'ENVIADO' ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    2. Enviado
                  </span>
                  <ArrowRight className="w-3 h-3 text-slate-400" />
                  <span
                    className={`px-2 py-0.5 rounded font-mono font-semibold ${
                      selectedBudget.estado === 'APROBADO'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    3. Aprobado / Generar OP
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {selectedBudget.estado === 'BORRADOR' && (
                    <button
                      onClick={handleSendToClient}
                      className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Enviar al Cliente</span>
                    </button>
                  )}

                  {selectedBudget.estado !== 'APROBADO' ? (
                    <button
                      onClick={() => onApproveAndGenerateOp(selectedBudget)}
                      className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-extrabold shadow-xs transition cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Aprobar y Generar OT/OP Automática</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-100/80 px-3 py-1.5 rounded-lg border border-emerald-300">
                      <FileCheck className="w-4 h-4 text-emerald-600" />
                      <span>OP Activa: {selectedBudget.folioOpGenerada || 'En Planta'}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* View 1: Internal Cost and Margin Analysis */}
              {viewMode === 'INTERNA' ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <span>Desglose de Partidas y Control de Visibilidad Cliente</span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        (Activa o desactiva el icono del ojo para ocultar costos indirectos confidenciales en la propuesta)
                      </span>
                    </h4>

                    <button
                      onClick={handleAddPartida}
                      className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Agregar Partida</span>
                    </button>
                  </div>

                  {/* Table of Budget Items */}
                  <div className="border border-slate-200 rounded-lg overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                        <tr>
                          <th className="py-2.5 px-3">Tipo</th>
                          <th className="py-2.5 px-3">Descripción / Insumo</th>
                          <th className="py-2.5 px-3 text-center">Cant.</th>
                          <th className="py-2.5 px-3 text-right">Costo Est. ($)</th>
                          <th className="py-2.5 px-3 text-right">Costo Total</th>
                          <th className="py-2.5 px-3 text-right">Precio Venta ($)</th>
                          <th className="py-2.5 px-3 text-center">Visible Cliente</th>
                          <th className="py-2.5 px-2 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {selectedBudget.partidas.map((item) => (
                          <tr key={item.id} className={!item.visibleParaCliente ? 'bg-amber-50/40' : 'bg-white'}>
                            <td className="py-2.5 px-3">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                  item.tipo === 'MPD'
                                    ? 'bg-blue-100 text-blue-800'
                                    : item.tipo === 'MOD'
                                    ? 'bg-purple-100 text-purple-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {item.tipo}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-semibold text-slate-800">{item.descripcion}</div>
                              {item.insumoCodigo && (
                                <span className="font-mono text-[10px] text-slate-400">SKU: {item.insumoCodigo}</span>
                              )}
                              {item.notasInternas && (
                                <div className="text-[10px] text-amber-700 italic mt-0.5">
                                  Nota: {item.notasInternas}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono">
                              {item.cantidadPresupuestada} {item.unidadMedida}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                              {formatCLP(item.costoUnitarioEstimado)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                              {formatCLP(item.costoTotalEstimado)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-700">
                              {item.visibleParaCliente
                                ? formatCLP(item.precioTotalVenta || 0)
                                : <span className="text-slate-400 italic text-[11px]">- (Costo Oculto)</span>}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleToggleVisibility(item.id)}
                                title={
                                  item.visibleParaCliente
                                    ? 'Visible en cotización del cliente'
                                    : 'Oculto al cliente (costo interno computado en el margen)'
                                }
                                className={`p-1.5 rounded-md transition cursor-pointer ${
                                  item.visibleParaCliente
                                    ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                                    : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                                }`}
                              >
                                {item.visibleParaCliente ? (
                                  <Eye className="w-4 h-4" />
                                ) : (
                                  <EyeOff className="w-4 h-4" />
                                )}
                              </button>
                            </td>
                            <td className="py-2.5 px-2 text-center">
                              <button
                                onClick={() => handleRemovePartida(item.id)}
                                className="text-slate-300 hover:text-rose-600 cursor-pointer p-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Financial Summary & Margin Box */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    {/* Cost Structure */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
                      <span className="font-bold text-slate-700 block uppercase tracking-wider text-[11px]">
                        Estructura de Costos Internos (Absorción NIC 2)
                      </span>
                      <div className="flex justify-between py-1 border-b border-slate-200">
                        <span className="text-slate-600">Materiales Directos (MPD):</span>
                        <span className="font-mono font-bold text-slate-800">
                          {formatCLP(selectedBudget.costoTotalMpd)}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-200">
                        <span className="text-slate-600">Mano de Obra Directa (MOD):</span>
                        <span className="font-mono font-bold text-slate-800">
                          {formatCLP(selectedBudget.costoTotalMod)}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-200">
                        <span className="text-slate-600">Costos Indirectos Fabriles (CIF):</span>
                        <span className="font-mono font-bold text-slate-800">
                          {formatCLP(selectedBudget.costoTotalCif)}
                        </span>
                      </div>
                      <div className="flex justify-between pt-1 font-extrabold text-slate-900 text-sm">
                        <span>Costo Total Estimado Fabricación:</span>
                        <span className="font-mono text-slate-950">
                          {formatCLP(selectedBudget.costoTotalInterno)}
                        </span>
                      </div>
                    </div>

                    {/* Profitability and Client Margin */}
                    <div className="bg-emerald-50/70 p-4 rounded-xl border border-emerald-200 space-y-2 text-xs">
                      <span className="font-bold text-emerald-800 block uppercase tracking-wider text-[11px]">
                        Rentabilidad & Margen de Ganancia Proyectado
                      </span>
                      <div className="flex justify-between py-1 border-b border-emerald-100">
                        <span className="text-emerald-900">Precio Venta Neto al Cliente:</span>
                        <span className="font-mono font-black text-blue-700 text-sm">
                          {formatCLP(selectedBudget.precioVentaNetoCliente)}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-emerald-100">
                        <span className="text-emerald-900">Menos: Costo Total Interno:</span>
                        <span className="font-mono font-semibold text-slate-600">
                          -{formatCLP(selectedBudget.costoTotalInterno)}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-emerald-100">
                        <span className="font-bold text-emerald-950">Margen Bruto de Ganancia:</span>
                        <span className="font-mono font-black text-emerald-700 text-sm">
                          +{formatCLP(selectedBudget.margenBrutoEstimadoClp)}
                        </span>
                      </div>
                      <div className="flex justify-between pt-1 font-black text-emerald-950 text-sm">
                        <span>Margen sobre Venta (%):</span>
                        <span className="font-mono text-emerald-700 bg-emerald-200/80 px-2 py-0.5 rounded">
                          {selectedBudget.margenBrutoEstimadoPct}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* View 2: Client Facing Proposal */
                <div className="bg-white border-2 border-slate-300 rounded-xl p-6 space-y-6 shadow-sm">
                  <div className="flex justify-between items-start border-b border-slate-200 pb-4">
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-blue-600">
                        COTIZACIÓN TÉCNICA COMERCIAL
                      </span>
                      <h2 className="text-xl font-black text-slate-900 mt-1">{selectedBudget.productoNombre}</h2>
                      <p className="text-xs text-slate-500 font-mono">Folio: {selectedBudget.folio} • Validez: 30 días</p>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-bold text-slate-800 block">MAR AUSTRAL SPA</span>
                      <span className="text-[11px] text-slate-500 block">RUT: 76.892.450-3</span>
                      <span className="text-[11px] text-slate-500 block">Quellón, Región de Los Lagos</span>
                    </div>
                  </div>

                  {/* Client Data Box */}
                  <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold uppercase">Cliente</span>
                      <span className="font-bold text-slate-800">{selectedBudget.clienteNombre}</span>
                      <span className="block text-slate-500 font-mono">RUT: {selectedBudget.clienteRut}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold uppercase">Contacto & Condiciones</span>
                      <span className="text-slate-700">{selectedBudget.contactoCliente || 'Atención Gerencia'}</span>
                      <span className="block text-slate-500">{selectedBudget.condicionesComerciales}</span>
                    </div>
                  </div>

                  {/* Proposal Table (ONLY VISIBLE ITEMS) */}
                  <div>
                    <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Detalle de Partidas y Servicios Ofrecidos
                    </h5>
                    <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
                      <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-3">Ítem</th>
                          <th className="py-2 px-3">Descripción Técnica</th>
                          <th className="py-2 px-3 text-center">Cantidad</th>
                          <th className="py-2 px-3 text-right">Precio Unitario ($)</th>
                          <th className="py-2 px-3 text-right">Subtotal Neto ($)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {selectedBudget.partidas
                          .filter((p) => p.visibleParaCliente)
                          .map((p, idx) => (
                            <tr key={p.id}>
                              <td className="py-2.5 px-3 font-mono text-slate-500">{idx + 1}</td>
                              <td className="py-2.5 px-3 font-semibold text-slate-800">{p.descripcion}</td>
                              <td className="py-2.5 px-3 text-center font-mono">
                                {p.cantidadPresupuestada} {p.unidadMedida}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                                {formatCLP(p.precioUnitarioSugerido || 0)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                                {formatCLP(p.precioTotalVenta || 0)}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Totals Section */}
                  <div className="flex justify-end">
                    <div className="w-64 space-y-1.5 text-xs">
                      <div className="flex justify-between py-1 border-b border-slate-200">
                        <span className="text-slate-600">Subtotal Neto:</span>
                        <span className="font-mono font-bold text-slate-800">
                          {formatCLP(selectedBudget.precioVentaNetoCliente)}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-200">
                        <span className="text-slate-600">IVA (19%):</span>
                        <span className="font-mono font-bold text-slate-800">
                          {formatCLP(Math.round(selectedBudget.precioVentaNetoCliente * 0.19))}
                        </span>
                      </div>
                      <div className="flex justify-between pt-1 text-sm font-black text-blue-900">
                        <span>Total Presupuesto:</span>
                        <span className="font-mono">
                          {formatCLP(Math.round(selectedBudget.precioVentaNetoCliente * 1.19))}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-400">
              <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p className="font-semibold text-sm">Selecciona un presupuesto para ver o editar sus partidas</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Crear Nuevo Presupuesto */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Nuevo Presupuesto de Producción / Cotización</h3>
            <p className="text-xs text-slate-500 mb-4">
              Ingresa los datos del cliente, producto a fabricar y condiciones iniciales.
            </p>

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Folio Presupuesto</label>
                  <input
                    type="text"
                    required
                    value={newBudgetForm.folio}
                    onChange={(e) => setNewBudgetForm({ ...newBudgetForm, folio: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded font-mono"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Categoría de Fabricación</label>
                  <select
                    value={newBudgetForm.categoria}
                    onChange={(e) =>
                      setNewBudgetForm({
                        ...newBudgetForm,
                        categoria: e.target.value as ProductionProductCategory,
                      })
                    }
                    className="w-full p-2 border border-slate-300 rounded"
                  >
                    <option value="REDES_Y_FONDEOS">Redes y Sistemas de Fondeo</option>
                    <option value="PRODUCTOS_MANUFACTURADOS">Estructuras y Piezas HDPE</option>
                    <option value="SERVICIOS_INDUSTRIALES">Mantenimiento y Reparación Navales</option>
                    <option value="SALMONIDOS_PROCESADOS">Procesamiento de Biomasa</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Nombre del Trabajo / Producto</label>
                <input
                  type="text"
                  required
                  placeholder="ej: Fabricación de 4 Redes Peceras HDPE 30x30m con Relingas de Plomo"
                  value={newBudgetForm.productoNombre}
                  onChange={(e) => setNewBudgetForm({ ...newBudgetForm, productoNombre: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Razón Social Cliente</label>
                  <input
                    type="text"
                    required
                    value={newBudgetForm.clienteNombre}
                    onChange={(e) => setNewBudgetForm({ ...newBudgetForm, clienteNombre: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">RUT Cliente</label>
                  <input
                    type="text"
                    required
                    value={newBudgetForm.clienteRut}
                    onChange={(e) => setNewBudgetForm({ ...newBudgetForm, clienteRut: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Cantidad Objetivo</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newBudgetForm.cantidad}
                    onChange={(e) => setNewBudgetForm({ ...newBudgetForm, cantidad: Number(e.target.value) })}
                    className="w-full p-2 border border-slate-300 rounded font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Unidad de Medida</label>
                  <input
                    type="text"
                    value={newBudgetForm.unidadMedida}
                    onChange={(e) => setNewBudgetForm({ ...newBudgetForm, unidadMedida: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Validez Oferta</label>
                  <input
                    type="date"
                    value={newBudgetForm.fechaValidez}
                    onChange={(e) => setNewBudgetForm({ ...newBudgetForm, fechaValidez: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Condiciones Comerciales</label>
                <textarea
                  rows={2}
                  value={newBudgetForm.condicionesComerciales}
                  onChange={(e) => setNewBudgetForm({ ...newBudgetForm, condicionesComerciales: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow cursor-pointer"
                >
                  Crear Presupuesto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
