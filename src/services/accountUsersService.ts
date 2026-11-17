/**
 * K6.1 · Usuarios y accesos de un Cliente ERP.
 *
 * El administrador de un Cliente ERP (estudio contable, empresa o grupo) administra los usuarios de
 * SUS empresas: crea, cambia rol y empresas, desactiva y restablece claves. Nunca ve ni toca usuarios
 * de otro Cliente ERP, ni asigna el rol SuperAdmin, ni da acceso a empresas fuera de su cliente.
 *
 * Un usuario pertenece al Cliente ERP de su empresa principal. Todas las empresas que se le asignen
 * (principal y anclas permitidas) deben ser de ese mismo Cliente ERP.
 */
import crypto from 'node:crypto';
import { whatsappBridgeService } from './whatsappBridgeService';
import { diskPersistence } from './diskPersistenceService';
import {
  accountOfCompany,
  companiesOfAccount,
  getAccount,
  ownerAccount,
  SaasError,
  assertUserLimits,
  type SaasAccount,
} from './saasAccountService';
import { companyKeys, normalizeCompanyKey } from './companyRegistryService';
import { hashPassword } from '../utils/passwordCrypto';
import { generateSecureOneTimePassword } from '../scripts/installSystem';

export interface AccountActor {
  userId: string;
  username?: string;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  empresaPrincipalId?: string;
}

/** Cliente ERP que administra el actor: el suyo (admin) o el indicado / el propietario (SuperAdmin). */
export function resolveManagedAccount(actor: AccountActor, cuentaId?: string): SaasAccount {
  if (actor.isSuperAdmin) {
    const acc = cuentaId ? getAccount(cuentaId) : accountOfCompany(actor.empresaPrincipalId) || ownerAccount();
    if (!acc) throw new SaasError(404, 'CLIENTE_ERP_NO_EXISTE', 'No se encontró el cliente ERP indicado.');
    return acc;
  }
  if (!actor.isAdmin) {
    throw new SaasError(403, 'ROL_NO_PERMITIDO', 'Solo el administrador del cliente ERP administra usuarios y empresas.');
  }
  const acc = accountOfCompany(actor.empresaPrincipalId);
  if (!acc) throw new SaasError(403, 'SIN_CLIENTE_ERP', 'Su empresa principal no está asociada a un cliente ERP. Contacte a la administración del ERP.');
  if (cuentaId && cuentaId !== acc.id) throw new SaasError(403, 'CLIENTE_ERP_AJENO', 'Solo puede administrar su propio cliente ERP.');
  return acc;
}

function accountCompanyKeys(accountId: string): Set<string> {
  return new Set(companiesOfAccount(accountId, true).flatMap((c: any) => companyKeys(c.id)));
}

function belongsToAccount(u: any, keys: Set<string>): boolean {
  return keys.has(normalizeCompanyKey(u?.empresaPrincipalId));
}

function isSuperAdminRole(state: any, rolId: string): boolean {
  if (rolId === 'role-superadmin') return true;
  const r = (state.roles || []).find((x: any) => x.id === rolId);
  return r?.tipoSistema === 'SUPERADMIN';
}

export function sanitizeAccountUser(u: any, state: any) {
  const rol = (state.roles || []).find((r: any) => r.id === u.rolId);
  return {
    id: u.id,
    username: u.username,
    nombreCompleto: u.nombreCompleto || '',
    cargo: u.cargo || '',
    email: u.email || '',
    telefonoWhatsapp: u.telefonoWhatsapp || '',
    estado: u.estado,
    rolId: u.rolId,
    rolNombre: rol?.nombre || u.rolId,
    empresaPrincipalId: u.empresaPrincipalId,
    // Sin repetir la empresa principal (algunos registros antiguos la guardan también como ancla, por id o por RUT).
    empresasAnclasPermitidas: (u.empresasAnclasPermitidas || []).filter((x: string) => !companyKeys(u.empresaPrincipalId).includes(normalizeCompanyKey(x))),
    debeCambiarPassword: Boolean(u.debeCambiarPassword),
    bloqueado: Boolean(u.bloqueado),
  };
}

