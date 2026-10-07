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
import { accountingEntries } from './accountingLedgerSchema';

// ============================================================================
// 1. TABLA: fixed_assets (Activos Fijos IFRS / NIC 16 y Art. 31/41 LIR Chile)
// ============================================================================
export const fixedAssets = mysqlTable(
  'fixed_assets',
  {
    id: varchar('id', { length: 36 }).primaryKey(), // UUID v4
    empresaId: varchar('empresa_id', { length: 36 }).notNull(),
    codigoPlaca: varchar('codigo_placa', { length: 50 }).notNull(), // Placa inventario ej: AF-2026-001
    nombre: varchar('nombre', { length: 200 }).notNull(),
    categoria: mysqlEnum('categoria', [
      'MAQUINARIA_INDUSTRIAL',
      'VEHICULOS_TRANSPORTE',
      'EQUIPOS_COMPUTACIONALES',
      'INSTALACIONES_ACUICOLAS_MARITIMAS',
      'MUEBLES_UTILES',
      'BIENES_INMUEBLES_EDIFICIOS',
      'HERRAMIENTAS_EQUIPOS_MENORES',
    ]).notNull(),
    fechaAdquisicion: date('fecha_adquisicion', { mode: 'string' }).notNull(),
    proveedorRut: varchar('proveedor_rut', { length: 20 }),
    proveedorRazonSocial: varchar('proveedor_razon_social', { length: 255 }),
    folioDteCompra: bigint('folio_dte_compra', { mode: 'number' }),
    valorAdquisicionOriginal: decimal('valor_adquisicion_original', { precision: 15, scale: 2 }).notNull(),
    valorResidualFinanciero: decimal('valor_residual_financiero', { precision: 15, scale: 2 }).notNull().default('0.00'),
    vidaUtilMesesFinanciera: int('vida_util_meses_financiera').notNull(),
    vidaUtilMesesTributaria: int('vida_util_meses_tributaria').notNull(),
    mesesDepreciados: int('meses_depreciados').notNull().default(0),
    vidaUtilRestanteMeses: int('vida_util_restante_meses').notNull(),
    metodoDepreciacion: mysqlEnum('metodo_depreciacion', [
      'LINEAL_RECTA',
      'ACELERADA_TRIBUTARIA_UN_TERCIO',
      'ULTRA_ACELERADA_UN_DECIMO',
      'UNIDADES_DE_PRODUCCION',
    ]).notNull().default('LINEAL_RECTA'),
    depreciacionAcumuladaFinanciera: decimal('depreciacion_acumulada_financiera', { precision: 15, scale: 2 })
      .notNull()
      .default('0.00'),
    valorLibroFinanciero: decimal('valor_libro_financiero', { precision: 15, scale: 2 }).notNull(),
    cuotaDepreciacionMensualFinanciera: decimal('cuota_depreciacion_mensual_financiera', { precision: 15, scale: 2 })
      .notNull()
      .default('0.00'),
    factorCorreccionMonetariaAcum: decimal('factor_correccion_monetaria_acum', { precision: 8, scale: 6 })
      .notNull()
      .default('0.000000'),
    correccionMonetariaAcumulada: decimal('correccion_monetaria_acumulada', { precision: 15, scale: 2 })
      .notNull()
      .default('0.00'),
    depreciacionAcumuladaTributaria: decimal('depreciacion_acumulada_tributaria', { precision: 15, scale: 2 })
      .notNull()
      .default('0.00'),
    valorTributarioNeto: decimal('valor_tributario_neto', { precision: 15, scale: 2 }).notNull(),
    cuotaDepreciacionMensualTributaria: decimal('cuota_depreciacion_mensual_tributaria', { precision: 15, scale: 2 })
      .notNull()
      .default('0.00'),
    ubicacionFisica: varchar('ubicacion_fisica', { length: 255 }).notNull(),
    responsableCustodio: varchar('responsable_custodio', { length: 200 }).notNull(),
    estado: mysqlEnum('estado', [
      'ACTIVO_OPERATIVO',
      'EN_MANTENCION',
      'DEPRECIADO_TOTALMENTE',
      'DADO_DE_BAJA_OBSOLETO',
      'VENDIDO_ENAJENADO',
    ]).notNull().default('ACTIVO_OPERATIVO'),
    numeroSerie: varchar('numero_serie', { length: 100 }),
    marcaModelo: varchar('marca_modelo', { length: 150 }),
    esFabrilProduccion: boolean('es_fabril_produccion').notNull().default(false),
    centroCostoId: varchar('centro_costo_id', { length: 36 }),
    centroCostoCodigo: varchar('centro_costo_codigo', { length: 50 }),
    centroCostoNombre: varchar('centro_costo_nombre', { length: 200 }),
    ultimaInspeccionFecha: date('ultima_inspeccion_fecha', { mode: 'string' }),
    proximaMantencionFecha: date('proxima_mantencion_fecha', { mode: 'string' }),
    notasTecnicas: text('notas_tecnicas'),
    asientoAltaId: varchar('asiento_alta_id', { length: 36 }).references(() => accountingEntries.id, {
      onDelete: 'set null',
    }),
    createdAt: datetime('created_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
  },
  (table) => ({
    uqPlacaEmpresa: uniqueIndex('uq_fixed_asset_placa').on(table.empresaId, table.codigoPlaca),
    idxFixedAssetEmpresa: index('idx_fixed_asset_empresa').on(table.empresaId),
    idxFixedAssetCategoria: index('idx_fixed_asset_categoria').on(table.categoria),
  })
);

// ============================================================================
// 2. TABLA: fixed_asset_depreciation_runs (Corridas Mensuales de Depreciación)
// ============================================================================
export const fixedAssetDepreciationRuns = mysqlTable(
  'fixed_asset_depreciation_runs',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    empresaId: varchar('empresa_id', { length: 36 }).notNull(),
    periodo: varchar('periodo', { length: 7 }).notNull(), // Formato AAAA-MM
    fechaEjecucion: date('fecha_ejecucion', { mode: 'string' }).notNull(),
    totalActivosProcesados: int('total_activos_procesados').notNull(),
    totalDepreciacionFinancieraMes: decimal('total_depreciacion_financiera_mes', { precision: 15, scale: 2 }).notNull(),
    totalDepreciacionTributariaMes: decimal('total_depreciacion_tributaria_mes', { precision: 15, scale: 2 }).notNull(),
    totalCorreccionMonetariaMes: decimal('total_correccion_monetaria_mes', { precision: 15, scale: 2 }).notNull(),
    totalDepreciacionFabrilCifMes: decimal('total_depreciacion_fabril_cif_mes', { precision: 15, scale: 2 }).notNull(),
    asientoGeneradoId: varchar('asiento_generado_id', { length: 36 }).references(() => accountingEntries.id, {
      onDelete: 'set null',
    }),
    detallePorActivo: json('detalle_por_activo').notNull(),
    createdAt: datetime('created_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
  },
  (table) => ({
    uqDepreciationRun: uniqueIndex('uq_depr_run_empresa_periodo').on(table.empresaId, table.periodo),
    idxDepreciationEmpresa: index('idx_depr_empresa').on(table.empresaId),
  })
);

export type FixedAssetRecord = typeof fixedAssets.$inferSelect;
export type NewFixedAssetRecord = typeof fixedAssets.$inferInsert;

export type FixedAssetDepreciationRunRecord = typeof fixedAssetDepreciationRuns.$inferSelect;
export type NewFixedAssetDepreciationRunRecord = typeof fixedAssetDepreciationRuns.$inferInsert;
