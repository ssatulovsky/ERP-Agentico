import { Router, type Request, type Response } from 'express';
import { AutonomousAgentEngine, type AutonomousAgentRequest } from '../services/autonomousAgentEngine';
import { executionModeLabel, withExecutionModeTag } from '../utils/executionModeLabel';

export const autonomousAgentsRouter = Router();

/**
 * POST /api/agents/autonomous/execute
 * Ejecuta el bucle ReAct del Asistente con herramientas con Function Calling real en el backend
 */
autonomousAgentsRouter.post('/execute', async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).user;
    if (!authUser) {
      return res.status(401).json({
        success: false,
        error: 'AUTH_REQUIRED',
        errorMessage: 'Autenticación requerida para ejecutar el asistente con herramientas.',
      });
    }

    const rawEmpresaId = req.effectiveEmpresaId || (req as any).effectiveEmpresaId || authUser.empresaPrincipalId;
    if (!rawEmpresaId) {
      return res.status(400).json({
        success: false,
        error: 'DATOS_INCOMPLETOS',
        errorMessage: 'Debe especificar empresaId para invocar al asistente con herramientas.',
      });
    }

    // Validación multi-tenant A1
    const { requireCompanyAccess } = await import('../middlewares/authMiddleware');
    const compCheck = requireCompanyAccess(req, String(rawEmpresaId));
    if (!compCheck.allowed) {
      return res.status(403).json({
        success: false,
        error: 'ACCESO_EMPRESA_DENEGADO',
        errorMessage: compCheck.reason,
      });
    }

    const rawModule = req.body.module || req.body.modulo;
    const rawQuery = req.body.query || req.body.prompt;
    let rawContext = req.body.context || req.body.contextData || {};

    if (!rawModule || !rawQuery) {
      return res.status(400).json({
        success: false,
        error: 'DATOS_INCOMPLETOS',
        errorMessage: 'Debe especificar module (o modulo) y query (o prompt) para invocar al asistente con herramientas.',
      });
    }

    // Aislamiento de contexto A5: Si el context trae datos de otra empresa, se descartan
    if (rawContext && typeof rawContext === 'object') {
      const normTarget = String(rawEmpresaId).replace(/[\.\-\s]/g, '').toUpperCase();
      if (rawContext.empresa) {
        const normContextEmp = (rawContext.empresa.id || rawContext.empresa.rut || '').replace(/[\.\-\s]/g, '').toUpperCase();
        if (normContextEmp && normContextEmp !== normTarget) {
          rawContext = { ...rawContext, empresa: { id: rawEmpresaId, rut: rawEmpresaId } };
        }
      }
      if (rawContext.company) {
        const normContextComp = (rawContext.company.id || rawContext.company.rut || '').replace(/[\.\-\s]/g, '').toUpperCase();
        if (normContextComp && normContextComp !== normTarget) {
          rawContext = { ...rawContext, company: { id: rawEmpresaId, rut: rawEmpresaId } };
        }
      }
    }

    const agentRole = req.body.agentRole || req.body.rol || 'Agente Especialista ERPremIA';

    const agentRequest: AutonomousAgentRequest = {
      empresaId: String(rawEmpresaId),
      module: String(rawModule).toUpperCase() as any,
      agentRole: String(agentRole),
      query: String(rawQuery),
      context: rawContext,
      userId: authUser.userId,
      // 3.2: historial de la conversación con el agente (el motor lo acota y sanea).
      history: Array.isArray(req.body.history) ? req.body.history : undefined,
    };

    const result = await AutonomousAgentEngine.executeAutonomousAgentLoop(agentRequest);
    const isSuccess = result.success !== false;

    // 2.9: cada respuesta lleva su modo de ejecución visible ("IA + herramientas", "Reglas" o "Demostración")
    const modeLabel = executionModeLabel(result.executionMode, { success: result.success, code: result.code });
    const taggedText = withExecutionModeTag(result.finalText, modeLabel);
    const failureStatus = result.code === 'LLM_UNAVAILABLE' || result.code === 'LLM_EMPTY_RESPONSE' ? 503 : 422;
    res.status(isSuccess ? 200 : failureStatus).json({
      success: isSuccess,
      data: result,
      code: result.code,
      missingParams: result.missingParams,
      error: !isSuccess ? result.code || 'COMPLIANCE_REQUIREMENT_MISSING' : undefined,
      errorMessage: !isSuccess ? taggedText : undefined,
      // Alias de compatibilidad total para todos los componentes del frontend (con la etiqueta de modo)
      finalText: taggedText,
      decision: taggedText,
      executionModeLabel: modeLabel,
      steps: result.steps,
      thoughtTrace: result.steps,
      toolCallsExecuted: (result.steps || []).map(s => s.toolCall),
      approvalRequired: Boolean(result.governanceApproval),
      approvalDetails: result.governanceApproval,
      technicalPayload: result.technicalPayload,
      executionMode: result.executionMode,
    });
  } catch (error: any) {
    console.error('[AutonomousAgentsController] Error en ejecución agéntica:', error);
    res.status(500).json({
      success: false,
      error: 'AGENT_EXECUTION_ERROR',
      errorMessage: error.message || 'Error interno ejecutando bucle del asistente con herramientas.',
    });
  }
});
