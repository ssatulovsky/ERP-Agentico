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
import { HrManagementService } from '../services/hrManagementService';
import {
  type AuthenticatedRequest,
  requireCompanyAccess,
  requireApprovalPermission,
  normalizeCompanyKey,
} from '../middlewares/authMiddleware';

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

// ============================================================================
// 4. ENDPOINTS DE BANDEJA DE APROBACIÓN HUMANA (HUMAN-IN-THE-LOOP REAL)
// ============================================================================

/**
 * GET /api/governance/approvals
 * Lista solicitudes de aprobación humana con aislamiento estricto por empresa y módulo.
 * Exige autorización sobre la empresa consultada.
 */
agentGovernanceRouter.get('/approvals', async (req: Request, res: Response) => {
  try {
    const authUser = (req as AuthenticatedRequest).user;
    const queryEmpresaId = req.effectiveEmpresaId || (req.query.empresaId as string) || '';
    const modulo = req.query.modulo as any;
    const estado = req.query.estado as string | undefined;

    // 1. Si se especificó una empresa en la consulta, validar permisos multi-tenant
    if (queryEmpresaId) {
      const accessCheck = requireCompanyAccess(req, queryEmpresaId);
      if (!accessCheck.allowed) {
        return res.status(403).json({
          status: 'error',
          success: false,
          error: 'ACCESO_DENEGADO_EMPRESA',
          message: accessCheck.reason,
        });
      }
    }

    // 2. Determinar empresa efectiva o listar solo las permitidas
    const targetEmpresaId = queryEmpresaId || (authUser?.isSuperAdmin ? '' : authUser?.empresaPrincipalId || '');
    let approvals = HrManagementService.getApprovals(targetEmpresaId, modulo);

    // 3. Filtro perimetral: si el usuario no es SuperAdmin, jamás retornar aprobaciones de empresas ajenas
    if (!authUser?.isSuperAdmin && authUser?.empresasPermitidas) {
      const normPermitidas = authUser.empresasPermitidas.map(normalizeCompanyKey);
      approvals = approvals.filter((a) => normPermitidas.includes(normalizeCompanyKey(a.empresaId)));
    }

    if (estado) {
      approvals = approvals.filter((a) => a.estado === estado);
    }

    return res.json({
      status: 'ok',
      success: true,
      total: approvals.length,
      data: approvals,
    });
  } catch (err: any) {
    return res.status(500).json({ status: 'error', success: false, message: err.message });
  }
});

/**
 * POST /api/governance/approvals/:id/resolve
 * Resuelve una solicitud de aprobación humana (Aprobar o Rechazar).
 * SEGURIDAD CRÍTICA:
 * - Valida que el usuario pertenezca a la empresa de la solicitud.
 * - Valida que el usuario posea un rol con facultades formales de Aprobador (Admin / SuperAdmin).
 * - Identidad del aprobador extraída obligatoriamente de la sesión JWT/servidor (resueltoPor ignorado desde payload).
 */
