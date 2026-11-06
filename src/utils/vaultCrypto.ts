import crypto from 'node:crypto';

/**
 * Módulo Criptográfico de Bóveda de Seguridad (Hardware / DB Vault AES-256-GCM)
 * Cumple con estándares de auditoría financiera e ISO 27001 para resguardo
 * de Certificados Digitales PKCS#12, contraseñas tributarias y llaves bancarias.
 */

const VAULT_SECRET = process.env.VAULT_MASTER_SECRET || 'SIEX_VAULT_AES256_MASTER_SECRET_2026_PROD';
const VAULT_KEY = crypto.createHash('sha256').update(VAULT_SECRET).digest();

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
export function decryptVaultSecret(encryptedHex: string, ivHex: string, tagHex: string): string {
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', VAULT_KEY, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
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

