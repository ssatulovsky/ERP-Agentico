import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Smartphone,
  QrCode,
  Lock,
  Unlock,
  UserPlus,
  Trash2,
  Edit3,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Send,
  Volume2,
  EyeOff,
  Users,
  MessageSquare,
  Check,
  X,
  AlertTriangle,
  Sparkles,
  Terminal,
  Phone,
  Layers,
} from 'lucide-react';
import { voiceAssistantEngine } from '../../services/voiceAssistantEngine';
import { agentPersonasStorage } from '../../services/agentPersonasStorage';

export interface WhatsAppScopeMeta {
  id: string;
  nombre: string;
  agenteResponsable: string;
  descripcion: string;
  icono: string;
  ejemplosConsulta: string[];
}

export interface WhatsAppRolePreset {
  id: string;
  nombre: string;
  descripcion: string;
  scopes: string[];
}

export interface WhatsAppWhitelistEntry {
  id: string;
  telefono: string;
  nombre: string;
  cargo: string;
  rolPreset: string;
  agentesPermitidos: string[];
  activo: boolean;
  recibirReportesDirectos: boolean;
  responderConAudio: boolean;
  ultimaInteraccion?: string;
}

export interface WhatsAppPrivacyConfig {
  ignorarTodosLosGrupos: boolean;
  ignorarEstadosBroadcast: boolean;
  ignorarNoAutorizadosSilenciosamente: boolean;
  noMarcarLeidoEnChatsPrivados: boolean;
  prefijoActivacionOpcional: string;
  autoResponderEnListaBlanca: boolean;
}

export interface WhatsAppAuditLog {
  id: string;
  timestamp: string;
  telefono: string;
  nombreUsuario: string;
  tipoEvento: 'AUTORIZADO_PROCESADO' | 'BLOQUEADO_ROL_INSUFICIENTE' | 'ENVIO_SALIENTE_ERP' | 'SISTEMA';
  agentesInvolucrados: string[];
  resumenAccion: string;
}

interface WhatsAppSecurityBridgePanelProps {
  activeClientId: string;
  clientName: string;
}

