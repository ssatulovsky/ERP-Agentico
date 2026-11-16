/**
 * K3 · Administración comercial del ERP: clientes ERP (suscriptores), plan, límites y estado.
 *
 * Modelo:
 *   Empresa dueña del ERP (cliente ERP propietario: nunca se factura ni se suspende)
 *    └── Cliente ERP (estudio contable o empresa, sola o con su grupo)
 *          ├── plan y condiciones negociadas (precio, límites, módulos)
 *          ├── estado: PRUEBA | ACTIVA | EN_MORA | SUSPENDIDA | BAJA (único lugar donde vive)
 *          └── empresas (cada una con estadoEmpresa propio: ACTIVA | INACTIVA | BAJA)
 *
 * Decisiones (16 nov 2026): SUSPENDIDA y BAJA bloquean todo el acceso (sin lectura ni exportación).
 * Los plazos de cobranza son parametrizables por cliente; por defecto aviso a los 5 días de atraso,
 * último recordatorio a los 10 y bloqueo a los 15. Mientras no exista consolidación, el acceso es
 * por empresa: el usuario trabaja en la empresa que selecciona.
 */
import crypto from 'node:crypto';
import { diskPersistence } from './diskPersistenceService';
import { companyKeys, findCompany, listCompanies, normalizeCompanyKey, saveCompanies } from './companyRegistryService';
import { ERP_SUBSCRIPTION_PLANS } from '../config/erpMasterConfig';
import { validateRutChileno } from '../utils/chileanAccounting';

export type SaasAccountState = 'PRUEBA' | 'ACTIVA' | 'EN_MORA' | 'SUSPENDIDA' | 'BAJA';
export type SaasAccountType = 'ESTUDIO_CONTABLE' | 'EMPRESA' | 'GRUPO_EMPRESAS';

export interface SaasCollectionSettings {
  /** Días de atraso para el aviso de mora por correo. */
  diasAvisoAtraso: number;
  /** Días de atraso para el último recordatorio. */
  diasUltimoRecordatorio: number;
  /** Días de atraso para el bloqueo total (SUSPENDIDA). */
  diasBloqueo: number;
}

export const DEFAULT_COLLECTION_SETTINGS: SaasCollectionSettings = { diasAvisoAtraso: 5, diasUltimoRecordatorio: 10, diasBloqueo: 15 };

export interface SaasAccount {
  id: string;
  tipo: SaasAccountType;
  rut: string;
  razonSocial: string;
  giro?: string;
  direccion?: string;
  comuna?: string;
  ciudad?: string;
  emailFacturacion: string;
  contactoCobranza: { nombre: string; email: string; telefono?: string };
  planId: string;
  condiciones: { precioMensualNetoClp: number; limiteEmpresas: number; limiteUsuarios: number; modulos: string[] };
  contrato: {
    numero: string;
    fechaInicio: string;
    fechaTermino?: string;
    renovacionAutomatica: boolean;
    /** Día del mes en que se genera la factura (1–28). */
    diaFacturacion: number;
    /** Días para pagar desde la emisión. */
    diasPlazoPago: number;
    fechaFinPrueba?: string;
  };
  cobranza: SaasCollectionSettings;
  estado: SaasAccountState;
  motivoEstado?: string;
  historialEstados: Array<{ fecha: string; de: SaasAccountState | null; a: SaasAccountState; motivo: string; usuarioId?: string; automatico: boolean }>;
  /** Cliente ERP de la empresa dueña del ERP: no se factura, no se suspende, sin límites. */
  esPropietario?: boolean;
  creadoEn: string;
  actualizadoEn: string;
  fechaBaja?: string;
  respaldoBaja?: { archivo: string; sha256: string; bytes: number; fecha: string; conservarHasta: string; retiradoDeOperacion: boolean };
}

const ESTADOS: SaasAccountState[] = ['PRUEBA', 'ACTIVA', 'EN_MORA', 'SUSPENDIDA', 'BAJA'];
export const BLOCKED_STATES: SaasAccountState[] = ['SUSPENDIDA', 'BAJA'];

const store = () => diskPersistence.getSnapshot() as any;

export class SaasError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: any) {
    super(message);
  }
}

// --------------------------------------------------------------------------
// Lectura
// --------------------------------------------------------------------------

export function listAccounts(): SaasAccount[] {
  return (store().saasAccounts || []) as SaasAccount[];
}

export function getAccount(id: string): SaasAccount | null {
  return listAccounts().find((a) => a.id === id) || null;
}

