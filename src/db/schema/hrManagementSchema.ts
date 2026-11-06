import {
  mysqlTable,
  varchar,
  text,
  decimal,
  date,
  datetime,
  int,
  boolean,
  mysqlEnum,
  json,
  index,
  uniqueIndex,
} from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';
import { employees } from './employeesSchema';

// ============================================================================
// 1. TABLA: payroll_historical_settlements (Historial Inmutable de Liquidaciones Mensuales)
// ============================================================================
export const payrollHistoricalSettlements = mysqlTable(
  'payroll_historical_settlements',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    empresaId: varchar('empresa_id', { length: 36 }).notNull(),
    periodo: varchar('periodo', { length: 7 }).notNull(), // Formato YYYY-MM
    employeeId: varchar('employee_id', { length: 36 })
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    rutEmpleado: varchar('rut_empleado', { length: 20 }).notNull(),
    nombreEmpleado: varchar('nombre_empleado', { length: 255 }).notNull(),
    cargo: varchar('cargo', { length: 150 }).notNull(),
    departamento: varchar('departamento', { length: 100 }).notNull(),
    diasTrabajados: int('dias_trabajados').notNull().default(30),
    jornadaHorasSemanales: int('jornada_horas_semanales').notNull().default(40),
    tipoContrato: varchar('tipo_contrato', { length: 30 }).notNull(),
    // Haberes Imponibles
    sueldoBase: decimal('sueldo_base', { precision: 15, scale: 2 }).notNull(),
    gratificacionLegal: decimal('gratificacion_legal', { precision: 15, scale: 2 }).notNull().default('0.00'),
    horasExtrasMonto: decimal('horas_extras_monto', { precision: 15, scale: 2 }).notNull().default('0.00'),
    horasExtrasCantidad: decimal('horas_extras_cantidad', { precision: 6, scale: 2 }).notNull().default('0.00'),
    comisionesBonos: decimal('comisiones_bonos', { precision: 15, scale: 2 }).notNull().default('0.00'),
    totalImponible: decimal('total_imponible', { precision: 15, scale: 2 }).notNull(),
    // Haberes No Imponibles
    asignacionColacion: decimal('asignacion_colacion', { precision: 15, scale: 2 }).notNull().default('0.00'),
    asignacionMovilizacion: decimal('asignacion_movilizacion', { precision: 15, scale: 2 }).notNull().default('0.00'),
    viaticosAsignacionFamiliar: decimal('viaticos_asignacion_familiar', { precision: 15, scale: 2 }).notNull().default('0.00'),
    totalNoImponible: decimal('total_no_imponible', { precision: 15, scale: 2 }).notNull(),
    totalBruto: decimal('total_bruto', { precision: 15, scale: 2 }).notNull(),
    // Descuentos Previsionales y de Salud
    afpNombre: varchar('afp_nombre', { length: 50 }).notNull(),
    afpTasa: decimal('afp_tasa', { precision: 6, scale: 4 }).notNull(),
    afpMonto: decimal('afp_monto', { precision: 15, scale: 2 }).notNull(),
    saludTipo: varchar('salud_tipo', { length: 20 }).notNull(),
    saludPlanUf: decimal('salud_plan_uf', { precision: 8, scale: 4 }).default('0.0000'),
    saludMonto: decimal('salud_monto', { precision: 15, scale: 2 }).notNull(),
    afcTrabajadorMonto: decimal('afc_trabajador_monto', { precision: 15, scale: 2 }).notNull().default('0.00'),
    impuestoUnicoMonto: decimal('impuesto_unico_monto', { precision: 15, scale: 2 }).notNull().default('0.00'),
    otrosDescuentos: decimal('otros_descuentos', { precision: 15, scale: 2 }).notNull().default('0.00'),
    totalDescuentos: decimal('total_descuentos', { precision: 15, scale: 2 }).notNull(),
    sueldoLiquido: decimal('sueldo_liquido', { precision: 15, scale: 2 }).notNull(),
    // Aportes Patronales (Costos Empleador)
    sisEmpleadorMonto: decimal('sis_empleador_monto', { precision: 15, scale: 2 }).notNull(),
    mutualEmpleadorMonto: decimal('mutual_empleador_monto', { precision: 15, scale: 2 }).notNull(),
    afcEmpleadorMonto: decimal('afc_empleador_monto', { precision: 15, scale: 2 }).notNull(),
    // Ley 21.735 Reforma Previsional (1.0% Aporte Patronal)
    ley21735EmpleadorMonto: decimal('ley21735_empleador_monto', { precision: 15, scale: 2 }).notNull().default('0.00'),
    costoTotalEmpresa: decimal('costo_total_empresa', { precision: 15, scale: 2 }).notNull(),
    // Parámetros e Indicadores Vigentes del Período
    ufPeriodo: decimal('uf_periodo', { precision: 12, scale: 4 }).notNull(),
    utmPeriodo: decimal('utm_periodo', { precision: 12, scale: 2 }).notNull(),
    topeAfpUf: decimal('tope_afp_uf', { precision: 6, scale: 2 }).notNull().default('90.00'),
    topeAfcUf: decimal('tope_afc_uf', { precision: 6, scale: 2 }).notNull().default('135.20'),
    // Estado y Gobernanza
    cerrado: boolean('cerrado').notNull().default(true),
    asientoCentralizacionId: varchar('asiento_centralizacion_id', { length: 64 }),
    reliquidado: boolean('reliquidado').notNull().default(false),
    createdAt: datetime('created_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
  },
  (table) => ({
    uqEmpresaPeriodoEmpleadoHist: uniqueIndex('uq_payroll_hist_empresa_periodo_empleado').on(
      table.empresaId,
      table.periodo,
      table.employeeId
    ),
    idxHistEmpresaPeriodo: index('idx_payroll_hist_empresa_periodo').on(table.empresaId, table.periodo),
    idxHistEmpleado: index('idx_payroll_hist_empleado').on(table.employeeId),
  })
);

