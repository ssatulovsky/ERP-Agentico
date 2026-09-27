import {
  ProductionBudget,
  WarehouseWithdrawal,
  ProductionOrder,
  ProductionOrderClosureAnalysis,
} from '../types';

export const SEED_PRODUCTION_BUDGETS: ProductionBudget[] = [
  {
    id: 'pre-001',
    empresaId: 'client-mar-austral',
    folio: 'PRE-2026-039',
    clienteId: 'cli-001',
    clienteNombre: 'Pesquera Chiloé Ltda.',
    clienteRut: '77.654.321-K',
    contactoCliente: 'Ing. Rodrigo Cárdenas - Gerente de Operaciones',
    emailCliente: 'rodrigo.cardenas@pesquerachiloe.cl',
    fechaEmision: '2026-08-01',
    fechaValidez: '2026-08-30',
    estado: 'APROBADO',
    fechaEnvio: '2026-08-03',
    fechaAprobacion: '2026-08-10',
    productoNombre: 'Confección y Armado de Red Pecera HDPE 30x30x15m Reforzada',
    productoCodigo: 'PROD-RED-3030',
    categoria: 'REDES_Y_FONDEOS',
    unidadMedida: 'UNID',
    cantidad: 4,
    condicionesComerciales: '50% anticipo contra emisión de OC, 50% contra entrega conforme y pruebas de estanqueidad.',
    partidas: [
      {
        id: 'bp-001',
        tipo: 'MPD',
        insumoCodigo: 'MAT-HDPE-PAÑO',
        descripcion: 'Paño de Red HDPE Virgen Malla 1.5" x 500m2 (Alta Resistencia UV)',
        unidadMedida: 'ROLLO',
        cantidadPresupuestada: 4,
        costoUnitarioEstimado: 1450000,
        costoTotalEstimado: 5800000,
        precioUnitarioSugerido: 2250000,
        precioTotalVenta: 9000000,
        visibleParaCliente: true,
      },
      {
        id: 'bp-002',
        tipo: 'MPD',
        insumoCodigo: 'CAB-PERLON-24',
        descripcion: 'Cabo Perlón Virgen 24mm con Alma de Plomo para Relingas',
        unidadMedida: 'CARRETE',
        cantidadPresupuestada: 8,
        costoUnitarioEstimado: 325000,
        costoTotalEstimado: 2600000,
        precioUnitarioSugerido: 520000,
        precioTotalVenta: 4160000,
        visibleParaCliente: true,
      },
      {
        id: 'bp-003',
        tipo: 'MOD',
        descripcion: 'Mano de Obra Especializada Rederos (Corte, Armado, Relingado y Enmallado)',
        unidadMedida: 'HORAS',
        cantidadPresupuestada: 140,
        costoUnitarioEstimado: 13000,
        costoTotalEstimado: 1820000,
        precioUnitarioSugerido: 23500,
        precioTotalVenta: 3290000,
        visibleParaCliente: true,
      },
      {
        id: 'bp-004',
        tipo: 'CIF',
        descripcion: 'Desgaste y Amortización de Maquinarias de Termofusión y Costura Fabril',
        unidadMedida: 'GL',
        cantidadPresupuestada: 1,
        costoUnitarioEstimado: 450000,
        costoTotalEstimado: 450000,
        precioUnitarioSugerido: 0,
        precioTotalVenta: 0,
        visibleParaCliente: false, // COSTO INTERNO OCULTO AL CLIENTE
        notasInternas: 'Amortización interna de banco de prueba y cosedoras automáticas.',
      },
      {
        id: 'bp-005',
        tipo: 'CIF',
        descripcion: 'Consumo Eléctrico Industrial Trifásico y Combustible de Generador Melinka',
        unidadMedida: 'GL',
        cantidadPresupuestada: 1,
        costoUnitarioEstimado: 500000,
        costoTotalEstimado: 500000,
        precioUnitarioSugerido: 0,
        precioTotalVenta: 0,
        visibleParaCliente: false, // COSTO INTERNO OCULTO AL CLIENTE
        notasInternas: 'Prorrateo de energía de planta Quellón.',
      },
      {
        id: 'bp-006',
        tipo: 'CIF',
        descripcion: 'Inspección Técnica, Certificación de Estanqueidad y Pruebas Submarinas ROV',
        unidadMedida: 'SERVICIOS',
        cantidadPresupuestada: 1,
        costoUnitarioEstimado: 300000,
        costoTotalEstimado: 300000,
        precioUnitarioSugerido: 2050000,
        precioTotalVenta: 2050000,
        visibleParaCliente: true,
      },
    ],
    costoTotalMpd: 8400000,
    costoTotalMod: 1820000,
    costoTotalCif: 1250000,
    costoTotalInterno: 11470000,
    precioVentaNetoCliente: 18500000,
    margenBrutoEstimadoClp: 7030000,
    margenBrutoEstimadoPct: 38.0,
    markupPct: 61.29,
    ordenProduccionIdGenerada: 'op-101',
    folioOpGenerada: 'OP-2026-101',
    historialEnvio: [
      {
        fecha: '2026-08-03 10:15',
        remitente: 'ventas.tecnicas@mar-austral.cl',
        destinatario: 'rodrigo.cardenas@pesquerachiloe.cl',
        observaciones: 'Propuesta técnica comercial enviada con especificaciones de malla y resistencia a tracción.',
      },
      {
        fecha: '2026-08-10 16:40',
        remitente: 'rodrigo.cardenas@pesquerachiloe.cl',
        destinatario: 'ventas.tecnicas@mar-austral.cl',
        observaciones: 'Cliente aprueba cotización mediante Orden de Compra N° OC-8841. Se emite OT/OP-2026-101.',
      },
    ],
  },
  {
    id: 'pre-002',
    empresaId: 'client-mar-austral',
    folio: 'PRE-2026-042',
    clienteId: 'cli-002',
    clienteNombre: 'Salmones Austral S.A.',
    clienteRut: '76.321.908-5',
    contactoCliente: 'Carlos Donoso - Jefe de Mantenimiento y Fondeos',
    emailCliente: 'cdonoso@salmonesaustral.cl',
    fechaEmision: '2026-09-02',
    fechaValidez: '2026-09-30',
    estado: 'ENVIADO',
    fechaEnvio: '2026-09-04',
    productoNombre: 'Sistema de Fondeo Modular de Cadena 38mm y Boyas Rotomoldeadas 4000L',
    productoCodigo: 'PROD-FON-38MM',
    categoria: 'REDES_Y_FONDEOS',
    unidadMedida: 'CONJ',
    cantidad: 2,
    condicionesComerciales: 'Crédito a 30 días factura electrónica SII con Guía DTE 52 recepcionada.',
    partidas: [
      {
        id: 'bp-010',
        tipo: 'MPD',
        insumoCodigo: 'CAD-ACERO-38',
        descripcion: 'Cadena de Fondeo Acero Grado 2 Galvanizada en Caliente 38mm',
        unidadMedida: 'TRAMO',
        cantidadPresupuestada: 12,
        costoUnitarioEstimado: 650000,
        costoTotalEstimado: 7800000,
        precioUnitarioSugerido: 980000,
        precioTotalVenta: 11760000,
        visibleParaCliente: true,
      },
      {
        id: 'bp-011',
        tipo: 'MPD',
        insumoCodigo: 'BOY-HDPE-4000',
        descripcion: 'Boya Polietileno Virgen Rotomoldeada 4000L con Cáncamo de Acero Naval',
        unidadMedida: 'UNID',
        cantidadPresupuestada: 8,
        costoUnitarioEstimado: 850000,
        costoTotalEstimado: 6800000,
        precioUnitarioSugerido: 1250000,
        precioTotalVenta: 10000000,
        visibleParaCliente: true,
      },
      {
        id: 'bp-012',
        tipo: 'MOD',
        descripcion: 'Armado de Grilletes, Destorcedores y Test de Carga Mecánica',
        unidadMedida: 'HORAS',
        cantidadPresupuestada: 90,
        costoUnitarioEstimado: 14500,
        costoTotalEstimado: 1305000,
        precioUnitarioSugerido: 24000,
        precioTotalVenta: 2160000,
        visibleParaCliente: true,
      },
      {
        id: 'bp-013',
        tipo: 'CIF',
        descripcion: 'Operación de Grúa Horquilla Heavy Duty y Combustible de Maniobras',
        unidadMedida: 'GL',
        cantidadPresupuestada: 1,
        costoUnitarioEstimado: 950000,
        costoTotalEstimado: 950000,
        precioUnitarioSugerido: 0,
        precioTotalVenta: 0,
        visibleParaCliente: false, // OCULTO AL CLIENTE
        notasInternas: 'Costos indirectos de taller y grúa interna.',
      },
      {
        id: 'bp-014',
        tipo: 'CIF',
        descripcion: 'Desgaste de Dinamómetro y Banco de Pruebas Hidráulico',
        unidadMedida: 'GL',
        cantidadPresupuestada: 1,
        costoUnitarioEstimado: 350000,
        costoTotalEstimado: 350000,
        precioUnitarioSugerido: 0,
        precioTotalVenta: 0,
        visibleParaCliente: false, // OCULTO AL CLIENTE
      },
      {
        id: 'bp-015',
        tipo: 'CIF',
        descripcion: 'Certificación de Tracción y Trazabilidad por Ingeniero Naval Certificado',
        unidadMedida: 'SERVICIOS',
        cantidadPresupuestada: 1,
        costoUnitarioEstimado: 600000,
        costoTotalEstimado: 600000,
        precioUnitarioSugerido: 1880000,
        precioTotalVenta: 1880000,
        visibleParaCliente: true,
      },
    ],
    costoTotalMpd: 14600000,
    costoTotalMod: 1305000,
    costoTotalCif: 1900000,
    costoTotalInterno: 17805000,
    precioVentaNetoCliente: 25800000,
    margenBrutoEstimadoClp: 7995000,
    margenBrutoEstimadoPct: 30.99,
    markupPct: 44.9,
    historialEnvio: [
      {
        fecha: '2026-09-04 11:30',
        remitente: 'comercial@mar-austral.cl',
        destinatario: 'cdonoso@salmonesaustral.cl',
        observaciones: 'Presupuesto formal enviado. En espera de resolución de directorio técnico.',
      },
    ],
  },
  {
    id: 'pre-003',
    empresaId: 'client-mar-austral',
    folio: 'PRE-2026-044',
    clienteId: 'cli-003',
    clienteNombre: 'Cultivos Marinos Calbuco SpA',
    clienteRut: '76.998.112-2',
    contactoCliente: 'Lorena Velásquez - Gerente de Planta',
    emailCliente: 'lorena.velasquez@cultivoscalbuco.cl',
    fechaEmision: '2026-09-12',
    fechaValidez: '2026-10-12',
    estado: 'BORRADOR',
    productoNombre: 'Confección Red Lobera Perimetral Dyneema 80x80m Antidepredador',
    productoCodigo: 'PROD-LOB-8080',
    categoria: 'REDES_Y_FONDEOS',
    unidadMedida: 'UNID',
    cantidad: 1,
    condicionesComerciales: 'Anticipo 40%, 60% a 30 días contra acta de inspección subacuática conforme.',
    partidas: [
      {
        id: 'bp-020',
        tipo: 'MPD',
        insumoCodigo: 'MAT-DYN-PAÑO',
        descripcion: 'Paño de Red Dyneema Ultra Alto Módulo 3.5mm Antilobo',
        unidadMedida: 'ROLLO',
        cantidadPresupuestada: 6,
        costoUnitarioEstimado: 2100000,
        costoTotalEstimado: 12600000,
        precioUnitarioSugerido: 3100000,
        precioTotalVenta: 18600000,
        visibleParaCliente: true,
      },
      {
        id: 'bp-021',
        tipo: 'MOD',
        descripcion: 'Confección Técnica, Refuerzos en Vértices y Costura Reforzada Dyneema',
        unidadMedida: 'HORAS',
        cantidadPresupuestada: 120,
        costoUnitarioEstimado: 15000,
        costoTotalEstimado: 1800000,
        precioUnitarioSugerido: 26000,
        precioTotalVenta: 3120000,
        visibleParaCliente: true,
      },
      {
        id: 'bp-022',
        tipo: 'CIF',
        descripcion: 'Consumo de Hilos Especiales, Resinas y Desgaste de Agujas Neumáticas',
        unidadMedida: 'GL',
        cantidadPresupuestada: 1,
        costoUnitarioEstimado: 680000,
        costoTotalEstimado: 680000,
        precioUnitarioSugerido: 0,
        precioTotalVenta: 0,
        visibleParaCliente: false, // OCULTO AL CLIENTE
      },
      {
        id: 'bp-023',
        tipo: 'CIF',
        descripcion: 'Certificación de Laboratorio de Ensayos Mecánicos y Rotura',
        unidadMedida: 'SERVICIOS',
        cantidadPresupuestada: 1,
        costoUnitarioEstimado: 500000,
        costoTotalEstimado: 500000,
        precioUnitarioSugerido: 1280000,
        precioTotalVenta: 1280000,
        visibleParaCliente: true,
      },
    ],
    costoTotalMpd: 12600000,
    costoTotalMod: 1800000,
    costoTotalCif: 1180000,
    costoTotalInterno: 15580000,
    precioVentaNetoCliente: 23000000,
    margenBrutoEstimadoClp: 7420000,
    margenBrutoEstimadoPct: 32.26,
    markupPct: 47.62,
  },
];

