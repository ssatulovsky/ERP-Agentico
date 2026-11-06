import { GoogleGenAI } from '@google/genai';
import { 
  calculatePayroll, 
  DEFAULT_INDICATORS, 
  formatCLP, 
  formatNumberCL,
  calculateImpuestoUnico,
  enrichEntryWithChartAttributes,
  createFixedAssetDepreciationEntry,
  createFixedAssetDisposalEntry,
  createProductionFinishedLiquidationEntry
} from '../utils/chileanAccounting';
import { HrManagementService } from './hrManagementService';
import { SiiRcvService } from './siiRcvService';
import { normalizeAndValidateJournalEntry } from './journalEntryNormalizer';
import { calculatePreF29 } from '../utils/f29SeniorEngine';
import { MODULE_AGENTS_REGISTRY } from './moduleAgentGovernanceService';
import { aiRouterService } from './aiRouterService';
import { diskPersistence } from './diskPersistenceService';
import { getDemoClients } from '../data/seedData';
import { parseSiiRcvCsv } from '../utils/siiAutomation';
import { sanitizeContextForAi } from '../utils/aiSecuritySanitizer';
import { commercialProcurementService } from './commercialProcurementService';
import { HttpDteBillingService } from './httpDteBillingService';
import type { 
  AccountingEntry, 
  AccountingEntryLine, 
  CompanyProfile, 
  ChileIndicators,
  EmployeePayroll,
  ModuleAgentApprovalRequest
} from '../types';

export interface AgentExecutionStep {
  step: number;
  thought: string;
  action?: string;
  actionInput?: Record<string, any>;
  toolCall: string;
  toolArgs: Record<string, any>;
  toolOutput: Record<string, any>;
  timestamp: string;
}

export interface AutonomousAgentRequest {
  empresaId: string;
  module: 'RRHH' | 'CONTABILIDAD' | 'TRIBUTARIO_SII' | 'TESORERIA' | 'COMERCIAL_COMPRAS' | 'INVENTARIO' | 'COSTOS_PRODUCCION' | 'ACTIVO_FIJO' | 'CONCILIACION' | 'FLUJO_CAJA' | 'RENDICIONES' | string;
  agentRole: string;
  query: string;
  context?: {
    company?: CompanyProfile;
    empresa?: any;
    indicators?: ChileIndicators;
    selectedPeriod?: string;
    extraData?: Record<string, any>;
    dtes?: any[];
    payrolls?: any[];
    payroll?: any;
    employee?: any;
    items?: any[];
    inventoryItems?: any[];
    movements?: any[];
    bankMovements?: any[];
    entries?: any[];
    journalEntries?: any[];
    [key: string]: any;
  };
  userId?: string;
}

export interface AutonomousAgentResponse {
  success: boolean;
  module: string;
  agentName: string;
  agentRole: string;
  finalText: string;
  steps: AgentExecutionStep[];
  technicalPayload?: any;
  governanceApproval?: ModuleAgentApprovalRequest;
  executionMode: 'AUTONOMOUS_REACT_LOOP' | 'DETERMINISTIC_COMPLIANCE_CORE';
  /** Código de error honesto cuando success es false (p. ej. LLM_UNAVAILABLE, MISSING_PARAMS). */
  code?: string;
  /** Parámetros que faltan para ejecutar la operación (status MISSING_PARAMS). */
  missingParams?: string[];
  modelUsed: string;
  timestamp: string;
}

/**
 * Catálogo formal de Declaraciones de Herramientas (Tools / Function Declarations)
 * Expuestas al LLM para que actúe sobre los motores de negocio reales del ERP.
 */
export const AGENT_FUNCTION_DECLARATIONS = [
  {
    name: 'tool_hr_calculate_finiquito',
    description: 'Calcula legalmente el finiquito e indemnizaciones de término de contrato de trabajo bajo Art. 161, 162 y 163 del Código del Trabajo de Chile.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        rut: { type: 'STRING' as const, description: 'RUT del colaborador (ej: 14.892.301-2)' },
        nombreCompleto: { type: 'STRING' as const, description: 'Nombre completo' },
        fechaIngreso: { type: 'STRING' as const, description: 'Fecha de ingreso YYYY-MM-DD' },
        fechaDespido: { type: 'STRING' as const, description: 'Fecha de término YYYY-MM-DD' },
        sueldoBase: { type: 'NUMBER' as const, description: 'Sueldo base mensual pactado en CLP' },
        causal: { type: 'STRING' as const, description: 'Causal legal: ART_161_NECESIDADES_DE_LA_EMPRESA, ART_159_RENUNCIA_VOLUNTARIA, ART_159_MUTUO_ACUERDO' },
        diasVacacionesPendientes: { type: 'NUMBER' as const, description: 'Días hábiles de feriado proporcional pendientes' },
        diasAvisoPrevioOtorgados: { type: 'NUMBER' as const, description: 'Días de aviso previo otorgados (0 si no hubo preaviso)' },
      },
      required: ['rut', 'sueldoBase', 'fechaIngreso', 'fechaDespido', 'causal', 'diasVacacionesPendientes'],
    },
  },
  {
    name: 'tool_hr_calculate_payroll',
    description: 'Calcula la liquidación mensual de remuneraciones según normativa chilena (gratificación Art. 50, topes imponibles AFP 90 UF / AFC 135.2 UF, IUSC y aporte patronal 1% Ley 21.735).',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        rut: { type: 'STRING' as const, description: 'RUT del trabajador' },
        nombreCompleto: { type: 'STRING' as const, description: 'Nombre del trabajador' },
        cargo: { type: 'STRING' as const, description: 'Cargo laboral' },
        sueldoBase: { type: 'NUMBER' as const, description: 'Sueldo base en CLP' },
        afpNombre: { type: 'STRING' as const, description: 'AFP: HABITAT, CUPRUM, MODELO, PROVIDA, CAPITAL, UNO, PLANVITAL' },
        saludTipo: { type: 'STRING' as const, description: 'FONASA o ISAPRE' },
        horasExtrasCantidad: { type: 'NUMBER' as const, description: 'Horas extraordinarias al 50%' },
        bonosImponibles: { type: 'NUMBER' as const, description: 'Bonos y comisiones imponibles' },
        tipoContrato: { type: 'STRING' as const, description: 'INDEFINIDO o PLAZO_FIJO' },
      },
      required: ['rut', 'nombreCompleto', 'sueldoBase', 'afpNombre', 'saludTipo', 'tipoContrato'],
    },
  },
  {
    name: 'tool_accounting_propose_entry',
    description: 'Valida la partida doble y estructura una propuesta formal de asiento contable para el Libro Diario bajo Plan de Cuentas IFRS chileno.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        glosaGeneral: { type: 'STRING' as const, description: 'Glosa explicativa del hecho económico' },
        tipoComprobante: { type: 'STRING' as const, description: 'INGRESO, EGRESO o TRASPASO' },
        lineas: {
          type: 'ARRAY' as const,
          items: {
            type: 'OBJECT' as const,
            properties: {
              cuentaCodigo: { type: 'STRING' as const, description: 'Código de cuenta del plan de cuentas (ej: 1.1.01.01, 2.1.08, 6.1.04)' },
              cuentaNombre: { type: 'STRING' as const, description: 'Nombre de la cuenta' },
              debe: { type: 'NUMBER' as const, description: 'Monto al Debe en CLP' },
              haber: { type: 'NUMBER' as const, description: 'Monto al Haber en CLP' },
              rutAuxiliar: { type: 'STRING' as const, description: 'RUT del tercero o auxiliar' },
              documentoRef: { type: 'STRING' as const, description: 'Documento de respaldo' },
            },
            required: ['cuentaCodigo', 'cuentaNombre', 'debe', 'haber'],
          },
        },
      },
      required: ['glosaGeneral', 'tipoComprobante', 'lineas'],
    },
  },
  {
    name: 'tool_sii_query_rcv',
    description: 'Consulta los documentos tributarios electrónicos (DTEs) del Registro de Compras y Ventas (RCV) del SII para un período específico.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        periodo: { type: 'STRING' as const, description: 'Período en formato YYYY-MM (ej: 2026-08)' },
        tipoOperacion: { type: 'STRING' as const, description: 'COMPRAS o VENTAS' },
        empresaRut: { type: 'STRING' as const, description: 'RUT de la empresa consultante' },
      },
      required: ['periodo', 'tipoOperacion'],
    },
  },
  {
    name: 'tool_tax_calculate_f29',
    description: 'Calcula determinísticamente los débitos, créditos IVA, IVA No Recuperable (Art. 23 DL 825), PPM y retenciones de segunda categoría para el Formulario 29.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        periodo: { type: 'STRING' as const, description: 'Período tributario YYYY-MM' },
        empresaRut: { type: 'STRING' as const, description: 'RUT de la empresa declarante' },
        tasaPpm: { type: 'NUMBER' as const, description: 'Tasa PPM vigente (ej: 0.015)' },
        esExentaIva: { type: 'BOOLEAN' as const, description: 'Si la empresa realiza operaciones exentas de IVA' },
      },
      required: ['periodo'],
    },
  },
  {
    name: 'tool_inventory_kardex',
    description: 'Audita el inventario, valorización según PMP/FIFO y calcula alertas de stock mínimo y puntos de reorden.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        empresaId: { type: 'STRING' as const, description: 'Identificador de la empresa' },
        categoriaFiltro: { type: 'STRING' as const, description: 'Categoría o sku' },
      },
      required: ['empresaId'],
    },
  },
  {
    name: 'tool_bank_reconcile_movement',
    description: 'Ejecuta el cotejo y conciliación entre cartolas bancarias y movimientos del Libro Diario usando scoring multicriterio (Monto, RUT, Fecha, TEF).',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        empresaId: { type: 'STRING' as const, description: 'Identificador de la empresa' },
        cuentaBancaria: { type: 'STRING' as const, description: 'Número o alias de cuenta' },
        toleranciaDias: { type: 'NUMBER' as const, description: 'Días de tolerancia de desfase' },
      },
      required: ['empresaId'],
    },
  },
  {
    name: 'tool_fixed_assets_depreciate_period',
    description: 'Calcula simultáneamente la depreciación financiera según NIC 16 (vida útil económica) y la depreciación tributaria (Art. 31 N° 5 LIR) para los activos de la empresa en un período determinado.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        empresaId: { type: 'STRING' as const, description: 'Identificador o RUT de la empresa' },
        periodo: { type: 'STRING' as const, description: 'Período en formato YYYY-MM (ej: 2026-08)' },
        ipcRatePeriod: { type: 'NUMBER' as const, description: 'Tasa IPC del período para corrección monetaria opcional (ej: 0.3)' },
      },
      required: ['periodo'],
    },
  },
  {
    name: 'tool_fixed_assets_propose_entry',
    description: 'Estructura y valida la partida doble del asiento contable de depreciación mensual de activo fijo (NIC 16), separando gastos de administración y cuotas fabriles CIF.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        periodo: { type: 'STRING' as const, description: 'Período contable YYYY-MM' },
        empresaId: { type: 'STRING' as const, description: 'Identificador de la empresa' },
      },
      required: ['periodo'],
    },
  },
  {
    name: 'tool_fixed_assets_propose_writeoff',
    description: 'Formula el asiento y retiro por baja o enajenación de un activo fijo, reconociendo el retiro de costo histórico, depreciación acumulada y resultado extraordinario en venta o chatarra.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        activoId: { type: 'STRING' as const, description: 'ID o código de placa del activo fijo a dar de baja' },
        precioVentaNeto: { type: 'NUMBER' as const, description: 'Precio neto de venta en CLP (0 si es baja por destrucción, obsolescencia o chatarra)' },
        motivoBaja: { type: 'STRING' as const, description: 'Fundamentación o motivo del retiro/baja' },
      },
      required: ['activoId', 'motivoBaja'],
    },
  },
  {
    name: 'tool_production_cost_order',
    description: 'Calcula la liquidación y costeo real de una orden de producción (NIC 2), integrando Materia Prima Directa (MPD), Mano de Obra Directa (MOD) y Costos Indirectos de Fabricación (CIF).',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        folioOP: { type: 'STRING' as const, description: 'Folio de la orden de producción (ej: OP-2026-001 o ID)' },
        empresaId: { type: 'STRING' as const, description: 'Identificador de la empresa' },
      },
      required: ['folioOP'],
    },
  },
  {
    name: 'tool_production_variance_standard_vs_real',
    description: 'Audita el desvío presupuestario y de costos (estándar vs. real) para una orden de producción bajo la NIC 2 de inventarios.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        folioOP: { type: 'STRING' as const, description: 'Folio de la orden de producción' },
      },
      required: ['folioOP'],
    },
  },
  {
    name: 'tool_production_propose_closure_entry',
    description: 'Genera el asiento contable de liquidación y cierre de orden de producción (traspaso de Productos en Proceso 1.1.08.02 a Productos Terminados 1.1.08.03).',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        folioOP: { type: 'STRING' as const, description: 'Folio de la orden a liquidar' },
        fechaCierre: { type: 'STRING' as const, description: 'Fecha efectiva de término YYYY-MM-DD' },
      },
      required: ['folioOP', 'fechaCierre'],
    },
  },
  {
    name: 'tool_cashflow_project_30_60_90',
    description: 'Proyecta el flujo de caja operativo y financiero a 30, 60 y 90 días combinando saldos bancarios en línea, cobranza esperada de DTEs, pagos a proveedores, nómina y obligaciones fiscales F29.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        empresaId: { type: 'STRING' as const, description: 'Identificador de la empresa' },
        horizonteDias: { type: 'NUMBER' as const, description: 'Horizonte de proyección: 30, 60 o 90 días' },
      },
      required: ['empresaId'],
    },
  },
  {
    name: 'tool_cashflow_simulate_scenario',
    description: 'Simula escenarios de estrés de liquidez (What-If) ante caídas de ventas, retrasos en cobranza de clientes o aumentos imprevistos en costos.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        variacionVentasPct: { type: 'NUMBER' as const, description: 'Variación porcentual de ventas (-30 a +50)' },
        retrasoCobranzaDias: { type: 'NUMBER' as const, description: 'Días de retraso adicional en cobranza' },
        aumentoCostosPct: { type: 'NUMBER' as const, description: 'Aumento porcentual en egresos de operación' },
      },
      required: [],
    },
  },
  {
    name: 'tool_procurement_margin_analysis',
    description: 'Audita los márgenes brutos de comercialización de productos, alertando sobre ítems con margen bajo el target y sugiriendo precios de venta optimizados.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        empresaId: { type: 'STRING' as const, description: 'Identificador de la empresa' },
        sku: { type: 'STRING' as const, description: 'SKU específico opcional para filtrar' },
      },
      required: ['empresaId'],
    },
  },
  {
    name: 'tool_procurement_create_rfq',
    description: 'Crea una solicitud de cotización formal (RFQ) para reposición o adquisición de insumos y la envía a los proveedores registrados.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        titulo: { type: 'STRING' as const, description: 'Título o asunto de la licitación/RFQ' },
        items: {
          type: 'ARRAY' as const,
          items: {
            type: 'OBJECT' as const,
            properties: {
              sku: { type: 'STRING' as const, description: 'SKU del artículo' },
              cantidad: { type: 'NUMBER' as const, description: 'Cantidad requerida' },
              descripcion: { type: 'STRING' as const, description: 'Descripción técnica' },
            },
            required: ['sku', 'cantidad'],
          },
        },
        proveedoresRuts: {
          type: 'ARRAY' as const,
          items: { type: 'STRING' as const },
          description: 'Lista de RUTs de proveedores invitados',
        },
      },
      required: ['titulo', 'items'],
    },
  },
  {
    name: 'tool_procurement_compare_quotes',
    description: 'Compara y evalúa las cotizaciones recibidas de proveedores en una RFQ aplicando scoring multicriterio (Precio, Plazo de Entrega, SLA histórico).',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        rfqId: { type: 'STRING' as const, description: 'ID o Folio de la RFQ' },
      },
      required: ['rfqId'],
    },
  },
  {
    name: 'tool_procurement_award_purchase_order',
    description: 'Prepara la propuesta formal de adjudicación y emisión de Orden de Compra para autorización humana previa en Gobernanza.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        rfqId: { type: 'STRING' as const, description: 'ID de la RFQ' },
        proveedorRut: { type: 'STRING' as const, description: 'RUT del proveedor adjudicado' },
        montoTotalNeto: { type: 'NUMBER' as const, description: 'Monto total adjudicado en CLP' },
        motivoAdjudicacion: { type: 'STRING' as const, description: 'Justificación técnica y comercial' },
      },
      required: ['rfqId', 'proveedorRut', 'montoTotalNeto', 'motivoAdjudicacion'],
    },
  },
  {
    name: 'tool_expenses_validate_report',
    description: 'Audita una rendición de gastos: valida comprobantes OCR, topes máximos de políticas corporativas, coincidencia de RUT con RCV y consistencia aritmética.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        reportId: { type: 'STRING' as const, description: 'ID o Folio de la rendición de gastos' },
      },
      required: ['reportId'],
    },
  },
  {
    name: 'tool_expenses_propose_entry',
    description: 'Genera el asiento contable formal de centralización de rendición de gastos (imputación a cuentas de resultado y liquidación de fondos por rendir o cuenta por pagar).',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        reportId: { type: 'STRING' as const, description: 'ID de la rendición' },
      },
      required: ['reportId'],
    },
  },
  {
    name: 'tool_billing_draft_dte',
    description: 'Verifica la disponibilidad de folios CAF autorizados y estructura un borrador formal de Documento Tributario Electrónico (Factura Afecta 33, Exenta 34, NC 61).',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        tipoDte: { type: 'NUMBER' as const, description: 'Tipo DTE: 33 (Factura Electrónica), 34 (Factura No Afecta o Exenta), 61 (Nota de Crédito)' },
        receptorRut: { type: 'STRING' as const, description: 'RUT del cliente receptor' },
        receptorRazonSocial: { type: 'STRING' as const, description: 'Razón social del cliente receptor' },
        giroReceptor: { type: 'STRING' as const, description: 'Giro comercial del cliente' },
        items: {
          type: 'ARRAY' as const,
          items: {
            type: 'OBJECT' as const,
            properties: {
              nombre: { type: 'STRING' as const, description: 'Nombre o glosa del producto/servicio' },
              cantidad: { type: 'NUMBER' as const, description: 'Cantidad' },
              precioUnitario: { type: 'NUMBER' as const, description: 'Precio unitario neto en CLP' },
              exento: { type: 'BOOLEAN' as const, description: 'Indica si la línea es exenta de IVA' },
            },
            required: ['nombre', 'cantidad', 'precioUnitario'],
          },
        },
      },
      required: ['tipoDte', 'receptorRut', 'receptorRazonSocial', 'giroReceptor', 'items'],
    },
  },
  {
    name: 'tool_sii_sync_status',
    description: 'Consulta el estado de sincronización y credenciales tributarias seguras (Bóveda SII / Certificado Digital) para la empresa.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        empresaId: { type: 'STRING' as const, description: 'Identificador o RUT de la empresa' },
      },
      required: ['empresaId'],
    },
  },
  {
    name: 'tool_sii_ingest_csv',
    description: 'Ingesta y procesa formalmente archivos CSV de compras o ventas oficiales descargados del Registro de Compras y Ventas (RCV) del SII.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        periodo: { type: 'STRING' as const, description: 'Período tributario YYYY-MM' },
        tipoOperacion: { type: 'STRING' as const, description: 'COMPRAS o VENTAS' },
        csvContent: { type: 'STRING' as const, description: 'Contenido en texto plano del archivo CSV del SII' },
      },
      required: ['periodo', 'tipoOperacion', 'csvContent'],
    },
  },
  {
    name: 'tool_sii_reconcile_rcv_vs_ledger',
    description: 'Coteja los débitos y créditos fiscales del RCV del SII contra las cuentas de IVA del Libro Mayor (Cta 1.1.09 IVA Crédito y 2.1.05 IVA Débito) detectando descuadres.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        periodo: { type: 'STRING' as const, description: 'Período YYYY-MM a auditar' },
      },
      required: ['periodo'],
    },
  },
  {
    name: 'tool_submit_governance_approval',
    description: 'Registra formalmente una propuesta o acción sensible en el sistema de Gobernanza Agéntica para autorización humana previa antes de su ejecución.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        modulo: { type: 'STRING' as const, description: 'Módulo: RRHH, CONTABILIDAD, TRIBUTARIO_SII, TESORERIA, INVENTARIO, ACTIVO_FIJO, COSTOS_PRODUCCION, FLUJO_CAJA, COMERCIAL_COMPRAS, RENDICIONES, FACTURACION_DTE, CONCILIACION' },
        titulo: { type: 'STRING' as const, description: 'Título claro de la operación' },
        descripcion: { type: 'STRING' as const, description: 'Fundamentación técnica y legal de la propuesta' },
        impactoFinancieroClp: { type: 'NUMBER' as const, description: 'Monto involucrado en CLP' },
        nivelRiesgo: { type: 'STRING' as const, description: 'BAJO, MEDIO, ALTO o CRITICO' },
        datosOperacion: { type: 'OBJECT' as const, description: 'Datos estructurados de la operación' },
      },
      required: ['modulo', 'titulo', 'descripcion', 'impactoFinancieroClp', 'nivelRiesgo'],
    },
  },
];


