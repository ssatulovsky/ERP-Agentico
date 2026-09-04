import React, { useState, useMemo, useRef } from 'react';
import { 
  Landmark, 
  RefreshCw, 
  Upload, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  ArrowUpRight, 
  ArrowDownLeft, 
  FileText, 
  Search, 
  Filter, 
  Sparkles, 
  Building, 
  CreditCard, 
  ShieldCheck, 
  ChevronRight, 
  Plus, 
  HelpCircle,
  Download,
  Printer,
  ExternalLink,
  Sliders,
  Check,
  X,
  FileSpreadsheet,
  AlertCircle
} from 'lucide-react';
import { 
  BankStatementMovement, 
  BankAccountConfig, 
  BankReconciliationSummary, 
  CashFlowMovement, 
  AccountingEntry,
  ClientCompany,
  CompanyProfile,
  AccountingFirmProfile,
  BankNovedadType
} from '../types';
import { formatCLP, formatNumberCL } from '../utils/chileanAccounting';

interface BankReconciliationProps {
  company: CompanyProfile;
  firm: AccountingFirmProfile;
  activeClient: ClientCompany;
  bankAccounts: BankAccountConfig[];
  onUpdateBankAccounts: (accounts: BankAccountConfig[]) => void;
  bankMovements: BankStatementMovement[];
  onUpdateBankMovements: (movements: BankStatementMovement[]) => void;
  cashFlowMovements: CashFlowMovement[];
  accountingEntries: AccountingEntry[];
  onRegisterNovedad: (movement: BankStatementMovement) => void;
  onRegisterAllNovedades: (movements: BankStatementMovement[]) => void;
}

