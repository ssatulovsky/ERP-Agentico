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

// Default reference values for Chile
export const DEFAULT_INDICATORS: ChileIndicators = {
  uf: 39150.50,
  utm: 68320,
  dolar: 955.20,
  imm: 500000,
  topeImponibleAfpUf: 84.3,
  topeImponibleAfcUf: 126.6,
  retencionHonorariosTasa: 0.145, // 14.5%
  sisTasa: 0.0149, // 1.49%
  mutualBaseTasa: 0.0093, // 0.93%
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
  const sueldoBase = employee.sueldoBase || 500000;
  const tipoContrato = employee.tipoContrato || 'INDEFINIDO';
  const horasExtrasCant = employee.horasExtrasCantidad || 0;
  const comisiones = employee.comisionesBonosImponibles || 0;
  const colacion = employee.asignacionColacion || 0;
  const movilizacion = employee.asignacionMovilizacion || 0;
  const viaticos = employee.viaticosAsignacionFamiliar || 0;
  const diasTrabajados = employee.diasTrabajados || 30;

  // Valor Hora Extra (Base / 30 * 28 / 44 * 1.5)
  const factorHoraExtra = (1 / 30) * (28 / 44) * 1.5;
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

  // Topes imponibles en pesos
  const topeAfpSaludCLP = Math.round(indicators.topeImponibleAfpUf * indicators.uf);
  const topeAfcCLP = Math.round(indicators.topeImponibleAfcUf * indicators.uf);

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

  const costoTotalEmpresa = totalHaberesBrutos + sisEmpleadorMonto + mutualEmpleadorMonto + afcEmpleadorMonto;

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
    costoTotalEmpresa,
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
  const totalAportesPatronales = totalSis + totalMutual + totalAfcEmpleador;

  // Haberes / Cuentas de Pasivo
  const totalAfp = payrolls.reduce((sum, p) => sum + p.afpMonto, 0);
  const totalSalud = payrolls.reduce((sum, p) => sum + p.saludMonto, 0);
  const totalAfcTrabajador = payrolls.reduce((sum, p) => sum + p.afcTrabajadorMonto, 0);
  const totalImpuestoUnico = payrolls.reduce((sum, p) => sum + p.impuestoUnicoMonto, 0);
  const totalSueldosLiquidos = payrolls.reduce((sum, p) => sum + p.sueldoLiquido, 0);

  const lineas: AccountingEntryLine[] = [
    // DEBE: Gastos de Personal
    { cuentaCodigo: '5.2.01', cuentaNombre: 'Sueldos y Remuneraciones Base', debe: totalSueldoBase, haber: 0 },
    { cuentaCodigo: '5.2.02', cuentaNombre: 'Gratificaciones Legales Art. 50', debe: totalGratificaciones, haber: 0 },
  ];

  if (totalHorasExtras + totalBonos > 0) {
    lineas.push({ cuentaCodigo: '5.2.03', cuentaNombre: 'Horas Extras y Bonos Imponibles', debe: totalHorasExtras + totalBonos, haber: 0 });
  }
  if (totalNoImponibles > 0) {
    lineas.push({ cuentaCodigo: '5.2.05', cuentaNombre: 'Asignaciones No Imponibles (Colación/Mov.)', debe: totalNoImponibles, haber: 0 });
  }
  if (totalAportesPatronales > 0) {
    lineas.push({ cuentaCodigo: '5.2.04', cuentaNombre: 'Aportes Patronales (SIS, Mutual, AFC Emp.)', debe: totalAportesPatronales, haber: 0 });
  }

  // HABER: Pasivos y Retenciones por Pagar
  lineas.push(
    { cuentaCodigo: '2.1.08', cuentaNombre: 'Instituciones Previsionales (AFP) por Pagar', debe: 0, haber: totalAfp },
    { cuentaCodigo: '2.1.09', cuentaNombre: 'Salud (Fonasa / Isapres) por Pagar', debe: 0, haber: totalSalud },
    { cuentaCodigo: '2.1.10', cuentaNombre: 'AFC Seguro de Cesantía por Pagar', debe: 0, haber: totalAfcTrabajador + totalAfcEmpleador },
    { cuentaCodigo: '2.1.11', cuentaNombre: 'Mutual de Seguridad / SIS por Pagar', debe: 0, haber: totalMutual + totalSis }
  );

  if (totalImpuestoUnico > 0) {
    lineas.push({ cuentaCodigo: '2.1.05', cuentaNombre: 'Impuesto Único 2da Categoría por Pagar (F29)', debe: 0, haber: totalImpuestoUnico });
  }

  lineas.push({ cuentaCodigo: '2.1.07', cuentaNombre: 'Sueldos Líquidos por Pagar', debe: 0, haber: totalSueldosLiquidos });

  const totalDebe = lineas.reduce((s, l) => s + l.debe, 0);
  const totalHaber = lineas.reduce((s, l) => s + l.haber, 0);

  return {
    id: `entry-payroll-${Date.now()}`,
    fecha: fechaCustom || `${periodo}-28`,
    concepto: `Centralización de Remuneraciones Mes de ${periodo} (${payrolls.length} colaboradores)`,
    documento: `Libro de Remuneraciones Periodo ${periodo}`,
    lineas,
    totalDebe,
    totalHaber,
    balanceado: Math.abs(totalDebe - totalHaber) < 1,
    origen: 'REMUNERACIONES',
    creadoEn: new Date().toISOString(),
  };
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

  const lineas: AccountingEntryLine[] = [];

  // CASO 1: NOTA DE CRÉDITO DE VENTA (DTE 61)
  if (dte.tipoDte === '61') {
    if (dte.montoNeto > 0) {
      lineas.push({
        cuentaCodigo: '4.1.99',
        cuentaNombre: 'Devoluciones y Descuentos en Ventas (Art. 21 DL 825)',
        debe: dte.montoNeto,
        haber: 0,
      });
    }
    if (dte.montoIva > 0) {
      lineas.push({
        cuentaCodigo: '2.1.03',
        cuentaNombre: 'IVA Débito Fiscal (Rebaja por NC Emitida)',
        debe: dte.montoIva,
        haber: 0,
      });
    }
    if (dte.montoExento > 0) {
      lineas.push({
        cuentaCodigo: '4.1.02',
        cuentaNombre: 'Rebaja Ventas Exentas por NC',
        debe: dte.montoExento,
        haber: 0,
      });
    }
    lineas.push({
      cuentaCodigo: '1.1.03',
      cuentaNombre: `Clientes Nacionales (${dte.razonSocialContraparte})`,
      debe: 0,
      haber: dte.montoTotal,
    });
  } 
  // CASO 2: FACTURA DE EXPORTACIÓN (DTE 110)
  else if (dte.tipoDte === '110') {
    lineas.push({
      cuentaCodigo: '1.1.04',
      cuentaNombre: `Clientes del Exterior / Exportación (${dte.razonSocialContraparte})`,
      debe: dte.montoTotal,
      haber: 0,
      rutAuxiliar: dte.rutContraparte,
      centroCosto: dte.centroCostoCodigo || dte.centroCostoNombre,
    });

    if (dte.items && dte.items.length > 0) {
      dte.items.forEach(it => {
        lineas.push({
          cuentaCodigo: it.cuentaCodigo || '4.1.03',
          cuentaNombre: it.cuentaNombre || `Exportación - ${it.nombre}`,
          debe: 0,
          haber: it.montoTotal,
          rutAuxiliar: dte.rutContraparte,
          centroCosto: it.centroCostoCodigo || it.centroCostoNombre || dte.centroCostoCodigo || dte.centroCostoNombre,
        });
      });
    } else {
      lineas.push({
        cuentaCodigo: '4.1.03',
        cuentaNombre: 'Ingresos por Exportaciones (Art. 12 Letra D DL 825)',
        debe: 0,
        haber: dte.montoTotal,
        rutAuxiliar: dte.rutContraparte,
        centroCosto: dte.centroCostoCodigo || dte.centroCostoNombre,
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
      rutAuxiliar: dte.rutContraparte,
      centroCosto: dte.centroCostoCodigo || dte.centroCostoNombre,
    });
    if (dte.tipoDte === '41' || (dte.montoExento > 0 && dte.montoIva === 0)) {
      if (dte.items && dte.items.length > 0) {
        dte.items.forEach(it => {
          lineas.push({
            cuentaCodigo: it.cuentaCodigo || '4.1.02',
            cuentaNombre: it.cuentaNombre || `Ingresos Boleta Exenta - ${it.nombre}`,
            debe: 0,
            haber: it.montoTotal,
            rutAuxiliar: dte.rutContraparte,
            centroCosto: it.centroCostoCodigo || it.centroCostoNombre || dte.centroCostoCodigo || dte.centroCostoNombre,
          });
        });
      } else {
        lineas.push({
          cuentaCodigo: '4.1.02',
          cuentaNombre: 'Ingresos por Ventas Exentas con Boleta',
          debe: 0,
          haber: dte.montoTotal,
          rutAuxiliar: dte.rutContraparte,
          centroCosto: dte.centroCostoCodigo || dte.centroCostoNombre,
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
            rutAuxiliar: dte.rutContraparte,
            centroCosto: it.centroCostoCodigo || it.centroCostoNombre || dte.centroCostoCodigo || dte.centroCostoNombre,
          });
        });
      } else if (dte.montoNeto > 0) {
        lineas.push({
          cuentaCodigo: '4.1.01',
          cuentaNombre: 'Ingresos por Ventas con Boleta Electrónica',
          debe: 0,
          haber: dte.montoNeto,
          rutAuxiliar: dte.rutContraparte,
          centroCosto: dte.centroCostoCodigo || dte.centroCostoNombre,
        });
      }
      if (dte.montoIva > 0) {
        lineas.push({
          cuentaCodigo: '2.1.03',
          cuentaNombre: 'IVA Débito Fiscal Boletas',
          debe: 0,
          haber: dte.montoIva,
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
      rutAuxiliar: dte.rutContraparte,
      centroCosto: dte.centroCostoCodigo || dte.centroCostoNombre,
    });

    if (dte.items && dte.items.length > 0) {
      dte.items.forEach(it => {
        lineas.push({
          cuentaCodigo: it.cuentaCodigo || '4.1.02',
          cuentaNombre: it.cuentaNombre || `Ingresos Servicios Exentos - ${it.nombre}`,
          debe: 0,
          haber: it.montoTotal,
          rutAuxiliar: dte.rutContraparte,
          centroCosto: it.centroCostoCodigo || it.centroCostoNombre || dte.centroCostoCodigo || dte.centroCostoNombre,
        });
      });
    } else {
      lineas.push({
        cuentaCodigo: '4.1.02',
        cuentaNombre: 'Ingresos por Servicios Exentos y No Afectos a IVA',
        debe: 0,
        haber: dte.montoExento || dte.montoTotal,
        rutAuxiliar: dte.rutContraparte,
        centroCosto: dte.centroCostoCodigo || dte.centroCostoNombre,
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
      rutAuxiliar: dte.rutContraparte,
      centroCosto: dte.centroCostoCodigo || dte.centroCostoNombre,
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
          rutAuxiliar: dte.rutContraparte,
          centroCosto: it.centroCostoCodigo || it.centroCostoNombre || dte.centroCostoCodigo || dte.centroCostoNombre,
        });
      });
    } else if (dte.partidasDesglosadas && dte.partidasDesglosadas.length > 0) {
      dte.partidasDesglosadas.forEach(p => {
        lineas.push({
          cuentaCodigo: p.cuentaCodigo || (dte.tipoDte === '56' ? '4.2.01' : '4.1.01'),
          cuentaNombre: p.cuentaNombre || `Venta - ${p.concepto}`,
          debe: 0,
          haber: (p.montoNeto || 0) + (p.montoExento || 0),
          rutAuxiliar: dte.rutContraparte,
          centroCosto: p.centroCostoCodigo || p.centroCostoNombre || dte.centroCostoCodigo || dte.centroCostoNombre,
        });
      });
    } else {
      if (dte.montoNeto > 0) {
        lineas.push({
          cuentaCodigo: dte.tipoDte === '56' ? '4.2.01' : '4.1.01',
          cuentaNombre: dte.tipoDte === '56' ? 'Otros Ingresos / Recargos ND Emitida' : 'Ingresos por Ventas Afectas a IVA',
          debe: 0,
          haber: dte.montoNeto,
          rutAuxiliar: dte.rutContraparte,
          centroCosto: dte.centroCostoCodigo || dte.centroCostoNombre,
        });
      }

      if (dte.montoExento > 0) {
        lineas.push({
          cuentaCodigo: '4.1.02',
          cuentaNombre: 'Ingresos por Servicios Exentos',
          debe: 0,
          haber: dte.montoExento,
          rutAuxiliar: dte.rutContraparte,
          centroCosto: dte.centroCostoCodigo || dte.centroCostoNombre,
        });
      }
    }

    if (dte.montoIva > 0) {
      lineas.push({
        cuentaCodigo: '2.1.03',
        cuentaNombre: 'IVA Débito Fiscal',
        debe: 0,
        haber: dte.montoIva,
      });
    }
  }

  const totalDebe = lineas.reduce((s, l) => s + l.debe, 0);
  const totalHaber = lineas.reduce((s, l) => s + l.haber, 0);

  const docTipoDesc = 
    dte.tipoDte === '34' ? 'Factura No Afecta o Exenta (DTE 34)' :
    dte.tipoDte === '61' ? 'Nota de Crédito (DTE 61)' :
    dte.tipoDte === '56' ? 'Nota de Débito (DTE 56)' :
    dte.tipoDte === '39' ? 'Boleta Electrónica (DTE 39)' :
    dte.tipoDte === '41' ? 'Boleta Exenta (DTE 41)' :
    dte.tipoDte === '110' ? 'Factura de Exportación (DTE 110)' :
    `Factura Electrónica (DTE ${dte.tipoDte})`;

  return {
    id: `entry-dte-sale-${dte.id}`,
    fecha: dte.fechaEmision,
    concepto: `Venta ${docTipoDesc} Folio ${dte.folio} - ${dte.razonSocialContraparte}`,
    documento: `${docTipoDesc} N° ${dte.folio}`,
    lineas,
    totalDebe,
    totalHaber,
    balanceado: totalDebe === totalHaber,
    origen: 'RCV_VENTA',
    creadoEn: new Date().toISOString(),
  };
}

