import type { ClientCompany } from '../types';

export type WhatsAppAgentScope =
  | 'FLUJO_CAJA'
  | 'BANCOS_CONCILIACION'
  | 'CONTABILIDAD_IFRS'
  | 'TRIBUTARIO_F29'
  | 'FACTURACION_DTE'
  | 'RRHH_REMUNERACIONES'
  | 'BODEGA_INVENTARIO'
  | 'PRODUCCION_COSTEO'
  | 'PRESUPUESTOS_COMERCIAL'
  | 'RENDICIONES_GASTOS'
  | 'PANORAMA_DIRECTORIO';

export interface WhatsAppAgentScopeMeta {
  id: WhatsAppAgentScope;
  nombre: string;
  agenteResponsable: string;
  descripcion: string;
  icono: string;
  ejemplosConsulta: string[];
}

export const WHATSAPP_AGENT_SCOPES_CATALOG: WhatsAppAgentScopeMeta[] = [
  {
    id: 'FLUJO_CAJA',
    nombre: 'Flujo de Caja & Tesorería',
    agenteResponsable: 'Vera Albornoz (Directora Financiera)',
    descripcion: 'Proyección de liquidez a 30/60/90 días, actualización a fecha de hoy y escenarios What-If.',
    icono: 'TrendingUp',
    ejemplosConsulta: ['Actualiza el flujo de caja partiendo de hoy', '¿Cuál es el flujo de caja proyectado?'],
  },
  {
    id: 'BANCOS_CONCILIACION',
    nombre: 'Bancos & Conciliación Bancaria',
    agenteResponsable: 'Vera Albornoz / Tesorería',
    descripcion: 'Saldos en línea de cuentas corrientes, estado de conciliación bancaria y partidas en tránsito.',
    icono: 'Landmark',
    ejemplosConsulta: ['¿Cómo está la conciliación bancaria?', 'Saldo disponible en bancos hoy'],
  },
  {
    id: 'RRHH_REMUNERACIONES',
    nombre: 'RRHH, Remuneraciones & Previred',
    agenteResponsable: 'Sofía Castro (Jefa de Nómina & Personas)',
    descripcion: 'Nómina de sueldos líquidos, imposiciones Previred, leyes sociales y vencimientos laborales.',
    icono: 'Users',
    ejemplosConsulta: ['¿Cuánto hay que pagar de sueldos e imposiciones?', 'Estado de Previred del mes'],
  },
  {
    id: 'BODEGA_INVENTARIO',
    nombre: 'Bodega, Stock & Inventarios',
    agenteResponsable: 'Diego Morales (Jefe de Bodega & Logística)',
    descripcion: 'Existencias físicas, stock de paño Dyneema, cabos, grilletes, valorización PMP y alertas de reposición.',
    icono: 'Package',
    ejemplosConsulta: ['¿Cuánto stock de paño Dyneema queda en bodega?', 'Reporte de inventario actual'],
  },
  {
    id: 'PRODUCCION_COSTEO',
    nombre: 'Órdenes de Producción & Costeo NIC 2',
    agenteResponsable: 'Roberto Soto (Jefe de Planta & Costeo)',
    descripcion: 'Avance físico de órdenes de fabricación en taller, consumo de materiales y desvío presupuestario.',
    icono: 'Factory',
    ejemplosConsulta: ['¿Cuál es el estado de la orden de producción?', 'Avance de fabricación Salmones Austral'],
  },
  {
    id: 'PRESUPUESTOS_COMERCIAL',
    nombre: 'Presupuestos & Pipeline Comercial',
    agenteResponsable: 'Vera Albornoz / Área Comercial',
    descripcion: 'Estado de cotizaciones enviadas a clientes, márgenes proyectados y seguimiento comercial.',
    icono: 'FileSpreadsheet',
    ejemplosConsulta: ['¿Cuál es el estado de los presupuestos enviados?', 'Pipeline de cotizaciones vigentes'],
  },
  {
    id: 'TRIBUTARIO_F29',
    nombre: 'Impuestos SII, IVA F29 & RCV',
    agenteResponsable: 'Jorge Rojas (Especialista Tributario SII)',
    descripcion: 'Determinación de IVA Débito/Crédito, PPM, retenciones de honorarios y monto a pagar en F29.',
    icono: 'FileCheck',
    ejemplosConsulta: ['¿Cuánto proyectamos pagar de F29 este mes?', 'Resumen de IVA y RCV SII'],
  },
  {
    id: 'FACTURACION_DTE',
    nombre: 'Facturación Electrónica DTE',
    agenteResponsable: 'Juan Pablo Silva (Agente Facturador SII)',
    descripcion: 'Consulta y emisión de Facturas Electrónicas (DTE 33/34), Notas de Crédito y estado SII.',
    icono: 'Receipt',
    ejemplosConsulta: ['Estado de facturas emitidas este mes', 'Emitir factura afecta'],
  },
  {
    id: 'CONTABILIDAD_IFRS',
    nombre: 'Contabilidad & Balance IFRS',
    agenteResponsable: 'Camila Valenzuela (Auditora Senior IFRS)',
    descripcion: 'Libro Diario, asientos contables, Balance de 8 Columnas y Estado de Resultados.',
    icono: 'BookOpen',
    ejemplosConsulta: ['Estado del balance y asientos del mes', 'Resultado contable acumulado'],
  },
  {
    id: 'RENDICIONES_GASTOS',
    nombre: 'Rendiciones de Gastos & Fondos Fijos',
    agenteResponsable: 'Andrés Fuentes (Control de Gastos)',
    descripcion: 'Estado de rendiciones de gastos por aprobar, reembolsos y saldos de fondos por rendir.',
    icono: 'Wallet',
    ejemplosConsulta: ['¿Hay rendiciones de gastos pendientes?', 'Estado de fondos por rendir'],
  },
  {
    id: 'PANORAMA_DIRECTORIO',
    nombre: 'Radiografía Ejecutiva 360° (Directorio)',
    agenteResponsable: 'Vera Albornoz (Socia Virtual)',
    descripcion: 'Resumen integral consolidando finanzas, bancos, RRHH, producción y ventas para socios.',
    icono: 'ShieldCheck',
    ejemplosConsulta: ['Dame un panorama general de la empresa', 'Resumen ejecutivo para directorio'],
  },
];

