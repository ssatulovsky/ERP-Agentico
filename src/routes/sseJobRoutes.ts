import { Router } from 'express';
import { streamJobStatus } from '../controllers/sseJobController';

/**
 * Router de Server-Sent Events (SSE) para el monitoreo en tiempo real
 * del ciclo de vida de tareas y workers de BullMQ.
 *
 * Expone la ruta:
 *   GET /api/jobs/stream/:queueName/:jobId
 */
export const sseJobRouter = Router();

// Ruta estándar montable en /api/jobs/stream/:queueName/:jobId
sseJobRouter.get('/stream/:queueName/:jobId', streamJobStatus);

// Compatibilidad por si el router se monta en prefijo /api/jobs/stream
sseJobRouter.get('/:queueName/:jobId', streamJobStatus);

// Compatibilidad por si el router se monta en la raíz /
sseJobRouter.get('/api/jobs/stream/:queueName/:jobId', streamJobStatus);

export default sseJobRouter;
