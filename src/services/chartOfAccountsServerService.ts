/**
 * K2 · Plan de cuentas único por empresa, en el servidor.
 *
 * - Un plan por empresa, guardado con el id canónico de la empresa (no por RUT ni por navegador).
 * - Sin plan implícito: una empresa sin plan está SIN_PLAN y nadie le asume uno (antes el servidor
 *   respondía un plan de 25 cuentas con otra codificación y el navegador lo adoptaba).
 * - El plan se inicializa explícitamente: plantilla estándar, copia de otra empresa, importación
 *   desde otro sistema, el plan guardado en un navegador (versiones anteriores) o vacío.
 * - Una vez que la empresa tiene asientos, no se puede eliminar ni recodificar una cuenta usada.
 * - Los asientos se validan contra este plan (CUENTA_NO_EXISTE / CUENTA_NO_IMPUTABLE).
 */
import crypto from 'node:crypto';
import { diskPersistence } from './diskPersistenceService';
import { companyKeys, normalizeCompanyKey, resolveCompanyId, findCompany } from './companyRegistryService';
import { buildStandardChartTemplate } from '../utils/companyChartOfAccountsService';
import { isDemoModeEnabled } from '../config/demoMode';
import { setJournalChartProvider } from './journalEntryNormalizer';

export type ChartOrigin = 'PLANTILLA_ESTANDAR' | 'COPIA_EMPRESA' | 'IMPORTACION' | 'NAVEGADOR' | 'VACIO' | 'MIGRADO';

export interface ChartMeta {
  origen: ChartOrigin;
  empresaOrigenId?: string;
  sistemaOrigen?: string;
  /** Equivalencias entre el código del sistema anterior y el código del ERP (importaciones). */
  equivalencias?: Array<{ codigoExterno: string; codigo: string }>;
  inicializadoEn: string;
  inicializadoPor?: string;
  actualizadoEn: string;
  actualizadoPor?: string;
}

export interface ChartIssue {
  codigo?: string;
  fila?: number;
  campo?: string;
  mensaje: string;
}

const TIPOS = ['ACTIVO', 'PASIVO', 'PATRIMONIO', 'INGRESO', 'COSTO', 'GASTO'] as const;
const NATURALEZAS = ['DEUDORA', 'ACREEDORA'] as const;
const CLASIFICACIONES = ['CIRCULANTE', 'NO_CIRCULANTE', 'CORTO_PLAZO', 'LARGO_PLAZO', 'OPERACIONAL', 'NO_OPERACIONAL'] as const;
/** Convención chilena habitual (plantilla estándar). Un plan importado puede usar otra: solo se advierte. */
const TIPOS_POR_CLASE: Record<number, string[]> = {
  1: ['ACTIVO'],
  2: ['PASIVO'],
  3: ['PATRIMONIO'],
  4: ['INGRESO'],
  5: ['COSTO'],
  6: ['GASTO'],
  7: ['INGRESO', 'GASTO'],
};

const store = () => diskPersistence.getSnapshot() as any;

// --------------------------------------------------------------------------
// Lectura y migración de claves antiguas (RUT con puntos, sin puntos, client-…)
// --------------------------------------------------------------------------

function findLegacyKey(record: Record<string, any> | undefined, empresaIdOrRut: string): string | null {
  if (!record) return null;
  const keys = new Set(companyKeys(empresaIdOrRut));
  return Object.keys(record).find((k) => keys.has(normalizeCompanyKey(k)) && Array.isArray(record[k]) && record[k].length > 0) || null;
}

