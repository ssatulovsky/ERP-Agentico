import type { WhatsAppAgentScope } from './whatsappBridgeService';
import type { ClientCompany } from '../types';

export type ErpModuleId =
  | 'executive_dashboard'
  | 'agents'
  | 'billing_agent'
  | 'rcv'
  | 'reconciliation'
  | 'f29'
  | 'hr_agent'
  | 'payroll'
  | 'inventory'
  | 'fixed_assets'
  | 'production'
  | 'cost_centers'
  | 'expense_reports'
  | 'expense_mobile'
  | 'cashflow'
  | 'leases'
  | 'ledger'
  | 'security_admin';

export type CompanyCommercialStatus = 'ACTIVA' | 'SUSPENDIDA_PAGO' | 'BAJA';

export type UserAccountStatus = 'ACTIVO' | 'INACTIVO';

export type SystemRoleType = 'SUPERADMIN' | 'ADMIN' | 'CUSTOM';

export interface ErpModuleMeta {
  id: ErpModuleId;
  nombre: string;
  categoria: 'DIRECCION' | 'COMERCIAL_SII' | 'FINANZAS_CONTABILIDAD' | 'PERSONAS_RRHH' | 'OPERACIONES_LOGISTICA' | 'SEGURIDAD';
  agenteNombre: string;
  descripcion: string;
  whatsappScopes: WhatsAppAgentScope[];
}

