export type DteType = 
  | '33' // Factura Electrónica
  | '34' // Factura No Afecta o Exenta Electrónica
  | '61' // Nota de Crédito Electrónica
  | '56' // Nota de Débito Electrónica
  | '46' // Factura de Compra Electrónica
  | '110' // Factura de Exportación Electrónica
  | '39' // Boleta Electrónica
  | '41' // Boleta Exenta Electrónica
  | '52' // Guía de Despacho Electrónica
  | 'BH' // Boleta de Honorarios Electrónica
  | 'BHE'; // Boleta de Honorarios Recibida

export interface CompanyProfile {
  rut: string;
  razonSocial: string;
  giro: string;
  direccion: string;
  comuna: string;
  ciudad: string;
  regimenTributario: '14D3_PROPYME_GENERAL' | '14D8_PROPYME_TRANSPARENTE' | '14A_SEMI_INTEGRADO';
  tasaPpm: number; // ej: 0.25%, 0.50%, 1.0%, etc.
  tasaPpmVoluntaria?: number; // Tasa voluntaria adicional para resguardo de renta anual
  remanenteCreditoFiscalUtm?: number; // Saldo de remanente IVA de meses anteriores en UTM
  remanenteCreditoFiscalClp?: number; // Saldo de remanente IVA de meses anteriores en CLP
  actividadEconomicaCodigo?: string; // Código de actividad económica SII (ej: 620100)
  actividadEconomicaNombre?: string;
  exentoIvaGiro?: boolean; // Si el giro genera operaciones exentas o no gravadas
  capitalPropioTributarioSimplificado?: number; // Base para Patente Municipal (DL 3.063 Art. 24)
  patenteMunicipalTasaPorMil?: number; // Tasa por mil municipal (2.5 a 5 por mil)
  baseRliProyectada?: number; // Base Renta Líquida Imponible para F22
  afpMutualTasa: number; // ej: 0.93% base + adicional
  bancoPrincipal: string;
  numeroCuenta: string;
  // Parámetros de Ejercicio Fiscal y Cierre Contable (Art. 16 Código Tributario)
  mesCierreEjercicio?: number; // 12 = Diciembre (regla general SII), 6 = Junio (temporadas/agro/filiales extranjeras), etc.
  diaCierreEjercicio?: number; // 31, 30, etc.
  ejercicioActivo?: number; // ej: 2026
  fechaInicioEjercicio?: string; // ej: "2026-01-01"
  fechaFinEjercicio?: string; // ej: "2026-12-31"
  periodosCerrados?: string[]; // ej: ["2026-01", "2026-02"]
  bloqueoPeriodoCerrado?: boolean; // Si true, prohíbe asientos en períodos cerrados o fuera de fecha
  resolucionSiiCierreEspecial?: string; // Resolución exenta del Director Regional SII en caso de cierre distinto al 31/12
  // Ejercicios Históricos Cerrados y Auditoría de Reaperturas Extraordinarias (NIC 8 / Art. 16 Cód. Tributario)
  ejerciciosCerrados?: number[];
  auditoriaReaperturas?: Array<{
    id: string;
    fecha: string;
    ejercicio: number;
    usuario: string;
    motivoLegal: string;
    resolucionSii?: string;
    timestamp: string;
  }>;
  reaperturaExtraordinariaActiva?: {
    ejercicio: number;
    fechaReapertura: string;
    motivoLegal: string;
    usuario: string;
    resolucionSii?: string;
  };
}

export interface PeriodLockValidationResult {
  permitido: boolean;
  motivo?: string;
  codigoError?: 'PERIODO_CERRADO' | 'EJERCICIO_ANTERIOR' | 'EJERCICIO_FUTURO' | 'FUERA_DE_RANGO';
  sugerencia?: string;
}

export interface CatchUpPeriodConfig {
  periodo: string; // "2026-01"
  fechaDevengoRemuneraciones: string; // "2026-01-31"
  fechaPagoSueldos: string; // "2026-02-05"
  fechaPagoPrevired: string; // "2026-02-13"
  fechaDevengoF29: string; // "2026-01-31"
  fechaPagoF29: string; // "2026-02-20"
}

// Configuración del Estudio Contable (Cliente Principal que opera la App)
export interface AccountingFirmProfile {
  id: string;
  razonSocial: string; // ej: "Siex Consultores SpA"
  nombreFantasia: string; // ej: "Siex Consultores"
  rut: string; // ej: "76.543.210-9"
  representanteLegal: string; // ej: "Gonzalo Valenzuela Pérez"
  rutRepresentante: string; // ej: "14.238.901-2"
  claveSiiRepresentante?: string; // Clave Tributaria o credencial del representante
  emailContacto: string;
  telefono: string;
  direccion: string;
  comuna: string;
  ciudad: string;
  metodoAccesoSii: 'MANDATO_REPRESENTANTE' | 'CERTIFICADO_CENTRAL' | 'CLAVE_DIRECTA_CLIENTE';
  politicaAuditoria: string; // Directrices del estudio para el comportamiento de los agentes IA
  agentesHabilitados: {
    auditorFiscal: boolean;
    descargaAutomaticaSii: boolean;
    liquidacionPrevisional: boolean;
    proyeccionFlujo: boolean;
    gestionInventarios: boolean;
    activoFijo?: boolean;
    costeoProduccion?: boolean;
  };
}

// Configuración de cada Cliente (Empresa cuya contabilidad es administrada por el Estudio)
export interface ClientCompany extends CompanyProfile {
  id: string;
  nombreCorto: string; // ej: "InnovAgile Group"
  contactoNombre: string;
  contactoEmail: string;
  contactoTelefono: string;
  // Credenciales SII para que el agente ingrese y descargue información
  claveSii: string; // Clave Tributaria del SII para descarga desatendida del RCV y BHE
  rutAutenticacion: string; // RUT de acceso (empresa o representante)
  tipoAutenticacionSii: 'CLAVE_TRIBUTARIA' | 'CERTIFICADO_DIGITAL' | 'MANDATO_ESTUDIO';
  certificadoDigitalNombre?: string;
  estadoConexionSii: 'CONECTADO' | 'PENDIENTE_VERIFICACION' | 'ERROR_CREDENCIALES' | 'CERTIFICADO_POR_VENCER';
  ultimaSincronizacionSii?: string;
  ultimoMensajeSii?: string;
  // Reglas y automatizaciones del agente para este cliente
  automatizacionesAgente: {
    descargaAutomaticaRcv: boolean; // Compras y ventas
    descargaAutomaticaBhe: boolean; // Boletas de honorarios recibidas y emitidas
    alertaPlazo8DiasReclamo: boolean; // Alerta de facturas de compras dentro del plazo de 8 días (Ley 19.983)
    simulacionF29Automatica: boolean;
    frecuenciaDescarga: 'DIARIA' | 'SEMANAL' | 'MANUAL' | 'CADA_6_HORAS';
  };
  contextoEspecialAgente: string; // Instrucciones tributarias y operacionales particulares del cliente
  activa: boolean;
  // Cuentas bancarias configuradas y APIs del cliente
  bancosDisponibles?: BankAccountConfig[];
  // Módulo de Inventario y Control de Bodegas
  manejaInventario: boolean; // Si la empresa opera bodegas, existencias y DTE 52
  reglaValoracionInventario?: 'PMP' | 'FIFO'; // PMP (Precio Medio Ponderado - Estándar SII Art. 30 LIR) o FIFO
  alertasInventarioAgente?: {
    autoReposicion: boolean;
    alertaStockCritico: boolean;
    controlGuiasDespacho52: boolean;
  };
  // Módulos especializados de Activo Fijo y Costeo de Producción
  administraActivoFijo?: boolean;
  operaCosteoProduccion?: boolean;
  // Ficha de Onboarding & Datos Superadministración ERP Daibuda
  codigoAuxiliar?: string;
  nombreFantasia?: string;
  emailDte?: string;
  notasInternas?: string;
  inactivo?: boolean;
  contrato?: ClientContractInfo;
  contabilidadConfig?: ClientAccountingConfig;
  comercialConfig?: ClientCommercialConfig;
  ubicacionConfig?: ClientLocationInfo;
  // Bóveda criptográfica DTE (Certificados y CAFs por cliente)
  bovedaDteConfig?: {
    modoFirma: 'CERTIFICADO_PROPIO' | 'MANDATO_ESTUDIO';
    certificadoNombre?: string;
    mandatarioRut?: string;
    mandatarioNombre?: string;
    cafsDisponibles?: number[];
  };
  // Capa de Seguridad & Estado Comercial de la Empresa en el ERP
  estadoCuentaEmpresa?: 'ACTIVA' | 'SUSPENDIDA_PAGO' | 'BAJA';
  empresasAnclasIds?: string[]; // Empresas vinculadas / grupo empresarial administradas por el mismo Admin
  esEmpresaDuenaErp?: boolean; // Si es la empresa propietaria del ERP (SuperAdmin)
}

export interface TenantCafItem {
  tipoDte: number;
  nombreTipo: string;
  exists: boolean;
  filePath?: string;
  rangoDesde?: number;
  rangoHasta?: number;
  fechaAutorizacion?: string;
  foliosDisponibles?: number;
  folioActualSugerido?: number;
}

export interface TaxCryptographicVaultStatus {
  rut: string;
  cleanRut: string;
  razonSocial?: string;
  modoFirma: 'CERTIFICADO_PROPIO' | 'MANDATO_ESTUDIO' | 'DEMO_SIMULADO';
  hasOwnCert: boolean;
  certNombre?: string;
  certPath?: string;
  certVencimiento?: string;
  hasPassword?: boolean;
  passwordStorageType?: 'VAULT_DATABASE_AES256' | 'SECURE_FILE_VAULT' | 'ENV_FALLBACK' | 'NOT_SET';
  passwordMasked?: string;
  mandatarioRut?: string;
  mandatarioNombre?: string;
  cafs: TenantCafItem[];
}

export type BankName = 
  | 'BANCO_SANTANDER'
  | 'BANCO_DE_CHILE'
  | 'BCI'
  | 'BANCO_ESTADO'
  | 'SCOTIABANK'
  | 'ITAU'
  | 'SECURITY'
  | 'BICE'
  | 'BANCO_FALABELLA'
  | 'BANCO_RIPLEY'
  | 'BANCO_CONSORCIO'
  | 'BANCO_INTERNACIONAL'
  | 'HSBC'
  | 'BTG_PACTUAL'
  | 'OTRO';

export interface ChileBankInfo {
  codigo: BankName;
  nombre: string;
  codigoSbif: string;
}

export const CHILE_BANKS_CATALOG: ChileBankInfo[] = [
  { codigo: 'BANCO_ESTADO', nombre: 'Banco del Estado de Chile (BancoEstado)', codigoSbif: '012' },
  { codigo: 'BANCO_DE_CHILE', nombre: 'Banco de Chile / Edwards', codigoSbif: '001' },
  { codigo: 'BANCO_SANTANDER', nombre: 'Banco Santander Chile', codigoSbif: '037' },
  { codigo: 'BCI', nombre: 'Banco de Crédito e Inversiones (BCI)', codigoSbif: '016' },
  { codigo: 'SCOTIABANK', nombre: 'Scotiabank Chile', codigoSbif: '014' },
  { codigo: 'ITAU', nombre: 'Banco Itaú Chile', codigoSbif: '039' },
  { codigo: 'SECURITY', nombre: 'Banco Security', codigoSbif: '049' },
  { codigo: 'BICE', nombre: 'Banco BICE', codigoSbif: '028' },
  { codigo: 'BANCO_CONSORCIO', nombre: 'Banco Consorcio', codigoSbif: '055' },
  { codigo: 'BANCO_FALABELLA', nombre: 'Banco Falabella', codigoSbif: '051' },
  { codigo: 'BANCO_RIPLEY', nombre: 'Banco Ripley', codigoSbif: '053' },
  { codigo: 'BANCO_INTERNACIONAL', nombre: 'Banco Internacional', codigoSbif: '009' },
  { codigo: 'HSBC', nombre: 'HSBC Bank Chile', codigoSbif: '031' },
  { codigo: 'BTG_PACTUAL', nombre: 'Banco BTG Pactual Chile', codigoSbif: '059' },
  { codigo: 'OTRO', nombre: 'Otro Banco / Entidad Financiera Internacional', codigoSbif: '999' },
];

export type BankAccountType = 'CORRIENTE' | 'VISTA' | 'DOLARES' | 'AHORRO';

export type BankConnectionStatus = 'CONECTADO' | 'DESCONECTADO' | 'ERROR_AUTENTICACION' | 'SIN_CONFIGURAR';

export interface BankAccountConfig {
  id: string;
  banco: string; // ej: "Banco Santander Chile"
  bancoCodigo: BankName;
  tipoCuenta: BankAccountType;
  numeroCuenta: string;
  moneda: 'CLP' | 'USD' | 'EUR';
  saldoEnLinea: number;
  estadoConexion: BankConnectionStatus;
  tipoConexion: 'OPEN_BANKING_API' | 'EMPRESAS_CONNECT' | 'SCRAPING_ROBOT' | 'IMPORTACION_CARTOLA';
  apiKey?: string;
  apiSecret?: string;
  rutApoderado?: string;
  ultimaSincronizacion?: string;
  esPrincipal: boolean;
  cuentaContableIfrs?: string;
}

export type BankMovementStatus = 'CONCILIADO' | 'PENDIENTE' | 'NOVEDAD';

export type BankNovedadType = 
  | 'COMISION_MANTENCION'
  | 'COMISION_TRANSFERENCIAS'
  | 'GASTO_BANCARIO'
  | 'IMPUESTO_TIMBRES'
  | 'ABONO_NO_IDENTIFICADO'
  | 'CARGO_PAC_NO_REGISTRADO'
  | 'INTERES_A_FAVOR'
  | 'DIFERENCIA_MONTO'
  | 'OTRO';

export interface BankStatementMovement {
  id: string;
  cuentaId: string;
  fecha: string; // YYYY-MM-DD
  glosaBancaria: string;
  numeroReferencia: string;
  cargo: number; // Débito (> 0 si es cargo)
  abono: number; // Crédito (> 0 si es abono)
  saldo: number; // Saldo posterior en cuenta
  montoNeto: number; // Positivo si abono, negativo si cargo
  estado: BankMovementStatus;
  moneda?: 'CLP' | 'USD' | 'EUR';
  tipoCambio?: number; // TCO del día oficial Banco Central
  montoCLPEquivalente?: number; // Monto convertido a CLP según TCO
  
  // Datos de conciliación y Documento de Referencia de Conciliación
  movimientoIdConciliado?: string; // ID de CashFlowMovement o AccountingEntry
  dteFolioAsociado?: number;
  matchSugeridoId?: string;
  matchSugeridoGlosa?: string;
  matchCerteza?: number; // 0 a 100%
  codigoConciliacion?: string; // Documento de Referencia de Conciliación formal: ej. CONC-SAN-202609-0012
  fechaConciliacion?: string; // Timestamp ISO de la conciliación
  matchCriterio?: string; // Detalle de la desambiguación o scoring aplicado (ej: "Monto + N° TEF + RUT")
  usuarioConciliador?: string; // Operador o 'Agente Autónomo de Conciliación'
  partidaContableDetalle?: {
    entryId: string;
    fecha: string;
    concepto: string;
    documento: string;
    rutAuxiliar?: string;
    monto: number;
  };
  esAmbiguo?: boolean; // True si hay múltiples partidas candidatas con idéntico monto
  candidatosMatchesCount?: number; // Cantidad de partidas encontradas con el mismo monto
  documentoRef?: string;
  
  // Datos de Novedad Bancaria (partidas no registradas previamente en contabilidad)
  tipoNovedad?: BankNovedadType;
  novedadRegistrada?: boolean;
  asientoGeneradoId?: string;
  cuentaContableSugerida?: {
    debeCodigo: string;
    debeNombre: string;
    haberCodigo: string;
    haberNombre: string;
    glosa: string;
  };
}

export interface BankReconciliationSummary {
  periodo: string; // "2026-09"
  bancoNombre: string;
  numeroCuenta: string;
  saldoSegunCartola: number;
  saldoSegunLibroBanco: number;
  depositosEnTransito: number;
  chequesTransferenciasEnTransito: number;
  novedadesCargosPendientes: number;
  novedadesAbonosPendientes: number;
  saldoConciliado: number;
  diferencia: number;
  cuadrado: boolean;
  fechaConciliacion: string;
  totalMovimientosCartola: number;
  totalConciliados: number;
  totalPendientes: number;
  totalNovedades: number;
  novedadesResueltas: number;
  saldoBancoAjustado?: number;
  saldoLibroMayorAjustado?: number;
  diferenciaAuditoria?: number;
  netoNovedadesPendientes?: number;
}

