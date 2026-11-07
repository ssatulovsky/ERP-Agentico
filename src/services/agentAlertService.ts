/**
 * 3.4 Alertas proactivas (plan de corrección, fase 3).
 *
 * Cada ejecución programada que requiere acción (propuesta para aprobar, diferencias, datos que
 * faltan o error) genera una alerta para el responsable: queda en el panel del dashboard ejecutivo
 * y, si hay un número autorizado en la lista blanca de WhatsApp, se envía por el puente. El estado
 * de cada canal se registra tal como ocurrió (enviado, no conectado, sin destinatario, error).
 */
import crypto from 'node:crypto';
import { diskPersistence } from './diskPersistenceService';
import type { AgentSchedule, AgentScheduledRun } from './agentSchedulerService';
import { agentSchedulerService, getScheduledTask } from './agentSchedulerService';

export type AgentAlertKind = 'APROBACION_PENDIENTE' | 'ATENCION' | 'DATOS_FALTANTES' | 'ERROR';

export interface AgentAlertChannelResult {
  canal: 'PANEL' | 'WHATSAPP';
  estado: 'ENTREGADA' | 'ENVIADA' | 'NO_CONECTADO' | 'SIN_DESTINATARIO' | 'ERROR';
  destino?: string;
  detalle?: string;
}

export interface AgentAlert {
  id: string;
  empresaId: string;
  modulo: string;
  tareaId: string;
  runId: string;
  tipo: AgentAlertKind;
  titulo: string;
  mensaje: string;
  approvalIds: string[];
  canales: AgentAlertChannelResult[];
  creadaEn: string;
  leidaEn?: string | null;
  leidaPor?: string | null;
}

/** Módulo del agente → alcance de WhatsApp que debe tener el número autorizado. */
const MODULE_TO_WHATSAPP_SCOPE: Record<string, string> = {
  CONCILIACION: 'BANCOS_CONCILIACION',
  TESORERIA: 'BANCOS_CONCILIACION',
  FLUJO_CAJA: 'FLUJO_CAJA',
  TRIBUTARIO_SII: 'TRIBUTARIO_F29',
  FACTURACION_DTE: 'FACTURACION_DTE',
  CONTABILIDAD: 'CONTABILIDAD_IFRS',
  ACTIVO_FIJO: 'CONTABILIDAD_IFRS',
  RRHH: 'RRHH_REMUNERACIONES',
  INVENTARIO: 'BODEGA_INVENTARIO',
  COSTOS_PRODUCCION: 'PRODUCCION_COSTEO',
  COMERCIAL_COMPRAS: 'PRESUPUESTOS_COMERCIAL',
  RENDICIONES: 'RENDICIONES_GASTOS',
};

const KIND_BY_STATUS: Record<string, AgentAlertKind> = {
  PROPUESTA_CREADA: 'APROBACION_PENDIENTE',
  REQUIERE_ATENCION: 'ATENCION',
  REQUIERE_DATOS: 'DATOS_FALTANTES',
  ERROR: 'ERROR',
  BLOQUEADO_LIMITE: 'ERROR',
};

/** Puerto de envío por WhatsApp (el puente real o un doble en pruebas). */
export interface WhatsappAlertPort {
  listRecipients(empresaId: string, scope: string): Array<{ telefono: string; nombre: string }>;
  isAuthorized(telefono: string): boolean;
  send(telefono: string, mensaje: string): Promise<{ success: boolean; mode: string; message: string }>;
}

const digits = (v: string) => String(v || '').replace(/\D/g, '');
const normEmp = (v: string) => String(v || '').replace(/[^0-9kK]/g, '').toUpperCase() || String(v || '');

async function defaultWhatsappPort(): Promise<WhatsappAlertPort> {
  const { whatsappBridgeService } = await import('./whatsappBridgeService');
  const bridge: any = whatsappBridgeService;
  return {
    listRecipients(empresaId, scope) {
      const whitelist: any[] = bridge.getStatusAndConfig?.().whitelist || [];
      return whitelist
        .filter((w) => w.activo && w.recibirReportesDirectos && normEmp(w.empresaId) === normEmp(empresaId))
        .filter((w) => (w.agentesPermitidos || []).includes(scope) || (w.agentesPermitidos || []).includes('PANORAMA_DIRECTORIO'))
        .map((w) => ({ telefono: w.telefono, nombre: w.nombre }));
    },
    isAuthorized(telefono) {
      return Boolean(bridge.findAuthorizedWhitelistEntry?.(telefono));
    },
    send(telefono, mensaje) {
      return bridge.sendDirectMessageToAuthorizedNumber({ telefonoDestino: telefono, mensaje });
    },
  };
}

function loadAlerts(): AgentAlert[] {
  return ((diskPersistence.getSnapshot() as any).agentAlerts || []) as AgentAlert[];
}
function saveAlerts(list: AgentAlert[]) {
  diskPersistence.updateCollection('agentAlerts', list.slice(0, 1000));
}

class AgentAlertService {
  private whatsappPortFactory: () => Promise<WhatsappAlertPort> = defaultWhatsappPort;

  /** Pruebas: sustituye el puente de WhatsApp. */
  setWhatsappPort(factory: (() => Promise<WhatsappAlertPort>) | null) {
    this.whatsappPortFactory = factory || defaultWhatsappPort;
  }

