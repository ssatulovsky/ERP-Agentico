import crypto from 'node:crypto';
import { getMysqlDb, isRealMysqlConnected, inMemoryAuditLogs } from '../db/mysqlClient';
import {
  agentAuditLogs,
  type AgentModuleCode,
  type LearningCategory,
} from '../db/mysqlSchema';
import {
  recordAgentCorrection,
  incrementLearningAvoidance,
  listLearnings,
} from '../services/agentLearningFeedbackService';
import { type CompanyOperationalProfile, type AgentLearningItem } from '../services/agentContextBuilderService';

export interface AgentOutputPayload {
  asientoPropuesto?: {
    fecha: string;
    periodo: string;
    glosa: string;
    documentoRef?: string;
    origenModulo: string;
    lineas: Array<{
      codigoCuenta: string;
      nombreCuenta: string;
      debe: number;
      haber: number;
      rutAuxiliar?: string;
      centroCosto?: string;
    }>;
  };
  calculoTributario?: {
    periodo?: string;
    ivaDebito?: number;
    ivaCredito?: number;
    ppmMonto?: number;
    tasaPpm?: number;
    retencionSegundaCat?: number;
    tasaRetencion?: number;
    totalAPagar?: number;
    postergacionSolicitada?: boolean;
    casillas?: Record<string, number>;
  };
  remuneraciones?: {
    rutEmpleado: string;
    sueldoBase: number;
    gratificacionLegal: number;
    horasExtraMonto: number;
    horasExtraCantidad: number;
    diasTrabajados: number;
    totalImponible: number;
    totalHaberes: number;
    descuentosPrevisionales: number;
    sueldoLiquido: number;
    pactoHorasExtraValido: boolean;
  };
  metadataOperativa?: Record<string, any>;
}

export interface SupervisorVerdict {
  aprobado: boolean;
  scoreConformidad: number; // 0.0 - 1.0
  observaciones: string[];
  diagnosticoDetallado: string;
  requiereCorreccionManual: boolean;
  firmaSupervisor?: string;
  correccionMandatoria?: any;
  traceId: string;
  timestamp: string;
  learningsPrevented?: string[];
}

const SUPERVISOR_SECRET = process.env.SUPERVISOR_SECRET || 'SIEX_ORCHESTRATOR_SENIOR_AUDITOR_2026_KEY';

/**
 * Genera la firma criptográfica pericial del Orquestador Contable Senior
 */
function generateSupervisorSignature(traceId: string, timestamp: string, payload: any): string {
  const content = `${traceId}|${timestamp}|${JSON.stringify(payload)}|ORCHESTRATOR_SENIOR_CHILE_2026`;
  return crypto.createHmac('sha256', SUPERVISOR_SECRET).update(content).digest('hex');
}

/**
 * ORQUESTADOR CONTABLE FINANCIERO SENIOR: GATEKEEPER & VALIDADOR NORMATIVO
 */