/**
 * Generate Accounting Entry for Purchase Invoice DTE 33 / DTE 61
 */
export function createPurchaseDteEntry(dte: DteDocument): AccountingEntry {
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

  const lineas: AccountingEntryLine[] = [];

  // CASO NOTA DE CRÉDITO DE COMPRA (DTE 61 de Proveedor)
  if (dte.tipoDte === '61') {
    lineas.push({
      cuentaCodigo: '2.1.01',
      cuentaNombre: `Proveedores Nacionales (${dte.razonSocialContraparte})`,
      debe: dte.montoTotal,
      haber: 0,
    });

    if (dte.montoNeto > 0) {
      lineas.push({
        cuentaCodigo: '5.1.01',
        cuentaNombre: 'Costo de Ventas / Rebaja Compras por NC',
        debe: 0,
        haber: dte.montoNeto,
      });
    }

    if (dte.montoIva > 0) {
      lineas.push({
        cuentaCodigo: '1.1.05',
        cuentaNombre: 'IVA Crédito Fiscal (Rebaja por NC Recibida)',
        debe: 0,
        haber: dte.montoIva,
      });
    }

    if (dte.montoExento > 0) {
      lineas.push({
        cuentaCodigo: '5.2.10',
        cuentaNombre: 'Gastos Exentos / Rebaja por NC',
        debe: 0,
        haber: dte.montoExento,
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
          rutAuxiliar: dte.rutContraparte,
          centroCosto: it.centroCostoCodigo || it.centroCostoNombre || dte.centroCostoCodigo || dte.centroCostoNombre,
        });
      });
    } else if (dte.partidasDesglosadas && dte.partidasDesglosadas.length > 0) {
      dte.partidasDesglosadas.forEach(p => {
        lineas.push({
          cuentaCodigo: p.cuentaCodigo || '5.1.01',
          cuentaNombre: p.cuentaNombre || `Compra - ${p.concepto}`,
          debe: (p.montoNeto || 0) + (p.montoExento || 0),
          haber: 0,
          rutAuxiliar: dte.rutContraparte,
          centroCosto: p.centroCostoCodigo || p.centroCostoNombre || dte.centroCostoCodigo || dte.centroCostoNombre,
        });
      });
    } else {
      if (dte.montoExento > 0) {
        lineas.push({
          cuentaCodigo: '5.2.10',
          cuentaNombre: 'Gastos Exentos / Otros Servicios',
          debe: dte.montoExento,
          haber: 0,
          rutAuxiliar: dte.rutContraparte,
          centroCosto: dte.centroCostoCodigo || dte.centroCostoNombre,
        });
      }

      if (dte.montoNeto > 0) {
        lineas.push({
          cuentaCodigo: dte.cuentaCodigoAsignada || '5.1.01',
          cuentaNombre: dte.cuentaNombreAsignada || 'Costo de Ventas / Gastos Operacionales',
          debe: dte.montoNeto,
          haber: 0,
          rutAuxiliar: dte.rutContraparte,
          centroCosto: dte.centroCostoCodigo || dte.centroCostoNombre,
        });
      }
    }

    if (dte.montoIva > 0) {
      lineas.push({
        cuentaCodigo: '1.1.05',
        cuentaNombre: 'IVA Crédito Fiscal',
        debe: dte.montoIva,
        haber: 0,
      });
    }

    lineas.push({
      cuentaCodigo: '2.1.01',
      cuentaNombre: `Proveedores Nacionales (${dte.razonSocialContraparte})`,
      debe: 0,
      haber: dte.montoTotal,
      rutAuxiliar: dte.rutContraparte,
      centroCosto: dte.centroCostoCodigo || dte.centroCostoNombre,
    });
  }

  const totalDebe = lineas.reduce((s, l) => s + l.debe, 0);
  const totalHaber = lineas.reduce((s, l) => s + l.haber, 0);

  const docDesc = dte.tipoDte === '61' ? 'Nota de Crédito Proveedor (DTE 61)' : `Factura Proveedor (DTE ${dte.tipoDte})`;

  return {
    id: `entry-dte-purch-${dte.id}`,
    fecha: dte.fechaEmision,
    concepto: `Compra ${docDesc} Folio ${dte.folio} - ${dte.razonSocialContraparte}`,
    documento: `${docDesc} N° ${dte.folio}`,
    lineas,
    totalDebe,
    totalHaber,
    balanceado: totalDebe === totalHaber,
    origen: 'RCV_COMPRA',
    creadoEn: new Date().toISOString(),
  };
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

  const lineas: AccountingEntryLine[] = [
    {
      cuentaCodigo: '5.2.06',
      cuentaNombre: 'Gastos de Honorarios Profesionales',
      debe: bhe.montoTotal || 0,
      haber: 0,
    },
    {
      cuentaCodigo: '2.1.04',
      cuentaNombre: 'Retención Honorarios 2da Categoría por Pagar (F29)',
      debe: 0,
      haber: retencion,
    },
    {
      cuentaCodigo: '2.1.02',
      cuentaNombre: `Honorarios por Pagar (${bhe.razonSocialContraparte || 'Honorarios'})`,
      debe: 0,
      haber: liquidoPorPagar,
    },
  ];

  const totalDebe = lineas.reduce((s, l) => s + l.debe, 0);
  const totalHaber = lineas.reduce((s, l) => s + l.haber, 0);

  return {
    id: `entry-bhe-${bhe.id}`,
    fecha: bhe.fechaEmision,
    concepto: `Boleta de Honorarios N° ${bhe.folio} - ${bhe.razonSocialContraparte} (${((bhe.retencionTasa || 0.145) * 100).toFixed(2)}% Retención)`,
    documento: `BHE N° ${bhe.folio}`,
    lineas,
    totalDebe,
    totalHaber,
    balanceado: totalDebe === totalHaber,
    origen: 'HONORARIOS',
    creadoEn: new Date().toISOString(),
  };
}

