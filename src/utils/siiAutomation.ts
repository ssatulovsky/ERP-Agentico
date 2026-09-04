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
import { formatCLP } from './chileanAccounting';

// Catálogo inicial de memoria contable por RUT para proveedores y servicios habituales en Chile
export const DEFAULT_SUPPLIER_RULES: SupplierAccountRule[] = [
  {
    id: 'rule-enel',
    rutContraparte: '96.800.570-7',
    razonSocial: 'ENEL DISTRIBUCION CHILE S.A.',
    cuentaCodigo: '5.1.05',
    cuentaNombre: 'Gasto Electricidad y Energía',
    conceptoDefecto: 'Suministro eléctrico sucursal y oficina central',
    vecesUsado: 14,
    ultimaFecha: '2026-08-15',
    esFrecuente: true
  },
  {
    id: 'rule-aguas',
    rutContraparte: '61.808.000-5',
    razonSocial: 'AGUAS ANDINAS S.A.',
    cuentaCodigo: '5.1.06',
    cuentaNombre: 'Gasto Agua Potable y Alcantarillado',
    conceptoDefecto: 'Consumo mensual agua potable matriz',
    vecesUsado: 12,
    ultimaFecha: '2026-08-12',
    esFrecuente: true
  },
  {
    id: 'rule-entel',
    rutContraparte: '96.574.000-k',
    razonSocial: 'ENTEL PCS TELECOMUNICACIONES S.A.',
    cuentaCodigo: '5.1.04',
    cuentaNombre: 'Gasto Telecomunicaciones e Internet',
    conceptoDefecto: 'Planes corporativos móviles y enlace fibra óptica',
    vecesUsado: 16,
    ultimaFecha: '2026-08-20',
    esFrecuente: true
  },
  {
    id: 'rule-copec',
    rutContraparte: '99.520.000-7',
    razonSocial: 'COMPAÑIA DE PETROLEOS DE CHILE COPEC S.A.',
    cuentaCodigo: '5.1.08',
    cuentaNombre: 'Gasto Combustibles y Lubricantes',
    conceptoDefecto: 'Carga diesel y gasolina vehículos operacionales',
    vecesUsado: 22,
    ultimaFecha: '2026-08-28',
    esFrecuente: true
  },
  {
    id: 'rule-sodimac',
    rutContraparte: '96.792.430-K',
    razonSocial: 'SODIMAC S.A.',
    cuentaCodigo: '1.1.09',
    cuentaNombre: 'Existencias y Materiales de Operación',
    conceptoDefecto: 'Materiales ferretería y herramientas de mantención',
    vecesUsado: 9,
    ultimaFecha: '2026-08-10',
    esFrecuente: true
  },
  {
    id: 'rule-walmart',
    rutContraparte: '76.134.941-4',
    razonSocial: 'WALMART CHILE COMERCIAL LTDA.',
    cuentaCodigo: '5.1.15',
    cuentaNombre: 'Insumos de Oficina y Aseo',
    conceptoDefecto: 'Artículos de aseo, cafetería y oficina',
    vecesUsado: 8,
    ultimaFecha: '2026-08-05',
    esFrecuente: true
  },
  {
    id: 'rule-aws',
    rutContraparte: '59.184.000-3',
    razonSocial: 'AMAZON WEB SERVICES CHILE SPA',
    cuentaCodigo: '5.1.18',
    cuentaNombre: 'Software, Nube y Licencias TI',
    conceptoDefecto: 'Servidores cloud hosting y base de datos',
    vecesUsado: 15,
    ultimaFecha: '2026-08-31',
    esFrecuente: true
  },
  {
    id: 'rule-google',
    rutContraparte: '76.012.345-6',
    razonSocial: 'GOOGLE CHILE COMPUTACION LTDA.',
    cuentaCodigo: '5.1.18',
    cuentaNombre: 'Software, Nube y Licencias TI',
    conceptoDefecto: 'Google Workspace y servicios en la nube',
    vecesUsado: 11,
    ultimaFecha: '2026-08-25',
    esFrecuente: true
  },
  {
    id: 'rule-notaria',
    rutContraparte: '7.654.321-0',
    razonSocial: 'NOTARIA Y CONSERVADOR DE BIENES RAICES',
    cuentaCodigo: '5.1.12',
    cuentaNombre: 'Gastos Legales y Notariales',
    conceptoDefecto: 'Protocolización de escrituras y legalización de poderes',
    vecesUsado: 5,
    ultimaFecha: '2026-07-14',
    esFrecuente: false
  },
];