export const ERP_MODULES_CATALOG: ErpModuleMeta[] = [
  {
    id: 'executive_dashboard',
    nombre: 'Dashboard Ejecutivo 360°',
    categoria: 'DIRECCION',
    agenteNombre: 'Vera Albornoz (Directora Financiera)',
    descripcion: 'Panorama general de directorio, indicadores financieros y alertas ejecutivas.',
    whatsappScopes: ['PANORAMA_DIRECTORIO'],
  },
  {
    id: 'agents',
    nombre: 'Agentes IA, Clientes & WhatsApp',
    categoria: 'DIRECCION',
    agenteNombre: 'Orquestador Multi-Agente & SII',
    descripcion: 'Configuración de empresas, credenciales SII, automatizaciones y vinculación WhatsApp.',
    whatsappScopes: ['PANORAMA_DIRECTORIO'],
  },
  {
    id: 'billing_agent',
    nombre: 'Facturación & Cobranza DTE',
    categoria: 'COMERCIAL_SII',
    agenteNombre: 'Juan Pablo Silva (Agente Facturador)',
    descripcion: 'Emisión de facturas electrónicas (DTE 33/34/61), cotizaciones y cobranza.',
    whatsappScopes: ['FACTURACION_DTE', 'PRESUPUESTOS_COMERCIAL'],
  },
  {
    id: 'rcv',
    nombre: 'Registro Compras / Ventas & BHE',
    categoria: 'COMERCIAL_SII',
    agenteNombre: 'Jorge Rojas (Especialista SII)',
    descripcion: 'Sincronización con RCV del SII, acuse de recibo Ley 19.983 y boletas de honorarios.',
    whatsappScopes: ['FACTURACION_DTE', 'TRIBUTARIO_F29'],
  },
  {
    id: 'reconciliation',
    nombre: 'Bancos & Conciliación Bancaria',
    categoria: 'FINANZAS_CONTABILIDAD',
    agenteNombre: 'Vera Albornoz / Tesorería',
    descripcion: 'Saldos bancarios aperturados por cuenta y banco, cartolas y conciliación automática.',
    whatsappScopes: ['BANCOS_CONCILIACION'],
  },
  {
    id: 'cashflow',
    nombre: 'Flujo de Caja Proyectado',
    categoria: 'FINANZAS_CONTABILIDAD',
    agenteNombre: 'Vera Albornoz (Tesorería & Liquidez)',
    descripcion: 'Proyección de liquidez a 30/60/90 días, cheques en cartera y compromisos financieros.',
    whatsappScopes: ['FLUJO_CAJA'],
  },
  {
    id: 'f29',
    nombre: 'Agente Fiscal F29 & Impuestos',
    categoria: 'FINANZAS_CONTABILIDAD',
    agenteNombre: 'Jorge Rojas (Especialista Tributario)',
    descripcion: 'Determinación mensual de IVA Débito/Crédito, PPM, retenciones e impuestos SII.',
    whatsappScopes: ['TRIBUTARIO_F29'],
  },
  {
    id: 'ledger',
    nombre: 'Agente Contable Senior & Libros',
    categoria: 'FINANZAS_CONTABILIDAD',
    agenteNombre: 'Camila Valenzuela (Auditora IFRS)',
    descripcion: 'Libro Diario, Libro Mayor, Libros Auxiliares con trazabilidad TEF/Cheque y Balance 8 Columnas.',
    whatsappScopes: ['CONTABILIDAD_IFRS'],
  },
  {
    id: 'hr_agent',
    nombre: 'Agente RRHH & Gestión de Personas',
    categoria: 'PERSONAS_RRHH',
    agenteNombre: 'Sofía Castro (Jefa de RRHH)',
    descripcion: 'Contratos laborales, licencias médicas, vacaciones, ausentismo y legajo digital.',
    whatsappScopes: ['RRHH_REMUNERACIONES'],
  },
  {
    id: 'payroll',
    nombre: 'Remuneraciones, Nómina & Previred',
    categoria: 'PERSONAS_RRHH',
    agenteNombre: 'Sofía Castro (Nómina & Previred)',
    descripcion: 'Liquidaciones de sueldo, gratificación legal Art. 50, AFP/Isapre/Fonasa y libro de remuneraciones.',
    whatsappScopes: ['RRHH_REMUNERACIONES'],
  },
  {
    id: 'inventory',
    nombre: 'Inventario, Bodegas & Stock',
    categoria: 'OPERACIONES_LOGISTICA',
    agenteNombre: 'Diego Morales (Jefe de Bodega)',
    descripcion: 'Control de existencias, valorización PMP/FIFO, kárdex y requisiciones de compra.',
    whatsappScopes: ['BODEGA_INVENTARIO'],
  },
  {
    id: 'production',
    nombre: 'Producción & Costeo Industrial NIC 2',
    categoria: 'OPERACIONES_LOGISTICA',
    agenteNombre: 'Roberto Soto (Jefe de Planta)',
    descripcion: 'Órdenes de producción, recetas BOM, retiros de bodega y distribución CIF.',
    whatsappScopes: ['PRODUCCION_COSTEO'],
  },
  {
    id: 'fixed_assets',
    nombre: 'Activo Fijo NIC 16 & Tributario',
    categoria: 'FINANZAS_CONTABILIDAD',
    agenteNombre: 'Camila Valenzuela (Activo Fijo)',
    descripcion: 'Control de bienes físicos, depreciación normal/acelerada/instantánea y CM.',
    whatsappScopes: ['CONTABILIDAD_IFRS'],
  },
  {
    id: 'leases',
    nombre: 'Contratos & Arriendos IFRS 16',
    categoria: 'FINANZAS_CONTABILIDAD',
    agenteNombre: 'Camila Valenzuela (Pasivos IFRS 16)',
    descripcion: 'Activos por derecho de uso (ROU), tablas de amortización UF y devengos de arriendo.',
    whatsappScopes: ['CONTABILIDAD_IFRS'],
  },
  {
    id: 'cost_centers',
    nombre: 'Centros de Costo & Mini-Empresas',
    categoria: 'FINANZAS_CONTABILIDAD',
    agenteNombre: 'Control de Gestión Analítico',
    descripcion: 'Rentabilidad por unidad de negocio, faena o proyecto (Estado de Resultados Analítico).',
    whatsappScopes: ['CONTABILIDAD_IFRS', 'PRESUPUESTOS_COMERCIAL'],
  },
  {
    id: 'expense_reports',
    nombre: 'Rendiciones de Gastos & Fondos',
    categoria: 'FINANZAS_CONTABILIDAD',
    agenteNombre: 'Andrés Fuentes (Control de Gastos)',
    descripcion: 'Aprobación de rendiciones, fondos por rendir, auditoría OCR de boletas y reembolsos.',
    whatsappScopes: ['RENDICIONES_GASTOS'],
  },
  {
    id: 'expense_mobile',
    nombre: 'App Móvil Rinde Gastos',
    categoria: 'FINANZAS_CONTABILIDAD',
    agenteNombre: 'Andrés Fuentes (Captura Móvil)',
    descripcion: 'Portal móvil para que colaboradores suban boletas y rindan gastos en terreno.',
    whatsappScopes: ['RENDICIONES_GASTOS'],
  },
  {
    id: 'security_admin',
    nombre: 'Seguridad, Usuarios, Roles & Empresas',
    categoria: 'SEGURIDAD',
    agenteNombre: 'Guardián RBAC & Gobierno de Accesos',
    descripcion: 'Administración de empresas, empresas anclas, estados comerciales, usuarios, roles y permisos de Vera.',
    whatsappScopes: [],
  },
];

export const ALL_ERP_MODULE_IDS: ErpModuleId[] = ERP_MODULES_CATALOG.map((m) => m.id);

export interface SecurityRole {
  id: string;
  nombre: string;
  codigo: string;
  tipoSistema: SystemRoleType;
  empresaScopeId: string | 'GLOBAL'; // 'GLOBAL' para roles de sistema o plantillas disponibles en todas las empresas, o ID de empresa cliente
  descripcion: string;
  modulosPermitidos: ErpModuleId[];
  whatsappScopesPermitidos: WhatsAppAgentScope[];
  esEditable: boolean;
  creadoPor?: string;
  fechaActualizacion?: string;
}

export interface SecurityUser {
  id: string;
  username: string;
  password: string;
  nombreCompleto: string;
  cargo: string;
  email: string;
  telefonoWhatsapp: string; // Sincronizado con Vera en WhatsApp (ej: "56998765432")
  estado: UserAccountStatus; // 'ACTIVO' | 'INACTIVO'
  rolId: string;
  empresaPrincipalId: string; // ID de la empresa base del usuario
  empresasAnclasPermitidas: string[]; // IDs de empresas anclas adicionales que puede operar
  recibirAudioWhatsapp?: boolean;
  ultimoAcceso?: string;
}

