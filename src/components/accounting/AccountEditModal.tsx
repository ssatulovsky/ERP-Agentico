import React, { useState, useEffect } from 'react';
import { Sliders, X, Check, Globe, Shield, Tag } from 'lucide-react';
import {
  HierarchicalAccountItem,
  AccountGroupDefinition,
  AccountNature,
} from '../../types';
import {
  FISCAL_GROUPING_OPTIONS,
  HEADQUARTERS_GROUPING_OPTIONS,
} from '../../utils/companyChartOfAccountsService';

interface AccountEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (account: HierarchicalAccountItem) => void;
  accountToEdit?: HierarchicalAccountItem | null;
  initialParentCode?: string;
  groups: AccountGroupDefinition[];
  existingAccounts: HierarchicalAccountItem[];
}

export const AccountEditModal: React.FC<AccountEditModalProps> = ({
  isOpen,
  onClose,
  onSave,
  accountToEdit,
  initialParentCode,
  groups,
  existingAccounts,
}) => {
  const isEditing = Boolean(accountToEdit);

  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [clase, setClase] = useState<1 | 2 | 3 | 4 | 5 | 6 | 7>(1);
  const [grupo, setGrupo] = useState('1.1');
  const [subgrupo, setSubgrupo] = useState('1.1.01');
  const [tipo, setTipo] = useState<'ACTIVO' | 'PASIVO' | 'PATRIMONIO' | 'INGRESO' | 'COSTO' | 'GASTO'>('ACTIVO');
  const [clasificacion, setClasificacion] = useState<'CIRCULANTE' | 'NO_CIRCULANTE' | 'CORTO_PLAZO' | 'LARGO_PLAZO' | 'OPERACIONAL' | 'NO_OPERACIONAL'>('CIRCULANTE');
  const [naturaleza, setNaturaleza] = useState<AccountNature>('DEUDORA');

  // Mappings para Agrupaciones
  const [agrupacionFiscal, setAgrupacionFiscal] = useState<string>(FISCAL_GROUPING_OPTIONS[0]);
  const [customFiscal, setCustomFiscal] = useState<string>('');
  const [agrupacionMatrizExtranjera, setAgrupacionMatrizExtranjera] = useState<string>(HEADQUARTERS_GROUPING_OPTIONS[0]);
  const [customHq, setCustomHq] = useState<string>('');
  const [agrupacionPersonalizada, setAgrupacionPersonalizada] = useState<string>('');

  // Atributos
  const [requiereAuxiliarRut, setRequiereAuxiliarRut] = useState(false);
  const [requiereCentroCosto, setRequiereCentroCosto] = useState(false);
  const [esConciliableBancaria, setEsConciliableBancaria] = useState(false);
  const [activa, setActiva] = useState(true);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Cargar datos al abrir o cambiar cuenta a editar
  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);

    if (accountToEdit) {
      setCodigo(accountToEdit.codigo);
      setNombre(accountToEdit.nombre);
      setClase(accountToEdit.clase);
      setGrupo(accountToEdit.grupo);
      setSubgrupo(accountToEdit.subgrupo);
      setTipo(accountToEdit.tipo);
      setClasificacion(accountToEdit.clasificacion);
      setNaturaleza(accountToEdit.naturaleza);

      setAgrupacionFiscal(accountToEdit.agrupacionFiscal || FISCAL_GROUPING_OPTIONS[0]);
      setAgrupacionMatrizExtranjera(accountToEdit.agrupacionMatrizExtranjera || HEADQUARTERS_GROUPING_OPTIONS[0]);
      setAgrupacionPersonalizada(accountToEdit.agrupacionPersonalizada || '');

      setRequiereAuxiliarRut(accountToEdit.requiereAuxiliarRut);
      setRequiereCentroCosto(accountToEdit.requiereCentroCosto);
      setEsConciliableBancaria(accountToEdit.esConciliableBancaria);
      setActiva(accountToEdit.activa);
    } else {
      // Modo nueva cuenta o subcuenta
      if (initialParentCode) {
        // Sugerir código hijo
        const parentParts = initialParentCode.split('.');
        const parentClass = Number(parentParts[0]) as any;
        setClase(parentClass >= 1 && parentClass <= 7 ? parentClass : 1);
        const derivedGrp = parentParts.slice(0, 2).join('.');
        const derivedSub = parentParts.slice(0, 3).join('.');
        setGrupo(derivedGrp);
        setSubgrupo(derivedSub);

        // Buscar correlativo
        const siblingAccounts = existingAccounts.filter((a) => a.codigo.startsWith(derivedSub + '.'));
        const nextNum = siblingAccounts.length + 1;
        setCodigo(`${derivedSub}.${String(nextNum).padStart(3, '0')}`);
      } else {
        setClase(1);
        setGrupo('1.1');
        setSubgrupo('1.1.01');
        setCodigo('1.1.01.099');
      }

      setNombre('');
      setTipo('ACTIVO');
      setClasificacion('CIRCULANTE');
      setNaturaleza('DEUDORA');
      setAgrupacionFiscal(FISCAL_GROUPING_OPTIONS[0]);
      setAgrupacionMatrizExtranjera(HEADQUARTERS_GROUPING_OPTIONS[0]);
      setAgrupacionPersonalizada('');
      setRequiereAuxiliarRut(false);
      setRequiereCentroCosto(false);
      setEsConciliableBancaria(false);
      setActiva(true);
    }
  }, [isOpen, accountToEdit, initialParentCode, existingAccounts]);

  if (!isOpen) return null;

  // Filtrar grupos de la clase seleccionada
  const availableGroups = groups.filter((g) => g.nivel === 2 && g.clase === clase);
  // Filtrar subgrupos del grupo seleccionado
  const availableSubgroups = groups.filter((g) => g.nivel === 3 && g.padreCodigo === grupo);

  // Al cambiar la clase, actualizar grupo, subgrupo y tipo
  const handleClaseChange = (newClase: 1 | 2 | 3 | 4 | 5 | 6 | 7) => {
    setClase(newClase);
    const firstGrp = groups.find((g) => g.nivel === 2 && g.clase === newClase);
    const grpCode = firstGrp ? firstGrp.codigo : `${newClase}.1`;
    setGrupo(grpCode);

    const firstSub = groups.find((g) => g.nivel === 3 && g.padreCodigo === grpCode);
    const subCode = firstSub ? firstSub.codigo : `${grpCode}.01`;
    setSubgrupo(subCode);

    // Actualizar tipo y naturaleza estándar según la clase
    if (newClase === 1) {
      setTipo('ACTIVO');
      setNaturaleza('DEUDORA');
      setClasificacion('CIRCULANTE');
    } else if (newClase === 2) {
      setTipo('PASIVO');
      setNaturaleza('ACREEDORA');
      setClasificacion('CORTO_PLAZO');
    } else if (newClase === 3) {
      setTipo('PATRIMONIO');
      setNaturaleza('ACREEDORA');
      setClasificacion('NO_CIRCULANTE');
    } else if (newClase === 4) {
      setTipo('INGRESO');
      setNaturaleza('ACREEDORA');
      setClasificacion('OPERACIONAL');
    } else if (newClase === 5) {
      setTipo('COSTO');
      setNaturaleza('DEUDORA');
      setClasificacion('OPERACIONAL');
    } else if (newClase === 6) {
      setTipo('GASTO');
      setNaturaleza('DEUDORA');
      setClasificacion('OPERACIONAL');
    } else if (newClase === 7) {
      setTipo('GASTO');
      setNaturaleza('DEUDORA');
      setClasificacion('NO_OPERACIONAL');
    }

    if (!isEditing) {
      setCodigo(`${subCode}.001`);
    }
  };

  const handleGrupoChange = (newGrupo: string) => {
    setGrupo(newGrupo);
    const firstSub = groups.find((g) => g.nivel === 3 && g.padreCodigo === newGrupo);
    const subCode = firstSub ? firstSub.codigo : `${newGrupo}.01`;
    setSubgrupo(subCode);
    if (!isEditing) {
      setCodigo(`${subCode}.001`);
    }
  };

  const handleSubgrupoChange = (newSub: string) => {
    setSubgrupo(newSub);
    if (!isEditing) {
      const siblingCount = existingAccounts.filter((a) => a.codigo.startsWith(newSub + '.')).length;
      setCodigo(`${newSub}.${String(siblingCount + 1).padStart(3, '0')}`);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanCodigo = codigo.trim();
    const cleanNombre = nombre.trim();

    if (!cleanCodigo) {
      setErrorMsg('Debe ingresar un código para la cuenta contable.');
      return;
    }
    if (!cleanNombre) {
      setErrorMsg('Debe ingresar el nombre de la cuenta.');
      return;
    }

    // Si es creación, verificar que el código no esté duplicado
    if (!isEditing) {
      const exists = existingAccounts.some((a) => a.codigo.toLowerCase() === cleanCodigo.toLowerCase());
      if (exists) {
        setErrorMsg(`Ya existe una cuenta con el código ${cleanCodigo}. Modifíquelo para continuar.`);
        return;
      }
    }

    const grpDef = groups.find((g) => g.codigo === grupo);
    const subDef = groups.find((g) => g.codigo === subgrupo);

    const resolvedFiscal = customFiscal.trim() ? customFiscal.trim() : agrupacionFiscal;
    const resolvedHq = customHq.trim() ? customHq.trim() : agrupacionMatrizExtranjera;

    const accountResult: HierarchicalAccountItem = {
      codigo: cleanCodigo,
      nombre: cleanNombre,
      clase,
      grupo,
      nombreGrupo: grpDef?.nombre || `Grupo ${grupo}`,
      subgrupo,
      nombreSubgrupo: subDef?.nombre || `Subgrupo ${subgrupo}`,
      nivel: 5,
      tipo,
      clasificacion,
      naturaleza,
      requiereAuxiliarRut,
      requiereCentroCosto,
      esConciliableBancaria,
      activa,
      agrupacionFiscal: resolvedFiscal,
      agrupacionMatrizExtranjera: resolvedHq,
      agrupacionPersonalizada: agrupacionPersonalizada.trim() || undefined,
    };

    onSave(accountResult);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl my-8 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-amber-600" />
              {isEditing ? `Editar Cuenta Contable: ${accountToEdit?.codigo}` : 'Nueva Cuenta Contable Personalizada'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Defina o modifique los atributos contables, grupo/subgrupo y el mapeo para balances fiscales y casa matriz.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
            {errorMsg}
          </div>
        )}

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 text-xs">
          {/* Fila 1: Clase, Grupo y Subgrupo Jerárquico */}
          <div className="bg-slate-50/80 p-3.5 rounded-lg border border-slate-200 space-y-3">
            <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] block">
              1. Jerarquía Contable (CMF / Plan Chileno)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Clase Principal</label>
                <select
                  value={clase}
                  onChange={(e) => handleClaseChange(Number(e.target.value) as any)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 font-medium focus:ring-1 focus:ring-blue-500"
                >
                  <option value={1}>1. ACTIVO</option>
                  <option value={2}>2. PASIVO</option>
                  <option value={3}>3. PATRIMONIO NETO</option>
                  <option value={4}>4. INGRESOS</option>
                  <option value={5}>5. COSTOS</option>
                  <option value={6}>6. GASTOS ADM. Y VENTAS</option>
                  <option value={7}>7. OTROS INGRESOS / GASTOS</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Grupo (Nivel 2)</label>
                <select
                  value={grupo}
                  onChange={(e) => handleGrupoChange(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 font-medium focus:ring-1 focus:ring-blue-500"
                >
                  {availableGroups.length > 0 ? (
                    availableGroups.map((g) => (
                      <option key={g.codigo} value={g.codigo}>
                        {g.codigo} - {g.nombre}
                      </option>
                    ))
                  ) : (
                    <option value={grupo}>Grupo {grupo}</option>
                  )}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Subgrupo (Nivel 3)</label>
                <select
                  value={subgrupo}
                  onChange={(e) => handleSubgrupoChange(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 font-medium focus:ring-1 focus:ring-blue-500"
                >
                  {availableSubgroups.length > 0 ? (
                    availableSubgroups.map((s) => (
                      <option key={s.codigo} value={s.codigo}>
                        {s.codigo} - {s.nombre}
                      </option>
                    ))
                  ) : (
                    <option value={subgrupo}>Subgrupo {subgrupo}</option>
                  )}
                </select>
              </div>
            </div>
          </div>

          {/* Fila 2: Código y Nombre de la Cuenta */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Código de Cuenta</label>
              <input
                type="text"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="Ej: 1.1.01.003"
                className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono font-bold text-slate-900 focus:ring-1 focus:ring-blue-500"
                required
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">Formato sugerido: X.X.XX.XXX</span>
            </div>

            <div className="sm:col-span-2">
              <label className="font-semibold text-slate-700 block mb-1">Nombre Oficial de la Cuenta</label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: Banco BCI Cuenta Corriente en Dólares USD"
                className="w-full bg-white border border-slate-300 rounded-lg p-2 font-medium text-slate-900 focus:ring-1 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          {/* Fila 3: Atributos Contables Técnicos */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Naturaleza</label>
              <select
                value={naturaleza}
                onChange={(e) => setNaturaleza(e.target.value as AccountNature)}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 font-medium focus:ring-1 focus:ring-blue-500"
              >
                <option value="DEUDORA">DEUDORA (Aumenta al Debe)</option>
                <option value="ACREEDORA">ACREEDORA (Aumenta al Haber)</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Tipo Contable</label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as any)}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 font-medium focus:ring-1 focus:ring-blue-500"
              >
                <option value="ACTIVO">ACTIVO</option>
                <option value="PASIVO">PASIVO</option>
                <option value="PATRIMONIO">PATRIMONIO</option>
                <option value="INGRESO">INGRESO</option>
                <option value="COSTO">COSTO</option>
                <option value="GASTO">GASTO</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Clasificación IFRS</label>
              <select
                value={clasificacion}
                onChange={(e) => setClasificacion(e.target.value as any)}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 font-medium focus:ring-1 focus:ring-blue-500"
              >
                <option value="CIRCULANTE">CIRCULANTE / CORTO PLAZO</option>
                <option value="NO_CIRCULANTE">NO CIRCULANTE / FIJO</option>
                <option value="OPERACIONAL">OPERACIONAL</option>
                <option value="NO_OPERACIONAL">NO OPERACIONAL</option>
              </select>
            </div>
          </div>

          {/* Fila 4: Mapeos para Presentación Especial (Fiscal, Casa Matriz, Personalizada) */}
          <div className="bg-amber-50/50 p-3.5 rounded-lg border border-amber-200/80 space-y-3">
            <div className="flex items-center gap-1.5 text-amber-900 font-bold uppercase tracking-wider text-[11px]">
              <Tag className="w-4 h-4 text-amber-700" />
              <span>2. Mapeos de Agrupación para Balances Especiales</span>
            </div>
            <p className="text-[11px] text-amber-800">
              Permite al Agente y al Contador Jefe generar balances consolidados automáticos para el SII (F22), casa matriz en el extranjero o informes a la medida.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700 flex items-center gap-1 mb-1">
                  <Shield className="w-3.5 h-3.5 text-blue-600" />
                  Agrupación Fiscal SII (F22 / RLI)
                </label>
                <select
                  value={agrupacionFiscal}
                  onChange={(e) => setAgrupacionFiscal(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:ring-1 focus:ring-blue-500"
                >
                  {FISCAL_GROUPING_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                  <option value="__OTRO__">Otra Agrupación Tributaria...</option>
                </select>
                {agrupacionFiscal === '__OTRO__' && (
                  <input
                    type="text"
                    placeholder="Escriba agrupación fiscal personalizada..."
                    value={customFiscal}
                    onChange={(e) => setCustomFiscal(e.target.value)}
                    className="w-full mt-1.5 bg-white border border-slate-300 rounded p-1.5 text-xs"
                  />
                )}
              </div>

              <div>
                <label className="font-semibold text-slate-700 flex items-center gap-1 mb-1">
                  <Globe className="w-3.5 h-3.5 text-emerald-600" />
                  Casa Matriz Extranjera (HQ US GAAP / IFRS)
                </label>
                <select
                  value={agrupacionMatrizExtranjera}
                  onChange={(e) => setAgrupacionMatrizExtranjera(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:ring-1 focus:ring-blue-500"
                >
                  {HEADQUARTERS_GROUPING_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                  <option value="__OTRO__">Otro Rubro de Matriz Internacional...</option>
                </select>
                {agrupacionMatrizExtranjera === '__OTRO__' && (
                  <input
                    type="text"
                    placeholder="Escriba categoría HQ..."
                    value={customHq}
                    onChange={(e) => setCustomHq(e.target.value)}
                    className="w-full mt-1.5 bg-white border border-slate-300 rounded p-1.5 text-xs"
                  />
                )}
              </div>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Agrupación Libre / Personalizada del Contador (Opcional)
              </label>
              <input
                type="text"
                placeholder="Ej: Centro de Negocios Puerto Montt, Costo Operativo Flota, etc."
                value={agrupacionPersonalizada}
                onChange={(e) => setAgrupacionPersonalizada(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Fila 5: Atributos y Validaciones */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-100">
            <label className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 cursor-pointer border border-transparent hover:border-slate-200">
              <input
                type="checkbox"
                checked={requiereAuxiliarRut}
                onChange={(e) => setRequiereAuxiliarRut(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="text-slate-700 font-medium">Exigir RUT Auxiliar (Clientes / Proveedores)</span>
            </label>

            <label className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 cursor-pointer border border-transparent hover:border-slate-200">
              <input
                type="checkbox"
                checked={requiereCentroCosto}
                onChange={(e) => setRequiereCentroCosto(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="text-slate-700 font-medium">Exigir Centro de Costo (Obras / Áreas)</span>
            </label>

            <label className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 cursor-pointer border border-transparent hover:border-slate-200">
              <input
                type="checkbox"
                checked={esConciliableBancaria}
                onChange={(e) => setEsConciliableBancaria(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="text-slate-700 font-medium">Conciliable con Cartola Bancaria</span>
            </label>

            <label className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 cursor-pointer border border-transparent hover:border-slate-200">
              <input
                type="checkbox"
                checked={activa}
                onChange={(e) => setActiva(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="text-slate-700 font-medium">Cuenta Activa para Imputación</span>
            </label>
          </div>

          {/* Footer Actions */}
          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-[#0f172a] hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Check className="w-4 h-4 text-emerald-400" />
              <span>{isEditing ? 'Guardar Cambios' : 'Crear Cuenta Contable'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
