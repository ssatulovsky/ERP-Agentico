import {
  HierarchicalAccountItem,
  AccountGroupDefinition,
  BalanceGroupingMode,
  GroupedBalanceReport,
  GroupedBalanceItem,
  Balance8ColumnasReport,
  TrialBalance8ColAccount,
  TrialBalance8ColTotals,
  ResultadoEjercicio8Col,
} from '../types';
import { CHILE_HIERARCHICAL_CHART_OF_ACCOUNTS } from './accountingOrchestratorEngine';
import { inferDefaultNoteNumbers } from './financialNotesService';

/**
 * Grupos y Subgrupos Estándar de la Estructura Jerárquica Chilena (CMF / SII)
 */
export const DEFAULT_CHILEAN_GROUPS: AccountGroupDefinition[] = [
  // CLASE 1: ACTIVO
  { id: 'grp-1.1', codigo: '1.1', nombre: 'Activo Corriente / Circulante', clase: 1, nivel: 2, descripcion: 'Recursos realizables o convertibles en efectivo en un plazo menor a un año.' },
  { id: 'sub-1.1.01', codigo: '1.1.01', nombre: 'Efectivo y Equivalentes de Efectivo (Caja y Bancos)', clase: 1, nivel: 3, padreCodigo: '1.1' },
  { id: 'sub-1.1.02', codigo: '1.1.02', nombre: 'Bancos (Cuentas Corrientes)', clase: 1, nivel: 3, padreCodigo: '1.1' },
  { id: 'sub-1.1.03', codigo: '1.1.03', nombre: 'Deudores Comerciales y Cuentas por Cobrar Clientes', clase: 1, nivel: 3, padreCodigo: '1.1' },
  { id: 'sub-1.1.04', codigo: '1.1.04', nombre: 'Impuestos Mensuales por Recuperar (IVA CF, Remanente, PPM)', clase: 1, nivel: 3, padreCodigo: '1.1' },
  { id: 'sub-1.1.05', codigo: '1.1.05', nombre: 'Existencias e Inventarios', clase: 1, nivel: 3, padreCodigo: '1.1' },
  { id: 'sub-1.1.06', codigo: '1.1.06', nombre: 'Anticipos a Proveedores y Gastos Pagados por Anticipado', clase: 1, nivel: 3, padreCodigo: '1.1' },

  { id: 'grp-1.2', codigo: '1.2', nombre: 'Activo No Corriente / Activos Fijos', clase: 1, nivel: 2, descripcion: 'Bienes de uso duradero, inmuebles, maquinarias y derechos de uso.' },
  { id: 'sub-1.2.01', codigo: '1.2.01', nombre: 'Propiedades, Planta y Equipos (Activo Fijo Físico)', clase: 1, nivel: 3, padreCodigo: '1.2' },
  { id: 'sub-1.2.02', codigo: '1.2.02', nombre: '(-) Depreciación Acumulada de Activos Fijos', clase: 1, nivel: 3, padreCodigo: '1.2' },
  { id: 'sub-1.2.03', codigo: '1.2.03', nombre: 'Activos por Derecho de Uso (IFRS 16 / Arrendamientos)', clase: 1, nivel: 3, padreCodigo: '1.2' },
  { id: 'sub-1.2.04', codigo: '1.2.04', nombre: 'Intangibles, Marcas y Software de Largo Plazo', clase: 1, nivel: 3, padreCodigo: '1.2' },

  // CLASE 2: PASIVO
  { id: 'grp-2.1', codigo: '2.1', nombre: 'Pasivo Corriente / Corto Plazo', clase: 2, nivel: 2, descripcion: 'Obligaciones exigibles a terceros en un plazo menor a un año.' },
  { id: 'sub-2.1.01', codigo: '2.1.01', nombre: 'Proveedores Nacionales y Cuentas por Pagar Comerciales', clase: 2, nivel: 3, padreCodigo: '2.1' },
  { id: 'sub-2.1.02', codigo: '2.1.02', nombre: 'Remuneraciones, Honorarios y Leyes Sociales por Pagar', clase: 2, nivel: 3, padreCodigo: '2.1' },
  { id: 'sub-2.1.03', codigo: '2.1.03', nombre: 'Impuestos Fiscales y Retenciones F29 por Pagar (TGR/SII)', clase: 2, nivel: 3, padreCodigo: '2.1' },
  { id: 'sub-2.1.04', codigo: '2.1.04', nombre: 'Pasivo por Arrendamiento Corto Plazo (IFRS 16)', clase: 2, nivel: 3, padreCodigo: '2.1' },
  { id: 'sub-2.1.05', codigo: '2.1.05', nombre: 'Otras Cuentas por Pagar de Corto Plazo', clase: 2, nivel: 3, padreCodigo: '2.1' },

  { id: 'grp-2.2', codigo: '2.2', nombre: 'Pasivo No Corriente / Largo Plazo', clase: 2, nivel: 2, descripcion: 'Deudas y compromisos exigibles con vencimiento mayor a un año.' },
  { id: 'sub-2.2.01', codigo: '2.2.01', nombre: 'Pasivos Financieros y Arrendamientos de Largo Plazo', clase: 2, nivel: 3, padreCodigo: '2.2' },
  { id: 'sub-2.2.03', codigo: '2.2.03', nombre: 'Provisiones de Desmantelamiento y Largo Plazo', clase: 2, nivel: 3, padreCodigo: '2.2' },

  // CLASE 3: PATRIMONIO
  { id: 'grp-3.1', codigo: '3.1', nombre: 'Patrimonio Neto', clase: 3, nivel: 2, descripcion: 'Capital aportado y resultados históricos atribuibles a los socios/accionistas.' },
  { id: 'sub-3.1.01', codigo: '3.1.01', nombre: 'Capital Social Suscrito y Pagado', clase: 3, nivel: 3, padreCodigo: '3.1' },
  { id: 'sub-3.1.02', codigo: '3.1.02', nombre: 'Resultados Acumulados de Ejercicios Anteriores', clase: 3, nivel: 3, padreCodigo: '3.1' },
  { id: 'sub-3.1.03', codigo: '3.1.03', nombre: 'Resultado Neto del Ejercicio', clase: 3, nivel: 3, padreCodigo: '3.1' },

  // CLASE 4: INGRESOS
  { id: 'grp-4.1', codigo: '4.1', nombre: 'Ingresos de Actividades Ordinarias', clase: 4, nivel: 2, descripcion: 'Ingresos operacionales provenientes del giro comercial de la empresa.' },
  { id: 'sub-4.1.01', codigo: '4.1.01', nombre: 'Ingresos por Ventas de Bienes Afectas a IVA', clase: 4, nivel: 3, padreCodigo: '4.1' },
  { id: 'sub-4.1.02', codigo: '4.1.02', nombre: 'Ingresos por Prestación de Servicios Exentos o No Gravados', clase: 4, nivel: 3, padreCodigo: '4.1' },

  // CLASE 5: COSTOS
  { id: 'grp-5.1', codigo: '5.1', nombre: 'Costos de Explotación / Venta', clase: 5, nivel: 2, descripcion: 'Costos directos incurridos para la producción o compra de bienes y servicios vendidos.' },
  { id: 'sub-5.1.01', codigo: '5.1.01', nombre: 'Costo Directo de Mercaderías y Ventas', clase: 5, nivel: 3, padreCodigo: '5.1' },

  // CLASE 6: GASTOS DE ADMINISTRACIÓN Y VENTAS
  { id: 'grp-6.1', codigo: '6.1', nombre: 'Gastos Operacionales y Administrativos', clase: 6, nivel: 2, descripcion: 'Gastos necesarios para el soporte, administración y comercialización.' },
  { id: 'sub-6.1.01', codigo: '6.1.01', nombre: 'Gastos de Personal, Sueldos y Leyes Sociales', clase: 6, nivel: 3, padreCodigo: '6.1' },
  { id: 'sub-6.1.02', codigo: '6.1.02', nombre: 'Honorarios Profesionales y Asesorías Externas', clase: 6, nivel: 3, padreCodigo: '6.1' },
  { id: 'sub-6.1.03', codigo: '6.1.03', nombre: 'Arriendos Operativos e Inmuebles', clase: 6, nivel: 3, padreCodigo: '6.1' },
  { id: 'sub-6.1.04', codigo: '6.1.04', nombre: 'Servicios Básicos, Tecnología y Depreciación', clase: 6, nivel: 3, padreCodigo: '6.1' },

  // CLASE 7: OTROS INGRESOS Y GASTOS
  { id: 'grp-7.1', codigo: '7.1', nombre: 'Ingresos No Operacionales y Financieros', clase: 7, nivel: 2, descripcion: 'Rentas accesorias, intereses ganados y diferencias de cambio a favor.' },
  { id: 'sub-7.1.01', codigo: '7.1.01', nombre: 'Diferencias de Cambio y Ganancias Financieras', clase: 7, nivel: 3, padreCodigo: '7.1' },

  { id: 'grp-7.2', codigo: '7.2', nombre: 'Gastos No Operacionales y Financieros', clase: 7, nivel: 2, descripcion: 'Cargos financieros, reajustes UF/IPC y pérdidas por tipo de cambio.' },
  { id: 'sub-7.2.01', codigo: '7.2.01', nombre: 'Intereses Bancarios, Reajustes UF y Pérdidas Cambiarias', clase: 7, nivel: 3, padreCodigo: '7.2' },
];

