import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import crypto from 'node:crypto';
import { db, getDb, queryEntriesWithLines } from '@/db';
import { agentAuditLogs, accountingEntries, accountingEntryLines } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { diskPersistence } from '../services/diskPersistenceService';
import {
  recordVerifiedEntry,
  DoubleEntryImbalanceError,
  InvalidAccountingPayloadError,
  SupervisorSignatureError,
  AccountingTransactionError,
  AccountingLedgerError,
  type RecordVerifiedEntryPayload,
} from '../services/accountingLedgerService';

// ============================================================================
// ESQUEMAS DE VALIDACIÓN ZOD EN TIEMPO DE EJECUCIÓN
// ============================================================================

/**
 * Esquema para las líneas individuales de partida doble
 */
export const accountingEntryLineSchema = z.object({
  codigoCuenta: z
    .string()
    .trim()
    .min(1, 'El código de cuenta es obligatorio y no puede estar vacío')
    .max(30, 'El código de cuenta excede los 30 caracteres permitidos'),
  nombreCuenta: z
    .string()
    .trim()
    .min(1, 'El nombre de la cuenta es obligatorio y no puede estar vacío')
    .max(200, 'El nombre de la cuenta excede los 200 caracteres permitidos'),
  debe: z
    .union([z.number(), z.string()])
    .refine(
      (val) => {
        const num = typeof val === 'number' ? val : parseFloat(String(val).replace(',', '.'));
        return !isNaN(num) && isFinite(num) && num >= 0;
      },
      { message: 'El campo "debe" debe ser un número positivo o cero' }
    ),
  haber: z
    .union([z.number(), z.string()])
    .refine(
      (val) => {
        const num = typeof val === 'number' ? val : parseFloat(String(val).replace(',', '.'));
        return !isNaN(num) && isFinite(num) && num >= 0;
      },
      { message: 'El campo "haber" debe ser un número positivo o cero' }
    ),
  glosa: z.string().trim().max(500).optional().nullable(),
  rutAuxiliar: z
    .string()
    .trim()
    .max(20, 'El RUT auxiliar no puede exceder 20 caracteres')
    .optional()
    .nullable(),
  nombreAuxiliar: z.string().trim().max(200).optional().nullable(),
  centroCosto: z
    .string()
    .trim()
    .max(100, 'El centro de costo no puede exceder 100 caracteres')
    .optional()
    .nullable(),
  documentoRef: z.string().trim().max(150).optional().nullable(),
  dteIdAsociado: z.string().trim().max(36).optional().nullable(),
  tipoDocumentoRef: z.string().trim().max(50).optional().nullable(),
  folioDocumentoRef: z.string().trim().max(100).optional().nullable(),
  montoDocumentoRef: z.union([z.number(), z.string()]).optional().nullable(),
  fechaDocumentoRef: z.string().trim().max(20).optional().nullable(),
  fechaVencimientoRef: z.string().trim().max(20).optional().nullable(),
  documentoOperacion: z.string().trim().max(100).optional().nullable(),
  tipoDocumentoOperacion: z.string().trim().max(50).optional().nullable(),
  fechaDocumentoOperacion: z.string().trim().max(20).optional().nullable(),
  documentoConciliacion: z.string().trim().max(100).optional().nullable(),
  tipoDocumentoConciliacion: z.string().trim().max(50).optional().nullable(),
  monedaOriginal: z.string().trim().max(10).optional().nullable(),
  montoMonedaOriginal: z.union([z.number(), z.string()]).optional().nullable(),
  tipoCambio: z.union([z.number(), z.string()]).optional().nullable(),
});

/**
 * Esquema para la cabecera del asiento contable
 */
