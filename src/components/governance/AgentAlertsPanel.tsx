/**
 * 3.3 / 3.4 Panel del dashboard ejecutivo: alertas de los agentes y tareas programadas.
 * El responsable ve lo que requiere acción (y lo aprueba) sin abrir cada módulo.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BellRing, CalendarClock, CheckCircle2, AlertTriangle, Play, Loader2, MessageCircle, RefreshCw } from 'lucide-react';
import { getStoredAuthToken } from '../../services/apiClient';
import { ModuleAgentGovernanceHeader } from './ModuleAgentGovernanceHeader';

interface AgentAlert {
  id: string;
  modulo: string;
  tareaId: string;
  tipo: 'APROBACION_PENDIENTE' | 'ATENCION' | 'DATOS_FALTANTES' | 'ERROR';
  titulo: string;
  mensaje: string;
  approvalIds: string[];
  canales: Array<{ canal: string; estado: string; destino?: string; detalle?: string }>;
  creadaEn: string;
  leidaEn?: string | null;
}

interface TaskDef {
  id: string;
  modulo: string;
  nombre: string;
  descripcion: string;
  frecuenciaPorDefecto: { tipo: 'DIARIA' | 'MENSUAL'; hora: string; dia?: number };
}

interface Schedule {
  id: string;
  tareaId: string;
  modulo: string;
  activo: boolean;
  frecuencia: { tipo: 'DIARIA' | 'MENSUAL'; hora: string; dia?: number };
  proximaEjecucion: string | null;
  ultimaEjecucion?: string | null;
  ultimoEstado?: string | null;
}

const TIPO_STYLE: Record<AgentAlert['tipo'], string> = {
  APROBACION_PENDIENTE: 'bg-amber-50 border-amber-300 text-amber-900',
  ATENCION: 'bg-sky-50 border-sky-300 text-sky-900',
  DATOS_FALTANTES: 'bg-violet-50 border-violet-300 text-violet-900',
  ERROR: 'bg-rose-50 border-rose-300 text-rose-900',
};

const ESTADO_LABEL: Record<string, string> = {
  PROPUESTA_CREADA: 'Propuesta para aprobar',
  REQUIERE_ATENCION: 'Requiere revisión',
  SIN_CAMBIOS: 'Sin cambios',
  SIN_DATOS: 'Sin datos',
  REQUIERE_DATOS: 'Faltan datos',
  BLOQUEADO_LIMITE: 'Bloqueado por límite',
  ERROR: 'Error',
};

const fechaCL = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('es-CL', { timeZone: 'America/Santiago', dateStyle: 'short', timeStyle: 'short' }) : '—';

const frecuenciaTexto = (f: Schedule['frecuencia']) =>
  f.tipo === 'DIARIA' ? `Diaria ${f.hora}` : `Día ${f.dia} de cada mes, ${f.hora}`;

function whatsappResumen(a: AgentAlert): string | null {
  const wa = a.canales.filter((c) => c.canal === 'WHATSAPP');
  if (wa.length === 0) return null;
  const enviados = wa.filter((c) => c.estado === 'ENVIADA');
  if (enviados.length) return `WhatsApp enviado a ${enviados.map((c) => c.destino).join(', ')}`;
  return `WhatsApp no enviado: ${wa[0].detalle || wa[0].estado}`;
}

export const AgentAlertsPanel: React.FC<{ empresaId: string }> = ({ empresaId }) => {
  const [alerts, setAlerts] = useState<AgentAlert[]>([]);
  const [tasks, setTasks] = useState<TaskDef[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [despachador, setDespachador] = useState<{ activo: boolean; habilitado: boolean }>({ activo: false, habilitado: false });
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const api = useCallback(
    async (method: string, path: string, body?: any) => {
      const token = getStoredAuthToken();
      const sep = path.includes('?') ? '&' : '?';
      const res = await fetch(`${path}${sep}empresaId=${encodeURIComponent(empresaId)}`, {
        method,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body ? JSON.stringify({ ...body, empresaId }) : undefined,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.errorMessage || `Error ${res.status}`);
      return json;
    },
    [empresaId]
  );

  const load = useCallback(async () => {
    if (!empresaId) return;
    setLoading(true);
    setError(null);
    try {
      const [a, s] = await Promise.all([api('GET', '/api/agents/schedules/alerts'), api('GET', '/api/agents/schedules')]);
      setAlerts(a.alertas || []);
      setTasks(s.tareas || []);
      setSchedules(s.programaciones || []);
      setDespachador({ activo: Boolean(s.despachadorActivo), habilitado: Boolean(s.despachadorHabilitado) });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [api, empresaId]);

  useEffect(() => {
    load();
  }, [load]);

  const noLeidas = alerts.filter((a) => !a.leidaEn);
  const modulosConAprobacion = useMemo(
    () => [...new Set(noLeidas.filter((a) => a.approvalIds.length > 0).map((a) => a.modulo))],
    [noLeidas]
  );

  const marcarLeida = async (id: string) => {
    setBusy(id);
    try {
      await api('POST', `/api/agents/schedules/alerts/${encodeURIComponent(id)}/read`, {});
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const toggle = async (task: TaskDef, activo: boolean) => {
    setBusy(task.id);
    try {
      await api('PUT', '/api/agents/schedules', { tareaId: task.id, activo });
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const ejecutarAhora = async (task: TaskDef) => {
    setBusy(task.id);
    try {
      let sched = schedules.find((s) => s.tareaId === task.id);
      if (!sched) {
        // Sin programación aún: se registra apagada para poder ejecutarla a pedido.
        const r = await api('PUT', '/api/agents/schedules', { tareaId: task.id, activo: false });
        sched = r.programacion;
      }
      await api('POST', `/api/agents/schedules/${encodeURIComponent(sched!.id)}/run`, {});
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  if (!empresaId) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-amber-50 text-amber-700 rounded-lg">
            <BellRing className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-900">Alertas de agentes</h2>
            <p className="text-xs text-slate-500">
              {noLeidas.length === 0 ? 'Sin alertas pendientes.' : `${noLeidas.length} alerta(s) sin revisar.`}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={load}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 px-2.5 py-1.5 rounded-md border border-slate-200 cursor-pointer"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Actualizar
        </button>
      </div>

      {error && <div className="text-xs p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800">{error}</div>}

      {noLeidas.length > 0 && (
        <ul className="space-y-2">
          {noLeidas.map((a) => {
            const wa = whatsappResumen(a);
            return (
              <li key={a.id} className={`border rounded-lg p-3 text-xs ${TIPO_STYLE[a.tipo]}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="font-bold flex items-center gap-1.5">
                      {a.tipo === 'ERROR' ? <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> : <BellRing className="w-3.5 h-3.5 shrink-0" />}
                      {a.titulo}
                    </div>
                    <p className="text-slate-700">{a.mensaje}</p>
                    <p className="text-[11px] text-slate-500 flex items-center gap-2 flex-wrap">
                      <span>{fechaCL(a.creadaEn)}</span>
                      {wa && (
                        <span className="inline-flex items-center gap-1">
                          <MessageCircle className="w-3 h-3" /> {wa}
                        </span>
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy === a.id}
                    onClick={() => marcarLeida(a.id)}
                    className="shrink-0 text-[11px] font-bold px-2 py-1 rounded-md bg-white/70 border border-current/20 hover:bg-white cursor-pointer"
                  >
                    Marcar revisada
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {modulosConAprobacion.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-bold text-slate-700">Aprobaciones pendientes de los agentes</h3>
          {modulosConAprobacion.map((m) => (
            <ModuleAgentGovernanceHeader key={m} moduloId={m} empresaId={empresaId} onOperationExecuted={() => load()} />
          ))}
        </div>
      )}

      <div className="pt-3 border-t border-slate-100 space-y-2">
        <div className="flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-indigo-700" />
          <h3 className="text-xs font-bold text-slate-800">Tareas programadas</h3>
        </div>
        {!despachador.activo && (
          <p className="text-[11px] text-slate-500">
            El despachador automático está apagado en el servidor (AGENT_SCHEDULER_ENABLED). Las tareas solo se ejecutan con
            «Ejecutar ahora».
          </p>
        )}
        {tasks.length === 0 ? (
          <p className="text-xs text-slate-500">No tiene acceso a módulos con tareas programables.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-100">
                  <th className="py-1.5 pr-3 font-semibold">Tarea</th>
                  <th className="py-1.5 pr-3 font-semibold">Frecuencia</th>
                  <th className="py-1.5 pr-3 font-semibold">Próxima</th>
                  <th className="py-1.5 pr-3 font-semibold">Última</th>
                  <th className="py-1.5 pr-3 font-semibold">Activa</th>
                  <th className="py-1.5 font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => {
                  const s = schedules.find((x) => x.tareaId === t.id);
                  return (
                    <tr key={t.id} className="border-b border-slate-50 align-top">
                      <td className="py-2 pr-3">
                        <div className="font-semibold text-slate-800">{t.nombre}</div>
                        <div className="text-[11px] text-slate-500">{t.descripcion}</div>
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap">{frecuenciaTexto(s?.frecuencia || t.frecuenciaPorDefecto)}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">{s?.activo ? fechaCL(s.proximaEjecucion) : '—'}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">
                        {s?.ultimaEjecucion ? `${fechaCL(s.ultimaEjecucion)} · ${ESTADO_LABEL[s.ultimoEstado || ''] || s.ultimoEstado}` : '—'}
                      </td>
                      <td className="py-2 pr-3">
                        <input
                          type="checkbox"
                          aria-label={`Activar ${t.nombre}`}
                          checked={Boolean(s?.activo)}
                          disabled={busy === t.id}
                          onChange={(e) => toggle(t, e.target.checked)}
                          className="cursor-pointer"
                        />
                      </td>
                      <td className="py-2">
                        <button
                          type="button"
                          disabled={busy === t.id}
                          onClick={() => ejecutarAhora(t)}
                          className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 cursor-pointer whitespace-nowrap"
                        >
                          {busy === t.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                          Ejecutar ahora
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {schedules.some((s) => s.ultimoEstado === 'PROPUESTA_CREADA') && (
          <p className="text-[11px] text-emerald-700 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Las propuestas de los agentes se aplican solo cuando un responsable las aprueba.
          </p>
        )}
      </div>
    </div>
  );
};
