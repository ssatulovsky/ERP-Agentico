/**
 * 3.3 Ejecuciones programadas de agentes (plan de corrección, fase 3).
 *
 * Despachador en memoria con estado persistido (diskPersistence): cada programación guarda su
 * próxima ejecución, de modo que un reinicio no la pierde ni la repite. Las tareas invocan al
 * motor (AutonomousAgentEngine.executeToolForAgent), sujetas a la lista de herramientas de su
 * agente, y nunca modifican libros por su cuenta: si proponen un cambio, crean una solicitud de
 * aprobación humana. Cada ejecución queda en la bitácora de auditoría.
 *
 * Activación: AGENT_SCHEDULER_ENABLED=true en UNA sola instancia del servidor (el despachador
 * no coordina entre instancias). Zona horaria de las horas programadas: America/Santiago.
 */
import crypto from 'node:crypto';
import { diskPersistence } from './diskPersistenceService';
import { AutonomousAgentEngine, type AutonomousAgentRequest } from './autonomousAgentEngine';
import { MODULE_AGENTS_REGISTRY } from './moduleAgentGovernanceService';
import { periodoActual, ultimosPeriodos, etiquetaPeriodo } from '../utils/periodo';

export const SCHEDULER_TIMEZONE = 'America/Santiago';
export const SCHEDULER_USER_ID = 'SISTEMA_PROGRAMADOR';

export type ScheduleFrequency =
  | { tipo: 'DIARIA'; hora: string }
  | { tipo: 'MENSUAL'; dia: number; hora: string };

export type ScheduledRunStatus =
  | 'PROPUESTA_CREADA' // se creó al menos una solicitud de aprobación
  | 'REQUIERE_ATENCION' // hallazgos sin propuesta automática (p. ej. diferencias RCV)
  | 'SIN_CAMBIOS' // se ejecutó y no hay nada que proponer
  | 'SIN_DATOS' // no hay datos para trabajar
  | 'REQUIERE_DATOS' // la herramienta pidió datos (MISSING_PARAMS)
  | 'BLOQUEADO_LIMITE' // 3.5: presupuesto diario agotado
  | 'ERROR';

export interface AgentSchedule {
  id: string;
  empresaId: string;
  tareaId: string;
  modulo: string;
  activo: boolean;
  frecuencia: ScheduleFrequency;
  /** Responsable que recibe las alertas (3.4). Si falta, se usa el responsable del módulo. */
  responsable?: { nombre?: string; email?: string; telefono?: string; userId?: string } | null;
  proximaEjecucion: string | null;
  ultimaEjecucion?: string | null;
  ultimoEstado?: ScheduledRunStatus | null;
  creadoPor: string;
  creadoEn: string;
  actualizadoEn: string;
}

export interface ScheduledRunStep {
  herramienta: string;
  status: string;
  resumen?: string;
}

export interface AgentScheduledRun {
  id: string;
  scheduleId: string | null;
  empresaId: string;
  tareaId: string;
  modulo: string;
  agente: string;
  disparo: 'PROGRAMADO' | 'MANUAL';
  usuarioId: string;
  /** Instante programado que se atendió (idempotencia por programación y horario). */
  slot: string | null;
  periodo: string | null;
  inicio: string;
  fin: string;
  estado: ScheduledRunStatus;
  resumen: string;
  requiereAccion: boolean;
  approvalIds: string[];
  pasos: ScheduledRunStep[];
  faltantes?: string[];
}

interface TaskContext {
  empresaId: string;
  periodo: string;
  run: (tool: string, args: Record<string, any>) => Promise<Record<string, any>>;
  pasos: ScheduledRunStep[];
}

interface TaskOutcome {
  estado: ScheduledRunStatus;
  resumen: string;
  approvalIds?: string[];
  faltantes?: string[];
}