/**
 * Catálogo estándar de Agrupaciones Fiscales SII (F22 / RLI / Capital Propio)
 */
export const FISCAL_GROUPING_OPTIONS = [
  'Activo Corriente Tributario',
  'Activo Fijo Tributario (Bienes del Activo Inmovilizado)',
  'Otros Activos Tributarios / Intangibles',
  'Pasivos Exigibles de Corto Plazo',
  'Pasivos Exigibles de Largo Plazo',
  'Patrimonio Tributario y Capital Aportado',
  'Ingresos Brutos del Giro (Art. 29 LIR)',
  'Costo Directo de Mercaderías y Servicios (Art. 30 LIR)',
  'Gastos Necesarios para Producir la Renta (Art. 31 LIR)',
  'Gastos Financieros y Reajustes Aceptados (Art. 31 N° 1 LIR)',
  'Gastos Rechazados y Agregados a la RLI (Art. 33 LIR)',
  'Otros Ingresos / Rentas de Capital Mobiliario',
];

/**
 * Catálogo estándar para Casa Matriz en el Extranjero (US GAAP / IFRS Reporting)
 */
export const HEADQUARTERS_GROUPING_OPTIONS = [
  'Current Assets: Cash & Cash Equivalents',
  'Current Assets: Trade Accounts Receivable',
  'Current Assets: Inventories & Supplies',
  'Current Assets: Other Current Assets & Prepaids',
  'Non-Current Assets: Property, Plant & Equipment (Net)',
  'Non-Current Assets: Right-of-Use Assets (Leases)',
  'Non-Current Assets: Other Non-Current Assets',
  'Current Liabilities: Trade Accounts Payable',
  'Current Liabilities: Accrued Payroll, Taxes & Provisions',
  'Current Liabilities: Short-Term Debt & Lease Obligations',
  'Non-Current Liabilities: Long-Term Debt & Obligations',
  'Stockholders Equity: Contributed Capital & Retained Earnings',
  'Revenues: Net Sales of Goods & Services',
  'Cost of Goods Sold (COGS)',
  'Operating Expenses: Selling, General & Administrative (SG&A)',
  'Operating Expenses: Depreciation & Amortization',
  'Non-Operating: Financial Income / (Expense) & FX Translation',
];

/**
 * Mapeo inteligente por defecto según la cuenta para Fiscal y Casa Matriz
 */
