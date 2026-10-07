import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  Download,
  Palette,
  Sparkles,
  Check,
  RotateCcw,
  Sliders,
  Eye,
  Type,
  Hash,
  Layers,
  X,
  Building2,
  Table,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import {
  CashFlowExcelThemeConfig,
  CashFlowExcelFont,
  CashFlowExcelNumberFormat,
  CashFlowExcelNegativeFormat,
  CompanyProfile,
} from '../../types';
import {
  EXCEL_PRESET_THEMES,
  MatrixExportData,
  generateStyledCashFlowExcel,
  downloadBlobAsFile,
} from '../../utils/cashFlowExcelStylingEngine';

interface CashFlowExcelDesignerModalProps {
  isOpen: boolean;
  onClose: () => void;
  company: CompanyProfile;
  matrixData: MatrixExportData;
}

export const CashFlowExcelDesignerModal: React.FC<CashFlowExcelDesignerModalProps> = ({
  isOpen,
  onClose,
  company,
  matrixData,
}) => {
  // Estado del tema actual editado en el diseñador
  const [currentTheme, setCurrentTheme] = useState<CashFlowExcelThemeConfig>(
    EXCEL_PRESET_THEMES.NAVY_CORPORATE
  );
  const [selectedPresetId, setSelectedPresetId] = useState<string>('NAVY_CORPORATE');
  const [activeTab, setActiveTab] = useState<'PRESETS' | 'CUSTOM' | 'STRUCTURE'>('PRESETS');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);

  // Selector de presets rápidos
  const handleSelectPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    if (EXCEL_PRESET_THEMES[presetId]) {
      setCurrentTheme({ ...EXCEL_PRESET_THEMES[presetId] });
    }
  };

  // Modificar propiedades individuales
  const updateThemeProperty = <K extends keyof CashFlowExcelThemeConfig>(
    key: K,
    value: CashFlowExcelThemeConfig[K]
  ) => {
    setCurrentTheme((prev) => ({
      ...prev,
      [key]: value,
    }));
    setSelectedPresetId('CUSTOM_USER');
  };

  // Restablecer valores
  const handleResetToDefault = () => {
    handleSelectPreset('NAVY_CORPORATE');
  };

  // Generar y descargar el archivo Excel
  const handleDownloadExcel = async () => {
    try {
      setIsGenerating(true);
      const blob = await generateStyledCashFlowExcel({
        company,
        theme: currentTheme,
        matrixData,
      });

      const dateStr = matrixData.baseDateStr || new Date().toISOString().split('T')[0];
      const fileName = `Flujo_Caja_Disenado_${matrixData.daysColumns.length}Dias_${company.rut.replace(/[^a-zA-Z0-9]/g, '')}_${dateStr}.xlsx`;
      downloadBlobAsFile(blob, fileName);

      setDownloadSuccess(true);
      setTimeout(() => {
        setDownloadSuccess(false);
      }, 4000);
    } catch (err) {
      console.error('Error al generar Excel con diseño gráfico:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  // Formateador numérico para la vista previa
  const formatSampleNumber = (val: number) => {
    const isNegative = val < 0;
    const absVal = Math.abs(val);

    let formattedBase = '';
    if (currentTheme.numberFormat === 'CLP_NO_DECIMALS') {
      formattedBase = `$ ${absVal.toLocaleString('es-CL')}`;
    } else if (currentTheme.numberFormat === 'CLP_WITH_DECIMALS') {
      formattedBase = `$ ${absVal.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } else if (currentTheme.numberFormat === 'USD_STANDARD') {
      formattedBase = `US$ ${absVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } else if (currentTheme.numberFormat === 'EUR_STANDARD') {
      formattedBase = `€ ${absVal.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    if (isNegative) {
      if (currentTheme.negativeFormat === 'PARENTHESIS_RED') {
        return <span style={{ color: '#E11D48' }}>({formattedBase})</span>;
      }
      if (currentTheme.negativeFormat === 'MINUS_RED') {
        return <span style={{ color: '#E11D48' }}>-{formattedBase}</span>;
      }
      return <span>-{formattedBase}</span>;
    }

    return <span>{formattedBase}</span>;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* 1. CABECERA DEL MODAL */}
        <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/20 rounded-xl border border-indigo-400/30 text-indigo-300">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  Diseñador Gráfico de Planilla Excel
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 uppercase tracking-wider">
                  Nativo XLSX • Con Estilos Reales
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Personaliza la paleta cromática, cabeceras, colores y formatos para la proyección de {matrixData.daysColumns.length} días diarios antes de exportar.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleDownloadExcel}
              disabled={isGenerating}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                  <span>Compilando XLSX...</span>
                </>
              ) : downloadSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-950" />
                  <span>¡Descarga Exitosa!</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Descargar Excel Diseñado</span>
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 2. CUERPO: PANELES DIVIDIDOS (HERRAMIENTAS IZQUIERDA + PREVISUALIZADOR DERECHA) */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden min-h-0">
          {/* PANEL IZQUIERDO: CONTROLES DE DISEÑO */}
          <div className="lg:col-span-5 border-r border-slate-200 bg-slate-50/50 flex flex-col overflow-y-auto">
            {/* Tabs de Configuración */}
            <div className="flex border-b border-slate-200 bg-white px-4 pt-3 shrink-0 gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('PRESETS')}
                className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'PRESETS'
                    ? 'border-indigo-600 text-indigo-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Paletas Corporativas</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('CUSTOM')}
                className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'CUSTOM'
                    ? 'border-indigo-600 text-indigo-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Colores al Detalle</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('STRUCTURE')}
                className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'STRUCTURE'
                    ? 'border-indigo-600 text-indigo-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Table className="w-3.5 h-3.5" />
                <span>Estructura & Formato</span>
              </button>
            </div>

            <div className="p-4 space-y-4 flex-1">
              {/* TAB 1: PALETAS PREESTABLECIDAS */}
              {activeTab === 'PRESETS' && (
                <div className="space-y-3">
                  <div className="text-xs text-slate-500 font-medium">
                    Selecciona una paleta profesional recomendada por auditores contables:
                  </div>

                  {Object.values(EXCEL_PRESET_THEMES).map((preset) => {
                    const isSelected = selectedPresetId === preset.id;
                    return (
                      <div
                        key={preset.id}
                        onClick={() => handleSelectPreset(preset.id)}
                        className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer bg-white relative ${
                          isSelected
                            ? 'border-indigo-600 shadow-md ring-2 ring-indigo-100'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-900">{preset.name}</span>
                              {isSelected && (
                                <span className="p-0.5 rounded-full bg-indigo-600 text-white">
                                  <Check className="w-3 h-3" />
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                              {preset.description}
                            </p>
                          </div>
                          <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                            {preset.fontFamily}
                          </span>
                        </div>

                        {/* Muestras de color del tema */}
                        <div className="flex items-center gap-1.5 mt-2.5 pt-2.5 border-t border-slate-100">
                          <span className="text-[10px] text-slate-400 font-medium mr-1">Paleta:</span>
                          <div
                            className="w-5 h-5 rounded-md border border-slate-300 shadow-2xs"
                            style={{ backgroundColor: preset.headerBgColor }}
                            title="Cabecera Principal"
                          />
                          <div
                            className="w-5 h-5 rounded-md border border-slate-300 shadow-2xs"
                            style={{ backgroundColor: preset.kpiBannerBgColor }}
                            title="KPI Banner"
                          />
                          <div
                            className="w-5 h-5 rounded-md border border-slate-300 shadow-2xs"
                            style={{ backgroundColor: preset.ingresosSectionColor }}
                            title="Ingresos"
                          />
                          <div
                            className="w-5 h-5 rounded-md border border-slate-300 shadow-2xs"
                            style={{ backgroundColor: preset.egresosSectionColor }}
                            title="Egresos"
                          />
                          <div
                            className="w-5 h-5 rounded-md border border-slate-300 shadow-2xs"
                            style={{ backgroundColor: preset.saldosAcumRowBgColor }}
                            title="Saldo Arrastrado Final"
                          />
                          <div
                            className="w-5 h-5 rounded-md border border-slate-300 shadow-2xs"
                            style={{ backgroundColor: preset.summaryRowBgColor }}
                            title="Resumen Diarios"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* TAB 2: PERSONALIZACIÓN DETALLADA (COLOR PICKERS) */}
              {activeTab === 'CUSTOM' && (
                <div className="space-y-4 bg-white p-4 rounded-xl border border-slate-200">
                  <div className="text-xs font-bold text-slate-800 flex items-center gap-2">
                    <Palette className="w-4 h-4 text-indigo-600" />
                    <span>Ajuste Cromático Individual de Secciones</span>
                  </div>

                  {/* 1. Cabecera */}
                  <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-100">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                        Fondo Cabecera
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={currentTheme.headerBgColor}
                          onChange={(e) => updateThemeProperty('headerBgColor', e.target.value)}
                          className="w-8 h-8 rounded-lg border border-slate-300 cursor-pointer p-0.5"
                        />
                        <input
                          type="text"
                          value={currentTheme.headerBgColor}
                          onChange={(e) => updateThemeProperty('headerBgColor', e.target.value)}
                          className="w-20 px-2 py-1 text-xs border border-slate-200 rounded font-mono uppercase"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                        Texto Cabecera
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={currentTheme.headerTextColor}
                          onChange={(e) => updateThemeProperty('headerTextColor', e.target.value)}
                          className="w-8 h-8 rounded-lg border border-slate-300 cursor-pointer p-0.5"
                        />
                        <input
                          type="text"
                          value={currentTheme.headerTextColor}
                          onChange={(e) => updateThemeProperty('headerTextColor', e.target.value)}
                          className="w-20 px-2 py-1 text-xs border border-slate-200 rounded font-mono uppercase"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 2. Banner KPIs */}
                  <div className="pb-3 border-b border-slate-100">
                    <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                      Fondo Tarjetas KPI Ejecutivas
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={currentTheme.kpiBannerBgColor}
                        onChange={(e) => updateThemeProperty('kpiBannerBgColor', e.target.value)}
                        className="w-8 h-8 rounded-lg border border-slate-300 cursor-pointer p-0.5"
                      />
                      <input
                        type="text"
                        value={currentTheme.kpiBannerBgColor}
                        onChange={(e) => updateThemeProperty('kpiBannerBgColor', e.target.value)}
                        className="w-24 px-2 py-1 text-xs border border-slate-200 rounded font-mono uppercase"
                      />
                    </div>
                  </div>

                  {/* 3. Sección Ingresos */}
                  <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-100">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                        Barra Ingresos
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={currentTheme.ingresosSectionColor}
                          onChange={(e) => updateThemeProperty('ingresosSectionColor', e.target.value)}
                          className="w-8 h-8 rounded-lg border border-slate-300 cursor-pointer p-0.5"
                        />
                        <input
                          type="text"
                          value={currentTheme.ingresosSectionColor}
                          onChange={(e) => updateThemeProperty('ingresosSectionColor', e.target.value)}
                          className="w-20 px-2 py-1 text-xs border border-slate-200 rounded font-mono uppercase"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                        Fondo Fila Ingreso
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={currentTheme.ingresosRowBgColor}
                          onChange={(e) => updateThemeProperty('ingresosRowBgColor', e.target.value)}
                          className="w-8 h-8 rounded-lg border border-slate-300 cursor-pointer p-0.5"
                        />
                        <input
                          type="text"
                          value={currentTheme.ingresosRowBgColor}
                          onChange={(e) => updateThemeProperty('ingresosRowBgColor', e.target.value)}
                          className="w-20 px-2 py-1 text-xs border border-slate-200 rounded font-mono uppercase"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 4. Sección Egresos */}
                  <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-100">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                        Barra Egresos
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={currentTheme.egresosSectionColor}
                          onChange={(e) => updateThemeProperty('egresosSectionColor', e.target.value)}
                          className="w-8 h-8 rounded-lg border border-slate-300 cursor-pointer p-0.5"
                        />
                        <input
                          type="text"
                          value={currentTheme.egresosSectionColor}
                          onChange={(e) => updateThemeProperty('egresosSectionColor', e.target.value)}
                          className="w-20 px-2 py-1 text-xs border border-slate-200 rounded font-mono uppercase"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                        Fondo Fila Egreso
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={currentTheme.egresosRowBgColor}
                          onChange={(e) => updateThemeProperty('egresosRowBgColor', e.target.value)}
                          className="w-8 h-8 rounded-lg border border-slate-300 cursor-pointer p-0.5"
                        />
                        <input
                          type="text"
                          value={currentTheme.egresosRowBgColor}
                          onChange={(e) => updateThemeProperty('egresosRowBgColor', e.target.value)}
                          className="w-20 px-2 py-1 text-xs border border-slate-200 rounded font-mono uppercase"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 5. Saldos Arrastrados Finales */}
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                      Fila Saldos Arrastrados de Cierre
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={currentTheme.saldosAcumRowBgColor}
                        onChange={(e) => updateThemeProperty('saldosAcumRowBgColor', e.target.value)}
                        className="w-8 h-8 rounded-lg border border-slate-300 cursor-pointer p-0.5"
                      />
                      <input
                        type="text"
                        value={currentTheme.saldosAcumRowBgColor}
                        onChange={(e) => updateThemeProperty('saldosAcumRowBgColor', e.target.value)}
                        className="w-24 px-2 py-1 text-xs border border-slate-200 rounded font-mono uppercase"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: FORMATO Y ESTRUCTURA DE LA PLANILLA */}
              {activeTab === 'STRUCTURE' && (
                <div className="space-y-4 bg-white p-4 rounded-xl border border-slate-200">
                  {/* Tipografía */}
                  <div>
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-2">
                      <Type className="w-4 h-4 text-indigo-600" />
                      <span>Fuente Tipográfica de la Hoja</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['Calibri', 'Arial', 'Segoe UI', 'Aptos', 'Trebuchet MS'] as CashFlowExcelFont[]).map(
                        (font) => (
                          <button
                            key={font}
                            type="button"
                            onClick={() => updateThemeProperty('fontFamily', font)}
                            className={`p-2 rounded-lg border text-left text-xs font-medium cursor-pointer transition-all ${
                              currentTheme.fontFamily === font
                                ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 font-bold'
                                : 'border-slate-200 hover:border-slate-300 text-slate-700'
                            }`}
                          >
                            <span style={{ fontFamily: font }}>{font}</span>
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  {/* Formato Numérico */}
                  <div className="pt-3 border-t border-slate-100">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-2">
                      <Hash className="w-4 h-4 text-indigo-600" />
                      <span>Formato de Moneda</span>
                    </label>
                    <div className="space-y-1.5">
                      <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer text-xs">
                        <input
                          type="radio"
                          name="numFmt"
                          checked={currentTheme.numberFormat === 'CLP_NO_DECIMALS'}
                          onChange={() => updateThemeProperty('numberFormat', 'CLP_NO_DECIMALS')}
                          className="text-indigo-600"
                        />
                        <div>
                          <strong className="font-semibold text-slate-900">Pesos Chilenos Estándar</strong>
                          <span className="block text-[11px] text-slate-500 font-mono">$ 1.250.000 (sin decimales)</span>
                        </div>
                      </label>

                      <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer text-xs">
                        <input
                          type="radio"
                          name="numFmt"
                          checked={currentTheme.numberFormat === 'CLP_WITH_DECIMALS'}
                          onChange={() => updateThemeProperty('numberFormat', 'CLP_WITH_DECIMALS')}
                          className="text-indigo-600"
                        />
                        <div>
                          <strong className="font-semibold text-slate-900">Pesos con Centavos</strong>
                          <span className="block text-[11px] text-slate-500 font-mono">$ 1.250.000,00</span>
                        </div>
                      </label>

                      <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer text-xs">
                        <input
                          type="radio"
                          name="numFmt"
                          checked={currentTheme.numberFormat === 'USD_STANDARD'}
                          onChange={() => updateThemeProperty('numberFormat', 'USD_STANDARD')}
                          className="text-indigo-600"
                        />
                        <div>
                          <strong className="font-semibold text-slate-900">Dólares Americanos (USD)</strong>
                          <span className="block text-[11px] text-slate-500 font-mono">US$ 1,250,000.00</span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Formato de Negativos */}
                  <div className="pt-3 border-t border-slate-100">
                    <label className="text-xs font-bold text-slate-800 block mb-2">
                      Presentación de Negativos (Egresos)
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => updateThemeProperty('negativeFormat', 'PARENTHESIS_RED')}
                        className={`p-2 rounded-lg border text-left text-xs cursor-pointer transition-all ${
                          currentTheme.negativeFormat === 'PARENTHESIS_RED'
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-bold'
                            : 'border-slate-200 text-slate-700'
                        }`}
                      >
                        <span className="text-rose-600 font-mono">($ 250.000)</span>
                        <span className="block text-[10px] text-slate-500">Paréntesis Rojo</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => updateThemeProperty('negativeFormat', 'MINUS_RED')}
                        className={`p-2 rounded-lg border text-left text-xs cursor-pointer transition-all ${
                          currentTheme.negativeFormat === 'MINUS_RED'
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-bold'
                            : 'border-slate-200 text-slate-700'
                        }`}
                      >
                        <span className="text-rose-600 font-mono">-$ 250.000</span>
                        <span className="block text-[10px] text-slate-500">Signo Menos Rojo</span>
                      </button>
                    </div>
                  </div>

                  {/* Toggles de Maquetación */}
                  <div className="pt-3 border-t border-slate-100 space-y-2.5">
                    <label className="text-xs font-bold text-slate-800 block">
                      Opciones Avanzadas de Hoja
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={currentTheme.enableKpiCards}
                        onChange={(e) => updateThemeProperty('enableKpiCards', e.target.checked)}
                        className="rounded text-indigo-600"
                      />
                      <span>Incluir Banner de Tarjetas KPI en la cabecera</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={currentTheme.enableCompanyHeader}
                        onChange={(e) => updateThemeProperty('enableCompanyHeader', e.target.checked)}
                        className="rounded text-indigo-600"
                      />
                      <span>Incluir Razón Social, RUT y fecha en fila 1</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={currentTheme.enableZebraStripes}
                        onChange={(e) => updateThemeProperty('enableZebraStripes', e.target.checked)}
                        className="rounded text-indigo-600"
                      />
                      <span>Filas Cebra alternadas para lectura descansada</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={currentTheme.enableDoubleUnderlineTotals}
                        onChange={(e) => updateThemeProperty('enableDoubleUnderlineTotals', e.target.checked)}
                        className="rounded text-indigo-600"
                      />
                      <span>Borde doble contable de cierre en totales</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={currentTheme.enableFreezePanes}
                        onChange={(e) => updateThemeProperty('enableFreezePanes', e.target.checked)}
                        className="rounded text-indigo-600"
                      />
                      <span>Inmovilizar paneles (fijar columnas de Concepto)</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={currentTheme.includeFlatMovementsSheet}
                        onChange={(e) => updateThemeProperty('includeFlatMovementsSheet', e.target.checked)}
                        className="rounded text-indigo-600"
                      />
                      <span>Incluir Hoja 2 con Detalle Plano (para Tablas Dinámicas)</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Botón de restablecer */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleResetToDefault}
                  className="w-full py-2 px-3 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restablecer a Valores Predeterminados</span>
                </button>
              </div>
            </div>
          </div>

          {/* PANEL DERECHO: PREVISUALIZADOR GRÁFICO WYSIWYG EN TIEMPO REAL */}
          <div className="lg:col-span-7 flex flex-col bg-slate-100/70 overflow-hidden">
            {/* Barra superior de la vista previa */}
            <div className="px-4 py-2.5 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-slate-800">
                  Previsualización en Vivo de la Planilla Excel
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  (Render nativo idéntico al archivo .xlsx descargable)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  {currentTheme.fontFamily} • {currentTheme.numberFormat.replace('_', ' ')}
                </span>
              </div>
            </div>

            {/* Canvas de Previsualización Tipo Excel */}
            <div className="flex-1 p-4 overflow-auto">
              <div
                className="bg-white rounded-lg shadow-md border border-slate-300 p-4 space-y-3 min-w-[620px]"
                style={{ fontFamily: currentTheme.fontFamily }}
              >
                {/* 1. Header de Empresa */}
                {currentTheme.enableCompanyHeader && (
                  <div
                    className="p-3 rounded-lg shadow-2xs text-white"
                    style={{
                      backgroundColor: currentTheme.headerBgColor,
                      color: currentTheme.headerTextColor,
                    }}
                  >
                    <div className="font-bold text-sm tracking-wide">
                      {company.razonSocial.toUpperCase()} • RUT: {company.rut}
                    </div>
                    <div className="text-[10px] text-slate-200 opacity-90 mt-0.5">
                      MATRIZ DE TESORERÍA & FLUJO DE CAJA PROYECTADO • FECHA BASE: {matrixData.baseDateStr} • ESCENARIO: {matrixData.scenario}
                    </div>
                  </div>
                )}

                {/* 2. Tarjetas KPI */}
                {currentTheme.enableKpiCards && (
                  <div
                    className="grid grid-cols-4 gap-2 p-2.5 rounded-lg text-center"
                    style={{
                      backgroundColor: currentTheme.kpiBannerBgColor,
                      color: currentTheme.kpiBannerTextColor,
                    }}
                  >
                    <div className="p-1.5 border-r border-white/10">
                      <div className="text-[9px] uppercase tracking-wider opacity-80 font-bold">
                        Saldo Inicial
                      </div>
                      <div className="text-xs font-mono font-bold mt-0.5 text-white">
                        {formatSampleNumber(matrixData.initialBalance)}
                      </div>
                    </div>
                    <div className="p-1.5 border-r border-white/10">
                      <div className="text-[9px] uppercase tracking-wider opacity-80 font-bold">
                        Total Cobros (+)
                      </div>
                      <div className="text-xs font-mono font-bold mt-0.5 text-emerald-300">
                        {formatSampleNumber(matrixData.grandTotalIngresos)}
                      </div>
                    </div>
                    <div className="p-1.5 border-r border-white/10">
                      <div className="text-[9px] uppercase tracking-wider opacity-80 font-bold">
                        Total Pagos (-)
                      </div>
                      <div className="text-xs font-mono font-bold mt-0.5 text-rose-300">
                        {formatSampleNumber(-matrixData.grandTotalEgresos)}
                      </div>
                    </div>
                    <div className="p-1.5">
                      <div className="text-[9px] uppercase tracking-wider opacity-80 font-bold">
                        Saldo Final
                      </div>
                      <div className="text-xs font-mono font-bold mt-0.5 text-amber-300">
                        {formatSampleNumber(matrixData.finalSaldo)}
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. Cuadrícula de la Matriz (Preview Excel) */}
                <div className="border border-slate-300 rounded overflow-hidden text-[11px]">
                  <table className="w-full border-collapse">
                    {/* Encabezado Principal */}
                    <thead>
                      <tr
                        style={{
                          backgroundColor: currentTheme.headerBgColor,
                          color: currentTheme.headerTextColor,
                        }}
                      >
                        <th className="p-2 border border-slate-300 text-left font-bold text-[11px] w-48">
                          CONCEPTO FINANCIERO
                        </th>
                        <th className="p-2 border border-slate-300 text-center font-bold text-[11px] w-24">
                          DÍA 1
                        </th>
                        <th className="p-2 border border-slate-300 text-center font-bold text-[11px] w-24">
                          DÍA 2
                        </th>
                        <th className="p-2 border border-slate-300 text-center font-bold text-[11px] w-24">
                          DÍA 3
                        </th>
                        <th className="p-2 border border-slate-300 text-center font-bold text-[11px] w-24">
                          DÍA 10 (Sueldos)
                        </th>
                        <th className="p-2 border border-slate-300 text-right font-bold text-[11px] w-28">
                          TOTAL PERÍODO
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {/* Fila Total Egresos */}
                      <tr
                        style={{
                          backgroundColor: currentTheme.egresosRowBgColor,
                          color: currentTheme.egresosTextColor,
                        }}
                        className="font-bold border-b border-slate-300"
                      >
                        <td className="p-1.5 border border-slate-300 text-left">(-) TOTAL EGRESOS</td>
                        <td className="p-1.5 border border-slate-300 text-right font-mono">
                          {formatSampleNumber(-1850000)}
                        </td>
                        <td className="p-1.5 border border-slate-300 text-right font-mono">
                          {formatSampleNumber(-420000)}
                        </td>
                        <td className="p-1.5 border border-slate-300 text-right font-mono">
                          {formatSampleNumber(-950000)}
                        </td>
                        <td className="p-1.5 border border-slate-300 text-right font-mono">
                          {formatSampleNumber(-8400000)}
                        </td>
                        <td className="p-1.5 border border-slate-300 text-right font-mono">
                          {formatSampleNumber(-matrixData.grandTotalEgresos)}
                        </td>
                      </tr>

                      {/* Fila Total Ingresos */}
                      <tr
                        style={{
                          backgroundColor: currentTheme.ingresosRowBgColor,
                          color: currentTheme.ingresosTextColor,
                        }}
                        className="font-bold border-b border-slate-300"
                      >
                        <td className="p-1.5 border border-slate-300 text-left">(+) TOTAL INGRESOS</td>
                        <td className="p-1.5 border border-slate-300 text-right font-mono">
                          {formatSampleNumber(4200000)}
                        </td>
                        <td className="p-1.5 border border-slate-300 text-right font-mono">
                          {formatSampleNumber(1100000)}
                        </td>
                        <td className="p-1.5 border border-slate-300 text-right font-mono">
                          {formatSampleNumber(2800000)}
                        </td>
                        <td className="p-1.5 border border-slate-300 text-right font-mono">
                          {formatSampleNumber(3500000)}
                        </td>
                        <td className="p-1.5 border border-slate-300 text-right font-mono">
                          {formatSampleNumber(matrixData.grandTotalIngresos)}
                        </td>
                      </tr>

                      {/* Fila Saldo Diario */}
                      <tr
                        style={{
                          backgroundColor: currentTheme.summaryRowBgColor,
                          color: currentTheme.summaryRowTextColor,
                        }}
                        className="font-bold border-b border-slate-300"
                      >
                        <td className="p-1.5 border border-slate-300 text-left">(=) SALDO NETO DIARIO</td>
                        <td className="p-1.5 border border-slate-300 text-right font-mono">
                          {formatSampleNumber(2350000)}
                        </td>
                        <td className="p-1.5 border border-slate-300 text-right font-mono">
                          {formatSampleNumber(680000)}
                        </td>
                        <td className="p-1.5 border border-slate-300 text-right font-mono">
                          {formatSampleNumber(1850000)}
                        </td>
                        <td className="p-1.5 border border-slate-300 text-right font-mono">
                          {formatSampleNumber(-4900000)}
                        </td>
                        <td className="p-1.5 border border-slate-300 text-right font-mono">
                          {formatSampleNumber(matrixData.grandNetFlow)}
                        </td>
                      </tr>

                      {/* Fila Saldos Arrastrados */}
                      <tr
                        style={{
                          backgroundColor: currentTheme.saldosAcumRowBgColor,
                          color: currentTheme.saldosAcumRowTextColor,
                        }}
                        className="font-bold"
                      >
                        <td
                          className="p-2 border border-slate-300 text-left"
                          style={{
                            borderBottom: currentTheme.enableDoubleUnderlineTotals
                              ? '3px double #0F172A'
                              : '1px solid #CBD5E1',
                          }}
                        >
                          SALDO ACUMULADO ARRASTRADO
                        </td>
                        <td
                          className="p-2 border border-slate-300 text-right font-mono"
                          style={{
                            borderBottom: currentTheme.enableDoubleUnderlineTotals
                              ? '3px double #0F172A'
                              : '1px solid #CBD5E1',
                          }}
                        >
                          {formatSampleNumber(matrixData.initialBalance + 2350000)}
                        </td>
                        <td
                          className="p-2 border border-slate-300 text-right font-mono"
                          style={{
                            borderBottom: currentTheme.enableDoubleUnderlineTotals
                              ? '3px double #0F172A'
                              : '1px solid #CBD5E1',
                          }}
                        >
                          {formatSampleNumber(matrixData.initialBalance + 3030000)}
                        </td>
                        <td
                          className="p-2 border border-slate-300 text-right font-mono"
                          style={{
                            borderBottom: currentTheme.enableDoubleUnderlineTotals
                              ? '3px double #0F172A'
                              : '1px solid #CBD5E1',
                          }}
                        >
                          {formatSampleNumber(matrixData.initialBalance + 4880000)}
                        </td>
                        <td
                          className="p-2 border border-slate-300 text-right font-mono"
                          style={{
                            borderBottom: currentTheme.enableDoubleUnderlineTotals
                              ? '3px double #0F172A'
                              : '1px solid #CBD5E1',
                          }}
                        >
                          {formatSampleNumber(matrixData.initialBalance - 20000)}
                        </td>
                        <td
                          className="p-2 border border-slate-300 text-right font-mono"
                          style={{
                            borderBottom: currentTheme.enableDoubleUnderlineTotals
                              ? '3px double #0F172A'
                              : '1px solid #CBD5E1',
                          }}
                        >
                          {formatSampleNumber(matrixData.finalSaldo)}
                        </td>
                      </tr>

                      {/* Separador */}
                      <tr>
                        <td colSpan={6} className="h-2 bg-slate-50 border-b border-slate-200"></td>
                      </tr>

                      {/* Barra Sección Ingresos */}
                      <tr
                        style={{
                          backgroundColor: currentTheme.ingresosSectionColor,
                          color: '#FFFFFF',
                        }}
                        className="font-bold"
                      >
                        <td colSpan={6} className="p-1.5 px-2 text-left uppercase tracking-wide text-[10px]">
                          1. Detalle de Cobranzas e Ingresos Operacionales
                        </td>
                      </tr>
                      <tr
                        style={{
                          backgroundColor: currentTheme.enableZebraStripes
                            ? currentTheme.zebraBgColor
                            : '#FFFFFF',
                        }}
                        className="border-b border-slate-200 text-slate-800"
                      >
                        <td className="p-1.5 border border-slate-200">Cobranza Facturas Clientes RCV</td>
                        <td className="p-1.5 border border-slate-200 text-right font-mono">
                          {formatSampleNumber(3400000)}
                        </td>
                        <td className="p-1.5 border border-slate-200 text-right font-mono">
                          {formatSampleNumber(800000)}
                        </td>
                        <td className="p-1.5 border border-slate-200 text-right font-mono">
                          {formatSampleNumber(2200000)}
                        </td>
                        <td className="p-1.5 border border-slate-200 text-right font-mono">
                          {formatSampleNumber(1900000)}
                        </td>
                        <td className="p-1.5 border border-slate-200 text-right font-mono font-semibold">
                          {formatSampleNumber(8300000)}
                        </td>
                      </tr>

                      {/* Barra Sección Egresos */}
                      <tr
                        style={{
                          backgroundColor: currentTheme.egresosSectionColor,
                          color: '#FFFFFF',
                        }}
                        className="font-bold"
                      >
                        <td colSpan={6} className="p-1.5 px-2 text-left uppercase tracking-wide text-[10px]">
                          2. Detalle de Proveedores, Nómina y Obligaciones Fiscales
                        </td>
                      </tr>
                      <tr
                        style={{
                          backgroundColor: currentTheme.enableZebraStripes
                            ? currentTheme.zebraBgColor
                            : '#FFFFFF',
                        }}
                        className="border-b border-slate-200 text-slate-800"
                      >
                        <td className="p-1.5 border border-slate-200">Nómina Líquida & Sueldos</td>
                        <td className="p-1.5 border border-slate-200 text-right font-mono">-</td>
                        <td className="p-1.5 border border-slate-200 text-right font-mono">-</td>
                        <td className="p-1.5 border border-slate-200 text-right font-mono">-</td>
                        <td className="p-1.5 border border-slate-200 text-right font-mono">
                          {formatSampleNumber(-7200000)}
                        </td>
                        <td className="p-1.5 border border-slate-200 text-right font-mono font-semibold">
                          {formatSampleNumber(-7200000)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Leyenda de Hoja 2 */}
                {currentTheme.includeFlatMovementsSheet && (
                  <div className="flex items-center gap-2 p-2 rounded bg-indigo-50 border border-indigo-200 text-indigo-900 text-[11px]">
                    <Layers className="w-3.5 h-3.5 shrink-0 text-indigo-600" />
                    <span>
                      <strong>Hoja 2 Incluida:</strong> &quot;Detalle de Partidas&quot; estructurada como tabla plana con
                      todas las columnas de auditoría para insertar Tablas Dinámicas o filtros en Excel.
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 3. FOOTER DEL MODAL */}
        <div className="px-6 py-3 border-t border-slate-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold text-slate-700">Tema Activo:</span>
            <span className="px-2 py-0.5 rounded bg-slate-100 font-mono text-slate-800 font-bold">
              {currentTheme.name}
            </span>
            <span className="text-slate-300">|</span>
            <span>Generador ExcelJS 100% nativo</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              Cerrar
            </button>

            <button
              type="button"
              onClick={handleDownloadExcel}
              disabled={isGenerating}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generando Planilla...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Descargar Excel con este Diseño</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
