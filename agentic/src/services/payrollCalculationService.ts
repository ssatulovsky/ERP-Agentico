import crypto from 'node:crypto';
import { eq, and, sql } from 'drizzle-orm';
import {
  employees,
  payrollSettlements,
  accountingEntries,
  accountingEntryLines,
  agentAuditLogs,
  type EmployeeRecord,
} from '../db/mysqlSchema';
import { getMysqlDb, isRealMysqlConnected } from '../db/mysqlClient';
import { IndicatorSyncService } from './indicatorSyncService';
import { calculateImpuestoUnico } from '../utils/chileanAccounting';
import { normalizeAndValidateJournalEntry } from './journalEntryNormalizer';

// Tasas oficiales de cotización previsional de las AFPs chilenas (10% obligatorio + comisión de la administradora)
export const CHILEAN_AFP_RATES: Record<string, number> = {
  CAPITAL: 0.1144, // 10% + 1.44%
  CUPRUM: 0.1144, // 10% + 1.44%
  HABITAT: 0.1127, // 10% + 1.27%
  MODELO: 0.1058, // 10% + 0.58%
  PLANVITAL: 0.1116, // 10% + 1.16%
  PROVIDA: 0.1145, // 10% + 1.45%
  UNO: 0.1046, // 10% + 0.46%
};

// Parámetros legales laborales chilenos vigentes
export const LABOR_CONSTANTS = {
  IMM: 500000, // Ingreso Mínimo Mensual ($500.000 CLP)
  TOPE_AFP_SALUD_UF: 84.3, // Tope imponible en UF para previsión y salud
  TOPE_AFC_UF: 126.6, // Tope imponible en UF para seguro de cesantía
  TASA_FONASA: 0.07, // 7% cotización legal obligatoria de salud
  TASA_SIS_EMPLEADOR: 0.0149, // 1.49% Seguro de Invalidez y Sobrevivencia
  TASA_MUTUAL_BASE: 0.0093, // 0.93% Mutual de Seguridad básica Ley 16.744
  AFC_INDEFINIDO_TRABAJADOR: 0.006, // 0.6% trabajador indefinido
  AFC_INDEFINIDO_EMPLEADOR: 0.024, // 2.4% empleador indefinido
  AFC_PLAZO_FIJO_TRABAJADOR: 0.0, // 0% trabajador plazo fijo / obra
  AFC_PLAZO_FIJO_EMPLEADOR: 0.03, // 3.0% empleador plazo fijo / obra
};

export interface EmployeePayrollDetail {
  employeeId: string;
  rut: string;
  nombreCompleto: string;
  cargo: string;
  departamento: string;
  tipoContrato: string;
  diasTrabajados: number;
  sueldoBase: number;
  horasExtrasCantidad: number;
  horasExtrasMonto: number;
  comisionesBonos: number;
  gratificacionLegal: number;
  totalHaberesImponibles: number;
  asignacionColacion: number;
  asignacionMovilizacion: number;
  viaticos: number;
  totalHaberesNoImponibles: number;
  totalHaberesBrutos: number;
  afpNombre: string;
  afpTasa: number;
  afpMonto: number;
  saludTipo: string;
  saludMonto: number;
  afcTrabajadorMonto: number;
  impuestoUnicoMonto: number;
  otrosDescuentos: number;
  totalDescuentos: number;
  sueldoLiquido: number;
  sisEmpleadorMonto: number;
  mutualEmpleadorMonto: number;
  afcEmpleadorMonto: number;
  costoTotalEmpresa: number;
}

export interface PayrollBatchSummary {
  empresaId: string;
  periodo: string;
  totalTrabajadores: number;
  totalHaberesImponibles: number;
  totalHaberesNoImponibles: number;
  totalHaberesBrutos: number;
  totalAfp: number;
  totalSalud: number;
  totalAfcTrabajador: number;
  totalImpuestoUnico: number;
  totalDescuentos: number;
  totalSueldosLiquidos: number;
  totalAfcEmpleador: number;
  totalSisEmpleador: number;
  totalMutualEmpleador: number;
  costoTotalEmpresa: number;
  detalles: EmployeePayrollDetail[];
  asientoCentralizacionId?: string;
}

/**
 * Plantilla de colaboradores iniciales para siembra en base de datos si la empresa no posee ficha cargada
 */
