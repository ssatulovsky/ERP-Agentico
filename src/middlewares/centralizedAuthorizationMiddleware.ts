import type { Request, Response, NextFunction } from 'express';
import {
  type AuthenticatedRequest,
  type AuthenticatedUserContext,
  requireCompanyAccess,
  normalizeCompanyKey,
} from './authMiddleware';

/**
 * 12 Módulos Canónicos Oficiales de ERPremIA
 */
export type CanonicalModule =
  | 'CONTABILIDAD'
  | 'TRIBUTARIO_SII'
  | 'RRHH'
  | 'INVENTARIO'
  | 'ACTIVO_FIJO'
  | 'COSTOS_PRODUCCION'
  | 'FLUJO_CAJA'
  | 'COMERCIAL_COMPRAS'
  | 'RENDICIONES'
  | 'TESORERIA'
  | 'CONCILIACION'
  | 'ADMIN';

export const CANONICAL_MODULES: CanonicalModule[] = [
  'CONTABILIDAD',
  'TRIBUTARIO_SII',
  'RRHH',
  'INVENTARIO',
  'ACTIVO_FIJO',
  'COSTOS_PRODUCCION',
  'FLUJO_CAJA',
  'COMERCIAL_COMPRAS',
  'RENDICIONES',
  'TESORERIA',
  'CONCILIACION',
  'ADMIN',
];

/**
 * Mapeo bidireccional entre Módulos Canónicos e identificadores de módulo internos (ErpModuleId)
 */
export const CANONICAL_MODULE_ALIASES: Record<CanonicalModule, string[]> = {
  CONTABILIDAD: ['ledger', 'CONTABILIDAD', 'accounting'],
  TRIBUTARIO_SII: ['rcv', 'f29', 'billing_agent', 'TRIBUTARIO_SII', 'sii', 'billing', 'dte'],
  RRHH: ['hr_agent', 'payroll', 'RRHH', 'hr'],
  INVENTARIO: ['inventory', 'INVENTARIO'],
  ACTIVO_FIJO: ['fixed_assets', 'leases', 'ACTIVO_FIJO'],
  COSTOS_PRODUCCION: ['production', 'cost_centers', 'COSTOS_PRODUCCION'],
  FLUJO_CAJA: ['cashflow', 'FLUJO_CAJA'],
  COMERCIAL_COMPRAS: ['commercial_procurement', 'COMERCIAL_COMPRAS', 'procurement', 'compras'],
  RENDICIONES: ['expense_reports', 'expense_mobile', 'RENDICIONES', 'expenses'],
  TESORERIA: ['treasury', 'reconciliation', 'cashflow', 'TESORERIA'],
  CONCILIACION: ['reconciliation', 'CONCILIACION'],
  ADMIN: ['security_admin', 'ADMIN', 'superadmin'],
};

/**
 * Rutas de sesión de autenticación y públicas que no corresponden a un módulo de negocio
 */
export const AUTH_SESSION_EXEMPT_PATHS = [
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/me',
  '/api/auth/change-password',
  '/api/health',
  '/api/indicators',
  '/api/indicators/current',
];

export interface RouteModuleRule {
  prefix: string;
  module: CanonicalModule;
  exact?: boolean;
  superAdminOnly?: boolean;
}

/**
 * Mapa explícito y cerrado de Ruta -> Módulo Canónico
 * Toda ruta no contemplada en este mapa o en AUTH_SESSION_EXEMPT_PATHS
 * será denegada por defecto con HTTP 403.
 */