export interface CompanySecurityConfig {
  empresaId: string;
  rut: string;
  razonSocial: string;
  nombreCorto: string;
  estadoCuenta: CompanyCommercialStatus; // 'ACTIVA' | 'SUSPENDIDA_PAGO' | 'BAJA'
  esEmpresaDuenaErp: boolean;
  empresasAnclasIds: string[]; // IDs de empresas vinculadas (grupo empresarial)
  motivoSuspensionOBaja?: string;
  fechaUltimoCambioEstado?: string;
}

export interface SecurityRbacStoreState {
  version: number;
  companiesConfig: CompanySecurityConfig[];
  roles: SecurityRole[];
  users: SecurityUser[];
}

export interface LoginValidationResult {
  ok: boolean;
  errorCode?:
    | 'CREDENCIALES_INVALIDAS'
    | 'EMPRESA_NO_EXISTE'
    | 'EMPRESA_SUSPENDIDA_PAGO'
    | 'EMPRESA_DADA_DE_BAJA'
    | 'USUARIO_INACTIVO'
    | 'SIN_ACCESO_EMPRESA'
    | 'ROL_NO_ENCONTRADO';
  errorTitle?: string;
  errorMessage?: string;
  user?: SecurityUser;
  role?: SecurityRole;
  companyConfig?: CompanySecurityConfig;
  allowedCompanyIds?: string[];
  allowedModules?: ErpModuleId[];
  allowedWhatsappScopes?: WhatsAppAgentScope[];
}

/**
 * Deriva automáticamente los permisos de Vera en WhatsApp (`WhatsAppAgentScope[]`)
 * a partir de los módulos del ERP (`ErpModuleId[]`) asignados al Rol.
 */
export function deriveWhatsappScopesFromModules(
  modulos: ErpModuleId[],
  tipoSistema?: SystemRoleType
): WhatsAppAgentScope[] {
  if (tipoSistema === 'SUPERADMIN' || tipoSistema === 'ADMIN') {
    return [
      'FLUJO_CAJA',
      'BANCOS_CONCILIACION',
      'CONTABILIDAD_IFRS',
      'TRIBUTARIO_F29',
      'FACTURACION_DTE',
      'RRHH_REMUNERACIONES',
      'BODEGA_INVENTARIO',
      'PRODUCCION_COSTEO',
      'PRESUPUESTOS_COMERCIAL',
      'RENDICIONES_GASTOS',
      'PANORAMA_DIRECTORIO',
    ];
  }

  const scopeSet = new Set<WhatsAppAgentScope>();
  for (const modId of modulos) {
    const meta = ERP_MODULES_CATALOG.find((m) => m.id === modId);
    if (meta) {
      meta.whatsappScopes.forEach((s) => scopeSet.add(s));
    }
  }
  return Array.from(scopeSet);
}

export const DEFAULT_SECURITY_COMPANIES: CompanySecurityConfig[] = [
  {
    empresaId: 'client-innovagile',
    rut: '77.798.901-4',
    razonSocial: 'InnovAgile Group SpA',
    nombreCorto: 'InnovAgile Group (Dueña ERP)',
    estadoCuenta: 'ACTIVA',
    esEmpresaDuenaErp: true,
    empresasAnclasIds: ['client-retail-logistics', 'client-agro-valle'],
    fechaUltimoCambioEstado: '2026-01-01',
  },
  {
    empresaId: 'client-retail-logistics',
    rut: '77.210.980-5',
    razonSocial: 'RETAIL LOGISTICS CHILE S.A.',
    nombreCorto: 'Retail Logistics Chile',
    estadoCuenta: 'ACTIVA',
    esEmpresaDuenaErp: false,
    empresasAnclasIds: ['client-agro-valle'], // Empresa Ancla del mismo grupo empresarial
    fechaUltimoCambioEstado: '2026-01-15',
  },
  {
    empresaId: 'client-agro-valle',
    rut: '76.104.550-9',
    razonSocial: 'AGROINDUSTRIAL VALLE CENTRAL LIMITADA',
    nombreCorto: 'Agroindustrial Valle Central',
    estadoCuenta: 'ACTIVA',
    esEmpresaDuenaErp: false,
    empresasAnclasIds: [],
    fechaUltimoCambioEstado: '2026-02-01',
  },
  {
    empresaId: 'client-minera-sur',
    rut: '96.540.320-1',
    razonSocial: 'MINERA DEL SUR CHILE SPA',
    nombreCorto: 'Minera del Sur',
    estadoCuenta: 'SUSPENDIDA_PAGO',
    esEmpresaDuenaErp: false,
    empresasAnclasIds: [],
    motivoSuspensionOBaja: 'Facturas de suscripción ERP vencidas (> 60 días).',
    fechaUltimoCambioEstado: '2026-09-01',
  },
];

