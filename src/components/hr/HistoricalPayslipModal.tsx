import React from 'react';
import { 
  X, 
  Printer, 
  Copy, 
  Check, 
  ShieldCheck, 
  Building2, 
  User, 
  Calendar, 
  DollarSign, 
  FileCheck2,
  Download,
  Info
} from 'lucide-react';
import type { EmployeePayroll, CompanyProfile } from '../../types';
import { formatCLP, formatNumberCL, formatNumberToWordsCLP } from '../../utils/chileanAccounting';

interface Props {
  payroll: EmployeePayroll;
  company: CompanyProfile;
  periodo: string;
  onClose: () => void;
}

export const HistoricalPayslipModal: React.FC<Props> = ({
  payroll,
  company,
  periodo,
  onClose,
}) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopySummary = () => {
    const text = `LIQUIDACIÓN HISTÓRICA DT - PERÍODO ${periodo}
Empresa: ${company.razonSocial} (${company.rut})
Trabajador: ${payroll.nombreCompleto} (${payroll.rut})
Cargo: ${payroll.cargo} | Depto: ${payroll.departamento}
Total Imponible: ${formatCLP(payroll.totalHaberesImponibles)}
Total Haberes: ${formatCLP(payroll.totalHaberesBrutos)}
Total Descuentos: ${formatCLP(payroll.totalDescuentos)}
LÍQUIDO A PAGAR: ${formatCLP(payroll.sueldoLiquido)}
Aporte Ley 21.735 (1%): ${formatCLP(payroll.reformaPrevisionalLey21735Monto || Math.round(payroll.totalHaberesImponibles * 0.01))}
Certificado DT: CERT-DT-${periodo.replace('-', '')}-${payroll.rut.replace(/[^0-9Kk]/g, '')}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  const ley21735Monto = payroll.reformaPrevisionalLey21735Monto || Math.round(payroll.totalHaberesImponibles * 0.01);
  const wordsAmount = formatNumberToWordsCLP(payroll.sueldoLiquido);
  const folioDt = `CERT-DT-${periodo.replace('-', '')}-${payroll.rut.replace(/[^0-9Kk]/g, '')}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white border border-slate-300 rounded-2xl max-w-4xl w-full p-5 sm:p-7 shadow-2xl space-y-5 my-8 max-h-[92vh] flex flex-col">
        {/* Cabecera de Control del Modal (No imprimible) */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 print:hidden">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-blue-50 text-blue-700 rounded-xl">
              <FileCheck2 className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base font-black text-slate-900">
                Recibo de Sueldo Oficial (Liquidación DT)
              </h2>
              <p className="text-xs text-slate-500">
                Período auditado: <span className="font-mono font-bold text-blue-700">{periodo}</span> • Cumplimiento Art. 54 Código del Trabajo
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopySummary}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copiado' : 'Copiar Resumen'}</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir / PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* CONTENEDOR DEL DOCUMENTO OFICIAL IMPRIMIBLE */}
        <div id="official-payslip-content" className="space-y-4 overflow-y-auto pr-1 text-slate-800 text-xs font-sans">
          {/* Encabezado Empleador vs Periodo */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center gap-1.5 text-blue-900 font-black text-sm uppercase tracking-wide">
                <Building2 className="w-4 h-4 text-blue-700" />
                {company.razonSocial}
              </div>
              <div className="mt-1 space-y-0.5 text-[11px] text-slate-600">
                <div><span className="font-bold text-slate-700">RUT Empleador:</span> <span className="font-mono">{company.rut}</span></div>
                <div><span className="font-bold text-slate-700">Giro Comercial:</span> {company.giro}</div>
                <div><span className="font-bold text-slate-700">Dirección:</span> {company.direccion}, {company.comuna}</div>
              </div>
            </div>

            <div className="sm:text-right space-y-1">
              <div className="inline-block bg-blue-100 text-blue-900 text-[11px] font-black px-2.5 py-1 rounded-md uppercase border border-blue-200">
                LIQUIDACIÓN DE REMUNERACIONES
              </div>
              <div className="text-xs font-bold text-slate-800">
                Período: <span className="font-mono text-blue-700 text-sm">{periodo}</span>
              </div>
              <div className="text-[11px] text-slate-500 font-mono">
                Folio Registro DT: {folioDt}
              </div>
              <div className="text-[11px] text-emerald-700 font-semibold flex items-center sm:justify-end gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Declarado y Pagado PreviRed</span>
              </div>
            </div>
          </div>

          {/* Ficha del Trabajador */}
          <div className="p-3.5 bg-slate-50/70 border border-slate-200 rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Colaborador:</span>
              <span className="font-bold text-slate-900">{payroll.nombreCompleto}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">RUT:</span>
              <span className="font-mono font-bold text-slate-900">{payroll.rut}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Cargo & Depto:</span>
              <span className="text-slate-800">{payroll.cargo} ({payroll.departamento})</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Fecha Ingreso:</span>
              <span className="font-mono text-slate-800">{payroll.fechaIngreso || '2023-03-01'}</span>
            </div>

            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Tipo Contrato:</span>
              <span className="text-slate-800 font-medium">{payroll.tipoContrato}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Jornada Laboral:</span>
              <span className="text-slate-800 font-medium">40 hrs / sem (Ley 21.561)</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Días Trabajados:</span>
              <span className="font-mono font-bold text-slate-800">{payroll.diasTrabajados || 30} / 30</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Institución Previsión:</span>
              <span className="font-bold text-blue-800">AFP {payroll.afpNombre} | {payroll.saludTipo}</span>
            </div>
          </div>

          {/* CUERPO ANALÍTICO: HABERES VS DESCUENTOS (Art. 54 Código del Trabajo) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* COLUMNA 1: HABERES */}
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
              <div className="bg-slate-100 px-3.5 py-2 border-b border-slate-200 flex justify-between items-center">
                <span className="font-black text-slate-800 text-[11px] uppercase tracking-wider">
                  1. Haberes ($ CLP)
                </span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Imponible / No Imponible
                </span>
              </div>

              <div className="p-3.5 space-y-2 text-[11px]">
                <div className="text-[10px] font-bold text-slate-500 uppercase">Haberes Imponibles:</div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-700">Sueldo Base:</span>
                  <span className="font-mono font-bold text-slate-900">{formatNumberCL(payroll.sueldoBase)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-700">Gratificación Legal (Art. 50 Código del Trabajo):</span>
                  <span className="font-mono font-bold text-slate-900">{formatNumberCL(payroll.gratificacionMonto)}</span>
                </div>
                {payroll.horasExtrasMonto > 0 && (
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-700">Horas Extraordinarias ({payroll.horasExtrasCantidad} hrs al 50%):</span>
                    <span className="font-mono font-bold text-slate-900">{formatNumberCL(payroll.horasExtrasMonto)}</span>
                  </div>
                )}
                {payroll.comisionesBonosImponibles > 0 && (
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-700">Bonos & Comisiones Imponibles:</span>
                    <span className="font-mono font-bold text-slate-900">{formatNumberCL(payroll.comisionesBonosImponibles)}</span>
                  </div>
                )}

                <div className="flex justify-between py-1.5 bg-emerald-50/70 px-2 rounded font-bold text-slate-900 border border-emerald-100">
                  <span>TOTAL HABERES IMPONIBLES:</span>
                  <span className="font-mono text-emerald-800">{formatCLP(payroll.totalHaberesImponibles)}</span>
                </div>

                <div className="pt-2 text-[10px] font-bold text-slate-500 uppercase">Haberes No Imponibles:</div>
                <div className="flex justify-between py-1 border-b border-slate-100 text-slate-600">
                  <span>Asignación de Colación:</span>
                  <span className="font-mono">{formatNumberCL(payroll.asignacionColacion)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 text-slate-600">
                  <span>Asignación de Movilización:</span>
                  <span className="font-mono">{formatNumberCL(payroll.asignacionMovilizacion)}</span>
                </div>
                {payroll.viaticosAsignacionFamiliar > 0 && (
                  <div className="flex justify-between py-1 border-b border-slate-100 text-slate-600">
                    <span>Viáticos / Asignación Familiar:</span>
                    <span className="font-mono">{formatNumberCL(payroll.viaticosAsignacionFamiliar)}</span>
                  </div>
                )}

                <div className="flex justify-between py-1 text-slate-700 font-semibold">
                  <span>Total No Imponible:</span>
                  <span className="font-mono">{formatCLP(payroll.totalHaberesNoImponibles)}</span>
                </div>

                <div className="flex justify-between py-2 border-t-2 border-slate-300 font-black text-xs text-slate-900">
                  <span>TOTAL HABERES BRUTOS:</span>
                  <span className="font-mono text-blue-700">{formatCLP(payroll.totalHaberesBrutos)}</span>
                </div>
              </div>
            </div>

            {/* COLUMNA 2: DESCUENTOS LEGALES Y VOLUNTARIOS */}
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
              <div className="bg-slate-100 px-3.5 py-2 border-b border-slate-200 flex justify-between items-center">
                <span className="font-black text-slate-800 text-[11px] uppercase tracking-wider">
                  2. Descuentos Legales ($ CLP)
                </span>
                <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                  Previsión & Tributario
                </span>
              </div>

              <div className="p-3.5 space-y-2 text-[11px]">
                <div className="text-[10px] font-bold text-slate-500 uppercase">Previsión Social (Leyes 3.500 y 19.728):</div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-700">AFP {payroll.afpNombre} ({(payroll.afpTasa * 100).toFixed(2)}%):</span>
                  <span className="font-mono font-bold text-slate-900">{formatNumberCL(payroll.afpMonto)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-700">
                    Salud {payroll.saludTipo} {payroll.saludPlanUf ? `(${payroll.saludPlanUf} UF)` : '(7%)'}:
                  </span>
                  <span className="font-mono font-bold text-slate-900">{formatNumberCL(payroll.saludMonto)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-700">Seguro de Cesantía AFC Trabajador ({payroll.tipoContrato === 'INDEFINIDO' ? '0.6%' : '0.0%'}):</span>
                  <span className="font-mono font-bold text-slate-900">{formatNumberCL(payroll.afcTrabajadorMonto)}</span>
                </div>

                <div className="pt-2 text-[10px] font-bold text-slate-500 uppercase">Impuesto a la Renta (DL 824 Art. 42 N° 1):</div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-700">Impuesto Único 2da Categoría (IUSC):</span>
                  <span className="font-mono font-bold text-purple-700">
                    {payroll.impuestoUnicoMonto > 0 ? formatNumberCL(payroll.impuestoUnicoMonto) : '$0 (Exento)'}
                  </span>
                </div>

                <div className="pt-2 text-[10px] font-bold text-slate-500 uppercase">Otros Descuentos:</div>
                <div className="flex justify-between py-1 border-b border-slate-100 text-slate-600">
                  <span>Anticipos / Préstamos / Varios:</span>
                  <span className="font-mono">{formatNumberCL(payroll.otrosDescuentos)}</span>
                </div>

                <div className="pt-5 flex justify-between py-2 border-t-2 border-slate-300 font-black text-xs text-slate-900">
                  <span>TOTAL DESCUENTOS:</span>
                  <span className="font-mono text-rose-700">-{formatCLP(payroll.totalDescuentos)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* CUADRO INFORMATIVO: APORTES PATRONALES (COSTO EMPLEADOR) */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 border-b border-slate-200 pb-1">
              <span className="flex items-center gap-1.5 text-indigo-900">
                <Info className="w-3.5 h-3.5 text-indigo-600" />
                Aportes Patronales de Seguridad Social (Informativo - No deducible del sueldo)
              </span>
              <span className="font-mono text-xs text-indigo-950 font-black">
                Costo Total Empresa: {formatCLP(payroll.costoTotalEmpresa + (payroll.reformaPrevisionalLey21735Monto ? 0 : ley21735Monto))}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              <div className="bg-white p-2 rounded border border-slate-200">
                <span className="text-slate-500 block text-[10px]">SIS Empleador (1.49%):</span>
                <span className="font-mono font-bold text-slate-800">{formatCLP(payroll.sisEmpleadorMonto)}</span>
              </div>
              <div className="bg-white p-2 rounded border border-slate-200">
                <span className="text-slate-500 block text-[10px]">Mutual ACHS (0.93%):</span>
                <span className="font-mono font-bold text-slate-800">{formatCLP(payroll.mutualEmpleadorMonto)}</span>
              </div>
              <div className="bg-white p-2 rounded border border-slate-200">
                <span className="text-slate-500 block text-[10px]">AFC Empleador ({payroll.tipoContrato === 'INDEFINIDO' ? '2.4%' : '3.0%'}):</span>
                <span className="font-mono font-bold text-slate-800">{formatCLP(payroll.afcEmpleadorMonto)}</span>
              </div>
              <div className="bg-white p-2 rounded border border-indigo-200 bg-indigo-50/40">
                <span className="text-indigo-700 block text-[10px] font-bold">Ley 21.735 Reforma (1.0%):</span>
                <span className="font-mono font-black text-indigo-900">{formatCLP(ley21735Monto)}</span>
              </div>
            </div>
          </div>

          {/* TOTAL LÍQUIDO A PAGAR Y TEXTO EN PALABRAS */}
          <div className="p-4 bg-blue-50 border-2 border-blue-400 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-black uppercase text-blue-900 tracking-wider block">
                ALCANCE LÍQUIDO A RECIBIR:
              </span>
              <span className="text-[11px] font-bold text-slate-700 block mt-0.5">
                SON: {wordsAmount}
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-black font-mono text-blue-800 sm:text-right">
              {formatCLP(payroll.sueldoLiquido)}
            </div>
          </div>

          {/* RECIBO CONFORME Y FIRMAS (CÓDIGO DEL TRABAJO DT) */}
          <div className="pt-2 border-t border-slate-200 space-y-4">
            <p className="text-[10px] text-slate-500 italic text-justify leading-relaxed">
              "Certifico que he recibido de mi empleador a mi entera satisfacción el saldo líquido indicado en esta liquidación y no tengo cargo ni cobro posterior alguno que formular por los conceptos correspondientes a este período legal."
            </p>

            <div className="grid grid-cols-2 gap-8 pt-6 pb-2 text-center text-[10px] text-slate-600">
              <div className="space-y-1">
                <div className="border-t border-slate-400 pt-2 font-bold uppercase tracking-wider text-slate-800">
                  {company.razonSocial}
                </div>
                <div className="text-slate-400 font-mono">Firma y Timbre Empleador</div>
              </div>

              <div className="space-y-1">
                <div className="border-t border-slate-400 pt-2 font-bold uppercase tracking-wider text-slate-800">
                  {payroll.nombreCompleto}
                </div>
                <div className="text-slate-400 font-mono">RUT: {payroll.rut} • Recibí Conforme</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
