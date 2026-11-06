import { 
  LaborContract, 
  MedicalLeave, 
  VacationRecord, 
  HrBenefit, 
  AbsenteeismRecord, 
  DisciplinarySanction,
  HrAgentAlert
} from '../types';

export const INITIAL_LABOR_CONTRACTS: LaborContract[] = [
  {
    id: 'ctr-01',
    employeeId: 'emp-1',
    rut: '14.892.301-2',
    nombreCompleto: 'Ignacio Andrés Valenzuela Castro',
    nacionalidad: 'Chilena',
    estadoCivil: 'Casado',
    fechaNacimiento: '1985-06-14',
    domicilio: 'Av. Cristobal Colón 4520, Depto 802',
    comuna: 'Las Condes',
    cargo: 'Líder Técnico de Arquitectura de Software',
    departamento: 'Ingeniería & Tecnología',
    tipoContrato: 'INDEFINIDO',
    fechaInicio: '2021-04-01',
    sueldoBase: 3800000,
    jornadaHorasSemanales: 40, // Adaptado anticipadamente a Ley 40 Horas (Ley 21.561)
    distribucionJornada: 'Lunes a Jueves de 08:30 a 18:00 hrs y Viernes de 08:30 a 14:30 hrs',
    lugarTrabajo: 'Modalidad Híbrida (Av. Providencia 1208, Of. 601 / Domicilio del Trabajador)',
    gratificacionModalidad: 'ART_50',
    asignacionColacion: 90000,
    asignacionMovilizacion: 80000,
    estado: 'VIGENTE',
    registradoDtRel: true,
    folioRegistroDt: 'REL-2021-88401-DT',
    clausulaConfidencialidad: true,
    clausulaTeletrabajo: true,
    observaciones: 'Pacto de teletrabajo Ley 21.220 con asignación de equipamiento y conectividad.',
    anexos: [
      {
        id: 'anx-01-1',
        contratoId: 'ctr-01',
        fecha: '2024-04-26',
        tipo: 'ADAPTACION_LEY_40_HORAS',
        descripcion: 'Reducción anticipada de jornada semanal ordinaria de 45 a 40 horas según Ley 21.561.',
        registradoDtRel: true,
        folioRegistroDt: 'ANX-2024-40H-0192',
      },
      {
        id: 'anx-01-2',
        contratoId: 'ctr-01',
        fecha: '2025-01-02',
        tipo: 'CAMBIO_SUELDO',
        descripcion: 'Reajuste salarial por evaluación de desempeño anual y liderazgo de equipo.',
        registradoDtRel: true,
        folioRegistroDt: 'ANX-2025-SUELDO-9812',
      }
    ],
  },
  {
    id: 'ctr-02',
    employeeId: 'emp-2',
    rut: '16.450.912-K',
    nombreCompleto: 'Francisca Paz Santander Henríquez',
    nacionalidad: 'Chilena',
    estadoCivil: 'Soltera',
    fechaNacimiento: '1990-11-20',
    domicilio: 'Av. Los Leones 1450, Depto 301',
    comuna: 'Providencia',
    cargo: 'Ingeniera de Datos y Machine Learning',
    departamento: 'Desarrollo & Analítica',
    tipoContrato: 'INDEFINIDO',
    fechaInicio: '2022-07-15',
    sueldoBase: 2400000,
    jornadaHorasSemanales: 44, // En régimen conforme a primer tramo Ley 21.561
    distribucionJornada: 'Lunes a Jueves de 08:30 a 18:30 hrs y Viernes de 08:30 a 16:30 hrs',
    lugarTrabajo: 'Oficina Central (Av. Providencia 1208, Of. 601)',
    gratificacionModalidad: 'ART_50',
    asignacionColacion: 85000,
    asignacionMovilizacion: 75000,
    estado: 'VIGENTE',
    registradoDtRel: true,
    folioRegistroDt: 'REL-2022-34902-DT',
    clausulaConfidencialidad: true,
    clausulaTeletrabajo: false,
    anexos: [
      {
        id: 'anx-02-1',
        contratoId: 'ctr-02',
        fecha: '2024-04-26',
        tipo: 'ADAPTACION_LEY_40_HORAS',
        descripcion: 'Adecuación de jornada ordinaria de 45 a 44 horas semanales según vigencia Ley 21.561.',
        registradoDtRel: true,
        folioRegistroDt: 'ANX-2024-44H-1029',
      }
    ],
  },
  {
    id: 'ctr-03',
    employeeId: 'emp-3',
    rut: '17.890.342-8',
    nombreCompleto: 'Sebastián Eduardo Morales Peña',
    nacionalidad: 'Chilena',
    estadoCivil: 'Casado',
    fechaNacimiento: '1992-03-08',
    domicilio: 'Calle San Martín 890',
    comuna: 'Santiago Centro',
    cargo: 'Consultor de Finanzas y Control de Gestión',
    departamento: 'Finanzas & Contabilidad',
    tipoContrato: 'INDEFINIDO',
    fechaInicio: '2023-01-10',
    sueldoBase: 1600000,
    jornadaHorasSemanales: 44,
    distribucionJornada: 'Lunes a Viernes de 09:00 a 18:00 hrs',
    lugarTrabajo: 'Oficina Central Providencia',
    gratificacionModalidad: 'ART_50',
    asignacionColacion: 80000,
    asignacionMovilizacion: 70000,
    estado: 'VIGENTE',
    registradoDtRel: true,
    folioRegistroDt: 'REL-2023-11094-DT',
    clausulaConfidencialidad: true,
    clausulaTeletrabajo: false,
    anexos: [],
  },
  {
    id: 'ctr-04',
    employeeId: 'emp-4',
    rut: '19.231.874-5',
    nombreCompleto: 'Valentina Belén Rojas Carvajal',
    nacionalidad: 'Chilena',
    estadoCivil: 'Soltera',
    fechaNacimiento: '1998-09-12',
    domicilio: 'Av. El Rosal 3200',
    comuna: 'Maipú',
    cargo: 'Asistente Contable y Operaciones',
    departamento: 'Finanzas & Contabilidad',
    tipoContrato: 'PLAZO_FIJO',
    fechaInicio: '2026-06-15',
    fechaTermino: '2026-09-15', // VENCE EN 11 DÍAS -> ALERTA AGENTE
    fechaVencimientoAlerta: '2026-09-01',
    sueldoBase: 850000,
    jornadaHorasSemanales: 44,
    distribucionJornada: 'Lunes a Viernes de 08:30 a 17:30 hrs',
    lugarTrabajo: 'Oficina Central Providencia',
    gratificacionModalidad: 'ART_50',
    asignacionColacion: 75000,
    asignacionMovilizacion: 65000,
    estado: 'POR_VENCER',
    registradoDtRel: true,
    folioRegistroDt: 'REL-2026-0615-DT',
    clausulaConfidencialidad: true,
    clausulaTeletrabajo: false,
    observaciones: 'Segundo período de plazo fijo. Según Art. 159 N° 4 del Código del Trabajo, si continúa prestando servicios con conocimiento del empleador, o se renueva por segunda vez, se transforma legalmente en INDEFINIDO.',
    anexos: [],
  },
];

