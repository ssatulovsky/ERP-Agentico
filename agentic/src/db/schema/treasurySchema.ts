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
    moneda: varchar('moneda', { length: 10 }).notNull().default('CLP'),
    tipoCambioCierre: decimal('tipo_cambio_cierre', { precision: 12, scale: 4 }).default('1.0000'),
    diferencialCambioMonto: decimal('diferencial_cambio_monto', { precision: 15, scale: 2 }).default('0.00'),
    asientoDiferencialCambioId: varchar('asiento_diferencial_cambio_id', { length: 36 }).references(
      () => accountingEntries.id,
      { onDelete: 'set null' }
    ),
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

// ============================================================================
// 3. TABLA: cash_flow_movements (Movimientos & Proyecciones Diarias de Flujo de Caja)
// ============================================================================
export const cashFlowMovements = mysqlTable(
  'cash_flow_movements',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    empresaId: varchar('empresa_id', { length: 36 }).notNull(),
    fechaEstimada: date('fecha_estimada', { mode: 'string' }).notNull(),
    fechaReal: date('fecha_real', { mode: 'string' }),
    concepto: varchar('concepto', { length: 255 }).notNull(),
    contraparte: varchar('contraparte', { length: 255 }).notNull(),
    rutContraparte: varchar('rut_contraparte', { length: 20 }),
    montoNeto: decimal('monto_neto', { precision: 15, scale: 2 }).notNull().default('0.00'),
    montoIva: decimal('monto_iva', { precision: 15, scale: 2 }).notNull().default('0.00'),
    montoTotal: decimal('monto_total', { precision: 15, scale: 2 }).notNull(),
    montoClp: decimal('monto_clp', { precision: 15, scale: 2 }).notNull().default('0.00'),
    moneda: mysqlEnum('cf_moneda', ['CLP', 'UF', 'USD', 'EUR']).notNull().default('CLP'),
    valorUfReferencia: decimal('valor_uf_referencia', { precision: 12, scale: 4 }),
    tipoCambio: decimal('tipo_cambio', { precision: 12, scale: 4 }).default('1.0000'),
    estado: mysqlEnum('cf_estado', ['PENDIENTE', 'FACTURADO', 'COBRADO', 'PAGADO', 'VENCIDO'])
      .notNull()
      .default('PENDIENTE'),
    tipo: mysqlEnum('cf_tipo', ['INGRESO', 'EGRESO']).notNull(),
    categoria: varchar('categoria', { length: 50 }).notNull(),
    dteFolioAsociado: int('dte_folio_asociado'),
    origenModulo: varchar('origen_modulo', { length: 50 }).default('MANUAL'),
    probabilidadCobroPct: int('probabilidad_cobro_pct').default(100),
    cuentaBancariaId: varchar('cuenta_bancaria_id', { length: 36 }).references(() => bankAccounts.id, {
      onDelete: 'set null',
    }),
    alertaRiesgo: varchar('alerta_riesgo', { length: 255 }),
    documentoReferencia: varchar('documento_referencia', { length: 100 }),
    fechaOriginal: date('fecha_original', { mode: 'string' }),
    reprogramado: boolean('reprogramado').notNull().default(false),
    motivoReprogramacion: varchar('motivo_reprogramacion', { length: 255 }),
    createdAt: datetime('created_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
  },
  (table) => ({
    idxCfEmpresaFecha: index('idx_cf_empresa_fecha').on(table.empresaId, table.fechaEstimada),
    idxCfTipoEstado: index('idx_cf_tipo_estado').on(table.empresaId, table.tipo, table.estado),
    idxCfCuentaBanco: index('idx_cf_cuenta_banco').on(table.cuentaBancariaId),
  })
);

