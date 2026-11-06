import React, { useState, useMemo } from 'react';
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
  Download,
  DownloadCloud,
  ShieldAlert,
  Target,
  Layers,
  Sliders
} from 'lucide-react';
import { DteDocument, DteItemDetail, DteType, AccountingEntry, CompanyProfile, ClientCompany, CostCenterMaster, RcvAccountingRegistrationMode } from '../types';
import { SEED_COST_CENTERS } from '../data/seedCostCenters';
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
import { ModuleAgentGovernanceHeader } from './governance/ModuleAgentGovernanceHeader';
import { getStoredAuthToken } from '../services/apiClient';
import { periodoActual } from '../utils/periodo';

interface DteManagerProps {
  dtes: DteDocument[];
  onAddDte: (dte: DteDocument) => void;
  onAddMultipleDtes?: (dtes: DteDocument[], autoSyncCashFlow: boolean) => void;
  onUpdateDte: (dte: DteDocument) => void;
  onAddEntry: (entry: AccountingEntry) => void;
  company?: CompanyProfile | ClientCompany;
  onSyncPendingToCashFlow?: () => void;
  onClearAllDtes?: () => void;
  onNavigateToBilling?: () => void;
  costCenters?: CostCenterMaster[];
}

export const DteManager: React.FC<DteManagerProps> = ({
  dtes = [],
  onAddDte,
  onAddMultipleDtes,
  onUpdateDte,
  onAddEntry,
  company,
  onSyncPendingToCashFlow,
  onClearAllDtes,
  onNavigateToBilling,
  costCenters,
}) => {
  const safeDtes = Array.isArray(dtes) ? dtes : [];
  const availableCostCenters = useMemo(() => {
    return Array.isArray(costCenters) && costCenters.length > 0 ? costCenters : SEED_COST_CENTERS;
  }, [costCenters]);
  const [activeSubTab, setActiveSubTab] = useState<'TODOS' | 'VENTA' | 'COMPRA' | 'HONORARIOS' | 'BOLETAS' | 'PENDIENTES_CONTABILIZAR'>('TODOS');
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

  // Estado para gestión y desglose de Centro de Costos por Ítem de la Factura
  const [selectedDteForItems, setSelectedDteForItems] = useState<DteDocument | null>(null);
  const [editingItems, setEditingItems] = useState<DteItemDetail[]>([]);
  const [itemsSuccessMsg, setItemsSuccessMsg] = useState<string | null>(null);

  const handleOpenItemsModal = (doc: DteDocument) => {
    setSelectedDteForItems(doc);
    if (doc.items && doc.items.length > 0) {
      setEditingItems(doc.items.map(it => ({ ...it })));
    } else {
      const defaultMonto = (doc.montoNeto || 0) + (doc.montoExento || 0) || doc.montoTotal;
      setEditingItems([
        {
          id: `item-${Date.now()}-1`,
          nombre: doc.glosa || `Ítem Principal Folio ${doc.folio}`,
          cantidad: 1,
          unidadMedida: 'UN',
          precioUnitario: defaultMonto,
          montoTotal: defaultMonto,
          esExento: Boolean(doc.montoExento && doc.montoExento > 0 && (!doc.montoNeto || doc.montoNeto === 0)),
          centroCostoId: doc.centroCostoId || availableCostCenters[0]?.id,
          centroCostoCodigo: doc.centroCostoCodigo || availableCostCenters[0]?.codigo,
          centroCostoNombre: doc.centroCostoNombre || availableCostCenters[0]?.nombre,
          cuentaCodigo: doc.tipoOperacion === 'VENTA' ? '4.1.01' : ((doc as any).cuentaGastoImputadaCodigo || '5.1.01'),
          cuentaNombre: doc.tipoOperacion === 'VENTA' ? 'Ingresos por Ventas' : ((doc as any).cuentaGastoImputadaNombre || 'Costos Operacionales Directos'),
        }
      ]);
    }
    setItemsSuccessMsg(null);
  };

  const handleAddItemRow = () => {
    const firstCC = availableCostCenters[0];
    setEditingItems(prev => [
      ...prev,
      {
        id: `item-${Date.now()}-${prev.length + 1}`,
        nombre: `Ítem ${prev.length + 1}`,
        cantidad: 1,
        unidadMedida: 'UN',
        precioUnitario: 0,
        montoTotal: 0,
        esExento: false,
        centroCostoId: firstCC?.id,
        centroCostoCodigo: firstCC?.codigo,
        centroCostoNombre: firstCC?.nombre,
        cuentaCodigo: selectedDteForItems?.tipoOperacion === 'VENTA' ? '4.1.01' : '5.1.01',
        cuentaNombre: selectedDteForItems?.tipoOperacion === 'VENTA' ? 'Ingresos por Ventas' : 'Costos Operacionales Directos',
      }
    ]);
  };

  const handleRemoveItemRow = (index: number) => {
    setEditingItems(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleItemFieldChange = (index: number, field: string, value: any) => {
    setEditingItems(prev => {
      const copy = [...prev];
      const item = { ...copy[index] };
      if (field === 'centroCostoCodigo') {
        const foundCc = availableCostCenters.find(c => c.codigo === value);
        item.centroCostoCodigo = value;
        item.centroCostoId = foundCc?.id;
        item.centroCostoNombre = foundCc?.nombre;
      } else if (field === 'cantidad' || field === 'precioUnitario') {
        (item as any)[field] = Number(value) || 0;
        item.montoTotal = Math.round(Number(item.cantidad || 0) * Number(item.precioUnitario || 0));
      } else if (field === 'montoTotal') {
        item.montoTotal = Number(value) || 0;
        if (item.cantidad && item.cantidad > 0) {
          item.precioUnitario = Math.round(item.montoTotal / item.cantidad);
        }
      } else {
        (item as any)[field] = value;
      }
      copy[index] = item;
      return copy;
    });
  };

  const handleApplyCostCenterToAllItems = (ccCodigo: string) => {
    const foundCc = availableCostCenters.find(c => c.codigo === ccCodigo);
    setEditingItems(prev => prev.map(it => ({
      ...it,
      centroCostoCodigo: ccCodigo,
      centroCostoId: foundCc?.id,
      centroCostoNombre: foundCc?.nombre,
    })));
  };

  const handleSaveItemsForDte = () => {
    if (!selectedDteForItems) return;
    const firstItemWithCc = editingItems.find(it => it.centroCostoCodigo);
    const updatedDoc: DteDocument = {
      ...selectedDteForItems,
      items: editingItems,
      centroCostoId: firstItemWithCc?.centroCostoId || selectedDteForItems.centroCostoId,
      centroCostoCodigo: firstItemWithCc?.centroCostoCodigo || selectedDteForItems.centroCostoCodigo,
      centroCostoNombre: firstItemWithCc?.centroCostoNombre || selectedDteForItems.centroCostoNombre,
    };

    onUpdateDte(updatedDoc);

    // Regenerar asiento contable para reflejar los centros de costo de los ítems
    try {
      let newEntry: AccountingEntry | null = null;
      if (updatedDoc.tipoOperacion === 'VENTA') {
        newEntry = createSalesDteEntry(updatedDoc);
      } else if (updatedDoc.tipoOperacion === 'COMPRA') {
        newEntry = createPurchaseDteEntry(updatedDoc, isCompanyExento);
      }
      if (newEntry) {
        onAddEntry(newEntry);
      }
    } catch (err) {
      console.error('Error al regenerar asiento contable con ítems:', err);
    }

    setItemsSuccessMsg(`¡Ítems y Centros de Costo actualizados! El asiento contable ha sido regenerado reflejando la imputación analítica de cada partida.`);
  };

  // Verificación de condición tributaria: No Afecta a IVA (Art. 12 Letra E / DL 825)
  const isCompanyExento = Boolean((company as any)?.exentoIvaGiro);
  const [isConnectingSii, setIsConnectingSii] = useState(false);

  // Configuración de Modalidad de Registro Contable del RCV: Resumen Global vs Movimiento a Movimiento
  const [rcvAccountingMode, setRcvAccountingMode] = useState<RcvAccountingRegistrationMode>(() => {
    try {
      return (localStorage.getItem(`rcv_accounting_mode_${company.rut}`) as RcvAccountingRegistrationMode) || 'RESUMEN_GLOBAL';
    } catch {
      return 'RESUMEN_GLOBAL';
    }
  });

  const handleToggleRcvAccountingMode = (mode: RcvAccountingRegistrationMode) => {
    setRcvAccountingMode(mode);
    try {
      localStorage.setItem(`rcv_accounting_mode_${company.rut}`, mode);
    } catch {}
  };

  // 2.3: período RCV elegido por el usuario (por defecto el mes en curso, editable)
  const [periodoRcv, setPeriodoRcv] = useState<string>(periodoActual());

  // Consulta directa y verídica al Servicio de Impuestos Internos
  const handleLoadVentasFromSii = async () => {
    setIsConnectingSii(true);
    setSyncAlert(`Conectando con Servicio de Impuestos Internos (zeusr.sii.cl / RCV) para RUT ${company.rut}...`);
    try {
      const authToken = getStoredAuthToken();
      const res = await fetch('/api/sii/download-rcv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          tipo: 'VENTA',
          periodo: periodoRcv,
          rut: company.rut,
          empresaId: (company as any).id,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error al conectar con SII');
      }

      const receivedDocs: DteDocument[] = data.documentos || [];
      if (receivedDocs.length > 0) {
        if (onAddMultipleDtes) {
          onAddMultipleDtes(receivedDocs, true);
        } else {
          receivedDocs.forEach(doc => {
            onAddDte(doc);
          });
        }

        // Si el modo configurado es DETALLADO_DOCUMENTO, se registra movimiento a movimiento
        if (rcvAccountingMode === 'DETALLADO_DOCUMENTO') {
          receivedDocs.forEach(doc => {
            if (doc.tipoOperacion === 'VENTA') onAddEntry(createSalesDteEntry(doc));
            else if (doc.tipoOperacion === 'COMPRA') onAddEntry(createPurchaseDteEntry(doc, isCompanyExento));
            else onAddEntry(createHonorariosEntry(doc));
          });
        }

        // Auditoría agéntica de conciliación RCV vs Libro Diario
        let agentNote = '';
        try {
          const agentRes = await fetch('/api/agents/autonomous/execute', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
            },
            body: JSON.stringify({
              module: 'TRIBUTARIO_SII',
              modulo: 'TRIBUTARIO_SII',
              empresaId: company.rut,
              query: `Conciliar ${receivedDocs.length} documentos RCV con el Libro Diario para el período ${periodoRcv}.`,
              context: {
                empresa: company,
                company,
                periodo: periodoRcv,
                selectedPeriod: periodoRcv,
                dtes: receivedDocs,
              },
            }),
          });
          if (agentRes.ok) {
            const aData = await agentRes.json();
            const desc = aData.decision || aData.finalText || '';
            if (desc) agentNote = ` | Dictamen Agente: ${desc.slice(0, 100)}...`;
          }
        } catch (aErr) {
          console.warn('[DteManager] Error consultando conciliación agéntica:', aErr);
        }

        setSyncAlert(`¡Registro de Ventas obtenido desde el SII! Se sincronizaron ${receivedDocs.length} documentos oficiales (${rcvAccountingMode === 'DETALLADO_DOCUMENTO' ? 'Movimiento a Movimiento' : 'Modo Resumen Global'}).${agentNote}`);
      } else {
        if (isCompanyExento) {
          setSyncAlert(`Consulta oficial al SII completada: ${company.razonSocial} es un contribuyente NO AFECTO A IVA (Art. 12 Letra E / DL 825). El SII certifica $0 ventas afectas con IVA (DTE 33: 0, Débito Fiscal: $0 CLP) y 0 facturas exentas emitidas en el período. Cero datos inventados.`);
        } else {
          setSyncAlert(`Consulta oficial al SII completada: No se registran documentos de ventas emitidos ante el SII para el período.`);
        }
      }
    } catch (err: any) {
      setSyncAlert(`Error de conexión con SII: ${err.message}. Puede cargar el archivo CSV oficial exportado desde sii.cl.`);
    } finally {
      setIsConnectingSii(false);
    }
  };

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
    } else if (activeSubTab === 'BOLETAS') {
      matchesTab = d.tipoDte === '39' || d.tipoDte === '41' || (d as any).tipoOperacion === 'BOLETA';
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
      centroCostoId: newDte.centroCostoId,
      centroCostoCodigo: newDte.centroCostoCodigo,
      centroCostoNombre: newDte.centroCostoNombre,
      glosa: newDte.glosa || 'Registro DTE',
    };

    onAddDte(createdDte);

    // Automatically create accounting entry
    let entry: AccountingEntry;
    if (createdDte.tipoOperacion === 'VENTA') {
      entry = createSalesDteEntry(createdDte);
    } else if (createdDte.tipoOperacion === 'COMPRA') {
      entry = createPurchaseDteEntry(createdDte, isCompanyExento);
    } else {
      entry = createHonorariosEntry(createdDte);
    }
    onAddEntry(entry);

    setShowManualModal(false);
  };

  // Callback from SiiIntegrationModal
  const handleIngestFromSiiModal = (newDocs: DteDocument[], autoSyncCashFlow: boolean) => {
    // Si la empresa es exenta de IVA y son compras, reflejar IVA No Recuperable en cada documento
    const processedDocs = newDocs.map(d => {
      if (isCompanyExento && d.tipoOperacion === 'COMPRA' && d.montoIva > 0) {
        return {
          ...d,
          montoIvaRecuperable: 0,
          montoIvaNoRecuperable: d.montoIva,
          ivaNoRecuperable: true,
        };
      }
      return d;
    });

    if (onAddMultipleDtes) {
      onAddMultipleDtes(processedDocs, autoSyncCashFlow);
    } else {
      processedDocs.forEach((doc) => {
        onAddDte(doc);
      });
    }

    if (rcvAccountingMode === 'DETALLADO_DOCUMENTO') {
      processedDocs.forEach((doc) => {
        if (doc.tipoOperacion === 'VENTA') onAddEntry(createSalesDteEntry(doc));
        else if (doc.tipoOperacion === 'COMPRA') onAddEntry(createPurchaseDteEntry(doc, isCompanyExento));
        else onAddEntry(createHonorariosEntry(doc));
      });
    }

    setSyncAlert(`¡${newDocs.length} documentos DTE sincronizados exitosamente con el RCV (${rcvAccountingMode === 'DETALLADO_DOCUMENTO' ? 'Asientos Movimiento a Movimiento' : 'Modo Asiento Resumen Global'})!`);
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
        const isExento = isCompanyExento && ingestType === 'VENTA';
        const finalTipoDte = ingestType === 'HONORARIOS' ? 'BHE' : (isExento ? '34' : '33');
        const iva = (ingestType === 'HONORARIOS' || isExento) ? 0 : Math.round(neto * 0.19);
        const montoExento = isExento ? neto : 0;
        const montoNeto = isExento ? 0 : neto;
        const total = isExento ? neto : (neto + iva);

        const dte: DteDocument = {
          id: `ingest-${Date.now()}-${index}`,
          tipoDte: finalTipoDte as any,
          folio,
          tipoOperacion: ingestType,
          rutContraparte: rut,
          razonSocialContraparte: razonSocial.toUpperCase(),
          fechaEmision: new Date().toISOString().split('T')[0],
          montoNeto,
          montoExento,
          montoIva: iva,
          montoIvaRecuperable: (ingestType === 'COMPRA' && isCompanyExento) ? 0 : iva,
          montoIvaNoRecuperable: (ingestType === 'COMPRA' && isCompanyExento) ? iva : 0,
          ivaNoRecuperable: ingestType === 'COMPRA' && isCompanyExento,
          montoTotal: total,
          retencionTasa: ingestType === 'HONORARIOS' ? 0.145 : undefined,
          retencionMonto: ingestType === 'HONORARIOS' ? Math.round(total * 0.145) : undefined,
          estadoSii: 'ACEPTADO',
          estadoPago: 'PENDIENTE',
          glosa: isExento
            ? `Servicio de Consultoría / Software (Exento IVA Art. 12 Letra E / DL 825) - Folio ${folio}`
            : (ingestType === 'COMPRA' && isCompanyExento)
            ? `Compra Recibida - IVA No Recuperable (Giro Exento Art. 23 DL 825) - Folio ${folio}`
            : `Ingesta RCV SII - ${ingestType === 'VENTA' ? 'Venta' : ingestType === 'COMPRA' ? 'Compra' : 'BHE'} Folio ${folio}`,
        };

        onAddDte(dte);

        // Generate normalized accounting entry if configured in DETALLADO_DOCUMENTO mode
        if (rcvAccountingMode === 'DETALLADO_DOCUMENTO') {
          if (dte.tipoOperacion === 'VENTA') onAddEntry(createSalesDteEntry(dte));
          else if (dte.tipoOperacion === 'COMPRA') onAddEntry(createPurchaseDteEntry(dte, isCompanyExento));
          else onAddEntry(createHonorariosEntry(dte));
        }

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
      entry = createPurchaseDteEntry(dte, isCompanyExento);
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
      {/* Gobernanza Agéntica del Módulo Tributario SII (Jorge Rojas) */}
      <ModuleAgentGovernanceHeader
        moduloId="TRIBUTARIO_SII"
        empresaId={company?.id || ''}
      />

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
              <span className="font-extrabold text-sm text-white">Registro de Compras, Ventas / Honorarios & Boletas SII (RCV & BHE)</span>
              <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-2 py-0.5 rounded text-[10px] font-mono font-bold">
                API REST / RPA Playwright Ready
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Descarga y auditoría oficial de DTEs (Facturas 33/34, NC 61, Boletas 39/41 y Boletas de Honorarios BHE), ingesta guiada RCV y conciliación directa con Flujo de Caja y Libro Diario.
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

      {/* Configuración de Modalidad de Registro Contable del RCV */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-xl p-3.5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-sm border border-indigo-400/20">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600/60 border border-indigo-400/40 flex items-center justify-center shrink-0">
            <Sliders className="w-4 h-4 text-indigo-200" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider">
                Modalidad de Contabilización RCV en Libro Diario:
              </span>
              <span className={`px-2 py-0.2 rounded text-[10px] font-extrabold ${
                rcvAccountingMode === 'DETALLADO_DOCUMENTO'
                  ? 'bg-indigo-400/30 text-indigo-200 border border-indigo-400/40'
                  : 'bg-blue-400/30 text-blue-200 border border-blue-400/40'
              }`}>
                {rcvAccountingMode === 'DETALLADO_DOCUMENTO' ? 'Movimiento a Movimiento' : 'Asiento Resumen Global'}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              {rcvAccountingMode === 'DETALLADO_DOCUMENTO'
                ? 'El sistema genera un asiento individual por cada DTE importado (desglose por RUT, Folio y fecha específica).'
                : 'El sistema consolida todos los DTEs en un único asiento mensual de compras/ventas (Art. 56 DL 825).'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-800/90 p-1 rounded-lg border border-slate-700/80 shrink-0">
          <button
            type="button"
            onClick={() => handleToggleRcvAccountingMode('RESUMEN_GLOBAL')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
              rcvAccountingMode === 'RESUMEN_GLOBAL'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Asiento Resumen Global
          </button>
          <button
            type="button"
            onClick={() => handleToggleRcvAccountingMode('DETALLADO_DOCUMENTO')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
              rcvAccountingMode === 'DETALLADO_DOCUMENTO'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Movimiento a Movimiento (Detallado)
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
            Ventas ({safeDtes.filter(d => d.tipoOperacion === 'VENTA').length})
          </button>
          <button
            onClick={() => setActiveSubTab('COMPRA')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              activeSubTab === 'COMPRA' ? 'bg-white text-blue-700 shadow-xs border border-slate-200' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Compras ({safeDtes.filter(d => d.tipoOperacion === 'COMPRA').length})
          </button>
          <button
            onClick={() => setActiveSubTab('HONORARIOS')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              activeSubTab === 'HONORARIOS' ? 'bg-white text-purple-700 shadow-xs border border-slate-200' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Honorarios ({safeDtes.filter(d => d.tipoOperacion === 'HONORARIOS').length})
          </button>
          <button
            onClick={() => setActiveSubTab('BOLETAS')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              activeSubTab === 'BOLETAS' ? 'bg-white text-indigo-700 shadow-xs border border-slate-200' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Boletas (39/41) ({safeDtes.filter(d => d.tipoDte === '39' || d.tipoDte === '41' || (d as any).tipoOperacion === 'BOLETA').length})
          </button>
          <button
            onClick={() => setActiveSubTab('PENDIENTES_CONTABILIZAR')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'PENDIENTES_CONTABILIZAR' ? 'bg-amber-600 text-white shadow-xs' : 'text-amber-800 bg-amber-50 hover:bg-amber-100'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            Pendientes Contabilizar ({safeDtes.filter(d => !d.asientoCentralizacionId && d.imputacionEstado !== 'CENTRALIZADO').length})
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

          {/* Botón Cargar Registro de Ventas Oficial desde SII (período explícito) */}
          <input
            type="month"
            value={periodoRcv}
            onChange={(e) => e.target.value && setPeriodoRcv(e.target.value)}
            title="Período del Registro de Ventas a descargar"
            className="border border-blue-300 rounded-md px-2 py-1 text-xs font-mono text-blue-900 bg-white"
          />
          <button
            onClick={handleLoadVentasFromSii}
            disabled={isConnectingSii}
            className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-300 px-3 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer shadow-xs disabled:opacity-50"
            title="Conectar con SII (zeusr.sii.cl / RCV) y descargar el Registro de Ventas oficial del contribuyente"
          >
            {isConnectingSii ? (
              <RefreshCw className="w-3.5 h-3.5 text-blue-700 animate-spin" />
            ) : (
              <DownloadCloud className="w-3.5 h-3.5 text-blue-700" />
            )}
            <span>{isConnectingSii ? 'Conectando SII...' : 'Cargar Registro de Ventas (SII)'}</span>
          </button>

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
            title="Registrar documento tributario en la contabilidad interna del ERP (No emite ante el SII)"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Registrar DTE (Interno)</span>
          </button>

          {onNavigateToBilling && (
            <button
              onClick={onNavigateToBilling}
              className="flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors shadow-xs cursor-pointer"
              title="Emitir y timbrar facturas electrónicas oficiales en el SII con Robot Playwright"
            >
              <Bot className="w-3.5 h-3.5 text-indigo-600" />
              <span>Emitir Factura (Robot SII)</span>
            </button>
          )}
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
                <th className="px-4 py-3 text-right" title="IVA Crédito Fiscal Recuperable / IVA No Recuperable Art. 23 DL 825 / Retención BHE">
                  IVA (Rec / No Rec) ($)
                </th>
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
                          {doc.centroCostoCodigo && (
                            <span className="text-[10px] bg-indigo-50 text-indigo-700 font-semibold px-1.5 py-0.2 rounded border border-indigo-200" title={doc.centroCostoNombre}>
                              CC: {doc.centroCostoCodigo}
                            </span>
                          )}
                          {doc.items && doc.items.length > 0 && (
                            <button
                              type="button"
                              onClick={() => handleOpenItemsModal(doc)}
                              className="text-[10px] bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium px-1.5 py-0.2 rounded border border-blue-200 cursor-pointer transition-colors"
                              title={`${doc.items.length} ítems. Click para ver y asignar centros de costo`}
                            >
                              {doc.items.length} ítems (CC)
                            </button>
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
                        ) : (doc.ivaNoRecuperable || (isCompanyExento && !isVenta && doc.montoIva > 0) || (doc.montoIvaNoRecuperable && doc.montoIvaNoRecuperable > 0)) ? (
                          <div className="flex flex-col items-end">
                            <span className="text-amber-700 font-bold" title="IVA No Recuperable: Imputado a Costo/Gasto Operacional según Art. 23 DL 825">
                              {formatNumberCL(doc.montoIvaNoRecuperable || doc.montoIva)}
                            </span>
                            <span className="text-[9px] bg-amber-100 text-amber-800 px-1 rounded font-sans font-semibold">
                              No Rec.
                            </span>
                          </div>
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
                        {doc.estadoSii === 'ACEPTADO' || doc.estadoSii === 'ACEPTADO_CON_REPAROS' ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>{doc.estadoSii}</span>
                          </span>
                        ) : doc.estadoSii === 'SIMULADO' ? (
                          <span
                            title="DTE simulado en desarrollo: sin validez tributaria, no se declara"
                            className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 border border-rose-300 px-2 py-0.5 rounded-full text-[10px] font-extrabold"
                          >
                            <span>SIMULADO</span>
                          </span>
                        ) : (
                          <span
                            title={doc.estadoSii === 'ENVIADO' ? 'Enviado al SII; pendiente de consultar el Track ID' : undefined}
                            className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full text-[10px] font-bold"
                          >
                            <span>{doc.estadoSii}</span>
                          </span>
                        )}
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

                      {/* Acciones */}
                      <td className="px-4 py-3 text-right font-sans">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenItemsModal(doc)}
                            className="inline-flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-2 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer shadow-xs"
                            title="Desglose por Ítem y Centro de Costos"
                          >
                            <Target className="w-3 h-3 text-indigo-600" />
                            <span>Ítems & CC</span>
                          </button>
                          <button
                            onClick={() => handleViewEntry(doc)}
                            className="inline-flex items-center gap-1 bg-white hover:bg-slate-50 text-[#2563eb] border border-blue-200 px-2.5 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer shadow-xs"
                          >
                            <FileCode className="w-3 h-3 text-[#2563eb]" />
                            <span>Ver Asiento</span>
                          </button>
                        </div>
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

              {isCompanyExento && ingestType === 'VENTA' && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-md text-amber-900 text-xs flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Contribuyente No Afecto a IVA (Art. 12 Letra E / D.L. 825)</p>
                    <p className="mt-0.5 text-slate-700">
                      {company.razonSocial} presta servicios tecnológicos exentos de IVA. Todas las ventas emitidas corresponden a <strong>Facturas No Afectas o Exentas (DTE 34)</strong> con <strong>IVA Débito Fiscal $0</strong>. No se generan impuestos ficticios.
                    </p>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Pegar contenido CSV / JSON o tabla exportada del SII:
                </label>
                <textarea
                  rows={6}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder={
                    isCompanyExento && ingestType === 'VENTA'
                      ? `Ejemplo CSV Exento (DTE 34):\nFolio;RUT;RazonSocial;MontoExento\n101;76.992.880-3;CLIENTE CONSULTORIA TI SPA;2500000`
                      : `Ejemplo CSV: Folio;RUT;RazonSocial;MontoNeto\n1050;76.992.880-3;CLIENTE EJEMPLO SPA;2500000\n\nO JSON:\n[\n  {"folio": 1051, "rut": "77.100.200-1", "razonSocial": "TECH CORP", "montoNeto": 4200000}\n]`
                  }
                  className="w-full bg-slate-50 border border-slate-300 rounded-md p-3 text-xs font-mono text-slate-800 focus:outline-none focus:border-[#2563eb] focus:bg-white"
                  required
                />
              </div>

              {/* Acciones de carga de datos */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                {isCompanyExento && ingestType === 'VENTA' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setRawText(
                          `Folio;RUT;RazonSocial;MontoExento\n` +
                          `101;76.992.880-3;CLIENTE SERVICIOS TECNOLOGICOS SPA;2500000\n` +
                          `102;77.100.200-1;CONSULTORIA GLOBAL TECH CHILE;4200000`
                        );
                      }}
                      className="text-[#2563eb] hover:underline cursor-pointer font-medium"
                    >
                      Cargar formato ejemplo DTE 34 Exento ($0 IVA)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowIngestModal(false);
                        handleLoadVentasFromSii();
                      }}
                      className="text-emerald-700 font-semibold hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <DownloadCloud className="w-3.5 h-3.5" />
                      <span>Conectar con SII oficial (Traer la verdad)</span>
                    </button>
                  </>
                ) : (
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
                )}
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
                <div>
                  <h3 className="font-bold text-white text-sm sm:text-base flex items-center gap-2">
                    <span>Registrar Documento Tributario (DTE)</span>
                    <span className="text-[10px] uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-400/30 px-2 py-0.5 rounded font-bold">
                      Registro Contable Interno
                    </span>
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setShowManualModal(false)}
                className="text-slate-300 hover:text-white text-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDte} className="p-6 space-y-4 text-xs">
              {/* Alerta de Control Interno: Aclaración de Registro vs Emisión SII */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3.5 text-xs text-amber-900 flex flex-col gap-2.5">
                <div className="flex items-start gap-2.5">
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold text-amber-950">
                      Aviso de Control Interno: Esta función SOLO REGISTRA en el ERP, NO EMITE ante el SII
                    </p>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      Este formulario incorpora el DTE a los libros auxiliares de compra/venta y genera el <strong>asiento contable automático IFRS</strong> en el Libro Diario. <strong>No transmite, no emite ni timbra facturas ante el Servicio de Impuestos Internos</strong>.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-amber-200/80">
                  <span className="text-[11px] text-amber-900 font-medium">
                    ¿Desea <strong>emitir y timbrar</strong> formalmente con el <strong>Robot Playwright</strong> en el SII?
                  </span>
                  {onNavigateToBilling ? (
                    <button
                      type="button"
                      onClick={() => {
                        setShowManualModal(false);
                        onNavigateToBilling();
                      }}
                      className="inline-flex items-center gap-1.5 bg-[#2563eb] hover:bg-blue-600 text-white font-semibold px-3 py-1 rounded text-[11px] transition-colors shadow-xs cursor-pointer"
                    >
                      <Bot className="w-3.5 h-3.5" />
                      <span>Presione aquí para emitir</span>
                    </button>
                  ) : (
                    <span className="text-[11px] text-blue-700 font-semibold">
                      Vaya al menú lateral: <strong>Facturación & Cobranza</strong>
                    </span>
                  )}
                </div>
              </div>
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
                <label className="block text-slate-700 font-semibold mb-1">Centro de Costo Imputado:</label>
                <select
                  value={newDte.centroCostoCodigo || ''}
                  onChange={(e) => {
                    const found = availableCostCenters.find(c => c.codigo === e.target.value);
                    setNewDte(prev => ({
                      ...prev,
                      centroCostoId: found?.id,
                      centroCostoCodigo: found?.codigo,
                      centroCostoNombre: found?.nombre,
                    }));
                  }}
                  className="w-full bg-slate-50 border border-slate-300 rounded-md p-2 text-slate-800 text-sm focus:outline-none focus:border-[#2563eb]"
                >
                  <option value="">-- Sin Centro de Costos Asignado --</option>
                  {availableCostCenters.map(cc => (
                    <option key={cc.id} value={cc.codigo}>
                      {cc.codigo} - {cc.nombre}
                    </option>
                  ))}
                </select>
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
          costCenters={costCenters}
        />
      )}

      {/* MODAL: GESTIÓN DE CENTROS DE COSTO POR ÍTEM DE FACTURA */}
      {selectedDteForItems && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-4xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-150 my-6">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-[#0f172a] text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Target className="w-5 h-5 text-indigo-400" />
                <div>
                  <h3 className="font-bold text-base flex items-center gap-2">
                    <span>Desglose por Ítem y Centro de Costos</span>
                    <span className="font-mono text-xs text-amber-400 bg-slate-800 px-2 py-0.5 rounded">
                      Folio {selectedDteForItems.folio} ({selectedDteForItems.tipoOperacion})
                    </span>
                  </h3>
                  <p className="text-xs text-slate-300">
                    {selectedDteForItems.razonSocialContraparte} • RUT: {selectedDteForItems.rutContraparte}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDteForItems(null)}
                className="text-slate-400 hover:text-white text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* Info banner */}
              <div className="bg-indigo-50/70 border border-indigo-200 rounded-lg p-3.5 flex items-start justify-between gap-4">
                <div>
                  <h4 className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-indigo-700" />
                    Contabilidad Analítica por Centro de Costos (Mini-Empresa)
                  </h4>
                  <p className="text-xs text-indigo-700 mt-0.5">
                    Cada ítem o línea de detalle de la factura electrónica imputa su costo o ingreso directamente al Centro de Costos correspondiente, alimentando el Estado de Resultados analítico.
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[11px] text-slate-500 block uppercase font-medium">Monto Total DTE</span>
                  <span className="font-mono text-base font-bold text-slate-900">
                    {formatCLP(selectedDteForItems.montoTotal)}
                  </span>
                </div>
              </div>

              {itemsSuccessMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{itemsSuccessMsg}</span>
                </div>
              )}

              {/* Quick Batch Actions */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-700">Asignación Masiva:</span>
                  <select
                    onChange={(e) => {
                      if (e.target.value) handleApplyCostCenterToAllItems(e.target.value);
                    }}
                    defaultValue=""
                    className="bg-white border border-slate-300 rounded px-2.5 py-1 text-xs text-slate-700 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="" disabled>Seleccionar Centro de Costos para todos...</option>
                    {availableCostCenters.map(cc => (
                      <option key={cc.id} value={cc.codigo}>
                        {cc.codigo} - {cc.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleAddItemRow}
                  className="px-3 py-1 bg-white hover:bg-slate-100 text-indigo-700 border border-indigo-200 rounded text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Agregar Ítem</span>
                </button>
              </div>

              {/* Items Table */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Descripción del Ítem / Servicio</th>
                      <th className="py-2.5 px-3 w-20 text-center">Cant.</th>
                      <th className="py-2.5 px-3 w-28 text-right">P. Unitario</th>
                      <th className="py-2.5 px-3 w-28 text-right">Monto Total</th>
                      <th className="py-2.5 px-3 w-52">Centro de Costo Asignado</th>
                      <th className="py-2.5 px-3 w-32">Cuenta</th>
                      <th className="py-2.5 px-2 text-center w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {editingItems.map((item, idx) => (
                      <tr key={item.id || idx} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-mono text-slate-400 font-bold">{idx + 1}</td>
                        <td className="py-2.5 px-3">
                          <input
                            type="text"
                            value={item.nombre}
                            onChange={(e) => handleItemFieldChange(idx, 'nombre', e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 text-xs focus:outline-none focus:border-indigo-500"
                            placeholder="Nombre del producto o servicio"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="number"
                            min="1"
                            value={item.cantidad}
                            onChange={(e) => handleItemFieldChange(idx, 'cantidad', e.target.value)}
                            className="w-16 bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 text-center text-xs focus:outline-none focus:border-indigo-500"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <input
                            type="number"
                            min="0"
                            value={item.precioUnitario}
                            onChange={(e) => handleItemFieldChange(idx, 'precioUnitario', e.target.value)}
                            className="w-24 bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 text-right font-mono text-xs focus:outline-none focus:border-indigo-500"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <input
                            type="number"
                            min="0"
                            value={item.montoTotal}
                            onChange={(e) => handleItemFieldChange(idx, 'montoTotal', e.target.value)}
                            className="w-24 bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 text-right font-mono font-bold text-xs focus:outline-none focus:border-indigo-500"
                          />
                        </td>
                        <td className="py-2.5 px-3">
                          <select
                            value={item.centroCostoCodigo || ''}
                            onChange={(e) => handleItemFieldChange(idx, 'centroCostoCodigo', e.target.value)}
                            className="w-full bg-white border border-indigo-300 rounded px-2 py-1 text-xs font-medium text-indigo-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          >
                            <option value="">-- Sin Centro de Costos --</option>
                            {availableCostCenters.map(cc => (
                              <option key={cc.id} value={cc.codigo}>
                                {cc.codigo} - {cc.nombre}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2.5 px-3 font-mono">
                          <input
                            type="text"
                            value={item.cuentaCodigo || ''}
                            onChange={(e) => handleItemFieldChange(idx, 'cuentaCodigo', e.target.value)}
                            className="w-24 bg-white border border-slate-300 rounded px-1.5 py-1 text-[11px] text-slate-700 focus:outline-none focus:border-indigo-500 font-mono"
                            placeholder="Cta. contable"
                          />
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          {editingItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveItemRow(idx)}
                              className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                              title="Eliminar este ítem"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Resumen por Centro de Costos de esta Factura */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                  Distribución Analítica de la Factura por Centro de Costo
                </span>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(
                    editingItems.reduce((acc, it) => {
                      const key = it.centroCostoCodigo ? `${it.centroCostoCodigo} (${it.centroCostoNombre || 'CC'})` : 'Sin Centro Asignado';
                      acc[key] = (acc[key] || 0) + (it.montoTotal || 0);
                      return acc;
                    }, {} as Record<string, number>)
                  ).map(([ccLabel, monto]) => (
                    <div
                      key={ccLabel}
                      className="bg-white border border-slate-200 px-3 py-1.5 rounded text-xs flex items-center gap-2 shadow-2xs"
                    >
                      <span className="font-semibold text-slate-700">{ccLabel}:</span>
                      <span className="font-mono font-bold text-indigo-700">{formatCLP(Number(monto))}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Total Ítems: <strong className="font-mono text-slate-800">{formatCLP(editingItems.reduce((s, it) => s + (it.montoTotal || 0), 0))}</strong>
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedDteForItems(null)}
                  className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  onClick={handleSaveItemsForDte}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
                >
                  <Check className="w-4 h-4" />
                  <span>Guardar y Actualizar Asiento Contable</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
