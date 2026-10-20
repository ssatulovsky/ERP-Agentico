import React, { useState } from 'react';
import {
  ShieldCheck,
  Users,
  KeyRound,
  Building2,
  Plus,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Edit3,
  Trash2,
  Smartphone,
  Lock,
  Unlock,
  Link2,
  Save,
  Sparkles,
  CheckSquare,
  Square,
  MessageSquare,
} from 'lucide-react';
import {
  SecurityRbacStoreState,
  SecurityRole,
  SecurityUser,
  CompanySecurityConfig,
  CompanyCommercialStatus,
  ErpModuleId,
  ERP_MODULES_CATALOG,
  WHATSAPP_AGENT_SCOPES_CATALOG,
  deriveWhatsappScopesFromModules,
  evaluateWhatsappPhoneAgainstRbac,
} from '../../services/securityRbacService';

interface SecurityManagementModuleProps {
  securityState: SecurityRbacStoreState;
  currentUser: SecurityUser;
  currentRole: SecurityRole;
  activeCompanyId: string;
  onUpdateSecurityState: (nextState: SecurityRbacStoreState) => void;
}

export const SecurityManagementModule: React.FC<SecurityManagementModuleProps> = ({
  securityState,
  currentUser,
  currentRole,
  activeCompanyId,
  onUpdateSecurityState,
}) => {
  const isSuperAdmin = currentRole.tipoSistema === 'SUPERADMIN';
  const isAdmin = currentRole.tipoSistema === 'ADMIN' || isSuperAdmin;

  const [activeSubTab, setActiveSubTab] = useState<'roles' | 'users' | 'companies' | 'whatsapp_test'>('roles');
  const [bannerMsg, setBannerMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Role Editor State
  const [editingRole, setEditingRole] = useState<SecurityRole | null>(null);
  const [roleName, setRoleName] = useState<string>('');
  const [roleCode, setRoleCode] = useState<string>('');
  const [roleDesc, setRoleDesc] = useState<string>('');
  const [roleModules, setRoleModules] = useState<ErpModuleId[]>(['hr_agent', 'payroll']);
  const [showRoleModal, setShowRoleModal] = useState<boolean>(false);

  // User Editor State
  const [editingUser, setEditingUser] = useState<SecurityUser | null>(null);
  const [uUsername, setUUsername] = useState<string>('');
  const [uPassword, setUPassword] = useState<string>('');
  const [uNombre, setUNombre] = useState<string>('');
  const [uCargo, setUCargo] = useState<string>('');
  const [uEmail, setUEmail] = useState<string>('');
  const [uPhone, setUPhone] = useState<string>('');
  const [uEstado, setUEstado] = useState<'ACTIVO' | 'INACTIVO'>('ACTIVO');
  const [uRolId, setURolId] = useState<string>('role-rrhh');
  const [uEmpresaId, setUEmpresaId] = useState<string>(activeCompanyId);
  const [uAnclasIds, setUAnclasIds] = useState<string[]>([]);
  const [showUserModal, setShowUserModal] = useState<boolean>(false);

  // WhatsApp Vera RBAC Simulator State
  const [simSelectedUserId, setSimSelectedUserId] = useState<string>(
    securityState.users.find((u) => u.rolId === 'role-rrhh')?.id || securityState.users[0]?.id || ''
  );
  const [simQuery, setSimQuery] = useState<string>('@vera ¿Cuánto hay que pagar de sueldos y Previred este mes?');
  const [simResult, setSimResult] = useState<{
    allowed: boolean;
    title: string;
    detail: string;
    whatsappReply: string;
  } | null>(null);

  const notify = (type: 'success' | 'error', text: string) => {
    setBannerMsg({ type, text });
    setTimeout(() => setBannerMsg(null), 5000);
  };

  // Empresas visibles para el administrador actual
  const manageableCompanyIds = React.useMemo(() => {
    if (isSuperAdmin) {
      return securityState.companiesConfig.map((c) => c.empresaId);
    }
    const set = new Set<string>([currentUser.empresaPrincipalId, activeCompanyId]);
    (currentUser.empresasAnclasPermitidas || []).forEach((id) => set.add(id));
    const primaryComp = securityState.companiesConfig.find(
      (c) => c.empresaId === currentUser.empresaPrincipalId
    );
    (primaryComp?.empresasAnclasIds || []).forEach((id) => set.add(id));
    return Array.from(set);
  }, [isSuperAdmin, securityState.companiesConfig, currentUser, activeCompanyId]);

  const visibleCompanies = securityState.companiesConfig.filter((c) =>
    manageableCompanyIds.includes(c.empresaId)
  );

  const visibleUsers = securityState.users.filter((u) => {
    if (isSuperAdmin) return true;
    return manageableCompanyIds.includes(u.empresaPrincipalId);
  });

  // ============================================================================
  // HANDLERS DE ROLES
  // ============================================================================
  const openCreateRoleModal = () => {
    setEditingRole(null);
    setRoleName('');
    setRoleCode('');
    setRoleDesc('');
    setRoleModules(['hr_agent', 'payroll']);
    setShowRoleModal(true);
  };

  const openEditRoleModal = (role: SecurityRole) => {
    setEditingRole(role);
    setRoleName(role.nombre);
    setRoleCode(role.codigo);
    setRoleDesc(role.descripcion);
    setRoleModules([...role.modulosPermitidos]);
    setShowRoleModal(true);
  };

  const toggleRoleModule = (modId: ErpModuleId) => {
    setRoleModules((prev) =>
      prev.includes(modId) ? prev.filter((m) => m !== modId) : [...prev, modId]
    );
  };

  const handleSaveRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleName.trim()) {
      notify('error', 'Debe ingresar un nombre para el Rol.');
      return;
    }
    if (roleModules.length === 0) {
      notify('error', 'Debe asignar al menos un módulo del ERP al Rol.');
      return;
    }

    const computedWhatsappScopes = deriveWhatsappScopesFromModules(roleModules, 'CUSTOM');
    const cleanCode =
      (roleCode || roleName)
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9_]/g, '_') || 'ROL_CUSTOM';

    if (editingRole) {
      const updatedRoles = securityState.roles.map((r) =>
        r.id === editingRole.id
          ? {
              ...r,
              nombre: roleName.trim(),
              codigo: cleanCode,
              descripcion: roleDesc.trim() || `Acceso a ${roleModules.length} módulos del ERP.`,
              modulosPermitidos: roleModules,
              whatsappScopesPermitidos: computedWhatsappScopes,
              fechaActualizacion: new Date().toISOString().slice(0, 10),
            }
          : r
      );
      onUpdateSecurityState({
        ...securityState,
        roles: updatedRoles,
      });
      notify(
        'success',
        `Rol "${roleName}" actualizado correctamente. Permisos sincronizados con Vera en WhatsApp.`
      );
    } else {
      const newRole: SecurityRole = {
        id: `role-custom-${Date.now()}`,
        nombre: roleName.trim(),
        codigo: cleanCode,
        tipoSistema: 'CUSTOM',
        empresaScopeId: isSuperAdmin ? 'GLOBAL' : activeCompanyId,
        descripcion: roleDesc.trim() || `Rol personalizado con acceso a ${roleModules.length} módulos.`,
        modulosPermitidos: roleModules,
        whatsappScopesPermitidos: computedWhatsappScopes,
        esEditable: true,
        creadoPor: currentUser.username,
        fechaActualizacion: new Date().toISOString().slice(0, 10),
      };
      onUpdateSecurityState({
        ...securityState,
        roles: [...securityState.roles, newRole],
      });
      notify(
        'success',
        `Rol "${newRole.nombre}" creado con éxito (${computedWhatsappScopes.length} alcances de agentes en WhatsApp Vera).`
      );
    }
    setShowRoleModal(false);
  };

  const handleDeleteRole = (role: SecurityRole) => {
    if (!role.esEditable) return;
    const assignedUsers = securityState.users.filter((u) => u.rolId === role.id);
    if (assignedUsers.length > 0) {
      notify(
        'error',
        `No se puede eliminar el rol "${role.nombre}" porque está asignado a ${assignedUsers.length} usuario(s). Reasigne esos usuarios primero.`
      );
      return;
    }
    onUpdateSecurityState({
      ...securityState,
      roles: securityState.roles.filter((r) => r.id !== role.id),
    });
    notify('success', `Rol "${role.nombre}" eliminado.`);
  };

  // ============================================================================
  // HANDLERS DE USUARIOS
  // ============================================================================
  const openCreateUserModal = () => {
    setEditingUser(null);
    setUUsername('');
    setUPassword('123456');
    setUNombre('');
    setUCargo('');
    setUEmail('');
    setUPhone('569');
    setUEstado('ACTIVO');
    setURolId('role-rrhh');
    setUEmpresaId(activeCompanyId);
    setUAnclasIds([]);
    setShowUserModal(true);
  };

  const openEditUserModal = (user: SecurityUser) => {
    setEditingUser(user);
    setUUsername(user.username);
    setUPassword(user.password);
    setUNombre(user.nombreCompleto);
    setUCargo(user.cargo);
    setUEmail(user.email);
    setUPhone(user.telefonoWhatsapp);
    setUEstado(user.estado);
    setURolId(user.rolId);
    setUEmpresaId(user.empresaPrincipalId);
    setUAnclasIds([...(user.empresasAnclasPermitidas || [])]);
    setShowUserModal(true);
  };

  const toggleUserAnchorCompany = (compId: string) => {
    setUAnclasIds((prev) =>
      prev.includes(compId) ? prev.filter((id) => id !== compId) : [...prev, compId]
    );
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uUsername.trim() || !uPassword.trim() || !uNombre.trim()) {
      notify('error', 'Complete usuario, contraseña y nombre completo.');
      return;
    }

    if (editingUser) {
      const updatedUsers = securityState.users.map((u) =>
        u.id === editingUser.id
          ? {
              ...u,
              username: uUsername.trim(),
              password: uPassword.trim(),
              nombreCompleto: uNombre.trim(),
              cargo: uCargo.trim(),
              email: uEmail.trim(),
              telefonoWhatsapp: uPhone.replace(/[^0-9]/g, ''),
              estado: uEstado,
              rolId: uRolId,
              empresaPrincipalId: uEmpresaId,
              empresasAnclasPermitidas: uAnclasIds,
            }
          : u
      );
      onUpdateSecurityState({
        ...securityState,
        users: updatedUsers,
      });
      notify('success', `Usuario "${uUsername}" actualizado y sincronizado con Vera WhatsApp.`);
    } else {
      const newUser: SecurityUser = {
        id: `usr-${Date.now()}`,
        username: uUsername.trim(),
        password: uPassword.trim(),
        nombreCompleto: uNombre.trim(),
        cargo: uCargo.trim() || 'Operador ERP',
        email: uEmail.trim(),
        telefonoWhatsapp: uPhone.replace(/[^0-9]/g, ''),
        estado: uEstado,
        rolId: uRolId,
        empresaPrincipalId: uEmpresaId,
        empresasAnclasPermitidas: uAnclasIds,
        recibirAudioWhatsapp: false,
      };
      onUpdateSecurityState({
        ...securityState,
        users: [...securityState.users, newUser],
      });
      notify('success', `Usuario "${newUser.username}" creado exitosamente.`);
    }
    setShowUserModal(false);
  };

  const handleToggleUserStatus = (user: SecurityUser) => {
    const nextStatus = user.estado === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO';
    const updatedUsers = securityState.users.map((u) =>
      u.id === user.id ? { ...u, estado: nextStatus } : u
    );
    onUpdateSecurityState({
      ...securityState,
      users: updatedUsers,
    });
    notify(
      'success',
      `Estado del usuario "${user.username}" cambiado a ${nextStatus}.`
    );
  };

  // ============================================================================
  // HANDLERS DE EMPRESAS & EMPRESAS ANCLAS
  // ============================================================================
  const handleChangeCompanyStatus = (
    empresaId: string,
    nuevoEstado: CompanyCommercialStatus,
    motivo?: string
  ) => {
    if (!isSuperAdmin) {
      notify('error', 'Solo el SuperAdmin (dueño del ERP) puede cambiar el estado comercial de las empresas.');
      return;
    }
    const updatedCompanies = securityState.companiesConfig.map((c) =>
      c.empresaId === empresaId
        ? {
            ...c,
            estadoCuenta: nuevoEstado,
            motivoSuspensionOBaja:
              nuevoEstado === 'SUSPENDIDA_PAGO'
                ? motivo || 'Cuenta suspendida por pagos atrasados.'
                : nuevoEstado === 'BAJA'
                ? motivo || 'Cuenta dada de baja.'
                : undefined,
            fechaUltimoCambioEstado: new Date().toISOString().slice(0, 10),
          }
        : c
    );
    onUpdateSecurityState({
      ...securityState,
      companiesConfig: updatedCompanies,
    });
    notify(
      'success',
      `Estado de empresa actualizado a ${nuevoEstado.replace('_', ' ')}.`
    );
  };

  const handleToggleCompanyAnchor = (parentCompanyId: string, anchorCompanyId: string) => {
    if (!isAdmin) return;
    const updatedCompanies = securityState.companiesConfig.map((c) => {
      if (c.empresaId !== parentCompanyId) return c;
      const exists = (c.empresasAnclasIds || []).includes(anchorCompanyId);
      const nextAnchors = exists
        ? c.empresasAnclasIds.filter((id) => id !== anchorCompanyId)
        : [...(c.empresasAnclasIds || []), anchorCompanyId];
      return {
        ...c,
        empresasAnclasIds: nextAnchors,
      };
    });
    onUpdateSecurityState({
      ...securityState,
      companiesConfig: updatedCompanies,
    });
    notify('success', 'Relación de Empresas Anclas actualizada.');
  };

  // ============================================================================
  // SIMULADOR DE VALIDACIÓN VERA WHATSAPP
  // ============================================================================
  const runWhatsappVeraSimulation = () => {
    const targetUser = securityState.users.find((u) => u.id === simSelectedUserId);
    if (!targetUser) return;

    const evalRes = evaluateWhatsappPhoneAgainstRbac(
      targetUser.telefonoWhatsapp,
      securityState
    );

    if (evalRes.statusValidation !== 'OK_AUTORIZADO') {
      setSimResult({
        allowed: false,
        title: `BLOQUEADO POR CAPA DE SEGURIDAD (${evalRes.statusValidation})`,
        detail: `Vera verificó primero el estado de la Empresa y del Usuario antes de procesar la consulta.`,
        whatsappReply: evalRes.blockMessageForWhatsapp || 'Acceso bloqueado.',
      });
      return;
    }

    // Detectar qué alcance pide la pregunta simulada
    const norm = simQuery
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    const reqScopes: string[] = [];
    if (/(rrhh|remuneraci|sueldo|nomina|previred|afp|vacaciones|personal)/.test(norm)) {
      reqScopes.push('RRHH_REMUNERACIONES');
    }
    if (/(inventario|bodega|stock|existencia|pano|dyneema)/.test(norm)) {
      reqScopes.push('BODEGA_INVENTARIO');
    }
    if (/(banco|bancario|conciliacion|cartola|cuenta corriente)/.test(norm)) {
      reqScopes.push('BANCOS_CONCILIACION');
    }
    if (/(flujo|caja|liquidez)/.test(norm)) {
      reqScopes.push('FLUJO_CAJA');
    }
    if (/(f29|impuesto|iva|sii|rcv)/.test(norm)) {
      reqScopes.push('TRIBUTARIO_F29');
    }
    if (/(contabilidad|balance|asiento|libro)/.test(norm)) {
      reqScopes.push('CONTABILIDAD_IFRS');
    }

    const denied = reqScopes.filter(
      (s) => !evalRes.allowedWhatsappScopes.includes(s as any)
    );

    if (denied.length > 0) {
      setSimResult({
        allowed: false,
        title: `ACCESO DENEGADO POR ROL "${evalRes.role?.nombre}"`,
        detail: `El usuario ${targetUser.username} está ACTIVO y su empresa está ACTIVA, pero su Rol (${evalRes.role?.nombre}) solo permite [${evalRes.allowedWhatsappScopes.join(', ')}] y la consulta requiere [${denied.join(', ')}].`,
        whatsappReply: `🔒 *ACCESO RESTRINGIDO POR ROL DE SEGURIDAD*\n\nHola *${targetUser.nombreCompleto}*, tu consulta requiere acceso a: ⛔ *${denied.join(' + ')}*.\n\nTu Rol actual (*${evalRes.role?.nombre}*) cuenta con autorización exclusiva para:\n${evalRes.allowedWhatsappScopes.map((s) => `✅ *${s}*`).join('\n')}\n\n_Por políticas de seguridad del ERP, Vera no puede entregarte información de módulos fuera de tu Rol._`,
      });
    } else {
      setSimResult({
        allowed: true,
        title: `CONSULTA AUTORIZADA PARA ROL "${evalRes.role?.nombre}"`,
        detail: `1° Empresa ACTIVA (${evalRes.companyConfig?.razonSocial}) · 2° Usuario ACTIVO (${targetUser.username}) · 3° Rol "${evalRes.role?.nombre}" posee los permisos requeridos (${reqScopes.join(', ') || 'Saludo/Menú'}).`,
        whatsappReply: `👩‍💼 *Vera — Respuesta Autorizada (${evalRes.role?.nombre})*\nHola *${targetUser.nombreCompleto}*, he validado tus permisos en *${evalRes.companyConfig?.nombreCorto}* y coordinado la información solicitada con los agentes de tu área: *${(reqScopes.length ? reqScopes : evalRes.allowedWhatsappScopes).join(', ')}*.`,
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-xl border border-indigo-500/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3.5 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-300">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl font-extrabold tracking-tight">
                  Capa de Seguridad, Roles RBAC & Empresas Anclas
                </h1>
                <span className="px-2.5 py-0.5 text-xs font-bold uppercase rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Rol Actual: {currentRole.nombre}
                </span>
              </div>
              <p className="text-sm text-slate-300 mt-1">
                Gobierno unificado de accesos por Empresa, Estado Comercial (Activa / Suspendida por Pago / Baja), Usuarios, creación libre de Roles por módulo y sincronización directa con <strong>Vera en WhatsApp</strong>.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                const nextVal = !securityState.mostrarPanelPruebasLogin;
                onUpdateSecurityState({
                  ...securityState,
                  mostrarPanelPruebasLogin: nextVal,
                });
                notify(
                  'success',
                  nextVal
                    ? 'Panel de Perfiles de Prueba (QA) HABILITADO en la pantalla de Login.'
                    : 'Modo Demo Cliente ACTIVO: Panel de Perfiles de Prueba OCULTO en la pantalla de Login.'
                );
              }}
              className={`px-3.5 py-2.5 text-xs font-bold rounded-xl border flex items-center gap-2 transition-all cursor-pointer ${
                securityState.mostrarPanelPruebasLogin
                  ? 'bg-amber-500/20 text-amber-200 border-amber-400/40 hover:bg-amber-500/30'
                  : 'bg-slate-800/90 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
              title="Configura si en la pantalla de Login se ven o se ocultan los botones de prueba rápida"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>
                {securityState.mostrarPanelPruebasLogin
                  ? 'Login: Panel Pruebas Visible (QA)'
                  : 'Login: Modo Demo Cliente (Pruebas Ocultas)'}
              </span>
            </button>
            <button
              type="button"
              onClick={openCreateRoleModal}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Crear Nuevo Rol</span>
            </button>
            <button
              type="button"
              onClick={openCreateUserModal}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Usuario</span>
            </button>
          </div>
        </div>

        {/* Sub-navigation */}
        <div className="mt-6 pt-4 border-t border-slate-800 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveSubTab('roles')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeSubTab === 'roles'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>1. Roles y Módulos Permitidos ({securityState.roles.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('users')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeSubTab === 'users'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>2. Usuarios del Sistema & WhatsApp ({visibleUsers.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('companies')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeSubTab === 'companies'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>3. Estado de Empresas & Empresas Anclas ({visibleCompanies.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('whatsapp_test')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeSubTab === 'whatsapp_test'
                ? 'bg-emerald-600 text-white shadow-lg'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>4. Probador de Permisos en Vera (WhatsApp)</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {bannerMsg && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between ${
            bannerMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2.5 text-sm font-semibold">
            {bannerMsg.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600" />
            )}
            <span>{bannerMsg.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setBannerMsg(null)}
            className="text-xs font-bold underline"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* TAB 1: ROLES Y MÓDULOS */}
      {activeSubTab === 'roles' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Catálogo de Roles del Sistema & Creación Libre de Perfiles
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Además de <strong>SuperAdmin</strong> (dueño del ERP) y <strong>Admin</strong> (administrador de empresa cliente y sus empresas anclas), puedes crear cualquier Rol personalizado (como <strong>&apos;RRHH&apos;</strong>) seleccionando exactamente qué módulos y agentes puede ver tanto en la web como por WhatsApp con Vera.
              </p>
            </div>
            <button
              type="button"
              onClick={openCreateRoleModal}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-2 shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Crear Nuevo Rol Personalizado</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {securityState.roles.map((role) => {
              const assignedCount = securityState.users.filter((u) => u.rolId === role.id).length;
              return (
                <div
                  key={role.id}
                  className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between hover:border-indigo-300 transition-all"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-extrabold text-slate-900">
                            {role.nombre}
                          </h3>
                          <span
                            className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full ${
                              role.tipoSistema === 'SUPERADMIN'
                                ? 'bg-indigo-100 text-indigo-800 border border-indigo-300'
                                : role.tipoSistema === 'ADMIN'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-sky-100 text-sky-800 border border-sky-300'
                            }`}
                          >
                            {role.tipoSistema === 'SUPERADMIN'
                              ? 'Rol Maestro ERP'
                              : role.tipoSistema === 'ADMIN'
                              ? 'Admin Empresa + Anclas'
                              : 'Rol Personalizado'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1">{role.descripcion}</p>
                      </div>

                      {role.esEditable && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditRoleModal(role)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg cursor-pointer"
                            title="Editar módulos del rol"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRole(role)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                            title="Eliminar rol"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Módulos ERP habilitados */}
                    <div className="mt-4">
                      <div className="text-[11px] font-bold uppercase text-slate-500 mb-1.5">
                        Módulos ERP Habilitados ({role.modulosPermitidos.length} de {ERP_MODULES_CATALOG.length}):
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {role.tipoSistema === 'SUPERADMIN' || role.tipoSistema === 'ADMIN' ? (
                          <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold">
                            ✅ Acceso Total a Todos los Módulos del ERP (18/18)
                          </span>
                        ) : (
                          role.modulosPermitidos.map((modId) => {
                            const meta = ERP_MODULES_CATALOG.find((m) => m.id === modId);
                            return (
                              <span
                                key={modId}
                                className="px-2 py-0.5 bg-slate-100 text-slate-800 border border-slate-200 rounded-md text-[11px] font-semibold"
                              >
                                {meta?.nombre || modId}
                              </span>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Alcances en Vera WhatsApp */}
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <div className="text-[11px] font-bold uppercase text-emerald-700 mb-1 flex items-center gap-1">
                        <Smartphone className="w-3.5 h-3.5" />
                        <span>Permisos que controla Vera en WhatsApp para este Rol:</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {role.whatsappScopesPermitidos.map((scopeId) => {
                          const sMeta = WHATSAPP_AGENT_SCOPES_CATALOG.find(
                            (s) => s.id === scopeId
                          );
                          return (
                            <span
                              key={scopeId}
                              className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded text-[10px] font-bold"
                            >
                              {sMeta?.nombre || scopeId}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <span>
                      Usuarios con este rol: <strong className="text-slate-800">{assignedCount}</strong>
                    </span>
                    {role.esEditable ? (
                      <button
                        type="button"
                        onClick={() => openEditRoleModal(role)}
                        className="text-indigo-600 hover:underline font-bold cursor-pointer"
                      >
                        Configurar Módulos →
                      </button>
                    ) : (
                      <span className="text-slate-400 italic">Rol base del sistema</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: USUARIOS */}
      {activeSubTab === 'users' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Nómina de Usuarios del Sistema, Estado Activo/Inactivo & Teléfono WhatsApp
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Si un usuario está marcado como <strong>INACTIVO</strong>, el sistema bloquea su login mostrando <em>&quot;Usuario no activo en sistema, comuníquese con su administrador&quot;</em> y Vera también bloquea sus consultas por WhatsApp.
              </p>
            </div>
            <button
              type="button"
              onClick={openCreateUserModal}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Crear Usuario</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                  <th className="py-3 px-4">Usuario / Credencial</th>
                  <th className="py-3 px-4">Estado Usuario</th>
                  <th className="py-3 px-4">Rol Asignado</th>
                  <th className="py-3 px-4">Empresa Principal & Anclas</th>
                  <th className="py-3 px-4">WhatsApp Asociado (Vera)</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {visibleUsers.map((u) => {
                  const role = securityState.roles.find((r) => r.id === u.rolId);
                  const comp = securityState.companiesConfig.find(
                    (c) => c.empresaId === u.empresaPrincipalId
                  );
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/80">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{u.nombreCompleto}</div>
                        <div className="text-slate-500">
                          Login: <code className="font-mono font-bold text-indigo-600">{u.username}</code> · Clave:{' '}
                          <code className="font-mono text-slate-600">{u.password}</code>
                        </div>
                        <div className="text-[11px] text-slate-400">{u.email}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            u.estado === 'ACTIVO'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-rose-100 text-rose-800 border border-rose-300'
                          }`}
                        >
                          {u.estado === 'ACTIVO' ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-rose-600" />
                          )}
                          {u.estado}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-bold text-indigo-900 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-lg inline-block">
                          {role?.nombre || u.rolId}
                        </span>
                        <div className="text-[11px] text-slate-500 mt-1">
                          {role?.tipoSistema === 'SUPERADMIN' || role?.tipoSistema === 'ADMIN'
                            ? 'Todos los módulos ERP'
                            : `${role?.modulosPermitidos.length || 0} módulo(s) habilitados`}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">
                          {comp?.razonSocial || u.empresaPrincipalId}
                        </div>
                        {role?.tipoSistema === 'SUPERADMIN' ? (
                          <span className="text-[11px] text-indigo-600 font-semibold">
                            ★ Acceso Global a todas las empresas
                          </span>
                        ) : (
                          u.empresasAnclasPermitidas?.length > 0 && (
                            <div className="text-[11px] text-emerald-700 mt-0.5">
                              + {u.empresasAnclasPermitidas.length} empresa(s) ancla habilitada(s)
                            </div>
                          )
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        {u.telefonoWhatsapp ? (
                          <div className="flex items-center gap-1.5 font-mono text-slate-800 font-semibold">
                            <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                            <span>+{u.telefonoWhatsapp}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Sin teléfono</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleToggleUserStatus(u)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer ${
                              u.estado === 'ACTIVO'
                                ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                                : 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                            }`}
                          >
                            {u.estado === 'ACTIVO' ? 'Desactivar' : 'Activar'}
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditUserModal(u)}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 cursor-pointer"
                          >
                            Editar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: EMPRESAS, ESTADOS COMERCIALES & EMPRESAS ANCLAS */}
      {activeSubTab === 'companies' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
            <h2 className="text-base font-bold text-slate-900">
              Control de Estado de Empresas (Activa / Suspendida por Falta de Pago / Dada de Baja) y Empresas Anclas
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              1) Si una empresa está en estado <strong>SUSPENDIDA_PAGO</strong>, ningún usuario podrá ingresar a ella y verá el mensaje: <em>&quot;La cuenta de empresa está suspendida por pagos atrasados, comuníquese con soporte para regularizar&quot;</em>.
              <br />
              2) Aquí también puedes definir las <strong>Empresas Anclas</strong> (empresas relacionadas o filiales que el rol <strong>Admin</strong> de una empresa cliente puede administrar conjuntamente).
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {visibleCompanies.map((comp) => (
              <div
                key={comp.empresaId}
                className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-5"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h3 className="text-base font-extrabold text-slate-900">
                      {comp.razonSocial}
                    </h3>
                    <span className="text-xs font-mono px-2 py-0.5 bg-slate-100 rounded text-slate-700">
                      RUT {comp.rut}
                    </span>
                    {comp.esEmpresaDuenaErp && (
                      <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase bg-indigo-100 text-indigo-800 border border-indigo-300 rounded-full">
                        ★ Empresa Dueña del ERP (SuperAdmin)
                      </span>
                    )}
                    <span
                      className={`px-2.5 py-0.5 text-xs font-bold rounded-full ${
                        comp.estadoCuenta === 'ACTIVA'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : comp.estadoCuenta === 'SUSPENDIDA_PAGO'
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : 'bg-rose-100 text-rose-800 border border-rose-300'
                      }`}
                    >
                      {comp.estadoCuenta === 'ACTIVA'
                        ? '🟢 ACTIVA'
                        : comp.estadoCuenta === 'SUSPENDIDA_PAGO'
                        ? '🟠 SUSPENDIDA POR FALTA DE PAGO'
                        : '🔴 DADA DE BAJA'}
                    </span>
                  </div>

                  {comp.motivoSuspensionOBaja && comp.estadoCuenta !== 'ACTIVA' && (
                    <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 inline-block">
                      <strong>Motivo Comercial:</strong> {comp.motivoSuspensionOBaja}
                    </div>
                  )}

                  {/* Empresas Anclas Configuradas */}
                  <div className="pt-2">
                    <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-1.5">
                      <Link2 className="w-4 h-4 text-indigo-600" />
                      <span>Empresas Anclas vinculadas a {comp.nombreCorto}:</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {securityState.companiesConfig
                        .filter((other) => other.empresaId !== comp.empresaId)
                        .map((other) => {
                          const isLinked = (comp.empresasAnclasIds || []).includes(other.empresaId);
                          return (
                            <button
                              key={other.empresaId}
                              type="button"
                              onClick={() =>
                                handleToggleCompanyAnchor(comp.empresaId, other.empresaId)
                              }
                              className={`px-3 py-1 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition-all cursor-pointer ${
                                isLinked
                                  ? 'bg-indigo-50 border-indigo-300 text-indigo-800'
                                  : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                              }`}
                            >
                              {isLinked ? (
                                <CheckSquare className="w-3.5 h-3.5 text-indigo-600" />
                              ) : (
                                <Square className="w-3.5 h-3.5 text-slate-400" />
                              )}
                              <span>{other.nombreCorto}</span>
                            </button>
                          );
                        })}
                    </div>
                  </div>
                </div>

                {/* Botones de cambio de Estado Comercial (Solo SuperAdmin) */}
                <div className="flex flex-col sm:flex-row lg:flex-col gap-2 shrink-0 border-t lg:border-t-0 lg:border-l border-slate-200 pt-3 lg:pt-0 lg:pl-5">
                  <span className="text-[10px] font-bold uppercase text-slate-400">
                    Cambiar Estado Cuenta:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      disabled={!isSuperAdmin || comp.estadoCuenta === 'ACTIVA'}
                      onClick={() => handleChangeCompanyStatus(comp.empresaId, 'ACTIVA')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
                        comp.estadoCuenta === 'ACTIVA'
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50 disabled:opacity-50'
                      }`}
                    >
                      Activa
                    </button>
                    <button
                      type="button"
                      disabled={!isSuperAdmin || comp.estadoCuenta === 'SUSPENDIDA_PAGO'}
                      onClick={() =>
                        handleChangeCompanyStatus(
                          comp.empresaId,
                          'SUSPENDIDA_PAGO',
                          'Facturación mensual ERP impaga.'
                        )
                      }
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
                        comp.estadoCuenta === 'SUSPENDIDA_PAGO'
                          ? 'bg-amber-600 text-white border-amber-600'
                          : 'bg-white text-amber-700 border-amber-300 hover:bg-amber-50 disabled:opacity-50'
                      }`}
                    >
                      Suspender por Pago
                    </button>
                    <button
                      type="button"
                      disabled={!isSuperAdmin || comp.estadoCuenta === 'BAJA'}
                      onClick={() =>
                        handleChangeCompanyStatus(
                          comp.empresaId,
                          'BAJA',
                          'Término de contrato de suscripción.'
                        )
                      }
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
                        comp.estadoCuenta === 'BAJA'
                          ? 'bg-rose-600 text-white border-rose-600'
                          : 'bg-white text-rose-700 border-rose-300 hover:bg-rose-50 disabled:opacity-50'
                      }`}
                    >
                      Dar de Baja
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: PROBADOR DE PERMISOS EN VERA (WHATSAPP) */}
      {activeSubTab === 'whatsapp_test' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-5">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-emerald-600" />
              <span>Simulador de Control de Permisos RBAC en Vera (WhatsApp)</span>
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              Verifica cómo Vera valida automáticamente: <strong>1° Empresa Activa</strong>, <strong>2° Usuario Activo</strong> y <strong>3° Permisos del Rol</strong> cuando un usuario le escribe por WhatsApp.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1.5">
                Seleccionar Usuario que escribe por WhatsApp:
              </label>
              <select
                value={simSelectedUserId}
                onChange={(e) => {
                  setSimSelectedUserId(e.target.value);
                  setSimResult(null);
                }}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-900"
              >
                {securityState.users.map((u) => {
                  const r = securityState.roles.find((role) => role.id === u.rolId);
                  const c = securityState.companiesConfig.find(
                    (comp) => comp.empresaId === u.empresaPrincipalId
                  );
                  return (
                    <option key={u.id} value={u.id}>
                      {u.nombreCompleto} (+{u.telefonoWhatsapp}) — Rol: {r?.nombre} — Usuario:{' '}
                      {u.estado} — Empresa: {c?.nombreCorto} [{c?.estadoCuenta}]
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1.5">
                Mensaje enviado a Vera por WhatsApp:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={simQuery}
                  onChange={(e) => setSimQuery(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900"
                />
                <button
                  type="button"
                  onClick={runWhatsappVeraSimulation}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shrink-0 cursor-pointer"
                >
                  Probar en Vera
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    setSimQuery('@vera ¿Cuánto hay que pagar de sueldos y Previred este mes?')
                  }
                  className="text-[11px] px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium cursor-pointer"
                >
                  Pregunta de RRHH / Remuneraciones
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setSimQuery('@vera Dame el saldo bancario aperturado por cuenta y banco')
                  }
                  className="text-[11px] px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium cursor-pointer"
                >
                  Pregunta de Bancos / Tesorería
                </button>
                <button
                  type="button"
                  onClick={() => setSimQuery('@vera ¿Cuánto stock queda en bodega e inventario?')}
                  className="text-[11px] px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium cursor-pointer"
                >
                  Pregunta de Inventario / Bodega
                </button>
              </div>
            </div>
          </div>

          {simResult && (
            <div
              className={`p-5 rounded-2xl border ${
                simResult.allowed
                  ? 'bg-emerald-50/70 border-emerald-300'
                  : 'bg-rose-50/70 border-rose-300'
              }`}
            >
              <div className="flex items-center gap-2 font-extrabold text-sm">
                {simResult.allowed ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                ) : (
                  <Lock className="w-5 h-5 text-rose-600" />
                )}
                <span className={simResult.allowed ? 'text-emerald-900' : 'text-rose-900'}>
                  {simResult.title}
                </span>
              </div>
              <p className="text-xs text-slate-700 mt-1">{simResult.detail}</p>
              <div className="mt-3 p-3.5 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs whitespace-pre-wrap">
                {simResult.whatsappReply}
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL CREAR / EDITAR ROL PERSONALIZADO */}
      {showRoleModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">
                  {editingRole ? `Editar Rol: ${editingRole.nombre}` : 'Crear Nuevo Rol Personalizado'}
                </h3>
                <p className="text-xs text-slate-500">
                  Selecciona libremente los módulos del ERP que podrá ver este Rol. Vera aplicará estos mismos permisos en WhatsApp.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowRoleModal(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveRole} className="space-y-4 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Nombre del Rol *
                  </label>
                  <input
                    type="text"
                    required
                    value={roleName}
                    onChange={(e) => setRoleName(e.target.value)}
                    placeholder="Ej: RRHH, Auditoria, Jefe de Planta..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Descripción del Perfil
                  </label>
                  <input
                    type="text"
                    value={roleDesc}
                    onChange={(e) => setRoleDesc(e.target.value)}
                    placeholder="Ej: Acceso exclusivo a agentes de Remuneraciones y RRHH"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm text-slate-900"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold uppercase text-slate-700">
                    Seleccionar Módulos del ERP Permitidos ({roleModules.length} seleccionados)
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setRoleModules(['hr_agent', 'payroll'])}
                      className="text-[11px] px-2 py-0.5 bg-sky-50 text-sky-700 border border-sky-200 rounded font-bold cursor-pointer"
                    >
                      Preset: Solo RRHH y Remuneraciones
                    </button>
                    <button
                      type="button"
                      onClick={() => setRoleModules(ERP_MODULES_CATALOG.map((m) => m.id))}
                      className="text-[11px] px-2 py-0.5 bg-slate-100 text-slate-700 rounded font-semibold cursor-pointer"
                    >
                      Marcar Todos
                    </button>
                    <button
                      type="button"
                      onClick={() => setRoleModules([])}
                      className="text-[11px] px-2 py-0.5 bg-slate-100 text-slate-700 rounded font-semibold cursor-pointer"
                    >
                      Limpiar
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200">
                  {ERP_MODULES_CATALOG.map((mod) => {
                    const checked = roleModules.includes(mod.id);
                    return (
                      <label
                        key={mod.id}
                        onClick={() => toggleRoleModule(mod.id)}
                        className={`p-2.5 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                          checked
                            ? 'bg-indigo-50/90 border-indigo-400 text-indigo-950'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {}}
                          className="mt-0.5"
                        />
                        <div className="text-xs">
                          <div className="font-bold">{mod.nombre}</div>
                          <div className="text-[10px] text-slate-500">{mod.agenteNombre}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Vista previa de permisos en WhatsApp Vera */}
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200">
                <div className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-emerald-600" />
                  <span>
                    Alcances sincronizados automáticamente en Vera (WhatsApp):
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {deriveWhatsappScopesFromModules(roleModules, 'CUSTOM').map((scope) => (
                    <span
                      key={scope}
                      className="px-2 py-0.5 bg-white text-emerald-800 border border-emerald-300 rounded text-[11px] font-bold"
                    >
                      {scope}
                    </span>
                  ))}
                  {deriveWhatsappScopesFromModules(roleModules, 'CUSTOM').length === 0 && (
                    <span className="text-xs text-emerald-700 italic">
                      Seleccione módulos para derivar permisos de WhatsApp.
                    </span>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowRoleModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Guardar Rol y Sincronizar con Vera</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CREAR / EDITAR USUARIO */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">
                  {editingUser ? `Editar Usuario: ${editingUser.username}` : 'Crear Nuevo Usuario ERP'}
                </h3>
                <p className="text-xs text-slate-500">
                  Configura sus credenciales, estado Activo/Inactivo, Rol, Empresa y teléfono para Vera WhatsApp.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowUserModal(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-4 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Usuario (Login) *
                  </label>
                  <input
                    type="text"
                    required
                    value={uUsername}
                    onChange={(e) => setUUsername(e.target.value)}
                    placeholder="Ej: jperez"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Contraseña *
                  </label>
                  <input
                    type="text"
                    required
                    value={uPassword}
                    onChange={(e) => setUPassword(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Nombre Completo *
                  </label>
                  <input
                    type="text"
                    required
                    value={uNombre}
                    onChange={(e) => setUNombre(e.target.value)}
                    placeholder="Ej: Juan Pérez Soto"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Cargo
                  </label>
                  <input
                    type="text"
                    value={uCargo}
                    onChange={(e) => setUCargo(e.target.value)}
                    placeholder="Ej: Analista de RRHH"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Rol de Seguridad *
                  </label>
                  <select
                    value={uRolId}
                    onChange={(e) => setURolId(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm text-slate-900 font-semibold"
                  >
                    {securityState.roles
                      .filter((r) => isSuperAdmin || r.tipoSistema !== 'SUPERADMIN')
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.nombre} ({r.tipoSistema})
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Estado del Usuario *
                  </label>
                  <select
                    value={uEstado}
                    onChange={(e) => setUEstado(e.target.value as 'ACTIVO' | 'INACTIVO')}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm text-slate-900 font-semibold"
                  >
                    <option value="ACTIVO">🟢 ACTIVO (Autorizado para ingresar)</option>
                    <option value="INACTIVO">🔴 INACTIVO (Bloqueado en Login y WhatsApp)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Empresa Principal *
                  </label>
                  <select
                    value={uEmpresaId}
                    onChange={(e) => setUEmpresaId(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm text-slate-900"
                  >
                    {visibleCompanies.map((c) => (
                      <option key={c.empresaId} value={c.empresaId}>
                        {c.razonSocial} ({c.rut})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Teléfono WhatsApp (Para Vera)
                  </label>
                  <input
                    type="text"
                    value={uPhone}
                    onChange={(e) => setUPhone(e.target.value)}
                    placeholder="Ej: 56987654321"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm text-slate-900 font-mono"
                  />
                </div>
              </div>

              {/* Empresas Anclas adicionales */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1.5">
                  Empresas Anclas Adicionales Autorizadas:
                </label>
                <div className="flex flex-wrap gap-2">
                  {visibleCompanies
                    .filter((c) => c.empresaId !== uEmpresaId)
                    .map((c) => {
                      const checked = uAnclasIds.includes(c.empresaId);
                      return (
                        <button
                          key={c.empresaId}
                          type="button"
                          onClick={() => toggleUserAnchorCompany(c.empresaId)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1.5 cursor-pointer ${
                            checked
                              ? 'bg-indigo-50 border-indigo-400 text-indigo-900'
                              : 'bg-slate-50 border-slate-200 text-slate-600'
                          }`}
                        >
                          {checked ? (
                            <CheckSquare className="w-3.5 h-3.5 text-indigo-600" />
                          ) : (
                            <Square className="w-3.5 h-3.5 text-slate-400" />
                          )}
                          <span>{c.nombreCorto}</span>
                        </button>
                      );
                    })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Guardar Usuario</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
