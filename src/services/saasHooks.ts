/**
 * K3 · Reglas comerciales aplicadas a la cartera de empresas y a los usuarios.
 *
 * - Campos protegidos: solo un SuperAdmin cambia cliente ERP, empresa dueña, anclas, contrato y estados.
 *   (Antes un administrador podía reactivarse o agregarse anclas con PUT /api/clients/:id.)
 * - Un administrador puede registrar empresas en su propio cliente ERP mientras no supere el límite.
 * - Límite de usuarios activos al crear el acceso inicial.
 */
import { registerCompanyClientHooks, type HookError } from './companyClientHooks';
import { accountOfCompany, assertCanAddCompany, countActiveUsers, getAccount, SaasError } from './saasAccountService';
import { findCompany, normalizeCompanyKey } from './companyRegistryService';
import { whatsappBridgeService } from './whatsappBridgeService';

export const PROTECTED_COMPANY_FIELDS = [
  'clienteErpId',
  'esEmpresaDuenaErp',
  'empresasAnclasIds',
  'estadoCuentaEmpresa',
  'estadoEmpresa',
  'contrato',
  'fechaBaja',
  'motivoBaja',
] as const;

const same = (a: any, b: any) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

function toHookError(err: any): HookError {
  if (err instanceof SaasError) return { status: err.status, body: { error: err.code, errorMessage: err.message, ...(err.details || {}) } };
  return { status: 500, body: { error: 'ERROR_INTERNO', errorMessage: err?.message || String(err) } };
}

/** Cliente ERP del usuario (el de su empresa principal). */
export function accountOfUser(user: any) {
  return accountOfCompany(user?.empresaPrincipalId);
}

let installed = false;

export function installSaasHooks(): void {
  if (installed) return;
  installed = true;
  registerCompanyClientHooks({
    allowAdminCreate: ({ user }) => Boolean(user?.isAdmin && accountOfUser(user)),

    beforeSave: ({ user, existente, body }) => {
      if (!user.isSuperAdmin) {
        // Campos comerciales y de seguridad: el cuerpo no puede cambiarlos.
        for (const f of PROTECTED_COMPANY_FIELDS) {
          if (!(f in body)) continue;
          if (!existente) {
            // En un alta se descartan (los fija el servidor).
            if (f !== 'clienteErpId') delete body[f];
            continue;
          }
          if (!same(body[f], existente[f])) {
            return { status: 403, body: { error: 'CAMPO_PROTEGIDO', errorMessage: `El campo "${f}" solo lo modifica la administración del ERP.`, campo: f } };
          }
        }
        if (!existente) {
          const acc = accountOfUser(user);
          if (!acc) return { status: 403, body: { error: 'ROL_NO_PERMITIDO', errorMessage: 'Su usuario no pertenece a un cliente ERP.' } };
          if (body.clienteErpId && body.clienteErpId !== acc.id) {
            return { status: 403, body: { error: 'CAMPO_PROTEGIDO', errorMessage: 'Solo puede registrar empresas en su propio cliente ERP.', campo: 'clienteErpId' } };
          }
          body.clienteErpId = acc.id;
        }
      }
      // Alta o cambio de cliente ERP: respetar el límite de empresas del plan.
      const nuevoCliente = body.clienteErpId;
      if (nuevoCliente && (!existente || existente.clienteErpId !== nuevoCliente)) {
        if (!getAccount(nuevoCliente)) return { status: 400, body: { error: 'CLIENTE_ERP_NO_EXISTE', errorMessage: 'El cliente ERP indicado no existe.' } };
        try {
          assertCanAddCompany(nuevoCliente);
        } catch (err) {
          return toHookError(err);
        }
      }
      return null;
    },

    afterSave: ({ user, cliente, creada }) => {
      if (!creada) return;
      // La empresa nueva queda visible en seguridad y, si la creó un administrador, accesible para él.
      const state = whatsappBridgeService.getRbacState();
      const companiesConfig = [...(state.companiesConfig || [])];
      if (!companiesConfig.some((c: any) => normalizeCompanyKey(c.empresaId) === normalizeCompanyKey(cliente.id))) {
        companiesConfig.push({
          empresaId: cliente.id,
          rut: cliente.rut,
          razonSocial: cliente.razonSocial,
          nombreCorto: cliente.nombreCorto || cliente.razonSocial,
          estadoCuenta: 'ACTIVA',
          esEmpresaDuenaErp: Boolean(cliente.esEmpresaDuenaErp),
          empresasAnclasIds: [],
          fechaUltimoCambioEstado: new Date().toISOString().slice(0, 10),
        } as any);
      }
      const users = (state.users || []).map((u: any) =>
        !user.isSuperAdmin && u.id === user.userId
          ? { ...u, empresasAnclasPermitidas: [...new Set([...(u.empresasAnclasPermitidas || []), cliente.id])] }
          : u
      );
      whatsappBridgeService.saveRbacStore({ ...state, companiesConfig, users } as any);
    },

    beforeCreateUser: ({ empresa }) => {
      const acc = empresa?.clienteErpId ? getAccount(empresa.clienteErpId) : null;
      if (!acc || acc.esPropietario) return null;
      const n = countActiveUsers(acc.id, whatsappBridgeService.getRbacState().users || []);
      if (n + 1 > acc.condiciones.limiteUsuarios) {
        return {
          status: 409,
          body: { error: 'LIMITE_USUARIOS', errorMessage: `${acc.razonSocial} alcanzó el límite de su plan (${acc.condiciones.limiteUsuarios} usuarios activos).`, usuarios: n, limite: acc.condiciones.limiteUsuarios },
        };
      }
      return null;
    },

    sameCommercialAccount: (a, b, user) => {
      if (user?.isSuperAdmin) return true;
      const ca = findCompany(a);
      const cb = findCompany(b);
      // Empresas aún sin cliente ERP asignado: rige solo el acceso del usuario.
      if (!ca?.clienteErpId && !cb?.clienteErpId) return true;
      return ca?.clienteErpId === cb?.clienteErpId;
    },
  });
}

installSaasHooks();
