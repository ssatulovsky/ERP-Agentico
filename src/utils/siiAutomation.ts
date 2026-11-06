import { 
  DteDocument, 
  DteSplitItem, 
  SupplierAccountRule, 
  SiiCentralizationConfig, 
  SiiPendingPeriodDiagnostic,
  AccountingEntry,
  AccountingEntryLine,
  CompanyProfile,
  ClientCompany
} from '../types';
import { formatCLP, createPurchaseDteEntry, createSalesDteEntry, createHonorariosEntry } from './chileanAccounting';

// Catálogo inicial de memoria contable por RUT para proveedores y servicios habituales en Chile
// Catálogo base de imputación por proveedor: sin historial de uso (vecesUsado/ultimaFecha se llenan con el uso real).
export const DEFAULT_SUPPLIER_RULES: SupplierAccountRule[] = [
  {
    id: 'rule-enel',
    rutContraparte: '96.800.570-7',
    razonSocial: 'ENEL DISTRIBUCION CHILE S.A.',
    cuentaCodigo: '5.1.05',
    cuentaNombre: 'Gasto Electricidad y Energía',
    conceptoDefecto: 'Suministro eléctrico sucursal y oficina central',
    vecesUsado: 0,
    ultimaFecha: '',
    esFrecuente: false
  },
  {
    id: 'rule-aguas',
    rutContraparte: '61.808.000-5',
    razonSocial: 'AGUAS ANDINAS S.A.',
    cuentaCodigo: '5.1.06',
    cuentaNombre: 'Gasto Agua Potable y Alcantarillado',
    conceptoDefecto: 'Consumo mensual agua potable matriz',
    vecesUsado: 0,
    ultimaFecha: '',
    esFrecuente: false
  },
  {
    id: 'rule-entel',
    rutContraparte: '96.574.000-k',
    razonSocial: 'ENTEL PCS TELECOMUNICACIONES S.A.',
    cuentaCodigo: '5.1.04',
    cuentaNombre: 'Gasto Telecomunicaciones e Internet',
    conceptoDefecto: 'Planes corporativos móviles y enlace fibra óptica',
    vecesUsado: 0,
    ultimaFecha: '',
    esFrecuente: false
  },
  {
    id: 'rule-copec',
    rutContraparte: '99.520.000-7',
    razonSocial: 'COMPAÑIA DE PETROLEOS DE CHILE COPEC S.A.',
    cuentaCodigo: '5.1.08',
    cuentaNombre: 'Gasto Combustibles y Lubricantes',
    conceptoDefecto: 'Carga diesel y gasolina vehículos operacionales',
    vecesUsado: 0,
    ultimaFecha: '',
    esFrecuente: false
  },
  {
    id: 'rule-sodimac',
    rutContraparte: '96.792.430-K',
    razonSocial: 'SODIMAC S.A.',
    cuentaCodigo: '1.1.09',
    cuentaNombre: 'Existencias y Materiales de Operación',
    conceptoDefecto: 'Materiales ferretería y herramientas de mantención',
    vecesUsado: 0,
    ultimaFecha: '',
    esFrecuente: false
  },
  {
    id: 'rule-walmart',
    rutContraparte: '76.134.941-4',
    razonSocial: 'WALMART CHILE COMERCIAL LTDA.',
    cuentaCodigo: '5.1.15',
    cuentaNombre: 'Insumos de Oficina y Aseo',
    conceptoDefecto: 'Artículos de aseo, cafetería y oficina',
    vecesUsado: 0,
    ultimaFecha: '',
    esFrecuente: false
  },
  {
    id: 'rule-aws',
    rutContraparte: '59.184.000-3',
    razonSocial: 'AMAZON WEB SERVICES CHILE SPA',
    cuentaCodigo: '5.1.18',
    cuentaNombre: 'Software, Nube y Licencias TI',
    conceptoDefecto: 'Servidores cloud hosting y base de datos',
    vecesUsado: 0,
    ultimaFecha: '',
    esFrecuente: false
  },
  {
    id: 'rule-google',
    rutContraparte: '76.012.345-6',
    razonSocial: 'GOOGLE CHILE COMPUTACION LTDA.',
    cuentaCodigo: '5.1.18',
    cuentaNombre: 'Software, Nube y Licencias TI',
    conceptoDefecto: 'Google Workspace y servicios en la nube',
    vecesUsado: 0,
    ultimaFecha: '',
    esFrecuente: false
  },
  {
    id: 'rule-notaria',
    rutContraparte: '7.654.321-0',
    razonSocial: 'NOTARIA Y CONSERVADOR DE BIENES RAICES',
    cuentaCodigo: '5.1.12',
    cuentaNombre: 'Gastos Legales y Notariales',
    conceptoDefecto: 'Protocolización de escrituras y legalización de poderes',
    vecesUsado: 0,
    ultimaFecha: '',
    esFrecuente: false
  },
];

// Configuración por defecto de cuentas para centralización
export const DEFAULT_CENTRALIZATION_CONFIG: SiiCentralizationConfig = {
  cuentaComprasPasivo: { codigo: '2.1.01', nombre: 'Proveedores Nacionales' },
  cuentaVentasActivo: { codigo: '1.1.03', nombre: 'Clientes Nacionales' },
  cuentaIvaCredito: { codigo: '1.1.08', nombre: 'IVA Crédito Fiscal' },
  cuentaIvaDebito: { codigo: '2.1.04', nombre: 'IVA Débito Fiscal' },
  cuentaVentasIngreso: { codigo: '4.1.01', nombre: 'Ingresos por Ventas del Giro (Afectas)' },
  cuentaVentasExentasIngreso: { codigo: '4.1.02', nombre: 'Ingresos por Servicios Exentos del Giro' },
  cuentaComprasExentasGasto: { codigo: '5.1.98', nombre: 'Gastos y Adquisiciones Exentas' },
  cuentaHonorariosGasto: { codigo: '5.1.20', nombre: 'Honorarios Profesionales' },
  cuentaRetencionHonorarios: { codigo: '2.1.06', nombre: 'Retenciones Impuesto 2da Categoría (14.5%)' },
  cuentaBancoPago: { codigo: '1.1.01', nombre: 'Banco Santander - Cuenta Corriente' },
  cuentaBancoCobro: { codigo: '1.1.01', nombre: 'Banco Santander - Cuenta Corriente' },
  modoRegistroContable: 'RESUMEN_GLOBAL'
};