export const INITIAL_MEDICAL_LEAVES: MedicalLeave[] = [
  {
    id: 'lme-01',
    folioLicencia: 'LME-789210-4',
    employeeId: 'emp-2',
    rut: '16.450.912-K',
    nombreCompleto: 'Francisca Paz Santander Henríquez',
    tipoLicencia: 'ENFERMEDAD_COMUN',
    entidadTramitadora: 'FONASA_COMPIN',
    fechaInicio: '2026-08-10',
    fechaTermino: '2026-08-16',
    diasReposo: 7,
    diasDescuentoRemuneracion: 7,
    diasSubsidioSIL: 4, // En licencias de menos de 11 días en patología común, los primeros 3 días no tienen subsidio SIL
    descuentoNominaEstimado: 560000,
    medicoNombre: 'Dra. Marcela Lagos Vivanco',
    medicoRut: '13.440.112-9',
    diagnosticoCie10: 'J06.9 - Infección respiratoria aguda no especificada',
    estado: 'APROBADA_COMPIN_ISAPRE',
    fechaTramitacionEmpleador: '2026-08-11',
    observaciones: 'Tramitada dentro de los 3 días hábiles legales ante el portal Empleador Medipass / I-Med.',
  },
  {
    id: 'lme-02',
    folioLicencia: 'LME-991204-1',
    employeeId: 'emp-1',
    rut: '14.892.301-2',
    nombreCompleto: 'Ignacio Andrés Valenzuela Castro',
    tipoLicencia: 'ACCIDENTE_DE_TRAYECTO',
    entidadTramitadora: 'MUTUAL_DE_SEGURIDAD',
    fechaInicio: '2026-09-01',
    fechaTermino: '2026-09-04',
    diasReposo: 4,
    diasDescuentoRemuneracion: 4,
    diasSubsidioSIL: 4, // Ley 16.744 cubre desde el día 1 con 100% de subsidio a través de la Mutualidad
    descuentoNominaEstimado: 506666,
    medicoNombre: 'Dr. Fernando Correa Benítez',
    medicoRut: '11.890.224-1',
    diagnosticoCie10: 'S93.4 - Esguince del tobillo en trayecto directo',
    estado: 'TRAMITADA_EMPLEADOR',
    fechaTramitacionEmpleador: '2026-09-02',
    observaciones: 'Declaración DIAT (Declaración Individual de Accidente del Trabajo) ingresada oportunamente ante la Mutual de Seguridad CChC.',
  }
];

