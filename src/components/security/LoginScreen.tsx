import React, { useState, useEffect, useMemo } from 'react';
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
  Sliders,
} from 'lucide-react';
import { ErpPremiaLogo } from '../ErpPremiaLogo';
import {
  SecurityRbacStoreState,
  LoginValidationResult,
  authenticateErpLogin,
  resolveCompaniesForLoginUsername,
} from '../../services/securityRbacService';

interface LoginScreenProps {
  securityState: SecurityRbacStoreState;
  onLoginSuccess: (result: LoginValidationResult, selectedEmpresaId: string) => void;
  onToggleTestPanelConfig?: (visible: boolean) => void;
  onRefreshFromServer?: () => Promise<void> | void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  securityState,
  onLoginSuccess,
  onToggleTestPanelConfig,
  onRefreshFromServer,
}) => {
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [empresaId, setEmpresaId] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<LoginValidationResult | null>(null);

  // Visibilidad del panel de pruebas QA (por defecto false para demos limpias con clientes, o según configuración)
  const [showQaPanel, setShowQaPanel] = useState<boolean>(
    Boolean(securityState.mostrarPanelPruebasLogin)
  );

  useEffect(() => {
    setShowQaPanel(Boolean(securityState.mostrarPanelPruebasLogin));
  }, [securityState.mostrarPanelPruebasLogin]);

  // Al abrir la pantalla de Login en una sesión nueva, sincronizar inmediatamente con el servidor
  useEffect(() => {
    if (onRefreshFromServer) {
      onRefreshFromServer();
    }
  }, []);

  // Resolver dinámicamente las empresas que pertenecen al UserID ingresado (Privacidad Multi-Tenant)
  const userCompanyResolution = useMemo(
    () => resolveCompaniesForLoginUsername(username, securityState),
    [username, securityState]
  );

  // Si el usuario ingresa un username que aún no está en caché local (ej. creado en otra sesión), consultar al servidor
  useEffect(() => {
    if (
      username.trim().length >= 2 &&
      !userCompanyResolution.matchedUser &&
      onRefreshFromServer
    ) {
      const timer = setTimeout(() => {
        onRefreshFromServer();
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [username, userCompanyResolution.matchedUser]);

  const allowedCompaniesForUser = userCompanyResolution.allowedCompanies;

  // Autoseleccionar la empresa principal del usuario cuando ingresa su UserID
  useEffect(() => {
    if (allowedCompaniesForUser.length > 0) {
      const stillValid = allowedCompaniesForUser.some((c) => c.empresaId === empresaId);
      if (!stillValid) {
        setEmpresaId(
          userCompanyResolution.defaultCompanyId || allowedCompaniesForUser[0].empresaId
        );
      }
    } else {
      setEmpresaId('');
    }
  }, [allowedCompaniesForUser, userCompanyResolution.defaultCompanyId, empresaId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresaId) {
      setValidationError({
        ok: false,
        errorCode: 'CREDENCIALES_INVALIDAS',
        errorTitle: 'Usuario o Empresa no identificados',
        errorMessage:
          'Ingrese un usuario válido para desplegar y seleccionar las empresas autorizadas en su perfil.',
      });
      return;
    }

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

  const handleToggleQaPanel = () => {
    const next = !showQaPanel;
    setShowQaPanel(next);
    if (onToggleTestPanelConfig) {
      onToggleTestPanelConfig(next);
    }
  };

  const selectedCompanyMeta = allowedCompaniesForUser.find(
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
        <div
          className={`w-full transition-all duration-300 ${
            showQaPanel
              ? 'max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch'
              : 'max-w-xl mx-auto'
          }`}
        >
          {/* Login Card */}
          <div
            className={`${
              showQaPanel ? 'lg:col-span-7' : 'w-full'
            } bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl p-8 flex flex-col justify-between backdrop-blur-xl`}
          >
            <div>
              {/* Brand Header (Fixed Emblem + Clean Typography without overlap) */}
              <div className="flex items-center justify-between gap-4 mb-6 pb-5 border-b border-slate-800">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="p-2 rounded-xl bg-slate-950/90 border border-slate-800 shadow-lg shrink-0">
                    <ErpPremiaLogo variant="emblem" size="md" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className="text-xl font-extrabold tracking-tight text-white leading-tight">
                        ERP<span className="text-sky-400">premIA</span>{' '}
                        <span className="text-emerald-400 font-bold text-base">Agentic ERP</span>
                      </h1>
                      <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full">
                        Acceso Seguro
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 truncate">
                      Plataforma Contable, Tributaria & Gestión Multi-Agente con IA
                    </p>
                  </div>
                </div>
                <ShieldCheck className="w-7 h-7 text-emerald-400 shrink-0" />
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

              {/* Form: 1° Usuario -> 2° Contraseña -> 3° Empresas asociadas al Usuario */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* 1. Usuario */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    1. Usuario o Correo Electrónico
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      autoComplete="username"
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value);
                        setValidationError(null);
                      }}
                      placeholder="Ingrese su ID de usuario o correo corporativo"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* 2. Contraseña */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    2. Contraseña
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
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

                {/* 3. Selección de Empresa (Privacidad Multi-Empresa: solo muestra las empresas vinculadas al UserID) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                      3. Empresa a Operar
                    </label>
                    {userCompanyResolution.matchedUser && userCompanyResolution.role && (
                      <span className="text-[11px] font-semibold text-emerald-400">
                        {allowedCompaniesForUser.length === 1
                          ? '1 empresa asignada'
                          : `${allowedCompaniesForUser.length} empresas habilitadas (${userCompanyResolution.role.nombre})`}
                      </span>
                    )}
                  </div>

                  <div className="relative">
                    <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    {allowedCompaniesForUser.length === 0 ? (
                      <div className="w-full pl-10 pr-4 py-2.5 bg-slate-900/70 border border-slate-800 rounded-xl text-xs text-slate-500 italic select-none">
                        {username.trim().length === 0
                          ? 'Ingrese primero su Usuario para cargar sus empresas autorizadas...'
                          : 'Verificando empresas asignadas al usuario...'}
                      </div>
                    ) : (
                      <select
                        value={empresaId}
                        onChange={(e) => {
                          setEmpresaId(e.target.value);
                          setValidationError(null);
                        }}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-sm text-white font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        {allowedCompaniesForUser.map((comp) => (
                          <option key={comp.empresaId} value={comp.empresaId}>
                            {comp.razonSocial} (RUT {comp.rut})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {selectedCompanyMeta && (
                    <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400 px-1">
                      <span>
                        RUT: <strong className="text-slate-200">{selectedCompanyMeta.rut}</strong>
                      </span>
                      <span className="text-slate-400">
                        Perfil: <strong className="text-indigo-300">{userCompanyResolution.role?.nombre}</strong>
                      </span>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full mt-2 py-3 px-5 bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-900/40 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <span>Ingresar al Sistema</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>

            {/* Footer with discreet QA Panel toggle */}
            <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500/80 shrink-0" />
                  Privacidad Multi-RUT
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500/80 shrink-0" />
                  Sincronizado con Vera
                </span>
              </div>

              <button
                type="button"
                onClick={handleToggleQaPanel}
                className="text-[11px] text-slate-500 hover:text-slate-300 flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-800/60 transition-colors cursor-pointer"
                title="Mostrar u ocultar el panel de perfiles de prueba (configurable también desde Seguridad & Roles)"
              >
                <Sliders className="w-3 h-3" />
                <span>{showQaPanel ? 'Ocultar Panel QA (Modo Demo)' : 'Accesos QA'}</span>
              </button>
            </div>
          </div>

          {/* Right Column: Interactive Quick Test Scenarios (Only visible when enabled) */}
          {showQaPanel && (
            <div className="lg:col-span-5 bg-slate-900/75 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between backdrop-blur-xl animate-in fade-in duration-200">
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 text-indigo-300 font-bold text-xs uppercase tracking-wider">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    <span>Perfiles de Prueba (Modo QA)</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleQaPanel}
                    className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                  >
                    Ocultar para Demo ✕
                  </button>
                </div>
                <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                  Panel visible solo en modo pruebas. Al seleccionar un usuario verás que el selector de empresas solo carga las empresas de su rol:
                </p>

                <div className="space-y-2.5">
                  {/* 1. SuperAdmin */}
                  <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/30 hover:border-indigo-400/60 transition-all">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold text-white flex items-center gap-1.5">
                          👑 SuperAdmin (Dueño del ERP)
                        </span>
                        <p className="text-[11px] text-slate-300 mt-0.5">
                          Usuario: <code className="text-indigo-300 font-bold">ssatulovsky</code> · Clave:{' '}
                          <code className="text-indigo-300">admin123</code>
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Ve las 4 empresas del sistema y todos los módulos.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          applyQuickScenario('ssatulovsky', 'admin123', 'client-innovagile', false)
                        }
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg shrink-0 cursor-pointer"
                      >
                        Cargar
                      </button>
                    </div>
                  </div>

                  {/* 2. Admin Cliente + Empresas Anclas */}
                  <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 hover:border-emerald-400/60 transition-all">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold text-white flex items-center gap-1.5">
                          🏢 Admin Cliente + Empresas Anclas
                        </span>
                        <p className="text-[11px] text-slate-300 mt-0.5">
                          Usuario: <code className="text-emerald-300 font-bold">admin</code> · Clave:{' '}
                          <code className="text-emerald-300">admin123</code>
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Solo ve <strong>Retail Logistics</strong> y su ancla <strong>Agroindustrial Valle Central</strong> (no ve las demás empresas).
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          applyQuickScenario('admin', 'admin123', 'client-retail-logistics', false)
                        }
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shrink-0 cursor-pointer"
                      >
                        Cargar
                      </button>
                    </div>
                  </div>

                  {/* 3. Rol Personalizado RRHH */}
                  <div className="p-3 rounded-xl bg-sky-950/30 border border-sky-500/30 hover:border-sky-400/60 transition-all">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold text-white flex items-center gap-1.5">
                          👩‍💼 Rol &apos;RRHH&apos; (Solo RRHH y Nómina)
                        </span>
                        <p className="text-[11px] text-slate-300 mt-0.5">
                          Usuario: <code className="text-sky-300 font-bold">rrhh</code> · Clave:{' '}
                          <code className="text-sky-300">rrhh123</code>
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Solo ve su empresa asignada y únicamente los módulos de RRHH y Remuneraciones.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          applyQuickScenario('rrhh', 'rrhh123', 'client-innovagile', false)
                        }
                        className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-lg shrink-0 cursor-pointer"
                      >
                        Cargar
                      </button>
                    </div>
                  </div>

                  {/* 4. Prueba Empresa Suspendida por Falta de Pago */}
                  <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/30 hover:border-amber-400/60 transition-all">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                          🟠 Empresa Suspendida por Falta de Pago
                        </span>
                        <p className="text-[10px] text-slate-300 mt-0.5">
                          Usuario: <code className="text-amber-300 font-bold">minera</code> · Empresa: <strong>Minera del Sur SpA</strong>.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          applyQuickScenario('minera', '123456', 'client-minera-sur', false)
                        }
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg shrink-0 cursor-pointer"
                      >
                        Probar Bloqueo
                      </button>
                    </div>
                  </div>

                  {/* 5. Prueba Usuario Inactivo */}
                  <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/30 hover:border-rose-400/60 transition-all">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                          🔴 Usuario No Activo en Sistema
                        </span>
                        <p className="text-[10px] text-slate-300 mt-0.5">
                          Usuario: <code className="text-rose-300 font-bold">inactivo</code> · Empresa Activa, usuario deshabilitado.
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
                  Puedes dejar este panel oculto por defecto desde <strong>Seguridad & Roles</strong> o con el botón <em>Ocultar para Demo</em>.
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