// Plan de cuentas auxiliar para sugerencias y desgloses
export const ACCESSIBLE_ACCOUNTS = [
  { codigo: '1.1.01', nombre: 'Banco Santander - Cta Cte', tipo: 'ACTIVO' },
  { codigo: '1.1.02', nombre: 'Banco de Chile - Cta Cte', tipo: 'ACTIVO' },
  { codigo: '1.1.03', nombre: 'Clientes Nacionales', tipo: 'ACTIVO' },
  { codigo: '1.1.08', nombre: 'IVA Crédito Fiscal', tipo: 'ACTIVO' },
  { codigo: '1.1.09', nombre: 'Existencias / Mercaderías para la Venta', tipo: 'ACTIVO' },
  { codigo: '1.2.01', nombre: 'Activo Fijo - Maquinarias y Equipos', tipo: 'ACTIVO' },
  { codigo: '1.2.02', nombre: 'Activo Fijo - Vehículos Operacionales', tipo: 'ACTIVO' },
  { codigo: '1.2.03', nombre: 'Activo Fijo - Equipos Computacionales', tipo: 'ACTIVO' },
  { codigo: '2.1.01', nombre: 'Proveedores Nacionales', tipo: 'PASIVO' },
  { codigo: '2.1.02', nombre: 'Cuentas por Pagar Comerciales', tipo: 'PASIVO' },
  { codigo: '2.1.04', nombre: 'IVA Débito Fiscal', tipo: 'PASIVO' },
  { codigo: '2.1.06', nombre: 'Retenciones Impuesto 2da Categoría BHE', tipo: 'PASIVO' },
  { codigo: '4.1.01', nombre: 'Ingresos por Ventas del Giro (Afectas)', tipo: 'INGRESO' },
  { codigo: '4.1.02', nombre: 'Ingresos por Servicios Exentos del Giro', tipo: 'INGRESO' },
  { codigo: '5.1.01', nombre: 'Costo de Ventas y Mercaderías', tipo: 'COSTO' },
  { codigo: '5.1.02', nombre: 'Gasto de Arriendos Operacionales', tipo: 'GASTO' },
  { codigo: '5.1.04', nombre: 'Gasto Telecomunicaciones e Internet', tipo: 'GASTO' },
  { codigo: '5.1.05', nombre: 'Gasto Electricidad y Energía', tipo: 'GASTO' },
  { codigo: '5.1.06', nombre: 'Gasto Agua Potable y Alcantarillado', tipo: 'GASTO' },
  { codigo: '5.1.07', nombre: 'Gasto Fletes y Transporte de Envíos', tipo: 'GASTO' },
  { codigo: '5.1.08', nombre: 'Gasto Combustibles y Lubricantes', tipo: 'GASTO' },
  { codigo: '5.1.09', nombre: 'Gasto Peajes y Tag', tipo: 'GASTO' },
  { codigo: '5.1.10', nombre: 'Gasto Mantención y Reparaciones', tipo: 'GASTO' },
  { codigo: '5.1.11', nombre: 'Gasto Publicidad y Marketing Digital', tipo: 'GASTO' },
  { codigo: '5.1.12', nombre: 'Gastos Legales y Notariales', tipo: 'GASTO' },
  { codigo: '5.1.15', nombre: 'Insumos de Oficina y Cafetería', tipo: 'GASTO' },
  { codigo: '5.1.18', nombre: 'Software, Nube y Licencias TI', tipo: 'GASTO' },
  { codigo: '5.1.20', nombre: 'Honorarios Profesionales', tipo: 'GASTO' },
  { codigo: '5.1.25', nombre: 'Servicios de Seguridad y Vigilancia', tipo: 'GASTO' },
  { codigo: '5.1.98', nombre: 'Gastos y Adquisiciones Exentas', tipo: 'GASTO' },
  { codigo: '5.1.99', nombre: 'Otros Gastos Generales de Administración', tipo: 'GASTO' }
];

const NOMBRES_MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

/**
 * Detecta automáticamente qué meses están sin actualizar o con DTEs pendientes
 * analizando el historial cargado en el ERP.
 */
export function detectPendingSiiMonths(
  existingDtes: DteDocument[],
  targetYear: number = 2026,
  targetMonthUpTo: number = 9 // Hasta septiembre de 2026
): SiiPendingPeriodDiagnostic[] {
  const diagnostics: SiiPendingPeriodDiagnostic[] = [];

  for (let m = 1; m <= targetMonthUpTo; m++) {
    const mesStr = m.toString().padStart(2, '0');
    const periodo = `${targetYear}-${mesStr}`;
    
    // Filtrar documentos que correspondan a este período
    const dtesPeriodo = existingDtes.filter(d => d.fechaEmision.startsWith(periodo));
    const tieneCompras = dtesPeriodo.some(d => d.tipoOperacion === 'COMPRA');
    const tieneVentas = dtesPeriodo.some(d => d.tipoOperacion === 'VENTA');
    const tieneHonorarios = dtesPeriodo.some(d => d.tipoOperacion === 'HONORARIOS');
    
    // Pendientes de contabilizar: no tienen cuenta asignada ni asiento de centralización
    const pendientesContabilizar = dtesPeriodo.filter(
      d => !d.asientoCentralizacionId && (d.imputacionEstado !== 'CENTRALIZADO')
    ).length;

    let estado: SiiPendingPeriodDiagnostic['estado'] = 'ACTUALIZADO';

    if (dtesPeriodo.length === 0) {
      estado = 'DESACTUALIZADO';
    } else if (!tieneCompras || !tieneVentas) {
      estado = 'PARCIAL';
    } else if (pendientesContabilizar > 0) {
      estado = 'PENDIENTE_SINCRONIZAR';
    } else {
      estado = 'ACTUALIZADO';
    }

    diagnostics.push({
      periodo,
      anio: targetYear,
      mes: m,
      nombreMes: `${NOMBRES_MESES[m - 1]} ${targetYear}`,
      comprasSincronizadas: tieneCompras,
      ventasSincronizadas: tieneVentas,
      honorariosSincronizados: tieneHonorarios,
      totalDocumentosRegistrados: dtesPeriodo.length,
      estado,
      documentosPendientesContabilizar: pendientesContabilizar,
      // Fecha real del documento más reciente del período (antes era una fecha fija)
      ultimaActualizacion: dtesPeriodo.length > 0
        ? dtesPeriodo.map((d: any) => String(d.fechaRecepcion || d.fechaEmision || '')).filter(Boolean).sort().pop()
        : undefined
    });
  }

  return diagnostics;
}

/**
 * Normaliza un RUT quitando puntos, espacios y pasando a mayúsculas
 */
export function cleanRut(rut: string): string {
  return (rut || '').replace(/[^0-9kK]/g, '').toUpperCase();
}

/**
 * Motor de Imputación Contable:
 * 1. Si existe historial previo para el RUT del proveedor, repite automáticamente la cuenta contable
 * 2. Si no tiene historial, sugiere la imputación contable usando análisis del giro, razón social y glosa
 */