/**
 * Generate Accounting Entry for Formulario 29 Declaration and Payment
 */
export function createF29PaymentEntry(f29: F29Declaration): AccountingEntry {
  const lineas: AccountingEntryLine[] = [];

  // Saldar IVA Débito Fiscal
  if (f29.debitoFiscalIva > 0) {
    lineas.push({
      cuentaCodigo: '2.1.03',
      cuentaNombre: 'IVA Débito Fiscal',
      debe: f29.debitoFiscalIva,
      haber: 0,
    });
  }

  // Saldar IVA Crédito Fiscal
  if (f29.creditoFiscalIva > 0) {
    lineas.push({
      cuentaCodigo: '1.1.05',
      cuentaNombre: 'IVA Crédito Fiscal',
      debe: 0,
      haber: Math.min(f29.creditoFiscalIva, f29.debitoFiscalIva),
    });
  }

  // Si hay nuevo remanente
  if (f29.nuevoRemanenteCredito > 0) {
    lineas.push({
      cuentaCodigo: '1.1.06',
      cuentaNombre: 'Remanente de Crédito Fiscal Mes Siguiente',
      debe: f29.nuevoRemanenteCredito,
      haber: 0,
    });
  }

  // PPM
  if (f29.montoPpm > 0) {
    lineas.push({
      cuentaCodigo: '1.1.07',
      cuentaNombre: 'PPM Pagos Provisorios Mensuales por Recuperar',
      debe: f29.montoPpm,
      haber: 0,
    });
  }

  // Retenciones 2da Cat
  if (f29.retencionHonorariosSegundaCat > 0) {
    lineas.push({
      cuentaCodigo: '2.1.04',
      cuentaNombre: 'Retención Honorarios 2da Categoría por Pagar (F29)',
      debe: f29.retencionHonorariosSegundaCat,
      haber: 0,
    });
  }

  // Retenciones Impuesto Único Sueldos
  if (f29.retencionImpuestoUnicoSueldos > 0) {
    lineas.push({
      cuentaCodigo: '2.1.05',
      cuentaNombre: 'Impuesto Único 2da Categoría por Pagar (F29)',
      debe: f29.retencionImpuestoUnicoSueldos,
      haber: 0,
    });
  }

  // Pago TGR Banco
  lineas.push({
    cuentaCodigo: '1.1.01',
    cuentaNombre: 'Banco Santander (Pago TGR Folio ' + (f29.folioTgr || 'F29') + ')',
    debe: 0,
    haber: f29.totalAPagar,
  });

  const totalDebe = lineas.reduce((s, l) => s + l.debe, 0);
  const totalHaber = lineas.reduce((s, l) => s + l.haber, 0);

  return {
    id: `entry-f29-${f29.id}`,
    fecha: f29.fechaPago || `${f29.periodo}-20`,
    concepto: `Declaración y Pago Formulario 29 Periodo ${f29.periodo} en Tesorería General de la República`,
    documento: `F29 Periodo ${f29.periodo} (Folio TGR ${f29.folioTgr || '1849204'})`,
    lineas,
    totalDebe,
    totalHaber,
    balanceado: Math.abs(totalDebe - totalHaber) < 1,
    origen: 'F29_TRIBUTARIO',
    creadoEn: new Date().toISOString(),
  };
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
  const codigoContrato = contract.codigoContrato || contract.id || 'ARR-01';
  const esIfrs16 = contract.tratamientoContable === 'IFRS_16' || contract.esIfrs16;

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
      },
      {
        cuentaCodigo: '5.2.09',
        cuentaNombre: 'Gastos Financieros por Arrendamiento (IFRS 16)',
        debe: fin,
        haber: 0,
      },
      {
        cuentaCodigo: '2.1.12',
        cuentaNombre: 'Pasivo por Arrendamiento (Disminución Principal)',
        debe: Math.max(0, pagoPrincipal),
        haber: 0,
      },
      {
        cuentaCodigo: '1.2.02',
        cuentaNombre: 'Depreciación Acumulada Activo Derecho de Uso',
        debe: 0,
        haber: amort,
      },
      {
        cuentaCodigo: '1.1.01',
        cuentaNombre: `Banco Santander (Pago Canon Mensual a ${arrendadorNombre})`,
        debe: 0,
        haber: canonCLP,
      },
    ];

    const totalDebe = lineas.reduce((s, l) => s + l.debe, 0);
    const totalHaber = lineas.reduce((s, l) => s + l.haber, 0);

    return {
      id: `entry-lease-${contract.id || Date.now()}`,
      fecha: new Date().toISOString().split('T')[0],
      concepto: `Reconocimiento Mensual IFRS 16 - ${nombreBien} (${arrendadorNombre})`,
      documento: `Contrato Arriendo N° ${codigoContrato}`,
      lineas,
      totalDebe,
      totalHaber,
      balanceado: Math.abs(totalDebe - totalHaber) < 2,
      origen: 'ARRIENDOS_IFRS16' as any,
      creadoEn: new Date().toISOString(),
    };
  } else {
    // Gasto simple mensual
    const lineas: AccountingEntryLine[] = [
      {
        cuentaCodigo: '5.2.07',
        cuentaNombre: `Gasto por Arriendo Comercial (${nombreBien})`,
        debe: canonCLP,
        haber: 0,
      },
      {
        cuentaCodigo: '1.1.01',
        cuentaNombre: `Banco Santander (Pago Arriendo a ${arrendadorNombre})`,
        debe: 0,
        haber: canonCLP,
      },
    ];

    return {
      id: `entry-lease-simple-${contract.id || Date.now()}`,
      fecha: new Date().toISOString().split('T')[0],
      concepto: `Pago Canon de Arriendo Mensual - ${nombreBien}`,
      documento: `Contrato Arriendo N° ${codigoContrato}`,
      lineas,
      totalDebe: canonCLP,
      totalHaber: canonCLP,
      balanceado: true,
      origen: 'ARRIENDOS_IFRS16' as any,
      creadoEn: new Date().toISOString(),
    };
  }
}