export type ErpModuleId =
  | 'executive_dashboard'
  | 'agents'
  | 'commercial_procurement'
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
    id: 'commercial_procurement',
    nombre: 'Gestión Comercial & Aprovisionamiento',
    categoria: 'COMERCIAL_SII',
    agenteNombre: 'Esteban Morales (Gerente Comercial & Aprovisionamiento Sr.)',
    descripcion: 'Equilibrio de márgenes, pronóstico de demanda, abastecimiento estratégico, anti-quiebres de stock y ventas.',
    whatsappScopes: ['PRESUPUESTOS_COMERCIAL', 'BODEGA_INVENTARIO'],
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
  mostrarPanelPruebasLogin?: boolean; // Si false, oculta el panel de perfiles de prueba en el Login (Modo Demo Cliente)
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
    esEditable: true,
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
      'Acceso a Agente Contable Senior, Libros Auxiliares, RCV SII, F29, Conciliación Bancaria, Gestión Comercial & Compras, Activo Fijo y Arriendos IFRS 16.',
    modulosPermitidos: [
      'ledger',
      'rcv',
      'commercial_procurement',
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
      'PRESUPUESTOS_COMERCIAL',
    ],
    esEditable: true,
    creadoPor: 'Admin',
    fechaActualizacion: '2026-03-01',
  },
  {
    id: 'role-compras-comercial',
    nombre: 'Gestión Comercial & Aprovisionamiento',
    codigo: 'COMERCIAL_COMPRAS',
    tipoSistema: 'CUSTOM',
    empresaScopeId: 'GLOBAL',
    descripcion:
      'Acceso exclusivo al Agente de Gestión Comercial y Aprovisionamiento Senior (Esteban Morales), Costos PMP, Cotizaciones, Licitaciones RFQ, Órdenes de Compra y Facturación.',
    modulosPermitidos: [
      'commercial_procurement',
      'billing_agent',
      'rcv',
      'inventory',
      'cost_centers',
    ],
    whatsappScopesPermitidos: [
      'PRESUPUESTOS_COMERCIAL',
      'BODEGA_INVENTARIO',
      'FACTURACION_DTE',
    ],
    esEditable: true,
    creadoPor: 'Admin',
    fechaActualizacion: '2026-10-21',
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
    empresasAnclasPermitidas: [],
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
    empresasAnclasPermitidas: [],
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
    id: 'usr-compras-01',
    username: 'compras',
    password: 'compras123',
    nombreCompleto: 'Esteban Morales (Jefe Comercial & Aprovisionamiento)',
    cargo: 'Encargado de Gestión Comercial, Forecasting y Compras',
    email: 'compras@innovagile.cl',
    telefonoWhatsapp: '56991122334',
    estado: 'ACTIVO',
    rolId: 'role-compras-comercial',
    empresaPrincipalId: 'client-retail-logistics',
    empresasAnclasPermitidas: ['client-agro-valle'],
    recibirAudioWhatsapp: true,
  },
  {
    id: 'usr-minera-suspendida',
    username: 'minera',
    password: '123456',
    nombreCompleto: 'Rodrigo Cifuentes (Minera del Sur)',
    cargo: 'Gerente de Operaciones Faena',
    email: 'adquisiciones@mineradelsur.cl',
    telefonoWhatsapp: '56955264890',
    estado: 'ACTIVO',
    rolId: 'role-admin',
    empresaPrincipalId: 'client-minera-sur',
    empresasAnclasPermitidas: [],
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
  mostrarPanelPruebasLogin: false, // Oculto por defecto para presentaciones / demos con clientes
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
  for (const c of state.companiesConfig || []) {
    existingMap.set(c.empresaId, c);
  }

  const clientIdsSet = new Set<string>();
  const mergedCompanies: CompanySecurityConfig[] = clients.map((client) => {
    clientIdsSet.add(client.id);
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

  // Conservar cualquier empresa adicional registrada en el estado del servidor/seguridad que no esté aún en clients
  for (const extra of state.companiesConfig || []) {
    if (!clientIdsSet.has(extra.empresaId)) {
      mergedCompanies.push(extra);
    }
  }

  return {
    ...state,
    companiesConfig: mergedCompanies.length > 0 ? mergedCompanies : DEFAULT_SECURITY_COMPANIES,
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
  const companiesSource =
    allCompanies && allCompanies.length > 0 ? allCompanies : DEFAULT_SECURITY_COMPANIES;

  if (role.tipoSistema === 'SUPERADMIN' || user.rolId === 'role-superadmin') {
    return companiesSource.map((c) => c.empresaId);
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
    const primaryComp = companiesSource.find((c) => c.empresaId === user.empresaPrincipalId);
    if (primaryComp?.empresasAnclasIds) {
      primaryComp.empresasAnclasIds.forEach((id) => allowedSet.add(id));
    }
    if (selectedCompanyId) {
      const selectedComp = companiesSource.find((c) => c.empresaId === selectedCompanyId);
      if (selectedComp?.empresasAnclasIds) {
        selectedComp.empresasAnclasIds.forEach((id) => allowedSet.add(id));
      }
    }
  }

  // Si por algún motivo el set quedó vacío, asignar la primera empresa disponible
  if (allowedSet.size === 0 && companiesSource[0]?.empresaId) {
    allowedSet.add(companiesSource[0].empresaId);
  }

  return Array.from(allowedSet);
}

/**
 * Resuelve las empresas autorizadas únicamente después de que el usuario ingresó su UserID / Email en el Login.
 * Protege la privacidad multi-empresa: los usuarios de la Empresa A jamás ven que existen las Empresas B, C o D.
 */
export function resolveCompaniesForLoginUsername(
  usernameInput: string,
  state: SecurityRbacStoreState
): {
  matchedUser: SecurityUser | null;
  role: SecurityRole | null;
  allowedCompanies: CompanySecurityConfig[];
  defaultCompanyId: string;
} {
  const cleanUser = (usernameInput || '').trim().toLowerCase();
  if (!cleanUser) {
    return {
      matchedUser: null,
      role: null,
      allowedCompanies: [],
      defaultCompanyId: '',
    };
  }

  const matchedUser = (state.users || []).find((u) => {
    const uName = (u.username || '').trim().toLowerCase();
    const uMail = (u.email || '').trim().toLowerCase();
    const uFull = (u.nombreCompleto || '').trim().toLowerCase();
    if (uName === cleanUser || (uMail && uMail === cleanUser) || (uFull && uFull === cleanUser)) {
      return true;
    }
    if (cleanUser === 'superadmin' && u.rolId === 'role-superadmin') return true;
    return false;
  });

  if (!matchedUser) {
    return {
      matchedUser: null,
      role: null,
      allowedCompanies: [],
      defaultCompanyId: '',
    };
  }

  const role =
    (state.roles || []).find((r) => r.id === matchedUser.rolId) ||
    DEFAULT_SECURITY_ROLES.find((r) => r.id === matchedUser.rolId) ||
    DEFAULT_SECURITY_ROLES[0];

  const companiesSource =
    state.companiesConfig && state.companiesConfig.length > 0
      ? state.companiesConfig
      : DEFAULT_SECURITY_COMPANIES;

  const allowedIds = resolveAllowedCompanyIdsForUser(
    matchedUser,
    role,
    companiesSource
  );

  let allowedCompanies = companiesSource.filter((c) =>
    allowedIds.includes(c.empresaId)
  );

  // Fallback de seguridad: si el usuario existe pero el ID de su empresa principal no coincidía o es SuperAdmin, asegurar que cargue empresas
  if (allowedCompanies.length === 0) {
    if (role.tipoSistema === 'SUPERADMIN' || matchedUser.rolId === 'role-superadmin') {
      allowedCompanies = [...companiesSource];
    } else if (companiesSource.length > 0) {
      allowedCompanies = [companiesSource[0]];
    }
  }

  const defaultCompanyId =
    matchedUser.empresaPrincipalId &&
    allowedCompanies.some((c) => c.empresaId === matchedUser.empresaPrincipalId)
      ? matchedUser.empresaPrincipalId
      : allowedCompanies[0]?.empresaId || '';

  return {
    matchedUser,
    role,
    allowedCompanies,
    defaultCompanyId,
  };
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
        return mergeSecurityRbacStates(parsed, DEFAULT_SECURITY_RBAC_STATE);
      }
    }
  } catch (e) {
    console.warn('[SecurityRBAC] Error leyendo estado local, usando default:', e);
  }
  return JSON.parse(JSON.stringify(DEFAULT_SECURITY_RBAC_STATE));
}