function inferDefaultMappings(account: HierarchicalAccountItem): {
  agrupacionFiscal: string;
  agrupacionMatrizExtranjera: string;
} {
  const code = account.codigo;
  const name = account.nombre.toLowerCase();

  // Fiscal defaults
  let fiscal = 'Gastos Necesarios para Producir la Renta (Art. 31 LIR)';
  if (code.startsWith('1.1')) fiscal = 'Activo Corriente Tributario';
  else if (code.startsWith('1.2')) fiscal = 'Activo Fijo Tributario (Bienes del Activo Inmovilizado)';
  else if (code.startsWith('2.1')) fiscal = 'Pasivos Exigibles de Corto Plazo';
  else if (code.startsWith('2.2')) fiscal = 'Pasivos Exigibles de Largo Plazo';
  else if (code.startsWith('3.')) fiscal = 'Patrimonio Tributario y Capital Aportado';
  else if (code.startsWith('4.')) fiscal = 'Ingresos Brutos del Giro (Art. 29 LIR)';
  else if (code.startsWith('5.')) fiscal = 'Costo Directo de Mercaderías y Servicios (Art. 30 LIR)';
  else if (code.startsWith('7.1')) fiscal = 'Otros Ingresos / Rentas de Capital Mobiliario';
  else if (code.startsWith('7.2')) fiscal = 'Gastos Financieros y Reajustes Aceptados (Art. 31 N° 1 LIR)';

  // HQ defaults
  let hq = 'Operating Expenses: Selling, General & Administrative (SG&A)';
  if (code.startsWith('1.1.01') || code.startsWith('1.1.02') || name.includes('banco') || name.includes('caja')) {
    hq = 'Current Assets: Cash & Cash Equivalents';
  } else if (code.startsWith('1.1.03') || code.startsWith('1.1.04') || name.includes('cliente') || name.includes('cobrar')) {
    hq = 'Current Assets: Trade Accounts Receivable';
  } else if (code.startsWith('1.1.06') || name.includes('existencia') || name.includes('mercader')) {
    hq = 'Current Assets: Inventories & Supplies';
  } else if (code.startsWith('1.1')) {
    hq = 'Current Assets: Other Current Assets & Prepaids';
  } else if (code.startsWith('1.2.03') || name.includes('derecho de uso')) {
    hq = 'Non-Current Assets: Right-of-Use Assets (Leases)';
  } else if (code.startsWith('1.2')) {
    hq = 'Non-Current Assets: Property, Plant & Equipment (Net)';
  } else if (code.startsWith('2.1.01') || name.includes('proveedor')) {
    hq = 'Current Liabilities: Trade Accounts Payable';
  } else if (code.startsWith('2.1.04') || code.startsWith('2.1.05')) {
    hq = 'Current Liabilities: Short-Term Debt & Lease Obligations';
  } else if (code.startsWith('2.1')) {
    hq = 'Current Liabilities: Accrued Payroll, Taxes & Provisions';
  } else if (code.startsWith('2.2')) {
    hq = 'Non-Current Liabilities: Long-Term Debt & Obligations';
  } else if (code.startsWith('3.')) {
    hq = 'Stockholders Equity: Contributed Capital & Retained Earnings';
  } else if (code.startsWith('4.')) {
    hq = 'Revenues: Net Sales of Goods & Services';
  } else if (code.startsWith('5.')) {
    hq = 'Cost of Goods Sold (COGS)';
  } else if (name.includes('depreciaci') || name.includes('amortizac')) {
    hq = 'Operating Expenses: Depreciation & Amortization';
  } else if (code.startsWith('7.')) {
    hq = 'Non-Operating: Financial Income / (Expense) & FX Translation';
  }

  return { agrupacionFiscal: fiscal, agrupacionMatrizExtranjera: hq };
}

/**
 * Infiere si una cuenta maneja multimoneda (moneda extranjera, NIC 21)
 */
export function inferDefaultMultiCurrency(account: { codigo: string; nombre: string }): boolean {
  const code = account.codigo;
  const name = account.nombre.toLowerCase();
  if (
    code.startsWith('1.1.02.003') ||
    code.startsWith('1.1.03.002') ||
    code.startsWith('2.1.01.002') ||
    name.includes('(usd)') ||
    name.includes('moneda extranjera') ||
    name.includes('exportacion') ||
    name.includes('exportación') ||
    name.includes('importacion') ||
    name.includes('importación') ||
    name.includes('diferencia de cambio') ||
    name.includes('divisas') ||
    name.includes('euro')
  ) {
    return true;
  }
  return false;
}

/**
 * Infiere el código de moneda extranjera por defecto (USD, EUR, UF)
 */
export function inferDefaultCurrencyCode(account: { codigo: string; nombre: string }): string {
  const name = account.nombre.toLowerCase();
  const code = account.codigo;
  if (code.startsWith('1.1.02.003') || name.includes('(usd)') || name.includes('dolar') || name.includes('dólar')) {
    return 'USD';
  }
  if (name.includes('euro') || name.includes('(eur)')) {
    return 'EUR';
  }
  if (name.includes('uf') || name.includes('unidad de fomento')) {
    return 'UF';
  }
  return 'USD';
}

/**
 * Infiere si una cuenta exige documento de referencia (Factura, Boleta, NC, ND, etc.)
 */
export function inferDefaultDocReferencia(account: { codigo: string; nombre: string }): boolean {
  const code = account.codigo;
  const name = account.nombre.toLowerCase();
  if (
    code.startsWith('1.1.03') || // Clientes / Documentos por cobrar
    code.startsWith('1.1.04') || // Impuestos recuperables IVA / PPM
    code.startsWith('1.1.05') || // Existencias / compras
    code.startsWith('2.1.01') || // Proveedores
    code.startsWith('2.1.02') || // Honorarios por pagar
    code.startsWith('2.1.03') || // IVA débito fiscal
    code.startsWith('2.1.04') || // Retenciones
    code.startsWith('4.1.01') || // Ventas afectas
    code.startsWith('4.1.02') || // Ventas exentas
    name.includes('factura') ||
    name.includes('cliente') ||
    name.includes('proveedor') ||
    name.includes('honorario') ||
    name.includes('iva') ||
    name.includes('por cobrar') ||
    name.includes('por pagar')
  ) {
    return true;
  }
  return false;
}

