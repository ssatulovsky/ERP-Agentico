export interface ProductMarginAnalysis {
  itemId: string;
  sku: string;
  nombre: string;
  categoria: string;
  costoUnitarioPMP: number; // Precio Medio Ponderado en CLP
  ultimoPrecioCompra: number; // Costo última compra (reposición)
  variacionCostoPorcentaje: number; // Diferencia % entre último precio y PMP
  precioVentaLista: number; // Precio de venta vigente
  margenBrutoCLP: number; // precioVentaLista - ultimoPrecioCompra
  margenBrutoPorcentaje: number; // (margenBrutoCLP / precioVentaLista) * 100
  margenTargetPorcentaje: number; // Margen meta (ej: 30%)
  estadoMargen: 'OPTIMO' | 'AJUSTADO' | 'CRITICO' | 'NEGATIVO';
  precioVentaSugeridoTarget: number; // Precio sugerido para alcanzar el target
  alertaAgente: string;
}

export interface StockSinergyItem {
  itemId: string;
  sku: string;
  nombre: string;
  categoria: string;
  stockFisico: number;
  stockComprometido: number;
  stockDisponible: number;
  cotizacionesAbiertas: number; // Unidades en cotizaciones pendientes
  ventasProyectadas30Dias: number; // Demanda prevista para los próximos 30 días
  balanceDisponibilidad: number; // stockDisponible - (cotizacionesAbiertas + ventasProyectadas30Dias)
  riesgoQuiebre: boolean;
  diasCobertura: number;
  sobreStockDias: boolean; // Si cobertura > 90 días
  valorCapitalInmovilizado: number;
  accionRecomendada: 'COMPRA_URGENTE' | 'COTIZAR_PROVEEDOR' | 'PROMOCION_DESCUENTO' | 'BALANCEADO';
  alertaAgente: string;
}

export interface SupplierVolumeDiscount {
  cantidadMinima: number;
  descuentoPorcentaje: number;
  precioUnitarioFinal: number;
}

export interface SupplierEvaluation {
  id: string;
  rut: string;
  razonSocial: string;
  rubro: string;
  emailContacto: string;
  telefono: string;
  scoringGeneral: number; // 1.0 a 5.0
  cumplimientoPlazoSla: number; // % (ej: 96%)
  calidadConformidad: number; // % (ej: 98.5%)
  plazoEntregaPromedioDias: number;
  condicionPago: 'CONTADO' | 'CREDITO_30_DIAS' | 'CREDITO_60_DIAS' | 'CREDITO_90_DIAS';
  descuentosPorVolumen: SupplierVolumeDiscount[];
  ordenesEmitidasHistorico: number;
  montoTotalCompradoCLP: number;
  estadoHomologacion: 'HOMOLOGADO_PREFERENTE' | 'ACTIVO' | 'EN_OBSERVACION' | 'BLOQUEADO';
  notasAuditoria: string;
}

export interface DemandForecastItem {
  itemId: string;
  sku: string;
  nombre: string;
  ventasHistoricasMeses: {
    mesMeno3: number;
    mesMeno2: number;
    mesMeno1: number;
  };
  factorEstacionalidad: number; // ej: 1.15
  demandaProyectada30Dias: number;
  demandaProyectada60Dias: number;
  demandaProyectada90Dias: number;
  stockProyectadoFinMes: number;
  fechaLimiteEmisionOC: string;
  cantidadSugeridaOC: number;
  proveedorSugeridoRut: string;
  proveedorSugeridoNombre: string;
  costoEstimadoCompraCLP: number;
  prioridad: 'ALTA' | 'MEDIA' | 'ESTABLE';
}

export interface ClientCommercialProfile {
  id: string;
  rut: string;
  razonSocial: string;
  contactoNombre: string;
  email: string;
  telefono: string;
  clasificacionAbc: 'A_VIP' | 'B_MEDIO' | 'C_ESTANDAR';
  facturacionAcumuladaCLP: number;
  frecuenciaCompraDias: number;
  diasDesdeUltimaCompra: number;
  condicionVenta: 'CONTADO' | 'CREDITO_30_DIAS' | 'CREDITO_60_DIAS';
  limiteCreditoCLP: number;
  creditoUtilizadoCLP: number;
  riesgoFidelizacion: 'BAJO' | 'MEDIO' | 'ALTO_INACTIVO';
  estrategiaAgente: string;
}

export interface ProcurementBudgetCategory {
  categoriaId: string;
  nombre: string;
  presupuestoAprobadoCLP: number;
  montoComprometidoOC: number;
  montoFacturadoSII: number;
  saldoDisponibleCLP: number;
  porcentajeEjecutado: number;
  estadoAlerta: 'NORMAL' | 'PRECAUCION' | 'EXCEDIDO';
}