export interface DteSplitItem {
  id: string;
  cuentaCodigo: string;
  cuentaNombre: string;
  concepto: string;
  montoNeto: number;
  montoExento?: number;
  porcentaje?: number;
  // Relación con Centro de Costos
  centroCostoId?: string;
  centroCostoCodigo?: string;
  centroCostoNombre?: string;
}

export interface DteItemDetail {
  id: string;
  codigo?: string;
  nombre: string;
  descripcion?: string;
  cantidad: number;
  unidadMedida?: string;
  precioUnitario: number;
  descuentoPct?: number;
  esExento?: boolean;
  montoTotal: number;
  // Relación con Centro de Costos
  centroCostoId?: string;
  centroCostoCodigo?: string;
  centroCostoNombre?: string;
  cuentaCodigo?: string;
  cuentaNombre?: string;
}

export interface SupplierAccountRule {
  id: string;
  rutContraparte: string;
  razonSocial: string;
  cuentaCodigo: string;
  cuentaNombre: string;
  conceptoDefecto: string;
  vecesUsado: number;
  ultimaFecha: string;
  esFrecuente: boolean;
}

export interface SiiCentralizationConfig {
  cuentaComprasPasivo: { codigo: string; nombre: string }; // Ej: 2.1.01 Proveedores Nacionales
  cuentaVentasActivo: { codigo: string; nombre: string }; // Ej: 1.1.03 Clientes Nacionales
  cuentaIvaCredito: { codigo: string; nombre: string }; // 1.1.08 IVA Crédito Fiscal
  cuentaIvaDebito: { codigo: string; nombre: string }; // 2.1.04 IVA Débito Fiscal
  cuentaVentasIngreso: { codigo: string; nombre: string }; // 4.1.01 Ventas del Giro (Afectas)
  cuentaVentasExentasIngreso?: { codigo: string; nombre: string }; // 4.1.02 Ventas / Servicios Exentos
  cuentaComprasExentasGasto?: { codigo: string; nombre: string }; // 5.1.98 Gastos y Adquisiciones Exentas
  cuentaHonorariosGasto: { codigo: string; nombre: string }; // 5.1.20 Honorarios Profesionales
  cuentaRetencionHonorarios: { codigo: string; nombre: string }; // 2.1.06 Retención Honorarios
  cuentaBancoPago: { codigo: string; nombre: string }; // 1.1.01 Banco Santander
  cuentaBancoCobro: { codigo: string; nombre: string }; // 1.1.01 Banco Santander
}

export interface SiiPendingPeriodDiagnostic {
  periodo: string; // "2026-06"
  anio: number;
  mes: number;
  nombreMes: string;
  comprasSincronizadas: boolean;
  ventasSincronizadas: boolean;
  honorariosSincronizados: boolean;
  totalDocumentosRegistrados: number;
  estado: 'ACTUALIZADO' | 'PENDIENTE_SINCRONIZAR' | 'DESACTUALIZADO' | 'PARCIAL';
  documentosPendientesContabilizar: number;
  ultimaActualizacion?: string;
}

export interface DteDocument {
  id: string;
  tipoDte: DteType;
  folio: number;
  tipoOperacion: 'VENTA' | 'COMPRA' | 'HONORARIOS';
  rutContraparte: string;
  razonSocialContraparte: string;
  fechaEmision: string;
  fechaRecepcion?: string;
  fechaVencimiento?: string;
  montoExento: number;
  montoNeto: number;
  montoIva: number;
  montoTotal: number;
  retencionTasa?: number; // Para Boletas de Honorarios (ej: 14.5%)
  retencionMonto?: number;
  estadoSii: 'ACEPTADO' | 'ACEPTADO_CON_REPAROS' | 'RECLAMADO' | 'PENDIENTE';
  estadoPago: 'PENDIENTE' | 'PAGADO' | 'COBRADO' | 'ABONADO' | 'VENCIDO';
  cuentaContableDebe?: string;
  cuentaContableHaber?: string;
  glosa: string;
  // Centro de Costo a nivel documento
  centroCostoId?: string;
  centroCostoCodigo?: string;
  centroCostoNombre?: string;
  // Items de la factura electrónica (vinculados a Centro de Costo)
  items?: DteItemDetail[];
  // Campos del motor de imputación y centralización
  partidasDesglosadas?: DteSplitItem[];
  imputacionEstado?: 'PENDIENTE' | 'IMPUTADO' | 'CENTRALIZADO';
  asientoCentralizacionId?: string;
  cuentaContraparteParametrizada?: string;
  proveedorHistoricoDetectado?: boolean;
  reglaSugeridaOrigen?: 'HISTORIAL_PROVEEDOR' | 'INTELIGENCIA_ARTIFICIAL' | 'MANUAL';
  cuentaCodigoAsignada?: string;
  cuentaNombreAsignada?: string;
  // HTTP-DTE / LibreDTE & SII Fields
  trackId?: string;
  tedXml?: string;
  xmlTimbrado?: string;
  pdfUrl?: string;
  ambienteSii?: number; // 1: Certificación, 2: Producción
}

export interface F29Declaration {
  id: string;
  periodo: string; // YYYY-MM
  // Débitos (Ventas)
  ventasAfectasNeto: number;
  debitoFiscalIva: number;
  ventasExentasTotal: number;
  notasCreditoDebitoVentas: number;
  // Créditos (Compras)
  comprasNetoAfecto: number;
  creditoFiscalIva: number;
  comprasActivoFijoIva: number;
  remanenteMesAnterior: number;
  // Liquidación IVA
  impuestoDeterminadoIva: number; // Si débito > crédito
  nuevoRemanenteCredito: number; // Si crédito > débito
  // PPM
  baseImponiblePpm: number;
  tasaPpm: number;
  montoPpm: number;
  // Retenciones
  retencionHonorariosSegundaCat: number;
  retencionImpuestoUnicoSueldos: number;
  otrasRetenciones: number;
  // Total a Enterar en Arcas Fiscales
  totalAPagar: number;
  estado: 'BORRADOR' | 'DECLARADO' | 'PAGADO';
  fechaVencimiento: string;
  fechaPago?: string;
  folioTgr?: string;
  inconsistenciasDetectadas?: string[];
}

// =======================================================
// AGENTE FISCAL Y TRIBUTARIO SENIOR (F29, SII, TGR & RENTAS)
// =======================================================

export interface F29SeniorMapeo {
  c538_total_debito: number;
  c537_total_credito: number;
  c077_saldo_a_favor_o_remanente: number;
  c089_impuesto_determinado_iva: number;
  c151_retencion_honorarios: number;
  c048_impuesto_unico_segunda_cat: number;
  c030_monto_base_ppm: number;
  c062_ppm_determinado: number;
  c091_total_a_pagar_f29: number;
}

export interface F29AlertaFiscal {
  tipo: 'ADVERTENCIA' | 'ERROR' | 'OPORTUNIDAD';
  descripcion: string;
  codigoRelacionado?: string;
  accionSugerida?: string;
}

export interface F29AsientoItem {
  cuenta: string;
  debe: number;
  haber: number;
}

export interface F29SeniorResult {
  empresa_id: string;
  periodo_tributario: string; // YYYY-MM
  estado_liquidacion: 'SIMULACION' | 'PRE_DECLARACION' | 'DEFINITIVA';
  f29_mapeo: F29SeniorMapeo;
  alertas_fiscales: F29AlertaFiscal[];
  asiento_contable_f29: F29AsientoItem[];
  // Capa asesora human-readable generada por el Agente
  capa_asesora?: {
    resumenEjecutivo: string;
    analisisDebitoCredito: string;
    observacionesCriticas: string[];
    recomendacionesEstrategicas: string[];
    normativaCitada: string[];
  };
  // Desgloses de soporte técnico tributario
  detalle_debito?: {
    ventasFacturasAfectasNeto: number;
    debitoFacturasIva: number;
    ventasBoletasAfectasIva: number;
    notasCreditoDeduccionDebito: number;
    ventasExentasInformadas: number;
    totalDebitoCalculado: number;
  };
  detalle_credito?: {
    comprasInternasAfectasNeto: number;
    creditoFiscalNormal: number;
    comprasActivoFijoIva: number;
    comprasSinDerechoCredito: number;
    factorProporcionalidadIva: number;
    remanenteMesAnteriorUtm: number;
    utmValorMesAnterior: number;
    utmValorMesActual: number;
    remanenteReajustadoClp: number;
    totalCreditoConRemanente: number;
  };
  detalle_retenciones?: {
    honorariosBrutoTotal: number;
    honorariosTasaAplicada: number;
    retencionHonorariosSegundaCat: number;
    impuestoUnicoTrabajadoresSueldos: number;
    cambioSujetoIva: number;
    retencionesNoResidentes: number;
  };
  detalle_ppm?: {
    baseImponibleVentasNetas: number;
    regimenTributario: string;
    tasaPpmObligatoria: number;
    tasaPpmVoluntaria: number;
    tasaTotalAplicada: number;
    ppmDeterminado: number;
  };
  postergacion_iva?: {
    aplicaArticulo64: boolean;
    montoIvaPostergable: number;
    totalConPostergacion: number;
    plazoDias: number; // 60 días
    fechaVencimientoPostergada: string;
    evaluacionImpactoFlujo: string;
    recomendacion: 'POSTERGAR' | 'PAGAR_CONTADO';
  };
  patente_municipal_y_renta?: {
    cptSimplificadoBase: number;
    patenteTasaPorMil: number;
    patenteSemestralEstimada: number;
    rliProyectada: number;
    tasaIdpc: number;
    idpcEstimado: number;
    comunaCasaMatriz: string;
  };
}

export interface EmployeePayroll {
  id: string;
  rut: string;
  nombreCompleto: string;
  cargo: string;
  departamento: string;
  fechaIngreso: string;
  tipoContrato: 'INDEFINIDO' | 'PLAZO_FIJO';
  diasTrabajados: number; // ej: 30
  // Haberes Imponibles
  sueldoBase: number;
  gratificacionModalidad: 'ART_50' | 'ART_47' | 'PACTADA';
  gratificacionMonto: number;
  horasExtrasCantidad: number;
  horasExtrasMonto: number;
  comisionesBonosImponibles: number;
  totalHaberesImponibles: number;
  // Haberes No Imponibles
  asignacionColacion: number;
  asignacionMovilizacion: number;
  viaticosAsignacionFamiliar: number;
  totalHaberesNoImponibles: number;
  totalHaberesBrutos: number;
  // Descuentos Legales Trabajador
  afpNombre: 'CAPITAL' | 'CUPRUM' | 'HABITAT' | 'PLANVITAL' | 'PROVIDA' | 'MODELO' | 'UNO';
  afpTasa: number;
  afpMonto: number;
  saludTipo: 'FONASA' | 'ISAPRE';
  saludPlanUf?: number;
  saludMonto: number;
  afcTrabajadorMonto: number;
  impuestoUnicoMonto: number;
  otrosDescuentos: number;
  totalDescuentos: number;
  // Sueldo Líquido a Pagar
  sueldoLiquido: number;
  // Costos Empleador (Aporte Patronal)
  sisEmpleadorMonto: number;
  mutualEmpleadorMonto: number;
  afcEmpleadorMonto: number;
  costoTotalEmpresa: number;
}

export interface LeaseContract {
  id: string;
  codigoContrato?: string;
  nombreBien?: string; // ej: "Oficina Central Las Condes", "Galpón Industrial Quilicura"
  inmuebleDescripcion?: string;
  arrendadorNombre: string;
  arrendadorRut: string;
  tipoArriendo?: 'COMERCIAL' | 'HABITACIONAL' | 'MAQUINARIA';
  tipoArrendador?: 'PERSONA_JURIDICA' | 'PERSONA_NATURAL_CON_GIRO' | 'PERSONA_NATURAL_SIN_GIRO';
  moneda?: 'CLP' | 'UF';
  montoCanonMensual?: number; // en moneda origen
  montoMensualMoneda?: 'CLP' | 'UF';
  montoMensualValor?: number;
  montoMensualClp?: number;
  reajusteTipo?: 'UF' | 'IPC_SEMESTRAL' | 'IPC_ANUAL' | 'FIJO' | 'IPC' | 'NINGUNO';
  fechaInicio: string;
  fechaTermino: string;
  plazoMesesTotales?: number;
  plazoMeses?: number;
  mesesTranscurridos?: number;
  // Tratamiento Contable
  tratamientoContable?: 'GASTO_SIMPLE' | 'IFRS_16';
  esIfrs16?: boolean;
  tasaDescuentoAnualPct?: number; // ej: 5.5% para valor presente IFRS 16
  tasaDescuentoAnual?: number;
  activoDerechoUsoInicial?: number; // ROU Asset ($ CLP)
  activoDerechoUso?: number;
  pasivoArrendamientoActual?: number; // ($ CLP)
  pasivoArrendamiento?: number;
  amortizacionMensual?: number;
  gastoFinancieroMensual?: number;
  interesMensual?: number;
  retencionAplica?: boolean;
  retencionTasaPct?: number;
  afectoIva?: boolean;
  glosa?: string;
  estado?: 'ACTIVO' | 'VENCIDO' | 'EN_RENOVACION';
}

export type CashFlowCategory = 
  | 'VENTAS_OPERACIONALES' 
  | 'PROVEEDORES' 
  | 'REMUNERACIONES' 
  | 'PREVIRED_LEYES_SOCIALES'
  | 'IMPUESTOS_F29' 
  | 'PRODUCCION_HITO_VENTA'
  | 'PRODUCCION_INSUMOS_COMPRA'
  | 'ARRIENDOS' 
  | 'SERVICIOS_BASICOS' 
  | 'FINANCIAMIENTO' 
  | 'HONORARIOS' 
  | 'CHEQUE_CARTERA_COBRO'
  | 'CHEQUE_EMITIDO_PAGO'
  | 'DEUDA_FINANCIERA_CUOTA'
  | 'PROVISION_EGRESO'
  | 'OTRO';

export type CashFlowOriginModule = 
  | 'MANUAL' 
  | 'DTE_SII' 
  | 'NOMINA' 
  | 'PREVIRED' 
  | 'F29' 
  | 'PRESUPUESTO_PRODUCCION' 
  | 'ORDEN_PRODUCCION' 
  | 'LEASING_IFRS16' 
  | 'CONCILIACION_BANCARIA'
  | 'CHEQUES_CARTERA'
  | 'CHEQUES_EMITIDOS'
  | 'DEUDA_FINANCIERA'
  | 'PROVISIONES';

// Cheques en Cartera por Cobrar (Custodia de cheques a fecha de clientes)
export interface ChequeCartera {
  id: string;
  empresaId: string;
  numeroCheque: string;
  bancoEmisor: string; // ej: "Banco de Chile", "Santander", "BCI", "Banco Estado", "Scotiabank"
  giradorNombre: string; // Cliente
  giradorRut: string;
  fechaRecepcion: string;
  fechaCobro: string; // Fecha en que vence / se deposita en el banco
  monto: number;
  moneda: 'CLP' | 'USD';
  estado: 'EN_CARTERA' | 'DEPOSITADO' | 'COBRADO' | 'PROTESTADO';
  ordenCompraReferencia?: string;
  dteFolioAsociado?: number;
  observaciones?: string;
}

// Cheques Emitidos por Pagar (Cheques a fecha girados a proveedores pendientes de cobro)
export interface ChequeEmitido {
  id: string;
  empresaId: string;
  numeroCheque: string;
  cuentaBancariaId: string; // Cuenta corriente de origen
  bancoNombre: string;
  beneficiarioNombre: string; // Proveedor o acreedor
  beneficiarioRut: string;
  fechaEmision: string;
  fechaPago: string; // Fecha estimada o fijada para que el beneficiario cobre el cheque
  monto: number;
  moneda: 'CLP';
  estado: 'GIRADO_PENDIENTE' | 'COBRADO' | 'CADUCADO' | 'ANULADO';
  facturaReferencia?: string;
  observaciones?: string;
}

