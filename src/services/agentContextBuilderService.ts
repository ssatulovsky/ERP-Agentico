import { getDemoClients } from '../data/seedData';
import { diskPersistence } from './diskPersistenceService';
import { eq, or, and, isNull, desc } from 'drizzle-orm';
import { getMysqlDb, isRealMysqlConnected, inMemoryAgentConfigs, inMemoryAgentLearnings } from '../db/mysqlClient';
import {
  companies,
  chartOfAccounts,
  bankAccounts,
  companyAgentConfigs,
  agentLearnings,
  type AgentModuleCode,
  type LearningCategory,
} from '../db/mysqlSchema';

export interface CompanyOperationalProfile {
  empresaId: string;
  rut: string;
  razonSocial: string;
  giro: string;
  regimenTributario: '14_A' | '14_D3' | '14_D8' | 'NO_INFORMADO';
  esClienteAncla: boolean;
  tasaPpmSugerida: string;
  beneficioPostergacionIva: boolean;
  cuentaBancariaPrimaria?: {
    banco: string;
    numeroCuenta: string;
    tipo: string;
  };
  cuentasContablesRelevantes?: Array<{
    codigo: string;
    nombre: string;
    clasificacion: string;
  }>;
}

export interface AgentLearningItem {
  id: string;
  categoria: LearningCategory;
  moduloCodigo: string;
  descripcionError: string;
  solucionAplicada: string;
  asientoIncorrectoJson?: any;
  asientoCorregidoJson?: any;
  vecesEvitado: number;
}

/**
 * Retorna las leyes chilenas y directivas base por módulo (Capa 1)
 */