export const DEFAULT_SECURITY_ROLES: SecurityRole[] = [
  {
    id: 'role-superadmin',
    nombre: 'SuperAdmin',
    codigo: 'SUPERADMIN',
    tipoSistema: 'SUPERADMIN',
    empresaScopeId: 'GLOBAL',
    descripcion:
      'Administrador de la empresa dueña del ERP. Accede a todas las opciones del sistema y a todas las empresas.',
    modulosPermitidos: [...ALL_ERP_MODULE_IDS],
    whatsappScopesPermitidos: deriveWhatsappScopesFromModules(ALL_ERP_MODULE_IDS, 'SUPERADMIN'),
    esEditable: false,
    creadoPor: 'SISTEMA',
    fechaActualizacion: '2026-01-01',
  },
  {
    id: 'role-admin',
    nombre: 'Admin',
    codigo: 'ADMIN',
    tipoSistema: 'ADMIN',
    empresaScopeId: 'GLOBAL',
    descripcion:
      'Administrador de la empresa seleccionada. Si es cliente ERP, administra su empresa principal, sus empresas anclas, sus usuarios y crea roles personalizados.',
    modulosPermitidos: [...ALL_ERP_MODULE_IDS],
    whatsappScopesPermitidos: deriveWhatsappScopesFromModules(ALL_ERP_MODULE_IDS, 'ADMIN'),
    esEditable: false,
    creadoPor: 'SISTEMA',
    fechaActualizacion: '2026-01-01',
  },
  {
    id: 'role-rrhh',
    nombre: 'RRHH',
    codigo: 'RRHH',
    tipoSistema: 'CUSTOM',
    empresaScopeId: 'GLOBAL',
    descripcion:
      'Acceso exclusivo a los agentes de Remuneraciones y Recursos Humanos (Contrato, Nómina, Previred).',
    modulosPermitidos: ['hr_agent', 'payroll'],
    whatsappScopesPermitidos: ['RRHH_REMUNERACIONES'],
    esEditable: true,
    creadoPor: 'Admin',
    fechaActualizacion: '2026-03-01',
  },
  {
    id: 'role-contabilidad',
    nombre: 'Contabilidad & Impuestos',
    codigo: 'CONTABILIDAD',
    tipoSistema: 'CUSTOM',
    empresaScopeId: 'GLOBAL',
    descripcion:
      'Acceso a Agente Contable Senior, Libros Auxiliares, RCV SII, F29, Conciliación Bancaria, Activo Fijo y Arriendos IFRS 16.',
    modulosPermitidos: [
      'ledger',
      'rcv',
      'f29',
      'reconciliation',
      'cashflow',
      'fixed_assets',
      'leases',
      'cost_centers',
    ],
    whatsappScopesPermitidos: [
      'CONTABILIDAD_IFRS',
      'TRIBUTARIO_F29',
      'BANCOS_CONCILIACION',
      'FLUJO_CAJA',
    ],
    esEditable: true,
    creadoPor: 'Admin',
    fechaActualizacion: '2026-03-01',
  },
  {
    id: 'role-bodega-produccion',
    nombre: 'Bodega & Producción',
    codigo: 'BODEGA_PLANTA',
    tipoSistema: 'CUSTOM',
    empresaScopeId: 'GLOBAL',
    descripcion:
      'Acceso exclusivo a los agentes de Inventario/Bodegas y Órdenes de Producción/Costeo NIC 2.',
    modulosPermitidos: ['inventory', 'production'],
    whatsappScopesPermitidos: ['BODEGA_INVENTARIO', 'PRODUCCION_COSTEO'],
    esEditable: true,
    creadoPor: 'Admin',
    fechaActualizacion: '2026-03-01',
  },
  {
    id: 'role-rrhh-inventario',
    nombre: 'RRHH + Inventario',
    codigo: 'RRHH_INVENTARIO',
    tipoSistema: 'CUSTOM',
    empresaScopeId: 'GLOBAL',
    descripcion:
      'Perfil combinado con permisos simultáneos para Agentes de RRHH/Remuneraciones y Bodega/Inventario.',
    modulosPermitidos: ['hr_agent', 'payroll', 'inventory'],
    whatsappScopesPermitidos: ['RRHH_REMUNERACIONES', 'BODEGA_INVENTARIO'],
    esEditable: true,
    creadoPor: 'Admin',
    fechaActualizacion: '2026-03-01',
  },
];

