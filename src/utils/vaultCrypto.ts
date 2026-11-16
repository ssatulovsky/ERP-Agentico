import crypto from 'node:crypto';

/**
 * Módulo Criptográfico de Bóveda de Seguridad (Hardware / DB Vault AES-256-GCM)
 * Cumple con estándares de auditoría financiera e ISO 27001 para resguardo
 * de Certificados Digitales PKCS#12, contraseñas tributarias y llaves bancarias.
 */

// Claves conocidas: la que venía fija en el código y la de ejemplo de .env.example. No protegen nada
// (cualquiera con el código puede descifrar), así que en producción no se aceptan. Se conservan
// solo para descifrar secretos antiguos y volver a cifrarlos con la clave real.
const LEGACY_PUBLIC_SECRETS = [
  'SIEX_VAULT_AES256_MASTER_SECRET_2026_PROD',
  '9f8b4c2d1e0a7e6f5d4c3b2a19807f6e5d4c3b2a10987e6d5c4b3a2f1e0d9c8b',
];
const VAULT_SECRET = process.env.VAULT_MASTER_SECRET || LEGACY_PUBLIC_SECRETS[0];
const VAULT_KEY = crypto.createHash('sha256').update(VAULT_SECRET).digest();
const LEGACY_KEYS = LEGACY_PUBLIC_SECRETS.filter((s) => s !== VAULT_SECRET).map((s) =>
  crypto.createHash('sha256').update(s).digest()
);

/**
 * K1.6: en producción la bóveda exige una clave maestra propia (VAULT_MASTER_SECRET, 32+ caracteres)
 * que no sea una de las claves públicas del repositorio. Sin ella el servidor no arranca.
 */
export function assertVaultSecretPolicy(env: NodeJS.ProcessEnv = process.env): void {
  if (String(env.NODE_ENV || '').toLowerCase() !== 'production') return;
  const secret = String(env.VAULT_MASTER_SECRET || '');
  if (!secret || secret.length < 32 || LEGACY_PUBLIC_SECRETS.includes(secret)) {
    throw new Error(
      'VAULT_MASTER_SECRET no está configurada o es una clave pública del repositorio. ' +
        'Genere una propia (por ejemplo: openssl rand -hex 32) y configúrela antes de arrancar en producción. ' +
        'Los secretos guardados con la clave anterior se siguen pudiendo leer y se vuelven a cifrar al guardarlos.'
    );
  }
}

export interface EncryptedVaultPayload {
  encrypted: string;
  iv: string;
  tag: string;
}

/**
 * Cifra un secreto (contraseña de certificado, clave tributaria SII, API key bancaria)
 * utilizando AES-256-GCM (Authenticated Encryption with Associated Data).
 */
export function encryptVaultSecret(plainText: string): EncryptedVaultPayload {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', VAULT_KEY, iv);
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return { encrypted, iv: iv.toString('hex'), tag };
}

/**
 * Descifra un secreto desde el vault validando el tag de integridad GCM
 */
function decryptWithKey(key: Buffer, encryptedHex: string, ivHex: string, tagHex: string): string {
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export function decryptVaultSecret(encryptedHex: string, ivHex: string, tagHex: string): string {
  try {
    return decryptWithKey(VAULT_KEY, encryptedHex, ivHex, tagHex);
  } catch (err) {
    // Secretos guardados antes de configurar la clave propia.
    for (const legacy of LEGACY_KEYS) {
      try {
        return decryptWithKey(legacy, encryptedHex, ivHex, tagHex);
      } catch {
        /* probar la siguiente */
      }
    }
    throw err;
  }
}

/** true si el valor ya es una cadena cifrada de la bóveda. */
export function isVaultString(value?: string | null): boolean {
  return typeof value === 'string' && value.startsWith('vault:v1:');
}

/**
 * Serializa y cifra un texto plano en una cadena compacta segura tipo vault:v1:<iv>:<tag>:<encrypted>
 */
export function encryptToVaultString(plainText: string): string {
  if (!plainText) return '';
  if (plainText.startsWith('vault:v1:')) return plainText;
  const { encrypted, iv, tag } = encryptVaultSecret(plainText);
  return `vault:v1:${iv}:${tag}:${encrypted}`;
}

/**
 * Descifra una cadena vault:v1:<iv>:<tag>:<encrypted> validando su integridad GCM
 */
export function decryptFromVaultString(vaultString: string): string {
  if (!vaultString) return '';
  if (!vaultString.startsWith('vault:v1:')) return vaultString;
  const parts = vaultString.split(':');
  if (parts.length !== 5) return vaultString;
  const [, , iv, tag, encrypted] = parts;
  try {
    return decryptVaultSecret(encrypted, iv, tag);
  } catch (err) {
    console.error('[VaultCrypto] Error descifrando secreto:', err);
    return '';
  }
}

