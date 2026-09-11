import React, { useState } from 'react';
import { 
  Plus, 
  Receipt, 
  UploadCloud, 
  FileText, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Search, 
  FileCode, 
  Copy, 
  Check, 
  ArrowUpRight, 
  ArrowDownLeft, 
  X,
  FileSpreadsheet,
  Zap,
  TrendingUp,
  RefreshCw,
  Bot,
  Sparkles,
  Split,
  Trash2,
  Download
} from 'lucide-react';
import { DteDocument, DteType, AccountingEntry, CompanyProfile, ClientCompany } from '../types';
import { 
  formatCLP, 
  formatNumberCL, 
  formatNormalizedAccountingEntry,
  createSalesDteEntry,
  createPurchaseDteEntry,
  createHonorariosEntry
} from '../utils/chileanAccounting';
import { downloadRcvCsv, downloadRcvExcel, downloadRcvPdf } from '../utils/reportGenerators';
import { SiiIntegrationModal } from './SiiIntegrationModal';
import { SiiAutonomousEngineModal } from './SiiAutonomousEngineModal';

interface DteManagerProps {
  dtes: DteDocument[];
  onAddDte: (dte: DteDocument) => void;
  onAddMultipleDtes?: (dtes: DteDocument[], autoSyncCashFlow: boolean) => void;
  onUpdateDte: (dte: DteDocument) => void;
  onAddEntry: (entry: AccountingEntry) => void;
  company?: CompanyProfile | ClientCompany;
  onSyncPendingToCashFlow?: () => void;
  onClearAllDtes?: () => void;
}