export const DEFAULT_SECURITY_USERS: SecurityUser[] = [
  {
    id: 'usr-superadmin',
    username: 'ssatulovsky',
    password: 'admin123',
    nombreCompleto: 'Sergio Satulovsky (SuperAdmin ERP)',
    cargo: 'Socio Director & Propietario ERP',
    email: 'ssatulovsky@innovagile.cl',
    telefonoWhatsapp: '56998765432',
    estado: 'ACTIVO',
    rolId: 'role-superadmin',
    empresaPrincipalId: 'client-innovagile',
    empresasAnclasPermitidas: [
      'client-innovagile',
      'client-retail-logistics',
      'client-agro-valle',
      'client-minera-sur',
    ],
    recibirAudioWhatsapp: true,
  },
  {
    id: 'usr-admin-cliente',
    username: 'admin',
    password: 'admin123',
    nombreCompleto: 'Claudia Navarrete Ruiz',
    cargo: 'Gerente de Administración (Admin Cliente + Anclas)',
    email: 'contabilidad@retaillogistics.cl',
    telefonoWhatsapp: '56993421100',
    estado: 'ACTIVO',
    rolId: 'role-admin',
    empresaPrincipalId: 'client-retail-logistics',
    empresasAnclasPermitidas: ['client-agro-valle'],
    recibirAudioWhatsapp: true,
  },
  {
    id: 'usr-rrhh-01',
    username: 'rrhh',
    password: 'rrhh123',
    nombreCompleto: 'Sofía Castro (Jefa RRHH)',
    cargo: 'Encargada de Recursos Humanos y Nómina',
    email: 'rrhh@innovagile.cl',
    telefonoWhatsapp: '56987654321',
    estado: 'ACTIVO',
    rolId: 'role-rrhh',
    empresaPrincipalId: 'client-innovagile',
    empresasAnclasPermitidas: ['client-retail-logistics', 'client-agro-valle'],
    recibirAudioWhatsapp: false,
  },
  {
    id: 'usr-bodega-rrhh-02',
    username: 'operaciones',
    password: 'op123',
    nombreCompleto: 'Diego Morales (Supervisor RRHH + Bodega)',
    cargo: 'Supervisor de Bodega y Turnos RRHH',
    email: 'operaciones@retaillogistics.cl',
    telefonoWhatsapp: '56976543210',
    estado: 'ACTIVO',
    rolId: 'role-rrhh-inventario',
    empresaPrincipalId: 'client-retail-logistics',
    empresasAnclasPermitidas: ['client-innovagile'],
    recibirAudioWhatsapp: false,
  },
  {
    id: 'usr-contador-03',
    username: 'contador',
    password: 'conta123',
    nombreCompleto: 'Jorge Rojas (Contador Senior)',
    cargo: 'Contador General & Tributario',
    email: 'jrojas@siexconsultores.cl',
    telefonoWhatsapp: '56965432109',
    estado: 'ACTIVO',
    rolId: 'role-contabilidad',
    empresaPrincipalId: 'client-innovagile',
    empresasAnclasPermitidas: ['client-retail-logistics', 'client-agro-valle'],
    recibirAudioWhatsapp: false,
  },
  {
    id: 'usr-inactivo-04',
    username: 'inactivo',
    password: '123456',
    nombreCompleto: 'Roberto Gómez (Ex-Colaborador)',
    cargo: 'Analista Administrativo',
    email: 'rgomez@innovagile.cl',
    telefonoWhatsapp: '56911112222',
    estado: 'INACTIVO',
    rolId: 'role-rrhh',
    empresaPrincipalId: 'client-innovagile',
    empresasAnclasPermitidas: [],
    recibirAudioWhatsapp: false,
  },
];

export const DEFAULT_SECURITY_RBAC_STATE: SecurityRbacStoreState = {
  version: 1,
  companiesConfig: DEFAULT_SECURITY_COMPANIES,
  roles: DEFAULT_SECURITY_ROLES,
  users: DEFAULT_SECURITY_USERS,
};

const STORAGE_KEY_SECURITY_STATE = 'erp_security_rbac_state_v1';
const STORAGE_KEY_ACTIVE_SESSION = 'erp_security_active_session_v1';

export function normalizePhoneDigits(raw: string): string {
  if (!raw) return '';
  const beforeAt = raw.split('@')[0].split(':')[0];
  return beforeAt.replace(/[^0-9]/g, '');
}

/**
 * Sincroniza la configuración de empresas de seguridad con la lista de `ClientCompany` del ERP.
 */
export function ensureCompaniesSyncedWithSecurity(
  clients: ClientCompany[],
  state: SecurityRbacStoreState
): SecurityRbacStoreState {
  const existingMap = new Map<string, CompanySecurityConfig>();
  for (const c of state.companiesConfig) {
    existingMap.set(c.empresaId, c);
  }

  const mergedCompanies: CompanySecurityConfig[] = clients.map((client) => {
    const existing = existingMap.get(client.id);
    if (existing) {
      return {
        ...existing,
        rut: client.rut || existing.rut,
        razonSocial: client.razonSocial || existing.razonSocial,
        nombreCorto: client.nombreCorto || existing.nombreCorto,
        estadoCuenta: client.estadoCuentaEmpresa || existing.estadoCuenta || 'ACTIVA',
        empresasAnclasIds: client.empresasAnclasIds || existing.empresasAnclasIds || [],
        esEmpresaDuenaErp:
          client.esEmpresaDuenaErp !== undefined ? client.esEmpresaDuenaErp : existing.esEmpresaDuenaErp,
      };
    }
    const def = DEFAULT_SECURITY_COMPANIES.find((d) => d.empresaId === client.id);
    return {
      empresaId: client.id,
      rut: client.rut,
      razonSocial: client.razonSocial,
      nombreCorto: client.nombreCorto || client.razonSocial,
      estadoCuenta: client.estadoCuentaEmpresa || def?.estadoCuenta || 'ACTIVA',
      esEmpresaDuenaErp: client.esEmpresaDuenaErp ?? def?.esEmpresaDuenaErp ?? false,
      empresasAnclasIds: client.empresasAnclasIds || def?.empresasAnclasIds || [],
      motivoSuspensionOBaja: def?.motivoSuspensionOBaja,
      fechaUltimoCambioEstado: new Date().toISOString().slice(0, 10),
    };
  });

  return {
    ...state,
    companiesConfig: mergedCompanies,
  };
}

