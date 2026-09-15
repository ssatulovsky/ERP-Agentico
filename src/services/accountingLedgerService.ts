import crypto from 'node:crypto';
import {
  accountingEntries,
  accountingEntryLines,
  agentAuditLogs,
  type NewAccountingEntry,
  type NewAccountingEntryLine,
  type NewAgentAuditLog,
  type AccountingEntry,
  type AccountingEntryLine,
  type AgentAuditLog,
} from '@/db/schema';
import { db as defaultDb } from '@/db';
import type { CompanyProfile } from '../types';
import { validateEntryFiscalPeriod } from '../utils/accountingOrchestratorEngine';

// ============================================================================
// CUSTOM ERROR CLASSES (MANEJO EXHAUSTIVO DE ERRORES TIPADOS)
// ============================================================================

export abstract class AccountingLedgerError extends Error {
  abstract readonly code: string;
  readonly timestamp: string;

  constructor(message: string, public readonly details?: Record<string, any>) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date().toISOString();
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Error emitido cuando un comprobante intenta registrarse en un período cerrado
 * o fuera de los límites del ejercicio fiscal de la empresa (Art. 16 Código Tributario).
 */
export class LockedFiscalPeriodError extends AccountingLedgerError {
  readonly code = 'LOCKED_FISCAL_PERIOD';

  constructor(message: string, details?: Record<string, any>) {
    super(message, details);
  }
}

/**
 * Error emitido cuando el asiento contable no cumple la partida doble (|Σ Debe - Σ Haber| >= 0.01).
 * Detiene inmediatamente la ejecución antes de interactuar con la base de datos.
 */
export class DoubleEntryImbalanceError extends AccountingLedgerError {
  readonly code = 'DOUBLE_ENTRY_IMBALANCE';

  constructor(
    public readonly totalDebe: number,
    public readonly totalHaber: number,
    public readonly descuadre: number,
    public readonly cantidadLineas: number,
    details?: Record<string, any>
  ) {
    super(
      `Descuadre contable detectado: Total Debe ($${totalDebe.toLocaleString('es-CL', { minimumFractionDigits: 2 })}) ` +
      `no coincide con Total Haber ($${totalHaber.toLocaleString('es-CL', { minimumFractionDigits: 2 })}). ` +
      `Diferencia matemática: $${descuadre.toFixed(4)} CLP en ${cantidadLineas} líneas evaluadas.`,
      { totalDebe, totalHaber, descuadre, cantidadLineas, ...details }
    );
  }
}

/**
 * Error emitido cuando el payload contiene valores nulos, formatos inválidos o carece de líneas mínimas.
 */
export class InvalidAccountingPayloadError extends AccountingLedgerError {
  readonly code = 'INVALID_ACCOUNTING_PAYLOAD';

  constructor(message: string, details?: Record<string, any>) {
    super(message, details);
  }
}

/**
 * Error emitido cuando falla la generación de la firma criptográfica HMAC-SHA256.
 */
export class SupervisorSignatureError extends AccountingLedgerError {
  readonly code = 'SUPERVISOR_SIGNATURE_ERROR';

  constructor(message: string, details?: Record<string, any>) {
    super(message, details);
  }
}

/**
 * Error emitido ante fallos de persistencia transaccional en PostgreSQL.
 */
export class AccountingTransactionError extends AccountingLedgerError {
  readonly code = 'ACCOUNTING_TRANSACTION_FAILED';