function getModuleLegalBaseline(moduloCodigo: AgentModuleCode): {
  rol: string;
  marcosLegales: string[];
  principiosOperativos: string[];
} {
  switch (moduloCodigo) {
    case 'RRHH':
      return {
        rol: 'Agente Senior Especialista en Remuneraciones, Derecho Laboral Chileno y Relaciones Laborales DT',
        marcosLegales: [
          'Código del Trabajo de la República de Chile (DFL 1)',
          'Ley 21.643 (Ley Karin) sobre prevención, investigación y sanción del acoso laboral, sexual y violencia en el trabajo',
          'Ley 21.561 de reducción progresiva de la jornada laboral (Ley 40 Horas)',
          'Ley 21.133 y normativas de Seguridad Social (AFP, Fonasa/Isapre, AFC, Mutualidades de Seguridad)',
          'Tope imponible previsional 87.8 UF y cesantía 132.3 UF para 2026',
          'Normas técnicas del Libro de Remuneraciones Electrónico (LRE) de la Dirección del Trabajo (DT)',
        ],
        principiosOperativos: [
          'Toda asignación colación/movilización no debe superar montos razonables para no constituir renta o sueldo encubierto.',
          'Pactos de horas extraordinarias deben constar por escrito, justificar necesidades temporales y no exceder 2 horas diarias (Art. 31 CdT).',
          'Toda denuncia vinculada a acoso debe activar inmediatamente los canales de confidencialidad cifrada de la Ley Karin.',
        ],
      };

    case 'SII_RCV':
      return {
        rol: 'Agente Especialista en Registro de Compras y Ventas (RCV) del SII, DTEs y Mérito Ejecutivo',
        marcosLegales: [
          'Decreto Ley 825 sobre Impuesto a las Ventas y Servicios (IVA)',
          'Resoluciones Exentas SII para Documentos Tributarios Electrónicos (DTE: Facturas 33/34, Guías 52, NC 61, ND 56)',
          'Ley 19.983 sobre mérito ejecutivo y transferencia y cesión de créditos (Factoring y plazo de acuse de 8 días corridos)',
          'Art. 23 DL 825 sobre requisitos de procedencia del Crédito Fiscal IVA y gastos rechazados Art. 21 LIR',
          'Circular SII N° 35/2017 y normativas de proporcionalidad de IVA para giros con ventas exentas y afectas',
        ],
        principiosOperativos: [
          'No reclamar facturas válidas fuera de plazo legal de 8 días.',
          'Identificar rigurosamente proveedores de riesgo o facturas con glosas no relacionadas con el giro para evitar objeciones del SII.',
          'Reconocer el IVA uso común y calcular el factor de proporcionalidad mensual de Crédito Fiscal.',
        ],
      };

    case 'F29_TAX':
      return {
        rol: 'Agente Tributario Senior para Formulario 29, PPM, Retenciones y Capital Propio Tributario (CPT)',
        marcosLegales: [
          'Ley sobre Impuesto a la Renta (LIR - DL 824)',
          'Régimen Pro Pyme General (Art. 14 D N° 3) y Régimen Pro Pyme Transparente (Art. 14 D N° 8)',
          'Régimen General Semi-Integrado (Art. 14 A)',
          'Ley 21.133: Retención obligatoria de Impuesto de Segunda Categoría sobre Boletas de Honorarios (Tasa legal 14.50% en 2026)',
          'Art. 64 LIR: Beneficio de postergación del pago de IVA hasta por 2 meses para contribuyentes acogidos al régimen Pro Pyme',
          'Resoluciones SII relativas al cálculo de Capital Propio Tributario Simplificado',
        ],
        principiosOperativos: [
          'Cálculo exacto del PPM según tasa fija o histórica aplicable a los ingresos brutos percibidos o devengados.',
          'Conciliar siempre los montos de IVA débito y crédito del F29 contra el Libro Mayor y las casillas canónicas del SII.',
          'Verificar retenciones de segunda categoría contra las BHE emitidas a la empresa en el período.',
        ],
      };

    case 'BANK_RECON':
      return {
        rol: 'Agente de Tesorería y Conciliación Bancaria Automática de Grado Corporativo',
        marcosLegales: [
          'Ley General de Bancos y normativas de la Comisión para el Mercado Financiero (CMF)',
          'Normas Internacionales de Contabilidad (NIC 7 - Estado de Flujos de Efectivo)',
          'Principio de Devengado y Realización IFRS',
        ],
        principiosOperativos: [
          'Toda partida de cartola bancaria debe coincidir en fecha valor, número de referencia o RUT contra el auxiliar de bancos.',
          'Cobros por comisiones, mantenciones, intereses o cargos de tarjetas deben imputarse inmediatamente al gasto bancario con su respectivo respaldo.',
          'Partidas en tránsito superiores a 30 días deben ser alertadas como riesgo pericial.',
        ],
      };

    case 'INVENTORY_WMS':
      return {
        rol: 'Agente de Gestión de Existencias, Bodegas (WMS) y Costo de Ventas PMP',
        marcosLegales: [
          'NIC 2 / IFRS para las PYMES (Sección 13: Inventarios)',
          'Resolución SII N° 52/2004 sobre Guías de Despacho Electrónicas (DTE 52)',
          'Art. 30 LIR: Determinación del Costo Directo y valoración de existencias al Costo Promedio Ponderado (PMP)',
        ],
        principiosOperativos: [
          'Cada despacho con Guía de Despacho (DTE 52) genera automáticamente el asiento de Costo de Ventas (5.1.01) contra Existencias (1.1.05).',
          'Las compras ingresan valorizadas al costo neto de adquisición (excluyendo IVA recuperable).',
          'Control de mermas y desvalorizaciones conforme a castigos autorizados por el SII.',
        ],
      };

    case 'ACCOUNTING_LEDGER':
    default:
      return {
        rol: 'Agente Supervisor y Auditor Contable Pericial IFRS / Código de Comercio Chileno',
        marcosLegales: [
          'Código de Comercio Chileno (Artículos 25 a 44: Libros obligatorios, formalidades, prohibiciones de alteración o raspaduras)',
          'Normas Internacionales de Información Financiera (IFRS Full e IFRS para las PYMES emitidas por el IASB y adoptadas por el Colegio de Contadores de Chile)',
          'Ley 20.393 de Responsabilidad Penal de las Personas Jurídicas',
          'Exigencias de auditoría forense y peritaje contable tributario',
        ],
        principiosOperativos: [
          'Partida doble matemática inviolable: SUM(Debe) === SUM(Haber) al centavo exacto.',
          'Prohibición total de importes negativos; toda reversa o ajuste se realiza mediante contracuenta o asiento de reclasificación debitando/acreditando.',
          'Orden canónico obligatorio: Primero todas las líneas con saldo al Debe, seguidas de todas las líneas al Haber.',
          'Generación obligatoria de firma criptográfica inmutable HMAC SHA-256 por cada asiento contable.',
        ],
      };
  }
}

