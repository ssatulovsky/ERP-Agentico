/**
 * 3.3 API de ejecuciones programadas de agentes.
 *
 *   GET  /api/agents/schedules            catálogo de tareas, programaciones y estado del despachador
 *   PUT  /api/agents/schedules            crea o actualiza la programación de una tarea
 *   POST /api/agents/schedules/:id/run    ejecuta ahora la tarea de una programación
 *   GET  /api/agents/schedules/runs       historial de ejecuciones
 *   GET  /api/agents/schedules/alerts     3.4 alertas para el responsable (panel del dashboard)
 *   POST /api/agents/schedules/alerts/:id/read  marca una alerta como leída
 *
 * La empresa la valida el middleware central (A1); aquí se exige además el módulo del agente
 * dueño de cada tarea, de modo que un usuario solo ve y opera las tareas de sus módulos.
 */
import { Router, type Request, type Response } from 'express';
import { userHasModuleAccess, type CanonicalModule } from '../middlewares/centralizedAuthorizationMiddleware';
import { requireCompanyAccess } from '../middlewares/authMiddleware';
import {
  agentSchedulerService,
  getScheduledTask,
  isSchedulerEnabled,
} from '../services/agentSchedulerService';
import { agentAlertService } from '../services/agentAlertService';

export const agentSchedulesRouter = Router();

/** Módulo de permisos (RBAC) de cada agente. FACTURACION_DTE se autoriza como TRIBUTARIO_SII. */
function canonicalModuleFor(modulo: string): CanonicalModule {
  return (modulo === 'FACTURACION_DTE' ? 'TRIBUTARIO_SII' : modulo) as CanonicalModule;
}

function authUserOf(req: Request, res: Response): any | null {
  const user = (req as any).user;
  if (!user) {
    res.status(401).json({ success: false, error: 'AUTH_REQUIRED', errorMessage: 'Autenticación requerida.' });
    return null;
  }
  return user;
}

function empresaOf(req: Request): string {
  return String((req as any).effectiveEmpresaId || req.query.empresaId || req.body?.empresaId || '');
}

agentSchedulesRouter.get('/', (req: Request, res: Response) => {
  const user = authUserOf(req, res);
  if (!user) return;
  const empresaId = empresaOf(req);
  const allowed = (modulo: string) => userHasModuleAccess(user, canonicalModuleFor(modulo));
  res.json({
    success: true,
    empresaId,
    despachadorActivo: agentSchedulerService.isRunning(),
    despachadorHabilitado: isSchedulerEnabled(),
    tareas: agentSchedulerService.listTasks().filter((t) => allowed(t.modulo)),
    programaciones: agentSchedulerService.listSchedules(empresaId).filter((s) => allowed(s.modulo)),
  });
});

agentSchedulesRouter.get('/runs', (req: Request, res: Response) => {
  const user = authUserOf(req, res);
  if (!user) return;
  const empresaId = empresaOf(req);
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
  const runs = agentSchedulerService
    .listRuns({ empresaId, limit: 1000 })
    .filter((r) => userHasModuleAccess(user, canonicalModuleFor(r.modulo)))
    .slice(0, limit);
  res.json({ success: true, empresaId, ejecuciones: runs });
});

agentSchedulesRouter.put('/', (req: Request, res: Response) => {
  const user = authUserOf(req, res);
  if (!user) return;
  const empresaId = empresaOf(req);
  const { tareaId, activo, frecuencia, responsable } = req.body || {};
  const task = getScheduledTask(String(tareaId || ''));
  if (!task) {
    return res.status(400).json({ success: false, error: 'TASK_UNKNOWN', errorMessage: `Tarea desconocida: ${tareaId}` });
  }
  if (!userHasModuleAccess(user, canonicalModuleFor(task.modulo))) {
    return res.status(403).json({ success: false, error: 'MODULO_NO_PERMITIDO', errorMessage: `Sin acceso al módulo ${task.modulo}.` });
  }
  if (activo !== undefined && typeof activo !== 'boolean') {
    return res.status(400).json({ success: false, error: 'INVALID_PARAMS', errorMessage: 'activo debe ser booleano.' });
  }
  try {
    const schedule = agentSchedulerService.upsertSchedule({
      empresaId,
      tareaId: task.id,
      activo,
      frecuencia,
      responsable,
      usuarioId: user.userId,
    });
    res.json({ success: true, programacion: schedule });
  } catch (e: any) {
    res.status(400).json({ success: false, error: e.code || 'INVALID_PARAMS', errorMessage: e.message });
  }
});

agentSchedulesRouter.post('/:id/run', async (req: Request, res: Response) => {
  const user = authUserOf(req, res);
  if (!user) return;
  const schedule = agentSchedulerService.getSchedule(String(req.params.id));
  if (!schedule) {
    return res.status(404).json({ success: false, error: 'NOT_FOUND', errorMessage: 'Programación no encontrada.' });
  }
  const comp = requireCompanyAccess(req, schedule.empresaId);
  if (!comp.allowed) {
    return res.status(403).json({ success: false, error: 'ACCESO_EMPRESA_DENEGADO', errorMessage: comp.reason });
  }
  if (!userHasModuleAccess(user, canonicalModuleFor(schedule.modulo))) {
    return res.status(403).json({ success: false, error: 'MODULO_NO_PERMITIDO', errorMessage: `Sin acceso al módulo ${schedule.modulo}.` });
  }
  try {
    const run = await agentSchedulerService.runScheduleNow(schedule.id, user.userId);
    // La ejecución en sí terminó; su resultado (incluido un error de la tarea) va en "ejecucion".
    res.json({ success: run.estado !== 'ERROR', ejecucion: run });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.code || 'RUN_FAILED', errorMessage: e.message });
  }
});

agentSchedulesRouter.get('/alerts', (req: Request, res: Response) => {
  const user = authUserOf(req, res);
  if (!user) return;
  const empresaId = empresaOf(req);
  const soloNoLeidas = String(req.query.soloNoLeidas || '') === 'true';
  const alertas = agentAlertService
    .list({ empresaId, soloNoLeidas, limit: 500 })
    .filter((a) => userHasModuleAccess(user, canonicalModuleFor(a.modulo)))
    .slice(0, 100);
  res.json({ success: true, empresaId, noLeidas: alertas.filter((a) => !a.leidaEn).length, alertas });
});

agentSchedulesRouter.post('/alerts/:id/read', (req: Request, res: Response) => {
  const user = authUserOf(req, res);
  if (!user) return;
  const alert = agentAlertService.get(String(req.params.id));
  if (!alert) return res.status(404).json({ success: false, error: 'NOT_FOUND', errorMessage: 'Alerta no encontrada.' });
  const comp = requireCompanyAccess(req, alert.empresaId);
  if (!comp.allowed) return res.status(403).json({ success: false, error: 'ACCESO_EMPRESA_DENEGADO', errorMessage: comp.reason });
  if (!userHasModuleAccess(user, canonicalModuleFor(alert.modulo))) {
    return res.status(403).json({ success: false, error: 'MODULO_NO_PERMITIDO', errorMessage: `Sin acceso al módulo ${alert.modulo}.` });
  }
  res.json({ success: true, alerta: agentAlertService.markRead(alert.id, user.userId) });
});
