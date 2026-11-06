import { isSimulatedDte } from '../config/dteSimulationPolicy';
import {
  F29SeniorResult,
  F29SeniorMapeo,
  F29AlertaFiscal,
  F29AsientoItem,
  CompanyProfile,
  DteDocument,
  EmployeePayroll,
  ChileIndicators,
  AccountingEntry,
  AccountingEntryLine
} from '../types';
import { formatCLP, formatNumberCL } from './chileanAccounting';
import { normalizeAndValidateJournalEntry } from '../services/journalEntryNormalizer';

export interface PreF29Options {
  periodo?: string; // YYYY-MM
  simularPostergacionArt64?: boolean;
  tasaPpmManual?: number;
  tasaPpmVoluntariaManual?: number;
  utmAnterior?: number;
  utmActual?: number;
  tipoCambioDolar?: number;
}

/**
 * Motor Determinístico Tributario Senior para Formulario 29 (SII - Chile)
 * Implementa la legislación chilena: DL 825 (IVA), Ley sobre Impuesto a la Renta (LIR),
 * Ley 19.983 (Acuse de recibo 8 días), Art. 64 DL 825 (Postergación IVA a 60 días),
 * y Ley de Rentas Municipales (DL 3.063 Art. 24 CPT).
 */
export function calculatePreF29(
  company: CompanyProfile,
  dtes: DteDocument[] = [],
  payrolls: EmployeePayroll[] = [],
  indicators: ChileIndicators,
  options: PreF29Options = {}
): F29SeniorResult {
  // 1.4: los DTE simulados (sin validez tributaria) nunca se declaran en el F29.
  const safeDtes = (Array.isArray(dtes) ? dtes : []).filter((d) => !isSimulatedDte(d as any));
  const safePayrolls = Array.isArray(payrolls) ? payrolls : [];
  // 2.3: el período tributario es obligatorio; no se declara un mes supuesto.
  if (!options.periodo || !/^\d{4}-(0[1-9]|1[0-2])$/.test(options.periodo)) {
    throw new Error('Período tributario (AAAA-MM) requerido para calcular el F29.');
  }
  const periodo = options.periodo;
  const utmActual = options.utmActual || indicators?.utm || 68320;
  // Si no se especifica UTM anterior, se aproxima con variación IPC mensual (~0.4%)
  const utmAnterior = options.utmAnterior || Math.round(utmActual / 1.004);

  // 1. DÉBITO FISCAL IVA (LÍNEAS DE VENTAS Y SERVICIOS)
  // Facturas de Venta afectas (DTE 33), Notas de Débito (DTE 56) y Boletas Afectas (DTE 39)
  const salesDtes = safeDtes.filter(d => d.tipoOperacion === 'VENTA');
  
  let facturasVentaAfectasNeto = 0;
  let debitoFacturasIva = 0;
  let boletasVentaAfectasIva = 0;
  let notasCreditoDeduccionDebito = 0;
  let ventasExentasInformadas = 0;

  salesDtes.forEach(d => {
    if (d.tipoDte === '33' || d.tipoDte === '56') {
      facturasVentaAfectasNeto += (d.montoNeto || 0);
      debitoFacturasIva += (d.montoIva || 0);
    } else if (d.tipoDte === '61') {
      // Nota de crédito emitida: rebaja débito
      notasCreditoDeduccionDebito += (d.montoIva || 0);
      facturasVentaAfectasNeto -= (d.montoNeto || 0);
    } else if (d.tipoDte === '34') {
      // Factura exenta o no gravada
      ventasExentasInformadas += (d.montoExento || d.montoTotal || 0);
    } else {
      // Boletas u otros
      boletasVentaAfectasIva += (d.montoIva || 0);
      facturasVentaAfectasNeto += (d.montoNeto || 0);
    }
  });

  // Total Débito Fiscal Determinado (Código 538 F29)
  const totalDebitoCalculado = Math.max(0, debitoFacturasIva + boletasVentaAfectasIva - notasCreditoDeduccionDebito);

  // 2. CRÉDITO FISCAL IVA (LÍNEAS DE COMPRAS Y SERVICIOS RECIBIDOS)
  const purchaseDtes = safeDtes.filter(d => d.tipoOperacion === 'COMPRA');

  let comprasInternasAfectasNeto = 0;
  let creditoFiscalNormal = 0;
  let comprasActivoFijoIva = 0;
  let comprasSinDerechoCredito = 0;
  let facturasPendientesAcuse8Dias = 0;
  let montoIvaRiesgoAcuse = 0;

  // Detección del plazo de 8 días de la Ley 19.983 para acuse de recibo
  const now = new Date('2026-09-04T00:00:00Z');

  purchaseDtes.forEach(d => {
    // Clasificación de activo fijo vs gasto corriente
    const isActivoFijo = d.glosa.toLowerCase().includes('activo fijo') || 
      d.glosa.toLowerCase().includes('maquinaria') || 
      d.glosa.toLowerCase().includes('vehículo') || 
      d.cuentaContableDebe?.toLowerCase().includes('activo');

    // Detección de acuse de recibo (8 días desde recepción)
    if (d.fechaRecepcion) {
      const recDate = new Date(d.fechaRecepcion);
      const diffDays = Math.floor((now.getTime() - recDate.getTime()) / (1000 * 3600 * 24));
      if (diffDays <= 8 && d.estadoSii === 'PENDIENTE') {
        facturasPendientesAcuse8Dias++;
        montoIvaRiesgoAcuse += (d.montoIva || 0);
      }
    }

    if (d.tipoDte === '61') {
      // Nota de crédito de proveedor recibida rebaja crédito
      creditoFiscalNormal -= (d.montoIva || 0);
      comprasInternasAfectasNeto -= (d.montoNeto || 0);
    } else if (isActivoFijo) {
      comprasActivoFijoIva += (d.montoIva || 0);
      comprasInternasAfectasNeto += (d.montoNeto || 0);
    } else if (d.estadoSii === 'RECLAMADO') {
      // Reclamada: no otorga crédito
      comprasSinDerechoCredito += (d.montoIva || 0);
    } else {
      creditoFiscalNormal += (d.montoIva || 0);
      comprasInternasAfectasNeto += (d.montoNeto || 0);
    }
  });

  // Factor de proporcionalidad Art. 23 DL 825
  // Si la empresa tiene ventas exentas y afectas, se aplica proporcionalidad
  const totalVentasBrutas = facturasVentaAfectasNeto + ventasExentasInformadas;
  let factorProporcionalidadIva = 1.0;
  if (totalVentasBrutas > 0 && ventasExentasInformadas > 0) {
    factorProporcionalidadIva = Math.min(1.0, Math.max(0, facturasVentaAfectasNeto / totalVentasBrutas));
  }

  // Reajuste de Remanente de Crédito Fiscal del mes anterior (Art. 28 DL 825)
  // El remanente en UTM del mes anterior se multiplica por la UTM del mes en que se declara
  const remanenteMesAnteriorUtm = company.remanenteCreditoFiscalUtm || 
    (company.remanenteCreditoFiscalClp ? company.remanenteCreditoFiscalClp / utmAnterior : 0);
  
  const remanenteReajustadoClp = Math.round(remanenteMesAnteriorUtm * utmActual);

  // Total Crédito Fiscal Determinado (Código 537 F29)
  const totalCreditoConRemanente = Math.round(
    (creditoFiscalNormal * factorProporcionalidadIva) + 
    comprasActivoFijoIva + 
    remanenteReajustadoClp
  );

  // 3. DETERMINACIÓN DEL IVA (CÓDIGOS 089 Y 077)
  let impuestoDeterminadoIva = 0; // Código 089
  let saldoAFavorORemanente = 0; // Código 077

  if (totalDebitoCalculado > totalCreditoConRemanente) {
    impuestoDeterminadoIva = totalDebitoCalculado - totalCreditoConRemanente;
    saldoAFavorORemanente = 0;
  } else {
    impuestoDeterminadoIva = 0;
    saldoAFavorORemanente = totalCreditoConRemanente - totalDebitoCalculado;
  }

  // 4. RETENCIONES OBLIGATORIAS
  // 4.1 Segunda Categoría Honorarios (Código 151)
  // Tasa legal progresiva vigente para 2025/2026: 14.5% (Ley 21.133)
  const honorariosDtes = safeDtes.filter(d => d.tipoOperacion === 'HONORARIOS');
  const honorariosTasaAplicada = indicators?.retencionHonorariosTasa || 0.145;
  
  const honorariosBrutoTotal = honorariosDtes.reduce((s, d) => s + (d.montoTotal || 0), 0);
  const retencionHonorariosSegundaCat = honorariosDtes.reduce((s, d) => {
    return s + (d.retencionMonto || Math.round(d.montoTotal * (d.retencionTasa || honorariosTasaAplicada)));
  }, 0);

  // 4.2 Impuesto Único de Segunda Categoría sobre Sueldos (Código 048)
  const impuestoUnicoTrabajadoresSueldos = safePayrolls.reduce((s, p) => s + (p.impuestoUnicoMonto || 0), 0);

  // 4.3 Otras retenciones (Cambio de Sujeto y No Residentes)
  const cambioSujetoIva = 0;
  const retencionesNoResidentes = 0;

  // 5. PAGO PROVISORIO MENSUAL (PPM) (CÓDIGOS 030 Y 062 - Art. 84 LIR)
  // Base Imponible de Ingresos Brutos del Giro percibidos o devengados (Ventas netas afectas + ventas exentas del giro)
  const baseImponibleVentasNetas = Math.max(0, facturasVentaAfectasNeto + ventasExentasInformadas);
  
  // Tasa de PPM según régimen tributario y configuración
  let tasaPpmObligatoria = options.tasaPpmManual ?? company.tasaPpm ?? 0.01;
  const tasaPpmVoluntaria = options.tasaPpmVoluntariaManual ?? company.tasaPpmVoluntaria ?? 0;
  
  // Regla según régimen tributario chileno:
  // 14 D3 Pro Pyme General: 0.25% si ingresos anuales < 50.000 UF, 0.50% regular
  // 14 D8 Pro Pyme Transparente: 0.20% o 0.50%
  // 14 A Régimen General Semi-Integrado: según tasa calculada en F22 anterior (típicamente 1.5% a 3.5%)
  if (!company.tasaPpm) {
    if (company.regimenTributario === '14D3_PROPYME_GENERAL') {
      tasaPpmObligatoria = 0.005; // 0.50%
    } else if (company.regimenTributario === '14D8_PROPYME_TRANSPARENTE') {
      tasaPpmObligatoria = 0.002; // 0.20%
    } else {
      tasaPpmObligatoria = 0.015; // 1.50%
    }
  }

  const tasaTotalAplicada = tasaPpmObligatoria + tasaPpmVoluntaria;
  const ppmDeterminado = Math.round(baseImponibleVentasNetas * tasaTotalAplicada); // Código 062

  // 6. TOTAL A PAGAR EN ARCAS FISCALES (CÓDIGO 091)
  const totalAPagarF29 = Math.round(
    impuestoDeterminadoIva +
    ppmDeterminado +
    retencionHonorariosSegundaCat +
    impuestoUnicoTrabajadoresSueldos +
    cambioSujetoIva +
    retencionesNoResidentes
  );

  // 7. POSTERGACIÓN DE IVA (ART. 64 LEY DE IVA)
  const esPymeElegible = company.regimenTributario === '14D3_PROPYME_GENERAL' || company.regimenTributario === '14D8_PROPYME_TRANSPARENTE';
  const montoIvaPostergable = (esPymeElegible && impuestoDeterminadoIva > 0) ? impuestoDeterminadoIva : 0;
  const totalConPostergacion = totalAPagarF29 - montoIvaPostergable;
  
  // Plazo diferido: 60 días (vencimiento día 28 o fin de mes subsiguiente)
  const postergacionResult = {
    aplicaArticulo64: esPymeElegible && impuestoDeterminadoIva > 0,
    montoIvaPostergable,
    totalConPostergacion,
    plazoDias: 60,
    fechaVencimientoPostergada: '2026-11-20',
    evaluacionImpactoFlujo: esPymeElegible && impuestoDeterminadoIva > 0
      ? `Permite liberar ${formatCLP(montoIvaPostergable)} de caja inmediata durante 60 días sin interés punitorio (solo IPC), difiriendo el pago al 20 de Noviembre de 2026.`
      : 'No genera beneficio de caja para el período actual debido a que no existe IVA Débito neto determinado a enterar o el régimen no califica.',
    recomendacion: (esPymeElegible && montoIvaPostergable > 2000000) ? ('POSTERGAR' as const) : ('PAGAR_CONTADO' as const)
  };

  // 8. PATENTE MUNICIPAL Y PROYECCIÓN ANUAL (F22 Y CPT)
  const cptBase = company.capitalPropioTributarioSimplificado || 85400000;
  const tasaPorMil = company.patenteMunicipalTasaPorMil || 5.0; // 5 por mil anual
  const patenteAnualEstimada = Math.round(cptBase * (tasaPorMil / 1000));
  const patenteSemestralEstimada = Math.round(patenteAnualEstimada / 2);

  const rliBase = company.baseRliProyectada || Math.round(baseImponibleVentasNetas * 0.35);
  const tasaIdpc = company.regimenTributario === '14D3_PROPYME_GENERAL' ? 0.125 : 0.27; // Tasa IDPC 12.5% ProPyme o 27% 14 A
  const idpcEstimado = Math.round(rliBase * tasaIdpc);

  // 9. ALERTAS Y AUDITORÍA PREVENTIVA
  const alertas: F29AlertaFiscal[] = [];

  // Alerta 1: Acuse de recibo 8 días (Ley 19.983)
  if (facturasPendientesAcuse8Dias > 0) {
    alertas.push({
      tipo: 'ADVERTENCIA',
      descripcion: `Existen ${facturasPendientesAcuse8Dias} facturas de compra recibidas pendientes de reclamo o acuse de recibo dentro del plazo de 8 días de la Ley 19.983. Si no se aprueban o reclaman, el SII las aceptará tácitamente validando el crédito fiscal de ${formatCLP(montoIvaRiesgoAcuse)}.`,
      codigoRelacionado: 'C511',
      accionSugerida: 'Revisar portal RCV y validar mercaderías o servicios recibidos conforme.'
    });
  }

  // Alerta 2: Proporcionalidad Art. 23 DL 825
  if (ventasExentasInformadas > 0) {
    alertas.push({
      tipo: 'ADVERTENCIA',
      descripcion: `La empresa registró ${formatCLP(ventasExentasInformadas)} en ventas exentas (DTE 34). Se calculó un factor de proporcionalidad del crédito fiscal de ${(factorProporcionalidadIva * 100).toFixed(2)}% según Art. 23 Ley de IVA.`,
      codigoRelacionado: 'C537',
      accionSugerida: 'Separar compras de afectación directa exclusiva vs compras de uso común.'
    });
  }

  // Alerta 3: Remanente Reajustado
  if (remanenteMesAnteriorUtm > 0) {
    const incrementoReajuste = remanenteReajustadoClp - (company.remanenteCreditoFiscalClp || Math.round(remanenteMesAnteriorUtm * utmAnterior));
    alertas.push({
      tipo: 'OPORTUNIDAD',
      descripcion: `Remanente del mes anterior reajustado por variación UTM: ${remanenteMesAnteriorUtm.toFixed(2)} UTM equivalen a ${formatCLP(remanenteReajustadoClp)} (ganancia por reajuste legal: ${formatCLP(incrementoReajuste)}).`,
      codigoRelacionado: 'C077',
      accionSugerida: 'Verificar coincidencia con Código 504 del F29 del mes anterior.'
    });
  }

  // Alerta 4: Postergación Art. 64
  if (postergacionResult.aplicaArticulo64) {
    alertas.push({
      tipo: 'OPORTUNIDAD',
      descripcion: `Empresa Pro Pyme con derecho a postergar ${formatCLP(montoIvaPostergable)} de IVA Débito a 60 días (Art. 64 DL 825). Pagando únicamente ${formatCLP(totalConPostergacion)} al día 20.`,
      codigoRelacionado: 'C089',
      accionSugerida: 'Activar casilla de postergación en la declaración electrónica del SII.'
    });
  }

  // Alerta 5: Retención de honorarios progresiva
  alertas.push({
    tipo: 'ADVERTENCIA',
    descripcion: `Tasa de retención de Boletas de Honorarios aplicada al ${(honorariosTasaAplicada * 100).toFixed(2)}% según calendario gradual de la Ley 21.133 para cobertura previsional y salud.`,
    codigoRelacionado: 'C151',
    accionSugerida: 'Conciliar con el Libro de Boletas de Honorarios Electrónicas del SII.'
  });

  // 10. MAPEO DE CÓDIGOS F29
  const f29Mapeo: F29SeniorMapeo = {
    c538_total_debito: totalDebitoCalculado,
    c537_total_credito: totalCreditoConRemanente,
    c077_saldo_a_favor_o_remanente: saldoAFavorORemanente,
    c089_impuesto_determinado_iva: impuestoDeterminadoIva,
    c151_retencion_honorarios: retencionHonorariosSegundaCat,
    c048_impuesto_unico_segunda_cat: impuestoUnicoTrabajadoresSueldos,
    c030_monto_base_ppm: baseImponibleVentasNetas,
    c062_ppm_determinado: ppmDeterminado,
    c091_total_a_pagar_f29: totalAPagarF29
  };

  // 11. ASIENTO CONTABLE NORMALIZADO F29 (ORDEN CANÓNICO ESTRICTO - LIBRO DIARIO)
  const rawLinesForNormalization = [];

  // Proporcionalidad del Crédito Fiscal e IVA no recuperable (Art. 23 DL 825)
  const creditoFiscalRecuperable = Math.round(creditoFiscalNormal * factorProporcionalidadIva);
  const ivaNoRecuperableProporcionalidad = Math.max(0, creditoFiscalNormal - creditoFiscalRecuperable);

  // 1. Débito Fiscal IVA
  if (totalDebitoCalculado > 0) {
    rawLinesForNormalization.push({ 
      codigoCuenta: '2.1.03',
      nombreCuenta: 'IVA Débito Fiscal', 
      debe: totalDebitoCalculado, 
      haber: 0 
    });
  }

  // 2. Gasto IVA No Recuperable por Proporcionalidad (Art. 23 N° 3 DL 825)
  if (ivaNoRecuperableProporcionalidad > 0) {
    rawLinesForNormalization.push({
      codigoCuenta: '5.2.12',
      nombreCuenta: 'Gasto IVA No Recuperable (Art. 23 DL 825)',
      debe: ivaNoRecuperableProporcionalidad,
      haber: 0
    });
  }

  // 3. Retenciones Honorarios 2da Categoría
  if (retencionHonorariosSegundaCat > 0) {
    rawLinesForNormalization.push({
      codigoCuenta: '2.1.04',
      nombreCuenta: 'Retenciones Honorarios por Pagar',
      debe: retencionHonorariosSegundaCat,
      haber: 0
    });
  }

  // 4. Impuesto Único de Segunda Categoría
  if (impuestoUnicoTrabajadoresSueldos > 0) {
    rawLinesForNormalization.push({
      codigoCuenta: '2.1.05',
      nombreCuenta: 'Impuesto Único por Pagar',
      debe: impuestoUnicoTrabajadoresSueldos,
      haber: 0
    });
  }

  // 5. PPM por Recuperar (Activo)
  if (ppmDeterminado > 0) {
    rawLinesForNormalization.push({
      codigoCuenta: '1.1.07',
      nombreCuenta: 'PPM Pagos Provisorios Mensuales por Recuperar',
      debe: ppmDeterminado,
      haber: 0
    });
  }

  // 6. Remanente Crédito Fiscal Mes Siguiente (si sobró crédito a favor)
  if (saldoAFavorORemanente > 0) {
    rawLinesForNormalization.push({
      codigoCuenta: '1.1.06',
      nombreCuenta: 'Remanente Crédito Fiscal (Mes Siguiente)',
      debe: saldoAFavorORemanente,
      haber: 0
    });
  }

  // 7. IVA Crédito Fiscal liquidado del mes (se extingue contra débitos y gasto no recuperable)
  const creditoMesTotal = creditoFiscalNormal + comprasActivoFijoIva;
  if (creditoMesTotal > 0) {
    rawLinesForNormalization.push({
      codigoCuenta: '1.1.05',
      nombreCuenta: 'IVA Crédito Fiscal',
      debe: 0,
      haber: creditoMesTotal
    });
  }

  // 8. Remanente Mes Anterior consumido/compensado
  if (remanenteReajustadoClp > 0) {
    rawLinesForNormalization.push({
      codigoCuenta: '1.1.06',
      nombreCuenta: 'Remanente Crédito Fiscal (Mes Anterior)',
      debe: 0,
      haber: remanenteReajustadoClp
    });
  }

  // 9. Total a Pagar F29 (TGR)
  if (totalAPagarF29 > 0) {
    rawLinesForNormalization.push({
      codigoCuenta: '2.1.06',
      nombreCuenta: 'Impuestos por Pagar (F29 / TGR)',
      debe: 0,
      haber: totalAPagarF29
    });
  }

  // Si la empresa no presenta movimientos tributarios con cargo o abono ($0 determinado),
  // se incluye registro memorial de control formal para cumplir con la partida doble canónica.
  if (rawLinesForNormalization.length === 0) {
    rawLinesForNormalization.push(
      {
        codigoCuenta: '9.9.99.01',
        nombreCuenta: 'Cuentas de Orden - Declaración F29 Sin Movimiento',
        debe: 1,
        haber: 0,
      },
      {
        codigoCuenta: '9.9.99.02',
        nombreCuenta: 'Cuentas de Orden Per-Contra - F29 Sin Movimiento Aceptado',
        debe: 0,
        haber: 1,
      }
    );
  }

  // Ejecución de la normalización canónica (Bloque 1: DEBE > 0, Bloque 2: HABER > 0)
  const normalizedJournal = normalizeAndValidateJournalEntry({
    empresaId: company.rut,
    periodo,
    fecha: `${periodo}-20`,
    glosaGeneral: `Liquidación F29 período ${periodo} - ${company.razonSocial}`,
    documentoRef: `F29-SII-${periodo}`,
    origenModulo: 'F29_CENTRALIZACION',
    creadoPorAgente: 'ENGINE_F29_SENIOR',
    lineas: rawLinesForNormalization
  });

  const asientoContable: F29AsientoItem[] = normalizedJournal.lineas.map(l => ({
    cuenta: l.nombreCuenta,
    debe: l.debe,
    haber: l.haber
  }));

  // 12. CAPA ASESORA HUMAN-READABLE
  const resumenEjecutivo = `Liquidación Oficial F29 período ${periodo} para ${company.razonSocial} (RUT: ${company.rut}, Régimen: ${company.regimenTributario === '14D3_PROPYME_GENERAL' ? 'Pro Pyme General 14 D3' : company.regimenTributario === '14D8_PROPYME_TRANSPARENTE' ? 'Pro Pyme Transparente 14 D8' : 'Régimen General 14 A'}). Total Débitos IVA: ${formatCLP(totalDebitoCalculado)}, Total Créditos IVA con Remanente Reajustado: ${formatCLP(totalCreditoConRemanente)}. Resultado IVA: ${impuestoDeterminadoIva > 0 ? `Impuesto Determinado de ${formatCLP(impuestoDeterminadoIva)}` : `Remanente a favor de ${formatCLP(saldoAFavorORemanente)}`}. Retenciones 2da Cat (Honorarios + Sueldos): ${formatCLP(retencionHonorariosSegundaCat + impuestoUnicoTrabajadoresSueldos)}, PPM (${(tasaTotalAplicada * 100).toFixed(2)}%): ${formatCLP(ppmDeterminado)}. Total Líquido a Pagar en F29: ${formatCLP(totalAPagarF29)}.`;

  const capaAsesora = {
    resumenEjecutivo,
    analisisDebitoCredito: `Las ventas del mes devengaron ${formatCLP(debitoFacturasIva)} en IVA Débito Fiscal, compensado con ${formatCLP(creditoFiscalNormal)} de crédito fiscal de proveedores, ${formatCLP(comprasActivoFijoIva)} en activo fijo y ${formatCLP(remanenteReajustadoClp)} de remanente reajustado en UTM (${remanenteMesAnteriorUtm.toFixed(2)} UTM).`,
    observacionesCriticas: alertas.map(a => a.descripcion),
    recomendacionesEstrategicas: [
      postergacionResult.aplicaArticulo64 
        ? `Aprovechar la postergación de IVA según el Art. 64 de la Ley de IVA para diferir el pago de ${formatCLP(montoIvaPostergable)} a 60 días, pagando únicamente ${formatCLP(totalConPostergacion)} este mes.`
        : 'Mantener control de pagos al día 20 para evitar intereses y multas tributarias del Art. 97 N° 11 del Código Tributario.',
      `Monitorear la base del CPT Simplificado de ${formatCLP(cptBase)} para la próxima cuota semestral de Patente Municipal estimada en ${formatCLP(patenteSemestralEstimada)} ante la Municipalidad de ${company.comuna}.`,
      `Verificar el acuse de recibo de las facturas de proveedores dentro de los 8 días para evitar reclamos o pérdida del crédito fiscal.`
    ],
    normativaCitada: [
      'Decreto Ley 825 sobre Impuesto a las Ventas y Servicios (Art. 23, 24, 28 y 64)',
      'Ley sobre Impuesto a la Renta (Art. 14 D3, Art. 84 PPM y Art. 59/74)',
      'Ley 19.983 sobre mérito ejecutivo y acuse de recibo de facturas',
      'Ley 21.133 de cotizaciones y retención gradual de Boletas de Honorarios',
      'Decreto Ley 3.063 sobre Rentas Municipales (Art. 24 Patente Comercial)'
    ]
  };

  return {
    empresa_id: company.rut,
    periodo_tributario: periodo,
    estado_liquidacion: 'PRE_DECLARACION',
    f29_mapeo: f29Mapeo,
    alertas_fiscales: alertas,
    asiento_contable_f29: asientoContable,
    capa_asesora: capaAsesora,
    detalle_debito: {
      ventasFacturasAfectasNeto: facturasVentaAfectasNeto,
      debitoFacturasIva,
      ventasBoletasAfectasIva: boletasVentaAfectasIva,
      notasCreditoDeduccionDebito,
      ventasExentasInformadas,
      totalDebitoCalculado
    },
    detalle_credito: {
      comprasInternasAfectasNeto,
      creditoFiscalNormal,
      comprasActivoFijoIva,
      comprasSinDerechoCredito,
      factorProporcionalidadIva,
      remanenteMesAnteriorUtm,
      utmValorMesAnterior: utmAnterior,
      utmValorMesActual: utmActual,
      remanenteReajustadoClp,
      totalCreditoConRemanente
    },
    detalle_retenciones: {
      honorariosBrutoTotal,
      honorariosTasaAplicada,
      retencionHonorariosSegundaCat,
      impuestoUnicoTrabajadoresSueldos,
      cambioSujetoIva,
      retencionesNoResidentes
    },
    detalle_ppm: {
      baseImponibleVentasNetas,
      regimenTributario: company.regimenTributario,
      tasaPpmObligatoria,
      tasaPpmVoluntaria,
      tasaTotalAplicada,
      ppmDeterminado
    },
    postergacion_iva: postergacionResult,
    patente_municipal_y_renta: {
      cptSimplificadoBase: cptBase,
      patenteTasaPorMil: tasaPorMil,
      patenteSemestralEstimada,
      rliProyectada: rliBase,
      tasaIdpc: tasaIdpc * 100,
      idpcEstimado,
      comunaCasaMatriz: company.comuna || 'Providencia'
    }
  };
}