// ============================================================================
// 2. TABLA: payroll_reliquidations (Ajustes y Reliquidaciones Retroactivas)
// ============================================================================
export const payrollReliquidations = mysqlTable(
  'payroll_reliquidations',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    empresaId: varchar('empresa_id', { length: 36 }).notNull(),
    employeeId: varchar('employee_id', { length: 36 })
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    rutEmpleado: varchar('rut_empleado', { length: 20 }).notNull(),
    nombreEmpleado: varchar('nombre_empleado', { length: 255 }).notNull(),
    periodoDevengado: varchar('periodo_devengado', { length: 7 }).notNull(), // Mes original donde se devengó la renta (YYYY-MM)
    periodoPago: varchar('periodo_pago', { length: 7 }).notNull(), // Mes donde se paga la reliquidación (YYYY-MM)
    motivoAjuste: mysqlEnum('motivo_ajuste', [
      'AUMENTO_SUELDO_RETROACTIVO',
      'BONO_RETROACTIVO',
      'CORRECCION_HORAS_EXTRAS',
      'CORRECCION_DIAS_TRABAJADOS',
      'DIFERENCIAL_COMISIONES',
      'ERROR_CALCULO',
      'RESOLUCION_DT_TRIBUNAL',
    ]).notNull(),
    detalleMotivo: text('detalle_motivo').notNull(),
    // Diferenciales Imponibles
    diferencialSueldoBase: decimal('diferencial_sueldo_base', { precision: 15, scale: 2 }).notNull().default('0.00'),
    diferencialHorasExtras: decimal('diferencial_horas_extras', { precision: 15, scale: 2 }).notNull().default('0.00'),
    diferencialComisiones: decimal('diferencial_comisiones', { precision: 15, scale: 2 }).notNull().default('0.00'),
    diferencialGratificacion: decimal('diferencial_gratificacion', { precision: 15, scale: 2 }).notNull().default('0.00'),
    diferencialTotalImponible: decimal('diferencial_total_imponible', { precision: 15, scale: 2 }).notNull(),
    // Diferenciales de Cotizaciones Previsionales sobre la diferencia
    diferencialAfp: decimal('diferencial_afp', { precision: 15, scale: 2 }).notNull().default('0.00'),
    diferencialSalud: decimal('diferencial_salud', { precision: 15, scale: 2 }).notNull().default('0.00'),
    diferencialAfcTrabajador: decimal('diferencial_afc_trabajador', { precision: 15, scale: 2 }).notNull().default('0.00'),
    diferencialAfcEmpleador: decimal('diferencial_afc_empleador', { precision: 15, scale: 2 }).notNull().default('0.00'),
    diferencialSis: decimal('diferencial_sis', { precision: 15, scale: 2 }).notNull().default('0.00'),
    diferencialMutual: decimal('diferencial_mutual', { precision: 15, scale: 2 }).notNull().default('0.00'),
    diferencialLey21735: decimal('diferencial_ley21735', { precision: 15, scale: 2 }).notNull().default('0.00'),
    // Reliquidación de Impuesto Único de Segunda Categoría (Art. 46 LIR)
    utmPeriodoDevengado: decimal('utm_periodo_devengado', { precision: 12, scale: 2 }).notNull(),
    impuestoUnicoOriginal: decimal('impuesto_unico_original', { precision: 15, scale: 2 }).notNull().default('0.00'),
    impuestoUnicoRecalculado: decimal('impuesto_unico_recalculado', { precision: 15, scale: 2 }).notNull().default('0.00'),
    diferencialImpuestoUnico: decimal('diferencial_impuesto_unico', { precision: 15, scale: 2 }).notNull().default('0.00'),
    // Monto Líquido a Pagar por el Ajuste
    totalDiferencialLiquido: decimal('total_diferencial_liquido', { precision: 15, scale: 2 }).notNull(),
    totalCostoEmpresaAjuste: decimal('total_costo_empresa_ajuste', { precision: 15, scale: 2 }).notNull(),
    // Estado y Aprobación Humana
    estado: mysqlEnum('reliquidacion_estado', [
      'BORRADOR',
      'PENDIENTE_APROBACION_HUMANA',
      'APROBADO_Y_PAGADO',
      'RECHAZADO',
    ]).notNull().default('PENDIENTE_APROBACION_HUMANA'),
    solicitadoPorAgente: varchar('solicitado_por_agente', { length: 100 }).notNull(),
    aprobadoPorUsuario: varchar('aprobado_por_usuario', { length: 100 }),
    fechaAprobacion: datetime('fecha_aprobacion', { fsp: 3 }),
    asientoAjusteId: varchar('asiento_ajuste_id', { length: 64 }),
    createdAt: datetime('created_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
  },
  (table) => ({
    idxReliquidacionEmpresaPeriodo: index('idx_reliquidation_empresa_periodo').on(table.empresaId, table.periodoPago),
    idxReliquidacionDevengado: index('idx_reliquidation_devengado').on(table.empresaId, table.periodoDevengado),
    idxReliquidacionEmpleado: index('idx_reliquidation_empleado').on(table.employeeId),
  })
);