/**
 * Recupera el perfil operativo de la empresa desde MySQL o contingencia en memoria
 */
async function fetchCompanyOperationalProfile(empresaId: string): Promise<CompanyOperationalProfile> {
  const db = getMysqlDb();

  let companyData: any = null;
  let bankAccountData: any = null;
  let relevantAccounts: any[] = [];

  if (isRealMysqlConnected) {
    try {
      const [comp] = await db.select().from(companies).where(eq(companies.id, empresaId));
      companyData = comp;

      const [bank] = await db.select().from(bankAccounts).where(eq(bankAccounts.empresaId, empresaId)).limit(1);
      bankAccountData = bank;

      relevantAccounts = await db
        .select({
          codigo: chartOfAccounts.codigoCuenta,
          nombre: chartOfAccounts.nombreCuenta,
          clasificacion: chartOfAccounts.clasificacion,
        })
        .from(chartOfAccounts)
        .where(eq(chartOfAccounts.empresaId, empresaId))
        .limit(20);
    } catch {
      // Fallback si la tabla no tiene datos
    }
  }

  // Si no está en la base de datos: empresa registrada en disco o de ejemplo (solo DEMO_MODE).
  // Antes se inyectaba el perfil inventado "Distribuidora y Comercializadora del Pacífico SpA" a cualquier empresa.
  if (!companyData) {
    const stored: any = diskPersistence.getClient(empresaId) ||
      getDemoClients().find((c) => c.id === empresaId || c.rut.replace(/[^0-9kK]/g, '') === String(empresaId).replace(/[^0-9kK]/g, ''));
    companyData = stored
      ? { id: stored.id || empresaId, rut: stored.rut, razonSocial: stored.razonSocial, giro: stored.giro, regimenTributario: stored.regimenTributario }
      : { id: empresaId, rut: empresaId, razonSocial: null, giro: null, regimenTributario: null, noRegistrada: true };
  }

  // Régimen y tasa PPM solo si la empresa los tiene registrados (antes se suponía 14 D3 y PPM 0,25 %)
  const regimen = (companyData.regimenTributario || 'NO_INFORMADO') as '14_A' | '14_D3' | '14_D8' | 'NO_INFORMADO';
  const tasaPpm =
    regimen === '14_D3' ? '0.25%' : regimen === '14_D8' ? '0.20% (Transparente)' : regimen === '14_A' ? '1.50%' : 'NO_INFORMADA (pedir al usuario)';
  const beneficioPostergacion = regimen === '14_D3' || regimen === '14_D8';

  return {
    empresaId: companyData.id,
    rut: companyData.rut,
    razonSocial: companyData.razonSocial,
    giro: companyData.giro,
    regimenTributario: regimen,
    esClienteAncla: Boolean(companyData.esClienteAncla),
    tasaPpmSugerida: tasaPpm,
    beneficioPostergacionIva: beneficioPostergacion,
    cuentaBancariaPrimaria: bankAccountData
      ? {
          banco: bankAccountData.bancoCodigo,
          numeroCuenta: bankAccountData.numeroCuenta,
          tipo: bankAccountData.tipoCuenta,
        }
      : null, // sin cuenta bancaria registrada (antes: cuenta inventada 00-123-45678-90)
    cuentasContablesRelevantes:
      relevantAccounts.length > 0
        ? relevantAccounts
        : [
            { codigo: '1.1.01.002', nombre: 'Banco de Chile Cuenta Corriente', clasificacion: 'ACTIVO' },
            { codigo: '1.1.03.001', nombre: 'Clientes Nacionales', clasificacion: 'ACTIVO' },
            { codigo: '1.1.05.001', nombre: 'Existencias y Mercaderías en Bodega', clasificacion: 'ACTIVO' },
            { codigo: '1.1.07.001', nombre: 'IVA Crédito Fiscal (19%)', clasificacion: 'ACTIVO' },
            { codigo: '2.1.01.001', nombre: 'Proveedores Nacionales por Pagar', clasificacion: 'PASIVO' },
            { codigo: '2.1.03.001', nombre: 'IVA Débito Fiscal (19%)', clasificacion: 'PASIVO' },
            { codigo: '2.1.03.002', nombre: 'Retención Impuesto 2da Categoría (14.5%)', clasificacion: 'PASIVO' },
            { codigo: '4.1.01.001', nombre: 'Ingresos por Ventas Facturadas Afectas', clasificacion: 'INGRESOS' },
            { codigo: '5.1.01.001', nombre: 'Costo de Ventas (PMP)', clasificacion: 'COSTOS' },
            { codigo: '5.1.02.015', nombre: 'Servicios de Infraestructura Cloud y SaaS', clasificacion: 'GASTOS' },
            { codigo: '6.1.01.001', nombre: 'Gasto en Sueldos y Remuneraciones', clasificacion: 'GASTOS' },
          ],
  };
}

