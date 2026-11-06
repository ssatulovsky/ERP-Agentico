import { Router, type Request, type Response } from 'express';
import crypto from 'node:crypto';
import {
  authenticateErpLogin,
  sanitizeSecurityUser,
  type LoginValidationResult,
  type SecurityUser,
} from '../services/securityRbacService';
import { whatsappBridgeService } from '../services/whatsappBridgeService';
import { getMysqlDb, isRealMysqlConnected } from '../db/mysqlClient';
import { agentAuditLogs } from '../db/schema/accountingLedgerSchema';
import { diskPersistence } from '../services/diskPersistenceService';

export const authRouter = Router();

export interface ServerAuthSession {
  token: string;
  userId: string;
  username: string;
  empresaId: string;
  roleId: string;
  createdAt: number;
  expiresAt: number;
}

// Sesiones activas con TTL de 24 horas y persistencia en disco
export const activeSessions = new Map<string, ServerAuthSession>();

export function getSessionByToken(token: string): ServerAuthSession | null {
  if (!token) return null;
  const clean = token.startsWith('Bearer ') ? token.substring(7).trim() : token.trim();
  
  // 1. Memoria rápida
  const session = activeSessions.get(clean);
  if (session && session.expiresAt > Date.now()) {
    return session;
  }

  // 2. Persistencia en disco (para cluster PM2 y supervivencia tras reinicios)
  const persistedSession = diskPersistence.getSession(clean);
  if (persistedSession && persistedSession.expiresAt > Date.now()) {
    activeSessions.set(clean, persistedSession);
    return persistedSession;
  }

  // 3. Token de desarrollo: ÚNICAMENTE permitido en entorno NO-producción y si está configurado explícitamente en variables de entorno
  if (process.env.NODE_ENV !== 'production' && process.env.ERP_DEV_AUTH_TOKEN && clean === process.env.ERP_DEV_AUTH_TOKEN) {
    return {
      token: clean,
      userId: 'usr-admin-system',
      username: 'admin-dev',
      empresaId: 'client-innovagile',
      roleId: 'role-admin',
      createdAt: Date.now(),
      expiresAt: Date.now() + 86400000,
    };
  }

  return null;
}

interface AttemptTracker {
  count: number;
  firstAttemptAt: number;
  blockedUntil?: number;
}

const failedUserAttempts = new Map<string, AttemptTracker>();
const failedIpAttempts = new Map<string, AttemptTracker>();

/**
 * Limpieza de sesiones e intentos expirados cada 15 minutos
 */
setInterval(() => {
  const now = Date.now();
  for (const [token, session] of activeSessions.entries()) {
    if (session.expiresAt < now) {
      activeSessions.delete(token);
    }
  }
  for (const [key, record] of failedUserAttempts.entries()) {
    if (record.blockedUntil && record.blockedUntil < now) {
      failedUserAttempts.delete(key);
    } else if (now - record.firstAttemptAt > 15 * 60 * 1000) {
      failedUserAttempts.delete(key);
    }
  }
  for (const [key, record] of failedIpAttempts.entries()) {
    if (record.blockedUntil && record.blockedUntil < now) {
      failedIpAttempts.delete(key);
    } else if (now - record.firstAttemptAt > 15 * 60 * 1000) {
      failedIpAttempts.delete(key);
    }
  }
}, 15 * 60 * 1000);