export const SEED_WAREHOUSE_WITHDRAWALS: WarehouseWithdrawal[] = [
  {
    id: 'vale-001',
    empresaId: 'client-mar-austral',
    folioVale: 'VALE-2026-0041',
    fecha: '2026-08-18',
    ordenProduccionId: 'op-101',
    ordenProduccionFolio: 'OP-2026-101',
    clienteNombre: 'Pesquera Chiloé Ltda.',
    bodegaOrigenId: 'bod-qui-01',
    bodegaOrigenNombre: 'Bodega Central Quilicura / Quellón',
    solicitanteNombre: 'Manuel Alvarado Cárdenas - Maestro Redero',
    responsableBodega: 'Williams Rojas - Encargado de Bodega',
    items: [
      {
        insumoId: 'item-04',
        insumoCodigo: 'MAT-HDPE-PAÑO',
        insumoNombre: 'Paño de Red HDPE Virgen Malla 1.5" x 500m2',
        cantidadSolicitada: 4,
        cantidadPresupuestadaOriginal: 4,
        cantidadPreviaConsumida: 0,
        cantidadTotalResultante: 4,
        haySobreconsumo: false,
        desvioCantidad: 0,
        costoUnitarioPMP: 1450000,
        costoTotal: 5800000,
        unidadMedida: 'ROLLO',
        impactoEstimadoEnMargenClp: 0,
      },
    ],
    costoTotalVale: 5800000,
    observaciones: 'Despacho de paños principales según presupuesto aprobado PRE-2026-039.',
  },
  {
    id: 'vale-002',
    empresaId: 'client-mar-austral',
    folioVale: 'VALE-2026-0042',
    fecha: '2026-08-20',
    ordenProduccionId: 'op-101',
    ordenProduccionFolio: 'OP-2026-101',
    clienteNombre: 'Pesquera Chiloé Ltda.',
    bodegaOrigenId: 'bod-qui-01',
    bodegaOrigenNombre: 'Bodega Central Quilicura / Quellón',
    solicitanteNombre: 'Jorge Barría Soto - Ayudante de Taller',
    responsableBodega: 'Williams Rojas - Encargado de Bodega',
    items: [
      {
        insumoId: 'item-05',
        insumoCodigo: 'CAB-PERLON-24',
        insumoNombre: 'Cabo Perlón Virgen 24mm con Alma de Plomo',
        cantidadSolicitada: 8,
        cantidadPresupuestadaOriginal: 8,
        cantidadPreviaConsumida: 0,
        cantidadTotalResultante: 8,
        haySobreconsumo: false,
        desvioCantidad: 0,
        costoUnitarioPMP: 325000,
        costoTotal: 2600000,
        unidadMedida: 'CARRETE',
        impactoEstimadoEnMargenClp: 0,
      },
    ],
    costoTotalVale: 2600000,
    observaciones: 'Despacho de cabos de relinga perimetral.',
  },
  {
    id: 'vale-003',
    empresaId: 'client-mar-austral',
    folioVale: 'VALE-2026-0043',
    fecha: '2026-08-22',
    tipoRetiro: 'NOTA_PEDIDO_CC',
    notaPedidoFolio: 'NP-2026-0819',
    notaPedidoAutorizadaPor: 'Gonzalo Silva - Gerencia Comercial',
    centroCostoId: 'cc-02',
    centroCostoNombre: 'Ventas & Distribución Zona Central (Mini-Empresa)',
    bodegaOrigenId: 'bod-qui-01',
    bodegaOrigenNombre: 'Bodega Central Quilicura / Quellón',
    solicitanteNombre: 'Claudia Navarrete - Ejecutiva de Cuentas Corporativas',
    responsableBodega: 'Williams Rojas - Encargado de Bodega',
    items: [
      {
        insumoId: 'item-01',
        insumoCodigo: 'INS-GRILLETE-35T',
        insumoNombre: 'Grilletes de Acero Grado 80 de 35 Toneladas',
        cantidadSolicitada: 6,
        cantidadPresupuestadaOriginal: 0,
        cantidadPreviaConsumida: 0,
        cantidadTotalResultante: 6,
        haySobreconsumo: false,
        desvioCantidad: 0,
        costoUnitarioPMP: 45000,
        costoTotal: 270000,
        unidadMedida: 'UNID',
        impactoEstimadoEnMargenClp: 0,
      },
    ],
    costoTotalVale: 270000,
    observaciones: 'Retiro autorizado s/ Nota de Pedido NP-2026-0819. Despacho directo a cliente Naviera del Sur. Imputado 100% a CC-VTA-STGO.',
  },
  {
    id: 'vale-004',
    empresaId: 'client-mar-austral',
    folioVale: 'VALE-2026-0044',
    fecha: '2026-08-25',
    tipoRetiro: 'NOTA_PEDIDO_CC',
    notaPedidoFolio: 'NP-2026-0842',
    notaPedidoAutorizadaPor: 'Carla Morales - Jefatura de Administración',
    centroCostoId: 'cc-01',
    centroCostoNombre: 'Administración Central & Finanzas',
    distribucionMultiCentroCosto: [
      {
        centroCostoId: 'cc-01',
        centroCostoNombre: 'Administración Central & Finanzas',
        porcentaje: 60,
        montoClp: 210000,
      },
      {
        centroCostoId: 'cc-05',
        centroCostoNombre: 'Logística, Bodega Central & Despachos',
        porcentaje: 40,
        montoClp: 140000,
      },
    ],
    bodegaOrigenId: 'bod-qui-01',
    bodegaOrigenNombre: 'Bodega Central Quilicura / Quellón',
    solicitanteNombre: 'Sebastián Palma - Soporte Operacional',
    responsableBodega: 'Williams Rojas - Encargado de Bodega',
    items: [
      {
        insumoId: 'item-06',
        insumoCodigo: 'HIL-COSER-PAÑOS',
        insumoNombre: 'Insumos Operacionales de Embalaje y Cintas',
        cantidadSolicitada: 10,
        cantidadPresupuestadaOriginal: 0,
        cantidadPreviaConsumida: 0,
        cantidadTotalResultante: 10,
        haySobreconsumo: false,
        desvioCantidad: 0,
        costoUnitarioPMP: 35000,
        costoTotal: 350000,
        unidadMedida: 'UNID',
        impactoEstimadoEnMargenClp: 0,
      },
    ],
    costoTotalVale: 350000,
    observaciones: 'Consumo interno departamental distribuido: 60% Administración ($210.000) y 40% Logística ($140.000).',
  },
];