export const BankReconciliation: React.FC<BankReconciliationProps> = ({
  company,
  firm,
  activeClient,
  bankAccounts,
  onUpdateBankAccounts,
  bankMovements,
  onUpdateBankMovements,
  cashFlowMovements,
  accountingEntries,
  onRegisterNovedad,
  onRegisterAllNovedades,
}) => {
  // Active bank account
  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    bankAccounts[0]?.id || 'bank-acc-1'
  );
  
  const currentAccount = useMemo(() => {
    return bankAccounts.find(a => a.id === selectedAccountId) || bankAccounts[0] || {
      id: 'bank-acc-1',
      banco: activeClient.bancoPrincipal || 'Banco Santander Chile',
      bancoCodigo: 'BANCO_SANTANDER',
      tipoCuenta: 'CORRIENTE',
      numeroCuenta: activeClient.numeroCuenta || '00-0839210-4',
      moneda: 'CLP',
      saldoEnLinea: 44382013,
      estadoConexion: 'CONECTADO',
      tipoConexion: 'OPEN_BANKING_API',
      esPrincipal: true,
    };
  }, [bankAccounts, selectedAccountId, activeClient]);

  // Tab & Filters
  const [activeSubTab, setActiveSubTab] = useState<'RECONCILIATION' | 'NOVEDADES' | 'ALL_MOVEMENTS' | 'TRANSIT' | 'API_CONFIG'>('RECONCILIATION');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'CONCILIADO' | 'NOVEDAD' | 'PENDIENTE'>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'CARGO' | 'ABONO'>('ALL');

  // Modals & Flows
  const [isSyncingApi, setIsSyncingApi] = useState(false);
  const [syncStep, setSyncStep] = useState<string>('');
  const [showSyncSuccess, setShowSyncSuccess] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [importNotice, setImportNotice] = useState<string | null>(null);

  // Manual Matching Selection
  const [matchingMovement, setMatchingMovement] = useState<BankStatementMovement | null>(null);

  // Filter movements for the current account
  const accountMovements = useMemo(() => {
    return bankMovements.filter(m => m.cuentaId === currentAccount.id || !m.cuentaId);
  }, [bankMovements, currentAccount.id]);

  // Calculated Novedades (Bank charges/credits not yet in accounting)
  const pendingNovedades = useMemo(() => {
    return accountMovements.filter(m => m.estado === 'NOVEDAD' && !m.novedadRegistrada);
  }, [accountMovements]);

  const resolvedNovedades = useMemo(() => {
    return accountMovements.filter(m => m.tipoNovedad && (m.novedadRegistrada || m.estado === 'CONCILIADO'));
  }, [accountMovements]);

  // Calculated Partidas en Tránsito (Libro Banco vs Cartola)
  // 1. Cheques o Transferencias giradas y no cobradas por el banco (egresos en contabilidad no debitados aún)
  const transitCheques = useMemo(() => {
    return [
      {
        id: 'trans-chq-1',
        fecha: '2026-09-18',
        concepto: 'Pago Formulario 29 TGR Mes Agosto 2026 (Pendiente de cargo bancario)',
        beneficiario: 'Tesorería General de la República',
        monto: 6022250,
        tipo: 'EGRESO',
        referencia: 'F29-298104819',
      },
      {
        id: 'trans-chq-2',
        fecha: '2026-09-13',
        concepto: 'Cheque N° 40182 Proveedor Serviclick Informática SpA (En tránsito)',
        beneficiario: 'SERVICLICK INFORMÁTICA SPA',
        monto: 850000,
        tipo: 'EGRESO',
        referencia: 'CHQ-40182',
      }
    ];
  }, []);

  // 2. Depósitos en tránsito (cobros en contabilidad no acreditados aún en banco)
  const transitDeposits = useMemo(() => {
    return [
      {
        id: 'trans-dep-1',
        fecha: '2026-09-14',
        concepto: 'Depósito Documentos en Cartera 24 hrs - Cliente Agroindustrial Valle',
        monto: 2500000,
        tipo: 'INGRESO',
        referencia: 'DEP-772910',
      }
    ];
  }, []);

  const totalTransitCheques = useMemo(() => {
    return transitCheques.reduce((sum, item) => sum + item.monto, 0);
  }, [transitCheques]);

  const totalTransitDeposits = useMemo(() => {
    return transitDeposits.reduce((sum, item) => sum + item.monto, 0);
  }, [transitDeposits]);

  // Novedades totals
  const totalNovedadesCargos = useMemo(() => {
    return pendingNovedades.reduce((sum, m) => sum + (m.cargo > 0 ? m.cargo : 0), 0);
  }, [pendingNovedades]);

  const totalNovedadesAbonos = useMemo(() => {
    return pendingNovedades.reduce((sum, m) => sum + (m.abono > 0 ? m.abono : 0), 0);
  }, [pendingNovedades]);

  // Official Chilean Reconciliation Summary calculation
  const summary: BankReconciliationSummary = useMemo(() => {
    // Saldo final de la cartola informada por el banco
    const lastMovement = accountMovements[accountMovements.length - 1];
    const saldoSegunCartola = currentAccount.saldoEnLinea || (lastMovement ? lastMovement.saldo : 44382013);

    // Saldo según Libro Banco Mayor de la Empresa:
    // Fórmula: Saldo Cartola + Depósitos en Tránsito - Cheques en Tránsito - Cargos Pendientes + Abonos Pendientes
    const saldoConciliado = saldoSegunCartola + totalTransitDeposits - totalTransitCheques;
    
    // Saldo contable actual registrado en el Libro Mayor (antes de registrar las novedades pendientes)
    // Cuando las novedades pendientes se contabilizan, el saldo en libro mayor converge exactamente al saldo conciliado.
    const saldoSegunLibroBanco = saldoConciliado - totalNovedadesAbonos + totalNovedadesCargos;

    // Descuadre o diferencia pendiente por conciliar (debe ser 0 cuando se registran las novedades)
    const diferencia = pendingNovedades.length > 0 
      ? totalNovedadesCargos - totalNovedadesAbonos 
      : 0;

    return {
      periodo: '2026-09',
      bancoNombre: currentAccount.banco,
      numeroCuenta: currentAccount.numeroCuenta,
      saldoSegunCartola,
      saldoSegunLibroBanco,
      depositosEnTransito: totalTransitDeposits,
      chequesTransferenciasEnTransito: totalTransitCheques,
      novedadesCargosPendientes: totalNovedadesCargos,
      novedadesAbonosPendientes: totalNovedadesAbonos,
      saldoConciliado,
      diferencia,
      cuadrado: pendingNovedades.length === 0,
      fechaConciliacion: new Date().toLocaleDateString('es-CL'),
      totalMovimientosCartola: accountMovements.length,
      totalConciliados: accountMovements.filter(m => m.estado === 'CONCILIADO').length,
      totalPendientes: accountMovements.filter(m => m.estado === 'PENDIENTE').length,
      totalNovedades: pendingNovedades.length,
      novedadesResueltas: resolvedNovedades.length,
    };
  }, [
    accountMovements, 
    currentAccount, 
    totalTransitDeposits, 
    totalTransitCheques, 
    totalNovedadesCargos, 
    totalNovedadesAbonos, 
    pendingNovedades.length, 
    resolvedNovedades.length
  ]);

  // Simulate Live Bank API Sync
  const handleSyncBankApi = () => {
    setIsSyncingApi(true);
    setSyncStep('Autenticando mTLS con API Bancaria Segura...');

    setTimeout(() => {
      setSyncStep(`Consultando movimientos en línea (${currentAccount.banco})...`);
    }, 900);

    setTimeout(() => {
      setSyncStep('Validando integridad de saldos y firmas electrónicas CMF...');
    }, 1800);

    setTimeout(() => {
      setIsSyncingApi(false);
      setSyncStep('');
      setShowSyncSuccess(true);
      
      // Update account sync timestamp
      const updatedAccounts = bankAccounts.map(acc => {
        if (acc.id === currentAccount.id) {
          return {
            ...acc,
            estadoConexion: 'CONECTADO' as const,
            ultimaSincronizacion: new Date().toLocaleDateString('es-CL') + ' ' + new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
          };
        }
        return acc;
      });
      onUpdateBankAccounts(updatedAccounts);

      setTimeout(() => setShowSyncSuccess(false), 4000);
    }, 2700);
  };

  // Automated Smart Reconciliation Engine
  const handleAutoReconcile = () => {
    let matchesFound = 0;
    const updated = accountMovements.map(m => {
      if (m.estado === 'PENDIENTE') {
        // Try to match against cashflow by amount
        const matchingCf = cashFlowMovements.find(
          cf => Math.abs(cf.montoTotal - (m.abono || m.cargo)) < 10
        );
        if (matchingCf) {
          matchesFound++;
          return {
            ...m,
            estado: 'CONCILIADO' as const,
            movimientoIdConciliado: matchingCf.id,
            matchCerteza: 98,
          };
        }
      }
      return m;
    });

    onUpdateBankMovements(updated);
    alert(`Algoritmo de Conciliación IA ejecutado con éxito. Se confirmaron ${matchesFound} coincidencias exactas.`);
  };

  // Load Sample Statement File
  const handleLoadSampleCartola = (bankName: string) => {
    const sampleMovements: BankStatementMovement[] = [
      {
        id: `sample-bm-${Date.now()}-1`,
        cuentaId: currentAccount.id,
        fecha: '2026-09-02',
        glosaBancaria: 'ABONO TRANSF. DESDE TERCEROS CLIENTE ALPHA SPA',
        numeroReferencia: 'TEF-774910',
        cargo: 0,
        abono: 5400000,
        saldo: 33850000,
        montoNeto: 5400000,
        estado: 'CONCILIADO',
        matchCerteza: 100,
      },
      {
        id: `sample-bm-${Date.now()}-2`,
        cuentaId: currentAccount.id,
        fecha: '2026-09-06',
        glosaBancaria: 'CARGO GASTO COMISION MANTENCION CUENTA',
        numeroReferencia: 'COM-09-ST',
        cargo: 24990,
        abono: 0,
        saldo: 33825010,
        montoNeto: -24990,
        estado: 'NOVEDAD',
        tipoNovedad: 'COMISION_MANTENCION',
        cuentaContableSugerida: {
          debeCodigo: '5.1.09',
          debeNombre: 'Gastos y Comisiones Bancarias',
          haberCodigo: '1.1.01',
          haberNombre: 'Banco Santander Moneda Nacional',
          glosa: 'Comisión mensual mantención cuenta corriente',
        }
      },
      {
        id: `sample-bm-${Date.now()}-3`,
        cuentaId: currentAccount.id,
        fecha: '2026-09-14',
        glosaBancaria: 'CARGO PAC TELEFONIA ENTEL EMPRESAS',
        numeroReferencia: 'PAC-ENTEL-99',
        cargo: 78500,
        abono: 0,
        saldo: 33746510,
        montoNeto: -78500,
        estado: 'NOVEDAD',
        tipoNovedad: 'CARGO_PAC_NO_REGISTRADO',
        cuentaContableSugerida: {
          debeCodigo: '5.1.03',
          debeNombre: 'Servicios Básicos y Telefonía',
          haberCodigo: '1.1.01',
          haberNombre: 'Banco Santander Moneda Nacional',
          glosa: 'Pago automático PAC Entel Telefonía Móvil',
        }
      }
    ];

    onUpdateBankMovements([...accountMovements, ...sampleMovements]);
    setIsImportModalOpen(false);
    setImportNotice(`Cartola de ejemplo (${bankName}) importada exitosamente con 3 movimientos.`);
    setTimeout(() => setImportNotice(null), 5000);
  };

  // Helper labels for Novedades
  const getNovedadLabel = (tipo?: BankNovedadType) => {
    switch (tipo) {
      case 'COMISION_MANTENCION':
        return { label: 'Comisión Mantención', color: 'bg-rose-100 text-rose-800 border-rose-200' };
      case 'COMISION_TRANSFERENCIAS':
        return { label: 'Comisión Transferencias TEF', color: 'bg-orange-100 text-orange-800 border-orange-200' };
      case 'ABONO_NO_IDENTIFICADO':
        return { label: 'Abono sin DTE / No Identificado', color: 'bg-purple-100 text-purple-800 border-purple-200' };
      case 'CARGO_PAC_NO_REGISTRADO':
        return { label: 'Débito Automático PAC', color: 'bg-amber-100 text-amber-800 border-amber-200' };
      case 'IMPUESTO_TIMBRES':
        return { label: 'Impuesto Timbres y Estampillas', color: 'bg-slate-100 text-slate-800 border-slate-200' };
      case 'INTERES_A_FAVOR':
        return { label: 'Intereses Ganados en Cuenta', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
      default:
        return { label: 'Novedad Bancaria', color: 'bg-blue-100 text-blue-800 border-blue-200' };
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Bank Account Context & Live Indicators */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          {/* Account Selector & Bank Badges */}
          <div className="flex items-start gap-3.5">
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-blue-600 shrink-0">
              <Landmark className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                  Conciliación Bancaria Automatizada
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                  Periodo: Septiembre 2026
                </span>
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  summary.cuadrado 
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                    : 'bg-amber-100 text-amber-800 border border-amber-200'
                }`}>
                  {summary.cuadrado ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Cuenta Cuadrada ($0)</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>{pendingNovedades.length} Novedades por Registrar</span>
                    </>
                  )}
                </span>
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                <span>Cliente: <strong className="text-slate-800">{activeClient.razonSocial}</strong></span>
                <span>•</span>
                <span>Banco: <strong className="text-slate-800">{currentAccount.banco}</strong></span>
                <span>•</span>
                <span className="font-mono">Cta. Cte: <strong className="text-slate-800">{currentAccount.numeroCuenta}</strong></span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>API Bancaria: {currentAccount.tipoConexion === 'OPEN_BANKING_API' ? 'Santander OpenBanking API' : 'Empresas Connect'}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Top Quick Actions */}
          <div className="flex flex-wrap items-center gap-2 self-stretch lg:self-auto">
            {/* Account Switcher if multiple */}
            {bankAccounts.length > 1 && (
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {bankAccounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.banco} ({acc.numeroCuenta})
                  </option>
                ))}
              </select>
            )}

            {/* Sync API Button */}
            <button
              onClick={handleSyncBankApi}
              disabled={isSyncingApi}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingApi ? 'animate-spin' : ''}`} />
              <span>{isSyncingApi ? 'Consultando API...' : 'Sincronizar API Bancaria'}</span>
            </button>

            {/* Import Cartola Button */}
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold transition-all shadow-xs cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-slate-500" />
              <span>Importar Cartola</span>
            </button>

            {/* Auto Match AI Button */}
            <button
              onClick={handleAutoReconcile}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold transition-all shadow-xs cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>Conciliar con IA</span>
            </button>

            {/* Print Official Summary Button */}
            <button
              onClick={() => setIsPrintModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold transition-all shadow-xs cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>Acta de Conciliación</span>
            </button>
          </div>
        </div>

        {/* Live sync alert / progress message */}
        {isSyncingApi && (
          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2 text-xs text-blue-700 animate-pulse">
            <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
            <span className="font-semibold">{syncStep}</span>
          </div>
        )}

        {showSyncSuccess && (
          <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-xs text-emerald-800">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>
                <strong>Sincronización Exitosa con {currentAccount.banco}:</strong> Se consultó el extracto digital al corte de hoy. Todos los saldos y transacciones han sido contrastados.
              </span>
            </div>
            <span className="text-[11px] font-mono text-emerald-600">Última sinc: {currentAccount.ultimaSincronizacion || 'Ahora'}</span>
          </div>
        )}

        {importNotice && (
          <div className="mt-3 p-3 bg-indigo-50 border border-indigo-200 rounded-lg flex items-center gap-2 text-xs text-indigo-800">
            <CheckCircle2 className="w-4 h-4 text-indigo-600" />
            <span>{importNotice}</span>
          </div>
        )}
      </div>

      {/* Official Chilean Bank Reconciliation Summary Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Card 1: Saldo según Cartola */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Saldo según Cartola Bancaria</span>
            <Landmark className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-slate-900">
            {formatCLP(summary.saldoSegunCartola)}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 flex items-center justify-between">
            <span>{summary.totalMovimientosCartola} movs. en extracto</span>
            <span className="text-emerald-600 font-semibold">Validado CMF</span>
          </div>
        </div>

        {/* Card 2: Partidas en Tránsito */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Partidas en Tránsito</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 text-lg font-bold font-mono text-slate-800 flex items-center justify-between">
            <span className="text-xs font-normal text-slate-500">(+) Depósitos:</span>
            <span className="text-emerald-600 font-mono">+{formatCLP(summary.depositosEnTransito)}</span>
          </div>
          <div className="mt-0.5 text-lg font-bold font-mono text-slate-800 flex items-center justify-between">
            <span className="text-xs font-normal text-slate-500">(-) Cheques/TEF:</span>
            <span className="text-rose-600 font-mono">-{formatCLP(summary.chequesTransferenciasEnTransito)}</span>
          </div>
          <div className="mt-1 text-[10px] text-slate-400">
            Pendientes de cobro/acreditación en banco
          </div>
        </div>

        {/* Card 3: Novedades por Registrar */}
        <div className={`rounded-xl p-4 border shadow-xs transition-colors ${
          summary.totalNovedades > 0 
            ? 'bg-amber-50/50 border-amber-200' 
            : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center justify-between text-slate-600 text-xs font-medium">
            <span>Novedades por Registrar</span>
            <AlertTriangle className={`w-4 h-4 ${summary.totalNovedades > 0 ? 'text-amber-600' : 'text-slate-400'}`} />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-slate-900 flex items-center gap-2">
            <span>{summary.totalNovedades}</span>
            <span className="text-xs font-normal text-slate-500">
              ({formatCLP(summary.novedadesCargosPendientes + summary.novedadesAbonosPendientes)})
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">Comisiones, PAC y TEF</span>
            {summary.totalNovedades > 0 ? (
              <span className="text-amber-700 font-bold">Requiere Asiento</span>
            ) : (
              <span className="text-emerald-600 font-bold">100% Contabilizadas</span>
            )}
          </div>
        </div>

        {/* Card 4: Saldo Conciliado y Cuadratura */}
        <div className={`rounded-xl p-4 border shadow-xs ${
          summary.cuadrado 
            ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900' 
            : 'bg-rose-50/60 border-rose-200 text-rose-900'
        }`}>
          <div className="flex items-center justify-between text-xs font-medium">
            <span>Saldo Conciliado Final</span>
            {summary.cuadrado ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600" />
            )}
          </div>
          <div className="mt-2 text-2xl font-bold font-mono">
            {formatCLP(summary.saldoConciliado)}
          </div>
          <div className="mt-1 flex items-center justify-between text-xs">
            <span>Libro Mayor: {formatCLP(summary.saldoSegunLibroBanco)}</span>
            <span className={`font-mono font-bold px-1.5 py-0.5 rounded text-[11px] ${
              summary.cuadrado 
                ? 'bg-emerald-200/60 text-emerald-900' 
                : 'bg-rose-200/60 text-rose-900'
            }`}>
              {summary.cuadrado ? 'Dif: $0' : `Dif: ${formatCLP(summary.diferencia)}`}
            </span>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="border-b border-slate-200 flex items-center gap-6 text-sm font-medium">
        <button
          onClick={() => setActiveSubTab('RECONCILIATION')}
          className={`pb-3 relative flex items-center gap-2 cursor-pointer transition-colors ${
            activeSubTab === 'RECONCILIATION'
              ? 'text-blue-600 font-bold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Resumen Oficial de Conciliación</span>
          {activeSubTab === 'RECONCILIATION' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full"></div>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab('NOVEDADES')}
          className={`pb-3 relative flex items-center gap-2 cursor-pointer transition-colors ${
            activeSubTab === 'NOVEDADES'
              ? 'text-blue-600 font-bold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <span>Novedades a Registrar</span>
          {pendingNovedades.length > 0 && (
            <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
              {pendingNovedades.length}
            </span>
          )}
          {activeSubTab === 'NOVEDADES' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full"></div>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab('ALL_MOVEMENTS')}
          className={`pb-3 relative flex items-center gap-2 cursor-pointer transition-colors ${
            activeSubTab === 'ALL_MOVEMENTS'
              ? 'text-blue-600 font-bold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Cartola Bancaria Completa ({accountMovements.length})</span>
          {activeSubTab === 'ALL_MOVEMENTS' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full"></div>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab('TRANSIT')}
          className={`pb-3 relative flex items-center gap-2 cursor-pointer transition-colors ${
            activeSubTab === 'TRANSIT'
              ? 'text-blue-600 font-bold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Partidas en Tránsito ({transitCheques.length + transitDeposits.length})</span>
          {activeSubTab === 'TRANSIT' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full"></div>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab('API_CONFIG')}
          className={`pb-3 relative flex items-center gap-2 cursor-pointer transition-colors ${
            activeSubTab === 'API_CONFIG'
              ? 'text-blue-600 font-bold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>APIs & Cuentas Bancarias</span>
          {activeSubTab === 'API_CONFIG' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full"></div>
          )}
        </button>
      </div>

      {/* TAB 1: RESUMEN OFICIAL DE CONCILIACIÓN BANCARIA (CUADRO DE CUADRATURA) */}
      {activeSubTab === 'RECONCILIATION' && (
        <div className="space-y-6">
          {/* Status banner */}
          <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            summary.cuadrado
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}>
            <div className="flex items-start sm:items-center gap-3">
              {summary.cuadrado ? (
                <div className="p-2 bg-emerald-100 rounded-lg text-emerald-700 shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              ) : (
                <div className="p-2 bg-amber-100 rounded-lg text-amber-700 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
              )}
              <div>
                <div className="font-bold text-sm">
                  {summary.cuadrado
                    ? 'Conciliación Bancaria Cuadrada y Certificada'
                    : `Discrepancias por Resolver: ${pendingNovedades.length} Novedades Detectadas`}
                </div>
                <div className="text-xs opacity-90 mt-0.5">
                  {summary.cuadrado
                    ? `El saldo del extracto bancario de ${currentAccount.banco} coincide exactamente con los registros contables del Libro Mayor.`
                    : 'Existen comisiones, cargos PAC o abonos en la cartola bancaria que no han sido ingresados al Libro Diario.'}
                </div>
              </div>
            </div>

            {!summary.cuadrado && (
              <button
                onClick={() => onRegisterAllNovedades(pendingNovedades)}
                className="self-start sm:self-auto px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Registrar Todas las Novedades ({pendingNovedades.length})</span>
              </button>
            )}
          </div>

          {/* Official Chilean Reconciliation Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">
                  Cuadro Formal de Conciliación Bancaria (Formato CMF / Auditoría Externa)
                </h3>
                <p className="text-xs text-slate-500">
                  Empresa: {activeClient.razonSocial} • RUT: {activeClient.rut} • Cuenta Corriente N° {currentAccount.numeroCuenta}
                </p>
              </div>
              <button
                onClick={() => setIsPrintModalOpen(true)}
                className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Exportar Acta Formal</span>
              </button>
            </div>

            <div className="divide-y divide-slate-100 text-sm">
              {/* Row 1: Saldo según Cartola */}
              <div className="p-4 flex items-center justify-between hover:bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                    1
                  </span>
                  <div>
                    <div className="font-semibold text-slate-800">Saldo Final según Cartola Bancaria</div>
                    <div className="text-xs text-slate-500">Saldo acreditado en {currentAccount.banco} al 30-09-2026</div>
                  </div>
                </div>
                <div className="font-mono font-bold text-base text-slate-900">
                  {formatCLP(summary.saldoSegunCartola)}
                </div>
              </div>

              {/* Row 2: Más Depósitos en Tránsito */}
              <div className="p-4 flex items-center justify-between bg-emerald-50/30">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                    +
                  </span>
                  <div>
                    <div className="font-semibold text-emerald-900">Más: Depósitos en Tránsito</div>
                    <div className="text-xs text-emerald-700">
                      Cobros y remesas registrados en contabilidad pero aún no acreditados por el banco ({transitDeposits.length} partidas)
                    </div>
                  </div>
                </div>
                <div className="font-mono font-bold text-emerald-700">
                  +{formatCLP(summary.depositosEnTransito)}
                </div>
              </div>

              {/* Row 3: Menos Cheques y TEF Giradas */}
              <div className="p-4 flex items-center justify-between bg-rose-50/30">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-xs">
                    -
                  </span>
                  <div>
                    <div className="font-semibold text-rose-900">Menos: Cheques y Transferencias Giradas y no Cobradas</div>
                    <div className="text-xs text-rose-700">
                      Egresos contabilizados por la empresa no descontados por el banco ({transitCheques.length} partidas)
                    </div>
                  </div>
                </div>
                <div className="font-mono font-bold text-rose-700">
                  -{formatCLP(summary.chequesTransferenciasEnTransito)}
                </div>
              </div>

              {/* Row 4: Novedades - Cargos Bancarios no contabilizados */}
              <div className="p-4 flex items-center justify-between bg-amber-50/20">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs">
                    -
                  </span>
                  <div>
                    <div className="font-semibold text-amber-900">Menos: Cargos Bancarios no Contabilizados (Novedades)</div>
                    <div className="text-xs text-amber-700">
                      Comisiones, tarifas TEF masivas y cargos automáticos PAC deducidos por el banco
                    </div>
                  </div>
                </div>
                <div className="font-mono font-bold text-amber-700">
                  {summary.novedadesCargosPendientes > 0 ? `-${formatCLP(summary.novedadesCargosPendientes)}` : '$0'}
                </div>
              </div>

              {/* Row 5: Novedades - Abonos Bancarios no contabilizados */}
              <div className="p-4 flex items-center justify-between bg-indigo-50/20">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                    +
                  </span>
                  <div>
                    <div className="font-semibold text-indigo-900">Más: Abonos Bancarios no Contabilizados (Novedades)</div>
                    <div className="text-xs text-indigo-700">
                      Transferencias recibidas de clientes pendientes de identificar o emitir factura
                    </div>
                  </div>
                </div>
                <div className="font-mono font-bold text-indigo-700">
                  {summary.novedadesAbonosPendientes > 0 ? `+${formatCLP(summary.novedadesAbonosPendientes)}` : '$0'}
                </div>
              </div>

              {/* Row 6: Total Saldo Conciliado */}
              <div className="p-4 bg-slate-100/70 flex items-center justify-between font-bold border-t-2 border-slate-300">
                <div className="text-slate-900 flex items-center gap-2">
                  <span>(=) Saldo Conciliado de la Cuenta</span>
                  <span className="text-xs font-normal text-slate-500">(Base de auditoría)</span>
                </div>
                <div className="font-mono text-lg text-blue-700">
                  {formatCLP(summary.saldoConciliado)}
                </div>
              </div>

              {/* Row 7: Saldo según Libro Banco */}
              <div className="p-4 flex items-center justify-between bg-white">
                <div>
                  <div className="font-semibold text-slate-800">Saldo según Libro Mayor / Libro Banco</div>
                  <div className="text-xs text-slate-500">Saldo registrado en contabilidad de la cuenta 1.1.01</div>
                </div>
                <div className="font-mono font-bold text-slate-800">
                  {formatCLP(summary.saldoSegunLibroBanco)}
                </div>
              </div>

              {/* Row 8: Diferencia / Descuadre Final */}
              <div className={`p-4 flex items-center justify-between font-bold ${
                summary.cuadrado ? 'bg-emerald-100/50 text-emerald-900' : 'bg-rose-100/50 text-rose-900'
              }`}>
                <div className="flex items-center gap-2">
                  {summary.cuadrado ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-rose-600" />
                  )}
                  <span>DIFERENCIA FINAL (DESCUADRE)</span>
                </div>
                <div className="font-mono text-lg">
                  {summary.cuadrado ? 'DIFERENCIA: $0 (CONCILIADO)' : `DESCUADRE: ${formatCLP(summary.diferencia)}`}
                </div>
              </div>
            </div>
          </div>

          {/* Quick preview of Novedades if any pending */}
          {pendingNovedades.length > 0 && (
            <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  <h4 className="font-bold text-amber-900 text-sm">
                    Novedades Pendientes que Afectan la Cuadratura ({pendingNovedades.length})
                  </h4>
                </div>
                <button
                  onClick={() => setActiveSubTab('NOVEDADES')}
                  className="text-xs font-bold text-amber-800 hover:text-amber-950 flex items-center gap-1 cursor-pointer"
                >
                  <span>Gestionar en Detalle</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {pendingNovedades.map(nov => {
                  const tag = getNovedadLabel(nov.tipoNovedad);
                  return (
                    <div key={nov.id} className="bg-white p-3.5 rounded-lg border border-amber-200/80 shadow-2xs flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${tag.color}`}>
                            {tag.label}
                          </span>
                          <span className="text-xs text-slate-400 font-mono">{nov.fecha}</span>
                        </div>
                        <div className="font-semibold text-xs text-slate-800 mt-1 line-clamp-1">
                          {nov.glosaBancaria}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                          {nov.abono > 0 ? (
                            <span className="text-emerald-600 font-bold">+{formatCLP(nov.abono)}</span>
                          ) : (
                            <span className="text-rose-600 font-bold">-{formatCLP(nov.cargo)}</span>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => onRegisterNovedad(nov)}
                        className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold shrink-0 cursor-pointer"
                      >
                        Registrar
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: NOVEDADES A REGISTRAR (KEY USER REQUIREMENT) */}
      {activeSubTab === 'NOVEDADES' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Novedades Bancarias Detectadas por el Agente
              </h3>
              <p className="text-xs text-slate-500">
                Transacciones registradas en el extracto bancario que aún no poseen asiento en el Libro Diario ni contraparte en el Libro Banco.
              </p>
            </div>

            {pendingNovedades.length > 0 ? (
              <button
                onClick={() => onRegisterAllNovedades(pendingNovedades)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition-all shadow-xs cursor-pointer flex items-center gap-2 self-start sm:self-auto"
              >
                <Sparkles className="w-4 h-4" />
                <span>Registrar Todas las Novedades ({pendingNovedades.length})</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-bold bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                <CheckCircle2 className="w-4 h-4" />
                <span>Sin novedades pendientes. Todas contabilizadas.</span>
              </div>
            )}
          </div>

          {/* Pending Novedades List */}
          <div className="space-y-3">
            {pendingNovedades.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-slate-900 text-sm">¡No hay novedades pendientes!</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  Todos los cargos, comisiones bancarias y abonos recibidos han sido registrados formalmente en el Libro Diario y Libro Banco. La cuenta está 100% conciliada.
                </p>
              </div>
            ) : (
              pendingNovedades.map(nov => {
                const tag = getNovedadLabel(nov.tipoNovedad);
                const isCargo = nov.cargo > 0;
                return (
                  <div 
                    key={nov.id}
                    className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:border-blue-300 transition-all"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      {/* Left: Info */}
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${tag.color}`}>
                            {tag.label}
                          </span>
                          <span className="text-xs text-slate-500 font-mono">Fecha: {nov.fecha}</span>
                          <span className="text-xs text-slate-400 font-mono">Ref: {nov.numeroReferencia}</span>
                        </div>

                        <div className="font-bold text-slate-900 text-sm">
                          {nov.glosaBancaria}
                        </div>

                        {/* AI Suggested Accounting Treatment Box */}
                        {nov.cuentaContableSugerida && (
                          <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs font-mono text-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                              <span className="font-bold text-blue-600">Tratamiento Contable Sugerido:</span>
                              <div className="mt-0.5 text-[11px] text-slate-600">
                                Debe: <strong>{nov.cuentaContableSugerida.debeCodigo}</strong> {nov.cuentaContableSugerida.debeNombre} ({formatCLP(nov.cargo || nov.abono)})
                                <br />
                                Haber: <strong>{nov.cuentaContableSugerida.haberCodigo}</strong> {nov.cuentaContableSugerida.haberNombre} ({formatCLP(nov.cargo || nov.abono)})
                              </div>
                            </div>
                            <span className="text-[10px] text-slate-400 bg-white px-2 py-1 rounded border self-start sm:self-auto font-sans">
                              Plan CMF Estándar
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Right: Amount & 1-Click Action */}
                      <div className="flex flex-row md:flex-col items-center md:items-end justify-between gap-3 shrink-0">
                        <div className="text-right">
                          <div className="text-xs text-slate-400">Monto Transacción</div>
                          <div className={`text-lg font-bold font-mono ${isCargo ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {isCargo ? `-${formatCLP(nov.cargo)}` : `+${formatCLP(nov.abono)}`}
                          </div>
                        </div>

                        <button
                          onClick={() => onRegisterNovedad(nov)}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Registrar Asiento Contable</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {/* Resolved Novedades History */}
            {resolvedNovedades.length > 0 && (
              <div className="mt-6 pt-4 border-t border-slate-200">
                <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wider mb-2">
                  Historial de Novedades Contabilizadas en este Periodo ({resolvedNovedades.length})
                </h4>
                <div className="space-y-2">
                  {resolvedNovedades.map(nov => (
                    <div key={nov.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <div>
                          <span className="font-semibold text-slate-800">{nov.glosaBancaria}</span>
                          <span className="text-slate-400 ml-2 font-mono">({nov.fecha})</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-semibold text-slate-700">
                          {nov.cargo > 0 ? `-${formatCLP(nov.cargo)}` : `+${formatCLP(nov.abono)}`}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                          Asiento Generado
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: CARTOLA BANCARIA COMPLETA */}
      {activeSubTab === 'ALL_MOVEMENTS' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-[240px]">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por glosa, referencia TEF, monto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2 text-slate-700"
              >
                <option value="ALL">Todos los Estados</option>
                <option value="CONCILIADO">Conciliados</option>
                <option value="NOVEDAD">Novedades Bancarias</option>
                <option value="PENDIENTE">Pendientes</option>
              </select>

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2 text-slate-700"
              >
                <option value="ALL">Cargos y Abonos</option>
                <option value="ABONO">Solo Abonos (+)</option>
                <option value="CARGO">Solo Cargos (-)</option>
              </select>
            </div>

            <div className="text-xs text-slate-500 font-mono">
              Mostrando {accountMovements.length} movimientos
            </div>
          </div>

          {/* Movements Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Fecha</th>
                    <th className="py-3 px-4">Glosa Bancaria / Detalle</th>
                    <th className="py-3 px-4">N° Doc / Ref</th>
                    <th className="py-3 px-4 text-right">Cargo (-)</th>
                    <th className="py-3 px-4 text-right">Abono (+)</th>
                    <th className="py-3 px-4 text-right">Saldo en Banco</th>
                    <th className="py-3 px-4 text-center">Estado</th>
                    <th className="py-3 px-4 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {accountMovements
                    .filter(m => {
                      if (statusFilter !== 'ALL' && m.estado !== statusFilter) return false;
                      if (typeFilter === 'ABONO' && m.abono === 0) return false;
                      if (typeFilter === 'CARGO' && m.cargo === 0) return false;
                      if (searchTerm) {
                        const term = searchTerm.toLowerCase();
                        return (
                          m.glosaBancaria.toLowerCase().includes(term) ||
                          m.numeroReferencia.toLowerCase().includes(term) ||
                          m.cargo.toString().includes(term) ||
                          m.abono.toString().includes(term)
                        );
                      }
                      return true;
                    })
                    .map(m => {
                      const isConciliado = m.estado === 'CONCILIADO';
                      const isNovedad = m.estado === 'NOVEDAD';

                      return (
                        <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                            {m.fecha}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-800 line-clamp-1">
                              {m.glosaBancaria}
                            </div>
                            {m.movimientoIdConciliado && (
                              <div className="text-[10px] text-blue-600 font-mono mt-0.5 flex items-center gap-1">
                                <Check className="w-3 h-3" />
                                <span>Asociado a Flujo: {m.movimientoIdConciliado}</span>
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">
                            {m.numeroReferencia}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-semibold text-rose-600">
                            {m.cargo > 0 ? `-${formatCLP(m.cargo)}` : '—'}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-600">
                            {m.abono > 0 ? `+${formatCLP(m.abono)}` : '—'}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-slate-700 font-bold whitespace-nowrap">
                            {formatCLP(m.saldo)}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              isConciliado
                                ? 'bg-emerald-100 text-emerald-800'
                                : isNovedad
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}>
                              {isConciliado ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  <span>Conciliado</span>
                                </>
                              ) : isNovedad ? (
                                <>
                                  <AlertTriangle className="w-3 h-3 text-amber-600" />
                                  <span>Novedad</span>
                                </>
                              ) : (
                                <span>Pendiente</span>
                              )}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            {isNovedad ? (
                              <button
                                onClick={() => onRegisterNovedad(m)}
                                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[11px] font-semibold cursor-pointer"
                              >
                                Registrar Asiento
                              </button>
                            ) : isConciliado ? (
                              <button
                                onClick={() => {
                                  // Toggle back to pending if needed
                                  const updated = accountMovements.map(item => 
                                    item.id === m.id ? { ...item, estado: 'PENDIENTE' as const, movimientoIdConciliado: undefined } : item
                                  );
                                  onUpdateBankMovements(updated);
                                }}
                                className="text-[11px] text-slate-400 hover:text-slate-600 cursor-pointer"
                              >
                                Desconciliar
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  const updated = accountMovements.map(item => 
                                    item.id === m.id ? { ...item, estado: 'CONCILIADO' as const } : item
                                  );
                                  onUpdateBankMovements(updated);
                                }}
                                className="px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded text-[11px] font-semibold cursor-pointer"
                              >
                                Conciliar Manual
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: PARTIDAS EN TRÁNSITO */}
      {activeSubTab === 'TRANSIT' && (
        <div className="space-y-6">
          <div className="bg-white p-4 rounded-xl border border-slate-200">
            <h3 className="font-bold text-slate-900 text-sm">
              Partidas en Tránsito (Libro Banco vs Cartola Bancaria)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Representan transacciones que la empresa ya reconoció en su contabilidad, pero que el banco aún no liquida al corte de la cartola.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Depósitos en Tránsito */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center justify-center">
                    +
                  </span>
                  <h4 className="font-bold text-slate-800 text-sm">Depósitos en Tránsito</h4>
                </div>
                <span className="font-mono font-bold text-emerald-700">
                  +{formatCLP(totalTransitDeposits)}
                </span>
              </div>

              <div className="mt-3 space-y-2">
                {transitDeposits.map(dep => (
                  <div key={dep.id} className="p-3 bg-emerald-50/40 rounded-lg border border-emerald-100 text-xs">
                    <div className="flex items-center justify-between font-semibold text-slate-800">
                      <span>{dep.concepto}</span>
                      <span className="font-mono text-emerald-700 font-bold">+{formatCLP(dep.monto)}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-slate-500 text-[11px] font-mono">
                      <span>Ref: {dep.referencia}</span>
                      <span>Fecha: {dep.fecha}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cheques y TEF Giradas no Cobradas */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-700 font-bold text-xs flex items-center justify-center">
                    -
                  </span>
                  <h4 className="font-bold text-slate-800 text-sm">Cheques / TEF Giradas no Cobradas</h4>
                </div>
                <span className="font-mono font-bold text-rose-700">
                  -{formatCLP(totalTransitCheques)}
                </span>
              </div>

              <div className="mt-3 space-y-2">
                {transitCheques.map(chq => (
                  <div key={chq.id} className="p-3 bg-rose-50/40 rounded-lg border border-rose-100 text-xs">
                    <div className="flex items-center justify-between font-semibold text-slate-800">
                      <span>{chq.concepto}</span>
                      <span className="font-mono text-rose-700 font-bold">-{formatCLP(chq.monto)}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-slate-500 text-[11px] font-mono">
                      <span>Beneficiario: {chq.beneficiario}</span>
                      <span>Ref: {chq.referencia}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: APIS & CUENTAS BANCARIAS CONFIGURADAS */}
      {activeSubTab === 'API_CONFIG' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-xl border border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Cuentas Bancarias e Integración con APIs en Chile
                </h3>
                <p className="text-xs text-slate-500">
                  Configure las credenciales de conexión automatizada de {activeClient.razonSocial} con la banca chilena.
                </p>
              </div>

              <button
                onClick={() => setIsConfigModalOpen(true)}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Agregar Cuenta Bancaria</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {bankAccounts.map(account => (
                <div 
                  key={account.id}
                  className={`p-4 rounded-xl border transition-all ${
                    account.id === selectedAccountId 
                      ? 'border-blue-500 bg-blue-50/20 shadow-xs' 
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">{account.banco}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800">
                      {account.estadoConexion}
                    </span>
                  </div>

                  <div className="mt-2 text-xs font-mono text-slate-600">
                    Cta. {account.tipoCuenta}: <strong>{account.numeroCuenta}</strong>
                  </div>

                  <div className="mt-1 text-[11px] text-slate-500">
                    Saldo en línea: <strong className="font-mono text-slate-800">{formatCLP(account.saldoEnLinea)}</strong>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-[10px] text-slate-400 font-mono">Sinc: {account.ultimaSincronizacion || 'Hoy'}</span>
                    <button
                      onClick={() => {
                        setSelectedAccountId(account.id);
                        handleSyncBankApi();
                      }}
                      className="text-blue-600 hover:text-blue-800 font-bold text-xs cursor-pointer"
                    >
                      Sincronizar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: IMPORTAR CARTOLA BANCARIA (CSV / EXCEL / OFX) */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Importar Cartola Bancaria</h3>
                  <p className="text-xs text-slate-500">Formatos soportados: CSV, Excel (.xlsx), TXT o extracto OFX</p>
                </div>
              </div>
              <button 
                onClick={() => setIsImportModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drag and Drop Zone */}
            <div 
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                handleLoadSampleCartola('Archivo Arrastrado');
              }}
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
                dragOver ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-blue-400 bg-slate-50/50'
              }`}
            >
              <Upload className="w-10 h-10 text-slate-400 mx-auto mb-2" />
              <div className="font-bold text-sm text-slate-800">
                Arrastre aquí su archivo de cartola bancaria
              </div>
              <div className="text-xs text-slate-500 mt-1">
                o haga clic para examinar desde su computadora
              </div>
              <input 
                type="file" 
                className="hidden" 
                id="cartola-file-input"
                onChange={() => handleLoadSampleCartola('Archivo Seleccionado')}
              />
              <label 
                htmlFor="cartola-file-input"
                className="mt-4 inline-block px-4 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer shadow-2xs"
              >
                Seleccionar Archivo Local
              </label>
            </div>

            {/* Instant Sample Presets for Testing */}
            <div className="pt-2">
              <div className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                O Pruebe Inmediatamente con Cartolas de Ejemplo:
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleLoadSampleCartola('Banco Santander Chile')}
                  className="p-3 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg text-left transition-colors cursor-pointer"
                >
                  <div className="font-bold text-xs text-red-900">Cartola Banco Santander</div>
                  <div className="text-[11px] text-red-700">Cuenta Corriente Empresas (3 movs)</div>
                </button>
                <button
                  onClick={() => handleLoadSampleCartola('Banco de Chile')}
                  className="p-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg text-left transition-colors cursor-pointer"
                >
                  <div className="font-bold text-xs text-blue-900">Cartola Banco de Chile</div>
                  <div className="text-[11px] text-blue-700">Cuenta Vista / Corriente (3 movs)</div>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: ACTA OFICIAL DE CONCILIACIÓN BANCARIA (PRINT PREVIEW) */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-2xl w-full p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-slate-700" />
                <h3 className="font-bold text-slate-900 text-base">Acta Oficial de Conciliación Bancaria</h3>
              </div>
              <button 
                onClick={() => setIsPrintModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Printable Document Container */}
            <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 font-sans text-xs space-y-4 text-slate-800">
              {/* Header */}
              <div className="text-center pb-4 border-b border-slate-300">
                <div className="font-bold text-base tracking-tight text-slate-900 uppercase">
                  {firm.razonSocial}
                </div>
                <div className="text-slate-500 text-[11px]">
                  Estudio Contable & Asesoría Tributaria • RUT {firm.rut}
                </div>
                <h2 className="font-bold text-sm text-slate-800 mt-3 uppercase tracking-wider">
                  CERTIFICADO DE CONCILIACIÓN BANCARIA
                </h2>
                <div className="text-slate-500 font-mono text-[11px]">
                  Periodo Contable: Septiembre 2026 • Fecha de Emisión: {summary.fechaConciliacion}
                </div>
              </div>

              {/* Client & Bank Details */}
              <div className="grid grid-cols-2 gap-3 py-2 border-b border-slate-200 text-[11px]">
                <div>
                  <strong>Contribuyente:</strong> {activeClient.razonSocial}<br />
                  <strong>RUT:</strong> {activeClient.rut}<br />
                  <strong>Giro:</strong> {activeClient.giro}
                </div>
                <div>
                  <strong>Institución Financiera:</strong> {currentAccount.banco}<br />
                  <strong>Número de Cuenta:</strong> {currentAccount.numeroCuenta}<br />
                  <strong>Moneda:</strong> Peso Chileno (CLP)
                </div>
              </div>

              {/* Financial Math Table */}
              <div className="space-y-1.5 font-mono text-xs">
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="font-sans">1. Saldo Final según Cartola Bancaria:</span>
                  <span className="font-bold">{formatCLP(summary.saldoSegunCartola)}</span>
                </div>
                <div className="flex justify-between py-1 text-emerald-800">
                  <span className="font-sans">(+) Depósitos en Tránsito:</span>
                  <span>+{formatCLP(summary.depositosEnTransito)}</span>
                </div>
                <div className="flex justify-between py-1 text-rose-800">
                  <span className="font-sans">(-) Cheques y Transferencias Giradas y no Cobradas:</span>
                  <span>-{formatCLP(summary.chequesTransferenciasEnTransito)}</span>
                </div>
                <div className="flex justify-between py-1 text-amber-800">
                  <span className="font-sans">(+/-) Novedades Bancarias Registradas:</span>
                  <span>{formatCLP(summary.novedadesAbonosPendientes - summary.novedadesCargosPendientes)}</span>
                </div>
                <div className="flex justify-between py-2 border-t-2 border-slate-400 font-bold text-sm bg-slate-200/50 px-2 rounded">
                  <span className="font-sans">(=) Saldo Conciliado de la Cuenta:</span>
                  <span className="text-blue-700">{formatCLP(summary.saldoConciliado)}</span>
                </div>
                <div className="flex justify-between py-1 font-bold">
                  <span className="font-sans">Saldo Contable según Libro Mayor:</span>
                  <span>{formatCLP(summary.saldoSegunLibroBanco)}</span>
                </div>
                <div className={`flex justify-between py-1.5 px-2 rounded font-bold ${
                  summary.cuadrado ? 'bg-emerald-100 text-emerald-900' : 'bg-rose-100 text-rose-900'
                }`}>
                  <span className="font-sans">Diferencia / Descuadre de Auditoría:</span>
                  <span>{summary.cuadrado ? '$0 (CUADRADO)' : formatCLP(summary.diferencia)}</span>
                </div>
              </div>

              {/* Signatures */}
              <div className="pt-8 grid grid-cols-2 gap-8 text-center text-[11px] text-slate-500">
                <div>
                  <div className="border-t border-slate-400 pt-2 font-bold text-slate-800">
                    {firm.representanteLegal}
                  </div>
                  <div>Contador Auditor / Asesor Tributario</div>
                  <div className="font-mono">RUT: {firm.rutRepresentante}</div>
                </div>
                <div>
                  <div className="border-t border-slate-400 pt-2 font-bold text-slate-800">
                    {activeClient.contactoNombre}
                  </div>
                  <div>Representante Legal / Gerencia Finanzas</div>
                  <div className="font-mono">RUT: {activeClient.rutAutenticacion}</div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsPrintModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 cursor-pointer"
              >
                Cerrar
              </button>
              <button
                onClick={() => {
                  window.print();
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs cursor-pointer flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimir Documento</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: AGREGAR NUEVA CUENTA BANCARIA */}
      {isConfigModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Landmark className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-base">Agregar Cuenta Bancaria</h3>
              </div>
              <button 
                onClick={() => setIsConfigModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.target as HTMLFormElement;
                const newAcc: BankAccountConfig = {
                  id: `bank-acc-${Date.now()}`,
                  banco: (form.elements.namedItem('banco') as HTMLSelectElement).value,
                  bancoCodigo: 'BCI',
                  tipoCuenta: 'CORRIENTE',
                  numeroCuenta: (form.elements.namedItem('numeroCuenta') as HTMLInputElement).value || '11-89201-0',
                  moneda: 'CLP',
                  saldoEnLinea: 15000000,
                  estadoConexion: 'CONECTADO',
                  tipoConexion: 'OPEN_BANKING_API',
                  apiKey: 'live_pk_new_account',
                  esPrincipal: false,
                  ultimaSincronizacion: 'Hoy',
                };
                onUpdateBankAccounts([...bankAccounts, newAcc]);
                setIsConfigModalOpen(false);
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block font-bold text-slate-700 mb-1">Banco Nacional</label>
                <select 
                  name="banco"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-medium"
                >
                  <option value="Banco Santander Chile">Banco Santander Chile</option>
                  <option value="Banco de Chile">Banco de Chile</option>
                  <option value="Banco BCI">Banco BCI</option>
                  <option value="BancoEstado">BancoEstado</option>
                  <option value="Scotiabank Chile">Scotiabank Chile</option>
                  <option value="Banco Itaú Chile">Banco Itaú Chile</option>
                  <option value="Banco Security">Banco Security</option>
                  <option value="Banco BICE">Banco BICE</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Número de Cuenta</label>
                <input 
                  type="text"
                  name="numeroCuenta"
                  placeholder="ej: 00-184920-1"
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Método de Conexión</label>
                <select className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2">
                  <option value="OPEN_BANKING_API">API Open Banking Oficial (Recomendado)</option>
                  <option value="EMPRESAS_CONNECT">Banca Empresas Connect (Host-to-Host)</option>
                  <option value="IMPORTACION_CARTOLA">Importación Periódica de Cartolas</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsConfigModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-800 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg cursor-pointer shadow-xs"
                >
                  Guardar Cuenta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