export interface PurchaseOrderRecord {
  id: string;
  folio: string; // ej: "OC-2026-0104"
  fechaEmision: string;
  proveedorRut: string;
  proveedorRazonSocial: string;
  condicionPago: string;
  plazoEntregaDias: number;
  items: Array<{
    sku: string;
    nombre: string;
    cantidad: number;
    precioUnitarioCLP: number;
    subtotalNetoCLP: number;
  }>;
  totalNetoCLP: number;
  iva19CLP: number;
  totalBrutoCLP: number;
  estado: 'BORRADOR' | 'EMITIDA' | 'ENVIADA_PROVEEDOR' | 'RECEPCIONADA_CONFORME' | 'FACTURADA_SII';
  motivoGeneracion: string;
  autorizadoPorAgente: boolean;
}

export interface CommercialQuoteRecord {
  id: string;
  folio: string; // ej: "COT-2026-089"
  fechaEmision: string;
  clienteRut: string;
  clienteRazonSocial: string;
  validezDias: number;
  items: Array<{
    sku: string;
    nombre: string;
    cantidad: number;
    precioUnitarioCLP: number;
    costoUnitarioPMP: number;
    margenBrutoEstimadoPorcentaje: number;
    subtotalNetoCLP: number;
  }>;
  totalNetoCLP: number;
  iva19CLP: number;
  totalBrutoCLP: number;
  margenBrutoTotalPorcentaje: number;
  estado: 'BORRADOR' | 'ENVIADA_CLIENTE' | 'ACEPTADA_POR_FACTURAR' | 'CERRADA_PERDIDA';
  validacionStockRealizada: boolean;
}

export interface RfqItemDetail {
  sku: string;
  nombre: string;
  cantidad: number;
  unidadMedida: string;
  precioReferencialPmp: number;
  especificaciones?: string;
}

export interface RfqSupplierQuoteItem {
  sku: string;
  nombre: string;
  cantidad: number;
  precioUnitarioOfertado: number;
  subtotalNetoOfertado: number;
}

export interface RfqSupplierResponse {
  id: string;
  rfqId: string;
  proveedorRut: string;
  proveedorRazonSocial: string;
  emailContacto: string;
  telefonoContacto?: string;
  estadoSeguimiento: 'ENVIADA' | 'VISTA_LEIDA' | 'EN_PREPARACION' | 'COTIZADA' | 'NO_RESPONDE_RETRASADO' | 'DECLINADA';
  fechaEnvio: string;
  fechaLectura?: string;
  fechaRespuesta?: string;
  cantidadReiteraciones: number;
  ultimoRecordatorioAt?: string;
  montoNetoOfertado?: number;
  plazoEntregaDiasOfertado?: number;
  condicionPagoOfertada?: string;
  costoFleteClp?: number;
  scoringPonderadoTotal?: number; // 0 a 100
  itemsCotizados?: RfqSupplierQuoteItem[];
  observacionesProveedor?: string;
  esOfertaGanadora: boolean;
}

export interface RfqRequest {
  id: string;
  empresaId: string;
  folioRfq: string; // ej: "RFQ-2026-0042"
  titulo: string;
  fechaEmision: string;
  fechaLimiteRespuesta: string;
  diasPlazoRespuesta: number;
  estado: 'BORRADOR' | 'ENVIADA' | 'EN_EVALUACION' | 'ADJUDICADA' | 'CANCELADA';
  items: RfqItemDetail[];
  proveedoresInvitados: RfqSupplierResponse[];
  proveedorGanadorRut?: string;
  proveedorGanadorNombre?: string;
  ordenCompraGeneradaId?: string;
  folioOrdenCompra?: string;
  motivoAdjudicacion?: string;
  recomendacionAgenteSr?: string;
  createdAt: string;
}

export interface CommercialProcurementState {
  empresaId: string;
  kpis: {
    facturacionMesCLP: number;
    metaFacturacionMesCLP: number;
    porcentajeCumplimientoMeta: number;
    margenBrutoPonderadoPorcentaje: number;
    presupuestoComprasAprobadoCLP: number;
    presupuestoComprasEjecutadoCLP: number;
    porcentajePresupuestoEjecutado: number;
    itemsEnRiesgoQuiebreCount: number;
    capitalInmovilizadoSobreStockCLP: number;
    slaCumplimientoProveedoresPromedio: number;
  };
  margenes: ProductMarginAnalysis[];
  sinergiaStock: StockSinergyItem[];
  proveedores: SupplierEvaluation[];
  forecasting: DemandForecastItem[];
  clientesClave: ClientCommercialProfile[];
  presupuestoCategorias: ProcurementBudgetCategory[];
  ordenesCompra: PurchaseOrderRecord[];
  cotizaciones: CommercialQuoteRecord[];
  rfqs: RfqRequest[];
  ultimaActualizacion: string;
}
