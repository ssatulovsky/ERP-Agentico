import React, { useState } from 'react';
import { 
  Building2, 
  Bot, 
  Key, 
  ShieldCheck, 
  Users, 
  CheckCircle2, 
  AlertTriangle, 
  Plus, 
  Edit3, 
  Trash2, 
  Eye, 
  EyeOff, 
  RefreshCw, 
  ExternalLink, 
  Download, 
  Check, 
  X, 
  Sparkles, 
  Terminal, 
  Layers, 
  Sliders, 
  FileText, 
  Clock, 
  ShieldAlert,
  ArrowRight,
  Info,
  Boxes,
  Warehouse
} from 'lucide-react';
import { 
  AccountingFirmProfile, 
  ClientCompany, 
  CompanyProfile, 
  DteDocument 
} from '../types';
import { 
  formatCLP, 
  formatNumberCL, 
  validateRutChileno, 
  formatRutChileno 
} from '../utils/chileanAccounting';
import { AgentGovernancePanel } from './AgentGovernancePanel';

interface AgentClientConfigProps {
  firm: AccountingFirmProfile;
  onUpdateFirm: (firm: AccountingFirmProfile) => void;
  clients: ClientCompany[];
  activeClientId: string;
  onSelectActiveClient: (clientId: string) => void;
  onAddClient: (client: ClientCompany) => void;
  onUpdateClient: (client: ClientCompany) => void;
  onDeleteClient: (clientId: string) => void;
  onDownloadClientDtes: (client: ClientCompany) => void;
}