export const WhatsAppSecurityBridgePanel: React.FC<WhatsAppSecurityBridgePanelProps> = ({
  activeClientId,
  clientName,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [connectionState, setConnectionState] = useState<string>('DISCONNECTED');
  const [qrRaw, setQrRaw] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [connectedPhoneNumber, setConnectedPhoneNumber] = useState<string | null>(null);
  const [connectedPushName, setConnectedPushName] = useState<string | null>(null);
  const [lastErrorMessage, setLastErrorMessage] = useState<string | null>(null);

  const [privacyConfig, setPrivacyConfig] = useState<WhatsAppPrivacyConfig>({
    ignorarTodosLosGrupos: true,
    ignorarEstadosBroadcast: true,
    ignorarNoAutorizadosSilenciosamente: true,
    noMarcarLeidoEnChatsPrivados: true,
    prefijoActivacionOpcional: '',
    autoResponderEnListaBlanca: true,
  });

  const [whitelist, setWhitelist] = useState<WhatsAppWhitelistEntry[]>([]);
  const [auditLogs, setAuditLogs] = useState<WhatsAppAuditLog[]>([]);
  const [stats, setStats] = useState({
    mensajesAutorizadosProcesados: 0,
    intentosRolBloqueados: 0,
    eventosPrivadosIgnoradosEnMemoria: 0,
  });

  const [catalogScopes, setCatalogScopes] = useState<WhatsAppScopeMeta[]>([]);
  const [rolePresets, setRolePresets] = useState<WhatsAppRolePreset[]>([]);

  // Modal de creación / edición de número en Lista Blanca
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingEntry, setEditingEntry] = useState<WhatsAppWhitelistEntry | null>(null);
  const [formPhone, setFormPhone] = useState<string>('+569');
  const [formName, setFormName] = useState<string>('');
  const [formCargo, setFormCargo] = useState<string>('');
  const [formPreset, setFormPreset] = useState<string>('SOLO_RRHH');
  const [formScopes, setFormScopes] = useState<string[]>(['RRHH_REMUNERACIONES']);
  const [formActivo, setFormActivo] = useState<boolean>(true);
  const [formRecibirReportes, setFormRecibirReportes] = useState<boolean>(false);
  const [formResponderAudio, setFormResponderAudio] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Estado del Simulador de Firewall RBAC & Privacidad
  const [simPhone, setSimPhone] = useState<string>('56987654321');
  const [simIsGroup, setSimIsGroup] = useState<boolean>(false);
  const [simMessage, setSimMessage] = useState<string>('¿Cuánto stock de paño Dyneema queda en bodega?');
  const [simResult, setSimResult] = useState<any | null>(null);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  // Envío directo a número autorizado
  const [directTargetPhone, setDirectTargetPhone] = useState<string>('56998765432');
  const [directMessageText, setDirectMessageText] = useState<string>(
    `📊 *REPORTE EJECUTIVO ${clientName.toUpperCase()}*\nHola Socio, el flujo de caja ha sido actualizado a la fecha de hoy con saldo bancario conciliado de $18.450.000 CLP y proyección positiva a 30 días de $22.100.000 CLP.`
  );
  const [directSendFeedback, setDirectSendFeedback] = useState<{
    type: 'success' | 'warning' | 'error';
    text: string;
  } | null>(null);

  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/whatsapp/status');
      if (!res.ok) return;
      const data = await res.json();
      if (data.success) {
        setConnectionState(data.connectionState || 'DISCONNECTED');
        setQrRaw(data.qrRaw || null);
        setQrDataUrl(data.qrDataUrl || null);
        setConnectedPhoneNumber(data.connectedPhoneNumber || null);
        setConnectedPushName(data.connectedPushName || null);
        setLastErrorMessage(data.lastErrorMessage || null);
        if (data.privacyConfig) setPrivacyConfig(data.privacyConfig);
        if (Array.isArray(data.whitelist)) setWhitelist(data.whitelist);
        if (Array.isArray(data.auditLogs)) setAuditLogs(data.auditLogs);
        if (data.stats) setStats(data.stats);
        if (Array.isArray(data.catalogScopes)) setCatalogScopes(data.catalogScopes);
        if (Array.isArray(data.rolePresets)) setRolePresets(data.rolePresets);
      }
    } catch (e) {
      // Silencioso en polling
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleStartConnect = async () => {
    setConnectionState('CONNECTING');
    setLastErrorMessage(null);
    try {
      const res = await fetch('/api/whatsapp/connect', { method: 'POST' });
      const data = await res.json();
      if (data.connectionState) setConnectionState(data.connectionState);
      if (data.qrDataUrl) setQrDataUrl(data.qrDataUrl);
      if (data.qrRaw) setQrRaw(data.qrRaw);
      if (data.lastErrorMessage) setLastErrorMessage(data.lastErrorMessage);
      showToast('Iniciando vinculación WhatsApp Web Multi-Device...');
    } catch (err: any) {
      setLastErrorMessage(err.message || 'Error al solicitar código QR.');
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('¿Deseas desvincular la sesión actual de WhatsApp Web y borrar las credenciales del servidor?')) {
      return;
    }
    try {
      await fetch('/api/whatsapp/disconnect', { method: 'POST' });
      await fetchStatus();
      showToast('Sesión de WhatsApp desvinculada correctamente.');
    } catch {}
  };

  const handleTogglePrivacy = async (key: keyof WhatsAppPrivacyConfig, value: any) => {
    const next = { ...privacyConfig, [key]: value };
    setPrivacyConfig(next);
    try {
      await fetch('/api/whatsapp/privacy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      });
      showToast('Configuración de privacidad actualizada.');
    } catch {}
  };

  const openNewWhitelistModal = () => {
    setEditingEntry(null);
    setFormPhone('+569');
    setFormName('');
    setFormCargo('');
    setFormPreset('SOLO_RRHH');
    setFormScopes(['RRHH_REMUNERACIONES']);
    setFormActivo(true);
    setFormRecibirReportes(false);
    setFormResponderAudio(false);
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditWhitelistModal = (entry: WhatsAppWhitelistEntry) => {
    setEditingEntry(entry);
    setFormPhone(`+${entry.telefono}`);
    setFormName(entry.nombre);
    setFormCargo(entry.cargo);
    setFormPreset(entry.rolPreset);
    setFormScopes([...entry.agentesPermitidos]);
    setFormActivo(entry.activo);
    setFormRecibirReportes(entry.recibirReportesDirectos);
    setFormResponderAudio(entry.responderConAudio);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handlePresetChange = (presetId: string) => {
    setFormPreset(presetId);
    const found = rolePresets.find((p) => p.id === presetId);
    if (found && presetId !== 'PERSONALIZADO') {
      setFormScopes([...found.scopes]);
    }
  };

  const handleToggleScopeCheckbox = (scopeId: string) => {
    setFormPreset('PERSONALIZADO');
    setFormScopes((prev) =>
      prev.includes(scopeId) ? prev.filter((s) => s !== scopeId) : [...prev, scopeId]
    );
  };

  const handleSaveWhitelistEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formName.trim()) {
      setFormError('Ingresa el nombre de la persona o ejecutivo autorizado.');
      return;
    }
    if (formScopes.length === 0) {
      setFormError('Debes asignar al menos 1 agente/módulo autorizado para este número.');
      return;
    }

    try {
      const res = await fetch('/api/whatsapp/whitelist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingEntry?.id,
          telefono: formPhone,
          nombre: formName,
          cargo: formCargo || 'Ejecutivo Autorizado',
          rolPreset: formPreset,
          agentesPermitidos: formScopes,
          activo: formActivo,
          recibirReportesDirectos: formRecibirReportes,
          responderConAudio: formResponderAudio,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setFormError(data.error || 'Error al guardar en Lista Blanca.');
        return;
      }
      setWhitelist(data.whitelist || []);
      setIsModalOpen(false);
      showToast(`Número +${data.entry.telefono} (${data.entry.nombre}) guardado en Lista Blanca.`);
    } catch (err: any) {
      setFormError(err.message || 'Error de red al guardar.');
    }
  };

  const handleToggleEntryActive = async (entry: WhatsAppWhitelistEntry) => {
    try {
      const res = await fetch('/api/whatsapp/whitelist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...entry,
          activo: !entry.activo,
        }),
      });
      const data = await res.json();
      if (data.success && data.whitelist) {
        setWhitelist(data.whitelist);
        showToast(
          `Acceso para ${entry.nombre} ${!entry.activo ? 'HABILITADO' : 'PAUSADO'}.`
        );
      }
    } catch {}
  };

  const handleDeleteEntry = async (entry: WhatsAppWhitelistEntry) => {
    if (!window.confirm(`¿Eliminar a ${entry.nombre} (+${entry.telefono}) de la Lista Blanca?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/whatsapp/whitelist/${entry.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success && data.whitelist) {
        setWhitelist(data.whitelist);
        showToast(`Número eliminado de la Lista Blanca.`);
      }
    } catch {}
  };

  const runSimulation = async (customPhone?: string, customMsg?: string, customGroup?: boolean) => {
    const phoneToUse = customPhone !== undefined ? customPhone : simPhone;
    const msgToUse = customMsg !== undefined ? customMsg : simMessage;
    const groupToUse = customGroup !== undefined ? customGroup : simIsGroup;

    if (customPhone !== undefined) setSimPhone(customPhone);
    if (customMsg !== undefined) setSimMessage(customMsg);
    if (customGroup !== undefined) setSimIsGroup(customGroup);

    setIsSimulating(true);
    try {
      const jid = groupToUse
        ? `${phoneToUse.replace(/[^0-9]/g, '')}-123456@g.us`
        : `${phoneToUse.replace(/[^0-9]/g, '')}@s.whatsapp.net`;

      const res = await fetch('/api/whatsapp/simulate-incoming', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          remoteJid: jid,
          messageText: msgToUse,
          isGroup: groupToUse,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSimResult(data.evaluation);
        if (data.auditLogs) setAuditLogs(data.auditLogs);
        if (data.stats) setStats(data.stats);
      }
    } catch {} finally {
      setIsSimulating(false);
    }
  };

  const handleSpeakSimulationResult = () => {
    if (!simResult?.verbalSummaryForAudio) return;
    const personas = agentPersonasStorage.getPersonas(activeClientId);
    const vera = personas.find((p) => p.id === 'AGENTE_GENERAL_VERA') || personas[0];
    if (vera) {
      voiceAssistantEngine.speak(simResult.verbalSummaryForAudio, vera);
    }
  };

  const handleSendDirectMessage = async () => {
    setDirectSendFeedback(null);
    try {
      const res = await fetch('/api/whatsapp/send-direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telefonoDestino: directTargetPhone,
          mensaje: directMessageText,
          incluirAudioPiper: false,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDirectSendFeedback({
          type: 'error',
          text: data.error || 'Bloqueado por Lista Blanca.',
        });
        return;
      }
      if (data.mode === 'LIVE_SOCKET' && data.success) {
        setDirectSendFeedback({
          type: 'success',
          text: data.message,
        });
        if (data.auditLogs) setAuditLogs(data.auditLogs);
      } else {
        // Si aún no escaneó el QR, ofrecer abrir WhatsApp directo al número autorizado
        const cleanDigits = directTargetPhone.replace(/[^0-9]/g, '');
        const waUrl = `https://api.whatsapp.com/send?phone=${cleanDigits}&text=${encodeURIComponent(directMessageText)}`;
        window.open(waUrl, '_blank', 'noopener,noreferrer');
        setDirectSendFeedback({
          type: 'warning',
          text: `Como el código QR aún no ha sido escaneado en el VPS, se abrió el envío directo hacia +${cleanDigits} validado por Lista Blanca.`,
        });
      }
    } catch (err: any) {
      setDirectSendFeedback({
        type: 'error',
        text: err.message || 'Error al enviar.',
      });
    }
  };

  const getScopeName = (scopeId: string) => {
    return catalogScopes.find((s) => s.id === scopeId)?.nombre || scopeId;
  };

  const getScopeBadgeColor = (scopeId: string) => {
    switch (scopeId) {
      case 'FLUJO_CAJA':
      case 'BANCOS_CONCILIACION':
      case 'PANORAMA_DIRECTORIO':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'RRHH_REMUNERACIONES':
        return 'bg-purple-50 text-purple-800 border-purple-200';
      case 'BODEGA_INVENTARIO':
      case 'PRODUCCION_COSTEO':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'TRIBUTARIO_F29':
      case 'CONTABILIDAD_IFRS':
      case 'FACTURACION_DTE':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl border border-emerald-500/40 flex items-center gap-2.5 text-xs font-bold">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* BANNER PRINCIPAL: VINCULACIÓN WHATSAPP WEB QR + ESCUDO DE PRIVACIDAD */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 border border-emerald-500/30 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                WhatsApp Web Multi-Device • Firewall RBAC & Lista Blanca
              </span>
              <span className="text-[11px] font-mono font-bold uppercase px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 flex items-center gap-1">
                <EyeOff className="w-3 h-3" />
                Privacidad Personal 100% Aislada
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
              Vinculación WhatsApp QR & Control de Acceso por Agente
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Vincula tu propio WhatsApp escaneando el código QR como en <strong>WhatsApp Web</strong>. Por privacidad de tu línea personal, el sistema <strong>ignora todos los grupos</strong> y <strong>descarta en 0ms cualquier mensaje de contactos fuera de la Lista Blanca</strong> (sin leerlos ni marcarlos como vistos). Cada número autorizado solo puede interactuar con los agentes asignados a su rol.
            </p>
          </div>

          {/* Indicador de Estado de Conexión */}
          <div className="bg-slate-950/80 border border-white/10 rounded-xl p-4 shrink-0 min-w-[270px] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase font-bold text-slate-400">Estado del Vínculo</span>
              {connectionState === 'CONNECTED' ? (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  VINCULADO ACTIVO
                </span>
              ) : connectionState === 'QR_READY' ? (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5">
                  <QrCode className="w-3.5 h-3.5" />
                  ESPERANDO ESCANEO QR
                </span>
              ) : connectionState === 'CONNECTING' || connectionState === 'INSTALLING_DEPS' ? (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-blue-500/20 text-blue-300 border border-blue-500/40 flex items-center gap-1.5">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  INICIANDO MOTOR...
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                  DESCONECTADO
                </span>
              )}
            </div>

            {connectionState === 'CONNECTED' && (
              <div className="text-xs space-y-1 bg-emerald-950/50 border border-emerald-500/30 rounded-lg p-2.5">
                <div className="font-bold text-emerald-200">{connectedPushName || 'Línea Principal Vinculada'}</div>
                <div className="font-mono text-emerald-400 text-[11px]">+{connectedPhoneNumber}</div>
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              {connectionState !== 'CONNECTED' ? (
                <button
                  onClick={handleStartConnect}
                  disabled={connectionState === 'CONNECTING' || connectionState === 'INSTALLING_DEPS'}
                  className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white rounded-lg text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
                >
                  <QrCode className="w-4 h-4" />
                  <span>{connectionState === 'QR_READY' ? 'Refrescar Código QR' : 'Generar Código QR WhatsApp'}</span>
                </button>
              ) : (
                <button
                  onClick={handleDisconnect}
                  className="w-full py-2 px-3 bg-rose-600/80 hover:bg-rose-600 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Desvincular WhatsApp</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SECCIÓN QR Y ESCUDO DE PRIVACIDAD PERSONAL */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Columna Izquierda (5 cols): Escaneo de Código QR tipo WhatsApp Web */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-emerald-600" />
                <h3 className="font-extrabold text-slate-900 text-sm">
                  1. Vinculación como WhatsApp Web
                </h3>
              </div>
              <span className="text-[11px] font-mono text-slate-500">Multi-Device</span>
            </div>

            {lastErrorMessage && (
              <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Aviso del Servidor:</span>
                  <span>{lastErrorMessage}</span>
                </div>
              </div>
            )}

            <div className="my-4 flex flex-col items-center justify-center min-h-[250px] bg-slate-50 border border-dashed border-slate-300 rounded-xl p-4 text-center">
              {connectionState === 'CONNECTED' ? (
                <div className="space-y-3 py-4">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                    <CheckCircle2 className="w-9 h-9" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-extrabold text-slate-900 text-base">
                      ¡WhatsApp Web Conectado!
                    </h4>
                    <p className="text-xs text-slate-600 max-w-xs mx-auto">
                      Sesión activa para <strong>+{connectedPhoneNumber}</strong>. Solo los números en tu Lista Blanca pueden interactuar con los agentes autorizados.
                    </p>
                  </div>
                </div>
              ) : qrDataUrl || qrRaw ? (
                <div className="space-y-3">
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-md inline-block">
                    <img
                      src={
                        qrDataUrl ||
                        `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(qrRaw || '')}`
                      }
                      alt="Código QR WhatsApp Web"
                      className="w-56 h-56 object-contain"
                    />
                  </div>
                  <p className="text-xs font-bold text-emerald-800">
                    Escanea este código desde WhatsApp &rarr; Dispositivos vinculados
                  </p>
                </div>
              ) : connectionState === 'CONNECTING' || connectionState === 'INSTALLING_DEPS' ? (
                <div className="space-y-3 py-6">
                  <RefreshCw className="w-10 h-10 text-emerald-600 animate-spin mx-auto" />
                  <div className="text-xs font-bold text-slate-700">
                    {connectionState === 'INSTALLING_DEPS'
                      ? 'Instalando motor ligero WhatsApp (@whiskeysockets/baileys) en el VPS...'
                      : 'Negociando llave criptográfica con WhatsApp Web...'}
                  </div>
                  <p className="text-[11px] text-slate-500 max-w-xs">
                    El código QR aparecerá en este recuadro en unos segundos.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 py-4">
                  <div className="w-14 h-14 rounded-2xl bg-slate-200/70 text-slate-500 flex items-center justify-center mx-auto">
                    <QrCode className="w-7 h-7" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-800">
                      Haz clic en &ldquo;Generar Código QR WhatsApp&rdquo;
                    </p>
                    <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                      Tu sesión se guardará cifrada en el servidor VPS para mantenerse activa sin depender de tu navegador.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200/80 text-[11px] text-slate-600 space-y-1">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
              <span>Pasos en tu celular:</span>
            </div>
            <ol className="list-decimal list-inside space-y-0.5 text-slate-600">
              <li>Abre WhatsApp en tu teléfono.</li>
              <li>Ve a <strong>Configuración / Ajustes &rarr; Dispositivos vinculados</strong>.</li>
              <li>Toca <strong>Vincular un dispositivo</strong> y escanea el QR.</li>
            </ol>
          </div>
        </div>

        {/* Columna Derecha (7 cols): Escudo de Privacidad del Número Personal */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <EyeOff className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">
                    2. Escudo de Privacidad de tu Número Personal
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Protege tu WhatsApp personal: el ERP no ve tus grupos ni conversaciones privadas.
                  </p>
                </div>
              </div>
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full">
                MODO ZERO-SPY ACTIVO
              </span>
            </div>

            {/* Toggles de Privacidad */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={privacyConfig.ignorarTodosLosGrupos}
                  onChange={(e) => handleTogglePrivacy('ignorarTodosLosGrupos', e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div className="text-xs">
                  <span className="font-bold text-slate-900 block">
                    Bloquear e Ignorar Todos los Grupos (@g.us)
                  </span>
                  <span className="text-[11px] text-slate-500 leading-snug block mt-0.5">
                    El socket ignora a nivel de protocolo cualquier grupo personal, familiar o laboral.
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={privacyConfig.ignorarNoAutorizadosSilenciosamente}
                  onChange={(e) =>
                    handleTogglePrivacy('ignorarNoAutorizadosSilenciosamente', e.target.checked)
                  }
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div className="text-xs">
                  <span className="font-bold text-slate-900 block">
                    Descarte en 0ms Fuera de Lista Blanca
                  </span>
                  <span className="text-[11px] text-slate-500 leading-snug block mt-0.5">
                    Si te escribe un amigo o contacto no listado, se descarta en memoria sin guardar log ni texto.
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={privacyConfig.noMarcarLeidoEnChatsPrivados}
                  onChange={(e) =>
                    handleTogglePrivacy('noMarcarLeidoEnChatsPrivados', e.target.checked)
                  }
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div className="text-xs">
                  <span className="font-bold text-slate-900 block">
                    No Marcar &ldquo;Visto&rdquo; en Chats Personales
                  </span>
                  <span className="text-[11px] text-slate-500 leading-snug block mt-0.5">
                    Tus mensajes personales siguen apareciendo como no leídos en tu teléfono celular.
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={privacyConfig.autoResponderEnListaBlanca}
                  onChange={(e) =>
                    handleTogglePrivacy('autoResponderEnListaBlanca', e.target.checked)
                  }
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div className="text-xs">
                  <span className="font-bold text-slate-900 block">
                    Respuesta Automática de Vera en Lista Blanca
                  </span>
                  <span className="text-[11px] text-slate-500 leading-snug block mt-0.5">
                    Vera responde automáticamente a los números autorizados según los agentes de su rol.
                  </span>
                </div>
              </label>
            </div>

            {/* Mención @vera + Guía de Prueba en "Mensajes a ti mismo" */}
            <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs">
                  <span className="font-extrabold text-indigo-950 block">
                    Invocación Inteligente <code className="font-mono bg-indigo-100 px-1.5 py-0.5 rounded">@vera</code> (Para convivir con tus chats humanos):
                  </span>
                  <span className="text-[11px] text-indigo-800 block mt-0.5">
                    • <strong>Cuando te escribe el Contador o un rol de Lista Blanca:</strong> Pueden hablar contigo normalmente de temas cotidianos sin que Vera se meta. Cuando quieran pedirle algo al ERP, simplemente agregan <code className="font-mono font-bold">@vera</code> en su mensaje (ej. <em>&ldquo;@vera pásame el F29 y flujo de caja&rdquo;</em>) y Vera les responderá validando sus permisos RBAC.
                  </span>
                  <span className="text-[11px] text-emerald-800 font-semibold block mt-1">
                    • <strong>¿Cómo probar tú mismo desde tu propio celular vinculado?:</strong> Abre en tu WhatsApp tu propio chat <strong>&ldquo;Tú (Mensajes a ti mismo)&rdquo;</strong> y escribe directamente (con o sin <code className="font-mono font-bold">@vera</code>), o escribe <code className="font-mono font-bold">@vera ...</code> dentro de cualquier chat 1 a 1.
                  </span>
                </div>
                <div className="flex flex-col gap-1 shrink-0 w-full sm:w-44">
                  <input
                    type="text"
                    value={privacyConfig.prefijoActivacionOpcional}
                    onChange={(e) => handleTogglePrivacy('prefijoActivacionOpcional', e.target.value)}
                    placeholder="Ej: @vera (o vacío)"
                    className="px-3 py-1.5 bg-white border border-indigo-300 rounded-lg text-xs font-mono font-bold text-slate-800 w-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleTogglePrivacy('prefijoActivacionOpcional', '@vera')}
                      className="flex-1 text-[10px] font-bold px-2 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer"
                    >
                      Usar @vera
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTogglePrivacy('prefijoActivacionOpcional', '')}
                      className="flex-1 text-[10px] font-bold px-2 py-1 rounded bg-white border border-slate-300 text-slate-600 hover:bg-slate-100 cursor-pointer"
                    >
                      Sin prefijo
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Estadísticas de Blindaje */}
          <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-100">
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-2.5 text-center">
              <div className="text-lg font-black font-mono text-emerald-700">
                {stats.mensajesAutorizadosProcesados}
              </div>
              <div className="text-[10px] font-bold uppercase text-emerald-800">
                Consultas Autorizadas
              </div>
            </div>
            <div className="bg-rose-50/70 border border-rose-200 rounded-lg p-2.5 text-center">
              <div className="text-lg font-black font-mono text-rose-700">
                {stats.intentosRolBloqueados}
              </div>
              <div className="text-[10px] font-bold uppercase text-rose-800">
                Bloqueos por Rol (RBAC)
              </div>
            </div>
            <div className="bg-slate-100 border border-slate-200 rounded-lg p-2.5 text-center">
              <div className="text-lg font-black font-mono text-slate-700">
                {stats.eventosPrivadosIgnoradosEnMemoria}
              </div>
              <div className="text-[10px] font-bold uppercase text-slate-600">
                Privados Ignorados (0 Log)
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECCIÓN 3: LISTA BLANCA DE NÚMEROS Y MATRIZ DE PERMISOS POR AGENTE (RBAC) */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">
                3. Lista Blanca de Números Autorizados & Permisos por Agente (RBAC)
              </h3>
              <p className="text-xs text-slate-500">
                Define exactamente qué números pueden escribirle a Vera y con qué agentes tiene permiso de interactuar cada uno (Ej: <em>Solo RRHH</em> no puede consultar <em>Inventario</em>, salvo que tenga ambos permisos asignados).
              </p>
            </div>
          </div>

          <button
            onClick={openNewWhitelistModal}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 shadow-sm shrink-0 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Autorizar Nuevo Número en Lista Blanca</span>
          </button>
        </div>

        {/* Tabla de Números en Lista Blanca */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-3">Estado</th>
                <th className="py-3 px-3">Número WhatsApp</th>
                <th className="py-3 px-3">Usuario / Cargo</th>
                <th className="py-3 px-3">Agentes & Módulos Autorizados (Alcance RBAC)</th>
                <th className="py-3 px-3 text-center">Opciones</th>
                <th className="py-3 px-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {whitelist.map((entry) => (
                <tr
                  key={entry.id}
                  className={`hover:bg-slate-50/80 transition-colors ${
                    !entry.activo ? 'opacity-50 bg-slate-50' : ''
                  }`}
                >
                  <td className="py-3 px-3">
                    <button
                      onClick={() => handleToggleEntryActive(entry)}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold flex items-center gap-1 cursor-pointer ${
                        entry.activo
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-slate-200 text-slate-600 border border-slate-300'
                      }`}
                      title="Clic para activar o pausar acceso"
                    >
                      {entry.activo ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>ACTIVO</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-3 h-3 text-slate-500" />
                          <span>PAUSADO</span>
                        </>
                      )}
                    </button>
                  </td>

                  <td className="py-3 px-3 font-mono font-bold text-slate-900">
                    +{entry.telefono}
                  </td>

                  <td className="py-3 px-3">
                    <div className="font-bold text-slate-900">{entry.nombre}</div>
                    <div className="text-[11px] text-slate-500">{entry.cargo}</div>
                  </td>

                  <td className="py-3 px-3 max-w-md">
                    {entry.agentesPermitidos.length === catalogScopes.length && catalogScopes.length > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-gradient-to-r from-indigo-600 to-emerald-600 text-white shadow-2xs">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>ACCESO TOTAL SOCIO (Todos los 11 Agentes del ERP)</span>
                      </span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {entry.agentesPermitidos.map((scopeId) => (
                          <span
                            key={scopeId}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getScopeBadgeColor(
                              scopeId
                            )}`}
                          >
                            {getScopeName(scopeId)}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>

                  <td className="py-3 px-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      {entry.responderConAudio && (
                        <span
                          className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold"
                          title="Recibe respuesta en nota de voz con Piper TTS"
                        >
                          🔊 Audio Piper
                        </span>
                      )}
                      {entry.recibirReportesDirectos && (
                        <span
                          className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold"
                          title="Destinatario de reportes ejecutivos con 1 clic"
                        >
                          📊 Reportes
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="py-3 px-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => {
                          setSimPhone(entry.telefono);
                          setSimIsGroup(false);
                          window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                        }}
                        className="px-2 py-1 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 rounded-lg border border-slate-200 text-[11px] font-bold cursor-pointer"
                        title="Probar permisos de este número en el simulador"
                      >
                        Probar Rol
                      </button>
                      <button
                        onClick={() => openEditWhitelistModal(entry)}
                        className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                        title="Editar permisos de agentes"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteEntry(entry)}
                        className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Eliminar de la Lista Blanca"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECCIÓN 4: SIMULADOR EN VIVO DEL FIREWALL RBAC Y ENVÍO DIRECTO */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Simulador de Firewall RBAC (7 cols) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Terminal className="w-5 h-5 text-indigo-600" />
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm">
                  4. Probador de Seguridad RBAC & Permisos por Agente
                </h3>
                <p className="text-[11px] text-slate-500">
                  Verifica cómo responde Vera según el número remitente y los permisos de su rol.
                </p>
              </div>
            </div>
          </div>

          {/* Botones de Escenarios de Prueba Rápida */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Escenarios de Prueba en 1 Clic:
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  runSimulation(
                    '56987654321',
                    '¿Cuánto stock de paño Dyneema queda en bodega?',
                    false
                  )
                }
                className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-900 border border-rose-200 rounded-lg text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1"
              >
                <Lock className="w-3 h-3 text-rose-600" />
                <span>1. Rol Solo RRHH pide Inventario (Bloqueado)</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  runSimulation(
                    '56987654321',
                    '¿Cuánto hay que pagar de sueldos líquidos e imposiciones Previred?',
                    false
                  )
                }
                className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 rounded-lg text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1"
              >
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>2. Rol Solo RRHH pide Sueldos (Autorizado)</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  runSimulation(
                    '56976543210',
                    'Dame el stock de Dyneema en bodega y el resumen de sueldos de RRHH',
                    false
                  )
                }
                className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 rounded-lg text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1"
              >
                <Layers className="w-3 h-3 text-indigo-600" />
                <span>3. Rol RRHH + Inventario pide ambos (Autorizado)</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  runSimulation(
                    '56911112222',
                    'Hola, ¿a qué hora nos juntamos a cenar?',
                    false
                  )
                }
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-lg text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1"
              >
                <EyeOff className="w-3 h-3 text-slate-600" />
                <span>4. Contacto Personal No Listado (Ignorado 0ms)</span>
              </button>
            </div>
          </div>

          {/* Inputs del Simulador */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
            <div className="sm:col-span-4">
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Número Remitente:
              </label>
              <select
                value={simPhone}
                onChange={(e) => setSimPhone(e.target.value)}
                className="w-full px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800"
              >
                {whitelist.map((w) => (
                  <option key={w.id} value={w.telefono}>
                    +{w.telefono} ({w.nombre})
                  </option>
                ))}
                <option value="56911112222">+56911112222 (Contacto Personal No Autorizado)</option>
              </select>
            </div>

            <div className="sm:col-span-8">
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Mensaje Entrante por WhatsApp:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={simMessage}
                  onChange={(e) => setSimMessage(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800"
                  placeholder="Escribe una consulta para probar el filtro RBAC..."
                />
                <button
                  type="button"
                  onClick={() => runSimulation()}
                  disabled={isSimulating}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs shrink-0 cursor-pointer"
                >
                  Evaluar
                </button>
              </div>
            </div>
          </div>

          {/* Resultado de la Evaluación */}
          {simResult && (
            <div
              className={`p-4 rounded-xl border space-y-2.5 ${
                simResult.shouldIgnoreSilently
                  ? 'bg-slate-100 border-slate-300 text-slate-800'
                  : simResult.allowed
                  ? 'bg-emerald-50/70 border-emerald-300 text-slate-900'
                  : 'bg-rose-50/80 border-rose-300 text-slate-900'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {simResult.shouldIgnoreSilently ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-white text-[10px] font-extrabold flex items-center gap-1">
                      <EyeOff className="w-3 h-3" />
                      DESCARTADO EN 0ms (PRIVACIDAD PERSONAL PROTEGIDA)
                    </span>
                  ) : simResult.allowed ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-extrabold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      AUTORIZADO POR LISTA BLANCA Y ROL RBAC
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-extrabold flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3" />
                      BLOQUEADO: ROL SIN PERMISO PARA ESTE AGENTE
                    </span>
                  )}
                </div>

                {simResult.verbalSummaryForAudio && (
                  <button
                    type="button"
                    onClick={handleSpeakSimulationResult}
                    className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer shadow-2xs"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>Escuchar Audio Vera</span>
                  </button>
                )}
              </div>

              {simResult.shouldIgnoreSilently ? (
                <p className="text-xs text-slate-600">
                  <strong>Motivo:</strong> <code className="font-mono">{simResult.ignoreReason}</code>. El sistema no procesó el mensaje, no envió respuesta y no dejó registro en la base de datos para preservar la privacidad de tu WhatsApp.
                </p>
              ) : (
                <pre className="text-[11px] bg-white p-3 rounded-lg border border-slate-200 font-mono whitespace-pre-wrap text-slate-800 max-h-60 overflow-y-auto">
                  {simResult.responseText}
                </pre>
              )}
            </div>
          )}
        </div>

        {/* Despacho Directo de Reportes a Lista Blanca + Bitácora (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
              <Send className="w-4 h-4 text-emerald-600" />
              <h3 className="font-extrabold text-slate-900 text-sm">
                5. Enviar Reporte Directo a Número en Lista Blanca
              </h3>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Destinatario Autorizado:
              </label>
              <select
                value={directTargetPhone}
                onChange={(e) => setDirectTargetPhone(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
              >
                {whitelist
                  .filter((w) => w.activo)
                  .map((w) => (
                    <option key={w.id} value={w.telefono}>
                      {w.nombre} (+{w.telefono}) — {w.cargo}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Mensaje / Reporte Ejecutivo:
              </label>
              <textarea
                rows={4}
                value={directMessageText}
                onChange={(e) => setDirectMessageText(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-slate-800"
              />
            </div>

            {directSendFeedback && (
              <div
                className={`p-2.5 rounded-lg text-xs font-medium border ${
                  directSendFeedback.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : directSendFeedback.type === 'warning'
                    ? 'bg-amber-50 text-amber-900 border-amber-200'
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}
              >
                {directSendFeedback.text}
              </div>
            )}

            <button
              type="button"
              onClick={handleSendDirectMessage}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>Enviar por WhatsApp a Destinatario Autorizado</span>
            </button>
          </div>

          {/* Bitácora de Auditoría RBAC */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">
                Bitácora de Auditoría RBAC (Solo Lista Blanca)
              </span>
              {auditLogs.length > 0 && (
                <button
                  onClick={async () => {
                    await fetch('/api/whatsapp/clear-logs', { method: 'POST' });
                    setAuditLogs([]);
                  }}
                  className="text-[11px] text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  Limpiar
                </button>
              )}
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {auditLogs.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">
                  Sin eventos registrados aún. Los chats privados fuera de la lista blanca jamás se registran aquí.
                </p>
              ) : (
                auditLogs.slice(0, 12).map((log) => (
                  <div
                    key={log.id}
                    className="p-2.5 rounded-lg border border-slate-100 bg-slate-50 text-[11px] space-y-0.5"
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span
                        className={
                          log.tipoEvento === 'BLOQUEADO_ROL_INSUFICIENTE'
                            ? 'text-rose-700'
                            : 'text-emerald-700'
                        }
                      >
                        {log.nombreUsuario} (+{log.telefono})
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-slate-600">{log.resumenAccion}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MODAL PARA AGREGAR / EDITAR NÚMERO EN LISTA BLANCA Y SUS ROLES */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">
                    {editingEntry
                      ? `Editar Permisos RBAC: +${editingEntry.telefono}`
                      : 'Autorizar Nuevo Número en Lista Blanca WhatsApp'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Asigna qué agentes del ERP pueden conversar con este número telefónico.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveWhitelistEntry} className="space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 font-bold">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Número WhatsApp (con código país):
                  </label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="+56912345678"
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nombre de la Persona:
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Ej: María Soto"
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Cargo / Rol en la Empresa:
                  </label>
                  <input
                    type="text"
                    value={formCargo}
                    onChange={(e) => setFormCargo(e.target.value)}
                    placeholder="Ej: Jefa de RRHH"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900"
                  />
                </div>
              </div>

              {/* Plantilla Rápida de Rol */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Plantilla Rápida de Rol (o marca casillas manualmente abajo):
                </label>
                <select
                  value={formPreset}
                  onChange={(e) => handlePresetChange(e.target.value)}
                  className="w-full px-3 py-2 bg-indigo-50/70 border border-indigo-300 rounded-lg text-xs font-bold text-indigo-950"
                >
                  {rolePresets.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.nombre} — {preset.descripcion}
                    </option>
                  ))}
                </select>
              </div>

              {/* Matriz de Casillas de Agentes Permitidos */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold text-slate-800">
                    Agentes del ERP con los que este número PUEDE interactuar ({formScopes.length} seleccionados):
                  </label>
                  <div className="flex gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => {
                        setFormPreset('SOCIO_DIRECTOR_TOTAL');
                        setFormScopes(catalogScopes.map((s) => s.id));
                      }}
                      className="text-indigo-600 font-bold hover:underline cursor-pointer"
                    >
                      Marcar Todos
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => {
                        setFormPreset('PERSONALIZADO');
                        setFormScopes([]);
                      }}
                      className="text-slate-500 hover:underline cursor-pointer"
                    >
                      Desmarcar Todos
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-xl">
                  {catalogScopes.map((scope) => {
                    const checked = formScopes.includes(scope.id);
                    return (
                      <label
                        key={scope.id}
                        className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                          checked
                            ? 'bg-indigo-50 border-indigo-400 text-indigo-950 shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100/60'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleToggleScopeCheckbox(scope.id)}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600"
                        />
                        <div>
                          <div className="font-bold text-slate-900">{scope.nombre}</div>
                          <div className="text-[10px] text-slate-500">{scope.agenteResponsable}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Opciones adicionales */}
              <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-slate-100 text-xs">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formResponderAudio}
                    onChange={(e) => setFormResponderAudio(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                  />
                  <span className="font-semibold text-slate-800">
                    Enviar también Nota de Voz (Piper Neural TTS)
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formRecibirReportes}
                    onChange={(e) => setFormRecibirReportes(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                  />
                  <span className="font-semibold text-slate-800">
                    Destinatario de Reportes Ejecutivos 1-Clic
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold shadow-sm cursor-pointer"
                >
                  Guardar Número y Permisos RBAC
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