  list(filter: { empresaId?: string; soloNoLeidas?: boolean; limit?: number } = {}): AgentAlert[] {
    let list = loadAlerts();
    if (filter.empresaId) list = list.filter((a) => normEmp(a.empresaId) === normEmp(filter.empresaId!));
    if (filter.soloNoLeidas) list = list.filter((a) => !a.leidaEn);
    return list.slice(0, filter.limit ?? 100);
  }

  get(id: string): AgentAlert | undefined {
    return loadAlerts().find((a) => a.id === id);
  }

  markRead(id: string, userId: string): AgentAlert | null {
    const list = loadAlerts();
    const i = list.findIndex((a) => a.id === id);
    if (i < 0) return null;
    if (!list[i].leidaEn) list[i] = { ...list[i], leidaEn: new Date().toISOString(), leidaPor: userId };
    saveAlerts(list);
    return list[i];
  }

  /** Crea la alerta de una ejecución que requiere acción y la envía por los canales disponibles. */
  async notifyRun(run: AgentScheduledRun, schedule: AgentSchedule | null): Promise<AgentAlert | null> {
    if (!run.requiereAccion) return null;
    const kind = KIND_BY_STATUS[run.estado] || 'ATENCION';
    const task = getScheduledTask(run.tareaId);
    const nombreTarea = task?.nombre || run.tareaId;
    const titulo =
      kind === 'APROBACION_PENDIENTE'
        ? `${nombreTarea}: ${run.approvalIds.length} propuesta(s) para aprobar`
        : kind === 'DATOS_FALTANTES'
          ? `${nombreTarea}: faltan datos`
          : kind === 'ERROR'
            ? `${nombreTarea}: no se completó`
            : `${nombreTarea}: requiere revisión`;

    const alert: AgentAlert = {
      id: `alert-${crypto.randomUUID()}`,
      empresaId: run.empresaId,
      modulo: run.modulo,
      tareaId: run.tareaId,
      runId: run.id,
      tipo: kind,
      titulo,
      mensaje: run.resumen,
      approvalIds: run.approvalIds,
      canales: [{ canal: 'PANEL', estado: 'ENTREGADA' }],
      creadaEn: new Date().toISOString(),
      leidaEn: null,
      leidaPor: null,
    };

    alert.canales.push(...(await this.sendWhatsapp(alert, run, schedule)));
    saveAlerts([alert, ...loadAlerts()]);
    diskPersistence.addAuditLog({
      id: `audit-${crypto.randomUUID()}`,
      fecha: alert.creadaEn,
      entidadTipo: 'AGENT_ALERT',
      entidadId: alert.id,
      accion: `ALERTA_${alert.tipo}`,
      usuarioId: 'SISTEMA_PROGRAMADOR',
      empresaId: alert.empresaId,
      datosNuevos: { runId: run.id, titulo, canales: alert.canales },
    });
    return alert;
  }

  private async sendWhatsapp(alert: AgentAlert, run: AgentScheduledRun, schedule: AgentSchedule | null): Promise<AgentAlertChannelResult[]> {
    let port: WhatsappAlertPort;
    try {
      port = await this.whatsappPortFactory();
    } catch (e: any) {
      return [{ canal: 'WHATSAPP', estado: 'NO_CONECTADO', detalle: `Puente WhatsApp no disponible: ${e?.message || e}` }];
    }
    const scope = MODULE_TO_WHATSAPP_SCOPE[run.modulo] || 'PANORAMA_DIRECTORIO';
    const responsableTel = digits(schedule?.responsable?.telefono || '');
    // El responsable de la programación, si está autorizado; si no, los números autorizados del módulo.
    const destinos = responsableTel && port.isAuthorized(responsableTel)
      ? [{ telefono: responsableTel, nombre: schedule?.responsable?.nombre || 'Responsable' }]
      : port.listRecipients(run.empresaId, scope);
    if (destinos.length === 0) {
      return [{
        canal: 'WHATSAPP',
        estado: 'SIN_DESTINATARIO',
        detalle: responsableTel
          ? `El teléfono del responsable no está en la lista blanca de WhatsApp.`
          : `Sin números autorizados con alcance ${scope} y reportes directos para esta empresa.`,
      }];
    }
    const texto = [
      `ERPremIA · ${run.agente}`,
      alert.titulo,
      alert.mensaje,
      alert.approvalIds.length ? `Revise y apruebe en el ERP (Dashboard ejecutivo › Alertas de agentes).` : '',
    ].filter(Boolean).join('\n');

    const out: AgentAlertChannelResult[] = [];
    for (const d of destinos) {
      try {
        const r = await port.send(d.telefono, texto);
        out.push({
          canal: 'WHATSAPP',
          estado: r.success ? 'ENVIADA' : 'NO_CONECTADO',
          destino: `+${digits(d.telefono)}`,
          detalle: r.message,
        });
      } catch (e: any) {
        out.push({ canal: 'WHATSAPP', estado: 'ERROR', destino: `+${digits(d.telefono)}`, detalle: e?.message || String(e) });
      }
    }
    return out;
  }
}

export const agentAlertService = new AgentAlertService();

// Toda ejecución programada terminada pasa por las alertas (se registra al importar este módulo).
agentSchedulerService.onRunCompleted((run, schedule) => agentAlertService.notifyRun(run, schedule).then(() => undefined));
