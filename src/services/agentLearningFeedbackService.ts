import crypto from 'node:crypto';
import { eq, and, sql, or, isNull, desc } from 'drizzle-orm';
import { getMysqlDb, isRealMysqlConnected, inMemoryAgentLearnings, inMemoryAgentConfigs } from '../db/mysqlClient';
import {
  agentLearnings,
  companyAgentConfigs,
  type AgentModuleCode,
  type LearningCategory,
  type AgentLearning,
  type CompanyAgentConfig,
} from '../db/mysqlSchema';

// ============================================================================
// 1. REGISTRO Y AUTO-MEJORA CONTINUA DE APRENDIZAJES (FEEDBACK LOOP)
// ============================================================================

/**
 * Registra una corrección del Contador o del Orquestador en la Base de Conocimiento
 */
export async function recordAgentCorrection(params: {
  empresaId?: string | null;
  modulo: AgentModuleCode;
  categoria: LearningCategory;
  error: string;
  solucion: string;
  incorrecto?: any;
  corregido?: any;
}): Promise<AgentLearning> {
  const { empresaId, modulo, categoria, error, solucion, incorrecto, corregido } = params;

  const newId = crypto.randomUUID();
  const learningItem = {
    id: newId,
    empresaId: empresaId || null,
    moduloCodigo: modulo,
    categoria,
    descripcionError: error.trim(),
    solucionAplicada: solucion.trim(),
    asientoIncorrectoJson: incorrecto ?? null,
    asientoCorregidoJson: corregido ?? null,
    vecesEvitado: 0,
    activo: true,
    createdAt: new Date(),
  };

  const db = getMysqlDb();

  if (isRealMysqlConnected) {
    try {
      await db.insert(agentLearnings).values(learningItem);
    } catch (err: any) {
      console.warn(`[agentLearnings] Error guardando en MySQL, utilizando fallback: ${err.message}`);
      inMemoryAgentLearnings.unshift(learningItem);
    }
  } else {
    inMemoryAgentLearnings.unshift(learningItem);
  }

  console.log(
    `[Base de Conocimiento] Nuevo aprendizaje registrado [${categoria}] en módulo ${modulo}: "${error.slice(0, 80)}..."`
  );

  return learningItem;
}

/**
 * Incrementa el contador de incidentes prevenidos cuando un agente evita un error catalogado
 */
export async function incrementLearningAvoidance(learningId: string): Promise<number> {
  const db = getMysqlDb();

  if (isRealMysqlConnected) {
    try {
      await db
        .update(agentLearnings)
        .set({ vecesEvitado: sql`${agentLearnings.vecesEvitado} + 1` })
        .where(eq(agentLearnings.id, learningId));
    } catch (err: any) {
      console.warn(`[agentLearnings] Error actualizando contador en MySQL: ${err.message}`);
    }
  }

  // Actualizar en memoria
  const memoryItem = inMemoryAgentLearnings.find((l) => l.id === learningId);
  if (memoryItem) {
    memoryItem.vecesEvitado = (memoryItem.vecesEvitado || 0) + 1;
    return memoryItem.vecesEvitado;
  }

  return 1;
}

/**
 * Consulta la lista de aprendizajes filtrados por empresa y módulo
 */
export async function listLearnings(params?: {
  empresaId?: string;
  moduloCodigo?: AgentModuleCode;
  activoOnly?: boolean;
}): Promise<AgentLearning[]> {
  const db = getMysqlDb();
  const { empresaId, moduloCodigo, activoOnly = true } = params || {};

  if (isRealMysqlConnected) {
    try {
      const conditions = [];
      if (activoOnly) conditions.push(eq(agentLearnings.activo, true));
      if (moduloCodigo) conditions.push(eq(agentLearnings.moduloCodigo, moduloCodigo));
      if (empresaId) {
        conditions.push(or(eq(agentLearnings.empresaId, empresaId), isNull(agentLearnings.empresaId)));
      }

      const rows = await db
        .select()
        .from(agentLearnings)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(agentLearnings.createdAt));

      return rows as AgentLearning[];
    } catch (err: any) {
      console.warn(`[agentLearnings] Error consultando en MySQL: ${err.message}`);
    }
  }

  // Filtrado en memoria
  return inMemoryAgentLearnings.filter((l) => {
    if (activoOnly && !l.activo) return false;
    if (moduloCodigo && l.moduloCodigo !== moduloCodigo && l.moduloCodigo !== 'ACCOUNTING_LEDGER') return false;
    if (empresaId && l.empresaId && l.empresaId !== empresaId) return false;
    return true;
  });
}

// ============================================================================
// 2. GESTIÓN DE CONFIGURACIONES E INSTRUCCIONES ESPECIALES AD-HOC
// ============================================================================

/**
 * Guarda o actualiza la directiva especial para una empresa y módulo específico
 */
export async function upsertCompanyAgentConfig(params: {
  empresaId: string;
  moduloCodigo: AgentModuleCode;
  instruccionesEspeciales?: string;
  parametrosOperativos?: Record<string, any>;
  activo?: boolean;
}): Promise<CompanyAgentConfig> {
  const {
    empresaId,
    moduloCodigo,
    instruccionesEspeciales = '',
    parametrosOperativos = {},
    activo = true,
  } = params;

  const db = getMysqlDb();
  const existingConfig = inMemoryAgentConfigs.find(
    (c) => c.empresaId === empresaId && c.moduloCodigo === moduloCodigo
  );

  const configData = {
    id: existingConfig ? existingConfig.id : crypto.randomUUID(),
    empresaId,
    moduloCodigo,
    instruccionesEspeciales: instruccionesEspeciales.trim(),
    parametrosOperativos,
    activo,
    updatedAt: new Date(),
  };

  if (isRealMysqlConnected) {
    try {
      await db
        .insert(companyAgentConfigs)
        .values(configData)
        .onDuplicateKeyUpdate({
          set: {
            instruccionesEspeciales: configData.instruccionesEspeciales,
            parametrosOperativos: configData.parametrosOperativos,
            activo: configData.activo,
            updatedAt: configData.updatedAt,
          },
        });
    } catch (err: any) {
      console.warn(`[companyAgentConfigs] Error guardando en MySQL: ${err.message}`);
    }
  }

  // Actualizar o insertar en memoria
  const idx = inMemoryAgentConfigs.findIndex(
    (c) => c.empresaId === empresaId && c.moduloCodigo === moduloCodigo
  );
  if (idx >= 0) {
    inMemoryAgentConfigs[idx] = configData;
  } else {
    inMemoryAgentConfigs.push(configData);
  }

  return configData;
}

/**
 * Obtiene la configuración e instrucciones de un módulo para una empresa
 */
export async function getCompanyAgentConfig(
  empresaId: string,
  moduloCodigo: AgentModuleCode
): Promise<CompanyAgentConfig | null> {
  const db = getMysqlDb();

  if (isRealMysqlConnected) {
    try {
      const [config] = await db
        .select()
        .from(companyAgentConfigs)
        .where(
          and(
            eq(companyAgentConfigs.empresaId, empresaId),
            eq(companyAgentConfigs.moduloCodigo, moduloCodigo)
          )
        )
        .limit(1);

      if (config) return config as CompanyAgentConfig;
    } catch (err: any) {
      console.warn(`[companyAgentConfigs] Error consultando en MySQL: ${err.message}`);
    }
  }

  const memory = inMemoryAgentConfigs.find(
    (c) => c.empresaId === empresaId && c.moduloCodigo === moduloCodigo
  );
  return memory || null;
}
