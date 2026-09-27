import {
  mysqlTable,
  varchar,
  text,
  datetime,
  int,
  boolean,
  json,
  mysqlEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/mysql-core';
import { sql, relations } from 'drizzle-orm';
import { companies } from './tenancySchema';

// ============================================================================
// ENUMS Y CONSTANTES DEL SUBSISTEMA DE GOBERNANZA AGÉNTICA
// ============================================================================

export const agentModuleEnumValues = [
  'MASTER_ORCHESTRATOR',    // Agente Principal Coordinador de la Empresa (COO/CFO AI)
  'ACCOUNTING_LEDGER',      // Agente Contable & Balances IFRS
  'SII_RCV',                // Agente RCV & Cumplimiento Tributario SII
  'F29_TAX',                // Agente Impuestos Mensuales F29 & PPM
  'BANK_RECON',             // Agente Tesorería & Conciliación Bancaria
  'INVENTORY_WMS',          // Agente Inventario, Stock & Bodegas WMS
  'RRHH',                   // Agente Remuneraciones, Previred & Contratos DT
  'PRODUCTION_COSTS',       // Agente Costos Fabriles & Producción NIC 2
  'FIXED_ASSETS',           // Agente Activo Fijo & Depreciaciones NIC 16
  'FORENSIC_AUDITOR',       // Agente Auditor Forense & Control Interno
  'SALES_COMMERCIAL',       // Agente Comercial, Presupuestos & Cotizaciones
] as const;

export type AgentModuleCode = (typeof agentModuleEnumValues)[number];

export const agentAutonomyLevelEnumValues = [
  'ASISTIDO',                  // Requiere aprobación humana para cada acción
  'SEMI_AUTONOMO',             // Ejecuta y notifica; aprueba montos menores a umbral
  'AUTONOMO_CON_SUPERVISION',  // Supervisado criptográficamente por Agente Principal
  'AUTONOMO_TOTAL',            // Plena autonomía dentro de directivas de gobernanza
] as const;

export type AgentAutonomyLevel = (typeof agentAutonomyLevelEnumValues)[number];

export const agentTaskPriorityEnumValues = [
  'BAJA',
  'MEDIA',
  'ALTA',
  'CRITICA',
] as const;

export type AgentTaskPriority = (typeof agentTaskPriorityEnumValues)[number];

export const agentTaskStatusEnumValues = [
  'PENDIENTE',
  'DELEGADA_POR_PRINCIPAL',
  'EN_PROCESO',
  'ESPERANDO_SUPERVISION',
  'COMPLETADA',
  'RECHAZADA_POR_SUPERVISOR',
  'FALLIDA',
] as const;

export type AgentTaskStatus = (typeof agentTaskStatusEnumValues)[number];

export const interAgentMessageTypeEnumValues = [
  'DELEGACION_TAREA',
  'SOLICITUD_DATOS',
  'REPORTE_RESULTADO',
  'ALERTA_DISCREPANCIA',
  'VEREDICTO_SUPERVISION',
  'ORDEN_BLOQUEO',
  'CONFIRMACION_ASIENTO',
] as const;

export type InterAgentMessageType = (typeof interAgentMessageTypeEnumValues)[number];

export const learningCategoryEnumValues = [
  'ERROR_IMPUTACION',
  'DESCUADRE_PARTIDA_DOBLE',
  'NORMATIVA_SII',
  'RECHAZO_SUPERVISOR',
  'PREFERENCIA_CLIENTE',
] as const;

export type LearningCategory = (typeof learningCategoryEnumValues)[number];

// ============================================================================
// 1. TABLA: enterprise_agent_profiles (Padrón de Agentes Autónomos por Empresa)
// ============================================================================
export const enterpriseAgentProfiles = mysqlTable(
  'enterprise_agent_profiles',
  {
    id: varchar('id', { length: 36 }).primaryKey(), // UUID v4
    empresaId: varchar('empresa_id', { length: 36 })
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    agenteCodigo: mysqlEnum('agente_codigo', agentModuleEnumValues).notNull(),
    nombreDescriptivo: varchar('nombre_descriptivo', { length: 150 }).notNull(),
    rolProceso: varchar('rol_proceso', { length: 100 }).notNull(), // ej. 'ORQUESTADOR_GENERAL', 'CONTABILIDAD_GENERAL', etc.
    esAgentePrincipal: boolean('es_agente_principal').notNull().default(false),
    nivelAutonomia: mysqlEnum('nivel_autonomia', agentAutonomyLevelEnumValues)
      .notNull()
      .default('AUTONOMO_CON_SUPERVISION'),
    estadoOperativo: mysqlEnum('estado_operativo', [
      'ACTIVO',
      'EN_ESPERA',
      'EJECUTANDO',
      'EN_PAUSA',
      'ERROR',
    ]).notNull().default('ACTIVO'),
    instruccionesSistema: text('instrucciones_sistema'),
    capacidadesJson: json('capacidades_json').$type<string[]>(),
    metricasRendimiento: json('metricas_rendimiento').$type<{
      tareasCompletadas?: number;
      tareasFallidas?: number;
      tiempoPromedioEjecucionMs?: number;
      tasaAprobacionSupervisor?: number;
      ultimoError?: string;
    }>(),
    ultimoLatido: datetime('ultimo_latido', { fsp: 3 }),
    createdAt: datetime('created_at', { fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),
    updatedAt: datetime('updated_at', { fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)`)
      .notNull(),
  },
  (table) => ({
    uqEmpresaAgente: uniqueIndex('uq_empresa_agente_perfil').on(table.empresaId, table.agenteCodigo),
    idxPerfilEmpresa: index('idx_perfil_empresa').on(table.empresaId),
    idxPerfilAgente: index('idx_perfil_agente').on(table.agenteCodigo),
    idxPerfilPrincipal: index('idx_perfil_principal').on(table.empresaId, table.esAgentePrincipal),
  })
);

// ============================================================================
// 2. TABLA: agent_coordination_tasks (Tareas Orquestadas por el Agente Principal)
// ============================================================================
export const agentCoordinationTasks = mysqlTable(
  'agent_coordination_tasks',
  {
    id: varchar('id', { length: 36 }).primaryKey(), // UUID v4
    empresaId: varchar('empresa_id', { length: 36 })
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    agentePrincipalId: varchar('agente_principal_id', { length: 36 }),
    agenteAsignadoCodigo: mysqlEnum('agente_asignado_codigo', agentModuleEnumValues).notNull(),
    flujoProceso: varchar('flujo_proceso', { length: 100 }).notNull(), // ej: 'CIERRE_MENSUAL', 'SINCRONIZACION_RCV', 'LIQUIDACION_F29'
    tituloTarea: varchar('titulo_tarea', { length: 255 }).notNull(),
    descripcion: text('descripcion'),
    payloadEntrada: json('payload_entrada').notNull(),
    prioridad: mysqlEnum('prioridad', agentTaskPriorityEnumValues).notNull().default('MEDIA'),
    estado: mysqlEnum('estado', agentTaskStatusEnumValues).notNull().default('PENDIENTE'),
    progresoPct: int('progreso_pct').notNull().default(0),
    resultadoSalida: json('resultado_salida'),
    requiereAprobacionHumana: boolean('requiere_aprobacion_humana').notNull().default(false),
    aprobadoPorUsuario: varchar('aprobado_por_usuario', { length: 100 }),
    traceId: varchar('trace_id', { length: 64 }).notNull(),
    errorMensaje: text('error_mensaje'),
    createdAt: datetime('created_at', { fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),
    startedAt: datetime('started_at', { fsp: 3 }),
    completedAt: datetime('completed_at', { fsp: 3 }),
  },
  (table) => ({
    idxCoordTaskEmpresa: index('idx_coord_task_empresa').on(table.empresaId),
    idxCoordTaskEstado: index('idx_coord_task_estado').on(table.estado),
    idxCoordTaskAgente: index('idx_coord_task_agente').on(table.agenteAsignadoCodigo),
    idxCoordTaskTrace: index('idx_coord_task_trace').on(table.traceId),
  })
);

// ============================================================================
// 3. TABLA: agent_inter_communications (Bus de Comunicación Inter-Agentes A2A)
// ============================================================================
export const agentInterCommunications = mysqlTable(
  'agent_inter_communications',
  {
    id: varchar('id', { length: 36 }).primaryKey(), // UUID v4
    empresaId: varchar('empresa_id', { length: 36 })
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    taskId: varchar('task_id', { length: 36 }).references(() => agentCoordinationTasks.id, {
      onDelete: 'set null',
    }),
    agenteEmisor: mysqlEnum('agente_emisor', agentModuleEnumValues).notNull(),
    agenteReceptor: mysqlEnum('agente_receptor', agentModuleEnumValues).notNull(),
    tipoMensaje: mysqlEnum('tipo_mensaje', interAgentMessageTypeEnumValues).notNull(),
    asunto: varchar('asunto', { length: 255 }).notNull(),
    contenidoJson: json('contenido_json').notNull(),
    leido: boolean('leido').notNull().default(false),
    fechaEmision: datetime('fecha_emision', { fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),
  },
  (table) => ({
    idxInterCommEmpresa: index('idx_inter_comm_empresa').on(table.empresaId),
    idxInterCommEmisor: index('idx_inter_comm_emisor').on(table.agenteEmisor),
    idxInterCommReceptor: index('idx_inter_comm_receptor').on(table.agenteReceptor),
    idxInterCommTask: index('idx_inter_comm_task').on(table.taskId),
  })
);

// ============================================================================
// 4. TABLA: agent_transient_states (Persistencia de Respaldo para Caché y Redis)
// ============================================================================
export const agentTransientStates = mysqlTable(
  'agent_transient_states',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    empresaId: varchar('empresa_id', { length: 36 })
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    redisKey: varchar('redis_key', { length: 255 }).notNull(),
    tipoCache: mysqlEnum('tipo_cache', [
      'SESSION_AGENT',
      'LOCK_DISTRIBUIDO',
      'QUEUE_SNAPSHOT',
      'FAST_METRICS',
      'AGENT_MEMORY_HOT',
    ]).notNull(),
    valorJson: json('valor_json').notNull(),
    ttlSegundos: int('ttl_segundos').notNull().default(3600),
    expiresAt: datetime('expires_at', { fsp: 3 }),
    updatedAt: datetime('updated_at', { fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)`)
      .notNull(),
  },
  (table) => ({
    uqTransientRedisKey: uniqueIndex('uq_transient_redis_key').on(table.empresaId, table.redisKey),
    idxTransientEmpresa: index('idx_transient_empresa').on(table.empresaId),
    idxTransientTipo: index('idx_transient_tipo').on(table.tipoCache),
    idxTransientExpires: index('idx_transient_expires').on(table.expiresAt),
  })
);

// ============================================================================
// 5. TABLA: company_agent_configs (Instrucciones Especiales y Directivas Ad-Hoc)
// ============================================================================
export const companyAgentConfigs = mysqlTable(
  'company_agent_configs',
  {
    id: varchar('id', { length: 36 }).primaryKey(), // UUID v4
    empresaId: varchar('empresa_id', { length: 36 })
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    moduloCodigo: mysqlEnum('modulo_codigo', agentModuleEnumValues).notNull(),
    instruccionesEspeciales: text('instrucciones_especiales'),
    parametrosOperativos: json('parametros_operativos').notNull().$type<{
      rutaDocumentosContratos?: string;
      reglasImputacionEspecificas?: Array<{
        tipoGasto: string;
        codigoCuentaSugerido: string;
        nombreCuentaSugerido: string;
        justificacion?: string;
      }>;
      excluirProveedoresAcuse?: string[];
      limiteMontoAutoAprobacion?: number;
      requiereAprobacionSocio?: boolean;
      centroCostoPorDefecto?: string;
      [key: string]: any;
    }>(),
    activo: boolean('activo').notNull().default(true),
    updatedAt: datetime('updated_at', { fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)`)
      .notNull(),
  },
  (table) => ({
    uqEmpresaModulo: uniqueIndex('uq_empresa_modulo').on(table.empresaId, table.moduloCodigo),
    idxConfigEmpresa: index('idx_config_empresa').on(table.empresaId),
    idxConfigModulo: index('idx_config_modulo').on(table.moduloCodigo),
  })
);

// ============================================================================
// 2. TABLA: agent_learnings (Base de Conocimiento y Memoria de Aprendizaje)
// ============================================================================
export const agentLearnings = mysqlTable(
  'agent_learnings',
  {
    id: varchar('id', { length: 36 }).primaryKey(), // UUID v4
    empresaId: varchar('empresa_id', { length: 36 }), // NULL si es global del sistema o UUID específico
    moduloCodigo: varchar('modulo_codigo', { length: 50 }).notNull(),
    categoria: mysqlEnum('categoria', learningCategoryEnumValues).notNull(),
    descripcionError: text('descripcion_error').notNull(),
    solucionAplicada: text('solucion_aplicada').notNull(),
    asientoIncorrectoJson: json('asiento_incorrecto_json'),
    asientoCorregidoJson: json('asiento_corregido_json'),
    vecesEvitado: int('veces_evitado').notNull().default(0),
    activo: boolean('activo').notNull().default(true),
    createdAt: datetime('created_at', { fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),
  },
  (table) => ({
    idxLearningsEmpresaModulo: index('idx_learnings_empresa_modulo').on(
      table.empresaId,
      table.moduloCodigo
    ),
    idxLearningsCategoria: index('idx_learnings_categoria').on(table.categoria),
    idxLearningsActivo: index('idx_learnings_activo').on(table.activo),
  })
);

// ============================================================================
// RELACIONES DRIZZLE ORM
// ============================================================================
export const companyAgentConfigsRelations = relations(companyAgentConfigs, ({ one }) => ({
  company: one(companies, {
    fields: [companyAgentConfigs.empresaId],
    references: [companies.id],
  }),
}));

export const agentLearningsRelations = relations(agentLearnings, ({ one }) => ({
  company: one(companies, {
    fields: [agentLearnings.empresaId],
    references: [companies.id],
  }),
}));

export const enterpriseAgentProfilesRelations = relations(enterpriseAgentProfiles, ({ one }) => ({
  company: one(companies, {
    fields: [enterpriseAgentProfiles.empresaId],
    references: [companies.id],
  }),
}));

export const agentCoordinationTasksRelations = relations(agentCoordinationTasks, ({ one, many }) => ({
  company: one(companies, {
    fields: [agentCoordinationTasks.empresaId],
    references: [companies.id],
  }),
  interCommunications: many(agentInterCommunications),
}));

export const agentInterCommunicationsRelations = relations(agentInterCommunications, ({ one }) => ({
  company: one(companies, {
    fields: [agentInterCommunications.empresaId],
    references: [companies.id],
  }),
  task: one(agentCoordinationTasks, {
    fields: [agentInterCommunications.taskId],
    references: [agentCoordinationTasks.id],
  }),
}));

export const agentTransientStatesRelations = relations(agentTransientStates, ({ one }) => ({
  company: one(companies, {
    fields: [agentTransientStates.empresaId],
    references: [companies.id],
  }),
}));

// ============================================================================
// TIPOS ESTRICTOS DE INFERENCIA DRIZZLE
// ============================================================================
export type EnterpriseAgentProfile = typeof enterpriseAgentProfiles.$inferSelect;
export type NewEnterpriseAgentProfile = typeof enterpriseAgentProfiles.$inferInsert;

export type AgentCoordinationTask = typeof agentCoordinationTasks.$inferSelect;
export type NewAgentCoordinationTask = typeof agentCoordinationTasks.$inferInsert;

export type AgentInterCommunication = typeof agentInterCommunications.$inferSelect;
export type NewAgentInterCommunication = typeof agentInterCommunications.$inferInsert;

export type AgentTransientState = typeof agentTransientStates.$inferSelect;
export type NewAgentTransientState = typeof agentTransientStates.$inferInsert;

export type CompanyAgentConfig = typeof companyAgentConfigs.$inferSelect;
export type NewCompanyAgentConfig = typeof companyAgentConfigs.$inferInsert;

export type AgentLearning = typeof agentLearnings.$inferSelect;
export type NewAgentLearning = typeof agentLearnings.$inferInsert;
