import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Users,
  Search,
  Plus,
  Edit2,
  Check,
  X,
  Building,
  Mail,
  Phone,
  MapPin,
  CreditCard,
  Tag,
  ShieldCheck,
  RotateCcw,
  Save,
  CheckCircle2,
  AlertCircle,
  Filter,
} from 'lucide-react';
import { CHILEAN_REGIONS_WITH_COMMUNES } from '../../data/erpMasterConfig';
import { validateRutChileno, formatRutChileno } from '../../utils/chileanAccounting';
import { saveClientState, loadClientState } from '../../utils/storageService';
import {
  loadCompanyAuxiliaries,
  fetchCompanyAuxiliaries,
  saveCompanyAuxiliaries,
} from '../../utils/companyAuxiliariesService';
import type { AuxiliaryOption } from './SearchableAuxiliarySelect';

export interface AuxiliaryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyRut?: string;
  companyName?: string;
  availableAuxiliaries: AuxiliaryOption[];
  onSaveAuxiliary: (aux: AuxiliaryOption, allUpdatedList?: any[]) => void;
  onSelectAuxiliary?: (rut: string, razonSocial: string) => void;
  initialRoleFilter?: 'ALL' | 'CLIENTE' | 'PROVEEDOR';
}

export interface FullAuxiliaryRecord extends AuxiliaryOption {
  id?: string;
  nombreFantasia?: string;
  giroComercial?: string;
  inactivo?: boolean;
  telefonoPrincipal?: string;
  emailContacto?: string;
  nombreContacto?: string;
  emailDte?: string;
  direccion?: string;
  region?: string;
  ciudad?: string;
  comuna?: string;
  limiteCredito?: number;
  terminosPago?: string;
  descuentoPorcentaje?: number;
}