/**
 * Consulta las directivas e instrucciones especiales de la empresa para el módulo (Capa 3)
 */
async function fetchCompanyAgentConfig(
  empresaId: string,
  moduloCodigo: AgentModuleCode
): Promise<{ instruccionesEspeciales: string; parametrosOperativos: any }> {
  const db = getMysqlDb();

  if (isRealMysqlConnected) {
    try {
      const [config] = await db
        .select()
        .from(companyAgentConfigs)
        .where(
          and(
            eq(companyAgentConfigs.empresaId, empresaId),
            eq(companyAgentConfigs.moduloCodigo, moduloCodigo),
            eq(companyAgentConfigs.activo, true)
          )
        )
        .limit(1);

      if (config) {
        return {
          instruccionesEspeciales: config.instruccionesEspeciales || '',
          parametrosOperativos: config.parametrosOperativos || {},
        };
      }
    } catch {
      // Continuar con memoria si falla la consulta
    }
  }

  // Buscar en contingencia en memoria
  const memoryConfig = inMemoryAgentConfigs.find(
    (c) => c.empresaId === empresaId && c.moduloCodigo === moduloCodigo && c.activo
  );

  if (memoryConfig) {
    return {
      instruccionesEspeciales: memoryConfig.instruccionesEspeciales || '',
      parametrosOperativos: memoryConfig.parametrosOperativos || {},
    };
  }

  return {
    instruccionesEspeciales: 'Sin directivas ad-hoc personalizadas. Seguir normativa estándar general.',
    parametrosOperativos: {},
  };
}

/**
 * Recupera los aprendizajes y errores pasados a evitar de la Base de Conocimiento (Capa 4)
 */
async function fetchAgentLearnings(
  empresaId: string,
  moduloCodigo: AgentModuleCode,
  maxLearnings = 5
): Promise<AgentLearningItem[]> {
  const db = getMysqlDb();

  if (isRealMysqlConnected) {
    try {
      const rows = await db
        .select()
        .from(agentLearnings)
        .where(
          and(
            eq(agentLearnings.moduloCodigo, moduloCodigo),
            eq(agentLearnings.activo, true),
            or(eq(agentLearnings.empresaId, empresaId), isNull(agentLearnings.empresaId))
          )
        )
        .orderBy(desc(agentLearnings.createdAt))
        .limit(maxLearnings);

      if (rows && rows.length > 0) {
        return rows.map((r) => ({
          id: r.id,
          categoria: r.categoria,
          moduloCodigo: r.moduloCodigo,
          descripcionError: r.descripcionError,
          solucionAplicada: r.solucionAplicada,
          asientoIncorrectoJson: r.asientoIncorrectoJson,
          asientoCorregidoJson: r.asientoCorregidoJson,
          vecesEvitado: r.vecesEvitado,
        }));
      }
    } catch {
      // Continuar con contingencia en memoria
    }
  }

  // Filtrar en memoria
  const filtered = inMemoryAgentLearnings.filter(
    (l) =>
      // Solo aprendizajes de la propia empresa o globales (empresaId null); no los de otra empresa
      (l.empresaId === empresaId || l.empresaId === null) &&
      (l.moduloCodigo === moduloCodigo || l.moduloCodigo === 'ACCOUNTING_LEDGER') &&
      l.activo
  );

  return filtered.slice(0, maxLearnings).map((l) => ({
    id: l.id,
    categoria: l.categoria,
    moduloCodigo: l.moduloCodigo,
    descripcionError: l.descripcionError,
    solucionAplicada: l.solucionAplicada,
    asientoIncorrectoJson: l.asientoIncorrectoJson,
    asientoCorregidoJson: l.asientoCorregidoJson,
    vecesEvitado: l.vecesEvitado,
  }));
}

