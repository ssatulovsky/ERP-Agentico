import { Router, Request, Response } from 'express';
import {
  buildAgentPromptContext,
} from '../services/agentContextBuilderService';
import {
  recordAgentCorrection,
  listLearnings,
  upsertCompanyAgentConfig,
  getCompanyAgentConfig,
} from '../services/agentLearningFeedbackService';
import {
  superviseAndValidateAgentOutput,
} from '../agents/orchestratorSupervisorAgent';
import { type AgentModuleCode, type LearningCategory } from '../db/mysqlSchema';

export const agentGovernanceRouter = Router();

// ============================================================================
// 1. ENDPOINTS DE CONFIGURACIÓN Y DIRECTIVAS AD-HOC (CAPA 3)
// ============================================================================

/**
 * GET /api/governance/configs/:empresaId/:modulo
 * Obtiene la directiva especial configurada para la empresa y módulo
 */
agentGovernanceRouter.get(
  '/configs/:empresaId/:modulo',
  async (req: Request, res: Response) => {
    try {
      const { empresaId, modulo } = req.params;
      const config = await getCompanyAgentConfig(empresaId, modulo as AgentModuleCode);

      if (!config) {
        return res.json({
          status: 'ok',
          data: {
            empresaId,
            moduloCodigo: modulo,
            instruccionesEspeciales: 'Sin directivas ad-hoc personalizadas.',
            parametrosOperativos: {},
            activo: true,
          },
        });
      }

      return res.json({ status: 'ok', data: config });
    } catch (err: any) {
      return res.status(500).json({ status: 'error', message: err.message });
    }
  }
);

/**
 * POST /api/governance/configs
 * Guarda o actualiza las directivas ad-hoc de una empresa
 */
agentGovernanceRouter.post('/configs', async (req: Request, res: Response) => {
  try {
    const { empresaId, moduloCodigo, instruccionesEspeciales, parametrosOperativos, activo } = req.body;

    if (!empresaId || !moduloCodigo) {
      return res.status(400).json({
        status: 'error',
        message: 'empresaId y moduloCodigo son obligatorios.',
      });
    }

    const saved = await upsertCompanyAgentConfig({
      empresaId,
      moduloCodigo: moduloCodigo as AgentModuleCode,
      instruccionesEspeciales,
      parametrosOperativos,
      activo: activo !== undefined ? Boolean(activo) : true,
    });

    return res.json({
      status: 'ok',
      message: 'Directiva especial configurada exitosamente.',
      data: saved,
    });
  } catch (err: any) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// ============================================================================
// 2. ENDPOINTS DE APRENDIZAJES Y MEMORIA (CAPA 4)
// ============================================================================

/**
 * GET /api/governance/learnings
 * Lista los aprendizajes y casos prevenidos
 */
agentGovernanceRouter.get('/learnings', async (req: Request, res: Response) => {
  try {
    const { empresaId, moduloCodigo, activoOnly } = req.query;

    const learnings = await listLearnings({
      empresaId: empresaId as string | undefined,
      moduloCodigo: moduloCodigo as AgentModuleCode | undefined,
      activoOnly: activoOnly !== undefined ? activoOnly === 'true' : true,
    });

    return res.json({
      status: 'ok',
      total: learnings.length,
      data: learnings,
    });
  } catch (err: any) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

/**
 * POST /api/governance/learnings
 * Registra una corrección del contador o incidente en la Base de Conocimiento
 */
agentGovernanceRouter.post('/learnings', async (req: Request, res: Response) => {
  try {
    const { empresaId, modulo, categoria, error, solucion, incorrecto, corregido } = req.body;

    if (!modulo || !categoria || !error || !solucion) {
      return res.status(400).json({
        status: 'error',
        message: 'modulo, categoria, error y solucion son campos obligatorios.',
      });
    }

    const newLearning = await recordAgentCorrection({
      empresaId: empresaId || null,
      modulo: modulo as AgentModuleCode,
      categoria: categoria as LearningCategory,
      error,
      solucion,
      incorrecto,
      corregido,
    });

    return res.status(201).json({
      status: 'ok',
      message: 'Aprendizaje pericial registrado exitosamente.',
      data: newLearning,
    });
  } catch (err: any) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// ============================================================================
// 3. ENDPOINTS DE CONTEXTO JERÁRQUICO EN 4 CAPAS Y SUPERVISIÓN
// ============================================================================

/**
 * POST /api/governance/build-context
 * Ensambla el System Instruction canónico en 4 capas para cualquier agente
 */
agentGovernanceRouter.post('/build-context', async (req: Request, res: Response) => {
  try {
    const { empresaId, moduloCodigo, tareaEspecifica } = req.body;

    if (!empresaId || !moduloCodigo || !tareaEspecifica) {
      return res.status(400).json({
        status: 'error',
        message: 'empresaId, moduloCodigo y tareaEspecifica son requeridos.',
      });
    }

    const context = await buildAgentPromptContext({
      empresaId,
      moduloCodigo: moduloCodigo as AgentModuleCode,
      tareaEspecifica,
    });

    return res.json({
      status: 'ok',
      data: context,
    });
  } catch (err: any) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

/**
 * POST /api/governance/supervise
 * Orquestador Gatekeeper: Supervisa, valida y firma la propuesta del agente
 */
agentGovernanceRouter.post('/supervise', async (req: Request, res: Response) => {
  try {
    const { empresaId, modulo, proposedResult, contextUsed } = req.body;

    if (!empresaId || !modulo || !proposedResult) {
      return res.status(400).json({
        status: 'error',
        message: 'empresaId, modulo y proposedResult son obligatorios.',
      });
    }

    const verdict = await superviseAndValidateAgentOutput({
      empresaId,
      modulo: modulo as AgentModuleCode,
      proposedResult,
      contextUsed: contextUsed || {},
    });

    return res.json({
      status: 'ok',
      data: verdict,
    });
  } catch (err: any) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
});