function migrateIfNeeded(empresaId: string): void {
  const s = store();
  if (s.chartsOfAccounts?.[empresaId]?.length) return;
  const legacy = findLegacyKey(s.chartsOfAccounts, empresaId);
  if (!legacy) return;
  diskPersistence.saveCompanyChart(empresaId, s.chartsOfAccounts[legacy]);
  const legacyGroups = findLegacyKey(s.groups, empresaId);
  if (legacyGroups) diskPersistence.saveCompanyGroups(empresaId, s.groups[legacyGroups]);
  const metas = { ...(s.chartsMeta || {}) };
  metas[empresaId] = metas[empresaId] || {
    origen: 'MIGRADO',
    inicializadoEn: new Date().toISOString(),
    actualizadoEn: new Date().toISOString(),
  };
  diskPersistence.updateCollection('chartsMeta', metas as any);
}

export interface CompanyChartState {
  empresaId: string;
  estado: 'SIN_PLAN' | 'CONFIGURADO';
  chart: any[];
  groups: any[];
  meta: ChartMeta | null;
  tieneMovimientos: boolean;
}

export function getCompanyChartState(empresaIdOrRut: string): CompanyChartState {
  const empresaId = resolveCompanyId(empresaIdOrRut);
  migrateIfNeeded(empresaId);
  const chart = diskPersistence.getCompanyChart(empresaId) || [];
  const groups = diskPersistence.getCompanyGroups(empresaId) || [];
  const meta = (store().chartsMeta || {})[empresaId] || null;
  const configurado = chart.length > 0 || meta?.origen === 'VACIO';
  return {
    empresaId,
    estado: configurado ? 'CONFIGURADO' : 'SIN_PLAN',
    chart,
    groups,
    meta,
    tieneMovimientos: usedAccountCodes(empresaId).size > 0,
  };
}

// --------------------------------------------------------------------------
// Cuentas con movimientos
// --------------------------------------------------------------------------

export function usedAccountCodes(empresaIdOrRut: string): Set<string> {
  const keys = new Set(companyKeys(empresaIdOrRut));
  const s = store();
  const entryIds = new Set<string>();
  const used = new Set<string>();
  for (const e of s.entries || []) {
    if (!keys.has(normalizeCompanyKey(e.empresaId || e.empresaRut))) continue;
    entryIds.add(e.id);
    for (const l of e.lineas || []) {
      const c = l.codigoCuenta || l.cuentaCodigo;
      if (c) used.add(String(c).trim());
    }
  }
  for (const l of s.lines || []) {
    if (!entryIds.has(l.entryId)) continue;
    const c = l.codigoCuenta || l.cuentaCodigo;
    if (c) used.add(String(c).trim());
  }
  return used;
}

// --------------------------------------------------------------------------
// Validación
// --------------------------------------------------------------------------

export function isImputable(chart: any[], codigo: string): boolean {
  const prefix = `${codigo}.`;
  return !chart.some((a) => String(a.codigo).startsWith(prefix));
}

/** Completa grupo, subgrupo, clase y nivel a partir del código cuando faltan (importaciones). */
export function completeAccountStructure(acc: any): any {
  const codigo = String(acc.codigo || '').trim();
  const parts = codigo.split('.');
  const out: any = { ...acc, codigo, nombre: String(acc.nombre || '').trim() };
  if (out.clase === undefined || out.clase === null || out.clase === '') out.clase = Number(parts[0]);
  else out.clase = Number(out.clase);
  if (!out.grupo && parts.length >= 2) out.grupo = parts.slice(0, 2).join('.');
  if (!out.subgrupo && parts.length >= 3) out.subgrupo = parts.slice(0, 3).join('.');
  if (!out.nivel) out.nivel = Math.min(5, Math.max(1, parts.length + (parts.length >= 4 ? 1 : 0))) as any;
  out.activa = out.activa !== false;
  out.requiereAuxiliarRut = Boolean(out.requiereAuxiliarRut);
  out.requiereCentroCosto = Boolean(out.requiereCentroCosto);
  out.esConciliableBancaria = Boolean(out.esConciliableBancaria);
  return out;
}