export const createLeaseIfrs16Entry = createLeaseEntry;
export const createSimpleLeaseExpenseEntry = (contract: any, indicators: ChileIndicators = DEFAULT_INDICATORS) => {
  return createLeaseEntry({ ...contract, tratamientoContable: 'GASTO_SIMPLE', esIfrs16: false }, indicators);
};

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
  const tc = movement.tipoCambio || (accountMoneda === 'EUR' ? 1042.80 : 955.20);
  const esExtranjera = accountMoneda !== 'CLP';

  const lineas: AccountingEntryLine[] = [];
  const fecha = movement.fecha;
  const doc = `Cartola Bancaria Ref: ${movement.numeroReferencia || movement.id}`;

  const montoNominal = movement.abono > 0 ? movement.abono : movement.cargo;
  const montoContableCLP = esExtranjera ? Math.round(montoNominal * tc) : Math.round(montoNominal);

  const monedaPrefijo = accountMoneda === 'USD' ? 'US$' : accountMoneda === 'EUR' ? '€' : '$';
  const glosaSufijo = esExtranjera ? ` [${monedaPrefijo}${montoNominal.toFixed(2)} @ $${tc} CLP/${accountMoneda}]` : '';

  const cuentaBancoCodigo = esExtranjera ? '1.1.02.003' : '1.1.01.001';
  const cuentaBancoNombre = esExtranjera 
    ? `${bancoNombre} Moneda Extranjera (${accountMoneda})`
    : `${bancoNombre} (Cta. Cte. M/N)`;

  if (movement.abono > 0) {
    // Abono recibido en la cuenta bancaria (Debe Banco / Haber Contrapartida)
    lineas.push({
      cuentaCodigo: cuentaBancoCodigo,
      cuentaNombre: cuentaBancoNombre,
      debe: montoContableCLP,
      haber: 0,
    });
    lineas.push({
      cuentaCodigo: movement.cuentaContableSugerida?.haberCodigo || '2.1.08',
      cuentaNombre: movement.cuentaContableSugerida?.haberNombre || 'Anticipos de Clientes / Partidas por Aplicar',
      debe: 0,
      haber: montoContableCLP,
    });
  } else {
    // Cargo debitado por el banco (Debe Gasto/Costo / Haber Banco)
    lineas.push({
      cuentaCodigo: movement.cuentaContableSugerida?.debeCodigo || '5.1.09',
      cuentaNombre: movement.cuentaContableSugerida?.debeNombre || 'Gastos y Comisiones Bancarias',
      debe: montoContableCLP,
      haber: 0,
    });
    lineas.push({
      cuentaCodigo: cuentaBancoCodigo,
      cuentaNombre: cuentaBancoNombre,
      debe: 0,
      haber: montoContableCLP,
    });
  }

  return {
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
  };
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
  const lineas: AccountingEntryLine[] = [
    {
      cuentaCodigo: '1.1.04.99',
      cuentaNombre: `Existencias en Tránsito (Guía DTE 52 N° ${transfer.folioGuiaDespacho52})`,
      debe: transfer.valorTotalTraslado,
      haber: 0,
    },
    {
      cuentaCodigo: '1.1.04.01',
      cuentaNombre: `Existencias - ${transfer.bodegaOrigenNombre}`,
      debe: 0,
      haber: transfer.valorTotalTraslado,
    }
  ];

  return {
    id: `entry-transfer-${transfer.id}-${Date.now()}`,
    fecha: transfer.fechaDespacho,
    concepto: `Traslado Interno sin Venta (SII Cód 5) desde ${transfer.bodegaOrigenNombre} hacia ${transfer.bodegaDestinoNombre}`,
    documento: `Guía de Despacho Electrónica (DTE 52) N° ${transfer.folioGuiaDespacho52}`,
    lineas,
    totalDebe: transfer.valorTotalTraslado,
    totalHaber: transfer.valorTotalTraslado,
    balanceado: true,
    origen: 'INVENTARIO',
    creadoEn: new Date().toISOString(),
  };
}

