import { INITIAL_CLIENT_AUXILIARIES } from '../data/erpMasterConfig';
import { loadClientState, saveClientState } from './storageService';

export interface CompanyAuxiliaryItem {
  id?: string;
  rut: string;
  rutCompleto?: string;
  codigoAuxiliar?: string;
  razonSocial: string;
  nombreFantasia?: string;
  tipo?: 'CLIENTE' | 'PROVEEDOR' | 'AMBOS' | 'HONORARIO' | 'HONORARIOS' | 'EMPLEADO';
  tipoAuxiliar?: string;
  giroComercial?: string;
  inactivo?: boolean;
  telefonoPrincipal?: string;
  emailContacto?: string;
  nombreContacto?: string;
  emailDte?: string;
  direccion?: string;
  region?: string;
  ciudad?: string;
  comuna?: string;
  limiteCredito?: number;
  terminosPago?: string;
  vendedor?: string;
  descuentoPorcentaje?: number;
  sucursales?: any[];
}

function normalizeRutKey(r?: string): string {
  if (!r) return '';
  return r.replace(/[\.\-\s]/g, '').toUpperCase();
}

/**
 * Carga síncrona inmediata desde localStorage (fallback y caché rápido local)
 */
export function loadCompanyAuxiliaries(empresaRut: string): CompanyAuxiliaryItem[] {
  const cached = loadClientState<CompanyAuxiliaryItem[]>(empresaRut, 'customAuxiliaries', []);
  const map = new Map<string, CompanyAuxiliaryItem>();

  // Semilla base oficial
  INITIAL_CLIENT_AUXILIARIES.forEach((a) => {
    const key = normalizeRutKey(a.rutCompleto);
    if (key) {
      map.set(key, {
        id: a.id,
        rut: a.rutCompleto,
        rutCompleto: a.rutCompleto,
        codigoAuxiliar: a.codigoAuxiliar,
        razonSocial: a.razonSocial,
        nombreFantasia: a.nombreFantasia,
        tipo: a.tipoAuxiliar as any,
        tipoAuxiliar: a.tipoAuxiliar,
        giroComercial: a.giroComercial,
        inactivo: a.inactivo,
        telefonoPrincipal: a.telefonoPrincipal,
        emailContacto: a.emailContacto,
        nombreContacto: a.nombreContacto,
        emailDte: a.emailDte,
        direccion: a.direccion,
        region: a.region,
        ciudad: a.ciudad,
        comuna: a.comuna,
        limiteCredito: a.limiteCredito,
        terminosPago: a.terminosPago,
        vendedor: a.vendedor,
        descuentoPorcentaje: a.descuentoPorcentaje,
        sucursales: a.sucursales,
      });
    }
  });

  // Enriquecer con los auxiliares almacenados
  cached.forEach((c) => {
    const key = normalizeRutKey(c.rut || c.rutCompleto);
    if (key) {
      map.set(key, {
        ...map.get(key),
        ...c,
        rut: c.rut || c.rutCompleto || key,
        razonSocial: c.razonSocial || map.get(key)?.razonSocial || key,
      });
    }
  });

  return Array.from(map.values());
}

/**
 * Obtener Auxiliares actualizados desde el Servidor / Base de Datos MySQL
 */
export async function fetchCompanyAuxiliaries(empresaRut: string): Promise<CompanyAuxiliaryItem[]> {
  try {
    const res = await fetch(`/api/accounting/auxiliaries?empresaId=${encodeURIComponent(empresaRut)}`);
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        const mapped: CompanyAuxiliaryItem[] = json.data.map((item: any) => ({
          id: item.id,
          rut: item.rut || item.rutCompleto,
          rutCompleto: item.rutCompleto || item.rut,
          codigoAuxiliar: item.codigoAuxiliar,
          razonSocial: item.razonSocial,
          nombreFantasia: item.nombreFantasia,
          giroComercial: item.giroComercial,
          inactivo: Boolean(item.inactivo),
          telefonoPrincipal: item.telefonoPrincipal,
          emailContacto: item.emailContacto,
          nombreContacto: item.nombreContacto,
          emailDte: item.emailDte,
          direccion: item.direccion,
          region: item.region,
          ciudad: item.ciudad,
          comuna: item.comuna,
          tipo: item.tipo || item.tipoAuxiliar || 'CLIENTE',
          tipoAuxiliar: item.tipoAuxiliar || item.tipo || 'CLIENTE',
          limiteCredito: Number(item.limiteCredito) || 0,
          terminosPago: item.terminosPago,
          vendedor: item.vendedor,
          descuentoPorcentaje: Number(item.descuentoPorcentaje) || 0,
          sucursales: item.sucursales,
        }));

        saveClientState(empresaRut, 'customAuxiliaries', mapped);
        return mapped;
      }
    }
  } catch (err) {
    console.warn('[CompanyAuxiliariesService] Error al obtener auxiliares del servidor:', err);
  }
  return loadCompanyAuxiliaries(empresaRut);
}

/**
 * Guardar Padrón de Auxiliares de la empresa (Sincronización Local + Servidor Multi-Usuario)
 */
export function saveCompanyAuxiliaries(empresaRut: string, auxiliaries: CompanyAuxiliaryItem[]): void {
  saveClientState(empresaRut, 'customAuxiliaries', auxiliaries);

  // Notificar en caliente a la ventana y pestañas locales
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(
        new CustomEvent('companyAuxiliariesUpdated', {
          detail: { empresaRut, auxiliaries },
        })
      );
    } catch {}
  }

  // Sincronizar en segundo plano con el servidor y MySQL
  if (typeof fetch !== 'undefined') {
    fetch('/api/accounting/auxiliaries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ empresaId: empresaRut, auxiliaries }),
    }).catch((err) => {
      console.warn('[CompanyAuxiliariesService] No se pudo sincronizar auxiliares con el servidor:', err);
    });
  }
}

/**
 * Guardar o actualizar un único Auxiliar (Sincronización Local + Servidor Multi-Usuario)
 */
export function saveSingleCompanyAuxiliary(empresaRut: string, aux: CompanyAuxiliaryItem): void {
  const current = loadCompanyAuxiliaries(empresaRut);
  const cleanRut = normalizeRutKey(aux.rut || aux.rutCompleto);
  const idx = current.findIndex((a) => normalizeRutKey(a.rut || a.rutCompleto) === cleanRut);
  let next: CompanyAuxiliaryItem[];
  if (idx >= 0) {
    next = [...current];
    next[idx] = { ...next[idx], ...aux };
  } else {
    next = [aux, ...current];
  }

  saveCompanyAuxiliaries(empresaRut, next);

  if (typeof fetch !== 'undefined') {
    fetch('/api/accounting/auxiliaries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ empresaId: empresaRut, auxiliary: aux }),
    }).catch(() => {});
  }
}
