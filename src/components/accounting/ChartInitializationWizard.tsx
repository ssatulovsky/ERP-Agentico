/**
 * K2 · Asistente de inicialización del plan de cuentas de una empresa.
 *
 * Orígenes: plantilla estándar, copia desde otra empresa del mismo cliente ERP (con acceso),
 * importación desde otro sistema (CSV/XLSX con asignación de columnas), el plan que quedó guardado
 * en este navegador (versiones anteriores) o un plan vacío. Lo usan el Agente Contable (empresa sin
 * plan) y Configuración (después del alta de una empresa). No hay un segundo editor de cuentas.
 */
import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { BookOpen, Copy, FileUp, HardDrive, Square, X, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import {
  fetchChartCopySources,
  getLegacyBrowserChart,
  initializeCompanyChartOnServer,
  validateChartOnServer,
  type CompanyChartServerState,
} from '../../utils/companyChartOfAccountsService';
import {
  CHART_IMPORT_PROFILES,
  DEFAULT_TIPO_POR_CLASE,
  detectHeaderRow,
  guessMapping,
  mapRowsToAccounts,
  type ChartImportField,
  type ChartImportProfile,
  type CodeFormat,
} from '../../utils/chartImportMapper';

type Origen = 'PLANTILLA_ESTANDAR' | 'COPIA_EMPRESA' | 'IMPORTACION' | 'NAVEGADOR' | 'VACIO';

interface Props {
  isOpen: boolean;
  empresaRut: string;
  empresaNombre: string;
  /** true cuando la empresa ya tiene plan sin movimientos y se quiere reemplazar. */
  reemplazar?: boolean;
  onClose: () => void;
  onInitialized: (state: CompanyChartServerState) => void;
}

const FIELD_LABELS: Record<ChartImportField, string> = {
  codigo: 'Código *',
  nombre: 'Nombre *',
  tipo: 'Tipo (activo, pasivo…)',
  naturaleza: 'Naturaleza (deudora/acreedora)',
  clasificacion: 'Clasificación',
  imputable: 'Imputable',
};

export const ChartInitializationWizard: React.FC<Props> = ({ isOpen, empresaRut, empresaNombre, reemplazar, onClose, onInitialized }) => {
  const [origen, setOrigen] = useState<Origen>('PLANTILLA_ESTANDAR');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<{ errores: any[]; advertencias: any[] } | null>(null);

  // Copia
  const [fuentes, setFuentes] = useState<Array<{ empresaId: string; rut: string; razonSocial: string; cuentas: number }>>([]);
  const [empresaOrigenId, setEmpresaOrigenId] = useState('');

  // Importación
  const [profile, setProfile] = useState<ChartImportProfile>(CHART_IMPORT_PROFILES[0]);
  const [rows, setRows] = useState<unknown[][]>([]);
  const [fileName, setFileName] = useState('');
  const [headerRow, setHeaderRow] = useState(0);
  const [mapping, setMapping] = useState<Partial<Record<ChartImportField, number>>>({});
  const [codeFormat, setCodeFormat] = useState<CodeFormat>({ tipo: 'TAL_CUAL' });
  const [usarTipoPorClase, setUsarTipoPorClase] = useState(false);
  const [tipoPorClase, setTipoPorClase] = useState<Record<string, string>>({ ...DEFAULT_TIPO_POR_CLASE });
  const [inferirNaturaleza, setInferirNaturaleza] = useState(false);
  const [soloImputables, setSoloImputables] = useState(false);

  const legacy = useMemo(() => (isOpen ? getLegacyBrowserChart(empresaRut) : []), [isOpen, empresaRut]);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setIssues(null);
    void fetchChartCopySources(empresaRut).then(setFuentes);
  }, [isOpen, empresaRut]);

  if (!isOpen) return null;

  const headers = rows[headerRow] || [];
  const importPreview = rows.length
    ? mapRowsToAccounts(rows, {
        mapping,
        headerRow,
        codeFormat,
        tipoPorClase: usarTipoPorClase ? tipoPorClase : null,
        inferirNaturaleza,
        soloImputables,
      })
    : null;

  const handleFile = async (file: File) => {
    setError(null);
    setIssues(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: '' });
      const h = detectHeaderRow(data, profile);
      setRows(data);
      setFileName(file.name);
      setHeaderRow(h);
      setMapping(guessMapping(data[h] || [], profile));
    } catch (e: any) {
      setError(`No se pudo leer el archivo: ${e?.message || e}`);
    }
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    setIssues(null);
    try {
      let input: any = { origen, reemplazar: Boolean(reemplazar) };
      if (origen === 'COPIA_EMPRESA') {
        if (!empresaOrigenId) throw new Error('Seleccione la empresa de origen.');
        input.empresaOrigenId = empresaOrigenId;
      }
      if (origen === 'NAVEGADOR') input.cuentas = legacy;
      if (origen === 'IMPORTACION') {
        if (!importPreview || importPreview.cuentas.length === 0) throw new Error('Cargue un archivo y asigne las columnas de código y nombre.');
        const check = await validateChartOnServer(empresaRut, importPreview.cuentas);
        if (!check) throw new Error('No se pudo validar el plan en el servidor.');
        if (!check.valido) {
          setIssues({ errores: check.errores, advertencias: check.advertencias });
          throw new Error(`El plan importado tiene ${check.errores.length} error(es); corríjalos en el archivo o en la asignación de columnas.`);
        }
        input = { ...input, cuentas: check.cuentas, sistemaOrigen: profile.id, equivalencias: importPreview.equivalencias };
      }
      const r = await initializeCompanyChartOnServer(empresaRut, input);
      if (!r.ok || !r.state) {
        if (r.details?.errores) setIssues({ errores: r.details.errores, advertencias: r.details.advertencias || [] });
        throw new Error(r.error || 'No se inicializó el plan.');
      }
      onInitialized(r.state);
      onClose();
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const option = (id: Origen, icon: React.ReactNode, title: string, desc: string, disabled = false) => (
    <button
      type="button"
      disabled={disabled}
      onClick={() => setOrigen(id)}
      className={`text-left p-3 rounded-lg border text-xs flex gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
        origen === id ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:border-slate-400 bg-white'
      }`}
    >
      <span className="mt-0.5 text-blue-700">{icon}</span>
      <span>
        <span className="block font-bold text-slate-900">{title}</span>
        <span className="block text-slate-500">{desc}</span>
      </span>
    </button>
  );

  return (
    <div className="fixed inset-0 z-[80] bg-slate-900/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <div>
            <h3 className="text-sm font-black text-slate-900">Plan de cuentas de {empresaNombre}</h3>
            <p className="text-[11px] text-slate-500">
              {reemplazar ? 'Reemplazar el plan actual (la empresa no tiene asientos).' : 'La empresa no tiene plan de cuentas. Elija de dónde sale el plan inicial.'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {option('PLANTILLA_ESTANDAR', <BookOpen className="w-4 h-4" />, 'Plantilla estándar', 'Plan chileno de 5 niveles con atributos y agrupaciones.')}
            {option('COPIA_EMPRESA', <Copy className="w-4 h-4" />, 'Copiar de otra empresa', fuentes.length ? `${fuentes.length} empresa(s) disponibles de su mismo cliente ERP.` : 'No hay empresas con plan a las que tenga acceso.', fuentes.length === 0)}
            {option('IMPORTACION', <FileUp className="w-4 h-4" />, 'Importar desde otro sistema', 'Softland, CAME, Nubox, Defontana u otro, desde CSV o Excel.')}
            {option('NAVEGADOR', <HardDrive className="w-4 h-4" />, 'Subir el plan de este navegador', legacy.length ? `${legacy.length} cuentas guardadas aquí por una versión anterior.` : 'No hay un plan guardado en este navegador.', legacy.length === 0)}
            {option('VACIO', <Square className="w-4 h-4" />, 'Plan vacío', 'Armar el plan a mano en el editor del Agente Contable.')}
          </div>

          {origen === 'COPIA_EMPRESA' && (
            <select value={empresaOrigenId} onChange={(e) => setEmpresaOrigenId(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-xs">
              <option value="">Seleccione la empresa de origen…</option>
              {fuentes.map((f) => (
                <option key={f.empresaId} value={f.empresaId}>
                  {f.razonSocial} ({f.rut}) · {f.cuentas} cuentas
                </option>
              ))}
            </select>
          )}

          {origen === 'IMPORTACION' && (
            <div className="space-y-3 border border-slate-200 rounded-lg p-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={profile.id}
                  onChange={(e) => setProfile(CHART_IMPORT_PROFILES.find((p) => p.id === e.target.value) || CHART_IMPORT_PROFILES[0])}
                  className="border border-slate-300 rounded px-2 py-1"
                >
                  {CHART_IMPORT_PROFILES.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
                <input type="file" accept=".csv,.txt,.xlsx,.xls" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
                {fileName && <span className="text-slate-500">{fileName} · {Math.max(0, rows.length - headerRow - 1)} filas</span>}
              </div>
              {!profile.confirmado && (
                <p className="text-amber-700">Perfil preliminar: revise la asignación de columnas; se confirmará con un archivo de muestra de este sistema.</p>
              )}

              {rows.length > 0 && (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <label className="flex flex-col gap-0.5">
                      <span className="font-semibold text-slate-600">Fila de encabezados</span>
                      <input type="number" min={1} value={headerRow + 1} onChange={(e) => setHeaderRow(Math.max(0, Number(e.target.value) - 1))} className="border border-slate-300 rounded px-2 py-1" />
                    </label>
                    {(Object.keys(FIELD_LABELS) as ChartImportField[]).map((f) => (
                      <label key={f} className="flex flex-col gap-0.5">
                        <span className="font-semibold text-slate-600">{FIELD_LABELS[f]}</span>
                        <select
                          value={mapping[f] ?? ''}
                          onChange={(e) => setMapping({ ...mapping, [f]: e.target.value === '' ? undefined : Number(e.target.value) })}
                          className="border border-slate-300 rounded px-2 py-1"
                        >
                          <option value="">— No viene —</option>
                          {headers.map((h, i) => (
                            <option key={i} value={i}>
                              {String(h || `Columna ${i + 1}`)}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-semibold text-slate-600">Formato del código:</span>
                    <select
                      value={codeFormat.tipo === 'SEPARADOR' ? `SEP${codeFormat.separador}` : codeFormat.tipo}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === 'TAL_CUAL') setCodeFormat({ tipo: 'TAL_CUAL' });
                        else if (v === 'MASCARA') setCodeFormat({ tipo: 'MASCARA', mascara: '1-1-2-3' });
                        else setCodeFormat({ tipo: 'SEPARADOR', separador: v.slice(3) });
                      }}
                      className="border border-slate-300 rounded px-2 py-1"
                    >
                      <option value="TAL_CUAL">Tal cual (niveles separados por punto)</option>
                      <option value="SEP-">Niveles separados por guion (1-01-001)</option>
                      <option value="SEP ">Niveles separados por espacio</option>
                      <option value="MASCARA">Sin separadores (indicar dígitos por nivel)</option>
                    </select>
                    {codeFormat.tipo === 'MASCARA' && (
                      <input value={codeFormat.mascara} onChange={(e) => setCodeFormat({ tipo: 'MASCARA', mascara: e.target.value })} className="border border-slate-300 rounded px-2 py-1 w-28" title="Dígitos por nivel, por ejemplo 1-1-2-3" />
                    )}
                  </div>

                  {mapping.tipo === undefined && (
                    <div className="space-y-1">
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={usarTipoPorClase} onChange={(e) => setUsarTipoPorClase(e.target.checked)} />
                        <span>El archivo no trae el tipo: asignarlo por la clase (primer dígito) según esta tabla</span>
                      </label>
                      {usarTipoPorClase && (
                        <div className="flex flex-wrap gap-2">
                          {Object.keys(tipoPorClase).map((c) => (
                            <label key={c} className="flex items-center gap-1">
                              <span className="font-mono">{c} =</span>
                              <select value={tipoPorClase[c]} onChange={(e) => setTipoPorClase({ ...tipoPorClase, [c]: e.target.value })} className="border border-slate-300 rounded px-1 py-0.5">
                                {['ACTIVO', 'PASIVO', 'PATRIMONIO', 'INGRESO', 'COSTO', 'GASTO'].map((t) => (
                                  <option key={t} value={t}>
                                    {t}
                                  </option>
                                ))}
                              </select>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {mapping.naturaleza === undefined && (
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={inferirNaturaleza} onChange={(e) => setInferirNaturaleza(e.target.checked)} />
                      <span>El archivo no trae la naturaleza: deudora para activo, costo y gasto; acreedora para el resto</span>
                    </label>
                  )}
                  {mapping.imputable !== undefined && (
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={soloImputables} onChange={(e) => setSoloImputables(e.target.checked)} />
                      <span>Importar solo las cuentas imputables</span>
                    </label>
                  )}

                  {importPreview && (
                    <div className="border border-slate-200 rounded max-h-48 overflow-y-auto">
                      <table className="w-full text-[11px]">
                        <thead className="bg-slate-50 sticky top-0">
                          <tr>
                            <th className="text-left px-2 py-1">Código</th>
                            <th className="text-left px-2 py-1">Nombre</th>
                            <th className="text-left px-2 py-1">Tipo</th>
                            <th className="text-left px-2 py-1">Naturaleza</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importPreview.cuentas.slice(0, 50).map((c) => (
                            <tr key={c.codigo} className="border-t border-slate-100">
                              <td className="px-2 py-0.5 font-mono">{c.codigo}</td>
                              <td className="px-2 py-0.5">{c.nombre}</td>
                              <td className={`px-2 py-0.5 ${c.tipo ? '' : 'text-rose-600'}`}>{c.tipo || 'falta'}</td>
                              <td className={`px-2 py-0.5 ${c.naturaleza ? '' : 'text-rose-600'}`}>{c.naturaleza || 'falta'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <p className="px-2 py-1 text-slate-500">
                        {importPreview.cuentas.length} cuentas
                        {importPreview.omitidas.length ? ` · ${importPreview.omitidas.length} filas omitidas` : ''}
                        {importPreview.equivalencias.length ? ` · ${importPreview.equivalencias.length} códigos convertidos (se guardan las equivalencias)` : ''}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {issues && (issues.errores.length > 0 || issues.advertencias.length > 0) && (
            <div className="text-[11px] border border-rose-200 bg-rose-50 rounded p-2 max-h-40 overflow-y-auto space-y-0.5">
              {issues.errores.slice(0, 30).map((e, i) => (
                <div key={`e${i}`} className="text-rose-800">
                  {e.fila ? `Fila ${e.fila}` : ''} {e.codigo ? `(${e.codigo})` : ''}: {e.mensaje}
                </div>
              ))}
              {issues.advertencias.slice(0, 15).map((w, i) => (
                <div key={`w${i}`} className="text-amber-800">
                  Advertencia {w.codigo ? `(${w.codigo})` : ''}: {w.mensaje}
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded p-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-200">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs text-slate-600 cursor-pointer">
            Cancelar
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={submit}
            className="px-4 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg flex items-center gap-1.5 cursor-pointer"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            <span>{reemplazar ? 'Reemplazar plan' : 'Crear plan de cuentas'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChartInitializationWizard;
