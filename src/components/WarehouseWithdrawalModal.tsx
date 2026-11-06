import React, { useState } from 'react';
import {
  ProductionOrder,
  ProductionBudget,
  Warehouse,
  InventoryItem,
  WarehouseWithdrawal,
  WarehouseWithdrawalItem,
  CostCenterMaster,
} from '../types';
import { formatCLP } from '../utils/chileanAccounting';
import { convertBudgetToProductionOrder } from '../data/seedBudgetsAndWithdrawals';
import { SEED_COST_CENTERS } from '../data/seedCostCenters';
import {
  AlertTriangle,
  CheckCircle2,
  X,
  PackageMinus,
  FileText,
  Building2,
  Layers,
  ArrowRight,
  TrendingDown,
  Plus,
  Sparkles,
  ShoppingBag,
  Briefcase,
  PieChart,
  BookOpen,
} from 'lucide-react';
import { folioInterno } from '../utils/folioInterno';

interface WarehouseWithdrawalModalProps {
  productionOrders: ProductionOrder[];
  productionBudgets: ProductionBudget[];
  warehouses: Warehouse[];
  inventoryItems: InventoryItem[];
  costCenters?: CostCenterMaster[];
  onClose: () => void;
  onSubmitWithdrawal: (withdrawal: WarehouseWithdrawal) => void;
  onQuickCreateOp?: (newOp: ProductionOrder) => void;
}