export const INITIAL_VACATION_RECORDS: VacationRecord[] = [
  {
    id: 'vac-01',
    employeeId: 'emp-1',
    rut: '14.892.301-2',
    nombreCompleto: 'Ignacio Andrés Valenzuela Castro',
    fechaIngreso: '2021-04-01',
    antiguedadAnos: 5,
    diasLegalesPorAno: 15,
    diasProgresivos: 0, // Requiere 10 años cotizados y 3 con actual empleador
    diasAcumuladosTotales: 65,
    diasTomadosHistorico: 28,
    diasDisponibles: 37,
    periodosPendientes: 2.4, // ALERTA CRÍTICA: ACUMULA MÁS DE 2 PERÍODOS (ART. 70 CÓDIGO DEL TRABAJO)
    alertaExcesoPeriodosArt70: true,
    solicitudes: [
      {
        id: 'req-vac-01',
        fechaSolicitud: '2026-01-15',
        fechaInicio: '2026-02-02',
        fechaRetorno: '2026-02-23',
        diasHabilesTomados: 15,
        estado: 'TOMADA',
        comprobanteFirmado: true,
        comentario: 'Feriado legal período estival año 2026.',
      },
      {
        id: 'req-vac-02',
        fechaSolicitud: '2026-08-20',
        fechaInicio: '2026-09-21',
        fechaRetorno: '2026-09-28',
        diasHabilesTomados: 5,
        estado: 'AUTORIZADA_RRHH',
        comprobanteFirmado: true,
        comentario: 'Semana de descanso posterior a Fiestas Patrias para rebajar saldo acumulado Art. 70.',
      }
    ],
  },
  {
    id: 'vac-02',
    employeeId: 'emp-2',
    rut: '16.450.912-K',
    nombreCompleto: 'Francisca Paz Santander Henríquez',
    fechaIngreso: '2022-07-15',
    antiguedadAnos: 4,
    diasLegalesPorAno: 15,
    diasProgresivos: 0,
    diasAcumuladosTotales: 60,
    diasTomadosHistorico: 35,
    diasDisponibles: 25,
    periodosPendientes: 1.6,
    alertaExcesoPeriodosArt70: false,
    solicitudes: [
      {
        id: 'req-vac-03',
        fechaSolicitud: '2026-06-10',
        fechaInicio: '2026-07-13',
        fechaRetorno: '2026-07-24',
        diasHabilesTomados: 10,
        estado: 'TOMADA',
        comprobanteFirmado: true,
        comentario: 'Vacaciones de invierno con familia.',
      }
    ],
  },
  {
    id: 'vac-03',
    employeeId: 'emp-3',
    rut: '17.890.342-8',
    nombreCompleto: 'Sebastián Eduardo Morales Peña',
    fechaIngreso: '2023-01-10',
    antiguedadAnos: 3,
    diasLegalesPorAno: 15,
    diasProgresivos: 0,
    diasAcumuladosTotales: 45,
    diasTomadosHistorico: 30,
    diasDisponibles: 15,
    periodosPendientes: 1.0,
    alertaExcesoPeriodosArt70: false,
    solicitudes: [],
  },
  {
    id: 'vac-04',
    employeeId: 'emp-4',
    rut: '19.231.874-5',
    nombreCompleto: 'Valentina Belén Rojas Carvajal',
    fechaIngreso: '2024-03-01',
    antiguedadAnos: 2,
    diasLegalesPorAno: 15,
    diasProgresivos: 0,
    diasAcumuladosTotales: 30,
    diasTomadosHistorico: 18,
    diasDisponibles: 12,
    periodosPendientes: 0.8,
    alertaExcesoPeriodosArt70: false,
    solicitudes: [
      {
        id: 'req-vac-04',
        fechaSolicitud: '2026-08-28',
        fechaInicio: '2026-10-05',
        fechaRetorno: '2026-10-13',
        diasHabilesTomados: 5,
        estado: 'APROBADA_JEFE',
        comprobanteFirmado: false,
        comentario: 'Pendiente de confirmación según renovación o término de contrato a plazo fijo.',
      }
    ],
  },
];

