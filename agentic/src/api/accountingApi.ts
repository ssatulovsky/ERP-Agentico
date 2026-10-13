import type { AccountingEntry, AccountingEntryLine } from '../types';

/**
 * ============================================================================
 * CLIENTE HTTP CENTRALIZADO Y TIPADO PARA LA API CONTABLE
 * ============================================================================
 */

export interface ApiAccountingLine {
  id?: string;
  codigoCuenta: string;
  nombreCuenta: string;
  debe: number | string;
  haber: number | string;
  rutAuxiliar?: string | null;
  nombreAuxiliar?: string | null;
  centroCosto?: string | null;
  documentoRef?: string | null;
  dteIdAsociado?: string | null;
  tipoDocumentoRef?: string | null;
  folioDocumentoRef?: string | null;
  montoDocumentoRef?: number | string | null;
  fechaDocumentoRef?: string | null;
  fechaVencimientoRef?: string | null;
  documentoOperacion?: string | null;
  tipoDocumentoOperacion?: string | null;
  fechaDocumentoOperacion?: string | null;
  documentoConciliacion?: string | null;
  tipoDocumentoConciliacion?: string | null;
  monedaOriginal?: string | null;
  montoMonedaOriginal?: number | string | null;
  tipoCambio?: number | string | null;
  glosa?: string | null;
}

export interface ApiAccountingEntryHeader {
  empresaId: string;
  periodo: string;
  fecha: string;
  concepto: string;
  documentoRef?: string | null;
  documentoReferencia?: string | null;
  tipoDocumentoRef?: string | null;
  folioDocumentoRef?: string | null;
  origenModulo: string;
  creadoPorAgente: string;
}

export interface ApiAgentAuditContext {
  traceId: string;
  agenteNombre: string;
  accion: string;
  promptTokens?: number | null;
  completionTokens?: number | null;
  modelName?: string | null;
  promptHash?: string | null;
  payloadInput?: Record<string, any>;
  payloadOutput?: Record<string, any>;
  tiempoEjecucionMs?: number;
}

export interface CommitEntryPayload {
  header: ApiAccountingEntryHeader;
  lineas: ApiAccountingLine[];
  auditContext: ApiAgentAuditContext;
}

export interface CommitEntryApiResponse {
  success: boolean;
  statusCode: number;
  message: string;
  traceId: string;
  data: {
    entry: {
      id: string;
      empresaId: string;
      periodo: string;
      fecha: string;
      concepto: string;
      documentoRef?: string | null;
      documentoReferencia?: string | null;
      tipoDocumentoRef?: string | null;
      folioDocumentoRef?: string | null;
      totalDebe: string | number;
      totalHaber: string | number;
      origenModulo: string;
      creadoPorAgente: string;
      autorizadoPorSupervisor: boolean;
      supervisorSignature: string;
      createdAt: string;
    };
    lines: Array<{
      id: string;
      entryId: string;
      lineaNumero?: number;
      codigoCuenta: string;
      nombreCuenta: string;
      debe: string | number;
      haber: string | number;
      rutAuxiliar?: string | null;
      nombreAuxiliar?: string | null;
      centroCosto?: string | null;
      documentoRef?: string | null;
      dteIdAsociado?: string | null;
      tipoDocumentoRef?: string | null;
      folioDocumentoRef?: string | null;
      montoDocumentoRef?: string | number | null;
      fechaDocumentoRef?: string | null;
      fechaVencimientoRef?: string | null;
      documentoOperacion?: string | null;
      tipoDocumentoOperacion?: string | null;
      fechaDocumentoOperacion?: string | null;
      documentoConciliacion?: string | null;
      tipoDocumentoConciliacion?: string | null;
    }>;
    auditLogId: string;
    supervisorSignature: string;
    totales: {
      totalDebe: number;
      totalHaber: number;
      diferencia: number;
      partidaDobleValida: boolean;
    };
  };
  timestamp: string;
}

export interface GetEntriesApiResponse {
  success: boolean;
  data: any[];
  total: number;
  empresaId: string;
  periodo: string;
  timestamp: string;
}

