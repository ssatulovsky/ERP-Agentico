import type { 
  EmployeePayroll, 
  ChileIndicators, 
  AccountingEntry, 
  AccountingEntryLine,
  PayrollReliquidationAdjustment,
  HrClimateSurvey,
  ModuleAgentApprovalRequest,
  SocialSecurityHistoricalPayment,
  SocialSecurityEmployeeDetail,
  PayrollConceptEvolutionPoint,
  BillingEmissionDraft,
  BillingItemDetail,
  HttpDteEmissionPayload
} from '../types';
import { 
  DEFAULT_INDICATORS, 
  AFP_RATES, 
  calculateImpuestoUnico, 
  calculatePayroll, 
  enrichEntryWithChartAttributes 
} from '../utils/chileanAccounting';
import { INITIAL_FIRM, getDemoClients } from '../data/seedData';
import { isDemoModeEnabled } from '../config/demoMode';
import { commercialProcurementService } from './commercialProcurementService';

const getDiskPersistence = (): any => (globalThis as any).__diskPersistence;
const safeDynamicImport = async (moduleSpecifier: string): Promise<any> => Function('m', 'return import(m)')(moduleSpecifier);
const getHttpDteBillingService = async (): Promise<any> => {
  if ((globalThis as any).__httpDteBillingService) {
    return (globalThis as any).__httpDteBillingService;
  }
  try {
    const mod = await safeDynamicImport('./httpDteBillingService');
    return mod?.HttpDteBillingService;
  } catch (err: any) {
    console.warn('[HrManagementService] Could not dynamically load HttpDteBillingService:', err?.message);
    return null;
  }
};

/**
 * Generador de hash determinista e interoperable seguro para navegador y Node.js (sin dependencias node:crypto)
 */
function generateBrowserSafeHash(input: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c64e6d;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const p1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const p2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return `${p1}${p2}${p1}${p2}${p1}${p2}${p1}${p2}`.substring(0, 64);
}

/**
 * Generador de identificadores únicos seguro para navegador y Node.js
 */