// Deudas con Instituciones Financieras (Créditos Comerciales, Leasing, Pagarés, Cuotas)
export type TipoDeudaFinanciera = 'CREDITO_COMERCIAL' | 'LEASING_FINANCIERO' | 'LINEA_CREDITO' | 'PAGARE' | 'CREDITO_FOGAPE';

export interface CuotaDeudaFinanciera {
  numeroCuota: number;
  fechaVencimiento: string;
  montoCapital: number;
  montoInteres: number;
  montoCuota: number;
  estado: 'PENDIENTE' | 'PAGADO' | 'EN_MORA';
}

export interface DeudaFinanciera {
  id: string;
  empresaId: string;
  institucionFinanciera: string; // ej: "Banco Santander", "Banco de Chile", "BCI", "Banco Estado"
  tipoCredito: TipoDeudaFinanciera;
  numeroOperacion: string; // ej: "CRE-2024-819"
  montoOriginal: number;
  tasaInteresMensualPct: number;
  plazoMesesTotal: number;
  fechaOtorgamiento: string;
  fechaPrimerVencimiento: string;
  montoCuotaMensual: number;
  cuotas: CuotaDeudaFinanciera[];
  estado: 'VIGENTE' | 'EXTINGUIDO' | 'EN_RENEGOCIACION';
  glosa?: string;
}

// Provisiones de Egresos (Gratificaciones, Indemnizaciones IAS, Auditorías, Mantenciones, Servicios)
export type NaturalezaProvisionEgreso = 'CONTABLE' | 'EXTRACONTABLE';

export type AfectacionIvaProvision = 
  | 'AFECTO_IVA_19' 
  | 'EXENTO' 
  | 'HONORARIOS_RETENCION' 
  | 'NO_APLICA';

export type PeriodicidadProvision = 
  | 'NO_PERIODICA_PUNTUAL' 
  | 'MENSUAL' 
  | 'TRIMESTRAL' 
  | 'SEMESTRAL' 
  | 'ANUAL';

export type TipoProvisionEgreso = 
  | 'GRATIFICACIONES' 
  | 'INDEMNIZACION_IAS' 
  | 'HONORARIOS_AUDITORIA' 
  | 'MANTENCION_MAYOR' 
  | 'SERVICIOS_DEVENGADOS' 
  | 'LICENCIAS_SOFTWARE'
  | 'ASESORIA_LEGAL_TRIBUTARIA'
  | 'SEGUROS_GENERALES'
  | 'EVENTOS_CORPORATIVOS'
  | 'OTRO';

export interface ProvisionEgreso {
  id: string;
  empresaId: string;
  tipoProvision: TipoProvisionEgreso;
  concepto: string; // ej: "Provisión Honorarios Auditoría Externa y Dictamen Tributario"
  fechaEstimadaPago: string; // Fecha estimada de materialización del egreso en banco

  // Parámetros Contables y Tributarios (Doctrina NIC 37 y Flujo de Caja Financiero)
  naturaleza: NaturalezaProvisionEgreso; // 'CONTABLE' (con devengo en pasivo) vs 'EXTRACONTABLE' (presupuestaria de flujo de caja)
  afectacionIva: AfectacionIvaProvision; // 'AFECTO_IVA_19' | 'EXENTO' | 'HONORARIOS_RETENCION' | 'NO_APLICA'
  periodicidad: PeriodicidadProvision; // 'NO_PERIODICA_PUNTUAL' | 'MENSUAL' | etc.

  // Desglose de Montos (Neto, IVA y Total a Pagar en Caja)
  montoEstimado: number; // Monto Base / Neto
  montoNeto?: number;
  montoIva?: number; // IVA Crédito Fiscal (19%) simulado o calculado
  montoTotal?: number; // Monto Total Bruto (egreso real en banco) = Neto + IVA (o Líquido honorarios)
  tasaIvaPct?: number; // 19 por defecto
  simularCreditoFiscalF29?: boolean; // Si true, el IVA Crédito Fiscal se integra a la proyección del F29

  // Proveedor y Clasificación
  proveedorNombre?: string;
  proveedorRut?: string;
  probabilidadMaterializacionPct: number; // 0 a 100%
  cuentaContableProvision: string; // ej: "2.1.03.015"
  cuentaGastoAsociada?: string; // ej: "6.1.02.001"
  centroCostoId?: string;
  estado: 'PENDIENTE' | 'LIQUIDADA' | 'REVERSADA';
  observaciones?: string;

  // Trazabilidad Contable (Asiento de Devengo en Libro Diario)
  asientoContableGenerado?: boolean;
  asientoContableId?: string;
}

export interface CashFlowMovement {
  id: string;
  // 5 campos obligatorios requeridos:
  // 1. Fecha estimada y fecha real de cobro/pago
  fechaEstimada: string;
  fechaReal?: string;
  // 2. Concepto o glosa detallada
  concepto: string;
  // 3. Cliente / Proveedor / Entidad
  contraparte: string;
  rutContraparte?: string;
  // 4. Monto neto, IVA y monto total
  montoNeto: number;
  montoIva: number;
  montoTotal: number;
  moneda: 'CLP' | 'UF' | 'USD' | 'EUR';
  valorUfReferencia?: number;
  tipoCambio?: number;
  montoCLPEquivalente?: number;
  // 5. Estado
  estado: 'PENDIENTE' | 'FACTURADO' | 'COBRADO' | 'PAGADO' | 'CONCILIADO' | 'VENCIDO';
  tipo: 'INGRESO' | 'EGRESO';
  categoria: CashFlowCategory;
  dteFolioAsociado?: number;
  origenModulo?: CashFlowOriginModule;
  probabilidadCobroPct?: number; // 0 a 100%
  cuentaBancariaId?: string;
  alertaRiesgo?: string;
  documentoReferencia?: string;
  fechaOriginal?: string;
  reprogramado?: boolean;
  motivoReprogramacion?: string;
}

export interface DailyCashFlowPoint {
  fecha: string;
  diaSemana: string;
  ingresosDia: number;
  egresosDia: number;
  flujoNetoDia: number;
  saldoProyectado: number;
  saldoInicialDia?: number;
  estaEnDeficit: boolean;
  quiebreCajaMonto: number;
  eventosClave: {
    concepto: string;
    tipo: 'INGRESO' | 'EGRESO';
    monto: number;
    categoria: CashFlowCategory;
  }[];
}

// Cuentas de Efectivo (Caja, Fondo Fijo, Caja Chica)
export type CashAccountType = 'CAJA_EFECTIVO' | 'FONDO_FIJO' | 'CAJA_CHICA' | 'RECAUDACION_POR_DEPOSITAR';

export interface CashAccountConfig {
  id: string;
  nombre: string; // ej: "Caja Central Oficina", "Fondo Fijo Planta Quellón"
  tipoCuenta: CashAccountType;
  codigoContable: string; // ej: "1.1.01.001"
  responsableNombre: string;
  montoSaldo: number;
  moneda: 'CLP' | 'USD';
  activo: boolean;
  centroCostoId?: string;
  descripcion?: string;
}

// Horizontes de Proyección del Flujo de Caja
export type CashFlowHorizonType =
  | 'DIA_DEL_MES'
  | '15_DIAS'
  | '30_DIAS'
  | '60_DIAS'
  | '90_DIAS'
  | '1_ANIO'
  | 'MES_COMPLETO'
  | 'PROXIMO_MES';

// Parametrización de Partidas a Incluir en el Flujo de Caja
export interface CashFlowInclusionParameters {
  incluirCuentasBancarias: boolean;
  incluirCuentasEfectivo: boolean; // Caja Central, Fondos Fijos
  incluirCobranzaDtePendientes: boolean; // Facturas emitidas por cobrar
  incluirVentasProyectadasHistoria: boolean; // Proyección de ventas s/ historia RCV
  tasaCrecimientoVentasPct: number; // Tasa de crecimiento estimada mensual (ej: 5%)
  diasCreditoVentasPromedio: number; // Plazo medio de cobro (ej: 30 días)
  pctVentasContado: number; // % Venta al contado (ej: 30%)
  incluirHitosProduccion: boolean; // Anticipos y saldos de presupuestos
  incluirChequesCartera: boolean; // Cheques en cartera por cobrar
  incluirChequesEmitidos: boolean; // Cheques emitidos por pagar diferidos
  incluirDeudaFinanciera: boolean; // Cuotas créditos y deudas bancarias
  incluirProvisionesEgresos: boolean; // Provisiones de egresos y gastos devengados
  incluirPagoProveedoresDte: boolean; // Facturas de proveedores por pagar
  incluirInsumosMpdProduccion: boolean; // Insumos y materias primas MPD
  incluirNominaSueldos: boolean; // Sueldos líquidos fin de mes
  incluirPreviredLeyesSociales: boolean; // Imposiciones día 10-13
  incluirF29Impuestos: boolean; // Impuesto F29 IVA+PPM día 20
  incluirArriendosIfrs16: boolean; // Arriendos operativos y financieros
  incluirGastosFondoFijo: boolean; // Reposiciones de caja chica
}

// Proyección Mensual Anual (12 Meses)
export interface MonthlyCashFlowPoint {
  periodo: string; // "2026-09"
  mesLabel: string; // "Septiembre 2026"
  mesAnio?: string;
  numeroMes: number; // 1 a 12
  saldoInicial: number;
  ingresosTotales: number;
  totalIngresos?: number;
  ingresosVentasHistoria: number;
  ventasHistoria?: number;
  ingresosDtes: number;
  cobranzasDte?: number;
  ingresosHitos: number;
  ingresosChequesCartera?: number;
  chequesCartera?: number;
  egresosTotales: number;
  totalEgresos?: number;
  egresosProveedores: number;
  pagoProveedores?: number;
  egresosNomina: number;
  nominaSueldos?: number;
  egresosPrevired: number;
  previredLeyesSociales?: number;
  egresosF29: number;
  f29Impuestos?: number;
  egresosArriendos: number;
  arriendos?: number;
  egresosChequesEmitidos?: number;
  chequesEmitidos?: number;
  egresosDeudaFinanciera?: number;
  deudaFinanciera?: number;
  egresosProvisiones?: number;
  provisionesEgresos?: number;
  egresosCajaFondoFijo: number;
  flujoNeto: number;
  saldoFinal: number;
  estaEnDeficit: boolean;
}

export interface LiquidityCrisisAlert {
  fechaQuiebre: string;
  diasParaQuiebre: number;
  saldoMinimoProyectado: number;
  deficitMaximo: number;
  causasPrincipales: string[];
  accionesRecomendadas: string[];
  nivelGravedad: 'CRITICO' | 'ALERTA' | 'PRECAUCION' | 'ESTABLE';
}

export interface ErpCommitmentsScanResult {
  nominaSueldos: {
    totalTrabajadores: number;
    totalLiquidoMensual: number;
    fechaPagoEstimada: string;
    proyectado: boolean;
  };
  previredLeyesSociales: {
    totalAporteTrabajador: number;
    totalAportePatronal: number;
    totalPreviredMensual: number;
    fechaVencimientoPrevired: string;
    proyectado: boolean;
  };
  f29Impuestos: {
    periodoFiscal: string;
    montoIvaDeterminado: number;
    montoPpm: number;
    retenciones: number;
    totalAPagarF29: number;
    fechaVencimientoF29: string;
    proyectado: boolean;
  };
  produccionHitos: {
    totalPresupuestosAprobados: number;
    montoTotalHitosCobro: number;
    montoTotalInsumosComprometidos: number;
    partidasHitos: {
      folioPresupuesto: string;
      clienteNombre: string;
      hitoDescripcion: string;
      montoTotal: number;
      fechaEstimada: string;
      tipo: 'INGRESO' | 'EGRESO';
    }[];
  };
  dtesPendientes: {
    ventasPorCobrarCount: number;
    ventasPorCobrarTotal: number;
    comprasPorPagarCount: number;
    comprasPorPagarTotal: number;
  };
  chequesCartera?: {
    totalCheques: number;
    montoTotalCobro: number;
    partidas: { numeroCheque: string; bancoEmisor: string; giradorNombre: string; fechaCobro: string; monto: number }[];
  };
  chequesEmitidos?: {
    totalCheques: number;
    montoTotalPago: number;
    partidas: { numeroCheque: string; bancoNombre: string; beneficiarioNombre: string; fechaPago: string; monto: number }[];
  };
  deudaFinanciera?: {
    totalOperaciones: number;
    montoTotalCuotasPendientes: number;
    partidas: { institucion: string; operacion: string; numeroCuota: number; fechaVencimiento: string; montoCuota: number }[];
  };
  provisionesEgresos?: {
    totalProvisiones: number;
    montoTotalEstimado: number;
    partidas: { concepto: string; tipo: TipoProvisionEgreso; fechaEstimadaPago: string; montoEstimado: number }[];
  };
  asientosAuxiliares?: {
    cxcPendientesCount: number;
    cxcPendientesTotal: number;
    cxpPendientesCount: number;
    cxpPendientesTotal: number;
    partidas: {
      cuentaCodigo: string;
      cuentaNombre: string;
      rutAuxiliar?: string;
      documentoRef?: string;
      fechaVencimiento: string;
      monto: number;
      tipo: 'INGRESO' | 'EGRESO';
    }[];
  };
  totalCompromisosIdentificados: number;
}

// Configuración y Diseño Gráfico de Plantilla Excel para Flujo de Caja
export type CashFlowExcelFont = 'Calibri' | 'Arial' | 'Segoe UI' | 'Aptos' | 'Trebuchet MS';
export type CashFlowExcelNumberFormat = 'CLP_NO_DECIMALS' | 'CLP_WITH_DECIMALS' | 'USD_STANDARD' | 'EUR_STANDARD';
export type CashFlowExcelNegativeFormat = 'PARENTHESIS_RED' | 'MINUS_RED' | 'STANDARD_MINUS';

export interface CashFlowExcelThemeConfig {
  id: string;
  name: string;
  description?: string;
  fontFamily: CashFlowExcelFont;
  fontSizeHeader: number;
  fontSizeData: number;
  
  // Paleta de Colores (Hex #RRGGBB)
  headerBgColor: string; // Cabecera principal
  headerTextColor: string;
  
  kpiBannerBgColor: string; // Banner de KPIs superiores
  kpiBannerTextColor: string;
  
  summaryRowBgColor: string; // Resumen inicial y saldos
  summaryRowTextColor: string;
  
  ingresosSectionColor: string; // Barra divisora ingresos
  ingresosRowBgColor: string; // Filas de cobranzas
  ingresosTextColor: string;
  
  egresosSectionColor: string; // Barra divisora egresos
  egresosRowBgColor: string; // Filas de egresos/proveedores
  egresosTextColor: string;
  
  saldosAcumRowBgColor: string; // Fila de saldo acumulado de cierre
  saldosAcumRowTextColor: string;
  
  // Opciones de Maquetación y Formato
  numberFormat: CashFlowExcelNumberFormat;
  negativeFormat: CashFlowExcelNegativeFormat;
  enableZebraStripes: boolean;
  zebraBgColor: string;
  enableDoubleUnderlineTotals: boolean;
  enableFreezePanes: boolean;
  enableKpiCards: boolean;
  enableCompanyHeader: boolean;
  includeFlatMovementsSheet: boolean;
  autoColumnWidths: boolean;
}

export type TipoDocumentoRespaldo = 
  | 'DTE_SII'
  | 'CONTRATO'
  | 'RENDICION_GASTOS'
  | 'COMPROBANTE_BANCARIO'
  | 'DOCUMENTO_LABORAL'
  | 'TRIBUTARIO_TGR'
  | 'OTRO_RESPALDO';

export interface AccountingEntryLine {
  id?: string;
  cuentaCodigo: string;
  cuentaNombre: string;
  debe: number;
  haber: number;
  glosa?: string;
  rutAuxiliar?: string;
  nombreAuxiliar?: string;
  centroCosto?: string;
  proyecto?: string; // Código o Nombre del Proyecto / Obra / Contrato (WIP / IFRS)
  documentoRef?: string;
  dteIdAsociado?: string;
  tipoDocumentoRef?: TipoDocumentoRespaldo | string;
  folioDocumentoRef?: string;
  montoDocumentoRef?: number; // Importe total del documento relacionado (ej: Factura $119.000)
  fechaDocumentoRef?: string; // Fecha de emisión del documento de respaldo (YYYY-MM-DD)
  fechaVencimientoRef?: string; // Fecha de vencimiento del documento de respaldo (YYYY-MM-DD)
  documentoOperacion?: string; // N° Documento de Operación (ej: "22", "60", "80")
  tipoDocumentoOperacion?: string; // Tipo Doc Operación (ej: "CANJE FACTURA", "PAGO EN EFECTIVO", "TRANSFERENCIA")
  fechaDocumentoOperacion?: string; // Fecha del documento de operación (YYYY-MM-DD)
  documentoConciliacion?: string; // N° Documento de Conciliación (ej: "80")
  tipoDocumentoConciliacion?: string; // Tipo Doc Conciliación (ej: "TRANSFERENCIA", "CARTOLA BANCARIA")
  // Campos Multimoneda (NIC 21 / Divisas Extranjeras)
  monedaOriginal?: string; // ej: 'USD', 'EUR', 'UF'
  montoMonedaOriginal?: number; // Monto en la divisa original (ej: 1500.00)
  tipoCambio?: number; // Tipo de cambio / paridad aplicado en la fecha (ej: 955.20)
}