export function getSuggestedAccountForDte(
  dte: DteDocument,
  rules: SupplierAccountRule[] = DEFAULT_SUPPLIER_RULES,
  company?: CompanyProfile
): {
  cuentaCodigo: string;
  cuentaNombre: string;
  origen: 'HISTORIAL_PROVEEDOR' | 'INTELIGENCIA_ARTIFICIAL' | 'MANUAL';
  glosaSugerida: string;
  esHistorico: boolean;
  certeza: number;
} {
  const cleanDteRut = cleanRut(dte.rutContraparte);

  // 1. Caso: Documento de Venta
  if (dte.tipoOperacion === 'VENTA') {
    const isExento = dte.tipoDte === '34' || (dte.montoExento > 0 && dte.montoIva === 0);
    return {
      cuentaCodigo: isExento ? '4.1.02' : '4.1.01',
      cuentaNombre: isExento ? 'Ingresos por Servicios Exentos del Giro' : 'Ingresos por Ventas del Giro',
      origen: 'MANUAL',
      glosaSugerida: `Venta ${isExento ? 'Exenta ' : ''}según Factura N° ${dte.folio} a ${dte.razonSocialContraparte}`,
      esHistorico: true,
      certeza: 100
    };
  }

  // 2. Caso: Boleta de Honorarios (BHE)
  if (dte.tipoOperacion === 'HONORARIOS' || dte.tipoDte === 'BH' || dte.tipoDte === 'BHE') {
    return {
      cuentaCodigo: '5.1.20',
      cuentaNombre: 'Honorarios Profesionales',
      origen: 'INTELIGENCIA_ARTIFICIAL',
      glosaSugerida: `Honorarios profesionales ${dte.razonSocialContraparte} - Retención 14.5%`,
      esHistorico: true,
      certeza: 98
    };
  }

  // 3. Caso: Proveedor con Historial Registrado
  const matchedRule = rules.find(r => cleanRut(r.rutContraparte) === cleanDteRut);
  if (matchedRule) {
    return {
      cuentaCodigo: matchedRule.cuentaCodigo,
      cuentaNombre: matchedRule.cuentaNombre,
      origen: 'HISTORIAL_PROVEEDOR',
      glosaSugerida: matchedRule.conceptoDefecto || dte.glosa || `Compra F/ ${dte.folio} ${dte.razonSocialContraparte}`,
      esHistorico: true,
      certeza: 100
    };
  }

  // 4. Caso: Sin Historial -> Sugerencia Inteligente basada en palabras clave
  const text = `${dte.razonSocialContraparte} ${dte.glosa}`.toUpperCase();

  if (text.includes('ENEL') || text.includes('CGE') || text.includes('ELECTRIC') || text.includes('LUZ') || text.includes('CHILQUINTA')) {
    return {
      cuentaCodigo: '5.1.05',
      cuentaNombre: 'Gasto Electricidad y Energía',
      origen: 'INTELIGENCIA_ARTIFICIAL',
      glosaSugerida: 'Consumo y suministro eléctrico del período',
      esHistorico: false,
      certeza: 95
    };
  }

  if (text.includes('AGUA') || text.includes('ESSBIO') || text.includes('ESVAL') || text.includes('SANITARIA')) {
    return {
      cuentaCodigo: '5.1.06',
      cuentaNombre: 'Gasto Agua Potable y Alcantarillado',
      origen: 'INTELIGENCIA_ARTIFICIAL',
      glosaSugerida: 'Consumo de agua potable y servicios sanitarios',
      esHistorico: false,
      certeza: 95
    };
  }

  if (text.includes('ENTEL') || text.includes('MOVISTAR') || text.includes('CLARO') || text.includes('WOM') || text.includes('VTR') || text.includes('TELECOM') || text.includes('FIBRA')) {
    return {
      cuentaCodigo: '5.1.04',
      cuentaNombre: 'Gasto Telecomunicaciones e Internet',
      origen: 'INTELIGENCIA_ARTIFICIAL',
      glosaSugerida: 'Servicio de internet fibra y enlaces de telecomunicaciones',
      esHistorico: false,
      certeza: 95
    };
  }

  if (text.includes('COPEC') || text.includes('SHELL') || text.includes('PETROBRAS') || text.includes('COMBUSTIBLE') || text.includes('DIESEL') || text.includes('BENCINA')) {
    return {
      cuentaCodigo: '5.1.08',
      cuentaNombre: 'Gasto Combustibles y Lubricantes',
      origen: 'INTELIGENCIA_ARTIFICIAL',
      glosaSugerida: 'Carga de combustible y lubricantes vehículos de la empresa',
      esHistorico: false,
      certeza: 92
    };
  }

  if (text.includes('AUTOPISTA') || text.includes('COSTANERA') || text.includes('VESPUCIO') || text.includes('PEAJE') || text.includes('TAG')) {
    return {
      cuentaCodigo: '5.1.09',
      cuentaNombre: 'Gasto Peajes y Tag',
      origen: 'INTELIGENCIA_ARTIFICIAL',
      glosaSugerida: 'Consumos de autopistas concesionadas y peajes',
      esHistorico: false,
      certeza: 94
    };
  }

  if (text.includes('SODIMAC') || text.includes('EASY') || text.includes('CONSTRUMART') || text.includes('FERRETER') || text.includes('MATERIAL')) {
    return {
      cuentaCodigo: '1.1.09',
      cuentaNombre: 'Existencias / Materiales de Operación',
      origen: 'INTELIGENCIA_ARTIFICIAL',
      glosaSugerida: 'Materiales, insumos de ferretería y herramientas menores',
      esHistorico: false,
      certeza: 88
    };
  }

  if (text.includes('WALMART') || text.includes('LIDER') || text.includes('JUMBO') || text.includes('CENCOSUD') || text.includes('SUPERMERCADO') || text.includes('TOTTUS')) {
    return {
      cuentaCodigo: '5.1.15',
      cuentaNombre: 'Insumos de Oficina y Cafetería',
      origen: 'INTELIGENCIA_ARTIFICIAL',
      glosaSugerida: 'Insumos de aseo, cafetería y oficina general',
      esHistorico: false,
      certeza: 85
    };
  }

  if (text.includes('MICROSOFT') || text.includes('AMAZON') || text.includes('AWS') || text.includes('GOOGLE') || text.includes('ADOBE') || text.includes('SOFTWARE') || text.includes('HOSTING')) {
    return {
      cuentaCodigo: '5.1.18',
      cuentaNombre: 'Software, Nube y Licencias TI',
      origen: 'INTELIGENCIA_ARTIFICIAL',
      glosaSugerida: 'Licenciamiento de software y servicios en la nube',
      esHistorico: false,
      certeza: 95
    };
  }

  if (text.includes('NOTAR') || text.includes('CONSERVADOR') || text.includes('ABOGAD') || text.includes('JURIDIC') || text.includes('LEGAL')) {
    return {
      cuentaCodigo: '5.1.12',
      cuentaNombre: 'Gastos Legales y Notariales',
      origen: 'INTELIGENCIA_ARTIFICIAL',
      glosaSugerida: 'Gastos notariales, escrituras y trámites legales',
      esHistorico: false,
      certeza: 90
    };
  }

  if (text.includes('FLETE') || text.includes('TRANSPORTE') || text.includes('CHILEXPRESS') || text.includes('STARKEN') || text.includes('CORREOS') || text.includes('FEDEX')) {
    return {
      cuentaCodigo: '5.1.07',
      cuentaNombre: 'Gasto Fletes y Transporte de Envíos',
      origen: 'INTELIGENCIA_ARTIFICIAL',
      glosaSugerida: 'Fletes, despachos y transporte de carga',
      esHistorico: false,
      certeza: 90
    };
  }

  if (text.includes('ARRIENDO') || text.includes('INMOBILIARIA') || text.includes('RENTA') || text.includes('OFICINA')) {
    return {
      cuentaCodigo: '5.1.02',
      cuentaNombre: 'Gasto de Arriendos Operacionales',
      origen: 'INTELIGENCIA_ARTIFICIAL',
      glosaSugerida: 'Canon mensual de arriendo de inmueble u oficinas',
      esHistorico: false,
      certeza: 88
    };
  }

  // Si no calza con ninguna regla específica, sugerir mercaderías o gastos generales según giro
  return {
    cuentaCodigo: '5.1.99',
    cuentaNombre: 'Otros Gastos Generales de Administración',
    origen: 'INTELIGENCIA_ARTIFICIAL',
    glosaSugerida: dte.glosa || `Gasto operacional según Factura N° ${dte.folio} de ${dte.razonSocialContraparte}`,
    esHistorico: false,
    certeza: 75
  };
}

