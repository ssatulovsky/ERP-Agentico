import { DteDocumentLayoutConfig, DteLayoutPreset } from '../types';

export const DEFAULT_INVOICE_LAYOUTS: Record<DteLayoutPreset, (companyRut?: string, companyName?: string) => DteDocumentLayoutConfig> = {
  CORPORATE: (rut = '76.890.123-4', name = 'EMPRESA EJEMPLO S.A.') => ({
    id: 'layout-corporate',
    companyId: 'default',
    preset: 'CORPORATE',
    updatedAt: new Date().toISOString(),

    // Marca & Logo
    logoUrl: '',
    logoPosition: 'left',
    logoSize: 'md',
    showCompanyNameWithLogo: true,
    nombreFantasia: '',

    // Colores y Tipografía
    primaryColor: '#1e3a8a', // Azul Corporativo (Blue 900)
    accentColor: '#2563eb',
    textColor: '#0f172a',
    fontFamily: 'sans',
    fontSize: 'md',
    headerStyle: 'filled',
    tableBorders: 'horizontal',
    stripedRows: true,

    // Datos Emisor SII
    emisorRut: rut,
    emisorRazonSocial: name,
    emisorGiro: 'SERVICIOS INTEGRALES Y COMERCIALIZACIÓN INDUSTRIAL',
    emisorDireccion: 'Av. Libertador Bernardo O\'Higgins 1302, Of. 801',
    emisorComuna: 'SANTIAGO',
    emisorCiudad: 'SANTIAGO',
    emisorUnidadSii: 'S.I.I. - SANTIAGO CENTRO',
    emisorActecoTexto: '702000 - Actividades de consultoría de gestión',
    emisorTelefono: '+56 2 2987 6543',
    emisorEmail: 'facturacion@empresa.cl',
    emisorWeb: 'www.empresa.cl',
    emisorSucursalesTexto: 'Casa Matriz: Santiago | Sucursal: Puerto Montt, Av. Costanera 1020',

    // Recuadro Rojo SII
    recuadroRojoBorderWidth: 3,
    recuadroRojoBorderStyle: 'double',
    recuadroRojoColor: '#dc2626',
    customFolioPrefix: 'N°',

    // Elementos Legales
    showLey19983Cedible: true,
    tipoEjemplar: 'ORIGINAL_CLIENTE',
    showTedBarcode: true,
    tedLeyendaTexto: 'Timbre Electrónico SII - Res. N° 80 de 2014 - Verifique documento en www.sii.cl',
    watermark: 'NONE',

    // Columnas
    showItemCode: true,
    showItemDescription: true,
    showItemUnit: true,
    showItemDiscount: true,
    showCostCenterTag: true,

    // Totales y Pie
    showTotalInWords: true,
    showBankDetails: true,
    bankDetailsText: 'Banco Santander Chile | Cuenta Corriente N° 78-98765-4 | Titular: EMPRESA EJEMPLO S.A. | RUT: 76.890.123-4 | Enviar comprobante a pagos@empresa.cl',
    commercialNotes: 'Factura emitida bajo normativa tributaria vigente del Servicio de Impuestos Internos. Plazo de pago 30 días según Ley 19.983 de Pago Oportuno.',
    footerDisclaimer: 'Documento tributario electrónico autorizado mediante Resolución Exenta SII N° 80. Validez legal acreditada mediante firma electrónica avanzada y CAF.',

    paperSize: 'LETTER',
    pageOrientation: 'PORTRAIT',
    marginSize: 'normal',
  }),

  OFFICIAL_SII: (rut = '76.890.123-4', name = 'EMPRESA EJEMPLO S.A.') => ({
    id: 'layout-official-sii',
    companyId: 'default',
    preset: 'OFFICIAL_SII',
    updatedAt: new Date().toISOString(),

    logoUrl: '',
    logoPosition: 'left',
    logoSize: 'sm',
    showCompanyNameWithLogo: true,
    nombreFantasia: '',

    primaryColor: '#000000',
    accentColor: '#374151',
    textColor: '#000000',
    fontFamily: 'serif',
    fontSize: 'sm',
    headerStyle: 'outlined',
    tableBorders: 'full',
    stripedRows: false,

    emisorRut: rut,
    emisorRazonSocial: name,
    emisorGiro: 'VENTA AL POR MAYOR Y MENOR - PRESTACIÓN DE SERVICIOS',
    emisorDireccion: 'Calle Moneda 920, Oficina 402',
    emisorComuna: 'SANTIAGO',
    emisorCiudad: 'SANTIAGO',
    emisorUnidadSii: 'S.I.I. - SANTIAGO CENTRO',
    emisorActecoTexto: '465900 - Venta al por mayor de otra maquinaria y equipo',
    emisorTelefono: '+56 2 2333 4455',
    emisorEmail: 'contacto@empresa.cl',
    emisorWeb: '',
    emisorSucursalesTexto: 'Casa Matriz: Moneda 920, Santiago',

    recuadroRojoBorderWidth: 3,
    recuadroRojoBorderStyle: 'double',
    recuadroRojoColor: '#b91c1c',
    customFolioPrefix: 'N°',

    showLey19983Cedible: true,
    tipoEjemplar: 'CEDIBLE_MERITO_EJECUTIVO',
    showTedBarcode: true,
    tedLeyendaTexto: 'Timbre Electrónico SII - Res. N° 80 de 2014 - Verifique documento: www.sii.cl',
    watermark: 'NONE',

    showItemCode: true,
    showItemDescription: true,
    showItemUnit: true,
    showItemDiscount: false,
    showCostCenterTag: false,

    showTotalInWords: true,
    showBankDetails: true,
    bankDetailsText: 'Banco Estado | Cuenta Corriente 1234567 | Transferir a pagos@empresa.cl',
    commercialNotes: 'El acuse de recibo de esta factura acredita la recepción de mercaderías o servicios conforme al Art. 4 y 5 de la Ley 19.983.',
    footerDisclaimer: 'SERVICIO DE IMPUESTOS INTERNOS - SISTEMA DE FACTURACIÓN ELECTRÓNICA DECRETO LEY 825',

    paperSize: 'LETTER',
    pageOrientation: 'PORTRAIT',
    marginSize: 'compact',
  }),

  MINIMALIST: (rut = '76.890.123-4', name = 'EMPRESA EJEMPLO S.A.') => ({
    id: 'layout-minimalist',
    companyId: 'default',
    preset: 'MINIMALIST',
    updatedAt: new Date().toISOString(),

    logoUrl: '',
    logoPosition: 'left',
    logoSize: 'md',
    showCompanyNameWithLogo: false,
    nombreFantasia: name,

    primaryColor: '#0f172a',
    accentColor: '#64748b',
    textColor: '#334155',
    fontFamily: 'sans',
    fontSize: 'md',
    headerStyle: 'clean',
    tableBorders: 'minimal',
    stripedRows: false,

    emisorRut: rut,
    emisorRazonSocial: name,
    emisorGiro: 'TECNOLOGÍA, SOFTWARE Y SERVICIOS PROFESIONALES',
    emisorDireccion: 'Av. Andrés Bello 2457, Piso 18',
    emisorComuna: 'PROVIDENCIA',
    emisorCiudad: 'SANTIAGO',
    emisorUnidadSii: 'S.I.I. - SANTIAGO ORIENTE',
    emisorActecoTexto: '620100 - Actividades de programación informática',
    emisorTelefono: '+56 2 2800 1200',
    emisorEmail: 'finance@empresa.io',
    emisorWeb: 'https://empresa.io',
    emisorSucursalesTexto: '',

    recuadroRojoBorderWidth: 2,
    recuadroRojoBorderStyle: 'solid',
    recuadroRojoColor: '#ef4444',
    customFolioPrefix: 'FOLIO',

    showLey19983Cedible: true,
    tipoEjemplar: 'ORIGINAL_CLIENTE',
    showTedBarcode: true,
    tedLeyendaTexto: 'Timbre Electrónico SII - Res. N° 80 de 2014 - Verifique documento en www.sii.cl',
    watermark: 'NONE',

    showItemCode: false,
    showItemDescription: true,
    showItemUnit: true,
    showItemDiscount: true,
    showCostCenterTag: true,

    showTotalInWords: false,
    showBankDetails: true,
    bankDetailsText: 'Banco de Chile / Cta Cte 00-123-45678-00 / finanzas@empresa.io',
    commercialNotes: 'Condiciones de Pago: 30 días fecha factura.',
    footerDisclaimer: 'Emitido electrónicamente según normativa SII Chile.',

    paperSize: 'A4',
    pageOrientation: 'PORTRAIT',
    marginSize: 'normal',
  }),

  INDUSTRIAL: (rut = '76.890.123-4', name = 'EMPRESA EJEMPLO S.A.') => ({
    id: 'layout-industrial',
    companyId: 'default',
    preset: 'INDUSTRIAL',
    updatedAt: new Date().toISOString(),

    logoUrl: '',
    logoPosition: 'left',
    logoSize: 'lg',
    showCompanyNameWithLogo: true,
    nombreFantasia: '',

    primaryColor: '#065f46', // Verde Esmeralda Industrial
    accentColor: '#059669',
    textColor: '#1e293b',
    fontFamily: 'sans',
    fontSize: 'sm',
    headerStyle: 'filled',
    tableBorders: 'full',
    stripedRows: true,

    emisorRut: rut,
    emisorRazonSocial: name,
    emisorGiro: 'FABRICACIÓN DE REDES, ARTEFACTOS NAVALES Y SERVICIOS MARÍTIMOS',
    emisorDireccion: 'Ruta 5 Sur Km. 1025, Sector Trapén',
    emisorComuna: 'PUERTO MONTT',
    emisorCiudad: 'PUERTO MONTT',
    emisorUnidadSii: 'S.I.I. - PUERTO MONTT',
    emisorActecoTexto: '139400 - Fabricación de cuerdas, cordeles, bramantes y redes',
    emisorTelefono: '+56 65 248 9000',
    emisorEmail: 'ventas@redesnavales.cl',
    emisorWeb: 'www.redesnavales.cl',
    emisorSucursalesTexto: 'Planta Puerto Montt: Km 1025 | Taller Castro: Panamericana Norte 450',

    recuadroRojoBorderWidth: 4,
    recuadroRojoBorderStyle: 'double',
    recuadroRojoColor: '#dc2626',
    customFolioPrefix: 'N°',

    showLey19983Cedible: true,
    tipoEjemplar: 'CEDIBLE_MERITO_EJECUTIVO',
    showTedBarcode: true,
    tedLeyendaTexto: 'Timbre Electrónico SII - Res. N° 80 de 2014 - Verifique documento en www.sii.cl',
    watermark: 'NONE',

    showItemCode: true,
    showItemDescription: true,
    showItemUnit: true,
    showItemDiscount: true,
    showCostCenterTag: true,

    showTotalInWords: true,
    showBankDetails: true,
    bankDetailsText: 'Banco Santander | Cta Cte Empresa N° 65-12345-0 | Notificar pago a: tesoreria@redesnavales.cl',
    commercialNotes: 'Recepción de mercaderías de Lunes a Viernes de 08:30 a 17:30 hrs. Los productos cuentan con trazabilidad RG 1821 SERNAPESCA.',
    footerDisclaimer: 'Documento Electrónico con Mérito Ejecutivo según Ley 19.983.',

    paperSize: 'LETTER',
    pageOrientation: 'PORTRAIT',
    marginSize: 'compact',
  }),

  EXECUTIVE_DARK: (rut = '76.890.123-4', name = 'EMPRESA EJEMPLO S.A.') => ({
    id: 'layout-executive-dark',
    companyId: 'default',
    preset: 'EXECUTIVE_DARK',
    updatedAt: new Date().toISOString(),

    logoUrl: '',
    logoPosition: 'left',
    logoSize: 'md',
    showCompanyNameWithLogo: true,
    nombreFantasia: '',

    primaryColor: '#0f172a', // Slate 900
    accentColor: '#3b82f6', // Azul eléctrico
    textColor: '#1e293b',
    fontFamily: 'sans',
    fontSize: 'md',
    headerStyle: 'filled',
    tableBorders: 'horizontal',
    stripedRows: true,

    emisorRut: rut,
    emisorRazonSocial: name,
    emisorGiro: 'AUDITORÍA, CONSULTORÍA FINANCIERA Y GOBERNANZA CORPORATIVA',
    emisorDireccion: 'Av. Vitacura 2670, Piso 15, Las Condes',
    emisorComuna: 'LAS CONDES',
    emisorCiudad: 'SANTIAGO',
    emisorUnidadSii: 'S.I.I. - SANTIAGO ORIENTE',
    emisorActecoTexto: '692000 - Actividades de contabilidad, teneduría de libros y auditoría',
    emisorTelefono: '+56 2 2450 7800',
    emisorEmail: 'billing@consultora-auditores.cl',
    emisorWeb: 'www.consultora-auditores.cl',
    emisorSucursalesTexto: 'Oficina Las Condes: Av. Vitacura 2670 | Concepción: O\'Higgins 450',

    recuadroRojoBorderWidth: 3,
    recuadroRojoBorderStyle: 'double',
    recuadroRojoColor: '#dc2626',
    customFolioPrefix: 'N°',

    showLey19983Cedible: true,
    tipoEjemplar: 'ORIGINAL_CLIENTE',
    showTedBarcode: true,
    tedLeyendaTexto: 'Timbre Electrónico SII - Res. N° 80 de 2014 - Verifique documento en www.sii.cl',
    watermark: 'NONE',

    showItemCode: true,
    showItemDescription: true,
    showItemUnit: true,
    showItemDiscount: true,
    showCostCenterTag: true,

    showTotalInWords: true,
    showBankDetails: true,
    bankDetailsText: 'Banco Scotiabank Chile | Cta Corriente en Moneda Nacional N° 99-887766-0 | Envío de comprobantes: finanzas@consultora-auditores.cl',
    commercialNotes: 'Factura exenta o afecta según régimen tributario D.L. 825. Pago a 30 días contados desde la recepción legal.',
    footerDisclaimer: 'Factura Electrónica timbrada conforme a disposiciones del Servicio de Impuestos Internos de Chile.',

    paperSize: 'LETTER',
    pageOrientation: 'PORTRAIT',
    marginSize: 'normal',
  }),
};

export const COLOR_PALETTE_PRESETS = [
  { name: 'Azul Corporativo', primary: '#1e3a8a', accent: '#2563eb' },
  { name: 'Azul Marino Real', primary: '#0f172a', accent: '#3b82f6' },
  { name: 'Verde Bosque / Agro', primary: '#065f46', accent: '#059669' },
  { name: 'Pizarra Grafito', primary: '#334155', accent: '#64748b' },
  { name: 'Borgoña Tradicional', primary: '#881337', accent: '#be123c' },
  { name: 'Negro Formal SII', primary: '#000000', accent: '#4b5563' },
  { name: 'Azul Petróleo Acuícola', primary: '#0e7490', accent: '#06b6d4' },
];
