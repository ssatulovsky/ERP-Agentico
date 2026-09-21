import React, { useState } from 'react';
import {
  ProductionOrder,
  ProductionBudget,
  Warehouse,
  InventoryItem,
  WarehouseWithdrawal,
  WarehouseWithdrawalItem,
} from '../types';
import { formatCLP } from '../utils/chileanAccounting';
import { convertBudgetToProductionOrder } from '../data/seedBudgetsAndWithdrawals';
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
} from 'lucide-react';

interface WarehouseWithdrawalModalProps {
  productionOrders: ProductionOrder[];
  productionBudgets: ProductionBudget[];
  warehouses: Warehouse[];
  inventoryItems: InventoryItem[];
  onClose: () => void;
  onSubmitWithdrawal: (withdrawal: WarehouseWithdrawal) => void;
  onQuickCreateOp?: (newOp: ProductionOrder) => void;
}

export const WarehouseWithdrawalModal: React.FC<WarehouseWithdrawalModalProps> = ({
  productionOrders,
  productionBudgets,
  warehouses,
  inventoryItems,
  onClose,
  onSubmitWithdrawal,
  onQuickCreateOp,
}) => {
  // Active / Eligible Production Orders
  const activeOrders = productionOrders.filter((op) => op.estado === 'EN_PROCESO' || op.estado === 'PLANIFICADA');

  const [selectedOpId, setSelectedOpId] = useState<string>(activeOrders[0]?.id || '');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(warehouses[0]?.id || '');
  const [solicitanteNombre, setSolicitanteNombre] = useState<string>('Manuel Alvarado Cárdenas - Maestro Redero');
  const [responsableBodega, setResponsableBodega] = useState<string>(
    warehouses[0]?.encargadoNombre || 'Williams Rojas - Encargado de Bodega'
  );
  const [observaciones, setObservaciones] = useState<string>('');

  // Selected OP
  const selectedOp = productionOrders.find((op) => op.id === selectedOpId);

  // Quick OP Creation mode if OP doesn't exist
  const [isCreatingNewOp, setIsCreatingNewOp] = useState<boolean>(activeOrders.length === 0);
  const [quickOpFolio, setQuickOpFolio] = useState<string>(
    `OP-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`
  );
  const [quickOpDesc, setQuickOpDesc] = useState<string>('');
  const [quickOpClient, setQuickOpClient] = useState<string>('Pesquera Chiloé Ltda.');
  const [selectedBudgetIdToConvert, setSelectedBudgetIdToConvert] = useState<string>('');

  // Material item for withdrawal
  const [selectedInsumoCodigo, setSelectedInsumoCodigo] = useState<string>('');
  const [cantidadSolicitada, setCantidadSolicitada] = useState<number>(1);
  const [motivoSobreconsumo, setMotivoSobreconsumo] = useState<string>('Merma técnica imprevista en paño');

  // Find budgeted materials for the selected OP
  const budgetedMaterials = selectedOp?.presupuestoBase?.materialesPresupuestados || [];

  // Update selected material when OP changes
  React.useEffect(() => {
    if (budgetedMaterials.length > 0 && !selectedInsumoCodigo) {
      setSelectedInsumoCodigo(budgetedMaterials[0].insumoCodigo);
    }
  }, [selectedOpId, budgetedMaterials]);

  // Find matching inventory item for pricing & stock
  const inventoryItem = inventoryItems.find(
    (it) => it.sku === selectedInsumoCodigo || it.id === selectedInsumoCodigo
  );

  // Find warehouse stock
  const warehouseStockInfo = inventoryItem?.stockPorBodega?.find((b) => b.bodegaId === selectedWarehouseId);
  const physicalStockAvailable = warehouseStockInfo ? warehouseStockInfo.stockFisico : inventoryItem?.stockDisponible || 0;

  // Find budgeted detail for the selected material
  const budgetDetail = budgetedMaterials.find((m) => m.insumoCodigo === selectedInsumoCodigo);

  // Calculate prior consumption of this material in this OP
  const previousConsumptionQty = (selectedOp?.consumosMateriales || [])
    .filter((c) => c.insumoCodigo === selectedInsumoCodigo)
    .reduce((acc, c) => acc + c.cantidadConsumida, 0);

  const budgetedQty = budgetDetail ? budgetDetail.cantidadPresupuestada : 0;
  const totalResultingQty = previousConsumptionQty + cantidadSolicitada;
  const hasOverconsumption = budgetedQty > 0 && totalResultingQty > budgetedQty;
  const deviationQty = hasOverconsumption ? totalResultingQty - budgetedQty : 0;

  const unitCost = inventoryItem?.costoUnitarioPMP || budgetDetail?.costoUnitarioEstimado || 350000;
  const totalWithdrawalCost = cantidadSolicitada * unitCost;
  const extraCostFromOverrun = deviationQty * unitCost;

  // Project Margin Impact
  const clientNetPrice = selectedOp?.precioVentaPactado || selectedOp?.precioVentaEstimado || 15000000;
  const currentTotalOpCost = (selectedOp?.costoTotalProduccion || 0) + totalWithdrawalCost;
  const projectedMarginClp = clientNetPrice - currentTotalOpCost;
  const projectedMarginPct =
    clientNetPrice > 0 ? Number(((projectedMarginClp / clientNetPrice) * 100).toFixed(1)) : 0;
  const budgetedMarginPct = selectedOp?.margenPresupuestadoPct || 35;
  const marginErosionPct = Number((budgetedMarginPct - projectedMarginPct).toFixed(1));

  const handleQuickCreateFromBudget = () => {
    const budget = productionBudgets.find((b) => b.id === selectedBudgetIdToConvert);
    if (!budget) return;

    const newOp = convertBudgetToProductionOrder(budget, quickOpFolio);
    if (onQuickCreateOp) {
      onQuickCreateOp(newOp);
    }
    setSelectedOpId(newOp.id);
    setIsCreatingNewOp(false);
  };

  const handleManualQuickCreateOp = () => {
    if (!quickOpDesc) return;

    const newOp: ProductionOrder = {
      id: `op-quick-${Date.now()}`,
      empresaId: 'client-mar-austral',
      folioOP: quickOpFolio,
      descripcion: quickOpDesc,
      productoCodigo: 'PROD-TALLER-ESP',
      productoNombre: quickOpDesc,
      categoria: 'REDES_Y_FONDEOS',
      unidadMedida: 'UNID',
      fechaInicio: new Date().toISOString().split('T')[0],
      fechaEstimadaTermino: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      estado: 'EN_PROCESO',
      cantidadObjetivo: 1,
      cantidadProducidaReal: 0,
      cantidadMerma: 0,
      bodegaDestinoNombre: 'Bodega Central Quellón',
      costoDirectoMateriales: 0,
      costoDirectoManoObra: 0,
      costoPrimo: 0,
      baseProrrateoCif: 'HORAS_HOMBRE_MOD',
      tasaCifAplicada: 8900,
      costoIndirectoCif: 0,
      costoTotalProduccion: 0,
      costoUnitarioReal: 0,
      precioVentaEstimado: 10000000,
      margenBrutoUnitarioEstimado: 35,
      consumosMateriales: [],
      manoDeObraRegistros: [],
      clienteNombre: quickOpClient,
      precioVentaPactado: 10000000,
      margenPresupuestadoClp: 3500000,
      margenPresupuestadoPct: 35,
      presupuestoBase: {
        costoMpdPresupuestado: 4500000,
        costoModPresupuestado: 1200000,
        costoCifPresupuestado: 800000,
        costoTotalPresupuestado: 6500000,
        materialesPresupuestados: [
          {
            insumoCodigo: 'MAT-HDPE-PAÑO',
            insumoNombre: 'Paño de Red HDPE Virgen Malla 1.5"',
            cantidadPresupuestada: 4,
            costoUnitarioEstimado: 1450000,
            costoTotalPresupuestado: 5800000,
            unidadMedida: 'ROLLO',
          },
        ],
      },
      asientosGenerados: {},
    };

    if (onQuickCreateOp) {
      onQuickCreateOp(newOp);
    }
    setSelectedOpId(newOp.id);
    setIsCreatingNewOp(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedOp) {
      alert('Debes seleccionar o crear una Orden de Producción / Trabajo.');
      return;
    }

    if (cantidadSolicitada <= 0) {
      alert('La cantidad a retirar debe ser mayor a 0.');
      return;
    }

    const warehouse = warehouses.find((w) => w.id === selectedWarehouseId);

    const withdrawalItem: WarehouseWithdrawalItem = {
      insumoId: inventoryItem?.id || selectedInsumoCodigo,
      insumoCodigo: selectedInsumoCodigo,
      insumoNombre: inventoryItem?.nombre || budgetDetail?.insumoNombre || selectedInsumoCodigo,
      cantidadSolicitada,
      cantidadPresupuestadaOriginal: budgetedQty,
      cantidadPreviaConsumida: previousConsumptionQty,
      cantidadTotalResultante: totalResultingQty,
      haySobreconsumo: hasOverconsumption,
      desvioCantidad: deviationQty,
      costoUnitarioPMP: unitCost,
      costoTotal: totalWithdrawalCost,
      unidadMedida: inventoryItem?.unidadMedida || budgetDetail?.unidadMedida || 'UNID',
      impactoEstimadoEnMargenClp: extraCostFromOverrun,
    };

    const withdrawal: WarehouseWithdrawal = {
      id: `vale-${Date.now()}`,
      empresaId: selectedOp.empresaId,
      folioVale: `VALE-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      fecha: new Date().toISOString().split('T')[0],
      ordenProduccionId: selectedOp.id,
      ordenProduccionFolio: selectedOp.folioOP,
      clienteNombre: selectedOp.clienteNombre,
      bodegaOrigenId: selectedWarehouseId,
      bodegaOrigenNombre: warehouse?.nombre || 'Bodega Central',
      solicitanteNombre,
      responsableBodega,
      items: [withdrawalItem],
      costoTotalVale: totalWithdrawalCost,
      observaciones: hasOverconsumption
        ? `ALERTA DE SOBRECONSUMO: ${motivoSobreconsumo}. ${observaciones}`
        : observaciones,
    };

    onSubmitWithdrawal(withdrawal);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full p-6 my-8 max-h-[90vh] overflow-y-auto space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-200 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-amber-100 text-amber-800 rounded-lg">
                <PackageMinus className="w-5 h-5" />
              </span>
              <h2 className="text-lg font-black text-slate-900">
                Vale de Retiro de Bodega a Orden de Producción (OP/OT)
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Normativa de Control Fabril: Todo egreso de materiales debe estar estrictamente imputado a una OP activa
              y cotejado contra su presupuesto.
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* STEP 1: Select or Create OP */}
        {!isCreatingNewOp ? (
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                1. Selección de Orden de Producción / Trabajo (OP/OT Obligatoria)
              </label>

              <button
                type="button"
                onClick={() => setIsCreatingNewOp(true)}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>¿No existe la OP? Crear / Convertir Presupuesto</span>
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
          /* Quick OP Creation Form / Convert from Budget */
          <div className="bg-blue-50/70 p-4 rounded-xl border border-blue-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-blue-900 uppercase flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <span>Generar OP Inmediata para Habilitar Retiro de Bodega</span>
              </span>
              <button
                type="button"
                onClick={() => setIsCreatingNewOp(false)}
                className="text-xs text-slate-500 hover:text-slate-700 underline cursor-pointer"
              >
                Volver a lista de OPs existentes
              </button>
            </div>

            {productionBudgets.filter((b) => b.estado === 'APROBADO' || b.estado === 'ENVIADO').length > 0 && (
              <div className="bg-white p-3 rounded-lg border border-blue-200 text-xs space-y-2">
                <span className="font-bold text-slate-700 block">Opción A: Convertir un Presupuesto ya Existente</span>
                <div className="flex gap-2">
                  <select
                    value={selectedBudgetIdToConvert}
                    onChange={(e) => setSelectedBudgetIdToConvert(e.target.value)}
                    className="flex-1 p-2 border border-slate-300 rounded font-medium"
                  >
                    <option value="">Selecciona un presupuesto...</option>
                    {productionBudgets.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.folio} - {b.clienteNombre} ({b.productoNombre.slice(0, 25)}...)
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!selectedBudgetIdToConvert}
                    onClick={handleQuickCreateFromBudget}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold px-3 py-1.5 rounded cursor-pointer"
                  >
                    Generar OP
                  </button>
                </div>
              </div>
            )}

            <div className="bg-white p-3 rounded-lg border border-slate-200 text-xs space-y-2">
              <span className="font-bold text-slate-700 block">Opción B: Creación Rápida de OP en Taller</span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 block font-bold">Folio OP</label>
                  <input
                    type="text"
                    value={quickOpFolio}
                    onChange={(e) => setQuickOpFolio(e.target.value)}
                    className="w-full p-1.5 border border-slate-300 rounded font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block font-bold">Cliente</label>
                  <input
                    type="text"
                    value={quickOpClient}
                    onChange={(e) => setQuickOpClient(e.target.value)}
                    className="w-full p-1.5 border border-slate-300 rounded"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block font-bold">Descripción del Trabajo</label>
                <input
                  type="text"
                  placeholder="ej: Armado de Lobera 40x40m Red Reforzada"
                  value={quickOpDesc}
                  onChange={(e) => setQuickOpDesc(e.target.value)}
                  className="w-full p-1.5 border border-slate-300 rounded"
                />
              </div>
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={handleManualQuickCreateOp}
                  className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-3 py-1.5 rounded cursor-pointer"
                >
                  Confirmar y Crear OP
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Material and Warehouse Selector with Overconsumption Watchdog */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="border border-slate-200 rounded-xl p-4 space-y-4">
            <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
              2. Detalle del Material y Bodega de Despacho
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Bodega de Origen</label>
                <select
                  value={selectedWarehouseId}
                  onChange={(e) => setSelectedWarehouseId(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.nombre} ({w.comuna})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Material / Insumo Solicitado</label>
                <select
                  value={selectedInsumoCodigo}
                  onChange={(e) => setSelectedInsumoCodigo(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg font-mono font-medium"
                >
                  {/* Prioritize items in the OP budget */}
                  {budgetedMaterials.length > 0 && (
                    <optgroup label="Insumos Presupuestados en la OP">
                      {budgetedMaterials.map((m) => (
                        <option key={m.insumoCodigo} value={m.insumoCodigo}>
                          {m.insumoCodigo} - {m.insumoNombre} (Presup: {m.cantidadPresupuestada} {m.unidadMedida})
                        </option>
                      ))}
                    </optgroup>
                  )}

                  {/* General Inventory Items */}
                  <optgroup label="Catálogo General de Insumos">
                    {inventoryItems.map((it) => (
                      <option key={it.id} value={it.sku}>
                        {it.sku} - {it.nombre}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
            </div>

            {/* Quantity and Stock Validation */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Cantidad a Retirar</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={cantidadSolicitada}
                  onChange={(e) => setCantidadSolicitada(Number(e.target.value))}
                  className="w-full p-2 border border-slate-300 rounded-lg font-mono font-bold text-base text-slate-900"
                />
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Stock Físico en Bodega</span>
                <div
                  className={`text-sm font-black font-mono mt-0.5 ${
                    physicalStockAvailable < cantidadSolicitada ? 'text-rose-600' : 'text-slate-800'
                  }`}
                >
                  {physicalStockAvailable} {inventoryItem?.unidadMedida || 'UNID'}
                </div>
                <span className="text-[10px] text-slate-400">
                  {physicalStockAvailable < cantidadSolicitada ? '⚠️ Stock insuficiente' : 'Disponible para despacho'}
                </span>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Valorización del Retiro</span>
                <div className="text-sm font-black font-mono text-slate-900 mt-0.5">
                  {formatCLP(totalWithdrawalCost)}
                </div>
                <span className="text-[10px] text-slate-400 font-mono">PMP: {formatCLP(unitCost)} c/u</span>
              </div>
            </div>

            {/* BUDGET CONSUMPTION WATCHDOG BAR */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs space-y-1.5">
              <div className="flex justify-between font-semibold">
                <span className="text-slate-600">Control de Cuota Presupuestada en la OP:</span>
                <span className="font-mono text-slate-800">
                  Consumo Total Proyectado: {totalResultingQty} / Meta Presupuestada: {budgetedQty || 'No fijada'}
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    hasOverconsumption ? 'bg-rose-500' : 'bg-emerald-500'
                  }`}
                  style={{
                    width: `${Math.min(
                      100,
                      budgetedQty > 0 ? (totalResultingQty / budgetedQty) * 100 : 100
                    )}%`,
                  }}
                />
              </div>
            </div>

            {/* CRITICAL ALERT ON OVERCONSUMPTION / MARGIN IMPACT */}
            {hasOverconsumption && (
              <div className="bg-rose-50 border-2 border-rose-300 rounded-xl p-4 space-y-2.5 animate-pulse-subtle">
                <div className="flex items-start gap-2 text-rose-900">
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-black text-xs uppercase tracking-wider">
                      ALERTA DE SOBRECONSUMO: EXCESO SOBRE PRESUPUESTO
                    </h4>
                    <p className="text-xs leading-relaxed font-medium mt-0.5">
                      Este retiro excede la cantidad presupuestada en <strong>+{deviationQty} unidades</strong>.
                      Generará un sobrecosto directo de <strong>+{formatCLP(extraCostFromOverrun)}</strong>,
                      provocando una <strong>erosión en el margen de ganancia de {marginErosionPct} puntos</strong>{' '}
                      (de {budgetedMarginPct}% a ~{projectedMarginPct}%).
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-rose-200">
                  <label className="font-bold text-rose-900 block mb-1">
                    Justificación Técnica / Causa del Desvío (Obligatoria para auditoría):
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
                      Ajuste de dimensiones solicitado por el cliente (generar cobro adicional)
                    </option>
                    <option value="Falla de proveedor en resistencia mecánica del lote">
                      Falla de proveedor en resistencia mecánica del lote
                    </option>
                  </select>
                </div>
              </div>
            )}

            {/* Signatures & Custody */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Solicitante (Taller / Redero)</label>
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

            <div>
              <label className="font-bold text-slate-700 block mb-1">Observaciones del Vale</label>
              <input
                type="text"
                placeholder="ej: Despacho para etapa de corte y confección de relingas."
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded"
              />
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-bold hover:bg-slate-50 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-black px-5 py-2 rounded-lg shadow cursor-pointer transition"
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
