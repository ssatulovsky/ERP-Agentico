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
  { id: 'sub-1.1.02', codigo: '1.1.02', nombre: 'Inversiones y Depósitos de Corto Plazo', clase: 1, nivel: 3, padreCodigo: '1.1' },
  { id: 'sub-1.1.03', codigo: '1.1.03', nombre: 'Deudores Comerciales y Cuentas por Cobrar Clientes', clase: 1, nivel: 3, padreCodigo: '1.1' },
  { id: 'sub-1.1.04', codigo: '1.1.04', nombre: 'Documentos y Letras por Cobrar', clase: 1, nivel: 3, padreCodigo: '1.1' },
  { id: 'sub-1.1.05', codigo: '1.1.05', nombre: 'Impuestos Mensuales por Recuperar (IVA CF, PPM, Remanente)', clase: 1, nivel: 3, padreCodigo: '1.1' },
  { id: 'sub-1.1.06', codigo: '1.1.06', nombre: 'Existencias e Inventarios de Mercaderías', clase: 1, nivel: 3, padreCodigo: '1.1' },
  { id: 'sub-1.1.07', codigo: '1.1.07', nombre: 'Anticipos a Proveedores y Gastos Pagados por Anticipado', clase: 1, nivel: 3, padreCodigo: '1.1' },

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
  { id: 'sub-2.1.05', codigo: '2.1.05', nombre: 'Préstamos y Obligaciones Bancarias de Corto Plazo', clase: 2, nivel: 3, padreCodigo: '2.1' },

  { id: 'grp-2.2', codigo: '2.2', nombre: 'Pasivo No Corriente / Largo Plazo', clase: 2, nivel: 2, descripcion: 'Deudas y compromisos exigibles con vencimiento mayor a un año.' },
  { id: 'sub-2.2.01', codigo: '2.2.01', nombre: 'Créditos Hipotecarios y Financiamiento Bancario LP', clase: 2, nivel: 3, padreCodigo: '2.2' },
  { id: 'sub-2.2.02', codigo: '2.2.02', nombre: 'Pasivo por Arrendamiento Largo Plazo (IFRS 16)', clase: 2, nivel: 3, padreCodigo: '2.2' },
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
 * Cargar Plan de Cuentas personalizado para una empresa
 */
export function loadCompanyChartOfAccounts(empresaRut: string): HierarchicalAccountItem[] {
  const key = getStorageKey(empresaRut, 'accounts');
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item: any) => ({
          ...item,
          manejaMultimoneda: item.manejaMultimoneda ?? inferDefaultMultiCurrency(item),
          monedaCodigo: item.monedaCodigo ?? ((item.manejaMultimoneda || inferDefaultMultiCurrency(item)) ? inferDefaultCurrencyCode(item) : undefined),
          requiereDocReferencia: item.requiereDocReferencia ?? inferDefaultDocReferencia(item),
          esEfectivoEquivalente: item.esEfectivoEquivalente ?? inferDefaultEfectivoEquivalente(item),
          esContracuentaEfectivo: item.esContracuentaEfectivo ?? inferDefaultContracuentaEfectivo(item),
          requiereProyecto: item.requiereProyecto ?? inferDefaultProyecto(item),
          notasExplicativas: item.notasExplicativas ?? inferDefaultNoteNumbers(item),
        }));
      }
    }
  } catch (e) {
    console.warn('Error leyendo plan de cuentas desde localStorage:', e);
  }

  // Inicializar enriquecido con nombres de grupo y subgrupos estándar
  const groups = loadCompanyGroups(empresaRut);
  const groupMap = new Map(groups.map((g) => [g.codigo, g.nombre]));

  const initialChart: HierarchicalAccountItem[] = CHILE_HIERARCHICAL_CHART_OF_ACCOUNTS.map((acc) => {
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
      empresaRut,
    };
  });

  saveCompanyChartOfAccounts(empresaRut, initialChart);
  return initialChart;
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
 * Guardar Plan de Cuentas personalizado de la empresa (Sincronización Local + Servidor Multi-Usuario)
 */
