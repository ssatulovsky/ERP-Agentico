import React, { useState, useMemo } from 'react';
import {
  ExpenseReport,
  ExpenseItem,
  HierarchicalAccountItem,
  AccountingEntry,
} from '../../types';
import {
  generateExpenseAccountingEntry,
  ExpenseAccountingConfig,
} from '../../utils/expenseManagementAgent';
import {
  Scale,
  X,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Calendar,
  User,
  DollarSign,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

interface CentralizeExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: ExpenseReport;
  comprobantes: ExpenseItem[];
  chartOfAccounts?: HierarchicalAccountItem[];
  onConfirm: (config: ExpenseAccountingConfig) => Promise<void>;
}

export const CentralizeExpenseModal: React.FC<CentralizeExpenseModalProps> = ({
  isOpen,
  onClose,
  report,
  comprobantes,
  chartOfAccounts = [],
  onConfirm,
}) => {
  const defaultFecha = report.fechaCierre || new Date().toISOString().substring(0, 10);
  const defaultPeriodo = defaultFecha.substring(0, 7);

  // Estados de configuración
  const [fechaContable, setFechaContable] = useState(defaultFecha);
  const [cuentaAnticipoCodigo, setCuentaAnticipoCodigo] = useState('1.1.03.002');
  const [cuentaReembolsoCodigo, setCuentaReembolsoCodigo] = useState('2.1.02.001');
  const [cuentaReintegroCodigo, setCuentaReintegroCodigo] = useState('1.1.02.001');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Helpers para obtener nombre de cuenta
  const getAccountName = (code: string, fallback: string) => {
    const acc = chartOfAccounts.find((a) => a.codigo === code);
    return acc ? acc.nombre : fallback;
  };

  const ctaAnticipoNom = getAccountName(cuentaAnticipoCodigo, 'Gastos por Rendir / Anticipos al Personal');
  const ctaReembolsoNom = getAccountName(cuentaReembolsoCodigo, 'Cuentas por Pagar al Personal (Reembolso de Gastos)');
  const ctaReintegroNom = getAccountName(cuentaReintegroCodigo, 'Banco Santander Chile - Reintegro Sobrante de Fondo');

  // Configuración actual
  const currentConfig: ExpenseAccountingConfig = useMemo(() => {
    return {
      fechaContable,
      cuentaAnticipoCodigo,
      cuentaAnticipoNombre: ctaAnticipoNom,
      cuentaReembolsoCodigo,
      cuentaReembolsoNombre: ctaReembolsoNom,
      cuentaReintegroCodigo,
      cuentaReintegroNombre: ctaReintegroNom,
    };
  }, [
    fechaContable,
    cuentaAnticipoCodigo,
    ctaAnticipoNom,
    cuentaReembolsoCodigo,
    ctaReembolsoNom,
    cuentaReintegroCodigo,
    ctaReintegroNom,
  ]);

  // Generar asiento contable proyectado en tiempo real
  const projectedEntry: AccountingEntry = useMemo(() => {
    return generateExpenseAccountingEntry(report, comprobantes, chartOfAccounts, currentConfig);
  }, [report, comprobantes, chartOfAccounts, currentConfig]);

  if (!isOpen) return null;

  const totalGastos = comprobantes.reduce((sum, item) => sum + (item.montoTotalClp || 0), 0) || report.montoTotalRendidoClp;
  const fondo = Number(report.fondoAsignadoClp || 0);
  const saldoReembolso = Math.max(0, totalGastos - fondo);
  const saldoReintegro = Math.max(0, fondo - totalGastos);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm(currentConfig);
      onClose();
    } catch (err) {
      console.error('[CentralizeExpenseModal] Error al confirmar:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtrar cuentas auxiliares del plan de cuentas para selects
  const anticipoOptions = chartOfAccounts.filter(
    (a) => a.codigo.startsWith('1.1.03') || a.codigo.startsWith('1.1.01')
  );
  const reembolsoOptions = chartOfAccounts.filter(
    (a) => a.codigo.startsWith('2.1.02') || a.codigo.startsWith('2.1.05') || a.codigo.startsWith('2.1.01')
  );
  const bancoOptions = chartOfAccounts.filter(
    (a) => a.codigo.startsWith('1.1.02') || a.codigo.startsWith('1.1.01')
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Cabecera */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/20 rounded-xl border border-indigo-400/30">
              <Scale className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs bg-indigo-500/30 text-indigo-200 px-2.5 py-0.5 rounded-md font-bold">
                  {report.folio}
                </span>
                <h2 className="text-base font-bold text-white">
                  Configuración y Centralización Contable en Libro Diario
                </h2>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Revise o ajuste las contrapartidas normativas antes de emitir el asiento oficial
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo con Scroll */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800">
          
          {/* Ficha Resumen de la Rendición */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Rendidor</span>
              <span className="text-xs font-bold text-slate-900 block truncate">{report.rendidorNombre}</span>
              <span className="text-[10px] font-mono text-slate-500">{report.rendidorRut}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Fondo Anticipado</span>
              <span className="text-xs font-mono font-bold text-slate-900 block">
                ${fondo.toLocaleString('es-CL')}
              </span>
              <span className="text-[10px] text-slate-500">Asignado al colaborador</span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Total Gastos Rendidos</span>
              <span className="text-xs font-mono font-bold text-indigo-700 block">
                ${totalGastos.toLocaleString('es-CL')}
              </span>
              <span className="text-[10px] text-slate-500">{comprobantes.length} comprobante(s)</span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Liquidación Final</span>
              {saldoReembolso > 0 ? (
                <span className="text-xs font-mono font-black text-emerald-700 block">
                  Reembolso: +${saldoReembolso.toLocaleString('es-CL')}
                </span>
              ) : saldoReintegro > 0 ? (
                <span className="text-xs font-mono font-black text-amber-700 block">
                  Reintegro Empresa: -${saldoReintegro.toLocaleString('es-CL')}
                </span>
              ) : (
                <span className="text-xs font-mono font-bold text-slate-600 block">
                  Fondo Exacto ($0)
                </span>
              )}
              <span className="text-[10px] text-slate-500">
                {saldoReembolso > 0 ? 'A pagar al empleado' : saldoReintegro > 0 ? 'Devolución a banco/caja' : 'Cuadre perfecto'}
              </span>
            </div>
          </div>

          {/* Formulario de Configuración Contable */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-600" />
              Parámetros de Imputación y Plan de Cuentas (Normativa Chilena)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Fecha Contable */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  Fecha Contable del Asiento
                </label>
                <input
                  type="date"
                  value={fechaContable}
                  onChange={(e) => setFechaContable(e.target.value)}
                  className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">Periodo fiscal: {fechaContable.substring(0, 7)}</span>
              </div>

              {/* Cuenta Fondos por Rendir (Anticipos) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Cuenta Fondos por Rendir (Anticipo)
                </label>
                <select
                  value={cuentaAnticipoCodigo}
                  onChange={(e) => setCuentaAnticipoCodigo(e.target.value)}
                  className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="1.1.03.002">1.1.03.002 - Gastos por Rendir / Anticipos al Personal</option>
                  <option value="1.1.01.004">1.1.01.004 - Fondos y Anticipos por Rendir (Efectivo)</option>
                  {anticipoOptions.map((a) => (
                    a.codigo !== '1.1.03.002' && a.codigo !== '1.1.01.004' ? (
                      <option key={a.codigo} value={a.codigo}>
                        {a.codigo} - {a.nombre}
                      </option>
                    ) : null
                  ))}
                </select>
                <span className="text-[10px] text-slate-500 mt-1 block">Liquida el anticipo entregado al rendidor</span>
              </div>

              {/* Cuenta Reembolso o Reintegro */}
              {saldoReembolso > 0 ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Cuenta Pasivo Reembolso Personal
                  </label>
                  <select
                    value={cuentaReembolsoCodigo}
                    onChange={(e) => setCuentaReembolsoCodigo(e.target.value)}
                    className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="2.1.02.001">2.1.02.001 - Cuentas por Pagar al Personal (Reembolsos)</option>
                    <option value="2.1.05.002">2.1.05.002 - Otras Cuentas por Pagar al Personal</option>
                    {reembolsoOptions.map((a) => (
                      a.codigo !== '2.1.02.001' && a.codigo !== '2.1.05.002' ? (
                        <option key={a.codigo} value={a.codigo}>
                          {a.codigo} - {a.nombre}
                        </option>
                      ) : null
                    ))}
                  </select>
                  <span className="text-[10px] text-slate-500 mt-1 block">Pasivo por saldo adeudado al colaborador</span>
                </div>
              ) : saldoReintegro > 0 ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Cuenta Banco / Caja Reintegro Sobrante
                  </label>
                  <select
                    value={cuentaReintegroCodigo}
                    onChange={(e) => setCuentaReintegroCodigo(e.target.value)}
                    className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="1.1.02.001">1.1.02.001 - Banco Santander Chile (Cta Cte)</option>
                    <option value="1.1.02.002">1.1.02.002 - Banco de Chile (Cta Cte)</option>
                    <option value="1.1.01.001">1.1.01.001 - Caja Central (Efectivo)</option>
                    {bancoOptions.map((a) => (
                      !['1.1.02.001', '1.1.02.002', '1.1.01.001'].includes(a.codigo) ? (
                        <option key={a.codigo} value={a.codigo}>
                          {a.codigo} - {a.nombre}
                        </option>
                      ) : null
                    ))}
                  </select>
                  <span className="text-[10px] text-slate-500 mt-1 block">Cuenta receptora de la devolución</span>
                </div>
              ) : (
                <div className="flex items-center text-xs text-slate-500 p-2 bg-slate-50 rounded-lg">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 mr-2 shrink-0" />
                  <span>Sin saldo a reembolsar ni reintegrar.</span>
                </div>
              )}
            </div>
          </div>

          {/* Previsualización en Vivo del Asiento Contable */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="bg-slate-100 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-700" />
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                  Previsualización del Asiento en Libro Diario
                </h4>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-slate-600">
                  Concepto: {projectedEntry.concepto}
                </span>
                {projectedEntry.balanceado ? (
                  <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Balanceado
                  </span>
                ) : (
                  <span className="bg-rose-100 text-rose-800 border border-rose-300 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-rose-600" />
                    Descuadrado
                  </span>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold text-[11px]">
                    <th className="py-2.5 px-3">Cuenta Código</th>
                    <th className="py-2.5 px-3">Nombre Cuenta</th>
                    <th className="py-2.5 px-3">Auxiliar (RUT)</th>
                    <th className="py-2.5 px-3">Referencia</th>
                    <th className="py-2.5 px-3">Centro Costo</th>
                    <th className="py-2.5 px-3 text-right">Debe ($)</th>
                    <th className="py-2.5 px-3 text-right">Haber ($)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {projectedEntry.lineas.map((l: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2 px-3 font-mono text-[11px] font-bold text-indigo-700">
                        {l.cuentaCodigo}
                      </td>
                      <td className="py-2 px-3 font-medium text-slate-800">
                        {l.cuentaNombre}
                      </td>
                      <td className="py-2 px-3 font-mono text-[11px] text-slate-600">
                        {l.rutAuxiliar || '-'}
                      </td>
                      <td className="py-2 px-3 font-mono text-[11px] text-slate-500">
                        {l.documentoRef || report.folio}
                      </td>
                      <td className="py-2 px-3 text-slate-600 text-[11px]">
                        {l.centroCosto || '-'}
                      </td>
                      <td className="py-2 px-3 font-mono text-right font-bold text-slate-900">
                        {l.debe > 0 ? `$${Number(l.debe).toLocaleString('es-CL')}` : '-'}
                      </td>
                      <td className="py-2 px-3 font-mono text-right font-bold text-slate-900">
                        {l.haber > 0 ? `$${Number(l.haber).toLocaleString('es-CL')}` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100/80 font-black border-t-2 border-slate-300 text-slate-900 text-xs">
                    <td colSpan={5} className="py-2.5 px-3 text-right uppercase tracking-wider">
                      Totales Asiento:
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-indigo-900">
                      ${Number(projectedEntry.totalDebe).toLocaleString('es-CL')}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-indigo-900">
                      ${Number(projectedEntry.totalHaber).toLocaleString('es-CL')}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

        </div>

        {/* Footer con Acciones */}
        <div className="bg-slate-100 p-4 border-t border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Inserción transaccional ACID garantizada en MySQL 8.0</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-200 font-bold rounded-xl text-xs transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || !projectedEntry.balanceado}
              className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl text-xs transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <span>Asentando en Libro Diario...</span>
              ) : (
                <>
                  <Scale className="w-4 h-4" />
                  <span>Confirmar y Asentar en Libro Diario</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
