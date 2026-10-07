import {
  mysqlTable,
  varchar,
  text,
  decimal,
  date,
  datetime,
  bigint,
  boolean,
  json,
  mysqlEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';
import { warehouses } from './erpModulesSchema';
import { accountingEntries } from './accountingLedgerSchema';

// ============================================================================
// 1. TABLA: warehouse_transfers (Traslados entre Bodegas con Guía DTE 52)
// ============================================================================
export const warehouseTransfers = mysqlTable(
  'warehouse_transfers',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    empresaId: varchar('empresa_id', { length: 36 }).notNull(),
    folioGuiaDespacho52: bigint('folio_guia_despacho_52', { mode: 'number' }).notNull(),
    fechaDespacho: date('fecha_despacho', { mode: 'string' }).notNull(),
    fechaEstimadaLlegada: date('fecha_estimada_llegada', { mode: 'string' }).notNull(),
    fechaRecepcionReal: date('fecha_recepcion_real', { mode: 'string' }),
    bodegaOrigenId: varchar('bodega_origen_id', { length: 36 })
      .notNull()
      .references(() => warehouses.id, { onDelete: 'cascade' }),
    bodegaDestinoId: varchar('bodega_destino_id', { length: 36 })
      .notNull()
      .references(() => warehouses.id, { onDelete: 'cascade' }),
    motivoTraslado: mysqlEnum('motivo_traslado', [
      'REPOSICION_SUCURSAL',
      'EQUILIBRIO_STOCK',
      'SUMINISTRO_FAENA',
      'DEVOLUCION_CENTRAL',
    ]).notNull().default('REPOSICION_SUCURSAL'),
    estado: mysqlEnum('estado', ['PROGRAMADO', 'EN_TRANSITO', 'RECEPCIONADO', 'DISCREPANCIA'])
      .notNull()
      .default('PROGRAMADO'),
    itemsJson: json('items_json').notNull(),
    valorTotalTraslado: decimal('valor_total_traslado', { precision: 15, scale: 2 }).notNull().default('0.00'),
    patenteCamion: varchar('patente_camion', { length: 20 }),
    rutChofer: varchar('rut_chofer', { length: 20 }),
    nombreChofer: varchar('nombre_chofer', { length: 150 }),
    rutTransportista: varchar('rut_transportista', { length: 20 }),
    razonSocialTransportista: varchar('razon_social_transportista', { length: 200 }),
    asientoContableId: varchar('asiento_contable_id', { length: 36 }).references(() => accountingEntries.id, {
      onDelete: 'set null',
    }),
    observaciones: text('observaciones'),
    createdAt: datetime('created_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
  },
  (table) => ({
    uqTransferGuia: uniqueIndex('uq_transfer_guia_empresa').on(table.empresaId, table.folioGuiaDespacho52),
    idxTransferEmpresa: index('idx_transfer_empresa').on(table.empresaId),
    idxTransferEstado: index('idx_transfer_estado').on(table.estado),
  })
);

// ============================================================================
// 2. TABLA: replenishment_requisitions (Sugerencias de Reposición por IA)
// ============================================================================
export const replenishmentRequisitions = mysqlTable(
  'replenishment_requisitions',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    empresaId: varchar('empresa_id', { length: 36 }).notNull(),
    folioRequisicion: varchar('folio_requisicion', { length: 50 }).notNull(),
    fechaGeneracion: date('fecha_generacion', { mode: 'string' }).notNull(),
    generadoPorAgente: boolean('generado_por_agente').notNull().default(true),
    motivoAgente: text('motivo_agente').notNull(),
    itemId: varchar('item_id', { length: 36 }).notNull(),
    sku: varchar('sku', { length: 50 }).notNull(),
    nombreItem: varchar('nombre_item', { length: 200 }).notNull(),
    bodegaDestinoId: varchar('bodega_destino_id', { length: 36 })
      .notNull()
      .references(() => warehouses.id, { onDelete: 'cascade' }),
    stockActual: decimal('stock_actual', { precision: 12, scale: 2 }).notNull(),
    stockMinimo: decimal('stock_minimo', { precision: 12, scale: 2 }).notNull(),
    stockCritico: decimal('stock_critico', { precision: 12, scale: 2 }).notNull(),
    cantidadSugerida: decimal('cantidad_sugerida', { precision: 12, scale: 2 }).notNull(),
    costoEstimadoClp: decimal('costo_estimado_clp', { precision: 15, scale: 2 }).notNull(),
    prioridad: mysqlEnum('prioridad', ['URGENTE', 'ALTA', 'NORMAL']).notNull().default('ALTA'),
    tipoAccionRecomendada: mysqlEnum('tipo_accion_recomendada', ['COMPRA_PROVEEDOR', 'TRASPASO_INTERNO'])
      .notNull()
      .default('COMPRA_PROVEEDOR'),
    bodegaOrigenSugeridaTraspaso: varchar('bodega_origen_sugerida_traspaso', { length: 36 }),
    proveedorSugeridoJson: json('proveedor_sugerido_json'),
    estado: mysqlEnum('estado', [
      'PENDIENTE_APROBACION',
      'ORDEN_COMPRA_GENERADA',
      'TRASPASO_INICIADO',
      'RECHAZADA',
    ]).notNull().default('PENDIENTE_APROBACION'),
    ordenCompraFolio: bigint('orden_compra_folio', { mode: 'number' }),
    createdAt: datetime('created_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
  },
  (table) => ({
    uqRequisitionFolio: uniqueIndex('uq_replenish_folio').on(table.empresaId, table.folioRequisicion),
    idxRequisitionEmpresa: index('idx_replenish_empresa').on(table.empresaId),
    idxRequisitionPrioridad: index('idx_replenish_prioridad').on(table.prioridad),
  })
);

export type WarehouseTransferRecord = typeof warehouseTransfers.$inferSelect;
export type NewWarehouseTransferRecord = typeof warehouseTransfers.$inferInsert;

export type ReplenishmentRequisitionRecord = typeof replenishmentRequisitions.$inferSelect;
export type NewReplenishmentRequisitionRecord = typeof replenishmentRequisitions.$inferInsert;