/**
 * POST /api/auth/login
 * Autentica de forma segura un usuario contra el sistema RBAC del ERP
 */
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password, empresaId } = req.body;
    const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const now = Date.now();

    // 1. Verificación de Rate Limiting por IP (Máx 15 intentos en 15 minutos)
    const ipRecord = failedIpAttempts.get(clientIp);
    if (ipRecord && ipRecord.blockedUntil && ipRecord.blockedUntil > now) {
      const waitMinutes = Math.ceil((ipRecord.blockedUntil - now) / 60000);
      return res.status(429).json({
        success: false,
        error: 'RATE_LIMIT_EXCEEDED',
        errorMessage: `Demasiados intentos fallidos desde esta dirección IP. Intente nuevamente en ${waitMinutes} minutos.`,
      });
    }

    if (!username || !password || !empresaId) {
      return res.status(400).json({
        success: false,
        error: 'DATOS_INCOMPLETOS',
        errorMessage: 'Debe ingresar usuario, contraseña y seleccionar una empresa.',
      });
    }

    const normUsername = String(username).trim().toLowerCase();

    // 2. Verificación de Bloqueo de Cuenta de Usuario (Máx 5 intentos en 15 minutos)
    const userRecord = failedUserAttempts.get(normUsername);
    if (userRecord && userRecord.blockedUntil && userRecord.blockedUntil > now) {
      const waitMinutes = Math.ceil((userRecord.blockedUntil - now) / 60000);
      return res.status(403).json({
        success: false,
        error: 'ACCOUNT_TEMPORARILY_LOCKED',
        errorMessage: `Cuenta temporalmente bloqueada por 5 intentos fallidos consecutivos. Espere ${waitMinutes} minutos o contacte a un SuperAdmin.`,
      });
    }

    const state = whatsappBridgeService.getRbacState();
    const result: LoginValidationResult = authenticateErpLogin({
      usernameInput: String(username),
      passwordInput: String(password),
      empresaId: String(empresaId),
      state,
    });

    if (!result.ok || !result.user || !result.role) {
      // Registrar intento fallido para la IP
      const currentIp = failedIpAttempts.get(clientIp) || { count: 0, firstAttemptAt: now };
      if (now - currentIp.firstAttemptAt > 15 * 60 * 1000) {
        currentIp.count = 1;
        currentIp.firstAttemptAt = now;
      } else {
        currentIp.count += 1;
      }
      if (currentIp.count >= 15) {
        currentIp.blockedUntil = now + 15 * 60 * 1000;
      }
      failedIpAttempts.set(clientIp, currentIp);

      // Registrar intento fallido para el usuario
      const currentUser = failedUserAttempts.get(normUsername) || { count: 0, firstAttemptAt: now };
      if (now - currentUser.firstAttemptAt > 15 * 60 * 1000) {
        currentUser.count = 1;
        currentUser.firstAttemptAt = now;
      } else {
        currentUser.count += 1;
      }
      if (currentUser.count >= 5) {
        currentUser.blockedUntil = now + 15 * 60 * 1000;
      }
      failedUserAttempts.set(normUsername, currentUser);

      return res.status(401).json({
        success: false,
        ...result,
      });
    }

    // Login exitoso: Limpiar intentos fallidos
    failedUserAttempts.delete(normUsername);
    failedIpAttempts.delete(clientIp);

    // Auto-migración a scrypt si el hash almacenado aún es s256 o antiguo
    if (result.user.password && !result.user.password.startsWith('scrypt:')) {
      try {
        const { hashPassword } = await import('../utils/passwordCrypto');
        const currentState = whatsappBridgeService.getRbacState();
        const targetUser = currentState.users?.find((u) => u.id === result.user?.id);
        if (targetUser) {
          targetUser.password = hashPassword(String(password).trim());
          whatsappBridgeService.saveRbacStore(currentState);
        }
      } catch (migrateErr: any) {
        console.warn('[AuthController] Advertencia en auto-migración scrypt:', migrateErr.message);
      }
    }

    // Generar token criptográfico de sesión
    const token = crypto.randomBytes(32).toString('hex');
    const session: ServerAuthSession = {
      token,
      userId: result.user.id,
      username: result.user.username,
      empresaId,
      roleId: result.role.id,
      createdAt: now,
      expiresAt: now + 24 * 60 * 60 * 1000, // 24 horas
    };

    activeSessions.set(token, session);
    diskPersistence.saveSession(token, session);

    // Registro inmutable de auditoría pericial
    try {
      if (isRealMysqlConnected) {
        const db = getMysqlDb();
        await db.insert(agentAuditLogs).values({
          id: crypto.randomUUID(),
          agentName: 'AUTH_GATEWAY',
          empresaId,
          accion: 'USER_LOGIN_SUCCESS',
          detalle: `Inicio de sesión exitoso usuario ${result.user.username} (${result.user.nombreCompleto}) en empresa ${result.companyConfig?.razonSocial || empresaId}`,
          ipOrigen: req.ip || '127.0.0.1',
          nivelRiesgo: 'INFO',
          createdAt: new Date(),
        });
      }
    } catch (auditErr: any) {
      console.warn('[AuthController] Advertencia registrando log de auditoría login:', auditErr.message);
    }

    return res.json({
      success: true,
      token,
      debeCambiarPassword: Boolean(result.user.debeCambiarPassword),
      user: sanitizeSecurityUser(result.user),
      result: {
        ...result,
        user: sanitizeSecurityUser(result.user),
      },
    });
  } catch (error: any) {
    console.error('[AuthController] Error en login:', error);
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      errorMessage: error.message,
    });
  }
});