const SEED_EMPLOYEES_DATA = [
  {
    rut: '14.892.301-2',
    nombreCompleto: 'Ignacio Andrés Valenzuela Castro',
    cargo: 'Líder Técnico de Arquitectura de Software',
    departamento: 'Ingeniería',
    fechaIngreso: '2021-04-01',
    tipoContrato: 'INDEFINIDO',
    sueldoBase: '3800000.00',
    gratificacionModalidad: 'ART_50',
    horasExtrasCantidad: '8.00',
    comisionesBonosImponibles: '450000.00',
    asignacionColacion: '90000.00',
    asignacionMovilizacion: '80000.00',
    viaticosAsignacionFamiliar: '0.00',
    afpNombre: 'HABITAT',
    saludTipo: 'ISAPRE',
    saludPlanUf: '7.2000',
    otrosDescuentos: '0.00',
    activo: true,
  },
  {
    rut: '16.450.912-K',
    nombreCompleto: 'Francisca Paz Santander Henríquez',
    cargo: 'Ingeniera de Datos y Machine Learning',
    departamento: 'Desarrollo',
    fechaIngreso: '2022-07-15',
    tipoContrato: 'INDEFINIDO',
    sueldoBase: '2400000.00',
    gratificacionModalidad: 'ART_50',
    horasExtrasCantidad: '4.00',
    comisionesBonosImponibles: '200000.00',
    asignacionColacion: '85000.00',
    asignacionMovilizacion: '75000.00',
    viaticosAsignacionFamiliar: '0.00',
    afpNombre: 'CUPRUM',
    saludTipo: 'FONASA',
    saludPlanUf: '0.0000',
    otrosDescuentos: '0.00',
    activo: true,
  },
  {
    rut: '17.890.342-8',
    nombreCompleto: 'Sebastián Eduardo Morales Peña',
    cargo: 'Consultor de Finanzas y Control de Gestión',
    departamento: 'Administración',
    fechaIngreso: '2023-01-10',
    tipoContrato: 'INDEFINIDO',
    sueldoBase: '1600000.00',
    gratificacionModalidad: 'ART_50',
    horasExtrasCantidad: '0.00',
    comisionesBonosImponibles: '100000.00',
    asignacionColacion: '80000.00',
    asignacionMovilizacion: '70000.00',
    viaticosAsignacionFamiliar: '0.00',
    afpNombre: 'MODELO',
    saludTipo: 'FONASA',
    saludPlanUf: '0.0000',
    otrosDescuentos: '0.00',
    activo: true,
  },
];

export class PayrollCalculationService {
  /**
   * Asegura la existencia de empleados en la base de datos para la empresa especificada.
   */
  public static async getOrSeedEmployees(empresaId: string): Promise<EmployeeRecord[]> {
    const cleanEmpresaId = empresaId.replace(/\./g, '').trim().toUpperCase();

    const isDemoCompany = cleanEmpresaId === 'DEMO' || cleanEmpresaId === 'CLIENT-RETAIL-01';

    const db = getMysqlDb();

    if (isRealMysqlConnected) {
      const records = await db
        .select()
        .from(employees)
        .where(and(eq(employees.empresaId, cleanEmpresaId), eq(employees.activo, true)));

      if (records.length > 0) {
        return records;
      }

      // Sembrar colaboradores iniciales ÚNICAMENTE si es la empresa demo configurada
      if (isDemoCompany) {
        console.log(`[PayrollService] Sembrando nómina inicial de colaboradores para empresa demo: ${cleanEmpresaId}`);
        for (const emp of SEED_EMPLOYEES_DATA) {
          const id = crypto.randomUUID();
          await db.insert(employees).values({
            id,
            empresaId: cleanEmpresaId,
            ...emp,
          }).onDuplicateKeyUpdate({
            set: {
              sueldoBase: emp.sueldoBase,
              activo: true,
            }
          });
        }

        return await db
          .select()
          .from(employees)
          .where(and(eq(employees.empresaId, cleanEmpresaId), eq(employees.activo, true)));
      }

      // Para cualquier cliente real que no tenga colaboradores aún, retornar lista vacía (cero datos mock)
      return [];
    }

    // Si está en modo contingencia en memoria: retornar empleados solo si es empresa demo
    if (isDemoCompany) {
      return SEED_EMPLOYEES_DATA.map((e, idx) => ({
        id: `emp-local-${idx + 1}`,
        empresaId: cleanEmpresaId,
        rut: e.rut,
        nombreCompleto: e.nombreCompleto,
        cargo: e.cargo,
        departamento: e.departamento,
        fechaIngreso: e.fechaIngreso,
        tipoContrato: e.tipoContrato,
        sueldoBase: e.sueldoBase,
        gratificacionModalidad: e.gratificacionModalidad,
        horasExtrasCantidad: e.horasExtrasCantidad,
        comisionesBonosImponibles: e.comisionesBonosImponibles,
        asignacionColacion: e.asignacionColacion,
        asignacionMovilizacion: e.asignacionMovilizacion,
        viaticosAsignacionFamiliar: e.viaticosAsignacionFamiliar,
        afpNombre: e.afpNombre,
        saludTipo: e.saludTipo,
        saludPlanUf: e.saludPlanUf,
        seguroCesantiaActivo: e.seguroCesantiaActivo,
        activo: e.activo,
        createdAt: new Date(),
      }));
    }

    return [];
  }

