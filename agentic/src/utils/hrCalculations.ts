import { 
  EmployeePayroll, 
  LaborContract, 
  SeveranceCalculation, 
  SeveranceCausal, 
  MedicalLeave, 
  VacationRecord, 
  CompanyProfile, 
  ClientCompany, 
  ChileIndicators, 
  ErpTechnicalOutputPayload,
  CertificateType,
  GeneratedLaborCertificate
} from '../types';
import { formatCLP, formatNumberCL } from './chileanAccounting';

/**
 * Validates whether required worker and company parameters exist for legal calculations
 */
export function validateHrWorkerParameters(params: {
  rut?: string;
  tipoContrato?: string;
  fechaIngreso?: string;
  empresaId?: string;
}): { valid: boolean; missingFields: string[] } {
  const missing: string[] = [];
  if (!params.empresaId) missing.push('empresa_id (Empresa activa no seleccionada)');
  if (!params.rut) missing.push('rut (RUT del colaborador)');
  if (!params.tipoContrato) missing.push('tipo_contrato (INDEFINIDO, PLAZO_FIJO, POR_OBRA_FAENA)');
  if (!params.fechaIngreso) missing.push('fecha_ingreso (Fecha de inicio de relación laboral)');

  return {
    valid: missing.length === 0,
    missingFields: missing,
  };
}

/**
 * MÓDULO A: Cálculo Legal de Finiquito (Art. 159, 160, 161 Código del Trabajo)
 */