// ============================================================================
// 3. TABLA: hr_climate_surveys (Gestión de Clima Laboral y Evaluaciones 360)
// ============================================================================
export const hrClimateSurveys = mysqlTable(
  'hr_climate_surveys',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    empresaId: varchar('empresa_id', { length: 36 }).notNull(),
    titulo: varchar('titulo', { length: 255 }).notNull(),
    periodo: varchar('periodo', { length: 20 }).notNull(), // ej: '2026-Q1', '2026-03'
    scoreLiderazgo: decimal('score_liderazgo', { precision: 5, scale: 2 }).notNull().default('0.00'),
    scoreRemuneraciones: decimal('score_remuneraciones', { precision: 5, scale: 2 }).notNull().default('0.00'),
    scoreAmbiente: decimal('score_ambiente', { precision: 5, scale: 2 }).notNull().default('0.00'),
    scoreBalanceVidaTrabajo: decimal('score_balance_vida_trabajo', { precision: 5, scale: 2 }).notNull().default('0.00'),
    scoreDesarrolloCarrera: decimal('score_desarrollo_carrera', { precision: 5, scale: 2 }).notNull().default('0.00'),
    indiceEnps: int('indice_enps').notNull().default(0), // -100 a +100
    tasaParticipacion: decimal('tasa_participacion', { precision: 5, scale: 2 }).notNull().default('0.00'),
    totalColaboradoresEvaluados: int('total_colaboradores_evaluados').notNull().default(0),
    alertasClima: json('alertas_clima').$type<string[]>(),
    recomendacionesAgente: json('recomendaciones_agente').$type<string[]>(),
    estado: mysqlEnum('clima_estado', ['EN_CURSO', 'CONCLUIDA', 'PUBLICADA']).notNull().default('PUBLICADA'),
    createdAt: datetime('created_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
  },
  (table) => ({
    idxClimateEmpresa: index('idx_climate_empresa').on(table.empresaId),
  })
);

