/**
 * K6 · Consola "Mi cliente ERP".
 *
 * El administrador de un Cliente ERP (estudio contable, empresa o grupo) administra lo suyo:
 *   GET    /api/account/overview                   su cliente ERP: plan, consumo, empresas, facturas y pagos
 *   GET    /api/account/users                      usuarios de sus empresas, roles asignables y empresas
 *   POST   /api/account/users                      crea un usuario (clave temporal, cambio obligatorio)
 *   PUT    /api/account/users/:id                  cambia datos, rol, empresas o estado
 *   POST   /api/account/users/:id/reset-password   restablece la clave (temporal)
 *
 * El SuperAdmin de la empresa dueña usa las mismas rutas con ?cuentaId= para administrar cualquier
 * cliente (sin cuentaId: el cliente ERP de su empresa principal, es decir, la empresa dueña).
 * Ningún dato de otro cliente ERP sale de estas rutas.
 */
import { Router, type Request, type Response } from 'express';
import { SaasError, companiesOfAccount, usage, planCatalog } from '../services/saasAccountService';
import { listInvoices, listPayments } from '../services/saasBillingService';
import { whatsappBridgeService } from '../services/whatsappBridgeService';
import {
  createAccountUser,
  listAccountUsers,
  resetAccountUserPassword,
  resolveManagedAccount,
  updateAccountUser,
  type AccountActor,
} from '../services/accountUsersService';

export const accountRouter = Router();

function actorOf(req: Request): AccountActor | null {
  const u = (req as any).user;
  if (!u) return null;
  return { userId: u.userId, username: u.username, isSuperAdmin: Boolean(u.isSuperAdmin), isAdmin: Boolean(u.isAdmin), empresaPrincipalId: u.empresaPrincipalId };
}

const cuentaParam = (req: Request) => (typeof req.query.cuentaId === 'string' && req.query.cuentaId ? req.query.cuentaId : undefined);

const wrap = (fn: (req: Request, res: Response, actor: AccountActor) => any) => async (req: Request, res: Response) => {
  const actor = actorOf(req);
  if (!actor) return res.status(401).json({ success: false, error: 'AUTH_REQUIRED', errorMessage: 'Autenticación requerida.' });
  try {
    await fn(req, res, actor);
  } catch (err: any) {
    if (err instanceof SaasError) {
      return res.status(err.status).json({ success: false, error: err.code, code: err.code, errorMessage: err.message, ...(err.details || {}) });
    }
    console.error('[Cuenta]', err);
    res.status(500).json({ success: false, error: 'ERROR_INTERNO', errorMessage: err?.message || String(err) });
  }
};

accountRouter.get(
  '/overview',
  wrap((req, res, actor) => {
    const acc = resolveManagedAccount(actor, cuentaParam(req));
    const users = whatsappBridgeService.getRbacState().users || [];
    const plan = planCatalog().find((p: any) => p.id === acc.planId);
    const hoy = new Date().toISOString().slice(0, 10);
    const facturas = listInvoices(acc.id)
      .filter((i) => i.estado !== 'ANULADA' && i.estado !== 'BORRADOR')
      .map((i) => ({
        id: i.id,
        periodo: i.periodo,
        concepto: i.concepto,
        folio: i.folio || null,
        total: i.total,
        pagado: i.pagado,
        saldo: Math.max(0, i.total - i.pagado),
        estado: i.estado,
        fechaEmision: i.fechaEmision || null,
        fechaVencimiento: i.fechaVencimiento || null,
        diasAtraso:
          i.estado === 'EMITIDA' && i.fechaVencimiento && i.fechaVencimiento < hoy && i.total - i.pagado > 0
            ? Math.round((Date.parse(hoy) - Date.parse(i.fechaVencimiento)) / 86400000)
            : 0,
      }));
    res.json({
      success: true,
      cuenta: {
        id: acc.id,
        tipo: acc.tipo,
        rut: acc.rut,
        razonSocial: acc.razonSocial,
        emailFacturacion: acc.emailFacturacion,
        contactoCobranza: acc.contactoCobranza,
        planId: acc.planId,
        planNombre: plan?.nombre || acc.planId,
        precioMensualNetoClp: acc.condiciones.precioMensualNetoClp,
        modulos: acc.condiciones.modulos,
        contrato: { numero: acc.contrato.numero, fechaInicio: acc.contrato.fechaInicio, fechaTermino: acc.contrato.fechaTermino || null, diasPlazoPago: acc.contrato.diasPlazoPago, fechaFinPrueba: acc.contrato.fechaFinPrueba || null },
        estado: acc.estado,
        motivoEstado: acc.motivoEstado || null,
        esPropietario: Boolean(acc.esPropietario),
      },
      consumo: usage(acc.id, users),
      empresas: companiesOfAccount(acc.id).map((c: any) => ({ id: c.id, rut: c.rut, razonSocial: c.razonSocial, estadoEmpresa: c.estadoEmpresa || 'ACTIVA' })),
      facturas,
      pagos: listPayments(acc.id).map((p: any) => ({ id: p.id, invoiceId: p.invoiceId, monto: p.monto, fecha: p.fecha, medio: p.medio || null })),
      deudaVencida: facturas.filter((f) => f.diasAtraso > 0).reduce((s, f) => s + f.saldo, 0),
    });
  })
);

accountRouter.get(
  '/users',
  wrap((req, res, actor) => {
    res.json({ success: true, ...listAccountUsers(actor, cuentaParam(req)) });
  })
);

accountRouter.post(
  '/users',
  wrap((req, res, actor) => {
    res.status(201).json({ success: true, ...createAccountUser(actor, req.body || {}, cuentaParam(req)) });
  })
);

accountRouter.put(
  '/users/:id',
  wrap((req, res, actor) => {
    res.json({ success: true, ...updateAccountUser(actor, String(req.params.id), req.body || {}, cuentaParam(req)) });
  })
);

accountRouter.post(
  '/users/:id/reset-password',
  wrap((req, res, actor) => {
    res.json({ success: true, ...resetAccountUserPassword(actor, String(req.params.id), cuentaParam(req)) });
  })
);
