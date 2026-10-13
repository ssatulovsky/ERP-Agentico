import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Users,
  X,
  Check,
  Building,
  CreditCard,
  Phone,
  Mail,
  AlertCircle,
  Tag,
} from 'lucide-react';
import { validateRutChileno, formatRutChileno } from '../../utils/chileanAccounting';
import type { AuxiliaryOption } from './SearchableAuxiliarySelect';

interface CreateAuxiliaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (aux: AuxiliaryOption & {
    nombreFantasia?: string;
    giroComercial?: string;
    telefonoPrincipal?: string;
    emailContacto?: string;
  }) => void;
  initialRut?: string;
  defaultTipo?: 'CLIENTE' | 'PROVEEDOR' | 'AMBOS' | 'EMPLEADO' | 'HONORARIO';
}

export const CreateAuxiliaryModal: React.FC<CreateAuxiliaryModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialRut = '',
  defaultTipo = 'CLIENTE',
}) => {
  const [rut, setRut] = useState('');
  const [razonSocial, setRazonSocial] = useState('');
  const [nombreFantasia, setNombreFantasia] = useState('');
  const [tipo, setTipo] = useState<'CLIENTE' | 'PROVEEDOR' | 'AMBOS' | 'EMPLEADO' | 'HONORARIO'>(defaultTipo);
  const [giroComercial, setGiroComercial] = useState('');
  const [telefonoPrincipal, setTelefonoPrincipal] = useState('');
  const [emailContacto, setEmailContacto] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const cleanInitial = (initialRut || '').trim();
      setRut(cleanInitial ? formatRutChileno(cleanInitial) : '');
      setRazonSocial('');
      setNombreFantasia('');
      setTipo(defaultTipo);
      setGiroComercial('');
      setTelefonoPrincipal('');
      setEmailContacto('');
      setErrorMsg(null);
    }
  }, [isOpen, initialRut, defaultTipo]);

  if (!isOpen) return null;

  const handleRutChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const formatted = formatRutChileno(raw);
    setRut(formatted);
    setErrorMsg(null);
  };

  const handleSave = (e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setErrorMsg(null);

    const cleanRut = rut.replace(/[\.\-\s]/g, '').toUpperCase();
    if (!cleanRut) {
      setErrorMsg('Debe ingresar el RUT del auxiliar.');
      return;
    }

    if (!validateRutChileno(cleanRut)) {
      setErrorMsg(`El RUT "${rut}" no es válido según el algoritmo oficial de verificación (Módulo 11).`);
      return;
    }

    if (!razonSocial.trim()) {
      setErrorMsg('Debe ingresar la Razón Social o Nombre del auxiliar.');
      return;
    }

    const created: AuxiliaryOption & {
      nombreFantasia?: string;
      giroComercial?: string;
      telefonoPrincipal?: string;
      emailContacto?: string;
    } = {
      rut: formatRutChileno(cleanRut),
      razonSocial: razonSocial.trim(),
      tipo: tipo === 'AMBOS' ? 'AMBOS' : tipo === 'PROVEEDOR' ? 'PROVEEDOR' : 'CLIENTE',
      nombreFantasia: nombreFantasia.trim() || undefined,
      giroComercial: giroComercial.trim() || undefined,
      telefonoPrincipal: telefonoPrincipal.trim() || undefined,
      emailContacto: emailContacto.trim() || undefined,
    };

    onSave(created);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      handleSave(e);
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-600 to-amber-700 px-5 py-3.5 flex items-center justify-between text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-white/20 rounded-lg">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm tracking-wide">Alta Rápida de Auxiliar</h3>
              <p className="text-[11px] text-amber-100">
                Padrón Maestro de Clientes, Proveedores y Entidades
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body - DIV (NOT FORM) to prevent outer form submission or page refresh */}
        <div className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-2.5 bg-rose-50 border border-rose-300 rounded-lg flex items-center gap-2 text-xs text-rose-800">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* RUT */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                RUT Auxiliar *
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Ej: 76.543.210-K"
                  value={rut}
                  onChange={handleRutChange}
                  onKeyDown={handleKeyDown}
                  className="w-full text-xs font-mono font-bold px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                  required
                />
              </div>
            </div>

            {/* Tipo */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Tipo de Entidad *
              </label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as any)}
                className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              >
                <option value="CLIENTE">Cliente (Cuentas por Cobrar 1.1.03)</option>
                <option value="PROVEEDOR">Proveedor (Cuentas por Pagar 2.1.01)</option>
                <option value="AMBOS">Ambos (Cliente y Proveedor)</option>
                <option value="EMPLEADO">Empleado / Colaborador (RRHH)</option>
                <option value="HONORARIO">Prestador de Honorarios (BHE)</option>
              </select>
            </div>
          </div>

          {/* Razón Social */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Razón Social / Nombre Completo *
            </label>
            <input
              type="text"
              placeholder="Ej: DISTRIBUIDORA Y COMERCIAL ELBITA SPA"
              value={razonSocial}
              onChange={(e) => setRazonSocial(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              required
            />
          </div>

          {/* Nombre Fantasía & Giro */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Nombre de Fantasía (Opcional)
              </label>
              <input
                type="text"
                placeholder="Ej: Elbita SpA"
                value={nombreFantasia}
                onChange={(e) => setNombreFantasia(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Giro Comercial (Opcional)
              </label>
              <input
                type="text"
                placeholder="Ej: Venta de alimentos"
                value={giroComercial}
                onChange={(e) => setGiroComercial(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Contacto: Email & Teléfono */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Email de Contacto / DTE (Opcional)
              </label>
              <div className="relative">
                <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="email"
                  placeholder="contacto@empresa.cl"
                  value={emailContacto}
                  onChange={(e) => setEmailContacto(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full text-xs pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Teléfono Principal (Opcional)
              </label>
              <div className="relative">
                <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="+56 9 1234 5678"
                  value={telefonoPrincipal}
                  onChange={(e) => setTelefonoPrincipal(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full text-xs pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClose();
              }}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              Guardar y Seleccionar Auxiliar
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }
  return modalContent;
};
