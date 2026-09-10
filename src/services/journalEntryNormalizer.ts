import {
  type JournalEntry,
  type JournalEntryLine,
  type JournalEntryOrigin,
  type RawJournalEntryInput,
} from '../types/accountingEntryFormat.types';
import { STANDARD_ACCOUNT_PLAN, formatNumberCL } from '../utils/chileanAccounting';

// ============================================================================
// ERRORES ESTRUCTURADOS DE CONTABILIDAD Y LIBRO DIARIO
// ============================================================================

export class UnbalancedJournalEntryError extends Error {
  readonly code = 'UNBALANCED_JOURNAL_ENTRY';
  readonly timestamp: string;

  constructor(
    public readonly totalDebe: number,
    public readonly totalHaber: number,
    public readonly diferencia: number,
    public readonly glosaGeneral: string,
    public readonly lineasCount: number,
    public readonly details?: Record<string, any>
  ) {
    super(
      `Descuadre en Asiento de Libro Diario: Σ Debe ($${totalDebe.toLocaleString('es-CL', {
        minimumFractionDigits: 2,
      })}) no coincide con Σ Haber ($${totalHaber.toLocaleString('es-CL', {
        minimumFractionDigits: 2,
      })}). Diferencia absoluta: $${Math.abs(diferencia).toFixed(2)} CLP en "${glosaGeneral}".`
    );
    this.name = 'UnbalancedJournalEntryError';
    this.timestamp = new Date().toISOString();
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InvalidJournalEntryError extends Error {
  readonly code = 'INVALID_JOURNAL_ENTRY';
  readonly timestamp: string;

  constructor(message: string, public readonly details?: Record<string, any>) {
    super(message);
    this.name = 'InvalidJournalEntryError';
    this.timestamp = new Date().toISOString();
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ============================================================================
// DICCIONARIO DE MAPEADO INTELIGENTE DE CUENTAS CHILENAS COMUNES
// ============================================================================

const COMMON_ACCOUNT_MAPPINGS: Record<string, { codigo: string; nombre: string }> = {
  'caja': { codigo: '1.1.02', nombre: 'Caja Chica' },
  'banco': { codigo: '1.1.01', nombre: 'Banco Santander Moneda Nacional' },
  'banco santander': { codigo: '1.1.01', nombre: 'Banco Santander Moneda Nacional' },
  'banco de chile': { codigo: '1.1.01', nombre: 'Banco Santander Moneda Nacional' },
  'banco estado': { codigo: '1.1.01', nombre: 'Banco Santander Moneda Nacional' },
  'clientes': { codigo: '1.1.03', nombre: 'Clientes Nacionales (Cuentas por Cobrar)' },
  'clientes nacionales': { codigo: '1.1.03', nombre: 'Clientes Nacionales (Cuentas por Cobrar)' },
  'cuentas por cobrar': { codigo: '1.1.03', nombre: 'Clientes Nacionales (Cuentas por Cobrar)' },
  'iva credito fiscal': { codigo: '1.1.05', nombre: 'IVA Crédito Fiscal' },
  'iva credito': { codigo: '1.1.05', nombre: 'IVA Crédito Fiscal' },
  'credito fiscal': { codigo: '1.1.05', nombre: 'IVA Crédito Fiscal' },
  'remanente credito fiscal': { codigo: '1.1.06', nombre: 'Remanente de Crédito Fiscal' },
  'remanente credito fiscal (mes anterior)': { codigo: '1.1.06', nombre: 'Remanente de Crédito Fiscal' },
  'remanente credito fiscal (mes siguiente)': { codigo: '1.1.06', nombre: 'Remanente de Crédito Fiscal' },
  'ppm por recuperar': { codigo: '1.1.07', nombre: 'PPM Pagos Provisorios Mensuales por Recuperar' },
  'ppm por recuperar (activo)': { codigo: '1.1.07', nombre: 'PPM Pagos Provisorios Mensuales por Recuperar' },
  'mercaderias': { codigo: '1.1.08', nombre: 'Mercaderías / Existencias' },
  'existencias': { codigo: '1.1.08', nombre: 'Mercaderías / Existencias' },
  'inventario': { codigo: '1.1.08', nombre: 'Mercaderías / Existencias' },
  'activo fijo': { codigo: '1.2.03', nombre: 'Mobiliario e Instalaciones' },
  'proveedores': { codigo: '2.1.01', nombre: 'Proveedores Nacionales (Cuentas por Pagar)' },
  'proveedores nacionales': { codigo: '2.1.01', nombre: 'Proveedores Nacionales (Cuentas por Pagar)' },
  'cuentas por pagar': { codigo: '2.1.01', nombre: 'Proveedores Nacionales (Cuentas por Pagar)' },
  'honorarios por pagar': { codigo: '2.1.02', nombre: 'Honorarios por Pagar' },
  'iva debito fiscal': { codigo: '2.1.03', nombre: 'IVA Débito Fiscal' },
  'iva debito': { codigo: '2.1.03', nombre: 'IVA Débito Fiscal' },
  'debito fiscal': { codigo: '2.1.03', nombre: 'IVA Débito Fiscal' },
  'retencion honorarios por pagar': { codigo: '2.1.04', nombre: 'Retención Honorarios 2da Categoría por Pagar (F29)' },
  'retenciones honorarios por pagar': { codigo: '2.1.04', nombre: 'Retención Honorarios 2da Categoría por Pagar (F29)' },
  'impuesto unico por pagar': { codigo: '2.1.05', nombre: 'Impuesto Único de Segunda Categoría por Pagar (F29)' },
  'impuesto unico segunda categoria': { codigo: '2.1.05', nombre: 'Impuesto Único de Segunda Categoría por Pagar (F29)' },
  'ppm por pagar': { codigo: '2.1.06', nombre: 'PPM por Pagar (F29)' },
  'impuestos por pagar (f29 / tgr)': { codigo: '2.1.06', nombre: 'Impuestos por Pagar (F29 / TGR)' },
  'impuestos por pagar': { codigo: '2.1.06', nombre: 'Impuestos por Pagar (F29 / TGR)' },
  'sueldos liquidos por pagar': { codigo: '2.1.07', nombre: 'Sueldos Líquidos por Pagar' },
  'remuneraciones por pagar': { codigo: '2.1.07', nombre: 'Sueldos Líquidos por Pagar' },
  'instituciones previsionales (afp) por pagar': { codigo: '2.1.08', nombre: 'Instituciones Previsionales (AFP) por Pagar' },
  'leyes sociales por pagar (afp)': { codigo: '2.1.08', nombre: 'Instituciones Previsionales (AFP) por Pagar' },
  'salud (fonasa / isapres) por pagar': { codigo: '2.1.09', nombre: 'Salud (Fonasa / Isapres) por Pagar' },
  'leyes sociales por pagar (salud)': { codigo: '2.1.09', nombre: 'Salud (Fonasa / Isapres) por Pagar' },
  'afc seguro de cesantia por pagar': { codigo: '2.1.10', nombre: 'AFC Seguro de Cesantía por Pagar' },
  'leyes sociales por pagar (afc)': { codigo: '2.1.10', nombre: 'AFC Seguro de Cesantía por Pagar' },
  'mutual de seguridad / sis por pagar': { codigo: '2.1.11', nombre: 'Mutual de Seguridad / SIS por Pagar' },
  'leyes sociales por pagar (mutual/sis)': { codigo: '2.1.11', nombre: 'Mutual de Seguridad / SIS por Pagar' },
  'ingresos por ventas': { codigo: '4.1.01', nombre: 'Ingresos por Ventas Afectas a IVA' },
  'ventas afectas': { codigo: '4.1.01', nombre: 'Ingresos por Ventas Afectas a IVA' },
  'ventas exentas': { codigo: '4.1.02', nombre: 'Ingresos por Servicios Exentos' },
  'costo de ventas': { codigo: '5.1.01', nombre: 'Costo de Ventas / Mercaderías' },
  'sueldos y remuneraciones base': { codigo: '5.2.01', nombre: 'Sueldos y Remuneraciones Base' },
  'sueldos': { codigo: '5.2.01', nombre: 'Sueldos y Remuneraciones Base' },
  'gratificaciones legales': { codigo: '5.2.02', nombre: 'Gratificaciones Legales' },
  'horas extras': { codigo: '5.2.03', nombre: 'Horas Extras' },
  'aportes patronales': { codigo: '5.2.04', nombre: 'Aportes Patronales (SIS, Mutual, AFC Empleador)' },
  'asignaciones no imponibles': { codigo: '5.2.05', nombre: 'Asignaciones No Imponibles (Colación / Movilización)' },
  'honorarios profesionales': { codigo: '5.2.06', nombre: 'Gastos de Honorarios Profesionales' },
  'gasto iva no recuperable': { codigo: '5.2.12', nombre: 'Gasto IVA No Recuperable (Art. 23 DL 825)' },
  'gasto iva no recuperable (art. 23 dl 825)': { codigo: '5.2.12', nombre: 'Gasto IVA No Recuperable (Art. 23 DL 825)' },
  'iva no recuperable': { codigo: '5.2.12', nombre: 'Gasto IVA No Recuperable (Art. 23 DL 825)' },
};

/**
 * Normaliza un texto de nombre de cuenta para búsqueda
 */
function normalizeAccountKey(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .trim();
}

/**
 * Resuelve el código y nombre formal de una cuenta a partir de su nombre o código
 */
function resolveAccountMetadata(codigo?: string, nombre?: string): { codigo: string; nombre: string } {
  const cleanCodigo = (codigo || '').trim();
  const cleanNombre = (nombre || '').trim();

  // 1. Si ya tiene código válido, buscar si existe en el Plan Estándar
  if (cleanCodigo) {
    const foundInPlan = STANDARD_ACCOUNT_PLAN.find((p) => p.codigo === cleanCodigo);
    if (foundInPlan) {
      return {
        codigo: foundInPlan.codigo,
        nombre: cleanNombre || foundInPlan.nombre,
      };
    }
  }

  // 2. Si tiene nombre, buscar en diccionario de cuentas frecuentes
  if (cleanNombre) {
    const key = normalizeAccountKey(cleanNombre);
    if (COMMON_ACCOUNT_MAPPINGS[key]) {
      return {
        codigo: cleanCodigo || COMMON_ACCOUNT_MAPPINGS[key].codigo,
        nombre: cleanNombre || COMMON_ACCOUNT_MAPPINGS[key].nombre,
      };
    }

    // Búsqueda parcial en Plan Estándar
    const partialMatch = STANDARD_ACCOUNT_PLAN.find((p) =>
      normalizeAccountKey(p.nombre).includes(key) || key.includes(normalizeAccountKey(p.nombre))
    );
    if (partialMatch) {
      return {
        codigo: cleanCodigo || partialMatch.codigo,
        nombre: cleanNombre || partialMatch.nombre,
      };
    }
  }

  // 3. Fallback: código genérico de acuerdo a la primera palabra
  return {
    codigo: cleanCodigo || '9.9.99.99',
    nombre: cleanNombre || 'Cuenta No Clasificada',
  };
}

/**
 * Parsea un número de manera segura y limpia strings
 */
function parseSafeAmount(val: unknown): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') {
    return isNaN(val) || !isFinite(val) ? 0 : val;
  }
  const str = String(val).trim();
  if (!str) return 0;
  // Reemplazar separador de miles '.' y coma decimal ',' si corresponde
  const sanitized = str.replace(/\$/g, '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const parsed = parseFloat(sanitized);
  return isNaN(parsed) || !isFinite(parsed) ? 0 : parsed;
}

// ============================================================================
// FUNCIÓN PRINCIPAL: normalizeAndValidateJournalEntry
// ============================================================================

/**
 * Normaliza y valida un asiento contable de acuerdo a las reglas formales
 * del Código de Comercio chileno y las normas IFRS/NIIF:
 * 
 * 1. Sanitiza montos y elimina negativos (trasladando montos a la columna opuesta si se intentó una reversión informal).
 * 2. Ordena estrictamente en dos bloques canónicos:
 *    - Bloque 1: Cuentas cargadas (DEBE > 0, HABER = 0).
 *    - Bloque 2: Cuentas abonadas (HABER > 0, DEBE = 0).
 * 3. Asigna correlativos de línea secuenciales (1, 2, 3...).
 * 4. Calcula totalDebe, totalHaber y diferencia con precisión de centavos.
 * 5. Valida la partida doble estricta (diferencia == 0.00). Si no cuadra, arroja UnbalancedJournalEntryError.
 */
export function normalizeAndValidateJournalEntry(
  rawEntry: Partial<JournalEntry> | RawJournalEntryInput
): JournalEntry {
  if (!rawEntry) {
    throw new InvalidJournalEntryError('El asiento contable no puede ser nulo o indefinido.');
  }

  const rawLines = rawEntry.lineas || [];
  if (!Array.isArray(rawLines) || rawLines.length < 2) {
    throw new InvalidJournalEntryError(
      `Un asiento de Libro Diario debe contener al menos 2 líneas de partida doble. Recibidas: ${rawLines.length}`
    );
  }

  const glosaGeneral = (rawEntry.glosaGeneral || 'Asiento contable de operaciones').trim();
  const fecha = (rawEntry.fecha || new Date().toISOString().split('T')[0]).trim();
  const periodo = rawEntry.periodo || fecha.slice(0, 7);
  const empresaId = (rawEntry.empresaId || '76.892.410-K').trim().toUpperCase();
  const origenModulo = (rawEntry.origenModulo || 'MANUAL') as JournalEntryOrigin;
  const documentoRef = rawEntry.documentoRef ? String(rawEntry.documentoRef).trim() : null;
  const creadoPorAgente = (rawEntry.creadoPorAgente || 'Agente Contable Senior').trim();

  // Sanitización y normalización preliminar de líneas
  interface SanitizedLine {
    codigoCuenta: string;
    nombreCuenta: string;
    rutAuxiliar: string | null;
    centroCosto: string | null;
    glosaDetalle: string | null;
    debe: number;
    haber: number;
  }

  const debits: SanitizedLine[] = [];
  const credits: SanitizedLine[] = [];

  for (const rawLine of rawLines) {
    let rawDebe = parseSafeAmount(rawLine.debe);
    let rawHaber = parseSafeAmount(rawLine.haber);

    // Resolución de nombres y códigos
    const accountName = rawLine.nombreCuenta || (rawLine as any).cuenta || (rawLine as any).cuentaNombre || '';
    const { codigo, nombre } = resolveAccountMetadata(rawLine.codigoCuenta, accountName);

    // Tratamiento de números negativos (regla de no negatividad)
    // Si debe < 0, se pasa a haber como positivo
    if (rawDebe < 0) {
      rawHaber += Math.abs(rawDebe);
      rawDebe = 0;
    }
    // Si haber < 0, se pasa a debe como positivo
    if (rawHaber < 0) {
      rawDebe += Math.abs(rawHaber);
      rawHaber = 0;
    }

    // Redondear a centavos (2 decimales)
    let finalDebe = Math.round(rawDebe * 100) / 100;
    let finalHaber = Math.round(rawHaber * 100) / 100;

    // Si tiene ambos montos mayores a 0, netear la línea para que sea puramente DEBE o puramente HABER
    if (finalDebe > 0 && finalHaber > 0) {
      if (finalDebe > finalHaber) {
        finalDebe = Math.round((finalDebe - finalHaber) * 100) / 100;
        finalHaber = 0;
      } else if (finalHaber > finalDebe) {
        finalHaber = Math.round((finalHaber - finalDebe) * 100) / 100;
        finalDebe = 0;
      } else {
        // Se cancelan mutuamente; omitir línea nula
        continue;
      }
    }

    // Omitir líneas con montos en 0
    if (finalDebe === 0 && finalHaber === 0) {
      continue;
    }

    const rutAuxiliar = rawLine.rutAuxiliar ? String(rawLine.rutAuxiliar).trim() : null;
    const centroCosto = rawLine.centroCosto ? String(rawLine.centroCosto).trim() : null;
    const glosaDetalle = rawLine.glosaDetalle ? String(rawLine.glosaDetalle).trim() : null;

    const lineData: SanitizedLine = {
      codigoCuenta: codigo,
      nombreCuenta: nombre,
      rutAuxiliar,
      centroCosto,
      glosaDetalle,
      debe: finalDebe,
      haber: finalHaber,
    };

    if (finalDebe > 0) {
      debits.push(lineData);
    } else {
      credits.push(lineData);
    }
  }

  // Ordenamiento canónico:
  // Bloque 1: Cuentas cargadas (DEBE), ordenadas por código de cuenta ascendente
  debits.sort((a, b) => a.codigoCuenta.localeCompare(b.codigoCuenta));

  // Bloque 2: Cuentas abonadas (HABER), ordenadas por código de cuenta ascendente
  credits.sort((a, b) => a.codigoCuenta.localeCompare(b.codigoCuenta));

  const allOrderedLines: JournalEntryLine[] = [];
  let currentLineIndex = 1;

  for (const deb of debits) {
    allOrderedLines.push({
      linea: currentLineIndex++,
      codigoCuenta: deb.codigoCuenta,
      nombreCuenta: deb.nombreCuenta,
      rutAuxiliar: deb.rutAuxiliar,
      centroCosto: deb.centroCosto,
      glosaDetalle: deb.glosaDetalle,
      debe: deb.debe,
      haber: 0,
    });
  }

  for (const cred of credits) {
    allOrderedLines.push({
      linea: currentLineIndex++,
      codigoCuenta: cred.codigoCuenta,
      nombreCuenta: cred.nombreCuenta,
      rutAuxiliar: cred.rutAuxiliar,
      centroCosto: cred.centroCosto,
      glosaDetalle: cred.glosaDetalle,
      debe: 0,
      haber: cred.haber,
    });
  }

  if (allOrderedLines.length < 2) {
    throw new InvalidJournalEntryError(
      `El asiento no contiene suficientes líneas activas con montos válidos tras sanitización (mínimo 2).`
    );
  }

  // Cálculo de sumas iguales
  const totalDebe = Math.round(allOrderedLines.reduce((acc, l) => acc + l.debe, 0) * 100) / 100;
  const totalHaber = Math.round(allOrderedLines.reduce((acc, l) => acc + l.haber, 0) * 100) / 100;
  const diferencia = Math.round((totalDebe - totalHaber) * 100) / 100;

  // Verificación estricta de partida doble
  if (Math.abs(diferencia) > 0.001) {
    throw new UnbalancedJournalEntryError(
      totalDebe,
      totalHaber,
      diferencia,
      glosaGeneral,
      allOrderedLines.length,
      {
        empresaId,
        periodo,
        origenModulo,
        lineas: allOrderedLines,
      }
    );
  }

  const normalized: JournalEntry = {
    id: rawEntry.id || `entry-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    folio: rawEntry.folio || undefined,
    empresaId,
    periodo,
    fecha,
    glosaGeneral,
    documentoRef,
    origenModulo,
    lineas: allOrderedLines,
    totalDebe,
    totalHaber,
    diferencia: 0.0,
    creadoPorAgente,
    supervisorSignature: rawEntry.supervisorSignature || undefined,
    timestamp: new Date().toISOString(),
  };

  return normalized;
}

// ============================================================================
// FORMATEADOR DE TEXTO PLANO / ASCII: formatJournalEntryToTextTable
// ============================================================================

/**
 * Genera una representación en texto plano / ASCII formateada como un folio
 * del Libro Diario tradicional chileno:
 * 
 * - Encabezado con Fecha, Folio, Origen, Documento Ref y Glosa General.
 * - Columnas: [Lín] | [Código] | [Cuenta / Glosa] | [RUT Aux] | [DEBE ($)] | [HABER ($)]
 * - Cuentas del Haber indentadas con prefijo formal "a " (según usanza de contadores auditores).
 * - Pie con Sumas Iguales y sello [PARTIDA DOBLE CUADRADA].
 */
export function formatJournalEntryToTextTable(entry: JournalEntry): string {
  const lineSeparator = '='.repeat(88);
  const thinSeparator = '-'.repeat(88);

  const folioText = entry.folio ? `FOLIO N°: ${entry.folio}` : 'COMPROBANTE CONTABLE';
  const docRefText = entry.documentoRef ? `DOC. RESPALDO: ${entry.documentoRef}` : '';

  const header = [
    lineSeparator,
    `LIBRO DIARIO CANÓNICO (IFRS / CÓDIGO DE COMERCIO CHILE) - ${folioText}`,
    thinSeparator,
    `EMPRESA RUT : ${entry.empresaId.padEnd(20, ' ')} PERÍODO : ${entry.periodo}`,
    `FECHA REG.  : ${entry.fecha.padEnd(20, ' ')} MÓDULO  : ${entry.origenModulo}`,
    `GLOSA GRAL. : ${entry.glosaGeneral}`,
    docRefText ? `${docRefText}` : '',
    thinSeparator,
    `LÍN | CÓDIGO    | CUENTA CONTABLE / DESCRIPCIÓN         | AUXILIAR    |    DEBE ($) |   HABER ($) `,
    thinSeparator,
  ].filter(Boolean).join('\n');

  const rows = entry.lineas.map((line) => {
    const lPad = String(line.linea).padStart(3, ' ');
    const codPad = line.codigoCuenta.padEnd(9, ' ');
    
    // Cuentas del Haber van indentadas y con prefijo "a "
    let accountName = line.nombreCuenta;
    if (line.haber > 0) {
      accountName = `  a ${accountName}`;
    }
    const namePad = (accountName.length > 37 ? accountName.slice(0, 34) + '...' : accountName).padEnd(37, ' ');
    
    const aux = line.rutAuxiliar ? (line.rutAuxiliar.length > 11 ? line.rutAuxiliar.slice(0, 11) : line.rutAuxiliar) : '';
    const auxPad = aux.padEnd(11, ' ');

    const debePad = line.debe > 0 ? formatNumberCL(line.debe).padStart(12, ' ') : ''.padStart(12, ' ');
    const haberPad = line.haber > 0 ? formatNumberCL(line.haber).padStart(12, ' ') : ''.padStart(12, ' ');

    return `${lPad} | ${codPad} | ${namePad} | ${auxPad} |${debePad} |${haberPad} `;
  });

  const totalDebeStr = formatNumberCL(entry.totalDebe).padStart(12, ' ');
  const totalHaberStr = formatNumberCL(entry.totalHaber).padStart(12, ' ');

  const footer = [
    thinSeparator,
    `SUMAS IGUALES (PARTIDA DOBLE STRICT)                       |${totalDebeStr} |${totalHaberStr} `,
    lineSeparator,
    `ESTADO: [CUADRADO - DIFERENCIA: $ 0.00] | CERTIFICADO POR: ${entry.creadoPorAgente}`,
    entry.supervisorSignature ? `FIRMA SUPERVISOR HMAC-SHA256: ${entry.supervisorSignature}` : '',
    lineSeparator,
  ].filter(Boolean).join('\n');

  return `${header}\n${rows.join('\n')}\n${footer}`;
}
