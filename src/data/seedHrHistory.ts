/**
 * Historial de remuneraciones, clima laboral y reliquidaciones de las empresas de ejemplo.
 * Datos semilla: HrManagementService los carga solo con DEMO_MODE=true.
 */
import type { EmployeePayroll, SocialSecurityEmployeeDetail, SocialSecurityHistoricalPayment, ChileIndicators } from '../types';

export interface HrDemoStores {
  climateSurveysStore: any[];
  historicalSettlements: Map<string, EmployeePayroll[]>;
  reliquidationsStore: any[];
  socialSecurityPaymentsStore: any[];
}

export function seedHrHistoricalDemoData(stores: HrDemoStores, deps: Record<string, any>): void {
  const { calculatePayroll, DEFAULT_INDICATORS, generateBrowserSafeHash } = deps as any;

    const defaultEmpresaId = 'client-innovagile';
    const innovagileRut = '77.798.901-4';
    const retailEmpresaId = 'client-retail-01';
    const retailRut = '76.104.550-9';

    // Generar encuestas de clima iniciales
    stores.climateSurveysStore.push({
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

      stores.socialSecurityPaymentsStore.push(paymentRecord);
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

      stores.historicalSettlements.set(`${defaultEmpresaId}::${hp.periodo}`, calculatedPayrolls);
      stores.historicalSettlements.set(`${innovagileRut}::${hp.periodo}`, calculatedPayrolls);

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

      stores.historicalSettlements.set(`${retailEmpresaId}::${hp.periodo}`, calculatedRetailPayrolls);
      stores.historicalSettlements.set(`${retailRut}::${hp.periodo}`, calculatedRetailPayrolls);

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
    stores.reliquidationsStore.push({
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

    stores.reliquidationsStore.push({
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
