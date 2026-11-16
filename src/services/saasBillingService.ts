/**
 * K4 · Facturación y cobranza automática de las suscripciones.
 *
 * - El ERP administra la empresa dueña: cada mes genera un borrador de factura por cliente ERP según
 *   su contrato y pide la emisión con el módulo DTE de la empresa dueña, detrás de la aprobación
 *   humana existente (operación EMITIR_DTE). También se puede registrar una factura emitida fuera
 *   del ERP (folio manual), por ejemplo desde el portal del SII.
 * - Pagos: registro manual o calce sugerido con los abonos de la cartola de la empresa dueña.
 * - Tarea diaria: mora desde el primer día de atraso; aviso por correo a los N días, último
 *   recordatorio a los M días y bloqueo total (SUSPENDIDA) a los K días (5/10/15 por defecto,
 *   parametrizable por cliente). El pago reactiva de inmediato una suspensión por mora.
 * - Baja: respaldo comprimido y verificado (SHA-256) de toda la información del cliente, conservado
 *   10 años fuera de la base de trabajo; opcionalmente se retira de la operación.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { diskPersistence } from './diskPersistenceService';
import { companyKeys, findCompany, normalizeCompanyKey, saveCompanies, listCompanies } from './companyRegistryService';
import {
  changeAccountState,
  companiesOfAccount,
  getAccount,
  listAccounts,
  ownerAccount,
  SaasError,
  setAccountBackup,
  type SaasAccount,
} from './saasAccountService';
import { sendSaasNotification } from './saasNotificationService';
import { whatsappBridgeService } from './whatsappBridgeService';

export type SaasInvoiceState = 'BORRADOR' | 'PENDIENTE_APROBACION' | 'EMITIDA' | 'PAGADA' | 'ANULADA' | 'ERROR_EMISION';

export interface SaasInvoice {
  id: string;
  clienteErpId: string;
  periodo: string;
  concepto: string;
  neto: number;
  iva: number;
  total: number;
  pagado: number;
  estado: SaasInvoiceState;
  fechaGeneracion: string;
  fechaEmision?: string;
  fechaVencimiento?: string;
  folio?: number | string;
  trackId?: string;
  approvalId?: string;
  emisionExterna?: boolean;
  error?: string;
  avisos: Partial<Record<'AVISO_ATRASO' | 'ULTIMO_RECORDATORIO' | 'AVISO_BLOQUEO', string>>;
}

export interface SaasPayment {
  id: string;
  invoiceId: string;
  clienteErpId: string;
  monto: number;
  fecha: string;
  medio: string;
  referencia?: string;
  bankMovementId?: string;
  registradoPor?: string;
  registradoEn: string;
}

export const MORA_PREFIX = 'MORA: ';
const IVA = 0.19;
const RETENCION_ANOS = 10;
const store = () => diskPersistence.getSnapshot() as any;

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (date: string, n: number) => ymd(new Date(new Date(`${date}T12:00:00Z`).getTime() + n * 86400000));
const daysBetween = (from: string, to: string) => Math.floor((new Date(`${to}T12:00:00Z`).getTime() - new Date(`${from}T12:00:00Z`).getTime()) / 86400000);

export function listInvoices(clienteErpId?: string): SaasInvoice[] {
  const all = (store().saasInvoices || []) as SaasInvoice[];
  return clienteErpId ? all.filter((i) => i.clienteErpId === clienteErpId) : all;
}
function saveInvoices(list: SaasInvoice[]) {
  diskPersistence.updateCollection('saasInvoices', list);
}
function updateInvoice(id: string, patch: Partial<SaasInvoice>): SaasInvoice {
  let out: SaasInvoice | null = null;
  saveInvoices(
    listInvoices().map((i) => {
      if (i.id !== id) return i;
      out = { ...i, ...patch };
      return out;
    })
  );
  if (!out) throw new SaasError(404, 'FACTURA_NO_EXISTE', 'La factura no existe.');
  return out;
}
export function listPayments(clienteErpId?: string): SaasPayment[] {
  const all = (store().saasPayments || []) as SaasPayment[];
  return clienteErpId ? all.filter((p) => p.clienteErpId === clienteErpId) : all;
}

function audit(accion: string, entidadId: string, datos: any, usuarioId?: string) {
  diskPersistence.addAuditLog({
    id: `audit-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
    fecha: new Date().toISOString(),
    entidadTipo: 'SAAS_BILLING',
    entidadId,
    accion,
    usuarioId,
    datosNuevos: datos,
  });
}

// --------------------------------------------------------------------------
// Facturas
// --------------------------------------------------------------------------

export function createInvoiceDraft(acc: SaasAccount, periodo: string, usuarioId?: string): SaasInvoice {
  if (acc.esPropietario) throw new SaasError(400, 'PROPIETARIO', 'La empresa dueña del ERP no se factura a sí misma.');
  if (!/^\d{4}-\d{2}$/.test(periodo)) throw new SaasError(400, 'PERIODO_INVALIDO', 'Período AAAA-MM.');
  const existente = listInvoices(acc.id).find((i) => i.periodo === periodo && i.estado !== 'ANULADA');
  if (existente) throw new SaasError(409, 'FACTURA_EXISTE', `Ya existe la factura de ${periodo} para ${acc.razonSocial}.`, { invoiceId: existente.id });
  const neto = Math.round(acc.condiciones.precioMensualNetoClp);
  if (!(neto > 0)) throw new SaasError(400, 'PRECIO_NO_DEFINIDO', `${acc.razonSocial} no tiene precio mensual en su contrato.`);
  const iva = Math.round(neto * IVA);
  const inv: SaasInvoice = {
    id: `sinv-${crypto.randomUUID().slice(0, 12)}`,
    clienteErpId: acc.id,
    periodo,
    concepto: `Suscripción ERP ${acc.planId} · ${periodo}`,
    neto,
    iva,
    total: neto + iva,
    pagado: 0,
    estado: 'BORRADOR',
    fechaGeneracion: new Date().toISOString(),
    avisos: {},
  };
  saveInvoices([inv, ...listInvoices()]);
  audit('GENERAR_FACTURA_SUSCRIPCION', inv.id, { clienteErpId: acc.id, periodo, total: inv.total }, usuarioId);
  return inv;
}

/** Pide la emisión de la factura con el DTE de la empresa dueña (queda pendiente de aprobación humana). */
export async function requestInvoiceEmission(invoiceId: string, usuarioId?: string): Promise<SaasInvoice> {
  const inv = listInvoices().find((i) => i.id === invoiceId);
  if (!inv) throw new SaasError(404, 'FACTURA_NO_EXISTE', 'La factura no existe.');
  if (!['BORRADOR', 'ERROR_EMISION'].includes(inv.estado)) throw new SaasError(409, 'ESTADO_INVALIDO', `La factura está ${inv.estado}.`);
  const acc = getAccount(inv.clienteErpId)!;
  const owner = ownerAccount();
  const ownerCompany = owner ? companiesOfAccount(owner.id)[0] : listCompanies().find((c) => c.esEmpresaDuenaErp);
  if (!ownerCompany) throw new SaasError(409, 'SIN_EMPRESA_DUENA', 'No hay empresa dueña del ERP configurada para emitir las facturas.');
  const faltan = [!acc.giro && 'giro', !acc.direccion && 'dirección', !acc.comuna && 'comuna'].filter(Boolean);
  if (faltan.length) {
    throw new SaasError(400, 'MISSING_PARAMS', `Faltan datos tributarios de ${acc.razonSocial} para facturar: ${faltan.join(', ')}.`, { missingParams: faltan });
  }
  const { HrManagementService } = await import('./hrManagementService');
  const approval = HrManagementService.requestModuleApproval({
    empresaId: ownerCompany.id,
    modulo: 'TRIBUTARIO_SII',
    agenteNombre: 'Administración del ERP',
    operacionTipo: 'EMITIR_DTE',
    titulo: `Factura suscripción ${inv.periodo} · ${acc.razonSocial}`,
    descripcion: `${inv.concepto}. Neto $${inv.neto.toLocaleString('es-CL')} + IVA.`,
    datosOperacion: {
      tipoDte: 33,
      receptorRut: acc.rut,
      receptorRazonSocial: acc.razonSocial,
      giroReceptor: acc.giro,
      direccionReceptor: acc.direccion,
      comunaReceptor: acc.comuna,
      ciudadReceptor: acc.ciudad,
      items: [{ nombre: inv.concepto, cantidad: 1, precioUnitario: inv.neto }],
      saasInvoiceId: inv.id,
    },
    impactoFinancieroClp: inv.total,
    riesgoNivel: 'BAJO',
    solicitadoPorUserId: usuarioId,
  } as any);
  const out = updateInvoice(inv.id, { estado: 'PENDIENTE_APROBACION', approvalId: approval.id, error: undefined });
  audit('SOLICITAR_EMISION_FACTURA', inv.id, { approvalId: approval.id }, usuarioId);
  return out;
}