export interface AgentScheduledTaskDefinition {
  id: string;
  modulo: string;
  nombre: string;
  descripcion: string;
  frecuenciaPorDefecto: ScheduleFrequency;
  /** Período sobre el que trabaja la tarea, según la fecha de ejecución. */
  periodo: (now: Date) => string;
  execute: (ctx: TaskContext) => Promise<TaskOutcome>;
}

/** Solicitudes de aprobación pendientes de una operación (para no duplicar propuestas). */
function pendingApprovals(empresaId: string, modulo: string, operacionTipo: string): any[] {
  return (diskPersistence.getApprovals(empresaId, modulo) || []).filter(
    (a: any) => a.operacionTipo === operacionTipo && a.estado === 'PENDIENTE'
  );
}

const clp = (n: number) => `$${Math.round(Number(n) || 0).toLocaleString('es-CL')}`;
const periodoAnterior = (now: Date) => ultimosPeriodos(2, periodoActual(now))[1];

function fromTool(out: Record<string, any>): TaskOutcome | null {
  if (out.status === 'MISSING_PARAMS') {
    return {
      estado: 'REQUIERE_DATOS',
      resumen: `Faltan datos para ejecutar ${out.herramienta}: ${(out.faltantes || []).join(', ')}.`,
      faltantes: out.faltantes || [],
    };
  }
  if (out.status === 'TOOL_NOT_ALLOWED' || out.status === 'TOOL_EXECUTION_ERROR' || out.status === 'TOOL_NOT_FOUND') {
    return { estado: 'ERROR', resumen: String(out.mensaje || out.error || out.status) };
  }
  return null;
}