export const INITIAL_HR_BENEFITS: HrBenefit[] = [
  {
    id: 'ben-01',
    nombre: 'Asignaciones No Imponibles (Colación & Movilización)',
    categoria: 'ASIGNACION_NO_IMPONIBLE',
    descripcion: 'Reembolso de gastos razonables en alimentación y traslados diarios en días efectivamente laborados.',
    normaLegalChilena: 'Art. 41 inciso 2° del Código del Trabajo (Exento de cotizaciones e Impuesto Único si el monto es razonable)',
    montoAporteEmpresaPorTrabajador: 160000,
    esImponible: false,
    beneficiariosActivos: 4,
    frecuencia: 'MENSUAL',
    activo: true,
  },
  {
    id: 'ben-02',
    nombre: 'Seguro Colectivo de Salud, Vida y Catastrófico',
    categoria: 'SALUD_BIENESTAR',
    descripcion: 'Póliza colectiva para trabajadores y sus cargas legales con cobertura del 80% ambulatoria y hospitalaria.',
    normaLegalChilena: 'Beneficio convencional de bienestar laboral con deducción tributaria como gasto necesario para producir la renta (Art. 31 N° 6 LIR)',
    montoAporteEmpresaPorTrabajador: 48000,
    esImponible: false,
    beneficiariosActivos: 4,
    proveedorConvenio: 'BICE Vida Compañía de Seguros S.A.',
    frecuencia: 'MENSUAL',
    activo: true,
  },
  {
    id: 'ben-03',
    nombre: 'Afiliación y Convenios Caja de Compensación de Asignación Familiar',
    categoria: 'CAJA_COMPENSACION',
    descripcion: 'Acceso a créditos sociales, asignación familiar, convenios en farmacias, centros turísticos y subsidios de cesantía.',
    normaLegalChilena: 'Ley N° 18.833 sobre Cajas de Compensación de Asignación Familiar (CCAF)',
    montoAporteEmpresaPorTrabajador: 0, // Financiado con el 0.6% de Fonasa y aportes estatutarios
    esImponible: false,
    beneficiariosActivos: 4,
    proveedorConvenio: 'Caja Los Andes (CCAF)',
    frecuencia: 'MENSUAL',
    activo: true,
  },
  {
    id: 'ben-04',
    nombre: 'Beneficio Legal de Sala Cuna & Sala Cuna Compensatoria',
    categoria: 'SALA_CUNA_ART203',
    descripcion: 'Pago directo a sala cuna autorizada por la JUNJI o pago de bono compensatorio debidamente autorizado por dictamen DT si no hay sala cuna en la comuna.',
    normaLegalChilena: 'Art. 203 del Código del Trabajo (Obligatorio para empleadores que ocupan 20 o más trabajadoras de cualquier edad o estado civil)',
    montoAporteEmpresaPorTrabajador: 380000,
    esImponible: false,
    beneficiariosActivos: 1,
    proveedorConvenio: 'Red de Salas Cuna Vitamina',
    frecuencia: 'MENSUAL',
    activo: true,
  },
  {
    id: 'ben-05',
    nombre: 'Aguinaldo de Fiestas Patrias Septiembre 2026',
    categoria: 'AGUINALDO_FESTIVIDAD',
    descripcion: 'Bono extraordinario de conmemoración patria a cancelar junto a la nómina de la primera quincena de septiembre.',
    normaLegalChilena: 'Cláusula contractual y política de incentivos laborales (Imponible para efectos previsionales y tributarios)',
    montoAporteEmpresaPorTrabajador: 180000,
    esImponible: true,
    beneficiariosActivos: 4,
    frecuencia: 'ANUAL_FIESTAS_PATRIAS',
    activo: true,
  },
  {
    id: 'ben-06',
    nombre: 'Asignación de Teletrabajo, Ergonomía & Conectividad',
    categoria: 'TELETRABAJO_CONECTIVIDAD',
    descripcion: 'Compensación por costos de internet y energía para colaboradores bajo régimen de trabajo a distancia.',
    normaLegalChilena: 'Art. 152 quáter L del Código del Trabajo (Ley N° 21.220 de Trabajo a Distancia y Teletrabajo)',
    montoAporteEmpresaPorTrabajador: 35000,
    esImponible: false,
    beneficiariosActivos: 1,
    frecuencia: 'MENSUAL',
    activo: true,
  }
];

export const INITIAL_ABSENTEEISM: AbsenteeismRecord[] = [
  {
    id: 'abs-01',
    employeeId: 'emp-3',
    rut: '17.890.342-8',
    nombreCompleto: 'Sebastián Eduardo Morales Peña',
    fecha: '2026-08-24', // Lunes
    tipo: 'INASISTENCIA_INJUSTIFICADA',
    duracionTexto: '1 día completo (Jornada ordinaria 8.8 hrs)',
    diasInasistencia: 1,
    justificativoPresentado: 'Ninguno. No contestó teléfono de jefatura directa.',
    impactoDescuentoPesos: 53333,
    alertaCausalArt160N3: true, // ALERTA: Si falta un segundo lunes en el mismo mes o un día más consecutivo, se configura causal de despido sin indemnización según Art. 160 N° 3
    estado: 'AMONESTACION_GENERADA',
    observaciones: 'Se emitió carta de amonestación escrita con fecha 25 de agosto de 2026 conforme al RIOHS.',
  },
  {
    id: 'abs-02',
    employeeId: 'emp-4',
    rut: '19.231.874-5',
    nombreCompleto: 'Valentina Belén Rojas Carvajal',
    fecha: '2026-08-28',
    tipo: 'ATRASO_REITERADO',
    duracionTexto: '52 minutos',
    minutosAtraso: 52,
    justificativoPresentado: 'Falla técnica en Línea 1 del Metro de Santiago.',
    impactoDescuentoPesos: 7500,
    alertaCausalArt160N3: false,
    estado: 'JUSTIFICADO',
    observaciones: 'Presentó comprobante oficial de interrupción de servicio emitido por Metro S.A.',
  },
  {
    id: 'abs-03',
    employeeId: 'emp-1',
    rut: '14.892.301-2',
    nombreCompleto: 'Ignacio Andrés Valenzuela Castro',
    fecha: '2026-05-18',
    tipo: 'PERMISO_PATERNIDAD_ART195',
    duracionTexto: '5 días hábiles remunerados',
    diasInasistencia: 5,
    justificativoPresentado: 'Certificado de Nacimiento emitido por el Registro Civil e Identificación.',
    impactoDescuentoPesos: 0, // Permiso pagado 100% legal
    alertaCausalArt160N3: false,
    estado: 'JUSTIFICADO',
    observaciones: 'Permiso legal pagado de paternidad conforme al Art. 195 del Código del Trabajo.',
  }
];

