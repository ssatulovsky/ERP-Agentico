import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { DteManager } from './components/DteManager';
import { F29SeniorAgent } from './components/F29SeniorAgent';
import { PayrollManager } from './components/PayrollManager';
import { LeaseManager } from './components/LeaseManager';
import { CashFlowProjections } from './components/CashFlowProjections';
import { AccountingLedger } from './components/AccountingLedger';
import { SeniorAccountingOrchestrator } from './components/SeniorAccountingOrchestrator';
import { AiFiscalAuditorModal } from './components/AiFiscalAuditorModal';
import { AgentClientConfig } from './components/AgentClientConfig';
import { BankReconciliation } from './components/BankReconciliation';
import { InventoryAgentModule } from './components/InventoryAgentModule';
import { HrAgentModule } from './components/HrAgentModule';
import { FixedAssetAgentModule } from './components/FixedAssetAgentModule';
import { ProductionCostingAgentModule } from './components/ProductionCostingAgentModule';
import { BillingAutonomousAgent } from './components/BillingAutonomousAgent';
import { UserManualModal } from './components/UserManualModal';
import { ErpPremiaLogo } from './components/ErpPremiaLogo';
import { loadClientState, saveClientState, loadPersistentState, savePersistentState } from './utils/storageService';

import { 
  initialCompanyProfile, 
  seedFirm,
  seedClients,
  seedDtes, 
  seedF29, 
  seedPayrolls, 
  seedLeases, 
  seedMovements,
  seedBankAccounts,
  seedBankMovements,
  seedWarehouses,
  seedInventoryItems,
  seedTransfers,
  seedRequisitions
} from './data/seedData';
import {
  seedFixedAssets,
  seedProductionOrders,
  seedCifPool,
} from './data/seedFixedAssetsAndProduction';
import {
  SEED_PRODUCTION_BUDGETS,
  SEED_WAREHOUSE_WITHDRAWALS,
  convertBudgetToProductionOrder,
} from './data/seedBudgetsAndWithdrawals';
import { 
  DEFAULT_INDICATORS,
  createSalesDteEntry,
  createPurchaseDteEntry,
  createHonorariosEntry,
  createPayrollCentralizationEntry,
  createF29PaymentEntry,
  createLeaseIfrs16Entry,
  createBankNovedadEntry,
  formatCLP
} from './utils/chileanAccounting';
import { useAccountingLedger } from './hooks/useAccountingLedger';
import { 
  DteDocument, 
  F29Declaration, 
  EmployeePayroll, 
  LeaseContract, 
  CashFlowMovement, 
  AccountingEntry,
  AccountingFirmProfile,
  ClientCompany,
  BankAccountConfig,
  BankStatementMovement,
  Warehouse,
  InventoryItem,
  WarehouseTransfer,
  ReplenishmentRequisition,
  FixedAsset,
  ProductionOrder,
  ProductionBudget,
  WarehouseWithdrawal,
  IndirectCostPoolItem,
  SystemGeneralParameters,
} from './types';
import { DEFAULT_SYSTEM_GENERAL_PARAMETERS } from './data/erpMasterConfig';
import { 
  Receipt, 
  FileSpreadsheet, 
  Users, 
  Home, 
  TrendingUp, 
  BookOpen, 
  Bot, 
  CheckCircle2, 
  ShieldCheck,
  AlertTriangle,
  Building,
  ChevronRight,
  Sliders,
  Landmark,
  Boxes,
  UserCheck,
  Scale,
  Building2,
  Factory,
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('agents');
  const [isManualOpen, setIsManualOpen] = useState<boolean>(false);
  
  // Multi-Company & Accounting Firm (Estudio Contable) Context State
  const [firm, setFirm] = useState<AccountingFirmProfile>(seedFirm);
  const [clients, setClients] = useState<ClientCompany[]>(seedClients);
  const [activeClientId, setActiveClientId] = useState<string>(seedClients[0].id);

  // Active Client derived object (backward-compatible with company)
  const activeClient = clients.find(c => c.id === activeClientId) || clients[0];
  const [company, setCompany] = useState(activeClient);
  const [indicators, setIndicators] = useState(DEFAULT_INDICATORS);

  // Core Data States with Multi-Tenant Local Persistence (Sin datos fijos, almacenamiento real segregado)
  const [dtes, setDtes] = useState<DteDocument[]>(() => {
    return loadClientState<DteDocument[]>(activeClientId, 'dtes', activeClient.id === 'client-innovagile' ? [] : seedDtes);
  });
  const [f29, setF29] = useState<F29Declaration>(() => {
    const isExento = Boolean((activeClient as any)?.exentoIvaGiro || activeClient.id === 'client-innovagile');
    if (isExento) {
      return {
        ...seedF29,
        rutContribuyente: activeClient.rut,
        razonSocial: activeClient.razonSocial,
        tasaPpm: activeClient.tasaPpm || 0.01,
        ventasAfectasNeto: 0,
        debitoFiscalIva: 0,
        ventasExentasTotal: 0,
        notasCreditoDebitoVentas: 0,
        comprasNetoAfecto: 0,
        creditoFiscalIva: 0,
        impuestoDeterminadoIva: 0,
        baseImponiblePpm: 0,
        montoPpm: 0,
        totalAPagar: 0,
      };
    }
    return {
      ...seedF29,
      rutContribuyente: activeClient.rut,
      razonSocial: activeClient.razonSocial,
      tasaPpm: activeClient.tasaPpm || 0.01,
    };
  });
  const [payrolls, setPayrolls] = useState<EmployeePayroll[]>(() => {
    return loadClientState<EmployeePayroll[]>(activeClientId, 'payrolls', activeClient.id === 'client-innovagile' ? [] : seedPayrolls);
  });
  const [leases, setLeases] = useState<LeaseContract[]>(() => {
    return loadClientState<LeaseContract[]>(activeClientId, 'leases', seedLeases);
  });
  const [movements, setMovements] = useState<CashFlowMovement[]>(() => {
    return loadClientState<CashFlowMovement[]>(activeClientId, 'movements', seedMovements);
  });

  // Bank Reconciliation & Open Banking States (Cada cliente tiene sus cuentas bancarias persistidas)
  const [bankAccounts, setBankAccounts] = useState<BankAccountConfig[]>(() => {
    return loadClientState<BankAccountConfig[]>(activeClientId, 'bankAccounts', seedBankAccounts);
  });
  const [bankMovements, setBankMovements] = useState<BankStatementMovement[]>(() => {
    return loadClientState<BankStatementMovement[]>(activeClientId, 'bankMovements', seedBankMovements);
  });

  // Efectos de Sincronización Automática en LocalStorage por Cliente
  useEffect(() => {
    if (activeClientId) {
      saveClientState(activeClientId, 'dtes', dtes);
    }
  }, [activeClientId, dtes]);

  useEffect(() => {
    if (activeClientId) {
      saveClientState(activeClientId, 'movements', movements);
    }
  }, [activeClientId, movements]);

  useEffect(() => {
    if (activeClientId) {
      saveClientState(activeClientId, 'bankAccounts', bankAccounts);
    }
  }, [activeClientId, bankAccounts]);

  useEffect(() => {
    if (activeClientId) {
      saveClientState(activeClientId, 'bankMovements', bankMovements);
    }
  }, [activeClientId, bankMovements]);

  useEffect(() => {
    if (activeClientId) {
      saveClientState(activeClientId, 'payrolls', payrolls);
    }
  }, [activeClientId, payrolls]);

  // Parámetros Generales de Sistema ERP (Art. 16 Código Tributario, Moneda, Cuentas de Cierre y Redondeo)
  const [systemParams, setSystemParams] = useState<SystemGeneralParameters>(() => {
    const saved = localStorage.getItem('audicon_system_general_params');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved system general params', e);
      }
    }
    return DEFAULT_SYSTEM_GENERAL_PARAMETERS;
  });

  const handleUpdateSystemParams = (newParams: SystemGeneralParameters) => {
    setSystemParams(newParams);
    try {
      localStorage.setItem('audicon_system_general_params', JSON.stringify(newParams));
    } catch (e) {
      console.error('Failed to save system general params', e);
    }
    // Sincronizar parámetros de cierre de ejercicio en el perfil de empresa activa
    setCompany(prev => ({
      ...prev,
      mesCierreEjercicio: newParams.mesCierreEjercicio,
      diaCierreEjercicio: newParams.diaCierreEjercicio,
      ejercicioActivo: newParams.ejercicioActivo,
      bloqueoPeriodoCerrado: newParams.bloqueoPeriodoCerrado,
      resolucionSiiCierreEspecial: newParams.resolucionSiiCierreEspecial,
    }));
  };

  // Inventory & Multi-Warehouse States (Agente de Inventarios & Bodegas)
  const [warehouses, setWarehouses] = useState<Warehouse[]>(seedWarehouses);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>(seedInventoryItems);
  const [transfers, setTransfers] = useState<WarehouseTransfer[]>(seedTransfers);
  const [requisitions, setRequisitions] = useState<ReplenishmentRequisition[]>(seedRequisitions);

  // Fixed Assets (Responsable de la Administración del Activo Fijo - NIC 16)
  const [fixedAssets, setFixedAssets] = useState<FixedAsset[]>(seedFixedAssets);

  // Production Orders & Costing (Agente de Producción o Costeo - NIC 2)
  const [productionOrders, setProductionOrders] = useState<ProductionOrder[]>(seedProductionOrders);
  const [cifPoolItems, setCifPoolItems] = useState<IndirectCostPoolItem[]>(seedCifPool);

  // Production Budgets & Warehouse Withdrawals (Presupuestos & Vales a OP)
  const [productionBudgets, setProductionBudgets] = useState<ProductionBudget[]>(SEED_PRODUCTION_BUDGETS);
  const [warehouseWithdrawals, setWarehouseWithdrawals] = useState<WarehouseWithdrawal[]>(SEED_WAREHOUSE_WITHDRAWALS);

  // Select active client
  const handleSelectActiveClient = (clientId: string) => {
    const selected = clients.find(c => c.id === clientId);
    if (!selected) return;
    setActiveClientId(clientId);
    setCompany(selected);
    const isExento = Boolean((selected as any)?.exentoIvaGiro || selected.id === 'client-innovagile');

    const loadedDtes = loadClientState<DteDocument[]>(clientId, 'dtes', isExento ? [] : seedDtes);
    const loadedPayrolls = loadClientState<EmployeePayroll[]>(clientId, 'payrolls', isExento ? [] : seedPayrolls);
    const loadedMovements = loadClientState<CashFlowMovement[]>(clientId, 'movements', seedMovements);
    const loadedBanks = loadClientState<BankAccountConfig[]>(clientId, 'bankAccounts', seedBankAccounts);
    const loadedBankMovs = loadClientState<BankStatementMovement[]>(clientId, 'bankMovements', seedBankMovements);

    setDtes(loadedDtes);
    setPayrolls(loadedPayrolls);
    setMovements(loadedMovements);
    setBankAccounts(loadedBanks);
    setBankMovements(loadedBankMovs);

    if (isExento) {
      setF29({
        ...seedF29,
        rutContribuyente: selected.rut,
        razonSocial: selected.razonSocial,
        tasaPpm: selected.tasaPpm || 0.01,
        ventasAfectasNeto: 0,
        debitoFiscalIva: 0,
        ventasExentasTotal: 0,
        notasCreditoDebitoVentas: 0,
        comprasNetoAfecto: 0,
        creditoFiscalIva: 0,
        impuestoDeterminadoIva: 0,
        baseImponiblePpm: 0,
        montoPpm: 0,
        totalAPagar: 0,
      });
    } else {
      setF29(prev => ({
        ...prev,
        rutContribuyente: selected.rut,
        razonSocial: selected.razonSocial,
        tasaPpm: selected.tasaPpm || 0.01,
      }));
    }
  };

  // Add new client to firm's portfolio
  const handleAddClient = (newClient: ClientCompany) => {
    setClients(prev => [newClient, ...prev]);
    handleSelectActiveClient(newClient.id);
  };

  // Update existing client configuration
  const handleUpdateClient = (updatedClient: ClientCompany) => {
    setClients(prev => prev.map(c => c.id === updatedClient.id ? updatedClient : c));
    if (updatedClient.id === activeClientId) {
      setCompany(updatedClient);
      setF29(prev => ({
        ...prev,
        rutContribuyente: updatedClient.rut,
        razonSocial: updatedClient.razonSocial,
        tasaPpm: updatedClient.tasaPpm || prev.tasaPpm,
      }));
    }
  };

  // Delete client
  const handleDeleteClient = (clientId: string) => {
    const remaining = clients.filter(c => c.id !== clientId);
    setClients(remaining);
    if (activeClientId === clientId && remaining.length > 0) {
      handleSelectActiveClient(remaining[0].id);
    }
  };

  // Aprobación de Presupuesto y Generación Automática de OP
  const handleApproveBudgetAndGenerateOp = (budget: ProductionBudget) => {
    const nextOpNum = 100 + productionOrders.length + 1;
    const generatedFolio = `OP-${new Date().getFullYear()}-${nextOpNum}`;
    const newOp = convertBudgetToProductionOrder(budget, generatedFolio);

    const updatedBudget: ProductionBudget = {
      ...budget,
      estado: 'APROBADO',
      fechaAprobacion: new Date().toISOString().split('T')[0],
      ordenProduccionIdGenerada: newOp.id,
      folioOpGenerada: newOp.folioOP,
    };

    setProductionBudgets(prev => prev.map(b => b.id === budget.id ? updatedBudget : b));
    setProductionOrders(prev => [newOp, ...prev]);
  };

  // Retiro de Bodega vinculado a OP (Actualización de Stock, OP y Asiento WIP)
  const handleAddWithdrawal = (withdrawal: WarehouseWithdrawal) => {
    // 1. Agregar a historial de retiros
    setWarehouseWithdrawals(prev => [withdrawal, ...prev]);

    // 2. Rebajar stock físico en Bodegas e Inventario General
    setInventoryItems(prevItems => {
      return prevItems.map(item => {
        const matchingWithdrawalItem = withdrawal.items.find(
          wi => wi.insumoId === item.id || wi.insumoCodigo === item.sku
        );
        if (!matchingWithdrawalItem) return item;

        const qtyToDeduct = matchingWithdrawalItem.cantidadSolicitada;
        const newStockGeneral = Math.max(0, item.stockGeneral - qtyToDeduct);
        const updatedWhStock = item.stockPorBodega.map(wh => {
          if (wh.bodegaId === withdrawal.bodegaOrigenId) {
            return {
              ...wh,
              stockFisico: Math.max(0, wh.stockFisico - qtyToDeduct),
            };
          }
          return wh;
        });

        return {
          ...item,
          stockGeneral: newStockGeneral,
          stockDisponible: Math.max(0, newStockGeneral - item.stockComprometido),
          stockPorBodega: updatedWhStock,
        };
      });
    });

    // 3. Imputar consumo MPD a la Orden de Producción
    setProductionOrders(prevOps => {
      return prevOps.map(op => {
        if (op.id !== withdrawal.ordenProduccionId && op.folioOP !== withdrawal.ordenProduccionFolio) {
          return op;
        }

        const newConsumptions = withdrawal.items.map((wi, idx) => ({
          id: `mpd-${Date.now()}-${idx}`,
          insumoId: wi.insumoId,
          insumoCodigo: wi.insumoCodigo,
          insumoNombre: wi.insumoNombre,
          bodegaOrigenNombre: withdrawal.bodegaOrigenNombre,
          cantidadConsumida: wi.cantidadSolicitada,
          unidadMedida: wi.unidadMedida,
          costoUnitarioPMP: wi.costoUnitarioPMP,
          costoTotalConsumo: wi.costoTotal,
          fechaConsumo: withdrawal.fechaRetiro || withdrawal.fecha || new Date().toISOString().split('T')[0],
          folioGuiaDespacho52: withdrawal.folioGuiaDespacho52,
        }));

        const additionalCost = withdrawal.costoTotalVale || withdrawal.costoTotalRetiro || 0;
        const newMpd = (op.costoDirectoMateriales || 0) + additionalCost;
        const newPrimo = (op.costoDirectoManoObra || 0) + newMpd;
        const newTotal = newPrimo + (op.costoIndirectoCif || 0);
        const cantReal = op.cantidadProducidaReal > 0 ? op.cantidadProducidaReal : op.cantidadObjetivo;
        const newUnit = Math.round(newTotal / (cantReal || 1));

        return {
          ...op,
          consumosMateriales: [...(op.consumosMateriales || []), ...newConsumptions],
          costoDirectoMateriales: newMpd,
          costoPrimo: newPrimo,
          costoTotalProduccion: newTotal,
          costoUnitarioReal: newUnit,
        };
      });
    });

    // 4. Centralizar asiento contable de consumo WIP (Art. 30 LIR)
    const totalAmount = withdrawal.costoTotalVale || withdrawal.costoTotalRetiro || 0;
    const withdrawalDate = withdrawal.fecha || withdrawal.fechaRetiro || new Date().toISOString().split('T')[0];
    const respBodega = withdrawal.responsableBodega || withdrawal.responsableBodegaNombre || 'Agente WMS/Producción';

    if (totalAmount > 0) {
      const entryId = `entry-wip-mpd-${Date.now()}`;
      const newEntry: AccountingEntry = {
        id: entryId,
        fecha: withdrawalDate,
        concepto: `Consumo MPD Vale ${withdrawal.folioVale} a ${withdrawal.ordenProduccionFolio} (${withdrawal.clienteNombre || 'Producción'})`,
        documento: `Vale Salida Bodega ${withdrawal.folioVale}`,
        lineas: [
          {
            cuentaCodigo: '1.1.04.004',
            cuentaNombre: 'Productos en Proceso WIP - Materiales Directos',
            debe: totalAmount,
            haber: 0,
            centroCosto: 'PLANTA_FABRIL',
          },
          {
            cuentaCodigo: '1.1.04.001',
            cuentaNombre: 'Materias Primas e Insumos Fabriles',
            debe: 0,
            haber: totalAmount,
            centroCosto: 'BODEGA_CENTRAL',
          },
        ],
        totalDebe: totalAmount,
        totalHaber: totalAmount,
        balanceado: true,
        origen: 'INVENTARIO',
        creadoEn: new Date().toISOString(),
        supervisorSignature: respBodega,
      };
      handleAddEntry(newEntry);
    }
  };

  // Automated agent download routine for client via real Playwright
  const handleDownloadClientDtes = async (client: ClientCompany) => {
    const timestamp = new Date().toLocaleString('es-CL');
    try {
      const res = await fetch('/api/sii/run-playwright', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rut: client.rutAutenticacion || client.rut,
          password: client.claveSii,
          periodo: '2026-08',
          tipo: 'ALL',
        }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.documentos) && data.documentos.length > 0) {
        handleAddMultipleDtes(data.documentos, true);
        handleUpdateClient({
          ...client,
          estadoConexionSii: 'CONECTADO',
          ultimaSincronizacionSii: timestamp,
          ultimoMensajeSii: `Playwright descargó ${data.documentos.length} DTEs oficiales reales.`,
        });
      } else {
        handleUpdateClient({
          ...client,
          estadoConexionSii: data.success ? 'CONECTADO' : 'ERROR_CREDENCIALES',
          ultimaSincronizacionSii: timestamp,
          ultimoMensajeSii: data.error || 'RCV consultado vía Chromium: sin nuevos documentos para el período.',
        });
      }
    } catch (err: any) {
      handleUpdateClient({
        ...client,
        estadoConexionSii: 'ERROR_CREDENCIALES',
        ultimaSincronizacionSii: timestamp,
        ultimoMensajeSii: `Error en RPA Playwright: ${err.message}`,
      });
    }
  };

  // Handler to clear all mock/demo DTEs and start completely blank
  const handleClearAllDtes = () => {
    setDtes([]);
  };

  // Libro Diario Contable Persistente (PostgreSQL / Drizzle ORM API)
  const {
    entries,
    isLoading: isLedgerLoading,
    isCommitting: isLedgerCommitting,
    error: ledgerError,
    commitEntry,
    addEntry,
    refetch: refetchLedger,
  } = useAccountingLedger(company.rut, '2026-09');

  // Modals
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  // Handlers
  const handleAddDte = (newDte: DteDocument) => {
    setDtes(prev => [newDte, ...prev]);
  };

  const handleAddMultipleDtes = (newDtes: DteDocument[], autoSyncCashFlow: boolean) => {
    setDtes(prev => {
      const existingIds = new Set(prev.map(d => d.id));
      const filtered = newDtes.filter(d => !existingIds.has(d.id));
      return [...filtered, ...prev];
    });

    if (autoSyncCashFlow) {
      const newMovements: CashFlowMovement[] = newDtes
        .filter(d => d.estadoPago === 'PENDIENTE')
        .map(d => ({
          id: `mov-auto-${d.id}-${Date.now()}`,
          fechaEstimada: d.fechaEmision,
          concepto: `${d.tipoOperacion === 'VENTA' ? 'Cobro' : 'Pago'} DTE ${d.tipoDte} F.${d.folio} - ${d.razonSocialContraparte}`,
          contraparte: d.razonSocialContraparte,
          rutContraparte: d.rutContraparte,
          montoNeto: d.montoNeto,
          montoIva: d.montoIva,
          montoTotal: d.montoTotal,
          moneda: 'CLP',
          estado: 'PENDIENTE',
          tipo: d.tipoOperacion === 'VENTA' ? 'INGRESO' : 'EGRESO',
          categoria: d.tipoOperacion === 'VENTA' ? 'VENTAS_OPERACIONALES' : d.tipoOperacion === 'HONORARIOS' ? 'HONORARIOS' : 'PROVEEDORES',
          dteFolioAsociado: d.folio
        }));
      if (newMovements.length > 0) {
        setMovements(prev => [...newMovements, ...prev]);
      }
    }
  };

  const handleUpdateDte = (updated: DteDocument) => {
    setDtes(prev => prev.map(d => d.id === updated.id ? updated : d));
  };

  const handleAddEntry = async (entry: AccountingEntry) => {
    try {
      await addEntry(entry);
    } catch (err: any) {
      console.error('[App] Error al autorizar y persistir comprobante contable:', err);
    }
  };

  const handleAddEmployee = (emp: EmployeePayroll) => {
    setPayrolls(prev => [emp, ...prev]);
  };

  const handleUpdateEmployee = (updated: EmployeePayroll) => {
    setPayrolls(prev => prev.map(p => p.id === updated.id ? updated : p));
  };

  const handleDeleteEmployee = (id: string) => {
    setPayrolls(prev => prev.filter(p => p.id !== id));
  };

  const handleAddLease = (lease: LeaseContract) => {
    setLeases(prev => [lease, ...prev]);
  };

  const handleAddMovement = (mov: CashFlowMovement) => {
    setMovements(prev => [mov, ...prev]);
  };

  const handleUpdateMovement = (updated: CashFlowMovement) => {
    setMovements(prev => prev.map(m => m.id === updated.id ? updated : m));
  };

  // Register Bank Novelty into Accounting Ledger & Cashflow
  const handleRegisterBankNovedad = (movement: BankStatementMovement) => {
    const bankAcc = bankAccounts.find(a => a.id === movement.cuentaId) || bankAccounts[0];
    const bankName = bankAcc ? bankAcc.banco : 'Banco Santander Chile';

    // 1. Generate formal accounting entry
    const newEntry = createBankNovedadEntry(movement, bankName);
    handleAddEntry(newEntry);

    // 2. Generate corresponding cashflow entry
    const total = movement.abono > 0 ? movement.abono : movement.cargo;
    const newCashFlowMov: CashFlowMovement = {
      id: `cf-bank-nov-${movement.id}-${Date.now()}`,
      fechaEstimada: movement.fecha,
      fechaReal: movement.fecha,
      concepto: `Novedad Bancaria (${bankName}): ${movement.glosaBancaria}`,
      contraparte: bankName,
      montoNeto: total,
      montoIva: 0,
      montoTotal: total,
      moneda: 'CLP',
      tipo: movement.abono > 0 ? 'INGRESO' : 'EGRESO',
      categoria: movement.abono > 0 ? 'VENTAS_OPERACIONALES' : 'OTRO',
      estado: movement.abono > 0 ? 'COBRADO' : 'PAGADO',
      dteFolioAsociado: movement.dteFolioAsociado,
    };
    setMovements(prev => [newCashFlowMov, ...prev]);

    // 3. Mark bank movement as reconciled
    setBankMovements(prev => prev.map(m => {
      if (m.id === movement.id) {
        return {
          ...m,
          estado: 'CONCILIADO' as const,
          novedadRegistrada: true,
          asientoGeneradoId: newEntry.id,
          movimientoIdConciliado: newCashFlowMov.id,
          matchCerteza: 100,
        };
      }
      return m;
    }));
  };

  // Bulk Register all pending Bank Novelties
  const handleRegisterAllBankNovedades = (novedades: BankStatementMovement[]) => {
    if (!novedades || novedades.length === 0) return;
    const bankAcc = bankAccounts.find(a => a.id === novedades[0].cuentaId) || bankAccounts[0];
    const bankName = bankAcc ? bankAcc.banco : 'Banco Santander Chile';

    const newCashFlowMovs: CashFlowMovement[] = [];
    const resolvedMap = new Map<string, string>(); // movId -> entryId

    novedades.forEach(movement => {
      const newEntry = createBankNovedadEntry(movement, bankName);
      handleAddEntry(newEntry);
      resolvedMap.set(movement.id, newEntry.id);

      const total = movement.abono > 0 ? movement.abono : movement.cargo;
      newCashFlowMovs.push({
        id: `cf-bank-nov-${movement.id}-${Date.now()}`,
        fechaEstimada: movement.fecha,
        fechaReal: movement.fecha,
        concepto: `Novedad Bancaria (${bankName}): ${movement.glosaBancaria}`,
        contraparte: bankName,
        montoNeto: total,
        montoIva: 0,
        montoTotal: total,
        moneda: 'CLP',
        tipo: movement.abono > 0 ? 'INGRESO' : 'EGRESO',
        categoria: movement.abono > 0 ? 'VENTAS_OPERACIONALES' : 'OTRO',
        estado: movement.abono > 0 ? 'COBRADO' : 'PAGADO',
        dteFolioAsociado: movement.dteFolioAsociado,
      });
    });

    setMovements(prev => [...newCashFlowMovs, ...prev]);
    setBankMovements(prev => prev.map(m => {
      if (resolvedMap.has(m.id)) {
        return {
          ...m,
          estado: 'CONCILIADO' as const,
          novedadRegistrada: true,
          asientoGeneradoId: resolvedMap.get(m.id),
          matchCerteza: 100,
        };
      }
      return m;
    }));
  };

  // Reset demo movements to initial state with novelties for testing
  const handleResetBankMovements = () => {
    setBankMovements(seedBankMovements);
  };

  // Discrepancy detector for quick alerts
  const rcvDebito = dtes.filter(d => d.tipoOperacion === 'VENTA').reduce((s, d) => s + (d.tipoDte === '61' ? -d.montoIva : d.montoIva), 0);
  const rcvCredito = dtes.filter(d => d.tipoOperacion === 'COMPRA').reduce((s, d) => s + d.montoIva, 0);
  
  let discrepanciesCount = 0;
  if (Math.abs(f29.debitoFiscalIva - rcvDebito) > 10) discrepanciesCount++;
  if (Math.abs(f29.creditoFiscalIva - rcvCredito) > 10) discrepanciesCount++;

  const navLinks = [
    { id: 'agents', label: 'Agentes & Clientes', subtitle: 'Estudio, Claves SII & RCV', icon: Sliders },
    { id: 'billing_agent', label: 'Facturación & Cobranza', subtitle: 'DTE, Playwright SII & Boletas', icon: Bot },
    { id: 'rcv', label: 'Registro Compras, Ventas / Honorarios', subtitle: 'DTEs 33, 34, 61, BHE & Boletas', icon: Receipt },
    { id: 'reconciliation', label: 'Conciliación Bancaria', subtitle: 'APIs Bancos, Cartolas & Novedades', icon: Landmark },
    { id: 'f29', label: 'Agente Fiscal F29 & SII', subtitle: 'Motor F29, Art. 64 & Patente CPT', icon: FileSpreadsheet },
    { id: 'hr_agent', label: 'Agente RRHH & Personas', subtitle: 'DT, Previred, Art. 10/161 & Karin', icon: UserCheck },
    { id: 'payroll', label: 'Remuneraciones (DT)', subtitle: 'Nómina, Art. 50 e Imposiciones', icon: Users },
    { id: 'inventory', label: 'Inventario & Bodegas', subtitle: 'WMS, Stock Crítico & DTE 52', icon: Boxes },
    { id: 'fixed_assets', label: 'Activo Fijo (NIC 16)', subtitle: 'CM Art. 41, Deprec. & Ficha', icon: Building2 },
    { id: 'production', label: 'Producción & Costeo', subtitle: 'NIC 2, MPD, MOD, CIF & CPT', icon: Factory },
    { id: 'cashflow', label: 'Flujo de Caja Proyectado', subtitle: 'Saldo Bancario Real & 30/60/90 días', icon: TrendingUp },
    { id: 'leases', label: 'Contratos & Arriendos', subtitle: 'Modelado NIIF / IFRS 16', icon: Home },
    { id: 'ledger', label: 'Agente Contable Senior', subtitle: 'Núcleo ERP, Mayor, Diario & IFRS', icon: Scale },
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col font-sans selection:bg-blue-500/20 selection:text-blue-700">
      {/* Geometric Balance Top Bar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        indicators={indicators}
        company={company}
        firm={firm}
        clients={clients}
        activeClientId={activeClientId}
        onSelectClient={handleSelectActiveClient}
        discrepanciesCount={discrepanciesCount}
        openAiChat={() => setIsAiModalOpen(true)}
        openAuditor={() => setIsAiModalOpen(true)}
        openManual={() => setIsManualOpen(true)}
      />

      {/* Main Two-Column Layout */}
      <div className="flex-1 flex flex-col md:flex-row w-full max-w-[1600px] mx-auto">
        {/* Geometric Sidebar Navigation */}
        <aside className="w-full md:w-64 bg-white border-r border-slate-200 flex flex-col justify-between shrink-0 shadow-[1px_0_3px_rgba(0,0,0,0.02)]">

          <div className="py-3 space-y-1">
            <div className="px-5 pb-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Módulos del Sistema
            </div>
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = activeTab === link.id;
              return (
                <button
                  key={link.id}
                  id={`sidebar-link-${link.id}`}
                  onClick={() => setActiveTab(link.id)}
                  className={`w-full text-left px-5 py-3 text-xs flex items-center justify-between border-l-4 transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#eff6ff] text-[#2563eb] border-l-[#2563eb] font-semibold shadow-[inset_-2px_0_0_rgba(37,99,235,0.1)]'
                      : 'text-slate-600 border-l-transparent hover:bg-slate-50 hover:text-slate-900 font-medium'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-[#2563eb]' : 'text-slate-400'}`} />
                    <div>
                      <div className={isActive ? 'text-[#2563eb] font-bold' : 'text-slate-800'}>
                        {link.label}
                      </div>
                      <div className="text-[10px] text-slate-400 font-normal">
                        {link.subtitle}
                      </div>
                    </div>
                  </div>
                  {isActive && <ChevronRight className="w-3.5 h-3.5 text-[#2563eb]" />}
                </button>
              );
            })}
          </div>

          {/* Sidebar Bottom: Compliance & Health Card */}
          <div className="p-4 border-t border-slate-200 bg-slate-50/70 space-y-2">
            <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500 uppercase">Estado Cumplimiento</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="mt-1 font-bold text-xs text-emerald-700">
                SII & Previred Conectados
              </div>
              <div className="mt-0.5 text-[10px] text-slate-500 truncate">
                Cliente: <strong className="text-slate-700">{activeClient.nombreCorto}</strong>
              </div>
              <div className="text-[10px] text-slate-400">
                Régimen: {company.regimenTributario === '14D3_PROPYME_GENERAL' ? '14 D3 ProPyme' : '14 A General'}
              </div>
            </div>

            <button
              onClick={() => setIsManualOpen(true)}
              className="w-full flex items-center justify-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 py-1.5 px-3 rounded-md text-xs font-bold shadow-2xs transition-colors cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
              <span>Manual & Guía de Pruebas</span>
            </button>

            <button
              onClick={() => setIsAiModalOpen(true)}
              className="w-full flex items-center justify-center gap-2 bg-[#0f172a] hover:bg-slate-800 text-white py-2 px-3 rounded-md text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Bot className="w-3.5 h-3.5 text-blue-400" />
              <span>Auditor Contable Senior</span>
            </button>
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto bg-[#f8fafc]">
          {activeTab === 'agents' && (
            <AgentClientConfig
              firm={firm}
              onUpdateFirm={setFirm}
              clients={clients}
              activeClientId={activeClientId}
              onSelectActiveClient={handleSelectActiveClient}
              onAddClient={handleAddClient}
              onUpdateClient={handleUpdateClient}
              onDeleteClient={handleDeleteClient}
              onDownloadClientDtes={handleDownloadClientDtes}
              systemParams={systemParams}
              onUpdateSystemParams={handleUpdateSystemParams}
            />
          )}

          {activeTab === 'billing_agent' && (
            <BillingAutonomousAgent
              company={company}
              dtes={dtes}
              onAddDte={handleAddDte}
              onUpdateDte={handleUpdateDte}
              onAddEntry={handleAddEntry}
              onAddCashFlowMovement={handleAddMovement}
              productionOrders={productionOrders}
              productionBudgets={productionBudgets}
              bankAccounts={bankAccounts}
            />
          )}

          {activeTab === 'rcv' && (
            <DteManager
              dtes={dtes}
              onAddDte={handleAddDte}
              onAddMultipleDtes={handleAddMultipleDtes}
              onUpdateDte={handleUpdateDte}
              onAddEntry={handleAddEntry}
              company={company}
              onClearAllDtes={handleClearAllDtes}
              onSyncPendingToCashFlow={() => {
                const pending = dtes.filter(d => d.estadoPago === 'PENDIENTE');
                if (pending.length > 0) {
                  handleAddMultipleDtes(pending, true);
                }
              }}
            />
          )}

          {activeTab === 'reconciliation' && (
            <BankReconciliation
              company={company}
              firm={firm}
              activeClient={activeClient}
              bankAccounts={bankAccounts}
              onUpdateBankAccounts={setBankAccounts}
              bankMovements={bankMovements}
              onUpdateBankMovements={setBankMovements}
              cashFlowMovements={movements}
              accountingEntries={entries}
              onRegisterNovedad={handleRegisterBankNovedad}
              onRegisterAllNovedades={handleRegisterAllBankNovedades}
              onResetBankMovements={handleResetBankMovements}
            />
          )}

          {activeTab === 'f29' && (
            <F29SeniorAgent
              f29={f29}
              onUpdateF29={setF29}
              dtes={dtes}
              payrolls={payrolls}
              company={company}
              indicators={indicators}
              onAddEntry={handleAddEntry}
            />
          )}

          {activeTab === 'hr_agent' && (
            <HrAgentModule
              company={company}
              activeClient={activeClient}
              clients={clients}
              onSelectClient={handleSelectActiveClient}
              payrolls={payrolls}
              onUpdateEmployee={handleUpdateEmployee}
              onAddEmployee={handleAddEmployee}
              indicators={indicators}
              onAddAccountingEntry={handleAddEntry}
            />
          )}

          {activeTab === 'payroll' && (
            <PayrollManager
              payrolls={payrolls}
              onAddEmployee={handleAddEmployee}
              onUpdateEmployee={handleUpdateEmployee}
              onDeleteEmployee={handleDeleteEmployee}
              indicators={indicators}
              company={company}
              onAddEntry={handleAddEntry}
            />
          )}

          {activeTab === 'inventory' && (
            <InventoryAgentModule
              company={company}
              firm={firm}
              activeClient={activeClient}
              onUpdateClient={handleUpdateClient}
              warehouses={warehouses}
              onUpdateWarehouses={setWarehouses}
              inventoryItems={inventoryItems}
              onUpdateInventoryItems={setInventoryItems}
              transfers={transfers}
              onUpdateTransfers={setTransfers}
              requisitions={requisitions}
              onUpdateRequisitions={setRequisitions}
              onAddAccountingEntry={handleAddEntry}
              productionOrders={productionOrders}
              productionBudgets={productionBudgets}
              warehouseWithdrawals={warehouseWithdrawals}
              onAddWithdrawal={handleAddWithdrawal}
              onQuickCreateOp={(newOp) => setProductionOrders(prev => [newOp, ...prev])}
            />
          )}

          {activeTab === 'fixed_assets' && (
            <FixedAssetAgentModule
              currentClient={activeClient}
              assets={fixedAssets || []}
              fixedAssets={fixedAssets || []}
              onAddAsset={(asset) => setFixedAssets(prev => [asset, ...prev])}
              onUpdateAsset={(asset) => setFixedAssets(prev => prev.map(a => a.id === asset.id ? asset : a))}
              onAddAccountingEntry={handleAddEntry}
              accountingEntries={entries || []}
              indicators={indicators}
            />
          )}

          {activeTab === 'production' && (
            <ProductionCostingAgentModule
              currentClient={activeClient}
              productionOrders={productionOrders || []}
              cifPoolItems={cifPoolItems || []}
              onAddProductionOrder={(order) => setProductionOrders(prev => [order, ...prev])}
              onUpdateProductionOrder={(order) => setProductionOrders(prev => prev.map(o => o.id === order.id ? order : o))}
              onAddAccountingEntry={handleAddEntry}
              accountingEntries={entries || []}
              productionBudgets={productionBudgets}
              warehouseWithdrawals={warehouseWithdrawals}
              onAddProductionBudget={(b) => setProductionBudgets(prev => [b, ...prev])}
              onUpdateProductionBudget={(b) => setProductionBudgets(prev => prev.map(item => item.id === b.id ? b : item))}
              onApproveBudgetAndGenerateOp={handleApproveBudgetAndGenerateOp}
              inventoryItems={inventoryItems}
              warehouses={warehouses}
            />
          )}

          {activeTab === 'leases' && (
            <LeaseManager
              leases={leases}
              onAddLease={handleAddLease}
              indicators={indicators}
              onAddEntry={handleAddEntry}
            />
          )}

          {activeTab === 'cashflow' && (
            <CashFlowProjections
              movements={movements}
              onAddMovement={handleAddMovement}
              onAddMultipleMovements={(newMovs) => setMovements(prev => [...newMovs, ...prev])}
              onUpdateMovement={handleUpdateMovement}
              dtes={dtes}
              indicators={indicators}
              company={company}
              bankAccounts={bankAccounts}
              payrolls={payrolls}
              f29={f29}
              productionBudgets={productionBudgets}
              productionOrders={productionOrders}
              leases={leases}
            />
          )}

          {activeTab === 'ledger' && (
            <SeniorAccountingOrchestrator
              company={company}
              onUpdateCompany={(updated) => setCompany(prev => ({ ...prev, ...updated }))}
              firm={firm}
              indicators={indicators}
              entries={entries}
              onAddEntry={handleAddEntry}
              commitEntry={commitEntry}
              isLedgerLoading={isLedgerLoading}
              isLedgerCommitting={isLedgerCommitting}
              refetchLedger={refetchLedger}
              dtes={dtes}
              payrolls={payrolls}
              f29={f29}
              leases={leases}
              bankStatements={bankMovements}
              systemParams={systemParams}
              onUpdateSystemParams={handleUpdateSystemParams}
            />
          )}
        </main>
      </div>

      {/* Senior AI Fiscal & Accounting Auditor Modal */}
      <AiFiscalAuditorModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        dtes={dtes}
        f29={f29}
        payrolls={payrolls}
        leases={leases}
        movements={movements}
        entries={entries}
        indicators={indicators}
        company={company}
        firm={firm}
        onAddEntry={handleAddEntry}
      />

      {/* Interactive In-App User Manual & Casuistics Modal */}
      <UserManualModal
        isOpen={isManualOpen}
        onClose={() => setIsManualOpen(false)}
        onNavigateToTab={(tabId) => setActiveTab(tabId)}
      />
    </div>
  );
}
