import { 
  ErpSubscriptionPlan, 
  SystemGeneralParameters, 
  AccountGroupClassification, 
  AccountCreationDefinition, 
  ClientAuxiliaryMasterRecord 
} from '../types';

export const ERP_SUBSCRIPTION_PLANS: ErpSubscriptionPlan[] = [
  {
    id: 'PLAN_STARTER',
    nombre: 'Plan Starter',
    precioMensualClp: 25000,
    limiteUsuarios: 2,
    limiteEmpresasContables: 3,
    modulosIncluidos: ['Contabilidad IFRS', 'DTE 33/34/61'],
    referenciaTexto: '$25.000 + IVA / mes',
    nivelSoporteDefecto: 'Básico',
    destacado: false,
  },
  {
    id: 'PLAN_PROFESIONAL',
    nombre: 'Plan Profesional',
    precioMensualClp: 45000,
    limiteUsuarios: 5,
    limiteEmpresasContables: 10,
    modulosIncluidos: ['Contabilidad', 'DTE', 'RRHH Básico', 'Inventario'],
    referenciaTexto: '$45.000 + IVA / mes',
    nivelSoporteDefecto: 'Avanzado',
    destacado: true,
  },
  {
    id: 'PLAN_ENTERPRISE',
    nombre: 'Plan Enterprise',
    precioMensualClp: 95000,
    limiteUsuarios: 15,
    limiteEmpresasContables: 30,
    modulosIncluidos: ['Contabilidad IFRS', 'DTE 33/34/61', 'RRHH Avanzado DT', 'Inventario WMS', 'Activo Fijo NIC 16', 'Costeo Producción NIC 2'],
    referenciaTexto: '$95.000 + IVA / mes',
    nivelSoporteDefecto: 'Dedicado 24/7',
    destacado: false,
  },
  {
    id: 'PLAN_ESTUDIO_MULTITENANT',
    nombre: 'Plan Estudio Multi-Tenant',
    precioMensualClp: 165000,
    limiteUsuarios: 50,
    limiteEmpresasContables: 100,
    modulosIncluidos: ['Full Suite ERP', 'Auditor Fiscal IA', 'APIs Bancarias Abiertas', 'Previred Integrado', 'Multisucursal'],
    referenciaTexto: '$165.000 + IVA / mes',
    nivelSoporteDefecto: 'Dedicado 24/7',
    destacado: false,
  },
];

export const DEFAULT_SYSTEM_PARAMETERS: SystemGeneralParameters = {
  tenantId: '001-A | DAIBUDA XI ENGINE',
  // Mayor General
  intervaloDiasVencimiento: 30,
  cuentaResultadosAcumulados: '3.1.02',
  cuentaGananciaPerdidaAno: '3.1.03',
  cuentaVariacionTipoCambio: '5.2.09',
  cuentaCargosBancarios: '5.2.10',
  // Cierre Art. 16 Código Tributario
  mesCierreEjercicio: 12,
  diaCierreEjercicio: 31,
  ejercicioActivo: 2026,
  bloqueoPeriodoCerrado: true,
  resolucionSiiCierreEspecial: '',
  // Clientes y Ventas
  limiteCreditoDefecto: 400000,
  envioAcumuladoLotes: false,
  textoLegalFactura: 'Factura exenta de IVA según Art. 12 Ley DL 825 / Operación sujeta a verificación de cumplimiento tributario.',
  cuentaGastosEnvio: '5.2.10',
  // Clientes y Ventas por Defecto
  cuentasPorCobrarDefecto: '1.1.03',
  cuentaVentasDefecto: '4.1.01',
  cuentaDescuentoVentasDefecto: '4.1.02',
  cuentaDescuentoProntoPagoDefecto: '5.2.01',
  despachoRequeridoDias: 1,
  // Centro de Costos por Defecto
  centroCostosRequeridosDespuesDias: 20,
  // Proveedores y Compradores
  rangoToleranciaEntregaSobreRecepcionPorc: 10,
  rangoToleranciaFacturaSobreCargaPorc: 10,
  cuentaPagableDefecto: '2.1.01',
  cuentaDescuentoComprasDefecto: '4.1.03',
  cuentaGuiaEntradaDefecto: '2.1.04',
  // Inventario
  permitirInventarioNegativo: false,
  // Productos por Defecto
  cuentaInventarioDefecto: '1.1.08',
  cuentaCostoVentaDefecto: '5.1.01',
  cuentaAjustesInventarioDefecto: '5.1.02',
  cuentaCostosEnsambleArticulosDefecto: '5.1.04',
  // Fabricación por Defecto
  ordenTrabajoRequeridaDespuesDias: 20,
};

