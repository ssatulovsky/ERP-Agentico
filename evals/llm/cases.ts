/**
 * 4.2 Consultas tipo por módulo (20 por agente, 12 agentes).
 *
 * Tres clases de casos:
 *  - HERRAMIENTA: el agente debe llamar `herramienta` y su dictamen solo puede citar cifras que
 *    entreguen las herramientas (y al menos una, si la herramienta devolvió datos).
 *  - PIDE_DATOS: faltan datos; el agente debe pedirlos y no proponer ni inventar nada.
 *  - FUERA_DE_ALCANCE: la tarea es de otro agente; debe decirlo y no inventar un resultado.
 *
 * `args` es lo que llamaría un agente ideal; lo usa el modo autoprueba (modelo oráculo) y sirve
 * de referencia al leer los resultados. Los marcadores {periodo}, {folioOP}, {reportId}, {rfqId},
 * {activoId}, {proveedorRut} y {empresaId} se reemplazan con los datos de la empresa de evaluación.
 */
export type EvalKind = 'HERRAMIENTA' | 'PIDE_DATOS' | 'FUERA_DE_ALCANCE';

export interface EvalCase {
  id: string;
  modulo: string;
  tipo: EvalKind;
  consulta: string;
  herramienta?: string;
  args?: Record<string, any>;
  /** FUERA_DE_ALCANCE: módulo al que corresponde la tarea. */
  derivarA?: string;
}

type Row = [EvalKind, string | null, string, Record<string, any>?];

const E = '{empresaId}';
const CSV_COMPRAS =
  'Nro;Tipo Doc;Tipo Compra;RUT Proveedor;Razon Social;Folio;Fecha Docto;Fecha Recepcion;Fecha Acuse;Monto Exento;Monto Neto;Monto IVA Recuperable;Monto Iva No Recuperable;Codigo IVA No Rec.;Monto Total\n' +
  '1;33;Del Giro;78555666-7;Aceros Sur S.A.;8813;25/10/2026;25/10/2026;;0;100000;19000;0;;119000';
const linea = (cuentaCodigo: string, cuentaNombre: string, debe: number, haber: number) => ({ cuentaCodigo, cuentaNombre, debe, haber });

const BANK: Row[] = [
  ['HERRAMIENTA', 'tool_bank_reconcile_movement', 'Concilia la cartola bancaria con el libro diario.', { empresaId: E }],
  ['HERRAMIENTA', 'tool_bank_reconcile_movement', '¿Qué movimientos del banco siguen sin calzar con un asiento?', { empresaId: E }],
  ['HERRAMIENTA', 'tool_bank_reconcile_movement', 'Haz la conciliación bancaria de octubre y dime cuántos movimientos quedaron pendientes.', { empresaId: E }],
  ['HERRAMIENTA', 'tool_bank_reconcile_movement', 'Revisa si el abono de Ferretería Norte ya tiene asiento contable.', { empresaId: E }],
  ['HERRAMIENTA', 'tool_bank_reconcile_movement', 'Cruza los movimientos de la cuenta corriente con la contabilidad, con tolerancia de 3 días.', { empresaId: E, toleranciaDias: 3 }],
  ['HERRAMIENTA', 'tool_bank_reconcile_movement', '¿Cuánto monto quedó calzado en la conciliación?', { empresaId: E }],
  ['HERRAMIENTA', 'tool_bank_reconcile_movement', 'Necesito el estado de la conciliación bancaria.', { empresaId: E }],
  ['HERRAMIENTA', 'tool_bank_reconcile_movement', 'Encuentra el asiento que corresponde al pago a Aceros Sur en la cartola.', { empresaId: E }],
  ['HERRAMIENTA', 'tool_bank_reconcile_movement', 'Audita la cartola: ¿hay cargos bancarios sin contabilizar?', { empresaId: E }],
  ['HERRAMIENTA', 'tool_bank_reconcile_movement', 'Corre la conciliación automática por monto y fecha.', { empresaId: E }],
  ['HERRAMIENTA', 'tool_bank_reconcile_movement', 'Dame un resumen de calces y pendientes del banco.', { empresaId: E }],
  ['HERRAMIENTA', 'tool_bank_reconcile_movement', '¿La comisión de mantención de cuenta está registrada en la contabilidad?', { empresaId: E }],
  ['HERRAMIENTA', 'tool_accounting_propose_entry', 'Registra el asiento de la comisión bancaria de $48.730: gasto bancario contra banco.', { glosaGeneral: 'Comisión mantención cuenta', tipoComprobante: 'EGRESO', lineas: [linea('5.1.09', 'Gastos bancarios', 48730, 0), linea('1.1.01', 'Banco', 0, 48730)] }],
  ['HERRAMIENTA', 'tool_accounting_propose_entry', 'Propón el asiento para contabilizar el cargo de $48.730 por comisión del banco.', { glosaGeneral: 'Comisión bancaria', tipoComprobante: 'EGRESO', lineas: [linea('5.1.09', 'Gastos bancarios', 48730, 0), linea('1.1.01', 'Banco', 0, 48730)] }],
  ['PIDE_DATOS', null, 'Registra el asiento del movimiento que falta.'],
  ['PIDE_DATOS', null, 'Contabiliza el último depósito.'],
  ['PIDE_DATOS', null, 'Crea el asiento de la transferencia de ayer.'],
  ['FUERA_DE_ALCANCE', null, 'Calcula el finiquito de Pedro Soto.', undefined],
  ['FUERA_DE_ALCANCE', null, 'Calcula el F29 de octubre.', undefined],
  ['FUERA_DE_ALCANCE', null, '¿Cuál es el kardex del perno M8?', undefined],
];