/** Catálogo de tareas programables. Cada una pertenece al agente de un módulo. */
export const AGENT_SCHEDULED_TASKS: AgentScheduledTaskDefinition[] = [
  {
    id: 'CONCILIACION_DIARIA',
    modulo: 'CONCILIACION',
    nombre: 'Conciliación bancaria diaria',
    descripcion: 'Calza la cartola con el Libro Diario y propone los calces para aprobación.',
    frecuenciaPorDefecto: { tipo: 'DIARIA', hora: '07:00' },
    periodo: (now) => periodoActual(now),
    async execute({ run, empresaId }) {
      const out = await run('tool_bank_reconcile_movement', {});
      const err = fromTool(out);
      if (err) return err;
      if (out.status === 'NO_DATA') return { estado: 'SIN_DATOS', resumen: out.mensaje || 'Sin movimientos de cartola.' };
      // Movimientos que ya están en una propuesta pendiente no se vuelven a proponer.
      const enRevision = new Set<string>(
        pendingApprovals(empresaId, 'CONCILIACION', 'CONFIRMAR_CALCES_CONCILIACION')
          .flatMap((a: any) => (a.datosOperacion?.calces || []).map((c: any) => String(c.movimientoId)))
      );
      const calces: any[] = (Array.isArray(out.detallesCalce) ? out.detallesCalce : [])
        .filter((c: any) => !enRevision.has(String(c.movimientoId)));
      // Movimientos que siguen sin calce después de esta propuesta.
      const sinCalce = Math.max(0, Number(out.movimientosPendientes) || 0);
      if (calces.length === 0) {
        if (enRevision.size > 0 && Array.isArray(out.detallesCalce) && out.detallesCalce.length > 0) {
          return { estado: 'SIN_CAMBIOS', resumen: `Los calces encontrados ya están en una propuesta pendiente de aprobación (${enRevision.size} movimiento(s)).` };
        }
        return sinCalce > 0
          ? { estado: 'REQUIERE_ATENCION', resumen: `${sinCalce} movimiento(s) de cartola sin calce en el Libro Diario.` }
          : { estado: 'SIN_CAMBIOS', resumen: `${out.movimientosCartolaAuditados} movimiento(s) revisados; todos ya estaban conciliados.` };
      }
      const monto = calces.reduce((s, c) => s + (Number(c.monto) || 0), 0);
      const approval = await run('tool_submit_governance_approval', {
        operacionTipo: 'CONFIRMAR_CALCES_CONCILIACION',
        titulo: `Confirmar ${calces.length} calce(s) de conciliación bancaria`,
        descripcion: `La conciliación programada encontró ${calces.length} calce(s) por ${clp(monto)}. ` +
          `Quedan ${sinCalce} movimiento(s) sin calce. Al aprobar, los movimientos quedan conciliados con el asiento indicado.`,
        impactoFinancieroClp: 0,
        nivelRiesgo: calces.some((c) => c.calidadCalce !== 'ALTA_CONFIANZA') ? 'MEDIO' : 'BAJO',
        datosOperacion: { calces, montoTotalCalzado: monto, movimientosSinCalce: sinCalce },
      });
      const errAp = fromTool(approval);
      if (errAp) return errAp;
      return {
        estado: 'PROPUESTA_CREADA',
        resumen: `${calces.length} calce(s) por ${clp(monto)} enviados a aprobación; ${sinCalce} movimiento(s) sin calce.`,
        approvalIds: [approval.approvalId],
      };
    },
  },
  {
    id: 'RCV_DIARIO',
    modulo: 'TRIBUTARIO_SII',
    nombre: 'Revisión diaria del RCV',
    descripcion: 'Consulta el Registro de Compras y Ventas del período y lo cuadra contra el IVA del Libro Mayor.',
    frecuenciaPorDefecto: { tipo: 'DIARIA', hora: '06:30' },
    periodo: (now) => periodoActual(now),
    async execute({ run, periodo }) {
      const compras = await run('tool_sii_query_rcv', { periodo, tipoOperacion: 'COMPRAS' });
      const ventas = await run('tool_sii_query_rcv', { periodo, tipoOperacion: 'VENTAS' });
      const err = fromTool(compras) || fromTool(ventas);
      if (err) return err;
      if (compras.status === 'NO_DATA' && ventas.status === 'NO_DATA') {
        return { estado: 'SIN_DATOS', resumen: `Sin documentos RCV para ${etiquetaPeriodo(periodo)}.` };
      }
      const cuadre = await run('tool_sii_reconcile_rcv_vs_ledger', { periodo });
      const errC = fromTool(cuadre);
      if (errC) return errC;
      const docs = `${compras.totalDocumentos || 0} compra(s) y ${ventas.totalDocumentos || 0} venta(s)`;
      if (cuadre.diferencias?.conciliadoTributario) {
        return { estado: 'SIN_CAMBIOS', resumen: `RCV ${etiquetaPeriodo(periodo)}: ${docs}; IVA cuadrado con el Libro Mayor.` };
      }
      return {
        estado: 'REQUIERE_ATENCION',
        resumen: `RCV ${etiquetaPeriodo(periodo)}: ${docs}. Diferencias contra el Libro Mayor: IVA crédito ${clp(cuadre.diferencias?.diferenciaIvaCredito)}, ` +
          `IVA débito ${clp(cuadre.diferencias?.diferenciaIvaDebito)}. Falta centralizar documentos o revisar imputaciones.`,
      };
    },
  },
  {
    id: 'BORRADOR_F29',
    modulo: 'TRIBUTARIO_SII',
    nombre: 'Borrador F29 (día 5)',
    descripcion: 'Calcula el borrador del F29 del mes anterior y lo deja para revisión y aprobación.',
    frecuenciaPorDefecto: { tipo: 'MENSUAL', dia: 5, hora: '08:00' },
    periodo: periodoAnterior,
    async execute({ run, periodo, empresaId }) {
      if (pendingApprovals(empresaId, 'TRIBUTARIO_SII', 'BORRADOR_F29').some((a: any) => a.datosOperacion?.periodo === periodo)) {
        return { estado: 'SIN_CAMBIOS', resumen: `El borrador F29 de ${etiquetaPeriodo(periodo)} ya está pendiente de aprobación.` };
      }
      const f29 = await run('tool_tax_calculate_f29', { periodo });
      const err = fromTool(f29);
      if (err) return err;
      const docs = Number(f29.documentosVentaProcesados || 0) + Number(f29.documentosCompraProcesados || 0);
      if (docs === 0) {
        return { estado: 'SIN_DATOS', resumen: `Sin documentos de compra ni venta en ${etiquetaPeriodo(periodo)}; no se preparó borrador F29.` };
      }
      const approval = await run('tool_submit_governance_approval', {
        operacionTipo: 'BORRADOR_F29',
        titulo: `Borrador F29 ${etiquetaPeriodo(periodo)}: total ${clp(f29.totalPagarF29)}`,
        descripcion: `Débito fiscal ${clp(f29.debitoFiscalIva)}, crédito fiscal ${clp(f29.creditoFiscalIva)}, PPM ${clp(f29.ppmDeterminado)}, ` +
          `retenciones ${clp(Number(f29.retencionHonorarios145 || 0) + Number(f29.impuestoUnicoSegundaCategoria || 0))}. ` +
          `${(f29.alertasFiscales || []).length ? `Alertas: ${(f29.alertasFiscales || []).join(' · ')}` : 'Sin alertas fiscales.'}`,
        impactoFinancieroClp: Number(f29.totalPagarF29) || 0,
        nivelRiesgo: (f29.alertasFiscales || []).length ? 'ALTO' : 'MEDIO',
        // Solo el resumen: el borrador no se asienta ni se declara automáticamente.
        datosOperacion: {
          periodo,
          totalPagarF29: f29.totalPagarF29,
          debitoFiscalIva: f29.debitoFiscalIva,
          creditoFiscalIva: f29.creditoFiscalIva,
          ppmDeterminado: f29.ppmDeterminado,
          tasaPpm: f29.tasaPpm,
          f29Mapeo: f29.f29Mapeo,
          alertasFiscales: f29.alertasFiscales,
        },
      });
      const errAp = fromTool(approval);
      if (errAp) return errAp;
      return {
        estado: 'PROPUESTA_CREADA',
        resumen: `Borrador F29 ${etiquetaPeriodo(periodo)} por ${clp(f29.totalPagarF29)} enviado a aprobación.`,
        approvalIds: [approval.approvalId],
      };
    },
  },
  {
    id: 'DEPRECIACION_MENSUAL',
    modulo: 'ACTIVO_FIJO',
    nombre: 'Depreciación mensual (día 1)',
    descripcion: 'Calcula la depreciación NIC 16 del mes anterior y propone el asiento para aprobación.',
    frecuenciaPorDefecto: { tipo: 'MENSUAL', dia: 1, hora: '07:30' },
    periodo: periodoAnterior,
    async execute({ run, periodo, empresaId }) {
      const yaPropuesta = (diskPersistence.getApprovals(empresaId, 'ACTIVO_FIJO') || []).some(
        (a: any) => a.operacionTipo === 'DEPRECIACION_ACTIVO_FIJO' && a.datosOperacion?.periodo === periodo && a.estado !== 'RECHAZADO'
      );
      if (yaPropuesta) {
        return { estado: 'SIN_CAMBIOS', resumen: `La depreciación de ${etiquetaPeriodo(periodo)} ya tiene una propuesta vigente.` };
      }
      const calc = await run('tool_fixed_assets_depreciate_period', { periodo });
      const err = fromTool(calc);
      if (err) return err;
      if (calc.status === 'NO_DATA') return { estado: 'SIN_DATOS', resumen: calc.mensaje };
      // La herramienta de propuesta crea la solicitud de aprobación con el asiento.
      const prop = await run('tool_fixed_assets_propose_entry', { periodo });
      const errP = fromTool(prop);
      if (errP) return errP;
      if (prop.status === 'NO_DATA') return { estado: 'SIN_DATOS', resumen: prop.mensaje };
      return {
        estado: 'PROPUESTA_CREADA',
        resumen: `Depreciación ${etiquetaPeriodo(periodo)}: ${calc.totalActivosAuditados} activo(s), ${clp(prop.totalDebe)}; asiento enviado a aprobación.`,
        approvalIds: prop.approvalId ? [prop.approvalId] : [],
      };
    },
  },
];

