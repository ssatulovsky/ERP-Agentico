import {
  mysqlTable,
  varchar,
  decimal,
  date,
  datetime,
  bigint,
  json,
  mysqlEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';
import { accountingEntries } from './accountingLedgerSchema';

// ============================================================================
// 1. TABLA: production_orders (Órdenes de Producción NIC 2 - Costeo Normal y Real)
// ============================================================================
export const productionOrders = mysqlTable(
  'production_orders',
  {
    id: varchar('id', { length: 36 }).primaryKey(), // UUID v4
    empresaId: varchar('empresa_id', { length: 36 }).notNull(),
    folioOp: varchar('folio_op', { length: 50 }).notNull(), // ej: OP-2026-101
    descripcion: varchar('descripcion', { length: 255 }).notNull(),
    productoCodigo: varchar('producto_codigo', { length: 50 }).notNull(),
    productoNombre: varchar('producto_nombre', { length: 200 }).notNull(),
    categoria: mysqlEnum('categoria', [
      'SALMONIDOS_PROCESADOS',
      'REDES_Y_FONDEOS',
      'ALIMENTO_Y_SUPLEMENTOS',
      'PRODUCTOS_MANUFACTURADOS',
      'SERVICIOS_INDUSTRIALES',
    ]).notNull(),
    unidadMedida: varchar('unidad_medida', { length: 20 }).notNull().default('UNID'),
    fechaInicio: date('fecha_inicio', { mode: 'string' }).notNull(),
    fechaEstimadaTermino: date('fecha_estimada_termino', { mode: 'string' }).notNull(),
    fechaRealTermino: date('fecha_real_termino', { mode: 'string' }),
    estado: mysqlEnum('estado', [
      'PLANIFICADA',
      'EN_PROCESO',
      'CONTROL_CALIDAD',
      'TERMINADA',
      'LIQUIDADA',
      'ANULADA',
    ]).notNull().default('PLANIFICADA'),
    cantidadObjetivo: decimal('cantidad_objetivo', { precision: 12, scale: 2 }).notNull(),
    cantidadProducidaReal: decimal('cantidad_producida_real', { precision: 12, scale: 2 }).notNull().default('0.00'),
    cantidadMerma: decimal('cantidad_merma', { precision: 12, scale: 2 }).notNull().default('0.00'),
    bodegaDestinoId: varchar('bodega_destino_id', { length: 36 }),
    // Componentes del Costo de Fabricación (NIC 2)
    costoDirectoMateriales: decimal('costo_directo_materiales', { precision: 15, scale: 2 }).notNull().default('0.00'),
    costoDirectoManoObra: decimal('costo_directo_mano_obra', { precision: 15, scale: 2 }).notNull().default('0.00'),
    costoPrimo: decimal('costo_primo', { precision: 15, scale: 2 }).notNull().default('0.00'),
    baseProrrateoCif: mysqlEnum('base_prorrateo_cif', [
      'HORAS_HOMBRE_MOD',
      'HORAS_MAQUINA',
      'COSTO_PRIMO',
      'UNIDADES_PRODUCIDAS',
    ]).notNull().default('HORAS_HOMBRE_MOD'),
    tasaCifAplicada: decimal('tasa_cif_aplicada', { precision: 10, scale: 4 }).notNull().default('0.0000'),
    costoIndirectoCif: decimal('costo_indirecto_cif', { precision: 15, scale: 2 }).notNull().default('0.00'),
    costoTotalProduccion: decimal('costo_total_produccion', { precision: 15, scale: 2 }).notNull().default('0.00'),
    costoUnitarioReal: decimal('costo_unitario_real', { precision: 15, scale: 4 }).notNull().default('0.0000'),
    precioVentaEstimado: decimal('precio_venta_estimado', { precision: 15, scale: 2 }).notNull().default('0.00'),
    margenBrutoUnitarioEstimado: decimal('margen_bruto_unitario_estimado', { precision: 8, scale: 4 }).default('0.0000'),
    asientosGeneradosJson: json('asientos_generados_json'),
    createdAt: datetime('created_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
  },
  (table) => ({
    uqFolioOpEmpresa: uniqueIndex('uq_production_op_folio').on(table.empresaId, table.folioOp),
    idxProductionEmpresaEstado: index('idx_production_empresa_estado').on(table.empresaId, table.estado),
  })
);

// ============================================================================
// 2. TABLA: production_material_consumptions (Consumos Materia Prima Directa MPD)
// ============================================================================
export const productionMaterialConsumptions = mysqlTable(
  'production_material_consumptions',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    ordenProduccionId: varchar('orden_produccion_id', { length: 36 })
      .notNull()
      .references(() => productionOrders.id, { onDelete: 'cascade' }),
    fecha: date('fecha', { mode: 'string' }).notNull(),
    insumoId: varchar('insumo_id', { length: 36 }).notNull(),
    insumoCodigo: varchar('insumo_codigo', { length: 50 }).notNull(),
    insumoNombre: varchar('insumo_nombre', { length: 200 }).notNull(),
    bodegaOrigenId: varchar('bodega_origen_id', { length: 36 }).notNull(),
    cantidadConsumida: decimal('cantidad_consumida', { precision: 12, scale: 2 }).notNull(),
    unidadMedida: varchar('unidad_medida', { length: 20 }).notNull(),
    costoUnitarioPmp: decimal('costo_unitario_pmp', { precision: 15, scale: 4 }).notNull(),
    costoTotalConsumo: decimal('costo_total_consumo', { precision: 15, scale: 2 }).notNull(),
    folioGuiaDespacho52: bigint('folio_guia_despacho_52', { mode: 'number' }),
    asientoId: varchar('asiento_id', { length: 36 }).references(() => accountingEntries.id, {
      onDelete: 'set null',
    }),
    createdAt: datetime('created_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
  },
  (table) => ({
    idxConsumoOp: index('idx_consumo_op').on(table.ordenProduccionId),
    idxConsumoInsumo: index('idx_consumo_insumo').on(table.insumoId),
  })
);

// ============================================================================
// 3. TABLA: production_labor_entries (Mano de Obra Directa MOD en Producción)
// ============================================================================
export const productionLaborEntries = mysqlTable(
  'production_labor_entries',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    ordenProduccionId: varchar('orden_produccion_id', { length: 36 })
      .notNull()
      .references(() => productionOrders.id, { onDelete: 'cascade' }),
    fecha: date('fecha', { mode: 'string' }).notNull(),
    trabajadorRut: varchar('trabajador_rut', { length: 20 }).notNull(),
    trabajadorNombre: varchar('trabajador_nombre', { length: 200 }).notNull(),
    cargo: varchar('cargo', { length: 150 }).notNull(),
    horasTrabajadas: decimal('horas_trabajadas', { precision: 6, scale: 2 }).notNull(),
    tarifaHoraCostoEmpresa: decimal('tarifa_hora_costo_empresa', { precision: 12, scale: 2 }).notNull(),
    costoTotalMod: decimal('costo_total_mod', { precision: 15, scale: 2 }).notNull(),
    etapaProceso: varchar('etapa_proceso', { length: 150 }).notNull(),
    asientoId: varchar('asiento_id', { length: 36 }).references(() => accountingEntries.id, {
      onDelete: 'set null',
    }),
    createdAt: datetime('created_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
  },
  (table) => ({
    idxLaborOp: index('idx_labor_op').on(table.ordenProduccionId),
    idxLaborTrabajador: index('idx_labor_trabajador').on(table.trabajadorRut),
  })
);

// ============================================================================
// 4. TABLA: production_cif_pools (Fondo Costos Indirectos de Fabricación CIF)
// ============================================================================
export const productionCifPools = mysqlTable(
  'production_cif_pools',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    empresaId: varchar('empresa_id', { length: 36 }).notNull(),
    periodo: varchar('periodo', { length: 7 }).notNull(), // AAAA-MM
    concepto: varchar('concepto', { length: 255 }).notNull(),
    categoriaCif: mysqlEnum('categoria_cif', [
      'ENERGIA_COMBUSTIBLE',
      'DEPRECIACION_MAQUINARIA',
      'MANTENCION_FABRIL',
      'MANO_OBRA_INDIRECTA',
      'ARRIENDO_PLANTA',
      'SEGUROS_EPP',
    ]).notNull(),
    montoTotalPeriodo: decimal('monto_total_periodo', { precision: 15, scale: 2 }).notNull(),
    cuentaContableGasto: varchar('cuenta_contable_gasto', { length: 30 }).notNull(),
    dteFolioAsociado: bigint('dte_folio_asociado', { mode: 'number' }),
    createdAt: datetime('created_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
  },
  (table) => ({
    idxCifEmpresaPeriodo: index('idx_cif_empresa_periodo').on(table.empresaId, table.periodo),
  })
);

export type ProductionOrderRecord = typeof productionOrders.$inferSelect;
export type NewProductionOrderRecord = typeof productionOrders.$inferInsert;

export type ProductionMaterialConsumptionRecord = typeof productionMaterialConsumptions.$inferSelect;
export type NewProductionMaterialConsumptionRecord = typeof productionMaterialConsumptions.$inferInsert;

export type ProductionLaborEntryRecord = typeof productionLaborEntries.$inferSelect;
export type NewProductionLaborEntryRecord = typeof productionLaborEntries.$inferInsert;

export type ProductionCifPoolRecord = typeof productionCifPools.$inferSelect;
export type NewProductionCifPoolRecord = typeof productionCifPools.$inferInsert;