/**
 * Valida el desglose de una factura en múltiples partidas:
 * La suma de los montos netos debe ser igual al monto neto de la factura.
 */
export function validateDteSplit(dte: DteDocument, partidas: DteSplitItem[]): {
  valido: boolean;
  diferencia: number;
  sumaPartidas: number;
  mensaje: string;
} {
  const sumaPartidas = partidas.reduce((sum, p) => sum + (Number(p.montoNeto) || 0), 0);
  const diferencia = Math.round(dte.montoNeto - sumaPartidas);
  const valido = Math.abs(diferencia) < 5;

  let mensaje = 'Las partidas cuadran perfectamente con el monto neto de la factura.';
  if (!valido) {
    if (diferencia > 0) {
      mensaje = `Faltan ${formatCLP(diferencia)} para completar el total neto de la factura (${formatCLP(dte.montoNeto)}).`;
    } else {
      mensaje = `Las partidas exceden en ${formatCLP(Math.abs(diferencia))} el neto de la factura (${formatCLP(dte.montoNeto)}).`;
    }
  }

  return { valido, diferencia, sumaPartidas, mensaje };
}

/**
 * Genera el Libro Auxiliar de Compras oficial (Art. 56 DL 825)
 */
export function generateLibroCompras(dtes: DteDocument[], periodo: string) {
  const compras = dtes.filter(d => d.tipoOperacion === 'COMPRA' && d.fechaEmision.startsWith(periodo));
  
  const totalExento = compras.reduce((s, c) => s + c.montoExento, 0);
  const totalNeto = compras.reduce((s, c) => s + c.montoNeto, 0);
  const totalIvaRecuperable = compras.reduce((s, c) => s + c.montoIva, 0);
  const totalBruto = compras.reduce((s, c) => s + c.montoTotal, 0);

  const porTipoDoc: Record<string, { count: number; exento: number; neto: number; iva: number; total: number }> = {};

  compras.forEach(c => {
    const t = c.tipoDte;
    if (!porTipoDoc[t]) {
      porTipoDoc[t] = { count: 0, exento: 0, neto: 0, iva: 0, total: 0 };
    }
    porTipoDoc[t].count++;
    porTipoDoc[t].exento += c.montoExento || 0;
    porTipoDoc[t].neto += c.montoNeto;
    porTipoDoc[t].iva += c.montoIva;
    porTipoDoc[t].total += c.montoTotal;
  });

  return {
    periodo,
    documentos: compras,
    totalDocumentos: compras.length,
    totalExento,
    totalNeto,
    totalIvaRecuperable,
    totalBruto,
    resumenPorTipo: porTipoDoc
  };
}

/**
 * Genera el Libro Auxiliar de Ventas oficial
 */
export function generateLibroVentas(dtes: DteDocument[], periodo: string) {
  const ventas = dtes.filter(d => d.tipoOperacion === 'VENTA' && d.fechaEmision.startsWith(periodo));
  
  const totalExento = ventas.reduce((s, v) => s + v.montoExento, 0);
  const totalNeto = ventas.reduce((s, v) => s + v.montoNeto, 0);
  const totalIvaDebito = ventas.reduce((s, v) => s + v.montoIva, 0);
  const totalBruto = ventas.reduce((s, v) => s + v.montoTotal, 0);

  const porTipoDoc: Record<string, { count: number; exento: number; neto: number; iva: number; total: number }> = {};

  ventas.forEach(v => {
    const t = v.tipoDte;
    if (!porTipoDoc[t]) {
      porTipoDoc[t] = { count: 0, exento: 0, neto: 0, iva: 0, total: 0 };
    }
    porTipoDoc[t].count++;
    porTipoDoc[t].exento += v.montoExento || 0;
    porTipoDoc[t].neto += v.montoNeto;
    porTipoDoc[t].iva += v.montoIva;
    porTipoDoc[t].total += v.montoTotal;
  });

  return {
    periodo,
    documentos: ventas,
    totalDocumentos: ventas.length,
    totalExento,
    totalNeto,
    totalIvaDebito,
    totalBruto,
    resumenPorTipo: porTipoDoc
  };
}

/**
 * Genera el Libro de Boletas de Honorarios Electrónicas (BHE)
 */
export function generateLibroHonorarios(dtes: DteDocument[], periodo: string) {
  const honorarios = dtes.filter(
    d => d.tipoOperacion === 'HONORARIOS' && d.fechaEmision.startsWith(periodo)
  );

  const totalBruto = honorarios.reduce((s, h) => s + h.montoTotal, 0);
  const totalRetencion = honorarios.reduce((s, h) => s + (h.retencionMonto || (h.montoTotal * 0.145)), 0);
  const totalLiquido = totalBruto - totalRetencion;

  return {
    periodo,
    documentos: honorarios,
    totalDocumentos: honorarios.length,
    totalBruto,
    totalRetencion,
    totalLiquido
  };
}

/**
 * Genera el Asiento de Centralización Mensual de Compras o Ventas
 * contra las cuentas parametrizadas por el usuario.
 */
