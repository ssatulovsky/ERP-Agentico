/**
 * Modo demostración (tarea 0.2 del plan de corrección).
 *
 * Regla: los datos semilla (DTEs, nóminas, cartolas, contratos, inventario, etc.)
 * SOLO se entregan cuando DEMO_MODE=true y la empresa es una de las empresas de ejemplo.
 * Cualquier otra empresa (en particular, todo cliente nuevo) parte sin datos transaccionales.
 *
 * - Servidor / pruebas: variable de entorno DEMO_MODE.
 * - Navegador: constante __ERP_DEMO_MODE__ inyectada por vite.config.ts desde DEMO_MODE.
 */

declare const __ERP_DEMO_MODE__: string | undefined;

/** Empresas de ejemplo incluidas en src/data/seedData.ts. */
export const DEMO_CLIENT_IDS: readonly string[] = [
  'client-innovagile',
  'client-retail-logistics',
  'client-retail-01',
  'client-minera-sur',
  'client-agro-valle',
];

/** RUT de las empresas de ejemplo (normalizados sin puntos ni guion). */
export const DEMO_CLIENT_RUTS: readonly string[] = ['777989014', '761045509', '772109805', '765432109', '965403201'];

export function isDemoModeEnabled(): boolean {
  try {
    if (typeof process !== 'undefined' && process?.env && typeof process.env.DEMO_MODE === 'string') {
      return process.env.DEMO_MODE.trim().toLowerCase() === 'true';
    }
  } catch {
    /* entorno sin process */
  }
  try {
    return typeof __ERP_DEMO_MODE__ !== 'undefined' && String(__ERP_DEMO_MODE__).trim().toLowerCase() === 'true';
  } catch {
    return false;
  }
}

const normalize = (value: string) => (value || '').replace(/[^0-9kK]/g, '').toUpperCase();

/** true solo si DEMO_MODE está activo y la empresa es de ejemplo. */
export function isDemoClient(client: string | { id?: string; rut?: string; isDemo?: boolean } | null | undefined): boolean {
  if (!isDemoModeEnabled() || !client) return false;
  if (typeof client === 'string') {
    return DEMO_CLIENT_IDS.includes(client) || DEMO_CLIENT_RUTS.includes(normalize(client));
  }
  if (client.isDemo === true) return true;
  if (client.id && DEMO_CLIENT_IDS.includes(client.id)) return true;
  return Boolean(client.rut && DEMO_CLIENT_RUTS.includes(normalize(client.rut)));
}

/**
 * Devuelve el dato semilla solo para empresas de ejemplo con DEMO_MODE activo; en otro caso, lista vacía.
 * Acepta una función para no construir la semilla cuando no corresponde.
 */
export function demoSeed<T>(
  client: Parameters<typeof isDemoClient>[0],
  seed: T[] | (() => T[])
): T[] {
  if (!isDemoClient(client)) return [];
  return typeof seed === 'function' ? (seed as () => T[])() : seed;
}
