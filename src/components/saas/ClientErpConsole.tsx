/**
 * K6.2 · Consola "Mi cliente ERP".
 *
 * Lo que administra el cliente que paga (estudio contable, empresa o grupo), en tres pestañas:
 *   Empresas            sus empresas: alta dentro del límite, ficha, plan de cuentas, parámetros, auxiliares
 *   Usuarios y accesos  usuarios de sus empresas: crear, rol, empresas permitidas, estado, restablecer clave
 *   Mi plan y facturas  plan, consumo, estado de pago y facturas emitidas por la empresa dueña del ERP
 *
 * El SuperAdmin de la empresa dueña elige qué cliente ERP administrar. Todo lo decide el servidor
 * (/api/account); esta pantalla solo muestra lo que el servidor devuelve para ese cliente.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, Users, Receipt, Plus, KeyRound, Loader2, AlertTriangle, CheckCircle2, X, Pencil } from 'lucide-react';

type Tab = 'EMPRESAS' | 'USUARIOS' | 'PLAN';

async function api(method: string, url: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.success === false) {
    const extra = Array.isArray(json?.missingParams) && json.missingParams.length ? ` (${json.missingParams.join(', ')})` : '';
    throw new Error(`${json?.errorMessage || `HTTP ${res.status}`}${extra}`);
  }
  return json;
}

const clp = (n: number) => `$${Math.round(n || 0).toLocaleString('es-CL')}`;
const ESTADO_STYLE: Record<string, string> = {
  PRUEBA: 'bg-sky-100 text-sky-800',
  ACTIVA: 'bg-emerald-100 text-emerald-800',
  EN_MORA: 'bg-amber-100 text-amber-800',
  SUSPENDIDA: 'bg-rose-100 text-rose-800',
  BAJA: 'bg-slate-200 text-slate-700',
};
const input = 'w-full border border-slate-300 rounded px-2 py-1.5 text-xs';
const label = 'block text-[10px] font-bold text-slate-500 uppercase mb-0.5';

interface UserForm {
  id?: string;
  username: string;
  nombreCompleto: string;
  email: string;
  cargo: string;
  telefonoWhatsapp: string;
  rolId: string;
  empresaPrincipalId: string;
  empresasAnclasPermitidas: string[];
  estado: 'ACTIVO' | 'INACTIVO';
}
const emptyUser = (): UserForm => ({
  username: '',
  nombreCompleto: '',
  email: '',
  cargo: '',
  telefonoWhatsapp: '',
  rolId: '',
  empresaPrincipalId: '',
  empresasAnclasPermitidas: [],
  estado: 'ACTIVO',
});

interface Props {
  isSuperAdmin: boolean;
  currentUserId?: string;
  /** Cliente ERP a mostrar al abrir (el SuperAdmin llega desde Administración ERP). */
  cuentaInicial?: string | null;
  /** Lista de empresas con sus acciones (ficha, plan de cuentas, parámetros…), filtrada a este cliente. */
  renderEmpresas: (empresasIds: string[]) => React.ReactNode;
}