export interface AccountingEntry {
  id: string;
  fecha: string;
  concepto: string;
  documento: string; // ej: "Factura N° 1240", "F29 Periodo 2026-08", "Liquidación Juan Pérez", "Contrato Arriendo #102"
  documentoReferencia?: string;
  tipoDocumentoRef?: TipoDocumentoRespaldo;
  folioDocumentoRef?: string;
  lineas: AccountingEntryLine[];
  totalDebe: number;
  totalHaber: number;
  balanceado?: boolean;
  origen?: 'RCV_VENTA' | 'RCV_COMPRA' | 'HONORARIOS' | 'REMUNERACIONES' | 'F29_TRIBUTARIO' | 'ARRIENDO_IFRS16' | 'CAJA_BANCO' | 'INVENTARIO' | 'MANUAL' | 'AJUSTE_DIF_CAMBIO' | string;
  creadoEn?: string;
  supervisorSignature?: string;
}

export interface AccountPlanItem {
  codigo: string;
  nombre: string;
  tipo: 'ACTIVO' | 'PASIVO' | 'PATRIMONIO' | 'INGRESO' | 'COSTO' | 'GASTO';
  clasificacion: 'CIRCULANTE' | 'NO_CIRCULANTE' | 'CORTO_PLAZO' | 'LARGO_PLAZO' | 'OPERACIONAL' | 'NO_OPERACIONAL';
  clase?: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  naturaleza?: 'DEUDORA' | 'ACREEDORA';
  requiereAuxiliarRut?: boolean;
  requiereCentroCosto?: boolean;
  esConciliableBancaria?: boolean;
  // Nuevos atributos ERP contables avanzados
  manejaMultimoneda?: boolean; // MANEJA MULTIMONEDA (USD, EUR, UF / NIC 21)
  monedaCodigo?: string; // Moneda extranjera asignada a la cuenta (ej: 'USD', 'EUR', 'UF')
  requiereDocReferencia?: boolean; // DOCUMENTO REFERENCIA (Factura, Boleta, NC, etc.)
  esEfectivoEquivalente?: boolean; // EFECTIVO Y EFECTIVO EQUIVALENTE (NIC 7 / FECU)
  esContracuentaEfectivo?: boolean; // CONTRACUENTA EFECTIVO Y EFECTIVO EQUIVALENTE (Puente Tesorería)
  requiereProyecto?: boolean; // PROYECTO (Centro de Proyecto / Obra / Contrato)
  notasExplicativas?: number[]; // Números de Notas a los Estados Financieros (NIIF / CMF)
  tipoAuxiliarPermitido?: 'TODOS' | 'PROVEEDOR' | 'CLIENTE' | 'HONORARIO' | 'EMPLEADO';
  auxiliarPredeterminadoRut?: string;
}

export type AccountNature = 'DEUDORA' | 'ACREEDORA';

export interface AuxiliaryBankMovementInfo {
  bancoNombre?: string;
  tipoMedio?: string;
  folioOperacion?: string;
  fechaOperacion?: string;
  fechaCobro?: string;
}

export interface HierarchicalAccountItem {
  codigo: string;
  nombre: string;
  clase: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  grupo: string;
  subgrupo: string;
  nivel: 1 | 2 | 3 | 4 | 5;
  tipo: 'ACTIVO' | 'PASIVO' | 'PATRIMONIO' | 'INGRESO' | 'COSTO' | 'GASTO';
  clasificacion: 'CIRCULANTE' | 'NO_CIRCULANTE' | 'CORTO_PLAZO' | 'LARGO_PLAZO' | 'OPERACIONAL' | 'NO_OPERACIONAL';
  naturaleza: AccountNature;
  requiereAuxiliarRut: boolean;
  requiereCentroCosto: boolean;
  esConciliableBancaria: boolean;
  activa: boolean;
  // Atributos y Validaciones Contables Avanzadas (5 Conceptos ERP)
  manejaMultimoneda?: boolean; // MANEJA MULTIMONEDA
  monedaCodigo?: string; // Moneda asignada si manejaMultimoneda es true (ej: 'USD', 'EUR', 'UF')
  requiereDocReferencia?: boolean; // DOCUMENTO REFERENCIA
  esEfectivoEquivalente?: boolean; // EFECTIVO Y EFECTIVO EQUIVALENTE
  esContracuentaEfectivo?: boolean; // CONTRACUENTA EFECTIVO Y EFECTIVO EQUIVALENTE
  requiereProyecto?: boolean; // PROYECTO
  // Notas a los Estados Financieros (NIIF / CMF)
  notasExplicativas?: number[]; // Uno o varios números de notas asociadas (ej: [3, 17])
  tipoAuxiliarPermitido?: 'TODOS' | 'PROVEEDOR' | 'CLIENTE' | 'HONORARIO' | 'EMPLEADO';
  auxiliarPredeterminadoRut?: string;
  // Campos de personalización por empresa y presentación
  nombreGrupo?: string;
  nombreSubgrupo?: string;
  agrupacionFiscal?: string;
  subagrupacionFiscal?: string;
  agrupacionMatrizExtranjera?: string;
  subagrupacionMatrizExtranjera?: string;
  agrupacionPersonalizada?: string;
  subagrupacionPersonalizada?: string;
  empresaRut?: string;
}

// =========================================================================
// DEFINICIÓN DE MONEDAS Y TIPOS DE CAMBIO HISTÓRICOS (NIC 21 / SII)
// =========================================================================
export interface CurrencyDefinition {
  codigo: string; // ej: 'CLP', 'USD', 'EUR', 'UF', 'UTM'
  nombre: string; // ej: 'Peso Chileno', 'Dólar Estadounidense', 'Euro', 'Unidad de Fomento'
  simbolo: string; // ej: '$', 'US$', '€', 'UF'
  decimales: number; // 0 para CLP, 2 para USD/EUR, 2 o 4 para UF
  esMonedaBase: boolean; // true solo para la moneda funcional de reporte (CLP)
  activo: boolean;
  ultimaCotizacion: number; // Último tipo de cambio registrado en CLP (1 para CLP)
  fechaActualizacion?: string; // YYYY-MM-DD
  descripcion?: string;
}

export interface ExchangeRateRecord {
  id: string;
  fecha: string; // YYYY-MM-DD
  monedaCodigo: string; // ej: 'USD', 'EUR', 'UF'
  valor: number; // Tipo de cambio / paridad en CLP
  fuente?: string; // 'Banco Central de Chile', 'SII', 'Registro Manual', etc.
  observacion?: string;
  creadoEn?: string;
}

export interface ExchangeDifferenceCalculation {
  cuentaCodigo: string;
  cuentaNombre: string;
  monedaCodigo: string;
  saldoMonedaExtranjera: number; // Saldo neto en USD, EUR, UF
  saldoLibroCLP: number; // Saldo contable histórico en Libro Mayor (CLP)
  tipoCambioCierre: number; // T/C oficial de cierre
  valorCierreCLP: number; // saldoMonedaExtranjera * tipoCambioCierre
  diferenciaCLP: number; // valorCierreCLP - saldoLibroCLP
  tipoResultado: 'GANANCIA' | 'PERDIDA' | 'NEUTRO';
  cuentaAjusteCodigo: string; // '7.1.01.002' para ganancia, '7.2.01.002' para pérdida
  cuentaAjusteNombre: string;
}

// =========================================================================
// NOTAS A LOS ESTADOS FINANCIEROS (NIIF / IFRS / CMF CHILE NIC 1)
// =========================================================================
export type FinancialNoteNorm =
  | 'NIC_1' // Presentación de Estados Financieros
  | 'NIC_2' // Inventarios
  | 'NIC_7' // Flujos de Efectivo
  | 'NIC_16' // Propiedades, Planta y Equipo
  | 'NIC_21' // Efectos de las variaciones en las tasas de cambio de la moneda extranjera
  | 'NIC_12' // Impuesto a las Ganancias
  | 'NIC_19' // Beneficios a los Empleados
  | 'NIC_37' // Provisiones, Pasivos Contingentes y Activos Contingentes
  | 'NIC_10' // Hechos Ocurridos Después del Periodo sobre el que se Informa
  | 'NIIF_9' // Instrumentos Financieros
  | 'NIIF_15' // Ingresos de Actividades Ordinarias procedentes de Contratos con Clientes
  | 'NIIF_16' // Arrendamientos
  | 'CMF_CIRCULAR_1501' // Circular CMF Chile para Notas a los EE.FF.
  | 'POLITICA_GENERAL';

export type FinancialNoteCategory =
  | 'IDENTIFICACION_EMPRESA'
  | 'POLITICAS_CONTABLES'
  | 'ACTIVO_CORRIENTE'
  | 'ACTIVO_NO_CORRIENTE'
  | 'PASIVO_CORRIENTE'
  | 'PASIVO_NO_CORRIENTE'
  | 'PATRIMONIO_NETO'
  | 'INGRESOS_OPERACIONALES'
  | 'COSTOS_Y_GASTOS'
  | 'RESULTADO_FINANCIERO'
  | 'CONTINGENCIAS_Y_HECHOS_POSTERIORES';

export interface FinancialStatementNoteItem {
  codigoCuenta: string;
  nombreCuenta: string;
  clase: number;
  naturaleza: AccountNature;
  debe: number;
  haber: number;
  saldoDeudor: number;
  saldoAcreedor: number;
  saldoFinal: number;
  porcentajeDelTotal: number;
}

export interface FinancialStatementNote {
  id: string;
  numero: number;
  titulo: string;
  categoria: FinancialNoteCategory;
  normaReferencia: FinancialNoteNorm | string;
  contenido: string; // Redacción técnica formal explicativa
  cuentasAsociadas: string[]; // Códigos de cuentas vinculadas a la nota
  empresaRut: string;
  periodo?: string;
  estado: 'BORRADOR' | 'EN_REVISION' | 'DICTAMINADA';
  ultimaModificacion?: string;
  modificadoPor?: string;
  comentariosAuditoria?: string;
}

export interface AccountGroupDefinition {
  id: string;
  codigo: string; // ej: '1.1', '1.1.01', etc.
  nombre: string;
  clase: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  nivel: 2 | 3; // 2 = Grupo (1.1), 3 = Subgrupo (1.1.01)
  padreCodigo?: string; // Código del grupo padre para un subgrupo
  descripcion?: string;
}

export type BalanceGroupingMode =
  | 'TRADICIONAL_CMF'
  | 'AGRUPACION_FISCAL_SII'
  | 'FISCAL_SII'
  | 'CASA_MATRIZ_EXTRANJERA'
  | 'CASA_MATRIZ_HQ'
  | 'PERSONALIZADA'
  | 'PERSONALIZADO';

export interface GroupedBalanceItem {
  id: string;
  codigo: string;
  titulo: string;
  nivel: number;
  esGrupo: boolean;
  cuentas: TrialBalance8ColAccount[];
  subgrupos: GroupedBalanceItem[];
  totales: TrialBalance8ColTotals;
}

export interface GroupedBalanceReport {
  modo: BalanceGroupingMode;
  nombreEsquema: string;
  descripcionEsquema: string;
  grupos: GroupedBalanceItem[];
  totalesGenerales: TrialBalance8ColTotals;
  resultado_del_ejercicio: ResultadoEjercicio8Col;
}

// 8 Columns Balance (Chilean Official Format SII / CMF)
export interface TrialBalance8ColAccount {
  codigo: string;
  nombre: string;
  clase: number;
  naturaleza: AccountNature;
  debitos: number;
  creditos: number;
  saldo_deudor: number;
  saldo_acreedor: number;
  activo: number;
  pasivo: number;
  perdida: number;
  ganancia: number;
}

export interface TrialBalance8ColTotals {
  total_debitos: number;
  total_creditos: number;
  total_saldo_deudor: number;
  total_saldo_acreedor: number;
  total_activo: number;
  total_pasivo: number;
  total_perdida: number;
  total_ganancia: number;
}

export interface ResultadoEjercicio8Col {
  tipo: 'UTILIDAD' | 'PERDIDA' | 'EQUILIBRIO';
  monto: number;
  cuadre_inventario: boolean;
  cuadre_resultado: boolean;
  cuadre_simetrico: boolean;
}

export interface Balance8ColumnasReport {
  empresa_id: string;
  tipo_reporte: 'BALANCE_8_COLUMNAS';
  periodo_cierre: string;
  marco_contable: string;
  cuentas: TrialBalance8ColAccount[];
  totales: TrialBalance8ColTotals;
  resultado_del_ejercicio: ResultadoEjercicio8Col;
}

// ============================================================================
// ESTADO DE FLUJOS DE EFECTIVO - MÉTODO INDIRECTO (NIF / NIC 7 / CMF)
// ============================================================================
export interface CashFlowIndirectAccountDetail {
  codigo: string;
  nombre: string;
  saldoInicial: number;
  saldoFinal: number;
  variacion: number;
  impactoFlujo: number; // Positivo si genera efectivo, negativo si absorbe
}

export interface CashFlowIndirectLineItem {
  id: string;
  codigoAgrupador: string;
  concepto: string;
  categoria: 'OPERACION' | 'INVERSION' | 'FINANCIAMIENTO' | 'EFECTIVO_CONCILIACION';
  subcategoria:
    | 'RESULTADO_NETO'
    | 'AJUSTE_PARTIDA_NO_EFECTIVO'
    | 'VARIACION_CAPITAL_TRABAJO'
    | 'ACTIVIDAD_INVERSION'
    | 'ACTIVIDAD_FINANCIAMIENTO'
    | 'CONCILIACION_EFECTIVO';
  monto: number;
  montoAnterior?: number;
  cuentasAsociadas: CashFlowIndirectAccountDetail[];
  nivel: 1 | 2 | 3;
  esSubtotal?: boolean;
  esTotal?: boolean;
  notaNormativa?: string;
  signoFlujo?: '+' | '-' | '=';
}

export interface CashBalanceAccountDetail {
  codigo: string;
  nombre: string;
  tipo: 'CAJA' | 'BANCO' | 'EQUIVALENTE' | 'CONTRACUENTA';
  esMultimoneda?: boolean;
  saldoInicial: number;
  cargosPeriodo: number;
  abonosPeriodo: number;
  saldoFinal: number;
  variacionNeta: number;
}

export interface CashFlowIndirectAuditDiagnosis {
  resumenEjecutivo: string;
  saludFinanciera: 'OPTIMA' | 'ADVERTENCIA' | 'CRITICA';
  calidadUtilidadScorePct: number; // Flujo Operacional / Resultado Neto * 100
  coberturaDeuda: number;
  fugaEfectivoDetectada: boolean;
  alertasOperativas: string[];
  recomendacionesController: string[];
  agenteAuditorNombre: string;
  agenteSignature: string;
  hashIntegridadSha256: string;
  fechaAuditoria: string;
}

export interface CashFlowIndirectReport {
  id: string;
  empresaId: string;
  empresaNombre: string;
  empresaRut: string;
  periodo: string; // ej: '2026-10'
  periodoComparativo?: string;
  fechaEmision: string;
  marcoNormativo: 'NIF / NIC 7 (IAS 7) / CMF CHILE';
  
  // Totales de Actividades
  resultadoNeto: number;
  totalAjustesNoEfectivo: number;
  totalVariacionCapitalTrabajo: number;
  flujoNetoOperacional: number;
  flujoNetoInversion: number;
  flujoNetoFinanciamiento: number;
  variacionNetaEfectivo: number;
  