export const INITIAL_DISCIPLINARY_SANCTIONS: DisciplinarySanction[] = [
  {
    id: 'sanct-01',
    employeeId: 'emp-3',
    rut: '17.890.342-8',
    nombreCompleto: 'Sebastián Eduardo Morales Peña',
    fechaInfraccion: '2026-08-24',
    fechaEmision: '2026-08-25',
    tipo: 'AMONESTACION_ESCRITA_CON_COPIA_DT',
    motivoInfraccion: 'Inasistencia injustificada a sus labores ordinarias en día lunes 24 de agosto de 2026, sin dar aviso oportuno a su jefatura dentro de las primeras horas de la jornada.',
    articuloRiohs: 'Art. 19 y Art. 48 del Reglamento Interno de Orden, Higiene y Seguridad (RIOHS) y Art. 160 N° 3 del Código del Trabajo',
    notificadoAlTrabajador: true,
    fechaNotificacion: '2026-08-26',
    remitidoInspeccionDelTrabajo: true,
    folioConstanciaDt: 'CONST-DT-2026-89104',
    estado: 'REGISTRADO_DT',
    textoCartaFormal: `CARTA FORMAL DE AMONESTACIÓN LABORAL
Santiago, 25 de Agosto de 2026

Señor: Sebastián Eduardo Morales Peña
R.U.T.: 17.890.342-8
Cargo: Consultor de Finanzas y Control de Gestión

Por medio de la presente, la Administración de la Empresa procede a amonestarle por escrito debido a su inasistencia injustificada a su lugar de trabajo con fecha 24 de agosto de 2026, sin haber justificado ni avisado previamente su ausencia.

Dicha conducta constituye una infracción a las obligaciones estipuladas en su Contrato Individual de Trabajo y en el Reglamento Interno de Orden, Higiene y Seguridad de la Empresa.

Se le advierte que la reiteración de este comportamiento en los términos del Artículo 160 N° 3 del Código del Trabajo facultará al Empleador a poner término inmediato a su relación laboral sin derecho a indemnización legal alguna.

Se remite copia de la presente a la Inspección Comunal del Trabajo para los fines pertinentes.`,
  },
  {
    id: 'sanct-02',
    employeeId: 'emp-2',
    rut: '16.450.912-K',
    nombreCompleto: 'Francisca Paz Santander Henríquez',
    fechaInfraccion: '2026-07-02',
    fechaEmision: '2026-07-03',
    tipo: 'AMONESTACION_VERBAL',
    motivoInfraccion: 'Atraso reiterado de más de 30 minutos sin justificación al ingreso a la oficina central durante dos días consecutivos.',
    articuloRiohs: 'Art. 14 del Reglamento Interno de Orden, Higiene y Seguridad sobre control de asistencia digital.',
    notificadoAlTrabajador: true,
    fechaNotificacion: '2026-07-03',
    remitidoInspeccionDelTrabajo: false,
    estado: 'NOTIFICADO',
    textoCartaFormal: 'Constancia interna de amonestación verbal efectuada por la Jefatura de Desarrollo por reiteración de atrasos matutinos.',
  }
];