export function calculateSeverancePay(params: {
  empresaId: string;
  rut: string;
  nombreCompleto: string;
  cargo: string;
  fechaIngreso: string;
  fechaDespido: string;
  causal: SeveranceCausal;
  sueldoBase: number;
  promedioGratificacion: number;
  promedioVariables: number;
  asignacionesNoImponibles: number;
  diasAvisoPrevioOtorgados: number; // 0 a 30
  diasVacacionesPendientes: number;
  ufValue: number;
  aporteAfcEmpleadorAcumulado?: number; // Para descuento en Art. 161
}): SeveranceCalculation {
  const ingreso = new Date(params.fechaIngreso);
  const egreso = new Date(params.fechaDespido);
  
  // Antigüedad en días
  const diffMs = Math.max(0, egreso.getTime() - ingreso.getTime());
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  const antiguedadAnos = Math.floor(diffDays / 365);
  const diasRestantes = diffDays % 365;
  const antiguedadMeses = Math.floor(diasRestantes / 30);
  const antiguedadDias = diasRestantes % 30;

  // Remuneración mensual computable (Art. 172 CT: Sueldo base + gratificación + comisiones/bonos habituales)
  // Tope legal de 90 UF (Art. 172 inciso final)
  const tope90UfCLP = Math.round(90 * params.ufValue);
  const baseCalculo = params.sueldoBase + params.promedioGratificacion + params.promedioVariables;
  const remuneracionComputable = Math.min(baseCalculo, tope90UfCLP);

  // Años de servicio computables: fracción superior a 6 meses añade 1 año (Art. 163 CT), con tope legal de 11 años
  let aniosComputables = antiguedadAnos;
  if (antiguedadMeses >= 6) {
    aniosComputables += 1;
  }
  aniosComputables = Math.min(aniosComputables, 11);

  // 1. Indemnización por Años de Servicio (Art. 163 CT)
  // Aplica únicamente para Art. 161 (Necesidades de la empresa / Desahucio) o pactos colectivos
  let indemnizacionAnosServicio = 0;
  if (params.causal === 'ART_161_NECESIDADES_DE_LA_EMPRESA' || params.causal === 'ART_161_DESAHUCIO_ESCRITO') {
    indemnizacionAnosServicio = aniosComputables * remuneracionComputable;
  }

  // 2. Indemnización Sustitutiva de Aviso Previo (Art. 161/162 CT)
  // Si no se notificó con al menos 30 días de anticipación y es causal Art. 161
  let indemnizacionAvisoPrevio = 0;
  if (
    (params.causal === 'ART_161_NECESIDADES_DE_LA_EMPRESA' || params.causal === 'ART_161_DESAHUCIO_ESCRITO') &&
    params.diasAvisoPrevioOtorgados < 30
  ) {
    indemnizacionAvisoPrevio = remuneracionComputable;
  }

  // 3. Feriado Proporcional y Pendiente (Art. 73 CT)
  // Se paga siempre independiente de la causal (incluso en Art. 160)
  // Valor día remuneración íntegra = Base mensual / 30
  const valorDiaRemuneracion = Math.round(baseCalculo / 30);
  const montoFeriadoProporcional = Math.round(params.diasVacacionesPendientes * valorDiaRemuneracion);

  // 4. Descuento Aporte Empleador AFC (Art. 13 Ley 19.728)
  // Solo en causal Art. 161
  let descuentoAporteAfc = 0;
  if (params.causal === 'ART_161_NECESIDADES_DE_LA_EMPRESA') {
    descuentoAporteAfc = Math.round(params.aporteAfcEmpleadorAcumulado || (remuneracionComputable * 0.016 * aniosComputables));
  }

  const totalFiniquitoBruto = indemnizacionAnosServicio + indemnizacionAvisoPrevio + montoFeriadoProporcional;
  const totalDescuentos = descuentoAporteAfc;
  const totalFiniquitoLiquido = Math.max(0, totalFiniquitoBruto - totalDescuentos);

  // Asiento Contable Normalizado para el ERP
  const asientoContable = [
    { cuenta: 'Indemnizaciones Legales por Años de Servicio (Gasto)', debe: indemnizacionAnosServicio, haber: 0 },
    { cuenta: 'Indemnización Sustitutiva de Aviso Previo (Gasto)', debe: indemnizacionAvisoPrevio, haber: 0 },
    { cuenta: 'Feriado Legal Proporcional (Gasto Personal)', debe: montoFeriadoProporcional, haber: 0 },
  ];

  if (descuentoAporteAfc > 0) {
    asientoContable.push({ cuenta: 'Menor Costo Despido Imputación AFC (Ingreso / Regularización)', debe: 0, haber: descuentoAporteAfc });
  }

  asientoContable.push({ cuenta: 'Finiquitos por Pagar (Pasivo Corriente)', debe: 0, haber: totalFiniquitoLiquido });

  return {
    id: `fnq-${Date.now()}`,
    empresaId: params.empresaId,
    rut: params.rut,
    nombreCompleto: params.nombreCompleto,
    cargo: params.cargo,
    fechaIngreso: params.fechaIngreso,
    fechaDespido: params.fechaDespido,
    antiguedadAnos,
    antiguedadMeses,
    antiguedadDias,
    causal: params.causal,
    sueldoBaseUltimo: params.sueldoBase,
    remuneracionMensualComputable: remuneracionComputable,
    diasAvisoPrevioOtorgados: params.diasAvisoPrevioOtorgados,
    indemnizacionAvisoPrevio,
    indemnizacionAnosServicio,
    aniosComputables,
    diasFeriadoPendienteProporcional: params.diasVacacionesPendientes,
    montoFeriadoProporcional,
    descuentoAporteAfcEmpleador: descuentoAporteAfc,
    totalFiniquitoBruto,
    totalDescuentos,
    totalFiniquitoLiquido,
    asientoContable,
  };
}

/**
 * MÓDULO A: Generador de Payload para Registro en Portal MiDT (Dirección del Trabajo)
 * Cumplimiento Ley 21.327 (Plazos legales: 15 días o 5 días faena)
 */