export function getScheduledTask(tareaId: string): AgentScheduledTaskDefinition | undefined {
  return AGENT_SCHEDULED_TASKS.find((t) => t.id === tareaId);
}

// ---------------------------------------------------------------------------
// Cálculo de la próxima ejecución en hora de Chile
// ---------------------------------------------------------------------------

const HORA_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function validateFrequency(f: any): f is ScheduleFrequency {
  if (!f || typeof f !== 'object' || !HORA_RE.test(String(f.hora || ''))) return false;
  if (f.tipo === 'DIARIA') return true;
  return f.tipo === 'MENSUAL' && Number.isInteger(f.dia) && f.dia >= 1 && f.dia <= 28;
}

function zonedParts(date: Date, timeZone = SCHEDULER_TIMEZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { y: get('year'), m: get('month'), d: get('day'), h: get('hour'), min: get('minute'), s: get('second') };
}

/** Instante UTC que corresponde a la hora de pared indicada en la zona. */
export function zonedWallTimeToUtc(y: number, m: number, d: number, h: number, min: number, timeZone = SCHEDULER_TIMEZONE): Date {
  const guess = Date.UTC(y, m - 1, d, h, min);
  const offsetAt = (t: number) => {
    const p = zonedParts(new Date(t), timeZone);
    return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s) - t;
  };
  let result = guess - offsetAt(guess);
  result = guess - offsetAt(result);
  return new Date(result);
}