export function validateChart(chart: any[]): { errores: ChartIssue[]; advertencias: ChartIssue[] } {
  const errores: ChartIssue[] = [];
  const advertencias: ChartIssue[] = [];
  const seen = new Map<string, number>();
  chart.forEach((acc, i) => {
    const fila = i + 1;
    const codigo = String(acc?.codigo || '').trim();
    if (!codigo) {
      errores.push({ fila, campo: 'codigo', mensaje: 'Cuenta sin código.' });
      return;
    }
    if (!/^[0-9]+(\.[0-9]+)*$/.test(codigo)) {
      errores.push({ fila, codigo, campo: 'codigo', mensaje: `Código "${codigo}" inválido: use números separados por punto.` });
    }
    if (seen.has(codigo)) errores.push({ fila, codigo, campo: 'codigo', mensaje: `Código repetido (también en la fila ${seen.get(codigo)}).` });
    seen.set(codigo, fila);
    if (!String(acc.nombre || '').trim()) errores.push({ fila, codigo, campo: 'nombre', mensaje: 'Cuenta sin nombre.' });
    if (!TIPOS.includes(acc.tipo)) {
      errores.push({ fila, codigo, campo: 'tipo', mensaje: `Tipo "${acc.tipo ?? ''}" inválido o vacío: indique ${TIPOS.join(', ')}.` });
    }
    if (!NATURALEZAS.includes(acc.naturaleza)) {
      errores.push({ fila, codigo, campo: 'naturaleza', mensaje: `Naturaleza "${acc.naturaleza ?? ''}" inválida o vacía: DEUDORA o ACREEDORA.` });
    }
    if (acc.clasificacion && !CLASIFICACIONES.includes(acc.clasificacion)) {
      errores.push({ fila, codigo, campo: 'clasificacion', mensaje: `Clasificación "${acc.clasificacion}" inválida.` });
    }
    const clase = Number(acc.clase);
    if (String(clase) !== codigo.split('.')[0]) {
      errores.push({ fila, codigo, campo: 'clase', mensaje: `La clase (${acc.clase}) no coincide con el primer dígito del código.` });
    } else if (TIPOS_POR_CLASE[clase] && acc.tipo && !TIPOS_POR_CLASE[clase].includes(acc.tipo)) {
      advertencias.push({ fila, codigo, campo: 'tipo', mensaje: `Una cuenta de clase ${clase} suele ser ${TIPOS_POR_CLASE[clase].join(' o ')}, no ${acc.tipo}.` });
    }
    if (acc.subgrupo && !codigo.startsWith(String(acc.subgrupo))) {
      advertencias.push({ fila, codigo, campo: 'subgrupo', mensaje: `El código no comienza con su subgrupo (${acc.subgrupo}).` });
    }
    const esperada = ['ACTIVO', 'COSTO', 'GASTO'].includes(acc.tipo) ? 'DEUDORA' : ['PASIVO', 'PATRIMONIO', 'INGRESO'].includes(acc.tipo) ? 'ACREEDORA' : null;
    if (esperada && acc.naturaleza && acc.naturaleza !== esperada && !/\(-\)|contracuenta|depreciaci|amortizaci|descuento/i.test(String(acc.nombre))) {
      advertencias.push({ fila, codigo, campo: 'naturaleza', mensaje: `Una cuenta de ${acc.tipo} suele ser ${esperada}; revise si es una contracuenta.` });
    }
  });
  return { errores, advertencias };
}

function protectedRemovals(empresaId: string, nextChart: any[]): string[] {
  const used = usedAccountCodes(empresaId);
  if (used.size === 0) return [];
  const nextCodes = new Set(nextChart.map((a) => String(a.codigo).trim()));
  return [...used].filter((c) => !nextCodes.has(c));
}

// --------------------------------------------------------------------------
// Escritura
// --------------------------------------------------------------------------

export class ChartError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: any) {
    super(message);
  }
}

