import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Check,
  Save,
  Plus,
  Trash2,
  AlertTriangle,
  FileText,
  Calendar,
  Layers,
  DollarSign,
  Tag,
  Hash,
  AlertCircle,
  HelpCircle,
  ShieldCheck,
  FileCheck,
} from 'lucide-react';
import type { AccountingEntry, AccountingEntryLine, DteDocument, HierarchicalAccountItem, TipoDocumentoRespaldo } from '../../types';
import { formatCLP } from '../../utils/chileanAccounting';
import { isAccountCostCenterRequired } from '../../utils/accountingOrchestratorEngine';
import { SEED_COST_CENTERS } from '../../data/seedCostCenters';
import { SearchableAccountSelect } from './SearchableAccountSelect';
import { SearchableAuxiliarySelect, type AuxiliaryOption } from './SearchableAuxiliarySelect';

export interface EditAccountingEntryModalProps {
  isOpen: boolean;
  entry: AccountingEntry | null;
  accounts: HierarchicalAccountItem[];
  availableAuxiliaries?: AuxiliaryOption[];
  availableDtes?: DteDocument[];
  onClose: () => void;
  onSave: (
    id: string,
    payload: {
      fecha: string;
      concepto: string;
      documentoRef: string;
      documentoReferencia?: string;
      tipoDocumentoRef?: string;
      folioDocumentoRef?: string;
      motivoModificacion?: string;
      lineas: Array<{
        id?: string;
        codigoCuenta: string;
        nombreCuenta: string;
        debe: number;
        haber: number;
        rutAuxiliar?: string;
        nombreAuxiliar?: string;
        centroCosto?: string;
        documentoRef?: string;
        dteIdAsociado?: string;
        tipoDocumentoRef?: string;
        folioDocumentoRef?: string;
        montoDocumentoRef?: number;
        fechaDocumentoRef?: string;
        fechaVencimientoRef?: string;
        documentoOperacion?: string;
        tipoDocumentoOperacion?: string;
        fechaDocumentoOperacion?: string;
        documentoConciliacion?: string;
        tipoDocumentoConciliacion?: string;
        monedaOriginal?: string;
        montoMonedaOriginal?: number;
        tipoCambio?: number;
      }>;
    }
  ) => Promise<void>;
}

interface EditableLine extends AccountingEntryLine {
  idTemp: string;
}