/**
 * Recalcula métricas de un presupuesto automáticamente (totales MPD, MOD, CIF, internos y margen).
 */
export function recalculateBudgetMetrics(budget: ProductionBudget): ProductionBudget {
  let costoTotalMpd = 0;
  let costoTotalMod = 0;
  let costoTotalCif = 0;
  let precioVentaNetoCliente = 0;

  budget.partidas.forEach((p) => {
    const costo = p.cantidadPresupuestada * p.costoUnitarioEstimado;
    p.costoTotalEstimado = costo;
    if (p.precioUnitarioSugerido && p.precioUnitarioSugerido > 0) {
      p.precioTotalVenta = p.cantidadPresupuestada * p.precioUnitarioSugerido;
    } else {
      p.precioTotalVenta = p.precioTotalVenta || 0;
    }

    if (p.tipo === 'MPD') costoTotalMpd += costo;
    else if (p.tipo === 'MOD') costoTotalMod += costo;
    else if (p.tipo === 'CIF' || p.tipo === 'OTRO') costoTotalCif += costo;

    // Solo suma al precio de venta del cliente si es visible y tiene precio asignado
    if (p.visibleParaCliente && p.precioTotalVenta) {
      precioVentaNetoCliente += p.precioTotalVenta;
    }
  });

  const costoTotalInterno = costoTotalMpd + costoTotalMod + costoTotalCif;
  const margenBrutoEstimadoClp = precioVentaNetoCliente - costoTotalInterno;
  const margenBrutoEstimadoPct =
    precioVentaNetoCliente > 0
      ? Number(((margenBrutoEstimadoClp / precioVentaNetoCliente) * 100).toFixed(2))
      : 0;
  const markupPct =
    costoTotalInterno > 0
      ? Number(((margenBrutoEstimadoClp / costoTotalInterno) * 100).toFixed(2))
      : 0;

  return {
    ...budget,
    costoTotalMpd,
    costoTotalMod,
    costoTotalCif,
    costoTotalInterno,
    precioVentaNetoCliente,
    margenBrutoEstimadoClp,
    margenBrutoEstimadoPct,
    markupPct,
  };
}

