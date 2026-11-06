import {
  CashFlowMovement,
  BankAccountConfig,
  CashAccountConfig,
  CashFlowHorizonType,
  CashFlowInclusionParameters,
  MonthlyCashFlowPoint,
  EmployeePayroll,
  F29Declaration,
  ProductionBudget,
  ProductionOrder,
  DteDocument,
  LeaseContract,
  DailyCashFlowPoint,
  LiquidityCrisisAlert,
  ErpCommitmentsScanResult,
  ChequeCartera,
  ChequeEmitido,
  DeudaFinanciera,
  ProvisionEgreso,
  AccountingEntry,
} from '../types';

/**
 * Motor Agéntico de Proyección de Flujo de Caja y Liquidez
 * Conecta saldos reales de cuentas bancarias y de efectivo (Caja, Fondo Fijo, Caja Chica),
 * proyecta ventas en base al comportamiento histórico del RCV parametrizable,
 * cheques en cartera por cobrar, cheques emitidos por pagar,
 * cuotas de deudas con instituciones financieras y provisiones de egresos,
 * y proyecta compromisos del ERP a nivel diario, 30, 60, 90 días y 1 año de horizonte.
 */

export const DEFAULT_CASH_FLOW_PARAMETERS: CashFlowInclusionParameters = {
  incluirCuentasBancarias: true,
  incluirCuentasEfectivo: true,
  incluirCobranzaDtePendientes: true,
  incluirVentasProyectadasHistoria: true,
  tasaCrecimientoVentasPct: 5,
  diasCreditoVentasPromedio: 30,
  pctVentasContado: 30,
  incluirHitosProduccion: true,
  incluirChequesCartera: true,
  incluirChequesEmitidos: true,
  incluirDeudaFinanciera: true,
  incluirProvisionesEgresos: true,
  incluirPagoProveedoresDte: true,
  incluirInsumosMpdProduccion: true,
  incluirNominaSueldos: true,
  incluirPreviredLeyesSociales: true,
  incluirF29Impuestos: true,
  incluirArriendosIfrs16: true,
  incluirGastosFondoFijo: true,
};

export const DEFAULT_CASH_FLOW_INCLUSION_PARAMS = DEFAULT_CASH_FLOW_PARAMETERS;

// 1. CÁLCULO CONSOLIDADO DE SALDO INICIAL: BANCOS + EFECTIVO (CAJA, FONDO FIJO)
export function calculateConsolidatedCashPosition(
  bankAccounts: BankAccountConfig[] = [],
  cashAccounts: CashAccountConfig[] = [],
  includeBanks = true,
  includeCash = true,
  dolarRate: number = 955.20,
  euroRate: number = 1042.80
) {
  const safeBanks = Array.isArray(bankAccounts) ? bankAccounts : [];
  const safeCash = Array.isArray(cashAccounts) ? cashAccounts : [];

  const totalSaldoBancos = includeBanks
    ? safeBanks.reduce((acc, b) => {
        const rate = b.moneda === 'USD' ? dolarRate : b.moneda === 'EUR' ? euroRate : 1;
        return acc + Math.round((b.saldoEnLinea || 0) * rate);
      }, 0)
    : 0;

  const totalSaldoEfectivo = includeCash
    ? safeCash.filter(c => c.activo).reduce((acc, c) => acc + (c.montoSaldo || 0), 0)
    : 0;

  const totalSaldoConsolidado = totalSaldoBancos + totalSaldoEfectivo;

  const cuentasBancarias = safeBanks.map(b => {
    const rate = b.moneda === 'USD' ? dolarRate : b.moneda === 'EUR' ? euroRate : 1;
    const saldoCLP = Math.round((b.saldoEnLinea || 0) * rate);
    return {
      id: b.id,
      banco: b.banco,
      bancoCodigo: b.bancoCodigo,
      numero: b.numeroCuenta,
      tipo: b.tipoCuenta,
      moneda: b.moneda,
      saldo: b.saldoEnLinea || 0,
      saldoNominal: b.saldoEnLinea || 0,
      saldoCLP,
      tipoCambio: rate,
      estadoConexion: b.estadoConexion,
      esPrincipal: b.esPrincipal,
      ultimaSincronizacion: b.ultimaSincronizacion,
    };
  });

  const cuentasEfectivo = safeCash.map(c => ({
    id: c.id,
    nombre: c.nombre,
    tipo: c.tipoCuenta,
    codigoContable: c.codigoContable,
    responsable: c.responsableNombre,
    saldo: c.montoSaldo || 0,
    saldoInicial: c.montoSaldo || 0,
    activo: c.activo,
    centroCostoId: c.centroCostoId,
  }));

  return {
    totalSaldo: totalSaldoConsolidado,
    totalSaldoBancos,
    totalSaldoEfectivo,
    totalSaldoConsolidado,
    cuentas: cuentasBancarias,
    cuentasBancos: cuentasBancarias,
    cuentasBancarias,
    cuentasEfectivo,
    cantidadCuentas: cuentasBancarias.length + cuentasEfectivo.length,
  };
}

export function calculateConsolidatedBankBalance(bankAccounts: BankAccountConfig[] = []) {
  return calculateConsolidatedCashPosition(bankAccounts, [], true, false);
}

// 2. ANÁLISIS Y PROYECCIÓN DE VENTAS EN BASE A LA HISTORIA (RCV)
export interface HistoricalSalesAnalysis {
  totalVentasHistoricasNeto: number;
  totalVentasHistoricasBruto: number;
  cantidadDocumentosVenta: number;
  promedioMensualVentasNeto: number;
  promedioMensualVentasBruto: number;
  ticketPromedio: number;
  periodosAnalizados: number;
  mesesDetalle: {
    periodo: string; // "2026-06"
    montoNeto: number;
    montoBruto: number;
    cantidadDtes: number;
  }[];
}

export function analyzeHistoricalSales(dtes: DteDocument[] = [], growthRatePct: number = 5): HistoricalSalesAnalysis {
  const safeDtes = Array.isArray(dtes) ? dtes : [];
  const salesDtes = safeDtes.filter(d => 
    d.tipoOperacion === 'VENTA' || 
    d.tipoDte === '33' || 
    d.tipoDte === '34' || 
    d.tipoDte === '39' || 
    d.tipoDte === '61'
  );

  const monthMap: Record<string, { neto: number; bruto: number; count: number }> = {};

  salesDtes.forEach(d => {
    const period = d.fechaEmision ? d.fechaEmision.substring(0, 7) : 'SIN_FECHA';
    if (!monthMap[period]) {
      monthMap[period] = { neto: 0, bruto: 0, count: 0 };
    }
    const sign = d.tipoDte === '61' ? -1 : 1; // NC resta
    monthMap[period].neto += (d.montoNeto || 0) * sign;
    monthMap[period].bruto += (d.montoTotal || 0) * sign;
    monthMap[period].count += 1;
  });

  const periodKeys = Object.keys(monthMap).sort();
  const mesesDetalle = periodKeys.map(k => ({
    periodo: k,
    montoNeto: Math.max(0, monthMap[k].neto),
    montoBruto: Math.max(0, monthMap[k].bruto),
    cantidadDtes: monthMap[k].count,
  }));

  const periodCount = Math.max(1, mesesDetalle.length);
  const totalNeto = mesesDetalle.reduce((s, m) => s + m.montoNeto, 0);
  const totalBruto = mesesDetalle.reduce((s, m) => s + m.montoBruto, 0);
  const totalDocs = mesesDetalle.reduce((s, m) => s + m.cantidadDtes, 0);

  // Run-rate baseline para empresas medianas en caso de historial inicial
  const baselinePromedioNeto = totalNeto > 0 ? Math.round(totalNeto / periodCount) : 48500000;
  const baselinePromedioBruto = totalBruto > 0 ? Math.round(totalBruto / periodCount) : Math.round(baselinePromedioNeto * 1.19);

  return {
    totalVentasHistoricasNeto: totalNeto > 0 ? totalNeto : baselinePromedioNeto * 3,
    totalVentasHistoricasBruto: totalBruto > 0 ? totalBruto : baselinePromedioBruto * 3,
    cantidadDocumentosVenta: totalDocs > 0 ? totalDocs : 18,
    promedioMensualVentasNeto: baselinePromedioNeto,
    promedioMensualVentasBruto: baselinePromedioBruto,
    ticketPromedio: totalDocs > 0 ? Math.round(totalBruto / totalDocs) : Math.round(baselinePromedioBruto / 6),
    periodosAnalizados: periodCount,
    mesesDetalle,
  };
}

