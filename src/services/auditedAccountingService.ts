import dotenv from 'dotenv';
dotenv.config({ override: true });
import crypto from 'node:crypto';
import {
  accountingEntries,
  accountingEntryLines,
  agentAuditLogs,
  type NewAccountingEntry,
  type NewAccountingEntryLine,
  type NewAgentAuditLog,
} from '../db/mysqlSchema';
import { getMysqlDb, isRealMysqlConnected, inMemoryEntries, inMemoryLines, inMemoryAuditLogs } from '../db/mysqlClient';

// ============================================================================
// CONTEXTO DE AUDITORÍA Y PAYLOADS TIPADOS
// ============================================================================
export interface AuditContext {
  traceId: string;
  empresaId: string;
  agenteNombre: string;
  accionSolicitada: string;
  payloadInput?: Record<string, unknown>;
  promptTokens?: number;
  completionTokens?: number;
  modelName?: string;
  promptHash?: string;
}

export interface AccountingEntryLineInput {
  codigoCuenta: string;
  nombreCuenta: string;
  debe: number | string;
  haber: number | string;
  rutAuxiliar?: string | null;
  centroCosto?: string | null;
}

export interface NewAccountingEntryInput {
  empresaId: string;
  periodo: string; // YYYY-MM
  fecha: string;   // YYYY-MM-DD
  concepto: string;
  documentoRef?: string | null;
  origenModulo: string;
  creadoPorAgente: string;
  lineas: AccountingEntryLineInput[];
}

export interface AccountingEntryResult {
  success: boolean;
  entryId: string;
  supervisorSignature: string;
  totalDebe: number;
  totalHaber: number;
  tiempoEjecucionMs: number;
  lineasCount: number;
  auditLogId: string;
}

// ============================================================================
// EXCEPCIONES TIPADAS DE NEGOCIO Y AUDITORÍA
// ============================================================================
export class AccountingServiceError extends Error {
  public readonly details?: Record<string, unknown>;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'AccountingServiceError';
    this.details = details;
  }
}

export class DoubleEntryImbalanceError extends AccountingServiceError {
  public readonly totalDebe: number;
  public readonly totalHaber: number;
  public readonly descuadre: number;

  constructor(
    totalDebe: number,
    totalHaber: number,
    descuadre: number,
    details?: Record<string, unknown>
  ) {
    super(
      `Descuadre contable no permitido: Total Debe ($${totalDebe.toFixed(2)}) != Total Haber ($${totalHaber.toFixed(2)}). Diferencia: $${descuadre.toFixed(2)} CLP.`,
      details
    );
    this.name = 'DoubleEntryImbalanceError';
    this.totalDebe = totalDebe;
    this.totalHaber = totalHaber;
    this.descuadre = descuadre;
  }
}

// ============================================================================
// GESTIÓN ESTRICTA DE SECRETOS CRIPTOGRÁFICOS
// ============================================================================
function getSupervisorHmacSecret(): string {
  const secret = process.env.SUPERVISOR_HMAC_SECRET;
  if (!secret || secret.trim().length < 32) {
    throw new Error(
      'FATAL SECURITY VIOLATION: process.env.SUPERVISOR_HMAC_SECRET no está configurada o tiene menos de 32 caracteres (256 bits). El sistema contable no puede operar sin una clave de sellado robusta.'
    );
  }
  return secret.trim();
}

/**
 * Convierte montos a centavos enteros para evitar errores IEEE-754 de coma flotante.
 */
function toCents(val: number | string | null | undefined): number {
  if (val === null || val === undefined || val === '') return 0;
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(',', '.'));
  if (isNaN(num) || !isFinite(num)) {
    throw new AccountingServiceError(`Valor monetario inválido: ${val}`);
  }
  return Math.round(num * 100);
}

