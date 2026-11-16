/**
 * Cartera de empresas en el servidor.
 *
 * 4.5: el servidor es la fuente de la cartera; el ERP la descarga al ingresar y guarda aquí cada alta o cambio.
 * K1.6: la clave SII se cifra al recibirla y nunca se devuelve (solo `hasClaveSii`).
 * K1.7: una empresa no se borra desde la UI: se da de baja (estadoEmpresa = BAJA) y deja de aparecer
 *       en la cartera; el borrado definitivo solo lo hace un SuperAdmin y solo si no tiene movimientos.
 * K1.3: el acceso inicial crea de verdad el usuario administrador de la empresa.
 *
 *   GET    /api/clients                    empresas a las que el usuario tiene acceso (sin dadas de baja)
 *   PUT    /api/clients/:id                crea (SuperAdmin) o actualiza (administrador con acceso) una empresa
 *   POST   /api/clients/:id/baja           da de baja una empresa (administrador con acceso)
 *   DELETE /api/clients/:id                borrado definitivo (SuperAdmin, empresa sin movimientos)
 *   POST   /api/clients/:id/initial-admin  crea el usuario administrador de la empresa con clave temporal
 */
import { Router, type Request, type Response } from 'express';
import crypto from 'node:crypto';
import { diskPersistence } from '../services/diskPersistenceService';
import { requireCompanyAccess } from '../middlewares/authMiddleware';
import { validateRutChileno } from '../utils/chileanAccounting';
import { encryptToVaultString } from '../utils/vaultCrypto';
import { isMaskedSecret } from '../services/siiCredentialResolver';
import { hashPassword } from '../utils/passwordCrypto';
import { generateSecureOneTimePassword } from '../scripts/installSystem';
import { whatsappBridgeService } from '../services/whatsappBridgeService';
import {
  canonicalCompanyIdFromRut,
  companyKeys,
  listCompanies,
  normalizeCompanyKey,
  saveCompanies,
} from '../services/companyRegistryService';
import { companyClientHooks } from '../services/companyClientHooks';

export const clientsRouter = Router();

/** Campos secretos que nunca salen del servidor. */
const SECRET_FIELDS = ['claveSii', 'claveCertificado', 'claveSiiEncrypted'];

export function sanitizeCompanyForClient(c: any): any {
  if (!c) return c;
  const out: any = { ...c };
  out.hasClaveSii = Boolean(c.claveSii || c.claveSiiEncrypted);
  for (const f of SECRET_FIELDS) delete out[f];
  out.claveSii = '';
  return out;
}

