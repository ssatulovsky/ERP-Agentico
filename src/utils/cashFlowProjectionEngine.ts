import {
  CashFlowMovement,
  BankAccountConfig,
  EmployeePayroll,
  F29Declaration,
  ProductionBudget,
  ProductionOrder,
  DteDocument,
  LeaseContract,
  DailyCashFlowPoint,
  LiquidityCrisisAlert,
  ErpCommitmentsScanResult,
} from '../types';

/**
 * Motor Agéntico de Proyección de Flujo de Caja y Liquidez
 * Conecta saldos reales de cuentas bancarias y proyecta compromisos del ERP:
 * - Nómina y Sueldos Líquidos (fin de mes)
 * - Previred e Imposiciones (día 10-13)
 * - F29 IVA y PPM (día 20)
 * - Hitos de Presupuestos de Producción y OPs
 * - DTEs del RCV (Facturas de Venta y Compra)
 * - Arriendos IFRS 16
 */

export function calculateConsolidatedBankBalance(bankAccounts: BankAccountConfig[] = []) {
  const safeAccounts = Array.isArray(bankAccounts) ? bankAccounts : [];
  const totalSaldo = safeAccounts.reduce((acc, b) => acc + (b.saldoEnLinea || 0), 0);
  
  const cuentas = safeAccounts.map(b => ({
    id: b.id,
    banco: b.banco,
    bancoCodigo: b.bancoCodigo,
    numero: b.numeroCuenta,
    tipo: b.tipoCuenta,
    moneda: b.moneda,
    saldo: b.saldoEnLinea || 0,
    estadoConexion: b.estadoConexion,
    esPrincipal: b.esPrincipal,
    ultimaSincronizacion: b.ultimaSincronizacion,
  }));

  return {
    totalSaldo,
    cuentas,
    cantidadCuentas: cuentas.length,
  };
}

export function scanErpCommitments({
  payrolls = [],
  f29,
  productionBudgets = [],
  productionOrders = [],
  dtes = [],
  leases = [],
  existingMovements = [],
}: {
  payrolls?: EmployeePayroll[];
  f29?: F29Declaration;
  productionBudgets?: ProductionBudget[];
  productionOrders?: ProductionOrder[];
  dtes?: DteDocument[];
  leases?: LeaseContract[];
  existingMovements?: CashFlowMovement[];
}): {
  scanResult: ErpCommitmentsScanResult;
  projectedMovements: CashFlowMovement[];
} {
  const safeExisting = Array.isArray(existingMovements) ? existingMovements : [];
  const safePayrolls = Array.isArray(payrolls) ? payrolls : [];
  const safeBudgets = Array.isArray(productionBudgets) ? productionBudgets : [];
  const safeOrders = Array.isArray(productionOrders) ? productionOrders : [];
  const safeDtes = Array.isArray(dtes) ? dtes : [];
  const safeLeases = Array.isArray(leases) ? leases : [];

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
        if (d.tipoOperacion === 'VENTA') {
          ventasPorCobrarCount++;
          ventasPorCobrarTotal += d.montoTotal;
          newMovements.push({
            id: `mov-${refDte}`,
            fechaEstimada: d.fechaVencimiento || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
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
            fechaEstimada: d.fechaVencimiento || new Date(Date.now() + 20 * 86400000).toISOString().split('T')[0],
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

  // 7. ARRIENDOS Y CONTRATOS IFRS 16
  safeLeases.forEach(l => {
    const refLease = `lease-${l.id}-${currentYear}-${currentMonth + 1}`;
    const fechaCanon = new Date(currentYear, currentMonth + 1, 5).toISOString().split('T')[0];
    const mensual = l.montoMensualClp || l.montoCanonMensual || 1200000;
    if (!existsMovementWithRef(refLease)) {
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

  const scanResult: ErpCommitmentsScanResult = {
    nominaSueldos: {
      totalTrabajadores,
      totalLiquidoMensual,
      fechaPagoEstimada: fechaPagoNominaMes1,
      proyectado: totalLiquidoMensual > 0,
    },
    previredLeyesSociales: {
      totalAporteTrabajador,
      totalAportePatronal,
      totalPreviredMensual,
      fechaVencimientoPrevired: previredDateMes1,
      proyectado: totalPreviredMensual > 0,
    },
    f29Impuestos: {
      periodoFiscal: periodoF29,
      montoIvaDeterminado: f29Iva,
      montoPpm: f29Ppm,
      retenciones: f29Retenciones,
      totalAPagarF29: f29Total,
      fechaVencimientoF29: f29DueDate,
      proyectado: f29Total > 0,
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
  daysHorizon: number = 60,
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

  // Create calendar days starting today
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dailyPoints: DailyCashFlowPoint[] = [];
  let runningBalance = initialBalance;
  let totalIngresos = 0;
  let totalEgresos = 0;
  let saldoMinimo = initialBalance;
  let fechaSaldoMinimo = today.toISOString().split('T')[0];

  let firstDeficitDate: string | null = null;
  let daysToFirstDeficit: number | null = null;
  let maxDeficitAmount = 0;
  const causesMap: { [key: string]: number } = {};

  const daysOfWeek = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  for (let i = 0; i <= daysHorizon; i++) {
    const currentDay = new Date(today.getTime() + i * 86400000);
    const dateStr = currentDay.toISOString().split('T')[0];
    const diaSemana = daysOfWeek[currentDay.getDay()];

    // Find movements on this day
    const dayMovements = safeMovs.filter(m => {
      const mDate = m.fechaEstimada;
      return mDate === dateStr;
    });

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
        daysToFirstDeficit = i;
      }
      if (quiebreCajaMonto > maxDeficitAmount) {
        maxDeficitAmount = quiebreCajaMonto;
      }

      // Record causes of high expenses
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
      semanaLabel: `Semana ${weekNum}`,
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
      .map(([concept, amount]) => `${concept} ($${amount.toLocaleString('es-CL')})`);

    const recomendaciones: string[] = [
      'Anticipar cobranza de facturas por cobrar del RCV mediante pronto pago comercial (descuento 2%) o factoring bancario.',
      'Diferir pagos no críticos de compras de insumos fabriles o pactar crédito a 60 días con proveedores principales.',
      'Gestionar crédito de capital de trabajo o línea de sobregiro con Santander/Banco de Chile por el monto del déficit proyectado.',
      'Acelerar la aprobación y facturación de hitos de entrega en Órdenes de Producción en curso.',
    ];

    const nivelGravedad = daysToFirstDeficit <= 10 ? 'CRITICO' : daysToFirstDeficit <= 25 ? 'ALERTA' : 'PRECAUCION';

    alert = {
      fechaQuiebre: firstDeficitDate,
      diasParaQuiebre: daysToFirstDeficit,
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