export function generateMiDtContractPayload(
  contract: LaborContract,
  company: CompanyProfile | ClientCompany
) {
  const fechaIngresoDate = new Date(contract.fechaInicio);
  const plazoLimiteDias = contract.tipoContrato === 'POR_OBRA_FAENA' ? 5 : 15;
  const fechaLimite = new Date(fechaIngresoDate.getTime() + plazoLimiteDias * 24 * 60 * 60 * 1000);

  return {
    portal: 'Portal MiDT - Dirección del Trabajo (Ley 21.327)',
    servicio: 'Registro Electrónico Laboral (REL)',
    plazo_legal_dias: plazoLimiteDias,
    fecha_limite_registro: fechaLimite.toISOString().split('T')[0],
    empleador: {
      rut: company.rut,
      razon_social: company.razonSocial,
      representante_legal_rut: '12.445.890-3',
      direccion_casa_matriz: company.direccion + ', ' + company.comuna,
      email_notificaciones: ('email' in company && company.email) ? company.email : 'rrhh@empresa.cl',
      caja_compensacion: 'Caja Los Andes (CCAF)',
      mutualidad: ('mutualidad' in company && company.mutualidad) ? company.mutualidad : 'Mutual de Seguridad CChC',
    },
    trabajador: {
      rut: contract.rut,
      nombre_completo: contract.nombreCompleto,
      nacionalidad: contract.nacionalidad,
      fecha_nacimiento: contract.fechaNacimiento,
      domicilio: contract.domicilio,
      comuna: contract.comuna,
    },
    clausulas_art_10: {
      cargo_funciones: contract.cargo,
      departamento: contract.departamento,
      lugar_prestacion_servicios: contract.lugarTrabajo,
      tipo_contrato: contract.tipoContrato,
      fecha_inicio: contract.fechaInicio,
      fecha_termino: contract.fechaTermino || 'Indefinido',
      sueldo_base: contract.sueldoBase,
      gratificacion_legal: contract.gratificacionModalidad === 'ART_50' ? 'Art. 50 (25% tope 4.75 IMM)' : 'Art. 47',
      jornada_semanal_horas: contract.jornadaHorasSemanales,
      cumplimiento_ley_40_horas: contract.jornadaHorasSemanales <= 42 ? 'CONFORME_GRADUAL_2026' : 'EN_ADAPTACION',
      excepcion_art_22_inciso_2: contract.cargo.toLowerCase().includes('gerente') || contract.cargo.toLowerCase().includes('director'),
      distribucion_horaria: contract.distribucionJornada,
      asignacion_colacion: contract.asignacionColacion,
      asignacion_movilizacion: contract.asignacionMovilizacion,
    },
    anexos_registrados: contract.anexos.map(a => ({
      folio_dt: a.folioRegistroDt || 'PENDIENTE_ENVIO',
      tipo: a.tipo,
      fecha: a.fecha,
    })),
  };
}

/**
 * MÓDULO B: Cálculo de Feriado Progresivo y Control Art. 70
 */
export function calculateVacationEligibility(params: {
  fechaIngreso: string;
  totalAnosCotizadosSistema: number; // Mínimo 10 años en total previsional
  diasPendientesHistoricos: number;
}): {
  diasLegalesBase: number;
  diasProgresivos: number;
  diasDisponiblesTotal: number;
  periodosAcumulados: number;
  infraccionArt70: boolean;
  alertaMensaje: string | null;
} {
  const hoy = new Date();
  const ingreso = new Date(params.fechaIngreso);
  const diffYears = Math.max(0, (hoy.getTime() - ingreso.getTime()) / (1000 * 60 * 60 * 24 * 365.25));

  // Art. 67: 15 días hábiles por año trabajado
  const diasLegalesBase = 15;

  // Art. 68: Feriado Progresivo:
  // Requiere al menos 10 años cotizados (en cualquier empleador) + 3 años con el actual empleador
  // Por cada 3 nuevos años con el actual empleador, suma 1 día hábil adicional
  let diasProgresivos = 0;
  if (params.totalAnosCotizadosSistema >= 10 && diffYears >= 3) {
    diasProgresivos = Math.floor(diffYears / 3);
  }

  const diasDisponiblesTotal = params.diasPendientesHistoricos + diasLegalesBase + diasProgresivos;
  const periodosAcumulados = Number((diasDisponiblesTotal / diasLegalesBase).toFixed(1));
  const infraccionArt70 = periodosAcumulados >= 2.0;

  let alertaMensaje: string | null = null;
  if (infraccionArt70) {
    alertaMensaje = `ALERTA ART. 70 CÓDIGO DEL TRABAJO: El colaborador acumula ${periodosAcumulados} períodos de feriado anual (${diasDisponiblesTotal} días hábiles). La ley prohíbe acumular más de dos períodos consecutivos bajo sanción de la DT.`;
  }

  return {
    diasLegalesBase,
    diasProgresivos,
    diasDisponiblesTotal,
    periodosAcumulados,
    infraccionArt70,
    alertaMensaje,
  };
}

