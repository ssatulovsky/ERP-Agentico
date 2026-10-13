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
  UserPlus,
  Receipt,
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
  onApplyDocAmountToLine?: (amount: number) => void;
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
  accountCode = '',
  onSelectAuxiliary,
  onSelectDocument,
  onChangeManualDocRef,
  onChangeDocDetails,
  onAddNewAuxiliary,
  onApplyDocAmountToLine,
  className = '',
  disabled = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [docFilterTerm, setDocFilterTerm] = useState('');
  const [activeDocTab, setActiveDocTab] = useState<'DTE_SII' | 'CONTRATO_RDG' | 'BANCO_TEF' | 'MANUAL'>('DTE_SII');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Sub-estados para tabs
  const [contractType, setContractType] = useState('Contrato de Arriendo');
  const [contractNum, setContractNum] = useState(folioDocumentoRef || '');
  const [contractTotal, setContractTotal] = useState<number | undefined>(montoDocumentoRef);
  const [bankOpType, setBankOpType] = useState('Transferencia TEF');
  const [bankOpRef, setBankOpRef] = useState(documentoOperacion || folioDocumentoRef || '');
  const [bankOpTotal, setBankOpTotal] = useState<number | undefined>(montoDocumentoRef);

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
        tipo: accountCode.startsWith('2.1') ? 'PROVEEDOR' : 'CLIENTE',
      }
    );
  }, [normSelectedRut, availableAuxiliaries, selectedRut, accountCode]);

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

  // Auxiliares filtrados en el buscador general
  const filteredAuxiliaries = useMemo(() => {
    if (!searchTerm.trim()) {
      return availableAuxiliaries.slice(0, 30);
    }
    const term = searchTerm.toLowerCase().trim();
    const cleanTerm = term.replace(/[\.\-\s]/g, '');

    return availableAuxiliaries.filter((aux) => {
      const rutClean = normRut(aux.rut).toLowerCase();
      const name = (aux.razonSocial || '').toLowerCase();
      return rutClean.includes(cleanTerm) || name.includes(term);
    });
  }, [availableAuxiliaries, searchTerm]);

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

  // Helper para tipo de DTE
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
      const tipoLabel =
        doc.tipoDte === '33'
          ? 'Factura Electrónica'
          : doc.tipoDte === '34'
          ? 'Factura Exenta'
          : doc.tipoDte === '61'
          ? 'Nota de Crédito'
          : doc.tipoDte === '56'
          ? 'Nota de Débito'
          : 'DTE';

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
    } else {
      if (onChangeDocDetails) {
        onChangeDocDetails({
          documentoRef: '',
          folioDocumentoRef: '',
          montoDocumentoRef: undefined,
          fechaDocumentoRef: undefined,
          fechaVencimientoRef: undefined,
        });
      }
    }
  };

  const defaultTipoForAccount = accountCode.startsWith('2.1') ? 'PROVEEDOR' : 'CLIENTE';

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
              onClick={() => {
                onSelectAuxiliary('', '');
                onSelectDocument(null);
                setSearchTerm('');
                setIsDropdownOpen(true);
              }}
              className="text-[11px] text-amber-800 hover:text-amber-950 underline font-semibold cursor-pointer px-1.5 py-1 rounded hover:bg-amber-200/50"
              title="Cambiar auxiliar seleccionado"
            >
              Cambiar Auxiliar
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

            {/* Botón Prominente para Crear Auxiliar si no existe */}
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="px-2.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1 shrink-0 cursor-pointer"
              title="Registrar nuevo auxiliar en el sistema"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>+ Nuevo Auxiliar</span>
            </button>
          </div>

          {/* Desplegable de Resultados de Búsqueda */}
          {isDropdownOpen && (
            <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-300 rounded-xl shadow-xl max-h-64 overflow-y-auto divide-y divide-slate-100 animate-in fade-in duration-100">
              {/* Opción Rápida de Crear Auxiliar */}
              <div className="p-2 bg-amber-50/70 border-b border-amber-200 flex items-center justify-between text-xs">
                <span className="text-[11px] text-amber-900 font-medium">¿El auxiliar no figura en el padrón?</span>
                <button
                  type="button"
                  onClick={() => {
                    setIsDropdownOpen(false);
                    setIsCreateModalOpen(true);
                  }}
                  className="font-bold text-amber-800 hover:text-amber-950 underline flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> Crear nuevo auxiliar ahora
                </button>
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

      {/* 2. INDIVIDUALIZACIÓN Y SELECCIÓN DE DOCUMENTOS DE RESPALDO (DTEs, CONTRATOS, RENDICIONES, TEF) */}
      {normSelectedRut && (
        <div className="bg-white border border-amber-200 rounded-lg p-2.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-950 flex items-center gap-1.5">
              <FileCheck className="w-3.5 h-3.5 text-amber-700" />
              Documento de Respaldo e Importe Total:
            </span>
            <div className="flex items-center gap-1 text-[10px]">
              <span className="text-slate-500 font-medium">
                {auxDtes.length} DTE{auxDtes.length === 1 ? '' : 's'} SII registrados
              </span>
            </div>
          </div>

          {/* BLOQUE DE DOCUMENTOS CON SALDO PENDIENTE (DEUDAS ANTERIORES / ASIENTOS PREVIOS / DTES) */}
          {effectivePendingDocs.length > 0 && (
            <div className="bg-amber-50/90 border border-amber-300 rounded-lg p-2.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-950 flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5 text-amber-700" />
                  Documentos con Saldo Pendiente de este Auxiliar ({effectivePendingDocs.length}):
                </span>
                <span className="text-[9px] text-amber-900 font-bold bg-amber-200/80 px-2 py-0.5 rounded uppercase tracking-wider">
                  Cartera Viva / Saldos Anteriores
                </span>
              </div>
              <p className="text-[10px] text-amber-800">
                Seleccione el documento que origina la obligación para asociar la aplicación de pago y su saldo:
              </p>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {effectivePendingDocs.map((pDoc) => {
                  const isMatched =
                    (folioDocumentoRef && String(folioDocumentoRef) === String(pDoc.folio)) ||
                    (documentoRef && documentoRef.includes(String(pDoc.folio)));

                  return (
                    <div
                      key={pDoc.id}
                      className={`p-2 rounded-lg border flex items-center justify-between gap-2 text-xs transition-all ${
                        isMatched
                          ? 'bg-emerald-50 border-emerald-400 shadow-2xs ring-1 ring-emerald-400'
                          : 'bg-white border-amber-200 hover:border-amber-400'
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
                            <span className="text-[10px] text-slate-600 truncate max-w-[200px]" title={pDoc.concepto}>
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
                          <div className="text-[9px] text-slate-500 font-semibold uppercase">Saldo Deuda</div>
                          <div className="font-mono font-bold text-xs text-amber-900">
                            ${formatCLP(pDoc.saldoPendiente)}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
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
                          }}
                          className={`px-2.5 py-1 rounded text-xs font-bold cursor-pointer transition-colors flex items-center gap-1 ${
                            isMatched
                              ? 'bg-emerald-600 text-white shadow-2xs'
                              : 'bg-amber-600 hover:bg-amber-700 text-white'
                          }`}
                        >
                          {isMatched ? <Check className="w-3.5 h-3.5" /> : <DollarSign className="w-3.5 h-3.5" />}
                          <span>{isMatched ? 'Asociado a Pago' : 'Asociar a este Pago'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Selector de Tipología de Documento */}
          <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg text-[10px] font-semibold text-slate-600">
            <button
              type="button"
              onClick={() => setActiveDocTab('DTE_SII')}
              className={`flex-1 py-1 px-1.5 rounded-md text-center transition-all cursor-pointer ${
                activeDocTab === 'DTE_SII'
                  ? 'bg-white text-blue-900 shadow-2xs font-bold border border-slate-200'
                  : 'hover:text-slate-900'
              }`}
            >
              DTEs SII ({auxDtes.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveDocTab('CONTRATO_RDG')}
              className={`flex-1 py-1 px-1.5 rounded-md text-center transition-all cursor-pointer ${
                activeDocTab === 'CONTRATO_RDG'
                  ? 'bg-white text-indigo-900 shadow-2xs font-bold border border-slate-200'
                  : 'hover:text-slate-900'
              }`}
            >
              Contrato / RDG
            </button>
            <button
              type="button"
              onClick={() => setActiveDocTab('BANCO_TEF')}
              className={`flex-1 py-1 px-1.5 rounded-md text-center transition-all cursor-pointer ${
                activeDocTab === 'BANCO_TEF'
                  ? 'bg-white text-emerald-900 shadow-2xs font-bold border border-slate-200'
                  : 'hover:text-slate-900'
              }`}
            >
              Comprobante / TEF
            </button>
          </div>

          {/* TAB 1: DTEs ELECTRÓNICOS DEL SII */}
          {activeDocTab === 'DTE_SII' && (
            <div className="space-y-2 animate-in fade-in">
              {auxDtes.length > 0 ? (
                <div className="space-y-2">
                  {auxDtes.length > 2 && (
                    <div className="relative">
                      <Search className="w-3 h-3 absolute left-2 top-2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Filtrar DTEs por Folio (ej: 4501), fecha o monto..."
                        value={docFilterTerm}
                        onChange={(e) => setDocFilterTerm(e.target.value)}
                        className="w-full text-xs pl-6 pr-2 py-1 bg-slate-50 border border-slate-200 rounded-md text-slate-700 focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                      />
                    </div>
                  )}

                  {/* Lista individualizada de comprobantes DTE */}
                  <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-100">
                    {filteredAuxDtes.map((doc) => {
                      const isSelected = selectedDteId === doc.id;
                      const isPending = doc.estadoPago === 'PENDIENTE' || !doc.estadoPago;

                      return (
                        <div
                          key={doc.id}
                          onClick={() => handleDteSelected(isSelected ? null : doc)}
                          className={`pt-1.5 first:pt-0 p-2 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-2 text-xs ${
                            isSelected
                              ? 'bg-emerald-50 border-emerald-400 shadow-2xs'
                              : 'bg-slate-50/60 border-slate-200 hover:bg-amber-50/50 hover:border-amber-300'
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
                              <span
                                className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                  isPending
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {doc.estadoPago || 'PENDIENTE'}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                              Emisión: {doc.fechaEmision}
                              {doc.fechaVencimiento ? ` • Vence: ${doc.fechaVencimiento}` : ''}
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <div className="font-mono font-bold text-xs text-slate-900">
                              ${formatCLP(doc.montoTotal)}
                            </div>
                            <div className="text-[10px] font-bold">
                              {isSelected ? (
                                <span className="text-emerald-700 flex items-center gap-0.5 justify-end">
                                  <Check className="w-3 h-3" /> Imputado
                                </span>
                              ) : (
                                <span className="text-slate-400 group-hover:text-amber-700">Seleccionar</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="pt-1 flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={() => handleDteSelected(null)}
                      className={`text-[11px] font-semibold cursor-pointer transition-colors ${
                        !selectedDteId
                          ? 'text-amber-900 font-bold underline'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      🔘 Imputación general (sin DTE SII enlazado)
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-2.5 bg-slate-50 rounded-lg text-xs text-slate-600 space-y-1">
                  <p className="font-semibold text-slate-700">No hay DTEs del SII emitidos para este auxiliar.</p>
                  <p className="text-[11px] text-slate-500">
                    Si el respaldo es un <strong>Contrato</strong>, <strong>Rendición de Gastos</strong> o <strong>Comprobante Bancario</strong>, use las pestañas superiores o ingrese los datos a continuación.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CONTRATOS, RENDICIONES (RDG) Y DOCUMENTOS LABORALES */}
          {activeDocTab === 'CONTRATO_RDG' && (
            <div className="space-y-2 p-2.5 bg-indigo-50/50 border border-indigo-200 rounded-lg text-xs animate-in fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-indigo-900 block mb-0.5">Tipo Instrumento:</label>
                  <select
                    value={contractType}
                    onChange={(e) => {
                      setContractType(e.target.value);
                      const fullRef = `${e.target.value} ${contractNum ? `#${contractNum}` : ''}`.trim();
                      if (onChangeManualDocRef) onChangeManualDocRef(fullRef);
                      if (onChangeDocDetails) {
                        onChangeDocDetails({
                          documentoRef: fullRef,
                          tipoDocumentoRef: 'CONTRATO',
                          folioDocumentoRef: contractNum,
                          montoDocumentoRef: contractTotal,
                        });
                      }
                    }}
                    className="w-full text-xs bg-white border border-indigo-300 rounded px-2 py-1 text-slate-800"
                  >
                    <option value="Contrato de Arriendo">Contrato de Arriendo (IFRS 16)</option>
                    <option value="Contrato de Servicios">Contrato de Servicios</option>
                    <option value="Contrato de Mutuo">Contrato de Mutuo / Financiero</option>
                    <option value="Rendición de Gastos">Rendición de Gastos (RDG)</option>
                    <option value="Caja Chica">Caja Chica / Fondo Fijo</option>
                    <option value="Liquidación de Sueldo">Liquidación de Sueldo</option>
                    <option value="Finiquito Notarial">Finiquito Laboral</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-indigo-900 block mb-0.5">Folio / N° Identificador:</label>
                  <input
                    type="text"
                    placeholder="Ej: CTR-2026-44 o RDG-004..."
                    value={contractNum}
                    onChange={(e) => {
                      setContractNum(e.target.value);
                      const fullRef = `${contractType} #${e.target.value}`.trim();
                      if (onChangeManualDocRef) onChangeManualDocRef(fullRef);
                      if (onChangeDocDetails) {
                        onChangeDocDetails({
                          documentoRef: fullRef,
                          tipoDocumentoRef: 'CONTRATO',
                          folioDocumentoRef: e.target.value,
                          montoDocumentoRef: contractTotal,
                        });
                      }
                    }}
                    className="w-full text-xs bg-white border border-indigo-300 rounded px-2 py-1 text-slate-800 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-indigo-900 block mb-0.5">Importe Total Documento ($):</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Ej: $119.000"
                    value={contractTotal ? Number(contractTotal).toLocaleString('es-CL') : ''}
                    onChange={(e) => {
                      const clean = e.target.value.replace(/\D/g, '');
                      const num = clean ? parseInt(clean, 10) : undefined;
                      setContractTotal(num);
                      const fullRef = `${contractType} #${contractNum}`.trim();
                      if (onChangeDocDetails) {
                        onChangeDocDetails({
                          documentoRef: fullRef,
                          tipoDocumentoRef: 'CONTRATO',
                          folioDocumentoRef: contractNum,
                          montoDocumentoRef: num,
                        });
                      }
                    }}
                    className="w-full text-xs bg-white border border-indigo-300 rounded px-2 py-1 text-slate-800 font-mono font-bold text-right"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: COMPROBANTE BANCARIO / TRANSFERENCIA TEF / CANJE */}
          {activeDocTab === 'BANCO_TEF' && (
            <div className="space-y-2 p-2.5 bg-emerald-50/50 border border-emerald-200 rounded-lg text-xs animate-in fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-emerald-900 block mb-0.5">Medio de Operación:</label>
                  <select
                    value={bankOpType}
                    onChange={(e) => {
                      setBankOpType(e.target.value);
                      const fullRef = `${e.target.value} ${bankOpRef ? `Op #${bankOpRef}` : ''}`.trim();
                      if (onChangeManualDocRef) onChangeManualDocRef(fullRef);
                      if (onChangeDocDetails) {
                        onChangeDocDetails({
                          documentoRef: fullRef,
                          tipoDocumentoRef: 'COMPROBANTE_BANCARIO',
                          folioDocumentoRef: bankOpRef,
                          montoDocumentoRef: bankOpTotal,
                          documentoOperacion: bankOpRef,
                          tipoDocumentoOperacion: e.target.value.toUpperCase(),
                        });
                      }
                    }}
                    className="w-full text-xs bg-white border border-emerald-300 rounded px-2 py-1 text-slate-800"
                  >
                    <option value="Transferencia TEF">Transferencia Electrónica (TEF)</option>
                    <option value="Depósito en Cuenta Corriente">Depósito Bancario</option>
                    <option value="Canje Factura">Canje de Facturas (Compensación)</option>
                    <option value="Pago en Efectivo">Pago en Efectivo (Caja)</option>
                    <option value="Cheque Bancario">Cheque Girado / Cobrado</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-emerald-900 block mb-0.5">N° Operación / Referencia:</label>
                  <input
                    type="text"
                    placeholder="Ej: TEF-889104, 22, 60, 80..."
                    value={bankOpRef}
                    onChange={(e) => {
                      setBankOpRef(e.target.value);
                      const fullRef = `${bankOpType} Op #${e.target.value}`.trim();
                      if (onChangeManualDocRef) onChangeManualDocRef(fullRef);
                      if (onChangeDocDetails) {
                        onChangeDocDetails({
                          documentoRef: fullRef,
                          tipoDocumentoRef: 'COMPROBANTE_BANCARIO',
                          folioDocumentoRef: e.target.value,
                          montoDocumentoRef: bankOpTotal,
                          documentoOperacion: e.target.value,
                          tipoDocumentoOperacion: bankOpType.toUpperCase(),
                          documentoConciliacion: e.target.value,
                          tipoDocumentoConciliacion: 'TRANSFERENCIA',
                        });
                      }
                    }}
                    className="w-full text-xs bg-white border border-emerald-300 rounded px-2 py-1 text-slate-800 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-emerald-900 block mb-0.5">Importe Total Documento ($):</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Ej: $119.000"
                    value={bankOpTotal ? Number(bankOpTotal).toLocaleString('es-CL') : ''}
                    onChange={(e) => {
                      const clean = e.target.value.replace(/\D/g, '');
                      const num = clean ? parseInt(clean, 10) : undefined;
                      setBankOpTotal(num);
                      const fullRef = `${bankOpType} Op #${bankOpRef}`.trim();
                      if (onChangeDocDetails) {
                        onChangeDocDetails({
                          documentoRef: fullRef,
                          tipoDocumentoRef: 'COMPROBANTE_BANCARIO',
                          folioDocumentoRef: bankOpRef,
                          montoDocumentoRef: num,
                          documentoOperacion: bankOpRef,
                          tipoDocumentoOperacion: bankOpType.toUpperCase(),
                        });
                      }
                    }}
                    className="w-full text-xs bg-white border border-emerald-300 rounded px-2 py-1 text-slate-800 font-mono font-bold text-right"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 3. RESUMEN DE IDENTIFICACIÓN: ESTRUCTURA RCV COMPLETA DEL DOCUMENTO Y OPERACIÓN */}
          <div className="pt-2 border-t border-slate-200 space-y-2.5">
            {/* Respaldo RCV: Tipo, Folio, Importe Total, Fecha Emisión y Fecha Vencimiento */}
            <div className="space-y-1.5 bg-slate-50/70 p-2 rounded-lg border border-slate-200">
              <span className="text-[10px] font-bold text-slate-800 uppercase tracking-wide block">
                Estructura de Documento de Respaldo (RCV / SII / Mercantil)
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {/* Tipo de Documento de Referencia */}
                <div>
                  <label className="text-[10px] font-bold text-slate-700 block mb-0.5">
                    Tipo Doc. Referencia:
                  </label>
                  <select
                    value={tipoDocumentoRef || 'FACTURA_ELECTRONICA_33'}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (onChangeDocDetails) {
                        onChangeDocDetails({
                          tipoDocumentoRef: val,
                          documentoRef: `${val} F.${folioDocumentoRef || '1'}`,
                        });
                      }
                    }}
                    className="w-full text-xs bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-semibold"
                  >
                    <option value="FACTURA_ELECTRONICA_33">Factura Electrónica (33)</option>
                    <option value="FACTURA_EXENTA_34">Factura Exenta (34)</option>
                    <option value="BOLETA_ELECTRONICA_39">Boleta Electrónica (39)</option>
                    <option value="NOTA_CREDITO_61">Nota de Crédito (61)</option>
                    <option value="NOTA_DEBITO_56">Nota de Débito (56)</option>
                    <option value="CANJE_FACTURA">Canje de Facturas</option>
                    <option value="CONTRATO">Contrato Mercantil / Arriendo</option>
                    <option value="RENDICION_GASTOS">Rendición de Gastos (RDG)</option>
                    <option value="DOCUMENTO_LABORAL">Documento Laboral / Finiquito</option>
                    <option value="OTRO_RESPALDO">Otro Respaldo Comercial</option>
                  </select>
                </div>

                {/* N° / Folio Documento */}
                <div>
                  <label className="text-[10px] font-bold text-slate-700 block mb-0.5">
                    N° / Folio Doc. Referencia:
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: 123"
                    value={folioDocumentoRef || ''}
                    onChange={(e) => {
                      const fol = e.target.value;
                      const full = `${tipoDocumentoRef || 'Doc'} F.${fol}`;
                      if (onChangeManualDocRef) onChangeManualDocRef(full);
                      if (onChangeDocDetails) {
                        onChangeDocDetails({
                          folioDocumentoRef: fol,
                          documentoRef: full,
                        });
                      }
                    }}
                    className="w-full text-xs bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-mono font-bold"
                  />
                </div>

                {/* Importe Total del Documento */}
                <div>
                  <div className="flex items-center justify-between mb-0.5">
                    <label className="text-[10px] font-bold text-amber-900 flex items-center gap-1">
                      <DollarSign className="w-3 h-3 text-amber-700" />
                      Importe Total Documento ($):
                    </label>
                    {montoDocumentoRef && onApplyDocAmountToLine && (
                      <button
                        type="button"
                        onClick={() => onApplyDocAmountToLine(montoDocumentoRef)}
                        className="text-[9px] font-bold text-blue-700 hover:text-blue-900 underline cursor-pointer"
                        title="Copiar este importe a la columna Debe o Haber de la partida"
                      >
                        Copiar a partida
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Ej: $119.000"
                    value={montoDocumentoRef !== undefined && montoDocumentoRef !== null && montoDocumentoRef > 0 ? Number(montoDocumentoRef).toLocaleString('es-CL') : ''}
                    onChange={(e) => {
                      const clean = e.target.value.replace(/\D/g, '');
                      const num = clean ? parseInt(clean, 10) : undefined;
                      if (onChangeDocDetails) {
                        onChangeDocDetails({
                          montoDocumentoRef: num,
                        });
                      }
                    }}
                    className="w-full text-xs bg-amber-50/80 border border-amber-300 rounded px-2 py-1 text-amber-950 font-mono font-bold text-right focus:bg-white"
                  />
                </div>
              </div>

              {/* Fechas del Documento: Emisión y Vencimiento (Cruciales para RCV y Flujo de Caja) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-200">
                <div>
                  <label className="text-[10px] font-semibold text-slate-700 block mb-0.5">
                    Fecha Emisión Documento:
                  </label>
                  <input
                    type="date"
                    value={fechaDocumentoRef || ''}
                    onChange={(e) => {
                      const newFecha = e.target.value;
                      if (onChangeDocDetails) {
                        onChangeDocDetails({
                          fechaDocumentoRef: newFecha,
                          ...(!fechaVencimientoRef || fechaVencimientoRef === fechaDocumentoRef
                            ? { fechaVencimientoRef: newFecha }
                            : {}),
                        });
                      }
                    }}
                    className="w-full text-xs bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-700 block mb-0.5">
                    Fecha Vencimiento Documento (Flujo de Caja Real):
                  </label>
                  <input
                    type="date"
                    value={fechaVencimientoRef || ''}
                    onChange={(e) => {
                      if (onChangeDocDetails) {
                        onChangeDocDetails({ fechaVencimientoRef: e.target.value });
                      }
                    }}
                    className="w-full text-xs bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-mono font-bold text-indigo-900"
                  />
                </div>
              </div>
            </div>

            {/* Badges de Estado del Documento vs Saldo de Línea */}
            {montoDocumentoRef && montoDocumentoRef > 0 && lineAmount > 0 && (
              <div className="flex items-center justify-between text-[10px] bg-slate-50 px-2.5 py-1 rounded border border-slate-200">
                <span className="text-slate-600">
                  Total Documento: <strong>${formatCLP(montoDocumentoRef)}</strong> • Imputado en Asiento: <strong>${formatCLP(lineAmount)}</strong>
                </span>
                {lineAmount < montoDocumentoRef ? (
                  <span className="font-bold text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded">
                    Abono Parcial (Saldo Restante: ${formatCLP(montoDocumentoRef - lineAmount)})
                  </span>
                ) : lineAmount === montoDocumentoRef ? (
                  <span className="font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded">
                    ✓ Imputación Total (100% Saldado)
                  </span>
                ) : (
                  <span className="font-bold text-blue-700 bg-blue-100 px-1.5 py-0.2 rounded">
                    Excedente / Sobrepago
                  </span>
                )}
              </div>
            )}

            {/* Documento de Operación (Canje 22, Contrato, HES, Pago Efectivo 60) */}
            <div className="bg-slate-50/70 p-2 rounded-lg border border-slate-200 space-y-1.5">
              <span className="text-[10px] font-bold text-slate-800 uppercase tracking-wide block">
                Documento de Operación (Canje / Contrato / Instrumento Comercial)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">
                    Tipo Doc. Operación (Listbox):
                  </label>
                  <select
                    value={tipoDocumentoOperacion || 'CANJE_FACTURA'}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (onChangeDocDetails) {
                        onChangeDocDetails({ tipoDocumentoOperacion: val });
                      }
                    }}
                    className="w-full text-xs bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-semibold"
                  >
                    <option value="CANJE_FACTURA">Canje de Facturas / Letras</option>
                    <option value="CONTRATO">Contrato Mercantil / Arriendo</option>
                    <option value="ORDEN_COMPRA">Orden de Compra (OC)</option>
                    <option value="HES">Hoja de Entrada de Servicios (HES)</option>
                    <option value="PAGARE">Pagaré Notarial / Bancario</option>
                    <option value="VALE_VISTA">Vale Vista</option>
                    <option value="ANTICIPO">Anticipo de Fondos</option>
                    <option value="CESION_FACTORING">Cesión Factoring</option>
                    <option value="PAGO_DIRECTO">Pago Directo / Caja</option>
                    <option value="OTRO">Otro Instrumento de Operación</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">
                    N° / Folio Operación:
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: 22, 60, CTR-90"
                    value={documentoOperacion || ''}
                    onChange={(e) => {
                      if (onChangeDocDetails) {
                        onChangeDocDetails({ documentoOperacion: e.target.value });
                      }
                    }}
                    className="w-full text-xs bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">
                    Fecha Doc. Operación:
                  </label>
                  <input
                    type="date"
                    value={fechaDocumentoOperacion || ''}
                    onChange={(e) => {
                      if (onChangeDocDetails) {
                        onChangeDocDetails({ fechaDocumentoOperacion: e.target.value });
                      }
                    }}
                    className="w-full text-xs bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-mono"
                  />
                </div>
              </div>
            </div>
          </div>
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