export function generateMonthlyCentralizationEntry(
  periodo: string,
  tipo: 'COMPRA' | 'VENTA',
  dtes: DteDocument[],
  config: SiiCentralizationConfig = DEFAULT_CENTRALIZATION_CONFIG,
  company: CompanyProfile,
  supplierRules: SupplierAccountRule[] = DEFAULT_SUPPLIER_RULES
): {
  asiento: AccountingEntry;
  dtesAfectadosIds: string[];
} {
  const dtesFiltrados = dtes.filter(d => d.tipoOperacion === tipo && d.fechaEmision.startsWith(periodo));
  
  if (dtesFiltrados.length === 0) {
    throw new Error(`No existen documentos de ${tipo} registrados en el período ${periodo} para centralizar.`);
  }

  const lines: AccountingEntryLine[] = [];
  const fechaFinPeriodo = `${periodo}-28`; // Fecha típica de centralización de cierre de mes

  if (tipo === 'COMPRA') {
    // ----------------------------------------------------
    // CENTRALIZACIÓN DE COMPRAS:
    // DEBE: Cuentas de Gasto / Existencias / Activo Fijo (por partidas o sugerencias)
    // DEBE: IVA Crédito Fiscal (1.1.08)
    // HABER: Proveedores Nacionales (2.1.01)
    // ----------------------------------------------------
    const debePorCuenta: Record<string, { codigo: string; nombre: string; monto: number; centroCosto?: string }> = {};
    let totalIvaCredito = 0;
    let totalBrutoProveedores = 0;

    dtesFiltrados.forEach(dte => {
      const esNotaCredito = dte.tipoDte === '61';
      const factor = esNotaCredito ? -1 : 1;

      totalIvaCredito += dte.montoIva * factor;
      totalBrutoProveedores += dte.montoTotal * factor;

      // Si la factura tiene ítems detallados con centros de costos
      if (dte.items && dte.items.length > 0) {
        dte.items.forEach(it => {
          const cod = it.cuentaCodigo || dte.cuentaCodigoAsignada || '5.1.01';
          const cc = it.centroCostoCodigo || it.centroCostoNombre || dte.centroCostoCodigo || dte.centroCostoNombre;
          const key = `${cod}___${cc || 'SIN_CC'}`;
          if (!debePorCuenta[key]) {
            debePorCuenta[key] = {
              codigo: cod,
              nombre: it.cuentaNombre || dte.cuentaNombreAsignada || `Gasto Insumo - ${it.nombre}`,
              monto: 0,
              centroCosto: cc,
            };
          }
          const netoItem = it.esExento ? 0 : Math.round(it.montoTotal / (dte.tipoDte === '34' ? 1 : 1.19));
          const exentoItem = it.esExento ? it.montoTotal : 0;
          const montoItem = (it.montoTotal && !it.precioUnitario) ? it.montoTotal : (netoItem > 0 ? netoItem : (exentoItem > 0 ? exentoItem : it.montoTotal));
          debePorCuenta[key].monto += montoItem * factor;
        });
      }
      // Si la factura está abierta en varias partidas
      else if (dte.partidasDesglosadas && dte.partidasDesglosadas.length > 0) {
        dte.partidasDesglosadas.forEach(p => {
          const cod = p.cuentaCodigo || '5.1.99';
          const cc = p.centroCostoCodigo || p.centroCostoNombre || dte.centroCostoCodigo || dte.centroCostoNombre;
          const key = `${cod}___${cc || 'SIN_CC'}`;
          if (!debePorCuenta[key]) {
            debePorCuenta[key] = {
              codigo: cod,
              nombre: p.cuentaNombre || 'Gasto Operacional',
              monto: 0,
              centroCosto: cc,
            };
          }
          const montoPartida = ((p.montoNeto || 0) + (p.montoExento || 0)) * factor;
          debePorCuenta[key].monto += montoPartida;
        });
      } else {
        // Imputación simple asignada o sugerida
        const cuentaAsignadaCod = dte.cuentaCodigoAsignada || dte.cuentaContableDebe;
        let codigoFinal = cuentaAsignadaCod;
        let nombreFinal = dte.cuentaNombreAsignada;

        if (!codigoFinal) {
          const sug = getSuggestedAccountForDte(dte, supplierRules, company);
          codigoFinal = sug.cuentaCodigo;
          nombreFinal = sug.cuentaNombre;
        }

        if (!codigoFinal) {
          const esPuraExenta = (dte.montoExento > 0 && dte.montoNeto === 0);
          codigoFinal = esPuraExenta ? (config.cuentaComprasExentasGasto?.codigo || '5.1.98') : '5.1.99';
          nombreFinal = esPuraExenta ? (config.cuentaComprasExentasGasto?.nombre || 'Gastos y Adquisiciones Exentas') : 'Otros Gastos de Administración';
        }

        const montoBase = ((dte.montoNeto || 0) + (dte.montoExento || 0)) * factor;
        const cc = dte.centroCostoCodigo || dte.centroCostoNombre;
        const key = `${codigoFinal}___${cc || 'SIN_CC'}`;

        if (!debePorCuenta[key]) {
          debePorCuenta[key] = {
            codigo: codigoFinal,
            nombre: nombreFinal || 'Gasto Operacional',
            monto: 0,
            centroCosto: cc,
          };
        }
        debePorCuenta[key].monto += montoBase;
      }
    });

    // 1. Agregar líneas de DEBE por partidas de compras
    Object.values(debePorCuenta).forEach((data) => {
      if (data.monto > 0) {
        lines.push({
          cuentaCodigo: data.codigo,
          cuentaNombre: data.nombre,
          debe: Math.round(data.monto),
          haber: 0,
          centroCosto: data.centroCosto,
        });
      } else if (data.monto < 0) {
        // En caso de notas de crédito que excedan
        lines.push({
          cuentaCodigo: data.codigo,
          cuentaNombre: data.nombre,
          debe: 0,
          haber: Math.round(Math.abs(data.monto)),
          centroCosto: data.centroCosto,
        });
      }
    });

    // 2. Agregar línea de IVA Crédito Fiscal al DEBE
    if (totalIvaCredito > 0) {
      lines.push({
        cuentaCodigo: config.cuentaIvaCredito.codigo,
        cuentaNombre: config.cuentaIvaCredito.nombre,
        debe: Math.round(totalIvaCredito),
        haber: 0
      });
    }

    // 3. Agregar línea de Proveedores Nacionales al HABER
    lines.push({
      cuentaCodigo: config.cuentaComprasPasivo.codigo,
      cuentaNombre: config.cuentaComprasPasivo.nombre,
      debe: totalBrutoProveedores < 0 ? Math.round(Math.abs(totalBrutoProveedores)) : 0,
      haber: totalBrutoProveedores > 0 ? Math.round(totalBrutoProveedores) : 0
    });

  } else {
    // ----------------------------------------------------
    // CENTRALIZACIÓN DE VENTAS:
    // DEBE: Clientes Nacionales (1.1.03) por Total Facturado (Bruto)
    // HABER: Ingresos por Ventas del Giro (4.1.01) por Monto Neto Afecto
    // HABER: Ingresos por Servicios / Ventas Exentas (4.1.02) por Monto Exento
    // HABER: IVA Débito Fiscal (2.1.04) por Monto IVA Débito
    // ----------------------------------------------------
    const haberPorCuentaVentas: Record<string, { codigo: string; nombre: string; monto: number; centroCosto?: string }> = {};
    let totalBrutoClientes = 0;
    let totalIvaDebito = 0;

    dtesFiltrados.forEach(dte => {
      const esNotaCredito = dte.tipoDte === '61';
      const factor = esNotaCredito ? -1 : 1;

      totalBrutoClientes += dte.montoTotal * factor;
      totalIvaDebito += dte.montoIva * factor;

      // Si la factura tiene ítems detallados con centros de costos
      if (dte.items && dte.items.length > 0) {
        dte.items.forEach(it => {
          const cod = it.cuentaCodigo || (it.esExento ? (config.cuentaVentasExentasIngreso?.codigo || '4.1.02') : config.cuentaVentasIngreso.codigo);
          const nom = it.cuentaNombre || (it.esExento ? (config.cuentaVentasExentasIngreso?.nombre || 'Ingresos por Servicios Exentos del Giro') : config.cuentaVentasIngreso.nombre);
          const cc = it.centroCostoCodigo || it.centroCostoNombre || dte.centroCostoCodigo || dte.centroCostoNombre;
          const key = `${cod}___${cc || 'SIN_CC'}`;

          if (!haberPorCuentaVentas[key]) {
            haberPorCuentaVentas[key] = {
              codigo: cod,
              nombre: nom,
              monto: 0,
              centroCosto: cc,
            };
          }
          const netoItem = it.esExento ? 0 : Math.round(it.montoTotal / (dte.tipoDte === '34' ? 1 : 1.19));
          const exentoItem = it.esExento ? it.montoTotal : 0;
          const montoItem = (it.montoTotal && !it.precioUnitario) ? it.montoTotal : (netoItem > 0 ? netoItem : (exentoItem > 0 ? exentoItem : it.montoTotal));
          haberPorCuentaVentas[key].monto += montoItem * factor;
        });
      } else if (dte.partidasDesglosadas && dte.partidasDesglosadas.length > 0) {
        dte.partidasDesglosadas.forEach(p => {
          const cod = p.cuentaCodigo || config.cuentaVentasIngreso.codigo;
          const nom = p.cuentaNombre || config.cuentaVentasIngreso.nombre;
          const cc = p.centroCostoCodigo || p.centroCostoNombre || dte.centroCostoCodigo || dte.centroCostoNombre;
          const key = `${cod}___${cc || 'SIN_CC'}`;

          if (!haberPorCuentaVentas[key]) {
            haberPorCuentaVentas[key] = {
              codigo: cod,
              nombre: nom,
              monto: 0,
              centroCosto: cc,
            };
          }
          const montoPartida = ((p.montoNeto || 0) + (p.montoExento || 0)) * factor;
          haberPorCuentaVentas[key].monto += montoPartida;
        });
      } else {
        const cc = dte.centroCostoCodigo || dte.centroCostoNombre;
        if (dte.montoNeto > 0 || (dte.montoNeto === 0 && dte.montoExento === 0)) {
          const cod = config.cuentaVentasIngreso.codigo;
          const nom = config.cuentaVentasIngreso.nombre;
          const key = `${cod}___${cc || 'SIN_CC'}`;
          if (!haberPorCuentaVentas[key]) {
            haberPorCuentaVentas[key] = {
              codigo: cod,
              nombre: nom,
              monto: 0,
              centroCosto: cc,
            };
          }
          haberPorCuentaVentas[key].monto += (dte.montoNeto || 0) * factor;
        }

        if (dte.montoExento > 0) {
          const cod = config.cuentaVentasExentasIngreso?.codigo || '4.1.02';
          const nom = config.cuentaVentasExentasIngreso?.nombre || 'Ingresos por Servicios Exentos del Giro';
          const key = `${cod}___${cc || 'SIN_CC'}`;
          if (!haberPorCuentaVentas[key]) {
            haberPorCuentaVentas[key] = {
              codigo: cod,
              nombre: nom,
              monto: 0,
              centroCosto: cc,
            };
          }
          haberPorCuentaVentas[key].monto += (dte.montoExento || 0) * factor;
        }
      }
    });

    // 1. DEBE: Clientes Nacionales (parametrizada)
    lines.push({
      cuentaCodigo: config.cuentaVentasActivo.codigo,
      cuentaNombre: config.cuentaVentasActivo.nombre,
      debe: totalBrutoClientes < 0 ? 0 : Math.round(totalBrutoClientes),
      haber: totalBrutoClientes < 0 ? Math.round(Math.abs(totalBrutoClientes)) : 0
    });

    // 2. HABER: Partidas de Ingresos por Venta desagregadas por Centro de Costo de cada ítem
    const haberEntries = Object.values(haberPorCuentaVentas);
    if (haberEntries.length === 0) {
      lines.push({
        cuentaCodigo: config.cuentaVentasIngreso.codigo,
        cuentaNombre: config.cuentaVentasIngreso.nombre,
        debe: 0,
        haber: 0
      });
    } else {
      haberEntries.forEach(v => {
        if (v.monto > 0) {
          lines.push({
            cuentaCodigo: v.codigo,
            cuentaNombre: v.nombre,
            debe: 0,
            haber: Math.round(v.monto),
            centroCosto: v.centroCosto,
          });
        } else if (v.monto < 0) {
          lines.push({
            cuentaCodigo: v.codigo,
            cuentaNombre: v.nombre,
            debe: Math.round(Math.abs(v.monto)),
            haber: 0,
            centroCosto: v.centroCosto,
          });
        }
      });
    }

    // 4. HABER: IVA Débito Fiscal
    if (totalIvaDebito > 0) {
      lines.push({
        cuentaCodigo: config.cuentaIvaDebito.codigo,
        cuentaNombre: config.cuentaIvaDebito.nombre,
        debe: 0,
        haber: Math.round(totalIvaDebito)
      });
    } else if (totalIvaDebito < 0) {
      lines.push({
        cuentaCodigo: config.cuentaIvaDebito.codigo,
        cuentaNombre: config.cuentaIvaDebito.nombre,
        debe: Math.round(Math.abs(totalIvaDebito)),
        haber: 0
      });
    }
  }

  const totalDebe = lines.reduce((s, l) => s + l.debe, 0);
  const totalHaber = lines.reduce((s, l) => s + l.haber, 0);

  // Cuadre de centavos si hubiese diferencia de redondeo de $1 o $2
  const diff = totalDebe - totalHaber;
  if (Math.abs(diff) > 0 && Math.abs(diff) <= 5) {
    if (diff > 0) {
      lines[lines.length - 1].haber += diff;
    } else {
      lines[lines.length - 1].debe += Math.abs(diff);
    }
  }

  const finalTotalDebe = lines.reduce((s, l) => s + l.debe, 0);
  const finalTotalHaber = lines.reduce((s, l) => s + l.haber, 0);

  const asientoId = `asiento-cent-${tipo.toLowerCase()}-${periodo}-${Date.now().toString().slice(-4)}`;

  const asiento: AccountingEntry = {
    id: asientoId,
    fecha: fechaFinPeriodo,
    concepto: `Centralización Libro de ${tipo === 'COMPRA' ? 'Compras (RCV)' : 'Ventas (RCV)'} - Período ${periodo} (${dtesFiltrados.length} documentos)`,
    documento: `LIBRO-${tipo.toUpperCase()}-${periodo}`,
    totalDebe: finalTotalDebe,
    totalHaber: finalTotalHaber,
    balanceado: finalTotalDebe === finalTotalHaber,
    origen: tipo === 'COMPRA' ? 'RCV_COMPRA' : 'RCV_VENTA',
    creadoEn: new Date().toISOString(),
    empresaId: company?.rut,
    periodo,
    lineas: lines
  };

  return {
    asiento,
    dtesAfectadosIds: dtesFiltrados.map(d => d.id)
  };
}

