import React, { useState, useEffect } from 'react';
import {
  Anchor,
  Key,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  X,
  FileText,
  MapPin,
  Scale,
  CreditCard,
  Layers,
  Sparkles,
  Building2,
  Check
} from 'lucide-react';
import { ClientCompany } from '../../types';
import { 
  ERP_SUBSCRIPTION_PLANS, 
  CHILEAN_REGIONS_WITH_COMMUNES 
} from '../../config/erpMasterConfig';
import { STANDARD_ACCOUNT_PLAN, formatCLP, validateRutChileno, formatRutChileno } from '../../utils/chileanAccounting';

interface AnchorClientMasterModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: ClientCompany | null;
  onSaveMasterClient: (updatedClient: ClientCompany) => void;
}

export const AnchorClientMasterModal: React.FC<AnchorClientMasterModalProps> = ({
  isOpen,
  onClose,
  client,
  onSaveMasterClient,
}) => {
  const [activeTab, setActiveTab] = useState<'DATOS' | 'UBICACION' | 'CONTABILIDAD' | 'COMERCIAL' | 'CONTRATO'>('DATOS');
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [accessConfigModalOpen, setAccessConfigModalOpen] = useState(false);
  const [tempPassword, setTempPassword] = useState<string>('');

  // Tab 1: DATOS DEL CLIENTE
  const [rutClaveTributaria, setRutClaveTributaria] = useState<string>('');
  const [codigoAuxiliar, setCodigoAuxiliar] = useState<string>('');
  const [razonSocial, setRazonSocial] = useState<string>('');
  const [nombreFantasia, setNombreFantasia] = useState<string>('');
  const [giro, setGiro] = useState<string>('');
  const [telefono, setTelefono] = useState<string>('');
  const [emailContacto, setEmailContacto] = useState<string>('');
  const [nombreContacto, setNombreContacto] = useState<string>('');
  const [emailDte, setEmailDte] = useState<string>('');
  const [notasInternas, setNotasInternas] = useState<string>('');
  const [inactivo, setInactivo] = useState<boolean>(false);

  // Tab 2: UBICACIÓN
  const [direccion, setDireccion] = useState<string>('');
  const [pais, setPais] = useState<string>('Chile');
  const [region, setRegion] = useState<string>('Región Metropolitana de Santiago');
  const [ciudad, setCiudad] = useState<string>('Santiago');
  const [comuna, setComuna] = useState<string>('Providencia');

  // Tab 3: CONTABILIDAD
  const [grupoImpuesto, setGrupoImpuesto] = useState<string>('IVA General 19% (Afecto)');
  const [cuentaCliente, setCuentaCliente] = useState<string>('1.1.03');
  const [cuentaVentas, setCuentaVentas] = useState<string>('4.1.01');
  const [cuentaDescVentas, setCuentaDescVentas] = useState<string>('4.1.02');
  const [cuentaRecepcionMercaderias, setCuentaRecepcionMercaderias] = useState<string>('2.1.04');
  const [cuentaDescPagos, setCuentaDescPagos] = useState<string>('5.2.01');

  // Tab 4: COMERCIAL
  const [tipoVenta, setTipoVenta] = useState<'Contado' | 'Crédito'>('Contado');
  const [estadoCredito, setEstadoCredito] = useState<'Sin Crédito' | 'Con Crédito' | 'Bloqueado'>('Sin Crédito');
  const [montoCredito, setMontoCredito] = useState<number>(0);
  const [terminosPago, setTerminosPago] = useState<string>('Contado Inmediato');
  const [areaVentas, setAreaVentas] = useState<string>('Zona Central');
  const [vendedor, setVendedor] = useState<string>('Ejecutivo Asignado');
  const [centroCosto, setCentroCosto] = useState<string>('Centro Principal');
  const [descuentoPorc, setDescuentoPorc] = useState<number>(0);
  const [descProntoPagoPorc, setDescProntoPagoPorc] = useState<number>(0);

  // Tab 5: CONTRATO Y LICENCIAS
  const [planContratadoId, setPlanContratadoId] = useState<string>('PLAN_PROFESIONAL');
  const [licenciasContratadas, setLicenciasContratadas] = useState<number>(1);
  const [numeroContrato, setNumeroContrato] = useState<string>('CTR-2026-0042');
  const [tipoContrato, setTipoContrato] = useState<'Mensual' | 'Anual'>('Mensual');
  const [fechaContrato, setFechaContrato] = useState<string>('2026-01-01');
  const [duracionDias, setDuracionDias] = useState<number>(365);
  const [diasTolerancia, setDiasTolerancia] = useState<number>(5);
  const [fechaExpiracion, setFechaExpiracion] = useState<string>('2026-12-31');
  const [ejecutivoCuenta, setEjecutivoCuenta] = useState<string>('Soporte Directo');
  const [nivelSoporte, setNivelSoporte] = useState<'Básico' | 'Avanzado' | 'Dedicado 24/7'>('Básico');

  // Load client data if provided
  useEffect(() => {
    if (client) {
      setRutClaveTributaria(client.rut || '');
      setCodigoAuxiliar(client.codigoAuxiliar || `CLI-${client.id.substring(0, 6)}`);
      setRazonSocial(client.razonSocial || '');
      setNombreFantasia(client.nombreFantasia || client.nombreCorto || '');
      setGiro(client.giro || '');
      setTelefono(client.contactoTelefono || '');
      setEmailContacto(client.contactoEmail || '');
      setNombreContacto(client.contactoNombre || '');
      setEmailDte(client.emailDte || client.contactoEmail || '');
      setNotasInternas(client.notasInternas || client.contextoEspecialAgente || '');
      setInactivo(Boolean(client.inactivo));

      setDireccion(client.direccion || client.ubicacionConfig?.direccion || '');
      setPais(client.ubicacionConfig?.pais || 'Chile');
      setRegion(client.ubicacionConfig?.region || 'Región Metropolitana de Santiago');
      setCiudad(client.ciudad || client.ubicacionConfig?.ciudad || 'Santiago');
      setComuna(client.comuna || client.ubicacionConfig?.comuna || 'Providencia');

      if (client.contabilidadConfig) {
        setGrupoImpuesto(client.contabilidadConfig.grupoImpuesto || 'IVA General 19% (Afecto)');
        setCuentaCliente(client.contabilidadConfig.cuentaCliente || '1.1.03');
        setCuentaVentas(client.contabilidadConfig.cuentaVentas || '4.1.01');
        setCuentaDescVentas(client.contabilidadConfig.cuentaDescVentas || '4.1.02');
        setCuentaRecepcionMercaderias(client.contabilidadConfig.cuentaRecepcionMercaderias || '2.1.04');
        setCuentaDescPagos(client.contabilidadConfig.cuentaDescPagos || '5.2.01');
      }

      if (client.comercialConfig) {
        setTipoVenta(client.comercialConfig.tipoVenta || 'Contado');
        setEstadoCredito(client.comercialConfig.estadoCredito || 'Sin Crédito');
        setMontoCredito(client.comercialConfig.montoCredito || 0);
        setTerminosPago(client.comercialConfig.terminosPago || 'Contado Inmediato');
        setAreaVentas(client.comercialConfig.areaVentas || 'Zona Central');
        setVendedor(client.comercialConfig.vendedor || 'Ejecutivo Asignado');
        setCentroCosto(client.comercialConfig.centroCosto || 'Centro Principal');
        setDescuentoPorc(client.comercialConfig.descuentoPorcentaje || 0);
        setDescProntoPagoPorc(client.comercialConfig.descProntoPagoPorcentaje || 0);
      }

      if (client.contrato) {
        setPlanContratadoId(client.contrato.planId || 'PLAN_PROFESIONAL');
        setLicenciasContratadas(client.contrato.licenciasContratadas || 1);
        setNumeroContrato(client.contrato.numeroContrato || 'CTR-2026-0042');
        setTipoContrato(client.contrato.tipoContrato === 'Anual' ? 'Anual' : 'Mensual');
        setFechaContrato(client.contrato.fechaContrato || '2026-01-01');
        setDuracionDias(client.contrato.duracionDias || 365);
        setDiasTolerancia(client.contrato.diasTolerancia || 5);
        setFechaExpiracion(client.contrato.fechaExpiracion || '2026-12-31');
        setEjecutivoCuenta(client.contrato.ejecutivoAsignado || 'Soporte Directo');
        setNivelSoporte(client.contrato.nivelSoporte || 'Básico');
      }
    }
  }, [client]);

  if (!isOpen) return null;

  const comunasDisponibles = CHILEAN_REGIONS_WITH_COMMUNES.find(r => r.region === region)?.comunas || [];
  const selectedPlan = ERP_SUBSCRIPTION_PLANS.find(p => p.id === planContratadoId) || ERP_SUBSCRIPTION_PLANS[1];

  const handleGenerateInitialAccess = () => {
    const pass = `Daibuda#${Math.floor(1000 + Math.random() * 9000)}`;
    setTempPassword(pass);
    setAccessConfigModalOpen(true);
  };

  const handleReset = () => {
    setRutClaveTributaria('');
    setCodigoAuxiliar('');
    setRazonSocial('');
    setNombreFantasia('');
    setGiro('');
    setTelefono('');
    setEmailContacto('');
    setNombreContacto('');
    setEmailDte('');
    setNotasInternas('');
    setInactivo(false);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!razonSocial.trim()) {
      alert('Debe ingresar la Razón Social.');
      return;
    }

    const updated: ClientCompany = {
      ...(client || {
        id: `client-${Date.now()}`,
        tasaPpm: 0.01,
        afpMutualTasa: 0.0093,
        regimenTributario: '14D3_PROPYME_GENERAL',
        bancoPrincipal: 'Banco Santander Chile',
        numeroCuenta: '00-000000-0',
        claveSii: '', // 1.2: sin clave de ejemplo; se registra en la bóveda y se verifica con /api/sii/test-login
        rutAutenticacion: rutClaveTributaria,
        tipoAutenticacionSii: 'CLAVE_TRIBUTARIA',
        estadoConexionSii: 'PENDIENTE_VERIFICACION',
        automatizacionesAgente: {
          descargaAutomaticaRcv: true,
          descargaAutomaticaBhe: true,
          alertaPlazo8DiasReclamo: true,
          simulacionF29Automatica: true,
          frecuenciaDescarga: 'DIARIA',
        },
        contextoEspecialAgente: '',
        activa: true,
        manejaInventario: false,
      }),
      rut: formatRutChileno(rutClaveTributaria || client?.rut || '76.123.456-7'),
      razonSocial: razonSocial.trim(),
      nombreCorto: nombreFantasia.trim() || razonSocial.split(' ')[0],
      nombreFantasia: nombreFantasia.trim(),
      codigoAuxiliar: codigoAuxiliar.trim(),
      giro: giro.trim(),
      direccion: direccion.trim(),
      comuna: comuna.trim(),
      ciudad: ciudad.trim(),
      contactoNombre: nombreContacto.trim(),
      contactoEmail: emailContacto.trim(),
      contactoTelefono: telefono.trim(),
      emailDte: emailDte.trim(),
      notasInternas: notasInternas.trim(),
      inactivo: inactivo,
      activa: !inactivo,
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
        ejecutivoAsignado: ejecutivoCuenta,
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
        direccion,
        pais,
        region,
        ciudad,
        comuna,
      },
    };

    onSaveMasterClient(updated);
    setShowSuccessToast(true);
    setTimeout(() => {
      setShowSuccessToast(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header matching Pages 4-8: Teal Anchor Banner */}
        <div className="bg-[#0b192c] text-white px-5 py-3.5 flex items-center justify-between border-b-2 border-emerald-500 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-xs">
              <Anchor className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold tracking-wide uppercase">
                Ficha Cliente Ancla
              </h2>
              <p className="text-[10px] text-emerald-300 font-mono tracking-wider">
                SUPERADMINISTRACIÓN ERP DAIBUDA
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleGenerateInitialAccess}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-600 px-3 py-1.5 rounded-md text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Key className="w-3.5 h-3.5 text-emerald-400" />
              <span>Configurar Acceso Inicial</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-md transition-colors cursor-pointer ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Access Dialog if triggered */}
        {accessConfigModalOpen && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-5 py-2.5 flex items-center justify-between text-xs text-emerald-900 animate-in fade-in">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Acceso inicial habilitado para <strong>{rutClaveTributaria || 'RUT Cliente'}</strong>. Clave provisoria:{' '}
                <code className="bg-white px-2 py-0.5 rounded font-mono font-bold text-slate-800 border border-emerald-300">
                  {tempPassword}
                </code>
              </span>
            </div>
            <button
              onClick={() => setAccessConfigModalOpen(false)}
              className="text-emerald-700 hover:text-emerald-900 font-bold text-[11px] uppercase cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        )}

        {/* 5 Tabs matching Pages 4-8 */}
        <div className="bg-slate-100/90 border-b border-slate-200 px-5 flex items-center gap-1 sm:gap-2 overflow-x-auto shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('DATOS')}
            className={`px-3 py-2.5 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'DATOS'
                ? 'border-emerald-600 text-emerald-800 bg-white shadow-2xs rounded-t-md'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Datos del Cliente</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('UBICACION')}
            className={`px-3 py-2.5 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'UBICACION'
                ? 'border-emerald-600 text-emerald-800 bg-white shadow-2xs rounded-t-md'
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
                ? 'border-emerald-600 text-emerald-800 bg-white shadow-2xs rounded-t-md'
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
                ? 'border-emerald-600 text-emerald-800 bg-white shadow-2xs rounded-t-md'
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
                ? 'border-emerald-600 text-emerald-800 bg-white shadow-2xs rounded-t-md'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Contrato y Licencias</span>
          </button>
        </div>

        {/* Tab Content Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* TAB 1: DATOS DEL CLIENTE (Matching Page 4) */}
          {activeTab === 'DATOS' && (
            <div className="space-y-4 animate-in fade-in duration-100">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    RUT (Clave Tributaria) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={rutClaveTributaria}
                    onChange={(e) => setRutClaveTributaria(e.target.value)}
                    placeholder="Ej: 76.123.456-7"
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Código Auxiliar
                  </label>
                  <input
                    type="text"
                    value={codigoAuxiliar}
                    onChange={(e) => setCodigoAuxiliar(e.target.value)}
                    placeholder="Código Auxiliar"
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
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
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  required
                />
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
                    placeholder="Nombre Fantasía"
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Giro
                  </label>
                  <input
                    type="text"
                    value={giro}
                    onChange={(e) => setGiro(e.target.value)}
                    placeholder="Giro o Actividad Económica"
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Teléfono
                  </label>
                  <input
                    type="text"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="+56 9 ..."
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
                    placeholder="contacto@cliente.cl"
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Nombre Contacto
                  </label>
                  <input
                    type="text"
                    value={nombreContacto}
                    onChange={(e) => setNombreContacto(e.target.value)}
                    placeholder="Nombre Persona Contacto"
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Email DTE
                  </label>
                  <input
                    type="email"
                    value={emailDte}
                    onChange={(e) => setEmailDte(e.target.value)}
                    placeholder="dte@cliente.cl"
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
                  placeholder="Observaciones de contrato o requerimientos especiales..."
                  className="w-full bg-white border border-slate-300 rounded-md p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>
          )}

          {/* TAB 2: UBICACIÓN (Matching Page 5) */}
          {activeTab === 'UBICACION' && (
            <div className="space-y-4 animate-in fade-in duration-100">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Dirección
                </label>
                <input
                  type="text"
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                  placeholder="Dirección completa"
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
                      if (coms && coms.length > 0) setComuna(coms[0]);
                    }}
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Comuna <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={comuna}
                    onChange={(e) => setComuna(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
                  rows={2}
                  value={notasInternas}
                  onChange={(e) => setNotasInternas(e.target.value)}
                  placeholder="Observaciones de contrato o requerimientos especiales..."
                  className="w-full bg-white border border-slate-300 rounded-md p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="chk-inactivo-ancla"
                  checked={inactivo}
                  onChange={(e) => setInactivo(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <label htmlFor="chk-inactivo-ancla" className="text-xs font-medium text-slate-700 cursor-pointer">
                  Marcar como Cliente Inactivo
                </label>
              </div>
            </div>
          )}

          {/* TAB 3: CONTABILIDAD (Matching Page 6) */}
          {activeTab === 'CONTABILIDAD' && (
            <div className="space-y-4 animate-in fade-in duration-100">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Grupo de Impuestos <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={grupoImpuesto}
                    onChange={(e) => setGrupoImpuesto(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="IVA General 19% (Afecto)">IVA General 19% (Afecto)</option>
                    <option value="Servicios Exentos Art. 12 DL 825">Servicios Exentos Art. 12 DL 825</option>
                    <option value="Honorarios 14.5% (Retención)">Honorarios 14.5% (Retención)</option>
                    <option value="Exportación 0%">Exportación 0%</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Cuenta Cliente
                  </label>
                  <select
                    value={cuentaCliente}
                    onChange={(e) => setCuentaCliente(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    {STANDARD_ACCOUNT_PLAN.filter(a => a.tipo === 'ACTIVO').map(a => (
                      <option key={a.codigo} value={a.codigo}>
                        {a.codigo} - {a.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Cuenta Ventas
                  </label>
                  <select
                    value={cuentaVentas}
                    onChange={(e) => setCuentaVentas(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    {STANDARD_ACCOUNT_PLAN.filter(a => a.tipo === 'INGRESO').map(a => (
                      <option key={a.codigo} value={a.codigo}>
                        {a.codigo} - {a.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Cuenta Desc. Ventas
                  </label>
                  <select
                    value={cuentaDescVentas}
                    onChange={(e) => setCuentaDescVentas(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    {STANDARD_ACCOUNT_PLAN.map(a => (
                      <option key={a.codigo} value={a.codigo}>
                        {a.codigo} - {a.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Cuenta Recepción Mercaderías
                  </label>
                  <select
                    value={cuentaRecepcionMercaderias}
                    onChange={(e) => setCuentaRecepcionMercaderias(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
                    Cuenta Desc. Pagos
                  </label>
                  <select
                    value={cuentaDescPagos}
                    onChange={(e) => setCuentaDescPagos(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
                  placeholder="Observaciones de contrato o requerimientos especiales..."
                  className="w-full bg-white border border-slate-300 rounded-md p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>
          )}

          {/* TAB 4: COMERCIAL (Matching Page 7) */}
          {activeTab === 'COMERCIAL' && (
            <div className="space-y-4 animate-in fade-in duration-100">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Tipo Venta
                  </label>
                  <select
                    value={tipoVenta}
                    onChange={(e) => setTipoVenta(e.target.value as any)}
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="Sin Crédito">Sin Crédito</option>
                    <option value="Con Crédito">Con Crédito</option>
                    <option value="Bloqueado">Bloqueado</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Monto Crédito ($ CLP)
                  </label>
                  <input
                    type="number"
                    value={montoCredito}
                    onChange={(e) => setMontoCredito(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Términos de Pago
                  </label>
                  <input
                    type="text"
                    value={terminosPago}
                    onChange={(e) => setTerminosPago(e.target.value)}
                    placeholder="Seleccione plazo..."
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Área de Ventas
                  </label>
                  <select
                    value={areaVentas}
                    onChange={(e) => setAreaVentas(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="Zona Norte">Zona Norte</option>
                    <option value="Zona Central">Zona Central</option>
                    <option value="Zona Sur">Zona Sur</option>
                    <option value="Zona Austral">Zona Austral</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Vendedor
                  </label>
                  <input
                    type="text"
                    value={vendedor}
                    onChange={(e) => setVendedor(e.target.value)}
                    placeholder="Seleccione vendedor..."
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
                    placeholder="Seleccione C. Costo..."
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Descuento %
                  </label>
                  <input
                    type="number"
                    value={descuentoPorc}
                    onChange={(e) => setDescuentoPorc(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Desc. Pronto Pago %
                  </label>
                  <input
                    type="number"
                    value={descProntoPagoPorc}
                    onChange={(e) => setDescProntoPagoPorc(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
                  placeholder="Observaciones de contrato o requerimientos especiales..."
                  className="w-full bg-white border border-slate-300 rounded-md p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>
          )}

          {/* TAB 5: CONTRATO Y LICENCIAS (Matching Page 8 top) */}
          {activeTab === 'CONTRATO' && (
            <div className="space-y-4 animate-in fade-in duration-100">
              {/* 4 KPI Chips from Page 8 top */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Usuarios Máx</span>
                  <span className="text-lg font-black text-slate-800">{selectedPlan.limiteUsuarios}</span>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Empresas ERP</span>
                  <span className="text-lg font-black text-slate-800">{selectedPlan.limiteEmpresasContables}</span>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Sub. Mensual</span>
                  <span className="text-sm font-black text-emerald-700">{selectedPlan.referenciaTexto}</span>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Módulos</span>
                  <span className="text-[11px] font-bold text-slate-700 block truncate" title={selectedPlan.modulosIncluidos.join(', ')}>
                    {selectedPlan.modulosIncluidos.join(', ')}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Licencias Contratadas
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={licenciasContratadas}
                    onChange={(e) => setLicenciasContratadas(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Nº Contrato
                  </label>
                  <input
                    type="text"
                    value={numeroContrato}
                    onChange={(e) => setNumeroContrato(e.target.value)}
                    placeholder="CTR-2026-0042"
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Tipo Contrato
                  </label>
                  <select
                    value={tipoContrato}
                    onChange={(e) => setTipoContrato(e.target.value as any)}
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="Mensual">Mensual</option>
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
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Duración (Días)
                  </label>
                  <input
                    type="number"
                    value={duracionDias}
                    onChange={(e) => setDuracionDias(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Fecha Expiración
                  </label>
                  <input
                    type="date"
                    value={fechaExpiracion}
                    onChange={(e) => setFechaExpiracion(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Ejecutivo de Cuenta
                  </label>
                  <input
                    type="text"
                    value={ejecutivoCuenta}
                    onChange={(e) => setEjecutivoCuenta(e.target.value)}
                    placeholder="Seleccione Ejecutivo..."
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Nivel de Soporte
                </label>
                <select
                  value={nivelSoporte}
                  onChange={(e) => setNivelSoporte(e.target.value as any)}
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="Básico">Básico</option>
                  <option value="Avanzado">Avanzado</option>
                  <option value="Dedicado 24/7">Dedicado 24/7</option>
                </select>
              </div>
            </div>
          )}

          {/* Footer Buttons matching Pages 4-8 */}
          <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleReset}
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
              className="bg-[#0b192c] hover:bg-slate-900 text-white px-6 py-2 rounded-md text-xs font-extrabold uppercase tracking-wider shadow-sm transition-all flex items-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Guardar Registro Maestro</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