/**
 * Crea asiento contable por recepción definitiva en bodega destino
 * Debe: 1.1.04.02 Existencias Bodega Destino
 * Haber: 1.1.04.99 Existencias en Tránsito
 */
export function createWarehouseReceiptEntry(transfer: WarehouseTransfer): AccountingEntry {
  const lineas: AccountingEntryLine[] = [
    {
      cuentaCodigo: '1.1.04.02',
      cuentaNombre: `Existencias - ${transfer.bodegaDestinoNombre}`,
      debe: transfer.valorTotalTraslado,
      haber: 0,
    },
    {
      cuentaCodigo: '1.1.04.99',
      cuentaNombre: `Existencias en Tránsito (Guía DTE 52 N° ${transfer.folioGuiaDespacho52})`,
      debe: 0,
      haber: transfer.valorTotalTraslado,
    }
  ];

  return {
    id: `entry-receipt-${transfer.id}-${Date.now()}`,
    fecha: transfer.fechaRecepcionReal || new Date().toISOString().split('T')[0],
    concepto: `Recepción Conforme de Traslado Interno DTE 52 N° ${transfer.folioGuiaDespacho52} en ${transfer.bodegaDestinoNombre}`,
    documento: `Recepción Conforme DTE 52 N° ${transfer.folioGuiaDespacho52}`,
    lineas,
    totalDebe: transfer.valorTotalTraslado,
    totalHaber: transfer.valorTotalTraslado,
    balanceado: true,
    origen: 'INVENTARIO',
    creadoEn: new Date().toISOString(),
  };
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
    folioRequisicion: `REQ-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
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

  const lineas: AccountingEntryLine[] = [
    {
      cuentaCodigo: asset.cuentaContableActivo || '1.2.05',
      cuentaNombre: `${asset.nombre} (${asset.codigoPlaca})`,
      debe: neto,
      haber: 0,
      rutAuxiliar: asset.proveedorRut,
      centroCosto: asset.centroCostoCodigo || asset.centroCostoNombre || asset.ubicacionFisica,
    },
    {
      cuentaCodigo: '1.1.05',
      cuentaNombre: 'IVA Crédito Fiscal (Activo Fijo Art. 23 DL 825)',
      debe: iva,
      haber: 0,
    },
    {
      cuentaCodigo: '2.1.01',
      cuentaNombre: `Proveedores Nacionales (${asset.proveedorRazonSocial || 'Adquisición AF'})`,
      debe: 0,
      haber: total,
      rutAuxiliar: asset.proveedorRut,
      centroCosto: asset.centroCostoCodigo || asset.centroCostoNombre,
    },
  ];

  return {
    id: `entry-af-alta-${asset.id}-${Date.now()}`,
    fecha,
    concepto: `Alta Activo Fijo: ${asset.nombre} - Placa ${asset.codigoPlaca} (Folio DTE ${asset.folioDteCompra || 'S/F'})`,
    documento: `DTE 33 Folio ${asset.folioDteCompra || 'AF-ALTA'}`,
    lineas,
    totalDebe: total,
    totalHaber: total,
    balanceado: true,
    origen: 'ACTIVO_FIJO',
    creadoEn: new Date().toISOString(),
    supervisorSignature: `AF-AUTO-${asset.codigoPlaca}`,
  };
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
      });
    }

    if (cifRound > 0) {
      lineas.push({
        cuentaCodigo: '5.1.04',
        cuentaNombre: `CIF Depreciación Maquinaria Fabril - [${cc.codigo}]`,
        debe: cifRound,
        haber: 0,
        centroCosto: cc.codigo,
      });
    }
  });

  lineas.push({
    cuentaCodigo: '1.2.99',
    cuentaNombre: 'Depreciación Acumulada Activo Fijo (NIC 16)',
    debe: 0,
    haber: totalDepAcum,
  });

  return {
    id: `entry-af-dep-${periodo}-${Date.now()}`,
    fecha,
    concepto: `Depreciación Activo Fijo Período ${periodo} (${depreciaciones.length} activos procesados)`,
    documento: `Cuadro AF Periodo ${periodo}`,
    lineas,
    totalDebe: totalDepAcum,
    totalHaber: totalDepAcum,
    balanceado: true,
    origen: 'ACTIVO_FIJO',
    creadoEn: new Date().toISOString(),
    supervisorSignature: `DEP-AUTO-${periodo}`,
  };
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

  const lineas: AccountingEntryLine[] = [
    {
      cuentaCodigo: '1.2.05',
      cuentaNombre: 'Reajuste IPC Activo Fijo (Art. 41 N° 2 LIR)',
      debe: cmActivo,
      haber: 0,
    },
    {
      cuentaCodigo: '1.2.99',
      cuentaNombre: 'Reajuste IPC Depreciación Acumulada',
      debe: 0,
      haber: cmDep,
    },
    {
      cuentaCodigo: '6.1.01',
      cuentaNombre: 'Corrección Monetaria Ejercicio (Resultado Neto)',
      debe: efectoNeto < 0 ? Math.abs(efectoNeto) : 0,
      haber: efectoNeto > 0 ? efectoNeto : 0,
    },
  ];

  const total = Math.max(cmActivo, cmDep + Math.max(0, efectoNeto));

  return {
    id: `entry-af-cm-${periodo}-${Date.now()}`,
    fecha,
    concepto: `Corrección Monetaria IPC Activo Fijo y Dep. Acumulada Período ${periodo} (Art. 41 LIR)`,
    documento: `CM-IPC-${periodo}`,
    lineas,
    totalDebe: total,
    totalHaber: total,
    balanceado: true,
    origen: 'ACTIVO_FIJO',
    creadoEn: new Date().toISOString(),
  };
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

  const lineas: AccountingEntryLine[] = [];

  if (precio > 0) {
    lineas.push({
      cuentaCodigo: '1.1.03',
      cuentaNombre: `Clientes / Cuentas por Cobrar Venta AF (${asset.codigoPlaca})`,
      debe: totalCobrar,
      haber: 0,
      centroCosto: asset.centroCostoCodigo || asset.centroCostoNombre,
    });
  }

  lineas.push({
    cuentaCodigo: '1.2.99',
    cuentaNombre: 'Depreciación Acumulada Activo Fijo (Eliminación por Baja)',
    debe: depAcum,
    haber: 0,
    centroCosto: asset.centroCostoCodigo || asset.centroCostoNombre,
  });

  if (resultado < 0) {
    lineas.push({
      cuentaCodigo: '5.2.14',
      cuentaNombre: 'Pérdida en Retiro o Enajenación de Activo Fijo',
      debe: Math.abs(resultado),
      haber: 0,
      centroCosto: asset.centroCostoCodigo || asset.centroCostoNombre,
    });
  }

  lineas.push({
    cuentaCodigo: asset.cuentaContableActivo || '1.2.05',
    cuentaNombre: `${asset.nombre} (Baja de Costo Histórico)`,
    debe: 0,
    haber: costoHist,
    centroCosto: asset.centroCostoCodigo || asset.centroCostoNombre,
  });

  if (iva > 0) {
    lineas.push({
      cuentaCodigo: '2.1.03',
      cuentaNombre: 'IVA Débito Fiscal Venta Activo Fijo',
      debe: 0,
      haber: iva,
    });
  }

  if (resultado > 0) {
    lineas.push({
      cuentaCodigo: '4.1.04',
      cuentaNombre: 'Utilidad en Enajenación de Activo Fijo',
      debe: 0,
      haber: resultado,
      centroCosto: asset.centroCostoCodigo || asset.centroCostoNombre,
    });
  }

  const totalDebe = lineas.reduce((s, l) => s + l.debe, 0);
  const totalHaber = lineas.reduce((s, l) => s + l.haber, 0);

  return {
    id: `entry-af-baja-${asset.id}-${Date.now()}`,
    fecha,
    concepto: `Baja / Enajenación de Activo Fijo: ${asset.nombre} - Placa ${asset.codigoPlaca}`,
    documento: `Acta de Baja / Venta ${asset.codigoPlaca}`,
    lineas,
    totalDebe,
    totalHaber,
    balanceado: totalDebe === totalHaber,
    origen: 'ACTIVO_FIJO',
    creadoEn: new Date().toISOString(),
  };
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

  const lineas: AccountingEntryLine[] = [
    {
      cuentaCodigo: '1.1.08.02',
      cuentaNombre: `Existencias - Productos en Proceso (${op.folioOP}: ${op.productoNombre})`,
      debe: monto,
      haber: 0,
      centroCosto: op.folioOP,
    },
    {
      cuentaCodigo: '1.1.08.01',
      cuentaNombre: `Existencias - Materias Primas (${consumption.insumoNombre})`,
      debe: 0,
      haber: monto,
      centroCosto: consumption.bodegaOrigenNombre,
    },
  ];

  return {
    id: `entry-cost-mpd-${consumption.id}-${Date.now()}`,
    fecha,
    concepto: `Consumo MPD para ${op.folioOP}: ${consumption.cantidadConsumida} ${consumption.unidadMedida} de ${consumption.insumoNombre}`,
    documento: consumption.folioGuiaDespacho52 ? `Guía DTE 52 N° ${consumption.folioGuiaDespacho52}` : `Consumo Interno ${op.folioOP}`,
    lineas,
    totalDebe: monto,
    totalHaber: monto,
    balanceado: true,
    origen: 'COSTEO_PRODUCCION',
    creadoEn: new Date().toISOString(),
  };
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

  const lineas: AccountingEntryLine[] = [
    {
      cuentaCodigo: '1.1.08.02',
      cuentaNombre: `Existencias - Productos en Proceso (${op.folioOP})`,
      debe: monto,
      haber: 0,
      centroCosto: op.folioOP,
    },
    {
      cuentaCodigo: '5.1.03',
      cuentaNombre: `Mano de Obra Directa Fabril (${labor.etapaProceso})`,
      debe: 0,
      haber: monto,
      rutAuxiliar: labor.trabajadorRut,
    },
  ];

  return {
    id: `entry-cost-mod-${labor.id}-${Date.now()}`,
    fecha,
    concepto: `Imputación MOD a ${op.folioOP}: ${labor.horasTrabajadas} HH de ${labor.trabajadorNombre} en ${labor.etapaProceso}`,
    documento: `Parte Diario HH ${op.folioOP}`,
    lineas,
    totalDebe: monto,
    totalHaber: monto,
    balanceado: true,
    origen: 'COSTEO_PRODUCCION',
    creadoEn: new Date().toISOString(),
  };
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

  const lineas: AccountingEntryLine[] = [
    {
      cuentaCodigo: '1.1.08.02',
      cuentaNombre: `Existencias - Productos en Proceso (${op.folioOP})`,
      debe: monto,
      haber: 0,
      centroCosto: op.folioOP,
    },
    {
      cuentaCodigo: '5.1.05',
      cuentaNombre: `Costos Indirectos de Fabricación Aplicados (Base: ${op.baseProrrateoCif})`,
      debe: 0,
      haber: monto,
      centroCosto: 'PLANTA_PRODUCTIVA',
    },
  ];

  return {
    id: `entry-cost-cif-${op.id}-${Date.now()}`,
    fecha,
    concepto: `Aplicación de CIF a ${op.folioOP} (Base Prorrateo: ${op.baseProrrateoCif}, Tasa: ${op.tasaCifAplicada})`,
    documento: `Liquidación CIF ${op.folioOP}`,
    lineas,
    totalDebe: monto,
    totalHaber: monto,
    balanceado: true,
    origen: 'COSTEO_PRODUCCION',
    creadoEn: new Date().toISOString(),
  };
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

  const lineas: AccountingEntryLine[] = [
    {
      cuentaCodigo: '1.1.08.03',
      cuentaNombre: `Existencias - Productos Terminados (${op.productoNombre})`,
      debe: costoTotal,
      haber: 0,
      centroCosto: op.bodegaDestinoNombre || 'BODEGA_PRODUCTO_TERMINADO',
    },
    {
      cuentaCodigo: '1.1.08.02',
      cuentaNombre: `Existencias - Productos en Proceso (${op.folioOP})`,
      debe: 0,
      haber: costoTotal,
      centroCosto: op.folioOP,
    },
  ];

  return {
    id: `entry-cost-liq-${op.id}-${Date.now()}`,
    fecha,
    concepto: `Liquidación Producción Terminada ${op.folioOP}: ${op.cantidadProducidaReal} ${op.unidadMedida} de ${op.productoNombre} (Costo Unitario: $${Math.round(op.costoUnitarioReal)}/${op.unidadMedida})`,
    documento: `Cierre OP ${op.folioOP}`,
    lineas,
    totalDebe: costoTotal,
    totalHaber: costoTotal,
    balanceado: true,
    origen: 'COSTEO_PRODUCCION',
    creadoEn: new Date().toISOString(),
  };
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

  const lineas: AccountingEntryLine[] = [
    {
      cuentaCodigo: '5.1.01',
      cuentaNombre: `Costo de Ventas - Productos Manufacturados (${op.productoNombre})`,
      debe: costoTotalVendido,
      haber: 0,
      centroCosto: 'VENTAS_OPERACIONALES',
    },
    {
      cuentaCodigo: '1.1.08.03',
      cuentaNombre: `Existencias - Productos Terminados (${op.productoNombre})`,
      debe: 0,
      haber: costoTotalVendido,
    },
  ];

  return {
    id: `entry-cogs-${op.id}-${Date.now()}`,
    fecha,
    concepto: `Costo de Ventas (CMV) por entrega de ${cantidadVendida} ${op.unidadMedida} de ${op.productoNombre} (Factura DTE ${dteFolio || 'S/F'})`,
    documento: dteFolio ? `Factura DTE 33 N° ${dteFolio}` : `Despacho Venta ${op.folioOP}`,
    lineas,
    totalDebe: costoTotalVendido,
    totalHaber: costoTotalVendido,
    balanceado: true,
    origen: 'COSTEO_PRODUCCION',
    creadoEn: new Date().toISOString(),
  };
}



