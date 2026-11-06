import {
  mysqlTable,
  varchar,
  decimal,
  date,
  datetime,
  boolean,
  json,
  index,
  uniqueIndex,
} from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';

// ============================================================================
// TABLA: cash_flow_indirect_reports (Reportes de Flujo de Efectivo Método Indirecto NIC 7)
// ============================================================================
export const cashFlowIndirectReports = mysqlTable(
  'cash_flow_indirect_reports',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    firmId: varchar('firm_id', { length: 36 }).notNull().default('firm-default-001'),
    empresaId: varchar('empresa_id', { length: 36 }).notNull(),
    periodo: varchar('periodo', { length: 7 }).notNull(), // Formato: 'AAAA-MM'
    periodoComparativo: varchar('periodo_comparativo', { length: 7 }),
    fechaEmision: date('fecha_emision', { mode: 'string' }).notNull(),
    
    // Magnitudes Financieras Principales
    resultadoNeto: decimal('resultado_neto', { precision: 15, scale: 2 }).notNull().default('0.00'),
    totalAjustesNoEfectivo: decimal('total_ajustes_no_efectivo', { precision: 15, scale: 2 }).notNull().default('0.00'),
    totalVariacionCapitalTrabajo: decimal('total_variacion_capital_trabajo', { precision: 15, scale: 2 }).notNull().default('0.00'),
    flujoNetoOperacional: decimal('flujo_neto_operacional', { precision: 15, scale: 2 }).notNull().default('0.00'),
    flujoNetoInversion: decimal('flujo_neto_inversion', { precision: 15, scale: 2 }).notNull().default('0.00'),
    flujoNetoFinanciamiento: decimal('flujo_neto_financiamiento', { precision: 15, scale: 2 }).notNull().default('0.00'),
    variacionNetaEfectivo: decimal('variacion_neta_efectivo', { precision: 15, scale: 2 }).notNull().default('0.00'),
    
    // Conciliación de Efectivo y Saldos
    saldoInicialEfectivo: decimal('saldo_inicial_efectivo', { precision: 15, scale: 2 }).notNull().default('0.00'),
    saldoFinalEfectivo: decimal('saldo_final_efectivo', { precision: 15, scale: 2 }).notNull().default('0.00'),
    efectoTipoCambio: decimal('efecto_tipo_cambio', { precision: 15, scale: 2 }).notNull().default('0.00'),
    diferenciaCuadratura: decimal('diferencia_cuadratura', { precision: 15, scale: 2 }).notNull().default('0.00'),
    estaCuadrado: boolean('esta_cuadrado').notNull().default(true),
    
    // Estructuras Desglosadas en JSON
    partidasOperacion: json('partidas_operacion').notNull(),
    partidasInversion: json('partidas_inversion').notNull(),
    partidasFinanciamiento: json('partidas_financiamiento').notNull(),
    desgloseEfectivo: json('desglose_efectivo').notNull(),
    diagnosticoAgente: json('diagnostico_agente').notNull(),
    
    // Gobernanza y Trazabilidad del Asistente con herramientas
    agenteAuditorNombre: varchar('agente_auditor_nombre', { length: 100 }).notNull().default('Agente Especialista Flujo Efectivo NIC 7'),
    agenteSignature: varchar('agente_signature', { length: 128 }).notNull(),
    hashIntegridadSha256: varchar('hash_integridad_sha256', { length: 64 }).notNull(),
    
    createdAt: datetime('created_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
    updatedAt: datetime('updated_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
  },
  (table) => ({
    uqCashFlowEmpresaPeriodo: uniqueIndex('uq_cash_flow_empresa_periodo').on(table.empresaId, table.periodo),
    idxCashFlowPeriodo: index('idx_cash_flow_periodo').on(table.empresaId, table.periodo),
    idxCashFlowFirm: index('idx_cash_flow_firm').on(table.firmId, table.empresaId),
  })
);

export type CashFlowIndirectReportRecord = typeof cashFlowIndirectReports.$inferSelect;
export type NewCashFlowIndirectReportRecord = typeof cashFlowIndirectReports.$inferInsert;
