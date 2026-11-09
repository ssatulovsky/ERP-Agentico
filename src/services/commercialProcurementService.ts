const getDiskPersistence = (): any => (globalThis as any)?.__diskPersistence;
import { aiRouterService } from './aiRouterService';
import type {
  ProductMarginAnalysis,
  StockSinergyItem,
  SupplierVolumeDiscount,
  SupplierEvaluation,
  DemandForecastItem,
  ClientCommercialProfile,
  ProcurementBudgetCategory,
  PurchaseOrderRecord,
  CommercialQuoteRecord,
  RfqItemDetail,
  RfqSupplierQuoteItem,
  RfqSupplierResponse,
  RfqRequest,
  CommercialProcurementState
} from '../types/commercialProcurement';
import { isDemoModeEnabled } from '../config/demoMode';

export type {
  ProductMarginAnalysis,
  StockSinergyItem,
  SupplierVolumeDiscount,
  SupplierEvaluation,
  DemandForecastItem,
  ClientCommercialProfile,
  ProcurementBudgetCategory,
  PurchaseOrderRecord,
  CommercialQuoteRecord,
  RfqItemDetail,
  RfqSupplierQuoteItem,
  RfqSupplierResponse,
  RfqRequest,
  CommercialProcurementState
};

class CommercialProcurementService {
  private statesByCompany: Record<string, CommercialProcurementState> = {};

  constructor() {
    // Estado comercial de ejemplo solo en modo demostración
    if (isDemoModeEnabled()) this.initDefaultState('client-retail-01');
  }