// ============================================================================
// SERVICIO PRINCIPAL: ENSAMBLADOR DE CONTEXTO JERÁRQUICO EN 4 CAPAS
// ============================================================================

/**
 * Ensambla el System Prompt canónico e inviolable en 4 capas ordenadas antes de la llamada a Gemini
 */
export async function buildAgentPromptContext(params: {
  empresaId: string;
  moduloCodigo: AgentModuleCode;
  tareaEspecifica: string;
}): Promise<{
  systemInstruction: string;
  companyProfile: CompanyOperationalProfile;
  learningsApplied: AgentLearningItem[];
}> {
  const { empresaId, moduloCodigo, tareaEspecifica } = params;

  // 1. Cargar las 4 capas en paralelo
  const [legalBaseline, companyProfile, agentConfig, learnings] = await Promise.all([
    Promise.resolve(getModuleLegalBaseline(moduloCodigo)),
    fetchCompanyOperationalProfile(empresaId),
    fetchCompanyAgentConfig(empresaId, moduloCodigo),
    fetchAgentLearnings(empresaId, moduloCodigo),
  ]);

  // 2. Construir la sección de Aprendizajes y Few-Shot Correctivo (Capa 4)
  const learningsFormatted =
    learnings.length > 0
      ? learnings
          .map((item, idx) => {
            const incorrecto = item.asientoIncorrectoJson ? `\n    * Caso Erróneo Anterior: ${JSON.stringify(item.asientoIncorrectoJson)}` : '';
            const corregido = item.asientoCorregidoJson ? `\n    * Solución Obligatoria: ${JSON.stringify(item.asientoCorregidoJson)}` : '';
            return `[LECCIÓN N° ${idx + 1} - ${item.categoria}]
  - ERROR COMETIDO EN PERÍODOS ANTERIORES: "${item.descripcionError}"
  - REGLA MANDATORIA DE RESOLUCIÓN: "${item.solucionAplicada}"${incorrecto}${corregido}
  - Incidentes prevenidos hasta la fecha: ${item.vecesEvitado} veces.`;
          })
          .join('\n\n')
      : 'No existen incidentes previos registrados para este módulo. Mantener estricto apego a las normas.';

  // 3. Formatear cuentas contables sugeridas
  const planCuentasFormatted = (companyProfile.cuentasContablesRelevantes || [])
    .map((c) => `  * ${c.codigo} | ${c.nombre} (${c.clasificacion})`)
    .join('\n');

  // 4. Parámetros operativos formateados
  const paramsFormatted = Object.keys(agentConfig.parametrosOperativos || {}).length > 0
    ? JSON.stringify(agentConfig.parametrosOperativos, null, 2)
    : 'Configuración estándar por defecto.';

  // 5. Ensamblado del System Instruction jerárquico estricto
  const systemInstruction = `
====================================================================================================
SISTEMA INTEGRADO DE GESTIÓN TRIBUTARIA, CONTABLE Y OPERACIONAL (SIEX CHILE)
GOBERNANZA DE AGENTES AUTÓNOMOS BAJO LA TUTELA DEL ORQUESTADOR CONTABLE SENIOR
====================================================================================================

****************************************************************************************************
CAPA 1: IDENTIDAD DEL AGENTE, ROL Y LEGISLACIÓN CHILENA APLICABLE
****************************************************************************************************
ROL ACTIVO: ${legalBaseline.rol}
MÓDULO OPERATIVO: ${moduloCodigo}
TAREA ASIGNADA: "${tareaEspecifica}"

MARCO LEGAL CHILENO APLICABLE:
${legalBaseline.marcosLegales.map((l) => `- ${l}`).join('\n')}

PRINCIPIOS OPERATIVOS Y DE CONTROL INTERNO:
${legalBaseline.principiosOperativos.map((p) => `- ${p}`).join('\n')}

REGLA DE ORO DE PARTIDA DOBLE (IFRS & CÓDIGO DE COMERCIO ARTS. 25-44):
- Toda propuesta de asiento contable DEBE cumplir rigurosamente: SUM(Debe) === SUM(Haber) al centavo exacto.
- PROHIBIDO TERMINANTEMENTE incluir montos negativos en las columnas 'debe' o 'haber'.
- Todo asiento se estructura cronológica y canónicamente: PRIMERO todas las cuentas al Debe, luego todas al Haber.
- Cada movimiento debe incluir RUT auxiliar en cuentas por cobrar/pagar y justificación técnica en la glosa.

****************************************************************************************************
CAPA 2: CONTEXTO OPERATIVO Y PERFIL TRIBUTARIO DE LA EMPRESA CLIENTE
****************************************************************************************************
- RUT TITULAR: ${companyProfile.rut}
- RAZÓN SOCIAL: ${companyProfile.razonSocial}
- GIRO COMERCIAL: ${companyProfile.giro}
- RÉGIMEN TRIBUTARIO LIR: Régimen ${companyProfile.regimenTributario} (Art. 14 LIR)
- TASA DE PPM ASIGNADA: ${companyProfile.tasaPpmSugerida} sobre los ingresos brutos del período
- BENEFICIO POSTERGACIÓN DE IVA: ${companyProfile.beneficioPostergacionIva ? 'SÍ (Aplica Art. 64 LIR por Régimen Pro Pyme)' : 'NO (Régimen General)'}
- CLIENTE ANCLA / ERP AUTÓNOMO: ${companyProfile.esClienteAncla ? 'SÍ (Posee módulos descentralizados con supervisión pericial)' : 'NO (Contabilidad directa)'}
- BANCO PRINCIPAL DE OPERACIONES: ${companyProfile.cuentaBancariaPrimaria?.banco} - Cta. Cte. N° ${companyProfile.cuentaBancariaPrimaria?.numeroCuenta}

PLAN DE CUENTAS IFRS VINCULADO A LA EMPRESA (EXTRACTO PRIORITARIO):
${planCuentasFormatted}

****************************************************************************************************
CAPA 3: DIRECTIVAS E INSTRUCCIONES ESPECIALES DEL ESTUDIO CONTABLE / CLIENTE
****************************************************************************************************
Las siguientes reglas son MANDATORIAS y fueron configuradas expresamente por el Contador Auditor del Estudio para esta empresa en el módulo ${moduloCodigo}:

DIRECTIVAS AD-HOC DE LA EMPRESA:
"""
${agentConfig.instruccionesEspeciales}
"""

PARÁMETROS OPERATIVOS PARAMETRIZADOS:
${paramsFormatted}

REGLA DE OBLIGATORIEDAD:
Cualquier propuesta del agente que ignore o contradiga estas instrucciones especiales será rechazada de inmediato por el Orquestador Senior.

****************************************************************************************************
CAPA 4: BASE DE CONOCIMIENTO DE APRENDIZAJES (MEMORY STORE & FEW-SHOT PREVENTIVO)
****************************************************************************************************
ATENCIÓN AGENTE: En períodos y ejercicios anteriores se registraron los siguientes errores de auditoría y correcciones manuales.
DEBES APLICAR ESTAS LECCIONES APRENDIDAS COMO REGLAS NEGATIVAS Y POSITIVAS PARA NO REPETIR ERRORES:

${learningsFormatted}

****************************************************************************************************
PROTOCOLO FINAL DE SALIDA Y VALIDACIÓN POR EL ORQUESTADOR SENIOR
****************************************************************************************************
1. Toda propuesta generada por este agente será sometida a la revisión previa y firma digital del Orquestador Supervisor.
2. Si el Orquestador detecta descuadres, errores de imputación contrarios a la Capa 3 o reincidencia en errores de la Capa 4, la propuesta será RECHAZADA y se registrará un incidente de auditoría en agent_audit_logs.
3. Responde únicamente en formato estructurado JSON con la información contable, técnica y legal requerida para su procesamiento transaccional.
====================================================================================================
`.trim();

  return {
    systemInstruction,
    companyProfile,
    learningsApplied: learnings,
  };
}