// ============================================================================
// 4. TABLA: module_agent_approvals (Gobernanza Agéntica Transversal con Aprobación Humana)
// ============================================================================
export const moduleAgentApprovals = mysqlTable(
  'module_agent_approvals',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    empresaId: varchar('empresa_id', { length: 36 }).notNull(),
    modulo: mysqlEnum('modulo_codigo', [
      'RRHH',
      'CONTABILIDAD',
      'TRIBUTARIO_SII',
      'TESORERIA',
      'COMERCIAL_COMPRAS',
      'INVENTARIO',
    ]).notNull(),
    agenteNombre: varchar('agente_nombre', { length: 150 }).notNull(),
    operacionTipo: varchar('operacion_tipo', { length: 100 }).notNull(), // ej: 'PAGO_NOMINA', 'EMISION_DTE', 'DECLARACION_F29', 'RELIQUIDACION_SUELDO', 'CONTRATACION'
    titulo: varchar('titulo', { length: 255 }).notNull(),
    descripcion: text('descripcion').notNull(),
    datosOperacion: json('datos_operacion').notNull(),
    impactoFinancieroClp: decimal('impacto_financiero_clp', { precision: 15, scale: 2 }).default('0.00'),
    nivelRiesgo: mysqlEnum('nivel_riesgo', ['BAJO', 'MEDIO', 'ALTO', 'CRITICO']).notNull().default('MEDIO'),
    estado: mysqlEnum('approval_estado', ['PENDIENTE', 'APROBADO', 'RECHAZADO', 'EJECUTADO', 'ERROR_EJECUCION']).notNull().default('PENDIENTE'),
    solicitadoEn: datetime('solicitado_en', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
    resueltoPor: varchar('resuelto_por', { length: 100 }),
    resueltoEn: datetime('resuelto_en', { fsp: 3 }),
    resultadoEjecucion: text('resultado_ejecucion'),
  },
  (table) => ({
    idxApprovalEmpresaModulo: index('idx_approval_empresa_modulo').on(table.empresaId, table.modulo),
    idxApprovalEstado: index('idx_approval_estado').on(table.estado),
  })
);

// ============================================================================
// 5. TABLA: payroll_previred_historical_payments (Historial Imposiciones PreviRed)
// ============================================================================
export const payrollPreviredHistoricalPayments = mysqlTable(
  'payroll_previred_historical_payments',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    empresaId: varchar('empresa_id', { length: 36 }).notNull(),
    rutEmpresa: varchar('rut_empresa', { length: 20 }).notNull(),
    razonSocial: varchar('razon_social', { length: 255 }).notNull(),
    periodo: varchar('periodo', { length: 7 }).notNull(), // Formato YYYY-MM
    folioPrevired: varchar('folio_previred', { length: 50 }).notNull(),
    fechaPago: datetime('fecha_pago', { fsp: 3 }).notNull(),
    medioPago: varchar('medio_pago', { length: 50 }).notNull().default('CPE_BANCO_CHILE'),
    banco: varchar('banco', { length: 100 }).notNull().default('Banco de Chile'),
    nroTransaccion: varchar('nro_transaccion', { length: 60 }).notNull(),
    estado: varchar('estado', { length: 40 }).notNull().default('PAGADO_Y_ACREDITADO'),
    totalTrabajadores: int('total_trabajadores').notNull().default(0),
    montoAfpTotal: decimal('monto_afp_total', { precision: 15, scale: 2 }).notNull().default('0.00'),
    montoSaludTotal: decimal('monto_salud_total', { precision: 15, scale: 2 }).notNull().default('0.00'),
    montoAfcTotal: decimal('monto_afc_total', { precision: 15, scale: 2 }).notNull().default('0.00'),
    montoMutualTotal: decimal('monto_mutual_total', { precision: 15, scale: 2 }).notNull().default('0.00'),
    montoSisTotal: decimal('monto_sis_total', { precision: 15, scale: 2 }).notNull().default('0.00'),
    montoLey21735Total: decimal('monto_ley21735_total', { precision: 15, scale: 2 }).notNull().default('0.00'),
    montoCajaCompensacionTotal: decimal('monto_caja_compensacion_total', { precision: 15, scale: 2 }).notNull().default('0.00'),
    montoTotalPagado: decimal('monto_total_pagado', { precision: 15, scale: 2 }).notNull().default('0.00'),
    asientoPagoId: varchar('asiento_pago_id', { length: 64 }),
    detallesPorTrabajador: json('detalles_por_trabajador'),
    comprobanteHash: varchar('comprobante_hash', { length: 100 }),
    certificadoF30Url: varchar('certificado_f30_url', { length: 255 }),
    createdAt: datetime('created_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
  },
  (table) => ({
    uqPreviredEmpresaPeriodo: uniqueIndex('uq_previred_empresa_periodo').on(table.empresaId, table.periodo),
    idxPreviredEmpresa: index('idx_previred_empresa').on(table.empresaId),
    idxPreviredFolio: index('idx_previred_folio').on(table.folioPrevired),
  })
);