/** Próximo instante estrictamente posterior a `after` que cumple la frecuencia. */
export function computeNextRun(f: ScheduleFrequency, after: Date, timeZone = SCHEDULER_TIMEZONE): Date {
  const [hh, mm] = f.hora.split(':').map(Number);
  const now = zonedParts(after, timeZone);
  if (f.tipo === 'DIARIA') {
    for (let i = 0; i < 3; i++) {
      const base = new Date(Date.UTC(now.y, now.m - 1, now.d + i));
      const cand = zonedWallTimeToUtc(base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate(), hh, mm, timeZone);
      if (cand.getTime() > after.getTime()) return cand;
    }
  } else {
    for (let i = 0; i < 3; i++) {
      const base = new Date(Date.UTC(now.y, now.m - 1 + i, 1));
      const cand = zonedWallTimeToUtc(base.getUTCFullYear(), base.getUTCMonth() + 1, f.dia, hh, mm, timeZone);
      if (cand.getTime() > after.getTime()) return cand;
    }
  }
  throw new Error('No se pudo calcular la próxima ejecución.');
}

// ---------------------------------------------------------------------------
// Persistencia
// ---------------------------------------------------------------------------

const MAX_RUNS = 1000;
const norm = (id: string) => String(id || '').replace(/[^0-9kK]/g, '').toUpperCase() || String(id || '');

function loadSchedules(): AgentSchedule[] {
  return ((diskPersistence.getSnapshot() as any).agentSchedules || []) as AgentSchedule[];
}
function saveSchedules(list: AgentSchedule[]) {
  diskPersistence.updateCollection('agentSchedules', list);
}
function loadRuns(): AgentScheduledRun[] {
  return ((diskPersistence.getSnapshot() as any).agentScheduleRuns || []) as AgentScheduledRun[];
}
function saveRuns(list: AgentScheduledRun[]) {
  diskPersistence.updateCollection('agentScheduleRuns', list.slice(0, MAX_RUNS));
}

/** Observadores de cada ejecución terminada (3.4 alertas). */
type RunListener = (run: AgentScheduledRun, schedule: AgentSchedule | null) => void | Promise<void>;

