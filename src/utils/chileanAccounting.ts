import {
  AccountingEntry,
  AccountingEntryLine,
  AccountPlanItem,
  ChileIndicators,
  DteDocument,
  EmployeePayroll,
  F29Declaration,
  LeaseContract,
  BankStatementMovement,
  InventoryItem,
  Warehouse,
  WarehouseTransfer,
  ReplenishmentRequisition,
  StockStatus,
} from '../types';
import { folioInterno } from './folioInterno';

// Default reference values for Chile
export const DEFAULT_INDICATORS: ChileIndicators = {
  uf: 39150.50,
  utm: 68320,
  dolar: 955.20,
  imm: 500000,
  topeImponibleAfpUf: 90.0, // Vigente Chile 2026 (anterior 84.3 UF)
  topeImponibleAfcUf: 135.2, // Vigente Chile 2026 (anterior 126.6 UF)
  retencionHonorariosTasa: 0.145, // 14.5% vigente en 2026
  sisTasa: 0.0149, // 1.49%
  mutualBaseTasa: 0.0093, // 0.93%
  ley21735AportePatronalTasa: 0.010, // 1.0% Ley 21.735 Reforma Previsional
  fecha: new Date().toISOString().split('T')[0],
};

// Official AFP rates in Chile (10% base + admin fee)
export const AFP_RATES: Record<string, number> = {
  CAPITAL: 0.1144,
  CUPRUM: 0.1144,
  HABITAT: 0.1127,
  PLANVITAL: 0.1116,
  PROVIDA: 0.1145,
  MODELO: 0.1058,
  UNO: 0.1049,
};

// Plan de Cuentas Chileno Estándar (CMF / SII / ERP Agéntico)
export const STANDARD_ACCOUNT_PLAN: AccountPlanItem[] = [
  // Activos Circulantes
  { codigo: '1.1.01', nombre: 'Banco Santander Moneda Nacional', tipo: 'ACTIVO', clasificacion: 'CIRCULANTE', esEfectivoEquivalente: true, esConciliableBancaria: true, requiereDocReferencia: false },
  { codigo: '1.1.01.03', nombre: 'Banco Moneda Extranjera (USD)', tipo: 'ACTIVO', clasificacion: 'CIRCULANTE', manejaMultimoneda: true, esEfectivoEquivalente: true, esConciliableBancaria: true },
  { codigo: '1.1.01.04', nombre: 'Valores en Tránsito y Clearing (Contracuenta Efectivo)', tipo: 'ACTIVO', clasificacion: 'CIRCULANTE', esContracuentaEfectivo: true, requiereDocReferencia: true },
  { codigo: '1.1.02', nombre: 'Caja Chica y Fondos Fijos', tipo: 'ACTIVO', clasificacion: 'CIRCULANTE', esEfectivoEquivalente: true },
  { codigo: '1.1.02.02', nombre: 'Fondos por Rendir Operacionales (Contracuenta Efectivo)', tipo: 'ACTIVO', clasificacion: 'CIRCULANTE', esContracuentaEfectivo: true, requiereDocReferencia: true, requiereAuxiliarRut: true },
  { codigo: '1.1.03', nombre: 'Clientes Nacionales (Cuentas por Cobrar)', tipo: 'ACTIVO', clasificacion: 'CIRCULANTE', requiereAuxiliarRut: true, requiereDocReferencia: true },
  { codigo: '1.1.03.02', nombre: 'Clientes Extranjeros / Exportaciones (USD)', tipo: 'ACTIVO', clasificacion: 'CIRCULANTE', requiereAuxiliarRut: true, requiereDocReferencia: true, manejaMultimoneda: true },
  { codigo: '1.1.04', nombre: 'Documentos por Cobrar', tipo: 'ACTIVO', clasificacion: 'CIRCULANTE', requiereDocReferencia: true },
  { codigo: '1.1.05', nombre: 'IVA Crédito Fiscal', tipo: 'ACTIVO', clasificacion: 'CIRCULANTE', requiereDocReferencia: true },
  { codigo: '1.1.06', nombre: 'Remanente de Crédito Fiscal', tipo: 'ACTIVO', clasificacion: 'CIRCULANTE' },
  { codigo: '1.1.07', nombre: 'PPM Pagos Provisorios Mensuales por Recuperar', tipo: 'ACTIVO', clasificacion: 'CIRCULANTE' },
  { codigo: '1.1.08', nombre: 'Mercaderías / Existencias Generales', tipo: 'ACTIVO', clasificacion: 'CIRCULANTE', requiereDocReferencia: true, requiereCentroCosto: true },
  { codigo: '1.1.08.01', nombre: 'Existencias - Materias Primas e Insumos', tipo: 'ACTIVO', clasificacion: 'CIRCULANTE', requiereDocReferencia: true, requiereCentroCosto: true },
  { codigo: '1.1.08.02', nombre: 'Existencias - Productos en Proceso (WIP / Proyectos)', tipo: 'ACTIVO', clasificacion: 'CIRCULANTE', requiereProyecto: true, requiereCentroCosto: true },
  { codigo: '1.1.08.03', nombre: 'Existencias - Productos Terminados', tipo: 'ACTIVO', clasificacion: 'CIRCULANTE' },
  { codigo: '1.1.09', nombre: 'Anticipo de Sueldos', tipo: 'ACTIVO', clasificacion: 'CIRCULANTE', requiereAuxiliarRut: true },
  
  // Activos No Circulantes / Fijos / IFRS 16 / NIC 16
  { codigo: '1.2.01', nombre: 'Activo por Derecho de Uso (IFRS 16)', tipo: 'ACTIVO', clasificacion: 'NO_CIRCULANTE' },
  { codigo: '1.2.02', nombre: 'Depreciación Acumulada Activo Derecho de Uso', tipo: 'ACTIVO', clasificacion: 'NO_CIRCULANTE' },
  { codigo: '1.2.03', nombre: 'Mobiliario e Instalaciones', tipo: 'ACTIVO', clasificacion: 'NO_CIRCULANTE', requiereCentroCosto: true },
  { codigo: '1.2.04', nombre: 'Equipos Computacionales y Servidores', tipo: 'ACTIVO', clasificacion: 'NO_CIRCULANTE', requiereCentroCosto: true },
  { codigo: '1.2.05', nombre: 'Maquinarias, Equipos y Embarcaciones', tipo: 'ACTIVO', clasificacion: 'NO_CIRCULANTE', requiereCentroCosto: true },
  { codigo: '1.2.06', nombre: 'Redes, Loberas e Instalaciones Acuícolas', tipo: 'ACTIVO', clasificacion: 'NO_CIRCULANTE', requiereCentroCosto: true },
  { codigo: '1.2.07', nombre: 'Vehículos de Terreno y Flota', tipo: 'ACTIVO', clasificacion: 'NO_CIRCULANTE', requiereCentroCosto: true },
  { codigo: '1.2.08', nombre: 'Infraestructura, Plantas y Edificios en Obra', tipo: 'ACTIVO', clasificacion: 'NO_CIRCULANTE', requiereProyecto: true, requiereCentroCosto: true },
  { codigo: '1.2.99', nombre: 'Depreciación Acumulada Activo Fijo (NIC 16)', tipo: 'ACTIVO', clasificacion: 'NO_CIRCULANTE' },
  
  // Pasivos Circulantes
  { codigo: '2.1.01', nombre: 'Proveedores Nacionales (Cuentas por Pagar)', tipo: 'PASIVO', clasificacion: 'CORTO_PLAZO', requiereAuxiliarRut: true, requiereDocReferencia: true },
  { codigo: '2.1.01.02', nombre: 'Proveedores Extranjeros / Importaciones (USD)', tipo: 'PASIVO', clasificacion: 'CORTO_PLAZO', requiereAuxiliarRut: true, requiereDocReferencia: true, manejaMultimoneda: true },
  { codigo: '2.1.02', nombre: 'Honorarios por Pagar', tipo: 'PASIVO', clasificacion: 'CORTO_PLAZO', requiereAuxiliarRut: true, requiereDocReferencia: true },
  { codigo: '2.1.03', nombre: 'IVA Débito Fiscal', tipo: 'PASIVO', clasificacion: 'CORTO_PLAZO', requiereDocReferencia: true },
  { codigo: '2.1.04', nombre: 'Retención Honorarios 2da Categoría por Pagar (F29)', tipo: 'PASIVO', clasificacion: 'CORTO_PLAZO' },
  { codigo: '2.1.05', nombre: 'Impuesto Único de Segunda Categoría por Pagar (F29)', tipo: 'PASIVO', clasificacion: 'CORTO_PLAZO' },
  { codigo: '2.1.06', nombre: 'PPM por Pagar (F29)', tipo: 'PASIVO', clasificacion: 'CORTO_PLAZO' },
  { codigo: '2.1.07', nombre: 'Sueldos Líquidos por Pagar', tipo: 'PASIVO', clasificacion: 'CORTO_PLAZO' },
  { codigo: '2.1.08', nombre: 'Instituciones Previsionales (AFP) por Pagar', tipo: 'PASIVO', clasificacion: 'CORTO_PLAZO' },
  { codigo: '2.1.09', nombre: 'Salud (Fonasa / Isapres) por Pagar', tipo: 'PASIVO', clasificacion: 'CORTO_PLAZO' },
  { codigo: '2.1.10', nombre: 'AFC Seguro de Cesantía por Pagar', tipo: 'PASIVO', clasificacion: 'CORTO_PLAZO' },
  { codigo: '2.1.11', nombre: 'Mutual de Seguridad / SIS por Pagar', tipo: 'PASIVO', clasificacion: 'CORTO_PLAZO' },
  { codigo: '2.1.12', nombre: 'Pasivo por Arrendamiento Corto Plazo (IFRS 16)', tipo: 'PASIVO', clasificacion: 'CORTO_PLAZO' },
  { codigo: '2.1.13', nombre: 'Arriendos por Pagar', tipo: 'PASIVO', clasificacion: 'CORTO_PLAZO', requiereDocReferencia: true },

  // Pasivos Largo Plazo
  { codigo: '2.2.01', nombre: 'Pasivo por Arrendamiento Largo Plazo (IFRS 16)', tipo: 'PASIVO', clasificacion: 'LARGO_PLAZO' },
  { codigo: '2.2.02', nombre: 'Créditos Bancarios Largo Plazo', tipo: 'PASIVO', clasificacion: 'LARGO_PLAZO' },

  // Patrimonio
  { codigo: '3.1.01', nombre: 'Capital Social Pagado', tipo: 'PATRIMONIO', clasificacion: 'NO_CIRCULANTE' },
  { codigo: '3.1.02', nombre: 'Resultados Acumulados', tipo: 'PATRIMONIO', clasificacion: 'NO_CIRCULANTE' },
  { codigo: '3.1.03', nombre: 'Resultado del Ejercicio', tipo: 'PATRIMONIO', clasificacion: 'NO_CIRCULANTE' },

  // Ingresos
  { codigo: '4.1.01', nombre: 'Ingresos por Ventas Afectas a IVA', tipo: 'INGRESO', clasificacion: 'OPERACIONAL', requiereDocReferencia: true, requiereCentroCosto: true },
  { codigo: '4.1.02', nombre: 'Ingresos por Servicios Exentos', tipo: 'INGRESO', clasificacion: 'OPERACIONAL', requiereDocReferencia: true, requiereCentroCosto: true },
  { codigo: '4.1.03', nombre: 'Intereses Ganados / Otros Ingresos', tipo: 'INGRESO', clasificacion: 'NO_OPERACIONAL' },
  { codigo: '4.1.04', nombre: 'Utilidad en Enajenación de Activo Fijo', tipo: 'INGRESO', clasificacion: 'NO_OPERACIONAL' },

  // Costos y Gastos
  { codigo: '5.1.01', nombre: 'Costo de Ventas / Mercaderías', tipo: 'COSTO', clasificacion: 'OPERACIONAL', requiereCentroCosto: true },
  { codigo: '5.1.02', nombre: 'Materia Prima Directa Consumida (MPD)', tipo: 'COSTO', clasificacion: 'OPERACIONAL', requiereProyecto: true, requiereCentroCosto: true },
  { codigo: '5.1.03', nombre: 'Mano de Obra Directa Fabril (MOD)', tipo: 'COSTO', clasificacion: 'OPERACIONAL', requiereProyecto: true, requiereCentroCosto: true },
  { codigo: '5.1.04', nombre: 'Costos Indirectos de Fabricación Reales (CIF)', tipo: 'COSTO', clasificacion: 'OPERACIONAL', requiereProyecto: true, requiereCentroCosto: true },
  { codigo: '5.1.05', nombre: 'Costos Indirectos de Fabricación Aplicados (WIP)', tipo: 'COSTO', clasificacion: 'OPERACIONAL', requiereProyecto: true, requiereCentroCosto: true },
  { codigo: '5.2.01', nombre: 'Sueldos y Remuneraciones Base', tipo: 'GASTO', clasificacion: 'OPERACIONAL', requiereCentroCosto: true },
  { codigo: '5.2.02', nombre: 'Gratificaciones Legales', tipo: 'GASTO', clasificacion: 'OPERACIONAL' },
  { codigo: '5.2.03', nombre: 'Horas Extras', tipo: 'GASTO', clasificacion: 'OPERACIONAL' },
  { codigo: '5.2.04', nombre: 'Aportes Patronales (SIS, Mutual, AFC Empleador)', tipo: 'GASTO', clasificacion: 'OPERACIONAL' },
  { codigo: '5.2.05', nombre: 'Asignaciones No Imponibles (Colación / Movilización)', tipo: 'GASTO', clasificacion: 'OPERACIONAL' },
  { codigo: '5.2.06', nombre: 'Gastos de Honorarios Profesionales', tipo: 'GASTO', clasificacion: 'OPERACIONAL' },
  { codigo: '5.2.07', nombre: 'Gasto por Arriendo Comercial', tipo: 'GASTO', clasificacion: 'OPERACIONAL' },
  { codigo: '5.2.08', nombre: 'Amortización Activo por Derecho de Uso (IFRS 16)', tipo: 'GASTO', clasificacion: 'OPERACIONAL' },
  { codigo: '5.2.09', nombre: 'Gastos Financieros por Arrendamiento (IFRS 16)', tipo: 'GASTO', clasificacion: 'OPERACIONAL' },
  { codigo: '5.2.10', nombre: 'Servicios Básicos (Luz, Agua, Telecomunicaciones)', tipo: 'GASTO', clasificacion: 'OPERACIONAL' },
  { codigo: '5.2.11', nombre: 'Software, Servidores y Licencias', tipo: 'GASTO', clasificacion: 'OPERACIONAL' },
  { codigo: '5.2.12', nombre: 'Gasto IVA No Recuperable (Art. 23 DL 825)', tipo: 'GASTO', clasificacion: 'OPERACIONAL' },
  { codigo: '5.2.13', nombre: 'Gasto Depreciación Activo Fijo (NIC 16)', tipo: 'GASTO', clasificacion: 'OPERACIONAL' },
  { codigo: '5.2.14', nombre: 'Pérdida en Retiro o Enajenación de Activo Fijo', tipo: 'GASTO', clasificacion: 'NO_OPERACIONAL' },
  { codigo: '6.1.01', nombre: 'Corrección Monetaria del Ejercicio (Art. 41 LIR)', tipo: 'GASTO', clasificacion: 'NO_OPERACIONAL' },
];

export const CHILE_CHART_OF_ACCOUNTS = STANDARD_ACCOUNT_PLAN;

/**
 * Format currency to standard Chilean Peso ($ CLP)
 */
export function formatCLP(amount: number): string {
  const rounded = Math.round(amount || 0);
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(rounded);
}

/**
 * Format raw number with thousand separators
 */
export function formatNumberCL(amount: number, decimals: number = 0): string {
  return new Intl.NumberFormat('es-CL', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount || 0);
}

/**
 * Convierte montos en pesos chilenos a texto formal para liquidaciones legales DT
 */