function saveAccounts(list: SaasAccount[]): void {
  diskPersistence.updateCollection('saasAccounts', list);
}

export function companiesOfAccount(accountId: string, incluirBajas = false): any[] {
  return listCompanies().filter((c) => c.clienteErpId === accountId && (incluirBajas || c.estadoEmpresa !== 'BAJA'));
}

export function accountOfCompany(idOrRut?: string): SaasAccount | null {
  const c = findCompany(idOrRut);
  return c?.clienteErpId ? getAccount(c.clienteErpId) : null;
}

export function ownerAccount(): SaasAccount | null {
  return listAccounts().find((a) => a.esPropietario) || null;
}

export function planCatalog() {
  return ERP_SUBSCRIPTION_PLANS;
}

// --------------------------------------------------------------------------
// Acceso efectivo de una empresa (estado comercial + estado propio)
// --------------------------------------------------------------------------

export interface CompanyAccessDecision {
  allowed: boolean;
  code?: 'CLIENTE_SUSPENDIDO' | 'CLIENTE_DADO_DE_BAJA' | 'EMPRESA_DADA_DE_BAJA' | 'EMPRESA_INACTIVA';
  message?: string;
  account?: SaasAccount | null;
}

export function companyAccessDecision(idOrRut?: string): CompanyAccessDecision {
  const company = findCompany(idOrRut);
  if (!company) return { allowed: true };
  if (company.estadoEmpresa === 'BAJA') {
    return { allowed: false, code: 'EMPRESA_DADA_DE_BAJA', message: `La empresa ${company.razonSocial} fue dada de baja.` };
  }
  if (company.estadoEmpresa === 'INACTIVA') {
    return { allowed: false, code: 'EMPRESA_INACTIVA', message: `La empresa ${company.razonSocial} está inactiva.` };
  }
  const account = company.clienteErpId ? getAccount(company.clienteErpId) : null;
  if (account && !account.esPropietario && account.estado === 'SUSPENDIDA') {
    return {
      allowed: false,
      code: 'CLIENTE_SUSPENDIDO',
      account,
      message: `El acceso de ${account.razonSocial} está suspendido${account.motivoEstado ? `: ${account.motivoEstado}` : ''}. Comuníquese con la administración del ERP.`,
    };
  }
  if (account && !account.esPropietario && account.estado === 'BAJA') {
    return { allowed: false, code: 'CLIENTE_DADO_DE_BAJA', account, message: `El servicio de ${account.razonSocial} fue dado de baja.` };
  }
  return { allowed: true, account };
}

/** Estado comercial derivado para el módulo de seguridad (companiesConfig.estadoCuenta). */
export function derivedSecurityStatus(idOrRut?: string): 'ACTIVA' | 'SUSPENDIDA_PAGO' | 'BAJA' | null {
  const company = findCompany(idOrRut);
  if (!company) return null;
  if (company.estadoEmpresa === 'BAJA') return 'BAJA';
  const acc = company.clienteErpId ? getAccount(company.clienteErpId) : null;
  if (!acc || acc.esPropietario) return 'ACTIVA';
  if (acc.estado === 'SUSPENDIDA') return 'SUSPENDIDA_PAGO';
  if (acc.estado === 'BAJA') return 'BAJA';
  return 'ACTIVA';
}

/** Sobrescribe estadoCuenta de companiesConfig con el estado comercial del servidor (el navegador no decide). */
export function applyCommercialStatus<T extends { empresaId: string; estadoCuenta?: string }>(companiesConfig: T[]): T[] {
  return (companiesConfig || []).map((c) => {
    const s = derivedSecurityStatus(c.empresaId);
    return s ? { ...c, estadoCuenta: s } : c;
  });
}

// --------------------------------------------------------------------------
// Límites y módulos del plan
// --------------------------------------------------------------------------

export function countActiveUsers(accountId: string, users: any[]): number {
  const keys = new Set(companiesOfAccount(accountId, true).flatMap((c) => companyKeys(c.id)));
  return (users || []).filter((u) => u.estado === 'ACTIVO' && keys.has(normalizeCompanyKey(u.empresaPrincipalId))).length;
}

export function usage(accountId: string, users: any[]) {
  const acc = getAccount(accountId);
  return {
    empresas: companiesOfAccount(accountId).length,
    limiteEmpresas: acc?.condiciones.limiteEmpresas ?? 0,
    usuarios: countActiveUsers(accountId, users),
    limiteUsuarios: acc?.condiciones.limiteUsuarios ?? 0,
  };
}

