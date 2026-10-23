import React, { useState } from 'react';
import { Download, Upload, FileText, Check, AlertCircle, X, RefreshCw } from 'lucide-react';
import { HierarchicalAccountItem } from '../../types';
import {
  exportChartToCSV,
  inferDefaultMultiCurrency,
  inferDefaultDocReferencia,
  inferDefaultEfectivoEquivalente,
  inferDefaultContracuentaEfectivo,
  inferDefaultProyecto,
} from '../../utils/companyChartOfAccountsService';

interface ImportExportChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  chart?: HierarchicalAccountItem[];
  accounts?: HierarchicalAccountItem[];
  onImport: (importedAccounts: HierarchicalAccountItem[]) => void;
  empresaNombre?: string;
  empresaRut?: string;
  company?: any;
}

export const ImportExportChartModal: React.FC<ImportExportChartModalProps> = ({
  isOpen,
  onClose,
  chart,
  accounts,
  onImport,
  empresaNombre,
  empresaRut,
  company,
}) => {
  const [activeTab, setActiveTab] = useState<'EXPORT' | 'IMPORT'>('EXPORT');
  const [importJsonText, setImportJsonText] = useState('');
  const [importStatus, setImportStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const actualChart = chart || accounts || [];
  const actualRut = empresaRut || company?.rut || '';
  const actualNombre = empresaNombre || company?.razonSocial || company?.nombreFantasia || 'Empresa';

  if (!isOpen) return null;

  const handleDownloadCSV = () => {
    const csvContent = exportChartToCSV(actualChart);
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Plan_Cuentas_${actualRut.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadJSON = () => {
    const jsonStr = JSON.stringify(actualChart, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Plan_Cuentas_${actualRut.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyJSON = () => {
    navigator.clipboard.writeText(JSON.stringify(actualChart, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleExecuteImport = () => {
    setImportStatus(null);
    if (!importJsonText.trim()) {
      setImportStatus({ success: false, message: 'Pegue o cargue un contenido JSON válido.' });
      return;
    }

    try {
      const parsed = JSON.parse(importJsonText);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        setImportStatus({ success: false, message: 'El JSON debe ser un arreglo de cuentas contables válido.' });
        return;
      }

      // Validar campos mínimos
      const isValid = parsed.every((item) => item.codigo && item.nombre);
      if (!isValid) {
        setImportStatus({ success: false, message: 'Todas las cuentas deben contener al menos "codigo" y "nombre".' });
        return;
      }

      const formatted: HierarchicalAccountItem[] = parsed.map((item) => {
        const cod = String(item.codigo).trim();
        const nom = String(item.nombre).trim();
        return {
          codigo: cod,
          nombre: nom,
          clase: Number(item.clase) >= 1 && Number(item.clase) <= 7 ? (Number(item.clase) as any) : 1,
          grupo: item.grupo || cod.split('.').slice(0, 2).join('.'),
          subgrupo: item.subgrupo || cod.split('.').slice(0, 3).join('.'),
          nivel: item.nivel || 5,
          tipo: item.tipo || 'ACTIVO',
          clasificacion: item.clasificacion || 'CIRCULANTE',
          naturaleza: item.naturaleza || 'DEUDORA',
          requiereAuxiliarRut: Boolean(item.requiereAuxiliarRut),
          requiereCentroCosto: Boolean(item.requiereCentroCosto),
          esConciliableBancaria: Boolean(item.esConciliableBancaria),
          activa: item.activa !== false,
          // 5 Conceptos ERP con fallback inteligente
          manejaMultimoneda: item.manejaMultimoneda !== undefined
            ? Boolean(item.manejaMultimoneda)
            : inferDefaultMultiCurrency({ codigo: cod, nombre: nom }),
          requiereDocReferencia: item.requiereDocReferencia !== undefined
            ? Boolean(item.requiereDocReferencia)
            : inferDefaultDocReferencia({ codigo: cod, nombre: nom }),
          esEfectivoEquivalente: item.esEfectivoEquivalente !== undefined
            ? Boolean(item.esEfectivoEquivalente)
            : inferDefaultEfectivoEquivalente({ codigo: cod, nombre: nom }),
          esContracuentaEfectivo: item.esContracuentaEfectivo !== undefined
            ? Boolean(item.esContracuentaEfectivo)
            : inferDefaultContracuentaEfectivo({ codigo: cod, nombre: nom }),
          requiereProyecto: item.requiereProyecto !== undefined
            ? Boolean(item.requiereProyecto)
            : inferDefaultProyecto({ codigo: cod, nombre: nom }),
          agrupacionFiscal: item.agrupacionFiscal,
          agrupacionMatrizExtranjera: item.agrupacionMatrizExtranjera,
          agrupacionPersonalizada: item.agrupacionPersonalizada,
          empresaRut: actualRut,
        };
      });

      onImport(formatted);
      setImportStatus({ success: true, message: `Se han importado exitosamente ${formatted.length} cuentas al plan de la empresa.` });
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (e: any) {
      setImportStatus({ success: false, message: `Error de sintaxis JSON: ${e.message}` });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setImportJsonText(content);
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-xl my-8 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              Importar / Exportar Plan de Cuentas
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Empresa: <strong>{actualNombre}</strong> ({actualRut})
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="flex border-b border-slate-200 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('EXPORT')}
            className={`flex-1 py-3 px-4 flex items-center justify-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'EXPORT'
                ? 'border-blue-600 text-blue-600 bg-blue-50/30 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Exportar Plan ({actualChart?.length || 0} cuentas)</span>
          </button>
          <button
            onClick={() => setActiveTab('IMPORT')}
            className={`flex-1 py-3 px-4 flex items-center justify-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'IMPORT'
                ? 'border-blue-600 text-blue-600 bg-blue-50/30 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Importar Plan (JSON)</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 text-xs">
          {activeTab === 'EXPORT' ? (
            <div className="space-y-4">
              <p className="text-slate-600">
                Descargue la estructura actual del plan de cuentas personalizado para esta empresa con todas sus clases, grupos, subgrupos y asignaciones para balances fiscales y casa matriz.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button
                  onClick={handleDownloadCSV}
                  className="p-4 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/40 text-left transition-all group cursor-pointer"
                >
                  <div className="font-bold text-slate-900 group-hover:text-emerald-800 flex items-center justify-between">
                    <span>Exportar a Excel (CSV)</span>
                    <Download className="w-4 h-4 text-emerald-600" />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Formato delimitado por punto y coma (;) listo para abrir en MS Excel con codificación UTF-8 BOM.
                  </p>
                </button>

                <button
                  onClick={handleDownloadJSON}
                  className="p-4 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/40 text-left transition-all group cursor-pointer"
                >
                  <div className="font-bold text-slate-900 group-hover:text-blue-800 flex items-center justify-between">
                    <span>Descargar archivo JSON</span>
                    <Download className="w-4 h-4 text-blue-600" />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Estructura normalizada ideal para respaldo técnico o migración entre empresas del estudio.
                  </p>
                </button>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleCopyJSON}
                  className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <FileText className="w-4 h-4" />}
                  <span>{copied ? '¡Copiado al Portapapeles!' : 'Copiar Plan Completo en Formato JSON'}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-slate-600">
                Pegue la definición en JSON o suba un archivo exportado previamente para cargar el plan de cuentas de esta empresa.
              </p>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Cargar archivo JSON</label>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="block w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">O pegar JSON directamente</label>
                <textarea
                  rows={6}
                  value={importJsonText}
                  onChange={(e) => setImportJsonText(e.target.value)}
                  placeholder='[{"codigo": "1.1.01.001", "nombre": "Caja Central", "clase": 1, ...}]'
                  className="w-full font-mono text-[11px] p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {importStatus && (
                <div
                  className={`p-3 rounded-lg text-xs font-medium flex items-center gap-2 ${
                    importStatus.success
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border border-rose-200 text-rose-800'
                  }`}
                >
                  {importStatus.success ? <Check className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                  <span>{importStatus.message}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleExecuteImport}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Cargar e Importar Plan</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