  private initDefaultState(empresaId: string) {
    if (!(empresaId === 'client-retail-01' && isDemoModeEnabled())) {
      const dp = getDiskPersistence();
      const tenantItems = dp ? dp.getInventoryItems(empresaId) : [];
      const tenantRfqs = dp ? dp.getAutoRfqs(empresaId) : [];
      // Margen solo para ítems con costo y precio de venta registrados (antes: costo 1.000 y precio = costo × 1,35 supuestos)
      const margenes: ProductMarginAnalysis[] = tenantItems
        .filter((it: any) => Number(it.costoPromedioPonderado || it.costoUnitarioPMP || it.costoUnitario) > 0 && Number(it.precioVentaLista || it.precioVenta) > 0)
        .map((it: any) => {
        const costoPMP = Number(it.costoPromedioPonderado || it.costoUnitarioPMP || it.costoUnitario);
        const pVenta = Number(it.precioVentaLista || it.precioVenta);
        const margenCLP = pVenta - costoPMP;
        const margenPct = pVenta > 0 ? Number(((margenCLP / pVenta) * 100).toFixed(2)) : 0;
        return {
          itemId: it.id || `item-${it.sku}`,
          sku: it.sku,
          nombre: it.nombre || it.descripcion || it.sku,
          categoria: it.categoria || 'GENERAL',
          costoUnitarioPMP: costoPMP,
          ultimoPrecioCompra: Number(it.ultimoPrecioCompra || costoPMP),
          variacionCostoPorcentaje: 0,
          precioVentaLista: pVenta,
          margenBrutoCLP: margenCLP,
          margenBrutoPorcentaje: margenPct,
          margenTargetPorcentaje: 30.0,
          estadoMargen: margenPct >= 30 ? 'OPTIMO' : margenPct >= 20 ? 'AJUSTADO' : 'CRITICO',
          precioVentaSugeridoTarget: Math.round(costoPMP / (1 - 0.3)),
          alertaAgente: margenPct < 20 ? `¡Margen bajo (${margenPct}%)! Revisar costos.` : 'Margen controlado.',
        };
      });

      const sinergiaStock: StockSinergyItem[] = tenantItems.map((it: any) => {
        const stockFisico = Number(it.stockActual ?? it.stockTotal ?? 0);
        const stockMin = Number(it.stockMinimo || 0);
        const riesgo = stockMin > 0 && stockFisico <= stockMin;
        return {
          itemId: it.id || `item-${it.sku}`,
          sku: it.sku,
          nombre: it.nombre || it.descripcion || it.sku,
          categoria: it.categoria || 'GENERAL',
          stockFisico,
          stockComprometido: 0,
          stockDisponible: stockFisico,
          cotizacionesAbiertas: 0,
          ventasProyectadas30Dias: 0, // sin historial de ventas no se proyecta demanda
          balanceDisponibilidad: stockFisico,
          riesgoQuiebre: riesgo,
          diasCobertura: 0, // requiere consumo diario real; no se estima
          sobreStockDias: false,
          valorCapitalInmovilizado: stockFisico * Number(it.costoPromedioPonderado || it.costoUnitarioPMP || 0),
          accionRecomendada: riesgo ? 'COMPRA_URGENTE' : 'BALANCEADO',
          alertaAgente: riesgo ? `¡Stock bajo mínimo! (${stockFisico} un. / mín: ${stockMin})` : 'Stock normal.',
        };
      });

      this.statesByCompany[empresaId] = {
        empresaId,
        kpis: {
          facturacionMesCLP: 0,
          metaFacturacionMesCLP: 10000000,
          porcentajeCumplimientoMeta: 0,
          margenBrutoPonderadoPorcentaje: margenes.length > 0
            ? Number((margenes.reduce((acc, m) => acc + m.margenBrutoPorcentaje, 0) / margenes.length).toFixed(1))
            : 0,
          presupuestoComprasAprobadoCLP: 0,
          presupuestoComprasEjecutadoCLP: 0,
          porcentajePresupuestoEjecutado: 0,
          itemsEnRiesgoQuiebreCount: sinergiaStock.filter(s => s.riesgoQuiebre).length,
          capitalInmovilizadoSobreStockCLP: 0,
          slaCumplimientoProveedoresPromedio: 100,
        },
        margenes,
        sinergiaStock,
        proveedores: [],
        forecasting: [],
        clientesClave: [],
        presupuestoCategorias: [],
        ordenesCompra: [],
        cotizaciones: [],
        rfqs: tenantRfqs,
        ultimaActualizacion: new Date().toISOString(),
      };
      return;
    }

    const defaultMargenes: ProductMarginAnalysis[] = [
      {
        itemId: 'item-01',
        sku: 'FILT-HID-04',
        nombre: 'Filtro Hidráulico Parker 10 Micrones Alta Presión',
        categoria: 'REPUESTOS',
        costoUnitarioPMP: 38500,
        ultimoPrecioCompra: 42000,
        variacionCostoPorcentaje: 9.09,
        precioVentaLista: 58000,
        margenBrutoCLP: 16000,
        margenBrutoPorcentaje: 27.59,
        margenTargetPorcentaje: 35.0,
        estadoMargen: 'AJUSTADO',
        precioVentaSugeridoTarget: 64615,
        alertaAgente: 'El costo de reposición subió un 9.1%. Se recomienda subir el precio de lista a $64.600 CLP para mantener el 35% de margen target.',
      },
      {
        itemId: 'item-02',
        sku: 'LUB-MOB-15W40',
        nombre: 'Aceite Sintético Mobil Delvac Modern 15W-40 (Litros)',
        categoria: 'INSUMOS',
        costoUnitarioPMP: 3850,
        ultimoPrecioCompra: 4100,
        variacionCostoPorcentaje: 6.49,
        precioVentaLista: 6200,
        margenBrutoCLP: 2100,
        margenBrutoPorcentaje: 33.87,
        margenTargetPorcentaje: 30.0,
        estadoMargen: 'OPTIMO',
        precioVentaSugeridoTarget: 5857,
        alertaAgente: 'Margen saludable por sobre el objetivo (33.9% vs 30% target). Margen competitivo en mercado.',
      },
      {
        itemId: 'item-03',
        sku: 'NEU-CAM-295-80',
        nombre: 'Neumático Michelin 295/80 R22.5 Dirección X MultiWay',
        categoria: 'MERCADERIA_VENTA',
        costoUnitarioPMP: 345000,
        ultimoPrecioCompra: 368000,
        variacionCostoPorcentaje: 6.67,
        precioVentaLista: 425000,
        margenBrutoCLP: 57000,
        margenBrutoPorcentaje: 13.41,
        margenTargetPorcentaje: 22.0,
        estadoMargen: 'CRITICO',
        precioVentaSugeridoTarget: 471795,
        alertaAgente: '¡Alerta de erosión de margen! Margen actual es de sólo 13.4% (Target: 22%). El precio de lista debe ajustarse a $472.000 CLP.',
      },
      {
        itemId: 'item-04',
        sku: 'PAL-EXP-NIMF15',
        nombre: 'Pallet Certificado Tratamiento Térmico NIMF-15 (1200x1000mm)',
        categoria: 'MERCADERIA_VENTA',
        costoUnitarioPMP: 12800,
        ultimoPrecioCompra: 13200,
        variacionCostoPorcentaje: 3.12,
        precioVentaLista: 18500,
        margenBrutoCLP: 5300,
        margenBrutoPorcentaje: 28.65,
        margenTargetPorcentaje: 25.0,
        estadoMargen: 'OPTIMO',
        precioVentaSugeridoTarget: 17600,
        alertaAgente: 'Margen protegido y rotación fluida con exportadoras.',
      },
      {
        itemId: 'item-05',
        sku: 'SEN-PRES-420',
        nombre: 'Transmisor de Presión WIKA 0-250 Bar Salida 4-20mA',
        categoria: 'REPUESTOS',
        costoUnitarioPMP: 142000,
        ultimoPrecioCompra: 148000,
        variacionCostoPorcentaje: 4.23,
        precioVentaLista: 235000,
        margenBrutoCLP: 87000,
        margenBrutoPorcentaje: 37.02,
        margenTargetPorcentaje: 35.0,
        estadoMargen: 'OPTIMO',
        precioVentaSugeridoTarget: 227692,
        alertaAgente: 'Margen excelente (37.0%). Producto de alta especialización técnica.',
      },
    ];

    const defaultSinergia: StockSinergyItem[] = [
      {
        itemId: 'item-05',
        sku: 'SEN-PRES-420',
        nombre: 'Transmisor de Presión WIKA 0-250 Bar Salida 4-20mA',
        categoria: 'REPUESTOS',
        stockFisico: 3,
        stockComprometido: 1,
        stockDisponible: 2,
        cotizacionesAbiertas: 4,
        ventasProyectadas30Dias: 6,
        balanceDisponibilidad: -8,
        riesgoQuiebre: true,
        diasCobertura: 10,
        sobreStockDias: false,
        valorCapitalInmovilizado: 284000,
        accionRecomendada: 'COMPRA_URGENTE',
        alertaAgente: '¡QUIEBRE INMINENTE! Hay 4 cotizaciones abiertas y sólo 2 unidades libres. Se requieren 8 unidades urgente.',
      },
      {
        itemId: 'item-01',
        sku: 'FILT-HID-04',
        nombre: 'Filtro Hidráulico Parker 10 Micrones Alta Presión',
        categoria: 'REPUESTOS',
        stockFisico: 18,
        stockComprometido: 6,
        stockDisponible: 12,
        cotizacionesAbiertas: 10,
        ventasProyectadas30Dias: 15,
        balanceDisponibilidad: -13,
        riesgoQuiebre: true,
        diasCobertura: 24,
        sobreStockDias: false,
        valorCapitalInmovilizado: 462000,
        accionRecomendada: 'COTIZAR_PROVEEDOR',
        alertaAgente: 'Stock bajo mínimo preventivo (12 libres vs 25 de demanda total estimada). Emitir Orden de Compra por lote EOQ (20 unids).',
      },
      {
        itemId: 'item-02',
        sku: 'LUB-MOB-15W40',
        nombre: 'Aceite Sintético Mobil Delvac Modern 15W-40 (Litros)',
        categoria: 'INSUMOS',
        stockFisico: 3200,
        stockComprometido: 400,
        stockDisponible: 2800,
        cotizacionesAbiertas: 600,
        ventasProyectadas30Dias: 900,
        balanceDisponibilidad: 1300,
        riesgoQuiebre: false,
        diasCobertura: 93,
        sobreStockDias: true,
        valorCapitalInmovilizado: 10780000,
        accionRecomendada: 'PROMOCION_DESCUENTO',
        alertaAgente: 'Sobre-stock detectado (93 días de cobertura). Se aconseja paquete promocional a clientes de transporte para liberar caja.',
      },
      {
        itemId: 'item-04',
        sku: 'PAL-EXP-NIMF15',
        nombre: 'Pallet Certificado Tratamiento Térmico NIMF-15 (1200x1000mm)',
        categoria: 'MERCADERIA_VENTA',
        stockFisico: 650,
        stockComprometido: 120,
        stockDisponible: 530,
        cotizacionesAbiertas: 200,
        ventasProyectadas30Dias: 250,
        balanceDisponibilidad: 80,
        riesgoQuiebre: false,
        diasCobertura: 63,
        sobreStockDias: false,
        valorCapitalInmovilizado: 6784000,
        accionRecomendada: 'BALANCEADO',
        alertaAgente: 'Nivel equilibrado de rotación y disponibilidad.',
      },
    ];

    const defaultProveedores: SupplierEvaluation[] = [
      {
        id: 'prov-01',
        rut: '76.812.004-9',
        razonSocial: 'MADERAS Y EMBALAJES DEL SUR S.A.',
        rubro: 'Pallets y Embalajes de Madera Certificada',
        emailContacto: 'ventas@embalajesdelsur.cl',
        telefono: '+56 2 2489 1100',
        scoringGeneral: 4.8,
        cumplimientoPlazoSla: 96.5,
        calidadConformidad: 99.2,
        plazoEntregaPromedioDias: 6,
        condicionPago: 'CREDITO_30_DIAS',
        descuentosPorVolumen: [
          { cantidadMinima: 300, descuentoPorcentaje: 4.0, precioUnitarioFinal: 12672 },
          { cantidadMinima: 600, descuentoPorcentaje: 7.5, precioUnitarioFinal: 12210 },
        ],
        ordenesEmitidasHistorico: 24,
        montoTotalCompradoCLP: 68400000,
        estadoHomologacion: 'HOMOLOGADO_PREFERENTE',
        notasAuditoria: 'Proveedor estratégico de alta fiabilidad. Entregas con sello NIMF-15 al día.',
      },
      {
        id: 'prov-02',
        rut: '99.520.000-7',
        razonSocial: 'COPEC COMBUSTIBLES Y LUBRICANTES SPA',
        rubro: 'Combustibles, Grasas y Lubricantes Industriales',
        emailContacto: 'atencionflotas@copec.cl',
        telefono: '+56 2 2690 7000',
        scoringGeneral: 4.9,
        cumplimientoPlazoSla: 98.0,
        calidadConformidad: 100.0,
        plazoEntregaPromedioDias: 3,
        condicionPago: 'CREDITO_60_DIAS',
        descuentosPorVolumen: [
          { cantidadMinima: 1000, descuentoPorcentaje: 5.0, precioUnitarioFinal: 3895 },
          { cantidadMinima: 2500, descuentoPorcentaje: 8.0, precioUnitarioFinal: 3772 },
        ],
        ordenesEmitidasHistorico: 42,
        montoTotalCompradoCLP: 145000000,
        estadoHomologacion: 'HOMOLOGADO_PREFERENTE',
        notasAuditoria: 'Excelente socio comercial. Condiciones de 60 días respetadas rigurosamente.',
      },
      {
        id: 'prov-03',
        rut: '76.321.890-5',
        razonSocial: 'ELECTRÓNICA E INSTRUMENTACIÓN INDUSTRIAL SPA',
        rubro: 'Sensores, Transmisores y Automatización',
        emailContacto: 'instrumentacion@electroindustrial.cl',
        telefono: '+56 2 2840 9230',
        scoringGeneral: 4.2,
        cumplimientoPlazoSla: 88.0,
        calidadConformidad: 97.0,
        plazoEntregaPromedioDias: 7,
        condicionPago: 'CREDITO_30_DIAS',
        descuentosPorVolumen: [
          { cantidadMinima: 10, descuentoPorcentaje: 6.0, precioUnitarioFinal: 139120 },
        ],
        ordenesEmitidasHistorico: 12,
        montoTotalCompradoCLP: 18900000,
        estadoHomologacion: 'ACTIVO',
        notasAuditoria: 'Cumplimiento técnico conforme. Se sugiere exigir confirmación de stock antes de enviar OC.',
      },
      {
        id: 'prov-04',
        rut: '96.554.210-K',
        razonSocial: 'PARKER HANNIFIN CHILE S.A.',
        rubro: 'Sistemas Hidráulicos, Conectores y Filtración',
        emailContacto: 'ventas.chile@parker.com',
        telefono: '+56 2 2620 5400',
        scoringGeneral: 4.7,
        cumplimientoPlazoSla: 94.0,
        calidadConformidad: 99.5,
        plazoEntregaPromedioDias: 5,
        condicionPago: 'CREDITO_30_DIAS',
        descuentosPorVolumen: [
          { cantidadMinima: 20, descuentoPorcentaje: 8.0, precioUnitarioFinal: 38640 },
          { cantidadMinima: 50, descuentoPorcentaje: 12.0, precioUnitarioFinal: 36960 },
        ],
        ordenesEmitidasHistorico: 18,
        montoTotalCompradoCLP: 34800000,
        estadoHomologacion: 'HOMOLOGADO_PREFERENTE',
        notasAuditoria: 'Líder en calidad de filtración. Descuentos por escala muy convenientes.',
      },
    ];

    const defaultForecasting: DemandForecastItem[] = [
      {
        itemId: 'item-05',
        sku: 'SEN-PRES-420',
        nombre: 'Transmisor de Presión WIKA 0-250 Bar Salida 4-20mA',
        ventasHistoricasMeses: { mesMeno3: 5, mesMeno2: 6, mesMeno1: 7 },
        factorEstacionalidad: 1.15,
        demandaProyectada30Dias: 8,
        demandaProyectada60Dias: 16,
        demandaProyectada90Dias: 25,
        stockProyectadoFinMes: -6,
        fechaLimiteEmisionOC: '2026-10-24',
        cantidadSugeridaOC: 12,
        proveedorSugeridoRut: '76.321.890-5',
        proveedorSugeridoNombre: 'ELECTRÓNICA E INSTRUMENTACIÓN INDUSTRIAL SPA',
        costoEstimadoCompraCLP: 1776000,
        prioridad: 'ALTA',
      },
      {
        itemId: 'item-01',
        sku: 'FILT-HID-04',
        nombre: 'Filtro Hidráulico Parker 10 Micrones Alta Presión',
        ventasHistoricasMeses: { mesMeno3: 12, mesMeno2: 15, mesMeno1: 16 },
        factorEstacionalidad: 1.20,
        demandaProyectada30Dias: 19,
        demandaProyectada60Dias: 38,
        demandaProyectada90Dias: 56,
        stockProyectadoFinMes: -7,
        fechaLimiteEmisionOC: '2026-10-26',
        cantidadSugeridaOC: 25,
        proveedorSugeridoRut: '96.554.210-K',
        proveedorSugeridoNombre: 'PARKER HANNIFIN CHILE S.A.',
        costoEstimadoCompraCLP: 1050000,
        prioridad: 'ALTA',
      },
      {
        itemId: 'item-04',
        sku: 'PAL-EXP-NIMF15',
        nombre: 'Pallet Certificado Tratamiento Térmico NIMF-15 (1200x1000mm)',
        ventasHistoricasMeses: { mesMeno3: 240, mesMeno2: 260, mesMeno1: 280 },
        factorEstacionalidad: 1.25,
        demandaProyectada30Dias: 350,
        demandaProyectada60Dias: 700,
        demandaProyectada90Dias: 1050,
        stockProyectadoFinMes: 180,
        fechaLimiteEmisionOC: '2026-11-05',
        cantidadSugeridaOC: 400,
        proveedorSugeridoRut: '76.812.004-9',
        proveedorSugeridoNombre: 'MADERAS Y EMBALAJES DEL SUR S.A.',
        costoEstimadoCompraCLP: 5280000,
        prioridad: 'MEDIA',
      },
    ];

    const defaultClientes: ClientCommercialProfile[] = [
      {
        id: 'cli-01',
        rut: '77.204.912-3',
        razonSocial: 'TRANSPORTES Y LOGÍSTICA TRANSANDINA S.A.',
        contactoNombre: 'Marcelo Contreras (Jefe de Flota)',
        email: 'mcontreras@transandina.cl',
        telefono: '+56 9 8412 9011',
        clasificacionAbc: 'A_VIP',
        facturacionAcumuladaCLP: 64200000,
        frecuenciaCompraDias: 14,
        diasDesdeUltimaCompra: 9,
        condicionVenta: 'CREDITO_30_DIAS',
        limiteCreditoCLP: 25000000,
        creditoUtilizadoCLP: 14800000,
        riesgoFidelizacion: 'BAJO',
        estrategiaAgente: 'Cliente VIP principal. Consumo continuo de lubricantes y filtros. Ofrecer descuento por pronto pago.',
      },
      {
        id: 'cli-02',
        rut: '76.992.418-K',
        razonSocial: 'AGRICOLA Y FRUTÍCOLA SAN ESTEBAN LTDA',
        contactoNombre: 'Camila Zúñiga (Encargada de Packing)',
        email: 'czuniga@sanesteban.cl',
        telefono: '+56 9 7622 1450',
        clasificacionAbc: 'A_VIP',
        facturacionAcumuladaCLP: 48900000,
        frecuenciaCompraDias: 21,
        diasDesdeUltimaCompra: 18,
        condicionVenta: 'CREDITO_30_DIAS',
        limiteCreditoCLP: 20000000,
        creditoUtilizadoCLP: 8400000,
        riesgoFidelizacion: 'BAJO',
        estrategiaAgente: 'Alta demanda estacional de pallets NIMF-15 para inicio de temporada de cerezas y arándanos.',
      },
      {
        id: 'cli-03',
        rut: '96.882.109-1',
        razonSocial: 'MINERA & CONSTRUCCIÓN NORTE GRANDE SPA',
        contactoNombre: 'Eduardo Valenzuela (Jefe de Compras)',
        email: 'evalenzuela@nortegrande.cl',
        telefono: '+56 9 9120 4433',
        clasificacionAbc: 'B_MEDIO',
        facturacionAcumuladaCLP: 28400000,
        frecuenciaCompraDias: 35,
        diasDesdeUltimaCompra: 48,
        condicionVenta: 'CREDITO_60_DIAS',
        limiteCreditoCLP: 15000000,
        creditoUtilizadoCLP: 0,
        riesgoFidelizacion: 'ALTO_INACTIVO',
        estrategiaAgente: '¡Alerta de Inactividad! Lleva 48 días sin comprar repuestos Parker ni sensores. Esteban sugiere contactar con oferta de mantención preventiva.',
      },
    ];

    const defaultPresupuesto: ProcurementBudgetCategory[] = [
      {
        categoriaId: 'cat-01',
        nombre: 'Mercaderías para Reventa (Pallets, Neumáticos)',
        presupuestoAprobadoCLP: 28000000,
        montoComprometidoOC: 6800000,
        montoFacturadoSII: 16400000,
        saldoDisponibleCLP: 4800000,
        porcentajeEjecutado: 82.86,
        estadoAlerta: 'NORMAL',
      },
      {
        categoriaId: 'cat-02',
        nombre: 'Insumos y Lubricantes Operacionales',
        presupuestoAprobadoCLP: 12000000,
        montoComprometidoOC: 2400000,
        montoFacturadoSII: 8900000,
        saldoDisponibleCLP: 700000,
        porcentajeEjecutado: 94.17,
        estadoAlerta: 'PRECAUCION',
      },
      {
        categoriaId: 'cat-03',
        nombre: 'Repuestos Críticos e Instrumentación',
        presupuestoAprobadoCLP: 8500000,
        montoComprometidoOC: 1800000,
        montoFacturadoSII: 4200000,
        saldoDisponibleCLP: 2500000,
        porcentajeEjecutado: 70.59,
        estadoAlerta: 'NORMAL',
      },
    ];

    const defaultOrdenes: PurchaseOrderRecord[] = [
      {
        id: 'oc-2026-001',
        folio: 'OC-2026-0089',
        fechaEmision: '2026-10-18',
        proveedorRut: '96.554.210-K',
        proveedorRazonSocial: 'PARKER HANNIFIN CHILE S.A.',
        condicionPago: 'Crédito 30 días',
        plazoEntregaDias: 5,
        items: [
          {
            sku: 'FILT-HID-04',
            nombre: 'Filtro Hidráulico Parker 10 Micrones Alta Presión',
            cantidad: 20,
            precioUnitarioCLP: 38640,
            subtotalNetoCLP: 772800,
          },
        ],
        totalNetoCLP: 772800,
        iva19CLP: 146832,
        totalBrutoCLP: 919632,
        estado: 'ENVIADA_PROVEEDOR',
        motivoGeneracion: 'Generado automáticamente por Agente Sr. para prevenir quiebre ante cotización de Transandina S.A.',
        autorizadoPorAgente: true,
      },
      {
        id: 'oc-2026-002',
        folio: 'OC-2026-0090',
        fechaEmision: '2026-10-19',
        proveedorRut: '76.812.004-9',
        proveedorRazonSocial: 'MADERAS Y EMBALAJES DEL SUR S.A.',
        condicionPago: 'Crédito 30 días',
        plazoEntregaDias: 6,
        items: [
          {
            sku: 'PAL-EXP-NIMF15',
            nombre: 'Pallet Certificado Tratamiento Térmico NIMF-15 (1200x1000mm)',
            cantidad: 300,
            precioUnitarioCLP: 12672,
            subtotalNetoCLP: 3801600,
          },
        ],
        totalNetoCLP: 3801600,
        iva19CLP: 722304,
        totalBrutoCLP: 4523904,
        estado: 'RECEPCIONADA_CONFORME',
        motivoGeneracion: 'Aprovisionamiento preventivo con descuento de volumen 4.0% por compra sobre 300 unidades.',
        autorizadoPorAgente: true,
      },
    ];

    const defaultCotizaciones: CommercialQuoteRecord[] = [
      {
        id: 'cot-2026-01',
        folio: 'COT-2026-0142',
        fechaEmision: '2026-10-20',
        clienteRut: '77.204.912-3',
        clienteRazonSocial: 'TRANSPORTES Y LOGÍSTICA TRANSANDINA S.A.',
        validezDias: 15,
        items: [
          {
            sku: 'FILT-HID-04',
            nombre: 'Filtro Hidráulico Parker 10 Micrones Alta Presión',
            cantidad: 10,
            precioUnitarioCLP: 58000,
            costoUnitarioPMP: 38500,
            margenBrutoEstimadoPorcentaje: 27.59,
            subtotalNetoCLP: 580000,
          },
          {
            sku: 'LUB-MOB-15W40',
            nombre: 'Aceite Sintético Mobil Delvac Modern 15W-40 (Litros)',
            cantidad: 500,
            precioUnitarioCLP: 6200,
            costoUnitarioPMP: 3850,
            margenBrutoEstimadoPorcentaje: 33.87,
            subtotalNetoCLP: 3100000,
          },
        ],
        totalNetoCLP: 3680000,
        iva19CLP: 699200,
        totalBrutoCLP: 4379200,
        margenBrutoTotalPorcentaje: 32.88,
        estado: 'ENVIADA_CLIENTE',
        validacionStockRealizada: true,
      },
    ];

    const defaultRfqs: RfqRequest[] = [
      {
        id: 'rfq-2026-0042',
        empresaId,
        folioRfq: 'RFQ-2026-0042',
        titulo: 'Licitación Repuestos Hidráulicos y Filtros Alta Presión para Maquinaria',
        fechaEmision: '2026-10-18',
        fechaLimiteRespuesta: '2026-10-24',
        diasPlazoRespuesta: 6,
        estado: 'EN_EVALUACION',
        items: [
          {
            sku: 'FILT-HID-04',
            nombre: 'Filtro Hidráulico Parker 10 Micrones Alta Presión',
            cantidad: 100,
            unidadMedida: 'UN',
            precioReferencialPmp: 38500,
            especificaciones: 'Compatibilidad estándar Parker serie 10MFP, presión máx 420 bar, certificación ISO 16889.',
          },
          {
            sku: 'LUB-MOB-15W40',
            nombre: 'Aceite Sintético Mobil Delvac Modern 15W-40',
            cantidad: 200,
            unidadMedida: 'LITROS',
            precioReferencialPmp: 3850,
            especificaciones: 'Balde o tambor sellado fábrica, especificación API CK-4 / CJ-4.',
          },
        ],
        proveedoresInvitados: [
          {
            id: 'resp-001',
            rfqId: 'rfq-2026-0042',
            proveedorRut: '76.888.999-1',
            proveedorRazonSocial: 'PARKER HANNIFIN CHILE SPA',
            emailContacto: 'contacto.ventas@parkerchile.cl',
            telefonoContacto: '+56 2 2840 9200',
            estadoSeguimiento: 'COTIZADA',
            fechaEnvio: '2026-10-18T09:00:00Z',
            fechaLectura: '2026-10-18T10:14:00Z',
            fechaRespuesta: '2026-10-19T14:30:00Z',
            cantidadReiteraciones: 0,
            montoNetoOfertado: 4620000,
            plazoEntregaDiasOfertado: 3,
            condicionPagoOfertada: 'Crédito 60 días',
            costoFleteClp: 0,
            scoringPonderadoTotal: 94.8,
            itemsCotizados: [
              { sku: 'FILT-HID-04', nombre: 'Filtro Hidráulico Parker 10 Micrones', cantidad: 100, precioUnitarioOfertado: 38500, subtotalNetoOfertado: 3850000 },
              { sku: 'LUB-MOB-15W40', nombre: 'Aceite Sintético 15W-40', cantidad: 200, precioUnitarioOfertado: 3850, subtotalNetoOfertado: 770000 },
            ],
            observacionesProveedor: 'Entrega en bodega central Quellón sin costo de flete. Stock para despacho inmediato.',
            esOfertaGanadora: false,
          },
          {
            id: 'resp-002',
            rfqId: 'rfq-2026-0042',
            proveedorRut: '77.123.456-7',
            proveedorRazonSocial: 'HYDRAULIC SOLUTIONS DEL SUR LTDA.',
            emailContacto: 'cotizaciones@hydraulicsur.cl',
            telefonoContacto: '+56 65 223 4567',
            estadoSeguimiento: 'COTIZADA',
            fechaEnvio: '2026-10-18T09:00:00Z',
            fechaLectura: '2026-10-18T11:45:00Z',
            fechaRespuesta: '2026-10-20T11:00:00Z',
            cantidadReiteraciones: 1,
            ultimoRecordatorioAt: '2026-10-19T16:00:00Z',
            montoNetoOfertado: 4890000,
            plazoEntregaDiasOfertado: 5,
            condicionPagoOfertada: 'Crédito 30 días',
            costoFleteClp: 65000,
            scoringPonderadoTotal: 82.5,
            itemsCotizados: [
              { sku: 'FILT-HID-04', nombre: 'Filtro Hidráulico Parker 10 Micrones', cantidad: 100, precioUnitarioOfertado: 41000, subtotalNetoOfertado: 4100000 },
              { sku: 'LUB-MOB-15W40', nombre: 'Aceite Sintético 15W-40', cantidad: 200, precioUnitarioOfertado: 3950, subtotalNetoOfertado: 790000 },
            ],
            observacionesProveedor: 'Despacho desde sucursal Puerto Montt. Flete terrestre a cargo del comprador.',
            esOfertaGanadora: false,
          },
          {
            id: 'resp-003',
            rfqId: 'rfq-2026-0042',
            proveedorRut: '76.456.789-0',
            proveedorRazonSocial: 'MAESTRANZA & OLEOHIDRÁULICA PUERTO MONTT SPA',
            emailContacto: 'licitaciones@oleohidraulicapm.cl',
            telefonoContacto: '+56 65 255 8900',
            estadoSeguimiento: 'EN_PREPARACION',
            fechaEnvio: '2026-10-18T09:00:00Z',
            fechaLectura: '2026-10-19T09:30:00Z',
            cantidadReiteraciones: 1,
            ultimoRecordatorioAt: '2026-10-20T10:00:00Z',
            esOfertaGanadora: false,
          },
          {
            id: 'resp-004',
            rfqId: 'rfq-2026-0042',
            proveedorRut: '78.345.678-9',
            proveedorRazonSocial: 'DISTRIBUIDORA INDUSTRIAL QUELLÓN LTDA.',
            emailContacto: 'ventas@indquellon.cl',
            telefonoContacto: '+56 65 268 1234',
            estadoSeguimiento: 'NO_RESPONDE_RETRASADO',
            fechaEnvio: '2026-10-18T09:00:00Z',
            cantidadReiteraciones: 2,
            ultimoRecordatorioAt: '2026-10-21T09:15:00Z',
            esOfertaGanadora: false,
          },
        ],
        recomendacionAgenteSr: 'Esteban Morales (Gerente Comercial & Aprovisionamiento Sr.): Recomiendo adjudicar sin demora a Parker Hannifin Chile SpA. Cumple con la mejor matriz TCO (94.8 pts): ofrece el menor costo neto ($4.620.000 CLP), flete bonificado ($0), el plazo más expedito (3 días) y financiamiento a 60 días sin interés, protegiendo el flujo de caja operacional.',
        createdAt: '2026-10-18T09:00:00Z',
      },
      {
        id: 'rfq-2026-0039',
        empresaId,
        folioRfq: 'RFQ-2026-0039',
        titulo: 'Suministro Lote Pallets Certificados Tratamiento Térmico NIMF-15',
        fechaEmision: '2026-10-12',
        fechaLimiteRespuesta: '2026-10-16',
        diasPlazoRespuesta: 4,
        estado: 'ADJUDICADA',
        items: [
          {
            sku: 'PAL-EXP-NIMF15',
            nombre: 'Pallet Certificado Tratamiento Térmico NIMF-15 (1200x1000mm)',
            cantidad: 300,
            unidadMedida: 'UN',
            precioReferencialPmp: 13200,
            especificaciones: 'Norma fitosanitaria SAG NIMF-15 con timbre a fuego legible, capacidad dinámica 1500 kg.',
          },
        ],
        proveedorGanadorRut: '76.812.004-9',
        proveedorGanadorNombre: 'MADERAS Y EMBALAJES DEL SUR S.A.',
        ordenCompraGeneradaId: 'oc-2026-002',
        folioOrdenCompra: 'OC-2026-0090',
        motivoAdjudicacion: 'Adjudicado a Maderas y Embalajes del Sur S.A. por ofrecer descuento por escala de 4.0% ($12.672/u neto) y entrega en 6 días con stock certificado.',
        proveedoresInvitados: [
          {
            id: 'resp-010',
            rfqId: 'rfq-2026-0039',
            proveedorRut: '76.812.004-9',
            proveedorRazonSocial: 'MADERAS Y EMBALAJES DEL SUR S.A.',
            emailContacto: 'pedidos@maderasdelsur.cl',
            estadoSeguimiento: 'COTIZADA',
            fechaEnvio: '2026-10-12T10:00:00Z',
            fechaRespuesta: '2026-10-14T11:20:00Z',
            cantidadReiteraciones: 0,
            montoNetoOfertado: 3801600,
            plazoEntregaDiasOfertado: 6,
            condicionPagoOfertada: 'Crédito 30 días',
            costoFleteClp: 0,
            scoringPonderadoTotal: 96.2,
            esOfertaGanadora: true,
          },
          {
            id: 'resp-011',
            rfqId: 'rfq-2026-0039',
            proveedorRut: '79.111.222-3',
            proveedorRazonSocial: 'PALLETS & EMBALAJES BIOBÍO LTDA.',
            emailContacto: 'ventas@biobiopallets.cl',
            estadoSeguimiento: 'COTIZADA',
            fechaEnvio: '2026-10-12T10:00:00Z',
            fechaRespuesta: '2026-10-15T16:00:00Z',
            cantidadReiteraciones: 1,
            montoNetoOfertado: 4125000,
            plazoEntregaDiasOfertado: 8,
            condicionPagoOfertada: 'Contado contra entrega',
            costoFleteClp: 120000,
            scoringPonderadoTotal: 74.0,
            esOfertaGanadora: false,
          },
        ],
        recomendacionAgenteSr: 'Maderas del Sur es proveedor homologado preferente, ofrece mejor precio por unidad y flete incluido en el radio de entrega.',
        createdAt: '2026-10-12T10:00:00Z',
      },
    ];

    this.statesByCompany[empresaId] = {
      empresaId,
      kpis: {
        facturacionMesCLP: 44250000,
        metaFacturacionMesCLP: 50000000,
        porcentajeCumplimientoMeta: 88.5,
        margenBrutoPonderadoPorcentaje: 31.8,
        presupuestoComprasAprobadoCLP: 48500000,
        presupuestoComprasEjecutadoCLP: 41000000,
        porcentajePresupuestoEjecutado: 84.5,
        itemsEnRiesgoQuiebreCount: 2,
        capitalInmovilizadoSobreStockCLP: 10780000,
        slaCumplimientoProveedoresPromedio: 94.6,
      },
      margenes: defaultMargenes,
      sinergiaStock: defaultSinergia,
      proveedores: defaultProveedores,
      forecasting: defaultForecasting,
      clientesClave: defaultClientes,
      presupuestoCategorias: defaultPresupuesto,
      ordenesCompra: defaultOrdenes,
      cotizaciones: defaultCotizaciones,
      rfqs: defaultRfqs,
      ultimaActualizacion: new Date().toISOString(),
    };
  }