export function scanErpCommitments({
  payrolls = [],
  f29,
  productionBudgets = [],
  productionOrders = [],
  dtes = [],
  leases = [],
  cashAccounts = [],
  chequesCartera = [],
  chequesEmitidos = [],
  deudasFinancieras = [],
  provisionesEgresos = [],
  existingMovements = [],
  accountingEntries = [],
  params = DEFAULT_CASH_FLOW_PARAMETERS,
}: {
  payrolls?: EmployeePayroll[];
  f29?: F29Declaration;
  productionBudgets?: ProductionBudget[];
  productionOrders?: ProductionOrder[];
  dtes?: DteDocument[];
  leases?: LeaseContract[];
  cashAccounts?: CashAccountConfig[];
  chequesCartera?: ChequeCartera[];
  chequesEmitidos?: ChequeEmitido[];
  deudasFinancieras?: DeudaFinanciera[];
  provisionesEgresos?: ProvisionEgreso[];
  existingMovements?: CashFlowMovement[];
  accountingEntries?: AccountingEntry[];
  params?: CashFlowInclusionParameters;
}): {
  scanResult: ErpCommitmentsScanResult;
  projectedMovements: CashFlowMovement[];
} {
  const safeExisting = Array.isArray(existingMovements) ? existingMovements : [];
  const safeEntries = Array.isArray(accountingEntries) ? accountingEntries : [];
  const safePayrolls = Array.isArray(payrolls) ? payrolls : [];
  const safeBudgets = Array.isArray(productionBudgets) ? productionBudgets : [];
  const safeOrders = Array.isArray(productionOrders) ? productionOrders : [];
  const safeDtes = Array.isArray(dtes) ? dtes : [];
  const safeLeases = Array.isArray(leases) ? leases : [];
  const safeChequesCartera = Array.isArray(chequesCartera) ? chequesCartera : [];
  const safeChequesEmitidos = Array.isArray(chequesEmitidos) ? chequesEmitidos : [];
  const safeDeudasFinancieras = Array.isArray(deudasFinancieras) ? deudasFinancieras : [];
  const safeProvisiones = Array.isArray(provisionesEgresos) ? provisionesEgresos : [];

  const newMovements: CashFlowMovement[] = [];

  // Helper to check existing
  const existsMovementWithRef = (refId: string) => {
    return safeExisting.some(m => m.documentoReferencia === refId || m.id === refId);
  };

  // 1. NÓMINA DE SUELDOS LÍQUIDOS (Fin de mes)
  const totalLiquidoMensual = safePayrolls.reduce((sum, p) => sum + (p.sueldoLiquido || 0), 0);
  const totalTrabajadores = safePayrolls.length;
  
  // Proyectar fin de mes actual y fin del mes siguiente
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth(); // 0-indexed

  // Fin de mes actual (ej: 2026-09-30)
  const lastDayCurrentMonth = new Date(currentYear, currentMonth + 1, 0);
  const fechaPagoNominaMes1 = lastDayCurrentMonth.toISOString().split('T')[0];

  // Fin de mes siguiente (ej: 2026-10-31)
  const lastDayNextMonth = new Date(currentYear, currentMonth + 2, 0);
  const fechaPagoNominaMes2 = lastDayNextMonth.toISOString().split('T')[0];

  if (totalLiquidoMensual > 0) {
    const refNomina1 = `nomina-${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    if (!existsMovementWithRef(refNomina1)) {
      newMovements.push({
        id: `mov-${refNomina1}`,
        fechaEstimada: fechaPagoNominaMes1,
        concepto: `Nómina Sueldos Líquidos Personal (${totalTrabajadores} colaboradores)`,
        contraparte: 'Plantilla de Colaboradores de la Empresa',
        montoNeto: totalLiquidoMensual,
        montoIva: 0,
        montoTotal: totalLiquidoMensual,
        moneda: 'CLP',
        tipo: 'EGRESO',
        categoria: 'REMUNERACIONES',
        estado: 'PENDIENTE',
        origenModulo: 'NOMINA',
        documentoReferencia: refNomina1,
        probabilidadCobroPct: 100,
        alertaRiesgo: 'Obligación Laboral Crítica (Art. 44 Código del Trabajo)',
      });
    }

    const refNomina2 = `nomina-${currentYear}-${String(currentMonth + 2).padStart(2, '0')}`;
    if (!existsMovementWithRef(refNomina2)) {
      newMovements.push({
        id: `mov-${refNomina2}`,
        fechaEstimada: fechaPagoNominaMes2,
        concepto: `Nómina Proyectada Sueldos Líquidos (${totalTrabajadores} colaboradores)`,
        contraparte: 'Plantilla de Colaboradores de la Empresa',
        montoNeto: totalLiquidoMensual,
        montoIva: 0,
        montoTotal: totalLiquidoMensual,
        moneda: 'CLP',
        tipo: 'EGRESO',
        categoria: 'REMUNERACIONES',
        estado: 'PENDIENTE',
        origenModulo: 'NOMINA',
        documentoReferencia: refNomina2,
        probabilidadCobroPct: 100,
        alertaRiesgo: 'Compromiso fijo recurrente',
      });
    }
  }

  // 2. PREVIRED E IMPOSICIONES / LEYES SOCIALES (Día 10 al 13 del mes siguiente)
  const totalAporteTrabajador = safePayrolls.reduce(
    (sum, p) => sum + (p.afpMonto || 0) + (p.saludMonto || 0) + (p.afcTrabajadorMonto || 0),
    0
  );
  const totalAportePatronal = safePayrolls.reduce(
    (sum, p) => sum + (p.sisEmpleadorMonto || 0) + (p.mutualEmpleadorMonto || 0) + ((p.sueldoBase * 0.024) || 0),
    0
  );
  const totalPreviredMensual = totalAporteTrabajador + totalAportePatronal;

  // Vencimiento Previred: Día 13 del mes siguiente
  const previredDateMes1 = new Date(currentYear, currentMonth + 1, 13).toISOString().split('T')[0];
  const previredDateMes2 = new Date(currentYear, currentMonth + 2, 13).toISOString().split('T')[0];

  if (totalPreviredMensual > 0) {
    const refPrevired1 = `previred-${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    if (!existsMovementWithRef(refPrevired1)) {
      newMovements.push({
        id: `mov-${refPrevired1}`,
        fechaEstimada: previredDateMes1,
        concepto: `Previred - Cotizaciones Previsionales y Leyes Sociales (${totalTrabajadores} trabajadores)`,
        contraparte: 'Previred / AFPs, Fonasa, Isapres, AFC y Mutualidades',
        montoNeto: Math.round(totalPreviredMensual),
        montoIva: 0,
        montoTotal: Math.round(totalPreviredMensual),
        moneda: 'CLP',
        tipo: 'EGRESO',
        categoria: 'PREVIRED_LEYES_SOCIALES',
        estado: 'PENDIENTE',
        origenModulo: 'PREVIRED',
        documentoReferencia: refPrevired1,
        probabilidadCobroPct: 100,
        alertaRiesgo: 'Vencimiento Legal Improrrogable (Ley 17.322 - Multas y reajustes)',
      });
    }

    const refPrevired2 = `previred-${currentYear}-${String(currentMonth + 2).padStart(2, '0')}`;
    if (!existsMovementWithRef(refPrevired2)) {
      newMovements.push({
        id: `mov-${refPrevired2}`,
        fechaEstimada: previredDateMes2,
        concepto: `Previred Proyectado - Leyes Sociales Período Siguiente`,
        contraparte: 'Previred / Instituciones de Seguridad Social',
        montoNeto: Math.round(totalPreviredMensual),
        montoIva: 0,
        montoTotal: Math.round(totalPreviredMensual),
        moneda: 'CLP',
        tipo: 'EGRESO',
        categoria: 'PREVIRED_LEYES_SOCIALES',
        estado: 'PENDIENTE',
        origenModulo: 'PREVIRED',
        documentoReferencia: refPrevired2,
        probabilidadCobroPct: 100,
      });
    }
  }

  // 3. F29 IMPUESTOS MENSUALES (Día 20 del mes siguiente)
  let f29Total = 0;
  let f29Iva = 0;
  let f29Ppm = 0;
  let f29Retenciones = 0;
  let periodoF29 = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
  const f29DueDate = new Date(currentYear, currentMonth + 1, 20).toISOString().split('T')[0];

  if (f29 && f29.totalAPagar > 0) {
    f29Total = f29.totalAPagar;
    f29Iva = f29.impuestoDeterminadoIva || 0;
    f29Ppm = f29.montoPpm || 0;
    f29Retenciones = (f29.retencionHonorariosSegundaCat || 0) + (f29.retencionImpuestoUnicoSueldos || 0);
    periodoF29 = f29.periodo || periodoF29;
  } else {
    // Estimación proyectada basada en DTEs del mes en curso
    const ventasNeto = safeDtes
      .filter(d => d.tipoOperacion === 'VENTA')
      .reduce((acc, d) => acc + d.montoNeto, 0);
    const debitoIva = safeDtes
      .filter(d => d.tipoOperacion === 'VENTA')
      .reduce((acc, d) => acc + d.montoIva, 0);
    const creditoIva = safeDtes
      .filter(d => d.tipoOperacion === 'COMPRA')
      .reduce((acc, d) => acc + d.montoIva, 0);
    
    f29Iva = Math.max(0, debitoIva - creditoIva);
    f29Ppm = Math.round(ventasNeto * 0.015); // Tasa PPM 1.5%
    f29Retenciones = 450000;
    f29Total = f29Iva + f29Ppm + f29Retenciones;
  }

  if (f29Total > 0) {
    const refF29 = `f29-${periodoF29}`;
    if (!existsMovementWithRef(refF29)) {
      newMovements.push({
        id: `mov-${refF29}`,
        fechaEstimada: f29DueDate,
        concepto: `TGR / F29 SII - Pago Impuestos Mensuales IVA & PPM (${periodoF29})`,
        contraparte: 'Tesorería General de la República (TGR)',
        montoNeto: f29Total,
        montoIva: 0,
        montoTotal: f29Total,
        moneda: 'CLP',
        tipo: 'EGRESO',
        categoria: 'IMPUESTOS_F29',
        estado: 'PENDIENTE',
        origenModulo: 'F29',
        documentoReferencia: refF29,
        probabilidadCobroPct: 100,
        alertaRiesgo: 'Vencimiento Tributario F29 SII (Día 20 vía Internet)',
      });
    }
  }

  // 4. HITOS DE PRESUPUESTOS DE PRODUCCIÓN APROBADOS
  const hitosPartidas: {
    folioPresupuesto: string;
    clienteNombre: string;
    hitoDescripcion: string;
    montoTotal: number;
    fechaEstimada: string;
    tipo: 'INGRESO' | 'EGRESO';
  }[] = [];

  let totalHitosCobro = 0;
  let totalInsumosComprometidos = 0;

  const approvedBudgets = safeBudgets.filter(b => b.estado === 'APROBADO');

  approvedBudgets.forEach(b => {
    const totalVentaBruta = Math.round(b.precioVentaNetoCliente * 1.19);
    const anticipoPct = 0.40; // 40% anticipo
    const saldoPct = 0.60; // 60% entrega

    const montoAnticipo = Math.round(totalVentaBruta * anticipoPct);
    const montoSaldo = totalVentaBruta - montoAnticipo;

    // Fecha anticipo: 5 días desde aprobación o fecha emisión
    const fechaAprobacionObj = new Date(b.fechaAprobacion || b.fechaEmision);
    const fechaAnticipo = new Date(fechaAprobacionObj.getTime() + 5 * 86400000).toISOString().split('T')[0];
    
    // Fecha saldo: fecha validez o entrega prevista
    const fechaSaldo = b.fechaValidez || new Date(fechaAprobacionObj.getTime() + 25 * 86400000).toISOString().split('T')[0];

    const refAnticipo = `presupuesto-${b.folio}-anticipo`;
    if (!existsMovementWithRef(refAnticipo)) {
      newMovements.push({
        id: `mov-${refAnticipo}`,
        fechaEstimada: fechaAnticipo,
        concepto: `Cobro Anticipo (40%) Presupuesto ${b.folio} - ${b.productoNombre}`,
        contraparte: b.clienteNombre,
        rutContraparte: b.clienteRut,
        montoNeto: Math.round(b.precioVentaNetoCliente * anticipoPct),
        montoIva: Math.round(b.precioVentaNetoCliente * anticipoPct * 0.19),
        montoTotal: montoAnticipo,
        moneda: 'CLP',
        tipo: 'INGRESO',
        categoria: 'PRODUCCION_HITO_VENTA',
        estado: 'PENDIENTE',
        origenModulo: 'PRESUPUESTO_PRODUCCION',
        documentoReferencia: refAnticipo,
        probabilidadCobroPct: 95,
      });

      hitosPartidas.push({
        folioPresupuesto: b.folio,
        clienteNombre: b.clienteNombre,
        hitoDescripcion: `Anticipo 40% (${b.productoNombre})`,
        montoTotal: montoAnticipo,
        fechaEstimada: fechaAnticipo,
        tipo: 'INGRESO',
      });
      totalHitosCobro += montoAnticipo;
    }

    const refSaldo = `presupuesto-${b.folio}-saldo`;
    if (!existsMovementWithRef(refSaldo)) {
      newMovements.push({
        id: `mov-${refSaldo}`,
        fechaEstimada: fechaSaldo,
        concepto: `Cobro Saldo Final (60% contra entrega) Presupuesto ${b.folio} - ${b.productoNombre}`,
        contraparte: b.clienteNombre,
        rutContraparte: b.clienteRut,
        montoNeto: Math.round(b.precioVentaNetoCliente * saldoPct),
        montoIva: Math.round(b.precioVentaNetoCliente * saldoPct * 0.19),
        montoTotal: montoSaldo,
        moneda: 'CLP',
        tipo: 'INGRESO',
        categoria: 'PRODUCCION_HITO_VENTA',
        estado: 'PENDIENTE',
        origenModulo: 'PRESUPUESTO_PRODUCCION',
        documentoReferencia: refSaldo,
        probabilidadCobroPct: 90,
      });

      hitosPartidas.push({
        folioPresupuesto: b.folio,
        clienteNombre: b.clienteNombre,
        hitoDescripcion: `Saldo Final 60% (${b.productoNombre})`,
        montoTotal: montoSaldo,
        fechaEstimada: fechaSaldo,
        tipo: 'INGRESO',
      });
      totalHitosCobro += montoSaldo;
    }

    // Insumos Comprometidos (Egreso a Proveedores de Materiales MPD)
    if (b.costoTotalMpd > 0) {
      const refInsumos = `presupuesto-${b.folio}-insumos`;
      const fechaCompraInsumos = new Date(fechaAprobacionObj.getTime() + 8 * 86400000).toISOString().split('T')[0];
      const costoMpdBruto = Math.round(b.costoTotalMpd * 1.19);

      if (!existsMovementWithRef(refInsumos)) {
        newMovements.push({
          id: `mov-${refInsumos}`,
          fechaEstimada: fechaCompraInsumos,
          concepto: `Compra Insumos y Materias Primas MPD para ${b.folio} (${b.productoNombre})`,
          contraparte: 'Proveedores Industriales de Redes y Cabos',
          montoNeto: b.costoTotalMpd,
          montoIva: Math.round(b.costoTotalMpd * 0.19),
          montoTotal: costoMpdBruto,
          moneda: 'CLP',
          tipo: 'EGRESO',
          categoria: 'PRODUCCION_INSUMOS_COMPRA',
          estado: 'PENDIENTE',
          origenModulo: 'PRESUPUESTO_PRODUCCION',
          documentoReferencia: refInsumos,
          probabilidadCobroPct: 100,
        });

        hitosPartidas.push({
          folioPresupuesto: b.folio,
          clienteNombre: 'Proveedores Insumos',
          hitoDescripcion: `Adquisición MPD para ${b.folio}`,
          montoTotal: costoMpdBruto,
          fechaEstimada: fechaCompraInsumos,
          tipo: 'EGRESO',
        });
        totalInsumosComprometidos += costoMpdBruto;
      }
    }
  });

  // 5. ÓRDENES DE PRODUCCIÓN ACTIVAS EN TALLER
  const activeOrders = safeOrders.filter(o => o.estado === 'EN_PROCESO' || o.estado === 'PLANIFICADA');
  activeOrders.forEach(o => {
    // Si la OP no proviene de un presupuesto ya incorporado
    const refOpCobro = `op-${o.folioOP}-entrega`;
    if (!o.presupuestoFolio && o.precioVentaEstimado && !existsMovementWithRef(refOpCobro)) {
      const montoBruto = Math.round(o.precioVentaEstimado * 1.19);
      newMovements.push({
        id: `mov-${refOpCobro}`,
        fechaEstimada: o.fechaEstimadaTermino,
        concepto: `Liquidación y Entrega Orden de Trabajo ${o.folioOP} (${o.productoNombre})`,
        contraparte: o.clienteNombre || 'Cliente Mandante OP',
        montoNeto: o.precioVentaEstimado,
        montoIva: Math.round(o.precioVentaEstimado * 0.19),
        montoTotal: montoBruto,
        moneda: 'CLP',
        tipo: 'INGRESO',
        categoria: 'PRODUCCION_HITO_VENTA',
        estado: 'PENDIENTE',
        origenModulo: 'ORDEN_PRODUCCION',
        documentoReferencia: refOpCobro,
        probabilidadCobroPct: 90,
      });
    }
  });

  // 6. FACTURAS DE VENTA Y COMPRA PENDIENTES DEL RCV / SII
  let ventasPorCobrarCount = 0;
  let ventasPorCobrarTotal = 0;
  let comprasPorPagarCount = 0;
  let comprasPorPagarTotal = 0;

  safeDtes.forEach(d => {
    if (d.estadoPago === 'PENDIENTE') {
      const refDte = `dte-${d.tipoOperacion}-${d.folio}`;
      const isAlreadyIn = safeExisting.some(
        m => m.dteFolioAsociado === d.folio || m.documentoReferencia === refDte || m.concepto.includes(String(d.folio))
      );

      if (!isAlreadyIn) {
        const fechaRealDte = d.fechaVencimiento || d.fechaEmision || new Date().toISOString().split('T')[0];
        if (d.tipoOperacion === 'VENTA') {
          ventasPorCobrarCount++;
          ventasPorCobrarTotal += d.montoTotal;
          newMovements.push({
            id: `mov-${refDte}`,
            fechaEstimada: fechaRealDte,
            concepto: `Cobro Factura Venta N° ${d.folio} - ${d.razonSocialContraparte}`,
            contraparte: d.razonSocialContraparte,
            rutContraparte: d.rutContraparte,
            montoNeto: d.montoNeto,
            montoIva: d.montoIva,
            montoTotal: d.montoTotal,
            moneda: 'CLP',
            tipo: 'INGRESO',
            categoria: 'VENTAS_OPERACIONALES',
            estado: 'FACTURADO',
            dteFolioAsociado: d.folio,
            origenModulo: 'DTE_SII',
            documentoReferencia: refDte,
            probabilidadCobroPct: 95,
          });
        } else if (d.tipoOperacion === 'COMPRA') {
          comprasPorPagarCount++;
          comprasPorPagarTotal += d.montoTotal;
          newMovements.push({
            id: `mov-${refDte}`,
            fechaEstimada: fechaRealDte,
            concepto: `Pago Factura Proveedor N° ${d.folio} - ${d.razonSocialContraparte}`,
            contraparte: d.razonSocialContraparte,
            rutContraparte: d.rutContraparte,
            montoNeto: d.montoNeto,
            montoIva: d.montoIva,
            montoTotal: d.montoTotal,
            moneda: 'CLP',
            tipo: 'EGRESO',
            categoria: 'PROVEEDORES',
            estado: 'FACTURADO',
            dteFolioAsociado: d.folio,
            origenModulo: 'DTE_SII',
            documentoReferencia: refDte,
            probabilidadCobroPct: 100,
          });
        }
      }
    }
  });

  // 6.b COMPROMISOS DE ASIENTOS CONTABLES AUXILIARES (CxC 1.1.03 Y CxP 2.1.01)
  let cxcPendientesCount = 0;
  let cxcPendientesTotal = 0;
  let cxpPendientesCount = 0;
  let cxpPendientesTotal = 0;
  const partidasAsientos: {
    cuentaCodigo: string;
    cuentaNombre: string;
    rutAuxiliar?: string;
    documentoRef?: string;
    fechaVencimiento: string;
    monto: number;
    tipo: 'INGRESO' | 'EGRESO';
  }[] = [];

  safeEntries.forEach(entry => {
    (entry.lineas || []).forEach(line => {
      const cod = (line.cuentaCodigo || '').trim();
      const debe = Number(line.debe || 0);
      const haber = Number(line.haber || 0);
      const docRef = (line.documentoRef || entry.documento || (entry as any).documentoReferencia || '').trim();
      const folioRef = line.folioDocumentoRef || (entry as any).folioDocumentoRef;

      // Evitar duplicar si coincide con un DTE ya mapeado
      const isLinkedToDte = safeDtes.some(d =>
        (folioRef && String(d.folio) === String(folioRef)) ||
        (docRef && docRef.includes(String(d.folio)))
      );
      if (isLinkedToDte) return;

      // Cuentas por Cobrar / Clientes (1.1.03)
      if (cod.startsWith('1.1.03') && debe > haber) {
        const saldoCxc = debe - haber;
        const refEntry = `asiento-cxc-${entry.id}-${line.id || Math.random().toString(36).substring(2, 7)}`;
        if (!existsMovementWithRef(refEntry) && (!docRef || !existsMovementWithRef(docRef))) {
          cxcPendientesCount++;
          cxcPendientesTotal += saldoCxc;
          const fechaVencReal = line.fechaVencimientoRef || line.fechaDocumentoRef || entry.fecha || new Date().toISOString().split('T')[0];
          newMovements.push({
            id: `mov-${refEntry}`,
            fechaEstimada: fechaVencReal,
            concepto: `Cobro Auxiliar ${line.cuentaNombre || 'Clientes'} - Doc: ${docRef || entry.concepto}`,
            contraparte: line.rutAuxiliar || entry.concepto,
            rutContraparte: line.rutAuxiliar,
            montoNeto: Math.round(saldoCxc / 1.19),
            montoIva: Math.round(saldoCxc - (saldoCxc / 1.19)),
            montoTotal: saldoCxc,
            moneda: 'CLP',
            tipo: 'INGRESO',
            categoria: 'VENTAS_OPERACIONALES',
            estado: 'PENDIENTE',
            origenModulo: 'CONTABILIDAD',
            documentoReferencia: docRef || refEntry,
            probabilidadCobroPct: 90,
          });
          partidasAsientos.push({
            cuentaCodigo: cod,
            cuentaNombre: line.cuentaNombre || 'Clientes / Cuentas por Cobrar',
            rutAuxiliar: line.rutAuxiliar,
            documentoRef: docRef,
            fechaVencimiento: fechaVencReal,
            monto: saldoCxc,
            tipo: 'INGRESO',
          });
        }
      }

      // Cuentas por Pagar / Proveedores (2.1.01)
      if (cod.startsWith('2.1.01') && haber > debe) {
        const saldoCxp = haber - debe;
        const refEntry = `asiento-cxp-${entry.id}-${line.id || Math.random().toString(36).substring(2, 7)}`;
        if (!existsMovementWithRef(refEntry) && (!docRef || !existsMovementWithRef(docRef))) {
          cxpPendientesCount++;
          cxpPendientesTotal += saldoCxp;
          const fechaVencReal = line.fechaVencimientoRef || line.fechaDocumentoRef || entry.fecha || new Date().toISOString().split('T')[0];
          newMovements.push({
            id: `mov-${refEntry}`,
            fechaEstimada: fechaVencReal,
            concepto: `Pago Auxiliar ${line.cuentaNombre || 'Proveedores'} - Doc: ${docRef || entry.concepto}`,
            contraparte: line.rutAuxiliar || entry.concepto,
            rutContraparte: line.rutAuxiliar,
            montoNeto: Math.round(saldoCxp / 1.19),
            montoIva: Math.round(saldoCxp - (saldoCxp / 1.19)),
            montoTotal: saldoCxp,
            moneda: 'CLP',
            tipo: 'EGRESO',
            categoria: 'PROVEEDORES',
            estado: 'PENDIENTE',
            origenModulo: 'CONTABILIDAD',
            documentoReferencia: docRef || refEntry,
            probabilidadCobroPct: 100,
          });
          partidasAsientos.push({
            cuentaCodigo: cod,
            cuentaNombre: line.cuentaNombre || 'Proveedores / Cuentas por Pagar',
            rutAuxiliar: line.rutAuxiliar,
            documentoRef: docRef,
            fechaVencimiento: fechaVencReal,
            monto: saldoCxp,
            tipo: 'EGRESO',
          });
        }
      }
    });
  });

  // 7. ARRIENDOS Y CONTRATOS IFRS 16
  safeLeases.forEach(l => {
    const refLease = `lease-${l.id}-${currentYear}-${currentMonth + 1}`;
    const fechaCanon = new Date(currentYear, currentMonth + 1, 5).toISOString().split('T')[0];
    const mensual = Number(l.montoMensualClp || l.montoCanonMensual) || 0;
    // Sin canon registrado no se proyecta pago (antes $1.200.000 supuesto)
    if (mensual > 0 && !existsMovementWithRef(refLease)) {
      const canonTotal = Math.round(mensual * 1.19);
      newMovements.push({
        id: `mov-${refLease}`,
        fechaEstimada: fechaCanon,
        concepto: `Canon Arriendo Inmobiliario / Maquinaria (${l.nombreBien || l.inmuebleDescripcion || 'Inmueble Operacional'})`,
        contraparte: l.arrendadorNombre || 'Arrendador Inmueble',
        montoNeto: mensual,
        montoIva: Math.round(mensual * 0.19),
        montoTotal: canonTotal,
        moneda: 'CLP',
        tipo: 'EGRESO',
        categoria: 'ARRIENDOS',
        estado: 'PENDIENTE',
        origenModulo: 'LEASING_IFRS16',
        documentoReferencia: refLease,
        probabilidadCobroPct: 100,
      });
    }
  });

  // 8. PROYECCIÓN DE VENTAS EN BASE A LA HISTORIA RCV
  if (params.incluirVentasProyectadasHistoria !== false) {
    const historicalAnalysis = analyzeHistoricalSales(safeDtes);
    const growthMult = 1 + (params.tasaCrecimientoVentasPct || 0) / 100;
    const monthlyGrossSales = Math.round(historicalAnalysis.promedioMensualVentasBruto * growthMult);
    const pctContado = (params.pctVentasContado ?? 30) / 100;
    const pctCredito = Math.max(0, 1 - pctContado);

    // Mes 1 Contado (15 del mes actual)
    const refHistVta1Contado = `vta-hist-${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-contado`;
    if (!existsMovementWithRef(refHistVta1Contado)) {
      const montoContado = Math.round(monthlyGrossSales * pctContado);
      newMovements.push({
        id: `mov-${refHistVta1Contado}`,
        fechaEstimada: new Date(currentYear, currentMonth, 15).toISOString().split('T')[0],
        concepto: `Proyección Ventas Contado s/ Historial RCV (${params.pctVentasContado ?? 30}% de ${Math.round(monthlyGrossSales / 1000000)}M)`,
        contraparte: 'Cartera Clientes Recurrentes (Venta Directa / POS)',
        montoNeto: Math.round(montoContado / 1.19),
        montoIva: montoContado - Math.round(montoContado / 1.19),
        montoTotal: montoContado,
        moneda: 'CLP',
        tipo: 'INGRESO',
        categoria: 'VENTAS_OPERACIONALES',
        estado: 'PENDIENTE',
        origenModulo: 'MANUAL',
        documentoReferencia: refHistVta1Contado,
        probabilidadCobroPct: 90,
      });
    }

    // Mes 1 Crédito (Cobro en Mes 2)
    const refHistVta1Credito = `vta-hist-${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-credito`;
    if (!existsMovementWithRef(refHistVta1Credito)) {
      const montoCredito = Math.round(monthlyGrossSales * pctCredito);
      newMovements.push({
        id: `mov-${refHistVta1Credito}`,
        fechaEstimada: new Date(currentYear, currentMonth + 1, 15).toISOString().split('T')[0],
        concepto: `Cobranza Proyectada Ventas a Crédito 30d s/ Historia (${Math.round(pctCredito * 100)}%)`,
        contraparte: 'Clientes Crédito 30 días s/ Histórico RCV',
        montoNeto: Math.round(montoCredito / 1.19),
        montoIva: montoCredito - Math.round(montoCredito / 1.19),
        montoTotal: montoCredito,
        moneda: 'CLP',
        tipo: 'INGRESO',
        categoria: 'VENTAS_OPERACIONALES',
        estado: 'PENDIENTE',
        origenModulo: 'MANUAL',
        documentoReferencia: refHistVta1Credito,
        probabilidadCobroPct: 85,
      });
    }

    // Mes 2 Contado
    const refHistVta2Contado = `vta-hist-${currentYear}-${String(currentMonth + 2).padStart(2, '0')}-contado`;
    if (!existsMovementWithRef(refHistVta2Contado)) {
      const montoContado = Math.round(monthlyGrossSales * pctContado);
      newMovements.push({
        id: `mov-${refHistVta2Contado}`,
        fechaEstimada: new Date(currentYear, currentMonth + 1, 15).toISOString().split('T')[0],
        concepto: `Proyección Ventas Contado Mes Siguiente s/ Historial RCV`,
        contraparte: 'Cartera Clientes Recurrentes (Venta Directa)',
        montoNeto: Math.round(montoContado / 1.19),
        montoIva: montoContado - Math.round(montoContado / 1.19),
        montoTotal: montoContado,
        moneda: 'CLP',
        tipo: 'INGRESO',
        categoria: 'VENTAS_OPERACIONALES',
        estado: 'PENDIENTE',
        origenModulo: 'MANUAL',
        documentoReferencia: refHistVta2Contado,
        probabilidadCobroPct: 90,
      });
    }
  }

  // 9. REPOSICIÓN DE FONDOS FIJOS Y CAJA CHICA
  if (params.incluirGastosFondoFijo !== false) {
    const refFondoFijo1 = `fondo-fijo-${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    if (!existsMovementWithRef(refFondoFijo1)) {
      newMovements.push({
        id: `mov-${refFondoFijo1}`,
        fechaEstimada: new Date(currentYear, currentMonth, 10).toISOString().split('T')[0],
        concepto: `Reposición Fondos Fijos y Cajas Chicas (Planta Quellón y Oficina)`,
        contraparte: 'Custodios de Fondos Fijos / Rendiciones Operacionales',
        montoNeto: 1200000,
        montoIva: 0,
        montoTotal: 1200000,
        moneda: 'CLP',
        tipo: 'EGRESO',
        categoria: 'PROVEEDORES',
        estado: 'PENDIENTE',
        origenModulo: 'MANUAL',
        documentoReferencia: refFondoFijo1,
        probabilidadCobroPct: 100,
      });
    }
  }

  // 10. CHEQUES EN CARTERA POR COBRAR (Custodia de documentos a fecha de clientes)
  const partidasChequesCartera: { numeroCheque: string; bancoEmisor: string; giradorNombre: string; fechaCobro: string; monto: number }[] = [];
  let totalChequesCarteraMonto = 0;

  if (params.incluirChequesCartera !== false) {
    const pendingChequesCartera = safeChequesCartera.filter(c => c.estado === 'EN_CARTERA');
    pendingChequesCartera.forEach(c => {
      totalChequesCarteraMonto += c.monto;
      partidasChequesCartera.push({
        numeroCheque: c.numeroCheque,
        bancoEmisor: c.bancoEmisor,
        giradorNombre: c.giradorNombre,
        fechaCobro: c.fechaCobro,
        monto: c.monto,
      });

      const refCheque = `chq-cart-${c.id}`;
      if (!existsMovementWithRef(refCheque)) {
        newMovements.push({
          id: `mov-${refCheque}`,
          fechaEstimada: c.fechaCobro,
          concepto: `Depósito Cheque en Cartera N° ${c.numeroCheque} (${c.bancoEmisor}) - ${c.giradorNombre}`,
          contraparte: c.giradorNombre,
          rutContraparte: c.giradorRut,
          montoNeto: c.monto,
          montoIva: 0,
          montoTotal: c.monto,
          moneda: c.moneda,
          tipo: 'INGRESO',
          categoria: 'CHEQUE_CARTERA_COBRO',
          estado: 'PENDIENTE',
          origenModulo: 'CHEQUES_CARTERA',
          documentoReferencia: refCheque,
          probabilidadCobroPct: 98,
          alertaRiesgo: 'Documento en Custodia - Fecha de Depósito',
        });
      }
    });
  }

  // 11. CHEQUES EMITIDOS POR PAGAR (Cheques a fecha girados a proveedores)
  const partidasChequesEmitidos: { numeroCheque: string; bancoNombre: string; beneficiarioNombre: string; fechaPago: string; monto: number }[] = [];
  let totalChequesEmitidosMonto = 0;

  if (params.incluirChequesEmitidos !== false) {
    const pendingChequesEmitidos = safeChequesEmitidos.filter(c => c.estado === 'GIRADO_PENDIENTE');
    pendingChequesEmitidos.forEach(c => {
      totalChequesEmitidosMonto += c.monto;
      partidasChequesEmitidos.push({
        numeroCheque: c.numeroCheque,
        bancoNombre: c.bancoNombre,
        beneficiarioNombre: c.beneficiarioNombre,
        fechaPago: c.fechaPago,
        monto: c.monto,
      });

      const refCheque = `chq-emit-${c.id}`;
      if (!existsMovementWithRef(refCheque)) {
        newMovements.push({
          id: `mov-${refCheque}`,
          fechaEstimada: c.fechaPago,
          concepto: `Cobro Cheque Emitido N° ${c.numeroCheque} (${c.bancoNombre}) a ${c.beneficiarioNombre}`,
          contraparte: c.beneficiarioNombre,
          rutContraparte: c.beneficiarioRut,
          montoNeto: c.monto,
          montoIva: 0,
          montoTotal: c.monto,
          moneda: c.moneda,
          tipo: 'EGRESO',
          categoria: 'CHEQUE_EMITIDO_PAGO',
          estado: 'PENDIENTE',
          origenModulo: 'CHEQUES_EMITIDOS',
          documentoReferencia: refCheque,
          probabilidadCobroPct: 100,
          alertaRiesgo: 'Cheque Diferido - Provisión de Fondos en Cuenta Corriente',
        });
      }
    });
  }

  // 12. DEUDAS CON INSTITUCIONES FINANCIERAS (Créditos Comerciales, Leasing, Pagarés)
  const partidasDeudaFinanciera: { institucion: string; operacion: string; numeroCuota: number; fechaVencimiento: string; montoCuota: number }[] = [];
  let totalDeudaFinancieraMonto = 0;

  if (params.incluirDeudaFinanciera !== false) {
    const activeDebts = safeDeudasFinancieras.filter(d => d.estado === 'VIGENTE');
    activeDebts.forEach(d => {
      (d.cuotas || []).filter(c => c.estado === 'PENDIENTE').forEach(c => {
        totalDeudaFinancieraMonto += c.montoCuota;
        partidasDeudaFinanciera.push({
          institucion: d.institucionFinanciera,
          operacion: d.numeroOperacion,
          numeroCuota: c.numeroCuota,
          fechaVencimiento: c.fechaVencimiento,
          montoCuota: c.montoCuota,
        });

        const refDeudaCuota = `deuda-${d.id}-cuota-${c.numeroCuota}`;
        if (!existsMovementWithRef(refDeudaCuota)) {
          newMovements.push({
            id: `mov-${refDeudaCuota}`,
            fechaEstimada: c.fechaVencimiento,
            concepto: `Cuota ${c.numeroCuota} ${d.tipoCredito.replace(/_/g, ' ')} - ${d.institucionFinanciera} (Op: ${d.numeroOperacion})`,
            contraparte: d.institucionFinanciera,
            montoNeto: c.montoCapital,
            montoIva: c.montoInteres,
            montoTotal: c.montoCuota,
            moneda: 'CLP',
            tipo: 'EGRESO',
            categoria: 'DEUDA_FINANCIERA_CUOTA',
            estado: 'PENDIENTE',
            origenModulo: 'DEUDA_FINANCIERA',
            documentoReferencia: refDeudaCuota,
            probabilidadCobroPct: 100,
            alertaRiesgo: 'Vencimiento Obligación Financiera Bancaria',
          });
        }
      });
    });
  }

  // 13. PROVISIONES DE EGRESOS (Gratificaciones, IAS, Honorarios devengados, Mantenciones)
  const partidasProvisiones: { concepto: string; tipo: any; fechaEstimadaPago: string; montoEstimado: number }[] = [];
  let totalProvisionesMonto = 0;

  if (params.incluirProvisionesEgresos !== false) {
    const pendingProvisions = safeProvisiones.filter(p => p.estado === 'PENDIENTE');
    pendingProvisions.forEach(p => {
      const esAfectoIva = p.afectacionIva === 'AFECTO_IVA_19';
      const tasaIva = p.tasaIvaPct !== undefined ? p.tasaIvaPct : 19;
      const montoNeto = p.montoNeto !== undefined ? p.montoNeto : p.montoEstimado;
      const montoIva = p.montoIva !== undefined 
        ? p.montoIva 
        : (esAfectoIva ? Math.round(montoNeto * (tasaIva / 100)) : 0);
      const montoTotalCaja = p.montoTotal !== undefined 
        ? p.montoTotal 
        : (montoNeto + montoIva);

      totalProvisionesMonto += montoTotalCaja;
      partidasProvisiones.push({
        concepto: p.concepto,
        tipo: p.tipoProvision,
        fechaEstimadaPago: p.fechaEstimadaPago,
        montoEstimado: montoTotalCaja,
      });

      const refProv = `prov-${p.id}`;
      if (!existsMovementWithRef(refProv)) {
        newMovements.push({
          id: `mov-${refProv}`,
          fechaEstimada: p.fechaEstimadaPago,
          concepto: p.concepto,
          contraparte: p.proveedorNombre || `Provisión ${p.tipoProvision.replace(/_/g, ' ')}`,
          rutContraparte: p.proveedorRut,
          montoNeto: montoNeto,
          montoIva: montoIva,
          montoTotal: montoTotalCaja,
          moneda: 'CLP',
          tipo: 'EGRESO',
          categoria: 'PROVISION_EGRESO',
          estado: 'PENDIENTE',
          origenModulo: 'PROVISIONES',
          documentoReferencia: refProv,
          probabilidadCobroPct: p.probabilidadMaterializacionPct || 90,
          alertaRiesgo: p.naturaleza === 'EXTRACONTABLE' 
            ? 'Partida Presupuestaria Extracontable' 
            : 'Provisión Pasivo Estimado Devengado',
        });
      }
    });
  }

  const scanResult: ErpCommitmentsScanResult = {
    nominaSueldos: {
      totalTrabajadores,
      totalLiquidoMensual,
      fechaPagoEstimada: fechaPagoNominaMes1,
      proyectado: totalLiquidoMensual > 0 && params.incluirNominaSueldos !== false,
    },
    previredLeyesSociales: {
      totalAporteTrabajador,
      totalAportePatronal,
      totalPreviredMensual,
      fechaVencimientoPrevired: previredDateMes1,
      proyectado: totalPreviredMensual > 0 && params.incluirPreviredLeyesSociales !== false,
    },
    f29Impuestos: {
      periodoFiscal: periodoF29,
      montoIvaDeterminado: f29Iva,
      montoPpm: f29Ppm,
      retenciones: f29Retenciones,
      totalAPagarF29: f29Total,
      fechaVencimientoF29: f29DueDate,
      proyectado: f29Total > 0 && params.incluirF29Impuestos !== false,
    },
    produccionHitos: {
      totalPresupuestosAprobados: approvedBudgets.length,
      montoTotalHitosCobro: totalHitosCobro,
      montoTotalInsumosComprometidos: totalInsumosComprometidos,
      partidasHitos: hitosPartidas,
    },
    dtesPendientes: {
      ventasPorCobrarCount,
      ventasPorCobrarTotal,
      comprasPorPagarCount,
      comprasPorPagarTotal,
    },
    chequesCartera: {
      totalCheques: partidasChequesCartera.length,
      montoTotalCobro: totalChequesCarteraMonto,
      partidas: partidasChequesCartera,
    },
    chequesEmitidos: {
      totalCheques: partidasChequesEmitidos.length,
      montoTotalPago: totalChequesEmitidosMonto,
      partidas: partidasChequesEmitidos,
    },
    deudaFinanciera: {
      totalOperaciones: safeDeudasFinancieras.filter(d => d.estado === 'VIGENTE').length,
      montoTotalCuotasPendientes: totalDeudaFinancieraMonto,
      partidas: partidasDeudaFinanciera,
    },
    provisionesEgresos: {
      totalProvisiones: partidasProvisiones.length,
      montoTotalEstimado: totalProvisionesMonto,
      partidas: partidasProvisiones,
    },
    asientosAuxiliares: {
      cxcPendientesCount,
      cxcPendientesTotal,
      cxpPendientesCount,
      cxpPendientesTotal,
      partidas: partidasAsientos,
    },
    totalCompromisosIdentificados: newMovements.length,
  };

  return {
    scanResult,
    projectedMovements: newMovements,
  };
}

export function buildDailyCashFlowProjection(
  movements: CashFlowMovement[] = [],
  initialBalance: number = 0,
  horizon: number | CashFlowHorizonType = 60,
  scenario: 'BASE' | 'OPTIMISTA' | 'ESTRESADO' = 'BASE',
  safetyReserve: number = 2000000 // Colchón de seguridad mínimo recomendado
): {
  dailyTimeline: DailyCashFlowPoint[];
  weeklyTimeline: {
    semanaLabel: string;
    fechaInicio: string;
    fechaFin: string;
    ingresos: number;
    egresos: number;
    flujoNeto: number;
    saldoFinal: number;
    estaEnDeficit: boolean;
  }[];
  alert: LiquidityCrisisAlert | null;
  totalIngresosPeriodo: number;
  totalEgresosPeriodo: number;
  saldoFinalProyectado: number;
  saldoMinimo: number;
  fechaSaldoMinimo: string;
} {
  const safeMovs = Array.isArray(movements) ? movements : [];

  const getMultiplier = () => {
    if (scenario === 'OPTIMISTA') return { ing: 1.15, egr: 0.95 };
    if (scenario === 'ESTRESADO') return { ing: 0.70, egr: 1.10 };
    return { ing: 1.0, egr: 1.0 };
  };
  const mult = getMultiplier();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const daysOfWeek = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  // Determinar si es apertura por día del mes o por horizonte corrido
  const isMonthDayView = horizon === 'DIA_DEL_MES' || horizon === 'MES_COMPLETO';
  let startDate: Date;
  let totalDaysCount: number;

  if (isMonthDayView) {
    // Desde el día 1 del mes actual hasta el último día del mes actual
    startDate = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    totalDaysCount = lastDayOfMonth;
  } else if (horizon === 'PROXIMO_MES') {
    // Mes siguiente completo
    startDate = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const lastDayNextMonth = new Date(today.getFullYear(), today.getMonth() + 2, 0).getDate();
    totalDaysCount = lastDayNextMonth;
  } else {
    startDate = new Date(today.getTime());
    if (horizon === '15_DIAS' || horizon === 15) totalDaysCount = 15;
    else if (horizon === '30_DIAS' || horizon === 30) totalDaysCount = 30;
    else if (horizon === '60_DIAS' || horizon === 60) totalDaysCount = 60;
    else if (horizon === '90_DIAS' || horizon === 90) totalDaysCount = 90;
    else if (horizon === '1_ANIO' || horizon === 365) totalDaysCount = 365;
    else totalDaysCount = typeof horizon === 'number' ? horizon : 60;
  }

  const dailyPoints: DailyCashFlowPoint[] = [];
  let runningBalance = initialBalance;
  let totalIngresos = 0;
  let totalEgresos = 0;
  let saldoMinimo = initialBalance;
  let fechaSaldoMinimo = startDate.toISOString().split('T')[0];

  let firstDeficitDate: string | null = null;
  let daysToFirstDeficit: number | null = null;
  let maxDeficitAmount = 0;
  const causesMap: { [key: string]: number } = {};

  for (let i = 0; i < totalDaysCount; i++) {
    const currentDay = isMonthDayView
      ? new Date(startDate.getFullYear(), startDate.getMonth(), i + 1)
      : new Date(startDate.getTime() + i * 86400000);

    const dateStr = currentDay.toISOString().split('T')[0];
    const diaSemana = daysOfWeek[currentDay.getDay()];
    const saldoInicialDia = runningBalance;

    // Movimientos del día
    const dayMovements = safeMovs.filter(m => m.fechaEstimada === dateStr);

    let dayIngresos = 0;
    let dayEgresos = 0;
    const eventosClave: DailyCashFlowPoint['eventosClave'] = [];

    dayMovements.forEach(m => {
      if (m.tipo === 'INGRESO') {
        const adjustedAmount = Math.round(m.montoTotal * mult.ing);
        dayIngresos += adjustedAmount;
        eventosClave.push({
          concepto: m.concepto,
          tipo: 'INGRESO',
          monto: adjustedAmount,
          categoria: m.categoria,
        });
      } else {
        const adjustedAmount = Math.round(m.montoTotal * mult.egr);
        dayEgresos += adjustedAmount;
        eventosClave.push({
          concepto: m.concepto,
          tipo: 'EGRESO',
          monto: adjustedAmount,
          categoria: m.categoria,
        });
      }
    });

    const flujoNetoDia = dayIngresos - dayEgresos;
    runningBalance += flujoNetoDia;
    totalIngresos += dayIngresos;
    totalEgresos += dayEgresos;

    if (runningBalance < saldoMinimo) {
      saldoMinimo = runningBalance;
      fechaSaldoMinimo = dateStr;
    }

    const estaEnDeficit = runningBalance < 0;
    const quiebreCajaMonto = estaEnDeficit ? Math.abs(runningBalance) : 0;

    if (estaEnDeficit) {
      if (!firstDeficitDate) {
        firstDeficitDate = dateStr;
        daysToFirstDeficit = isMonthDayView
          ? Math.max(0, Math.round((currentDay.getTime() - today.getTime()) / 86400000))
          : i;
      }
      if (quiebreCajaMonto > maxDeficitAmount) {
        maxDeficitAmount = quiebreCajaMonto;
      }

      eventosClave.filter(e => e.tipo === 'EGRESO').forEach(e => {
        causesMap[e.concepto] = (causesMap[e.concepto] || 0) + e.monto;
      });
    }

    dailyPoints.push({
      fecha: dateStr,
      diaSemana,
      ingresosDia: dayIngresos,
      egresosDia: dayEgresos,
      flujoNetoDia,
      saldoProyectado: runningBalance,
      saldoInicialDia,
      estaEnDeficit,
      quiebreCajaMonto,
      eventosClave,
    });
  }

  // Group into weekly buckets
  const weeklyTimeline: {
    semanaLabel: string;
    fechaInicio: string;
    fechaFin: string;
    ingresos: number;
    egresos: number;
    flujoNeto: number;
    saldoFinal: number;
    estaEnDeficit: boolean;
  }[] = [];

  const chunkSize = 7;
  for (let i = 0; i < dailyPoints.length; i += chunkSize) {
    const chunk = dailyPoints.slice(i, i + chunkSize);
    if (chunk.length === 0) continue;
    const weekNum = Math.floor(i / chunkSize) + 1;
    const wIng = chunk.reduce((acc, d) => acc + d.ingresosDia, 0);
    const wEgr = chunk.reduce((acc, d) => acc + d.egresosDia, 0);
    const lastDay = chunk[chunk.length - 1];

    weeklyTimeline.push({
      semanaLabel: isMonthDayView ? `Semana ${weekNum} del Mes` : `Semana ${weekNum}`,
      fechaInicio: chunk[0].fecha,
      fechaFin: lastDay.fecha,
      ingresos: wIng,
      egresos: wEgr,
      flujoNeto: wIng - wEgr,
      saldoFinal: lastDay.saldoProyectado,
      estaEnDeficit: chunk.some(d => d.estaEnDeficit),
    });
  }

  // Construct Crisis Alert if deficit or near-deficit detected
  let alert: LiquidityCrisisAlert | null = null;
  if (firstDeficitDate && daysToFirstDeficit !== null) {
    const sortedCauses = Object.entries(causesMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([concept, amount]) => `${concept} (${amount.toLocaleString('es-CL')})`);

    const recomendaciones: string[] = [
      'Anticipar cobranza de facturas por cobrar del RCV mediante pronto pago comercial (descuento 2%) o factoring bancario.',
      'Diferir pagos no críticos de compras de insumos fabriles o pactar crédito a 60 días con proveedores principales.',
      'Gestionar crédito de capital de trabajo o línea de sobregiro con Santander/Banco de Chile por el monto del déficit proyectado.',
      'Acelerar la aprobación y facturación de hitos de entrega en Órdenes de Producción en curso.',
    ];

    const nivelGravedad = daysToFirstDeficit <= 10 ? 'CRITICO' : daysToFirstDeficit <= 25 ? 'ALERTA' : 'PRECAUCION';

    alert = {
      fechaQuiebre: firstDeficitDate,
      diasParaQuiebre: Math.max(0, daysToFirstDeficit),
      saldoMinimoProyectado: saldoMinimo,
      deficitMaximo: maxDeficitAmount,
      causasPrincipales: sortedCauses.length > 0 ? sortedCauses : ['Concurrencia de egresos operacionales y nómina'],
      accionesRecomendadas: recomendaciones,
      nivelGravedad,
    };
  } else if (saldoMinimo < safetyReserve) {
    alert = {
      fechaQuiebre: fechaSaldoMinimo,
      diasParaQuiebre: Math.max(1, Math.round((new Date(fechaSaldoMinimo).getTime() - today.getTime()) / 86400000)),
      saldoMinimoProyectado: saldoMinimo,
      deficitMaximo: safetyReserve - saldoMinimo,
      causasPrincipales: ['El saldo de caja proyectado se acerca peligrosamente al colchón mínimo de seguridad operacional ($2.000.000).'],
      accionesRecomendadas: [
        'Monitorear cobranzas de clientes con facturas vencidas.',
        'Evitar egresos extraordinarios fuera del presupuesto de producción.',
      ],
      nivelGravedad: 'PRECAUCION',
    };
  }

  return {
    dailyTimeline: dailyPoints,
    weeklyTimeline,
    alert,
    totalIngresosPeriodo: totalIngresos,
    totalEgresosPeriodo: totalEgresos,
    saldoFinalProyectado: runningBalance,
    saldoMinimo,
    fechaSaldoMinimo,
  };
}

// 10. PROYECCIÓN ANUAL A 12 MESES
export function buildAnnualCashFlowProjection({
  initialBalance = 0,
  historicalSales,
  payrolls = [],
  f29,
  leases = [],
  dtes = [],
  productionBudgets = [],
  chequesCartera = [],
  chequesEmitidos = [],
  deudasFinancieras = [],
  provisionesEgresos = [],
  params = DEFAULT_CASH_FLOW_PARAMETERS,
  scenario = 'BASE',
}: {
  initialBalance: number;
  historicalSales: HistoricalSalesAnalysis;
  payrolls?: EmployeePayroll[];
  f29?: F29Declaration;
  leases?: LeaseContract[];
  dtes?: DteDocument[];
  productionBudgets?: ProductionBudget[];
  chequesCartera?: ChequeCartera[];
  chequesEmitidos?: ChequeEmitido[];
  deudasFinancieras?: DeudaFinanciera[];
  provisionesEgresos?: ProvisionEgreso[];
  params?: CashFlowInclusionParameters;
  scenario?: 'BASE' | 'OPTIMISTA' | 'ESTRESADO';
}): {
  monthlyPoints: MonthlyCashFlowPoint[];
  totalIngresosAnio: number;
  totalEgresosAnio: number;
  totalIngresos12m?: number;
  totalEgresos12m?: number;
  flujoNetoAnio: number;
  saldoFinalAnio: number;
  saldoMinimoAnio: number;
  mesMinimo: string;
} {
  const getMultiplier = () => {
    if (scenario === 'OPTIMISTA') return { ing: 1.15, egr: 0.95 };
    if (scenario === 'ESTRESADO') return { ing: 0.70, egr: 1.10 };
    return { ing: 1.0, egr: 1.0 };
  };
  const mult = getMultiplier();

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth(); // 0-indexed

  const monthNames = [
    'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
    'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
  ];

  // 4.4: sin datos, cero (antes $14.850.000, $4.920.000, $1.850.000 y ventas $48.500.000 supuestos)
  const totalLiquidoMensual = (payrolls || []).reduce((s, p) => s + (p.sueldoLiquido || 0), 0);
  const totalPreviredMensual = (payrolls || []).reduce(
    (s, p) => s + (p.afpMonto || 0) + (p.saludMonto || 0) + (p.sisEmpleadorMonto || 0) + (p.mutualEmpleadorMonto || 0),
    0
  );
  const totalArriendosMensual = (leases || []).reduce((s, l) => s + (l.montoMensualClp || l.montoCanonMensual || 0), 0);

  const baseVentasBruto = historicalSales.promedioMensualVentasBruto || 0;
  const monthlyPoints: MonthlyCashFlowPoint[] = [];

  let runningBalance = initialBalance;
  let totalIngresosAnio = 0;
  let totalEgresosAnio = 0;
  let saldoMinimoAnio = initialBalance;
  let mesMinimo = `${monthNames[currentMonth]} ${currentYear}`;

  for (let m = 0; m < 12; m++) {
    const targetDate = new Date(currentYear, currentMonth + m, 1);
    const y = targetDate.getFullYear();
    const mo = targetDate.getMonth();
    const periodo = `${y}-${String(mo + 1).padStart(2, '0')}`;
    const mesLabel = `${monthNames[mo]} ${y}`;

    const growth = Math.pow(1 + (params.tasaCrecimientoVentasPct || 0) / 100, m / 12);
    const monthSales = Math.round(baseVentasBruto * growth * mult.ing);

    // Ingresos
    const ingresosVentasHistoria = params.incluirVentasProyectadasHistoria !== false ? monthSales : 0;
    
    // DTEs por cobrar que caen en este mes
    const dtesInMonth = (dtes || [])
      .filter(d => d.tipoOperacion === 'VENTA' && d.estadoPago === 'PENDIENTE')
      .filter(d => (d.fechaVencimiento || '').startsWith(periodo))
      .reduce((s, d) => s + d.montoTotal, 0);
    const ingresosDtes = params.incluirCobranzaDtePendientes !== false ? Math.round(dtesInMonth * mult.ing) : 0;

    // Hitos producción
    const hitosInMonth = (productionBudgets || [])
      .filter(b => b.estado === 'APROBADO')
      .reduce((s, b) => s + ((b.precioVentaNetoCliente || b.costoTotalInterno || 0) * 0.15), 0);
    const ingresosHitos = params.incluirHitosProduccion !== false && m < 4 ? Math.round(hitosInMonth * mult.ing) : 0;

    // Cheques en Cartera por Cobrar en este mes
    const chequesCarteraInMonth = (chequesCartera || [])
      .filter(c => c.estado === 'EN_CARTERA' && (c.fechaCobro || '').startsWith(periodo))
      .reduce((s, c) => s + c.monto, 0);
    const ingresosChequesCartera = params.incluirChequesCartera !== false ? Math.round(chequesCarteraInMonth * mult.ing) : 0;

    const ingresosTotales = ingresosVentasHistoria + ingresosDtes + ingresosHitos + ingresosChequesCartera;

    // Egresos
    const egresosNomina = params.incluirNominaSueldos !== false ? Math.round(totalLiquidoMensual * mult.egr) : 0;
    const egresosPrevired = params.incluirPreviredLeyesSociales !== false ? Math.round(totalPreviredMensual * mult.egr) : 0;
    
    // F29: IVA Débito ~19% de ventas - Crédito ~10% de compras + PPM ~1.5%
    const f29Estimado = Math.round(monthSales * 0.055);
    const egresosF29 = params.incluirF29Impuestos !== false ? Math.round(f29Estimado * mult.egr) : 0;

    // Proveedores e insumos: ~42% de ventas
    const provEstimado = Math.round(monthSales * 0.42);
    const egresosProveedores = params.incluirPagoProveedoresDte !== false ? Math.round(provEstimado * mult.egr) : 0;

    const egresosArriendos = params.incluirArriendosIfrs16 !== false ? Math.round(totalArriendosMensual * 1.19 * mult.egr) : 0;
    const egresosCajaFondoFijo = params.incluirGastosFondoFijo !== false ? 1200000 : 0;

    // Cheques Emitidos por Pagar en este mes
    const chequesEmitidosInMonth = (chequesEmitidos || [])
      .filter(c => c.estado === 'GIRADO_PENDIENTE' && (c.fechaPago || '').startsWith(periodo))
      .reduce((s, c) => s + c.monto, 0);
    const egresosChequesEmitidos = params.incluirChequesEmitidos !== false ? Math.round(chequesEmitidosInMonth * mult.egr) : 0;

    // Deudas con Instituciones Financieras (Cuotas que vencen en este mes)
    let deudasInMonth = 0;
    (deudasFinancieras || []).filter(d => d.estado === 'VIGENTE').forEach(d => {
      (d.cuotas || []).filter(c => c.estado === 'PENDIENTE' && (c.fechaVencimiento || '').startsWith(periodo)).forEach(c => {
        deudasInMonth += c.montoCuota;
      });
    });
    const egresosDeudaFinanciera = params.incluirDeudaFinanciera !== false ? Math.round(deudasInMonth * mult.egr) : 0;

    // Provisiones de Egresos a materializarse en este mes (Monto Bruto con IVA si aplica)
    const provisionesInMonth = (provisionesEgresos || [])
      .filter(p => p.estado === 'PENDIENTE' && (p.fechaEstimadaPago || '').startsWith(periodo))
      .reduce((s, p) => {
        const total = p.montoTotal !== undefined 
          ? p.montoTotal 
          : (p.afectacionIva === 'AFECTO_IVA_19' ? Math.round(p.montoEstimado * 1.19) : p.montoEstimado);
        return s + total;
      }, 0);
    const egresosProvisiones = params.incluirProvisionesEgresos !== false ? Math.round(provisionesInMonth * mult.egr) : 0;

    const egresosTotales = egresosNomina + egresosPrevired + egresosF29 + egresosProveedores + egresosArriendos + egresosCajaFondoFijo + egresosChequesEmitidos + egresosDeudaFinanciera + egresosProvisiones;

    const saldoInicial = runningBalance;
    const flujoNeto = ingresosTotales - egresosTotales;
    const saldoFinal = saldoInicial + flujoNeto;

    runningBalance = saldoFinal;
    totalIngresosAnio += ingresosTotales;
    totalEgresosAnio += egresosTotales;

    if (saldoFinal < saldoMinimoAnio) {
      saldoMinimoAnio = saldoFinal;
      mesMinimo = mesLabel;
    }

    monthlyPoints.push({
      periodo,
      mesLabel,
      mesAnio: periodo,
      numeroMes: m + 1,
      saldoInicial,
      ingresosTotales,
      totalIngresos: ingresosTotales,
      ingresosVentasHistoria,
      ventasHistoria: ingresosVentasHistoria,
      ingresosDtes,
      cobranzasDte: ingresosDtes,
      ingresosHitos,
      ingresosChequesCartera,
      chequesCartera: ingresosChequesCartera,
      egresosTotales,
      totalEgresos: egresosTotales,
      egresosProveedores,
      pagoProveedores: egresosProveedores,
      egresosNomina,
      nominaSueldos: egresosNomina,
      egresosPrevired,
      previredLeyesSociales: egresosPrevired,
      egresosF29,
      f29Impuestos: egresosF29,
      egresosArriendos,
      arriendos: egresosArriendos,
      egresosChequesEmitidos,
      chequesEmitidos: egresosChequesEmitidos,
      egresosDeudaFinanciera,
      deudaFinanciera: egresosDeudaFinanciera,
      egresosProvisiones,
      provisionesEgresos: egresosProvisiones,
      egresosCajaFondoFijo,
      flujoNeto,
      saldoFinal,
      estaEnDeficit: saldoFinal < 0,
    });
  }

  return {
    monthlyPoints,
    totalIngresosAnio,
    totalEgresosAnio,
    totalIngresos12m: totalIngresosAnio,
    totalEgresos12m: totalEgresosAnio,
    flujoNetoAnio: totalIngresosAnio - totalEgresosAnio,
    saldoFinalAnio: runningBalance,
    saldoMinimoAnio,
    mesMinimo,
  };
}