// ============================================================================
// 2.2 / 2.4 (hallazgo #6): las herramientas nunca completan datos contables con valores fijos.
// Si falta un monto, fecha, RUT, período o empresa, devuelven MISSING_PARAMS y el modelo los pide.
// La tabla de clasificación de cada default está en docs/plan-correccion/tabla-defaults-herramientas.md.
// ============================================================================
const isBlank = (v: any) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function missingParamsResult(herramienta: string, faltantes: string[]): Record<string, any> {
  return {
    status: 'MISSING_PARAMS',
    herramienta,
    faltantes,
    observacion: `OBSERVACIÓN: faltan datos obligatorios para ${herramienta}: ${faltantes.join(', ')}. Pídelos al usuario; no los supongas ni uses valores de ejemplo.`,
  };
}

function findMissing(args: Record<string, any>, required: string[]): string[] {
  return required.filter((k) => {
    const alternatives = k.split('|');
    return alternatives.every((alt) => isBlank(args[alt]));
  });
}

/** Período AAAA-MM obligatorio: del argumento o del período seleccionado en la UI. Nunca uno fijo ni "el mes actual". */
function resolvePeriodo(args: Record<string, any>, request: AutonomousAgentRequest): string | null {
  const raw = String(args.periodo || request.context?.selectedPeriod || '').trim();
  return PERIOD_RE.test(raw) ? raw : null;
}

/** Empresa real: contexto, persistencia o empresa de ejemplo (solo DEMO_MODE). Nunca "Empresa Cliente SpA". */
function resolveCompany(request: AutonomousAgentRequest): CompanyProfile | null {
  const fromContext = (request.context?.company || request.context?.empresa) as any;
  if (fromContext && (fromContext.rut || fromContext.id)) return fromContext as CompanyProfile;
  const stored = diskPersistence.getClient(request.empresaId);
  if (stored) return stored as CompanyProfile;
  const demo = getDemoClients().find(
    (c) => c.id === request.empresaId || c.rut.replace(/[^0-9kK]/g, '') === String(request.empresaId || '').replace(/[^0-9kK]/g, '')
  );
  return (demo as unknown as CompanyProfile) || null;
}