  public getState(empresaId: string): CommercialProcurementState {
    if (!this.statesByCompany[empresaId]) {
      this.initDefaultState(empresaId);
    } else if (!(empresaId === 'client-retail-01' && isDemoModeEnabled())) {
      const dp = getDiskPersistence();
      const tenantRfqs = dp ? dp.getAutoRfqs(empresaId) : [];
      if (tenantRfqs.length > 0) {
        this.statesByCompany[empresaId].rfqs = tenantRfqs;
      }
    }
    return this.statesByCompany[empresaId];
  }

  public adjustSellingPrice(
    empresaId: string,
    sku: string,
    nuevoPrecioVenta: number,
    motivo: string
  ): { success: boolean; updatedItem?: ProductMarginAnalysis; message: string } {
    const state = this.getState(empresaId);
    const item = state.margenes.find((m) => m.sku === sku);
    if (!item) {
      return { success: false, message: `Producto SKU '${sku}' no encontrado.` };
    }

    item.precioVentaLista = Math.round(nuevoPrecioVenta);
    item.margenBrutoCLP = item.precioVentaLista - item.ultimoPrecioCompra;
    item.margenBrutoPorcentaje = Number(
      (((item.margenBrutoCLP) / item.precioVentaLista) * 100).toFixed(2)
    );

    if (item.margenBrutoPorcentaje >= item.margenTargetPorcentaje) {
      item.estadoMargen = 'OPTIMO';
      item.alertaAgente = `Margen restaurado exitosamente a ${item.margenBrutoPorcentaje}% por Esteban Morales (${motivo}).`;
    } else if (item.margenBrutoPorcentaje > 0) {
      item.estadoMargen = 'AJUSTADO';
      item.alertaAgente = `Precio actualizado a $${nuevoPrecioVenta.toLocaleString('es-CL')} CLP. Margen ajustado a ${item.margenBrutoPorcentaje}%.`;
    } else {
      item.estadoMargen = 'NEGATIVO';
      item.alertaAgente = 'Alerta crítica: El precio fijado genera pérdida operacional.';
    }

    state.ultimaActualizacion = new Date().toISOString();
    return {
      success: true,
      updatedItem: item,
      message: `Precio de lista de '${item.nombre}' actualizado a $${nuevoPrecioVenta.toLocaleString('es-CL')} CLP con margen del ${item.margenBrutoPorcentaje}%.`,
    };
  }

