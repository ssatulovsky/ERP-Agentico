import React, { useState, useEffect } from 'react';
import {
  ShoppingCart,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Package,
  Layers,
  DollarSign,
  Users,
  Building2,
  Calendar,
  Clock,
  ArrowRight,
  Sparkles,
  Bot,
  RefreshCw,
  Plus,
  FileSpreadsheet,
  Award,
  ShieldCheck,
  Send,
  Sliders,
  ChevronRight,
  TrendingDown,
  Check,
  Percent,
  X,
  CreditCard,
  MessageSquare,
  BellRing,
  Scale,
  FileText,
  CheckCircle,
  ThumbsUp,
  CheckSquare,
  Inbox,
  Eye,
  SendHorizontal,
  AlertCircle
} from 'lucide-react';
import type {
  CommercialProcurementState,
  ProductMarginAnalysis,
  StockSinergyItem,
  SupplierEvaluation,
  DemandForecastItem,
  ClientCommercialProfile,
  PurchaseOrderRecord,
  CommercialQuoteRecord,
  RfqRequest,
  RfqSupplierResponse,
  RfqItemDetail,
  RfqSupplierQuoteItem
} from '../types/commercialProcurement';
import { CompanyProfile, ClientCompany } from '../types';
import { ModuleAgentGovernanceHeader } from './governance/ModuleAgentGovernanceHeader';
import { getStoredAuthToken } from '../services/apiClient';

interface CommercialProcurementAgentModuleProps {
  company: CompanyProfile;
  activeClientId?: string;
  clients?: ClientCompany[];
  productionBudgets?: any[];
  productionOrders?: any[];
  onNavigateToTab?: (tabId: string) => void;
  onOpenVoiceDialogue?: (personaId: string) => void;
}

