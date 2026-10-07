import React, { useState } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Layers,
  Sparkles,
  Download,
  Check,
  FileSpreadsheet,
  ListTree,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  GroupedBalanceReport,
  GroupedBalanceItem,
  TrialBalance8ColAccount,
} from '../../types';

interface GroupedBalanceViewProps {
  report: GroupedBalanceReport;
  convertAmount: (amount: number) => string;
  searchTerm?: string;
  onCopyJSON?: () => void;
  copiedText?: string | null;
}

export const GroupedBalanceView: React.FC<GroupedBalanceViewProps> = ({
  report,
  convertAmount,
  searchTerm = '',
  onCopyJSON,
  copiedText,
}) => {
  // Estado de grupos expandidos: por defecto expandidos
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    report.grupos.forEach((g) => {
      init[g.id] = true;
      g.subgrupos.forEach((sub) => {
        init[sub.id] = true;
      });
    });
    return init;
  });

  const [showOnlyTotals, setShowOnlyTotals] = useState(false);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleExpandAll = () => {
    const allExp: Record<string, boolean> = {};
    report.grupos.forEach((g) => {
      allExp[g.id] = true;
      g.subgrupos.forEach((sub) => {
        allExp[sub.id] = true;
      });
    });
    setExpandedIds(allExp);
  };

  const handleCollapseAll = () => {
    setExpandedIds({});
  };

  const handleExportCSV = () => {
    const headers = [
      'Agrupacion / Codigo',
      'Titulo / Nombre Cuenta',
      'Nivel',
      'Debitos',
      'Creditos',
      'Saldo Deudor',
      'Saldo Acreedor',
      'Activo',
      'Pasivo',
      'Perdida',
      'Ganancia',
    ];

    const rows: string[][] = [];

    const processGroup = (item: GroupedBalanceItem, prefix = '') => {
      rows.push([
        `"${prefix}${item.codigo}"`,
        `"${item.titulo.replace(/"/g, '""')}"`,
        `"Nivel ${item.nivel} (Grupo)"`,
        String(item.totales.total_debitos),
        String(item.totales.total_creditos),
        String(item.totales.total_saldo_deudor),
        String(item.totales.total_saldo_acreedor),
        String(item.totales.total_activo),
        String(item.totales.total_pasivo),
        String(item.totales.total_perdida),
        String(item.totales.total_ganancia),
      ]);

      item.subgrupos.forEach((sub) => processGroup(sub, '  '));

      if (!showOnlyTotals) {
        item.cuentas.forEach((c) => {
          rows.push([
            `"    ${c.codigo}"`,
            `"${c.nombre.replace(/"/g, '""')}"`,
            '"Cuenta Analitica"',
            String(c.debitos),
            String(c.creditos),
            String(c.saldo_deudor),
            String(c.saldo_acreedor),
            String(c.activo),
            String(c.pasivo),
            String(c.perdida),
            String(c.ganancia),
          ]);
        });
      }
    };

    report.grupos.forEach((g) => processGroup(g));

    // Totales generales
    rows.push([
      '"TOTALES GENERALES"',
      `"Total Balance (${report.nombreEsquema})"`,
      '"TOTAL"',
      String(report.totalesGenerales.total_debitos),
      String(report.totalesGenerales.total_creditos),
      String(report.totalesGenerales.total_saldo_deudor),
      String(report.totalesGenerales.total_saldo_acreedor),
      String(report.totalesGenerales.total_activo),
      String(report.totalesGenerales.total_pasivo),
      String(report.totalesGenerales.total_perdida),
      String(report.totalesGenerales.total_ganancia),
    ]);

    const csvContent = [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Balance_Agrupado_${report.modo}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Top Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
        <div className="flex items-center gap-2">
          <ListTree className="w-4 h-4 text-blue-600" />
          <span className="font-bold text-slate-800">
            {report.nombreEsquema}
          </span>
          <span className="text-slate-400">·</span>
          <span className="text-slate-500 hidden md:inline">
            {report.descripcionEsquema}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
          <button
            onClick={() => setShowOnlyTotals(!showOnlyTotals)}
            className={`px-2.5 py-1 rounded-lg border text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
              showOnlyTotals
                ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
            }`}
            title="Ocultar o mostrar cuentas individuales y ver únicamente los subtotales por grupo"
          >
            {showOnlyTotals ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span>{showOnlyTotals ? 'Ver Detalle Cuentas' : 'Solo Totales de Grupos'}</span>
          </button>

          <button
            onClick={handleExpandAll}
            className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold cursor-pointer"
          >
            Expandir Todos
          </button>

          <button
            onClick={handleCollapseAll}
            className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold cursor-pointer"
          >
            Colapsar Todos
          </button>

          <button
            onClick={handleExportCSV}
            className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer shadow-2xs"
            title="Exportar balance con grupos y subtotales a Excel"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Excel Agrupado</span>
          </button>

          {onCopyJSON && (
            <button
              onClick={onCopyJSON}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
            >
              {copiedText === 'balance_json' ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>JSON</span>
            </button>
          )}
        </div>
      </div>

      {/* Grouped Table */}
      <div className="overflow-x-auto border border-slate-200 rounded-lg shadow-2xs">
        <table className="w-full text-xs text-right border-collapse">
          <thead>
            {/* Main Header */}
            <tr className="bg-[#0f172a] text-white text-[11px] font-semibold uppercase tracking-wider">
              <th rowSpan={2} className="py-2.5 px-3 text-left border-r border-slate-700 w-36">
                Código / Nivel
              </th>
              <th rowSpan={2} className="py-2.5 px-3 text-left border-r border-slate-700">
                Agrupación / Cuenta Contable
              </th>
              <th colSpan={2} className="py-2 px-3 text-center border-r border-slate-700 bg-slate-800">
                1-2. Sumas
              </th>
              <th colSpan={2} className="py-2 px-3 text-center border-r border-slate-700 bg-slate-800">
                3-4. Saldos
              </th>
              <th colSpan={2} className="py-2 px-3 text-center border-r border-slate-700 bg-blue-900/70">
                5-6. Inventario
              </th>
              <th colSpan={2} className="py-2 px-3 text-center bg-emerald-900/70">
                7-8. Resultado
              </th>
            </tr>
            {/* Sub Header */}
            <tr className="bg-slate-100 text-slate-700 text-[10px] font-bold uppercase border-b border-slate-300">
              <th className="py-1.5 px-2.5 border-r border-slate-200">Débito ($)</th>
              <th className="py-1.5 px-2.5 border-r border-slate-200">Crédito ($)</th>
              <th className="py-1.5 px-2.5 border-r border-slate-200">Deudor ($)</th>
              <th className="py-1.5 px-2.5 border-r border-slate-200">Acreedor ($)</th>
              <th className="py-1.5 px-2.5 border-r border-slate-200 bg-blue-50 text-blue-900">Activo ($)</th>
              <th className="py-1.5 px-2.5 border-r border-slate-200 bg-blue-50 text-blue-900">Pasivo ($)</th>
              <th className="py-1.5 px-2.5 border-r border-slate-200 bg-rose-50 text-rose-900">Pérdida ($)</th>
              <th className="py-1.5 px-2.5 bg-emerald-50 text-emerald-900">Ganancia ($)</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
            {report.grupos.map((grupo) => {
              const isGroupExpanded = expandedIds[grupo.id] !== false;

              return (
                <React.Fragment key={grupo.id}>
                  {/* FILA DE CABECERA DEL GRUPO PRINCIPAL (Nivel 1 o Grupo) */}
                  <tr
                    onClick={() => toggleExpand(grupo.id)}
                    className="bg-slate-100/95 hover:bg-slate-200/80 cursor-pointer border-t-2 border-slate-300 font-bold select-none transition-colors"
                  >
                    <td className="py-2.5 px-3 text-left border-r border-slate-200 text-slate-900">
                      <div className="flex items-center gap-1.5">
                        {isGroupExpanded ? (
                          <ChevronDown className="w-4 h-4 text-slate-600 shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-slate-600 shrink-0" />
                        )}
                        <span className="font-mono">{grupo.codigo}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-left font-sans text-slate-900 border-r border-slate-200">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs">{grupo.titulo}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-300/60 text-slate-800 font-mono font-normal">
                          {grupo.cuentas.length} partidas
                        </span>
                      </div>
                    </td>
                    {/* Subtotales del Grupo */}
                    <td className="py-2.5 px-2.5 text-slate-900 border-r border-slate-200 font-bold">
                      {grupo.totales.total_debitos > 0 ? convertAmount(grupo.totales.total_debitos) : '-'}
                    </td>
                    <td className="py-2.5 px-2.5 text-slate-900 border-r border-slate-200 font-bold">
                      {grupo.totales.total_creditos > 0 ? convertAmount(grupo.totales.total_creditos) : '-'}
                    </td>
                    <td className="py-2.5 px-2.5 text-emerald-900 border-r border-slate-200 font-bold">
                      {grupo.totales.total_saldo_deudor > 0 ? convertAmount(grupo.totales.total_saldo_deudor) : '-'}
                    </td>
                    <td className="py-2.5 px-2.5 text-blue-900 border-r border-slate-200 font-bold">
                      {grupo.totales.total_saldo_acreedor > 0 ? convertAmount(grupo.totales.total_saldo_acreedor) : '-'}
                    </td>
                    <td className="py-2.5 px-2.5 text-blue-950 bg-blue-100/40 border-r border-slate-200 font-bold">
                      {grupo.totales.total_activo > 0 ? convertAmount(grupo.totales.total_activo) : '-'}
                    </td>
                    <td className="py-2.5 px-2.5 text-blue-950 bg-blue-100/40 border-r border-slate-200 font-bold">
                      {grupo.totales.total_pasivo > 0 ? convertAmount(grupo.totales.total_pasivo) : '-'}
                    </td>
                    <td className="py-2.5 px-2.5 text-rose-950 bg-rose-100/40 border-r border-slate-200 font-bold">
                      {grupo.totales.total_perdida > 0 ? convertAmount(grupo.totales.total_perdida) : '-'}
                    </td>
                    <td className="py-2.5 px-2.5 text-emerald-950 bg-emerald-100/40 font-bold">
                      {grupo.totales.total_ganancia > 0 ? convertAmount(grupo.totales.total_ganancia) : '-'}
                    </td>
                  </tr>

                  {/* Si está expandido y tiene SUBGRUPOS (Modo Tradicional CMF) */}
                  {isGroupExpanded &&
                    grupo.subgrupos.map((subgrp) => {
                      const isSubExpanded = expandedIds[subgrp.id] !== false;

                      return (
                        <React.Fragment key={subgrp.id}>
                          {/* Fila Encabezado de Subgrupo (Nivel 2 o 3) */}
                          <tr
                            onClick={() => toggleExpand(subgrp.id)}
                            className="bg-slate-50/90 hover:bg-slate-100/90 cursor-pointer border-t border-slate-200 font-semibold select-none transition-colors"
                          >
                            <td className="py-2 px-3 text-left border-r border-slate-200 pl-6 text-slate-800">
                              <div className="flex items-center gap-1">
                                {isSubExpanded ? (
                                  <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                ) : (
                                  <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                )}
                                <span className="font-mono text-[11px] font-bold">{subgrp.codigo}</span>
                              </div>
                            </td>
                            <td className="py-2 px-3 text-left font-sans text-slate-800 border-r border-slate-200 pl-6">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold">{subgrp.titulo}</span>
                                <span className="text-[10px] text-slate-500 font-mono">
                                  ({subgrp.cuentas.length} ctas)
                                </span>
                              </div>
                            </td>
                            {/* Subtotales del Subgrupo */}
                            <td className="py-2 px-2.5 text-slate-800 border-r border-slate-200">
                              {subgrp.totales.total_debitos > 0 ? convertAmount(subgrp.totales.total_debitos) : '-'}
                            </td>
                            <td className="py-2 px-2.5 text-slate-800 border-r border-slate-200">
                              {subgrp.totales.total_creditos > 0 ? convertAmount(subgrp.totales.total_creditos) : '-'}
                            </td>
                            <td className="py-2 px-2.5 text-emerald-800 border-r border-slate-200 font-semibold">
                              {subgrp.totales.total_saldo_deudor > 0 ? convertAmount(subgrp.totales.total_saldo_deudor) : '-'}
                            </td>
                            <td className="py-2 px-2.5 text-blue-800 border-r border-slate-200 font-semibold">
                              {subgrp.totales.total_saldo_acreedor > 0 ? convertAmount(subgrp.totales.total_saldo_acreedor) : '-'}
                            </td>
                            <td className="py-2 px-2.5 text-blue-900 bg-blue-50/50 border-r border-slate-200 font-semibold">
                              {subgrp.totales.total_activo > 0 ? convertAmount(subgrp.totales.total_activo) : '-'}
                            </td>
                            <td className="py-2 px-2.5 text-blue-900 bg-blue-50/50 border-r border-slate-200 font-semibold">
                              {subgrp.totales.total_pasivo > 0 ? convertAmount(subgrp.totales.total_pasivo) : '-'}
                            </td>
                            <td className="py-2 px-2.5 text-rose-800 bg-rose-50/50 border-r border-slate-200 font-semibold">
                              {subgrp.totales.total_perdida > 0 ? convertAmount(subgrp.totales.total_perdida) : '-'}
                            </td>
                            <td className="py-2 px-2.5 text-emerald-800 bg-emerald-50/50 font-semibold">
                              {subgrp.totales.total_ganancia > 0 ? convertAmount(subgrp.totales.total_ganancia) : '-'}
                            </td>
                          </tr>

                          {/* Cuentas Analíticas dentro del Subgrupo (si no está activo showOnlyTotals) */}
                          {isSubExpanded &&
                            !showOnlyTotals &&
                            subgrp.cuentas.map((c) => (
                              <tr key={c.codigo} className="hover:bg-amber-50/30 transition-colors">
                                <td className="py-1.5 px-3 text-left font-mono font-medium text-slate-700 border-r border-slate-100 pl-10">
                                  {c.codigo}
                                </td>
                                <td className="py-1.5 px-3 text-left font-sans text-slate-800 border-r border-slate-100 pl-10 truncate max-w-xs">
                                  {c.nombre}
                                </td>
                                <td className="py-1.5 px-2.5 text-slate-600 border-r border-slate-100">
                                  {c.debitos > 0 ? convertAmount(c.debitos) : '-'}
                                </td>
                                <td className="py-1.5 px-2.5 text-slate-600 border-r border-slate-100">
                                  {c.creditos > 0 ? convertAmount(c.creditos) : '-'}
                                </td>
                                <td className="py-1.5 px-2.5 text-emerald-700 border-r border-slate-100">
                                  {c.saldo_deudor > 0 ? convertAmount(c.saldo_deudor) : '-'}
                                </td>
                                <td className="py-1.5 px-2.5 text-blue-700 border-r border-slate-100">
                                  {c.saldo_acreedor > 0 ? convertAmount(c.saldo_acreedor) : '-'}
                                </td>
                                <td className="py-1.5 px-2.5 text-blue-900 bg-blue-50/20 border-r border-slate-100">
                                  {c.activo > 0 ? convertAmount(c.activo) : '-'}
                                </td>
                                <td className="py-1.5 px-2.5 text-blue-900 bg-blue-50/20 border-r border-slate-100">
                                  {c.pasivo > 0 ? convertAmount(c.pasivo) : '-'}
                                </td>
                                <td className="py-1.5 px-2.5 text-rose-800 bg-rose-50/20 border-r border-slate-100">
                                  {c.perdida > 0 ? convertAmount(c.perdida) : '-'}
                                </td>
                                <td className="py-1.5 px-2.5 text-emerald-800 bg-emerald-50/20">
                                  {c.ganancia > 0 ? convertAmount(c.ganancia) : '-'}
                                </td>
                              </tr>
                            ))}
                        </React.Fragment>
                      );
                    })}

                  {/* Si el grupo contiene cuentas directamente (Modos Fiscal, Casa Matriz o Personalizada) */}
                  {isGroupExpanded &&
                    grupo.subgrupos.length === 0 &&
                    !showOnlyTotals &&
                    grupo.cuentas.map((c) => (
                      <tr key={c.codigo} className="hover:bg-amber-50/30 transition-colors">
                        <td className="py-1.5 px-3 text-left font-mono font-medium text-slate-700 border-r border-slate-100 pl-8">
                          {c.codigo}
                        </td>
                        <td className="py-1.5 px-3 text-left font-sans text-slate-800 border-r border-slate-100 pl-8 truncate max-w-xs">
                          {c.nombre}
                        </td>
                        <td className="py-1.5 px-2.5 text-slate-600 border-r border-slate-100">
                          {c.debitos > 0 ? convertAmount(c.debitos) : '-'}
                        </td>
                        <td className="py-1.5 px-2.5 text-slate-600 border-r border-slate-100">
                          {c.creditos > 0 ? convertAmount(c.creditos) : '-'}
                        </td>
                        <td className="py-1.5 px-2.5 text-emerald-700 border-r border-slate-100">
                          {c.saldo_deudor > 0 ? convertAmount(c.saldo_deudor) : '-'}
                        </td>
                        <td className="py-1.5 px-2.5 text-blue-700 border-r border-slate-100">
                          {c.saldo_acreedor > 0 ? convertAmount(c.saldo_acreedor) : '-'}
                        </td>
                        <td className="py-1.5 px-2.5 text-blue-900 bg-blue-50/20 border-r border-slate-100">
                          {c.activo > 0 ? convertAmount(c.activo) : '-'}
                        </td>
                        <td className="py-1.5 px-2.5 text-blue-900 bg-blue-50/20 border-r border-slate-100">
                          {c.pasivo > 0 ? convertAmount(c.pasivo) : '-'}
                        </td>
                        <td className="py-1.5 px-2.5 text-rose-800 bg-rose-50/20 border-r border-slate-100">
                          {c.perdida > 0 ? convertAmount(c.perdida) : '-'}
                        </td>
                        <td className="py-1.5 px-2.5 text-emerald-800 bg-emerald-50/20">
                          {c.ganancia > 0 ? convertAmount(c.ganancia) : '-'}
                        </td>
                      </tr>
                    ))}
                </React.Fragment>
              );
            })}
          </tbody>

          {/* TFOOT: SUBTOTAIS GERAIS Y RESULTADO DEL EJERCICIO */}
          <tfoot className="font-mono text-[11px] font-bold">
            <tr className="bg-slate-200/90 text-slate-900 border-t-2 border-slate-400">
              <td colSpan={2} className="py-2.5 px-3 text-left uppercase text-[11px] border-r border-slate-300">
                Totales Consolidados del Balance:
              </td>
              <td className="py-2.5 px-2.5 border-r border-slate-300 text-slate-950 font-bold">
                {convertAmount(report.totalesGenerales.total_debitos)}
              </td>
              <td className="py-2.5 px-2.5 border-r border-slate-300 text-slate-950 font-bold">
                {convertAmount(report.totalesGenerales.total_creditos)}
              </td>
              <td className="py-2.5 px-2.5 border-r border-slate-300 text-emerald-900 font-bold">
                {convertAmount(report.totalesGenerales.total_saldo_deudor)}
              </td>
              <td className="py-2.5 px-2.5 border-r border-slate-300 text-blue-900 font-bold">
                {convertAmount(report.totalesGenerales.total_saldo_acreedor)}
              </td>
              <td className="py-2.5 px-2.5 border-r border-slate-300 bg-blue-100 text-blue-950 font-bold">
                {convertAmount(report.totalesGenerales.total_activo)}
              </td>
              <td className="py-2.5 px-2.5 border-r border-slate-300 bg-blue-100 text-blue-950 font-bold">
                {convertAmount(report.totalesGenerales.total_pasivo)}
              </td>
              <td className="py-2.5 px-2.5 border-r border-slate-300 bg-rose-100 text-rose-950 font-bold">
                {convertAmount(report.totalesGenerales.total_perdida)}
              </td>
              <td className="py-2.5 px-2.5 bg-emerald-100 text-emerald-950 font-bold">
                {convertAmount(report.totalesGenerales.total_ganancia)}
              </td>
            </tr>

            {/* Fila Oficial de Utilidad / Pérdida del Ejercicio con Cuadre Simétrico */}
            <tr className="bg-amber-50 text-amber-950 border-t border-amber-200 font-bold">
              <td colSpan={2} className="py-2.5 px-3 text-left uppercase text-[11px] border-r border-amber-200 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span>
                  {report.resultado_del_ejercicio.tipo === 'UTILIDAD'
                    ? 'Utilidad del Ejercicio Actual'
                    : 'Pérdida del Ejercicio Actual'}
                </span>
              </td>
              <td colSpan={4} className="py-2.5 px-2.5 text-center text-slate-500 border-r border-amber-200 font-sans text-xs">
                (Cuadre simétrico garantizado entre Inventario y Resultado)
              </td>
              {/* Inventario Balance Line */}
              <td className="py-2.5 px-2.5 border-r border-amber-200 text-amber-950 font-bold">
                {report.resultado_del_ejercicio.tipo === 'PERDIDA'
                  ? convertAmount(report.resultado_del_ejercicio.monto)
                  : '-'}
              </td>
              <td className="py-2.5 px-2.5 border-r border-amber-200 text-amber-950 font-bold">
                {report.resultado_del_ejercicio.tipo === 'UTILIDAD'
                  ? convertAmount(report.resultado_del_ejercicio.monto)
                  : '-'}
              </td>
              {/* Resultado Balance Line */}
              <td className="py-2.5 px-2.5 border-r border-amber-200 text-amber-950 font-bold">
                {report.resultado_del_ejercicio.tipo === 'UTILIDAD'
                  ? convertAmount(report.resultado_del_ejercicio.monto)
                  : '-'}
              </td>
              <td className="py-2.5 px-2.5 text-amber-950 font-bold">
                {report.resultado_del_ejercicio.tipo === 'PERDIDA'
                  ? convertAmount(report.resultado_del_ejercicio.monto)
                  : '-'}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