/** Actualiza las facturas según el resultado de su aprobación (emitida, rechazada o con error). */
export async function syncInvoicesWithApprovals(): Promise<number> {
  const { HrManagementService } = await import('./hrManagementService');
  let cambios = 0;
  for (const inv of listInvoices().filter((i) => i.estado === 'PENDIENTE_APROBACION' && i.approvalId)) {
    const ap = HrManagementService.getApprovalById(inv.approvalId!);
    if (!ap) continue;
    const acc = getAccount(inv.clienteErpId);
    if (ap.estado === 'EJECUTADO') {
      const fechaEmision = (ap.resueltoEn || new Date().toISOString()).slice(0, 10);
      updateInvoice(inv.id, {
        estado: 'EMITIDA',
        folio: ap.folioEmitido,
        trackId: ap.trackId,
        fechaEmision,
        fechaVencimiento: addDays(fechaEmision, acc?.contrato.diasPlazoPago ?? 0),
      });
      cambios++;
    } else if (ap.estado === 'RECHAZADO') {
      updateInvoice(inv.id, { estado: 'BORRADOR', approvalId: undefined, error: 'La emisión fue rechazada en la aprobación.' });
      cambios++;
    } else if (ap.estado === 'ERROR_EJECUCION') {
      updateInvoice(inv.id, { estado: 'ERROR_EMISION', error: ap.resultadoEjecucion || 'Error al emitir el DTE.' });
      cambios++;
    }
  }
  return cambios;
}

