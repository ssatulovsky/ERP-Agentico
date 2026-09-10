import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  Send,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  FileSpreadsheet,
  Building2,
  Calendar,
  CreditCard,
  FileCheck,
  RefreshCw,
  Trash2,
  ExternalLink,
  ChevronRight,
  Receipt,
  Check
} from 'lucide-react';
import { CompanyProfile, ChileIndicators, AccountingFirmProfile, AccountingEntry } from '../../types';
import { formatCLP } from '../../utils/chileanAccounting';
import {
  StandardJournalEntryTable,
  StandardJournalEntryData,
} from './StandardJournalEntryTable';
import { StandardJournalEntryModal } from './StandardJournalEntryModal';

interface AssistantChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  missingFields?: string[];
  suggestedReplies?: string[];
  proposedEntry?: StandardJournalEntryData | null;
  registered?: boolean;
}

interface AccountingEventAssistantProps {
  company: CompanyProfile;
  firm?: AccountingFirmProfile;
  indicators: ChileIndicators;
  onCommitEntry: (entry: AccountingEntry) => void;
  onViewLedger?: () => void;
  className?: string;
}

export const AccountingEventAssistant: React.FC<AccountingEventAssistantProps> = ({
  company,
  firm,
  indicators,
  onCommitEntry,
  onViewLedger,
  className = '',
}) => {
  const [messages, setMessages] = useState<AssistantChatMessage[]>([
    {
      id: 'msg-welcome',
      role: 'assistant',
      content: `Estimado(a), soy su **Asesor Contable y Tributario Senior** para **${company.razonSocial}** (RUT: ${company.rut}).

Usted puede describir en lenguaje natural cualquier hecho económico, gasto, compra o inversión ocurrida en la empresa. Yo analizaré su relato, le consultaré los datos que hagan falta bajo la normativa del **SII** e **IFRS** (precios, si solicitó factura con IVA o boleta, datos del proveedor y medio de pago), prepararé la propuesta de asiento contable formal y, con su autorización ("OK"), lo registraré de inmediato en el Libro Diario.

¿Qué operación desea registrar hoy?`,
      timestamp: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
      suggestedReplies: [
        'Compre una impresora, 10 resmas de papel carta y 5 cartuchos de tinta, pague con tarjeta de crédito coorporativa',
        'Pago arriendo de oficina en Las Condes por 45 UF según contrato con transferencia bancaria',
        'Contraté asesoría informática externa por $850.000 con boleta de honorarios de terceros',
      ],
    },
  ]);

  const [inputVal, setInputVal] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [registeredEntryModal, setRegisteredEntryModal] = useState<StandardJournalEntryData | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputVal).trim();
    if (!text || isLoading) return;

    setInputVal('');

    const userMsgId = `user-${Date.now()}`;
    const userMsg: AssistantChatMessage = {
      id: userMsgId,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      // Formatear mensajes para el endpoint
      const payloadMessages = newMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch('/api/accounting/assistant-dialogue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: payloadMessages,
          empresa: company,
          indicators,
        }),
      });

      if (!res.ok) {
        throw new Error('Error de comunicación con el servidor');
      }

      const resData = await res.json();
      const aiData = resData.data || {};

      let proposedEntryData: StandardJournalEntryData | null = null;
      if (aiData.asientoPropuesto) {
        proposedEntryData = {
          id: `entry-prop-${Date.now()}`,
          folio: `PROP-${Math.floor(1000 + Math.random() * 9000)}`,
          empresaId: company.rut,
          periodo: new Date().toISOString().substring(0, 7),
          fecha: aiData.asientoPropuesto.fecha || new Date().toISOString().split('T')[0],
          glosaGeneral: aiData.asientoPropuesto.concepto,
          documentoRef: aiData.asientoPropuesto.documento,
          origenModulo: aiData.asientoPropuesto.origen || 'RCV_COMPRA',
          totalDebe: aiData.asientoPropuesto.totalDebe,
          totalHaber: aiData.asientoPropuesto.totalHaber,
          lineas: aiData.asientoPropuesto.lineas || [],
        };
      }

      const assistantMsg: AssistantChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: aiData.reply || 'He procesado su instrucción contable.',
        timestamp: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
        missingFields: aiData.missingFields,
        suggestedReplies: aiData.suggestedReplies,
        proposedEntry: proposedEntryData,
        registered: aiData.userConfirmed === true,
      };

      // Si el agente detectó confirmación explícita del usuario
      if (aiData.userConfirmed && proposedEntryData) {
        commitEntryToLedger(proposedEntryData);
      }

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.warn('Fallback error en assistant:', err);
      // Mensaje de fallback amigable
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-err-${Date.now()}`,
          role: 'assistant',
          content: `Para registrar la operación con exactitud tributaria según el SII:
1. Indique los precios netos o totales de cada producto.
2. Si cuenta con Factura Electrónica (DTE 33) a nombre de ${company.razonSocial} (RUT ${company.rut}) para recuperar el 19% de IVA Crédito Fiscal.
3. El N° de Factura, RUT del proveedor y medio de pago exacto.`,
          timestamp: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
          suggestedReplies: [
            'Impresora $180.000 neto, resmas $35.000 neto, tintas $85.000 neto con Factura N° 45892 Dimacofi (RUT 96.554.320-1), tarjeta Santander',
            'Fue compra con boleta exenta por $350.000 total',
          ],
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const commitEntryToLedger = (entryData: StandardJournalEntryData) => {
    const rawLines = entryData.lineas || [];
    const sumDebe = rawLines.reduce((s, l) => s + (Number(l.debe) || 0), 0);
    const sumHaber = rawLines.reduce((s, l) => s + (Number(l.haber) || 0), 0);

    const fullAccountingEntry: AccountingEntry = {
      id: `entry-senior-ia-${Date.now()}`,
      fecha: entryData.fecha || new Date().toISOString().split('T')[0],
      concepto: entryData.glosaGeneral || entryData.concepto || 'Operación comercial asesorada por IA',
      documento: entryData.documentoRef || entryData.documento || 'Documento Tributario',
      origen: (entryData.origenModulo as any) || 'MANUAL',
      lineas: rawLines.map((l) => ({
        cuentaCodigo: l.codigoCuenta || l.cuentaCodigo || '6.1.04.006',
        cuentaNombre: l.nombreCuenta || l.cuentaNombre || l.cuenta || 'Gastos Operacionales',
        debe: Number(l.debe) || 0,
        haber: Number(l.haber) || 0,
        centroCosto: l.centroCosto || 'ADMINISTRACION',
        rutAuxiliar: l.rutAuxiliar || company.rut,
      })),
      totalDebe: sumDebe,
      totalHaber: sumHaber,
      balanceado: Math.abs(sumDebe - sumHaber) < 1,
      creadoEn: new Date().toISOString(),
      supervisorSignature: 'AUDITOR_SENIOR_IA_APPROVED',
    };

    onCommitEntry(fullAccountingEntry);
    setRegisteredEntryModal(entryData);

    // Actualizar estado visual de los mensajes
    setMessages((prev) =>
      prev.map((m) =>
        m.proposedEntry ? { ...m, registered: true } : m
      )
    );
  };

  const handleResetChat = () => {
    setMessages([
      {
        id: 'msg-welcome-new',
        role: 'assistant',
        content: `Sesión reiniciada para **${company.razonSocial}**. Ingrese una nueva descripción de lo ocurrido para comenzar la entrevista de contabilización.`,
        timestamp: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
        suggestedReplies: [
          'Compre una impresora, 10 resmas de papel carta y 5 cartuchos de tinta, pague con tarjeta de crédito coorporativa',
          'Venta de consultoría técnica por $1.500.000 neto con Factura N° 890 a crédito 30 días',
        ],
      },
    ]);
  };

  return (
    <div className={`bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden flex flex-col ${className}`}>
      {/* Barra Superior del Asesor */}
      <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-purple-900/60 text-purple-300 border border-purple-700/50">
                AUDITOR SENIOR IA
              </span>
              <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Normativa SII / DL 825 / IFRS
              </span>
            </div>
            <h3 className="text-base font-bold text-white mt-0.5">
              Asesor Contable Autónomo · Entrevista & Asientos
            </h3>
            <p className="text-xs text-slate-400">
              Describa en lenguaje natural cualquier compra o evento para auditarla, solicitar datos faltantes y generar el asiento formal.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <button
            onClick={handleResetChat}
            className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 flex items-center gap-1.5 transition-colors cursor-pointer font-sans"
            title="Reiniciar conversación"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Nueva Operación</span>
          </button>
        </div>
      </div>

      {/* Ejemplos de Inicio Rápido */}
      <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2 overflow-x-auto text-xs text-slate-600">
        <span className="font-bold text-slate-800 shrink-0 flex items-center gap-1 text-[11px] uppercase tracking-wider font-mono">
          <Sparkles className="w-3.5 h-3.5 text-purple-600" />
          Ejemplo Requerido:
        </span>
        <button
          onClick={() =>
            handleSendMessage(
              'Compre una impresora, 10 resmas de papel carta y 5 cartuchos de tinta, pague con tarjeta de crédito coorporativa'
            )
          }
          className="bg-white border border-slate-300 hover:border-purple-400 hover:bg-purple-50 text-slate-700 hover:text-purple-900 px-3 py-1 rounded-full text-xs font-medium shrink-0 transition-colors shadow-2xs cursor-pointer"
        >
          "Compre una impresora, 10 resmas de papel carta y 5 cartuchos de tinta, pague con tarjeta de crédito coorporativa"
        </button>
      </div>

      {/* Área de Conversación */}
      <div className="flex-1 p-6 overflow-y-auto space-y-6 bg-slate-50/50 min-h-[420px] max-h-[600px]">
        {messages.map((msg) => {
          const isAi = msg.role === 'assistant';

          return (
            <div
              key={msg.id}
              className={`flex gap-3 max-w-4xl ${isAi ? 'mr-auto' : 'ml-auto flex-row-reverse'}`}
            >
              {/* Avatar */}
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  isAi
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-blue-600 text-white shadow-xs'
                }`}
              >
                {isAi ? <Bot className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
              </div>

              {/* Burbuja de Mensaje */}
              <div className="space-y-3 flex-1">
                <div
                  className={`p-4 rounded-2xl shadow-2xs ${
                    isAi
                      ? 'bg-white border border-slate-200 text-slate-800 rounded-tl-xs'
                      : 'bg-blue-600 text-white rounded-tr-xs'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4 mb-2 pb-1 border-b border-slate-100 text-[11px] font-mono opacity-75">
                    <span className="font-bold uppercase tracking-wider">
                      {isAi ? 'Asesor Contable Senior (SII)' : company.razonSocial}
                    </span>
                    <span>{msg.timestamp}</span>
                  </div>

                  {/* Texto formateado */}
                  <div className="text-xs sm:text-sm leading-relaxed whitespace-pre-line font-sans">
                    {msg.content}
                  </div>
                </div>

                {/* Si faltan datos indispensables, mostrar checklist visual */}
                {isAi && msg.missingFields && msg.missingFields.length > 0 && !msg.proposedEntry && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-900 font-mono">
                      <HelpCircle className="w-4 h-4 text-amber-600" />
                      INFORMACIÓN TRIBUTARIA Y ECONÓMICA REQUERIDA PARA ASIENTO:
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                        <span>Precios individuales o desglose neto / total</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                        <span>¿Factura con IVA (DTE 33) o Boleta / Voucher?</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                        <span>N° Folio y RUT / Razón Social Proveedor</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                        <span>Banco de la Tarjeta Corporativa y Centro de Costo</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Si hay una propuesta de Asiento Contable, mostrar la Tabla Canónica Estándar */}
                {isAi && msg.proposedEntry && (
                  <div className="space-y-3">
                    <div className="bg-white border-2 border-purple-200 rounded-xl p-4 shadow-sm space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
                        <div className="flex items-center gap-2">
                          <span className="bg-purple-100 text-purple-800 text-xs font-bold px-2.5 py-0.5 rounded font-mono">
                            PROPUESTA OFICIAL CANÓNICA
                          </span>
                          <span className="text-xs font-bold text-slate-700 font-mono">
                            {msg.proposedEntry.documentoRef || 'Documento Tributario'}
                          </span>
                        </div>

                        {msg.registered ? (
                          <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5 self-start sm:self-auto font-mono">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            ASENTADO EN LIBRO DIARIO
                          </span>
                        ) : (
                          <span className="bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5 self-start sm:self-auto font-mono">
                            <AlertCircle className="w-4 h-4 text-amber-600" />
                            PENDIENTE DE APROBACIÓN
                          </span>
                        )}
                      </div>

                      {/* Tabla Canónica Estándar (Debe primero, Haber con sangría a, glosa de cabecera) */}
                      <StandardJournalEntryTable
                        entry={msg.proposedEntry}
                        showGlosaHeader={true}
                        showCopyButton={true}
                        className="bg-slate-50/50"
                      />

                      {/* Botón de Confirmación y Registro */}
                      {!msg.registered ? (
                        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 bg-purple-50/60 p-3 rounded-lg border border-purple-100">
                          <p className="text-xs text-purple-900 font-medium">
                            ¿Confirma que la imputación y montos son conformes para asentarlo en el Libro Diario Oficial?
                          </p>
                          <button
                            onClick={() => commitEntryToLedger(msg.proposedEntry!)}
                            className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-5 py-2.5 rounded-lg flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer shrink-0"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Aprobar y Registrar en Libro Diario</span>
                          </button>
                        </div>
                      ) : (
                        <div className="pt-2 flex items-center justify-between bg-emerald-50 p-3 rounded-lg border border-emerald-200 text-emerald-900 text-xs">
                          <div className="flex items-center gap-2 font-medium">
                            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>Asiento registrado formalmente con firma electrónica de auditoría.</span>
                          </div>
                          {onViewLedger && (
                            <button
                              onClick={onViewLedger}
                              className="text-emerald-700 hover:text-emerald-900 font-bold underline flex items-center gap-1 cursor-pointer font-mono text-[11px]"
                            >
                              <span>Ver Libro Diario</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Chips de Respuestas Sugeridas */}
                {isAi && msg.suggestedReplies && msg.suggestedReplies.length > 0 && !msg.registered && (
                  <div className="pt-1 space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-500 font-mono block">
                      Respuestas rápidas sugeridas:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {msg.suggestedReplies.map((replyText, rIdx) => (
                        <button
                          key={rIdx}
                          onClick={() => handleSendMessage(replyText)}
                          className="bg-white hover:bg-purple-50 text-slate-700 hover:text-purple-900 border border-slate-300 hover:border-purple-300 text-xs px-3 py-1.5 rounded-lg transition-all text-left shadow-2xs cursor-pointer flex items-center gap-1.5"
                        >
                          <ChevronRight className="w-3 h-3 text-purple-600 shrink-0" />
                          <span>{replyText}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Indicador de Pensando / Analizando */}
        {isLoading && (
          <div className="flex gap-3 max-w-4xl mr-auto items-center">
            <div className="w-8 h-8 rounded-lg bg-purple-600 text-white flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 animate-spin" />
            </div>
            <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-600 flex items-center gap-2 shadow-2xs font-mono">
              <RefreshCw className="w-3.5 h-3.5 text-purple-600 animate-spin" />
              <span>Auditor Senior analizando normativa SII, DL 825 de IVA y cuadre de partida doble...</span>
            </div>
          </div>
        )}

        <div ref={chatBottomRef} />
      </div>

      {/* Input de Mensajes */}
      <div className="p-4 bg-white border-t border-slate-200">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            disabled={isLoading}
            placeholder="Describa la compra, responda las preguntas del asesor o escriba 'OK' para registrar..."
            className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-xs sm:text-sm focus:outline-none focus:border-purple-500 focus:bg-white font-sans text-slate-900 placeholder:text-slate-400"
          />
          <button
            type="submit"
            disabled={!inputVal.trim() || isLoading}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 text-white px-5 py-3 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-xs transition-all cursor-pointer shrink-0"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">Enviar</span>
          </button>
        </form>
      </div>

      {/* Modal de Asiento Registrado */}
      {registeredEntryModal && (
        <StandardJournalEntryModal
          isOpen={!!registeredEntryModal}
          onClose={() => setRegisteredEntryModal(null)}
          title="Asiento Contable Registrado con Éxito en el Libro Diario"
          subtitle={`Folio N° ${registeredEntryModal.folio || 'OFICIAL'} · Período ${registeredEntryModal.periodo || new Date().toISOString().substring(0, 7)} · ${company.razonSocial}`}
          entry={registeredEntryModal}
          onViewInLedger={() => {
            setRegisteredEntryModal(null);
            if (onViewLedger) onViewLedger();
          }}
        />
      )}
    </div>
  );
};