  public createPurchaseOrder(
    empresaId: string,
    data: {
      proveedorRut: string;
      proveedorRazonSocial: string;
      condicionPago?: string;
      plazoEntregaDias?: number;
      items: Array<{
        sku: string;
        nombre: string;
        cantidad: number;
        precioUnitarioCLP: number;
      }>;
      motivoGeneracion?: string;
      estado?: PurchaseOrderRecord['estado'];
    }
  ): PurchaseOrderRecord {
    const state = this.getState(empresaId);
    const nextNum = state.ordenesCompra.length + 91;
    const folio = `OC-2026-0${nextNum}`;

    const itemsCalculated = data.items.map((it) => ({
      ...it,
      subtotalNetoCLP: Math.round(it.cantidad * it.precioUnitarioCLP),
    }));

    const totalNetoCLP = itemsCalculated.reduce((acc, it) => acc + it.subtotalNetoCLP, 0);
    const iva19CLP = Math.round(totalNetoCLP * 0.19);
    const totalBrutoCLP = totalNetoCLP + iva19CLP;

    const newOrder: PurchaseOrderRecord = {
      id: `oc-${Date.now()}`,
      folio,
      fechaEmision: new Date().toISOString().split('T')[0],
      proveedorRut: data.proveedorRut,
      proveedorRazonSocial: data.proveedorRazonSocial,
      // 4.5: sin condiciones informadas quedan por confirmar (antes: crédito 30 días y entrega en 5 días supuestos).
      condicionPago: data.condicionPago || 'Por confirmar con el proveedor',
      plazoEntregaDias: data.plazoEntregaDias ?? null,
      items: itemsCalculated,
      totalNetoCLP,
      iva19CLP,
      totalBrutoCLP,
      estado: data.estado || 'EMITIDA',
      motivoGeneracion: data.motivoGeneracion || 'Orden de compra ejecutada por Esteban Morales (Gerente Comercial & Aprovisionamiento Sr.)',
      autorizadoPorAgente: true,
    };

    state.ordenesCompra.unshift(newOrder);

    // Actualizar balance de sinergia de stock
    data.items.forEach((ordIt) => {
      const stockItem = state.sinergiaStock.find((s) => s.sku === ordIt.sku);
      if (stockItem) {
        stockItem.stockDisponible += ordIt.cantidad;
        stockItem.balanceDisponibilidad += ordIt.cantidad;
        if (stockItem.balanceDisponibilidad >= 0) {
          stockItem.riesgoQuiebre = false;
          stockItem.accionRecomendada = 'BALANCEADO';
          stockItem.alertaAgente = `Reabastecimiento cubierto mediante ${folio} (${ordIt.cantidad} unids).`;
        }
      }
    });

    state.kpis.itemsEnRiesgoQuiebreCount = state.sinergiaStock.filter((s) => s.riesgoQuiebre).length;
    state.ultimaActualizacion = new Date().toISOString();

    return newOrder;
  }