export function assertCanAddCompany(accountId: string): void {
  const acc = getAccount(accountId);
  if (!acc) throw new SaasError(400, 'CLIENTE_ERP_NO_EXISTE', 'El cliente ERP indicado no existe.');
  if (acc.esPropietario) return;
  if (BLOCKED_STATES.includes(acc.estado)) throw new SaasError(403, 'CLIENTE_SUSPENDIDO', `${acc.razonSocial} no está activo (${acc.estado}).`);
  const n = companiesOfAccount(accountId).length;
  if (n >= acc.condiciones.limiteEmpresas) {
    throw new SaasError(409, 'LIMITE_EMPRESAS', `${acc.razonSocial} alcanzó el límite de su plan (${acc.condiciones.limiteEmpresas} empresas).`, {
      empresas: n,
      limite: acc.condiciones.limiteEmpresas,
    });
  }
}

/** Verifica el límite de usuarios activos de cada cliente ERP con el estado RBAC propuesto. */
export function assertUserLimits(users: any[]): void {
  for (const acc of listAccounts()) {
    if (acc.esPropietario) continue;
    const n = countActiveUsers(acc.id, users);
    if (n > acc.condiciones.limiteUsuarios) {
      throw new SaasError(409, 'LIMITE_USUARIOS', `${acc.razonSocial} tendría ${n} usuarios activos; su plan permite ${acc.condiciones.limiteUsuarios}.`, {
        clienteErpId: acc.id,
        usuarios: n,
        limite: acc.condiciones.limiteUsuarios,
      });
    }
  }
}

/** true si el plan del cliente ERP de la empresa incluye el módulo (empresas sin cliente ERP: sin restricción). */
export function planAllowsModule(idOrRut: string | undefined, module: string): boolean {
  if (!idOrRut || module === 'ADMIN') return true;
  const acc = accountOfCompany(idOrRut);
  if (!acc || acc.esPropietario) return true;
  return (acc.condiciones.modulos || []).includes(module);
}

// --------------------------------------------------------------------------
// Escritura
// --------------------------------------------------------------------------