/**
 * GET /api/auth/me
 * Retorna la identidad y permisos de la sesión activa autenticada
 */
authRouter.get('/me', (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'NO_AUTORIZADO',
        errorMessage: 'Falta cabecera de autorización Bearer token.',
      });
    }

    const token = authHeader.substring(7).trim();
    const session = getSessionByToken(token);

    if (!session || session.expiresAt < Date.now()) {
      if (session) {
        activeSessions.delete(token);
        diskPersistence.deleteSession(token);
      }
      return res.status(401).json({
        success: false,
        error: 'SESION_EXPIRADA',
        errorMessage: 'La sesión ha expirado o no es válida. Inicie sesión nuevamente.',
      });
    }

    const state = whatsappBridgeService.getRbacState();
    const user = state.users.find((u) => u.id === session.userId);
    const role = state.roles.find((r) => r.id === session.roleId);
    const company = state.companiesConfig.find((c) => c.empresaId === session.empresaId);

    if (!user || user.estado !== 'ACTIVO') {
      return res.status(403).json({
        success: false,
        error: 'USUARIO_INACTIVO',
        errorMessage: 'El usuario ya no se encuentra activo en el sistema.',
      });
    }

    return res.json({
      success: true,
      session: {
        empresaId: session.empresaId,
        expiresAt: session.expiresAt,
      },
      user: sanitizeSecurityUser(user),
      role,
      company,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/auth/logout
 * Revoca y destruye la sesión autenticada activa
 */
authRouter.post('/logout', (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      activeSessions.delete(token);
      diskPersistence.deleteSession(token);
    }
    return res.json({ success: true, message: 'Sesión finalizada exitosamente.' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/auth/change-password
 * Permite cambiar la contraseña del usuario autenticado, derivando la clave con SCRYPT y salt
 */
authRouter.post('/change-password', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'NO_AUTORIZADO',
        message: 'Token de sesión requerido.',
      });
    }
    const token = authHeader.substring(7).trim();
    const session = getSessionByToken(token);
    if (!session || session.expiresAt < Date.now()) {
      return res.status(401).json({
        success: false,
        error: 'SESION_EXPIRADA',
        message: 'Sesión expirada o inválida.',
      });
    }

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Debe ingresar la contraseña actual y la nueva contraseña.',
      });
    }

    if (String(newPassword).trim().length < 12) {
      return res.status(400).json({
        success: false,
        error: 'PASSWORD_TOO_SHORT',
        message: 'Política de seguridad: La nueva contraseña debe tener al menos 12 caracteres.',
      });
    }

    const state = whatsappBridgeService.getRbacState();
    const user = state.users.find((u) => u.id === session.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado.',
      });
    }

    const { verifyPassword, hashPassword } = await import('../utils/passwordCrypto');
    if (!verifyPassword(String(currentPassword).trim(), user.password)) {
      return res.status(400).json({
        success: false,
        error: 'CLAVE_ACTUAL_INCORRECTA',
        message: 'La contraseña actual ingresada es incorrecta.',
      });
    }

    // Regla de no reutilización de contraseña anterior
    if (verifyPassword(String(newPassword).trim(), user.password)) {
      return res.status(400).json({
        success: false,
        error: 'PASSWORD_REUSE_FORBIDDEN',
        message: 'Política de seguridad: La nueva contraseña no puede ser idéntica a la contraseña anterior.',
      });
    }

    // Hashear con scrypt criptográficamente robusto (N=16384, r=8, p=1, 64 bytes)
    user.password = hashPassword(String(newPassword).trim());
    user.debeCambiarPassword = false;

    whatsappBridgeService.saveRbacStore(state);

    return res.json({
      success: true,
      message: 'Contraseña actualizada exitosamente con cifrado scrypt.',
      debeCambiarPassword: false,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