export function registerExternalEmission(invoiceId: string, input: { folio: string | number; fechaEmision: string }, usuarioId?: string): SaasInvoice {
  const inv = listInvoices().find((i) => i.id === invoiceId);
  if (!inv) throw new SaasError(404, 'FACTURA_NO_EXISTE', 'La factura no existe.');
  if (!['BORRADOR', 'ERROR_EMISION'].includes(inv.estado)) throw new SaasError(409, 'ESTADO_INVALIDO', `La factura está ${inv.estado}.`);
  if (!input?.folio || !/^\d{4}-\d{2}-\d{2}$/.test(String(input.fechaEmision || ''))) {
    throw new SaasError(400, 'MISSING_PARAMS', 'Indique folio y fecha de emisión (AAAA-MM-DD).');
  }
  const acc = getAccount(inv.clienteErpId)!;
  const out = updateInvoice(inv.id, {
    estado: 'EMITIDA',
    emisionExterna: true,
    folio: input.folio,
    fechaEmision: input.fechaEmision,
    fechaVencimiento: addDays(input.fechaEmision, acc.contrato.diasPlazoPago),
    error: undefined,
  });
  audit('REGISTRAR_EMISION_EXTERNA', inv.id, { folio: input.folio, fechaEmision: input.fechaEmision }, usuarioId);
  return out;
}

export function voidInvoice(invoiceId: string, motivo: string, usuarioId?: string): SaasInvoice {
  const inv = listInvoices().find((i) => i.id === invoiceId);
  if (!inv) throw new SaasError(404, 'FACTURA_NO_EXISTE', 'La factura no existe.');
  if (!String(motivo || '').trim()) throw new SaasError(400, 'MOTIVO_REQUERIDO', 'Indique el motivo.');
  if (inv.estado === 'PAGADA' || inv.pagado > 0) throw new SaasError(409, 'FACTURA_CON_PAGOS', 'Una factura con pagos no se anula (emita una nota de crédito).');
  if (inv.estado === 'EMITIDA') throw new SaasError(409, 'FACTURA_EMITIDA', 'Una factura emitida se anula con nota de crédito en el módulo DTE; luego regístrela aquí.');
  const out = updateInvoice(inv.id, { estado: 'ANULADA', error: motivo });
  audit('ANULAR_FACTURA_SUSCRIPCION', inv.id, { motivo }, usuarioId);
  return out;
}

// --------------------------------------------------------------------------
// Pagos
// --------------------------------------------------------------------------