export function saveSecurityRbacStateToStorage(
  state: SecurityRbacStoreState,
  syncToServer = true
): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(STORAGE_KEY_SECURITY_STATE, JSON.stringify(state));
    } catch (e) {
      console.warn('[SecurityRBAC] Error guardando en localStorage:', e);
    }
  }
  // Sincronizar asíncronamente con el servidor Node para que Vera en WhatsApp y otras sesiones tengan los usuarios/roles al instante
  if (syncToServer && typeof window !== 'undefined' && typeof fetch !== 'undefined') {
    fetch('/api/security/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state),
    }).catch(() => {});
  }
}

/**
 * Fusiona el estado del servidor (`data/erp_security_rbac_state.json`) con el estado local
 * preservando todos los usuarios, superusuarios, roles y empresas dados de alta.
 */
export function mergeSecurityRbacStates(
  serverState: SecurityRbacStoreState | null | undefined,
  localState: SecurityRbacStoreState
): SecurityRbacStoreState {
  if (!serverState || !Array.isArray(serverState.users) || !Array.isArray(serverState.roles)) {
    return localState;
  }

  const defaultUsersMap = new Map<string, string>(
    DEFAULT_SECURITY_USERS.map((u) => [u.username.trim().toLowerCase(), JSON.stringify(u)])
  );

  // 1. Fusionar Roles
  const rolesMap = new Map<string, SecurityRole>();
  for (const r of DEFAULT_SECURITY_ROLES) rolesMap.set(r.id, r);
  for (const r of localState.roles || []) rolesMap.set(r.id, r);
  for (const r of serverState.roles || []) rolesMap.set(r.id, r);

  // Asegurar que roles estándar nuevos o actualizados no queden huérfanos ni desactualizados:
  for (const defaultRole of DEFAULT_SECURITY_ROLES) {
    if (!rolesMap.has(defaultRole.id)) {
      rolesMap.set(defaultRole.id, defaultRole);
    }
  }

  // Garantizar que SuperAdmin y Admin siempre contengan todos los módulos del catálogo actual
  const superadminRole = rolesMap.get('role-superadmin');
  if (superadminRole) {
    superadminRole.modulosPermitidos = [...ALL_ERP_MODULE_IDS];
    superadminRole.whatsappScopesPermitidos = deriveWhatsappScopesFromModules(ALL_ERP_MODULE_IDS, 'SUPERADMIN');
  }

  const adminRole = rolesMap.get('role-admin');
  if (adminRole) {
    if (!adminRole.modulosPermitidos.includes('commercial_procurement')) {
      adminRole.modulosPermitidos = [...ALL_ERP_MODULE_IDS];
    }
    adminRole.esEditable = true;
    adminRole.whatsappScopesPermitidos = deriveWhatsappScopesFromModules(adminRole.modulosPermitidos, 'ADMIN');
  }

  const contabilidadRole = rolesMap.get('role-contabilidad');
  if (contabilidadRole && !contabilidadRole.modulosPermitidos.includes('commercial_procurement')) {
    contabilidadRole.modulosPermitidos = [
      ...contabilidadRole.modulosPermitidos,
      'commercial_procurement',
    ];
    if (!contabilidadRole.whatsappScopesPermitidos.includes('PRESUPUESTOS_COMERCIAL')) {
      contabilidadRole.whatsappScopesPermitidos.push('PRESUPUESTOS_COMERCIAL');
    }
  }

  // 2. Fusionar Usuarios (por username en minúsculas para evitar duplicados y preservar altas nuevas de cualquier sesión)
  const usersByUsername = new Map<string, SecurityUser>();
  for (const u of DEFAULT_SECURITY_USERS) {
    usersByUsername.set(u.username.trim().toLowerCase(), u);
  }
  for (const u of serverState.users || []) {
    if (u && u.username) {
      usersByUsername.set(u.username.trim().toLowerCase(), u);
    }
  }
  for (const u of localState.users || []) {
    if (u && u.username) {
      const key = u.username.trim().toLowerCase();
      const existingOnServer = usersByUsername.get(key);
      const isDefaultUnchangedOnServer =
        existingOnServer && defaultUsersMap.get(key) === JSON.stringify(existingOnServer);
      // Si el usuario fue dado de alta en esta sesión (no existe aún en servidor) o fue editado localmente mientras el servidor tenía el seed por defecto
      if (!existingOnServer || isDefaultUnchangedOnServer) {
        usersByUsername.set(key, u);
      }
    }
  }

  // 3. Fusionar Empresas
  const companiesMap = new Map<string, CompanySecurityConfig>();
  for (const c of DEFAULT_SECURITY_COMPANIES) companiesMap.set(c.empresaId, c);
  for (const c of localState.companiesConfig || []) companiesMap.set(c.empresaId, c);
  for (const c of serverState.companiesConfig || []) companiesMap.set(c.empresaId, c);

  return {
    version: Math.max(serverState.version || 1, localState.version || 1),
    mostrarPanelPruebasLogin:
      serverState.mostrarPanelPruebasLogin !== undefined
        ? serverState.mostrarPanelPruebasLogin
        : localState.mostrarPanelPruebasLogin ?? false,
    companiesConfig: Array.from(companiesMap.values()),
    roles: Array.from(rolesMap.values()),
    users: Array.from(usersByUsername.values()),
  };
}