  // Conciliación de Saldos de Efectivo
  saldoInicialEfectivo: number;
  saldoFinalEfectivo: number;
  efectoTipoCambio: number;
  diferenciaCuadratura: number;
  estaCuadrado: boolean;
  
  // Listados Detallados
  partidasOperacion: CashFlowIndirectLineItem[];
  partidasInversion: CashFlowIndirectLineItem[];
  partidasFinanciamiento: CashFlowIndirectLineItem[];
  desgloseEfectivo: CashBalanceAccountDetail[];
  
  // Inteligencia y Auditoría Agéntica
  diagnosticoAgente: CashFlowIndirectAuditDiagnosis;
}

// Orchestrator Audit & Peripheral Coordination
export interface OrchestratorAuditItem {
  modulo: 'VENTAS' | 'COMPRAS' | 'HONORARIOS' | 'RRHH' | 'F29' | 'TESORERIA' | 'INVENTARIO' | 'ARRIENDO' | 'ACTIVO_FIJO' | 'PRODUCCION' | 'RRHH_PERSONAS' | 'RENDICION_GASTOS';
  nombre: string;
  totalDocumentos: number;
  montoTotal: number;
  contabilizados: number;
  enTransito: number;
  estado: 'AL_DIA' | 'EN_TRANSITO' | 'DESCUADRADO';
  observacion: string;
}

// Accounting Proposal (Layer Transaccional JSON)
export interface AccountingProposalLine {
  codigo_cuenta: string;
  nombre_cuenta: string;
  rut_auxiliar?: string;
  centro_costo?: string;
  debe: number;
  haber: number;
  glosa_detalle?: string;
}

export interface AccountingProposalResponse {
  empresa_id: string;
  accion: 'comprobante_aprobado' | 'comprobante_rechazado' | 'propuesta_asiento';
  origen_modulo: 'RRHH' | 'VENTAS' | 'COMPRAS' | 'F29' | 'TESORERIA' | 'MANUAL' | 'INVENTARIO' | 'ARRIENDO' | 'RENDICION_GASTOS';
  periodo: string;
  asiento: {
    fecha: string;
    tipo_comprobante: 'INGRESO' | 'EGRESO' | 'TRASPASO';
    glosa_general: string;
    cuadre_valido: boolean;
    total_debe: number;
    total_haber: number;
    lineas: AccountingProposalLine[];
  };
  alertas_auditoria: string[];
}

export interface PeriodClosingAdjustment {
  id: string;
  tipo: 'DEVENGOS' | 'CORRECCION_MONETARIA_USD' | 'REAJUSTE_UF' | 'DEPRECIACION_ACTIVO_FIJO';
  titulo: string;
  descripcion: string;
  baseCalculo: number;
  montoAjuste: number;
  asientoPropuesto: {
    glosa: string;
    lineas: AccountingProposalLine[];
  };
  aplicado: boolean;
  fuenteDatos?: string;
  memoriaCalculo?: string;
  normaReferencia?: string;
}

export interface ChileIndicators {
  uf: number;
  utm: number;
  dolar: number;
  imm: number;
  topeImponibleAfpUf: number;
  topeImponibleAfcUf: number;
  retencionHonorariosTasa: number;
  sisTasa: number;
  mutualBaseTasa: number;
  fecha: string;
}

// =======================================================
// MÓDULO DE INVENTARIO, BODEGAS Y AGENTE LOGÍSTICO (CHILE)
// =======================================================

export type WarehouseType = 'CENTRAL' | 'SUCURSAL' | 'FAENA' | 'TRANSITO' | 'CUARENTENA';

export interface Warehouse {
  id: string;
  empresaId: string;
  codigo: string; // ej: "BOD-01-QUI"
  nombre: string; // ej: "Bodega Central Quilicura"
  direccion: string;
  comuna: string;
  region: string;
  tipo: WarehouseType;
  encargadoNombre: string;
  encargadoRut: string;
  telefonoEncargado?: string;
  capacidadM2: number;
  ocupacionPorcentaje: number;
  esBodegaPrincipal: boolean;
  activa: boolean;
}

export type InventoryCategory = 'REPUESTOS' | 'INSUMOS' | 'MERCADERIA_VENTA' | 'MATERIAS_PRIMAS' | 'EQUIPAMIENTO';
export type UnitOfMeasure = 'UNIDADES' | 'CAJAS' | 'KILOS' | 'LITROS' | 'METROS' | 'PALLETS';
export type StockStatus = 'OPTIMO' | 'BAJO_MINIMO' | 'CRITICO' | 'SOBRESTOCK';

export interface WarehouseStockDetail {
  bodegaId: string;
  bodegaNombre: string;
  stockFisico: number;
  ubicacionPasillo?: string; // ej: "Rack A-04-Nivel 2"
}

export interface InventoryItem {
  id: string;
  empresaId: string;
  sku: string; // ej: "FILT-HID-04"
  codigoBarras?: string; // EAN-13
  nombre: string;
  descripcion?: string;
  categoria: InventoryCategory;
  unidadMedida: UnitOfMeasure;
  costoUnitarioPMP: number; // Precio Medio Ponderado en CLP (Norma SII Art. 30 LIR)
  ultimoPrecioCompra: number;
  precioVentaSugerido: number;
  // Stocks consolidados
  stockGeneral: number; // Físico total
  stockEnTransito: number; // En traslados entre bodegas con DTE 52
  stockComprometido: number; // Reservado para órdenes
  stockDisponible: number; // stockGeneral - stockComprometido
  // Parámetros de control
  stockMinimo: number; // Alerta preventiva
  stockCritico: number; // Alerta de quiebre inminente
  loteOptimoReposicion: number; // Cantidad a pedir (EOQ)
  consumoMensualPromedio: number;
  diasCoberturaEstimados: number;
  estadoStock: StockStatus;
  // Distribución física por bodega
  stockPorBodega: WarehouseStockDetail[];
  // Proveedor sugerido de reposición
  proveedorPrincipal: {
    rut: string;
    razonSocial: string;
    plazoEntregaDias: number;
    emailContacto: string;
  };
}

export type TransferStatus = 'PROGRAMADO' | 'EN_TRANSITO' | 'RECEPCIONADO' | 'DISCREPANCIA';
export type TransferReason = 'REPOSICION_SUCURSAL' | 'EQUILIBRIO_STOCK' | 'SUMINISTRO_FAENA' | 'DEVOLUCION_CENTRAL';

export interface TransferItemDetail {
  itemId: string;
  sku: string;
  nombre: string;
  cantidadEnviada: number;
  cantidadRecepcionada?: number;
  costoUnitarioPMP: number;
  diferencia?: number; // Para mermas o roturas
}

export interface WarehouseTransfer {
  id: string;
  empresaId: string;
  folioGuiaDespacho52: number; // Folio Electrónico DTE 52 SII
  fechaDespacho: string;
  fechaEstimadaLlegada: string;
  fechaRecepcionReal?: string;
  bodegaOrigenId: string;
  bodegaOrigenNombre: string;
  bodegaDestinoId: string;
  bodegaDestinoNombre: string;
  motivoTraslado: TransferReason;
  estado: TransferStatus;
  items: TransferItemDetail[];
  valorTotalTraslado: number;
  // Datos del transporte para Guía DTE 52 (Norma SII)
  transporte: {
    patenteCamion: string;
    rutChofer: string;
    nombreChofer: string;
    rutTransportista: string;
    razonSocialTransportista: string;
  };
  observaciones?: string;
  asientoContableGeneradoId?: string;
}

export type RequisitionPriority = 'URGENTE' | 'ALTA' | 'NORMAL';
export type RequisitionActionType = 'COMPRA_PROVEEDOR' | 'TRASPASO_INTERNO';
export type RequisitionStatus = 'PENDIENTE_APROBACION' | 'ORDEN_COMPRA_GENERADA' | 'TRASPASO_INICIADO' | 'RECHAZADA';

export interface ReplenishmentRequisition {
  id: string;
  empresaId: string;
  folioRequisicion: string; // ej: "REQ-2026-0901"
  fechaGeneracion: string;
  generadoPorAgente: boolean;
  motivoAgente: string;
  itemId: string;
  sku: string;
  nombreItem: string;
  categoria: InventoryCategory;
  bodegaDestinoId: string;
  bodegaDestinoNombre: string;
  stockActual: number;
  stockMinimo: number;
  stockCritico: number;
  cantidadSugerida: number;
  costoEstimadoCLP: number;
  prioridad: RequisitionPriority;
  tipoAccionRecomendada: RequisitionActionType;
  bodegaOrigenSugeridaTraspaso?: string; // Bodega con sobrestock identificada por IA
  proveedorSugerido?: {
    rut: string;
    razonSocial: string;
    plazoEntregaDias: number;
  };
  estado: RequisitionStatus;
  ordenCompraFolio?: number;
}

// ========================================================
// RECURSOS HUMANOS & PERSONAS (LEGISLACIÓN LABORAL CHILE / DT)
// ========================================================

export type LaborContractType = 
  | 'INDEFINIDO' 
  | 'PLAZO_FIJO' 
  | 'POR_OBRA_FAENA' 
  | 'PART_TIME' 
  | 'TELETRABAJO_HIBRIDO';

export type ContractStatus = 'VIGENTE' | 'POR_VENCER' | 'RENOVADO_INDEFINIDO' | 'FINIQUITADO';

export interface LaborContractAnnex {
  id: string;
  contratoId: string;
  fecha: string;
  tipo: 'CAMBIO_SUELDO' | 'ADAPTACION_LEY_40_HORAS' | 'MODALIDAD_TELETRABAJO' | 'PACTO_HORAS_EXTRAS' | 'CAMBIO_CARGO_FUNCIONES';
  descripcion: string;
  registradoDtRel: boolean;
  folioRegistroDt?: string;
}

export interface LaborContract {
  id: string;
  employeeId: string;
  rut: string;
  nombreCompleto: string;
  nacionalidad: string;
  estadoCivil: string;
  fechaNacimiento: string;
  domicilio: string;
  comuna: string;
  cargo: string;
  departamento: string;
  tipoContrato: LaborContractType;
  fechaInicio: string;
  fechaTermino?: string; // Obligatorio en plazo fijo o por faena
  fechaVencimientoAlerta?: string; // 15 días antes
  sueldoBase: number;
  jornadaHorasSemanales: number; // 40 o 44 hrs según avance gradual Ley 21.561
  distribucionJornada: string; // ej: "Lunes a Viernes de 08:30 a 17:30 hrs"
  lugarTrabajo: string;
  gratificacionModalidad: 'ART_50' | 'ART_47' | 'CONVENCIONAL';
  asignacionColacion: number;
  asignacionMovilizacion: number;
  estado: ContractStatus;
  registradoDtRel: boolean; // Registro Electrónico Laboral (Mi DT - Ley 21.327)
  folioRegistroDt?: string;
  anexos: LaborContractAnnex[];
  clausulaConfidencialidad: boolean;
  clausulaTeletrabajo: boolean;
  observaciones?: string;
}

export type MedicalLeaveType = 
  | 'ENFERMEDAD_COMUN' 
  | 'PRONATAL_POSTNATAL' 
  | 'ACCIDENTE_DEL_TRABAJO' 
  | 'ACCIDENTE_DE_TRAYECTO' 
  | 'ENFERMEDAD_PROFESIONAL' 
  | 'PATOLOGIA_EMBARAZO' 
  | 'ENFERMEDAD_GRAVE_NINO_MENOR_1';

export type MedicalLeaveEntity = 
  | 'FONASA_COMPIN' 
  | 'ISAPRE_BANMEDICA' 
  | 'ISAPRE_COLMENA' 
  | 'ISAPRE_CONSALUD' 
  | 'ISAPRE_CRUZ_BLANCA' 
  | 'ISAPRE_NUEVA_MASVIDA' 
  | 'MUTUAL_DE_SEGURIDAD' 
  | 'ACHS' 
  | 'IST' 
  | 'ISL';

export type MedicalLeaveStatus = 
  | 'RECIBIDA' 
  | 'TRAMITADA_EMPLEADOR' 
  | 'APROBADA_COMPIN_ISAPRE' 
  | 'RECHAZADA' 
  | 'PAGADA_SIL';

export interface MedicalLeave {
  id: string;
  folioLicencia: string; // Folio LME (Licencia Médica Electrónica)
  employeeId: string;
  rut: string;
  nombreCompleto: string;
  tipoLicencia: MedicalLeaveType;
  entidadTramitadora: MedicalLeaveEntity;
  fechaInicio: string;
  fechaTermino: string;
  diasReposo: number;
  diasDescuentoRemuneracion: number; // Días no trabajados en el mes
  diasSubsidioSIL: number; // Días que cubre Fonasa/Isapre/Mutual (SIL)
  descuentoNominaEstimado: number; // Monto descontado en la liquidación de sueldo
  medicoNombre: string;
  medicoRut: string;
  diagnosticoCie10?: string;
  estado: MedicalLeaveStatus;
  fechaTramitacionEmpleador?: string;
  observaciones?: string;
}

export interface VacationRequest {
  id: string;
  fechaSolicitud: string;
  fechaInicio: string;
  fechaRetorno: string;
  diasHabilesTomados: number; // Sin contar sábados, domingos ni festivos (Art. 69 CT)
  estado: 'SOLICITADA' | 'APROBADA_JEFE' | 'AUTORIZADA_RRHH' | 'RECHAZADA' | 'TOMADA';
  comprobanteFirmado: boolean;
  comentario?: string;
}

export interface VacationRecord {
  id: string;
  employeeId: string;
  rut: string;
  nombreCompleto: string;
  fechaIngreso: string;
  antiguedadAnos: number;
  diasLegalesPorAno: number; // 15 días hábiles conforme al Art. 67 del Código del Trabajo
  diasProgresivos: number; // Art. 68 Código del Trabajo (> 10 años cotizados y 3 con actual empleador)
  diasAcumuladosTotales: number;
  diasTomadosHistorico: number;
  diasDisponibles: number;
  periodosPendientes: number; // Si >= 2 períodos -> Infracción grave Art. 70 Código del Trabajo
  alertaExcesoPeriodosArt70: boolean;
  solicitudes: VacationRequest[];
}

export type BenefitCategory = 
  | 'LEGAL_OBLIGATORIO' 
  | 'ASIGNACION_NO_IMPONIBLE' 
  | 'SALUD_BIENESTAR' 
  | 'CAJA_COMPENSACION' 
  | 'SALA_CUNA_ART203' 
  | 'AGUINALDO_FESTIVIDAD' 
  | 'TELETRABAJO_CONECTIVIDAD';

export interface HrBenefit {
  id: string;
  nombre: string;
  categoria: BenefitCategory;
  descripcion: string;
  normaLegalChilena: string; // ej: "Art. 41 Código del Trabajo", "Art. 203 Sala Cuna", "Ley 21.220"
  montoAporteEmpresaPorTrabajador: number;
  esImponible: boolean;
  beneficiariosActivos: number;
  proveedorConvenio?: string; // ej: "Caja Los Andes", "BICE Vida Complementario", "Red Vitamina"
  frecuencia: 'MENSUAL' | 'ANUAL_FIESTAS_PATRIAS' | 'ANUAL_NAVIDAD' | 'PAGO_EVENTUAL';
  activo: boolean;
}

export type AbsenteeismType = 
  | 'INASISTENCIA_INJUSTIFICADA' 
  | 'ATRASO_REITERADO' 
  | 'PERMISO_CON_GOCE_LEGAL' 
  | 'PERMISO_SIN_GOCE_SUELDO' 
  | 'PERMISO_FALLECIMIENTO_ART66' 
  | 'PERMISO_MATRIMONIO_ART207BIS' 
  | 'PERMISO_PATERNIDAD_ART195';

export interface AbsenteeismRecord {
  id: string;
  employeeId: string;
  rut: string;
  nombreCompleto: string;
  fecha: string;
  tipo: AbsenteeismType;
  duracionTexto: string; // ej: "1 día completo", "45 minutos"
  minutosAtraso?: number;
  diasInasistencia?: number;
  justificativoPresentado?: string;
  impactoDescuentoPesos: number;
  alertaCausalArt160N3: boolean; // Alerta de causal de despido sin indemnización (2 días seguidos, 2 lunes o 3 días)
  estado: 'PENDIENTE_REVISION' | 'JUSTIFICADO' | 'APLICADO_EN_NOMINA' | 'AMONESTACION_GENERADA';
  observaciones?: string;
}

