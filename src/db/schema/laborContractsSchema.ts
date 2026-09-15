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
  index,
  uniqueIndex,
} from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';
import { employees } from './employeesSchema';

// ============================================================================
// 1. TABLA: labor_contracts (Contratos de Trabajo Registrados en Mi DT / REL)
// ============================================================================
export const laborContracts = mysqlTable(
  'labor_contracts',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    employeeId: varchar('employee_id', { length: 36 })
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    empresaId: varchar('empresa_id', { length: 20 }).notNull(),
    rut: varchar('rut', { length: 20 }).notNull(),
    nombreCompleto: varchar('nombre_completo', { length: 255 }).notNull(),
    cargo: varchar('cargo', { length: 150 }).notNull(),
    departamento: varchar('departamento', { length: 100 }).notNull(),
    tipoContrato: mysqlEnum('tipo_contrato', [
      'INDEFINIDO',
      'PLAZO_FIJO',
      'POR_OBRA_FAENA',
      'PART_TIME',
      'TELETRABAJO_HIBRIDO',
    ]).notNull().default('INDEFINIDO'),
    fechaInicio: date('fecha_inicio', { mode: 'string' }).notNull(),
    fechaTermino: date('fecha_termino', { mode: 'string' }),
    sueldoBase: decimal('sueldo_base', { precision: 15, scale: 2 }).notNull(),
    jornadaHorasSemanales: int('jornada_horas_semanales').notNull().default(40), // Ley 21.561 40 Horas
    distribucionJornada: varchar('distribucion_jornada', { length: 255 }).notNull(),
    lugarTrabajo: varchar('lugar_trabajo', { length: 255 }).notNull(),
    gratificacionModalidad: mysqlEnum('gratificacion_modalidad', ['ART_50', 'ART_47', 'CONVENCIONAL'])
      .notNull()
      .default('ART_50'),
    asignacionColacion: decimal('asignacion_colacion', { precision: 15, scale: 2 }).notNull().default('0.00'),
    asignacionMovilizacion: decimal('asignacion_movilizacion', { precision: 15, scale: 2 }).notNull().default('0.00'),
    estado: mysqlEnum('estado', ['VIGENTE', 'POR_VENCER', 'RENOVADO_INDEFINIDO', 'FINIQUITADO'])
      .notNull()
      .default('VIGENTE'),
    registradoDtRel: boolean('registrado_dt_rel').notNull().default(true),
    folioRegistroDt: varchar('folio_registro_dt', { length: 100 }),
    clausulaConfidencialidad: boolean('clausula_confidencialidad').notNull().default(true),
    clausulaTeletrabajo: boolean('clausula_teletrabajo').notNull().default(false),
    observaciones: text('observaciones'),
    createdAt: datetime('created_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
  },
  (table) => ({
    uqContratoEmployee: uniqueIndex('uq_labor_contract_employee').on(table.employeeId),
    idxContratoEmpresa: index('idx_contract_empresa').on(table.empresaId),
    idxContratoRut: index('idx_contract_rut').on(table.rut),
  })
);

// ============================================================================
// 2. TABLA: labor_contract_annexes (Anexos de Contrato y Pactos DT)
// ============================================================================
export const laborContractAnnexes = mysqlTable(
  'labor_contract_annexes',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    contratoId: varchar('contrato_id', { length: 36 })
      .notNull()
      .references(() => laborContracts.id, { onDelete: 'cascade' }),
    fecha: date('fecha', { mode: 'string' }).notNull(),
    tipo: mysqlEnum('tipo', [
      'CAMBIO_SUELDO',
      'ADAPTACION_LEY_40_HORAS',
      'MODALIDAD_TELETRABAJO',
      'PACTO_HORAS_EXTRAS',
      'CAMBIO_CARGO_FUNCIONES',
    ]).notNull(),
    descripcion: text('descripcion').notNull(),
    registradoDtRel: boolean('registrado_dt_rel').notNull().default(true),
    folioRegistroDt: varchar('folio_registro_dt', { length: 100 }),
    createdAt: datetime('created_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
  },
  (table) => ({
    idxAnnexContrato: index('idx_annex_contrato').on(table.contratoId),
  })
);