/**
 * Calcula qué empresas (IDs) puede ver y operar un usuario según su Rol y las Empresas Anclas configuradas.
 * - SuperAdmin: Todas las empresas del ERP.
 * - Admin: Su empresa seleccionada/principal + todas las empresas anclas de esa empresa + sus empresas anclas asignadas.
 * - Rol Personalizado: Su empresa principal + empresas anclas asignadas al usuario.
 */
export function resolveAllowedCompanyIdsForUser(
  user: SecurityUser,
  role: SecurityRole,
  allCompanies: CompanySecurityConfig[],
  selectedCompanyId?: string
): string[] {
  if (role.tipoSistema === 'SUPERADMIN') {
    return allCompanies.map((c) => c.empresaId);
  }

  const allowedSet = new Set<string>();
  if (user.empresaPrincipalId) {
    allowedSet.add(user.empresaPrincipalId);
  }
  if (selectedCompanyId) {
    allowedSet.add(selectedCompanyId);
  }
  for (const anchorId of user.empresasAnclasPermitidas || []) {
    allowedSet.add(anchorId);
  }

  // Si es Admin de una empresa cliente ERP, también administra las empresas anclas vinculadas a su empresa principal o seleccionada
  if (role.tipoSistema === 'ADMIN') {
    const primaryComp = allCompanies.find((c) => c.empresaId === user.empresaPrincipalId);
    if (primaryComp?.empresasAnclasIds) {
      primaryComp.empresasAnclasIds.forEach((id) => allowedSet.add(id));
    }
    if (selectedCompanyId) {
      const selectedComp = allCompanies.find((c) => c.empresaId === selectedCompanyId);
      if (selectedComp?.empresasAnclasIds) {
        selectedComp.empresasAnclasIds.forEach((id) => allowedSet.add(id));
      }
    }
  }

  return Array.from(allowedSet);
}

/**
 * Validación secuencial de Login solicitada:
 * 1) Usuario / Password / Empresa.
 * 2) Validar que la Empresa esté ACTIVA (puede estar ACTIVA, SUSPENDIDA_PAGO o BAJA).
 *    - Si está SUSPENDIDA_PAGO: mostrar mensaje de que la cuenta de empresa está suspendida por pagos atrasados y que se comunique con soporte para regularizar.
 *    - Si está BAJA: mostrar mensaje de cuenta dada de baja.
 * 3) Si la Empresa está ACTIVA, pasar a validar si el Usuario está ACTIVO.
 *    - Si el usuario NO está activo: mostrar mensaje "Usuario no activo en sistema, comuníquese con su administrador."
 * 4) Si el usuario está ACTIVO, consultar el ROL del mismo (SuperAdmin, Admin o Rol personalizado) y devolver sus módulos y empresas habilitadas.
 */