/**
 * Infiere si una cuenta corresponde a Efectivo y Efectivo Equivalente (NIC 7 / FECU)
 */
export function inferDefaultEfectivoEquivalente(account: { codigo: string; nombre: string }): boolean {
  const code = account.codigo;
  const name = account.nombre.toLowerCase();
  if (
    code.startsWith('1.1.01.001') || // Caja Central
    code.startsWith('1.1.01.002') || // Fondo Fijo / Caja Chica
    code.startsWith('1.1.02.001') || // Banco Santander
    code.startsWith('1.1.02.002') || // Banco de Chile
    code.startsWith('1.1.02.003') || // Banco USD
    (code.startsWith('1.1.01') && !name.includes('rendir') && !name.includes('transito') && !name.includes('tránsito') && !name.includes('puente')) ||
    (code.startsWith('1.1.02') && !name.includes('rendir') && !name.includes('transito') && !name.includes('tránsito')) ||
    name.includes('caja central') ||
    name.includes('caja chica') ||
    name.includes('fondo fijo') ||
    name.includes('cta cte') ||
    name.includes('cuenta corriente') ||
    (name.includes('banco') && !name.includes('credito') && !name.includes('préstamo') && !name.includes('prestamo'))
  ) {
    return true;
  }
  return false;
}

/**
 * Infiere si una cuenta es Contracuenta de Efectivo y Equivalente (Puente Tesorería / Recaudación / Tránsito)
 */
export function inferDefaultContracuentaEfectivo(account: { codigo: string; nombre: string }): boolean {
  const name = account.nombre.toLowerCase();
  if (
    name.includes('transito') ||
    name.includes('tránsito') ||
    name.includes('por rendir') ||
    name.includes('a rendir') ||
    name.includes('puente') ||
    name.includes('clearing') ||
    name.includes('recaudacion') ||
    name.includes('recaudación') ||
    name.includes('transbank') ||
    name.includes('webpay') ||
    name.includes('deposito pendiente') ||
    name.includes('depósito pendiente') ||
    name.includes('cheque en cartera') ||
    name.includes('fondos a rendir')
  ) {
    return true;
  }
  return false;
}

/**
 * Infiere si una cuenta exige Proyecto / Obra / Orden de Trabajo
 */
export function inferDefaultProyecto(account: { codigo: string; nombre: string }): boolean {
  const code = account.codigo;
  const name = account.nombre.toLowerCase();
  if (
    code.startsWith('5.') || // Costos de venta, obras, explotación
    code.startsWith('1.2.08') || // Obras en construcción
    name.includes('obra') ||
    name.includes('proyecto') ||
    name.includes('faena') ||
    name.includes('contrato') ||
    name.includes('subcontrat') ||
    name.includes('fabricacion') ||
    name.includes('fabricación') ||
    name.includes('mano de obra')
  ) {
    return true;
  }
  return false;
}

/**
 * Claves de almacenamiento por empresa
 */
function getStorageKey(empresaRut: string, suffix: string): string {
  const cleanRut = (empresaRut || 'default').replace(/[^a-zA-Z0-9]/g, '_');
  return `senior_orchestrator_chart_${cleanRut}_${suffix}`;
}

/**
 * K2.3: plantilla estándar del plan de cuentas (la única). Función pura: la usan el servidor al
 * inicializar el plan de una empresa y el navegador para mostrar la vista previa.
 */
export function buildStandardChartTemplate(empresaRut = ''): { chart: HierarchicalAccountItem[]; groups: AccountGroupDefinition[] } {
  const groupMap = new Map(DEFAULT_CHILEAN_GROUPS.map((g) => [g.codigo, g.nombre]));
  const chart: HierarchicalAccountItem[] = CHILE_HIERARCHICAL_CHART_OF_ACCOUNTS.map((acc) => {
    const mappings = inferDefaultMappings(acc);
    const isMulti = (acc as any).manejaMultimoneda ?? inferDefaultMultiCurrency(acc);
    return {
      ...acc,
      manejaMultimoneda: isMulti,
      monedaCodigo: (acc as any).monedaCodigo ?? (isMulti ? inferDefaultCurrencyCode(acc) : undefined),
      requiereDocReferencia: (acc as any).requiereDocReferencia ?? inferDefaultDocReferencia(acc),
      esEfectivoEquivalente: (acc as any).esEfectivoEquivalente ?? inferDefaultEfectivoEquivalente(acc),
      esContracuentaEfectivo: (acc as any).esContracuentaEfectivo ?? inferDefaultContracuentaEfectivo(acc),
      requiereProyecto: (acc as any).requiereProyecto ?? inferDefaultProyecto(acc),
      notasExplicativas: (acc as any).notasExplicativas ?? inferDefaultNoteNumbers(acc),
      nombreGrupo: groupMap.get(acc.grupo) || `Grupo ${acc.grupo}`,
      nombreSubgrupo: groupMap.get(acc.subgrupo) || `Subgrupo ${acc.subgrupo}`,
      agrupacionFiscal: mappings.agrupacionFiscal,
      agrupacionMatrizExtranjera: mappings.agrupacionMatrizExtranjera,
      ...(empresaRut ? { empresaRut } : {}),
    };
  });
  return { chart, groups: DEFAULT_CHILEAN_GROUPS.map((g) => ({ ...g })) };
}

// ============================================================================
// K2 · Plan de cuentas único: el servidor manda; el navegador solo guarda una copia en caché.
// ============================================================================
// Antes el plan vivía en el navegador: se generaba solo con la plantilla, se sincronizaba por RUT
// (para usuarios no SuperAdmin el servidor lo rechazaba) y, si el servidor no tenía plan, se adoptaba
// un plan de respaldo de 25 cuentas con otra codificación. Ahora:
//   - loadCompanyChartOfAccounts devuelve la copia en caché (o [] si la empresa no tiene plan) y
//     pide al servidor la versión vigente en segundo plano.
//   - saveCompanyChartOfAccounts guarda en el servidor; si el servidor lo rechaza (cuentas con
//     movimientos, plan inválido…) se avisa con el evento `companyChartSaveError` y se recarga.
//   - Una empresa sin plan se inicializa explícitamente (initializeCompanyChartOnServer).