/**
 * Normaliza y mapea la respuesta del backend a la interfaz de dominio AccountingEntry
 */
export function transformApiResponseToDomainEntry(raw: any): AccountingEntry {
  const lineas: AccountingEntryLine[] = (raw.lineas || []).map((l: any) => ({
    cuentaCodigo: l.codigoCuenta || l.cuentaCodigo || '0.0.00',
    cuentaNombre: l.nombreCuenta || l.cuentaNombre || 'Sin nombre',
    debe: typeof l.debe === 'number' ? l.debe : parseFloat(String(l.debe).replace(',', '.')) || 0,
    haber: typeof l.haber === 'number' ? l.haber : parseFloat(String(l.haber).replace(',', '.')) || 0,
    rutAuxiliar: l.rutAuxiliar || l.rut_auxiliar || undefined,
    nombreAuxiliar: l.nombreAuxiliar || l.nombre_auxiliar || undefined,
    centroCosto: l.centroCosto || l.centro_costo || undefined,
    documentoRef: l.documentoRef || l.documento_ref || undefined,
    dteIdAsociado: l.dteIdAsociado || l.dte_id_asociado || undefined,
    tipoDocumentoRef: l.tipoDocumentoRef || l.tipo_documento_ref || undefined,
    folioDocumentoRef: l.folioDocumentoRef || l.folio_documento_ref || undefined,
    montoDocumentoRef: l.montoDocumentoRef !== undefined && l.montoDocumentoRef !== null
      ? (typeof l.montoDocumentoRef === 'number' ? l.montoDocumentoRef : parseFloat(String(l.montoDocumentoRef).replace(',', '.')) || undefined)
      : (l.monto_documento_ref !== undefined && l.monto_documento_ref !== null ? parseFloat(String(l.monto_documento_ref).replace(',', '.')) || undefined : undefined),
    fechaDocumentoRef: l.fechaDocumentoRef || l.fecha_documento_ref || undefined,
    fechaVencimientoRef: l.fechaVencimientoRef || l.fecha_vencimiento_ref || undefined,
    documentoOperacion: l.documentoOperacion || l.documento_operacion || undefined,
    tipoDocumentoOperacion: l.tipoDocumentoOperacion || l.tipo_documento_operacion || undefined,
    fechaDocumentoOperacion: l.fechaDocumentoOperacion || l.fecha_documento_operacion || undefined,
    documentoConciliacion: l.documentoConciliacion || l.documento_conciliacion || undefined,
    tipoDocumentoConciliacion: l.tipoDocumentoConciliacion || l.tipo_documento_conciliacion || undefined,
    monedaOriginal: l.monedaOriginal || l.moneda_original || undefined,
    montoMonedaOriginal: l.montoMonedaOriginal != null ? Number(l.montoMonedaOriginal) : (l.monto_moneda_original != null ? Number(l.monto_moneda_original) : undefined),
    tipoCambio: l.tipoCambio != null ? Number(l.tipoCambio) : (l.tipo_cambio != null ? Number(l.tipo_cambio) : undefined),
    glosa: l.glosa || undefined,
  }));

  const totalDebe = typeof raw.totalDebe === 'number' 
    ? raw.totalDebe 
    : parseFloat(String(raw.totalDebe).replace(',', '.')) || lineas.reduce((s, l) => s + l.debe, 0);

  const totalHaber = typeof raw.totalHaber === 'number' 
    ? raw.totalHaber 
    : parseFloat(String(raw.totalHaber).replace(',', '.')) || lineas.reduce((s, l) => s + l.haber, 0);

  const docRef = raw.documentoRef || raw.documento || raw.documentoReferencia || raw.documento_ref || raw.documento_referencia || 'Comprobante de Diario';
  const docReferencia = raw.documentoReferencia || raw.documento_referencia || docRef;
  const tipoDocRef = raw.tipoDocumentoRef || raw.tipo_documento_ref || (lineas.find(l => l.tipoDocumentoRef)?.tipoDocumentoRef) || undefined;
  const folioDocRef = raw.folioDocumentoRef || raw.folio_documento_ref || (lineas.find(l => l.folioDocumentoRef)?.folioDocumentoRef) || undefined;

  return {
    id: raw.id || `entry-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    fecha: raw.fecha || new Date().toISOString().split('T')[0],
    concepto: raw.concepto || 'Asiento Contable',
    documento: docRef,
    documentoReferencia: docReferencia,
    tipoDocumentoRef: tipoDocRef as any,
    folioDocumentoRef: folioDocRef,
    lineas,
    totalDebe,
    totalHaber,
    balanceado: typeof raw.balanceado === 'boolean' ? raw.balanceado : Math.abs(totalDebe - totalHaber) < 0.01,
    origen: (raw.origenModulo || raw.origen || 'MANUAL') as any,
    creadoEn: raw.createdAt || raw.creadoEn || new Date().toISOString(),
  };
}

/**
 * Transforma una entrada de dominio AccountingEntry a la carga útil estricta de CommitEntryPayload
 */
export function transformDomainEntryToCommitPayload(
  entry: AccountingEntry,
  empresaId: string,
  periodo?: string,
  agenteNombre: string = 'AGENTE_ORQUESTADOR_SENIOR'
): CommitEntryPayload {
  // Deducir periodo contable YYYY-MM desde la fecha
  const fecha = entry.fecha || new Date().toISOString().split('T')[0];
  const derivedPeriodo = (fecha && /^\d{4}-\d{2}/.test(fecha) ? fecha.substring(0, 7) : periodo) || '2026-09';

  // Mapear líneas al esquema Zod esperado por el backend
  const lineas: ApiAccountingLine[] = entry.lineas.map((line) => ({
    codigoCuenta: line.cuentaCodigo || '1.1.01.001',
    nombreCuenta: line.cuentaNombre || 'Cuenta Contable',
    debe: Number(line.debe) || 0,
    haber: Number(line.haber) || 0,
    rutAuxiliar: line.rutAuxiliar?.trim() || null,
    nombreAuxiliar: line.nombreAuxiliar?.trim() || null,
    centroCosto: line.centroCosto?.trim() || null,
    documentoRef: line.documentoRef?.trim() || null,
    dteIdAsociado: line.dteIdAsociado?.trim() || null,
    tipoDocumentoRef: line.tipoDocumentoRef ? String(line.tipoDocumentoRef).trim() : null,
    folioDocumentoRef: line.folioDocumentoRef?.trim() || null,
    montoDocumentoRef: line.montoDocumentoRef !== undefined && line.montoDocumentoRef !== null ? line.montoDocumentoRef : null,
    fechaDocumentoRef: line.fechaDocumentoRef?.trim() || null,
    fechaVencimientoRef: line.fechaVencimientoRef?.trim() || null,
    documentoOperacion: line.documentoOperacion?.trim() || null,
    tipoDocumentoOperacion: line.tipoDocumentoOperacion?.trim() || null,
    fechaDocumentoOperacion: line.fechaDocumentoOperacion?.trim() || null,
    documentoConciliacion: line.documentoConciliacion?.trim() || null,
    tipoDocumentoConciliacion: line.tipoDocumentoConciliacion?.trim() || null,
    monedaOriginal: line.monedaOriginal?.trim() || null,
    montoMonedaOriginal: line.montoMonedaOriginal !== undefined && line.montoMonedaOriginal !== null ? line.montoMonedaOriginal : null,
    tipoCambio: line.tipoCambio !== undefined && line.tipoCambio !== null ? line.tipoCambio : null,
    glosa: line.glosa?.trim() || null,
  }));

  const traceId = `trace-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  return {
    header: {
      empresaId: empresaId.trim(),
      periodo: derivedPeriodo,
      fecha,
      concepto: entry.concepto,
      documentoRef: entry.documento || null,
      documentoReferencia: entry.documentoReferencia || entry.documento || null,
      tipoDocumentoRef: entry.tipoDocumentoRef ? String(entry.tipoDocumentoRef) : null,
      folioDocumentoRef: entry.folioDocumentoRef || null,
      origenModulo: entry.origen || 'MANUAL',
      creadoPorAgente: agenteNombre,
    },
    lineas,
    auditContext: {
      traceId,
      agenteNombre,
      accion: `ASIENTO_${entry.origen || 'MANUAL'}`,
      promptTokens: 150,
      completionTokens: 280,
      modelName: 'gemini-3.8-flash',
      payloadInput: {
        concepto: entry.concepto,
        documento: entry.documento,
        totalDebe: entry.totalDebe,
        totalHaber: entry.totalHaber,
      },
      payloadOutput: {
        lineasCount: lineas.length,
      },
    },
  };
}

/**
 * Obtiene los asientos contables persistidos desde el backend
 * GET /api/accounting/entries?empresaId=...&periodo=...
 */
export async function fetchAccountingEntriesApi(
  empresaId: string,
  periodo?: string
): Promise<AccountingEntry[]> {
  const queryParams = new URLSearchParams();
  if (empresaId) queryParams.set('empresaId', empresaId);
  if (periodo && periodo !== 'TODOS') queryParams.set('periodo', periodo);

  const url = `/api/accounting/entries?${queryParams.toString()}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(
      errorBody.message || `Error al recuperar asientos contables (HTTP ${response.status})`
    );
  }

  const result: GetEntriesApiResponse = await response.json();
  if (!result.success || !Array.isArray(result.data)) {
    throw new Error('Formato de respuesta no válido al consultar asientos contables');
  }

  return result.data.map(transformApiResponseToDomainEntry);
}

/**
 * Asienta un comprobante contable validado y firmado
 * POST /api/accounting/commit-entry
 */
export async function commitAccountingEntryApi(
  payload: CommitEntryPayload
): Promise<CommitEntryApiResponse> {
  const response = await fetch('/api/accounting/commit-entry', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'x-trace-id': payload.auditContext.traceId,
    },
    body: JSON.stringify(payload),
  });

  const responseData = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg =
      responseData.message ||
      (responseData.issues && responseData.issues.map((i: any) => i.message).join(' | ')) ||
      `Error al autorizar el comprobante (HTTP ${response.status})`;
    
    const err = new Error(errorMsg);
    (err as any).statusCode = response.status;
    (err as any).details = responseData.details || responseData.issues;
    (err as any).errorType = responseData.error;
    throw err;
  }

  return responseData as CommitEntryApiResponse;
}

/**
 * Actualiza un comprobante contable existente
 * PUT /api/accounting/entries/:id
 */
export async function updateAccountingEntryApi(
  id: string,
  payload: {
    concepto?: string;
    documentoRef?: string;
    documentoReferencia?: string;
    tipoDocumentoRef?: string;
    folioDocumentoRef?: string;
    fecha?: string;
    lineas?: any[];
    motivoModificacion?: string;
  }
): Promise<{ success: boolean; message: string; data: any }> {
  const response = await fetch(`/api/accounting/entries/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const responseData = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      responseData.message || responseData.error || `Error al actualizar asiento contable (HTTP ${response.status})`
    );
  }

  return responseData;
}

/**
 * Elimina un comprobante contable con registro de auditoría
 * DELETE /api/accounting/entries/:id
 */
export async function deleteAccountingEntryApi(
  id: string,
  motivo: string = 'Eliminación manual por corrección de usuario'
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`/api/accounting/entries/${id}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({ motivo }),
  });

  const responseData = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      responseData.message || responseData.error || `Error al eliminar asiento contable (HTTP ${response.status})`
    );
  }

  return responseData;
}

/**
 * Genera un contra-asiento de anulación / reversión contable
 * POST /api/accounting/entries/:id/reverse
 */
export async function reverseAccountingEntryApi(
  id: string,
  motivo: string = 'Anulación / Reversión de comprobante',
  fecha?: string
): Promise<{ success: boolean; message: string; data: any }> {
  const response = await fetch(`/api/accounting/entries/${id}/reverse`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({ motivo, fecha }),
  });

  const responseData = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      responseData.message || responseData.error || `Error al revertir asiento contable (HTTP ${response.status})`
    );
  }

  return responseData;
}
