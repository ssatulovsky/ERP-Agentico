import {
  mysqlTable,
  varchar,
  text,
  datetime,
  int,
  boolean,
  json,
  mysqlEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/mysql-core';
import { sql, relations } from 'drizzle-orm';
import { companies } from './tenancySchema';

// ============================================================================
// ENUMS Y CONSTANTES DEL SUBSISTEMA DE GOBERNANZA AGÉNTICA
// ============================================================================

export const agentModuleEnumValues = [
  'RRHH',
  'SII_RCV',
  'F29_TAX',
  'BANK_RECON',
  'INVENTORY_WMS',
  'ACCOUNTING_LEDGER',
] as const;

export type AgentModuleCode = (typeof agentModuleEnumValues)[number];

export const learningCategoryEnumValues = [
  'ERROR_IMPUTACION',
  'DESCUADRE_PARTIDA_DOBLE',
  'NORMATIVA_SII',
  'RECHAZO_SUPERVISOR',
  'PREFERENCIA_CLIENTE',
] as const;

export type LearningCategory = (typeof learningCategoryEnumValues)[number];

// ============================================================================
// 1. TABLA: company_agent_configs (Instrucciones Especiales y Directivas Ad-Hoc)
// ============================================================================
export const companyAgentConfigs = mysqlTable(
  'company_agent_configs',
  {
    id: varchar('id', { length: 36 }).primaryKey(), // UUID v4
    empresaId: varchar('empresa_id', { length: 36 })
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    moduloCodigo: mysqlEnum('modulo_codigo', agentModuleEnumValues).notNull(),
    instruccionesEspeciales: text('instrucciones_especiales'),
    parametrosOperativos: json('parametros_operativos').notNull().$type<{
      rutaDocumentosContratos?: string;
      reglasImputacionEspecificas?: Array<{
        tipoGasto: string;
        codigoCuentaSugerido: string;
        nombreCuentaSugerido: string;
        justificacion?: string;
      }>;
      excluirProveedoresAcuse?: string[];
      limiteMontoAutoAprobacion?: number;
      requiereAprobacionSocio?: boolean;
      centroCostoPorDefecto?: string;
      [key: string]: any;
    }>(),
    activo: boolean('activo').notNull().default(true),
    updatedAt: datetime('updated_at', { fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)`)
      .notNull(),
  },
  (table) => ({
    uqEmpresaModulo: uniqueIndex('uq_empresa_modulo').on(table.empresaId, table.moduloCodigo),
    idxConfigEmpresa: index('idx_config_empresa').on(table.empresaId),
    idxConfigModulo: index('idx_config_modulo').on(table.moduloCodigo),
  })
);

// ============================================================================
// 2. TABLA: agent_learnings (Base de Conocimiento y Memoria de Aprendizaje)
// ============================================================================
export const agentLearnings = mysqlTable(
  'agent_learnings',
  {
    id: varchar('id', { length: 36 }).primaryKey(), // UUID v4
    empresaId: varchar('empresa_id', { length: 36 }), // NULL si es global del sistema o UUID específico
    moduloCodigo: varchar('modulo_codigo', { length: 50 }).notNull(),
    categoria: mysqlEnum('categoria', learningCategoryEnumValues).notNull(),
    descripcionError: text('descripcion_error').notNull(),
    solucionAplicada: text('solucion_aplicada').notNull(),
    asientoIncorrectoJson: json('asiento_incorrecto_json'),
    asientoCorregidoJson: json('asiento_corregido_json'),
    vecesEvitado: int('veces_evitado').notNull().default(0),
    activo: boolean('activo').notNull().default(true),
    createdAt: datetime('created_at', { fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),
  },
  (table) => ({
    idxLearningsEmpresaModulo: index('idx_learnings_empresa_modulo').on(
      table.empresaId,
      table.moduloCodigo
    ),
    idxLearningsCategoria: index('idx_learnings_categoria').on(table.categoria),
    idxLearningsActivo: index('idx_learnings_activo').on(table.activo),
  })
);

// ============================================================================
// RELACIONES DRIZZLE ORM
// ============================================================================
export const companyAgentConfigsRelations = relations(companyAgentConfigs, ({ one }) => ({
  company: one(companies, {
    fields: [companyAgentConfigs.empresaId],
    references: [companies.id],
  }),
}));

export const agentLearningsRelations = relations(agentLearnings, ({ one }) => ({
  company: one(companies, {
    fields: [agentLearnings.empresaId],
    references: [companies.id],
  }),
}));

// ============================================================================
// TIPOS ESTRICTOS DE INFERENCIA DRIZZLE
// ============================================================================
export type CompanyAgentConfig = typeof companyAgentConfigs.$inferSelect;
export type NewCompanyAgentConfig = typeof companyAgentConfigs.$inferInsert;

export type AgentLearning = typeof agentLearnings.$inferSelect;
export type NewAgentLearning = typeof agentLearnings.$inferInsert;