export const INITIAL_HR_ALERTS: HrAgentAlert[] = [
  {
    id: 'alt-01',
    tipo: 'CONTRATO_PLAZO_FIJO_POR_VENCER',
    nivel: 'CRITICO',
    titulo: 'Vencimiento de Contrato a Plazo Fijo: Valentina Rojas (15/Sep/2026)',
    descripcion: 'El contrato a plazo fijo de Valentina Belén Rojas Carvajal vence el próximo 15 de septiembre de 2026 (quedan 11 días). Al tratarse de su segunda renovación, si continúa trabajando con conocimiento de la empresa pasará automáticamente a Contrato Indefinido según el Art. 159 N° 4 del Código del Trabajo.',
    normaLegal: 'Art. 159 N° 4 del Código del Trabajo (Transformación legal automática a plazo indefinido)',
    accionRecomendada: 'Definir antes del 10 de septiembre si se redacta Anexo de Paso a Indefinido o Carta de Notificación de Término de Contrato con copia a la DT.',
    empleadoAfectado: 'Valentina Belén Rojas Carvajal (19.231.874-5)',
    fechaVencimiento: '2026-09-15',
  },
  {
    id: 'alt-02',
    tipo: 'VACACIONES_VENCIDAS_ART70',
    nivel: 'ALTO',
    titulo: 'Infracción Art. 70 Código del Trabajo: Exceso de Vacaciones Ignacio Valenzuela',
    descripcion: 'Ignacio Andrés Valenzuela Castro mantiene un saldo acumulado de 37 días hábiles disponibles de feriado legal, lo que equivale a 2.4 períodos continuos pendientes. El Código del Trabajo prohíbe taxativamente la acumulación de más de 2 períodos.',
    normaLegal: 'Art. 70 del Código del Trabajo (El feriado no podrá acumularse más que por dos períodos consecutivos). Infracción gravísima sancionable por la DT con multas de hasta 60 UTM.',
    accionRecomendada: 'Coordinar formalmente con el trabajador un calendario obligatorio de descanso para hacer uso efectivo de a lo menos el período más antiguo (15 días hábiles).',
    empleadoAfectado: 'Ignacio Andrés Valenzuela Castro (14.892.301-2)',
  },
  {
    id: 'alt-03',
    tipo: 'LIBRO_REMUNERACIONES_DT_VENCIMIENTO',
    nivel: 'ALTO',
    titulo: 'Envío Obligatorio de Libro de Remuneraciones Electrónico (LRE) ante la DT',
    descripcion: 'El plazo legal para declarar y cargar el archivo CSV oficial del Libro de Remuneraciones Electrónico correspondiente al período vence indefectiblemente el día 15 de cada mes en el portal Mi DT (tramites.dirtrab.cl).',
    normaLegal: 'Ley N° 21.327 sobre Modernización de la Dirección del Trabajo y Resolución Exenta N° 873 DT',
    accionRecomendada: 'Generar el archivo CSV normalizado desde el módulo de Libros Legales DT y realizar la transmisión telemática.',
    fechaVencimiento: '2026-09-15',
  },
  {
    id: 'alt-04',
    tipo: 'AUSENTISMO_CAUSAL_ART160',
    nivel: 'MEDIO',
    titulo: 'Riesgo Laboral por Inasistencia en Día Lunes: Sebastián Morales',
    descripcion: 'Sebastián Eduardo Morales Peña registró una inasistencia injustificada el lunes 24 de agosto. El Art. 160 N° 3 estipula causal de despido sin derecho a indemnización por falta injustificada durante dos lunes en el mes.',
    normaLegal: 'Art. 160 N° 3 del Código del Trabajo (No concurrencia a las labores sin causa justificada durante dos días seguidos, dos lunes en el mes o un total de tres días en el mes)',
    accionRecomendada: 'Mantener seguimiento estricto del registro de asistencia digital durante el resto de septiembre.',
    empleadoAfectado: 'Sebastián Eduardo Morales Peña (17.890.342-8)',
  },
  {
    id: 'alt-05',
    tipo: 'LEY_40_HORAS_IMPLEMENTACION',
    nivel: 'INFORMATIVO',
    titulo: 'Vigilancia de Cumplimiento Gradual Ley 21.561 (40 Horas)',
    descripcion: 'Verificación de contratos y registros de asistencia con la jornada ordinaria legal máxima de 44 horas semanales y calendario de adecuación gradual a 42 horas en 2026 y 40 horas en 2028. Ignacio Valenzuela ya cuenta con pacto a 40 horas.',
    normaLegal: 'Ley N° 21.561 de reducción de jornada laboral a 40 horas semanales',
    accionRecomendada: 'Revisar que ningún colaborador supere las 44 horas semanales ordinarias pactadas en sus anexos de contrato.',
  },
  {
    id: 'alt-06',
    tipo: 'LEY_KARIN_PREVENCION',
    nivel: 'INFORMATIVO',
    titulo: 'Protocolo de Prevención de Acoso Laboral y Violencia (Ley Karin 21.643)',
    descripcion: 'Vigencia de la Ley Karin para todas las empresas en Chile. Exige disponer de canal seguro y anónimo de denuncias, investigación expedita de denuncias y actualización del RIOHS.',
    normaLegal: 'Ley N° 21.643 (Ley Karin) y Dictamen N° 362/19 de la Dirección del Trabajo',
    accionRecomendada: 'Verificar la entrega a todos los colaboradores del anexo RIOHS con el protocolo de prevención de acoso y no discriminación.',
  }
];

// ============================================================================
// CONJUNTOS DE DATOS RRHH PARA RETAIL LOGISTICS / AGROINDUSTRIAL (CLIENT-RETAIL)
// ============================================================================

