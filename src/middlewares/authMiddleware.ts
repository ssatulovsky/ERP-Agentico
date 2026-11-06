import type { Request, Response, NextFunction } from 'express';
import { getSessionByToken } from '../controllers/authController';
import { whatsappBridgeService } from '../services/whatsappBridgeService';
import { resolveAllowedCompanyIdsForUser, ALL_ERP_MODULE_IDS } from '../services/securityRbacService';
import type { ModuleAgentApprovalRequest } from '../types';

/**
 * Rutas públicas exentas de autenticación Bearer
 */
const PUBLIC_API_ROUTES = [
  '/api/auth/login',
  '/api/health',
  '/api/indicators',
];

export interface AuthenticatedUserContext {
  token: string;
  userId: string;
  username: string;
  nombreCompleto: string;
  cargo: string;
  empresaPrincipalId: string;
  empresasPermitidas: string[];
  roleId: string;
  roleCodigo: string;
  roleTipo: 'SUPERADMIN' | 'ADMIN' | 'CUSTOM';
  modulosPermitidos: string[];
  isSuperAdmin: boolean;
  isAdmin: boolean;
  debeCambiarPassword?: boolean;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUserContext;
  effectiveEmpresaId?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUserContext;
      effectiveEmpresaId?: string;
    }
  }
}

/**
 * Normaliza identificadores de empresa/RUT para comparaciones multi-tenant consistentes
 */
export function normalizeCompanyKey(idOrRut?: string): string {
  return (idOrRut || '').replace(/[\.\-\s]/g, '').trim().toUpperCase();
}

/**
 * Verifica si el usuario autenticado tiene permiso para operar o consultar una empresa específica
 */
export function requireCompanyAccess(req: Request, targetEmpresaId?: string): { allowed: boolean; reason?: string } {
  const authReq = req as AuthenticatedRequest;
  if (!authReq.user) {
    return { allowed: false, reason: 'Usuario no autenticado en el servidor.' };
  }
  const user = authReq.user;

  // 1. SuperAdmin tiene acceso global a todas las empresas
  if (user.isSuperAdmin) {
    return { allowed: true };
  }

  // 2. Si no se especificó empresa, opera sobre su empresa principal
  if (!targetEmpresaId) {
    return { allowed: true };
  }

  // 3. Verificar membresía en la lista de empresas permitidas (principal + anclas)
  const normTarget = normalizeCompanyKey(targetEmpresaId);
  const hasAccess = user.empresasPermitidas.some(
    (emp) => normalizeCompanyKey(emp) === normTarget
  );

  if (!hasAccess) {
    return {
      allowed: false,
      reason: `Violación de aislamiento multi-tenant: El usuario '${user.username}' no tiene autorización para operar o consultar la empresa '${targetEmpresaId}'. Empresas permitidas: [${user.empresasPermitidas.join(', ')}].`,
    };
  }

  return { allowed: true };
}

/**
 * Verifica si el usuario autenticado tiene facultades formales de Aprobador Humano para una solicitud
 */
export function requireApprovalPermission(
  req: Request,
  approval: ModuleAgentApprovalRequest
): { allowed: boolean; reason?: string } {
  const authReq = req as AuthenticatedRequest;
  if (!authReq.user) {
    return { allowed: false, reason: 'Usuario no autenticado.' };
  }
  const user = authReq.user;

  // 1. Verificación estricta de aislamiento de empresa
  const compCheck = requireCompanyAccess(req, approval.empresaId);
  if (!compCheck.allowed) {
    return compCheck;
  }

  // 2. Umbral de aprobación financiera (Parte C):
  // Si el impacto financiero excede el umbral configurable de la empresa (default $5.000.000 CLP),
  // se requiere obligatoriamente rol Administrador o SuperAdmin.
  const dp = (globalThis as any).__diskPersistence;
  const companyProfile = dp && typeof dp.getClient === 'function' ? dp.getClient(approval.empresaId) : null;
  const umbralEmpresa = Number(companyProfile?.umbralAprobacionClp || companyProfile?.umbralFinancieroDirectorio || 5000000);
  const impacto = Number(approval.impactoFinancieroClp || approval.impactoFinanciero || 0);

  if (impacto > umbralEmpresa && !user.isAdmin && !user.isSuperAdmin) {
    return {
      allowed: false,
      reason: `Umbral de Aprobación Financiera Excedido: La operación involucra $${impacto.toLocaleString('es-CL')} CLP, superando el umbral de autorización de la empresa ($${umbralEmpresa.toLocaleString('es-CL')} CLP). Se requiere obligatoriamente rol de Administrador o SuperAdmin para autorizar este monto.`,
    };
  }

  // 3. SuperAdmin tiene facultades de gobernanza plenipotenciarias
  if (user.isSuperAdmin) {
    return { allowed: true };
  }

  // 4. Administrador de empresa (Gerente General / Director)
  if (user.isAdmin) {
    return { allowed: true };
  }

  // 5. Jefes de área autorizados en su respectivo módulo si el monto no supera el umbral
  const modulos = user.modulosPermitidos || [];
  const esAprobadorModulo = modulos.includes(approval.modulo) && (
    (user.roleCodigo || '').toUpperCase().includes('JEFE') ||
    (user.cargo || '').toLowerCase().includes('jefe') ||
    (user.cargo || '').toLowerCase().includes('director') ||
    (user.cargo || '').toLowerCase().includes('gerente')
  );
  if (esAprobadorModulo && impacto <= umbralEmpresa) {
    return { allowed: true };
  }

  // 6. Los roles operativos (Compras, Bodega, Asistente) NO pueden aprobar solicitudes
  return {
    allowed: false,
    reason: `Privilegios de Gobernanza insuficientes: El rol '${user.roleCodigo}' del usuario '${user.username}' carece de facultades de Aprobador Humano. Solo Administradores, Gerentes Generales o SuperAdmin pueden autorizar o rechazar solicitudes de gobernanza.`,
  };
}

