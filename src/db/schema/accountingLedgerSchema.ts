import {
  mysqlTable,
  varchar,
  text,
  decimal,
  date,
  datetime,
  int,
  boolean,
  json,
  mysqlEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/mysql-core';
import { sql, relations } from 'drizzle-orm';

export const moduleSourceEnumValues = [
  'RCV_COMPRA',
  'RCV_VENTA',
  'BHE_HONORARIOS',
  'REMUNERACIONES',
  'F29_TRIBUTARIO',
  'BANCOS_CONCILIACION',
  'INVENTARIO_WMS',
  'IFRS16_LEASES',
  'MARKETING',
  'CUSTOMER_SERVICE',
  'MANUAL',
  'CIERRE',
] as const;

export type ModuleSource = (typeof moduleSourceEnumValues)[number];

// ============================================================================
// 1. TABLA: chart_of_accounts (Plan de Cuentas IFRS Parametrizado por Empresa)
// ============================================================================
export const chartOfAccounts = mysqlTable(
  'chart_of_accounts',
  {
    id: varchar('id', { length: 36 }).primaryKey(), // UUID v4
    empresaId: varchar('empresa_id', { length: 36 }).notNull(),
    codigoCuenta: varchar('codigo_cuenta', { length: 30 }).notNull(), // ej. '1.1.01.01'
    nombreCuenta: varchar('nombre_cuenta', { length: 200 }).notNull(),
    clasificacion: mysqlEnum('clasificacion', [
      'ACTIVO',
      'PASIVO',
      'PATRIMONIO',
      'INGRESOS',
      'COSTOS',
      'GASTOS',
    ]).notNull(),
    aceptaAuxiliar: boolean('acepta_auxiliar').notNull().default(false),
    createdAt: datetime('created_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
  },
  (table) => ({
    uqChartEmpresaCodigo: uniqueIndex('uq_chart_empresa_codigo').on(table.empresaId, table.codigoCuenta),
    idxChartClasificacion: index('idx_chart_clasificacion').on(table.empresaId, table.clasificacion),
  })
);

// ============================================================================
// 2. TABLA: accounting_entries (Libro Diario / Comprobantes Contables Inmutables)
// ============================================================================
export const accountingEntries = mysqlTable(
  'accounting_entries',
  {
    id: varchar('id', { length: 36 }).primaryKey(), // UUID v4
    firmId: varchar('firm_id', { length: 36 }).notNull().default('firm-default-001'), // Nivel 1 Estudio Contable
    empresaId: varchar('empresa_id', { length: 36 }).notNull(), // Nivel 2 Empresa
    periodo: varchar('periodo', { length: 7 }).notNull(), // Formato: 'AAAA-MM'
    fecha: date('fecha', { mode: 'string' }).notNull(), // Formato: 'AAAA-MM-DD'
    concepto: text('concepto').notNull(),
    documentoRef: varchar('documento_ref', { length: 100 }),
    origenModulo: varchar('origen_modulo', { length: 50 }).notNull(),
    totalDebe: decimal('total_debe', { precision: 15, scale: 2 }).notNull(),
    totalHaber: decimal('total_haber', { precision: 15, scale: 2 }).notNull(),
    creadoPorAgente: varchar('creado_por_agente', { length: 60 }).notNull(),
    autorizadoPorSupervisor: boolean('autorizado_por_supervisor').notNull().default(false),
    supervisorSignature: varchar('supervisor_signature', { length: 128 }).notNull(),
    createdAt: datetime('created_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
  },
  (table) => ({
    uqEntriesEmpresaOrigenDoc: uniqueIndex('uq_entries_empresa_origen_doc').on(
      table.empresaId,
      table.periodo,
      table.origenModulo,
      table.documentoRef
    ),
    idxEntriesEmpresaPeriodo: index('idx_entries_empresa_periodo').on(table.empresaId, table.periodo),
    idxEntriesFirmEmpresa: index('idx_entries_firm_empresa').on(table.firmId, table.empresaId),
    idxEntriesFecha: index('idx_entries_fecha').on(table.fecha),
  })
);

// ============================================================================
// 3. TABLA: accounting_entry_lines (Líneas de Detalle / Partidas Partida Doble)
// ============================================================================
export const accountingEntryLines = mysqlTable(
  'accounting_entry_lines',
  {
    id: varchar('id', { length: 36 }).primaryKey(), // UUID v4
    entryId: varchar('entry_id', { length: 36 })
      .notNull()
      .references(() => accountingEntries.id, { onDelete: 'cascade' }),
    lineaNumero: int('linea_numero').notNull().default(1),
    codigoCuenta: varchar('codigo_cuenta', { length: 30 }).notNull(),
    nombreCuenta: varchar('nombre_cuenta', { length: 200 }).notNull(),
    debe: decimal('debe', { precision: 15, scale: 2 }).notNull().default('0.00'),
    haber: decimal('haber', { precision: 15, scale: 2 }).notNull().default('0.00'),
    rutAuxiliar: varchar('rut_auxiliar', { length: 20 }),
    centroCosto: varchar('centro_costo', { length: 100 }),
  },
  (table) => ({
    idxLinesEntryId: index('idx_lines_entry_id').on(table.entryId),
    idxLinesCuentaRut: index('idx_lines_cuenta_rut').on(table.codigoCuenta, table.rutAuxiliar),
  })
);

// ============================================================================
// 4. TABLA: agent_audit_logs (Trazabilidad Pericial Inmutable de Agentes IA)
// ============================================================================
export const agentAuditLogs = mysqlTable(
  'agent_audit_logs',
  {
    id: varchar('id', { length: 36 }).primaryKey(), // UUID v4
    traceId: varchar('trace_id', { length: 64 }).notNull(),
    firmId: varchar('firm_id', { length: 36 }).notNull().default('firm-default-001'),
    empresaId: varchar('empresa_id', { length: 36 }).notNull(),
    agenteNombre: varchar('agente_nombre', { length: 60 }).notNull(),
    modulo: varchar('modulo', { length: 60 }).notNull().default('CONTABILIDAD'),
    accion: varchar('accion', { length: 100 }).notNull(),
    estadoTransicion: varchar('estado_transicion', { length: 50 }).notNull(),
    promptTokens: int('prompt_tokens'),
    completionTokens: int('completion_tokens'),
    modelName: varchar('model_name', { length: 50 }),
    promptHash: varchar('prompt_hash', { length: 64 }),
    payloadInput: json('payload_input').notNull(),
    payloadOutput: json('payload_output').notNull(),
    diffContable: json('diff_contable'),
    supervisorVeredicto: varchar('supervisor_veredicto', { length: 50 }),
    supervisorSignature: varchar('supervisor_signature', { length: 128 }),
    tiempoEjecucionMs: int('tiempo_ejecucion_ms').notNull(),
    createdAt: datetime('created_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
  },
  (table) => ({
    idxAuditTrace: index('idx_audit_trace').on(table.traceId),
    idxAuditEmpresaCreated: index('idx_audit_empresa_created').on(table.empresaId, table.createdAt),
    idxAuditFirm: index('idx_audit_firm').on(table.firmId),
  })
);

// ============================================================================
// RELACIONES DRIZZLE ORM
// ============================================================================
export const accountingEntriesRelations = relations(accountingEntries, ({ many }) => ({
  lines: many(accountingEntryLines),
}));

export const accountingEntryLinesRelations = relations(accountingEntryLines, ({ one }) => ({
  entry: one(accountingEntries, {
    fields: [accountingEntryLines.entryId],
    references: [accountingEntries.id],
  }),
}));

// ============================================================================
// TIPOS ESTRICTOS DE INFERENCIA DRIZZLE
// ============================================================================
export type ChartOfAccount = typeof chartOfAccounts.$inferSelect;
export type NewChartOfAccount = typeof chartOfAccounts.$inferInsert;

export type AccountingEntry = typeof accountingEntries.$inferSelect;
export type NewAccountingEntry = typeof accountingEntries.$inferInsert;

export type AccountingEntryLine = typeof accountingEntryLines.$inferSelect;
export type NewAccountingEntryLine = typeof accountingEntryLines.$inferInsert;

export type AgentAuditLog = typeof agentAuditLogs.$inferSelect;
export type NewAgentAuditLog = typeof agentAuditLogs.$inferInsert;
