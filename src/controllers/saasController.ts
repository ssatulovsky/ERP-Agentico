/**
 * K3/K4 · API de administración comercial del ERP (empresa dueña).
 *
 * SuperAdmin:
 *   GET    /api/saas/overview                       clientes ERP con estado, consumo, deuda y empresas sin asignar
 *   GET    /api/saas/plans                          catálogo de planes
 *   POST   /api/saas/accounts                       crea un cliente ERP (y asigna empresas)
 *   PUT    /api/saas/accounts/:id                   actualiza datos, plan, condiciones, contrato y plazos de cobranza
 *   POST   /api/saas/accounts/:id/companies         asigna empresas (respeta el límite)
 *   POST   /api/saas/accounts/:id/state             suspender / reactivar manualmente (motivo obligatorio)
 *   POST   /api/saas/accounts/:id/close             baja con respaldo de 10 años (confirmación con RUT)
 *   GET    /api/saas/accounts/:id/history           historial de estados, facturas, pagos y avisos
 *   POST   /api/saas/invoices                       genera la factura de un período
 *   POST   /api/saas/invoices/:id/emit              pide la emisión DTE (aprobación humana)
 *   POST   /api/saas/invoices/:id/external          registra una factura emitida fuera del ERP
 *   POST   /api/saas/invoices/:id/void              anula un borrador
 *   POST   /api/saas/payments                       registra un pago (reactiva si ya no hay deuda vencida)
 *   GET    /api/saas/payments/suggestions           abonos de la cartola de la empresa dueña que calzan
 *   POST   /api/saas/cycle/run                      ejecuta el ciclo diario ahora
 *   GET    /api/saas/notifications                  avisos enviados o pendientes de canal
 * Cualquier usuario autenticado:
 *   GET    /api/saas/my-account                     su plan, consumo y estado (sin datos de otros clientes)
 */
import { Router, type Request, type Response } from 'express';
import {
  assignCompanies,
  changeAccountState,
  companiesOfAccount,
  createAccount,
  ensureOwnerAccount,
  getAccount,
  listAccounts,
  planCatalog,
  SaasError,
  updateAccount,
  usage,
  type SaasAccountState,
} from '../services/saasAccountService';
import {
  closeAccountWithBackup,
  createInvoiceDraft,
  listInvoices,
  listPayments,
  overdueDays,
  registerExternalEmission,
  registerPayment,
  requestInvoiceEmission,
  runDailyBillingCycle,
  suggestPaymentMatches,
  syncInvoicesWithApprovals,
  unassignedCompanies,
  voidInvoice,
} from '../services/saasBillingService';
import { listNotifications } from '../services/saasNotificationService';
import { accountOfUser } from '../services/saasHooks';
import { whatsappBridgeService } from '../services/whatsappBridgeService';

export const saasRouter = Router();

const today = () => new Date().toISOString().slice(0, 10);

function fail(res: Response, err: any) {
  if (err instanceof SaasError) return res.status(err.status).json({ success: false, error: err.code, code: err.code, errorMessage: err.message, ...(err.details || {}) });
  console.error('[SaaS]', err);
  return res.status(500).json({ success: false, error: 'ERROR_INTERNO', errorMessage: err?.message || String(err) });
}

const wrap =
  (fn: (req: Request, res: Response) => any, superAdmin = true) =>
  async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ success: false, error: 'AUTH_REQUIRED', errorMessage: 'Autenticación requerida.' });
    if (superAdmin && !user.isSuperAdmin) {
      return res.status(403).json({ success: false, error: 'SUPERADMIN_REQUIRED', errorMessage: 'La administración comercial del ERP es exclusiva del SuperAdmin.' });
    }
    try {
      await fn(req, res);
    } catch (err) {
      fail(res, err);
    }
  };

function summary(acc: ReturnType<typeof getAccount>) {
  if (!acc) return null;
  const users = whatsappBridgeService.getRbacState().users || [];
  const invoices = listInvoices(acc.id);
  return {
    ...acc,
    consumo: usage(acc.id, users),
    diasAtraso: overdueDays(acc.id, today()),
    deudaVencida: invoices
      .filter((i) => i.estado === 'EMITIDA' && i.fechaVencimiento && i.fechaVencimiento < today())
      .reduce((s, i) => s + (i.total - i.pagado), 0),
    saldoPendiente: invoices.filter((i) => i.estado === 'EMITIDA').reduce((s, i) => s + (i.total - i.pagado), 0),
    empresas: companiesOfAccount(acc.id).map((c) => ({ id: c.id, rut: c.rut, razonSocial: c.razonSocial, estadoEmpresa: c.estadoEmpresa || 'ACTIVA' })),
  };
}

saasRouter.get('/overview', wrap(async (_req, res) => {
  ensureOwnerAccount(whatsappBridgeService.getRbacState().companiesConfig || []);
  await syncInvoicesWithApprovals();
  res.json({
    success: true,
    clientes: listAccounts().map(summary),
    empresasSinCliente: unassignedCompanies().map((c) => ({ id: c.id, rut: c.rut, razonSocial: c.razonSocial })),
    smtpConfigurado: Boolean(process.env.SMTP_HOST),
  });
}));