  public createCommercialQuote(
    empresaId: string,
    data: {
      clienteRut: string;
      clienteRazonSocial: string;
      validezDias?: number;
      items: Array<{
        sku: string;
        nombre: string;
        cantidad: number;
        precioUnitarioCLP?: number;
        precioUnitario?: number;
      }>;
    }
  ): CommercialQuoteRecord {
    const state = this.getState(empresaId);
    const nextNum = state.cotizaciones.length + 143;
    const folio = `COT-2026-0${nextNum}`;

    let totalCostoPMP = 0;
    const itemsCalculated = (data.items || []).map((it) => {
      const cantidad = Number(it.cantidad || 0);
      const unitPrice = Number(it.precioUnitarioCLP ?? it.precioUnitario ?? 0);
      const subtotalNetoCLP = Math.round(cantidad * unitPrice);
      const marginItem = state.margenes.find((m) => m.sku === it.sku);
      const costoUnitario = marginItem ? marginItem.costoUnitarioPMP : Math.round(unitPrice * 0.7);
      totalCostoPMP += costoUnitario * cantidad;
      const margenItemPorc = unitPrice > 0
        ? Number((((unitPrice - costoUnitario) / unitPrice) * 100).toFixed(2))
        : 0;

      return {
        sku: it.sku,
        nombre: it.nombre,
        cantidad,
        precioUnitarioCLP: unitPrice,
        costoUnitarioPMP: costoUnitario,
        margenBrutoEstimadoPorcentaje: margenItemPorc,
        subtotalNetoCLP,
      };
    });

    const totalNetoCLP = itemsCalculated.reduce((acc, it) => acc + (it.subtotalNetoCLP || 0), 0);
    const iva19CLP = Math.round(totalNetoCLP * 0.19);
    const totalBrutoCLP = totalNetoCLP + iva19CLP;
    const margenBrutoTotalPorcentaje = totalNetoCLP > 0
      ? Number((((totalNetoCLP - totalCostoPMP) / totalNetoCLP) * 100).toFixed(2))
      : 0;

    const newQuote: CommercialQuoteRecord = {
      id: `cot-${Date.now()}`,
      folio,
      fechaEmision: new Date().toISOString().split('T')[0],
      clienteRut: data.clienteRut || '',
      clienteRazonSocial: data.clienteRazonSocial || 'Cliente General',
      validezDias: Number(data.validezDias || 15),
      items: itemsCalculated,
      totalNetoCLP: totalNetoCLP || 0,
      iva19CLP: iva19CLP || 0,
      totalBrutoCLP: totalBrutoCLP || 0,
      margenBrutoTotalPorcentaje: margenBrutoTotalPorcentaje || 0,
      estado: 'ENVIADA_CLIENTE',
      validacionStockRealizada: true,
    };

    state.cotizaciones.unshift(newQuote);

    // Sumar a cotizaciones abiertas en sinergia
    data.items.forEach((qIt) => {
      const stockItem = state.sinergiaStock.find((s) => s.sku === qIt.sku);
      if (stockItem) {
        stockItem.cotizacionesAbiertas += qIt.cantidad;
        stockItem.balanceDisponibilidad -= qIt.cantidad;
        if (stockItem.balanceDisponibilidad < 0) {
          stockItem.riesgoQuiebre = true;
          stockItem.accionRecomendada = 'COMPRA_URGENTE';
          stockItem.alertaAgente = `¡Atención! Cotización ${folio} compromete ${qIt.cantidad} unids superando el stock disponible.`;
        }
      }
    });

    state.kpis.itemsEnRiesgoQuiebreCount = state.sinergiaStock.filter((s) => s.riesgoQuiebre).length;
    state.ultimaActualizacion = new Date().toISOString();

    return newQuote;
  }

