import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  FileCode,
  Copy,
  Check,
  Info,
  Building2,
  Calendar,
  Send,
  Bot,
  Sparkles,
  ChevronRight,
  TrendingDown,
  Clock,
  ShieldCheck,
  DollarSign,
  Landmark,
  Scale,
  Eye,
  CheckCircle,
  Percent,
  Sliders,
  ArrowRight,
  Download
} from 'lucide-react';
import {
  F29Declaration,
  DteDocument,
  EmployeePayroll,
  AccountingEntry,
  CompanyProfile,
  ClientCompany,
  ChileIndicators,
  F29SeniorResult,
  F29AlertaFiscal
} from '../types';
import {
  formatCLP,
  formatNumberCL,
  formatNormalizedAccountingEntry,
  DEFAULT_INDICATORS,
  createF29PaymentEntry,
  createF29TgrPaymentEntry
} from '../utils/chileanAccounting';
import { downloadF29Pdf, downloadF29Csv } from '../utils/reportGenerators';
import {
  calculatePreF29,
  convertF29AsientoToAccountingEntry
} from '../utils/f29SeniorEngine';
import { JournalEntryView } from './accounting/JournalEntryView';
import { StandardJournalEntryModal } from './accounting/StandardJournalEntryModal';
import { getStoredAuthToken } from '../services/apiClient';
import { F29SettlementTrackerExample } from '../examples/F29SettlementTrackerExample';
import { periodoActual, ultimosPeriodos, etiquetaPeriodo } from '../utils/periodo';

interface F29SeniorAgentProps {
  f29: F29Declaration;
  onUpdateF29: (f29: F29Declaration) => void;
  dtes: DteDocument[];
  payrolls: EmployeePayroll[];
  company: CompanyProfile;
  indicators?: ChileIndicators;
  onAddEntry: (entry: AccountingEntry) => void;
}

