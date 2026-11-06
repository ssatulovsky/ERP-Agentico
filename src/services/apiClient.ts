/**
 * Cliente HTTP Centralizado y Gobernanza de Autenticación para ERPremIA
 * 
 * Gestiona de forma unificada la inyección de Bearer Token en el 100% de las peticiones
 * a endpoints protegidos `/api/*`, garantizando que ninguna llamada quede desprovista de autenticación.
 */

export const ERP_AUTH_TOKEN_KEY = 'erp_auth_token';
export const ERP_LEGACY_TOKEN_KEY = 'erpremia_auth_token';

/**
 * Obtiene el token de sesión autenticado activo desde localStorage
 */
export function getStoredAuthToken(): string | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }
  return (
    window.localStorage.getItem(ERP_AUTH_TOKEN_KEY) ||
    window.localStorage.getItem(ERP_LEGACY_TOKEN_KEY) ||
    null
  );
}

/**
 * Guarda el token de sesión en localStorage bajo las claves unificadas
 */
export function setStoredAuthToken(token: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  window.localStorage.setItem(ERP_AUTH_TOKEN_KEY, token);
  window.localStorage.setItem(ERP_LEGACY_TOKEN_KEY, token);
}

/**
 * Elimina el token de sesión en localStorage al cerrar sesión
 */
export function removeStoredAuthToken(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  window.localStorage.removeItem(ERP_AUTH_TOKEN_KEY);
  window.localStorage.removeItem(ERP_LEGACY_TOKEN_KEY);
}

/**
 * Rutas públicas exentas de inyección de Bearer token
 */
const EXEMPT_PUBLIC_PATHS = [
  '/api/auth/login',
  '/api/health',
  '/api/indicators',
];

/**
 * Envoltorio seguro para fetch que inyecta automáticamente el token Bearer
 */
export async function erpFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const token = getStoredAuthToken();
  const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.pathname : (input as Request).url;

  const isApiCall = urlStr.startsWith('/api') || urlStr.includes('/api/');
  const isExempt = EXEMPT_PUBLIC_PATHS.some(p => urlStr === p || urlStr.startsWith(p + '/'));

  const modifiedInit: RequestInit = { ...(init || {}) };
  const headers = new Headers(modifiedInit.headers || {});

  if (isApiCall && !isExempt && token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  modifiedInit.headers = headers;
  return window.fetch(input, modifiedInit);
}

/**
 * Instala un interceptor transparente en window.fetch para que TODAS las llamadas existentes
 * en el frontend (componentes, hooks, servicios) incluyan el Bearer Token automáticamente.
 */
let interceptorInstalled = false;

export function installGlobalFetchInterceptor(): void {
  if (typeof window === 'undefined' || interceptorInstalled) {
    return;
  }

  const originalFetch = window.fetch;

  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.pathname : (input as Request)?.url || '';
    const isApiCall = urlStr.startsWith('/api') || urlStr.includes('/api/');
    const isExempt = EXEMPT_PUBLIC_PATHS.some(p => urlStr === p || urlStr.startsWith(p + '/'));

    if (isApiCall && !isExempt) {
      const token = getStoredAuthToken();
      if (token) {
        let headers: Headers;
        if (init?.headers instanceof Headers) {
          headers = init.headers;
        } else if (Array.isArray(init?.headers)) {
          headers = new Headers(init.headers);
        } else if (typeof init?.headers === 'object' && init.headers !== null) {
          headers = new Headers(init.headers as Record<string, string>);
        } else {
          headers = new Headers();
        }

        if (!headers.has('Authorization')) {
          headers.set('Authorization', `Bearer ${token}`);
        }

        init = {
          ...(init || {}),
          headers,
        };
      }
    }

    const response = await originalFetch.call(window, input, init);

    // Detección de token expirado (401)
    if (response.status === 401 && isApiCall && !isExempt) {
      console.warn(`[apiClient] Acceso 401 detectado en ${urlStr}. Sesión expirada o no autorizada.`);
      window.dispatchEvent(new CustomEvent('erp:unauthorized', { detail: { url: urlStr } }));
    }

    return response;
  };

  interceptorInstalled = true;
  console.log('[apiClient] Interceptor global de autenticación Bearer instalado.');
}