export type SanctionType = 
  | 'AMONESTACION_VERBAL' 
  | 'AMONESTACION_ESCRITA' 
  | 'AMONESTACION_ESCRITA_CON_COPIA_DT' 
  | 'MULTA_REGLAMENTO_INTERNO' 
  | 'CARTA_AVISO_TERMINO_CONTRATO';

export interface DisciplinarySanction {
  id: string;
  employeeId: string;
  rut: string;
  nombreCompleto: string;
  fechaInfraccion: string;
  fechaEmision: string;
  tipo: SanctionType;
  motivoInfraccion: string;
  articuloRiohs: string; // ej: "Art. 18 RIOHS sobre puntualidad y asistencia", "Art. 45 sobre uso de EPP"
  montoMulta?: number; // Máximo legal 25% de la remuneración diaria (Art. 157 Código del Trabajo)
  destinatarioMulta?: string; // Fondo de bienestar de los trabajadores (mandato legal Art. 157)
  notificadoAlTrabajador: boolean;
  fechaNotificacion?: string;
  remitidoInspeccionDelTrabajo: boolean;
  folioConstanciaDt?: string;
  estado: 'BORRADOR' | 'NOTIFICADO' | 'REGISTRADO_DT';
  textoCartaFormal: string;
}

export interface LegalBookDTReport {
  periodo: string; // YYYY-MM
  fechaGeneracion: string;
  totalTrabajadoresInformados: number;
  totalHaberesImponibles: number;
  totalHaberesNoImponibles: number;
  totalDescuentosPrevisionales: number;
  totalImpuestoUnicoRetenido: number;
  totalSueldosLiquidos: number;
  totalAportesPatronales: number;
  csvContenido: string;
  estadoEnvioMIDT: 'PENDIENTE_ENVIO' | 'ENVIADO_ACEPTADO_DT' | 'ENVIADO_CON_OBSERVACIONES';
  folioCertificadoDT?: string;
}

export interface HrAgentAlert {
  id: string;
  tipo: 
    | 'CONTRATO_PLAZO_FIJO_POR_VENCER' 
    | 'VACACIONES_VENCIDAS_ART70' 
    | 'AUSENTISMO_CAUSAL_ART160' 
    | 'LIBRO_REMUNERACIONES_DT_VENCIMIENTO' 
    | 'LEY_40_HORAS_IMPLEMENTACION' 
    | 'LEY_KARIN_PREVENCION';
  nivel: 'CRITICO' | 'ALTO' | 'MEDIO' | 'INFORMATIVO';
  titulo: string;
  descripcion: string;
  normaLegal: string;
  accionRecomendada: string;
  empleadoAfectado?: string;
  fechaVencimiento?: string;
}

// Technical ERP Output Protocol as requested by prompt
export interface ErpTechnicalOutputPayload {
  empresa_id: string;
  modulo: 'remuneraciones' | 'contratos' | 'ausentismos' | 'certificados' | 'finiquitos' | 'ley_karin';
  accion: 'crear_liquidacion' | 'generar_contrato' | 'registrar_licencia' | 'calcular_finiquito' | 'emitir_certificado' | 'generar_previred';
  periodo: string; // "YYYY-MM"
  data: {
    rut_trabajador: string;
    nombre_trabajador?: string;
    haberes_imponibles: number;
    haberes_no_imponibles: number;
    total_haberes: number;
    descuentos_legales: {
      afp_monto: number;
      salud_monto: number;
      afc_monto: number;
      impuesto_unico: number;
    };
    otros_descuentos: number;
    liquido_a_pagar: number;
    costo_empresa_total: number;
    detalles_adicionales?: Record<string, any>;
  };
  asiento_contable: Array<{
    cuenta: string;
    debe: number;
    haber: number;
  }>;
}

// Finiquitos & Cálculo de Indemnizaciones
export type SeveranceCausal = 
  | 'ART_159_MUTUO_ACUERDO'
  | 'ART_159_RENUNCIA_VOLUNTARIA'
  | 'ART_159_VENCIMIENTO_PLAZO'
  | 'ART_159_CONCLUSION_TRABAJO_SERVICIO'
  | 'ART_159_CASO_FORTUITO'
  | 'ART_160_CONDUCTAS_INDEBIDAS_GRAVES'
  | 'ART_160_FALTAS_REITERADAS'
  | 'ART_161_NECESIDADES_DE_LA_EMPRESA'
  | 'ART_161_DESAHUCIO_ESCRITO';

export interface SeveranceCalculation {
  id: string;
  empresaId: string;
  rut: string;
  nombreCompleto: string;
  cargo: string;
  fechaIngreso: string;
  fechaDespido: string;
  antiguedadAnos: number;
  antiguedadMeses: number;
  antiguedadDias: number;
  causal: SeveranceCausal;
  sueldoBaseUltimo: number;
  remuneracionMensualComputable: number; // Base para indemnización (tope 90 UF)
  diasAvisoPrevioOtorgados: number; // Si < 30 y causal 161, paga indemnización sustitutiva
  indemnizacionAvisoPrevio: number;
  indemnizacionAnosServicio: number;
  aniosComputables: number; // Máximo 11 años salvo contratos pre-1981
  diasFeriadoPendienteProporcional: number;
  montoFeriadoProporcional: number;
  descuentoAporteAfcEmpleador: number; // Descuento imputable en Art. 161 (Ley 19.728)
  totalFiniquitoBruto: number;
  totalDescuentos: number;
  totalFiniquitoLiquido: number;
  asientoContable?: Array<{ cuenta: string; debe: number; haber: number }>;
}

// Protocolo Ley Karin (Ley 21.643)
export interface KarinInvestigationCase {
  id: string;
  empresaId: string;
  folioCaso: string;
  fechaDenuncia: string;
  tipoAcoso: 'ACOSO_LABORAL' | 'ACOSO_SEXUAL' | 'VIOLENCIA_EN_EL_TRABAJO';
  denuncianteRutAnonimizado: string;
  denunciadoCargo: string;
  estado: 'MEDIDAS_DE_RESGUARDO_INMEDIATAS' | 'INVESTIGACION_INTERNA' | 'DERIVADO_A_INSPECCION_TRABAJO' | 'RESUELTO_CON_SANCION' | 'DESESTIMADO';
  medidasDeResguardo: string;
  plazoLegalDias: number; // 30 días corridos para informe
  fechaLimiteInforme: string;
  responsableInvestigacion: string;
  conclusionesYAcciones?: string;
}

// Certificados Laborales
export type CertificateType = 
  | 'ANTIGUEDAD' 
  | 'REMUNERACIONES_COTIZACIONES' 
  | 'SALA_CUNA_ART203' 
  | 'ENTREGA_RIOHS_EPP';

export interface GeneratedLaborCertificate {
  id: string;
  tipo: CertificateType;
  folio: string;
  fechaEmision: string;
  rutTrabajador: string;
  nombreTrabajador: string;
  cargo: string;
  empresaRazónSocial: string;
  empresaRut: string;
  representanteLegal: string;
  cuerpoTexto: string;
  hashFirmaDigital: string;
  validoHasta: string;
}

// ============================================================================
// AGENTE 1: ADMINISTRACIÓN DEL ACTIVO FIJO (NIC 16 / ART. 31 N° 5 & ART. 41 LIR)
// ============================================================================

export type FixedAssetCategory =
  | 'MAQUINARIA_EQUIPOS'
  | 'INSTALACIONES_REDES'
  | 'TECNOLOGIA_COMPUTO'
  | 'VEHICULOS'
  | 'MUEBLES_UTILES'
  | 'INFRAESTRUCTURA_EDIFICIOS'
  | 'HERRAMIENTAS_ESPECIALES';

export type FixedAssetStatus =
  | 'OPERATIVO'
  | 'MANTENCION'
  | 'EN_TRANSITO'
  | 'DADO_DE_BAJA'
  | 'ENAJENADO';

export type DepreciationMethod =
  | 'LINEAL_IFRS'
  | 'ACELERADA_TRIBUTARIA'
  | 'INSTANTANEA_PYME'
  | 'UNIDADES_PRODUCCION';

export interface FixedAsset {
  id: string;
  empresaId: string;
  codigoPlaca: string; // ej: "AF-2026-001"
  codigoQr?: string;
  nombre: string;
  descripcion: string;
  categoria: FixedAssetCategory;
  cuentaContableActivo: string; // ej: '1.2.05'
  cuentaContableDepreciacion: string; // ej: '1.2.99'
  cuentaContableGasto: string; // ej: '5.2.08' (o CIF '5.1.04')
  fechaAdquisicion: string; // YYYY-MM-DD
  fechaInicioUso: string;
  proveedorRut?: string;
  proveedorRazonSocial?: string;
  folioDteCompra?: number; // Folio Factura Electrónica DTE 33
  // Valores Históricos
  valorAdquisicionOriginal: number; // Costo histórico de adquisición ($ CLP)
  valorResidualFinanciero: number; // Valor residual IFRS ($ CLP)
  // Vida Útil
  vidaUtilMesesFinanciera: number; // Vida útil técnica IFRS (meses)
  vidaUtilMesesTributaria: number; // Vida útil tributaria según Circular SII (meses)
  mesesDepreciados: number;
  vidaUtilRestanteMeses: number;
  metodoDepreciacion: DepreciationMethod;
  // Parámetros Financieros (IFRS / NIC 16)
  depreciacionAcumuladaFinanciera: number;
  valorLibroFinanciero: number; // valorAdquisicionOriginal - depreciacionAcumuladaFinanciera
  cuotaDepreciacionMensualFinanciera: number;
  // Parámetros Tributarios Chilenos (Art. 31 N° 5 & Art. 41 LIR)
  factorCorreccionMonetariaAcum: number; // IPC acumulado
  correccionMonetariaAcumulada: number; // Reajuste Art. 41 LIR
  depreciacionAcumuladaTributaria: number;
  valorTributarioNeto: number;
  cuotaDepreciacionMensualTributaria: number;
  // Control Operativo & Físico
  ubicacionFisica: string; // ej: "Centro de Cultivo Hornopirén #3", "Taller de Redes Quellón", "Bodega Central"
  responsableCustodio: string; // ej: "Juan Pablo Soto - Jefe de Mantenimiento"
  estado: FixedAssetStatus;
  // Relación con Centro de Costos
  centroCostoId?: string;
  centroCostoCodigo?: string;
  centroCostoNombre?: string;
  numeroSerie?: string;
  marcaModelo?: string;
  esFabrilProduccion?: boolean; // Si genera cuota de depreciación imputable a CIF (Costos Indirectos)
  ultimaInspeccionFecha?: string;
  proximaMantencionFecha?: string;
  notasTecnicas?: string;
  asientoAltaId?: string;
}

export interface FixedAssetDepreciationRun {
  id: string;
  empresaId: string;
  periodo: string; // YYYY-MM
  fechaEjecucion: string;
  totalActivosProcesados: number;
  totalDepreciacionFinancieraMes: number;
  totalDepreciacionTributariaMes: number;
  totalCorreccionMonetariaMes: number;
  totalDepreciacionFabrilCifMes: number; // Imputable a Costos Indirectos de Fabricación
  asientoGeneradoId?: string;
  detallePorActivo: Array<{
    activoId: string;
    codigoPlaca: string;
    nombre: string;
    depreciacionFinanciera: number;
    depreciacionTributaria: number;
    correccionMonetaria: number;
    nuevoValorLibro: number;
  }>;
}

export interface FixedAssetTableReportItem {
  id: string;
  codigoPlaca: string;
  nombre: string;
  categoria: FixedAssetCategory;
  fechaAdquisicion: string;
  valorInicial: number;
  adiciones: number;
  bajas: number;
  correccionMonetaria: number;
  depreciacionEjercicio: number;
  depreciacionAcumulada: number;
  valorNetoFinanciero: number;
  valorNetoTributario: number;
  estado: FixedAssetStatus;
}

// ============================================================================
// AGENTE 2: PRODUCCIÓN Y SISTEMA DE COSTEO DE PRODUCTOS (NIC 2 / COSTEO REAL Y NORMAL)
// ============================================================================

export type ProductionOrderStatus =
  | 'PLANIFICADA'
  | 'EN_PROCESO'
  | 'CONTROL_CALIDAD'
  | 'TERMINADA'
  | 'LIQUIDADA'
  | 'ANULADA';

export type ProductionProductCategory =
  | 'SALMONIDOS_PROCESADOS'
  | 'REDES_Y_FONDEOS'
  | 'ALIMENTO_Y_SUPLEMENTOS'
  | 'PRODUCTOS_MANUFACTURADOS'
  | 'SERVICIOS_INDUSTRIALES';

export type CifAllocationBase =
  | 'HORAS_HOMBRE_MOD'
  | 'HORAS_MAQUINA'
  | 'COSTO_PRIMO'
  | 'UNIDADES_PRODUCIDAS';

export interface BillOfMaterialItem {
  id: string;
  insumoId: string;
  insumoCodigo: string;
  insumoNombre: string;
  unidadMedida: string;
  cantidadPorUnidad: number;
  costoUnitarioEstimado: number;
  porcentajeMermaTolerada: number;
}

export interface DirectMaterialConsumption {
  id: string;
  ordenProduccionId: string;
  fecha: string;
  insumoId: string;
  insumoCodigo: string;
  insumoNombre: string;
  bodegaOrigenId: string;
  bodegaOrigenNombre: string;
  cantidadConsumida: number;
  unidadMedida: string;
  costoUnitarioPMP: number; // Costo Medio Ponderado Art. 30 LIR
  costoTotalConsumo: number;
  folioGuiaDespacho52?: number; // Guía electrónica de despacho interna
  asientoId?: string;
}

export interface DirectLaborEntry {
  id: string;
  ordenProduccionId: string;
  fecha: string;
  trabajadorRut: string;
  trabajadorNombre: string;
  cargo: string;
  horasTrabajadas: number;
  tarifaHoraCostoEmpresa: number; // Incluye base, imposiciones patronales proporcionales
  costoTotalMOD: number;
  etapaProceso: string; // ej: "Corte y Armado", "Eviscerado", "Fileteo", "Termofusión"
  asientoId?: string;
}

export interface IndirectCostPoolItem {
  id: string;
  periodo: string; // YYYY-MM
  concepto: string;
  categoriaCif:
    | 'ENERGIA_COMBUSTIBLE'
    | 'DEPRECIACION_MAQUINARIA'
    | 'MANTENCION_FABRIL'
    | 'MANO_OBRA_INDIRECTA'
    | 'ARRIENDO_PLANTA'
    | 'SEGUROS_EPP';
  montoTotalPeriodo: number;
  cuentaContableGasto: string;
  dteFolioAsociado?: number;
}

export interface ProductionOrder {
  id: string;
  empresaId: string;
  folioOP: string; // ej: "OP-2026-108"
  descripcion: string;
  productoCodigo: string;
  productoNombre: string;
  categoria: ProductionProductCategory;
  unidadMedida: string; // ej: "UNID", "KG", "METROS"
  fechaInicio: string;
  fechaEstimadaTermino: string;
  fechaRealTermino?: string;
  estado: ProductionOrderStatus;
  cantidadObjetivo: number;
  cantidadProducidaReal: number;
  cantidadMerma: number;
  bodegaDestinoId?: string;
  bodegaDestinoNombre?: string;
  // Componentes del Costo de Fabricación
  costoDirectoMateriales: number; // MPD acumulado ($ CLP)
  costoDirectoManoObra: number; // MOD acumulado ($ CLP)
  costoPrimo: number; // MPD + MOD
  baseProrrateoCif: CifAllocationBase;
  tasaCifAplicada: number; // $/HH, $/HM o % sobre costo primo
  costoIndirectoCif: number; // CIF aplicado ($ CLP)
  costoTotalProduccion: number; // MPD + MOD + CIF
  costoUnitarioReal: number; // costoTotalProduccion / cantidadProducidaReal
  precioVentaEstimado: number;
  margenBrutoUnitarioEstimado: number; // % o $
  // Trazabilidad de Consumos
  consumosMateriales: DirectMaterialConsumption[];
  manoDeObraRegistros: DirectLaborEntry[];
  // Asociación con Presupuesto de Producción y Cotización
  presupuestoId?: string;
  presupuestoFolio?: string;
  clienteNombre?: string;
  clienteRut?: string;
  precioVentaPactado?: number;
  margenPresupuestadoClp?: number;
  margenPresupuestadoPct?: number;
  presupuestoBase?: {
    costoMpdPresupuestado: number;
    costoModPresupuestado: number;
    costoCifPresupuestado: number;
    costoTotalPresupuestado: number;
    materialesPresupuestados: {
      insumoId?: string;
      insumoCodigo: string;
      insumoNombre: string;
      cantidadPresupuestada: number;
      costoUnitarioEstimado: number;
      costoTotalPresupuestado: number;
      unidadMedida: string;
    }[];
  };
  desvioMargenActualClp?: number;
  desvioMargenActualPct?: number;
  analisisCierre?: ProductionOrderClosureAnalysis;
  // Asientos Contables Generados en Libro Diario
  asientosGenerados: {
    consumoMpdAsientoId?: string;
    aplicacionModAsientoId?: string;
    aplicacionCifAsientoId?: string;
    liquidacionPtAsientoId?: string;
    costoVentasAsientoId?: string;
  };
}