function audit(user: any, empresaId: string, accion: string, datosNuevos: any) {
  diskPersistence.addAuditLog({
    id: `audit-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
    fecha: new Date().toISOString(),
    entidadTipo: 'CLIENT_COMPANY',
    entidadId: empresaId,
    accion,
    usuarioId: user?.userId,
    empresaId,
    datosNuevos,
  });
}

function companyHasMovements(company: any): boolean {
  const keys = new Set(companyKeys(company.id));
  const belongs = (x: any) => keys.has(normalizeCompanyKey(x?.empresaId || x?.empresaRut || x?.companyId));
  const snap: any = diskPersistence.getSnapshot();
  return ['entries', 'dtes', 'payrolls', 'bankMovements', 'expenseReports'].some((k) => (snap[k] || []).some(belongs));
}

clientsRouter.get('/', (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ success: false, error: 'AUTH_REQUIRED', errorMessage: 'Autenticación requerida.' });
  const clientes = listCompanies()
    .filter((c) => c.estadoEmpresa !== 'BAJA')
    .filter((c) => user.isSuperAdmin || requireCompanyAccess(req, c.id).allowed)
    .map(sanitizeCompanyForClient);
  res.json({ success: true, clientes });
});

clientsRouter.put('/:id', async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ success: false, error: 'AUTH_REQUIRED', errorMessage: 'Autenticación requerida.' });
  if (!user.isSuperAdmin && !user.isAdmin) {
    return res.status(403).json({ success: false, error: 'ROL_NO_PERMITIDO', errorMessage: 'Solo un administrador registra o modifica empresas.' });
  }
  const id = String(req.params.id || '');
  const body = { ...(req.body || {}) };
  if (body.id && String(body.id) !== id) {
    return res.status(400).json({ success: false, error: 'ID_INCONSISTENTE', errorMessage: 'El id del cuerpo no coincide con el de la ruta.' });
  }
  if (!body.rut || !validateRutChileno(String(body.rut))) {
    return res.status(400).json({ success: false, error: 'RUT_INVALIDO', errorMessage: 'La empresa requiere un RUT válido.' });
  }
  if (!String(body.razonSocial || '').trim()) {
    return res.status(400).json({ success: false, error: 'DATOS_REQUERIDOS', errorMessage: 'La empresa requiere razón social.' });
  }
  const list = listCompanies();
  const existente = list.find((c) => c.id === id);

  if (existente) {
    const acceso = requireCompanyAccess(req, id);
    if (!acceso.allowed) return res.status(403).json({ success: false, error: 'ACCESO_EMPRESA_DENEGADO', errorMessage: acceso.reason });
    if (normalizeCompanyKey(existente.rut) !== normalizeCompanyKey(body.rut)) {
      return res.status(400).json({ success: false, error: 'RUT_INMUTABLE', errorMessage: 'El RUT de una empresa registrada no se puede cambiar.' });
    }
  } else {
    if (!user.isSuperAdmin && !companyClientHooks.allowAdminCreate({ user })) {
      return res.status(403).json({ success: false, error: 'ROL_NO_PERMITIDO', errorMessage: 'Solo un SuperAdmin registra empresas nuevas.' });
    }
    // K1: el id de una empresa nueva es su RUT sin puntos (igual que el instalador).
    if (normalizeCompanyKey(id) !== normalizeCompanyKey(body.rut)) {
      return res.status(400).json({
        success: false,
        error: 'ID_DEBE_SER_RUT',
        errorMessage: `El id de una empresa nueva debe ser su RUT sin puntos (${canonicalCompanyIdFromRut(body.rut)}).`,
      });
    }
    if (list.some((c) => normalizeCompanyKey(c.rut) === normalizeCompanyKey(body.rut))) {
      return res.status(409).json({ success: false, error: 'RUT_DUPLICADO', errorMessage: `Ya existe una empresa con RUT ${body.rut}.` });
    }
  }

  // Ganchos de la administración comercial (K3): campos protegidos, cliente ERP y límites.
  const hookError = await companyClientHooks.beforeSave({ req, user, existente, body });
  if (hookError) return res.status(hookError.status).json({ success: false, ...hookError.body });

  // K1.6: la clave SII se cifra; una clave vacía o enmascarada conserva la guardada.
  const claveRecibida = typeof body.claveSii === 'string' ? body.claveSii.trim() : '';
  delete body.claveSii;
  delete body.hasClaveSii;
  delete body.claveSiiEncrypted;
  const claveSii = claveRecibida && !isMaskedSecret(claveRecibida) ? encryptToVaultString(claveRecibida) : existente?.claveSii || '';

  const cliente = {
    ...(existente || {}),
    ...body,
    id,
    claveSii,
    estadoEmpresa: existente?.estadoEmpresa || body.estadoEmpresa || 'ACTIVA',
    actualizadoEn: new Date().toISOString(),
    ...(existente ? {} : { creadoEn: new Date().toISOString(), creadoPor: user.userId }),
  };
  saveCompanies(existente ? list.map((c) => (c.id === id ? cliente : c)) : [...list, cliente]);
  audit(user, id, existente ? 'ACTUALIZAR_EMPRESA' : 'CREAR_EMPRESA', {
    rut: cliente.rut,
    razonSocial: cliente.razonSocial,
    claveSiiActualizada: Boolean(claveRecibida && !isMaskedSecret(claveRecibida)),
  });
  await companyClientHooks.afterSave({ req, user, cliente, creada: !existente });
  res.status(existente ? 200 : 201).json({ success: true, cliente: sanitizeCompanyForClient(cliente) });
});

clientsRouter.post('/:id/baja', (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ success: false, error: 'AUTH_REQUIRED', errorMessage: 'Autenticación requerida.' });
  if (!user.isSuperAdmin && !user.isAdmin) {
    return res.status(403).json({ success: false, error: 'ROL_NO_PERMITIDO', errorMessage: 'Solo un administrador da de baja empresas.' });
  }
  const id = String(req.params.id || '');
  const acceso = requireCompanyAccess(req, id);
  if (!acceso.allowed) return res.status(403).json({ success: false, error: 'ACCESO_EMPRESA_DENEGADO', errorMessage: acceso.reason });
  const list = listCompanies();
  const existente = list.find((c) => c.id === id);
  if (!existente) return res.status(404).json({ success: false, error: 'EMPRESA_NO_EXISTE', errorMessage: 'La empresa no existe.' });
  if (existente.esEmpresaDuenaErp) {
    return res.status(400).json({ success: false, error: 'EMPRESA_DUENA', errorMessage: 'La empresa dueña del ERP no se puede dar de baja.' });
  }
  const motivo = String(req.body?.motivo || '').trim();
  if (!motivo) return res.status(400).json({ success: false, error: 'MOTIVO_REQUERIDO', errorMessage: 'Indique el motivo de la baja.' });
  const actualizado = { ...existente, estadoEmpresa: 'BAJA', fechaBaja: new Date().toISOString(), motivoBaja: motivo, actualizadoEn: new Date().toISOString() };
  saveCompanies(list.map((c) => (c.id === id ? actualizado : c)));
  audit(user, id, 'BAJA_EMPRESA', { motivo });
  res.json({ success: true, cliente: sanitizeCompanyForClient(actualizado) });
});

clientsRouter.delete('/:id', (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user?.isSuperAdmin) {
    return res.status(403).json({ success: false, error: 'ROL_NO_PERMITIDO', errorMessage: 'Solo un SuperAdmin elimina empresas.' });
  }
  const id = String(req.params.id || '');
  const list = listCompanies();
  const existente = list.find((c) => c.id === id);
  if (!existente) return res.status(404).json({ success: false, error: 'EMPRESA_NO_EXISTE', errorMessage: 'La empresa no existe.' });
  if (existente.esEmpresaDuenaErp) {
    return res.status(400).json({ success: false, error: 'EMPRESA_DUENA', errorMessage: 'La empresa dueña del ERP no se puede eliminar.' });
  }
  if (companyHasMovements(existente)) {
    return res.status(409).json({
      success: false,
      error: 'EMPRESA_CON_MOVIMIENTOS',
      errorMessage: 'La empresa tiene movimientos registrados; solo se puede dar de baja.',
    });
  }
  saveCompanies(list.filter((c) => c.id !== id));
  audit(user, id, 'ELIMINAR_EMPRESA', { rut: existente.rut });
  res.json({ success: true });
});

clientsRouter.post('/:id/initial-admin', async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ success: false, error: 'AUTH_REQUIRED', errorMessage: 'Autenticación requerida.' });
  if (!user.isSuperAdmin) {
    return res.status(403).json({ success: false, error: 'ROL_NO_PERMITIDO', errorMessage: 'Solo un SuperAdmin configura el acceso inicial de una empresa.' });
  }
  const id = String(req.params.id || '');
  const empresa = listCompanies().find((c) => c.id === id);
  if (!empresa) return res.status(404).json({ success: false, error: 'EMPRESA_NO_EXISTE', errorMessage: 'Registre la empresa antes de configurar su acceso.' });

  const username = String(req.body?.username || '').trim();
  const nombreCompleto = String(req.body?.nombreCompleto || '').trim();
  const email = String(req.body?.email || '').trim();
  const faltantes = [!username && 'username', !nombreCompleto && 'nombreCompleto', !email && 'email'].filter(Boolean);
  if (faltantes.length) {
    return res.status(400).json({ success: false, code: 'MISSING_PARAMS', missingParams: faltantes, errorMessage: 'Faltan datos del administrador.' });
  }
  if (!/^[a-zA-Z0-9._-]{3,40}$/.test(username)) {
    return res.status(400).json({ success: false, error: 'USUARIO_INVALIDO', errorMessage: 'El usuario debe tener 3 a 40 caracteres (letras, números, punto, guion).' });
  }
  const state = whatsappBridgeService.getRbacState();
  if ((state.users || []).some((u: any) => String(u.username).toLowerCase() === username.toLowerCase())) {
    return res.status(409).json({ success: false, error: 'USUARIO_EXISTE', errorMessage: `El usuario "${username}" ya existe.` });
  }

  const hookError = await companyClientHooks.beforeCreateUser({ req, user, empresa });
  if (hookError) return res.status(hookError.status).json({ success: false, ...hookError.body });

  const tempPassword = generateSecureOneTimePassword();
  const nuevo: any = {
    id: `usr-${crypto.randomUUID().slice(0, 12)}`,
    username,
    password: hashPassword(tempPassword),
    nombreCompleto,
    cargo: 'Administrador',
    email,
    telefonoWhatsapp: '',
    estado: 'ACTIVO',
    rolId: 'role-admin',
    empresaPrincipalId: empresa.id,
    empresasAnclasPermitidas: [empresa.id],
    recibirAudioWhatsapp: false,
    debeCambiarPassword: true,
  };
  const companiesConfig = [...(state.companiesConfig || [])];
  if (!companiesConfig.some((c: any) => normalizeCompanyKey(c.empresaId) === normalizeCompanyKey(empresa.id))) {
    companiesConfig.push({
      empresaId: empresa.id,
      rut: empresa.rut,
      razonSocial: empresa.razonSocial,
      nombreCorto: empresa.nombreCorto || empresa.razonSocial,
      estadoCuenta: 'ACTIVA',
      esEmpresaDuenaErp: Boolean(empresa.esEmpresaDuenaErp),
      empresasAnclasIds: [],
      fechaUltimoCambioEstado: new Date().toISOString().slice(0, 10),
    });
  }
  whatsappBridgeService.saveRbacStore({ ...state, companiesConfig, users: [...(state.users || []), nuevo] } as any);
  audit(user, empresa.id, 'CREAR_ADMIN_INICIAL', { username, email });
  // La clave temporal se entrega una sola vez; el usuario debe cambiarla en su primer ingreso.
  res.status(201).json({ success: true, usuario: { id: nuevo.id, username, nombreCompleto, email }, claveTemporal: tempPassword });
});
