import type { ModuleAgentApprovalRequest } from '../types';

export interface ModuleAgentDefinition {
  moduloId: string;
  moduloNombre: string;
  agenteNombre: string;
  agenteCargo: string;
  agenteAvatar: string; // Lucide icon
  responsabilidad: string;
  operacionesAutonomas: string[];
  operacionesQueRequierenAprobacion: string[];
}

export const MODULE_AGENTS_REGISTRY: ModuleAgentDefinition[] = [
  {
    moduloId: 'CONTABILIDAD',
    moduloNombre: 'Agente Contable Senior & Libros IFRS',
    agenteNombre: 'Camila Valenzuela',
    agenteCargo: 'Auditora Senior IFRS & Contralora General',
    agenteAvatar: 'BookOpen',
    responsabilidad:
      'Garantiza la inmutabilidad del Libro Diario, valida partida doble al centavo, administra el Plan de Cuentas IFRS y formula balances de 8 columnas.',
    operacionesAutonomas: [
      'Validación matemática de partida doble y consistencia de asientos.',
      'Generación de balances de comprobación y mayores auxiliares.',
      'Detección de descuadres o anomalías en imputaciones.',
    ],
    operacionesQueRequierenAprobacion: [
      'Reversión formal de asientos contables históricos.',
      'Cierre y bloqueo mensual o anual del ejercicio contable.',
      'Reapertura extraordinaria de períodos contables cerrados.',
    ],
  },
  {
    moduloId: 'TRIBUTARIO_SII',
    moduloNombre: 'Agente Fiscal F29 & Cumplimiento SII',
    agenteNombre: 'Jorge Rojas',
    agenteCargo: 'Especialista Tributario & Auditor SII',
    agenteAvatar: 'FileCheck',
    responsabilidad:
      'Supervisa la conciliación del RCV vs Contabilidad, determina IVA Débito/Crédito/No Recuperable (Art. 23 DL 825), retenciones de honorarios al 14.5% y liquida el F29.',
    operacionesAutonomas: [
      'Sincronización periódica con el portal RCV del SII.',
      'Clasificación automática de IVA No Recuperable para empresas con giro exento.',
      'Cálculo preliminar de F29 y proyección de PPM mensual.',
    ],
    operacionesQueRequierenAprobacion: [
      'Declaración oficial y pago electrónico de F29 ante la TGR/SII.',
      'Reclamación o acuse de recibo de DTEs comerciales ante el SII.',
      'Modificación de tasas de PPM o rectificatorias de impuestos.',
    ],
  },
  {
    moduloId: 'TESORERIA',
    moduloNombre: 'Flujo de Caja, Bancos & Tesorería',
    agenteNombre: 'Vera Albornoz',
    agenteCargo: 'Directora Financiera & Socia Virtual',
    agenteAvatar: 'TrendingUp',
    responsabilidad:
      'Monitorea la liquidez diaria, proyecta flujo de caja a 30/60/90 días, concilia cartolas bancarias y administra compromisos de pago.',
    operacionesAutonomas: [
      'Lectura de cartolas bancarias e identificación de movimientos coincidentes.',
      'Proyección de escenarios de liquidez y detección de riesgo de caja.',
      'Propuesta de programación semanal de pagos a proveedores.',
    ],
    operacionesQueRequierenAprobacion: [
      'Ejecución de nóminas de transferencia bancaria TEF a terceros.',
      'Emisión o custodia de cheques y pagarés corporativos.',
      'Contratación o modificación de líneas de crédito bancarias.',
    ],
  },
  {
    moduloId: 'COMERCIAL_COMPRAS',
    moduloNombre: 'Gestión Comercial & Aprovisionamiento',
    agenteNombre: 'Esteban Morales',
    agenteCargo: 'Gerente Comercial & Aprovisionamiento Sr.',
    agenteAvatar: 'Briefcase',
    responsabilidad:
      'Optimiza el abastecimiento estratégico, gestiona licitaciones RFQ con proveedores, cuida los márgenes brutos y previene quiebres de stock.',
    operacionesAutonomas: [
      'Evaluación multicriterio de cotizaciones de proveedores (precio, plazo, calidad).',
      'Cálculo de punto de reorden y sugerencia de compras por reposición.',
      'Seguimiento automático a cotizaciones comerciales enviadas a clientes.',
    ],
    operacionesQueRequierenAprobacion: [
      'Adjudicación de órdenes de compra superiores a 50 UF.',
      'Aprobación de condiciones de crédito o descuentos extraordinarios a clientes.',
      'Selección final de proveedores en licitaciones de insumos críticos.',
    ],
  },
  {
    moduloId: 'RRHH',
    moduloNombre: 'Recursos Humanos, Remuneraciones & Clima',
    agenteNombre: 'Sofía Castro',
    agenteCargo: 'Gerente de Recursos Humanos & Personas',
    agenteAvatar: 'Users',
    responsabilidad:
      'Conduce la gestión integral de colaboradores, liquidaciones mensuales con Ley 21.735, reliquidaciones retroactivas, feriados, licencias LME y clima laboral.',
    operacionesAutonomas: [
      'Cálculo determinista de nóminas y liquidaciones de sueldo.',
      'Formulación de reliquidaciones por diferencias salariales pasadas.',
      'Diagnóstico continuo de clima organizacional, eNPS y ausentismo.',
    ],
    operacionesQueRequierenAprobacion: [
      'Aprobación final del pago masivo de remuneraciones y PreviRed.',
      'Emisión de cartas de despido y formalización de finiquitos ante Mi DT.',
      'Contratación de nuevos colaboradores y aumentos salariales pactados.',
    ],
  },
  {
    moduloId: 'INVENTARIO',
    moduloNombre: 'Bodega, Stock & Logística WMS',
    agenteNombre: 'Diego Morales',
    agenteCargo: 'Jefe de Bodega & Logística Integral',
    agenteAvatar: 'Package',
    responsabilidad:
      'Controla existencias físicas, kárdex permanente valorizado PMP/FIFO, despachos y recepciones de mercadería.',
    operacionesAutonomas: [
      'Registro de ingresos por recepciones de compras validadas con DTE.',
      'Valorización de existencias bajo norma NIC 2.',
      'Alertas tempranas de stock mínimo y mermas de almacén.',
    ],
    operacionesQueRequierenAprobacion: [
      'Castigo o baja de inventario por obsolescencia o pérdida.',
      'Ajustes de inventario posteriores a tomas físicas anuales.',
      'Traslado de existencias entre sucursales de distinta razón social.',
    ],
  },
  {
    moduloId: 'ACTIVO_FIJO',
    moduloNombre: 'Activo Fijo, Propiedad Planta & Equipo (NIC 16)',
    agenteNombre: 'Nicolás Arancibia',
    agenteCargo: 'Auditor de Activos Fijos & Valorización IFRS',
    agenteAvatar: 'Building2',
    responsabilidad:
      'Controla el ciclo de vida del activo fijo, cuadros de depreciación tributaria y financiera (IFRS), corrección monetaria y bajas de bienes.',
    operacionesAutonomas: [
      'Cálculo mensual de depreciación lineal y acelerada.',
      'Actualización de tablas de vida útil y valor residual.',
      'Detección de diferencias entre depreciación financiera y tributaria.',
    ],
    operacionesQueRequierenAprobacion: [
      'Baja, enajenación o castigo contable de bienes del activo fijo.',
      'Revalúo técnico o deterioro según norma NIC 36.',
      'Incorporación de proyectos en curso al activo fijo en explotación.',
    ],
  },
  {
    moduloId: 'FLUJO_CAJA',
    moduloNombre: 'Proyección de Flujo de Caja & Posición de Liquidez',
    agenteNombre: 'Vera Albornoz',
    agenteCargo: 'Directora Financiera & Estrategia de Liquidez',
    agenteAvatar: 'TrendingUp',
    responsabilidad:
      'Modela flujos futuros de ingresos y egresos, evalúa cobertura de caja y advierte riesgos de liquidez a 30, 60 y 90 días.',
    operacionesAutonomas: [
      'Proyección de cobranzas basada en vencimientos DTE y factoring.',
      'Consolidación de compromisos tributarios, proveedores y remuneraciones.',
      'Simulación de estrés de caja ante retrasos de pago de clientes.',
    ],
    operacionesQueRequierenAprobacion: [
      'Compromiso formal de calendario de pagos a proveedores estratégicos.',
      'Solicitud de financiamiento bancario o cesión de créditos en factoring.',
    ],
  },
  {
    moduloId: 'COSTOS_PRODUCCION',
    moduloNombre: 'Costos Industriales, Recetas & Órdenes de Producción',
    agenteNombre: 'Marcelo Valdés',
    agenteCargo: 'Ingeniero de Costos & Procesos Productivos',
    agenteAvatar: 'Factory',
    responsabilidad:
      'Monitorea el consumo de materias primas, mano de obra directa (MOD), costos indirectos de fabricación (CIF) y determina el costo unitario de producto terminado.',
    operacionesAutonomas: [
      'Consolidación de costos directos e indirectos por orden de producción.',
      'Determinación de variaciones de costo estándar versus real.',
      'Generación de asientos de cierre y absorción de costos a producto terminado.',
    ],
    operacionesQueRequierenAprobacion: [
      'Cierre y liquidación contable de órdenes de producción con sobrecosto > 10%.',
      'Modificación de fórmulas maestras y recetas de fabricación.',
    ],
  },
  {
    moduloId: 'CONCILIACION',
    moduloNombre: 'Conciliación Bancaria & Medios de Pago Electrónicos',
    agenteNombre: 'Claudia Espinoza',
    agenteCargo: 'Especialista en Conciliaciones Bancarias & TEF',
    agenteAvatar: 'CheckCheck',
    responsabilidad:
      'Audita cartolas bancarias, coteja cargos y abonos con el Libro Diario y detecta partidas pendientes o no identificadas.',
    operacionesAutonomas: [
      'Calce multicriterio exacto por monto, RUT de auxiliar y fecha contable.',
      'Clasificación automática de cargos bancarios por comisiones e intereses.',
      'Generación de informes de partidas de conciliación pendientes de regularización.',
    ],
    operacionesQueRequierenAprobacion: [
      'Ajuste o imputación de partidas bancarias no aclaradas superiores a 5 UF.',
      'Generación masiva de asientos de regularización en caja/banco.',
    ],
  },
  {
    moduloId: 'RENDICIONES',
    moduloNombre: 'Rendiciones de Gastos, Viáticos & Fondos por Rendir',
    agenteNombre: 'Paula Carvallo',
    agenteCargo: 'Supervisora de Rendiciones & Cumplimiento de Gastos',
    agenteAvatar: 'Receipt',
    responsabilidad:
      'Verifica comprobantes de rendición de fondos, imputa gastos a centros de costo/proyectos y calcula reintegros o reembolsos.',
    operacionesAutonomas: [
      'Validación de comprobantes, boletas y facturas rendidas contra el RCV.',
      'Verificación aritmética de subtotales, propinas y gastos exentos.',
      'Estructuración del asiento de liquidación y cierre de la rendición.',
    ],
    operacionesQueRequierenAprobacion: [
      'Aprobación final del reembolso de fondos al empleado rendidor.',
      'Rechazo formal de comprobantes no deducibles o duplicados.',
    ],
  },
];

