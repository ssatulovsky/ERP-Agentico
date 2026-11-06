import React, { useState, useEffect, useRef } from 'react';
import {
  Palette,
  Upload,
  Image as ImageIcon,
  Check,
  RotateCcw,
  Printer,
  Save,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Sliders,
  Building2,
  FileCheck2,
  Shield,
  Layers,
  Sparkles,
  CreditCard,
  Eye,
  Trash2,
  FileText,
  HelpCircle,
  Download,
  AlertCircle
} from 'lucide-react';
import {
  DteDocumentLayoutConfig,
  DteLayoutPreset,
  BillingEmissionDraft,
  DteType,
  CompanyProfile,
  ClientCompany
} from '../../types';
import { DEFAULT_INVOICE_LAYOUTS, COLOR_PALETTE_PRESETS } from '../../config/defaultInvoiceLayouts';
import { InvoiceDocumentSheet } from './InvoiceDocumentSheet';

interface InvoiceLayoutDesignerProps {
  company: CompanyProfile | ClientCompany;
  currentDraft: BillingEmissionDraft;
  onClose?: () => void;
  onApplyLayout?: (layout: DteDocumentLayoutConfig) => void;
}

export const InvoiceLayoutDesigner: React.FC<InvoiceLayoutDesignerProps> = ({
  company,
  currentDraft,
  onClose,
  onApplyLayout,
}) => {
  const companyKey = `erp_dte_layout_${company.id || company.rut.replace(/[^0-9kK]/g, '')}`;

  // Cargar layout guardado en localStorage o usar el default CORPORATE
  const [layout, setLayout] = useState<DteDocumentLayoutConfig>(() => {
    try {
      const saved = localStorage.getItem(companyKey);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Error reading saved DTE layout:', e);
    }
    return DEFAULT_INVOICE_LAYOUTS.CORPORATE(company.rut, company.razonSocial);
  });

  const [activeStudioTab, setActiveStudioTab] = useState<
    'PRESETS' | 'LOGO' | 'EMISOR' | 'RECUADRO_ROJO' | 'ESTILOS' | 'COLUMNAS' | 'LEGAL_PAGOS'
  >('PRESETS');

  const [zoom, setZoom] = useState<number>(0.85);
  const [previewTipoDte, setPreviewTipoDte] = useState<DteType>(currentDraft.tipoDte || '33');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [logoInputUrl, setLogoInputUrl] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Guardar en localStorage y aplicar
  const handleSaveLayout = () => {
    try {
      const updated = {
        ...layout,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(companyKey, JSON.stringify(updated));
      setLayout(updated);
      if (onApplyLayout) {
        onApplyLayout(updated);
      }
      setSaveSuccessMsg('¡Formato de factura guardado con éxito! Se aplicará automáticamente en todas las emisiones e impresiones de esta empresa.');
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch (e: any) {
      alert(`Error al guardar diseño: ${e.message}`);
    }
  };

  // Aplicar un preset predefinido
  const handleSelectPreset = (presetKey: DteLayoutPreset) => {
    const generator = DEFAULT_INVOICE_LAYOUTS[presetKey];
    if (generator) {
      const newLayout = generator(company.rut, company.razonSocial);
      // Mantener el logo si ya fue cargado
      if (layout.logoUrl) {
        newLayout.logoUrl = layout.logoUrl;
      }
      setLayout(newLayout);
    }
  };

  // Subir imagen local de logotipo (FileReader a Base64)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona un archivo de imagen válido (PNG, JPG, SVG o WebP).');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert('El archivo supera los 2MB. Te sugerimos optimizar el logo para impresión rápida.');
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setLayout(prev => ({
          ...prev,
          logoUrl: reader.result as string,
        }));
      }
    };
    reader.readAsDataURL(file);
  };

  // Imprimir documento directamente con CSS @media print
  const handlePrintDocument = () => {
    const printStyles = document.createElement('style');
    printStyles.id = 'dte-print-override-style';
    printStyles.innerHTML = `
      @media print {
        body * {
          visibility: hidden !important;
        }
        #dte-printable-invoice, #dte-printable-invoice * {
          visibility: visible !important;
        }
        #dte-printable-invoice {
          position: fixed !important;
          left: 0 !important;
          top: 0 !important;
          width: 100% !important;
          margin: 0 !important;
          padding: 10mm !important;
          box-shadow: none !important;
          border: none !important;
        }
        @page {
          size: ${layout.paperSize === 'A4' ? 'A4' : 'letter'} portrait;
          margin: 0;
        }
      }
    `;
    document.head.appendChild(printStyles);
    window.print();
    setTimeout(() => {
      const el = document.getElementById('dte-print-override-style');
      if (el) el.remove();
    }, 1000);
  };

  return (
    <div className="bg-slate-900 text-slate-100 rounded-xl border border-slate-700/80 shadow-2xl overflow-hidden flex flex-col min-h-[820px]">
      {/* ============================================================== */}
      {/* 1. BARRA SUPERIOR DE HERRAMIENTAS DEL DISEÑADOR                */}
      {/* ============================================================== */}
      <div className="bg-[#0f172a] border-b border-slate-800 px-5 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-400 shrink-0">
            <Palette className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white tracking-tight">
                Diseñador de Formato de Factura & DTE
              </h2>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded font-mono font-semibold">
                Normativa SII Res. 11/80
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Personaliza el logotipo, tipografía, recuadro rojo oficial, datos de emisor y mérito ejecutivo de la empresa.
            </p>
          </div>
        </div>

        {/* Acciones principales de la barra */}
        <div className="flex items-center gap-2.5">
          {/* Selector de Tipo DTE para vista previa */}
          <div className="flex items-center bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs">
            <span className="text-slate-400 text-[11px] mr-1.5 font-medium">Ver como:</span>
            <select
              value={previewTipoDte}
              onChange={(e) => setPreviewTipoDte(e.target.value as DteType)}
              className="bg-transparent text-white font-semibold text-xs focus:outline-none cursor-pointer"
            >
              <option value="33" className="bg-slate-800 text-white">Factura Electrónica (33)</option>
              <option value="34" className="bg-slate-800 text-white">Factura Exenta (34)</option>
              <option value="61" className="bg-slate-800 text-white">Nota de Crédito (61)</option>
              <option value="56" className="bg-slate-800 text-white">Nota de Débito (56)</option>
              <option value="52" className="bg-slate-800 text-white">Guía de Despacho (52)</option>
              <option value="110" className="bg-slate-800 text-white">Exportación (110)</option>
              <option value="39" className="bg-slate-800 text-white">Boleta Electrónica (39)</option>
            </select>
          </div>

          {/* Controles de Zoom */}
          <div className="flex items-center bg-slate-800 border border-slate-700 rounded-lg p-0.5 text-xs">
            <button
              onClick={() => setZoom(prev => Math.max(0.6, prev - 0.1))}
              className="p-1.5 hover:bg-slate-700 rounded text-slate-300 hover:text-white cursor-pointer"
              title="Reducir Zoom"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 font-mono text-[11px] text-slate-300">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom(prev => Math.min(1.3, prev + 0.1))}
              className="p-1.5 hover:bg-slate-700 rounded text-slate-300 hover:text-white cursor-pointer"
              title="Aumentar Zoom"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoom(0.85)}
              className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white text-[10px] font-mono cursor-pointer"
              title="Restablecer Zoom"
            >
              1:1
            </button>
          </div>

          {/* Imprimir / PDF */}
          <button
            onClick={handlePrintDocument}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            title="Imprimir formato o guardar como PDF"
          >
            <Printer className="w-3.5 h-3.5 text-blue-400" />
            <span>Imprimir / PDF</span>
          </button>

          {/* Guardar Formato */}
          <button
            onClick={handleSaveLayout}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Guardar Formato</span>
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold cursor-pointer"
            >
              Cerrar
            </button>
          )}
        </div>
      </div>

      {/* Alerta de guardado exitoso */}
      {saveSuccessMsg && (
        <div className="bg-emerald-900/90 border-b border-emerald-600 px-5 py-2 text-emerald-200 text-xs flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* ============================================================== */}
      {/* 2. CUERPO PRINCIPAL: PANEL DE CONTROLES (IZQ) & PREVIEW (DER)   */}
      {/* ============================================================== */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0">
        {/* COLUMNA IZQUIERDA: CONFIGURADOR / CONTROLES (5 columnas) */}
        <div className="lg:col-span-5 border-r border-slate-800 bg-[#0b1329] flex flex-col h-[750px] overflow-hidden">
          {/* Pestañas del Estudio de Diseño */}
          <div className="flex items-center gap-1 p-2 bg-slate-900/90 border-b border-slate-800 overflow-x-auto text-[11px] font-semibold">
            <button
              onClick={() => setActiveStudioTab('PRESETS')}
              className={`px-2.5 py-1.5 rounded-md flex items-center gap-1 whitespace-nowrap transition-colors cursor-pointer ${
                activeStudioTab === 'PRESETS' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Sparkles className="w-3 h-3" />
              <span>Plantillas</span>
            </button>
            <button
              onClick={() => setActiveStudioTab('LOGO')}
              className={`px-2.5 py-1.5 rounded-md flex items-center gap-1 whitespace-nowrap transition-colors cursor-pointer ${
                activeStudioTab === 'LOGO' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <ImageIcon className="w-3 h-3" />
              <span>Logo & Marca</span>
            </button>
            <button
              onClick={() => setActiveStudioTab('EMISOR')}
              className={`px-2.5 py-1.5 rounded-md flex items-center gap-1 whitespace-nowrap transition-colors cursor-pointer ${
                activeStudioTab === 'EMISOR' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Building2 className="w-3 h-3" />
              <span>Emisor SII</span>
            </button>
            <button
              onClick={() => setActiveStudioTab('RECUADRO_ROJO')}
              className={`px-2.5 py-1.5 rounded-md flex items-center gap-1 whitespace-nowrap transition-colors cursor-pointer ${
                activeStudioTab === 'RECUADRO_ROJO' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <FileCheck2 className="w-3 h-3" />
              <span>Recuadro Rojo</span>
            </button>
            <button
              onClick={() => setActiveStudioTab('ESTILOS')}
              className={`px-2.5 py-1.5 rounded-md flex items-center gap-1 whitespace-nowrap transition-colors cursor-pointer ${
                activeStudioTab === 'ESTILOS' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Palette className="w-3 h-3" />
              <span>Colores</span>
            </button>
            <button
              onClick={() => setActiveStudioTab('COLUMNAS')}
              className={`px-2.5 py-1.5 rounded-md flex items-center gap-1 whitespace-nowrap transition-colors cursor-pointer ${
                activeStudioTab === 'COLUMNAS' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Layers className="w-3 h-3" />
              <span>Columnas</span>
            </button>
            <button
              onClick={() => setActiveStudioTab('LEGAL_PAGOS')}
              className={`px-2.5 py-1.5 rounded-md flex items-center gap-1 whitespace-nowrap transition-colors cursor-pointer ${
                activeStudioTab === 'LEGAL_PAGOS' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Shield className="w-3 h-3" />
              <span>Legal & Banco</span>
            </button>
          </div>

          {/* Área de Opciones según Tab Activo */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs select-text">
            {/* ======================================================== */}
            {/* SUB-PANEL: PLANTILLAS RÁPIDAS (PRESETS)                  */}
            {/* ======================================================== */}
            {activeStudioTab === 'PRESETS' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Plantillas de Factura Predefinidas
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Selecciona un diseño base con cumplimiento tributario chileno y personalízalo.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-2.5">
                  {[
                    {
                      id: 'CORPORATE' as DteLayoutPreset,
                      name: 'Corporativa Moderna',
                      desc: 'Encabezado azul institucional, tabla nítida, datos bancarios destacados y alta legibilidad.',
                      color: '#1e3a8a',
                      badge: 'Recomendada',
                    },
                    {
                      id: 'OFFICIAL_SII' as DteLayoutPreset,
                      name: 'Oficial SII Tradicional',
                      desc: 'Formato clásico idéntico al portal MIPYME del SII, recuadro rojo doble y bordes tradicionales.',
                      color: '#000000',
                      badge: 'MIPYME SII',
                    },
                    {
                      id: 'MINIMALIST' as DteLayoutPreset,
                      name: 'Minimalista Ejecutiva',
                      desc: 'Líneas limpias, tipografía liviana, sin bordes pesados, estilo SaaS y consultoras.',
                      color: '#0f172a',
                      badge: 'Moderna',
                    },
                    {
                      id: 'INDUSTRIAL' as DteLayoutPreset,
                      name: 'Industrial & Faena',
                      desc: 'Verde esmeralda, filas compactas, soporte para trazabilidad, normas RG 1821 y gran cantidad de ítems.',
                      color: '#065f46',
                      badge: 'Acuícola / Minera',
                    },
                    {
                      id: 'EXECUTIVE_DARK' as DteLayoutPreset,
                      name: 'Ejecutiva Dark Accent',
                      desc: 'Azul marino profundo, acento eléctrico, recuadro rojo reglamentario y acabados para auditoras.',
                      color: '#0f172a',
                      badge: 'Auditoría / Legal',
                    },
                  ].map((preset) => (
                    <div
                      key={preset.id}
                      onClick={() => handleSelectPreset(preset.id)}
                      className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                        layout.preset === preset.id
                          ? 'bg-blue-950/60 border-blue-500 shadow-sm'
                          : 'bg-slate-800/60 border-slate-700/80 hover:border-slate-500 hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3.5 h-3.5 rounded-full inline-block border border-white/20"
                            style={{ backgroundColor: preset.color }}
                          />
                          <span className="font-bold text-white text-xs">{preset.name}</span>
                        </div>
                        <span className="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded font-medium">
                          {preset.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                        {preset.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* SUB-PANEL: LOGOTIPO & MARCA                              */}
            {/* ======================================================== */}
            {activeStudioTab === 'LOGO' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Logotipo Institucional
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Sube el logo de la empresa o ingresa la URL de una imagen PNG/SVG transparente.
                  </p>
                </div>

                {/* Vista Previa del Logo Actual */}
                <div className="p-4 bg-slate-800/80 border border-slate-700 rounded-lg flex flex-col items-center justify-center min-h-[110px]">
                  {layout.logoUrl ? (
                    <div className="relative group">
                      <img
                        src={layout.logoUrl}
                        alt="Logo de la Empresa"
                        className="max-h-20 max-w-[240px] object-contain bg-white p-2 rounded"
                      />
                      <button
                        onClick={() => setLayout(prev => ({ ...prev, logoUrl: '' }))}
                        className="absolute -top-2 -right-2 p-1 bg-red-600 text-white rounded-full hover:bg-red-500 shadow cursor-pointer"
                        title="Eliminar Logotipo"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="text-center text-slate-400">
                      <ImageIcon className="w-8 h-8 mx-auto mb-1 text-slate-500" />
                      <span className="text-[11px]">Sin logotipo cargado</span>
                    </div>
                  )}
                </div>

                {/* Botón de subida de archivo */}
                <div className="space-y-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-all"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Subir Imagen desde mi Computador</span>
                  </button>
                </div>

                {/* Opción por URL */}
                <div className="space-y-1.5 pt-2 border-t border-slate-800">
                  <label className="text-[11px] font-semibold text-slate-300">
                    O pegar URL directa de imagen:
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="url"
                      value={logoInputUrl}
                      onChange={(e) => setLogoInputUrl(e.target.value)}
                      placeholder="https://miempresa.cl/logo.png"
                      className="flex-1 bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                    <button
                      onClick={() => {
                        if (logoInputUrl) {
                          setLayout(prev => ({ ...prev, logoUrl: logoInputUrl }));
                          setLogoInputUrl('');
                        }
                      }}
                      className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded font-medium cursor-pointer"
                    >
                      Cargar
                    </button>
                  </div>
                </div>

                {/* Alineación del Logo */}
                <div className="space-y-1.5 pt-2 border-t border-slate-800">
                  <label className="text-[11px] font-semibold text-slate-300">
                    Alineación del Logo:
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['left', 'center', 'right'] as const).map((pos) => (
                      <button
                        key={pos}
                        onClick={() => setLayout(prev => ({ ...prev, logoPosition: pos }))}
                        className={`py-1.5 text-center rounded border capitalize font-medium cursor-pointer ${
                          layout.logoPosition === pos
                            ? 'bg-blue-600 border-blue-500 text-white'
                            : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {pos === 'left' ? 'Izquierda' : pos === 'center' ? 'Centro' : 'Derecha'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tamaño del Logo */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-300">
                    Tamaño del Logo:
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {(['sm', 'md', 'lg', 'xl'] as const).map((sz) => (
                      <button
                        key={sz}
                        onClick={() => setLayout(prev => ({ ...prev, logoSize: sz }))}
                        className={`py-1.5 text-center rounded border uppercase font-medium cursor-pointer ${
                          layout.logoSize === sz
                            ? 'bg-blue-600 border-blue-500 text-white'
                            : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {sz}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Checkbox Mostrar Razón Social junto al Logo */}
                <div className="pt-2 border-t border-slate-800">
                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={layout.showCompanyNameWithLogo}
                      onChange={(e) => setLayout(prev => ({ ...prev, showCompanyNameWithLogo: e.target.checked }))}
                      className="rounded bg-slate-800 border-slate-700 text-blue-600"
                    />
                    <span>Mostrar Razón Social destacada junto al logotipo</span>
                  </label>
                </div>

                {/* Nombre de Fantasía */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">
                    Nombre de Fantasía / Marca Comercial:
                  </label>
                  <input
                    type="text"
                    value={layout.nombreFantasia || ''}
                    onChange={(e) => setLayout(prev => ({ ...prev, nombreFantasia: e.target.value }))}
                    placeholder="Ej: REDES DEL SUR"
                    className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* SUB-PANEL: DATOS OBLIGATORIOS DEL EMISOR (SII)           */}
            {/* ======================================================== */}
            {activeStudioTab === 'EMISOR' && (
              <div className="space-y-3">
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Datos Legales del Emisor (SII)
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Datos exigidos por ley para la validez tributaria del documento electrónico.
                  </p>
                </div>

                <div className="space-y-2">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 block">
                      R.U.T. Emisor:
                    </label>
                    <input
                      type="text"
                      value={layout.emisorRut}
                      onChange={(e) => setLayout(prev => ({ ...prev, emisorRut: e.target.value }))}
                      className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-xs text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 block">
                      Razón Social:
                    </label>
                    <input
                      type="text"
                      value={layout.emisorRazonSocial}
                      onChange={(e) => setLayout(prev => ({ ...prev, emisorRazonSocial: e.target.value }))}
                      className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 block">
                      Giro Comercial (Requerido por Ley):
                    </label>
                    <input
                      type="text"
                      value={layout.emisorGiro}
                      onChange={(e) => setLayout(prev => ({ ...prev, emisorGiro: e.target.value }))}
                      className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-xs text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-300 block">
                        Dirección Casa Matriz:
                      </label>
                      <input
                        type="text"
                        value={layout.emisorDireccion}
                        onChange={(e) => setLayout(prev => ({ ...prev, emisorDireccion: e.target.value }))}
                        className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-300 block">
                        Comuna y Ciudad:
                      </label>
                      <input
                        type="text"
                        value={layout.emisorComuna}
                        onChange={(e) => setLayout(prev => ({ ...prev, emisorComuna: e.target.value, emisorCiudad: e.target.value }))}
                        className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-xs text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 block">
                      Unidad o Dirección Regional del SII:
                    </label>
                    <input
                      type="text"
                      value={layout.emisorUnidadSii}
                      onChange={(e) => setLayout(prev => ({ ...prev, emisorUnidadSii: e.target.value }))}
                      placeholder="Ej: S.I.I. - PUERTO MONTT"
                      className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 block">
                      Código Acteco SII:
                    </label>
                    <input
                      type="text"
                      value={layout.emisorActecoTexto || ''}
                      onChange={(e) => setLayout(prev => ({ ...prev, emisorActecoTexto: e.target.value }))}
                      placeholder="Ej: 139400 - Fabricación de redes..."
                      className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-xs text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-300 block">
                        Teléfono:
                      </label>
                      <input
                        type="text"
                        value={layout.emisorTelefono || ''}
                        onChange={(e) => setLayout(prev => ({ ...prev, emisorTelefono: e.target.value }))}
                        className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-300 block">
                        Email Facturación:
                      </label>
                      <input
                        type="email"
                        value={layout.emisorEmail || ''}
                        onChange={(e) => setLayout(prev => ({ ...prev, emisorEmail: e.target.value }))}
                        className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-xs text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 block">
                      Sucursales o Plantas:
                    </label>
                    <input
                      type="text"
                      value={layout.emisorSucursalesTexto || ''}
                      onChange={(e) => setLayout(prev => ({ ...prev, emisorSucursalesTexto: e.target.value }))}
                      placeholder="Ej: Planta Puerto Montt | Taller Castro"
                      className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-xs text-white"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* SUB-PANEL: RECUADRO ROJO SII (RESOLUCIÓN EX. 11)         */}
            {/* ======================================================== */}
            {activeStudioTab === 'RECUADRO_ROJO' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Recuadro Rojo Reglamentario del SII
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Norma del SII para documentos tributarios electrónicos (Res. Ex. N° 11 / Circular 56).
                  </p>
                </div>

                {/* Grosor de Borde */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-300">
                    Grosor del Borde:
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[2, 3, 4].map((width) => (
                      <button
                        key={width}
                        onClick={() => setLayout(prev => ({ ...prev, recuadroRojoBorderWidth: width }))}
                        className={`py-1.5 text-center rounded border font-medium cursor-pointer ${
                          layout.recuadroRojoBorderWidth === width
                            ? 'bg-red-600 border-red-500 text-white'
                            : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {width}px {width === 3 ? '(Oficial)' : ''}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Estilo de Borde */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-300">
                    Estilo de Borde:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setLayout(prev => ({ ...prev, recuadroRojoBorderStyle: 'double' }))}
                      className={`py-1.5 text-center rounded border font-medium cursor-pointer ${
                        layout.recuadroRojoBorderStyle === 'double'
                          ? 'bg-red-600 border-red-500 text-white'
                          : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      Doble Línea (Tradicional)
                    </button>
                    <button
                      onClick={() => setLayout(prev => ({ ...prev, recuadroRojoBorderStyle: 'solid' }))}
                      className={`py-1.5 text-center rounded border font-medium cursor-pointer ${
                        layout.recuadroRojoBorderStyle === 'solid'
                          ? 'bg-red-600 border-red-500 text-white'
                          : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      Línea Sólida Continua
                    </button>
                  </div>
                </div>

                {/* Color del Recuadro */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-300">
                    Color del Recuadro:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={layout.recuadroRojoColor || '#dc2626'}
                      onChange={(e) => setLayout(prev => ({ ...prev, recuadroRojoColor: e.target.value }))}
                      className="w-10 h-8 rounded border border-slate-700 cursor-pointer bg-transparent"
                    />
                    <span className="font-mono text-xs text-slate-300">
                      {layout.recuadroRojoColor || '#dc2626'}
                    </span>
                    <button
                      onClick={() => setLayout(prev => ({ ...prev, recuadroRojoColor: '#dc2626' }))}
                      className="text-[11px] text-blue-400 hover:underline ml-auto cursor-pointer"
                    >
                      Rojo Oficial SII
                    </button>
                  </div>
                </div>

                {/* Prefijo del Folio */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">
                    Prefijo para el N° de Folio:
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {['N°', 'FOLIO', 'N° FOLIO'].map((prefix) => (
                      <button
                        key={prefix}
                        onClick={() => setLayout(prev => ({ ...prev, customFolioPrefix: prefix }))}
                        className={`py-1.5 text-center rounded border font-medium cursor-pointer ${
                          layout.customFolioPrefix === prefix
                            ? 'bg-red-600 border-red-500 text-white'
                            : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {prefix}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* SUB-PANEL: COLORES, TIPOGRAFÍA Y TABLAS                  */}
            {/* ======================================================== */}
            {activeStudioTab === 'ESTILOS' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Paleta de Colores & Tipografía
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Personaliza los acentos visuales y el estilo de las tablas de ítems.
                  </p>
                </div>

                {/* Paletas de Color Rápidas */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-300">
                    Paletas Sugeridas:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {COLOR_PALETTE_PRESETS.map((pal) => (
                      <button
                        key={pal.name}
                        onClick={() => setLayout(prev => ({ ...prev, primaryColor: pal.primary, accentColor: pal.accent }))}
                        className="p-2 rounded border border-slate-700 bg-slate-800/80 hover:bg-slate-700 flex items-center gap-2 cursor-pointer text-left"
                      >
                        <span
                          className="w-4 h-4 rounded-full shrink-0 border border-white/20"
                          style={{ backgroundColor: pal.primary }}
                        />
                        <span className="text-[11px] text-slate-200 font-medium truncate">
                          {pal.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Selector de Color Personalizado */}
                <div className="space-y-1.5 pt-2 border-t border-slate-800">
                  <label className="text-[11px] font-semibold text-slate-300">
                    Color Primario Personalizado:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={layout.primaryColor}
                      onChange={(e) => setLayout(prev => ({ ...prev, primaryColor: e.target.value }))}
                      className="w-10 h-8 rounded border border-slate-700 cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      value={layout.primaryColor}
                      onChange={(e) => setLayout(prev => ({ ...prev, primaryColor: e.target.value }))}
                      className="w-24 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono"
                    />
                  </div>
                </div>

                {/* Familia Tipográfica */}
                <div className="space-y-1.5 pt-2 border-t border-slate-800">
                  <label className="text-[11px] font-semibold text-slate-300">
                    Tipografía del Documento:
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'sans', label: 'Moderna (Sans)', font: 'font-sans' },
                      { id: 'serif', label: 'Clásica (Serif)', font: 'font-serif' },
                      { id: 'mono', label: 'Técnica (Mono)', font: 'font-mono' },
                    ].map((f) => (
                      <button
                        key={f.id}
                        onClick={() => setLayout(prev => ({ ...prev, fontFamily: f.id as any }))}
                        className={`py-2 px-1 text-center rounded border text-xs cursor-pointer ${f.font} ${
                          layout.fontFamily === f.id
                            ? 'bg-blue-600 border-blue-500 text-white font-bold'
                            : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Estilo de Encabezado de Tabla */}
                <div className="space-y-1.5 pt-2 border-t border-slate-800">
                  <label className="text-[11px] font-semibold text-slate-300">
                    Estilo de Encabezado de Tabla:
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'filled', label: 'Relleno Color' },
                      { id: 'outlined', label: 'Con Líneas' },
                      { id: 'clean', label: 'Minimalista' },
                    ].map((h) => (
                      <button
                        key={h.id}
                        onClick={() => setLayout(prev => ({ ...prev, headerStyle: h.id as any }))}
                        className={`py-1.5 text-center rounded border font-medium cursor-pointer ${
                          layout.headerStyle === h.id
                            ? 'bg-blue-600 border-blue-500 text-white'
                            : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {h.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Filas Alternadas (Striped) */}
                <div className="pt-2 border-t border-slate-800">
                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={layout.stripedRows}
                      onChange={(e) => setLayout(prev => ({ ...prev, stripedRows: e.target.checked }))}
                      className="rounded bg-slate-800 border-slate-700 text-blue-600"
                    />
                    <span>Filas de la tabla alternadas con color tenue (Striped)</span>
                  </label>
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* SUB-PANEL: COLUMNAS DE DETALLE DE ÍTEMS                  */}
            {/* ======================================================== */}
            {activeStudioTab === 'COLUMNAS' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Columnas Visibles en la Tabla de Ítems
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Activa o desactiva columnas adicionales según la industria o tipo de venta.
                  </p>
                </div>

                <div className="space-y-2.5">
                  <label className="flex items-center justify-between p-2.5 bg-slate-800/80 rounded border border-slate-700 cursor-pointer">
                    <div>
                      <span className="font-semibold text-white block">Código de Producto / SKU</span>
                      <span className="text-[10px] text-slate-400">Muestra la columna "Código" con el identificador del ítem</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={layout.showItemCode}
                      onChange={(e) => setLayout(prev => ({ ...prev, showItemCode: e.target.checked }))}
                      className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 bg-slate-800/80 rounded border border-slate-700 cursor-pointer">
                    <div>
                      <span className="font-semibold text-white block">Descripción Detallada</span>
                      <span className="text-[10px] text-slate-400">Texto secundario explicativo bajo el nombre del ítem</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={layout.showItemDescription}
                      onChange={(e) => setLayout(prev => ({ ...prev, showItemDescription: e.target.checked }))}
                      className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 bg-slate-800/80 rounded border border-slate-700 cursor-pointer">
                    <div>
                      <span className="font-semibold text-white block">Unidad de Medida</span>
                      <span className="text-[10px] text-slate-400">Muestra la unidad (C/U, KG, M, HORAS, etc.)</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={layout.showItemUnit}
                      onChange={(e) => setLayout(prev => ({ ...prev, showItemUnit: e.target.checked }))}
                      className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 bg-slate-800/80 rounded border border-slate-700 cursor-pointer">
                    <div>
                      <span className="font-semibold text-white block">Columna de Descuento %</span>
                      <span className="text-[10px] text-slate-400">Muestra descuentos por línea si aplican</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={layout.showItemDiscount}
                      onChange={(e) => setLayout(prev => ({ ...prev, showItemDiscount: e.target.checked }))}
                      className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 bg-slate-800/80 rounded border border-slate-700 cursor-pointer">
                    <div>
                      <span className="font-semibold text-white block">Centro de Costos Asignado</span>
                      <span className="text-[10px] text-slate-400">Imprime el nombre del centro de costos asignado al ítem</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={layout.showCostCenterTag}
                      onChange={(e) => setLayout(prev => ({ ...prev, showCostCenterTag: e.target.checked }))}
                      className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700"
                    />
                  </label>
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* SUB-PANEL: LEGALIDADES SII, LEY 19.983 & PAGOS           */}
            {/* ======================================================== */}
            {activeStudioTab === 'LEGAL_PAGOS' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Ley 19.983, Acuse de Recibo & Pagos
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Recuadro de cesión para factoring, timbre electrónico TED y datos para transferir.
                  </p>
                </div>

                {/* Recuadro de Mérito Ejecutivo Ley 19.983 */}
                <div className="p-3 bg-slate-800/80 rounded border border-slate-700 space-y-2">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="font-bold text-white">
                      Recuadro de Acuse de Recibo (Ley 19.983)
                    </span>
                    <input
                      type="checkbox"
                      checked={layout.showLey19983Cedible}
                      onChange={(e) => setLayout(prev => ({ ...prev, showLey19983Cedible: e.target.checked }))}
                      className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700"
                    />
                  </label>
                  <p className="text-[10.5px] text-slate-400 leading-tight">
                    Obligatorio para copias cedibles y operaciones de factoring conforme a los Art. 4° y 5° de la Ley 19.983.
                  </p>
                </div>

                {/* Tipo de Ejemplar */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-300">
                    Tipo de Ejemplar:
                  </label>
                  <select
                    value={layout.tipoEjemplar}
                    onChange={(e) => setLayout(prev => ({ ...prev, tipoEjemplar: e.target.value as any }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
                  >
                    <option value="ORIGINAL_CLIENTE">ORIGINAL: CLIENTE</option>
                    <option value="CEDIBLE_MERITO_EJECUTIVO">CEDIBLE CON MÉRITO EJECUTIVO (LEY 19.983)</option>
                    <option value="CEDIBLE">COPIA CEDIBLE</option>
                    <option value="TRIPLICADO_CONTROL">TRIPLICADO CONTROL TRIBUTARIO</option>
                  </select>
                </div>

                {/* Marca de Agua (Watermark) */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-300">
                    Marca de Agua en la Hoja:
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'NONE', label: 'Sin Marca' },
                      { id: 'ORIGINAL', label: 'ORIGINAL' },
                      { id: 'CEDIBLE', label: 'CEDIBLE' },
                      { id: 'MERITO_EJECUTIVO', label: 'MÉRITO EJEC.' },
                      { id: 'MUESTRA', label: 'VISTA PREVIA' },
                      { id: 'PAGADO', label: 'PAGADO' },
                    ].map((wm) => (
                      <button
                        key={wm.id}
                        onClick={() => setLayout(prev => ({ ...prev, watermark: wm.id as any }))}
                        className={`py-1.5 text-center rounded border font-medium cursor-pointer ${
                          layout.watermark === wm.id
                            ? 'bg-blue-600 border-blue-500 text-white'
                            : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {wm.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Total en Letras */}
                <div className="pt-2 border-t border-slate-800">
                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={layout.showTotalInWords}
                      onChange={(e) => setLayout(prev => ({ ...prev, showTotalInWords: e.target.checked }))}
                      className="rounded bg-slate-800 border-slate-700 text-blue-600"
                    />
                    <span>Convertir monto total automáticamente a palabras en español</span>
                  </label>
                </div>

                {/* Datos Bancarios para Transferencia */}
                <div className="space-y-1.5 pt-2 border-t border-slate-800">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-[11px] font-semibold text-slate-300">
                      Datos para Transferencia Bancaria:
                    </span>
                    <input
                      type="checkbox"
                      checked={layout.showBankDetails}
                      onChange={(e) => setLayout(prev => ({ ...prev, showBankDetails: e.target.checked }))}
                      className="rounded bg-slate-800 border-slate-700 text-blue-600"
                    />
                  </label>
                  <textarea
                    rows={2}
                    value={layout.bankDetailsText}
                    onChange={(e) => setLayout(prev => ({ ...prev, bankDetailsText: e.target.value }))}
                    placeholder="Banco, Cuenta Corriente, Titular, RUT y correo para transferencias..."
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Observaciones Comerciales */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300 block">
                    Observaciones Comerciales & Términos:
                  </label>
                  <textarea
                    rows={2}
                    value={layout.commercialNotes}
                    onChange={(e) => setLayout(prev => ({ ...prev, commercialNotes: e.target.value }))}
                    placeholder="Validez, horarios de entrega o condiciones..."
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Pie de Página Oficial */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300 block">
                    Texto Legal de Pie de Página:
                  </label>
                  <input
                    type="text"
                    value={layout.footerDisclaimer}
                    onChange={(e) => setLayout(prev => ({ ...prev, footerDisclaimer: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-xs text-white font-mono text-[10px]"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* COLUMNA DERECHA: VISTA PREVIA HOJA WYSIWYG (7 columnas) */}
        <div className="lg:col-span-7 bg-[#1e293b] p-6 overflow-auto flex items-start justify-center min-h-[750px] relative">
          <div className="shadow-2xl">
            <InvoiceDocumentSheet
              layout={layout}
              draft={currentDraft}
              company={company}
              tipoDteOverride={previewTipoDte}
              folioOverride={currentDraft.folioSugerido || 0}
              zoom={zoom}
              showWatermark={true}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