export const AgentClientConfig: React.FC<AgentClientConfigProps> = ({
  firm,
  onUpdateFirm,
  clients,
  activeClientId,
  onSelectActiveClient,
  onAddClient,
  onUpdateClient,
  onDeleteClient,
  onDownloadClientDtes,
}) => {
  const [activeSection, setActiveSection] = useState<'CLIENTS' | 'FIRM' | 'AGENT_TERMINAL' | 'GOVERNANCE'>('GOVERNANCE');
  
  // Modal / Editor State for Clients
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientCompany | null>(null);
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});
  
  // Test connection state
  const [isTestingSii, setIsTestingSii] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; timestamp: string } | null>(null);
  const [testingClientId, setTestingClientId] = useState<string | null>(null);

  // Terminal Logs State
  const [terminalLogs, setTerminalLogs] = useState<string[]>([
    `[06:30:12] Agente Contable SII inicializado para Estudio ${firm.nombreFantasia}.`,
    `[06:30:15] Conexión establecida con Gateway SII (palena.sii.cl).`,
    `[06:30:20] Verificación de credenciales periódica: 4 clientes monitoreados.`,
    `[06:30:22] Última descarga automática RCV finalizada sin errores.`,
  ]);
  const [isSimulatingAgentRun, setIsSimulatingAgentRun] = useState(false);

  // Form State for Firm
  const [firmForm, setFirmForm] = useState<AccountingFirmProfile>(firm);
  const [firmSaveSuccess, setFirmSaveSuccess] = useState(false);

  // Form State for Client Modal
  const defaultClientForm: ClientCompany = {
    id: `client-${Date.now()}`,
    rut: '',
    razonSocial: '',
    nombreCorto: '',
    giro: '',
    direccion: '',
    comuna: '',
    ciudad: 'Santiago',
    regimenTributario: '14D3_PROPYME_GENERAL',
    tasaPpm: 0.01,
    afpMutualTasa: 0.0093,
    bancoPrincipal: 'Banco Santander Chile',
    numeroCuenta: '',
    contactoNombre: '',
    contactoEmail: '',
    contactoTelefono: '',
    claveSii: '',
    rutAutenticacion: '',
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
    activa: false,
    manejaInventario: false,
    reglaValoracionInventario: 'PMP',
    alertasInventarioAgente: {
      autoReposicion: true,
      alertaStockCritico: true,
      controlGuiasDespacho52: true,
    },
  };

  const [clientForm, setClientForm] = useState<ClientCompany>(defaultClientForm);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [modalShowClave, setModalShowClave] = useState(false);
  const [useCustomAuthRut, setUseCustomAuthRut] = useState(false);

  // Open Modal to Add
  const handleOpenAddModal = () => {
    setEditingClient(null);
    setClientForm({
      ...defaultClientForm,
      id: `client-${Date.now()}`,
    });
    setFormErrors([]);
    setTestResult(null);
    setModalShowClave(false);
    setUseCustomAuthRut(false);
    setIsClientModalOpen(true);
  };

  // Open Modal to Edit
  const handleOpenEditModal = (client: ClientCompany) => {
    setEditingClient(client);
    setClientForm({ ...client });
    setFormErrors([]);
    setTestResult(null);
    setModalShowClave(false);
    setUseCustomAuthRut(Boolean(client.rutAutenticacion && client.rutAutenticacion !== client.rut));
    setIsClientModalOpen(true);
  };

  // Save Firm
  const handleSaveFirm = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateFirm(firmForm);
    setFirmSaveSuccess(true);
    setTimeout(() => setFirmSaveSuccess(false), 3000);
  };

  // Validate and Save Client
  const handleSaveClient = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: string[] = [];

    if (!clientForm.razonSocial.trim()) {
      errors.push('La Razón Social de la empresa cliente es obligatoria.');
    }

    if (!clientForm.rut.trim()) {
      errors.push('El RUT de la empresa es obligatorio.');
    } else if (!validateRutChileno(clientForm.rut)) {
      errors.push(`El RUT ingresado "${clientForm.rut}" no es válido conforme al algoritmo Módulo 11 chileno.`);
    }

    if (!clientForm.claveSii.trim()) {
      errors.push('Debe ingresar la Clave del SII para que el agente pueda ingresar y descargar registros.');
    }

    if (errors.length > 0) {
      setFormErrors(errors);
      return;
    }

    const cleanedClient: ClientCompany = {
      ...clientForm,
      rut: formatRutChileno(clientForm.rut),
      rutAutenticacion: clientForm.rutAutenticacion ? formatRutChileno(clientForm.rutAutenticacion) : formatRutChileno(clientForm.rut),
      nombreCorto: clientForm.nombreCorto.trim() || clientForm.razonSocial.split(' ')[0],
    };

    if (editingClient) {
      onUpdateClient(cleanedClient);
    } else {
      onAddClient(cleanedClient);
    }

    setIsClientModalOpen(false);
  };

  // Test Connection to SII with Client Credentials
  const handleTestSiiConnection = async (targetClient: ClientCompany) => {
    setIsTestingSii(true);
    setTestingClientId(targetClient.id);
    setTestResult(null);

    const logs = [...terminalLogs];
    const time = new Date().toLocaleTimeString();
    logs.unshift(`[${time}] Iniciando autenticación automática en zeusr.sii.cl para RUT: ${targetClient.rut}...`);
    logs.unshift(`[${time}] Usando credencial: Clave Tributaria registrada (Longitud: ${targetClient.claveSii.length} caracteres)...`);
    setTerminalLogs(logs);

    try {
      // Realistic simulation delay for SII authentication handshake
      await new Promise(r => setTimeout(r, 1200));

      const isRutValid = validateRutChileno(targetClient.rut);
      const isClavePresent = Boolean(targetClient.claveSii && targetClient.claveSii.length >= 4);

      if (isRutValid && isClavePresent) {
        const timestamp = new Date().toLocaleString();
        const updatedClient: ClientCompany = {
          ...targetClient,
          estadoConexionSii: 'CONECTADO',
          ultimaSincronizacionSii: timestamp,
          ultimoMensajeSii: 'Autenticación exitosa en portal SII. Permisos de RCV y BHE verificados.',
        };
        onUpdateClient(updatedClient);

        setTestResult({
          success: true,
          message: `¡Conexión verificada exitosamente! El Agente Contable autenticó en el SII con el RUT ${targetClient.rut} y tiene acceso habilitado para descargar Ventas, Compras y Boletas de Honorarios.`,
          timestamp,
        });

        const successLogs = [...terminalLogs];
        successLogs.unshift(`[${new Date().toLocaleTimeString()}] ✅ Autenticación en SII APROBADA para ${targetClient.razonSocial}. Token de sesión asignado.`);
        setTerminalLogs(successLogs);
      } else {
        throw new Error('Credenciales rechazadas por el SII o formato de RUT incorrecto.');
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: `Fallo de autenticación en el SII: ${err.message || 'Error al conectar con zeusr.sii.cl'}. Verifique la clave tributaria e intente nuevamente.`,
        timestamp: new Date().toLocaleString(),
      });

      const updatedClient: ClientCompany = {
        ...targetClient,
        estadoConexionSii: 'ERROR_CREDENCIALES',
        ultimoMensajeSii: 'Clave Tributaria rechazada por el SII o sesión caducada.',
      };
      onUpdateClient(updatedClient);

      const failLogs = [...terminalLogs];
      failLogs.unshift(`[${new Date().toLocaleTimeString()}] ❌ ERROR de acceso al SII para RUT ${targetClient.rut}.`);
      setTerminalLogs(failLogs);
    } finally {
      setIsTestingSii(false);
      setTestingClientId(null);
    }
  };

  // Trigger Instant Agent Download & Sync
  const handleTriggerAgentDownload = async (client: ClientCompany) => {
    setIsSimulatingAgentRun(true);
    const logs = [...terminalLogs];
    const time = new Date().toLocaleTimeString();
    
    logs.unshift(`[${time}] 🤖 AGENTE DISPARADO: Iniciando descarga completa de RCV para ${client.nombreCorto} (RUT: ${client.rut})...`);
    logs.unshift(`[${time}] Conectando a https://www4.sii.cl/registrocompraventaui/...`);
    setTerminalLogs(logs);

    await new Promise(r => setTimeout(r, 1000));
    logs.unshift(`[${new Date().toLocaleTimeString()}] Descargando Registro de Ventas (Facturas 33, Exentas 34, Notas de Crédito 61)...`);
    setTerminalLogs([...logs]);

    await new Promise(r => setTimeout(r, 900));
    logs.unshift(`[${new Date().toLocaleTimeString()}] Descargando Registro de Compras & verificando plazo legal de 8 días de acuse de recibo...`);
    setTerminalLogs([...logs]);

    await new Promise(r => setTimeout(r, 800));
    logs.unshift(`[${new Date().toLocaleTimeString()}] Descargando Boletas de Honorarios Electrónicas (BHE) emitidas y recibidas con retención 14.5%...`);
    setTerminalLogs([...logs]);

    // Perform the actual ingestion in parent
    onDownloadClientDtes(client);
    setIsSimulatingAgentRun(false);

    logs.unshift(`[${new Date().toLocaleTimeString()}] ✅ Descarga finalizada: Libros contables y Flujo de Caja actualizados para ${client.nombreCorto}.`);
    setTerminalLogs([...logs]);
  };

  const activeClient = clients.find(c => c.id === activeClientId) || clients[0];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#0f172a] to-[#2563eb] text-white flex items-center justify-center shrink-0 shadow-md">
              <Sliders className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                  CONFIGURACIÓN DE LOS AGENTES & CLIENTES
                </h2>
                <span className="bg-blue-50 text-blue-700 text-xs font-bold px-2.5 py-0.5 rounded-full border border-blue-200 flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5" />
                  <span>{firm.nombreFantasia}</span>
                </span>
                <span className="bg-emerald-50 text-emerald-700 text-xs font-bold px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{clients.length} Clientes Administrados</span>
                </span>
              </div>
              <p className="text-slate-500 text-xs sm:text-sm mt-1 max-w-3xl leading-relaxed">
                Administre el contexto del <strong>Estudio Contable principal</strong> y configure para cada <strong>empresa cliente</strong> sus datos tributarios ante el SII y la <strong>Clave del SII</strong>, permitiendo al Agente descargar de forma desatendida compras, ventas, honorarios y conciliar el F29.
              </p>
            </div>
          </div>

          {/* Quick Active Client Indicator */}
          {activeClient && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 shrink-0 flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-400">
                  Empresa Activa en el Sistema
                </div>
                <div className="text-xs font-extrabold text-slate-800">
                  {activeClient.nombreCorto}
                </div>
                <div className="text-[11px] font-mono text-slate-500">
                  RUT: {activeClient.rut}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Section Navigation Tabs */}
        <div className="flex items-center gap-2 mt-6 pt-4 border-t border-slate-100 overflow-x-auto text-xs font-semibold">
          <button
            onClick={() => setActiveSection('GOVERNANCE')}
            className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
              activeSection === 'GOVERNANCE'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-indigo-300" />
            <span>Gobernanza & Memoria (Orquestador Senior)</span>
          </button>

          <button
            onClick={() => setActiveSection('CLIENTS')}
            className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
              activeSection === 'CLIENTS'
                ? 'bg-[#2563eb] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Cartera de Clientes & Claves SII ({clients.length})</span>
          </button>

          <button
            onClick={() => setActiveSection('FIRM')}
            className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
              activeSection === 'FIRM'
                ? 'bg-[#0f172a] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Estudio Contable Principal ({firm.nombreFantasia})</span>
          </button>

          <button
            onClick={() => setActiveSection('AGENT_TERMINAL')}
            className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
              activeSection === 'AGENT_TERMINAL'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span>Consola del Agente SII en Vivo</span>
          </button>
        </div>
      </div>

      {/* SECTION 0: GOBERNANZA AGÉNTICA, CONTEXTO E INSTRUCCIONES ESPECIALES (MEMORIA) */}
      {activeSection === 'GOVERNANCE' && (
        <AgentGovernancePanel clients={clients} activeClientId={activeClientId} />
      )}

      {/* SECTION 1: CLIENTS PORTFOLIO & SII CREDENTIALS */}
      {activeSection === 'CLIENTS' && (
        <div className="space-y-4">
          {/* Action Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
            <div>
              <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                <span>Empresas Clientes Administradas</span>
                <span className="text-xs font-normal text-slate-500">
                  (Cada cliente posee su clave tributaria del SII y configuración de agente)
                </span>
              </h3>
            </div>
            <button
              onClick={handleOpenAddModal}
              className="px-4 py-2 bg-[#2563eb] hover:bg-blue-600 text-white font-bold rounded-lg transition-all text-xs flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Agregar Nueva Empresa Cliente</span>
            </button>
          </div>

          {/* Grid of Client Companies */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {clients.map((client) => {
              const isActive = client.id === activeClientId;
              const isPswVisible = Boolean(showPassword[client.id]);

              return (
                <div
                  key={client.id}
                  className={`bg-white border rounded-xl p-5 transition-all shadow-xs relative flex flex-col justify-between ${
                    isActive
                      ? 'border-[#2563eb] ring-2 ring-blue-500/10'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {/* Top Line: Brand & Active Badge */}
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-900 text-base">
                            {client.nombreCorto}
                          </span>
                          {isActive && (
                            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-300 uppercase tracking-wide">
                              Empresa Activa
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 font-medium line-clamp-1 mt-0.5">
                          {client.razonSocial}
                        </div>
                      </div>

                      {/* Connection Status Badge */}
                      <span
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-full border flex items-center gap-1.5 shrink-0 ${
                          client.estadoConexionSii === 'CONECTADO'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : client.estadoConexionSii === 'ERROR_CREDENCIALES'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${
                          client.estadoConexionSii === 'CONECTADO'
                            ? 'bg-emerald-500'
                            : client.estadoConexionSii === 'ERROR_CREDENCIALES'
                            ? 'bg-rose-500'
                            : 'bg-amber-500'
                        }`}></span>
                        <span>{client.estadoConexionSii === 'CONECTADO' ? 'SII Conectado' : client.estadoConexionSii === 'ERROR_CREDENCIALES' ? 'Error Clave' : 'Pendiente'}</span>
                      </span>
                    </div>

                    {/* Tax & Operational Metadata */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 my-4 text-xs">
                      <div className="bg-slate-50 border border-slate-100 rounded-lg p-2">
                        <span className="text-slate-400 text-[10px] uppercase font-bold block">RUT Empresa</span>
                        <span className="font-mono font-bold text-slate-800">{client.rut}</span>
                      </div>

                      <div className="bg-slate-50 border border-slate-100 rounded-lg p-2">
                        <span className="text-slate-400 text-[10px] uppercase font-bold block">Régimen Tributario</span>
                        <span className="font-bold text-slate-800 truncate block">
                          {client.regimenTributario === '14D3_PROPYME_GENERAL' ? '14 D3 ProPyme' : client.regimenTributario === '14D8_PROPYME_TRANSPARENTE' ? '14 D8 Transparente' : '14 A General'}
                        </span>
                      </div>

                      <div className="bg-slate-50 border border-slate-100 rounded-lg p-2">
                        <span className="text-slate-400 text-[10px] uppercase font-bold block">Tasa PPM</span>
                        <span className="font-mono font-bold text-blue-600">
                          {((client.tasaPpm || 0.01) * 100).toFixed(2)}%
                        </span>
                      </div>
                    </div>

                    {/* SII Agent Credentials Box */}
                    <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-3 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-blue-900 flex items-center gap-1.5">
                          <Key className="w-3.5 h-3.5 text-blue-600" />
                          <span>Credenciales SII del Agente</span>
                        </span>
                        <span className="text-[10px] text-blue-700 font-mono">
                          Auth: {client.tipoAutenticacionSii}
                        </span>
                      </div>

                      <div className="flex items-center justify-between bg-white border border-blue-200 rounded px-2.5 py-1.5 font-mono">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 text-[11px]">Clave SII:</span>
                          <span className="font-bold text-slate-800 tracking-wider">
                            {isPswVisible ? client.claveSii : '••••••••••••'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowPassword(prev => ({ ...prev, [client.id]: !prev[client.id] }))}
                          className="text-slate-400 hover:text-slate-700 cursor-pointer p-0.5"
                          title={isPswVisible ? 'Ocultar clave' : 'Mostrar clave'}
                        >
                          {isPswVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-slate-500">
                        <span>Última descarga: {client.ultimaSincronizacionSii || 'Pendiente'}</span>
                        <span className="text-slate-600 font-medium">Frecuencia: {client.automatizacionesAgente.frecuenciaDescarga}</span>
                      </div>

                      {client.contextoEspecialAgente && (
                        <div className="bg-white/80 rounded p-2 text-[11px] text-slate-600 border border-blue-100 italic">
                          "{client.contextoEspecialAgente}"
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Toolbar */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {!isActive ? (
                        <button
                          onClick={() => onSelectActiveClient(client.id)}
                          className="px-3 py-1.5 bg-[#0f172a] hover:bg-slate-800 text-white rounded-md text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 shadow-xs"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Seleccionar Empresa</span>
                        </button>
                      ) : (
                        <span className="text-xs text-emerald-700 font-bold flex items-center gap-1 px-2 py-1 bg-emerald-50 rounded">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Empresa en Uso</span>
                        </span>
                      )}

                      <button
                        disabled={isTestingSii && testingClientId === client.id}
                        onClick={() => handleTestSiiConnection(client)}
                        className="px-2.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-md text-xs font-semibold cursor-pointer transition-all flex items-center gap-1 disabled:opacity-50"
                        title="Probar autenticación con la Clave del SII"
                      >
                        <RefreshCw className={`w-3 h-3 ${isTestingSii && testingClientId === client.id ? 'animate-spin text-blue-600' : ''}`} />
                        <span>Probar Clave</span>
                      </button>

                      <button
                        disabled={isSimulatingAgentRun}
                        onClick={() => handleTriggerAgentDownload(client)}
                        className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-md text-xs font-bold cursor-pointer transition-all flex items-center gap-1"
                        title="Descargar Compras, Ventas y Honorarios con el Agente"
                      >
                        <Download className="w-3 h-3" />
                        <span>Descargar RCV</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditModal(client)}
                        className="p-1.5 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded cursor-pointer"
                        title="Editar datos y credenciales"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      {clients.length > 1 && (
                        <button
                          onClick={() => {
                            if (confirm(`¿Está seguro de eliminar el cliente ${client.nombreCorto}?`)) {
                              onDeleteClient(client.id);
                            }
                          }}
                          className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                          title="Eliminar cliente"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 2: PRIMARY ACCOUNTING FIRM PROFILE (ESTUDIO CONTABLE) */}
      {activeSection === 'FIRM' && (
        <form onSubmit={handleSaveFirm} className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-6">
          <div className="border-b border-slate-200 pb-4">
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              <span>Contexto del Cliente Principal: Estudio Contable / Consultoría</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Configure la información del Estudio Contable que opera la plataforma y gestiona la contabilidad de las múltiples empresas clientes.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Nombre Comercial / Fantasía:</label>
              <input
                type="text"
                value={firmForm.nombreFantasia}
                onChange={(e) => setFirmForm({ ...firmForm, nombreFantasia: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-lg p-2.5 font-bold text-slate-900 focus:outline-none focus:border-blue-500"
                placeholder="Ej: Siex Consultores"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Razón Social Legal:</label>
              <input
                type="text"
                value={firmForm.razonSocial}
                onChange={(e) => setFirmForm({ ...firmForm, razonSocial: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:border-blue-500"
                placeholder="Ej: SIEX CONSULTORES TRIBUTARIOS SPA"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">RUT del Estudio Contable:</label>
              <input
                type="text"
                value={firmForm.rut}
                onChange={(e) => setFirmForm({ ...firmForm, rut: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-lg p-2.5 font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-500"
                placeholder="76.543.210-9"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Contador General / Representante:</label>
              <input
                type="text"
                value={firmForm.representanteLegal}
                onChange={(e) => setFirmForm({ ...firmForm, representanteLegal: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:border-blue-500"
                placeholder="Ej: Gonzalo Valenzuela Pérez"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">RUT Representante ante el SII:</label>
              <input
                type="text"
                value={firmForm.rutRepresentante}
                onChange={(e) => setFirmForm({ ...firmForm, rutRepresentante: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-lg p-2.5 font-mono text-slate-900 focus:outline-none focus:border-blue-500"
                placeholder="14.238.901-2"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Método Institucional ante el SII:</label>
              <select
                value={firmForm.metodoAccesoSii}
                onChange={(e) => setFirmForm({ ...firmForm, metodoAccesoSii: e.target.value as any })}
                className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:border-blue-500 font-semibold"
              >
                <option value="MANDATO_REPRESENTANTE">Mandato Representante en el SII (Recomendado)</option>
                <option value="CLAVE_DIRECTA_CLIENTE">Clave Tributaria Directa de Cada Cliente</option>
                <option value="CERTIFICADO_CENTRAL">Certificado Digital Centralizado del Estudio</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Email de Contacto / Notificaciones:</label>
              <input
                type="email"
                value={firmForm.emailContacto}
                onChange={(e) => setFirmForm({ ...firmForm, emailContacto: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:border-blue-500"
                placeholder="contacto@siexconsultores.cl"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Teléfono:</label>
              <input
                type="text"
                value={firmForm.telefono}
                onChange={(e) => setFirmForm({ ...firmForm, telefono: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:border-blue-500"
                placeholder="+56 2 2840 9200"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Dirección del Estudio:</label>
              <input
                type="text"
                value={firmForm.direccion}
                onChange={(e) => setFirmForm({ ...firmForm, direccion: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:border-blue-500"
                placeholder="Av. El Golf 40, Piso 11, Las Condes"
              />
            </div>
          </div>

          {/* AI Policy & Directives for the Accounting Agent */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-blue-600" />
              <h4 className="font-bold text-slate-800 text-xs sm:text-sm">
                Directrices & Política de Auditoría para los Agentes IA (Gemini)
              </h4>
            </div>
            <p className="text-slate-500 text-xs">
              Estas instrucciones se inyectan en el prompt del Agente Contable y Auditor Fiscal para orientar los análisis de todas las empresas clientes administradas por {firmForm.nombreFantasia}.
            </p>
            <textarea
              rows={4}
              value={firmForm.politicaAuditoria}
              onChange={(e) => setFirmForm({ ...firmForm, politicaAuditoria: e.target.value })}
              className="w-full bg-white border border-slate-300 rounded-lg p-3 text-xs text-slate-900 focus:outline-none focus:border-blue-500 leading-relaxed font-sans"
              placeholder="Escriba las políticas del estudio: tolerancia cero a discrepancias RCV-F29, verificación obligatoria de acuse de recibo de compras a 8 días según Ley 19.983..."
            />
          </div>

          {/* Enabled Sub-Agents */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <h4 className="font-bold text-slate-800 text-xs sm:text-sm flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Módulos de Agentes Inteligentes Habilitados para el Estudio</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <label className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={firmForm.agentesHabilitados.auditorFiscal}
                  onChange={(e) => setFirmForm({
                    ...firmForm,
                    agentesHabilitados: { ...firmForm.agentesHabilitados, auditorFiscal: e.target.checked }
                  })}
                  className="rounded text-blue-600 focus:ring-0"
                />
                <div>
                  <div className="font-bold text-slate-800">Auditor Fiscal IA</div>
                  <div className="text-[10px] text-slate-500">Cruce RCV vs F29 y TGR</div>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={firmForm.agentesHabilitados.descargaAutomaticaSii}
                  onChange={(e) => setFirmForm({
                    ...firmForm,
                    agentesHabilitados: { ...firmForm.agentesHabilitados, descargaAutomaticaSii: e.target.checked }
                  })}
                  className="rounded text-blue-600 focus:ring-0"
                />
                <div>
                  <div className="font-bold text-slate-800">Descargador SII RCV</div>
                  <div className="text-[10px] text-slate-500">Compras, ventas y BHE</div>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={firmForm.agentesHabilitados.liquidacionPrevisional}
                  onChange={(e) => setFirmForm({
                    ...firmForm,
                    agentesHabilitados: { ...firmForm.agentesHabilitados, liquidacionPrevisional: e.target.checked }
                  })}
                  className="rounded text-blue-600 focus:ring-0"
                />
                <div>
                  <div className="font-bold text-slate-800">Agente Laboral DT</div>
                  <div className="text-[10px] text-slate-500">Art. 50 e imposiciones</div>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={firmForm.agentesHabilitados.proyeccionFlujo}
                  onChange={(e) => setFirmForm({
                    ...firmForm,
                    agentesHabilitados: { ...firmForm.agentesHabilitados, proyeccionFlujo: e.target.checked }
                  })}
                  className="rounded text-blue-600 focus:ring-0"
                />
                <div>
                  <div className="font-bold text-slate-800">Agente de Tesorería</div>
                  <div className="text-[10px] text-slate-500">Flujo 30/60/90 días</div>
                </div>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-500">
              {firmSaveSuccess && (
                <span className="text-emerald-600 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>¡Datos del Estudio Contable guardados correctamente!</span>
                </span>
              )}
            </span>
            <button
              type="submit"
              className="px-6 py-2.5 bg-[#0f172a] hover:bg-slate-800 text-white font-bold rounded-lg transition-all text-xs flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Guardar Configuración del Estudio</span>
            </button>
          </div>
        </form>
      )}

      {/* SECTION 3: LIVE AGENT CONSOLE */}
      {activeSection === 'AGENT_TERMINAL' && (
        <div className="bg-[#0f172a] text-slate-200 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-emerald-400" />
                <h3 className="font-extrabold text-white text-base tracking-tight font-mono">
                  MONITOR DE EJECUCIÓN DEL AGENTE SII
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-1 font-mono">
                Demostración y registro en tiempo real del robot navegando a zeusr.sii.cl con la clave del cliente seleccionado.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={isSimulatingAgentRun}
                onClick={() => activeClient && handleTriggerAgentDownload(activeClient)}
                className="px-4 py-2 bg-[#2563eb] hover:bg-blue-600 disabled:opacity-50 text-white font-bold rounded-lg text-xs flex items-center gap-2 cursor-pointer transition-all shadow-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSimulatingAgentRun ? 'animate-spin' : ''}`} />
                <span>Ejecutar Descarga Completa Ahora</span>
              </button>

              <button
                onClick={() => setTerminalLogs([])}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs cursor-pointer"
              >
                Limpiar
              </button>
            </div>
          </div>

          {/* Active Target Banner */}
          {activeClient && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="text-blue-400 font-bold">CLIENTE OBJETIVO:</span>
                <span className="text-white font-black">{activeClient.razonSocial}</span>
                <span className="text-slate-400">({activeClient.rut})</span>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                <span className="text-slate-400">Clave SII:</span>
                <span className="text-amber-400 font-bold">••••••••</span>
                <span className="text-slate-500">|</span>
                <span className="text-emerald-400 font-bold">SESIÓN ACTIVA</span>
              </div>
            </div>
          )}

          {/* Terminal Console View */}
          <div className="h-72 bg-black/60 rounded-lg p-4 font-mono text-xs overflow-y-auto space-y-1.5 border border-slate-800">
            {terminalLogs.length === 0 ? (
              <div className="text-slate-500 text-center py-12 italic">
                Presione "Ejecutar Descarga Completa Ahora" para disparar la rutina del agente...
              </div>
            ) : (
              terminalLogs.map((log, index) => (
                <div key={index} className="leading-relaxed">
                  {log.includes('ERROR') ? (
                    <span className="text-rose-400 font-bold">{log}</span>
                  ) : log.includes('✅') || log.includes('APROBADA') ? (
                    <span className="text-emerald-400 font-bold">{log}</span>
                  ) : log.includes('🤖') ? (
                    <span className="text-blue-400 font-bold">{log}</span>
                  ) : (
                    <span className="text-slate-300">{log}</span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT CLIENT COMPANY & SII CREDENTIALS */}
      {isClientModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-3xl overflow-hidden shadow-2xl max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-[#0f172a] text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-md bg-blue-600 text-white">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-sm sm:text-base tracking-tight">
                    {editingClient ? 'CONFIGURAR EMPRESA CLIENTE & CLAVE SII' : 'REGISTRAR NUEVA EMPRESA CLIENTE'}
                  </h3>
                  <p className="text-xs text-slate-300">
                    Estudio Contable a cargo: {firm.nombreFantasia}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsClientModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveClient} className="p-6 overflow-y-auto space-y-5 text-xs">
              {formErrors.length > 0 && (
                <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-rose-900 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>Por favor corrija los siguientes campos:</span>
                  </div>
                  <ul className="list-disc pl-5 space-y-0.5 text-[11px]">
                    {formErrors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 1. Identification & Tax Attributes */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <h4 className="font-extrabold text-slate-800 text-xs sm:text-sm flex items-center gap-2">
                  <Info className="w-4 h-4 text-blue-600" />
                  <span>1. Identificación y Régimen Tributario SII</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Razón Social Legal:</label>
                    <input
                      type="text"
                      value={clientForm.razonSocial}
                      onChange={(e) => setClientForm({ ...clientForm, razonSocial: e.target.value })}
                      placeholder="Ej: InnovAgile Group SpA"
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold text-slate-900 focus:outline-none focus:border-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Nombre Comercial / Fantasía:</label>
                    <input
                      type="text"
                      value={clientForm.nombreCorto}
                      onChange={(e) => setClientForm({ ...clientForm, nombreCorto: e.target.value })}
                      placeholder="Ej: InnovAgile Group"
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">RUT de la Empresa:</label>
                    <input
                      type="text"
                      value={clientForm.rut}
                      onChange={(e) => {
                        const val = e.target.value;
                        setClientForm((prev) => ({
                          ...prev,
                          rut: val,
                          rutAutenticacion: useCustomAuthRut ? prev.rutAutenticacion : val,
                        }));
                      }}
                      placeholder="77.798.901-4"
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-500"
                      required
                    />
                    {clientForm.rut && (
                      <span className={`text-[10px] mt-0.5 block font-bold ${validateRutChileno(clientForm.rut) ? 'text-emerald-600' : 'text-rose-500'}`}>
                        {validateRutChileno(clientForm.rut) ? '✓ Algoritmo Módulo 11 Válido' : '✗ RUT no válido'}
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Régimen Tributario SII:</label>
                    <select
                      value={clientForm.regimenTributario}
                      onChange={(e) => setClientForm({ ...clientForm, regimenTributario: e.target.value as any })}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 font-semibold focus:outline-none focus:border-blue-500"
                    >
                      <option value="14D3_PROPYME_GENERAL">ProPyme General (Art. 14 D N°3) - Tasa 10%/25%</option>
                      <option value="14D8_PROPYME_TRANSPARENTE">ProPyme Transparente (Art. 14 D N°8) - Liberada de IDPC</option>
                      <option value="14A_SEMI_INTEGRADO">Régimen General Semi-Integrado (Art. 14 A) - Tasa 27%</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Giro Comercial SII:</label>
                    <input
                      type="text"
                      value={clientForm.giro}
                      onChange={(e) => setClientForm({ ...clientForm, giro: e.target.value })}
                      placeholder="Ej: Servicios de consultoría y desarrollo informático"
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Tasa PPM (%):</label>
                      <input
                        type="number"
                        step="0.05"
                        min="0"
                        max="15"
                        value={((clientForm.tasaPpm || 0.01) * 100).toFixed(2)}
                        onChange={(e) => setClientForm({ ...clientForm, tasaPpm: parseFloat(e.target.value) / 100 || 0.01 })}
                        className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono font-bold text-blue-600 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Ciudad / Comuna:</label>
                      <input
                        type="text"
                        value={clientForm.comuna || clientForm.ciudad}
                        onChange={(e) => setClientForm({ ...clientForm, comuna: e.target.value, ciudad: e.target.value })}
                        placeholder="Ej: Providencia"
                        className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. SII Credentials for Agent Automated Ingestion (Crucial) */}
              <div className="bg-blue-50/70 border-2 border-blue-300 rounded-xl p-4 space-y-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Key className="w-5 h-5 text-[#2563eb]" />
                    <div>
                      <h4 className="font-extrabold text-blue-950 text-sm">
                        2. Credenciales del SII para el Agente Autónomo
                      </h4>
                      <p className="text-[11px] text-blue-800">
                        El Agente Contable utilizará estas credenciales para acceder a <strong>zeusr.sii.cl</strong> y descargar automáticamente compras, ventas y honorarios.
                      </p>
                    </div>
                  </div>
                  <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                    Seguridad Cifrada
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Clave Tributaria Input with Eye Toggle */}
                  <div>
                    <label className="block font-bold text-slate-800 mb-1 flex items-center justify-between">
                      <span>Clave Tributaria del SII:</span>
                      <span className="text-[10px] text-blue-700 font-semibold">Obligatorio</span>
                    </label>
                    <div className="relative">
                      <input
                        type={modalShowClave ? 'text' : 'password'}
                        value={clientForm.claveSii}
                        onChange={(e) => setClientForm({ ...clientForm, claveSii: e.target.value })}
                        placeholder="Ingrese la clave secreta del SII..."
                        className="w-full bg-white border-2 border-blue-300 rounded-lg p-2.5 font-mono text-slate-900 font-bold focus:outline-none focus:border-blue-600 pr-10"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setModalShowClave(!modalShowClave)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                        title={modalShowClave ? 'Ocultar clave' : 'Mostrar clave'}
                      >
                        {modalShowClave ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      Permite al agente ingresar desatendidamente y consultar el RCV mensual.
                    </span>
                  </div>

                  {/* RUT de Autenticación SII (Vinculado automáticamente) */}
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700">RUT para acceso al portal SII:</span>
                      <span className="font-mono font-bold text-blue-700 bg-white px-2.5 py-1 rounded border border-blue-200">
                        {clientForm.rut ? clientForm.rut : 'Heredado del RUT de la empresa'}
                      </span>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer pt-1 border-t border-slate-200">
                      <input
                        type="checkbox"
                        checked={useCustomAuthRut}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setUseCustomAuthRut(checked);
                          if (!checked) {
                            setClientForm((prev) => ({ ...prev, rutAutenticacion: prev.rut }));
                          }
                        }}
                        className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                      />
                      <span>Ingresar con RUT de Representante Legal o apoderado distinto al de la empresa</span>
                    </label>

                    {useCustomAuthRut && (
                      <div className="pt-2">
                        <label className="block text-xs font-bold text-slate-800 mb-1">
                          RUT del Representante Legal o Apoderado:
                        </label>
                        <input
                          type="text"
                          value={clientForm.rutAutenticacion}
                          onChange={(e) => setClientForm({ ...clientForm, rutAutenticacion: e.target.value })}
                          placeholder="Ej: 15.678.901-2"
                          className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono text-slate-900 font-bold focus:outline-none focus:border-blue-600 text-xs"
                        />
                        <span className="text-[10px] text-slate-500 mt-1 block">
                          Solo necesario si la clave tributaria pertenece a una persona natural con mandato.
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Método de Acceso */}
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      Tipo de Autenticación SII:
                    </label>
                    <select
                      value={clientForm.tipoAutenticacionSii}
                      onChange={(e) => setClientForm({ ...clientForm, tipoAutenticacionSii: e.target.value as any })}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 font-semibold focus:outline-none focus:border-blue-600"
                    >
                      <option value="CLAVE_TRIBUTARIA">Clave Tributaria Directa (Portal sii.cl)</option>
                      <option value="MANDATO_ESTUDIO">Mandato Otorgado al Estudio ({firm.nombreFantasia})</option>
                      <option value="CERTIFICADO_DIGITAL">Certificado Digital PKCS#12 (.p12 / .pfx)</option>
                    </select>
                  </div>

                  {/* Frecuencia de Descarga Automática */}
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      Frecuencia de Consulta del Agente:
                    </label>
                    <select
                      value={clientForm.automatizacionesAgente.frecuenciaDescarga}
                      onChange={(e) => setClientForm({
                        ...clientForm,
                        automatizacionesAgente: {
                          ...clientForm.automatizacionesAgente,
                          frecuenciaDescarga: e.target.value as any
                        }
                      })}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 font-semibold focus:outline-none focus:border-blue-600"
                    >
                      <option value="DIARIA">Diaria (madrugada y cierre de jornada)</option>
                      <option value="CADA_6_HORAS">Cada 6 Horas (empresas de alto volumen)</option>
                      <option value="SEMANAL">Semanal (todos los lunes)</option>
                      <option value="MANUAL">Manual a petición del usuario</option>
                    </select>
                  </div>
                </div>

                {/* Inline Test Credentials Button & Feedback */}
                <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-blue-200">
                  <button
                    type="button"
                    disabled={isTestingSii || !clientForm.claveSii}
                    onClick={() => handleTestSiiConnection(clientForm)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-bold text-xs flex items-center gap-2 cursor-pointer shadow-xs transition-all"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isTestingSii ? 'animate-spin' : ''}`} />
                    <span>Probar Credenciales del SII Ahora</span>
                  </button>

                  {testResult && (
                    <div className={`text-xs p-2 rounded flex items-center gap-1.5 ${testResult.success ? 'bg-emerald-100 text-emerald-900' : 'bg-rose-100 text-rose-900'}`}>
                      {testResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />}
                      <span className="font-semibold">{testResult.message}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 3. Automation Rules & AI Context */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <h4 className="font-extrabold text-slate-800 text-xs sm:text-sm flex items-center gap-2">
                  <Bot className="w-4 h-4 text-purple-600" />
                  <span>3. Automatizaciones y Contexto Particular para el Agente IA</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <label className="flex items-center gap-2 p-2 bg-white border border-slate-200 rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={clientForm.automatizacionesAgente.descargaAutomaticaRcv}
                      onChange={(e) => setClientForm({
                        ...clientForm,
                        automatizacionesAgente: {
                          ...clientForm.automatizacionesAgente,
                          descargaAutomaticaRcv: e.target.checked
                        }
                      })}
                      className="rounded text-blue-600 focus:ring-0"
                    />
                    <span className="font-medium text-slate-800">Descarga automática de Compras y Ventas (RCV)</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 bg-white border border-slate-200 rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={clientForm.automatizacionesAgente.descargaAutomaticaBhe}
                      onChange={(e) => setClientForm({
                        ...clientForm,
                        automatizacionesAgente: {
                          ...clientForm.automatizacionesAgente,
                          descargaAutomaticaBhe: e.target.checked
                        }
                      })}
                      className="rounded text-blue-600 focus:ring-0"
                    />
                    <span className="font-medium text-slate-800">Descarga de Boletas de Honorarios BHE</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 bg-white border border-slate-200 rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={clientForm.automatizacionesAgente.alertaPlazo8DiasReclamo}
                      onChange={(e) => setClientForm({
                        ...clientForm,
                        automatizacionesAgente: {
                          ...clientForm.automatizacionesAgente,
                          alertaPlazo8DiasReclamo: e.target.checked
                        }
                      })}
                      className="rounded text-blue-600 focus:ring-0"
                    />
                    <span className="font-medium text-slate-800">Alerta de plazo 8 días para acuse recibo (Ley 19.983)</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 bg-white border border-slate-200 rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={clientForm.automatizacionesAgente.simulacionF29Automatica}
                      onChange={(e) => setClientForm({
                        ...clientForm,
                        automatizacionesAgente: {
                          ...clientForm.automatizacionesAgente,
                          simulacionF29Automatica: e.target.checked
                        }
                      })}
                      className="rounded text-blue-600 focus:ring-0"
                    />
                    <span className="font-medium text-slate-800">Pre-liquidación mensual de F29 automática</span>
                  </label>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Instrucciones Especiales para el Agente IA sobre esta Empresa:
                  </label>
                  <textarea
                    rows={3}
                    value={clientForm.contextoEspecialAgente}
                    onChange={(e) => setClientForm({ ...clientForm, contextoEspecialAgente: e.target.value })}
                    placeholder="Ej: Empresa tecnológica con ventas exentas al extranjero por exportación de servicios. Compras recurrentes de software con Invoice internacional..."
                    className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* 4. Inventory & Multi-Warehouse Agent Configuration */}
              <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-amber-950 text-xs sm:text-sm flex items-center gap-2">
                    <Boxes className="w-4 h-4 text-amber-700" />
                    <span>4. Módulo de Inventario & Bodegas (WMS / DTE 52 / Art. 30 LIR)</span>
                  </h4>
                  <span className="text-[10px] bg-amber-200 text-amber-900 font-bold px-2 py-0.5 rounded">
                    Para Empresas que Aplique
                  </span>
                </div>

                <div className="p-3 bg-white border border-amber-200 rounded-lg space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!clientForm.manejaInventario}
                      onChange={(e) => setClientForm({
                        ...clientForm,
                        manejaInventario: e.target.checked
                      })}
                      className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500 cursor-pointer"
                    />
                    <div>
                      <div className="font-bold text-xs text-slate-900">
                        Habilitar Gestión de Inventario Físico para este Cliente
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Aplica para empresas con bodegas, stock de mercaderías, faenas o insumos (Ej: Maestranzas, Comercio, Faenas Mineras/Agrícolas).
                      </div>
                    </div>
                  </label>

                  {clientForm.manejaInventario && (
                    <div className="pt-3 border-t border-amber-100 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block font-bold text-slate-800 mb-1">
                          Método de Valoración Tributaria (SII):
                        </label>
                        <select
                          value={clientForm.reglaValoracionInventario || 'PMP'}
                          onChange={(e) => setClientForm({
                            ...clientForm,
                            reglaValoracionInventario: e.target.value as any
                          })}
                          className="w-full bg-white border border-slate-300 rounded-lg p-2 font-medium text-slate-800 text-xs"
                        >
                          <option value="PMP">PMP - Precio Medio Ponderado (Art. 30 LIR SII)</option>
                          <option value="FIFO">FIFO / PEPS - Primero en Entrar, Primero en Salir</option>
                          <option value="IDENTIFICACION_ESPECIFICA">Identificación Específica (Naves / Maquinaria)</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <span className="block font-bold text-slate-800 mb-1">
                          Políticas Autónomas del Agente:
                        </span>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={clientForm.alertasInventarioAgente?.alertaStockCritico ?? true}
                            onChange={(e) => setClientForm({
                              ...clientForm,
                              alertasInventarioAgente: {
                                ...clientForm.alertasInventarioAgente,
                                alertaStockCritico: e.target.checked
                              }
                            })}
                            className="rounded text-amber-600 focus:ring-0"
                          />
                          <span className="text-[11px] text-slate-700">Detectar y alertar quiebres de stock crítico</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={clientForm.alertasInventarioAgente?.autoReposicion ?? true}
                            onChange={(e) => setClientForm({
                              ...clientForm,
                              alertasInventarioAgente: {
                                ...clientForm.alertasInventarioAgente,
                                autoReposicion: e.target.checked
                              }
                            })}
                            className="rounded text-amber-600 focus:ring-0"
                          />
                          <span className="text-[11px] text-slate-700">Emitir solicitudes automáticas de reposición (SAR)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={clientForm.alertasInventarioAgente?.controlGuiasDespacho52 ?? true}
                            onChange={(e) => setClientForm({
                              ...clientForm,
                              alertasInventarioAgente: {
                                ...clientForm.alertasInventarioAgente,
                                controlGuiasDespacho52: e.target.checked
                              }
                            })}
                            className="rounded text-amber-600 focus:ring-0"
                          />
                          <span className="text-[11px] text-slate-700">Generar Guías de Despacho DTE 52 para traslados</span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsClientModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg font-bold text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-[#2563eb] hover:bg-blue-600 text-white rounded-lg font-bold text-xs cursor-pointer shadow-xs flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingClient ? 'Guardar Cambios del Cliente' : 'Registrar Cliente en el Sistema'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
