import { ExpenseProject } from '../types';
import { loadClientState, saveClientState } from './storageService';

export const DEFAULT_COMPANY_PROJECTS: ExpenseProject[] = [
  {
    id: 'pry-01',
    codigo: 'PRY-QUELLON-26',
    nombre: 'Mantención Mayor Redes y Jaulas Balsas Quellón',
    clienteNombre: 'Salmones Antártica S.A.',
    presupuestoTotalClp: 45000000,
    activo: true,
    descripcion: 'Servicio integral de instalación de fondeos y redes loberas en centro acuícola.',
  },
  {
    id: 'pry-02',
    codigo: 'PRY-STGO-EXP',
    nombre: 'Expansión Comercial & Distribución Retail Santiago',
    clienteNombre: 'Cencosud / Walmart Chile',
    presupuestoTotalClp: 25000000,
    activo: true,
    descripcion: 'Apertura de nuevos canales de congelados y mariscos en cadenas de supermercados.',
  },
  {
    id: 'pry-03',
    codigo: 'PRY-CASTRO-PLANTA',
    nombre: 'Automatización y Certificación Planta Proceso Castro',
    clienteNombre: 'Mar Austral Alimentos SpA',
    presupuestoTotalClp: 60000000,
    activo: true,
    descripcion: 'Línea de empaque al vacío y certificación HACCP / BRC para exportación.',
  },
];

/**
 * Normaliza la clave del RUT de la empresa para aislamiento de proyectos (Multi-Tenant)
 */
function normalizeCompanyKey(empresaRut?: string): string {
  if (!empresaRut) return 'default';
  return empresaRut.replace(/[\.\-\s]/g, '').toUpperCase();
}

/**
 * Carga los proyectos de la empresa desde localStorage con respaldo de proyectos semilla
 */
export function loadCompanyProjects(empresaRut: string): ExpenseProject[] {
  const normKey = normalizeCompanyKey(empresaRut);
  const stored = loadClientState<ExpenseProject[]>(normKey, 'customProjects', []);

  if (stored && Array.isArray(stored) && stored.length > 0) {
    return stored;
  }

  // Inicializar con proyectos semilla asociados a la empresa
  const initial = DEFAULT_COMPANY_PROJECTS.map((p) => ({
    ...p,
    empresaId: empresaRut,
  }));
  saveCompanyProjects(empresaRut, initial);
  return initial;
}

/**
 * Guarda el catálogo de proyectos de la empresa en localStorage
 */
export function saveCompanyProjects(empresaRut: string, projects: ExpenseProject[]): void {
  const normKey = normalizeCompanyKey(empresaRut);
  saveClientState(normKey, 'customProjects', projects);
}

/**
 * Agrega o actualiza un proyecto individual para la empresa
 */
export function saveSingleCompanyProject(empresaRut: string, project: ExpenseProject): ExpenseProject[] {
  const current = loadCompanyProjects(empresaRut);
  const idx = current.findIndex((p) => p.id === project.id || p.codigo === project.codigo);

  let updated: ExpenseProject[];
  if (idx >= 0) {
    updated = [...current];
    updated[idx] = { ...updated[idx], ...project, empresaId: empresaRut };
  } else {
    updated = [{ ...project, empresaId: empresaRut }, ...current];
  }

  saveCompanyProjects(empresaRut, updated);
  return updated;
}
