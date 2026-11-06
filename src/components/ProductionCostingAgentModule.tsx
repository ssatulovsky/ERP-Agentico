import React, { useState, useMemo } from 'react';
import {
  ProductionOrder,
  ProductionOrderStatus,
  ProductionProductCategory,
  CifAllocationBase,
  DirectMaterialConsumption,
  DirectLaborEntry,
  IndirectCostPoolItem,
  AccountingEntry,
  ClientCompany,
  ProductionBudget,
  ProductionOrderClosureAnalysis,
  WarehouseWithdrawal,
  InventoryItem,
  Warehouse,
} from '../types';
import {
  formatCLP,
  createProductionMpdConsumptionEntry,
  createProductionModAllocationEntry,
  createProductionCifAllocationEntry,
  createProductionFinishedLiquidationEntry,
  createProductionCogsEntry,
} from '../utils/chileanAccounting';
import {
  Factory,
  Layers,
  Users,
  Cpu,
  TrendingUp,
  FileSpreadsheet,
  PlusCircle,
  CheckCircle2,
  BookOpen,
  DollarSign,
  Boxes,
  Zap,
  Clock,
  ArrowRight,
  ShieldCheck,
  Percent,
  FileText,
  Building2,
  Bot,
  Sparkles,
  X,
  ShieldAlert,
} from 'lucide-react';
import { getStoredAuthToken } from '../services/apiClient';
import { BudgetManagementSection } from './BudgetManagementSection';
import { OpClosureAnalysisModal } from './OpClosureAnalysisModal';

interface ProductionCostingAgentModuleProps {
  currentClient: ClientCompany;
  productionOrders?: ProductionOrder[];
  cifPoolItems?: IndirectCostPoolItem[];
  onAddProductionOrder: (order: ProductionOrder) => void;
  onUpdateProductionOrder: (order: ProductionOrder) => void;
  onAddAccountingEntry: (entry: AccountingEntry) => void;
  accountingEntries?: AccountingEntry[];
  productionBudgets?: ProductionBudget[];
  warehouseWithdrawals?: WarehouseWithdrawal[];
  onAddProductionBudget?: (budget: ProductionBudget) => void;
  onUpdateProductionBudget?: (budget: ProductionBudget) => void;
  onApproveBudgetAndGenerateOp?: (budget: ProductionBudget) => void;
  inventoryItems?: InventoryItem[];
  warehouses?: Warehouse[];
  onUpdateInventoryItems?: (items: InventoryItem[]) => void;
}