/**
 * Descarga desde el servidor (`/api/security/state`) la nómina real de usuarios, roles y empresas
 * para que cualquier sesión nueva (otro navegador, modo incógnito o nueva pestaña) tenga todos los usuarios creados.
 */
export async function fetchSecurityRbacStateFromServer(
  currentLocalState: SecurityRbacStoreState,
  clients?: ClientCompany[]
): Promise<SecurityRbacStoreState> {
  if (typeof window === 'undefined' || typeof fetch === 'undefined') {
    return currentLocalState;
  }
  try {
    const res = await fetch('/api/security/state', {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) return currentLocalState;
    const data = await res.json();
    if (data && data.success && data.state) {
      let merged = mergeSecurityRbacStates(data.state, currentLocalState);
      if (clients && clients.length > 0) {
        merged = ensureCompaniesSyncedWithSecurity(clients, merged);
      }
      // Si el estado fusionado contiene usuarios, roles o empresas que aún no estaban en el servidor, sincronizarlos de vuelta
      const serverUsersJson = JSON.stringify(data.state.users || []);
      const mergedUsersJson = JSON.stringify(merged.users || []);
      const shouldPushBack =
        mergedUsersJson !== serverUsersJson ||
        (merged.roles?.length || 0) > (data.state.roles?.length || 0) ||
        (merged.companiesConfig?.length || 0) > (data.state.companiesConfig?.length || 0);
      saveSecurityRbacStateToStorage(merged, shouldPushBack);
      return merged;
    }
  } catch (e) {
    console.warn('[SecurityRBAC] No se pudo sincronizar estado desde /api/security/state:', e);
  }
  return currentLocalState;
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

