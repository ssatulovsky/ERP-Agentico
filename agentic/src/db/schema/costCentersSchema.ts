import {
  mysqlTable,
  varchar,
  text,
  decimal,
  date,
  datetime,
  boolean,
  mysqlEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/mysql-core';
import { sql, relations } from 'drizzle-orm';

// ============================================================================
// 1. TABLA: cost_centers (Centros de Costo / Mini-Empresas de Gestión)
// ============================================================================
export const costCenters = mysqlTable(
  'cost_centers',
  {
    id: varchar('id', { length: 36 }).primaryKey(), // UUID v4
    empresaId: varchar('empresa_id', { length: 36 }).notNull(),
    codigo: varchar('codigo', { length: 50 }).notNull(), // ej: "CC-ADM-01", "CC-VTA-STGO", "CC-PRD-QUELLON"
    nombre: varchar('nombre', { length: 200 }).notNull(),
    categoria: varchar('categoria', { length: 50 }).notNull(),
    responsableNombre: varchar('responsable_nombre', { length: 200 }).notNull(),
    responsableEmail: varchar('responsable_email', { length: 255 }),
    presupuestoMensualClp: decimal('presupuesto_mensual_clp', { precision: 15, scale: 2 })
      .notNull()
      .default('0.00'),
    activo: boolean('activo').notNull().default(true),
    descripcion: text('descripcion'),
    ventasAcumuladasMes: decimal('ventas_acumuladas_mes', { precision: 15, scale: 2 })
      .notNull()
      .default('0.00'),
    costosDirectosMes: decimal('costos_directos_mes', { precision: 15, scale: 2 })
      .notNull()
      .default('0.00'),
    gastosOperacionalesMes: decimal('gastos_operacionales_mes', { precision: 15, scale: 2 })
      .notNull()
      .default('0.00'),
    remuneracionesMes: decimal('remuneraciones_mes', { precision: 15, scale: 2 })
      .notNull()
      .default('0.00'),
    depreciacionMes: decimal('depreciacion_mes', { precision: 15, scale: 2 })
      .notNull()
      .default('0.00'),
    createdAt: datetime('created_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
  },
  (table) => ({
    uqCostCenterEmpresaCodigo: uniqueIndex('uq_cost_center_empresa_codigo').on(table.empresaId, table.codigo),
    idxCostCenterEmpresa: index('idx_cost_center_empresa').on(table.empresaId),
    idxCostCenterCategoria: index('idx_cost_center_categoria').on(table.categoria),
  })
);

// ============================================================================
// 2. TABLA: cost_center_imputations (Trazabilidad de Imputaciones Directas)
// ============================================================================
export const costCenterImputations = mysqlTable(
  'cost_center_imputations',
  {
    id: varchar('id', { length: 36 }).primaryKey(), // UUID v4
    empresaId: varchar('empresa_id', { length: 36 }).notNull(),
    centroCostoId: varchar('centro_costo_id', { length: 36 })
      .notNull()
      .references(() => costCenters.id, { onDelete: 'cascade' }),
    tipoDocumento: varchar('tipo_documento', { length: 50 }).notNull(), // 'DTE_FACTURA', 'NOMINA_REMUNERACIONES', 'VALE_BODEGA', 'ACTIVO_FIJO_DEPRECIACION'
    folioReferencia: varchar('folio_referencia', { length: 100 }).notNull(),
    fecha: date('fecha', { mode: 'string' }).notNull(),
    montoClp: decimal('monto_clp', { precision: 15, scale: 2 }).notNull(),
    concepto: varchar('concepto', { length: 255 }).notNull(),
    tipoFlujo: mysqlEnum('tipo_flujo', ['INGRESO', 'COSTO', 'GASTO']).notNull(),
    cuentaContable: varchar('cuenta_contable', { length: 50 }),
    createdAt: datetime('created_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
  },
  (table) => ({
    idxCcImputationCc: index('idx_cc_imputation_cc').on(table.centroCostoId),
    idxCcImputationEmpresaFecha: index('idx_cc_imputation_empresa_fecha').on(table.empresaId, table.fecha),
  })
);

export const costCentersRelations = relations(costCenters, ({ many }) => ({
  imputations: many(costCenterImputations),
}));

export const costCenterImputationsRelations = relations(costCenterImputations, ({ one }) => ({
  costCenter: one(costCenters, {
    fields: [costCenterImputations.centroCostoId],
    references: [costCenters.id],
  }),
}));

export type CostCenterRecord = typeof costCenters.$inferSelect;
export type NewCostCenterRecord = typeof costCenters.$inferInsert;

export type CostCenterImputationRecord = typeof costCenterImputations.$inferSelect;
export type NewCostCenterImputationRecord = typeof costCenterImputations.$inferInsert;