export const RETAIL_LABOR_CONTRACTS: LaborContract[] = [
  {
    id: 'ctr-ret-01',
    employeeId: 'emp-retail-1',
    rut: '18.456.789-2',
    nombreCompleto: 'Gonzalo Tapia Morales',
    nacionalidad: 'Chilena',
    estadoCivil: 'Casado',
    fechaNacimiento: '1988-04-12',
    domicilio: 'Av. Las Acacias 450',
    comuna: 'San Bernardo',
    cargo: 'Jefe de Finanzas y Control de Gestión',
    departamento: 'Administración & Finanzas',
    tipoContrato: 'INDEFINIDO',
    fechaInicio: '2024-03-01',
    sueldoBase: 1850000,
    jornadaHorasSemanales: 40,
    distribucionJornada: 'Lunes a Viernes de 08:30 a 17:30 hrs',
    lugarTrabajo: 'Oficina Central San Bernardo',
    gratificacionModalidad: 'ART_50',
    asignacionColacion: 85000,
    asignacionMovilizacion: 65000,
    estado: 'VIGENTE',
    registradoDtRel: true,
    folioRegistroDt: 'REL-2024-098234-DT',
    clausulaConfidencialidad: true,
    clausulaTeletrabajo: false,
    observaciones: 'Jornada adaptada a 40 horas ordinarias con registro de asistencia electrónico.',
    anexos: [],
  },
  {
    id: 'ctr-ret-02',
    employeeId: 'emp-retail-2',
    rut: '15.340.891-3',
    nombreCompleto: 'Rosa Cárdenas Silva',
    nacionalidad: 'Chilena',
    estadoCivil: 'Soltera',
    fechaNacimiento: '1982-10-05',
    domicilio: 'Camino Lo Echevers 550',
    comuna: 'Quilicura',
    cargo: 'Supervisora de Logística y Bodega',
    departamento: 'Operaciones & Logística',
    tipoContrato: 'INDEFINIDO',
    fechaInicio: '2023-08-15',
    sueldoBase: 1250000,
    jornadaHorasSemanales: 42,
    distribucionJornada: 'Lunes a Viernes de 08:00 a 17:00 hrs',
    lugarTrabajo: 'Centro de Distribución Lo Echevers Galpón 4',
    gratificacionModalidad: 'ART_50',
    asignacionColacion: 80000,
    asignacionMovilizacion: 60000,
    estado: 'VIGENTE',
    registradoDtRel: true,
    folioRegistroDt: 'REL-2023-77123-DT',
    clausulaConfidencialidad: true,
    clausulaTeletrabajo: false,
    anexos: [],
  },
  {
    id: 'ctr-ret-03',
    employeeId: 'emp-retail-3',
    rut: '17.345.678-9',
    nombreCompleto: 'Esteban Morales Peña',
    nacionalidad: 'Chilena',
    estadoCivil: 'Casado',
    fechaNacimiento: '1991-07-22',
    domicilio: 'Pasaje El Roble 1290',
    comuna: 'Renca',
    cargo: 'Encargado de Despacho y Sucursales',
    departamento: 'Logística',
    tipoContrato: 'INDEFINIDO',
    fechaInicio: '2024-01-10',
    sueldoBase: 950000,
    jornadaHorasSemanales: 42,
    distribucionJornada: 'Lunes a Viernes de 08:30 a 17:30 hrs',
    lugarTrabajo: 'CD Lo Echevers & Ruta Sucursales',
    gratificacionModalidad: 'ART_50',
    asignacionColacion: 75000,
    asignacionMovilizacion: 55000,
    estado: 'VIGENTE',
    registradoDtRel: true,
    folioRegistroDt: 'REL-2024-33102-DT',
    clausulaConfidencialidad: true,
    clausulaTeletrabajo: false,
    anexos: [],
  },
  {
    id: 'ctr-ret-04',
    employeeId: 'emp-retail-4',
    rut: '19.876.543-2',
    nombreCompleto: 'Claudia Henríquez Soto',
    nacionalidad: 'Chilena',
    estadoCivil: 'Soltera',
    fechaNacimiento: '1999-02-14',
    domicilio: 'Av. Américo Vespucio Norte 2200',
    comuna: 'Pudahuel',
    cargo: 'Asistente de Operaciones Retail',
    departamento: 'Operaciones',
    tipoContrato: 'PLAZO_FIJO',
    fechaInicio: '2024-06-01',
    fechaTermino: '2026-11-30',
    sueldoBase: 650000,
    jornadaHorasSemanales: 44,
    distribucionJornada: 'Lunes a Viernes de 09:00 a 18:00 hrs',
    lugarTrabajo: 'Oficinas Despacho Pudahuel',
    gratificacionModalidad: 'ART_50',
    asignacionColacion: 70000,
    asignacionMovilizacion: 50000,
    estado: 'VIGENTE',
    registradoDtRel: true,
    folioRegistroDt: 'REL-2024-88914-DT',
    clausulaConfidencialidad: true,
    clausulaTeletrabajo: false,
    anexos: [],
  },
];

export const RETAIL_VACATION_RECORDS: VacationRecord[] = [
  {
    id: 'vac-ret-01',
    employeeId: 'emp-retail-1',
    rut: '18.456.789-2',
    nombreCompleto: 'Gonzalo Tapia Morales',
    fechaIngreso: '2024-03-01',
    antiguedadAnos: 2,
    diasLegalesPorAno: 15,
    diasProgresivos: 0,
    diasAcumuladosTotales: 30,
    diasTomadosHistorico: 10,
    diasDisponibles: 20,
    periodosPendientes: 1.3,
    alertaExcesoPeriodosArt70: false,
    solicitudes: [],
  },
  {
    id: 'vac-ret-02',
    employeeId: 'emp-retail-2',
    rut: '15.340.891-3',
    nombreCompleto: 'Rosa Cárdenas Silva',
    fechaIngreso: '2023-08-15',
    antiguedadAnos: 3,
    diasLegalesPorAno: 15,
    diasProgresivos: 0,
    diasAcumuladosTotales: 45,
    diasTomadosHistorico: 20,
    diasDisponibles: 25,
    periodosPendientes: 1.6,
    alertaExcesoPeriodosArt70: false,
    solicitudes: [],
  },
  {
    id: 'vac-ret-03',
    employeeId: 'emp-retail-3',
    rut: '17.345.678-9',
    nombreCompleto: 'Esteban Morales Peña',
    fechaIngreso: '2024-01-10',
    antiguedadAnos: 2,
    diasLegalesPorAno: 15,
    diasProgresivos: 0,
    diasAcumuladosTotales: 30,
    diasTomadosHistorico: 15,
    diasDisponibles: 15,
    periodosPendientes: 1.0,
    alertaExcesoPeriodosArt70: false,
    solicitudes: [],
  },
  {
    id: 'vac-ret-04',
    employeeId: 'emp-retail-4',
    rut: '19.876.543-2',
    nombreCompleto: 'Claudia Henríquez Soto',
    fechaIngreso: '2024-06-01',
    antiguedadAnos: 2,
    diasLegalesPorAno: 15,
    diasProgresivos: 0,
    diasAcumuladosTotales: 25,
    diasTomadosHistorico: 10,
    diasDisponibles: 15,
    periodosPendientes: 1.0,
    alertaExcesoPeriodosArt70: false,
    solicitudes: [],
  },
];

