import type { ClientCompany } from '../types';

/**
 * Completa la estructura mínima de una ficha de empresa para que la UI no falle con fichas parciales
 * (p. ej. las creadas por la migración K desde el módulo de seguridad, que solo traen RUT y razón social).
 *
 * Solo agrega contenedores vacíos y valores neutros: no inventa datos tributarios ni contables.
 * Las automatizaciones quedan apagadas y la conexión SII "pendiente de verificación".
 */
export function normalizeClientCompany<T extends Partial<ClientCompany>>(c: T): ClientCompany {
  const auto = (c as any).automatizacionesAgente || {};
  const estado = (c as any).estadoEmpresa;
  return {
    ...(c as any),
    id: String(c.id || ''),
    rut: c.rut || '',
    razonSocial: c.razonSocial || '',
    nombreCorto: c.nombreCorto || c.razonSocial || '',
    giro: c.giro || '',
    direccion: c.direccion || '',
    comuna: c.comuna || '',
    ciudad: c.ciudad || '',
    contactoNombre: c.contactoNombre || '',
    contactoEmail: c.contactoEmail || '',
    contactoTelefono: c.contactoTelefono || '',
    claveSii: c.claveSii || '',
    rutAutenticacion: c.rutAutenticacion || '',
    tipoAutenticacionSii: c.tipoAutenticacionSii || 'CLAVE_TRIBUTARIA',
    estadoConexionSii: c.estadoConexionSii || 'PENDIENTE_VERIFICACION',
    automatizacionesAgente: {
      descargaAutomaticaRcv: Boolean(auto.descargaAutomaticaRcv),
      descargaAutomaticaBhe: Boolean(auto.descargaAutomaticaBhe),
      alertaPlazo8DiasReclamo: Boolean(auto.alertaPlazo8DiasReclamo),
      simulacionF29Automatica: Boolean(auto.simulacionF29Automatica),
      frecuenciaDescarga: auto.frecuenciaDescarga || 'MANUAL',
    },
    contextoEspecialAgente: c.contextoEspecialAgente || '',
    activa: typeof c.activa === 'boolean' ? c.activa : estado ? estado === 'ACTIVA' : true,
    manejaInventario: Boolean(c.manejaInventario),
    bancosDisponibles: Array.isArray(c.bancosDisponibles) ? c.bancosDisponibles : [],
    empresasAnclasIds: Array.isArray((c as any).empresasAnclasIds) ? (c as any).empresasAnclasIds : [],
  } as ClientCompany;
}