export const DEFAULT_SYSTEM_GENERAL_PARAMETERS = DEFAULT_SYSTEM_PARAMETERS;

export const CHILEAN_REGIONS_WITH_COMMUNES: { region: string; comunas: string[] }[] = [
  {
    region: 'Región Metropolitana de Santiago',
    comunas: [
      'Santiago', 'Providencia', 'Las Condes', 'Vitacura', 'Lo Barnechea', 'Ñuñoa', 'La Reina',
      'Huechuraba', 'Quilicura', 'Pudahuel', 'Maipú', 'San Miguel', 'La Florida', 'Peñalolén',
      'Macul', 'Estación Central', 'Renca', 'Conchalí', 'Independencia', 'Recoleta', 'Cerrillos',
      'San Joaquín', 'La Cisterna', 'San Ramón', 'La Granja', 'El Bosque', 'San Bernardo', 'Puente Alto'
    ]
  },
  {
    region: 'Región de Valparaíso',
    comunas: ['Valparaíso', 'Viña del Mar', 'Concón', 'Quilpué', 'Villa Alemana', 'San Antonio', 'Quillota', 'Los Andes', 'San Felipe']
  },
  {
    region: 'Región de Los Lagos',
    comunas: ['Puerto Montt', 'Puerto Varas', 'Castro', 'Ancud', 'Osorno', 'Frutillar', 'Llanquihue', 'Calbuco', 'Quellón', 'Chaitén']
  },
  {
    region: 'Región del Biobío',
    comunas: ['Concepción', 'Talcahuano', 'San Pedro de la Paz', 'Chiguayante', 'Coronel', 'Hualpén', 'Los Ángeles', 'Tome', 'Penco']
  },
  {
    region: 'Región de Antofagasta',
    comunas: ['Antofagasta', 'Calama', 'Tocopilla', 'Mejillones', 'Taltal', 'San Pedro de Atacama']
  },
  {
    region: 'Región de Coquimbo',
    comunas: ['La Serena', 'Coquimbo', 'Ovalle', 'Illapel', 'Vicuña', 'Salamanca']
  },
  {
    region: 'Región del Maule',
    comunas: ['Talca', 'Curicó', 'Linares', 'Constitución', 'Molina', 'San Javier', 'Parral']
  },
  {
    region: 'Región de La Araucanía',
    comunas: ['Temuco', 'Padre Las Casas', 'Villarrica', 'Pucón', 'Angol', 'Victoria', 'Lautaro']
  },
  {
    region: 'Región de Los Ríos',
    comunas: ['Valdivia', 'La Unión', 'Río Bueno', 'Panguipulli', 'Paillaco']
  },
  {
    region: 'Región de Tarapacá',
    comunas: ['Iquique', 'Alto Hospicio', 'Pozo Almonte', 'Pica']
  },
  {
    region: 'Región de Atacama',
    comunas: ['Copiapó', 'Vallenar', 'Caldera', 'Chañaral']
  },
  {
    region: 'Región de O’Higgins',
    comunas: ['Rancagua', 'Machalí', 'Rengo', 'San Fernando', 'Pichilemu', 'Graneros']
  },
  {
    region: 'Región de Ñuble',
    comunas: ['Chillán', 'Chillán Viejo', 'San Carlos', 'Bulnes', 'Yungay']
  },
  {
    region: 'Región de Aysén',
    comunas: ['Coyhaique', 'Puerto Aysén', 'Chile Chico', 'Cochrane']
  },
  {
    region: 'Región de Magallanes y de la Antártica Chilena',
    comunas: ['Punta Arenas', 'Puerto Natales', 'Porvenir', 'Cabo de Hornos']
  },
  {
    region: 'Región de Arica y Parinacota',
    comunas: ['Arica', 'Camarones', 'Putre', 'General Lagos']
  }
];