/** Roles que el administrador de un cliente puede asignar: todos menos SuperAdmin, globales o de sus empresas. */
export function assignableRoles(state: any, accountId: string) {
  const keys = accountCompanyKeys(accountId);
  return (state.roles || [])
    .filter((r: any) => r.tipoSistema !== 'SUPERADMIN' && r.id !== 'role-superadmin')
    .filter((r: any) => !r.empresaScopeId || r.empresaScopeId === 'GLOBAL' || keys.has(normalizeCompanyKey(r.empresaScopeId)))
    .map((r: any) => ({ id: r.id, nombre: r.nombre, codigo: r.codigo, tipoSistema: r.tipoSistema, descripcion: r.descripcion || '' }));
}

export function listAccountUsers(actor: AccountActor, cuentaId?: string) {
  const acc = resolveManagedAccount(actor, cuentaId);
  const state = whatsappBridgeService.getRbacState();
  const keys = accountCompanyKeys(acc.id);
  return {
    cuenta: { id: acc.id, razonSocial: acc.razonSocial, limiteUsuarios: acc.condiciones.limiteUsuarios, esPropietario: Boolean(acc.esPropietario) },
    empresas: companiesOfAccount(acc.id).map((c: any) => ({ id: c.id, rut: c.rut, razonSocial: c.razonSocial, estadoEmpresa: c.estadoEmpresa || 'ACTIVA' })),
    roles: assignableRoles(state, acc.id),
    usuarios: (state.users || []).filter((u: any) => belongsToAccount(u, keys)).map((u: any) => sanitizeAccountUser(u, state)),
  };
}

interface UserInput {
  username?: string;
  nombreCompleto?: string;
  email?: string;
  cargo?: string;
  telefonoWhatsapp?: string;
  rolId?: string;
  empresaPrincipalId?: string;
  empresasAnclasPermitidas?: string[];
  estado?: 'ACTIVO' | 'INACTIVO';
}

function validateAssignment(state: any, acc: SaasAccount, rolId: string, principal: string, anclas: string[]) {
  const keys = accountCompanyKeys(acc.id);
  const activas = new Set(companiesOfAccount(acc.id).flatMap((c: any) => companyKeys(c.id)));
  if (isSuperAdminRole(state, rolId)) throw new SaasError(403, 'ROL_NO_ASIGNABLE', 'El rol SuperAdmin solo lo asigna la administración del ERP.');
  if (!assignableRoles(state, acc.id).some((r: any) => r.id === rolId)) throw new SaasError(400, 'ROL_NO_EXISTE', `El rol "${rolId}" no existe o no está disponible para este cliente.`);
  const fuera = [principal, ...anclas].filter((id) => !keys.has(normalizeCompanyKey(id)));
  if (fuera.length) {
    throw new SaasError(403, 'EMPRESA_FUERA_DEL_CLIENTE', `Solo puede dar acceso a empresas de ${acc.razonSocial}.`, { empresas: fuera });
  }
  if (!activas.has(normalizeCompanyKey(principal))) throw new SaasError(400, 'EMPRESA_NO_ACTIVA', 'La empresa principal está dada de baja.');
}