function generateBrowserSafeId(prefix: string): string {
  const ts = Date.now().toString(36);
  const rnd = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${ts}-${rnd}`;
}

export interface RetroactiveAdjustmentInput {
  empresaId: string;
  employeeId: string;
  rutEmpleado: string;
  nombreEmpleado: string;
  periodoDevengado: string; // YYYY-MM original
  periodoPago: string; // YYYY-MM en que se liquida
  motivoAjuste: 'AUMENTO_SUELDO_RETROACTIVO' | 'BONO_RETROACTIVO' | 'CORRECCION_HORAS_EXTRAS' | 'CORRECCION_DIAS_TRABAJADOS' | 'DIFERENCIAL_COMISIONES' | 'ERROR_CALCULO' | 'RESOLUCION_DT_TRIBUNAL';
  detalleMotivo: string;
  diferencialSueldoBase?: number;
  diferencialHorasExtras?: number;
  diferencialComisiones?: number;
  diferencialGratificacion?: number;
  // Parámetros históricos del mes devengado
  afpNombre: 'CAPITAL' | 'CUPRUM' | 'HABITAT' | 'PLANVITAL' | 'PROVIDA' | 'MODELO' | 'UNO';
  saludTipo: 'FONASA' | 'ISAPRE';
  tipoContrato: 'INDEFINIDO' | 'PLAZO_FIJO';
  utmPeriodoDevengado: number;
  ufPeriodoDevengado: number;
  baseImponibleOriginal: number;
  impuestoUnicoOriginal: number;
}

export class HrManagementService {
  /**
   * Almacén en memoria de liquidaciones históricas (Sincronizado con base relacional)
   */
  private static historicalSettlements: Map<string, EmployeePayroll[]> = new Map();
  private static reliquidationsStore: PayrollReliquidationAdjustment[] = [];
  private static approvalsStore: ModuleAgentApprovalRequest[] = [];
  private static climateSurveysStore: HrClimateSurvey[] = [];
  private static socialSecurityPaymentsStore: SocialSecurityHistoricalPayment[] = [];

  static {
    // Datos históricos de ejemplo: solo en modo demostración (DEMO_MODE=true)
    if (isDemoModeEnabled()) {
      this.seedInitialHistoricalData();
    }
  }

  private static normalizeId(id: string): string {
    return (id || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  }

  private static matchesCompany(a: string, b: string): boolean {
    const na = this.normalizeId(a);
    const nb = this.normalizeId(b);
    if (!na || !nb) return false;
    return na === nb || na.includes(nb) || nb.includes(na);
  }

  private static seedInitialHistoricalData() {
    const defaultEmpresaId = 'client-innovagile';
    const innovagileRut = '77.798.901-4';
    const retailEmpresaId = 'client-retail-01';
    const retailRut = '76.104.550-9';

    // Generar encuestas de clima iniciales
    this.climateSurveysStore.push({
      id: 'clim-2026-q1',
      empresaId: defaultEmpresaId,
      titulo: 'Diagnóstico de Clima Organizacional & eNPS Q1-2026',
      periodo: '2026-Q1',
      dimensiones: {
        liderazgo: 84.5,
        remuneracionesBeneficios: 78.2,
        ambienteLaboral: 91.0,
        balanceVidaTrabajo: 86.4,
        desarrolloCarrera: 79.5,
      },
      indiceEnpsLaboral: 62,
      participacionPorcentaje: 93.5,
      alertasDetectadas: [
        'Oportunidad de ampliación en beneficios de salud complementaria en turnos operativos.',
        'Excelente recepción de la reducción gradual a jornada de 40 horas (Ley 21.561).',
      ],
      recomendacionesAgenteClima: [
        'Implementar talleres de liderazgo participativo para mandos medios en faena.',
        'Revisar política de incentivos por metas grupales semestrales.',
      ],
      fechaPublicacion: '2026-03-15',
    });

    // Aprobaciones iniciales se crean dinámicamente mediante agentes y solicitudes reales (sin datos ficticios de demo)

    // SEEDING DE HISTORIAL INMUTABLE DE LIQUIDACIONES DE SUELDO CON VARIACIÓN MENSUAL DE CONCEPTOS
    const innovagileMonthlyStaff: Record<string, any[]> = {
      '2026-05': [
        {
          id: 'emp-1',
          rut: '14.892.301-2',
          nombreCompleto: 'Ignacio Andrés Valenzuela Castro',
          cargo: 'Líder Técnico de Arquitectura de Software',
          departamento: 'Ingeniería',
          tipoContrato: 'INDEFINIDO' as const,
          sueldoBase: 3600000,
          gratificacionModalidad: 'ART_50' as const,
          horasExtrasCantidad: 4,
          comisionesBonosImponibles: 300000,
          asignacionColacion: 90000,
          asignacionMovilizacion: 80000,
          afpNombre: 'HABITAT' as const,
          saludTipo: 'ISAPRE' as const,
          saludPlanUf: 7.2,
          otrosDescuentos: 0,
        },
        {
          id: 'emp-2',
          rut: '16.450.912-K',
          nombreCompleto: 'Francisca Paz Santander Henríquez',
          cargo: 'Ingeniera de Datos y Machine Learning',
          departamento: 'Desarrollo',
          tipoContrato: 'INDEFINIDO' as const,
          sueldoBase: 2300000,
          gratificacionModalidad: 'ART_50' as const,
          horasExtrasCantidad: 0,
          comisionesBonosImponibles: 100000,
          asignacionColacion: 85000,
          asignacionMovilizacion: 75000,
          afpNombre: 'CUPRUM' as const,
          saludTipo: 'FONASA' as const,
          otrosDescuentos: 0,
        },
        {
          id: 'emp-3',
          rut: '17.890.342-8',
          nombreCompleto: 'Sebastián Eduardo Morales Peña',
          cargo: 'Consultor de Finanzas y Control de Gestión',
          departamento: 'Administración',
          tipoContrato: 'INDEFINIDO' as const,
          sueldoBase: 1450000,
          gratificacionModalidad: 'ART_50' as const,
          horasExtrasCantidad: 0,
          comisionesBonosImponibles: 50000,
          asignacionColacion: 80000,
          asignacionMovilizacion: 70000,
          afpNombre: 'MODELO' as const,
          saludTipo: 'FONASA' as const,
          otrosDescuentos: 0,
        },
        {
          id: 'emp-4',
          rut: '19.231.874-5',
          nombreCompleto: 'Valentina Belén Rojas Carvajal',
          cargo: 'Asistente Contable y Operaciones',
          departamento: 'Finanzas',
          tipoContrato: 'PLAZO_FIJO' as const,
          sueldoBase: 800000,
          gratificacionModalidad: 'ART_50' as const,
          horasExtrasCantidad: 2,
          comisionesBonosImponibles: 0,
          asignacionColacion: 75000,
          asignacionMovilizacion: 65000,
          afpNombre: 'UNO' as const,
          saludTipo: 'FONASA' as const,
          otrosDescuentos: 0,
        },
      ],
      '2026-06': [
        {
          id: 'emp-1',
          rut: '14.892.301-2',
          nombreCompleto: 'Ignacio Andrés Valenzuela Castro',
          cargo: 'Líder Técnico de Arquitectura de Software',
          departamento: 'Ingeniería',
          tipoContrato: 'INDEFINIDO' as const,
          sueldoBase: 3800000, // Reajuste
          gratificacionModalidad: 'ART_50' as const,
          horasExtrasCantidad: 8,
          comisionesBonosImponibles: 400000,
          asignacionColacion: 90000,
          asignacionMovilizacion: 80000,
          afpNombre: 'HABITAT' as const,
          saludTipo: 'ISAPRE' as const,
          saludPlanUf: 7.2,
          otrosDescuentos: 0,
        },
        {
          id: 'emp-2',
          rut: '16.450.912-K',
          nombreCompleto: 'Francisca Paz Santander Henríquez',
          cargo: 'Ingeniera de Datos y Machine Learning',
          departamento: 'Desarrollo',
          tipoContrato: 'INDEFINIDO' as const,
          sueldoBase: 2300000,
          gratificacionModalidad: 'ART_50' as const,
          horasExtrasCantidad: 4,
          comisionesBonosImponibles: 150000,
          asignacionColacion: 85000,
          asignacionMovilizacion: 75000,
          afpNombre: 'CUPRUM' as const,
          saludTipo: 'FONASA' as const,
          otrosDescuentos: 0,
        },
        {
          id: 'emp-3',
          rut: '17.890.342-8',
          nombreCompleto: 'Sebastián Eduardo Morales Peña',
          cargo: 'Consultor de Finanzas y Control de Gestión',
          departamento: 'Administración',
          tipoContrato: 'INDEFINIDO' as const,
          sueldoBase: 1450000, // Base antes de la reliquidación posterior Art 46 LIR
          gratificacionModalidad: 'ART_50' as const,
          horasExtrasCantidad: 4,
          comisionesBonosImponibles: 100000,
          asignacionColacion: 80000,
          asignacionMovilizacion: 70000,
          afpNombre: 'MODELO' as const,
          saludTipo: 'FONASA' as const,
          otrosDescuentos: 0,
        },
        {
          id: 'emp-4',
          rut: '19.231.874-5',
          nombreCompleto: 'Valentina Belén Rojas Carvajal',
          cargo: 'Asistente Contable y Operaciones',
          departamento: 'Finanzas',
          tipoContrato: 'PLAZO_FIJO' as const,
          sueldoBase: 800000,
          gratificacionModalidad: 'ART_50' as const,
          horasExtrasCantidad: 4,
          comisionesBonosImponibles: 30000,
          asignacionColacion: 75000,
          asignacionMovilizacion: 65000,
          afpNombre: 'UNO' as const,
          saludTipo: 'FONASA' as const,
          otrosDescuentos: 0,
        },
      ],
      '2026-07': [
        {
          id: 'emp-1',
          rut: '14.892.301-2',
          nombreCompleto: 'Ignacio Andrés Valenzuela Castro',
          cargo: 'Líder Técnico de Arquitectura de Software',
          departamento: 'Ingeniería',
          tipoContrato: 'INDEFINIDO' as const,
          sueldoBase: 3800000,
          gratificacionModalidad: 'ART_50' as const,
          horasExtrasCantidad: 6,
          comisionesBonosImponibles: 450000,
          asignacionColacion: 90000,
          asignacionMovilizacion: 80000,
          afpNombre: 'HABITAT' as const,
          saludTipo: 'ISAPRE' as const,
          saludPlanUf: 7.2,
          otrosDescuentos: 0,
        },
        {
          id: 'emp-2',
          rut: '16.450.912-K',
          nombreCompleto: 'Francisca Paz Santander Henríquez',
          cargo: 'Ingeniera de Datos y Machine Learning',
          departamento: 'Desarrollo',
          tipoContrato: 'INDEFINIDO' as const,
          sueldoBase: 2400000, // Reajuste
          gratificacionModalidad: 'ART_50' as const,
          horasExtrasCantidad: 2,
          comisionesBonosImponibles: 200000,
          asignacionColacion: 85000,
          asignacionMovilizacion: 75000,
          afpNombre: 'CUPRUM' as const,
          saludTipo: 'FONASA' as const,
          otrosDescuentos: 0,
        },
        {
          id: 'emp-3',
          rut: '17.890.342-8',
          nombreCompleto: 'Sebastián Eduardo Morales Peña',
          cargo: 'Consultor de Finanzas y Control de Gestión',
          departamento: 'Administración',
          tipoContrato: 'INDEFINIDO' as const,
          sueldoBase: 1600000, // Aumento regular aplicado
          gratificacionModalidad: 'ART_50' as const,
          horasExtrasCantidad: 0,
          comisionesBonosImponibles: 100000,
          asignacionColacion: 80000,
          asignacionMovilizacion: 70000,
          afpNombre: 'MODELO' as const,
          saludTipo: 'FONASA' as const,
          otrosDescuentos: 0,
        },
        {
          id: 'emp-4',
          rut: '19.231.874-5',
          nombreCompleto: 'Valentina Belén Rojas Carvajal',
          cargo: 'Asistente Contable y Operaciones',
          departamento: 'Finanzas',
          tipoContrato: 'PLAZO_FIJO' as const,
          sueldoBase: 850000, // Reajuste
          gratificacionModalidad: 'ART_50' as const,
          horasExtrasCantidad: 6,
          comisionesBonosImponibles: 50000,
          asignacionColacion: 75000,
          asignacionMovilizacion: 65000,
          afpNombre: 'UNO' as const,
          saludTipo: 'FONASA' as const,
          otrosDescuentos: 0,
        },
      ],
      '2026-08': [
        {
          id: 'emp-1',
          rut: '14.892.301-2',
          nombreCompleto: 'Ignacio Andrés Valenzuela Castro',
          cargo: 'Líder Técnico de Arquitectura de Software',
          departamento: 'Ingeniería',
          tipoContrato: 'INDEFINIDO' as const,
          sueldoBase: 3800000,
          gratificacionModalidad: 'ART_50' as const,
          horasExtrasCantidad: 8,
          comisionesBonosImponibles: 450000,
          asignacionColacion: 90000,
          asignacionMovilizacion: 80000,
          afpNombre: 'HABITAT' as const,
          saludTipo: 'ISAPRE' as const,
          saludPlanUf: 7.2,
          otrosDescuentos: 0,
        },
        {
          id: 'emp-2',
          rut: '16.450.912-K',
          nombreCompleto: 'Francisca Paz Santander Henríquez',
          cargo: 'Ingeniera de Datos y Machine Learning',
          departamento: 'Desarrollo',
          tipoContrato: 'INDEFINIDO' as const,
          sueldoBase: 2400000,
          gratificacionModalidad: 'ART_50' as const,
          horasExtrasCantidad: 4,
          comisionesBonosImponibles: 200000,
          asignacionColacion: 85000,
          asignacionMovilizacion: 75000,
          afpNombre: 'CUPRUM' as const,
          saludTipo: 'FONASA' as const,
          otrosDescuentos: 0,
        },
        {
          id: 'emp-3',
          rut: '17.890.342-8',
          nombreCompleto: 'Sebastián Eduardo Morales Peña',
          cargo: 'Consultor de Finanzas y Control de Gestión',
          departamento: 'Administración',
          tipoContrato: 'INDEFINIDO' as const,
          sueldoBase: 1600000,
          gratificacionModalidad: 'ART_50' as const,
          horasExtrasCantidad: 0,
          comisionesBonosImponibles: 100000,
          asignacionColacion: 80000,
          asignacionMovilizacion: 70000,
          afpNombre: 'MODELO' as const,
          saludTipo: 'FONASA' as const,
          otrosDescuentos: 0,
        },
        {
          id: 'emp-4',
          rut: '19.231.874-5',
          nombreCompleto: 'Valentina Belén Rojas Carvajal',
          cargo: 'Asistente Contable y Operaciones',
          departamento: 'Finanzas',
          tipoContrato: 'PLAZO_FIJO' as const,
          sueldoBase: 850000,
          gratificacionModalidad: 'ART_50' as const,
          horasExtrasCantidad: 6,
          comisionesBonosImponibles: 50000,
          asignacionColacion: 75000,
          asignacionMovilizacion: 65000,
          afpNombre: 'UNO' as const,
          saludTipo: 'FONASA' as const,
          otrosDescuentos: 0,
        },
      ],
    };

    const retailStaffBase = [
      {
        id: 'emp-retail-1',
        rut: '18.456.789-2',
        nombreCompleto: 'Gonzalo Tapia Morales',
        cargo: 'Jefe de Finanzas y Control de Gestión',
        departamento: 'Administración',
        tipoContrato: 'INDEFINIDO' as const,
        sueldoBase: 1850000,
        gratificacionModalidad: 'ART_50' as const,
        horasExtrasCantidad: 4,
        comisionesBonosImponibles: 150000,
        asignacionColacion: 85000,
        asignacionMovilizacion: 65000,
        afpNombre: 'HABITAT' as const,
        saludTipo: 'ISAPRE' as const,
        saludPlanUf: 4.5,
        otrosDescuentos: 0,
      },
      {
        id: 'emp-retail-2',
        rut: '15.340.891-3',
        nombreCompleto: 'Rosa Cárdenas Silva',
        cargo: 'Supervisora de Logística y Bodega',
        departamento: 'Operaciones',
        tipoContrato: 'INDEFINIDO' as const,
        sueldoBase: 1250000,
        gratificacionModalidad: 'ART_50' as const,
        horasExtrasCantidad: 8,
        comisionesBonosImponibles: 80000,
        asignacionColacion: 80000,
        asignacionMovilizacion: 60000,
        afpNombre: 'PROVIDA' as const,
        saludTipo: 'FONASA' as const,
        otrosDescuentos: 0,
      },
      {
        id: 'emp-retail-3',
        rut: '17.345.678-9',
        nombreCompleto: 'Esteban Morales Peña',
        cargo: 'Ejecutivo de Ventas y Cuentas Clave',
        departamento: 'Comercial',
        tipoContrato: 'INDEFINIDO' as const,
        sueldoBase: 950000,
        gratificacionModalidad: 'ART_50' as const,
        horasExtrasCantidad: 0,
        comisionesBonosImponibles: 380000,
        asignacionColacion: 75000,
        asignacionMovilizacion: 55000,
        afpNombre: 'MODELO' as const,
        saludTipo: 'FONASA' as const,
        otrosDescuentos: 0,
      },
      {
        id: 'emp-retail-4',
        rut: '19.876.543-1',
        nombreCompleto: 'Camila Sepúlveda Lagos',
        cargo: 'Asistente de Atención al Cliente',
        departamento: 'Servicio al Cliente',
        tipoContrato: 'PLAZO_FIJO' as const,
        sueldoBase: 680000,
        gratificacionModalidad: 'ART_50' as const,
        horasExtrasCantidad: 6,
        comisionesBonosImponibles: 45000,
        asignacionColacion: 70000,
        asignacionMovilizacion: 50000,
        afpNombre: 'UNO' as const,
        saludTipo: 'FONASA' as const,
        otrosDescuentos: 0,
      },
    ];

    const historicalPeriods = [
      { periodo: '2026-05', utm: 67450, uf: 37200, payDate: '2026-06-12T10:15:00Z', folioSuffix: '771923' },
      { periodo: '2026-06', utm: 67800, uf: 37380, payDate: '2026-07-11T11:30:00Z', folioSuffix: '819201' },
      { periodo: '2026-07', utm: 68100, uf: 37550, payDate: '2026-08-12T09:45:00Z', folioSuffix: '862934' },
      { periodo: '2026-08', utm: 68450, uf: 37720, payDate: '2026-09-11T12:00:00Z', folioSuffix: '910482' },
    ];

    // Helper para generar y registrar pago de PreviRed
    const registerPreviRedPayment = (
      empId: string,
      empRut: string,
      razonSocial: string,
      periodo: string,
      payrolls: EmployeePayroll[],
      payDate: string,
      folioSuffix: string
    ) => {
      const totalAfp = payrolls.reduce((s, p) => s + p.afpMonto, 0);
      const totalSalud = payrolls.reduce((s, p) => s + p.saludMonto, 0);
      const totalAfc = payrolls.reduce((s, p) => s + (p.afcTrabajadorMonto + p.afcEmpleadorMonto), 0);
      const totalMutual = payrolls.reduce((s, p) => s + p.mutualEmpleadorMonto, 0);
      const totalSis = payrolls.reduce((s, p) => s + p.sisEmpleadorMonto, 0);
      const totalLey21735 = payrolls.reduce((s, p) => s + (p.reformaPrevisionalLey21735Monto || Math.round(p.totalHaberesImponibles * 0.01)), 0);
      const totalGeneral = totalAfp + totalSalud + totalAfc + totalMutual + totalSis + totalLey21735;

      const detallesPorTrabajador: SocialSecurityEmployeeDetail[] = payrolls.map(p => {
        const ley21735Monto = p.reformaPrevisionalLey21735Monto || Math.round(p.totalHaberesImponibles * 0.01);
        return {
          employeeId: p.id,
          rut: p.rut,
          nombreCompleto: p.nombreCompleto,
          cargo: p.cargo,
          totalImponible: p.totalHaberesImponibles,
          afpNombre: p.afpNombre,
          afpMonto: p.afpMonto,
          saludTipo: p.saludTipo,
          saludMonto: p.saludMonto,
          afcTrabajador: p.afcTrabajadorMonto,
          afcEmpleador: p.afcEmpleadorMonto,
          sisMonto: p.sisEmpleadorMonto,
          mutualMonto: p.mutualEmpleadorMonto,
          ley21735Monto,
          totalImposicionesColaborador:
            p.afpMonto + p.saludMonto + p.afcTrabajadorMonto + p.afcEmpleadorMonto + p.sisMonto + p.mutualMonto + ley21735Monto,
        };
      });

      const folioPrevired = `PREV-${periodo.replace('-', '')}-${folioSuffix}`;
      const paymentRecord: SocialSecurityHistoricalPayment = {
        id: `prev-${empId}-${periodo}`,
        empresaId: empId,
        rutEmpresa: empRut,
        razonSocial,
        periodo,
        folioPrevired,
        fechaPago: payDate,
        medioPago: 'CPE_BANCO_CHILE',
        banco: 'Banco de Chile',
        nroTransaccion: `TRX-${periodo.replace('-', '')}-${folioSuffix}`,
        estado: 'PAGADO_Y_ACREDITADO',
        totalTrabajadores: payrolls.length,
        montoAfpTotal: totalAfp,
        montoSaludTotal: totalSalud,
        montoAfcTotal: totalAfc,
        montoMutualTotal: totalMutual,
        montoSisTotal: totalSis,
        montoLey21735Total: totalLey21735,
        montoCajaCompensacionTotal: 0,
        montoTotalPagado: totalGeneral,
        asientoPagoId: `asiento-prev-${periodo}-${empId}`,
        detallesPorTrabajador,
        comprobanteHash: generateBrowserSafeHash(`${folioPrevired}-${totalGeneral}-${payDate}`),
        certificadoF30Url: `https://miderecciondeltrabajo.gob.cl/certificados/f30/${folioPrevired}`,
        createdAt: payDate,
      };

      this.socialSecurityPaymentsStore.push(paymentRecord);
    };

    // 1. POBLAR INNOVAGILE SPA
    for (const hp of historicalPeriods) {
      const periodIndicators: ChileIndicators = {
        ...DEFAULT_INDICATORS,
        utm: hp.utm,
        uf: hp.uf,
      };

      const staffForPeriod = innovagileMonthlyStaff[hp.periodo] || innovagileMonthlyStaff['2026-08'];
      const calculatedPayrolls = staffForPeriod.map(s => {
        const p = calculatePayroll(s as any, periodIndicators);
        return {
          ...p,
          periodo: hp.periodo,
          empresaId: defaultEmpresaId,
        };
      });

      this.historicalSettlements.set(`${defaultEmpresaId}::${hp.periodo}`, calculatedPayrolls);
      this.historicalSettlements.set(`${innovagileRut}::${hp.periodo}`, calculatedPayrolls);

      // PreviRed CPE de InnovAgile
      registerPreviRedPayment(
        defaultEmpresaId,
        innovagileRut,
        'InnovAgile Solutions SpA',
        hp.periodo,
        calculatedPayrolls,
        hp.payDate,
        hp.folioSuffix
      );
    }

    // 2. POBLAR RETAIL SOLUTIONS CHILE SPA
    for (const hp of historicalPeriods) {
      const periodIndicators: ChileIndicators = {
        ...DEFAULT_INDICATORS,
        utm: hp.utm,
        uf: hp.uf,
      };

      const calculatedRetailPayrolls = retailStaffBase.map(s => {
        const p = calculatePayroll(s as any, periodIndicators);
        return {
          ...p,
          periodo: hp.periodo,
          empresaId: retailEmpresaId,
        };
      });

      this.historicalSettlements.set(`${retailEmpresaId}::${hp.periodo}`, calculatedRetailPayrolls);
      this.historicalSettlements.set(`${retailRut}::${hp.periodo}`, calculatedRetailPayrolls);

      // PreviRed CPE de Retail
      registerPreviRedPayment(
        retailEmpresaId,
        retailRut,
        'Retail Solutions Chile SpA',
        hp.periodo,
        calculatedRetailPayrolls,
        hp.payDate,
        `RET-${hp.folioSuffix}`
      );
    }

    // RELIQUIDACIONES Y AJUSTES RETROACTIVOS (ART. 46 LIR)
    this.reliquidationsStore.push({
      id: 'reliq-001',
      empresaId: defaultEmpresaId,
      employeeId: 'emp-3',
      rutEmpleado: '17.890.342-8',
      nombreEmpleado: 'Sebastián Eduardo Morales Peña',
      periodoDevengado: '2026-06',
      periodoPago: '2026-08',
      motivoAjuste: 'AUMENTO_SUELDO_RETROACTIVO',
      detalleMotivo: 'Reajuste salarial retroactivo pactado en Anexo de Contrato N° 2 por cumplimiento de metas corporativas ($150.000).',
      diferencialSueldoBase: 150000,
      diferencialHorasExtras: 0,
      diferencialComisiones: 0,
      diferencialGratificacion: 37500,
      diferencialTotalImponible: 187500,
      diferencialAfp: 19838,
      diferencialSalud: 13125,
      diferencialAfcTrabajador: 1125,
      diferencialAfcEmpleador: 4500,
      diferencialSis: 2794,
      diferencialMutual: 1744,
      diferencialLey21735: 1875,
      utmPeriodoDevengado: 67800,
      impuestoUnicoOriginal: 0,
      impuestoUnicoRecalculado: 7500,
      diferencialImpuestoUnico: 7500,
      totalDiferencialLiquido: 145912,
      totalCostoEmpresaAjuste: 199413,
      estado: 'APROBADO_Y_PAGADO',
      solicitadoPorAgente: 'Agente de Compensaciones & Remuneraciones (Sofía Castro)',
      aprobadoPorUsuario: 'Director de Finanzas (Usuario Humano)',
      fechaAprobacion: '2026-08-28T16:30:00Z',
      asientoAjusteId: 'entry-reliq-reliq-001',
      createdAt: '2026-08-28T15:00:00Z',
    });

    this.reliquidationsStore.push({
      id: 'reliq-002',
      empresaId: defaultEmpresaId,
      employeeId: 'emp-1',
      rutEmpleado: '14.892.301-2',
      nombreEmpleado: 'Ignacio Andrés Valenzuela Castro',
      periodoDevengado: '2026-07',
      periodoPago: '2026-09',
      motivoAjuste: 'BONO_RETROACTIVO',
      detalleMotivo: 'Bono extraordinario semestral por entrega de arquitectura Cloud AI devengado en julio 2026 ($300.000).',
      diferencialSueldoBase: 0,
      diferencialHorasExtras: 0,
      diferencialComisiones: 300000,
      diferencialGratificacion: 0,
      diferencialTotalImponible: 300000,
      diferencialAfp: 33810,
      diferencialSalud: 21000,
      diferencialAfcTrabajador: 1800,
      diferencialAfcEmpleador: 7200,
      diferencialSis: 4470,
      diferencialMutual: 2790,
      diferencialLey21735: 3000,
      utmPeriodoDevengado: 68100,
      impuestoUnicoOriginal: 250000,
      impuestoUnicoRecalculado: 282400,
      diferencialImpuestoUnico: 32400,
      totalDiferencialLiquido: 210990,
      totalCostoEmpresaAjuste: 317460,
      estado: 'PENDIENTE_APROBACION_HUMANA',
      solicitadoPorAgente: 'Agente de Compensaciones & Remuneraciones (Sofía Castro)',
      createdAt: '2026-09-02T10:00:00Z',
    });
  }

  /**
   * Guarda o actualiza una liquidación mensual histórica
   */
  static async saveHistoricalSettlement(empresaId: string, periodo: string, payroll: EmployeePayroll): Promise<void> {
    const key = `${empresaId}::${periodo}`;
    const list = this.historicalSettlements.get(key) || [];
    const idx = list.findIndex(p => p.id === payroll.id || p.rut === payroll.rut);
    const enriched: EmployeePayroll = {
      ...payroll,
      empresaId,
      periodo,
    };
    if (idx >= 0) {
      list[idx] = enriched;
    } else {
      list.push(enriched);
    }
    this.historicalSettlements.set(key, list);
  }

  /**
   * Obtiene liquidaciones históricas filtradas por empresa y período (con coincidencia de RUT o ID)
   */
  static getHistoricalSettlements(empresaId: string, periodo: string): EmployeePayroll[] {
    const directKey = `${empresaId}::${periodo}`;
    if (this.historicalSettlements.has(directKey)) {
      return this.historicalSettlements.get(directKey)!;
    }
    for (const [key, list] of this.historicalSettlements.entries()) {
      const [kEmp, kPer] = key.split('::');
      if (kPer === periodo && this.matchesCompany(kEmp, empresaId)) {
        return list;
      }
    }
    return [];
  }

  /**
   * MOTOR DETERMINISTA DE RELIQUIDACIONES Y AJUSTES RETROACTIVOS (Art. 46 Ley sobre Impuesto a la Renta)
   * Recalcula la base tributable del mes devengado con la UTM de dicho mes histórico,
   * determina la diferencia imponible, cotizaciones previsionales adicionales y diferencial de impuesto único.
   */
  static calculateRetroactiveAdjustment(input: RetroactiveAdjustmentInput): PayrollReliquidationAdjustment {
    const diffBase = input.diferencialSueldoBase || 0;
    const diffHex = input.diferencialHorasExtras || 0;
    const diffCom = input.diferencialComisiones || 0;
    const diffGrat = input.diferencialGratificacion || 0;
    const diferencialTotalImponible = diffBase + diffHex + diffCom + diffGrat;

    // Tasas previsionales del mes histórico
    const afpTasa = AFP_RATES[input.afpNombre] || 0.1127;
    const diferencialAfp = Math.round(diferencialTotalImponible * afpTasa);
    const diferencialSalud = Math.round(diferencialTotalImponible * 0.07);
    const afcTrabajadorTasa = input.tipoContrato === 'INDEFINIDO' ? 0.006 : 0.0;
    const diferencialAfcTrabajador = Math.round(diferencialTotalImponible * afcTrabajadorTasa);

    // Costos patronales sobre el diferencial
    const afcEmpleadorTasa = input.tipoContrato === 'INDEFINIDO' ? 0.024 : 0.030;
    const diferencialAfcEmpleador = Math.round(diferencialTotalImponible * afcEmpleadorTasa);
    const diferencialSis = Math.round(diferencialTotalImponible * 0.0149);
    const diferencialMutual = Math.round(diferencialTotalImponible * 0.0093);
    const diferencialLey21735 = Math.round(diferencialTotalImponible * 0.010); // 1.0% Ley 21.735

    // Recálculo de Impuesto Único de Segunda Categoría (Art. 46 LIR)
    // Se suma el diferencial a la base imponible original y se aplica la escala UTM del mes devengado
    const nuevaBaseImponible = input.baseImponibleOriginal + diferencialTotalImponible;
    const nuevoDescuentoPrevisional = Math.round(nuevaBaseImponible * (afpTasa + 0.07 + afcTrabajadorTasa));
    const nuevaBaseTributable = Math.max(0, nuevaBaseImponible - nuevoDescuentoPrevisional);
    const impuestoUnicoRecalculado = calculateImpuestoUnico(nuevaBaseTributable, input.utmPeriodoDevengado);
    const diferencialImpuestoUnico = Math.max(0, impuestoUnicoRecalculado - input.impuestoUnicoOriginal);

    // Líquido a pagar y costo total empresa del ajuste
    const totalDescuentosAjuste = diferencialAfp + diferencialSalud + diferencialAfcTrabajador + diferencialImpuestoUnico;
    const totalDiferencialLiquido = diferencialTotalImponible - totalDescuentosAjuste;
    const totalCostoEmpresaAjuste =
      diferencialTotalImponible +
      diferencialSis +
      diferencialMutual +
      diferencialAfcEmpleador +
      diferencialLey21735;

    const adjustment: PayrollReliquidationAdjustment = {
      id: generateBrowserSafeId('reliq'),
      empresaId: input.empresaId,
      employeeId: input.employeeId,
      rutEmpleado: input.rutEmpleado,
      nombreEmpleado: input.nombreEmpleado,
      periodoDevengado: input.periodoDevengado,
      periodoPago: input.periodoPago,
      motivoAjuste: input.motivoAjuste,
      detalleMotivo: input.detalleMotivo,
      diferencialSueldoBase: diffBase,
      diferencialHorasExtras: diffHex,
      diferencialComisiones: diffCom,
      diferencialGratificacion: diffGrat,
      diferencialTotalImponible,
      diferencialAfp,
      diferencialSalud,
      diferencialAfcTrabajador,
      diferencialAfcEmpleador,
      diferencialSis,
      diferencialMutual,
      diferencialLey21735,
      utmPeriodoDevengado: input.utmPeriodoDevengado,
      impuestoUnicoOriginal: input.impuestoUnicoOriginal,
      impuestoUnicoRecalculado,
      diferencialImpuestoUnico,
      totalDiferencialLiquido,
      totalCostoEmpresaAjuste,
      estado: 'PENDIENTE_APROBACION_HUMANA',
      solicitadoPorAgente: 'Agente de Compensaciones & Remuneraciones (Sofía Castro)',
      createdAt: new Date().toISOString(),
    };

    this.reliquidationsStore.unshift(adjustment);
    return adjustment;
  }

  /**
   * Genera el asiento contable de ajuste por reliquidación retroactiva
   */
  static generateReliquidationAccountingEntry(adjustment: PayrollReliquidationAdjustment): AccountingEntry {
    const fechaAsiento = `${adjustment.periodoPago}-28`;
    const docDesc = `Reliquidación Sueldo Periodo ${adjustment.periodoDevengado}`;
    const folioRef = `RELIQ-${adjustment.periodoDevengado}-${adjustment.rutEmpleado}`;

    const baseProps = {
      rutAuxiliar: adjustment.rutEmpleado,
      nombreAuxiliar: adjustment.nombreEmpleado,
      documentoRef: docDesc,
      tipoDocumentoRef: 'DOCUMENTO_LABORAL',
      folioDocumentoRef: folioRef,
      fechaDocumentoRef: fechaAsiento,
    };

    const lineas: AccountingEntryLine[] = [
      {
        cuentaCodigo: '5.2.01',
        cuentaNombre: `Ajuste Remuneraciones Retroactivas (${adjustment.motivoAjuste})`,
        debe: adjustment.diferencialTotalImponible,
        haber: 0,
        centroCosto: 'RECURSOS_HUMANOS',
        ...baseProps,
      },
      {
        cuentaCodigo: '5.2.04',
        cuentaNombre: 'Aportes Patronales Retroactivos (SIS, Mutual, AFC Emp.)',
        debe: adjustment.diferencialSis + adjustment.diferencialMutual + adjustment.diferencialAfcEmpleador,
        haber: 0,
        centroCosto: 'RECURSOS_HUMANOS',
        ...baseProps,
      },
      {
        cuentaCodigo: '5.2.06',
        cuentaNombre: 'Aporte Previsional Patronal Ley 21.735 (1% Retroactivo)',
        debe: adjustment.diferencialLey21735,
        haber: 0,
        centroCosto: 'RECURSOS_HUMANOS',
        ...baseProps,
      },
      // Pasivos y retenciones
      {
        cuentaCodigo: '2.1.08',
        cuentaNombre: 'Instituciones Previsionales (AFP) por Pagar (Ajuste)',
        debe: 0,
        haber: adjustment.diferencialAfp,
        rutAuxiliar: '96.919.050-8',
        nombreAuxiliar: 'PreviRed / AFP',
        ...baseProps,
      },
      {
        cuentaCodigo: '2.1.09',
        cuentaNombre: 'Salud (Fonasa / Isapres) por Pagar (Ajuste)',
        debe: 0,
        haber: adjustment.diferencialSalud,
        rutAuxiliar: '61.603.000-0',
        nombreAuxiliar: 'FONASA / Isapres',
        ...baseProps,
      },
      {
        cuentaCodigo: '2.1.10',
        cuentaNombre: 'AFC Seguro de Cesantía por Pagar (Ajuste)',
        debe: 0,
        haber: adjustment.diferencialAfcTrabajador + adjustment.diferencialAfcEmpleador,
        rutAuxiliar: '76.265.736-8',
        nombreAuxiliar: 'AFC Chile',
        ...baseProps,
      },
      {
        cuentaCodigo: '2.1.11',
        cuentaNombre: 'Mutual / SIS por Pagar (Ajuste)',
        debe: 0,
        haber: adjustment.diferencialMutual + adjustment.diferencialSis,
        rutAuxiliar: '70.285.100-9',
        nombreAuxiliar: 'Mutual de Seguridad / SIS',
        ...baseProps,
      },
      {
        cuentaCodigo: '2.1.12',
        cuentaNombre: 'Aporte Ley 21.735 por Pagar (Ajuste)',
        debe: 0,
        haber: adjustment.diferencialLey21735,
        rutAuxiliar: '96.919.050-8',
        nombreAuxiliar: 'PreviRed / Fondo Previsional',
        ...baseProps,
      },
    ];

    if (adjustment.diferencialImpuestoUnico > 0) {
      lineas.push({
        cuentaCodigo: '2.1.05',
        cuentaNombre: 'Impuesto Único 2da Cat. por Pagar (Reliquidación F29 Art. 46 LIR)',
        debe: 0,
        haber: adjustment.diferencialImpuestoUnico,
        rutAuxiliar: '60.803.000-K',
        nombreAuxiliar: 'Tesorería General de la República (TGR)',
        ...baseProps,
      });
    }

    lineas.push({
      cuentaCodigo: '2.1.07',
      cuentaNombre: `Sueldos Líquidos Retroactivos por Pagar (${adjustment.nombreEmpleado})`,
      debe: 0,
      haber: adjustment.totalDiferencialLiquido,
      ...baseProps,
    });

    const totalDebe = lineas.reduce((s, l) => s + l.debe, 0);
    const totalHaber = lineas.reduce((s, l) => s + l.haber, 0);

    return enrichEntryWithChartAttributes({
      id: `entry-reliq-${adjustment.id}`,
      fecha: fechaAsiento,
      concepto: `Reliquidación Retroactiva Periodo ${adjustment.periodoDevengado} - ${adjustment.nombreEmpleado} (${adjustment.motivoAjuste})`,
      documento: docDesc,
      lineas,
      totalDebe,
      totalHaber,
      balanceado: totalDebe === totalHaber,
      origen: 'REMUNERACIONES',
      creadoEn: new Date().toISOString(),
    }, undefined, baseProps);
  }

  /**
   * Obtiene todas las reliquidaciones registradas para una empresa (con coincidencia de RUT o ID)
   */
  static getReliquidations(empresaId: string): PayrollReliquidationAdjustment[] {
    return this.reliquidationsStore.filter(r => this.matchesCompany(r.empresaId, empresaId));
  }

  /**
   * Extrae de forma flexible y completa la estructura de un asiento contable
   * sin importar si viene anidado en datosOperacion.asientoContable, datosOperacion.asiento,
   * datosOperacion.journalEntry, o si datosOperacion contiene directamente las líneas contables.
   */
  static extractCandidateAccountingEntry(datosOperacion: any): any | null {
    if (!datosOperacion || typeof datosOperacion !== 'object') return null;
    if (datosOperacion.asientoPropuesto && typeof datosOperacion.asientoPropuesto === 'object') {
      return datosOperacion.asientoPropuesto;
    }
    if (datosOperacion.asientoContable && typeof datosOperacion.asientoContable === 'object') {
      return datosOperacion.asientoContable;
    }
    if (datosOperacion.asiento && typeof datosOperacion.asiento === 'object') {
      return datosOperacion.asiento;
    }
    if (datosOperacion.journalEntry && typeof datosOperacion.journalEntry === 'object') {
      return datosOperacion.journalEntry;
    }
    if (datosOperacion.entry && typeof datosOperacion.entry === 'object') {
      return datosOperacion.entry;
    }
    if (Array.isArray(datosOperacion.lineas) && datosOperacion.lineas.length > 0) {
      return datosOperacion;
    }
    if (Array.isArray(datosOperacion.lines) && datosOperacion.lines.length > 0) {
      return datosOperacion;
    }
    if (datosOperacion.totalDebe !== undefined && (datosOperacion.concepto || datosOperacion.glosa)) {
      return datosOperacion;
    }
    return null;
  }

  /**
   * SISTEMA DE GOBERNANZA AGÉNTICA: Solicitar Aprobación Humana con Persistencia
   */
  static requestModuleApproval(params: Omit<ModuleAgentApprovalRequest, 'id' | 'solicitadoEn' | 'estado'>): ModuleAgentApprovalRequest {
    const approval: ModuleAgentApprovalRequest = {
      id: generateBrowserSafeId('appr'),
      ...params,
      estado: 'PENDIENTE',
      solicitadoEn: new Date().toISOString(),
    };
    this.approvalsStore.unshift(approval);
    const dp = getDiskPersistence();
    if (dp && typeof dp.saveApproval === 'function') {
      dp.saveApproval(approval);
    }
    return approval;
  }

  /**
   * Resolver Aprobación Humana (Aprobar o Rechazar)
   * En caso de aprobación, extrae y asienta formalmente en el Libro Mayor (diskPersistence).
   * Si la operación contable falla o está descuadrada, transiciona honestamente a ERROR_EJECUCION.
   */
  static async resolveApproval(approvalId: string, userId: string, approved: boolean): Promise<ModuleAgentApprovalRequest> {
    const item = this.getApprovalById(approvalId);
    if (!item) {
      throw new Error(`Solicitud de aprobación ${approvalId} no encontrada.`);
    }
    if (item.estado !== 'PENDIENTE') {
      throw new Error(`La solicitud de aprobación ${approvalId} ya fue resuelta previamente con estado: ${item.estado}. No se permite su re-ejecución.`);
    }
    item.resueltoPor = userId;
    item.resueltoEn = new Date().toISOString();

    if (approved) {
      const operacion = (item.operacionTipo || '').toUpperCase();
      const dp = getDiskPersistence();

      if (operacion === 'DEPRECIACION_ACTIVO_FIJO') {
        try {
          const candidateEntry = this.extractCandidateAccountingEntry(item.datosOperacion);
          if (!candidateEntry) throw new Error('No se encontró propuesta contable de depreciación en los datos de la operación.');
          const entryId = candidateEntry.id || `entry-dep-${Date.now()}`;
          const rawLines = candidateEntry.lineas || candidateEntry.lines || [];
          if (!Array.isArray(rawLines) || rawLines.length === 0) {
            throw new Error('La transacción no incluye líneas contables válidas (Debe/Haber).');
          }
          const sumDebe = rawLines.reduce((acc: number, l: any) => acc + (Number(l.debe) || 0), 0);
          const sumHaber = rawLines.reduce((acc: number, l: any) => acc + (Number(l.haber) || 0), 0);
          if (Math.abs(sumDebe - sumHaber) > 1) {
            throw new Error(`El asiento contable está descuadrado: Debe ($${sumDebe}) != Haber ($${sumHaber}).`);
          }

          const montoAprobado = Number(item.impactoFinancieroClp ?? item.impactoFinanciero ?? 0);
          if (montoAprobado > 0 && Math.abs(sumDebe - montoAprobado) > 1) {
            throw new Error(
              `Discrepancia financiera: El monto ejecutado del asiento de depreciación ($${sumDebe.toLocaleString('es-CL')}) ` +
              `no coincide con el monto aprobado ($${montoAprobado.toLocaleString('es-CL')}). Se rechaza la ejecución.`
            );
          }

          const affectedList = item.datosOperacion?.activosAfectados;
          if (!Array.isArray(affectedList) || affectedList.length === 0) {
            throw new Error('Falta especificar la lista de activos fijos a depreciar (activosAfectados); con la lista vacía se rechaza la depreciación para evitar afectar a todos los bienes.');
          }

          const mappedLines = rawLines.map((l: any, idx: number) => {
            const cuentaCodigo = l.cuentaCodigo || l.codigoCuenta;
            if (!cuentaCodigo) {
              throw new Error(`La línea #${idx + 1} del asiento de depreciación no especifica código de cuenta contable; no se admiten cuentas por defecto.`);
            }
            return {
              id: l.id || `line-${entryId}-${idx + 1}`,
              entryId: entryId,
              lineaNumero: idx + 1,
              cuentaCodigo,
              cuentaNombre: l.cuentaNombre || l.nombreCuenta || 'Gasto Depreciación Activo Fijo',
              debe: Number(l.debe) || 0,
              haber: Number(l.haber) || 0,
              glosa: l.glosa || candidateEntry.glosa || item.titulo,
              rutAuxiliar: l.rutAuxiliar || null,
            };
          });

          if (dp && typeof dp.addAccountingEntry === 'function') {
            dp.addAccountingEntry({
              ...candidateEntry,
              id: entryId,
              empresaId: candidateEntry.empresaId || item.empresaId,
              fecha: candidateEntry.fecha || new Date().toISOString().slice(0, 10),
              periodo: candidateEntry.periodo || new Date().toISOString().slice(0, 7),
              concepto: candidateEntry.concepto || item.titulo,
              glosa: candidateEntry.glosa || item.titulo,
              estado: 'CENTRALIZADO',
              origenModulo: 'ACTIVO_FIJO',
            }, mappedLines);
          }

          // Actualizar depreciación acumulada y meses exclusivamente en los activos afectados especificados
          if (dp && typeof dp.getFixedAssets === 'function' && typeof dp.setFixedAssets === 'function') {
            const assets = dp.getFixedAssets(item.empresaId);
            const affected = new Set(affectedList);
            const updated = assets.map((a: any) => {
              if (affected.has(a.id)) {
                if (a.estado === 'OPERATIVO' || a.estado === 'MANTENCION') {
                  const cuota = a.cuotaDepreciacionMensualFinanciera || Math.round(Number(a.valorAdquisicionOriginal || 0) / (Number(a.vidaUtilMesesFinanciera) || 60));
                  const cuotaTrib = a.cuotaDepreciacionMensualTributaria || Math.round(Number(a.valorAdquisicionOriginal || 0) / (Number(a.vidaUtilMesesTributaria) || 36));
                  const nuevaDepFin = Number(a.depreciacionAcumuladaFinanciera || 0) + cuota;
                  const nuevaDepTrib = Number(a.depreciacionAcumuladaTributaria || 0) + cuotaTrib;
                  const nuevoValorLibro = Math.max(0, Number(a.valorAdquisicionOriginal || 0) - nuevaDepFin);
                  return {
                    ...a,
                    depreciacionAcumuladaFinanciera: nuevaDepFin,
                    depreciacionAcumuladaTributaria: nuevaDepTrib,
                    valorLibroFinanciero: nuevoValorLibro,
                    mesesDepreciados: Number(a.mesesDepreciados || 0) + 1,
                    vidaUtilRestanteMeses: Math.max(0, Number(a.vidaUtilRestanteMeses || 0) - 1),
                  };
                }
              }
              return a;
            });
            dp.setFixedAssets(item.empresaId, updated);
          }

          item.asientoContableId = entryId;
          item.montoAprobadoClp = montoAprobado || sumDebe;
          item.montoEjecutadoClp = sumDebe;
          item.estado = 'EJECUTADO';
          item.resultadoEjecucion = `Operación de depreciación ejecutada exitosamente por ${userId}. Asiento formal ${entryId} contabilizado en Libro Mayor (Total: $${sumDebe.toLocaleString('es-CL')}).`;
        } catch (err: any) {
          console.warn(`[HrManagementService] Rechazo depreciación: ${err.message}`);
          item.estado = 'ERROR_EJECUCION';
          item.resultadoEjecucion = `Fallo crítico ejecutando depreciación de activo fijo: ${err.message}.`;
        }
      } else if (operacion === 'BAJA_ACTIVO_FIJO') {
        try {
          const targetAssetId = item.datosOperacion?.activoId;
          if (!targetAssetId) {
            throw new Error('Falta el identificador del activo fijo a dar de baja; no se admiten valores por defecto.');
          }

          const candidateEntry = this.extractCandidateAccountingEntry(item.datosOperacion);
          if (!candidateEntry) throw new Error('No se encontró propuesta contable de baja en los datos de la operación.');
          const entryId = candidateEntry.id || `entry-baja-${Date.now()}`;
          const rawLines = candidateEntry.lineas || candidateEntry.lines || [];
          if (!Array.isArray(rawLines) || rawLines.length === 0) {
            throw new Error('La transacción no incluye líneas contables válidas.');
          }
          const sumDebe = rawLines.reduce((acc: number, l: any) => acc + (Number(l.debe) || 0), 0);
          const sumHaber = rawLines.reduce((acc: number, l: any) => acc + (Number(l.haber) || 0), 0);
          if (Math.abs(sumDebe - sumHaber) > 1) {
            throw new Error(`El asiento contable está descuadrado: Debe ($${sumDebe}) != Haber ($${sumHaber}).`);
          }

          const montoAprobado = Number(item.impactoFinancieroClp ?? item.impactoFinanciero ?? 0);
          if (montoAprobado > 0 && Math.abs(sumDebe - montoAprobado) > 1) {
            throw new Error(
              `Discrepancia financiera: El monto ejecutado de la baja ($${sumDebe.toLocaleString('es-CL')}) ` +
              `no coincide con el monto aprobado ($${montoAprobado.toLocaleString('es-CL')}). Se rechaza la ejecución.`
            );
          }

          const mappedLines = rawLines.map((l: any, idx: number) => {
            const cuentaCodigo = l.cuentaCodigo || l.codigoCuenta;
            if (!cuentaCodigo) {
              throw new Error(`La línea #${idx + 1} del asiento de baja no especifica código de cuenta contable; no se admiten cuentas por defecto.`);
            }
            return {
              id: l.id || `line-${entryId}-${idx + 1}`,
              entryId: entryId,
              lineaNumero: idx + 1,
              cuentaCodigo,
              cuentaNombre: l.cuentaNombre || l.nombreCuenta || 'Baja Activo Fijo',
              debe: Number(l.debe) || 0,
              haber: Number(l.haber) || 0,
              glosa: l.glosa || candidateEntry.glosa || item.titulo,
              rutAuxiliar: l.rutAuxiliar || null,
            };
          });

          if (dp && typeof dp.addAccountingEntry === 'function') {
            dp.addAccountingEntry({
              ...candidateEntry,
              id: entryId,
              empresaId: candidateEntry.empresaId || item.empresaId,
              fecha: candidateEntry.fecha || new Date().toISOString().slice(0, 10),
              periodo: candidateEntry.periodo || new Date().toISOString().slice(0, 7),
              concepto: candidateEntry.concepto || item.titulo,
              glosa: candidateEntry.glosa || item.titulo,
              estado: 'CENTRALIZADO',
              origenModulo: 'ACTIVO_FIJO',
            }, mappedLines);
          }

          const precioVenta = Number(item.datosOperacion?.precioVentaNeto || 0);
          if (targetAssetId && dp && typeof dp.getFixedAssets === 'function' && typeof dp.setFixedAssets === 'function') {
            const assets = dp.getFixedAssets(item.empresaId);
            const updated = assets.map((a: any) => {
              if (a.id === targetAssetId || a.codigoPlaca === targetAssetId) {
                return {
                  ...a,
                  estado: precioVenta > 0 ? 'ENAJENADO' : 'DADO_DE_BAJA',
                  valorLibroFinanciero: 0,
                  notasTecnicas: `${a.notasTecnicas || ''}\nBaja/Enajenación el ${new Date().toISOString().slice(0, 10)}. Asiento ${entryId}.`,
                };
              }
              return a;
            });
            dp.setFixedAssets(item.empresaId, updated);
          }

          item.asientoContableId = entryId;
          item.montoAprobadoClp = montoAprobado || sumDebe;
          item.montoEjecutadoClp = sumDebe;
          item.estado = 'EJECUTADO';
          item.resultadoEjecucion = `Baja de activo fijo ejecutada exitosamente por ${userId}. Asiento de retiro ${entryId} contabilizado en Libro Mayor.`;
        } catch (err: any) {
          console.warn(`[HrManagementService] Rechazo baja: ${err.message}`);
          item.estado = 'ERROR_EJECUCION';
          item.resultadoEjecucion = `Fallo crítico ejecutando baja de activo fijo: ${err.message}.`;
        }
      } else if (operacion === 'CIERRE_ORDEN_PRODUCCION') {
        try {
          const targetOpId = item.datosOperacion?.ordenId || item.datosOperacion?.folioOP;
          if (!targetOpId) {
            throw new Error('Falta el folio o identificador de la orden de producción a liquidar; no se admiten valores por defecto.');
          }

          const candidateEntry = this.extractCandidateAccountingEntry(item.datosOperacion);
          if (!candidateEntry) throw new Error('No se encontró propuesta contable de liquidación en los datos de la operación.');
          const entryId = candidateEntry.id || `entry-op-liq-${Date.now()}`;
          const rawLines = candidateEntry.lineas || candidateEntry.lines || [];
          if (!Array.isArray(rawLines) || rawLines.length === 0) {
            throw new Error('La transacción no incluye líneas contables válidas.');
          }
          const sumDebe = rawLines.reduce((acc: number, l: any) => acc + (Number(l.debe) || 0), 0);
          const sumHaber = rawLines.reduce((acc: number, l: any) => acc + (Number(l.haber) || 0), 0);
          if (Math.abs(sumDebe - sumHaber) > 1) {
            throw new Error(`El asiento contable está descuadrado: Debe ($${sumDebe}) != Haber ($${sumHaber}).`);
          }

          const montoAprobado = Number(item.impactoFinancieroClp ?? item.impactoFinanciero ?? 0);
          if (montoAprobado > 0 && Math.abs(sumDebe - montoAprobado) > 1) {
            throw new Error(
              `Discrepancia financiera: El costo total liquidado ($${sumDebe.toLocaleString('es-CL')}) ` +
              `no coincide con el monto aprobado ($${montoAprobado.toLocaleString('es-CL')}). Se rechaza la ejecución.`
            );
          }

          const mappedLines = rawLines.map((l: any, idx: number) => {
            const cuentaCodigo = l.cuentaCodigo || l.codigoCuenta;
            if (!cuentaCodigo) {
              throw new Error(`La línea #${idx + 1} del asiento de cierre de producción no especifica código de cuenta contable; no se admiten cuentas por defecto.`);
            }
            return {
              id: l.id || `line-${entryId}-${idx + 1}`,
              entryId: entryId,
              lineaNumero: idx + 1,
              cuentaCodigo,
              cuentaNombre: l.cuentaNombre || l.nombreCuenta || 'Liquidación Producción',
              debe: Number(l.debe) || 0,
              haber: Number(l.haber) || 0,
              glosa: l.glosa || candidateEntry.glosa || item.titulo,
              rutAuxiliar: l.rutAuxiliar || null,
            };
          });

          if (dp && typeof dp.addAccountingEntry === 'function') {
            dp.addAccountingEntry({
              ...candidateEntry,
              id: entryId,
              empresaId: candidateEntry.empresaId || item.empresaId,
              fecha: candidateEntry.fecha || new Date().toISOString().slice(0, 10),
              periodo: candidateEntry.periodo || new Date().toISOString().slice(0, 7),
              concepto: candidateEntry.concepto || item.titulo,
              glosa: candidateEntry.glosa || item.titulo,
              estado: 'CENTRALIZADO',
              origenModulo: 'COSTOS_PRODUCCION',
            }, mappedLines);
          }

          if (targetOpId && dp && typeof dp.getProductionOrders === 'function') {
            const orders = dp.getProductionOrders(item.empresaId);
            const op = orders.find((o: any) => o.id === targetOpId || o.folioOP === targetOpId);
            if (op) {
              op.estado = 'LIQUIDADA_TERMINADA';
              op.fechaRealTermino = new Date().toISOString().slice(0, 10);
              if (typeof dp.flushToDiskSync === 'function') dp.flushToDiskSync();
            }
          }

          item.asientoContableId = entryId;
          item.montoAprobadoClp = montoAprobado || sumDebe;
          item.montoEjecutadoClp = sumDebe;
          item.estado = 'EJECUTADO';
          item.resultadoEjecucion = `Cierre y liquidación de orden de producción ejecutada exitosamente por ${userId}. Asiento ${entryId} registrado en Libro Mayor (traspaso WIP -> PT).`;
        } catch (err: any) {
          console.warn(`[HrManagementService] Rechazo producción: ${err.message}`);
          item.estado = 'ERROR_EJECUCION';
          item.resultadoEjecucion = `Fallo crítico liquidando orden de producción: ${err.message}.`;
        }
      } else if (operacion === 'EMITIR_ORDEN_COMPRA') {
        try {
          const datos = item.datosOperacion || {};

          // 1. Validar Proveedor (rechazar si falta, sin valores por defecto)
          const proveedorRut = (datos.proveedorRut || datos.rutProveedor || '').trim();
          if (!proveedorRut) {
            throw new Error('Falta proveedor (RUT de proveedor) para la emisión de la Orden de Compra; no se admiten valores por defecto.');
          }

          let proveedorRazonSocial = (datos.proveedorRazonSocial || datos.proveedorNombre || '').trim();
          if (!proveedorRazonSocial) {
            if (datos.rfqId) {
              const comState = commercialProcurementService.getState(item.empresaId);
              const rfq = (comState.rfqs || []).find(
                (r: any) => String(r.id).toUpperCase() === String(datos.rfqId).toUpperCase() ||
                            String(r.folioRfq).toUpperCase() === String(datos.rfqId).toUpperCase()
              );
              const invited = rfq?.proveedoresInvitados?.find((p: any) => p.proveedorRut === proveedorRut);
              if (invited?.proveedorRazonSocial) {
                proveedorRazonSocial = invited.proveedorRazonSocial;
              }
            }
          }
          if (!proveedorRazonSocial) {
            proveedorRazonSocial = proveedorRut;
          }

          // 2. Resolver ítems (rechazar si faltan)
          let rawItems: any[] = [];
          if (Array.isArray(datos.items) && datos.items.length > 0) {
            rawItems = datos.items;
          } else if (datos.rfqId) {
            const comState = commercialProcurementService.getState(item.empresaId);
            const rfq = (comState.rfqs || []).find(
              (r: any) => String(r.id).toUpperCase() === String(datos.rfqId).toUpperCase() ||
                          String(r.folioRfq).toUpperCase() === String(datos.rfqId).toUpperCase()
            );
            if (rfq?.items && rfq.items.length > 0) {
              rawItems = rfq.items;
            }
          } else if (datos.sku) {
            rawItems = [{
              sku: datos.sku,
              nombre: datos.nombre || datos.descripcion || item.titulo,
              cantidad: datos.cantidad,
              precioUnitarioCLP: datos.precioUnitarioCLP ?? datos.precioUnitario ?? datos.precio,
            }];
          }

          if (!rawItems || rawItems.length === 0) {
            throw new Error('Faltan ítems para emitir la Orden de Compra; no se admiten valores por defecto.');
          }

          const montoAprobado = Number(item.impactoFinancieroClp ?? item.impactoFinanciero ?? datos.montoTotalNeto ?? 0);
          if (montoAprobado <= 0) {
            throw new Error('El monto aprobado para la Orden de Compra debe ser un valor positivo mayor a cero.');
          }

          // 3. Validar SKU, Cantidad y Precio de cada ítem (sin valores por defecto)
          const validatedItems = rawItems.map((it: any, idx: number) => {
            const sku = (it.sku || '').trim();
            if (!sku) {
              throw new Error(`Falta código SKU en ítem #${idx + 1} de la Orden de Compra; no se admiten valores por defecto.`);
            }

            if (it.cantidad === undefined || it.cantidad === null || it.cantidad === '') {
              throw new Error(`Falta cantidad en ítem '${sku}'; no se admiten valores por defecto.`);
            }
            const cantidad = Number(it.cantidad);
            if (isNaN(cantidad) || cantidad <= 0) {
              throw new Error(`Cantidad inválida (${it.cantidad}) en ítem '${sku}'. Debe ser un número mayor a cero.`);
            }

            let precioUnitarioCLP: number | undefined;
            if (it.precioUnitarioCLP !== undefined && it.precioUnitarioCLP !== null && it.precioUnitarioCLP !== '') {
              precioUnitarioCLP = Number(it.precioUnitarioCLP);
            } else if (it.precioUnitario !== undefined && it.precioUnitario !== null && it.precioUnitario !== '') {
              precioUnitarioCLP = Number(it.precioUnitario);
            } else if (it.precio !== undefined && it.precio !== null && it.precio !== '') {
              precioUnitarioCLP = Number(it.precio);
            } else if (rawItems.length === 1 && montoAprobado > 0) {
              // Calcular precio unitario a partir del monto total neto aprobado
              precioUnitarioCLP = Math.round(montoAprobado / cantidad);
            }

            if (precioUnitarioCLP === undefined || isNaN(precioUnitarioCLP) || precioUnitarioCLP <= 0) {
              throw new Error(`Falta precio unitario válido en ítem '${sku}'; no se admiten valores por defecto.`);
            }

            return {
              sku,
              nombre: it.nombre || it.descripcion || `Ítem ${sku}`,
              cantidad,
              precioUnitarioCLP,
            };
          });

          // 4. Calcular subtotal de cada ítem y validar que el total coincida exactamente con el monto aprobado
          const totalNetoCalculado = validatedItems.reduce((acc, it) => acc + Math.round(it.cantidad * it.precioUnitarioCLP), 0);

          if (Math.abs(totalNetoCalculado - montoAprobado) > 1) {
            throw new Error(
              `Discrepancia financiera: El total calculado de la Orden de Compra ($${totalNetoCalculado.toLocaleString('es-CL')}) ` +
              `no coincide con el monto neto aprobado ($${montoAprobado.toLocaleString('es-CL')}). Se rechaza la emisión.`
            );
          }

          // 5. Emitir la Orden de Compra en el servicio dejando estado "EMITIDA" (no "ENVIADA_PROVEEDOR")
          const po = commercialProcurementService.createPurchaseOrder(
            item.empresaId,
            {
              proveedorRut,
              proveedorRazonSocial,
              condicionPago: datos.condicionPago || '30_DIAS_TRANSFERENCIA',
              plazoEntregaDias: Number(datos.plazoEntregaDias || 15),
              items: validatedItems,
              motivoGeneracion: datos.motivoAdjudicacion || datos.motivoGeneracion || item.titulo,
              estado: 'EMITIDA',
            }
          );

          if (po.estado !== 'EMITIDA') {
            throw new Error(`Estado inválido en Orden de Compra: se esperaba 'EMITIDA' y se obtuvo '${po.estado}'.`);
          }

          item.montoAprobadoClp = montoAprobado;
          item.montoEjecutadoClp = totalNetoCalculado;
          item.estado = 'EJECUTADO';
          item.resultadoEjecucion = `Orden de Compra ${po.folio} emitida formalmente por ${userId} en el ERP con estado EMITIDA (pendiente de envío a proveedor). Total Neto: $${totalNetoCalculado.toLocaleString('es-CL')}.`;
          (item as any).ordenCompraFolio = po.folio;
          (item as any).ordenCompraId = po.id;
        } catch (err: any) {
          console.warn(`[HrManagementService] Rechazo orden de compra: ${err.message}`);
          item.estado = 'ERROR_EJECUCION';
          item.resultadoEjecucion = `Fallo crítico emitiendo Orden de Compra: ${err.message}.`;
        }
      } else if (operacion === 'CENTRALIZAR_RENDICION') {
        try {
          const repId = item.datosOperacion?.reportId || item.datosOperacion?.id;
          if (!repId) {
            throw new Error('Falta el identificador del informe de rendición a centralizar; no se admiten valores por defecto.');
          }

          const candidateEntry = this.extractCandidateAccountingEntry(item.datosOperacion);
          if (!candidateEntry) throw new Error('No se encontró propuesta contable de rendición en los datos de la operación.');
          const entryId = candidateEntry.id || `entry-rdg-${Date.now()}`;
          const rawLines = candidateEntry.lineas || candidateEntry.lines || [];
          if (!Array.isArray(rawLines) || rawLines.length === 0) {
            throw new Error('La transacción no incluye líneas contables válidas.');
          }
          const sumDebe = rawLines.reduce((acc: number, l: any) => acc + (Number(l.debe) || 0), 0);
          const sumHaber = rawLines.reduce((acc: number, l: any) => acc + (Number(l.haber) || 0), 0);
          if (Math.abs(sumDebe - sumHaber) > 1) {
            throw new Error(`El asiento contable está descuadrado: Debe ($${sumDebe}) != Haber ($${sumHaber}).`);
          }

          const montoAprobado = Number(item.impactoFinancieroClp ?? item.impactoFinanciero ?? 0);
          if (montoAprobado > 0 && Math.abs(sumDebe - montoAprobado) > 1) {
            throw new Error(
              `Discrepancia financiera: El monto contabilizado de la rendición ($${sumDebe.toLocaleString('es-CL')}) ` +
              `no coincide con el monto aprobado ($${montoAprobado.toLocaleString('es-CL')}). Se rechaza la ejecución.`
            );
          }

          const mappedLines = rawLines.map((l: any, idx: number) => {
            const cuentaCodigo = l.cuentaCodigo || l.codigoCuenta;
            if (!cuentaCodigo) {
              throw new Error(`La línea #${idx + 1} del asiento de rendición de gastos no especifica código de cuenta contable; no se admiten cuentas por defecto.`);
            }
            return {
              id: l.id || `line-${entryId}-${idx + 1}`,
              entryId: entryId,
              lineaNumero: idx + 1,
              cuentaCodigo,
              cuentaNombre: l.cuentaNombre || l.nombreCuenta || 'Gastos Generales',
              debe: Number(l.debe) || 0,
              haber: Number(l.haber) || 0,
              glosa: l.glosa || candidateEntry.glosa || item.titulo,
              rutAuxiliar: l.rutAuxiliar || null,
            };
          });

          if (dp && typeof dp.addAccountingEntry === 'function') {
            dp.addAccountingEntry({
              ...candidateEntry,
              id: entryId,
              empresaId: candidateEntry.empresaId || item.empresaId,
              fecha: candidateEntry.fecha || new Date().toISOString().slice(0, 10),
              periodo: candidateEntry.periodo || new Date().toISOString().slice(0, 7),
              concepto: candidateEntry.concepto || item.titulo,
              glosa: candidateEntry.glosa || item.titulo,
              estado: 'CENTRALIZADO',
              origenModulo: 'RENDICION_GASTOS',
            }, mappedLines);
          }

          if (repId && dp && typeof dp.updateExpenseReportStatus === 'function') {
            dp.updateExpenseReportStatus(repId, 'CONTABILIZADA_PAGADA', undefined, undefined, entryId);
          }

          item.asientoContableId = entryId;
          item.montoAprobadoClp = montoAprobado || sumDebe;
          item.montoEjecutadoClp = sumDebe;
          item.estado = 'EJECUTADO';
          item.resultadoEjecucion = `Rendición de gastos contabilizada formalmente por ${userId}. Asiento ${entryId} registrado en Libro Mayor.`;
        } catch (err: any) {
          console.warn(`[HrManagementService] Rechazo rendición: ${err.message}`);
          item.estado = 'ERROR_EJECUCION';
          item.resultadoEjecucion = `Fallo crítico centralizando rendición de gastos: ${err.message}.`;
        }
      } else if (operacion === 'EMITIR_DTE') {
        try {
          const tipoDte = Number(item.datosOperacion?.tipoDte || 33);

          // Resolver ficha de empresa para emisor
          let company: any = null;
          const cleanTargetId = (item.empresaId || '').replace(/[\.\-\s]/g, '').toUpperCase();
          if (dp && typeof dp.getCompanies === 'function') {
            const companies = dp.getCompanies();
            company = companies.find((c: any) => {
              const cId = (c.id || '').replace(/[\.\-\s]/g, '').toUpperCase();
              const cRut = (c.rut || '').replace(/[\.\-\s]/g, '').toUpperCase();
              return cId === cleanTargetId || cRut === cleanTargetId || c.id === item.empresaId || c.rut === item.empresaId;
            });
          }
          if (!company) {
            company = getDemoClients().find((c: any) => {
              const cId = (c.id || '').replace(/[\.\-\s]/g, '').toUpperCase();
              const cRut = (c.rut || '').replace(/[\.\-\s]/g, '').toUpperCase();
              return cId === cleanTargetId || cRut === cleanTargetId || c.id === item.empresaId || c.rut === item.empresaId;
            });
          }
          if (!company && isDemoModeEnabled()) {
            const firm = INITIAL_FIRM;
            const firmRut = (firm.rut || '').replace(/[\.\-\s]/g, '').toUpperCase();
            if (firmRut === cleanTargetId || firm.id === item.empresaId) {
              company = firm;
            }
          }
          if (!company) {
            throw new Error(`Rechazo DTE: No se encontró la empresa emisora con identificador '${item.empresaId}'; no se admiten emisores inventados.`);
          }
          if (!company.rut) {
            throw new Error('Rechazo DTE: La empresa emisora no tiene RUT configurado.');
          }
          if (!company.razonSocial) {
            throw new Error('Rechazo DTE: La empresa emisora no tiene Razón Social configurada; no se admiten valores por defecto.');
          }
          if (!company.giro) {
            throw new Error('Rechazo DTE: La empresa emisora no tiene Giro configurado; no se admiten valores por defecto.');
          }
          if (!company.direccion) {
            throw new Error('Rechazo DTE: La empresa emisora no tiene Dirección configurada; no se admiten valores por defecto.');
          }
          if (!company.comuna) {
            throw new Error('Rechazo DTE: La empresa emisora no tiene Comuna configurada; no se admiten valores por defecto.');
          }

          let payload: HttpDteEmissionPayload;
          let draft: BillingEmissionDraft | undefined;

          if (item.datosOperacion?.emisor && item.datosOperacion?.receptor && item.datosOperacion?.detalles) {
            payload = item.datosOperacion as HttpDteEmissionPayload;
          } else {
            // Validar que el receptor contenga todos los datos fiscales obligatorios sin inventar ninguno
            const rutReceptor = (item.datosOperacion?.receptorRut || item.datosOperacion?.rutReceptor || '').trim();
            if (!rutReceptor) {
              throw new Error('Rechazo DTE: Falta el RUT del receptor en la solicitud de emisión de factura; no se admiten receptores inventados.');
            }

            // Buscar receptor en auxiliares o cartera de clientes si no vienen todos los campos
            const cleanRecRut = rutReceptor.replace(/[\.\-\s]/g, '').toUpperCase();
            let receptorAux: any = null;
            if (dp && typeof dp.getClientAuxiliaries === 'function') {
              const auxList = dp.getClientAuxiliaries(item.empresaId) || [];
              receptorAux = auxList.find((a: any) => (a.rut || '').replace(/[\.\-\s]/g, '').toUpperCase() === cleanRecRut);
            }
            if (!receptorAux) {
              receptorAux = getDemoClients().find((c: any) => (c.rut || '').replace(/[\.\-\s]/g, '').toUpperCase() === cleanRecRut);
            }

            const razonSocialReceptor = (item.datosOperacion?.receptorRazonSocial || item.datosOperacion?.razonSocialReceptor || receptorAux?.razonSocial || receptorAux?.nombreCorto || '').trim();
            if (!razonSocialReceptor) {
              throw new Error('Rechazo DTE: Falta la Razón Social del receptor en la solicitud de emisión; no se admiten valores por defecto.');
            }
            const giroReceptor = (item.datosOperacion?.giroReceptor || receptorAux?.giro || '').trim();
            if (!giroReceptor) {
              throw new Error('Rechazo DTE: Falta el Giro del receptor en la solicitud de emisión; no se admiten valores por defecto.');
            }
            const direccionReceptor = (item.datosOperacion?.direccionReceptor || receptorAux?.direccion || '').trim();
            if (!direccionReceptor) {
              throw new Error('Rechazo DTE: Falta la Dirección del receptor en la solicitud de emisión; no se admiten valores por defecto.');
            }
            const comunaReceptor = (item.datosOperacion?.comunaReceptor || receptorAux?.comuna || '').trim();
            if (!comunaReceptor) {
              throw new Error('Rechazo DTE: Falta la Comuna del receptor en la solicitud de emisión; no se admiten valores por defecto.');
            }

            // Validar que los ítems vengan explícitamente detallados
            const rawItems = Array.isArray(item.datosOperacion?.items) ? item.datosOperacion.items : [];
            if (rawItems.length === 0) {
              throw new Error('Rechazo DTE: La solicitud de factura no incluye ítems de detalle (cantidad, precio unitario y descripción); no se admiten ítems inventados a partir del monto.');
            }

            const mappedItems: BillingItemDetail[] = rawItems.map((it: any, idx: number) => {
              const nombre = it.nombre || it.descripcion;
              if (!nombre) {
                throw new Error(`Rechazo DTE: Ítem #${idx + 1} no especifica nombre ni descripción; no se admiten valores por defecto.`);
              }
              const cantidad = Number(it.cantidad);
              if (!cantidad || isNaN(cantidad) || cantidad <= 0) {
                throw new Error(`Rechazo DTE: Ítem '${nombre}' tiene cantidad inválida (${it.cantidad}); debe ser mayor a 0.`);
              }
              const precioUnitario = Number(it.precioUnitario);
              if (precioUnitario === undefined || isNaN(precioUnitario) || precioUnitario < 0) {
                throw new Error(`Rechazo DTE: Ítem '${nombre}' no especifica precio unitario válido; no se admiten valores por defecto.`);
              }
              return {
                id: it.id || generateBrowserSafeId('itm'),
                nombre,
                descripcion: it.descripcion || nombre,
                cantidad,
                unidadMedida: it.unidadMedida || 'C/U',
                precioUnitario,
                montoTotal: Number(it.montoTotal || Math.round(cantidad * precioUnitario)),
                esExento: Boolean(it.esExento || tipoDte === 34),
              };
            });

            const montoNeto = Number(
              item.datosOperacion?.montoNeto ||
              (tipoDte === 34 ? 0 : mappedItems.reduce((acc: number, it: any) => acc + (it.esExento ? 0 : it.montoTotal), 0))
            );
            const montoExento = Number(
              item.datosOperacion?.montoExento ||
              (tipoDte === 34 ? Number(item.datosOperacion?.montoTotal || item.impactoFinancieroClp || 0) : mappedItems.reduce((acc: number, it: any) => acc + (it.esExento ? it.montoTotal : 0), 0))
            );
            const montoIva = Number(
              item.datosOperacion?.montoIva ||
              (tipoDte === 34 ? 0 : Math.round(montoNeto * 0.19))
            );
            const montoTotal = Number(
              item.datosOperacion?.montoTotal || (montoNeto + montoExento + montoIva) || item.impactoFinancieroClp || 0
            );

            draft = {
              id: generateBrowserSafeId('draft'),
              tipoDte: tipoDte as any,
              folioSugerido: item.datosOperacion?.folio || item.datosOperacion?.folioSugerido,
              fechaEmision: item.datosOperacion?.fechaEmision || new Date().toISOString().slice(0, 10),
              fechaVencimiento: item.datosOperacion?.fechaVencimiento || item.datosOperacion?.fechaEmision || new Date().toISOString().slice(0, 10),
              rutReceptor,
              razonSocialReceptor,
              giroReceptor,
              direccionReceptor,
              comunaReceptor,
              ciudadReceptor: item.datosOperacion?.ciudadReceptor || comunaReceptor,
              emailReceptorDte: item.datosOperacion?.emailReceptorDte || item.datosOperacion?.email || undefined,
              condicionVenta: item.datosOperacion?.condicionVenta || 'CONTADO',
              items: mappedItems,
              montoNeto,
              montoExento,
              montoIva,
              montoTotal,
            };

            const montoAprobado = Number(item.impactoFinancieroClp ?? item.impactoFinanciero ?? 0);
            if (montoAprobado > 0 && Math.abs(montoTotal - montoAprobado) > 1) {
              throw new Error(
                `Discrepancia financiera: El total del DTE a emitir ($${montoTotal.toLocaleString('es-CL')}) ` +
                `no coincide con el monto aprobado ($${montoAprobado.toLocaleString('es-CL')}). Se rechaza la emisión.`
              );
            }

            const httpDteService = await getHttpDteBillingService();
            if (!httpDteService) {
              throw new Error('Servicio de facturación DTE no disponible en este entorno.');
            }
            payload = httpDteService.mapErpToHttpDtePayload(draft, company);
          }

          const httpDteService = await getHttpDteBillingService();
          if (!httpDteService) {
            throw new Error('Servicio de facturación DTE no disponible en este entorno.');
          }

          const montoAprobado = Number(item.impactoFinancieroClp ?? item.impactoFinanciero ?? 0);
          const totalDte = Number((payload as any).montoTotal || (payload as any).totales?.mntTotal || draft?.montoTotal || item.datosOperacion?.montoTotal || 0);
          if (montoAprobado > 0 && Math.abs(totalDte - montoAprobado) > 1) {
            throw new Error(
              `Discrepancia financiera: El total del DTE a emitir ($${totalDte.toLocaleString('es-CL')}) ` +
              `no coincide con el monto aprobado ($${montoAprobado.toLocaleString('es-CL')}). Se rechaza la emisión.`
            );
          }

          // Invocación oficial a emitirDte
          const emissionResult = await httpDteService.emitirDte(payload, { maxRetries: 0, timeoutMs: 3000 });

          const trackId = emissionResult?.trackId;
          const timbre = emissionResult?.ted;

          if (!emissionResult?.success || (!trackId && !timbre)) {
            item.estado = 'ERROR_EJECUCION';
            item.resultadoEjecucion = `Fallo crítico en emisión DTE: ${emissionResult?.error || 'El servicio no retornó Track ID ni Timbre Electrónico (TED).'}`;
          } else {
            try {
              if (draft) {
                await httpDteService.persistEmittedDte(emissionResult, payload, draft);
              }
            } catch (pErr: any) {
              console.warn('[HrManagementService] Error persistiendo DTE emitido:', pErr?.message);
            }

            item.montoAprobadoClp = montoAprobado || totalDte;
            item.montoEjecutadoClp = totalDte;
            item.estado = 'EJECUTADO';
            item.resultadoEjecucion = `DTE Tipo ${tipoDte} emitido exitosamente mediante emitirDte por ${userId}. Track ID: ${trackId || 'N/A'}. Timbre TED: ${timbre ? 'GENERADO' : 'N/A'}. Folio: ${emissionResult.folio || payload.folio}.`;
            item.trackId = trackId;
            item.ted = timbre;
            item.folioEmitido = emissionResult.folio || payload.folio;
          }
        } catch (err: any) {
          console.warn(`[HrManagementService] Rechazo DTE: ${err.message}`);
          item.estado = 'ERROR_EJECUCION';
          item.resultadoEjecucion = `Fallo crítico en emisión DTE: ${err.message}.`;
        }
      } else {
        const candidateEntry = this.extractCandidateAccountingEntry(item.datosOperacion);

        if (candidateEntry) {
          try {
            const entryId = candidateEntry.id || `entry-appr-${Date.now()}`;
            const normalizedEntry = {
              ...candidateEntry,
              id: entryId,
              empresaId: candidateEntry.empresaId || item.empresaId,
              fecha: candidateEntry.fecha || new Date().toISOString().slice(0, 10),
              periodo: candidateEntry.periodo || (candidateEntry.fecha || new Date().toISOString().slice(0, 10)).slice(0, 7),
              concepto: candidateEntry.concepto || candidateEntry.glosa || item.titulo,
              glosa: candidateEntry.glosa || candidateEntry.concepto || item.titulo,
              estado: 'CENTRALIZADO',
              origenModulo: item.modulo || 'GOBERNANZA_AGENTICA',
            };

            const rawLines = candidateEntry.lineas || candidateEntry.lines || [];
            if (!Array.isArray(rawLines) || rawLines.length === 0) {
              throw new Error('La transacción no incluye líneas contables válidas (Debe/Haber).');
            }

            const sumDebe = rawLines.reduce((acc: number, l: any) => acc + (Number(l.debe) || 0), 0);
            const sumHaber = rawLines.reduce((acc: number, l: any) => acc + (Number(l.haber) || 0), 0);
            if (Math.abs(sumDebe - sumHaber) > 1) {
              throw new Error(`El asiento contable está descuadrado: Debe ($${sumDebe}) != Haber ($${sumHaber}).`);
            }

            const montoAprobado = Number(item.impactoFinancieroClp ?? item.impactoFinanciero ?? 0);
            if (montoAprobado > 0 && Math.abs(sumDebe - montoAprobado) > 1) {
              throw new Error(
                `Discrepancia financiera: El monto del asiento contable ($${sumDebe.toLocaleString('es-CL')}) ` +
                `no coincide con el monto aprobado ($${montoAprobado.toLocaleString('es-CL')}). Se rechaza la ejecución.`
              );
            }

            const mappedLines = rawLines.map((l: any, idx: number) => {
              const cuentaCodigo = l.cuentaCodigo || l.codigoCuenta || l.cuenta;
              if (!cuentaCodigo) {
                throw new Error(`La línea #${idx + 1} del asiento contable no especifica código de cuenta contable; no se admiten cuentas por defecto.`);
              }
              return {
                id: l.id || `line-${entryId}-${idx + 1}`,
                entryId: entryId,
                lineaNumero: idx + 1,
                cuentaCodigo,
                cuentaNombre: l.cuentaNombre || l.nombreCuenta || l.glosa || 'Cuenta Imputada',
                debe: Number(l.debe) || 0,
                haber: Number(l.haber) || 0,
                glosa: l.glosa || normalizedEntry.glosa || item.titulo,
                rutAuxiliar: l.rutAuxiliar || null,
              };
            });

            if (dp && typeof dp.addAccountingEntry === 'function') {
              dp.addAccountingEntry(normalizedEntry, mappedLines);
            }

            item.asientoContableId = entryId;
            item.montoAprobadoClp = montoAprobado || sumDebe;
            item.montoEjecutadoClp = sumDebe;
            item.estado = 'EJECUTADO';
            item.resultadoEjecucion = `Operación aprobada por ${userId}. Asiento contable formal centralizado exitosamente en el Libro Mayor (ID: ${entryId}, Total: $${sumDebe.toLocaleString('es-CL')}).`;
          } catch (err: any) {
            console.warn(`[HrManagementService] Rechazo asiento contable: ${err.message}`);
            item.estado = 'ERROR_EJECUCION';
            item.resultadoEjecucion = `Fallo crítico en la ejecución contable: ${err.message}. La operación NO fue asentada en el Libro Mayor.`;
          }
        } else {
          item.estado = 'APROBADO';
          item.resultadoEjecucion = `Operación aprobada por ${userId}. Estado: APROBADO (pendiente de ejecución manual o integración de pasarela bancaria externa; no se realizó desembolso automático ni asiento contable).`;
        }
      }
    } else {
      item.estado = 'RECHAZADO';
      item.resultadoEjecucion = `Operación rechazada por el supervisor ${userId}.`;
    }

    const dpSave = getDiskPersistence();
    if (dpSave && typeof dpSave.saveApproval === 'function') {
      dpSave.saveApproval(item);
    }
    return item;
  }

  /**
   * Listar solicitudes de aprobación humana por módulo o empresa
   */
  static getApprovals(empresaId: string, modulo?: ModuleAgentApprovalRequest['modulo']): ModuleAgentApprovalRequest[] {
    const dp = getDiskPersistence();
    const persisted = (dp && typeof dp.getApprovals === 'function') ? dp.getApprovals(empresaId, modulo) : [];
    for (const p of persisted) {
      const idx = this.approvalsStore.findIndex(a => a.id === p.id);
      if (idx >= 0) {
        this.approvalsStore[idx] = p;
      } else {
        this.approvalsStore.push(p);
      }
    }
    const cleanTarget = (empresaId || '').replace(/[^0-9kK]/g, '').toUpperCase();
    return this.approvalsStore.filter(a => {
      const cleanEmp = (a.empresaId || '').replace(/[^0-9kK]/g, '').toUpperCase();
      const matchEmp = cleanEmp === cleanTarget || a.empresaId === empresaId;
      return matchEmp && (!modulo || a.modulo === modulo);
    });
  }

  /**
   * Obtener una solicitud de aprobación humana por su ID único
   */
  static getApprovalById(approvalId: string): ModuleAgentApprovalRequest | undefined {
    let item = this.approvalsStore.find(a => a.id === approvalId);
    if (item) return item;

    const dp = getDiskPersistence();
    if (dp && typeof dp.getApprovals === 'function') {
      const all = dp.getApprovals();
      const found = all.find((a: any) => a.id === approvalId);
      if (found) {
        this.approvalsStore.push(found);
        return found;
      }
    }
    return undefined;
  }

  /**
   * Obtener encuestas y diagnósticos de clima laboral
   */
  static getClimateSurveys(empresaId: string): HrClimateSurvey[] {
    return this.climateSurveysStore.filter(s => s.empresaId === empresaId);
  }

  /**
   * Obtiene el listado de períodos históricos disponibles para una empresa
   */
  static getAvailableHistoricalPeriods(empresaId: string): string[] {
    const periodsSet = new Set<string>();
    for (const [key, list] of this.historicalSettlements.entries()) {
      const [kEmp, kPer] = key.split('::');
      if (this.matchesCompany(kEmp, empresaId) && list.length > 0) {
        periodsSet.add(kPer);
      }
    }
    const defaultPeriods = ['2026-08', '2026-07', '2026-06', '2026-05'];
    for (const dp of defaultPeriods) periodsSet.add(dp);
    return Array.from(periodsSet).sort().reverse();
  }

  /**
   * Obtiene el historial de imposiciones y leyes sociales pagadas vía PreviRed
   */
  static getHistoricalSocialSecurityPayments(empresaId: string): SocialSecurityHistoricalPayment[] {
    return this.socialSecurityPaymentsStore
      .filter(p => this.matchesCompany(p.empresaId, empresaId) || this.matchesCompany(p.rutEmpresa, empresaId))
      .sort((a, b) => b.periodo.localeCompare(a.periodo));
  }

  /**
   * Obtiene un comprobante o registro específico de imposiciones
   */
  static getSocialSecurityPayment(paymentId: string): SocialSecurityHistoricalPayment | undefined {
    return this.socialSecurityPaymentsStore.find(p => p.id === paymentId || p.folioPrevired === paymentId);
  }

  /**
   * Registro histórico de evolución y variación de conceptos de liquidación para un colaborador
   * Permite ver cómo variaron mes a mes y suministra los datos base para formular ajustes retroactivos
   */
  static getConceptEvolutionForEmployee(empresaId: string, employeeIdOrRut: string): PayrollConceptEvolutionPoint[] {
    const periods = this.getAvailableHistoricalPeriods(empresaId).reverse(); // Orden cronológico ascendente (mayo a agosto)
    const points: PayrollConceptEvolutionPoint[] = [];

    for (let i = 0; i < periods.length; i++) {
      const periodo = periods[i];
      const settlements = this.getHistoricalSettlements(empresaId, periodo);
      const payroll = settlements.find(
        p => p.id === employeeIdOrRut || this.matchesCompany(p.rut, employeeIdOrRut)
      );

      if (!payroll) continue;

      const point: PayrollConceptEvolutionPoint = {
        periodo,
        employeeId: payroll.id,
        rut: payroll.rut,
        nombreCompleto: payroll.nombreCompleto,
        cargo: payroll.cargo,
        departamento: payroll.departamento,
        sueldoBase: payroll.sueldoBase,
        gratificacionLegal: payroll.gratificacionMonto,
        horasExtrasCantidad: payroll.horasExtrasCantidad,
        horasExtrasMonto: payroll.horasExtrasMonto,
        comisionesBonos: payroll.comisionesBonosImponibles,
        totalImponible: payroll.totalHaberesImponibles,
        colacion: payroll.asignacionColacion,
        movilizacion: payroll.asignacionMovilizacion,
        viaticos: payroll.viaticosAsignacionFamiliar,
        totalNoImponible: payroll.totalHaberesNoImponibles,
        totalHaberes: payroll.totalHaberesBrutos,
        afpNombre: payroll.afpNombre,
        afpMonto: payroll.afpMonto,
        saludTipo: payroll.saludTipo,
        saludMonto: payroll.saludMonto,
        afcTrabajador: payroll.afcTrabajadorMonto,
        impuestoUnico: payroll.impuestoUnicoMonto,
        otrosDescuentos: payroll.otrosDescuentos,
        totalDescuentos: payroll.totalDescuentos,
        sueldoLiquido: payroll.sueldoLiquido,
        sisMonto: payroll.sisEmpleadorMonto,
        mutualMonto: payroll.mutualEmpleadorMonto,
        afcEmpleador: payroll.afcEmpleadorMonto,
        ley21735Monto: payroll.reformaPrevisionalLey21735Monto || Math.round(payroll.totalHaberesImponibles * 0.01),
        costoTotalEmpresa: payroll.costoTotalEmpresa,
      };

      // Si existe punto anterior, computar variaciones de conceptos
      if (points.length > 0) {
        const prev = points[points.length - 1];
        const imponibleDiff = point.totalImponible - prev.totalImponible;
        const imponibleDiffPct = prev.totalImponible > 0 ? (imponibleDiff / prev.totalImponible) * 100 : 0;
        const liquidoDiff = point.sueldoLiquido - prev.sueldoLiquido;
        const liquidoDiffPct = prev.sueldoLiquido > 0 ? (liquidoDiff / prev.sueldoLiquido) * 100 : 0;
        const sueldoBaseDiff = point.sueldoBase - prev.sueldoBase;
        const sueldoBaseDiffPct = prev.sueldoBase > 0 ? (sueldoBaseDiff / prev.sueldoBase) * 100 : 0;
        const costoEmpresaDiff = point.costoTotalEmpresa - prev.costoTotalEmpresa;
        const costoEmpresaDiffPct = prev.costoTotalEmpresa > 0 ? (costoEmpresaDiff / prev.costoTotalEmpresa) * 100 : 0;

        const conceptosConCambio: string[] = [];
        if (sueldoBaseDiff !== 0) {
          conceptosConCambio.push(`Sueldo Base (${sueldoBaseDiff > 0 ? '+' : ''}$${sueldoBaseDiff.toLocaleString('es-CL')})`);
        }
        if (point.horasExtrasCantidad !== prev.horasExtrasCantidad) {
          conceptosConCambio.push(`Horas Extras (${point.horasExtrasCantidad} hrs vs ${prev.horasExtrasCantidad} hrs)`);
        }
        if (point.comisionesBonos !== prev.comisionesBonos) {
          const diffBonos = point.comisionesBonos - prev.comisionesBonos;
          conceptosConCambio.push(`Bonos/Comisiones (${diffBonos > 0 ? '+' : ''}$${diffBonos.toLocaleString('es-CL')})`);
        }
        if (point.gratificacionLegal !== prev.gratificacionLegal) {
          const diffGrat = point.gratificacionLegal - prev.gratificacionLegal;
          conceptosConCambio.push(`Gratificación (${diffGrat > 0 ? '+' : ''}$${diffGrat.toLocaleString('es-CL')})`);
        }
        if (point.impuestoUnico !== prev.impuestoUnico) {
          const diffIusc = point.impuestoUnico - prev.impuestoUnico;
          conceptosConCambio.push(`Impuesto Único (${diffIusc > 0 ? '+' : ''}$${diffIusc.toLocaleString('es-CL')})`);
        }

        point.variacionMesAnterior = {
          imponibleDiff,
          imponibleDiffPct,
          liquidoDiff,
          liquidoDiffPct,
          sueldoBaseDiff,
          sueldoBaseDiffPct,
          costoEmpresaDiff,
          costoEmpresaDiffPct,
          conceptosConCambio,
        };
      }

      points.push(point);
    }

    return points;
  }
}