export class ModuleAgentGovernanceService {
  /**
   * Obtiene la definición del agente responsable de un módulo
   */
  static getAgentByModule(moduloId: string): ModuleAgentDefinition | undefined {
    return MODULE_AGENTS_REGISTRY.find(a => a.moduloId === moduloId);
  }

  /**
   * Lista todos los agentes responsables de los módulos del ERP
   */
  static getAllModuleAgents(): ModuleAgentDefinition[] {
    return MODULE_AGENTS_REGISTRY;
  }

  /**
   * Registra una propuesta agéntica que requiere autorización humana
   */
  static createApprovalRequest(
    modulo: ModuleAgentApprovalRequest['modulo'],
    operacionTipo: string,
    titulo: string,
    descripcion: string,
    datosOperacion: Record<string, any>,
    empresaId: string,
    impactoFinancieroClp: number = 0,
    nivelRiesgo: ModuleAgentApprovalRequest['riesgoNivel'] = 'MEDIO'
  ): ModuleAgentApprovalRequest {
    const agent = this.getAgentByModule(modulo);
    const agenteNombre = agent ? `${agent.agenteNombre} (${agent.agenteCargo})` : 'Agente del Módulo';

    const hrService = (globalThis as any)?.__hrManagementService;
    if (hrService) {
      return hrService.requestModuleApproval({
        empresaId,
        modulo,
        agenteNombre,
        operacionTipo,
        titulo,
        descripcion,
        datosOperacion,
        impactoFinancieroClp,
        impactoFinanciero: impactoFinancieroClp,
        nivelRiesgo,
        riesgoNivel: nivelRiesgo,
      });
    }

    return {
      id: `apr-${Date.now()}`,
      empresaId,
      modulo,
      agenteNombre,
      operacionTipo,
      titulo,
      descripcion,
      datosOperacion,
      impactoFinancieroClp,
      impactoFinanciero: impactoFinancieroClp,
      riesgoNivel: nivelRiesgo,
      nivelRiesgo,
      estado: 'PENDIENTE',
      solicitadoEn: new Date().toISOString(),
    };
  }

