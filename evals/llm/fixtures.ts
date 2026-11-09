/**
 * 4.2 Datos conocidos para la evaluación con LLM real.
 *
 * Crea una empresa de evaluación aislada (identificador único por corrida) con datos de todos
 * los módulos. Las cifras esperadas no se escriben a mano: el evaluador ejecuta la herramienta
 * correcta sobre estos datos y compara el dictamen del agente con esa salida.
 */
import { diskPersistence } from '../../src/services/diskPersistenceService';
import { commercialProcurementService } from '../../src/services/commercialProcurementService';
import { aiRouterService } from '../../src/services/aiRouterService';

export interface EvalFixture {
  empresaId: string;
  razonSocial: string;
  periodo: string; // período con compras y ventas
  folioOP: string;
  reportId: string;
  activoId: string;
  rfqId: string;
  proveedorRut: string;
}

export function seedEvalCompany(): EvalFixture {
  const empresaId = `76${String(Date.now()).slice(-6)}-9`;
  const razonSocial = 'Evaluación Agentes SpA';
  const periodo = '2026-10';
  const snap: any = diskPersistence.getSnapshot();

  diskPersistence.updateCollection('clients', [
    ...(snap.clients || []),
    {
      id: empresaId,
      rut: empresaId,
      razonSocial,
      giro: 'Distribución de insumos industriales',
      regimenTributario: '14_D3_PROPYME',
      tasaPpm: 0.0025,
      evaluacionLlm: true,
    },
  ]);

  // Tesorería y conciliación: 3 movimientos, 2 con asiento que calza, 1 sin calce.
  diskPersistence.saveBankAccounts(
    [{ id: `${empresaId}-cta1`, banco: 'Banco de prueba', numeroCuenta: '000-111', saldoEnLinea: 18_500_000, moneda: 'CLP' }],
    empresaId
  );
  diskPersistence.saveBankMovements(
    [
      { id: `${empresaId}-m1`, fecha: '2026-10-06', monto: 2_380_000, abono: 2_380_000, descripcion: 'TEF cliente Ferretería Norte', estado: 'PENDIENTE' },
      { id: `${empresaId}-m2`, fecha: '2026-10-09', monto: 952_000, cargo: 952_000, descripcion: 'Pago proveedor Aceros Sur', estado: 'PENDIENTE' },
      { id: `${empresaId}-m3`, fecha: '2026-10-15', monto: 48_730, cargo: 48_730, descripcion: 'Comisión mantención cuenta', estado: 'PENDIENTE' },
    ],
    empresaId
  );
  const asiento = (id: string, fecha: string, concepto: string, monto: number, debe: string, haber: string) =>
    diskPersistence.addAccountingEntry({
      id: `${empresaId}-${id}`,
      empresaId,
      fecha,
      periodo: fecha.slice(0, 7),
      concepto,
      totalDebe: monto,
      totalHaber: monto,
      lineas: [
        { cuentaCodigo: debe, debe: monto, haber: 0 },
        { cuentaCodigo: haber, debe: 0, haber: monto },
      ],
    });
  asiento('as1', '2026-10-06', 'Cobro factura 501 Ferretería Norte', 2_380_000, '1.1.01', '1.1.03');
  asiento('as2', '2026-10-09', 'Pago factura 8812 Aceros Sur', 952_000, '2.1.01', '1.1.01');

  // RCV / F29 del período: 2 ventas y 2 compras.
  diskPersistence.saveDtes(empresaId, [
    { id: `${empresaId}-v501`, tipoOperacion: 'VENTA', tipoDte: '33', folio: 501, periodo, fechaEmision: '2026-10-03', rutReceptor: '77.111.222-3', razonSocialReceptor: 'Ferretería Norte Ltda.', montoNeto: 2_000_000, montoIva: 380_000, montoTotal: 2_380_000, estado: 'ACEPTADO' },
    { id: `${empresaId}-v502`, tipoOperacion: 'VENTA', tipoDte: '33', folio: 502, periodo, fechaEmision: '2026-10-20', rutReceptor: '76.333.444-5', razonSocialReceptor: 'Constructora Andes SpA', montoNeto: 3_500_000, montoIva: 665_000, montoTotal: 4_165_000, estado: 'ACEPTADO' },
    { id: `${empresaId}-c8812`, tipoOperacion: 'COMPRA', tipoDte: '33', folio: 8812, periodo, fechaEmision: '2026-10-02', rutEmisor: '78.555.666-7', razonSocialEmisor: 'Aceros Sur S.A.', montoNeto: 800_000, montoIva: 152_000, montoTotal: 952_000 },
    { id: `${empresaId}-c3301`, tipoOperacion: 'COMPRA', tipoDte: '33', folio: 3301, periodo, fechaEmision: '2026-10-11', rutEmisor: '79.777.888-9', razonSocialEmisor: 'Transportes Ruta 5 Ltda.', montoNeto: 450_000, montoIva: 85_500, montoTotal: 535_500 },
  ]);

  // Activo fijo
  const activoId = `${empresaId}-af1`;
  diskPersistence.setFixedAssets(empresaId, [
    { id: activoId, empresaId, codigoPlaca: 'AF-EVAL-01', nombre: 'Grúa horquilla eléctrica', categoria: 'MAQUINARIA', estado: 'OPERATIVO', valorAdquisicionOriginal: 24_000_000, valorLibroFinanciero: 19_200_000, vidaUtilMesesFinanciera: 120, vidaUtilMesesTributaria: 84, vidaUtilRestanteMeses: 96, fechaAdquisicion: '2024-10-01' },
    { id: `${empresaId}-af2`, empresaId, codigoPlaca: 'AF-EVAL-02', nombre: 'Camioneta de reparto', categoria: 'VEHICULOS', estado: 'OPERATIVO', valorAdquisicionOriginal: 15_600_000, valorLibroFinanciero: 12_480_000, vidaUtilMesesFinanciera: 84, vidaUtilMesesTributaria: 36, vidaUtilRestanteMeses: 67, fechaAdquisicion: '2025-05-01' },
  ]);

  // Inventario (y márgenes comerciales, que se derivan de costo y precio de venta)
  diskPersistence.setInventoryItems(empresaId, [
    { id: `${empresaId}-i1`, sku: 'PER-M8', nombre: 'Perno hexagonal M8 (caja 100)', categoria: 'FIJACIONES', stockTotal: 340, stockMinimo: 100, costoUnitarioPMP: 6_200, precioVentaLista: 9_900 },
    { id: `${empresaId}-i2`, sku: 'GUA-NIT', nombre: 'Guante nitrilo industrial (par)', categoria: 'EPP', stockTotal: 45, stockMinimo: 60, costoUnitarioPMP: 2_150, precioVentaLista: 2_600 },
    { id: `${empresaId}-i3`, sku: 'DIS-115', nombre: 'Disco de corte 115 mm', categoria: 'ABRASIVOS', stockTotal: 1_200, stockMinimo: 300, costoUnitarioPMP: 890, precioVentaLista: 1_490 },
  ]);

  // Producción: una OP con presupuesto estándar
  const folioOP = 'OP-EVAL-0042';
  diskPersistence.setProductionOrders(empresaId, [
    { id: `${empresaId}-op42`, folioOP, productoNombre: 'Estructura soporte galvanizada', estado: 'TERMINADA', unidadMedida: 'UND', cantidadObjetivo: 50, cantidadProducidaReal: 48, costoMateriaPrimaReal: 4_320_000, costoManoObraReal: 1_150_000, costoCifReal: 610_000, costoTotalProduccion: 6_080_000, fechaInicio: '2026-10-01', fechaTermino: '2026-10-24' },
  ]);
  diskPersistence.saveProductionBudget({
    id: `${empresaId}-ppto42`, empresaId, ordenProduccionId: `${empresaId}-op42`, folioOP,
    presupuestoMpdClp: 4_000_000, presupuestoModClp: 1_200_000, presupuestoCifClp: 600_000,
  });

  // Rendiciones
  const reportId = 'REN-EVAL-17';
  diskPersistence.saveExpenseReports(empresaId, [
    {
      id: `${empresaId}-ren17`,
      folio: reportId,
      empresaId,
      rendidorNombre: 'Camila Rojas',
      rendidorRut: '15.444.333-2',
      estado: 'ENVIADA',
      fechaRendicion: '2026-10-28',
      totalRendido: 186_400,
      items: [
        { id: 'it1', concepto: 'Combustible visita a cliente', categoria: 'COMBUSTIBLE', montoTotal: 62_400, rutEmisor: '96.555.444-1', tipoDocumento: 'BOLETA_ELECTRONICA', folioDocumento: '993311' },
        { id: 'it2', concepto: 'Almuerzo con cliente', categoria: 'REPRESENTACION_CLIENTES', montoTotal: 84_000, rutEmisor: '76.222.111-0', tipoDocumento: 'FACTURA_ELECTRONICA_33', folioDocumento: '4410' },
        { id: 'it3', concepto: 'Peajes ruta 68', categoria: 'PEAJES_ESTACIONAMIENTOS', montoTotal: 40_000, tipoDocumento: 'TICKET_PEAJE' },
      ],
    },
  ]);

  // Remuneraciones del período (para F29 y flujo de caja)
  diskPersistence.savePayrolls(
    [
      { id: `${empresaId}-liq1`, periodo, rut: '12.345.678-5', nombreCompleto: 'Pedro Soto', sueldoBase: 950_000, sueldoLiquido: 812_000, impuestoUnico: 0, costoTotalEmpresa: 1_046_000 },
      { id: `${empresaId}-liq2`, periodo, rut: '13.456.789-6', nombreCompleto: 'Ana Muñoz', sueldoBase: 1_800_000, sueldoLiquido: 1_472_000, impuestoUnico: 21_350, costoTotalEmpresa: 1_985_000 },
    ],
    empresaId
  );

  // Compras: una solicitud de cotización con dos ofertas recibidas
  const proveedorRut = '78.555.666-7';
  const rfq = commercialProcurementService.createRfq(empresaId, {
    titulo: 'Planchas galvanizadas 2 mm',
    items: [{ sku: 'PLA-GAL-2', descripcion: 'Plancha galvanizada 2 mm', cantidad: 80, unidad: 'UND' } as any],
    proveedorRuts: [proveedorRut, '79.111.000-2'],
  });
  commercialProcurementService.submitSupplierQuote(empresaId, rfq.id, proveedorRut, {
    montoNetoOfertado: 3_840_000,
    plazoEntregaDiasOfertado: 7,
    condicionPagoOfertada: '30 días',
    costoFleteClp: 120_000,
  });
  commercialProcurementService.submitSupplierQuote(empresaId, rfq.id, '79.111.000-2', {
    montoNetoOfertado: 3_610_000,
    plazoEntregaDiasOfertado: 15,
    condicionPagoOfertada: 'Contado',
    costoFleteClp: 260_000,
  });

  // La evaluación no debe detenerse por el presupuesto diario (3.5): se informa el consumo al final.
  aiRouterService.setCompanyOverride(empresaId, {
    agentBudget: { maxTokensDiariosPorEmpresa: 0, maxGastoDiarioClpPorEmpresa: 0 },
  });

  diskPersistence.flushToDiskSync();
  return { empresaId, razonSocial, periodo, folioOP, reportId, activoId, rfqId: rfq.id, proveedorRut };
}

/** Quita la empresa de evaluación y sus datos del snapshot local. */
export function removeEvalCompany(empresaId: string) {
  const snap: any = diskPersistence.getSnapshot();
  diskPersistence.updateCollection('clients', (snap.clients || []).filter((c: any) => c.id !== empresaId));
  diskPersistence.flushToDiskSync();
}