// Configuración por defecto de cuentas para centralización
export const DEFAULT_CENTRALIZATION_CONFIG: SiiCentralizationConfig = {
  cuentaComprasPasivo: { codigo: '2.1.01', nombre: 'Proveedores Nacionales' },
  cuentaVentasActivo: { codigo: '1.1.03', nombre: 'Clientes Nacionales' },
  cuentaIvaCredito: { codigo: '1.1.08', nombre: 'IVA Crédito Fiscal' },
  cuentaIvaDebito: { codigo: '2.1.04', nombre: 'IVA Débito Fiscal' },
  cuentaVentasIngreso: { codigo: '4.1.01', nombre: 'Ingresos por Ventas del Giro' },
  cuentaHonorariosGasto: { codigo: '5.1.20', nombre: 'Honorarios Profesionales' },
  cuentaRetencionHonorarios: { codigo: '2.1.06', nombre: 'Retenciones Impuesto 2da Categoría (14.5%)' },
  cuentaBancoPago: { codigo: '1.1.01', nombre: 'Banco Santander - Cuenta Corriente' },
  cuentaBancoCobro: { codigo: '1.1.01', nombre: 'Banco Santander - Cuenta Corriente' }
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
  { codigo: '4.1.01', nombre: 'Ingresos por Ventas del Giro', tipo: 'INGRESO' },
  { codigo: '4.1.02', nombre: 'Ingresos por Prestación de Servicios', tipo: 'INGRESO' },
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
      ultimaActualizacion: dtesPeriodo.length > 0 ? '2026-08-30' : undefined
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
    return {
      cuentaCodigo: '4.1.01',
      cuentaNombre: 'Ingresos por Ventas del Giro',
      origen: 'MANUAL',
      glosaSugerida: `Venta según Factura N° ${dte.folio} a ${dte.razonSocialContraparte}`,
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

  const porTipoDoc: Record<string, { count: number; neto: number; iva: number; total: number }> = {};

  compras.forEach(c => {
    const t = c.tipoDte;
    if (!porTipoDoc[t]) {
      porTipoDoc[t] = { count: 0, neto: 0, iva: 0, total: 0 };
    }
    porTipoDoc[t].count++;
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

  const porTipoDoc: Record<string, { count: number; neto: number; iva: number; total: number }> = {};

  ventas.forEach(v => {
    const t = v.tipoDte;
    if (!porTipoDoc[t]) {
      porTipoDoc[t] = { count: 0, neto: 0, iva: 0, total: 0 };
    }
    porTipoDoc[t].count++;
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
    const debePorCuenta: Record<string, { nombre: string; monto: number }> = {};
    let totalIvaCredito = 0;
    let totalBrutoProveedores = 0;

    dtesFiltrados.forEach(dte => {
      const esNotaCredito = dte.tipoDte === '61';
      const factor = esNotaCredito ? -1 : 1;

      totalIvaCredito += dte.montoIva * factor;
      totalBrutoProveedores += dte.montoTotal * factor;

      // Si la factura está abierta en varias partidas
      if (dte.partidasDesglosadas && dte.partidasDesglosadas.length > 0) {
        dte.partidasDesglosadas.forEach(p => {
          const cod = p.cuentaCodigo || '5.1.99';
          if (!debePorCuenta[cod]) {
            debePorCuenta[cod] = { nombre: p.cuentaNombre || 'Gasto Operacional', monto: 0 };
          }
          debePorCuenta[cod].monto += (p.montoNeto * factor);
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
          codigoFinal = '5.1.99';
          nombreFinal = 'Otros Gastos de Administración';
        }

        if (!debePorCuenta[codigoFinal]) {
          debePorCuenta[codigoFinal] = { nombre: nombreFinal || 'Gasto Operacional', monto: 0 };
        }
        debePorCuenta[codigoFinal].monto += (dte.montoNeto * factor);
      }
    });

    // 1. Agregar líneas de DEBE por partidas de compras
    Object.entries(debePorCuenta).forEach(([cod, data]) => {
      if (data.monto > 0) {
        lines.push({
          cuentaCodigo: cod,
          cuentaNombre: data.nombre,
          debe: Math.round(data.monto),
          haber: 0
        });
      } else if (data.monto < 0) {
        // En caso de notas de crédito que excedan
        lines.push({
          cuentaCodigo: cod,
          cuentaNombre: data.nombre,
          debe: 0,
          haber: Math.round(Math.abs(data.monto))
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
    // DEBE: Clientes Nacionales (1.1.03) por Total Facturado
    // HABER: Ingresos por Ventas del Giro (4.1.01) por Monto Neto
    // HABER: IVA Débito Fiscal (2.1.04) por Monto IVA
    // ----------------------------------------------------
    let totalBrutoClientes = 0;
    let totalNetoVentas = 0;
    let totalIvaDebito = 0;

    dtesFiltrados.forEach(dte => {
      const esNotaCredito = dte.tipoDte === '61';
      const factor = esNotaCredito ? -1 : 1;

      totalBrutoClientes += dte.montoTotal * factor;
      totalNetoVentas += dte.montoNeto * factor;
      totalIvaDebito += dte.montoIva * factor;
    });

    // 1. DEBE: Clientes Nacionales (parametrizada)
    lines.push({
      cuentaCodigo: config.cuentaVentasActivo.codigo,
      cuentaNombre: config.cuentaVentasActivo.nombre,
      debe: Math.round(totalBrutoClientes),
      haber: 0
    });

    // 2. HABER: Ventas Netas del Giro
    lines.push({
      cuentaCodigo: config.cuentaVentasIngreso.codigo,
      cuentaNombre: config.cuentaVentasIngreso.nombre,
      debe: 0,
      haber: Math.round(totalNetoVentas)
    });

    // 3. HABER: IVA Débito Fiscal
    if (totalIvaDebito > 0) {
      lines.push({
        cuentaCodigo: config.cuentaIvaDebito.codigo,
        cuentaNombre: config.cuentaIvaDebito.nombre,
        debe: 0,
        haber: Math.round(totalIvaDebito)
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
    lineas: lines
  };

  return {
    asiento,
    dtesAfectadosIds: dtesFiltrados.map(d => d.id)
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
export function parseSiiRcvCsv(csvContent: string, tipoOperacion: 'COMPRA' | 'VENTA' | 'HONORARIOS'): DteDocument[] {
  const lines = csvContent.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) return [];

  const header = lines[0].split(';').map(h => h.trim().toUpperCase());
  const dtes: DteDocument[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(';').map(c => c.trim().replace(/^"|"$/g, ''));
    if (cols.length < 5) continue;

    // Tratar de mapear columnas estándares del SII
    // Formato RCV Compras SII:
    // Tipo Doc;Folio;RUT Proveedor;Razon Social;Fecha Docto;Fecha Recepcion;Monto Exento;Monto Neto;Monto IVA;Monto Total
    const tipoDoc = cols[0] || '33';
    const folio = parseInt(cols[1].replace(/[^0-9]/g, ''), 10) || (1000 + i);
    const rut = cols[2] || '76.123.456-7';
    const razonSocial = cols[3] || 'PROVEEDOR GENERAL';
    const fechaDocto = cols[4] || new Date().toISOString().split('T')[0];
    const fechaRecepcion = cols[5] || fechaDocto;
    const montoExento = parseFloat(cols[6].replace(/\./g, '').replace(',', '.')) || 0;
    const montoNeto = parseFloat(cols[7].replace(/\./g, '').replace(',', '.')) || 0;
    const montoIva = parseFloat(cols[8].replace(/\./g, '').replace(',', '.')) || Math.round(montoNeto * 0.19);
    const montoTotal = parseFloat(cols[9]?.replace(/\./g, '').replace(',', '.')) || (montoNeto + montoIva + montoExento);

    dtes.push({
      id: `dte-csv-${tipoOperacion.toLowerCase()}-${Date.now()}-${i}`,
      tipoDte: (tipoDoc as any) || '33',
      folio,
      tipoOperacion,
      rutContraparte: rut,
      razonSocialContraparte: razonSocial,
      fechaEmision: fechaDocto,
      fechaRecepcion,
      fechaVencimiento: fechaDocto,
      montoExento,
      montoNeto,
      montoIva,
      montoTotal,
      estadoSii: 'ACEPTADO',
      estadoPago: 'PENDIENTE',
      glosa: `Importado de SII RCV: ${razonSocial} Folio ${folio}`,
      imputacionEstado: 'PENDIENTE'
    });
  }

  return dtes;
}

/**
 * Generador de lotes auténticos de DTEs para el período si se activa la bajada automática del SII
 */
export function generateRealisticSiiBatch(
  periodo: string, // "2026-06"
  company: CompanyProfile | ClientCompany
): DteDocument[] {
  const dtes: DteDocument[] = [];
  const anioMes = periodo; // "2026-06"

  // Proveedores habituales chilenos para compras
  const proveedoresDemo = [
    { rut: '96.800.570-7', razon: 'ENEL DISTRIBUCION CHILE S.A.', glosa: 'Suministro de energía eléctrica', neto: 384500, exento: 0 },
    { rut: '61.808.000-5', razon: 'AGUAS ANDINAS S.A.', glosa: 'Servicio de agua potable y alcantarillado', neto: 95400, exento: 0 },
    { rut: '96.574.000-k', razon: 'ENTEL PCS TELECOMUNICACIONES S.A.', glosa: 'Planes corporativos e internet enlace', neto: 275000, exento: 0 },
    { rut: '99.520.000-7', razon: 'COMPAÑIA DE PETROLEOS DE CHILE COPEC S.A.', glosa: 'Combustibles operacionales flota', neto: 540000, exento: 0 },
    { rut: '96.792.430-K', razon: 'SODIMAC S.A.', glosa: 'Materiales de mantenimiento y ferretería', neto: 420000, exento: 0 },
    { rut: '59.184.000-3', razon: 'AMAZON WEB SERVICES CHILE SPA', glosa: 'Infraestructura cloud servidores', neto: 860000, exento: 0 },
    { rut: '76.134.941-4', razon: 'WALMART CHILE COMERCIAL LTDA.', glosa: 'Insumos de oficina y aseo general', neto: 145000, exento: 0 },
    { rut: '7.654.321-0', razon: 'NOTARIA Y CONSERVADOR DE BIENES RAICES', glosa: 'Legalización de actas y poderes', neto: 75000, exento: 0 }
  ];

  // Generar facturas de compra
  proveedoresDemo.forEach((p, idx) => {
    const dia = (idx * 3 + 2).toString().padStart(2, '0');
    const fecha = `${anioMes}-${dia}`;
    const iva = Math.round(p.neto * 0.19);
    const total = p.neto + iva;
    const folio = Math.floor(Math.random() * 8000) + 20000 + idx;

    dtes.push({
      id: `dte-sii-compra-${periodo}-${idx + 1}`,
      tipoDte: '33',
      folio,
      tipoOperacion: 'COMPRA',
      rutContraparte: p.rut,
      razonSocialContraparte: p.razon,
      fechaEmision: fecha,
      fechaRecepcion: fecha,
      fechaVencimiento: `${anioMes}-28`,
      montoExento: p.exento,
      montoNeto: p.neto,
      montoIva: iva,
      montoTotal: total,
      estadoSii: 'ACEPTADO',
      estadoPago: 'PENDIENTE',
      glosa: p.glosa,
      imputacionEstado: 'PENDIENTE',
      proveedorHistoricoDetectado: true
    });
  });

  // Clientes para ventas
  const clientesDemo = [
    { rut: '76.890.123-4', razon: 'SOCIEDAD COMERCIAL LOS ALERCES LTDA.', neto: 2450000 },
    { rut: '77.345.678-9', razon: 'DISTRIBUIDORA Y LOGISTICA AUSTRAL SPA', neto: 3890000 },
    { rut: '76.002.341-1', razon: 'SERVICIOS INDUSTRIALES DEL PACIFICO S.A.', neto: 1750000 },
    { rut: '77.981.234-5', razon: 'CLINICA INTEGRAL DE SALUD CHILE SPA', neto: 4120000 }
  ];

  clientesDemo.forEach((c, idx) => {
    const dia = (idx * 6 + 5).toString().padStart(2, '0');
    const fecha = `${anioMes}-${dia}`;
    const iva = Math.round(c.neto * 0.19);
    const total = c.neto + iva;
    const folio = Math.floor(Math.random() * 500) + 1400 + idx;

    dtes.push({
      id: `dte-sii-venta-${periodo}-${idx + 1}`,
      tipoDte: '33',
      folio,
      tipoOperacion: 'VENTA',
      rutContraparte: c.rut,
      razonSocialContraparte: c.razon,
      fechaEmision: fecha,
      fechaRecepcion: fecha,
      fechaVencimiento: `${anioMes}-30`,
      montoExento: 0,
      montoNeto: c.neto,
      montoIva: iva,
      montoTotal: total,
      estadoSii: 'ACEPTADO',
      estadoPago: 'PENDIENTE',
      glosa: `Prestación de servicios operacionales - Factura Electrónica ${folio}`,
      imputacionEstado: 'PENDIENTE',
      cuentaCodigoAsignada: '4.1.01',
      cuentaNombreAsignada: 'Ingresos por Ventas del Giro'
    });
  });

  // Boletas de honorarios recibidas
  const honorariosDemo = [
    { rut: '15.432.189-2', nombre: 'JAVIER MATURANA OYARZUN', montoBruto: 950000, glosa: 'Asesoría en arquitectura de sistemas TI' },
    { rut: '14.890.321-7', nombre: 'CAMILA PEREZ ARRIAGADA', montoBruto: 650000, glosa: 'Auditoría externa de procesos operacionales' }
  ];

  honorariosDemo.forEach((h, idx) => {
    const dia = (idx * 10 + 12).toString().padStart(2, '0');
    const fecha = `${anioMes}-${dia}`;
    const retencionTasa = 0.145; // 14.5% vigente
    const retencionMonto = Math.round(h.montoBruto * retencionTasa);
    const folio = Math.floor(Math.random() * 200) + 120 + idx;

    dtes.push({
      id: `dte-sii-honorario-${periodo}-${idx + 1}`,
      tipoDte: 'BHE',
      folio,
      tipoOperacion: 'HONORARIOS',
      rutContraparte: h.rut,
      razonSocialContraparte: h.nombre,
      fechaEmision: fecha,
      fechaRecepcion: fecha,
      fechaVencimiento: `${anioMes}-25`,
      montoExento: 0,
      montoNeto: h.montoBruto,
      montoIva: 0,
      montoTotal: h.montoBruto,
      retencionTasa,
      retencionMonto,
      estadoSii: 'ACEPTADO',
      estadoPago: 'PENDIENTE',
      glosa: h.glosa,
      imputacionEstado: 'PENDIENTE',
      cuentaCodigoAsignada: '5.1.20',
      cuentaNombreAsignada: 'Honorarios Profesionales'
    });
  });

  return dtes;
}
