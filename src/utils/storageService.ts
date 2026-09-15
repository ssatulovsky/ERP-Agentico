/**
 * Servicio centralizado de persistencia local en almacenamiento seguro (localStorage)
 * Permite que los datos reales ingresados por el usuario persistan entre recargas
 * y elimina la necesidad de datos estáticos maqueteados (mocks).
 */

export function loadPersistentState<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(`remix_erp_${key}`);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed as T;
  } catch (err) {
    console.warn(`[StorageService] Error al cargar ${key} desde localStorage:`, err);
    return fallback;
  }
}

export function savePersistentState<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`remix_erp_${key}`, JSON.stringify(data));
  } catch (err) {
    console.error(`[StorageService] Error al guardar ${key} en localStorage:`, err);
  }
}

export function clearPersistentState(key?: string): void {
  if (typeof window === 'undefined') return;
  try {
    if (key) {
      localStorage.removeItem(`remix_erp_${key}`);
    } else {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('remix_erp_')) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    }
  } catch (err) {
    console.error('[StorageService] Error al limpiar localStorage:', err);
  }
}
