import {
  mysqlTable,
  varchar,
  decimal,
  date,
  datetime,
  boolean,
  int,
  index,
  uniqueIndex,
} from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';

// ============================================================================
// TABLA: employees (Ficha y Contrato del Trabajador)
// ============================================================================
export const employees = mysqlTable(
  'employees',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    empresaId: varchar('empresa_id', { length: 20 }).notNull(),
    rut: varchar('rut', { length: 20 }).notNull(),
    nombreCompleto: varchar('nombre_completo', { length: 255 }).notNull(),
    cargo: varchar('cargo', { length: 150 }).notNull(),
    departamento: varchar('departamento', { length: 100 }).notNull(),
    fechaIngreso: date('fecha_ingreso', { mode: 'string' }).notNull(),
    tipoContrato: varchar('tipo_contrato', { length: 30 }).notNull().default('INDEFINIDO'), // 'INDEFINIDO' | 'PLAZO_FIJO'
    sueldoBase: decimal('sueldo_base', { precision: 15, scale: 2 }).notNull(),
    gratificacionModalidad: varchar('gratificacion_modalidad', { length: 30 }).notNull().default('ART_50'),
    horasExtrasCantidad: decimal('horas_extras_cantidad', { precision: 6, scale: 2 }).notNull().default('0.00'),
    comisionesBonosImponibles: decimal('comisiones_bonos_imponibles', { precision: 15, scale: 2 }).notNull().default('0.00'),
    asignacionColacion: decimal('asignacion_colacion', { precision: 15, scale: 2 }).notNull().default('0.00'),
    asignacionMovilizacion: decimal('asignacion_movilizacion', { precision: 15, scale: 2 }).notNull().default('0.00'),
    viaticosAsignacionFamiliar: decimal('viaticos_asignacion_familiar', { precision: 15, scale: 2 }).notNull().default('0.00'),
    afpNombre: varchar('afp_nombre', { length: 50 }).notNull().default('HABITAT'), // CAPITAL, CUPRUM, HABITAT, MODELO, PLANVITAL, PROVIDA, UNO
    saludTipo: varchar('salud_tipo', { length: 20 }).notNull().default('FONASA'), // FONASA, ISAPRE
    saludPlanUf: decimal('salud_plan_uf', { precision: 8, scale: 4 }).default('0.0000'),
    otrosDescuentos: decimal('otros_descuentos', { precision: 15, scale: 2 }).notNull().default('0.00'),
    activo: boolean('activo').notNull().default(true),
    createdAt: datetime('created_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
  },
  (table) => ({
    uqEmpresaRut: uniqueIndex('uq_employees_empresa_rut').on(table.empresaId, table.rut),
    idxEmployeesEmpresaActivo: index('idx_employees_empresa_activo').on(table.empresaId, table.activo),
  })
);

// ============================================================================
// TABLA: payroll_settlements (Liquidaciones Mensuales de Remuneraciones)
// ============================================================================
export const payrollSettlements = mysqlTable(
  'payroll_settlements',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    empresaId: varchar('empresa_id', { length: 20 }).notNull(),
    periodo: varchar('periodo', { length: 7 }).notNull(), // Formato: YYYY-MM
    employeeId: varchar('employee_id', { length: 36 }).notNull(),
    rutEmpleado: varchar('rut_empleado', { length: 20 }).notNull(),
    nombreEmpleado: varchar('nombre_empleado', { length: 255 }).notNull(),
    diasTrabajados: int('dias_trabajados').notNull().default(30),
    sueldoBase: decimal('sueldo_base', { precision: 15, scale: 2 }).notNull(),
    horasExtrasMonto: decimal('horas_extras_monto', { precision: 15, scale: 2 }).notNull().default('0.00'),
    gratificacionLegal: decimal('gratificacion_legal', { precision: 15, scale: 2 }).notNull().default('0.00'),
    comisionesBonos: decimal('comisiones_bonos', { precision: 15, scale: 2 }).notNull().default('0.00'),
    totalImponible: decimal('total_imponible', { precision: 15, scale: 2 }).notNull(),
    totalNoImponible: decimal('total_no_imponible', { precision: 15, scale: 2 }).notNull(),
    totalBruto: decimal('total_bruto', { precision: 15, scale: 2 }).notNull(),
    afpNombre: varchar('afp_nombre', { length: 50 }).notNull(),
    afpMonto: decimal('afp_monto', { precision: 15, scale: 2 }).notNull(),
    saludTipo: varchar('salud_tipo', { length: 20 }).notNull(),
    saludMonto: decimal('salud_monto', { precision: 15, scale: 2 }).notNull(),
    afcTrabajadorMonto: decimal('afc_trabajador_monto', { precision: 15, scale: 2 }).notNull(),
    impuestoUnicoMonto: decimal('impuesto_unico_monto', { precision: 15, scale: 2 }).notNull().default('0.00'),
    totalDescuentos: decimal('total_descuentos', { precision: 15, scale: 2 }).notNull(),
    sueldoLiquido: decimal('sueldo_liquido', { precision: 15, scale: 2 }).notNull(),
    sisEmpleadorMonto: decimal('sis_empleador_monto', { precision: 15, scale: 2 }).notNull(),
    mutualEmpleadorMonto: decimal('mutual_empleador_monto', { precision: 15, scale: 2 }).notNull(),
    afcEmpleadorMonto: decimal('afc_empleador_monto', { precision: 15, scale: 2 }).notNull(),
    costoTotalEmpresa: decimal('costo_total_empresa', { precision: 15, scale: 2 }).notNull(),
    createdAt: datetime('created_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
  },
  (table) => ({
    uqEmpresaPeriodoEmpleado: uniqueIndex('uq_payroll_empresa_periodo_empleado').on(
      table.empresaId,
      table.periodo,
      table.employeeId
    ),
    idxPayrollPeriodo: index('idx_payroll_periodo').on(table.empresaId, table.periodo),
  })
);

export type EmployeeRecord = typeof employees.$inferSelect;
export type NewEmployeeRecord = typeof employees.$inferInsert;
export type PayrollSettlementRecord = typeof payrollSettlements.$inferSelect;
export type NewPayrollSettlementRecord = typeof payrollSettlements.$inferInsert;
