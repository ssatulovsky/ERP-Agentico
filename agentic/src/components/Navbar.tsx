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
  Mic
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
}) => {
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
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
        <div className="hidden xl:flex flex-wrap items-center gap-2 text-xs font-mono">
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
            <span>{((company.tasaPpm || 0.01) * 100).toFixed(2)}%</span>
          </div>
          <div className="bg-white/10 backdrop-blur-sm border border-white/10 px-2.5 py-1 rounded text-slate-200">
            <span className="text-rose-400 font-bold mr-1">BHE:</span>
            <span>{(indicators.retencionHonorariosTasa * 100).toFixed(2)}%</span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* Config Module Button */}
          <button
            onClick={() => setActiveTab('agents')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'agents'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden sm:inline">Configuración</span>
            <span>Agentes & SII</span>
          </button>

          {discrepanciesCount > 0 && (
            <button
              onClick={openAuditor}
              className="flex items-center gap-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 px-3 py-1.5 rounded-md hover:bg-amber-500/30 transition-colors cursor-pointer text-xs font-medium"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>{discrepanciesCount} Alertas SII</span>
            </button>
          )}

          <button
            onClick={openManual}
            className="flex items-center gap-1.5 bg-indigo-950/80 hover:bg-indigo-900 text-indigo-200 border border-indigo-500/40 px-3 py-1.5 rounded-md transition-colors cursor-pointer text-xs font-semibold"
            title="Abrir Manual de Usuario y Guía de Casuística"
          >
            <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">Manual de</span>
            <span>Usuario</span>
          </button>

          <button
            onClick={openAuditor}
            className="hidden sm:flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 px-3 py-1.5 rounded-md transition-colors cursor-pointer text-xs font-medium"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
            <span>Auditor Fiscal</span>
          </button>

          {openVoiceDialogue && (
            <button
              onClick={openVoiceDialogue}
              className="flex items-center gap-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold px-3 py-1.5 rounded-md transition-all shadow-md shadow-indigo-600/30 cursor-pointer text-xs"
              title="Dialogar por voz con los agentes y personas a cargo de cada área"
            >
              <Mic className="w-3.5 h-3.5 text-blue-200 animate-pulse" />
              <span className="hidden sm:inline">Hablar con</span>
              <span>Agentes (Voz)</span>
            </button>
          )}

          <button
            onClick={openAiChat}
            className="flex items-center gap-1.5 bg-[#2563eb] hover:bg-blue-600 text-white font-medium px-3.5 py-1.5 rounded-md transition-all shadow-sm cursor-pointer text-xs"
          >
            <Bot className="w-3.5 h-3.5" />
            <span>Consultar Agente (IA)</span>
          </button>
        </div>
      </div>
    </header>
  );
};