export const INITIAL_ACCOUNT_GROUPS: AccountGroupClassification[] = [
  { codigo: '1', codPadre: 'Raíz del Catálogo', tipoCuenta: 'ACTIVO', descripcion: 'ACTIVO' },
  { codigo: '1.1', codPadre: '1', tipoCuenta: 'ACTIVO', descripcion: 'ACTIVO CIRCULANTE / CORRIENTE' },
  { codigo: '1.1.01', codPadre: '1.1', tipoCuenta: 'ACTIVO', descripcion: 'Disponibilidades y Efectivo Equivalente' },
  { codigo: '1.1.03', codPadre: '1.1', tipoCuenta: 'ACTIVO', descripcion: 'Deudores Comerciales y Cuentas por Cobrar' },
  { codigo: '1.1.05', codPadre: '1.1', tipoCuenta: 'ACTIVO', descripcion: 'Impuestos por Recuperar e IVA Crédito' },
  { codigo: '1.1.08', codPadre: '1.1', tipoCuenta: 'ACTIVO', descripcion: 'Existencias e Inventarios (NIC 2)' },
  { codigo: '1.2', codPadre: '1', tipoCuenta: 'ACTIVO', descripcion: 'ACTIVO NO CIRCULANTE' },
  { codigo: '1.2.01', codPadre: '1.2', tipoCuenta: 'ACTIVO', descripcion: 'Propiedades, Planta y Equipo (NIC 16)' },
  { codigo: '1.2.06', codPadre: '1.2', tipoCuenta: 'ACTIVO', descripcion: 'Instalaciones Acuícolas y Redes' },
  { codigo: '2', codPadre: 'Raíz del Catálogo', tipoCuenta: 'PASIVO', descripcion: 'PASIVO' },
  { codigo: '2.1', codPadre: '2', tipoCuenta: 'PASIVO', descripcion: 'PASIVO CIRCULANTE / CORTO PLAZO' },
  { codigo: '2.1.01', codPadre: '2.1', tipoCuenta: 'PASIVO', descripcion: 'Cuentas por Pagar Comerciales' },
  { codigo: '2.1.03', codPadre: '2.1', tipoCuenta: 'PASIVO', descripcion: 'Impuestos por Pagar y F29' },
  { codigo: '2.1.07', codPadre: '2.1', tipoCuenta: 'PASIVO', descripcion: 'Obligaciones Laborales y Previsionales' },
  { codigo: '3', codPadre: 'Raíz del Catálogo', tipoCuenta: 'PATRIMONIO', descripcion: 'PATRIMONIO NETO' },
  { codigo: '3.1', codPadre: '3', tipoCuenta: 'PATRIMONIO', descripcion: 'Capital y Reservas' },
  { codigo: '4', codPadre: 'Raíz del Catálogo', tipoCuenta: 'RESULTADO', descripcion: 'INGRESOS' },
  { codigo: '4.1', codPadre: '4', tipoCuenta: 'RESULTADO', descripcion: 'Ingresos de Actividades Ordinarias' },
  { codigo: '5', codPadre: 'Raíz del Catálogo', tipoCuenta: 'RESULTADO', descripcion: 'COSTOS Y GASTOS' },
  { codigo: '5.1', codPadre: '5', tipoCuenta: 'RESULTADO', descripcion: 'Costo de Ventas y Fabricación' },
  { codigo: '5.2', codPadre: '5', tipoCuenta: 'RESULTADO', descripcion: 'Gastos de Administración y Ventas' },
];

