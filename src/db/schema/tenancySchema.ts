import {
  mysqlTable,
  varchar,
  datetime,
  date,
  boolean,
  text,
  json,
  int,
  decimal,
  mysqlEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/mysql-core';
import { sql, relations } from 'drizzle-orm';

// ============================================================================
// 1. TABLA: accounting_firms (Nivel 1: Estudio Contable Titular de Suscripción)
// ============================================================================
export const accountingFirms = mysqlTable(
  'accounting_firms',
  {
    id: varchar('id', { length: 36 }).primaryKey(), // UUID v4
    rut: varchar('rut', { length: 20 }).notNull().unique(),
    razonSocial: varchar('razon_social', { length: 255 }).notNull(),
    emailContacto: varchar('email_contacto', { length: 255 }).notNull(),
    plan: varchar('plan', { length: 50 }).notNull().default('ESTUDIO_PRO'),
    estado: mysqlEnum('estado', ['ACTIVO', 'SUSPENDIDO', 'DEMO']).notNull().default('ACTIVO'),
    createdAt: datetime('created_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
  },
  (table) => ({
    idxFirmRut: index('idx_firm_rut').on(table.rut),
  })
);

// ============================================================================
// 2. TABLA: companies (Nivel 2: Cliente del Estudio Contable / Empresa Operativa)
// ============================================================================
export const companies = mysqlTable(
  'companies',
  {
    id: varchar('id', { length: 36 }).primaryKey(), // UUID v4
    firmId: varchar('firm_id', { length: 36 })
      .notNull()
      .references(() => accountingFirms.id, { onDelete: 'cascade' }),
    rut: varchar('rut', { length: 20 }).notNull(),
    razonSocial: varchar('razon_social', { length: 255 }).notNull(),
    giro: varchar('giro', { length: 255 }).notNull(),
    regimenTributario: mysqlEnum('regimen_tributario', ['14_A', '14_D3', '14_D8']).notNull().default('14_D3'),
    tasaPpm: decimal('tasa_ppm', { precision: 5, scale: 4 }).notNull().default('0.0100'),
    tasaPpmVoluntaria: decimal('tasa_ppm_voluntaria', { precision: 5, scale: 4 }).default('0.0000'),
    // Parámetros de Ejercicio Fiscal y Cierre Contable (Art. 16 Código Tributario)
    mesCierreEjercicio: int('mes_cierre_ejercicio').notNull().default(12),
    diaCierreEjercicio: int('dia_cierre_ejercicio').notNull().default(31),
    ejercicioActivo: int('ejercicio_activo').notNull().default(2026),
    fechaInicioEjercicio: date('fecha_inicio_ejercicio', { mode: 'string' }),
    fechaFinEjercicio: date('fecha_fin_ejercicio', { mode: 'string' }),
    periodosCerrados: json('periodos_cerrados'), // Array de períodos ej: ["2026-01", "2026-02"]
    bloqueoPeriodoCerrado: boolean('bloqueo_periodo_cerrado').notNull().default(true),
    resolucionSiiCierreEspecial: varchar('resolucion_sii_cierre_especial', { length: 100 }),
    capitalPropioTributario: decimal('capital_propio_tributario', { precision: 15, scale: 2 }),
    patenteMunicipalTasaPorMil: decimal('patente_municipal_tasa_por_mil', { precision: 5, scale: 2 }).default('2.50'),
    remanenteCreditoFiscalUtm: decimal('remanente_credito_fiscal_utm', { precision: 10, scale: 4 }).default('0.0000'),
    remanenteCreditoFiscalClp: decimal('remanente_credito_fiscal_clp', { precision: 15, scale: 2 }).default('0.00'),
    esClienteAncla: boolean('es_cliente_ancla').notNull().default(false),
    // Extensión de Cliente Ancla y Plan de Contratación ERP
    planContratadoId: varchar('plan_contratado_id', { length: 50 }),
    planPrecioUf: decimal('plan_precio_uf', { precision: 10, scale: 2 }),
    fechaInicioContrato: date('fecha_inicio_contrato', { mode: 'string' }),
    fechaTerminoContrato: date('fecha_termino_contrato', { mode: 'string' }),
    limiteCreditoComercial: decimal('limite_credito_comercial', { precision: 15, scale: 2 }),
    diasCredito: int('dias_credito').default(30),
    cuentaContableCobroId: varchar('cuenta_contable_cobro_id', { length: 30 }).default('1.1.03.001'),
    cuentaContablePagoId: varchar('cuenta_contable_pago_id', { length: 30 }).default('2.1.01.001'),
    contactoCobranzaNombre: varchar('contacto_cobranza_nombre', { length: 150 }),
    contactoCobranzaEmail: varchar('contacto_cobranza_email', { length: 150 }),
    contactoCobranzaTelefono: varchar('contacto_cobranza_telefono', { length: 50 }),
    direccionComercial: varchar('direccion_comercial', { length: 255 }),
    ciudadComercial: varchar('ciudad_comercial', { length: 100 }),
    regionComercial: varchar('region_comercial', { length: 100 }),
    comunaComercial: varchar('comuna_comercial', { length: 100 }),
    createdAt: datetime('created_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
  },
  (table) => ({
    idxCompaniesFirmId: index('idx_companies_firm_id').on(table.firmId),
    idxCompaniesRut: index('idx_companies_rut').on(table.rut),
    uqCompaniesFirmRut: uniqueIndex('uq_companies_firm_rut').on(table.firmId, table.rut),
  })
);

// ============================================================================
// 3. TABLA: company_module_subscriptions (Nivel 3: Cliente Ancla con Módulos Autónomos)
// ============================================================================
export const companyModuleSubscriptions = mysqlTable(
  'company_module_subscriptions',
  {
    id: varchar('id', { length: 36 }).primaryKey(), // UUID v4
    empresaId: varchar('empresa_id', { length: 36 })
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    moduloCodigo: mysqlEnum('modulo_codigo', [
      'CORE_ACCOUNTING',
      'F29_TAX',
      'PAYROLL_DT',
      'INVENTORY_WMS',
      'BANK_RECON',
      'IFRS16_LEASES',
      'MARKETING_AGENT',
      'CUSTOMER_SERVICE_AI',
    ]).notNull(),
    pagadoPor: mysqlEnum('pagado_por', ['ESTUDIO', 'CLIENTE_DIRECTO']).notNull().default('ESTUDIO'),
    estado: mysqlEnum('subscription_estado', ['ACTIVO', 'SUSPENDIDO']).notNull().default('ACTIVO'),
    fechaRenovacion: date('fecha_renovacion', { mode: 'string' }),
    createdAt: datetime('created_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
  },
  (table) => ({
    uqCompanyModule: uniqueIndex('uq_company_modulo').on(table.empresaId, table.moduloCodigo),
    idxSubscriptionEmpresa: index('idx_subscription_empresa').on(table.empresaId),
  })
);

// ============================================================================
// 4. TABLA: company_credentials_vault (Vault Seguro AES-256-GCM para SII y Bancos)
// ============================================================================
export const companyCredentialsVault = mysqlTable(
  'company_credentials_vault',
  {
    id: varchar('id', { length: 36 }).primaryKey(), // UUID v4
    empresaId: varchar('empresa_id', { length: 36 })
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' })
      .unique(),
    certificadoDigitalEncrypted: text('certificado_digital_encrypted'), // PKCS#12 cifrado
    claveCertificadoEncrypted: text('clave_certificado_encrypted'),
    claveSiiEncrypted: text('clave_sii_encrypted'),
    apiBancosEncrypted: json('api_bancos_encrypted'), // Token / secretos bancarios cifrados
    iv: varchar('iv', { length: 32 }).notNull(), // Vector de inicialización AES
    tagAuth: varchar('tag_auth', { length: 32 }).notNull(), // Tag de autenticación GCM
    updatedAt: datetime('updated_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
  },
  (table) => ({
    idxVaultEmpresa: index('idx_vault_empresa').on(table.empresaId),
  })
);

// ============================================================================
// 5. TABLA: erp_subscription_plans (Catálogo de Planes ERP SaaS para Estudios y Clientes)
// ============================================================================
export const erpSubscriptionPlans = mysqlTable(
  'erp_subscription_plans',
  {
    id: varchar('id', { length: 50 }).primaryKey(), // ej: 'PLAN_STARTER', 'PLAN_PRO'
    nombre: varchar('nombre', { length: 150 }).notNull(),
    precioUfMensual: decimal('precio_uf_mensual', { precision: 10, scale: 2 }).notNull(),
    empresasRutMax: int('empresas_rut_max').notNull(),
    usuariosMax: int('usuarios_max').notNull(),
    almacenamientoGb: int('almacenamiento_gb').notNull().default(20),
    tipoServicio: varchar('tipo_servicio', { length: 50 }).notNull().default('SaaS Cloud'),
    modulosIncluidos: json('modulos_incluidos').notNull(),
    activo: boolean('activo').notNull().default(true),
    createdAt: datetime('created_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
  }
);

// ============================================================================
// 6. TABLA: erp_system_parameters (Parámetros Generales de Sistema y Cierre Legal Art. 16 CT)
// ============================================================================
export const erpSystemParameters = mysqlTable(
  'erp_system_parameters',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    firmId: varchar('firm_id', { length: 36 }).notNull(),
    empresaId: varchar('empresa_id', { length: 36 }),
    anoEjercicioActivo: int('ano_ejercicio_activo').notNull().default(2026),
    mesCierreEjercicio: int('mes_cierre_ejercicio').notNull().default(12),
    diaCierreEjercicio: int('dia_cierre_ejercicio').notNull().default(31),
    tipoCierreLegal: mysqlEnum('tipo_cierre_legal', ['ART_16_CODIGO_TRIBUTARIO', 'RESOLUCION_ESPECIAL_SII']).notNull().default('ART_16_CODIGO_TRIBUTARIO'),
    resolucionSii: varchar('resolucion_sii', { length: 100 }),
    monedaNacional: varchar('moneda_nacional', { length: 10 }).notNull().default('CLP'),
    multimonedaActivo: boolean('multimoneda_activo').notNull().default(false),
    toleranciaCentavosAsiento: decimal('tolerancia_centavos_asiento', { precision: 5, scale: 2 }).notNull().default('0.00'),
    cuentaAjusteSencillo: varchar('cuenta_ajuste_sencillo', { length: 30 }).notNull().default('5.2.09.099'),
    cuentaDiferenciaCambioGanancia: varchar('cuenta_diferencia_cambio_ganancia', { length: 30 }).notNull().default('4.2.01.005'),
    cuentaDiferenciaCambioPerdida: varchar('cuenta_diferencia_cambio_perdida', { length: 30 }).notNull().default('5.2.01.008'),
    cuentaCorreccionMonetaria: varchar('cuenta_correccion_monetaria', { length: 30 }).notNull().default('5.2.01.009'),
    cuentaResultadoEjercicio: varchar('cuenta_resultado_ejercicio', { length: 30 }).notNull().default('3.3.02.001'),
    fechaMinimaImputacion: date('fecha_minima_imputacion', { mode: 'string' }),
    fechaMaximaImputacion: date('fecha_maxima_imputacion', { mode: 'string' }),
    bloquearPeriodosCerrados: boolean('bloquear_periodos_cerrados').notNull().default(true),
    updatedAt: datetime('updated_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
  },
  (table) => ({
    idxParamsFirmEmpresa: index('idx_params_firm_empresa').on(table.firmId, table.empresaId),
  })
);

// ============================================================================
// 7. TABLA: chart_of_accounts_hierarchy (Agrupaciones IFRS de Cuentas)
// ============================================================================
export const chartOfAccountsHierarchy = mysqlTable(
  'chart_of_accounts_hierarchy',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    codigo: varchar('codigo', { length: 30 }).notNull(),
    descripcion: varchar('descripcion', { length: 255 }).notNull(),
    tipoCuenta: mysqlEnum('tipo_cuenta', ['ACTIVO', 'PASIVO', 'PATRIMONIO', 'RESULTADO']).notNull(),
    codPadre: varchar('cod_padre', { length: 30 }),
    ordenFecu: int('orden_fecu').default(0),
    createdAt: datetime('created_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
  },
  (table) => ({
    uqHierarchyCodigo: uniqueIndex('uq_hierarchy_codigo').on(table.codigo),
  })
);

// ============================================================================
// 8. TABLA: client_auxiliaries_master (Padrón Maestro de Auxiliares Clientes/Proveedores SII)
// ============================================================================
export const clientAuxiliariesMaster = mysqlTable(
  'client_auxiliaries_master',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    empresaId: varchar('empresa_id', { length: 36 }).notNull(),
    rutCompleto: varchar('rut_completo', { length: 20 }).notNull(),
    codigoAuxiliar: varchar('codigo_auxiliar', { length: 50 }).notNull(),
    razonSocial: varchar('razon_social', { length: 255 }).notNull(),
    nombreFantasia: varchar('nombre_fantasia', { length: 255 }),
    giroComercial: varchar('giro_comercial', { length: 255 }).notNull(),
    inactivo: boolean('inactivo').notNull().default(false),
    telefonoPrincipal: varchar('telefono_principal', { length: 50 }),
    emailContacto: varchar('email_contacto', { length: 150 }),
    nombreContacto: varchar('nombre_contacto', { length: 150 }),
    emailDte: varchar('email_dte', { length: 150 }).notNull(),
    direccion: varchar('direccion', { length: 255 }).notNull(),
    region: varchar('region', { length: 100 }).notNull(),
    ciudad: varchar('ciudad', { length: 100 }).notNull(),
    comuna: varchar('comuna', { length: 100 }).notNull(),
    tipoAuxiliar: mysqlEnum('tipo_auxiliar', ['CLIENTE', 'PROVEEDOR', 'AMBOS', 'HONORARIOS']).notNull().default('CLIENTE'),
    limiteCredito: decimal('limite_credito', { precision: 15, scale: 2 }).default('0.00'),
    terminosPago: varchar('terminos_pago', { length: 100 }).default('30 días factura'),
    vendedor: varchar('vendedor', { length: 150 }),
    descuentoPorcentaje: decimal('descuento_porcentaje', { precision: 5, scale: 2 }).default('0.00'),
    sucursales: json('sucursales'),
    createdAt: datetime('created_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
    updatedAt: datetime('updated_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
  },
  (table) => ({
    uqAuxiliarEmpresaRut: uniqueIndex('uq_auxiliar_empresa_rut').on(table.empresaId, table.rutCompleto),
    idxAuxiliarEmpresaTipo: index('idx_auxiliar_empresa_tipo').on(table.empresaId, table.tipoAuxiliar),
  })
);

// ============================================================================
// 9. TABLA: client_onboarding_audit (Auditoría de Altas ERP)
// ============================================================================
export const clientOnboardingAudit = mysqlTable(
  'client_onboarding_audit',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    firmId: varchar('firm_id', { length: 36 }).notNull(),
    empresaId: varchar('empresa_id', { length: 36 }).notNull(),
    planId: varchar('plan_id', { length: 50 }).notNull(),
    valorUfMensual: decimal('valor_uf_mensual', { precision: 10, scale: 2 }).notNull(),
    fechaInicioContrato: date('fecha_inicio_contrato', { mode: 'string' }).notNull(),
    fechaTerminoContrato: date('fecha_termino_contrato', { mode: 'string' }),
    aprobadoPor: varchar('aprobado_por', { length: 100 }).notNull().default('SISTEMA'),
    createdAt: datetime('created_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
  },
  (table) => ({
    idxOnboardingFirmEmpresa: index('idx_onboarding_firm_empresa').on(table.firmId, table.empresaId),
  })
);

// ============================================================================
// RELACIONES DRIZZLE ORM
// ============================================================================
export const accountingFirmsRelations = relations(accountingFirms, ({ many }) => ({
  companies: many(companies),
}));

export const companiesRelations = relations(companies, ({ one, many }) => ({
  firm: one(accountingFirms, {
    fields: [companies.firmId],
    references: [accountingFirms.id],
  }),
  moduleSubscriptions: many(companyModuleSubscriptions),
  credentialsVault: one(companyCredentialsVault, {
    fields: [companies.id],
    references: [companyCredentialsVault.empresaId],
  }),
  auxiliaries: many(clientAuxiliariesMaster),
}));

export const companyModuleSubscriptionsRelations = relations(companyModuleSubscriptions, ({ one }) => ({
  company: one(companies, {
    fields: [companyModuleSubscriptions.empresaId],
    references: [companies.id],
  }),
}));

export const companyCredentialsVaultRelations = relations(companyCredentialsVault, ({ one }) => ({
  company: one(companies, {
    fields: [companyCredentialsVault.empresaId],
    references: [companies.id],
  }),
}));

export const clientAuxiliariesMasterRelations = relations(clientAuxiliariesMaster, ({ one }) => ({
  company: one(companies, {
    fields: [clientAuxiliariesMaster.empresaId],
    references: [companies.id],
  }),
}));

// ============================================================================
// TIPOS ESTRICTOS DE INFERENCIA DRIZZLE
// ============================================================================
export type AccountingFirm = typeof accountingFirms.$inferSelect;
export type NewAccountingFirm = typeof accountingFirms.$inferInsert;

export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;

export type CompanyModuleSubscription = typeof companyModuleSubscriptions.$inferSelect;
export type NewCompanyModuleSubscription = typeof companyModuleSubscriptions.$inferInsert;

export type CompanyCredentialsVault = typeof companyCredentialsVault.$inferSelect;
export type NewCompanyCredentialsVault = typeof companyCredentialsVault.$inferInsert;

export type ErpSubscriptionPlan = typeof erpSubscriptionPlans.$inferSelect;
export type NewErpSubscriptionPlan = typeof erpSubscriptionPlans.$inferInsert;

export type ErpSystemParameter = typeof erpSystemParameters.$inferSelect;
export type NewErpSystemParameter = typeof erpSystemParameters.$inferInsert;

export type ChartOfAccountsHierarchy = typeof chartOfAccountsHierarchy.$inferSelect;
export type NewChartOfAccountsHierarchy = typeof chartOfAccountsHierarchy.$inferInsert;

export type ClientAuxiliaryMaster = typeof clientAuxiliariesMaster.$inferSelect;
export type NewClientAuxiliaryMaster = typeof clientAuxiliariesMaster.$inferInsert;

export type ClientOnboardingAudit = typeof clientOnboardingAudit.$inferSelect;
export type NewClientOnboardingAudit = typeof clientOnboardingAudit.$inferInsert;