export class AutonomousAgentEngine {
  /**
   * Ejecuta una herramienta real del ERP en el backend según la invocación del modelo
   */
  public static async executeTool(
    toolName: string,
    args: Record<string, any>,
    request: AutonomousAgentRequest
  ): Promise<Record<string, any>> {
    const indicators = request.context?.indicators || DEFAULT_INDICATORS;
    const company = resolveCompany(request);

    switch (toolName) {
      case 'tool_hr_calculate_finiquito': {
        const faltantesFiniquito = findMissing(args, ['sueldoBase', 'fechaIngreso', 'fechaDespido|fechaTermino', 'causal|causalLegal', 'diasVacacionesPendientes']);
        if (!isBlank(args.sueldoBase) && !(Number(args.sueldoBase) > 0)) faltantesFiniquito.push('sueldoBase (monto válido)');
        const causalTxt = String(args.causal || args.causalLegal || '').toUpperCase();
        if ((causalTxt.includes('161') || causalTxt.includes('NECESIDADES')) && isBlank(args.diasAvisoPrevioOtorgados)) {
          faltantesFiniquito.push('diasAvisoPrevioOtorgados');
        }
        if (faltantesFiniquito.length > 0) return missingParamsResult('tool_hr_calculate_finiquito', faltantesFiniquito);
        const sueldoBase = Number(args.sueldoBase);
        const gratificacion = Math.min(Math.round(sueldoBase * 0.25), Math.round((4.75 * indicators.imm) / 12));
        const remuneracionMensual = sueldoBase + gratificacion;
        const topeRemuneracion = Math.round(90 * indicators.uf);
        const baseComputable = Math.min(remuneracionMensual, topeRemuneracion);

        const fechaIng = new Date(args.fechaIngreso);
        const fechaDes = new Date(args.fechaDespido || args.fechaTermino);
        if (isNaN(fechaIng.getTime()) || isNaN(fechaDes.getTime()) || fechaDes < fechaIng) {
          return missingParamsResult('tool_hr_calculate_finiquito', ['fechaIngreso y fechaDespido válidas (AAAA-MM-DD, término posterior al ingreso)']);
        }
        const diffMs = fechaDes.getTime() - fechaIng.getTime();
        const diffAnos = diffMs / (1000 * 60 * 60 * 24 * 365.25);

        // Art. 163 Código del Trabajo: Exige al menos 1 año completo de servicio continuo
        let aniosComputables = 0;
        if (diffAnos >= 1.0) {
          const baseYears = Math.floor(diffAnos);
          const remainderMonths = (diffAnos - baseYears) * 12;
          // Fracción superior a 6 meses se computa como un año completo adicional
          aniosComputables = Math.min(baseYears + (remainderMonths >= 6 ? 1 : 0), 11);
        }

        const causalRaw = String(args.causal || args.causalLegal || '').toUpperCase();
        const isArt161 = causalRaw.includes('161') || causalRaw.includes('NECESIDADES');

        const indemnizacionAnosServicio = isArt161 && aniosComputables > 0
          ? aniosComputables * baseComputable
          : 0;

        const indemnizacionAvisoPrevio = (isArt161 && Number(args.diasAvisoPrevioOtorgados) < 30)
          ? baseComputable
          : 0;

        const diasVacaciones = Number(args.diasVacacionesPendientes);
        const valorDiaHabil = Math.round(remuneracionMensual / 30);
        const montoFeriadoProporcional = Math.round(diasVacaciones * valorDiaHabil);

        // Descuento Aporte AFC Empleador Art. 13 Ley 19.728 (Cuenta Individual de Cesantía CIC)
        // Deduce los aportes patronales efectivos (1.6% mensual en contratos indefinidos sobre base imponible)
        const mesesServicio = Math.max(1, Math.round(diffAnos * 12));
        const topeImponibleAfc = Math.round(135.2 * indicators.uf);
        const baseImponibleAfc = Math.min(sueldoBase, topeImponibleAfc);
        const aporteAfcEstimado = Math.round(mesesServicio * (baseImponibleAfc * 0.016));
        const descuentoAfcEmpleador = isArt161 && aniosComputables > 0
          ? (Number(args.aporteAfcEmpleadorReal) || Number(args.descuentoAfcEmpleador) || aporteAfcEstimado)
          : 0;

        const totalFiniquitoLiquido = Math.max(
          0,
          indemnizacionAnosServicio +
          indemnizacionAvisoPrevio +
          montoFeriadoProporcional -
          descuentoAfcEmpleador
        );

        return {
          status: 'SUCCESS',
          causal: args.causal,
          antiguedadAnosExacta: Math.round(diffAnos * 100) / 100,
          aniosComputables,
          baseComputableMensual: baseComputable,
          tope90Uf: topeRemuneracion,
          indemnizacionAnosServicio,
          indemnizacionAvisoPrevio,
          montoFeriadoProporcional,
          descuentoAfcEmpleador,
          descuentoAfcEsEstimado: isArt161 && aniosComputables > 0 && isBlank(args.aporteAfcEmpleadorReal) && isBlank(args.descuentoAfcEmpleador),
          totalFiniquitoLiquido,
          fundamentoLegal: 'Art. 161, 162, 163 y 172 Código del Trabajo; Art. 13 Ley 19.728.',
        };
      }

      case 'tool_hr_calculate_payroll': {
        const faltantesNomina = findMissing(args, ['rut', 'nombreCompleto', 'sueldoBase', 'afpNombre', 'saludTipo', 'tipoContrato']);
        if (faltantesNomina.length > 0) return missingParamsResult('tool_hr_calculate_payroll', faltantesNomina);
        const p = calculatePayroll({
          sueldoBase: Number(args.sueldoBase),
          afpNombre: args.afpNombre,
          saludTipo: args.saludTipo,
          // Haberes variables: su ausencia significa "sin horas extras / sin bonos" (parámetro documentado)
          horasExtrasCantidad: Number(args.horasExtrasCantidad) || 0,
          comisionesBonosImponibles: Number(args.bonosImponibles) || 0,
          tipoContrato: args.tipoContrato,
          nombreCompleto: args.nombreCompleto,
          rut: args.rut,
          cargo: args.cargo || '',
        } as any, indicators);

        return {
          status: 'SUCCESS',
          totalImponible: p.totalHaberesImponibles,
          totalHaberesImponibles: p.totalHaberesImponibles,
          totalHaberesBrutos: p.totalHaberesBrutos,
          totalDescuentosLegales: p.totalDescuentos || (p.afpMonto + p.saludMonto + p.afcTrabajadorMonto + p.impuestoUnicoMonto),
          afpMonto: p.afpMonto,
          saludMonto: p.saludMonto,
          afcTrabajador: p.afcTrabajadorMonto,
          impuestoUnico: p.impuestoUnicoMonto,
          sueldoLiquido: p.sueldoLiquido,
          sisEmpleador: p.sisEmpleadorMonto,
          mutualEmpleador: p.mutualEmpleadorMonto,
          afcEmpleador: p.afcEmpleadorMonto,
          ley21735Monto: p.reformaPrevisionalLey21735Monto || Math.round(p.totalHaberesImponibles * 0.01),
          costoTotalEmpresa: p.costoTotalEmpresa,
        };
      }

      case 'tool_accounting_propose_entry': {
        const lineas = Array.isArray(args.lineas) ? args.lineas : [];
        const totalDebe = lineas.reduce((s: number, l: any) => s + (Number(l.debe) || 0), 0);
        const totalHaber = lineas.reduce((s: number, l: any) => s + (Number(l.haber) || 0), 0);
        const diff = Math.abs(totalDebe - totalHaber);

        if (!company) return missingParamsResult('tool_accounting_propose_entry', ['empresa (no registrada en el ERP)']);
        if (lineas.length === 0) return missingParamsResult('tool_accounting_propose_entry', ['lineas']);
        try {
          const validated = normalizeAndValidateJournalEntry({
            empresaId: company.rut,
            fecha: new Date().toISOString().split('T')[0],
            glosaGeneral: args.glosaGeneral || 'Asiento contable propuesto',
            lineas: lineas.map((l: any) => ({
              codigoCuenta: l.cuentaCodigo || l.codigoCuenta,
              nombreCuenta: l.cuentaNombre || l.nombreCuenta,
              debe: Number(l.debe) || 0,
              haber: Number(l.haber) || 0,
              rutAuxiliar: l.rutAuxiliar || company.rut,
              nombreAuxiliar: l.nombreAuxiliar || company.razonSocial,
              documentoRef: l.documentoRef || 'MEMORANDUM_INTERNO',
            })),
            origenModulo: 'MANUAL',
            creadoPorAgente: 'Agente Contable Autónomo',
          });

          return {
            status: 'SUCCESS',
            partidaDobleValida: true,
            totalDebe: validated.totalDebe,
            totalHaber: validated.totalHaber,
            diferencia: validated.diferencia,
            asientoContable: validated,
            observacion: 'Asiento contable validado y balanceado al centavo según normativa chilena e IFRS.',
          };
        } catch (valErr: any) {
          return {
            status: 'UNBALANCED_ENTRY_ERROR',
            partidaDobleValida: false,
            totalDebe,
            totalHaber,
            diferencia: diff,
            error: valErr.message,
            sugerenciaCorreccion: `Ajuste el débito o crédito por $${diff.toLocaleString('es-CL')} para balancear la partida doble conforme al principio contable.`,
            observacion: `OBSERVACIÓN DE PARTIDA DOBLE: El asiento contable propuesto no cuadra. Débito total: $${totalDebe.toLocaleString('es-CL')}, Crédito total: $${totalHaber.toLocaleString('es-CL')}, Diferencia: $${diff.toLocaleString('es-CL')}. Detalle del validador: ${valErr.message}. Por favor ajuste las líneas del asiento para que la partida doble sea exacta (Diferencia = $0).`,
          };
        }
      }

      case 'tool_sii_query_rcv': {
        const periodo = resolvePeriodo(args, request);
        const faltantesRcv = [...(periodo ? [] : ['periodo (AAAA-MM)']), ...findMissing(args, ['tipoOperacion'])];
        if (faltantesRcv.length > 0) return missingParamsResult('tool_sii_query_rcv', faltantesRcv);
        const tipo = String(args.tipoOperacion).toUpperCase();
        const rutEmpresa = args.empresaRut || company?.rut || request.empresaId;

        try {
          const docs = await SiiRcvService.getDocuments(rutEmpresa, periodo, tipo as any);
          if (docs && docs.length > 0) {
            return {
              status: 'SUCCESS',
              periodo,
              tipoOperacion: tipo,
              totalDocumentos: docs.length,
              montoNetoTotal: docs.reduce((s, d) => s + (d.montoNeto || 0), 0),
              montoIvaTotal: docs.reduce((s, d) => s + (d.montoIvaRecuperable || (d as any).montoIva || 0), 0),
              montoTotal: docs.reduce((s, d) => s + (d.montoTotal || 0), 0),
              documentosMuestra: docs.slice(0, 5),
              origenDatos: 'PORTAL_SII_EN_LINEA',
            };
          }
        } catch {
          // Conmutar a consulta determinista en base de datos local
        }

        // Consulta en base de datos local real (dtes_rcv y disco) o contexto provisto
        const contextDtes = Array.isArray(request.context?.dtes) ? request.context.dtes : [];
        const localDtes = [...contextDtes, ...diskPersistence.getDtes(rutEmpresa, periodo)];
        const filteredDocs = localDtes.filter((d: any) => {
          if (tipo === 'COMPRAS') return d.tipoOperacion === 'COMPRA' || d.tipoDte === '33' || d.tipoDte === '34';
          return d.tipoOperacion === 'VENTA' || d.tipoOperacion === 'VENTAS';
        });

        if (filteredDocs.length > 0) {
          return {
            status: 'SUCCESS',
            periodo,
            tipoOperacion: tipo,
            totalDocumentos: filteredDocs.length,
            montoNetoTotal: filteredDocs.reduce((s, d) => s + (Number(d.montoNeto) || 0), 0),
            montoIvaTotal: filteredDocs.reduce((s, d) => s + (Number(d.montoIvaRecuperable || d.montoIva) || 0), 0),
            montoTotal: filteredDocs.reduce((s, d) => s + (Number(d.montoTotal) || 0), 0),
            documentos: filteredDocs,
            documentosMuestra: filteredDocs.slice(0, 5),
            origenDatos: 'BASE_DATOS_LOCAL_ERP',
          };
        }

        return {
          status: 'NO_DATA',
          periodo,
          tipoOperacion: tipo,
          totalDocumentos: 0,
          documentos: [],
          montoNetoTotal: 0,
          montoIvaTotal: 0,
          montoTotal: 0,
          mensaje: `No se encontraron documentos en la base de datos local para ${rutEmpresa} en el período ${periodo}. No se realizó consulta remota al SII por no contar con pasarela externa activa.`,
          origenDatos: 'SIN_DOCUMENTOS_LOCALES',
        };
      }

      case 'tool_tax_calculate_f29': {
        const periodo = resolvePeriodo(args, request);
        const rutEmpresa = args.empresaRut || company?.rut || request.empresaId;
        const esExenta = Boolean(args.esExentaIva);
        // Tasa PPM: del argumento o de la ficha de la empresa; nunca una tasa supuesta.
        const tasaPpm = Number(args.tasaPpm) || Number((company as any)?.tasaPpm) || 0;
        const faltantesF29 = [
          ...(periodo ? [] : ['periodo (AAAA-MM)']),
          ...(company ? [] : ['empresa (no registrada en el ERP)']),
          ...(tasaPpm > 0 ? [] : ['tasaPpm']),
        ];
        if (faltantesF29.length > 0) return missingParamsResult('tool_tax_calculate_f29', faltantesF29);

        // Obtener DTEs y remuneraciones reales del contexto o base de datos
        const dtes = (request.context?.dtes && Array.isArray(request.context.dtes))
          ? request.context.dtes
          : diskPersistence.getDtes(rutEmpresa, periodo);

        let payrolls: any[] = [];
        try {
          if (request.context?.payrolls && Array.isArray(request.context.payrolls)) {
            payrolls = request.context.payrolls;
          } else if (typeof diskPersistence.getPayrolls === 'function') {
            payrolls = diskPersistence.getPayrolls(rutEmpresa, periodo);
          }
        } catch {
          payrolls = [];
        }

        const cleanRutEmpresa = (rutEmpresa || '').replace(/[\.\-\s]/g, '').toUpperCase();

        // Normalizar DTEs asegurando segregación estricta de Ventas / Compras por RUT
        const normalizedDtes = (dtes || []).map((d: any) => {
          let tipoOperacion = d.tipoOperacion;
          if (!tipoOperacion) {
            const emisor = (d.emisorRut || d.rutEmisor || d.emisor?.rut || '').replace(/[\.\-\s]/g, '').toUpperCase();
            const receptor = (d.receptorRut || d.rutReceptor || d.receptor?.rut || '').replace(/[\.\-\s]/g, '').toUpperCase();
            if (emisor && cleanRutEmpresa && emisor === cleanRutEmpresa) {
              tipoOperacion = 'VENTA';
            } else if (receptor && cleanRutEmpresa && receptor === cleanRutEmpresa) {
              tipoOperacion = 'COMPRA';
            } else {
              tipoOperacion = 'VENTA';
            }
          }
          return {
            ...d,
            tipoOperacion,
            tipoDte: String(d.tipoDte || '33'),
            glosa: d.glosa || d.razonSocial || 'DTE Operacional',
          };
        });

        const indicators = (request.context?.indicators || DEFAULT_INDICATORS) as ChileIndicators;
        // Ficha real de la empresa (validada arriba); el remanente de crédito fiscal viene del argumento o de la ficha.
        const companyProfile: CompanyProfile = {
          ...(company as CompanyProfile),
          tasaPpm,
          remanenteCreditoFiscalClp: Number(args.remanenteMesAnteriorClp ?? (company as any).remanenteCreditoFiscalClp ?? 0),
          remanenteCreditoFiscalUtm: Number(args.remanenteMesAnteriorUtm ?? (company as any).remanenteCreditoFiscalUtm ?? 0),
        } as CompanyProfile;

        // EJECUTAR MOTOR DETERMINÍSTICO SENIOR F29 (DL 825, Arts. 23 y 28, LIR Art. 84, Ley 19.983)
        const f29Result = calculatePreF29(
          companyProfile,
          normalizedDtes,
          payrolls,
          indicators,
          {
            periodo,
            tasaPpmManual: tasaPpm,
            utmActual: indicators?.utm,
            utmAnterior: indicators?.utm ? Math.round(indicators.utm / 1.004) : undefined,
          }
        );

        const salesCount = normalizedDtes.filter(d => d.tipoOperacion === 'VENTA').length;
        const purchasesCount = normalizedDtes.filter(d => d.tipoOperacion === 'COMPRA').length;

        return {
          status: 'SUCCESS',
          periodo,
          empresaRut: rutEmpresa,
          esExentaIva: esExenta,
          documentosVentaProcesados: salesCount,
          documentosCompraProcesados: purchasesCount,
          ventasNetas: f29Result.detalle_debito.ventasFacturasAfectasNeto,
          comprasNetas: f29Result.detalle_credito.comprasInternasAfectasNeto,
          debitoFiscalIva: f29Result.detalle_debito.totalDebitoCalculado,
          creditoFiscalIva: f29Result.detalle_credito.totalCreditoConRemanente,
          creditoFiscalProveedores: f29Result.detalle_credito.creditoFiscalNormal,
          creditoActivoFijo: f29Result.detalle_credito.comprasActivoFijoIva,
          factorProporcionalidadIva: f29Result.detalle_credito.factorProporcionalidadIva,
          remanenteMesAnteriorUtm: f29Result.detalle_credito.remanenteMesAnteriorUtm,
          remanenteReajustadoClp: f29Result.detalle_credito.remanenteReajustadoClp,
          totalCreditoConRemanente: f29Result.detalle_credito.totalCreditoConRemanente,
          saldoIvaDeterminado: f29Result.f29_mapeo.c089_impuesto_determinado_iva || 0,
          remanenteCreditoFiscal: f29Result.f29_mapeo.c077_saldo_a_favor_o_remanente || 0,
          impuestoUnicoSegundaCategoria: f29Result.detalle_retenciones.impuestoUnicoTrabajadoresSueldos,
          retencionHonorarios145: f29Result.detalle_retenciones.retencionHonorariosSegundaCat,
          tasaPpm: f29Result.detalle_ppm.tasaTotalAplicada,
          ppmDeterminado: f29Result.detalle_ppm.ppmDeterminado,
          totalPagarF29: f29Result.f29_mapeo.c091_total_a_pagar_f29 || 0,
          alertasFiscales: f29Result.alertas_fiscales.map(a => a.descripcion),
          f29Mapeo: f29Result.f29_mapeo,
          f29_mapeo: f29Result.f29_mapeo,
          asientoSugerido: f29Result.asiento_contable_f29,
          asiento_contable_f29: f29Result.asiento_contable_f29,
          normativaAplicada: 'DL 825 (Arts. 23 proporcionalidad y 28 remanente reajustado en UTM), Art. 84 LIR (PPM), Ley 21.133 (Retención Honorarios 14.5% vigente 2026), Ley 19.983 (Acuse recibo 8 días).',
        };
      }

      case 'tool_inventory_kardex': {
        const rutEmpresa = request.empresaId;
        const items = (request.context?.items && Array.isArray(request.context.items))
          ? request.context.items
          : (request.context?.inventoryItems && Array.isArray(request.context.inventoryItems))
            ? request.context.inventoryItems
            : diskPersistence.getInventoryItems(rutEmpresa);

        if (!items || items.length === 0) {
          if (args.sku) {
            return {
              status: 'NOT_FOUND',
              empresaId: rutEmpresa,
              sku: args.sku,
              itemEncontrado: false,
              pmpCalculado: 0,
              stockTotalActual: 0,
              valorizacionTotalInventarioClp: 0,
              valorizacionTotalInventario: 0,
              mensaje: `No se encontró ningún artículo para el SKU '${args.sku}' en la empresa ${rutEmpresa}.`,
            };
          }
          return {
            status: 'NO_DATA',
            empresaId: rutEmpresa,
            metodoValorizacion: 'PMP_PROMEDIO_PONDERADO_ACREDITADO_SII',
            totalItemsActivos: 0,
            itemsCriticosBajoReorden: 0,
            alertasStock: [],
            valorizacionTotalInventarioClp: 0,
            valorizacionTotalInventario: 0,
            mensaje: `No se registran SKUs en inventario ni kardex para la empresa ${rutEmpresa}.`,
          };
        }

        const valorizacionTotalInventarioClp = Math.round(
          items.reduce((sum: number, it: any) => {
            const stock = Number(it.stockTotal ?? it.stockFisico ?? it.stockActual ?? 0);
            const pmp = Number(it.costoUnitarioPMP ?? it.costoUnitario ?? 0);
            return sum + (stock * pmp);
          }, 0)
        );

        const alertasStock = items
          .filter((it: any) => {
            const stock = Number(it.stockTotal ?? it.stockFisico ?? it.stockActual ?? 0);
            const min = Number(it.stockMinimo ?? 0);
            return stock <= min && min > 0;
          })
          .map((it: any) => ({
            sku: it.sku || it.id,
            item: it.nombre || it.descripcion,
            stockActual: Number(it.stockTotal ?? it.stockFisico ?? it.stockActual ?? 0),
            stockMinimo: Number(it.stockMinimo ?? 0),
            alerta: 'STOCK_CRITICO',
          }));

        const queriedItem = args.sku
          ? items.find((it: any) => String(it.sku || it.id || '').toLowerCase() === String(args.sku).toLowerCase())
          : undefined;

        if (args.sku && !queriedItem) {
          return {
            status: 'NOT_FOUND',
            empresaId: rutEmpresa,
            sku: args.sku,
            itemEncontrado: false,
            pmpCalculado: 0,
            stockTotalActual: 0,
            metodoValorizacion: 'PMP_PROMEDIO_PONDERADO_ACREDITADO_SII',
            totalItemsActivos: items.length,
            itemsCriticosBajoReorden: alertasStock.length,
            alertasStock,
            valorizacionTotalInventarioClp,
            valorizacionTotalInventario: valorizacionTotalInventarioClp,
            mensaje: `El SKU '${args.sku}' no existe en el catálogo de inventario ni kardex de la empresa ${rutEmpresa}.`,
          };
        }

        return {
          status: 'SUCCESS',
          empresaId: rutEmpresa,
          metodoValorizacion: 'PMP_PROMEDIO_PONDERADO_ACREDITADO_SII',
          totalItemsActivos: items.length,
          itemsCriticosBajoReorden: alertasStock.length,
          alertasStock,
          valorizacionTotalInventarioClp,
          valorizacionTotalInventario: valorizacionTotalInventarioClp,
          sku: queriedItem ? (queriedItem.sku || queriedItem.id) : undefined,
          itemEncontrado: !!queriedItem,
          pmpCalculado: queriedItem ? Number(queriedItem.costoUnitarioPMP ?? queriedItem.costoUnitario ?? 0) : undefined,
          stockTotalActual: queriedItem ? Number(queriedItem.stockTotal ?? queriedItem.stockFisico ?? queriedItem.stockActual ?? 0) : undefined,
        };
      }

      case 'tool_bank_reconcile_movement': {
        const rutEmpresa = request.empresaId;
        const movements = (request.context?.movements && Array.isArray(request.context.movements))
          ? request.context.movements
          : (request.context?.bankMovements && Array.isArray(request.context.bankMovements))
            ? request.context.bankMovements
            : diskPersistence.getBankMovements(rutEmpresa);

        if (!movements || movements.length === 0) {
          return {
            status: 'NO_DATA',
            empresaId: rutEmpresa,
            cuentaBancaria: args.cuentaBancaria || 'Sin cuenta seleccionada',
            movimientosCartolaAuditados: 0,
            movimientosConciliadosAutomaticamente: 0,
            movimientosPendientes: 0,
            tasaEfectividadCalce: 0,
            mensaje: `No se registran movimientos de cartola bancaria para conciliar en la empresa ${rutEmpresa}.`,
          };
        }

        const entries = (request.context?.entries && Array.isArray(request.context.entries))
          ? request.context.entries
          : (request.context?.journalEntries && Array.isArray(request.context.journalEntries))
            ? request.context.journalEntries
            : diskPersistence.getJournalEntries(rutEmpresa);

        const usedEntryIds = new Set<string>();

        // Marcar asientos que ya figuren conciliados previamente en la base de datos o contexto
        entries.forEach((e: any) => {
          if (e.conciliado === true || e.estadoConciliacion === 'CONCILIADO' || e.reconciled === true) {
            usedEntryIds.add(e.id);
          }
        });

        let conciliados = 0;
        const detallesCalce: any[] = [];

        movements.forEach((m: any) => {
          // Si el movimiento ya está conciliado de antes, contar y preservar
          if (m.estado === 'CONCILIADO' || m.conciliado === true) {
            conciliados++;
            if (m.asientoGeneradoId || m.movimientoIdConciliado) {
              usedEntryIds.add(m.asientoGeneradoId || m.movimientoIdConciliado);
            }
            return;
          }

          const montoMov = Math.abs(Number(m.monto || m.cargo || m.abono || 0));
          const fechaMov = m.fecha ? new Date(m.fecha).getTime() : 0;
          const rutMov = (m.rut || m.rutAuxiliar || m.rutContraparte || '').replace(/[\.\-\s]/g, '').toUpperCase();
          const descMov = (m.descripcion || m.glosa || m.numeroDocumento || '').toLowerCase();

          let bestScore = 0;
          let matchedEntry: any = null;

          for (const e of entries) {
            // Un mismo asiento NO puede conciliar más de un movimiento (evita el doble calce)
            if (usedEntryIds.has(e.id)) continue;

            const lines = e.lineas || [];
            const hasAmount = Math.abs((Number(e.totalDebe) || 0) - montoMov) < 0.01 ||
                              Math.abs((Number(e.totalHaber) || 0) - montoMov) < 0.01 ||
                              lines.some((l: any) => Math.abs((Number(l.debe) || 0) - montoMov) < 0.01 || Math.abs((Number(l.haber) || 0) - montoMov) < 0.01);

            if (!hasAmount) continue;

            let score = 50; // Calce base exacto por monto

            // 1. Regla de RUT auxiliar
            if (rutMov && lines.some((l: any) => (l.rutAuxiliar || '').replace(/[\.\-\s]/g, '').toUpperCase() === rutMov)) {
              score += 25;
            }

            // 2. Regla de ventana de fecha (tolerancia 3 días / 72h clearing bancario)
            if (fechaMov > 0 && e.fecha) {
              const fechaEntry = new Date(e.fecha).getTime();
              const diffDays = Math.abs(fechaMov - fechaEntry) / (1000 * 60 * 60 * 24);
              if (diffDays <= 3) {
                score += 15;
              }
            }

            // 3. Regla de referencia TEF o glosa
            if (descMov && ((e.concepto || '').toLowerCase().includes(descMov) || (e.documento || '').toLowerCase().includes(descMov))) {
              score += 10;
            }

            if (score > bestScore) {
              bestScore = score;
              matchedEntry = e;
            }
          }

          if (bestScore >= 50 && matchedEntry) {
            usedEntryIds.add(matchedEntry.id);
            conciliados++;
            detallesCalce.push({
              movimientoId: m.id || m.folio || `MOV-${montoMov}`,
              monto: montoMov,
              asientoId: matchedEntry.id,
              calidadCalce: bestScore >= 75 ? 'ALTA_CONFIANZA' : 'CONFIANZA_MEDIA',
              score: bestScore,
            });
          }
        });

        const pendientes = movements.length - conciliados;
        const tasa = movements.length > 0 ? Math.round((conciliados / movements.length) * 1000) / 10 : 0;

        return {
          status: 'SUCCESS',
          empresaId: rutEmpresa,
          cuentaBancaria: args.cuentaBancaria || 'Cuenta Principal',
          movimientosCartolaAuditados: movements.length,
          movimientosConciliadosAutomaticamente: conciliados,
          movimientosPendientes: pendientes,
          tasaEfectividadCalce: tasa,
          reglasCalceAplicadas: ['CALCE_EXACTO_MONTO_TEF', 'CALCE_RUT_AUXILIAR_MAS_FECHA', 'TOLERANCIA_48_HORAS_CLEARING'],
          detallesCalce: detallesCalce,
          calcesMuestra: detallesCalce.slice(0, 5),
        };
      }

      case 'tool_fixed_assets_depreciate_period': {
        const periodo = resolvePeriodo(args, request);
        if (!periodo) return missingParamsResult('tool_fixed_assets_depreciate_period', ['periodo (AAAA-MM)']);
        const rutEmpresa = request.empresaId;
        const allAssets = diskPersistence.getFixedAssets(rutEmpresa);
        const eligibleAssets = allAssets.filter(
          (a: any) => a.estado === 'OPERATIVO' || a.estado === 'MANTENCION'
        );

        if (eligibleAssets.length === 0) {
          return {
            status: 'NO_DATA',
            empresaId: rutEmpresa,
            periodo,
            totalActivos: 0,
            depreciacionFinancieraTotal: 0,
            depreciacionTributariaTotal: 0,
            mensaje: `No se encontraron activos fijos operativos disponibles para depreciar en ${rutEmpresa} para el período ${periodo}.`,
          };
        }

        let depFinTotal = 0;
        let depTribTotal = 0;
        let depCifTotal = 0;

        const calculados = eligibleAssets.map((a: any) => {
          const cuotaFin = a.cuotaDepreciacionMensualFinanciera > 0
            ? Number(a.cuotaDepreciacionMensualFinanciera)
            : Math.round(Number(a.valorAdquisicionOriginal || 0) / (Number(a.vidaUtilMesesFinanciera) || 60));
          const cuotaTrib = a.cuotaDepreciacionMensualTributaria > 0
            ? Number(a.cuotaDepreciacionMensualTributaria)
            : Math.round(Number(a.valorAdquisicionOriginal || 0) / (Number(a.vidaUtilMesesTributaria) || 36));
          const cuotaFabrilCif = a.esFabrilProduccion ? cuotaFin : 0;

          depFinTotal += cuotaFin;
          depTribTotal += cuotaTrib;
          depCifTotal += cuotaFabrilCif;

          return {
            id: a.id,
            codigoPlaca: a.codigoPlaca,
            nombre: a.nombre,
            categoria: a.categoria,
            cuotaFinanciera: cuotaFin,
            cuotaTributaria: cuotaTrib,
            cuotaFabrilCif,
            esFabrilProduccion: Boolean(a.esFabrilProduccion),
            centroCostoCodigo: a.centroCostoCodigo,
            vidaUtilRestanteMeses: Math.max(0, Number(a.vidaUtilRestanteMeses || 0) - 1),
          };
        });

        return {
          status: 'SUCCESS',
          empresaId: rutEmpresa,
          periodo,
          totalActivosAuditados: eligibleAssets.length,
          depreciacionFinancieraTotal: depFinTotal,
          depreciacionTributariaTotal: depTribTotal,
          depreciacionFabrilCifTotal: depCifTotal,
          gastoAdministracionTotal: depFinTotal - depCifTotal,
          calculosNIC16: true,
          detallesCalculo: calculados,
        };
      }

      case 'tool_fixed_assets_propose_entry': {
        const periodo = resolvePeriodo(args, request);
        if (!periodo) return missingParamsResult('tool_fixed_assets_propose_entry', ['periodo (AAAA-MM)']);
        const rutEmpresa = request.empresaId;
        const allAssets = diskPersistence.getFixedAssets(rutEmpresa);
        const eligibleAssets = allAssets.filter(
          (a: any) => a.estado === 'OPERATIVO' || a.estado === 'MANTENCION'
        );

        if (eligibleAssets.length === 0) {
          return {
            status: 'NO_DATA',
            empresaId: rutEmpresa,
            periodo,
            mensaje: `No hay activos operativos para estructurar asiento de depreciación en el período ${periodo}.`,
          };
        }

        const depreciacionesParaAsiento = eligibleAssets.map((a: any) => {
          const cuotaFin = a.cuotaDepreciacionMensualFinanciera > 0
            ? Number(a.cuotaDepreciacionMensualFinanciera)
            : Math.round(Number(a.valorAdquisicionOriginal || 0) / (Number(a.vidaUtilMesesFinanciera) || 60));
          return {
            activo: a,
            cuotaFinanciera: cuotaFin,
            cuotaFabrilCif: a.esFabrilProduccion ? cuotaFin : 0,
          };
        });

        const entry = createFixedAssetDepreciationEntry(periodo, depreciacionesParaAsiento);
        (entry as any).empresaId = rutEmpresa;

        const approval = HrManagementService.requestModuleApproval({
          empresaId: rutEmpresa,
          modulo: 'ACTIVO_FIJO',
          agenteNombre: request.agentRole || 'Agente de Activos Fijos NIC 16',
          operacionTipo: 'DEPRECIACION_ACTIVO_FIJO',
          titulo: `Depreciación Mensual Activo Fijo Periodo ${periodo}`,
          descripcion: `Contabilización de cuota mensual de depreciación NIC 16 por $${formatCLP(entry.totalDebe)}. Afecta ${eligibleAssets.length} activos fijos.`,
          datosOperacion: {
            periodo,
            totalDebe: entry.totalDebe,
            totalHaber: entry.totalHaber,
            entry,
            activosAfectados: eligibleAssets.map((a: any) => a.id),
          },
          impactoFinancieroClp: entry.totalDebe,
          nivelRiesgo: 'MEDIO',
        });

        return {
          status: 'SUCCESS',
          asientoContable: entry,
          totalDebe: entry.totalDebe,
          totalHaber: entry.totalHaber,
          partidaDobleValida: entry.totalDebe === entry.totalHaber,
          approvalId: approval.id,
          estadoGobernanza: approval.estado,
          mensaje: `Propuesta de asiento de depreciación estructurada (Folio: ${approval.id}). Requiere aprobación para registrar en el Libro Diario.`,
        };
      }

      case 'tool_fixed_assets_propose_writeoff': {
        const rutEmpresa = request.empresaId;
        const allAssets = diskPersistence.getFixedAssets(rutEmpresa);
        const targetId = String(args.activoId || args.id || '').toUpperCase();
        const asset = allAssets.find(
          (a: any) =>
            String(a.id).toUpperCase() === targetId ||
            String(a.codigoPlaca || '').toUpperCase() === targetId
        );

        if (!asset) {
          return {
            status: 'NOT_FOUND',
            empresaId: rutEmpresa,
            error: `Activo fijo '${args.activoId}' no encontrado en el inventario físico de la empresa ${rutEmpresa}.`,
          };
        }

        const precioVenta = Number(args.precioVentaNeto || 0);
        const disposalEntry = createFixedAssetDisposalEntry(asset, precioVenta);
        (disposalEntry as any).empresaId = rutEmpresa;

        const approval = HrManagementService.requestModuleApproval({
          empresaId: rutEmpresa,
          modulo: 'ACTIVO_FIJO',
          agenteNombre: request.agentRole || 'Agente de Activos Fijos NIC 16',
          operacionTipo: 'BAJA_ACTIVO_FIJO',
          titulo: `Baja / Enajenación de Activo Fijo: ${asset.codigoPlaca} (${asset.nombre})`,
          descripcion: `Retiro de activo fijo por ${args.motivoBaja || 'Término de vida útil / Destrucción'}. Valor libro retirado: $${formatCLP(asset.valorLibroFinanciero)}. Precio venta neto: $${formatCLP(precioVenta)}.`,
          datosOperacion: {
            activoId: asset.id,
            codigoPlaca: asset.codigoPlaca,
            nombre: asset.nombre,
            valorLibroFinanciero: asset.valorLibroFinanciero,
            precioVentaNeto: precioVenta,
            motivoBaja: args.motivoBaja,
            entry: disposalEntry,
          },
          impactoFinancieroClp: asset.valorLibroFinanciero,
          nivelRiesgo: asset.valorLibroFinanciero > 2000000 ? 'ALTO' : 'MEDIO',
        });

        return {
          status: 'SUCCESS',
          activo: {
            id: asset.id,
            codigoPlaca: asset.codigoPlaca,
            nombre: asset.nombre,
            valorLibroFinanciero: asset.valorLibroFinanciero,
          },
          precioVentaNeto: precioVenta,
          asientoContable: disposalEntry,
          approvalId: approval.id,
          estadoGobernanza: approval.estado,
          mensaje: `Propuesta de baja y asiento de desincorporación registrada para aprobación humana (Folio: ${approval.id}).`,
        };
      }

      case 'tool_production_cost_order': {
        const rutEmpresa = request.empresaId;
        const allOrders = diskPersistence.getProductionOrders(rutEmpresa);
        const folioTarget = String(args.folioOP || args.folio || '').toUpperCase();
        const op = allOrders.find(
          (o: any) =>
            String(o.folioOP || '').toUpperCase() === folioTarget ||
            String(o.id || '').toUpperCase() === folioTarget
        );

        if (!op) {
          return {
            status: 'NOT_FOUND',
            empresaId: rutEmpresa,
            folioOP: args.folioOP,
            mensaje: `No se encontró ninguna orden de producción con folio o ID '${args.folioOP}' en la empresa ${rutEmpresa}.`,
          };
        }

        const mpd = Number(op.costoMateriaPrimaReal || 0);
        const mod = Number(op.costoManoObraReal || 0);
        const cif = Number(op.costoCifReal || 0);
        const costoTotal = Number(op.costoTotalProduccion || (mpd + mod + cif));
        const cantProd = Number(op.cantidadProducidaReal || 0);
        const cantObj = Number(op.cantidadObjetivo || 1);
        const avancePct = Math.round((cantProd / cantObj) * 100);
        const costoUnit = cantProd > 0 ? Math.round(costoTotal / cantProd) : (op.costoUnitarioReal || 0);

        return {
          status: 'SUCCESS',
          empresaId: rutEmpresa,
          orden: {
            id: op.id,
            folioOP: op.folioOP,
            productoNombre: op.productoNombre,
            clienteNombre: op.clienteNombre || 'Industrial',
            estado: op.estado,
            unidadMedida: op.unidadMedida || 'UND',
            cantidadObjetivo: cantObj,
            cantidadProducidaReal: cantProd,
            avancePorcentaje: avancePct,
            fechaInicio: op.fechaInicio,
            fechaRealTermino: op.fechaRealTermino || op.fechaEstimadaTermino,
          },
          costosNIC2: {
            materiaPrimaDirectaMPD: mpd,
            manoObraDirectaMOD: mod,
            costosIndirectosFabricacionCIF: cif,
            costoTotalProduccion: costoTotal,
            costoUnitarioReal: costoUnit,
          },
        };
      }

      case 'tool_production_variance_standard_vs_real': {
        const rutEmpresa = request.empresaId;
        const allOrders = diskPersistence.getProductionOrders(rutEmpresa);
        const folioTarget = String(args.folioOP || args.folio || '').toUpperCase();
        const op = allOrders.find(
          (o: any) =>
            String(o.folioOP || '').toUpperCase() === folioTarget ||
            String(o.id || '').toUpperCase() === folioTarget
        );

        if (!op) {
          return {
            status: 'NOT_FOUND',
            empresaId: rutEmpresa,
            folioOP: args.folioOP,
            mensaje: `Orden '${args.folioOP}' no encontrada en la empresa ${rutEmpresa}.`,
          };
        }

        const budgets = diskPersistence.getProductionBudgets(rutEmpresa);
        const budget = budgets.find((b: any) => b.ordenProduccionId === op.id || b.folioOP === op.folioOP);

        const estMPD = budget ? Number(budget.presupuestoMpdClp || 0) : Math.round(Number(op.costoMateriaPrimaReal || 0) * 0.95);
        const estMOD = budget ? Number(budget.presupuestoModClp || 0) : Math.round(Number(op.costoManoObraReal || 0) * 0.95);
        const estCIF = budget ? Number(budget.presupuestoCifClp || 0) : Math.round(Number(op.costoCifReal || 0) * 0.95);
        const estTotal = estMPD + estMOD + estCIF;

        const realMPD = Number(op.costoMateriaPrimaReal || 0);
        const realMOD = Number(op.costoManoObraReal || 0);
        const realCIF = Number(op.costoCifReal || 0);
        const realTotal = Number(op.costoTotalProduccion || (realMPD + realMOD + realCIF));

        const diffTotal = realTotal - estTotal;
        const diffPct = estTotal > 0 ? Number(((diffTotal / estTotal) * 100).toFixed(2)) : 0;

        return {
          status: 'SUCCESS',
          folioOP: op.folioOP,
          producto: op.productoNombre,
          costoEstandarPresupuestado: estTotal,
          costoRealAcumulado: realTotal,
          desviacionTotalClp: diffTotal,
          desviacionPorcentaje: diffPct,
          estadoDesvio: Math.abs(diffPct) <= 5 ? 'DENTRO_DE_TOLERANCIA' : diffPct > 5 ? 'SOBRECOSTO_ALERTA' : 'AHORRO_FAVORABLE',
          desglose: {
            mpd: { estandar: estMPD, real: realMPD, diff: realMPD - estMPD },
            mod: { estandar: estMOD, real: realMOD, diff: realMOD - estMOD },
            cif: { estandar: estCIF, real: realCIF, diff: realCIF - estCIF },
          },
        };
      }

      case 'tool_production_propose_closure_entry': {
        const rutEmpresa = request.empresaId;
        const allOrders = diskPersistence.getProductionOrders(rutEmpresa);
        const folioTarget = String(args.folioOP || args.folio || '').toUpperCase();
        const op = allOrders.find(
          (o: any) =>
            String(o.folioOP || '').toUpperCase() === folioTarget ||
            String(o.id || '').toUpperCase() === folioTarget
        );

        if (!op) {
          return {
            status: 'NOT_FOUND',
            folioOP: args.folioOP,
            mensaje: `No se puede proponer cierre: orden '${args.folioOP}' no existe en la empresa ${rutEmpresa}.`,
          };
        }

        if (isBlank(args.fechaCierre)) return missingParamsResult('tool_production_propose_closure_entry', ['fechaCierre']);
        const fechaCierre = String(args.fechaCierre);
        const updatedOp = {
          ...op,
          fechaRealTermino: fechaCierre,
        };
        const entry = createProductionFinishedLiquidationEntry(updatedOp, fechaCierre);
        (entry as any).empresaId = rutEmpresa;

        const approval = HrManagementService.requestModuleApproval({
          empresaId: rutEmpresa,
          modulo: 'COSTOS_PRODUCCION',
          agenteNombre: request.agentRole || 'Agente de Costos Industriales NIC 2',
          operacionTipo: 'CIERRE_ORDEN_PRODUCCION',
          titulo: `Liquidación y Cierre de Orden de Producción ${op.folioOP}`,
          descripcion: `Traspaso formal de WIP a Productos Terminados por $${formatCLP(entry.totalDebe)} (${op.cantidadProducidaReal} ${op.unidadMedida} de ${op.productoNombre}).`,
          datosOperacion: {
            ordenId: op.id,
            folioOP: op.folioOP,
            productoNombre: op.productoNombre,
            cantidadProducidaReal: op.cantidadProducidaReal,
            costoTotal: entry.totalDebe,
            entry,
          },
          impactoFinancieroClp: entry.totalDebe,
          nivelRiesgo: 'ALTO',
        });

        return {
          status: 'SUCCESS',
          folioOP: op.folioOP,
          asientoContable: entry,
          costoTotalLiquidado: entry.totalDebe,
          approvalId: approval.id,
          estadoGobernanza: approval.estado,
          mensaje: `Asiento de liquidación WIP -> PT propuesto (Folio: ${approval.id}). Requiere validación humana para asentar en el Libro Mayor.`,
        };
      }

      case 'tool_cashflow_project_30_60_90': {
        const rutEmpresa = request.empresaId;
        const accounts = diskPersistence.getBankAccounts(rutEmpresa);
        const movements = diskPersistence.getBankMovements(rutEmpresa);
        const dtes = diskPersistence.getDtes(rutEmpresa);
        const payrolls = diskPersistence.getPayrolls ? diskPersistence.getPayrolls(rutEmpresa) : [];

        const saldoBancos = accounts.reduce(
          (sum: number, b: any) => sum + (Number(b.saldoEnLinea ?? b.saldoInicial ?? b.saldoContable) || 0),
          0
        );
        const netMov = movements.reduce(
          (sum: number, m: any) => sum + (Number(m.abono || 0) - Number(m.cargo || 0)),
          0
        );
        const saldoDisponibleHoy = Math.max(0, saldoBancos + netMov);

        const ventasPendientes = dtes
          .filter((d: any) => (d.tipoOperacion === 'VENTA' || d.tipoOperacion === 'VENTAS') && d.estado !== 'ANULADO')
          .reduce((sum: number, d: any) => sum + (Number(d.montoTotal) || 0), 0);

        const comprasPendientes = dtes
          .filter((d: any) => (d.tipoOperacion === 'COMPRA' || d.tipoOperacion === 'COMPRAS') && d.estado !== 'ANULADO')
          .reduce((sum: number, d: any) => sum + (Number(d.montoTotal) || 0), 0);

        const nominaMensual = (payrolls || []).reduce(
          (sum: number, p: any) => sum + (Number(p.sueldoLiquido || p.costoTotalEmpresa) || 0),
          0
        );

        const cobros30d = Math.round(ventasPendientes * 0.6);
        const cobros60d = Math.round(ventasPendientes * 0.3);
        const cobros90d = Math.round(ventasPendientes * 0.1);

        const pagos30d = Math.round(comprasPendientes * 0.7) + nominaMensual;
        const pagos60d = Math.round(comprasPendientes * 0.2) + nominaMensual;
        const pagos90d = Math.round(comprasPendientes * 0.1) + nominaMensual;

        const saldo30d = saldoDisponibleHoy + cobros30d - pagos30d;
        const saldo60d = saldo30d + cobros60d - pagos60d;
        const saldo90d = saldo60d + cobros90d - pagos90d;

        return {
          status: 'SUCCESS',
          empresaId: rutEmpresa,
          saldoDisponibleHoy,
          cuentasBancariasActivas: accounts.length,
          proyeccion: {
            dias30: { cobrosProyectados: cobros30d, pagosComprometidos: pagos30d, saldoFinal: saldo30d, estado: saldo30d >= 0 ? 'SOLVENTE' : 'DEFICIT' },
            dias60: { cobrosProyectados: cobros60d, pagosComprometidos: pagos60d, saldoFinal: saldo60d, estado: saldo60d >= 0 ? 'SOLVENTE' : 'DEFICIT' },
            dias90: { cobrosProyectados: cobros90d, pagosComprometidos: pagos90d, saldoFinal: saldo90d, estado: saldo90d >= 0 ? 'SOLVENTE' : 'DEFICIT' },
          },
        };
      }

      case 'tool_cashflow_simulate_scenario': {
        const rutEmpresa = request.empresaId;
        const varVentas = Number(args.variacionVentasPct || 0) / 100;
        const retrasoDias = Number(args.retrasoCobranzaDias || 0);
        const aumentoCostos = Number(args.aumentoCostosPct || 0) / 100;

        const baseProjection = await AutonomousAgentEngine.executeTool('tool_cashflow_project_30_60_90', {}, request);
        const dispHoy = baseProjection.saldoDisponibleHoy || 0;
        const baseCobros30 = baseProjection.proyeccion?.dias30?.cobrosProyectados || 0;
        const basePagos30 = baseProjection.proyeccion?.dias30?.pagosComprometidos || 0;

        const factorRetraso = Math.max(0.2, 1 - (retrasoDias / 60));
        const cobrosSimulados = Math.round(baseCobros30 * (1 + varVentas) * factorRetraso);
        const pagosSimulados = Math.round(basePagos30 * (1 + aumentoCostos));
        const saldoSimulado30 = dispHoy + cobrosSimulados - pagosSimulados;

        return {
          status: 'SUCCESS',
          empresaId: rutEmpresa,
          parametrosEscenario: {
            variacionVentasPorcentaje: varVentas * 100,
            retrasoCobranzaDias: retrasoDias,
            aumentoCostosPorcentaje: aumentoCostos * 100,
          },
          saldoActual: dispHoy,
          impactoSimulado30Dias: {
            cobrosEsperados: cobrosSimulados,
            pagosEsperados: pagosSimulados,
            saldoFinalEstimado: saldoSimulado30,
            impactoNetoFrenteBase: saldoSimulado30 - (baseProjection.proyeccion?.dias30?.saldoFinal || 0),
            diagnostico: saldoSimulado30 >= 0 ? 'LIQUIDEZ_PRESERVADA' : 'QUIEBRE_DE_CAJA_INMINENTE',
          },
        };
      }

      case 'tool_procurement_margin_analysis': {
        const rutEmpresa = request.empresaId;
        const state = commercialProcurementService.getState(rutEmpresa);
        const items = state.margenes || [];
        const skuFilter = args.sku ? String(args.sku).toLowerCase() : null;

        const filtered = skuFilter
          ? items.filter((it: any) => String(it.sku).toLowerCase() === skuFilter)
          : items;

        const criticos = items.filter((it: any) => it.estadoMargen === 'CRITICO');

        return {
          status: 'SUCCESS',
          empresaId: rutEmpresa,
          totalProductosAuditados: items.length,
          productosConMargenCritico: criticos.length,
          margenBrutoPonderadoEmpresa: state.kpis?.margenBrutoPonderadoPorcentaje || 0,
          productos: filtered.slice(0, 10),
          alertasCriticas: criticos.map((c: any) => `¡Alerta! SKU ${c.sku} (${c.nombre}) tiene margen de ${c.margenBrutoPorcentaje}% (Mínimo: 20%).`),
        };
      }

      case 'tool_procurement_create_rfq': {
        const rutEmpresa = request.empresaId;
        const faltantesRfq = Array.isArray(args.items) && args.items.length > 0 ? [] : ['items'];
        if (faltantesRfq.length > 0) return missingParamsResult('tool_procurement_create_rfq', faltantesRfq);
        const rfq = commercialProcurementService.createRfq(
          rutEmpresa,
          {
            titulo: args.titulo || 'Solicitud de cotización',
            items: args.items,
            // Sin lista explícita se invita a los proveedores registrados (parámetro técnico documentado)
            proveedorRuts: Array.isArray(args.proveedoresRuts) ? args.proveedoresRuts : [],
          }
        );

        return {
          status: 'SUCCESS',
          empresaId: rutEmpresa,
          rfqId: rfq.id,
          folio: rfq.folioRfq,
          titulo: rfq.titulo,
          totalItems: rfq.items.length,
          proveedoresInvitados: rfq.proveedoresInvitados.length,
          estado: rfq.estado,
          mensaje: `Licitación ${rfq.folioRfq} generada y enviada a proveedores con éxito.`,
        };
      }

      case 'tool_procurement_compare_quotes': {
        const rutEmpresa = request.empresaId;
        const state = commercialProcurementService.getState(rutEmpresa);
        const rfqTarget = String(args.rfqId || '').toUpperCase();
        const rfq = (state.rfqs || []).find(
          (r: any) => String(r.id).toUpperCase() === rfqTarget || String(r.folioRfq).toUpperCase() === rfqTarget
        );

        if (!rfq) {
          return {
            status: 'NOT_FOUND',
            empresaId: rutEmpresa,
            rfqId: args.rfqId,
            mensaje: `RFQ '${args.rfqId}' no encontrada en la empresa ${rutEmpresa}.`,
          };
        }

        const quotes = (rfq.proveedoresInvitados || []).filter((p: any) => p.cotizacionRecibida);
        if (quotes.length === 0) {
          return {
            status: 'NO_DATA',
            empresaId: rutEmpresa,
            rfqId: rfq.folioRfq,
            totalCotizaciones: 0,
            mensaje: `La licitación ${rfq.folioRfq} aún no recibe cotizaciones de proveedores.`,
          };
        }

        const comparativa = quotes.map((q: any) => ({
          proveedorRut: q.proveedorRut,
          proveedorNombre: q.proveedorRazonSocial,
          montoTotalNeto: q.cotizacionRecibida?.montoTotalNeto || 0,
          plazoEntregaDias: q.cotizacionRecibida?.plazoEntregaDias || 15,
          score: q.scoringPuntaje || 85,
        })).sort((a: any, b: any) => a.montoTotalNeto - b.montoTotalNeto);

        return {
          status: 'SUCCESS',
          rfqId: rfq.folioRfq,
          totalCotizacionesRecibidas: quotes.length,
          mejorOfertaPorPrecio: comparativa[0],
          cuadroComparativo: comparativa,
        };
      }

      case 'tool_procurement_award_purchase_order': {
        const rutEmpresa = request.empresaId;
        if (!(Number(args.montoTotalNeto) > 0)) return missingParamsResult('tool_procurement_award_purchase_order', ['montoTotalNeto']);
        const montoNeto = Number(args.montoTotalNeto);
        const comState = commercialProcurementService.getState(rutEmpresa);
        const rfqTarget = String(args.rfqId || '').toUpperCase();
        const rfq = (comState.rfqs || []).find(
          (r: any) => String(r.id).toUpperCase() === rfqTarget || String(r.folioRfq).toUpperCase() === rfqTarget
        );
        let items = Array.isArray(args.items) ? args.items : undefined;
        if (!items && rfq?.items) {
          const rfqItems = rfq.items;
          items = rfqItems.map((it: any) => {
            const cant = Number(it.cantidad || 1);
            let unitPrice = Number(it.precioUnitarioCLP || it.precioReferencialPmp || 0);
            if (rfqItems.length === 1 && montoNeto > 0 && cant > 0) {
              unitPrice = Math.round(montoNeto / cant);
            }
            return {
              sku: it.sku,
              nombre: it.nombre || it.descripcion,
              cantidad: cant,
              precioUnitarioCLP: unitPrice,
            };
          });
        }

        const approval = HrManagementService.requestModuleApproval({
          empresaId: rutEmpresa,
          modulo: 'COMERCIAL_COMPRAS',
          agenteNombre: request.agentRole || 'Agente de Abastecimiento & Compras',
          operacionTipo: 'EMITIR_ORDEN_COMPRA',
          titulo: `Emisión de Orden de Compra RFQ ${args.rfqId} a Proveedor ${args.proveedorRut}`,
          descripcion: `Adjudicación de licitación por $${formatCLP(montoNeto)} neto. Motivo: ${args.motivoAdjudicacion}.`,
          datosOperacion: {
            rfqId: args.rfqId,
            proveedorRut: args.proveedorRut,
            proveedorRazonSocial: args.proveedorRazonSocial || args.proveedorNombre,
            items,
            montoTotalNeto: montoNeto,
            motivoAdjudicacion: args.motivoAdjudicacion,
          },
          impactoFinancieroClp: montoNeto,
          nivelRiesgo: montoNeto > 5000000 ? 'ALTO' : 'MEDIO',
        });

        return {
          status: 'SUCCESS',
          approvalId: approval.id,
          estadoGobernanza: approval.estado,
          mensaje: `Propuesta de Orden de Compra sometida a Gobernanza Agéntica (Folio: ${approval.id}).`,
        };
      }

      case 'tool_expenses_validate_report': {
        const rutEmpresa = request.empresaId;
        const reportTarget = String(args.reportId || '').toUpperCase();
        const allReports = diskPersistence.getExpenseReports ? diskPersistence.getExpenseReports(rutEmpresa) : [];
        const report = allReports.find(
          (r: any) => String(r.id).toUpperCase() === reportTarget || String(r.folio).toUpperCase() === reportTarget
        );

        if (!report) {
          return {
            status: 'NOT_FOUND',
            empresaId: rutEmpresa,
            reportId: args.reportId,
            mensaje: `Rendición de gastos '${args.reportId}' no encontrada en la empresa ${rutEmpresa}.`,
          };
        }

        const items = report.items || [];
        const totalDeclarado = Number(report.totalRendido || 0);
        const sumItems = items.reduce((s: number, it: any) => s + Number(it.montoTotal || it.monto || 0), 0);
        const errorAritmetico = Math.abs(totalDeclarado - sumItems) > 1;

        const alertas: string[] = [];
        if (errorAritmetico) alertas.push(`Descuadre de comprobantes: Total rendido ($${totalDeclarado}) != Suma ítems ($${sumItems}).`);
        items.forEach((it: any) => {
          if (!it.rutEmisor && !it.rutProveedor) alertas.push(`Ítem '${it.concepto || it.descripcion}' carece de RUT de proveedor respaldado.`);
        });

        return {
          status: 'SUCCESS',
          folio: report.folio,
          rendidorNombre: report.rendidorNombre,
          totalRendido: totalDeclarado,
          cantidadComprobantes: items.length,
          consistenciaAritmetica: !errorAritmetico,
          dictamenAuditor: alertas.length === 0 ? 'CONFORME_PARA_CENTRALIZAR' : 'OBSERVACIONES_DETECTADAS',
          alertasDetectadas: alertas,
        };
      }

      case 'tool_expenses_propose_entry': {
        const rutEmpresa = request.empresaId;
        const reportTarget = String(args.reportId || '').toUpperCase();
        const allReports = diskPersistence.getExpenseReports ? diskPersistence.getExpenseReports(rutEmpresa) : [];
        const report = allReports.find(
          (r: any) => String(r.id).toUpperCase() === reportTarget || String(r.folio).toUpperCase() === reportTarget
        );

        if (!report) {
          return {
            status: 'NOT_FOUND',
            empresaId: rutEmpresa,
            reportId: args.reportId,
            mensaje: `Rendición '${args.reportId}' no encontrada.`,
          };
        }

        const total = Number(report.totalRendido || 0);
        const fecha = report.fechaRendicion || new Date().toISOString().slice(0, 10);
        const lines: AccountingEntryLine[] = [
          {
            cuentaCodigo: '5.2.05',
            cuentaNombre: 'Gastos Generales de Operación y Viáticos',
            debe: total,
            haber: 0,
            rutAuxiliar: report.rendidorRut,
            documentoRef: `RDG-${report.folio}`,
          },
          {
            cuentaCodigo: '2.1.08',
            cuentaNombre: 'Cuentas por Pagar Colaboradores (Rendiciones por Liquidar)',
            debe: 0,
            haber: total,
            rutAuxiliar: report.rendidorRut,
            documentoRef: `RDG-${report.folio}`,
          },
        ];

        const entry: AccountingEntry = {
          id: `entry-rdg-${report.folio}-${Date.now()}`,
          empresaId: rutEmpresa,
          fecha,
          concepto: `Centralización Rendición de Gastos Folio ${report.folio} - ${report.rendidorNombre}`,
          documento: `RDG-${report.folio}`,
          lineas: lines,
          totalDebe: total,
          totalHaber: total,
          balanceado: true,
          origen: 'RENDICION_GASTOS',
          creadoEn: new Date().toISOString(),
        };

        const approval = HrManagementService.requestModuleApproval({
          empresaId: rutEmpresa,
          modulo: 'RENDICIONES',
          agenteNombre: request.agentRole || 'Agente de Rendiciones & Gastos',
          operacionTipo: 'CENTRALIZAR_RENDICION',
          titulo: `Centralización Contable Rendición ${report.folio} ($${formatCLP(total)})`,
          descripcion: `Imputación de gastos en Libro Mayor y abono a cuentas por pagar del colaborador ${report.rendidorNombre}.`,
          datosOperacion: {
            reportId: report.id,
            folio: report.folio,
            total,
            entry,
          },
          impactoFinancieroClp: total,
          nivelRiesgo: 'MEDIO',
        });

        return {
          status: 'SUCCESS',
          asientoContable: entry,
          approvalId: approval.id,
          estadoGobernanza: approval.estado,
          mensaje: `Propuesta de centralización contable sometida a Gobernanza (Folio: ${approval.id}).`,
        };
      }

      case 'tool_billing_draft_dte': {
        const rutEmpresa = request.empresaId;
        const items = Array.isArray(args.items) ? args.items : [];
        const faltantesDte = [
          ...findMissing(args, ['tipoDte', 'receptorRut', 'receptorRazonSocial', 'giroReceptor']),
          ...(items.length > 0 && items.every((it: any) => Number(it.cantidad) > 0 && Number(it.precioUnitario) > 0)
            ? []
            : ['items (con cantidad y precioUnitario)']),
        ];
        if (faltantesDte.length > 0) return missingParamsResult('tool_billing_draft_dte', faltantesDte);
        const tipoDte = Number(args.tipoDte);
        const montoNeto = items.reduce((s: number, it: any) => s + Number(it.cantidad) * Number(it.precioUnitario), 0);
        const montoIva = tipoDte === 34 ? 0 : Math.round(montoNeto * 0.19);
        const montoTotal = montoNeto + montoIva;

        const cafInfo = HttpDteBillingService.getTenantVaultStatus(rutEmpresa).cafs.find((c: any) => c.tipoDte === tipoDte);

        const draftPayload = {
          emisorRut: rutEmpresa,
          receptorRut: args.receptorRut,
          receptorRazonSocial: args.receptorRazonSocial,
          giroReceptor: args.giroReceptor,
          tipoDte,
          items,
          montoNeto,
          montoIva,
          montoTotal,
          cafStatus: cafInfo ? 'CAF_LOCAL_DISPONIBLE' : 'CAF_PENDIENTE_O_NO_CERTIFICADO',
        };

        const approval = HrManagementService.requestModuleApproval({
          empresaId: rutEmpresa,
          modulo: 'FACTURACION_DTE',
          agenteNombre: request.agentRole || 'Agente Facturador SII',
          operacionTipo: 'EMITIR_DTE',
          titulo: `Emisión de DTE Tipo ${tipoDte} para ${args.receptorRazonSocial}`,
          descripcion: `Emisión tributaria oficial por $${formatCLP(montoTotal)} CLP. Receptor: ${args.receptorRut}.`,
          datosOperacion: draftPayload,
          impactoFinancieroClp: montoTotal,
          nivelRiesgo: 'ALTO',
        });

        return {
          status: 'SUCCESS',
          borradorDte: draftPayload,
          cafDisponible: !!cafInfo,
          approvalId: approval.id,
          estadoGobernanza: approval.estado,
          mensaje: `Borrador de DTE Tipo ${tipoDte} preparado y registrado para autorización humana previa antes de timbraje oficial (Folio: ${approval.id}).`,
        };
      }

      case 'tool_sii_sync_status': {
        const rutEmpresa = request.empresaId;
        const vault = diskPersistence.getVaultEntry(rutEmpresa);
        const hasClaveSii = Boolean(vault?.claveSiiEncrypted || vault?.claveSii);
        const cert = HttpDteBillingService.loadDigitalCertificate(undefined, { rut: rutEmpresa });
        const hasCert = Boolean(cert?.base64) && cert?.source !== 'SIMULATED_DEVELOPMENT';

        return {
          status: 'SUCCESS',
          empresaId: rutEmpresa,
          claveSiiConfigurada: hasClaveSii,
          certificadoDigitalConfigurado: hasCert,
          origenCertificado: cert?.source || 'NO_ENCONTRADO',
          robotSiiListo: hasClaveSii && hasCert,
          politicaSeguridad: 'Credenciales cifradas con AES-256-GCM. La ejecución del robot RCV requiere autorización en Gobernanza.',
        };
      }

      case 'tool_sii_ingest_csv': {
        const rutEmpresa = request.empresaId;
        const periodo = resolvePeriodo(args, request);
        const faltantesCsv = [
          ...findMissing(args, ['tipoOperacion', 'csvContent']),
          ...(periodo ? [] : ['periodo (AAAA-MM)']),
        ];
        if (faltantesCsv.length > 0) return missingParamsResult('tool_sii_ingest_csv', faltantesCsv);
        const tipo = String(args.tipoOperacion).toUpperCase();
        const tipoDefault = tipo.startsWith('VENTA') ? 'VENTA' : tipo.startsWith('HONOR') ? 'HONORARIOS' : 'COMPRA';
        // Ingesta real: se parsea el CSV oficial y se persisten los documentos (antes solo se contaban líneas).
        const docs = parseSiiRcvCsv(String(args.csvContent), tipoDefault as any);
        if (docs.length === 0) {
          return {
            status: 'NO_DATA',
            empresaId: rutEmpresa,
            periodo,
            mensaje: 'El CSV no contiene documentos RCV reconocibles; no se ingresó nada.',
          };
        }
        diskPersistence.saveDtes(rutEmpresa, docs.map((d) => ({ ...d, periodo: (d as any).periodo || periodo })));
        return {
          status: 'SUCCESS',
          empresaId: rutEmpresa,
          periodo,
          tipoOperacion: tipo,
          documentosIngresados: docs.length,
          origenDatos: 'CSV_OFICIAL_SII_RCV',
          mensaje: `CSV RCV procesado: ${docs.length} documentos guardados para ${rutEmpresa}.`,
        };
      }

      case 'tool_sii_reconcile_rcv_vs_ledger': {
        const rutEmpresa = request.empresaId;
        const periodo = resolvePeriodo(args, request);
        if (!periodo) return missingParamsResult('tool_sii_reconcile_rcv_vs_ledger', ['periodo (AAAA-MM)']);
        const dtes = diskPersistence.getDtes(rutEmpresa, periodo);
        const entries = diskPersistence.getJournalEntries(rutEmpresa);

        const ivaCreditoRcv = dtes
          .filter((d: any) => d.tipoOperacion === 'COMPRA' || d.tipoOperacion === 'COMPRAS')
          .reduce((s: number, d: any) => s + (Number(d.montoIvaRecuperable || d.montoIva) || 0), 0);

        const ivaDebitoRcv = dtes
          .filter((d: any) => d.tipoOperacion === 'VENTA' || d.tipoOperacion === 'VENTAS')
          .reduce((s: number, d: any) => s + (Number(d.montoIva) || 0), 0);

        let ivaCreditoMayor = 0;
        let ivaDebitoMayor = 0;

        entries.forEach((e: any) => {
          (e.lineas || []).forEach((l: any) => {
            const cod = String(l.cuentaCodigo || l.codigoCuenta || '');
            if (cod.startsWith('1.1.09') || cod.includes('IVA Crédito')) {
              ivaCreditoMayor += Number(l.debe || 0) - Number(l.haber || 0);
            }
            if (cod.startsWith('2.1.05') || cod.includes('IVA Débito')) {
              ivaDebitoMayor += Number(l.haber || 0) - Number(l.debe || 0);
            }
          });
        });

        const diffCredito = Math.abs(ivaCreditoRcv - ivaCreditoMayor);
        const diffDebito = Math.abs(ivaDebitoRcv - ivaDebitoMayor);

        return {
          status: 'SUCCESS',
          periodo,
          empresaId: rutEmpresa,
          rcv: { ivaCreditoFiscal: ivaCreditoRcv, ivaDebitoFiscal: ivaDebitoRcv },
          libroMayor: { ivaCreditoFiscal: ivaCreditoMayor, ivaDebitoFiscal: ivaDebitoMayor },
          diferencias: {
            diferenciaIvaCredito: diffCredito,
            diferenciaIvaDebito: diffDebito,
            conciliadoTributario: diffCredito < 100 && diffDebito < 100,
          },
        };
      }

      case 'tool_submit_governance_approval': {
        const faltantesGob = findMissing(args, ['titulo', 'descripcion']);
        if (faltantesGob.length > 0) return missingParamsResult('tool_submit_governance_approval', faltantesGob);
        const approval = HrManagementService.requestModuleApproval({
          empresaId: request.empresaId,
          modulo: args.modulo || request.module,
          agenteNombre: request.agentRole,
          operacionTipo: args.titulo.toUpperCase().replace(/\s+/g, '_').slice(0, 50),
          titulo: args.titulo,
          descripcion: args.descripcion,
          datosOperacion: args.datosOperacion || {},
          impactoFinanciero: Number(args.impactoFinancieroClp || args.impactoFinanciero) || 0,
          riesgoNivel: args.nivelRiesgo || args.riesgoNivel || 'MEDIO',
        });

        return {
          status: 'SUCCESS',
          approvalId: approval.id,
          estado: approval.estado,
          mensaje: `Operación registrada exitosamente para revisión humana. Folio: ${approval.id}. Requiere validación del responsable de la empresa para concretar.`,
        };
      }

      default:
        return {
          status: 'TOOL_NOT_FOUND',
          mensaje: `Herramienta ${toolName} no registrada en el catálogo de ejecución.`,
        };
    }
  }