export const ROUTE_MODULE_MAP: RouteModuleRule[] = [
  // 1. ADMIN (Exclusivo SuperAdmin según A2)
  { prefix: '/api/security/state', module: 'ADMIN', superAdminOnly: true },
  { prefix: '/api/admin', module: 'ADMIN', superAdminOnly: true },
  { prefix: '/api/whatsapp', module: 'ADMIN', superAdminOnly: true },
  { prefix: '/api/persistence', module: 'ADMIN', superAdminOnly: true },
  { prefix: '/api/voice/download-all', module: 'ADMIN', superAdminOnly: true },
  { prefix: '/api/voice/download-voice', module: 'ADMIN', superAdminOnly: true },
  { prefix: '/api/tenancy', module: 'ADMIN' },
  { prefix: '/api/modules/anchor', module: 'ADMIN', superAdminOnly: true },

  // 2. CONTABILIDAD
  { prefix: '/api/accounting', module: 'CONTABILIDAD' },
  { prefix: '/api/accounting/senior-orchestrator', module: 'CONTABILIDAD' },
  { prefix: '/api/accounting/assistant-dialogue', module: 'CONTABILIDAD' },
  { prefix: '/api/gemini/audit-fiscal', module: 'CONTABILIDAD' },

  // 3. TRIBUTARIO_SII
  { prefix: '/api/sii', module: 'TRIBUTARIO_SII' },
  { prefix: '/api/rcv', module: 'TRIBUTARIO_SII' },
  { prefix: '/api/f29', module: 'TRIBUTARIO_SII' },
  { prefix: '/api/billing', module: 'TRIBUTARIO_SII' },
  { prefix: '/api/dte', module: 'TRIBUTARIO_SII' },
  { prefix: '/api/companies', module: 'TRIBUTARIO_SII' },
  { prefix: '/api/modules/f29', module: 'TRIBUTARIO_SII' },

  // 4. RRHH
  { prefix: '/api/payroll', module: 'RRHH' },
  { prefix: '/api/modules/hr', module: 'RRHH' },
  { prefix: '/api/modules/karin', module: 'RRHH' },

  // 5. INVENTARIO
  { prefix: '/api/modules/inventory', module: 'INVENTARIO' },
  { prefix: '/api/modules/warehouse', module: 'INVENTARIO' },
  { prefix: '/api/modules/wms', module: 'INVENTARIO' },

  // 6. ACTIVO_FIJO
  { prefix: '/api/modules/fixed-assets', module: 'ACTIVO_FIJO' },
  { prefix: '/api/modules/leases', module: 'ACTIVO_FIJO' },

  // 7. COSTOS_PRODUCCION
  { prefix: '/api/modules/production', module: 'COSTOS_PRODUCCION' },
  { prefix: '/api/modules/recipes', module: 'COSTOS_PRODUCCION' },
  { prefix: '/api/modules/cost-centers', module: 'COSTOS_PRODUCCION' },

  // 8. FLUJO_CAJA
  { prefix: '/api/modules/cashflow', module: 'FLUJO_CAJA' },

  // 9. COMERCIAL_COMPRAS
  { prefix: '/api/commercial-procurement', module: 'COMERCIAL_COMPRAS' },
  { prefix: '/api/modules/rfq', module: 'COMERCIAL_COMPRAS' },
  { prefix: '/api/modules/quotes', module: 'COMERCIAL_COMPRAS' },

  // 10. RENDICIONES
  { prefix: '/api/expenses', module: 'RENDICIONES' },

  // 11. TESORERIA
  { prefix: '/api/modules/banking/accounts', module: 'TESORERIA' },
  { prefix: '/api/modules/treasury', module: 'TESORERIA' },

  // 12. CONCILIACION
  { prefix: '/api/modules/banking', module: 'CONCILIACION' },
  { prefix: '/api/reconciliation', module: 'CONCILIACION' },
];

/**
 * Determina el Módulo Canónico correspondiente a una URL de la API
 */
export function resolveCanonicalModuleForPath(urlPath: string): RouteModuleRule | null {
  const cleanPath = urlPath.split('?')[0].replace(/\/+$/, '');

  // Reglas más específicas primero (orden decreciente de longitud de prefijo)
  const sortedRules = [...ROUTE_MODULE_MAP].sort((a, b) => b.prefix.length - a.prefix.length);

  for (const rule of sortedRules) {
    if (rule.exact) {
      if (cleanPath === rule.prefix) return rule;
    } else {
      if (cleanPath === rule.prefix || cleanPath.startsWith(rule.prefix + '/')) {
        return rule;
      }
    }
  }

  return null;
}

