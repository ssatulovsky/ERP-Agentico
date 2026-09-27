import React, { useState } from 'react';
import { X, Coins, Plus, Trash2, CheckCircle2, Wallet } from 'lucide-react';
import { CashAccountConfig, CashAccountType } from '../types';

interface CashAccountsManagerModalProps {
  cashAccounts: CashAccountConfig[];
  onUpdateCashAccounts: (accounts: CashAccountConfig[]) => void;
  onClose: () => void;
}

export const CashAccountsManagerModal: React.FC<CashAccountsManagerModalProps> = ({
  cashAccounts = [],
  onUpdateCashAccounts,
  onClose,
}) => {
  const [accounts, setAccounts] = useState<CashAccountConfig[]>(Array.isArray(cashAccounts) ? cashAccounts : []);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAccount, setNewAccount] = useState<{
    nombre: string;
    tipoCuenta: CashAccountType;
    codigoContable: string;
    responsableNombre: string;
    montoSaldo: number;
    moneda: 'CLP' | 'USD';
    centroCostoId: string;
    descripcion: string;
  }>({
    nombre: '',
    tipoCuenta: 'FONDO_FIJO',
    codigoContable: '1.1.01.002',
    responsableNombre: '',
    montoSaldo: 500000,
    moneda: 'CLP',
    centroCostoId: 'CC-ADM-01',
    descripcion: '',
  });

  const totalSaldoEfectivo = (accounts || [])
    .filter(a => a && a.activo)
    .reduce((sum, a) => sum + (Number(a.montoSaldo) || 0), 0);

  const formatCLP = (val?: number) => `$${Math.round(val || 0).toLocaleString('es-CL')}`;

  const handleToggleActive = (id: string) => {
    const updated = (accounts || []).map(a => (a.id === id ? { ...a, activo: !a.activo } : a));
    setAccounts(updated);
    onUpdateCashAccounts(updated);
  };

  const handleUpdateSaldo = (id: string, newSaldo: number) => {
    const updated = (accounts || []).map(a => (a.id === id ? { ...a, montoSaldo: newSaldo } : a));
    setAccounts(updated);
    onUpdateCashAccounts(updated);
  };

  const handleDeleteAccount = (id: string) => {
    const updated = (accounts || []).filter(a => a.id !== id);
    setAccounts(updated);
    onUpdateCashAccounts(updated);
  };

  const handleAddAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccount.nombre || !newAccount.responsableNombre) return;

    const created: CashAccountConfig = {
      id: `cash-${Date.now()}`,
      nombre: newAccount.nombre,
      tipoCuenta: newAccount.tipoCuenta,
      codigoContable: newAccount.codigoContable || '1.1.01.009',
      responsableNombre: newAccount.responsableNombre,
      montoSaldo: Number(newAccount.montoSaldo) || 0,
      moneda: newAccount.moneda,
      activo: true,
      centroCostoId: newAccount.centroCostoId,
      descripcion: newAccount.descripcion,
    };

    const updated = [...accounts, created];
    setAccounts(updated);
    onUpdateCashAccounts(updated);
    setShowAddForm(false);
    setNewAccount({
      nombre: '',
      tipoCuenta: 'FONDO_FIJO',
      codigoContable: '1.1.01.002',
      responsableNombre: '',
      montoSaldo: 500000,
      moneda: 'CLP',
      centroCostoId: 'CC-ADM-01',
      descripcion: '',
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden my-8 animate-fadeIn">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-indigo-950 text-white p-5 flex items-center justify-between border-b border-emerald-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Gestión de Cajas & Fondos Fijos
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/30 text-emerald-200 border border-emerald-400/30">
                  Efectivo en Caja
                </span>
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                Cuentas de liquidez inmediata incluidas en el saldo inicial del flujo de caja proyectado
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Total Summary Strip */}
        <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-emerald-900">
            <Wallet className="w-4 h-4 text-emerald-700" />
            <span>Total Disponible en Cajas & Fondos Fijos:</span>
          </div>
          <div className="font-mono font-black text-emerald-800 text-lg">
            {formatCLP(totalSaldoEfectivo)}
          </div>
        </div>

        {/* Account List */}
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Cuentas de Efectivo Activas ({accounts.length})
            </span>
            {!showAddForm && (
              <button
                onClick={() => setShowAddForm(true)}
                className="flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-100 hover:bg-emerald-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nueva Caja / Fondo Fijo</span>
              </button>
            )}
          </div>

          {/* Add Account Form */}
          {showAddForm && (
            <form
              onSubmit={handleAddAccount}
              className="p-4 rounded-xl border border-emerald-300 bg-emerald-50/50 space-y-3 animate-fadeIn"
            >
              <div className="flex items-center justify-between border-b border-emerald-200/80 pb-2">
                <span className="text-xs font-bold text-emerald-900">Agregar Nueva Cuenta de Efectivo</span>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="text-slate-400 hover:text-slate-600 text-xs"
                >
                  Cancelar
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nombre de la Cuenta:</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Fondo Fijo Operaciones"
                    value={newAccount.nombre}
                    onChange={(e) => setNewAccount(prev => ({ ...prev, nombre: e.target.value }))}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tipo de Cuenta:</label>
                  <select
                    value={newAccount.tipoCuenta}
                    onChange={(e) => setNewAccount(prev => ({ ...prev, tipoCuenta: e.target.value as CashAccountType }))}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 focus:border-emerald-600"
                  >
                    <option value="FONDO_FIJO">Fondo Fijo de Operaciones</option>
                    <option value="CAJA_EFECTIVO">Caja Efectivo / Central</option>
                    <option value="CAJA_CHICA">Caja Chica</option>
                    <option value="RECAUDACION_POR_DEPOSITAR">Recaudación por Depositar</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Código Contable:</label>
                  <input
                    type="text"
                    placeholder="Ej. 1.1.01.002"
                    value={newAccount.codigoContable}
                    onChange={(e) => setNewAccount(prev => ({ ...prev, codigoContable: e.target.value }))}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono text-slate-900 focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Saldo Disponible ($ CLP):</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={newAccount.montoSaldo}
                    onChange={(e) => setNewAccount(prev => ({ ...prev, montoSaldo: Number(e.target.value) || 0 }))}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono font-bold text-slate-900 focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Responsable / Custodio:</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Juan Pérez (Jefe Planta)"
                    value={newAccount.responsableNombre}
                    onChange={(e) => setNewAccount(prev => ({ ...prev, responsableNombre: e.target.value }))}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Centro de Costo ID:</label>
                  <input
                    type="text"
                    placeholder="Ej. CC-ADM-01 / CC-PRD-01"
                    value={newAccount.centroCostoId}
                    onChange={(e) => setNewAccount(prev => ({ ...prev, centroCostoId: e.target.value }))}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-emerald-200/60">
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  Guardar Cuenta
                </button>
              </div>
            </form>
          )}

          {/* Accounts list */}
          <div className="space-y-2.5">
            {(accounts || []).map((acc) => (
              <div
                key={acc.id}
                className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  acc.activo
                    ? 'bg-slate-50 border-slate-200 hover:border-emerald-300'
                    : 'bg-slate-100/60 border-slate-200 opacity-60'
                }`}
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-slate-900">{acc.nombre}</span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-slate-200 text-slate-700">
                      {acc.tipoCuenta.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      [{acc.codigoContable}]
                    </span>
                    {!acc.activo && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-100 text-rose-700">
                        Inactiva
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-2">
                    <span>Custodio: <strong className="text-slate-700">{acc.responsableNombre}</strong></span>
                    {acc.centroCostoId && (
                      <span>• CC: <span className="text-slate-700 font-mono">{acc.centroCostoId}</span></span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block uppercase">Saldo Líquido</span>
                    <input
                      type="number"
                      value={acc.montoSaldo}
                      onChange={(e) => handleUpdateSaldo(acc.id, Number(e.target.value) || 0)}
                      className="w-28 font-mono font-bold text-right text-xs bg-white border border-slate-300 rounded px-2 py-1 text-slate-900 focus:border-emerald-600"
                    />
                  </div>

                  <button
                    onClick={() => handleToggleActive(acc.id)}
                    title={acc.activo ? 'Desactivar para el flujo' : 'Activar en el flujo'}
                    className={`p-1.5 rounded-lg border text-xs cursor-pointer ${
                      acc.activo
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-200 text-slate-500 border-slate-300'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDeleteAccount(acc.id)}
                    title="Eliminar cuenta"
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
          >
            Listo / Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