export function saveCompanyChartOfAccounts(empresaRut: string, chart: HierarchicalAccountItem[]): void {
  const key = getStorageKey(empresaRut, 'accounts');
  try {
    localStorage.setItem(key, JSON.stringify(chart));
  } catch (e) {
    console.error('Error guardando plan de cuentas en localStorage:', e);
  }

  // Notificar en caliente a la ventana y pestañas locales
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(
        new CustomEvent('companyChartUpdated', {
          detail: { empresaRut, chart },
        })
      );
    } catch {}
  }

  // Sincronizar en segundo plano con el backend y base de datos MySQL (para que otros usuarios y el contador lo vean)
  if (typeof fetch !== 'undefined') {
    fetch('/api/accounting/chart-of-accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ empresaId: empresaRut, chart }),
    }).catch((err) => {
      console.warn('[CompanyChartService] No se pudo sincronizar plan de cuentas con el servidor:', err);
    });
  }
}

/**
 * Obtener Plan de Cuentas actualizado desde el Servidor / Base de Datos MySQL
 */
export async function fetchCompanyChartOfAccounts(empresaRut: string): Promise<HierarchicalAccountItem[]> {
  try {
    const res = await fetch(`/api/accounting/chart-of-accounts?empresaId=${encodeURIComponent(empresaRut)}`);
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        // Mapear al modelo frontend tipado
        const mapped: HierarchicalAccountItem[] = json.data.map((item: any) => ({
          codigo: item.codigo || item.codigoCuenta,
          nombre: item.nombre || item.nombreCuenta,
          clase: item.clase || (item.codigo || item.codigoCuenta ? (parseInt(String(item.codigo || item.codigoCuenta).charAt(0), 10) as any) : 1),
          grupo: item.grupo || (item.codigo || item.codigoCuenta ? String(item.codigo || item.codigoCuenta).substring(0, 3) : '1.1'),
          subgrupo: item.subgrupo || (item.codigo || item.codigoCuenta ? String(item.codigo || item.codigoCuenta).substring(0, 6) : '1.1.01'),
          nivel: item.nivel || 5,
          tipo: item.tipo || (item.clasificacion === 'ACTIVO' ? 'ACTIVO' : item.clasificacion === 'PASIVO' ? 'PASIVO' : item.clasificacion === 'PATRIMONIO' ? 'PATRIMONIO' : item.clasificacion === 'INGRESOS' ? 'INGRESO' : item.clasificacion === 'COSTOS' ? 'COSTO' : 'GASTO'),
          clasificacion: item.clasificacion || 'OPERACIONAL',
          naturaleza: item.naturaleza || (item.tipo === 'PASIVO' || item.tipo === 'PATRIMONIO' || item.tipo === 'INGRESO' ? 'ACREEDORA' : 'DEUDORA'),
          requiereAuxiliarRut: item.requiereAuxiliarRut !== undefined ? Boolean(item.requiereAuxiliarRut) : Boolean(item.aceptaAuxiliar),
          requiereCentroCosto: Boolean(item.requiereCentroCosto),
          esConciliableBancaria: Boolean(item.esConciliableBancaria),
          activa: item.activa !== false,
          manejaMultimoneda: Boolean(item.manejaMultimoneda),
          monedaCodigo: item.monedaCodigo || 'CLP',
          requiereDocReferencia: item.requiereDocReferencia !== undefined ? Boolean(item.requiereDocReferencia) : Boolean(item.requiereDocRef),
          esEfectivoEquivalente: Boolean(item.esEfectivoEquivalente),
          esContracuentaEfectivo: Boolean(item.esContracuentaEfectivo),
          requiereProyecto: Boolean(item.requiereProyecto),
          notasExplicativas: item.notasExplicativas || undefined,
          tipoAuxiliarPermitido: item.tipoAuxiliarPermitido || undefined,
          auxiliarPredeterminadoRut: item.auxiliarPredeterminadoRut || undefined,
          agrupacionFiscal: item.agrupacionFiscal,
          agrupacionMatrizExtranjera: item.agrupacionMatrizExtranjera,
          agrupacionPersonalizada: item.agrupacionPersonalizada,
          empresaRut,
        }));

        const key = getStorageKey(empresaRut, 'accounts');
        try {
          localStorage.setItem(key, JSON.stringify(mapped));
        } catch {}

        return mapped;
      }
    }
  } catch (err) {
    console.warn('[CompanyChartService] Error al obtener plan del servidor:', err);
  }
  return loadCompanyChartOfAccounts(empresaRut);
}

