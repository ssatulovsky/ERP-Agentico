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

/**
 * Persistencia segregada por empresa o cliente (Multi-Tenant Local Persistence)
 */
export function loadClientState<T>(clientId: string, entityKey: string, fallback: T): T {
  const compositeKey = `client_${clientId}_${entityKey}`;
  return loadPersistentState<T>(compositeKey, fallback);
}

export function saveClientState<T>(clientId: string, entityKey: string, data: T): void {
  const compositeKey = `client_${clientId}_${entityKey}`;
  savePersistentState<T>(compositeKey, data);

  // Sincronización en segundo plano con el servidor (Multi-Tenant & Multi-Usuario)
  if (typeof fetch !== 'undefined') {
    fetch('/api/accounting/client-state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ empresaId: clientId, key: entityKey, data }),
    }).catch(() => {});
  }
}

/**
 * Obtener estado de cliente actualizado desde el servidor (Multi-Tenant & Multi-Usuario)
 */
export async function fetchClientState<T>(clientId: string, entityKey: string, fallback: T): Promise<T> {
  if (typeof fetch !== 'undefined') {
    try {
      const res = await fetch(`/api/accounting/client-state?empresaId=${encodeURIComponent(clientId)}&key=${encodeURIComponent(entityKey)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data !== null && json.data !== undefined) {
          const compositeKey = `client_${clientId}_${entityKey}`;
          savePersistentState<T>(compositeKey, json.data as T);
          return json.data as T;
        }
      }
    } catch (err) {
      console.warn(`[StorageService] Error al obtener ${entityKey} del servidor:`, err);
    }
  }
  return loadClientState<T>(clientId, entityKey, fallback);
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

/**
 * Respaldo JSON completo de la base de datos local para exportación/importación
 */
export function exportAllErpData(): string {
  if (typeof window === 'undefined') return '{}';
  const dump: Record<string, any> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('remix_erp_')) {
      try {
        dump[k] = JSON.parse(localStorage.getItem(k) || 'null');
      } catch {
        dump[k] = localStorage.getItem(k);
      }
    }
  }
  return JSON.stringify(dump, null, 2);
}

export function importErpData(jsonString: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const dump = JSON.parse(jsonString);
    if (typeof dump !== 'object' || !dump) return false;
    Object.keys(dump).forEach(k => {
      if (k.startsWith('remix_erp_')) {
        localStorage.setItem(k, JSON.stringify(dump[k]));
      }
    });
    return true;
  } catch (err) {
    console.error('[StorageService] Error al importar base de datos:', err);
    return false;
  }
}