// ============================================================================
// SERVICIO DE NEGOCIO INTERCEPTADO Y AUDITADO
// ============================================================================
export class AuditedAccountingService {
  /**
   * Registra un asiento contable validado por agentes de IA bajo estricto control transaccional ACID.
   *
   * Flujo auditado:
   * 1. Medición de rendimiento pericial (`performance.now()`).
   * 2. Validación de partida doble en centavos. Si falla, aborta e inserta log con veredicto 'RECHAZADO_DESCUADRE'.
   * 3. Sellado criptográfico HMAC-SHA256 inmutable.
   * 4. Transacción atómica en MySQL (Cabecera + Líneas + Log de Auditoría).
   */
  public static async recordAgentEntry(
    auditCtx: AuditContext,
    entryData: NewAccountingEntryInput
  ): Promise<AccountingEntryResult> {
    const startTime = performance.now();
    const db = getMysqlDb();
    const hmacSecret = getSupervisorHmacSecret();

    // Validar líneas mínimas
    if (!entryData.lineas || !Array.isArray(entryData.lineas) || entryData.lineas.length < 2) {
      throw new AccountingServiceError('Un asiento contable debe tener al menos dos líneas de partida doble.');
    }

    // 1. CÁLCULO DETERMINÍSTICO DE DÉBITOS Y CRÉDITOS EN CENTAVOS
    let totalDebeCents = 0;
    let totalHaberCents = 0;

    const validatedLines = entryData.lineas.map((line, idx) => {
      const debeCents = toCents(line.debe);
      const haberCents = toCents(line.haber);
      totalDebeCents += debeCents;
      totalHaberCents += haberCents;

      return {
        id: crypto.randomUUID(),
        codigoCuenta: (line.codigoCuenta || '').trim(),
        nombreCuenta: (line.nombreCuenta || '').trim(),
        debeCents,
        haberCents,
        debeFormatted: (debeCents / 100).toFixed(2),
        haberFormatted: (haberCents / 100).toFixed(2),
        rutAuxiliar: line.rutAuxiliar ? line.rutAuxiliar.trim() : null,
        centroCosto: line.centroCosto ? line.centroCosto.trim() : null,
      };
    });

    const centsDiff = Math.abs(totalDebeCents - totalHaberCents);
    const totalDebe = totalDebeCents / 100;
    const totalHaber = totalHaberCents / 100;
    const descuadre = centsDiff / 100;

    // 2. VERIFICACIÓN ESTRICTA DE PARTIDA DOBLE (CERO TOLERANCIA A DESCUADRES)
    if (centsDiff > 0) {
      const execTime = Math.round(performance.now() - startTime);
      const auditLogId = crypto.randomUUID();

      // Registrar intento fallido de forma asíncrona para auditoría forense
      const failedAuditPayload: NewAgentAuditLog = {
        id: auditLogId,
        traceId: auditCtx.traceId,
        empresaId: auditCtx.empresaId,
        agenteNombre: auditCtx.agenteNombre,
        accion: auditCtx.accionSolicitada,
        estadoTransicion: 'RECHAZADO_DESCUADRE',
        promptTokens: auditCtx.promptTokens ?? null,
        completionTokens: auditCtx.completionTokens ?? null,
        modelName: auditCtx.modelName ?? 'gemini-model',
        promptHash: auditCtx.promptHash ?? null,
        payloadInput: auditCtx.payloadInput || (entryData as any),
        payloadOutput: { error: 'Descuadre de partida doble detectado' } as any,
        diffContable: {
          totalDebe,
          totalHaber,
          descuadre,
          centsDiff,
        } as any,
        supervisorVeredicto: 'RECHAZADO_DESCUADRE',
        supervisorSignature: null,
        tiempoEjecucionMs: execTime,
      };

      try {
        if (isRealMysqlConnected) {
          await db.insert(agentAuditLogs).values(failedAuditPayload);
        } else {
          inMemoryAuditLogs.push({ ...failedAuditPayload, createdAt: new Date() });
        }
      } catch (logErr: any) {
        console.error('[AuditedAccountingService] Error al asentar log de rechazo:', logErr.message);
      }

      throw new DoubleEntryImbalanceError(totalDebe, totalHaber, descuadre, {
        traceId: auditCtx.traceId,
        empresaId: auditCtx.empresaId,
        agente: auditCtx.agenteNombre,
      });
    }

    // 3. GENERACIÓN DE LA FIRMA HMAC-SHA256 DEL SUPERVISOR
    const totalDebeStr = totalDebe.toFixed(2);
    const totalHaberStr = totalHaber.toFixed(2);

    const canonicalLinesForHash = validatedLines.map((l) => ({
      codigo: l.codigoCuenta,
      nombre: l.nombreCuenta,
      debe: l.debeFormatted,
      haber: l.haberFormatted,
      rut: l.rutAuxiliar,
      cc: l.centroCosto,
    }));

    const lineasHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(canonicalLinesForHash), 'utf8')
      .digest('hex');

