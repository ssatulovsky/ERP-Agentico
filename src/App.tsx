import React, { useState } from 'react';
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
  ReplenishmentRequisition
} from './types';
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
  Scale
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('agents');
  
  // Multi-Company & Accounting Firm (Estudio Contable) Context State
  const [firm, setFirm] = useState<AccountingFirmProfile>(seedFirm);
  const [clients, setClients] = useState<ClientCompany[]>(seedClients);
  const [activeClientId, setActiveClientId] = useState<string>(seedClients[0].id);

  // Active Client derived object (backward-compatible with company)
  const activeClient = clients.find(c => c.id === activeClientId) || clients[0];
  const [company, setCompany] = useState(activeClient);
  const [indicators, setIndicators] = useState(DEFAULT_INDICATORS);

  // Core Data States
  const [dtes, setDtes] = useState<DteDocument[]>(seedDtes);
  const [f29, setF29] = useState<F29Declaration>({
    ...seedF29,
    rutContribuyente: activeClient.rut,
    razonSocial: activeClient.razonSocial,
    tasaPpm: activeClient.tasaPpm || 0.01,
  });
  const [payrolls, setPayrolls] = useState<EmployeePayroll[]>(seedPayrolls);
  const [leases, setLeases] = useState<LeaseContract[]>(seedLeases);
  const [movements, setMovements] = useState<CashFlowMovement[]>(seedMovements);

  // Bank Reconciliation & Open Banking States
  const [bankAccounts, setBankAccounts] = useState<BankAccountConfig[]>(seedBankAccounts);
  const [bankMovements, setBankMovements] = useState<BankStatementMovement[]>(seedBankMovements);

  // Inventory & Multi-Warehouse States (Agente de Inventarios & Bodegas)
  const [warehouses, setWarehouses] = useState<Warehouse[]>(seedWarehouses);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>(seedInventoryItems);
  const [transfers, setTransfers] = useState<WarehouseTransfer[]>(seedTransfers);
  const [requisitions, setRequisitions] = useState<ReplenishmentRequisition[]>(seedRequisitions);

  // Select active client
  const handleSelectActiveClient = (clientId: string) => {
    const selected = clients.find(c => c.id === clientId);
    if (!selected) return;
    setActiveClientId(clientId);
    setCompany(selected);
    setF29(prev => ({
      ...prev,
      rutContribuyente: selected.rut,
      razonSocial: selected.razonSocial,
      tasaPpm: selected.tasaPpm || 0.01,
    }));
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

  // Automated agent download routine for client
  const handleDownloadClientDtes = (client: ClientCompany) => {
    const timestamp = new Date().toLocaleString('es-CL');
    
    // Add realistic simulated DTEs downloaded from SII for this client
    const newDownloadedDte: DteDocument = {
      id: `dte-auto-${Date.now()}`,
      tipoDte: '33',
      folio: Math.floor(1000 + Math.random() * 9000),
      tipoOperacion: 'COMPRA',
      rutContraparte: '76.999.888-2',
      razonSocialContraparte: 'SERVICIOS DIGITALES LATAM SPA',
      fechaEmision: new Date().toISOString().split('T')[0],
      fechaRecepcion: new Date().toISOString().split('T')[0],
      montoExento: 0,
      montoNeto: 480000,
      montoIva: 91200,
      montoTotal: 571200,
      estadoSii: 'ACEPTADO',
      estadoPago: 'PENDIENTE',
      glosa: 'Servicios de infraestructura Cloud descargados por Agente SII',
      cuentaContableDebe: 'Gasto Servidores & Cloud',
      cuentaContableHaber: 'Proveedores Nacionales',
    };

    setDtes(prev => [newDownloadedDte, ...prev]);
    const dteEntry = createPurchaseDteEntry(newDownloadedDte);
    handleAddEntry(dteEntry);

    // Update client sync timestamp
    handleUpdateClient({
      ...client,
      estadoConexionSii: 'CONECTADO',
      ultimaSincronizacionSii: timestamp,
      ultimoMensajeSii: 'Descarga automática ejecutada por el Agente. 1 nuevo DTE procesado.',
    });
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
    novedades.forEach(nov => {
      handleRegisterBankNovedad(nov);
    });
  };

  // Discrepancy detector for quick alerts
  const rcvDebito = dtes.filter(d => d.tipoOperacion === 'VENTA').reduce((s, d) => s + (d.tipoDte === '61' ? -d.montoIva : d.montoIva), 0);
  const rcvCredito = dtes.filter(d => d.tipoOperacion === 'COMPRA').reduce((s, d) => s + d.montoIva, 0);
  
  let discrepanciesCount = 0;
  if (Math.abs(f29.debitoFiscalIva - rcvDebito) > 10) discrepanciesCount++;
  if (Math.abs(f29.creditoFiscalIva - rcvCredito) > 10) discrepanciesCount++;

  const navLinks = [
    { id: 'agents', label: 'Agentes & Clientes', subtitle: 'Estudio, Claves SII & RCV', icon: Sliders },
    { id: 'rcv', label: 'Registro Compras/Ventas', subtitle: 'DTEs 33, 34, 61 & BHE', icon: Receipt },
    { id: 'reconciliation', label: 'Conciliación Bancaria', subtitle: 'APIs Bancos, Cartolas & Novedades', icon: Landmark },
    { id: 'f29', label: 'Agente Fiscal F29 & SII', subtitle: 'Motor F29, Art. 64 & Patente CPT', icon: FileSpreadsheet },
    { id: 'hr_agent', label: 'Agente RRHH & Personas', subtitle: 'DT, Previred, Art. 10/161 & Karin', icon: UserCheck },
    { id: 'payroll', label: 'Remuneraciones (DT)', subtitle: 'Nómina, Art. 50 e Imposiciones', icon: Users },
    { id: 'inventory', label: 'Inventario & Bodegas', subtitle: 'WMS, Stock Crítico & DTE 52', icon: Boxes },
    { id: 'cashflow', label: 'Flujo de Caja', subtitle: 'Proyecciones 30/60/90 días', icon: TrendingUp },
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
      />

      {/* Main Two-Column Layout */}
      <div className="flex-1 flex flex-col md:flex-row w-full max-w-[1600px] mx-auto">
        {/* Geometric Sidebar Navigation */}
        <aside className="w-full md:w-64 bg-white border-r border-slate-200 flex flex-col justify-between shrink-0 shadow-[1px_0_3px_rgba(0,0,0,0.02)]">
          <div className="py-4 space-y-1">
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
          <div className="p-4 border-t border-slate-200 bg-slate-50/70 space-y-3">
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
              onUpdateMovement={handleUpdateMovement}
              dtes={dtes}
              indicators={indicators}
              company={company}
            />
          )}

          {activeTab === 'ledger' && (
            <SeniorAccountingOrchestrator
              company={company}
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
    </div>
  );
}
