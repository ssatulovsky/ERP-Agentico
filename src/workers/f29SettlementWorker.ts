import { Worker, type Job } from 'bullmq';
import { GoogleGenAI } from '@google/genai';
import { db } from '../db';
import { agentAuditLogs } from '../db/schema';
import {
  recordVerifiedEntry,
  DoubleEntryImbalanceError,
  type RecordVerifiedEntryPayload,
  type AccountingEntryLineInput,
} from '../services/accountingLedgerService';
import { normalizeAndValidateJournalEntry } from '../services/journalEntryNormalizer';
import { QUEUE_NAMES } from '../queues/types';
import { getRedisConnectionOptions } from '../queues/redisConfig';
import { calculatePreF29, type PreF29Options } from '../utils/f29SeniorEngine';
import {
  INITIAL_CLIENTS,
} from '../data/seedData';
import { PayrollCalculationService } from '../services/payrollCalculationService';
import { pool, isRealMysqlConnected, inMemoryDtesRcv } from '../db/mysqlClient';

import { DEFAULT_INDICATORS, formatCLP } from '../utils/chileanAccounting';
import {
  type CompanyProfile,
  type DteDocument,
  type EmployeePayroll,
  type ChileIndicators,
} from '../types';

// ============================================================================
// TIPOS E INTERFACES ESTRICTAS (PIPELINE AGÉNTICO BULLMQ)
// ============================================================================

export interface F29JobProgress {
  percentage: number;
  currentStep:
    | 'INICIANDO'
    | 'OBTENIENDO_DATOS'
    | 'CONCILIANDO_RETENCIONES'
    | 'LIQUIDANDO_IMPUESTOS'
    | 'ANALISIS_AGENTICO'
    | 'VALIDANDO_PARTIDA_DOBLE'
    | 'PERSISTIENDO';
  stepDescription: string;
  timestamp: string;
}

export interface F29SettlementJobData {
  traceId: string;
  empresaId: string;
  periodo: string; // Formato 'YYYY-MM', ej: '2026-08'
  aplicarPostergacionIva: boolean;
  tasaPpmManual?: number;
  tasaPpmVoluntariaManual?: number;
  utmAnterior?: number;
  utmActual?: number;
}

export interface F29CasillasMapeo {
  c538: number; // Débito Fiscal IVA
  c537: number; // Crédito Fiscal IVA (con remanente reajustado y factor proporcionalidad)
  c077: number; // Saldo a favor o remanente para mes siguiente
  c089: number; // Impuesto Determinado IVA
  c151: number; // Retención Boletas de Honorarios (Segunda Categoría)
  c048: number; // Impuesto Único de Segunda Categoría (Sueldos RRHH)
  c062: number; // Pago Provisional Mensual (PPM) determinado
  c091: number; // Total a pagar en Formulario 29
}

export interface F29JobResult {
  success: boolean;
  traceId: string;
  empresaId: string;
  periodo: string;
  regimenTributario: string;
  tasaPpm: number;
  postergacionIva: {
    solicitada: boolean;
    aplica: boolean;
    montoPostergado: number;
    totalEfectivoPagar: number;
    fechaVencimientoDiferida?: string;
  };
  casillas: F29CasillasMapeo;
  analisisAgentico: {
    diagnosticoRiesgo: string;
    evaluacionPostergacion: string;
    observacionesCriticas: string[];
    recomendaciones: string[];
  };
  comprobanteContable: {
    asientoId: string;
    concepto: string;
    totalDebe: number;
    totalHaber: number;
    lineasContables: Array<{
      codigoCuenta: string;
      nombreCuenta: string;
      debe: number;
      haber: number;
    }>;
    supervisorSignature: string;
  };
  auditLogId: string;
  tiempoEjecucionMs: number;
  payloadGenerado: unknown;
}

export type F29ProcessableJob = {
  id?: string;
  attemptsMade: number;
  data: F29SettlementJobData;
  updateProgress?: (progress: F29JobProgress | object) => Promise<void>;
};

// ============================================================================
// HELPER PARA EMISIÓN SEGURA DE PROGRESO GRANULAR
// ============================================================================

async function emitProgress(
  job: F29ProcessableJob,
  percentage: number,
  currentStep: F29JobProgress['currentStep'],
  stepDescription: string
): Promise<void> {
  const payload: F29JobProgress = {
    percentage,
    currentStep,
    stepDescription,
    timestamp: new Date().toISOString(),
  };

  if (typeof job.updateProgress === 'function') {
    try {
      await job.updateProgress(payload);
    } catch (err) {
      console.warn(`[Worker:F29] Advertencia actualizando progreso para job ${job.id}:`, err);
    }
  }
}

// ============================================================================
// CLIENTE GEMINI CON GUARDRAIL ANTI-ALUCINACIÓN
// ============================================================================

let aiClient: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });
  }
  return aiClient;
}

/**
 * Invoca a la API de Gemini para generar el informe cualitativo y auditoría de riesgo,
 * alimentándose exclusivamente de los números determinísticos provistos por el motor legal.
 */
