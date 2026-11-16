/**
 * K2 · API del plan de cuentas único por empresa.
 *
 *   GET  /api/companies/:id/chart                     estado (SIN_PLAN | CONFIGURADO), cuentas, grupos y origen
 *   PUT  /api/companies/:id/chart                     guarda el plan editado (cuentas con movimientos protegidas)
 *   POST /api/companies/:id/chart/initialize          plantilla, copia, importación, navegador o vacío
 *   POST /api/companies/:id/chart/validate            valida un plan sin guardarlo (vista previa de importación)
 *   GET  /api/companies/:id/chart/copy-sources        empresas desde las que se puede copiar el plan
 *   GET  /api/companies/:id/chart/template            plantilla estándar (vista previa)
 *   GET  /api/companies/:id/system-parameters         parámetros generales y cuentas por defecto de la empresa
 *   PUT  /api/companies/:id/system-parameters         los guarda (cada cuenta* validada contra el plan)
 *
 * :id acepta el id o el RUT de la empresa.
 */
import { Router, type Request, type Response } from 'express';
import { requireCompanyAccess } from '../middlewares/authMiddleware';
import {
  ChartError,
  completeAccountStructure,
  getCompanyChartState,
  getCompanySystemParameters,
  initializeCompanyChart,
  saveCompanyChart,
  saveCompanySystemParameters,
  validateChart,
} from '../services/chartOfAccountsServerService';
import { listCompanies } from '../services/companyRegistryService';
import { buildStandardChartTemplate } from '../utils/companyChartOfAccountsService';
import { companyClientHooks } from '../services/companyClientHooks';

export const chartOfAccountsRouter = Router();

const WRITE_ROLES = (user: any) => user?.isSuperAdmin || user?.isAdmin || ['CONTADOR', 'CONTADOR_GENERAL', 'CONTADOR_SENIOR'].includes(String(user?.roleCodigo || '').toUpperCase());

function guard(req: Request, res: Response, write = false): string | null {
  const user = (req as any).user;
  if (!user) {
    res.status(401).json({ success: false, error: 'AUTH_REQUIRED', errorMessage: 'Autenticación requerida.' });
    return null;
  }
  const id = String(req.params.id || '').trim();
  const acceso = requireCompanyAccess(req, id);
  if (!acceso.allowed) {
    res.status(403).json({ success: false, error: 'ACCESO_EMPRESA_DENEGADO', errorMessage: acceso.reason });
    return null;
  }
  if (write && !WRITE_ROLES(user)) {
    res.status(403).json({ success: false, error: 'ROL_NO_PERMITIDO', errorMessage: 'Solo un administrador o el contador modifican el plan de cuentas.' });
    return null;
  }
  return id;
}

function fail(res: Response, err: any) {
  if (err instanceof ChartError) {
    return res.status(err.status).json({ success: false, error: err.code, code: err.code, errorMessage: err.message, ...(err.details || {}) });
  }
  console.error('[ChartOfAccounts]', err);
  return res.status(500).json({ success: false, error: 'ERROR_INTERNO', errorMessage: err?.message || String(err) });
}

chartOfAccountsRouter.get('/:id/chart', (req, res) => {
  const id = guard(req, res);
  if (!id) return;
  try {
    const s = getCompanyChartState(id);
    res.json({ success: true, ...s });
  } catch (err) {
    fail(res, err);
  }
});

chartOfAccountsRouter.put('/:id/chart', (req, res) => {
  const id = guard(req, res, true);
  if (!id) return;
  try {
    const s = saveCompanyChart(id, req.body?.chart, Array.isArray(req.body?.groups) ? req.body.groups : undefined, (req as any).user?.userId);
    res.json({ success: true, ...s });
  } catch (err) {
    fail(res, err);
  }
});

chartOfAccountsRouter.post('/:id/chart/initialize', (req, res) => {
  const id = guard(req, res, true);
  if (!id) return;
  try {
    const s = initializeCompanyChart(id, req.body || {}, {
      userId: (req as any).user?.userId,
      canAccessCompany: (origenId) =>
        requireCompanyAccess(req, origenId).allowed && companyClientHooks.sameCommercialAccount(id, origenId, (req as any).user),
    });
    res.status(201).json({ success: true, ...s });
  } catch (err) {
    fail(res, err);
  }
});

chartOfAccountsRouter.post('/:id/chart/validate', (req, res) => {
  const id = guard(req, res);
  if (!id) return;
  const cuentas = Array.isArray(req.body?.cuentas) ? req.body.cuentas.map(completeAccountStructure) : [];
  const { errores, advertencias } = validateChart(cuentas);
  res.json({ success: true, valido: errores.length === 0, cuentas, errores, advertencias });
});

chartOfAccountsRouter.get('/:id/chart/copy-sources', (req, res) => {
  const id = guard(req, res);
  if (!id) return;
  const user = (req as any).user;
  const fuentes = listCompanies()
    .filter((c) => c.estadoEmpresa !== 'BAJA' && c.id !== getCompanyChartState(id).empresaId)
    .filter((c) => requireCompanyAccess(req, c.id).allowed && companyClientHooks.sameCommercialAccount(id, c.id, user))
    .map((c) => {
      const s = getCompanyChartState(c.id);
      return { empresaId: c.id, rut: c.rut, razonSocial: c.razonSocial, cuentas: s.chart.length, estado: s.estado };
    })
    .filter((f) => f.estado === 'CONFIGURADO' && f.cuentas > 0);
  res.json({ success: true, fuentes });
});

chartOfAccountsRouter.get('/:id/chart/template', (req, res) => {
  const id = guard(req, res);
  if (!id) return;
  const t = buildStandardChartTemplate();
  res.json({ success: true, cuentas: t.chart.length, grupos: t.groups.length, chart: t.chart, groups: t.groups });
});

chartOfAccountsRouter.get('/:id/system-parameters', (req, res) => {
  const id = guard(req, res);
  if (!id) return;
  res.json({ success: true, parametros: getCompanySystemParameters(id) });
});

chartOfAccountsRouter.put('/:id/system-parameters', (req, res) => {
  const id = guard(req, res, true);
  if (!id) return;
  try {
    const parametros = saveCompanySystemParameters(id, req.body?.parametros || {}, (req as any).user?.userId);
    res.json({ success: true, parametros });
  } catch (err) {
    fail(res, err);
  }
});
