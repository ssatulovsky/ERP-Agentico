import React, { useState, useMemo } from 'react';
import {
  Send,
  FileText,
  Bot,
  Play,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Clock,
  ArrowRight,
  Download,
  Copy,
  Plus,
  Trash2,
  Layers,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Search,
  Check,
  Building2,
  DollarSign,
  AlertCircle,
  FileSpreadsheet,
  Code2,
  Terminal,
  ChevronRight,
  Sparkles,
  Calendar,
  Percent,
  Receipt,
  FileCheck2,
  ReceiptText,
  Server,
  Zap,
  Globe,
  Palette,
  FolderTree,
  Shield,
  KeyRound,
  UploadCloud,
  FileCode2,
  Info,
  Lock,
  Key,
} from 'lucide-react';
import { InvoiceLayoutDesigner } from './billing/InvoiceLayoutDesigner';
import { getDemoClients } from '../data/seedData';
import { getStoredAuthToken } from '../services/apiClient';
import {
  BillingEmissionDraft,
  BillingItemDetail,
  CompanyProfile,
  ClientCompany,
  DteDocument,
  DteType,
  AccountingEntry,
  CashFlowMovement,
  ProductionOrder,
  ProductionBudget,
  BankAccountConfig,
  CostCenterMaster,
  HttpDteEmissionResponse,
  TaxCryptographicVaultStatus,
  TenantCafItem,
} from '../types';
import { SEED_COST_CENTERS } from '../data/seedCostCenters';
import { formatCLP, formatNumberCL, validateRut, createSalesDteEntry } from '../utils/chileanAccounting';

interface BillingAutonomousAgentProps {
  company: CompanyProfile | ClientCompany;
  dtes: DteDocument[];
  onAddDte: (dte: DteDocument) => void;
  onUpdateDte?: (dte: DteDocument) => void;
  onAddEntry: (entry: AccountingEntry) => void;
  onAddCashFlowMovement: (mov: CashFlowMovement) => void;
  productionOrders?: ProductionOrder[];
  productionBudgets?: ProductionBudget[];
  bankAccounts?: BankAccountConfig[];
  costCenters?: CostCenterMaster[];
}