export const ClientErpConsole: React.FC<Props> = ({ isSuperAdmin, currentUserId, cuentaInicial, renderEmpresas }) => {
  const [tab, setTab] = useState<Tab>('EMPRESAS');
  const [cuentaId, setCuentaId] = useState<string>(cuentaInicial || '');
  const [cuentas, setCuentas] = useState<Array<{ id: string; razonSocial: string; esPropietario?: boolean }>>([]);
  const [overview, setOverview] = useState<any>(null);
  const [usersData, setUsersData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<UserForm | null>(null);
  const [claveTemporal, setClaveTemporal] = useState<{ username: string; clave: string } | null>(null);

  useEffect(() => {
    if (cuentaInicial) setCuentaId(cuentaInicial);
  }, [cuentaInicial]);

  // El SuperAdmin elige el cliente ERP; el administrador de un cliente solo ve el suyo.
  useEffect(() => {
    if (!isSuperAdmin) return;
    api('GET', '/api/saas/overview')
      .then((d) => setCuentas((d.clientes || []).filter((c: any) => c.estado !== 'BAJA').map((c: any) => ({ id: c.id, razonSocial: c.razonSocial, esPropietario: c.esPropietario }))))
      .catch(() => setCuentas([]));
  }, [isSuperAdmin]);

  const qs = cuentaId ? `?cuentaId=${encodeURIComponent(cuentaId)}` : '';

  const load = useCallback(async () => {
    setError(null);
    try {
      const [o, u] = await Promise.all([api('GET', `/api/account/overview${qs}`), api('GET', `/api/account/users${qs}`)]);
      setOverview(o);
      setUsersData(u);
    } catch (e: any) {
      setOverview(null);
      setUsersData(null);
      setError(e.message);
    }
  }, [qs]);

  useEffect(() => {
    void load();
  }, [load]);

  const empresas: any[] = overview?.empresas || [];
  const nombreEmpresa = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of usersData?.empresas || []) m.set(e.id, e.razonSocial);
    return (id: string) => m.get(id) || id;
  }, [usersData]);

  const guardarUsuario = async () => {
    if (!form) return;
    setBusy(true);
    setMsg(null);
    try {
      if (form.id) {
        await api('PUT', `/api/account/users/${encodeURIComponent(form.id)}${qs}`, form);
        setMsg({ ok: true, text: `Usuario ${form.username} actualizado.` });
      } else {
        const r = await api('POST', `/api/account/users${qs}`, form);
        setClaveTemporal({ username: r.usuario.username, clave: r.claveTemporal });
        setMsg({ ok: true, text: `Usuario ${r.usuario.username} creado.` });
      }
      setForm(null);
      await load();
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setBusy(false);
    }
  };

  const restablecer = async (u: any) => {
    if (!window.confirm(`¿Restablecer la clave de ${u.username}? Recibirá una clave temporal y deberá cambiarla al ingresar.`)) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await api('POST', `/api/account/users/${encodeURIComponent(u.id)}/reset-password${qs}`);
      setClaveTemporal({ username: u.username, clave: r.claveTemporal });
      await load();
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setBusy(false);
    }
  };

  const cuenta = overview?.cuenta;
  const consumo = overview?.consumo;

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Encabezado */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-blue-700">Mi cliente ERP</div>
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">{cuenta?.razonSocial || 'Cliente ERP'}</h2>
            <p className="text-xs text-slate-500 mt-1 max-w-3xl">
              Las empresas, los usuarios y los accesos de este cliente. La facturación del ERP se emite a nombre de este cliente.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {isSuperAdmin && (
              <select className="border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-semibold" value={cuentaId} onChange={(e) => setCuentaId(e.target.value)} title="Cliente ERP a administrar">
                <option value="">Mi empresa (dueña del ERP)</option>
                {cuentas
                  .filter((c) => !c.esPropietario)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.razonSocial}
                    </option>
                  ))}
              </select>
            )}
            {cuenta && <span className={`px-2 py-1 rounded font-bold ${ESTADO_STYLE[cuenta.estado] || 'bg-slate-100'}`}>{cuenta.esPropietario ? 'Empresa dueña del ERP' : cuenta.estado}</span>}
            {consumo && !cuenta?.esPropietario && (
              <span className="bg-slate-100 text-slate-700 rounded px-2 py-1">
                {consumo.empresas}/{consumo.limiteEmpresas} empresas · {consumo.usuarios}/{consumo.limiteUsuarios} usuarios
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 mt-5 pt-4 border-t border-slate-100 text-xs font-semibold">
          {(
            [
              ['EMPRESAS', `Empresas (${empresas.length})`, Building2],
              ['USUARIOS', `Usuarios y accesos (${usersData?.usuarios?.length ?? 0})`, Users],
              ['PLAN', 'Mi plan y facturas', Receipt],
            ] as const
          ).map(([id, text, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 cursor-pointer ${tab === id ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              <Icon className="w-4 h-4" /> {text}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg px-4 py-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}
      {msg && (
        <div className={`text-xs rounded-lg px-4 py-2 flex items-center gap-2 ${msg.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>
          {msg.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />} {msg.text}
        </div>
      )}
      {claveTemporal && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg px-4 py-3 text-xs flex items-start justify-between gap-3">
          <div>
            <div className="font-bold text-amber-900">Clave temporal de {claveTemporal.username}</div>
            <div className="font-mono text-base text-slate-900 my-1 select-all">{claveTemporal.clave}</div>
            <div className="text-amber-800">Entréguela por un canal seguro. Se muestra una sola vez; el usuario deberá cambiarla en su primer ingreso.</div>
          </div>
          <button type="button" onClick={() => setClaveTemporal(null)} className="text-amber-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* EMPRESAS */}
      {tab === 'EMPRESAS' && overview && renderEmpresas(empresas.map((e) => e.id))}

      {/* USUARIOS */}
      {tab === 'USUARIOS' && usersData && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-slate-800 text-sm">Usuarios y accesos</h3>
              <p className="text-xs text-slate-500">Cada usuario entra solo a las empresas que se le asignen, con los permisos de su rol.</p>
            </div>
            <button
              type="button"
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs flex items-center gap-1.5"
              onClick={() => setForm({ ...emptyUser(), empresaPrincipalId: usersData.empresas[0]?.id || '' })}
            >
              <Plus className="w-3.5 h-3.5" /> Nuevo usuario
            </button>
          </div>

          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="text-left px-2 py-1.5">Usuario</th>
                <th className="text-left px-2 py-1.5">Rol</th>
                <th className="text-left px-2 py-1.5">Empresas</th>
                <th className="text-left px-2 py-1.5">Estado</th>
                <th className="px-2 py-1.5" />
              </tr>
            </thead>
            <tbody>
              {usersData.usuarios.map((u: any) => (
                <tr key={u.id} className="border-t border-slate-100">
                  <td className="px-2 py-2">
                    <div className="font-bold text-slate-800">{u.nombreCompleto}</div>
                    <div className="text-slate-500 font-mono">{u.username}{u.email ? ` · ${u.email}` : ''}</div>
                  </td>
                  <td className="px-2 py-2">{u.rolNombre}</td>
                  <td className="px-2 py-2">
                    <div className="font-semibold">{nombreEmpresa(u.empresaPrincipalId)}</div>
                    {u.empresasAnclasPermitidas.length > 0 && (
                      <div className="text-slate-500">
                        +{' '}
                        {u.empresasAnclasPermitidas
                          .map((id: string) => (usersData.empresas.some((e: any) => e.id === id) ? nombreEmpresa(id) : 'otra empresa (asignada por la administración del ERP)'))
                          .join(', ')}
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <span className={`px-1.5 py-0.5 rounded font-bold ${u.estado === 'ACTIVO' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>{u.estado}</span>
                    {u.debeCambiarPassword && <div className="text-amber-700 mt-0.5">Clave temporal pendiente</div>}
                  </td>
                  <td className="px-2 py-2 text-right whitespace-nowrap">
                    <button
                      type="button"
                      className="px-2 py-1 border border-slate-300 rounded mr-1 inline-flex items-center gap-1"
                      onClick={() =>
                        setForm({
                          id: u.id,
                          username: u.username,
                          nombreCompleto: u.nombreCompleto,
                          email: u.email,
                          cargo: u.cargo,
                          telefonoWhatsapp: u.telefonoWhatsapp,
                          rolId: u.rolId,
                          empresaPrincipalId: u.empresaPrincipalId,
                          empresasAnclasPermitidas: u.empresasAnclasPermitidas,
                          estado: u.estado === 'INACTIVO' ? 'INACTIVO' : 'ACTIVO',
                        })
                      }
                    >
                      <Pencil className="w-3 h-3" /> Editar
                    </button>
                    {u.id !== currentUserId && (
                      <button type="button" disabled={busy} className="px-2 py-1 border border-slate-300 rounded inline-flex items-center gap-1" onClick={() => void restablecer(u)}>
                        <KeyRound className="w-3 h-3" /> Clave
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {usersData.usuarios.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-2 py-4 text-center text-slate-500">
                    Este cliente aún no tiene usuarios.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* PLAN Y FACTURAS */}
      {tab === 'PLAN' && overview && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs text-xs space-y-2">
            <h3 className="font-extrabold text-slate-800 text-sm">Plan contratado</h3>
            {cuenta.esPropietario ? (
              <p className="text-slate-600">Empresa dueña del ERP: sin plan, sin límites y sin facturación.</p>
            ) : (
              <>
                <div>
                  <span className="text-slate-500">Plan:</span> <strong>{cuenta.planNombre}</strong> · {clp(cuenta.precioMensualNetoClp)} neto/mes
                </div>
                <div>
                  <span className="text-slate-500">Contrato:</span> {cuenta.contrato.numero || '—'} desde {cuenta.contrato.fechaInicio}
                  {cuenta.contrato.fechaTermino ? ` hasta ${cuenta.contrato.fechaTermino}` : ''}
                </div>
                <div>
                  <span className="text-slate-500">Plazo de pago:</span> {cuenta.contrato.diasPlazoPago} días desde la emisión
                </div>
                <div>
                  <span className="text-slate-500">Facturar a:</span> {cuenta.razonSocial} · {cuenta.rut} · {cuenta.emailFacturacion}
                </div>
                <div>
                  <span className="text-slate-500">Módulos:</span> {(cuenta.modulos || []).join(', ') || '—'}
                </div>
                {overview.deudaVencida > 0 && (
                  <div className="mt-2 bg-rose-50 text-rose-800 rounded px-2 py-1.5 font-bold">Deuda vencida: {clp(overview.deudaVencida)}</div>
                )}
              </>
            )}
          </div>
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <h3 className="font-extrabold text-slate-800 text-sm mb-3">Facturas del ERP</h3>
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="text-left px-2 py-1.5">Período</th>
                  <th className="text-left px-2 py-1.5">Folio</th>
                  <th className="text-right px-2 py-1.5">Total</th>
                  <th className="text-right px-2 py-1.5">Saldo</th>
                  <th className="text-left px-2 py-1.5">Vence</th>
                  <th className="text-left px-2 py-1.5">Estado</th>
                </tr>
              </thead>
              <tbody>
                {overview.facturas.map((f: any) => (
                  <tr key={f.id} className="border-t border-slate-100">
                    <td className="px-2 py-1.5">{f.periodo}</td>
                    <td className="px-2 py-1.5">{f.folio ?? '—'}</td>
                    <td className="px-2 py-1.5 text-right">{clp(f.total)}</td>
                    <td className="px-2 py-1.5 text-right">{clp(f.saldo)}</td>
                    <td className="px-2 py-1.5">{f.fechaVencimiento || '—'}</td>
                    <td className="px-2 py-1.5">
                      {f.estado}
                      {f.diasAtraso > 0 && <span className="text-rose-700 font-bold"> · {f.diasAtraso} días de atraso</span>}
                    </td>
                  </tr>
                ))}
                {overview.facturas.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-2 py-4 text-center text-slate-500">
                      Sin facturas emitidas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!overview && !error && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando…
        </div>
      )}

      {/* Formulario de usuario */}
      {form && usersData && (
        <div className="fixed inset-0 z-[70] bg-slate-900/50 flex items-center justify-center p-3">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl p-5 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900">{form.id ? `Editar ${form.username}` : 'Nuevo usuario'}</h3>
              <button type="button" onClick={() => setForm(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>Usuario</label>
                <input className={input} value={form.username} disabled={Boolean(form.id)} onChange={(e) => setForm({ ...form, username: e.target.value })} />
              </div>
              <div>
                <label className={label}>Nombre completo</label>
                <input className={input} value={form.nombreCompleto} onChange={(e) => setForm({ ...form, nombreCompleto: e.target.value })} />
              </div>
              <div>
                <label className={label}>Correo</label>
                <input className={input} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <label className={label}>Cargo</label>
                <input className={input} value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} />
              </div>
              <div>
                <label className={label}>WhatsApp (opcional)</label>
                <input className={input} value={form.telefonoWhatsapp} onChange={(e) => setForm({ ...form, telefonoWhatsapp: e.target.value })} />
              </div>
              <div>
                <label className={label}>Rol</label>
                <select className={input} value={form.rolId} onChange={(e) => setForm({ ...form, rolId: e.target.value })}>
                  <option value="">Seleccione…</option>
                  {usersData.roles.map((r: any) => (
                    <option key={r.id} value={r.id}>
                      {r.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={label}>Empresa principal</label>
                <select
                  className={input}
                  value={form.empresaPrincipalId}
                  onChange={(e) => setForm({ ...form, empresaPrincipalId: e.target.value, empresasAnclasPermitidas: form.empresasAnclasPermitidas.filter((x) => x !== e.target.value) })}
                >
                  <option value="">Seleccione…</option>
                  {usersData.empresas.map((e: any) => (
                    <option key={e.id} value={e.id}>
                      {e.razonSocial}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={label}>Estado</label>
                <select className={input} value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value as UserForm['estado'] })}>
                  <option value="ACTIVO">Activo</option>
                  <option value="INACTIVO">Inactivo (sin acceso)</option>
                </select>
              </div>
            </div>
            <div>
              <label className={label}>Otras empresas a las que puede entrar</label>
              <div className="grid grid-cols-2 gap-1.5">
                {usersData.empresas
                  .filter((e: any) => e.id !== form.empresaPrincipalId)
                  .map((e: any) => (
                    <label key={e.id} className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={form.empresasAnclasPermitidas.includes(e.id)}
                        onChange={(ev) =>
                          setForm({
                            ...form,
                            empresasAnclasPermitidas: ev.target.checked ? [...form.empresasAnclasPermitidas, e.id] : form.empresasAnclasPermitidas.filter((x) => x !== e.id),
                          })
                        }
                      />
                      {e.razonSocial}
                    </label>
                  ))}
                {usersData.empresas.length <= 1 && <span className="text-slate-500">Este cliente tiene una sola empresa.</span>}
              </div>
            </div>
            {!form.id && <p className="text-slate-500">Se generará una clave temporal que el usuario deberá cambiar en su primer ingreso.</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className="px-3 py-1.5 border border-slate-300 rounded" onClick={() => setForm(null)}>
                Cancelar
              </button>
              <button type="button" disabled={busy} className="px-3 py-1.5 bg-blue-600 text-white rounded font-bold disabled:opacity-50" onClick={() => void guardarUsuario()}>
                {busy ? 'Guardando…' : form.id ? 'Guardar cambios' : 'Crear usuario'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
