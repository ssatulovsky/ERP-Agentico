import {
  mysqlTable,
  varchar,
  decimal,
  date,
  datetime,
  int,
  bigint,
  mysqlEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';

// ============================================================================
// TABLA OFICIAL: dtes_rcv (Registro de Compras y Ventas del SII - MySQL 8.0)
// ============================================================================
export const dtesRcv = mysqlTable(
  'dtes_rcv',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    empresaId: varchar('empresa_id', { length: 20 }).notNull(), // RUT contribuyente receptor/emisor
    periodo: varchar('periodo', { length: 7 }).notNull(), // Formato 'AAAA-MM'
    tipoOperacion: mysqlEnum('tipo_operacion', ['COMPRA', 'VENTA']).notNull(),
    tipoDte: int('tipo_dte').notNull(), // 33, 34, 39, 56, 61, etc.
    folio: bigint('folio', { mode: 'number' }).notNull(),
    rutContraparte: varchar('rut_contraparte', { length: 20 }).notNull(),
    razonSocialContraparte: varchar('razon_social_contraparte', { length: 255 }).notNull(),
    fechaEmision: date('fecha_emision', { mode: 'string' }).notNull(),
    montoExento: decimal('monto_exento', { precision: 15, scale: 2 }).notNull().default('0.00'),
    montoNeto: decimal('monto_neto', { precision: 15, scale: 2 }).notNull().default('0.00'),
    montoIvaRecuperable: decimal('monto_iva_recuperable', { precision: 15, scale: 2 }).notNull().default('0.00'),
    montoIvaNoRecuperable: decimal('monto_iva_no_recuperable', { precision: 15, scale: 2 }).notNull().default('0.00'),
    montoTotal: decimal('monto_total', { precision: 15, scale: 2 }).notNull(),
    estadoAcuse: varchar('estado_acuse', { length: 50 }),
    createdAt: datetime('created_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
  },
  (table) => ({
    uqDteRegistro: uniqueIndex('uq_dte_registro').on(
      table.empresaId,
      table.tipoOperacion,
      table.tipoDte,
      table.folio,
      table.rutContraparte
    ),
    idxDtesPeriodo: index('idx_dtes_periodo').on(
      table.empresaId,
      table.periodo,
      table.tipoOperacion
    ),
    idxDtesFecha: index('idx_dtes_fecha').on(table.fechaEmision),
  })
);

export type DteRcv = typeof dtesRcv.$inferSelect;
export type NewDteRcv = typeof dtesRcv.$inferInsert;