export const EditAccountingEntryModal: React.FC<EditAccountingEntryModalProps> = ({
  isOpen,
  entry,
  accounts,
  availableAuxiliaries = [],
  availableDtes = [],
  onClose,
  onSave,
}) => {
  if (!isOpen || !entry) return null;

  const [fecha, setFecha] = useState(entry.fecha || '');
  const [concepto, setConcepto] = useState(entry.concepto || '');
  const [documentoRef, setDocumentoRef] = useState(entry.documento || '');
  const [tipoDocumentoRef, setTipoDocumentoRef] = useState<string>('');
  const [folioDocumentoRef, setFolioDocumentoRef] = useState<string>('');
  const [motivoModificacion, setMotivoModificacion] = useState('Corrección de referencia y/o glosa de comprobante');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Helper para mapear una línea contable con soporte camelCase y snake_case
  const mapLineDefensively = (l: any, i: number, fallbackDoc: string, fallbackFecha: string): EditableLine => {
    const docRef = l.documentoRef || l.documento_ref || fallbackDoc || '';
    const tipoRef = l.tipoDocumentoRef || l.tipo_documento_ref || '';
    const folioRef = l.folioDocumentoRef || l.folio_documento_ref || '';
    const fEmision = l.fechaDocumentoRef || l.fecha_documento_ref || fallbackFecha || '';
    const fVenc = l.fechaVencimientoRef || l.fecha_vencimiento_ref || fEmision || '';

    return {
      id: l.id,
      idTemp: `line-${i}-${Date.now()}-${Math.random()}`,
      cuentaCodigo: l.cuentaCodigo || l.cuenta_codigo || l.codigoCuenta || l.codigo_cuenta || '',
      cuentaNombre: l.cuentaNombre || l.cuenta_nombre || l.nombreCuenta || l.nombre_cuenta || '',
      debe: Number(l.debe) || 0,
      haber: Number(l.haber) || 0,
      rutAuxiliar: l.rutAuxiliar || l.rut_auxiliar || '',
      nombreAuxiliar: l.nombreAuxiliar || l.nombre_auxiliar || '',
      centroCosto: l.centroCosto || l.centro_costo || '',
      documentoRef: docRef,
      dteIdAsociado: l.dteIdAsociado || l.dte_id_asociado || '',
      tipoDocumentoRef: tipoRef,
      folioDocumentoRef: folioRef,
      montoDocumentoRef: l.montoDocumentoRef != null
        ? Number(l.montoDocumentoRef)
        : l.monto_documento_ref != null
        ? Number(l.monto_documento_ref)
        : undefined,
      fechaDocumentoRef: fEmision,
      fechaVencimientoRef: fVenc,
      documentoOperacion: l.documentoOperacion || l.documento_operacion || '',
      tipoDocumentoOperacion: l.tipoDocumentoOperacion || l.tipo_documento_operacion || '',
      fechaDocumentoOperacion: l.fechaDocumentoOperacion || l.fecha_documento_operacion || '',
      documentoConciliacion: l.documentoConciliacion || l.documento_conciliacion || docRef || '',
      tipoDocumentoConciliacion: l.tipoDocumentoConciliacion || l.tipo_documento_conciliacion || 'TRANSFERENCIA',
      monedaOriginal: l.monedaOriginal || l.moneda_original || '',
      montoMonedaOriginal: l.montoMonedaOriginal != null ? Number(l.montoMonedaOriginal) : undefined,
      tipoCambio: l.tipoCambio != null ? Number(l.tipoCambio) : undefined,
      glosa: l.glosa || '',
    };
  };

  // Inicializar líneas editables
  const [lines, setLines] = useState<EditableLine[]>(() =>
    entry.lineas.map((l, i) =>
      mapLineDefensively(l, i, entry.documento || entry.documentoReferencia || '', entry.fecha || '')
    )
  );

  useEffect(() => {
    if (entry) {
      const docRef =
        entry.documento ||
        entry.documentoReferencia ||
        (entry as any).documento_ref ||
        (entry as any).documento_referencia ||
        '';
      const tipoRef =
        entry.tipoDocumentoRef ||
        (entry as any).tipo_documento_ref ||
        (entry.lineas.find((l: any) => l.tipoDocumentoRef || l.tipo_documento_ref) as any)?.tipoDocumentoRef ||
        (entry.lineas.find((l: any) => l.tipo_documento_ref) as any)?.tipo_documento_ref ||
        '';
      const folioRef =
        entry.folioDocumentoRef ||
        (entry as any).folio_documento_ref ||
        (entry.lineas.find((l: any) => l.folioDocumentoRef || l.folio_documento_ref) as any)?.folioDocumentoRef ||
        (entry.lineas.find((l: any) => l.folio_documento_ref) as any)?.folio_documento_ref ||
        '';

      setFecha(entry.fecha || '');
      setConcepto(entry.concepto || '');
      setDocumentoRef(docRef);
      setTipoDocumentoRef(tipoRef);
      setFolioDocumentoRef(folioRef);

      setLines(
        entry.lineas.map((l, i) =>
          mapLineDefensively(l, i, docRef, entry.fecha || '')
        )
      );
      setErrorMsg(null);
    }
  }, [entry]);

  // Cálculo de totales
  const totalDebe = useMemo(() => {
    return lines.reduce((acc, l) => acc + (Number(l.debe) || 0), 0);
  }, [lines]);

  const totalHaber = useMemo(() => {
    return lines.reduce((acc, l) => acc + (Number(l.haber) || 0), 0);
  }, [lines]);

  const diferencia = useMemo(() => {
    return Math.abs(totalDebe - totalHaber);
  }, [totalDebe, totalHaber]);

  const isCuadrado = diferencia < 0.01 && totalDebe > 0;

  // Manejadores de líneas
  const handleLineChange = (index: number, field: keyof AccountingEntryLine, val: any) => {
    setLines((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  const handleAccountChange = (index: number, acc: HierarchicalAccountItem) => {
    setLines((prev) => {
      const copy = [...prev];
      const isCc = isAccountCostCenterRequired(acc, acc.nombre, accounts);
      copy[index] = {
        ...copy[index],
        cuentaCodigo: acc.codigo,
        cuentaNombre: acc.nombre,
        centroCosto: isCc && !copy[index].centroCosto ? 'CC-ADM-01' : copy[index].centroCosto,
      };
      return copy;
    });
  };

  const handleAddLine = () => {
    setLines((prev) => [
      ...prev,
      {
        idTemp: `line-${Date.now()}-${Math.random()}`,
        cuentaCodigo: '1.1.01.001',
        cuentaNombre: 'Caja Moneda Nacional',
        debe: 0,
        haber: 0,
      },
    ]);
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length <= 2) {
      setErrorMsg('Un comprobante contable debe contener al menos 2 líneas para cumplir la partida doble.');
      return;
    }
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!fecha) {
      setErrorMsg('La fecha contable es obligatoria.');
      return;
    }
    if (!concepto.trim()) {
      setErrorMsg('El concepto / glosa general del comprobante es obligatorio.');
      return;
    }
    if (!documentoRef.trim()) {
      setErrorMsg('El documento de referencia es obligatorio.');
      return;
    }
    if (lines.length < 2) {
      setErrorMsg('Debe haber al menos 2 líneas contables.');
      return;
    }
    if (!isCuadrado) {
      setErrorMsg(`El comprobante está descuadrado por $${formatCLP(diferencia)}. Total Debe ($${formatCLP(totalDebe)}) debe ser igual a Total Haber ($${formatCLP(totalHaber)}).`);
      return;
    }

    try {
      setIsSubmitting(true);
      await onSave(entry.id, {
        fecha,
        concepto: concepto.trim(),
        documentoRef: documentoRef.trim(),
        documentoReferencia: documentoRef.trim(),
        tipoDocumentoRef: tipoDocumentoRef || undefined,
        folioDocumentoRef: folioDocumentoRef || undefined,
        motivoModificacion: motivoModificacion.trim(),
        lineas: lines.map((l) => ({
          codigoCuenta: l.cuentaCodigo,
          nombreCuenta: l.cuentaNombre,
          debe: Number(l.debe) || 0,
          haber: Number(l.haber) || 0,
          rutAuxiliar: l.rutAuxiliar || undefined,
          nombreAuxiliar: l.nombreAuxiliar || undefined,
          centroCosto: l.centroCosto || undefined,
          documentoRef: l.documentoRef || documentoRef.trim(),
          dteIdAsociado: l.dteIdAsociado || undefined,
          tipoDocumentoRef: l.tipoDocumentoRef || tipoDocumentoRef || undefined,
          folioDocumentoRef: l.folioDocumentoRef || folioDocumentoRef || undefined,
          montoDocumentoRef: l.montoDocumentoRef ? Number(l.montoDocumentoRef) : undefined,
          fechaDocumentoRef: l.fechaDocumentoRef || undefined,
          fechaVencimientoRef: l.fechaVencimientoRef || undefined,
          documentoOperacion: l.documentoOperacion || undefined,
          tipoDocumentoOperacion: l.tipoDocumentoOperacion || undefined,
          fechaDocumentoOperacion: l.fechaDocumentoOperacion || undefined,
          documentoConciliacion: l.documentoConciliacion || undefined,
          tipoDocumentoConciliacion: l.tipoDocumentoConciliacion || undefined,
          monedaOriginal: l.monedaOriginal || undefined,
          montoMonedaOriginal: l.montoMonedaOriginal ? Number(l.montoMonedaOriginal) : undefined,
          tipoCambio: l.tipoCambio ? Number(l.tipoCambio) : undefined,
        })),
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al guardar los cambios del asiento contable.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl my-8 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-600/30 text-blue-400 border border-blue-500/30">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white tracking-wide">
                  Editar Comprobante de Libro Diario
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  {entry.origen || 'MANUAL'}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                  ID: {entry.id.substring(0, 13)}...
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Modifique la referencia del documento, fecha, concepto o imputaciones manteniendo la partida doble estricta.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMsg && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Atención al guardar:</p>
                <p className="mt-0.5">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* Encabezado del Asiento */}
          <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80 space-y-4">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-600" /> Metadatos del Comprobante
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Fecha */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-400" /> Fecha Contable *
                </label>
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  required
                  className="w-full text-xs font-mono font-semibold bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Documento de Referencia Principal */}
              <div className="md:col-span-2">
                <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
                  <FileText className="w-3 h-3 text-slate-400" /> Documento de Referencia *
                  <span className="text-[10px] text-slate-400 font-normal">
                    (Factura, Contrato, Rendición, N° Cheque, Cartola, etc.)
                  </span>
                </label>
                <input
                  type="text"
                  value={documentoRef}
                  onChange={(e) => setDocumentoRef(e.target.value)}
                  placeholder="Ej: Factura 12345 / Contrato Arriendo Local 2 / Rendición RDG-002"
                  required
                  className="w-full text-xs font-medium bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Tipo de Documento */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
                  <Tag className="w-3 h-3 text-slate-400" /> Tipo Respaldo
                </label>
                <select
                  value={tipoDocumentoRef}
                  onChange={(e) => setTipoDocumentoRef(e.target.value)}
                  className="w-full text-xs font-medium bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="">(Automático / General)</option>
                  <option value="FACTURA_ELECTRONICA_33">Factura Electrónica (33)</option>
                  <option value="FACTURA_EXENTA_34">Factura Exenta (34)</option>
                  <option value="BOLETA_ELECTRONICA_39">Boleta Electrónica (39)</option>
                  <option value="NOTA_CREDITO_61">Nota de Crédito (61)</option>
                  <option value="CONTRATO">Contrato Legal / Comercial</option>
                  <option value="RENDICION_GASTO">Rendición de Gastos</option>
                  <option value="CARTOLA_BANCARIA">Cartola Bancaria / TEF</option>
                  <option value="LIQUIDACION_SUELDO">Liquidación de Sueldo</option>
                  <option value="OTRO">Otro Documento No-SII</option>
                </select>
              </div>
            </div>

            {/* Concepto / Glosa General */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Concepto / Glosa General del Asiento *
              </label>
              <input
                type="text"
                value={concepto}
                onChange={(e) => setConcepto(e.target.value)}
                placeholder="Glosa descriptiva de la operación contable"
                required
                className="w-full text-xs font-medium bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Motivo de Modificación (Auditoría Forense) */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-600" /> Motivo de la Modificación
                <span className="text-[10px] text-slate-400 font-normal">
                  (Quedará registrado de forma inmutable en el log de auditoría del agente)
                </span>
              </label>
              <input
                type="text"
                value={motivoModificacion}
                onChange={(e) => setMotivoModificacion(e.target.value)}
                placeholder="Ej: Corrección de folio de factura y asignación de auxiliar correcto"
                className="w-full text-xs font-medium bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Tabla de Líneas del Asiento */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-600" /> Partidas Contables (Partida Doble)
              </div>
              <button
                type="button"
                onClick={handleAddLine}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Agregar Línea
              </button>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 text-left w-10">#</th>
                      <th className="py-2.5 px-3 text-left min-w-[280px]">Cuenta Contable *</th>
                      <th className="py-2.5 px-3 text-left min-w-[220px]">Auxiliar / Documento Ref</th>
                      <th className="py-2.5 px-3 text-right w-36">Debe ($)</th>
                      <th className="py-2.5 px-3 text-right w-36">Haber ($)</th>
                      <th className="py-2.5 px-3 text-center w-12">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {lines.map((line, idx) => {
                      const isHaber = Number(line.haber) > 0;
                      return (
                        <tr
                          key={line.idTemp}
                          className={`hover:bg-slate-50/70 transition-colors ${
                            isHaber ? 'bg-amber-50/15' : ''
                          }`}
                        >
                          <td className="py-2.5 px-3 text-slate-400 font-semibold text-center">
                            {idx + 1}
                          </td>

                          {/* Cuenta Contable */}
                          <td className="py-2.5 px-3 font-sans">
                            {(() => {
                              const accDef = accounts.find(
                                (a) =>
                                  a.codigo.trim() === line.cuentaCodigo.trim() ||
                                  a.nombre.trim().toLowerCase() === line.cuentaNombre.trim().toLowerCase()
                              );
                              const isBank = Boolean(accDef?.esConciliableBancaria) || line.cuentaCodigo.startsWith('1.1.02') || (/banco|cuenta corriente/i.test(line.cuentaNombre) && !/caja chica|efectivo/i.test(line.cuentaNombre));
                              const reqAux = !isBank && (Boolean(accDef?.requiereAuxiliarRut) || line.cuentaCodigo.startsWith('1.1.03') || line.cuentaCodigo.startsWith('2.1.01') || line.cuentaCodigo.startsWith('2.1.02') || line.cuentaCodigo.startsWith('2.1.05'));
                              const reqCc = isAccountCostCenterRequired(accDef || line.cuentaCodigo, line.cuentaNombre, accounts);

                              return (
                                <div className="space-y-1.5">
                                  <SearchableAccountSelect
                                    value={line.cuentaNombre}
                                    selectedCode={line.cuentaCodigo}
                                    accounts={accounts}
                                    onChange={(acc) => handleAccountChange(idx, acc)}
                                  />
                                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500 flex-wrap">
                                    <span className="font-mono font-bold">Código: {line.cuentaCodigo}</span>
                                    {isBank && (
                                      <span className="bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded border border-emerald-300">
                                        Banco / Conciliable
                                      </span>
                                    )}
                                    {reqAux && (
                                      <span className="bg-amber-100 text-amber-800 font-bold px-1.5 py-0.2 rounded border border-amber-300">
                                        Exige Auxiliar
                                      </span>
                                    )}
                                    {reqCc && (
                                      <span className="bg-purple-100 text-purple-800 font-bold px-1.5 py-0.2 rounded border border-purple-300">
                                        Exige CC
                                      </span>
                                    )}
                                  </div>

                                  {/* Centro de Costos si lo exige la cuenta o es de resultados */}
                                  {reqCc && (
                                    <div className="pt-1">
                                      <select
                                        value={line.centroCosto || ''}
                                        onChange={(e) => handleLineChange(idx, 'centroCosto', e.target.value)}
                                        className="w-full text-[11px] bg-purple-50/70 border border-purple-300 rounded px-2 py-1 text-purple-950 font-medium focus:outline-hidden focus:border-purple-500 font-mono"
                                      >
                                        <option value="">-- Seleccionar Centro de Costos --</option>
                                        {SEED_COST_CENTERS.map((cc) => (
                                          <option key={cc.id} value={cc.codigo}>
                                            {cc.codigo} - {cc.nombre}
                                          </option>
                                        ))}
                                        {line.centroCosto && !SEED_COST_CENTERS.some((c) => c.codigo === line.centroCosto) && (
                                          <option value={line.centroCosto}>{line.centroCosto} (Actual)</option>
                                        )}
                                      </select>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </td>

                          {/* Auxiliar, Referencia RCV y/o Referencia Bancaria */}
                          <td className="py-2.5 px-3 font-sans">
                            {(() => {
                              const accDef = accounts.find((a) => a.codigo === line.cuentaCodigo);
                              const isBank = Boolean(accDef?.esConciliableBancaria) || line.cuentaCodigo.startsWith('1.1.02') || (/banco|cuenta corriente/i.test(line.cuentaNombre) && !/caja chica|efectivo/i.test(line.cuentaNombre));
                              const reqAux = !isBank && (Boolean(accDef?.requiereAuxiliarRut) || line.cuentaCodigo.startsWith('1.1.03') || line.cuentaCodigo.startsWith('2.1.01') || line.cuentaCodigo.startsWith('2.1.02') || line.cuentaCodigo.startsWith('2.1.05'));

                              if (isBank) {
                                return (
                                  <div className="space-y-1.5 bg-emerald-50/60 p-2 rounded-lg border border-emerald-200">
                                    <div className="text-[10px] font-bold text-emerald-900 uppercase">
                                      Referencia Bancaria para Conciliación:
                                    </div>
                                    <div className="grid grid-cols-2 gap-1.5">
                                      <select
                                        value={line.tipoDocumentoConciliacion || 'TRANSFERENCIA'}
                                        onChange={(e) => handleLineChange(idx, 'tipoDocumentoConciliacion', e.target.value)}
                                        className="text-[11px] bg-white border border-emerald-300 rounded px-2 py-1 text-slate-800 font-semibold"
                                      >
                                        <option value="TRANSFERENCIA">TEF (Transferencia)</option>
                                        <option value="CHEQUE">Cheque</option>
                                        <option value="DEPOSITO">Depósito</option>
                                        <option value="CARGO_CARTOLA">Cargo Cartola</option>
                                        <option value="ABONO_CARTOLA">Abono Cartola</option>
                                      </select>
                                      <input
                                        type="text"
                                        value={line.documentoConciliacion || line.documentoRef || ''}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          handleLineChange(idx, 'documentoConciliacion', val);
                                          handleLineChange(idx, 'documentoRef', val);
                                        }}
                                        placeholder="N° Cartola / TEF"
                                        className="text-[11px] bg-white border border-emerald-300 rounded px-2 py-1 text-slate-800 font-mono font-bold"
                                      />
                                    </div>
                                    <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-emerald-200">
                                      <div>
                                        <label className="text-[9px] text-emerald-900 block font-semibold">
                                          {line.tipoDocumentoConciliacion === 'CHEQUE' ? 'F. Emisión Cheque:' : 'F. Emisión TEF:'}
                                        </label>
                                        <input
                                          type="date"
                                          value={line.fechaDocumentoRef || ''}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            handleLineChange(idx, 'fechaDocumentoRef', val);
                                            if (!line.fechaVencimientoRef || line.fechaVencimientoRef === line.fechaDocumentoRef) {
                                              handleLineChange(idx, 'fechaVencimientoRef', val);
                                            }
                                          }}
                                          className="w-full text-[10px] bg-white border border-emerald-300 rounded px-1.5 py-0.5 font-mono"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-[9px] text-emerald-900 block font-semibold">
                                          {line.tipoDocumentoConciliacion === 'CHEQUE' ? 'F. Cobro Cheque (Dif):' : 'F. Venc / TEF:'}
                                        </label>
                                        <input
                                          type="date"
                                          value={line.fechaVencimientoRef || ''}
                                          onChange={(e) => handleLineChange(idx, 'fechaVencimientoRef', e.target.value)}
                                          className="w-full text-[10px] bg-white border border-emerald-300 rounded px-1.5 py-0.5 font-mono font-bold text-emerald-950"
                                        />
                                      </div>
                                    </div>
                                    <div className="text-[9px] text-emerald-800">
                                      Se cruza contra la cartola bancaria en el módulo de Conciliación.
                                    </div>
                                  </div>
                                );
                              }

                              return (
                                <div className="space-y-1.5">
                                  <div className="grid grid-cols-2 gap-1.5">
                                    <input
                                      type="text"
                                      disabled={!reqAux}
                                      value={reqAux ? (line.rutAuxiliar || '') : ''}
                                      onChange={(e) => handleLineChange(idx, 'rutAuxiliar', e.target.value)}
                                      placeholder={reqAux ? 'RUT Auxiliar *' : 'No aplica (Sin Auxiliar)'}
                                      className={`text-[11px] rounded px-2 py-1 font-mono ${
                                        reqAux
                                          ? 'bg-amber-50/70 border border-amber-300 text-amber-950 font-bold focus:bg-white focus:outline-hidden'
                                          : 'bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed select-none'
                                      }`}
                                    />
                                    <input
                                      type="text"
                                      value={line.documentoRef || ''}
                                      onChange={(e) => handleLineChange(idx, 'documentoRef', e.target.value)}
                                      placeholder="Doc. Ref (ej: F-123)"
                                      className="text-[11px] bg-white border border-slate-200 rounded px-2 py-1 text-slate-700 focus:outline-hidden focus:border-blue-500 font-mono"
                                    />
                                  </div>

                                  {/* Detalle RCV y Fechas si maneja Auxiliar */}
                                  {reqAux && (
                                    <div className="grid grid-cols-3 gap-1 pt-1 border-t border-slate-100">
                                      <div>
                                        <label className="text-[9px] text-slate-500 block">Total Doc ($):</label>
                                        <input
                                          type="number"
                                          value={line.montoDocumentoRef != null ? line.montoDocumentoRef : ''}
                                          onChange={(e) => handleLineChange(idx, 'montoDocumentoRef', e.target.value ? Number(e.target.value) : undefined)}
                                          placeholder="119000"
                                          className="w-full text-[10px] bg-white border border-slate-200 rounded px-1.5 py-0.5 text-right font-mono font-bold text-amber-800"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-[9px] text-slate-500 block">F. Emisión:</label>
                                        <input
                                          type="date"
                                          value={line.fechaDocumentoRef || ''}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            handleLineChange(idx, 'fechaDocumentoRef', val);
                                            if (!line.fechaVencimientoRef || line.fechaVencimientoRef === line.fechaDocumentoRef) {
                                              handleLineChange(idx, 'fechaVencimientoRef', val);
                                            }
                                          }}
                                          className="w-full text-[10px] bg-white border border-slate-200 rounded px-1 py-0.5 font-mono"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-[9px] text-slate-500 block">F. Vencimiento:</label>
                                        <input
                                          type="date"
                                          value={line.fechaVencimientoRef || ''}
                                          onChange={(e) => handleLineChange(idx, 'fechaVencimientoRef', e.target.value)}
                                          className="w-full text-[10px] bg-white border border-slate-200 rounded px-1 py-0.5 font-mono font-bold text-indigo-900"
                                        />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </td>

                          {/* Debe */}
                          <td className="py-2.5 px-3 text-right">
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={line.debe === 0 ? '' : line.debe}
                              onChange={(e) => {
                                const val = Number(e.target.value) || 0;
                                handleLineChange(idx, 'debe', val);
                                if (val > 0) handleLineChange(idx, 'haber', 0);
                              }}
                              placeholder="0"
                              className="w-full text-right font-mono font-bold text-emerald-700 text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                            />
                          </td>

                          {/* Haber */}
                          <td className="py-2.5 px-3 text-right">
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={line.haber === 0 ? '' : line.haber}
                              onChange={(e) => {
                                const val = Number(e.target.value) || 0;
                                handleLineChange(idx, 'haber', val);
                                if (val > 0) handleLineChange(idx, 'debe', 0);
                              }}
                              placeholder="0"
                              className="w-full text-right font-mono font-bold text-blue-700 text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            />
                          </td>

                          {/* Botón Borrar Línea */}
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveLine(idx)}
                              disabled={lines.length <= 2}
                              title="Eliminar partida"
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {/* Totales y Cuadre */}
                  <tfoot className="bg-slate-50 font-bold border-t-2 border-slate-200">
                    <tr>
                      <td colSpan={3} className="py-3 px-4 text-right uppercase text-[11px] text-slate-700">
                        Sumas Iguales:
                      </td>
                      <td className="py-3 px-3 text-right text-emerald-700 font-mono text-xs">
                        ${formatCLP(totalDebe)}
                      </td>
                      <td className="py-3 px-3 text-right text-blue-700 font-mono text-xs">
                        ${formatCLP(totalHaber)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Banner de Estado de Cuadre */}
            <div
              className={`p-3.5 rounded-xl border flex items-center justify-between text-xs ${
                isCuadrado
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {isCuadrado ? (
                  <Check className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                )}
                <div>
                  <span className="font-bold">
                    {isCuadrado ? 'Partida Doble Cuadrada' : 'Comprobante Descuadrado'}
                  </span>
                  <span className="ml-2 font-mono text-[11px]">
                    (Debe: ${formatCLP(totalDebe)} | Haber: ${formatCLP(totalHaber)})
                  </span>
                </div>
              </div>

              {!isCuadrado && (
                <div className="font-mono font-bold text-rose-700 bg-rose-100/80 px-2.5 py-1 rounded-lg">
                  Diferencia: ${formatCLP(diferencia)}
                </div>
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!isCuadrado || isSubmitting}
              className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-xl flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              {isSubmitting ? (
                <span>Guardando...</span>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Guardar Cambios</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
