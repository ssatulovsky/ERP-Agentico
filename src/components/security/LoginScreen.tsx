import React, { useState } from 'react';
import {
  ShieldCheck,
  Building2,
  User,
  Lock,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  ArrowRight,
  PhoneCall,
  Sparkles,
  KeyRound,
  Eye,
  EyeOff,
  Users,
} from 'lucide-react';
import { ErpPremiaLogo } from '../ErpPremiaLogo';
import {
  SecurityRbacStoreState,
  LoginValidationResult,
  authenticateErpLogin,
} from '../../services/securityRbacService';

interface LoginScreenProps {
  securityState: SecurityRbacStoreState;
  onLoginSuccess: (result: LoginValidationResult, selectedEmpresaId: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  securityState,
  onLoginSuccess,
}) => {
  const [username, setUsername] = useState<string>('ssatulovsky');
  const [password, setPassword] = useState<string>('admin123');
  const [empresaId, setEmpresaId] = useState<string>(
    securityState.companiesConfig[0]?.empresaId || 'client-innovagile'
  );
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<LoginValidationResult | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = authenticateErpLogin({
      usernameInput: username,
      passwordInput: password,
      empresaId,
      state: securityState,
    });
    if (!res.ok) {
      setValidationError(res);
      return;
    }
    setValidationError(null);
    onLoginSuccess(res, empresaId);
  };

  const applyQuickScenario = (u: string, p: string, empId: string, autoSubmit = false) => {
    setUsername(u);
    setPassword(p);
    setEmpresaId(empId);
    const res = authenticateErpLogin({
      usernameInput: u,
      passwordInput: p,
      empresaId: empId,
      state: securityState,
    });
    if (!res.ok) {
      setValidationError(res);
    } else {
      setValidationError(null);
      if (autoSubmit) {
        onLoginSuccess(res, empId);
      }
    }
  };

  const selectedCompanyMeta = securityState.companiesConfig.find(
    (c) => c.empresaId === empresaId
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between relative overflow-hidden">
      {/* Background gradients */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -right-32 w-96 h-96 bg-emerald-600/15 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl" />
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Left Column: Login Form */}
          <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl p-8 flex flex-col justify-between backdrop-blur-xl">
            <div>
              {/* Brand Header */}
              <div className="flex items-center justify-between mb-6 pb-5 border-b border-slate-800">
                <div className="flex items-center gap-3.5">
                  <ErpPremiaLogo className="w-12 h-12 rounded-xl shadow-lg" />
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-xl font-extrabold tracking-tight text-white">
                        PREMIA <span className="text-emerald-400">Agentic ERP</span>
                      </h1>
                      <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full">
                        RBAC Security v2.6
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Control de Acceso Multi-Empresa, Roles por Módulo & Agente Vera WhatsApp
                    </p>
                  </div>
                </div>
                <ShieldCheck className="w-8 h-8 text-emerald-400 shrink-0" />
              </div>

              {/* Validation Error Banner (Suspended Company, Inactive User, or Access Denied) */}
              {validationError && !validationError.ok && (
                <div
                  className={`mb-6 rounded-xl p-4 border ${
                    validationError.errorCode === 'EMPRESA_SUSPENDIDA_PAGO'
                      ? 'bg-amber-950/80 border-amber-500/60 text-amber-100'
                      : validationError.errorCode === 'USUARIO_INACTIVO'
                      ? 'bg-rose-950/80 border-rose-500/60 text-rose-100'
                      : 'bg-red-950/80 border-red-500/60 text-red-100'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {validationError.errorCode === 'EMPRESA_SUSPENDIDA_PAGO' ? (
                      <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-bold tracking-wide uppercase">
                          {validationError.errorTitle}
                        </h3>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/30 border border-white/10">
                          {validationError.errorCode}
                        </span>
                      </div>
                      <p className="text-sm mt-1.5 font-medium leading-relaxed">
                        {validationError.errorMessage}
                      </p>

                      {validationError.errorCode === 'EMPRESA_SUSPENDIDA_PAGO' && (
                        <div className="mt-3 pt-2.5 border-t border-amber-500/30 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-200">
                          <span className="flex items-center gap-1.5 font-semibold">
                            <PhoneCall className="w-3.5 h-3.5 text-amber-400" />
                            Soporte Comercial ERP: soporte@innovagile.cl · +56 2 2840 9200
                          </span>
                          {validationError.companyConfig?.motivoSuspensionOBaja && (
                            <span className="text-[11px] bg-amber-900/50 px-2 py-0.5 rounded">
                              Detalle: {validationError.companyConfig.motivoSuspensionOBaja}
                            </span>
                          )}
                        </div>
                      )}

                      {validationError.errorCode === 'USUARIO_INACTIVO' && (
                        <div className="mt-2.5 pt-2 border-t border-rose-500/30 text-xs text-rose-200 flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-rose-400" />
                          <span>
                            Su ficha de usuario se encuentra deshabilitada. Solicite la activación al Administrador de su empresa.
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* 1. Selección de Empresa */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    1. Empresa a Operar
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <select
                      value={empresaId}
                      onChange={(e) => {
                        setEmpresaId(e.target.value);
                        setValidationError(null);
                      }}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-sm text-white font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      {securityState.companiesConfig.map((comp) => {
                        const statusTag =
                          comp.estadoCuenta === 'ACTIVA'
                            ? '🟢 ACTIVA'
                            : comp.estadoCuenta === 'SUSPENDIDA_PAGO'
                            ? '🟠 SUSPENDIDA POR FALTA DE PAGO'
                            : '🔴 DADA DE BAJA';
                        return (
                          <option key={comp.empresaId} value={comp.empresaId}>
                            {comp.razonSocial} (RUT {comp.rut}) — [{statusTag}]
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  {selectedCompanyMeta && (
                    <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400 px-1">
                      <span>
                        RUT: <strong className="text-slate-200">{selectedCompanyMeta.rut}</strong>
                        {selectedCompanyMeta.esEmpresaDuenaErp && (
                          <span className="ml-2 text-indigo-400 font-semibold">
                            ★ Empresa Propietaria del ERP
                          </span>
                        )}
                      </span>
                      <span
                        className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${
                          selectedCompanyMeta.estadoCuenta === 'ACTIVA'
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            : selectedCompanyMeta.estadoCuenta === 'SUSPENDIDA_PAGO'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        }`}
                      >
                        Estado: {selectedCompanyMeta.estadoCuenta.replace('_', ' ')}
                      </span>
                    </div>
                  )}
                </div>

                {/* 2. Usuario */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    2. Usuario o Correo Electrónico
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value);
                        setValidationError(null);
                      }}
                      placeholder="Ej: ssatulovsky, admin, rrhh, contador..."
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* 3. Contraseña */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    3. Contraseña
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setValidationError(null);
                      }}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full mt-2 py-3 px-5 bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-900/40 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <span>Validar Credenciales e Ingresar al ERP</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>

            {/* Security Validation Pipeline Footer */}
            <div className="mt-6 pt-4 border-t border-slate-800/80 grid grid-cols-3 gap-2 text-[11px] text-slate-400">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>1° Estado Empresa</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>2° Usuario Activo</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>3° Rol ERP + Vera WA</span>
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Quick Test Scenarios */}
          <div className="lg:col-span-5 bg-slate-900/75 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between backdrop-blur-xl">
            <div>
              <div className="flex items-center gap-2 text-indigo-300 font-bold text-xs uppercase tracking-wider mb-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>Perfiles Preconfigurados & Pruebas de Validación</span>
              </div>
              <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                Haz clic en cualquiera de los siguientes perfiles para probar de inmediato las reglas de negocio de la Capa de Seguridad:
              </p>

              <div className="space-y-2.5">
                {/* 1. SuperAdmin */}
                <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/30 hover:border-indigo-400/60 transition-all">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        👑 SuperAdmin (Dueño del ERP)
                      </span>
                      <p className="text-[11px] text-slate-300 mt-0.5">
                        Usuario: <code className="text-indigo-300 font-bold">ssatulovsky</code> · Clave:{' '}
                        <code className="text-indigo-300">admin123</code>
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Accede a todas las opciones, crea roles y administra todas las empresas.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        applyQuickScenario('ssatulovsky', 'admin123', 'client-innovagile', true)
                      }
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg shrink-0 cursor-pointer"
                    >
                      Entrar
                    </button>
                  </div>
                </div>

                {/* 2. Admin Cliente + Empresas Anclas */}
                <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 hover:border-emerald-400/60 transition-all">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        🏢 Admin Empresa Cliente + Empresas Anclas
                      </span>
                      <p className="text-[11px] text-slate-300 mt-0.5">
                        Usuario: <code className="text-emerald-300 font-bold">admin</code> · Clave:{' '}
                        <code className="text-emerald-300">admin123</code>
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Administra <strong>Retail Logistics Chile</strong> y su empresa ancla{' '}
                        <strong>Agroindustrial Valle Central</strong>.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        applyQuickScenario('admin', 'admin123', 'client-retail-logistics', true)
                      }
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shrink-0 cursor-pointer"
                    >
                      Entrar
                    </button>
                  </div>
                </div>

                {/* 3. Rol Personalizado RRHH */}
                <div className="p-3 rounded-xl bg-sky-950/30 border border-sky-500/30 hover:border-sky-400/60 transition-all">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        👩‍💼 Rol Personalizado &apos;RRHH&apos; (Solo RRHH y Nómina)
                      </span>
                      <p className="text-[11px] text-slate-300 mt-0.5">
                        Usuario: <code className="text-sky-300 font-bold">rrhh</code> · Clave:{' '}
                        <code className="text-sky-300">rrhh123</code>
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Solo ve los módulos de Agente RRHH y Remuneraciones (también en WhatsApp Vera).
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        applyQuickScenario('rrhh', 'rrhh123', 'client-innovagile', true)
                      }
                      className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-lg shrink-0 cursor-pointer"
                    >
                      Entrar
                    </button>
                  </div>
                </div>

                {/* 4. Prueba Empresa Suspendida por Falta de Pago */}
                <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/30 hover:border-amber-400/60 transition-all">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                        🟠 Probar Validación: Empresa Suspendida por Pago
                      </span>
                      <p className="text-[10px] text-slate-300 mt-0.5">
                        Empresa: <strong>Minera del Sur SpA</strong> (Suspendida por pagos atrasados).
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        applyQuickScenario('ssatulovsky', 'admin123', 'client-minera-sur', false)
                      }
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg shrink-0 cursor-pointer"
                    >
                      Probar Bloqueo
                    </button>
                  </div>
                </div>

                {/* 5. Prueba Usuario Inactivo */}
                <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/30 hover:border-rose-400/60 transition-all">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                        🔴 Probar Validación: Usuario No Activo
                      </span>
                      <p className="text-[10px] text-slate-300 mt-0.5">
                        Usuario: <code className="text-rose-300 font-bold">inactivo</code> · Empresa Activa, pero usuario deshabilitado.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        applyQuickScenario('inactivo', '123456', 'client-innovagile', false)
                      }
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg shrink-0 cursor-pointer"
                    >
                      Probar Bloqueo
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>
                Los permisos de cada Rol controlan tanto el menú del ERP como las respuestas que entrega <strong>Vera por WhatsApp</strong>.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
