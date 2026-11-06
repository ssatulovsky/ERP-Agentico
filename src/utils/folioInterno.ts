/**
 * Folios internos del ERP (presupuestos, recetas, RFQ, vales, requisiciones, centros de costo).
 * 4.4: reemplaza los folios con Math.random (no secuenciales y con riesgo de colisión).
 * Formato PREFIJO-AAAA-NNNN: correlativo según los folios existentes del mismo prefijo y año;
 * sin lista de existentes, se usa un correlativo por fecha y hora (no aleatorio).
 */
let contadorSesion = 0;

export function folioInterno(prefijo: string, existentes: Array<string | undefined | null> = []): string {
  const anio = new Date().getFullYear();
  const base = `${prefijo}-${anio}-`;
  const numeros = existentes
    .filter((f): f is string => typeof f === 'string' && f.startsWith(base))
    .map((f) => parseInt(f.slice(base.length), 10))
    .filter((n) => Number.isFinite(n));
  if (numeros.length > 0) {
    return `${base}${String(Math.max(...numeros) + 1).padStart(4, '0')}`;
  }
  if (existentes.length > 0 || prefijo === '') {
    return `${base}0001`;
  }
  const d = new Date();
  contadorSesion = (contadorSesion + 1) % 100;
  const sello = `${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}${String(contadorSesion).padStart(2, '0')}`;
  return `${base}${sello}`;
}
