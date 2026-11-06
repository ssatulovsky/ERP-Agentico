/**
 * Etiqueta visible del modo de ejecución de cada respuesta del motor agéntico (tarea 2.9, hallazgo #5).
 */
import { isDemoModeEnabled } from '../config/demoMode';

export function executionModeLabel(
  executionMode?: string,
  opts: { success?: boolean; code?: string } = {}
): string {
  let base = executionMode === 'AUTONOMOUS_REACT_LOOP' ? 'IA + herramientas' : executionMode === 'DETERMINISTIC_COMPLIANCE_CORE' ? 'Reglas' : 'Modo desconocido';
  if (isDemoModeEnabled()) base = `Demostración · ${base}`;
  if (opts.success === false) base += ` · sin ejecución${opts.code ? ` (${opts.code})` : ''}`;
  return base;
}

/** Antepone la etiqueta al texto de la respuesta para que todas las pantallas la muestren. */
export function withExecutionModeTag(text: string, label: string): string {
  return `[Modo: ${label}] ${text || ''}`.trim();
}