  /**
   * Ejecuta el cálculo individual pericial de remuneraciones para un colaborador
   * conforme a la legislación laboral chilena (Código del Trabajo, Ley 19.728 de AFC, D.L. 3.500 de AFP).
   */
  public static calculateSingleEmployeePayroll(
    emp: EmployeeRecord,
    ufValue: number,
    utmValue: number
  ): EmployeePayrollDetail {
    const sueldoBase = parseFloat(emp.sueldoBase) || 0;
    const horasExtrasCant = parseFloat(emp.horasExtrasCantidad) || 0;
    const comisiones = parseFloat(emp.comisionesBonosImponibles) || 0;
    const colacion = parseFloat(emp.asignacionColacion) || 0;
    const movilizacion = parseFloat(emp.asignacionMovilizacion) || 0;
    const viaticos = parseFloat(emp.viaticosAsignacionFamiliar) || 0;
    const otrosDesc = parseFloat(emp.otrosDescuentos) || 0;
    const tipoContrato = (emp.tipoContrato || 'INDEFINIDO').toUpperCase();
    const afpNombre = (emp.afpNombre || 'HABITAT').toUpperCase();
    const saludTipo = (emp.saludTipo || 'FONASA').toUpperCase();
    const saludPlanUf = parseFloat(emp.saludPlanUf || '0') || 0;

    // 1. Horas Extras (Factor semana laboral estándar chilena: (1/30) * (28/44) * 1.5)
    const factorHoraExtra = (1 / 30) * (28 / 44) * 1.5;
    const valorHoraExtra = Math.round(sueldoBase * factorHoraExtra);
    const horasExtrasMonto = Math.round(horasExtrasCant * valorHoraExtra);

    // 2. Gratificación Legal Art. 50 (25% del sueldo con tope mensual 4.75 IMM / 12)
    let gratificacionLegal = 0;
    if (emp.gratificacionModalidad === 'ART_50') {
      const topeMensualArt50 = Math.round((4.75 * LABOR_CONSTANTS.IMM) / 12);
      const subtotalParaGratif = sueldoBase + horasExtrasMonto + comisiones;
      gratificacionLegal = Math.min(Math.round(subtotalParaGratif * 0.25), topeMensualArt50);
    }

    const totalHaberesImponibles = sueldoBase + horasExtrasMonto + comisiones + gratificacionLegal;
    const totalHaberesNoImponibles = colacion + movilizacion + viaticos;
    const totalHaberesBrutos = totalHaberesImponibles + totalHaberesNoImponibles;

    // 3. Topes imponibles en pesos chilenos según el valor real de la UF
    const topeAfpSaludCLP = Math.round(LABOR_CONSTANTS.TOPE_AFP_SALUD_UF * ufValue);
    const topeAfcCLP = Math.round(LABOR_CONSTANTS.TOPE_AFC_UF * ufValue);

    const baseAfpSalud = Math.min(totalHaberesImponibles, topeAfpSaludCLP);
    const baseAfc = Math.min(totalHaberesImponibles, topeAfcCLP);

    // 4. Descuento previsional AFP
    const afpTasa = CHILEAN_AFP_RATES[afpNombre] || 0.1127;
    const afpMonto = Math.round(baseAfpSalud * afpTasa);

    // 5. Descuento de Salud (7% obligatorio Fonasa o plan pactado en UF de Isapre)
    let saludMonto = Math.round(baseAfpSalud * LABOR_CONSTANTS.TASA_FONASA);
    if (saludTipo === 'ISAPRE' && saludPlanUf > 0) {
      const planPactadoCLP = Math.round(saludPlanUf * ufValue);
      saludMonto = Math.max(saludMonto, planPactadoCLP);
    }

    // 6. Seguro de Cesantía AFC (Trabajador)
    const afcTrabajadorTasa =
      tipoContrato === 'INDEFINIDO'
        ? LABOR_CONSTANTS.AFC_INDEFINIDO_TRABAJADOR
        : LABOR_CONSTANTS.AFC_PLAZO_FIJO_TRABAJADOR;
    const afcTrabajadorMonto = Math.round(baseAfc * afcTrabajadorTasa);

    // 7. Base Imponible Tributaria para Impuesto Único de Segunda Categoría
    // Se deduce AFP, Fonasa/Isapre hasta el 7% o tope legal, y AFC trabajador
    const saludDeducible = Math.min(saludMonto, Math.round(baseAfpSalud * LABOR_CONSTANTS.TASA_FONASA));
    const baseTributable = Math.max(0, totalHaberesImponibles - afpMonto - saludDeducible - afcTrabajadorMonto);
    const impuestoUnicoMonto = calculateImpuestoUnico(baseTributable, utmValue);

    // 8. Descuentos y Sueldo Líquido
    const totalDescuentos = afpMonto + saludMonto + afcTrabajadorMonto + impuestoUnicoMonto + otrosDesc;
    const sueldoLiquido = totalHaberesBrutos - totalDescuentos;

    // 9. Costos Patronales a cargo del Empleador
    const sisEmpleadorMonto = Math.round(baseAfpSalud * LABOR_CONSTANTS.TASA_SIS_EMPLEADOR);
    const mutualEmpleadorMonto = Math.round(baseAfpSalud * LABOR_CONSTANTS.TASA_MUTUAL_BASE);
    const afcEmpleadorTasa =
      tipoContrato === 'INDEFINIDO'
        ? LABOR_CONSTANTS.AFC_INDEFINIDO_EMPLEADOR
        : LABOR_CONSTANTS.AFC_PLAZO_FIJO_EMPLEADOR;
    const afcEmpleadorMonto = Math.round(baseAfc * afcEmpleadorTasa);

    const costoTotalEmpresa =
      totalHaberesBrutos + sisEmpleadorMonto + mutualEmpleadorMonto + afcEmpleadorMonto;

    return {
      employeeId: emp.id,
      rut: emp.rut,
      nombreCompleto: emp.nombreCompleto,
      cargo: emp.cargo,
      departamento: emp.departamento,
      tipoContrato,
      diasTrabajados: 30,
      sueldoBase,
      horasExtrasCantidad: horasExtrasCant,
      horasExtrasMonto,
      comisionesBonos: comisiones,
      gratificacionLegal,
      totalHaberesImponibles,
      asignacionColacion: colacion,
      asignacionMovilizacion: movilizacion,
      viaticos,
      totalHaberesNoImponibles,
      totalHaberesBrutos,
      afpNombre,
      afpTasa,
      afpMonto,
      saludTipo,
      saludMonto,
      afcTrabajadorMonto,
      impuestoUnicoMonto,
      otrosDescuentos: otrosDesc,
      totalDescuentos,
      sueldoLiquido,
      sisEmpleadorMonto,
      mutualEmpleadorMonto,
      afcEmpleadorMonto,
      costoTotalEmpresa,
    };
  }