export type BudgetStatus =
  | 'BORRADOR'
  | 'ENVIADO'
  | 'EN_NEGOCIACION'
  | 'APROBADO'
  | 'RECHAZADO'
  | 'CANCELADO';

export type BudgetItemType = 'MPD' | 'MOD' | 'CIF' | 'OTRO';

export interface ProductionBudgetItem {
  id: string;
  tipo: BudgetItemType;
  insumoId?: string;
  insumoCodigo?: string;
  descripcion: string;
  unidadMedida: string;
  cantidadPresupuestada: number;
  costoUnitarioEstimado: number;
  costoTotalEstimado: number;
  precioUnitarioSugerido?: number;
  precioTotalVenta?: number;
  visibleParaCliente: boolean; // Si es false, se oculta en la cotización cliente pero se computa en el margen interno
  notasInternas?: string;
}

export interface ProductionBudget {
  id: string;
  empresaId: string;
  folio: string; // ej: "PRE-2026-042"
  clienteId?: string;
  clienteNombre: string;
  clienteRut: string;
  contactoCliente?: string;
  emailCliente?: string;
  fechaEmision: string;
  fechaValidez: string;
  estado: BudgetStatus;
  fechaEnvio?: string;
  fechaAprobacion?: string;
  productoNombre: string;
  productoCodigo: string;
  categoria: ProductionProductCategory;
  unidadMedida: string;
  cantidad: number;
  condicionesComerciales?: string;
  partidas: ProductionBudgetItem[];
  // Métricas financieras calculadas
  costoTotalMpd: number;
  costoTotalMod: number;
  costoTotalCif: number;
  costoTotalInterno: number; // Incluye partidas visibles y ocultas
  precioVentaNetoCliente: number; // Precio cotizado al cliente (visible)
  margenBrutoEstimadoClp: number;
  margenBrutoEstimadoPct: number;
  markupPct: number;
  ordenProduccionIdGenerada?: string;
  folioOpGenerada?: string;
  historialEnvio?: {
    fecha: string;
    remitente: string;
    destinatario: string;
    observaciones?: string;
  }[];
}

export interface MaterialDeviationDetail {
  insumoCodigo: string;
  insumoNombre: string;
  unidadMedida: string;
  cantidadPresupuestada: number;
  cantidadReal: number;
  desvioCantidad: number;
  desvioCantidadPct: number;
  costoPresupuestado: number;
  costoReal: number;
  desvioCostoClp: number;
  impactoEnMargenPct: number;
}

export interface ProductionOrderClosureAnalysis {
  fechaCierre: string;
  costoMpdReal: number;
  costoMpdPresupuestado: number;
  varianzaMpdClp: number;
  varianzaMpdPct: number;
  costoModReal: number;
  costoModPresupuestado: number;
  varianzaModClp: number;
  varianzaModPct: number;
  costoCifReal: number;
  costoCifPresupuestado: number;
  varianzaCifClp: number;
  varianzaCifPct: number;
  costoTotalReal: number;
  costoTotalPresupuestado: number;
  varianzaCostoTotalClp: number;
  varianzaCostoTotalPct: number;
  precioVentaFinal: number;
  margenPresupuestadoClp: number;
  margenPresupuestadoPct: number;
  margenRealClp: number;
  margenRealPct: number;
  erosionMargenPct: number; // Margen Presupuestado % - Margen Real %
  diagnosticoEficiencia: 'EXCELENTE' | 'DENTRO_DE_TOLERANCIA' | 'DESVIO_MODERADO' | 'SOBRECOSTO_CRITICO';
  resumenDiagnostico: string;
  detalleDesviosMateriales: MaterialDeviationDetail[];
}

export interface WarehouseWithdrawalItem {
  insumoId: string;
  insumoCodigo: string;
  insumoNombre: string;
  cantidadSolicitada: number;
  cantidadPresupuestadaOriginal: number;
  cantidadPresupuestada?: number;
  cantidadPreviaConsumida: number;
  cantidadTotalResultante: number;
  haySobreconsumo: boolean;
  desvioCantidad: number;
  costoUnitarioPMP: number;
  costoTotal: number;
  unidadMedida: string;
  impactoEstimadoEnMargenClp: number;
}

export interface WarehouseWithdrawal {
  id: string;
  empresaId: string;
  folioVale: string; // ej: "VALE-2026-0042"
  fecha: string;
  fechaRetiro?: string;
  horaRetiro?: string;
  tipoRetiro?: 'ORDEN_PRODUCCION' | 'NOTA_PEDIDO_CC'; // Soporte para empresas productivas vs comerciales/servicios
  ordenProduccionId?: string; // OBLIGATORIO si es ORDEN_PRODUCCION
  ordenProduccionFolio?: string;
  notaPedidoFolio?: string; // Folio de Nota de Pedido / Solicitud Autorizada
  notaPedidoAutorizadaPor?: string;
  centroCostoId?: string;
  centroCostoNombre?: string;
  distribucionMultiCentroCosto?: {
    centroCostoId: string;
    centroCostoNombre: string;
    porcentaje: number;
    montoClp: number;
  }[];
  clienteNombre?: string;
  bodegaOrigenId: string;
  bodegaOrigenNombre: string;
  solicitanteNombre: string;
  responsableBodega: string;
  responsableBodegaNombre?: string;
  items: WarehouseWithdrawalItem[];
  costoTotalVale: number;
  costoTotalRetiro?: number;
  alertaSobreconsumo?: boolean;
  folioGuiaDespacho52?: string;
  observaciones?: string;
  asientoId?: string;
}

// ==========================================
// MAESTRO DE CENTROS DE COSTO (Mini-Empresas Transversales)
// ==========================================
export type CostCenterCategory = 'ADMINISTRACION' | 'VENTAS' | 'OPERACIONES' | 'PRODUCCION' | 'LOGISTICA' | 'SERVICIOS';

export interface CostCenterMaster {
  id: string;
  empresaId?: string;
  clienteId?: string;
  codigo: string; // ej: "CC-ADM-01", "CC-VTA-STGO", "CC-PRD-QUELLON"
  nombre: string; // ej: "Ventas & Sucursal Santiago (Mini-Empresa)"
  categoria: CostCenterCategory;
  responsableNombre: string;
  emailResponsable?: string;
  responsableEmail?: string;
  presupuestoMensualClp: number;
  activo: boolean;
  descripcion?: string;
  // Indicadores consolidados de la "Mini Empresa"
  ventasAcumuladasMes: number;
  costosDirectosMes: number;
  gastosOperacionalesMes: number;
  remuneracionesMes: number;
  depreciacionMes?: number;
  margenContribucionClp?: number;
  margenContribucionMes?: number;
  margenContribucionPct?: number;
  rentabilidadPct?: number;
  desviacionPresupuestariaClp?: number;
  alertaDesvioPresupuestario?: boolean;
}

export interface CostCenterImputation {
  id: string;
  centroCostoId: string;
  tipoDocumento: string; // DTE, Nomina, Vale Bodega, etc.
  folioReferencia: string;
  fecha: string;
  montoClp: number;
  concepto: string;
  tipoFlujo: 'INGRESO' | 'COSTO' | 'GASTO';
}

// ==========================================
// RECETAS Y FÓRMULAS DE FABRICACIÓN (BOM - BILL OF MATERIALS)
// ==========================================
export interface RecipeMaterialItem {
  insumoId: string;
  insumoCodigo: string;
  insumoNombre: string;
  unidadMedida: string;
  cantidadRequerida: number; // Por unidad de producto final
  mermaPorcentaje: number; // ej: 2.5%
  costoUnitarioPMP: number;
  costoSubtotal: number;
}

export interface ProductRecipe {
  id: string;
  empresaId: string;
  codigo: string; // ej: "REC-RED-40X40"
  nombre: string; // ej: "Red Lobera Polietileno Reforzada 40x40m"
  productoTerminadoSku: string;
  categoria: ProductionProductCategory;
  unidadMedida: string; // "UNID", "METRO", etc.
  centroCostoFabricacion: string; // ej: "CC-PRD-QUELLON"
  rendimientoLoteBase: number; // ej: 1 unidad
  materiales: RecipeMaterialItem[];
  costoManoObraDirectaEstimado: number; // MOD unitario
  costosIndirectosFabricacionEstimado: number; // CIF unitario
  costoTotalMateriales: number; // Suma materiales
  costoTotalUnitarioFabricacion: number; // Materiales + MOD + CIF
  precioVentaSugerido: number;
  margenEstimadoPct: number;
  tiempoFabricacionHoras?: number;
  version: string;
  activa: boolean;
  notasTecnicas?: string;
}

// ==========================================
// REPOSICIÓN Y COTIZACIÓN AUTOMÁTICA POR PROXIMIDAD (RFQ)
// ==========================================
export interface AutoRfqRuleConfig {
  activa: boolean;
  disparadorNivelStock: 'BAJO_MINIMO' | 'CRITICO';
  radioMaximoKm: number; // ej: 50 km
  comunaBaseBodega: string; // ej: "Quellón"
  calificacionMinimaProveedor: number; // ej: 4.0
  plazoMaximoEntregaDias: number; // ej: 5 días
  enviarEmailAutomatico: boolean;
  solicitarMinimoCotizaciones: number; // ej: 2
  copiaEmailCompras: string;
  mensajePersonalizadoRfq?: string;
}

export interface RfqSupplierContact {
  rut: string;
  razonSocial: string;
  email: string;
  comuna: string;
  distanciaKm: number;
  calificacion: number;
  estadoEnvio: 'ENVIADA' | 'RESPONDIENDO' | 'COTIZADA';
  precioCotizadoUnitario?: number;
  plazoEntregaOfrecidoDias?: number;
  cumpleCriterios?: boolean;
}

export interface AutoGeneratedRfq {
  id: string;
  folioRfq: string; // ej: "RFQ-2026-001"
  fechaEmision: string;
  itemId: string;
  itemSku: string;
  itemNombre: string;
  unidadMedida: string;
  stockActual: number;
  stockMinimo: number;
  cantidadSolicitada: number;
  bodegaDestinoNombre: string;
  motivoDisparo: string;
  proveedoresContactados: RfqSupplierContact[];
  estado: 'EMITIDA' | 'EN_EVALUACION' | 'ORDENADA';
}

export interface CostOfGoodsManufacturedReport {
  periodo: string;
  inventarioInicialWip: number;
  consumoMpd: number;
  manoObraDirecta: number;
  costosIndirectosCif: number;
  costoIncurridoFabricacion: number;
  inventarioFinalWip: number;
  costoProductosTerminados: number;
  inventarioInicialPt: number;
  inventarioFinalPt: number;
  costoDeVentas: number;
}

// ==========================================
// PLANES DE CONTRATACIÓN ERP & SUPERADMINISTRACIÓN
// ==========================================

export interface ErpSubscriptionPlan {
  id: string;
  nombre: string;
  precioMensualClp: number;
  limiteUsuarios: number;
  limiteEmpresasContables: number;
  modulosIncluidos: string[];
  referenciaTexto: string;
  nivelSoporteDefecto: 'Básico' | 'Avanzado' | 'Dedicado 24/7';
  destacado?: boolean;
}

export interface ClientContractInfo {
  planId: string;
  nombrePlan: string;
  licenciasContratadas: number;
  limiteUsuarios: number;
  limiteEmpresas: number;
  precioMensualNeto: number;
  modulosIncluidos: string[];
  numeroContrato: string;
  tipoContrato: 'Mensual' | 'Trimestral' | 'Semestral' | 'Anual';
  fechaContrato: string; // YYYY-MM-DD
  duracionDias: number; // 365
  diasTolerancia: number; // 5
  fechaExpiracion: string; // YYYY-MM-DD
  ejecutivoAsignado: string;
  nivelSoporte: 'Básico' | 'Avanzado' | 'Dedicado 24/7';
}

export interface ClientLocationInfo {
  direccion: string;
  pais: string; // "Chile"
  region: string;
  ciudad: string;
  comuna: string;
}

export interface ClientAccountingConfig {
  grupoImpuesto: string;
  cuentaCliente: string; // ej: '1.1.03'
  cuentaVentas: string; // ej: '4.1.01'
  cuentaDescVentas: string; // ej: '4.1.02'
  cuentaRecepcionMercaderias: string; // ej: '2.1.04'
  cuentaDescPagos: string; // ej: '5.2.01'
}

export interface ClientCommercialConfig {
  tipoVenta: 'Contado' | 'Crédito';
  estadoCredito: 'Sin Crédito' | 'Con Crédito' | 'Bloqueado';
  montoCredito: number;
  terminosPago: string;
  areaVentas: string;
  vendedor: string;
  centroCosto: string;
  descuentoPorcentaje: number;
  descProntoPagoPorcentaje: number;
}

// ==========================================
// CONFIGURACIÓN DE SISTEMA Y CONTABILIDAD GENERAL (Page 10)
// ==========================================

export interface SystemGeneralParameters {
  tenantId: string;
  // Mayor General
  intervaloDiasVencimiento: number;
  cuentaResultadosAcumulados: string;
  cuentaGananciaPerdidaAno: string;
  cuentaVariacionTipoCambio: string;
  cuentaCargosBancarios: string;
  monedaNacional?: string;
  toleranciaCentavosAsiento?: number;
  cuentaAjusteSencillo?: string;
  cuentaDiferenciaCambioGanancia?: string;
  cuentaDiferenciaCambioPerdida?: string;
  cuentaResultadoEjercicio?: string;
  // Art. 16 Código Tributario (Cierre de Ejercicio)
  mesCierreEjercicio: number;
  diaCierreEjercicio: number;
  ejercicioActivo: number;
  bloqueoPeriodoCerrado: boolean;
  resolucionSiiCierreEspecial?: string;
  // Clientes y Ventas
  limiteCreditoDefecto: number;
  envioAcumuladoLotes: boolean;
  textoLegalFactura: string;
  cuentaGastosEnvio: string;
  // Clientes y Ventas por Defecto
  cuentasPorCobrarDefecto: string;
  cuentaVentasDefecto: string;
  cuentaDescuentoVentasDefecto: string;
  cuentaDescuentoProntoPagoDefecto: string;
  despachoRequeridoDias: number;
  // Centro de Costos por Defecto
  centroCostosRequeridosDespuesDias: number;
  // Proveedores y Compradores
  rangoToleranciaEntregaSobreRecepcionPorc: number;
  rangoToleranciaFacturaSobreCargaPorc: number;
  cuentaPagableDefecto: string;
  cuentaDescuentoComprasDefecto: string;
  cuentaGuiaEntradaDefecto: string;
  // Inventario
  permitirInventarioNegativo: boolean;
  // Productos por Defecto
  cuentaInventarioDefecto: string;
  cuentaCostoVentaDefecto: string;
  cuentaAjustesInventarioDefecto: string;
  cuentaCostosEnsambleArticulosDefecto: string;
  // Fabricación por Defecto
  ordenTrabajoRequeridaDespuesDias: number;
}

// ==========================================
// PLAN DE CUENTAS IFRS JERÁRQUICO (Pages 8-9)
// ==========================================

export interface AccountGroupClassification {
  codigo: string;
  codPadre: string;
  tipoCuenta: 'ACTIVO' | 'PASIVO' | 'PATRIMONIO' | 'RESULTADO';
  descripcion: string;
}

