import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Search,
  Users,
  FileText,
  Check,
  X,
  Building,
  Plus,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  FileCheck,
  DollarSign,
  CreditCard,
  Layers,
  ArrowRight,
  ArrowLeftRight,
  UserPlus,
  Receipt,
  CheckCircle2,
} from 'lucide-react';
import type { DteDocument, TipoDocumentoRespaldo } from '../../types';
import { formatCLP } from '../../utils/chileanAccounting';
import { CreateAuxiliaryModal } from './CreateAuxiliaryModal';

export interface AuxiliaryOption {
  rut: string;
  razonSocial: string;
  tipo?: 'PROVEEDOR' | 'CLIENTE' | 'AMBOS';
}

export interface PendingAuxiliaryDocument {
  id: string;
  tipo: string;
  tipoLabel: string;
  folio: string;
  montoTotal: number;
  saldoPendiente: number;
  fechaEmision?: string;
  fechaVencimiento?: string;
  concepto?: string;
  dteId?: string;
  origen?: 'DTE' | 'ASIENTO';
}

export interface SearchableAuxiliarySelectProps {
  selectedRut?: string;
  selectedDteId?: string;
  documentoRef?: string;
  tipoDocumentoRef?: TipoDocumentoRespaldo | string;
  folioDocumentoRef?: string;
  montoDocumentoRef?: number; // Importe total del documento relacionado
  fechaDocumentoRef?: string; // Fecha del documento (emisión) YYYY-MM-DD
  fechaVencimientoRef?: string; // Fecha de vencimiento del documento YYYY-MM-DD
  documentoOperacion?: string; // N° Documento de Operación (Canje, Efectivo, TEF)
  tipoDocumentoOperacion?: string; // Tipo Doc Operación
  fechaDocumentoOperacion?: string; // Fecha del documento de operación YYYY-MM-DD
  lineAmount?: number; // Monto actual imputado en la línea (Debe o Haber)
  availableAuxiliaries: AuxiliaryOption[];
  availableDtes: DteDocument[];
  pendingDocuments?: PendingAuxiliaryDocument[];
  accountCode: string; // ej: 2.1.01 o 1.1.03
  tipoAuxiliarPermitido?: 'TODOS' | 'PROVEEDOR' | 'CLIENTE' | 'HONORARIO' | 'EMPLEADO';
  onSelectAuxiliary: (rut: string, razonSocial?: string) => void;
  onSelectDocument: (doc: DteDocument | null) => void;
  onChangeManualDocRef?: (ref: string) => void;
  onChangeDocDetails?: (details: {
    documentoRef?: string;
    tipoDocumentoRef?: TipoDocumentoRespaldo | string;
    folioDocumentoRef?: string;
    montoDocumentoRef?: number;
    fechaDocumentoRef?: string;
    fechaVencimientoRef?: string;
    documentoOperacion?: string;
    tipoDocumentoOperacion?: string;
    fechaDocumentoOperacion?: string;
  }) => void;
  onAddNewAuxiliary?: (newAux: AuxiliaryOption) => void;
  onOpenAuxiliaryManager?: () => void;
  onResetAuxiliary?: () => void;
  onApplyDocAmountToLine?: (amount: number, targetColumn?: 'DEBE' | 'HABER') => void;
  className?: string;
  disabled?: boolean;
}

const normRut = (r?: string | null) => (r || '').replace(/[\.\-\s]/g, '').toUpperCase();