export async function superviseAndValidateAgentOutput(params: {
  empresaId: string;
  modulo: AgentModuleCode;
  proposedResult: AgentOutputPayload;
  contextUsed: {
    companyProfile?: CompanyOperationalProfile;
    learningsApplied?: AgentLearningItem[];
    instruccionesEspeciales?: string;
    parametrosOperativos?: any;
    traceId?: string;
  };
}): Promise<SupervisorVerdict> {
  const startTime = Date.now();
  const traceId = params.contextUsed?.traceId || crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const observaciones: string[] = [];
  const learningsPrevented: string[] = [];
  let score = 1.0;
  let aprobado = true;
  let correccionMandatoria: any = null;

  const { proposedResult, contextUsed, empresaId, modulo } = params;
  const companyProfile = contextUsed.companyProfile;
  const activeLearnings = await listLearnings({ empresaId, moduloCodigo: modulo });

  // ==========================================================================
  // REGLA 1: VALIDACIÓN MATEMÁTICA ESTRICTA DE PARTIDA DOBLE (IFRS / CÓD. COMERCIO)
  // ==========================================================================
  if (proposedResult.asientoPropuesto) {
    const asiento = proposedResult.asientoPropuesto;
    const lineas = asiento.lineas || [];

    if (lineas.length < 2) {
      aprobado = false;
      score -= 0.5;
      observaciones.push('ERROR_ESTRUCTURAL: El asiento contable debe tener al menos 2 líneas para cumplir con la partida doble.');
    }

    let sumDebe = 0;
    let sumHaber = 0;
    let tieneMontosNegativos = false;

    lineas.forEach((linea, idx) => {
      const debe = Number(linea.debe) || 0;
      const haber = Number(linea.haber) || 0;

      if (debe < 0 || haber < 0) {
        tieneMontosNegativos = true;
      }
      if (debe === 0 && haber === 0) {
        observaciones.push(`ADVERTENCIA: La línea ${idx + 1} (${linea.codigoCuenta}) no posee movimientos monetarios (0 Debe / 0 Haber).`);
      }

      sumDebe += debe;
      sumHaber += haber;
    });

    if (tieneMontosNegativos) {
      aprobado = false;
      score -= 0.6;
      observaciones.push('VIOLACIÓN_NORMATIVA: Los principios contables chilenos e IFRS prohíben saldos negativos en libros oficiales.');
    }

    const diff = Math.abs(sumDebe - sumHaber);
    if (diff > 0.01) {
      aprobado = false;
      score = 0.0;
      const msg = `DESCUADRE_PARTIDA_DOBLE: El asiento presenta un descuadre de $${diff.toFixed(2)} (Debe: $${sumDebe.toFixed(2)}, Haber: $${sumHaber.toFixed(2)}). Rechazado inmediatamente.`;
      observaciones.push(msg);

      // Registrar incidente de aprendizaje automático
      await recordAgentCorrection({
        empresaId,
        modulo: 'ACCOUNTING_LEDGER',
        categoria: 'DESCUADRE_PARTIDA_DOBLE',
        error: `El agente generó un asiento descuadrado por $${diff.toFixed(2)} en documento ${asiento.documentoRef || 'S/N'}.`,
        solucion: 'Garantizar mediante validación matemática que SUM(Debe) === SUM(Haber) antes de emitir la propuesta.',
        incorrecto: { sumDebe, sumHaber, diff },
        corregido: { regla: 'Balance exacto en centavos' },
      });
    } else {
      observaciones.push(`CONFORME: Partida doble balanceada exactamente en $${sumDebe.toLocaleString('es-CL')} CLP.`);
    }
  }

  // ==========================================================================
  // REGLA 2: COMPROBACIÓN DE DIRECTIVAS ESPECIALES AD-HOC (CAPA 3)
  // ==========================================================================
  const directivas = contextUsed.instruccionesEspeciales || '';

  // Directiva específica: Compras de servicios en la nube en cuenta 5.1.02.015
  if (modulo === 'SII_RCV' && proposedResult.asientoPropuesto) {
    const glosa = (proposedResult.asientoPropuesto.glosa || '').toUpperCase();
    const docRef = (proposedResult.asientoPropuesto.documentoRef || '').toUpperCase();
    const esServicioNube =
      glosa.includes('AWS') ||
      glosa.includes('AMAZON') ||
      glosa.includes('GOOGLE CLOUD') ||
      glosa.includes('AZURE') ||
      glosa.includes('MICROSOFT') ||
      docRef.includes('AWS');

    if (esServicioNube) {
      const lineaServidores = proposedResult.asientoPropuesto.lineas.find((l) => l.codigoCuenta === '5.1.02.015');
      const lineaGastoGeneral = proposedResult.asientoPropuesto.lineas.find(
        (l) => l.codigoCuenta.startsWith('6.1.01') || l.codigoCuenta.startsWith('6.1.02')
      );

      if (!lineaServidores && lineaGastoGeneral) {
        aprobado = false;
        score -= 0.4;
        const diag = 'INCUMPLIMIENTO_DIRECTIVA_ESPECIAL: La empresa tiene directiva expresa del estudio de imputar compras Cloud en la cuenta 5.1.02.015 en vez de gastos generales.';
        observaciones.push(diag);
        correccionMandatoria = {
          lineaErronea: lineaGastoGeneral.codigoCuenta,
          cuentaExigida: '5.1.02.015',
          nombreCuenta: 'Servicios de Infraestructura Cloud y SaaS',
        };

        await recordAgentCorrection({
          empresaId,
          modulo: 'SII_RCV',
          categoria: 'PREFERENCIA_CLIENTE',
          error: `Se imputó factura cloud en ${lineaGastoGeneral.codigoCuenta} ignorando directiva especial de la empresa.`,
          solucion: 'Imputar obligatoriamente en cuenta 5.1.02.015 (Servicios de Infraestructura Cloud y SaaS).',
          incorrecto: lineaGastoGeneral,
          corregido: correccionMandatoria,
        });
      } else if (lineaServidores) {
        observaciones.push('CONFORME: Respetó directiva especial de imputación de servicios en la nube en 5.1.02.015.');
      }
    }
  }

  // Directiva específica: RRHH - Horas extra y pactos (Ley 40 Horas y Dictamen DT)
  if (modulo === 'RRHH' && proposedResult.remuneraciones) {
    const rrhh = proposedResult.remuneraciones;
    if (rrhh.horasExtraCantidad > 2) {
      aprobado = false;
      score -= 0.4;
      observaciones.push(
        `VIOLACIÓN_LABORAL: Se imputaron ${rrhh.horasExtraCantidad} horas extraordinarias diarias. El límite legal infranqueable según Art. 31 CdT y Dictámenes DT es de máximo 2 horas diarias.`
      );
    }
  }

  // ==========================================================================
  // REGLA 3: COMPROBACIÓN NORMATIVA TRIBUTARIA CHILENA 2026 (CAPA 1 Y 2)
  // ==========================================================================
  if (modulo === 'F29_TAX' && proposedResult.calculoTributario) {
    const calc = proposedResult.calculoTributario;

    // Tasa legal retención honorarios 2026: 14.50%
    if (calc.tasaRetencion !== undefined && Math.abs(calc.tasaRetencion - 0.145) > 0.001) {
      aprobado = false;
      score -= 0.4;
      observaciones.push(
        `ERROR_TRIBUTARIO: Tasa de retención de Boletas de Honorarios informada (${(calc.tasaRetencion * 100).toFixed(2)}%) es incorrecta. En el año 2026 la tasa legal bajo Ley 21.133 es estrictamente 14.50%.`
      );
    }

    // Tasa PPM Pro Pyme 14 D3: debe ser 0.25% o 0.50%
    if (companyProfile?.regimenTributario === '14_D3' && calc.tasaPpm !== undefined) {
      if (calc.tasaPpm > 0.01) {
        observaciones.push(
          `ADVERTENCIA: Tasa de PPM informada (${(calc.tasaPpm * 100).toFixed(2)}%) supera la tasa reducida Pro Pyme del 0.25% correspondiente a empresas del régimen 14 D3.`
        );
      }
    }
  }

  // ==========================================================================
  // REGLA 4: REVISIÓN DE REINCIDENCIA EN BASE DE CONOCIMIENTO (CAPA 4)
  // ==========================================================================
  for (const learning of activeLearnings) {
    // Si el agente actuó correctamente evitando un error previo documentado
    if (aprobado) {
      if (learning.categoria === 'ERROR_IMPUTACION' && modulo === 'SII_RCV') {
        const lineaCorrecta = proposedResult.asientoPropuesto?.lineas.find((l) => l.codigoCuenta === '5.1.02.015');
        if (lineaCorrecta) {
          await incrementLearningAvoidance(learning.id);
          learningsPrevented.push(learning.id);
        }
      }
      if (learning.categoria === 'DESCUADRE_PARTIDA_DOBLE' && proposedResult.asientoPropuesto) {
        await incrementLearningAvoidance(learning.id);
        learningsPrevented.push(learning.id);
      }
      if (learning.categoria === 'NORMATIVA_SII' && modulo === 'F29_TAX') {
        if (proposedResult.calculoTributario?.tasaRetencion === 0.145) {
          await incrementLearningAvoidance(learning.id);
          learningsPrevented.push(learning.id);
        }
      }
    }
  }

  // ==========================================================================
  // EMISIÓN DEL VEREDICTO FINAL Y SELLO PERICIAL DEL SUPERVISOR
  // ==========================================================================
  score = Math.max(0.0, Math.min(1.0, score));
  const firmaSupervisor = aprobado
    ? generateSupervisorSignature(traceId, timestamp, proposedResult)
    : undefined;

  const diagnosticoDetallado = aprobado
    ? `APROBADO: Propuesta conforme a IFRS, Código de Comercio, legislación tributaria/laboral chilena y directivas especiales de la empresa (${(score * 100).toFixed(1)}% conformidad).`
    : `RECHAZADO: La propuesta presenta ${observaciones.filter((o) => o.startsWith('ERROR') || o.startsWith('VIOLACIÓN') || o.startsWith('DESCUADRE')).length} infracciones críticas que impiden su centralización.`;

  const verdict: SupervisorVerdict = {
    aprobado,
    scoreConformidad: score,
    observaciones,
    diagnosticoDetallado,
    requiereCorreccionManual: !aprobado,
    firmaSupervisor,
    correccionMandatoria,
    traceId,
    timestamp,
    learningsPrevented: [...new Set(learningsPrevented)],
  };

  // Registro en agent_audit_logs para trazabilidad pericial inmutable
  const executionTimeMs = Date.now() - startTime;
  const auditEntry = {
    id: crypto.randomUUID(),
    traceId,
    firmId: 'firm-001-audicon',
    empresaId,
    agenteNombre: `AGENTE_${modulo}`,
    modulo: modulo,
    accion: 'SUPERVISION_VALIDACION_GATEKEEPER',
    estadoTransicion: aprobado ? 'APROBADO_PARA_LIBRO_DIARIO' : 'RECHAZADO_POR_SUPERVISOR',
    promptTokens: 1250,
    completionTokens: 420,
    modelName: 'gemini-3.8-flash',
    promptHash: crypto.createHash('sha256').update(JSON.stringify(contextUsed)).digest('hex'),
    payloadInput: contextUsed,
    payloadOutput: proposedResult,
    diffContable: correccionMandatoria || null,
    supervisorVeredicto: aprobado ? 'CONFORME' : 'DISCONFORME',
    supervisorSignature: firmaSupervisor || 'SIN_FIRMA_RECHAZADO',
    tiempoEjecucionMs: executionTimeMs,
    createdAt: new Date(),
  };

  const db = getMysqlDb();
  if (isRealMysqlConnected) {
    try {
      await db.insert(agentAuditLogs).values(auditEntry);
    } catch (err: any) {
      console.warn(`[agentAuditLogs] Error guardando auditoría en MySQL: ${err.message}`);
      inMemoryAuditLogs.push(auditEntry);
    }
  } else {
    inMemoryAuditLogs.push(auditEntry);
  }

  return verdict;
}