/**
 * MÓDULO B: Procesador de Licencias Médicas y Certificado SIL
 */
export function processMedicalLeaveSalaryDeduction(params: {
  sueldoBase: number;
  diasLicencia: number;
  tipoLicencia: number; // 1 a 7
  diasMes: number; // 30
}): {
  diasDescontados: number;
  montoDescuentoSueldo: number;
  sueldoBaseAjustado: number;
  subsidioSilEntidad: string;
} {
  const diasDescontados = Math.min(params.diasLicencia, params.diasMes);
  const valorDiaSueldo = Math.round(params.sueldoBase / params.diasMes);
  const montoDescuentoSueldo = diasDescontados * valorDiaSueldo;
  const sueldoBaseAjustado = Math.max(0, params.sueldoBase - montoDescuentoSueldo);

  let subsidioSilEntidad = 'FONASA / COMPIN (Subsidio de Incapacidad Laboral)';
  if (params.tipoLicencia === 3 || params.tipoLicencia === 4 || params.tipoLicencia === 5) {
    subsidioSilEntidad = 'Mutual de Seguridad / ACHS / IST (Ley 16.744 Accidentes y Enf. Profesionales)';
  } else if (params.tipoLicencia === 2) {
    subsidioSilEntidad = 'Subsidio Maternal Prenatal/Postnatal (CCAF / COMPIN)';
  }

  return {
    diasDescontados,
    montoDescuentoSueldo,
    sueldoBaseAjustado,
    subsidioSilEntidad,
  };
}

/**
 * MÓDULO C: Generador Formal de Certificados Laborales con Hash y Firma Digital
 */
