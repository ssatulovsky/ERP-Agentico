import React, { useState, useEffect } from 'react';
import {
  Users,
  Bot,
  RotateCcw,
  Save,
  CheckCircle2,
  X,
  Building,
  MapPin,
  Tag,
  CreditCard,
  GitBranch,
  Search,
  Plus,
  Trash2,
  Check,
  AlertTriangle
} from 'lucide-react';
import { ClientAuxiliaryMasterRecord } from '../../types';
import { INITIAL_CLIENT_AUXILIARIES, CHILEAN_REGIONS_WITH_COMMUNES } from '../../data/erpMasterConfig';
import { validateRutChileno, formatRutChileno } from '../../utils/chileanAccounting';
import {
  loadCompanyAuxiliaries,
  fetchCompanyAuxiliaries,
  saveCompanyAuxiliaries,
} from '../../utils/companyAuxiliariesService';

interface ClientAuxiliariesMasterModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyRut?: string;
  onSelectAuxiliary?: (aux: ClientAuxiliaryMasterRecord) => void;
}

export const ClientAuxiliariesMasterModal: React.FC<ClientAuxiliariesMasterModalProps> = ({
  isOpen,
  onClose,
  companyRut = 'default',
  onSelectAuxiliary,
}) => {
  const [auxiliariesList, setAuxiliariesList] = useState<ClientAuxiliaryMasterRecord[]>(() => {
    return loadCompanyAuxiliaries(companyRut) as any;
  });

  useEffect(() => {
    if (isOpen) {
      let isMounted = true;
      const targetRut = companyRut || 'default';
      setAuxiliariesList(loadCompanyAuxiliaries(targetRut) as any);
      fetchCompanyAuxiliaries(targetRut).then((remoteAuxs) => {
        if (isMounted && Array.isArray(remoteAuxs) && remoteAuxs.length > 0) {
          setAuxiliariesList(remoteAuxs as any);
        }
      }).catch(() => {});

      const handleAuxUpdated = (e: any) => {
        if (e?.detail?.empresaRut === targetRut && Array.isArray(e?.detail?.auxiliaries)) {
          setAuxiliariesList(e.detail.auxiliaries as any);
        }
      };

      window.addEventListener('companyAuxiliariesUpdated', handleAuxUpdated);
      return () => {
        isMounted = false;
        window.removeEventListener('companyAuxiliariesUpdated', handleAuxUpdated);
      };
    }
  }, [isOpen, companyRut]);

  const [activeSideTab, setActiveSideTab] = useState<'IDENTIFICACION' | 'UBICACION' | 'TIPO' | 'COMERCIAL' | 'SUCURSALES'>('IDENTIFICACION');
  const [selectedAuxId, setSelectedAuxId] = useState<string>(INITIAL_CLIENT_AUXILIARIES[0]?.id || '');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Form State
  const [rutCompleto, setRutCompleto] = useState<string>('');
  const [codAuxiliar, setCodAuxiliar] = useState<string>('');
  const [razonSocial, setRazonSocial] = useState<string>('');
  const [nombreFantasia, setNombreFantasia] = useState<string>('');
  const [giroComercial, setGiroComercial] = useState<string>('');
  const [inactivo, setInactivo] = useState<boolean>(false);

  const [telefonoPrincipal, setTelefonoPrincipal] = useState<string>('');
  const [emailContacto, setEmailContacto] = useState<string>('');
  const [nombreContacto, setNombreContacto] = useState<string>('');
  const [emailDte, setEmailDte] = useState<string>('');

  // Ubicación
  const [direccion, setDireccion] = useState<string>('');
  const [region, setRegion] = useState<string>('');
  const [ciudad, setCiudad] = useState<string>('');
  const [comuna, setComuna] = useState<string>('');

  // Tipo
  const [tipoAuxiliar, setTipoAuxiliar] = useState<'CLIENTE' | 'PROVEEDOR' | 'AMBOS' | 'EMPLEADO' | 'HONORARIO'>('CLIENTE');

  // Comercial
  const [limiteCredito, setLimiteCredito] = useState<number>(10000000);
  const [terminosPago, setTerminosPago] = useState<string>('30 Días Fecha Factura');
  const [vendedor, setVendedor] = useState<string>('Claudia Morales');
  const [descuentoPorc, setDescuentoPorc] = useState<number>(0);

  // Sucursales
  const [sucursales, setSucursales] = useState<{ id: string; nombre: string; direccion: string; comuna: string }[]>([
    { id: 'suc-1', nombre: 'Casa Matriz Costanera', direccion: 'Av. Andrés Bello 2457', comuna: 'Providencia' }
  ]);
  const [nuevaSucursalNombre, setNuevaSucursalNombre] = useState('');
  const [nuevaSucursalDir, setNuevaSucursalDir] = useState('');
  const [nuevaSucursalComuna, setNuevaSucursalComuna] = useState('Providencia');

  if (!isOpen) return null;

  const handleSelectRecord = (aux: ClientAuxiliaryMasterRecord) => {
    setSelectedAuxId(aux.id);
    setRutCompleto(aux.rutCompleto);
    setCodAuxiliar(aux.codigoAuxiliar);
    setRazonSocial(aux.razonSocial);
    setNombreFantasia(aux.nombreFantasia || '');
    setGiroComercial(aux.giroComercial || '');
    setInactivo(aux.inactivo);
    setTelefonoPrincipal(aux.telefonoPrincipal || '');
    setEmailContacto(aux.emailContacto || '');
    setNombreContacto(aux.nombreContacto || '');
    setEmailDte(aux.emailDte || '');
    setDireccion(aux.direccion || '');
    setRegion(aux.region || 'Región Metropolitana de Santiago');
    setCiudad(aux.ciudad || 'Santiago');
    setComuna(aux.comuna || 'Providencia');
    setTipoAuxiliar(aux.tipoAuxiliar);
    setLimiteCredito(aux.limiteCredito || 0);
    setTerminosPago(aux.terminosPago || '30 Días');
    setVendedor(aux.vendedor || '');
    setDescuentoPorc(aux.descuentoPorcentaje || 0);
    setSucursales(aux.sucursales || []);
  };

  const handleResetForm = () => {
    setRutCompleto('');
    setCodAuxiliar('');
    setRazonSocial('');
    setNombreFantasia('');
    setGiroComercial('');
    setInactivo(false);
    setTelefonoPrincipal('');
    setEmailContacto('');
    setNombreContacto('');
    setEmailDte('');
    setDireccion('');
    setSucursales([]);
  };

  const handleSaveAuxiliar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!razonSocial.trim() || !rutCompleto.trim()) {
      alert('RUT y Razón Social son requeridos.');
      return;
    }

    const formattedRut = formatRutChileno(rutCompleto);
    const newAux: ClientAuxiliaryMasterRecord = {
      id: selectedAuxId || `aux-${Date.now()}`,
      rutCompleto: formattedRut,
      codigoAuxiliar: codAuxiliar || formattedRut.replace(/\./g, '').replace('-', ''),
      razonSocial: razonSocial.trim(),
      nombreFantasia: nombreFantasia.trim(),
      giroComercial: giroComercial.trim(),
      inactivo,
      telefonoPrincipal: telefonoPrincipal.trim(),
      emailContacto: emailContacto.trim(),
      nombreContacto: nombreContacto.trim(),
      emailDte: emailDte.trim(),
      direccion: direccion.trim(),
      region,
      ciudad,
      comuna,
      tipoAuxiliar,
      limiteCredito,
      terminosPago,
      vendedor,
      descuentoPorcentaje: descuentoPorc,
      sucursales,
    };

    setAuxiliariesList((prev) => {
      const exists = prev.find((a) => a.id === newAux.id);
      const next = exists ? prev.map((a) => (a.id === newAux.id ? newAux : a)) : [newAux, ...prev];
      saveCompanyAuxiliaries(companyRut || 'default', next as any);
      return next;
    });

    setSuccessNotice(`Auxiliar "${newAux.razonSocial}" guardado exitosamente.`);
    setTimeout(() => setSuccessNotice(null), 3500);

    if (onSelectAuxiliary) {
      onSelectAuxiliary(newAux);
    }
  };

  const handleAddSucursal = () => {
    if (!nuevaSucursalNombre.trim()) return;
    setSucursales((prev) => [
      ...prev,
      {
        id: `suc-${Date.now()}`,
        nombre: nuevaSucursalNombre.trim(),
        direccion: nuevaSucursalDir.trim(),
        comuna: nuevaSucursalComuna.trim(),
      }
    ]);
    setNuevaSucursalNombre('');
    setNuevaSucursalDir('');
  };

  const handleRemoveSucursal = (id: string) => {
    setSucursales((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-5xl overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header matching Page 11 Screenshot */}
        <div className="bg-[#0b192c] text-white px-5 py-3.5 flex items-center justify-between border-b-2 border-cyan-500 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-600 flex items-center justify-center text-white shadow-xs">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold tracking-wide uppercase">
                Maestro de Auxiliares de Clientes
              </h2>
              <p className="text-[10px] text-cyan-300 font-mono tracking-wider">
                ASISTENTE GEMINI AI CONECTADO • PADRÓN EMPRESAS CHILE
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetForm}
              className="text-xs text-slate-300 hover:text-white font-bold uppercase tracking-wider flex items-center gap-1 px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Limpiar Datos</span>
            </button>
            <button
              type="button"
              onClick={handleSaveAuxiliar}
              className="bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-1 rounded text-xs font-bold uppercase tracking-wider shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Save className="w-3 h-3" />
              <span>Guardar Auxiliar</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-md transition-colors cursor-pointer ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {successNotice && (
          <div className="bg-emerald-50 border-b border-emerald-200 text-emerald-800 px-5 py-2 text-xs flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span className="font-bold">{successNotice}</span>
          </div>
        )}

        <div className="flex-1 flex overflow-hidden">
          {/* Vertical Sidebar Navigation matching Page 11 */}
          <div className="w-48 bg-slate-100 border-r border-slate-200 p-3 space-y-1 shrink-0 overflow-y-auto">
            <button
              type="button"
              onClick={() => setActiveSideTab('IDENTIFICACION')}
              className={`w-full text-left px-3 py-2 rounded-md text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
                activeSideTab === 'IDENTIFICACION'
                  ? 'bg-cyan-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Building className="w-3.5 h-3.5" />
              <span>Identificación</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSideTab('UBICACION')}
              className={`w-full text-left px-3 py-2 rounded-md text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
                activeSideTab === 'UBICACION'
                  ? 'bg-cyan-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Ubicación</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSideTab('TIPO')}
              className={`w-full text-left px-3 py-2 rounded-md text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
                activeSideTab === 'TIPO'
                  ? 'bg-cyan-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Tipo Auxiliar</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSideTab('COMERCIAL')}
              className={`w-full text-left px-3 py-2 rounded-md text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
                activeSideTab === 'COMERCIAL'
                  ? 'bg-cyan-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Comercial</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSideTab('SUCURSALES')}
              className={`w-full text-left px-3 py-2 rounded-md text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
                activeSideTab === 'SUCURSALES'
                  ? 'bg-cyan-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              <GitBranch className="w-3.5 h-3.5" />
              <span>Sucursales</span>
            </button>

            {/* Listado rápido de auxiliares en el sidebar */}
            <div className="pt-4 border-t border-slate-200">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Cartera Auxiliares
              </span>
              <div className="space-y-1 max-h-56 overflow-y-auto">
                {auxiliariesList.map((aux) => (
                  <button
                    key={aux.id}
                    type="button"
                    onClick={() => handleSelectRecord(aux)}
                    className={`w-full text-left p-1.5 rounded text-[11px] truncate block cursor-pointer transition-colors ${
                      selectedAuxId === aux.id
                        ? 'bg-slate-200 font-bold text-slate-900 border-l-2 border-cyan-600'
                        : 'text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <span className="font-mono block text-[9px] text-slate-400">{aux.rutCompleto}</span>
                    <span className="truncate block">{aux.razonSocial}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Form Content matching Page 11 */}
          <div className="flex-1 p-5 overflow-y-auto space-y-4">
            {activeSideTab === 'IDENTIFICACION' && (
              <div className="space-y-4 animate-in fade-in duration-100">
                {/* Sección 1: Información de Cabecera */}
                <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50 space-y-3">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider border-b border-slate-200 pb-1.5">
                    Información de Cabecera
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        RUT Completo <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={rutCompleto}
                        onChange={(e) => setRutCompleto(e.target.value)}
                        placeholder="77.798.901-4"
                        className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        Cod. Auxiliar (RUT)
                      </label>
                      <input
                        type="text"
                        value={codAuxiliar}
                        onChange={(e) => setCodAuxiliar(e.target.value)}
                        placeholder="777989014"
                        className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      />
                    </div>

                    <div className="flex items-center pt-4">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="chk-inactivo-aux"
                          checked={inactivo}
                          onChange={(e) => setInactivo(e.target.checked)}
                          className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                        />
                        <label htmlFor="chk-inactivo-aux" className="text-xs font-bold text-slate-700 cursor-pointer">
                          Inactivo ({inactivo ? 'BLOQUEADO' : 'ESTADO: ACTIVO'})
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        Razón Social <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={razonSocial}
                        onChange={(e) => setRazonSocial(e.target.value)}
                        placeholder="Razón Social Completa"
                        className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        Nombre Fantasía
                      </label>
                      <input
                        type="text"
                        value={nombreFantasia}
                        onChange={(e) => setNombreFantasia(e.target.value)}
                        placeholder="Nombre Fantasía"
                        className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Giro Comercial
                    </label>
                    <input
                      type="text"
                      value={giroComercial}
                      onChange={(e) => setGiroComercial(e.target.value)}
                      placeholder="Giro según SII"
                      className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    />
                  </div>
                </div>

                {/* Sección 2: Información de Contacto y Venta */}
                <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50 space-y-3">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider border-b border-slate-200 pb-1.5">
                    Información de Contacto y Venta
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        Teléfono Principal
                      </label>
                      <input
                        type="text"
                        value={telefonoPrincipal}
                        onChange={(e) => setTelefonoPrincipal(e.target.value)}
                        placeholder="+56 9 8451 9022"
                        className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        Email Contacto
                      </label>
                      <input
                        type="email"
                        value={emailContacto}
                        onChange={(e) => setEmailContacto(e.target.value)}
                        placeholder="contacto@empresa.cl"
                        className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        Nombre de Contacto
                      </label>
                      <input
                        type="text"
                        value={nombreContacto}
                        onChange={(e) => setNombreContacto(e.target.value)}
                        placeholder="Representante / Contacto"
                        className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        Email DTE (Facturación Electrónica SII)
                      </label>
                      <input
                        type="email"
                        value={emailDte}
                        onChange={(e) => setEmailDte(e.target.value)}
                        placeholder="dte@empresa.cl"
                        className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeSideTab === 'UBICACION' && (
              <div className="space-y-4 animate-in fade-in duration-100">
                <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50 space-y-3">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider border-b border-slate-200 pb-1.5">
                    Domicilio Comercial y Despacho
                  </h3>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Dirección Completa
                    </label>
                    <input
                      type="text"
                      value={direccion}
                      onChange={(e) => setDireccion(e.target.value)}
                      placeholder="Calle, número, oficina o parque industrial"
                      className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        Región
                      </label>
                      <select
                        value={region}
                        onChange={(e) => setRegion(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      >
                        {CHILEAN_REGIONS_WITH_COMMUNES.map((r) => (
                          <option key={r.region} value={r.region}>{r.region}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        Ciudad
                      </label>
                      <input
                        type="text"
                        value={ciudad}
                        onChange={(e) => setCiudad(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        Comuna
                      </label>
                      <input
                        type="text"
                        value={comuna}
                        onChange={(e) => setComuna(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeSideTab === 'TIPO' && (
              <div className="space-y-4 animate-in fade-in duration-100">
                <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50 space-y-3">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider border-b border-slate-200 pb-1.5">
                    Clasificación de Auxiliar en Libro Mayor
                  </h3>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {(['CLIENTE', 'PROVEEDOR', 'AMBOS', 'EMPLEADO', 'HONORARIO'] as const).map((tipo) => (
                      <button
                        key={tipo}
                        type="button"
                        onClick={() => setTipoAuxiliar(tipo)}
                        className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                          tipoAuxiliar === tipo
                            ? 'bg-cyan-50 border-cyan-500 text-cyan-900 ring-1 ring-cyan-500'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span className="font-bold text-xs block">{tipo}</span>
                        <span className="text-[10px] text-slate-400">
                          {tipo === 'CLIENTE' && 'Imputación de facturas 33/34 y cobranzas'}
                          {tipo === 'PROVEEDOR' && 'Imputación de compras y pagos'}
                          {tipo === 'AMBOS' && 'Operaciones cruzadas de cliente y proveedor'}
                          {tipo === 'EMPLEADO' && 'Anticipos, sueldos y rendiciones'}
                          {tipo === 'HONORARIO' && 'Retenciones BHE 2da categoría'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeSideTab === 'COMERCIAL' && (
              <div className="space-y-4 animate-in fade-in duration-100">
                <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50 space-y-3">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider border-b border-slate-200 pb-1.5">
                    Parámetros Comerciales
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        Límite de Crédito ($ CLP)
                      </label>
                      <input
                        type="number"
                        value={limiteCredito}
                        onChange={(e) => setLimiteCredito(Number(e.target.value))}
                        className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        Términos de Pago
                      </label>
                      <input
                        type="text"
                        value={terminosPago}
                        onChange={(e) => setTerminosPago(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        Vendedor Asignado
                      </label>
                      <input
                        type="text"
                        value={vendedor}
                        onChange={(e) => setVendedor(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        Descuento Comercial (%)
                      </label>
                      <input
                        type="number"
                        value={descuentoPorc}
                        onChange={(e) => setDescuentoPorc(Number(e.target.value))}
                        className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeSideTab === 'SUCURSALES' && (
              <div className="space-y-4 animate-in fade-in duration-100">
                <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50 space-y-3">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider border-b border-slate-200 pb-1.5">
                    Sucursales y Puntos de Despacho
                  </h3>

                  {/* Add branch */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-white p-3 rounded-md border border-slate-200">
                    <input
                      type="text"
                      placeholder="Nombre (ej: Bodega Lo Boza)"
                      value={nuevaSucursalNombre}
                      onChange={(e) => setNuevaSucursalNombre(e.target.value)}
                      className="border border-slate-300 rounded px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    />
                    <input
                      type="text"
                      placeholder="Dirección (ej: Camino Lo Boza 120)"
                      value={nuevaSucursalDir}
                      onChange={(e) => setNuevaSucursalDir(e.target.value)}
                      className="border border-slate-300 rounded px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    />
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Comuna (ej: Pudahuel)"
                        value={nuevaSucursalComuna}
                        onChange={(e) => setNuevaSucursalComuna(e.target.value)}
                        className="border border-slate-300 rounded px-2.5 py-1 text-xs flex-1 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      />
                      <button
                        type="button"
                        onClick={handleAddSucursal}
                        className="bg-cyan-600 hover:bg-cyan-700 text-white px-3 py-1 rounded text-xs font-bold cursor-pointer transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Branch list */}
                  <div className="space-y-2 pt-2">
                    {sucursales.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No hay sucursales registradas aún.</p>
                    ) : (
                      sucursales.map((s) => (
                        <div key={s.id} className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded text-xs">
                          <div>
                            <span className="font-bold text-slate-800 block">{s.nombre}</span>
                            <span className="text-slate-500 text-[11px]">{s.direccion}, {s.comuna}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveSucursal(s.id)}
                            className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
