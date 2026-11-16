/**
 * Datos maestros del ERP (no transaccionales): planes, parámetros, regiones/comunas
 * y plan de cuentas base. Se cargan para todo cliente, en producción y en demostración.
 * Los datos semilla de empresas de ejemplo viven en src/data/seed* y solo se usan con DEMO_MODE.
 */
import { 
  ErpSubscriptionPlan, 
  SystemGeneralParameters,
} from '../types';

// K3: `modulos` son los módulos canónicos que el control de acceso habilita para cada plan.
// Revisar con la política comercial; los precios y límites son los que ya tenía el sistema.
export const ERP_SUBSCRIPTION_PLANS: ErpSubscriptionPlan[] = [
  {
    id: 'PLAN_STARTER',
    nombre: 'Plan Starter',
    precioMensualClp: 25000,
    limiteUsuarios: 2,
    limiteEmpresasContables: 3,
    modulosIncluidos: ['Contabilidad IFRS', 'DTE 33/34/61'],
    modulos: ['CONTABILIDAD', 'TRIBUTARIO_SII', 'CONCILIACION'],
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
    modulos: ['CONTABILIDAD', 'TRIBUTARIO_SII', 'CONCILIACION', 'RRHH', 'INVENTARIO', 'TESORERIA', 'RENDICIONES'],
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
    modulos: ['CONTABILIDAD', 'TRIBUTARIO_SII', 'CONCILIACION', 'RRHH', 'INVENTARIO', 'TESORERIA', 'RENDICIONES', 'ACTIVO_FIJO', 'COSTOS_PRODUCCION', 'FLUJO_CAJA', 'COMERCIAL_COMPRAS'],
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
    modulos: ['CONTABILIDAD', 'TRIBUTARIO_SII', 'CONCILIACION', 'RRHH', 'INVENTARIO', 'TESORERIA', 'RENDICIONES', 'ACTIVO_FIJO', 'COSTOS_PRODUCCION', 'FLUJO_CAJA', 'COMERCIAL_COMPRAS'],
    referenciaTexto: '$165.000 + IVA / mes',
    nivelSoporteDefecto: 'Dedicado 24/7',
    destacado: false,
  },
];

// K2.6: las cuentas por defecto se eligen del plan de cada empresa (vacías hasta definirlas).
export const DEFAULT_SYSTEM_PARAMETERS: SystemGeneralParameters = {
  tenantId: '001-A | DAIBUDA XI ENGINE',
  // Mayor General
  intervaloDiasVencimiento: 30,
  cuentaResultadosAcumulados: '',
  cuentaGananciaPerdidaAno: '',
  cuentaVariacionTipoCambio: '',
  cuentaCargosBancarios: '',
  // Cierre Art. 16 Código Tributario
  mesCierreEjercicio: 12,
  diaCierreEjercicio: 31,
  ejercicioActivo: 2026,
  bloqueoPeriodoCerrado: true,
  resolucionSiiCierreEspecial: '',
  // Clientes y Ventas
  limiteCreditoDefecto: 0,
  envioAcumuladoLotes: false,
  textoLegalFactura: '',
  cuentaGastosEnvio: '',
  // Clientes y Ventas por Defecto
  cuentasPorCobrarDefecto: '',
  cuentaVentasDefecto: '',
  cuentaDescuentoVentasDefecto: '',
  cuentaDescuentoProntoPagoDefecto: '',
  despachoRequeridoDias: 1,
  // Centro de Costos por Defecto
  centroCostosRequeridosDespuesDias: 20,
  // Proveedores y Compradores
  rangoToleranciaEntregaSobreRecepcionPorc: 10,
  rangoToleranciaFacturaSobreCargaPorc: 10,
  cuentaPagableDefecto: '',
  cuentaDescuentoComprasDefecto: '',
  cuentaGuiaEntradaDefecto: '',
  // Inventario
  permitirInventarioNegativo: false,
  // Productos por Defecto
  cuentaInventarioDefecto: '',
  cuentaCostoVentaDefecto: '',
  cuentaAjustesInventarioDefecto: '',
  cuentaCostosEnsambleArticulosDefecto: '',
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