export interface CompanyChartServerState {
  estado: 'SIN_PLAN' | 'CONFIGURADO';
  chart: HierarchicalAccountItem[];
  groups: AccountGroupDefinition[];
  meta: { origen: string; empresaOrigenId?: string; sistemaOrigen?: string; actualizadoEn?: string } | null;
  tieneMovimientos: boolean;
}

const chartApi = (empresaRut: string, suffix = '') => `/api/companies/${encodeURIComponent(empresaRut)}/chart${suffix}`;

function readCache<T>(key: string): T | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeCache(key: string, value: any): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* sin espacio o sin almacenamiento: la caché es opcional */
  }
}

function emit(name: string, detail: any): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  } catch {
    /* entorno sin CustomEvent */
  }
}

const pendingRefresh = new Set<string>();

/** Copia en caché del plan de la empresa ([] si no tiene plan). Pide la vigente al servidor en segundo plano. */
export function loadCompanyChartOfAccounts(empresaRut: string): HierarchicalAccountItem[] {
  const cached = readCache<HierarchicalAccountItem[]>(getStorageKey(empresaRut, 'accounts'));
  if (empresaRut && typeof fetch !== 'undefined' && !pendingRefresh.has(empresaRut)) {
    pendingRefresh.add(empresaRut);
    void fetchCompanyChartState(empresaRut)
      .then((st) => {
        if (st) emit('companyChartUpdated', { empresaRut, chart: st.chart, groups: st.groups, estado: st.estado });
      })
      .finally(() => pendingRefresh.delete(empresaRut));
  }
  return Array.isArray(cached) ? cached : [];
}

/** Estado del plan en el servidor (null si no hubo respuesta). Actualiza la caché. */
export async function fetchCompanyChartState(empresaRut: string): Promise<CompanyChartServerState | null> {
  try {
    const res = await fetch(chartApi(empresaRut));
    if (!res.ok) return null;
    const json = await res.json();
    if (!json?.success) return null;
    const state: CompanyChartServerState = {
      estado: json.estado,
      chart: Array.isArray(json.chart) ? json.chart : [],
      groups: Array.isArray(json.groups) ? json.groups : [],
      meta: json.meta || null,
      tieneMovimientos: Boolean(json.tieneMovimientos),
    };
    const key = getStorageKey(empresaRut, 'accounts');
    if (state.estado === 'SIN_PLAN') {
      // Un plan que solo existía en este navegador (versiones anteriores) se conserva aparte para
      // poder subirlo desde el asistente; no se usa como plan de la empresa.
      const local = readCache<HierarchicalAccountItem[]>(key);
      if (Array.isArray(local) && local.length > 0) writeCache(getStorageKey(empresaRut, 'legacy_accounts'), local);
    }
    writeCache(key, state.chart);
    writeCache(getStorageKey(empresaRut, 'groups'), state.groups);
    return state;
  } catch (err) {
    console.warn('[CompanyChartService] No se pudo obtener el plan del servidor:', err);
    return null;
  }
}

/** Plan vigente en el servidor; si no hay conexión, la copia en caché. */
export async function fetchCompanyChartOfAccounts(empresaRut: string): Promise<HierarchicalAccountItem[]> {
  const st = await fetchCompanyChartState(empresaRut);
  return st ? st.chart : loadCompanyChartOfAccounts(empresaRut);
}

/** Plan que quedó solo en este navegador antes de K2 (para subirlo desde el asistente). */
export function getLegacyBrowserChart(empresaRut: string): HierarchicalAccountItem[] {
  const legacy = readCache<HierarchicalAccountItem[]>(getStorageKey(empresaRut, 'legacy_accounts'));
  return Array.isArray(legacy) ? legacy : [];
}

export interface ChartSaveResult {
  ok: boolean;
  error?: string;
  code?: string;
  details?: any;
}

async function putChart(empresaRut: string, chart: HierarchicalAccountItem[], groups?: AccountGroupDefinition[]): Promise<ChartSaveResult> {
  try {
    const res = await fetch(chartApi(empresaRut), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chart, ...(groups ? { groups } : {}) }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) {
      const result = { ok: false, error: json.errorMessage || `HTTP ${res.status}`, code: json.code || json.error, details: json };
      emit('companyChartSaveError', { empresaRut, ...result });
      void fetchCompanyChartState(empresaRut).then((st) => st && emit('companyChartUpdated', { empresaRut, chart: st.chart, groups: st.groups, estado: st.estado }));
      return result;
    }
    writeCache(getStorageKey(empresaRut, 'accounts'), json.chart);
    writeCache(getStorageKey(empresaRut, 'groups'), json.groups);
    emit('companyChartUpdated', { empresaRut, chart: json.chart, groups: json.groups, estado: json.estado });
    return { ok: true };
  } catch (err: any) {
    const result = { ok: false, error: `Sin conexión con el servidor: ${err?.message || err}` };
    emit('companyChartSaveError', { empresaRut, ...result });
    return result;
  }
}

/** Guarda el plan editado en el servidor (con los grupos en caché). */
export function saveCompanyChartOfAccounts(empresaRut: string, chart: HierarchicalAccountItem[]): Promise<ChartSaveResult> {
  return putChart(empresaRut, chart, loadCompanyGroups(empresaRut));
}

export interface ChartInitializeInput {
  origen: 'PLANTILLA_ESTANDAR' | 'COPIA_EMPRESA' | 'IMPORTACION' | 'NAVEGADOR' | 'VACIO';
  empresaOrigenId?: string;
  cuentas?: HierarchicalAccountItem[];
  grupos?: AccountGroupDefinition[];
  sistemaOrigen?: string;
  equivalencias?: Array<{ codigoExterno: string; codigo: string }>;
  reemplazar?: boolean;
}

