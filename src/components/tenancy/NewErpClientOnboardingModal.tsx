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
import { formatCLP, validateRutChileno, formatRutChileno } from '../../utils/chileanAccounting';
import { isDemoModeEnabled } from '../../config/demoMode';

interface NewErpClientOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveClient: (client: ClientCompany) => void;
  existingClientsCount: number;
  /** K3: el SuperAdmin elige el cliente ERP de la empresa; un administrador la registra en el suyo. */
  isSuperAdmin?: boolean;
  saasAccounts?: Array<{ id: string; razonSocial: string; consumo?: { empresas: number; limiteEmpresas: number }; esPropietario?: boolean }>;
}

export const NewErpClientOnboardingModal: React.FC<NewErpClientOnboardingModalProps> = ({
  isOpen,
  onClose,
  onSaveClient,
  existingClientsCount,
  isSuperAdmin,
  saasAccounts = [],
}) => {
  const [clienteErpId, setClienteErpId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'GENERAL' | 'UBICACION' | 'CONTABILIDAD' | 'COMERCIAL' | 'CONTRATO'>('GENERAL');
  const [selectedPlanId, setSelectedPlanId] = useState<string>('PLAN_PROFESIONAL');
  
  // Voice / AI Prompt input simulation
  const [aiPromptInput, setAiPromptInput] = useState<string>('');
  const [isAiProcessing, setIsAiProcessing] = useState<boolean>(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);

  // Tab 1: GENERAL
  const [codigoAuxiliar, setCodigoAuxiliar] = useState<string>(`CLI-${String(existingClientsCount + 1).padStart(3, '0')}`);
  const [rutEmpresa, setRutEmpresa] = useState<string>('');
  const [razonSocial, setRazonSocial] = useState<string>('');
  const [nombreFantasia, setNombreFantasia] = useState<string>('');
  const [giroComercial, setGiroComercial] = useState<string>('');
  const [telefono, setTelefono] = useState<string>('');
  const [emailContacto, setEmailContacto] = useState<string>('');
  const [nombreContacto, setNombreContacto] = useState<string>('');
  const [emailDte, setEmailDte] = useState<string>('');
  const [notasInternas, setNotasInternas] = useState<string>('');
  const [clienteInactivo, setClienteInactivo] = useState<boolean>(false);
  // K1.4: régimen y tasa PPM los informa el usuario (antes: 14 D3 y 1 % fijos)
  const [regimenTributario, setRegimenTributario] = useState<'' | ClientCompany['regimenTributario']>('');
  const [tasaPpmPorc, setTasaPpmPorc] = useState<string>('');

  // Tab 2: UBICACIÓN
  const [direccionComercial, setDireccionComercial] = useState<string>('');
  const [pais, setPais] = useState<string>('Chile');
  const [region, setRegion] = useState<string>('');
  const [ciudad, setCiudad] = useState<string>('');
  const [comuna, setComuna] = useState<string>('');

  // Tab 3: CONTABILIDAD
  const [grupoImpuesto, setGrupoImpuesto] = useState<string>('');
  const [cuentaCliente, setCuentaCliente] = useState<string>('')
  const [cuentaVentas, setCuentaVentas] = useState<string>('')
  const [cuentaDescVentas, setCuentaDescVentas] = useState<string>('')
  const [cuentaRecepcionMercaderias, setCuentaRecepcionMercaderias] = useState<string>('')
  const [cuentaDescPagos, setCuentaDescPagos] = useState<string>('')

  // Tab 4: COMERCIAL
  const [tipoVenta, setTipoVenta] = useState<'Contado' | 'Crédito'>('Contado');
  const [estadoCredito, setEstadoCredito] = useState<'Sin Crédito' | 'Con Crédito' | 'Bloqueado'>('Sin Crédito');
  const [montoCredito, setMontoCredito] = useState<number>(0);
  const [terminosPago, setTerminosPago] = useState<string>('');
  const [areaVentas, setAreaVentas] = useState<string>('');
  const [vendedor, setVendedor] = useState<string>('');
  const [centroCosto, setCentroCosto] = useState<string>('');
  const [descuentoPorc, setDescuentoPorc] = useState<number>(0);
  const [descProntoPagoPorc, setDescProntoPagoPorc] = useState<number>(0);

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
    if (!isDemoModeEnabled()) return;
    {
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
      setAiMessage('Datos de ejemplo cargados (modo demostración).');
      setTimeout(() => setAiMessage(null), 4000);
    }
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
    setDireccionComercial('');
    setRegion('');
    setCiudad('');
    setComuna('');
    setRegimenTributario('');
    setTasaPpmPorc('');
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

    if (!giroComercial.trim()) newErrors.push('El giro comercial es obligatorio (se usa en la emisión de DTE).');
    if (!direccionComercial.trim() || !comuna.trim()) newErrors.push('La dirección y la comuna son obligatorias (se usan en la emisión de DTE).');
    if (!regimenTributario) newErrors.push('Debe indicar el régimen tributario de la empresa.');
    if (isSuperAdmin && !clienteErpId) newErrors.push('Seleccione el cliente ERP al que pertenece la empresa (pestaña Cliente ERP).');
    const ppm = Number(String(tasaPpmPorc).replace(',', '.'));
    if (tasaPpmPorc.trim() === '' || !Number.isFinite(ppm) || ppm < 0 || ppm > 100) {
      newErrors.push('Debe indicar la tasa de PPM en porcentaje (puede ser 0).');
    }

    if (newErrors.length > 0) {
      setErrors(newErrors);
      return;
    }

    const formattedRut = formatRutChileno(rutEmpresa);

    const newClient: ClientCompany = {
      // El id de la empresa es su RUT sin puntos (igual que el instalador): así id y RUT coinciden en el servidor.
      id: formattedRut.replace(/\./g, '').toUpperCase(),
      rut: formattedRut,
      razonSocial: razonSocial.trim(),
      nombreCorto: nombreFantasia.trim() || razonSocial.split(' ')[0],
      nombreFantasia: nombreFantasia.trim(),
      codigoAuxiliar: codigoAuxiliar.trim(),
      giro: giroComercial.trim(),
      direccion: direccionComercial.trim(),
      comuna: comuna.trim(),
      ciudad: ciudad.trim(),
      regimenTributario: regimenTributario as ClientCompany['regimenTributario'],
      tasaPpm: ppm / 100,
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
      manejaInventario: false,
      reglaValoracionInventario: 'PMP',
      alertasInventarioAgente: {
        autoReposicion: true,
        alertaStockCritico: true,
        controlGuiasDespacho52: true,
      },
      // K3: plan, contrato y límites viven en el cliente ERP (no en cada empresa).
      ...(isSuperAdmin && clienteErpId ? { clienteErpId } : {}),
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
            {/* 4.4: no hay consulta real al SII; el autollenado con datos de ejemplo solo existe en DEMO_MODE */}
            {isDemoModeEnabled() && (
            <button
              type="button"
              onClick={handleAiAutoFill}
              disabled={isAiProcessing}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 rounded text-xs font-semibold shadow-2xs transition-all cursor-pointer"
            >
              <Sparkles className="w-3 h-3" />
              <span>Datos de ejemplo (demostración)</span>
            </button>
            )}
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
            <span>Cliente ERP</span>
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Régimen Tributario <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={regimenTributario}
                    onChange={(e) => setRegimenTributario(e.target.value as any)}
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Seleccione…</option>
                    <option value="14D3_PROPYME_GENERAL">Pro Pyme General (14 D N°3)</option>
                    <option value="14D8_PROPYME_TRANSPARENTE">Pro Pyme Transparente (14 D N°8)</option>
                    <option value="14A_SEMI_INTEGRADO">Régimen General Semi Integrado (14 A)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Tasa PPM (%) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={tasaPpmPorc}
                    onChange={(e) => setTasaPpmPorc(e.target.value)}
                    placeholder="Ej: 0,25"
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
                      setComuna('');
                    }}
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Seleccione…</option>
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
                    <option value="">Seleccione…</option>
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
                  <option value="">Seleccione…</option>
                  <option value="IVA General 19% (Afecto)">IVA General 19% (Afecto DL 825)</option>
                  <option value="Servicios Exentos Art. 12 DL 825">Servicios Profesionales / Exentos Art. 12 Letra E</option>
                  <option value="Honorarios 14.5% (Retención)">Honorarios 2da Categoría (14.5%)</option>
                  <option value="Exportación 0% (Factura 110)">Exportación y Faenas Especiales (0% IVA)</option>
                </select>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-[11px] text-blue-900">
                Las cuentas contables (clientes, ventas, proveedores, descuentos…) se eligen del plan de cuentas de
                esta empresa en <strong>Parámetros de sistema</strong>, una vez creado el plan. Al terminar el alta se
                elige de dónde sale el plan: plantilla estándar, copia de otra empresa o importación desde el sistema anterior.
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
            <div className="space-y-3 animate-in fade-in duration-100 text-xs">
              {isSuperAdmin ? (
                <>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Cliente ERP <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={clienteErpId}
                    onChange={(e) => setClienteErpId(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Seleccione…</option>
                    {saasAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.razonSocial}
                        {a.esPropietario ? ' (empresa dueña del ERP)' : a.consumo ? ` · ${a.consumo.empresas}/${a.consumo.limiteEmpresas} empresas` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-slate-500">
                    El plan, el contrato, los límites y la cobranza se administran en <strong>Clientes ERP y cobranza</strong>. Si el cliente
                    alcanzó su límite de empresas, el servidor rechaza el alta.
                  </p>
                </>
              ) : (
                <p className="bg-blue-50 border border-blue-200 rounded-md p-3 text-blue-900">
                  La empresa se registra en su cliente ERP y cuenta para el límite de empresas de su plan.
                </p>
              )}
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
