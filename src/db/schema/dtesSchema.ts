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
// TABLA OFICIAL: dtes_rcv (Registro de Compras y Ventas del SII - MySQL 8.0)
// ============================================================================
export const dtesRcv = mysqlTable(
  'dtes_rcv',
  {
    id: varchar('id', { length: 36 }).primaryKey(), // UUID v4
    empresaId: varchar('empresa_id', { length: 36 }).notNull(), // RUT o ID de empresa
    periodo: varchar('periodo', { length: 7 }).notNull(), // Formato 'AAAA-MM'
    tipoOperacion: mysqlEnum('tipo_operacion', ['COMPRA', 'VENTA']).notNull(),
    tipoDte: int('tipo_dte').notNull(), // 33: Factura Electrónica, 34: Exenta, 56: ND, 61: NC, 52: Guía
    folio: bigint('folio', { mode: 'number' }).notNull(),
    rutContraparte: varchar('rut_contraparte', { length: 20 }).notNull(),
    razonSocialContraparte: varchar('razon_social_contraparte', { length: 255 }).notNull(),
    fechaEmision: date('fecha_emision', { mode: 'string' }).notNull(),
    montoExento: decimal('monto_exento', { precision: 15, scale: 2 }).notNull().default('0.00'),
    montoNeto: decimal('monto_neto', { precision: 15, scale: 2 }).notNull().default('0.00'),
    montoIva: decimal('monto_iva', { precision: 15, scale: 2 }).notNull().default('0.00'),
    montoIvaRecuperable: decimal('monto_iva_recuperable', { precision: 15, scale: 2 }).notNull().default('0.00'),
    montoIvaNoRecuperable: decimal('monto_iva_no_recuperable', { precision: 15, scale: 2 }).notNull().default('0.00'),
    montoTotal: decimal('monto_total', { precision: 15, scale: 2 }).notNull(),
    estadoAcuse: varchar('estado_acuse', { length: 50 }),
    estadoContable: mysqlEnum('estado_contable', ['PENDIENTE', 'CENTRALIZADO']).notNull().default('PENDIENTE'),
    glosa: text('glosa'),
    // Imputación a nivel de documento completo
    centroCostoId: varchar('centro_costo_id', { length: 36 }),
    centroCostoCodigo: varchar('centro_costo_codigo', { length: 50 }),
    centroCostoNombre: varchar('centro_costo_nombre', { length: 200 }),
    cuentaGastoImputadaCodigo: varchar('cuenta_gasto_imputada_codigo', { length: 50 }),
    cuentaGastoImputadaNombre: varchar('cuenta_gasto_imputada_nombre', { length: 200 }),
    // Resumen JSON de partidas / ítems desglosados
    items: json('items'),
    entryIdRef: varchar('entry_id_ref', { length: 36 }).references(() => accountingEntries.id, {
      onDelete: 'set null',
    }),
    // Integración HTTP-DTE / LibreDTE & SII
    trackId: varchar('track_id', { length: 100 }),
    tedXml: text('ted_xml'),
    xmlTimbrado: text('xml_timbrado'),
    pdfUrl: varchar('pdf_url', { length: 500 }),
    ambienteSii: int('ambiente_sii').default(1), // 1: Certificación, 2: Producción
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
    idxDtesCentroCosto: index('idx_dtes_centro_costo').on(table.centroCostoId),
  })
);

// ============================================================================
// TABLA: dte_items (Detalle de Ítems de la Factura y Centro de Costo Asociado)
// ============================================================================
export const dteItems = mysqlTable(
  'dte_items',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    dteId: varchar('dte_id', { length: 36 })
      .notNull()
      .references(() => dtesRcv.id, { onDelete: 'cascade' }),
    empresaId: varchar('empresa_id', { length: 36 }).notNull(),
    codigo: varchar('codigo', { length: 50 }),
    nombre: varchar('nombre', { length: 200 }).notNull(),
    descripcion: text('descripcion'),
    cantidad: decimal('cantidad', { precision: 12, scale: 4 }).notNull().default('1.0000'),
    unidadMedida: varchar('unidad_medida', { length: 20 }),
    precioUnitario: decimal('precio_unitario', { precision: 15, scale: 4 }).notNull(),
    descuentoPct: decimal('descuento_pct', { precision: 5, scale: 2 }).notNull().default('0.00'),
    esExento: boolean('es_exento').notNull().default(false),
    montoTotal: decimal('monto_total', { precision: 15, scale: 2 }).notNull(),
    centroCostoId: varchar('centro_costo_id', { length: 36 }),
    centroCostoCodigo: varchar('centro_costo_codigo', { length: 50 }),
    centroCostoNombre: varchar('centro_costo_nombre', { length: 200 }),
    cuentaCodigo: varchar('cuenta_codigo', { length: 50 }),
    cuentaNombre: varchar('cuenta_nombre', { length: 200 }),
    createdAt: datetime('created_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
  },
  (table) => ({
    idxDteItemsDte: index('idx_dte_items_dte').on(table.dteId),
    idxDteItemsCc: index('idx_dte_items_cc').on(table.centroCostoId),
  })
);

export const dtesRcvRelations = relations(dtesRcv, ({ many }) => ({
  items: many(dteItems),
}));

export const dteItemsRelations = relations(dteItems, ({ one }) => ({
  dte: one(dtesRcv, {
    fields: [dteItems.dteId],
    references: [dtesRcv.id],
  }),
}));

export type DteRcv = typeof dtesRcv.$inferSelect;
export type NewDteRcv = typeof dtesRcv.$inferInsert;

export type DteItemRecord = typeof dteItems.$inferSelect;
export type NewDteItemRecord = typeof dteItems.$inferInsert;

// ============================================================================
// TABLA: dte_caf_sequences (Control Atómico Secuencial de Folios y CAF SII)
// ============================================================================
export const dteCafSequences = mysqlTable(
  'dte_caf_sequences',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    empresaId: varchar('empresa_id', { length: 36 }).notNull(),
    tipoDte: int('tipo_dte').notNull(), // 33, 34, 52, 56, 61, 39
    ultimoFolioEmitido: bigint('ultimo_folio_emitido', { mode: 'number' }).notNull().default(0),
    folioDesde: bigint('folio_desde', { mode: 'number' }).notNull().default(1),
    folioHasta: bigint('folio_hasta', { mode: 'number' }).notNull().default(5000),
    cafXml: text('caf_xml'), // Archivo CAF emitido por SII
    fechaAutorizacion: date('fecha_autorizacion', { mode: 'string' }),
    ambiente: int('ambiente').default(1), // 1: Certificación, 2: Producción
    activo: boolean('activo').notNull().default(true),
    updatedAt: datetime('updated_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
  },
  (table) => ({
    uqEmpresaTipoDteAmbiente: uniqueIndex('uq_caf_empresa_tipo_ambiente').on(
      table.empresaId,
      table.tipoDte,
      table.ambiente
    ),
    idxCafEmpresa: index('idx_caf_empresa').on(table.empresaId),
  })
);

export type DteCafSequence = typeof dteCafSequences.$inferSelect;
export type NewDteCafSequence = typeof dteCafSequences.$inferInsert;

