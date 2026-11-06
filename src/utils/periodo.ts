/**
 * Períodos tributarios AAAA-MM (tarea 2.3, hallazgo #8).
 * La UI propone el mes en curso (zona horaria de Chile) y el usuario puede cambiarlo;
 * las herramientas y endpoints exigen el período explícito.
 */
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export const PERIODO_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

export function esPeriodoValido(periodo: unknown): periodo is string {
  return typeof periodo === 'string' && PERIODO_REGEX.test(periodo.trim());
}

/** Mes en curso en America/Santiago, formato AAAA-MM. */
export function periodoActual(fecha: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit' }).formatToParts(fecha);
    const y = parts.find((p) => p.type === 'year')?.value;
    const m = parts.find((p) => p.type === 'month')?.value;
    if (y && m) return `${y}-${m}`;
  } catch {
    /* Intl sin zona horaria: se usa la hora local */
  }
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
}

export function etiquetaPeriodo(periodo: string): string {
  if (!esPeriodoValido(periodo)) return periodo;
  const [y, m] = periodo.split('-');
  return `${MESES[Number(m) - 1]} ${y}`;
}

/** Últimos n períodos desde el mes en curso (incluido), del más reciente al más antiguo. */
export function ultimosPeriodos(n = 12, desde: string = periodoActual()): string[] {
  const [y0, m0] = desde.split('-').map(Number);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const total = y0 * 12 + (m0 - 1) - i;
    out.push(`${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`);
  }
  return out;
}

/** Describe los períodos presentes en una lista de documentos (para títulos de informes). */
export function describirPeriodos(items: Array<{ periodo?: string; fechaEmision?: string }>): string {
  const set = new Set<string>();
  for (const it of items || []) {
    const p = it?.periodo || (it?.fechaEmision ? String(it.fechaEmision).slice(0, 7) : '');
    if (esPeriodoValido(p)) set.add(p);
  }
  const list = Array.from(set).sort();
  if (list.length === 0) return 'Sin período';
  return list.length === 1 ? list[0] : `${list[0]} a ${list[list.length - 1]}`;
}
