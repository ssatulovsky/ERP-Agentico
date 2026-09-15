import {
  mysqlTable,
  varchar,
  decimal,
  date,
  datetime,
  int,
  uniqueIndex,
  index,
} from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';

// ============================================================================
// 1. ESQUEMA MULTI-TENANT JERÁRQUICO (Nivel 1 Estudio, Nivel 2 Empresa, Nivel 3 Módulos, Vault)
// ============================================================================
export * from './schema/tenancySchema';

// ============================================================================
// 2. LIBRO DIARIO, PLAN DE CUENTAS IFRS Y AUDITORÍA PERICIAL INMUTABLE
// ============================================================================
export * from './schema/accountingLedgerSchema';

// ============================================================================
// 3. MÓDULOS OPERATIVOS DEL ERP AGÉNTICO
// ============================================================================
export * from './schema/erpModulesSchema';

// ============================================================================
// 4. GOBERNANZA AGÉNTICA, CONTEXTO E INSTRUCCIONES ESPECIALES (MEMORIA)
// ============================================================================
export * from './schema/agentContextSchema';

// ============================================================================
// 5. MÓDULOS ESPECIALIZADOS DE INDUSTRIA Y CUMPLIMIENTO REGULATORIO CHILENO
// ============================================================================
export * from './schema/fixedAssetsSchema';
export * from './schema/productionCostingSchema';
export * from './schema/laborContractsSchema';
export * from './schema/treasurySchema';
export * from './schema/inventoryWmsSchema';
export * from './schema/employeesSchema';

// ============================================================================
// 6. TABLA: economic_indicators (Sincronización Histórica de Indicadores Chilenos)
// ============================================================================
export const economicIndicators = mysqlTable(
  'economic_indicators',
  {
    id: int('id').autoincrement().primaryKey(),
    codigo: varchar('codigo', { length: 10 }).notNull(), // 'UF' | 'USD' | 'UTM' | 'IPC'
    valor: decimal('valor', { precision: 12, scale: 4 }).notNull(),
    fecha: date('fecha', { mode: 'string' }).notNull(), // YYYY-MM-DD
    fuente: varchar('fuente', { length: 50 }).notNull(), // ej. 'mindicador.cl', 'bcentral.cl', 'cmf'
    createdAt: datetime('created_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
  },
  (table) => ({
    uqIndicadorFechaCodigo: uniqueIndex('uq_indicador_fecha_codigo').on(table.fecha, table.codigo),
    idxIndicadoresBusqueda: index('idx_indicadores_busqueda').on(table.codigo, table.fecha),
  })
);

export type EconomicIndicator = typeof economicIndicators.$inferSelect;
export type NewEconomicIndicator = typeof economicIndicators.$inferInsert;