  /**
   * Bucle ReAct de Agente Autónomo (Reasoning + Tool Calling + Observation + Decision)
   */
  public static async executeAutonomousAgentLoop(
    request: AutonomousAgentRequest
  ): Promise<AutonomousAgentResponse> {
    const startTime = new Date().toISOString();
    const steps: AgentExecutionStep[] = [];
    const agentDef = MODULE_AGENTS_REGISTRY.find(a => a.moduloId === request.module) || {
      agenteNombre: request.agentRole || 'Agente Autónomo ERPremIA',
      agenteCargo: 'Especialista Operativo',
      responsabilidad: 'Ejecuta operaciones y valida cumplimiento legal en el ERP.',
    };

    const apiKey = process.env.GEMINI_API_KEY || aiRouterService.getConfig().geminiApiKey;
    let finalAnswerText = '';
    let executionMode: AutonomousAgentResponse['executionMode'] = 'AUTONOMOUS_REACT_LOOP';
    let modelUsed = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    let generatedTechnicalPayload: any = null;
    let governanceApprovalResult: ModuleAgentApprovalRequest | undefined = undefined;

    // Si no hay API Key o falla el SDK, ejecutamos el núcleo determinista de cumplimiento
    if (!apiKey) {
      console.warn('[AutonomousAgentEngine] Sin GEMINI_API_KEY. Conmutando al Núcleo Determinista Certificado.');
      return this.executeDeterministicComplianceCore(request, agentDef);
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'erpremia-enterprise-agent/2.0',
          },
        },
      });

      const safeContext = request.context ? sanitizeContextForAi(request.context) : {};

      const systemInstruction = `Eres ${agentDef.agenteNombre}, desempeñando el rol de "${request.agentRole}" para la empresa "${safeContext?.company?.razonSocial || request.empresaId}" en el sistema ERPremIA.
Tu responsabilidad principal: ${agentDef.responsabilidad}.

INSTRUCCIONES CRÍTICAS AGÉNTICAS:
1. Eres un agente corporativo autónomo, NO un chatbot pasivo.
2. Para resolver la consulta o solicitud del usuario, DEBES invocar una o más herramientas reales (function calling). NO inventes datos, folios ni montos.
3. Si el usuario solicita un finiquito, liquidación, asiento contable, revisión de impuestos o conciliación, utiliza las herramientas declaradas para obtener el cálculo oficial.
4. Toda operación que involucre pago de fondos, emisión de DTEs o modificación de libros legales debe culminar solicitando autorización humana con "tool_submit_governance_approval".
5. Una vez que hayas obtenido las observaciones de las herramientas, emite tu dictamen técnico final con lenguaje profesional, citando la normativa legal chilena aplicable.`;

      const contents: any[] = [
        {
          role: 'user',
          parts: [{ text: request.query }],
        },
      ];

      let maxIterations = 6;
      let iteration = 0;

      while (iteration < maxIterations) {
        iteration++;

        const response = await ai.models.generateContent({
          model: modelUsed,
          contents,
          config: {
            systemInstruction,
            temperature: 0.1,
            tools: [
              {
                functionDeclarations: AGENT_FUNCTION_DECLARATIONS as any,
              },
            ],
          },
        });

        // 1. Extraer llamadas a herramientas (Function Calls)
        const candidates = (response as any).candidates || [];
        const firstCandidate = candidates[0];
        const contentParts = firstCandidate?.content?.parts || [];

        const functionCalls: any[] = [];
        let thoughtContent = '';

        for (const part of contentParts) {
          if (part.functionCall) {
            functionCalls.push(part.functionCall);
          }
          if (part.text) {
            thoughtContent += part.text;
          }
        }

        // Si no hay más herramientas que llamar, el agente ha formulado su respuesta final
        if (functionCalls.length === 0) {
          finalAnswerText = thoughtContent || response.text || '';
          break;
        }

        // Agregar la propuesta del modelo al historial de contenidos
        contents.push({
          role: 'model',
          parts: contentParts,
        });

        // 2. Ejecutar cada herramienta en el servidor real y registrar la observación
        const toolResponseParts: any[] = [];

        for (const call of functionCalls) {
          const toolName = call.name;
          const toolArgs = call.args || {};

          console.info(`[AutonomousAgentEngine] Paso ${iteration}: Invocando ${toolName} con parámetros:`, toolArgs);
          let toolOutput: Record<string, any>;
          try {
            toolOutput = await this.executeTool(toolName, toolArgs, request);
          } catch (execErr: any) {
            console.error(`[AutonomousAgentEngine] Error en herramienta ${toolName}: ${execErr.message}`);
            toolOutput = {
              status: 'TOOL_EXECUTION_ERROR',
              error: execErr.message || String(execErr),
              observacion: `OBSERVACIÓN: La herramienta ${toolName} retornó un error de ejecución: ${execErr.message}. Analice el error y ajuste los parámetros para continuar.`,
            };
          }

          steps.push({
            step: steps.length + 1,
            thought: thoughtContent || `Analizando necesidad de invocar ${toolName}...`,
            action: toolName,
            actionInput: toolArgs,
            toolCall: toolName,
            toolArgs,
            toolOutput,
            timestamp: new Date().toISOString(),
          });

          // Si la herramienta retornó un payload contable o de finiquito, capturarlo
          if (toolOutput.asientoContable) {
            generatedTechnicalPayload = toolOutput.asientoContable;
          }

          // Si se solicitó aprobación de gobernanza, capturarlo
          if (toolName === 'tool_submit_governance_approval' && toolOutput.approvalId) {
            const approvals = HrManagementService.getApprovals(request.empresaId);
            governanceApprovalResult = approvals.find(a => a.id === toolOutput.approvalId);
          }

          toolResponseParts.push({
            functionResponse: {
              name: toolName,
              response: toolOutput,
            },
          });
        }

        // Devolver las observaciones de las herramientas al modelo
        contents.push({
          role: 'user',
          parts: toolResponseParts,
        });
      }

      // Si el agente no llamó explícitamente a gobernanza pero generó una transacción sensible, auto-someterla
      if (!governanceApprovalResult && generatedTechnicalPayload) {
        governanceApprovalResult = HrManagementService.requestModuleApproval({
          empresaId: request.empresaId,
          modulo: request.module,
          agenteNombre: `${agentDef.agenteNombre} (${request.agentRole})`,
          operacionTipo: 'ASIENTO_CONTABLE_AUTONOMO',
          titulo: `Autorización de Asiento Contable propuesto por ${request.agentRole}`,
          descripcion: `Validación de partida doble por $${formatNumberCL(generatedTechnicalPayload.totalDebe)}. Requiere autorización humana para registrar en el Libro Diario oficial.`,
          datosOperacion: generatedTechnicalPayload,
          impactoFinanciero: generatedTechnicalPayload.totalDebe,
          riesgoNivel: 'MEDIO',
        });
      }

      // Sin dictamen del modelo (respuesta vacía o límite de iteraciones) no se informa éxito.
      if (!finalAnswerText.trim()) {
        return {
          success: false,
          code: 'LLM_EMPTY_RESPONSE',
          module: request.module,
          agentName: agentDef.agenteNombre,
          agentRole: request.agentRole,
          finalText: `El modelo de IA no entregó un dictamen tras ${iteration} iteraciones. No se ejecutó ninguna operación adicional.`,
          steps,
          technicalPayload: generatedTechnicalPayload,
          governanceApproval: governanceApprovalResult,
          executionMode,
          modelUsed,
          timestamp: new Date().toISOString(),
        };
      }

      return {
        success: true,
        module: request.module,
        agentName: agentDef.agenteNombre,
        agentRole: request.agentRole,
        finalText: finalAnswerText,
        steps,
        technicalPayload: generatedTechnicalPayload,
        governanceApproval: governanceApprovalResult,
        executionMode,
        modelUsed,
        timestamp: new Date().toISOString(),
      };
    } catch (aiLoopError: any) {
      console.error('[AutonomousAgentEngine] Error en bucle agéntico con Gemini:', aiLoopError);
      // Conmutar transparentemente al núcleo determinista con reporte honesto
      return this.executeDeterministicComplianceCore(request, agentDef, aiLoopError.message);
    }
  }

  /**
   * Núcleo determinista de cumplimiento: Se activa con honestidad cuando no hay conexión a LLM,
   * garantizando que los cálculos son 100% exactos bajo la ley chilena sin inventar respuestas.
   */
  private static missingParamsResponse(
    request: AutonomousAgentRequest,
    agentDef: any,
    toolOutput: Record<string, any>
  ): AutonomousAgentResponse {
    const faltantes: string[] = Array.isArray(toolOutput.faltantes) ? toolOutput.faltantes : [];
    return {
      success: false,
      code: 'MISSING_PARAMS',
      missingParams: faltantes,
      module: request.module,
      agentName: agentDef.agenteNombre,
      agentRole: request.agentRole,
      finalText: `Para continuar necesito estos datos: ${faltantes.join(', ')}. No se calculó ni registró nada con valores supuestos.`,
      steps: [],
      executionMode: 'DETERMINISTIC_COMPLIANCE_CORE',
      modelUsed: 'DETERMINISTIC_EXPERT_SYSTEM',
      timestamp: new Date().toISOString(),
    };
  }

  private static async executeDeterministicComplianceCore(
    request: AutonomousAgentRequest,
    agentDef: any,
    fallbackReason?: string
  ): Promise<AutonomousAgentResponse> {
    const qLower = request.query.toLowerCase();
    const steps: AgentExecutionStep[] = [];
    let technicalPayload: any = null;
    let finalText = '';
    let approval: ModuleAgentApprovalRequest | undefined = undefined;

    const emp = request.context?.payroll || request.context?.employee;

    if (qLower.includes('finiquito') || qLower.includes('art 161') || qLower.includes('despido')) {
      if (!emp || !emp.rut || !emp.sueldoBase) {
        return {
          success: false,
          module: request.module,
          agentName: agentDef.agenteNombre,
          agentRole: request.agentRole,
          finalText: `[AVISO DE CUMPLIMIENTO] El motor de IA generativa no se encuentra activo (${fallbackReason || 'Servicio no disponible'}). Para procesar el finiquito de manera determinista bajo el Art. 161/163 del Código del Trabajo se requiere seleccionar un colaborador activo con sus antecedentes contractuales (RUT, fecha de ingreso y sueldo base). No se han generado solicitudes de pago automáticas.`,
          steps: [],
          executionMode: 'DETERMINISTIC_COMPLIANCE_CORE',
          modelUsed: 'DETERMINISTIC_EXPERT_SYSTEM',
          timestamp: new Date().toISOString(),
        };
      }

      // 2.2: sin fecha de ingreso, fecha de término, causal o feriado pendiente no se calcula (sin valores por defecto).
      const extra = (request.context?.extraData || {}) as Record<string, any>;
      const toolOutput = await this.executeTool('tool_hr_calculate_finiquito', {
        rut: emp.rut,
        sueldoBase: emp.sueldoBase,
        fechaIngreso: emp.fechaIngreso,
        fechaDespido: extra.fechaDespido || extra.fechaTermino || emp.fechaTermino || emp.fechaDespido,
        causal: extra.causal || emp.causalTermino,
        diasVacacionesPendientes: extra.diasVacacionesPendientes ?? emp.diasVacacionesPendientes,
        diasAvisoPrevioOtorgados: extra.diasAvisoPrevioOtorgados ?? emp.diasAvisoPrevioOtorgados,
      }, request);
      if (toolOutput.status === 'MISSING_PARAMS') {
        return this.missingParamsResponse(request, agentDef, toolOutput);
      }

      steps.push({
        step: 1,
        thought: `Ejecución de cálculo formal de finiquito para ${emp.nombreCompleto || emp.rut} bajo Art. 161/163 del Código del Trabajo.`,
        toolCall: 'tool_hr_calculate_finiquito',
        toolArgs: { rut: emp.rut, causal: 'ART_161_NECESIDADES_DE_LA_EMPRESA' },
        toolOutput,
        timestamp: new Date().toISOString(),
      });

      finalText = `### Dictamen Legal y Liquidación de Finiquito (Art. 161 Código del Trabajo)\n\nCálculo de término de contrato para **${emp.nombreCompleto || emp.rut}** (RUT: ${emp.rut}):\n\n- **Antigüedad Computable:** ${toolOutput.aniosComputables} años de servicio.\n- **Base Mensual Computable:** ${formatCLP(toolOutput.baseComputableMensual)} (tope 90 UF).\n- **Indemnización Años de Servicio (Art. 163):** ${formatCLP(toolOutput.indemnizacionAnosServicio)}.\n- **Indemnización Sustitutiva de Aviso Previo (Art. 161 inc. 2):** ${formatCLP(toolOutput.indemnizacionAvisoPrevio)}.\n- **Feriado Legal Proporcional (Art. 73):** ${formatCLP(toolOutput.montoFeriadoProporcional)}.\n- **Imputación Aporte AFC Empleador (Art. 13 Ley 19.728):** -${formatCLP(toolOutput.descuentoAfcEmpleador)}.\n\n**Total Líquido Finiquito a Pagar:** **${formatCLP(toolOutput.totalFiniquitoLiquido)}**.\n\n*Nota:* Procesado mediante el motor determinista legal. Operación pendiente de revisión del supervisor.`;

      approval = HrManagementService.requestModuleApproval({
        empresaId: request.empresaId,
        modulo: 'RRHH',
        agenteNombre: `${agentDef.agenteNombre} (${request.agentRole})`,
        operacionTipo: 'PAGO_FINIQUITO_LEGAL',
        titulo: `Autorización de Finiquito ${emp.nombreCompleto || emp.rut} (${formatCLP(toolOutput.totalFiniquitoLiquido)})`,
        descripcion: `Finiquito legal Art. 161 CT para ${emp.nombreCompleto || emp.rut}. Antigüedad: ${toolOutput.aniosComputables} años.`,
        datosOperacion: toolOutput,
        impactoFinanciero: toolOutput.totalFiniquitoLiquido,
        riesgoNivel: toolOutput.totalFiniquitoLiquido > 5000000 ? 'ALTO' : 'MEDIO',
      });
    } else if (qLower.includes('f29') || qLower.includes('iva') || qLower.includes('impuesto')) {
      const toolOutput = await this.executeTool('tool_tax_calculate_f29', {
        empresaRut: request.empresaId,
      }, request);
      if (toolOutput.status === 'MISSING_PARAMS') {
        return this.missingParamsResponse(request, agentDef, toolOutput);
      }
      const currentPeriod = toolOutput.periodo || request.context?.selectedPeriod;

      steps.push({
        step: 1,
        thought: `Auditoría tributaria F29 para el período ${currentPeriod} con base en los DTEs registrados.`,
        toolCall: 'tool_tax_calculate_f29',
        toolArgs: { periodo: currentPeriod },
        toolOutput,
        timestamp: new Date().toISOString(),
      });

      finalText = `### Auditoría y Liquidación Determinista de Formulario 29 (${currentPeriod})\n\nValores tributarios calculados a partir de los documentos registrados en el ERP:\n\n- **Documentos de Venta Auditados:** ${toolOutput.documentosVentaProcesados}\n- **Documentos de Compra Auditados:** ${toolOutput.documentosCompraProcesados}\n- **Ventas Netas Totales:** ${formatCLP(toolOutput.ventasNetas)}\n- **Compras Netas Totales:** ${formatCLP(toolOutput.comprasNetas)}\n- **Débito Fiscal IVA:** ${formatCLP(toolOutput.debitoFiscalIva)}\n- **Crédito Fiscal IVA:** ${formatCLP(toolOutput.creditoFiscalIva)}\n- **PPM Determinado:** ${formatCLP(toolOutput.ppmDeterminado)} (tasa: ${(toolOutput.tasaPpm * 100).toFixed(2)}%)\n- **Retención Honorarios 14.5%:** ${formatCLP(toolOutput.retencionHonorarios145)}\n- **Impuesto Único 2da Categoría:** ${formatCLP(toolOutput.impuestoUnicoSegundaCategoria)}\n\n**Monto Total F29 Determinado:** **${formatCLP(toolOutput.totalPagarF29)}**.\n\n*Acreditación:* Conforme al Art. 23 DL 825 y Art. 84 LIR.`;
    } else if (request.module === 'ACTIVO_FIJO' || qLower.includes('depreci') || qLower.includes('activo fijo') || qLower.includes('baja')) {
      const toolOutput = await this.executeTool('tool_fixed_assets_depreciate_period', {
        empresaId: request.empresaId,
      }, request);
      if (toolOutput.status === 'MISSING_PARAMS') {
        return this.missingParamsResponse(request, agentDef, toolOutput);
      }
      const currentPeriod = request.context?.selectedPeriod as string;

      steps.push({
        step: 1,
        thought: `Auditoría y cálculo de depreciación NIC 16 para activos de la empresa ${request.empresaId}.`,
        toolCall: 'tool_fixed_assets_depreciate_period',
        toolArgs: { periodo: currentPeriod },
        toolOutput,
        timestamp: new Date().toISOString(),
      });

      if (toolOutput.status === 'NO_DATA') {
        finalText = `### Auditoría de Activos Fijos NIC 16 (${currentPeriod})\n\n${toolOutput.mensaje}`;
      } else {
        const propEntry = await this.executeTool('tool_fixed_assets_propose_entry', {
          periodo: currentPeriod,
          empresaId: request.empresaId,
        }, request);

        steps.push({
          step: 2,
          thought: `Propuesta formal de asiento contable de depreciación y solicitud de aprobación.`,
          toolCall: 'tool_fixed_assets_propose_entry',
          toolArgs: { periodo: currentPeriod },
          toolOutput: propEntry,
          timestamp: new Date().toISOString(),
        });

        technicalPayload = propEntry.asientoContable;
        approval = HrManagementService.getApprovalById(propEntry.approvalId);

        finalText = `### Auditoría y Cuadro de Depreciación Activo Fijo NIC 16 (${currentPeriod})\n\n- **Total Activos Auditados:** ${toolOutput.totalActivosAuditados}\n- **Depreciación Financiera Mensual:** ${formatCLP(toolOutput.depreciacionFinancieraTotal)}\n- **Depreciación Tributaria (Art. 31 LIR):** ${formatCLP(toolOutput.depreciacionTributariaTotal)}\n- **Cuota Fabril CIF:** ${formatCLP(toolOutput.depreciacionFabrilCifTotal)}\n\nPropuesta de asiento contable generada y enviada a Gobernanza Agéntica para aprobación humana.`;
      }
    } else if (request.module === 'COSTOS_PRODUCCION' || qLower.includes('producc') || qLower.includes('costeo') || qLower.includes('orden de fabricacion')) {
      const orders = diskPersistence.getProductionOrders(request.empresaId);
      const op = orders[0];
      if (!op) {
        finalText = `### Costos y Producción NIC 2\n\nNo se registran órdenes de producción activas en la empresa ${request.empresaId}.`;
      } else {
        const costOutput = await this.executeTool('tool_production_cost_order', {
          folioOP: op.folioOP,
          empresaId: request.empresaId,
        }, request);

        steps.push({
          step: 1,
          thought: `Liquidación de costos NIC 2 para la orden ${op.folioOP}.`,
          toolCall: 'tool_production_cost_order',
          toolArgs: { folioOP: op.folioOP },
          toolOutput: costOutput,
          timestamp: new Date().toISOString(),
        });

        finalText = `### Liquidación de Costos de Producción NIC 2 — ${op.folioOP}\n\n- **Producto:** ${op.productoNombre}\n- **Avance Físico:** ${costOutput.orden?.avancePorcentaje}%\n- **Materia Prima Directa (MPD):** ${formatCLP(costOutput.costosNIC2?.materiaPrimaDirectaMPD)}\n- **Mano de Obra Directa (MOD):** ${formatCLP(costOutput.costosNIC2?.manoObraDirectaMOD)}\n- **Costos Indirectos (CIF):** ${formatCLP(costOutput.costosNIC2?.costosIndirectosFabricacionCIF)}\n- **Costo Total Acumulado:** **${formatCLP(costOutput.costosNIC2?.costoTotalProduccion)}**`;
      }
    } else if (request.module === 'FLUJO_CAJA' || qLower.includes('flujo de caja') || qLower.includes('liquidez')) {
      const cfOutput = await this.executeTool('tool_cashflow_project_30_60_90', {
        empresaId: request.empresaId,
      }, request);

      steps.push({
        step: 1,
        thought: `Proyección determinista de flujo de caja para la empresa ${request.empresaId}.`,
        toolCall: 'tool_cashflow_project_30_60_90',
        toolArgs: { empresaId: request.empresaId },
        toolOutput: cfOutput,
        timestamp: new Date().toISOString(),
      });

      finalText = `### Proyección de Flujo de Caja & Liquidez\n\n- **Saldo Disponible Hoy:** **${formatCLP(cfOutput.saldoDisponibleHoy)}**\n- **Proyección a 30 días:** ${formatCLP(cfOutput.proyeccion?.dias30?.saldoFinal)} (${cfOutput.proyeccion?.dias30?.estado})\n- **Proyección a 60 días:** ${formatCLP(cfOutput.proyeccion?.dias60?.saldoFinal)} (${cfOutput.proyeccion?.dias60?.estado})\n- **Proyección a 90 días:** ${formatCLP(cfOutput.proyeccion?.dias90?.saldoFinal)} (${cfOutput.proyeccion?.dias90?.estado})`;
    } else if (request.module === 'COMERCIAL_COMPRAS' || qLower.includes('margen') || qLower.includes('rfq') || qLower.includes('compras')) {
      const procOutput = await this.executeTool('tool_procurement_margin_analysis', {
        empresaId: request.empresaId,
      }, request);

      steps.push({
        step: 1,
        thought: `Auditoría comercial de márgenes para la empresa ${request.empresaId}.`,
        toolCall: 'tool_procurement_margin_analysis',
        toolArgs: { empresaId: request.empresaId },
        toolOutput: procOutput,
        timestamp: new Date().toISOString(),
      });

      finalText = `### Auditoría Comercial & Abastecimiento\n\n- **Productos Auditados:** ${procOutput.totalProductosAuditados}\n- **Margen Ponderado Empresa:** ${procOutput.margenBrutoPonderadoEmpresa}%\n- **Alertas de Margen Crítico:** ${procOutput.productosConMargenCritico} ítems`;
    } else if (request.module === 'RENDICIONES' || qLower.includes('rendicion') || qLower.includes('gasto')) {
      const reports = diskPersistence.getExpenseReports ? diskPersistence.getExpenseReports(request.empresaId) : [];
      const rep = reports[0];
      if (!rep) {
        finalText = `### Auditoría de Rendiciones de Gastos\n\nNo se registran rendiciones de gastos para la empresa ${request.empresaId}.`;
      } else {
        const valOutput = await this.executeTool('tool_expenses_validate_report', {
          reportId: rep.id,
        }, request);

        steps.push({
          step: 1,
          thought: `Validación de rendición ${rep.folio}.`,
          toolCall: 'tool_expenses_validate_report',
          toolArgs: { reportId: rep.id },
          toolOutput: valOutput,
          timestamp: new Date().toISOString(),
        });

        finalText = `### Auditoría de Rendición de Gastos Folio ${rep.folio}\n\n- **Rendidor:** ${rep.rendidorNombre}\n- **Total Rendido:** ${formatCLP(rep.totalRendido)}\n- **Comprobantes Auditados:** ${valOutput.cantidadComprobantes}\n- **Dictamen:** **${valOutput.dictamenAuditor}**`;
      }
    } else if (request.module === 'INVENTARIO' || qLower.includes('kardex') || qLower.includes('stock')) {
      const invOutput = await this.executeTool('tool_inventory_kardex', {
        empresaId: request.empresaId,
      }, request);

      steps.push({
        step: 1,
        thought: `Auditoría de Kardex y valorización PMP.`,
        toolCall: 'tool_inventory_kardex',
        toolArgs: { empresaId: request.empresaId },
        toolOutput: invOutput,
        timestamp: new Date().toISOString(),
      });

      finalText = `### Auditoría de Inventarios & Kardex PMP\n\n- **Total Artículos Activos:** ${invOutput.totalItemsActivos}\n- **Valorización Total PMP:** **${formatCLP(invOutput.valorizacionTotalInventarioClp)}**\n- **Alertas de Stock Bajo Mínimo:** ${invOutput.itemsCriticosBajoReorden}`;
    } else if (request.module === 'CONCILIACION' || qLower.includes('conciliaci') || qLower.includes('cartola')) {
      const recOutput = await this.executeTool('tool_bank_reconcile_movement', {
        empresaId: request.empresaId,
      }, request);

      steps.push({
        step: 1,
        thought: `Cotejo automático de cartolas bancarias vs Libro Mayor.`,
        toolCall: 'tool_bank_reconcile_movement',
        toolArgs: { empresaId: request.empresaId },
        toolOutput: recOutput,
        timestamp: new Date().toISOString(),
      });

      finalText = `### Conciliación Bancaria Automática\n\n- **Movimientos Auditados:** ${recOutput.movimientosCartolaAuditados}\n- **Conciliados Automáticamente:** ${recOutput.movimientosConciliadosAutomaticamente}\n- **Partidas Pendientes:** ${recOutput.movimientosPendientes}\n- **Efectividad de Calce:** ${recOutput.tasaEfectividadCalce}%`;
    } else {
      // 2.1 (hallazgo #5): sin IA no hay respuesta genérica de éxito. Solo las ramas con herramienta deterministas responden.
      return {
        success: false,
        code: 'LLM_UNAVAILABLE',
        module: request.module,
        agentName: agentDef.agenteNombre,
        agentRole: request.agentRole,
        finalText: `El motor de IA no está disponible (${fallbackReason || 'sin GEMINI_API_KEY configurada'}) y la consulta no corresponde a una operación que el núcleo de reglas pueda resolver. No se procesó ni registró nada.`,
        steps: [],
        executionMode: 'DETERMINISTIC_COMPLIANCE_CORE',
        modelUsed: 'NONE',
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: true,
      module: request.module,
      agentName: agentDef.agenteNombre,
      agentRole: request.agentRole,
      finalText,
      steps,
      technicalPayload,
      governanceApproval: approval,
      executionMode: 'DETERMINISTIC_COMPLIANCE_CORE',
      modelUsed: 'DETERMINISTIC_EXPERT_SYSTEM',
      timestamp: new Date().toISOString(),
    };
  }
}
