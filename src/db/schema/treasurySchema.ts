import {
  mysqlTable,
  varchar,
  decimal,
  date,
  datetime,
  int,
  boolean,
  mysqlEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';
import { bankAccounts, bankTransactions } from './erpModulesSchema';
import { accountingEntries } from './accountingLedgerSchema';

// ============================================================================
// 1. TABLA: bank_reconciliations (Actas de Conciliación Bancaria Mensual)
// ============================================================================
export const bankReconciliations = mysqlTable(
  'bank_reconciliations',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    empresaId: varchar('empresa_id', { length: 36 }).notNull(),
    accountId: varchar('account_id', { length: 36 })
      .notNull()
      .references(() => bankAccounts.id, { onDelete: 'cascade' }),
    periodo: varchar('periodo', { length: 7 }).notNull(), // Formato AAAA-MM
    fechaConciliacion: date('fecha_conciliacion', { mode: 'string' }).notNull(),
    saldoSegunCartola: decimal('saldo_segun_cartola', { precision: 15, scale: 2 }).notNull(),
    saldoSegunLibroBanco: decimal('saldo_segun_libro_banco', { precision: 15, scale: 2 }).notNull(),
    depositosEnTransito: decimal('depositos_en_transito', { precision: 15, scale: 2 }).notNull().default('0.00'),
    chequesTransferenciasEnTransito: decimal('cheques_transferencias_en_transito', { precision: 15, scale: 2 })
      .notNull()
      .default('0.00'),
    novedadesCargosPendientes: decimal('novedades_cargos_pendientes', { precision: 15, scale: 2 })
      .notNull()
      .default('0.00'),
    novedadesAbonosPendientes: decimal('novedades_abonos_pendientes', { precision: 15, scale: 2 })
      .notNull()
      .default('0.00'),
    saldoConciliado: decimal('saldo_conciliado', { precision: 15, scale: 2 }).notNull(),
    diferencia: decimal('diferencia', { precision: 15, scale: 2 }).notNull().default('0.00'),
    cuadrado: boolean('cuadrado').notNull().default(true),
    totalMovimientosCartola: int('total_movimientos_cartola').notNull().default(0),
    totalConciliados: int('total_conciliados').notNull().default(0),
    totalPendientes: int('total_pendientes').notNull().default(0),
    totalNovedades: int('total_novedades').notNull().default(0),
    createdAt: datetime('created_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
  },
  (table) => ({
    uqBankRecon: uniqueIndex('uq_bank_recon_acc_periodo').on(table.accountId, table.periodo),
    idxBankReconEmpresa: index('idx_bank_recon_empresa').on(table.empresaId),
  })
);

// ============================================================================
// 2. TABLA: bank_novedades (Novedades Bancarias: Gastos, Comisiones, Intereses, PAC)
// ============================================================================
export const bankNovedades = mysqlTable(
  'bank_novedades',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    empresaId: varchar('empresa_id', { length: 36 }).notNull(),
    accountId: varchar('account_id', { length: 36 })
      .notNull()
      .references(() => bankAccounts.id, { onDelete: 'cascade' }),
    transactionId: varchar('transaction_id', { length: 36 }).references(() => bankTransactions.id, {
      onDelete: 'set null',
    }),
    fecha: date('fecha', { mode: 'string' }).notNull(),
    glosaBancaria: varchar('glosa_bancaria', { length: 255 }).notNull(),
    tipoNovedad: mysqlEnum('tipo_novedad', [
      'COMISION_MANTENCION',
      'COMISION_TRANSFERENCIAS',
      'GASTO_BANCARIO',
      'IMPUESTO_TIMBRES',
      'ABONO_NO_IDENTIFICADO',
      'CARGO_PAC_NO_REGISTRADO',
      'INTERES_A_FAVOR',
      'DIFERENCIA_MONTO',
      'OTRO',
    ]).notNull(),
    monto: decimal('monto', { precision: 15, scale: 2 }).notNull(),
    novedadRegistrada: boolean('novedad_registrada').notNull().default(false),
    asientoGeneradoId: varchar('asiento_generado_id', { length: 36 }).references(() => accountingEntries.id, {
      onDelete: 'set null',
    }),
    cuentaContableDebe: varchar('cuenta_contable_debe', { length: 30 }),
    cuentaContableHaber: varchar('cuenta_contable_haber', { length: 30 }),
    createdAt: datetime('created_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
  },
  (table) => ({
    idxNovedadEmpresa: index('idx_novedad_empresa').on(table.empresaId),
    idxNovedadAccount: index('idx_novedad_account').on(table.accountId),
    idxNovedadFecha: index('idx_novedad_fecha').on(table.fecha),
  })
);

export type BankReconciliationRecord = typeof bankReconciliations.$inferSelect;
export type NewBankReconciliationRecord = typeof bankReconciliations.$inferInsert;

export type BankNovedadRecord = typeof bankNovedades.$inferSelect;
export type NewBankNovedadRecord = typeof bankNovedades.$inferInsert;
