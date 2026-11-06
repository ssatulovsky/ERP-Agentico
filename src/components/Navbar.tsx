import React, { useState } from 'react';
import { 
  Building2, 
  Receipt, 
  FileSpreadsheet, 
  Users, 
  Home, 
  TrendingUp, 
  BookOpen, 
  Bot, 
  AlertTriangle, 
  ShieldCheck, 
  CheckCircle2,
  ChevronDown,
  Sliders,
  Key,
  Mic,
  Sparkles,
  LogOut,
  UserCheck,
  Cpu
} from 'lucide-react';
import { 
  ChileIndicators, 
  CompanyProfile, 
  AccountingFirmProfile, 
  ClientCompany 
} from '../types';
import { formatCLP, formatNumberCL } from '../utils/chileanAccounting';
import { ErpPremiaLogo } from './ErpPremiaLogo';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  indicators: ChileIndicators;
  company: CompanyProfile;
  firm: AccountingFirmProfile;
  clients: ClientCompany[];
  activeClientId: string;
  onSelectClient: (clientId: string) => void;
  discrepanciesCount: number;
  openAiChat: () => void;
  openAuditor: () => void;
  openManual: () => void;
  openVoiceDialogue?: () => void;
  currentUserName?: string;
  currentRoleName?: string;
  isAdminOrSuperAdmin?: boolean;
  openAiModelManager?: () => void;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  indicators,
  company,
  firm,
  clients,
  activeClientId,
  onSelectClient,
  discrepanciesCount,
  openAiChat,
  openAuditor,
  openManual,
  openVoiceDialogue,
  currentUserName,
  currentRoleName,
  isAdminOrSuperAdmin,
  openAiModelManager,
  onLogout,
}) => {
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const [isConfigDropdownOpen, setIsConfigDropdownOpen] = useState(false);
  const activeClient = clients.find(c => c.id === activeClientId) || clients[0];

  return (
    <header className="sticky top-0 z-40 bg-[#0f172a] text-white border-b-4 border-[#2563eb] shadow-md shrink-0">
      {/* Top Bar: Geometric Monogram, Title, Client Switcher, Chilean KPI Strip & Controls */}
      <div className="w-full px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-4">
        {/* Left: Brand, Firm & Client Switcher */}
        <div className="flex items-center gap-3.5">
          <ErpPremiaLogo variant="full" layout="horizontal" theme="dark" size="sm" />

          <div className="h-8 w-[1px] bg-slate-700/80 hidden md:block" />

          <div className="flex flex-col">
            {/* Firm Banner */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-300 flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                <span>Estudio: {firm.nombreFantasia}</span>
              </span>
              <span className="text-slate-500 text-[10px]">|</span>
              <span className="text-[10px] text-slate-400 font-mono">
                RUT Asesor: {firm.rut}
              </span>
            </div>

            {/* Active Client Dropdown Switcher */}
            <div className="relative mt-0.5">
              <button
                type="button"
                onClick={() => setIsClientDropdownOpen(!isClientDropdownOpen)}
                className="flex items-center gap-2 bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 px-2.5 py-1 rounded-md transition-all cursor-pointer text-left"
              >
                <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-extrabold text-white text-xs sm:text-sm tracking-tight">
                    {activeClient ? activeClient.nombreCorto : company.razonSocial}
                  </span>
                  <span className="text-slate-400 font-mono text-[10px]">
                    ({company.rut})
                  </span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-1" />
              </button>

              {/* Dropdown Menu */}
              {isClientDropdownOpen && (
                <div className="absolute top-full left-0 mt-1.5 w-72 bg-white text-slate-900 border border-slate-200 rounded-lg shadow-xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3 py-1.5 border-b border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase">
                    <span>Cartera de Clientes</span>
                    <span className="text-blue-600">{clients.length} empresas</span>
                  </div>

                  <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
                    {clients.map((client) => {
                      const isSelected = client.id === activeClientId;
                      return (
                        <button
                          key={client.id}
                          onClick={() => {
                            onSelectClient(client.id);
                            setIsClientDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer ${
                            isSelected ? 'bg-blue-50/70 font-bold text-blue-800' : 'text-slate-700'
                          }`}
                        >
                          <div>
                            <div className="font-bold flex items-center gap-1.5">
                              <span>{client.nombreCorto}</span>
                              {isSelected && (
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              RUT: {client.rut} • {client.regimenTributario === '14D3_PROPYME_GENERAL' ? '14 D3' : '14 A'}
                            </div>
                          </div>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                            client.estadoConexionSii === 'CONECTADO'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {client.estadoConexionSii === 'CONECTADO' ? 'SII OK' : 'Pendiente'}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="p-1.5 border-t border-slate-100 bg-slate-50">
                    <button
                      onClick={() => {
                        setActiveTab('agents');
                        setIsClientDropdownOpen(false);
                      }}
                      className="w-full text-center py-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 cursor-pointer flex items-center justify-center gap-1"
                    >
                      <Sliders className="w-3 h-3" />
                      <span>Configurar Clientes & Claves SII</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Center: Monospace KPI Strip */}
        <div className="hidden lg:flex flex-wrap items-center gap-2 text-xs font-mono">
          <div className="bg-white/10 backdrop-blur-sm border border-white/10 px-2.5 py-1 rounded text-slate-200">
            <span className="text-blue-400 font-bold mr-1">UF:</span>
            <span>{formatCLP(indicators.uf)}</span>
          </div>
          <div className="bg-white/10 backdrop-blur-sm border border-white/10 px-2.5 py-1 rounded text-slate-200">
            <span className="text-emerald-400 font-bold mr-1">UTM:</span>
            <span>{formatCLP(indicators.utm)}</span>
          </div>
          <div className="bg-white/10 backdrop-blur-sm border border-white/10 px-2.5 py-1 rounded text-slate-200">
            <span className="text-amber-400 font-bold mr-1">DÓLAR:</span>
            <span>${formatNumberCL(indicators.dolar, 2)}</span>
          </div>
          <div className="bg-white/10 backdrop-blur-sm border border-white/10 px-2.5 py-1 rounded text-slate-200">
            <span className="text-indigo-400 font-bold mr-1">PPM:</span>
            <span>{company.tasaPpm ? `${(company.tasaPpm * 100).toFixed(2)}%` : 'No informada'}</span>
          </div>
          <div className="bg-white/10 backdrop-blur-sm border border-white/10 px-2.5 py-1 rounded text-slate-200">
            <span className="text-rose-400 font-bold mr-1">BHE:</span>
            <span>{(indicators.retencionHonorariosTasa * 100).toFixed(2)}%</span>
          </div>
        </div>

        {/* Right: Actions, Apartado de Configuración & Usuario Activo */}
        <div className="flex items-center gap-2.5">
          {discrepanciesCount > 0 && (
            <button
              onClick={openAuditor}
              className="flex items-center gap-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2.5 py-1.5 rounded-lg hover:bg-amber-500/30 transition-colors cursor-pointer text-xs font-medium"
              title="Alertas de discrepancias fiscales del SII"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>{discrepanciesCount}</span>
            </button>
          )}

          {openVoiceDialogue && (
            <button
              onClick={openVoiceDialogue}
              className="hidden sm:flex items-center gap-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold px-3 py-1.5 rounded-lg transition-all shadow-md shadow-indigo-600/30 cursor-pointer text-xs"
              title="Hablar con Vera (Socia Virtual) y agentes del ERP con Voz Neuronal Piper"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <Mic className="w-3.5 h-3.5 text-blue-200 animate-pulse" />
              <span className="hidden xl:inline">Hablar con Vera</span>
            </button>
          )}

          <button
            onClick={openAiChat}
            className="flex items-center gap-1.5 bg-[#2563eb] hover:bg-blue-600 text-white font-medium px-3 py-1.5 rounded-lg transition-all shadow-xs cursor-pointer text-xs"
            title="Consultar al Agente Inteligente"
          >
            <Bot className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Consultar IA</span>
          </button>

          {/* APARTADO DE CONFIGURACIÓN (Seguridad, Configuración Agentes/SII, Modelos de IA, Manual de Usuario) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsConfigDropdownOpen(!isConfigDropdownOpen)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                isConfigDropdownOpen || activeTab === 'security_admin' || activeTab === 'agents'
                  ? 'bg-blue-600 text-white border-blue-400 shadow-sm'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
              title="Apartado de Configuración del ERP: Seguridad, Claves SII, Modelos IA y Manual"
            >
              <Sliders className="w-3.5 h-3.5 text-sky-400" />
              <span>Configuración</span>
              <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isConfigDropdownOpen ? 'rotate-180 text-white' : ''}`} />
            </button>

            {/* Dropdown del Apartado de Configuración */}
            {isConfigDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsConfigDropdownOpen(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-80 sm:w-88 bg-white text-slate-900 border border-slate-200 rounded-xl shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3.5 py-2 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-blue-600" />
                      <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                        Apartado de Configuración
                      </span>
                    </div>
                    <span className="text-[10px] bg-blue-50 text-blue-700 font-bold px-1.5 py-0.5 rounded">
                      ERPremIA
                    </span>
                  </div>

                  <div className="p-1.5 space-y-1">
                    {/* 1. Seguridad, Roles & Usuarios */}
                    {isAdminOrSuperAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('security_admin');
                          setIsConfigDropdownOpen(false);
                        }}
                        className={`w-full text-left p-2.5 rounded-lg text-xs flex items-start gap-2.5 hover:bg-slate-50 transition-colors cursor-pointer ${
                          activeTab === 'security_admin' ? 'bg-emerald-50 border border-emerald-200 text-emerald-950 font-semibold' : 'text-slate-700'
                        }`}
                      >
                        <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700 shrink-0 mt-0.5">
                          <Key className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold flex items-center justify-between">
                            <span>Seguridad, Roles & Usuarios</span>
                            <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-mono font-bold">
                              RBAC
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                            Usuarios, roles del sistema, permisos por módulo y empresas anclas.
                          </p>
                        </div>
                      </button>
                    )}

                    {/* 2. Configuración Agentes & SII */}
                    {isAdminOrSuperAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('agents');
                          setIsConfigDropdownOpen(false);
                        }}
                        className={`w-full text-left p-2.5 rounded-lg text-xs flex items-start gap-2.5 hover:bg-slate-50 transition-colors cursor-pointer ${
                          activeTab === 'agents' ? 'bg-blue-50 border border-blue-200 text-blue-950 font-semibold' : 'text-slate-700'
                        }`}
                      >
                        <div className="p-2 rounded-lg bg-blue-100 text-blue-700 shrink-0 mt-0.5">
                          <Sliders className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold flex items-center justify-between">
                            <span>Configuración Agentes & SII</span>
                            <span className="text-[9px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-mono font-bold">
                              SII & ESTUDIO
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                            Cartera de clientes, credenciales del SII, certificados y centralización.
                          </p>
                        </div>
                      </button>
                    )}

                    {/* 3. Modelos de IA & Reporte de Gastos */}
                    {isAdminOrSuperAdmin && openAiModelManager && (
                      <button
                        type="button"
                        onClick={() => {
                          openAiModelManager();
                          setIsConfigDropdownOpen(false);
                        }}
                        className="w-full text-left p-2.5 rounded-lg text-xs flex items-start gap-2.5 hover:bg-slate-50 transition-colors cursor-pointer text-slate-700"
                      >
                        <div className="p-2 rounded-lg bg-indigo-100 text-indigo-700 shrink-0 mt-0.5">
                          <Cpu className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold flex items-center justify-between">
                            <span>Modelos de IA & Costos</span>
                            <span className="text-[9px] bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded font-mono font-bold">
                              ROUTER IA
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                            Configurar Gemini vs Ollama local y reporte de consumo mensual por cliente.
                          </p>
                        </div>
                      </button>
                    )}

                    {/* 4. Manual de Usuario & Casuística */}
                    <button
                      type="button"
                      onClick={() => {
                        openManual();
                        setIsConfigDropdownOpen(false);
                      }}
                      className="w-full text-left p-2.5 rounded-lg text-xs flex items-start gap-2.5 hover:bg-slate-50 transition-colors cursor-pointer text-slate-700"
                    >
                      <div className="p-2 rounded-lg bg-amber-100 text-amber-700 shrink-0 mt-0.5">
                        <BookOpen className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold flex items-center justify-between">
                          <span>Manual de Usuario & Casuística</span>
                          <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-mono font-bold">
                            GUÍA 2026
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                          Guía operativa oficial, normativas tributarias (SII/DT) y testing integral.
                        </p>
                      </div>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Active User & Logout */}
          {currentUserName && (
            <div className="flex items-center gap-2 pl-2 sm:pl-3 border-l border-slate-700">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-linear-to-tr from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center border border-white/20 shadow-xs shrink-0">
                  {currentUserName.charAt(0).toUpperCase()}
                </div>
                <div className="hidden lg:flex flex-col text-left leading-tight">
                  <span className="text-xs font-bold text-white truncate max-w-[120px]">
                    {currentUserName}
                  </span>
                  <span className="text-[10px] font-semibold text-emerald-400 truncate max-w-[120px]">
                    {currentRoleName || 'Usuario'}
                  </span>
                </div>
              </div>
              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  className="flex items-center gap-1 bg-rose-950/80 hover:bg-rose-900 text-rose-200 border border-rose-500/40 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer text-xs font-bold"
                  title="Cerrar sesión"
                >
                  <LogOut className="w-3.5 h-3.5 text-rose-400" />
                  <span className="hidden sm:inline">Salir</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

