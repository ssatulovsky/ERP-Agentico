/**
 * Resultado honesto de una conciliación bancaria (tarea 2.6, hallazgo #7).
 * "100% cuadrado" solo si no quedan movimientos pendientes ni ambiguos y la diferencia
 * entre el saldo de la cartola y el saldo del libro mayor de la cuenta es $0.
 */
import type { AccountingEntry, BankStatementMovement } from '../types';

export interface ReconciliationCounts {
  conciliados: number;
  ambiguos: number;
  pendientes: number;
  /** Saldo cartola - saldo libro mayor; null si no se puede determinar (cuenta contable sin asociar). */
  diferenciaSaldo: number | null;
}

/** Saldo del libro mayor (debe - haber) de una cuenta contable; null si la cuenta no está definida. */
export function saldoLibroMayorCuenta(entries: AccountingEntry[], cuentaContable?: string): number | null {
  if (!cuentaContable) return null;
  let saldo = 0;
  for (const e of entries || []) {
    for (const l of e.lineas || []) {
      if (l.cuentaCodigo === cuentaContable) saldo += (Number(l.debe) || 0) - (Number(l.haber) || 0);
    }
  }
  return Math.round(saldo);
}

export function contarResultadoConciliacion(
  movimientos: BankStatementMovement[],
  saldoCartola: number | null,
  saldoLibro: number | null
): ReconciliationCounts {
  const conciliados = movimientos.filter((m) => m.estado === 'CONCILIADO').length;
  const ambiguos = movimientos.filter((m) => m.estado !== 'CONCILIADO' && (m as any).esAmbiguo).length;
  const pendientes = movimientos.filter((m) => m.estado !== 'CONCILIADO' && !(m as any).esAmbiguo).length;
  const diferenciaSaldo = saldoCartola === null || saldoLibro === null ? null : Math.round(saldoCartola - saldoLibro);
  return { conciliados, ambiguos, pendientes, diferenciaSaldo };
}

const clp = (n: number) => `$${Math.abs(n).toLocaleString('es-CL')}`;

export function mensajeResultadoConciliacion(banco: string, r: ReconciliationCounts): { texto: string; cuadrado: boolean } {
  const cuadrado = r.pendientes === 0 && r.ambiguos === 0 && r.diferenciaSaldo === 0;
  if (cuadrado) {
    return { texto: `Conciliación completa: ${r.conciliados} movimientos conciliados. El banco ${banco} está 100% cuadrado (diferencia $0).`, cuadrado };
  }
  const partes = [`${r.conciliados} conciliados`, `${r.ambiguos} ambiguos (requieren revisión del contador)`, `${r.pendientes} pendientes`];
  const dif =
    r.diferenciaSaldo === null
      ? 'No se pudo comparar con el libro mayor: la cuenta bancaria no tiene cuenta contable asociada.'
      : r.diferenciaSaldo === 0
      ? 'Saldo cartola y libro mayor sin diferencia.'
      : `Diferencia cartola vs. libro mayor: ${r.diferenciaSaldo > 0 ? '+' : '-'}${clp(r.diferenciaSaldo)}.`;
  return { texto: `Conciliación ${banco}: ${partes.join(', ')}. ${dif}`, cuadrado };
}