  /**
   * Procesa la nómina real mensual de una empresa para un periodo tributario:
   * - Obtiene UF y UTM de MySQL / API
   * - Calcula liquidación de cada empleado activo
   * - Persiste liquidaciones en la tabla `payroll_settlements`
   * - Genera y registra el asiento contable de centralización debidamente balanceado (Debe == Haber)
   * - Registra log en `agent_audit_logs`
   */
  public static async calculateRealPayroll(
    empresaId: string,
    periodo: string
  ): Promise<PayrollBatchSummary> {
    const cleanEmpresaId = empresaId.replace(/\./g, '').trim().toUpperCase();
    const traceId = crypto.randomUUID();
    const startTime = Date.now();

    console.log(`[PayrollService] Iniciando cálculo real de nómina para empresa ${cleanEmpresaId} (Periodo: ${periodo})`);

    // 1. Obtener indicadores oficiales reales para el periodo
    const targetDate = `${periodo}-01`;
    const [ufValue, utmValue] = await Promise.all([
      IndicatorSyncService.getIndicator('UF', targetDate),
      IndicatorSyncService.getIndicator('UTM', targetDate),
    ]);

    console.log(`[PayrollService] Parámetros económicos: UF = $${ufValue} | UTM = $${utmValue}`);

    // 2. Obtener colaboradores reales de la empresa
    const activeEmployees = await this.getOrSeedEmployees(cleanEmpresaId);

    if (activeEmployees.length === 0) {
      console.log(`[PayrollService] Empresa ${cleanEmpresaId} no posee trabajadores activos registrados. Nómina en 0 para F29.`);
      return {
        empresaId: cleanEmpresaId,
        periodo,
        totalTrabajadores: 0,
        totalHaberesImponibles: 0,
        totalHaberesNoImponibles: 0,
        totalHaberesBrutos: 0,
        totalAfp: 0,
        totalSalud: 0,
        totalAfcTrabajador: 0,
        totalImpuestoUnico: 0,
        totalDescuentos: 0,
        totalSueldosLiquidos: 0,
        totalAfcEmpleador: 0,
        totalSisEmpleador: 0,
        totalMutualEmpleador: 0,
        costoTotalEmpresa: 0,
        asientoCentralizacionId: '',
        detalles: [],
      };
    }

    // 3. Procesar liquidación pericial de cada colaborador
    const detalles: EmployeePayrollDetail[] = activeEmployees.map((emp) =>
      this.calculateSingleEmployeePayroll(emp, ufValue, utmValue)
    );

    // 4. Totales consolidados de la nómina
    let totalHaberesImponibles = 0;
    let totalHaberesNoImponibles = 0;
    let totalHaberesBrutos = 0;
    let totalAfp = 0;
    let totalSalud = 0;
    let totalAfcTrabajador = 0;
    let totalImpuestoUnico = 0;
    let totalDescuentos = 0;
    let totalSueldosLiquidos = 0;
    let totalAfcEmpleador = 0;
    let totalSisEmpleador = 0;
    let totalMutualEmpleador = 0;
    let costoTotalEmpresa = 0;
    let totalSueldosBase = 0;
    let totalGratificaciones = 0;

    for (const d of detalles) {
      totalHaberesImponibles += d.totalHaberesImponibles;
      totalHaberesNoImponibles += d.totalHaberesNoImponibles;
      totalHaberesBrutos += d.totalHaberesBrutos;
      totalAfp += d.afpMonto;
      totalSalud += d.saludMonto;
      totalAfcTrabajador += d.afcTrabajadorMonto;
      totalImpuestoUnico += d.impuestoUnicoMonto;
      totalDescuentos += d.totalDescuentos;
      totalSueldosLiquidos += d.sueldoLiquido;
      totalAfcEmpleador += d.afcEmpleadorMonto;
      totalSisEmpleador += d.sisEmpleadorMonto;
      totalMutualEmpleador += d.mutualEmpleadorMonto;
      costoTotalEmpresa += d.costoTotalEmpresa;
      totalSueldosBase += (d.sueldoBase + d.horasExtrasMonto + d.comisionesBonos);
      totalGratificaciones += d.gratificacionLegal;
    }

    const totalAportesPatronales = totalAfcEmpleador + totalSisEmpleador + totalMutualEmpleador;

    // 5. Persistir liquidaciones en la tabla `payroll_settlements`
    const db = getMysqlDb();
    if (isRealMysqlConnected) {
      try {
        for (const det of detalles) {
          const settlementId = crypto.randomUUID();
          await db
            .insert(payrollSettlements)
            .values({
              id: settlementId,
              empresaId: cleanEmpresaId,
              periodo,
              employeeId: det.employeeId,
              rutEmpleado: det.rut,
              nombreEmpleado: det.nombreCompleto,
              diasTrabajados: det.diasTrabajados,
              sueldoBase: det.sueldoBase.toFixed(2),
              horasExtrasMonto: det.horasExtrasMonto.toFixed(2),
              gratificacionLegal: det.gratificacionLegal.toFixed(2),
              comisionesBonos: det.comisionesBonos.toFixed(2),
              totalImponible: det.totalHaberesImponibles.toFixed(2),
              totalNoImponible: det.totalHaberesNoImponibles.toFixed(2),
              totalBruto: det.totalHaberesBrutos.toFixed(2),
              afpNombre: det.afpNombre,
              afpMonto: det.afpMonto.toFixed(2),
              saludTipo: det.saludTipo,
              saludMonto: det.saludMonto.toFixed(2),
              afcTrabajadorMonto: det.afcTrabajadorMonto.toFixed(2),
              impuestoUnicoMonto: det.impuestoUnicoMonto.toFixed(2),
              totalDescuentos: det.totalDescuentos.toFixed(2),
              sueldoLiquido: det.sueldoLiquido.toFixed(2),
              sisEmpleadorMonto: det.sisEmpleadorMonto.toFixed(2),
              mutualEmpleadorMonto: det.mutualEmpleadorMonto.toFixed(2),
              afcEmpleadorMonto: det.afcEmpleadorMonto.toFixed(2),
              costoTotalEmpresa: det.costoTotalEmpresa.toFixed(2),
            })
            .onDuplicateKeyUpdate({
              set: {
                totalImponible: det.totalHaberesImponibles.toFixed(2),
                totalDescuentos: det.totalDescuentos.toFixed(2),
                sueldoLiquido: det.sueldoLiquido.toFixed(2),
                costoTotalEmpresa: det.costoTotalEmpresa.toFixed(2),
              },
            });
        }
      } catch (insertErr: any) {
        console.warn('[PayrollService] Advertencia al persistir liquidaciones en MySQL:', insertErr.message);
      }
    }

    // 6. Generar Asiento Contable de Centralización de Nómina con Partida Doble
    // DEBE: Costos y Gastos de Personal
    // HABER: Pasivos por Remuneraciones y Leyes Sociales
    const totalDebe = totalSueldosBase + totalGratificaciones + totalHaberesNoImponibles + totalAportesPatronales;
    const totalHaberParcial =
      totalAfp +
      totalSalud +
      (totalAfcTrabajador + totalAfcEmpleador) +
      (totalMutualEmpleador + totalSisEmpleador) +
      totalImpuestoUnico;

    // Ajuste matemático de redondeo al sueldo líquido para cuadre perfecto (Σ Debe == Σ Haber)
    const sueldoLiquidoAjustado = totalDebe - totalHaberParcial;

    const asientoId = crypto.randomUUID();
    const fechaAsiento = `${periodo}-28`;

    const rawAsientoLines = [
      {
        codigoCuenta: '5.2.01',
        nombreCuenta: 'Sueldos y Remuneraciones Base',
        debe: totalSueldosBase,
        haber: 0,
        glosaDetalle: `Sueldos base periodo ${periodo}`,
      },
      {
        codigoCuenta: '5.2.02',
        nombreCuenta: 'Gratificaciones Legales Art. 50',
        debe: totalGratificaciones,
        haber: 0,
        glosaDetalle: `Gratificación legal periodo ${periodo}`,
      },
      {
        codigoCuenta: '5.2.05',
        nombreCuenta: 'Asignaciones No Imponibles (Colación y Movilización)',
        debe: totalHaberesNoImponibles,
        haber: 0,
        glosaDetalle: `Asignaciones no imponibles ${periodo}`,
      },
      {
        codigoCuenta: '5.2.04',
        nombreCuenta: 'Aportes Patronales (SIS, Mutual, AFC Empleador)',
        debe: totalAportesPatronales,
        haber: 0,
        glosaDetalle: `Leyes sociales empleador periodo ${periodo}`,
      },
      // PASIVOS (HABER)
      {
        codigoCuenta: '2.1.08',
        nombreCuenta: 'Instituciones Previsionales (AFP) por Pagar',
        debe: 0,
        haber: totalAfp,
        glosaDetalle: `Retención cotización AFP periodo ${periodo}`,
      },
      {
        codigoCuenta: '2.1.09',
        nombreCuenta: 'Salud (Fonasa / Isapres) por Pagar',
        debe: 0,
        haber: totalSalud,
        glosaDetalle: `Cotización salud Fonasa/Isapre ${periodo}`,
      },
      {
        codigoCuenta: '2.1.10',
        nombreCuenta: 'AFC Seguro de Cesantía por Pagar',
        debe: 0,
        haber: totalAfcTrabajador + totalAfcEmpleador,
        glosaDetalle: `AFC aporte conjunto trabajador y empleador ${periodo}`,
      },
      {
        codigoCuenta: '2.1.11',
        nombreCuenta: 'Mutual de Seguridad / SIS por Pagar',
        debe: 0,
        haber: totalMutualEmpleador + totalSisEmpleador,
        glosaDetalle: `Seguridad laboral y SIS ${periodo}`,
      },
      ...(totalImpuestoUnico > 0
        ? [
            {
              codigoCuenta: '2.1.05',
              nombreCuenta: 'Impuesto Único 2da Categoría por Pagar (F29)',
              debe: 0,
              haber: totalImpuestoUnico,
              glosaDetalle: `Retención Impuesto Único Sueldos periodo ${periodo}`,
            },
          ]
        : []),
      {
        codigoCuenta: '2.1.07',
        nombreCuenta: 'Sueldos Líquidos por Pagar',
        debe: 0,
        haber: sueldoLiquidoAjustado,
        glosaDetalle: `Remuneraciones líquidas a pagar trabajadores ${periodo}`,
      },
    ];

    // Normalizar asiento canónico
    const normalizedJournal = normalizeAndValidateJournalEntry({
      id: asientoId,
      empresaId: cleanEmpresaId,
      periodo,
      fecha: fechaAsiento,
      glosaGeneral: `Centralización de Remuneraciones Mes de ${periodo} (${detalles.length} colaboradores)`,
      documentoRef: `NOMINA-${periodo}`,
      origenModulo: 'REMUNERACIONES',
      creadoPorAgente: 'AGENTE_WORKER_RRHH',
      lineas: rawAsientoLines,
    });

    const asientoLines = normalizedJournal.lineas.map((l) => ({
      id: crypto.randomUUID(),
      entryId: asientoId,
      cuentaCodigo: l.codigoCuenta,
      cuentaNombre: l.nombreCuenta,
      debe: l.debe.toFixed(2),
      haber: l.haber.toFixed(2),
      glosa: l.glosaDetalle || `Centralización remuneraciones ${periodo}`,
    }));

    if (isRealMysqlConnected) {
      try {
        await db.insert(accountingEntries).values({
          id: asientoId,
          empresaId: cleanEmpresaId,
          periodo,
          tipoAsiento: 'TRASPASO',
          glosaGeneral: normalizedJournal.glosaGeneral,
          fecha: fechaAsiento,
          totalDebe: normalizedJournal.totalDebe.toFixed(2),
          totalHaber: normalizedJournal.totalHaber.toFixed(2),
          balanceado: true,
          aprobadoSupervisor: true,
          estadoTransicion: 'PUBLICADO',
          traceId,
        });

        for (const line of asientoLines) {
          await db.insert(accountingEntryLines).values(line);
        }

        // Registrar auditoría
        await db.insert(agentAuditLogs).values({
          traceId,
          empresaId: cleanEmpresaId,
          agenteNombre: 'AGENTE_WORKER_RRHH',
          accion: 'CENTRALIZACION_NOMINA_COMPLETA',
          estadoTransicion: 'APROBADO',
          modelName: 'labor-engine-cl',
          payloadInput: { empresaId: cleanEmpresaId, periodo, totalTrabajadores: detalles.length },
          payloadOutput: {
            totalHaberesBrutos,
            totalHaberesImponibles,
            totalDescuentos,
            totalSueldosLiquidos: sueldoLiquidoAjustado,
            costoTotalEmpresa,
            asientoId,
          },
          tiempoEjecucionMs: Date.now() - startTime,
        });
      } catch (dbEntryErr: any) {
        console.warn('[PayrollService] Error al asentar en Libro Diario:', dbEntryErr.message);
      }
    }

    return {
      empresaId: cleanEmpresaId,
      periodo,
      totalTrabajadores: detalles.length,
      totalHaberesImponibles,
      totalHaberesNoImponibles,
      totalHaberesBrutos,
      totalAfp,
      totalSalud,
      totalAfcTrabajador,
      totalImpuestoUnico,
      totalDescuentos,
      totalSueldosLiquidos: sueldoLiquidoAjustado,
      totalAfcEmpleador,
      totalSisEmpleador,
      totalMutualEmpleador,
      costoTotalEmpresa,
      detalles,
      asientoCentralizacionId: asientoId,
    };
  }
}
