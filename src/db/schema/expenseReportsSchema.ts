import {
  mysqlTable,
  varchar,
  decimal,
  date,
  datetime,
  boolean,
  int,
  text,
  json,
  index,
  uniqueIndex,
} from 'drizzle-orm/mysql-core';
import { sql, relations } from 'drizzle-orm';

// ============================================================================
// 1. TABLA: expense_projects (Proyectos, Obras y Contratos para Imputación)
// ============================================================================
export const expenseProjects = mysqlTable(
  'expense_projects',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    empresaId: varchar('empresa_id', { length: 36 }).notNull(),
    codigo: varchar('codigo', { length: 50 }).notNull(), // ej: "PRY-QUELLON-01"
    nombre: varchar('nombre', { length: 200 }).notNull(),
    clienteNombre: varchar('cliente_nombre', { length: 200 }),
    presupuestoTotalClp: decimal('presupuesto_total_clp', { precision: 15, scale: 2 }).default('0.00'),
    activo: boolean('activo').notNull().default(true),
    descripcion: text('descripcion'),
    createdAt: datetime('created_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
  },
  (table) => ({
    uqProjectEmpresaCodigo: uniqueIndex('uq_expense_project_empresa_codigo').on(table.empresaId, table.codigo),
    idxProjectEmpresa: index('idx_expense_project_empresa').on(table.empresaId),
  })
);