/**
 * Valida si un usuario posee acceso a un módulo canónico
 */
export function userHasModuleAccess(user: AuthenticatedUserContext, targetModule: CanonicalModule): boolean {
  if (user.isSuperAdmin) {
    return true;
  }

  if (targetModule === 'ADMIN') {
    return false; // Solo SuperAdmin puede acceder a ADMIN
  }

  if (user.isAdmin) {
    return true; // Admin de empresa accede a todos los módulos funcionales de su empresa
  }

  const aliases = CANONICAL_MODULE_ALIASES[targetModule] || [targetModule];
  const userModules = (user.modulosPermitidos || []).map((m) => m.toLowerCase());

  return aliases.some((alias) => userModules.includes(alias.toLowerCase()));
}

export const COMPANY_IDENTIFIER_KEYS = [
  'empresaId',
  'rut',
  'companyId',
  'idOrRut',
  'empresa_id',
  'company_id',
  'id_or_rut',
  'empresaRut',
  'empresa_rut',
  'rutContribuyente',
  'rut_contribuyente',
  'rutEmpresa',
  'rut_empresa',
] as const;

export const ALL_IDENTIFIER_KEYS = [
  ...COMPANY_IDENTIFIER_KEYS,
  'firmId',
  'firm_id',
] as const;

export const COMPANY_HEADER_KEYS = [
  'x-empresa-id',
  'x-company-id',
  'x-firm-id',
  'x-rut',
  'x-idorrut',
  'x-id-or-rut',
] as const;

function isTargetIdentifierKey(key: string): boolean {
  const clean = key.toLowerCase().replace(/\[.*\]$/, '').replace(/\[\]$/, '').trim();
  if (['empresa', 'company', 'companycontext', 'firm', 'firmcontext'].includes(clean)) {
    return false;
  }
  return (
    ALL_IDENTIFIER_KEYS.some((k) => k.toLowerCase() === clean) ||
    clean.includes('empresaid') ||
    clean.includes('companyid') ||
    clean === 'rut' ||
    clean.endsWith('rut') ||
    clean.startsWith('rut')
  );
}

function checkSingleText(val: any, locationName: string, paramName: string): { valid: boolean; reason?: string } {
  if (Array.isArray(val)) {
    return {
      valid: false,
      reason: `El parámetro '${paramName}' en ${locationName} no puede ser una lista ni contener valores repetidos. Debe ser un texto único.`,
    };
  }
  if (val !== null && typeof val === 'object') {
    return {
      valid: false,
      reason: `El parámetro '${paramName}' en ${locationName} no puede ser un objeto. Debe ser un texto único.`,
    };
  }
  if (typeof val !== 'string') {
    return {
      valid: false,
      reason: `El parámetro '${paramName}' en ${locationName} debe ser un texto único (cadena de caracteres).`,
    };
  }
  const trimmed = val.trim();
  if (trimmed.length === 0) {
    return {
      valid: false,
      reason: `El parámetro '${paramName}' en ${locationName} no puede estar vacío. Debe ser un texto único.`,
    };
  }
  if (/[,;|\[\]\n\r]/.test(trimmed)) {
    return {
      valid: false,
      reason: `El parámetro '${paramName}' en ${locationName} no puede contener múltiples valores ni delimitadores. Debe ser un texto único.`,
    };
  }
  return { valid: true };
}

/**
 * Middleware para validar que cualquier identificador de empresa sea estrictamente un texto único.
 * Rechaza con HTTP 400 cualquier valor que sea lista, objeto, vacío, delimitado o repetido/conflictivo.
 */