export const DteManager: React.FC<DteManagerProps> = ({
  dtes = [],
  onAddDte,
  onAddMultipleDtes,
  onUpdateDte,
  onAddEntry,
  company,
  onSyncPendingToCashFlow,
  onClearAllDtes
}) => {
  const safeDtes = Array.isArray(dtes) ? dtes : [];
  const [activeSubTab, setActiveSubTab] = useState<'TODOS' | 'VENTA' | 'COMPRA' | 'HONORARIOS' | 'PENDIENTES_CONTABILIZAR'>('TODOS');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('TODOS');
  
  // Modals
  const [showAutonomousModal, setShowAutonomousModal] = useState(false);
  const [showSiiModal, setShowSiiModal] = useState(false);
  const [showIngestModal, setShowIngestModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [viewEntryModal, setViewEntryModal] = useState<AccountingEntry | null>(null);
  const [copied, setCopied] = useState(false);
  const [syncAlert, setSyncAlert] = useState<string | null>(null);

  // Ingest form state (CSV / JSON / Text from SII)
  const [rawText, setRawText] = useState('');
  const [ingestType, setIngestType] = useState<'VENTA' | 'COMPRA' | 'HONORARIOS'>('VENTA');
  const [ingestSuccessMsg, setIngestSuccessMsg] = useState<string | null>(null);

  // Manual DTE form state
  const [newDte, setNewDte] = useState<Partial<DteDocument>>({
    tipoDte: '33',
    folio: Math.floor(Math.random() * 9000) + 1000,
    tipoOperacion: 'VENTA',
    rutContraparte: '',
    razonSocialContraparte: '',
    fechaEmision: new Date().toISOString().split('T')[0],
    fechaVencimiento: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    montoNeto: 1000000,
    montoExento: 0,
    montoIva: 190000,
    montoTotal: 1190000,
    retencionTasa: 0.145,
    retencionMonto: 0,
    estadoSii: 'ACEPTADO',
    estadoPago: 'PENDIENTE',
    glosa: 'Servicios Profesionales de Desarrollo y Consultoría',
  });

  // Filtered DTEs
  const filteredDtes = safeDtes.filter((d) => {
    let matchesTab = true;
    if (activeSubTab === 'PENDIENTES_CONTABILIZAR') {
      matchesTab = !d.asientoCentralizacionId && (d.imputacionEstado !== 'CENTRALIZADO');
    } else if (activeSubTab !== 'TODOS') {
      matchesTab = d.tipoOperacion === activeSubTab;
    }

    const matchesType = filterType === 'TODOS' || d.tipoDte === filterType;
    const matchesSearch = 
      d.razonSocialContraparte.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.rutContraparte.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.folio.toString().includes(searchTerm) ||
      d.glosa.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesTab && matchesType && matchesSearch;
  });

  // Calculate totals
  const totalVentasNeto = safeDtes.filter(d => d.tipoOperacion === 'VENTA').reduce((s, d) => s + (d.tipoDte === '61' ? -d.montoNeto : d.montoNeto), 0);
  const totalDebitoFiscal = safeDtes.filter(d => d.tipoOperacion === 'VENTA').reduce((s, d) => s + (d.tipoDte === '61' ? -d.montoIva : d.montoIva), 0);
  const totalComprasNeto = safeDtes.filter(d => d.tipoOperacion === 'COMPRA').reduce((s, d) => s + d.montoNeto, 0);
  const totalCreditoFiscal = safeDtes.filter(d => d.tipoOperacion === 'COMPRA').reduce((s, d) => s + d.montoIva, 0);
  const totalHonorariosBruto = safeDtes.filter(d => d.tipoOperacion === 'HONORARIOS').reduce((s, d) => s + d.montoTotal, 0);
  const totalRetencionHonorarios = safeDtes.filter(d => d.tipoOperacion === 'HONORARIOS').reduce((s, d) => s + (d.retencionMonto || (d.montoTotal * (d.retencionTasa || 0.145))), 0);
  const pendingPaymentDtes = safeDtes.filter(d => d.estadoPago === 'PENDIENTE');

  // Handle Net change in manual DTE form
  const handleNetoChange = (neto: number, tipoDte: DteType) => {
    const isExento = tipoDte === '34';
    const iva = isExento ? 0 : Math.round(neto * 0.19);
    const total = neto + iva;
    
    if (newDte.tipoOperacion === 'HONORARIOS') {
      const tasaRet = newDte.retencionTasa || 0.145;
      const ret = Math.round(total * tasaRet);
      setNewDte(prev => ({
        ...prev,
        montoNeto: neto,
        montoExento: 0,
        montoIva: 0,
        montoTotal: total,
        retencionMonto: ret,
      }));
    } else {
      setNewDte(prev => ({
        ...prev,
        montoNeto: neto,
        montoExento: isExento ? neto : 0,
        montoIva: iva,
        montoTotal: total,
      }));
    }
  };

  // Submit manual DTE
  const handleCreateDte = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDte.folio || !newDte.rutContraparte || !newDte.razonSocialContraparte) return;

    const createdDte: DteDocument = {
      id: `dte-${Date.now()}`,
      tipoDte: newDte.tipoDte as DteType,
      folio: Number(newDte.folio),
      tipoOperacion: newDte.tipoOperacion as any,
      rutContraparte: newDte.rutContraparte!,
      razonSocialContraparte: newDte.razonSocialContraparte!.toUpperCase(),
      fechaEmision: newDte.fechaEmision || new Date().toISOString().split('T')[0],
      fechaVencimiento: newDte.fechaVencimiento,
      montoNeto: Number(newDte.montoNeto || 0),
      montoExento: Number(newDte.montoExento || 0),
      montoIva: Number(newDte.montoIva || 0),
      montoTotal: Number(newDte.montoTotal || 0),
      retencionTasa: newDte.retencionTasa,
      retencionMonto: newDte.retencionMonto,
      estadoSii: (newDte.estadoSii as any) || 'ACEPTADO',
      estadoPago: (newDte.estadoPago as any) || 'PENDIENTE',
      glosa: newDte.glosa || 'Registro DTE',
    };

    onAddDte(createdDte);

    // Automatically create accounting entry
    let entry: AccountingEntry;
    if (createdDte.tipoOperacion === 'VENTA') {
      entry = createSalesDteEntry(createdDte);
    } else if (createdDte.tipoOperacion === 'COMPRA') {
      entry = createPurchaseDteEntry(createdDte);
    } else {
      entry = createHonorariosEntry(createdDte);
    }
    onAddEntry(entry);

    setShowManualModal(false);
  };

  // Callback from SiiIntegrationModal
  const handleIngestFromSiiModal = (newDocs: DteDocument[], autoSyncCashFlow: boolean) => {
    if (onAddMultipleDtes) {
      onAddMultipleDtes(newDocs, autoSyncCashFlow);
    } else {
      newDocs.forEach((doc) => {
        onAddDte(doc);
        if (doc.tipoOperacion === 'VENTA') onAddEntry(createSalesDteEntry(doc));
        else if (doc.tipoOperacion === 'COMPRA') onAddEntry(createPurchaseDteEntry(doc));
        else onAddEntry(createHonorariosEntry(doc));
      });
    }

    setSyncAlert(`¡${newDocs.length} documentos DTE sincronizados exitosamente con el RCV y Asientos Contables!`);
    setTimeout(() => setSyncAlert(null), 4000);
  };

  // Submit parsed text / CSV from SII
  const handleIngestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawText.trim()) return;

    const lines = rawText.trim().split('\n');
    let addedCount = 0;

    lines.forEach((line, index) => {
      // Skip header if contains 'folio' or 'rut'
      if (index === 0 && (line.toLowerCase().includes('folio') || line.toLowerCase().includes('rut'))) return;

      const delimiter = line.includes(';') ? ';' : line.includes('\t') ? '\t' : ',';
      const parts = line.split(delimiter).map(p => p.trim().replace(/^["']|["']$/g, ''));

      if (parts.length >= 3) {
        const folio = parseInt(parts[0], 10) || (1000 + Math.floor(Math.random() * 5000));
        const rut = parts[1] || '76.000.000-0';
        const razonSocial = parts[2] || 'EMPRESA INGESTADA SII';
        const netoRaw = parts[3] ? parseInt(parts[3].replace(/[$.]/g, ''), 10) : 1000000;
        const neto = isNaN(netoRaw) ? 1000000 : netoRaw;
        const iva = Math.round(neto * 0.19);
        const total = neto + iva;

        const dte: DteDocument = {
          id: `ingest-${Date.now()}-${index}`,
          tipoDte: ingestType === 'HONORARIOS' ? 'BHE' : '33',
          folio,
          tipoOperacion: ingestType,
          rutContraparte: rut,
          razonSocialContraparte: razonSocial.toUpperCase(),
          fechaEmision: new Date().toISOString().split('T')[0],
          montoNeto: neto,
          montoExento: 0,
          montoIva: ingestType === 'HONORARIOS' ? 0 : iva,
          montoTotal: total,
          retencionTasa: ingestType === 'HONORARIOS' ? 0.145 : undefined,
          retencionMonto: ingestType === 'HONORARIOS' ? Math.round(total * 0.145) : undefined,
          estadoSii: 'ACEPTADO',
          estadoPago: 'PENDIENTE',
          glosa: `Ingesta RCV SII - ${ingestType === 'VENTA' ? 'Venta' : ingestType === 'COMPRA' ? 'Compra' : 'BHE'} Folio ${folio}`,
        };

        onAddDte(dte);

        // Generate normalized accounting entry
        if (dte.tipoOperacion === 'VENTA') onAddEntry(createSalesDteEntry(dte));
        else if (dte.tipoOperacion === 'COMPRA') onAddEntry(createPurchaseDteEntry(dte));
        else onAddEntry(createHonorariosEntry(dte));

        addedCount++;
      }
    });

    setIngestSuccessMsg(`¡Se procesaron e ingresaron exitosamente ${addedCount} documentos al RCV!`);
    setTimeout(() => {
      setIngestSuccessMsg(null);
      setRawText('');
      setShowIngestModal(false);
    }, 1200);
  };

  const handleViewEntry = (dte: DteDocument) => {
    let entry: AccountingEntry;
    if (dte.tipoOperacion === 'VENTA') {
      entry = createSalesDteEntry(dte);
    } else if (dte.tipoOperacion === 'COMPRA') {
      entry = createPurchaseDteEntry(dte);
    } else {
      entry = createHonorariosEntry(dte);
    }
    setViewEntryModal(entry);
  };

  const copyNormalizedText = (entry: AccountingEntry) => {
    const text = formatNormalizedAccountingEntry(entry);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Alert banner if sync success */}
      {syncAlert && (
        <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{syncAlert}</span>
          </div>
          <button onClick={() => setSyncAlert(null)} className="text-emerald-700 hover:text-emerald-900 text-xs font-bold">
            Cerrar
          </button>
        </div>
      )}

      {/* Top 4 Geometric Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Ventas Netas + Débito Fiscal */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Ventas RCV (Neto)</span>
            <div className="p-1.5 rounded-md bg-emerald-50 text-emerald-600 border border-emerald-200">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-[#0f172a]">{formatCLP(totalVentasNeto)}</div>
          <div className="mt-1 flex items-center justify-between text-xs text-slate-500 font-mono">
            <span>IVA Débito (19%):</span>
            <span className="text-emerald-700 font-bold">{formatCLP(totalDebitoFiscal)}</span>
          </div>
        </div>

        {/* Compras Netas + Crédito Fiscal */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Compras RCV (Neto)</span>
            <div className="p-1.5 rounded-md bg-blue-50 text-blue-600 border border-blue-200">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-[#0f172a]">{formatCLP(totalComprasNeto)}</div>
          <div className="mt-1 flex items-center justify-between text-xs text-slate-500 font-mono">
            <span>IVA Crédito (19%):</span>
            <span className="text-blue-700 font-bold">{formatCLP(totalCreditoFiscal)}</span>
          </div>
        </div>

        {/* Balance IVA Estimado */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Balance IVA Mes</span>
            <div className="p-1.5 rounded-md bg-purple-50 text-purple-600 border border-purple-200">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className={`mt-2 text-2xl font-bold ${totalDebitoFiscal - totalCreditoFiscal >= 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
            {formatCLP(Math.abs(totalDebitoFiscal - totalCreditoFiscal))}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {totalDebitoFiscal >= totalCreditoFiscal ? (
              <span className="text-amber-700 font-medium">Impuesto IVA a Enterar (F29)</span>
            ) : (
              <span className="text-emerald-700 font-medium">Remanente a Favor del Contribuyente</span>
            )}
          </div>
        </div>

        {/* Boletas de Honorarios */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Honorarios (BHE)</span>
            <div className="p-1.5 rounded-md bg-indigo-50 text-indigo-600 border border-indigo-200">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-[#0f172a]">{formatCLP(totalHonorariosBruto)}</div>
          <div className="mt-1 flex items-center justify-between text-xs text-slate-500 font-mono">
            <span>Retención 2da Cat (14.5%):</span>
            <span className="text-purple-700 font-bold">{formatCLP(totalRetencionHonorarios)}</span>
          </div>
        </div>
      </div>

      {/* Primary Integration Banner: SII API & Automated RCV Extraction */}
      <div className="bg-gradient-to-r from-[#0f172a] to-[#1e293b] rounded-lg p-4 text-white shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-slate-700">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-blue-600/30 text-blue-400 border border-blue-500/30 shrink-0">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm text-white">Centro de Integración SII (APIs & Ingesta RCV)</span>
              <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-2 py-0.5 rounded text-[10px] font-mono font-bold">
                API REST / RPA Ready
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Descarga automática de DTEs (Facturas 33/34, NC 61, BHE), ingesta guiada de CSV/Excel del SII y conciliación directa con Flujo de Caja y Libro Diario.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0 w-full md:w-auto">
          {onSyncPendingToCashFlow && pendingPaymentDtes.length > 0 && (
            <button
              onClick={onSyncPendingToCashFlow}
              className="flex-1 md:flex-none flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 px-3 py-2 rounded-md text-xs font-semibold transition-colors cursor-pointer"
              title="Conciliar facturas pendientes como cobros/pagos proyectados en el flujo de caja"
            >
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              <span>Conciliar Flujo ({pendingPaymentDtes.length})</span>
            </button>
          )}

          <button
            onClick={() => setShowAutonomousModal(true)}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-4 py-2 rounded-md text-xs font-bold transition-all shadow-md cursor-pointer border border-blue-400/40"
            title="Detección de meses sin actualizar, descarga automática RCV, motor de imputación con memoria, desglose y centralización"
          >
            <Bot className="w-4 h-4 text-amber-300 animate-bounce" />
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Agente SII Autónomo (Meses, Imputación & Centralización)</span>
          </button>

          <button
            onClick={() => setShowSiiModal(true)}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 px-3 py-2 rounded-md text-xs font-semibold transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
            <span>Config / APIs</span>
          </button>

          <button
            id="btn-vaciar-base-rcv"
            onClick={() => {
              if (onClearAllDtes) {
                onClearAllDtes();
              } else if (onAddMultipleDtes) {
                onAddMultipleDtes([], false);
              }
            }}
            className="flex-1 md:flex-none flex items-center justify-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white px-3 py-2 rounded-md text-xs font-bold transition-all shadow-sm cursor-pointer border border-rose-500"
            title="Purgar todos los documentos cargados en memoria y dejar la base en blanco (0)"
          >
            <Trash2 className="w-3.5 h-3.5 text-white" />
            <span>Vaciar Base {dtes.length > 0 ? `(${dtes.length})` : '(0)'}</span>
          </button>
        </div>
      </div>

      {/* Control Bar: Segmented Tabs, Search & Action Buttons */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Segmented Filter Buttons */}
        <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg border border-slate-200 overflow-x-auto">
          <button
            onClick={() => setActiveSubTab('TODOS')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              activeSubTab === 'TODOS' ? 'bg-white text-[#2563eb] shadow-xs border border-slate-200' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Todos ({dtes.length})
          </button>
          <button
            onClick={() => setActiveSubTab('VENTA')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              activeSubTab === 'VENTA' ? 'bg-white text-emerald-700 shadow-xs border border-slate-200' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Ventas ({dtes.filter(d => d.tipoOperacion === 'VENTA').length})
          </button>
          <button
            onClick={() => setActiveSubTab('COMPRA')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              activeSubTab === 'COMPRA' ? 'bg-white text-blue-700 shadow-xs border border-slate-200' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Compras ({dtes.filter(d => d.tipoOperacion === 'COMPRA').length})
          </button>
          <button
            onClick={() => setActiveSubTab('HONORARIOS')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              activeSubTab === 'HONORARIOS' ? 'bg-white text-purple-700 shadow-xs border border-slate-200' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Honorarios ({dtes.filter(d => d.tipoOperacion === 'HONORARIOS').length})
          </button>
          <button
            onClick={() => setActiveSubTab('PENDIENTES_CONTABILIZAR')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'PENDIENTES_CONTABILIZAR' ? 'bg-amber-600 text-white shadow-xs' : 'text-amber-800 bg-amber-50 hover:bg-amber-100'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            Pendientes Contabilizar ({dtes.filter(d => !d.asientoCentralizacionId && d.imputacionEstado !== 'CENTRALIZADO').length})
          </button>
        </div>

        {/* Search & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por RUT, razón social o folio..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-md pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#2563eb] focus:bg-white"
            />
          </div>

          {onClearAllDtes && dtes.length > 0 && (
            <button
              onClick={() => {
                onClearAllDtes();
              }}
              className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer shadow-xs"
              title="Eliminar documentos demo y dejar la empresa en 0 movimientos para cargar sus archivos reales"
            >
              <Trash2 className="w-3.5 h-3.5 text-white" />
              <span>Vaciar Base ({dtes.length})</span>
            </button>
          )}

          {/* Export Reports Group (CSV, Excel, PDF) */}
          <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-md px-2 py-1 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1 mr-1">
              <Download className="w-3.5 h-3.5 text-slate-400" />
              Exportar RCV:
            </span>
            <button
              onClick={() => downloadRcvCsv(safeDtes, activeSubTab === 'TODOS' || activeSubTab === 'PENDIENTES_CONTABILIZAR' ? 'ALL' : activeSubTab)}
              className="px-2 py-0.5 rounded text-xs font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors cursor-pointer"
              title="Descargar Registro Compra-Venta-Honorarios en formato CSV compatible con SII"
            >
              CSV
            </button>
            <span className="text-slate-300">|</span>
            <button
              onClick={() => downloadRcvExcel(safeDtes, company as ClientCompany)}
              className="px-2 py-0.5 rounded text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors cursor-pointer flex items-center gap-1"
              title="Descargar RCV completo en formato Excel (.xlsx) con pestañas"
            >
              <FileSpreadsheet className="w-3 h-3 text-emerald-600" />
              <span>Excel</span>
            </button>
            <span className="text-slate-300">|</span>
            <button
              onClick={() => downloadRcvPdf(safeDtes, company as ClientCompany)}
              className="px-2 py-0.5 rounded text-xs font-bold text-slate-700 hover:bg-rose-50 hover:text-rose-700 transition-colors cursor-pointer flex items-center gap-1"
              title="Descargar Informe Oficial RCV en PDF timbrado"
            >
              <FileText className="w-3 h-3 text-rose-600" />
              <span>PDF</span>
            </button>
          </div>

          <button
            onClick={() => setShowIngestModal(true)}
            className="flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer shadow-xs"
          >
            <UploadCloud className="w-3.5 h-3.5 text-[#2563eb]" />
            <span>Ingesta Rápida (Texto/CSV)</span>
          </button>

          <button
            onClick={() => setShowManualModal(true)}
            className="flex items-center gap-1.5 bg-[#2563eb] hover:bg-blue-600 text-white px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Emitir / Registrar DTE</span>
          </button>
        </div>
      </div>

      {/* DTEs Data Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-[#f1f5f9] text-slate-600 font-semibold border-b border-slate-200 text-[11px] sticky top-0">
              <tr>
                <th className="px-4 py-3">Tipo & Folio</th>
                <th className="px-4 py-3">Contraparte (RUT & Razón Social)</th>
                <th className="px-4 py-3">Fecha Emisión</th>
                <th className="px-4 py-3 text-right">Monto Neto ($)</th>
                <th className="px-4 py-3 text-right">IVA / Retención ($)</th>
                <th className="px-4 py-3 text-right">Total ($ CLP)</th>
                <th className="px-4 py-3 text-center">Estado SII</th>
                <th className="px-4 py-3 text-center">Estado Pago</th>
                <th className="px-4 py-3 text-right">Asiento Normalizado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {filteredDtes.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-400 font-sans">
                    No se encontraron documentos DTE en el criterio seleccionado.
                  </td>
                </tr>
              ) : (
                filteredDtes.map((doc) => {
                  const isVenta = doc.tipoOperacion === 'VENTA';
                  const isNC = doc.tipoDte === '61';
                  const isBH = doc.tipoDte === 'BH' || doc.tipoDte === 'BHE';

                  return (
                    <tr key={doc.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Tipo & Folio */}
                      <td className="px-4 py-3 font-sans">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isBH 
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : isNC 
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : doc.tipoDte === '34'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : isVenta 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}>
                            {doc.tipoDte === '33' && 'DTE 33 (Factura)'}
                            {doc.tipoDte === '34' && 'DTE 34 (Exenta)'}
                            {doc.tipoDte === '61' && 'DTE 61 (Nota Crédito)'}
                            {doc.tipoDte === '56' && 'DTE 56 (Nota Débito)'}
                            {isBH && 'BHE (Honorarios)'}
                          </span>
                          <span className="font-mono font-bold text-slate-900">N° {doc.folio}</span>
                        </div>
                      </td>

                      {/* Contraparte */}
                      <td className="px-4 py-3 font-sans">
                        <div className="font-semibold text-slate-900">{doc.razonSocialContraparte}</div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                          <span className="text-[11px] text-slate-500 font-mono">{doc.rutContraparte}</span>
                          {doc.cuentaGastoImputadaCodigo && (
                            <span className="text-[10px] bg-slate-100 text-slate-700 font-mono px-1.5 py-0.2 rounded border border-slate-200" title={`Imputación: ${doc.cuentaGastoImputadaNombre || ''}`}>
                              Cta: {doc.cuentaGastoImputadaCodigo}
                            </span>
                          )}
                          {doc.partidasDesglosadas && doc.partidasDesglosadas.length > 0 && (
                            <span className="text-[10px] bg-indigo-50 text-indigo-700 font-medium px-1.5 py-0.2 rounded border border-indigo-200 flex items-center gap-0.5">
                              <Split className="w-2.5 h-2.5" />
                              {doc.partidasDesglosadas.length} partidas
                            </span>
                          )}
                          {doc.asientoCentralizacionId && (
                            <span className="text-[10px] bg-emerald-50 text-emerald-700 font-medium px-1.5 py-0.2 rounded border border-emerald-200">
                              Centralizado
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Fecha */}
                      <td className="px-4 py-3 text-slate-600 font-mono">
                        {doc.fechaEmision}
                      </td>

                      {/* Neto */}
                      <td className="px-4 py-3 text-right font-mono font-medium text-slate-800">
                        {doc.montoNeto !== 0 ? formatNumberCL(doc.montoNeto) : '-'}
                      </td>

                      {/* IVA / Retención */}
                      <td className="px-4 py-3 text-right font-mono">
                        {isBH ? (
                          <span className="text-purple-700 font-bold">-{formatNumberCL(doc.retencionMonto || (doc.montoTotal * (doc.retencionTasa || 0.145)))}</span>
                        ) : doc.montoIva !== 0 ? (
                          <span className={isVenta ? 'text-emerald-700 font-bold' : 'text-blue-700 font-bold'}>
                            {formatNumberCL(doc.montoIva)}
                          </span>
                        ) : (
                          <span className="text-slate-400">Exento</span>
                        )}
                      </td>

                      {/* Total */}
                      <td className="px-4 py-3 text-right font-mono font-extrabold text-[#0f172a]">
                        <span className={isNC ? 'text-rose-600' : ''}>
                          {formatCLP(doc.montoTotal)}
                        </span>
                      </td>

                      {/* Estado SII */}
                      <td className="px-4 py-3 text-center font-sans">
                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>{doc.estadoSii}</span>
                        </span>
                      </td>

                      {/* Estado Pago */}
                      <td className="px-4 py-3 text-center font-sans">
                        <button
                          onClick={() => {
                            const nextState = doc.estadoPago === 'PAGADO' || doc.estadoPago === 'COBRADO' ? 'PENDIENTE' : isVenta ? 'COBRADO' : 'PAGADO';
                            onUpdateDte({ ...doc, estadoPago: nextState });
                          }}
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition-colors ${
                            doc.estadoPago === 'PAGADO' || doc.estadoPago === 'COBRADO'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                              : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                          }`}
                          title="Click para alternar estado de pago"
                        >
                          {doc.estadoPago}
                        </button>
                      </td>

                      {/* Botón Ver Asiento */}
                      <td className="px-4 py-3 text-right font-sans">
                        <button
                          onClick={() => handleViewEntry(doc)}
                          className="inline-flex items-center gap-1 bg-white hover:bg-slate-50 text-[#2563eb] border border-blue-200 px-2.5 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer shadow-xs"
                        >
                          <FileCode className="w-3 h-3 text-[#2563eb]" />
                          <span>Ver Asiento</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SiiIntegrationModal (Full API & CSV/RPA Suite) */}
      <SiiIntegrationModal
        isOpen={showSiiModal}
        onClose={() => setShowSiiModal(false)}
        onIngestDtes={handleIngestFromSiiModal}
        company={company}
        currentCompany={company}
        existingDtes={dtes}
      />

      {/* MODAL: Ingesta Rápida (Texto / CSV) */}
      {showIngestModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="px-6 py-4 bg-[#0f172a] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-white text-sm sm:text-base">
                  Ingesta Rápida de Documentos Tributarios (CSV / Tabla SII)
                </h3>
              </div>
              <button
                onClick={() => setShowIngestModal(false)}
                className="text-slate-300 hover:text-white text-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleIngestSubmit} className="p-6 space-y-4">
              <div className="flex items-center gap-4 text-xs">
                <span className="text-slate-600 font-semibold">Tipo de Libro RCV:</span>
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-800">
                  <input
                    type="radio"
                    name="ingestType"
                    checked={ingestType === 'VENTA'}
                    onChange={() => setIngestType('VENTA')}
                    className="text-[#2563eb]"
                  />
                  <span>Libro Ventas SII</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-800">
                  <input
                    type="radio"
                    name="ingestType"
                    checked={ingestType === 'COMPRA'}
                    onChange={() => setIngestType('COMPRA')}
                    className="text-[#2563eb]"
                  />
                  <span>Libro Compras SII</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-800">
                  <input
                    type="radio"
                    name="ingestType"
                    checked={ingestType === 'HONORARIOS'}
                    onChange={() => setIngestType('HONORARIOS')}
                    className="text-[#2563eb]"
                  />
                  <span>Boletas de Honorarios (BHE)</span>
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Pegar contenido CSV / JSON o tabla exportada del SII:
                </label>
                <textarea
                  rows={6}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder={`Ejemplo CSV: Folio;RUT;RazonSocial;MontoNeto\n1050;76.992.880-3;CLIENTE EJEMPLO SPA;2500000\n\nO JSON:\n[\n  {"folio": 1051, "rut": "77.100.200-1", "razonSocial": "TECH CORP", "montoNeto": 4200000}\n]`}
                  className="w-full bg-slate-50 border border-slate-300 rounded-md p-3 text-xs font-mono text-slate-800 focus:outline-none focus:border-[#2563eb] focus:bg-white"
                  required
                />
              </div>

              {/* Botón para cargar muestra rápida */}
              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setRawText(
                      `Folio;RUT;RazonSocial;MontoNeto\n` +
                      `1089;76.450.910-2;DISTRIBUIDORA NORTE LIMITADA;5400000\n` +
                      `1090;77.340.120-K;INGENIERIA SOLAR CHILE SPA;8900000\n` +
                      `1091;96.550.400-8;BANCO DE SERVICIOS DIGITALES;3100000`
                    );
                  }}
                  className="text-[#2563eb] hover:underline cursor-pointer font-medium"
                >
                  Cargar datos de prueba del SII (3 Facturas)
                </button>
              </div>

              {ingestSuccessMsg && (
                <div className="p-3 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>{ingestSuccessMsg}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowIngestModal(false)}
                  className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-md text-xs font-medium cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#2563eb] hover:bg-blue-600 text-white rounded-md text-xs font-medium cursor-pointer shadow-xs"
                >
                  Procesar e Ingestar Documentos
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Registro Manual de DTE */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg w-full max-w-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="px-6 py-4 bg-[#0f172a] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-white text-sm sm:text-base">
                  Emitir / Registrar Nuevo Documento Tributario (DTE)
                </h3>
              </div>
              <button
                onClick={() => setShowManualModal(false)}
                className="text-slate-300 hover:text-white text-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDte} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Tipo de Operación:</label>
                  <select
                    value={newDte.tipoOperacion}
                    onChange={(e) => {
                      const op = e.target.value as any;
                      const defaultDte = op === 'HONORARIOS' ? 'BHE' : '33';
                      setNewDte(prev => ({ ...prev, tipoOperacion: op, tipoDte: defaultDte }));
                    }}
                    className="w-full bg-slate-50 border border-slate-300 rounded-md p-2 text-slate-800 focus:outline-none focus:border-[#2563eb]"
                  >
                    <option value="VENTA">Venta Emitida</option>
                    <option value="COMPRA">Compra Recibida</option>
                    <option value="HONORARIOS">Boleta de Honorarios (BHE)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Tipo Documento DTE:</label>
                  <select
                    value={newDte.tipoDte}
                    onChange={(e) => {
                      const t = e.target.value as DteType;
                      setNewDte(prev => ({ ...prev, tipoDte: t }));
                      handleNetoChange(newDte.montoNeto || 1000000, t);
                    }}
                    className="w-full bg-slate-50 border border-slate-300 rounded-md p-2 text-slate-800 focus:outline-none focus:border-[#2563eb]"
                  >
                    {newDte.tipoOperacion === 'HONORARIOS' ? (
                      <option value="BHE">Boleta de Honorarios Electrónica (BHE)</option>
                    ) : (
                      <>
                        <option value="33">DTE 33 - Factura Electrónica Afecta</option>
                        <option value="34">DTE 34 - Factura No Afecta / Exenta</option>
                        <option value="61">DTE 61 - Nota de Crédito Electrónica</option>
                        <option value="56">DTE 56 - Nota de Débito Electrónica</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">N° Folio:</label>
                  <input
                    type="number"
                    value={newDte.folio}
                    onChange={(e) => setNewDte(prev => ({ ...prev, folio: Number(e.target.value) }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-md p-2 font-mono text-slate-800 focus:outline-none focus:border-[#2563eb]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Fecha Emisión:</label>
                  <input
                    type="date"
                    value={newDte.fechaEmision}
                    onChange={(e) => setNewDte(prev => ({ ...prev, fechaEmision: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-md p-2 font-mono text-slate-800 focus:outline-none focus:border-[#2563eb]"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="block text-slate-700 font-semibold mb-1">RUT Contraparte:</label>
                  <input
                    type="text"
                    placeholder="76.123.456-7"
                    value={newDte.rutContraparte}
                    onChange={(e) => setNewDte(prev => ({ ...prev, rutContraparte: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-md p-2 font-mono text-slate-800 focus:outline-none focus:border-[#2563eb]"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-slate-700 font-semibold mb-1">Razón Social / Nombre:</label>
                  <input
                    type="text"
                    placeholder="Empresa Cliente o Proveedor S.A."
                    value={newDte.razonSocialContraparte}
                    onChange={(e) => setNewDte(prev => ({ ...prev, razonSocialContraparte: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-md p-2 text-slate-800 focus:outline-none focus:border-[#2563eb]"
                    required
                  />
                </div>
              </div>

              {/* Montos */}
              <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-600 text-[11px] font-semibold mb-1">Monto Neto ($):</label>
                    <input
                      type="number"
                      value={newDte.montoNeto}
                      onChange={(e) => handleNetoChange(Number(e.target.value), newDte.tipoDte as DteType)}
                      className="w-full bg-white border border-slate-300 rounded-md p-2 font-mono text-slate-900 font-bold focus:outline-none focus:border-[#2563eb]"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 text-[11px] font-semibold mb-1">
                      {newDte.tipoOperacion === 'HONORARIOS' ? 'Retención 14.5% ($)' : 'IVA 19% ($):'}
                    </label>
                    <input
                      type="number"
                      readOnly
                      value={newDte.tipoOperacion === 'HONORARIOS' ? newDte.retencionMonto : newDte.montoIva}
                      className="w-full bg-slate-100 border border-slate-200 rounded-md p-2 font-mono text-[#2563eb] font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 text-[11px] font-semibold mb-1">Monto Total ($):</label>
                    <input
                      type="number"
                      readOnly
                      value={newDte.montoTotal}
                      className="w-full bg-slate-100 border border-slate-200 rounded-md p-2 font-mono font-black text-[#0f172a]"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Glosa / Descripción:</label>
                <input
                  type="text"
                  value={newDte.glosa}
                  onChange={(e) => setNewDte(prev => ({ ...prev, glosa: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-md p-2 text-slate-800 focus:outline-none focus:border-[#2563eb]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-md font-medium cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#2563eb] hover:bg-blue-600 text-white rounded-md font-semibold shadow-xs cursor-pointer"
                >
                  Registrar DTE y Generar Asiento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Visor de Asiento Contable Normalizado */}
      {viewEntryModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="px-6 py-4 bg-[#0f172a] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-white text-sm sm:text-base">
                  Asiento Contable Normalizado (Formato Oficial CMF/SII)
                </h3>
              </div>
              <button
                onClick={() => setViewEntryModal(null)}
                className="text-slate-300 hover:text-white text-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-[#1e293b] p-4 rounded-md border-l-4 border-[#2563eb] overflow-x-auto">
                <pre className="font-mono text-xs text-[#cbd5e1] leading-relaxed">
                  {formatNormalizedAccountingEntry(viewEntryModal)}
                </pre>
              </div>

              <div className="flex items-center justify-between text-xs pt-2">
                <span className="text-slate-600 font-medium">
                  {viewEntryModal.balanceado ? (
                    <span className="text-emerald-700 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Asiento Cuadrado (Debe = Haber)
                    </span>
                  ) : (
                    <span className="text-rose-600 font-bold">Descuadrado</span>
                  )}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyNormalizedText(viewEntryModal)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#2563eb] hover:bg-blue-600 text-white rounded-md font-semibold transition-colors cursor-pointer shadow-xs"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copied ? '¡Copiado al Portapapeles!' : 'Copiar Formato Normalizado'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* MODAL: SiiAutonomousEngineModal (Detección de meses, descarga RCV, memoria proveedores, split y centralización) */}
      {showAutonomousModal && company && (
        <SiiAutonomousEngineModal
          isOpen={showAutonomousModal}
          onClose={() => setShowAutonomousModal(false)}
          company={company}
          dtes={dtes}
          onAddMultipleDtes={(newDtes, autoSync) => {
            if (onAddMultipleDtes) {
              onAddMultipleDtes(newDtes, autoSync);
            } else {
              newDtes.forEach(d => onAddDte(d));
            }
          }}
          onUpdateDte={onUpdateDte}
          onAddAccountingEntry={onAddEntry}
          onClearAllDtes={onClearAllDtes}
        />
      )}
    </div>
  );
};
