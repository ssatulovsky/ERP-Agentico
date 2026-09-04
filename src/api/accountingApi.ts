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
  centroCosto?: string | null;
}

export interface ApiAccountingEntryHeader {
  empresaId: string;
  periodo: string;
  fecha: string;
  concepto: string;
  documentoRef?: string | null;
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
      codigoCuenta: string;
      nombreCuenta: string;
      debe: string | number;
      haber: string | number;
      rutAuxiliar?: string | null;
      centroCosto?: string | null;
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
  }));

  const totalDebe = typeof raw.totalDebe === 'number' 
    ? raw.totalDebe 
    : parseFloat(String(raw.totalDebe).replace(',', '.')) || lineas.reduce((s, l) => s + l.debe, 0);

  const totalHaber = typeof raw.totalHaber === 'number' 
    ? raw.totalHaber 
    : parseFloat(String(raw.totalHaber).replace(',', '.')) || lineas.reduce((s, l) => s + l.haber, 0);

  return {
    id: raw.id || `entry-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    fecha: raw.fecha || new Date().toISOString().split('T')[0],
    concepto: raw.concepto || 'Asiento Contable',
    documento: raw.documentoRef || raw.documento || 'Comprobante de Diario',
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
  const derivedPeriodo = periodo || (fecha.length >= 7 ? fecha.substring(0, 7) : '2026-09');

  // Mapear líneas al esquema Zod esperado por el backend
  const lineas: ApiAccountingLine[] = entry.lineas.map((line) => ({
    codigoCuenta: line.cuentaCodigo || '1.1.01.001',
    nombreCuenta: line.cuentaNombre || 'Cuenta Contable',
    debe: Number(line.debe) || 0,
    haber: Number(line.haber) || 0,
    rutAuxiliar: null,
    centroCosto: null,
  }));

  const traceId = `trace-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  return {
    header: {
      empresaId: empresaId.trim(),
      periodo: derivedPeriodo,
      fecha,
      concepto: entry.concepto,
      documentoRef: entry.documento || null,
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