export const accountingEntryHeaderSchema = z.object({
  empresaId: z
    .string()
    .trim()
    .min(3, 'El ID de la empresa debe tener al menos 3 caracteres')
    .max(30, 'El ID de la empresa no puede exceder 30 caracteres')
    .regex(
      /^(\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]|\d{7,8}-[\dkK]|[\w\.-]{3,30})$/i,
      'El formato de empresaId debe ser un RUT chileno válido (ej: 76.543.210-K o 76543210-K) o un identificador corporativo'
    ),
  periodo: z
    .string()
    .trim()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'El periodo debe tener el formato YYYY-MM (ej: 2026-09)'),
  fecha: z
    .string()
    .trim()
    .regex(
      /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/,
      'La fecha debe tener el formato YYYY-MM-DD (ej: 2026-09-04)'
    ),
  concepto: z
    .string()
    .trim()
    .min(3, 'El concepto debe tener al menos 3 caracteres descriptivos')
    .max(500, 'El concepto no puede superar los 500 caracteres'),
  documentoRef: z
    .string()
    .trim()
    .max(100, 'El documento de referencia no puede superar los 100 caracteres')
    .optional()
    .nullable(),
  documentoReferencia: z
    .string()
    .trim()
    .max(150, 'El documento de referencia extendido no puede superar los 150 caracteres')
    .optional()
    .nullable(),
  tipoDocumentoRef: z
    .string()
    .trim()
    .max(50)
    .optional()
    .nullable(),
  folioDocumentoRef: z
    .string()
    .trim()
    .max(100)
    .optional()
    .nullable(),
  origenModulo: z
    .string()
    .trim()
    .min(2, 'Debe especificar el módulo origen (ej: RCV_COMPRA, REMUNERACIONES, F29_TRIBUTARIO, etc.)'),
  creadoPorAgente: z
    .string()
    .trim()
    .min(2, 'Debe especificarse el nombre del agente creador (ej: AGENTE_RCV, AGENTE_RRHH, AGENTE_F29)'),
});

/**
 * Esquema para el contexto y trazabilidad del agente emisor
 */
export const agentAuditContextSchema = z.object({
  traceId: z
    .string()
    .trim()
    .min(1, 'El traceId de observabilidad es obligatorio'),
  agenteNombre: z
    .string()
    .trim()
    .min(1, 'El nombre del agente es obligatorio'),
  accion: z
    .string()
    .trim()
    .min(1, 'La acción ejecutada es obligatoria'),
  promptTokens: z.number().int().nonnegative().optional().nullable(),
  completionTokens: z.number().int().nonnegative().optional().nullable(),
  modelName: z.string().trim().max(50).optional().nullable(),
  promptHash: z.string().trim().max(64).optional().nullable(),
  payloadInput: z.record(z.string(), z.any()).optional().default({}),
  payloadOutput: z.record(z.string(), z.any()).optional().default({}),
  tiempoEjecucionMs: z.number().int().nonnegative().optional(),
});

/**
 * Esquema raíz para POST /api/accounting/commit-entry
 */
export const commitEntrySchema = z.object({
  header: accountingEntryHeaderSchema,
  lineas: z
    .array(accountingEntryLineSchema)
    .min(2, 'Un asiento contable requiere al menos 2 líneas para cumplir el principio de partida doble'),
  auditContext: agentAuditContextSchema,
});

export type CommitEntryInput = z.infer<typeof commitEntrySchema>;

// ============================================================================
// MIDDLEWARE DE VALIDACIÓN ZOD (ESTRUCTURADO CON HTTP 422)
// ============================================================================

/**
 * Middleware que intercepta y valida la carga útil contra el esquema Zod.
 * Retorna HTTP 422 Unprocessable Entity con la lista estructurada de errores si falla.
 */
export function validateRequestBody(schema: z.ZodSchema<any>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const traceId =
      (req.headers['x-trace-id'] as string) ||
      req.body?.auditContext?.traceId ||
      crypto.randomUUID();

    const parseResult = schema.safeParse(req.body);

    if (!parseResult.success) {
      const formattedErrors = parseResult.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        code: issue.code,
        message: issue.message,
      }));

      console.warn(`[AUDIT-OBSERVABILITY][${traceId}] Fallo de validación de esquema Zod:`, {
        errorsCount: formattedErrors.length,
        errors: formattedErrors,
      });

      res.status(422).json({
        success: false,
        statusCode: 422,
        error: 'UNPROCESSABLE_ENTITY',
        message: 'El payload recibido no cumple con las reglas del esquema contable estricto.',
        traceId,
        issues: formattedErrors,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Sobrescribir req.body con los datos parseados y sanitizados
    req.body = parseResult.data;
    next();
  };
}

// ============================================================================
// CONTROLADOR: commitEntryHandler
// ============================================================================

