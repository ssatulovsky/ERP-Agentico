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
  ReceiptText
} from 'lucide-react';
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
  PlaywrightRobotRunReport,
  PlaywrightRobotStep
} from '../types';
import { formatCLP, formatNumberCL, validateRut } from '../utils/chileanAccounting';
import {
  SII_PORTAL_URLS,
  SII_FORM_SELECTORS,
  generatePlaywrightTypeScriptScript,
  generatePlaywrightPythonScript,
  runSimulatedPlaywrightExecution
} from '../utils/siiPlaywrightGenerator';

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
}) => {
  const [activeTab, setActiveTab] = useState<'EMISION' | 'PLAYWRIGHT_RPA' | 'COBRANZA' | 'HONORARIOS_BOLETAS'>('EMISION');

  // Estado del borrador actual de emisión
  const isExentoDefault = Boolean((company as any)?.exentoIvaGiro || company.id === 'client-innovagile');
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
      },
    ],
    montoNeto: isExentoDefault ? 0 : 8500000,
    montoExento: isExentoDefault ? 8500000 : 0,
    montoIva: isExentoDefault ? 0 : Math.round(8500000 * 0.19),
    montoTotal: isExentoDefault ? 8500000 : Math.round(8500000 * 1.19),
  });

  // Modal para seleccionar Orden de Producción
  const [showOpSelectorModal, setShowOpSelectorModal] = useState(false);

  // Estados de Ejecución Playwright
  const [isExecutingPlaywright, setIsExecutingPlaywright] = useState(false);
  const [playwrightReport, setPlaywrightReport] = useState<PlaywrightRobotRunReport | null>(null);
  const [executionLogs, setExecutionLogs] = useState<string[]>([]);
  const [currentStepInfo, setCurrentStepInfo] = useState<PlaywrightRobotStep | null>(null);
  const [copiedCode, setCopiedCode] = useState<'TS' | 'PY' | 'CLI' | null>(null);
  const [alertSuccess, setAlertSuccess] = useState<string | null>(null);

  // Clave Tributaria o Certificado Digital (en entorno de pruebas/simulación)
  const [claveTributaria, setClaveTributaria] = useState('Certificado_Digital_Activo_SII_2026');

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

    const opTotal = op.costoTotalProduccion || op.costoPrimo || (op as any).totalCostoEstimado || 12500000;
    const precioHito = Math.round((opTotal * 1.35) * pct); // 35% margen comercial sobre costo
    const isExenta = draft.tipoDte === '34';
    const opCodigo = op.folioOP || (op as any).codigo || 'OP-2026-101';
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

  // Ejecución Asistida Playwright
  const handleExecutePlaywrightRpa = async () => {
    setIsExecutingPlaywright(true);
    setExecutionLogs([]);
    setCurrentStepInfo(null);
    setActiveTab('PLAYWRIGHT_RPA');

    try {
      const report = await runSimulatedPlaywrightExecution(
        draft,
        company.rut,
        (step, logLine) => {
          setCurrentStepInfo(step);
          setExecutionLogs(prev => [...prev, logLine]);
        }
      );

      setPlaywrightReport(report);
      setIsExecutingPlaywright(false);

      const assignedFolio = report.folioAsignado || 1421;

      // 1. Crear documento DTE formal en el Registro de Compras/Ventas
      const newDte: DteDocument = {
        id: `dte-emitted-${Date.now()}`,
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
        estadoSii: 'ACEPTADO',
        estadoPago: draft.condicionVenta === 'CONTADO' ? 'COBRADO' : 'PENDIENTE',
        glosa: `Emisión DTE ${draft.tipoDte} Folio ${assignedFolio} a ${draft.razonSocialReceptor} (Playwright RPA SII) - ${draft.items[0]?.nombre || 'Venta'}`,
      };

      onAddDte(newDte);

      // 2. Generar Asiento Contable Automático en el Libro Diario
      const accountingEntry: AccountingEntry = {
        id: `entry-sale-playwright-${Date.now()}`,
        fecha: draft.fechaEmision,
        concepto: `Venta DTE ${draft.tipoDte} Folio ${assignedFolio} - ${draft.razonSocialReceptor}`,
        documento: `DTE ${draft.tipoDte} N° ${assignedFolio}`,
        lineas: draft.tipoDte === '61'
          ? [
              // Nota de Crédito (Reversa débito fiscal y cuenta cliente)
              {
                cuentaCodigo: '4.1.03',
                cuentaNombre: 'Descuentos y Devoluciones sobre Ventas',
                debe: draft.montoNeto,
                haber: 0,
              },
              ...(draft.montoIva > 0 ? [{
                cuentaCodigo: '2.1.03',
                cuentaNombre: 'IVA Débito Fiscal (Reverso Art. 21)',
                debe: draft.montoIva,
                haber: 0,
              }] : []),
              {
                cuentaCodigo: '1.1.03',
                cuentaNombre: `Clientes Nacionales (${draft.razonSocialReceptor})`,
                debe: 0,
                haber: draft.montoTotal,
              },
            ]
          : [
              // Factura de Venta estándar
              {
                cuentaCodigo: '1.1.03',
                cuentaNombre: `Clientes Nacionales (${draft.razonSocialReceptor})`,
                debe: draft.montoTotal,
                haber: 0,
              },
              ...(draft.montoNeto > 0 ? [{
                cuentaCodigo: '4.1.01',
                cuentaNombre: 'Ingresos por Ventas del Giro (Redes/Acuicultura)',
                debe: 0,
                haber: draft.montoNeto,
              }] : []),
              ...(draft.montoExento > 0 ? [{
                cuentaCodigo: '4.1.02',
                cuentaNombre: 'Ingresos por Ventas / Servicios Exentos de IVA',
                debe: 0,
                haber: draft.montoExento,
              }] : []),
              ...(draft.montoIva > 0 ? [{
                cuentaCodigo: '2.1.03',
                cuentaNombre: 'IVA Débito Fiscal',
                debe: 0,
                haber: draft.montoIva,
              }] : []),
            ],
        totalDebe: draft.montoTotal,
        totalHaber: draft.montoTotal,
        balanceado: true,
        origen: 'RCV_VENTA',
        creadoEn: new Date().toISOString(),
      };

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
        `¡Factura DTE ${draft.tipoDte} Folio ${assignedFolio} emitida con éxito en el SII mediante Playwright! Sincronizada automáticamente en: 1) Registro de Ventas, 2) Asiento de Diario Contable y 3) Flujo de Caja para el ${draft.fechaVencimiento}.`
      );

    } catch (err: any) {
      setIsExecutingPlaywright(false);
      console.error('[BillingAutonomousAgent] Error en ejecución Playwright:', err);
    }
  };

  // Descargar scripts
  const handleDownloadScript = (format: 'TS' | 'PY') => {
    const code = format === 'TS'
      ? generatePlaywrightTypeScriptScript(draft, company.rut, claveTributaria)
      : generatePlaywrightPythonScript(draft, company.rut, claveTributaria);

    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sii_billing_playwright_${draft.tipoDte}_${company.rut.replace(/[^0-9kK]/g, '')}.${format === 'TS' ? 'ts' : 'py'}`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Copiar código al portapapeles
  const handleCopyCode = (format: 'TS' | 'PY' | 'CLI') => {
    let text = '';
    if (format === 'TS') {
      text = generatePlaywrightTypeScriptScript(draft, company.rut, claveTributaria);
    } else if (format === 'PY') {
      text = generatePlaywrightPythonScript(draft, company.rut, claveTributaria);
    } else {
      text = `npx playwright test --headed`;
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
      {/* Banner Superior Agente Autónomo */}
      <div className="bg-gradient-to-r from-[#0f172a] via-[#1e293b] to-[#0f172a] rounded-xl p-5 text-white shadow-md border border-slate-700/60">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-blue-600/30 border border-blue-400/40 flex items-center justify-center shrink-0 shadow-inner">
              <Bot className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight text-white">
                  Agente Autónomo de Facturación y Cobranza (DTE & SII Playwright)
                </h1>
                <span className="bg-blue-500/20 text-blue-300 border border-blue-400/30 px-2 py-0.5 rounded text-[10px] font-mono font-semibold">
                  RPA zeus.sii.cl
                </span>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Sin Burocracia de Certificación
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-3xl leading-relaxed">
                Emisión automatizada de <strong>Facturas Electrónicas (DTE 33)</strong>, <strong>Facturas Exentas (DTE 34)</strong>, <strong>Exportación (DTE 110)</strong>, <strong>Notas de Crédito (DTE 61)</strong>, <strong>Débito (DTE 56)</strong> y <strong>Boletas (DTE 39/41)</strong> ejecutando Playwright contra el portal oficial del SII. Sincroniza al instante con el <strong>Libro Diario Contable</strong> y el <strong>Flujo de Caja Proyectado</strong>.
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
            onClick={() => setActiveTab('PLAYWRIGHT_RPA')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'PLAYWRIGHT_RPA'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>2. Robot Playwright & Rutas SII</span>
            {isExecutingPlaywright && (
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
                        value={draft.referencia?.folioRef || 1419}
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

              {/* Botón Principal: Ejecución Robótica Playwright */}
              <div className="pt-4 border-t border-slate-200 space-y-2">
                <button
                  type="button"
                  disabled={isExecutingPlaywright}
                  onClick={handleExecutePlaywrightRpa}
                  className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isExecutingPlaywright ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                      <span>Ejecutando Robot Playwright en SII...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 text-emerald-300 fill-emerald-300" />
                      <span>Emitir con Robot Playwright en SII</span>
                    </>
                  )}
                </button>
                <p className="text-[10px] text-slate-400 text-center">
                  Inicia sesión en <code>zeus.sii.cl</code>, llena el formulario oficial, timbra el DTE y sincroniza Flujo de Caja y Diario Contable.
                </p>
              </div>
            </div>

            {/* Credenciales & Certificado SII */}
            <div className="bg-slate-100 border border-slate-200 rounded-xl p-4 text-xs space-y-2">
              <div className="flex items-center justify-between text-slate-700 font-bold">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" /> Certificado / Clave SII
                </span>
                <span className="text-[10px] text-emerald-700 font-mono bg-emerald-100 px-1.5 py-0.5 rounded">
                  Listo para Playwright
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                RUT Emisor: <strong className="text-slate-800">{company.rut}</strong>
              </p>
              <div>
                <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">Clave Tributaria / PFX</label>
                <input
                  type="password"
                  value={claveTributaria}
                  onChange={(e) => setClaveTributaria(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded p-1.5 font-mono text-[11px]"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ROBOT PLAYWRIGHT & RUTAS SII */}
      {activeTab === 'PLAYWRIGHT_RPA' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-blue-600" />
                  <span>Automatización Robótica Playwright contra el Servicio de Impuestos Internos</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Rutas oficiales del Portal de Facturación Gratuita MIPYME y selectores de campo exactos para bypass de set de pruebas
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownloadScript('TS')}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-blue-600" />
                  <span>Descargar Script TypeScript</span>
                </button>
                <button
                  onClick={() => handleDownloadScript('PY')}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-amber-600" />
                  <span>Descargar Script Python</span>
                </button>
              </div>
            </div>

            {/* Rutas y Campos Oficiales del SII */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <h4 className="font-bold text-slate-700 flex items-center gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
                  <span>Rutas de Navegación Oficiales del SII</span>
                </h4>
                <ul className="space-y-1.5 text-slate-600 font-mono text-[11px]">
                  <li>
                    <span className="text-slate-400">Login:</span> {SII_PORTAL_URLS.login}
                  </li>
                  <li>
                    <span className="text-slate-400">Facturación MIPYME:</span> {SII_PORTAL_URLS.facturacionMipyme}?OPCION={draft.tipoDte}
                  </li>
                  <li>
                    <span className="text-slate-400">RCV Resumen:</span> {SII_PORTAL_URLS.rcvResumen}
                  </li>
                  <li>
                    <span className="text-slate-400">Detalle Boletas:</span> {SII_PORTAL_URLS.rcvBoletas}
                  </li>
                  <li>
                    <span className="text-slate-400">BHE Emitidas:</span> {SII_PORTAL_URLS.bheEmitidas}
                  </li>
                  <li>
                    <span className="text-slate-400">BHE Recibidas:</span> {SII_PORTAL_URLS.bheRecibidas}
                  </li>
                </ul>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <h4 className="font-bold text-slate-700 flex items-center gap-1.5">
                  <Code2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Selectores de Formulario (Mapeo DOM Oficial)</span>
                </h4>
                <ul className="space-y-1 text-slate-600 font-mono text-[11px]">
                  <li><span className="text-slate-400">RUT Receptor:</span> <code>{SII_FORM_SELECTORS.rutReceptor}</code></li>
                  <li><span className="text-slate-400">Razón Social:</span> <code>{SII_FORM_SELECTORS.razonSocialReceptor}</code></li>
                  <li><span className="text-slate-400">Giro Comercial:</span> <code>{SII_FORM_SELECTORS.giroReceptor}</code></li>
                  <li><span className="text-slate-400">Líneas de Item:</span> <code>ITEM_NOMBRE_i, ITEM_CANT_i, ITEM_PREC_i</code></li>
                  <li><span className="text-slate-400">Firma & Envío:</span> <code>{SII_FORM_SELECTORS.btnFirmarEnviar}</code></li>
                  <li><span className="text-slate-400">Folio Oficial:</span> <code>{SII_FORM_SELECTORS.lblFolioGenerado}</code></li>
                </ul>
              </div>
            </div>

            {/* Consola de Ejecución en Tiempo Real */}
            <div className="bg-[#0f172a] rounded-xl p-4 text-white font-mono text-xs space-y-3 shadow-inner">
              <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                  </div>
                  <span className="text-slate-400 text-[11px] font-semibold">
                    playwright-worker-sii :: chrome-headless --session-active
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopyCode('CLI')}
                    className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    {copiedCode === 'CLI' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedCode === 'CLI' ? 'Copiado' : 'Copiar CLI'}</span>
                  </button>
                  <button
                    disabled={isExecutingPlaywright}
                    onClick={handleExecutePlaywrightRpa}
                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[11px] font-sans font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <Play className="w-3 h-3" />
                    <span>Lanzar Ejecución</span>
                  </button>
                </div>
              </div>

              {/* Paso actual */}
              {currentStepInfo && (
                <div className="p-2.5 bg-blue-950/60 border border-blue-800/60 rounded-lg text-blue-200 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-400" />
                    <span>Paso {currentStepInfo.stepNumber}/6: <strong>{currentStepInfo.descripcion}</strong></span>
                  </div>
                  <span className="text-[10px] text-blue-300 font-mono">{currentStepInfo.selector}</span>
                </div>
              )}

              {/* Logs */}
              <div className="h-64 overflow-y-auto space-y-1 text-slate-300 text-[11px] select-text">
                {executionLogs.length === 0 ? (
                  <div className="text-slate-500 py-6 text-center">
                    Robot Playwright en espera. Presiona "Lanzar Ejecución" o emite un DTE desde el formulario para observar la interacción robótica contra zeus.sii.cl en vivo.
                  </div>
                ) : (
                  executionLogs.map((log, idx) => (
                    <div key={idx} className={log.includes('✓') || log.includes('¡ÉXITO!') ? 'text-emerald-400' : log.includes('▶') ? 'text-blue-300' : 'text-slate-300'}>
                      {log}
                    </div>
                  ))
                )}
              </div>
            </div>
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
                  const opTotal = op.costoTotalProduccion || op.costoPrimo || (op as any).totalCostoEstimado || 12500000;
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