export function formatNumberToWordsCLP(amount: number): string {
  const n = Math.round(Math.abs(amount || 0));
  if (n === 0) return 'CERO PESOS M/CTE';

  const unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
  const decenas = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
  const diezY = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
  const veinti = ['VEINTE', 'VEINTIÚN', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE'];
  const centenas = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

  function readGroup(num: number): string {
    if (num === 0) return '';
    if (num === 100) return 'CIEN';
    let res = '';
    const c = Math.floor(num / 100);
    const d = Math.floor((num % 100) / 10);
    const u = num % 10;
    if (c > 0) res += centenas[c] + ' ';
    const du = num % 100;
    if (du >= 10 && du <= 19) {
      res += diezY[du - 10] + ' ';
    } else if (du >= 20 && du <= 29) {
      res += veinti[du - 20] + ' ';
    } else {
      if (d > 0) res += decenas[d] + (u > 0 ? ' Y ' : ' ');
      if (u > 0) res += unidades[u] + ' ';
    }
    return res.trim();
  }

  const millones = Math.floor(n / 1000000);
  const miles = Math.floor((n % 1000000) / 1000);
  const unidadesResto = n % 1000;

  let texto = '';
  if (millones > 0) {
    if (millones === 1) {
      texto += 'UN MILLÓN ';
    } else {
      texto += readGroup(millones) + ' MILLONES ';
    }
  }
  if (miles > 0) {
    if (miles === 1) {
      texto += 'MIL ';
    } else {
      texto += readGroup(miles) + ' MIL ';
    }
  }
  if (unidadesResto > 0) {
    texto += readGroup(unidadesResto) + ' ';
  }

  return `${texto.trim()} PESOS M/CTE`;
}

/**
 * Formato Normalizado Estricto exigido para asientos contables del Libro Diario
 * Cumplimiento del Código de Comercio chileno y normas IFRS/NIIF:
 * - Cuentas del DEBE primero (cargos)
 * - Cuentas del HABER a continuación (abonos, visualmente indentadas con prefijo "a ")
 * - Cero valores negativos en columnas de partida doble
 * - Totalizadores con sumas iguales al pie
 */
export function formatNormalizedAccountingEntry(entry: AccountingEntry): string {
  const separator = '--------------------------------------------------------------------------------';
  const header = `${separator}\nLIBRO DIARIO CANÓNICO - COMPROBANTE DE OPERACIONES\nFECHA: ${entry.fecha} | ORIGEN: ${entry.origen || 'DIARIO'}\nCONCEPTO: ${entry.concepto}\nDOCUMENTO: ${entry.documento || 'Sin documento de referencia'}\n\nLÍN  CÓDIGO    CUENTA CONTABLE                       DEBE ($)         HABER ($)\n${separator}`;

  // Separación y ordenamiento canónico estricto: DEBE primero, HABER después
  const debits: AccountingEntryLine[] = [];
  const credits: AccountingEntryLine[] = [];

  for (const line of entry.lineas || []) {
    let d = Number(line.debe) || 0;
    let h = Number(line.haber) || 0;

    // Sanitizar posibles negativos
    if (d < 0) {
      h += Math.abs(d);
      d = 0;
    }
    if (h < 0) {
      d += Math.abs(h);
      h = 0;
    }

    if (d > 0) {
      debits.push({ ...line, debe: d, haber: 0 });
    } else if (h > 0) {
      credits.push({ ...line, debe: 0, haber: h });
    }
  }

  let lineIdx = 1;
  const formattedLines: string[] = [];

  for (const l of debits) {
    const idxStr = String(lineIdx++).padStart(3, ' ');
    const codeStr = (l.cuentaCodigo || '9.9.99').padEnd(9, ' ');
    const rawName = l.cuentaNombre.length > 34 ? l.cuentaNombre.substring(0, 31) + '...' : l.cuentaNombre;
    const nameStr = rawName.padEnd(35, ' ');
    const debeStr = formatNumberCL(l.debe).padStart(15, ' ');
    const haberStr = ''.padStart(16, ' ');
    formattedLines.push(`${idxStr}  ${codeStr} ${nameStr} ${debeStr} ${haberStr}`);
  }

  for (const l of credits) {
    const idxStr = String(lineIdx++).padStart(3, ' ');
    const codeStr = (l.cuentaCodigo || '9.9.99').padEnd(9, ' ');
    const indentedName = `  a ${l.cuentaNombre}`;
    const rawName = indentedName.length > 34 ? indentedName.substring(0, 31) + '...' : indentedName;
    const nameStr = rawName.padEnd(35, ' ');
    const debeStr = ''.padStart(15, ' ');
    const haberStr = formatNumberCL(l.haber).padStart(16, ' ');
    formattedLines.push(`${idxStr}  ${codeStr} ${nameStr} ${debeStr} ${haberStr}`);
  }

  const calcTotalDebe = debits.reduce((s, l) => s + l.debe, 0);
  const calcTotalHaber = credits.reduce((s, l) => s + l.haber, 0);
  const diff = Math.abs(calcTotalDebe - calcTotalHaber);

  const totalDebeStr = formatNumberCL(calcTotalDebe).padStart(15, ' ');
  const totalHaberStr = formatNumberCL(calcTotalHaber).padStart(16, ' ');
  const estadoCuadre = diff < 0.01 ? '[PARTIDA DOBLE CUADRADA - BALANCEADA]' : `[DESCUADRE DETECTADO: $${diff.toFixed(2)}]`;

  const footer = `${separator}\nTOTALES SUMAS IGUALES                     ${totalDebeStr} ${totalHaberStr}\nESTADO: ${estadoCuadre}\n${separator}`;

  return `${header}\n${formattedLines.join('\n')}\n${footer}`;
}

/**
 * Calculate Impuesto Único de Segunda Categoría (Chilean Income Tax on Salaries)
 * Based on taxable base minus legal deductions in UTM brackets
 */
export function calculateImpuestoUnico(tributableBaseCLP: number, utmValue: number): number {
  if (tributableBaseCLP <= 0 || utmValue <= 0) return 0;
  
  const baseInUtm = tributableBaseCLP / utmValue;

  // Tramos oficiales mensuales
  if (baseInUtm <= 13.5) {
    return 0; // Tramo 1: Exento
  } else if (baseInUtm <= 30) {
    // Tramo 2: 4% (Rebaja: 0.54 UTM)
    const taxUtm = baseInUtm * 0.04 - 0.54;
    return Math.max(0, Math.round(taxUtm * utmValue));
  } else if (baseInUtm <= 50) {
    // Tramo 3: 8% (Rebaja: 1.74 UTM)
    const taxUtm = baseInUtm * 0.08 - 1.74;
    return Math.max(0, Math.round(taxUtm * utmValue));
  } else if (baseInUtm <= 70) {
    // Tramo 4: 13.5% (Rebaja: 4.49 UTM)
    const taxUtm = baseInUtm * 0.135 - 4.49;
    return Math.max(0, Math.round(taxUtm * utmValue));
  } else if (baseInUtm <= 90) {
    // Tramo 5: 23% (Rebaja: 11.14 UTM)
    const taxUtm = baseInUtm * 0.23 - 11.14;
    return Math.max(0, Math.round(taxUtm * utmValue));
  } else if (baseInUtm <= 120) {
    // Tramo 6: 30.4% (Rebaja: 17.80 UTM)
    const taxUtm = baseInUtm * 0.304 - 17.80;
    return Math.max(0, Math.round(taxUtm * utmValue));
  } else if (baseInUtm <= 310) {
    // Tramo 7: 35% (Rebaja: 23.32 UTM)
    const taxUtm = baseInUtm * 0.35 - 23.32;
    return Math.max(0, Math.round(taxUtm * utmValue));
  } else {
    // Tramo 8: 40% (Rebaja: 38.82 UTM)
    const taxUtm = baseInUtm * 0.40 - 38.82;
    return Math.max(0, Math.round(taxUtm * utmValue));
  }
}

/**
 * Calculate full liquid payroll and social security costs according to Chilean Law
 */
export function calculatePayroll(
  employee: Partial<EmployeePayroll>,
  indicators: ChileIndicators = DEFAULT_INDICATORS
): EmployeePayroll {
  const sueldoBase = Number(employee.sueldoBase) || 0; // 4.4: sin sueldo informado no se supone uno (antes $500.000)
  const tipoContrato = employee.tipoContrato || 'INDEFINIDO';
  const horasExtrasCant = employee.horasExtrasCantidad || 0;
  const comisiones = employee.comisionesBonosImponibles || 0;
  const colacion = employee.asignacionColacion || 0;
  const movilizacion = employee.asignacionMovilizacion || 0;
  const viaticos = employee.viaticosAsignacionFamiliar || 0;
  const diasTrabajados = employee.diasTrabajados || 30;

  // Jornada Laboral (Ley 21.561 40 Horas en Chile)
  const jornadaHoras = (employee as any).jornadaHorasSemanales || 40;
  // Factor hora extra según dictámenes DT: (1/30) * (28 / jornadaHoras) * 1.5
  const factorHoraExtra = (1 / 30) * (28 / jornadaHoras) * 1.5;
  const valorHoraExtra = Math.round(sueldoBase * factorHoraExtra);
  const horasExtrasMonto = horasExtrasCant * valorHoraExtra;

  // Gratificación Legal Art. 50 (25% del sueldo con tope anual 4.75 IMM / 12)
  let gratificacionMonto = 0;
  if (employee.gratificacionModalidad === 'ART_50') {
    const topeMensualArt50 = Math.round((4.75 * indicators.imm) / 12);
    const subtotalParaGratif = sueldoBase + horasExtrasMonto + comisiones;
    gratificacionMonto = Math.min(Math.round(subtotalParaGratif * 0.25), topeMensualArt50);
  } else if (employee.gratificacionMonto) {
    gratificacionMonto = employee.gratificacionMonto;
  }

  const totalHaberesImponibles = sueldoBase + horasExtrasMonto + comisiones + gratificacionMonto;
  const totalHaberesNoImponibles = colacion + movilizacion + viaticos;
  const totalHaberesBrutos = totalHaberesImponibles + totalHaberesNoImponibles;

  // Topes imponibles en pesos (2026: AFP 90.0 UF, AFC 135.2 UF)
  const topeAfpSaludCLP = Math.round((indicators.topeImponibleAfpUf || 90.0) * indicators.uf);
  const topeAfcCLP = Math.round((indicators.topeImponibleAfcUf || 135.2) * indicators.uf);

  const baseAfpSalud = Math.min(totalHaberesImponibles, topeAfpSaludCLP);
  const baseAfc = Math.min(totalHaberesImponibles, topeAfcCLP);

  // AFP Descuento
  const afpNombre = employee.afpNombre || 'HABITAT';
  const afpTasa = AFP_RATES[afpNombre] || 0.1127;
  const afpMonto = Math.round(baseAfpSalud * afpTasa);

  // Salud Descuento (Fonasa 7% o Isapre cotización pactada)
  const saludTipo = employee.saludTipo || 'FONASA';
  let saludMonto = Math.round(baseAfpSalud * 0.07);
  if (saludTipo === 'ISAPRE' && employee.saludPlanUf && employee.saludPlanUf > 0) {
    const planPactadoCLP = Math.round(employee.saludPlanUf * indicators.uf);
    saludMonto = Math.max(saludMonto, planPactadoCLP);
  }

  // AFC Trabajador (0.6% si es indefinido, 0% si plazo fijo)
  const afcTrabajadorTasa = tipoContrato === 'INDEFINIDO' ? 0.006 : 0.0;
  const afcTrabajadorMonto = Math.round(baseAfc * afcTrabajadorTasa);

  // Base Tributable para Impuesto Único (Imponible - Previsión - Salud obligatoria hasta 7% de tope - AFC)
  // Nota: Isapre solo se descuenta hasta el 7% o tope legal tributario (4.2 UF aprox)
  const topeSaludDeducible = Math.min(saludMonto, Math.round(baseAfpSalud * 0.07));
  const baseTributable = Math.max(0, totalHaberesImponibles - afpMonto - topeSaludDeducible - afcTrabajadorMonto);
  const impuestoUnicoMonto = calculateImpuestoUnico(baseTributable, indicators.utm);

  const otrosDescuentos = employee.otrosDescuentos || 0;
  const totalDescuentos = afpMonto + saludMonto + afcTrabajadorMonto + impuestoUnicoMonto + otrosDescuentos;
  const sueldoLiquido = totalHaberesBrutos - totalDescuentos;

  // Aportes Patronales (Costos Empleador)
  const sisEmpleadorMonto = Math.round(baseAfpSalud * indicators.sisTasa);
  const mutualEmpleadorMonto = Math.round(baseAfpSalud * indicators.mutualBaseTasa);
  const afcEmpleadorTasa = tipoContrato === 'INDEFINIDO' ? 0.024 : 0.030;
  const afcEmpleadorMonto = Math.round(baseAfc * afcEmpleadorTasa);

  // Ley 21.735: Aporte Previsional Patronal 1.0% (vigente desde agosto 2025/2026)
  const reformaPrevisionalLey21735Tasa = indicators.ley21735AportePatronalTasa ?? 0.010;
  const reformaPrevisionalLey21735Monto = Math.round(baseAfpSalud * reformaPrevisionalLey21735Tasa);

  const costoTotalEmpresa =
    totalHaberesBrutos +
    sisEmpleadorMonto +
    mutualEmpleadorMonto +
    afcEmpleadorMonto +
    reformaPrevisionalLey21735Monto;

  return {
    id: employee.id || `emp-${Date.now()}`,
    rut: employee.rut || '15.342.119-4',
    nombreCompleto: employee.nombreCompleto || 'Colaborador Ejemplo',
    cargo: employee.cargo || 'Analista de Operaciones',
    departamento: employee.departamento || 'Administración',
    fechaIngreso: employee.fechaIngreso || '2023-03-01',
    tipoContrato,
    diasTrabajados,
    sueldoBase,
    gratificacionModalidad: employee.gratificacionModalidad || 'ART_50',
    gratificacionMonto,
    horasExtrasCantidad: horasExtrasCant,
    horasExtrasMonto,
    comisionesBonosImponibles: comisiones,
    totalHaberesImponibles,
    asignacionColacion: colacion,
    asignacionMovilizacion: movilizacion,
    viaticosAsignacionFamiliar: viaticos,
    totalHaberesNoImponibles,
    totalHaberesBrutos,
    afpNombre,
    afpTasa,
    afpMonto,
    saludTipo,
    saludPlanUf: employee.saludPlanUf,
    saludMonto,
    afcTrabajadorMonto,
    impuestoUnicoMonto,
    otrosDescuentos,
    totalDescuentos,
    sueldoLiquido,
    sisEmpleadorMonto,
    mutualEmpleadorMonto,
    afcEmpleadorMonto,
    reformaPrevisionalLey21735Tasa,
    reformaPrevisionalLey21735Monto,
    costoTotalEmpresa,
    periodo: employee.periodo || new Date().toISOString().substring(0, 7),
    empresaId: employee.empresaId,
    esReliquidacion: employee.esReliquidacion || false,
    reliquidacionPeriodoOrigen: employee.reliquidacionPeriodoOrigen,
    diferencialImponible: employee.diferencialImponible || 0,
    diferencialImpuestoUnico: employee.diferencialImpuestoUnico || 0,
  };
}

export interface EntryAttributeEnrichmentContext {
  rutAuxiliar?: string;
  nombreAuxiliar?: string;
  centroCosto?: string;
  proyecto?: string;
  documentoRef?: string;
  tipoDocumentoRef?: string;
  folioDocumentoRef?: string;
  fechaDocumentoRef?: string;
  fechaVencimientoRef?: string;
  montoDocumentoRef?: number;
  dteIdAsociado?: string;
  tipoDocumentoConciliacion?: 'TRANSFERENCIA' | 'CHEQUE' | 'DEPOSITO' | 'CARGO_AUTOMATICO' | 'VALE_VISTA' | 'TARJETA_CORPORATIVA' | 'OTRO';
  documentoConciliacion?: string;
  monedaOriginal?: 'CLP' | 'USD' | 'EUR' | 'UF';
  montoMonedaOriginal?: number;
  tipoCambio?: number;
}

/**
 * Helper universal que inspecciona las marcas configuradas en cada cuenta del Plan de Cuentas
 * (requiereDocReferencia, requiereAuxiliarRut, requiereCentroCosto, requiereProyecto,
 * esConciliableBancaria, manejaMultimoneda) y garantiza que todas las líneas del asiento
 * generadas por cualquier módulo del ERP tengan completos sus atributos asociados y su
 * trazabilidad cruzada Banco <-> Auxiliar (incluyendo pagos multi-factura y multi-proveedor).
 */
export function enrichEntryWithChartAttributes(
  entry: AccountingEntry,
  customChart?: Array<Partial<AccountPlanItem> & Record<string, any>>,
  contextDefaults?: EntryAttributeEnrichmentContext
): AccountingEntry {
  if (!entry || !Array.isArray(entry.lineas) || entry.lineas.length === 0) {
    return entry;
  }

  const catalog = [
    ...(Array.isArray(customChart) ? customChart : []),
    ...STANDARD_ACCOUNT_PLAN,
  ];

  const findAccountMeta = (codeRaw?: string, nameRaw?: string) => {
    const c = (codeRaw || '').trim().toLowerCase();
    const n = (nameRaw || '').trim().toLowerCase();
    return (
      catalog.find((a) => (a.codigo || '').trim().toLowerCase() === c) ||
      catalog.find((a) => c && (a.codigo || '').trim().toLowerCase().startsWith(c)) ||
      catalog.find((a) => c && c.startsWith((a.codigo || '').trim().toLowerCase())) ||
      (n ? catalog.find((a) => (a.nombre || '').trim().toLowerCase() === n) : undefined)
    );
  };

  // Extraer folio base desde entry.documento si no viene explícito
  const docHeader = (contextDefaults?.documentoRef || entry.documento || entry.documentoReferencia || '').trim();
  const folioMatch = docHeader.match(/(?:N°|#|Folio|F\.|Ref:?)\s*([A-Za-z0-9\-_./]+)/i) || docHeader.match(/([0-9]{2,}[A-Za-z0-9\-_]*)/);
  const extractedFolio = contextDefaults?.folioDocumentoRef || (folioMatch ? folioMatch[1] : docHeader || 'S/F');

  const defaultTipoDocByOrigin = (): string => {
    if (contextDefaults?.tipoDocumentoRef) return contextDefaults.tipoDocumentoRef;
    const orig = (entry.origen || '').toUpperCase();
    if (orig.includes('VENTA') || orig.includes('COMPRA') || orig === 'INVENTARIO') return 'DTE_SII';
    if (orig.includes('HONORARIO') || orig === 'BHE') return 'BOLETA_HONORARIOS';
    if (orig.includes('REMUNERACION') || orig.includes('RRHH')) return 'DOCUMENTO_LABORAL';
    if (orig.includes('F29') || orig.includes('TRIBUTARIO')) return 'TRIBUTARIO_TGR';
    if (orig.includes('RENDICION') || orig.includes('GASTO')) return 'RENDICION_GASTOS';
    if (orig.includes('ARRIENDO') || orig.includes('IFRS16')) return 'CONTRATO';
    return 'OTRO';
  };

  const defaultCostCenterByOrigin = (): string => {
    if (contextDefaults?.centroCosto) return contextDefaults.centroCosto;
    const existingCC = entry.lineas.find((l) => l.centroCosto && l.centroCosto.trim() !== '')?.centroCosto;
    if (existingCC) return existingCC;
    const orig = (entry.origen || '').toUpperCase();
    if (orig.includes('VENTA')) return 'COMERCIAL_VENTAS';
    if (orig.includes('COMPRA') || orig === 'INVENTARIO') return 'OPERACIONES';
    if (orig.includes('PRODUCCION') || orig.includes('COSTEO')) return 'PLANTA_PRODUCTIVA';
    if (orig.includes('REMUNERACION') || orig.includes('RRHH')) return 'RECURSOS_HUMANOS';
    return 'ADMINISTRACION';
  };

  // Detectar auxiliar existente en líneas hermanas
  const siblingAuxLine = entry.lineas.find((l) => l.rutAuxiliar && l.rutAuxiliar.trim() !== '');
  const fallbackRut = contextDefaults?.rutAuxiliar || siblingAuxLine?.rutAuxiliar;
  const fallbackNombreAux = contextDefaults?.nombreAuxiliar || siblingAuxLine?.nombreAuxiliar;

  // Detectar proyecto existente en líneas hermanas o glosa
  const siblingProy =
    contextDefaults?.proyecto ||
    entry.lineas.find((l) => l.proyecto && l.proyecto.trim() !== '')?.proyecto ||
    entry.lineas.find((l) => l.centroCosto && /^(OP-|PRY-)/i.test(l.centroCosto))?.centroCosto ||
    (entry.concepto?.match(/\b(OP-\d+[A-Za-z0-9\-]*|PRY-[A-Za-z0-9\-]+)\b/i)?.[1]);

  const enrichedLines: AccountingEntryLine[] = entry.lineas.map((line) => {
    const code = (line.cuentaCodigo || '').trim();
    const name = (line.cuentaNombre || '').trim();
    const meta = findAccountMeta(code, name);

    const isBankAccount =
      Boolean(meta?.esConciliableBancaria) ||
      code === '1.1.01' ||
      code === '1.1.01.03' ||
      code.startsWith('1.1.02') ||
      code === '1.1.01.003' ||
      code === '2.1.01.003' ||
      /banco|cta\.?\s*cte|clearing|tarjeta de cr[eé]dito/i.test(name);

    const reqDoc =
      Boolean(meta?.requiereDocReferencia) ||
      code.startsWith('1.1.03') ||
      code.startsWith('1.1.04') ||
      code.startsWith('1.1.05') ||
      code.startsWith('1.1.08') ||
      code.startsWith('1.1.01.003') ||
      code.startsWith('1.1.01.004') ||
      code.startsWith('1.1.02.02') ||
      code.startsWith('2.1.01') ||
      code.startsWith('2.1.02') ||
      code.startsWith('2.1.03') ||
      code.startsWith('2.1.04') ||
      code.startsWith('2.1.05') ||
      code.startsWith('2.1.07') ||
      code.startsWith('2.1.08') ||
      code.startsWith('2.1.09') ||
      code.startsWith('2.1.10') ||
      code.startsWith('2.1.11') ||
      code.startsWith('2.1.12') ||
      code.startsWith('2.1.13') ||
      code.startsWith('4.1.01') ||
      code.startsWith('4.1.02');

    const reqAux =
      Boolean(meta?.requiereAuxiliarRut) ||
      code.startsWith('1.1.03') ||
      code.startsWith('1.1.06.001') ||
      code.startsWith('1.1.09') ||
      code.startsWith('1.1.01.004') ||
      code.startsWith('1.1.02.02') ||
      code.startsWith('1.2.01.005') ||
      code.startsWith('2.1.01') ||
      code.startsWith('2.1.02') ||
      code.startsWith('2.1.04.001') ||
      code.startsWith('2.1.05.002') ||
      code.startsWith('2.1.07') ||
      code.startsWith('2.1.08') ||
      code.startsWith('2.1.09') ||
      code.startsWith('2.1.10') ||
      code.startsWith('2.1.11') ||
      code.startsWith('2.1.12') ||
      code.startsWith('2.2.01') ||
      code.startsWith('6.1.02') ||
      code.startsWith('6.1.03.001') ||
      code.startsWith('6.1.04.001') ||
      code.startsWith('6.1.04.002') ||
      code.startsWith('6.1.04.003') ||
      code.startsWith('6.1.04.007') ||
      code.startsWith('6.1.04.008') ||
      code.startsWith('6.1.04.009');

    const reqCC =
      Boolean(meta?.requiereCentroCosto) ||
      code.startsWith('4.') ||
      code.startsWith('5.') ||
      code.startsWith('6.') ||
      code.startsWith('7.2.01.001') ||
      code.startsWith('1.1.05') ||
      code.startsWith('1.1.08') ||
      code.startsWith('1.2.01') ||
      code.startsWith('1.2.02') ||
      code.startsWith('1.2.03') ||
      code.startsWith('1.2.04') ||
      code.startsWith('1.2.05') ||
      code.startsWith('1.2.06') ||
      code.startsWith('1.2.07') ||
      code.startsWith('1.2.08');

    const reqProy =
      Boolean(meta?.requiereProyecto) ||
      code.startsWith('1.1.08.02') ||
      code.startsWith('1.2.08') ||
      code.startsWith('5.1.02') ||
      code.startsWith('5.1.03') ||
      code.startsWith('5.1.04') ||
      code.startsWith('5.1.05');

    const reqFx =
      Boolean(meta?.manejaMultimoneda) ||
      code === '1.1.01.03' ||
      code === '1.1.02.003' ||
      code === '1.1.03.02' ||
      code === '1.1.03.002' ||
      code === '2.1.01.02';

    const nextLine: AccountingEntryLine = { ...line };
    const lineAmount = Math.max(Number(nextLine.debe) || 0, Number(nextLine.haber) || 0);

    // 1. Documento de Referencia
    if (reqDoc) {
      if (!nextLine.documentoRef && docHeader) {
        nextLine.documentoRef = docHeader;
      }
      if (!nextLine.folioDocumentoRef && (extractedFolio || nextLine.documentoRef)) {
        nextLine.folioDocumentoRef = extractedFolio || nextLine.documentoRef;
      }
      if (!nextLine.tipoDocumentoRef) {
        nextLine.tipoDocumentoRef = defaultTipoDocByOrigin();
      }
      if (!nextLine.fechaDocumentoRef) {
        nextLine.fechaDocumentoRef = contextDefaults?.fechaDocumentoRef || entry.fecha;
      }
      if (!nextLine.fechaVencimientoRef && contextDefaults?.fechaVencimientoRef) {
        nextLine.fechaVencimientoRef = contextDefaults.fechaVencimientoRef;
      }
      if (nextLine.montoDocumentoRef === undefined && lineAmount > 0) {
        nextLine.montoDocumentoRef = contextDefaults?.montoDocumentoRef || lineAmount;
      }
      if (!nextLine.dteIdAsociado && contextDefaults?.dteIdAsociado) {
        nextLine.dteIdAsociado = contextDefaults.dteIdAsociado;
      }
    }

    // 2. Auxiliar RUT y Razón Social
    if (reqAux) {
      if (!nextLine.rutAuxiliar) {
        if (fallbackRut) {
          nextLine.rutAuxiliar = fallbackRut;
        } else if (/afp|previsional|previred/i.test(name)) {
          nextLine.rutAuxiliar = '96.919.050-8';
        } else if (/fonasa|isapre|salud/i.test(name)) {
          nextLine.rutAuxiliar = '61.603.000-0';
        } else if (/afc|cesant/i.test(name)) {
          nextLine.rutAuxiliar = '76.265.736-8';
        } else if (/mutual|sis/i.test(name)) {
          nextLine.rutAuxiliar = '70.285.100-9';
        } else if (/f29|tgr|tesorer|impuesto/i.test(name)) {
          nextLine.rutAuxiliar = '60.803.000-K';
        } else if (/sueldo|remuneraci|personal/i.test(name)) {
          nextLine.rutAuxiliar = 'NOMINA-RRHH';
        }
      }
      if (!nextLine.nombreAuxiliar) {
        if (fallbackNombreAux && (!nextLine.rutAuxiliar || nextLine.rutAuxiliar === fallbackRut)) {
          nextLine.nombreAuxiliar = fallbackNombreAux;
        } else {
          const parenMatch = name.match(/\(([^)]+)\)/);
          if (parenMatch && parenMatch[1]) {
            nextLine.nombreAuxiliar = parenMatch[1].trim();
          } else if (fallbackNombreAux) {
            nextLine.nombreAuxiliar = fallbackNombreAux;
          }
        }
      }
    }

    // 3. Centro de Costos
    if (reqCC && !nextLine.centroCosto) {
      nextLine.centroCosto = defaultCostCenterByOrigin();
    }

    // 4. Proyecto / Orden de Producción
    if (reqProy && !nextLine.proyecto && siblingProy) {
      nextLine.proyecto = siblingProy;
    }

    // 5. Conciliación Bancaria
    if (isBankAccount) {
      if (!nextLine.tipoDocumentoConciliacion) {
        const textHint = `${name} ${docHeader} ${entry.concepto || ''}`.toLowerCase();
        if (contextDefaults?.tipoDocumentoConciliacion) {
          nextLine.tipoDocumentoConciliacion = contextDefaults.tipoDocumentoConciliacion;
        } else if (textHint.includes('cheque') || textHint.includes('chq')) {
          nextLine.tipoDocumentoConciliacion = 'CHEQUE';
        } else if (textHint.includes('pac') || textHint.includes('cargo automático') || textHint.includes('comisión') || textHint.includes('mantención')) {
          nextLine.tipoDocumentoConciliacion = 'CARGO_AUTOMATICO';
        } else if (textHint.includes('depósito') || textHint.includes('deposito')) {
          nextLine.tipoDocumentoConciliacion = 'DEPOSITO';
        } else if (textHint.includes('tarjeta')) {
          nextLine.tipoDocumentoConciliacion = 'TARJETA_CORPORATIVA';
        } else {
          nextLine.tipoDocumentoConciliacion = 'TRANSFERENCIA';
        }
      }
      if (!nextLine.documentoConciliacion) {
        nextLine.documentoConciliacion =
          contextDefaults?.documentoConciliacion ||
          nextLine.documentoOperacion ||
          extractedFolio ||
          docHeader ||
          `TEF-${entry.fecha.replace(/-/g, '')}`;
      }
      if (!nextLine.fechaDocumentoRef) {
        nextLine.fechaDocumentoRef = contextDefaults?.fechaDocumentoRef || entry.fecha;
      }
      if (!nextLine.fechaVencimientoRef) {
        nextLine.fechaVencimientoRef = contextDefaults?.fechaVencimientoRef || nextLine.fechaDocumentoRef || entry.fecha;
      }
    }

    // 6. Multimoneda
    if (reqFx && !nextLine.monedaOriginal && contextDefaults?.monedaOriginal) {
      nextLine.monedaOriginal = contextDefaults.monedaOriginal;
      nextLine.montoMonedaOriginal = contextDefaults.montoMonedaOriginal;
      nextLine.tipoCambio = contextDefaults.tipoCambio;
    }

    return nextLine;
  });

  // 7. Trazabilidad Cruzada Banco <-> Líneas Auxiliares (soporta 1-a-1, 1-a-N facturas de 1 proveedor y M proveedores en 1 pago)
  const bankLineIndices: number[] = [];
  const auxLineIndices: number[] = [];

  enrichedLines.forEach((l, idx) => {
    const code = (l.cuentaCodigo || '').trim();
    const name = (l.cuentaNombre || '').trim();
    const meta = findAccountMeta(code, name);
    const isBank =
      Boolean(meta?.esConciliableBancaria) ||
      code === '1.1.01' ||
      code === '1.1.01.03' ||
      code.startsWith('1.1.02') ||
      code === '1.1.01.003' ||
      code === '2.1.01.003';
    const isAuxPayableReceivable =
      !isBank &&
      (Boolean(meta?.requiereAuxiliarRut) ||
        code.startsWith('1.1.03') ||
        code.startsWith('2.1.01') ||
        code.startsWith('2.1.02') ||
        code.startsWith('2.1.04') ||
        code.startsWith('2.1.05') ||
        code.startsWith('2.1.07') ||
        code.startsWith('2.1.08') ||
        code.startsWith('2.1.09') ||
        code.startsWith('2.1.10') ||
        code.startsWith('2.1.11') ||
        code.startsWith('2.1.12'));

    if (isBank) bankLineIndices.push(idx);
    if (isAuxPayableReceivable) auxLineIndices.push(idx);
  });

  if (bankLineIndices.length > 0 && auxLineIndices.length > 0) {
    const primaryBank = enrichedLines[bankLineIndices[0]];
    const opType = primaryBank.tipoDocumentoConciliacion || 'TRANSFERENCIA';
    const opNum = primaryBank.documentoConciliacion || primaryBank.documentoOperacion || extractedFolio;
    const opDate = primaryBank.fechaDocumentoRef || entry.fecha;
    const opDueDate = primaryBank.fechaVencimientoRef || opDate;

    // Propagar el instrumento bancario (TEF / Cheque + fechas) a todas las líneas auxiliares pagadas/cobradas
    auxLineIndices.forEach((aIdx) => {
      const auxLine = enrichedLines[aIdx];
      if (!auxLine.tipoDocumentoOperacion) auxLine.tipoDocumentoOperacion = opType;
      if (!auxLine.documentoOperacion && opNum) auxLine.documentoOperacion = opNum;
      if (!auxLine.fechaDocumentoOperacion && opDate) auxLine.fechaDocumentoOperacion = opDate;
    });

    // Consolidar referencia de los auxiliares y facturas hacia la(s) línea(s) de banco
    const distinctRuts = Array.from(
      new Set(auxLineIndices.map((i) => enrichedLines[i].rutAuxiliar).filter(Boolean))
    ) as string[];
    const distinctNames = Array.from(
      new Set(auxLineIndices.map((i) => enrichedLines[i].nombreAuxiliar).filter(Boolean))
    ) as string[];
    const distinctFolios = Array.from(
      new Set(
        auxLineIndices
          .map((i) => enrichedLines[i].folioDocumentoRef || enrichedLines[i].documentoRef)
          .filter(Boolean)
      )
    ) as string[];

    bankLineIndices.forEach((bIdx) => {
      const bLine = enrichedLines[bIdx];
      if (distinctRuts.length === 1) {
        if (!bLine.rutAuxiliar) bLine.rutAuxiliar = distinctRuts[0];
        if (!bLine.nombreAuxiliar && distinctNames[0]) bLine.nombreAuxiliar = distinctNames[0];
      } else if (distinctRuts.length > 1) {
        if (!bLine.rutAuxiliar) bLine.rutAuxiliar = `NOMINA-${distinctRuts.length}-RUTS`;
        if (!bLine.nombreAuxiliar) {
          bLine.nombreAuxiliar = `Varios Auxiliares (${distinctRuts.length} RUTs: ${distinctNames.slice(0, 3).join(', ')}${distinctNames.length > 3 ? '...' : ''})`;
        }
      }
      if (distinctFolios.length === 1 && !bLine.folioDocumentoRef) {
        bLine.folioDocumentoRef = distinctFolios[0];
      } else if (distinctFolios.length > 1 && !bLine.folioDocumentoRef) {
        bLine.folioDocumentoRef = distinctFolios.join(', ');
      }
      if (!bLine.documentoRef && distinctFolios.length > 0) {
        bLine.documentoRef =
          distinctFolios.length === 1
            ? enrichedLines[auxLineIndices[0]].documentoRef || `Doc. ${distinctFolios[0]} (Venc: ${opDueDate})`
            : `Pago Múltiple (${distinctFolios.length} docs: ${distinctFolios.join(', ')}) | Venc: ${opDueDate}`;
      }
    });
  }

  return {
    ...entry,
    lineas: enrichedLines,
  };
}

/**
 * Generate Accounting Entry for Payroll Centralization
 */
export function createPayrollCentralizationEntry(
  payrolls: EmployeePayroll[],
  periodo: string,
  fechaCustom?: string
): AccountingEntry {
  const totalSueldoBase = payrolls.reduce((sum, p) => sum + p.sueldoBase, 0);
  const totalGratificaciones = payrolls.reduce((sum, p) => sum + p.gratificacionMonto, 0);
  const totalHorasExtras = payrolls.reduce((sum, p) => sum + p.horasExtrasMonto, 0);
  const totalBonos = payrolls.reduce((sum, p) => sum + p.comisionesBonosImponibles, 0);
  const totalNoImponibles = payrolls.reduce((sum, p) => sum + p.totalHaberesNoImponibles, 0);

  const totalSis = payrolls.reduce((sum, p) => sum + p.sisEmpleadorMonto, 0);
  const totalMutual = payrolls.reduce((sum, p) => sum + p.mutualEmpleadorMonto, 0);
  const totalAfcEmpleador = payrolls.reduce((sum, p) => sum + p.afcEmpleadorMonto, 0);
  const totalLey21735 = payrolls.reduce((sum, p) => sum + (p.reformaPrevisionalLey21735Monto || 0), 0);
  const totalAportesPatronales = totalSis + totalMutual + totalAfcEmpleador;

  // Haberes / Cuentas de Pasivo
  const totalAfp = payrolls.reduce((sum, p) => sum + p.afpMonto, 0);
  const totalSalud = payrolls.reduce((sum, p) => sum + p.saludMonto, 0);
  const totalAfcTrabajador = payrolls.reduce((sum, p) => sum + p.afcTrabajadorMonto, 0);
  const totalImpuestoUnico = payrolls.reduce((sum, p) => sum + p.impuestoUnicoMonto, 0);
  const totalSueldosLiquidos = payrolls.reduce((sum, p) => sum + p.sueldoLiquido, 0);

  const fechaAsiento = fechaCustom || `${periodo}-28`;
  const docLibro = `Libro de Remuneraciones Periodo ${periodo}`;
  const folioRemun = `LREM-${periodo}`;
  const folioPrevired = `PRV-${periodo}`;

  const lineas: AccountingEntryLine[] = [
    // DEBE: Gastos de Personal (con Centro de Costos y Documento Laboral)
    { cuentaCodigo: '5.2.01', cuentaNombre: 'Sueldos y Remuneraciones Base', debe: totalSueldoBase, haber: 0, centroCosto: 'RECURSOS_HUMANOS', documentoRef: docLibro, tipoDocumentoRef: 'DOCUMENTO_LABORAL', folioDocumentoRef: folioRemun, fechaDocumentoRef: fechaAsiento },
    { cuentaCodigo: '5.2.02', cuentaNombre: 'Gratificaciones Legales Art. 50', debe: totalGratificaciones, haber: 0, centroCosto: 'RECURSOS_HUMANOS', documentoRef: docLibro, tipoDocumentoRef: 'DOCUMENTO_LABORAL', folioDocumentoRef: folioRemun, fechaDocumentoRef: fechaAsiento },
  ];

  if (totalHorasExtras + totalBonos > 0) {
    lineas.push({ cuentaCodigo: '5.2.03', cuentaNombre: 'Horas Extras y Bonos Imponibles', debe: totalHorasExtras + totalBonos, haber: 0, centroCosto: 'RECURSOS_HUMANOS', documentoRef: docLibro, tipoDocumentoRef: 'DOCUMENTO_LABORAL', folioDocumentoRef: folioRemun, fechaDocumentoRef: fechaAsiento });
  }
  if (totalNoImponibles > 0) {
    lineas.push({ cuentaCodigo: '5.2.05', cuentaNombre: 'Asignaciones No Imponibles (Colación/Mov.)', debe: totalNoImponibles, haber: 0, centroCosto: 'RECURSOS_HUMANOS', documentoRef: docLibro, tipoDocumentoRef: 'DOCUMENTO_LABORAL', folioDocumentoRef: folioRemun, fechaDocumentoRef: fechaAsiento });
  }
  if (totalAportesPatronales > 0) {
    lineas.push({ cuentaCodigo: '5.2.04', cuentaNombre: 'Aportes Patronales (SIS, Mutual, AFC Emp.)', debe: totalAportesPatronales, haber: 0, centroCosto: 'RECURSOS_HUMANOS', documentoRef: docLibro, tipoDocumentoRef: 'DOCUMENTO_LABORAL', folioDocumentoRef: folioRemun, fechaDocumentoRef: fechaAsiento });
  }
  if (totalLey21735 > 0) {
    lineas.push({ cuentaCodigo: '5.2.06', cuentaNombre: 'Aporte Previsional Patronal Ley 21.735 (1%)', debe: totalLey21735, haber: 0, centroCosto: 'RECURSOS_HUMANOS', documentoRef: docLibro, tipoDocumentoRef: 'DOCUMENTO_LABORAL', folioDocumentoRef: folioRemun, fechaDocumentoRef: fechaAsiento });
  }

  // HABER: Pasivos y Retenciones por Pagar (con Auxiliar Institucional y Documento de Referencia)
  lineas.push(
    { cuentaCodigo: '2.1.08', cuentaNombre: 'Instituciones Previsionales (AFP) por Pagar', debe: 0, haber: totalAfp, rutAuxiliar: '96.919.050-8', nombreAuxiliar: 'PreviRed / AFP', documentoRef: `Planilla PreviRed ${periodo}`, tipoDocumentoRef: 'DOCUMENTO_LABORAL', folioDocumentoRef: folioPrevired, fechaDocumentoRef: fechaAsiento },
    { cuentaCodigo: '2.1.09', cuentaNombre: 'Salud (Fonasa / Isapres) por Pagar', debe: 0, haber: totalSalud, rutAuxiliar: '61.603.000-0', nombreAuxiliar: 'FONASA / Isapres', documentoRef: `Planilla PreviRed ${periodo}`, tipoDocumentoRef: 'DOCUMENTO_LABORAL', folioDocumentoRef: folioPrevired, fechaDocumentoRef: fechaAsiento },
    { cuentaCodigo: '2.1.10', cuentaNombre: 'AFC Seguro de Cesantía por Pagar', debe: 0, haber: totalAfcTrabajador + totalAfcEmpleador, rutAuxiliar: '76.265.736-8', nombreAuxiliar: 'AFC Chile', documentoRef: `Planilla PreviRed ${periodo}`, tipoDocumentoRef: 'DOCUMENTO_LABORAL', folioDocumentoRef: folioPrevired, fechaDocumentoRef: fechaAsiento },
    { cuentaCodigo: '2.1.11', cuentaNombre: 'Mutual de Seguridad / SIS por Pagar', debe: 0, haber: totalMutual + totalSis, rutAuxiliar: '70.285.100-9', nombreAuxiliar: 'Mutual de Seguridad / SIS', documentoRef: `Planilla PreviRed ${periodo}`, tipoDocumentoRef: 'DOCUMENTO_LABORAL', folioDocumentoRef: folioPrevired, fechaDocumentoRef: fechaAsiento }
  );

  if (totalLey21735 > 0) {
    lineas.push({ cuentaCodigo: '2.1.12', cuentaNombre: 'Aporte Previsional Ley 21.735 por Pagar (PreviRed)', debe: 0, haber: totalLey21735, rutAuxiliar: '96.919.050-8', nombreAuxiliar: 'PreviRed / Fondo Previsional', documentoRef: `Planilla PreviRed ${periodo}`, tipoDocumentoRef: 'DOCUMENTO_LABORAL', folioDocumentoRef: folioPrevired, fechaDocumentoRef: fechaAsiento });
  }

  if (totalImpuestoUnico > 0) {
    lineas.push({ cuentaCodigo: '2.1.05', cuentaNombre: 'Impuesto Único 2da Categoría por Pagar (F29)', debe: 0, haber: totalImpuestoUnico, rutAuxiliar: '60.803.000-K', nombreAuxiliar: 'Tesorería General de la República (TGR)', documentoRef: `F29 Impuesto Único ${periodo}`, tipoDocumentoRef: 'TRIBUTARIO_TGR', folioDocumentoRef: `F29-${periodo}`, fechaDocumentoRef: fechaAsiento });
  }

  lineas.push({
    cuentaCodigo: '2.1.07',
    cuentaNombre: 'Sueldos Líquidos por Pagar',
    debe: 0,
    haber: totalSueldosLiquidos,
    rutAuxiliar: payrolls.length === 1 ? payrolls[0].rut : 'NOMINA-RRHH',
    nombreAuxiliar: payrolls.length === 1 ? payrolls[0].nombreCompleto : `Nómina Personal (${payrolls.length} colaboradores)`,
    documentoRef: docLibro,
    tipoDocumentoRef: 'DOCUMENTO_LABORAL',
    folioDocumentoRef: folioRemun,
    fechaDocumentoRef: fechaAsiento,
  });

  const totalDebe = lineas.reduce((s, l) => s + l.debe, 0);
  const totalHaber = lineas.reduce((s, l) => s + l.haber, 0);

  return enrichEntryWithChartAttributes({
    id: `entry-payroll-${Date.now()}`,
    fecha: fechaAsiento,
    concepto: `Centralización de Remuneraciones Mes de ${periodo} (${payrolls.length} colaboradores)`,
    documento: docLibro,
    lineas,
    totalDebe,
    totalHaber,
    balanceado: Math.abs(totalDebe - totalHaber) < 1,
    origen: 'REMUNERACIONES',
    creadoEn: new Date().toISOString(),
  });
}

/**
 * Generate Accounting Entry for Payroll Disbursement (Payment of Net Salaries via Bank)
 */
export function createPayrollDisbursementEntry(
  payrolls: EmployeePayroll[],
  periodo: string,
  bancoCuentaCodigo: string = '1.1.02.001',
  bancoNombre: string = 'Banco Santander',
  fechaCustom?: string
): AccountingEntry {
  const totalSueldosLiquidos = payrolls.reduce((sum, p) => sum + p.sueldoLiquido, 0);
  const fechaPago = fechaCustom || new Date().toISOString().split('T')[0];
  const folioTefNomina = `TEF-NOM-${periodo.replace(/-/g, '')}`;
  const folioLibro = `LREM-${periodo}`;
  const auxRut = payrolls.length === 1 ? payrolls[0].rut : 'NOMINA-RRHH';
  const auxNom = payrolls.length === 1 ? payrolls[0].nombreCompleto : `Nómina Personal (${payrolls.length} colaboradores)`;

  const lineas: AccountingEntryLine[] = [
    {
      cuentaCodigo: '2.1.07',
      cuentaNombre: 'Sueldos Líquidos por Pagar',
      debe: totalSueldosLiquidos,
      haber: 0,
      rutAuxiliar: auxRut,
      nombreAuxiliar: auxNom,
      documentoRef: `Libro de Remuneraciones Periodo ${periodo}`,
      tipoDocumentoRef: 'DOCUMENTO_LABORAL',
      folioDocumentoRef: folioLibro,
      fechaDocumentoRef: fechaPago,
      tipoDocumentoOperacion: 'TRANSFERENCIA',
      documentoOperacion: folioTefNomina,
      fechaDocumentoOperacion: fechaPago,
    },
    {
      cuentaCodigo: bancoCuentaCodigo,
      cuentaNombre: `${bancoNombre} (Dispersión Nómina ${payrolls.length} Colaboradores)`,
      debe: 0,
      haber: totalSueldosLiquidos,
      rutAuxiliar: auxRut,
      nombreAuxiliar: auxNom,
      tipoDocumentoConciliacion: 'TRANSFERENCIA',
      documentoConciliacion: folioTefNomina,
      documentoRef: `Nómina Transferencia ${periodo} (${folioLibro})`,
      folioDocumentoRef: folioLibro,
      fechaDocumentoRef: fechaPago,
      fechaVencimientoRef: fechaPago,
    },
  ];

  return enrichEntryWithChartAttributes({
    id: `entry-payroll-pay-${Date.now()}`,
    fecha: fechaPago,
    concepto: `Pago y Dispersión de Nómina Bancaria Mes de ${periodo} (${payrolls.length} colaboradores)`,
    documento: `Nómina Transferencia ${periodo} (${folioTefNomina})`,
    lineas,
    totalDebe: totalSueldosLiquidos,
    totalHaber: totalSueldosLiquidos,
    balanceado: true,
    origen: 'REMUNERACIONES',
    creadoEn: new Date().toISOString(),
  });
}

/**
 * Generate Accounting Entry for PreviRed & Social Laws Payment via Bank
 */
export function createPreviredPaymentEntry(
  payrolls: EmployeePayroll[],
  periodo: string,
  bancoCuentaCodigo: string = '1.1.02.001',
  bancoNombre: string = 'Banco Santander',
  fechaCustom?: string
): AccountingEntry {
  const totalAfp = payrolls.reduce((sum, p) => sum + p.afpMonto, 0);
  const totalSalud = payrolls.reduce((sum, p) => sum + p.saludMonto, 0);
  const totalAfc = payrolls.reduce((sum, p) => sum + (p.afcTrabajadorMonto + p.afcEmpleadorMonto), 0);
  const totalMutualSis = payrolls.reduce((sum, p) => sum + (p.mutualEmpleadorMonto + p.sisEmpleadorMonto), 0);
  const totalPreviRed = totalAfp + totalSalud + totalAfc + totalMutualSis;
  const fechaPago = fechaCustom || new Date().toISOString().split('T')[0];
  const folioPlanilla = `PRV-${periodo.replace(/-/g, '')}`;
  const folioTef = `TEF-PRV-${periodo.replace(/-/g, '')}`;

  const lineas: AccountingEntryLine[] = [];

  if (totalAfp > 0) {
    lineas.push({
      cuentaCodigo: '2.1.08',
      cuentaNombre: 'Instituciones Previsionales (AFP) por Pagar',
      debe: totalAfp,
      haber: 0,
      rutAuxiliar: '96.919.050-8',
      nombreAuxiliar: 'PreviRed / AFP',
      documentoRef: `Planilla PreviRed Folio ${folioPlanilla}`,
      tipoDocumentoRef: 'DOCUMENTO_LABORAL',
      folioDocumentoRef: folioPlanilla,
      fechaDocumentoRef: fechaPago,
      tipoDocumentoOperacion: 'TRANSFERENCIA',
      documentoOperacion: folioTef,
      fechaDocumentoOperacion: fechaPago,
    });
  }
  if (totalSalud > 0) {
    lineas.push({
      cuentaCodigo: '2.1.09',
      cuentaNombre: 'Salud (Fonasa / Isapres) por Pagar',
      debe: totalSalud,
      haber: 0,
      rutAuxiliar: '61.603.000-0',
      nombreAuxiliar: 'FONASA / Isapres',
      documentoRef: `Planilla PreviRed Folio ${folioPlanilla}`,
      tipoDocumentoRef: 'DOCUMENTO_LABORAL',
      folioDocumentoRef: folioPlanilla,
      fechaDocumentoRef: fechaPago,
      tipoDocumentoOperacion: 'TRANSFERENCIA',
      documentoOperacion: folioTef,
      fechaDocumentoOperacion: fechaPago,
    });
  }
  if (totalAfc > 0) {
    lineas.push({
      cuentaCodigo: '2.1.10',
      cuentaNombre: 'AFC Seguro de Cesantía por Pagar',
      debe: totalAfc,
      haber: 0,
      rutAuxiliar: '76.265.736-8',
      nombreAuxiliar: 'AFC Chile',
      documentoRef: `Planilla PreviRed Folio ${folioPlanilla}`,
      tipoDocumentoRef: 'DOCUMENTO_LABORAL',
      folioDocumentoRef: folioPlanilla,
      fechaDocumentoRef: fechaPago,
      tipoDocumentoOperacion: 'TRANSFERENCIA',
      documentoOperacion: folioTef,
      fechaDocumentoOperacion: fechaPago,
    });
  }
  if (totalMutualSis > 0) {
    lineas.push({
      cuentaCodigo: '2.1.11',
      cuentaNombre: 'Mutual de Seguridad / SIS por Pagar',
      debe: totalMutualSis,
      haber: 0,
      rutAuxiliar: '70.285.100-9',
      nombreAuxiliar: 'Mutual de Seguridad / SIS',
      documentoRef: `Planilla PreviRed Folio ${folioPlanilla}`,
      tipoDocumentoRef: 'DOCUMENTO_LABORAL',
      folioDocumentoRef: folioPlanilla,
      fechaDocumentoRef: fechaPago,
      tipoDocumentoOperacion: 'TRANSFERENCIA',
      documentoOperacion: folioTef,
      fechaDocumentoOperacion: fechaPago,
    });
  }

  lineas.push({
    cuentaCodigo: bancoCuentaCodigo,
    cuentaNombre: `${bancoNombre} (Pago Electrónico PreviRed ${periodo})`,
    debe: 0,
    haber: totalPreviRed,
    rutAuxiliar: '96.919.050-8',
    nombreAuxiliar: 'PreviRed (AFP, Salud, AFC, Mutual)',
    tipoDocumentoConciliacion: 'TRANSFERENCIA',
    documentoConciliacion: folioTef,
    documentoRef: `Planilla PreviRed Folio ${folioPlanilla}`,
    folioDocumentoRef: folioPlanilla,
    fechaDocumentoRef: fechaPago,
    fechaVencimientoRef: fechaPago,
  });

  return enrichEntryWithChartAttributes({
    id: `entry-previred-pay-${Date.now()}`,
    fecha: fechaPago,
    concepto: `Pago Leyes Sociales e Imposiciones PreviRed Período ${periodo}`,
    documento: `Planilla PreviRed Folio ${folioPlanilla} (${folioTef})`,
    lineas,
    totalDebe: totalPreviRed,
    totalHaber: totalPreviRed,
    balanceado: true,
    origen: 'REMUNERACIONES',
    creadoEn: new Date().toISOString(),
  });
}

/**
 * Generate Accounting Entry for Sales Documents (DTE 33, 34, 39, 41, 56, 61, 110)
 */
export function createSalesDteEntry(dte: DteDocument): AccountingEntry {
  if (!dte) {
    return {
      id: `entry-dte-sale-default-${Date.now()}`,
      fecha: new Date().toISOString().split('T')[0],
      concepto: 'Venta Documento Tributario',
      documento: 'DTE 33',
      lineas: [],
      totalDebe: 0,
      totalHaber: 0,
      balanceado: true,
      origen: 'RCV_VENTA',
      creadoEn: new Date().toISOString(),
    };
  }

  const docTipoDesc =
    dte.tipoDte === '34' ? 'Factura No Afecta o Exenta (DTE 34)' :
    dte.tipoDte === '61' ? 'Nota de Crédito (DTE 61)' :
    dte.tipoDte === '56' ? 'Nota de Débito (DTE 56)' :
    dte.tipoDte === '39' ? 'Boleta Electrónica (DTE 39)' :
    dte.tipoDte === '41' ? 'Boleta Exenta (DTE 41)' :
    dte.tipoDte === '110' ? 'Factura de Exportación (DTE 110)' :
    `Factura Electrónica (DTE ${dte.tipoDte})`;

  const docLabel = `${docTipoDesc} N° ${dte.folio}`;
  const folioStr = String(dte.folio);
  const ccDefault = dte.centroCostoCodigo || dte.centroCostoNombre || 'COMERCIAL_VENTAS';
  const fechaVenc = dte.fechaVencimiento || dte.fechaEmision;

  const baseDocProps = {
    rutAuxiliar: dte.rutContraparte,
    nombreAuxiliar: dte.razonSocialContraparte,
    documentoRef: docLabel,
    tipoDocumentoRef: 'DTE_SII',
    folioDocumentoRef: folioStr,
    fechaDocumentoRef: dte.fechaEmision,
    fechaVencimientoRef: fechaVenc,
    dteIdAsociado: dte.id,
  };

  const lineas: AccountingEntryLine[] = [];

  // CASO 1: NOTA DE CRÉDITO DE VENTA (DTE 61)
  if (dte.tipoDte === '61') {
    if (dte.montoNeto > 0) {
      lineas.push({
        cuentaCodigo: '4.1.99',
        cuentaNombre: 'Devoluciones y Descuentos en Ventas (Art. 21 DL 825)',
        debe: dte.montoNeto,
        haber: 0,
        centroCosto: ccDefault,
        ...baseDocProps,
      });
    }
    if (dte.montoIva > 0) {
      lineas.push({
        cuentaCodigo: '2.1.03',
        cuentaNombre: 'IVA Débito Fiscal (Rebaja por NC Emitida)',
        debe: dte.montoIva,
        haber: 0,
        ...baseDocProps,
      });
    }
    if (dte.montoExento > 0) {
      lineas.push({
        cuentaCodigo: '4.1.02',
        cuentaNombre: 'Rebaja Ventas Exentas por NC',
        debe: dte.montoExento,
        haber: 0,
        centroCosto: ccDefault,
        ...baseDocProps,
      });
    }
    lineas.push({
      cuentaCodigo: '1.1.03',
      cuentaNombre: `Clientes Nacionales (${dte.razonSocialContraparte})`,
      debe: 0,
      haber: dte.montoTotal,
      centroCosto: ccDefault,
      montoDocumentoRef: dte.montoTotal,
      ...baseDocProps,
    });
  }
  // CASO 2: FACTURA DE EXPORTACIÓN (DTE 110)
  else if (dte.tipoDte === '110') {
    lineas.push({
      cuentaCodigo: '1.1.04',
      cuentaNombre: `Clientes del Exterior / Exportación (${dte.razonSocialContraparte})`,
      debe: dte.montoTotal,
      haber: 0,
      centroCosto: ccDefault,
      montoDocumentoRef: dte.montoTotal,
      ...baseDocProps,
    });

    if (dte.items && dte.items.length > 0) {
      dte.items.forEach(it => {
        lineas.push({
          cuentaCodigo: it.cuentaCodigo || '4.1.03',
          cuentaNombre: it.cuentaNombre || `Exportación - ${it.nombre}`,
          debe: 0,
          haber: it.montoTotal,
          centroCosto: it.centroCostoCodigo || it.centroCostoNombre || ccDefault,
          ...baseDocProps,
        });
      });
    } else {
      lineas.push({
        cuentaCodigo: '4.1.03',
        cuentaNombre: 'Ingresos por Exportaciones (Art. 12 Letra D DL 825)',
        debe: 0,
        haber: dte.montoTotal,
        centroCosto: ccDefault,
        ...baseDocProps,
      });
    }
  }
  // CASO 3: BOLETA ELECTRÓNICA AFECTA (DTE 39) O BOLETA EXENTA (DTE 41)
  else if (dte.tipoDte === '39' || dte.tipoDte === '41') {
    lineas.push({
      cuentaCodigo: '1.1.03',
      cuentaNombre: `Clientes Boletas / Venta Menor (${dte.razonSocialContraparte || 'Consumidor Final'})`,
      debe: dte.montoTotal,
      haber: 0,
      centroCosto: ccDefault,
      montoDocumentoRef: dte.montoTotal,
      ...baseDocProps,
    });
    if (dte.tipoDte === '41' || (dte.montoExento > 0 && dte.montoIva === 0)) {
      if (dte.items && dte.items.length > 0) {
        dte.items.forEach(it => {
          lineas.push({
            cuentaCodigo: it.cuentaCodigo || '4.1.02',
            cuentaNombre: it.cuentaNombre || `Ingresos Boleta Exenta - ${it.nombre}`,
            debe: 0,
            haber: it.montoTotal,
            centroCosto: it.centroCostoCodigo || it.centroCostoNombre || ccDefault,
            ...baseDocProps,
          });
        });
      } else {
        lineas.push({
          cuentaCodigo: '4.1.02',
          cuentaNombre: 'Ingresos por Ventas Exentas con Boleta',
          debe: 0,
          haber: dte.montoTotal,
          centroCosto: ccDefault,
          ...baseDocProps,
        });
      }
    } else {
      if (dte.items && dte.items.length > 0) {
        dte.items.forEach(it => {
          const netoCalc = it.esExento ? 0 : Math.round(it.montoTotal / 1.19);
          const exentoCalc = it.esExento ? it.montoTotal : 0;
          const montoIngreso = (it.montoTotal && !it.precioUnitario) ? it.montoTotal : (netoCalc > 0 ? netoCalc : (exentoCalc > 0 ? exentoCalc : it.montoTotal));

          lineas.push({
            cuentaCodigo: it.cuentaCodigo || (it.esExento ? '4.1.02' : '4.1.01'),
            cuentaNombre: it.cuentaNombre || `Ingresos Boleta - ${it.nombre}`,
            debe: 0,
            haber: montoIngreso,
            centroCosto: it.centroCostoCodigo || it.centroCostoNombre || ccDefault,
            ...baseDocProps,
          });
        });
      } else if (dte.montoNeto > 0) {
        lineas.push({
          cuentaCodigo: '4.1.01',
          cuentaNombre: 'Ingresos por Ventas con Boleta Electrónica',
          debe: 0,
          haber: dte.montoNeto,
          centroCosto: ccDefault,
          ...baseDocProps,
        });
      }
      if (dte.montoIva > 0) {
        lineas.push({
          cuentaCodigo: '2.1.03',
          cuentaNombre: 'IVA Débito Fiscal Boletas',
          debe: 0,
          haber: dte.montoIva,
          ...baseDocProps,
        });
      }
    }
  }
  // CASO 4: FACTURA NO AFECTA O EXENTA (DTE 34)
  else if (dte.tipoDte === '34' || (dte.montoExento > 0 && dte.montoIva === 0)) {
    lineas.push({
      cuentaCodigo: '1.1.03',
      cuentaNombre: `Clientes Nacionales (${dte.razonSocialContraparte})`,
      debe: dte.montoTotal,
      haber: 0,
      centroCosto: ccDefault,
      montoDocumentoRef: dte.montoTotal,
      ...baseDocProps,
    });

    if (dte.items && dte.items.length > 0) {
      dte.items.forEach(it => {
        lineas.push({
          cuentaCodigo: it.cuentaCodigo || '4.1.02',
          cuentaNombre: it.cuentaNombre || `Ingresos Servicios Exentos - ${it.nombre}`,
          debe: 0,
          haber: it.montoTotal,
          centroCosto: it.centroCostoCodigo || it.centroCostoNombre || ccDefault,
          ...baseDocProps,
        });
      });
    } else {
      lineas.push({
        cuentaCodigo: '4.1.02',
        cuentaNombre: 'Ingresos por Servicios Exentos y No Afectos a IVA',
        debe: 0,
        haber: dte.montoExento || dte.montoTotal,
        centroCosto: ccDefault,
        ...baseDocProps,
      });
    }
  }
  // CASO 5: FACTURA ELECTRÓNICA (DTE 33) O NOTA DE DÉBITO (DTE 56)
  else {
    lineas.push({
      cuentaCodigo: '1.1.03',
      cuentaNombre: `Clientes Nacionales (${dte.razonSocialContraparte})`,
      debe: dte.montoTotal,
      haber: 0,
      centroCosto: ccDefault,
      montoDocumentoRef: dte.montoTotal,
      ...baseDocProps,
    });

    // Desglose por Ítems de la Factura Electrónica vinculados a Centro de Costo
    if (dte.items && dte.items.length > 0) {
      dte.items.forEach(it => {
        const ctaCod = it.cuentaCodigo || (dte.tipoDte === '56' ? '4.2.01' : it.esExento ? '4.1.02' : '4.1.01');
        const ctaNom = it.cuentaNombre || (it.esExento ? `Ingresos Servicios Exentos - ${it.nombre}` : `Ingresos por Ventas - ${it.nombre}`);
        const netoCalc = it.esExento ? 0 : Math.round(it.montoTotal / (dte.tipoDte === '34' ? 1 : 1.19));
        const exentoCalc = it.esExento ? it.montoTotal : 0;
        const montoIngreso = (it.montoTotal && !it.precioUnitario) ? it.montoTotal : (netoCalc > 0 ? netoCalc : (exentoCalc > 0 ? exentoCalc : it.montoTotal));

        lineas.push({
          cuentaCodigo: ctaCod,
          cuentaNombre: ctaNom,
          debe: 0,
          haber: montoIngreso,
          centroCosto: it.centroCostoCodigo || it.centroCostoNombre || ccDefault,
          ...baseDocProps,
        });
      });
    } else if (dte.partidasDesglosadas && dte.partidasDesglosadas.length > 0) {
      dte.partidasDesglosadas.forEach(p => {
        lineas.push({
          cuentaCodigo: p.cuentaCodigo || (dte.tipoDte === '56' ? '4.2.01' : '4.1.01'),
          cuentaNombre: p.cuentaNombre || `Venta - ${p.concepto}`,
          debe: 0,
          haber: (p.montoNeto || 0) + (p.montoExento || 0),
          centroCosto: p.centroCostoCodigo || p.centroCostoNombre || ccDefault,
          ...baseDocProps,
        });
      });
    } else {
      if (dte.montoNeto > 0) {
        lineas.push({
          cuentaCodigo: dte.tipoDte === '56' ? '4.2.01' : '4.1.01',
          cuentaNombre: dte.tipoDte === '56' ? 'Otros Ingresos / Recargos ND Emitida' : 'Ingresos por Ventas Afectas a IVA',
          debe: 0,
          haber: dte.montoNeto,
          centroCosto: ccDefault,
          ...baseDocProps,
        });
      }

      if (dte.montoExento > 0) {
        lineas.push({
          cuentaCodigo: '4.1.02',
          cuentaNombre: 'Ingresos por Servicios Exentos',
          debe: 0,
          haber: dte.montoExento,
          centroCosto: ccDefault,
          ...baseDocProps,
        });
      }
    }

    if (dte.montoIva > 0) {
      lineas.push({
        cuentaCodigo: '2.1.03',
        cuentaNombre: 'IVA Débito Fiscal',
        debe: 0,
        haber: dte.montoIva,
        ...baseDocProps,
      });
    }
  }

  const totalDebe = lineas.reduce((s, l) => s + l.debe, 0);
  const totalHaber = lineas.reduce((s, l) => s + l.haber, 0);

  return enrichEntryWithChartAttributes({
    id: `entry-dte-sale-${dte.id}`,
    fecha: dte.fechaEmision,
    concepto: `Venta ${docTipoDesc} Folio ${dte.folio} - ${dte.razonSocialContraparte}`,
    documento: docLabel,
    lineas,
    totalDebe,
    totalHaber,
    balanceado: totalDebe === totalHaber,
    origen: 'RCV_VENTA',
    creadoEn: new Date().toISOString(),
  }, undefined, baseDocProps);
}

/**
 * Generate Accounting Entry for Purchase Invoice DTE 33 / DTE 61
 */
export function createPurchaseDteEntry(dte: DteDocument, isCompanyExento: boolean = false): AccountingEntry {
  if (!dte) {
    return {
      id: `entry-dte-purch-default-${Date.now()}`,
      fecha: new Date().toISOString().split('T')[0],
      concepto: 'Compra Documento Tributario',
      documento: 'DTE 33',
      lineas: [],
      totalDebe: 0,
      totalHaber: 0,
      balanceado: true,
      origen: 'RCV_COMPRA',
      creadoEn: new Date().toISOString(),
    };
  }

  const docDesc = dte.tipoDte === '61' ? 'Nota de Crédito Proveedor (DTE 61)' : `Factura Proveedor (DTE ${dte.tipoDte})`;
  const docLabel = `${docDesc} N° ${dte.folio}`;
  const folioStr = String(dte.folio);
  const ccDefault = dte.centroCostoCodigo || dte.centroCostoNombre || 'OPERACIONES';
  const fechaVenc = dte.fechaVencimiento || dte.fechaEmision;

  // Si la empresa es exenta de IVA o el documento tiene marca de no recuperable,
  // el IVA es 100% IVA No Recuperable (Costo/Gasto Art. 23 DL 825) y jamás IVA Crédito Fiscal.
  const isExentoBuyer = Boolean(isCompanyExento || dte.ivaNoRecuperable || (dte.montoIvaNoRecuperable && dte.montoIvaNoRecuperable > 0));
  const totalIva = dte.montoIva || ((dte.montoIvaRecuperable || 0) + (dte.montoIvaNoRecuperable || 0));
  const ivaRecuperable = isExentoBuyer ? 0 : (dte.montoIvaRecuperable ?? totalIva);
  const ivaNoRecuperable = isExentoBuyer
    ? (dte.montoIvaNoRecuperable || totalIva)
    : (dte.montoIvaNoRecuperable || 0);

  const baseDocProps = {
    rutAuxiliar: dte.rutContraparte,
    nombreAuxiliar: dte.razonSocialContraparte,
    documentoRef: docLabel,
    tipoDocumentoRef: 'DTE_SII',
    folioDocumentoRef: folioStr,
    fechaDocumentoRef: dte.fechaEmision,
    fechaVencimientoRef: fechaVenc,
    dteIdAsociado: dte.id,
  };

  const lineas: AccountingEntryLine[] = [];

  // CASO NOTA DE CRÉDITO DE COMPRA (DTE 61 de Proveedor)
  if (dte.tipoDte === '61') {
    lineas.push({
      cuentaCodigo: '2.1.01',
      cuentaNombre: `Proveedores Nacionales (${dte.razonSocialContraparte})`,
      debe: dte.montoTotal,
      haber: 0,
      centroCosto: ccDefault,
      montoDocumentoRef: dte.montoTotal,
      ...baseDocProps,
    });

    if (dte.montoNeto > 0) {
      lineas.push({
        cuentaCodigo: '5.1.01',
        cuentaNombre: 'Costo de Ventas / Rebaja Compras por NC',
        debe: 0,
        haber: dte.montoNeto,
        centroCosto: ccDefault,
        ...baseDocProps,
      });
    }

    if (ivaRecuperable > 0) {
      lineas.push({
        cuentaCodigo: '1.1.05',
        cuentaNombre: 'IVA Crédito Fiscal (Rebaja por NC Recibida)',
        debe: 0,
        haber: ivaRecuperable,
        ...baseDocProps,
      });
    }

    if (ivaNoRecuperable > 0) {
      lineas.push({
        cuentaCodigo: '5.2.11',
        cuentaNombre: 'IVA No Recuperable (Rebaja Costo/Gasto por NC Recibida Art. 23 DL 825)',
        debe: 0,
        haber: ivaNoRecuperable,
        centroCosto: ccDefault,
        ...baseDocProps,
      });
    }

    if (dte.montoExento > 0) {
      lineas.push({
        cuentaCodigo: '5.2.10',
        cuentaNombre: 'Gastos Exentos / Rebaja por NC',
        debe: 0,
        haber: dte.montoExento,
        centroCosto: ccDefault,
        ...baseDocProps,
      });
    }
  } else {
    // FACTURA O NOTA DE DÉBITO DE COMPRA
    // Desglose por Ítems o Partidas de la Factura Electrónica vinculados a Centro de Costo
    if (dte.items && dte.items.length > 0) {
      dte.items.forEach(it => {
        const ctaCod = it.cuentaCodigo || dte.cuentaCodigoAsignada || '5.1.01';
        const ctaNom = it.cuentaNombre || dte.cuentaNombreAsignada || `Gasto / Insumo - ${it.nombre}`;
        const netoCalc = it.esExento ? 0 : Math.round(it.montoTotal / (dte.tipoDte === '34' ? 1 : 1.19));
        const exentoCalc = it.esExento ? it.montoTotal : 0;
        const montoGasto = (it.montoTotal && !it.precioUnitario) ? it.montoTotal : (netoCalc > 0 ? netoCalc : (exentoCalc > 0 ? exentoCalc : it.montoTotal));

        lineas.push({
          cuentaCodigo: ctaCod,
          cuentaNombre: ctaNom,
          debe: montoGasto,
          haber: 0,
          centroCosto: it.centroCostoCodigo || it.centroCostoNombre || ccDefault,
          ...baseDocProps,
        });
      });
    } else if (dte.partidasDesglosadas && dte.partidasDesglosadas.length > 0) {
      dte.partidasDesglosadas.forEach(p => {
        lineas.push({
          cuentaCodigo: p.cuentaCodigo || '5.1.01',
          cuentaNombre: p.cuentaNombre || `Compra - ${p.concepto}`,
          debe: (p.montoNeto || 0) + (p.montoExento || 0),
          haber: 0,
          centroCosto: p.centroCostoCodigo || p.centroCostoNombre || ccDefault,
          ...baseDocProps,
        });
      });
    } else {
      if (dte.montoExento > 0) {
        lineas.push({
          cuentaCodigo: '5.2.10',
          cuentaNombre: 'Gastos Exentos / Otros Servicios',
          debe: dte.montoExento,
          haber: 0,
          centroCosto: ccDefault,
          ...baseDocProps,
        });
      }

      if (dte.montoNeto > 0) {
        lineas.push({
          cuentaCodigo: dte.cuentaCodigoAsignada || '5.1.01',
          cuentaNombre: dte.cuentaNombreAsignada || 'Costo de Ventas / Gastos Operacionales',
          debe: dte.montoNeto,
          haber: 0,
          centroCosto: ccDefault,
          ...baseDocProps,
        });
      }
    }

    if (ivaRecuperable > 0) {
      lineas.push({
        cuentaCodigo: '1.1.05',
        cuentaNombre: 'IVA Crédito Fiscal',
        debe: ivaRecuperable,
        haber: 0,
        ...baseDocProps,
      });
    }

    if (ivaNoRecuperable > 0) {
      lineas.push({
        cuentaCodigo: '5.2.11',
        cuentaNombre: 'IVA No Recuperable (Costo / Gasto Operacional Art. 23 DL 825)',
        debe: ivaNoRecuperable,
        haber: 0,
        centroCosto: ccDefault,
        ...baseDocProps,
      });
    }

    lineas.push({
      cuentaCodigo: '2.1.01',
      cuentaNombre: `Proveedores Nacionales (${dte.razonSocialContraparte})`,
      debe: 0,
      haber: dte.montoTotal,
      centroCosto: ccDefault,
      montoDocumentoRef: dte.montoTotal,
      ...baseDocProps,
    });
  }

  const totalDebe = lineas.reduce((s, l) => s + l.debe, 0);
  const totalHaber = lineas.reduce((s, l) => s + l.haber, 0);

  return enrichEntryWithChartAttributes({
    id: `entry-dte-purch-${dte.id}`,
    fecha: dte.fechaEmision,
    concepto: `Compra ${docDesc} Folio ${dte.folio} - ${dte.razonSocialContraparte}`,
    documento: docLabel,
    lineas,
    totalDebe,
    totalHaber,
    balanceado: totalDebe === totalHaber,
    origen: 'RCV_COMPRA',
    creadoEn: new Date().toISOString(),
  }, undefined, baseDocProps);
}

/**
 * Generate Accounting Entry for Fee Receipt (Boleta de Honorarios)
 */
export function createHonorariosEntry(bhe: DteDocument): AccountingEntry {
  if (!bhe) {
    return {
      id: `entry-bhe-default-${Date.now()}`,
      fecha: new Date().toISOString().split('T')[0],
      concepto: 'Boleta de Honorarios',
      documento: 'BHE N° 0',
      lineas: [],
      totalDebe: 0,
      totalHaber: 0,
      balanceado: true,
      origen: 'HONORARIOS',
      creadoEn: new Date().toISOString(),
    };
  }

  const retencion = bhe.retencionMonto || Math.round((bhe.montoTotal || 0) * (bhe.retencionTasa || 0.145));
  const liquidoPorPagar = (bhe.montoTotal || 0) - retencion;
  const docLabel = `BHE N° ${bhe.folio}`;
  const folioStr = String(bhe.folio);
  const ccDefault = bhe.centroCostoCodigo || bhe.centroCostoNombre || 'ADMINISTRACION';
  const fechaVenc = bhe.fechaVencimiento || bhe.fechaEmision;

  const baseBheProps = {
    rutAuxiliar: bhe.rutContraparte,
    nombreAuxiliar: bhe.razonSocialContraparte,
    documentoRef: docLabel,
    tipoDocumentoRef: 'BOLETA_HONORARIOS',
    folioDocumentoRef: folioStr,
    fechaDocumentoRef: bhe.fechaEmision,
    fechaVencimientoRef: fechaVenc,
    dteIdAsociado: bhe.id,
  };

  const lineas: AccountingEntryLine[] = [
    {
      cuentaCodigo: '5.2.06',
      cuentaNombre: 'Gastos de Honorarios Profesionales',
      debe: bhe.montoTotal || 0,
      haber: 0,
      centroCosto: ccDefault,
      ...baseBheProps,
    },
    {
      cuentaCodigo: '2.1.04',
      cuentaNombre: 'Retención Honorarios 2da Categoría por Pagar (F29)',
      debe: 0,
      haber: retencion,
      ...baseBheProps,
    },
    {
      cuentaCodigo: '2.1.02',
      cuentaNombre: `Honorarios por Pagar (${bhe.razonSocialContraparte || 'Honorarios'})`,
      debe: 0,
      haber: liquidoPorPagar,
      centroCosto: ccDefault,
      montoDocumentoRef: liquidoPorPagar,
      ...baseBheProps,
    },
  ];

  const totalDebe = lineas.reduce((s, l) => s + l.debe, 0);
  const totalHaber = lineas.reduce((s, l) => s + l.haber, 0);

  return enrichEntryWithChartAttributes({
    id: `entry-bhe-${bhe.id}`,
    fecha: bhe.fechaEmision,
    concepto: `Boleta de Honorarios N° ${bhe.folio} - ${bhe.razonSocialContraparte} (${((bhe.retencionTasa || 0.145) * 100).toFixed(2)}% Retención)`,
    documento: docLabel,
    lineas,
    totalDebe,
    totalHaber,
    balanceado: totalDebe === totalHaber,
    origen: 'HONORARIOS',
    creadoEn: new Date().toISOString(),
  }, undefined, baseBheProps);
}

/**
 * Generate Accounting Entry for Formulario 29 Declaration and Payment
 */
export function createF29PaymentEntry(
  f29OrPeriodo: F29Declaration | string,
  montoAPagar?: number,
  bancoCuentaCodigo: string = '1.1.02.001',
  bancoNombre: string = 'Banco Santander',
  fechaCustom?: string
): AccountingEntry {
  if (typeof f29OrPeriodo === 'string') {
    return createF29TgrPaymentEntry(f29OrPeriodo, montoAPagar || 0, bancoCuentaCodigo, bancoNombre, fechaCustom);
  }
  const f29 = f29OrPeriodo;
  const fechaPago = f29.fechaPago || `${f29.periodo}-20`;
  const folioTgr = String(f29.folioTgr || `F29-${f29.periodo.replace(/-/g, '')}`);
  const docLabel = `F29 Periodo ${f29.periodo} (Folio TGR ${folioTgr})`;
  const folioTef = `TEF-TGR-${folioTgr}`;

  const baseF29Props = {
    rutAuxiliar: '60.803.000-K',
    nombreAuxiliar: 'Tesorería General de la República (TGR)',
    documentoRef: docLabel,
    tipoDocumentoRef: 'TRIBUTARIO_TGR',
    folioDocumentoRef: folioTgr,
    fechaDocumentoRef: fechaPago,
    fechaVencimientoRef: fechaPago,
  };

  const lineas: AccountingEntryLine[] = [];

  // Saldar IVA Débito Fiscal
  if (f29.debitoFiscalIva > 0) {
    lineas.push({
      cuentaCodigo: '2.1.03',
      cuentaNombre: 'IVA Débito Fiscal',
      debe: f29.debitoFiscalIva,
      haber: 0,
      ...baseF29Props,
    });
  }

  // Saldar IVA Crédito Fiscal
  if (f29.creditoFiscalIva > 0) {
    lineas.push({
      cuentaCodigo: '1.1.05',
      cuentaNombre: 'IVA Crédito Fiscal',
      debe: 0,
      haber: Math.min(f29.creditoFiscalIva, f29.debitoFiscalIva),
      ...baseF29Props,
    });
  }

  // Si hay nuevo remanente
  if (f29.nuevoRemanenteCredito > 0) {
    lineas.push({
      cuentaCodigo: '1.1.06',
      cuentaNombre: 'Remanente de Crédito Fiscal Mes Siguiente',
      debe: f29.nuevoRemanenteCredito,
      haber: 0,
      ...baseF29Props,
    });
  }

  // PPM
  if (f29.montoPpm > 0) {
    lineas.push({
      cuentaCodigo: '1.1.07',
      cuentaNombre: 'PPM Pagos Provisorios Mensuales por Recuperar',
      debe: f29.montoPpm,
      haber: 0,
      ...baseF29Props,
    });
  }

  // Retenciones 2da Cat
  if (f29.retencionHonorariosSegundaCat > 0) {
    lineas.push({
      cuentaCodigo: '2.1.04',
      cuentaNombre: 'Retención Honorarios 2da Categoría por Pagar (F29)',
      debe: f29.retencionHonorariosSegundaCat,
      haber: 0,
      ...baseF29Props,
    });
  }

  // Retenciones Impuesto Único Sueldos
  if (f29.retencionImpuestoUnicoSueldos > 0) {
    lineas.push({
      cuentaCodigo: '2.1.05',
      cuentaNombre: 'Impuesto Único 2da Categoría por Pagar (F29)',
      debe: f29.retencionImpuestoUnicoSueldos,
      haber: 0,
      ...baseF29Props,
    });
  }

  // Pago TGR Banco
  lineas.push({
    cuentaCodigo: '1.1.01',
    cuentaNombre: 'Banco Santander (Pago TGR Folio ' + folioTgr + ')',
    debe: 0,
    haber: f29.totalAPagar,
    ...baseF29Props,
    tipoDocumentoConciliacion: 'TRANSFERENCIA',
    documentoConciliacion: folioTef,
  });

  const totalDebe = lineas.reduce((s, l) => s + l.debe, 0);
  const totalHaber = lineas.reduce((s, l) => s + l.haber, 0);

  return enrichEntryWithChartAttributes({
    id: `entry-f29-${f29.id}`,
    fecha: fechaPago,
    concepto: `Declaración y Pago Formulario 29 Periodo ${f29.periodo} en Tesorería General de la República`,
    documento: docLabel,
    lineas,
    totalDebe,
    totalHaber,
    balanceado: Math.abs(totalDebe - totalHaber) < 1,
    origen: 'F29_TRIBUTARIO',
    creadoEn: new Date().toISOString(),
  }, undefined, baseF29Props);
}

/**
 * Generate Accounting Entry for Lease / IFRS 16
 */
export function createLeaseEntry(contract: any, indicators: ChileIndicators = DEFAULT_INDICATORS): AccountingEntry {
  const moneda = contract.moneda || contract.montoMensualMoneda || 'CLP';
  const canonMonto = contract.montoCanonMensual || contract.montoMensualValor || contract.montoMensualClp || 0;
  const canonCLP = moneda === 'UF' ? Math.round(canonMonto * indicators.uf) : canonMonto;
  const nombreBien = contract.nombreBien || contract.inmuebleDescripcion || 'Inmueble Arrendado';
  const arrendadorNombre = contract.arrendadorNombre || 'Arrendador';
  const arrendadorRut = contract.arrendadorRut || '76.440.110-2';
  const codigoContrato = String(contract.codigoContrato || contract.id || 'ARR-01');
  const esIfrs16 = contract.tratamientoContable === 'IFRS_16' || contract.esIfrs16;
  const fechaAsiento = new Date().toISOString().split('T')[0];
  const docContrato = `Contrato Arriendo N° ${codigoContrato}`;
  const folioTef = `TEF-${codigoContrato}-${fechaAsiento.replace(/-/g, '')}`;
  const ccArriendo = contract.centroCostoCodigo || contract.centroCostoNombre || 'ADMINISTRACION';

  const baseLeaseProps = {
    rutAuxiliar: arrendadorRut,
    nombreAuxiliar: arrendadorNombre,
    centroCosto: ccArriendo,
    documentoRef: docContrato,
    tipoDocumentoRef: 'CONTRATO',
    folioDocumentoRef: codigoContrato,
    fechaDocumentoRef: fechaAsiento,
    fechaVencimientoRef: fechaAsiento,
  };

  if (esIfrs16) {
    const amort = contract.amortizacionMensual || Math.round(canonCLP * 0.8);
    const fin = contract.gastoFinancieroMensual || contract.interesMensual || Math.round(canonCLP * 0.2);
    const pagoPrincipal = canonCLP - fin;

    const lineas: AccountingEntryLine[] = [
      {
        cuentaCodigo: '5.2.08',
        cuentaNombre: 'Amortización Activo por Derecho de Uso (IFRS 16)',
        debe: amort,
        haber: 0,
        ...baseLeaseProps,
      },
      {
        cuentaCodigo: '5.2.09',
        cuentaNombre: 'Gastos Financieros por Arrendamiento (IFRS 16)',
        debe: fin,
        haber: 0,
        ...baseLeaseProps,
      },
      {
        cuentaCodigo: '2.1.12',
        cuentaNombre: 'Pasivo por Arrendamiento (Disminución Principal)',
        debe: Math.max(0, pagoPrincipal),
        haber: 0,
        ...baseLeaseProps,
        tipoDocumentoOperacion: 'TRANSFERENCIA',
        documentoOperacion: folioTef,
        fechaDocumentoOperacion: fechaAsiento,
      },
      {
        cuentaCodigo: '1.2.02',
        cuentaNombre: 'Depreciación Acumulada Activo Derecho de Uso',
        debe: 0,
        haber: amort,
        ...baseLeaseProps,
      },
      {
        cuentaCodigo: '1.1.01',
        cuentaNombre: `Banco Santander (Pago Canon Mensual a ${arrendadorNombre})`,
        debe: 0,
        haber: canonCLP,
        ...baseLeaseProps,
        tipoDocumentoConciliacion: 'TRANSFERENCIA',
        documentoConciliacion: folioTef,
      },
    ];

    const totalDebe = lineas.reduce((s, l) => s + l.debe, 0);
    const totalHaber = lineas.reduce((s, l) => s + l.haber, 0);

    return enrichEntryWithChartAttributes({
      id: `entry-lease-${contract.id || Date.now()}`,
      fecha: fechaAsiento,
      concepto: `Reconocimiento Mensual IFRS 16 - ${nombreBien} (${arrendadorNombre})`,
      documento: docContrato,
      lineas,
      totalDebe,
      totalHaber,
      balanceado: Math.abs(totalDebe - totalHaber) < 2,
      origen: 'ARRIENDOS_IFRS16' as any,
      creadoEn: new Date().toISOString(),
    }, undefined, baseLeaseProps);
  } else {
    // Gasto simple mensual
    const lineas: AccountingEntryLine[] = [
      {
        cuentaCodigo: '5.2.07',
        cuentaNombre: `Gasto por Arriendo Comercial (${nombreBien})`,
        debe: canonCLP,
        haber: 0,
        ...baseLeaseProps,
      },
      {
        cuentaCodigo: '1.1.01',
        cuentaNombre: `Banco Santander (Pago Arriendo a ${arrendadorNombre})`,
        debe: 0,
        haber: canonCLP,
        ...baseLeaseProps,
        tipoDocumentoConciliacion: 'TRANSFERENCIA',
        documentoConciliacion: folioTef,
      },
    ];

    return enrichEntryWithChartAttributes({
      id: `entry-lease-simple-${contract.id || Date.now()}`,
      fecha: fechaAsiento,
      concepto: `Pago Canon de Arriendo Mensual - ${nombreBien}`,
      documento: docContrato,
      lineas,
      totalDebe: canonCLP,
      totalHaber: canonCLP,
      balanceado: true,
      origen: 'ARRIENDOS_IFRS16' as any,
      creadoEn: new Date().toISOString(),
    }, undefined, baseLeaseProps);
  }
}

export const createLeaseIfrs16Entry = createLeaseEntry;
export const createSimpleLeaseExpenseEntry = (contract: any, indicators: ChileIndicators = DEFAULT_INDICATORS) => {
  return createLeaseEntry({ ...contract, tratamientoContable: 'GASTO_SIMPLE', esIfrs16: false }, indicators);
};

/**
 * Asiento de Reconocimiento Inicial IFRS 16 (Alta de Activo por Derecho de Uso vs Pasivo Financiero)
 */
export function createLeaseInitialRecognitionEntry(
  lease: any,
  indicators: ChileIndicators = DEFAULT_INDICATORS,
  fechaCustom?: string
): AccountingEntry {
  const moneda = lease.moneda || lease.montoMensualMoneda || 'CLP';
  const canonMonto = lease.montoCanonMensual || lease.montoMensualValor || lease.montoMensualClp || 0;
  const canonCLP = moneda === 'UF' ? Math.round(canonMonto * indicators.uf) : canonMonto;
  const plazoMeses = lease.plazoMeses || 36;
  const valorPresente = lease.valorPresenteContrato || lease.valorActivoDerechoUso || Math.round(canonCLP * plazoMeses * 0.88);
  const nombreBien = lease.nombreBien || lease.inmuebleDescripcion || 'Inmueble Arrendado';
  const arrendadorNombre = lease.arrendadorNombre || 'Arrendador';
  const arrendadorRut = lease.arrendadorRut || '76.440.110-2';
  const codigoContrato = String(lease.codigoContrato || lease.id || 'ARR-01');
  const fechaAlta = fechaCustom || lease.fechaInicio || new Date().toISOString().split('T')[0];
  const docContrato = `Contrato Arriendo N° ${codigoContrato}`;
  const ccArriendo = lease.centroCostoCodigo || lease.centroCostoNombre || 'ADMINISTRACION';

  const baseProps = {
    rutAuxiliar: arrendadorRut,
    nombreAuxiliar: arrendadorNombre,
    centroCosto: ccArriendo,
    documentoRef: docContrato,
    tipoDocumentoRef: 'CONTRATO',
    folioDocumentoRef: codigoContrato,
    fechaDocumentoRef: fechaAlta,
  };

  const lineas: AccountingEntryLine[] = [
    {
      cuentaCodigo: '1.2.01',
      cuentaNombre: `Activo por Derecho de Uso - ${nombreBien} (IFRS 16)`,
      debe: valorPresente,
      haber: 0,
      ...baseProps,
    },
    {
      cuentaCodigo: '2.2.01',
      cuentaNombre: `Pasivo por Arrendamiento Financiero (IFRS 16 - ${arrendadorNombre})`,
      debe: 0,
      haber: valorPresente,
      ...baseProps,
    },
  ];

  return enrichEntryWithChartAttributes({
    id: `entry-lease-initial-${lease.id || Date.now()}`,
    fecha: fechaAlta,
    concepto: `Reconocimiento Inicial IFRS 16: Alta Activo por Derecho de Uso (${nombreBien}) - ${arrendadorNombre}`,
    documento: docContrato,
    lineas,
    totalDebe: valorPresente,
    totalHaber: valorPresente,
    balanceado: true,
    origen: 'ARRIENDOS_IFRS16' as any,
    creadoEn: new Date().toISOString(),
  }, undefined, baseProps);
}

/**
 * Asiento de Pago F29 en Tesorería General de la República (TGR) con cargo a Banco
 */
export function createF29TgrPaymentEntry(
  periodo: string,
  montoAPagar: number,
  bancoCuentaCodigo: string = '1.1.02.001',
  bancoNombre: string = 'Banco Santander',
  fechaCustom?: string
): AccountingEntry {
  const monto = Math.round(montoAPagar);
  const fechaPago = fechaCustom || new Date().toISOString().split('T')[0];
  const folioF29 = `F29-${periodo.replace(/-/g, '')}`;
  const folioTef = `TEF-TGR-${periodo.replace(/-/g, '')}`;
  const docLabel = `Comprobante Pago PAC / TGR F29 ${periodo} (Folio ${folioF29})`;

  const lineas: AccountingEntryLine[] = [
    {
      cuentaCodigo: '2.1.08',
      cuentaNombre: `Impuestos por Pagar (F29 TGR Período ${periodo})`,
      debe: monto,
      haber: 0,
      rutAuxiliar: '60.803.000-K',
      nombreAuxiliar: 'Tesorería General de la República (TGR)',
      documentoRef: docLabel,
      tipoDocumentoRef: 'TRIBUTARIO_TGR',
      folioDocumentoRef: folioF29,
      fechaDocumentoRef: fechaPago,
      tipoDocumentoOperacion: 'TRANSFERENCIA',
      documentoOperacion: folioTef,
      fechaDocumentoOperacion: fechaPago,
    },
    {
      cuentaCodigo: bancoCuentaCodigo,
      cuentaNombre: `${bancoNombre} (Pago F29 en Tesorería General de la República)`,
      debe: 0,
      haber: monto,
      rutAuxiliar: '60.803.000-K',
      nombreAuxiliar: 'Tesorería General de la República (TGR)',
      tipoDocumentoConciliacion: 'TRANSFERENCIA',
      documentoConciliacion: folioTef,
      documentoRef: docLabel,
      folioDocumentoRef: folioF29,
      fechaDocumentoRef: fechaPago,
      fechaVencimientoRef: fechaPago,
    },
  ];

  return enrichEntryWithChartAttributes({
    id: `entry-f29-pay-${periodo}-${Date.now()}`,
    fecha: fechaPago,
    concepto: `Pago Electrónico F29 a Tesorería General (TGR) - Período ${periodo}`,
    documento: docLabel,
    lineas,
    totalDebe: monto,
    totalHaber: monto,
    balanceado: true,
    origen: 'F29_CENTRALIZACION' as any,
    creadoEn: new Date().toISOString(),
  });
}

/**
 * Validador oficial de RUT Chileno (Algoritmo Módulo 11)
 */
export function validateRutChileno(rutCompleto: string): boolean {
  if (!rutCompleto || typeof rutCompleto !== 'string') return false;
  const cleanRut = rutCompleto.replace(/[^0-9kK]/g, '').toUpperCase();
  if (cleanRut.length < 7 || cleanRut.length > 9) return false;
  
  const cuerpo = cleanRut.slice(0, -1);
  const dv = cleanRut.slice(-1);
  
  let suma = 0;
  let multiplo = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += parseInt(cuerpo.charAt(i), 10) * multiplo;
    multiplo = multiplo < 7 ? multiplo + 1 : 2;
  }
  
  const dvEsperadoNum = 11 - (suma % 11);
  let dvEsperado = '';
  if (dvEsperadoNum === 11) dvEsperado = '0';
  else if (dvEsperadoNum === 10) dvEsperado = 'K';
  else dvEsperado = dvEsperadoNum.toString();
  
  return dv === dvEsperado;
}

export const validateRut = validateRutChileno;

/**
 * Formateador de RUT Chileno estándar (XX.XXX.XXX-X)
 */
export function formatRutChileno(rutRaw: string): string {
  if (!rutRaw) return '';
  const clean = rutRaw.replace(/[^0-9kK]/g, '').toUpperCase();
  if (clean.length <= 1) return clean;
  const cuerpo = clean.slice(0, -1);
  const dv = clean.slice(-1);
  const formattedCuerpo = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${formattedCuerpo}-${dv}`;
}

/**
 * Genera el asiento contable formal para una Novedad de Conciliación Bancaria
 * (ej: Cargos por mantención, comisiones TEF masivas, abonos de clientes no contabilizados, PAC)
 */
export function createBankNovedadEntry(
  movement: BankStatementMovement,
  bancoNombre: string = 'Banco Santander',
  moneda: 'CLP' | 'USD' | 'EUR' = 'CLP',
  tipoCambio: number = 955.20
): AccountingEntry {
  const accountMoneda = movement.moneda || moneda;
  const tc = movement.tipoCambio || tipoCambio || (accountMoneda === 'EUR' ? 1042.80 : 955.20);
  const esExtranjera = accountMoneda !== 'CLP';

  const lineas: AccountingEntryLine[] = [];
  const fecha = movement.fecha;
  const refNum = String(movement.numeroReferencia || movement.id || 'CARTOLA');
  const doc = `Cartola Bancaria Ref: ${refNum}`;

  const montoNominal = movement.abono > 0 ? movement.abono : movement.cargo;
  const montoContableCLP = esExtranjera ? Math.round(montoNominal * tc) : Math.round(montoNominal);

  const monedaPrefijo = accountMoneda === 'USD' ? 'US$' : accountMoneda === 'EUR' ? '€' : '$';
  const glosaSufijo = esExtranjera ? ` [${monedaPrefijo}${montoNominal.toFixed(2)} @ $${tc} CLP/${accountMoneda}]` : '';

  const cuentaBancoCodigo = esExtranjera ? '1.1.02.003' : '1.1.01.001';
  const cuentaBancoNombre = esExtranjera 
    ? `${bancoNombre} Moneda Extranjera (${accountMoneda})`
    : `${bancoNombre} (Cta. Cte. M/N)`;

  const fxProps = esExtranjera
    ? {
        monedaOriginal: accountMoneda as 'USD' | 'EUR',
        montoMonedaOriginal: montoNominal,
        tipoCambio: tc,
      }
    : {};

  const tipoConcil = movement.abono > 0 ? ('DEPOSITO' as const) : ('CARGO_AUTOMATICO' as const);

  if (movement.abono > 0) {
    // Abono recibido en la cuenta bancaria (Debe Banco / Haber Contrapartida)
    lineas.push({
      cuentaCodigo: cuentaBancoCodigo,
      cuentaNombre: cuentaBancoNombre,
      debe: montoContableCLP,
      haber: 0,
      tipoDocumentoConciliacion: tipoConcil,
      documentoConciliacion: refNum,
      documentoRef: doc,
      folioDocumentoRef: refNum,
      fechaDocumentoRef: fecha,
      fechaVencimientoRef: fecha,
      ...fxProps,
    });
    lineas.push({
      cuentaCodigo: movement.cuentaContableSugerida?.haberCodigo || '2.1.08',
      cuentaNombre: movement.cuentaContableSugerida?.haberNombre || 'Anticipos de Clientes / Partidas por Aplicar',
      debe: 0,
      haber: montoContableCLP,
      centroCosto: 'TESORERIA',
      documentoRef: doc,
      folioDocumentoRef: refNum,
      fechaDocumentoRef: fecha,
      tipoDocumentoOperacion: tipoConcil,
      documentoOperacion: refNum,
      fechaDocumentoOperacion: fecha,
      ...fxProps,
    });
  } else {
    // Cargo debitado por el banco (Debe Gasto/Costo / Haber Banco)
    lineas.push({
      cuentaCodigo: movement.cuentaContableSugerida?.debeCodigo || '5.1.09',
      cuentaNombre: movement.cuentaContableSugerida?.debeNombre || 'Gastos y Comisiones Bancarias',
      debe: montoContableCLP,
      haber: 0,
      centroCosto: 'FINANZAS_TESORERIA',
      documentoRef: doc,
      folioDocumentoRef: refNum,
      fechaDocumentoRef: fecha,
      ...fxProps,
    });
    lineas.push({
      cuentaCodigo: cuentaBancoCodigo,
      cuentaNombre: cuentaBancoNombre,
      debe: 0,
      haber: montoContableCLP,
      tipoDocumentoConciliacion: tipoConcil,
      documentoConciliacion: refNum,
      documentoRef: doc,
      folioDocumentoRef: refNum,
      fechaDocumentoRef: fecha,
      fechaVencimientoRef: fecha,
      ...fxProps,
    });
  }

  return enrichEntryWithChartAttributes({
    id: `entry-bank-nov-${movement.id}-${Date.now()}`,
    fecha,
    concepto: `Registro Novedad Bancaria: ${movement.glosaBancaria}${glosaSufijo}`,
    documento: doc,
    lineas,
    totalDebe: montoContableCLP,
    totalHaber: montoContableCLP,
    balanceado: true,
    origen: 'CAJA_BANCO',
    creadoEn: new Date().toISOString(),
  }, undefined, {
    documentoRef: doc,
    folioDocumentoRef: refNum,
    fechaDocumentoRef: fecha,
    centroCosto: 'FINANZAS_TESORERIA',
    tipoDocumentoConciliacion: tipoConcil,
    documentoConciliacion: refNum,
    ...fxProps,
  });
}

// ========================================================
// UTILIDADES CONTABLES Y OPERACIONALES DE INVENTARIO (SII)
// ========================================================

export function calculateStockStatus(stockGeneral: number, stockMinimo: number, stockCritico: number): StockStatus {
  if (stockGeneral <= stockCritico) return 'CRITICO';
  if (stockGeneral <= stockMinimo) return 'BAJO_MINIMO';
  if (stockGeneral > stockMinimo * 3.5 && stockMinimo > 0) return 'SOBRESTOCK';
  return 'OPTIMO';
}

export function calculateCoverageDays(stockGeneral: number, consumoMensualPromedio: number): number {
  if (consumoMensualPromedio <= 0) return 999;
  const consumoDiario = consumoMensualPromedio / 30;
  return Math.round(stockGeneral / consumoDiario);
}

/**
 * Crea asiento contable por traslado interno de existencias (DTE 52 Traslado Interno)
 * Debe: 1.1.04.99 Existencias en Tránsito
 * Haber: 1.1.04.01 Existencias Bodega Origen
 */
export function createWarehouseTransferEntry(transfer: WarehouseTransfer): AccountingEntry {
  const docLabel = `Guía de Despacho Electrónica (DTE 52) N° ${transfer.folioGuiaDespacho52}`;
  const folioGuia = String(transfer.folioGuiaDespacho52);
  const lineas: AccountingEntryLine[] = [
    {
      cuentaCodigo: '1.1.04.99',
      cuentaNombre: `Existencias en Tránsito (Guía DTE 52 N° ${transfer.folioGuiaDespacho52})`,
      debe: transfer.valorTotalTraslado,
      haber: 0,
      centroCosto: transfer.bodegaDestinoNombre || 'LOGISTICA_TRANSITO',
      documentoRef: docLabel,
      tipoDocumentoRef: 'DTE_SII',
      folioDocumentoRef: folioGuia,
      fechaDocumentoRef: transfer.fechaDespacho,
    },
    {
      cuentaCodigo: '1.1.04.01',
      cuentaNombre: `Existencias - ${transfer.bodegaOrigenNombre}`,
      debe: 0,
      haber: transfer.valorTotalTraslado,
      centroCosto: transfer.bodegaOrigenNombre || 'BODEGA_ORIGEN',
      documentoRef: docLabel,
      tipoDocumentoRef: 'DTE_SII',
      folioDocumentoRef: folioGuia,
      fechaDocumentoRef: transfer.fechaDespacho,
    }
  ];

  return enrichEntryWithChartAttributes({
    id: `entry-transfer-${transfer.id}-${Date.now()}`,
    fecha: transfer.fechaDespacho,
    concepto: `Traslado Interno sin Venta (SII Cód 5) desde ${transfer.bodegaOrigenNombre} hacia ${transfer.bodegaDestinoNombre}`,
    documento: docLabel,
    lineas,
    totalDebe: transfer.valorTotalTraslado,
    totalHaber: transfer.valorTotalTraslado,
    balanceado: true,
    origen: 'INVENTARIO',
    creadoEn: new Date().toISOString(),
  });
}

/**
 * Crea asiento contable por recepción definitiva en bodega destino
 * Debe: 1.1.04.02 Existencias Bodega Destino
 * Haber: 1.1.04.99 Existencias en Tránsito
 */
export function createWarehouseReceiptEntry(transfer: WarehouseTransfer): AccountingEntry {
  const fechaRec = transfer.fechaRecepcionReal || new Date().toISOString().split('T')[0];
  const docLabel = `Recepción Conforme DTE 52 N° ${transfer.folioGuiaDespacho52}`;
  const folioGuia = String(transfer.folioGuiaDespacho52);
  const lineas: AccountingEntryLine[] = [
    {
      cuentaCodigo: '1.1.04.02',
      cuentaNombre: `Existencias - ${transfer.bodegaDestinoNombre}`,
      debe: transfer.valorTotalTraslado,
      haber: 0,
      centroCosto: transfer.bodegaDestinoNombre || 'BODEGA_DESTINO',
      documentoRef: docLabel,
      tipoDocumentoRef: 'DTE_SII',
      folioDocumentoRef: folioGuia,
      fechaDocumentoRef: fechaRec,
    },
    {
      cuentaCodigo: '1.1.04.99',
      cuentaNombre: `Existencias en Tránsito (Guía DTE 52 N° ${transfer.folioGuiaDespacho52})`,
      debe: 0,
      haber: transfer.valorTotalTraslado,
      centroCosto: transfer.bodegaOrigenNombre || 'LOGISTICA_TRANSITO',
      documentoRef: docLabel,
      tipoDocumentoRef: 'DTE_SII',
      folioDocumentoRef: folioGuia,
      fechaDocumentoRef: fechaRec,
    }
  ];

  return enrichEntryWithChartAttributes({
    id: `entry-receipt-${transfer.id}-${Date.now()}`,
    fecha: fechaRec,
    concepto: `Recepción Conforme de Traslado Interno DTE 52 N° ${transfer.folioGuiaDespacho52} en ${transfer.bodegaDestinoNombre}`,
    documento: docLabel,
    lineas,
    totalDebe: transfer.valorTotalTraslado,
    totalHaber: transfer.valorTotalTraslado,
    balanceado: true,
    origen: 'INVENTARIO',
    creadoEn: new Date().toISOString(),
  });
}

/**
 * Genera solicitud automática de reposición a través del Agente de Inventario
 * Verifica si otra bodega tiene sobrestock para proponer un traspaso interno antes de comprar
 */
export function generateAutoReplenishmentRequisition(
  item: InventoryItem, 
  targetWarehouse: Warehouse, 
  allWarehouses: Warehouse[]
): ReplenishmentRequisition {
  // Buscar si alguna otra bodega de la misma empresa tiene sobrestock de este SKU
  let bodegaConSobrestock: Warehouse | undefined;
  for (const b of allWarehouses) {
    if (b.id !== targetWarehouse.id) {
      const stockEnOtra = item.stockPorBodega.find(sb => sb.bodegaId === b.id)?.stockFisico || 0;
      if (stockEnOtra > item.stockMinimo * 1.5 && stockEnOtra >= item.loteOptimoReposicion) {
        bodegaConSobrestock = b;
        break;
      }
    }
  }

  const esTraspaso = Boolean(bodegaConSobrestock);
  const esCritico = item.stockGeneral <= item.stockCritico;
  const cantidadPedir = item.loteOptimoReposicion > 0 ? item.loteOptimoReposicion : Math.max(item.stockMinimo * 2, 20);

  const motivoAgente = esTraspaso
    ? `IA Detectó Stock Crítico en ${targetWarehouse.nombre} (${item.stockGeneral} un. vs Mínimo ${item.stockMinimo} un.). Se sugiere TRASPASO INTERNO desde ${bodegaConSobrestock?.nombre} (dispone de stock excedentario) ahorrando costos de compra a terceros.`
    : `Stock bajo nivel mínimo en ${targetWarehouse.nombre} (Físico: ${item.stockGeneral} un., Crítico: ${item.stockCritico} un.). Consumo proyectado: ${item.consumoMensualPromedio} un./mes. Se sugiere COMPRA a proveedor ${item.proveedorPrincipal.razonSocial}.`;

  return {
    id: `req-${item.id}-${Date.now()}`,
    empresaId: item.empresaId,
    folioRequisicion: folioInterno('REQ'),
    fechaGeneracion: new Date().toISOString().split('T')[0],
    generadoPorAgente: true,
    motivoAgente,
    itemId: item.id,
    sku: item.sku,
    nombreItem: item.nombre,
    categoria: item.categoria,
    bodegaDestinoId: targetWarehouse.id,
    bodegaDestinoNombre: targetWarehouse.nombre,
    stockActual: item.stockGeneral,
    stockMinimo: item.stockMinimo,
    stockCritico: item.stockCritico,
    cantidadSugerida: cantidadPedir,
    costoEstimadoCLP: Math.round(cantidadPedir * item.costoUnitarioPMP),
    prioridad: esCritico ? 'URGENTE' : 'ALTA',
    tipoAccionRecomendada: esTraspaso ? 'TRASPASO_INTERNO' : 'COMPRA_PROVEEDOR',
    bodegaOrigenSugeridaTraspaso: bodegaConSobrestock?.nombre,
    proveedorSugerido: item.proveedorPrincipal,
    estado: 'PENDIENTE_APROBACION',
  };
}

// ============================================================================
// GENERADORES DE ASIENTOS: ACTIVO FIJO (NIC 16 / ART. 31 N° 5 & 41 LIR)
// ============================================================================

import {
  FixedAsset,
  ProductionOrder,
  DirectMaterialConsumption,
  DirectLaborEntry,
} from '../types';

/**
 * Asiento de Alta o Incorporación de Activo Fijo (Compra / Capitalización)
 */
export function createFixedAssetAcquisitionEntry(asset: FixedAsset): AccountingEntry {
  const neto = Math.round(asset.valorAdquisicionOriginal);
  const iva = Math.round(neto * 0.19); // IVA Crédito Fiscal Activo Fijo (Código 524 F29)
  const total = neto + iva;
  const fecha = asset.fechaAdquisicion || new Date().toISOString().split('T')[0];
  const folioStr = String(asset.folioDteCompra || asset.codigoPlaca || 'AF-ALTA');
  const docLabel = `DTE 33 Folio ${folioStr}`;
  const ccAsset = asset.centroCostoCodigo || asset.centroCostoNombre || asset.ubicacionFisica || 'ADMINISTRACION';
  const baseAfProps = {
    rutAuxiliar: asset.proveedorRut,
    nombreAuxiliar: asset.proveedorRazonSocial || 'Proveedor Activo Fijo',
    centroCosto: ccAsset,
    documentoRef: docLabel,
    tipoDocumentoRef: 'DTE_SII',
    folioDocumentoRef: folioStr,
    fechaDocumentoRef: fecha,
  };

  const lineas: AccountingEntryLine[] = [
    {
      cuentaCodigo: asset.cuentaContableActivo || '1.2.05',
      cuentaNombre: `${asset.nombre} (${asset.codigoPlaca})`,
      debe: neto,
      haber: 0,
      ...baseAfProps,
    },
    {
      cuentaCodigo: '1.1.05',
      cuentaNombre: 'IVA Crédito Fiscal (Activo Fijo Art. 23 DL 825)',
      debe: iva,
      haber: 0,
      ...baseAfProps,
    },
    {
      cuentaCodigo: '2.1.01',
      cuentaNombre: `Proveedores Nacionales (${asset.proveedorRazonSocial || 'Adquisición AF'})`,
      debe: 0,
      haber: total,
      montoDocumentoRef: total,
      ...baseAfProps,
    },
  ];

  return enrichEntryWithChartAttributes({
    id: `entry-af-alta-${asset.id}-${Date.now()}`,
    fecha,
    concepto: `Alta Activo Fijo: ${asset.nombre} - Placa ${asset.codigoPlaca} (Folio DTE ${folioStr})`,
    documento: docLabel,
    lineas,
    totalDebe: total,
    totalHaber: total,
    balanceado: true,
    origen: 'ACTIVO_FIJO',
    creadoEn: new Date().toISOString(),
    supervisorSignature: `AF-AUTO-${asset.codigoPlaca}`,
  }, undefined, baseAfProps);
}

/**
 * Asiento de Depreciación del Período (Mensual / Anual NIC 16 e IFRS)
 * Desglosado y atribuido a cada Centro de Costos
 */
export function createFixedAssetDepreciationEntry(
  periodo: string,
  depreciaciones: Array<{
    activo: FixedAsset;
    cuotaFinanciera: number;
    cuotaFabrilCif: number;
  }>,
  fechaCustom?: string
): AccountingEntry {
  const fecha = fechaCustom || `${periodo}-28`;
  const docLabel = `Cuadro AF Periodo ${periodo}`;
  const folioDep = `DEP-AF-${periodo}`;
  let totalDepAcum = 0;

  // Agrupación de la cuota de depreciación por Centro de Costo
  interface CcDepGroup {
    codigo: string;
    nombre: string;
    gastoAdmin: number;
    cifFabril: number;
  }
  const ccMap: Record<string, CcDepGroup> = {};

  depreciaciones.forEach((d) => {
    const ccKey = d.activo.centroCostoCodigo || (d.activo.esFabrilProduccion ? 'CC-PRD-QUELLON' : 'CC-ADM-01');
    const ccNom = d.activo.centroCostoNombre || (d.activo.esFabrilProduccion ? 'Planta Fabril & Producción' : 'Administración Central');

    if (!ccMap[ccKey]) {
      ccMap[ccKey] = {
        codigo: ccKey,
        nombre: ccNom,
        gastoAdmin: 0,
        cifFabril: 0,
      };
    }

    if (d.activo.esFabrilProduccion) {
      ccMap[ccKey].cifFabril += d.cuotaFabrilCif;
    } else {
      ccMap[ccKey].gastoAdmin += d.cuotaFinanciera;
    }
    totalDepAcum += d.cuotaFinanciera;
  });

  totalDepAcum = Math.round(totalDepAcum);

  const lineas: AccountingEntryLine[] = [];

  Object.values(ccMap).forEach((cc) => {
    const adminRound = Math.round(cc.gastoAdmin);
    const cifRound = Math.round(cc.cifFabril);

    if (adminRound > 0) {
      lineas.push({
        cuentaCodigo: '5.2.13',
        cuentaNombre: `Gasto Depreciación Activo Fijo (NIC 16) - [${cc.codigo}]`,
        debe: adminRound,
        haber: 0,
        centroCosto: cc.codigo,
        documentoRef: docLabel,
        folioDocumentoRef: folioDep,
        fechaDocumentoRef: fecha,
      });
    }

    if (cifRound > 0) {
      lineas.push({
        cuentaCodigo: '5.1.04',
        cuentaNombre: `CIF Depreciación Maquinaria Fabril - [${cc.codigo}]`,
        debe: cifRound,
        haber: 0,
        centroCosto: cc.codigo,
        proyecto: cc.codigo,
        documentoRef: docLabel,
        folioDocumentoRef: folioDep,
        fechaDocumentoRef: fecha,
      });
    }
  });

  lineas.push({
    cuentaCodigo: '1.2.99',
    cuentaNombre: 'Depreciación Acumulada Activo Fijo (NIC 16)',
    debe: 0,
    haber: totalDepAcum,
    centroCosto: 'ACTIVO_FIJO',
    documentoRef: docLabel,
    folioDocumentoRef: folioDep,
    fechaDocumentoRef: fecha,
  });

  // Ajuste fino de centavos para garantizar partida doble matemática exacta
  const sumDebe = lineas.filter(l => l.debe > 0).reduce((s, l) => s + l.debe, 0);
  const diff = totalDepAcum - sumDebe;
  if (diff !== 0) {
    const firstDebe = lineas.find(l => l.debe > 0);
    if (firstDebe) {
      firstDebe.debe += diff;
    }
  }

  const realTotalDebe = lineas.reduce((s, l) => s + l.debe, 0);
  const realTotalHaber = lineas.reduce((s, l) => s + l.haber, 0);

  return enrichEntryWithChartAttributes({
    id: `entry-af-dep-${periodo}-${Date.now()}`,
    fecha,
    concepto: `Depreciación Activo Fijo Período ${periodo} (${depreciaciones.length} activos procesados)`,
    documento: docLabel,
    lineas,
    totalDebe: realTotalDebe,
    totalHaber: realTotalHaber,
    balanceado: Math.abs(realTotalDebe - realTotalHaber) < 1,
    origen: 'ACTIVO_FIJO',
    creadoEn: new Date().toISOString(),
    supervisorSignature: `DEP-AUTO-${periodo}`,
  });
}

/**
 * Asiento de Corrección Monetaria del Activo Fijo (Art. 41 N° 2 LIR)
 */
export function createFixedAssetMonetaryCorrectionEntry(
  periodo: string,
  totalCmActivo: number,
  totalCmDep: number,
  fechaCustom?: string
): AccountingEntry {
  const fecha = fechaCustom || `${periodo}-28`;
  const cmActivo = Math.round(totalCmActivo);
  const cmDep = Math.round(totalCmDep);
  const efectoNeto = cmActivo - cmDep;
  const docLabel = `CM-IPC-${periodo}`;

  const lineas: AccountingEntryLine[] = [
    {
      cuentaCodigo: '1.2.05',
      cuentaNombre: 'Reajuste IPC Activo Fijo (Art. 41 N° 2 LIR)',
      debe: cmActivo,
      haber: 0,
      centroCosto: 'ACTIVO_FIJO',
      documentoRef: docLabel,
      folioDocumentoRef: docLabel,
      fechaDocumentoRef: fecha,
    },
    {
      cuentaCodigo: '1.2.99',
      cuentaNombre: 'Reajuste IPC Depreciación Acumulada',
      debe: 0,
      haber: cmDep,
      centroCosto: 'ACTIVO_FIJO',
      documentoRef: docLabel,
      folioDocumentoRef: docLabel,
      fechaDocumentoRef: fecha,
    },
    {
      cuentaCodigo: '6.1.01',
      cuentaNombre: 'Corrección Monetaria Ejercicio (Resultado Neto)',
      debe: efectoNeto < 0 ? Math.abs(efectoNeto) : 0,
      haber: efectoNeto > 0 ? efectoNeto : 0,
      centroCosto: 'FINANZAS_TRIBUTARIO',
      documentoRef: docLabel,
      folioDocumentoRef: docLabel,
      fechaDocumentoRef: fecha,
    },
  ];

  const total = Math.max(cmActivo, cmDep + Math.max(0, efectoNeto));

  return enrichEntryWithChartAttributes({
    id: `entry-af-cm-${periodo}-${Date.now()}`,
    fecha,
    concepto: `Corrección Monetaria IPC Activo Fijo y Dep. Acumulada Período ${periodo} (Art. 41 LIR)`,
    documento: docLabel,
    lineas,
    totalDebe: total,
    totalHaber: total,
    balanceado: true,
    origen: 'ACTIVO_FIJO',
    creadoEn: new Date().toISOString(),
  });
}

/**
 * Asiento de Baja o Enajenación de Activo Fijo
 */
export function createFixedAssetDisposalEntry(
  asset: FixedAsset,
  precioVentaNeto: number,
  fechaCustom?: string
): AccountingEntry {
  const fecha = fechaCustom || new Date().toISOString().split('T')[0];
  const costoHist = Math.round(asset.valorAdquisicionOriginal);
  const depAcum = Math.round(asset.depreciacionAcumuladaFinanciera);
  const valorLibro = costoHist - depAcum;
  const precio = Math.round(precioVentaNeto);
  const iva = Math.round(precio * 0.19);
  const totalCobrar = precio + iva;
  const resultado = precio - valorLibro; // Positivo = Ganancia, Negativo = Pérdida
  const docLabel = `Acta de Baja / Venta ${asset.codigoPlaca}`;
  const ccAsset = asset.centroCostoCodigo || asset.centroCostoNombre || 'ADMINISTRACION';
  const baseBajaProps = {
    rutAuxiliar: asset.proveedorRut || '76.999.000-1',
    nombreAuxiliar: asset.proveedorRazonSocial || `Adquirente / Baja AF (${asset.codigoPlaca})`,
    centroCosto: ccAsset,
    documentoRef: docLabel,
    folioDocumentoRef: asset.codigoPlaca,
    fechaDocumentoRef: fecha,
  };

  const lineas: AccountingEntryLine[] = [];

  if (precio > 0) {
    lineas.push({
      cuentaCodigo: '1.1.03',
      cuentaNombre: `Clientes / Cuentas por Cobrar Venta AF (${asset.codigoPlaca})`,
      debe: totalCobrar,
      haber: 0,
      montoDocumentoRef: totalCobrar,
      ...baseBajaProps,
    });
  }

  lineas.push({
    cuentaCodigo: '1.2.99',
    cuentaNombre: 'Depreciación Acumulada Activo Fijo (Eliminación por Baja)',
    debe: depAcum,
    haber: 0,
    ...baseBajaProps,
  });

  if (resultado < 0) {
    lineas.push({
      cuentaCodigo: '5.2.14',
      cuentaNombre: 'Pérdida en Retiro o Enajenación de Activo Fijo',
      debe: Math.abs(resultado),
      haber: 0,
      ...baseBajaProps,
    });
  }

  lineas.push({
    cuentaCodigo: asset.cuentaContableActivo || '1.2.05',
    cuentaNombre: `${asset.nombre} (Baja de Costo Histórico)`,
    debe: 0,
    haber: costoHist,
    ...baseBajaProps,
  });

  if (iva > 0) {
    lineas.push({
      cuentaCodigo: '2.1.03',
      cuentaNombre: 'IVA Débito Fiscal Venta Activo Fijo',
      debe: 0,
      haber: iva,
      ...baseBajaProps,
    });
  }

  if (resultado > 0) {
    lineas.push({
      cuentaCodigo: '4.1.04',
      cuentaNombre: 'Utilidad en Enajenación de Activo Fijo',
      debe: 0,
      haber: resultado,
      ...baseBajaProps,
    });
  }

  const totalDebe = lineas.reduce((s, l) => s + l.debe, 0);
  const totalHaber = lineas.reduce((s, l) => s + l.haber, 0);

  return enrichEntryWithChartAttributes({
    id: `entry-af-baja-${asset.id}-${Date.now()}`,
    fecha,
    concepto: `Baja / Enajenación de Activo Fijo: ${asset.nombre} - Placa ${asset.codigoPlaca}`,
    documento: docLabel,
    lineas,
    totalDebe,
    totalHaber,
    balanceado: totalDebe === totalHaber,
    origen: 'ACTIVO_FIJO',
    creadoEn: new Date().toISOString(),
  }, undefined, baseBajaProps);
}

// ============================================================================
// GENERADORES DE ASIENTOS: PRODUCCIÓN Y COSTEO (NIC 2)
// ============================================================================

/**
 * Asiento de Consumo de Materia Prima Directa (MPD) hacia Productos en Proceso (WIP)
 */
export function createProductionMpdConsumptionEntry(
  op: ProductionOrder,
  consumption: DirectMaterialConsumption
): AccountingEntry {
  const monto = Math.round(consumption.costoTotalConsumo);
  const fecha = consumption.fecha || new Date().toISOString().split('T')[0];
  const docLabel = consumption.folioGuiaDespacho52 ? `Guía DTE 52 N° ${consumption.folioGuiaDespacho52}` : `Consumo Interno ${op.folioOP}`;
  const folioRef = String(consumption.folioGuiaDespacho52 || op.folioOP);

  const lineas: AccountingEntryLine[] = [
    {
      cuentaCodigo: '1.1.08.02',
      cuentaNombre: `Existencias - Productos en Proceso (${op.folioOP}: ${op.productoNombre})`,
      debe: monto,
      haber: 0,
      centroCosto: op.folioOP,
      proyecto: op.folioOP,
      documentoRef: docLabel,
      folioDocumentoRef: folioRef,
      fechaDocumentoRef: fecha,
    },
    {
      cuentaCodigo: '1.1.08.01',
      cuentaNombre: `Existencias - Materias Primas (${consumption.insumoNombre})`,
      debe: 0,
      haber: monto,
      centroCosto: consumption.bodegaOrigenNombre || op.folioOP,
      proyecto: op.folioOP,
      documentoRef: docLabel,
      folioDocumentoRef: folioRef,
      fechaDocumentoRef: fecha,
    },
  ];

  return enrichEntryWithChartAttributes({
    id: `entry-cost-mpd-${consumption.id}-${Date.now()}`,
    fecha,
    concepto: `Consumo MPD para ${op.folioOP}: ${consumption.cantidadConsumida} ${consumption.unidadMedida} de ${consumption.insumoNombre}`,
    documento: docLabel,
    lineas,
    totalDebe: monto,
    totalHaber: monto,
    balanceado: true,
    origen: 'COSTEO_PRODUCCION',
    creadoEn: new Date().toISOString(),
  }, undefined, { proyecto: op.folioOP, centroCosto: op.folioOP, documentoRef: docLabel, folioDocumentoRef: folioRef });
}

/**
 * Asiento de Aplicación de Mano de Obra Directa (MOD) hacia Productos en Proceso (WIP)
 */
export function createProductionModAllocationEntry(
  op: ProductionOrder,
  labor: DirectLaborEntry
): AccountingEntry {
  const monto = Math.round(labor.costoTotalMOD);
  const fecha = labor.fecha || new Date().toISOString().split('T')[0];
  const docLabel = `Parte Diario HH ${op.folioOP}`;

  const lineas: AccountingEntryLine[] = [
    {
      cuentaCodigo: '1.1.08.02',
      cuentaNombre: `Existencias - Productos en Proceso (${op.folioOP})`,
      debe: monto,
      haber: 0,
      centroCosto: op.folioOP,
      proyecto: op.folioOP,
      rutAuxiliar: labor.trabajadorRut,
      nombreAuxiliar: labor.trabajadorNombre,
      documentoRef: docLabel,
      folioDocumentoRef: op.folioOP,
      fechaDocumentoRef: fecha,
    },
    {
      cuentaCodigo: '5.1.03',
      cuentaNombre: `Mano de Obra Directa Fabril (${labor.etapaProceso})`,
      debe: 0,
      haber: monto,
      centroCosto: op.folioOP,
      proyecto: op.folioOP,
      rutAuxiliar: labor.trabajadorRut,
      nombreAuxiliar: labor.trabajadorNombre,
      documentoRef: docLabel,
      folioDocumentoRef: op.folioOP,
      fechaDocumentoRef: fecha,
    },
  ];

  return enrichEntryWithChartAttributes({
    id: `entry-cost-mod-${labor.id}-${Date.now()}`,
    fecha,
    concepto: `Imputación MOD a ${op.folioOP}: ${labor.horasTrabajadas} HH de ${labor.trabajadorNombre} en ${labor.etapaProceso}`,
    documento: docLabel,
    lineas,
    totalDebe: monto,
    totalHaber: monto,
    balanceado: true,
    origen: 'COSTEO_PRODUCCION',
    creadoEn: new Date().toISOString(),
  }, undefined, { proyecto: op.folioOP, centroCosto: op.folioOP, rutAuxiliar: labor.trabajadorRut, nombreAuxiliar: labor.trabajadorNombre, documentoRef: docLabel, folioDocumentoRef: op.folioOP });
}

/**
 * Asiento de Asignación de Costos Indirectos de Fabricación (CIF) a la Producción (WIP)
 */
export function createProductionCifAllocationEntry(
  op: ProductionOrder,
  montoCif: number,
  fechaCustom?: string
): AccountingEntry {
  const monto = Math.round(montoCif);
  const fecha = fechaCustom || new Date().toISOString().split('T')[0];
  const docLabel = `Liquidación CIF ${op.folioOP}`;

  const lineas: AccountingEntryLine[] = [
    {
      cuentaCodigo: '1.1.08.02',
      cuentaNombre: `Existencias - Productos en Proceso (${op.folioOP})`,
      debe: monto,
      haber: 0,
      centroCosto: op.folioOP,
      proyecto: op.folioOP,
      documentoRef: docLabel,
      folioDocumentoRef: op.folioOP,
      fechaDocumentoRef: fecha,
    },
    {
      cuentaCodigo: '5.1.05',
      cuentaNombre: `Costos Indirectos de Fabricación Aplicados (Base: ${op.baseProrrateoCif})`,
      debe: 0,
      haber: monto,
      centroCosto: 'PLANTA_PRODUCTIVA',
      proyecto: op.folioOP,
      documentoRef: docLabel,
      folioDocumentoRef: op.folioOP,
      fechaDocumentoRef: fecha,
    },
  ];

  return enrichEntryWithChartAttributes({
    id: `entry-cost-cif-${op.id}-${Date.now()}`,
    fecha,
    concepto: `Aplicación de CIF a ${op.folioOP} (Base Prorrateo: ${op.baseProrrateoCif}, Tasa: ${op.tasaCifAplicada})`,
    documento: docLabel,
    lineas,
    totalDebe: monto,
    totalHaber: monto,
    balanceado: true,
    origen: 'COSTEO_PRODUCCION',
    creadoEn: new Date().toISOString(),
  }, undefined, { proyecto: op.folioOP, centroCosto: op.folioOP, documentoRef: docLabel, folioDocumentoRef: op.folioOP });
}

/**
 * Asiento de Liquidación de Orden de Producción Terminada (WIP -> Productos Terminados)
 */
export function createProductionFinishedLiquidationEntry(
  op: ProductionOrder,
  fechaCustom?: string
): AccountingEntry {
  const costoTotal = Math.round(op.costoTotalProduccion);
  const fecha = fechaCustom || op.fechaRealTermino || new Date().toISOString().split('T')[0];
  const docLabel = `Cierre OP ${op.folioOP}`;

  const lineas: AccountingEntryLine[] = [
    {
      cuentaCodigo: '1.1.08.03',
      cuentaNombre: `Existencias - Productos Terminados (${op.productoNombre})`,
      debe: costoTotal,
      haber: 0,
      centroCosto: op.bodegaDestinoNombre || 'BODEGA_PRODUCTO_TERMINADO',
      proyecto: op.folioOP,
      documentoRef: docLabel,
      folioDocumentoRef: op.folioOP,
      fechaDocumentoRef: fecha,
    },
    {
      cuentaCodigo: '1.1.08.02',
      cuentaNombre: `Existencias - Productos en Proceso (${op.folioOP})`,
      debe: 0,
      haber: costoTotal,
      centroCosto: op.folioOP,
      proyecto: op.folioOP,
      documentoRef: docLabel,
      folioDocumentoRef: op.folioOP,
      fechaDocumentoRef: fecha,
    },
  ];

  return enrichEntryWithChartAttributes({
    id: `entry-cost-liq-${op.id}-${Date.now()}`,
    fecha,
    concepto: `Liquidación Producción Terminada ${op.folioOP}: ${op.cantidadProducidaReal} ${op.unidadMedida} de ${op.productoNombre} (Costo Unitario: $${Math.round(op.costoUnitarioReal)}/${op.unidadMedida})`,
    documento: docLabel,
    lineas,
    totalDebe: costoTotal,
    totalHaber: costoTotal,
    balanceado: true,
    origen: 'COSTEO_PRODUCCION',
    creadoEn: new Date().toISOString(),
  }, undefined, { proyecto: op.folioOP, centroCosto: op.folioOP, documentoRef: docLabel, folioDocumentoRef: op.folioOP });
}

/**
 * Asiento de Costo de Ventas (CMV) al enajenar productos terminados
 */
export function createProductionCogsEntry(
  op: ProductionOrder,
  cantidadVendida: number,
  dteFolio?: number,
  fechaCustom?: string
): AccountingEntry {
  const costoTotalVendido = Math.round(cantidadVendida * op.costoUnitarioReal);
  const fecha = fechaCustom || new Date().toISOString().split('T')[0];
  const docLabel = dteFolio ? `Factura DTE 33 N° ${dteFolio}` : `Despacho Venta ${op.folioOP}`;
  const folioRef = dteFolio ? String(dteFolio) : op.folioOP;

  const lineas: AccountingEntryLine[] = [
    {
      cuentaCodigo: '5.1.01',
      cuentaNombre: `Costo de Ventas - Productos Manufacturados (${op.productoNombre})`,
      debe: costoTotalVendido,
      haber: 0,
      centroCosto: 'VENTAS_OPERACIONALES',
      proyecto: op.folioOP,
      documentoRef: docLabel,
      folioDocumentoRef: folioRef,
      fechaDocumentoRef: fecha,
    },
    {
      cuentaCodigo: '1.1.08.03',
      cuentaNombre: `Existencias - Productos Terminados (${op.productoNombre})`,
      debe: 0,
      haber: costoTotalVendido,
      centroCosto: op.bodegaDestinoNombre || 'BODEGA_PRODUCTO_TERMINADO',
      proyecto: op.folioOP,
      documentoRef: docLabel,
      folioDocumentoRef: folioRef,
      fechaDocumentoRef: fecha,
    },
  ];

  return enrichEntryWithChartAttributes({
    id: `entry-cogs-${op.id}-${Date.now()}`,
    fecha,
    concepto: `Costo de Ventas (CMV) por entrega de ${cantidadVendida} ${op.unidadMedida} de ${op.productoNombre} (Factura DTE ${dteFolio || 'S/F'})`,
    documento: docLabel,
    lineas,
    totalDebe: costoTotalVendido,
    totalHaber: costoTotalVendido,
    balanceado: true,
    origen: 'COSTEO_PRODUCCION',
    creadoEn: new Date().toISOString(),
  }, undefined, { proyecto: op.folioOP, centroCosto: 'VENTAS_OPERACIONALES', documentoRef: docLabel, folioDocumentoRef: folioRef });
}