export const AuxiliaryManagerModal: React.FC<AuxiliaryManagerModalProps> = ({
  isOpen,
  onClose,
  companyRut = 'default',
  companyName = 'Empresa Activa',
  availableAuxiliaries = [],
  onSaveAuxiliary,
  onSelectAuxiliary,
  initialRoleFilter = 'ALL',
}) => {
  // Cargar y normalizar lista de auxiliares combinando padrón base y personalizados
  const buildAuxList = useCallback((sourceList: any[]) => {
    const mergedMap = new Map<string, FullAuxiliaryRecord>();

    // Inicializar con availableAuxiliaries
    availableAuxiliaries.forEach((a) => {
      const clean = (a.rut || '').trim().toUpperCase();
      if (clean) {
        mergedMap.set(clean, {
          rut: a.rut,
          razonSocial: a.razonSocial,
          tipo: a.tipo || 'AMBOS',
        });
      }
    });

    // Enriquecer con los auxiliares almacenados / remotos
    sourceList.forEach((s) => {
      const clean = (s.rut || s.rutCompleto || '').trim().toUpperCase();
      if (clean) {
        mergedMap.set(clean, {
          ...mergedMap.get(clean),
          ...s,
          rut: s.rut || s.rutCompleto || clean,
          razonSocial: s.razonSocial || s.nombreFantasia || mergedMap.get(clean)?.razonSocial || clean,
          tipo: s.tipo || s.tipoAuxiliar || mergedMap.get(clean)?.tipo || 'AMBOS',
        });
      }
    });

    return Array.from(mergedMap.values());
  }, [availableAuxiliaries]);

  const [auxiliariesList, setAuxiliariesList] = useState<FullAuxiliaryRecord[]>(() => {
    const stored = loadCompanyAuxiliaries(companyRut);
    return buildAuxList(stored);
  });

  // Al abrir el modal o cambiar de empresa, sincronizar desde servidor (Multi-Usuario)
  useEffect(() => {
    if (isOpen && companyRut) {
      let isMounted = true;
      const stored = loadCompanyAuxiliaries(companyRut);
      setAuxiliariesList(buildAuxList(stored));
      setIsEditing(false);
      setFormError(null);

      fetchCompanyAuxiliaries(companyRut).then((remoteAuxs) => {
        if (isMounted && Array.isArray(remoteAuxs) && remoteAuxs.length > 0) {
          setAuxiliariesList(buildAuxList(remoteAuxs));
        }
      }).catch(() => {});

      const handleAuxUpdated = (e: any) => {
        if (e?.detail?.empresaRut === companyRut && Array.isArray(e?.detail?.auxiliaries)) {
          setAuxiliariesList(buildAuxList(e.detail.auxiliaries));
        }
      };

      window.addEventListener('companyAuxiliariesUpdated', handleAuxUpdated);
      return () => {
        isMounted = false;
        window.removeEventListener('companyAuxiliariesUpdated', handleAuxUpdated);
      };
    }
  }, [isOpen, companyRut, buildAuxList]);

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'CLIENTE' | 'PROVEEDOR' | 'AMBOS' | 'HONORARIO' | 'EMPLEADO'>(
    initialRoleFilter === 'CLIENTE' ? 'CLIENTE' : initialRoleFilter === 'PROVEEDOR' ? 'PROVEEDOR' : 'ALL'
  );
  const [isEditing, setIsEditing] = useState(false);
  const [activeFormTab, setActiveFormTab] = useState<'IDENTIFICACION' | 'CONTACTO' | 'UBICACION' | 'COMERCIAL'>('IDENTIFICACION');
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Form Fields
  const [editingId, setEditingId] = useState<string | null>(null);
  const [rut, setRut] = useState('');
  const [razonSocial, setRazonSocial] = useState('');
  const [nombreFantasia, setNombreFantasia] = useState('');
  const [giroComercial, setGiroComercial] = useState('');
  const [tipo, setTipo] = useState<'CLIENTE' | 'PROVEEDOR' | 'AMBOS' | 'HONORARIO' | 'EMPLEADO'>('PROVEEDOR');
  const [inactivo, setInactivo] = useState(false);

  const [telefonoPrincipal, setTelefonoPrincipal] = useState('');
  const [emailContacto, setEmailContacto] = useState('');
  const [nombreContacto, setNombreContacto] = useState('');
  const [emailDte, setEmailDte] = useState('');

  const [direccion, setDireccion] = useState('');
  const [region, setRegion] = useState('Región Metropolitana de Santiago');
  const [ciudad, setCiudad] = useState('Santiago');
  const [comuna, setComuna] = useState('Santiago');

  const [terminosPago, setTerminosPago] = useState('30 Días Fecha Factura');
  const [limiteCredito, setLimiteCredito] = useState<number>(0);
  const [descuentoPorcentaje, setDescuentoPorcentaje] = useState<number>(0);

  // Lista de comunas según región seleccionada
  const availableComunas = useMemo(() => {
    const regObj = CHILEAN_REGIONS_WITH_COMMUNES.find((r) => r.region === region);
    return regObj ? regObj.comunas : ['Santiago', 'Providencia', 'Las Condes'];
  }, [region]);

  // Auxiliares filtrados
  const filteredAuxiliaries = useMemo(() => {
    return auxiliariesList.filter((aux) => {
      // Filtro por Rol
      if (roleFilter !== 'ALL') {
        const auxTipo = aux.tipo || 'AMBOS';
        if (roleFilter === 'PROVEEDOR' && auxTipo !== 'PROVEEDOR' && auxTipo !== 'AMBOS') return false;
        if (roleFilter === 'CLIENTE' && auxTipo !== 'CLIENTE' && auxTipo !== 'AMBOS') return false;
        if (roleFilter === 'AMBOS' && auxTipo !== 'AMBOS') return false;
        if (roleFilter === 'HONORARIO' && auxTipo !== 'HONORARIO') return false;
        if (roleFilter === 'EMPLEADO' && auxTipo !== 'EMPLEADO') return false;
      }

      // Filtro por Búsqueda
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const cleanQ = q.replace(/[\.\-\s]/g, '');
      const rutClean = (aux.rut || '').replace(/[\.\-\s]/g, '').toLowerCase();
      const name = (aux.razonSocial || '').toLowerCase();
      const fant = (aux.nombreFantasia || '').toLowerCase();
      const giro = (aux.giroComercial || '').toLowerCase();

      return rutClean.includes(cleanQ) || name.includes(q) || fant.includes(q) || giro.includes(q);
    });
  }, [auxiliariesList, roleFilter, searchQuery]);

  // Estadísticas
  const stats = useMemo(() => {
    let proveedores = 0;
    let clientes = 0;
    let ambos = 0;
    let otros = 0;

    auxiliariesList.forEach((a) => {
      const t = a.tipo || 'AMBOS';
      if (t === 'PROVEEDOR') proveedores++;
      else if (t === 'CLIENTE') clientes++;
      else if (t === 'AMBOS') ambos++;
      else otros++;
    });

    return { total: auxiliariesList.length, proveedores, clientes, ambos, otros };
  }, [auxiliariesList]);

  if (!isOpen) return null;

  // Iniciar creación de nuevo auxiliar
  const handleStartCreate = (defaultRole?: 'CLIENTE' | 'PROVEEDOR') => {
    setEditingId(null);
    setRut('');
    setRazonSocial('');
    setNombreFantasia('');
    setGiroComercial('');
    setTipo(defaultRole || (roleFilter === 'CLIENTE' ? 'CLIENTE' : 'PROVEEDOR'));
    setInactivo(false);
    setTelefonoPrincipal('');
    setEmailContacto('');
    setNombreContacto('');
    setEmailDte('');
    setDireccion('');
    setRegion('Región Metropolitana de Santiago');
    setCiudad('Santiago');
    setComuna('Santiago');
    setTerminosPago('30 Días Fecha Factura');
    setLimiteCredito(0);
    setDescuentoPorcentaje(0);
    setActiveFormTab('IDENTIFICACION');
    setFormError(null);
    setIsEditing(true);
  };

  // Iniciar edición de auxiliar existente
  const handleStartEdit = (record: FullAuxiliaryRecord) => {
    setEditingId(record.id || record.rut);
    setRut(record.rut);
    setRazonSocial(record.razonSocial);
    setNombreFantasia(record.nombreFantasia || '');
    setGiroComercial(record.giroComercial || '');
    setTipo((record.tipo as any) || 'PROVEEDOR');
    setInactivo(Boolean(record.inactivo));
    setTelefonoPrincipal(record.telefonoPrincipal || '');
    setEmailContacto(record.emailContacto || '');
    setNombreContacto(record.nombreContacto || '');
    setEmailDte(record.emailDte || '');
    setDireccion(record.direccion || '');
    setRegion(record.region || 'Región Metropolitana de Santiago');
    setCiudad(record.ciudad || 'Santiago');
    setComuna(record.comuna || 'Santiago');
    setTerminosPago(record.terminosPago || '30 Días Fecha Factura');
    setLimiteCredito(record.limiteCredito || 0);
    setDescuentoPorcentaje(record.descuentoPorcentaje || 0);
    setActiveFormTab('IDENTIFICACION');
    setFormError(null);
    setIsEditing(true);
  };

  // Alternar estado activo / inactivo
  const handleToggleActive = (record: FullAuxiliaryRecord) => {
    const updated = auxiliariesList.map((a) => {
      if (a.rut === record.rut) {
        return { ...a, inactivo: !a.inactivo };
      }
      return a;
    });
    setAuxiliariesList(updated);
    saveCompanyAuxiliaries(companyRut, updated);
    setSuccessNotice(`Auxiliar "${record.razonSocial}" ${record.inactivo ? 'reactivado' : 'marcado como inactivo'}.`);
    setTimeout(() => setSuccessNotice(null), 3000);
  };

  // Guardar auxiliar (Creación o Modificación)
  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanRut = rut.replace(/[\.\-\s]/g, '').toUpperCase();
    if (!cleanRut) {
      setFormError('Debe ingresar el RUT del auxiliar.');
      return;
    }

    if (!validateRutChileno(cleanRut)) {
      setFormError(`El RUT "${rut}" no es válido según el algoritmo del SII (Módulo 11).`);
      return;
    }

    if (!razonSocial.trim()) {
      setFormError('Debe ingresar la Razón Social o Nombre Legal.');
      return;
    }

    const formattedRut = formatRutChileno(cleanRut);

    const newRecord: FullAuxiliaryRecord = {
      id: editingId || `aux-${Date.now()}`,
      rut: formattedRut,
      razonSocial: razonSocial.trim(),
      nombreFantasia: nombreFantasia.trim() || undefined,
      giroComercial: giroComercial.trim() || undefined,
      tipo,
      inactivo,
      telefonoPrincipal: telefonoPrincipal.trim() || undefined,
      emailContacto: emailContacto.trim() || undefined,
      nombreContacto: nombreContacto.trim() || undefined,
      emailDte: emailDte.trim() || undefined,
      direccion: direccion.trim() || undefined,
      region,
      ciudad,
      comuna,
      terminosPago,
      limiteCredito: Number(limiteCredito) || 0,
      descuentoPorcentaje: Number(descuentoPorcentaje) || 0,
    };

    let nextList: FullAuxiliaryRecord[];
    const normKey = (r: string) => r.replace(/[\.\-\s]/g, '').toUpperCase();
    const existsIndex = auxiliariesList.findIndex((a) => normKey(a.rut) === cleanRut);

    if (existsIndex >= 0) {
      nextList = [...auxiliariesList];
      nextList[existsIndex] = { ...nextList[existsIndex], ...newRecord };
    } else {
      nextList = [newRecord, ...auxiliariesList];
    }

    setAuxiliariesList(nextList);
    saveCompanyAuxiliaries(companyRut, nextList);
    onSaveAuxiliary(newRecord, nextList);

    setSuccessNotice(`Auxiliar "${newRecord.razonSocial}" (${formattedRut}) guardado exitosamente.`);
    setIsEditing(false);
    setTimeout(() => setSuccessNotice(null), 3500);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Encabezado Superior */}
        <div className="bg-[#0b192c] text-white px-5 py-4 flex items-center justify-between border-b-2 border-amber-500 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-400 flex items-center justify-center shadow-xs">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-extrabold tracking-wide uppercase">
                  Padrón Maestro de Auxiliares ERP
                </h2>
                <span className="text-[10px] bg-amber-500/30 text-amber-300 font-mono font-bold px-2 py-0.5 rounded-full border border-amber-400/30">
                  {companyRut}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5 font-medium">
                Gestión centralizada de Clientes, Proveedores y Entidades para Mayor Auxiliar ({companyName})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isEditing && (
              <button
                type="button"
                onClick={() => handleStartCreate()}
                className="bg-amber-600 hover:bg-amber-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Registrar Auxiliar</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              title="Cerrar modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notificación de Éxito */}
        {successNotice && (
          <div className="bg-emerald-50 border-b border-emerald-200 text-emerald-800 px-5 py-2 text-xs flex items-center gap-2 animate-in fade-in shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-bold">{successNotice}</span>
          </div>
        )}

        {/* Contenido Principal */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {isEditing ? (
            /* =========================================================================
               FORMULARIO DE ALTA / EDICIÓN DE AUXILIAR
               ========================================================================= */
            <form onSubmit={handleSaveForm} className="space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                    {editingId ? 'Editar Auxiliar' : 'Registrar Nuevo Auxiliar'}
                  </span>
                  <span className="text-[10px] bg-slate-100 text-slate-600 font-mono px-2 py-0.5 rounded">
                    {rut ? formatRutChileno(rut) : 'Nuevo'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Guardar Auxiliar</span>
                  </button>
                </div>
              </div>

              {formError && (
                <div className="bg-rose-50 border border-rose-200 rounded-lg p-2.5 text-xs text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span className="font-semibold">{formError}</span>
                </div>
              )}

              {/* Pestañas de Secciones del Formulario */}
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs font-semibold text-slate-600">
                <button
                  type="button"
                  onClick={() => setActiveFormTab('IDENTIFICACION')}
                  className={`flex-1 py-1.5 px-2 rounded-md text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    activeFormTab === 'IDENTIFICACION'
                      ? 'bg-white text-slate-900 shadow-2xs font-bold'
                      : 'hover:text-slate-900'
                  }`}
                >
                  <Building className="w-3.5 h-3.5 text-amber-600" />
                  <span>Identificación & Rol</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFormTab('CONTACTO')}
                  className={`flex-1 py-1.5 px-2 rounded-md text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    activeFormTab === 'CONTACTO'
                      ? 'bg-white text-slate-900 shadow-2xs font-bold'
                      : 'hover:text-slate-900'
                  }`}
                >
                  <Mail className="w-3.5 h-3.5 text-blue-600" />
                  <span>Contacto & Facturación</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFormTab('UBICACION')}
                  className={`flex-1 py-1.5 px-2 rounded-md text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    activeFormTab === 'UBICACION'
                      ? 'bg-white text-slate-900 shadow-2xs font-bold'
                      : 'hover:text-slate-900'
                  }`}
                >
                  <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Dirección & Ubicación</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFormTab('COMERCIAL')}
                  className={`flex-1 py-1.5 px-2 rounded-md text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    activeFormTab === 'COMERCIAL'
                      ? 'bg-white text-slate-900 shadow-2xs font-bold'
                      : 'hover:text-slate-900'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Condiciones Comerciales</span>
                </button>
              </div>

              {/* CONTENIDO DE TAB 1: IDENTIFICACIÓN & ROL */}
              {activeFormTab === 'IDENTIFICACION' && (
                <div className="space-y-3 bg-slate-50/70 p-4 rounded-xl border border-slate-200">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        RUT Auxiliar <span className="text-rose-500">*</span>:
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: 76.123.456-7"
                        value={rut}
                        onChange={(e) => setRut(formatRutChileno(e.target.value))}
                        className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 font-mono font-bold focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                        required
                      />
                      <span className="text-[10px] text-slate-500 mt-0.5 block">
                        Validado con algoritmo Módulo 11 oficial del SII.
                      </span>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        Razón Social / Nombre Completo <span className="text-rose-500">*</span>:
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: Comercializadora y Distribuidora Los Andes SpA"
                        value={razonSocial}
                        onChange={(e) => setRazonSocial(e.target.value)}
                        className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 font-semibold focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        Nombre de Fantasía:
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: Supermercado Los Andes"
                        value={nombreFantasia}
                        onChange={(e) => setNombreFantasia(e.target.value)}
                        className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        Giro Comercial / Actividad Económica:
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: Venta al por mayor de insumos y materiales"
                        value={giroComercial}
                        onChange={(e) => setGiroComercial(e.target.value)}
                        className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        Rol / Tipo de Auxiliar <span className="text-rose-500">*</span>:
                      </label>
                      <select
                        value={tipo}
                        onChange={(e) => setTipo(e.target.value as any)}
                        className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 font-bold focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                      >
                        <option value="PROVEEDOR">PROVEEDOR (Cuentas por Pagar / Pasivo Circulante 2.1)</option>
                        <option value="CLIENTE">CLIENTE (Cuentas por Cobrar / Activo Circulante 1.1.03)</option>
                        <option value="AMBOS">AMBOS (Opera como Cliente y como Proveedor)</option>
                        <option value="HONORARIO">HONORARIO (Prestador de Servicios Profesionales)</option>
                        <option value="EMPLEADO">EMPLEADO / RENDICIONES (Personal, Rendiciones de Gastos & Anticipos 1.1.03.002)</option>
                      </select>
                      <span className="text-[10px] text-slate-500 mt-0.5 block">
                        Determina en qué cuentas contables y selectores aparecerá este auxiliar.
                      </span>
                    </div>

                    <div className="flex items-center gap-2 pt-5">
                      <input
                        type="checkbox"
                        id="checkInactivo"
                        checked={inactivo}
                        onChange={(e) => setInactivo(e.target.checked)}
                        className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer"
                      />
                      <label htmlFor="checkInactivo" className="text-xs font-semibold text-slate-700 cursor-pointer">
                        Marcar como Inactivo (Ocultar en selectores habituales de asientos)
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* CONTENIDO DE TAB 2: CONTACTO & FACTURACIÓN */}
              {activeFormTab === 'CONTACTO' && (
                <div className="space-y-3 bg-slate-50/70 p-4 rounded-xl border border-slate-200">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        Email de Facturación / Envío DTE:
                      </label>
                      <input
                        type="email"
                        placeholder="dte@proveedor.cl"
                        value={emailDte}
                        onChange={(e) => setEmailDte(e.target.value)}
                        className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 font-mono focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                      />
                      <span className="text-[10px] text-slate-500 mt-0.5 block">
                        Buzón electrónico oficial ante el SII para intercambio de DTEs.
                      </span>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        Email de Contacto Comercial:
                      </label>
                      <input
                        type="email"
                        placeholder="contacto@empresa.cl"
                        value={emailContacto}
                        onChange={(e) => setEmailContacto(e.target.value)}
                        className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        Nombre de Persona de Contacto:
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: Marcelo Gómez (Jefe de Finanzas)"
                        value={nombreContacto}
                        onChange={(e) => setNombreContacto(e.target.value)}
                        className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        Teléfono Principal:
                      </label>
                      <input
                        type="tel"
                        placeholder="+56 9 8765 4321"
                        value={telefonoPrincipal}
                        onChange={(e) => setTelefonoPrincipal(e.target.value)}
                        className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 font-mono focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* CONTENIDO DE TAB 3: UBICACIÓN & DIRECCIÓN */}
              {activeFormTab === 'UBICACION' && (
                <div className="space-y-3 bg-slate-50/70 p-4 rounded-xl border border-slate-200">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Dirección Casa Matriz / Sucursal:
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Av. Andrés Bello 2457, Of. 802"
                      value={direccion}
                      onChange={(e) => setDireccion(e.target.value)}
                      className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        Región:
                      </label>
                      <select
                        value={region}
                        onChange={(e) => {
                          const newReg = e.target.value;
                          setRegion(newReg);
                          const regObj = CHILEAN_REGIONS_WITH_COMMUNES.find((r) => r.region === newReg);
                          if (regObj && regObj.comunas.length > 0) {
                            setComuna(regObj.comunas[0]);
                          }
                        }}
                        className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 font-semibold focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                      >
                        {CHILEAN_REGIONS_WITH_COMMUNES.map((r) => (
                          <option key={r.region} value={r.region}>
                            {r.region}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        Comuna:
                      </label>
                      <select
                        value={comuna}
                        onChange={(e) => setComuna(e.target.value)}
                        className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 font-semibold focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                      >
                        {availableComunas.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        Ciudad:
                      </label>
                      <input
                        type="text"
                        placeholder="Santiago"
                        value={ciudad}
                        onChange={(e) => setCiudad(e.target.value)}
                        className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* CONTENIDO DE TAB 4: COMERCIAL & CRÉDITO */}
              {activeFormTab === 'COMERCIAL' && (
                <div className="space-y-3 bg-slate-50/70 p-4 rounded-xl border border-slate-200">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        Términos de Pago Habituales:
                      </label>
                      <select
                        value={terminosPago}
                        onChange={(e) => setTerminosPago(e.target.value)}
                        className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 font-semibold focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                      >
                        <option value="Contado / Inmediato">Contado / Inmediato</option>
                        <option value="30 Días Fecha Factura">30 Días Fecha Factura</option>
                        <option value="60 Días Fecha Factura">60 Días Fecha Factura</option>
                        <option value="90 Días Fecha Factura">90 Días Fecha Factura</option>
                        <option value="Anticipado 100%">Anticipado 100%</option>
                        <option value="Contra Entrega">Contra Entrega / Guía</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        Límite de Crédito ($):
                      </label>
                      <input
                        type="number"
                        placeholder="Ej: 5000000"
                        value={limiteCredito || ''}
                        onChange={(e) => setLimiteCredito(Number(e.target.value) || 0)}
                        className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 font-mono font-bold focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        Descuento Comercial (%):
                      </label>
                      <input
                        type="number"
                        placeholder="0"
                        min="0"
                        max="100"
                        value={descuentoPorcentaje || ''}
                        onChange={(e) => setDescuentoPorcentaje(Number(e.target.value) || 0)}
                        className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 font-mono font-bold focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                      />
                    </div>
                  </div>
                </div>
              )}
            </form>
          ) : (
            /* =========================================================================
               VISTA PRINCIPAL: LISTA, BÚSQUEDA Y FILTRADO DE AUXILIARES
               ========================================================================= */
            <div className="space-y-4">
              {/* Barra de Estadísticas Rápidas */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                      Total Padrón
                    </span>
                    <span className="text-base font-extrabold text-slate-900 font-mono">{stats.total}</span>
                  </div>
                  <Users className="w-5 h-5 text-slate-400" />
                </div>

                <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 block">
                      Proveedores
                    </span>
                    <span className="text-base font-extrabold text-blue-900 font-mono">{stats.proveedores}</span>
                  </div>
                  <Tag className="w-5 h-5 text-blue-500" />
                </div>

                <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
                      Clientes
                    </span>
                    <span className="text-base font-extrabold text-emerald-900 font-mono">{stats.clientes}</span>
                  </div>
                  <ShieldCheck className="w-5 h-5 text-emerald-500" />
                </div>

                <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">
                      Ambos / Otros
                    </span>
                    <span className="text-base font-extrabold text-amber-900 font-mono">
                      {stats.ambos + stats.otros}
                    </span>
                  </div>
                  <Building className="w-5 h-5 text-amber-500" />
                </div>
              </div>

              {/* Filtros y Buscador */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                {/* Selector de Rol */}
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl text-xs font-semibold text-slate-600 overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => setRoleFilter('ALL')}
                    className={`px-3 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                      roleFilter === 'ALL' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'hover:text-slate-900'
                    }`}
                  >
                    Todos ({stats.total})
                  </button>
                  <button
                    type="button"
                    onClick={() => setRoleFilter('PROVEEDOR')}
                    className={`px-3 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                      roleFilter === 'PROVEEDOR' ? 'bg-blue-600 text-white shadow-2xs font-bold' : 'hover:text-blue-900'
                    }`}
                  >
                    Proveedores ({stats.proveedores})
                  </button>
                  <button
                    type="button"
                    onClick={() => setRoleFilter('CLIENTE')}
                    className={`px-3 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                      roleFilter === 'CLIENTE' ? 'bg-emerald-600 text-white shadow-2xs font-bold' : 'hover:text-emerald-900'
                    }`}
                  >
                    Clientes ({stats.clientes})
                  </button>
                  <button
                    type="button"
                    onClick={() => setRoleFilter('AMBOS')}
                    className={`px-3 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                      roleFilter === 'AMBOS' ? 'bg-amber-600 text-white shadow-2xs font-bold' : 'hover:text-amber-900'
                    }`}
                  >
                    Ambos ({stats.ambos})
                  </button>
                  <button
                    type="button"
                    onClick={() => setRoleFilter('EMPLEADO')}
                    className={`px-3 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                      roleFilter === 'EMPLEADO' ? 'bg-purple-600 text-white shadow-2xs font-bold' : 'hover:text-purple-900'
                    }`}
                  >
                    Rendiciones / Personal
                  </button>
                </div>

                {/* Input de Búsqueda */}
                <div className="relative flex-1 max-w-md">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar por RUT, Razón Social o Giro..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full text-xs pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Tabla de Auxiliares */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <div className="overflow-x-auto max-h-[50vh]">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 sticky top-0 z-10">
                      <tr>
                        <th className="py-2.5 px-3">RUT Chileno</th>
                        <th className="py-2.5 px-3">Razón Social / Nombre</th>
                        <th className="py-2.5 px-3 text-center">Rol ERP</th>
                        <th className="py-2.5 px-3">Giro / Actividad</th>
                        <th className="py-2.5 px-3">Contacto / DTE</th>
                        <th className="py-2.5 px-3 text-center">Estado</th>
                        <th className="py-2.5 px-3 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredAuxiliaries.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-400 italic">
                            No se encontraron auxiliares que coincidan con el filtro aplicado.
                          </td>
                        </tr>
                      ) : (
                        filteredAuxiliaries.map((aux) => {
                          const isProv = aux.tipo === 'PROVEEDOR';
                          const isCli = aux.tipo === 'CLIENTE';
                          const isAmbos = aux.tipo === 'AMBOS' || !aux.tipo;

                          return (
                            <tr
                              key={aux.rut}
                              className={`hover:bg-slate-50/80 transition-colors ${
                                aux.inactivo ? 'opacity-60 bg-slate-50/50' : ''
                              }`}
                            >
                              <td className="py-2.5 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                                {aux.rut}
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="font-bold text-slate-800">{aux.razonSocial}</div>
                                {aux.nombreFantasia && (
                                  <div className="text-[10px] text-slate-500 italic mt-0.5">
                                    {aux.nombreFantasia}
                                  </div>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                <span
                                  className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                    isProv
                                      ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                      : isCli
                                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                      : isAmbos
                                      ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                      : 'bg-purple-100 text-purple-800 border border-purple-200'
                                  }`}
                                >
                                  {aux.tipo || 'AMBOS'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 text-[11px] max-w-xs truncate">
                                {aux.giroComercial || '-'}
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 text-[11px] whitespace-nowrap">
                                <div>{aux.emailDte || aux.emailContacto || '-'}</div>
                                {aux.telefonoPrincipal && (
                                  <div className="text-[10px] text-slate-400 font-mono">
                                    {aux.telefonoPrincipal}
                                  </div>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                <span
                                  className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                    aux.inactivo
                                      ? 'bg-rose-100 text-rose-700'
                                      : 'bg-emerald-50 text-emerald-700'
                                  }`}
                                >
                                  {aux.inactivo ? 'Inactivo' : 'Activo'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1.5">
                                  {onSelectAuxiliary && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        onSelectAuxiliary(aux.rut, aux.razonSocial);
                                        onClose();
                                      }}
                                      className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded text-[11px] font-bold cursor-pointer transition-colors"
                                      title="Seleccionar este auxiliar en el asiento"
                                    >
                                      Seleccionar
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleStartEdit(aux)}
                                    className="p-1 hover:bg-slate-200 text-slate-600 hover:text-slate-900 rounded transition-colors cursor-pointer"
                                    title="Editar datos del auxiliar"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleActive(aux)}
                                    className={`p-1 rounded transition-colors cursor-pointer text-[10px] font-semibold ${
                                      aux.inactivo
                                        ? 'text-emerald-700 hover:bg-emerald-100'
                                        : 'text-slate-400 hover:text-rose-700 hover:bg-rose-50'
                                    }`}
                                    title={aux.inactivo ? 'Reactivar auxiliar' : 'Desactivar auxiliar'}
                                  >
                                    {aux.inactivo ? 'Activar' : 'Inactivar'}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>
            {stats.total} auxiliares registrados para {companyName} • Padrón oficial SII
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-semibold transition-colors cursor-pointer"
          >
            Cerrar Padrón
          </button>
        </div>
      </div>
    </div>
  );
};