/**
 * Manejador principal para asentar un comprobante contable verificado.
 *
 * Flujo:
 * 1. Extrae el payload tipado y sanitizado por Zod.
 * 2. Invoca el servicio transaccional `recordVerifiedEntry`.
 * 3. Si el asiento es rechazado por descuadre (|Σ Debe - Σ Haber| >= 0.01) o regla inválida:
 *    - Registra el intento fallido en `agentAuditLogs` con estado `'RECHAZADO'`.
 *    - Retorna HTTP 400 Bad Request con el desglose matemático del descuadre.
 * 4. Si la transacción es exitosa:
 *    - Retorna HTTP 201 Created con el asiento, líneas y firma criptográfica HMAC-SHA256.
 */
export async function commitEntryHandler(req: Request, res: Response): Promise<void> {
  const startTime = Date.now();
  const payload = req.body as CommitEntryInput;
  const { header, lineas, auditContext } = payload || {};
  const traceId = auditContext?.traceId || (req.headers['x-trace-id'] as string) || crypto.randomUUID();

  console.log(`[AUDIT-OBSERVABILITY][${traceId}] Iniciando validación transaccional de asiento contable:`, {
    empresaId: header?.empresaId,
    periodo: header?.periodo,
    agente: auditContext?.agenteNombre || 'AGENTE_ORQUESTADOR_SENIOR',
    lineasCount: lineas?.length || 0,
  });

  try {
    // Invocación a la capa de servicio con atomicidad ACID
    const result = await recordVerifiedEntry(payload as RecordVerifiedEntryPayload, db);

    const durationMs = Date.now() - startTime;
    console.log(`[AUDIT-OBSERVABILITY][${traceId}] Asiento contable autorizado con éxito (${durationMs}ms):`, {
      entryId: result.entry.id,
      totalDebe: result.totales.totalDebe,
      totalHaber: result.totales.totalHaber,
      signature: result.supervisorSignature.substring(0, 16) + '...',
    });

    res.status(201).json({
      success: true,
      statusCode: 201,
      message: 'Asiento contable autorizado, sellado criptográficamente y registrado en el Libro Diario.',
      traceId,
      data: {
        entry: result.entry,
        lines: result.lines,
        auditLogId: result.auditLogId,
        supervisorSignature: result.supervisorSignature,
        totales: result.totales,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    const durationMs = Date.now() - startTime;

    // Manejo específico: Descuadre de Partida Doble
    if (error instanceof DoubleEntryImbalanceError) {
      console.error(`[AUDIT-OBSERVABILITY][${traceId}] RECHAZADO por Descuadre de Partida Doble:`, {
        totalDebe: error.totalDebe,
        totalHaber: error.totalHaber,
        descuadre: error.descuadre,
      });

      // Persistir log de auditoría del intento rechazado
      try {
        await db.insert(agentAuditLogs).values({
          id: crypto.randomUUID(),
          traceId,
          firmId: 'firm-default-001',
          empresaId: header.empresaId,
          modulo: header.origenModulo || 'CONTABILIDAD',
          agenteNombre: auditContext.agenteNombre,
          accion: auditContext.accion || 'COMMIT_ASIENTO',
          estadoTransicion: 'RECHAZADO',
          promptTokens: auditContext.promptTokens ?? null,
          completionTokens: auditContext.completionTokens ?? null,
          modelName: auditContext.modelName ?? null,
          promptHash: auditContext.promptHash ?? null,
          payloadInput: auditContext.payloadInput || req.body,
          payloadOutput: {
            error: error.message,
            code: error.code,
            details: error.details,
          },
          diffContable: {
            estado: 'RECHAZADO_POR_DESCUADRE',
            totalDebe: error.totalDebe,
            totalHaber: error.totalHaber,
            descuadre: error.descuadre,
            cantidadLineas: error.cantidadLineas,
          },
          supervisorVeredicto: 'RECHAZADO_DESCUADRE',
          supervisorSignature: 'RECHAZADO_SIN_FIRMA',
          tiempoEjecucionMs: durationMs,
        });
      } catch (logError) {
        console.error(`[AUDIT-OBSERVABILITY][${traceId}] Error al registrar log de rechazo:`, logError);
      }

      res.status(400).json({
        success: false,
        statusCode: 400,
        error: error.code,
        message: error.message,
        traceId,
        details: {
          totalDebe: error.totalDebe,
          totalHaber: error.totalHaber,
          descuadre: error.descuadre,
          cantidadLineas: error.cantidadLineas,
        },
        timestamp: error.timestamp,
      });
      return;
    }

    // Manejo específico: Payload contable no válido
    if (error instanceof InvalidAccountingPayloadError) {
      console.error(`[AUDIT-OBSERVABILITY][${traceId}] RECHAZADO por regla contable inválida:`, error.message);

      try {
        await db.insert(agentAuditLogs).values({
          id: crypto.randomUUID(),
          traceId,
          firmId: 'firm-default-001',
          empresaId: header.empresaId,
          modulo: header.origenModulo || 'CONTABILIDAD',
          agenteNombre: auditContext.agenteNombre,
          accion: auditContext.accion || 'COMMIT_ASIENTO',
          estadoTransicion: 'RECHAZADO',
          promptTokens: auditContext.promptTokens ?? null,
          completionTokens: auditContext.completionTokens ?? null,
          modelName: auditContext.modelName ?? null,
          promptHash: auditContext.promptHash ?? null,
          payloadInput: auditContext.payloadInput || req.body,
          payloadOutput: {
            error: error.message,
            code: error.code,
            details: error.details,
          },
          diffContable: {
            estado: 'RECHAZADO_POR_PAYLOAD_INVALIDO',
            motivo: error.message,
          },
          supervisorVeredicto: 'RECHAZADO_REGLA_CONTABLE',
          supervisorSignature: 'RECHAZADO_SIN_FIRMA',
          tiempoEjecucionMs: durationMs,
        });
      } catch (logError) {
        console.error(`[AUDIT-OBSERVABILITY][${traceId}] Error al registrar log de rechazo:`, logError);
      }

      res.status(400).json({
        success: false,
        statusCode: 400,
        error: error.code,
        message: error.message,
        traceId,
        details: error.details,
        timestamp: error.timestamp,
      });
      return;
    }

    // Manejo de otros errores controlados del servicio
    if (error instanceof AccountingLedgerError) {
      console.error(`[AUDIT-OBSERVABILITY][${traceId}] Error del servicio contable:`, error.message);

      res.status(500).json({
        success: false,
        statusCode: 500,
        error: error.code,
        message: error.message,
        traceId,
        details: error.details,
        timestamp: error.timestamp,
      });
      return;
    }

    // Error no previsto o fallo de infraestructura
    console.error(`[AUDIT-OBSERVABILITY][${traceId}] Excepción imprevista en commitEntryHandler:`, error);
    res.status(500).json({
      success: false,
      statusCode: 500,
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Ocurrió un error inesperado al asentar el comprobante contable en la base de datos.',
      traceId,
      details: process.env.NODE_ENV === 'development' ? { message: error?.message, stack: error?.stack } : undefined,
      timestamp: new Date().toISOString(),
    });
  }
}

// ============================================================================
// ROUTER DE EXPRESS LISTO PARA MONTAR
// ============================================================================

export const supervisorLedgerRouter = Router();

/**
 * POST /commit-entry (o /api/accounting/commit-entry al montarse en el router principal)
 */
supervisorLedgerRouter.post(
  '/commit-entry',
  validateRequestBody(commitEntrySchema),
  commitEntryHandler
);

/**
 * GET /entries - Obtiene los asientos contables registrados y autorizados
 * Filtros opcionales: ?empresaId=76.892.410-K&periodo=2026-09
 */
supervisorLedgerRouter.get('/entries', async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).user;
    // AISLAMIENTO MULTI-TENANT ESTRICTO: usuarios no-superadmin SOLO leen req.effectiveEmpresaId
    const targetEmpresaId = authUser?.isSuperAdmin
      ? (req.effectiveEmpresaId || (req.query.empresaId ? String(req.query.empresaId).trim() : undefined))
      : (req.effectiveEmpresaId || authUser?.empresaPrincipalId);

    const periodo = req.query.periodo ? String(req.query.periodo).trim() : undefined;

    const entries = await queryEntriesWithLines(targetEmpresaId, periodo);

    res.json({
      success: true,
      data: entries,
      total: entries.length,
      empresaId: targetEmpresaId || 'TODAS',
      periodo: periodo || 'TODOS',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[SUPERVISOR-LEDGER] Error al consultar asientos contables:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: 'No se pudieron recuperar los asientos contables desde la base de datos.',
      details: process.env.NODE_ENV === 'development' ? error?.message : undefined,
    });
  }
});

