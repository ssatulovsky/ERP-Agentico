import React, { useState } from 'react';
import {
  X,
  Plus,
  Receipt,
  Upload,
  Sparkles,
  Building2,
  Briefcase,
  AlertTriangle,
  FileText,
  DollarSign,
  Tag,
  CheckCircle2,
} from 'lucide-react';
import {
  ExpenseItem,
  ExpenseReport,
  ExpenseCategory,
  ExpenseDocumentType,
  CostCenterMaster,
  ExpenseProject,
} from '../../types';
import { EXPENSE_CATEGORIES_CONFIG, validateChileanRut, formatCLP } from '../../utils/expenseManagementAgent';

interface AddExpenseItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (item: Omit<ExpenseItem, 'id' | 'createdAt'>) => void;
  report: ExpenseReport;
  costCenters: CostCenterMaster[];
  projects: ExpenseProject[];
}

export const AddExpenseItemModal: React.FC<AddExpenseItemModalProps> = ({
  isOpen,
  onClose,
  onAdd,
  report,
  costCenters,
  projects,
}) => {
  const [fecha, setFecha] = useState(new Date().toISOString().substring(0, 10));
  const [tipoDocumento, setTipoDocumento] = useState<ExpenseDocumentType>('BOLETA_ELECTRONICA');
  const [folioDocumento, setFolioDocumento] = useState('');
  const [proveedorRut, setProveedorRut] = useState('');
  const [proveedorRazonSocial, setProveedorRazonSocial] = useState('');
  const [categoria, setCategoria] = useState<ExpenseCategory>('ALIMENTACION');
  const [descripcionGlosa, setDescripcionGlosa] = useState('');

  const [montoTotalClp, setMontoTotalClp] = useState<number>(0);
  const [montoNeto, setMontoNeto] = useState<number>(0);
  const [montoIva, setMontoIva] = useState<number>(0);
  const [montoExento, setMontoExento] = useState<number>(0);

  const [centroCostoId, setCentroCostoId] = useState(report.centroCostoId || costCenters[0]?.id || '');
  const [proyectoId, setProyectoId] = useState(report.proyectoId || '');
  const [esGastoRechazadoArt21, setEsGastoRechazadoArt21] = useState(false);

  // Vista previa de imagen / ticket digital
  const [previewName, setPreviewName] = useState('');
  const [isOcrScanning, setIsOcrScanning] = useState(false);

  if (!isOpen) return null;

  // Actualizar montos según tipo de documento (Factura 33 desglosa IVA 19%, Boletas son brutas)
  const handleTotalChange = (total: number) => {
    setMontoTotalClp(total);
    if (tipoDocumento === 'FACTURA_ELECTRONICA_33') {
      const neto = Math.round(total / 1.19);
      const iva = total - neto;
      setMontoNeto(neto);
      setMontoIva(iva);
      setMontoExento(0);
    } else if (tipoDocumento === 'FACTURA_EXENTA_34' || tipoDocumento === 'TICKET_PEAJE') {
      setMontoNeto(0);
      setMontoIva(0);
      setMontoExento(total);
    } else {
      // Boleta o recibo: el total es el gasto deducible pero sin desglose de crédito fiscal F29
      setMontoNeto(total);
      setMontoIva(0);
      setMontoExento(0);
    }
  };

  // Simulación inteligente de OCR con escáner de boleta móvil tipo RindeGastos
  const handleSimulateOcr = () => {
    setIsOcrScanning(true);
    setTimeout(() => {
      const ocrSamples = [
        {
          folio: 'B-774910',
          rut: '99.520.000-7',
          razonSocial: 'Compañía de Petróleos de Chile COPEC S.A.',
          categoria: 'COMBUSTIBLE' as ExpenseCategory,
          glosa: 'Combustible Diesel traslado obra terreno',
          total: 42500,
          tipo: 'BOLETA_ELECTRONICA' as ExpenseDocumentType,
          archivo: 'ticket_copec_42500.jpg',
        },
        {
          folio: '94812',
          rut: '76.819.330-2',
          razonSocial: 'Hotel & Cabañas Bosque Nativo Puerto Montt',
          categoria: 'ALOJAMIENTO' as ExpenseCategory,
          glosa: 'Hospedaje 1 noche técnico en terreno',
          total: 59500,
          tipo: 'FACTURA_ELECTRONICA_33' as ExpenseDocumentType,
          archivo: 'factura_hotel_puertomontt.pdf',
        },
        {
          folio: 'B-19402',
          rut: '78.291.002-1',
          razonSocial: 'Restaurant Don Pacho y Cía Ltda',
          categoria: 'ALIMENTACION' as ExpenseCategory,
          glosa: 'Almuerzo menú ejecutivo con cliente en terreno',
          total: 18500,
          tipo: 'BOLETA_ELECTRONICA' as ExpenseDocumentType,
          archivo: 'boleta_restaurante_donpacho.jpg',
        },
      ];

      const chosen = ocrSamples[Math.floor(Math.random() * ocrSamples.length)];
      setFolioDocumento(chosen.folio);
      setProveedorRut(chosen.rut);
      setProveedorRazonSocial(chosen.razonSocial);
      setCategoria(chosen.categoria);
      setDescripcionGlosa(chosen.glosa);
      setTipoDocumento(chosen.tipo);
      setPreviewName(chosen.archivo);

      handleTotalChange(chosen.total);
      setIsOcrScanning(false);
    }, 600);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!folioDocumento.trim() || !proveedorRazonSocial.trim() || montoTotalClp <= 0) return;

    const catConfig = EXPENSE_CATEGORIES_CONFIG[categoria];
    const selectedCc = costCenters.find((c) => c.id === centroCostoId);
    const selectedPry = projects.find((p) => p.id === proyectoId);

    onAdd({
      expenseReportId: report.id,
      empresaId: report.empresaId,
      fecha,
      tipoDocumento,
      folioDocumento: folioDocumento.trim(),
      proveedorRut: proveedorRut.trim() || 'SIN_RUT',
      proveedorRazonSocial: proveedorRazonSocial.trim(),
      categoria,
      descripcionGlosa: descripcionGlosa.trim() || `${catConfig.label} - ${proveedorRazonSocial.trim()}`,
      montoNeto,
      montoIva,
      montoExento,
      montoTotalClp,
      monedaOriginal: 'CLP',
      montoOriginal: montoTotalClp,
      tipoCambio: 1,
      centroCostoId,
      centroCostoCodigo: selectedCc?.codigo || report.centroCostoCodigo,
      proyectoId,
      proyectoCodigo: selectedPry?.codigo || report.proyectoCodigo,
      cuentaContableCodigo: catConfig.defaultAccountCode,
      cuentaContableNombre: catConfig.defaultAccountName,
      comprobanteArchivoNombre: previewName || 'comprobante_digital.jpg',
      esGastoRechazadoArt21,
      validadoPorAgente: true,
      observacionAgente: 'Comprobante verificado preliminarmente por Agente RindeGastos.',
    });

    onClose();
  };

  const isRutValid = validateChileanRut(proveedorRut);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-700 via-teal-700 to-slate-900 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl border border-white/20">
              <Receipt className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Ingresar Comprobante / Gasto
                <span className="text-xs bg-emerald-500/40 text-emerald-100 font-mono px-2 py-0.5 rounded-full border border-emerald-300/30">
                  {report.folio}
                </span>
              </h3>
              <p className="text-xs text-emerald-200">
                Captura digital de boletas, facturas y tickets con imputación contable
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-emerald-200 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra Rápida OCR */}
        <div className="bg-emerald-50 px-6 py-2.5 border-b border-emerald-100 flex items-center justify-between">
          <span className="text-xs text-emerald-900 font-medium flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-emerald-600 animate-pulse" />
            Asistente RindeGastos OCR: captura boleta desde foto o ticket
          </span>
          <button
            type="button"
            onClick={handleSimulateOcr}
            disabled={isOcrScanning}
            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {isOcrScanning ? 'Escaneando ticket...' : 'Simular Captura OCR'}
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Tipo de Documento</label>
              <select
                value={tipoDocumento}
                onChange={(e) => {
                  setTipoDocumento(e.target.value as ExpenseDocumentType);
                  handleTotalChange(montoTotalClp);
                }}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              >
                <option value="BOLETA_ELECTRONICA">Boleta Electrónica</option>
                <option value="FACTURA_ELECTRONICA_33">Factura Electrónica (DTE 33)</option>
                <option value="FACTURA_EXENTA_34">Factura Exenta (DTE 34)</option>
                <option value="BOLETA_HONORARIOS">Boleta de Honorarios (BHE)</option>
                <option value="TICKET_PEAJE">Ticket Peaje / TAG</option>
                <option value="RECIBO_MOVILIZACION">Recibo de Movilización</option>
                <option value="INVOICE_EXTERIOR">Invoice Exterior</option>
                <option value="OTRO">Otro Comprobante</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                N° de Folio / Comprobante <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={folioDocumento}
                onChange={(e) => setFolioDocumento(e.target.value)}
                placeholder="Ej: B-48192 o 91283"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Fecha Emisión</label>
              <input
                type="date"
                required
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Proveedor */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                <span>RUT Proveedor (Emisor)</span>
                {proveedorRut && (
                  <span className={`text-[10px] font-bold ${isRutValid ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {isRutValid ? '✓ RUT Válido SII' : '⚠ Mod11 No Válido'}
                  </span>
                )}
              </label>
              <input
                type="text"
                value={proveedorRut}
                onChange={(e) => setProveedorRut(e.target.value)}
                placeholder="76.128.490-2"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Razón Social / Comercio <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={proveedorRazonSocial}
                onChange={(e) => setProveedorRazonSocial(e.target.value)}
                placeholder="Ej: Copec S.A. / Hotel Castro"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Categoría y Glosa */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Categoría del Gasto</label>
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value as ExpenseCategory)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              >
                {Object.entries(EXPENSE_CATEGORIES_CONFIG).map(([key, cfg]) => (
                  <option key={key} value={key}>
                    {cfg.label} ({cfg.defaultAccountCode})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Descripción / Glosa Detallada <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={descripcionGlosa}
                onChange={(e) => setDescripcionGlosa(e.target.value)}
                placeholder="Ej: Almuerzo de trabajo con supervisor de planta"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Montos y Desglose */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Monto Total ($ CLP) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  step="1"
                  value={montoTotalClp || ''}
                  onChange={(e) => handleTotalChange(Number(e.target.value))}
                  placeholder="0"
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-mono font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Monto Neto ($)</label>
                <input
                  type="number"
                  value={montoNeto}
                  onChange={(e) => setMontoNeto(Number(e.target.value))}
                  className="w-full px-3 py-1.5 text-xs bg-slate-100 border border-slate-200 rounded-lg font-mono text-slate-700"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  IVA Crédito Fiscal (19%)
                </label>
                <input
                  type="number"
                  value={montoIva}
                  onChange={(e) => setMontoIva(Number(e.target.value))}
                  className={`w-full px-3 py-1.5 text-xs border rounded-lg font-mono ${
                    montoIva > 0 ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-bold' : 'bg-slate-100 border-slate-200 text-slate-700'
                  }`}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Exento ($)</label>
                <input
                  type="number"
                  value={montoExento}
                  onChange={(e) => setMontoExento(Number(e.target.value))}
                  className="w-full px-3 py-1.5 text-xs bg-slate-100 border border-slate-200 rounded-lg font-mono text-slate-700"
                />
              </div>
            </div>

            {tipoDocumento === 'FACTURA_ELECTRONICA_33' && montoIva > 0 && (
              <p className="text-[10px] text-emerald-700 mt-2 flex items-center gap-1 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                IVA Crédito Fiscal de {formatCLP(montoIva)} se contabilizará en cuenta 1.1.05.001 para imputar en F29.
              </p>
            )}
          </div>

          {/* Imputación Centro de Costo & Proyecto */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                Imputar a Centro de Costo
              </label>
              <select
                value={centroCostoId}
                onChange={(e) => setCentroCostoId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              >
                {costCenters.map((cc) => (
                  <option key={cc.id} value={cc.id}>
                    {cc.codigo} - {cc.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-emerald-600" />
                Imputar a Proyecto
              </label>
              <select
                value={proyectoId}
                onChange={(e) => setProyectoId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              >
                <option value="">-- Mismo de la Rendición ({report.proyectoCodigo || 'General'}) --</option>
                {projects.map((pry) => (
                  <option key={pry.id} value={pry.id}>
                    {pry.codigo} - {pry.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Comprobante Adjunto Digital y Art. 21 LIR */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-white rounded-lg border border-slate-200 text-slate-500">
                <FileText className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-800 block">Soporte Digital Adjunto</span>
                <span className="text-[10px] text-slate-500 font-mono">
                  {previewName || 'ticket_digital_adjunto.jpg'}
                </span>
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={esGastoRechazadoArt21}
                onChange={(e) => setEsGastoRechazadoArt21(e.target.checked)}
                className="rounded text-rose-600 focus:ring-rose-500"
              />
              <span className="text-[11px] font-semibold text-rose-700">
                Marcar como Gasto Rechazado Art. 21 LIR (Sin respaldo legal)
              </span>
            </label>
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Agregar Comprobante
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