  constructor(message: string, public readonly originalError?: unknown, details?: Record<string, any>) {
    super(message, details);
  }
}

// ============================================================================
// CONTRATOS DE ENTRADA Y SALIDA (TYPED INTERFACES)
// ============================================================================

export interface AccountingEntryHeaderInput {
  empresaId: string;
  periodo: string; // 'YYYY-MM'
  fecha: string; // 'YYYY-MM-DD'
  concepto: string;
  documentoRef?: string | null;
  origenModulo: string; // 'RCV_COMPRA' | 'RCV_VENTA' | 'REMUNERACIONES' | 'F29_TRIBUTARIO' | 'TESORERIA' | 'MANUAL'
  creadoPorAgente: string;
}

export interface AccountingEntryLineInput {
  codigoCuenta: string;
  nombreCuenta: string;
  debe: number | string;
  haber: number | string;
  rutAuxiliar?: string | null;
  centroCosto?: string | null;
}

export interface AgentAuditContextInput {
  traceId: string;
  agenteNombre: string;
  accion: string;
  promptTokens?: number | null;
  completionTokens?: number | null;
  modelName?: string | null;
  promptHash?: string | null;
  payloadInput: Record<string, any>;
  payloadOutput: Record<string, any>;
  tiempoEjecucionMs?: number;
}

export interface RecordVerifiedEntryPayload {
  header: AccountingEntryHeaderInput;
  lineas: AccountingEntryLineInput[];
  auditContext: AgentAuditContextInput;
  companyConfig?: CompanyProfile;
}

export interface RecordVerifiedEntryResult {
  entry: AccountingEntry;
  lines: AccountingEntryLine[];
  auditLogId: string;
  supervisorSignature: string;
  totales: {
    totalDebe: number;
    totalHaber: number;
    diferencia: number;
    partidaDobleValida: boolean;
  };
}

// ============================================================================
// UTILIDADES NUMÉRICAS Y CRIPTOGRÁFICAS
// ============================================================================

/**
 * Convierte strings numéricos y números a centavos enteros para evitar errores
 * de coma flotante IEEE-754 en cálculos financieros.
 */
function parseToCents(value: number | string | null | undefined, fieldName: string): number {
  if (value === null || value === undefined || value === '') {
    return 0;
  }

  let num: number;
  if (typeof value === 'number') {
    num = value;
  } else {
    // Normalizar separadores decimales (punto o coma)
    const normalized = String(value).trim().replace(/\s/g, '').replace(',', '.');
    num = parseFloat(normalized);
  }

  if (isNaN(num) || !isFinite(num)) {
    throw new InvalidAccountingPayloadError(
      `El valor numérico en el campo '${fieldName}' no es válido: "${value}"`,
      { field: fieldName, rawValue: value }
    );
  }

  if (num < 0) {
    throw new InvalidAccountingPayloadError(
      `Los montos de partida contable (Debe/Haber) deben ser positivos. Valor recibido en '${fieldName}': ${num}`,
      { field: fieldName, rawValue: value }
    );
  }

  return Math.round(num * 100);
}

/**
 * Genera la firma digital HMAC-SHA256 que sella inmutablemente los datos contables
 * autorizados por el Agente Supervisor General.
 */
function generateSupervisorSignature(
  header: AccountingEntryHeaderInput,
  totalDebeFormatted: string,
  totalHaberFormatted: string,
  lines: AccountingEntryLineInput[],
  secretKey: string
): string {
  try {
    const canonicalLines = lines.map((l) => ({
      codigo: l.codigoCuenta.trim(),
      nombre: l.nombreCuenta.trim(),
      debe: typeof l.debe === 'number' ? l.debe.toFixed(2) : String(l.debe).trim(),
      haber: typeof l.haber === 'number' ? l.haber.toFixed(2) : String(l.haber).trim(),
      rut: (l.rutAuxiliar || '').trim(),
      cc: (l.centroCosto || '').trim(),
    }));

    const canonicalPayload = [
      header.empresaId.trim(),
      header.periodo.trim(),
      header.fecha.trim(),
      header.concepto.trim(),
      header.origenModulo.trim(),
      header.creadoPorAgente.trim(),
      totalDebeFormatted,
      totalHaberFormatted,
      JSON.stringify(canonicalLines),
    ].join('|#|');

    return crypto
      .createHmac('sha256', secretKey)
      .update(canonicalPayload, 'utf8')
      .digest('hex');
  } catch (error) {
    throw new SupervisorSignatureError(
      'Fallo crítico al generar la firma HMAC-SHA256 del comprobante contable.',
      { originalError: error instanceof Error ? error.message : String(error) }
    );
  }
}

// ============================================================================
// SERVICIO PRINCIPAL: recordVerifiedEntry
// ============================================================================

/**
 * Registra un comprobante contable verificado en la base de datos de forma transaccional.
 *
 * Pasos de ejecución:
 * 1. Validación exhaustiva de parámetros y campos obligatorios.
 * 2. Suma determinística en centavos de Débitos y Créditos.
 * 3. Verificación estricta de partida doble (|Σ Debe - Σ Haber| < 0.01).
 *    Si no cuadra, interrumpe sin tocar la base de datos.
 * 4. Generación de la firma criptográfica HMAC-SHA256 del Supervisor.
 * 5. Ejecución en transacción atómica (`db.transaction`):
 *    - Inserción de cabecera (`accountingEntries`).
 *    - Inserción en lote de líneas vinculadas (`accountingEntryLines`).
 *    - Registro de auditoría inmutable del agente (`agentAuditLogs`).
 * 6. Retorno de las entidades creadas y firma de validación.
 *
 * @param payload Datos del asiento, detalle de líneas y contexto de auditoría del agente.
 * @param dbInstance Instancia opcional de Drizzle ORM (permite inyección de dependencias en tests).
 */
export async function recordVerifiedEntry(
  payload: RecordVerifiedEntryPayload,
  dbInstance: any = defaultDb
): Promise<RecordVerifiedEntryResult> {
  const startTime = Date.now();

  // 1. VALIDACIÓN PRELIMINAR DE PARÁMETROS
  if (!payload || typeof payload !== 'object') {
    throw new InvalidAccountingPayloadError('El payload provisto a recordVerifiedEntry es nulo o inválido.');
  }

  const { header, lineas, auditContext } = payload;

  if (!header) {
    throw new InvalidAccountingPayloadError("Falta la sección 'header' con los metadatos del comprobante.");
  }
  if (!Array.isArray(lineas) || lineas.length < 2) {
    throw new InvalidAccountingPayloadError(
      `Un comprobante contable debe contener al menos 2 líneas para cumplir con la partida doble. Líneas recibidas: ${lineas?.length ?? 0}.`,
      { lineasCount: lineas?.length ?? 0 }
    );
  }
  if (!auditContext || !auditContext.traceId || !auditContext.agenteNombre) {
    throw new InvalidAccountingPayloadError(
      "La sección 'auditContext' es obligatoria y debe incluir al menos 'traceId' y 'agenteNombre'.",
      { auditContext }
    );
  }

  // Validación de campos clave del encabezado
  if (!header.empresaId || !header.empresaId.trim()) {
    throw new InvalidAccountingPayloadError("El campo 'empresaId' en el encabezado es obligatorio.");
  }
  if (!header.periodo || !/^\d{4}-(0[1-9]|1[0-2])$/.test(header.periodo.trim())) {
    throw new InvalidAccountingPayloadError(
      `El campo 'periodo' debe tener el formato 'YYYY-MM' (ej: '2026-09'). Recibido: "${header.periodo}"`,
      { periodo: header.periodo }
    );
  }
  if (!header.fecha || !/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(header.fecha.trim())) {
    throw new InvalidAccountingPayloadError(
      `El campo 'fecha' debe tener el formato 'YYYY-MM-DD' (ej: '2026-09-04'). Recibido: "${header.fecha}"`,
      { fecha: header.fecha }
    );
  }
  if (!header.concepto || !header.concepto.trim()) {
    throw new InvalidAccountingPayloadError("El campo 'concepto' (glosa del asiento) es obligatorio.");
  }

  // Validación de Período Fiscal y Bloqueo de Períodos (Art. 16 Código Tributario)
  if (payload.companyConfig) {
    const periodValidation = validateEntryFiscalPeriod(header.fecha, payload.companyConfig);
    if (!periodValidation.permitido) {
      throw new LockedFiscalPeriodError(
        `BLOQUEO FISCAL: No es posible asentar el comprobante con fecha ${header.fecha}. ${periodValidation.motivo}. ${periodValidation.sugerencia || ''}`,
        { fecha: header.fecha, validation: periodValidation }
      );
    }
  }

  // 2. SUMA DETERMINÍSTICA EN CENTAVOS Y VALIDACIÓN DE LÍNEAS
  let totalDebeCents = 0;
  let totalHaberCents = 0;

  for (let index = 0; index < lineas.length; index++) {
    const line = lineas[index];
    if (!line.codigoCuenta || !line.codigoCuenta.trim()) {
      throw new InvalidAccountingPayloadError(`Línea #${index + 1}: El campo 'codigoCuenta' es obligatorio.`);
    }
    if (!line.nombreCuenta || !line.nombreCuenta.trim()) {
      throw new InvalidAccountingPayloadError(`Línea #${index + 1}: El campo 'nombreCuenta' es obligatorio.`);
    }

    const debeCents = parseToCents(line.debe, `lineas[${index}].debe`);
    const haberCents = parseToCents(line.haber, `lineas[${index}].haber`);

    if (debeCents === 0 && haberCents === 0) {
      throw new InvalidAccountingPayloadError(
        `Línea #${index + 1} (${line.codigoCuenta} - ${line.nombreCuenta}) no tiene movimiento: Debe y Haber son ambos 0.`
      );
    }
    if (debeCents > 0 && haberCents > 0) {
      throw new InvalidAccountingPayloadError(
        `Línea #${index + 1} (${line.codigoCuenta}) contiene montos simultáneos en Debe ($${(debeCents / 100).toFixed(2)}) ` +
        `y Haber ($${(haberCents / 100).toFixed(2)}). Cada línea debe ser exclusivamente deudora o acreedora.`
      );
    }

    totalDebeCents += debeCents;
    totalHaberCents += haberCents;
  }

  // 3. VALIDACIÓN MATEMÁTICA ESTRICTA DE PARTIDA DOBLE (|Σ Debe - Σ Haber| < 0.01)
  const centsDifference = Math.abs(totalDebeCents - totalHaberCents);
  const totalDebe = totalDebeCents / 100;
  const totalHaber = totalHaberCents / 100;
  const descuadreCLP = centsDifference / 100;

  if (centsDifference >= 1) { // 1 centavo = 0.01
    // Detener la ejecución INMEDIATAMENTE sin interactuar con la base de datos
    throw new DoubleEntryImbalanceError(totalDebe, totalHaber, descuadreCLP, lineas.length, {
      empresaId: header.empresaId,
      periodo: header.periodo,
      concepto: header.concepto,
      traceId: auditContext.traceId,
    });
  }

  const totalDebeFormatted = totalDebe.toFixed(2);
  const totalHaberFormatted = totalHaber.toFixed(2);

  // 4. GENERACIÓN DE FIRMA CRIPTOGRÁFICA HMAC-SHA256
  const hmacSecret = process.env.SUPERVISOR_HMAC_SECRET || 'chile-erp-supervisor-hmac-master-key-2026';
  const supervisorSignature = generateSupervisorSignature(
    header,
    totalDebeFormatted,
    totalHaberFormatted,
    lineas,
    hmacSecret
  );

  // 5. INSERCIÓN TRANSACCIONAL ATÓMICA (ACID)
  try {
    const result = await dbInstance.transaction(async (tx: any) => {
      // 5.1 Insertar cabecera del Asiento Contable
      const generatedEntryId = crypto.randomUUID();
      const newEntryPayload: NewAccountingEntry = {
        id: generatedEntryId,
        empresaId: header.empresaId.trim(),
        periodo: header.periodo.trim(),
        fecha: header.fecha.trim(),
        concepto: header.concepto.trim(),
        documentoRef: header.documentoRef ? header.documentoRef.trim() : null,
        totalDebe: totalDebeFormatted,
        totalHaber: totalHaberFormatted,
        origenModulo: header.origenModulo.trim(),
        creadoPorAgente: header.creadoPorAgente.trim(),
        autorizadoPorSupervisor: true,
        supervisorSignature,
      };

      const [insertedEntry] = await tx
        .insert(accountingEntries)
        .values(newEntryPayload)
        .returning();

      const effectiveEntryId = insertedEntry?.id || generatedEntryId;

      // 5.2 Preparar e insertar líneas en bloque
      const linesToInsert: NewAccountingEntryLine[] = lineas.map((line, idx) => {
        const lineDebeCents = parseToCents(line.debe, 'line.debe');
        const lineHaberCents = parseToCents(line.haber, 'line.haber');

        return {
          id: crypto.randomUUID(),
          entryId: effectiveEntryId,
          lineaNumero: idx + 1,
          codigoCuenta: line.codigoCuenta.trim(),
          nombreCuenta: line.nombreCuenta.trim(),
          debe: (lineDebeCents / 100).toFixed(2),
          haber: (lineHaberCents / 100).toFixed(2),
          rutAuxiliar: line.rutAuxiliar ? line.rutAuxiliar.trim() : null,
          centroCosto: line.centroCosto ? line.centroCosto.trim() : null,
        };
      });

      const insertedLines: AccountingEntryLine[] = await tx
        .insert(accountingEntryLines)
        .values(linesToInsert)
        .returning();

      // 5.3 Construir diff contable y registrar log de auditoría agéntica
      const diffContable = {
        tipoOperacion: 'INSERT_ASIENTO_VERIFICADO',
        entryId: effectiveEntryId,
        periodo: insertedEntry?.periodo || header.periodo.trim(),
        totales: {
          totalDebe: totalDebe,
          totalHaber: totalHaber,
          cuadreExacto: true,
        },
        lineasAfectadas: (insertedLines || linesToInsert).map((l) => ({
          codigoCuenta: l.codigoCuenta,
          nombreCuenta: l.nombreCuenta,
          debe: parseFloat(l.debe),
          haber: parseFloat(l.haber),
          rutAuxiliar: l.rutAuxiliar,
          centroCosto: l.centroCosto,
        })),
      };

      const executionDuration = Math.max(0, Date.now() - startTime);

      const newAuditLogPayload: NewAgentAuditLog = {
        id: crypto.randomUUID(),
        traceId: auditContext.traceId.trim(),
        empresaId: header.empresaId.trim(),
        agenteNombre: auditContext.agenteNombre.trim(),
        accion: auditContext.accion.trim(),
        estadoTransicion: 'APROBADO',
        promptTokens: auditContext.promptTokens ?? null,
        completionTokens: auditContext.completionTokens ?? null,
        modelName: auditContext.modelName ?? null,
        promptHash: auditContext.promptHash ?? null,
        payloadInput: auditContext.payloadInput,
        payloadOutput: auditContext.payloadOutput,
        diffContable,
        supervisorVeredicto: 'VALIDADO_CORRECTO',
        supervisorSignature,
        tiempoEjecucionMs: auditContext.tiempoEjecucionMs ?? executionDuration,
      };

      const [insertedAuditLog] = await tx
        .insert(agentAuditLogs)
        .values(newAuditLogPayload)
        .returning();

      return {
        entry: insertedEntry,
        lines: insertedLines,
        auditLogId: insertedAuditLog.id,
        supervisorSignature,
        totales: {
          totalDebe,
          totalHaber,
          diferencia: descuadreCLP,
          partidaDobleValida: true,
        },
      };
    });

    return result;
  } catch (error) {
    // Si ya es un error tipado de nuestro módulo, propagarlo directamente
    if (error instanceof AccountingLedgerError) {
      throw error;
    }

    // Encapsular cualquier error imprevisto de base de datos
    throw new AccountingTransactionError(
      `Fallo durante la transacción de inserción en el Libro Contable: ${error instanceof Error ? error.message : String(error)}`,
      error,
      {
        traceId: auditContext.traceId,
        empresaId: header.empresaId,
        periodo: header.periodo,
      }
    );
  }
}