function writeChart(empresaId: string, chart: any[], groups: any[] | undefined, meta: Partial<ChartMeta>, userId?: string): CompanyChartState {
  const now = new Date().toISOString();
  diskPersistence.saveCompanyChart(empresaId, chart);
  if (groups) diskPersistence.saveCompanyGroups(empresaId, groups);
  const metas = { ...(store().chartsMeta || {}) };
  const prev: ChartMeta | undefined = metas[empresaId];
  metas[empresaId] = {
    ...(prev || {}),
    ...meta,
    inicializadoEn: meta.origen ? now : prev?.inicializadoEn || now,
    inicializadoPor: meta.origen ? userId : prev?.inicializadoPor,
    actualizadoEn: now,
    actualizadoPor: userId,
  } as ChartMeta;
  diskPersistence.updateCollection('chartsMeta', metas as any);
  diskPersistence.addAuditLog({
    id: `audit-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
    fecha: now,
    entidadTipo: 'CHART_OF_ACCOUNTS',
    entidadId: empresaId,
    accion: meta.origen ? `INICIALIZAR_PLAN_${meta.origen}` : 'ACTUALIZAR_PLAN',
    usuarioId: userId,
    empresaId,
    datosNuevos: { cuentas: chart.length, grupos: groups?.length, empresaOrigenId: meta.empresaOrigenId, sistemaOrigen: meta.sistemaOrigen },
  });
  mirrorToMysql(empresaId, chart).catch(() => undefined);
  return getCompanyChartState(empresaId);
}

/** Guarda el plan editado (editor del Agente Contable). */
export function saveCompanyChart(empresaIdOrRut: string, chart: any[], groups: any[] | undefined, userId?: string): CompanyChartState {
  const empresaId = resolveCompanyId(empresaIdOrRut);
  if (!Array.isArray(chart)) throw new ChartError(400, 'MISSING_PARAMS', 'Debe enviar el plan de cuentas (chart).');
  const state = getCompanyChartState(empresaId);
  if (state.estado === 'SIN_PLAN') {
    throw new ChartError(409, 'PLAN_NO_INICIALIZADO', 'La empresa no tiene plan de cuentas: inicialícelo primero (plantilla, copia o importación).');
  }
  const normalized = chart.map(completeAccountStructure);
  const { errores, advertencias } = validateChart(normalized);
  if (errores.length) throw new ChartError(400, 'PLAN_INVALIDO', `El plan tiene ${errores.length} error(es).`, { errores, advertencias });
  const removidas = protectedRemovals(empresaId, normalized);
  if (removidas.length) {
    throw new ChartError(409, 'CUENTAS_CON_MOVIMIENTOS', `No se pueden eliminar ni recodificar cuentas con movimientos: ${removidas.join(', ')}.`, { cuentas: removidas });
  }
  return writeChart(empresaId, normalized, groups, {}, userId);
}

export interface InitializeInput {
  origen: Exclude<ChartOrigin, 'MIGRADO'>;
  empresaOrigenId?: string;
  cuentas?: any[];
  grupos?: any[];
  sistemaOrigen?: string;
  equivalencias?: Array<{ codigoExterno: string; codigo: string }>;
  reemplazar?: boolean;
}

/** Inicializa (o reemplaza, si no tiene movimientos) el plan de una empresa. */
export function initializeCompanyChart(
  empresaIdOrRut: string,
  input: InitializeInput,
  ctx: { userId?: string; canAccessCompany: (empresaId: string) => boolean }
): CompanyChartState {
  const empresaId = resolveCompanyId(empresaIdOrRut);
  const state = getCompanyChartState(empresaId);
  if (state.estado === 'CONFIGURADO') {
    if (state.tieneMovimientos) {
      throw new ChartError(409, 'PLAN_CON_MOVIMIENTOS', 'La empresa ya tiene asientos: el plan no se puede reemplazar completo; agregue o edite cuentas en el editor.');
    }
    if (!input.reemplazar) {
      throw new ChartError(409, 'PLAN_EXISTENTE', 'La empresa ya tiene plan de cuentas. Confirme el reemplazo (reemplazar: true).');
    }
  }

  let chart: any[] = [];
  let groups: any[] = [];
  const meta: Partial<ChartMeta> = { origen: input.origen };

  switch (input.origen) {
    case 'PLANTILLA_ESTANDAR': {
      const t = buildStandardChartTemplate(findCompany(empresaId)?.rut || '');
      chart = t.chart;
      groups = t.groups;
      break;
    }
    case 'COPIA_EMPRESA': {
      const origenId = resolveCompanyId(String(input.empresaOrigenId || ''));
      if (!input.empresaOrigenId) throw new ChartError(400, 'MISSING_PARAMS', 'Indique la empresa de origen (empresaOrigenId).');
      if (normalizeCompanyKey(origenId) === normalizeCompanyKey(empresaId)) throw new ChartError(400, 'MISMA_EMPRESA', 'La empresa de origen es la misma empresa.');
      if (!ctx.canAccessCompany(origenId)) {
        throw new ChartError(403, 'ACCESO_EMPRESA_DENEGADO', 'No tiene acceso a la empresa de origen o pertenece a otro cliente ERP.');
      }
      const origen = getCompanyChartState(origenId);
      if (origen.estado === 'SIN_PLAN' || origen.chart.length === 0) throw new ChartError(409, 'ORIGEN_SIN_PLAN', 'La empresa de origen no tiene plan de cuentas.');
      // Se copian cuentas, grupos, atributos, agrupaciones y notas; no saldos, auxiliares ni asientos.
      const rut = findCompany(empresaId)?.rut;
      chart = origen.chart.map((a) => {
        const { auxiliarPredeterminadoRut, ...rest } = a;
        return { ...rest, ...(rut ? { empresaRut: rut } : {}) };
      });
      groups = origen.groups.map((g) => ({ ...g }));
      meta.empresaOrigenId = origenId;
      break;
    }
    case 'IMPORTACION':
    case 'NAVEGADOR': {
      if (!Array.isArray(input.cuentas) || input.cuentas.length === 0) {
        throw new ChartError(400, 'MISSING_PARAMS', 'Debe enviar las cuentas a importar.');
      }
      chart = input.cuentas.map(completeAccountStructure);
      groups = Array.isArray(input.grupos) ? input.grupos : [];
      if (input.origen === 'IMPORTACION') {
        meta.sistemaOrigen = String(input.sistemaOrigen || 'GENERICO');
        meta.equivalencias = (input.equivalencias || []).filter((e) => e && e.codigoExterno && e.codigo);
      }
      break;
    }
    case 'VACIO':
      chart = [];
      groups = [];
      break;
    default:
      throw new ChartError(400, 'ORIGEN_INVALIDO', 'Origen del plan inválido.');
  }

  const { errores, advertencias } = validateChart(chart);
  if (errores.length) throw new ChartError(400, 'PLAN_INVALIDO', `El plan tiene ${errores.length} error(es).`, { errores, advertencias });
  return writeChart(empresaId, chart, groups, meta, ctx.userId);
}

// --------------------------------------------------------------------------
// Validación de asientos contra el plan de la empresa (K2.7)
// --------------------------------------------------------------------------

export interface EntryAccountsValidation {
  ok: boolean;
  code?: 'PLAN_CUENTAS_NO_CONFIGURADO' | 'CUENTA_NO_EXISTE' | 'CUENTA_NO_IMPUTABLE' | 'CUENTA_INACTIVA';
  message?: string;
  cuentas?: string[];
}

export function validateEntryAccounts(empresaIdOrRut: string, codigos: Array<string | undefined | null>): EntryAccountsValidation {
  const state = getCompanyChartState(empresaIdOrRut);
  if (state.estado === 'SIN_PLAN') {
    // En la demostración las empresas de ejemplo no tienen plan en el servidor.
    if (isDemoModeEnabled()) return { ok: true };
    return { ok: false, code: 'PLAN_CUENTAS_NO_CONFIGURADO', message: 'La empresa no tiene plan de cuentas configurado; no se puede validar el asiento.' };
  }
  const byCode = new Map(state.chart.map((a) => [String(a.codigo).trim(), a] as const));
  const faltantes: string[] = [];
  const noImputables: string[] = [];
  const inactivas: string[] = [];
  for (const raw of codigos) {
    const c = String(raw || '').trim();
    if (!c) {
      faltantes.push('(vacía)');
      continue;
    }
    const acc = byCode.get(c);
    if (!acc) faltantes.push(c);
    else if (!isImputable(state.chart, c)) noImputables.push(c);
    else if (acc.activa === false) inactivas.push(c);
  }
  if (faltantes.length) {
    return { ok: false, code: 'CUENTA_NO_EXISTE', cuentas: [...new Set(faltantes)], message: `Cuentas que no existen en el plan de la empresa: ${[...new Set(faltantes)].join(', ')}.` };
  }
  if (noImputables.length) {
    return { ok: false, code: 'CUENTA_NO_IMPUTABLE', cuentas: [...new Set(noImputables)], message: `Cuentas de agrupación (no imputables): ${[...new Set(noImputables)].join(', ')}.` };
  }
  if (inactivas.length) {
    return { ok: false, code: 'CUENTA_INACTIVA', cuentas: [...new Set(inactivas)], message: `Cuentas inactivas: ${[...new Set(inactivas)].join(', ')}.` };
  }
  return { ok: true };
}

/** Lanza un error con code CUENTA_NO_EXISTE / CUENTA_NO_IMPUTABLE / … si el asiento no calza con el plan. */
export function assertEntryAccountsValid(empresaIdOrRut: string, lines: any[]): void {
  const v = validateEntryAccounts(empresaIdOrRut, (lines || []).map((l) => l?.cuentaCodigo || l?.codigoCuenta));
  if (!v.ok) {
    const err: any = new Error(v.message);
    err.code = v.code;
    err.cuentas = v.cuentas;
    throw err;
  }
}

// --------------------------------------------------------------------------
// Parámetros generales de la empresa y cuentas por defecto (K2.6, C10)
// --------------------------------------------------------------------------
// Antes eran uno solo para todo el navegador (localStorage) y las cuentas se elegían de otro plan.
// Ahora se guardan por empresa en el servidor y cada campo cuenta* se valida contra el plan.

const isAccountField = (k: string) => /^cuenta/i.test(k);

export function getCompanySystemParameters(empresaIdOrRut: string): Record<string, any> | null {
  const empresaId = resolveCompanyId(empresaIdOrRut);
  return (store().companySystemParameters || {})[empresaId] || null;
}

export function saveCompanySystemParameters(empresaIdOrRut: string, params: Record<string, any>, userId?: string): Record<string, any> {
  const empresaId = resolveCompanyId(empresaIdOrRut);
  if (!params || typeof params !== 'object') throw new ChartError(400, 'MISSING_PARAMS', 'Debe enviar los parámetros.');
  const state = getCompanyChartState(empresaId);
  const byCode = new Map(state.chart.map((a) => [String(a.codigo), a] as const));
  const errores: ChartIssue[] = [];
  const limpio: Record<string, any> = {};
  for (const [k, raw] of Object.entries(params)) {
    if (!isAccountField(k)) {
      limpio[k] = raw;
      continue;
    }
    const v = String(raw ?? '').trim();
    if (!v) {
      limpio[k] = ''; // sin definir: quien la necesite la pide
      continue;
    }
    if (state.estado === 'SIN_PLAN') {
      errores.push({ campo: k, codigo: v, mensaje: 'La empresa no tiene plan de cuentas: configure el plan antes de elegir cuentas por defecto.' });
      continue;
    }
    const acc = byCode.get(v);
    if (!acc) errores.push({ campo: k, codigo: v, mensaje: `La cuenta ${v} no existe en el plan de la empresa.` });
    else if (!isImputable(state.chart, v)) errores.push({ campo: k, codigo: v, mensaje: `${v} es una cuenta de agrupación (no imputable).` });
    else if (acc.activa === false) errores.push({ campo: k, codigo: v, mensaje: `${v} está inactiva.` });
    else limpio[k] = v;
  }
  if (errores.length) throw new ChartError(400, 'PARAMETROS_INVALIDOS', `Hay ${errores.length} cuenta(s) por defecto inválida(s).`, { errores });
  const all = { ...(store().companySystemParameters || {}) };
  all[empresaId] = limpio;
  diskPersistence.updateCollection('companySystemParameters', all as any);
  diskPersistence.addAuditLog({
    id: `audit-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
    fecha: new Date().toISOString(),
    entidadTipo: 'COMPANY_SYSTEM_PARAMETERS',
    entidadId: empresaId,
    accion: 'ACTUALIZAR_PARAMETROS_EMPRESA',
    usuarioId: userId,
    empresaId,
    datosNuevos: Object.fromEntries(Object.entries(limpio).filter(([k]) => isAccountField(k))),
  });
  return limpio;
}