/**
 * Genera Asientos Contables Individuales (Movimiento a Movimiento)
 * para cada documento (DTE) del RCV en el período especificado.
 */
export function generateDetailedCentralizationEntries(
  periodo: string,
  tipo: 'COMPRA' | 'VENTA',
  dtes: DteDocument[],
  config: SiiCentralizationConfig = DEFAULT_CENTRALIZATION_CONFIG,
  company: CompanyProfile,
  supplierRules: SupplierAccountRule[] = DEFAULT_SUPPLIER_RULES
): {
  asientos: AccountingEntry[];
  dtesAfectadosIds: string[];
} {
  const dtesFiltrados = dtes.filter(d => d.tipoOperacion === tipo && d.fechaEmision.startsWith(periodo));
  if (dtesFiltrados.length === 0) {
    throw new Error(`No existen documentos de ${tipo} registrados en el período ${periodo} para centralizar.`);
  }

  const asientos: AccountingEntry[] = [];
  const dtesAfectadosIds: string[] = [];

  dtesFiltrados.forEach((dte) => {
    let entry: AccountingEntry;
    if (tipo === 'COMPRA') {
      entry = createPurchaseDteEntry(dte);
    } else {
      entry = createSalesDteEntry(dte);
    }

    // Asegurar metadatos reglamentarios
    entry.periodo = periodo;
    entry.empresaId = company?.rut;

    asientos.push(entry);
    dtesAfectadosIds.push(dte.id);
  });

  return {
    asientos,
    dtesAfectadosIds
  };
}

