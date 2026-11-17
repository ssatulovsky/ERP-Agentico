/**
 * K3/K4 · Panel de administración comercial del ERP (solo SuperAdmin de la empresa dueña).
 *
 * Clientes ERP (estudios o empresas), plan y condiciones negociadas, límites y módulos, contrato y
 * plazos de cobranza, empresas asignadas, estado (con bloqueo total), facturas de suscripción, pagos,
 * avisos y baja con respaldo de 10 años. Todo se guarda y se decide en el servidor (/api/saas).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { X, RefreshCw, Plus, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';

const MODULOS = [
  'CONTABILIDAD',
  'TRIBUTARIO_SII',
  'CONCILIACION',
  'RRHH',
  'INVENTARIO',
  'TESORERIA',
  'RENDICIONES',
  'ACTIVO_FIJO',
  'COSTOS_PRODUCCION',
  'FLUJO_CAJA',
  'COMERCIAL_COMPRAS',
];

const ESTADO_STYLE: Record<string, string> = {
  PRUEBA: 'bg-sky-100 text-sky-800',
  ACTIVA: 'bg-emerald-100 text-emerald-800',
  EN_MORA: 'bg-amber-100 text-amber-800',
  SUSPENDIDA: 'bg-rose-100 text-rose-800',
  BAJA: 'bg-slate-200 text-slate-700',
};

const clp = (n: number) => `$${Math.round(n || 0).toLocaleString('es-CL')}`;

async function api(method: string, url: string, body?: any) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    const extra = Array.isArray(json.missingParams) ? ` (${json.missingParams.join(', ')})` : '';
    throw new Error(`${json.errorMessage || `HTTP ${res.status}`}${extra}`);
  }
  return json;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** K6: se muestra como página dentro de "Administración ERP" (sin ventana flotante). */
  embebido?: boolean;
  /** K6: abre la consola "Mi cliente ERP" de ese cliente (empresas y usuarios). */
  onAdministrarCliente?: (cuentaId: string) => void;
}

type View = { tipo: 'LISTA' } | { tipo: 'NUEVO' } | { tipo: 'DETALLE'; id: string };

const emptyForm = () => ({
  tipo: 'EMPRESA',
  rut: '',
  razonSocial: '',
  giro: '',
  direccion: '',
  comuna: '',
  ciudad: '',
  emailFacturacion: '',
  contactoCobranza: { nombre: '', email: '', telefono: '' },
  planId: '',
  condiciones: { precioMensualNetoClp: 0, limiteEmpresas: 0, limiteUsuarios: 0, modulos: [] as string[] },
  contrato: { fechaInicio: new Date().toISOString().slice(0, 10), fechaTermino: '', renovacionAutomatica: true, diaFacturacion: 1, diasPlazoPago: 10, fechaFinPrueba: '' },
  cobranza: { diasAvisoAtraso: 5, diasUltimoRecordatorio: 10, diasBloqueo: 15 },
  empresasIds: [] as string[],
});

const input = 'w-full border border-slate-300 rounded px-2 py-1 text-xs';
const label = 'block text-[10px] font-bold text-slate-500 uppercase mb-0.5';