export interface AccountCreationDefinition {
  codigo: string;
  nombre: string;
  clasificacion: 'ACTIVO' | 'PASIVO' | 'PATRIMONIO' | 'RESULTADO';
  agrupacion: string;
  codigoE?: string;
  codigoS?: string;
  codigoFlujoEfectivo?: string;
  notas?: string;
  // 11 toggles de atributos y controles de imputación
  atributos?: {
    activo: boolean;
    auxiliar: boolean;
    multimoneda: boolean;
    moneda: string;
    docRef: boolean;
    conciliacion: boolean;
    ifrs: boolean;
    centroCosto: boolean;
    dimension2: boolean;
    detHabita: boolean;
    proyecto: boolean;
  };
  activo?: boolean;
  auxiliar?: boolean;
  multimoneda?: boolean;
  moneda?: string;
  docRef?: boolean;
  conciliacion?: boolean;
  ifrs?: boolean;
  centroCosto?: boolean;
  dimension2?: boolean;
  detHabita?: boolean;
  proyecto?: boolean;
}

// ==========================================
// MAESTRO DE AUXILIARES DE CLIENTES (Page 11)
// ==========================================

export interface ClientAuxiliaryMasterRecord {
  id: string;
  rutCompleto: string;
  codigoAuxiliar: string;
  razonSocial: string;
  nombreFantasia: string;
  giroComercial: string;
  inactivo: boolean;
  telefonoPrincipal: string;
  emailContacto: string;
  nombreContacto: string;
  emailDte: string;
  direccion?: string;
  region?: string;
  ciudad?: string;
  comuna?: string;
  tipoAuxiliar?: 'CLIENTE' | 'PROVEEDOR' | 'AMBOS';
  sucursales?: { id: string; nombre: string; direccion: string; comuna: string }[];
  limiteCredito?: number;
  terminosPago?: string;
  vendedor?: string;
  descuentoPorcentaje?: number;
}

// ==========================================
// AGENTE AUTÓNOMO DE FACTURACIÓN Y COBRANZA (SII & PLAYWRIGHT)
// ==========================================

export interface BillingItemDetail {
  id: string;
  nombre: string;
  descripcion?: string;
  cantidad: number;
  unidadMedida: string; // "C/U", "MT", "KG", "HR", "GL"
  precioUnitario: number;
  descuentoPct?: number;
  esExento?: boolean;
  montoTotal: number;
  // Relación con Centro de Costos
  centroCostoId?: string;
  centroCostoCodigo?: string;
  centroCostoNombre?: string;
}

export interface BillingDteReference {
  tipoDocRef: '33' | '34' | '39' | '52' | '801'; // 801 = Orden de Compra
  folioRef: number;
  fechaRef: string;
  codRef: '1' | '2' | '3'; // 1=Anula, 2=Corrige texto, 3=Corrige montos
  razonRef: string;
}

export interface BillingExportData {
  clausulaVenta: 'FOB' | 'CIF' | 'CFR' | 'EXW';
  puertoEmbarque: string;
  paisReceptor: string;
  monedaExportacion: 'USD' | 'EUR';
  tipoCambioObservado: number;
  modalidadVenta: 'DEFINITIVA' | 'A_FIRME' | 'BAJO_CONDICION';
}

export interface BillingEmissionDraft {
  id: string;
  tipoDte: DteType;
  folioSugerido?: number;
  fechaEmision: string;
  condicionVenta: 'CONTADO' | 'CREDITO_30' | 'CREDITO_60' | 'CREDITO_90';
  fechaVencimiento: string;
  medioPago?: 'TRANSFERENCIA' | 'CHEQUE' | 'TARJETA' | 'EFECTIVO';
  // Receptor
  rutReceptor: string;
  razonSocialReceptor: string;
  giroReceptor: string;
  direccionReceptor: string;
  comunaReceptor: string;
  ciudadReceptor: string;
  emailReceptorDte: string;
  // Items
  items: BillingItemDetail[];
  montoNeto: number;
  montoExento: number;
  montoIva: number;
  montoTotal: number;
  // Referencias (para DTE 61 / 56)
  referencia?: BillingDteReference;
  // Datos Exportación (para DTE 110)
  exportacion?: BillingExportData;
  // Vinculación con Producción
  ordenProduccionId?: string;
  ordenProduccionCodigo?: string;
  presupuestoId?: string;
  hitoDescripcion?: string;
}

export interface PlaywrightRobotStep {
  stepNumber: number;
  descripcion: string;
  selector: string;
  valorOAccion: string;
  timestamp?: string;
  estado: 'PENDIENTE' | 'EJECUTANDO' | 'EXITO' | 'FALLO';
}

export interface PlaywrightRobotRunReport {
  id: string;
  tipoDte: DteType;
  rutEmisor: string;
  rutReceptor: string;
  portalUrl: string;
  modoEjecucion: 'HEADLESS_BOT' | 'SIMULACION_GUI' | 'SCRIPT_DESCARGA';
  iniciadoEn: string;
  finalizadoEn?: string;
  estado: 'EN_PROCESO' | 'COMPLETADO_EXITO' | 'ERROR';
  folioAsignado?: number;
  tedXmlFirmado?: string;
  trackIdSii?: string;
  pasos: PlaywrightRobotStep[];
  logs: string[];
}

// ============================================================================
// ESTRUCTURAS HTTP-DTE / LIBREDTE (API REST LOCAL SLIM / PHP)
// Endpoint: POST http://localhost:8050/dte/emitir
// ============================================================================

export interface HttpDteEmisor {
  rut: string; // Ej: "76123456-7"
  razonSocial: string;
  giro: string;
  acteco: number | number[]; // Ej: 139400
  direccion: string;
  comuna: string;
  ciudad?: string;
  telefono?: string;
  correo?: string;
}

export interface HttpDteReceptor {
  rut: string; // Ej: "77123456-K"
  razonSocial: string;
  giro: string;
  direccion: string;
  comuna: string;
  ciudad?: string;
  contacto?: string;
  correo?: string;
}

export interface HttpDteDetalleItem {
  NroLinDet?: number;
  NmbItem: string;
  DscItem?: string;
  QtyItem: number;
  UnmdItem?: string;
  PrcItem: number; // Precio unitario neto o exento
  MontoItem?: number; // Total de la línea (QtyItem * PrcItem)
  IndExe?: number; // 1 si es ítem no afecto o exento de IVA
  DescuentoMonto?: number;
  DescuentoPct?: number;
  // Campos analíticos de trazabilidad interna ERP
  centroCostoId?: string;
  centroCostoCodigo?: string;
  centroCostoNombre?: string;
}

export interface HttpDteFirmaConfig {
  data: string; // Base64 del certificado digital (.p12 / .pfx)
  password: string; // Contraseña del certificado digital (desde env var)
}

export interface HttpDteReferencia {
  NroLinRef?: number;
  TpoDocRef: number | string; // 33: Factura, 34: Factura Exenta, etc.
  FolioRef: number | string;
  FchRef: string; // YYYY-MM-DD
  CodRef: number; // 1: Anula, 2: Corrige Texto, 3: Corrige Montos
  RazonRef: string;
}

export interface HttpDteEmissionPayload {
  tipoDte: number; // 33, 34, 52, 56, 61, etc.
  folio?: number; // Opcional si el CAF lo determina automáticamente
  fechaEmision: string; // YYYY-MM-DD
  fechaVencimiento?: string; // YYYY-MM-DD
  formaPago?: number; // 1: Contado, 2: Crédito, 3: Sin Costo
  emisor: HttpDteEmisor;
  receptor: HttpDteReceptor;
  detalles: HttpDteDetalleItem[];
  firma: HttpDteFirmaConfig;
  caf: string; // Contenido string del XML del CAF
  ambiente: 1 | 2; // 1: Certificación, 2: Producción
  referencia?: HttpDteReferencia;
  totales?: {
    montoNeto?: number;
    montoExento?: number;
    montoIva?: number;
    montoTotal?: number;
  };
}

export interface HttpDteEmissionResponse {
  success: boolean;
  folio?: number;
  tipoDte?: number;
  trackId?: string; // Identificador oficial de recepción y envío del SII
  ted?: string; // Timbre Electrónico DTE (<TED>...</TED>)
  xmlTimbrado?: string; // XML oficial firmado digitalmente
  pdfBase64?: string; // PDF generado en base64
  pdfUrl?: string; // Ruta local o URL del PDF almacenado
  dteId?: string; // ID asignado en la base de datos del ERP
  ambiente?: 1 | 2;
  timestamp?: string;
  error?: string;
  rawResponse?: any;
}

// ============================================================================
// DISEÑADOR DE FORMATO DE FACTURA & DTE (SII CHILE)
// ============================================================================

export type DteLayoutPreset = 'CORPORATE' | 'OFFICIAL_SII' | 'MINIMALIST' | 'INDUSTRIAL' | 'EXECUTIVE_DARK';

export interface DteDocumentLayoutConfig {
  id: string;
  companyId: string;
  preset: DteLayoutPreset;
  updatedAt: string;

  // Marca & Logotipo
  logoUrl?: string;
  logoPosition: 'left' | 'center' | 'right';
  logoSize: 'sm' | 'md' | 'lg' | 'xl';
  showCompanyNameWithLogo: boolean;
  nombreFantasia?: string;

  // Estilo y Tipografía
  primaryColor: string;
  accentColor: string;
  textColor: string;
  fontFamily: 'sans' | 'serif' | 'mono';
  fontSize: 'sm' | 'md' | 'lg';
  headerStyle: 'filled' | 'outlined' | 'clean';
  tableBorders: 'full' | 'horizontal' | 'minimal';
  stripedRows: boolean;

  // Datos Obligatorios Emisor (SII)
  emisorRut: string;
  emisorRazonSocial: string;
  emisorGiro: string;
  emisorDireccion: string;
  emisorComuna: string;
  emisorCiudad: string;
  emisorUnidadSii: string; // Ej: "S.I.I. - PUERTO MONTT"
  emisorActecoTexto?: string;
  emisorTelefono?: string;
  emisorEmail?: string;
  emisorWeb?: string;
  emisorSucursalesTexto?: string;

  // Recuadro Rojo Obligatorio SII (Resolución Ex. N° 11)
  recuadroRojoBorderWidth: number; // 2, 3 o 4 px
  recuadroRojoBorderStyle: 'double' | 'solid';
  recuadroRojoColor: string; // '#dc2626'
  customFolioPrefix?: string;

  // Elementos Legales de Facturación
  showLey19983Cedible: boolean; // Recuadro de Acuse de Recibo para Mérito Ejecutivo
  tipoEjemplar: 'ORIGINAL_CLIENTE' | 'CEDIBLE_MERITO_EJECUTIVO' | 'CEDIBLE' | 'TRIPLICADO_CONTROL';
  showTedBarcode: boolean;
  tedLeyendaTexto: string;
  watermark: 'NONE' | 'ORIGINAL' | 'CEDIBLE' | 'MERITO_EJECUTIVO' | 'MUESTRA' | 'PAGADO';

  // Opciones de Columnas en Tabla de Detalles
  showItemCode: boolean;
  showItemDescription: boolean;
  showItemUnit: boolean;
  showItemDiscount: boolean;
  showCostCenterTag: boolean;

  // Totales y Pie de Factura
  showTotalInWords: boolean;
  showBankDetails: boolean;
  bankDetailsText: string;
  commercialNotes: string;
  footerDisclaimer: string;

  // Formato de Papel para Impresión / PDF
  paperSize: 'LETTER' | 'A4';
  pageOrientation: 'PORTRAIT';
  marginSize: 'compact' | 'normal' | 'wide';
}

// ============================================================================
// AGENTE ADMINISTRADOR DE RENDICIÓN DE GASTOS ("RINDE GASTOS" CHILENO NIF / SII)
// ============================================================================
export type ExpenseReportStatus =
  | 'BORRADOR'
  | 'PENDIENTE_APROBACION'
  | 'EN_REVISION_CONTABLE'
  | 'APROBADA'
  | 'OBJETADA_RECHAZADA'
  | 'CONTABILIZADA_PAGADA';

export type ExpenseDocumentType =
  | 'BOLETA_ELECTRONICA'
  | 'FACTURA_ELECTRONICA_33'
  | 'FACTURA_EXENTA_34'
  | 'BOLETA_HONORARIOS'
  | 'INVOICE_EXTERIOR'
  | 'TICKET_PEAJE'
  | 'RECIBO_MOVILIZACION'
  | 'OTRO';

export type ExpenseCategory =
  | 'ALIMENTACION'
  | 'ALOJAMIENTO'
  | 'TRANSPORTE_MOVILIZACION'
  | 'COMBUSTIBLE'
  | 'PEAJES_ESTACIONAMIENTOS'
  | 'MATERIALES_INSUMOS'
  | 'REPRESENTACION_CLIENTES'
  | 'TELECOMUNICACIONES'
  | 'SERVICIOS_TECNICOS'
  | 'OTROS';

export interface ExpenseItem {
  id: string;
  expenseReportId: string;
  empresaId?: string;
  fecha: string; // YYYY-MM-DD
  tipoDocumento: ExpenseDocumentType;
  folioDocumento: string;
  proveedorRut: string;
  proveedorRazonSocial: string;
  categoria: ExpenseCategory;
  descripcionGlosa: string;
  montoNeto: number;
  montoIva: number; // 19% si aplica
  montoExento: number;
  montoTotalClp: number;
  monedaOriginal?: 'CLP' | 'USD' | 'EUR' | 'UF';
  montoOriginal?: number;
  tipoCambio?: number;
  centroCostoId?: string;
  centroCostoCodigo?: string;
  proyectoId?: string;
  proyectoCodigo?: string;
  cuentaContableCodigo: string; // ej: "4.2.01.005"
  cuentaContableNombre?: string;
  comprobanteArchivoNombre?: string;
  comprobanteUrl?: string;
  comprobantePreviewBase64?: string;
  esGastoRechazadoArt21?: boolean;
  validadoPorAgente?: boolean;
  observacionAgente?: string;
  createdAt?: string;
}

export interface ExpenseProject {
  id: string;
  empresaId?: string;
  codigo: string; // ej: "PRY-QUELLON-01"
  nombre: string;
  clienteNombre?: string;
  presupuestoTotalClp?: number;
  activo: boolean;
  descripcion?: string;
}

export interface ExpenseAuditDiagnosis {
  calificacion: 'APROBADO_LIMPIO' | 'OBSERVACIONES_LEVES' | 'REQUIERE_REVISION_MANUAL' | 'ALTO_RIESGO_TRIBUTARIO';
  scoreGlobal: number; // 0 a 100
  totalComprobantesValidos: number;
  totalComprobantesObjetados: number;
  montoIvaCreditoRecuperable: number;
  montoGastoRechazadoArt21: number;
  alertas: string[];
  recomendaciones: string[];
  verificacionRutDuplicados: boolean;
  resumenTributario: string;
}

export interface ExpenseReport {
  id: string;
  empresaId: string;
  folio: string; // ej: "RDG-2026-001"
  titulo: string;
  rendidorId?: string;
  rendidorNombre: string;
  rendidorRut: string;
  rendidorEmail?: string;
  rendidorCargo?: string;
  centroCostoId?: string;
  centroCostoCodigo?: string;
  centroCostoNombre?: string;
  proyectoId?: string;
  proyectoCodigo?: string;
  proyectoNombre?: string;
  fondoAsignadoClp: number; // Anticipo previo / Fondo por rendir entregado
  montoTotalRendidoClp: number; // Suma comprobantes
  saldoReembolsarClp: number; // Max(0, Rendido - Anticipo)
  saldoReintegrarClp: number; // Max(0, Anticipo - Rendido)
  moneda: 'CLP' | 'USD' | 'EUR' | 'UF';
  estado: ExpenseReportStatus;
  fechaInicio: string;
  fechaCierre: string;
  fechaAprobacion?: string;
  fechaPagoReembolso?: string;
  aprobadorNombre?: string;
  aprobadorEmail?: string;
  observacionesAprobador?: string;
  asientoContableId?: string;
  agenteAuditorScore: number;
  agenteAuditorDiagnostico?: ExpenseAuditDiagnosis;
  comprobantes?: ExpenseItem[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ScannedReceiptResult {
  tipoDocumento: ExpenseDocumentType;
  proveedorRut: string;
  proveedorRazonSocial: string;
  folioDocumento: string;
  fecha: string;
  montoTotalClp: number;
  montoNeto: number;
  montoIva: number;
  montoExento: number;
  categoria: ExpenseCategory;
  descripcionGlosa: string;
  cuentaContableCodigo: string;
  cuentaContableNombre: string;
  esGastoRechazadoArt21: boolean;
  diagnosticoAgente: string;
  confianzaScore?: number;
}