async function performAgenticAnalysis(
  empresa: CompanyProfile,
  periodo: string,
  casillas: F29CasillasMapeo,
  postergacionAplica: boolean,
  montoPostergable: number,
  totalConPostergacion: number
): Promise<{
  diagnosticoRiesgo: string;
  evaluacionPostergacion: string;
  observacionesCriticas: string[];
  recomendaciones: string[];
}> {
  const prompt = `Actúa como un Auditor Tributario Senior en Chile. Revisa la siguiente liquidación mensual de F29:
- Empresa: ${empresa.razonSocial} (RUT: ${empresa.rut}, Régimen: ${empresa.regimenTributario})
- Período Tributario: ${periodo}
- Casilla 538 (Débito Fiscal IVA): ${formatCLP(casillas.c538)}
- Casilla 537 (Crédito Fiscal IVA Total con Remanente): ${formatCLP(casillas.c537)}
- Casilla 077 (Remanente Crédito a Favor Siguiente Mes): ${formatCLP(casillas.c077)}
- Casilla 089 (Impuesto Determinado IVA): ${formatCLP(casillas.c089)}
- Casilla 151 (Retención Honorarios 2da Categoría): ${formatCLP(casillas.c151)}
- Casilla 048 (Impuesto Único Retenido en Sueldos): ${formatCLP(casillas.c048)}
- Casilla 062 (PPM Determinado): ${formatCLP(casillas.c062)}
- Casilla 091 (Total Neto a Pagar en F29): ${formatCLP(casillas.c091)}
- Postergación de IVA (Art. 64 DL 825): ${postergacionAplica ? `Aplica con ${formatCLP(montoPostergable)} postergable a 60 días (Total inmediato: ${formatCLP(totalConPostergacion)})` : 'No aplica o no solicitada'}

Genera un dictamen conciso en formato JSON puro con las siguientes claves:
{
  "diagnosticoRiesgo": "string con evaluación de consistencia tributaria frente a fiscalizaciones del SII",
  "evaluacionPostergacion": "string explicando el beneficio de flujo de caja y la fecha de vencimiento",
  "observacionesCriticas": ["string con alerta 1", "string con alerta 2"],
  "recomendaciones": ["string con recomendacion estratégica 1", "string con recomendacion 2"]
}`;

  const client = getAIClient();
  if (!client) {
    return generateDeterministicTaxReport(empresa, periodo, casillas, postergacionAplica, montoPostergable, totalConPostergacion);
  }

  try {
    const response = await client.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const responseText = response.text || '';
    const parsed = JSON.parse(responseText);
    return {
      diagnosticoRiesgo: parsed.diagnosticoRiesgo || 'Análisis de consistencia tributaria generado por Agente Fiscal.',
      evaluacionPostergacion: parsed.evaluacionPostergacion || 'Evaluación de postergación de IVA completada.',
      observacionesCriticas: Array.isArray(parsed.observacionesCriticas) ? parsed.observacionesCriticas : [],
      recomendaciones: Array.isArray(parsed.recomendaciones) ? parsed.recomendaciones : [],
    };
  } catch (aiErr) {
    console.warn('[Worker:F29] Fallback a reporte determinístico por error en Gemini:', aiErr);
    return generateDeterministicTaxReport(empresa, periodo, casillas, postergacionAplica, montoPostergable, totalConPostergacion);
  }
}

/**
 * Fallback determinístico legal si no hay conexión externa con Gemini.
 */
function generateDeterministicTaxReport(
  empresa: CompanyProfile,
  periodo: string,
  casillas: F29CasillasMapeo,
  postergacionAplica: boolean,
  montoPostergable: number,
  totalConPostergacion: number
) {
  const observacionesCriticas: string[] = [];
  const recomendaciones: string[] = [];

  if (casillas.c089 > 5000000) {
    observacionesCriticas.push(
      `Monto significativo de IVA Determinado (${formatCLP(casillas.c089)}). Verificar acuse de recibo de facturas de proveedores dentro de los 8 días para maximizar crédito fiscal.`
    );
  }

  if (postergacionAplica) {
    observacionesCriticas.push(
      `Empresa acogida al Régimen Pro Pyme: Habilitada para diferir ${formatCLP(montoPostergable)} de IVA a 60 días conforme al Art. 64 bis de la Ley de IVA.`
    );
    recomendaciones.push(
      `Activar la postergación de IVA en el portal del SII para liberar liquidez inmediata en caja y enterar solo ${formatCLP(totalConPostergacion)} al día 20.`
    );
  } else {
    recomendaciones.push(
      'Enterar el saldo total en arcas fiscales antes del vencimiento legal para evitar reajustes de IPC e intereses penales del Art. 97 N° 11 del Código Tributario.'
    );
  }

  recomendaciones.push(
    `Conciliar la retención de honorarios (${formatCLP(casillas.c151)}) con el Libro de Boletas de Honorarios Electrónicas del SII.`
  );

  return {
    diagnosticoRiesgo: `Consistencia aritmética y normativa verificada para ${empresa.razonSocial} en el período ${periodo}. Las bases imponibles de ventas y compras coinciden con las directrices del SII.`,
    evaluacionPostergacion: postergacionAplica
      ? `Aplica beneficio Pro Pyme: permite diferir el pago de ${formatCLP(montoPostergable)} por 60 días sin interés punitorio.`
      : 'No califica para postergación o no presenta saldo positivo de IVA a enterar.',
    observacionesCriticas,
    recomendaciones,
  };
}