// ============================================================================
// 4. TABLA: cash_flow_excel_styles (Plantillas y Diseños Gráficos Excel Personalizados)
// ============================================================================
export const cashFlowExcelStyles = mysqlTable(
  'cash_flow_excel_styles',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    empresaId: varchar('empresa_id', { length: 36 }).notNull(),
    nombreTema: varchar('nombre_tema', { length: 100 }).notNull(),
    configJson: varchar('config_json', { length: 4000 }).notNull(), // JSON serializado de CashFlowExcelThemeConfig
    esDefault: boolean('es_default').notNull().default(false),
    createdAt: datetime('created_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
    updatedAt: datetime('updated_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
  },
  (table) => ({
    idxExcelStylesEmpresa: index('idx_excel_styles_empresa').on(table.empresaId),
  })
);

// ============================================================================
// 5. TABLA: treasury_expense_provisions (Provisiones de Egresos Contables & Extracontables)
// ============================================================================
export const treasuryExpenseProvisions = mysqlTable(
  'treasury_expense_provisions',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    empresaId: varchar('empresa_id', { length: 36 }).notNull(),
    concepto: varchar('concepto', { length: 255 }).notNull(),
    tipoProvision: varchar('tipo_provision', { length: 50 }).notNull().default('OTRO'),
    naturaleza: varchar('naturaleza', { length: 20 }).notNull().default('CONTABLE'), // CONTABLE | EXTRACONTABLE
    afectacionIva: varchar('afectacion_iva', { length: 30 }).notNull().default('AFECTO_IVA_19'), // AFECTO_IVA_19 | EXENTO | HONORARIOS_RETENCION | NO_APLICA
    periodicidad: varchar('periodicidad', { length: 30 }).notNull().default('NO_PERIODICA_PUNTUAL'), // NO_PERIODICA_PUNTUAL | MENSUAL | ANUAL
    fechaEstimadaPago: date('fecha_estimada_pago', { mode: 'string' }).notNull(),
    montoNeto: decimal('monto_neto', { precision: 15, scale: 2 }).notNull().default('0.00'),
    montoIva: decimal('monto_iva', { precision: 15, scale: 2 }).notNull().default('0.00'),
    montoTotal: decimal('monto_total', { precision: 15, scale: 2 }).notNull(),
    tasaIvaPct: decimal('tasa_iva_pct', { precision: 5, scale: 2 }).notNull().default('19.00'),
    simularCreditoFiscalF29: boolean('simular_credito_fiscal_f29').notNull().default(true),
    proveedorNombre: varchar('proveedor_nombre', { length: 255 }),
    proveedorRut: varchar('proveedor_rut', { length: 20 }),
    probabilidadMaterializacionPct: int('probabilidad_pct').notNull().default(90),
    cuentaContableProvision: varchar('cuenta_contable_provision', { length: 30 }).notNull(),
    cuentaGastoAsociada: varchar('cuenta_gasto_asociada', { length: 30 }),
    centroCostoId: varchar('centro_costo_id', { length: 36 }),
    estado: varchar('estado', { length: 20 }).notNull().default('PENDIENTE'), // PENDIENTE | LIQUIDADA | REVERSADA
    asientoContableGenerado: boolean('asiento_contable_generado').notNull().default(false),
    asientoContableId: varchar('asiento_contable_id', { length: 50 }),
    observaciones: varchar('observaciones', { length: 500 }),
    createdAt: datetime('created_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
    updatedAt: datetime('updated_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
  },
  (table) => ({
    idxProvisionsEmpresa: index('idx_provisions_empresa').on(table.empresaId),
    idxProvisionsFecha: index('idx_provisions_fecha').on(table.fechaEstimadaPago),
    idxProvisionsNaturaleza: index('idx_provisions_naturaleza').on(table.naturaleza),
  })
);

export type BankReconciliationRecord = typeof bankReconciliations.$inferSelect;
export type NewBankReconciliationRecord = typeof bankReconciliations.$inferInsert;

export type BankNovedadRecord = typeof bankNovedades.$inferSelect;
export type NewBankNovedadRecord = typeof bankNovedades.$inferInsert;

export type CashFlowMovementRecord = typeof cashFlowMovements.$inferSelect;
export type NewCashFlowMovementRecord = typeof cashFlowMovements.$inferInsert;

export type CashFlowExcelStyleRecord = typeof cashFlowExcelStyles.$inferSelect;
export type NewCashFlowExcelStyleRecord = typeof cashFlowExcelStyles.$inferInsert;

export type TreasuryExpenseProvisionRecord = typeof treasuryExpenseProvisions.$inferSelect;
export type NewTreasuryExpenseProvisionRecord = typeof treasuryExpenseProvisions.$inferInsert;