/** Inicializa el plan de una empresa en el servidor. */
export async function initializeCompanyChartOnServer(
  empresaRut: string,
  input: ChartInitializeInput
): Promise<{ ok: boolean; state?: CompanyChartServerState; error?: string; code?: string; details?: any }> {
  try {
    const res = await fetch(chartApi(empresaRut, '/initialize'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) return { ok: false, error: json.errorMessage || `HTTP ${res.status}`, code: json.code || json.error, details: json };
    const state: CompanyChartServerState = { estado: json.estado, chart: json.chart || [], groups: json.groups || [], meta: json.meta || null, tieneMovimientos: Boolean(json.tieneMovimientos) };
    writeCache(getStorageKey(empresaRut, 'accounts'), state.chart);
    writeCache(getStorageKey(empresaRut, 'groups'), state.groups);
    emit('companyChartUpdated', { empresaRut, chart: state.chart, groups: state.groups, estado: state.estado });
    return { ok: true, state };
  } catch (err: any) {
    return { ok: false, error: `Sin conexión con el servidor: ${err?.message || err}` };
  }
}

/** Valida un plan en el servidor sin guardarlo (vista previa de una importación). */
export async function validateChartOnServer(
  empresaRut: string,
  cuentas: any[]
): Promise<{ valido: boolean; cuentas: HierarchicalAccountItem[]; errores: any[]; advertencias: any[] } | null> {
  try {
    const res = await fetch(chartApi(empresaRut, '/validate'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cuentas }),
    });
    const json = await res.json();
    return json?.success ? json : null;
  } catch {
    return null;
  }
}

/** Empresas (del mismo cliente ERP y con acceso) desde las que se puede copiar el plan. */
export async function fetchChartCopySources(
  empresaRut: string
): Promise<Array<{ empresaId: string; rut: string; razonSocial: string; cuentas: number }>> {
  try {
    const res = await fetch(chartApi(empresaRut, '/copy-sources'));
    const json = await res.json();
    return Array.isArray(json?.fuentes) ? json.fuentes : [];
  } catch {
    return [];
  }
}

/**
 * Normaliza un código de cuenta contable para comparación homogénea eliminando ceros a la izquierda en subniveles
 * Ejemplo: '6.1.02.001' -> '6.1.2.1', '6.1.2.1' -> '6.1.2.1'
 */
export function normalizeAccountCodeKey(code?: string): string {
  if (!code) return '';
  return code
    .trim()
    .toLowerCase()
    .split('.')
    .map((part) => {
      const num = parseInt(part, 10);
      return isNaN(num) ? part.trim() : String(num);
    })
    .join('.');
}

/**
 * Grupos y subgrupos de la empresa (copia en caché del servidor; [] si no tiene plan).
 */
export function loadCompanyGroups(empresaRut: string): AccountGroupDefinition[] {
  const cached = readCache<AccountGroupDefinition[]>(getStorageKey(empresaRut, 'groups'));
  return Array.isArray(cached) ? cached : [];
}

/** Guarda los grupos junto con el plan en el servidor. */
export function saveCompanyGroups(empresaRut: string, groups: AccountGroupDefinition[]): Promise<ChartSaveResult> {
  writeCache(getStorageKey(empresaRut, 'groups'), groups);
  emit('companyGroupsUpdated', { empresaRut, groups });
  return putChart(empresaRut, loadCompanyChartOfAccounts(empresaRut), groups);
}

export async function fetchCompanyGroups(empresaRut: string): Promise<AccountGroupDefinition[]> {
  const st = await fetchCompanyChartState(empresaRut);
  return st ? st.groups : loadCompanyGroups(empresaRut);
}

/**
 * Reemplaza el plan por la plantilla estándar (solo si la empresa no tiene asientos).
 */
export async function resetCompanyChartToDefault(empresaRut: string): Promise<{ ok: boolean; chart: HierarchicalAccountItem[]; groups: AccountGroupDefinition[]; error?: string }> {
  const r = await initializeCompanyChartOnServer(empresaRut, { origen: 'PLANTILLA_ESTANDAR', reemplazar: true });
  if (!r.ok || !r.state) return { ok: false, chart: loadCompanyChartOfAccounts(empresaRut), groups: loadCompanyGroups(empresaRut), error: r.error };
  return { ok: true, chart: r.state.chart, groups: r.state.groups };
}

/**
 * Calcula la suma de las 8 columnas para un conjunto de cuentas
 */
export function computeSubtotals(cuentas: TrialBalance8ColAccount[]): TrialBalance8ColTotals {
  return {
    total_debitos: cuentas.reduce((s, c) => s + (c.debitos || 0), 0),
    total_creditos: cuentas.reduce((s, c) => s + (c.creditos || 0), 0),
    total_saldo_deudor: cuentas.reduce((s, c) => s + (c.saldo_deudor || 0), 0),
    total_saldo_acreedor: cuentas.reduce((s, c) => s + (c.saldo_acreedor || 0), 0),
    total_activo: cuentas.reduce((s, c) => s + (c.activo || 0), 0),
    total_pasivo: cuentas.reduce((s, c) => s + (c.pasivo || 0), 0),
    total_perdida: cuentas.reduce((s, c) => s + (c.perdida || 0), 0),
    total_ganancia: cuentas.reduce((s, c) => s + (c.ganancia || 0), 0),
  };
}

/**
 * Generador de Balances Agrupados por Esquema:
 * - TRADICIONAL_CMF: Clase -> Grupo -> Subgrupo -> Cuentas
 * - AGRUPACION_FISCAL_SII: Agrupación Fiscal -> Cuentas
 * - CASA_MATRIZ_EXTRANJERA: Reporting HQ Category -> Cuentas
 * - PERSONALIZADA: Categoría Custom -> Cuentas
 */