export const ProductionCostingAgentModule: React.FC<ProductionCostingAgentModuleProps> = ({
  currentClient,
  productionOrders = [],
  cifPoolItems = [],
  onAddProductionOrder,
  onUpdateProductionOrder,
  onAddAccountingEntry,
  accountingEntries = [],
  productionBudgets = [],
  warehouseWithdrawals = [],
  onAddProductionBudget,
  onUpdateProductionBudget,
  onApproveBudgetAndGenerateOp,
  inventoryItems = [],
  warehouses = [],
  onUpdateInventoryItems,
}) => {
  const safeOrders = useMemo(() => Array.isArray(productionOrders) ? productionOrders : [], [productionOrders]);
  const safeCif = useMemo(() => Array.isArray(cifPoolItems) ? cifPoolItems : [], [cifPoolItems]);
  const safeEntries = useMemo(() => Array.isArray(accountingEntries) ? accountingEntries : [], [accountingEntries]);
  const safeBudgets = useMemo(() => Array.isArray(productionBudgets) ? productionBudgets : [], [productionBudgets]);

  const [activeTab, setActiveTab] = useState<'PRESUPUESTOS' | 'ORDENES' | 'MPD' | 'MOD' | 'CIF' | 'ESTADO_COSTO' | 'CONTABILIDAD'>('ORDENES');
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);
  const [closureModalOp, setClosureModalOp] = useState<ProductionOrder | null>(null);

  // Modales
  const [showCreateOpModal, setShowCreateOpModal] = useState(false);
  const [showMpdModalForOp, setShowMpdModalForOp] = useState<ProductionOrder | null>(null);
  const [showModModalForOp, setShowModModalForOp] = useState<ProductionOrder | null>(null);
  const [showCogsModalForOp, setShowCogsModalForOp] = useState<ProductionOrder | null>(null);
  const [selectedOpDetail, setSelectedOpDetail] = useState<ProductionOrder | null>(null);

  // Form State para Nueva OP
  const [newOpForm, setNewOpForm] = useState<Partial<ProductionOrder>>({
    folioOP: `OP-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`,
    descripcion: '',
    productoCodigo: '',
    productoNombre: '',
    categoria: 'REDES_Y_FONDEOS',
    unidadMedida: 'UNID',
    fechaInicio: new Date().toISOString().split('T')[0],
    fechaEstimadaTermino: '',
    cantidadObjetivo: 1,
    baseProrrateoCif: 'HORAS_HOMBRE_MOD',
    precioVentaEstimado: 0,
    bodegaDestinoNombre: 'Bodega Central de Productos Terminados',
  });

  // Form State para Consumo MPD
  const [mpdForm, setMpdForm] = useState({
    insumoCodigo: 'MAT-GEN',
    insumoNombre: '',
    bodegaOrigenNombre: 'Bodega Materias Primas',
    cantidadConsumida: 1,
    unidadMedida: 'UNID',
    costoUnitarioPMP: 0,
    folioGuiaDespacho52: undefined as number | undefined,
  });

  // Form State para Horas MOD
  const [modForm, setModForm] = useState({
    trabajadorRut: '15.220.100-3',
    trabajadorNombre: 'Maestro Operario Fabril',
    cargo: 'Operador Especialista',
    horasTrabajadas: 8,
    tarifaHoraCostoEmpresa: 14000,
    etapaProceso: 'Confección y Armado',
  });

  // Form State para Costo de Ventas
  const [cogsForm, setCogsForm] = useState({
    cantidadVendida: 1,
    dteFolioFactura: undefined as number | undefined,
  });

  // Estado del Motor de asistentes con herramientas
  const [isExecutingAgent, setIsExecutingAgent] = useState(false);
  const [agentDiagnosticModal, setAgentDiagnosticModal] = useState<{
    title: string;
    decision: string;
    steps: any[];
    approvalRequired?: boolean;
    approvalDetails?: any;
  } | null>(null);

  const triggerSuccess = (msg: string) => {
    setActionSuccessMessage(msg);
    setTimeout(() => setActionSuccessMessage(null), 4500);
  };

  // Métricas Consolidadas de Producción
  const metrics = useMemo(() => {
    let totalMpd = 0;
    let totalMod = 0;
    let totalCif = 0;
    let totalProduccion = 0;
    let opsEnProceso = 0;
    let opsTerminadas = 0;

    safeOrders.forEach((op) => {
      totalMpd += op.costoDirectoMateriales || 0;
      totalMod += op.costoDirectoManoObra || 0;
      totalCif += op.costoIndirectoCif || 0;
      totalProduccion += op.costoTotalProduccion || 0;
      if (op.estado === 'EN_PROCESO') opsEnProceso++;
      if (op.estado === 'TERMINADA' || op.estado === 'LIQUIDADA') opsTerminadas++;
    });

    const totalCifPoolPeriodo = safeCif.reduce((acc, c) => acc + c.montoTotalPeriodo, 0);

    return {
      totalOps: safeOrders.length,
      opsEnProceso,
      opsTerminadas,
      totalMpd,
      totalMod,
      totalPrimo: totalMpd + totalMod,
      totalCif,
      totalProduccion,
      totalCifPoolPeriodo,
    };
  }, [safeOrders, safeCif]);

  // Asientos relacionados con Producción
  const productionEntries = useMemo(() => {
    return safeEntries.filter(
      (e) =>
        e.origen === 'COSTEO_PRODUCCION' ||
        e.concepto.toLowerCase().includes('op-') ||
        e.concepto.toLowerCase().includes('producción') ||
        e.concepto.toLowerCase().includes('mpd') ||
        e.concepto.toLowerCase().includes('mod') ||
        e.concepto.toLowerCase().includes('cif') ||
        e.lineas.some((l) => l.cuentaCodigo.startsWith('1.1.08.') || l.cuentaCodigo.startsWith('5.1.'))
    );
  }, [safeEntries]);

  // Handler: Crear Nueva Orden de Producción
  const handleCreateProductionOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOpForm.productoNombre || !newOpForm.cantidadObjetivo) {
      alert('Complete los campos obligatorios.');
      return;
    }

    const opId = `op-${Date.now()}`;
    const newOp: ProductionOrder = {
      id: opId,
      empresaId: currentClient.id || 'CLIENTE_ACTUAL',
      folioOP: newOpForm.folioOP || `OP-${Date.now().toString().slice(-4)}`,
      descripcion: newOpForm.descripcion || newOpForm.productoNombre || '',
      productoCodigo: newOpForm.productoCodigo || `PROD-${Date.now().toString().slice(-4)}`,
      productoNombre: newOpForm.productoNombre || '',
      categoria: (newOpForm.categoria as ProductionProductCategory) || 'REDES_Y_FONDEOS',
      unidadMedida: newOpForm.unidadMedida || 'UNID',
      fechaInicio: newOpForm.fechaInicio || new Date().toISOString().split('T')[0],
      fechaEstimadaTermino: newOpForm.fechaEstimadaTermino || '',
      estado: 'EN_PROCESO',
      cantidadObjetivo: Number(newOpForm.cantidadObjetivo),
      cantidadProducidaReal: 0,
      cantidadMerma: 0,
      bodegaDestinoNombre: newOpForm.bodegaDestinoNombre || 'Bodega de Productos Terminados',
      costoDirectoMateriales: 0,
      costoDirectoManoObra: 0,
      costoPrimo: 0,
      baseProrrateoCif: (newOpForm.baseProrrateoCif as CifAllocationBase) || 'HORAS_HOMBRE_MOD',
      tasaCifAplicada: 8500, // Tasa estimada por HH
      costoIndirectoCif: 0,
      costoTotalProduccion: 0,
      costoUnitarioReal: 0,
      precioVentaEstimado: Number(newOpForm.precioVentaEstimado) || 0,
      margenBrutoUnitarioEstimado: 0,
      consumosMateriales: [],
      manoDeObraRegistros: [],
      asientosGenerados: {},
    };

    onAddProductionOrder(newOp);
    setShowCreateOpModal(false);
    triggerSuccess(`Orden de Producción ${newOp.folioOP} abierta en estado EN PROCESO.`);
  };

  // Handler: Consumo MPD
  const handleAddMpdConsumption = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showMpdModalForOp) return;
    const op = showMpdModalForOp;

    const cant = Number(mpdForm.cantidadConsumida);
    const pmp = Number(mpdForm.costoUnitarioPMP);
    const totalConsumo = cant * pmp;

    const consumption: DirectMaterialConsumption = {
      id: `cmat-${Date.now()}`,
      ordenProduccionId: op.id,
      fecha: new Date().toISOString().split('T')[0],
      insumoId: `ins-${Date.now()}`,
      insumoCodigo: mpdForm.insumoCodigo || 'MAT-01',
      insumoNombre: mpdForm.insumoNombre || 'Materia Prima Insumida',
      bodegaOrigenId: 'bod-01',
      bodegaOrigenNombre: mpdForm.bodegaOrigenNombre,
      cantidadConsumida: cant,
      unidadMedida: mpdForm.unidadMedida,
      costoUnitarioPMP: pmp,
      costoTotalConsumo: totalConsumo,
      folioGuiaDespacho52: mpdForm.folioGuiaDespacho52,
    };

    // Generar Asiento Contable Automático
    const mpdEntry = createProductionMpdConsumptionEntry(op, consumption);
    consumption.asientoId = mpdEntry.id;
    onAddAccountingEntry(mpdEntry);

    // Actualizar OP
    const updatedMpd = (op.costoDirectoMateriales || 0) + totalConsumo;
    const updatedPrimo = updatedMpd + (op.costoDirectoManoObra || 0);
    const updatedTotal = updatedPrimo + (op.costoIndirectoCif || 0);
    const cantReal = op.cantidadProducidaReal > 0 ? op.cantidadProducidaReal : op.cantidadObjetivo;
    const costUnit = Math.round(updatedTotal / cantReal);

    onUpdateProductionOrder({
      ...op,
      costoDirectoMateriales: updatedMpd,
      costoPrimo: updatedPrimo,
      costoTotalProduccion: updatedTotal,
      costoUnitarioReal: costUnit,
      consumosMateriales: [...op.consumosMateriales, consumption],
    });

    setShowMpdModalForOp(null);
    triggerSuccess(
      `Consumo de ${formatCLP(totalConsumo)} registrado para ${op.folioOP}. Asiento contable de WIP registrado en Libro Diario.`
    );
  };

  // Handler: Imputar MOD
  const handleAddModEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showModModalForOp) return;
    const op = showModModalForOp;

    const horas = Number(modForm.horasTrabajadas);
    const tarifa = Number(modForm.tarifaHoraCostoEmpresa);
    const totalMod = horas * tarifa;

    const labor: DirectLaborEntry = {
      id: `cmod-${Date.now()}`,
      ordenProduccionId: op.id,
      fecha: new Date().toISOString().split('T')[0],
      trabajadorRut: modForm.trabajadorRut,
      trabajadorNombre: modForm.trabajadorNombre,
      cargo: modForm.cargo,
      horasTrabajadas: horas,
      tarifaHoraCostoEmpresa: tarifa,
      costoTotalMOD: totalMod,
      etapaProceso: modForm.etapaProceso,
    };

    // Generar Asiento Contable Automático
    const modEntry = createProductionModAllocationEntry(op, labor);
    labor.asientoId = modEntry.id;
    onAddAccountingEntry(modEntry);

    // Actualizar OP
    const updatedMod = (op.costoDirectoManoObra || 0) + totalMod;
    const updatedPrimo = (op.costoDirectoMateriales || 0) + updatedMod;
    const updatedTotal = updatedPrimo + (op.costoIndirectoCif || 0);
    const cantReal = op.cantidadProducidaReal > 0 ? op.cantidadProducidaReal : op.cantidadObjetivo;
    const costUnit = Math.round(updatedTotal / cantReal);

    onUpdateProductionOrder({
      ...op,
      costoDirectoManoObra: updatedMod,
      costoPrimo: updatedPrimo,
      costoTotalProduccion: updatedTotal,
      costoUnitarioReal: costUnit,
      manoDeObraRegistros: [...op.manoDeObraRegistros, labor],
    });

    setShowModModalForOp(null);
    triggerSuccess(
      `Imputadas ${horas} HH de MOD (${formatCLP(totalMod)}) a ${op.folioOP}. Asiento contable de mano de obra registrado en Libro Diario.`
    );
  };

  // Handler: Prorratear y Aplicar CIF
  const handleApplyCifToOp = (op: ProductionOrder) => {
    // Calculamos una tasa y monto de CIF proporcional
    const horasModOp = op.manoDeObraRegistros.reduce((s, m) => s + m.horasTrabajadas, 0);
    const cuotaCifSugerida = horasModOp > 0 ? horasModOp * 9000 : Math.round((Number(op.costoPrimo) || 0) * 0.15);
    // Sin horas MOD ni costo primo no hay base de prorrateo (antes se suponía un costo primo de $1.000.000)
    if (cuotaCifSugerida <= 0) {
      alert('La orden no tiene horas de mano de obra ni costo primo registrados para prorratear CIF.');
      return;
    }

    const cifEntry = createProductionCifAllocationEntry(op, cuotaCifSugerida);
    onAddAccountingEntry(cifEntry);

    const updatedCif = (op.costoIndirectoCif || 0) + cuotaCifSugerida;
    const updatedTotal = (op.costoPrimo || 0) + updatedCif;
    const cantReal = op.cantidadProducidaReal > 0 ? op.cantidadProducidaReal : op.cantidadObjetivo;
    const costUnit = Math.round(updatedTotal / cantReal);

    onUpdateProductionOrder({
      ...op,
      costoIndirectoCif: updatedCif,
      costoTotalProduccion: updatedTotal,
      costoUnitarioReal: costUnit,
      asientosGenerados: {
        ...op.asientosGenerados,
        aplicacionCifAsientoId: cifEntry.id,
      },
    });

    triggerSuccess(
      `CIF por ${formatCLP(cuotaCifSugerida)} prorrateado y aplicado a ${op.folioOP}. Asiento de absorción de CIF contabilizado.`
    );
  };

  // Sincronizar producto terminado con el catálogo de inventario y stock físico
  const syncFinishedProductToInventory = (op: ProductionOrder, cantProducida: number, costUnit: number) => {
    if (!onUpdateInventoryItems || !Array.isArray(inventoryItems)) return;

    const existingIndex = inventoryItems.findIndex(
      i => i.nombre.toLowerCase().trim() === op.productoNombre.toLowerCase().trim() ||
           (op.productoCodigo && i.sku.toLowerCase() === op.productoCodigo.toLowerCase())
    );

    if (existingIndex >= 0) {
      const updated = inventoryItems.map((item, idx) => {
        if (idx !== existingIndex) return item;
        const newGeneral = item.stockGeneral + cantProducida;
        const updatedWh = item.stockPorBodega.map(wh => {
          if (wh.bodegaNombre === op.bodegaDestinoNombre || (!op.bodegaDestinoNombre && idx === 0)) {
            return { ...wh, stockFisico: wh.stockFisico + cantProducida, stockDisponible: wh.stockDisponible + cantProducida };
          }
          return wh;
        });
        return {
          ...item,
          stockGeneral: newGeneral,
          stockDisponible: newGeneral - item.stockComprometido,
          costoUnitarioPMP: costUnit > 0 ? costUnit : item.costoUnitarioPMP,
          stockPorBodega: updatedWh,
        };
      });
      onUpdateInventoryItems(updated);
    } else {
      const targetWh = warehouses.find(w => w.nombre === op.bodegaDestinoNombre) || warehouses[0];
      const newItem: InventoryItem = {
        id: `item-pt-${Date.now()}`,
        empresaId: currentClient.id,
        sku: op.productoCodigo || `PT-${op.folioOP.replace(/[^0-9]/g, '')}`,
        nombre: op.productoNombre,
        categoria: 'MERCADERIA_VENTA',
        unidadMedida: (op.unidadMedida && ['UNIDADES', 'CAJAS', 'KILOS', 'LITROS', 'METROS', 'PALLETS'].includes(op.unidadMedida) ? op.unidadMedida : 'UNIDADES') as any,
        costoUnitarioPMP: costUnit,
        ultimoPrecioCompra: costUnit,
        precioVentaSugerido: Math.round(costUnit * 1.35),
        stockGeneral: cantProducida,
        stockEnTransito: 0,
        stockComprometido: 0,
        stockDisponible: cantProducida,
        stockMinimo: 10,
        stockCritico: 5,
        loteOptimoReposicion: 50,
        consumoMensualPromedio: 15,
        diasCoberturaEstimados: 30,
        estadoStock: 'OPTIMO',
        stockPorBodega: warehouses.map(w => ({
          bodegaId: w.id,
          bodegaNombre: w.nombre,
          stockFisico: (targetWh && w.id === targetWh.id) ? cantProducida : 0,
          stockComprometido: 0,
          stockDisponible: (targetWh && w.id === targetWh.id) ? cantProducida : 0,
        })),
      };
      onUpdateInventoryItems([newItem, ...inventoryItems]);
    }
  };

  // Rebajar producto terminado al imputar costo de ventas
  const deductSoldProductFromInventory = (op: ProductionOrder, cantVendida: number) => {
    if (!onUpdateInventoryItems || !Array.isArray(inventoryItems)) return;
    const updated = inventoryItems.map(item => {
      if (item.nombre.toLowerCase().trim() === op.productoNombre.toLowerCase().trim() ||
          (op.productoCodigo && item.sku.toLowerCase() === op.productoCodigo.toLowerCase())) {
        const newGeneral = Math.max(0, item.stockGeneral - cantVendida);
        const updatedWh = item.stockPorBodega.map(wh => ({
          ...wh,
          stockFisico: Math.max(0, wh.stockFisico - cantVendida),
          stockDisponible: Math.max(0, wh.stockDisponible - cantVendida),
        }));
        return {
          ...item,
          stockGeneral: newGeneral,
          stockDisponible: Math.max(0, newGeneral - item.stockComprometido),
          stockPorBodega: updatedWh,
        };
      }
      return item;
    });
    onUpdateInventoryItems(updated);
  };

  // Handler: Liquidar OP a Productos Terminados (Cierre con Motor Agéntico)
  const handleLiquidateOpToPt = async (op: ProductionOrder) => {
    const cantProducida = op.cantidadProducidaReal > 0 ? op.cantidadProducidaReal : op.cantidadObjetivo;
    const costUnit = Math.round((op.costoTotalProduccion || 0) / cantProducida);

    setIsExecutingAgent(true);
    let agentResultData: any = null;

    try {
      const authToken = getStoredAuthToken();
      const res = await fetch('/api/agents/autonomous/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          module: 'COSTOS_PRODUCCION',
          modulo: 'COSTOS_PRODUCCION',
          empresaId: currentClient.id,
          query: `Liquidar y cerrar orden de producción ${op.folioOP} (${op.productoNombre}) a Productos Terminados según NIC 2. Cantidad producida: ${cantProducida} unidades a costo unitario real ${costUnit} CLP.`,
          context: {
            empresa: currentClient,
            productionOrders: safeOrders,
            opId: op.id,
            cantidadProducida: cantProducida,
          },
        }),
      });
      if (res.ok) {
        agentResultData = await res.json();
      }
    } catch (err) {
      console.warn('[ProductionCostingAgent] Error consultando motor agéntico:', err);
    } finally {
      setIsExecutingAgent(false);
    }

    const updatedOp: ProductionOrder = {
      ...op,
      estado: 'TERMINADA',
      cantidadProducidaReal: cantProducida,
      costoUnitarioReal: costUnit,
      fechaRealTermino: new Date().toISOString().split('T')[0],
    };

    const liqEntry = createProductionFinishedLiquidationEntry(updatedOp);
    updatedOp.asientosGenerados = {
      ...updatedOp.asientosGenerados,
      liquidacionPtAsientoId: liqEntry.id,
    };

    onAddAccountingEntry(liqEntry);
    onUpdateProductionOrder(updatedOp);
    syncFinishedProductToInventory(updatedOp, cantProducida, costUnit);

    if (agentResultData?.approvalRequired) {
      triggerSuccess(
        `Orden ${op.folioOP} liquidada y enviada a gobernanza humana #${agentResultData.approvalDetails?.id?.slice(-6) || 'PEND'}.`
      );
    } else {
      triggerSuccess(
        `Orden ${op.folioOP} liquidada a Productos Terminados (Costo total: ${formatCLP(
          op.costoTotalProduccion
        )}). Asiento WIP -> PT contabilizado por Agente de Costos.`
      );
    }

    if (agentResultData?.steps || agentResultData?.decision) {
      setAgentDiagnosticModal({
        title: `Dictamen Agéntico: Liquidación OP ${op.folioOP}`,
        decision: agentResultData.decision || agentResultData.finalText || 'Liquidación ejecutada.',
        steps: agentResultData.steps || [],
        approvalRequired: agentResultData.approvalRequired,
        approvalDetails: agentResultData.approvalDetails,
      });
    }
  };

  // Handler: Confirmar Cierre y Liquidación desde Modal de Análisis de Desvíos
  const handleConfirmClosureAndLiquidation = async (orderId: string, analysis: ProductionOrderClosureAnalysis) => {
    const op = safeOrders.find(o => o.id === orderId);
    if (!op) return;

    const cantProducida = op.cantidadProducidaReal > 0 ? op.cantidadProducidaReal : op.cantidadObjetivo;
    const costUnit = Math.round((op.costoTotalProduccion || 0) / cantProducida);

    setIsExecutingAgent(true);
    let agentResultData: any = null;

    try {
      const authToken = getStoredAuthToken();
      const res = await fetch('/api/agents/autonomous/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          module: 'COSTOS_PRODUCCION',
          modulo: 'COSTOS_PRODUCCION',
          empresaId: currentClient.id,
          query: `Cierre de orden ${op.folioOP} con análisis de desvíos: Eficiencia ${analysis.diagnosticoEficiencia}. Proponer asiento de cierre y desvío según NIC 2.`,
          context: {
            empresa: currentClient,
            opId: op.id,
            analysis,
            productionOrders: safeOrders,
          },
        }),
      });
      if (res.ok) {
        agentResultData = await res.json();
      }
    } catch (err) {
      console.warn('[ProductionCostingAgent] Error consultando motor agéntico en cierre:', err);
    } finally {
      setIsExecutingAgent(false);
    }

    const updatedOp: ProductionOrder = {
      ...op,
      estado: 'TERMINADA',
      cantidadProducidaReal: cantProducida,
      costoUnitarioReal: costUnit,
      fechaRealTermino: new Date().toISOString().split('T')[0],
      analisisCierre: analysis,
    };

    const liqEntry = createProductionFinishedLiquidationEntry(updatedOp);
    updatedOp.asientosGenerados = {
      ...updatedOp.asientosGenerados,
      liquidacionPtAsientoId: liqEntry.id,
    };

    onAddAccountingEntry(liqEntry);
    onUpdateProductionOrder(updatedOp);
    syncFinishedProductToInventory(updatedOp, cantProducida, costUnit);
    setClosureModalOp(null);

    if (agentResultData?.approvalRequired) {
      triggerSuccess(
        `Cierre de ${op.folioOP} registrado. Solicitud de gobernanza humana #${agentResultData.approvalDetails?.id?.slice(-6) || 'PEND'} creada.`
      );
    } else {
      triggerSuccess(
        `Orden ${op.folioOP} liquidada a Productos Terminados con éxito. Diagnóstico de Eficiencia: ${analysis.diagnosticoEficiencia}. Asiento WIP -> PT contabilizado.`
      );
    }

    if (agentResultData?.steps || agentResultData?.decision) {
      setAgentDiagnosticModal({
        title: `Auditoría de Cierre: OP ${op.folioOP}`,
        decision: agentResultData.decision || agentResultData.finalText || 'Cierre registrado.',
        steps: agentResultData.steps || [],
        approvalRequired: agentResultData.approvalRequired,
        approvalDetails: agentResultData.approvalDetails,
      });
    }
  };

  // Handler: Auditoría Agéntica NIC 2 de Órdenes de Producción y Desvíos
  const handleRunCostAudit = async () => {
    setIsExecutingAgent(true);
    try {
      const authToken = getStoredAuthToken();
      const res = await fetch('/api/agents/autonomous/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          module: 'COSTOS_PRODUCCION',
          modulo: 'COSTOS_PRODUCCION',
          empresaId: currentClient.id,
          query: `Auditar costos de producción NIC 2, análisis de desvíos estándar vs real y absorción de CIF para ${safeOrders.length} órdenes de producción.`,
          context: {
            empresa: currentClient,
            productionOrders: safeOrders,
            budgets: productionBudgets,
          },
        }),
      });
      const data = await res.json();
      if (data.success || data.steps) {
        setAgentDiagnosticModal({
          title: 'Auditoría Agéntica NIC 2 — Costos Industriales',
          decision: data.decision || data.finalText || 'Auditoría de costos completada.',
          steps: data.steps || [],
          approvalRequired: data.approvalRequired,
          approvalDetails: data.approvalDetails,
        });
      }
    } catch (err: any) {
      alert('Error en auditoría agéntica de costos: ' + err.message);
    } finally {
      setIsExecutingAgent(false);
    }
  };

  // Handler: Registrar Venta / Costo de Ventas
  const handleConfirmCogs = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showCogsModalForOp) return;
    const op = showCogsModalForOp;

    const cantVendida = Number(cogsForm.cantidadVendida) || 1;
    const cogsEntry = createProductionCogsEntry(op, cantVendida, cogsForm.dteFolioFactura);
    onAddAccountingEntry(cogsEntry);
    deductSoldProductFromInventory(op, cantVendida);

    setShowCogsModalForOp(null);
    triggerSuccess(
      `Costo de Ventas (CMV) por entrega de ${cantVendida} ${op.unidadMedida} de ${op.productoNombre} asentado en Libro Diario (${formatCLP(
        cogsEntry.totalDebe
      )}) y stock rebajado.`
    );
  };

  return (
    <div id="production-costing-agent-module" className="space-y-6">
      {/* Header del Agente */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-white relative overflow-hidden shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-cyan-500/20 border border-cyan-500/30 rounded-xl text-cyan-400">
              <Factory className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight">
                  Agente de Producción & Costeo de Productos
                </h2>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  NIC 2 Inventarios / Costeo por Absorción
                </span>
              </div>
              <p className="text-slate-400 text-sm mt-1 max-w-3xl">
                Control y costeo completo de órdenes de trabajo (OP), consumos de Materia Prima Directa (MPD),
                mano de obra directa (MOD) con tarifas empresa, prorrateo de Costos Indirectos de Fabricación (CIF)
                y liquidación automatizada al Libro Diario contable.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRunCostAudit}
              disabled={isExecutingAgent}
              id="btn-audit-production-cost-agent"
              className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white text-sm font-semibold rounded-lg shadow-sm transition-all cursor-pointer border border-cyan-400/30 disabled:opacity-50"
              title="Auditoría Agéntica NIC 2 de costos y desvíos presupuestarios"
            >
              <Bot className={`w-4 h-4 text-amber-300 ${isExecutingAgent ? 'animate-spin' : ''}`} />
              <span>{isExecutingAgent ? 'Auditando...' : 'Auditoría Agéntica NIC 2'}</span>
            </button>

            <button
              onClick={() => setShowCreateOpModal(true)}
              id="btn-create-production-order"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              Nueva Orden de Producción
            </button>
          </div>
        </div>

        {/* Notificación Flotante */}
        {actionSuccessMessage && (
          <div className="mt-4 p-3 bg-emerald-950/80 border border-emerald-700/60 rounded-lg flex items-center gap-2 text-emerald-300 text-sm animate-fade-in">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span>{actionSuccessMessage}</span>
          </div>
        )}
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Costo Fabril Acumulado</span>
            <DollarSign className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-2xl font-bold text-slate-100">
            {formatCLP(metrics.totalProduccion)}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            En <span className="text-cyan-400 font-semibold">{metrics.totalOps} órdenes</span> ({metrics.opsEnProceso} en proceso)
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Materia Prima Directa (MPD)</span>
            <Boxes className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-300">
            {formatCLP(metrics.totalMpd)}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Valorado a PMP según Art. 30 LIR
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Mano de Obra Directa (MOD)</span>
            <Users className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-300">
            {formatCLP(metrics.totalMod)}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Costo primo acumulado: <strong className="text-slate-200">{formatCLP(metrics.totalPrimo)}</strong>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Costos Indirectos (CIF)</span>
            <Zap className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-purple-300">
            {formatCLP(metrics.totalCif)}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Pool indirecto fabril: <span className="text-slate-300">{formatCLP(metrics.totalCifPoolPeriodo)}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-800 flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('PRESUPUESTOS')}
          className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === 'PRESUPUESTOS'
              ? 'bg-blue-600 text-white font-bold shadow'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <FileText className="w-4 h-4 text-blue-300" />
          <span>Presupuestos & Cotizaciones</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-white/20 text-white font-mono">
            {safeBudgets.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('ORDENES')}
          className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
            activeTab === 'ORDENES'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          Órdenes de Fabricación ({safeOrders.length})
        </button>

        <button
          onClick={() => setActiveTab('MPD')}
          className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
            activeTab === 'MPD'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          Consumo de Materiales (MPD)
        </button>

        <button
          onClick={() => setActiveTab('MOD')}
          className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
            activeTab === 'MOD'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          Mano de Obra Fabril (MOD)
        </button>

        <button
          onClick={() => setActiveTab('CIF')}
          className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
            activeTab === 'CIF'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          Bolsa de Costos Indirectos (CIF)
        </button>

        <button
          onClick={() => setActiveTab('ESTADO_COSTO')}
          className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
            activeTab === 'ESTADO_COSTO'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          Estado de Costos NIC 2
        </button>

        <button
          onClick={() => setActiveTab('CONTABILIDAD')}
          className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
            activeTab === 'CONTABILIDAD'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          Asientos Contables ({productionEntries.length})
        </button>
      </div>

      {/* TAB 0: PRESUPUESTOS Y COTIZACIONES A CLIENTES */}
      {activeTab === 'PRESUPUESTOS' && (
        <BudgetManagementSection
          budgets={safeBudgets}
          currentClient={currentClient}
          inventoryItems={inventoryItems}
          onAddBudget={(b) => onAddProductionBudget && onAddProductionBudget(b)}
          onUpdateBudget={(b) => onUpdateProductionBudget && onUpdateProductionBudget(b)}
          onApproveAndGenerateOp={(b) => onApproveBudgetAndGenerateOp && onApproveBudgetAndGenerateOp(b)}
        />
      )}

      {/* TAB 1: ÓRDENES DE FABRICACIÓN */}
      {activeTab === 'ORDENES' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            {safeOrders.map((op) => {
              const cantObjetivo = op.cantidadObjetivo || 1;
              const cantReal = op.cantidadProducidaReal || 0;
              const avancePct = Math.min(100, Math.round((cantReal / cantObjetivo) * 100));

              return (
                <div
                  key={op.id}
                  className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4 hover:border-slate-700 transition-colors"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-bold text-cyan-400 bg-cyan-500/10 px-2.5 py-1 rounded border border-cyan-500/20">
                        {op.folioOP}
                      </span>
                      <div>
                        <h4 className="font-bold text-slate-100 text-base">{op.productoNombre}</h4>
                        <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                          <span>Código: <strong className="text-slate-300">{op.productoCodigo}</strong></span>
                          <span>•</span>
                          <span>Categoría: <strong className="text-slate-300">{op.categoria.replace(/_/g, ' ')}</strong></span>
                          <span>•</span>
                          <span>Destino: <strong className="text-slate-300">{op.bodegaDestinoNombre}</strong></span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          op.estado === 'TERMINADA'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : op.estado === 'EN_PROCESO'
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                            : 'bg-slate-700/40 text-slate-400 border border-slate-600'
                        }`}
                      >
                        {op.estado.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>

                  {/* Avance Físico */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>Progreso de Fabricación:</span>
                      <span className="font-semibold text-slate-200">
                        {cantReal} de {cantObjetivo} {op.unidadMedida} ({avancePct}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                      <div
                        className="bg-cyan-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${avancePct}%` }}
                      />
                    </div>
                  </div>

                  {/* Badge de Cliente y Presupuesto Vinculado */}
                  {(op.clienteNombre || op.presupuestoFolio) && (
                    <div className="bg-slate-950/90 p-2.5 rounded-lg border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-3.5 h-3.5 text-blue-400" />
                        <span className="text-slate-400">Cliente Mandante:</span>
                        <strong className="text-slate-100">{op.clienteNombre || 'Sin cliente asignado'}</strong>
                        {op.presupuestoFolio && (
                          <span className="font-mono text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800/60 font-semibold text-[11px]">
                            Presupuesto Ref: {op.presupuestoFolio}
                          </span>
                        )}
                      </div>
                      {op.margenPresupuestadoPct !== undefined && (
                        <div className="flex items-center gap-2 font-mono text-[11px]">
                          <span className="text-slate-400">Margen Previsto:</span>
                          <strong className="text-emerald-400 font-bold">{op.margenPresupuestadoPct}%</strong>
                          {op.precioVentaPactado && (
                            <span className="text-slate-500">(${formatCLP(op.precioVentaPactado)} neto)</span>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Desglose de Costos de la OP */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/70 p-3.5 rounded-lg border border-slate-800/80 text-xs">
                    <div>
                      <span className="text-slate-400 block">Materia Prima (MPD):</span>
                      <strong className="text-amber-300 font-mono text-sm">
                        {formatCLP(op.costoDirectoMateriales || 0)}
                      </strong>
                    </div>

                    <div>
                      <span className="text-slate-400 block">Mano de Obra (MOD):</span>
                      <strong className="text-emerald-300 font-mono text-sm">
                        {formatCLP(op.costoDirectoManoObra || 0)}
                      </strong>
                    </div>

                    <div>
                      <span className="text-slate-400 block">Indirectos (CIF):</span>
                      <strong className="text-purple-300 font-mono text-sm">
                        {formatCLP(op.costoIndirectoCif || 0)}
                      </strong>
                    </div>

                    <div>
                      <span className="text-slate-400 block">Costo Total OP:</span>
                      <strong className="text-cyan-400 font-mono text-sm font-bold">
                        {formatCLP(op.costoTotalProduccion || 0)}
                      </strong>
                      <span className="text-[10px] text-slate-400 block">
                        Unitario: {formatCLP(op.costoUnitarioReal || 0)}/{op.unidadMedida}
                      </span>
                    </div>
                  </div>

                  {/* Botonera Operativa de la OP */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800 text-xs">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedOpDetail(op)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg flex items-center gap-1.5 transition-colors"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        Ficha de Costeo & BOM
                      </button>

                      {op.estado === 'EN_PROCESO' && (
                        <>
                          <button
                            onClick={() => setShowMpdModalForOp(op)}
                            className="px-3 py-1.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-600/40 rounded-lg flex items-center gap-1.5 transition-colors font-medium"
                          >
                            <Boxes className="w-3.5 h-3.5" />
                            + Consumo MPD
                          </button>

                          <button
                            onClick={() => setShowModModalForOp(op)}
                            className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-600/40 rounded-lg flex items-center gap-1.5 transition-colors font-medium"
                          >
                            <Users className="w-3.5 h-3.5" />
                            + Imputar MOD
                          </button>

                          <button
                            onClick={() => handleApplyCifToOp(op)}
                            className="px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-600/40 rounded-lg flex items-center gap-1.5 transition-colors font-medium"
                          >
                            <Zap className="w-3.5 h-3.5" />
                            Prorratear CIF
                          </button>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {op.estado === 'EN_PROCESO' && (
                        <button
                          onClick={() => setClosureModalOp(op)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
                          title="Realizar análisis de desviaciones de costo y liquidar a PT"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Liquidar OP (Cierre & Desvíos)
                        </button>
                      )}

                      {op.estado === 'TERMINADA' && (
                        <>
                          <button
                            onClick={() => setClosureModalOp(op)}
                            className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-600/40 rounded-lg flex items-center gap-1.5 transition-colors font-medium cursor-pointer"
                            title="Ver análisis de cierre presupuestario vs real y desvíos"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            Auditoría de Cierre
                          </button>
                          <button
                            onClick={() => setShowCogsModalForOp(op)}
                            className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-lg flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
                          >
                            <DollarSign className="w-3.5 h-3.5" />
                            Venta / CMV
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: CONSUMO DE MATERIALES DIRECTOS (MPD) */}
      {activeTab === 'MPD' && (
        <div className="space-y-4">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-100 flex items-center gap-2 text-base">
                <Boxes className="w-5 h-5 text-amber-400" />
                Registro de Consumos de Materias Primas Directas
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Salidas de bodega valoradas a PMP (Precio Medio Ponderado Art. 30 LIR) asociadas a Guías
                de Despacho Internas (DTE 52) y traspaso a Productos en Proceso (WIP).
              </p>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Fecha</th>
                    <th className="py-3 px-4">OP Asignada</th>
                    <th className="py-3 px-4">Insumo / Materia Prima</th>
                    <th className="py-3 px-4">Bodega Origen</th>
                    <th className="py-3 px-4 text-center">Guía DTE 52</th>
                    <th className="py-3 px-4 text-right">Cantidad</th>
                    <th className="py-3 px-4 text-right">PMP Unitario</th>
                    <th className="py-3 px-4 text-right">Costo Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {safeOrders.flatMap((op) => op.consumosMateriales || []).length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500">
                        No hay consumos de materia prima registrados aún.
                      </td>
                    </tr>
                  ) : (
                    safeOrders
                      .flatMap((op) =>
                        (op.consumosMateriales || []).map((c) => ({
                          ...c,
                          opFolio: op.folioOP,
                          opProducto: op.productoNombre,
                        }))
                      )
                      .map((c) => (
                        <tr key={c.id} className="hover:bg-slate-800/20">
                          <td className="py-3 px-4 text-slate-400 font-mono text-xs">{c.fecha}</td>
                          <td className="py-3 px-4 font-mono font-semibold text-cyan-400 text-xs">
                            {c.opFolio}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-medium text-slate-200">{c.insumoNombre}</div>
                            <span className="font-mono text-xs text-slate-400">{c.insumoCodigo}</span>
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-300">{c.bodegaOrigenNombre}</td>
                          <td className="py-3 px-4 text-center font-mono text-xs">
                            {c.folioGuiaDespacho52 ? (
                              <span className="bg-slate-800 px-2 py-0.5 rounded text-amber-300">
                                Folio {c.folioGuiaDespacho52}
                              </span>
                            ) : (
                              <span className="text-slate-600">Interno</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-mono">
                            {c.cantidadConsumida} {c.unidadMedida}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-slate-300">
                            {formatCLP(c.costoUnitarioPMP)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-amber-300">
                            {formatCLP(c.costoTotalConsumo)}
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: MANO DE OBRA DIRECTA (MOD) */}
      {activeTab === 'MOD' && (
        <div className="space-y-4">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-100 flex items-center gap-2 text-base">
                <Users className="w-5 h-5 text-emerald-400" />
                Control y Liquidación de Mano de Obra Directa (MOD)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Seguimiento de tiempos productivos, partes de trabajo diarios y tarifa hora costo empresa
                (incorporando base imponible y cargas patronales proporcionales).
              </p>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Fecha</th>
                    <th className="py-3 px-4">OP Asignada</th>
                    <th className="py-3 px-4">Trabajador / Cargo</th>
                    <th className="py-3 px-4">Etapa del Proceso</th>
                    <th className="py-3 px-4 text-right">Horas (HH)</th>
                    <th className="py-3 px-4 text-right">Tarifa Costo/Hora</th>
                    <th className="py-3 px-4 text-right">Costo Total MOD</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {safeOrders.flatMap((op) => op.manoDeObraRegistros || []).length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        No hay registros de mano de obra directa aún.
                      </td>
                    </tr>
                  ) : (
                    safeOrders
                      .flatMap((op) =>
                        (op.manoDeObraRegistros || []).map((m) => ({
                          ...m,
                          opFolio: op.folioOP,
                        }))
                      )
                      .map((m) => (
                        <tr key={m.id} className="hover:bg-slate-800/20">
                          <td className="py-3 px-4 text-slate-400 font-mono text-xs">{m.fecha}</td>
                          <td className="py-3 px-4 font-mono font-semibold text-cyan-400 text-xs">
                            {m.opFolio}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-medium text-slate-200">{m.trabajadorNombre}</div>
                            <span className="text-xs text-slate-400">
                              {m.trabajadorRut} • {m.cargo}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-300">{m.etapaProceso}</td>
                          <td className="py-3 px-4 text-right font-mono font-semibold text-slate-200">
                            {m.horasTrabajadas} HH
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-slate-300">
                            {formatCLP(m.tarifaHoraCostoEmpresa)}/HH
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-emerald-300">
                            {formatCLP(m.costoTotalMOD)}
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: BOLSA DE COSTOS INDIRECTOS DE FABRICACIÓN (CIF) */}
      {activeTab === 'CIF' && (
        <div className="space-y-6">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-3">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Zap className="w-5 h-5 text-purple-400" />
              Pool de Costos Indirectos de Fabricación (CIF) del Período
            </h3>
            <p className="text-xs text-slate-400 max-w-3xl">
              Agrupa los costos fabriles que no pueden identificarse directamente con una unidad de producto:
              energía eléctrica y fuerza motriz de taller, depreciación de maquinaria de planta (NIC 16), arriendo
              de galpón de redes (IFRS 16), mantenimiento preventivo y supervisión técnica.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-800">
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 text-xs block">Total Bolsa CIF Período:</span>
                <strong className="text-purple-300 font-mono text-lg font-bold">
                  {formatCLP(metrics.totalCifPoolPeriodo)}
                </strong>
              </div>

              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 text-xs block">CIF Aplicado a Órdenes (WIP):</span>
                <strong className="text-cyan-300 font-mono text-lg font-bold">
                  {formatCLP(metrics.totalCif)}
                </strong>
              </div>

              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 text-xs block">Sobre/Sub Absorción de CIF:</span>
                <strong
                  className={`font-mono text-lg font-bold ${
                    metrics.totalCif - metrics.totalCifPoolPeriodo >= 0
                      ? 'text-emerald-400'
                      : 'text-amber-400'
                  }`}
                >
                  {formatCLP(metrics.totalCif - metrics.totalCifPoolPeriodo)}
                </strong>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="p-3.5 border-b border-slate-800 bg-slate-950/50 flex items-center justify-between">
              <span className="font-semibold text-xs text-slate-300 uppercase tracking-wider">
                Conceptos de Costos Indirectos Devengados
              </span>
            </div>

            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-4">Periodo</th>
                  <th className="py-2.5 px-4">Concepto Fabril</th>
                  <th className="py-2.5 px-4">Categoría CIF</th>
                  <th className="py-2.5 px-4">Cuenta Contable</th>
                  <th className="py-2.5 px-4 text-right">Monto Período</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 font-mono">
                {safeCif.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-800/20">
                    <td className="py-2.5 px-4 text-slate-400">{c.periodo}</td>
                    <td className="py-2.5 px-4 font-sans text-slate-200 font-medium">{c.concepto}</td>
                    <td className="py-2.5 px-4 font-sans">
                      <span className="bg-slate-800 px-2 py-0.5 rounded text-[11px] text-slate-300">
                        {c.categoriaCif.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-purple-400">{c.cuentaContableGasto}</td>
                    <td className="py-2.5 px-4 text-right font-bold text-slate-100">
                      {formatCLP(c.montoTotalPeriodo)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: ESTADO DE COSTOS DE FABRICACIÓN (NIC 2) */}
      {activeTab === 'ESTADO_COSTO' && (
        <div className="space-y-4">
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6 max-w-3xl mx-auto shadow-lg">
            <div className="border-b border-slate-800 pb-3 text-center">
              <h3 className="text-lg font-bold text-slate-100">
                Estado de Costo de Fabricación & Ventas (NIC 2 / IFRS)
              </h3>
              <p className="text-xs text-slate-400">
                {currentClient.razonSocial} • RUT {currentClient.rut}
              </p>
            </div>

            <div className="mt-6 space-y-2.5 text-sm">
              <div className="flex justify-between py-1.5 border-b border-slate-800/60 text-slate-300">
                <span>(+) Consumo de Materia Prima Directa (MPD):</span>
                <span className="font-mono font-bold text-amber-300">{formatCLP(metrics.totalMpd)}</span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-slate-800/60 text-slate-300">
                <span>(+) Mano de Obra Directa Fabril (MOD):</span>
                <span className="font-mono font-bold text-emerald-300">{formatCLP(metrics.totalMod)}</span>
              </div>

              <div className="flex justify-between py-2 bg-slate-950/60 px-3 rounded text-slate-100 font-semibold">
                <span>(=) Costo Primo de Producción:</span>
                <span className="font-mono text-cyan-400">{formatCLP(metrics.totalPrimo)}</span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-slate-800/60 text-slate-300">
                <span>(+) Costos Indirectos de Fabricación (CIF Aplicados):</span>
                <span className="font-mono font-bold text-purple-300">{formatCLP(metrics.totalCif)}</span>
              </div>

              <div className="flex justify-between py-2.5 bg-cyan-950/40 border border-cyan-800/60 px-3.5 rounded-lg text-slate-100 font-bold text-base">
                <span>(=) Costo de Fabricación Incurrido en el Período:</span>
                <span className="font-mono text-cyan-300">{formatCLP(metrics.totalProduccion)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: ASIENTOS CONTABLES EN LIBRO DIARIO */}
      {activeTab === 'CONTABILIDAD' && (
        <div className="space-y-4">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-100 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-cyan-400" />
                Asientos de Costeo en Libro Diario Central
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Integración en tiempo real: Consumos MPD (1.1.08.02 vs 1.1.08.01), Imputación MOD (1.1.08.02 vs 5.1.03),
                Absorción CIF (1.1.08.02 vs 5.1.05) y Cierre PT (1.1.08.03 vs 1.1.08.02).
              </p>
            </div>
            <span className="px-2.5 py-1 bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded-lg text-xs font-semibold">
              {productionEntries.length} Asientos Registrados
            </span>
          </div>

          <div className="space-y-3">
            {productionEntries.length === 0 ? (
              <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-8 text-center text-slate-500 text-sm">
                No hay asientos de producción aún. Registre un consumo o liquide una orden.
              </div>
            ) : (
              productionEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                        {entry.id}
                      </span>
                      <span className="text-xs text-slate-400">{entry.fecha}</span>
                      <span className="text-sm font-semibold text-slate-200">{entry.concepto}</span>
                    </div>
                    <span className="text-xs font-mono font-bold text-emerald-400 self-start sm:self-auto">
                      Total: {formatCLP(entry.totalDebe)}
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left text-slate-300">
                      <thead className="text-slate-500 uppercase border-b border-slate-800/60">
                        <tr>
                          <th className="py-1.5 px-3">Cuenta</th>
                          <th className="py-1.5 px-3">Glosa Cuenta</th>
                          <th className="py-1.5 px-3 text-right">Debe</th>
                          <th className="py-1.5 px-3 text-right">Haber</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/40 font-mono">
                        {entry.lineas.map((line, idx) => (
                          <tr key={idx}>
                            <td className="py-1.5 px-3 text-cyan-400 font-semibold">{line.cuentaCodigo}</td>
                            <td className="py-1.5 px-3 font-sans text-slate-300">{line.cuentaNombre}</td>
                            <td className="py-1.5 px-3 text-right text-emerald-300">
                              {line.debe > 0 ? formatCLP(line.debe) : '-'}
                            </td>
                            <td className="py-1.5 px-3 text-right text-rose-300">
                              {line.haber > 0 ? formatCLP(line.haber) : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* MODAL: NUEVA ORDEN DE PRODUCCIÓN */}
      {showCreateOpModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-xl w-full p-6 space-y-4 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-cyan-400" />
                Apertura de Orden de Producción (OP)
              </h3>
              <button
                onClick={() => setShowCreateOpModal(false)}
                className="text-slate-400 hover:text-slate-200 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateProductionOrder} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold uppercase mb-1">Folio OP</label>
                  <input
                    type="text"
                    required
                    value={newOpForm.folioOP || ''}
                    onChange={(e) => setNewOpForm({ ...newOpForm, folioOP: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold uppercase mb-1">Categoría</label>
                  <select
                    value={newOpForm.categoria}
                    onChange={(e) =>
                      setNewOpForm({ ...newOpForm, categoria: e.target.value as ProductionProductCategory })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="REDES_Y_FONDEOS">Redes y Fondeos Acuícolas</option>
                    <option value="SALMONIDOS_PROCESADOS">Salmónidos Procesados / Planta</option>
                    <option value="ALIMENTO_Y_SUPLEMENTOS">Alimento y Suplementos</option>
                    <option value="PRODUCTOS_MANUFACTURADOS">Manufacturas Industriales</option>
                    <option value="SERVICIOS_INDUSTRIALES">Servicios Industriales y Mantenimiento</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-slate-300 font-semibold uppercase mb-1">
                    Producto a Fabricar
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ej: Red Pecera HDPE 30x30m Malla 1.5 pulgadas"
                    value={newOpForm.productoNombre || ''}
                    onChange={(e) => setNewOpForm({ ...newOpForm, productoNombre: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold uppercase mb-1">Cantidad Objetivo</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={newOpForm.cantidadObjetivo || 1}
                    onChange={(e) => setNewOpForm({ ...newOpForm, cantidadObjetivo: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold uppercase mb-1">Unidad de Medida</label>
                  <input
                    type="text"
                    required
                    placeholder="UNID, KG, METROS"
                    value={newOpForm.unidadMedida || 'UNID'}
                    onChange={(e) => setNewOpForm({ ...newOpForm, unidadMedida: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold uppercase mb-1">Base de Prorrateo CIF</label>
                  <select
                    value={newOpForm.baseProrrateoCif}
                    onChange={(e) =>
                      setNewOpForm({ ...newOpForm, baseProrrateoCif: e.target.value as CifAllocationBase })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="HORAS_HOMBRE_MOD">Horas Hombre (MOD)</option>
                    <option value="HORAS_MAQUINA">Horas Máquina</option>
                    <option value="COSTO_PRIMO">Costo Primo (% MPD+MOD)</option>
                    <option value="UNIDADES_PRODUCIDAS">Unidades Producidas</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold uppercase mb-1">Precio Venta Estimado ($)</label>
                  <input
                    type="number"
                    value={newOpForm.precioVentaEstimado || ''}
                    onChange={(e) =>
                      setNewOpForm({ ...newOpForm, precioVentaEstimado: Number(e.target.value) })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateOpModal(false)}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-lg shadow-sm"
                >
                  Abrir Orden de Fabricación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REGISTRAR CONSUMO MPD */}
      {showMpdModalForOp && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="font-mono text-xs text-amber-400 font-bold">
                  {showMpdModalForOp.folioOP}
                </span>
                <h3 className="text-base font-bold text-slate-100">Consumo de Materia Prima (MPD)</h3>
              </div>
              <button
                onClick={() => setShowMpdModalForOp(null)}
                className="text-slate-400 hover:text-slate-200 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddMpdConsumption} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold uppercase mb-1">Nombre Insumo / Material</label>
                <input
                  type="text"
                  required
                  placeholder="ej: Paño Red HDPE 1.5 pulgadas"
                  value={mpdForm.insumoNombre}
                  onChange={(e) => setMpdForm({ ...mpdForm, insumoNombre: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 font-semibold uppercase mb-1">Cantidad</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={mpdForm.cantidadConsumida}
                    onChange={(e) => setMpdForm({ ...mpdForm, cantidadConsumida: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold uppercase mb-1">Unidad</label>
                  <input
                    type="text"
                    required
                    value={mpdForm.unidadMedida}
                    onChange={(e) => setMpdForm({ ...mpdForm, unidadMedida: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold uppercase mb-1">Costo Unitario PMP ($)</label>
                <input
                  type="number"
                  required
                  value={mpdForm.costoUnitarioPMP || ''}
                  onChange={(e) => setMpdForm({ ...mpdForm, costoUnitarioPMP: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono font-bold focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold uppercase mb-1">
                  Guía de Despacho Interna (DTE 52) Folio
                </label>
                <input
                  type="number"
                  placeholder="ej: 10420"
                  value={mpdForm.folioGuiaDespacho52 || ''}
                  onChange={(e) =>
                    setMpdForm({ ...mpdForm, folioGuiaDespacho52: Number(e.target.value) })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="p-2.5 bg-slate-950 rounded border border-slate-800 flex justify-between items-center text-xs">
                <span className="text-slate-400">Total Consumo a Cargar a WIP:</span>
                <strong className="text-amber-300 font-mono text-sm">
                  {formatCLP((mpdForm.cantidadConsumida || 0) * (mpdForm.costoUnitarioPMP || 0))}
                </strong>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowMpdModalForOp(null)}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-lg shadow-sm"
                >
                  Cargar a WIP y Asentar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: IMPUTAR MOD */}
      {showModModalForOp && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="font-mono text-xs text-emerald-400 font-bold">
                  {showModModalForOp.folioOP}
                </span>
                <h3 className="text-base font-bold text-slate-100">Imputar Mano de Obra (MOD)</h3>
              </div>
              <button
                onClick={() => setShowModModalForOp(null)}
                className="text-slate-400 hover:text-slate-200 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddModEntry} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold uppercase mb-1">Nombre Trabajador / RUT</label>
                <input
                  type="text"
                  required
                  value={modForm.trabajadorNombre}
                  onChange={(e) => setModForm({ ...modForm, trabajadorNombre: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold uppercase mb-1">Etapa del Proceso</label>
                <input
                  type="text"
                  required
                  value={modForm.etapaProceso}
                  onChange={(e) => setModForm({ ...modForm, etapaProceso: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 font-semibold uppercase mb-1">Horas Hombre (HH)</label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    value={modForm.horasTrabajadas}
                    onChange={(e) => setModForm({ ...modForm, horasTrabajadas: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold uppercase mb-1">Tarifa Costo/Hora ($)</label>
                  <input
                    type="number"
                    required
                    value={modForm.tarifaHoraCostoEmpresa}
                    onChange={(e) =>
                      setModForm({ ...modForm, tarifaHoraCostoEmpresa: Number(e.target.value) })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="p-2.5 bg-slate-950 rounded border border-slate-800 flex justify-between items-center text-xs">
                <span className="text-slate-400">Total Imputación MOD:</span>
                <strong className="text-emerald-300 font-mono text-sm">
                  {formatCLP((modForm.horasTrabajadas || 0) * (modForm.tarifaHoraCostoEmpresa || 0))}
                </strong>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModModalForOp(null)}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg shadow-sm"
                >
                  Imputar a WIP y Contabilizar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: VENTA / COSTO DE VENTAS (CMV) */}
      {showCogsModalForOp && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="font-mono text-xs text-cyan-400 font-bold">
                  {showCogsModalForOp.folioOP}
                </span>
                <h3 className="text-base font-bold text-slate-100">Reconocer Costo de Ventas (CMV)</h3>
              </div>
              <button
                onClick={() => setShowCogsModalForOp(null)}
                className="text-slate-400 hover:text-slate-200 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmCogs} className="space-y-3 text-xs">
              <p className="text-slate-300">
                Reconocer salida de existencias de Producto Terminado al Costo Unitario Real (
                <strong className="text-cyan-400">
                  {formatCLP(showCogsModalForOp.costoUnitarioReal)}/{showCogsModalForOp.unidadMedida}
                </strong>
                ) imputando a la cuenta <strong>5.1.01 Costo de Ventas</strong>.
              </p>

              <div>
                <label className="block text-slate-300 font-semibold uppercase mb-1">
                  Cantidad Enajenada / Facturada
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  max={showCogsModalForOp.cantidadProducidaReal}
                  value={cogsForm.cantidadVendida}
                  onChange={(e) => setCogsForm({ ...cogsForm, cantidadVendida: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono font-bold focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold uppercase mb-1">
                  Folio Factura Electrónica (DTE 33)
                </label>
                <input
                  type="number"
                  placeholder="ej: 58902"
                  value={cogsForm.dteFolioFactura || ''}
                  onChange={(e) =>
                    setCogsForm({ ...cogsForm, dteFolioFactura: Number(e.target.value) })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="p-2.5 bg-slate-950 rounded border border-slate-800 flex justify-between items-center text-xs">
                <span className="text-slate-400">Total Costo de Ventas (CMV):</span>
                <strong className="text-emerald-300 font-mono text-sm font-bold">
                  {formatCLP((cogsForm.cantidadVendida || 1) * showCogsModalForOp.costoUnitarioReal)}
                </strong>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCogsModalForOp(null)}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-lg shadow-sm"
                >
                  Contabilizar Costo de Ventas
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: FICHA DE COSTEO DETALLADA */}
      {selectedOpDetail && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full p-6 space-y-4 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="font-mono text-xs text-cyan-400 font-bold">
                  {selectedOpDetail.folioOP}
                </span>
                <h3 className="text-base font-bold text-slate-100">{selectedOpDetail.productoNombre}</h3>
              </div>
              <button
                onClick={() => setSelectedOpDetail(null)}
                className="text-slate-400 hover:text-slate-200 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-950 p-3 rounded-lg border border-slate-800">
                <div>
                  <span className="text-slate-400 block">MPD Total:</span>
                  <strong className="text-amber-300 font-mono">
                    {formatCLP(selectedOpDetail.costoDirectoMateriales || 0)}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400 block">MOD Total:</span>
                  <strong className="text-emerald-300 font-mono">
                    {formatCLP(selectedOpDetail.costoDirectoManoObra || 0)}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400 block">CIF Total:</span>
                  <strong className="text-purple-300 font-mono">
                    {formatCLP(selectedOpDetail.costoIndirectoCif || 0)}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400 block">Costo Unitario:</span>
                  <strong className="text-cyan-300 font-mono font-bold">
                    {formatCLP(selectedOpDetail.costoUnitarioReal || 0)}
                  </strong>
                </div>
              </div>

              <div>
                <h5 className="font-semibold text-slate-200 mb-1">
                  Consumos MPD ({selectedOpDetail.consumosMateriales.length}):
                </h5>
                <div className="bg-slate-950 rounded p-2 border border-slate-800 max-h-36 overflow-y-auto space-y-1">
                  {selectedOpDetail.consumosMateriales.map((c) => (
                    <div key={c.id} className="flex justify-between text-slate-400 py-0.5 border-b border-slate-800/40">
                      <span>{c.insumoNombre} ({c.cantidadConsumida} {c.unidadMedida})</span>
                      <span className="font-mono text-amber-300">{formatCLP(c.costoTotalConsumo)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h5 className="font-semibold text-slate-200 mb-1">
                  Registros MOD ({selectedOpDetail.manoDeObraRegistros.length}):
                </h5>
                <div className="bg-slate-950 rounded p-2 border border-slate-800 max-h-36 overflow-y-auto space-y-1">
                  {selectedOpDetail.manoDeObraRegistros.map((m) => (
                    <div key={m.id} className="flex justify-between text-slate-400 py-0.5 border-b border-slate-800/40">
                      <span>{m.trabajadorNombre} - {m.etapaProceso} ({m.horasTrabajadas} HH)</span>
                      <span className="font-mono text-emerald-300">{formatCLP(m.costoTotalMOD)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                onClick={() => setSelectedOpDetail(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Análisis de Cierre de OP y Desviaciones */}
      {closureModalOp && (
        <OpClosureAnalysisModal
          order={closureModalOp}
          onClose={() => setClosureModalOp(null)}
          onConfirmClosure={handleConfirmClosureAndLiquidation}
        />
      )}

      {/* MODAL: DICTAMEN DEL AGENTE AUTÓNOMO NIC 2 */}
      {agentDiagnosticModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-cyan-500/40 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-cyan-600/30 border border-cyan-500/40 text-cyan-300">
                  <Bot className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    {agentDiagnosticModal.title}
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                      ReAct Function Calling
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">Ejecución verificable sobre costeo por órdenes de producción (NIC 2)</p>
                </div>
              </div>
              <button
                onClick={() => setAgentDiagnosticModal(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {agentDiagnosticModal.approvalRequired && (
              <div className="p-3 bg-amber-950/60 border border-amber-600/60 rounded-xl text-amber-200 text-xs flex items-start gap-2.5">
                <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-bold">Gobernanza Humana Requerida:</strong>
                  <span>Esta operación de liquidación/cierre requiere autorización de Administrador / Gerente General (Solicitud #{agentDiagnosticModal.approvalDetails?.id?.slice(-6) || 'PEND'}).</span>
                </div>
              </div>
            )}

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 block">Dictamen y Análisis del Agente:</span>
              <p className="whitespace-pre-wrap leading-relaxed text-slate-200 font-mono text-[11px]">{agentDiagnosticModal.decision}</p>
            </div>

            {agentDiagnosticModal.steps && agentDiagnosticModal.steps.length > 0 && (
              <div className="space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Trazabilidad de Pasos y Herramientas (Thought Trace):</span>
                <div className="space-y-2">
                  {agentDiagnosticModal.steps.map((st: any, idx: number) => (
                    <div key={idx} className="bg-slate-950/80 p-3 rounded-lg border border-slate-800/80 text-xs">
                      <div className="flex items-center justify-between text-cyan-300 font-bold mb-1">
                        <span>Paso {st.step || idx + 1}: {st.toolCall}</span>
                        <span className="text-[10px] text-slate-500">{st.timestamp}</span>
                      </div>
                      <p className="text-slate-400 text-[11px] mb-1">{st.thought}</p>
                      {st.toolOutput && (
                        <pre className="text-[10px] bg-slate-900 p-2 rounded text-slate-300 overflow-x-auto max-h-32">
                          {JSON.stringify(st.toolOutput, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setAgentDiagnosticModal(null)}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold"
              >
                Cerrar Panel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
