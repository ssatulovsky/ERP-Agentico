import { ExpenseReport, ExpenseItem, ExpenseProject, ScannedReceiptResult } from '../types';

/**
 * SERVICIO CLIENTE DE COMUNICACIÓN CON LA BASE DE DATOS MYSQL 8.0
 * MÓDULO RENDICIÓN DE GASTOS ("RINDE GASTOS AI")
 * ============================================================================
 * Conecta los componentes visuales con los endpoints REST reales en /api/expenses:
 * - Persistencia directa en tablas MySQL 8.0: expense_reports, expense_items, expense_projects.
 * - Sin mocks estáticos; sincronización bidireccional continua.
 */

export interface ExpenseDbStatus {
  isRealMysqlConnected: boolean;
  tables: {
    expense_reports: boolean;
    expense_items: boolean;
    expense_projects: boolean;
  };
  counts: {
    reports: number;
    items: number;
    projects: number;
  };
  host: string;
  database: string;
}

export const expenseApiService = {
  /**
   * Consulta el estado real de la base de datos MySQL 8.0 (conexión y tablas)
   */
  async getDbStatus(): Promise<ExpenseDbStatus | null> {
    try {
      const res = await fetch('/api/expenses/db-status');
      if (!res.ok) return null;
      const data = await res.json();
      return data;
    } catch (err) {
      console.warn('[ExpenseApiService] No se pudo consultar db-status:', err);
      return null;
    }
  },

  /**
   * Obtiene las rendiciones reales desde MySQL 8.0 para la empresa activa
   */
  async getExpenseReports(empresaId: string): Promise<ExpenseReport[]> {
    try {
      const res = await fetch(`/api/expenses/reports?empresaId=${encodeURIComponent(empresaId)}`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        return json.data;
      }
      return [];
    } catch (err) {
      console.error('[ExpenseApiService] Error al consultar rendiciones desde MySQL 8.0:', err);
      return [];
    }
  },

  /**
   * Registra una nueva rendición de gastos en MySQL 8.0
   */
  async createExpenseReport(
    report: Omit<ExpenseReport, 'id' | 'createdAt' | 'updatedAt' | 'comprobantes'>
  ): Promise<ExpenseReport | null> {
    try {
      const res = await fetch('/api/expenses/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const json = await res.json();
      if (json.success && json.data) {
        return json.data;
      }
      return null;
    } catch (err) {
      console.error('[ExpenseApiService] Error al crear rendición en MySQL 8.0:', err);
      return null;
    }
  },

  /**
   * Actualiza el estado de una rendición (Workflow de Aprobación en MySQL 8.0)
   */
  async updateReportStatus(
    reportId: string,
    estado: ExpenseReport['estado'],
    observacionesAprobador?: string,
    aprobadorNombre?: string
  ): Promise<boolean> {
    try {
      const res = await fetch(`/api/expenses/reports/${encodeURIComponent(reportId)}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estado,
          observacionesAprobador,
          aprobadorNombre,
        }),
      });
      if (!res.ok) return false;
      const json = await res.json();
      return json.success === true;
    } catch (err) {
      console.error('[ExpenseApiService] Error al actualizar estado de rendición:', err);
      return false;
    }
  },

  /**
   * Registra un comprobante / gasto digital en MySQL 8.0
   */
  async addExpenseItem(
    reportId: string,
    item: Omit<ExpenseItem, 'id' | 'createdAt'>
  ): Promise<ExpenseItem | null> {
    try {
      const res = await fetch(`/api/expenses/reports/${encodeURIComponent(reportId)}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const json = await res.json();
      if (json.success && json.data) {
        return json.data;
      }
      return null;
    } catch (err) {
      console.error('[ExpenseApiService] Error al agregar comprobante en MySQL 8.0:', err);
      return null;
    }
  },

  /**
   * Elimina un comprobante en MySQL 8.0
   */
  async deleteExpenseItem(itemId: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/expenses/items/${encodeURIComponent(itemId)}`, {
        method: 'DELETE',
      });
      if (!res.ok) return false;
      const json = await res.json();
      return json.success === true;
    } catch (err) {
      console.error('[ExpenseApiService] Error al eliminar comprobante en MySQL 8.0:', err);
      return false;
    }
  },

  /**
   * Obtiene los proyectos vigentes desde MySQL 8.0
   */
  async getExpenseProjects(empresaId: string): Promise<ExpenseProject[]> {
    try {
      const res = await fetch(`/api/expenses/projects?empresaId=${encodeURIComponent(empresaId)}`);
      if (!res.ok) return [];
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        return json.data;
      }
      return [];
    } catch (err) {
      console.error('[ExpenseApiService] Error al obtener proyectos desde MySQL 8.0:', err);
      return [];
    }
  },

  /**
   * Crea un nuevo proyecto en MySQL 8.0
   */
  async createExpenseProject(project: Omit<ExpenseProject, 'id'>): Promise<ExpenseProject | null> {
    try {
      const res = await fetch('/api/expenses/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(project),
      });
      if (!res.ok) return null;
      const json = await res.json();
      return json.data || null;
    } catch (err) {
      console.error('[ExpenseApiService] Error al crear proyecto:', err);
      return null;
    }
  },

  /**
   * Contabiliza formalmente una rendición de gastos en el Libro Diario
   */
  async contabilizarReport(
    reportId: string,
    periodo?: string,
    fechaContabilizacion?: string
  ): Promise<{ success: boolean; asientoContableId?: string; error?: string }> {
    try {
      const res = await fetch(`/api/expenses/reports/${encodeURIComponent(reportId)}/contabilizar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodo, fechaContabilizacion }),
      });
      const json = await res.json();
      return json;
    } catch (err: any) {
      console.error('[ExpenseApiService] Error al contabilizar rendición:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Escanea y extrae datos de una foto de comprobante utilizando IA (Gemini 3.8 Flash Vision)
   */
  async scanReceiptWithAI(
    imageBase64: string,
    mimeType: string = 'image/jpeg',
    fileName?: string,
    empresaId?: string
  ): Promise<{ success: boolean; data?: ScannedReceiptResult; previewBase64?: string; error?: string }> {
    try {
      const res = await fetch('/api/expenses/scan-receipt-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64,
          mimeType,
          fileName,
          empresaId,
        }),
      });
      const json = await res.json();
      return json;
    } catch (err: any) {
      console.error('[ExpenseApiService] Error al escanear comprobante con IA:', err);
      return { success: false, error: err.message };
    }
  },
};
