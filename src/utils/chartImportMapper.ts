/**
 * K2.5 · Importación de planes de cuentas desde otros sistemas (Softland, CAME, Nubox, Defontana…).
 *
 * Funciones puras: convierten las filas de una planilla (CSV/XLSX ya leída) en cuentas del ERP según
 * una asignación de columnas. Nada se asume en silencio: si falta el tipo o la naturaleza y el usuario
 * no eligió inferirlos de forma explícita, la cuenta queda sin ese dato y la validación lo informa.
 *
 * Los perfiles por sistema son PRELIMINARES: solo proponen qué encabezados buscar. Se confirman con
 * archivos de muestra reales de cada sistema (pendientes al 16 nov 2026).
 */

export type ChartImportField = 'codigo' | 'nombre' | 'tipo' | 'naturaleza' | 'clasificacion' | 'imputable';

export interface ChartImportProfile {
  id: 'GENERICO' | 'SOFTLAND' | 'CAME' | 'NUBOX' | 'DEFONTANA';
  nombre: string;
  /** Encabezados que se buscan para cada campo (en minúsculas, sin tildes). */
  encabezados: Partial<Record<ChartImportField, string[]>>;
  confirmado: boolean;
}

const COMUNES: Partial<Record<ChartImportField, string[]>> = {
  codigo: ['codigo', 'cod', 'codigo cuenta', 'cuenta', 'n cuenta', 'numero cuenta', 'pccodi', 'cod cuenta'],
  nombre: ['nombre', 'descripcion', 'glosa', 'nombre cuenta', 'descripcion cuenta', 'pcdesc'],
  tipo: ['tipo', 'tipo cuenta', 'clase', 'clasificacion', 'categoria'],
  naturaleza: ['naturaleza', 'saldo', 'tipo saldo', 'deudora acreedora'],
  imputable: ['imputable', 'nivel imputable', 'acepta movimientos', 'movimiento', 'detalle'],
};

export const CHART_IMPORT_PROFILES: ChartImportProfile[] = [
  { id: 'GENERICO', nombre: 'Genérico (CSV o Excel)', encabezados: COMUNES, confirmado: true },
  { id: 'SOFTLAND', nombre: 'Softland (preliminar)', encabezados: COMUNES, confirmado: false },
  { id: 'CAME', nombre: 'CAME (preliminar)', encabezados: COMUNES, confirmado: false },
  { id: 'NUBOX', nombre: 'Nubox (preliminar)', encabezados: COMUNES, confirmado: false },
  { id: 'DEFONTANA', nombre: 'Defontana (preliminar)', encabezados: COMUNES, confirmado: false },
];