export function validateCompanyIdentifiers(req: Request, res: Response, next: NextFunction) {
  const urlPath = (req.originalUrl || req.path || '').split('?')[0];
  if (!urlPath.startsWith('/api')) {
    return next();
  }

  // 1. Revisión de parámetros repetidos y corchetes en la URL (raw query string)
  const rawUrl = req.originalUrl || req.url || '';
  const qIndex = rawUrl.indexOf('?');
  if (qIndex !== -1) {
    const searchStr = rawUrl.slice(qIndex + 1);
    const searchParams = new URLSearchParams(searchStr);
    const seenQueryKeys = new Set<string>();
    for (const [k] of searchParams.entries()) {
      const lower = k.toLowerCase();
      if (lower.includes('[') || lower.includes(']')) {
        return res.status(400).json({
          success: false,
          error: 'IDENTIFICADOR_EMPRESA_INVALIDO',
          errorMessage: `Parámetro con formato de lista o corchetes no permitido en query string ('${k}'). Debe ser un texto único.`,
        });
      }
      if (seenQueryKeys.has(lower)) {
        return res.status(400).json({
          success: false,
          error: 'IDENTIFICADOR_EMPRESA_INVALIDO',
          errorMessage: `Parámetro repetido en query string ('${k}'). Todos los parámetros deben ser valores únicos.`,
        });
      }
      seenQueryKeys.add(lower);
    }
  }

  // Colección de todos los valores de identificación de empresa para verificación de consistencia
  const collectedCompanyValues: { source: string; key: string; value: string }[] = [];

  // 2. Revisión de req.query
  if (req.query && typeof req.query === 'object') {
    for (const [k, v] of Object.entries(req.query)) {
      const lowerKey = k.toLowerCase().replace(/\[.*\]$/, '').replace(/\[\]$/, '').trim();
      const isTarget = isTargetIdentifierKey(k) || ['empresa', 'company', 'firm'].includes(lowerKey);
      if (isTarget) {
        const check = checkSingleText(v, 'query', k);
        if (!check.valid) {
          return res.status(400).json({
            success: false,
            error: 'IDENTIFICADOR_EMPRESA_INVALIDO',
            errorMessage: check.reason,
          });
        }
        if (!lowerKey.includes('firm')) {
          collectedCompanyValues.push({ source: 'query', key: k, value: (v as string).trim() });
        }
      }
    }
  }

  // 3. Revisión de req.body
  if (req.body && typeof req.body === 'object') {
    for (const [k, v] of Object.entries(req.body)) {
      const lowerKey = k.toLowerCase().replace(/\[.*\]$/, '').replace(/\[\]$/, '').trim();
      const isContainer = ['empresa', 'company', 'companycontext', 'firm', 'firmcontext'].includes(lowerKey);

      if (isContainer) {
        if (Array.isArray(v)) {
          return res.status(400).json({
            success: false,
            error: 'IDENTIFICADOR_EMPRESA_INVALIDO',
            errorMessage: `El parámetro '${k}' en body no puede ser una lista ni contener valores repetidos.`,
          });
        }
        if (v !== null && typeof v === 'object') {
          const innerId = (v as any).id ?? (v as any).empresaId ?? (v as any).companyId;
          const innerRut = (v as any).rut ?? (v as any).rutEmpresa;
          if (Array.isArray(innerId) || Array.isArray(innerRut)) {
            return res.status(400).json({
              success: false,
              error: 'IDENTIFICADOR_EMPRESA_INVALIDO',
              errorMessage: `El identificador dentro del objeto '${k}' no puede ser una lista.`,
            });
          }
          if (typeof innerId === 'string') {
            const check = checkSingleText(innerId, 'body', `${k}.id`);
            if (!check.valid) {
              return res.status(400).json({
                success: false,
                error: 'IDENTIFICADOR_EMPRESA_INVALIDO',
                errorMessage: check.reason,
              });
            }
            if (!lowerKey.includes('firm')) {
              collectedCompanyValues.push({ source: 'body', key: `${k}.id`, value: innerId.trim() });
            }
          } else if (typeof innerRut === 'string') {
            const check = checkSingleText(innerRut, 'body', `${k}.rut`);
            if (!check.valid) {
              return res.status(400).json({
                success: false,
                error: 'IDENTIFICADOR_EMPRESA_INVALIDO',
                errorMessage: check.reason,
              });
            }
            if (!lowerKey.includes('firm')) {
              collectedCompanyValues.push({ source: 'body', key: `${k}.rut`, value: innerRut.trim() });
            }
          }
        } else if (typeof v === 'string') {
          const check = checkSingleText(v, 'body', k);
          if (!check.valid) {
            return res.status(400).json({
              success: false,
              error: 'IDENTIFICADOR_EMPRESA_INVALIDO',
              errorMessage: check.reason,
            });
          }
          if (!lowerKey.includes('firm')) {
            collectedCompanyValues.push({ source: 'body', key: k, value: (v as string).trim() });
          }
        } else {
          return res.status(400).json({
            success: false,
            error: 'IDENTIFICADOR_EMPRESA_INVALIDO',
            errorMessage: `El parámetro '${k}' en body debe ser un texto único o un objeto de configuración válido.`,
          });
        }
      } else if (isTargetIdentifierKey(k)) {
        const check = checkSingleText(v, 'body', k);
        if (!check.valid) {
          return res.status(400).json({
            success: false,
            error: 'IDENTIFICADOR_EMPRESA_INVALIDO',
            errorMessage: check.reason,
          });
        }
        if (!k.toLowerCase().includes('firm')) {
          collectedCompanyValues.push({ source: 'body', key: k, value: (v as string).trim() });
        }
      }
    }
  }

  // 4. Revisión de req.params
  if (req.params && typeof req.params === 'object') {
    for (const [k, v] of Object.entries(req.params)) {
      const lowerKey = k.toLowerCase().replace(/\[.*\]$/, '').replace(/\[\]$/, '').trim();
      const isTarget = isTargetIdentifierKey(k) || ['empresa', 'company', 'firm'].includes(lowerKey);
      if (isTarget) {
        const check = checkSingleText(v, 'params', k);
        if (!check.valid) {
          return res.status(400).json({
            success: false,
            error: 'IDENTIFICADOR_EMPRESA_INVALIDO',
            errorMessage: check.reason,
          });
        }
        if (!lowerKey.includes('firm')) {
          collectedCompanyValues.push({ source: 'params', key: k, value: (v as string).trim() });
        }
      }
    }
  }

  // 5. Revisión de req.headers
  if (req.headers && typeof req.headers === 'object') {
    for (const [k, v] of Object.entries(req.headers)) {
      if (COMPANY_HEADER_KEYS.some((hdr) => hdr === k.toLowerCase())) {
        const check = checkSingleText(v, 'headers', k);
        if (!check.valid) {
          return res.status(400).json({
            success: false,
            error: 'IDENTIFICADOR_EMPRESA_INVALIDO',
            errorMessage: check.reason,
          });
        }
        if (!k.toLowerCase().includes('firm')) {
          collectedCompanyValues.push({ source: 'headers', key: k, value: (v as string).trim() });
        }
      }
    }
  }

  // 6. Revisión de segmento /companies/:idOrRut en URL
  const matchCompanyPath = urlPath.match(/\/companies\/([^\/\?]+)/i);
  if (matchCompanyPath && matchCompanyPath[1] && !['active-sii', 'create', 'list'].includes(matchCompanyPath[1])) {
    const rawPathId = decodeURIComponent(matchCompanyPath[1]);
    const check = checkSingleText(rawPathId, 'ruta URL', 'idOrRut');
    if (!check.valid) {
      return res.status(400).json({
        success: false,
        error: 'IDENTIFICADOR_EMPRESA_INVALIDO',
        errorMessage: check.reason,
      });
    }
    collectedCompanyValues.push({ source: 'url_path', key: 'idOrRut', value: rawPathId.trim() });
  }

  // 7. Verificación de consistencia entre identificadores de empresa provistos
  if (collectedCompanyValues.length > 1) {
    const firstNorm = normalizeCompanyKey(collectedCompanyValues[0].value);
    for (let i = 1; i < collectedCompanyValues.length; i++) {
      const currNorm = normalizeCompanyKey(collectedCompanyValues[i].value);
      if (currNorm !== firstNorm) {
        return res.status(400).json({
          success: false,
          error: 'IDENTIFICADOR_EMPRESA_INVALIDO',
          errorMessage: `Valores conflictivos para el identificador de empresa: '${collectedCompanyValues[0].key}' (${collectedCompanyValues[0].value}) en ${collectedCompanyValues[0].source} no coincide con '${collectedCompanyValues[i].key}' (${collectedCompanyValues[i].value}) en ${collectedCompanyValues[i].source}. Debe ser un texto único.`,
        });
      }
    }
  }

  // Si se encontró un identificador válido de empresa, almacenarlo en req
  if (collectedCompanyValues.length > 0) {
    (req as any).targetCompanyId = collectedCompanyValues[0].value;
  }

  next();
}