export const CASE_ROWS: Record<string, { rows: Row[]; derivar: Record<number, string> }> = {
  CONCILIACION: { rows: BANK, derivar: { 18: 'RRHH', 19: 'TRIBUTARIO_SII', 20: 'INVENTARIO' } },

  TESORERIA: {
    rows: [
      ...BANK.slice(0, 8),
      ['HERRAMIENTA', 'tool_cashflow_project_30_60_90', 'Proyecta la caja a 30, 60 y 90 días.', { empresaId: E }],
      ['HERRAMIENTA', 'tool_cashflow_project_30_60_90', '¿Cuál es el saldo de caja proyectado a 90 días?', { empresaId: E, horizonteDias: 90 }],
      ['HERRAMIENTA', 'tool_cashflow_project_30_60_90', '¿Nos alcanza la caja para pagar las remuneraciones del próximo mes?', { empresaId: E }],
      ['HERRAMIENTA', 'tool_cashflow_simulate_scenario', 'Simula qué pasa con la caja si las ventas caen 15%.', { variacionVentasPct: -15 }],
      ['HERRAMIENTA', 'tool_cashflow_simulate_scenario', 'Simula un retraso de 30 días en la cobranza.', { retrasoCobranzaDias: 30 }],
      ['HERRAMIENTA', 'tool_cashflow_simulate_scenario', 'Escenario: costos suben 10% y ventas bajan 5%. ¿Cómo queda la liquidez?', { aumentoCostosPct: 10, variacionVentasPct: -5 }],
      ['HERRAMIENTA', 'tool_accounting_propose_entry', 'Registra el traspaso de $500.000 de caja chica al banco.', { glosaGeneral: 'Traspaso caja chica a banco', tipoComprobante: 'TRASPASO', lineas: [linea('1.1.01', 'Banco', 500000, 0), linea('1.1.02', 'Caja chica', 0, 500000)] }],
      ['PIDE_DATOS', null, 'Paga a los proveedores que vencen esta semana.'],
      ['PIDE_DATOS', null, 'Registra el depósito a plazo.'],
      ['FUERA_DE_ALCANCE', null, 'Emite una factura a Constructora Andes.'],
      ['FUERA_DE_ALCANCE', null, 'Liquida el sueldo de Ana Muñoz.'],
      ['FUERA_DE_ALCANCE', null, 'Deprecia los activos fijos de octubre.'],
    ],
    derivar: { 18: 'FACTURACION_DTE', 19: 'RRHH', 20: 'ACTIVO_FIJO' },
  },

  CONTABILIDAD: {
    rows: [
      ['HERRAMIENTA', 'tool_sii_query_rcv', 'Muéstrame el registro de ventas de {periodo}.', { periodo: '{periodo}', tipoOperacion: 'VENTAS' }],
      ['HERRAMIENTA', 'tool_sii_query_rcv', '¿Cuánto compramos en {periodo} según el RCV?', { periodo: '{periodo}', tipoOperacion: 'COMPRAS' }],
      ['HERRAMIENTA', 'tool_sii_query_rcv', 'Lista las facturas de compra de octubre 2026.', { periodo: '{periodo}', tipoOperacion: 'COMPRAS' }],
      ['HERRAMIENTA', 'tool_sii_query_rcv', '¿Cuál es el IVA débito de las ventas de octubre 2026?', { periodo: '{periodo}', tipoOperacion: 'VENTAS' }],
      ['HERRAMIENTA', 'tool_sii_query_rcv', '¿A quién le vendimos en {periodo}?', { periodo: '{periodo}', tipoOperacion: 'VENTAS' }],
      ['HERRAMIENTA', 'tool_sii_reconcile_rcv_vs_ledger', 'Cuadra el RCV de {periodo} con el libro mayor.', { periodo: '{periodo}' }],
      ['HERRAMIENTA', 'tool_sii_reconcile_rcv_vs_ledger', '¿El IVA del libro mayor coincide con el SII en octubre 2026?', { periodo: '{periodo}' }],
      ['HERRAMIENTA', 'tool_sii_reconcile_rcv_vs_ledger', '¿Hay facturas en el RCV de {periodo} que no estén contabilizadas?', { periodo: '{periodo}' }],
      ['HERRAMIENTA', 'tool_sii_reconcile_rcv_vs_ledger', 'Revisa diferencias de IVA crédito entre el registro de compras y la contabilidad de {periodo}.', { periodo: '{periodo}' }],
      ['HERRAMIENTA', 'tool_accounting_propose_entry', 'Contabiliza la factura de venta 502 a Constructora Andes: neto $3.500.000, IVA $665.000, total $4.165.000.', { glosaGeneral: 'Venta factura 502 Constructora Andes', tipoComprobante: 'TRASPASO', lineas: [linea('1.1.03', 'Clientes', 4165000, 0), linea('4.1.01', 'Ventas', 0, 3500000), linea('2.1.05', 'IVA débito fiscal', 0, 665000)] }],
      ['HERRAMIENTA', 'tool_accounting_propose_entry', 'Registra la compra 3301 a Transportes Ruta 5: neto $450.000 más IVA $85.500.', { glosaGeneral: 'Compra factura 3301 Transportes Ruta 5', tipoComprobante: 'TRASPASO', lineas: [linea('5.1.04', 'Fletes', 450000, 0), linea('1.1.08', 'IVA crédito fiscal', 85500, 0), linea('2.1.01', 'Proveedores', 0, 535500)] }],
      ['HERRAMIENTA', 'tool_accounting_propose_entry', 'Propón el asiento de arriendo de oficina por $850.000 pagado por banco.', { glosaGeneral: 'Arriendo oficina', tipoComprobante: 'EGRESO', lineas: [linea('5.1.02', 'Arriendos', 850000, 0), linea('1.1.01', 'Banco', 0, 850000)] }],
      ['HERRAMIENTA', 'tool_accounting_propose_entry', 'Asiento: provisión de honorarios de auditoría por $1.200.000 por pagar.', { glosaGeneral: 'Provisión honorarios auditoría', tipoComprobante: 'TRASPASO', lineas: [linea('5.1.06', 'Honorarios', 1200000, 0), linea('2.1.03', 'Honorarios por pagar', 0, 1200000)] }],
      ['HERRAMIENTA', 'tool_accounting_propose_entry', 'Registra el cobro de la factura 501 por $2.380.000 en el banco.', { glosaGeneral: 'Cobro factura 501', tipoComprobante: 'INGRESO', lineas: [linea('1.1.01', 'Banco', 2380000, 0), linea('1.1.03', 'Clientes', 0, 2380000)] }],
      ['PIDE_DATOS', null, 'Registra un asiento de ajuste.'],
      ['PIDE_DATOS', null, 'Contabiliza la factura que llegó hoy.'],
      ['PIDE_DATOS', null, 'Corrige el asiento mal imputado.'],
      ['FUERA_DE_ALCANCE', null, 'Calcula el finiquito de Ana Muñoz por necesidades de la empresa.'],
      ['FUERA_DE_ALCANCE', null, 'Proyecta el flujo de caja a 90 días.'],
      ['FUERA_DE_ALCANCE', null, 'Revisa el stock crítico de bodega.'],
    ],
    derivar: { 18: 'RRHH', 19: 'FLUJO_CAJA', 20: 'INVENTARIO' },
  },

  TRIBUTARIO_SII: {
    rows: [
      ['HERRAMIENTA', 'tool_tax_calculate_f29', 'Calcula el F29 de {periodo}.', { periodo: '{periodo}' }],
      ['HERRAMIENTA', 'tool_tax_calculate_f29', '¿Cuánto IVA tenemos que pagar en octubre 2026?', { periodo: '{periodo}' }],
      ['HERRAMIENTA', 'tool_tax_calculate_f29', 'Prepara el borrador del formulario 29 del período {periodo}.', { periodo: '{periodo}' }],
      ['HERRAMIENTA', 'tool_tax_calculate_f29', '¿Cuál es el PPM de octubre 2026 con tasa 0,25%?', { periodo: '{periodo}', tasaPpm: 0.0025 }],
      ['HERRAMIENTA', 'tool_tax_calculate_f29', 'Débito y crédito fiscal de {periodo}, por favor.', { periodo: '{periodo}' }],
      ['HERRAMIENTA', 'tool_tax_calculate_f29', '¿Cuál es el total a pagar en el F29 de octubre 2026?', { periodo: '{periodo}' }],
      ['HERRAMIENTA', 'tool_sii_query_rcv', 'Consulta el registro de compras del SII de {periodo}.', { periodo: '{periodo}', tipoOperacion: 'COMPRAS' }],
      ['HERRAMIENTA', 'tool_sii_query_rcv', 'Trae las ventas de octubre 2026 desde el RCV.', { periodo: '{periodo}', tipoOperacion: 'VENTAS' }],
      ['HERRAMIENTA', 'tool_sii_query_rcv', '¿Cuántos documentos de compra hay en el RCV de {periodo}?', { periodo: '{periodo}', tipoOperacion: 'COMPRAS' }],
      ['HERRAMIENTA', 'tool_sii_reconcile_rcv_vs_ledger', '¿Cuadra el RCV de {periodo} con la contabilidad?', { periodo: '{periodo}' }],
      ['HERRAMIENTA', 'tool_sii_reconcile_rcv_vs_ledger', 'Antes de declarar, verifica diferencias entre RCV y libro mayor de octubre 2026.', { periodo: '{periodo}' }],
      ['HERRAMIENTA', 'tool_sii_sync_status', '¿Están configuradas las credenciales del SII de la empresa?', { empresaId: E }],
      ['HERRAMIENTA', 'tool_sii_sync_status', '¿Cuál es el estado de sincronización con el SII?', { empresaId: E }],
      ['HERRAMIENTA', 'tool_sii_ingest_csv', `Carga este CSV de compras de {periodo}:\n${CSV_COMPRAS}`, { periodo: '{periodo}', tipoOperacion: 'COMPRAS', csvContent: CSV_COMPRAS }],
      ['PIDE_DATOS', null, 'Calcula el F29.'],
      ['PIDE_DATOS', null, 'Declara el IVA del mes pasado en el SII.'],
      ['PIDE_DATOS', null, 'Carga el CSV del RCV.'],
      ['FUERA_DE_ALCANCE', null, 'Emite la factura 503 a Ferretería Norte.'],
      ['FUERA_DE_ALCANCE', null, 'Liquida las remuneraciones de octubre.'],
      ['FUERA_DE_ALCANCE', null, 'Concilia la cartola del banco.'],
    ],
    derivar: { 18: 'FACTURACION_DTE', 19: 'RRHH', 20: 'CONCILIACION' },
  },

  FACTURACION_DTE: {
    rows: [
      ['HERRAMIENTA', 'tool_billing_draft_dte', 'Prepara una factura electrónica a Constructora Andes SpA, RUT 76.333.444-5, giro construcción, por 20 estructuras a $175.000 neto cada una.', { tipoDte: 33, receptorRut: '76.333.444-5', receptorRazonSocial: 'Constructora Andes SpA', giroReceptor: 'Construcción', items: [{ descripcion: 'Estructura soporte galvanizada', cantidad: 20, precioUnitario: 175000 }] }],
      ['HERRAMIENTA', 'tool_billing_draft_dte', 'Borrador de factura 33 a Ferretería Norte Ltda. (77.111.222-3, giro ferretería): 100 cajas de perno M8 a $9.900.', { tipoDte: 33, receptorRut: '77.111.222-3', receptorRazonSocial: 'Ferretería Norte Ltda.', giroReceptor: 'Ferretería', items: [{ descripcion: 'Perno hexagonal M8 (caja 100)', cantidad: 100, precioUnitario: 9900 }] }],
      ['HERRAMIENTA', 'tool_billing_draft_dte', 'Factura exenta (34) a Fundación Mar Azul, RUT 65.123.456-7, giro beneficencia, por asesoría técnica de $600.000.', { tipoDte: 34, receptorRut: '65.123.456-7', receptorRazonSocial: 'Fundación Mar Azul', giroReceptor: 'Beneficencia', items: [{ descripcion: 'Asesoría técnica', cantidad: 1, precioUnitario: 600000 }] }],
      ['HERRAMIENTA', 'tool_billing_draft_dte', 'Haz el borrador de factura para Constructora Andes (76.333.444-5, construcción): 300 discos de corte 115 mm a $1.490.', { tipoDte: 33, receptorRut: '76.333.444-5', receptorRazonSocial: 'Constructora Andes SpA', giroReceptor: 'Construcción', items: [{ descripcion: 'Disco de corte 115 mm', cantidad: 300, precioUnitario: 1490 }] }],
      ['HERRAMIENTA', 'tool_billing_draft_dte', 'Necesito una factura a Ferretería Norte Ltda., RUT 77.111.222-3, giro ferretería, por 50 pares de guantes nitrilo a $2.600.', { tipoDte: 33, receptorRut: '77.111.222-3', receptorRazonSocial: 'Ferretería Norte Ltda.', giroReceptor: 'Ferretería', items: [{ descripcion: 'Guante nitrilo industrial (par)', cantidad: 50, precioUnitario: 2600 }] }],
      ['HERRAMIENTA', 'tool_billing_draft_dte', 'Borrador DTE 33: cliente Constructora Andes SpA 76.333.444-5, giro construcción, servicio de instalación $1.250.000 neto.', { tipoDte: 33, receptorRut: '76.333.444-5', receptorRazonSocial: 'Constructora Andes SpA', giroReceptor: 'Construcción', items: [{ descripcion: 'Servicio de instalación', cantidad: 1, precioUnitario: 1250000 }] }],
      ['HERRAMIENTA', 'tool_billing_draft_dte', 'Prepara la factura a Ferretería Norte Ltda. (77.111.222-3, ferretería) por 10 cajas de pernos M8 a $9.900 y 20 discos a $1.490.', { tipoDte: 33, receptorRut: '77.111.222-3', receptorRazonSocial: 'Ferretería Norte Ltda.', giroReceptor: 'Ferretería', items: [{ descripcion: 'Perno M8', cantidad: 10, precioUnitario: 9900 }, { descripcion: 'Disco de corte 115 mm', cantidad: 20, precioUnitario: 1490 }] }],
      ['HERRAMIENTA', 'tool_billing_draft_dte', 'Emite una factura a Constructora Andes SpA, 76.333.444-5, construcción, por 5 estructuras a $175.000.', { tipoDte: 33, receptorRut: '76.333.444-5', receptorRazonSocial: 'Constructora Andes SpA', giroReceptor: 'Construcción', items: [{ descripcion: 'Estructura soporte galvanizada', cantidad: 5, precioUnitario: 175000 }] }],
      ['HERRAMIENTA', 'tool_sii_sync_status', '¿Tenemos conexión vigente con el SII para emitir?', { empresaId: E }],
      ['HERRAMIENTA', 'tool_sii_sync_status', 'Revisa el estado de la sincronización con el SII antes de facturar.', { empresaId: E }],
      ['HERRAMIENTA', 'tool_sii_sync_status', '¿Están cargadas las credenciales SII de esta empresa?', { empresaId: E }],
      ['HERRAMIENTA', 'tool_billing_draft_dte', 'Factura 33 para Ferretería Norte Ltda., 77.111.222-3, giro ferretería: 1 servicio de despacho $45.000.', { tipoDte: 33, receptorRut: '77.111.222-3', receptorRazonSocial: 'Ferretería Norte Ltda.', giroReceptor: 'Ferretería', items: [{ descripcion: 'Servicio de despacho', cantidad: 1, precioUnitario: 45000 }] }],
      ['PIDE_DATOS', null, 'Hazle una factura a Constructora Andes.'],
      ['PIDE_DATOS', null, 'Emite una factura por $1.000.000.'],
      ['PIDE_DATOS', null, 'Prepara una factura para el cliente nuevo.'],
      ['PIDE_DATOS', null, 'Factura los productos de la semana.'],
      ['PIDE_DATOS', null, 'Emite una nota de crédito.'],
      ['FUERA_DE_ALCANCE', null, 'Calcula el F29 de octubre 2026.'],
      ['FUERA_DE_ALCANCE', null, 'Concilia el banco.'],
      ['FUERA_DE_ALCANCE', null, 'Calcula la nómina de octubre.'],
    ],
    derivar: { 18: 'TRIBUTARIO_SII', 19: 'CONCILIACION', 20: 'RRHH' },
  },

  COMERCIAL_COMPRAS: {
    rows: [
      ['HERRAMIENTA', 'tool_procurement_margin_analysis', '¿Qué productos tienen margen crítico?', { empresaId: E }],
      ['HERRAMIENTA', 'tool_procurement_margin_analysis', 'Analiza el margen del SKU GUA-NIT.', { empresaId: E, sku: 'GUA-NIT' }],
      ['HERRAMIENTA', 'tool_procurement_margin_analysis', '¿Cuál es el margen bruto ponderado de la empresa?', { empresaId: E }],
      ['HERRAMIENTA', 'tool_procurement_margin_analysis', '¿Estamos vendiendo algún producto bajo el 20% de margen?', { empresaId: E }],
      ['HERRAMIENTA', 'tool_procurement_margin_analysis', 'Margen del perno M8 (PER-M8).', { empresaId: E, sku: 'PER-M8' }],
      ['HERRAMIENTA', 'tool_procurement_compare_quotes', 'Compara las cotizaciones recibidas de la RFQ {rfqId}.', { rfqId: '{rfqId}' }],
      ['HERRAMIENTA', 'tool_procurement_compare_quotes', '¿Qué proveedor conviene para la RFQ {rfqId} considerando flete y plazo?', { rfqId: '{rfqId}' }],
      ['HERRAMIENTA', 'tool_procurement_compare_quotes', 'Cuadro comparativo de ofertas para {rfqId}.', { rfqId: '{rfqId}' }],
      ['HERRAMIENTA', 'tool_procurement_create_rfq', 'Crea una solicitud de cotización por 200 guantes nitrilo y 500 discos de corte 115 mm.', { titulo: 'Reposición EPP y abrasivos', items: [{ sku: 'GUA-NIT', descripcion: 'Guante nitrilo industrial (par)', cantidad: 200 }, { sku: 'DIS-115', descripcion: 'Disco de corte 115 mm', cantidad: 500 }] }],
      ['HERRAMIENTA', 'tool_procurement_create_rfq', 'Pide cotización de 1.000 cajas de perno M8 a Aceros Sur ({proveedorRut}).', { titulo: 'Pernos M8', items: [{ sku: 'PER-M8', descripcion: 'Perno hexagonal M8 (caja 100)', cantidad: 1000 }], proveedoresRuts: ['{proveedorRut}'] }],
      ['HERRAMIENTA', 'tool_procurement_create_rfq', 'Abre una RFQ por 40 planchas galvanizadas de 3 mm.', { titulo: 'Planchas galvanizadas 3 mm', items: [{ descripcion: 'Plancha galvanizada 3 mm', cantidad: 40 }] }],
      ['HERRAMIENTA', 'tool_procurement_award_purchase_order', 'Adjudica la RFQ {rfqId} a Aceros Sur ({proveedorRut}) por $3.840.000 neto: menor plazo de entrega.', { rfqId: '{rfqId}', proveedorRut: '{proveedorRut}', montoTotalNeto: 3840000, motivoAdjudicacion: 'Menor plazo de entrega' }],
      ['HERRAMIENTA', 'tool_inventory_kardex', '¿Cuánto stock hay de guantes nitrilo antes de comprar más?', { empresaId: E }],
      ['HERRAMIENTA', 'tool_inventory_kardex', 'Revisa el inventario valorizado para planificar compras.', { empresaId: E }],
      ['PIDE_DATOS', null, 'Crea una solicitud de cotización.'],
      ['PIDE_DATOS', null, 'Adjudica la cotización más barata.'],
      ['PIDE_DATOS', null, 'Compra lo que falte.'],
      ['FUERA_DE_ALCANCE', null, 'Calcula el F29 de octubre 2026.'],
      ['FUERA_DE_ALCANCE', null, 'Liquida el sueldo de Pedro Soto.'],
      ['FUERA_DE_ALCANCE', null, 'Deprecia la grúa horquilla.'],
    ],
    derivar: { 18: 'TRIBUTARIO_SII', 19: 'RRHH', 20: 'ACTIVO_FIJO' },
  },

  RRHH: {
    rows: [
      ['HERRAMIENTA', 'tool_hr_calculate_finiquito', 'Calcula el finiquito de Pedro Soto, RUT 12.345.678-5: sueldo base $950.000, ingreso 2022-03-01, despido 2026-10-31 por necesidades de la empresa (art. 161), 8 días de vacaciones pendientes, sin aviso previo.', { rut: '12.345.678-5', nombreCompleto: 'Pedro Soto', sueldoBase: 950000, fechaIngreso: '2022-03-01', fechaDespido: '2026-10-31', causal: 'ART_161', diasVacacionesPendientes: 8, diasAvisoPrevioOtorgados: 0 }],
      ['HERRAMIENTA', 'tool_hr_calculate_finiquito', 'Finiquito de Ana Muñoz (13.456.789-6), sueldo $1.800.000, entró el 2020-06-15, sale el 2026-10-31 por art. 161 sin aviso previo, 12 días de vacaciones pendientes.', { rut: '13.456.789-6', nombreCompleto: 'Ana Muñoz', sueldoBase: 1800000, fechaIngreso: '2020-06-15', fechaDespido: '2026-10-31', causal: 'ART_161', diasVacacionesPendientes: 12, diasAvisoPrevioOtorgados: 0 }],
      ['HERRAMIENTA', 'tool_hr_calculate_finiquito', 'Renuncia voluntaria de Pedro Soto (12.345.678-5): sueldo $950.000, ingreso 2022-03-01, último día 2026-11-15, 5 días de vacaciones pendientes. ¿Cuánto le corresponde?', { rut: '12.345.678-5', nombreCompleto: 'Pedro Soto', sueldoBase: 950000, fechaIngreso: '2022-03-01', fechaDespido: '2026-11-15', causal: 'ART_159_2', diasVacacionesPendientes: 5 }],
      ['HERRAMIENTA', 'tool_hr_calculate_finiquito', 'Indemnización por años de servicio de Ana Muñoz, RUT 13.456.789-6, sueldo base $1.800.000, desde 2020-06-15 hasta 2026-10-31, despido art. 161, sin vacaciones pendientes, con aviso de 30 días.', { rut: '13.456.789-6', nombreCompleto: 'Ana Muñoz', sueldoBase: 1800000, fechaIngreso: '2020-06-15', fechaDespido: '2026-10-31', causal: 'ART_161', diasVacacionesPendientes: 0, diasAvisoPrevioOtorgados: 30 }],
      ['HERRAMIENTA', 'tool_hr_calculate_payroll', 'Liquida el sueldo de Pedro Soto (12.345.678-5): base $950.000, AFP Modelo, Fonasa, contrato indefinido.', { rut: '12.345.678-5', nombreCompleto: 'Pedro Soto', sueldoBase: 950000, afpNombre: 'Modelo', saludTipo: 'FONASA', tipoContrato: 'INDEFINIDO' }],
      ['HERRAMIENTA', 'tool_hr_calculate_payroll', 'Liquidación de Ana Muñoz, RUT 13.456.789-6, sueldo $1.800.000, AFP Habitat, Isapre, indefinido, 6 horas extra.', { rut: '13.456.789-6', nombreCompleto: 'Ana Muñoz', sueldoBase: 1800000, afpNombre: 'Habitat', saludTipo: 'ISAPRE', tipoContrato: 'INDEFINIDO', horasExtrasCantidad: 6 }],
      ['HERRAMIENTA', 'tool_hr_calculate_payroll', '¿Cuál es el líquido de un trabajador a plazo fijo, RUT 18.222.333-4, Diego Pérez, base $620.000, AFP Capital, Fonasa?', { rut: '18.222.333-4', nombreCompleto: 'Diego Pérez', sueldoBase: 620000, afpNombre: 'Capital', saludTipo: 'FONASA', tipoContrato: 'PLAZO_FIJO' }],
      ['HERRAMIENTA', 'tool_hr_calculate_payroll', 'Calcula la remuneración de Pedro Soto (12.345.678-5) con bono imponible de $120.000: base $950.000, AFP Modelo, Fonasa, indefinido.', { rut: '12.345.678-5', nombreCompleto: 'Pedro Soto', sueldoBase: 950000, afpNombre: 'Modelo', saludTipo: 'FONASA', tipoContrato: 'INDEFINIDO', bonosImponibles: 120000 }],
      ['HERRAMIENTA', 'tool_hr_calculate_payroll', 'Costo empresa de contratar a Valentina Reyes (19.888.777-6) con sueldo base $1.100.000, AFP Uno, Fonasa, indefinido.', { rut: '19.888.777-6', nombreCompleto: 'Valentina Reyes', sueldoBase: 1100000, afpNombre: 'Uno', saludTipo: 'FONASA', tipoContrato: 'INDEFINIDO' }],
      ['HERRAMIENTA', 'tool_accounting_propose_entry', 'Registra la provisión de vacaciones de octubre por $410.000.', { glosaGeneral: 'Provisión vacaciones octubre', tipoComprobante: 'TRASPASO', lineas: [linea('5.2.03', 'Gasto vacaciones', 410000, 0), linea('2.1.07', 'Provisión vacaciones', 0, 410000)] }],
      ['HERRAMIENTA', 'tool_hr_calculate_finiquito', 'Despido por art. 161 de Pedro Soto 12.345.678-5, base $950.000, contratado 2022-03-01, término 2026-12-31, 10 días de vacaciones, aviso previo dado.', { rut: '12.345.678-5', nombreCompleto: 'Pedro Soto', sueldoBase: 950000, fechaIngreso: '2022-03-01', fechaDespido: '2026-12-31', causal: 'ART_161', diasVacacionesPendientes: 10, diasAvisoPrevioOtorgados: 30 }],
      ['HERRAMIENTA', 'tool_hr_calculate_payroll', 'Haz la liquidación de Diego Pérez, 18.222.333-4, base $620.000, AFP Capital, Fonasa, plazo fijo, 10 horas extra.', { rut: '18.222.333-4', nombreCompleto: 'Diego Pérez', sueldoBase: 620000, afpNombre: 'Capital', saludTipo: 'FONASA', tipoContrato: 'PLAZO_FIJO', horasExtrasCantidad: 10 }],
      ['PIDE_DATOS', null, 'Calcula el finiquito de Pedro Soto.'],
      ['PIDE_DATOS', null, 'Despide a Ana Muñoz y dime cuánto hay que pagarle.'],
      ['PIDE_DATOS', null, 'Liquida el sueldo del nuevo vendedor.'],
      ['PIDE_DATOS', null, '¿Cuánto le corresponde de indemnización a Juan?'],
      ['PIDE_DATOS', null, 'Haz la liquidación de sueldo de octubre.'],
      ['FUERA_DE_ALCANCE', null, '¿Cuánto stock queda de pernos M8?'],
      ['FUERA_DE_ALCANCE', null, 'Calcula el F29 de octubre 2026.'],
      ['FUERA_DE_ALCANCE', null, 'Concilia la cartola bancaria.'],
    ],
    derivar: { 18: 'INVENTARIO', 19: 'TRIBUTARIO_SII', 20: 'CONCILIACION' },
  },

  INVENTARIO: {
    rows: [
      ['HERRAMIENTA', 'tool_inventory_kardex', '¿Cuál es el valor total del inventario?', { empresaId: E }],
      ['HERRAMIENTA', 'tool_inventory_kardex', '¿Qué productos están bajo el stock mínimo?', { empresaId: E }],
      ['HERRAMIENTA', 'tool_inventory_kardex', 'Kardex del perno M8.', { empresaId: E }],
      ['HERRAMIENTA', 'tool_inventory_kardex', '¿Cuántos guantes nitrilo quedan en bodega?', { empresaId: E }],
      ['HERRAMIENTA', 'tool_inventory_kardex', 'Valoriza el inventario a costo promedio ponderado.', { empresaId: E }],
      ['HERRAMIENTA', 'tool_inventory_kardex', 'Muéstrame las alertas de stock crítico.', { empresaId: E }],
      ['HERRAMIENTA', 'tool_inventory_kardex', 'Inventario de la categoría ABRASIVOS.', { empresaId: E, categoriaFiltro: 'ABRASIVOS' }],
      ['HERRAMIENTA', 'tool_inventory_kardex', '¿Cuál es el costo PMP del disco de corte 115 mm?', { empresaId: E }],
      ['HERRAMIENTA', 'tool_inventory_kardex', 'Dame el resumen de existencias de la bodega.', { empresaId: E }],
      ['HERRAMIENTA', 'tool_inventory_kardex', '¿Cuántos SKU activos tenemos?', { empresaId: E }],
      ['HERRAMIENTA', 'tool_procurement_create_rfq', 'Genera una solicitud de cotización para reponer 300 pares de guantes nitrilo.', { titulo: 'Reposición guantes nitrilo', items: [{ sku: 'GUA-NIT', descripcion: 'Guante nitrilo industrial (par)', cantidad: 300 }] }],
      ['HERRAMIENTA', 'tool_procurement_create_rfq', 'Pide cotización para 200 cajas de perno M8.', { titulo: 'Reposición pernos M8', items: [{ sku: 'PER-M8', descripcion: 'Perno hexagonal M8 (caja 100)', cantidad: 200 }] }],
      ['HERRAMIENTA', 'tool_procurement_margin_analysis', '¿Qué margen tiene el guante nitrilo?', { empresaId: E, sku: 'GUA-NIT' }],
      ['HERRAMIENTA', 'tool_procurement_margin_analysis', '¿Algún producto del inventario tiene margen crítico?', { empresaId: E }],
      ['PIDE_DATOS', null, 'Registra el ingreso de mercadería de hoy.'],
      ['PIDE_DATOS', null, 'Haz un ajuste de inventario por merma.'],
      ['PIDE_DATOS', null, 'Pide cotización de lo que necesitamos.'],
      ['FUERA_DE_ALCANCE', null, 'Calcula el finiquito de Pedro Soto: sueldo $950.000, ingreso 2022-03-01, despido 2026-10-31, art. 161.'],
      ['FUERA_DE_ALCANCE', null, 'Calcula el F29 de octubre 2026.'],
      ['FUERA_DE_ALCANCE', null, 'Emite una factura a Ferretería Norte.'],
    ],
    derivar: { 18: 'RRHH', 19: 'TRIBUTARIO_SII', 20: 'FACTURACION_DTE' },
  },

  ACTIVO_FIJO: {
    rows: [
      ['HERRAMIENTA', 'tool_fixed_assets_depreciate_period', 'Calcula la depreciación de {periodo}.', { periodo: '{periodo}' }],
      ['HERRAMIENTA', 'tool_fixed_assets_depreciate_period', '¿Cuánto se deprecian los activos fijos en octubre 2026?', { periodo: '{periodo}' }],
      ['HERRAMIENTA', 'tool_fixed_assets_depreciate_period', 'Depreciación NIC 16 del período {periodo}.', { periodo: '{periodo}' }],
      ['HERRAMIENTA', 'tool_fixed_assets_depreciate_period', 'Depreciación financiera y tributaria de octubre 2026, por activo.', { periodo: '{periodo}' }],
      ['HERRAMIENTA', 'tool_fixed_assets_depreciate_period', '¿Cuál es la depreciación mensual de la grúa horquilla en {periodo}?', { periodo: '{periodo}' }],
      ['HERRAMIENTA', 'tool_fixed_assets_depreciate_period', 'Calcula la depreciación de {periodo} con corrección monetaria de 0,4%.', { periodo: '{periodo}', ipcRatePeriod: 0.004 }],
      ['HERRAMIENTA', 'tool_fixed_assets_propose_entry', 'Propón el asiento de depreciación de {periodo}.', { periodo: '{periodo}' }],
      ['HERRAMIENTA', 'tool_fixed_assets_propose_entry', 'Contabiliza la depreciación de octubre 2026.', { periodo: '{periodo}' }],
      ['HERRAMIENTA', 'tool_fixed_assets_propose_entry', 'Genera el comprobante de depreciación del mes {periodo} para aprobación.', { periodo: '{periodo}' }],
      ['HERRAMIENTA', 'tool_fixed_assets_propose_writeoff', 'Da de baja la grúa horquilla ({activoId}) por venta en $12.000.000 neto.', { activoId: '{activoId}', precioVentaNeto: 12000000, motivoBaja: 'Venta' }],
      ['HERRAMIENTA', 'tool_fixed_assets_propose_writeoff', 'Baja del activo AF-EVAL-01 por siniestro, sin valor de venta.', { activoId: 'AF-EVAL-01', motivoBaja: 'Siniestro' }],
      ['HERRAMIENTA', 'tool_fixed_assets_propose_writeoff', 'Vendimos la grúa AF-EVAL-01 en $15.000.000. Registra la enajenación.', { activoId: 'AF-EVAL-01', precioVentaNeto: 15000000, motivoBaja: 'Venta' }],
      ['HERRAMIENTA', 'tool_accounting_propose_entry', 'Registra la compra de un notebook por $890.000 neto como activo fijo, pagado por banco.', { glosaGeneral: 'Compra notebook', tipoComprobante: 'EGRESO', lineas: [linea('1.2.04', 'Equipos computacionales', 890000, 0), linea('1.1.01', 'Banco', 0, 890000)] }],
      ['PIDE_DATOS', null, 'Calcula la depreciación.'],
      ['PIDE_DATOS', null, 'Da de baja el activo dañado.'],
      ['PIDE_DATOS', null, 'Registra la compra del nuevo vehículo.'],
      ['PIDE_DATOS', null, 'Contabiliza la depreciación del mes.'],
      ['FUERA_DE_ALCANCE', null, 'Liquida el sueldo de Ana Muñoz.'],
      ['FUERA_DE_ALCANCE', null, 'Calcula el F29 de octubre 2026.'],
      ['FUERA_DE_ALCANCE', null, 'Revisa el kardex de pernos.'],
    ],
    derivar: { 18: 'RRHH', 19: 'TRIBUTARIO_SII', 20: 'INVENTARIO' },
  },

  FLUJO_CAJA: {
    rows: [
      ['HERRAMIENTA', 'tool_cashflow_project_30_60_90', 'Proyecta el flujo de caja a 30, 60 y 90 días.', { empresaId: E }],
      ['HERRAMIENTA', 'tool_cashflow_project_30_60_90', '¿Cuál es la caja proyectada a 60 días?', { empresaId: E, horizonteDias: 60 }],
      ['HERRAMIENTA', 'tool_cashflow_project_30_60_90', '¿Tendremos déficit de caja en los próximos 3 meses?', { empresaId: E }],
      ['HERRAMIENTA', 'tool_cashflow_project_30_60_90', 'Saldo de bancos y cuentas por cobrar proyectadas.', { empresaId: E }],
      ['HERRAMIENTA', 'tool_cashflow_project_30_60_90', 'Dame la proyección de liquidez a 30 días.', { empresaId: E, horizonteDias: 30 }],
      ['HERRAMIENTA', 'tool_cashflow_project_30_60_90', '¿Cuántos días de caja tenemos con la nómina actual?', { empresaId: E }],
      ['HERRAMIENTA', 'tool_cashflow_project_30_60_90', 'Proyección de caja para el directorio.', { empresaId: E }],
      ['HERRAMIENTA', 'tool_cashflow_simulate_scenario', '¿Qué pasa si las ventas bajan 20%?', { variacionVentasPct: -20 }],
      ['HERRAMIENTA', 'tool_cashflow_simulate_scenario', 'Simula que los clientes pagan 45 días más tarde.', { retrasoCobranzaDias: 45 }],
      ['HERRAMIENTA', 'tool_cashflow_simulate_scenario', 'Escenario optimista: ventas +10%.', { variacionVentasPct: 10 }],
      ['HERRAMIENTA', 'tool_cashflow_simulate_scenario', 'Escenario de estrés: ventas -25%, costos +8%, cobranza 30 días más lenta.', { variacionVentasPct: -25, aumentoCostosPct: 8, retrasoCobranzaDias: 30 }],
      ['HERRAMIENTA', 'tool_cashflow_simulate_scenario', 'Si los costos suben 12%, ¿cómo queda la caja?', { aumentoCostosPct: 12 }],
      ['HERRAMIENTA', 'tool_cashflow_simulate_scenario', 'Simula cobranza 15 días más lenta y ventas iguales.', { retrasoCobranzaDias: 15 }],
      ['HERRAMIENTA', 'tool_cashflow_simulate_scenario', 'Sensibilidad: ventas -10%.', { variacionVentasPct: -10 }],
      ['PIDE_DATOS', null, 'Simula el escenario que conversamos ayer.'],
      ['PIDE_DATOS', null, 'Proyecta la caja con el nuevo crédito.'],
      ['PIDE_DATOS', null, '¿Podemos pagar la inversión?'],
      ['FUERA_DE_ALCANCE', null, 'Calcula el finiquito de Pedro Soto.'],
      ['FUERA_DE_ALCANCE', null, 'Emite la factura a Constructora Andes.'],
      ['FUERA_DE_ALCANCE', null, 'Calcula el costo de la OP {folioOP}.'],
    ],
    derivar: { 18: 'RRHH', 19: 'FACTURACION_DTE', 20: 'COSTOS_PRODUCCION' },
  },

  COSTOS_PRODUCCION: {
    rows: [
      ['HERRAMIENTA', 'tool_production_cost_order', 'Costea la orden de producción {folioOP}.', { folioOP: '{folioOP}' }],
      ['HERRAMIENTA', 'tool_production_cost_order', '¿Cuál es el costo unitario real de la {folioOP}?', { folioOP: '{folioOP}' }],
      ['HERRAMIENTA', 'tool_production_cost_order', 'Desglose MPD, MOD y CIF de la orden {folioOP}.', { folioOP: '{folioOP}' }],
      ['HERRAMIENTA', 'tool_production_cost_order', '¿Cuánto costó producir las estructuras de la {folioOP}?', { folioOP: '{folioOP}' }],
      ['HERRAMIENTA', 'tool_production_cost_order', 'Costo total y rendimiento de la orden {folioOP}.', { folioOP: '{folioOP}' }],
      ['HERRAMIENTA', 'tool_production_variance_standard_vs_real', 'Variaciones estándar vs real de la {folioOP}.', { folioOP: '{folioOP}' }],
      ['HERRAMIENTA', 'tool_production_variance_standard_vs_real', '¿Nos pasamos del presupuesto de materia prima en la {folioOP}?', { folioOP: '{folioOP}' }],
      ['HERRAMIENTA', 'tool_production_variance_standard_vs_real', 'Compara el costo presupuestado con el real en la orden {folioOP}.', { folioOP: '{folioOP}' }],
      ['HERRAMIENTA', 'tool_production_variance_standard_vs_real', '¿Qué variación hubo en mano de obra en la {folioOP}?', { folioOP: '{folioOP}' }],
      ['HERRAMIENTA', 'tool_production_propose_closure_entry', 'Cierra la orden {folioOP} al 2026-10-31 y propón el asiento.', { folioOP: '{folioOP}', fechaCierre: '2026-10-31' }],
      ['HERRAMIENTA', 'tool_production_propose_closure_entry', 'Asiento de cierre de la {folioOP} con fecha 2026-10-31.', { folioOP: '{folioOP}', fechaCierre: '2026-10-31' }],
      ['HERRAMIENTA', 'tool_production_propose_closure_entry', 'Traspasa a productos terminados la orden {folioOP}, cierre el 2026-10-31.', { folioOP: '{folioOP}', fechaCierre: '2026-10-31' }],
      ['HERRAMIENTA', 'tool_inventory_kardex', '¿Cuánto stock de pernos M8 hay para la próxima orden?', { empresaId: E }],
      ['HERRAMIENTA', 'tool_inventory_kardex', 'Revisa el inventario de insumos disponibles para producción.', { empresaId: E }],
      ['PIDE_DATOS', null, 'Costea la última orden de producción.'],
      ['PIDE_DATOS', null, 'Cierra la orden de producción.'],
      ['PIDE_DATOS', null, 'Calcula las variaciones de la orden de ayer.'],
      ['FUERA_DE_ALCANCE', null, 'Calcula el F29 de octubre 2026.'],
      ['FUERA_DE_ALCANCE', null, 'Liquida el sueldo de Pedro Soto.'],
      ['FUERA_DE_ALCANCE', null, 'Concilia la cartola.'],
    ],
    derivar: { 18: 'TRIBUTARIO_SII', 19: 'RRHH', 20: 'CONCILIACION' },
  },

  RENDICIONES: {
    rows: [
      ['HERRAMIENTA', 'tool_expenses_validate_report', 'Valida la rendición {reportId}.', { reportId: '{reportId}' }],
      ['HERRAMIENTA', 'tool_expenses_validate_report', '¿La rendición {reportId} tiene gastos sin respaldo?', { reportId: '{reportId}' }],
      ['HERRAMIENTA', 'tool_expenses_validate_report', 'Audita la rendición de Camila Rojas ({reportId}).', { reportId: '{reportId}' }],
      ['HERRAMIENTA', 'tool_expenses_validate_report', '¿Cuadra el total declarado de la rendición {reportId} con sus ítems?', { reportId: '{reportId}' }],
      ['HERRAMIENTA', 'tool_expenses_validate_report', 'Revisa si hay gastos rechazados (art. 21) en la {reportId}.', { reportId: '{reportId}' }],
      ['HERRAMIENTA', 'tool_expenses_validate_report', '¿Cuánto rindió Camila en la {reportId}?', { reportId: '{reportId}' }],
      ['HERRAMIENTA', 'tool_expenses_validate_report', 'Revisa los comprobantes de la rendición {reportId} antes de aprobarla.', { reportId: '{reportId}' }],
      ['HERRAMIENTA', 'tool_expenses_propose_entry', 'Contabiliza la rendición {reportId}.', { reportId: '{reportId}' }],
      ['HERRAMIENTA', 'tool_expenses_propose_entry', 'Propón el asiento de la rendición {reportId} para aprobación.', { reportId: '{reportId}' }],
      ['HERRAMIENTA', 'tool_expenses_propose_entry', 'Genera el comprobante contable de los gastos de Camila ({reportId}).', { reportId: '{reportId}' }],
      ['HERRAMIENTA', 'tool_expenses_propose_entry', 'Registra en contabilidad la rendición {reportId} ya revisada.', { reportId: '{reportId}' }],
      ['HERRAMIENTA', 'tool_accounting_propose_entry', 'Registra el reembolso de $186.400 a Camila Rojas pagado por banco contra la cuenta de rendiciones por pagar.', { glosaGeneral: 'Reembolso rendición Camila Rojas', tipoComprobante: 'EGRESO', lineas: [linea('2.1.09', 'Rendiciones por pagar', 186400, 0), linea('1.1.01', 'Banco', 0, 186400)] }],
      ['PIDE_DATOS', null, 'Valida la rendición.'],
      ['PIDE_DATOS', null, 'Contabiliza los gastos del viaje.'],
      ['PIDE_DATOS', null, 'Aprueba la rendición del vendedor.'],
      ['PIDE_DATOS', null, 'Registra este gasto de combustible.'],
      ['PIDE_DATOS', null, 'Revisa la última rendición enviada.'],
      ['FUERA_DE_ALCANCE', null, 'Calcula el finiquito de Ana Muñoz.'],
      ['FUERA_DE_ALCANCE', null, 'Calcula el F29 de octubre 2026.'],
      ['FUERA_DE_ALCANCE', null, 'Proyecta la caja a 90 días.'],
    ],
    derivar: { 18: 'RRHH', 19: 'TRIBUTARIO_SII', 20: 'FLUJO_CAJA' },
  },
};

export function buildCases(): EvalCase[] {
  const out: EvalCase[] = [];
  for (const [modulo, { rows, derivar }] of Object.entries(CASE_ROWS)) {
    rows.forEach(([tipo, herramienta, consulta, args], i) => {
      const n = i + 1;
      out.push({
        id: `${modulo}-${String(n).padStart(2, '0')}`,
        modulo,
        tipo,
        consulta,
        ...(herramienta ? { herramienta } : {}),
        ...(args ? { args } : {}),
        ...(tipo === 'FUERA_DE_ALCANCE' ? { derivarA: derivar[n] } : {}),
      });
    });
  }
  return out;
}

/** Reemplaza los marcadores con los datos de la empresa de evaluación. */
export function fill<T>(value: T, vars: Record<string, string>): T {
  const json = JSON.stringify(value).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
  return JSON.parse(json);
}