/** Control previo a cada ejecución (3.5 límites). Devuelve un motivo para bloquear o null. */
type RunGuard = (input: { empresaId: string; tareaId: string; modulo: string }) => string | null;

class AgentSchedulerService {
  private timer: NodeJS.Timeout | null = null;
  private ticking = false;
  private listeners: RunListener[] = [];
  private guards: RunGuard[] = [];

  onRunCompleted(listener: RunListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  addRunGuard(guard: RunGuard): () => void {
    this.guards.push(guard);
    return () => {
      this.guards = this.guards.filter((g) => g !== guard);
    };
  }

  listTasks() {
    return AGENT_SCHEDULED_TASKS.map(({ execute, periodo, ...t }) => t);
  }

  listSchedules(empresaId?: string): AgentSchedule[] {
    const all = loadSchedules();
    return empresaId ? all.filter((s) => norm(s.empresaId) === norm(empresaId)) : all;
  }

  getSchedule(id: string): AgentSchedule | undefined {
    return loadSchedules().find((s) => s.id === id);
  }

  listRuns(filter: { empresaId?: string; scheduleId?: string; limit?: number } = {}): AgentScheduledRun[] {
    let runs = loadRuns();
    if (filter.empresaId) runs = runs.filter((r) => norm(r.empresaId) === norm(filter.empresaId!));
    if (filter.scheduleId) runs = runs.filter((r) => r.scheduleId === filter.scheduleId);
    return runs.slice(0, filter.limit ?? 100);
  }

  /** Crea o actualiza la programación de una tarea para una empresa (una por tarea y empresa). */
  upsertSchedule(input: {
    empresaId: string;
    tareaId: string;
    activo?: boolean;
    frecuencia?: ScheduleFrequency;
    responsable?: AgentSchedule['responsable'];
    usuarioId: string;
    now?: Date;
  }): AgentSchedule {
    const task = getScheduledTask(input.tareaId);
    if (!task) throw Object.assign(new Error(`Tarea desconocida: ${input.tareaId}`), { code: 'TASK_UNKNOWN' });
    if (!input.empresaId) throw Object.assign(new Error('Falta empresaId.'), { code: 'MISSING_PARAMS' });
    if (input.frecuencia !== undefined && !validateFrequency(input.frecuencia)) {
      throw Object.assign(new Error('Frecuencia inválida: DIARIA {hora HH:MM} o MENSUAL {dia 1-28, hora HH:MM}.'), { code: 'INVALID_FREQUENCY' });
    }
    const now = input.now || new Date();
    const list = loadSchedules();
    const idx = list.findIndex((s) => norm(s.empresaId) === norm(input.empresaId) && s.tareaId === task.id);
    const prev = idx >= 0 ? list[idx] : null;
    const frecuencia = input.frecuencia || prev?.frecuencia || task.frecuenciaPorDefecto;
    const activo = input.activo ?? prev?.activo ?? true;
    const sched: AgentSchedule = {
      id: prev?.id || `sched-${crypto.randomUUID()}`,
      empresaId: prev?.empresaId || input.empresaId,
      tareaId: task.id,
      modulo: task.modulo,
      activo,
      frecuencia,
      responsable: input.responsable !== undefined ? input.responsable : prev?.responsable ?? null,
      proximaEjecucion: activo ? computeNextRun(frecuencia, now).toISOString() : null,
      ultimaEjecucion: prev?.ultimaEjecucion ?? null,
      ultimoEstado: prev?.ultimoEstado ?? null,
      creadoPor: prev?.creadoPor || input.usuarioId,
      creadoEn: prev?.creadoEn || now.toISOString(),
      actualizadoEn: now.toISOString(),
    };
    if (idx >= 0) list[idx] = sched;
    else list.push(sched);
    saveSchedules(list);
    diskPersistence.addAuditLog({
      id: `audit-${crypto.randomUUID()}`,
      fecha: now.toISOString(),
      entidadTipo: 'AGENT_SCHEDULE',
      entidadId: sched.id,
      accion: prev ? 'ACTUALIZAR_PROGRAMACION_AGENTE' : 'CREAR_PROGRAMACION_AGENTE',
      usuarioId: input.usuarioId,
      empresaId: sched.empresaId,
      datosPrevios: prev ? { activo: prev.activo, frecuencia: prev.frecuencia } : null,
      datosNuevos: { tareaId: sched.tareaId, activo: sched.activo, frecuencia: sched.frecuencia },
    });
    return sched;
  }

  /**
   * Ejecuta una tarea para una empresa. Usa el motor con la lista de herramientas del agente,
   * registra la ejecución y la auditoría, y notifica a los observadores.
   */
  async runTask(input: {
    empresaId: string;
    tareaId: string;
    disparo?: 'PROGRAMADO' | 'MANUAL';
    usuarioId?: string;
    scheduleId?: string | null;
    slot?: string | null;
    now?: Date;
  }): Promise<AgentScheduledRun> {
    const task = getScheduledTask(input.tareaId);
    if (!task) throw Object.assign(new Error(`Tarea desconocida: ${input.tareaId}`), { code: 'TASK_UNKNOWN' });
    const now = input.now || new Date();
    const agent = MODULE_AGENTS_REGISTRY.find((a) => a.moduloId === task.modulo);
    const periodo = task.periodo(now);
    const company = diskPersistence.getClient(input.empresaId);
    const request: AutonomousAgentRequest = {
      empresaId: input.empresaId,
      module: task.modulo,
      agentRole: `${agent?.agenteNombre || task.modulo} · ejecución programada (${task.nombre})`,
      query: task.descripcion,
      context: { ...(company ? { company, empresa: company } : {}), selectedPeriod: periodo },
      userId: input.usuarioId || SCHEDULER_USER_ID,
    };
    const pasos: ScheduledRunStep[] = [];
    const run = async (tool: string, args: Record<string, any>) => {
      let out: Record<string, any>;
      try {
        out = await AutonomousAgentEngine.executeToolForAgent(task.modulo, tool, args, request);
      } catch (e: any) {
        out = { status: 'TOOL_EXECUTION_ERROR', error: e?.message || String(e) };
      }
      pasos.push({ herramienta: tool, status: String(out.status || 'SIN_ESTADO'), resumen: out.mensaje || out.error });
      return out;
    };

    let outcome: TaskOutcome;
    const bloqueo = this.guards.map((g) => g({ empresaId: input.empresaId, tareaId: task.id, modulo: task.modulo })).find(Boolean);
    if (bloqueo) {
      outcome = { estado: 'BLOQUEADO_LIMITE', resumen: bloqueo };
    } else {
      try {
        outcome = await task.execute({ empresaId: input.empresaId, periodo, run, pasos });
      } catch (e: any) {
        outcome = { estado: 'ERROR', resumen: `Error en la tarea: ${e?.message || e}` };
      }
    }

    const record: AgentScheduledRun = {
      id: `run-${crypto.randomUUID()}`,
      scheduleId: input.scheduleId ?? null,
      empresaId: input.empresaId,
      tareaId: task.id,
      modulo: task.modulo,
      agente: agent ? `${agent.agenteNombre} (${agent.agenteCargo})` : task.modulo,
      disparo: input.disparo || 'MANUAL',
      usuarioId: input.usuarioId || SCHEDULER_USER_ID,
      slot: input.slot ?? null,
      periodo,
      inicio: now.toISOString(),
      fin: new Date().toISOString(),
      estado: outcome.estado,
      resumen: outcome.resumen,
      requiereAccion: ['PROPUESTA_CREADA', 'REQUIERE_ATENCION', 'REQUIERE_DATOS', 'ERROR', 'BLOQUEADO_LIMITE'].includes(outcome.estado),
      approvalIds: (outcome.approvalIds || []).filter(Boolean),
      pasos,
      ...(outcome.faltantes ? { faltantes: outcome.faltantes } : {}),
    };

    saveRuns([record, ...loadRuns()]);
    diskPersistence.addAuditLog({
      id: `audit-${crypto.randomUUID()}`,
      fecha: record.fin,
      entidadTipo: 'AGENT_SCHEDULED_RUN',
      entidadId: record.id,
      accion: `EJECUCION_${record.disparo}_${record.tareaId}`,
      usuarioId: record.usuarioId,
      usuarioNombre: record.agente,
      empresaId: record.empresaId,
      datosNuevos: { estado: record.estado, resumen: record.resumen, periodo, approvalIds: record.approvalIds, pasos },
    });

    const schedule = input.scheduleId ? this.getSchedule(input.scheduleId) || null : null;
    if (schedule) {
      const list = loadSchedules();
      const i = list.findIndex((s) => s.id === schedule.id);
      if (i >= 0) {
        list[i] = { ...list[i], ultimaEjecucion: record.fin, ultimoEstado: record.estado };
        saveSchedules(list);
      }
    }

    for (const l of this.listeners) {
      try {
        await l(record, schedule);
      } catch (e: any) {
        console.warn(`[AgentScheduler] Observador falló: ${e?.message || e}`);
      }
    }
    return record;
  }

  /** Ejecuta la tarea de una programación ahora, sin mover su próximo horario. */
  async runScheduleNow(scheduleId: string, usuarioId: string, now?: Date): Promise<AgentScheduledRun> {
    const s = this.getSchedule(scheduleId);
    if (!s) throw Object.assign(new Error('Programación no encontrada.'), { code: 'NOT_FOUND' });
    return this.runTask({ empresaId: s.empresaId, tareaId: s.tareaId, disparo: 'MANUAL', usuarioId, scheduleId: s.id, now });
  }

  /**
   * Atiende las programaciones vencidas. Cada horario se ejecuta una sola vez: antes de correr
   * la tarea se avanza la próxima ejecución, y un horario atrasado (servidor apagado) se atiende
   * una vez, sin repetir los que se perdieron.
   */
  async tick(now: Date = new Date()): Promise<AgentScheduledRun[]> {
    if (this.ticking) return [];
    this.ticking = true;
    const done: AgentScheduledRun[] = [];
    try {
      const due = loadSchedules().filter((s) => s.activo && s.proximaEjecucion && new Date(s.proximaEjecucion).getTime() <= now.getTime());
      for (const s of due) {
        const slot = s.proximaEjecucion!;
        const list = loadSchedules();
        const i = list.findIndex((x) => x.id === s.id);
        if (i < 0 || list[i].proximaEjecucion !== slot) continue;
        list[i] = { ...list[i], proximaEjecucion: computeNextRun(list[i].frecuencia, now).toISOString() };
        saveSchedules(list);
        if (loadRuns().some((r) => r.scheduleId === s.id && r.slot === slot)) continue;
        done.push(await this.runTask({ empresaId: s.empresaId, tareaId: s.tareaId, disparo: 'PROGRAMADO', scheduleId: s.id, slot, now }));
      }
    } finally {
      this.ticking = false;
    }
    return done;
  }

  start(intervalMs = 60_000): boolean {
    if (this.timer) return false;
    this.timer = setInterval(() => {
      this.tick().catch((e) => console.error('[AgentScheduler] Error en el despachador:', e));
    }, intervalMs);
    this.timer.unref?.();
    console.info(`[AgentScheduler] Despachador de tareas programadas activo (cada ${Math.round(intervalMs / 1000)} s).`);
    return true;
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  isRunning() {
    return Boolean(this.timer);
  }
}

export const agentSchedulerService = new AgentSchedulerService();

export function isSchedulerEnabled(): boolean {
  return String(process.env.AGENT_SCHEDULER_ENABLED || '').toLowerCase() === 'true';
}