export function authenticateErpLogin(params: {
  usernameInput: string;
  passwordInput: string;
  empresaId: string;
  state: SecurityRbacStoreState;
}): LoginValidationResult {
  const { usernameInput, passwordInput, empresaId, state } = params;
  const cleanUser = (usernameInput || '').trim().toLowerCase();
  const cleanPass = (passwordInput || '').trim();

  // Buscar usuario por username, email o alias 'superadmin' -> 'ssatulovsky'
  const matchedUser = state.users.find((u) => {
    const uName = u.username.toLowerCase();
    const uMail = (u.email || '').toLowerCase();
    if (uName === cleanUser || (uMail && uMail === cleanUser)) return true;
    if (cleanUser === 'superadmin' && u.rolId === 'role-superadmin') return true;
    return false;
  });

  if (!matchedUser || matchedUser.password !== cleanPass) {
    return {
      ok: false,
      errorCode: 'CREDENCIALES_INVALIDAS',
      errorTitle: 'Credenciales Incorrectas',
      errorMessage:
        'El usuario o la contraseña ingresados no son válidos. Verifique sus datos e intente nuevamente.',
    };
  }

  const companyConfig = state.companiesConfig.find((c) => c.empresaId === empresaId);
  if (!companyConfig) {
    return {
      ok: false,
      errorCode: 'EMPRESA_NO_EXISTE',
      errorTitle: 'Empresa No Encontrada',
      errorMessage: 'La empresa seleccionada no existe en los registros del sistema.',
    };
  }

  // PASO 1: Validar que la empresa esté ACTIVA (ACTIVA | SUSPENDIDA_PAGO | BAJA)
  if (companyConfig.estadoCuenta === 'SUSPENDIDA_PAGO') {
    return {
      ok: false,
      errorCode: 'EMPRESA_SUSPENDIDA_PAGO',
      errorTitle: 'Cuenta de Empresa Suspendida por Falta de Pago',
      errorMessage:
        'La cuenta de empresa está suspendida por pagos atrasados. Por favor comuníquese con soporte para regularizar su situación.',
      companyConfig,
    };
  }

  if (companyConfig.estadoCuenta === 'BAJA') {
    return {
      ok: false,
      errorCode: 'EMPRESA_DADA_DE_BAJA',
      errorTitle: 'Cuenta de Empresa Dada de Baja',
      errorMessage:
        'La cuenta de la empresa seleccionada se encuentra dada de baja en el sistema. Comuníquese con soporte para más información.',
      companyConfig,
    };
  }

  // PASO 2: Si la empresa está Activa, validar si el usuario está ACTIVO
  if (matchedUser.estado !== 'ACTIVO') {
    return {
      ok: false,
      errorCode: 'USUARIO_INACTIVO',
      errorTitle: 'Usuario No Activo en Sistema',
      errorMessage: 'Usuario no activo en sistema, comuníquese con su administrador.',
      user: matchedUser,
      companyConfig,
    };
  }

  // PASO 3: Si el usuario está activo, consultar el ROL del mismo
  const role = state.roles.find((r) => r.id === matchedUser.rolId);
  if (!role) {
    return {
      ok: false,
      errorCode: 'ROL_NO_ENCONTRADO',
      errorTitle: 'Rol de Seguridad No Asignado',
      errorMessage:
        'El usuario no tiene un rol de seguridad válido configurado. Comuníquese con su administrador.',
    };
  }

  // Verificar si el usuario tiene permiso para operar en la empresa seleccionada
  // - SuperAdmin: accede a todas las opciones y todas las empresas
  // - Admin / Custom: accede a su empresa principal y a sus empresas anclas
  const allowedCompanyIds = resolveAllowedCompanyIdsForUser(
    matchedUser,
    role,
    state.companiesConfig
  );

  if (role.tipoSistema !== 'SUPERADMIN' && !allowedCompanyIds.includes(empresaId)) {
    const allowedNames = state.companiesConfig
      .filter((c) => allowedCompanyIds.includes(c.empresaId))
      .map((c) => c.nombreCorto)
      .join(', ');
    return {
      ok: false,
      errorCode: 'SIN_ACCESO_EMPRESA',
      errorTitle: 'Empresa No Autorizada para este Usuario',
      errorMessage: `Su usuario (${matchedUser.username}) no está asignado a la empresa "${companyConfig.razonSocial}". Empresas autorizadas en su perfil: ${allowedNames || 'Ninguna'}.`,
    };
  }

  const allowedModules: ErpModuleId[] =
    role.tipoSistema === 'SUPERADMIN' || role.tipoSistema === 'ADMIN'
      ? [...ALL_ERP_MODULE_IDS]
      : role.modulosPermitidos;

  const allowedWhatsappScopes = deriveWhatsappScopesFromModules(
    allowedModules,
    role.tipoSistema
  );

  return {
    ok: true,
    user: matchedUser,
    role,
    companyConfig,
    allowedCompanyIds:
      role.tipoSistema === 'SUPERADMIN'
        ? state.companiesConfig.map((c) => c.empresaId)
        : allowedCompanyIds,
    allowedModules,
    allowedWhatsappScopes,
  };
}

/**
 * Evalúa por número de teléfono de WhatsApp el estado de Empresa, Usuario y Rol
 * para que Vera controle exactamente los mismos permisos cuando se le pide información por WhatsApp.
 */