export async function registerPayment(
  input: { invoiceId: string; monto: number; fecha: string; medio: string; referencia?: string; bankMovementId?: string },
  usuarioId?: string
): Promise<{ pago: SaasPayment; factura: SaasInvoice; cuenta: SaasAccount }> {
  const inv = listInvoices().find((i) => i.id === input?.invoiceId);
  if (!inv) throw new SaasError(404, 'FACTURA_NO_EXISTE', 'La factura no existe.');
  if (inv.estado !== 'EMITIDA') throw new SaasError(409, 'ESTADO_INVALIDO', `Solo se registran pagos de facturas emitidas (está ${inv.estado}).`);
  const monto = Math.round(Number(input.monto));
  if (!(monto > 0)) throw new SaasError(400, 'MONTO_INVALIDO', 'El monto debe ser mayor a 0.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(input.fecha || ''))) throw new SaasError(400, 'MISSING_PARAMS', 'Indique la fecha del pago (AAAA-MM-DD).');
  if (!String(input.medio || '').trim()) throw new SaasError(400, 'MISSING_PARAMS', 'Indique el medio de pago.');
  const saldo = inv.total - inv.pagado;
  if (monto > saldo) throw new SaasError(400, 'MONTO_EXCEDE_SALDO', `El pago ($${monto.toLocaleString('es-CL')}) supera el saldo ($${saldo.toLocaleString('es-CL')}).`);
  if (input.bankMovementId && listPayments().some((p) => p.bankMovementId === input.bankMovementId)) {
    throw new SaasError(409, 'MOVIMIENTO_YA_USADO', 'Ese abono bancario ya está asociado a otro pago.');
  }
  const pago: SaasPayment = {
    id: `spay-${crypto.randomUUID().slice(0, 12)}`,
    invoiceId: inv.id,
    clienteErpId: inv.clienteErpId,
    monto,
    fecha: input.fecha,
    medio: String(input.medio).trim(),
    referencia: input.referencia,
    bankMovementId: input.bankMovementId,
    registradoPor: usuarioId,
    registradoEn: new Date().toISOString(),
  };
  diskPersistence.updateCollection('saasPayments', [pago, ...listPayments()]);
  const pagado = inv.pagado + monto;
  const factura = updateInvoice(inv.id, { pagado, estado: pagado >= inv.total ? 'PAGADA' : 'EMITIDA' });
  audit('REGISTRAR_PAGO_SUSCRIPCION', inv.id, { monto, fecha: input.fecha, medio: input.medio }, usuarioId);
  // Se evalúa a la fecha más tardía entre hoy y la fecha del pago.
  const fechaPago = new Date(`${input.fecha}T12:00:00Z`);
  const cuenta = await evaluateAccount(inv.clienteErpId, fechaPago > new Date() ? fechaPago : new Date(), { soloReactivar: true });
  return { pago, factura, cuenta };
}

/** Abonos de la cartola de la empresa dueña que calzan en monto con el saldo de una factura emitida. */
export function suggestPaymentMatches(): Array<{ invoiceId: string; clienteErpId: string; razonSocial: string; saldo: number; movimiento: any; confianza: 'ALTA' | 'MEDIA' }> {
  const owner = ownerAccount();
  if (!owner) return [];
  const keys = new Set(companiesOfAccount(owner.id).flatMap((c) => companyKeys(c.id)));
  const usados = new Set(listPayments().map((p) => p.bankMovementId).filter(Boolean));
  const abonos = (store().bankMovements || []).filter(
    (m: any) => keys.has(normalizeCompanyKey(m.empresaId || m.empresaRut)) && !usados.has(m.id) && Number(m.abono ?? m.montoAbono ?? (m.monto > 0 ? m.monto : 0)) > 0
  );
  const out: ReturnType<typeof suggestPaymentMatches> = [];
  for (const inv of listInvoices().filter((i) => i.estado === 'EMITIDA')) {
    const acc = getAccount(inv.clienteErpId);
    if (!acc) continue;
    const saldo = inv.total - inv.pagado;
    const rutDigits = acc.rut.replace(/[^0-9kK]/g, '').slice(0, -1);
    for (const m of abonos) {
      const monto = Number(m.abono ?? m.montoAbono ?? m.monto);
      if (monto !== saldo) continue;
      const glosa = String(m.glosaBancaria || m.glosa || m.descripcion || '').toUpperCase();
      const mencionaCliente = glosa.replace(/[^0-9]/g, '').includes(rutDigits) || glosa.includes(acc.razonSocial.split(' ')[0].toUpperCase());
      out.push({ invoiceId: inv.id, clienteErpId: acc.id, razonSocial: acc.razonSocial, saldo, movimiento: m, confianza: mencionaCliente ? 'ALTA' : 'MEDIA' });
    }
  }
  return out;
}

// --------------------------------------------------------------------------
// Evaluación diaria de cada cliente
// --------------------------------------------------------------------------

export function overdueDays(accountId: string, today: string): number {
  const vencidas = listInvoices(accountId).filter((i) => i.estado === 'EMITIDA' && i.fechaVencimiento && i.fechaVencimiento < today && i.total - i.pagado > 0);
  if (!vencidas.length) return 0;
  return Math.max(...vencidas.map((i) => daysBetween(i.fechaVencimiento!, today)));
}

function oldestOverdueInvoice(accountId: string, today: string): SaasInvoice | null {
  const vencidas = listInvoices(accountId)
    .filter((i) => i.estado === 'EMITIDA' && i.fechaVencimiento && i.fechaVencimiento < today && i.total - i.pagado > 0)
    .sort((a, b) => String(a.fechaVencimiento).localeCompare(String(b.fechaVencimiento)));
  return vencidas[0] || null;
}

function noticeText(acc: SaasAccount, inv: SaasInvoice, tipo: 'AVISO_ATRASO' | 'ULTIMO_RECORDATORIO' | 'AVISO_BLOQUEO', dias: number) {
  const saldo = (inv.total - inv.pagado).toLocaleString('es-CL');
  const base = `Factura ${inv.folio ? `folio ${inv.folio}` : inv.id} (${inv.periodo}), vencida el ${inv.fechaVencimiento}, saldo $${saldo}.`;
  if (tipo === 'AVISO_ATRASO') {
    return {
      asunto: `Pago pendiente de su suscripción ERP (${dias} días de atraso)`,
      cuerpo: `Estimados ${acc.razonSocial}:\n\n${base}\n\nSi el pago no se registra, el acceso se bloqueará a los ${acc.cobranza.diasBloqueo} días de atraso.`,
    };
  }
  if (tipo === 'ULTIMO_RECORDATORIO') {
    return {
      asunto: `Último recordatorio: el acceso al ERP se bloqueará en ${acc.cobranza.diasBloqueo - dias} días`,
      cuerpo: `Estimados ${acc.razonSocial}:\n\n${base}\n\nEl ${addDays(inv.fechaVencimiento!, acc.cobranza.diasBloqueo)} se bloqueará el acceso de todos sus usuarios.`,
    };
  }
  return {
    asunto: 'Acceso al ERP bloqueado por falta de pago',
    cuerpo: `Estimados ${acc.razonSocial}:\n\n${base}\n\nEl acceso de todos sus usuarios quedó bloqueado. Se rehabilita automáticamente al registrarse el pago.`,
  };
}

/**
 * Evalúa un cliente: mora, avisos, bloqueo y reactivación. soloReactivar = solo reactivar si ya no
 * hay deuda vencida (al registrar un pago).
 */
export async function evaluateAccount(accountId: string, now: Date, opts: { soloReactivar?: boolean } = {}): Promise<SaasAccount> {
  let acc = getAccount(accountId);
  if (!acc) throw new SaasError(404, 'CLIENTE_ERP_NO_EXISTE', 'El cliente ERP no existe.');
  if (acc.esPropietario || acc.estado === 'BAJA') return acc;
  const today = ymd(now);
  const dias = overdueDays(acc.id, today);
  const suspendidoPorMora = acc.estado === 'SUSPENDIDA' && String(acc.motivoEstado || '').startsWith(MORA_PREFIX);

  if (dias === 0) {
    if (acc.estado === 'EN_MORA' || suspendidoPorMora) {
      acc = changeAccountState(acc.id, 'ACTIVA', 'Sin deuda vencida: pago registrado.', { automatico: true });
      await sendSaasNotification({
        clienteErpId: acc.id,
        tipo: 'REACTIVACION',
        para: [acc.contactoCobranza.email, acc.emailFacturacion],
        asunto: 'Acceso al ERP rehabilitado',
        cuerpo: `Estimados ${acc.razonSocial}:\n\nRegistramos su pago y el acceso de sus usuarios quedó rehabilitado.`,
      });
    }
    return acc;
  }
  if (opts.soloReactivar) return acc;

  const inv = oldestOverdueInvoice(acc.id, today)!;
  if (acc.estado === 'ACTIVA' || acc.estado === 'PRUEBA') {
    acc = changeAccountState(acc.id, 'EN_MORA', `${MORA_PREFIX}${dias} días de atraso (factura ${inv.folio || inv.id}).`, { automatico: true });
  }
  const steps: Array<['AVISO_ATRASO' | 'ULTIMO_RECORDATORIO' | 'AVISO_BLOQUEO', number]> = [
    ['AVISO_ATRASO', acc.cobranza.diasAvisoAtraso],
    ['ULTIMO_RECORDATORIO', acc.cobranza.diasUltimoRecordatorio],
    ['AVISO_BLOQUEO', acc.cobranza.diasBloqueo],
  ];
  for (const [tipo, umbral] of steps) {
    if (dias < umbral || inv.avisos[tipo]) continue;
    if (tipo === 'AVISO_BLOQUEO' && acc.estado !== 'SUSPENDIDA') {
      acc = changeAccountState(acc.id, 'SUSPENDIDA', `${MORA_PREFIX}${dias} días de atraso; bloqueo total según contrato.`, { automatico: true });
    }
    const t = noticeText(acc, inv, tipo, dias);
    await sendSaasNotification({ clienteErpId: acc.id, invoiceId: inv.id, tipo, para: [acc.contactoCobranza.email, acc.emailFacturacion], ...t });
    inv.avisos = { ...inv.avisos, [tipo]: new Date().toISOString() };
    updateInvoice(inv.id, { avisos: inv.avisos });
  }
  // Si se superó el bloqueo sin haber pasado por los avisos (por ejemplo, el servidor estuvo detenido), igual se bloquea.
  if (dias >= acc.cobranza.diasBloqueo && acc.estado !== 'SUSPENDIDA') {
    acc = changeAccountState(acc.id, 'SUSPENDIDA', `${MORA_PREFIX}${dias} días de atraso; bloqueo total según contrato.`, { automatico: true });
  }
  return acc;
}

export interface DailyCycleResult {
  fecha: string;
  facturasGeneradas: number;
  emisionesSolicitadas: number;
  aprobacionesSincronizadas: number;
  cambiosDeEstado: Array<{ clienteErpId: string; de: string; a: string }>;
  errores: Array<{ clienteErpId?: string; error: string }>;
}

/** Tarea diaria (idempotente por día salvo force). */
export async function runDailyBillingCycle(now = new Date(), opts: { force?: boolean; solicitarEmision?: boolean } = {}): Promise<DailyCycleResult> {
  const fecha = ymd(now);
  const settings = store().saasSettings || {};
  const result: DailyCycleResult = { fecha, facturasGeneradas: 0, emisionesSolicitadas: 0, aprobacionesSincronizadas: 0, cambiosDeEstado: [], errores: [] };
  if (!opts.force && settings.ultimoCiclo === fecha) return result;

  result.aprobacionesSincronizadas = await syncInvoicesWithApprovals();
  const periodo = fecha.slice(0, 7);
  const dia = Number(fecha.slice(8, 10));

  for (const acc0 of listAccounts()) {
    if (acc0.esPropietario || acc0.estado === 'BAJA') continue;
    const antes = acc0.estado;
    try {
      let acc = acc0;
      // Fin del período de prueba
      if (acc.estado === 'PRUEBA' && acc.contrato.fechaFinPrueba && acc.contrato.fechaFinPrueba < fecha) {
        acc = changeAccountState(acc.id, 'ACTIVA', 'Fin del período de prueba.', { automatico: true });
      }
      // Contrato vencido sin renovación automática
      if (acc.contrato.fechaTermino && acc.contrato.fechaTermino < fecha && !acc.contrato.renovacionAutomatica && acc.estado !== 'SUSPENDIDA') {
        acc = changeAccountState(acc.id, 'SUSPENDIDA', `Contrato vencido el ${acc.contrato.fechaTermino} sin renovación.`, { automatico: true });
      }
      // Factura del mes (no en prueba ni suspendido)
      if (['ACTIVA', 'EN_MORA'].includes(acc.estado) && dia >= acc.contrato.diaFacturacion && acc.contrato.fechaInicio <= fecha) {
        const yaExiste = listInvoices(acc.id).some((i) => i.periodo === periodo && i.estado !== 'ANULADA');
        if (!yaExiste) {
          const inv = createInvoiceDraft(acc, periodo);
          result.facturasGeneradas++;
          if (opts.solicitarEmision !== false) {
            try {
              await requestInvoiceEmission(inv.id);
              result.emisionesSolicitadas++;
            } catch (e: any) {
              updateInvoice(inv.id, { error: e?.message || String(e) });
              result.errores.push({ clienteErpId: acc.id, error: e?.message || String(e) });
            }
          }
        }
      }
      acc = await evaluateAccount(acc.id, now);
      if (acc.estado !== antes) result.cambiosDeEstado.push({ clienteErpId: acc.id, de: antes, a: acc.estado });
    } catch (e: any) {
      result.errores.push({ clienteErpId: acc0.id, error: e?.message || String(e) });
    }
  }
  diskPersistence.updateCollection('saasSettings', { ...settings, ultimoCiclo: fecha, ultimoResultado: result } as any);
  audit('CICLO_DIARIO_COBRANZA', fecha, result);
  return result;
}

let timer: NodeJS.Timeout | null = null;
/** Ejecuta el ciclo al arrancar y luego cada hora (solo hace trabajo una vez por día). Una sola instancia. */
export function startSaasBillingScheduler(): void {
  if (timer) return;
  const tick = () => runDailyBillingCycle().catch((e) => console.error('[SaaS] Error en el ciclo diario de cobranza:', e));
  setTimeout(tick, 30_000);
  timer = setInterval(tick, 60 * 60 * 1000);
}

// --------------------------------------------------------------------------
// Baja con respaldo de 10 años
// --------------------------------------------------------------------------

const COMPANY_COLLECTIONS = [
  'entries',
  'dtes',
  'employees',
  'payrolls',
  'bankAccounts',
  'bankMovements',
  'warehouses',
  'inventoryItems',
  'costCenters',
  'fixedAssets',
  'expenseReports',
  'expenseItems',
  'expenseProjects',
  'credentialsVault',
  'rfqRequests',
  'rfqSupplierResponses',
  'purchaseOrders',
  'commercialQuotes',
  'governanceApprovals',
  'warehouseTransfers',
  'replenishmentRequisitions',
  'stockMovements',
];
const COMPANY_KEYED = ['chartsOfAccounts', 'auxiliaries', 'groups', 'financialNotes', 'clientStates', 'chartsMeta', 'companySystemParameters'];

function belongsTo(keys: Set<string>, rec: any): boolean {
  return [rec?.empresaId, rec?.empresaRut, rec?.companyId, rec?.rutEmpresa].some((v) => v && keys.has(normalizeCompanyKey(v)));
}

export function backupDirectory(): string {
  return path.resolve(process.env.SAAS_BACKUP_DIR || path.join(process.cwd(), 'storage', 'respaldos-bajas'));
}

/**
 * Da de baja un cliente ERP: respaldo comprimido y verificado, empresas y usuarios desactivados y,
 * si se pide, retiro de su información de la base de trabajo (solo después de verificar el respaldo).
 */
export async function closeAccountWithBackup(
  accountId: string,
  input: { motivo: string; confirmacionRut: string; retirarDeOperacion?: boolean },
  usuarioId?: string
): Promise<SaasAccount> {
  const acc = getAccount(accountId);
  if (!acc) throw new SaasError(404, 'CLIENTE_ERP_NO_EXISTE', 'El cliente ERP no existe.');
  if (acc.esPropietario) throw new SaasError(400, 'PROPIETARIO', 'El cliente ERP propietario no se da de baja.');
  if (!String(input?.motivo || '').trim()) throw new SaasError(400, 'MOTIVO_REQUERIDO', 'Indique el motivo de la baja.');
  if (normalizeCompanyKey(input?.confirmacionRut) !== normalizeCompanyKey(acc.rut)) {
    throw new SaasError(400, 'CONFIRMACION_INVALIDA', 'Para confirmar la baja escriba el RUT del cliente ERP.');
  }

  const empresas = companiesOfAccount(acc.id, true);
  const keys = new Set(empresas.flatMap((c) => companyKeys(c.id)));
  const snap = store();
  const entryIds = new Set((snap.entries || []).filter((e: any) => belongsTo(keys, e)).map((e: any) => e.id));
  const data: Record<string, any> = {};
  for (const col of COMPANY_COLLECTIONS) data[col] = (snap[col] || []).filter((r: any) => belongsTo(keys, r));
  data.lines = (snap.lines || []).filter((l: any) => entryIds.has(l.entryId));
  for (const col of COMPANY_KEYED) {
    data[col] = Object.fromEntries(Object.entries(snap[col] || {}).filter(([k]) => keys.has(normalizeCompanyKey(k))));
  }
  const rbac = whatsappBridgeService.getRbacState();
  const usuarios = (rbac.users || []).filter((u: any) => keys.has(normalizeCompanyKey(u.empresaPrincipalId)));

  const payload = {
    formato: 'erpremia-respaldo-baja/v1',
    generadoEn: new Date().toISOString(),
    conservarHasta: new Date(new Date().setFullYear(new Date().getFullYear() + RETENCION_ANOS)).toISOString().slice(0, 10),
    clienteErp: acc,
    empresas,
    usuarios: usuarios.map(({ password, ...u }: any) => u),
    facturas: listInvoices(acc.id),
    pagos: listPayments(acc.id),
    datos: data,
  };
  const dir = backupDirectory();
  fs.mkdirSync(dir, { recursive: true });
  const archivo = path.join(dir, `${acc.rut.replace(/[^0-9kK]/g, '')}_${payload.generadoEn.slice(0, 10)}_${crypto.randomUUID().slice(0, 6)}.json.gz`);
  const gz = zlib.gzipSync(Buffer.from(JSON.stringify(payload)));
  const sha256 = crypto.createHash('sha256').update(gz).digest('hex');
  fs.writeFileSync(archivo, gz);
  // Verificación: releer, comparar el hash y descomprimir.
  const leido = fs.readFileSync(archivo);
  if (crypto.createHash('sha256').update(leido).digest('hex') !== sha256) throw new SaasError(500, 'RESPALDO_CORRUPTO', 'El respaldo no se verificó; no se dio de baja.');
  JSON.parse(zlib.gunzipSync(leido).toString('utf8'));
  fs.writeFileSync(`${archivo}.sha256`, `${sha256}  ${path.basename(archivo)}\n`);

  const ahora = new Date().toISOString();
  changeAccountState(acc.id, 'BAJA', input.motivo, { usuarioId });
  saveCompanies(
    listCompanies().map((c) => (keys.has(normalizeCompanyKey(c.id)) ? { ...c, estadoEmpresa: 'BAJA', fechaBaja: c.fechaBaja || ahora, motivoBaja: c.motivoBaja || input.motivo } : c))
  );
  whatsappBridgeService.saveRbacStore({
    ...rbac,
    users: (rbac.users || []).map((u: any) => (keys.has(normalizeCompanyKey(u.empresaPrincipalId)) ? { ...u, estado: 'INACTIVO' } : u)),
  } as any);

  let retirado = false;
  if (input.retirarDeOperacion) {
    for (const col of COMPANY_COLLECTIONS) diskPersistence.updateCollection(col, (snap[col] || []).filter((r: any) => !belongsTo(keys, r)));
    diskPersistence.updateCollection('lines', (snap.lines || []).filter((l: any) => !entryIds.has(l.entryId)));
    for (const col of COMPANY_KEYED) {
      diskPersistence.updateCollection(col, Object.fromEntries(Object.entries(snap[col] || {}).filter(([k]) => !keys.has(normalizeCompanyKey(k)))) as any);
    }
    retirado = true;
  }
  setAccountBackup(acc.id, { archivo, sha256, bytes: gz.length, fecha: ahora, conservarHasta: payload.conservarHasta, retiradoDeOperacion: retirado });
  audit('BAJA_CLIENTE_ERP_CON_RESPALDO', acc.id, { archivo, sha256, bytes: gz.length, empresas: empresas.length, retiradoDeOperacion: retirado }, usuarioId);
  await sendSaasNotification({
    clienteErpId: acc.id,
    tipo: 'BAJA',
    para: [acc.contactoCobranza.email],
    asunto: 'Baja del servicio ERP',
    cuerpo: `Estimados ${acc.razonSocial}:\n\nSu servicio fue dado de baja. Su información se conserva respaldada hasta el ${payload.conservarHasta}.`,
  });
  return getAccount(acc.id)!;
}

/** Empresas sin cliente ERP asignado (para regularizarlas desde el panel). */
export function unassignedCompanies(): any[] {
  return listCompanies().filter((c) => !c.clienteErpId && c.estadoEmpresa !== 'BAJA');
}

export { findCompany };