// ============================================================================
// 2. TABLA: expense_reports (Cabeceras de Rendición de Gastos - "RindeGastos")
// ============================================================================
export const expenseReports = mysqlTable(
  'expense_reports',
  {
    id: varchar('id', { length: 36 }).primaryKey(), // UUID v4
    empresaId: varchar('empresa_id', { length: 36 }).notNull(),
    folio: varchar('folio', { length: 50 }).notNull(), // ej: "RDG-2026-001"
    titulo: varchar('titulo', { length: 255 }).notNull(),
    
    // Datos del Rendidor / Empleado
    rendidorId: varchar('rendidor_id', { length: 36 }),
    rendidorNombre: varchar('rendidor_nombre', { length: 200 }).notNull(),
    rendidorRut: varchar('rendidor_rut', { length: 20 }).notNull(),
    rendidorEmail: varchar('rendidor_email', { length: 255 }),
    rendidorCargo: varchar('rendidor_cargo', { length: 150 }),
    
    // Imputación Analítica
    centroCostoId: varchar('centro_costo_id', { length: 36 }),
    centroCostoCodigo: varchar('centro_costo_codigo', { length: 50 }),
    centroCostoNombre: varchar('centro_costo_nombre', { length: 200 }),
    proyectoId: varchar('proyecto_id', { length: 36 }),
    proyectoCodigo: varchar('proyecto_codigo', { length: 50 }),
    proyectoNombre: varchar('proyecto_nombre', { length: 200 }),
    
    // Magnitudes Financieras y Fondos
    fondoAsignadoClp: decimal('fondo_asignado_clp', { precision: 15, scale: 2 }).notNull().default('0.00'),
    montoTotalRendidoClp: decimal('monto_total_rendido_clp', { precision: 15, scale: 2 }).notNull().default('0.00'),
    saldoReembolsarClp: decimal('saldo_reembolsar_clp', { precision: 15, scale: 2 }).notNull().default('0.00'),
    saldoReintegrarClp: decimal('saldo_reintegrar_clp', { precision: 15, scale: 2 }).notNull().default('0.00'),
    moneda: varchar('moneda', { length: 10 }).notNull().default('CLP'),
    
    // Estados y Workflow de Aprobación
    estado: varchar('estado', { length: 40 }).notNull().default('BORRADOR'),
    fechaInicio: date('fecha_inicio', { mode: 'string' }).notNull(),
    fechaCierre: date('fecha_cierre', { mode: 'string' }).notNull(),
    fechaAprobacion: date('fecha_aprobacion', { mode: 'string' }),
    fechaPagoReembolso: date('fecha_pago_reembolso', { mode: 'string' }),
    
    aprobadorNombre: varchar('aprobador_nombre', { length: 200 }),
    aprobadorEmail: varchar('aprobador_email', { length: 255 }),
    observacionesAprobador: text('observaciones_aprobador'),
    
    // Integración Contable con Libro Diario
    asientoContableId: varchar('asiento_contable_id', { length: 36 }),
    
    // Auditoría y Scoring Agéntico
    agenteAuditorScore: int('agente_auditor_score').notNull().default(100),
    agenteAuditorDiagnostico: json('agente_auditor_diagnostico'),
    
    createdAt: datetime('created_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
    updatedAt: datetime('updated_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
  },
  (table) => ({
    uqExpenseReportEmpresaFolio: uniqueIndex('uq_expense_report_empresa_folio').on(table.empresaId, table.folio),
    idxExpenseReportEmpresaEstado: index('idx_expense_report_empresa_estado').on(table.empresaId, table.estado),
    idxExpenseReportRendidor: index('idx_expense_report_rendidor').on(table.empresaId, table.rendidorRut),
    idxExpenseReportCc: index('idx_expense_report_cc').on(table.centroCostoId),
    idxExpenseReportProyecto: index('idx_expense_report_proyecto').on(table.proyectoId),
  })
);

// ============================================================================
// 3. TABLA: expense_items (Comprobantes y Documentos de Gasto)
// ============================================================================
export const expenseItems = mysqlTable(
  'expense_items',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    expenseReportId: varchar('expense_report_id', { length: 36 })
      .notNull()
      .references(() => expenseReports.id, { onDelete: 'cascade' }),
    empresaId: varchar('empresa_id', { length: 36 }).notNull(),
    
    fecha: date('fecha', { mode: 'string' }).notNull(),
    tipoDocumento: varchar('tipo_documento', { length: 50 }).notNull(), // BOLETA_ELECTRONICA, FACTURA_ELECTRONICA_33, etc.
    folioDocumento: varchar('folio_documento', { length: 100 }).notNull(),
    proveedorRut: varchar('proveedor_rut', { length: 20 }).notNull(),
    proveedorRazonSocial: varchar('proveedor_razon_social', { length: 255 }).notNull(),
    categoria: varchar('categoria', { length: 50 }).notNull(),
    descripcionGlosa: varchar('descripcion_glosa', { length: 255 }).notNull(),
    
    // Valores Económicos
    montoNeto: decimal('monto_neto', { precision: 15, scale: 2 }).notNull().default('0.00'),
    montoIva: decimal('monto_iva', { precision: 15, scale: 2 }).notNull().default('0.00'),
    montoExento: decimal('monto_exento', { precision: 15, scale: 2 }).notNull().default('0.00'),
    montoTotalClp: decimal('monto_total_clp', { precision: 15, scale: 2 }).notNull().default('0.00'),
    
    monedaOriginal: varchar('moneda_original', { length: 10 }).default('CLP'),
    montoOriginal: decimal('monto_original', { precision: 15, scale: 2 }),
    tipoCambio: decimal('tipo_cambio', { precision: 12, scale: 4 }).default('1.0000'),
    
    // Imputación Analítica Específica de Línea
    centroCostoId: varchar('centro_costo_id', { length: 36 }),
    centroCostoCodigo: varchar('centro_costo_codigo', { length: 50 }),
    proyectoId: varchar('proyecto_id', { length: 36 }),
    proyectoCodigo: varchar('proyecto_codigo', { length: 50 }),
    cuentaContableCodigo: varchar('cuenta_contable_codigo', { length: 50 }).notNull(),
    cuentaContableNombre: varchar('cuenta_contable_nombre', { length: 150 }),
    
    // Soporte Documental Digital (Archivo / Imagen / PDF)
    comprobanteArchivoNombre: varchar('comprobante_archivo_nombre', { length: 255 }),
    comprobanteUrl: text('comprobante_url'),
    comprobantePreviewBase64: text('comprobante_preview_base64'),
    
    // Cumplimiento Tributario Chileno (Art. 21 / 31 LIR)
    esGastoRechazadoArt21: boolean('es_gasto_rechazado_art21').notNull().default(false),
    validadoPorAgente: boolean('validado_por_agente').notNull().default(true),
    observacionAgente: varchar('observacion_agente', { length: 255 }),
    
    createdAt: datetime('created_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
  },
  (table) => ({
    idxExpenseItemReport: index('idx_expense_item_report').on(table.expenseReportId),
    idxExpenseItemEmpresaFecha: index('idx_expense_item_empresa_fecha').on(table.empresaId, table.fecha),
    idxExpenseItemProveedor: index('idx_expense_item_proveedor').on(table.proveedorRut),
    idxExpenseItemCuenta: index('idx_expense_item_cuenta').on(table.cuentaContableCodigo),
  })
);

export const expenseReportsRelations = relations(expenseReports, ({ many }) => ({
  comprobantes: many(expenseItems),
}));

export const expenseItemsRelations = relations(expenseItems, ({ one }) => ({
  report: one(expenseReports, {
    fields: [expenseItems.expenseReportId],
    references: [expenseReports.id],
  }),
}));

export type ExpenseProjectRecord = typeof expenseProjects.$inferSelect;
export type NewExpenseProjectRecord = typeof expenseProjects.$inferInsert;

export type ExpenseReportRecord = typeof expenseReports.$inferSelect;
export type NewExpenseReportRecord = typeof expenseReports.$inferInsert;

export type ExpenseItemRecord = typeof expenseItems.$inferSelect;
export type NewExpenseItemRecord = typeof expenseItems.$inferInsert;