export function evaluateWhatsappPhoneAgainstRbac(
  rawPhone: string,
  state: SecurityRbacStoreState,
  extraCandidatePhones?: string[]
): {
  matchedUser: SecurityUser | null;
  role: SecurityRole | null;
  companyConfig: CompanySecurityConfig | null;
  statusValidation:
    | 'OK_AUTORIZADO'
    | 'EMPRESA_SUSPENDIDA_PAGO'
    | 'EMPRESA_BAJA'
    | 'USUARIO_INACTIVO'
    | 'NO_REGISTRADO_EN_USUARIOS';
  blockMessageForWhatsapp?: string;
  blockAudioSummary?: string;
  allowedWhatsappScopes: WhatsAppAgentScope[];
  allowedModules: ErpModuleId[];
} {
  const candidates = [rawPhone, ...(extraCandidatePhones || [])]
    .map((p) => normalizePhoneDigits(p || ''))
    .filter((d) => d.length >= 7);

  let matchedUser: SecurityUser | null = null;

  for (const incomingDigits of candidates) {
    for (const u of state.users) {
      const userDigits = normalizePhoneDigits(u.telefonoWhatsapp || '');
      if (!userDigits || userDigits.length < 7) continue;
      if (
        incomingDigits === userDigits ||
        (incomingDigits.length >= 8 &&
          userDigits.length >= 8 &&
          incomingDigits.slice(-8) === userDigits.slice(-8))
      ) {
        matchedUser = u;
        break;
      }
    }
    if (matchedUser) break;
  }

  if (!matchedUser) {
    return {
      matchedUser: null,
      role: null,
      companyConfig: null,
      statusValidation: 'NO_REGISTRADO_EN_USUARIOS',
      allowedWhatsappScopes: [],
      allowedModules: [],
    };
  }

  const companyConfig =
    state.companiesConfig.find((c) => c.empresaId === matchedUser!.empresaPrincipalId) ||
    state.companiesConfig[0] ||
    null;

  const role = state.roles.find((r) => r.id === matchedUser!.rolId) || null;

  // 1) Validar que la empresa del usuario esté ACTIVA
  if (companyConfig && companyConfig.estadoCuenta === 'SUSPENDIDA_PAGO') {
    return {
      matchedUser,
      role,
      companyConfig,
      statusValidation: 'EMPRESA_SUSPENDIDA_PAGO',
      blockMessageForWhatsapp: `⚠️ *CUENTA DE EMPRESA SUSPENDIDA*\n\nHola *${matchedUser.nombreCompleto}*, la cuenta de la empresa *${companyConfig.razonSocial}* está suspendida por pagos atrasados.\n\nPor favor comuníquese con soporte para regularizar el servicio.`,
      blockAudioSummary: `Hola ${matchedUser.nombreCompleto}. La cuenta de la empresa ${companyConfig.nombreCorto} está suspendida por pagos atrasados. Comuníquese con soporte para regularizar.`,
      allowedWhatsappScopes: [],
      allowedModules: [],
    };
  }

  if (companyConfig && companyConfig.estadoCuenta === 'BAJA') {
    return {
      matchedUser,
      role,
      companyConfig,
      statusValidation: 'EMPRESA_BAJA',
      blockMessageForWhatsapp: `⛔ *CUENTA DE EMPRESA DADA DE BAJA*\n\nHola *${matchedUser.nombreCompleto}*, la cuenta de la empresa *${companyConfig.razonSocial}* se encuentra dada de baja en el sistema. Comuníquese con soporte.`,
      blockAudioSummary: `Hola ${matchedUser.nombreCompleto}. La cuenta de la empresa se encuentra dada de baja en el sistema.`,
      allowedWhatsappScopes: [],
      allowedModules: [],
    };
  }

  // 2) Si la empresa está Activa, validar que el usuario esté ACTIVO
  if (matchedUser.estado !== 'ACTIVO') {
    return {
      matchedUser,
      role,
      companyConfig,
      statusValidation: 'USUARIO_INACTIVO',
      blockMessageForWhatsapp: `🔒 *USUARIO NO ACTIVO EN SISTEMA*\n\nHola *${matchedUser.nombreCompleto}*, tu usuario (*${matchedUser.username}*) no está activo en el sistema. Comuníquese con su administrador.`,
      blockAudioSummary: `Hola ${matchedUser.nombreCompleto}. Usuario no activo en sistema, comuníquese con su administrador.`,
      allowedWhatsappScopes: [],
      allowedModules: [],
    };
  }

  // 3) Resolver permisos del ROL
  const allowedModules: ErpModuleId[] =
    !role
      ? []
      : role.tipoSistema === 'SUPERADMIN' || role.tipoSistema === 'ADMIN'
      ? [...ALL_ERP_MODULE_IDS]
      : role.modulosPermitidos;

  const allowedWhatsappScopes: WhatsAppAgentScope[] = !role
    ? []
    : role.whatsappScopesPermitidos && role.whatsappScopesPermitidos.length > 0
    ? role.whatsappScopesPermitidos
    : deriveWhatsappScopesFromModules(allowedModules, role.tipoSistema);

  return {
    matchedUser,
    role,
    companyConfig,
    statusValidation: 'OK_AUTORIZADO',
    allowedWhatsappScopes,
    allowedModules,
  };
}

/**
 * Funciones de persistencia en cliente (Browser LocalStorage + sincronización automática con Backend `/api/security/state`)
 */
export function loadSecurityRbacStateFromStorage(): SecurityRbacStoreState {
  if (typeof window === 'undefined' || !window.localStorage) {
    return JSON.parse(JSON.stringify(DEFAULT_SECURITY_RBAC_STATE));
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_SECURITY_STATE);
    if (raw) {
      const parsed = JSON.parse(raw) as SecurityRbacStoreState;
      if (parsed && Array.isArray(parsed.roles) && Array.isArray(parsed.users)) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('[SecurityRBAC] Error leyendo estado local, usando default:', e);
  }
  return JSON.parse(JSON.stringify(DEFAULT_SECURITY_RBAC_STATE));
}

export function saveSecurityRbacStateToStorage(state: SecurityRbacStoreState): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(STORAGE_KEY_SECURITY_STATE, JSON.stringify(state));
    } catch (e) {
      console.warn('[SecurityRBAC] Error guardando en localStorage:', e);
    }
  }
  // Sincronizar asíncronamente con el servidor Node para que Vera en WhatsApp aplique los mismos roles/estados al instante
  if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
    fetch('/api/security/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state),
    }).catch(() => {});
  }
}

export interface PersistedAuthSession {
  userId: string;
  username: string;
  empresaId: string;
  loginTimestamp: string;
}

export function loadActiveAuthSession(): PersistedAuthSession | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_ACTIVE_SESSION);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedAuthSession;
  } catch {
    return null;
  }
}

export function saveActiveAuthSession(session: PersistedAuthSession | null): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    if (!session) {
      window.localStorage.removeItem(STORAGE_KEY_ACTIVE_SESSION);
    } else {
      window.localStorage.setItem(STORAGE_KEY_ACTIVE_SESSION, JSON.stringify(session));
    }
  } catch {}
}