export function buildGroupedBalanceReport(
  balance8Col: Balance8ColumnasReport,
  chart: HierarchicalAccountItem[],
  groups: AccountGroupDefinition[],
  modo: BalanceGroupingMode = 'TRADICIONAL_CMF'
): GroupedBalanceReport {
  const chartMap = new Map<string, HierarchicalAccountItem>();
  chart.forEach((acc) => {
    chartMap.set(acc.codigo, acc);
  });

  const groupDefMap = new Map<string, AccountGroupDefinition>();
  groups.forEach((g) => {
    groupDefMap.set(g.codigo, g);
  });

  // Modo 1: Tradicional CMF (Clase -> Grupo -> Subgrupo)
  if (modo === 'TRADICIONAL_CMF') {
    const classNames: Record<number, string> = {
      1: 'Clase 1: ACTIVO (Corriente y No Corriente)',
      2: 'Clase 2: PASIVO (Corriente y No Corriente)',
      3: 'Clase 3: PATRIMONIO NETO',
      4: 'Clase 4: INGRESOS DE LA OPERACIÓN',
      5: 'Clase 5: COSTOS DE EXPLOTACIÓN',
      6: 'Clase 6: GASTOS DE ADMINISTRACIÓN Y VENTAS',
      7: 'Clase 7: OTROS INGRESOS Y GASTOS NO OPERACIONALES',
    };

    // Agrupar cuentas por clase
    const classGroupsMap = new Map<number, TrialBalance8ColAccount[]>();
    for (let c = 1; c <= 7; c++) {
      classGroupsMap.set(c, []);
    }

    balance8Col.cuentas.forEach((acc) => {
      const cls = acc.clase >= 1 && acc.clase <= 7 ? acc.clase : 1;
      const list = classGroupsMap.get(cls) || [];
      list.push(acc);
      classGroupsMap.set(cls, list);
    });

    const rootGroups: GroupedBalanceItem[] = [];

    for (let cls = 1; cls <= 7; cls++) {
      const classAccounts = classGroupsMap.get(cls) || [];
      if (classAccounts.length === 0) continue;

      // Subdividir por grupo (ej: 1.1, 1.2)
      const grpMap = new Map<string, TrialBalance8ColAccount[]>();
      classAccounts.forEach((acc) => {
        const item = chartMap.get(acc.codigo);
        const grpCode = item?.grupo || `${cls}.1`;
        const list = grpMap.get(grpCode) || [];
        list.push(acc);
        grpMap.set(grpCode, list);
      });

      const subgrupoItems: GroupedBalanceItem[] = [];

      Array.from(grpMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .forEach(([grpCode, grpAccounts]) => {
          const groupDef = groupDefMap.get(grpCode);
          const grpTitle = groupDef?.nombre || `Grupo ${grpCode}`;

          // Subdividir por subgrupo (ej: 1.1.01)
          const subMap = new Map<string, TrialBalance8ColAccount[]>();
          grpAccounts.forEach((acc) => {
            const item = chartMap.get(acc.codigo);
            const subCode = item?.subgrupo || `${grpCode}.01`;
            const list = subMap.get(subCode) || [];
            list.push(acc);
            subMap.set(subCode, list);
          });

          const leafSubgroups: GroupedBalanceItem[] = [];

          Array.from(subMap.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .forEach(([subCode, subAccounts]) => {
              const subDef = groupDefMap.get(subCode);
              const subTitle = subDef?.nombre || `Subgrupo ${subCode}`;
              leafSubgroups.push({
                id: `subgrp-${subCode}`,
                codigo: subCode,
                titulo: subTitle,
                nivel: 3,
                esGrupo: false,
                cuentas: subAccounts,
                subgrupos: [],
                totales: computeSubtotals(subAccounts),
              });
            });

          subgrupoItems.push({
            id: `grp-${grpCode}`,
            codigo: grpCode,
            titulo: grpTitle,
            nivel: 2,
            esGrupo: true,
            cuentas: grpAccounts,
            subgrupos: leafSubgroups,
            totales: computeSubtotals(grpAccounts),
          });
        });

      rootGroups.push({
        id: `class-${cls}`,
        codigo: String(cls),
        titulo: classNames[cls] || `Clase ${cls}`,
        nivel: 1,
        esGrupo: true,
        cuentas: classAccounts,
        subgrupos: subgrupoItems,
        totales: computeSubtotals(classAccounts),
      });
    }

    return {
      modo,
      nombreEsquema: 'Balance Tradicional CMF / SII (5 Niveles)',
      descripcionEsquema: 'Agrupación jerárquica canónica por Clase, Grupo de Mayor y Subgrupo Analítico.',
      grupos: rootGroups,
      totalesGenerales: balance8Col.totales,
      resultado_del_ejercicio: balance8Col.resultado_del_ejercicio,
    };
  }

  // Modo 2: Agrupación Fiscal SII (F22 / RLI)
  if (modo === 'FISCAL_SII' || modo === 'AGRUPACION_FISCAL_SII') {
    const fiscalMap = new Map<string, TrialBalance8ColAccount[]>();

    balance8Col.cuentas.forEach((acc) => {
      const item = chartMap.get(acc.codigo);
      const category = item?.agrupacionFiscal || inferDefaultMappings({ ...item, codigo: acc.codigo, nombre: acc.nombre } as any).agrupacionFiscal;
      const list = fiscalMap.get(category) || [];
      list.push(acc);
      fiscalMap.set(category, list);
    });

    const rootGroups: GroupedBalanceItem[] = [];
    let idx = 1;

    FISCAL_GROUPING_OPTIONS.forEach((catName) => {
      const accs = fiscalMap.get(catName);
      if (accs && accs.length > 0) {
        rootGroups.push({
          id: `fiscal-${idx++}`,
          codigo: `F-${String(idx).padStart(2, '0')}`,
          titulo: catName,
          nivel: 1,
          esGrupo: true,
          cuentas: accs,
          subgrupos: [],
          totales: computeSubtotals(accs),
        });
        fiscalMap.delete(catName);
      }
    });

    // Añadir partidas fiscales personalizadas no listadas en el catálogo base
    fiscalMap.forEach((accs, catName) => {
      if (accs.length > 0) {
        rootGroups.push({
          id: `fiscal-${idx++}`,
          codigo: `F-${String(idx).padStart(2, '0')}`,
          titulo: catName,
          nivel: 1,
          esGrupo: true,
          cuentas: accs,
          subgrupos: [],
          totales: computeSubtotals(accs),
        });
      }
    });

    return {
      modo,
      nombreEsquema: 'Balance por Agrupación Fiscal SII (Formulario 22 & RLI)',
      descripcionEsquema: 'Partidas consolidadas según su tratamiento tributario (Capital de Trabajo, Activo Inmovilizado, Gastos Art. 31 LIR).',
      grupos: rootGroups,
      totalesGenerales: balance8Col.totales,
      resultado_del_ejercicio: balance8Col.resultado_del_ejercicio,
    };
  }

  // Modo 3: Casa Matriz en el Extranjero (Headquarters US GAAP / IFRS Reporting)
  if (modo === 'CASA_MATRIZ_HQ' || modo === 'CASA_MATRIZ_EXTRANJERA') {
    const hqMap = new Map<string, TrialBalance8ColAccount[]>();

    balance8Col.cuentas.forEach((acc) => {
      const item = chartMap.get(acc.codigo);
      const category = item?.agrupacionMatrizExtranjera || inferDefaultMappings({ ...item, codigo: acc.codigo, nombre: acc.nombre } as any).agrupacionMatrizExtranjera;
      const list = hqMap.get(category) || [];
      list.push(acc);
      hqMap.set(category, list);
    });

    const rootGroups: GroupedBalanceItem[] = [];
    let idx = 1;

    HEADQUARTERS_GROUPING_OPTIONS.forEach((catName) => {
      const accs = hqMap.get(catName);
      if (accs && accs.length > 0) {
        rootGroups.push({
          id: `hq-${idx++}`,
          codigo: `HQ-${String(idx).padStart(2, '0')}`,
          titulo: catName,
          nivel: 1,
          esGrupo: true,
          cuentas: accs,
          subgrupos: [],
          totales: computeSubtotals(accs),
        });
        hqMap.delete(catName);
      }
    });

    hqMap.forEach((accs, catName) => {
      if (accs.length > 0) {
        rootGroups.push({
          id: `hq-${idx++}`,
          codigo: `HQ-${String(idx).padStart(2, '0')}`,
          titulo: catName,
          nivel: 1,
          esGrupo: true,
          cuentas: accs,
          subgrupos: [],
          totales: computeSubtotals(accs),
        });
      }
    });

    return {
      modo,
      nombreEsquema: 'Balance para Casa Matriz Extranjera (HQ US GAAP / IFRS)',
      descripcionEsquema: 'Presentación bilingüe normalizada para consolidación corporativa en matriz internacional.',
      grupos: rootGroups,
      totalesGenerales: balance8Col.totales,
      resultado_del_ejercicio: balance8Col.resultado_del_ejercicio,
    };
  }

  // Modo 4: Personalizada del Contador Jefe
  const customMap = new Map<string, TrialBalance8ColAccount[]>();
  balance8Col.cuentas.forEach((acc) => {
    const item = chartMap.get(acc.codigo);
    const category = item?.agrupacionPersonalizada || item?.nombreGrupo || 'Otras Partidas Generales';
    const list = customMap.get(category) || [];
    list.push(acc);
    customMap.set(category, list);
  });

  const rootGroups: GroupedBalanceItem[] = [];
  let idx = 1;
  customMap.forEach((accs, catName) => {
    rootGroups.push({
      id: `custom-${idx++}`,
      codigo: `C-${String(idx).padStart(2, '0')}`,
      titulo: catName,
      nivel: 1,
      esGrupo: true,
      cuentas: accs,
      subgrupos: [],
      totales: computeSubtotals(accs),
    });
  });

  return {
    modo,
    nombreEsquema: 'Balance según Agrupación Personalizada del Contador',
    descripcionEsquema: 'Estructura a la medida diseñada por el Contador Jefe según centros de gestión o líneas de negocio.',
    grupos: rootGroups,
    totalesGenerales: balance8Col.totales,
    resultado_del_ejercicio: balance8Col.resultado_del_ejercicio,
  };
}

/**
 * Exportar Plan de Cuentas a CSV compatible con Excel
 */
export function exportChartToCSV(chart: HierarchicalAccountItem[]): string {
  const headers = [
    'Codigo',
    'Nombre',
    'Clase',
    'Grupo',
    'Nombre_Grupo',
    'Subgrupo',
    'Nombre_Subgrupo',
    'Tipo',
    'Naturaleza',
    'Agrupacion_Fiscal',
    'Agrupacion_Casa_Matriz',
    'Agrupacion_Personalizada',
    'Requiere_Auxiliar_RUT',
    'Requiere_Centro_Costo',
    'Es_Conciliable_Bancaria',
    'Maneja_Multimoneda',
    'Documento_Referencia',
    'Efectivo_Equivalente',
    'Contracuenta_Efectivo',
    'Proyecto',
    'Activa',
  ];

  const rows = chart.map((c) => [
    `"${c.codigo}"`,
    `"${c.nombre.replace(/"/g, '""')}"`,
    c.clase,
    `"${c.grupo}"`,
    `"${(c.nombreGrupo || '').replace(/"/g, '""')}"`,
    `"${c.subgrupo}"`,
    `"${(c.nombreSubgrupo || '').replace(/"/g, '""')}"`,
    `"${c.tipo}"`,
    `"${c.naturaleza}"`,
    `"${(c.agrupacionFiscal || '').replace(/"/g, '""')}"`,
    `"${(c.agrupacionMatrizExtranjera || '').replace(/"/g, '""')}"`,
    `"${(c.agrupacionPersonalizada || '').replace(/"/g, '""')}"`,
    c.requiereAuxiliarRut ? 'SI' : 'NO',
    c.requiereCentroCosto ? 'SI' : 'NO',
    c.esConciliableBancaria ? 'SI' : 'NO',
    c.manejaMultimoneda ? 'SI' : 'NO',
    c.requiereDocReferencia ? 'SI' : 'NO',
    c.esEfectivoEquivalente ? 'SI' : 'NO',
    c.esContracuentaEfectivo ? 'SI' : 'NO',
    c.requiereProyecto ? 'SI' : 'NO',
    c.activa ? 'SI' : 'NO',
  ]);

  return [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
}