  public createRfq(
    empresaId: string,
    data: {
      titulo: string;
      diasPlazoRespuesta?: number;
      items: RfqItemDetail[];
      proveedorRuts: string[];
    }
  ): RfqRequest {
    const state = this.getState(empresaId);
    const nextNum = state.rfqs.length + 43;
    const folioRfq = `RFQ-2026-00${nextNum}`;
    const dias = data.diasPlazoRespuesta || 5;
    const fechaEmision = new Date().toISOString().split('T')[0];
    const fechaLimite = new Date(Date.now() + dias * 86400000).toISOString().split('T')[0];
    const rfqId = `rfq-${Date.now()}`;

    const proveedoresInvitados: RfqSupplierResponse[] = data.proveedorRuts.map((rut, idx) => {
      const pInfo = state.proveedores.find((p) => p.rut === rut);
      return {
        id: `resp-${Date.now()}-${idx}`,
        rfqId,
        proveedorRut: rut,
        proveedorRazonSocial: pInfo ? pInfo.razonSocial : `Proveedor ${rut}`,
        emailContacto: pInfo ? pInfo.emailContacto : 'contacto@proveedor.cl',
        telefonoContacto: pInfo ? pInfo.telefono : undefined,
        estadoSeguimiento: 'ENVIADA',
        fechaEnvio: new Date().toISOString(),
        cantidadReiteraciones: 0,
        esOfertaGanadora: false,
      };
    });

    const newRfq: RfqRequest = {
      id: rfqId,
      empresaId,
      folioRfq,
      titulo: data.titulo,
      fechaEmision,
      fechaLimiteRespuesta: fechaLimite,
      diasPlazoRespuesta: dias,
      estado: 'ENVIADA',
      items: data.items,
      proveedoresInvitados,
      recomendacionAgenteSr: `Esteban Morales: Solicitud emitida a ${proveedoresInvitados.length} proveedores homologados. Plazo de cierre: ${fechaLimite}. Se activó el seguimiento automático de cotizaciones.`,
      createdAt: new Date().toISOString(),
    };

    state.rfqs.unshift(newRfq);
    state.ultimaActualizacion = new Date().toISOString();

    const dp = getDiskPersistence();
    if (dp) {
      dp.saveRfqRequest(newRfq);
      proveedoresInvitados.forEach((resp) => dp.saveRfqSupplierResponse(resp));
    }

    return newRfq;
  }

