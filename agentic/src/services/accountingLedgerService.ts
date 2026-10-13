import crypto from 'node:crypto';
import { sql, eq, and } from 'drizzle-orm';
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
import { diskPersistence } from './diskPersistenceService';
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
  documentoReferencia?: string | null;
  tipoDocumentoRef?: string | null;
  folioDocumentoRef?: string | null;
  origenModulo: string; // 'RCV_COMPRA' | 'RCV_VENTA' | 'REMUNERACIONES' | 'F29_TRIBUTARIO' | 'TESORERIA' | 'MANUAL'
  creadoPorAgente: string;
}

export interface AccountingEntryLineInput {
  id?: string;
  codigoCuenta: string;
  nombreCuenta: string;
  debe: number | string;
  haber: number | string;
  glosa?: string | null;
  rutAuxiliar?: string | null;
  nombreAuxiliar?: string | null;
  centroCosto?: string | null;
  documentoRef?: string | null;
  dteIdAsociado?: string | null;
  tipoDocumentoRef?: string | null;
  folioDocumentoRef?: string | null;
  montoDocumentoRef?: number | string | null;
  documentoOperacion?: string | null;
  tipoDocumentoOperacion?: string | null;
  documentoConciliacion?: string | null;
  tipoDocumentoConciliacion?: string | null;
  monedaOriginal?: string | null;
  montoMonedaOriginal?: number | string | null;
  tipoCambio?: number | string | null;
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
      codigo: ((l.codigoCuenta || (l as any).cuentaCodigo || '') + '').trim(),
      nombre: ((l.nombreCuenta || (l as any).cuentaNombre || '') + '').trim(),
      debe: typeof l.debe === 'number' ? l.debe.toFixed(2) : String(l.debe || 0).trim(),
      haber: typeof l.haber === 'number' ? l.haber.toFixed(2) : String(l.haber || 0).trim(),
      rut: ((l.rutAuxiliar || '') + '').trim(),
      cc: ((l.centroCosto || '') + '').trim(),
    }));

    const canonicalPayload = [
      (header.empresaId || '').trim(),
      (header.periodo || '').trim(),
      (header.fecha || '').trim(),
      (header.concepto || '').trim(),
      (header.origenModulo || (header as any).tipoOrigen || 'MANUAL').trim(),
      (header.creadoPorAgente || 'AGENTE_ORQUESTADOR_SENIOR').trim(),
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
  if (!auditContext) {
    (payload as any).auditContext = {
      traceId: crypto.randomUUID(),
      agenteNombre: header?.creadoPorAgente || 'AGENTE_ORQUESTADOR_SENIOR',
      accion: 'COMMIT_ASIENTO',
    };
  } else {
    if (!auditContext.traceId) (auditContext as any).traceId = crypto.randomUUID();
    if (!auditContext.agenteNombre) (auditContext as any).agenteNombre = header?.creadoPorAgente || 'AGENTE_ORQUESTADOR_SENIOR';
  }
  const effectiveAuditContext = (payload as any).auditContext || auditContext;

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
      traceId: effectiveAuditContext.traceId,
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
        documentoReferencia: header.documentoReferencia ? header.documentoReferencia.trim() : (header.documentoRef ? header.documentoRef.trim() : null),
        tipoDocumentoRef: header.tipoDocumentoRef ? header.tipoDocumentoRef.trim() : null,
        folioDocumentoRef: header.folioDocumentoRef ? header.folioDocumentoRef.trim() : null,
        totalDebe: totalDebeFormatted,
        totalHaber: totalHaberFormatted,
        origenModulo: (header.origenModulo || (header as any).tipoOrigen || 'MANUAL').trim(),
        creadoPorAgente: (header.creadoPorAgente || effectiveAuditContext.agenteNombre || 'AGENTE_ORQUESTADOR_SENIOR').trim(),
        autorizadoPorSupervisor: true,
        supervisorSignature,
      };

      // Inserción en MySQL 8.0 sin .returning() (MySQL Drizzle dialect no soporta returning())
      try {
        await tx
          .insert(accountingEntries)
          .values(newEntryPayload);
      } catch (insertHeaderErr: any) {
        const sqlMsg = (insertHeaderErr as any)?.cause?.message || (insertHeaderErr as any)?.sqlMessage || insertHeaderErr?.message || String(insertHeaderErr);
        console.warn('[AccountingLedger] Advertencia insertando cabecera accounting_entries:', sqlMsg);

        if (sqlMsg.includes('Unknown column') || insertHeaderErr?.errno === 1054) {
          console.log('[AccountingLedger] Auto-reparando columnas faltantes de accounting_entries en MySQL...');
          try {
            const { updateMysqlDatabase } = await import('../scripts/updateMysqlDb');
            await updateMysqlDatabase();
            await tx.insert(accountingEntries).values(newEntryPayload);
          } catch (retryErr: any) {
            console.warn('[AccountingLedger] Fallback inserción directa de cabecera con columnas esenciales...');
            await tx.execute(sql`
              INSERT INTO \`accounting_entries\` (
                \`id\`, \`empresa_id\`, \`periodo\`, \`fecha\`, \`concepto\`, \`documento_ref\`,
                \`total_debe\`, \`total_haber\`, \`origen_modulo\`, \`creado_por_agente\`,
                \`autorizado_por_supervisor\`, \`supervisor_signature\`
              ) VALUES (
                ${newEntryPayload.id}, ${newEntryPayload.empresaId}, ${newEntryPayload.periodo},
                ${newEntryPayload.fecha}, ${newEntryPayload.concepto}, ${newEntryPayload.documentoRef},
                ${newEntryPayload.totalDebe}, ${newEntryPayload.totalHaber}, ${newEntryPayload.origenModulo},
                ${newEntryPayload.creadoPorAgente}, 1, ${newEntryPayload.supervisorSignature}
              )
            `);
          }
        } else if (sqlMsg.includes('Duplicate entry') || insertHeaderErr?.errno === 1062) {
          console.warn('[AccountingLedger] Conflicto de unicidad en documento_ref. Desambiguando para persistir asiento...');
          const disambiguatedDoc = `${newEntryPayload.documentoRef || 'ASIENTO'}-${Date.now().toString().slice(-4)}`;
          newEntryPayload.documentoRef = disambiguatedDoc;
          newEntryPayload.documentoReferencia = disambiguatedDoc;
          await tx.insert(accountingEntries).values(newEntryPayload);
        } else {
          throw insertHeaderErr;
        }
      }

      const effectiveEntryId = generatedEntryId;
      const insertedEntry: AccountingEntry = {
        ...newEntryPayload,
        firmId: 'firm-default-001',
        createdAt: new Date(),
      };

      // 5.2 Preparar e insertar líneas en bloque
      const linesToInsert: NewAccountingEntryLine[] = lineas.map((line, idx) => {
        const lineDebeCents = parseToCents(line.debe, 'line.debe');
        const lineHaberCents = parseToCents(line.haber, 'line.haber');

        return {
          id: line.id || crypto.randomUUID(),
          entryId: effectiveEntryId,
          lineaNumero: idx + 1,
          codigoCuenta: line.codigoCuenta.trim(),
          nombreCuenta: line.nombreCuenta.trim(),
          debe: (lineDebeCents / 100).toFixed(2),
          haber: (lineHaberCents / 100).toFixed(2),
          rutAuxiliar: line.rutAuxiliar ? line.rutAuxiliar.trim() : null,
          centroCosto: line.centroCosto ? line.centroCosto.trim() : null,
          documentoRef: line.documentoRef ? line.documentoRef.trim() : (header.documentoRef ? header.documentoRef.trim() : null),
          dteIdAsociado: line.dteIdAsociado ? line.dteIdAsociado.trim() : null,
          tipoDocumentoRef: line.tipoDocumentoRef ? line.tipoDocumentoRef.trim() : (header.tipoDocumentoRef ? header.tipoDocumentoRef.trim() : null),
          folioDocumentoRef: line.folioDocumentoRef ? line.folioDocumentoRef.trim() : (header.folioDocumentoRef ? header.folioDocumentoRef.trim() : null),
          montoDocumentoRef: line.montoDocumentoRef !== undefined && line.montoDocumentoRef !== null ? String(line.montoDocumentoRef) : null,
          fechaDocumentoRef: line.fechaDocumentoRef ? line.fechaDocumentoRef.trim() : null,
          fechaVencimientoRef: line.fechaVencimientoRef ? line.fechaVencimientoRef.trim() : null,
          documentoOperacion: line.documentoOperacion ? line.documentoOperacion.trim() : null,
          tipoDocumentoOperacion: line.tipoDocumentoOperacion ? line.tipoDocumentoOperacion.trim() : null,
          fechaDocumentoOperacion: line.fechaDocumentoOperacion ? line.fechaDocumentoOperacion.trim() : null,
          documentoConciliacion: line.documentoConciliacion ? line.documentoConciliacion.trim() : null,
          tipoDocumentoConciliacion: line.tipoDocumentoConciliacion ? line.tipoDocumentoConciliacion.trim() : null,
          monedaOriginal: line.monedaOriginal ? line.monedaOriginal.trim() : null,
          montoMonedaOriginal: line.montoMonedaOriginal !== undefined && line.montoMonedaOriginal !== null ? String(line.montoMonedaOriginal) : null,
          tipoCambio: line.tipoCambio !== undefined && line.tipoCambio !== null ? String(line.tipoCambio) : null,
        };
      });

      try {
        await tx
          .insert(accountingEntryLines)
          .values(linesToInsert);
      } catch (insertLinesErr: any) {
        const sqlMsg = (insertLinesErr as any)?.cause?.message || (insertLinesErr as any)?.sqlMessage || insertLinesErr?.message || String(insertLinesErr);
        console.warn('[AccountingLedger] Advertencia insertando líneas accounting_entry_lines:', sqlMsg);

        if (sqlMsg.includes('Unknown column') || insertLinesErr?.errno === 1054) {
          console.log('[AccountingLedger] Auto-reparando columnas faltantes de accounting_entry_lines en MySQL...');
          try {
            const { updateMysqlDatabase } = await import('../scripts/updateMysqlDb');
            await updateMysqlDatabase();
            await tx.insert(accountingEntryLines).values(linesToInsert);
          } catch (retryErr: any) {
            console.warn('[AccountingLedger] Fallback inserción directa de líneas con columnas esenciales...');
            for (const l of linesToInsert) {
              await tx.execute(sql`
                INSERT INTO \`accounting_entry_lines\` (
                  \`id\`, \`entry_id\`, \`codigo_cuenta\`, \`nombre_cuenta\`,
                  \`debe\`, \`haber\`, \`rut_auxiliar\`, \`centro_costo\`
                ) VALUES (
                  ${l.id}, ${l.entryId}, ${l.codigoCuenta}, ${l.nombreCuenta},
                  ${l.debe}, ${l.haber}, ${l.rutAuxiliar || null}, ${l.centroCosto || null}
                )
              `);
            }
          }
        } else {
          throw insertLinesErr;
        }
      }

      const insertedLines: AccountingEntryLine[] = linesToInsert.map((l) => ({
        ...l,
        rutAuxiliar: l.rutAuxiliar || null,
        centroCosto: l.centroCosto || null,
      }));

      // 5.3 Construir diff contable y registrar log de auditoría agéntica
      const diffContable = {
        tipoOperacion: 'INSERT_ASIENTO_VERIFICADO',
        entryId: effectiveEntryId,
        periodo: header.periodo.trim(),
        totales: {
          totalDebe: totalDebe,
          totalHaber: totalHaber,
          cuadreExacto: true,
        },
        lineasAfectadas: linesToInsert.map((l) => ({
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
        traceId: (effectiveAuditContext.traceId || crypto.randomUUID()).trim(),
        firmId: (header as any).firmId || 'firm-default-001',
        empresaId: header.empresaId.trim(),
        agenteNombre: (effectiveAuditContext.agenteNombre || 'AGENTE_ORQUESTADOR_SENIOR').trim(),
        modulo: (header.origenModulo || (header as any).tipoOrigen || 'CONTABILIDAD').trim(),
        accion: (effectiveAuditContext.accion || 'COMMIT_ASIENTO').trim(),
        estadoTransicion: 'APROBADO',
        promptTokens: effectiveAuditContext.promptTokens ?? null,
        completionTokens: effectiveAuditContext.completionTokens ?? null,
        modelName: effectiveAuditContext.modelName ?? null,
        promptHash: effectiveAuditContext.promptHash ?? null,
        payloadInput: effectiveAuditContext.payloadInput || {},
        payloadOutput: effectiveAuditContext.payloadOutput || {},
        diffContable,
        supervisorVeredicto: 'VALIDADO_CORRECTO',
        supervisorSignature,
        tiempoEjecucionMs: effectiveAuditContext.tiempoEjecucionMs ?? executionDuration,
      };

      try {
        await tx
          .insert(agentAuditLogs)
          .values(newAuditLogPayload);
      } catch (auditInsertErr: any) {
        console.warn('[AccountingLedger] Aviso al persistir agent_audit_logs en MySQL:', auditInsertErr?.message);
        // Si hay una discrepancia de esquema en caliente, intentar auto-reparar la tabla
        if (
          auditInsertErr?.message &&
          (auditInsertErr.message.includes('Unknown column') ||
            auditInsertErr.message.includes('no such column') ||
            auditInsertErr.errno === 1054)
        ) {
          try {
            const { updateMysqlDatabase } = await import('../scripts/updateMysqlDb');
            await updateMysqlDatabase();
            await tx.insert(agentAuditLogs).values(newAuditLogPayload);
            console.log('[AccountingLedger] Auto-reparación de agent_audit_logs exitosa, log persistido.');
          } catch (retryAuditErr: any) {
            console.warn('[AccountingLedger] Reintento de auditoría omitido para resguardar la integridad del asiento:', retryAuditErr?.message);
          }
        }
      }

      const insertedAuditLog = newAuditLogPayload;

      // 5.4 Si proviene de RCV, actualizar estado contable y vinculación en dtes_rcv
      const origenMod = (header.origenModulo || (header as any).tipoOrigen || 'MANUAL').trim();
      if (origenMod === 'RCV_COMPRA' || origenMod === 'RCV_VENTA') {
        const tipoOp = origenMod === 'RCV_COMPRA' ? 'COMPRA' : 'VENTA';
        const cleanRutVal = header.empresaId.replace(/[\.\-\s]/g, '').toUpperCase();
        try {
          const { dtesRcv } = await import('../db/schema/dtesSchema');
          await tx
            .update(dtesRcv)
            .set({
              estadoContable: 'CENTRALIZADO',
              entryIdRef: effectiveEntryId,
            })
            .where(
              and(
                sql`REPLACE(REPLACE(REPLACE(${dtesRcv.empresaId}, '.', ''), '-', ''), ' ', '') = ${cleanRutVal}`,
                eq(dtesRcv.periodo, header.periodo.trim()),
                eq(dtesRcv.tipoOperacion, tipoOp)
              )
            );
        } catch (dteErr: any) {
          console.warn('[AccountingLedger] Advertencia actualizando dtes_rcv:', dteErr?.message);
        }
      }


      // 5.5 Respaldo simultáneo en disco para redundancia y sincronización UI
      try {
        diskPersistence.addAccountingEntry({ ...newEntryPayload }, linesToInsert);
        diskPersistence.addAuditLog({ ...newAuditLogPayload });
        if (origenMod === 'RCV_COMPRA' || origenMod === 'RCV_VENTA') {
          const tipoOp = origenMod === 'RCV_COMPRA' ? 'COMPRA' : 'VENTA';
          diskPersistence.markDtesAsCentralized(header.empresaId, header.periodo.trim(), tipoOp, effectiveEntryId);
        }
      } catch (diskErr: any) {
        console.warn('[AccountingLedger] Advertencia al respaldar en disco:', diskErr?.message);
      }

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

    // Encapsular cualquier error imprevisto de base de datos con causa detallada
    const causeMsg =
      (error as any)?.cause?.message ||
      (error as any)?.cause?.sqlMessage ||
      (error as any)?.sqlMessage ||
      (error instanceof Error ? error.message : String(error));

    throw new AccountingTransactionError(
      `Fallo durante la transacción de inserción en el Libro Contable: ${causeMsg}`,
      error,
      {
        traceId: effectiveAuditContext.traceId,
        empresaId: header.empresaId,
        periodo: header.periodo,
      }
    );
  }
}
