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
import { sql } from 'drizzle-orm';

// ============================================================================
// 1. TABLA: rfq_requests (Solicitudes de Cotización de Compra a Proveedores)
// ============================================================================
export const rfqRequests = mysqlTable(
  'rfq_requests',
  {
    id: varchar('id', { length: 36 }).primaryKey(), // UUID v4
    empresaId: varchar('empresa_id', { length: 36 }).notNull(),
    folioRfq: varchar('folio_rfq', { length: 50 }).notNull(), // ej: "RFQ-2026-0042"
    titulo: varchar('titulo', { length: 255 }).notNull(),
    fechaEmision: date('fecha_emision', { mode: 'string' }).notNull(),
    fechaLimiteRespuesta: date('fecha_limite_respuesta', { mode: 'string' }).notNull(),
    diasPlazoRespuesta: int('dias_plazo_respuesta').notNull().default(3),
    estado: mysqlEnum('estado', [
      'BORRADOR',
      'ENVIADA',
      'EN_EVALUACION',
      'ADJUDICADA',
      'CANCELADA',
    ]).notNull().default('ENVIADA'),
    itemsJson: json('items_json').notNull(), // Array<{ sku, nombre, cantidad, unidadMedida, precioReferencialPmp, especificaciones }>
    proveedorGanadorRut: varchar('proveedor_ganador_rut', { length: 20 }),
    proveedorGanadorNombre: varchar('proveedor_ganador_nombre', { length: 255 }),
    ordenCompraGeneradaId: varchar('orden_compra_generada_id', { length: 36 }),
    folioOrdenCompra: varchar('folio_orden_compra', { length: 50 }),
    motivoAdjudicacion: text('motivo_adjudicacion'),
    recomendacionAgenteSr: text('recomendacion_agente_sr'),
    createdAt: datetime('created_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
  },
  (table) => ({
    uqRfqFolio: uniqueIndex('uq_rfq_folio_empresa').on(table.empresaId, table.folioRfq),
    idxRfqEmpresaEstado: index('idx_rfq_empresa_estado').on(table.empresaId, table.estado),
  })
);

// ============================================================================
// 2. TABLA: rfq_supplier_responses (Seguimiento de Proveedores, Cotizaciones y Recordatorios)
// ============================================================================
export const rfqSupplierResponses = mysqlTable(
  'rfq_supplier_responses',
  {
    id: varchar('id', { length: 36 }).primaryKey(), // UUID v4
    rfqId: varchar('rfq_id', { length: 36 })
      .notNull()
      .references(() => rfqRequests.id, { onDelete: 'cascade' }),
    empresaId: varchar('empresa_id', { length: 36 }).notNull(),
    proveedorRut: varchar('proveedor_rut', { length: 20 }).notNull(),
    proveedorRazonSocial: varchar('proveedor_razon_social', { length: 255 }).notNull(),
    emailContacto: varchar('email_contacto', { length: 150 }).notNull(),
    telefonoContacto: varchar('telefono_contacto', { length: 50 }),
    estadoSeguimiento: mysqlEnum('estado_seguimiento', [
      'ENVIADA',
      'VISTA_LEIDA',
      'EN_PREPARACION',
      'COTIZADA',
      'NO_RESPONDE_RETRASADO',
      'DECLINADA',
    ]).notNull().default('ENVIADA'),
    fechaEnvio: datetime('fecha_envio', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
    fechaLectura: datetime('fecha_lectura', { fsp: 3 }),
    fechaRespuesta: datetime('fecha_respuesta', { fsp: 3 }),
    cantidadReiteraciones: int('cantidad_reiteraciones').notNull().default(0),
    ultimoRecordatorioAt: datetime('ultimo_recordatorio_at', { fsp: 3 }),
    montoNetoOfertado: decimal('monto_neto_ofertado', { precision: 15, scale: 2 }),
    plazoEntregaDiasOfertado: int('plazo_entrega_dias_ofertado'),
    condicionPagoOfertada: varchar('condicion_pago_ofertada', { length: 100 }), // 'Contado', 'Crédito 30 días', 'Crédito 60 días'
    costoFleteClp: decimal('costo_flete_clp', { precision: 15, scale: 2 }).default('0.00'),
    scoringPonderadoTotal: decimal('scoring_ponderado_total', { precision: 5, scale: 2 }), // 0 a 100 puntos
    itemsCotizadosJson: json('items_cotizados_json'), // Array con precio por item y descuentos por volumen
    observacionesProveedor: text('observaciones_proveedor'),
    esOfertaGanadora: boolean('es_oferta_ganadora').notNull().default(false),
    createdAt: datetime('created_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
  },
  (table) => ({
    idxRfqSupplier: index('idx_rfq_supplier').on(table.rfqId, table.proveedorRut),
    idxRfqSupplierEstado: index('idx_rfq_supplier_estado').on(table.estadoSeguimiento),
  })
);

// ============================================================================
// 3. TABLA: purchase_orders (Órdenes de Compra Oficiales generadas y emitidas)
// ============================================================================
export const purchaseOrders = mysqlTable(
  'purchase_orders',
  {
    id: varchar('id', { length: 36 }).primaryKey(), // UUID v4
    empresaId: varchar('empresa_id', { length: 36 }).notNull(),
    folioOc: varchar('folio_oc', { length: 50 }).notNull(), // ej: "OC-2026-0094"
    rfqOrigenId: varchar('rfq_origen_id', { length: 36 }),
    proveedorRut: varchar('proveedor_rut', { length: 20 }).notNull(),
    proveedorRazonSocial: varchar('proveedor_razon_social', { length: 255 }).notNull(),
    fechaEmision: date('fecha_emision', { mode: 'string' }).notNull(),
    fechaEntregaPactada: date('fecha_entrega_pactada', { mode: 'string' }).notNull(),
    condicionPago: varchar('condicion_pago', { length: 100 }).notNull().default('Crédito 30 días'),
    itemsJson: json('items_json').notNull(),
    montoNeto: decimal('monto_neto', { precision: 15, scale: 2 }).notNull(),
    montoIva: decimal('monto_iva', { precision: 15, scale: 2 }).notNull(),
    montoTotal: decimal('monto_total', { precision: 15, scale: 2 }).notNull(),
    estado: mysqlEnum('estado', [
      'EMITIDA',
      'RECEPCIONADA_PARCIAL',
      'RECEPCIONADA_CONFORME',
      'FACTURADA_SII',
      'ANULADA',
    ]).notNull().default('EMITIDA'),
    aprobadoPorAgente: boolean('aprobado_por_agente').notNull().default(true),
    firmaAgente: varchar('firma_agente', { length: 100 }).default('Esteban Morales (Gerente Comercial & Aprovisionamiento Sr.)'),
    motivoGeneracion: text('motivo_generacion'),
    asientoContableRefId: varchar('asiento_contable_ref_id', { length: 36 }),
    createdAt: datetime('created_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
  },
  (table) => ({
    uqOcFolio: uniqueIndex('uq_oc_folio_empresa').on(table.empresaId, table.folioOc),
    idxOcEmpresaFecha: index('idx_oc_empresa_fecha').on(table.empresaId, table.fechaEmision),
  })
);

// ============================================================================
// 4. TABLA: commercial_quotes (Cotizaciones Comerciales a Clientes con Margen Protegido)
// ============================================================================
export const commercialQuotes = mysqlTable(
  'commercial_quotes',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    empresaId: varchar('empresa_id', { length: 36 }).notNull(),
    folioCotizacion: varchar('folio_cotizacion', { length: 50 }).notNull(), // ej: "COT-2026-0145"
    clienteRut: varchar('cliente_rut', { length: 20 }).notNull(),
    clienteRazonSocial: varchar('cliente_razon_social', { length: 255 }).notNull(),
    fechaEmision: date('fecha_emision', { mode: 'string' }).notNull(),
    fechaVencimiento: date('fecha_vencimiento', { mode: 'string' }).notNull(),
    validezDias: int('validez_dias').notNull().default(15),
    itemsJson: json('items_json').notNull(),
    montoNeto: decimal('monto_neto', { precision: 15, scale: 2 }).notNull(),
    montoIva: decimal('monto_iva', { precision: 15, scale: 2 }).notNull(),
    montoTotal: decimal('monto_total', { precision: 15, scale: 2 }).notNull(),
    margenBrutoPromedioPorcentaje: decimal('margen_bruto_promedio_porcentaje', { precision: 5, scale: 2 }).notNull(),
    estado: mysqlEnum('estado', [
      'BORRADOR',
      'ENVIADA',
      'APROBADA_POR_FACTURAR',
      'CERRADA_PERDIDA',
    ]).notNull().default('ENVIADA'),
    stockValidado: boolean('stock_validado').notNull().default(true),
    createdAt: datetime('created_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
  },
  (table) => ({
    uqCotizacionFolio: uniqueIndex('uq_cotizacion_folio_empresa').on(table.empresaId, table.folioCotizacion),
    idxCotizacionCliente: index('idx_cotizacion_cliente').on(table.clienteRut),
  })
);

export type RfqRequestRecord = typeof rfqRequests.$inferSelect;
export type NewRfqRequestRecord = typeof rfqRequests.$inferInsert;

export type RfqSupplierResponseRecord = typeof rfqSupplierResponses.$inferSelect;
export type NewRfqSupplierResponseRecord = typeof rfqSupplierResponses.$inferInsert;

export type PurchaseOrderDbRecord = typeof purchaseOrders.$inferSelect;
export type NewPurchaseOrderDbRecord = typeof purchaseOrders.$inferInsert;

export type CommercialQuoteDbRecord = typeof commercialQuotes.$inferSelect;
export type NewCommercialQuoteDbRecord = typeof commercialQuotes.$inferInsert;
