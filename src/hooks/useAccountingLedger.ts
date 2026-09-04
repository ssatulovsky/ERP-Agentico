import { useState, useEffect, useCallback, useRef } from 'react';
import type { AccountingEntry } from '../types';
import {
  fetchAccountingEntriesApi,
  commitAccountingEntryApi,
  transformDomainEntryToCommitPayload,
  transformApiResponseToDomainEntry,
  type CommitEntryPayload,
  type CommitEntryApiResponse,
  type ApiAgentAuditContext,
} from '../api/accountingApi';

export interface UseAccountingLedgerResult {
  /** Asientos contables persistidos y sincronizados con el Libro Mayor */
  entries: AccountingEntry[];
  /** Indica si la consulta inicial o refetch está en progreso */
  isLoading: boolean;
  /** Indica si hay un asiento en proceso de validación y firma criptográfica */
  isCommitting: boolean;
  /** Mensaje de error si la consulta o mutación falló */
  error: string | null;
  /** Limpiar el estado de error */
  clearError: () => void;
  /** Forzar recarga de los asientos contables desde el servidor */
  refetch: () => Promise<void>;
  /** Mutación canónica hacia POST /api/accounting/commit-entry */
  commitEntry: (
    payloadOrEntry: CommitEntryPayload | AccountingEntry,
    auditContextOverrides?: Partial<ApiAgentAuditContext>
  ) => Promise<CommitEntryApiResponse>;
  /** Wrapper de conveniencia compatible con (entry: AccountingEntry) => void */
  addEntry: (entry: AccountingEntry) => Promise<AccountingEntry>;
  /** Último comprobante autorizado por el Agente Supervisor */
  lastCommittedEntry: CommitEntryApiResponse['data'] | null;
}

/**
 * Hook personalizado para la gestión persistente y asíncrona del Libro Diario Contable.
 * Sustituye completamente el estado volátil useState por sincronización transaccional
 * con el backend Express y Drizzle ORM.
 */
export function useAccountingLedger(
  empresaId: string,
  periodo?: string
): UseAccountingLedgerResult {
  const [entries, setEntries] = useState<AccountingEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isCommitting, setIsCommitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCommittedEntry, setLastCommittedEntry] = useState<CommitEntryApiResponse['data'] | null>(null);

  // Referencia para evitar carreras asíncronas en componentes desmontados o cambios rápidos de empresa
  const activeEmpresaRef = useRef(empresaId);
  const activePeriodoRef = useRef(periodo);

  useEffect(() => {
    activeEmpresaRef.current = empresaId;
    activePeriodoRef.current = periodo;
  }, [empresaId, periodo]);

  /**
   * Carga los asientos contables desde la API REST
   */
  const loadEntries = useCallback(async (isInitial = false) => {
    if (!empresaId) return;

    if (isInitial) {
      setIsLoading(true);
    }
    setError(null);

    try {
      const data = await fetchAccountingEntriesApi(empresaId, periodo);
      // Evitar sobreescrituras si el usuario cambió de empresa durante la petición
      if (activeEmpresaRef.current === empresaId && activePeriodoRef.current === periodo) {
        setEntries(data);
      }
    } catch (err: any) {
      console.error('[useAccountingLedger] Error al consultar asientos:', err);
      if (activeEmpresaRef.current === empresaId) {
        setError(err?.message || 'Error al conectar con el servidor contable');
      }
    } finally {
      if (activeEmpresaRef.current === empresaId) {
        setIsLoading(false);
      }
    }
  }, [empresaId, periodo]);

  // Carga inicial y recarga al cambiar empresaId o periodo
  useEffect(() => {
    loadEntries(true);
  }, [loadEntries]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const refetch = useCallback(async () => {
    await loadEntries(false);
  }, [loadEntries]);

  /**
   * Mutación transaccional: valida partida doble, sella con HMAC y persiste en Drizzle
   */
  const commitEntry = useCallback(
    async (
      payloadOrEntry: CommitEntryPayload | AccountingEntry,
      auditContextOverrides?: Partial<ApiAgentAuditContext>
    ): Promise<CommitEntryApiResponse> => {
      setIsCommitting(true);
      setError(null);

      let payload: CommitEntryPayload;
      let optimisticDomainEntry: AccountingEntry;

      // Verificar si se pasó un AccountingEntry directo o un CommitEntryPayload formal
      if ('header' in payloadOrEntry && 'lineas' in payloadOrEntry && 'auditContext' in payloadOrEntry) {
        payload = payloadOrEntry as CommitEntryPayload;
        optimisticDomainEntry = transformApiResponseToDomainEntry({
          id: `opt-${Date.now()}`,
          ...payload.header,
          lineas: payload.lineas,
          createdAt: new Date().toISOString(),
          autorizadoPorSupervisor: false,
        });
      } else {
        const domainEntry = payloadOrEntry as AccountingEntry;
        payload = transformDomainEntryToCommitPayload(
          domainEntry,
          empresaId,
          periodo,
          auditContextOverrides?.agenteNombre || 'AGENTE_ORQUESTADOR_SENIOR'
        );
        if (auditContextOverrides) {
          payload.auditContext = {
            ...payload.auditContext,
            ...auditContextOverrides,
          };
        }
        optimisticDomainEntry = domainEntry;
      }

      // 1. Mutación Optimista en el estado local de la UI
      setEntries((prev) => [optimisticDomainEntry, ...prev]);

      try {
        // 2. Ejecutar transacción atómica en el backend
        const response = await commitAccountingEntryApi(payload);

        // 3. Reemplazar entrada optimista por la entidad real sellada criptográficamente
        const realEntry = transformApiResponseToDomainEntry({
          ...response.data.entry,
          lineas: response.data.lines,
          supervisorSignature: response.data.supervisorSignature,
          autorizadoPorSupervisor: true,
        });

        setEntries((prev) =>
          prev.map((item) => (item.id === optimisticDomainEntry.id ? realEntry : item))
        );

        setLastCommittedEntry(response.data);
        return response;
      } catch (err: any) {
        // 4. Rollback de la mutación optimista en caso de fallo o descuadre
        setEntries((prev) => prev.filter((item) => item.id !== optimisticDomainEntry.id));
        const errorMessage = err?.message || 'Error al autorizar el asiento contable';
        setError(errorMessage);
        console.error('[useAccountingLedger] Fallo en commitEntry:', err);
        throw err;
      } finally {
        setIsCommitting(false);
      }
    },
    [empresaId, periodo]
  );

  /**
   * Wrapper ergonómico para sustituir onAddEntry sin cambiar las firmas de componentes
   */
  const addEntry = useCallback(
    async (entry: AccountingEntry): Promise<AccountingEntry> => {
      const response = await commitEntry(entry);
      return transformApiResponseToDomainEntry({
        ...response.data.entry,
        lineas: response.data.lines,
        supervisorSignature: response.data.supervisorSignature,
        autorizadoPorSupervisor: true,
      });
    },
    [commitEntry]
  );

  return {
    entries,
    isLoading,
    isCommitting,
    error,
    clearError,
    refetch,
    commitEntry,
    addEntry,
    lastCommittedEntry,
  };
}
