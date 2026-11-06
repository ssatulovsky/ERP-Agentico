/**
 * Sanitizador de Seguridad Criptográfica para Prompts y Contextos enviados a Modelos de IA
 * Garantiza que claves del SII, contraseñas, secretos, tokens y certificados nunca salgan al LLM.
 */

const FORBIDDEN_SECRET_PATTERNS = [
  'clavesii',
  'clavesiirepresentante',
  'clavetgr',
  'claveprevired',
  'password',
  'passwd',
  'secret',
  'token',
  'privatekey',
  'privkey',
  'certificadodigitalpassword',
  'rutcertificadopassword',
  'apikey',
  'geminiapikey',
  'supervisorkey',
  'authorization',
  'authheader',
  'passphrase',
];

/**
 * Sanitiza recursivamente cualquier estructura de datos eliminando o enmascarando secretos
 */
export function sanitizeContextForAi<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitizeContextForAi(item)) as unknown as T;
  }

  const sanitized: Record<string, any> = {};

  for (const [key, val] of Object.entries(data as Record<string, any>)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z]/g, '');

    const isSecret = FORBIDDEN_SECRET_PATTERNS.some(pat => normalizedKey.includes(pat));
    if (isSecret) {
      sanitized[key] = '[CONFIDENCIAL_REMOVIDO_POR_SEGURIDAD]';
      continue;
    }

    if (typeof val === 'string') {
      if (val.includes('BEGIN RSA PRIVATE KEY') || val.includes('BEGIN PRIVATE KEY') || val.startsWith('Bearer eyJ')) {
        sanitized[key] = '[LLAVE_PRIVADA_REMOVIDA_POR_SEGURIDAD]';
        continue;
      }
    }

    if (typeof val === 'object' && val !== null) {
      sanitized[key] = sanitizeContextForAi(val);
    } else {
      sanitized[key] = val;
    }
  }

  return sanitized as T;
}