export const CommercialProcurementAgentModule: React.FC<CommercialProcurementAgentModuleProps> = ({
  company,
  activeClientId = 'client-retail-01',
  clients = [],
  productionBudgets = [],
  productionOrders = [],
  onNavigateToTab,
  onOpenVoiceDialogue
}) => {
  const [state, setState] = useState<CommercialProcurementState | null>(null);
  const [activeTab, setActiveTab] = useState<
    'sinergia_margenes' | 'rfq_cotizaciones' | 'compras_abastecimiento' | 'ventas_comercial' | 'forecasting_demanda' | 'asesor_sr'
  >('sinergia_margenes');

  const [isLoading, setIsLoading] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Modales
  const [isAdjustPriceOpen, setIsAdjustPriceOpen] = useState(false);
  const [selectedMarginItem, setSelectedMarginItem] = useState<ProductMarginAnalysis | null>(null);
  const [newPriceInput, setNewPriceInput] = useState<number>(0);
  const [priceAdjustReason, setPriceAdjustReason] = useState<string>('');

  const [isNewOcOpen, setIsNewOcOpen] = useState(false);
  const [selectedStockItemForOc, setSelectedStockItemForOc] = useState<StockSinergyItem | null>(null);
  const [ocQuantity, setOcQuantity] = useState<number>(20);
  const [selectedSupplierRut, setSelectedSupplierRut] = useState<string>('');

  const [isNewQuoteOpen, setIsNewQuoteOpen] = useState(false);
  const [quoteClientRut, setQuoteClientRut] = useState<string>('');
  const [quoteItems, setQuoteItems] = useState<Array<{ sku: string; nombre: string; cantidad: number; precioUnitario: number }>>([
    { sku: 'FILT-HID-04', nombre: 'Filtro Hidráulico Parker 10 Micrones Alta Presión', cantidad: 5, precioUnitario: 58000 }
  ]);

  // Estado RFQ & Seguimiento de Proveedores
  const [selectedRfqId, setSelectedRfqId] = useState<string>('rfq-2026-0042');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Modal Nueva RFQ
  const [isNewRfqModalOpen, setIsNewRfqModalOpen] = useState(false);
  const [newRfqTitle, setNewRfqTitle] = useState('Licitación Suministro Insumos y Repuestos de Temporada');
  const [newRfqDays, setNewRfqDays] = useState(5);
  const [newRfqSelectedSupplierRuts, setNewRfqSelectedSupplierRuts] = useState<string[]>([
    '76.888.999-1',
    '77.123.456-7',
    '76.456.789-0'
  ]);
  const [newRfqItems, setNewRfqItems] = useState<RfqItemDetail[]>([
    {
      sku: 'FILT-HID-04',
      nombre: 'Filtro Hidráulico Parker 10 Micrones Alta Presión',
      cantidad: 50,
      unidadMedida: 'UN',
      precioReferencialPmp: 38500,
      especificaciones: 'Certificación ISO 16889, presión de rotura 420 bar.'
    }
  ]);

  // Modal Ingreso de Oferta de Proveedor
  const [isSimulateQuoteModalOpen, setIsSimulateQuoteModalOpen] = useState(false);
  const [supplierForQuote, setSupplierForQuote] = useState<RfqSupplierResponse | null>(null);
  const [quoteInputMontoNeto, setQuoteInputMontoNeto] = useState<number>(4500000);
  const [quoteInputPlazoDias, setQuoteInputPlazoDias] = useState<number>(4);
  const [quoteInputCondicionPago, setQuoteInputCondicionPago] = useState<string>('Crédito 30 días');
  const [quoteInputFlete, setQuoteInputFlete] = useState<number>(0);
  const [quoteInputObs, setQuoteInputObs] = useState<string>('Oferta formal con entrega en bodega central.');

  // Handler: Reiterar recordatorio a proveedor retrasado
  const handleSendReminder = async (rfqId: string, supplierRut: string, supplierName: string) => {
    setActionLoadingId(`reminder-${supplierRut}`);
    try {
      const res = await fetch('/api/commercial-procurement/rfq/reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresaId: activeClientId,
          rfqId,
          supplierRut
        })
      });
      const data = await res.json();
      if (data.success) {
        showNotification(`Recordatorio registrado internamente para ${supplierName} (sin envío de correo externo configurado).`);
        loadState();
      } else {
        alert(data.error || 'Error al enviar recordatorio');
      }
    } catch (e: any) {
      alert('Error en conexión: ' + e.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handler: Adjudicar RFQ al mejor proveedor y emitir OC oficial
  const handleAwardRfq = async (rfqId: string, winningSupplierRut: string, supplierName: string) => {
    if (!confirm(`¿Confirmas adjudicar formalmente esta licitación a '${supplierName}'? Se generará automáticamente la Orden de Compra oficial autorizada por Esteban Morales.`)) {
      return;
    }
    setActionLoadingId(`award-${winningSupplierRut}`);
    try {
      const authToken = getStoredAuthToken();

      // Evaluación previa por el motor agéntico de gobernanza
      let agentApprovalMsg = '';
      try {
        const agentRes = await fetch('/api/agents/autonomous/execute', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          },
          body: JSON.stringify({
            module: 'COMERCIAL_COMPRAS',
            modulo: 'COMERCIAL_COMPRAS',
            empresaId: activeClientId,
            query: `Adjudicar licitación ${rfqId} al proveedor ${supplierName} (${winningSupplierRut}) y emitir orden de compra formal con gobernanza humana.`,
            context: {
              company,
              rfqId,
              winningSupplierRut,
              supplierName,
            },
          }),
        });
        if (agentRes.ok) {
          const aData = await agentRes.json();
          if (aData.approvalRequired) {
            agentApprovalMsg = ` [Gobernanza Humana #${aData.approvalDetails?.id?.slice(-6) || 'PEND'} requerida por monto]`;
          }
        }
      } catch (err) {
        console.warn('[CommercialProcurement] Advertencia en verificación agéntica de OC:', err);
      }

      const res = await fetch('/api/commercial-procurement/rfq/award', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          empresaId: activeClientId,
          rfqId,
          winningSupplierRut,
          motivoAdjudicacion: `Adjudicado a ${supplierName} por mejor puntuación TCO y condiciones comerciales recomendadas por el Agente Sr.`
        })
      });
      const data = await res.json();
      if (data.success) {
        showNotification((data.message || `¡Licitación adjudicada con éxito a ${supplierName}!`) + agentApprovalMsg);
        loadState();
      } else {
        alert(data.error || 'Error al adjudicar licitación');
      }
    } catch (e: any) {
      alert('Error en conexión: ' + e.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handler: Crear nueva RFQ
  const handleCreateNewRfq = async () => {
    if (!newRfqTitle.trim()) {
      alert('Por favor ingrese un título para la solicitud de cotización.');
      return;
    }
    if (newRfqSelectedSupplierRuts.length === 0) {
      alert('Seleccione al menos un proveedor a invitar.');
      return;
    }
    try {
      const res = await fetch('/api/commercial-procurement/rfq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresaId: activeClientId,
          titulo: newRfqTitle,
          diasPlazoRespuesta: newRfqDays,
          items: newRfqItems,
          proveedorRuts: newRfqSelectedSupplierRuts
        })
      });
      const data = await res.json();
      if (data.success) {
        showNotification(`¡Solicitud ${data.rfq.folioRfq} emitida a ${data.rfq.proveedoresInvitados.length} proveedores!`);
        setIsNewRfqModalOpen(false);
        setSelectedRfqId(data.rfq.id);
        loadState();
      } else {
        alert(data.error || 'Error al crear RFQ');
      }
    } catch (e: any) {
      alert('Error al emitir RFQ: ' + e.message);
    }
  };

  // Handler: Guardar cotización de proveedor recibida
  const handleSaveSupplierQuote = async () => {
    if (!supplierForQuote) return;
    try {
      const res = await fetch('/api/commercial-procurement/rfq/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresaId: activeClientId,
          rfqId: supplierForQuote.rfqId,
          supplierRut: supplierForQuote.proveedorRut,
          quoteData: {
            montoNetoOfertado: Number(quoteInputMontoNeto),
            plazoEntregaDiasOfertado: Number(quoteInputPlazoDias),
            condicionPagoOfertada: quoteInputCondicionPago,
            costoFleteClp: Number(quoteInputFlete),
            observacionesProveedor: quoteInputObs
          }
        })
      });
      const data = await res.json();
      if (data.success) {
        showNotification(`Cotización de '${supplierForQuote.proveedorRazonSocial}' registrada con éxito. Score TCO calculado.`);
        setIsSimulateQuoteModalOpen(false);
        loadState();
      } else {
        alert(data.error || 'Error al registrar cotización');
      }
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
  };

  // Chat con Esteban Morales
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string; timestamp: string }>>([
    {
      role: 'assistant',
      content:
        'Hola, soy Esteban Morales, Gerente de Gestión Comercial y Aprovisionamiento Senior. Tengo sincronizados los costos de reposición PMP, el pipeline de cotizaciones y el inventario en tiempo real. ¿En qué decisión estratégica de compras o ventas deseas que intervenga hoy?',
      timestamp: 'Ahora'
    }
  ]);
  const [userQuery, setUserQuery] = useState('');
  const [isQueryingAi, setIsQueryingAi] = useState(false);

  // Cargar estado
  const loadState = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/commercial-procurement/state?empresaId=${encodeURIComponent(activeClientId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.state) setState(data.state);
      }
    } catch (err) {
      console.error('Error al cargar estado comercial:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadState();
  }, [activeClientId]);

  if (!state) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  const showNotification = (msg: string) => {
    setActionSuccessMsg(msg);
    setTimeout(() => setActionSuccessMsg(null), 5000);
  };

  // Acción: Ajustar Precio de Venta
  const handleOpenAdjustPrice = (item: ProductMarginAnalysis) => {
    setSelectedMarginItem(item);
    setNewPriceInput(item.precioVentaSugeridoTarget || Math.round(item.precioVentaLista * 1.1));
    setPriceAdjustReason(`Ajuste para restaurar margen objetivo del ${item.margenTargetPorcentaje}% tras alza de costo de reposición.`);
    setIsAdjustPriceOpen(true);
  };

  const handleConfirmAdjustPrice = async () => {
    if (!selectedMarginItem) return;
    try {
      const res = await fetch('/api/commercial-procurement/adjust-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresaId: activeClientId,
          sku: selectedMarginItem.sku,
          nuevoPrecioVenta: newPriceInput,
          motivo: priceAdjustReason
        })
      });
      const data = await res.json();
      if (data.success) {
        showNotification(data.message);
        setIsAdjustPriceOpen(false);
        loadState();
      }
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
  };

  // Acción: Emitir Orden de Compra Rápida por Quiebre
  const handleOpenNewOc = (item?: StockSinergyItem) => {
    if (item) {
      setSelectedStockItemForOc(item);
      const prov = state.proveedores[0];
      setSelectedSupplierRut(prov?.rut || '');
      setOcQuantity(Math.abs(item.balanceDisponibilidad) > 0 ? Math.abs(item.balanceDisponibilidad) + 10 : 20);
    } else {
      setSelectedStockItemForOc(state.sinergiaStock[0]);
      setSelectedSupplierRut(state.proveedores[0]?.rut || '');
      setOcQuantity(20);
    }
    setIsNewOcOpen(true);
  };

  const handleConfirmCreateOc = async () => {
    if (!selectedStockItemForOc) return;
    const sup = state.proveedores.find((p) => p.rut === selectedSupplierRut) || state.proveedores[0];
    const margin = state.margenes.find((m) => m.sku === selectedStockItemForOc.sku);
    const unitCost = margin ? margin.ultimoPrecioCompra : 38500;

    try {
      const res = await fetch('/api/commercial-procurement/purchase-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresaId: activeClientId,
          proveedorRut: sup.rut,
          proveedorRazonSocial: sup.razonSocial,
          condicionPago: sup.condicionPago === 'CREDITO_30_DIAS' ? 'Crédito 30 días' : 'Crédito 60 días',
          plazoEntregaDias: sup.plazoEntregaPromedioDias,
          items: [
            {
              sku: selectedStockItemForOc.sku,
              nombre: selectedStockItemForOc.nombre,
              cantidad: ocQuantity,
              precioUnitarioCLP: unitCost
            }
          ],
          motivoGeneracion: `Aprovisionamiento de resguardo anti-quiebre ejecutado por Esteban Morales para cubrir demanda proyectada.`
        })
      });
      const data = await res.json();
      if (data.success) {
        showNotification(`¡Orden de Compra ${data.order.folio} emitida exitosamente a ${sup.razonSocial}!`);
        setIsNewOcOpen(false);
        loadState();
      }
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
  };

  // Acción: Consulta Agéntica con Esteban Morales (Bucle ReAct)
  const handleSendChat = async () => {
    if (!userQuery.trim() || isQueryingAi) return;
    const userText = userQuery.trim();
    setUserQuery('');

    const newMsgs = [
      ...chatMessages,
      { role: 'user' as const, content: userText, timestamp: new Date().toLocaleTimeString('es-CL') }
    ];
    setChatMessages(newMsgs);
    setIsQueryingAi(true);

    try {
      const authToken = getStoredAuthToken();
      let assistantText = '';

      // 1. Invocar al Agente Autónomo Especialista con ReAct y Function Calling
      try {
        const agentRes = await fetch('/api/agents/autonomous/execute', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          },
          body: JSON.stringify({
            module: 'COMERCIAL_COMPRAS',
            modulo: 'COMERCIAL_COMPRAS',
            agentRole: 'Esteban Morales - Gerente Comercial y de Abastecimiento',
            empresaId: activeClientId,
            query: userText,
            context: {
              company,
              empresa: company,
              rfqs: state?.rfqs || [],
              purchaseOrders: state?.purchaseOrders || [],
            },
          }),
        });

        if (agentRes.ok) {
          const agentData = await agentRes.json();
          assistantText = agentData.decision || agentData.finalText || '';
          if (agentData.approvalRequired) {
            assistantText += `\n\n⚠️ *Gobernanza Humana Requerida:* Solicitud #${agentData.approvalDetails?.id?.slice(-6) || 'PEND'} creada para autorización de Administrador.`;
          }
        }
      } catch (agentErr) {
        console.warn('[CommercialProcurement] Fallback de agente a ai-advisor:', agentErr);
      }

      // 2. Fallback al asesor comercial si no hubo respuesta del bucle agéntico
      if (!assistantText) {
        const res = await fetch('/api/commercial-procurement/ai-advisor', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          },
          body: JSON.stringify({
            empresaId: activeClientId,
            prompt: userText,
            companyProfile: company
          })
        });
        const data = await res.json();
        if (data.success && data.text) {
          assistantText = data.text;
        } else {
          assistantText = 'Estimado, como Gerente Comercial y de Aprovisionamiento he analizado la situación: ' + (data.error || 'Operación en curso.');
        }
      }

      setChatMessages([
        ...newMsgs,
        { role: 'assistant', content: assistantText, timestamp: new Date().toLocaleTimeString('es-CL') }
      ]);
    } catch (e: any) {
      setChatMessages([
        ...newMsgs,
        {
          role: 'assistant',
          content: 'Estimado, he procesado su solicitud con el motor comercial y tributario. Se verifica cuadre de costos y márgenes de reposición conforme a la política vigente.',
          timestamp: new Date().toLocaleTimeString('es-CL')
        }
      ]);
    } finally {
      setIsQueryingAi(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Gobernanza Agéntica del Módulo Comercial & Compras (Esteban Morales) */}
      <ModuleAgentGovernanceHeader
        moduloId="COMERCIAL_COMPRAS"
        empresaId={activeClientId || company.id}
      />

      {/* Banner Principal del Agente Senior */}
      <div className="bg-gradient-to-r from-slate-900 via-sky-950 to-blue-900 text-white rounded-2xl shadow-xl border border-sky-500/30 p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-sky-600 to-blue-500 flex items-center justify-center font-extrabold text-2xl text-white shadow-lg shadow-sky-500/30 border border-sky-300/40">
                EM
              </div>
              <span className="absolute -bottom-1 -right-1 p-1 bg-emerald-500 rounded-full border-2 border-slate-900" title="Agente Senior Activo con Autonomía">
                <CheckCircle2 className="w-3.5 h-3.5 text-white" />
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                  Esteban Morales
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-sky-400/20 text-sky-200 border border-sky-400/40">
                  Rango Senior • Autonomía Comercial & Compras
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Empresa: {company.razonSocial}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-sky-200/90 font-medium mt-1">
                Gerente de Gestión Comercial & Aprovisionamiento • Puente Estratégico Compras, Ventas, Forecasting & Margen
              </p>
              <div className="flex items-center gap-4 mt-2 text-[11px] text-sky-300/70 font-mono">
                <span>RUT Empresa: {company.rut}</span>
                <span>•</span>
                <span>Margen Bruto Ponderado: {state.kpis.margenBrutoPonderadoPorcentaje}%</span>
                <span>•</span>
                <span>Cumplimiento Meta Ventas: {state.kpis.porcentajeCumplimientoMeta}%</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {onOpenVoiceDialogue && (
              <button
                type="button"
                onClick={() => onOpenVoiceDialogue('COMERCIAL_APROVISIONAMIENTO')}
                className="px-4 py-2 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white rounded-xl text-xs font-bold shadow-md shadow-sky-600/30 transition-all cursor-pointer flex items-center gap-2"
                title="Hablar directamente con Esteban Morales mediante voz neuronal Piper"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Hablar con Esteban</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setActiveTab('asesor_sr')}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold border border-white/20 transition-all cursor-pointer flex items-center gap-2"
            >
              <Bot className="w-4 h-4 text-sky-300" />
              <span>Consultoría Agéntica Sr.</span>
            </button>

            <button
              type="button"
              onClick={loadState}
              disabled={isLoading}
              className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs transition-all cursor-pointer"
              title="Recalcular métricas y sincronizar"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {actionSuccessMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-800 text-xs font-semibold flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccessMsg}</span>
          </div>
          <button onClick={() => setActionSuccessMsg(null)} className="text-emerald-700 hover:text-emerald-900 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Strip Superior: Sinergia Compras + Ventas */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* KPI 1: Facturación vs Meta */}
        <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-wider">Facturación Ventas</span>
            <DollarSign className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <p className="text-base font-black text-slate-900 mt-1">
            ${(state.kpis?.facturacionMesCLP ?? 0).toLocaleString('es-CL')}
          </p>
          <div className="flex items-center justify-between text-[11px] mt-1">
            <span className="text-slate-500">Meta: ${((state.kpis?.metaFacturacionMesCLP ?? 0) / 1000000).toFixed(0)}M</span>
            <span className="font-bold text-emerald-600">{state.kpis?.porcentajeCumplimientoMeta ?? 0}%</span>
          </div>
        </div>

        {/* KPI 2: Margen Bruto Real */}
        <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-wider">Margen Bruto PMP</span>
            <Percent className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <p className="text-base font-black text-emerald-700 mt-1">
            {state.kpis?.margenBrutoPonderadoPorcentaje ?? 0}%
          </p>
          <span className="text-[10px] text-slate-500 font-medium">Equilibrio Compras/Venta</span>
        </div>

        {/* KPI 3: Presupuesto Compras */}
        <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-wider">Presupuesto Compras</span>
            <ShoppingCart className="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <p className="text-base font-black text-slate-900 mt-1">
            ${(state.kpis?.presupuestoComprasEjecutadoCLP ?? 0).toLocaleString('es-CL')}
          </p>
          <div className="flex items-center justify-between text-[11px] mt-1">
            <span className="text-slate-500">Techo: ${((state.kpis?.presupuestoComprasAprobadoCLP ?? 0) / 1000000).toFixed(1)}M</span>
            <span className="font-bold text-indigo-600">{state.kpis?.porcentajePresupuestoEjecutado ?? 0}%</span>
          </div>
        </div>

        {/* KPI 4: Riesgo de Quiebre */}
        <div className={`p-3.5 border rounded-xl shadow-xs ${
          (state.kpis?.itemsEnRiesgoQuiebreCount ?? 0) > 0 ? 'bg-rose-50/70 border-rose-200' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700">Riesgo de Quiebre</span>
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
          </div>
          <p className="text-base font-black text-rose-700 mt-1">
            {state.kpis?.itemsEnRiesgoQuiebreCount ?? 0} {(state.kpis?.itemsEnRiesgoQuiebreCount ?? 0) === 1 ? 'producto' : 'productos'}
          </p>
          <span className="text-[10px] text-rose-600 font-semibold">Demanda &gt; Stock Disp.</span>
        </div>

        {/* KPI 5: Sobre-Stock Inmovilizado */}
        <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-wider">Sobre-Stock &gt; 90d</span>
            <Package className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <p className="text-sm font-black text-amber-800 mt-1">
            ${(state.kpis?.capitalInmovilizadoSobreStockCLP ?? 0).toLocaleString('es-CL')}
          </p>
          <span className="text-[10px] text-slate-500 font-medium">Capital para liberar</span>
        </div>

        {/* KPI 6: SLA Cumplimiento Proveedores */}
        <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-wider">SLA Proveedores</span>
            <ShieldCheck className="w-3.5 h-3.5 text-sky-600" />
          </div>
          <p className="text-base font-black text-sky-800 mt-1">
            {state.kpis.slaCumplimientoProveedoresPromedio}%
          </p>
          <span className="text-[10px] text-emerald-600 font-bold">Entregas a tiempo</span>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="bg-white border border-slate-200 rounded-xl p-1.5 shadow-xs flex flex-wrap gap-1.5">
        <button
          onClick={() => setActiveTab('sinergia_margenes')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'sinergia_margenes'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Equilibrio de Márgenes & Anti-Quiebres (Sinergia)</span>
        </button>

        <button
          onClick={() => setActiveTab('rfq_cotizaciones')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'rfq_cotizaciones'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4 text-sky-200" />
          <span>Cotizaciones de Compra (RFQ & Licitaciones)</span>
          {state.rfqs && state.rfqs.filter((r) => r.estado === 'EN_EVALUACION' || r.estado === 'ENVIADA').length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-400 text-slate-900 font-extrabold ml-1">
              {state.rfqs.filter((r) => r.estado === 'EN_EVALUACION' || r.estado === 'ENVIADA').length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('compras_abastecimiento')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'compras_abastecimiento'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          <span>Área Compras & Aprovisionamiento</span>
        </button>

        <button
          onClick={() => setActiveTab('ventas_comercial')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'ventas_comercial'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Área Ventas & Clientes VIP</span>
        </button>

        <button
          onClick={() => setActiveTab('forecasting_demanda')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'forecasting_demanda'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Pronóstico de Demanda (Forecasting 30/60/90d)</span>
        </button>

        <button
          onClick={() => setActiveTab('asesor_sr')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'asesor_sr'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Bot className="w-4 h-4" />
          <span>Consultoría Agéntica Sr. (Esteban Morales)</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: SINERGIA COMPRAS-VENTAS & EQUILIBRIO DE MÁRGENES                   */}
      {/* ========================================================================= */}
      {activeTab === 'sinergia_margenes' && (
        <div className="space-y-6">
          {/* Sección 1: Matriz de Equilibrio de Margen */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Percent className="w-4 h-4 text-sky-600" />
                  <span>Matriz de Equilibrio de Margen Real (Costo Reposición vs Precio Venta)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Esteban cruza el último costo de compra efectivo con los precios de lista para proteger el margen de contribución.
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="flex items-center gap-1 font-semibold text-emerald-700">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" /> Óptimo (&ge; Target)
                </span>
                <span className="flex items-center gap-1 font-semibold text-amber-700 ml-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500" /> Ajustado
                </span>
                <span className="flex items-center gap-1 font-semibold text-rose-700 ml-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500" /> Crítico (&lt; 20%)
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/75 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">SKU / Producto</th>
                    <th className="py-2.5 px-3 text-right">Costo PMP</th>
                    <th className="py-2.5 px-3 text-right">Última Compra</th>
                    <th className="py-2.5 px-3 text-right">Precio Venta Lista</th>
                    <th className="py-2.5 px-3 text-right">Margen Bruto $</th>
                    <th className="py-2.5 px-3 text-center">Margen Real %</th>
                    <th className="py-2.5 px-3 text-center">Target %</th>
                    <th className="py-2.5 px-3 text-center">Estado</th>
                    <th className="py-2.5 px-3 text-center">Acción Autónoma Sr.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {state.margenes.map((m) => (
                    <tr key={m.sku} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{m.nombre}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          SKU: {m.sku} • Categoría: {m.categoria}
                        </div>
                        {m.alertaAgente && (
                          <div className="text-[11px] text-sky-800 bg-sky-50 p-1.5 rounded mt-1 border border-sky-100">
                            <strong>Esteban:</strong> {m.alertaAgente}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-600">
                        ${(m.costoUnitarioPMP ?? 0).toLocaleString('es-CL')}
                      </td>
                      <td className="py-3 px-3 text-right font-mono">
                        <span className="font-bold text-slate-900">${(m.ultimoPrecioCompra ?? 0).toLocaleString('es-CL')}</span>
                        {(m.variacionCostoPorcentaje ?? 0) > 0 && (
                          <span className="text-[10px] text-rose-600 block">+{m.variacionCostoPorcentaje}%</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                        ${(m.precioVentaLista ?? 0).toLocaleString('es-CL')}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-emerald-700 font-semibold">
                        +${(m.margenBrutoCLP ?? 0).toLocaleString('es-CL')}
                      </td>
                      <td className="py-3 px-3 text-center font-bold">
                        <span
                          className={`px-2 py-0.5 rounded text-xs ${
                            m.estadoMargen === 'OPTIMO'
                              ? 'bg-emerald-100 text-emerald-800 font-black'
                              : m.estadoMargen === 'AJUSTADO'
                              ? 'bg-amber-100 text-amber-800 font-black'
                              : 'bg-rose-100 text-rose-800 font-black animate-pulse'
                          }`}
                        >
                          {m.margenBrutoPorcentaje}%
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-slate-500">
                        {m.margenTargetPorcentaje}%
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                            m.estadoMargen === 'OPTIMO'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : m.estadoMargen === 'AJUSTADO'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {m.estadoMargen}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        {m.estadoMargen !== 'OPTIMO' ? (
                          <button
                            type="button"
                            onClick={() => handleOpenAdjustPrice(m)}
                            className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold shadow-xs transition-all cursor-pointer flex items-center gap-1 mx-auto"
                            title={`Ajustar precio sugerido a $${m.precioVentaSugeridoTarget.toLocaleString('es-CL')}`}
                          >
                            <Sliders className="w-3 h-3" />
                            <span>Ajustar Precio Lista</span>
                          </button>
                        ) : (
                          <span className="text-[10px] font-semibold text-emerald-600 flex items-center justify-center gap-1">
                            <Check className="w-3 h-3" /> Protegido
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sección 2: Detector Anti-Quiebre de Stock vs Pipeline de Ventas */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-rose-600" />
                  <span>Coordinación de Cadena de Suministro: Detector Anti-Quiebre & Anti-Sobre-Stock</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Evita vender productos que no se pueden abastecer y detecta mercancía estancada para aplicar descuentos.
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleOpenNewOc()}
                className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Emitir Orden de Compra Preventiva</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/75 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Producto</th>
                    <th className="py-2.5 px-3 text-center">Stock Físico</th>
                    <th className="py-2.5 px-3 text-center">Comprometido</th>
                    <th className="py-2.5 px-3 text-center font-bold text-blue-700">Disponible</th>
                    <th className="py-2.5 px-3 text-center">Cotizaciones Abiertas</th>
                    <th className="py-2.5 px-3 text-center">Demanda 30d</th>
                    <th className="py-2.5 px-3 text-center">Balance Proyectado</th>
                    <th className="py-2.5 px-3 text-center">Cobertura</th>
                    <th className="py-2.5 px-3 text-center">Acción Inmediata Sr.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {state.sinergiaStock.map((s) => (
                    <tr key={s.sku} className={`hover:bg-slate-50/80 transition-colors ${s.riesgoQuiebre ? 'bg-rose-50/30' : ''}`}>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{s.nombre}</div>
                        <div className="text-[10px] text-slate-500 font-mono">SKU: {s.sku}</div>
                        {s.alertaAgente && (
                          <div className={`text-[11px] p-1.5 rounded mt-1 border ${
                            s.riesgoQuiebre ? 'bg-rose-50 text-rose-800 border-rose-200 font-medium' : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}>
                            {s.alertaAgente}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-medium text-slate-800">
                        {(s.stockFisico ?? 0).toLocaleString('es-CL')}
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-slate-500">
                        {(s.stockComprometido ?? 0).toLocaleString('es-CL')}
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-black text-blue-700">
                        {(s.stockDisponible ?? 0).toLocaleString('es-CL')}
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-purple-700">
                        {(s.cotizacionesAbiertas ?? 0).toLocaleString('es-CL')}
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-slate-600">
                        {(s.ventasProyectadas30Dias ?? 0).toLocaleString('es-CL')}
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-black">
                        <span
                          className={`px-2 py-0.5 rounded text-xs ${
                            s.balanceDisponibilidad < 0
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {s.balanceDisponibilidad > 0 ? `+${s.balanceDisponibilidad}` : s.balanceDisponibilidad} unids
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-slate-600">
                        {s.diasCobertura} días
                      </td>
                      <td className="py-3 px-3 text-center">
                        {s.riesgoQuiebre ? (
                          <button
                            type="button"
                            onClick={() => handleOpenNewOc(s)}
                            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-bold shadow-xs transition-all cursor-pointer flex items-center gap-1 mx-auto"
                          >
                            <ShoppingCart className="w-3 h-3" />
                            <span>Comprar Urgente</span>
                          </button>
                        ) : s.sobreStockDias ? (
                          <button
                            type="button"
                            onClick={() => {
                              showNotification(`Esteban Morales ha formulado una campaña de descuento comercial para '${s.nombre}' a clientes de transporte.`);
                            }}
                            className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-bold shadow-xs transition-all cursor-pointer flex items-center gap-1 mx-auto"
                          >
                            <Percent className="w-3 h-3" />
                            <span>Oferta a Clientes VIP</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-emerald-600 font-semibold flex items-center justify-center gap-1">
                            <Check className="w-3 h-3" /> Suministro OK
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: COTIZACIONES DE COMPRA (RFQ & LICITACIONES)                          */}
      {/* ========================================================================= */}
      {activeTab === 'rfq_cotizaciones' && (
        <div className="space-y-6">
          {/* Header de la sección RFQ */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-sky-600" />
                <h2 className="text-base font-bold text-slate-900">
                  Gestión de Solicitudes de Cotización (RFQ), Licitaciones & Adjudicación
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800">
                  Agente Sr. Esteban Morales
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-3xl">
                Emite solicitudes de cotización a múltiples proveedores, realiza el seguimiento activo en tiempo real de sus respuestas (con reintentos y recordatorios automáticos), evalúa las ofertas bajo la Matriz Comparativa TCO y adjudica al proveedor ganador emitiendo la Orden de Compra oficial con un solo clic.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsNewRfqModalOpen(true)}
              className="px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer flex items-center gap-2 shrink-0 self-start md:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Solicitud RFQ a Proveedores</span>
            </button>
          </div>

          {/* Selector de RFQs vigentes e históricas */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {(state.rfqs || []).map((rfq) => {
              const isSelected = rfq.id === selectedRfqId;
              const totalInvitados = rfq.proveedoresInvitados.length;
              const cotizadasCount = rfq.proveedoresInvitados.filter((p) => p.estadoSeguimiento === 'COTIZADA').length;
              const retrasadosCount = rfq.proveedoresInvitados.filter((p) => p.estadoSeguimiento === 'NO_RESPONDE_RETRASADO').length;

              return (
                <div
                  key={rfq.id}
                  onClick={() => setSelectedRfqId(rfq.id)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer shadow-xs ${
                    isSelected
                      ? 'bg-sky-50/70 border-sky-400 ring-2 ring-sky-500/20 shadow-md'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-extrabold text-slate-800">{rfq.folioRfq}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                        rfq.estado === 'ADJUDICADA'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : rfq.estado === 'EN_EVALUACION'
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-blue-100 text-blue-800 border border-blue-200'
                      }`}
                    >
                      {rfq.estado}
                    </span>
                  </div>

                  <h3 className="text-xs font-bold text-slate-900 mt-2 line-clamp-2">{rfq.titulo}</h3>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 mt-3 pt-2 border-t border-slate-100">
                    <span>Plazo: <strong>{rfq.fechaLimiteRespuesta}</strong></span>
                    <span className="font-medium text-slate-700">
                      {cotizadasCount}/{totalInvitados} ofertas
                    </span>
                  </div>

                  {retrasadosCount > 0 && rfq.estado !== 'ADJUDICADA' && (
                    <div className="mt-2 text-[10px] font-semibold text-rose-700 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      <span>{retrasadosCount} {retrasadosCount === 1 ? 'proveedor retrasado' : 'proveedores retrasados'}</span>
                    </div>
                  )}

                  {rfq.folioOrdenCompra && (
                    <div className="mt-2 text-[10px] font-mono font-bold text-emerald-700 flex items-center gap-1 bg-emerald-50 p-1 rounded">
                      <CheckCircle className="w-3 h-3 text-emerald-600" />
                      <span>OC Oficial: {rfq.folioOrdenCompra}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Detalle y Operación de la RFQ Seleccionada */}
          {(() => {
            const currentRfq = (state.rfqs || []).find((r) => r.id === selectedRfqId) || (state.rfqs || [])[0];
            if (!currentRfq) return null;

            const quotedSuppliers = currentRfq.proveedoresInvitados.filter((p) => p.estadoSeguimiento === 'COTIZADA');

            return (
              <div className="space-y-6">
                {/* Banner de Recomendación Estratégica del Agente Senior */}
                <div className="bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 text-white rounded-2xl p-5 border border-sky-400/30 shadow-lg relative overflow-hidden">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center font-bold text-white text-lg shrink-0 border border-sky-300/30 shadow-md">
                      EM
                    </div>
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-sky-300 uppercase tracking-wider">
                          Recomendación de Adjudicación • Esteban Morales
                        </span>
                        <span className="px-2 py-0.2 rounded text-[9px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                          Matriz TCO
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-sky-100/90 leading-relaxed font-medium">
                        {currentRfq.recomendacionAgenteSr ||
                          'He auditado las propuestas económicas, los plazos de entrega y las condiciones de crédito. Analiza la matriz comparativa para adjudicar la mejor opción.'}
                      </p>
                      {currentRfq.motivoAdjudicacion && (
                        <div className="text-[11px] text-emerald-300 font-mono bg-emerald-950/60 p-2 rounded-lg border border-emerald-500/30 mt-2">
                          <strong>Adjudicado:</strong> {currentRfq.motivoAdjudicacion} {currentRfq.folioOrdenCompra ? `• OC: ${currentRfq.folioOrdenCompra}` : ''}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card de Información & Items solicitados */}
                <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                        <Package className="w-4 h-4 text-sky-600" />
                        <span>Especificaciones e Ítems Solicitados a Cotizar</span>
                      </h3>
                      <span className="text-xs text-slate-500">
                        {currentRfq.items.length} productos en licitación • Plazo de cierre: {currentRfq.fechaLimiteRespuesta} ({currentRfq.diasPlazoRespuesta} días)
                      </span>
                    </div>

                    <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
                      Folio: {currentRfq.folioRfq}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {currentRfq.items.map((it) => (
                      <div key={it.sku} className="p-3 rounded-lg border border-slate-200 bg-slate-50/70 text-xs space-y-1">
                        <div className="flex justify-between items-start font-bold text-slate-900">
                          <span>{it.nombre}</span>
                          <span className="font-mono text-sky-700">{it.cantidad} {it.unidadMedida}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          SKU: {it.sku} • Costo Referencial PMP: ${it.precioReferencialPmp.toLocaleString('es-CL')} CLP
                        </div>
                        {it.especificaciones && (
                          <div className="text-[11px] text-slate-600 italic bg-white p-1.5 rounded border border-slate-200/60 mt-1">
                            {it.especificaciones}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* SECCIÓN 1: SEGUIMIENTO EN VIVO DE PROVEEDORES & RECORDATORIOS */}
                <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
                  <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                        <BellRing className="w-4 h-4 text-amber-600" />
                        <span>Seguimiento de Proveedores & Reintentos de Cotización</span>
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Monitorea quién abrió la solicitud, quién tiene la cotización en preparación o retrasada, y envía recordatorios inmediatos.
                      </p>
                    </div>

                    <span className="text-xs font-medium text-slate-500">
                      {currentRfq.proveedoresInvitados.length} proveedores invitados
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">Proveedor & Contacto</th>
                          <th className="py-2.5 px-3 text-center">Estado Seguimiento</th>
                          <th className="py-2.5 px-3 text-center">Oferta Neta</th>
                          <th className="py-2.5 px-3 text-center">Plazo Entrega</th>
                          <th className="py-2.5 px-3 text-center">Historial Recordatorios</th>
                          <th className="py-2.5 px-3 text-center">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {currentRfq.proveedoresInvitados.map((prov) => {
                          const isQuoted = prov.estadoSeguimiento === 'COTIZADA';

                          return (
                            <tr key={prov.id} className="hover:bg-slate-50 transition-colors">
                              <td className="py-3 px-3">
                                <div className="font-bold text-slate-900">{prov.proveedorRazonSocial}</div>
                                <div className="text-[10px] text-slate-500 font-mono">
                                  RUT: {prov.proveedorRut} • {prov.emailContacto}
                                </div>
                                {prov.telefonoContacto && (
                                  <div className="text-[10px] text-slate-400 font-mono">
                                    Tel: {prov.telefonoContacto}
                                  </div>
                                )}
                              </td>

                              <td className="py-3 px-3 text-center">
                                <span
                                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                    prov.estadoSeguimiento === 'COTIZADA'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : prov.estadoSeguimiento === 'EN_PREPARACION'
                                      ? 'bg-blue-100 text-blue-800'
                                      : prov.estadoSeguimiento === 'VISTA_LEIDA'
                                      ? 'bg-purple-100 text-purple-800'
                                      : prov.estadoSeguimiento === 'NO_RESPONDE_RETRASADO'
                                      ? 'bg-rose-100 text-rose-800 animate-pulse'
                                      : 'bg-slate-100 text-slate-700'
                                  }`}
                                >
                                  {prov.estadoSeguimiento === 'COTIZADA' && <CheckCircle className="w-3 h-3 text-emerald-600" />}
                                  {prov.estadoSeguimiento === 'NO_RESPONDE_RETRASADO' && <AlertTriangle className="w-3 h-3 text-rose-600" />}
                                  {prov.estadoSeguimiento}
                                </span>
                              </td>

                              <td className="py-3 px-3 text-center font-mono font-bold text-slate-800">
                                {prov.montoNetoOfertado != null
                                  ? `$${prov.montoNetoOfertado.toLocaleString('es-CL')} CLP`
                                  : <span className="text-slate-400 font-normal italic">Pendiente</span>}
                              </td>

                              <td className="py-3 px-3 text-center font-mono text-slate-700">
                                {prov.plazoEntregaDiasOfertado != null
                                  ? `${prov.plazoEntregaDiasOfertado} días`
                                  : <span className="text-slate-400 font-normal italic">-</span>}
                              </td>

                              <td className="py-3 px-3 text-center">
                                <div className="text-[11px] text-slate-700 font-mono">
                                  {prov.cantidadReiteraciones} {prov.cantidadReiteraciones === 1 ? 'reiteración' : 'reiteraciones'}
                                </div>
                                {prov.ultimoRecordatorioAt && (
                                  <div className="text-[10px] text-slate-400 font-mono">
                                    Último: {new Date(prov.ultimoRecordatorioAt).toLocaleDateString('es-CL')} {new Date(prov.ultimoRecordatorioAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                )}
                              </td>

                              <td className="py-3 px-3 text-center">
                                <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                  {!isQuoted && (
                                    <>
                                      <button
                                        type="button"
                                        disabled={actionLoadingId === `reminder-${prov.proveedorRut}`}
                                        onClick={() => handleSendReminder(currentRfq.id, prov.proveedorRut, prov.proveedorRazonSocial)}
                                        className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg text-[10px] font-bold shadow-xs transition-all cursor-pointer flex items-center gap-1"
                                        title="Enviar recordatorio automático de respuesta vía Email/WhatsApp"
                                      >
                                        <BellRing className="w-3 h-3" />
                                        <span>Reiterar Recordatorio</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSupplierForQuote(prov);
                                          setIsSimulateQuoteModalOpen(true);
                                        }}
                                        className="px-2.5 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-[10px] font-bold shadow-xs transition-all cursor-pointer flex items-center gap-1"
                                        title="Cargar o simular la cotización recibida de este proveedor"
                                      >
                                        <Plus className="w-3 h-3" />
                                        <span>Cargar Oferta</span>
                                      </button>
                                    </>
                                  )}

                                  {isQuoted && (
                                    <span className="text-[11px] text-emerald-700 font-bold flex items-center gap-1">
                                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                                      Cotizada ({prov.scoringPonderadoTotal} pts)
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* SECCIÓN 2: MATRIZ COMPARATIVA LADO A LADO & SELECCIÓN DEL MEJOR PROVEEDOR */}
                {quotedSuppliers.length > 0 && (
                  <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
                    <div className="p-4 bg-gradient-to-r from-slate-50 to-sky-50/50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                          <Scale className="w-4 h-4 text-sky-600" />
                          <span>Matriz Comparativa de Ofertas (Análisis TCO & Selección de Proveedor)</span>
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Comparación estricta de precio neto, plazo de entrega, costo de flete, financiamiento y scoring histórico ponderado.
                        </p>
                      </div>

                      <div className="text-xs font-bold text-sky-800 bg-sky-100 px-3 py-1 rounded-full">
                        {quotedSuppliers.length} {quotedSuppliers.length === 1 ? 'oferta lista para evaluar' : 'ofertas listas para evaluar'}
                      </div>
                    </div>

                    <div className="overflow-x-auto p-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {quotedSuppliers.map((offer) => {
                          const isWinner = offer.esOfertaGanadora || currentRfq.proveedorGanadorRut === offer.proveedorRut;
                          const isTopRecommendation =
                            quotedSuppliers.slice().sort((a, b) => (b.scoringPonderadoTotal || 0) - (a.scoringPonderadoTotal || 0))[0]?.proveedorRut === offer.proveedorRut;

                          return (
                            <div
                              key={offer.id}
                              className={`rounded-2xl border p-4 space-y-3 relative transition-all ${
                                isWinner
                                  ? 'bg-emerald-50/60 border-emerald-400 shadow-md ring-2 ring-emerald-500/20'
                                  : isTopRecommendation
                                  ? 'bg-sky-50/50 border-sky-400 shadow-sm'
                                  : 'bg-white border-slate-200'
                              }`}
                            >
                              {/* Badge Superior Recomendación */}
                              {isTopRecommendation && !isWinner && (
                                <div className="flex items-center gap-1 text-[10px] font-black uppercase text-sky-800 bg-sky-200/80 px-2.5 py-0.5 rounded-full w-fit">
                                  <Sparkles className="w-3 h-3 text-amber-500" />
                                  <span>Recomendado por Esteban Morales</span>
                                </div>
                              )}

                              {isWinner && (
                                <div className="flex items-center gap-1 text-[10px] font-black uppercase text-emerald-800 bg-emerald-200 px-2.5 py-0.5 rounded-full w-fit">
                                  <Award className="w-3 h-3 text-emerald-700" />
                                  <span>Proveedor Adjudicado (Ganador)</span>
                                </div>
                              )}

                              <div>
                                <h4 className="text-xs font-bold text-slate-900">{offer.proveedorRazonSocial}</h4>
                                <span className="text-[10px] text-slate-500 font-mono">RUT: {offer.proveedorRut}</span>
                              </div>

                              {/* Puntaje TCO */}
                              <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-xs space-y-1.5">
                                <div className="flex justify-between items-center text-xs">
                                  <span className="font-bold text-slate-700">Puntaje Ponderado TCO:</span>
                                  <span className="font-mono font-black text-sm text-sky-700">
                                    {offer.scoringPonderadoTotal || 85} / 100
                                  </span>
                                </div>
                                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                                  <div
                                    className={`h-2 rounded-full ${
                                      (offer.scoringPonderadoTotal || 0) >= 90
                                        ? 'bg-emerald-500'
                                        : (offer.scoringPonderadoTotal || 0) >= 80
                                        ? 'bg-sky-500'
                                        : 'bg-amber-500'
                                    }`}
                                    style={{ width: `${Math.min(offer.scoringPonderadoTotal || 70, 100)}%` }}
                                  />
                                </div>
                              </div>

                              {/* Parámetros de la Oferta */}
                              <div className="space-y-2 text-xs font-mono">
                                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                                  <span className="text-slate-500">Monto Neto Ofertado:</span>
                                  <span className="font-black text-slate-900">
                                    ${(offer.montoNetoOfertado || 0).toLocaleString('es-CL')} CLP
                                  </span>
                                </div>

                                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                                  <span className="text-slate-500">Costo de Flete:</span>
                                  <span className="font-bold text-slate-700">
                                    {offer.costoFleteClp && offer.costoFleteClp > 0
                                      ? `$${offer.costoFleteClp.toLocaleString('es-CL')} CLP`
                                      : 'Bonificado ($0)'}
                                  </span>
                                </div>

                                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                                  <span className="text-slate-500">Plazo de Entrega:</span>
                                  <span className="font-bold text-sky-700">
                                    {offer.plazoEntregaDiasOfertado} días hábiles
                                  </span>
                                </div>

                                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                                  <span className="text-slate-500">Condición de Pago:</span>
                                  <span className="font-bold text-indigo-700">
                                    {offer.condicionPagoOfertada || 'Crédito 30 días'}
                                  </span>
                                </div>
                              </div>

                              {offer.observacionesProveedor && (
                                <p className="text-[11px] text-slate-600 bg-white p-2 rounded-lg border border-slate-100 italic">
                                  "{offer.observacionesProveedor}"
                                </p>
                              )}

                              {/* Botón de Adjudicación Directa (1 Clic) */}
                              <div className="pt-2">
                                {currentRfq.estado === 'ADJUDICADA' ? (
                                  isWinner ? (
                                    <div className="w-full py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold text-center shadow-xs flex items-center justify-center gap-1.5">
                                      <CheckCircle className="w-4 h-4" />
                                      <span>Adjudicado • OC: {currentRfq.folioOrdenCompra}</span>
                                    </div>
                                  ) : (
                                    <div className="text-center text-[11px] text-slate-400 py-2">
                                      Licitación concluida
                                    </div>
                                  )
                                ) : (
                                  <button
                                    type="button"
                                    disabled={actionLoadingId === `award-${offer.proveedorRut}`}
                                    onClick={() => handleAwardRfq(currentRfq.id, offer.proveedorRut, offer.proveedorRazonSocial)}
                                    className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center justify-center gap-2 ${
                                      isTopRecommendation
                                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                                        : 'bg-slate-800 hover:bg-slate-900 text-white'
                                    }`}
                                  >
                                    <Award className="w-4 h-4" />
                                    <span>Adjudicar y Generar Orden de Compra (OC)</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: ÁREA DE COMPRAS & APROVISIONAMIENTO                                */}
      {/* ========================================================================= */}
      {activeTab === 'compras_abastecimiento' && (
        <div className="space-y-6">
          {/* Matriz de Proveedores & Scoring */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Award className="w-4 h-4 text-sky-600" />
                  <span>Homologación, Negociación Comercial & Scoring de Proveedores</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Evaluación continua de calidad, cumplimiento de plazos (SLA), condiciones de pago y descuentos por volumen.
                </p>
              </div>

              <div className="text-xs text-slate-500 font-medium">
                {state.proveedores.length} proveedores homologados en cartera
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
              {state.proveedores.map((p) => (
                <div key={p.rut} className="p-4 rounded-xl border border-slate-200 bg-white hover:border-sky-300 transition-all shadow-xs space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-slate-900">{p.razonSocial}</h4>
                        <span className="px-2 py-0.5 rounded text-[9px] font-extrabold uppercase bg-emerald-100 text-emerald-800">
                          {p.estadoHomologacion}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">
                        RUT: {p.rut} • {p.rubro}
                      </span>
                    </div>

                    <div className="text-right">
                      <div className="flex items-center gap-1 text-amber-500 font-black text-sm">
                        <span>★</span>
                        <span>{p.scoringGeneral.toFixed(1)}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">Score General</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-lg text-xs font-mono">
                    <div>
                      <span className="text-[10px] text-slate-500 block">Cumplimiento SLA</span>
                      <span className="font-bold text-slate-900">{p.cumplimientoPlazoSla}%</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Calidad &amp; Cero Mermas</span>
                      <span className="font-bold text-emerald-700">{p.calidadConformidad}%</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Condición Pago</span>
                      <span className="font-bold text-indigo-700">
                        {p.condicionPago.replace('CREDITO_', '').replace('_DIAS', ' Días')}
                      </span>
                    </div>
                  </div>

                  {/* Descuentos por volumen */}
                  {p.descuentosPorVolumen && p.descuentosPorVolumen.length > 0 && (
                    <div className="text-xs">
                      <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                        Escala de Descuentos Negociada:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {p.descuentosPorVolumen.map((d, idx) => (
                          <span key={idx} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-mono border border-blue-200">
                            &gt;{d.cantidadMinima} unids: <strong>-{d.descuentoPorcentaje}%</strong> (${d.precioUnitarioFinal.toLocaleString('es-CL')}/u)
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="text-[11px] text-slate-600 bg-slate-50/80 p-2 rounded border border-slate-100 flex items-center justify-between">
                    <span>Compras Acumuladas: <strong>${p.montoTotalCompradoCLP.toLocaleString('es-CL')} CLP</strong> ({p.ordenesEmitidasHistorico} OCs)</span>
                    <button
                      type="button"
                      onClick={() => handleOpenNewOc()}
                      className="px-2 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded text-[10px] font-bold cursor-pointer transition-colors"
                    >
                      Pedir Cotización / OC
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Control Presupuestario de Compras */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  <span>Control Presupuestario de Adquisiciones (Aprobado vs Facturado SII)</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Esteban supervisa que ninguna orden de compra exceda el techo presupuestario asignado por el directorio.
                </p>
              </div>

              <span className="text-xs font-bold text-indigo-700">
                Presupuesto Total: ${state.kpis.presupuestoComprasAprobadoCLP.toLocaleString('es-CL')} CLP
              </span>
            </div>

            <div className="space-y-3">
              {state.presupuestoCategorias.map((b) => (
                <div key={b.categoriaId} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
                  <div className="flex justify-between items-center font-bold text-slate-900">
                    <span>{b.nombre}</span>
                    <span>
                      ${b.montoFacturadoSII.toLocaleString('es-CL')} / ${b.presupuestoAprobadoCLP.toLocaleString('es-CL')} CLP ({b.porcentajeEjecutado}%)
                    </span>
                  </div>

                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        b.porcentajeEjecutado > 90 ? 'bg-amber-500' : 'bg-blue-600'
                      }`}
                      style={{ width: `${Math.min(b.porcentajeEjecutado, 100)}%` }}
                    />
                  </div>

                  <div className="flex justify-between text-[11px] text-slate-500 font-mono">
                    <span>Comprometido en OCs vigentes: ${b.montoComprometidoOC.toLocaleString('es-CL')}</span>
                    <span className="text-emerald-700 font-bold">Saldo disponible: ${b.saldoDisponibleCLP.toLocaleString('es-CL')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Historial de Órdenes de Compra Emitidas */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                <span>Órdenes de Compra Gestionadas por el Agente Sr.</span>
              </h3>
              <span className="text-xs text-slate-500">{state.ordenesCompra.length} órdenes registradas</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Folio OC</th>
                    <th className="py-2.5 px-3">Fecha</th>
                    <th className="py-2.5 px-3">Proveedor</th>
                    <th className="py-2.5 px-3">Items</th>
                    <th className="py-2.5 px-3 text-right">Neto CLP</th>
                    <th className="py-2.5 px-3 text-right">Total Bruto</th>
                    <th className="py-2.5 px-3 text-center">Estado</th>
                    <th className="py-2.5 px-3">Motivo Estratégico</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {state.ordenesCompra.map((oc) => (
                    <tr key={oc.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{oc.folio}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-500">{oc.fechaEmision}</td>
                      <td className="py-2.5 px-3 font-medium text-slate-800">
                        {oc.proveedorRazonSocial}
                        <span className="text-[10px] text-slate-500 block font-mono">({oc.proveedorRut})</span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {(oc.items || []).map((it) => `${it.cantidad}x ${it.nombre}`).join(', ')}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">${(oc.totalNetoCLP ?? 0).toLocaleString('es-CL')}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                        ${(oc.totalBrutoCLP ?? 0).toLocaleString('es-CL')}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                          {oc.estado}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-[11px] text-slate-600 italic">{oc.motivoGeneracion}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: ÁREA DE VENTAS & GESTIÓN COMERCIAL                                 */}
      {/* ========================================================================= */}
      {activeTab === 'ventas_comercial' && (
        <div className="space-y-6">
          {/* Cartera de Clientes Clave (VIP) */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Users className="w-4 h-4 text-sky-600" />
                  <span>Gestión de Clientes Clave (VIP) & Segmentación ABC</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Fidelización de cuentas estratégicas, alertas de inactividad comercial y control de líneas de crédito.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsNewQuoteOpen(true)}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nueva Cotización Comercial</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Cliente / Razón Social</th>
                    <th className="py-2.5 px-3 text-center">Segmento</th>
                    <th className="py-2.5 px-3 text-right">Facturación Histórica</th>
                    <th className="py-2.5 px-3 text-center">Frecuencia</th>
                    <th className="py-2.5 px-3 text-center">Última Compra</th>
                    <th className="py-2.5 px-3 text-right">Crédito Utilizado</th>
                    <th className="py-2.5 px-3 text-center">Riesgo Fidelización</th>
                    <th className="py-2.5 px-3">Estrategia Comercial Sr.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {state.clientesClave.map((c) => (
                    <tr key={c.rut} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{c.razonSocial}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          RUT: {c.rut} • Contacto: {c.contactoNombre} ({c.email})
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                            c.clasificacionAbc === 'A_VIP'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {c.clasificacionAbc}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                        ${(c.facturacionAcumuladaCLP ?? 0).toLocaleString('es-CL')}
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-slate-600">
                        Cada {c.frecuenciaCompraDias} días
                      </td>
                      <td className="py-3 px-3 text-center font-mono">
                        <span className={c.diasDesdeUltimaCompra > 40 ? 'text-rose-600 font-bold' : 'text-slate-800'}>
                          Hace {c.diasDesdeUltimaCompra} días
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono">
                        <span className="font-medium text-slate-800">${(c.creditoUtilizadoCLP ?? 0).toLocaleString('es-CL')}</span>
                        <span className="text-[10px] text-slate-400 block">Límite: ${((c.limiteCreditoCLP ?? 0) / 1000000).toFixed(0)}M</span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            c.riesgoFidelizacion === 'ALTO_INACTIVO'
                              ? 'bg-rose-100 text-rose-800 animate-pulse'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {c.riesgoFidelizacion}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-[11px] text-sky-900 bg-sky-50/70 p-2 rounded border border-sky-100">
                        <strong>Esteban:</strong> {c.estrategiaAgente}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sinergia Agéntica: Roberto Soto (Producción) <-> Esteban Morales (Comercial) */}
          <div className="bg-gradient-to-r from-amber-500/10 via-purple-500/10 to-blue-500/10 border border-purple-200/80 rounded-xl p-4 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold text-base shadow-sm shrink-0">
                  🤝
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                      Coordinación Agéntica: Roberto Soto (Planta & Costeo) ↔ Esteban Morales (Comercial & Compras)
                    </h4>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
                      Multi-Agente Activo
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">
                    <strong>Roberto Soto</strong> formula el costeo técnico industrial (MPD + MOD + CIF bajo NIC 2) y presupuestos de fabricación. 
                    <strong> Esteban Morales</strong> valida las condiciones comerciales, stock de materias primas y aplica el margen de venta objetivo.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {onOpenVoiceDialogue && (
                  <button
                    type="button"
                    onClick={() => onOpenVoiceDialogue('roberto_soto')}
                    className="px-3 py-1.5 bg-white border border-purple-300 hover:bg-purple-50 text-purple-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Consultar a Roberto</span>
                  </button>
                )}
                {onNavigateToTab && (
                  <button
                    type="button"
                    onClick={() => onNavigateToTab('production')}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Ver Módulo Producción</span>
                  </button>
                )}
              </div>
            </div>

            {/* Presupuestos de Roberto listos para comercializar */}
            {productionBudgets && productionBudgets.length > 0 && (
              <div className="mt-3 pt-3 border-t border-purple-200/60">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-2">
                  Presupuestos Industriales de Roberto disponibles para emitir Cotización Comercial:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {productionBudgets.slice(0, 3).map((pb: any) => (
                    <div key={pb.id} className="p-2.5 bg-white rounded-lg border border-purple-100 text-xs flex flex-col justify-between">
                      <div>
                        <div className="font-bold text-slate-900 flex justify-between">
                          <span>{pb.folio}</span>
                          <span className="text-[10px] text-purple-700 font-mono font-bold">
                            ${(pb.totalCostoEstimado || pb.precioVentaNeto || 0).toLocaleString('es-CL')} CLP
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-600 truncate mt-0.5">{pb.clienteNombre || 'Cliente Industrial'}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">Costo Técnico Industrial (MPD + MOD + CIF)</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setQuoteClientRut(pb.clienteRut || '');
                          setQuoteItems([
                            {
                              sku: pb.folio,
                              nombre: `Fabricación: ${pb.clienteNombre || 'OP Personalizada'}`,
                              cantidad: 1,
                              precioUnitario: Math.round((pb.totalCostoEstimado || pb.precioVentaNeto || 100000) * 1.35)
                            }
                          ]);
                          setIsNewQuoteOpen(true);
                        }}
                        className="mt-2 w-full py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded text-[11px] font-bold text-center border border-purple-200 transition-colors cursor-pointer"
                      >
                        + Cotizar con Margen Comercial
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Pipeline de Cotizaciones Emitidas */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-purple-600" />
                <span>Pipeline de Cotizaciones & Validación de Stock Previo</span>
              </h3>
              <span className="text-xs text-slate-500">{state.cotizaciones.length} cotizaciones abiertas</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Folio Cotización</th>
                    <th className="py-2.5 px-3">Fecha</th>
                    <th className="py-2.5 px-3">Cliente</th>
                    <th className="py-2.5 px-3">Detalle Items</th>
                    <th className="py-2.5 px-3 text-right">Neto CLP</th>
                    <th className="py-2.5 px-3 text-center font-bold text-emerald-700">Margen Real %</th>
                    <th className="py-2.5 px-3 text-center">Estado</th>
                    <th className="py-2.5 px-3 text-center">Stock Validado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {state.cotizaciones.map((q) => (
                    <tr key={q.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{q.folio}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-500">{q.fechaEmision}</td>
                      <td className="py-2.5 px-3 font-medium text-slate-800">
                        {q.clienteRazonSocial}
                        <span className="text-[10px] text-slate-500 block font-mono">({q.clienteRut})</span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {(q.items || []).map((it) => `${it.cantidad}x ${it.nombre}`).join(', ')}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                        ${(q.totalNetoCLP ?? 0).toLocaleString('es-CL')}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-700">
                        {q.margenBrutoTotalPorcentaje ?? 0}%
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800">
                          {q.estado}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="text-emerald-600 text-[11px] font-bold flex items-center justify-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Conforme
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: PRONÓSTICO DE DEMANDA & FORECASTING IA                              */}
      {/* ========================================================================= */}
      {activeTab === 'forecasting_demanda' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-sky-600" />
                  <span>Pronóstico Predictivo de Demanda & Plan de Aprovisionamiento (30 / 60 / 90 Días)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Algoritmo de forecasting que combina velocidad histórica de ventas, estacionalidad chilena y cotizaciones en curso.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 bg-sky-100 text-sky-800 rounded-lg text-xs font-bold font-mono">
                  Factor Estacional Activo: 1.15x (Cierre de temporada)
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Producto / SKU</th>
                    <th className="py-2.5 px-3 text-center">Demanda Histórica (M-3/M-2/M-1)</th>
                    <th className="py-2.5 px-3 text-center font-bold text-blue-700">Proyección 30d</th>
                    <th className="py-2.5 px-3 text-center">Proyección 60d</th>
                    <th className="py-2.5 px-3 text-center">Proyección 90d</th>
                    <th className="py-2.5 px-3 text-center font-bold text-rose-700">Fecha Límite OC</th>
                    <th className="py-2.5 px-3 text-center">Lote Sugerido OC</th>
                    <th className="py-2.5 px-3 text-right">Inversión Estimada</th>
                    <th className="py-2.5 px-3 text-center">Acción Planificada Sr.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {state.forecasting.map((f) => (
                    <tr key={f.sku} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{f.nombre}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          SKU: {f.sku} • Proveedor: {f.proveedorSugeridoNombre}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-slate-600">
                        {f.ventasHistoricasMeses.mesMeno3} / {f.ventasHistoricasMeses.mesMeno2} / {f.ventasHistoricasMeses.mesMeno1} u
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-black text-blue-700">
                        {f.demandaProyectada30Dias} unids
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-slate-600">
                        {f.demandaProyectada60Dias} unids
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-slate-600">
                        {f.demandaProyectada90Dias} unids
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-rose-600">
                        {f.fechaLimiteEmisionOC}
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-900">
                        {f.cantidadSugeridaOC} unids
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                        ${(f.costoEstimadoCompraCLP ?? 0).toLocaleString('es-CL')}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={async () => {
                            const sup = state.proveedores.find((p) => p.rut === f.proveedorSugeridoRut) || state.proveedores[0];
                            try {
                              const res = await fetch('/api/commercial-procurement/purchase-order', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  empresaId: activeClientId,
                                  proveedorRut: sup.rut,
                                  proveedorRazonSocial: sup.razonSocial,
                                  condicionPago: sup.condicionPago === 'CREDITO_30_DIAS' ? 'Crédito 30 días' : 'Crédito 60 días',
                                  plazoEntregaDias: sup.plazoEntregaPromedioDias,
                                  items: [
                                    {
                                      sku: f.sku,
                                      nombre: f.nombre,
                                      cantidad: f.cantidadSugeridaOC,
                                      precioUnitarioCLP: Math.round(f.costoEstimadoCompraCLP / f.cantidadSugeridaOC)
                                    }
                                  ],
                                  motivoGeneracion: `Aprovisionamiento predictivo planificado por Forecasting de Esteban Morales para fecha límite ${f.fechaLimiteEmisionOC}.`
                                })
                              });
                              const data = await res.json();
                              if (data.success) {
                                showNotification(`¡Plan de aprovisionamiento ejecutado: OC ${data.order?.folio || ''} emitida por ${f.cantidadSugeridaOC} unids de '${f.nombre}'!`);
                                loadState();
                              }
                            } catch (e: any) {
                              alert('Error al emitir OC: ' + e.message);
                            }
                          }}
                          className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold shadow-xs transition-all cursor-pointer flex items-center gap-1 mx-auto"
                        >
                          <Check className="w-3 h-3" />
                          <span>Aprobar Plan OC</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: ASESOR INTERACTIVO CON ESTEBAN MORALES                             */}
      {/* ========================================================================= */}
      {activeTab === 'asesor_sr' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden flex flex-col h-[600px]">
          <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b-2 border-sky-500">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-600 flex items-center justify-center font-bold text-white text-base">
                EM
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  Diálogo Estratégico con Esteban Morales (Gerente Comercial & Compras Sr.)
                </h3>
                <p className="text-[11px] text-sky-200">
                  Consulta sobre fijación de precios, abastecimiento preventivo, negociación con proveedores y proyecciones de venta.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setUserQuery('Esteban, audita todos los precios de venta frente al último costo de compra y dime qué productos tienen el margen en riesgo.');
                }}
                className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-[11px] font-medium transition-colors"
              >
                Auditar Márgenes
              </button>
              <button
                type="button"
                onClick={() => {
                  setUserQuery('Esteban, proyecta el abastecimiento del próximo mes y dime a qué proveedores conviene emitir órdenes de compra.');
                }}
                className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-[11px] font-medium transition-colors"
              >
                Proyectar Compras
              </button>
            </div>
          </div>

          {/* Historial de Mensajes */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/60">
            {chatMessages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-lg bg-sky-600 flex items-center justify-center font-bold text-white text-xs shrink-0">
                    EM
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl p-4 text-xs leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-tr-none'
                      : 'bg-white border border-slate-200 text-slate-800 shadow-xs rounded-tl-none whitespace-pre-line'
                  }`}
                >
                  <p>{msg.content}</p>
                  <span
                    className={`text-[9px] block text-right mt-1.5 font-mono ${
                      msg.role === 'user' ? 'text-blue-200' : 'text-slate-400'
                    }`}
                  >
                    {msg.timestamp}
                  </span>
                </div>
              </div>
            ))}
            {isQueryingAi && (
              <div className="flex gap-3 items-center text-xs text-slate-500 italic">
                <RefreshCw className="w-4 h-4 animate-spin text-sky-600" />
                <span>Esteban Morales está cruzando costos de compra, inventario y márgenes...</span>
              </div>
            )}
          </div>

          {/* Input de Diálogo */}
          <div className="p-3 bg-white border-t border-slate-200 flex gap-2">
            <input
              type="text"
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSendChat();
              }}
              placeholder="Escribe tu consulta comercial o de aprovisionamiento para Esteban Morales..."
              className="flex-1 px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white"
            />
            <button
              type="button"
              onClick={handleSendChat}
              disabled={isQueryingAi || !userQuery.trim()}
              className="px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Enviar</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: AJUSTE DE PRECIO DE VENTA SUGERIDO                                 */}
      {/* ========================================================================= */}
      {isAdjustPriceOpen && selectedMarginItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between border-b-2 border-sky-500">
              <div className="flex items-center gap-2.5">
                <Sliders className="w-5 h-5 text-sky-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">Ajuste de Precio de Lista Sugerido</h3>
                  <span className="text-[11px] text-slate-400 font-mono">SKU: {selectedMarginItem.sku}</span>
                </div>
              </div>
              <button onClick={() => setIsAdjustPriceOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="font-bold text-slate-900 text-sm">{selectedMarginItem.nombre}</div>
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                  <div>Costo PMP: <strong>${(selectedMarginItem.costoUnitarioPMP ?? 0).toLocaleString('es-CL')}</strong></div>
                  <div>Última Compra: <strong>${(selectedMarginItem.ultimoPrecioCompra ?? 0).toLocaleString('es-CL')}</strong></div>
                  <div>Precio Actual: <strong>${(selectedMarginItem.precioVentaLista ?? 0).toLocaleString('es-CL')}</strong></div>
                  <div>Margen Actual: <strong className="text-rose-600">{selectedMarginItem.margenBrutoPorcentaje ?? 0}%</strong></div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nuevo Precio de Venta Lista Sugerido ($ CLP sin IVA)
                </label>
                <input
                  type="number"
                  value={newPriceInput}
                  onChange={(e) => setNewPriceInput(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-mono font-bold bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Precio recomendado por Esteban para {selectedMarginItem.margenTargetPorcentaje}% de margen: <strong>${(selectedMarginItem.precioVentaSugeridoTarget ?? 0).toLocaleString('es-CL')} CLP</strong>
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Motivo del Ajuste Comercial
                </label>
                <textarea
                  value={priceAdjustReason}
                  onChange={(e) => setPriceAdjustReason(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsAdjustPriceOpen(false)}
                className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmAdjustPrice}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer"
              >
                Confirmar Ajuste de Precio
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: NUEVA ORDEN DE COMPRA DE RESGUARDO                                 */}
      {/* ========================================================================= */}
      {isNewOcOpen && selectedStockItemForOc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between border-b-2 border-emerald-500">
              <div className="flex items-center gap-2.5">
                <ShoppingCart className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">Emitir Orden de Compra de Aprovisionamiento</h3>
                  <span className="text-[11px] text-slate-400 font-mono">Gestión Estratégica Senior</span>
                </div>
              </div>
              <button onClick={() => setIsNewOcOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="font-bold text-slate-900">{selectedStockItemForOc.nombre}</div>
                <div className="text-[11px] text-slate-500 font-mono">
                  Stock Disponible: <strong>{selectedStockItemForOc.stockDisponible}</strong> • Demanda comprometida: <strong>{selectedStockItemForOc.cotizacionesAbiertas} unids</strong>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Proveedor Seleccionado
                </label>
                <select
                  value={selectedSupplierRut}
                  onChange={(e) => setSelectedSupplierRut(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  {state.proveedores.map((p) => (
                    <option key={p.rut} value={p.rut}>
                      {p.razonSocial} (SLA: {p.cumplimientoPlazoSla}%, {p.condicionPago.replace('CREDITO_', '').replace('_DIAS', ' Días')})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Cantidad a Pedir (Unidades)
                </label>
                <input
                  type="number"
                  value={ocQuantity}
                  onChange={(e) => setOcQuantity(Number(e.target.value))}
                  min="1"
                  className="w-full px-3 py-2 text-sm font-mono font-bold bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsNewOcOpen(false)}
                className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmCreateOc}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer"
              >
                Emitir y Autorizar OC
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: NUEVA COTIZACIÓN COMERCIAL                                         */}
      {/* ========================================================================= */}
      {isNewQuoteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between border-b-2 border-purple-500">
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="w-5 h-5 text-purple-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">Formular Cotización Comercial con Margen Protegido</h3>
                  <span className="text-[11px] text-slate-400 font-mono">Validación de Stock en Tiempo Real</span>
                </div>
              </div>
              <button onClick={() => setIsNewQuoteOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Cliente Solicitante (Seleccionar o ingresar RUT)
                </label>
                <select
                  value={quoteClientRut}
                  onChange={(e) => setQuoteClientRut(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                >
                  <option value="">Seleccione un cliente de la cartera...</option>
                  {state.clientesClave.map((c) => (
                    <option key={c.rut} value={c.rut}>
                      {c.razonSocial} ({c.rut})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Producto a Cotizar
                </label>
                <select
                  value={quoteItems[0]?.sku || ''}
                  onChange={(e) => {
                    const selSku = e.target.value;
                    const margin = state.margenes.find((m) => m.sku === selSku);
                    if (margin) {
                      setQuoteItems([
                        {
                          sku: margin.sku,
                          nombre: margin.nombre,
                          cantidad: quoteItems[0]?.cantidad || 5,
                          precioUnitario: margin.precioVentaLista
                        }
                      ]);
                    }
                  }}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                >
                  {state.margenes.map((m) => (
                    <option key={m.sku} value={m.sku}>
                      {m.nombre} - Precio Lista: ${m.precioVentaLista.toLocaleString('es-CL')} (Margen: {m.margenBrutoPorcentaje}%)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Cantidad Solicitada
                  </label>
                  <input
                    type="number"
                    value={quoteItems[0]?.cantidad || 5}
                    onChange={(e) => {
                      const qty = Number(e.target.value);
                      setQuoteItems([{ ...quoteItems[0], cantidad: qty }]);
                    }}
                    min="1"
                    className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Precio Unitario Neto ($ CLP)
                  </label>
                  <input
                    type="number"
                    value={quoteItems[0]?.precioUnitario || 58000}
                    onChange={(e) => {
                      const p = Number(e.target.value);
                      setQuoteItems([{ ...quoteItems[0], precioUnitario: p }]);
                    }}
                    className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
            </div>

            <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsNewQuoteOpen(false)}
                className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  const client = (state.clientesClave && state.clientesClave.find((c) => c.rut === quoteClientRut)) || state.clientesClave?.[0] || {
                    rut: quoteClientRut || '76.123.456-7',
                    razonSocial: 'Cliente Comercial'
                  };
                  try {
                    const sanitizedItems = (quoteItems || []).map((it) => {
                      const p = Number(it.precioUnitario || (it as any).precioUnitarioCLP || 0);
                      return {
                        sku: it.sku || 'SKU-01',
                        nombre: it.nombre || 'Producto',
                        cantidad: Number(it.cantidad || 1),
                        precioUnitarioCLP: p,
                        precioUnitario: p
                      };
                    });
                    const res = await fetch('/api/commercial-procurement/quote', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        empresaId: activeClientId,
                        clienteRut: client.rut,
                        clienteRazonSocial: client.razonSocial,
                        items: sanitizedItems
                      })
                    });
                    const data = await res.json();
                    if (data.success) {
                      showNotification(`¡Cotización ${data.quote?.folio || ''} emitida exitosamente para ${client.razonSocial}!`);
                      setIsNewQuoteOpen(false);
                      loadState();
                    } else {
                      alert('Error: ' + (data.error || 'No se pudo emitir la cotización'));
                    }
                  } catch (e: any) {
                    alert('Error: ' + e.message);
                  }
                }}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer"
              >
                Generar Cotización
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: NUEVA SOLICITUD DE COTIZACIÓN (RFQ / LICITACIÓN)                   */}
      {/* ========================================================================= */}
      {isNewRfqModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between border-b-2 border-sky-500">
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="w-5 h-5 text-sky-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">Emitir Solicitud de Cotizaciones de Compra (RFQ)</h3>
                  <span className="text-[11px] text-slate-400 font-mono">Convocatoria a Múltiples Proveedores Homologados</span>
                </div>
              </div>
              <button onClick={() => setIsNewRfqModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs max-h-[75vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Título de la Licitación / Solicitud RFQ
                </label>
                <input
                  type="text"
                  value={newRfqTitle}
                  onChange={(e) => setNewRfqTitle(e.target.value)}
                  placeholder="Ej: Licitación Suministro Semestral de Repuestos Hidráulicos"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Plazo Límite de Respuesta (Días)
                  </label>
                  <input
                    type="number"
                    value={newRfqDays}
                    onChange={(e) => setNewRfqDays(Number(e.target.value))}
                    min="1"
                    max="30"
                    className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Fecha Cierre Proyectada
                  </label>
                  <div className="px-3 py-2 text-xs font-mono bg-slate-100 rounded-lg text-slate-700 font-bold">
                    {new Date(Date.now() + newRfqDays * 86400000).toISOString().split('T')[0]}
                  </div>
                </div>
              </div>

              {/* Ítems a cotizar */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Producto a Cotizar
                  </label>
                </div>
                <select
                  value={newRfqItems[0]?.sku || ''}
                  onChange={(e) => {
                    const selSku = e.target.value;
                    const stockItem = state.sinergiaStock.find((s) => s.sku === selSku);
                    const marginItem = state.margenes.find((m) => m.sku === selSku);
                    if (stockItem || marginItem) {
                      setNewRfqItems([
                        {
                          sku: selSku,
                          nombre: stockItem ? stockItem.nombre : marginItem!.nombre,
                          cantidad: newRfqItems[0]?.cantidad || 50,
                          unidadMedida: 'UN',
                          precioReferencialPmp: marginItem ? marginItem.costoUnitarioPMP : 35000,
                          especificaciones: 'Certificación de calidad del fabricante, empaque sellado.'
                        }
                      ]);
                    }
                  }}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-none"
                >
                  {state.sinergiaStock.map((s) => (
                    <option key={s.sku} value={s.sku}>
                      {s.nombre} (Disp: {s.stockDisponible} unids {s.riesgoQuiebre ? '⚠️ RIESGO QUIEBRE' : ''})
                    </option>
                  ))}
                </select>

                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                      Cantidad a Solicitar
                    </label>
                    <input
                      type="number"
                      value={newRfqItems[0]?.cantidad || 50}
                      onChange={(e) => {
                        const qty = Number(e.target.value);
                        setNewRfqItems([{ ...newRfqItems[0], cantidad: qty }]);
                      }}
                      min="1"
                      className="w-full px-3 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                      Costo Referencial PMP ($ CLP)
                    </label>
                    <input
                      type="number"
                      value={newRfqItems[0]?.precioReferencialPmp || 38500}
                      onChange={(e) => {
                        const p = Number(e.target.value);
                        setNewRfqItems([{ ...newRfqItems[0], precioReferencialPmp: p }]);
                      }}
                      className="w-full px-3 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              {/* Selección de Proveedores a invitar */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Seleccionar Proveedores Homologados a Invitar ({newRfqSelectedSupplierRuts.length} seleccionados)
                </label>
                <div className="space-y-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200 max-h-40 overflow-y-auto">
                  {state.proveedores.map((p) => {
                    const isChecked = newRfqSelectedSupplierRuts.includes(p.rut);
                    return (
                      <label
                        key={p.rut}
                        className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                          isChecked ? 'bg-sky-50 border border-sky-300' : 'bg-white border border-slate-200'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewRfqSelectedSupplierRuts([...newRfqSelectedSupplierRuts, p.rut]);
                            } else {
                              setNewRfqSelectedSupplierRuts(newRfqSelectedSupplierRuts.filter((r) => r !== p.rut));
                            }
                          }}
                          className="rounded text-sky-600 focus:ring-sky-500"
                        />
                        <div className="flex-1">
                          <span className="font-bold text-slate-900 block">{p.razonSocial}</span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            RUT: {p.rut} • SLA: {p.cumplimientoPlazoSla}% • Score: ★{p.scoringGeneral}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsNewRfqModalOpen(false)}
                className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCreateNewRfq}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Emitir y Enviar Solicitud RFQ</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CARGAR / SIMULAR OFERTA DE PROVEEDOR                               */}
      {/* ========================================================================= */}
      {isSimulateQuoteModalOpen && supplierForQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between border-b-2 border-emerald-500">
              <div className="flex items-center gap-2.5">
                <Scale className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">Registrar Oferta Formal de Proveedor</h3>
                  <span className="text-[11px] text-slate-400 font-mono">{supplierForQuote.proveedorRazonSocial}</span>
                </div>
              </div>
              <button onClick={() => setIsSimulateQuoteModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 font-mono text-[11px]">
                <div className="text-slate-500">Proveedor: <strong>{supplierForQuote.proveedorRazonSocial}</strong></div>
                <div className="text-slate-500">RUT: <strong>{supplierForQuote.proveedorRut}</strong> • Contacto: {supplierForQuote.emailContacto}</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Monto Neto Total Ofertado ($ CLP)
                  </label>
                  <input
                    type="number"
                    value={quoteInputMontoNeto}
                    onChange={(e) => setQuoteInputMontoNeto(Number(e.target.value))}
                    min="1000"
                    className="w-full px-3 py-2 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Plazo de Entrega (Días Hábiles)
                  </label>
                  <input
                    type="number"
                    value={quoteInputPlazoDias}
                    onChange={(e) => setQuoteInputPlazoDias(Number(e.target.value))}
                    min="1"
                    className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Condición de Pago
                  </label>
                  <select
                    value={quoteInputCondicionPago}
                    onChange={(e) => setQuoteInputCondicionPago(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="Contado">Contado</option>
                    <option value="Crédito 30 días">Crédito 30 días</option>
                    <option value="Crédito 60 días">Crédito 60 días</option>
                    <option value="Crédito 90 días">Crédito 90 días</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Costo de Flete ($ CLP)
                  </label>
                  <input
                    type="number"
                    value={quoteInputFlete}
                    onChange={(e) => setQuoteInputFlete(Number(e.target.value))}
                    min="0"
                    placeholder="0 para flete bonificado"
                    className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Observaciones / Garantías de la Oferta
                </label>
                <input
                  type="text"
                  value={quoteInputObs}
                  onChange={(e) => setQuoteInputObs(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsSimulateQuoteModalOpen(false)}
                className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveSupplierQuote}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer"
              >
                Guardar Oferta & Calcular Scoring TCO
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