// --------------------------------------------------------------------------
// Réplica en MySQL con todos los atributos (C8)
// --------------------------------------------------------------------------

async function mirrorToMysql(empresaId: string, chart: any[]): Promise<void> {
  const { isRealMysqlConnected, getMysqlDb } = await import('../db/mysqlClient');
  if (!isRealMysqlConnected) return;
  const { chartOfAccounts } = await import('../db/schema/accountingLedgerSchema');
  const { eq, and, notInArray } = await import('drizzle-orm');
  const db = getMysqlDb();
  const clasif = (t: string) =>
    (t === 'INGRESO' ? 'INGRESOS' : t === 'COSTO' ? 'COSTOS' : t === 'GASTO' ? 'GASTOS' : t) as any;
  try {
    for (const acc of chart) {
      const row = {
        id: `acc-${empresaId}-${acc.codigo}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 36),
        empresaId,
        codigoCuenta: acc.codigo,
        nombreCuenta: acc.nombre,
        clasificacion: clasif(acc.tipo),
        aceptaAuxiliar: Boolean(acc.requiereAuxiliarRut),
        manejaMultimoneda: Boolean(acc.manejaMultimoneda),
        monedaCodigo: acc.monedaCodigo || 'CLP',
        requiereDocReferencia: Boolean(acc.requiereDocReferencia),
        esEfectivoEquivalente: Boolean(acc.esEfectivoEquivalente),
        esContracuentaEfectivo: Boolean(acc.esContracuentaEfectivo),
        requiereProyecto: Boolean(acc.requiereProyecto),
        notasExplicativas: acc.notasExplicativas || null,
        atributos: acc,
      };
      const { id, empresaId: _e, codigoCuenta: _c, ...set } = row;
      await db.insert(chartOfAccounts).values(row as any).onDuplicateKeyUpdate({ set: set as any });
    }
    const codes = chart.map((a) => a.codigo);
    if (codes.length) {
      await db.delete(chartOfAccounts).where(and(eq(chartOfAccounts.empresaId, empresaId), notInArray(chartOfAccounts.codigoCuenta, codes)));
    }
  } catch (err: any) {
    console.warn('[ChartOfAccounts] No se pudo replicar el plan en MySQL:', err?.message);
  }
}

// El normalizador de asientos (agentes, nómina, F29) resuelve las cuentas contra el plan de la empresa.
setJournalChartProvider((empresaId) => {
  const st = getCompanyChartState(empresaId);
  return st.estado === 'CONFIGURADO' && st.chart.length ? st.chart : null;
});