agentGovernanceRouter.post('/approvals/:id/resolve', async (req: Request, res: Response) => {
  try {
    const authUser = (req as AuthenticatedRequest).user;
    if (!authUser) {
      return res.status(401).json({
        status: 'error',
        success: false,
        error: 'AUTH_REQUIRED',
        message: 'Se requiere sesión autenticada para resolver aprobaciones de gobernanza.',
      });
    }

    const { id } = req.params;
    let isApproved = req.body.approved;
    if (isApproved === undefined && typeof req.body.action === 'string') {
      const act = req.body.action.toUpperCase();
      if (act === 'APROBAR' || act === 'APPROVE') isApproved = true;
      if (act === 'RECHAZAR' || act === 'REJECT') isApproved = false;
    }

    if (isApproved === undefined) {
      return res.status(400).json({
        status: 'error',
        success: false,
        message: 'El campo "approved" (booleano) o "action" ("APROBAR" / "RECHAZAR") es obligatorio.',
      });
    }

    // 1. Obtener la solicitud del servidor
    const targetApproval = HrManagementService.getApprovalById(id);
    if (!targetApproval) {
      return res.status(404).json({
        status: 'error',
        success: false,
        error: 'SOLICITUD_NO_ENCONTRADA',
        message: `No se encontró la solicitud de aprobación #${id}.`,
      });
    }

    // 2. Verificar que la solicitud siga pendiente (idempotencia y prevención de doble ejecución)
    if (targetApproval.estado !== 'PENDIENTE') {
      return res.status(409).json({
        status: 'error',
        success: false,
        error: 'SOLICITUD_YA_RESUELTA',
        message: `La solicitud de aprobación #${id} ya fue resuelta previamente con estado "${targetApproval.estado}". No se permite su re-ejecución.`,
      });
    }

    // 3. Control de acceso multi-tenant estricto: ¿El usuario pertenece a la empresa de la solicitud?
    const compCheck = requireCompanyAccess(req, targetApproval.empresaId);
    if (!compCheck.allowed) {
      return res.status(403).json({
        status: 'error',
        success: false,
        error: 'ACCESO_DENEGADO_EMPRESA',
        message: compCheck.reason,
      });
    }

    // 3. Control de rol y atribuciones: ¿El usuario tiene rol aprobador?
    const permCheck = requireApprovalPermission(req, targetApproval);
    if (!permCheck.allowed) {
      return res.status(403).json({
        status: 'error',
        success: false,
        error: 'ROL_NO_AUTORIZADO_APROBACION',
        message: permCheck.reason,
      });
    }

    // 4. Identidad fidedigna inmutable del aprobador: tomada de la sesión autenticada, nunca del payload
    const officialApprover = `${authUser.nombreCompleto} (${authUser.cargo} - @${authUser.username})`;

    const resolved = await HrManagementService.resolveApproval(
      id,
      officialApprover,
      Boolean(isApproved)
    );

    return res.json({
      status: 'ok',
      success: true,
      message: isApproved ? 'Operación aprobada y procesada formalmente en el servidor.' : 'Operación rechazada.',
      data: resolved,
    });
  } catch (err: any) {
    return res.status(500).json({ status: 'error', success: false, message: err.message });
  }
});

/**
 * POST /api/governance/request-approval
 * Registra una nueva solicitud de aprobación agéntica en el servidor.
 * Valida que la empresa de la solicitud esté dentro de las empresas asignadas al usuario.
 */
agentGovernanceRouter.post('/request-approval', async (req: Request, res: Response) => {
  try {
    const authUser = (req as AuthenticatedRequest).user;
    const {
      empresaId,
      modulo,
      agenteNombre,
      operacionTipo,
      titulo,
      descripcion,
      datosOperacion,
      impactoFinancieroClp,
      impactoFinanciero,
      nivelRiesgo,
      riesgoNivel,
    } = req.body;

    if (!empresaId || !modulo || !operacionTipo || !titulo) {
      return res.status(400).json({
        status: 'error',
        success: false,
        message: 'empresaId, modulo, operacionTipo y titulo son campos requeridos.',
      });
    }

    // Control multi-tenant estricto: ¿El usuario puede solicitar operaciones para esta empresa?
    if (authUser) {
      const compCheck = requireCompanyAccess(req, empresaId);
      if (!compCheck.allowed) {
        return res.status(403).json({
          status: 'error',
          success: false,
          error: 'ACCESO_DENEGADO_EMPRESA',
          message: compCheck.reason,
        });
      }
    }

    const solicitadoPor = authUser
      ? `${authUser.nombreCompleto} (@${authUser.username})`
      : 'Asistente especialista con herramientas';

    const approval = HrManagementService.requestModuleApproval({
      empresaId,
      modulo,
      agenteNombre: agenteNombre || 'Agente Especialista',
      operacionTipo,
      titulo,
      descripcion: descripcion || '',
      datosOperacion: datosOperacion || {},
      impactoFinancieroClp: Number(impactoFinancieroClp ?? impactoFinanciero ?? 0),
      impactoFinanciero: Number(impactoFinancieroClp ?? impactoFinanciero ?? 0),
      nivelRiesgo: nivelRiesgo || riesgoNivel || 'MEDIO',
      riesgoNivel: nivelRiesgo || riesgoNivel || 'MEDIO',
      solicitadoPor,
      solicitadoPorUserId: authUser?.userId,
    });

    return res.status(201).json({
      status: 'ok',
      success: true,
      message: 'Solicitud de aprobación agéntica registrada en el servidor.',
      data: approval,
    });
  } catch (err: any) {
    return res.status(500).json({ status: 'error', success: false, message: err.message });
  }
});