export const RETAIL_MEDICAL_LEAVES: MedicalLeave[] = [
  {
    id: 'lme-ret-01',
    folioLicencia: 'LME-661204-7',
    employeeId: 'emp-retail-2',
    rut: '15.340.891-3',
    nombreCompleto: 'Rosa Cárdenas Silva',
    tipoLicencia: 'ENFERMEDAD_COMUN',
    entidadTramitadora: 'FONASA_COMPIN',
    fechaInicio: '2026-07-06',
    fechaTermino: '2026-07-12',
    diasReposo: 7,
    diasDescuentoRemuneracion: 7,
    diasSubsidioSIL: 4,
    descuentoNominaEstimado: 291666,
    medicoNombre: 'Dr. Patricio Alarcón Soto',
    medicoRut: '12.334.890-1',
    diagnosticoCie10: 'M54.5 - Lumbago no especificado',
    estado: 'APROBADA_COMPIN_ISAPRE',
    fechaTramitacionEmpleador: '2026-07-07',
    observaciones: 'Tramitada oportunamente a través de portal Medipass.',
  }
];

export const RETAIL_ABSENTEEISM: AbsenteeismRecord[] = [
  {
    id: 'abs-ret-01',
    employeeId: 'emp-retail-3',
    rut: '17.345.678-9',
    nombreCompleto: 'Esteban Morales Peña',
    fecha: '2026-08-17',
    tipo: 'ATRASO_REITERADO',
    duracionTexto: '35 minutos',
    minutosAtraso: 35,
    justificativoPresentado: 'Congestión vehicular extrema en autopista Costanera Norte.',
    impactoDescuentoPesos: 4800,
    alertaCausalArt160N3: false,
    estado: 'JUSTIFICADO',
    observaciones: 'Aviso previo telefónico a jefatura de despacho.',
  }
];

export const RETAIL_DISCIPLINARY_SANCTIONS: DisciplinarySanction[] = [
  {
    id: 'sanct-ret-01',
    employeeId: 'emp-retail-3',
    rut: '17.345.678-9',
    nombreCompleto: 'Esteban Morales Peña',
    fechaInfraccion: '2026-07-28',
    fechaEmision: '2026-07-29',
    tipo: 'AMONESTACION_VERBAL',
    motivoInfraccion: 'No utilización de elementos de protección personal (zapatos de seguridad con punta de acero en área de carga de pallets).',
    articuloRiohs: 'Art. 32 Reglamento Interno de Orden, Higiene y Seguridad (Seguridad Operacional en Bodega)',
    estado: 'FIRMADA_TRABAJADOR',
    compromisoMejora: 'Uso permanente e inexcusable de EPP en zonas de maniobra.',
    observaciones: 'Constancia interna en carpeta personal con copia al Comité Paritario de Higiene y Seguridad.',
  }
];

// Selectores con integridad referencial garantizada por empresa
export function getInitialContractsForClient(clientId?: string): LaborContract[] {
  if (!clientId) return INITIAL_LABOR_CONTRACTS;
  const clean = clientId.toLowerCase();
  if (clean.includes('retail') || clean.includes('agro') || clean.includes('76.104.550-9') || clean.includes('77.210.980-5')) {
    return RETAIL_LABOR_CONTRACTS;
  }
  return INITIAL_LABOR_CONTRACTS;
}

export function getInitialVacationsForClient(clientId?: string): VacationRecord[] {
  if (!clientId) return INITIAL_VACATION_RECORDS;
  const clean = clientId.toLowerCase();
  if (clean.includes('retail') || clean.includes('agro') || clean.includes('76.104.550-9') || clean.includes('77.210.980-5')) {
    return RETAIL_VACATION_RECORDS;
  }
  return INITIAL_VACATION_RECORDS;
}

export function getInitialMedicalLeavesForClient(clientId?: string): MedicalLeave[] {
  if (!clientId) return INITIAL_MEDICAL_LEAVES;
  const clean = clientId.toLowerCase();
  if (clean.includes('retail') || clean.includes('agro') || clean.includes('76.104.550-9') || clean.includes('77.210.980-5')) {
    return RETAIL_MEDICAL_LEAVES;
  }
  return INITIAL_MEDICAL_LEAVES;
}

export function getInitialSanctionsForClient(clientId?: string): DisciplinarySanction[] {
  if (!clientId) return INITIAL_DISCIPLINARY_SANCTIONS;
  const clean = clientId.toLowerCase();
  if (clean.includes('retail') || clean.includes('agro') || clean.includes('76.104.550-9') || clean.includes('77.210.980-5')) {
    return RETAIL_DISCIPLINARY_SANCTIONS;
  }
  return INITIAL_DISCIPLINARY_SANCTIONS;
}

export function getInitialAbsenteeismForClient(clientId?: string): AbsenteeismRecord[] {
  if (!clientId) return INITIAL_ABSENTEEISM;
  const clean = clientId.toLowerCase();
  if (clean.includes('retail') || clean.includes('agro') || clean.includes('76.104.550-9') || clean.includes('77.210.980-5')) {
    return RETAIL_ABSENTEEISM;
  }
  return INITIAL_ABSENTEEISM;
}

