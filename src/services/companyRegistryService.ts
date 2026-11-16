/**
 * Registro de empresas del servidor (cartera `clients` en la persistencia).
 *
 * Las empresas se identifican por id; varios módulos todavía envían el RUT como `empresaId`.
 * Este módulo resuelve ambos al mismo registro, para que el control de acceso, el plan de cuentas
 * y la administración comercial usen una sola identidad por empresa.
 *
 * Las empresas nuevas usan como id el RUT sin puntos (igual que el instalador), así el id y el RUT
 * coinciden al normalizar. Las empresas antiguas (`client-<timestamp>`) se resuelven por su RUT.
 */
import { diskPersistence } from './diskPersistenceService';

export function normalizeCompanyKey(idOrRut?: string): string {
  return String(idOrRut || '').replace(/[\.\-\s]/g, '').trim().toUpperCase();
}

/** Id canónico para una empresa nueva: RUT sin puntos, con guion y dígito verificador en mayúscula. */
export function canonicalCompanyIdFromRut(rut: string): string {
  return String(rut || '').replace(/\./g, '').replace(/\s/g, '').toUpperCase();
}

export function listCompanies(): any[] {
  return ((diskPersistence.getSnapshot() as any).clients || []) as any[];
}

/** Busca una empresa por id o por RUT (normalizados). */
export function findCompany(idOrRut?: string): any | null {
  const key = normalizeCompanyKey(idOrRut);
  if (!key) return null;
  const list = listCompanies();
  return (
    list.find((c) => normalizeCompanyKey(c.id) === key) ||
    list.find((c) => normalizeCompanyKey(c.rut) === key) ||
    null
  );
}

/** Todas las formas en que una empresa puede venir identificada (id y RUT, normalizados). */
export function companyKeys(idOrRut?: string): string[] {
  const c = findCompany(idOrRut);
  const keys = new Set<string>();
  if (idOrRut) keys.add(normalizeCompanyKey(idOrRut));
  if (c?.id) keys.add(normalizeCompanyKey(c.id));
  if (c?.rut) keys.add(normalizeCompanyKey(c.rut));
  return [...keys].filter(Boolean);
}

/** Id con que se guarda la información de la empresa: el id registrado, o el valor recibido si no está registrada. */
export function resolveCompanyId(idOrRut?: string): string {
  const c = findCompany(idOrRut);
  return c?.id || String(idOrRut || '').trim();
}

export function saveCompanies(list: any[]): void {
  diskPersistence.updateCollection('clients', list);
}
