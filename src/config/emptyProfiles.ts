/**
 * Perfiles vacíos para instalaciones sin DEMO_MODE (cierre de la tarea 0.2).
 * Sustituyen al estudio "Siex Consultores" y a la cartera de empresas de ejemplo.
 */
import type { AccountingFirmProfile, ClientCompany } from '../types';

export const EMPTY_FIRM: AccountingFirmProfile = {
  id: 'firm-local',
  razonSocial: '',
  nombreFantasia: 'Estudio contable (sin configurar)',
  rut: '',
  representanteLegal: '',
  rutRepresentante: '',
  emailContacto: '',
  telefono: '',
  direccion: '',
  comuna: '',
  ciudad: '',
  metodoAccesoSii: 'CLAVE_DIRECTA_CLIENTE',
  politicaAuditoria: '',
  agentesHabilitados: {
    auditorFiscal: true,
    descargaAutomaticaSii: false,
    liquidacionPrevisional: true,
    proyeccionFlujo: true,
    gestionInventarios: true,
  },
};

/** Marcador sin datos mientras no exista ninguna empresa registrada (la app muestra el alta de la primera empresa). */
export const NO_CLIENT_PLACEHOLDER = {
  id: '',
  rut: '',
  razonSocial: 'Sin empresa registrada',
  nombreCorto: 'Sin empresa',
  periodosCerrados: [],
  tasaPpm: 0,
  claveSii: '',
  estadoConexionSii: 'PENDIENTE_VERIFICACION',
} as unknown as ClientCompany;