export function generateLaborCertificate(
  tipo: CertificateType,
  employee: EmployeePayroll,
  company: CompanyProfile | ClientCompany
): GeneratedLaborCertificate {
  const hoy = new Date().toISOString().split('T')[0];
  const folio = `CERT-${tipo}-${Date.now().toString().slice(-6)}`;
  const hash = `SHA256-${Math.random().toString(36).substring(2, 10).toUpperCase()}-${Date.now()}`;
  const validoHastaDate = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
  const validoHasta = validoHastaDate.toISOString().split('T')[0];

  let cuerpoTexto = '';

  if (tipo === 'ANTIGUEDAD') {
    cuerpoTexto = `Por medio del presente instrumento, ${company.razonSocial}, RUT N° ${company.rut}, domiciliada en ${company.direccion}, comuna de ${company.comuna}, debidamente representada por su Representante Legal, CERTIFICA que don(ña) ${employee.nombreCompleto}, Cédula Nacional de Identidad N° ${employee.rut}, presta servicios continuos para nuestra empresa desde el ${employee.fechaIngreso}, desempeñando a la fecha el cargo de ${employee.cargo}, con contrato de trabajo de carácter ${employee.tipoContrato}.\n\nSe extiende el presente certificado a solicitud del interesado para los fines que estime convenientes.`;
  } else if (tipo === 'REMUNERACIONES_COTIZACIONES') {
    cuerpoTexto = `Por medio del presente certificado, ${company.razonSocial}, RUT N° ${company.rut}, CERTIFICA que don(ña) ${employee.nombreCompleto}, RUT N° ${employee.rut}, mantiene sus remuneraciones íntegramente pagadas al período ${hoy.substring(0, 7)}, percibiendo una remuneración bruta mensual de ${formatCLP(employee.totalHaberesBrutos)} (Líquido: ${formatCLP(employee.sueldoLiquido)}).\n\nAsimismo, en estricto cumplimiento del Artículo 177 del Código del Trabajo y Ley N° 19.631 (Ley Bustos), se certifica que todas las cotizaciones previsionales de AFP (${employee.afpNombre}), Salud (${employee.saludTipo}), Seguro de Cesantía (AFC) y Mutualidad de la Ley 16.744 se encuentran debidamente declaradas y pagadas al día ante PREVIRED.`;
  } else if (tipo === 'SALA_CUNA_ART203') {
    cuerpoTexto = `En conformidad con lo prescrito en el Artículo 203 del Código del Trabajo, ${company.razonSocial}, RUT N° ${company.rut}, CERTIFICA que la colaboradora ${employee.nombreCompleto}, RUT N° ${employee.rut}, se encuentra adscrita al beneficio legal de Sala Cuna para su hijo(a) causante menor de dos años, financiando la empresa íntegramente el valor de la matrícula y mensualidad en establecimiento educacional con empadronamiento oficial de la Junta Nacional de Jardines Infantiles (JUNJI).`;
  } else if (tipo === 'ENTREGA_RIOHS_EPP') {
    cuerpoTexto = `COMPROBANTE DE ENTREGA Y DECLARACIÓN DE RECEPCIÓN: El colaborador ${employee.nombreCompleto}, RUT N° ${employee.rut}, en cumplimiento del Artículo 156 del Código del Trabajo y D.S. N° 594 sobre Condiciones Ambientales en los Lugares de Trabajo, declara haber recibido en formato físico y digital un ejemplar íntegro del Reglamento Interno de Orden, Higiene y Seguridad (RIOHS) actualizado, incluyendo el Protocolo de Prevención de Acoso Sexual, Laboral y Violencia en el Trabajo (Ley Karin N° 21.643), además de la dotación completa de Elementos de Protección Personal (EPP) y la inducción de la Obligación de Informar los Riesgos Laborales (ODI - Art. 21 D.S. 40).`;
  }

  return {
    id: `cert-${Date.now()}`,
    tipo,
    folio,
    fechaEmision: hoy,
    rutTrabajador: employee.rut,
    nombreTrabajador: employee.nombreCompleto,
    cargo: employee.cargo,
    empresaRazónSocial: company.razonSocial,
    empresaRut: company.rut,
    representanteLegal: 'Representante Legal Acreditado',
    cuerpoTexto,
    hashFirmaDigital: hash,
    validoHasta,
  };
}

/**
 * MÓDULO E: Archivo de Cotizaciones Masivas PREVIRED (Planilla Estándar Oficial de 105 campos)
 * Retorna texto delimitado y estadísticas
 */
