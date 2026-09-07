import {
  mysqlTable,
  varchar,
  datetime,
  date,
  boolean,
  text,
  json,
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
    esClienteAncla: boolean('es_cliente_ancla').notNull().default(false),
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
