import React, { useState, useEffect } from 'react';
import { Sliders, X, Check, Globe, Shield, Tag, BookOpen } from 'lucide-react';
import {
  HierarchicalAccountItem,
  AccountGroupDefinition,
  AccountNature,
} from '../../types';
import {
  FISCAL_GROUPING_OPTIONS,
  HEADQUARTERS_GROUPING_OPTIONS,
} from '../../utils/companyChartOfAccountsService';
import { inferDefaultNoteNumbers } from '../../utils/financialNotesService';
import { getAvailableCurrencies } from '../../services/currencyService';

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

  // Atributos y Validaciones Contables Avanzadas
  const [requiereAuxiliarRut, setRequiereAuxiliarRut] = useState(false);
  const [requiereCentroCosto, setRequiereCentroCosto] = useState(false);
  const [esConciliableBancaria, setEsConciliableBancaria] = useState(false);
  const [activa, setActiva] = useState(true);

  // 5 Conceptos Contables Avanzados ERP
  const [manejaMultimoneda, setManejaMultimoneda] = useState(false);
  const [monedaCodigo, setMonedaCodigo] = useState<string>('USD');
  const [requiereDocReferencia, setRequiereDocReferencia] = useState(false);
  const [esEfectivoEquivalente, setEsEfectivoEquivalente] = useState(false);
  const [esContracuentaEfectivo, setEsContracuentaEfectivo] = useState(false);
  const [requiereProyecto, setRequiereProyecto] = useState(false);

  // Notas a los Estados Financieros (NIIF / CMF)
  const [notasExplicativasStr, setNotasExplicativasStr] = useState<string>('');

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

      setRequiereAuxiliarRut(Boolean(accountToEdit.requiereAuxiliarRut));
      setRequiereCentroCosto(Boolean(accountToEdit.requiereCentroCosto));
      setEsConciliableBancaria(Boolean(accountToEdit.esConciliableBancaria));
      setActiva(accountToEdit.activa !== false);

      // 5 Conceptos
      setManejaMultimoneda(Boolean(accountToEdit.manejaMultimoneda));
      const defaultCur = accountToEdit.nombre.toLowerCase().includes('eur') ? 'EUR' : accountToEdit.nombre.toLowerCase().includes('uf') ? 'UF' : 'USD';
      setMonedaCodigo(accountToEdit.monedaCodigo || defaultCur);
      setRequiereDocReferencia(Boolean(accountToEdit.requiereDocReferencia));
      setEsEfectivoEquivalente(Boolean(accountToEdit.esEfectivoEquivalente));
      setEsContracuentaEfectivo(Boolean(accountToEdit.esContracuentaEfectivo));
      setRequiereProyecto(Boolean(accountToEdit.requiereProyecto));

      // Notas EEFF
      if (accountToEdit.notasExplicativas && accountToEdit.notasExplicativas.length > 0) {
        setNotasExplicativasStr(accountToEdit.notasExplicativas.join(', '));
      } else {
        const inferred = inferDefaultNoteNumbers(accountToEdit);
        setNotasExplicativasStr(inferred.length > 0 ? inferred.join(', ') : '');
      }
    } else {
      // Modo nueva cuenta o subcuenta
      setNotasExplicativasStr('');
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

      // 5 Conceptos iniciales
      setManejaMultimoneda(false);
      setMonedaCodigo('USD');
      setRequiereDocReferencia(false);
      setEsEfectivoEquivalente(false);
      setEsContracuentaEfectivo(false);
      setRequiereProyecto(false);
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

    const parsedNotes: number[] = notasExplicativasStr
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n): n is number => !isNaN(n) && n > 0);
    const uniqueNotes: number[] = Array.from(new Set<number>(parsedNotes)).sort((a: number, b: number) => a - b);

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
      // 5 Conceptos Contables Avanzados
      manejaMultimoneda,
      monedaCodigo: manejaMultimoneda ? (monedaCodigo || 'USD') : undefined,
      requiereDocReferencia,
      esEfectivoEquivalente,
      esContracuentaEfectivo,
      requiereProyecto,
      // Notas EEFF
      notasExplicativas: uniqueNotes.length > 0 ? uniqueNotes : undefined,
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

          {/* Fila 5: Atributos y Validaciones Contables Avanzadas (5 Conceptos ERP) */}
          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-slate-900 font-bold uppercase tracking-wider text-[11px]">
                <Sliders className="w-4 h-4 text-blue-600" />
                <span>3. Atributos y Reglas de Imputación ERP</span>
              </div>
              <span className="text-[10px] text-slate-500 font-medium">Validaciones automáticas del Agente Contable</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              {/* 1. MANEJA MULTIMONEDA */}
              <div className="flex flex-col gap-2 p-2.5 rounded-lg bg-white border border-slate-200 transition-colors">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={manejaMultimoneda}
                    onChange={(e) => setManejaMultimoneda(e.target.checked)}
                    className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-800 font-semibold">Maneja Multimoneda</span>
                      <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-mono font-bold">NIC 21</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                      Habilita registros en divisa extranjera y revalorización por diferencia de cambio (NIC 21).
                    </p>
                  </div>
                </label>

                {manejaMultimoneda && (
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-slate-700">Moneda asignada:</span>
                    <select
                      value={monedaCodigo}
                      onChange={(e) => setMonedaCodigo(e.target.value)}
                      className="text-xs bg-blue-50/80 border border-blue-300 text-blue-900 rounded-md px-2 py-1 font-bold focus:ring-1 focus:ring-blue-500 cursor-pointer"
                    >
                      {getAvailableCurrencies()
                        .filter((c) => !c.esMonedaBase && c.activo)
                        .map((curr) => (
                          <option key={curr.codigo} value={curr.codigo}>
                            {curr.codigo} - {curr.nombre} ({curr.simbolo})
                          </option>
                        ))}
                    </select>
                  </div>
                )}
              </div>

              {/* 2. DOCUMENTO REFERENCIA */}
              <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-white hover:bg-blue-50/40 cursor-pointer border border-slate-200 transition-colors">
                <input
                  type="checkbox"
                  checked={requiereDocReferencia}
                  onChange={(e) => setRequiereDocReferencia(e.target.checked)}
                  className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-800 font-semibold">Documento Referencia</span>
                    <span className="text-[10px] bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded font-mono font-bold">DOC</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                    Exige Tipo y N° de DTE o respaldo mercantil obligatorio (Facturas, Boletas, NC, ND, Guías).
                  </p>
                </div>
              </label>

              {/* 3. EFECTIVO Y EFECTIVO EQUIVALENTE */}
              <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-white hover:bg-emerald-50/40 cursor-pointer border border-slate-200 transition-colors">
                <input
                  type="checkbox"
                  checked={esEfectivoEquivalente}
                  onChange={(e) => {
                    setEsEfectivoEquivalente(e.target.checked);
                    if (e.target.checked) setEsContracuentaEfectivo(false);
                  }}
                  className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-800 font-semibold">Efectivo y Equivalente</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-mono font-bold">NIC 7 / FECU</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                    Clasifica la cuenta para el Estado de Flujos de Efectivo (Caja, Bancos, Inversiones líquidas &lt; 90d).
                  </p>
                </div>
              </label>

              {/* 4. CONTRACUENTA EFECTIVO Y EFECTIVO EQUIVALENTE */}
              <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-white hover:bg-amber-50/40 cursor-pointer border border-slate-200 transition-colors">
                <input
                  type="checkbox"
                  checked={esContracuentaEfectivo}
                  onChange={(e) => {
                    setEsContracuentaEfectivo(e.target.checked);
                    if (e.target.checked) setEsEfectivoEquivalente(false);
                  }}
                  className="mt-0.5 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-800 font-semibold">Contracuenta Efectivo</span>
                    <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-mono font-bold">PUENTE</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                    Cuenta puente de tesorería y clearing (valores en tránsito, fondos a rendir, pasarelas de pago).
                  </p>
                </div>
              </label>

              {/* 5. PROYECTO */}
              <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-white hover:bg-purple-50/40 cursor-pointer border border-slate-200 transition-colors">
                <input
                  type="checkbox"
                  checked={requiereProyecto}
                  onChange={(e) => setRequiereProyecto(e.target.checked)}
                  className="mt-0.5 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-800 font-semibold">Proyecto / Obra</span>
                    <span className="text-[10px] bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded font-mono font-bold">PROY</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                    Exige imputar el Centro de Proyecto, Contrato de Obra u Orden de Trabajo para costeo directo.
                  </p>
                </div>
              </label>

              {/* EXIGIR AUXILIAR RUT */}
              <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-white hover:bg-slate-100 cursor-pointer border border-slate-200 transition-colors">
                <input
                  type="checkbox"
                  checked={requiereAuxiliarRut}
                  onChange={(e) => setRequiereAuxiliarRut(e.target.checked)}
                  className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-800 font-semibold">Exigir RUT Auxiliar</span>
                    <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono font-bold">RUT</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                    Obligatorio para cuentas corrientes de clientes, proveedores y retenciones impositivas.
                  </p>
                </div>
              </label>

              {/* EXIGIR CENTRO DE COSTO */}
              <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-white hover:bg-slate-100 cursor-pointer border border-slate-200 transition-colors">
                <input
                  type="checkbox"
                  checked={requiereCentroCosto}
                  onChange={(e) => setRequiereCentroCosto(e.target.checked)}
                  className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-800 font-semibold">Exigir Centro de Costo</span>
                    <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-mono font-bold">CC</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                    Obligatorio para distribución analítica en áreas de administración, ventas u operaciones.
                  </p>
                </div>
              </label>

              {/* CONCILIABLE BANCARIA */}
              <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-white hover:bg-slate-100 cursor-pointer border border-slate-200 transition-colors">
                <input
                  type="checkbox"
                  checked={esConciliableBancaria}
                  onChange={(e) => setEsConciliableBancaria(e.target.checked)}
                  className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-800 font-semibold">Conciliable Bancaria</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-mono font-bold">BCO</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                    Habilita la cuenta en el bot supervisor de cuadratura de cartolas bancarias.
                  </p>
                </div>
              </label>

              {/* CUENTA ACTIVA */}
              <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-white hover:bg-slate-100 cursor-pointer border border-slate-200 transition-colors sm:col-span-2">
                <input
                  type="checkbox"
                  checked={activa}
                  onChange={(e) => setActiva(e.target.checked)}
                  className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <div className="flex-1">
                  <span className="text-slate-800 font-semibold">Cuenta Activa para Imputación</span>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                    Si se desmarca, la cuenta quedará bloqueada para nuevos asientos y comprobantes manuales o automáticos.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Fila 6: Notas a los Estados Financieros (NIIF / IFRS - CMF Chile) */}
          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-slate-900 font-bold uppercase tracking-wider text-[11px]">
                <BookOpen className="w-4 h-4 text-indigo-600" />
                <span>4. Notas a los Estados Financieros (NIIF / CMF)</span>
              </div>
              <span className="text-[10px] text-slate-500 font-medium">Vinculación NIC 1 / Circular 1.501 CMF</span>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1 text-xs">
                Números de Notas Asignadas (separados por coma si son varios, ej: 3, 17)
              </label>
              <input
                type="text"
                placeholder="Ej: 3 o 3, 17"
                value={notasExplicativasStr}
                onChange={(e) => setNotasExplicativasStr(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-mono font-bold text-blue-900 focus:ring-1 focus:ring-blue-500"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                La cuenta se mostrará enlazada a estas notas explicativas en el Balance Clasificado, Estado de Situación Financiera, Estado de Resultados y Cuadernillo de Auditoría.
              </p>
            </div>

            {/* Accesos Rápidos a Notas Estándar */}
            <div className="pt-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                Sugerencias Rápidas por Rubro (Click para agregar/quitar):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { num: 3, label: 'Nota 3: Efectivo' },
                  { num: 4, label: 'Nota 4: Clientes' },
                  { num: 5, label: 'Nota 5: Inventarios' },
                  { num: 6, label: 'Nota 6: Impuestos CF' },
                  { num: 7, label: 'Nota 7: Activo Fijo' },
                  { num: 8, label: 'Nota 8: IFRS 16' },
                  { num: 9, label: 'Nota 9: Proveedores' },
                  { num: 10, label: 'Nota 10: Sueldos' },
                  { num: 11, label: 'Nota 11: Retenciones F29' },
                  { num: 12, label: 'Nota 12: Bancos CP/LP' },
                  { num: 13, label: 'Nota 13: Patrimonio' },
                  { num: 14, label: 'Nota 14: Ingresos' },
                  { num: 15, label: 'Nota 15: Costos' },
                  { num: 16, label: 'Nota 16: Gastos Admin' },
                  { num: 17, label: 'Nota 17: Financieros/USD' },
                ].map((sug) => {
                  const currentList = notasExplicativasStr
                    .split(',')
                    .map((s) => parseInt(s.trim(), 10))
                    .filter((n) => !isNaN(n));
                  const isIncluded = currentList.includes(sug.num);

                  return (
                    <button
                      key={sug.num}
                      type="button"
                      onClick={() => {
                        let nextList: number[];
                        if (isIncluded) {
                          nextList = currentList.filter((n) => n !== sug.num);
                        } else {
                          nextList = [...currentList, sug.num].sort((a, b) => a - b);
                        }
                        setNotasExplicativasStr(nextList.join(', '));
                      }}
                      className={`text-[10px] px-2 py-0.5 rounded font-mono font-medium transition-colors cursor-pointer border ${
                        isIncluded
                          ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {sug.label}
                    </button>
                  );
                })}
              </div>
            </div>
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