export const SaasAdminPanel: React.FC<Props> = ({ isOpen, onClose, embebido = false, onAdministrarCliente }) => {
  const [view, setView] = useState<View>({ tipo: 'LISTA' });
  const [overview, setOverview] = useState<any>(null);
  const [planes, setPlanes] = useState<any[]>([]);
  const [detail, setDetail] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [form, setForm] = useState<any>(emptyForm());

  const load = useCallback(async () => {
    try {
      const [o, p] = await Promise.all([api('GET', '/api/saas/overview'), api('GET', '/api/saas/plans')]);
      setOverview(o);
      setPlanes(p.planes);
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    }
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    try {
      const d = await api('GET', `/api/saas/accounts/${id}/history`);
      setDetail(d);
      const c = d.cliente;
      setForm({
        ...emptyForm(),
        ...c,
        contactoCobranza: { telefono: '', ...c.contactoCobranza },
        contrato: { fechaTermino: '', fechaFinPrueba: '', ...c.contrato },
        empresasIds: [],
      });
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    }
  }, []);

  useEffect(() => {
    if (isOpen || embebido) void load();
  }, [isOpen, embebido, load]);

  useEffect(() => {
    if (view.tipo === 'DETALLE') void loadDetail(view.id);
    if (view.tipo === 'NUEVO') setForm(emptyForm());
  }, [view, loadDetail]);

  const run = async (fn: () => Promise<any>, okText: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, text: okText });
      await load();
      if (view.tipo === 'DETALLE') await loadDetail(view.id);
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setBusy(false);
    }
  };

  const applyPlan = (planId: string) => {
    const p = planes.find((x) => x.id === planId);
    setForm((f: any) => ({
      ...f,
      planId,
      condiciones: p
        ? { precioMensualNetoClp: p.precioMensualClp, limiteEmpresas: p.limiteEmpresasContables, limiteUsuarios: p.limiteUsuarios, modulos: [...(p.modulos || [])] }
        : f.condiciones,
    }));
  };

  const set = (path: string, value: any) =>
    setForm((f: any) => {
      const next = structuredClone(f);
      const keys = path.split('.');
      let o = next;
      for (const k of keys.slice(0, -1)) o = o[k];
      o[keys[keys.length - 1]] = value;
      return next;
    });

  const sinCliente: any[] = overview?.empresasSinCliente || [];
  const clientes: any[] = useMemo(() => overview?.clientes || [], [overview]);

  if (!isOpen && !embebido) return null;

  const accountForm = (esNuevo: boolean) => (
    <div className="space-y-3 text-xs">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div>
          <span className={label}>Tipo</span>
          <select className={input} value={form.tipo} onChange={(e) => set('tipo', e.target.value)}>
            <option value="ESTUDIO_CONTABLE">Estudio contable</option>
            <option value="EMPRESA">Empresa</option>
            <option value="GRUPO_EMPRESAS">Grupo de empresas</option>
          </select>
        </div>
        <div>
          <span className={label}>RUT *</span>
          <input className={input} value={form.rut} disabled={!esNuevo} onChange={(e) => set('rut', e.target.value)} placeholder="76.123.456-0" />
        </div>
        <div className="col-span-2">
          <span className={label}>Razón social *</span>
          <input className={input} value={form.razonSocial} onChange={(e) => set('razonSocial', e.target.value)} />
        </div>
        <div className="col-span-2">
          <span className={label}>Giro (para facturar)</span>
          <input className={input} value={form.giro || ''} onChange={(e) => set('giro', e.target.value)} />
        </div>
        <div className="col-span-2">
          <span className={label}>Dirección</span>
          <input className={input} value={form.direccion || ''} onChange={(e) => set('direccion', e.target.value)} />
        </div>
        <div>
          <span className={label}>Comuna</span>
          <input className={input} value={form.comuna || ''} onChange={(e) => set('comuna', e.target.value)} />
        </div>
        <div>
          <span className={label}>Ciudad</span>
          <input className={input} value={form.ciudad || ''} onChange={(e) => set('ciudad', e.target.value)} />
        </div>
        <div className="col-span-2">
          <span className={label}>Correo de facturación *</span>
          <input className={input} type="email" value={form.emailFacturacion} onChange={(e) => set('emailFacturacion', e.target.value)} />
        </div>
        <div>
          <span className={label}>Contacto cobranza *</span>
          <input className={input} value={form.contactoCobranza.nombre} onChange={(e) => set('contactoCobranza.nombre', e.target.value)} />
        </div>
        <div>
          <span className={label}>Correo contacto *</span>
          <input className={input} type="email" value={form.contactoCobranza.email} onChange={(e) => set('contactoCobranza.email', e.target.value)} />
        </div>
        <div>
          <span className={label}>Teléfono</span>
          <input className={input} value={form.contactoCobranza.telefono || ''} onChange={(e) => set('contactoCobranza.telefono', e.target.value)} />
        </div>
      </div>

      <div className="border-t border-slate-200 pt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
        <div>
          <span className={label}>Plan *</span>
          <select className={input} value={form.planId} onChange={(e) => applyPlan(e.target.value)}>
            <option value="">Seleccione…</option>
            {planes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <span className={label}>Precio mensual neto</span>
          <input className={input} type="number" value={form.condiciones.precioMensualNetoClp} onChange={(e) => set('condiciones.precioMensualNetoClp', Number(e.target.value))} />
        </div>
        <div>
          <span className={label}>Límite empresas</span>
          <input className={input} type="number" value={form.condiciones.limiteEmpresas} onChange={(e) => set('condiciones.limiteEmpresas', Number(e.target.value))} />
        </div>
        <div>
          <span className={label}>Límite usuarios activos</span>
          <input className={input} type="number" value={form.condiciones.limiteUsuarios} onChange={(e) => set('condiciones.limiteUsuarios', Number(e.target.value))} />
        </div>
        <div className="col-span-2 md:col-span-4 flex flex-wrap gap-2">
          {MODULOS.map((m) => (
            <label key={m} className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={form.condiciones.modulos.includes(m)}
                onChange={(e) =>
                  set('condiciones.modulos', e.target.checked ? [...form.condiciones.modulos, m] : form.condiciones.modulos.filter((x: string) => x !== m))
                }
              />
              <span>{m}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="border-t border-slate-200 pt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
        <div>
          <span className={label}>Inicio contrato *</span>
          <input className={input} type="date" value={form.contrato.fechaInicio} onChange={(e) => set('contrato.fechaInicio', e.target.value)} />
        </div>
        <div>
          <span className={label}>Término (opcional)</span>
          <input className={input} type="date" value={form.contrato.fechaTermino || ''} onChange={(e) => set('contrato.fechaTermino', e.target.value)} />
        </div>
        <div>
          <span className={label}>Fin de prueba (opcional)</span>
          <input className={input} type="date" value={form.contrato.fechaFinPrueba || ''} onChange={(e) => set('contrato.fechaFinPrueba', e.target.value)} />
        </div>
        <label className="flex items-center gap-1 mt-4">
          <input type="checkbox" checked={form.contrato.renovacionAutomatica} onChange={(e) => set('contrato.renovacionAutomatica', e.target.checked)} />
          <span>Renovación automática</span>
        </label>
        <div>
          <span className={label}>Día de facturación (1–28)</span>
          <input className={input} type="number" min={1} max={28} value={form.contrato.diaFacturacion} onChange={(e) => set('contrato.diaFacturacion', Number(e.target.value))} />
        </div>
        <div>
          <span className={label}>Plazo de pago (días)</span>
          <input className={input} type="number" min={0} value={form.contrato.diasPlazoPago} onChange={(e) => set('contrato.diasPlazoPago', Number(e.target.value))} />
        </div>
      </div>

      <div className="border-t border-slate-200 pt-2 grid grid-cols-3 gap-2">
        <div>
          <span className={label}>Aviso de atraso (días)</span>
          <input className={input} type="number" value={form.cobranza.diasAvisoAtraso} onChange={(e) => set('cobranza.diasAvisoAtraso', Number(e.target.value))} />
        </div>
        <div>
          <span className={label}>Último recordatorio (días)</span>
          <input className={input} type="number" value={form.cobranza.diasUltimoRecordatorio} onChange={(e) => set('cobranza.diasUltimoRecordatorio', Number(e.target.value))} />
        </div>
        <div>
          <span className={label}>Bloqueo total (días)</span>
          <input className={input} type="number" value={form.cobranza.diasBloqueo} onChange={(e) => set('cobranza.diasBloqueo', Number(e.target.value))} />
        </div>
      </div>

      {sinCliente.length > 0 && (
        <div className="border-t border-slate-200 pt-2">
          <span className={label}>Asignar empresas sin cliente ERP</span>
          <div className="flex flex-wrap gap-2">
            {sinCliente.map((c) => (
              <label key={c.id} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={form.empresasIds.includes(c.id)}
                  onChange={(e) => set('empresasIds', e.target.checked ? [...form.empresasIds, c.id] : form.empresasIds.filter((x: string) => x !== c.id))}
                />
                <span>
                  {c.razonSocial} ({c.rut})
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2">
        {esNuevo ? (
          <button
            type="button"
            disabled={busy}
            className="px-3 py-1.5 bg-blue-600 text-white rounded font-bold disabled:opacity-50"
            onClick={() =>
              run(async () => {
                const payload = { ...form, contrato: { ...form.contrato, fechaTermino: form.contrato.fechaTermino || undefined, fechaFinPrueba: form.contrato.fechaFinPrueba || undefined } };
                const r = await api('POST', '/api/saas/accounts', payload);
                setView({ tipo: 'DETALLE', id: r.cliente.id });
              }, 'Cliente ERP creado.')
            }
          >
            Crear cliente ERP
          </button>
        ) : (
          <>
            {form.empresasIds.length > 0 && (
              <button
                type="button"
                disabled={busy}
                className="px-3 py-1.5 bg-slate-700 text-white rounded font-bold disabled:opacity-50"
                onClick={() => run(() => api('POST', `/api/saas/accounts/${form.id}/companies`, { empresasIds: form.empresasIds }), 'Empresas asignadas.')}
              >
                Asignar empresas
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              className="px-3 py-1.5 bg-blue-600 text-white rounded font-bold disabled:opacity-50"
              onClick={() =>
                run(
                  () =>
                    api('PUT', `/api/saas/accounts/${form.id}`, {
                      tipo: form.tipo,
                      razonSocial: form.razonSocial,
                      giro: form.giro,
                      direccion: form.direccion,
                      comuna: form.comuna,
                      ciudad: form.ciudad,
                      emailFacturacion: form.emailFacturacion,
                      contactoCobranza: form.contactoCobranza,
                      planId: form.planId,
                      condiciones: form.condiciones,
                      contrato: { ...form.contrato, fechaTermino: form.contrato.fechaTermino || undefined, fechaFinPrueba: form.contrato.fechaFinPrueba || undefined },
                      cobranza: form.cobranza,
                    }),
                  'Cliente ERP actualizado.'
                )
              }
            >
              Guardar cambios
            </button>
          </>
        )}
      </div>
    </div>
  );

  const detailView = () => {
    if (!detail) return <Loader2 className="w-4 h-4 animate-spin" />;
    const c = detail.cliente;
    const pendientes = detail.facturas.filter((f: any) => f.estado === 'EMITIDA');
    return (
      <div className="space-y-4 text-xs">
        {onAdministrarCliente && (
          <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
            <span className="text-blue-900">
              <strong>{c.razonSocial}</strong>: sus empresas, usuarios y accesos se administran en su consola.
            </span>
            <button type="button" className="px-3 py-1.5 bg-blue-600 text-white rounded font-bold" onClick={() => onAdministrarCliente(c.id)}>
              Administrar empresas y usuarios
            </button>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <span className={`px-2 py-0.5 rounded font-bold ${ESTADO_STYLE[c.estado] || ''}`}>{c.estado}</span>
          {c.motivoEstado && <span className="text-slate-500">{c.motivoEstado}</span>}
          <span className="text-slate-600">
            Empresas {c.consumo.empresas}/{c.consumo.limiteEmpresas} · Usuarios {c.consumo.usuarios}/{c.consumo.limiteUsuarios}
          </span>
          {c.diasAtraso > 0 && <span className="text-rose-700 font-bold">{c.diasAtraso} días de atraso · {clp(c.deudaVencida)}</span>}
        </div>

        {!c.esPropietario && c.estado !== 'BAJA' && (
          <div className="flex flex-wrap gap-2">
            {c.estado !== 'SUSPENDIDA' ? (
              <button
                type="button"
                className="px-2 py-1 bg-rose-600 text-white rounded"
                onClick={() => {
                  const motivo = prompt('Motivo de la suspensión (bloqueo total de todos sus usuarios):');
                  if (motivo) void run(() => api('POST', `/api/saas/accounts/${c.id}/state`, { estado: 'SUSPENDIDA', motivo }), 'Cliente suspendido.');
                }}
              >
                Suspender
              </button>
            ) : (
              <button
                type="button"
                className="px-2 py-1 bg-emerald-600 text-white rounded"
                onClick={() => {
                  const motivo = prompt('Motivo de la reactivación:');
                  if (motivo) void run(() => api('POST', `/api/saas/accounts/${c.id}/state`, { estado: 'ACTIVA', motivo }), 'Cliente reactivado.');
                }}
              >
                Reactivar
              </button>
            )}
            <button
              type="button"
              className="px-2 py-1 bg-slate-200 rounded"
              onClick={() => {
                const periodo = prompt('Período de la factura (AAAA-MM):', new Date().toISOString().slice(0, 7));
                if (periodo) void run(() => api('POST', '/api/saas/invoices', { clienteErpId: c.id, periodo, solicitarEmision: true }), 'Factura generada y enviada a aprobación.');
              }}
            >
              Facturar período
            </button>
            <button
              type="button"
              className="px-2 py-1 bg-slate-800 text-white rounded"
              onClick={() => {
                const motivo = prompt('Baja total del cliente. Motivo:');
                if (!motivo) return;
                const confirmacionRut = prompt(`Para confirmar escriba el RUT del cliente (${c.rut}):`);
                if (!confirmacionRut) return;
                const retirar = confirm('¿Retirar su información de la base de trabajo después de respaldarla? (queda solo en el respaldo de 10 años)');
                void run(() => api('POST', `/api/saas/accounts/${c.id}/close`, { motivo, confirmacionRut, retirarDeOperacion: retirar }), 'Cliente dado de baja con respaldo.');
              }}
            >
              Dar de baja con respaldo
            </button>
          </div>
        )}
        {c.respaldoBaja && (
          <p className="text-slate-600">
            Respaldo: {c.respaldoBaja.archivo} · SHA-256 {String(c.respaldoBaja.sha256).slice(0, 16)}… · conservar hasta {c.respaldoBaja.conservarHasta}
            {c.respaldoBaja.retiradoDeOperacion ? ' · retirado de la base de trabajo' : ''}
          </p>
        )}

        <div>
          <h4 className="font-bold text-slate-800 mb-1">Empresas</h4>
          {c.empresas.length === 0 ? <p className="text-slate-500">Sin empresas.</p> : c.empresas.map((e: any) => <div key={e.id}>{e.razonSocial} ({e.rut}) · {e.estadoEmpresa}</div>)}
        </div>

        <div>
          <h4 className="font-bold text-slate-800 mb-1">Facturas</h4>
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-1">Período</th>
                <th className="text-left px-1">Estado</th>
                <th className="text-left px-1">Folio</th>
                <th className="text-right px-1">Total</th>
                <th className="text-right px-1">Pagado</th>
                <th className="text-left px-1">Vence</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {detail.facturas.map((f: any) => (
                <tr key={f.id} className="border-t border-slate-100">
                  <td className="px-1">{f.periodo}</td>
                  <td className="px-1" title={f.error || ''}>
                    {f.estado}
                    {f.error ? ' ⚠' : ''}
                  </td>
                  <td className="px-1">{f.folio || '—'}</td>
                  <td className="px-1 text-right">{clp(f.total)}</td>
                  <td className="px-1 text-right">{clp(f.pagado)}</td>
                  <td className="px-1">{f.fechaVencimiento || '—'}</td>
                  <td className="px-1 space-x-1 whitespace-nowrap">
                    {['BORRADOR', 'ERROR_EMISION'].includes(f.estado) && (
                      <>
                        <button type="button" className="underline" onClick={() => run(() => api('POST', `/api/saas/invoices/${f.id}/emit`), 'Enviada a aprobación.')}>
                          Emitir DTE
                        </button>
                        <button
                          type="button"
                          className="underline"
                          onClick={() => {
                            const folio = prompt('Folio de la factura emitida fuera del ERP:');
                            const fechaEmision = folio ? prompt('Fecha de emisión (AAAA-MM-DD):', new Date().toISOString().slice(0, 10)) : null;
                            if (folio && fechaEmision) void run(() => api('POST', `/api/saas/invoices/${f.id}/external`, { folio, fechaEmision }), 'Emisión registrada.');
                          }}
                        >
                          Emitida fuera
                        </button>
                        <button
                          type="button"
                          className="underline text-rose-700"
                          onClick={() => {
                            const motivo = prompt('Motivo de la anulación:');
                            if (motivo) void run(() => api('POST', `/api/saas/invoices/${f.id}/void`, { motivo }), 'Factura anulada.');
                          }}
                        >
                          Anular
                        </button>
                      </>
                    )}
                    {f.estado === 'EMITIDA' && (
                      <button
                        type="button"
                        className="underline text-emerald-700"
                        onClick={() => {
                          const monto = prompt('Monto pagado:', String(f.total - f.pagado));
                          const fecha = monto ? prompt('Fecha del pago (AAAA-MM-DD):', new Date().toISOString().slice(0, 10)) : null;
                          const medio = fecha ? prompt('Medio de pago (transferencia, cheque…):', 'Transferencia') : null;
                          if (monto && fecha && medio) void run(() => api('POST', '/api/saas/payments', { invoiceId: f.id, monto: Number(monto), fecha, medio }), 'Pago registrado.');
                        }}
                      >
                        Registrar pago
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {pendientes.length === 0 && detail.facturas.length === 0 && <p className="text-slate-500">Sin facturas.</p>}
        </div>

        <div>
          <h4 className="font-bold text-slate-800 mb-1">Avisos</h4>
          {detail.avisos.length === 0 ? (
            <p className="text-slate-500">Sin avisos.</p>
          ) : (
            detail.avisos.slice(0, 20).map((n: any) => (
              <div key={n.id} className={n.estado === 'ENVIADO' ? 'text-slate-700' : 'text-amber-700'}>
                {n.fecha.slice(0, 16).replace('T', ' ')} · {n.tipo} · {n.estado}
                {n.error ? ` (${n.error})` : ''}
              </div>
            ))
          )}
        </div>

        <div>
          <h4 className="font-bold text-slate-800 mb-1">Historial de estados</h4>
          {c.historialEstados
            .slice()
            .reverse()
            .map((h: any, i: number) => (
              <div key={i} className="text-slate-600">
                {h.fecha.slice(0, 16).replace('T', ' ')} · {h.de || '—'} → {h.a} · {h.motivo} {h.automatico ? '(automático)' : ''}
              </div>
            ))}
        </div>

        <details>
          <summary className="cursor-pointer font-bold text-slate-800">Datos, plan, contrato y plazos</summary>
          <div className="pt-2">{accountForm(false)}</div>
        </details>
      </div>
    );
  };

  return (
    <div className={embebido ? '' : 'fixed inset-0 z-[70] bg-slate-900/50 flex items-center justify-center p-3'}>
      <div className={embebido ? 'bg-white rounded-xl border border-slate-200 shadow-xs w-full flex flex-col' : 'bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col'}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <div>
            <h3 className="text-sm font-black text-slate-900">Clientes ERP y cobranza</h3>
            <p className="text-[11px] text-slate-500">Planes, límites, estados, facturación de suscripciones y bloqueo por falta de pago.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={busy}
              className="px-2.5 py-1 text-xs bg-slate-100 rounded flex items-center gap-1 disabled:opacity-50"
              onClick={() => run(() => api('POST', '/api/saas/cycle/run'), 'Ciclo de cobranza ejecutado.')}
              title="Genera facturas del mes, sincroniza emisiones, envía avisos y aplica bloqueos"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Ejecutar ciclo ahora
            </button>
            {!embebido && (
              <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {overview && !overview.smtpConfigurado && (
          <div className="px-5 py-1.5 bg-amber-50 border-b border-amber-200 text-[11px] text-amber-800 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> SMTP no configurado: los avisos de cobranza quedan registrados pero no se envían por correo.
          </div>
        )}
        {msg && (
          <div className={`px-5 py-1.5 text-xs flex items-center gap-1.5 ${msg.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>
            {msg.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />} {msg.text}
          </div>
        )}

        <div className={embebido ? 'p-5' : 'flex-1 overflow-y-auto p-5'}>
          {view.tipo !== 'LISTA' && (
            <button type="button" className="text-xs underline mb-3" onClick={() => setView({ tipo: 'LISTA' })}>
              ← Volver a la lista
            </button>
          )}
          {view.tipo === 'LISTA' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500">
                  {clientes.length} clientes ERP · {sinCliente.length} empresas sin cliente asignado
                </span>
                <button type="button" className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-bold flex items-center gap-1" onClick={() => setView({ tipo: 'NUEVO' })}>
                  <Plus className="w-3.5 h-3.5" /> Nuevo cliente ERP
                </button>
              </div>
              <table className="w-full text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left px-2 py-1">Cliente ERP</th>
                    <th className="text-left px-2 py-1">Tipo</th>
                    <th className="text-left px-2 py-1">Plan</th>
                    <th className="text-left px-2 py-1">Estado</th>
                    <th className="text-right px-2 py-1">Empresas</th>
                    <th className="text-right px-2 py-1">Usuarios</th>
                    <th className="text-right px-2 py-1">Atraso</th>
                    <th className="text-right px-2 py-1">Deuda vencida</th>
                  </tr>
                </thead>
                <tbody>
                  {clientes.map((c) => (
                    <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => setView({ tipo: 'DETALLE', id: c.id })}>
                      <td className="px-2 py-1 font-semibold">
                        {c.razonSocial} {c.esPropietario ? '(empresa dueña)' : ''}
                      </td>
                      <td className="px-2 py-1">{c.tipo}</td>
                      <td className="px-2 py-1">{c.planId}</td>
                      <td className="px-2 py-1">
                        <span className={`px-1.5 py-0.5 rounded font-bold ${ESTADO_STYLE[c.estado] || ''}`}>{c.estado}</span>
                      </td>
                      <td className="px-2 py-1 text-right">{c.esPropietario ? c.consumo.empresas : `${c.consumo.empresas}/${c.consumo.limiteEmpresas}`}</td>
                      <td className="px-2 py-1 text-right">{c.esPropietario ? c.consumo.usuarios : `${c.consumo.usuarios}/${c.consumo.limiteUsuarios}`}</td>
                      <td className="px-2 py-1 text-right">{c.diasAtraso ? `${c.diasAtraso} d` : '—'}</td>
                      <td className="px-2 py-1 text-right">{c.deudaVencida ? clp(c.deudaVencida) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {view.tipo === 'NUEVO' && accountForm(true)}
          {view.tipo === 'DETALLE' && detailView()}
        </div>
      </div>
    </div>
  );
};

export default SaasAdminPanel;
