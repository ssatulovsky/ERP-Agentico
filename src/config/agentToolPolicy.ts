/**
 * 3.1 Herramientas por agente (plan de corrección, fase 3).
 *
 * Cada agente de módulo declara la lista cerrada de herramientas que puede usar.
 * El motor solo envía esas declaraciones al modelo y rechaza cualquier otra en la
 * ejecución (TOOL_NOT_ALLOWED), aunque el modelo o un cliente la pida por nombre.
 *
 * Este archivo no importa servicios: lo consumen el registro de agentes, el motor
 * y el planificador sin crear dependencias circulares.
 */

export const SUBMIT_APPROVAL_TOOL = 'tool_submit_governance_approval';

export const AGENT_TOOL_POLICY: Record<string, readonly string[]> = {
  CONTABILIDAD: [
    'tool_accounting_propose_entry',
    'tool_sii_query_rcv',
    'tool_sii_reconcile_rcv_vs_ledger',
    SUBMIT_APPROVAL_TOOL,
  ],
  TRIBUTARIO_SII: [
    'tool_sii_query_rcv',
    'tool_tax_calculate_f29',
    'tool_sii_sync_status',
    'tool_sii_ingest_csv',
    'tool_sii_reconcile_rcv_vs_ledger',
    'tool_accounting_propose_entry',
    SUBMIT_APPROVAL_TOOL,
  ],
  FACTURACION_DTE: [
    'tool_billing_draft_dte',
    'tool_sii_sync_status',
    SUBMIT_APPROVAL_TOOL,
  ],
  TESORERIA: [
    'tool_bank_reconcile_movement',
    'tool_cashflow_project_30_60_90',
    'tool_cashflow_simulate_scenario',
    'tool_accounting_propose_entry',
    SUBMIT_APPROVAL_TOOL,
  ],
  COMERCIAL_COMPRAS: [
    'tool_procurement_margin_analysis',
    'tool_procurement_create_rfq',
    'tool_procurement_compare_quotes',
    'tool_procurement_award_purchase_order',
    'tool_inventory_kardex',
    SUBMIT_APPROVAL_TOOL,
  ],
  RRHH: [
    'tool_hr_calculate_finiquito',
    'tool_hr_calculate_payroll',
    'tool_accounting_propose_entry',
    SUBMIT_APPROVAL_TOOL,
  ],
  INVENTARIO: [
    'tool_inventory_kardex',
    'tool_procurement_create_rfq',
    'tool_procurement_margin_analysis',
    SUBMIT_APPROVAL_TOOL,
  ],
  ACTIVO_FIJO: [
    'tool_fixed_assets_depreciate_period',
    'tool_fixed_assets_propose_entry',
    'tool_fixed_assets_propose_writeoff',
    'tool_accounting_propose_entry',
    SUBMIT_APPROVAL_TOOL,
  ],
  FLUJO_CAJA: [
    'tool_cashflow_project_30_60_90',
    'tool_cashflow_simulate_scenario',
    SUBMIT_APPROVAL_TOOL,
  ],
  COSTOS_PRODUCCION: [
    'tool_production_cost_order',
    'tool_production_variance_standard_vs_real',
    'tool_production_propose_closure_entry',
    'tool_inventory_kardex',
    SUBMIT_APPROVAL_TOOL,
  ],
  CONCILIACION: [
    'tool_bank_reconcile_movement',
    'tool_accounting_propose_entry',
    SUBMIT_APPROVAL_TOOL,
  ],
  RENDICIONES: [
    'tool_expenses_validate_report',
    'tool_expenses_propose_entry',
    'tool_accounting_propose_entry',
    SUBMIT_APPROVAL_TOOL,
  ],
};

export function normalizeModuleId(moduleId: string | undefined | null): string {
  return String(moduleId || '').trim().toUpperCase();
}

export function isKnownAgentModule(moduleId: string | undefined | null): boolean {
  return Object.prototype.hasOwnProperty.call(AGENT_TOOL_POLICY, normalizeModuleId(moduleId));
}

/** Herramientas permitidas para el módulo. Un módulo desconocido no tiene ninguna. */
export function getAllowedTools(moduleId: string | undefined | null): readonly string[] {
  return AGENT_TOOL_POLICY[normalizeModuleId(moduleId)] || [];
}

export function isToolAllowedForModule(moduleId: string | undefined | null, toolName: string): boolean {
  return getAllowedTools(moduleId).includes(toolName);
}

/** Módulos que sí tienen la herramienta, para orientar al usuario cuando se rechaza. */
export function modulesWithTool(toolName: string): string[] {
  return Object.entries(AGENT_TOOL_POLICY)
    .filter(([, tools]) => tools.includes(toolName))
    .map(([mod]) => mod);
}

export function toolNotAllowedResult(moduleId: string, toolName: string): Record<string, any> {
  const otros = modulesWithTool(toolName);
  return {
    status: 'TOOL_NOT_ALLOWED',
    herramienta: toolName,
    modulo: normalizeModuleId(moduleId),
    modulosAutorizados: otros,
    mensaje: otros.length
      ? `El agente del módulo ${normalizeModuleId(moduleId)} no tiene autorizada la herramienta ${toolName}. Corresponde a: ${otros.join(', ')}.`
      : `La herramienta ${toolName} no está autorizada para ningún agente.`,
  };
}