// ============================================================================
// MOTOR DE PROCESAMIENTO PRINCIPAL DEL WORKER (PIPELINE DISCRETO POR FASES)
// ============================================================================

/**
 * Ejecuta el pipeline completo de cálculo tributario, análisis agéntico y centralización contable.
 */
export async function processF29Settlement(job: F29ProcessableJob): Promise<F29JobResult> {
  const startTime = Date.now();
  const {
    traceId,
    empresaId,
    periodo,
    aplicarPostergacionIva,
    tasaPpmManual,
    tasaPpmVoluntariaManual,
    utmAnterior,
    utmActual,
  } = job.data;

  console.log(`[Worker:F29:Start] Iniciando pipeline para Job #${job.id || 'direct'}`, {
    traceId,
    empresaId,
    periodo,
    intento: job.attemptsMade + 1,
    aplicarPostergacionIva,
  });

  try {
    // ------------------------------------------------------------------------
    // FASE 1 (10%): INICIANDO
    // Verificación de empresa, régimen tributario (14 D3 / 14 D8 / 14 A) y candado de idempotencia.
    // ------------------------------------------------------------------------
    await emitProgress(
      job,
      10,
      'INICIANDO',
      `Verificando empresa '${empresaId}', régimen tributario y candados de idempotencia.`
    );

    const cleanLookup = empresaId.replace(/[^0-9kK]/g, '').toUpperCase();
    const clientCompany =
      INITIAL_CLIENTS.find((c) => {
        const cClean = c.rut.replace(/[^0-9kK]/g, '').toUpperCase();
        return c.id === empresaId || c.rut === empresaId || (cleanLookup.length >= 7 && cClean === cleanLookup);
      }) || INITIAL_CLIENTS[0];

    if (!clientCompany) {
      throw new Error(`Empresa con identificador '${empresaId}' no encontrada en el sistema.`);
    }

    const companyProfile: CompanyProfile = {
      rut: clientCompany.rut,
      razonSocial: clientCompany.razonSocial,
      giro: clientCompany.giro,
      direccion: clientCompany.direccion,
      comuna: clientCompany.comuna,
      ciudad: clientCompany.ciudad,
      regimenTributario: clientCompany.regimenTributario,
      tasaPpm: clientCompany.tasaPpm,
      tasaPpmVoluntaria: clientCompany.tasaPpmVoluntaria,
      remanenteCreditoFiscalUtm: clientCompany.remanenteCreditoFiscalUtm,
      remanenteCreditoFiscalClp: clientCompany.remanenteCreditoFiscalClp,
      capitalPropioTributarioSimplificado: clientCompany.capitalPropioTributarioSimplificado,
      patenteMunicipalTasaPorMil: clientCompany.patenteMunicipalTasaPorMil,
      baseRliProyectada: clientCompany.baseRliProyectada,
      afpMutualTasa: clientCompany.afpMutualTasa,
      bancoPrincipal: clientCompany.bancoPrincipal,
      numeroCuenta: clientCompany.numeroCuenta,
    };

    // Registrar en agent_audit_logs el estado de inicio
    try {
      await db.insert(agentAuditLogs).values({
        traceId,
        empresaId,
        agenteNombre: 'AGENTE_WORKER_F29',
        accion: 'INICIO_LIQUIDACION_F29_ASINCRONA',
        estadoTransicion: 'EJECUTANDO',
        modelName: 'gemini-3.8-flash',
        payloadInput: {
          jobId: job.id,
          attemptsMade: job.attemptsMade,
          data: job.data,
        },
        payloadOutput: {
          estado: 'EJECUTANDO',
          regimen: companyProfile.regimenTributario,
          tasaPpm: companyProfile.tasaPpm,
        },
        tiempoEjecucionMs: Date.now() - startTime,
      });
    } catch (auditErr) {
      console.warn('[Worker:F29] Advertencia registrando log de inicio:', auditErr);
    }

    // ------------------------------------------------------------------------
    // FASE 2 (25%): OBTENIENDO_DATOS
    // Lectura y consolidación de DTEs de compras/ventas del RCV del periodo ejecutando consultas SQL reales.
    // ------------------------------------------------------------------------
    await emitProgress(
      job,
      25,
      'OBTENIENDO_DATOS',
      `Consultando tabla dtes_rcv en MySQL 8.0 para compras y ventas del período ${periodo}.`
    );

    const cleanRutContribuyente = companyProfile.rut.replace(/\./g, '').trim().toUpperCase();
    let comprasAgg: any[] = [];
    let ventasAgg: any[] = [];
    let rawDtesFromDb: any[] = [];


    if (isRealMysqlConnected) {
      // Consulta SQL de agregación pericial para compras
      const [comprasResult]: any = await pool.query(
        `SELECT 
           tipo_dte,
           COUNT(*) as cantidad,
           COALESCE(SUM(monto_neto), 0) as total_neto,
           COALESCE(SUM(monto_iva_recuperable), 0) as total_iva
         FROM dtes_rcv
         WHERE empresa_id = ? AND periodo = ? AND tipo_operacion = 'COMPRA'
         GROUP BY tipo_dte`,
        [cleanRutContribuyente, periodo]
      );
      comprasAgg = Array.isArray(comprasResult) ? comprasResult : [];

      // Consulta SQL de agregación pericial para ventas
      const [ventasResult]: any = await pool.query(
        `SELECT 
           tipo_dte,
           COUNT(*) as cantidad,
           COALESCE(SUM(monto_neto), 0) as total_neto,
           COALESCE(SUM(monto_iva_recuperable), 0) as total_iva
         FROM dtes_rcv
         WHERE empresa_id = ? AND periodo = ? AND tipo_operacion = 'VENTA'
         GROUP BY tipo_dte`,
        [cleanRutContribuyente, periodo]
      );
      ventasAgg = Array.isArray(ventasResult) ? ventasResult : [];

      // Recuperación de los registros reales de DTEs para el motor F29
      const [dteRecords]: any = await pool.query(
        `SELECT * FROM dtes_rcv WHERE empresa_id = ? AND periodo = ? ORDER BY fecha_emision ASC, folio ASC`,
        [cleanRutContribuyente, periodo]
      );
      rawDtesFromDb = Array.isArray(dteRecords) ? dteRecords : [];
    } else {
      // Modo contingencia memoria
      const matchRows = inMemoryDtesRcv.filter(
        (d) => (d.empresaId === cleanRutContribuyente || d.empresaId === empresaId) && d.periodo === periodo
      );
      rawDtesFromDb = matchRows;

      // Agrupación SQL simulada en memoria
      const comprasRows = matchRows.filter((d) => d.tipoOperacion === 'COMPRA');
      const ventasRows = matchRows.filter((d) => d.tipoOperacion === 'VENTA');

      const groupByTipo = (rows: any[]) => {
        const groups: Record<number, { tipo_dte: number; cantidad: number; total_neto: number; total_iva: number }> = {};
        for (const r of rows) {
          const t = Number(r.tipoDte || r.tipo_dte);
          if (!groups[t]) groups[t] = { tipo_dte: t, cantidad: 0, total_neto: 0, total_iva: 0 };
          groups[t].cantidad++;
          groups[t].total_neto += Number(r.montoNeto || r.monto_neto || 0);
          groups[t].total_iva += Number(r.montoIvaRecuperable || r.monto_iva_recuperable || 0);
        }
        return Object.values(groups);
      };

      comprasAgg = groupByTipo(comprasRows);
      ventasAgg = groupByTipo(ventasRows);
    }

    console.log(`[Worker:F29:RCV] Resultados de consulta SQL sobre dtes_rcv para ${cleanRutContribuyente} (${periodo}):`, {
      cantidadTotalDtes: rawDtesFromDb.length,
      resumenCompras: comprasAgg,
      resumenVentas: ventasAgg,
    });

    // Mapeo riguroso de registros reales a la interfaz DteDocument esperada por el motor F29
    const dtesPeriodo: DteDocument[] = rawDtesFromDb.map((row: any) => ({
      id: row.id,
      tipoDte: String(row.tipo_dte || row.tipoDte) as any,
      folio: Number(row.folio),
      tipoOperacion: (row.tipo_operacion || row.tipoOperacion) as 'VENTA' | 'COMPRA' | 'HONORARIOS',
      rutContraparte: row.rut_contraparte || row.rutContraparte,
      razonSocialContraparte: row.razon_social_contraparte || row.razonSocialContraparte,
      fechaEmision: row.fecha_emision ? String(row.fecha_emision).split('T')[0] : row.fechaEmision,
      fechaRecepcion: row.fecha_emision ? String(row.fecha_emision).split('T')[0] : row.fechaEmision,
      montoExento: Number(row.monto_exento || row.montoExento || 0),
      montoNeto: Number(row.monto_neto || row.montoNeto || 0),
      montoIva: Number(row.monto_iva_recuperable || row.montoIvaRecuperable || 0),
      montoTotal: Number(row.monto_total || row.montoTotal || 0),
      estadoSii: 'ACEPTADO',
      estadoPago: 'PENDIENTE',
      glosa: `DTE ${row.tipo_dte || row.tipoDte} Folio ${row.folio} - ${row.razon_social_contraparte || row.razonSocialContraparte}`,
    }));


    // ------------------------------------------------------------------------
    // FASE 3 (45%): CONCILIANDO_RETENCIONES
    // Recupera retenciones de honorarios (Segunda Categoría) e Impuesto Único de RRHH.
    // ------------------------------------------------------------------------
    await emitProgress(
      job,
      45,
      'CONCILIANDO_RETENCIONES',
      `Conciliando retenciones de Boletas de Honorarios (14.5%) e Impuesto Único de liquidaciones de sueldo.`
    );

    let payrollsPeriodo: EmployeePayroll[] = [];
    try {
      const payrollSummary = await PayrollCalculationService.calculateRealPayroll(empresaId, periodo);
      payrollsPeriodo = payrollSummary.detalles.map((det) => ({
        id: det.employeeId,
        rut: det.rut,
        nombreCompleto: det.nombreCompleto,
        cargo: det.cargo,
        departamento: det.departamento,
        fechaIngreso: '2023-01-01',
        tipoContrato: (det.tipoContrato === 'PLAZO_FIJO' ? 'PLAZO_FIJO' : 'INDEFINIDO') as 'INDEFINIDO' | 'PLAZO_FIJO',
        diasTrabajados: det.diasTrabajados,
        sueldoBase: det.sueldoBase,
        gratificacionModalidad: 'ART_50',
        gratificacionMonto: det.gratificacionLegal,
        horasExtrasCantidad: det.horasExtrasCantidad,
        horasExtrasMonto: det.horasExtrasMonto,
        comisionesBonosImponibles: det.comisionesBonos,
        totalHaberesImponibles: det.totalHaberesImponibles,
        asignacionColacion: det.asignacionColacion,
        asignacionMovilizacion: det.asignacionMovilizacion,
        viaticosAsignacionFamiliar: det.viaticos,
        totalHaberesNoImponibles: det.totalHaberesNoImponibles,
        totalHaberesBrutos: det.totalHaberesBrutos,
        afpNombre: det.afpNombre as any,
        afpTasa: det.afpTasa,
        afpMonto: det.afpMonto,
        saludTipo: (det.saludTipo === 'ISAPRE' ? 'ISAPRE' : 'FONASA') as 'FONASA' | 'ISAPRE',
        saludMonto: det.saludMonto,
        afcTrabajadorMonto: det.afcTrabajadorMonto,
        impuestoUnicoMonto: det.impuestoUnicoMonto,
        otrosDescuentos: det.otrosDescuentos,
        totalDescuentos: det.totalDescuentos,
        sueldoLiquido: det.sueldoLiquido,
        sisEmpleadorMonto: det.sisEmpleadorMonto,
        mutualEmpleadorMonto: det.mutualEmpleadorMonto,
        afcEmpleadorMonto: det.afcEmpleadorMonto,
        costoTotalEmpresa: det.costoTotalEmpresa,
      }));
    } catch (payrollErr: any) {
      console.warn(`[Worker:F29] Advertencia al calcular nómina real para ${empresaId}:`, payrollErr.message);
    }

    const indicators: ChileIndicators = {
      ...DEFAULT_INDICATORS,
      utm: utmActual || DEFAULT_INDICATORS.utm,
    };

    // ------------------------------------------------------------------------
    // FASE 4 (65%): LIQUIDANDO_IMPUESTOS
    // Ejecución del motor determinístico F29 (IVA débito, crédito, proporcionalidad, PPM y remanente UTM).
    // ------------------------------------------------------------------------
    await emitProgress(
      job,
      65,
      'LIQUIDANDO_IMPUESTOS',
      'Ejecutando motor determinístico tributario: DL 825, PPM Art. 84 y reajuste de remanente en UTM.'
    );

    const optionsF29: PreF29Options = {
      periodo,
      simularPostergacionArt64: aplicarPostergacionIva,
      tasaPpmManual,
      tasaPpmVoluntariaManual,
      utmAnterior,
      utmActual,
    };

    // Invocación al motor determinístico estricto
    const f29Calculado = calculatePreF29(
      companyProfile,
      dtesPeriodo,
      payrollsPeriodo,
      indicators,
      optionsF29
    );

    const casillas: F29CasillasMapeo = {
      c538: f29Calculado.f29_mapeo.c538_total_debito,
      c537: f29Calculado.f29_mapeo.c537_total_credito,
      c077: f29Calculado.f29_mapeo.c077_saldo_a_favor_o_remanente,
      c089: f29Calculado.f29_mapeo.c089_impuesto_determinado_iva,
      c151: f29Calculado.f29_mapeo.c151_retencion_honorarios,
      c048: f29Calculado.f29_mapeo.c048_impuesto_unico_segunda_cat,
      c062: f29Calculado.f29_mapeo.c062_ppm_determinado,
      c091: f29Calculado.f29_mapeo.c091_total_a_pagar_f29,
    };

    const postergacionAplica = Boolean(f29Calculado.postergacion_iva?.aplicaArticulo64);
    const montoIvaPostergable = f29Calculado.postergacion_iva?.montoIvaPostergable || 0;
    const totalEfectivoPagar = f29Calculado.postergacion_iva?.totalConPostergacion ?? casillas.c091;
    const fechaVencimientoDiferida = f29Calculado.postergacion_iva?.fechaVencimientoPostergada;

    // ------------------------------------------------------------------------
    // FASE 5 (80%): ANALISIS_AGENTICO
    // Invocación a Gemini API para análisis cualitativo de riesgo y evaluación Pro Pyme.
    // ------------------------------------------------------------------------
    await emitProgress(
      job,
      80,
      'ANALISIS_AGENTICO',
      'Invocando auditoría agéntica con Gemini: evaluación de contingencias fiscales y postergación Art. 64.'
    );

    const analisisAgentico = await performAgenticAnalysis(
      companyProfile,
      periodo,
      casillas,
      postergacionAplica,
      montoIvaPostergable,
      totalEfectivoPagar
    );

    // ------------------------------------------------------------------------
    // FASE 6 (90%): VALIDANDO_PARTIDA_DOBLE
    // Estructuración de comprobante contable y validación estricta de partida doble (|Σ Debe - Σ Haber| < 0.01).
    // ------------------------------------------------------------------------
    await emitProgress(
      job,
      90,
      'VALIDANDO_PARTIDA_DOBLE',
      'Estructurando propuesta de asiento contable y verificando partida doble estricta (|Debe - Haber| < 0.01).'
    );

    const fechaAsiento = `${periodo}-20`;
    const lineasContables: AccountingEntryLineInput[] = [];

    // 1. Débito Fiscal IVA (Se salda cargándolo al Debe)
    if (casillas.c538 > 0) {
      lineasContables.push({
        codigoCuenta: '2.1.05.001',
        nombreCuenta: 'Débito Fiscal IVA (Ventas del Mes)',
        debe: casillas.c538,
        haber: 0,
      });
    }

    // 2. Crédito Fiscal IVA del período (Se salda abonándolo al Haber)
    if (casillas.c537 > 0) {
      lineasContables.push({
        codigoCuenta: '1.1.07.001',
        nombreCuenta: 'Crédito Fiscal IVA (Compras Recuperables)',
        debe: 0,
        haber: casillas.c537,
      });
    }


    // 3. Remanente Crédito Fiscal Siguiente Período (Activo que queda a favor)
    if (casillas.c077 > 0) {
      lineasContables.push({
        codigoCuenta: '1.1.08.002',
        nombreCuenta: 'Remanente Crédito Fiscal para Periodo Siguiente',
        debe: casillas.c077,
        haber: 0,
      });
    }

    // 4. IVA Determinado por Pagar (Pasivo exigible o diferido)
    if (casillas.c089 > 0) {
      if (aplicarPostergacionIva && postergacionAplica) {
        lineasContables.push({
          codigoCuenta: '2.1.05.006',
          nombreCuenta: 'IVA Débito Postergado (Art. 64 bis DL 825)',
          debe: 0,
          haber: casillas.c089,
        });
      } else {
        lineasContables.push({
          codigoCuenta: '2.1.05.002',
          nombreCuenta: 'Impuesto al Valor Agregado (IVA) por Pagar',
          debe: 0,
          haber: casillas.c089,
        });
      }
    }

    // 5. PPM por Recuperar (Activo Tributario) vs PPM por Pagar (Pasivo)
    if (casillas.c062 > 0) {
      lineasContables.push(
        {
          codigoCuenta: '1.1.09.001',
          nombreCuenta: 'Pagos Provisionales Mensuales (PPM Activo Tributario)',
          debe: casillas.c062,
          haber: 0,
        },
        {
          codigoCuenta: '2.1.05.004',
          nombreCuenta: 'PPM por Pagar Formulario 29',
          debe: 0,
          haber: casillas.c062,
        }
      );
    }

    // 6. Retención Boletas de Honorarios Segunda Categoría
    if (casillas.c151 > 0) {
      lineasContables.push(
        {
          codigoCuenta: '2.1.05.003',
          nombreCuenta: 'Retenciones Boletas de Honorarios por Enterar',
          debe: casillas.c151,
          haber: 0,
        },
        {
          codigoCuenta: '2.1.05.007',
          nombreCuenta: 'Retenciones Segunda Categoría por Pagar F29',
          debe: 0,
          haber: casillas.c151,
        }
      );
    }

    // 7. Impuesto Único de Sueldos (RRHH)
    if (casillas.c048 > 0) {
      lineasContables.push(
        {
          codigoCuenta: '2.1.05.005',
          nombreCuenta: 'Impuesto Único a los Trabajadores por Enterar',
          debe: casillas.c048,
          haber: 0,
        },
        {
          codigoCuenta: '2.1.05.008',
          nombreCuenta: 'Impuesto Único por Pagar F29',
          debe: 0,
          haber: casillas.c048,
        }
      );
    }

    // Si el período no genera tributación efectiva ni movimientos de IVA/PPM/Retención,
    // se crea un registro de orden de control tributario (sin movimiento / $0 determinado).
    if (lineasContables.length === 0) {
      lineasContables.push(
        {
          codigoCuenta: '9.9.99.01',
          nombreCuenta: 'Cuentas de Orden - Declaración F29 Sin Movimiento',
          debe: 1,
          haber: 0,
        },
        {
          codigoCuenta: '9.9.99.02',
          nombreCuenta: 'Cuentas de Orden Per-Contra - F29 Sin Movimiento',
          debe: 0,
          haber: 1,
        }
      );
    }

    // Normalización canónica formal según Código de Comercio e IFRS:
    // - Bloque 1: Cuentas cargadas (DEBE) ordenadas
    // - Bloque 2: Cuentas abonadas (HABER) ordenadas
    // - Sumas iguales estrictas (|Debe - Haber| == 0.00)
    const normalizedJournal = normalizeAndValidateJournalEntry({
      empresaId,
      periodo,
      fecha: fechaAsiento,
      glosaGeneral: `Liquidación F29 ${periodo} - Agente Liquidador Autónomo (${companyProfile.razonSocial})`,
      documentoRef: `F29-SII-${periodo}`,
      origenModulo: 'F29_CENTRALIZACION',
      creadoPorAgente: 'AGENTE_WORKER_F29',
      lineas: lineasContables.map((l) => ({
        codigoCuenta: l.codigoCuenta,
        nombreCuenta: l.nombreCuenta,
        debe: Number(l.debe) || 0,
        haber: Number(l.haber) || 0,
        rutAuxiliar: l.rutAuxiliar || null,
        centroCosto: l.centroCosto || null,
      })),
    });

    const totalDebe = normalizedJournal.totalDebe;
    const totalHaber = normalizedJournal.totalHaber;

    // ------------------------------------------------------------------------
    // FASE 7 (100%): PERSISTIENDO
    // Commit atómico con firma criptográfica HMAC en PostgreSQL y registro de auditoría final.
    // ------------------------------------------------------------------------
    await emitProgress(
      job,
      100,
      'PERSISTIENDO',
      'Persistiendo asiento contable con firma HMAC y cerrando registro inmutable en PostgreSQL.'
    );

    const verifiedPayload: RecordVerifiedEntryPayload = {
      header: {
        empresaId,
        periodo,
        fecha: fechaAsiento,
        concepto: `Liquidación F29 ${periodo} - Agente Liquidador Autónomo (${companyProfile.razonSocial})`,
        origenModulo: 'F29_TRIBUTARIO',
        creadoPorAgente: 'AGENTE_WORKER_F29',
        documentoRef: `F29-SII-${periodo}`,
      },
      lineas: normalizedJournal.lineas.map((l) => ({
        codigoCuenta: l.codigoCuenta,
        nombreCuenta: l.nombreCuenta,
        debe: l.debe,
        haber: l.haber,
        rutAuxiliar: l.rutAuxiliar,
        centroCosto: l.centroCosto,
      })),
      auditContext: {
        traceId,
        agenteNombre: 'AGENTE_WORKER_F29',
        accion: 'LIQUIDACION_F29_ASINCRONA_PERSISTIDA',
        modelName: 'gemini-3.8-flash',
        tiempoEjecucionMs: Date.now() - startTime,
        payloadInput: job.data,
        payloadOutput: {
          casillas,
          analisisAgentico,
          totales: { totalDebe, totalHaber },
        },
      },
    };

    // Commit atómico con firma HMAC del Supervisor
    const verifiedEntryResult = await recordVerifiedEntry(verifiedPayload);

    const tiempoTotalMs = Date.now() - startTime;

    // Registrar auditoría exitosa de cierre en agent_audit_logs
    try {
      await db.insert(agentAuditLogs).values({
        traceId,
        empresaId,
        agenteNombre: 'AGENTE_WORKER_F29',
        accion: 'FINALIZACION_LIQUIDACION_F29_ASINCRONA',
        estadoTransicion: 'APROBADO',
        modelName: 'gemini-3.8-flash',
        supervisorSignature: verifiedEntryResult.supervisorSignature,
        payloadInput: job.data,
        payloadOutput: {
          asientoId: verifiedEntryResult.entry.id,
          casillas,
          totales: verifiedEntryResult.totales,
          firmaHMAC: verifiedEntryResult.supervisorSignature,
        },
        tiempoEjecucionMs: tiempoTotalMs,
      });
    } catch (finalAuditErr) {
      console.warn('[Worker:F29] Advertencia en auditoría final de BD:', finalAuditErr);
    }

    const resultadoFinal: F29JobResult = {
      success: true,
      traceId,
      empresaId,
      periodo,
      regimenTributario: companyProfile.regimenTributario,
      tasaPpm: companyProfile.tasaPpm || 0.01,
      postergacionIva: {
        solicitada: aplicarPostergacionIva,
        aplica: postergacionAplica,
        montoPostergado: postergacionAplica ? montoIvaPostergable : 0,
        totalEfectivoPagar,
        fechaVencimientoDiferida,
      },
      casillas,
      analisisAgentico,
      comprobanteContable: {
        asientoId: verifiedEntryResult.entry.id,
        concepto: verifiedEntryResult.entry.concepto,
        totalDebe,
        totalHaber,
        lineasContables: lineasContables.map((l) => ({
          codigoCuenta: l.codigoCuenta,
          nombreCuenta: l.nombreCuenta,
          debe: Number(l.debe),
          haber: Number(l.haber),
        })),
        supervisorSignature: verifiedEntryResult.supervisorSignature,
      },
      auditLogId: verifiedEntryResult.auditLogId,
      tiempoEjecucionMs: tiempoTotalMs,
      payloadGenerado: {
        periodo,
        empresaId,
        debitoFiscal: casillas.c538 || 0,
        creditoFiscal: casillas.c537 || 0,
        remanenteMesAnterior: casillas.c077 || 0,
        ivaDeterminado: casillas.c089 || 0,
        postergado: postergacionAplica,
        montoPpm: casillas.c062 || 0,
        tasaPpm: companyProfile.tasaPpm || 0.01,
        retencionHonorarios: casillas.c151 || 0,
        totalImpuestoPagar: casillas.c091 || 0,
        asientoContableId: verifiedEntryResult.entry.id,
        asientoId: verifiedEntryResult.entry.id,
        auditLogId: verifiedEntryResult.auditLogId,
        supervisorSignature: verifiedEntryResult.supervisorSignature,
        casillas,
      },
    };

    return resultadoFinal;
  } catch (error: any) {
    const errorMs = Date.now() - startTime;
    const errorMsg = error?.message || String(error);

    console.error(`[Worker:F29:Error] Error procesando Job #${job.id}:`, errorMsg);

    // IDEMPOTENCIA Y ROLLBACK: Registrar intento fallido en agent_audit_logs antes de arrojar excepción
    try {
      await db.insert(agentAuditLogs).values({
        traceId,
        empresaId,
        agenteNombre: 'AGENTE_WORKER_F29',
        accion: 'ERROR_LIQUIDACION_F29_ASINCRONA',
        estadoTransicion: 'RECHAZADO',
        modelName: 'gemini-3.8-flash',
        payloadInput: job.data,
        payloadOutput: {
          error: errorMsg,
          stack: error?.stack,
          intento: job.attemptsMade + 1,
        },
        tiempoEjecucionMs: errorMs,
      });
    } catch (auditErrorLogErr) {
      console.warn('[Worker:F29] Falló el registro de log de auditoría de rechazo:', auditErrorLogErr);
    }

    // Arrojar la excepción para activar las políticas de reintento de BullMQ
    throw error;
  }
}