/**
 * Convierte un Presupuesto aprobado en una Orden de Producción (OP/OT) automática con desglose completo.
 */
export function convertBudgetToProductionOrder(
  budget: ProductionBudget,
  folioOP?: string
): ProductionOrder {
  const generatedFolio =
    folioOP || `OP-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;

  const materialesPresupuestados = budget.partidas
    .filter((p) => p.tipo === 'MPD')
    .map((p) => ({
      insumoId: p.insumoId,
      insumoCodigo: p.insumoCodigo || 'MAT-GEN',
      insumoNombre: p.descripcion,
      cantidadPresupuestada: p.cantidadPresupuestada,
      costoUnitarioEstimado: p.costoUnitarioEstimado,
      costoTotalPresupuestado: p.costoTotalEstimado,
      unidadMedida: p.unidadMedida,
    }));

  const order: ProductionOrder = {
    id: `op-auto-${Date.now()}`,
    empresaId: budget.empresaId,
    folioOP: generatedFolio,
    descripcion: `Fabricación de ${budget.productoNombre} (Ref: ${budget.folio})`,
    productoCodigo: budget.productoCodigo,
    productoNombre: budget.productoNombre,
    categoria: budget.categoria,
    unidadMedida: budget.unidadMedida,
    fechaInicio: new Date().toISOString().split('T')[0],
    fechaEstimadaTermino: budget.fechaValidez,
    estado: 'EN_PROCESO',
    cantidadObjetivo: budget.cantidad,
    cantidadProducidaReal: 0,
    cantidadMerma: 0,
    bodegaDestinoNombre: 'Bodega Central de Productos Terminados',
    costoDirectoMateriales: 0, // Se irá acumulando con los retiros reales
    costoDirectoManoObra: 0,
    costoPrimo: 0,
    baseProrrateoCif: 'HORAS_HOMBRE_MOD',
    tasaCifAplicada: 8900,
    costoIndirectoCif: 0,
    costoTotalProduccion: 0,
    costoUnitarioReal: 0,
    precioVentaEstimado: budget.precioVentaNetoCliente,
    margenBrutoUnitarioEstimado: budget.margenBrutoEstimadoPct,
    consumosMateriales: [],
    manoDeObraRegistros: [],
    // Trazabilidad de Presupuesto Asociado
    presupuestoId: budget.id,
    presupuestoFolio: budget.folio,
    clienteNombre: budget.clienteNombre,
    clienteRut: budget.clienteRut,
    precioVentaPactado: budget.precioVentaNetoCliente,
    margenPresupuestadoClp: budget.margenBrutoEstimadoClp,
    margenPresupuestadoPct: budget.margenBrutoEstimadoPct,
    presupuestoBase: {
      costoMpdPresupuestado: budget.costoTotalMpd,
      costoModPresupuestado: budget.costoTotalMod,
      costoCifPresupuestado: budget.costoTotalCif,
      costoTotalPresupuestado: budget.costoTotalInterno,
      materialesPresupuestados,
    },
    asientosGenerados: {},
  };

  return order;
}

/**
 * Genera el análisis exhaustivo de cierre de una OP, calculando varianzas y erosión de margen.
 */
export function generateProductionOrderClosureAnalysis(
  order: ProductionOrder
): ProductionOrderClosureAnalysis {
  const base = order.presupuestoBase || {
    costoMpdPresupuestado: order.costoDirectoMateriales,
    costoModPresupuestado: order.costoDirectoManoObra,
    costoCifPresupuestado: order.costoIndirectoCif,
    costoTotalPresupuestado: order.costoTotalProduccion,
    materialesPresupuestados: [],
  };

  const costoMpdReal = order.costoDirectoMateriales;
  const costoModReal = order.costoDirectoManoObra;
  const costoCifReal = order.costoIndirectoCif;
  const costoTotalReal = order.costoTotalProduccion;

  const varianzaMpdClp = costoMpdReal - base.costoMpdPresupuestado;
  const varianzaMpdPct =
    base.costoMpdPresupuestado > 0
      ? Number(((varianzaMpdClp / base.costoMpdPresupuestado) * 100).toFixed(2))
      : 0;

  const varianzaModClp = costoModReal - base.costoModPresupuestado;
  const varianzaModPct =
    base.costoModPresupuestado > 0
      ? Number(((varianzaModClp / base.costoModPresupuestado) * 100).toFixed(2))
      : 0;

  const varianzaCifClp = costoCifReal - base.costoCifPresupuestado;
  const varianzaCifPct =
    base.costoCifPresupuestado > 0
      ? Number(((varianzaCifClp / base.costoCifPresupuestado) * 100).toFixed(2))
      : 0;

  const varianzaCostoTotalClp = costoTotalReal - base.costoTotalPresupuestado;
  const varianzaCostoTotalPct =
    base.costoTotalPresupuestado > 0
      ? Number(((varianzaCostoTotalClp / base.costoTotalPresupuestado) * 100).toFixed(2))
      : 0;

  const precioVentaFinal = order.precioVentaPactado || order.precioVentaEstimado || 0;
  const margenPresupuestadoClp =
    order.margenPresupuestadoClp || precioVentaFinal - base.costoTotalPresupuestado;
  const margenPresupuestadoPct =
    order.margenPresupuestadoPct ||
    (precioVentaFinal > 0 ? (margenPresupuestadoClp / precioVentaFinal) * 100 : 0);

  const margenRealClp = precioVentaFinal - costoTotalReal;
  const margenRealPct =
    precioVentaFinal > 0 ? Number(((margenRealClp / precioVentaFinal) * 100).toFixed(2)) : 0;

  const erosionMargenPct = Number((margenPresupuestadoPct - margenRealPct).toFixed(2));

  // Análisis por material
  const detalleDesviosMateriales = (base.materialesPresupuestados || []).map((matPres) => {
    const consumos = (order.consumosMateriales || []).filter(
      (c) =>
        c.insumoCodigo === matPres.insumoCodigo ||
        (matPres.insumoId && c.insumoId === matPres.insumoId) ||
        c.insumoNombre.toLowerCase().includes(matPres.insumoNombre.toLowerCase().slice(0, 10))
    );

    const cantidadReal = consumos.reduce((acc, c) => acc + c.cantidadConsumida, 0);
    const costoReal = consumos.reduce((acc, c) => acc + c.costoTotalConsumo, 0);
    const desvioCantidad = cantidadReal - matPres.cantidadPresupuestada;
    const desvioCantidadPct =
      matPres.cantidadPresupuestada > 0
        ? Number(((desvioCantidad / matPres.cantidadPresupuestada) * 100).toFixed(1))
        : 0;
    const desvioCostoClp = costoReal - matPres.costoTotalPresupuestado;
    const impactoEnMargenPct =
      precioVentaFinal > 0 ? Number(((desvioCostoClp / precioVentaFinal) * 100).toFixed(2)) : 0;

    return {
      insumoCodigo: matPres.insumoCodigo,
      insumoNombre: matPres.insumoNombre,
      unidadMedida: matPres.unidadMedida,
      cantidadPresupuestada: matPres.cantidadPresupuestada,
      cantidadReal,
      desvioCantidad,
      desvioCantidadPct,
      costoPresupuestado: matPres.costoTotalPresupuestado,
      costoReal,
      desvioCostoClp,
      impactoEnMargenPct,
    };
  });

  let diagnosticoEficiencia: 'EXCELENTE' | 'DENTRO_DE_TOLERANCIA' | 'DESVIO_MODERADO' | 'SOBRECOSTO_CRITICO' =
    'DENTRO_DE_TOLERANCIA';
  let resumenDiagnostico = '';

  if (erosionMargenPct <= 0) {
    diagnosticoEficiencia = 'EXCELENTE';
    resumenDiagnostico = `Excelente ejecución fabril: No hubo sobrecostos. Se obtuvo un margen real del ${margenRealPct}%, superando o igualando la meta presupuestada.`;
  } else if (erosionMargenPct <= 2.5) {
    diagnosticoEficiencia = 'DENTRO_DE_TOLERANCIA';
    resumenDiagnostico = `Ejecución conforme a estándar: Erosión marginal de solo ${erosionMargenPct}% dentro del rango de tolerancia técnica (±3%).`;
  } else if (erosionMargenPct <= 7.0) {
    diagnosticoEficiencia = 'DESVIO_MODERADO';
    resumenDiagnostico = `Alerta de desvío moderado: El margen disminuyó en ${erosionMargenPct} puntos porcentuales debido a consumos no previstos de insumos o sobretiempos de MOD.`;
  } else {
    diagnosticoEficiencia = 'SOBRECOSTO_CRITICO';
    resumenDiagnostico = `SOBRECOSTO CRÍTICO: Erosión severa de margen (-${erosionMargenPct}%). El costo final superó el presupuesto en $${varianzaCostoTotalClp.toLocaleString('es-CL')}, impactando la rentabilidad del contrato.`;
  }

  return {
    fechaCierre: new Date().toISOString().split('T')[0],
    costoMpdReal,
    costoMpdPresupuestado: base.costoMpdPresupuestado,
    varianzaMpdClp,
    varianzaMpdPct,
    costoModReal,
    costoModPresupuestado: base.costoModPresupuestado,
    varianzaModClp,
    varianzaModPct,
    costoCifReal,
    costoCifPresupuestado: base.costoCifPresupuestado,
    varianzaCifClp,
    varianzaCifPct,
    costoTotalReal,
    costoTotalPresupuestado: base.costoTotalPresupuestado,
    varianzaCostoTotalClp,
    varianzaCostoTotalPct,
    precioVentaFinal,
    margenPresupuestadoClp,
    margenPresupuestadoPct,
    margenRealClp,
    margenRealPct,
    erosionMargenPct,
    diagnosticoEficiencia,
    resumenDiagnostico,
    detalleDesviosMateriales,
  };
}