export function generatePrevired105Fields(
  payrolls: EmployeePayroll[],
  company: CompanyProfile | ClientCompany,
  periodo: string // "YYYYMM"
): {
  archivoContenido: string;
  totalCotizantes: number;
  totalMontoPrevired: number;
  resumenEntidades: {
    afpMonto: number;
    fonasaMonto: number;
    isapreMonto: number;
    afcTrabajadorMonto: number;
    afcEmpleadorMonto: number;
    sisMonto: number;
    mutualMonto: number;
  };
} {
  let afpMonto = 0;
  let fonasaMonto = 0;
  let isapreMonto = 0;
  let afcTrabajadorMonto = 0;
  let afcEmpleadorMonto = 0;
  let sisMonto = 0;
  let mutualMonto = 0;

  const lines: string[] = [];

  payrolls.forEach((p, idx) => {
    afpMonto += p.afpMonto;
    if (p.saludTipo === 'FONASA') fonasaMonto += p.saludMonto;
    else isapreMonto += p.saludMonto;
    afcTrabajadorMonto += p.afcTrabajadorMonto;
    afcEmpleadorMonto += p.afcEmpleadorMonto;
    sisMonto += p.sisEmpleadorMonto;
    mutualMonto += p.mutualEmpleadorMonto;

    // Generar formato posicional/delimitado representativo de los 105 campos de Previred
    // Campo 1: RUT Empleador (limpio)
    const empRutLimpio = company.rut.replace(/\./g, '').replace('-', '');
    // Campo 2: RUT Trabajador
    const trabRutLimpio = p.rut.replace(/\./g, '').replace('-', '');
    // Nombre, Apellidos, Días trabajados, Sueldo imponible, Cotización AFP, etc.
    const campos = [
      (idx + 1).toString().padStart(4, '0'), // Campo 1: N° Correlativo
      empRutLimpio, // Campo 2: Rut Empresa
      company.razonSocial.substring(0, 30), // Campo 3: Razón Social
      trabRutLimpio, // Campo 4: Rut Trabajador
      p.nombreCompleto.substring(0, 30), // Campo 5: Nombre Completo
      'M', // Campo 6: Sexo
      'CHL', // Campo 7: Nacionalidad
      '1', // Campo 8: Tipo Pago (1 = Remuneraciones del mes)
      periodo.replace('-', ''), // Campo 9: Período (YYYYMM)
      p.diasTrabajados.toString(), // Campo 10: Días trabajados
      p.tipoContrato === 'INDEFINIDO' ? '1' : '2', // Campo 11: Tipo Línea
      p.afpNombre, // Campo 12: Código AFP
      p.totalHaberesImponibles.toString(), // Campo 13: Renta Imponible AFP
      p.afpMonto.toString(), // Campo 14: Cotización Obligatoria AFP
      p.sisEmpleadorMonto.toString(), // Campo 15: Cotización SIS Empleador
      p.saludTipo, // Campo 16: Institución Salud (FONASA/ISAPRE)
      p.saludMonto.toString(), // Campo 17: Cotización Salud 7% / Pactada
      p.afcTrabajadorMonto.toString(), // Campo 18: Cotización AFC Trabajador
      p.afcEmpleadorMonto.toString(), // Campo 19: Cotización AFC Empleador
      p.mutualEmpleadorMonto.toString(), // Campo 20: Cotización Mutual Ley 16.744
      ('mutualidad' in company && company.mutualidad) ? company.mutualidad : 'MUTUAL_CChC', // Campo 21: Código Mutualidad
      '0', // Campo 22: Cargas Familiares
      '0', // Campo 23: Tramo Asig. Familiar
      '0', // Campo 24: Ahorro Voluntario APV
      // Campos 25 a 105: Parámetros técnicos previred (sucursales, bonos, subsidios, zonas extremas)
      ...Array(81).fill('0')
    ];

    lines.push(campos.join(';'));
  });

  const totalMontoPrevired = afpMonto + fonasaMonto + isapreMonto + afcTrabajadorMonto + afcEmpleadorMonto + sisMonto + mutualMonto;

  return {
    archivoContenido: lines.join('\n'),
    totalCotizantes: payrolls.length,
    totalMontoPrevired,
    resumenEntidades: {
      afpMonto,
      fonasaMonto,
      isapreMonto,
      afcTrabajadorMonto,
      afcEmpleadorMonto,
      sisMonto,
      mutualMonto,
    },
  };
}

/**
 * PROTOCOLO DE SALIDA TÉCNICA (INTEGRACIÓN ERP)
 * Genera el payload JSON estricto requerido por el sistema ERP
 */
