import {
  mysqlTable,
  varchar,
  decimal,
  date,
  datetime,
  int,
  text,
  json,
  boolean,
  mysqlEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';
import { companies } from './tenancySchema';
import { productionOrders } from './productionCostingSchema';

// ============================================================================
// INGENIERÍA NAVAL Y ACUICULTURA CHILENA: NORMATIVAS RG 1821 Y RG 941
// ============================================================================

// ============================================================================
// 1. TABLA: aquaculture_centers (Centros de Cultivo de Salmónidos con Código RNA)
// Concesiones de acuicultura, memoria de cálculo fondeo y batimetría (RG 941 Subpesca)
// ============================================================================
export const aquacultureCenters = mysqlTable(
  'aquaculture_centers',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    empresaId: varchar('empresa_id', { length: 36 })
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    codigoRna: varchar('codigo_rna', { length: 20 }).notNull(), // Código RNA Sernapesca ej: 102450
    nombreCentro: varchar('nombre_centro', { length: 150 }).notNull(),
    titularNombre: varchar('titular_nombre', { length: 200 }).notNull(),
    titularRut: varchar('titular_rut', { length: 20 }).notNull(),
    region: varchar('region', { length: 100 }).notNull(), // ej: 'Los Lagos', 'Aysén', 'Magallanes'
    comuna: varchar('comuna', { length: 100 }).notNull(), // ej: 'Hornopirén', 'Quellón', 'Aysén'
    agrupacionConcesionesAcs: varchar('agrupacion_concesiones_acs', { length: 50 }), // Barrio o ACS ej: 'ACS 17A'
    coordenadasUtmNorte: decimal('coordenadas_utm_norte', { precision: 12, scale: 2 }).notNull(),
    coordenadasUtmEste: decimal('coordenadas_utm_este', { precision: 12, scale: 2 }).notNull(),
    latitud: decimal('latitud', { precision: 10, scale: 7 }),
    longitud: decimal('longitud', { precision: 10, scale: 7 }),
    profundidadMediaMetros: decimal('profundidad_media_metros', { precision: 6, scale: 2 }).notNull(),
    profundidadMaximaMetros: decimal('profundidad_maxima_metros', { precision: 6, scale: 2 }).notNull(),
    tipoFondoMarino: mysqlEnum('tipo_fondo_marino', ['FANGO_BLANDO', 'ARENA_COMPACTA', 'ROCOSO', 'MIXTO']).notNull(),
    corrienteMaximaNudos: decimal('corriente_maxima_nudos', { precision: 5, scale: 2 }).notNull(),
    alturaOlaSignificativaHs: decimal('altura_ola_significativa_hs', { precision: 5, scale: 2 }).notNull(),
    memoriaCalculoFondeoRg941Url: varchar('memoria_calculo_fondeo_rg941_url', { length: 500 }),
    certificacionNavalVigente: boolean('certificacion_naval_vigente').notNull().default(true),
    fechaVencimientoCertificado: date('fecha_vencimiento_certificado', { mode: 'string' }),
    estadoOperativo: mysqlEnum('estado_operativo', ['EN_OPERACION', 'DESCANSO_SANITARIO', 'INSTALACION', 'MANTENCION']).notNull().default('EN_OPERACION'),
    createdAt: datetime('created_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
  },
  (table) => ({
    uqCentroRna: uniqueIndex('uq_centro_rna').on(table.codigoRna),
    idxCentroEmpresa: index('idx_centro_empresa').on(table.empresaId),
    idxCentroRegion: index('idx_centro_region').on(table.region),
  })
);

// ============================================================================
// 2. TABLA: aquaculture_modules (Trenes y Módulos de Balsas Jaulas)
// Estructuras de soporte, cuadrículas 30x30m, 40x40m, circulares D30/D40
// ============================================================================
export const aquacultureModules = mysqlTable(
  'aquaculture_modules',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    centroId: varchar('centro_id', { length: 36 })
      .notNull()
      .references(() => aquacultureCenters.id, { onDelete: 'cascade' }),
    codigoTren: varchar('codigo_tren', { length: 50 }).notNull(), // ej: 'TREN-NORTE-01'
    numeroJaulas: int('numero_jaulas').notNull(), // ej: 8 jaulas (2x4)
    tipoGeometria: mysqlEnum('tipo_geometria', ['CUADRADA_30X30', 'CUADRADA_40X40', 'CIRCULAR_D30', 'CIRCULAR_D40', 'RECTANGULAR']).notNull(),
    dimensionLargoM: decimal('dimension_largo_m', { precision: 6, scale: 2 }).notNull(),
    dimensionAnchoM: decimal('dimension_ancho_m', { precision: 6, scale: 2 }).notNull(),
    materialPasillos: varchar('material_pasillos', { length: 100 }).notNull().default('HDPE Termofusionado Grado PE100'),
    azimutOrientacionGrados: decimal('azimut_orientacion_grados', { precision: 5, scale: 1 }).notNull().default('0.0'),
    posicionRelativaX: decimal('posicion_relativa_x', { precision: 8, scale: 2 }).notNull().default('0.00'),
    posicionRelativaY: decimal('posicion_relativa_y', { precision: 8, scale: 2 }).notNull().default('0.00'),
    createdAt: datetime('created_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
  },
  (table) => ({
    idxModuloCentro: index('idx_modulo_centro').on(table.centroId),
    uqModuloCodigo: uniqueIndex('uq_modulo_codigo').on(table.centroId, table.codigoTren),
  })
);

// ============================================================================
// 3. TABLA: aquaculture_drawings (Ingesta de Planos de Ingeniería Naval en PDF/CAD)
// Planos del centro, memorias de cálculo, planos de redes y mallas 3D
// ============================================================================
export const aquacultureDrawings = mysqlTable(
  'aquaculture_drawings',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    centroId: varchar('centro_id', { length: 36 })
      .notNull()
      .references(() => aquacultureCenters.id, { onDelete: 'cascade' }),
    tipoPlano: mysqlEnum('tipo_plano', [
      'PLANO_GENERAL_CENTRO',
      'PLANO_FONDEO_BATIMETRIA',
      'PLANO_RED_PECERA',
      'PLANO_RED_LOBERA',
      'PLANO_SISTEMA_SEPARADORES',
      'PLANO_DETALLE_RELIÑAS_LASTRES',
    ]).notNull(),
    tituloPlano: varchar('titulo_plano', { length: 255 }).notNull(),
    codigoPlano: varchar('codigo_plano', { length: 100 }).notNull(),
    revision: varchar('revision', { length: 10 }).notNull().default('Rev.0'),
    ingenieroNavalFirma: varchar('ingeniero_naval_firma', { length: 150 }).notNull(),
    registroColegioNaval: varchar('registro_colegio_naval', { length: 50 }),
    archivoPdfUrl: varchar('archivo_pdf_url', { length: 500 }).notNull(),
    archivoCadUrl: varchar('archivo_cad_url', { length: 500 }),
    datosIngeridosJson: json('datos_ingeridos_json'), // Coordenadas de módulos, cabos, puntos de fondeo
    modelo3dVerticesJson: json('modelo_3d_vertices_json'), // Malla tridimensional vectorizada
    esPlanoOficialVigente: boolean('es_plano_oficial_vigente').notNull().default(true),
    createdAt: datetime('created_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
  },
  (table) => ({
    idxPlanoCentro: index('idx_plano_centro').on(table.centroId),
    idxPlanoTipo: index('idx_plano_tipo').on(table.tipoPlano),
  })
);

// ============================================================================
// 4. TABLA: aquaculture_nets (Padrón de Redes Peceras y Loberas)
// RG 1821 Sernapesca: Trazabilidad por crotal, horas inmersión, baño antifouling
// ============================================================================
export const aquacultureNets = mysqlTable(
  'aquaculture_nets',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    empresaId: varchar('empresa_id', { length: 36 }).notNull(),
    centroId: varchar('centro_id', { length: 36 }).references(() => aquacultureCenters.id, { onDelete: 'set null' }),
    moduloId: varchar('modulo_id', { length: 36 }).references(() => aquacultureModules.id, { onDelete: 'set null' }),
    codigoRed: varchar('codigo_red', { length: 50 }).notNull(), // ej: 'RED-PEC-3030-01'
    tipoRed: mysqlEnum('tipo_red', [
      'PECERA',
      'LOBERA_PERIMETRAL',
      'LOBERA_FONDO',
      'PAJARERA_TECHO',
      'SEGREGADOR_INTERNO',
    ]).notNull(),
    crotalOficialSernapesca: varchar('crotal_oficial_sernapesca', { length: 50 }), // Trazabilidad RG 1821
    dimensionBocaM: decimal('dimension_boca_m', { precision: 6, scale: 2 }).notNull(), // ej: 30.00
    dimensionProfundidadM: decimal('dimension_profundidad_m', { precision: 6, scale: 2 }).notNull(), // ej: 15.00
    materialFilamento: mysqlEnum('material_filamento', [
      'HDPE_ALTA_DENSIDAD',
      'NYLON_POLIAMIDA_PA6',
      'UHMWPE_ULTRA_RESISTENTE',
      'POLIESTER_ALTA_TENACIDAD',
      'ACERO_INOX_COPPER_ALLOY',
    ]).notNull(),
    tipoTejido: mysqlEnum('tipo_tejido', ['RASCHEL_SIN_NUDO', 'INGLES_CON_NUDO', 'TRENZADO_KNOTLESS']).notNull(),
    tamanoMallaPulgadas: decimal('tamano_malla_pulgadas', { precision: 4, scale: 2 }).notNull(), // ej: 1.50"
    denierFilamento: int('denier_filamento'), // ej: 210/48
    cargaRoturaMallaKg: decimal('carga_rotura_malla_kg', { precision: 6, scale: 2 }).notNull(),
    relingaSuperiorCaboMm: decimal('relinga_superior_cabo_mm', { precision: 5, scale: 2 }).notNull().default('24.00'),
    relingaInferiorPlomadaKg: decimal('relinga_inferior_plomada_kg', { precision: 8, scale: 2 }).notNull().default('1200.00'),
    horasInmersionAcumuladas: int('horas_inmersion_acumuladas').notNull().default(0),
    fechaUltimoBanoAntifouling: date('fecha_ultimo_bano_antifouling', { mode: 'string' }),
    tallerMantencionUltimo: varchar('taller_mantencion_ultimo', { length: 150 }),
    ordenProduccionOrigenId: varchar('orden_produccion_origen_id', { length: 36 }).references(() => productionOrders.id, { onDelete: 'set null' }),
    estadoConservacion: mysqlEnum('estado_conservacion', [
      'OPTIMO_NUEVO',
      'OPERATIVO_CONFORME',
      'OBSERVADO_REQUIERE_MANTENCION',
      'CRITICO_RIESGO_ROTURA',
      'EN_TALLER_REPARACION',
      'DADA_DE_BAJA',
    ]).notNull().default('OPTIMO_NUEVO'),
    createdAt: datetime('created_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
  },
  (table) => ({
    uqRedCodigo: uniqueIndex('uq_red_codigo').on(table.empresaId, table.codigoRed),
    idxRedCrotal: index('idx_red_crotal').on(table.crotalOficialSernapesca),
    idxRedCentro: index('idx_red_centro').on(table.centroId),
    idxRedEstado: index('idx_red_estado').on(table.estadoConservacion),
  })
);

// ============================================================================
// 5. TABLA: aquaculture_components (Separadores, Crotales y Lastres)
// Cumplimiento RG 1821: Separación de redes pecera-lobera para evitar roces y escapes
// ============================================================================
export const aquacultureComponents = mysqlTable(
  'aquaculture_components',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    centroId: varchar('centro_id', { length: 36 })
      .notNull()
      .references(() => aquacultureCenters.id, { onDelete: 'cascade' }),
    moduloId: varchar('modulo_id', { length: 36 }).references(() => aquacultureModules.id, { onDelete: 'set null' }),
    tipoComponente: mysqlEnum('tipo_componente', [
      'SEPARADOR_PECERA_LOBERA',
      'CROTAL_TRAZABILIDAD_RG1821',
      'PESO_LASTRE_FONDO',
      'BOYA_TENSION_LOBERA',
      'GRILLETE_INSPECCIONADO',
      'TENSIOMETRO_LINEA',
    ]).notNull(),
    codigoIdentificador: varchar('codigo_identificador', { length: 50 }).notNull(),
    separacionRealMetros: decimal('separacion_real_metros', { precision: 5, scale: 2 }), // Distancia obligatoria según memoria técnica
    separacionNormativaMinimaM: decimal('separacion_normativa_minima_m', { precision: 5, scale: 2 }).default('1.50'),
    material: varchar('material', { length: 100 }).notNull(),
    pesoKg: decimal('peso_kg', { precision: 8, scale: 2 }),
    posicionJaulaCara: mysqlEnum('posicion_jaula_cara', ['NORTE', 'SUR', 'ESTE', 'OESTE', 'ESQUINA_NE', 'ESQUINA_NO', 'ESQUINA_SE', 'ESQUINA_SO', 'FONDO']).notNull(),
    estadoNormativo: mysqlEnum('estado_normativo', ['CONFORME_RG1821', 'EN_RIESGO_CONTACTO', 'COLAPSADO_ROTURA', 'EXTRAVIADO']).notNull().default('CONFORME_RG1821'),
    createdAt: datetime('created_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
  },
  (table) => ({
    idxComponenteCentro: index('idx_componente_centro').on(table.centroId),
    idxComponenteTipo: index('idx_componente_tipo').on(table.tipoComponente),
  })
);

// ============================================================================
// 6. TABLA: aquaculture_mooring_lines (Líneas de Fondeo y Fondeaderos RG 941)
// Cadenas, cabos de polipropileno/poliéster, muertos de hormigón y anclas
// ============================================================================
export const aquacultureMooringLines = mysqlTable(
  'aquaculture_mooring_lines',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    centroId: varchar('centro_id', { length: 36 })
      .notNull()
      .references(() => aquacultureCenters.id, { onDelete: 'cascade' }),
    codigoLinea: varchar('codigo_linea', { length: 50 }).notNull(), // ej: 'FONDEO-NW-04'
    cuadranteGeografico: mysqlEnum('cuadrante_geografico', ['NORTE', 'SUR', 'ESTE', 'OESTE', 'NORESTE', 'NOROESTE', 'SURESTE', 'SUROESTE']).notNull(),
    longitudTotalMetros: decimal('longitud_total_metros', { precision: 8, scale: 2 }).notNull(),
    tipoAnclaje: mysqlEnum('tipo_anclaje', ['BLOQUE_HORMIGON_MUERTO', 'ANCLA_STEVPRIS', 'ANCLA_DANFORTH', 'PASADOR_ROCA_MICROPOZOS']).notNull(),
    pesoAnclajeToneladas: decimal('peso_anclaje_toneladas', { precision: 6, scale: 2 }).notNull(),
    diametroCaboPrincipalMm: decimal('diametro_cabo_principal_mm', { precision: 6, scale: 2 }).notNull(),
    materialCabo: varchar('material_cabo', { length: 100 }).notNull().default('Polipropileno Virgen 8 Cordones Multifilamento'),
    tramoCadenaGradoMm: varchar('tramo_cadena_grado_mm', { length: 100 }).notNull().default('Cadena Grado 2 D=32mm 15m fondo'),
    cargaRoturaCertificadaMblTn: decimal('carga_rotura_certificada_mbl_tn', { precision: 6, scale: 2 }).notNull(),
    factorSeguridadDiseno: decimal('factor_seguridad_diseno', { precision: 4, scale: 2 }).notNull().default('2.50'),
    tensionTrabajoEstimadaTon: decimal('tension_trabajo_estimada_ton', { precision: 6, scale: 2 }).notNull(),
    ultimaInspeccionAcusticaFecha: date('ultima_inspeccion_acustica_fecha', { mode: 'string' }),
    estadoEstructural: mysqlEnum('estado_estructural', ['APTO_OPERACION', 'TENSION_ANORMAL', 'CORROSION_CADENA_AVANZADA', 'DESPLAZAMIENTO_MUERTO', 'REEMPLAZO_INMEDIATO']).notNull().default('APTO_OPERACION'),
    createdAt: datetime('created_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
  },
  (table) => ({
    uqLineaCodigo: uniqueIndex('uq_linea_codigo').on(table.centroId, table.codigoLinea),
    idxLineaCentro: index('idx_linea_centro').on(table.centroId),
  })
);

// ============================================================================
// 7. TABLA: aquaculture_inspections (Inspecciones Submarinas ROV y Taller de Redes)
// Bitácora pericial, piloto certificado Armada de Chile, video y fotos analizadas
// ============================================================================
export const aquacultureInspections = mysqlTable(
  'aquaculture_inspections',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    centroId: varchar('centro_id', { length: 36 })
      .notNull()
      .references(() => aquacultureCenters.id, { onDelete: 'cascade' }),
    fechaInspeccion: date('fecha_inspeccion', { mode: 'string' }).notNull(),
    tipoInspeccion: mysqlEnum('tipo_inspeccion', [
      'ROV_SUBMARINA_ROBOTICA',
      'TALLER_REDES_RECEPCION',
      'TALLER_REDES_POST_LAVADO',
      'FONDEO_BATIMETRIA_ACUSTICA',
      'AUDITORIA_PERICIAL_SERNAPESCA',
    ]).notNull(),
    inspectorNavalNombre: varchar('inspector_naval_nombre', { length: 150 }).notNull(),
    matriculaArmadaOIdentificacion: varchar('matricula_armada_o_identificacion', { length: 50 }).notNull(),
    empresaCertificadora: varchar('empresa_certificadora', { length: 150 }).notNull(),
    robotRovModelo: varchar('robot_rov_modelo', { length: 100 }), // ej: 'BlueROV2 Heavy HD Video 4K'
    profundidadMaximaAlcanzadaM: decimal('profundidad_maxima_alcanzada_m', { precision: 6, scale: 2 }).notNull(),
    totalHorasGrabacion: decimal('total_horas_grabacion', { precision: 5, scale: 2 }).notNull().default('1.00'),
    totalFotografiasAnalizadas: int('total_fotografias_analizadas').notNull().default(0),
    totalAnomaliasDetectadas: int('total_anomalias_detectadas').notNull().default(0),
    anomaliasCriticasRg1821: int('anomalias_criticas_rg1821').notNull().default(0),
    dictamenConformidad: mysqlEnum('dictamen_conformidad', [
      'CONFORME_100_NORMATIVO',
      'CONFORME_CON_OBSERVACIONES_MENORES',
      'NO_CONFORME_CRITICO_REQUIERE_ACCION_INMEDIATA',
      'CLAUSURA_PREVENTIVA_JAULA',
    ]).notNull(),
    videoEvidenciaUrl: varchar('video_evidencia_url', { length: 500 }),
    informeTecnicoPdfUrl: varchar('informe_tecnico_pdf_url', { length: 500 }),
    observacionesTecnicas: text('observaciones_tecnicas'),
    createdAt: datetime('created_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
  },
  (table) => ({
    idxInspeccionCentroFecha: index('idx_inspeccion_centro_fecha').on(table.centroId, table.fechaInspeccion),
    idxInspeccionDictamen: index('idx_inspeccion_dictamen').on(table.dictamenConformidad),
  })
);

// ============================================================================
// 8. TABLA: aquaculture_anomalies (Mapeo de Anomalías y Roturas sobre Modelo 3D)
// Localización espacial (x, y, z en metros), severidad, foto/video y trazabilidad OP
// ============================================================================
export const aquacultureAnomalies = mysqlTable(
  'aquaculture_anomalies',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    inspeccionId: varchar('inspeccion_id', { length: 36 })
      .notNull()
      .references(() => aquacultureInspections.id, { onDelete: 'cascade' }),
    centroId: varchar('centro_id', { length: 36 })
      .notNull()
      .references(() => aquacultureCenters.id, { onDelete: 'cascade' }),
    moduloId: varchar('modulo_id', { length: 36 }).references(() => aquacultureModules.id, { onDelete: 'set null' }),
    netId: varchar('net_id', { length: 36 }).references(() => aquacultureNets.id, { onDelete: 'set null' }),
    tipoAnomalia: mysqlEnum('tipo_anomalia', [
      'ROTURA_MALLA_CORTE_FILAMENTO',
      'DESGASTE_POR_ABRASION_ROCE',
      'CORTE_CABO_RELINGA',
      'PERDIDA_CROTAL_TRAZABILIDAD',
      'FALLA_SEPARADOR_CONTACTO_REDES',
      'DESPRENDIMIENTO_LASTRE_FONDO',
      'FATIGA_FONDEO_GRILLADA',
      'INCUMPLIMIENTO_NORMATIVO_RG1821',
      'INCUMPLIMIENTO_NORMATIVO_RG941',
    ]).notNull(),
    nivelCriticidad: mysqlEnum('nivel_criticidad', [
      'LEVE_MONITOREO',
      'MEDIA_PROGRAMAR_TALLER',
      'CRITICA_ALTO_RIESGO_ESCAPE_SALMONES',
      'EMERGENCIA_ACCION_SUBMARINA_INMEDIATA',
    ]).notNull(),
    tamanoAberturaCm: decimal('tamano_abertura_cm', { precision: 6, scale: 2 }).default('0.00'),
    numeroMallasCortadas: int('numero_mallas_cortadas').default(0),
    // Coordenadas Tridimensionales Espaciales relativas a la Jaula (en metros)
    coordenadaRelativaX: decimal('coordenada_relativa_x', { precision: 6, scale: 2 }).notNull(), // Distancia desde vértice origen
    coordenadaRelativaY: decimal('coordenada_relativa_y', { precision: 6, scale: 2 }).notNull(), // Distancia transversal
    profundidadZMetros: decimal('profundidad_z_metros', { precision: 6, scale: 2 }).notNull(), // Profundidad desde la superficie
    caraJaula: mysqlEnum('cara_jaula', ['NORTE', 'SUR', 'ESTE', 'OESTE', 'FONDO_PLANCHA', 'RELINGA_SUPERIOR', 'CABO_FONDEO']).notNull(),
    fotogramaEvidenciaUrl: varchar('fotograma_evidencia_url', { length: 500 }).notNull(),
    timestampVideoSegundo: int('timestamp_video_segundo'),
    ordenProduccionReparacionId: varchar('orden_produccion_reparacion_id', { length: 36 }).references(() => productionOrders.id, { onDelete: 'set null' }),
    estadoReparacion: mysqlEnum('estado_reparacion', [
      'DETECTADA_PENDIENTE',
      'REPARADA_IN_SITU_BUZO',
      'REPARADA_EN_TALLER_REDERIA',
      'VALIDADA_POR_INSPECTOR_NAVAL',
      'DESESTIMADA_FALSO_POSITIVO',
    ]).notNull().default('DETECTADA_PENDIENTE'),
    fechaReparacion: date('fecha_reparacion', { mode: 'string' }),
    observacionNaval: text('observacion_naval').notNull(),
    createdAt: datetime('created_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
  },
  (table) => ({
    idxAnomaliaInspeccion: index('idx_anomalia_inspeccion').on(table.inspeccionId),
    idxAnomaliaCentro: index('idx_anomalia_centro').on(table.centroId),
    idxAnomaliaCriticidad: index('idx_anomalia_criticidad').on(table.nivelCriticidad),
    idxAnomaliaEstado: index('idx_anomalia_estado').on(table.estadoReparacion),
  })
);

export type AquacultureCenterRecord = typeof aquacultureCenters.$inferSelect;
export type NewAquacultureCenterRecord = typeof aquacultureCenters.$inferInsert;

export type AquacultureModuleRecord = typeof aquacultureModules.$inferSelect;
export type NewAquacultureModuleRecord = typeof aquacultureModules.$inferInsert;

export type AquacultureDrawingRecord = typeof aquacultureDrawings.$inferSelect;
export type NewAquacultureDrawingRecord = typeof aquacultureDrawings.$inferInsert;

export type AquacultureNetRecord = typeof aquacultureNets.$inferSelect;
export type NewAquacultureNetRecord = typeof aquacultureNets.$inferInsert;

export type AquacultureComponentRecord = typeof aquacultureComponents.$inferSelect;
export type NewAquacultureComponentRecord = typeof aquacultureComponents.$inferInsert;

export type AquacultureMooringLineRecord = typeof aquacultureMooringLines.$inferSelect;
export type NewAquacultureMooringLineRecord = typeof aquacultureMooringLines.$inferInsert;

export type AquacultureInspectionRecord = typeof aquacultureInspections.$inferSelect;
export type NewAquacultureInspectionRecord = typeof aquacultureInspections.$inferInsert;

export type AquacultureAnomalyRecord = typeof aquacultureAnomalies.$inferSelect;
export type NewAquacultureAnomalyRecord = typeof aquacultureAnomalies.$inferInsert;