saasRouter.get('/plans', wrap((_req, res) => res.json({ success: true, planes: planCatalog() })));

saasRouter.post('/accounts', wrap((req, res) => {
  const acc = createAccount(req.body || {}, (req as any).user.userId);
  res.status(201).json({ success: true, cliente: summary(acc) });
}));

saasRouter.put('/accounts/:id', wrap((req, res) => {
  const acc = updateAccount(String(req.params.id), req.body || {}, (req as any).user.userId);
  res.json({ success: true, cliente: summary(acc) });
}));

saasRouter.post('/accounts/:id/companies', wrap((req, res) => {
  const ids = Array.isArray(req.body?.empresasIds) ? req.body.empresasIds : [];
  if (!ids.length) throw new SaasError(400, 'MISSING_PARAMS', 'Indique las empresas (empresasIds).');
  assignCompanies(String(req.params.id), ids, (req as any).user.userId);
  res.json({ success: true, cliente: summary(getAccount(String(req.params.id))) });
}));

saasRouter.post('/accounts/:id/state', wrap((req, res) => {
  const estado = String(req.body?.estado || '') as SaasAccountState;
  if (!['ACTIVA', 'SUSPENDIDA'].includes(estado)) {
    throw new SaasError(400, 'ESTADO_INVALIDO', 'Manualmente se puede suspender o reactivar; la baja tiene su propio procedimiento.');
  }
  const acc = changeAccountState(String(req.params.id), estado, String(req.body?.motivo || ''), { usuarioId: (req as any).user.userId });
  res.json({ success: true, cliente: summary(acc) });
}));

saasRouter.post('/accounts/:id/close', wrap(async (req, res) => {
  const acc = await closeAccountWithBackup(String(req.params.id), req.body || {}, (req as any).user.userId);
  res.json({ success: true, cliente: summary(acc) });
}));

saasRouter.get('/accounts/:id/history', wrap((req, res) => {
  const id = String(req.params.id);
  const acc = getAccount(id);
  if (!acc) throw new SaasError(404, 'CLIENTE_ERP_NO_EXISTE', 'El cliente ERP no existe.');
  res.json({ success: true, cliente: summary(acc), facturas: listInvoices(id), pagos: listPayments(id), avisos: listNotifications(id) });
}));

saasRouter.post('/invoices', wrap(async (req, res) => {
  const acc = getAccount(String(req.body?.clienteErpId || ''));
  if (!acc) throw new SaasError(404, 'CLIENTE_ERP_NO_EXISTE', 'El cliente ERP no existe.');
  const inv = createInvoiceDraft(acc, String(req.body?.periodo || ''), (req as any).user.userId);
  const out = req.body?.solicitarEmision ? await requestInvoiceEmission(inv.id, (req as any).user.userId) : inv;
  res.status(201).json({ success: true, factura: out });
}));

saasRouter.post('/invoices/:id/emit', wrap(async (req, res) => {
  res.json({ success: true, factura: await requestInvoiceEmission(String(req.params.id), (req as any).user.userId) });
}));

saasRouter.post('/invoices/:id/external', wrap((req, res) => {
  res.json({ success: true, factura: registerExternalEmission(String(req.params.id), req.body || {}, (req as any).user.userId) });
}));

saasRouter.post('/invoices/:id/void', wrap((req, res) => {
  res.json({ success: true, factura: voidInvoice(String(req.params.id), String(req.body?.motivo || ''), (req as any).user.userId) });
}));

saasRouter.post('/payments', wrap(async (req, res) => {
  const r = await registerPayment(req.body || {}, (req as any).user.userId);
  res.status(201).json({ success: true, pago: r.pago, factura: r.factura, cliente: summary(r.cuenta) });
}));

saasRouter.get('/payments/suggestions', wrap((_req, res) => res.json({ success: true, sugerencias: suggestPaymentMatches() })));

saasRouter.post('/cycle/run', wrap(async (req, res) => {
  const fecha = req.body?.fecha ? new Date(`${req.body.fecha}T12:00:00Z`) : new Date();
  res.json({ success: true, resultado: await runDailyBillingCycle(fecha, { force: true }) });
}));

saasRouter.get('/notifications', wrap((_req, res) => res.json({ success: true, avisos: listNotifications().slice(0, 500) })));

saasRouter.get('/my-account', wrap((req, res) => {
  const user = (req as any).user;
  const acc = accountOfUser(user);
  if (!acc) return res.json({ success: true, cliente: null });
  const users = whatsappBridgeService.getRbacState().users || [];
  res.json({
    success: true,
    cliente: {
      razonSocial: acc.razonSocial,
      planId: acc.planId,
      estado: acc.estado,
      modulos: acc.condiciones.modulos,
      consumo: usage(acc.id, users),
      diasAtraso: overdueDays(acc.id, today()),
    },
  });
}, false));