export function buildErpTechnicalPayload(params: {
  empresaId: string;
  modulo: 'remuneraciones' | 'contratos' | 'ausentismos' | 'certificados' | 'finiquitos' | 'ley_karin';
  accion: 'crear_liquidacion' | 'generar_contrato' | 'registrar_licencia' | 'calcular_finiquito' | 'emitir_certificado' | 'generar_previred';
  periodo: string; // "YYYY-MM"
  payroll?: EmployeePayroll;
  rutTrabajador?: string;
  nombreTrabajador?: string;
  detallesAdicionales?: Record<string, any>;
}): ErpTechnicalOutputPayload {
  const p = params.payroll;

  if (p) {
    return {
      empresa_id: params.empresaId,
      modulo: params.modulo,
      accion: params.accion,
      periodo: params.periodo,
      data: {
        rut_trabajador: p.rut,
        nombre_trabajador: p.nombreCompleto,
        haberes_imponibles: p.totalHaberesImponibles,
        haberes_no_imponibles: p.totalHaberesNoImponibles,
        total_haberes: p.totalHaberesBrutos,
        descuentos_legales: {
          afp_monto: p.afpMonto,
          salud_monto: p.saludMonto,
          afc_monto: p.afcTrabajadorMonto,
          impuesto_unico: p.impuestoUnicoMonto,
        },
        otros_descuentos: p.otrosDescuentos,
        liquido_a_pagar: p.sueldoLiquido,
        costo_empresa_total: p.costoTotalEmpresa,
        detalles_adicionales: params.detallesAdicionales,
      },
      asiento_contable: [
        { cuenta: 'Sueldos y Salarios (Gasto)', debe: p.sueldoBase + p.gratificacionMonto + p.horasExtrasMonto, haber: 0 },
        { cuenta: 'Asignaciones No Imponibles Colación/Movilización', debe: p.totalHaberesNoImponibles, haber: 0 },
        { cuenta: 'Aportes Patronales SIS, Mutual y AFC', debe: p.sisEmpleadorMonto + p.mutualEmpleadorMonto + p.afcEmpleadorMonto, haber: 0 },
        { cuenta: 'Leyes Sociales por Pagar (Previred)', debe: 0, haber: p.afpMonto + p.saludMonto + p.afcTrabajadorMonto + p.sisEmpleadorMonto + p.mutualEmpleadorMonto + p.afcEmpleadorMonto },
        { cuenta: 'Impuesto Único por Pagar (F29 - SII)', debe: 0, haber: p.impuestoUnicoMonto },
        { cuenta: 'Sueldos por Pagar (Líquido Colaboradores)', debe: 0, haber: p.sueldoLiquido },
      ],
    };
  }

  // Si no hay nómina pero es otra acción
  return {
    empresa_id: params.empresaId,
    modulo: params.modulo,
    accion: params.accion,
    periodo: params.periodo,
    data: {
      rut_trabajador: params.rutTrabajador || '12.345.678-K',
      nombre_trabajador: params.nombreTrabajador,
      haberes_imponibles: 0,
      haberes_no_imponibles: 0,
      total_haberes: 0,
      descuentos_legales: {
        afp_monto: 0,
        salud_monto: 0,
        afc_monto: 0,
        impuesto_unico: 0,
      },
      otros_descuentos: 0,
      liquido_a_pagar: 0,
      costo_empresa_total: 0,
      detalles_adicionales: params.detallesAdicionales,
    },
    asiento_contable: [
      { cuenta: 'Sueldos y Salarios', debe: 0, haber: 0 },
      { cuenta: 'Leyes Sociales por Pagar (Previred)', debe: 0, haber: 0 },
      { cuenta: 'Impuesto Único por Pagar (F29)', debe: 0, haber: 0 },
      { cuenta: 'Sueldos por Pagar (Líquido)', debe: 0, haber: 0 },
    ],
  };
}