function audit(accion: string, entidadId: string, datos: any, usuarioId?: string) {
  diskPersistence.addAuditLog({
    id: `audit-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
    fecha: new Date().toISOString(),
    entidadTipo: 'SAAS_ACCOUNT',
    entidadId,
    accion,
    usuarioId,
    datosNuevos: datos,
  });
}

function validateAccountInput(input: any, partial = false): string[] {
  const faltan: string[] = [];
  const req = (cond: boolean, campo: string) => {
    if (!partial && !cond) faltan.push(campo);
  };
  req(Boolean(input.rut), 'rut');
  req(Boolean(String(input.razonSocial || '').trim()), 'razonSocial');
  req(Boolean(String(input.emailFacturacion || '').trim()), 'emailFacturacion');
  req(Boolean(input.contactoCobranza?.nombre && input.contactoCobranza?.email), 'contactoCobranza (nombre y email)');
  req(Boolean(input.planId), 'planId');
  req(Boolean(input.contrato?.fechaInicio), 'contrato.fechaInicio');
  return faltan;
}

function normalizeConditions(input: any, prev?: SaasAccount['condiciones']): SaasAccount['condiciones'] {
  const plan = ERP_SUBSCRIPTION_PLANS.find((p) => p.id === input.planId);
  const c = input.condiciones || {};
  return {
    precioMensualNetoClp: Number(c.precioMensualNetoClp ?? prev?.precioMensualNetoClp ?? plan?.precioMensualClp ?? 0),
    limiteEmpresas: Number(c.limiteEmpresas ?? prev?.limiteEmpresas ?? plan?.limiteEmpresasContables ?? 0),
    limiteUsuarios: Number(c.limiteUsuarios ?? prev?.limiteUsuarios ?? plan?.limiteUsuarios ?? 0),
    modulos: Array.isArray(c.modulos) ? c.modulos : prev?.modulos || (plan as any)?.modulos || [],
  };
}

export function createAccount(input: any, usuarioId?: string): SaasAccount {
  const faltan = validateAccountInput(input);
  if (faltan.length) throw new SaasError(400, 'MISSING_PARAMS', 'Faltan datos del cliente ERP.', { missingParams: faltan });
  if (!validateRutChileno(String(input.rut))) throw new SaasError(400, 'RUT_INVALIDO', 'RUT inválido.');
  if (!ERP_SUBSCRIPTION_PLANS.some((p) => p.id === input.planId)) throw new SaasError(400, 'PLAN_INVALIDO', 'Plan inexistente.');
  if (listAccounts().some((a) => normalizeCompanyKey(a.rut) === normalizeCompanyKey(input.rut))) {
    throw new SaasError(409, 'RUT_DUPLICADO', `Ya existe un cliente ERP con RUT ${input.rut}.`);
  }
  if (input.esPropietario && ownerAccount()) throw new SaasError(409, 'PROPIETARIO_EXISTE', 'Ya existe el cliente ERP propietario.');
  const now = new Date().toISOString();
  const estadoInicial: SaasAccountState = input.contrato?.fechaFinPrueba ? 'PRUEBA' : 'ACTIVA';
  const acc: SaasAccount = {
    id: `cerp-${crypto.randomUUID().slice(0, 12)}`,
    tipo: (['ESTUDIO_CONTABLE', 'EMPRESA', 'GRUPO_EMPRESAS'].includes(input.tipo) ? input.tipo : 'EMPRESA') as SaasAccountType,
    rut: String(input.rut).trim().toUpperCase(),
    razonSocial: String(input.razonSocial).trim(),
    giro: input.giro ? String(input.giro).trim() : undefined,
    direccion: input.direccion ? String(input.direccion).trim() : undefined,
    comuna: input.comuna ? String(input.comuna).trim() : undefined,
    ciudad: input.ciudad ? String(input.ciudad).trim() : undefined,
    emailFacturacion: String(input.emailFacturacion).trim().toLowerCase(),
    contactoCobranza: {
      nombre: String(input.contactoCobranza.nombre).trim(),
      email: String(input.contactoCobranza.email).trim().toLowerCase(),
      telefono: input.contactoCobranza.telefono ? String(input.contactoCobranza.telefono).trim() : undefined,
    },
    planId: input.planId,
    condiciones: normalizeConditions(input),
    contrato: {
      numero: String(input.contrato?.numero || `CTR-${now.slice(0, 4)}-${String(listAccounts().length + 1).padStart(4, '0')}`),
      fechaInicio: String(input.contrato.fechaInicio),
      fechaTermino: input.contrato?.fechaTermino || undefined,
      renovacionAutomatica: input.contrato?.renovacionAutomatica !== false,
      diaFacturacion: Math.min(28, Math.max(1, Number(input.contrato?.diaFacturacion || 1))),
      diasPlazoPago: Math.max(0, Number(input.contrato?.diasPlazoPago ?? 0)),
      fechaFinPrueba: input.contrato?.fechaFinPrueba || undefined,
    },
    cobranza: normalizeCollection(input.cobranza),
    estado: estadoInicial,
    historialEstados: [{ fecha: now, de: null, a: estadoInicial, motivo: 'Alta del cliente ERP', usuarioId, automatico: false }],
    esPropietario: Boolean(input.esPropietario),
    creadoEn: now,
    actualizadoEn: now,
  };
  saveAccounts([...listAccounts(), acc]);
  audit('CREAR_CLIENTE_ERP', acc.id, { rut: acc.rut, planId: acc.planId, condiciones: acc.condiciones }, usuarioId);
  if (Array.isArray(input.empresasIds) && input.empresasIds.length) assignCompanies(acc.id, input.empresasIds, usuarioId);
  return acc;
}

export function normalizeCollection(c: any): SaasCollectionSettings {
  const out: SaasCollectionSettings = {
    diasAvisoAtraso: Number(c?.diasAvisoAtraso ?? DEFAULT_COLLECTION_SETTINGS.diasAvisoAtraso),
    diasUltimoRecordatorio: Number(c?.diasUltimoRecordatorio ?? DEFAULT_COLLECTION_SETTINGS.diasUltimoRecordatorio),
    diasBloqueo: Number(c?.diasBloqueo ?? DEFAULT_COLLECTION_SETTINGS.diasBloqueo),
  };
  if (!(out.diasAvisoAtraso >= 0 && out.diasAvisoAtraso <= out.diasUltimoRecordatorio && out.diasUltimoRecordatorio <= out.diasBloqueo)) {
    throw new SaasError(400, 'PLAZOS_INVALIDOS', 'Los plazos deben cumplir: aviso ≤ último recordatorio ≤ bloqueo.');
  }
  return out;
}

export function updateAccount(id: string, input: any, usuarioId?: string): SaasAccount {
  const acc = getAccount(id);
  if (!acc) throw new SaasError(404, 'CLIENTE_ERP_NO_EXISTE', 'El cliente ERP no existe.');
  if (input.rut && normalizeCompanyKey(input.rut) !== normalizeCompanyKey(acc.rut)) throw new SaasError(400, 'RUT_INMUTABLE', 'El RUT no se puede cambiar.');
  if (input.planId && !ERP_SUBSCRIPTION_PLANS.some((p) => p.id === input.planId)) throw new SaasError(400, 'PLAN_INVALIDO', 'Plan inexistente.');
  const planCambio = input.planId && input.planId !== acc.planId;
  const next: SaasAccount = {
    ...acc,
    tipo: input.tipo || acc.tipo,
    razonSocial: input.razonSocial ? String(input.razonSocial).trim() : acc.razonSocial,
    giro: input.giro ?? acc.giro,
    direccion: input.direccion ?? acc.direccion,
    comuna: input.comuna ?? acc.comuna,
    ciudad: input.ciudad ?? acc.ciudad,
    emailFacturacion: input.emailFacturacion ? String(input.emailFacturacion).trim().toLowerCase() : acc.emailFacturacion,
    contactoCobranza: input.contactoCobranza ? { ...acc.contactoCobranza, ...input.contactoCobranza } : acc.contactoCobranza,
    planId: input.planId || acc.planId,
    // Las condiciones negociadas se conservan salvo que se envíen o cambie el plan (A9)
    condiciones: input.condiciones || planCambio ? normalizeConditions({ ...input, planId: input.planId || acc.planId }, planCambio ? undefined : acc.condiciones) : acc.condiciones,
    contrato: input.contrato
      ? {
          ...acc.contrato,
          ...input.contrato,
          diaFacturacion: Math.min(28, Math.max(1, Number(input.contrato.diaFacturacion ?? acc.contrato.diaFacturacion))),
          diasPlazoPago: Math.max(0, Number(input.contrato.diasPlazoPago ?? acc.contrato.diasPlazoPago)),
        }
      : acc.contrato,
    cobranza: input.cobranza ? normalizeCollection({ ...acc.cobranza, ...input.cobranza }) : acc.cobranza,
    actualizadoEn: new Date().toISOString(),
  };
  saveAccounts(listAccounts().map((a) => (a.id === id ? next : a)));
  audit('ACTUALIZAR_CLIENTE_ERP', id, { planId: next.planId, condiciones: next.condiciones, contrato: next.contrato, cobranza: next.cobranza }, usuarioId);
  return next;
}

/** Cambia el estado del cliente ERP y lo registra en su historial y en la bitácora. */
export function changeAccountState(id: string, estado: SaasAccountState, motivo: string, opts: { usuarioId?: string; automatico?: boolean } = {}): SaasAccount {
  const acc = getAccount(id);
  if (!acc) throw new SaasError(404, 'CLIENTE_ERP_NO_EXISTE', 'El cliente ERP no existe.');
  if (!ESTADOS.includes(estado)) throw new SaasError(400, 'ESTADO_INVALIDO', 'Estado inválido.');
  if (acc.esPropietario && estado !== 'ACTIVA') throw new SaasError(400, 'PROPIETARIO', 'El cliente ERP propietario no se suspende ni se da de baja.');
  if (!String(motivo || '').trim()) throw new SaasError(400, 'MOTIVO_REQUERIDO', 'Indique el motivo del cambio de estado.');
  if (acc.estado === 'BAJA' && estado !== 'BAJA') throw new SaasError(409, 'CLIENTE_DADO_DE_BAJA', 'Un cliente dado de baja no se reactiva; cree un nuevo contrato.');
  if (acc.estado === estado) return acc;
  const now = new Date().toISOString();
  const next: SaasAccount = {
    ...acc,
    estado,
    motivoEstado: motivo,
    historialEstados: [...acc.historialEstados, { fecha: now, de: acc.estado, a: estado, motivo, usuarioId: opts.usuarioId, automatico: Boolean(opts.automatico) }],
    actualizadoEn: now,
    ...(estado === 'BAJA' ? { fechaBaja: now } : {}),
  };
  saveAccounts(listAccounts().map((a) => (a.id === id ? next : a)));
  audit(`ESTADO_CLIENTE_ERP_${estado}`, id, { de: acc.estado, a: estado, motivo, automatico: Boolean(opts.automatico) }, opts.usuarioId);
  return next;
}

export function setAccountBackup(id: string, respaldo: SaasAccount['respaldoBaja']): void {
  saveAccounts(listAccounts().map((a) => (a.id === id ? { ...a, respaldoBaja: respaldo, actualizadoEn: new Date().toISOString() } : a)));
}

/** Asigna empresas a un cliente ERP (respetando su límite). */
export function assignCompanies(accountId: string, empresasIds: string[], usuarioId?: string): void {
  const acc = getAccount(accountId);
  if (!acc) throw new SaasError(404, 'CLIENTE_ERP_NO_EXISTE', 'El cliente ERP no existe.');
  const list = listCompanies();
  const targets = empresasIds.map((id) => findCompany(id)).filter(Boolean) as any[];
  if (targets.length !== empresasIds.length) throw new SaasError(400, 'EMPRESA_NO_EXISTE', 'Alguna empresa no existe.');
  const nuevas = targets.filter((c) => c.clienteErpId !== accountId && c.estadoEmpresa !== 'BAJA');
  if (!acc.esPropietario && companiesOfAccount(accountId).length + nuevas.length > acc.condiciones.limiteEmpresas) {
    throw new SaasError(409, 'LIMITE_EMPRESAS', `${acc.razonSocial} superaría el límite de ${acc.condiciones.limiteEmpresas} empresas.`);
  }
  const ids = new Set(targets.map((c) => c.id));
  saveCompanies(list.map((c) => (ids.has(c.id) ? { ...c, clienteErpId: accountId, ...(acc.esPropietario ? { esEmpresaDuenaErp: true } : {}) } : c)));
  audit('ASIGNAR_EMPRESAS_CLIENTE_ERP', accountId, { empresas: [...ids] }, usuarioId);
}

// --------------------------------------------------------------------------
// Cliente ERP propietario (la empresa dueña del ERP)
// --------------------------------------------------------------------------

export function buildOwnerAccount(input: { rut: string; razonSocial: string; email?: string }): SaasAccount {
  const now = new Date().toISOString();
  return {
    id: `cerp-${crypto.randomUUID().slice(0, 12)}`,
    tipo: 'EMPRESA',
    rut: String(input.rut).trim().toUpperCase(),
    razonSocial: input.razonSocial,
    emailFacturacion: input.email || '',
    contactoCobranza: { nombre: input.razonSocial, email: input.email || '' },
    planId: 'PROPIETARIO',
    condiciones: { precioMensualNetoClp: 0, limiteEmpresas: 0, limiteUsuarios: 0, modulos: [] },
    contrato: { numero: 'PROPIETARIO', fechaInicio: now.slice(0, 10), renovacionAutomatica: true, diaFacturacion: 1, diasPlazoPago: 0 },
    cobranza: { ...DEFAULT_COLLECTION_SETTINGS },
    estado: 'ACTIVA',
    historialEstados: [{ fecha: now, de: null, a: 'ACTIVA', motivo: 'Cliente ERP propietario', automatico: true }],
    esPropietario: true,
    creadoEn: now,
    actualizadoEn: now,
  };
}

/**
 * Instalaciones anteriores a K3: crea el cliente ERP propietario a partir de la empresa marcada como
 * dueña del ERP (en la cartera o en seguridad) y le asigna esa empresa.
 */
export function ensureOwnerAccount(rbacCompanies: Array<{ empresaId: string; esEmpresaDuenaErp?: boolean }> = []): SaasAccount | null {
  const existing = ownerAccount();
  if (existing) return existing;
  const duenas = listCompanies().filter(
    (c) => c.esEmpresaDuenaErp || rbacCompanies.some((r) => r.esEmpresaDuenaErp && normalizeCompanyKey(r.empresaId) === normalizeCompanyKey(c.id))
  );
  if (!duenas.length) return null;
  const acc = buildOwnerAccount({ rut: duenas[0].rut, razonSocial: duenas[0].razonSocial, email: duenas[0].emailFacturacion || duenas[0].email });
  saveAccounts([...listAccounts(), acc]);
  const ids = new Set(duenas.map((d) => d.id));
  saveCompanies(listCompanies().map((c) => (ids.has(c.id) ? { ...c, clienteErpId: acc.id, esEmpresaDuenaErp: true } : c)));
  audit('CREAR_CLIENTE_ERP_PROPIETARIO', acc.id, { empresas: [...ids] });
  return acc;
}