  public sendSupplierReminder(
    empresaId: string,
    rfqId: string,
    supplierRut: string
  ): { success: boolean; message: string; response?: RfqSupplierResponse } {
    const state = this.getState(empresaId);
    const rfq = state.rfqs.find((r) => r.id === rfqId);
    if (!rfq) return { success: false, message: 'Solicitud de cotización RFQ no encontrada.' };

    const supplierResp = rfq.proveedoresInvitados.find((p) => p.proveedorRut === supplierRut);
    if (!supplierResp) return { success: false, message: 'Proveedor no encontrado en la licitación.' };

    supplierResp.cantidadReiteraciones += 1;
    supplierResp.ultimoRecordatorioAt = new Date().toISOString();
    if (supplierResp.estadoSeguimiento === 'ENVIADA') {
      supplierResp.estadoSeguimiento = 'NO_RESPONDE_RETRASADO';
    }

    const msg = `Recordatorio #${supplierResp.cantidadReiteraciones} registrado internamente por Esteban Morales para '${supplierResp.proveedorRazonSocial}' (${supplierResp.emailContacto}) en la licitación ${rfq.folioRfq} (sin pasarela SMTP configurada).`;
    state.ultimaActualizacion = new Date().toISOString();

    getDiskPersistence()?.saveRfqSupplierResponse(supplierResp);

    return { success: true, message: msg, response: supplierResp };
  }

  public submitSupplierQuote(
    empresaId: string,
    rfqId: string,
    supplierRut: string,
    quoteData: {
      montoNetoOfertado: number;
      plazoEntregaDiasOfertado: number;
      condicionPagoOfertada: string;
      costoFleteClp?: number;
      observacionesProveedor?: string;
      itemsCotizados?: RfqSupplierQuoteItem[];
    }
  ): { success: boolean; message: string; response?: RfqSupplierResponse } {
    const state = this.getState(empresaId);
    const rfq = state.rfqs.find((r) => r.id === rfqId);
    if (!rfq) return { success: false, message: 'RFQ no encontrada.' };

    const supplierResp = rfq.proveedoresInvitados.find((p) => p.proveedorRut === supplierRut);
    if (!supplierResp) return { success: false, message: 'Proveedor no encontrado en RFQ.' };

    const pEvaluation = state.proveedores.find((p) => p.rut === supplierRut);

    // Calcular Scoring Ponderado TCO (0-100 pts)
    const totalRefPmp = rfq.items.reduce((acc, it) => acc + (it.cantidad * it.precioReferencialPmp), 0);
    const ratioPrecio = totalRefPmp > 0 ? (totalRefPmp / quoteData.montoNetoOfertado) : 1;
    const precioScore = Math.min(45, Math.max(15, Number((45 * ratioPrecio).toFixed(1))));

    const plazoScore = quoteData.plazoEntregaDiasOfertado <= 3 ? 20 : quoteData.plazoEntregaDiasOfertado <= 5 ? 17 : quoteData.plazoEntregaDiasOfertado <= 8 ? 12 : 7;

    const cond = (quoteData.condicionPagoOfertada || '').toLowerCase();
    const pagoScore = cond.includes('90') ? 20 : cond.includes('60') ? 19 : cond.includes('30') ? 15 : 8;

    const slaScore = pEvaluation ? Number(((pEvaluation.scoringGeneral / 5.0) * 15).toFixed(1)) : 12;

    const scoringPonderadoTotal = Number((precioScore + plazoScore + pagoScore + slaScore).toFixed(1));

    supplierResp.estadoSeguimiento = 'COTIZADA';
    supplierResp.fechaRespuesta = new Date().toISOString();
    supplierResp.montoNetoOfertado = quoteData.montoNetoOfertado;
    supplierResp.plazoEntregaDiasOfertado = quoteData.plazoEntregaDiasOfertado;
    supplierResp.condicionPagoOfertada = quoteData.condicionPagoOfertada;
    supplierResp.costoFleteClp = quoteData.costoFleteClp || 0;
    supplierResp.observacionesProveedor = quoteData.observacionesProveedor || 'Oferta formal recibida.';
    supplierResp.itemsCotizados = quoteData.itemsCotizados;
    supplierResp.scoringPonderadoTotal = scoringPonderadoTotal;

    if (rfq.estado === 'ENVIADA') {
      rfq.estado = 'EN_EVALUACION';
    }

    // Actualizar recomendación del agente Sr.
    const cotizadas = rfq.proveedoresInvitados.filter((p) => p.estadoSeguimiento === 'COTIZADA' && p.scoringPonderadoTotal);
    if (cotizadas.length > 0) {
      cotizadas.sort((a, b) => (b.scoringPonderadoTotal || 0) - (a.scoringPonderadoTotal || 0));
      const best = cotizadas[0];
      rfq.recomendacionAgenteSr = `Esteban Morales (Gerente Comercial & Aprovisionamiento Sr.): Evaluadas ${cotizadas.length} ofertas, la propuesta líder es de ${best.proveedorRazonSocial} con scoring TCO de ${best.scoringPonderadoTotal} pts (Monto neto: $${(best.montoNetoOfertado || 0).toLocaleString('es-CL')} CLP, ${best.condicionPagoOfertada}, plazo ${best.plazoEntregaDiasOfertado} días).`;
    }

    state.ultimaActualizacion = new Date().toISOString();
    const dp = getDiskPersistence();
    if (dp) {
      dp.saveRfqRequest(rfq);
      dp.saveRfqSupplierResponse(supplierResp);
    }

    return {
      success: true,
      message: `Cotización de '${supplierResp.proveedorRazonSocial}' registrada exitosamente. Score TCO: ${scoringPonderadoTotal} pts.`,
      response: supplierResp,
    };
  }