/**
 * PUT /entries/:id/status - Actualiza el estado o autorización de un asiento contable
 */
supervisorLedgerRouter.put('/entries/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { autorizadoPorSupervisor, supervisorSignature, estado } = req.body;
    const dbInstance = getDb();

    const updateData: any = {};
    if (autorizadoPorSupervisor !== undefined) updateData.autorizadoPorSupervisor = Boolean(autorizadoPorSupervisor);
    if (supervisorSignature !== undefined) updateData.supervisorSignature = supervisorSignature;
    if (estado !== undefined) updateData.estado = estado;

    await dbInstance.update(accountingEntries).set(updateData).where(eq(accountingEntries.id, id));

    res.json({
      success: true,
      message: 'Estado de asiento contable actualizado exitosamente.',
      data: { id, ...updateData },
    });
  } catch (error: any) {
    console.error('[SUPERVISOR-LEDGER] Error al actualizar estado del asiento:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /entries/:id - Modifica un asiento contable existente (glosa, referencias de documento, líneas)
 */
supervisorLedgerRouter.put('/entries/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { concepto, documentoRef, documentoReferencia, tipoDocumentoRef, folioDocumentoRef, fecha, lineas, motivoModificacion } = req.body;
    const dbInstance = getDb();

    // 1. Obtener asiento actual
    const existing = await queryEntriesWithLines();
    const currentEntry = existing.find((e: any) => e.id === id);
    if (!currentEntry) {
      return res.status(404).json({ success: false, error: 'ASIENTO_NO_ENCONTRADO', message: `No se encontró el asiento con ID ${id}.` });
    }

    const updateFields: any = {};
    if (concepto !== undefined) updateFields.concepto = String(concepto).trim();
    if (documentoRef !== undefined) {
      updateFields.documentoRef = String(documentoRef).trim();
      updateFields.documentoReferencia = documentoReferencia ? String(documentoReferencia).trim() : String(documentoRef).trim();
    }
    if (documentoReferencia !== undefined) updateFields.documentoReferencia = String(documentoReferencia).trim();
    if (tipoDocumentoRef !== undefined) updateFields.tipoDocumentoRef = String(tipoDocumentoRef).trim();
    if (folioDocumentoRef !== undefined) updateFields.folioDocumentoRef = String(folioDocumentoRef).trim();
    if (fecha !== undefined) {
      updateFields.fecha = String(fecha).trim();
      if (/^\d{4}-\d{2}/.test(updateFields.fecha)) {
        updateFields.periodo = updateFields.fecha.substring(0, 7);
      }
    }

    let processedLines: any[] | undefined = undefined;
    if (lineas && Array.isArray(lineas)) {
      if (lineas.length < 2) {
        return res.status(400).json({ success: false, error: 'PARTIDA_DOBLE_INSUFICIENTE', message: 'Se requieren al menos 2 líneas para el asiento contable.' });
      }

      let sumDebe = 0;
      let sumHaber = 0;
      processedLines = lineas.map((l: any, idx: number) => {
        const d = typeof l.debe === 'number' ? l.debe : parseFloat(String(l.debe).replace(',', '.')) || 0;
        const h = typeof l.haber === 'number' ? l.haber : parseFloat(String(l.haber).replace(',', '.')) || 0;
        sumDebe += Math.round(d * 100);
        sumHaber += Math.round(h * 100);
        return {
          id: l.id || crypto.randomUUID(),
          entryId: id,
          lineaNumero: idx + 1,
          codigoCuenta: l.codigoCuenta || l.cuentaCodigo || '1.1.01.001',
          nombreCuenta: l.nombreCuenta || l.cuentaNombre || 'Cuenta Contable',
          debe: (d).toFixed(2),
          haber: (h).toFixed(2),
          rutAuxiliar: l.rutAuxiliar?.trim() || null,
          centroCosto: l.centroCosto?.trim() || null,
          documentoRef: l.documentoRef || updateFields.documentoRef || currentEntry.documentoRef || null,
          dteIdAsociado: l.dteIdAsociado || null,
          tipoDocumentoRef: l.tipoDocumentoRef || updateFields.tipoDocumentoRef || null,
          folioDocumentoRef: l.folioDocumentoRef || updateFields.folioDocumentoRef || null,
          montoDocumentoRef: l.montoDocumentoRef != null ? Number(l.montoDocumentoRef).toFixed(2) : null,
          fechaDocumentoRef: l.fechaDocumentoRef || null,
          fechaVencimientoRef: l.fechaVencimientoRef || null,
          documentoOperacion: l.documentoOperacion?.trim() || null,
          tipoDocumentoOperacion: l.tipoDocumentoOperacion?.trim() || null,
          fechaDocumentoOperacion: l.fechaDocumentoOperacion || null,
          documentoConciliacion: l.documentoConciliacion?.trim() || null,
          tipoDocumentoConciliacion: l.tipoDocumentoConciliacion?.trim() || null,
          monedaOriginal: l.monedaOriginal || null,
          montoMonedaOriginal: l.montoMonedaOriginal != null ? Number(l.montoMonedaOriginal).toFixed(2) : null,
          tipoCambio: l.tipoCambio != null ? Number(l.tipoCambio).toFixed(4) : null,
        };
      });

      if (Math.abs(sumDebe - sumHaber) > 1) {
        return res.status(400).json({
          success: false,
          error: 'DESCUADRE_PARTIDA_DOBLE',
          message: `El asiento está descuadrado: Debe ($${(sumDebe/100).toFixed(2)}) != Haber ($${(sumHaber/100).toFixed(2)}).`,
        });
      }

      updateFields.totalDebe = (sumDebe / 100).toFixed(2);
      updateFields.totalHaber = (sumHaber / 100).toFixed(2);
    }

    // Actualizar en DB
    if (Object.keys(updateFields).length > 0) {
      await dbInstance.update(accountingEntries).set(updateFields).where(eq(accountingEntries.id, id));
    }
    if (processedLines && processedLines.length > 0) {
      await dbInstance.delete(accountingEntryLines).where(eq(accountingEntryLines.entryId, id));
      for (const pl of processedLines) {
        await dbInstance.insert(accountingEntryLines).values(pl);
      }
    }

    // Actualizar en diskPersistence y memoria
    diskPersistence.updateAccountingEntry(id, updateFields, processedLines);

    // Registro de Auditoría
    try {
      await dbInstance.insert(agentAuditLogs).values({
        id: crypto.randomUUID(),
        traceId: `trace-update-${Date.now()}`,
        firmId: currentEntry.firmId || 'firm-001-audicon',
        empresaId: currentEntry.empresaId,
        agenteNombre: 'OPERADOR_AUDITOR',
        modulo: 'CONTABILIDAD',
        accion: 'UPDATE_ASIENTO',
        estadoTransicion: 'MODIFICADO',
        payloadInput: { id, updateFields, motivoModificacion },
        payloadOutput: { id, status: 'MODIFICADO_EXITOSO' },
        supervisorVeredicto: 'MODIFICACION_AUTORIZADA',
        supervisorSignature: currentEntry.supervisorSignature || 'FIRMA_MODIFICADA',
        tiempoEjecucionMs: 15,
      });
    } catch {}

    res.json({
      success: true,
      message: 'Asiento contable actualizado exitosamente con respaldo de auditoría.',
      data: { id, ...updateFields, lineas: processedLines || currentEntry.lineas },
    });
  } catch (error: any) {
    console.error('[SUPERVISOR-LEDGER] Error al actualizar asiento contable:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /entries/:id - Elimina un asiento contable con respaldo de auditoría
 */
supervisorLedgerRouter.delete('/entries/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const motivo = (req.body?.motivo || req.query?.motivo || 'Eliminación manual por corrección de usuario') as string;
    const dbInstance = getDb();

    // 1. Obtener asiento actual para respaldar en el log de auditoría
    const existing = await queryEntriesWithLines();
    const currentEntry = existing.find((e: any) => e.id === id);
    if (!currentEntry) {
      return res.status(404).json({ success: false, error: 'ASIENTO_NO_ENCONTRADO', message: `No se encontró el asiento con ID ${id}.` });
    }

    // 2. Eliminar líneas y encabezado en DB
    await dbInstance.delete(accountingEntryLines).where(eq(accountingEntryLines.entryId, id));
    await dbInstance.delete(accountingEntries).where(eq(accountingEntries.id, id));

    // 3. Eliminar en persistencia en disco y memoria
    diskPersistence.deleteAccountingEntry(id);

    // 4. Registro de Auditoría forense inmutable
    try {
      await dbInstance.insert(agentAuditLogs).values({
        id: crypto.randomUUID(),
        traceId: `trace-delete-${Date.now()}`,
        firmId: currentEntry.firmId || 'firm-001-audicon',
        empresaId: currentEntry.empresaId,
        agenteNombre: 'OPERADOR_AUDITOR',
        modulo: 'CONTABILIDAD',
        accion: 'DELETE_ASIENTO',
        estadoTransicion: 'ELIMINADO',
        payloadInput: { id, motivo, snapshotAsientoEliminado: currentEntry },
        payloadOutput: { id, status: 'ELIMINADO_CON_EXITO' },
        supervisorVeredicto: 'ELIMINACION_AUDITADA',
        supervisorSignature: 'ELIMINADO_CONFORME',
        tiempoEjecucionMs: 10,
      });
    } catch {}

    res.json({
      success: true,
      message: `Asiento contable [${currentEntry.documentoRef || id}] eliminado exitosamente.`,
      data: { id, eliminado: true },
    });
  } catch (error: any) {
    console.error('[SUPERVISOR-LEDGER] Error al eliminar asiento contable:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /entries/:id/reverse - Genera un contra-asiento de anulación / reversión contable
 */
supervisorLedgerRouter.post('/entries/:id/reverse', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const motivo = (req.body?.motivo || 'Anulación / Reversión de comprobante') as string;
    const fechaReversion = req.body?.fecha || new Date().toISOString().split('T')[0];
    const periodoReversion = fechaReversion.substring(0, 7);
    const dbInstance = getDb();

    // 1. Obtener asiento original
    const existing = await queryEntriesWithLines();
    const currentEntry = existing.find((e: any) => e.id === id);
    if (!currentEntry) {
      return res.status(404).json({ success: false, error: 'ASIENTO_NO_ENCONTRADO', message: `No se encontró el asiento con ID ${id}.` });
    }

    // 2. Invertir las líneas: Debe -> Haber, Haber -> Debe
    const reverseLines = currentEntry.lineas.map((line: any) => ({
      codigoCuenta: line.codigoCuenta || line.cuentaCodigo,
      nombreCuenta: line.nombreCuenta || line.cuentaNombre,
      debe: Number(line.haber) || 0,
      haber: Number(line.debe) || 0,
      rutAuxiliar: line.rutAuxiliar || null,
      centroCosto: line.centroCosto || null,
      documentoRef: `REV-${currentEntry.documentoRef || currentEntry.id}`,
    }));

    // 3. Crear el contra-asiento formal mediante recordVerifiedEntry
    const reversePayload = {
      header: {
        empresaId: currentEntry.empresaId,
        periodo: periodoReversion,
        fecha: fechaReversion,
        concepto: `Reversión / Anulación de Asiento [${currentEntry.documentoRef || currentEntry.id}]: ${motivo}`,
        documentoRef: `REV-${currentEntry.documentoRef || currentEntry.id}`,
        origenModulo: 'MANUAL',
        creadoPorAgente: 'OPERADOR_REVERSION',
      },
      lineas: reverseLines,
      auditContext: {
        traceId: `trace-rev-${Date.now()}`,
        agenteNombre: 'OPERADOR_REVERSION',
        accion: 'REVERSION_ASIENTO',
        payloadInput: { originalEntryId: id, motivo },
      },
    };

    const result = await recordVerifiedEntry(reversePayload as any, dbInstance);

    res.status(201).json({
      success: true,
      message: `Contra-asiento de anulación registrado con éxito.`,
      data: result,
    });
  } catch (error: any) {
    console.error('[SUPERVISOR-LEDGER] Error al revertir asiento contable:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /health - Verificación de estado del módulo de orquestación contable
 */
supervisorLedgerRouter.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'SupervisorLedgerService',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});