/**
 * Extrae el identificador de empresa explícito enviado en la petición (params, query, body, headers)
 */
export function extractTargetCompanyId(req: Request): { companyId?: string; isExplicit: boolean } {
  if (typeof (req as any).targetCompanyId === 'string' && (req as any).targetCompanyId.trim()) {
    return { companyId: (req as any).targetCompanyId.trim(), isExplicit: true };
  }

  // Buscar en headers
  for (const hdr of COMPANY_HEADER_KEYS) {
    const val = req.headers[hdr];
    if (typeof val === 'string' && val.trim() && !hdr.includes('firm')) {
      return { companyId: val.trim(), isExplicit: true };
    }
  }

  // Buscar en params
  if (req.params && typeof req.params === 'object') {
    for (const [k, v] of Object.entries(req.params)) {
      if (isTargetIdentifierKey(k) && !k.toLowerCase().includes('firm')) {
        if (Array.isArray(v) && v.length > 0) {
          return { companyId: String(v[0]).trim(), isExplicit: true };
        }
        if (typeof v === 'string' && v.trim()) {
          return { companyId: v.trim(), isExplicit: true };
        }
      }
    }
  }

  // Buscar en query
  if (req.query && typeof req.query === 'object') {
    for (const [k, v] of Object.entries(req.query)) {
      if (isTargetIdentifierKey(k) && !k.toLowerCase().includes('firm')) {
        if (Array.isArray(v) && v.length > 0) {
          return { companyId: String(v[0]).trim(), isExplicit: true };
        }
        if (typeof v === 'string' && v.trim()) {
          return { companyId: v.trim(), isExplicit: true };
        }
      }
    }
  }

  // Buscar en body
  if (req.body && typeof req.body === 'object') {
    for (const [k, v] of Object.entries(req.body)) {
      const lowerKey = k.toLowerCase().replace(/\[.*\]$/, '').replace(/\[\]$/, '').trim();
      if (['empresa', 'company', 'companycontext'].includes(lowerKey)) {
        if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
          const innerId = (v as any).id ?? (v as any).empresaId ?? (v as any).companyId;
          const innerRut = (v as any).rut ?? (v as any).rutEmpresa;
          if (typeof innerId === 'string' && innerId.trim()) {
            return { companyId: innerId.trim(), isExplicit: true };
          }
          if (typeof innerRut === 'string' && innerRut.trim()) {
            return { companyId: innerRut.trim(), isExplicit: true };
          }
        }
        if (typeof v === 'string' && v.trim()) {
          return { companyId: v.trim(), isExplicit: true };
        }
      }
      if (isTargetIdentifierKey(k) && !k.toLowerCase().includes('firm')) {
        if (Array.isArray(v) && v.length > 0) {
          return { companyId: String(v[0]).trim(), isExplicit: true };
        }
        if (typeof v === 'string' && v.trim()) {
          return { companyId: v.trim(), isExplicit: true };
        }
      }
    }
  }

  // Extraer si la URL contiene /companies/<companyId>
  const urlPath = (req.originalUrl || req.path || '').split('?')[0];
  const matchCompanyPath = urlPath.match(/\/companies\/([^\/\?]+)/i);
  if (matchCompanyPath && matchCompanyPath[1] && !['active-sii', 'create', 'list'].includes(matchCompanyPath[1])) {
    return { companyId: decodeURIComponent(matchCompanyPath[1]).trim(), isExplicit: true };
  }

  // Si no se proporcionó ninguno, usar empresa principal de la sesión
  const authUser = (req as AuthenticatedRequest).user;
  return { companyId: authUser?.empresaPrincipalId, isExplicit: false };
}