/**
 * Cargar Grupos y Subgrupos personalizados de la empresa
 */
export function loadCompanyGroups(empresaRut: string): AccountGroupDefinition[] {
  const key = getStorageKey(empresaRut, 'groups');
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Error leyendo grupos desde localStorage:', e);
  }

  saveCompanyGroups(empresaRut, DEFAULT_CHILEAN_GROUPS);
  return DEFAULT_CHILEAN_GROUPS;
}

/**
 * Guardar Grupos y Subgrupos personalizados de la empresa (Sincronización Local + Servidor Multi-Usuario)
 */
export function saveCompanyGroups(empresaRut: string, groups: AccountGroupDefinition[]): void {
  const key = getStorageKey(empresaRut, 'groups');
  try {
    localStorage.setItem(key, JSON.stringify(groups));
  } catch (e) {
    console.error('Error guardando grupos en localStorage:', e);
  }

  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(
        new CustomEvent('companyGroupsUpdated', {
          detail: { empresaRut, groups },
        })
      );
    } catch {}
  }

  if (typeof fetch !== 'undefined') {
    fetch('/api/accounting/chart-groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ empresaId: empresaRut, groups }),
    }).catch(() => {});
  }
}

/**
 * Obtener Grupos y Subgrupos actualizados desde el Servidor
 */
export async function fetchCompanyGroups(empresaRut: string): Promise<AccountGroupDefinition[]> {
  try {
    const res = await fetch(`/api/accounting/chart-groups?empresaId=${encodeURIComponent(empresaRut)}`);
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        const key = getStorageKey(empresaRut, 'groups');
        try {
          localStorage.setItem(key, JSON.stringify(json.data));
        } catch {}
        return json.data;
      }
    }
  } catch (err) {
    console.warn('[CompanyChartService] Error al obtener grupos del servidor:', err);
  }
  return loadCompanyGroups(empresaRut);
}

/**
 * Restablecer Plan de Cuentas y Grupos al estándar oficial de Chile (CMF / SII)
 */
export function resetCompanyChartToDefault(empresaRut: string): {
  chart: HierarchicalAccountItem[];
  groups: AccountGroupDefinition[];
} {
  saveCompanyGroups(empresaRut, DEFAULT_CHILEAN_GROUPS);
  const groupMap = new Map(DEFAULT_CHILEAN_GROUPS.map((g) => [g.codigo, g.nombre]));

  const freshChart: HierarchicalAccountItem[] = CHILE_HIERARCHICAL_CHART_OF_ACCOUNTS.map((acc) => {
    const mappings = inferDefaultMappings(acc);
    return {
      ...acc,
      nombreGrupo: groupMap.get(acc.grupo) || `Grupo ${acc.grupo}`,
      nombreSubgrupo: groupMap.get(acc.subgrupo) || `Subgrupo ${acc.subgrupo}`,
      agrupacionFiscal: mappings.agrupacionFiscal,
      agrupacionMatrizExtranjera: mappings.agrupacionMatrizExtranjera,
      empresaRut,
    };
  });

  saveCompanyChartOfAccounts(empresaRut, freshChart);
  return { chart: freshChart, groups: DEFAULT_CHILEAN_GROUPS };
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
