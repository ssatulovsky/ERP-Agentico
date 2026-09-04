import { pgTable, uuid, varchar, text, numeric, boolean, timestamp, integer, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

/**
 * Tabla principal de Asientos Contables (Libro Diario / General Ledger)
 * Registra cada comprobante validado y autorizado por el Agente Supervisor.
 */
export const accountingEntries = pgTable('accounting_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  empresaId: varchar('empresa_id', { length: 20 }).notNull(),
  periodo: varchar('periodo', { length: 7 }).notNull(), // Formato: 'YYYY-MM'
  fecha: varchar('fecha', { length: 10 }).notNull(), // Formato: 'YYYY-MM-DD'
  concepto: text('concepto').notNull(),
  documentoRef: varchar('documento_ref', { length: 100 }),
  totalDebe: numeric('total_debe', { precision: 15, scale: 2 }).notNull(),
  totalHaber: numeric('total_haber', { precision: 15, scale: 2 }).notNull(),
  origenModulo: varchar('origen_modulo', { length: 50 }).notNull(), // 'RCV_COMPRA' | 'RCV_VENTA' | 'REMUNERACIONES' | 'F29_TRIBUTARIO' | 'TESORERIA' | 'MANUAL'
  creadoPorAgente: varchar('creado_por_agente', { length: 50 }).notNull(), // 'AGENTE_RCV' | 'AGENTE_RRHH' | 'AGENTE_F29' | 'AGENTE_TESORERIA' | 'OPERADOR_MANUAL'
  autorizadoPorSupervisor: boolean('autorizado_por_supervisor').default(false).notNull(),
  supervisorSignature: varchar('supervisor_signature', { length: 128 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Líneas de detalle de cada Asiento Contable (Partida Doble)
 */
export const accountingEntryLines = pgTable('accounting_entry_lines', {
  id: uuid('id').defaultRandom().primaryKey(),
  entryId: uuid('entry_id')
    .notNull()
    .references(() => accountingEntries.id, { onDelete: 'cascade' }),
  codigoCuenta: varchar('codigo_cuenta', { length: 30 }).notNull(),
  nombreCuenta: varchar('nombre_cuenta', { length: 200 }).notNull(),
  debe: numeric('debe', { precision: 15, scale: 2 }).default('0').notNull(),
  haber: numeric('haber', { precision: 15, scale: 2 }).default('0').notNull(),
  rutAuxiliar: varchar('rut_auxiliar', { length: 20 }),
  centroCosto: varchar('centro_costo', { length: 100 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Tabla de Auditoría Inmutable para Acciones Agénticas (Agent Audit Trail)
 */
export const agentAuditLogs = pgTable('agent_audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  traceId: varchar('trace_id', { length: 64 }).notNull(),
  empresaId: varchar('empresa_id', { length: 20 }).notNull(),
  agenteNombre: varchar('agente_nombre', { length: 100 }).notNull(),
  accion: varchar('accion', { length: 100 }).notNull(),
  estadoTransicion: varchar('estado_transicion', { length: 50 }).notNull(), // 'EJECUTANDO' | 'APROBADO' | 'RECHAZADO' | 'HITL'
  promptTokens: integer('prompt_tokens'),
  completionTokens: integer('completion_tokens'),
  modelName: varchar('model_name', { length: 50 }),
  promptHash: varchar('prompt_hash', { length: 64 }),
  payloadInput: jsonb('payload_input').notNull(),
  payloadOutput: jsonb('payload_output').notNull(),
  diffContable: jsonb('diff_contable'),
  supervisorVeredicto: varchar('supervisor_veredicto', { length: 50 }),
  supervisorSignature: varchar('supervisor_signature', { length: 128 }),
  tiempoEjecucionMs: integer('tiempo_ejecucion_ms').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Relaciones Drizzle
export const accountingEntriesRelations = relations(accountingEntries, ({ many }) => ({
  lines: many(accountingEntryLines),
}));

export const accountingEntryLinesRelations = relations(accountingEntryLines, ({ one }) => ({
  entry: one(accountingEntries, {
    fields: [accountingEntryLines.entryId],
    references: [accountingEntries.id],
  }),
}));

// Inferencia de Tipos
export type AccountingEntry = typeof accountingEntries.$inferSelect;
export type NewAccountingEntry = typeof accountingEntries.$inferInsert;

export type AccountingEntryLine = typeof accountingEntryLines.$inferSelect;
export type NewAccountingEntryLine = typeof accountingEntryLines.$inferInsert;

export type AgentAuditLog = typeof agentAuditLogs.$inferSelect;
export type NewAgentAuditLog = typeof agentAuditLogs.$inferInsert;
