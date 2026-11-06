import React from 'react';
import { 
  X, 
  Printer, 
  Copy, 
  Check, 
  ShieldCheck, 
  Building2, 
  Calendar, 
  DollarSign, 
  FileCheck2,
  Download,
  Info,
  ExternalLink,
  Users
} from 'lucide-react';
import type { SocialSecurityHistoricalPayment } from '../../types';
import { formatCLP, formatNumberCL } from '../../utils/chileanAccounting';

interface Props {
  payment: SocialSecurityHistoricalPayment;
  onClose: () => void;
}

export const HistoricalPreviredPaymentModal: React.FC<Props> = ({
  payment,
  onClose,
}) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopySummary = () => {
    const text = `CERTIFICADO DE PAGO PREVIRED (CPE) - PERÍODO ${payment.periodo}
Folio CPE: ${payment.folioPrevired}
Empresa: ${payment.razonSocial} (${payment.rutEmpresa})
Fecha de Pago: ${new Date(payment.fechaPago).toLocaleString('es-CL')}
Banco: ${payment.banco} | TRX: ${payment.nroTransaccion}
Total Imposiciones Pagadas: ${formatCLP(payment.montoTotalPagado)}
Aporte Ley 21.735 (1%): ${formatCLP(payment.montoLey21735Total)}
Trabajadores Declarados y Pagados: ${payment.totalTrabajadores}
Hash de Validación: ${payment.comprobanteHash}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white border border-slate-300 rounded-2xl max-w-5xl w-full p-5 sm:p-7 shadow-2xl space-y-5 my-8 max-h-[92vh] flex flex-col">
        {/* Cabecera del Modal (No imprimible) */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 print:hidden">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
            </span>
            <div>
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                Comprobante de Pago Electrónico de Imposiciones (PreviRed)
              </h2>
              <p className="text-xs text-slate-500">
                Folio CPE: <span className="font-mono font-bold text-slate-800">{payment.folioPrevired}</span> • Período: <span className="font-mono font-bold text-blue-700">{payment.periodo}</span>
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
              <span>{copied ? 'Copiado' : 'Copiar CPE'}</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir CPE</span>
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

        {/* DOCUMENTO OFICIAL PREVIRED (Imprimible) */}
        <div className="space-y-4 overflow-y-auto pr-1 text-xs">
          {/* Tarjeta de Encabezado Oficial */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">EMPRESA COTIZANTE:</div>
              <div className="font-bold text-slate-900 text-sm">{payment.razonSocial}</div>
              <div className="text-xs font-mono text-slate-600">RUT: {payment.rutEmpresa}</div>
              <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <span>Nómina: <strong>{payment.totalTrabajadores}</strong> colaboradores</span>
              </div>
            </div>

            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">DETALLES DE TRANSACCIÓN:</div>
              <div className="text-xs font-semibold text-slate-800">Medio: <span className="font-mono">{payment.medioPago}</span></div>
              <div className="text-xs text-slate-600">Entidad: <span className="font-semibold text-slate-800">{payment.banco}</span></div>
              <div className="text-xs text-slate-600 font-mono">N° TRX: {payment.nroTransaccion}</div>
              <div className="text-xs text-slate-500">
                Fecha/Hora: <span className="font-mono">{new Date(payment.fechaPago).toLocaleString('es-CL')}</span>
              </div>
            </div>

            <div className="md:text-right space-y-1">
              <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 font-black text-xs px-2.5 py-1 rounded-md border border-emerald-300">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                PAGADO Y ACREDITADO
              </span>
              <div className="text-xs text-slate-500">Ley 17.322 de Cobro Previsional</div>
              <div className="text-xl font-black font-mono text-emerald-700">
                {formatCLP(payment.montoTotalPagado)}
              </div>
            </div>
          </div>

          {/* Resumen por Institución de Seguridad Social */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
            <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 font-black text-[11px] text-slate-700 uppercase tracking-wider">
              Distribución de Imposiciones por Fondo Institucional
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 p-3 bg-slate-50/50 text-center text-xs">
              <div className="p-2 space-y-1">
                <span className="text-[10px] font-bold text-slate-500 block uppercase">1. Fondos AFP:</span>
                <span className="font-mono font-bold text-blue-900 block">{formatCLP(payment.montoAfpTotal)}</span>
                <span className="text-[9px] text-slate-400 block">Cotiz. Obligatoria + Comisión</span>
              </div>
              <div className="p-2 space-y-1">
                <span className="text-[10px] font-bold text-slate-500 block uppercase">2. Fonasa / Isapre:</span>
                <span className="font-mono font-bold text-teal-900 block">{formatCLP(payment.montoSaludTotal)}</span>
                <span className="text-[9px] text-slate-400 block">7% Legal + Pactado</span>
              </div>
              <div className="p-2 space-y-1">
                <span className="text-[10px] font-bold text-slate-500 block uppercase">3. AFC Chile:</span>
                <span className="font-mono font-bold text-indigo-900 block">{formatCLP(payment.montoAfcTotal)}</span>
                <span className="text-[9px] text-slate-400 block">Cesantía Trab. + Emp.</span>
              </div>
              <div className="p-2 space-y-1">
                <span className="text-[10px] font-bold text-slate-500 block uppercase">4. Mutual ACHS:</span>
                <span className="font-mono font-bold text-amber-900 block">{formatCLP(payment.montoMutualTotal)}</span>
                <span className="text-[9px] text-slate-400 block">Ley 16.744 Accidentes</span>
              </div>
              <div className="p-2 space-y-1">
                <span className="text-[10px] font-bold text-slate-500 block uppercase">5. SIS Empleador:</span>
                <span className="font-mono font-bold text-purple-900 block">{formatCLP(payment.montoSisTotal)}</span>
                <span className="text-[9px] text-slate-400 block">1.49% Sobrevivencia</span>
              </div>
              <div className="p-2 space-y-1 bg-emerald-50/80 rounded border border-emerald-200">
                <span className="text-[10px] font-extrabold text-emerald-800 block uppercase">6. Ley 21.735 (1%):</span>
                <span className="font-mono font-black text-emerald-950 block">{formatCLP(payment.montoLey21735Total)}</span>
                <span className="text-[9px] text-emerald-700 block">Reforma Previsional</span>
              </div>
            </div>
          </div>

          {/* Tabla Desglosada por Colaborador */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
            <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 font-bold text-[11px] text-slate-800 flex justify-between items-center">
              <span>Nómina Individual de Imposiciones Declaradas y Pagadas</span>
              <span className="text-[10px] text-slate-500 font-normal">Topes Legales: AFP 90.0 UF | AFC 135.2 UF</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 border-b border-slate-200 uppercase">
                  <tr>
                    <th className="px-3 py-2">Colaborador</th>
                    <th className="px-3 py-2 text-right">Renta Imponible</th>
                    <th className="px-3 py-2 text-right">AFP</th>
                    <th className="px-3 py-2 text-right">Salud</th>
                    <th className="px-3 py-2 text-right">AFC (Trab+Emp)</th>
                    <th className="px-3 py-2 text-right">SIS (1.49%)</th>
                    <th className="px-3 py-2 text-right">Mutual</th>
                    <th className="px-3 py-2 text-right text-emerald-800">Ley 21.735 (1%)</th>
                    <th className="px-3 py-2 text-right font-black">Total Imposiciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                  {payment.detallesPorTrabajador.map((d) => (
                    <tr key={d.employeeId} className="hover:bg-slate-50/80">
                      <td className="px-3 py-2 font-sans font-medium text-slate-900">
                        {d.nombreCompleto}
                        <div className="text-[10px] text-slate-400 font-mono">{d.rut} • {d.cargo}</div>
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-slate-800">
                        {formatNumberCL(d.totalImponible)}
                      </td>
                      <td className="px-3 py-2 text-right text-blue-700">
                        {formatNumberCL(d.afpMonto)}
                        <span className="text-[9px] text-slate-400 block font-sans">{d.afpNombre}</span>
                      </td>
                      <td className="px-3 py-2 text-right text-teal-700">
                        {formatNumberCL(d.saludMonto)}
                        <span className="text-[9px] text-slate-400 block font-sans">{d.saludTipo}</span>
                      </td>
                      <td className="px-3 py-2 text-right text-indigo-700">
                        {formatNumberCL(d.afcTrabajador + d.afcEmpleador)}
                      </td>
                      <td className="px-3 py-2 text-right text-purple-700">
                        {formatNumberCL(d.sisMonto)}
                      </td>
                      <td className="px-3 py-2 text-right text-amber-700">
                        {formatNumberCL(d.mutualMonto)}
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-emerald-800">
                        {formatNumberCL(d.ley21735Monto)}
                      </td>
                      <td className="px-3 py-2 text-right font-black text-slate-900 bg-slate-50/50">
                        {formatCLP(d.totalImposicionesColaborador)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sello de Autenticidad PreviRed & F30 */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[10px] text-slate-500 font-mono">
            <div className="space-y-0.5">
              <div><strong className="text-slate-700">Firma Digital PreviRed:</strong> {payment.comprobanteHash}</div>
              <div><strong className="text-slate-700">Certificado F30 DT:</strong> Acreditación vigente sin deudas previsionales (Ley 20.123 Subcontratación)</div>
            </div>
            <div className="shrink-0 flex items-center gap-1 text-emerald-700 font-bold">
              <Check className="w-4 h-4" />
              <span>Timbre Electrónico Bancario Válido</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