export function normalizeHeader(h: unknown): string {
  return String(h ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Primera fila que parece encabezado (tiene una columna de código y otra de nombre). */
export function detectHeaderRow(rows: unknown[][], profile: ChartImportProfile): number {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const norm = (rows[i] || []).map(normalizeHeader);
    const hasCode = norm.some((h) => (profile.encabezados.codigo || []).includes(h));
    const hasName = norm.some((h) => (profile.encabezados.nombre || []).includes(h));
    if (hasCode && hasName) return i;
  }
  return 0;
}

export function guessMapping(headers: unknown[], profile: ChartImportProfile): Partial<Record<ChartImportField, number>> {
  const norm = headers.map(normalizeHeader);
  const out: Partial<Record<ChartImportField, number>> = {};
  (Object.keys(profile.encabezados) as ChartImportField[]).forEach((field) => {
    const idx = norm.findIndex((h) => (profile.encabezados[field] || []).includes(h));
    if (idx >= 0) out[field] = idx;
  });
  return out;
}

export type CodeFormat =
  | { tipo: 'TAL_CUAL' }
  | { tipo: 'SEPARADOR'; separador: string }
  /** Códigos sin separadores: la máscara indica cuántos dígitos tiene cada nivel, p. ej. "1-1-2-3". */
  | { tipo: 'MASCARA'; mascara: string };

export function transformCode(raw: unknown, format: CodeFormat): string {
  const code = String(raw ?? '').trim();
  if (!code) return '';
  if (format.tipo === 'SEPARADOR') return code.split(format.separador).map((p) => p.trim()).filter(Boolean).join('.');
  if (format.tipo === 'MASCARA') {
    const digits = code.replace(/\D/g, '');
    const sizes = format.mascara.split(/[^0-9]+/).map(Number).filter((n) => n > 0);
    const parts: string[] = [];
    let pos = 0;
    for (const size of sizes) {
      if (pos >= digits.length) break;
      parts.push(digits.slice(pos, pos + size));
      pos += size;
    }
    if (pos < digits.length) parts.push(digits.slice(pos));
    return parts.join('.');
  }
  return code;
}

const TIPO_ALIASES: Array<[RegExp, string]> = [
  [/^(a|act|activo|activos)$/, 'ACTIVO'],
  [/^(p|pas|pasivo|pasivos)$/, 'PASIVO'],
  [/^(pat|patrimonio|capital)$/, 'PATRIMONIO'],
  [/^(i|ing|ingreso|ingresos|ganancia|ganancias|resultado ganancia)$/, 'INGRESO'],
  [/^(c|cos|costo|costos)$/, 'COSTO'],
  [/^(g|gas|gasto|gastos|perdida|perdidas|resultado perdida)$/, 'GASTO'],
];

export function parseTipo(raw: unknown): string | undefined {
  const v = normalizeHeader(raw);
  if (!v) return undefined;
  return TIPO_ALIASES.find(([re]) => re.test(v))?.[1];
}

export function parseNaturaleza(raw: unknown): string | undefined {
  const v = normalizeHeader(raw);
  if (!v) return undefined;
  if (/^(d|deudor|deudora|debe|db)$/.test(v)) return 'DEUDORA';
  if (/^(a|acreedor|acreedora|haber|cr)$/.test(v)) return 'ACREEDORA';
  return undefined;
}

export interface ChartImportOptions {
  mapping: Partial<Record<ChartImportField, number>>;
  headerRow: number;
  codeFormat: CodeFormat;
  /** Tipo por clase (primer dígito), solo si el usuario lo elige explícitamente. */
  tipoPorClase?: Record<string, string> | null;
  /** Naturaleza según el tipo (ACTIVO/COSTO/GASTO = DEUDORA; resto ACREEDORA), solo si el usuario lo elige. */
  inferirNaturaleza?: boolean;
  /** Importar solo filas marcadas como imputables (si existe la columna). */
  soloImputables?: boolean;
}

export interface ChartImportResult {
  cuentas: any[];
  equivalencias: Array<{ codigoExterno: string; codigo: string }>;
  omitidas: Array<{ fila: number; motivo: string }>;
}

export function mapRowsToAccounts(rows: unknown[][], opts: ChartImportOptions): ChartImportResult {
  const cuentas: any[] = [];
  const equivalencias: Array<{ codigoExterno: string; codigo: string }> = [];
  const omitidas: Array<{ fila: number; motivo: string }> = [];
  const col = (row: unknown[], f: ChartImportField) => (opts.mapping[f] === undefined ? undefined : row[opts.mapping[f] as number]);

  for (let i = opts.headerRow + 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const fila = i + 1;
    if (row.every((c) => String(c ?? '').trim() === '')) continue;
    const externo = String(col(row, 'codigo') ?? '').trim();
    const codigo = transformCode(externo, opts.codeFormat);
    const nombre = String(col(row, 'nombre') ?? '').trim();
    if (!codigo) {
      omitidas.push({ fila, motivo: 'Sin código' });
      continue;
    }
    if (opts.soloImputables && opts.mapping.imputable !== undefined) {
      const imp = normalizeHeader(col(row, 'imputable'));
      if (imp && !/^(s|si|1|true|x|yes|imputable)$/.test(imp)) {
        omitidas.push({ fila, motivo: 'No imputable (se importan solo las imputables)' });
        continue;
      }
    }
    const clase = codigo.split('.')[0];
    let tipo = parseTipo(col(row, 'tipo'));
    if (!tipo && opts.tipoPorClase) tipo = opts.tipoPorClase[clase];
    let naturaleza = parseNaturaleza(col(row, 'naturaleza'));
    if (!naturaleza && opts.inferirNaturaleza && tipo) {
      naturaleza = ['ACTIVO', 'COSTO', 'GASTO'].includes(tipo) ? 'DEUDORA' : 'ACREEDORA';
    }
    const clasificacionRaw = normalizeHeader(col(row, 'clasificacion')).toUpperCase().replace(/ /g, '_');
    cuentas.push({
      codigo,
      nombre,
      clase: Number(clase),
      ...(tipo ? { tipo } : {}),
      ...(naturaleza ? { naturaleza } : {}),
      ...(clasificacionRaw ? { clasificacion: clasificacionRaw } : {}),
      activa: true,
    });
    if (externo && externo !== codigo) equivalencias.push({ codigoExterno: externo, codigo });
  }
  return { cuentas, equivalencias, omitidas };
}

/** Convención chilena habitual; el usuario puede cambiarla antes de aplicarla (algunos sistemas usan 3 = pérdidas, 4 = ganancias). */
export const DEFAULT_TIPO_POR_CLASE: Record<string, string> = {
  '1': 'ACTIVO',
  '2': 'PASIVO',
  '3': 'PATRIMONIO',
  '4': 'INGRESO',
  '5': 'COSTO',
  '6': 'GASTO',
  '7': 'GASTO',
};
