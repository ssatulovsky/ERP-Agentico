/**
 * Obtiene la clave tributaria SII de una empresa desde el almacenamiento cifrado del servidor.
 * Nunca devuelve valores enmascarados (****) ni claves de ejemplo.
 */
import { diskPersistence } from './diskPersistenceService';
import { decryptFromVaultString, decryptVaultSecret } from '../utils/vaultCrypto';

export const isMaskedSecret = (value?: string | null) => !value || /^[\*•·]+$/.test(value.trim()) || value.includes('****');

export function resolveClaveSii(company: any | null, empresaIdOrRut: string): string | null {
  const fromCompany = company?.claveSii ? decryptFromVaultString(String(company.claveSii)) : '';
  if (fromCompany && !isMaskedSecret(fromCompany)) return fromCompany;

  const keys = [empresaIdOrRut, company?.id, company?.rut].filter(Boolean) as string[];
  for (const key of keys) {
    const entry = diskPersistence.getVaultEntry(key);
    if (!entry) continue;
    if (entry.claveSiiEncrypted && entry.iv && entry.tagAuth) {
      try {
        const plain = decryptVaultSecret(entry.claveSiiEncrypted, entry.iv, entry.tagAuth);
        if (plain && !isMaskedSecret(plain)) return plain;
      } catch {
        /* clave cifrada ilegible: se trata como inexistente */
      }
    }
    if (entry.claveSii) {
      const plain = decryptFromVaultString(String(entry.claveSii));
      if (plain && !isMaskedSecret(plain)) return plain;
    }
  }
  return null;
}