export const WarehouseWithdrawalModal: React.FC<WarehouseWithdrawalModalProps> = ({
  productionOrders,
  productionBudgets,
  warehouses,
  inventoryItems,
  costCenters = SEED_COST_CENTERS,
  onClose,
  onSubmitWithdrawal,
  onQuickCreateOp,
}) => {
  // Modal Mode: OP (Industrial/Fabril) vs Nota de Pedido / Centro de Costo (Comercial/Servicios)
  const [withdrawalMode, setWithdrawalMode] = useState<'NOTA_PEDIDO_CC' | 'ORDEN_PRODUCCION'>('NOTA_PEDIDO_CC');

  // Common Fields
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(warehouses[0]?.id || '');
  const [solicitanteNombre, setSolicitanteNombre] = useState<string>('Claudia Navarrete - Ejecutiva Comercial');
  const [responsableBodega, setResponsableBodega] = useState<string>(
    warehouses[0]?.encargadoNombre || 'Williams Rojas - Encargado de Bodega'
  );
  const [observaciones, setObservaciones] = useState<string>('');

  // ----------------------------------------------------------------------
  // MODE 1: NOTA DE PEDIDO / CENTRO DE COSTO (EMPRESAS NO PRODUCTIVAS)
  // ----------------------------------------------------------------------
  const [notaPedidoFolio, setNotaPedidoFolio] = useState<string>(
    folioInterno('NP')
  );
  const [notaPedidoAutorizadaPor, setNotaPedidoAutorizadaPor] = useState<string>(
    'Gonzalo Silva - Gerencia Comercial y Operaciones'
  );
  const [selectedCostCenterId, setSelectedCostCenterId] = useState<string>(costCenters[1]?.id || costCenters[0]?.id || '');
  const [isMultiCostCenter, setIsMultiCostCenter] = useState<boolean>(false);
  const [multiCostCenterDist, setMultiCostCenterDist] = useState<
    { centroCostoId: string; porcentaje: number }[]
  >([
    { centroCostoId: costCenters[1]?.id || costCenters[0]?.id || '', porcentaje: 60 },
    { centroCostoId: costCenters[0]?.id || '', porcentaje: 40 },
  ]);
  const [clienteOAreaDestino, setClienteOAreaDestino] = useState<string>('Distribuidora & Retail Metropolitano');
  const [selectedNpItemId, setSelectedNpItemId] = useState<string>(inventoryItems[0]?.id || '');
  const [cantidadSolicitadaNp, setCantidadSolicitadaNp] = useState<number>(5);

  // ----------------------------------------------------------------------
  // MODE 2: ORDEN DE PRODUCCIÓN (EMPRESAS FABRILES / INDUSTRIALES)
  // ----------------------------------------------------------------------
  const activeOrders = productionOrders.filter((op) => op.estado === 'EN_PROCESO' || op.estado === 'PLANIFICADA');
  const [selectedOpId, setSelectedOpId] = useState<string>(activeOrders[0]?.id || '');
  const selectedOp = productionOrders.find((op) => op.id === selectedOpId);

  const [isCreatingNewOp, setIsCreatingNewOp] = useState<boolean>(activeOrders.length === 0);
  const [quickOpFolio, setQuickOpFolio] = useState<string>(
    folioInterno('OP')
  );
  const [quickOpDesc, setQuickOpDesc] = useState<string>('');
  const [quickOpClient, setQuickOpClient] = useState<string>('Pesquera Chiloé Ltda.');
  const [selectedBudgetIdToConvert, setSelectedBudgetIdToConvert] = useState<string>('');

  const [selectedInsumoCodigo, setSelectedInsumoCodigo] = useState<string>('');
  const [cantidadSolicitadaOp, setCantidadSolicitadaOp] = useState<number>(1);
  const [motivoSobreconsumo, setMotivoSobreconsumo] = useState<string>('Merma técnica imprevista en paño');

  const budgetedMaterials = selectedOp?.presupuestoBase?.materialesPresupuestados || [];

  React.useEffect(() => {
    if (budgetedMaterials.length > 0 && !selectedInsumoCodigo) {
      setSelectedInsumoCodigo(budgetedMaterials[0].insumoCodigo);
    }
  }, [selectedOpId, budgetedMaterials]);

  // Calculations for OP Mode
  const inventoryItemOp = inventoryItems.find(
    (it) => it.sku === selectedInsumoCodigo || it.id === selectedInsumoCodigo
  );
  const warehouseStockInfoOp = inventoryItemOp?.stockPorBodega?.find((b) => b.bodegaId === selectedWarehouseId);
  const physicalStockAvailableOp = warehouseStockInfoOp ? warehouseStockInfoOp.stockFisico : inventoryItemOp?.stockDisponible || 0;

  const budgetDetail = budgetedMaterials.find((m) => m.insumoCodigo === selectedInsumoCodigo);
  const previousConsumptionQty = (selectedOp?.consumosMateriales || [])
    .filter((c) => c.insumoCodigo === selectedInsumoCodigo)
    .reduce((acc, c) => acc + c.cantidadConsumida, 0);

  const budgetedQty = budgetDetail ? budgetDetail.cantidadPresupuestada : 0;
  const totalResultingQty = previousConsumptionQty + cantidadSolicitadaOp;
  const hasOverconsumption = budgetedQty > 0 && totalResultingQty > budgetedQty;
  const deviationQty = hasOverconsumption ? totalResultingQty - budgetedQty : 0;

  const unitCostOp = inventoryItemOp?.costoUnitarioPMP || budgetDetail?.costoUnitarioEstimado || 0; // sin costo registrado: $0 (antes $350.000)
  const totalWithdrawalCostOp = cantidadSolicitadaOp * unitCostOp;
  const extraCostFromOverrun = deviationQty * unitCostOp;

  const clientNetPrice = selectedOp?.precioVentaPactado || selectedOp?.precioVentaEstimado || 0;
  const currentTotalOpCost = (selectedOp?.costoTotalProduccion || 0) + totalWithdrawalCostOp;
  const projectedMarginClp = clientNetPrice - currentTotalOpCost;
  const projectedMarginPct = clientNetPrice > 0 ? Number(((projectedMarginClp / clientNetPrice) * 100).toFixed(1)) : 0;
  const budgetedMarginPct = selectedOp?.margenPresupuestadoPct || 0;
  const marginErosionPct = Number((budgetedMarginPct - projectedMarginPct).toFixed(1));

  // Calculations for Nota de Pedido Mode
  const inventoryItemNp = inventoryItems.find((it) => it.id === selectedNpItemId) || inventoryItems[0];
  const warehouseStockInfoNp = inventoryItemNp?.stockPorBodega?.find((b) => b.bodegaId === selectedWarehouseId);
  const physicalStockAvailableNp = warehouseStockInfoNp ? warehouseStockInfoNp.stockFisico : inventoryItemNp?.stockDisponible || 0;
  const unitCostNp = inventoryItemNp?.costoUnitarioPMP || 0;
  const totalWithdrawalCostNp = cantidadSolicitadaNp * unitCostNp;

  const selectedCostCenterObj = costCenters.find((c) => c.id === selectedCostCenterId);

  const handleQuickCreateFromBudget = () => {
    const budget = productionBudgets.find((b) => b.id === selectedBudgetIdToConvert);
    if (!budget) return;
    const newOp = convertBudgetToProductionOrder(budget, quickOpFolio);
    if (onQuickCreateOp) onQuickCreateOp(newOp);
    setSelectedOpId(newOp.id);
    setIsCreatingNewOp(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const warehouse = warehouses.find((w) => w.id === selectedWarehouseId);

    if (withdrawalMode === 'NOTA_PEDIDO_CC') {
      if (cantidadSolicitadaNp <= 0) {
        alert('La cantidad a retirar debe ser mayor a 0.');
        return;
      }
      if (!notaPedidoFolio.trim()) {
        alert('Debes ingresar el Folio de la Nota de Pedido autorizada.');
        return;
      }

      const withdrawalItem: WarehouseWithdrawalItem = {
        insumoId: inventoryItemNp.id,
        insumoCodigo: inventoryItemNp.sku,
        insumoNombre: inventoryItemNp.nombre,
        cantidadSolicitada: cantidadSolicitadaNp,
        cantidadPresupuestadaOriginal: 0,
        cantidadPreviaConsumida: 0,
        cantidadTotalResultante: cantidadSolicitadaNp,
        haySobreconsumo: false,
        desvioCantidad: 0,
        costoUnitarioPMP: unitCostNp,
        costoTotal: totalWithdrawalCostNp,
        unidadMedida: inventoryItemNp.unidadMedida || 'UNID',
        impactoEstimadoEnMargenClp: 0,
      };

      const distribucionCalculada = isMultiCostCenter
        ? multiCostCenterDist.map((item) => {
            const cc = costCenters.find((c) => c.id === item.centroCostoId);
            return {
              centroCostoId: item.centroCostoId,
              centroCostoNombre: cc?.nombre || 'Centro de Costo',
              porcentaje: item.porcentaje,
              montoClp: Math.round((totalWithdrawalCostNp * item.porcentaje) / 100),
            };
          })
        : undefined;

      const withdrawal: WarehouseWithdrawal = {
        id: `vale-${Date.now()}`,
        empresaId: 'client-mar-austral',
        folioVale: folioInterno('VALE'),
        fecha: new Date().toISOString().split('T')[0],
        tipoRetiro: 'NOTA_PEDIDO_CC',
        notaPedidoFolio,
        notaPedidoAutorizadaPor,
        centroCostoId: selectedCostCenterObj?.id,
        centroCostoNombre: selectedCostCenterObj?.nombre,
        distribucionMultiCentroCosto: distribucionCalculada,
        clienteNombre: clienteOAreaDestino,
        bodegaOrigenId: selectedWarehouseId,
        bodegaOrigenNombre: warehouse?.nombre || 'Bodega Central',
        solicitanteNombre,
        responsableBodega,
        items: [withdrawalItem],
        costoTotalVale: totalWithdrawalCostNp,
        observaciones: `Retiro por Nota de Pedido Autorizada ${notaPedidoFolio}. Aprobado por: ${notaPedidoAutorizadaPor}. Destino: ${clienteOAreaDestino}. ${observaciones}`,
      };

      onSubmitWithdrawal(withdrawal);
      onClose();
    } else {
      // ORDEN DE PRODUCCION
      if (!selectedOp) {
        alert('Debes seleccionar o crear una Orden de Producción / Trabajo.');
        return;
      }
      if (cantidadSolicitadaOp <= 0) {
        alert('La cantidad a retirar debe ser mayor a 0.');
        return;
      }

      const withdrawalItem: WarehouseWithdrawalItem = {
        insumoId: inventoryItemOp?.id || selectedInsumoCodigo,
        insumoCodigo: selectedInsumoCodigo,
        insumoNombre: inventoryItemOp?.nombre || budgetDetail?.insumoNombre || selectedInsumoCodigo,
        cantidadSolicitada: cantidadSolicitadaOp,
        cantidadPresupuestadaOriginal: budgetedQty,
        cantidadPreviaConsumida: previousConsumptionQty,
        cantidadTotalResultante: totalResultingQty,
        haySobreconsumo: hasOverconsumption,
        desvioCantidad: deviationQty,
        costoUnitarioPMP: unitCostOp,
        costoTotal: totalWithdrawalCostOp,
        unidadMedida: inventoryItemOp?.unidadMedida || budgetDetail?.unidadMedida || 'UNID',
        impactoEstimadoEnMargenClp: extraCostFromOverrun,
      };

      const withdrawal: WarehouseWithdrawal = {
        id: `vale-${Date.now()}`,
        empresaId: selectedOp.empresaId,
        folioVale: folioInterno('VALE'),
        fecha: new Date().toISOString().split('T')[0],
        tipoRetiro: 'ORDEN_PRODUCCION',
        ordenProduccionId: selectedOp.id,
        ordenProduccionFolio: selectedOp.folioOP,
        clienteNombre: selectedOp.clienteNombre,
        bodegaOrigenId: selectedWarehouseId,
        bodegaOrigenNombre: warehouse?.nombre || 'Bodega Central',
        solicitanteNombre,
        responsableBodega,
        items: [withdrawalItem],
        costoTotalVale: totalWithdrawalCostOp,
        observaciones: hasOverconsumption
          ? `ALERTA DE SOBRECONSUMO: ${motivoSobreconsumo}. ${observaciones}`
          : observaciones,
      };

      onSubmitWithdrawal(withdrawal);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full p-6 my-8 max-h-[92vh] overflow-y-auto space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-200 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-blue-100 text-blue-800 rounded-lg">
                <PackageMinus className="w-5 h-5" />
              </span>
              <h2 className="text-lg font-black text-slate-900">
                Emisión de Vale de Salida / Retiro de Bodega
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Compatible con empresas comerciales, de servicios o industriales. Registra la rebaja de inventario
              y la imputación contable al Centro de Costo o a la Orden de Producción correspondiente.
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Mode Selector: Nota de Pedido / CC vs Orden de Producción */}
        <div className="bg-slate-100 p-1.5 rounded-xl flex items-center gap-1.5 text-xs font-bold">
          <button
            type="button"
            onClick={() => setWithdrawalMode('NOTA_PEDIDO_CC')}
            className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition cursor-pointer ${
              withdrawalMode === 'NOTA_PEDIDO_CC'
                ? 'bg-white text-blue-800 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShoppingBag className="w-4 h-4 text-blue-600" />
            <span>Nota de Pedido Autorizada (Comercial / Centro de Costo)</span>
          </button>

          <button
            type="button"
            onClick={() => setWithdrawalMode('ORDEN_PRODUCCION')}
            className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition cursor-pointer ${
              withdrawalMode === 'ORDEN_PRODUCCION'
                ? 'bg-white text-amber-900 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Briefcase className="w-4 h-4 text-amber-600" />
            <span>Retiro a Orden de Producción / Trabajo (OP/OT Fabril)</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* ============================================================ */}
          {/* MODE 1: NOTA DE PEDIDO / CENTRO DE COSTO                     */}
          {/* ============================================================ */}
          {withdrawalMode === 'NOTA_PEDIDO_CC' && (
            <div className="space-y-4">
              <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-blue-600" />
                    1. Requerimiento & Autorización de la Nota de Pedido
                  </span>
                  <span className="text-[11px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                    Empresa Comercial / Servicios
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Folio Nota de Pedido</label>
                    <input
                      type="text"
                      required
                      value={notaPedidoFolio}
                      onChange={(e) => setNotaPedidoFolio(e.target.value)}
                      placeholder="ej: NP-AAAA-NNNN"
                      className="w-full p-2 bg-white border border-slate-300 rounded font-mono font-bold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Autorizado por (Jefatura)</label>
                    <input
                      type="text"
                      required
                      value={notaPedidoAutorizadaPor}
                      onChange={(e) => setNotaPedidoAutorizadaPor(e.target.value)}
                      placeholder="ej: Gerencia Comercial"
                      className="w-full p-2 bg-white border border-slate-300 rounded text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Destino / Cliente</label>
                    <input
                      type="text"
                      required
                      value={clienteOAreaDestino}
                      onChange={(e) => setClienteOAreaDestino(e.target.value)}
                      placeholder="ej: Sucursal Santiago"
                      className="w-full p-2 bg-white border border-slate-300 rounded text-slate-900"
                    />
                  </div>
                </div>
              </div>

              {/* Centro de Costo Imputation */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <PieChart className="w-4 h-4 text-indigo-600" />
                    2. Imputación a Centro de Costo (Mini-Empresa)
                  </span>

                  <label className="flex items-center gap-1.5 text-xs text-slate-700 font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isMultiCostCenter}
                      onChange={(e) => setIsMultiCostCenter(e.target.checked)}
                      className="rounded text-blue-600"
                    />
                    <span>Distribuir entre varios Centros de Costo</span>
                  </label>
                </div>

                {!isMultiCostCenter ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="font-semibold text-slate-600 block mb-1">Centro de Costo Receptor:</span>
                      <select
                        value={selectedCostCenterId}
                        onChange={(e) => setSelectedCostCenterId(e.target.value)}
                        className="w-full p-2 bg-white border border-slate-300 rounded-lg font-bold text-slate-900"
                      >
                        {costCenters.map((cc) => (
                          <option key={cc.id} value={cc.id}>
                            {cc.codigo} - {cc.nombre} ({cc.categoria})
                          </option>
                        ))}
                      </select>
                    </div>

                    {selectedCostCenterObj && (
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-[11px] space-y-0.5">
                        <span className="text-slate-400 font-bold block">DATOS DE LA SUBUNIDAD / MINI-EMPRESA</span>
                        <div className="font-bold text-slate-800">{selectedCostCenterObj.nombre}</div>
                        <div className="text-slate-600">
                          Responsable: <strong>{selectedCostCenterObj.responsableNombre}</strong>
                        </div>
                        <div className="text-blue-700 font-mono font-semibold">
                          Presupuesto Mensual: {formatCLP(selectedCostCenterObj.presupuestoMensualClp)}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2 text-xs">
                    <p className="text-[11px] text-slate-500">
                      Indica la distribución porcentual del costo del retiro entre las mini-empresas:
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {multiCostCenterDist.map((dist, idx) => (
                        <div key={idx} className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-1.5">
                          <label className="font-bold text-slate-700 block">Centro de Costo #{idx + 1}</label>
                          <select
                            value={dist.centroCostoId}
                            onChange={(e) => {
                              const updated = [...multiCostCenterDist];
                              updated[idx].centroCostoId = e.target.value;
                              setMultiCostCenterDist(updated);
                            }}
                            className="w-full p-1.5 border border-slate-300 rounded font-semibold text-slate-800"
                          >
                            {costCenters.map((cc) => (
                              <option key={cc.id} value={cc.id}>
                                {cc.codigo} - {cc.nombre}
                              </option>
                            ))}
                          </select>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-500">Porcentaje:</span>
                            <input
                              type="number"
                              min="1"
                              max="100"
                              value={dist.porcentaje}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                const updated = [...multiCostCenterDist];
                                updated[idx].porcentaje = val;
                                if (updated.length === 2) {
                                  const otherIdx = idx === 0 ? 1 : 0;
                                  updated[otherIdx].porcentaje = Math.max(0, 100 - val);
                                }
                                setMultiCostCenterDist(updated);
                              }}
                              className="w-16 p-1 border border-slate-300 rounded font-bold text-center"
                            />
                            <span className="font-bold text-slate-700">%</span>
                            <span className="ml-auto font-mono font-bold text-blue-700">
                              {formatCLP(Math.round((totalWithdrawalCostNp * dist.porcentaje) / 100))}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Material and Warehouse Selection for NP */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider block">
                  3. Selección de Mercadería / Artículo a Retirar
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Bodega de Egreso</label>
                    <select
                      value={selectedWarehouseId}
                      onChange={(e) => setSelectedWarehouseId(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded font-medium"
                    >
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.nombre} ({w.codigo})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="font-bold text-slate-700 block mb-1">Artículo / Mercadería</label>
                    <select
                      value={selectedNpItemId}
                      onChange={(e) => setSelectedNpItemId(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded font-bold text-slate-900"
                    >
                      {inventoryItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          [{item.sku}] {item.nombre} - Stock: {item.stockDisponible} {item.unidadMedida} (PMP:{' '}
                          {formatCLP(item.costoUnitarioPMP)})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs border-t border-slate-100">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Cantidad a Retirar ({inventoryItemNp?.unidadMedida || 'UNID'})
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={cantidadSolicitadaNp}
                      onChange={(e) => setCantidadSolicitadaNp(Math.max(1, Number(e.target.value)))}
                      className="w-full p-2 border border-slate-300 rounded font-black font-mono text-base text-blue-900"
                    />
                    <span className="text-[10px] text-slate-500 mt-0.5 block">
                      Disponible en bodega: <strong>{physicalStockAvailableNp} {inventoryItemNp?.unidadMedida}</strong>
                    </span>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Costo Unitario PMP</label>
                    <div className="p-2 bg-slate-50 border border-slate-200 rounded font-mono font-bold text-slate-800">
                      {formatCLP(unitCostNp)} / {inventoryItemNp?.unidadMedida}
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Costo Total del Retiro</label>
                    <div className="p-2 bg-emerald-50 border border-emerald-200 rounded font-mono font-black text-emerald-800 text-sm">
                      {formatCLP(totalWithdrawalCostNp)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Accounting Voucher Preview for Non-Production Withdrawal */}
              <div className="bg-slate-900 text-slate-200 p-3.5 rounded-xl text-xs space-y-2 font-mono">
                <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800 pb-1.5">
                  <span className="flex items-center gap-1">
                    <BookOpen className="w-3.5 h-3.5 text-blue-400" />
                    ASIENTO CONTABLE AUTOMÁTICO DE REBAJA DE BODEGA & IMPUTACIÓN
                  </span>
                  <span className="text-emerald-400">CUADRADO</span>
                </div>
                <div className="grid grid-cols-12 gap-2 text-[11px]">
                  <div className="col-span-5 text-slate-300">
                    5.1.02 Costo de Ventas / Gasto Operacional
                    <span className="text-[10px] text-blue-400 block font-sans">
                      CC: {selectedCostCenterObj?.codigo || 'CC-VTA-STGO'} ({selectedCostCenterObj?.nombre})
                    </span>
                  </div>
                  <div className="col-span-3 text-right text-emerald-400 font-bold">
                    {formatCLP(totalWithdrawalCostNp)}
                  </div>
                  <div className="col-span-3 text-right text-slate-500">$0</div>
                  <div className="col-span-1"></div>

                  <div className="col-span-5 text-slate-300 pl-4">
                    1.1.04 Existencias y Mercaderías en Bodega
                    <span className="text-[10px] text-slate-400 block font-sans">
                      Bodega: {warehouses.find((w) => w.id === selectedWarehouseId)?.nombre || 'Central'}
                    </span>
                  </div>
                  <div className="col-span-3 text-right text-slate-500">$0</div>
                  <div className="col-span-3 text-right text-amber-400 font-bold">
                    {formatCLP(totalWithdrawalCostNp)}
                  </div>
                  <div className="col-span-1"></div>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* MODE 2: ORDEN DE PRODUCCIÓN FABRIL                          */}
          {/* ============================================================ */}
          {withdrawalMode === 'ORDEN_PRODUCCION' && (
            <div className="space-y-4">
              {!isCreatingNewOp ? (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                      1. Selección de Orden de Producción / Trabajo (OP/OT)
                    </label>

                    <button
                      type="button"
                      onClick={() => setIsCreatingNewOp(true)}
                      className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Crear / Convertir Presupuesto</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="font-semibold text-slate-600 block mb-1">Orden de Producción Activa:</span>
                      <select
                        value={selectedOpId}
                        onChange={(e) => setSelectedOpId(e.target.value)}
                        className="w-full p-2.5 bg-white border border-slate-300 rounded-lg font-bold font-mono text-slate-900"
                      >
                        {activeOrders.map((op) => (
                          <option key={op.id} value={op.id}>
                            {op.folioOP} - {op.productoNombre.slice(0, 35)}...
                          </option>
                        ))}
                      </select>
                    </div>

                    {selectedOp && (
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-[11px] space-y-0.5">
                        <span className="text-slate-400 font-bold block">DATOS DE LA OP SELECCIONADA</span>
                        <div className="font-bold text-slate-800">{selectedOp.productoNombre}</div>
                        <div className="text-slate-600">
                          Cliente: <strong>{selectedOp.clienteNombre || 'Cliente General'}</strong>
                        </div>
                        <div className="text-blue-700 font-mono font-semibold">
                          Presupuesto Base: {selectedOp.presupuestoFolio || 'Asignado Directo'} (Margen Meta:{' '}
                          {selectedOp.margenPresupuestadoPct || 35}%)
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-amber-50/70 p-4 rounded-xl border border-amber-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-amber-900 uppercase">
                      Convertir Presupuesto en OP para Emitir Vale
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsCreatingNewOp(false)}
                      className="text-xs font-bold text-slate-600 hover:text-slate-800 cursor-pointer"
                    >
                      Volver a lista de OPs
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Presupuesto Aprobado:</label>
                      <select
                        value={selectedBudgetIdToConvert}
                        onChange={(e) => setSelectedBudgetIdToConvert(e.target.value)}
                        className="w-full p-2 bg-white border border-slate-300 rounded"
                      >
                        <option value="">Selecciona un presupuesto...</option>
                        {productionBudgets.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.folio} - {b.productoNombre.slice(0, 30)} ({b.estado})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Folio Nueva OP:</label>
                      <input
                        type="text"
                        value={quickOpFolio}
                        onChange={(e) => setQuickOpFolio(e.target.value)}
                        className="w-full p-2 bg-white border border-slate-300 rounded font-mono"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleQuickCreateFromBudget}
                    disabled={!selectedBudgetIdToConvert}
                    className="w-full py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold rounded-lg text-xs transition cursor-pointer"
                  >
                    Confirmar OP y Continuar con el Retiro
                  </button>
                </div>
              )}

              {/* Material selection for OP */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider block">
                  2. Material Presupuestado de la OP a Retirar
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Bodega de Origen</label>
                    <select
                      value={selectedWarehouseId}
                      onChange={(e) => setSelectedWarehouseId(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded"
                    >
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.nombre} ({w.codigo})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Insumo Presupuestado</label>
                    <select
                      value={selectedInsumoCodigo}
                      onChange={(e) => setSelectedInsumoCodigo(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded font-bold text-slate-900"
                    >
                      {budgetedMaterials.map((m) => (
                        <option key={m.insumoCodigo} value={m.insumoCodigo}>
                          {m.insumoNombre} (Presupuestado: {m.cantidadPresupuestada} {m.unidadMedida})
                        </option>
                      ))}
                      {budgetedMaterials.length === 0 &&
                        inventoryItems.map((it) => (
                          <option key={it.sku} value={it.sku}>
                            {it.nombre} ({it.sku})
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs border-t border-slate-100">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Cantidad a Retirar</label>
                    <input
                      type="number"
                      min="1"
                      value={cantidadSolicitadaOp}
                      onChange={(e) => setCantidadSolicitadaOp(Math.max(1, Number(e.target.value)))}
                      className="w-full p-2 border border-slate-300 rounded font-black font-mono text-base text-amber-900"
                    />
                    <span className="text-[10px] text-slate-500 mt-0.5 block">
                      Disponible: {physicalStockAvailableOp} {inventoryItemOp?.unidadMedida}
                    </span>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Costo PMP Unitario</label>
                    <div className="p-2 bg-slate-50 border border-slate-200 rounded font-mono font-bold text-slate-800">
                      {formatCLP(unitCostOp)}
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Total Vale de Retiro</label>
                    <div className="p-2 bg-amber-50 border border-amber-200 rounded font-mono font-black text-amber-800 text-sm">
                      {formatCLP(totalWithdrawalCostOp)}
                    </div>
                  </div>
                </div>
              </div>

              {/* BUDGET WATCHDOG */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs space-y-1.5">
                <div className="flex justify-between font-semibold">
                  <span className="text-slate-600">Control de Cuota Presupuestada en la OP:</span>
                  <span className="font-mono text-slate-800">
                    Consumo Proyectado: {totalResultingQty} / Meta: {budgetedQty || 'No fijada'}
                  </span>
                </div>

                <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      hasOverconsumption ? 'bg-rose-500' : 'bg-emerald-500'
                    }`}
                    style={{
                      width: `${Math.min(100, budgetedQty > 0 ? (totalResultingQty / budgetedQty) * 100 : 100)}%`,
                    }}
                  />
                </div>
              </div>

              {hasOverconsumption && (
                <div className="bg-rose-50 border-2 border-rose-300 rounded-xl p-4 space-y-2.5">
                  <div className="flex items-start gap-2 text-rose-900">
                    <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-black text-xs uppercase tracking-wider">
                        ALERTA DE SOBRECONSUMO: EXCESO SOBRE PRESUPUESTO FABRIL
                      </h4>
                      <p className="text-xs leading-relaxed font-medium mt-0.5">
                        Este retiro excede la cantidad presupuestada en <strong>+{deviationQty} unidades</strong>.
                        Sobrecosto directo: <strong>+{formatCLP(extraCostFromOverrun)}</strong>.
                        Erosión estimada en margen: <strong>{marginErosionPct} puntos</strong>.
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-rose-200">
                    <label className="font-bold text-rose-900 block mb-1">
                      Justificación Técnica del Desvío:
                    </label>
                    <select
                      value={motivoSobreconsumo}
                      onChange={(e) => setMotivoSobreconsumo(e.target.value)}
                      className="w-full p-2 bg-white border border-rose-300 rounded font-medium text-rose-950"
                    >
                      <option value="Merma técnica imprevista en paño">Merma técnica imprevista en paño / malla</option>
                      <option value="Rotura de material durante proceso de relingado">
                        Rotura de material durante proceso de relingado
                      </option>
                      <option value="Ajuste de dimensiones solicitado por el cliente">
                        Ajuste de dimensiones solicitado por el cliente
                      </option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Custody and Signatures (Common) */}
          <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Solicitante / Receptor</label>
              <input
                type="text"
                required
                value={solicitanteNombre}
                onChange={(e) => setSolicitanteNombre(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Responsable de Bodega</label>
              <input
                type="text"
                required
                value={responsableBodega}
                onChange={(e) => setResponsableBodega(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded"
              />
            </div>
          </div>

          <div className="text-xs">
            <label className="font-bold text-slate-700 block mb-1">Observaciones / Glosa Adicional</label>
            <input
              type="text"
              placeholder="ej: Despacho para distribución comercial s/ Guía interna..."
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded"
            />
          </div>

          {/* Modal Footer */}
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-bold hover:bg-slate-50 cursor-pointer text-xs"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-black px-5 py-2 rounded-lg shadow cursor-pointer transition text-xs"
            >
              <PackageMinus className="w-4 h-4" />
              <span>Emitir Vale y Rebajar Inventario</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