export const INITIAL_CLIENT_AUXILIARIES: ClientAuxiliaryMasterRecord[] = [
  {
    id: 'aux-innovagile',
    rutCompleto: '77.798.901-4',
    codigoAuxiliar: 'CLI-001',
    razonSocial: 'InnovAgile Group SpA',
    nombreFantasia: 'InnovAgile',
    giroComercial: 'CONSULTORÍA DE INFORMÁTICA Y SOFTWARE',
    inactivo: false,
    telefonoPrincipal: '+56 9 8451 9022',
    emailContacto: 'finanzas@innovagile.cl',
    nombreContacto: 'Mauricio Larraín Echenique',
    emailDte: 'dte@innovagile.cl',
    direccion: 'Av. Andrés Bello 2457, Of. 1402',
    region: 'Región Metropolitana de Santiago',
    ciudad: 'Santiago',
    comuna: 'Providencia',
    tipoAuxiliar: 'CLIENTE',
    sucursales: [
      { id: 'suc-1', nombre: 'Casa Matriz Costanera', direccion: 'Av. Andrés Bello 2457', comuna: 'Providencia' }
    ]
  },
  {
    id: 'aux-retail',
    rutCompleto: '77.210.980-5',
    codigoAuxiliar: 'CLI-002',
    razonSocial: 'RETAIL LOGISTICS CHILE S.A.',
    nombreFantasia: 'Retail Logistics',
    giroComercial: 'TRANSPORTE Y ALMACENAMIENTO DE CARGA',
    inactivo: false,
    telefonoPrincipal: '+56 9 9342 1100',
    emailContacto: 'contabilidad@retaillogistics.cl',
    nombreContacto: 'Claudia Navarrete Ruiz',
    emailDte: 'facturacion@retaillogistics.cl',
    direccion: 'Camino Lo Echevers 550, Galpón 4',
    region: 'Región Metropolitana de Santiago',
    ciudad: 'Santiago',
    comuna: 'Quilicura',
    tipoAuxiliar: 'CLIENTE',
  },
  {
    id: 'aux-minera',
    rutCompleto: '96.540.320-1',
    codigoAuxiliar: 'CLI-003',
    razonSocial: 'MINERA DEL SUR CHILE SPA',
    nombreFantasia: 'Minera del Sur',
    giroComercial: 'EXTRACCIÓN DE MINERALES Y SERVICIOS DE FAENA',
    inactivo: false,
    telefonoPrincipal: '+56 55 264 8900',
    emailContacto: 'adquisiciones@mineradelsur.cl',
    nombreContacto: 'Ing. Rodrigo Cifuentes',
    emailDte: 'dte@mineradelsur.cl',
    direccion: 'Av. Balmaceda 1020, Of. 504',
    region: 'Región de Antofagasta',
    ciudad: 'Antofagasta',
    comuna: 'Antofagasta',
    tipoAuxiliar: 'CLIENTE',
  },
  {
    id: 'aux-rend-01',
    rutCompleto: '14.238.192-8',
    codigoAuxiliar: 'EMP-001',
    razonSocial: 'Gonzalo Silva Valenzuela',
    nombreFantasia: 'Gonzalo Silva',
    giroComercial: 'Supervisor Comercial & Operaciones',
    inactivo: false,
    telefonoPrincipal: '+56 9 7844 2200',
    emailContacto: 'gonzalo.silva@maraustral.cl',
    nombreContacto: 'Gonzalo Silva Valenzuela',
    direccion: 'Costanera 890',
    region: 'Región de Los Lagos',
    ciudad: 'Quellón',
    comuna: 'Quellón',
    tipoAuxiliar: 'EMPLEADO',
  },
  {
    id: 'aux-rend-02',
    rutCompleto: '14.140.598-5',
    codigoAuxiliar: 'EMP-002',
    razonSocial: 'Mario Vargas Da Silva',
    nombreFantasia: 'Mario Vargas',
    giroComercial: 'Jefe de Proyectos & Mantención Balsas',
    inactivo: false,
    telefonoPrincipal: '+56 9 9123 4455',
    emailContacto: 'mario.vargas@maraustral.cl',
    nombreContacto: 'Mario Vargas Da Silva',
    direccion: 'Ruta 5 Sur Km 12',
    region: 'Región de Los Lagos',
    ciudad: 'Castro',
    comuna: 'Castro',
    tipoAuxiliar: 'EMPLEADO',
  },
  {
    id: 'aux-rend-03',
    rutCompleto: '15.342.119-4',
    codigoAuxiliar: 'EMP-003',
    razonSocial: 'Carla Morales Troncoso',
    nombreFantasia: 'Carla Morales',
    giroComercial: 'Jefa de Administración & Finanzas',
    inactivo: false,
    telefonoPrincipal: '+56 9 8877 6655',
    emailContacto: 'carla.morales@maraustral.cl',
    nombreContacto: 'Carla Morales Troncoso',
    direccion: 'Av. El Golf 40',
    region: 'Región Metropolitana de Santiago',
    ciudad: 'Santiago',
    comuna: 'Las Condes',
    tipoAuxiliar: 'EMPLEADO',
  },
];