export const F29SeniorAgent: React.FC<F29SeniorAgentProps> = ({
  f29,
  onUpdateF29,
  dtes = [],
  payrolls = [],
  company,
  indicators = DEFAULT_INDICATORS,
  onAddEntry,
}) => {
  const safeDtes = Array.isArray(dtes) ? dtes : [];
  const safePayrolls = Array.isArray(payrolls) ? payrolls : [];

  // Estado general
  const [activeSubTab, setActiveSubTab] = useState<'panel' | 'terminal' | 'rcv_audit' | 'patente_f22' | 'queue_tracker'>('panel');
  const [selectedPeriod, setSelectedPeriod] = useState<string>(f29?.periodo || periodoActual());
  const [isPostergacionActive, setIsPostergacionActive] = useState<boolean>(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [copiedAsiento, setCopiedAsiento] = useState(false);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [showEntrySuccessModal, setShowEntrySuccessModal] = useState<AccountingEntry | null>(null);

  // Parámetros tributarios editables en vivo
  const [tasaPpmManual, setTasaPpmManual] = useState<number>(company?.tasaPpm || 0.01);
  const [tasaPpmVoluntariaManual, setTasaPpmVoluntariaManual] = useState<number>(company?.tasaPpmVoluntaria || 0);

  // Chat con el Agente Senior
  const [userQuery, setUserQuery] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{
    role: 'user' | 'agent';
    text: string;
    jsonPayload?: any;
    timestamp: string;
  }>>([]);

  // Cálculo determinístico base
  const [seniorResult, setSeniorResult] = useState<F29SeniorResult>(() => {
    return calculatePreF29(company, safeDtes, safePayrolls, indicators, {
      periodo: selectedPeriod,
      tasaPpmManual,
      tasaPpmVoluntariaManual,
      simularPostergacionArt64: isPostergacionActive
    });
  });

  // Recalcular cuando cambian parámetros
  useEffect(() => {
    const res = calculatePreF29(company, dtes, payrolls, indicators, {
      periodo: selectedPeriod,
      tasaPpmManual,
      tasaPpmVoluntariaManual,
      simularPostergacionArt64: isPostergacionActive
    });
    setSeniorResult(res);

    // Sincronizar con F29Declaration del estado global
    const updatedF29: F29Declaration = {
      ...f29,
      periodo: selectedPeriod,
      ventasAfectasNeto: res.f29_mapeo.c030_monto_base_ppm,
      debitoFiscalIva: res.f29_mapeo.c538_total_debito,
      comprasNetoAfecto: res.detalle_credito?.comprasInternasAfectasNeto || 0,
      creditoFiscalIva: res.detalle_credito?.creditoFiscalNormal || 0,
      remanenteMesAnterior: res.detalle_credito?.remanenteReajustadoClp || 0,
      impuestoDeterminadoIva: res.f29_mapeo.c089_impuesto_determinado_iva,
      nuevoRemanenteCredito: res.f29_mapeo.c077_saldo_a_favor_o_remanente,
      baseImponiblePpm: res.f29_mapeo.c030_monto_base_ppm,
      tasaPpm: tasaPpmManual + tasaPpmVoluntariaManual,
      montoPpm: res.f29_mapeo.c062_ppm_determinado,
      retencionHonorariosSegundaCat: res.f29_mapeo.c151_retencion_honorarios,
      retencionImpuestoUnicoSueldos: res.f29_mapeo.c048_impuesto_unico_segunda_cat,
      totalAPagar: isPostergacionActive ? (res.postergacion_iva?.totalConPostergacion || res.f29_mapeo.c091_total_a_pagar_f29) : res.f29_mapeo.c091_total_a_pagar_f29,
      inconsistenciasDetectadas: res.alertas_fiscales.map(a => a.descripcion)
    };
    onUpdateF29(updatedF29);
  }, [selectedPeriod, tasaPpmManual, tasaPpmVoluntariaManual, isPostergacionActive, dtes, payrolls, company]);

  // Inicializar chat con bienvenida y primera liquidación
  useEffect(() => {
    if (chatMessages.length === 0) {
      const initialSummary = seniorResult.capa_asesora?.resumenEjecutivo || 'Liquidación inicial generada.';
      setChatMessages([
        {
          role: 'agent',
          text: `**Agente Fiscal y Tributario Senior** conectado al entorno de **${company.razonSocial}** (RUT: ${company.rut}).\n\n### Capa Asesora (Resumen Ejecutivo):\n${initialSummary}\n\n**Observaciones críticas detectadas:**\n${seniorResult.alertas_fiscales.map(a => `- **[${a.tipo}]**: ${a.descripcion}`).join('\n')}\n\n*He generado el JSON transaccional de dos capas con los códigos F29 y el asiento contable balanceado.*`,
          jsonPayload: {
            empresa_id: seniorResult.empresa_id,
            periodo_tributario: seniorResult.periodo_tributario,
            estado_liquidacion: seniorResult.estado_liquidacion,
            f29_mapeo: seniorResult.f29_mapeo,
            alertas_fiscales: seniorResult.alertas_fiscales,
            asiento_contable_f29: seniorResult.asiento_contable_f29
          },
          timestamp: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }
  }, []);

  // Enviar consulta al Agente Senior (Backend / Gemini)
  const handleSendQuery = async (queryText: string) => {
    if (!queryText.trim()) return;

    const userMsg = {
      role: 'user' as const,
      text: queryText,
      timestamp: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
    };

    setChatMessages(prev => [...prev, userMsg]);
    setUserQuery('');
    setIsLoadingAi(true);

    try {
      const authToken = getStoredAuthToken();
      // Invocar al Agente Autónomo Especialista Tributario con bucle ReAct
      const response = await fetch('/api/agents/autonomous/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          module: 'TRIBUTARIO_SII',
          modulo: 'TRIBUTARIO_SII',
          empresaId: company.rut,
          query: queryText,
          prompt: queryText,
          context: {
            periodo: selectedPeriod,
            dtes,
            payrolls,
            indicators,
            empresa: company,
            company,
            options: {
              periodo: selectedPeriod,
              simularPostergacionArt64: isPostergacionActive,
            },
          },
          contextData: {
            periodo: selectedPeriod,
            dtes,
            payrolls,
            indicators,
            empresa: company,
            company,
          },
        }),
      });

      const resJson = await response.json();
      if (resJson.success) {
        const aiText = resJson.finalText || resJson.data?.aiResponseText;
        const toolOutput = resJson.steps?.find((s: any) => s.toolCall === 'tool_tax_calculate_f29')?.toolOutput;
        const currentPayload = {
          empresa_id: company.rut,
          periodo_tributario: selectedPeriod,
          estado_liquidacion: 'PRE_DECLARACION',
          f29_mapeo: toolOutput?.f29Mapeo || resJson.data?.f29_mapeo || seniorResult.f29_mapeo,
          alertas_fiscales: toolOutput?.alertasFiscales || seniorResult.alertas_fiscales,
          asiento_contable_f29: toolOutput?.asientoSugerido || resJson.data?.asiento_contable_f29 || seniorResult.asiento_contable_f29,
        };

        let displayText = aiText;
        if (!displayText) {
          const debito = toolOutput?.debitoFiscalIva ?? seniorResult.f29_mapeo.c538_total_debito;
          const credito = toolOutput?.totalCreditoConRemanente ?? seniorResult.f29_mapeo.c537_total_credito;
          const totalPagar = toolOutput?.totalPagarF29 ?? seniorResult.f29_mapeo.c091_total_a_pagar_f29;
          displayText = `### Capa Asesora (Resolución Tributaria Agéntica):\nPara **${company.razonSocial}**, el análisis del período **${selectedPeriod}** indica:\n- **Débito Fiscal (c538)**: ${formatCLP(debito)}\n- **Crédito Fiscal con Remanente (c537)**: ${formatCLP(credito)}\n- **Total F29 a Enterar (c091)**: ${formatCLP(totalPagar)}\n\nNormativa aplicada: DL 825 de IVA (Arts. 23 y 28 proporcionalidad y remanente reajustado en UTM), LIR Art. 84 para PPM y Ley 19.983 para acuse de recibo de 8 días.`;
        }

        setChatMessages(prev => [
          ...prev,
          {
            role: 'agent',
            text: displayText,
            jsonPayload: currentPayload,
            timestamp: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      } else {
        throw new Error(resJson.errorMessage || resJson.error || 'Error en respuesta del agente');
      }
    } catch (err: any) {
      console.warn('Fallback al motor determinístico local:', err);
      // Fallback determinístico con las dos capas estrictas
      const fallbackPayload = {
        empresa_id: company.rut,
        periodo_tributario: selectedPeriod,
        estado_liquidacion: 'PRE_DECLARACION',
        f29_mapeo: seniorResult.f29_mapeo,
        alertas_fiscales: seniorResult.alertas_fiscales,
        asiento_contable_f29: seniorResult.asiento_contable_f29
      };

      setChatMessages(prev => [
        ...prev,
        {
          role: 'agent',
          text: `### Capa Asesora (Motor Local Senior):\nSe ha procesado la consulta sobre la liquidación del período **${selectedPeriod}** para **${company.razonSocial}**:\n\n${seniorResult.capa_asesora?.resumenEjecutivo}\n\n**Advertencias preventivas clave:**\n${seniorResult.alertas_fiscales.map(a => `- ${a.descripcion}`).join('\n')}`,
          jsonPayload: fallbackPayload,
          timestamp: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsLoadingAi(false);
    }
  };

  // Asentar F29 en el Libro Diario
  const handleAddF29AccountingEntry = () => {
    const entry = convertF29AsientoToAccountingEntry(seniorResult, company);
    onAddEntry(entry);
    setShowEntrySuccessModal(entry);
  };

  // Pagar F29 en TGR con cargo bancario automático
  const handlePayF29Tgr = () => {
    if (totalAPagarDisplay <= 0) {
      alert('El Formulario 29 de este período no registra impuesto determinado a pagar.');
      return;
    }
    const payEntry = createF29TgrPaymentEntry(selectedPeriod, totalAPagarDisplay, '1.1.02.001', 'Banco Santander');
    onAddEntry(payEntry);
    setShowEntrySuccessModal(payEntry);
  };

  // Copiar JSON
  const handleCopyJson = (payload: any) => {
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  // Formatear JSON del estado actual
  const currentTransactionJson = {
    empresa_id: seniorResult.empresa_id,
    periodo_tributario: seniorResult.periodo_tributario,
    estado_liquidacion: seniorResult.estado_liquidacion,
    f29_mapeo: seniorResult.f29_mapeo,
    alertas_fiscales: seniorResult.alertas_fiscales,
    asiento_contable_f29: seniorResult.asiento_contable_f29
  };

  const totalAPagarDisplay = isPostergacionActive 
    ? (seniorResult.postergacion_iva?.totalConPostergacion || seniorResult.f29_mapeo.c091_total_a_pagar_f29)
    : seniorResult.f29_mapeo.c091_total_a_pagar_f29;

  return (
    <div className="space-y-6">
      {/* 1. HEADER DEL AGENTE FISCAL Y CONTEXTO EMPRESA ACTIVA */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-slate-900 text-white shadow-xs">
              <Bot className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                  Agente Fiscal y Tributario Senior
                </h1>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  F29 • SII • TGR • Rentas Municipales
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Motor Autónomo Activo
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 font-medium">
                <span className="flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  Empresa activa: <strong className="text-slate-800">{company.razonSocial}</strong> ({company.rut})
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-blue-700 font-semibold">
                  Régimen: {company.regimenTributario === '14D3_PROPYME_GENERAL' ? 'Pro Pyme General 14 D3' : company.regimenTributario === '14D8_PROPYME_TRANSPARENTE' ? 'Pro Pyme Transparente 14 D8' : 'Régimen General 14 A'}
                </span>
                <span className="text-slate-300">•</span>
                <span>
                  Giro: {company.actividadEconomicaCodigo || '620100'} ({company.comuna})
                </span>
              </div>
            </div>
          </div>

          {/* Acciones principales de cabecera */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-700">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Período:</span>
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="bg-transparent text-slate-900 font-bold focus:outline-none cursor-pointer"
              >
                {ultimosPeriodos(18).map((p) => (
                  <option key={p} value={p}>{p} ({etiquetaPeriodo(p)})</option>
                ))}
              </select>
            </div>

            <button
              onClick={() => downloadF29Pdf(f29, company as ClientCompany, indicators)}
              className="flex items-center gap-1.5 bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors shadow-xs cursor-pointer"
              title="Descargar Formulario 29 / Declaración en PDF timbrado oficial"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Descargar F29 (PDF)</span>
            </button>

            <button
              onClick={() => downloadF29Csv(f29)}
              className="flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold px-3 py-2 rounded-lg transition-colors shadow-xs cursor-pointer"
              title="Descargar códigos y montos de casilleros F29 en CSV"
            >
              <span>CSV Códigos</span>
            </button>

            <button
              onClick={handleAddF29AccountingEntry}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors shadow-xs cursor-pointer"
              title="Genera el comprobante de devengo y compensación de IVA y retenciones en Libro Diario"
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>Asentar Liquidación al Libro Diario</span>
            </button>

            {totalAPagarDisplay > 0 && (
              <button
                onClick={handlePayF29Tgr}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors shadow-xs cursor-pointer"
                title="Pagar F29 a Tesorería General (TGR) vía cargo en Banco Santander y registrar egreso"
              >
                <Landmark className="w-3.5 h-3.5" />
                <span>Pagar F29 en TGR (Banco)</span>
              </button>
            )}
          </div>
        </div>

        {/* Parámetros fiscales obligatorios inline */}
        <div className="mt-4 pt-3.5 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tasa PPM Oblig.</span>
            <div className="flex items-center justify-between mt-0.5">
              <span className="font-mono font-bold text-slate-800">{(tasaPpmManual * 100).toFixed(2)}%</span>
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="10"
                value={(tasaPpmManual * 100).toFixed(2)}
                onChange={(e) => setTasaPpmManual((parseFloat(e.target.value) || 0) / 100)}
                className="w-14 text-right bg-white border border-slate-300 rounded px-1 text-[11px] font-mono"
                title="Editar tasa PPM obligatoria"
              />
            </div>
          </div>

          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">PPM Voluntario</span>
            <div className="flex items-center justify-between mt-0.5">
              <span className="font-mono font-bold text-slate-800">{(tasaPpmVoluntariaManual * 100).toFixed(2)}%</span>
              <input
                type="number"
                step="0.1"
                min="0"
                max="10"
                value={(tasaPpmVoluntariaManual * 100).toFixed(2)}
                onChange={(e) => setTasaPpmVoluntariaManual((parseFloat(e.target.value) || 0) / 100)}
                className="w-14 text-right bg-white border border-slate-300 rounded px-1 text-[11px] font-mono"
                title="Tasa PPM voluntaria"
              />
            </div>
          </div>

          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Remanente en UTM</span>
            <span className="font-mono font-bold text-slate-800 mt-0.5 block">
              {(seniorResult.detalle_credito?.remanenteMesAnteriorUtm || 0).toFixed(2)} UTM
            </span>
            <span className="text-[10px] text-slate-400">Reajustado: {formatCLP(seniorResult.detalle_credito?.remanenteReajustadoClp || 0)}</span>
          </div>

          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Retención BHE</span>
            <span className="font-mono font-bold text-slate-800 mt-0.5 block">
              {((indicators.retencionHonorariosTasa || 0.145) * 100).toFixed(2)}%
            </span>
            <span className="text-[10px] text-slate-400">Ley 21.133 Progresiva</span>
          </div>

          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">CPT Base Patente</span>
            <span className="font-mono font-bold text-slate-800 mt-0.5 block">
              {formatCLP(company.capitalPropioTributarioSimplificado || 85400000)}
            </span>
            <span className="text-[10px] text-slate-400">DL 3.063 Art. 24</span>
          </div>

          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Postergación Art. 64</span>
            <button
              onClick={() => setIsPostergacionActive(!isPostergacionActive)}
              className={`mt-0.5 px-2 py-0.5 rounded text-[11px] font-bold transition-colors cursor-pointer w-full text-center ${
                isPostergacionActive 
                  ? 'bg-amber-100 text-amber-800 border border-amber-300' 
                  : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-100'
              }`}
            >
              {isPostergacionActive ? 'Diferido 60 días (Activo)' : 'Pagar al Contado (Día 20)'}
            </button>
          </div>
        </div>
      </div>

      {/* 2. SUB-NAVEGACIÓN DE PESTAÑAS */}
      <div className="flex border-b border-slate-200 bg-white px-4 rounded-xl shadow-xs">
        <button
          onClick={() => setActiveSubTab('panel')}
          className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'panel'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Panel Ejecutivo & Liquidación F29</span>
        </button>

        <button
          onClick={() => setActiveSubTab('terminal')}
          className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'terminal'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Bot className="w-4 h-4 text-blue-500" />
          <span>Terminal Asesora IA (Dos Capas)</span>
          <span className="px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-700 text-[10px]">Dual JSON</span>
        </button>

        <button
          onClick={() => setActiveSubTab('rcv_audit')}
          className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'rcv_audit'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Auditoría RCV & Brechas 8 Días</span>
        </button>

        <button
          onClick={() => setActiveSubTab('patente_f22')}
          className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'patente_f22'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Landmark className="w-4 h-4 text-purple-600" />
          <span>Patente Municipal & Proyección F22</span>
        </button>

        <button
          onClick={() => setActiveSubTab('queue_tracker')}
          className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'queue_tracker'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Clock className="w-4 h-4 text-blue-600" />
          <span>Monitor Asíncrono (Workers & SSE)</span>
          <span className="px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-700 text-[10px]">BullMQ Hook</span>
        </button>
      </div>

      {/* 3. CONTENIDO DE LAS PESTAÑAS */}

      {/* PESTAÑA 1: PANEL EJECUTIVO & LIQUIDACIÓN F29 */}
      {activeSubTab === 'panel' && (
        <div className="space-y-6">
          {/* Tarjetas Métricas Clave */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total F29 a Enterar */}
            <div className="bg-white border-2 border-slate-900 rounded-xl p-4 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                <span>Total a Enterar (Código 091)</span>
                <span className="p-1 rounded bg-slate-100 text-slate-800 font-mono text-[10px]">TGR</span>
              </div>
              <div className="mt-2 text-2xl font-black text-slate-900 font-mono tracking-tight">
                {formatCLP(totalAPagarDisplay)}
              </div>
              <div className="mt-1 text-[11px] text-slate-500 flex items-center justify-between">
                <span>Vencimiento: <strong>{isPostergacionActive ? '20-Nov-2026 (Diferido)' : '20-Sep-2026 (RCV)'}</strong></span>
                {isPostergacionActive && (
                  <span className="text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded text-[10px]">
                    Art. 64 Aplicado
                  </span>
                )}
              </div>
            </div>

            {/* Débito Fiscal IVA */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                <span>Débito Fiscal (Código 538)</span>
                <span className="text-[10px] text-blue-600 font-mono">Ventas DTE</span>
              </div>
              <div className="mt-2 text-2xl font-black text-blue-700 font-mono tracking-tight">
                {formatCLP(seniorResult.f29_mapeo.c538_total_debito)}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                Neto Ventas Afectas: <strong>{formatCLP(seniorResult.f29_mapeo.c030_monto_base_ppm)}</strong>
              </div>
            </div>

            {/* Crédito Fiscal IVA */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                <span>Crédito Fiscal (Código 537)</span>
                <span className="text-[10px] text-emerald-600 font-mono">Compras + Rem.</span>
              </div>
              <div className="mt-2 text-2xl font-black text-emerald-700 font-mono tracking-tight">
                {formatCLP(seniorResult.f29_mapeo.c537_total_credito)}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                {seniorResult.f29_mapeo.c089_impuesto_determinado_iva > 0 
                  ? `IVA a pagar (c089): ${formatCLP(seniorResult.f29_mapeo.c089_impuesto_determinado_iva)}`
                  : `Remanente a favor (c077): ${formatCLP(seniorResult.f29_mapeo.c077_saldo_a_favor_o_remanente)}`}
              </div>
            </div>

            {/* PPM & Retenciones */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                <span>PPM + Retenciones 2da Cat</span>
                <span className="text-[10px] text-purple-600 font-mono">LIR & DT</span>
              </div>
              <div className="mt-2 text-2xl font-black text-purple-700 font-mono tracking-tight">
                {formatCLP(seniorResult.f29_mapeo.c062_ppm_determinado + seniorResult.f29_mapeo.c151_retencion_honorarios + seniorResult.f29_mapeo.c048_impuesto_unico_segunda_cat)}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                PPM: {formatCLP(seniorResult.f29_mapeo.c062_ppm_determinado)} • BHE: {formatCLP(seniorResult.f29_mapeo.c151_retencion_honorarios)} • Sueldos: {formatCLP(seniorResult.f29_mapeo.c048_impuesto_unico_segunda_cat)}
              </div>
            </div>
          </div>

          {/* Banner de Postergación Art. 64 si aplica */}
          {company.regimenTributario === '14D3_PROPYME_GENERAL' && seniorResult.f29_mapeo.c089_impuesto_determinado_iva > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-extrabold text-amber-900">
                    Oportunidad de Flujo: Postergación de IVA Débito (Art. 64 Ley de IVA)
                  </h4>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Como empresa Pro Pyme, puedes diferir el pago del IVA Determinado de{' '}
                    <strong>{formatCLP(seniorResult.f29_mapeo.c089_impuesto_determinado_iva)}</strong> a 60 días
                    (vencimiento 20 de Noviembre de 2026), pagando este mes únicamente{' '}
                    <strong>{formatCLP(seniorResult.postergacion_iva?.totalConPostergacion || 0)}</strong>.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsPostergacionActive(!isPostergacionActive)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                  isPostergacionActive
                    ? 'bg-amber-600 text-white hover:bg-amber-700'
                    : 'bg-white text-amber-800 border border-amber-300 hover:bg-amber-100'
                }`}
              >
                {isPostergacionActive ? 'Postergación Activada ✓' : 'Activar Postergación 60 Días'}
              </button>
            </div>
          )}

          {/* Grilla: Casillero Oficial F29 y Asiento Contable */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Casillero Oficial F29 */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                  <span>Casillero Oficial de Códigos SII - Formulario 29</span>
                </h3>
                <span className="text-xs font-mono text-slate-500">{selectedPeriod}</span>
              </div>

              <div className="mt-4 space-y-2 text-xs">
                {/* Débitos */}
                <div className="p-2.5 rounded-lg bg-blue-50/50 border border-blue-100 space-y-1.5">
                  <span className="text-[11px] font-bold text-blue-900 uppercase">I. Débito Fiscal (Ventas)</span>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">[c503/511] Facturas Afectas Emitidas</span>
                    <span className="font-mono font-bold text-slate-800">{formatCLP(seniorResult.detalle_debito?.debitoFacturasIva || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-500">
                    <span>[c509] Notas de Crédito Deducidas</span>
                    <span className="font-mono text-slate-700">-{formatCLP(seniorResult.detalle_debito?.notasCreditoDeduccionDebito || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-blue-200 text-blue-900 font-bold">
                    <span>[c538] TOTAL DÉBITO FISCAL</span>
                    <span className="font-mono text-sm">{formatCLP(seniorResult.f29_mapeo.c538_total_debito)}</span>
                  </div>
                </div>

                {/* Créditos */}
                <div className="p-2.5 rounded-lg bg-emerald-50/50 border border-emerald-100 space-y-1.5">
                  <span className="text-[11px] font-bold text-emerald-900 uppercase">II. Crédito Fiscal (Compras y Remanente)</span>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">[c511/518] Facturas de Compra Afectas</span>
                    <span className="font-mono font-bold text-slate-800">{formatCLP(seniorResult.detalle_credito?.creditoFiscalNormal || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-500">
                    <span>[c524] Activo Fijo Adquirido</span>
                    <span className="font-mono text-slate-700">{formatCLP(seniorResult.detalle_credito?.comprasActivoFijoIva || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-500">
                    <span>[c504] Remanente Mes Anterior Reajustado UTM</span>
                    <span className="font-mono text-slate-700">{formatCLP(seniorResult.detalle_credito?.remanenteReajustadoClp || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-emerald-200 text-emerald-900 font-bold">
                    <span>[c537] TOTAL CRÉDITO FISCAL</span>
                    <span className="font-mono text-sm">{formatCLP(seniorResult.f29_mapeo.c537_total_credito)}</span>
                  </div>
                </div>

                {/* Resultado IVA */}
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex justify-between items-center font-bold">
                  {seniorResult.f29_mapeo.c089_impuesto_determinado_iva > 0 ? (
                    <>
                      <span className="text-slate-800">[c089] IMPUESTO DETERMINADO IVA</span>
                      <span className="font-mono text-slate-900 text-sm">{formatCLP(seniorResult.f29_mapeo.c089_impuesto_determinado_iva)}</span>
                    </>
                  ) : (
                    <>
                      <span className="text-emerald-800">[c077] SALDO A FAVOR / REMANENTE MES SIGUIENTE</span>
                      <span className="font-mono text-emerald-700 text-sm">{formatCLP(seniorResult.f29_mapeo.c077_saldo_a_favor_o_remanente)}</span>
                    </>
                  )}
                </div>

                {/* Retenciones y PPM */}
                <div className="p-2.5 rounded-lg bg-purple-50/50 border border-purple-100 space-y-1.5">
                  <span className="text-[11px] font-bold text-purple-900 uppercase">III. Retenciones y Pagos Provisorios</span>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">[c151] Retención Boletas Honorarios (14.5%)</span>
                    <span className="font-mono font-bold text-slate-800">{formatCLP(seniorResult.f29_mapeo.c151_retencion_honorarios)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">[c048] Impuesto Único 2da Cat (Nómina)</span>
                    <span className="font-mono font-bold text-slate-800">{formatCLP(seniorResult.f29_mapeo.c048_impuesto_unico_segunda_cat)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">[c030] Base PPM ({formatCLP(seniorResult.f29_mapeo.c030_monto_base_ppm)}) × Tasa</span>
                    <span className="font-mono font-bold text-slate-800">
                      [c062] {formatCLP(seniorResult.f29_mapeo.c062_ppm_determinado)}
                    </span>
                  </div>
                </div>

                {/* Total Final */}
                <div className="p-3 rounded-lg bg-slate-900 text-white space-y-2">
                  <div className="flex justify-between items-center font-bold">
                    <span className="text-sm">[c091] TOTAL A PAGAR EN ARCAS FISCALES</span>
                    <span className="font-mono text-base text-emerald-400">{formatCLP(totalAPagarDisplay)}</span>
                  </div>
                  {totalAPagarDisplay > 0 && (
                    <button
                      onClick={handlePayF29Tgr}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded px-3 py-2 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-sm"
                    >
                      <Landmark className="w-3.5 h-3.5" />
                      <span>Ejecutar Pago Electrónico TGR vía Banco Santander</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Asiento Contable Normalizado del F29 (Libro Diario Canónico) */}
            <div className="flex flex-col">
              <JournalEntryView
                entry={{
                  empresaId: company.rut,
                  periodo: selectedPeriod,
                  fecha: `${selectedPeriod}-20`,
                  glosaGeneral: `Liquidación F29 período ${selectedPeriod} - ${company.razonSocial}`,
                  documentoRef: `F29-SII-${selectedPeriod}`,
                  origenModulo: 'F29_CENTRALIZACION',
                  creadoPorAgente: 'ENGINE_F29_SENIOR',
                  lineas: seniorResult.asiento_contable_f29.map((item) => {
                    let codigoCuenta = '2.1.06';
                    if (item.cuenta.includes('IVA Débito')) codigoCuenta = '2.1.03';
                    else if (item.cuenta.includes('IVA Crédito')) codigoCuenta = '1.1.05';
                    else if (item.cuenta.includes('Remanente')) codigoCuenta = '1.1.06';
                    else if (item.cuenta.includes('Honorarios')) codigoCuenta = '2.1.04';
                    else if (item.cuenta.includes('Impuesto Único')) codigoCuenta = '2.1.05';
                    else if (item.cuenta.includes('PPM')) codigoCuenta = '1.1.07';
                    else if (item.cuenta.includes('Impuestos por Pagar') || item.cuenta.includes('TGR')) codigoCuenta = '2.1.06';
                    else if (item.cuenta.includes('Orden')) codigoCuenta = '9.9.99.01';

                    return {
                      codigoCuenta,
                      nombreCuenta: item.cuenta,
                      debe: item.debe,
                      haber: item.haber,
                    };
                  }),
                }}
                onApprove={handleAddF29AccountingEntry}
                showExportButton={true}
              />
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑA 2: TERMINAL ASESORA IA (DOS CAPAS) */}
      {activeSubTab === 'terminal' && (
        <div className="space-y-6">
          <div className="bg-slate-900 text-white rounded-xl p-5 shadow-lg border border-slate-800">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-white">Terminal del Agente Fiscal y Tributario Senior</h3>
                  <p className="text-xs text-slate-400">Respuesta estricta en Dos Capas: 1. Capa Asesora (Ejecutiva) + 2. Capa Transaccional (JSON Oficial)</p>
                </div>
              </div>

              <button
                onClick={() => handleCopyJson(currentTransactionJson)}
                className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                {copiedJson ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>Copiar JSON Transaccional</span>
              </button>
            </div>

            {/* Acciones Rápidas */}
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <button
                onClick={() => handleSendQuery('Liquida el Formulario 29 del período actual y analiza si conviene postergar el IVA a 60 días según el Art. 64.')}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1.5 rounded-lg border border-slate-700 transition-colors cursor-pointer"
              >
                ⚡ Liquidar F29 y evaluar Postergación Art. 64
              </button>
              <button
                onClick={() => handleSendQuery('Explica el aumento de la tasa de retención de Boletas de Honorarios al 14.5% y su conciliación con BHE.')}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1.5 rounded-lg border border-slate-700 transition-colors cursor-pointer"
              >
                ⚡ Retención Honorarios Ley 21.133
              </button>
              <button
                onClick={() => handleSendQuery('Audita las facturas de proveedores pendientes de acuse de recibo dentro del plazo de 8 días de la Ley 19.983.')}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1.5 rounded-lg border border-slate-700 transition-colors cursor-pointer"
              >
                ⚡ Auditar Acuse de Recibo (8 Días)
              </button>
              <button
                onClick={() => handleSendQuery('Proyecta la base de Patente Municipal según el CPT Simplificado y el Impuesto de Primera Categoría F22.')}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1.5 rounded-lg border border-slate-700 transition-colors cursor-pointer"
              >
                ⚡ Patente Municipal & F22
              </button>
            </div>

            {/* Historial de Mensajes */}
            <div className="mt-5 space-y-4 max-h-[520px] overflow-y-auto pr-2">
              {chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-xl text-xs ${
                    msg.role === 'user'
                      ? 'bg-blue-950/70 border border-blue-800 ml-8 text-blue-100'
                      : 'bg-slate-800/90 border border-slate-700 mr-8 text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2 pb-1 border-b border-slate-700/50">
                    <span className="font-bold flex items-center gap-1.5">
                      {msg.role === 'user' ? 'Tú (Auditor / Usuario)' : 'Agente Fiscal y Tributario Senior'}
                    </span>
                    <span className="text-[10px] text-slate-400">{msg.timestamp}</span>
                  </div>

                  {/* Texto Asesor */}
                  <div className="whitespace-pre-line leading-relaxed space-y-2">
                    {msg.text}
                  </div>

                  {/* Capa Transaccional (JSON) si está presente */}
                  {msg.jsonPayload && (
                    <div className="mt-4 pt-3 border-t border-slate-700">
                      <div className="flex items-center justify-between text-[11px] font-bold text-amber-400 mb-1.5">
                        <span>Capa Transaccional (JSON Estricto para API y Base de Datos):</span>
                        <button
                          onClick={() => handleCopyJson(msg.jsonPayload)}
                          className="text-slate-300 hover:text-white flex items-center gap-1"
                        >
                          <Copy className="w-3 h-3" />
                          <span>Copiar</span>
                        </button>
                      </div>
                      <pre className="bg-slate-950 p-3 rounded-lg text-[11px] font-mono text-emerald-400 overflow-x-auto border border-slate-900">
                        {JSON.stringify(msg.jsonPayload, null, 2)}
                      </pre>
                      <div className="mt-2.5 flex justify-end">
                        <button
                          onClick={handleAddF29AccountingEntry}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          <FileCode className="w-3.5 h-3.5" />
                          <span>Asentar este JSON en Contabilidad</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {isLoadingAi && (
                <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300 text-xs flex items-center gap-3">
                  <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />
                  <span>El Agente Fiscal Senior está auditando el RCV, liquidando F29 y generando las dos capas...</span>
                </div>
              )}
            </div>

            {/* Input del Chat */}
            <div className="mt-4 flex items-center gap-2">
              <input
                type="text"
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendQuery(userQuery)}
                placeholder="Escribe una instrucción fiscal (ej: Liquida el F29 y evalúa postergar IVA)..."
                className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={() => handleSendQuery(userQuery)}
                disabled={isLoadingAi || !userQuery.trim()}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white p-2.5 rounded-lg transition-colors cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑA 3: AUDITORÍA RCV & BRECHAS 8 DÍAS */}
      {activeSubTab === 'rcv_audit' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Fiscalización Preventiva de Facturas de Compra (Ley 19.983)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Monitoreo del plazo de 8 días corridos desde la recepción electrónica en el SII para dar acuse de recibo o reclamar.
                </p>
              </div>
              <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-2 py-1 rounded">
                DTEs de Compra: {safeDtes.filter(d => d.tipoOperacion === 'COMPRA').length}
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {seniorResult.alertas_fiscales.map((alerta, idx) => (
                <div
                  key={idx}
                  className={`p-3.5 rounded-lg border text-xs flex items-start gap-3 ${
                    alerta.tipo === 'ERROR'
                      ? 'bg-rose-50 border-rose-200 text-rose-800'
                      : alerta.tipo === 'ADVERTENCIA'
                      ? 'bg-amber-50 border-amber-200 text-amber-800'
                      : 'bg-blue-50 border-blue-200 text-blue-800'
                  }`}
                >
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="font-bold flex items-center gap-2">
                      <span>[{alerta.tipo}]</span>
                      {alerta.codigoRelacionado && (
                        <span className="text-[10px] font-mono bg-white px-1.5 py-0.5 rounded border border-current">
                          Casilla {alerta.codigoRelacionado}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 leading-relaxed">{alerta.descripcion}</p>
                    {alerta.accionSugerida && (
                      <p className="mt-1 font-semibold text-[11px] underline">
                        Acción sugerida: {alerta.accionSugerida}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Tabla de Facturas Recibidas */}
            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 text-[10px] uppercase font-bold">
                    <th className="py-2">Folio / Tipo</th>
                    <th className="py-2">Proveedor</th>
                    <th className="py-2">Fecha Recepción</th>
                    <th className="py-2">Monto Neto</th>
                    <th className="py-2">IVA Crédito</th>
                    <th className="py-2">Plazo 8 Días</th>
                    <th className="py-2">Estado SII</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {safeDtes
                    .filter(d => d.tipoOperacion === 'COMPRA')
                    .map((d) => (
                      <tr key={d.id} className="hover:bg-slate-50">
                        <td className="py-2 font-mono font-bold text-slate-800">
                          {d.tipoDte} N° {d.folio}
                        </td>
                        <td className="py-2">
                          <div className="font-medium text-slate-800">{d.razonSocialContraparte}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{d.rutContraparte}</div>
                        </td>
                        <td className="py-2 text-slate-600 font-mono">{d.fechaRecepcion || d.fechaEmision}</td>
                        <td className="py-2 font-mono font-medium text-slate-800">{formatCLP(d.montoNeto)}</td>
                        <td className="py-2 font-mono font-bold text-emerald-700">{formatCLP(d.montoIva)}</td>
                        <td className="py-2">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                            Aceptada Tácita
                          </span>
                        </td>
                        <td className="py-2">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                            {d.estadoSii}
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

      {/* PESTAÑA 4: PATENTE MUNICIPAL & PROYECCIÓN F22 */}
      {activeSubTab === 'patente_f22' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Patente Municipal DL 3.063 */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-purple-600" />
                  <span>Patente Municipal (Ley de Rentas Municipales DL 3.063)</span>
                </h3>
                <span className="text-xs font-mono font-bold text-purple-700">Art. 24</span>
              </div>

              <div className="mt-4 space-y-3 text-xs">
                <p className="text-slate-600 leading-relaxed">
                  La Patente Municipal se calcula anualmente sobre el <strong>Capital Propio Tributario (CPT)</strong> determinado al 31 de diciembre del año anterior, gravado con una tasa entre 2.5 y 5 por mil por la Municipalidad correspondiente.
                </p>

                <div className="p-3 bg-purple-50 rounded-lg border border-purple-100 space-y-2 font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-600 font-sans">Comuna Casa Matriz:</span>
                    <strong className="text-purple-950 font-sans">{company.comuna}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600 font-sans">CPT Simplificado Declarado:</span>
                    <strong className="text-slate-900">{formatCLP(seniorResult.patente_municipal_y_renta?.cptSimplificadoBase || 85400000)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600 font-sans">Tasa por Mil Municipal:</span>
                    <strong className="text-slate-900">{seniorResult.patente_municipal_y_renta?.patenteTasaPorMil || 5.0} ‰ anual</strong>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-purple-200 text-purple-900 font-bold text-sm font-sans">
                    <span>Cuota Semestral Estimada:</span>
                    <span className="font-mono">{formatCLP(seniorResult.patente_municipal_y_renta?.patenteSemestralEstimada || 213500)}</span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 italic">
                  * Pago semestral en Julio y Enero ante el Departamento de Rentas de la Municipalidad de {company.comuna}.
                </div>
              </div>
            </div>

            {/* Proyección Renta Anual F22 */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <Scale className="w-4 h-4 text-blue-600" />
                  <span>Proyección de Renta Líquida & IDPC (F22)</span>
                </h3>
                <span className="text-xs font-mono font-bold text-blue-700">Art. 14 D3 / 14 A</span>
              </div>

              <div className="mt-4 space-y-3 text-xs">
                <p className="text-slate-600 leading-relaxed">
                  Monitoreo preventivo del balance de ingresos percibidos y gastos pagados para proyectar el <strong>Impuesto de Primera Categoría (IDPC)</strong> y verificar si los PPM acumulados en el año cubrirán la carga fiscal en el F22.
                </p>

                <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 space-y-2 font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-600 font-sans">Régimen Tributario:</span>
                    <strong className="text-blue-950 font-sans">
                      {company.regimenTributario === '14D3_PROPYME_GENERAL' ? 'Pro Pyme General 14 D3 (Tasa 12.5%)' : 'Régimen General 14 A (Tasa 27%)'}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600 font-sans">Base RLI Proyectada:</span>
                    <strong className="text-slate-900">{formatCLP(seniorResult.patente_municipal_y_renta?.rliProyectada || 42000000)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600 font-sans">IDPC Proyectado Bruto:</span>
                    <strong className="text-slate-900">{formatCLP(seniorResult.patente_municipal_y_renta?.idpcEstimado || 5250000)}</strong>
                  </div>
                  <div className="flex justify-between text-emerald-700">
                    <span className="font-sans">Crédito PPM Mensual Acumulado:</span>
                    <strong>-{formatCLP(seniorResult.f29_mapeo.c062_ppm_determinado * 8)}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑA 5: MONITOR ASÍNCRONO DE COLA (BULLMQ + SSE + POLLING HOOK) */}
      {activeSubTab === 'queue_tracker' && (
        <div className="space-y-6">
          <F29SettlementTrackerExample company={company} periodo={selectedPeriod} />
        </div>
      )}

      {/* Modal de confirmación de Asiento Contable generado con Formato Canónico Estándar */}
      {showEntrySuccessModal && (
        <StandardJournalEntryModal
          isOpen={!!showEntrySuccessModal}
          onClose={() => setShowEntrySuccessModal(null)}
          title="Asiento F29 Registrado con Éxito en el Libro Diario"
          subtitle={`Folio N° ${showEntrySuccessModal.id} • Período ${selectedPeriod}`}
          entry={{
            id: showEntrySuccessModal.id,
            empresaId: company.rut,
            periodo: selectedPeriod,
            fecha: showEntrySuccessModal.fecha,
            glosaGeneral: showEntrySuccessModal.concepto,
            documentoRef: showEntrySuccessModal.documento,
            origenModulo: 'F29_CENTRALIZACION',
            lineas: showEntrySuccessModal.lineas.map((l) => ({
              codigoCuenta: l.cuentaCodigo,
              nombreCuenta: l.cuentaNombre,
              debe: l.debe,
              haber: l.haber,
              rutAuxiliar: l.rutAuxiliar,
              centroCosto: l.centroCosto,
            })),
            totalDebe: showEntrySuccessModal.totalDebe,
            totalHaber: showEntrySuccessModal.totalHaber,
            supervisorSignature: showEntrySuccessModal.supervisorSignature,
          }}
        />
      )}
    </div>
  );
};