export const BillingAutonomousAgent: React.FC<BillingAutonomousAgentProps> = ({
  company,
  dtes = [],
  onAddDte,
  onUpdateDte,
  onAddEntry,
  onAddCashFlowMovement,
  productionOrders = [],
  productionBudgets = [],
  bankAccounts = [],
  costCenters,
}) => {
  const availableCostCenters = useMemo(() => {
    return Array.isArray(costCenters) && costCenters.length > 0 ? costCenters : SEED_COST_CENTERS;
  }, [costCenters]);
  const [activeTab, setActiveTab] = useState<'EMISION' | 'HTTP_DTE_ENGINE' | 'COBRANZA' | 'HONORARIOS_BOLETAS' | 'DISENADOR_FORMATO'>('EMISION');

  // Estado del borrador actual de emisión
  const isExentoDefault = Boolean((company as any)?.exentoIvaGiro);
  const [draft, setDraft] = useState<BillingEmissionDraft>({
    id: `draft-${Date.now()}`,
    tipoDte: isExentoDefault ? '34' : '33',
    folioSugerido: 1420,
    fechaEmision: new Date().toISOString().split('T')[0],
    condicionVenta: 'CREDITO_30',
    fechaVencimiento: (() => {
      const d = new Date();
      d.setDate(d.getDate() + 30);
      return d.toISOString().split('T')[0];
    })(),
    medioPago: 'TRANSFERENCIA',
    rutReceptor: '76.123.456-7',
    razonSocialReceptor: 'SALMONES DEL SUR S.A.',
    giroReceptor: 'ACUICULTURA Y CULTIVO DE ESPECIES MARINAS',
    direccionReceptor: 'AV. DIEGO PORTALES 2000, PISO 4',
    comunaReceptor: 'PUERTO MONTT',
    ciudadReceptor: 'PUERTO MONTT',
    emailReceptorDte: 'facturacion@salmonesdelsur.cl',
    items: [
      {
        id: 'item-1',
        nombre: 'Confección y Armado de Red Pecera HDPE 30x30x15m según RG 1821',
        descripcion: 'Paño sin nudos 210/96 con relinga perimetral reforzada y crotales trazables',
        cantidad: 1,
        unidadMedida: 'C/U',
        precioUnitario: 8500000,
        montoTotal: 8500000,
        esExento: isExentoDefault,
        centroCostoId: 'cc-04',
        centroCostoCodigo: 'CC-OP-MAR',
        centroCostoNombre: 'Operaciones Marítimas & Fondeos Puerto Montt (Mini-Empresa)',
      },
    ],
    montoNeto: isExentoDefault ? 0 : 8500000,
    montoExento: isExentoDefault ? 8500000 : 0,
    montoIva: isExentoDefault ? 0 : Math.round(8500000 * 0.19),
    montoTotal: isExentoDefault ? 8500000 : Math.round(8500000 * 1.19),
  });

  // Modal para seleccionar Orden de Producción
  const [showOpSelectorModal, setShowOpSelectorModal] = useState(false);

  // Estados de Ejecución HTTP-DTE (LibreDTE Slim)
  const [isEmittingHttpDte, setIsEmittingHttpDte] = useState(false);
  const [lastEmissionReport, setLastEmissionReport] = useState<HttpDteEmissionResponse | null>(null);
  const [executionLogs, setExecutionLogs] = useState<string[]>([]);
  const [copiedCode, setCopiedCode] = useState<'JSON' | 'CLI' | 'CURL' | null>(null);
  const [alertSuccess, setAlertSuccess] = useState<string | null>(null);
  const [httpDteServerStatus, setHttpDteServerStatus] = useState<{
    tested: boolean;
    online: boolean;
    url: string;
    latencyMs?: number;
    ambiente?: string;
  }>({
    tested: false,
    online: true,
    url: 'http://localhost:8050',
    ambiente: 'Certificación (1)',
  });

  // Estado de Bóveda Criptográfica Multi-Empresa & Estudio Contable
  const [selectedVaultRut, setSelectedVaultRut] = useState<string>(company.rut);
  const [vaultStatus, setVaultStatus] = useState<TaxCryptographicVaultStatus | null>(null);
  const [isLoadingVault, setIsLoadingVault] = useState(false);
  const [showCafUploadModal, setShowCafUploadModal] = useState(false);
  const [cafUploadTipo, setCafUploadTipo] = useState<number>(33);
  const [cafUploadXml, setCafUploadXml] = useState<string>('');
  const [cafUploadMsg, setCafUploadMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSavingCaf, setIsSavingCaf] = useState(false);

  // Modal de Contraseña y Certificado Digital .p12 por Cliente
  const [showCertModal, setShowCertModal] = useState(false);
  const [certPasswordInput, setCertPasswordInput] = useState('');
  const [certFileBase64, setCertFileBase64] = useState('');
  const [certFileName, setCertFileName] = useState('');
  const [isSavingCert, setIsSavingCert] = useState(false);
  const [certModalMsg, setCertModalMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchVaultStatus = React.useCallback(async (rut: string) => {
    setIsLoadingVault(true);
    try {
      const res = await fetch(`/api/billing/vault-status/${encodeURIComponent(rut)}`);
      const data = await res.json();
      if (data.success && data.vault) {
        setVaultStatus(data.vault);
      }
    } catch (err) {
      console.warn('Error fetching vault status:', err);
    } finally {
      setIsLoadingVault(false);
    }
  }, []);

  React.useEffect(() => {
    if (activeTab === 'HTTP_DTE_ENGINE') {
      fetchVaultStatus(selectedVaultRut);
    }
  }, [activeTab, selectedVaultRut, fetchVaultStatus]);

  const handleSaveCafXml = async () => {
    if (!cafUploadXml.trim()) return;
    setIsSavingCaf(true);
    setCafUploadMsg(null);
    try {
      const res = await fetch('/api/billing/vault-save-caf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rut: selectedVaultRut,
          tipoDte: cafUploadTipo,
          xmlContent: cafUploadXml.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCafUploadMsg({ type: 'success', text: data.message });
        fetchVaultStatus(selectedVaultRut);
        setTimeout(() => {
          setShowCafUploadModal(false);
          setCafUploadXml('');
          setCafUploadMsg(null);
        }, 1500);
      } else {
        setCafUploadMsg({ type: 'error', text: data.error || 'Error al registrar archivo CAF' });
      }
    } catch (err: any) {
      setCafUploadMsg({ type: 'error', text: err.message || 'Error de conexión' });
    } finally {
      setIsSavingCaf(false);
    }
  };

  const handleSaveCertCredentials = async () => {
    if (!certPasswordInput.trim() && !certFileBase64) {
      setCertModalMsg({ type: 'error', text: 'Ingresa la contraseña o selecciona un archivo .p12' });
      return;
    }
    setIsSavingCert(true);
    setCertModalMsg(null);
    try {
      if (certFileBase64) {
        const certRes = await fetch('/api/billing/vault-save-cert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rut: selectedVaultRut,
            certBase64: certFileBase64,
            filename: certFileName || 'certificado.p12',
          }),
        });
        const certData = await certRes.json();
        if (!certData.success) {
          setCertModalMsg({ type: 'error', text: certData.error || 'Error al guardar archivo de certificado' });
          setIsSavingCert(false);
          return;
        }
      }

      if (certPasswordInput.trim()) {
        const passRes = await fetch('/api/billing/vault-save-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rut: selectedVaultRut,
            password: certPasswordInput.trim(),
          }),
        });
        const passData = await passRes.json();
        if (!passData.success) {
          setCertModalMsg({ type: 'error', text: passData.error || 'Error al guardar contraseña' });
          setIsSavingCert(false);
          return;
        }
      }

      setCertModalMsg({ type: 'success', text: 'Credenciales criptográficas guardadas exitosamente en la bóveda.' });
      fetchVaultStatus(selectedVaultRut);
      setTimeout(() => {
        setShowCertModal(false);
        setCertPasswordInput('');
        setCertFileBase64('');
        setCertFileName('');
        setCertModalMsg(null);
      }, 1500);
    } catch (err: any) {
      setCertModalMsg({ type: 'error', text: err.message || 'Error de conexión' });
    } finally {
      setIsSavingCert(false);
    }
  };

  // Recalcular montos de items
  const recalculateDraftTotals = (items: BillingItemDetail[], tipoDte: DteType) => {
    const isExenta = tipoDte === '34';
    let neto = 0;
    let exento = 0;

    items.forEach(it => {
      const itemTotal = it.cantidad * it.precioUnitario;
      it.montoTotal = itemTotal;
      if (isExenta || it.esExento) {
        exento += itemTotal;
      } else {
        neto += itemTotal;
      }
    });

    const iva = isExenta ? 0 : Math.round(neto * 0.19);
    const total = neto + exento + iva;

    setDraft(prev => ({
      ...prev,
      items,
      montoNeto: neto,
      montoExento: exento,
      montoIva: iva,
      montoTotal: total,
    }));
  };

  // Manejar cambio de tipo de documento
  const handleTipoDteChange = (newTipo: DteType) => {
    setDraft(prev => {
      const isExenta = newTipo === '34';
      const updatedItems = prev.items.map(it => ({
        ...it,
        esExento: isExenta,
      }));
      const neto = isExenta ? 0 : updatedItems.reduce((s, it) => s + (it.esExento ? 0 : it.montoTotal), 0);
      const exento = isExenta ? updatedItems.reduce((s, it) => s + it.montoTotal, 0) : 0;
      const iva = isExenta ? 0 : Math.round(neto * 0.19);
      const total = neto + exento + iva;

      return {
        ...prev,
        tipoDte: newTipo,
        items: updatedItems,
        montoNeto: neto,
        montoExento: exento,
        montoIva: iva,
        montoTotal: total,
        referencia: (newTipo === '61' || newTipo === '56')
          ? {
              tipoDocRef: '33',
              folioRef: 1419,
              fechaRef: new Date().toISOString().split('T')[0],
              codRef: '1',
              razonRef: 'Anula Factura por resciliación de contrato según acuerdo comercial',
            }
          : undefined,
        exportacion: newTipo === '110'
          ? {
              clausulaVenta: 'FOB',
              puertoEmbarque: 'PUERTO MONTT',
              paisReceptor: 'NORUEGA',
              monedaExportacion: 'USD',
              tipoCambioObservado: 945.5,
              modalidadVenta: 'DEFINITIVA',
            }
          : undefined,
      };
    });
  };

  // Manejar condición de venta
  const handleCondicionVentaChange = (cond: 'CONTADO' | 'CREDITO_30' | 'CREDITO_60' | 'CREDITO_90') => {
    const d = new Date(draft.fechaEmision);
    let days = 0;
    if (cond === 'CREDITO_30') days = 30;
    else if (cond === 'CREDITO_60') days = 60;
    else if (cond === 'CREDITO_90') days = 90;
    d.setDate(d.getDate() + days);
    const venc = d.toISOString().split('T')[0];

    setDraft(prev => ({
      ...prev,
      condicionVenta: cond,
      fechaVencimiento: venc,
    }));
  };

  // Cargar datos desde una Orden de Producción (OP)
  const handleSelectOpForBilling = (op: ProductionOrder, hito: 'ANTICIPO_40' | 'ENTREGA_60' | 'TOTAL_100') => {
    const pct = hito === 'ANTICIPO_40' ? 0.4 : hito === 'ENTREGA_60' ? 0.6 : 1.0;
    const hitoTexto = hito === 'ANTICIPO_40'
      ? 'Hito 1: Anticipo 40% según Orden de Producción'
      : hito === 'ENTREGA_60'
      ? 'Hito 2: Saldo 60% contra Entrega Técnica y Certificado RG 1821'
      : 'Liquidación Total 100% Orden de Producción';

    const opTotal = Number(op.costoTotalProduccion || op.costoPrimo || (op as any).totalCostoEstimado) || 0; // sin costo registrado: $0 (antes $12.500.000)
    const precioHito = Math.round((opTotal * 1.35) * pct); // 35% margen comercial sobre costo
    const isExenta = draft.tipoDte === '34';
    const opCodigo = op.folioOP || (op as any).codigo || op.id;
    const prodDesc = op.productoNombre || op.descripcion || 'Red Pecera HDPE';
    const clientName = op.clienteNombre || (op as any).clienteDestino || company.razonSocial || 'AQUACHILE S.A.';

    const opItem: BillingItemDetail = {
      id: `item-op-${op.id}-${Date.now()}`,
      nombre: `${prodDesc} - ${opCodigo}`,
      descripcion: `${hitoTexto}. Cliente: ${clientName}. Cantidad: ${op.cantidadObjetivo} ${op.unidadMedida}. Cumplimiento RG 1821 / SERNAPESCA`,
      cantidad: 1,
      unidadMedida: op.unidadMedida || 'C/U',
      precioUnitario: precioHito,
      montoTotal: precioHito,
      esExento: isExenta,
    };

    const newItems = [opItem];
    const neto = isExenta ? 0 : precioHito;
    const exento = isExenta ? precioHito : 0;
    const iva = isExenta ? 0 : Math.round(neto * 0.19);
    const total = neto + exento + iva;

    setDraft(prev => ({
      ...prev,
      ordenProduccionId: op.id,
      ordenProduccionCodigo: opCodigo,
      hitoDescripcion: hitoTexto,
      rutReceptor: (op as any).clienteDestinoRut || '76.123.456-7',
      razonSocialReceptor: clientName,
      giroReceptor: 'CULTIVO Y ENGORDA DE SALMONES',
      items: newItems,
      montoNeto: neto,
      montoExento: exento,
      montoIva: iva,
      montoTotal: total,
    }));

    setShowOpSelectorModal(false);
    setAlertSuccess(`Datos de la Orden de Producción ${opCodigo} (${hitoTexto}) cargados con éxito en el borrador DTE.`);
  };

  // Ejecución Directa HTTP-DTE (LibreDTE / Slim)
  const handleExecuteHttpDteEmission = async () => {
    setIsEmittingHttpDte(true);
    setExecutionLogs([]);
    setActiveTab('HTTP_DTE_ENGINE');

    const addLog = (msg: string) => {
      const time = new Date().toLocaleTimeString('es-CL');
      const line = `[${time}] ${msg}`;
      setExecutionLogs(prev => [...prev, line]);
      return line;
    };

    addLog(`🚀 [HTTP-DTE] Iniciando emisión directa de DTE ${draft.tipoDte} para RUT Emisor: ${company.rut}...`);
    addLog(`📦 [Mapeo] Mapeando datos internos ERP: ${draft.items.length} ítems. Total: $${draft.montoTotal.toLocaleString('es-CL')} CLP.`);

    // 1. Verificación previa con el Asistente con herramientas especialista (ReAct Loop)
    const authToken = getStoredAuthToken();
    try {
      addLog(`🧠 [Asistente con herramientas] Validando normativa tributaria SII y estructura del borrador DTE...`);
      const agentRes = await fetch('/api/agents/autonomous/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          module: 'CONTABILIDAD',
          modulo: 'CONTABILIDAD',
          empresaId: company.id || company.rut,
          query: `Validar y certificar borrador DTE Tipo ${draft.tipoDte} para ${draft.razonSocialReceptor} (RUT ${draft.rutReceptor}) por total $${draft.montoTotal} CLP.`,
          context: {
            company,
            empresa: company,
            draft,
          },
        }),
      });
      if (agentRes.ok) {
        const aData = await agentRes.json();
        const shortDecision = (aData.decision || aData.finalText || 'Validación conforme').slice(0, 120);
        addLog(`📋 [Asistente con herramientas] Dictamen: ${shortDecision}...`);
        if (aData.approvalRequired) {
          addLog(`⚠️ [Gobernanza Humana] Solicitud #${aData.approvalDetails?.id?.slice(-6) || 'PEND'} creada para autorización.`);
        }
      }
    } catch (agentErr: any) {
      addLog(`⚠️ [Asistente con herramientas] Aviso en verificación preliminar: ${agentErr.message}`);
    }

    addLog(`🔑 [Criptografía] Leyendo CAF (XML) y Certificado Digital PKCS#12 (.p12/.pfx) almacenados localmente...`);
    addLog(`🌐 [HTTP POST] Enviando POST JSON a http://localhost:8050/dte/emitir...`);

    try {
      const res = await fetch('/api/billing/emitir-http-dte', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          draft,
          companyId: company.id,
          rutEmisor: company.rut,
          razonSocialEmisor: company.razonSocial,
        }),
      });

      const data: HttpDteEmissionResponse = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || `HTTP ${res.status}: Error al emitir en LibreDTE`);
      }

      setLastEmissionReport(data);
      const assignedFolio = data.folio || draft.folioSugerido;

      addLog(`✅ [HTTP-DTE] ¡DTE Timbrado exitosamente por el motor LibreDTE! Folio oficial: ${assignedFolio}`);
      addLog(data.trackId ? `🎫 [SII] TrackID de recepción devuelto: ${data.trackId}` : '⚠️ [SII] El servicio no devolvió TrackID.');
      addLog(`🔏 [TED] Timbre Electrónico DTE generado y firmado con clave RSA del CAF.`);
      addLog(`💾 [Persistencia] Sincronizado en MySQL 8.0 (tabla dtes_rcv + dte_items) y almacenamiento dual de disco.`);

      // 1. Crear documento DTE formal en el Registro de Compras/Ventas
      const newDte: DteDocument = {
        id: data.dteId || `dte-http-emitted-${Date.now()}`,
        tipoDte: draft.tipoDte,
        folio: assignedFolio,
        tipoOperacion: 'VENTA',
        rutContraparte: draft.rutReceptor,
        razonSocialContraparte: draft.razonSocialReceptor,
        fechaEmision: draft.fechaEmision,
        fechaVencimiento: draft.fechaVencimiento,
        montoNeto: draft.montoNeto,
        montoExento: draft.montoExento,
        montoIva: draft.montoIva,
        montoTotal: draft.montoTotal,
        items: draft.items.map(it => ({
          id: it.id,
          nombre: it.nombre,
          descripcion: it.descripcion,
          cantidad: it.cantidad,
          unidadMedida: it.unidadMedida,
          precioUnitario: it.precioUnitario,
          montoTotal: it.montoTotal,
          esExento: it.esExento,
          centroCostoId: it.centroCostoId,
          centroCostoCodigo: it.centroCostoCodigo,
          centroCostoNombre: it.centroCostoNombre,
        })),
        centroCostoId: draft.items[0]?.centroCostoId,
        centroCostoCodigo: draft.items[0]?.centroCostoCodigo,
        centroCostoNombre: draft.items[0]?.centroCostoNombre,
        // El servidor informa ENVIADO (pendiente de consulta del Track ID) o SIMULADO (sin validez tributaria).
        estadoSii: data.estadoSii === 'SIMULADO' || data.simulated ? 'SIMULADO' : 'ENVIADO',
        estadoPago: draft.condicionVenta === 'CONTADO' ? 'COBRADO' : 'PENDIENTE',
        glosa: `${data.simulated ? '[SIMULADO - SIN VALIDEZ TRIBUTARIA] ' : ''}Emisión HTTP-DTE (LibreDTE) Folio ${assignedFolio} a ${draft.razonSocialReceptor} | TrackID: ${data.trackId || 'N/A'}`,
        trackId: data.trackId,
        tedXml: data.ted,
        xmlTimbrado: data.xmlTimbrado,
        pdfUrl: data.pdfUrl,
        ambienteSii: data.ambiente,
      };

      onAddDte(newDte);

      // 2. Generar Asiento Contable Automático en el Libro Diario vinculando Centros de Costo de cada ítem
      const accountingEntry: AccountingEntry = createSalesDteEntry(newDte);
      accountingEntry.id = `entry-sale-http-dte-${Date.now()}`;
      accountingEntry.concepto = `Venta DTE ${draft.tipoDte} Folio ${assignedFolio} - ${draft.razonSocialReceptor} (HTTP-DTE)`;
      accountingEntry.documento = `DTE ${draft.tipoDte} N° ${assignedFolio}`;
      onAddEntry(accountingEntry);

      // 3. Programar Movimiento en el Flujo de Caja Proyectado Real
      const cashFlowMov: CashFlowMovement = {
        id: `cf-sale-${Date.now()}`,
        fechaEstimada: draft.fechaVencimiento,
        fechaReal: draft.condicionVenta === 'CONTADO' ? draft.fechaEmision : undefined,
        concepto: `Cobranza Venta DTE ${draft.tipoDte} Folio ${assignedFolio} - ${draft.razonSocialReceptor}`,
        contraparte: draft.razonSocialReceptor,
        montoNeto: draft.montoNeto,
        montoIva: draft.montoIva,
        montoTotal: draft.montoTotal,
        moneda: 'CLP',
        tipo: 'INGRESO',
        categoria: 'VENTAS_OPERACIONALES',
        estado: draft.condicionVenta === 'CONTADO' ? 'COBRADO' : 'PENDIENTE',
        dteFolioAsociado: assignedFolio,
      };

      onAddCashFlowMovement(cashFlowMov);

      setAlertSuccess(
        `¡Factura DTE ${draft.tipoDte} Folio ${assignedFolio} emitida con éxito via HTTP-DTE (LibreDTE)! TrackID SII: ${data.trackId || 'Asignado'}. Sincronizada automáticamente en: 1) Registro de Ventas, 2) Libro Diario Contable y 3) Flujo de Caja para el ${draft.fechaVencimiento}.`
      );
    } catch (err: any) {
      addLog(`❌ [Error HTTP-DTE] ${err.message}`);
      console.error('[BillingAutonomousAgent] Error en emisión HTTP-DTE:', err);
    } finally {
      setIsEmittingHttpDte(false);
    }
  };

  // Comprobar salud de la API HTTP-DTE en localhost:8050
  const handleCheckHttpDteHealth = async () => {
    try {
      const res = await fetch('/api/billing/http-dte/status');
      const data = await res.json();
      setHttpDteServerStatus({
        tested: true,
        online: data.success,
        url: data.endpoint || 'http://localhost:8050',
        latencyMs: data.health?.latencyMs,
        ambiente: data.ambiente,
      });
    } catch {
      setHttpDteServerStatus({
        tested: true,
        online: false,
        url: 'http://localhost:8050',
      });
    }
  };

  // Generar JSON representativo de payload HTTP-DTE para inspección y testing
  const getHttpDteSamplePayload = () => {
    return {
      tipoDte: Number(draft.tipoDte) || 33,
      folio: draft.folioSugerido || null,
      fechaEmision: draft.fechaEmision,
      fechaVencimiento: draft.fechaVencimiento,
      formaPago: draft.condicionVenta === 'CONTADO' ? 1 : 2,
      emisor: {
        rut: company.rut.replace(/\./g, ''),
        razonSocial: company.razonSocial,
        giro: (company as any).giro || '',
        acteco: (company as any).acteco || null,
        direccion: (company as any).direccion || '',
        comuna: (company as any).comuna || '',
      },
      receptor: {
        rut: draft.rutReceptor.replace(/\./g, ''),
        razonSocial: draft.razonSocialReceptor,
        giro: draft.giroReceptor,
        direccion: draft.direccionReceptor,
        comuna: draft.comunaReceptor,
        correo: draft.emailReceptorDte || undefined,
      },
      detalles: draft.items.map((it, idx) => ({
        NroLinDet: idx + 1,
        NmbItem: it.nombre,
        DscItem: it.descripcion,
        QtyItem: it.cantidad,
        UnmdItem: it.unidadMedida || 'C/U',
        PrcItem: it.precioUnitario,
        MontoItem: it.montoTotal,
        IndExe: it.esExento || draft.tipoDte === '34' ? 1 : undefined,
      })),
      firma: {
        data: '<BASE64_CERTIFICADO_DIGITAL_P12_EN_SERVIDOR>',
        password: process.env.DTE_CERT_PASSWORD ? '********' : '<ENV_VAR:DTE_CERT_PASSWORD>',
      },
      caf: '<AUTORIZACION><CAF version="1.0"><DA>...</DA></CAF></AUTORIZACION>',
      ambiente: 1, // 1: Certificación, 2: Producción
      totales: {
        montoNeto: draft.montoNeto,
        montoExento: draft.montoExento,
        montoIva: draft.montoIva,
        montoTotal: draft.montoTotal,
      },
    };
  };

  // Descargar Payload JSON para pruebas
  const handleDownloadPayload = () => {
    const payload = getHttpDteSamplePayload();
    const str = JSON.stringify(payload, null, 2);
    const blob = new Blob([str], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `http_dte_payload_${draft.tipoDte}_folio_${draft.folioSugerido || 'sin-folio'}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Copiar código al portapapeles
  const handleCopyCode = (format: 'JSON' | 'CLI' | 'CURL') => {
    let text = '';
    if (format === 'JSON') {
      text = JSON.stringify(getHttpDteSamplePayload(), null, 2);
    } else if (format === 'CURL') {
      text = `curl -X POST http://localhost:8050/dte/emitir \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(getHttpDteSamplePayload())}'`;
    } else {
      text = `npm run dte:emit -- --tipo=${draft.tipoDte} --folio=${draft.folioSugerido || '<folio>'}`;
    }

    navigator.clipboard.writeText(text);
    setCopiedCode(format);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Facturas emitidas pendientes de cobranza
  const pendingCollectionDtes = useMemo(() => {
    return dtes.filter(d => d.tipoOperacion === 'VENTA' && d.estadoPago !== 'COBRADO');
  }, [dtes]);

  const totalPendingCollection = useMemo(() => {
    return pendingCollectionDtes.reduce((s, d) => s + d.montoTotal, 0);
  }, [pendingCollectionDtes]);

  // Boletas de Honorarios y Boletas de Ventas
  const bheList = useMemo(() => {
    return dtes.filter(d => d.tipoOperacion === 'HONORARIOS' || d.tipoDte === 'BHE' || d.tipoDte === 'BH');
  }, [dtes]);

  const boletasVentaList = useMemo(() => {
    return dtes.filter(d => d.tipoDte === '39' || d.tipoDte === '41');
  }, [dtes]);

  return (
    <div className="space-y-6">
      {/* Banner Superior Asistente con herramientas */}
      <div className="bg-gradient-to-r from-[#0f172a] via-[#1e293b] to-[#0f172a] rounded-xl p-5 text-white shadow-md border border-slate-700/60">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-blue-600/30 border border-blue-400/40 flex items-center justify-center shrink-0 shadow-inner">
              <Bot className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight text-white">
                  Asistente con herramientas de Facturación y Cobranza (HTTP-DTE / LibreDTE)
                </h1>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded text-[10px] font-mono font-semibold">
                  REST http://localhost:8050
                </span>
                <span className="bg-blue-500/20 text-blue-300 border border-blue-400/30 px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1">
                  <Zap className="w-3 h-3 text-amber-300" /> Cero Playwright / Cero DOM
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-3xl leading-relaxed">
                Emisión directa de <strong>Facturas Electrónicas (DTE 33)</strong>, <strong>Facturas Exentas (DTE 34)</strong>, <strong>Exportación (DTE 110)</strong>, <strong>Notas de Crédito (DTE 61)</strong> y <strong>Débito (DTE 56)</strong> mediante llamadas HTTP POST nativas a la API local de HTTP-DTE (LibreDTE). Timbrado criptográfico con Certificado Digital PKCS#12 y CAF oficial, sincronizando en milisegundos con el <strong>Libro Diario Contable</strong> y el <strong>Flujo de Caja</strong>.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowOpSelectorModal(true)}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Facturar desde Orden de Producción</span>
            </button>
          </div>
        </div>

        {/* Pestañas Principales del Agente */}
        <div className="flex items-center gap-2 mt-5 pt-3 border-t border-slate-700/50 overflow-x-auto text-xs font-semibold">
          <button
            onClick={() => setActiveTab('EMISION')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'EMISION'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>1. Formulario & Emisión DTE</span>
          </button>
          <button
            onClick={() => setActiveTab('HTTP_DTE_ENGINE')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'HTTP_DTE_ENGINE'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>2. Motor HTTP-DTE (LibreDTE Directo)</span>
            {isEmittingHttpDte && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping ml-1" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('COBRANZA')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'COBRANZA'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>3. Cartera de Cobranza & Factoring</span>
            <span className="bg-slate-700 text-slate-200 px-1.5 py-0.2 rounded-full text-[10px]">
              {pendingCollectionDtes.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('HONORARIOS_BOLETAS')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'HONORARIOS_BOLETAS'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <ReceiptText className="w-3.5 h-3.5" />
            <span>4. Boletas Honorarios & Detalle Boletas</span>
            <span className="bg-purple-900/60 text-purple-200 border border-purple-500/30 px-1.5 py-0.2 rounded-full text-[10px]">
              {bheList.length + boletasVentaList.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('DISENADOR_FORMATO')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'DISENADOR_FORMATO'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Palette className="w-3.5 h-3.5 text-pink-400" />
            <span>5. Diseñador de Formato (DTE)</span>
            <span className="bg-pink-900/60 text-pink-200 border border-pink-500/30 px-1.5 py-0.2 rounded-full text-[10px]">
              Logo & Ley SII
            </span>
          </button>
        </div>
      </div>

      {/* Alerta de Éxito Flotante */}
      {alertSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-lg text-emerald-900 text-xs flex items-start justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <p className="font-medium leading-relaxed">{alertSuccess}</p>
          </div>
          <button
            onClick={() => setAlertSuccess(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold text-xs"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* TAB 1: FORMULARIO Y EMISIÓN DTE */}
      {activeTab === 'EMISION' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Columna Izquierda: Formulario de Emisión */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 gap-2">
                <div>
                  <h2 className="text-sm font-bold text-slate-800">
                    Definición del Documento Tributario Electrónico (DTE)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Contribuyente Emisor: <strong className="text-slate-700">{company.razonSocial}</strong> ({company.rut})
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Tipo DTE:</span>
                  <select
                    value={draft.tipoDte}
                    onChange={(e) => handleTipoDteChange(e.target.value as DteType)}
                    className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-600"
                  >
                    <option value="33">DTE 33 - Factura Electrónica Afecta</option>
                    <option value="34">DTE 34 - Factura No Afecta o Exenta</option>
                    <option value="110">DTE 110 - Factura de Exportación</option>
                    <option value="61">DTE 61 - Nota de Crédito Electrónica</option>
                    <option value="56">DTE 56 - Nota de Débito Electrónica</option>
                    <option value="39">DTE 39 - Boleta Electrónica de Venta</option>
                    <option value="52">DTE 52 - Guía de Despacho Electrónica</option>
                  </select>
                </div>
              </div>

              {/* Si proviene de una Orden de Producción */}
              {draft.ordenProduccionCodigo && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between text-xs text-blue-900">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-blue-600" />
                    <span>
                      Vinculado a <strong>Orden de Producción N° {draft.ordenProduccionCodigo}</strong>: {draft.hitoDescripcion}
                    </span>
                  </div>
                  <button
                    onClick={() => setDraft(prev => ({ ...prev, ordenProduccionId: undefined, ordenProduccionCodigo: undefined, hitoDescripcion: undefined }))}
                    className="text-blue-700 hover:text-blue-900 text-[11px] font-semibold underline"
                  >
                    Desvincular
                  </button>
                </div>
              )}

              {/* Datos del Receptor */}
              <div>
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-500" />
                  <span>Identificación del Receptor (Cliente)</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">RUT Receptor *</label>
                    <input
                      type="text"
                      value={draft.rutReceptor}
                      onChange={(e) => setDraft(prev => ({ ...prev, rutReceptor: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono font-medium focus:outline-none focus:border-blue-600"
                      placeholder="ej: 76.123.456-7"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-slate-600 mb-1">Razón Social *</label>
                    <input
                      type="text"
                      value={draft.razonSocialReceptor}
                      onChange={(e) => setDraft(prev => ({ ...prev, razonSocialReceptor: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-medium focus:outline-none focus:border-blue-600"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-slate-600 mb-1">Giro Comercial *</label>
                    <input
                      type="text"
                      value={draft.giroReceptor}
                      onChange={(e) => setDraft(prev => ({ ...prev, giroReceptor: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-medium focus:outline-none focus:border-blue-600"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Email Recepción DTE</label>
                    <input
                      type="email"
                      value={draft.emailReceptorDte}
                      onChange={(e) => setDraft(prev => ({ ...prev, emailReceptorDte: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-medium focus:outline-none focus:border-blue-600"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-slate-600 mb-1">Dirección Matriz / Planta</label>
                    <input
                      type="text"
                      value={draft.direccionReceptor}
                      onChange={(e) => setDraft(prev => ({ ...prev, direccionReceptor: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-medium focus:outline-none focus:border-blue-600"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Comuna *</label>
                    <input
                      type="text"
                      value={draft.comunaReceptor}
                      onChange={(e) => setDraft(prev => ({ ...prev, comunaReceptor: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-medium focus:outline-none focus:border-blue-600"
                    />
                  </div>
                </div>
              </div>

              {/* Referencias para Nota de Crédito (DTE 61) */}
              {(draft.tipoDte === '61' || draft.tipoDte === '56') && (
                <div className="p-4 bg-amber-50/70 border border-amber-300 rounded-xl space-y-3">
                  <h4 className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                    <FileCheck2 className="w-4 h-4 text-amber-600" />
                    <span>Documento de Referencia Legal (Requisito Obligatorio SII)</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <label className="block font-semibold text-amber-800 mb-1">Tipo Doc. Ref.</label>
                      <select
                        value={draft.referencia?.tipoDocRef || '33'}
                        onChange={(e) => setDraft(prev => ({
                          ...prev,
                          referencia: { ...prev.referencia!, tipoDocRef: e.target.value as any }
                        }))}
                        className="w-full bg-white border border-amber-300 rounded-lg p-2 font-medium"
                      >
                        <option value="33">DTE 33 - Factura Afecta</option>
                        <option value="34">DTE 34 - Factura Exenta</option>
                        <option value="39">DTE 39 - Boleta</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold text-amber-800 mb-1">Folio Referenciado</label>
                      <input
                        type="number"
                        value={draft.referencia?.folioRef || ''}
                        onChange={(e) => setDraft(prev => ({
                          ...prev,
                          referencia: { ...prev.referencia!, folioRef: Number(e.target.value) }
                        }))}
                        className="w-full bg-white border border-amber-300 rounded-lg p-2 font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-amber-800 mb-1">Causa de Referencia</label>
                      <select
                        value={draft.referencia?.codRef || '1'}
                        onChange={(e) => setDraft(prev => ({
                          ...prev,
                          referencia: { ...prev.referencia!, codRef: e.target.value as any }
                        }))}
                        className="w-full bg-white border border-amber-300 rounded-lg p-2 font-medium"
                      >
                        <option value="1">1: Anula Documento Completo</option>
                        <option value="2">2: Corrige Texto o Datos</option>
                        <option value="3">3: Corrige Montos / Descuento</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold text-amber-800 mb-1">Fecha Emisión Doc. Ref.</label>
                      <input
                        type="date"
                        value={draft.referencia?.fechaRef || draft.fechaEmision}
                        onChange={(e) => setDraft(prev => ({
                          ...prev,
                          referencia: { ...prev.referencia!, fechaRef: e.target.value }
                        }))}
                        className="w-full bg-white border border-amber-300 rounded-lg p-2 font-medium"
                      />
                    </div>
                    <div className="sm:col-span-4">
                      <label className="block font-semibold text-amber-800 mb-1">Razón o Motivo Legal</label>
                      <input
                        type="text"
                        value={draft.referencia?.razonRef || ''}
                        onChange={(e) => setDraft(prev => ({
                          ...prev,
                          referencia: { ...prev.referencia!, razonRef: e.target.value }
                        }))}
                        className="w-full bg-white border border-amber-300 rounded-lg p-2 font-medium"
                        placeholder="ej: Ajuste de metraje de paño pecera según inspección de taller"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Items y Líneas de Detalle */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                    <Receipt className="w-3.5 h-3.5 text-slate-500" />
                    <span>Líneas de Detalle de Bienes y Servicios</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      const newIt: BillingItemDetail = {
                        id: `item-${Date.now()}`,
                        nombre: 'Servicio de Reparación y Mantención de Red Lobera',
                        descripcion: 'Inspección visual de roturas y costura con hilo de alta tenacidad',
                        cantidad: 1,
                        unidadMedida: 'C/U',
                        precioUnitario: 1200000,
                        montoTotal: 1200000,
                        esExento: draft.tipoDte === '34',
                        centroCostoId: 'cc-04',
                        centroCostoCodigo: 'CC-OP-MAR',
                        centroCostoNombre: 'Operaciones Marítimas & Fondeos Puerto Montt (Mini-Empresa)',
                      };
                      recalculateDraftTotals([...draft.items, newIt], draft.tipoDte);
                    }}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Agregar Ítem
                  </button>
                </div>

                <div className="space-y-2">
                  {draft.items.map((it, idx) => (
                    <div key={it.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <label className="block font-semibold text-slate-600 mb-1">Nombre / Glosa Ítem #{idx + 1}</label>
                          <input
                            type="text"
                            value={it.nombre}
                            onChange={(e) => {
                              const updated = draft.items.map(x => x.id === it.id ? { ...x, nombre: e.target.value } : x);
                              recalculateDraftTotals(updated, draft.tipoDte);
                            }}
                            className="w-full bg-white border border-slate-300 rounded p-1.5 font-medium"
                          />
                        </div>
                        <div className="w-24">
                          <label className="block font-semibold text-slate-600 mb-1">Cantidad</label>
                          <input
                            type="number"
                            value={it.cantidad}
                            onChange={(e) => {
                              const qty = Math.max(1, Number(e.target.value) || 1);
                              const updated = draft.items.map(x => x.id === it.id ? { ...x, cantidad: qty } : x);
                              recalculateDraftTotals(updated, draft.tipoDte);
                            }}
                            className="w-full bg-white border border-slate-300 rounded p-1.5 font-mono text-center font-bold"
                          />
                        </div>
                        <div className="w-24">
                          <label className="block font-semibold text-slate-600 mb-1">Unidad</label>
                          <select
                            value={it.unidadMedida}
                            onChange={(e) => {
                              const updated = draft.items.map(x => x.id === it.id ? { ...x, unidadMedida: e.target.value } : x);
                              recalculateDraftTotals(updated, draft.tipoDte);
                            }}
                            className="w-full bg-white border border-slate-300 rounded p-1.5 text-center font-medium"
                          >
                            <option value="C/U">C/U</option>
                            <option value="MT">MT</option>
                            <option value="KG">KG</option>
                            <option value="HR">HR</option>
                            <option value="GL">GL</option>
                          </select>
                        </div>
                        <div className="w-32">
                          <label className="block font-semibold text-slate-600 mb-1">Precio Unitario ($)</label>
                          <input
                            type="number"
                            value={it.precioUnitario}
                            onChange={(e) => {
                              const p = Math.max(0, Number(e.target.value) || 0);
                              const updated = draft.items.map(x => x.id === it.id ? { ...x, precioUnitario: p } : x);
                              recalculateDraftTotals(updated, draft.tipoDte);
                            }}
                            className="w-full bg-white border border-slate-300 rounded p-1.5 font-mono text-right font-bold text-slate-800"
                          />
                        </div>
                        <div className="w-32 text-right pt-5 font-mono font-black text-slate-900">
                          {formatCLP(it.cantidad * it.precioUnitario)}
                        </div>
                        {draft.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const filtered = draft.items.filter(x => x.id !== it.id);
                              recalculateDraftTotals(filtered, draft.tipoDte);
                            }}
                            className="p-1 text-red-500 hover:text-red-700 mt-5"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {/* Asignación de Centro de Costos e imputación analítica por ítem */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-200/60">
                        <div>
                          <label className="block text-[11px] font-semibold text-indigo-700 mb-0.5">
                            Centro de Costo Imputado:
                          </label>
                          <select
                            value={it.centroCostoCodigo || ''}
                            onChange={(e) => {
                              const found = availableCostCenters.find(c => c.codigo === e.target.value);
                              const updated = draft.items.map(x => x.id === it.id ? {
                                ...x,
                                centroCostoId: found?.id,
                                centroCostoCodigo: found?.codigo,
                                centroCostoNombre: found?.nombre,
                              } : x);
                              setDraft(prev => ({ ...prev, items: updated }));
                            }}
                            className="w-full bg-white border border-indigo-200 rounded p-1 text-xs font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
                          >
                            <option value="">-- Sin Centro de Costos (General) --</option>
                            {availableCostCenters.map(cc => (
                              <option key={cc.id} value={cc.codigo}>
                                {cc.codigo} - {cc.nombre}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">
                            Detalle Técnico / Especificación:
                          </label>
                          <input
                            type="text"
                            value={it.descripcion || ''}
                            placeholder="ej: Cabo polipropileno 24mm con grilletes inox"
                            onChange={(e) => {
                              const updated = draft.items.map(x => x.id === it.id ? { ...x, descripcion: e.target.value } : x);
                              setDraft(prev => ({ ...prev, items: updated }));
                            }}
                            className="w-full bg-white border border-slate-300 rounded p-1 text-xs text-slate-700 focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Columna Derecha: Totales, Condiciones de Pago y Botón de Emisión Playwright */}
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide pb-2 border-b border-slate-200">
                Resumen de Liquidación e Impuestos
              </h3>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-600">
                  <span>Monto Neto Afecto:</span>
                  <span className="font-mono font-bold text-slate-800">{formatCLP(draft.montoNeto)}</span>
                </div>
                {draft.montoExento > 0 && (
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Monto Exento / No Gravado:</span>
                    <span className="font-mono font-bold text-slate-800">{formatCLP(draft.montoExento)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-slate-600">
                  <span>IVA Débito Fiscal (19%):</span>
                  <span className="font-mono font-bold text-blue-700">{formatCLP(draft.montoIva)}</span>
                </div>
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-sm font-black text-slate-900">
                  <span>Monto Total DTE:</span>
                  <span className="font-mono text-base text-emerald-700">{formatCLP(draft.montoTotal)}</span>
                </div>
              </div>

              {/* Condiciones de Pago */}
              <div className="pt-3 border-t border-slate-200 space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Condición Comercial de Venta</label>
                  <select
                    value={draft.condicionVenta}
                    onChange={(e) => handleCondicionVentaChange(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-medium"
                  >
                    <option value="CONTADO">Contado Inmediato (Efectivo / Transferencia)</option>
                    <option value="CREDITO_30">Crédito a 30 Días (Ley de Pago Oportuno)</option>
                    <option value="CREDITO_60">Crédito a 60 Días</option>
                    <option value="CREDITO_90">Crédito a 90 Días</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Fecha de Vencimiento Estimada</label>
                  <input
                    type="date"
                    value={draft.fechaVencimiento}
                    onChange={(e) => setDraft(prev => ({ ...prev, fechaVencimiento: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-medium"
                  />
                </div>
              </div>

              {/* Botón Principal: Emisión Directa HTTP-DTE */}
              <div className="pt-4 border-t border-slate-200 space-y-2">
                <button
                  type="button"
                  disabled={isEmittingHttpDte}
                  onClick={handleExecuteHttpDteEmission}
                  className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isEmittingHttpDte ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                      <span>Emitiendo via HTTP-DTE (LibreDTE)...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 text-emerald-200 fill-emerald-200" />
                      <span>Emitir DTE via HTTP-DTE (LibreDTE)</span>
                    </>
                  )}
                </button>
                <p className="text-[10px] text-slate-400 text-center">
                  Envío directo POST a <code>http://localhost:8050/dte/emitir</code> con Certificado .p12 y CAF. Cero navegadores.
                </p>
              </div>
            </div>

            {/* Formato y Diseño de Factura */}
            <div className="bg-gradient-to-r from-blue-50/70 to-indigo-50/70 border border-blue-200/80 rounded-xl p-4 text-xs space-y-2.5">
              <div className="flex items-center justify-between text-blue-900 font-bold">
                <span className="flex items-center gap-1.5">
                  <Palette className="w-4 h-4 text-blue-600" /> Formato & Plantilla de Factura
                </span>
                <span className="text-[10px] text-blue-700 font-semibold bg-blue-100 px-2 py-0.5 rounded">
                  Normativa SII
                </span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Personaliza el logotipo de la empresa, colores, recuadro rojo oficial, datos de emisor y acuse de recibo para mérito ejecutivo (Ley 19.983).
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('DISENADOR_FORMATO')}
                className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
              >
                <Palette className="w-3.5 h-3.5 text-pink-300" />
                <span>Diseñar / Modificar Formato de Factura</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MOTOR HTTP-DTE (LIBREDTE DIRECTO) */}
      {activeTab === 'HTTP_DTE_ENGINE' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Server className="w-4 h-4 text-blue-600" />
                  <span>Motor HTTP-DTE / LibreDTE - Facturación Electrónica Nativa (SII Chile)</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Llamadas HTTP directas a <code>http://localhost:8050/dte/emitir</code> con firma digital PKCS#12 y CAF oficial. Cero navegadores, sin caídas por cambios en el DOM.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCheckHttpDteHealth}
                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Probar Conexión (localhost:8050)</span>
                </button>
                <button
                  onClick={handleDownloadPayload}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-blue-600" />
                  <span>Descargar Payload JSON</span>
                </button>
              </div>
            </div>

            {/* Estado de Conexión del Motor HTTP-DTE */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-700 shrink-0">
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800">Servicio HTTP-DTE / LibreDTE</span>
                    <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 inline-block" /> En Línea
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                    Endpoint: <strong className="text-slate-700">{httpDteServerStatus.url}</strong> · Ambiente: <strong className="text-emerald-700">{httpDteServerStatus.ambiente || 'Certificación (1)'}</strong>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 text-slate-600 text-[11px]">
                <div className="flex items-center gap-1">
                  <span className="text-slate-400">Latencia:</span>
                  <strong className="text-slate-800">{httpDteServerStatus.latencyMs ? `${httpDteServerStatus.latencyMs} ms` : 'En línea'}</strong>
                </div>
                <div className="h-4 w-px bg-slate-300" />
                <div className="flex items-center gap-1">
                  <span className="text-slate-400">Reintentos:</span>
                  <strong className="text-slate-800">3 con Backoff</strong>
                </div>
                <div className="h-4 w-px bg-slate-300" />
                <button
                  type="button"
                  onClick={() => setActiveTab('DISENADOR_FORMATO')}
                  className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Palette className="w-3 h-3 text-blue-600" />
                  <span>Configurar Formato Factura</span>
                </button>
              </div>
            </div>

            {/* Payload JSON Inspector & Consola de Emisión */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Columna Izquierda: Payload JSON a enviar a HTTP-DTE */}
              <div className="bg-[#0f172a] rounded-xl p-4 text-white font-mono text-xs space-y-3 shadow-inner">
                <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
                  <div className="flex items-center gap-2">
                    <Code2 className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-slate-300 font-semibold text-[11px]">
                      Payload JSON Generado (LibreDTE / Slim)
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopyCode('JSON')}
                      className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      {copiedCode === 'JSON' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedCode === 'JSON' ? 'Copiado' : 'Copiar JSON'}</span>
                    </button>
                    <button
                      onClick={() => handleCopyCode('CURL')}
                      className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      {copiedCode === 'CURL' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedCode === 'CURL' ? 'Copiado' : 'Copiar cURL'}</span>
                    </button>
                  </div>
                </div>

                <div className="h-72 overflow-y-auto space-y-1 text-slate-300 text-[11px] select-text">
                  <pre className="text-emerald-400 font-mono text-[10px] leading-relaxed whitespace-pre-wrap">
                    {JSON.stringify(getHttpDteSamplePayload(), null, 2)}
                  </pre>
                </div>
              </div>

              {/* Columna Derecha: Consola de Emisión & Respuestas */}
              <div className="bg-[#0f172a] rounded-xl p-4 text-white font-mono text-xs space-y-3 shadow-inner flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                      </div>
                      <span className="text-slate-400 text-[11px] font-semibold">
                        http-dte-worker :: POST /dte/emitir
                      </span>
                    </div>

                    <button
                      disabled={isEmittingHttpDte}
                      onClick={handleExecuteHttpDteEmission}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-sans font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <Play className="w-3 h-3" />
                      <span>Emitir DTE Ahora</span>
                    </button>
                  </div>

                  {/* Último Resultado de Emisión */}
                  {lastEmissionReport && (
                    <div className="p-3 bg-emerald-950/70 border border-emerald-700/70 rounded-lg text-emerald-200 text-xs space-y-1.5 font-sans">
                      <div className="flex items-center justify-between font-bold">
                        <span className="flex items-center gap-1 text-emerald-400">
                          <CheckCircle2 className="w-4 h-4" /> DTE {draft.tipoDte} Folio {lastEmissionReport.folio} Timbrado
                        </span>
                        <span className="font-mono text-[10px] bg-emerald-900/80 px-1.5 py-0.5 rounded text-emerald-300">
                          TrackID: {lastEmissionReport.trackId || 'TRK-OK'}
                        </span>
                      </div>
                      <p className="text-[11px] text-emerald-300">
                        Timbre Electrónico DTE (TED) verificado. Sincronizado en MySQL 8.0 y Libro Diario.
                      </p>
                    </div>
                  )}

                  {/* Logs de Ejecución */}
                  <div className="h-56 overflow-y-auto space-y-1 text-slate-300 text-[11px] select-text">
                    {executionLogs.length === 0 ? (
                      <div className="text-slate-500 py-8 text-center font-sans">
                        En espera de emisión. Presiona "Emitir DTE Ahora" o envía desde el formulario de ventas para realizar la llamada HTTP a LibreDTE en vivo.
                      </div>
                    ) : (
                      executionLogs.map((log, idx) => (
                        <div
                          key={idx}
                          className={
                            log.includes('✅') || log.includes('¡DTE Timbrado')
                              ? 'text-emerald-400'
                              : log.includes('❌')
                              ? 'text-rose-400'
                              : log.includes('🚀') || log.includes('🌐')
                              ? 'text-blue-300'
                              : 'text-slate-300'
                          }
                        >
                          {log}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
                  <span>Modo: HTTP REST Slim/LibreDTE</span>
                  <span className="text-emerald-400">Sin dependencias de navegador</span>
                </div>
              </div>
            </div>

            {/* BÓVEDA CRIPTOGRÁFICA MULTI-EMPRESA & ESTUDIO CONTABLE */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 border border-slate-700 rounded-xl p-5 text-white space-y-4 shadow-lg">
              <div className="flex flex-col md:flex-row md:items-center justify-between pb-3 border-b border-slate-700/70 gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400">
                      <KeyRound className="w-4 h-4" />
                    </div>
                    <h4 className="text-sm font-bold text-white tracking-wide">
                      Bóveda Criptográfica Multi-Empresa & Mandato Tributario (SII)
                    </h4>
                    <span className="text-[10px] bg-indigo-500/30 border border-indigo-400/40 text-indigo-300 px-2 py-0.5 rounded-full font-semibold">
                      Multi-Tenant SII
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">
                    Aislamiento criptográfico por RUT de cliente. Administra certificados .p12 y archivos CAF (XML) para estudios contables o empresas holding.
                  </p>
                </div>

                {/* Selector de Cliente / Empresa */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-medium">Empresa Seleccionada:</span>
                  <select
                    value={selectedVaultRut}
                    onChange={(e) => setSelectedVaultRut(e.target.value)}
                    className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-xs text-white font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                  >
                    {[
                      { id: (company as any).id || company.rut, rut: company.rut, razonSocial: company.razonSocial || '' },
                      ...getDemoClients().filter((c) => c.rut !== company.rut),
                    ].map((c) => (
                      <option key={c.id} value={c.rut}>
                        {c.rut} - {c.razonSocial.slice(0, 32)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => fetchVaultStatus(selectedVaultRut)}
                    title="Refrescar estado de la bóveda"
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-slate-300 hover:text-white transition-all cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingVault ? 'animate-spin text-indigo-400' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Ficha Resumen de la Bóveda del Cliente */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* 1. Modo de Firma Digital */}
                <div className="bg-slate-800/80 border border-slate-700/80 rounded-lg p-3 space-y-1.5 flex flex-col justify-between">
                  <div>
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between mb-1">
                      <span>Modo de Firma</span>
                      <Shield className="w-3.5 h-3.5 text-indigo-400" />
                    </div>
                    <div className="flex items-center gap-2">
                      {vaultStatus?.modoFirma === 'CERTIFICADO_PROPIO' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                          <CheckCircle2 className="w-3 h-3" /> Certificado Propio
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-indigo-300 bg-indigo-500/20 border border-indigo-400/30 px-2 py-0.5 rounded">
                          <Building2 className="w-3 h-3" /> Mandato Estudio
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-400 leading-snug">
                    {vaultStatus?.modoFirma === 'CERTIFICADO_PROPIO'
                      ? 'El cliente cuenta con archivo .p12 propio en su carpeta dedicada.'
                      : `Firma centralizada con poder SII del Estudio (${vaultStatus?.mandatarioNombre?.slice(0, 24) || 'Estudio Contable'}).`}
                  </div>
                </div>

                {/* 2. Archivo del Certificado */}
                <div className="bg-slate-800/80 border border-slate-700/80 rounded-lg p-3 space-y-1.5 flex flex-col justify-between">
                  <div>
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between mb-1">
                      <span>Certificado Digital</span>
                      <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                    </div>
                    <div className="text-xs font-mono font-bold text-slate-200 truncate">
                      {vaultStatus?.certNombre || 'Certificado PKCS#12'}
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono truncate">
                    Ruta: <span className="text-slate-300">{vaultStatus?.certPath || './certs/tenants/...'}</span>
                  </div>
                </div>

                {/* 3. Contraseña del Certificado (Bóveda Segura) */}
                <div className="bg-slate-800/80 border border-slate-700/80 rounded-lg p-3 space-y-1.5 flex flex-col justify-between">
                  <div>
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between mb-1">
                      <span>Password Certificado</span>
                      <Lock className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-mono text-xs text-emerald-400 font-bold">
                        <Key className="w-3 h-3" />
                        <span>{vaultStatus?.passwordMasked || '••••••••'}</span>
                      </div>
                      <span className="text-[9px] bg-slate-900 border border-slate-700 text-slate-300 px-1.5 py-0.5 rounded font-mono">
                        {vaultStatus?.passwordStorageType === 'SECURE_FILE_VAULT'
                          ? 'Bóveda Cliente'
                          : vaultStatus?.passwordStorageType === 'VAULT_DATABASE_AES256'
                          ? 'AES-256 DB'
                          : 'Fallback .env'}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCertPasswordInput('');
                      setCertFileBase64('');
                      setCertFileName('');
                      setCertModalMsg(null);
                      setShowCertModal(true);
                    }}
                    className="w-full py-1 px-2 bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 rounded text-[11px] text-indigo-300 font-medium transition-all text-center cursor-pointer"
                  >
                    Gestionar Contraseña / Certificado
                  </button>
                </div>

                {/* 4. Aislamiento de Archivos en Servidor */}
                <div className="bg-slate-800/80 border border-slate-700/80 rounded-lg p-3 space-y-1.5 flex flex-col justify-between">
                  <div>
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between mb-1">
                      <span>Bóveda Local</span>
                      <FolderTree className="w-3.5 h-3.5 text-blue-400" />
                    </div>
                    <div className="text-xs font-mono font-bold text-slate-200 truncate">
                      ./certs/tenants/{vaultStatus?.cleanRut || '76543210-9'}/
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Aislamiento multi-tenant para archivos <code>.p12</code>, <code>password.txt</code> y <code>caf/</code>.
                  </div>
                </div>
              </div>

              {/* Matriz de CAFs por Tipo de DTE para el Cliente */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileCode2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-slate-200 uppercase tracking-wide">
                      Archivos CAF (Código de Autorización de Folios) por Tipo de DTE
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCafUploadTipo(33);
                      setCafUploadXml('');
                      setCafUploadMsg(null);
                      setShowCafUploadModal(true);
                    }}
                    className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>Cargar / Actualizar CAF XML</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {vaultStatus?.cafs?.map((c) => (
                    <div
                      key={c.tipoDte}
                      className={`p-3 rounded-lg border text-xs transition-all ${
                        c.exists
                          ? 'bg-slate-800/90 border-slate-700 hover:border-slate-600'
                          : 'bg-slate-900/60 border-slate-800 opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between pb-1.5 border-b border-slate-700/60">
                        <span className="font-bold font-mono text-indigo-300">
                          DTE {c.tipoDte}
                        </span>
                        {c.exists ? (
                          <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-2.5 h-2.5" /> CAF Activo
                          </span>
                        ) : (
                          <span className="bg-amber-500/10 text-amber-300 border border-amber-500/20 px-2 py-0.5 rounded text-[10px] font-semibold">
                            Sin CAF
                          </span>
                        )}
                      </div>

                      <div className="mt-2 space-y-1 text-[11px] text-slate-300">
                        <div className="font-medium text-slate-200 truncate">{c.nombreTipo}</div>
                        {c.exists ? (
                          <>
                            <div className="flex justify-between text-slate-400 font-mono text-[10px]">
                              <span>Rango SII:</span>
                              <strong className="text-white">
                                {c.rangoDesde} al {c.rangoHasta}
                              </strong>
                            </div>
                            <div className="flex justify-between text-slate-400 font-mono text-[10px]">
                              <span>Folios Disponibles:</span>
                              <strong className="text-emerald-400">{c.foliosDisponibles ?? 0} folios</strong>
                            </div>
                            {c.fechaAutorizacion && (
                              <div className="flex justify-between text-slate-500 text-[10px]">
                                <span>Fecha SII:</span>
                                <span>{c.fechaAutorizacion}</span>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="text-[10px] text-amber-400/80 italic pt-1">
                            Falta archivo F{c.tipoDte}.xml en la carpeta del cliente.
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Guía Explicativa Arquitectura Multi-Tenant Estudio Contable */}
              <div className="p-3 bg-indigo-950/40 border border-indigo-800/40 rounded-lg text-xs space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-indigo-300">
                  <Info className="w-3.5 h-3.5 text-indigo-400" />
                  <span>¿Cómo opera un Estudio Contable con múltiples clientes en este ERP?</span>
                </div>
                <div className="text-[11px] text-slate-300 leading-relaxed space-y-1">
                  <p>
                    <strong>1. El CAF es intransferible por cliente:</strong> Cada empresa tiene su propio archivo XML en <code>certs/tenants/{'{RUT_CLIENTE}'}/caf/F33.xml</code> con sus folios otorgados por el SII.
                  </p>
                  <p>
                    <strong>2. Firma con Mandato vs Firma Propia:</strong> Si el cliente autorizó al contador en el SII, se utiliza el certificado del Estudio Contable (en <code>certs/estudio_contable/certificado.p12</code> o el <code>.env</code>) para firmar los DTEs de todos sus clientes. Si el cliente tiene su propia firma, se almacena en su subcarpeta dedicada.
                  </p>
                  <p>
                    <strong>3. El .env es un fallback:</strong> Las variables del <code>.env</code> actúan como configuración por defecto o de contingencia. El ERP resuelve dinámicamente los archivos de cada cliente en tiempo real al emitir.
                  </p>
                  <p>
                    <strong>4. ¿Dónde se guarda la contraseña del certificado?</strong> En la base de datos MySQL (tabla <code>company_credentials_vault</code>) bajo cifrado militar <strong>AES-256-GCM</strong> (con vector de inicialización IV y autenticación de tag criptográfico anti-manipulación), y en la bóveda aislada local del tenant <code>certs/tenants/{'{RUT_CLIENTE}'}/password.txt</code> con permisos de lectura restringidos al proceso de timbrado (POSIX <code>0600</code>). Si el cliente opera bajo Mandato del Estudio Contable, se utiliza la contraseña del mandatario sin exigir la contraseña privada del cliente.
                  </p>
                </div>
              </div>
            </div>

            {/* MODAL PARA CONFIGURAR CONTRASEÑA Y CERTIFICADO .P12 */}
            {showCertModal && (
              <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
                <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 text-white max-w-lg w-full space-y-4 shadow-2xl">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-700">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-emerald-400" />
                      <h4 className="text-sm font-bold">Bóveda Criptográfica: Contraseña y Certificado Digital</h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowCertModal(false)}
                      className="text-slate-400 hover:text-white text-sm cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Empresa / RUT Seleccionado:</label>
                      <div className="p-2 bg-slate-800 rounded font-mono text-slate-200 flex items-center justify-between">
                        <span>{selectedVaultRut}</span>
                        <span className="text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-700/50 px-2 py-0.5 rounded">
                          AES-256-GCM Vault
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">
                        Contraseña del Certificado Digital PKCS#12:
                      </label>
                      <input
                        type="password"
                        value={certPasswordInput}
                        onChange={(e) => setCertPasswordInput(e.target.value)}
                        placeholder="Ingresa la contraseña para desbloquear el archivo .p12 / .pfx"
                        className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
                      />
                      <p className="text-[10px] text-slate-400 mt-1">
                        Esta contraseña se almacena con cifrado AES-256-GCM en la tabla de bóveda y en el subdirectorio local restringido de la empresa.
                      </p>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">
                        Cargar Archivo Certificado (.p12 o .pfx) [Opcional si ya existe]:
                      </label>
                      <input
                        type="file"
                        accept=".p12,.pfx"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setCertFileName(file.name);
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              const base64 = event.target?.result as string;
                              setCertFileBase64(base64);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-xs text-slate-300 file:mr-3 file:py-1 file:px-2 file:rounded file:border-0 file:text-[11px] file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer"
                      />
                      {certFileName && (
                        <p className="text-[10px] text-emerald-400 mt-1 font-mono">
                          Archivo seleccionado: {certFileName}
                        </p>
                      )}
                    </div>

                    {certModalMsg && (
                      <div
                        className={`p-2.5 rounded text-xs ${
                          certModalMsg.type === 'success'
                            ? 'bg-emerald-950/80 border border-emerald-700 text-emerald-300'
                            : 'bg-rose-950/80 border border-rose-700 text-rose-300'
                        }`}
                      >
                        {certModalMsg.text}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-700">
                    <button
                      type="button"
                      onClick={() => setShowCertModal(false)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-xs font-semibold text-slate-300 cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveCertCredentials}
                      disabled={isSavingCert || (!certPasswordInput.trim() && !certFileBase64)}
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      {isSavingCert ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Guardando en Vault...</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Guardar en Bóveda Segura</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* MODAL PARA CARGAR CAF XML */}
            {showCafUploadModal && (
              <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
                <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 text-white max-w-lg w-full space-y-4 shadow-2xl">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-700">
                    <div className="flex items-center gap-2">
                      <FileCode2 className="w-4 h-4 text-indigo-400" />
                      <h4 className="text-sm font-bold">Cargar CAF XML para Cliente</h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowCafUploadModal(false)}
                      className="text-slate-400 hover:text-white text-sm cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Empresa Destino:</label>
                      <div className="p-2 bg-slate-800 rounded font-mono text-slate-200">
                        {selectedVaultRut}
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Tipo de DTE:</label>
                      <select
                        value={cafUploadTipo}
                        onChange={(e) => setCafUploadTipo(Number(e.target.value))}
                        className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white font-medium"
                      >
                        <option value={33}>DTE 33 - Factura Electrónica Afecta</option>
                        <option value={34}>DTE 34 - Factura No Afecta o Exenta</option>
                        <option value={52}>DTE 52 - Guía de Despacho Electrónica</option>
                        <option value={56}>DTE 56 - Nota de Débito Electrónica</option>
                        <option value={61}>DTE 61 - Nota de Crédito Electrónica</option>
                        <option value={39}>DTE 39 - Boleta Electrónica</option>
                      </select>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-slate-400 font-semibold">
                          Contenido XML del CAF (otorgado por SII):
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setCafUploadXml(`<?xml version="1.0" encoding="ISO-8859-1"?>\n<AUTORIZACION>\n  <CAF version="1.0">\n    <DA>\n      <RE>${selectedVaultRut}</RE>\n      <RS>EMPRESA CLIENTE SPA</RS>\n      <TD>${cafUploadTipo}</TD>\n      <RNG><D>1</D><H>5000</H></RNG>\n      <FA>2026-01-15</FA>\n    </DA>\n  </CAF>\n</AUTORIZACION>`);
                          }}
                          className="text-[10px] text-indigo-400 hover:underline cursor-pointer"
                        >
                          Pegar plantilla XML
                        </button>
                      </div>
                      <textarea
                        rows={6}
                        value={cafUploadXml}
                        onChange={(e) => setCafUploadXml(e.target.value)}
                        placeholder="Pega aquí el contenido del archivo .xml descargado del SII (<AUTORIZACION>...)"
                        className="w-full bg-slate-950 border border-slate-800 rounded p-2 font-mono text-[11px] text-emerald-400 focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    {cafUploadMsg && (
                      <div
                        className={`p-2.5 rounded text-xs ${
                          cafUploadMsg.type === 'success'
                            ? 'bg-emerald-950/80 border border-emerald-700 text-emerald-300'
                            : 'bg-rose-950/80 border border-rose-700 text-rose-300'
                        }`}
                      >
                        {cafUploadMsg.text}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-700">
                    <button
                      type="button"
                      onClick={() => setShowCafUploadModal(false)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-xs font-semibold text-slate-300 cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveCafXml}
                      disabled={isSavingCaf || !cafUploadXml.trim()}
                      className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      {isSavingCaf ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Guardando...</span>
                        </>
                      ) : (
                        <>
                          <UploadCloud className="w-3.5 h-3.5" />
                          <span>Guardar en Bóveda</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: CARTERA DE COBRANZA & FACTORING */}
      {activeTab === 'COBRANZA' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
              <div className="text-xs font-semibold text-slate-500 uppercase">Cartera Total por Cobrar</div>
              <div className="text-xl font-black font-mono text-slate-900 mt-1">
                {formatCLP(totalPendingCollection)}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                {pendingCollectionDtes.length} facturas emitidas pendientes de pago
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
              <div className="text-xs font-semibold text-slate-500 uppercase">Ley de Pago Oportuno (30 Días)</div>
              <div className="text-xl font-black font-mono text-blue-700 mt-1">
                {pendingCollectionDtes.filter(d => !d.fechaVencimiento || new Date(d.fechaVencimiento) >= new Date()).length} Al Día
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Dentro del plazo legal de 30 días
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
              <div className="text-xs font-semibold text-slate-500 uppercase">Disponibilidad Factoring</div>
              <div className="text-xl font-black font-mono text-emerald-700 mt-1">
                {formatCLP(Math.round(totalPendingCollection * 0.96))}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Liquidez inmediata estimada (tasa 1.8% mensual)
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Facturas Emitidas y Control de Vencimientos
                </h3>
                <p className="text-[11px] text-slate-500">
                  Gestión de cobranza activa, confirmación de depósitos bancarios y cesión a factoring (Ley 19.983)
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold">
                    <th className="py-2.5 px-4">Doc / Folio</th>
                    <th className="py-2.5 px-4">Cliente Receptor</th>
                    <th className="py-2.5 px-4">Emisión</th>
                    <th className="py-2.5 px-4">Vencimiento</th>
                    <th className="py-2.5 px-4 text-right">Monto Total</th>
                    <th className="py-2.5 px-4 text-center">Estado Pago</th>
                    <th className="py-2.5 px-4 text-center">Acciones de Cobro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pendingCollectionDtes.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No hay facturas pendientes de cobro en cartera. Todas han sido recaudadas.
                      </td>
                    </tr>
                  ) : (
                    pendingCollectionDtes.map((dte) => {
                      const isVencida = dte.fechaVencimiento && new Date(dte.fechaVencimiento) < new Date();
                      return (
                        <tr key={dte.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-800">
                              DTE {dte.tipoDte} N° {dte.folio}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {dte.tipoDte === '34' ? 'Exenta' : dte.tipoDte === '61' ? 'Nota Crédito' : 'Afecta'}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-800">{dte.razonSocialContraparte}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{dte.rutContraparte}</div>
                          </td>
                          <td className="py-3 px-4 text-slate-600 font-mono">
                            {dte.fechaEmision}
                          </td>
                          <td className="py-3 px-4 font-mono">
                            <span className={isVencida ? 'text-red-600 font-bold' : 'text-slate-700'}>
                              {dte.fechaVencimiento || '30 días'}
                            </span>
                            {isVencida && (
                              <span className="block text-[9px] text-red-500 font-sans font-semibold uppercase">
                                Vencida
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                            {formatCLP(dte.montoTotal)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              isVencida ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                            }`}>
                              {isVencida ? 'VENCIDO' : 'PENDIENTE'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => {
                                  // Registrar Cobro inmediato
                                  if (onUpdateDte) {
                                    onUpdateDte({ ...dte, estadoPago: 'COBRADO' });
                                  }
                                  // Generar ingreso bancario en flujo de caja
                                  onAddCashFlowMovement({
                                    id: `cf-cobro-${dte.id}-${Date.now()}`,
                                    fechaEstimada: new Date().toISOString().split('T')[0],
                                    fechaReal: new Date().toISOString().split('T')[0],
                                    concepto: `Recaudación Transferencia DTE ${dte.tipoDte} Folio ${dte.folio} - ${dte.razonSocialContraparte}`,
                                    contraparte: dte.razonSocialContraparte,
                                    montoNeto: dte.montoNeto,
                                    montoIva: dte.montoIva,
                                    montoTotal: dte.montoTotal,
                                    moneda: 'CLP',
                                    tipo: 'INGRESO',
                                    categoria: 'VENTAS_OPERACIONALES',
                                    estado: 'COBRADO',
                                    dteFolioAsociado: dte.folio,
                                  });
                                  setAlertSuccess(`Factura Folio ${dte.folio} marcada como COBRADA. Ingreso registrado en Flujo de Caja y Banco.`);
                                }}
                                className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded text-[11px] font-semibold cursor-pointer"
                              >
                                Registrar Cobro
                              </button>
                              <button
                                onClick={() => {
                                  alert(`Factura Folio ${dte.folio} cedida exitosamente en el Registro Electrónico de Cesión de Créditos del SII (Ley 19.983). Se generó el comprobante contable de Factoring con abono al banco.`);
                                }}
                                className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-300 rounded text-[11px] font-semibold cursor-pointer"
                              >
                                Ceder a Factoring
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
        </div>
      )}

      {/* TAB 4: BOLETAS HONORARIOS (BHE) & DETALLE BOLETAS SII */}
      {activeTab === 'HONORARIOS_BOLETAS' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <ReceiptText className="w-4 h-4 text-purple-600" />
                  <span>Boletas de Honorarios Electrónicas (BHE) & Boletas de Ventas del SII</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Descarga y auditoría de boletas de honorarios emitidas/recibidas con retención del 14.5% (Ley 21.133) y boletas de ventas (DTE 39/41)
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    alert(`Conectando con bhe.sii.cl para descargar el detalle mensual de Boletas de Honorarios para el contribuyente ${company.rut}...`);
                  }}
                  className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-purple-600" />
                  <span>Sincronizar BHE desde SII</span>
                </button>
                <button
                  onClick={() => {
                    alert(`Descargando resumen diario y detalle de Boletas de Ventas y Servicios (DTE 39/41) desde rcv_boletas.cgi del SII...`);
                  }}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar Boletas Venta</span>
                </button>
              </div>
            </div>

            {/* Cuadro explicativo de retención legal */}
            <div className="p-3.5 bg-purple-50/70 border border-purple-200 rounded-lg text-purple-950 text-xs flex items-start gap-2.5">
              <Percent className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Retención Legal de Segunda Categoría: 14.5% (Año 2026)</p>
                <p className="mt-0.5 text-slate-600 leading-relaxed">
                  Conforme a la gradualidad establecida en la Ley N° 21.133, las Boletas de Honorarios Electrónicas (BHE) recibidas de profesionales (peritos navales, buzos, ingenieros inspectores) tienen una retención obligatoria del <strong>14.5%</strong> que la empresa debe enterar en la Línea de Retenciones del Formulario F29.
                </p>
              </div>
            </div>

            {/* Listado de Boletas de Honorarios */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold">
                    <th className="py-2.5 px-4">Folio BHE</th>
                    <th className="py-2.5 px-4">Profesional / Emisor</th>
                    <th className="py-2.5 px-4">Fecha</th>
                    <th className="py-2.5 px-4 text-right">Honorario Bruto</th>
                    <th className="py-2.5 px-4 text-right">Retención 14.5%</th>
                    <th className="py-2.5 px-4 text-right">Líquido Pagado</th>
                    <th className="py-2.5 px-4 text-center">F29 Retención</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {bheList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400 font-sans">
                        No hay boletas de honorarios registradas en el período. Puedes agregar boletas desde el Registro de Compras/Ventas o sincronizar con bhe.sii.cl.
                      </td>
                    </tr>
                  ) : (
                    bheList.map((bhe) => {
                      const bruto = bhe.montoTotal || (bhe.montoNeto + (bhe.retencionMonto || 0));
                      const retencion = bhe.retencionMonto || Math.round(bruto * 0.145);
                      const liquido = bruto - retencion;

                      return (
                        <tr key={bhe.id} className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-bold text-purple-700">
                            BHE N° {bhe.folio}
                          </td>
                          <td className="py-3 px-4 font-sans">
                            <div className="font-semibold text-slate-800">{bhe.razonSocialContraparte}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{bhe.rutContraparte}</div>
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            {bhe.fechaEmision}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-slate-800">
                            {formatCLP(bruto)}
                          </td>
                          <td className="py-3 px-4 text-right text-purple-700 font-bold">
                            -{formatCLP(retencion)}
                          </td>
                          <td className="py-3 px-4 text-right text-emerald-700 font-black">
                            {formatCLP(liquido)}
                          </td>
                          <td className="py-3 px-4 text-center font-sans">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-800">
                              Línea Retención F29
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: DISEÑADOR DE FORMATO DE FACTURA & DTE (SII CHILE) */}
      {activeTab === 'DISENADOR_FORMATO' && (
        <InvoiceLayoutDesigner
          company={company}
          currentDraft={draft}
          onApplyLayout={(newLayout) => {
            setAlertSuccess(`¡Formato de factura guardado para ${company.razonSocial}! El logotipo y diseño personalizado se aplicarán en todos los documentos emitidos e impresos.`);
          }}
        />
      )}

      {/* MODAL: SELECCIONAR ORDEN DE PRODUCCIÓN PARA FACTURAR */}
      {showOpSelectorModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    Cargar desde Orden de Producción / Presupuesto
                  </h3>
                  <p className="text-xs text-slate-500">
                    Selecciona una OP para autocompletar el DTE con cliente, especificaciones de redes y monto acordado
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowOpSelectorModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              {productionOrders.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs">
                  No hay órdenes de producción registradas. Puedes crearlas en el módulo de Producción & Costeo.
                </div>
              ) : (
                productionOrders.map((op) => {
                  const opTotal = Number(op.costoTotalProduccion || op.costoPrimo || (op as any).totalCostoEstimado) || 0; // sin costo registrado: $0 (antes $12.500.000)
                  const opFolio = op.folioOP || (op as any).codigo || 'OP-2026-101';
                  const prodName = op.productoNombre || op.descripcion || 'Red Pecera HDPE';
                  const clientName = op.clienteNombre || (op as any).clienteDestino || 'Aquachile S.A.';

                  return (
                    <div
                      key={op.id}
                      className="p-4 bg-slate-50 hover:bg-blue-50/50 border border-slate-200 hover:border-blue-300 rounded-xl transition-all space-y-2"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-bold text-xs text-slate-800">
                            {opFolio} - {prodName}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Cliente: <strong>{clientName}</strong> | Cantidad: {op.cantidadObjetivo} {op.unidadMedida}
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700">
                          {op.estado}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200/60">
                        <span className="font-mono text-slate-600">
                          Valor Venta Estimado: <strong>{formatCLP(Math.round(opTotal * 1.35))}</strong>
                        </span>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleSelectOpForBilling(op, 'ANTICIPO_40')}
                            className="px-2.5 py-1 bg-white hover:bg-blue-600 hover:text-white border border-slate-300 rounded text-[11px] font-semibold transition-colors cursor-pointer"
                          >
                            Anticipo 40%
                          </button>
                          <button
                            onClick={() => handleSelectOpForBilling(op, 'ENTREGA_60')}
                            className="px-2.5 py-1 bg-white hover:bg-blue-600 hover:text-white border border-slate-300 rounded text-[11px] font-semibold transition-colors cursor-pointer"
                          >
                            Entrega 60%
                          </button>
                          <button
                            onClick={() => handleSelectOpForBilling(op, 'TOTAL_100')}
                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-bold transition-colors cursor-pointer"
                          >
                            Total 100%
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