    const canonicalSignaturePayload = [
      entryData.empresaId.trim(),
      entryData.periodo.trim(),
      entryData.fecha.trim(),
      totalDebeStr,
      totalHaberStr,
      lineasHash,
    ].join(':');

    const supervisorSignature = crypto
      .createHmac('sha256', hmacSecret)
      .update(canonicalSignaturePayload, 'utf8')
      .digest('hex');

    const entryId = crypto.randomUUID();
    const auditLogId = crypto.randomUUID();
    const execTime = Math.round(performance.now() - startTime);

    // 4. TRANSACCIÓN ATÓMICA EN MYSQL (ACID COMPLIANT)
    await db.transaction(async (tx: any) => {
      // 4.1 Insertar Cabecera en accountingEntries
      const headerPayload: NewAccountingEntry = {
        id: entryId,
        empresaId: entryData.empresaId.trim(),
        periodo: entryData.periodo.trim(),
        fecha: entryData.fecha.trim(),
        concepto: entryData.concepto.trim(),
        documentoRef: entryData.documentoRef ? entryData.documentoRef.trim() : null,
        totalDebe: totalDebeStr,
        totalHaber: totalHaberStr,
        origenModulo: entryData.origenModulo.trim(),
        creadoPorAgente: entryData.creadoPorAgente.trim(),
        autorizadoPorSupervisor: true,
        supervisorSignature,
      };

      if (isRealMysqlConnected) {
        await tx.insert(accountingEntries).values(headerPayload);
      } else {
        inMemoryEntries.push({ ...headerPayload, createdAt: new Date() });
      }

      // 4.2 Insertar Líneas de Detalle en accountingEntryLines
      const linesPayload: NewAccountingEntryLine[] = validatedLines.map((l) => ({
        id: l.id,
        entryId,
        codigoCuenta: l.codigoCuenta,
        nombreCuenta: l.nombreCuenta,
        debe: l.debeFormatted,
        haber: l.haberFormatted,
        rutAuxiliar: l.rutAuxiliar,
        centroCosto: l.centroCosto,
      }));

      if (isRealMysqlConnected) {
        await tx.insert(accountingEntryLines).values(linesPayload);
      } else {
        linesPayload.forEach((lp) => inMemoryLines.push({ ...lp }));
      }

      // 4.3 Insertar Registro Pericial en agentAuditLogs
      const successAuditPayload: NewAgentAuditLog = {
        id: auditLogId,
        traceId: auditCtx.traceId,
        empresaId: auditCtx.empresaId,
        agenteNombre: auditCtx.agenteNombre,
        accion: auditCtx.accionSolicitada,
        estadoTransicion: 'VALIDADO_CORRECTO',
        promptTokens: auditCtx.promptTokens ?? null,
        completionTokens: auditCtx.completionTokens ?? null,
        modelName: auditCtx.modelName ?? 'gemini-orchestrator',
        promptHash: auditCtx.promptHash ?? null,
        payloadInput: auditCtx.payloadInput || (entryData as any),
        payloadOutput: { entryId, supervisorSignature } as any,
        diffContable: {
          totalDebe,
          totalHaber,
          descuadre: 0,
        } as any,
        supervisorVeredicto: 'VALIDADO_CORRECTO',
        supervisorSignature,
        tiempoEjecucionMs: execTime,
      };

      if (isRealMysqlConnected) {
        await tx.insert(agentAuditLogs).values(successAuditPayload);
      } else {
        inMemoryAuditLogs.push({ ...successAuditPayload, createdAt: new Date() });
      }
    });

    return {
      success: true,
      entryId,
      supervisorSignature,
      totalDebe,
      totalHaber,
      tiempoEjecucionMs: execTime,
      lineasCount: validatedLines.length,
      auditLogId,
    };
  }
}