/**
 * Middleware central de autenticación y control de acceso RBAC para todas las rutas /api
 */
export function authenticateApiToken(req: Request, res: Response, next: NextFunction) {
  const urlPath = (req.originalUrl || req.path || '').split('?')[0];

  // 1. Permitir rutas no-API (frontend Vite, estáticos) o rutas públicas exentas
  if (!urlPath.startsWith('/api') || PUBLIC_API_ROUTES.some(pub => urlPath === pub || urlPath.startsWith(pub + '/'))) {
    return next();
  }

  // 2. Extraer cabecera de autorización Bearer
  const authHeader = req.headers.authorization;
  const tokenFromCustomHeader = typeof req.headers['x-auth-token'] === 'string' ? req.headers['x-auth-token'] : undefined;
  
  // Soporte seguro para Server-Sent Events (SSE / EventSource)
  const isSseRequest = req.headers.accept?.includes('text/event-stream') || urlPath.includes('/stream') || urlPath.includes('/sse');
  const tokenFromQuery = (isSseRequest && typeof req.query?.token === 'string') ? req.query.token : undefined;

  const tokenCandidate = authHeader 
    ? authHeader.replace(/^Bearer\s+/i, '').trim() 
    : (tokenFromCustomHeader || tokenFromQuery);

  if (!tokenCandidate) {
    return res.status(401).json({
      success: false,
      error: 'AUTH_REQUIRED',
      errorMessage: `Acceso restringido: Se requiere autenticación Bearer token para acceder a ${req.method} ${urlPath}.`,
    });
  }

  // 3. Validar sesión activa en servidor
  const session = getSessionByToken(tokenCandidate);
  if (!session) {
    return res.status(401).json({
      success: false,
      error: 'INVALID_OR_EXPIRED_TOKEN',
      errorMessage: 'Token de sesión expirado o inválido. Por favor autentíquese nuevamente.',
    });
  }

  // 4. Cargar perfil de seguridad y rol actualizado desde el almacén RBAC
  const state = whatsappBridgeService.getRbacState();
  const matchedUser = (state.users || []).find((u) => u.id === session.userId);
  const matchedRole = (state.roles || []).find((r) => r.id === (session.roleId || matchedUser?.rolId));

  if (!matchedUser || matchedUser.estado !== 'ACTIVO') {
    return res.status(403).json({
      success: false,
      error: 'USUARIO_INACTIVO_O_ELIMINADO',
      errorMessage: 'El usuario asociado a este token se encuentra inactivo o fue revocado.',
    });
  }

  const roleTipo = matchedRole?.tipoSistema || (matchedUser.rolId === 'role-superadmin' ? 'SUPERADMIN' : 'CUSTOM');
  const isSuperAdmin = roleTipo === 'SUPERADMIN' || matchedUser.rolId === 'role-superadmin';
  const isAdmin = isSuperAdmin || roleTipo === 'ADMIN' || matchedUser.rolId === 'role-admin';

  const empresasPermitidas = resolveAllowedCompanyIdsForUser(
    matchedUser,
    matchedRole || {
      id: matchedUser.rolId,
      nombre: 'Rol',
      codigo: 'CUSTOM',
      tipoSistema: roleTipo,
      empresaScopeId: 'GLOBAL',
      descripcion: '',
      modulosPermitidos: [],
      whatsappScopesPermitidos: [],
      esEditable: true,
      creadoPor: 'SYSTEM',
      fechaActualizacion: '2026-01-01',
    },
    state.companiesConfig,
    session.empresaId
  );

  const modulosPermitidos = isSuperAdmin || isAdmin
    ? [...ALL_ERP_MODULE_IDS]
    : (matchedRole?.modulosPermitidos || []);

  const userContext: AuthenticatedUserContext = {
    token: tokenCandidate,
    userId: matchedUser.id,
    username: matchedUser.username,
    nombreCompleto: matchedUser.nombreCompleto,
    cargo: matchedUser.cargo,
    empresaPrincipalId: session.empresaId || matchedUser.empresaPrincipalId,
    empresasPermitidas,
    roleId: matchedRole?.id || matchedUser.rolId,
    roleCodigo: matchedRole?.codigo || 'CUSTOM',
    roleTipo,
    modulosPermitidos,
    isSuperAdmin,
    isAdmin,
    debeCambiarPassword: Boolean(matchedUser.debeCambiarPassword),
  };

  (req as AuthenticatedRequest).user = userContext;
  next();
}