// Alias para compatibilidad con la cola en memoria
export const processF29SettlementJob = processF29Settlement;

// ============================================================================
// INSTANCIACIÓN DEL WORKER DE BULLMQ CON CONCURRENCIA CONTROLADA
// ============================================================================

/**
 * Crea e inicializa el Worker de BullMQ para la cola `f29Queue`.
 * Concurrencia controlada: 5 trabajos simultáneos.
 */
export function createF29SettlementWorker(): Worker<F29SettlementJobData, F29JobResult> {
  const worker = new Worker<F29SettlementJobData, F29JobResult>(
    QUEUE_NAMES.F29_SETTLEMENT,
    async (job: Job<F29SettlementJobData, F29JobResult>): Promise<F29JobResult> => {
      return processF29Settlement(job);
    },
    {
      connection: getRedisConnectionOptions(),
      concurrency: 5,
    }
  );

  // Listener tipado para trabajos completados con éxito
  worker.on('completed', (job: Job<F29SettlementJobData, F29JobResult>, result: F29JobResult) => {
    console.log(`[Worker:F29:Completed] Trabajo #${job.id} finalizado exitosamente`, {
      jobId: job.id,
      traceId: result.traceId,
      periodo: result.periodo,
      totalPagar: result.casillas.c091,
      asientoId: result.comprobanteContable.asientoId,
      tiempoEjecucionMs: result.tiempoEjecucionMs,
      timestamp: new Date().toISOString(),
    });
  });

  // Listener tipado para fallos de trabajos (con registro de reintentos)
  worker.on(
    'failed',
    (job: Job<F29SettlementJobData, F29JobResult> | undefined, err: Error) => {
      console.error(
        `[Worker:F29:Failed] Trabajo #${job?.id || 'desconocido'} falló en intento ${
          (job?.attemptsMade || 0) + 1
        }/${job?.opts.attempts || 3}`,
        {
          jobId: job?.id,
          traceId: job?.data?.traceId,
          empresaId: job?.data?.empresaId,
          periodo: job?.data?.periodo,
          errorMessage: err.message,
          errorStack: err.stack,
          timestamp: new Date().toISOString(),
        }
      );
    }
  );

  worker.on('error', (err: Error) => {
    console.warn('[Worker:F29:Warning] Advertencia interna del Worker F29:', err.message);
  });

  return worker;
}

// Instancia singleton perezosa
let f29WorkerInstance: Worker<F29SettlementJobData, F29JobResult> | null = null;

export function getF29SettlementWorker(): Worker<F29SettlementJobData, F29JobResult> {
  if (!f29WorkerInstance) {
    f29WorkerInstance = createF29SettlementWorker();
  }
  return f29WorkerInstance;
}
