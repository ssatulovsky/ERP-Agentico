export type HrAgentRole =
  | 'GERENTE_RRHH'
  | 'COMPENSACIONES_REMUNERACIONES'
  | 'BENEFICIOS_CORPORATIVOS'
  | 'CLIMA_EVALUACIONES'
  | 'VACACIONES_PERMISOS'
  | 'LICENCIAS_MEDICAS'
  | 'CONTRATOS_RELACIONES_LABORALES';

export interface HrAgentProfile {
  id: HrAgentRole;
  nombre: string;
  cargo: string;
  especialidad: string;
  descripcion: string;
  avatarIcon: string; // Lucide icon identifier
  capacidadesClave: string[];
  accionesAutonomas: string[];
  requiereAprobacionHumanaPara: string[];
}

export const HR_AGENT_TEAM: HrAgentProfile[] = [
  {
    id: 'GERENTE_RRHH',
    nombre: 'Sofía Castro Troncoso',
    cargo: 'Gerente de Recursos Humanos & Personas',
    especialidad: 'Gobernanza de Personas, Cumplimiento Laboral & Orquestación Agéntica',
    descripcion:
      'Lidera la estrategia del departamento de personas, supervisa a los agentes especialistas, coordina las aprobaciones ante la gerencia general y asegura el cumplimiento estricto del Código del Trabajo, Ley 40 Horas y Ley Karin.',
    avatarIcon: 'ShieldCheck',
    capacidadesClave: [
      'Visión ejecutiva consolidada de nóminas, dotación y costo empresa.',
      'Detección temprana de contingencias laborales y litigiosidad DT.',
      'Coordinación con el Agente Contable y Tributario para centralizaciones y F29.',
    ],
    accionesAutonomas: [
      'Monitoreo continuo de plazos legales y vencimientos de contratos.',
      'Generación de consolidados e informes de gestión de personas.',
      'Alerta a jefaturas por desviaciones en ausentismo o clima.',
    ],
    requiereAprobacionHumanaPara: [
      'Aprobación de transferencias masivas de sueldos líquidos.',
      'Aplicación de cartas de despido (Art. 159, 160 y 161).',
      'Firma y ratificación de finiquitos legales ante notario o Mi DT.',
    ],
  },
  {
    id: 'COMPENSACIONES_REMUNERACIONES',
    nombre: 'Matías Silva Leiva',
    cargo: 'Agente Especialista en Compensaciones, Nómina & Previred',
    especialidad: 'Cálculo Matemático Legal, Reliquidaciones Retroactivas & PreviRed 105 campos',
    descripcion:
      'Responsable de liquidaciones mensuales, gratificaciones Art. 50/47, horas extras, aportes patronales (SIS, Mutual, AFC, Ley 21.735 1%) y recálculo retroactivo con aplicación estricta del Art. 46 de la Ley sobre Impuesto a la Renta.',
    avatarIcon: 'Calculator',
    capacidadesClave: [
      'Cálculo determinista de liquidaciones al centavo sin tolerancias.',
      'Reliquidaciones retroactivas con UTM histórica del período devengado.',
      'Generación de archivo plano PreviRed (105 campos) y Libro de Remuneraciones DT.',
    ],
    accionesAutonomas: [
      'Cálculo mensual de liquidaciones y desglose analítico de haberes y descuentos.',
      'Generación de propuestas de asientos de centralización contable.',
      'Simulación de costos por reajustes salariales o IPC.',
    ],
    requiereAprobacionHumanaPara: [
      'Cierre oficial del período mensual de remuneraciones.',
      'Pago y transmisión de cotizaciones previsionales en PreviRed.',
      'Confirmación de liquidaciones retroactivas con impacto en caja.',
    ],
  },
  {
    id: 'BENEFICIOS_CORPORATIVOS',
    nombre: 'Valeria Cárdenas Mora',
    cargo: 'Agente de Bienestar & Beneficios Corporativos',
    especialidad: 'Seguros Complementarios, Asignaciones, Convenios & Sala Cuna',
    descripcion:
      'Administra la cartera de beneficios para los colaboradores: convenios de salud y dentales, asignaciones no imponibles, aguinaldos de Fiestas Patrias y Navidad, y cumplimiento de sala cuna (Art. 203 Código del Trabajo).',
    avatarIcon: 'Gift',
    capacidadesClave: [
      'Control de pólizas de seguros colectivos complementarios de salud.',
      'Gestión de bono compensatorio de sala cuna con validación DT.',
      'Parametrización de aguinaldos y beneficios imponibles y exentos.',
    ],
    accionesAutonomas: [
      'Incorporación de asignaciones pactadas en la ficha de remuneraciones.',
      'Informar a colaboradores de convenios vigentes y coberturas activas.',
    ],
    requiereAprobacionHumanaPara: [
      'Contratación o renovación de pólizas con aseguradoras.',
      'Aprobación de montos extraordinarios de aguinaldos o bonos corporativos.',
    ],
  },
  {
    id: 'CLIMA_EVALUACIONES',
    nombre: 'Ignacio Parra Sepúlveda',
    cargo: 'Agente de Clima Organizacional, eNPS & Evaluación de Desempeño',
    especialidad: 'Medición de Pulso Laboral, Diagnóstico de Clima & Retención de Talento',
    descripcion:
      'Diseña y procesa encuestas periódicas de clima laboral, mide el índice eNPS, evalúa las dimensiones de liderazgo, bienestar y balance de vida, y genera recomendaciones proactivas para prevenir la rotación.',
    avatarIcon: 'HeartPulse',
    capacidadesClave: [
      'Cálculo estadístico de índices de satisfacción y compromiso eNPS.',
      'Detección de puntos de dolor en equipos por sobrecarga o fricción de turnos.',
      'Propuesta de planes de acción para mejora del ambiente laboral.',
    ],
    accionesAutonomas: [
      'Distribución automatizada de encuestas anónimas de pulso.',
      'Generación de informes de clima por área y departamento.',
    ],
    requiereAprobacionHumanaPara: [
      'Publicación de resultados de evaluaciones de desempeño a toda la empresa.',
      'Ejecución presupuestaria para planes de intervención de clima.',
    ],
  },
  {
    id: 'VACACIONES_PERMISOS',
    nombre: 'Camila Pinto Barrientos',
    cargo: 'Agente de Feriado Legal, Progresivo & Permisos Especiales',
    especialidad: 'Art. 67, 68 y 69 del Código del Trabajo, Control de Días Hábiles & Progresivos',
    descripcion:
      'Lleva el cómputo riguroso de días hábiles de feriado legal (1.25 días/mes), acreditación de feriado progresivo con certificados AFP, control de solicitudes y emisión de comprobantes firmados según exigencia de la Dirección del Trabajo.',
    avatarIcon: 'Palmtree',
    capacidadesClave: [
      'Cálculo exacto de saldos de vacaciones devengadas, tomadas y disponibles.',
      'Validación de feriado progresivo (10 años de cotizaciones base + 3 de antigüedad).',
      'Generación de comprobantes de feriado legal listos para firma digital.',
    ],
    accionesAutonomas: [
      'Recepción y validación de disponibilidad de días en solicitudes de feriado.',
      'Alerta a colaboradores y jefaturas por acumulación excesiva (más de 2 períodos).',
    ],
    requiereAprobacionHumanaPara: [
      'Autorización final de solicitudes de vacaciones por parte del jefe directo.',
      'Compensación en dinero de feriado progresivo (Art. 73 CT).',
    ],
  },
  {
    id: 'LICENCIAS_MEDICAS',
    nombre: 'Felipe Herrera Lagos',
    cargo: 'Agente de Licencias Médicas Electrónicas (LME) & Subsidios',
    especialidad: 'Integración Mi DT / I-Med / Medipass, Tramitación y Cálculo de Descuentos en Nómina',
    descripcion:
      'Monitorea la recepción de licencias médicas electrónicas (LME) de COMPIN e ISAPREs, valida el plazo perentorio de 3 días hábiles para tramitación empleador y descuenta con precisión los días a cargo de subsidio vs días de remuneración.',
    avatarIcon: 'FileCheck',
    capacidadesClave: [
      'Control de plazos de tramitación legal ante COMPIN / Cajas de Compensación.',
      'Cálculo de los primeros 3 días en licencias de menos de 11 días.',
      'Sincronización automática de días a descontar con el motor de liquidaciones.',
    ],
    accionesAutonomas: [
      'Registro inmediato de LME recibidas y cálculo de impacto en nómina.',
      'Alertas de proximidad de vencimiento de plazo de tramitación empleador.',
    ],
    requiereAprobacionHumanaPara: [
      'Envío oficial de informe de remuneraciones del empleador a la entidad de salud.',
      'Reclamaciones ante el COMPIN o SUSESO por rechazo injustificado de licencias.',
    ],
  },
  {
    id: 'CONTRATOS_RELACIONES_LABORALES',
    nombre: 'Loreto Riquelme Donoso',
    cargo: 'Agente de Contratos, Anexos DT & Términos Laborales',
    especialidad: 'Código del Trabajo, Ley 40 Horas (Ley 21.561), Registro DT REL & Finiquitos',
    descripcion:
      'Redacta contratos de trabajo ajustados a la jornada de 40 horas, elabora anexos de teletrabajo o reajuste salarial, tramita el registro en Mi DT REL y formula cálculos de indemnización por años de servicio, aviso previo y feriado proporcional.',
    avatarIcon: 'FileText',
    capacidadesClave: [
      'Redacción de contratos según estándares DT con cláusulas de confidencialidad y jornada.',
      'Generación de anexos y pactos de horas extraordinarias.',
      'Cálculo pericial de finiquitos (Art. 159, 160 y 161) con tope legal de 90 UF.',
    ],
    accionesAutonomas: [
      'Alertas por vencimiento de contratos a plazo fijo (30 días antes).',
      'Formulación de borrador de contrato o anexo al incorporar un trabajador.',
    ],
    requiereAprobacionHumanaPara: [
      'Firma de contrato de trabajo definitivo por el representante legal.',
      'Emisión de cartas de aviso de término de contrato y finiquitos oficiales.',
    ],
  },
];