function audit(actor: AccountActor, empresaId: string, accion: string, datos: any) {
  diskPersistence.addAuditLog({
    id: `audit-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
    fecha: new Date().toISOString(),
    entidadTipo: 'SECURITY_USER',
    entidadId: datos?.userId || datos?.username || '',
    accion,
    usuarioId: actor.userId,
    empresaId,
    datosNuevos: datos,
  } as any);
}

function save(state: any, users: any[]) {
  // Límite de usuarios activos del plan (todos los clientes ERP; el propietario no tiene límite).
  assertUserLimits(users);
  whatsappBridgeService.saveRbacStore({ ...state, users } as any);
}

export function createAccountUser(actor: AccountActor, input: UserInput, cuentaId?: string) {
  const acc = resolveManagedAccount(actor, cuentaId);
  const state = whatsappBridgeService.getRbacState();
  const username = String(input.username || '').trim();
  const nombreCompleto = String(input.nombreCompleto || '').trim();
  const email = String(input.email || '').trim();
  const rolId = String(input.rolId || '').trim();
  const principal = String(input.empresaPrincipalId || '').trim();
  const faltantes = [!username && 'username', !nombreCompleto && 'nombreCompleto', !email && 'email', !rolId && 'rolId', !principal && 'empresaPrincipalId'].filter(Boolean) as string[];
  if (faltantes.length) throw new SaasError(400, 'MISSING_PARAMS', 'Faltan datos del usuario.', { missingParams: faltantes });
  if (!/^[a-zA-Z0-9._-]{3,40}$/.test(username)) throw new SaasError(400, 'USUARIO_INVALIDO', 'El usuario debe tener 3 a 40 caracteres (letras, números, punto, guion).');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new SaasError(400, 'EMAIL_INVALIDO', 'El correo no es válido.');
  if ((state.users || []).some((u: any) => String(u.username).toLowerCase() === username.toLowerCase())) {
    throw new SaasError(409, 'USUARIO_EXISTE', `El usuario "${username}" ya existe.`);
  }
  const anclas = [...new Set((input.empresasAnclasPermitidas || []).map(String).filter((x) => x && x !== principal))];
  validateAssignment(state, acc, rolId, principal, anclas);

  const tempPassword = generateSecureOneTimePassword();
  const nuevo: any = {
    id: `usr-${crypto.randomUUID().slice(0, 12)}`,
    username,
    password: hashPassword(tempPassword),
    nombreCompleto,
    cargo: String(input.cargo || '').trim(),
    email,
    telefonoWhatsapp: String(input.telefonoWhatsapp || '').trim(),
    estado: 'ACTIVO',
    rolId,
    empresaPrincipalId: principal,
    empresasAnclasPermitidas: anclas,
    recibirAudioWhatsapp: false,
    debeCambiarPassword: true,
  };
  save(state, [...(state.users || []), nuevo]);
  audit(actor, principal, 'CREAR_USUARIO_CLIENTE_ERP', { userId: nuevo.id, username, rolId, empresas: [principal, ...anclas], clienteErpId: acc.id });
  return { usuario: sanitizeAccountUser(nuevo, state), claveTemporal: tempPassword };
}

function findManagedUser(actor: AccountActor, userId: string, cuentaId?: string) {
  const acc = resolveManagedAccount(actor, cuentaId);
  const state = whatsappBridgeService.getRbacState();
  const keys = accountCompanyKeys(acc.id);
  const actual = (state.users || []).find((u: any) => u.id === userId);
  // Un usuario de otro cliente ERP se trata como inexistente (no se revela que existe).
  if (!actual || !belongsToAccount(actual, keys)) throw new SaasError(404, 'USUARIO_NO_EXISTE', 'El usuario no existe en su cliente ERP.');
  if (!actor.isSuperAdmin && isSuperAdminRole(state, actual.rolId)) {
    throw new SaasError(403, 'USUARIO_PROTEGIDO', 'Los usuarios SuperAdmin solo los modifica la administración del ERP.');
  }
  return { acc, state, actual };
}

export function updateAccountUser(actor: AccountActor, userId: string, input: UserInput, cuentaId?: string) {
  const { acc, state, actual } = findManagedUser(actor, userId, cuentaId);
  const esUnoMismo = actual.id === actor.userId;
  const rolId = input.rolId !== undefined ? String(input.rolId) : actual.rolId;
  const principal = input.empresaPrincipalId !== undefined ? String(input.empresaPrincipalId) : actual.empresaPrincipalId;
  const anclas =
    input.empresasAnclasPermitidas !== undefined
      ? [...new Set(input.empresasAnclasPermitidas.map(String).filter((x) => x && x !== principal))]
      : (actual.empresasAnclasPermitidas || []).filter((x: string) => x !== principal);
  const estado = input.estado !== undefined ? input.estado : actual.estado;
  // Accesos a empresas de OTRO cliente ERP que la administración del ERP haya dado a este usuario:
  // el administrador del cliente no los ve como propios ni puede agregarlos, pero tampoco los pierde
  // al editar al usuario (se conservan tal cual).
  const keysCuenta = accountCompanyKeys(acc.id);
  const ajenasExistentes = (actual.empresasAnclasPermitidas || []).filter((x: string) => !keysCuenta.has(normalizeCompanyKey(x)));
  const anclasPropias = anclas.filter((x) => !ajenasExistentes.includes(x));

  if (esUnoMismo) {
    const cambiaAcceso =
      rolId !== actual.rolId ||
      principal !== actual.empresaPrincipalId ||
      [...anclas].sort().join(',') !== [...(actual.empresasAnclasPermitidas || []).filter((x: string) => x !== actual.empresaPrincipalId)].sort().join(',') ||
      estado !== actual.estado;
    if (cambiaAcceso) throw new SaasError(403, 'AUTOMODIFICACION_PROHIBIDA', 'No puede cambiar su propio rol, empresas ni estado.');
  }
  if (estado !== 'ACTIVO' && estado !== 'INACTIVO') throw new SaasError(400, 'ESTADO_INVALIDO', 'El estado debe ser ACTIVO o INACTIVO.');
  // El rol SuperAdmin de la empresa dueña lo conserva el SuperAdmin; para el resto se valida la asignación.
  if (!(actor.isSuperAdmin && isSuperAdminRole(state, rolId) && rolId === actual.rolId)) {
    validateAssignment(state, acc, rolId, principal, anclasPropias);
  }
  const email = input.email !== undefined ? String(input.email).trim() : actual.email;
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new SaasError(400, 'EMAIL_INVALIDO', 'El correo no es válido.');

  const actualizado = {
    ...actual,
    nombreCompleto: input.nombreCompleto !== undefined ? String(input.nombreCompleto).trim() || actual.nombreCompleto : actual.nombreCompleto,
    cargo: input.cargo !== undefined ? String(input.cargo).trim() : actual.cargo,
    email,
    telefonoWhatsapp: input.telefonoWhatsapp !== undefined ? String(input.telefonoWhatsapp).trim() : actual.telefonoWhatsapp,
    rolId,
    empresaPrincipalId: principal,
    empresasAnclasPermitidas: [...new Set([...anclasPropias, ...ajenasExistentes])],
    estado,
  };
  save(state, (state.users || []).map((u: any) => (u.id === actual.id ? actualizado : u)));
  audit(actor, principal, 'EDITAR_USUARIO_CLIENTE_ERP', { userId: actual.id, username: actual.username, rolId, empresas: [principal, ...anclasPropias], estado, clienteErpId: acc.id });
  return { usuario: sanitizeAccountUser(actualizado, state) };
}

export function resetAccountUserPassword(actor: AccountActor, userId: string, cuentaId?: string) {
  const { acc, state, actual } = findManagedUser(actor, userId, cuentaId);
  if (actual.id === actor.userId) throw new SaasError(400, 'USE_CAMBIO_DE_CLAVE', 'Para su propia clave use "Cambiar contraseña".');
  const tempPassword = generateSecureOneTimePassword();
  const actualizado = { ...actual, password: hashPassword(tempPassword), debeCambiarPassword: true, bloqueado: false, intentosFallidos: 0 };
  whatsappBridgeService.saveRbacStore({ ...state, users: (state.users || []).map((u: any) => (u.id === actual.id ? actualizado : u)) } as any);
  audit(actor, actual.empresaPrincipalId, 'RESTABLECER_CLAVE_USUARIO', { userId: actual.id, username: actual.username, clienteErpId: acc.id });
  return { usuario: sanitizeAccountUser(actualizado, state), claveTemporal: tempPassword };
}
