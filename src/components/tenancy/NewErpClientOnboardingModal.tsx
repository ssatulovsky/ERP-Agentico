import React, { useState } from 'react';
import {
  UserPlus,
  Bot,
  MapPin,
  Scale,
  CreditCard,
  FileCheck,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  X,
  RotateCcw,
  Building,
  Check,
  Calendar,
  Layers,
  ShieldCheck,
  DollarSign,
  ChevronDown
} from 'lucide-react';
import { 
  ClientCompany, 
  ErpSubscriptionPlan, 
  ClientContractInfo, 
  ClientAccountingConfig, 
  ClientCommercialConfig, 
  ClientLocationInfo 
} from '../../types';
import { 
  ERP_SUBSCRIPTION_PLANS, 
  CHILEAN_REGIONS_WITH_COMMUNES 
} from '../../config/erpMasterConfig';
import { STANDARD_ACCOUNT_PLAN, formatCLP, validateRutChileno, formatRutChileno } from '../../utils/chileanAccounting';

interface NewErpClientOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveClient: (client: ClientCompany) => void;
  existingClientsCount: number;
}

export const NewErpClientOnboardingModal: React.FC<NewErpClientOnboardingModalProps> = ({
  isOpen,
  onClose,
  onSaveClient,
  existingClientsCount,
}) => {
  const [activeTab, setActiveTab] = useState<'GENERAL' | 'UBICACION' | 'CONTABILIDAD' | 'COMERCIAL' | 'CONTRATO'>('GENERAL');
  const [selectedPlanId, setSelectedPlanId] = useState<string>('PLAN_PROFESIONAL');
  
  // Voice / AI Prompt input simulation
  const [aiPromptInput, setAiPromptInput] = useState<string>('');
  const [isAiProcessing, setIsAiProcessing] = useState<boolean>(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);

  // Tab 1: GENERAL
  const [codigoAuxiliar, setCodigoAuxiliar] = useState<string>(`CLI-${String(existingClientsCount + 1).padStart(3, '0')}`);
  const [rutEmpresa, setRutEmpresa] = useState<string>('77.543.890-2');
  const [razonSocial, setRazonSocial] = useState<string>('SERVICIOS INDUSTRIALES DEL PACÍFICO SPA');
  const [nombreFantasia, setNombreFantasia] = useState<string>('Pacífico Industrial');
  const [giroComercial, setGiroComercial] = useState<string>('SERVICIOS DE MANTENIMIENTO INDUSTRIAL Y ASESORÍAS TÉCNICAS');
  const [telefono, setTelefono] = useState<string>('+56 9 7845 2200');
  const [emailContacto, setEmailContacto] = useState<string>('contacto@pacificoind.cl');
  const [nombreContacto, setNombreContacto] = useState<string>('Carlos Medina Gómez');
  const [emailDte, setEmailDte] = useState<string>('facturacion@pacificoind.cl');
  const [notasInternas, setNotasInternas] = useState<string>('Cliente transferido para gestión contable tributaria mensual con soporte de facturación electrónica y nómina.');
  const [clienteInactivo, setClienteInactivo] = useState<boolean>(false);

  // Tab 2: UBICACIÓN
  const [direccionComercial, setDireccionComercial] = useState<string>('Av. Vitacura 2909, Of. 602');
  const [pais, setPais] = useState<string>('Chile');
  const [region, setRegion] = useState<string>('Región Metropolitana de Santiago');
  const [ciudad, setCiudad] = useState<string>('Santiago');
  const [comuna, setComuna] = useState<string>('Las Condes');

  // Tab 3: CONTABILIDAD
  const [grupoImpuesto, setGrupoImpuesto] = useState<string>('IVA General 19% (Afecto)');
  const [cuentaCliente, setCuentaCliente] = useState<string>('1.1.03'); // Clientes Nacionales
  const [cuentaVentas, setCuentaVentas] = useState<string>('4.1.01'); // Ingresos por Ventas
  const [cuentaDescVentas, setCuentaDescVentas] = useState<string>('4.1.02'); // Descuentos en Ventas
  const [cuentaRecepcionMercaderias, setCuentaRecepcionMercaderias] = useState<string>('2.1.04'); // Facturas por recibir
  const [cuentaDescPagos, setCuentaDescPagos] = useState<string>('5.2.01'); // Descuentos por pronto pago

  // Tab 4: COMERCIAL
  const [tipoVenta, setTipoVenta] = useState<'Contado' | 'Crédito'>('Crédito');
  const [estadoCredito, setEstadoCredito] = useState<'Sin Crédito' | 'Con Crédito' | 'Bloqueado'>('Con Crédito');
  const [montoCredito, setMontoCredito] = useState<number>(5000000);
  const [terminosPago, setTerminosPago] = useState<string>('30 Días Fecha Factura');
  const [areaVentas, setAreaVentas] = useState<string>('Zona Central');
  const [vendedor, setVendedor] = useState<string>('Andrea Morales (Ejecutiva Senior)');
  const [centroCosto, setCentroCosto] = useState<string>('Operaciones y Mantenimiento');
  const [descuentoPorc, setDescuentoPorc] = useState<number>(0);
  const [descProntoPagoPorc, setDescProntoPagoPorc] = useState<number>(2.5);

  // Tab 5: CONTRATO
  const [licenciasContratadas, setLicenciasContratadas] = useState<number>(1);
  const [numeroContrato, setNumeroContrato] = useState<string>(`CTR-${new Date().getFullYear()}-${String(existingClientsCount + 101).padStart(4, '0')}`);
  const [tipoContrato, setTipoContrato] = useState<'Mensual' | 'Trimestral' | 'Semestral' | 'Anual'>('Mensual');
  const [fechaContrato, setFechaContrato] = useState<string>(new Date().toISOString().split('T')[0]);
  const [duracionDias, setDuracionDias] = useState<number>(365);
  const [diasTolerancia, setDiasTolerancia] = useState<number>(5);
  const [fechaExpiracion, setFechaExpiracion] = useState<string>(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().split('T')[0];
  });
  const [ejecutivoAsignado, setEjecutivoAsignado] = useState<string>('Soporte Directo');
  const [nivelSoporte, setNivelSoporte] = useState<'Básico' | 'Avanzado' | 'Dedicado 24/7'>('Avanzado');

  // Form errors
  const [errors, setErrors] = useState<string[]>([]);

  // Selected plan details
  const selectedPlan = ERP_SUBSCRIPTION_PLANS.find(p => p.id === selectedPlanId) || ERP_SUBSCRIPTION_PLANS[1];

  // Comunas for active region
  const comunasDisponibles = CHILEAN_REGIONS_WITH_COMMUNES.find(r => r.region === region)?.comunas || [];

  if (!isOpen) return null;

  // AI Prompt simulation (e.g. "Crear cliente RUT 76.543.210-K SpA...")
  const handleAiAutoFill = () => {
    setIsAiProcessing(true);
    setTimeout(() => {
      setIsAiProcessing(false);
      setRutEmpresa('76.942.315-8');
      setRazonSocial('INGENIERÍA Y SERVICIOS SUBMARINOS CHILE SPA');
      setNombreFantasia('Subsea Services');
      setGiroComercial('INSPECCIÓN ROBÓTICA SUBMARINA Y MANTENCIÓN DE REDES ACUÍCOLAS');
      setEmailContacto('gerencia@subseaservices.cl');
      setEmailDte('dte@subseaservices.cl');
      setTelefono('+56 65 229 4000');
      setRegion('Región de Los Lagos');
      setCiudad('Puerto Montt');
      setComuna('Puerto Montt');
      setDireccionComercial('Ruta 5 Sur Km 1024, Módulo 8');
      setAiMessage('Datos extraídos del Registro Tributario SII y pre-llenados automáticamente.');
      setTimeout(() => setAiMessage(null), 4000);
    }, 600);
  };

  const handleResetForm = () => {
    setRutEmpresa('');
    setRazonSocial('');
    setNombreFantasia('');
    setGiroComercial('');
    setTelefono('');
    setEmailContacto('');
    setNombreContacto('');
    setEmailDte('');
    setNotasInternas('');
    setErrors([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: string[] = [];

    if (!razonSocial.trim()) {
      newErrors.push('La Razón Social es obligatoria.');
    }
    if (!rutEmpresa.trim()) {
      newErrors.push('El RUT de la empresa es obligatorio.');
    } else if (!validateRutChileno(rutEmpresa)) {
      newErrors.push(`El RUT "${rutEmpresa}" no es válido conforme al Módulo 11 chileno.`);
    }

    if (newErrors.length > 0) {
      setErrors(newErrors);
      return;
    }

    const formattedRut = formatRutChileno(rutEmpresa);

    const newClient: ClientCompany = {
      id: `client-${Date.now()}`,
      rut: formattedRut,
      razonSocial: razonSocial.trim(),
      nombreCorto: nombreFantasia.trim() || razonSocial.split(' ')[0],
      nombreFantasia: nombreFantasia.trim(),
      codigoAuxiliar: codigoAuxiliar.trim(),
      giro: giroComercial.trim(),
      direccion: direccionComercial.trim(),
      comuna: comuna.trim(),
      ciudad: ciudad.trim(),
      regimenTributario: '14D3_PROPYME_GENERAL',
      tasaPpm: 0.01,
      afpMutualTasa: 0.0093,
      bancoPrincipal: 'Banco de Chile',
      numeroCuenta: '00-129481-0',
      contactoNombre: nombreContacto.trim(),
      contactoEmail: emailContacto.trim(),
      contactoTelefono: telefono.trim(),
      emailDte: emailDte.trim(),
      claveSii: '', // 1.2: sin clave de ejemplo; se registra en la bóveda y se verifica con /api/sii/test-login
      rutAutenticacion: formattedRut,
      tipoAutenticacionSii: 'CLAVE_TRIBUTARIA',
      estadoConexionSii: 'PENDIENTE_VERIFICACION',
      ultimoMensajeSii: 'Pendiente de verificar la conexión con el SII.',
      automatizacionesAgente: {
        descargaAutomaticaRcv: true,
        descargaAutomaticaBhe: true,
        alertaPlazo8DiasReclamo: true,
        simulacionF29Automatica: true,
        frecuenciaDescarga: 'DIARIA',
      },
      contextoEspecialAgente: notasInternas.trim(),
      activa: !clienteInactivo,
      inactivo: clienteInactivo,
      manejaInventario: selectedPlan.modulosIncluidos.some(m => m.includes('Inventario')),
      reglaValoracionInventario: 'PMP',
      alertasInventarioAgente: {
        autoReposicion: true,
        alertaStockCritico: true,
        controlGuiasDespacho52: true,
      },
      contrato: {
        planId: selectedPlan.id,
        nombrePlan: selectedPlan.nombre,
        licenciasContratadas,
        limiteUsuarios: selectedPlan.limiteUsuarios,
        limiteEmpresas: selectedPlan.limiteEmpresasContables,
        precioMensualNeto: selectedPlan.precioMensualClp,
        modulosIncluidos: selectedPlan.modulosIncluidos,
        numeroContrato,
        tipoContrato,
        fechaContrato,
        duracionDias,
        diasTolerancia,
        fechaExpiracion,
        ejecutivoAsignado,
        nivelSoporte,
      },
      contabilidadConfig: {
        grupoImpuesto,
        cuentaCliente,
        cuentaVentas,
        cuentaDescVentas,
        cuentaRecepcionMercaderias,
        cuentaDescPagos,
      },
      comercialConfig: {
        tipoVenta,
        estadoCredito,
        montoCredito,
        terminosPago,
        areaVentas,
        vendedor,
        centroCosto,
        descuentoPorcentaje: descuentoPorc,
        descProntoPagoPorcentaje: descProntoPagoPorc,
      },
      ubicacionConfig: {
        direccion: direccionComercial,
        pais,
        region,
        ciudad,
        comuna,
      },
    };

    onSaveClient(newClient);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header matching Page 3 Screenshot */}
        <div className="bg-[#0f172a] text-white px-5 py-3.5 flex items-center justify-between border-b-2 border-blue-600 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-xs">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold tracking-wide uppercase">
                Alta de Nuevo Cliente ERP
              </h2>
              <p className="text-[10px] text-blue-300 font-mono tracking-wider">
                MOTOR DE ONBOARDING MULTITENANT • IFRS CHILE
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-md transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* AI Assistant Banner matching Pages 1, 2, 3 */}
        <div className="bg-blue-50/90 border-b border-blue-100 px-5 py-2 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 text-xs text-blue-900">
            <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="font-bold">Asistente Inteligente: </span>
              <span className="text-slate-600">
                Diga por ejemplo: &quot;Crear cliente RUT 76.543...&quot;
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {aiMessage && (
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded animate-in fade-in">
                {aiMessage}
              </span>
            )}
            <button
              type="button"
              onClick={handleAiAutoFill}
              disabled={isAiProcessing}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 rounded text-xs font-semibold shadow-2xs transition-all cursor-pointer"
            >
              <Sparkles className="w-3 h-3" />
              <span>{isAiProcessing ? 'Consultando SII...' : 'Auto-completar desde SII'}</span>
            </button>
          </div>
        </div>

        {/* Tabs Bar matching Pages 1-3 */}
        <div className="bg-slate-100/80 border-b border-slate-200 px-5 flex items-center gap-1 sm:gap-2 overflow-x-auto shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('GENERAL')}
            className={`px-3 py-2.5 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'GENERAL'
                ? 'border-blue-600 text-blue-700 bg-white shadow-2xs rounded-t-md'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Building className="w-3.5 h-3.5" />
            <span>General</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('UBICACION')}
            className={`px-3 py-2.5 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'UBICACION'
                ? 'border-blue-600 text-blue-700 bg-white shadow-2xs rounded-t-md'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Ubicación</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('CONTABILIDAD')}
            className={`px-3 py-2.5 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'CONTABILIDAD'
                ? 'border-blue-600 text-blue-700 bg-white shadow-2xs rounded-t-md'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>Contabilidad</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('COMERCIAL')}
            className={`px-3 py-2.5 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'COMERCIAL'
                ? 'border-blue-600 text-blue-700 bg-white shadow-2xs rounded-t-md'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Comercial</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('CONTRATO')}
            className={`px-3 py-2.5 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'CONTRATO'
                ? 'border-blue-600 text-blue-700 bg-white shadow-2xs rounded-t-md'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileCheck className="w-3.5 h-3.5" />
            <span>Contrato</span>
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {errors.length > 0 && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-lg text-xs space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>Por favor corrija los siguientes campos:</span>
              </div>
              <ul className="list-disc list-inside space-y-0.5 pl-2">
                {errors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* TAB 1: GENERAL (Matching Page 1) */}
          {activeTab === 'GENERAL' && (
            <div className="space-y-4 animate-in fade-in duration-100">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Código Auxiliar
                  </label>
                  <input
                    type="text"
                    value={codigoAuxiliar}
                    onChange={(e) => setCodigoAuxiliar(e.target.value)}
                    placeholder="Cód. Cliente"
                    className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    RUT (Empresa) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={rutEmpresa}
                    onChange={(e) => setRutEmpresa(e.target.value)}
                    placeholder="12.345.678-9"
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Razón Social <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={razonSocial}
                    onChange={(e) => setRazonSocial(e.target.value)}
                    placeholder="Razón Social Completa"
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Nombre Fantasía
                  </label>
                  <input
                    type="text"
                    value={nombreFantasia}
                    onChange={(e) => setNombreFantasia(e.target.value)}
                    placeholder="Nombre Corto o Fantasía"
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Giro Comercial
                  </label>
                  <input
                    type="text"
                    value={giroComercial}
                    onChange={(e) => setGiroComercial(e.target.value)}
                    placeholder="Actividad Económica / Giro SII"
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Teléfono
                  </label>
                  <input
                    type="text"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="+56 9 ..."
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Email Contacto
                  </label>
                  <input
                    type="email"
                    value={emailContacto}
                    onChange={(e) => setEmailContacto(e.target.value)}
                    placeholder="correo@empresa.cl"
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Nombre Contacto
                  </label>
                  <input
                    type="text"
                    value={nombreContacto}
                    onChange={(e) => setNombreContacto(e.target.value)}
                    placeholder="Representante / Finanzas"
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Email DTE (Facturación Electrónica SII)
                </label>
                <input
                  type="email"
                  value={emailDte}
                  onChange={(e) => setEmailDte(e.target.value)}
                  placeholder="dte@empresa.cl"
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Notas Internas
                </label>
                <textarea
                  rows={3}
                  value={notasInternas}
                  onChange={(e) => setNotasInternas(e.target.value)}
                  placeholder="Comentarios sobre el cliente o el proceso de venta..."
                  className="w-full bg-white border border-slate-300 rounded-md p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="chk-cliente-inactivo-1"
                  checked={clienteInactivo}
                  onChange={(e) => setClienteInactivo(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="chk-cliente-inactivo-1" className="text-xs font-medium text-slate-700 cursor-pointer">
                  Cliente Inactivo
                </label>
              </div>
            </div>
          )}

          {/* TAB 2: UBICACIÓN (Matching Page 1 bottom & Page 5) */}
          {activeTab === 'UBICACION' && (
            <div className="space-y-4 animate-in fade-in duration-100">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Dirección Comercial
                </label>
                <input
                  type="text"
                  value={direccionComercial}
                  onChange={(e) => setDireccionComercial(e.target.value)}
                  placeholder="Calle, Número, Oficina o Galpón"
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    País <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={pais}
                    onChange={(e) => setPais(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="Chile">Chile</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Región <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={region}
                    onChange={(e) => {
                      setRegion(e.target.value);
                      const coms = CHILEAN_REGIONS_WITH_COMMUNES.find(r => r.region === e.target.value)?.comunas;
                      if (coms && coms.length > 0) {
                        setComuna(coms[0]);
                      }
                    }}
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {CHILEAN_REGIONS_WITH_COMMUNES.map((r) => (
                      <option key={r.region} value={r.region}>
                        {r.region}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Ciudad <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={ciudad}
                    onChange={(e) => setCiudad(e.target.value)}
                    placeholder="Ciudad"
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Comuna <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={comuna}
                    onChange={(e) => setComuna(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {comunasDisponibles.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Notas Internas
                </label>
                <textarea
                  rows={3}
                  value={notasInternas}
                  onChange={(e) => setNotasInternas(e.target.value)}
                  placeholder="Comentarios sobre el cliente o el proceso de venta..."
                  className="w-full bg-white border border-slate-300 rounded-md p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="chk-cliente-inactivo-2"
                  checked={clienteInactivo}
                  onChange={(e) => setClienteInactivo(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="chk-cliente-inactivo-2" className="text-xs font-medium text-slate-700 cursor-pointer">
                  Cliente Inactivo
                </label>
              </div>
            </div>
          )}

          {/* TAB 3: CONTABILIDAD (Matching Page 2 top & Page 6) */}
          {activeTab === 'CONTABILIDAD' && (
            <div className="space-y-4 animate-in fade-in duration-100">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Grupo de Impuesto <span className="text-rose-500">*</span>
                </label>
                <select
                  value={grupoImpuesto}
                  onChange={(e) => setGrupoImpuesto(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="IVA General 19% (Afecto)">IVA General 19% (Afecto DL 825)</option>
                  <option value="Servicios Exentos Art. 12 DL 825">Servicios Profesionales / Exentos Art. 12 Letra E</option>
                  <option value="Honorarios 14.5% (Retención)">Honorarios 2da Categoría (14.5%)</option>
                  <option value="Exportación 0% (Factura 110)">Exportación y Faenas Especiales (0% IVA)</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Cuenta Cliente (Cuentas por Cobrar)
                  </label>
                  <select
                    value={cuentaCliente}
                    onChange={(e) => setCuentaCliente(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {STANDARD_ACCOUNT_PLAN.filter(a => a.tipo === 'ACTIVO').map(a => (
                      <option key={a.codigo} value={a.codigo}>
                        {a.codigo} - {a.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Cuenta Ventas (Cuenta Ingresos)
                  </label>
                  <select
                    value={cuentaVentas}
                    onChange={(e) => setCuentaVentas(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {STANDARD_ACCOUNT_PLAN.filter(a => a.tipo === 'INGRESO').map(a => (
                      <option key={a.codigo} value={a.codigo}>
                        {a.codigo} - {a.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Cuenta Desc. Ventas (Cuenta de Ajuste)
                  </label>
                  <select
                    value={cuentaDescVentas}
                    onChange={(e) => setCuentaDescVentas(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {STANDARD_ACCOUNT_PLAN.map(a => (
                      <option key={a.codigo} value={a.codigo}>
                        {a.codigo} - {a.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Cuenta Recepción Mercaderías (Cuentas Puentes)
                  </label>
                  <select
                    value={cuentaRecepcionMercaderias}
                    onChange={(e) => setCuentaRecepcionMercaderias(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {STANDARD_ACCOUNT_PLAN.map(a => (
                      <option key={a.codigo} value={a.codigo}>
                        {a.codigo} - {a.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Cuenta Desc. Pagos (Gastos Financieros)
                  </label>
                  <select
                    value={cuentaDescPagos}
                    onChange={(e) => setCuentaDescPagos(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {STANDARD_ACCOUNT_PLAN.filter(a => a.tipo === 'GASTO' || a.tipo === 'COSTO').map(a => (
                      <option key={a.codigo} value={a.codigo}>
                        {a.codigo} - {a.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Notas Internas
                </label>
                <textarea
                  rows={2}
                  value={notasInternas}
                  onChange={(e) => setNotasInternas(e.target.value)}
                  placeholder="Comentarios sobre el cliente o el proceso de venta..."
                  className="w-full bg-white border border-slate-300 rounded-md p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="chk-cliente-inactivo-3"
                  checked={clienteInactivo}
                  onChange={(e) => setClienteInactivo(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="chk-cliente-inactivo-3" className="text-xs font-medium text-slate-700 cursor-pointer">
                  Cliente Inactivo
                </label>
              </div>
            </div>
          )}

          {/* TAB 4: COMERCIAL (Matching Page 2 bottom & Page 7) */}
          {activeTab === 'COMERCIAL' && (
            <div className="space-y-4 animate-in fade-in duration-100">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Tipo Venta
                  </label>
                  <select
                    value={tipoVenta}
                    onChange={(e) => setTipoVenta(e.target.value as any)}
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="Contado">Contado</option>
                    <option value="Crédito">Crédito</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Estado Crédito
                  </label>
                  <select
                    value={estadoCredito}
                    onChange={(e) => setEstadoCredito(e.target.value as any)}
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="Sin Crédito">Sin Crédito</option>
                    <option value="Con Crédito">Con Crédito</option>
                    <option value="Bloqueado">Bloqueado</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Monto Crédito ($ CLP)
                  </label>
                  <input
                    type="number"
                    value={montoCredito}
                    onChange={(e) => setMontoCredito(Number(e.target.value))}
                    placeholder="Monto Crédito CLP"
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Términos de Pago (Plazo)
                  </label>
                  <input
                    type="text"
                    value={terminosPago}
                    onChange={(e) => setTerminosPago(e.target.value)}
                    placeholder="Plazo de Pago (ej: 30 Días)"
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Área de Ventas (Zona)
                  </label>
                  <select
                    value={areaVentas}
                    onChange={(e) => setAreaVentas(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="Zona Norte">Zona Norte</option>
                    <option value="Zona Central">Zona Central</option>
                    <option value="Zona Sur">Zona Sur</option>
                    <option value="Zona Austral">Zona Austral</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Vendedor (Ejecutivo)
                  </label>
                  <input
                    type="text"
                    value={vendedor}
                    onChange={(e) => setVendedor(e.target.value)}
                    placeholder="Seleccione Ejecutivo"
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Centro de Costo
                  </label>
                  <input
                    type="text"
                    value={centroCosto}
                    onChange={(e) => setCentroCosto(e.target.value)}
                    placeholder="Asignar C. Costo"
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Descuento (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={descuentoPorc}
                    onChange={(e) => setDescuentoPorc(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Desc. Pronto Pago (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={descProntoPagoPorc}
                    onChange={(e) => setDescProntoPagoPorc(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Notas Internas
                </label>
                <textarea
                  rows={2}
                  value={notasInternas}
                  onChange={(e) => setNotasInternas(e.target.value)}
                  placeholder="Comentarios sobre el cliente o el proceso de venta..."
                  className="w-full bg-white border border-slate-300 rounded-md p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="chk-cliente-inactivo-4"
                  checked={clienteInactivo}
                  onChange={(e) => setClienteInactivo(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="chk-cliente-inactivo-4" className="text-xs font-medium text-slate-700 cursor-pointer">
                  Cliente Inactivo
                </label>
              </div>
            </div>
          )}

          {/* TAB 5: CONTRATO (Matching Page 3 & Page 8) */}
          {activeTab === 'CONTRATO' && (
            <div className="space-y-4 animate-in fade-in duration-100">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Plan Contratado <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={selectedPlanId}
                    onChange={(e) => setSelectedPlanId(e.target.value)}
                    className="w-full bg-blue-50 border border-blue-300 text-blue-900 font-extrabold rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {ERP_SUBSCRIPTION_PLANS.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        ✔ {plan.nombre.toUpperCase()} — {formatCLP(plan.precioMensualClp)} + IVA / mes
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Licencias Contratadas
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={licenciasContratadas}
                    onChange={(e) => setLicenciasContratadas(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Exact Card matching Page 3 Screenshot */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <CheckCircle2 className="w-4 h-4 text-blue-600" />
                  <span>Características del {selectedPlan.nombre}</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Límite Usuarios</span>
                    <span className="font-extrabold text-slate-800 text-sm">{selectedPlan.limiteUsuarios}</span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Gestión Empresas</span>
                    <span className="font-extrabold text-slate-800 text-sm">{selectedPlan.limiteEmpresasContables} contables</span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Módulos Incluidos</span>
                    <span className="font-medium text-slate-700 text-xs truncate block">{selectedPlan.modulosIncluidos.join(', ')}</span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Referencia Mensual</span>
                    <span className="font-extrabold text-blue-700 text-sm">{selectedPlan.referenciaTexto}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Nº Contrato
                  </label>
                  <input
                    type="text"
                    value={numeroContrato}
                    onChange={(e) => setNumeroContrato(e.target.value)}
                    placeholder="CTR-2026-0042"
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Tipo Contrato (Ciclo)
                  </label>
                  <select
                    value={tipoContrato}
                    onChange={(e) => setTipoContrato(e.target.value as any)}
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="Mensual">Mensual</option>
                    <option value="Trimestral">Trimestral</option>
                    <option value="Semestral">Semestral</option>
                    <option value="Anual">Anual</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Fecha Contrato
                  </label>
                  <input
                    type="date"
                    value={fechaContrato}
                    onChange={(e) => setFechaContrato(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Duración (Días)
                  </label>
                  <input
                    type="number"
                    value={duracionDias}
                    onChange={(e) => setDuracionDias(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Días Tolerancia
                  </label>
                  <input
                    type="number"
                    value={diasTolerancia}
                    onChange={(e) => setDiasTolerancia(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Fecha Expiración
                  </label>
                  <input
                    type="date"
                    value={fechaExpiracion}
                    onChange={(e) => setFechaExpiracion(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Ejecutivo Asignado <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={ejecutivoAsignado}
                    onChange={(e) => setEjecutivoAsignado(e.target.value)}
                    placeholder="Soporte Directo"
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Nivel de Soporte <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={nivelSoporte}
                    onChange={(e) => setNivelSoporte(e.target.value as any)}
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="Básico">Básico (Email 24h)</option>
                    <option value="Avanzado">Avanzado (Chat & Teléfono prioritario)</option>
                    <option value="Dedicado 24/7">Dedicado 24/7 (SLA Crítico)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Notas Internas
                </label>
                <textarea
                  rows={2}
                  value={notasInternas}
                  onChange={(e) => setNotasInternas(e.target.value)}
                  placeholder="Comentarios sobre el cliente o el proceso de venta..."
                  className="w-full bg-white border border-slate-300 rounded-md p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="chk-cliente-inactivo-5"
                  checked={clienteInactivo}
                  onChange={(e) => setClienteInactivo(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="chk-cliente-inactivo-5" className="text-xs font-medium text-slate-700 cursor-pointer">
                  Cliente Inactivo
                </label>
              </div>
            </div>
          )}

          {/* Modal Footer matching Pages 1, 2, 3 buttons */}
          <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleResetForm}
                className="text-xs text-slate-500 hover:text-slate-800 font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Limpiar</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="text-xs text-slate-500 hover:text-slate-800 font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancelar</span>
              </button>
            </div>

            <button
              type="submit"
              className="bg-[#0f172a] hover:bg-slate-800 text-white px-6 py-2 rounded-md text-xs font-extrabold uppercase tracking-wider shadow-sm transition-all flex items-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Guardar Cliente</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