/**
 * Convierte el asiento contable del F29 al objeto estandarizado AccountingEntry del ERP
 */
export function convertF29AsientoToAccountingEntry(
  result: F29SeniorResult,
  company: CompanyProfile
): AccountingEntry {
  const lineas: AccountingEntryLine[] = result.asiento_contable_f29
    .filter(item => item.debe > 0 || item.haber > 0)
    .map((item, index) => {
      let cuentaCodigo = '2.1.04';
      if (item.cuenta.includes('IVA Débito')) cuentaCodigo = '2.1.03';
      else if (item.cuenta.includes('IVA Crédito')) cuentaCodigo = '1.1.05';
      else if (item.cuenta.includes('Remanente') && item.cuenta.includes('Mes Anterior')) cuentaCodigo = '1.1.06';
      else if (item.cuenta.includes('Remanente') && item.cuenta.includes('Mes Siguiente')) cuentaCodigo = '1.1.06';
      else if (item.cuenta.includes('Honorarios')) cuentaCodigo = '2.1.04';
      else if (item.cuenta.includes('Impuesto Único')) cuentaCodigo = '2.1.05';
      else if (item.cuenta.includes('PPM')) cuentaCodigo = '1.1.07';
      else if (item.cuenta.includes('Impuestos por Pagar') || item.cuenta.includes('TGR')) cuentaCodigo = '2.1.08';
      else if (item.cuenta.includes('No Recuperable')) cuentaCodigo = '5.2.12';

      return {
        cuentaCodigo,
        cuentaNombre: item.cuenta,
        debe: Math.round(item.debe),
        haber: Math.round(item.haber)
      };
    });

  if (lineas.length === 0) {
    lineas.push(
      {
        cuentaCodigo: '9.9.99.01',
        cuentaNombre: 'Cuentas de Orden - Declaración F29 Sin Movimiento',
        debe: 1,
        haber: 0,
      },
      {
        cuentaCodigo: '9.9.99.02',
        cuentaNombre: 'Cuentas de Orden Per-Contra - F29 Sin Movimiento Aceptado',
        debe: 0,
        haber: 1,
      }
    );
  }

  const normalized = normalizeAndValidateJournalEntry({
    empresaId: company.rut,
    periodo: result.periodo_tributario,
    fecha: `${result.periodo_tributario}-20`,
    glosaGeneral: `Liquidación y Centralización F29 Período ${result.periodo_tributario} - ${company.razonSocial}`,
    documentoRef: `F29 SII Folio Electrónico`,
    origenModulo: 'F29_CENTRALIZACION',
    creadoPorAgente: 'ENGINE_F29_SENIOR',
    lineas: lineas.map(l => ({
      codigoCuenta: l.cuentaCodigo,
      nombreCuenta: l.cuentaNombre,
      debe: l.debe,
      haber: l.haber
    }))
  });

  return {
    id: `entry-f29-senior-${result.periodo_tributario}-${Date.now()}`,
    fecha: `${result.periodo_tributario}-20`,
    concepto: normalized.glosaGeneral,
    documento: `F29 SII Folio Electrónico`,
    lineas: normalized.lineas.map(l => ({
      cuentaCodigo: l.codigoCuenta,
      cuentaNombre: l.nombreCuenta,
      debe: l.debe,
      haber: l.haber
    })),
    totalDebe: normalized.totalDebe,
    totalHaber: normalized.totalHaber,
    balanceado: Math.abs(normalized.diferencia) < 0.01,
    origen: 'F29_TRIBUTARIO',
    creadoEn: new Date().toISOString()
  };
}