export const SearchableAuxiliarySelect: React.FC<SearchableAuxiliarySelectProps> = ({
  selectedRut = '',
  selectedDteId = '',
  documentoRef = '',
  tipoDocumentoRef = 'DTE_SII',
  folioDocumentoRef = '',
  montoDocumentoRef,
  fechaDocumentoRef = '',
  fechaVencimientoRef = '',
  documentoOperacion = '',
  tipoDocumentoOperacion = '',
  fechaDocumentoOperacion = '',
  lineAmount = 0,
  availableAuxiliaries = [],
  availableDtes = [],
  pendingDocuments = [],
  accountCode = '',
  tipoAuxiliarPermitido,
  onSelectAuxiliary,
  onSelectDocument,
  onChangeManualDocRef,
  onChangeDocDetails,
  onAddNewAuxiliary,
  onOpenAuxiliaryManager,
  onResetAuxiliary,
  onApplyDocAmountToLine,
  className = '',
  disabled = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [docFilterTerm, setDocFilterTerm] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [showAdvancedOperation, setShowAdvancedOperation] = useState<boolean>(
    () => Boolean(documentoOperacion || tipoDocumentoOperacion)
  );

  // Determinar rol esperado según cuenta o configuración de la cuenta
  const expectedRole = useMemo<'PROVEEDOR' | 'CLIENTE' | 'TODOS'>(() => {
    if (tipoAuxiliarPermitido && tipoAuxiliarPermitido !== 'TODOS') {
      if (tipoAuxiliarPermitido === 'PROVEEDOR') return 'PROVEEDOR';
      if (tipoAuxiliarPermitido === 'CLIENTE') return 'CLIENTE';
    }
    if (accountCode.startsWith('2.1')) return 'PROVEEDOR';
    if (
      accountCode.startsWith('1.1.03') ||
      accountCode.startsWith('1.1.04') ||
      accountCode.startsWith('1.1.09') ||
      accountCode.startsWith('1.1')
    ) {
      return 'CLIENTE';
    }
    return 'TODOS';
  }, [tipoAuxiliarPermitido, accountCode]);

  const [roleFilter, setRoleFilter] = useState<'AUTO' | 'PROVEEDOR' | 'CLIENTE' | 'TODOS'>('AUTO');

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Normalizar RUT seleccionado
  const normSelectedRut = normRut(selectedRut);

  // Identificar auxiliar actual
  const currentAux = useMemo(() => {
    if (!normSelectedRut) return null;
    return (
      availableAuxiliaries.find((a) => normRut(a.rut) === normSelectedRut) || {
        rut: selectedRut,
        razonSocial: `Auxiliar RUT ${selectedRut}`,
        tipo: expectedRole === 'PROVEEDOR' ? 'PROVEEDOR' : 'CLIENTE',
      }
    );
  }, [normSelectedRut, availableAuxiliaries, selectedRut, expectedRole]);

  // Documentos específicos de este auxiliar
  const auxDtes = useMemo(() => {
    if (!normSelectedRut) return [];
    const isSupplierAccount = accountCode.startsWith('2.1');
    const isClientAccount = accountCode.startsWith('1.1.03') || accountCode.startsWith('1.1');

    return availableDtes.filter((d) => {
      if (!d.rutContraparte) return false;
      const rutMatches = normRut(d.rutContraparte) === normSelectedRut;
      if (!rutMatches) return false;

      if (isSupplierAccount) {
        return d.tipoOperacion === 'COMPRA';
      }
      if (isClientAccount) {
        return d.tipoOperacion === 'VENTA';
      }
      return true;
    });
  }, [normSelectedRut, availableDtes, accountCode]);

  // Documentos filtrados dentro del auxiliar
  const filteredAuxDtes = useMemo(() => {
    if (!docFilterTerm.trim()) return auxDtes;
    const term = docFilterTerm.toLowerCase().trim();
    return auxDtes.filter((d) => {
      const folioStr = String(d.folio);
      const montoStr = String(d.montoTotal);
      const fechaStr = d.fechaEmision || '';
      return folioStr.includes(term) || montoStr.includes(term) || fechaStr.includes(term);
    });
  }, [auxDtes, docFilterTerm]);

  // Documentos con saldo pendiente (cartera viva de deudas anteriores o DTEs pendientes)
  const effectivePendingDocs = useMemo(() => {
    return (pendingDocuments || []).filter((doc) => doc.saldoPendiente > 0);
  }, [pendingDocuments]);

  // Documento pendiente que coincide con la imputación actual
  const matchedPendingDoc = useMemo(() => {
    if (!effectivePendingDocs.length) return null;
    return (
      effectivePendingDocs.find(
        (p) =>
          (folioDocumentoRef && String(folioDocumentoRef) === String(p.folio)) ||
          (documentoRef && documentoRef.includes(String(p.folio)))
      ) || null
    );
  }, [effectivePendingDocs, folioDocumentoRef, documentoRef]);

  // Auxiliares filtrados en el buscador general (separando estrictamente Proveedores y Clientes)
  const filteredAuxiliaries = useMemo(() => {
    const activeRole = roleFilter === 'AUTO' ? expectedRole : roleFilter;
    let list = availableAuxiliaries;
    if (activeRole === 'PROVEEDOR') {
      list = list.filter((a) => !a.tipo || a.tipo === 'PROVEEDOR' || a.tipo === 'AMBOS');
    } else if (activeRole === 'CLIENTE') {
      list = list.filter((a) => !a.tipo || a.tipo === 'CLIENTE' || a.tipo === 'AMBOS');
    }

    if (!searchTerm.trim()) {
      return list.slice(0, 30);
    }
    const term = searchTerm.toLowerCase().trim();
    const cleanTerm = term.replace(/[\.\-\s]/g, '');

    return list.filter((aux) => {
      const rutClean = normRut(aux.rut).toLowerCase();
      const name = (aux.razonSocial || '').toLowerCase();
      return rutClean.includes(cleanTerm) || name.includes(term);
    });
  }, [availableAuxiliaries, searchTerm, roleFilter, expectedRole]);

  // Coincidencias directas por Folio
  const directFolioMatches = useMemo(() => {
    if (!searchTerm.trim() || !/^\d+$/.test(searchTerm.trim())) return [];
    const folioNum = parseInt(searchTerm.trim(), 10);
    return availableDtes.filter((d) => d.folio === folioNum);
  }, [searchTerm, availableDtes]);

  // Cerrar dropdown al hacer click afuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ¿Existen documentos o deudas previas registradas para este auxiliar?
  const hasExistingDocs = effectivePendingDocs.length > 0 || auxDtes.length > 0;

  // Modo de visualización: 'PENDING_DOCS' (deudas existentes) o 'NEW_DOC' (crear nueva factura/pasivo)
  const [docMode, setDocMode] = useState<'PENDING_DOCS' | 'NEW_DOC'>(() => {
    if (!hasExistingDocs) return 'NEW_DOC';
    if (folioDocumentoRef && !matchedPendingDoc) return 'NEW_DOC';
    return 'PENDING_DOCS';
  });

  // Si no hay documentos existentes, cambiar automáticamente a NEW_DOC
  useEffect(() => {
    if (!hasExistingDocs) {
      setDocMode('NEW_DOC');
    }
  }, [hasExistingDocs]);

  // Al pasar a NEW_DOC, pre-llenar monto de la línea y fecha si no están asignados
  useEffect(() => {
    if (normSelectedRut && docMode === 'NEW_DOC') {
      if ((!montoDocumentoRef || montoDocumentoRef === 0) && lineAmount > 0 && onChangeDocDetails) {
        onChangeDocDetails({ montoDocumentoRef: lineAmount });
      }
      if (!fechaDocumentoRef && onChangeDocDetails) {
        const todayStr = new Date().toISOString().slice(0, 10);
        onChangeDocDetails({
          fechaDocumentoRef: todayStr,
          fechaVencimientoRef: fechaVencimientoRef || todayStr,
        });
      }
    }
  }, [normSelectedRut, docMode]);

  // Helper para etiqueta amigable de DTE
  const getDteLabel = (tipo: string) => {
    switch (String(tipo)) {
      case '33':
        return 'Factura Electrónica (33)';
      case '34':
        return 'Factura Exenta (34)';
      case '61':
        return 'Nota de Crédito (61)';
      case '56':
        return 'Nota de Débito (56)';
      case '39':
        return 'Boleta Electrónica (39)';
      default:
        return `DTE ${tipo}`;
    }
  };

  const getDocTypeSimpleLabel = (tipo?: string) => {
    switch (tipo) {
      case 'FACTURA_ELECTRONICA_33':
      case '33':
        return 'Factura Electrónica';
      case 'FACTURA_EXENTA_34':
      case '34':
        return 'Factura Exenta';
      case 'BOLETA_ELECTRONICA_39':
      case '39':
        return 'Boleta Electrónica';
      case 'NOTA_CREDITO_61':
      case '61':
        return 'Nota de Crédito';
      case 'NOTA_DEBITO_56':
      case '56':
        return 'Nota de Débito';
      case 'BOLETA_HONORARIOS_ELECTRONICA':
      case '48':
        return 'Boleta Honorarios';
      case 'CONTRATO':
        return 'Contrato';
      case 'RENDICION_GASTOS':
        return 'Rendición Gastos';
      case 'COMPROBANTE_BANCARIO':
        return 'Comprobante Bancario';
      default:
        return 'Documento';
    }
  };

  const updateDetails = (patch: {
    documentoRef?: string;
    tipoDocumentoRef?: TipoDocumentoRespaldo | string;
    folioDocumentoRef?: string;
    montoDocumentoRef?: number;
    fechaDocumentoRef?: string;
    fechaVencimientoRef?: string;
    documentoOperacion?: string;
    tipoDocumentoOperacion?: string;
    fechaDocumentoOperacion?: string;
  }) => {
    if (onChangeDocDetails) {
      onChangeDocDetails({
        documentoRef,
        tipoDocumentoRef,
        folioDocumentoRef,
        montoDocumentoRef,
        fechaDocumentoRef,
        fechaVencimientoRef,
        documentoOperacion,
        tipoDocumentoOperacion,
        fechaDocumentoOperacion,
        ...patch,
      });
    }
  };

  const handleFolioChange = (fol: string) => {
    const tipo = tipoDocumentoRef || 'FACTURA_ELECTRONICA_33';
    const tipoLabel = getDocTypeSimpleLabel(tipo);
    const fullRef = fol ? `${tipoLabel} F.${fol}` : '';
    if (onChangeManualDocRef) onChangeManualDocRef(fullRef);
    updateDetails({
      folioDocumentoRef: fol,
      documentoRef: fullRef,
    });
  };

  const handleTipoDocChange = (tipo: string) => {
    const tipoLabel = getDocTypeSimpleLabel(tipo);
    const fullRef = folioDocumentoRef ? `${tipoLabel} F.${folioDocumentoRef}` : '';
    if (onChangeManualDocRef) onChangeManualDocRef(fullRef);
    updateDetails({
      tipoDocumentoRef: tipo,
      documentoRef: fullRef,
    });
  };

  const handleSelectPendingDoc = (pDoc: PendingAuxiliaryDocument) => {
    const tipoLabel = pDoc.tipoLabel || 'Documento';
    const fullRef = `${tipoLabel} F.${pDoc.folio}`;
    if (onChangeManualDocRef) onChangeManualDocRef(fullRef);
    if (onChangeDocDetails) {
      onChangeDocDetails({
        documentoRef: fullRef,
        tipoDocumentoRef: pDoc.tipo || 'FACTURA_ELECTRONICA_33',
        folioDocumentoRef: String(pDoc.folio),
        montoDocumentoRef: pDoc.montoTotal,
        fechaDocumentoRef: pDoc.fechaEmision,
        fechaVencimientoRef: pDoc.fechaVencimiento || pDoc.fechaEmision,
        documentoOperacion: String(pDoc.folio),
        tipoDocumentoOperacion: tipoLabel.toUpperCase(),
      });
    }
    if (pDoc.dteId && onSelectDocument) {
      const matchedDte = availableDtes.find((d) => d.id === pDoc.dteId);
      if (matchedDte) onSelectDocument(matchedDte);
    }
    if (onApplyDocAmountToLine) {
      onApplyDocAmountToLine(pDoc.saldoPendiente);
    }
  };

  const handleUnlinkPendingDoc = () => {
    if (onChangeManualDocRef) onChangeManualDocRef('');
    if (onChangeDocDetails) {
      onChangeDocDetails({
        documentoRef: '',
        tipoDocumentoRef: undefined,
        folioDocumentoRef: '',
        montoDocumentoRef: undefined,
        fechaDocumentoRef: '',
        fechaVencimientoRef: '',
        documentoOperacion: '',
        tipoDocumentoOperacion: '',
      });
    }
    if (onSelectDocument) onSelectDocument(null);
  };

  const handleCreateAuxiliarySaved = (newAux: AuxiliaryOption) => {
    if (onAddNewAuxiliary) {
      onAddNewAuxiliary(newAux);
    }
    onSelectAuxiliary(newAux.rut, newAux.razonSocial);
    setIsCreateModalOpen(false);
    setIsDropdownOpen(false);
    setSearchTerm('');
  };

  const handleDteSelected = (doc: DteDocument | null) => {
    onSelectDocument(doc);
    if (doc) {
      const tipoLabel = getDteLabel(doc.tipoDte);
      const fullRef = `${tipoLabel} F.${doc.folio}`;
      if (onChangeManualDocRef) onChangeManualDocRef(fullRef);
      if (onChangeDocDetails) {
        onChangeDocDetails({
          documentoRef: fullRef,
          tipoDocumentoRef: 'DTE_SII',
          folioDocumentoRef: String(doc.folio),
          montoDocumentoRef: doc.montoTotal,
          fechaDocumentoRef: doc.fechaEmision,
          fechaVencimientoRef: doc.fechaVencimiento || doc.fechaEmision,
          documentoOperacion: String(doc.folio),
          tipoDocumentoOperacion: tipoLabel.toUpperCase(),
        });
      }
      if (onApplyDocAmountToLine) {
        onApplyDocAmountToLine(doc.montoTotal);
      }
    } else {
      handleUnlinkPendingDoc();
    }
  };

  const defaultTipoForAccount = accountCode.startsWith('2.1') ? 'PROVEEDOR' : 'CLIENTE';
  const isSupplier = accountCode.startsWith('2.1');
  const isClient = accountCode.startsWith('1.1');

  const handleResetAuxiliary = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setSearchTerm('');
    setIsDropdownOpen(true);
    if (onResetAuxiliary) {
      onResetAuxiliary();
    } else {
      onSelectAuxiliary('', '');
      onSelectDocument(null);
    }
  };

  const handleConfirmNewDoc = (targetCol?: 'DEBE' | 'HABER') => {
    if (!folioDocumentoRef) {
      alert('Por favor ingrese el N° o Folio del documento antes de confirmar.');
      return;
    }
    const chosenCol = targetCol || (isSupplier ? 'HABER' : 'DEBE');
    const tipo = tipoDocumentoRef || 'FACTURA_ELECTRONICA_33';
    const tipoLabel = getDocTypeSimpleLabel(tipo);
    const fullRef = `${tipoLabel} F.${folioDocumentoRef}`;
    const effectiveMonto = montoDocumentoRef || lineAmount || 0;
    const effectiveFechaEmision = fechaDocumentoRef || new Date().toISOString().slice(0, 10);
    const effectiveFechaVenc = fechaVencimientoRef || effectiveFechaEmision;

    if (onChangeManualDocRef) {
      onChangeManualDocRef(fullRef);
    }
    if (onChangeDocDetails) {
      onChangeDocDetails({
        documentoRef: fullRef,
        tipoDocumentoRef: tipo,
        folioDocumentoRef: String(folioDocumentoRef),
        montoDocumentoRef: effectiveMonto,
        fechaDocumentoRef: effectiveFechaEmision,
        fechaVencimientoRef: effectiveFechaVenc,
        documentoOperacion: documentoOperacion || String(folioDocumentoRef),
        tipoDocumentoOperacion: tipoDocumentoOperacion || tipoLabel.toUpperCase(),
        fechaDocumentoOperacion: fechaDocumentoOperacion || effectiveFechaEmision,
      });
    }
    if (onApplyDocAmountToLine && effectiveMonto > 0) {
      onApplyDocAmountToLine(effectiveMonto, chosenCol);
    }
  };

  return (
    <div className={`space-y-2.5 ${className}`}>
      {/* 1. SELECCIÓN DE AUXILIAR (RUT / RAZÓN SOCIAL) */}
      {currentAux && normSelectedRut ? (
        <div className="bg-amber-100/70 border border-amber-300 rounded-lg p-2.5 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-md bg-amber-500/20 text-amber-800 flex items-center justify-center shrink-0">
              <Building className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-mono font-bold text-amber-950 text-xs">{currentAux.rut}</span>
                <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-amber-200/80 text-amber-900 uppercase">
                  {currentAux.tipo || 'AUXILIAR'}
                </span>
                {auxDtes.length > 0 && (
                  <span className="text-[10px] font-medium text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded">
                    {auxDtes.length} doc{auxDtes.length === 1 ? '' : 's'} disponible{auxDtes.length === 1 ? '' : 's'}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-800 font-medium truncate mt-0.5">
                {currentAux.razonSocial}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={disabled}
              onClick={handleResetAuxiliary}
              className="text-[11px] text-amber-900 hover:text-amber-950 font-bold cursor-pointer px-2.5 py-1 rounded-lg bg-amber-200/80 hover:bg-amber-200 border border-amber-300 flex items-center gap-1.5 transition-all shadow-2xs"
              title="Cambiar auxiliar seleccionado"
            >
              <ArrowLeftRight className="w-3.5 h-3.5 text-amber-800" />
              <span>Cambiar Auxiliar</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="relative" ref={dropdownRef}>
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                disabled={disabled}
                placeholder="Buscar auxiliar por RUT, Razón Social o N° Folio..."
                value={searchTerm}
                onFocus={() => setIsDropdownOpen(true)}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setIsDropdownOpen(true);
                }}
                className="w-full text-xs pl-8 pr-7 py-2 bg-white border border-amber-300 rounded-lg text-slate-800 focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Botón Padrón Maestro de Auxiliares */}
            {onOpenAuxiliaryManager && (
              <button
                type="button"
                onClick={onOpenAuxiliaryManager}
                className="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1 shrink-0 cursor-pointer"
                title="Abrir Catálogo y Padrón Maestro de Auxiliares ERP"
              >
                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                <span className="hidden sm:inline">Padrón</span>
              </button>
            )}

            {/* Botón Prominente para Crear Auxiliar si no existe */}
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="px-2.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1 shrink-0 cursor-pointer"
              title="Registrar nuevo auxiliar en el sistema"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>+ Nuevo</span>
            </button>
          </div>

          {/* Desplegable de Resultados de Búsqueda */}
          {isDropdownOpen && (
            <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-300 rounded-xl shadow-xl max-h-72 overflow-y-auto divide-y divide-slate-100 animate-in fade-in duration-100">
              {/* Barra de Filtro de Rol Rápido en Dropdown */}
              <div className="p-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs gap-2 flex-wrap">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Rol:</span>
                  <button
                    type="button"
                    onClick={() => setRoleFilter(expectedRole)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                      roleFilter === 'AUTO' || roleFilter === expectedRole
                        ? 'bg-amber-600 text-white shadow-2xs'
                        : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                    }`}
                  >
                    {expectedRole === 'PROVEEDOR' ? '✓ Proveedores' : expectedRole === 'CLIENTE' ? '✓ Clientes' : 'Recomendado'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRoleFilter(roleFilter === 'PROVEEDOR' ? (expectedRole === 'CLIENTE' ? 'CLIENTE' : 'TODOS') : 'PROVEEDOR')}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                      roleFilter === 'PROVEEDOR' && roleFilter !== expectedRole
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : roleFilter === 'PROVEEDOR'
                        ? 'hidden'
                        : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                    }`}
                  >
                    Proveedores
                  </button>
                  <button
                    type="button"
                    onClick={() => setRoleFilter(roleFilter === 'CLIENTE' ? (expectedRole === 'PROVEEDOR' ? 'PROVEEDOR' : 'TODOS') : 'CLIENTE')}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                      roleFilter === 'CLIENTE' && roleFilter !== expectedRole
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : roleFilter === 'CLIENTE'
                        ? 'hidden'
                        : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                    }`}
                  >
                    Clientes
                  </button>
                  <button
                    type="button"
                    onClick={() => setRoleFilter(roleFilter === 'TODOS' ? expectedRole : 'TODOS')}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                      roleFilter === 'TODOS'
                        ? 'bg-slate-700 text-white shadow-2xs'
                        : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                    }`}
                  >
                    {roleFilter === 'TODOS' ? '✓ Todos' : 'Ver Todos'}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {onOpenAuxiliaryManager && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsDropdownOpen(false);
                        onOpenAuxiliaryManager();
                      }}
                      className="text-[10px] font-bold text-indigo-700 hover:text-indigo-900 underline flex items-center gap-0.5 cursor-pointer"
                    >
                      <Layers className="w-3 h-3" /> Padrón ERP
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setIsDropdownOpen(false);
                      setIsCreateModalOpen(true);
                    }}
                    className="text-[10px] font-bold text-amber-800 hover:text-amber-950 underline flex items-center gap-0.5 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> Crear
                  </button>
                </div>
              </div>

              {/* Coincidencias directas por Folio */}
              {directFolioMatches.length > 0 && (
                <div className="p-1.5 bg-blue-50/60">
                  <div className="px-2 py-1 text-[10px] font-bold text-blue-900 uppercase tracking-wider">
                    Documento encontrado por N° Folio:
                  </div>
                  {directFolioMatches.map((doc) => (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => {
                        onSelectAuxiliary(doc.rutContraparte, doc.razonSocialContraparte);
                        handleDteSelected(doc);
                        setIsDropdownOpen(false);
                        setSearchTerm('');
                      }}
                      className="w-full text-left p-2 rounded-lg hover:bg-blue-100 transition-colors flex items-center justify-between text-xs cursor-pointer"
                    >
                      <div>
                        <div className="font-bold text-blue-950 flex items-center gap-1.5">
                          <FileText className="w-3 h-3 text-blue-600" />
                          <span>Folio #{doc.folio}</span>
                          <span className="text-[10px] text-blue-700 bg-blue-200/60 px-1 rounded">
                            {getDteLabel(doc.tipoDte)}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-600 truncate mt-0.5">
                          {doc.rutContraparte} - {doc.razonSocialContraparte}
                        </div>
                      </div>
                      <div className="text-right font-mono font-bold text-blue-900 shrink-0">
                        ${formatCLP(doc.montoTotal)}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Lista de Auxiliares del Padrón */}
              {filteredAuxiliaries.length > 0 ? (
                <div>
                  <div className="px-2.5 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50 flex items-center justify-between">
                    <span>Padrón de Auxiliares ({filteredAuxiliaries.length})</span>
                    <span className="text-[9px] lowercase font-normal">clic para seleccionar</span>
                  </div>
                  {filteredAuxiliaries.map((aux) => {
                    const auxDocsCount = availableDtes.filter(
                      (d) => normRut(d.rutContraparte) === normRut(aux.rut)
                    ).length;

                    return (
                      <button
                        key={aux.rut}
                        type="button"
                        onClick={() => {
                          onSelectAuxiliary(aux.rut, aux.razonSocial);
                          setIsDropdownOpen(false);
                          setSearchTerm('');
                        }}
                        className="w-full text-left p-2.5 hover:bg-amber-50/80 transition-colors flex items-center justify-between text-xs cursor-pointer"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-900">{aux.rut}</span>
                            <span className="text-[9px] font-semibold px-1 rounded bg-slate-200 text-slate-700 uppercase">
                              {aux.tipo || 'AUX'}
                            </span>
                            {auxDocsCount > 0 && (
                              <span className="text-[9px] font-semibold px-1.5 rounded bg-emerald-100 text-emerald-800">
                                {auxDocsCount} doc{auxDocsCount === 1 ? '' : 's'}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-600 truncate mt-0.5 font-medium">
                            {aux.razonSocial}
                          </div>
                        </div>
                        <span className="text-[10px] text-amber-700 font-semibold shrink-0">Seleccionar →</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="p-3 text-center text-xs text-slate-500 space-y-2">
                  <p>No se encontraron auxiliares con "{searchTerm}".</p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsDropdownOpen(false);
                      setIsCreateModalOpen(true);
                    }}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Crear Nuevo Auxiliar con "{searchTerm.trim() || 'RUT'}"</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 2. GESTIÓN CLARA Y MINIMALISTA DE FACTURA / DOCUMENTO DE RESPALDO */}
      {normSelectedRut && (
        <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-3 shadow-2xs">
          {/* A. Tarjeta de Documento Asociado si ya está enlazado o confirmado */}
          {(matchedPendingDoc || Boolean(folioDocumentoRef && (montoDocumentoRef || lineAmount))) && (
            <div className="bg-emerald-50 border border-emerald-300 rounded-lg p-2.5 flex items-center justify-between gap-2 shadow-2xs">
              <div className="flex items-center gap-2 min-w-0">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-bold text-emerald-950 flex items-center gap-1.5 flex-wrap">
                    <span className="px-1.5 py-0.2 rounded bg-emerald-200 text-emerald-900 text-[10px] uppercase font-bold">
                      {matchedPendingDoc ? 'Documento Enlazado' : 'Documento Registrado'}
                    </span>
                    <span className="font-mono bg-white px-1.5 py-0.2 rounded border border-emerald-200">
                      {documentoRef || `${getDocTypeSimpleLabel(tipoDocumentoRef)} F.${folioDocumentoRef}`}
                    </span>
                    {(montoDocumentoRef || lineAmount) ? (
                      <span className="text-[11px] font-mono font-bold text-emerald-900">
                        ${formatCLP(montoDocumentoRef || lineAmount || 0)}
                      </span>
                    ) : null}
                  </div>
                  <div className="text-[11px] text-emerald-800 font-mono mt-0.5">
                    {matchedPendingDoc ? (
                      <span>Saldo Deuda: ${formatCLP(matchedPendingDoc.saldoPendiente)}</span>
                    ) : (
                      <span>
                        {fechaDocumentoRef ? `Emisión: ${fechaDocumentoRef}` : ''}
                        {fechaVencimientoRef ? ` • Vcto: ${fechaVencimientoRef}` : ''}
                        {lineAmount > 0 ? ` • Imputado en Asiento: $${formatCLP(lineAmount)}` : ''}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleUnlinkPendingDoc}
                className="text-[11px] font-bold text-rose-700 hover:text-rose-900 bg-white hover:bg-rose-50 border border-rose-200 rounded px-2.5 py-1 cursor-pointer transition-colors shadow-2xs shrink-0"
                title="Desvincular o limpiar este documento"
              >
                Desvincular
              </button>
            </div>
          )}

          {/* B. Selector de Modo: Facturas Existentes vs. Nueva Factura */}
          {hasExistingDocs ? (
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setDocMode('PENDING_DOCS')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  docMode === 'PENDING_DOCS'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Receipt className="w-3.5 h-3.5 text-amber-600" />
                <span>Facturas / Deudas Existentes ({effectivePendingDocs.length || auxDtes.length})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDocMode('NEW_DOC');
                  if (!montoDocumentoRef && lineAmount > 0 && onChangeDocDetails) {
                    onChangeDocDetails({ montoDocumentoRef: lineAmount });
                  }
                  if (!fechaDocumentoRef && onChangeDocDetails) {
                    const todayStr = new Date().toISOString().slice(0, 10);
                    onChangeDocDetails({ fechaDocumentoRef: todayStr, fechaVencimientoRef: todayStr });
                  }
                }}
                className={`flex-1 py-1.5 px-3 rounded-lg text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  docMode === 'NEW_DOC'
                    ? 'bg-blue-600 text-white shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Ingresar Nueva Factura / Documento</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between text-xs text-slate-600 pb-1 border-b border-slate-100">
              <span className="font-bold flex items-center gap-1.5 text-slate-800">
                <FileCheck className="w-3.5 h-3.5 text-blue-600" />
                Nuevo Documento de Respaldo para {currentAux?.razonSocial || 'Auxiliar'}
              </span>
              <span className="text-[10px] text-slate-400">
                (Sin facturas pendientes previas)
              </span>
            </div>
          )}

          {/* C. MODO 1: FACTURAS / DEUDAS EXISTENTES */}
          {docMode === 'PENDING_DOCS' && hasExistingDocs && (
            <div className="space-y-2 animate-in fade-in">
              <div className="text-[11px] text-slate-600 flex items-center justify-between">
                <span>Seleccione una factura para rebajar su saldo o pagarla:</span>
                <button
                  type="button"
                  onClick={() => {
                    setDocMode('NEW_DOC');
                    if (!montoDocumentoRef && lineAmount > 0 && onChangeDocDetails) {
                      onChangeDocDetails({ montoDocumentoRef: lineAmount });
                    }
                  }}
                  className="text-blue-600 hover:text-blue-800 font-bold underline cursor-pointer"
                >
                  ¿Es una factura nueva? Ingrésela aquí →
                </button>
              </div>

              {/* Lista de deudas con saldo pendiente */}
              {effectivePendingDocs.length > 0 ? (
                <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                  {effectivePendingDocs.map((pDoc) => {
                    const isMatched =
                      (folioDocumentoRef && String(folioDocumentoRef) === String(pDoc.folio)) ||
                      (documentoRef && documentoRef.includes(String(pDoc.folio)));

                    return (
                      <div
                        key={pDoc.id}
                        className={`p-2.5 rounded-lg border flex items-center justify-between gap-2 text-xs transition-all ${
                          isMatched
                            ? 'bg-emerald-50 border-emerald-400 shadow-2xs ring-1 ring-emerald-400'
                            : 'bg-slate-50/70 border-slate-200 hover:bg-amber-50/40 hover:border-amber-300'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-bold text-slate-900 text-xs">
                              {pDoc.tipoLabel || 'Doc'} #{pDoc.folio}
                            </span>
                            <span
                              className={`text-[9px] font-bold px-1 rounded ${
                                pDoc.origen === 'DTE'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-purple-100 text-purple-800'
                              }`}
                            >
                              {pDoc.origen === 'DTE' ? 'DTE SII' : 'ASIENTO CONTABLE'}
                            </span>
                            {pDoc.concepto && (
                              <span className="text-[10px] text-slate-500 truncate max-w-[200px]" title={pDoc.concepto}>
                                • {pDoc.concepto}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                            {pDoc.fechaEmision ? `Emisión: ${pDoc.fechaEmision}` : ''}
                            {pDoc.fechaVencimiento ? ` • Vence: ${pDoc.fechaVencimiento}` : ''}
                            {pDoc.montoTotal > pDoc.saldoPendiente ? ` • Total Orig: $${formatCLP(pDoc.montoTotal)}` : ''}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right">
                            <div className="text-[9px] text-slate-400 font-semibold uppercase">Saldo Deuda</div>
                            <div className="font-mono font-bold text-xs text-amber-900">
                              ${formatCLP(pDoc.saldoPendiente)}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleSelectPendingDoc(pDoc)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors flex items-center gap-1 ${
                              isMatched
                                ? 'bg-emerald-600 text-white shadow-2xs'
                                : 'bg-amber-600 hover:bg-amber-700 text-white'
                            }`}
                          >
                            {isMatched ? <Check className="w-3.5 h-3.5" /> : <DollarSign className="w-3.5 h-3.5" />}
                            <span>{isMatched ? 'Asociado' : 'Asociar a este Pago'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : auxDtes.length > 0 ? (
                /* Si no hay pendingDocs pero hay DTEs del SII */
                <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                  {auxDtes.map((doc) => {
                    const isSelected = selectedDteId === doc.id;
                    return (
                      <div
                        key={doc.id}
                        onClick={() => handleDteSelected(isSelected ? null : doc)}
                        className={`p-2 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-2 text-xs ${
                          isSelected
                            ? 'bg-emerald-50 border-emerald-400 shadow-2xs'
                            : 'bg-slate-50/70 border-slate-200 hover:bg-amber-50/40 hover:border-amber-300'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-bold text-slate-900 text-xs">
                              Folio #{doc.folio}
                            </span>
                            <span className="text-[9px] font-semibold px-1 rounded bg-slate-200 text-slate-700">
                              {getDteLabel(doc.tipoDte)}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                            Emisión: {doc.fechaEmision}
                            {doc.fechaVencimiento ? ` • Vence: ${doc.fechaVencimiento}` : ''}
                          </div>
                        </div>

                        <div className="text-right shrink-0 flex items-center gap-2">
                          <div className="font-mono font-bold text-xs text-slate-900">
                            ${formatCLP(doc.montoTotal)}
                          </div>
                          <button
                            type="button"
                            className={`px-2.5 py-1 rounded text-xs font-bold ${
                              isSelected ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700 hover:bg-blue-600 hover:text-white'
                            }`}
                          >
                            {isSelected ? '✓ Imputado' : 'Asociar'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          )}

          {/* D. MODO 2: INGRESAR NUEVA FACTURA / DOCUMENTO (CLARO, MINIMALISTA, INTUITIVO) */}
          {(docMode === 'NEW_DOC' || !hasExistingDocs) && (
            <div className="space-y-3 animate-in fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* 1. Tipo de Documento */}
                <div>
                  <label className="text-[10px] font-bold text-slate-700 block mb-1">
                    Tipo de Documento:
                  </label>
                  <select
                    value={tipoDocumentoRef || 'FACTURA_ELECTRONICA_33'}
                    onChange={(e) => handleTipoDocChange(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 font-semibold text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="FACTURA_ELECTRONICA_33">Factura Electrónica (33)</option>
                    <option value="FACTURA_EXENTA_34">Factura Exenta (34)</option>
                    <option value="BOLETA_ELECTRONICA_39">Boleta Electrónica (39)</option>
                    <option value="NOTA_CREDITO_61">Nota de Crédito (61)</option>
                    <option value="NOTA_DEBITO_56">Nota de Débito (56)</option>
                    <option value="BOLETA_HONORARIOS_ELECTRONICA">Boleta de Honorarios (48)</option>
                    <option value="CONTRATO">Contrato Mercantil / Arriendo</option>
                    <option value="RENDICION_GASTOS">Rendición de Gastos (RDG)</option>
                    <option value="COMPROBANTE_BANCARIO">Comprobante Bancario</option>
                    <option value="OTRO_RESPALDO">Otro Respaldo Comercial</option>
                  </select>
                </div>

                {/* 2. Folio / N° Documento */}
                <div>
                  <label className="text-[10px] font-bold text-slate-700 block mb-1">
                    N° / Folio Documento: <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: 1540"
                    value={folioDocumentoRef || ''}
                    onChange={(e) => handleFolioChange(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono font-bold text-slate-900 focus:bg-white focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* 3. Importe Total del Documento */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-bold text-slate-700 flex items-center gap-1">
                      <DollarSign className="w-3 h-3 text-slate-500" />
                      Monto Total ($):
                    </label>
                    {lineAmount > 0 && montoDocumentoRef !== lineAmount && (
                      <button
                        type="button"
                        onClick={() => updateDetails({ montoDocumentoRef: lineAmount })}
                        className="text-[9px] font-bold text-blue-600 hover:text-blue-800 underline cursor-pointer"
                        title="Copiar monto de la partida"
                      >
                        Copiar ${formatCLP(lineAmount)}
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Ej: $400.000"
                    value={montoDocumentoRef ? Number(montoDocumentoRef).toLocaleString('es-CL') : ''}
                    onChange={(e) => {
                      const clean = e.target.value.replace(/\D/g, '');
                      updateDetails({ montoDocumentoRef: clean ? parseInt(clean, 10) : undefined });
                    }}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono font-bold text-slate-900 text-right focus:bg-white focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Fechas de Emisión y Vencimiento */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 border-t border-slate-100">
                <div>
                  <label className="text-[10px] font-semibold text-slate-700 block mb-1">
                    Fecha Emisión:
                  </label>
                  <input
                    type="date"
                    value={fechaDocumentoRef || ''}
                    onChange={(e) => {
                      const newFecha = e.target.value;
                      updateDetails({
                        fechaDocumentoRef: newFecha,
                        ...(!fechaVencimientoRef || fechaVencimientoRef === fechaDocumentoRef
                          ? { fechaVencimientoRef: newFecha }
                          : {}),
                      });
                    }}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-700 block mb-1">
                    Fecha Vencimiento (Flujo de Caja Real):
                  </label>
                  <input
                    type="date"
                    value={fechaVencimientoRef || ''}
                    onChange={(e) => updateDetails({ fechaVencimientoRef: e.target.value })}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono font-bold text-indigo-900 focus:bg-white focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Indicador de Cuadratura de Monto si aplica */}
              {montoDocumentoRef && montoDocumentoRef > 0 && lineAmount > 0 && (
                <div className="flex items-center justify-between text-[11px] bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
                  <span className="text-slate-600">
                    Total Factura: <strong>${formatCLP(montoDocumentoRef)}</strong> • Imputado en Asiento: <strong>${formatCLP(lineAmount)}</strong>
                  </span>
                  {lineAmount < montoDocumentoRef ? (
                    <span className="font-bold text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded">
                      Abono Parcial (Saldo: ${formatCLP(montoDocumentoRef - lineAmount)})
                    </span>
                  ) : lineAmount === montoDocumentoRef ? (
                    <span className="font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded flex items-center gap-0.5">
                      <Check className="w-3 h-3" /> 100% Saldado
                    </span>
                  ) : (
                    <span className="font-bold text-blue-800 bg-blue-100 px-1.5 py-0.2 rounded">
                      Excedente (${formatCLP(lineAmount - montoDocumentoRef)})
                    </span>
                  )}
                </div>
              )}

              {/* Panel Prominente de Confirmación e Imputación al Asiento */}
              <div className="p-3 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-300 rounded-xl space-y-2 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="text-xs font-bold text-emerald-950">
                      {folioDocumentoRef
                        ? `Confirmar e Imputar: ${getDocTypeSimpleLabel(tipoDocumentoRef)} F.${folioDocumentoRef}`
                        : 'Confirmar Documento en la Partida'}
                    </span>
                  </div>
                  {(montoDocumentoRef || lineAmount) ? (
                    <span className="text-xs font-mono font-bold text-emerald-900 bg-emerald-200/80 px-2 py-0.5 rounded">
                      ${formatCLP(montoDocumentoRef || lineAmount || 0)}
                    </span>
                  ) : null}
                </div>

                <p className="text-[11px] text-emerald-800">
                  {isSupplier
                    ? 'Al registrar una compra de mercaderías o factura de proveedor, la obligación se imputa al HABER:'
                    : 'Al registrar una venta o factura de cliente, el derecho de cobro se imputa al DEBE:'}
                </p>

                <div className="flex items-center gap-2 flex-wrap pt-1">
                  <button
                    type="button"
                    onClick={() => handleConfirmNewDoc(isSupplier ? 'HABER' : 'DEBE')}
                    className="flex-1 min-w-[200px] py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    title={isSupplier ? 'Confirmar e Imputar al HABER (obligación con proveedor)' : 'Confirmar e Imputar al DEBE (cuenta por cobrar)'}
                  >
                    <Check className="w-4 h-4" />
                    <span>
                      {isSupplier
                        ? `✓ Confirmar e Imputar al HABER ($${formatCLP(montoDocumentoRef || lineAmount || 0)})`
                        : `✓ Confirmar e Imputar al DEBE ($${formatCLP(montoDocumentoRef || lineAmount || 0)})`}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleConfirmNewDoc(isSupplier ? 'DEBE' : 'HABER')}
                    className="py-2 px-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-[11px] font-semibold transition-all shadow-2xs flex items-center justify-center gap-1 cursor-pointer"
                    title={isSupplier ? 'Imputar al Debe (pago a proveedor / anulación)' : 'Imputar al Haber (cobranza a cliente / abono)'}
                  >
                    <span>O imputar al {isSupplier ? 'Debe' : 'Haber'}</span>
                  </button>
                </div>
              </div>

              {/* Desplegable Opcional: Medio de Pago / Operación bancaria */}
              <div className="pt-1 border-t border-slate-100">
                {!showAdvancedOperation ? (
                  <button
                    type="button"
                    onClick={() => setShowAdvancedOperation(true)}
                    className="text-[10px] font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    <span>+ Agregar detalle opcional de medio de pago / operación (TEF, Cheque, Canje)</span>
                  </button>
                ) : (
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-2 mt-1 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-700 uppercase">
                        Detalle de Pago / Operación Comercial:
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowAdvancedOperation(false)}
                        className="text-[10px] text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        Ocultar ▲
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">
                          Tipo Operación:
                        </label>
                        <select
                          value={tipoDocumentoOperacion || 'TRANSFERENCIA_TEF'}
                          onChange={(e) => updateDetails({ tipoDocumentoOperacion: e.target.value })}
                          className="w-full text-xs bg-white border border-slate-300 rounded p-1.5 text-slate-800 font-semibold"
                        >
                          <option value="TRANSFERENCIA_TEF">Transferencia (TEF)</option>
                          <option value="CHEQUE">Cheque Girado / Cobrado</option>
                          <option value="CANJE_FACTURA">Canje de Facturas / Letras</option>
                          <option value="DEPOSITO_BANCARIO">Depósito Bancario</option>
                          <option value="VALE_VISTA">Vale Vista</option>
                          <option value="ORDEN_COMPRA">Orden de Compra (OC)</option>
                          <option value="CONTRATO">Contrato Mercantil</option>
                          <option value="OTRO">Otro Instrumento</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">
                          N° Operación / Referencia:
                        </label>
                        <input
                          type="text"
                          placeholder="Ej: TEF-9821, Canje 22"
                          value={documentoOperacion || ''}
                          onChange={(e) => updateDetails({ documentoOperacion: e.target.value })}
                          className="w-full text-xs bg-white border border-slate-300 rounded p-1.5 font-mono text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">
                          Fecha Operación:
                        </label>
                        <input
                          type="date"
                          value={fechaDocumentoOperacion || ''}
                          onChange={(e) => updateDetails({ fechaDocumentoOperacion: e.target.value })}
                          className="w-full text-xs bg-white border border-slate-300 rounded p-1.5 font-mono text-slate-800"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal de Alta Rápida de Auxiliar */}
      <CreateAuxiliaryModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSave={handleCreateAuxiliarySaved}
        initialRut={searchTerm}
        defaultTipo={defaultTipoForAccount}
      />
    </div>
  );
};