/**
 * Genera el Asiento de Pago a Proveedores para partidas seleccionadas
 * DEBE: 2.1.01 Proveedores Nacionales
 * HABER: 1.1.01 Banco Santander
 */
export function generatePaymentEntry(
  selectedDtes: DteDocument[],
  cuentaBanco: { codigo: string; nombre: string },
  cuentaProveedores: { codigo: string; nombre: string } = { codigo: '2.1.01', nombre: 'Proveedores Nacionales' },
  fechaPago: string = new Date().toISOString().split('T')[0],
  comprobanteRef: string = 'TEF-BANCO'
): AccountingEntry {
  const totalMonto = selectedDtes.reduce((s, d) => s + d.montoTotal, 0);
  const foliosStr = selectedDtes.map(d => `F/${d.folio}`).join(', ');

  const asiento: AccountingEntry = {
    id: `pago-prov-${Date.now()}`,
    fecha: fechaPago,
    concepto: `Pago de Facturas a Proveedores (${selectedDtes.length} documentos: ${foliosStr})`,
    documento: `PAGO-${comprobanteRef}-${Date.now().toString().slice(-4)}`,
    totalDebe: totalMonto,
    totalHaber: totalMonto,
    balanceado: true,
    origen: 'CAJA_BANCO',
    creadoEn: new Date().toISOString(),
    lineas: [
      {
        cuentaCodigo: cuentaProveedores.codigo,
        cuentaNombre: cuentaProveedores.nombre,
        debe: totalMonto,
        haber: 0
      },
      {
        cuentaCodigo: cuentaBanco.codigo,
        cuentaNombre: cuentaBanco.nombre,
        debe: 0,
        haber: totalMonto
      }
    ]
  };

  return asiento;
}

/**
 * Genera el Asiento de Cobro de Facturas de Clientes para partidas seleccionadas
 * DEBE: 1.1.01 Banco Santander
 * HABER: 1.1.03 Clientes Nacionales
 */
export function generateCollectionEntry(
  selectedDtes: DteDocument[],
  cuentaBanco: { codigo: string; nombre: string },
  cuentaClientes: { codigo: string; nombre: string } = { codigo: '1.1.03', nombre: 'Clientes Nacionales' },
  fechaCobro: string = new Date().toISOString().split('T')[0],
  comprobanteRef: string = 'TRANSF-CLIENTE'
): AccountingEntry {
  const totalMonto = selectedDtes.reduce((s, d) => s + d.montoTotal, 0);
  const foliosStr = selectedDtes.map(d => `F/${d.folio}`).join(', ');

  const asiento: AccountingEntry = {
    id: `cobro-clie-${Date.now()}`,
    fecha: fechaCobro,
    concepto: `Cobro de Facturas de Ventas (${selectedDtes.length} documentos: ${foliosStr})`,
    documento: `COBRO-${comprobanteRef}-${Date.now().toString().slice(-4)}`,
    totalDebe: totalMonto,
    totalHaber: totalMonto,
    balanceado: true,
    origen: 'CAJA_BANCO',
    creadoEn: new Date().toISOString(),
    lineas: [
      {
        cuentaCodigo: cuentaBanco.codigo,
        cuentaNombre: cuentaBanco.nombre,
        debe: totalMonto,
        haber: 0
      },
      {
        cuentaCodigo: cuentaClientes.codigo,
        cuentaNombre: cuentaClientes.nombre,
        debe: 0,
        haber: totalMonto
      }
    ]
  };

  return asiento;
}

/**
 * Parser de CSV del Registro de Compras y Ventas del SII (con codificación ISO-8859-1 y delimitador ;)
 */
/**
 * Parser de CSV del Registro de Compras y Ventas del SII (con codificación ISO-8859-1 o UTF-8 y delimitadores ;, , o \t)
 * Analiza dinámicamente los encabezados oficiales de 'sii.cl' para no inventar ningún dato.
 */
