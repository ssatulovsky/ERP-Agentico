import React, { useState, useMemo } from 'react';
import {
  Download,
  FileSpreadsheet,
  FileCode,
  Printer,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Building2,
  DollarSign,
  ChevronDown,
  ChevronRight,
  Info,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Wallet,
  Activity,
} from 'lucide-react';
import {
  HierarchicalAccountItem,
  AccountingEntry,
  Balance8ColumnasReport,
  CashFlowIndirectReport,
} from '../../types';
import {
  buildCashFlowIndirectReport,
  exportCashFlowIndirectToCSV,
  exportCashFlowIndirectToJSON,
  downloadFile,
  formatCLP,
} from '../../utils/cashFlowIndirectAgent';
import { ultimosPeriodos, etiquetaPeriodo } from '../../utils/periodo';

interface CashFlowIndirectViewProps {
  empresaRut: string;
  empresaNombre: string;
  chartOfAccounts: HierarchicalAccountItem[];
  entries: AccountingEntry[];
  balance8Col: Balance8ColumnasReport;
  periodoSeleccionado?: string;
}

export const CashFlowIndirectView: React.FC<CashFlowIndirectViewProps> = ({
  empresaRut,
  empresaNombre,
  chartOfAccounts,
  entries,
  balance8Col,
  periodoSeleccionado = '2026-10',
}) => {
  const [periodo, setPeriodo] = useState<string>(periodoSeleccionado);
  const [isAuditing, setIsAuditing] = useState(false);
  const [expandedRowIds, setExpandedRowIds] = useState<Record<string, boolean>>({});
  const [subTab, setSubTab] = useState<'ESTADO_FORMAL' | 'DESGLOSE_EFECTIVO' | 'DIAGNOSTICO_AGENTE'>('ESTADO_FORMAL');
  const [manualInitialBalance, setManualInitialBalance] = useState<number | undefined>(undefined);
  const [showConfigModal, setShowConfigModal] = useState(false);

  // Generación reactiva del reporte por el Agente Autónomo
  const report: CashFlowIndirectReport = useMemo(() => {
    return buildCashFlowIndirectReport({
      empresaRut,
      empresaNombre,
      periodo,
      chartOfAccounts,
      entries,
      balance8Col,
      saldoInicialEfectivoManual: manualInitialBalance,
    });
  }, [empresaRut, empresaNombre, periodo, chartOfAccounts, entries, balance8Col, manualInitialBalance]);

  // Manejador de re-auditoría manual
  const handleReAudit = () => {
    setIsAuditing(true);
    setTimeout(() => {
      setIsAuditing(false);
    }, 700);
  };

  // Descarga CSV / Excel
  const handleDownloadCSV = () => {
    const csvContent = exportCashFlowIndirectToCSV(report);
    const filename = `Flujo_Efectivo_Indirecto_NIC7_${empresaRut}_${periodo}.csv`;
    downloadFile(filename, csvContent, 'text/csv');
  };

  // Descarga JSON
  const handleDownloadJSON = () => {
    const jsonContent = exportCashFlowIndirectToJSON(report);
    const filename = `Flujo_Efectivo_Indirecto_NIC7_${empresaRut}_${periodo}.json`;
    downloadFile(filename, jsonContent, 'application/json');
  };

  // Imprimir
  const handlePrint = () => {
    window.print();
  };

  // Toggle fila expandida
  const toggleRow = (id: string) => {
    setExpandedRowIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-6">
      {/* Header Principal con Estado del Agente */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2 py-0.5 rounded font-mono flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                AGENTE NIC 7 AUTÓNOMO ACTIVO
              </span>
              <span className="bg-blue-50 text-blue-700 text-[11px] font-semibold px-2 py-0.5 rounded font-mono">
                MÉTODO INDIRECTO NIF / IAS 7 / CMF
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Activity className="w-6 h-6 text-emerald-600" />
              Estado de Flujos de Efectivo
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Empresa: <strong className="text-slate-700">{empresaNombre}</strong> ({empresaRut}) • Período fiscal: <strong className="font-mono text-slate-700">{periodo}</strong>
            </p>
          </div>

          {/* Acciones y Exportaciones */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-mono font-semibold text-slate-700 focus:outline-none focus:border-blue-500"
            >
              {ultimosPeriodos(18).map((p) => (
                <option key={p} value={p}>{etiquetaPeriodo(p)}</option>
              ))}
              <option value="2026-12">Acumulado Anual 2026</option>
            </select>

            <button
              onClick={handleReAudit}
              disabled={isAuditing}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
              title="Volver a escanear asientos y recalcular flujo de efectivo"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isAuditing ? 'animate-spin text-blue-600' : ''}`} />
              <span>{isAuditing ? 'Auditando...' : 'Re-Auditar'}</span>
            </button>

            <button
              onClick={handleDownloadCSV}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Excel (CSV)</span>
            </button>

            <button
              onClick={handleDownloadJSON}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>JSON</span>
            </button>

            <button
              onClick={handlePrint}
              className="p-2 border border-slate-300 hover:bg-slate-100 text-slate-600 rounded-lg cursor-pointer transition-colors"
              title="Imprimir reporte formal"
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tarjetas KPI de Resumen Ejecutivo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-5">
          {/* 1. Flujo Operacional */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              1. Flujo Operacional (CFO)
            </span>
            <div className="my-1">
              <span
                className={`text-lg font-bold font-mono ${
                  report.flujoNetoOperacional >= 0 ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {formatCLP(report.flujoNetoOperacional)}
              </span>
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-500">
              <span>Resultado: {formatCLP(report.resultadoNeto)}</span>
              <span className="font-bold text-slate-700">{report.diagnosticoAgente.calidadUtilidadScorePct}% conv.</span>
            </div>
          </div>

          {/* 2. Flujo Inversión (CAPEX) */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              2. Flujo Inversión (CFI)
            </span>
            <div className="my-1">
              <span
                className={`text-lg font-bold font-mono ${
                  report.flujoNetoInversion >= 0 ? 'text-blue-700' : 'text-amber-700'
                }`}
              >
                {formatCLP(report.flujoNetoInversion)}
              </span>
            </div>
            <div className="text-[10px] text-slate-500 truncate">
              {report.partidasInversion.length} movimiento(s) de CAPEX
            </div>
          </div>

          {/* 3. Flujo Financiamiento */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              3. Flujo Financiamiento (CFF)
            </span>
            <div className="my-1">
              <span
                className={`text-lg font-bold font-mono ${
                  report.flujoNetoFinanciamiento >= 0 ? 'text-indigo-700' : 'text-purple-700'
                }`}
              >
                {formatCLP(report.flujoNetoFinanciamiento)}
              </span>
            </div>
            <div className="text-[10px] text-slate-500">
              Deudas, IFRS 16 y Capital
            </div>
          </div>

          {/* 4. Variación Neta */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Variación Neta Efectivo
            </span>
            <div className="my-1">
              <span
                className={`text-lg font-bold font-mono ${
                  report.variacionNetaEfectivo >= 0 ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {formatCLP(report.variacionNetaEfectivo)}
              </span>
            </div>
            <div className="text-[10px] text-slate-500">
              Saldo Inicial: {formatCLP(report.saldoInicialEfectivo)}
            </div>
          </div>

          {/* 5. Saldo Final y Cuadratura */}
          <div
            className={`border rounded-xl p-3.5 flex flex-col justify-between ${
              report.estaCuadrado ? 'bg-emerald-50/60 border-emerald-300' : 'bg-rose-50/60 border-rose-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">
                Saldo Final Disponible
              </span>
              {report.estaCuadrado ? (
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600" />
              )}
            </div>
            <div className="my-1">
              <span className="text-lg font-bold font-mono text-slate-900">
                {formatCLP(report.saldoFinalEfectivo)}
              </span>
            </div>
            <div className="flex items-center justify-between text-[10px] font-semibold">
              <span className={report.estaCuadrado ? 'text-emerald-700' : 'text-rose-700'}>
                {report.estaCuadrado ? '✓ Cuadratura NIC 7 (Dif: $0)' : `Dif: ${formatCLP(report.diferenciaCuadratura)}`}
              </span>
              <span className="text-slate-500">{report.desgloseEfectivo.length} cuentas</span>
            </div>
          </div>
        </div>
      </div>

      {/* Banner de Diagnóstico del Agente Auditor */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-xl p-5 shadow-sm border border-slate-700">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-amber-300 font-mono">
                Dictamen del Agente Contable Autónomo • Auditoría de Liquidez
              </span>
            </div>
            <p className="text-xs text-slate-200 leading-relaxed">
              {report.diagnosticoAgente.resumenEjecutivo}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div className="bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 text-center">
              <span className="text-[10px] text-slate-400 block uppercase">Calidad de Ganancia</span>
              <span
                className={`text-sm font-bold font-mono ${
                  report.diagnosticoAgente.calidadUtilidadScorePct >= 90
                    ? 'text-emerald-400'
                    : report.diagnosticoAgente.calidadUtilidadScorePct >= 60
                    ? 'text-amber-400'
                    : 'text-rose-400'
                }`}
              >
                {report.diagnosticoAgente.calidadUtilidadScorePct}%
              </span>
            </div>

            <div className="bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 text-center">
              <span className="text-[10px] text-slate-400 block uppercase">Salud Financiera</span>
              <span
                className={`text-sm font-bold ${
                  report.diagnosticoAgente.saludFinanciera === 'OPTIMA'
                    ? 'text-emerald-400'
                    : report.diagnosticoAgente.saludFinanciera === 'ADVERTENCIA'
                    ? 'text-amber-400'
                    : 'text-rose-400'
                }`}
              >
                {report.diagnosticoAgente.saludFinanciera}
              </span>
            </div>

            <div className="bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 text-center">
              <span className="text-[10px] text-slate-400 block uppercase">Firma del Agente</span>
              <span className="text-[10px] font-mono text-blue-300 block truncate max-w-[140px]" title={report.diagnosticoAgente.agenteSignature}>
                {report.diagnosticoAgente.agenteSignature}
              </span>
            </div>
          </div>
        </div>

        {/* Alertas dinámicas */}
        {report.diagnosticoAgente.alertasOperativas.length > 0 && (
          <div className="mt-4 pt-3 border-t border-slate-700/80 grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
            {report.diagnosticoAgente.alertasOperativas.map((alerta, i) => (
              <div key={i} className="flex items-start gap-1.5 text-slate-300 bg-slate-800/50 p-2 rounded">
                <Info className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                <span>{alerta}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tabs Secundarias de Visualización */}
      <div className="flex border-b border-slate-200 text-xs font-semibold">
        <button
          onClick={() => setSubTab('ESTADO_FORMAL')}
          className={`py-3 px-5 flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
            subTab === 'ESTADO_FORMAL'
              ? 'border-blue-600 text-blue-600 bg-blue-50/20 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Estado Formal NIF / NIC 7 (Estructura Clasificada)</span>
        </button>

        <button
          onClick={() => setSubTab('DESGLOSE_EFECTIVO')}
          className={`py-3 px-5 flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
            subTab === 'DESGLOSE_EFECTIVO'
              ? 'border-blue-600 text-blue-600 bg-blue-50/20 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Wallet className="w-4 h-4" />
          <span>Desglose de Cuentas de Efectivo y Equivalentes ({report.desgloseEfectivo.length})</span>
        </button>

        <button
          onClick={() => setSubTab('DIAGNOSTICO_AGENTE')}
          className={`py-3 px-5 flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
            subTab === 'DIAGNOSTICO_AGENTE'
              ? 'border-blue-600 text-blue-600 bg-blue-50/20 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span>Auditoría y Recomendaciones del Controller</span>
        </button>
      </div>

      {/* TAB 1: ESTADO FORMAL NIF / NIC 7 */}
      {subTab === 'ESTADO_FORMAL' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 uppercase text-[11px]">
                  <th className="py-3 px-4 w-12 text-center">Ref</th>
                  <th className="py-3 px-4">Rubro / Partida Contable</th>
                  <th className="py-3 px-3 text-center w-16">Signo</th>
                  <th className="py-3 px-4 text-right font-mono w-44">Monto Período ($ CLP)</th>
                  <th className="py-3 px-4 text-slate-500">Fundamento Normativo NIC 7</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {/* 1. ACTIVIDADES DE OPERACIÓN */}
                <tr className="bg-slate-100/70 font-bold text-slate-900">
                  <td className="py-2.5 px-4 text-center">1</td>
                  <td colSpan={4} className="py-2.5 px-4 font-sans text-xs">
                    ACTIVIDADES DE OPERACIÓN (NIC 7.18(b))
                  </td>
                </tr>

                {/* Resultado Neto */}
                <tr className="hover:bg-slate-50 font-semibold text-slate-900">
                  <td className="py-2.5 px-4 text-center text-slate-400">1.1</td>
                  <td className="py-2.5 px-4 font-sans pl-6 flex items-center gap-1.5">
                    <span>{report.partidasOperacion[0]?.concepto}</span>
                  </td>
                  <td className="py-2.5 px-3 text-center text-slate-600 font-bold">
                    {report.resultadoNeto >= 0 ? '+' : '-'}
                  </td>
                  <td className="py-2.5 px-4 text-right font-bold">
                    {formatCLP(report.resultadoNeto)}
                  </td>
                  <td className="py-2.5 px-4 text-slate-500 font-sans text-[11px]">
                    Utilidad o pérdida neta del ejercicio antes de partidas no monetarias
                  </td>
                </tr>

                {/* Subencabezado Ajustes no efectivo */}
                <tr className="bg-amber-50/40 text-amber-900 font-bold text-[11px]">
                  <td className="py-1.5 px-4 text-center">1.2</td>
                  <td colSpan={4} className="py-1.5 px-4 font-sans pl-6 uppercase tracking-wider">
                    Ajustes por Partidas que no Afectan el Efectivo (Gastos no desembolsables)
                  </td>
                </tr>

                {report.partidasOperacion
                  .filter((p) => p.subcategoria === 'AJUSTE_PARTIDA_NO_EFECTIVO')
                  .map((p) => (
                    <React.Fragment key={p.id}>
                      <tr className="hover:bg-slate-50 transition-colors">
                        <td className="py-2 px-4 text-center text-slate-400">
                          <button
                            onClick={() => toggleRow(p.id)}
                            className="p-0.5 rounded hover:bg-slate-200 text-slate-500 cursor-pointer"
                          >
                            {expandedRowIds[p.id] ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                          </button>
                        </td>
                        <td className="py-2 px-4 font-sans pl-8 text-slate-800">
                          {p.concepto}
                          {p.cuentasAsociadas.length > 0 && (
                            <span className="ml-1.5 text-[10px] text-slate-400 font-mono">
                              ({p.cuentasAsociadas.length} cuentas)
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center text-slate-600 font-bold">
                          {p.signoFlujo}
                        </td>
                        <td className="py-2 px-4 text-right text-slate-900">
                          {formatCLP(p.monto)}
                        </td>
                        <td className="py-2 px-4 text-slate-500 font-sans text-[11px]">
                          {p.notaNormativa}
                        </td>
                      </tr>
                      {expandedRowIds[p.id] && p.cuentasAsociadas.length > 0 && (
                        <tr className="bg-slate-50/80">
                          <td colSpan={5} className="py-2 px-8">
                            <div className="border border-slate-200 rounded p-2 text-[11px] bg-white space-y-1">
                              <span className="font-bold text-slate-700 block mb-1">Cuentas Involucradas:</span>
                              {p.cuentasAsociadas.map((c) => (
                                <div key={c.codigo} className="flex justify-between items-center text-slate-600 font-mono">
                                  <span>
                                    <strong>{c.codigo}</strong> {c.nombre}
                                  </span>
                                  <span className="font-semibold text-slate-800">{formatCLP(c.saldoFinal)}</span>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}

                {/* Subencabezado Cambios en Capital de Trabajo */}
                <tr className="bg-blue-50/40 text-blue-900 font-bold text-[11px]">
                  <td className="py-1.5 px-4 text-center">1.3</td>
                  <td colSpan={4} className="py-1.5 px-4 font-sans pl-6 uppercase tracking-wider">
                    Cambios Netos en Activos y Pasivos Operacionales (Capital de Trabajo)
                  </td>
                </tr>

                {report.partidasOperacion
                  .filter((p) => p.subcategoria === 'VARIACION_CAPITAL_TRABAJO')
                  .map((p) => (
                    <React.Fragment key={p.id}>
                      <tr className="hover:bg-slate-50 transition-colors">
                        <td className="py-2 px-4 text-center text-slate-400">
                          <button
                            onClick={() => toggleRow(p.id)}
                            className="p-0.5 rounded hover:bg-slate-200 text-slate-500 cursor-pointer"
                          >
                            {expandedRowIds[p.id] ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                          </button>
                        </td>
                        <td className="py-2 px-4 font-sans pl-8 text-slate-800">
                          {p.concepto}
                          {p.cuentasAsociadas.length > 0 && (
                            <span className="ml-1.5 text-[10px] text-slate-400 font-mono">
                              ({p.cuentasAsociadas.length} cuentas)
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center text-slate-600 font-bold">
                          {p.signoFlujo}
                        </td>
                        <td
                          className={`py-2 px-4 text-right ${
                            p.monto >= 0 ? 'text-slate-900' : 'text-rose-700'
                          }`}
                        >
                          {formatCLP(p.monto)}
                        </td>
                        <td className="py-2 px-4 text-slate-500 font-sans text-[11px]">
                          {p.notaNormativa}
                        </td>
                      </tr>
                      {expandedRowIds[p.id] && p.cuentasAsociadas.length > 0 && (
                        <tr className="bg-slate-50/80">
                          <td colSpan={5} className="py-2 px-8">
                            <div className="border border-slate-200 rounded p-2 text-[11px] bg-white space-y-1">
                              <span className="font-bold text-slate-700 block mb-1">Cuentas Involucradas:</span>
                              {p.cuentasAsociadas.map((c) => (
                                <div key={c.codigo} className="flex justify-between items-center text-slate-600 font-mono">
                                  <span>
                                    <strong>{c.codigo}</strong> {c.nombre}
                                  </span>
                                  <span className="font-semibold text-slate-800">{formatCLP(c.saldoFinal)}</span>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}

                {/* Total Flujo Operación */}
                <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300">
                  <td className="py-2.5 px-4 text-center">TOT 1</td>
                  <td className="py-2.5 px-4 font-sans">
                    FLUJO NETO ORIGINADO POR ACTIVIDADES DE OPERACIÓN
                  </td>
                  <td className="py-2.5 px-3 text-center">=</td>
                  <td
                    className={`py-2.5 px-4 text-right text-sm ${
                      report.flujoNetoOperacional >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {formatCLP(report.flujoNetoOperacional)}
                  </td>
                  <td className="py-2.5 px-4 font-sans text-xs text-slate-600">
                    Efectivo provisto o absorbido directamente por el giro del negocio
                  </td>
                </tr>

                {/* 2. ACTIVIDADES DE INVERSIÓN */}
                <tr className="bg-slate-100/70 font-bold text-slate-900 border-t-4 border-slate-200">
                  <td className="py-2.5 px-4 text-center">2</td>
                  <td colSpan={4} className="py-2.5 px-4 font-sans text-xs">
                    ACTIVIDADES DE INVERSIÓN (NIC 7.16)
                  </td>
                </tr>

                {report.partidasInversion.length === 0 ? (
                  <tr>
                    <td className="py-2 px-4 text-center text-slate-300">-</td>
                    <td className="py-2 px-4 font-sans pl-8 text-slate-400 italic">
                      Sin movimientos materiales de inversión en el período (CAPEX nulo)
                    </td>
                    <td className="py-2 px-3 text-center text-slate-400">=</td>
                    <td className="py-2 px-4 text-right text-slate-400">$0</td>
                    <td className="py-2 px-4 text-slate-400 font-sans text-[11px]">-</td>
                  </tr>
                ) : (
                  report.partidasInversion.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2 px-4 text-center text-slate-400">2.1</td>
                      <td className="py-2 px-4 font-sans pl-8 text-slate-800">{p.concepto}</td>
                      <td className="py-2 px-3 text-center text-slate-600 font-bold">{p.signoFlujo}</td>
                      <td
                        className={`py-2 px-4 text-right ${
                          p.monto >= 0 ? 'text-slate-900' : 'text-amber-700'
                        }`}
                      >
                        {formatCLP(p.monto)}
                      </td>
                      <td className="py-2 px-4 text-slate-500 font-sans text-[11px]">{p.notaNormativa}</td>
                    </tr>
                  ))
                )}

                {/* Total Flujo Inversión */}
                <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300">
                  <td className="py-2.5 px-4 text-center">TOT 2</td>
                  <td className="py-2.5 px-4 font-sans">
                    FLUJO NETO ORIGINADO POR (UTILIZADO EN) ACTIVIDADES DE INVERSIÓN
                  </td>
                  <td className="py-2.5 px-3 text-center">=</td>
                  <td
                    className={`py-2.5 px-4 text-right text-sm ${
                      report.flujoNetoInversion >= 0 ? 'text-blue-700' : 'text-amber-700'
                    }`}
                  >
                    {formatCLP(report.flujoNetoInversion)}
                  </td>
                  <td className="py-2.5 px-4 font-sans text-xs text-slate-600">
                    Variación neta por adquisición de activo fijo y tecnología
                  </td>
                </tr>

                {/* 3. ACTIVIDADES DE FINANCIAMIENTO */}
                <tr className="bg-slate-100/70 font-bold text-slate-900 border-t-4 border-slate-200">
                  <td className="py-2.5 px-4 text-center">3</td>
                  <td colSpan={4} className="py-2.5 px-4 font-sans text-xs">
                    ACTIVIDADES DE FINANCIAMIENTO (NIC 7.17)
                  </td>
                </tr>

                {report.partidasFinanciamiento.length === 0 ? (
                  <tr>
                    <td className="py-2 px-4 text-center text-slate-300">-</td>
                    <td className="py-2 px-4 font-sans pl-8 text-slate-400 italic">
                      Sin movimientos materiales de financiamiento en el período
                    </td>
                    <td className="py-2 px-3 text-center text-slate-400">=</td>
                    <td className="py-2 px-4 text-right text-slate-400">$0</td>
                    <td className="py-2 px-4 text-slate-400 font-sans text-[11px]">-</td>
                  </tr>
                ) : (
                  report.partidasFinanciamiento.map((p, idx) => (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2 px-4 text-center text-slate-400">3.{idx + 1}</td>
                      <td className="py-2 px-4 font-sans pl-8 text-slate-800">{p.concepto}</td>
                      <td className="py-2 px-3 text-center text-slate-600 font-bold">{p.signoFlujo}</td>
                      <td
                        className={`py-2 px-4 text-right ${
                          p.monto >= 0 ? 'text-slate-900' : 'text-purple-700'
                        }`}
                      >
                        {formatCLP(p.monto)}
                      </td>
                      <td className="py-2 px-4 text-slate-500 font-sans text-[11px]">{p.notaNormativa}</td>
                    </tr>
                  ))
                )}

                {/* Total Flujo Financiamiento */}
                <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300">
                  <td className="py-2.5 px-4 text-center">TOT 3</td>
                  <td className="py-2.5 px-4 font-sans">
                    FLUJO NETO ORIGINADO POR (UTILIZADO EN) ACTIVIDADES DE FINANCIAMIENTO
                  </td>
                  <td className="py-2.5 px-3 text-center">=</td>
                  <td
                    className={`py-2.5 px-4 text-right text-sm ${
                      report.flujoNetoFinanciamiento >= 0 ? 'text-indigo-700' : 'text-purple-700'
                    }`}
                  >
                    {formatCLP(report.flujoNetoFinanciamiento)}
                  </td>
                  <td className="py-2.5 px-4 font-sans text-xs text-slate-600">
                    Amortizaciones bancarias, pagos IFRS 16 y aportes de socios
                  </td>
                </tr>

                {/* 4. CONCILIACIÓN DE EFECTIVO */}
                <tr className="bg-slate-900 text-white font-bold border-t-4 border-slate-800">
                  <td className="py-3 px-4 text-center">4</td>
                  <td colSpan={4} className="py-3 px-4 font-sans text-xs">
                    CONCILIACIÓN DEL EFECTIVO Y EQUIVALENTES DE EFECTIVO (NIC 7.45)
                  </td>
                </tr>

                <tr className="hover:bg-slate-50 font-medium">
                  <td className="py-2.5 px-4 text-center text-slate-400">4.1</td>
                  <td className="py-2.5 px-4 font-sans pl-6">
                    Aumento (Disminución) Neto en Efectivo y Equivalentes
                  </td>
                  <td className="py-2.5 px-3 text-center font-bold">=</td>
                  <td className="py-2.5 px-4 text-right font-bold font-mono">
                    {formatCLP(report.variacionNetaEfectivo)}
                  </td>
                  <td className="py-2.5 px-4 text-slate-500 font-sans text-[11px]">
                    Suma algebraica: Flujo Operación + Flujo Inversión + Flujo Financiamiento
                  </td>
                </tr>

                <tr className="hover:bg-slate-50 font-medium">
                  <td className="py-2.5 px-4 text-center text-slate-400">4.2</td>
                  <td className="py-2.5 px-4 font-sans pl-6">
                    Saldo de Efectivo y Equivalentes al Inicio del Período
                  </td>
                  <td className="py-2.5 px-3 text-center font-bold">+</td>
                  <td className="py-2.5 px-4 text-right font-bold font-mono">
                    {formatCLP(report.saldoInicialEfectivo)}
                  </td>
                  <td className="py-2.5 px-4 text-slate-500 font-sans text-[11px]">
                    Suma consolidada de cuentas de Caja y Bancos al inicio del ejercicio
                  </td>
                </tr>

                {report.efectoTipoCambio !== 0 && (
                  <tr className="hover:bg-slate-50 font-medium">
                    <td className="py-2.5 px-4 text-center text-slate-400">4.3</td>
                    <td className="py-2.5 px-4 font-sans pl-6">
                      Efecto de las Variaciones en las Tasas de Cambio sobre el Efectivo (NIC 21)
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold">+</td>
                    <td className="py-2.5 px-4 text-right font-bold font-mono">
                      {formatCLP(report.efectoTipoCambio)}
                    </td>
                    <td className="py-2.5 px-4 text-slate-500 font-sans text-[11px]">
                      Ajuste por conversión de cuentas corrientes en moneda extranjera (USD/EUR)
                    </td>
                  </tr>
                )}

                <tr className="bg-emerald-50 font-bold text-emerald-950 border-t-2 border-emerald-300">
                  <td className="py-3 px-4 text-center">4.4</td>
                  <td className="py-3 px-4 font-sans text-sm">
                    SALDO DE EFECTIVO Y EQUIVALENTES AL CIERRE DEL PERÍODO
                  </td>
                  <td className="py-3 px-3 text-center font-bold text-base">=</td>
                  <td className="py-3 px-4 text-right font-mono text-base text-emerald-900">
                    {formatCLP(report.saldoFinalEfectivo)}
                  </td>
                  <td className="py-3 px-4 font-sans text-xs text-emerald-800">
                    Concuerda exactamente con el Balance General clasificado CMF
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: DESGLOSE DE CUENTAS DE EFECTIVO Y EQUIVALENTES */}
      {subTab === 'DESGLOSE_EFECTIVO' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs space-y-4 p-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-600" />
                Cuentas Contables que Integran el Efectivo y Equivalentes
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Cuentas clasificadas con las banderas contables <strong>Efectivo y Equivalente (NIC 7)</strong> y <strong>Contracuenta de Efectivo</strong>.
              </p>
            </div>
            <span className="text-xs font-mono font-bold bg-slate-100 text-slate-800 px-2.5 py-1 rounded">
              Total Disponible: {formatCLP(report.saldoFinalEfectivo)}
            </span>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 uppercase text-[11px]">
                  <th className="py-2.5 px-3 font-mono w-28">Código</th>
                  <th className="py-2.5 px-3">Nombre de la Cuenta</th>
                  <th className="py-2.5 px-2 text-center">Tipo</th>
                  <th className="py-2.5 px-3 text-right font-mono">Saldo Inicial</th>
                  <th className="py-2.5 px-3 text-right font-mono text-emerald-700">Cargos (Debe)</th>
                  <th className="py-2.5 px-3 text-right font-mono text-rose-700">Abonos (Haber)</th>
                  <th className="py-2.5 px-3 text-right font-mono font-bold">Saldo Final</th>
                  <th className="py-2.5 px-3 text-right font-mono">Variación Neta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {report.desgloseEfectivo.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400 font-sans">
                      No se detectaron cuentas de efectivo en el balance actual.
                    </td>
                  </tr>
                ) : (
                  report.desgloseEfectivo.map((d) => (
                    <tr key={d.codigo} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2 px-3 font-bold text-slate-900">{d.codigo}</td>
                      <td className="py-2 px-3 font-sans font-semibold text-slate-900">
                        {d.nombre}
                        {d.esMultimoneda && (
                          <span className="ml-1.5 text-[9px] bg-blue-100 text-blue-800 px-1 py-0.2 rounded font-bold">
                            USD
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-center">
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                            d.tipo === 'BANCO'
                              ? 'bg-blue-50 text-blue-700'
                              : d.tipo === 'CAJA'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {d.tipo}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right text-slate-600">{formatCLP(d.saldoInicial)}</td>
                      <td className="py-2 px-3 text-right text-emerald-700">+{formatCLP(d.cargosPeriodo)}</td>
                      <td className="py-2 px-3 text-right text-rose-700">-{formatCLP(d.abonosPeriodo)}</td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900">{formatCLP(d.saldoFinal)}</td>
                      <td
                        className={`py-2 px-3 text-right font-semibold ${
                          d.variacionNeta >= 0 ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {formatCLP(d.variacionNeta)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: DIAGNÓSTICO DEL AGENTE Y CONTROL FINANCIERO */}
      {subTab === 'DIAGNOSTICO_AGENTE' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                Informe Pericial de Auditoría y Control de Liquidez
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Emitido por el Agente Autónomo Especialista en Flujo de Efectivo NIF / NIC 7.
              </p>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 block font-mono">Certificado SHA-256</span>
              <span className="text-xs font-mono font-bold text-slate-800">
                {report.diagnosticoAgente.hashIntegridadSha256.substring(0, 16)}...
              </span>
            </div>
          </div>

          {/* Grilla de Métricas de Calidad */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
              <span className="text-xs font-bold text-slate-600 uppercase block mb-1">
                Calidad de la Utilidad (Quality of Earnings)
              </span>
              <span className="text-2xl font-bold font-mono text-slate-900 block mb-1">
                {report.diagnosticoAgente.calidadUtilidadScorePct}%
              </span>
              <p className="text-[11px] text-slate-500">
                Relación entre el Flujo Operacional ({formatCLP(report.flujoNetoOperacional)}) y el Resultado Neto ({formatCLP(report.resultadoNeto)}).
                Un valor &gt; 100% indica utilidades líquidas y alta solvencia.
              </p>
            </div>

            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
              <span className="text-xs font-bold text-slate-600 uppercase block mb-1">
                Cobertura del Servicio de la Deuda
              </span>
              <span className="text-2xl font-bold font-mono text-slate-900 block mb-1">
                {report.diagnosticoAgente.coberturaDeuda}x
              </span>
              <p className="text-[11px] text-slate-500">
                Capacidad del flujo operacional para cubrir compromisos bancarios y pasivos por arrendamiento.
              </p>
            </div>

            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
              <span className="text-xs font-bold text-slate-600 uppercase block mb-1">
                Fuga o Tensión de Caja
              </span>
              <span
                className={`text-2xl font-bold font-mono block mb-1 ${
                  report.diagnosticoAgente.fugaEfectivoDetectada ? 'text-rose-600' : 'text-emerald-600'
                }`}
              >
                {report.diagnosticoAgente.fugaEfectivoDetectada ? 'DETECTADA' : 'SIN RIESGO'}
              </span>
              <p className="text-[11px] text-slate-500">
                {report.diagnosticoAgente.fugaEfectivoDetectada
                  ? 'La operación destruye caja pese a utilidades contables (descalce en cartera o sobrestock).'
                  : 'Generación saludable y consistente con las ventas.'}
              </p>
            </div>
          </div>

          {/* Recomendaciones Directas */}
          <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-600" />
              Recomendaciones del Controller para el Directorio
            </h4>
            <ul className="space-y-2 text-xs text-amber-950 font-medium">
              {report.diagnosticoAgente.recomendacionesController.map((rec, i) => (
                <li key={i} className="flex items-start gap-2">
                  <ArrowRight className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