  public awardRfq(
    empresaId: string,
    rfqId: string,
    winningSupplierRut: string,
    motivoAdjudicacion?: string
  ): {
    success: boolean;
    message: string;
    rfq?: RfqRequest;
    purchaseOrder?: PurchaseOrderRecord;
  } {
    const state = this.getState(empresaId);
    const rfq = state.rfqs.find((r) => r.id === rfqId);
    if (!rfq) return { success: false, message: 'RFQ no encontrada.' };

    const winningSupplier = rfq.proveedoresInvitados.find((p) => p.proveedorRut === winningSupplierRut);
    if (!winningSupplier) return { success: false, message: 'Proveedor ganador no encontrado en esta licitación.' };

    // Marcar adjudicación
    rfq.proveedoresInvitados.forEach((p) => {
      p.esOfertaGanadora = p.proveedorRut === winningSupplierRut;
    });

    rfq.estado = 'ADJUDICADA';
    rfq.proveedorGanadorRut = winningSupplier.proveedorRut;
    rfq.proveedorGanadorNombre = winningSupplier.proveedorRazonSocial;
    rfq.motivoAdjudicacion = motivoAdjudicacion || `Adjudicado a ${winningSupplier.proveedorRazonSocial} por mejor puntuación TCO (${winningSupplier.scoringPonderadoTotal || 95} pts) y condiciones comerciales óptimas.`;

    // Generar Orden de Compra oficial de inmediato
    const nextNum = state.ordenesCompra.length + 92;
    const folioOc = `OC-2026-0${nextNum}`;
    const fechaEmision = new Date().toISOString().split('T')[0];
    const plazoDias = winningSupplier.plazoEntregaDiasOfertado || 5;

    // Generar items para la OC
    const ocItems = winningSupplier.itemsCotizados && winningSupplier.itemsCotizados.length > 0
      ? winningSupplier.itemsCotizados.map((cit) => ({
          sku: cit.sku,
          nombre: cit.nombre,
          cantidad: cit.cantidad,
          precioUnitarioCLP: cit.precioUnitarioOfertado,
          subtotalNetoCLP: cit.subtotalNetoOfertado,
        }))
      : rfq.items.map((it) => {
          const precioU = Math.round((winningSupplier.montoNetoOfertado || 100000) / (rfq.items.length * it.cantidad));
          return {
            sku: it.sku,
            nombre: it.nombre,
            cantidad: it.cantidad,
            precioUnitarioCLP: precioU,
            subtotalNetoCLP: precioU * it.cantidad,
          };
        });

    const totalNetoCLP = winningSupplier.montoNetoOfertado || ocItems.reduce((acc, it) => acc + it.subtotalNetoCLP, 0);
    const iva19CLP = Math.round(totalNetoCLP * 0.19);
    const totalBrutoCLP = totalNetoCLP + iva19CLP;

    const newOc: PurchaseOrderRecord = {
      id: `oc-${Date.now()}`,
      folio: folioOc,
      fechaEmision,
      proveedorRut: winningSupplier.proveedorRut,
      proveedorRazonSocial: winningSupplier.proveedorRazonSocial,
      condicionPago: winningSupplier.condicionPagoOfertada || 'Crédito 30 días',
      plazoEntregaDias: plazoDias,
      items: ocItems,
      totalNetoCLP,
      iva19CLP,
      totalBrutoCLP,
      estado: 'EMITIDA',
      motivoGeneracion: `Generada automáticamente tras adjudicación de ${rfq.folioRfq}. ${rfq.motivoAdjudicacion}`,
      autorizadoPorAgente: true,
    };

    state.ordenesCompra.unshift(newOc);
    rfq.ordenCompraGeneradaId = newOc.id;
    rfq.folioOrdenCompra = newOc.folio;

    // Actualizar sinergia de stock
    ocItems.forEach((ordIt) => {
      const stockItem = state.sinergiaStock.find((s) => s.sku === ordIt.sku);
      if (stockItem) {
        stockItem.stockDisponible += ordIt.cantidad;
        stockItem.balanceDisponibilidad += ordIt.cantidad;
        if (stockItem.balanceDisponibilidad >= 0) {
          stockItem.riesgoQuiebre = false;
          stockItem.accionRecomendada = 'BALANCEADO';
          stockItem.alertaAgente = `Abastecimiento asegurado vía ${folioOc} (${ordIt.cantidad} unids).`;
        }
      }
    });

    state.kpis.itemsEnRiesgoQuiebreCount = state.sinergiaStock.filter((s) => s.riesgoQuiebre).length;
    state.ultimaActualizacion = new Date().toISOString();

    const dpAward = getDiskPersistence();
    if (dpAward) {
      dpAward.saveRfqRequest(rfq);
      dpAward.saveRfqSupplierResponse(winningSupplier);
      dpAward.savePurchaseOrder(newOc);
    }

    return {
      success: true,
      message: `¡Licitación ${rfq.folioRfq} adjudicada a ${winningSupplier.proveedorRazonSocial}! Se generó la Orden de Compra oficial ${folioOc} por $${totalBrutoCLP.toLocaleString('es-CL')} CLP.`,
      rfq,
      purchaseOrder: newOc,
    };
  }

  public async runSeniorConsultation(
    empresaId: string,
    prompt: string,
    companyProfile?: any
  ): Promise<{ text: string; modelUsed: string; providerUsed: string }> {
    const state = this.getState(empresaId);
    const systemInstruction = `Eres Esteban Morales, Gerente de Gestión Comercial y Aprovisionamiento Senior de la empresa en Chile.
Eres la máxima autoridad en la sinergia estratégica entre Compras (adquisición, proveedores, costos PMP, plazos) y Ventas (precios, clientes VIP, margen bruto y pipeline comercial).
Cuentas con total libertad y criterio senior para tomar y proponer decisiones ejecutivas:
1. EQUILIBRIO DE MÁRGENES: Exige que ningún producto se venda bajo el margen target. Si el costo de reposición subió, recomienda el ajuste de precio de lista de inmediato.
2. ANTI-QUIEBRES Y CADENA DE SUMINISTRO: Cruza el stock físico disponible con las cotizaciones abiertas y la demanda proyectada. Si hay riesgo de quiebre, formula la Orden de Compra (OC) al proveedor preferente aprovechando escalas de descuento.
3. FORECASTING PREDICTIVO: Proyecta la demanda considerando el calendario comercial chileno (estacionalidad).
4. RELACIÓN CON CLIENTES CLAVE (VIP): Cuida los márgenes de los clientes clase A y alerta ante inactividad superior a 45 días.

ESTADO OPERATIVO ACTUAL DE LA EMPRESA:
- Facturación del mes: $${state.kpis.facturacionMesCLP.toLocaleString('es-CL')} CLP (Meta: $${state.kpis.metaFacturacionMesCLP.toLocaleString('es-CL')} CLP, Cumplimiento: ${state.kpis.porcentajeCumplimientoMeta}%)
- Margen Bruto Ponderado: ${state.kpis.margenBrutoPonderadoPorcentaje}%
- Ítems en riesgo de quiebre inminente: ${state.kpis.itemsEnRiesgoQuiebreCount} productos
- Capital inmovilizado en sobre-stock: $${state.kpis.capitalInmovilizadoSobreStockCLP.toLocaleString('es-CL')} CLP
- SLA Proveedores: ${state.kpis.slaCumplimientoProveedoresPromedio}%

Responde con autoridad técnica de Gerente Senior, lenguaje chileno corporativo riguroso, cifras concretas en $ CLP y recomendaciones accionables.`;

    const aiRes = await aiRouterService.executeAiTask({
      capability: 'REASONING_AUDIT',
      prompt,
      systemInstruction,
      temperature: 0.25,
      empresaId,
      modulo: 'COMERCIAL_APROVISIONAMIENTO_SR',
    });

    return {
      text: aiRes.text,
      modelUsed: aiRes.modelUsed,
      providerUsed: aiRes.providerUsed,
    };
  }
}

export const commercialProcurementService = new CommercialProcurementService();