export function parseSiiRcvCsv(
  csvContent: string,
  tipoOperacionDefault: 'COMPRA' | 'VENTA' | 'HONORARIOS' = 'COMPRA'
): DteDocument[] {
  // Limpiar BOM
  const cleanContent = csvContent.replace(/^\uFEFF/, '').trim();
  if (!cleanContent) return [];

  const rawLines = cleanContent.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (rawLines.length < 2) return [];

  // Detectar separador común del SII (; es estándar, pero soportar , y \t)
  const firstLine = rawLines[0];
  const countSemi = (firstLine.match(/;/g) || []).length;
  const countComma = (firstLine.match(/,/g) || []).length;
  const countTab = (firstLine.match(/\t/g) || []).length;
  const separator = countSemi >= countComma && countSemi >= countTab ? ';' : (countComma > countTab ? ',' : '\t');

  // Encontrar la línea del encabezado (puede haber líneas de metadatos arriba)
  let headerIndex = -1;
  let headers: string[] = [];

  for (let i = 0; i < Math.min(5, rawLines.length); i++) {
    const candidateHeaders = rawLines[i].split(separator).map(h => h.trim().toUpperCase().replace(/^"|"$/g, ''));
    const matchesKeyword = candidateHeaders.some(h => 
      h.includes('TIPO DOC') || h.includes('FOLIO') || h.includes('RUT') || h.includes('RAZON') || h.includes('BOLETA')
    );
    if (matchesKeyword) {
      headerIndex = i;
      headers = candidateHeaders;
      break;
    }
  }

  if (headerIndex === -1) {
    headerIndex = 0;
    headers = rawLines[0].split(separator).map(h => h.trim().toUpperCase().replace(/^"|"$/g, ''));
  }

  // Mapear índices de columnas dinámicamente con alta precisión para CSV oficial del SII
  const findCol = (pattern: RegExp): number => {
    return headers.findIndex(h => pattern.test(h));
  };

  const colTipoDoc = findCol(/^(TIPO\s*DOC|TIPO\s*DOCUMENTO|COD\s*TIPO\s*DOC)$/i) !== -1
    ? findCol(/^(TIPO\s*DOC|TIPO\s*DOCUMENTO|COD\s*TIPO\s*DOC)$/i)
    : headers.findIndex(h => !/REFERENCIA|VENTA|COMPRA/i.test(h) && /TIPO\s*DOC/i.test(h));

  // 1. Folio: Priorizar columna explícita 'FOLIO'. Si no existe, buscar 'N° DOCTO', etc., evitando la columna contador 'NRO' / 'N°'.
  let colFolio = headers.findIndex(h => /^FOLIO$/i.test(h));
  if (colFolio === -1) {
    colFolio = headers.findIndex(h => !/REFERENCIA/i.test(h) && /\bFOLIO\b/i.test(h));
  }
  if (colFolio === -1) {
    colFolio = headers.findIndex(h => /N[°º.]*\s*(BOLETA|DOCTO|DOC)|NUMERO\s*DOCTO|NRO\s*DOCTO/i.test(h));
  }
  if (colFolio === -1) {
    colFolio = headers.findIndex(h => !/REFERENCIA/i.test(h) && /NUMERO|NRO|N[°º]/i.test(h));
  }

  // 2. RUT:
  const colRutProv = headers.findIndex(h => /RUT\s*(PROV|EMISOR|CONTRA)/i.test(h) && !/LIQUID/i.test(h));
  const colRutCliente = headers.findIndex(h => /RUT\s*(CLIENT|RECEP)/i.test(h));
  const colRutGen = headers.findIndex(h => /^RUT$/i.test(h) || (/RUT/i.test(h) && !/LIQUID|REFERENCIA/i.test(h)));
  const colRut = colRutProv !== -1 ? colRutProv : (colRutCliente !== -1 ? colRutCliente : colRutGen);

  // 3. Razón Social: NUNCA debe coincidir con una columna que contenga "RUT" (e.g. "Rut cliente")
  let colRazonSocial = headers.findIndex(h => /RAZ[OÓ]N\s*SOCIAL/i.test(h));
  if (colRazonSocial === -1) {
    colRazonSocial = headers.findIndex(h => !/RUT/i.test(h) && /RAZ[OÓ]N|NOMBRE/i.test(h));
  }
  if (colRazonSocial === -1) {
    colRazonSocial = headers.findIndex(h => !/RUT|LIQUID/i.test(h) && /PROVEEDOR|CLIENTE|EMISOR|RECEPTOR/i.test(h));
  }

  const colFechaDocto = findCol(/FECHA\s*(DOCTO|EMISI[OÓ]N|DOCUMENTO|DOC)/i);
  const colFechaRecep = findCol(/FECHA\s*(RECEP|ACUSE)/i);
  const colExento = findCol(/EXENTO/i);
  const colNeto = findCol(/NETO|BRUTO/i);
  const colIva = findCol(/IVA\s*(RECUPERABLE|D[EÉ]BITO|CR[EÉ]DITO)?|MONTO\s*IVA/i);
  const colTotal = findCol(/TOTAL|L[IÍ]QUIDO/i);
  const colRetencion = findCol(/RETENCI[OÓ]N/i);

  // Auto-determinar tipo de operación
  let tipoOperacion = tipoOperacionDefault;
  if (colRutCliente !== -1 && colRutProv === -1) {
    tipoOperacion = 'VENTA';
  } else if (colRutProv !== -1 && colRutCliente === -1) {
    tipoOperacion = 'COMPRA';
  } else if (headers.some(h => /TIPO\s*VENTA/i.test(h))) {
    tipoOperacion = 'VENTA';
  } else if (headers.some(h => /TIPO\s*COMPRA/i.test(h))) {
    tipoOperacion = 'COMPRA';
  } else if (colRetencion !== -1 || headers.some(h => h.includes('HONORARIO') || h.includes('BOLETA'))) {
    tipoOperacion = 'HONORARIOS';
  }

  const dtes: DteDocument[] = [];

  for (let i = headerIndex + 1; i < rawLines.length; i++) {
    const rawLine = rawLines[i].trim();
    if (!rawLine) continue;

    const cols = rawLine.split(separator).map(c => c.trim().replace(/^"|"$/g, ''));
    if (cols.length < 3) continue;

    const getVal = (idx: number, def: string = ''): string => {
      return idx !== -1 && cols[idx] !== undefined ? cols[idx].trim() : def;
    };

    const parseNum = (idx: number): number => {
      if (idx === -1 || cols[idx] === undefined) return 0;
      const clean = cols[idx].replace(/\$/g, '').replace(/\./g, '').replace(',', '.').trim();
      const val = parseFloat(clean);
      return isNaN(val) ? 0 : val;
    };

    const montoExento = parseNum(colExento);
    const montoNeto = parseNum(colNeto);
    let montoIva = parseNum(colIva);
    let montoTotal = parseNum(colTotal);

    if (montoTotal === 0 && (montoNeto > 0 || montoExento > 0)) {
      montoTotal = montoNeto + montoIva + montoExento;
    }

    // Identificar Tipo DTE con soporte para Factura Exenta (34)
    let tipoDte: string = '33';
    if (colTipoDoc !== -1 && cols[colTipoDoc]) {
      const parsedTipo = cols[colTipoDoc].replace(/[^0-9]/g, '');
      if (parsedTipo) tipoDte = parsedTipo;
    } else {
      if (montoExento > 0 && montoNeto === 0 && montoIva === 0) {
        tipoDte = '34';
      } else if (tipoOperacion === 'HONORARIOS') {
        tipoDte = '999';
      } else {
        tipoDte = '33';
      }
    }
    
    const folioStr = getVal(colFolio, `${i}`);
    const folio = parseInt(folioStr.replace(/[^0-9]/g, ''), 10) || i;

    const rawRut = getVal(colRut, 'S/RUT');
    const rutContraparte = rawRut.replace(/[^0-9kK.-]/g, '').toUpperCase() || 'S/RUT';
    let razonSocialContraparte = getVal(colRazonSocial, '');
    if (!razonSocialContraparte || razonSocialContraparte === rutContraparte || razonSocialContraparte === '-') {
      razonSocialContraparte = tipoOperacion === 'VENTA' ? `CLIENTE RUT ${rutContraparte}` : `PROVEEDOR RUT ${rutContraparte}`;
    }

    // Parsear fecha
    let fechaEmision = getVal(colFechaDocto, new Date().toISOString().split('T')[0]);
    if (fechaEmision.includes('/')) {
      const parts = fechaEmision.split('/');
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          fechaEmision = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        } else {
          // DD/MM/YYYY
          fechaEmision = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }
    }
    const fechaRecepcion = getVal(colFechaRecep, fechaEmision);

    if (montoIva === 0 && montoNeto > 0 && String(tipoDte) === '33') {
      montoIva = Math.round(montoNeto * 0.19);
      if (montoTotal === montoNeto) montoTotal += montoIva;
    }

    const retencionMonto = parseNum(colRetencion);

    dtes.push({
      id: `dte-real-sii-${tipoOperacion.toLowerCase()}-${tipoDte}-${folio}-${Date.now().toString(36)}-${i}`,
      tipoDte: tipoDte as any,
      folio,
      tipoOperacion,
      rutContraparte,
      razonSocialContraparte,
      fechaEmision,
      fechaRecepcion,
      fechaVencimiento: fechaEmision,
      montoExento,
      montoNeto,
      montoIva,
      montoTotal,
      retencionMonto: retencionMonto > 0 ? retencionMonto : undefined,
      estadoSii: 'ACEPTADO',
      estadoPago: 'PENDIENTE',
      glosa: `Registro Oficial SII: ${razonSocialContraparte} - Folio ${folio} (${tipoOperacion})`,
      imputacionEstado: 'PENDIENTE'
    });
  }

  return dtes;
}

/**
 * Generador de lotes: Retorna estrictamente vacío para evitar datos quemados o ficticios no deseados.
 */
export function generateRealisticSiiBatch(
  _periodo: string,
  _company: CompanyProfile | ClientCompany
): DteDocument[] {
  return [];
}