  /**
   * Concreta la operación tras la autorización humana
   */
  static async executeApprovedOperation(approvalId: string, userId: string, approved: boolean): Promise<ModuleAgentApprovalRequest> {
    const hrService = (globalThis as any)?.__hrManagementService;
    if (hrService) {
      return await hrService.resolveApproval(approvalId, userId, approved);
    }
    return await this.executeApprovedOperationViaApi(approvalId, userId, approved);
  }

  /**
   * Resuelve una solicitud en el servidor (HTTP) con impacto real en Libro Mayor
   */
  static async executeApprovedOperationViaApi(approvalId: string, userId: string, approved: boolean): Promise<ModuleAgentApprovalRequest> {
    const res = await fetch(`/api/governance/approvals/${encodeURIComponent(approvalId)}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, approved }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Error al resolver la aprobación en el servidor.');
    }
    const json = await res.json();
    return json.data;
  }

  /**
   * Lista solicitudes pendientes por empresa (local / servidor)
   */
  static getPendingApprovals(empresaId: string): ModuleAgentApprovalRequest[] {
    const hrService = (globalThis as any)?.__hrManagementService;
    if (hrService) {
      return hrService.getApprovals(empresaId).filter((a: any) => a.estado === 'PENDIENTE');
    }
    return [];
  }

  /**
   * Obtiene solicitudes pendientes de aprobación desde el servidor (HTTP)
   */
  static async fetchPendingApprovalsFromApi(empresaId: string, modulo?: string): Promise<ModuleAgentApprovalRequest[]> {
    try {
      const url = `/api/governance/approvals?empresaId=${encodeURIComponent(empresaId)}${modulo ? `&modulo=${encodeURIComponent(modulo)}` : ''}&estado=PENDIENTE`;
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        return json.data || [];
      }
    } catch (e) {
      console.warn('[ModuleAgentGovernanceService] Error al consultar API de aprobaciones:', e);
    }
    return this.getPendingApprovals(empresaId).filter(a => !modulo || a.modulo === modulo);
  }
}

