import {
  mysqlTable,
  varchar,
  text,
  decimal,
  date,
  datetime,
  int,
  bigint,
  boolean,
  json,
  mysqlEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/mysql-core';
import { sql, relations } from 'drizzle-orm';
import { accountingEntries } from './accountingLedgerSchema';

// ============================================================================
// MÓDULO 1 & 2: REGISTRO DE COMPRAS Y VENTAS (RCV) Y HONORARIOS (BHE)
// ============================================================================

export {
  dtesRcv,
  dteItems,
  dtesRcvRelations,
  dteItemsRelations,
  type DteRcv,
  type NewDteRcv,
  type DteItemRecord,
  type NewDteItemRecord,
} from './dtesSchema';

export const boletasHonorarios = mysqlTable(
  'boletas_honorarios',
  {
    id: varchar('id', { length: 36 }).primaryKey(), // UUID v4
    empresaId: varchar('empresa_id', { length: 36 }).notNull(),
    folio: bigint('folio', { mode: 'number' }).notNull(),
    rutEmisor: varchar('rut_emisor', { length: 20 }).notNull(),
    nombreEmisor: varchar('nombre_emisor', { length: 255 }).notNull(),
    fechaEmision: date('fecha_emision', { mode: 'string' }).notNull(),
    montoBruto: decimal('monto_bruto', { precision: 15, scale: 2 }).notNull(),
    tasaRetencion: decimal('tasa_retencion', { precision: 5, scale: 2 }).notNull().default('14.50'), // 14.5% vigente
    retencionMonto: decimal('retencion_monto', { precision: 15, scale: 2 }).notNull(),
    liquidoPagado: decimal('liquido_pagado', { precision: 15, scale: 2 }).notNull(),
    estadoPago: mysqlEnum('estado_pago', ['PENDIENTE', 'PAGADO', 'ANULADO']).notNull().default('PENDIENTE'),
    estadoContable: mysqlEnum('bhe_estado_contable', ['PENDIENTE', 'CENTRALIZADO']).notNull().default('PENDIENTE'),
    entryIdRef: varchar('entry_id_ref', { length: 36 }).references(() => accountingEntries.id, {
      onDelete: 'set null',
    }),
    createdAt: datetime('created_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
  },
  (table) => ({
    uqBheFolio: uniqueIndex('uq_bhe_folio').on(table.empresaId, table.folio, table.rutEmisor),
    idxBheFecha: index('idx_bhe_fecha').on(table.empresaId, table.fechaEmision),
  })
);

// ============================================================================
// MÓDULO 3: CONCILIACIÓN BANCARIA AUTOMÁTICA & CARTOLAS
// ============================================================================

export const bankAccounts = mysqlTable(
  'bank_accounts',
  {
    id: varchar('id', { length: 36 }).primaryKey(), // UUID v4
    empresaId: varchar('empresa_id', { length: 36 }).notNull(),
    bancoCodigo: varchar('banco_codigo', { length: 30 }).notNull(), // ej. 'BANCO_DE_CHILE', 'SANTANDER', 'BCI', 'ESTADO', 'ITAU'
    numeroCuenta: varchar('numero_cuenta', { length: 50 }).notNull(),
    tipoCuenta: mysqlEnum('tipo_cuenta', ['CORRIENTE', 'VISTA', 'AHORRO']).notNull().default('CORRIENTE'),
    moneda: varchar('moneda', { length: 10 }).notNull().default('CLP'),
    saldoContable: decimal('saldo_contable', { precision: 15, scale: 2 }).notNull().default('0.00'),
    saldoCartola: decimal('saldo_cartola', { precision: 15, scale: 2 }).notNull().default('0.00'),
    tipoConexion: varchar('tipo_conexion', { length: 50 }).notNull().default('MANUAL'),
    estadoConexion: varchar('estado_conexion', { length: 50 }).notNull().default('CONECTADO'),
    esPrincipal: boolean('es_principal').notNull().default(false),
    createdAt: datetime('created_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
  },
  (table) => ({
    uqBankAccountNum: uniqueIndex('uq_bank_account_num').on(table.empresaId, table.bancoCodigo, table.numeroCuenta),
  })
);

export const bankTransactions = mysqlTable(
  'bank_transactions',
  {
    id: varchar('id', { length: 36 }).primaryKey(), // UUID v4
    accountId: varchar('account_id', { length: 36 })
      .notNull()
      .references(() => bankAccounts.id, { onDelete: 'cascade' }),
    fecha: date('fecha', { mode: 'string' }).notNull(),
    descripcion: varchar('descripcion', { length: 255 }).notNull(),
    cargo: decimal('cargo', { precision: 15, scale: 2 }).notNull().default('0.00'), // Egresos
    abono: decimal('abono', { precision: 15, scale: 2 }).notNull().default('0.00'), // Ingresos
    documentoRef: varchar('documento_ref', { length: 100 }),
    estadoConciliacion: mysqlEnum('estado_conciliacion', ['PENDIENTE', 'CONCILIADO', 'NOVEDAD'])
      .notNull()
      .default('PENDIENTE'),
    matchedDteId: varchar('matched_dte_id', { length: 36 }),
    moneda: varchar('moneda', { length: 10 }).notNull().default('CLP'),
    tipoCambio: decimal('tipo_cambio', { precision: 12, scale: 4 }).default('1.0000'),
    montoClpEquivalente: decimal('monto_clp_equivalente', { precision: 15, scale: 2 }),
    matchCerteza: int('match_certeza'),
    matchSugeridoId: varchar('match_sugerido_id', { length: 36 }),
    matchSugeridoGlosa: varchar('match_sugerido_glosa', { length: 255 }),
    codigoConciliacion: varchar('codigo_conciliacion', { length: 50 }),
    fechaConciliacion: datetime('fecha_conciliacion', { fsp: 3 }),
    matchCriterio: varchar('match_criterio', { length: 255 }),
    usuarioConciliador: varchar('usuario_conciliador', { length: 100 }),
    asientoGeneradoId: varchar('asiento_generado_id', { length: 36 }),
    partidaContableDetalle: json('partida_contable_detalle'),
    esAmbiguo: boolean('es_ambiguo').notNull().default(false),
    candidatosMatchesCount: int('candidatos_matches_count').default(0),
    origenImportacion: varchar('origen_importacion', { length: 50 }).default('MANUAL'),
    rawHashTransaction: varchar('raw_hash_transaction', { length: 64 }),
    createdAt: datetime('created_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
  },
  (table) => ({
    idxTxAccountFecha: index('idx_tx_account_fecha').on(table.accountId, table.fecha),
    idxTxEstado: index('idx_tx_estado').on(table.accountId, table.estadoConciliacion),
    idxTxCodigoConc: index('idx_tx_codigo_conc').on(table.codigoConciliacion),
  })
);

// ============================================================================
// MÓDULO 4: AGENTE FISCAL F29 & CAPITAL PROPIO TRIBUTARIO (CPT)
// ============================================================================

export const f29Declarations = mysqlTable(
  'f29_declarations',
  {
    id: varchar('id', { length: 36 }).primaryKey(), // UUID v4
    empresaId: varchar('empresa_id', { length: 36 }).notNull(),
    periodo: varchar('periodo', { length: 7 }).notNull(), // Formato: 'AAAA-MM'
    folioSii: varchar('folio_sii', { length: 50 }),
    totalIvaDebito: decimal('total_iva_debito', { precision: 15, scale: 2 }).notNull().default('0.00'),
    totalIvaCredito: decimal('total_iva_credito', { precision: 15, scale: 2 }).notNull().default('0.00'),
    remanenteMesAnterior: decimal('remanente_mes_anterior', { precision: 15, scale: 2 }).notNull().default('0.00'),
    remanenteSiguienteMes: decimal('remanente_siguiente_mes', { precision: 15, scale: 2 }).notNull().default('0.00'),
    ppmDeterminado: decimal('ppm_determinado', { precision: 15, scale: 2 }).notNull().default('0.00'),
    retencionesSegundaCat: decimal('retenciones_segunda_cat', { precision: 15, scale: 2 }).notNull().default('0.00'),
    totalAPagar: decimal('total_a_pagar', { precision: 15, scale: 2 }).notNull().default('0.00'),
    estado: mysqlEnum('f29_estado', ['BORRADOR', 'VALIDADO', 'DECLARADO']).notNull().default('BORRADOR'),
    jsonCasillas: json('json_casillas').notNull(), // c538, c537, c089, c151, c048, c062, c091
    capitalPropioTributario: decimal('capital_propio_tributario', { precision: 15, scale: 2 }),
    entryIdRef: varchar('entry_id_ref', { length: 36 }).references(() => accountingEntries.id, {
      onDelete: 'set null',
    }),
    createdAt: datetime('created_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
  },
  (table) => ({
    uqF29EmpresaPeriodo: uniqueIndex('uq_f29_empresa_periodo').on(table.empresaId, table.periodo),
  })
);

// ============================================================================
// MÓDULO 5 & 6: RRHH, NÓMINA DT & CUMPLIMIENTO LEY KARIN
// ============================================================================

import {
  employees,
  payrollSettlements,
  type EmployeeRecord,
  type NewEmployeeRecord,
  type PayrollSettlementRecord,
  type NewPayrollSettlementRecord,
} from './employeesSchema';

export {
  employees,
  payrollSettlements,
  type EmployeeRecord,
  type NewEmployeeRecord,
  type PayrollSettlementRecord,
  type NewPayrollSettlementRecord,
};

export const payrollPeriods = mysqlTable(
  'payroll_periods',
  {
    id: varchar('id', { length: 36 }).primaryKey(), // UUID v4
    empresaId: varchar('empresa_id', { length: 36 }).notNull(),
    periodo: varchar('periodo', { length: 7 }).notNull(), // Formato: 'AAAA-MM'
    ufFinMes: decimal('uf_fin_mes', { precision: 12, scale: 4 }).notNull(),
    utmMes: decimal('utm_mes', { precision: 12, scale: 4 }).notNull(),
    totalHaberes: decimal('total_haberes', { precision: 15, scale: 2 }).notNull(),
    totalDescuentos: decimal('total_descuentos', { precision: 15, scale: 2 }).notNull(),
    liquidoAPagar: decimal('liquido_a_pagar', { precision: 15, scale: 2 }).notNull(),
    totalLeyesSociales: decimal('total_leyes_sociales', { precision: 15, scale: 2 }).notNull(),
    estado: mysqlEnum('payroll_estado', ['LIQUIDADO', 'CENTRALIZADO']).notNull().default('LIQUIDADO'),
    entryIdRef: varchar('entry_id_ref', { length: 36 }).references(() => accountingEntries.id, {
      onDelete: 'set null',
    }),
    createdAt: datetime('created_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
  },
  (table) => ({
    uqPayrollEmpresaPeriodo: uniqueIndex('uq_payroll_empresa_periodo').on(table.empresaId, table.periodo),
  })
);

export const karinComplianceRecords = mysqlTable(
  'karin_compliance_records',
  {
    id: varchar('id', { length: 36 }).primaryKey(), // UUID v4
    empresaId: varchar('empresa_id', { length: 36 }).notNull(),
    fechaIncidente: date('fecha_incidente', { mode: 'string' }).notNull(),
    canalRecepcion: varchar('canal_recepcion', { length: 100 }).notNull(), // 'CANAL_DENUNCIA_ETICA', 'BUZON_RRHH', 'PLATAFORMA_IA'
    estadoInvestigacion: mysqlEnum('estado_investigacion', [
      'RECIBIDO',
      'MEDIDAS_CAUTELARES_ACTIVADAS',
      'EN_INVESTIGACION',
      'INFORME_FINAL_DT',
      'CERRADO',
    ])
      .notNull()
      .default('RECIBIDO'),
    protocoloActivado: varchar('protocolo_activado', { length: 150 }).notNull(),
    hashConfidencial: varchar('hash_confidencial', { length: 64 }).notNull(), // Hash SHA-256 protección de identidad
    auditorTraceId: varchar('auditor_trace_id', { length: 64 }).notNull(),
    createdAt: datetime('created_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
  },
  (table) => ({
    idxKarinEmpresa: index('idx_karin_empresa').on(table.empresaId, table.fechaIncidente),
  })
);

// ============================================================================
// MÓDULO 7: INVENTARIO & BODEGAS (WMS & DTE 52 GUÍAS DE DESPACHO)
// ============================================================================

export const warehouses = mysqlTable(
  'warehouses',
  {
    id: varchar('id', { length: 36 }).primaryKey(), // UUID v4
    empresaId: varchar('empresa_id', { length: 36 }).notNull(),
    codigo: varchar('codigo', { length: 50 }).notNull(),
    nombre: varchar('nombre', { length: 150 }).notNull(),
    direccion: varchar('direccion', { length: 255 }).notNull(),
    createdAt: datetime('created_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
  },
  (table) => ({
    uqWarehousesEmpresaCodigo: uniqueIndex('uq_warehouses_empresa_codigo').on(table.empresaId, table.codigo),
  })
);

export const inventoryItems = mysqlTable(
  'inventory_items',
  {
    id: varchar('id', { length: 36 }).primaryKey(), // UUID v4
    empresaId: varchar('empresa_id', { length: 36 }).notNull(),
    sku: varchar('sku', { length: 50 }).notNull(),
    descripcion: varchar('descripcion', { length: 255 }).notNull(),
    stockActual: decimal('stock_actual', { precision: 12, scale: 2 }).notNull().default('0.00'),
    costoPromedioPonderado: decimal('costo_promedio_ponderado', { precision: 15, scale: 4 })
      .notNull()
      .default('0.0000'), // PMP
    createdAt: datetime('created_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
  },
  (table) => ({
    uqInventoryEmpresaSku: uniqueIndex('uq_inventory_empresa_sku').on(table.empresaId, table.sku),
  })
);

export const stockMovements = mysqlTable(
  'stock_movements',
  {
    id: varchar('id', { length: 36 }).primaryKey(), // UUID v4
    empresaId: varchar('empresa_id', { length: 36 }).notNull(),
    warehouseId: varchar('warehouse_id', { length: 36 })
      .notNull()
      .references(() => warehouses.id, { onDelete: 'cascade' }),
    itemId: varchar('item_id', { length: 36 })
      .notNull()
      .references(() => inventoryItems.id, { onDelete: 'cascade' }),
    tipoMovimiento: mysqlEnum('tipo_movimiento', ['ENTRADA', 'SALIDA', 'MERMA']).notNull(),
    cantidad: decimal('cantidad', { precision: 12, scale: 2 }).notNull(),
    costoUnitario: decimal('costo_unitario', { precision: 15, scale: 4 }).notNull(),
    dteFolioRef: varchar('dte_folio_ref', { length: 50 }), // ej. Guía de Despacho DTE 52
    entryIdRef: varchar('entry_id_ref', { length: 36 }).references(() => accountingEntries.id, {
      onDelete: 'set null',
    }),
    createdAt: datetime('created_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
  },
  (table) => ({
    idxMovementsItem: index('idx_movements_item').on(table.itemId),
    idxMovementsWarehouse: index('idx_movements_warehouse').on(table.warehouseId),
  })
);

// ============================================================================
// MÓDULO 8: FLUJO DE CAJA (CASH FLOW FORECASTING)
// ============================================================================

export const cashflowForecasts = mysqlTable(
  'cashflow_forecasts',
  {
    id: varchar('id', { length: 36 }).primaryKey(), // UUID v4
    empresaId: varchar('empresa_id', { length: 36 }).notNull(),
    periodoProyeccion: mysqlEnum('periodo_proyeccion', ['30_DIAS', '60_DIAS', '90_DIAS']).notNull(),
    ingresosProyectados: decimal('ingresos_proyectados', { precision: 15, scale: 2 }).notNull(),
    egresosProyectados: decimal('egresos_proyectados', { precision: 15, scale: 2 }).notNull(),
    saldoNetoProyectado: decimal('saldo_neto_proyectado', { precision: 15, scale: 2 }).notNull(),
    fechaCalculo: date('fecha_calculo', { mode: 'string' }).notNull(),
    createdAt: datetime('created_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
  },
  (table) => ({
    idxCashflowEmpresaFecha: index('idx_cashflow_empresa_fecha').on(table.empresaId, table.fechaCalculo),
  })
);

// ============================================================================
// MÓDULO 9: CONTRATOS & ARRIENDOS (IFRS 16: LEASES & RoU)
// ============================================================================

export const leaseContracts = mysqlTable(
  'lease_contracts',
  {
    id: varchar('id', { length: 36 }).primaryKey(), // UUID v4
    empresaId: varchar('empresa_id', { length: 36 }).notNull(),
    acreedorRut: varchar('acreedor_rut', { length: 20 }).notNull(),
    descripcionActivo: varchar('descripcion_activo', { length: 255 }).notNull(),
    plazoMeses: int('plazo_meses').notNull(),
    tasaDescuentoAnual: decimal('tasa_descuento_anual', { precision: 6, scale: 4 }).notNull(),
    cuotaMensual: decimal('cuota_mensual', { precision: 15, scale: 2 }).notNull(),
    activoDerechoUsoInicial: decimal('activo_derecho_uso_inicial', { precision: 15, scale: 2 }).notNull(), // Activo RoU
    pasivoFinancieroInicial: decimal('pasivo_financiero_inicial', { precision: 15, scale: 2 }).notNull(),
    createdAt: datetime('created_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
  },
  (table) => ({
    idxLeaseEmpresa: index('idx_lease_empresa').on(table.empresaId),
  })
);

export const leaseAmortizationSchedule = mysqlTable(
  'lease_amortization_schedule',
  {
    id: varchar('id', { length: 36 }).primaryKey(), // UUID v4
    contractId: varchar('contract_id', { length: 36 })
      .notNull()
      .references(() => leaseContracts.id, { onDelete: 'cascade' }),
    mesNumero: int('mes_numero').notNull(),
    fechaCuota: date('fecha_cuota', { mode: 'string' }).notNull(),
    cuotaMonto: decimal('cuota_monto', { precision: 15, scale: 2 }).notNull(),
    amortizacionPasivo: decimal('amortizacion_pasivo', { precision: 15, scale: 2 }).notNull(),
    gastoInteres: decimal('gasto_interes', { precision: 15, scale: 2 }).notNull(),
    depreciacionRoU: decimal('depreciacion_rou', { precision: 15, scale: 2 }).notNull(),
    saldoPasivo: decimal('saldo_pasivo', { precision: 15, scale: 2 }).notNull(),
    entryIdRef: varchar('entry_id_ref', { length: 36 }).references(() => accountingEntries.id, {
      onDelete: 'set null',
    }),
    createdAt: datetime('created_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
  },
  (table) => ({
    idxAmortizationContract: index('idx_amortization_contract').on(table.contractId, table.mesNumero),
  })
);

// ============================================================================
// MÓDULOS AUTÓNOMOS CLIENTE ANCLA (MARKETING & ATENCIÓN AL PÚBLICO IA)
// ============================================================================

export const marketingCampaignLogs = mysqlTable(
  'marketing_campaign_logs',
  {
    id: varchar('id', { length: 36 }).primaryKey(), // UUID v4
    empresaId: varchar('empresa_id', { length: 36 }).notNull(),
    campanaNombre: varchar('campana_nombre', { length: 150 }).notNull(),
    plataforma: varchar('plataforma', { length: 50 }).notNull(), // 'GOOGLE_ADS', 'META', 'TIKTOK', 'LINKEDIN'
    gastoPresupuesto: decimal('gasto_presupuesto', { precision: 15, scale: 2 }).notNull(),
    conversionesRegistradas: int('conversiones_registradas').notNull().default(0),
    metricasJson: json('metricas_json').notNull(), // { roas, cpa, impresiones, clicks, ctr }
    createdAt: datetime('created_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
  },
  (table) => ({
    idxMarketingEmpresa: index('idx_marketing_empresa').on(table.empresaId, table.createdAt),
  })
);

export const customerServiceTickets = mysqlTable(
  'customer_service_tickets',
  {
    id: varchar('id', { length: 36 }).primaryKey(), // UUID v4
    empresaId: varchar('empresa_id', { length: 36 }).notNull(),
    clienteRUT: varchar('cliente_rut', { length: 20 }).notNull(),
    canal: varchar('canal', { length: 50 }).notNull(), // 'WHATSAPP', 'EMAIL', 'WEB_CHAT', 'PORTAL'
    consultaTexto: text('consulta_texto').notNull(),
    respuestaAgenteIa: text('respuesta_agente_ia').notNull(),
    resolucionAutomatica: boolean('resolucion_automatica').notNull().default(true),
    tiempoRespuestaMs: int('tiempo_respuesta_ms').notNull(),
    createdAt: datetime('created_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
  },
  (table) => ({
    idxTicketsEmpresa: index('idx_tickets_empresa').on(table.empresaId, table.createdAt),
  })
);

// ============================================================================
// RELACIONES DRIZZLE ORM
// ============================================================================
export const bankAccountsRelations = relations(bankAccounts, ({ many }) => ({
  transactions: many(bankTransactions),
}));

export const bankTransactionsRelations = relations(bankTransactions, ({ one }) => ({
  account: one(bankAccounts, {
    fields: [bankTransactions.accountId],
    references: [bankAccounts.id],
  }),
}));

export const leaseContractsRelations = relations(leaseContracts, ({ many }) => ({
  schedules: many(leaseAmortizationSchedule),
}));

export const leaseAmortizationScheduleRelations = relations(leaseAmortizationSchedule, ({ one }) => ({
  contract: one(leaseContracts, {
    fields: [leaseAmortizationSchedule.contractId],
    references: [leaseContracts.id],
  }),
}));

export const warehousesRelations = relations(warehouses, ({ many }) => ({
  stockMovements: many(stockMovements),
}));

export const inventoryItemsRelations = relations(inventoryItems, ({ many }) => ({
  stockMovements: many(stockMovements),
}));

export const stockMovementsRelations = relations(stockMovements, ({ one }) => ({
  warehouse: one(warehouses, {
    fields: [stockMovements.warehouseId],
    references: [warehouses.id],
  }),
  item: one(inventoryItems, {
    fields: [stockMovements.itemId],
    references: [inventoryItems.id],
  }),
}));

// ============================================================================
// TIPOS ESTRICTOS DE INFERENCIA DRIZZLE
// ============================================================================
export type BoletaHonorario = typeof boletasHonorarios.$inferSelect;
export type NewBoletaHonorario = typeof boletasHonorarios.$inferInsert;

export type BankAccount = typeof bankAccounts.$inferSelect;
export type NewBankAccount = typeof bankAccounts.$inferInsert;

export type BankTransaction = typeof bankTransactions.$inferSelect;
export type NewBankTransaction = typeof bankTransactions.$inferInsert;

export type F29Declaration = typeof f29Declarations.$inferSelect;
export type NewF29Declaration = typeof f29Declarations.$inferInsert;

export type Employee = typeof employees.$inferSelect;
export type NewEmployee = typeof employees.$inferInsert;

export type PayrollPeriod = typeof payrollPeriods.$inferSelect;
export type NewPayrollPeriod = typeof payrollPeriods.$inferInsert;

export type KarinComplianceRecord = typeof karinComplianceRecords.$inferSelect;
export type NewKarinComplianceRecord = typeof karinComplianceRecords.$inferInsert;

export type Warehouse = typeof warehouses.$inferSelect;
export type NewWarehouse = typeof warehouses.$inferInsert;

export type InventoryItem = typeof inventoryItems.$inferSelect;
export type NewInventoryItem = typeof inventoryItems.$inferInsert;

export type StockMovement = typeof stockMovements.$inferSelect;
export type NewStockMovement = typeof stockMovements.$inferInsert;

export type CashflowForecast = typeof cashflowForecasts.$inferSelect;
export type NewCashflowForecast = typeof cashflowForecasts.$inferInsert;

export type LeaseContract = typeof leaseContracts.$inferSelect;
export type NewLeaseContract = typeof leaseContracts.$inferInsert;

export type LeaseAmortizationSchedule = typeof leaseAmortizationSchedule.$inferSelect;
export type NewLeaseAmortizationSchedule = typeof leaseAmortizationSchedule.$inferInsert;

export type MarketingCampaignLog = typeof marketingCampaignLogs.$inferSelect;
export type NewMarketingCampaignLog = typeof marketingCampaignLogs.$inferInsert;

export type CustomerServiceTicket = typeof customerServiceTickets.$inferSelect;
export type NewCustomerServiceTicket = typeof customerServiceTickets.$inferInsert;
