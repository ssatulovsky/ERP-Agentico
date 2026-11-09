/**
 * 4.5 Cartera de empresas en el servidor.
 *
 * Antes la cartera vivía solo en el navegador (localStorage): en otro equipo, o tras una
 * instalación real, el usuario veía "No hay empresas registradas" aunque el servidor tuviera
 * la empresa. Ahora el servidor es la fuente: el ERP descarga la cartera al ingresar y guarda
 * aquí cada alta o cambio.
 *
 *   GET /api/clients        empresas a las que el usuario tiene acceso
 *   PUT /api/clients/:id    crea (SuperAdmin) o actualiza (administrador con acceso) una empresa
 */
import { Router, type Request, type Response } from 'express';
import { diskPersistence } from '../services/diskPersistenceService';
import { requireCompanyAccess } from '../middlewares/authMiddleware';
import { validateRutChileno } from '../utils/chileanAccounting';

export const clientsRouter = Router();

const norm = (v: string) => String(v || '').replace(/[^0-9kK]/g, '').toUpperCase();

function allClients(): any[] {
  return ((diskPersistence.getSnapshot() as any).clients || []) as any[];
}

clientsRouter.get('/', (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ success: false, error: 'AUTH_REQUIRED', errorMessage: 'Autenticación requerida.' });
  const permitidas = new Set<string>([user.empresaPrincipalId, ...(user.empresasPermitidas || [])].map(norm));
  const clientes = allClients().filter((c) => user.isSuperAdmin || permitidas.has(norm(c.id)) || permitidas.has(norm(c.rut)));
  res.json({ success: true, clientes });
});

clientsRouter.put('/:id', (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ success: false, error: 'AUTH_REQUIRED', errorMessage: 'Autenticación requerida.' });
  if (!user.isSuperAdmin && !user.isAdmin) {
    return res.status(403).json({ success: false, error: 'ROL_NO_PERMITIDO', errorMessage: 'Solo un administrador registra o modifica empresas.' });
  }
  const id = String(req.params.id || '');
  const body = req.body || {};
  if (body.id && String(body.id) !== id) {
    return res.status(400).json({ success: false, error: 'ID_INCONSISTENTE', errorMessage: 'El id del cuerpo no coincide con el de la ruta.' });
  }
  if (!body.rut || !validateRutChileno(String(body.rut))) {
    return res.status(400).json({ success: false, error: 'RUT_INVALIDO', errorMessage: 'La empresa requiere un RUT válido.' });
  }
  if (!String(body.razonSocial || '').trim()) {
    return res.status(400).json({ success: false, error: 'DATOS_REQUERIDOS', errorMessage: 'La empresa requiere razón social.' });
  }
  const list = allClients();
  const existente = list.find((c) => c.id === id);
  // Una empresa existente la modifica un administrador con acceso a ella; una nueva, solo un SuperAdmin.
  if (existente) {
    const acceso = requireCompanyAccess(req, id);
    if (!acceso.allowed) return res.status(403).json({ success: false, error: 'ACCESO_EMPRESA_DENEGADO', errorMessage: acceso.reason });
  } else if (!user.isSuperAdmin) {
    return res.status(403).json({ success: false, error: 'ROL_NO_PERMITIDO', errorMessage: 'Solo un SuperAdmin registra empresas nuevas.' });
  } else if (list.some((c) => norm(c.rut) === norm(body.rut))) {
    return res.status(409).json({ success: false, error: 'RUT_DUPLICADO', errorMessage: `Ya existe una empresa con RUT ${body.rut}.` });
  }
  const cliente = { ...(existente || {}), ...body, id, actualizadoEn: new Date().toISOString() };
  diskPersistence.updateCollection('clients', existente ? list.map((c) => (c.id === id ? cliente : c)) : [...list, cliente]);
  diskPersistence.addAuditLog({
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    fecha: cliente.actualizadoEn,
    entidadTipo: 'CLIENT_COMPANY',
    entidadId: id,
    accion: existente ? 'ACTUALIZAR_EMPRESA' : 'CREAR_EMPRESA',
    usuarioId: user.userId,
    empresaId: id,
    datosNuevos: { rut: cliente.rut, razonSocial: cliente.razonSocial },
  });
  res.status(existente ? 200 : 201).json({ success: true, cliente });
});