// ============================================================================
// 3. TABLA: medical_leaves (Licencias Médicas Electrónicas LME - COMPIN / ISAPRE)
// ============================================================================
export const medicalLeaves = mysqlTable(
  'medical_leaves',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    folioLicencia: varchar('folio_licencia', { length: 50 }).notNull(),
    employeeId: varchar('employee_id', { length: 36 })
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    empresaId: varchar('empresa_id', { length: 20 }).notNull(),
    rut: varchar('rut', { length: 20 }).notNull(),
    nombreCompleto: varchar('nombre_completo', { length: 255 }).notNull(),
    tipoLicencia: mysqlEnum('tipo_licencia', [
      'ENFERMEDAD_COMUN',
      'PRONATAL_POSTNATAL',
      'ACCIDENTE_DEL_TRABAJO',
      'ACCIDENTE_DE_TRAYECTO',
      'ENFERMEDAD_PROFESIONAL',
      'PATOLOGIA_EMBARAZO',
      'ENFERMEDAD_GRAVE_NINO_MENOR_1',
    ]).notNull(),
    entidadTramitadora: mysqlEnum('entidad_tramitadora', [
      'FONASA_COMPIN',
      'ISAPRE_BANMEDICA',
      'ISAPRE_COLMENA',
      'ISAPRE_CONSALUD',
      'ISAPRE_CRUZ_BLANCA',
      'ISAPRE_NUEVA_MASVIDA',
      'MUTUAL_DE_SEGURIDAD',
      'ACHS',
      'IST',
      'ISL',
    ]).notNull(),
    fechaInicio: date('fecha_inicio', { mode: 'string' }).notNull(),
    fechaTermino: date('fecha_termino', { mode: 'string' }).notNull(),
    diasReposo: int('dias_reposo').notNull(),
    diasDescuentoRemuneracion: int('dias_descuento_remuneracion').notNull(),
    diasSubsidioSil: int('dias_subsidio_sil').notNull(),
    descuentoNominaEstimado: decimal('descuento_nomina_estimado', { precision: 15, scale: 2 }).notNull().default('0.00'),
    medicoNombre: varchar('medico_nombre', { length: 200 }).notNull(),
    medicoRut: varchar('medico_rut', { length: 20 }).notNull(),
    diagnosticoCie10: varchar('diagnostico_cie10', { length: 50 }),
    estado: mysqlEnum('estado', [
      'RECIBIDA',
      'TRAMITADA_EMPLEADOR',
      'APROBADA_COMPIN_ISAPRE',
      'RECHAZADA',
      'PAGADA_SIL',
    ]).notNull().default('RECIBIDA'),
    fechaTramitacionEmpleador: date('fecha_tramitacion_empleador', { mode: 'string' }),
    observaciones: text('observaciones'),
    createdAt: datetime('created_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
  },
  (table) => ({
    uqFolioLicencia: uniqueIndex('uq_medical_leave_folio').on(table.empresaId, table.folioLicencia),
    idxLeaveEmployee: index('idx_leave_employee').on(table.employeeId),
    idxLeaveFecha: index('idx_leave_fecha').on(table.fechaInicio),
  })
);

// ============================================================================
// 4. TABLA: vacation_records (Control de Feriado Legal Art. 69 Código del Trabajo)
// ============================================================================
export const vacationRecords = mysqlTable(
  'vacation_records',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    employeeId: varchar('employee_id', { length: 36 })
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    empresaId: varchar('empresa_id', { length: 20 }).notNull(),
    fechaSolicitud: date('fecha_solicitud', { mode: 'string' }).notNull(),
    fechaInicio: date('fecha_inicio', { mode: 'string' }).notNull(),
    fechaRetorno: date('fecha_retorno', { mode: 'string' }).notNull(),
    diasHabilesTomados: decimal('dias_habiles_tomados', { precision: 5, scale: 2 }).notNull(),
    diasProgresivosTomados: decimal('dias_progresivos_tomados', { precision: 5, scale: 2 }).notNull().default('0.00'),
    estado: mysqlEnum('estado', ['SOLICITADA', 'APROBADA_JEFE', 'AUTORIZADA_RRHH', 'RECHAZADA', 'TOMADA'])
      .notNull()
      .default('SOLICITADA'),
    comprobanteFirmado: boolean('comprobante_firmado').notNull().default(false),
    createdAt: datetime('created_at', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
  },
  (table) => ({
    idxVacationEmployee: index('idx_vacation_employee').on(table.employeeId),
    idxVacationEmpresa: index('idx_vacation_empresa').on(table.empresaId),
  })
);

export type LaborContractRecord = typeof laborContracts.$inferSelect;
export type NewLaborContractRecord = typeof laborContracts.$inferInsert;

export type LaborContractAnnexRecord = typeof laborContractAnnexes.$inferSelect;
export type NewLaborContractAnnexRecord = typeof laborContractAnnexes.$inferInsert;

export type MedicalLeaveRecord = typeof medicalLeaves.$inferSelect;
export type NewMedicalLeaveRecord = typeof medicalLeaves.$inferInsert;

export type VacationRecord = typeof vacationRecords.$inferSelect;
export type NewVacationRecord = typeof vacationRecords.$inferInsert;