/**
 * Middleware único de Autorización Centralizada con Denegación por Defecto
 */
export function centralizedAuthorizationMiddleware(req: Request, res: Response, next: NextFunction) {
  const urlPath = (req.originalUrl || req.path || '').split('?')[0].replace(/\/+$/, '') || '/';

  // 1. Si no es ruta /api, continuar
  if (!urlPath.startsWith('/api')) {
    return next();
  }

  // 2. Rutas de sesión exentas de módulos funcionales
  if (AUTH_SESSION_EXEMPT_PATHS.some((p) => urlPath === p || urlPath.startsWith(p + '/'))) {
    return next();
  }

  const authUser = (req as AuthenticatedRequest).user;
  if (!authUser) {
    return res.status(401).json({
      success: false,
      error: 'AUTH_REQUIRED',
      errorMessage: `Autenticación requerida para acceder a ${req.method} ${urlPath}`,
    });
  }

  // 3. Regla A4: Exigencia de cambio de contraseña inicial
  if (authUser.debeCambiarPassword) {
    return res.status(403).json({
      success: false,
      error: 'PASSWORD_CHANGE_REQUIRED',
      errorMessage: 'Debe cambiar su contraseña inicial antes de realizar operaciones en el sistema.',
    });
  }

  // 4. Regla A1: Extracción y validación de empresa (Aislamiento Multi-Tenant)
  const { companyId: targetCompanyId, isExplicit } = extractTargetCompanyId(req);

  if (isExplicit && targetCompanyId) {
    const compCheck = requireCompanyAccess(req, targetCompanyId);
    if (!compCheck.allowed) {
      return res.status(403).json({
        success: false,
        error: 'ACCESO_EMPRESA_DENEGADO',
        errorMessage: compCheck.reason,
      });
    }
  }

  // Inyectar en req la empresa verificada para consumo uniforme y exclusivo de los controladores
  const effectiveEmpresaId = targetCompanyId || authUser.empresaPrincipalId;
  (req as any).effectiveEmpresaId = effectiveEmpresaId;
  req.effectiveEmpresaId = effectiveEmpresaId;
  if (!req.query) req.query = {};
  req.query.empresaId = effectiveEmpresaId;
  req.query.empresaRut = effectiveEmpresaId;
  req.query.companyId = effectiveEmpresaId;
  if (req.body && typeof req.body === 'object') {
    if ('empresaId' in req.body) req.body.empresaId = effectiveEmpresaId;
    if ('empresaRut' in req.body) req.body.empresaRut = effectiveEmpresaId;
    if ('companyId' in req.body) req.body.companyId = effectiveEmpresaId;
  }

  // 5. Regla A5: Motor de asistentes con herramientas (/api/agents/autonomous/execute)
  if (urlPath === '/api/agents/autonomous/execute') {
    const reqModule = (req.body?.module || req.body?.modulo || '').toString().toUpperCase();
    if (reqModule) {
      // Normalizar nombre de módulo agéntico a Canónico
      let mappedCanonical: CanonicalModule = 'CONTABILIDAD';
      if (['RRHH', 'PAYROLL', 'RECURSOS_HUMANOS'].includes(reqModule)) mappedCanonical = 'RRHH';
      else if (['TRIBUTARIO', 'SII', 'F29', 'RCV', 'DTE', 'FACTURACION'].includes(reqModule)) mappedCanonical = 'TRIBUTARIO_SII';
      else if (['INVENTARIO', 'BODEGA', 'STOCK'].includes(reqModule)) mappedCanonical = 'INVENTARIO';
      else if (['ACTIVO_FIJO', 'LEASES'].includes(reqModule)) mappedCanonical = 'ACTIVO_FIJO';
      else if (['PRODUCCION', 'COSTOS', 'COSTOS_PRODUCCION'].includes(reqModule)) mappedCanonical = 'COSTOS_PRODUCCION';
      else if (['FLUJO_CAJA', 'CASHFLOW'].includes(reqModule)) mappedCanonical = 'FLUJO_CAJA';
      else if (['COMERCIAL', 'COMPRAS', 'COMERCIAL_COMPRAS', 'PROCUREMENT'].includes(reqModule)) mappedCanonical = 'COMERCIAL_COMPRAS';
      else if (['RENDICIONES', 'EXPENSES', 'GASTOS'].includes(reqModule)) mappedCanonical = 'RENDICIONES';
      else if (['TESORERIA', 'BANCOS'].includes(reqModule)) mappedCanonical = 'TESORERIA';
      else if (['CONCILIACION'].includes(reqModule)) mappedCanonical = 'CONCILIACION';

      if (!userHasModuleAccess(authUser, mappedCanonical)) {
        return res.status(403).json({
          success: false,
          error: 'MODULO_NO_PERMITIDO',
          errorMessage: `El usuario '${authUser.username}' no tiene asignado el módulo '${mappedCanonical}' para ejecutar el agente.`,
        });
      }
    }
    return next();
  }

  // 6. Regla A1: Clasificación de Ruta en Mapa Canónico (Denegar por defecto)
  // Soporte para rutas de jobs y voz general
  if (urlPath.startsWith('/api/jobs') || urlPath === '/api/voice/status' || urlPath === '/api/voice/tts' || urlPath === '/api/voice/piper-voices' || urlPath === '/api/gemini/chat') {
    return next();
  }

  // Rutas de gobernanza
  if (urlPath.startsWith('/api/governance') || urlPath.startsWith('/api/agents/governance')) {
    return next();
  }

  const matchedRule = resolveCanonicalModuleForPath(urlPath);
  if (!matchedRule) {
    return res.status(403).json({
      success: false,
      error: 'RUTA_NO_CLASIFICADA',
      errorMessage: `Acceso denegado por defecto: La ruta '${req.method} ${urlPath}' no se encuentra registrada en el mapa canónico de autorización.`,
    });
  }

  // 7. Regla A2: Rutas de administración exclusivas para SuperAdmin
  if (matchedRule.superAdminOnly && !authUser.isSuperAdmin) {
    return res.status(403).json({
      success: false,
      error: 'SUPERADMIN_REQUIRED',
      errorMessage: `Privilegios insuficientes: La ruta '${urlPath}' está reservada exclusivamente para el rol SuperAdmin.`,
    });
  }

  // 8. Validación de módulo asignado al rol del usuario
  if (!userHasModuleAccess(authUser, matchedRule.module)) {
    return res.status(403).json({
      success: false,
      error: 'MODULO_NO_PERMITIDO',
      errorMessage: `Acceso restringido: El usuario '${authUser.username}' (Rol: ${authUser.roleCodigo}) no tiene asignado el módulo '${matchedRule.module}'.`,
    });
  }

  return next();
}
