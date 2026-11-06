import React, { useState } from 'react';
import {
  ListTree,
  FolderTree,
  PlusCircle,
  CheckCircle2,
  AlertTriangle,
  X,
  RotateCcw,
  Sparkles,
  Bot,
  Hash,
  FileSpreadsheet,
  Check,
  Search,
  Filter
} from 'lucide-react';
import { AccountGroupClassification, AccountCreationDefinition } from '../../types';
import { INITIAL_ACCOUNT_GROUPS } from '../../config/erpMasterConfig';
import { STANDARD_ACCOUNT_PLAN } from '../../utils/chileanAccounting';

interface IfrsChartOfAccountsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddAccount?: (account: AccountCreationDefinition) => void;
}

export const IfrsChartOfAccountsModal: React.FC<IfrsChartOfAccountsModalProps> = ({
  isOpen,
  onClose,
  onAddAccount,
}) => {
  const [activeTab, setActiveTab] = useState<'AGRUPACIONES' | 'CREACION_CUENTAS'>('AGRUPACIONES');
  const [accountGroups, setAccountGroups] = useState<AccountGroupClassification[]>(INITIAL_ACCOUNT_GROUPS);

  // Tab 1: Form Agrupaciones (Matching Page 8 bottom)
  const [codPadre, setCodPadre] = useState<string>('Raíz del Catálogo');
  const [tipoCuentaAgrupacion, setTipoCuentaAgrupacion] = useState<'ACTIVO' | 'PASIVO' | 'PATRIMONIO' | 'RESULTADO'>('ACTIVO');
  const [codigoAgrupacion, setCodigoAgrupacion] = useState<string>('1.1.09');
  const [descripcionAgrupacion, setDescripcionAgrupacion] = useState<string>('Activos Biológicos y Acuícolas');
  const [groupSuccessMsg, setGroupSuccessMsg] = useState<string | null>(null);

  // Tab 2: Form Creación de Cuentas (Matching Page 9)
  const [codigoCuenta, setCodigoCuenta] = useState<string>('110104');
  const [nombreCuenta, setNombreCuenta] = useState<string>('Banco Santander Moneda Nacional');
  const [clasificacionCuenta, setClasificacionCuenta] = useState<'ACTIVO' | 'PASIVO' | 'PATRIMONIO' | 'RESULTADO'>('ACTIVO');
  const [agrupacionSeleccionada, setAgrupacionSeleccionada] = useState<string>('1.1.01');
  const [codigoE, setCodigoE] = useState<string>('');
  const [codigoS, setCodigoS] = useState<string>('');
  const [codigoFlujoEfectivo, setCodigoFlujoEfectivo] = useState<string>('OPERACION');
  const [notasCuenta, setNotasCuenta] = useState<string>('Cuenta bancaria operativa para recaudación de ventas y pagos con proveedores.');

  // Toggles de Atributos (Matching Page 9 right side)
  const [activoToggle, setActivoToggle] = useState<boolean>(true);
  const [auxiliarToggle, setAuxiliarToggle] = useState<boolean>(true);
  const [multimonedaToggle, setMultimonedaToggle] = useState<boolean>(false);
  const [moneda, setMoneda] = useState<string>('CLP');
  const [docRefToggle, setDocRefToggle] = useState<boolean>(true);
  const [conciliacionToggle, setConciliacionToggle] = useState<boolean>(true);
  const [ifrsToggle, setIfrsToggle] = useState<boolean>(true);
  const [centroCostoToggle, setCentroCostoToggle] = useState<boolean>(true);
  const [dimension2Toggle, setDimension2Toggle] = useState<boolean>(false);
  const [detHabitaToggle, setDetHabitaToggle] = useState<boolean>(false);
  const [proyectoToggle, setProyectoToggle] = useState<boolean>(false);

  const [accountSuccessMsg, setAccountSuccessMsg] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState<string>('');

  if (!isOpen) return null;

  const handleSaveAgrupacion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!codigoAgrupacion.trim() || !descripcionAgrupacion.trim()) {
      alert('Código y Descripción son obligatorios.');
      return;
    }

    const newGroup: AccountGroupClassification = {
      codigo: codigoAgrupacion.trim(),
      codPadre: codPadre.trim(),
      tipoCuenta: tipoCuentaAgrupacion,
      descripcion: descripcionAgrupacion.trim(),
    };

    setAccountGroups((prev) => [newGroup, ...prev]);
    setGroupSuccessMsg(`Clasificación "${codigoAgrupacion} - ${descripcionAgrupacion}" guardada exitosamente.`);
    setTimeout(() => setGroupSuccessMsg(null), 3000);

    setCodigoAgrupacion('');
    setDescripcionAgrupacion('');
  };

  const handleSaveCuenta = (e: React.FormEvent) => {
    e.preventDefault();
    if (!codigoCuenta.trim() || !nombreCuenta.trim()) {
      alert('Código y Nombre de Cuenta son obligatorios.');
      return;
    }

    const newAccount: AccountCreationDefinition = {
      codigo: codigoCuenta.trim(),
      nombre: nombreCuenta.trim(),
      clasificacion: clasificacionCuenta,
      agrupacion: agrupacionSeleccionada,
      codigoE: codigoE.trim(),
      codigoS: codigoS.trim(),
      codigoFlujoEfectivo: codigoFlujoEfectivo.trim(),
      notas: notasCuenta.trim(),
      atributos: {
        activo: activoToggle,
        auxiliar: auxiliarToggle,
        multimoneda: multimonedaToggle,
        moneda: multimonedaToggle ? moneda : 'CLP',
        docRef: docRefToggle,
        conciliacion: conciliacionToggle,
        ifrs: ifrsToggle,
        centroCosto: centroCostoToggle,
        dimension2: dimension2Toggle,
        detHabita: detHabitaToggle,
        proyecto: proyectoToggle,
      },
    };

    if (onAddAccount) {
      onAddAccount(newAccount);
    }

    setAccountSuccessMsg(`Cuenta contable "${codigoCuenta} - ${nombreCuenta}" creada en el maestro IFRS.`);
    setTimeout(() => setAccountSuccessMsg(null), 3500);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-5xl overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header matching Pages 8-9 */}
        <div className="bg-[#0b192c] text-white px-5 py-3.5 flex items-center justify-between border-b-2 border-indigo-500 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-xs">
              <FolderTree className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold tracking-wide uppercase">
                Plan de Cuentas IFRS
              </h2>
              <p className="text-[10px] text-indigo-300 font-mono tracking-wider">
                CONFIGURACIÓN DE NIVELES JERÁRQUICOS Y MAESTRO DE CUENTAS CONTABLES
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-md transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2 Tabs matching Page 8 bottom and Page 9 */}
        <div className="bg-slate-100 border-b border-slate-200 px-5 flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('AGRUPACIONES')}
            className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'AGRUPACIONES'
                ? 'border-indigo-600 text-indigo-800 bg-white shadow-2xs rounded-t-md'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ListTree className="w-4 h-4" />
            <span>Agrupaciones (Nivel Jerárquico)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('CREACION_CUENTAS')}
            className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'CREACION_CUENTAS'
                ? 'border-indigo-600 text-indigo-800 bg-white shadow-2xs rounded-t-md'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>Creación de Cuentas (Nivel Imputable)</span>
          </button>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* TAB 1: AGRUPACIONES (Page 8 bottom) */}
          {activeTab === 'AGRUPACIONES' && (
            <div className="space-y-5 animate-in fade-in duration-100">
              {/* Asistente Banner */}
              <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-indigo-900">
                  <Bot className="w-4 h-4 text-indigo-600" />
                  <span>
                    <strong>Asistente de Jerarquía:</strong> Dicte código y descripción (ej: 1.1 ACTIVO CORRIENTE)
                  </span>
                </div>
                <span className="text-[10px] font-mono text-indigo-600 bg-white px-2 py-0.5 rounded border border-indigo-200">
                  AUTO-MAPPING ACTIVO
                </span>
              </div>

              {groupSuccessMsg && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-2.5 rounded text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>{groupSuccessMsg}</span>
                </div>
              )}

              {/* Form de creación de agrupación */}
              <form onSubmit={handleSaveAgrupacion} className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Cod_Padre
                    </label>
                    <select
                      value={codPadre}
                      onChange={(e) => setCodPadre(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="Raíz del Catálogo">Raíz del Catálogo</option>
                      {accountGroups.map((g) => (
                        <option key={g.codigo} value={g.codigo}>
                          {g.codigo} - {g.descripcion}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Tipo de Cuenta <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={tipoCuentaAgrupacion}
                      onChange={(e) => setTipoCuentaAgrupacion(e.target.value as any)}
                      className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="ACTIVO">ACTIVO</option>
                      <option value="PASIVO">PASIVO</option>
                      <option value="PATRIMONIO">PATRIMONIO</option>
                      <option value="RESULTADO">RESULTADO</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Código <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={codigoAgrupacion}
                      onChange={(e) => setCodigoAgrupacion(e.target.value)}
                      placeholder="Ej: 1.1.09"
                      className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Descripción <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={descripcionAgrupacion}
                      onChange={(e) => setDescripcionAgrupacion(e.target.value)}
                      placeholder="Ej: Activos Biológicos"
                      className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      required
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Guardar Clasificación</span>
                  </button>
                </div>
              </form>

              {/* Lista de agrupaciones actuales */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>Estructura Jerárquica IFRS ({accountGroups.length} niveles configurados)</span>
                  <span className="text-[11px] text-slate-500">FORMATO ESTÁNDAR FECU CHILE</span>
                </div>
                <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                  {accountGroups.map((g) => (
                    <div key={g.codigo} className="px-4 py-2 flex items-center justify-between hover:bg-slate-50 text-xs">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-indigo-700 w-20">{g.codigo}</span>
                        <span className="font-semibold text-slate-800">{g.descripcion}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-slate-400 font-mono">Padre: {g.codPadre}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            g.tipoCuenta === 'ACTIVO'
                              ? 'bg-blue-100 text-blue-800'
                              : g.tipoCuenta === 'PASIVO'
                              ? 'bg-rose-100 text-rose-800'
                              : g.tipoCuenta === 'PATRIMONIO'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {g.tipoCuenta}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CREACIÓN DE CUENTAS (Page 9) */}
          {activeTab === 'CREACION_CUENTAS' && (
            <div className="space-y-5 animate-in fade-in duration-100">
              {accountSuccessMsg && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-2.5 rounded text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>{accountSuccessMsg}</span>
                </div>
              )}

              <form onSubmit={handleSaveCuenta} className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                  {/* Left Col: Datos Principales (Page 9 Left) */}
                  <div className="lg:col-span-2 bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                          Código <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={codigoCuenta}
                          onChange={(e) => setCodigoCuenta(e.target.value)}
                          placeholder="Ej: 110104"
                          className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                          Nombre de la Cuenta <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={nombreCuenta}
                          onChange={(e) => setNombreCuenta(e.target.value)}
                          placeholder="Ej: Banco Santander Moneda Nacional"
                          className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                          Clasificación <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={clasificacionCuenta}
                          onChange={(e) => setClasificacionCuenta(e.target.value as any)}
                          className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="ACTIVO">ACTIVO</option>
                          <option value="PASIVO">PASIVO</option>
                          <option value="PATRIMONIO">PATRIMONIO</option>
                          <option value="RESULTADO">RESULTADO</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                          Agrupación
                        </label>
                        <select
                          value={agrupacionSeleccionada}
                          onChange={(e) => setAgrupacionSeleccionada(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          {accountGroups.map((g) => (
                            <option key={g.codigo} value={g.codigo}>
                              {g.codigo} - {g.descripcion}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                          Código E
                        </label>
                        <input
                          type="text"
                          value={codigoE}
                          onChange={(e) => setCodigoE(e.target.value)}
                          placeholder="Mapeo Terciario"
                          className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                          Código S
                        </label>
                        <input
                          type="text"
                          value={codigoS}
                          onChange={(e) => setCodigoS(e.target.value)}
                          placeholder="Mapeo Secundario"
                          className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                          Código Flujo Efectivo
                        </label>
                        <select
                          value={codigoFlujoEfectivo}
                          onChange={(e) => setCodigoFlujoEfectivo(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="OPERACION">Actividades de Operación</option>
                          <option value="INVERSION">Actividades de Inversión</option>
                          <option value="FINANCIAMIENTO">Actividades de Financiamiento</option>
                          <option value="NO_APLICA">No Aplica a Efectivo</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        Notas
                      </label>
                      <textarea
                        rows={2}
                        value={notasCuenta}
                        onChange={(e) => setNotasCuenta(e.target.value)}
                        placeholder="Descripción u observaciones sobre la cuenta..."
                        className="w-full bg-white border border-slate-300 rounded-md p-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Right Col: Atributos y Controles de Imputación (Page 9 Right) */}
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider border-b border-slate-200 pb-1.5">
                      Atributos de Imputación
                    </h3>

                    <div className="space-y-2 text-xs">
                      <label className="flex items-center justify-between p-1 rounded hover:bg-white cursor-pointer">
                        <span className="font-bold text-slate-700">ACTIVO</span>
                        <input
                          type="checkbox"
                          checked={activoToggle}
                          onChange={(e) => setActivoToggle(e.target.checked)}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                      </label>

                      <label className="flex items-center justify-between p-1 rounded hover:bg-white cursor-pointer">
                        <span className="font-bold text-slate-700">AUXILIAR (RUT / Cliente)</span>
                        <input
                          type="checkbox"
                          checked={auxiliarToggle}
                          onChange={(e) => setAuxiliarToggle(e.target.checked)}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                      </label>

                      <div className="border-t border-slate-200 pt-2 space-y-1.5">
                        <label className="flex items-center justify-between p-1 rounded hover:bg-white cursor-pointer">
                          <span className="font-bold text-slate-700">MULTIMONEDA</span>
                          <input
                            type="checkbox"
                            checked={multimonedaToggle}
                            onChange={(e) => setMultimonedaToggle(e.target.checked)}
                            className="rounded text-indigo-600 focus:ring-indigo-500"
                          />
                        </label>

                        {multimonedaToggle && (
                          <div className="pl-3">
                            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-0.5">Moneda Base</label>
                            <select
                              value={moneda}
                              onChange={(e) => setMoneda(e.target.value)}
                              className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-bold"
                            >
                              <option value="CLP">CLP (Pesos Chilenos)</option>
                              <option value="USD">USD (Dólares)</option>
                              <option value="EUR">EUR (Euros)</option>
                              <option value="UF">UF (Unidad de Fomento)</option>
                            </select>
                          </div>
                        )}
                      </div>

                      <label className="flex items-center justify-between p-1 rounded hover:bg-white cursor-pointer">
                        <span className="font-bold text-slate-700">DOC. REF (Documento Tributario)</span>
                        <input
                          type="checkbox"
                          checked={docRefToggle}
                          onChange={(e) => setDocRefToggle(e.target.checked)}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                      </label>

                      <label className="flex items-center justify-between p-1 rounded hover:bg-white cursor-pointer">
                        <span className="font-bold text-slate-700">CONCILIACIÓN</span>
                        <input
                          type="checkbox"
                          checked={conciliacionToggle}
                          onChange={(e) => setConciliacionToggle(e.target.checked)}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                      </label>

                      <label className="flex items-center justify-between p-1 rounded hover:bg-white cursor-pointer">
                        <span className="font-bold text-slate-700">IFRS</span>
                        <input
                          type="checkbox"
                          checked={ifrsToggle}
                          onChange={(e) => setIfrsToggle(e.target.checked)}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                      </label>

                      <label className="flex items-center justify-between p-1 rounded hover:bg-white cursor-pointer">
                        <span className="font-bold text-slate-700">C. COSTO</span>
                        <input
                          type="checkbox"
                          checked={centroCostoToggle}
                          onChange={(e) => setCentroCostoToggle(e.target.checked)}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                      </label>

                      <label className="flex items-center justify-between p-1 rounded hover:bg-white cursor-pointer">
                        <span className="font-medium text-slate-600">DIMENSIÓN 2</span>
                        <input
                          type="checkbox"
                          checked={dimension2Toggle}
                          onChange={(e) => setDimension2Toggle(e.target.checked)}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                      </label>

                      <label className="flex items-center justify-between p-1 rounded hover:bg-white cursor-pointer">
                        <span className="font-medium text-slate-600">DET. HABITA</span>
                        <input
                          type="checkbox"
                          checked={detHabitaToggle}
                          onChange={(e) => setDetHabitaToggle(e.target.checked)}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                      </label>

                      <label className="flex items-center justify-between p-1 rounded hover:bg-white cursor-pointer">
                        <span className="font-medium text-slate-600">PROYECTO</span>
                        <input
                          type="checkbox"
                          checked={proyectoToggle}
                          onChange={(e) => setProyectoToggle(e.target.checked)}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                      </label>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-md text-xs font-bold uppercase tracking-wider shadow-sm transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                    <span>Guardar Cuenta Contable</span>
                  </button>
                </div>
              </form>

              {/* Catálogo de Cuentas */}
              <div className="border border-slate-200 rounded-lg overflow-hidden mt-4">
                <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-700">
                    Cuentas Contables Registradas ({STANDARD_ACCOUNT_PLAN.length})
                  </span>
                  <div className="relative w-64">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Buscar por código o nombre..."
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded pl-8 pr-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
                  {STANDARD_ACCOUNT_PLAN
                    .filter(a => 
                      a.codigo.toLowerCase().includes(searchFilter.toLowerCase()) || 
                      a.nombre.toLowerCase().includes(searchFilter.toLowerCase())
                    )
                    .map((a) => (
                      <div key={a.codigo} className="px-4 py-2 flex items-center justify-between hover:bg-slate-50 text-xs">
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold text-indigo-700 w-16">{a.codigo}</span>
                          <span className="font-medium text-slate-800">{a.nombre}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px]">
                          <span className="font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            {a.tipo}
                          </span>
                          <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-bold">
                            IFRS ✓
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
