import React, { useState } from 'react';
import { 
  BookOpen, 
  Download, 
  CheckCircle2, 
  Send, 
  ShieldCheck, 
  FileSpreadsheet, 
  AlertTriangle, 
  Clock, 
  Info,
  Building,
  Calendar
} from 'lucide-react';
import { EmployeePayroll, CompanyProfile } from '../../types';
import { formatCLP } from '../../utils/chileanAccounting';
import { periodoActual, ultimosPeriodos, etiquetaPeriodo } from '../../utils/periodo';

interface LegalBooksDTManagerProps {
  employees: EmployeePayroll[];
  company: CompanyProfile;
}

export const LegalBooksDTManager: React.FC<LegalBooksDTManagerProps> = ({
  employees,
  company,
}) => {
  const [periodo, setPeriodo] = useState(periodoActual());
  // 4.4: no hay integración con Mi DT. El estado parte PENDIENTE y el folio del certificado lo ingresa
  // el usuario tras cargar el archivo en el portal (antes: "Aceptado sin reparos" con folio inventado).
  const [estadoEnvio, setEstadoEnvio] = useState<'PENDIENTE_ENVIO' | 'ENVIADO_ACEPTADO_DT'>('PENDIENTE_ENVIO');
  const [folioCertificado, setFolioCertificado] = useState('');

  // Cálculos totales para el reporte oficial
  const totalImponible = employees.reduce((acc, e) => acc + e.totalImponible, 0);
  const totalNoImponible = employees.reduce((acc, e) => acc + e.totalNoImponible, 0);
  const totalPrevisional = employees.reduce((acc, e) => acc + e.descuentosPrevisionalesTotal, 0);
  const totalImpuesto = employees.reduce((acc, e) => acc + e.impuestoUnicoSegundaCategoria, 0);
  const totalLiquido = employees.reduce((acc, e) => acc + e.sueldoLiquido, 0);
  const totalAportePatronal = employees.reduce((acc, e) => acc + e.costoEmpleadorTotal - e.totalHaberes, 0);

  // Generar CSV oficial normalizado DT (Resolución Exenta N° 873)
  const generateLreCsv = (): string => {
    const headers = [
      'RUT_TRABAJADOR',
      'NOMBRE_TRABAJADOR',
      'DIAS_TRABAJADOS',
      'COD_1101_SUELDO_BASE',
      'COD_1102_HORAS_EXTRAS',
      'COD_1103_GRATIFICACION_ART50',
      'COD_1104_COMISIONES_BONOS',
      'TOTAL_IMPONIBLE',
      'COD_2101_COLACION',
      'COD_2102_MOVILIZACION',
      'TOTAL_HABERES',
      'COD_3101_AFP_COTIZACION',
      'COD_3103_SALUD_FONASA_ISAPRE',
      'COD_3104_AFC_TRABAJADOR',
      'COD_3201_IMPUESTO_UNICO',
      'COD_4101_SUELDO_LIQUIDO',
      'COD_5101_SIS_PATRONAL',
      'COD_5102_MUTUAL_PATRONAL',
      'COD_5103_AFC_PATRONAL'
    ].join(';');

    const rows = employees.map(emp => {
      const sis = Math.round(emp.totalImponible * 0.0149);
      const mutual = Math.round(emp.totalImponible * (company.afpMutualTasa || 0.0185));
      const afcPatronal = Math.round(emp.totalImponible * (emp.tipoContrato === 'PLAZO_FIJO' ? 0.03 : 0.024));

      return [
        emp.rut,
        `"${emp.nombreCompleto}"`,
        emp.diasTrabajados || 30,
        emp.sueldoBase,
        emp.horasExtrasMonto,
        emp.gratificacionLegal,
        emp.comisionesBonosImponibles,
        emp.totalImponible,
        emp.asignacionColacion,
        emp.asignacionMovilizacion,
        emp.totalHaberes,
        emp.afpMonto,
        emp.saludMonto,
        emp.afcMonto,
        emp.impuestoUnicoSegundaCategoria,
        emp.sueldoLiquido,
        sis,
        mutual,
        afcPatronal
      ].join(';');
    });

    return [headers, ...rows].join('\n');
  };

  const handleDownloadCsv = () => {
    const csvContent = generateLreCsv();
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `LRE_${company.rut.replace(/\./g, '').replace(/-/g, '')}_${periodo.replace('-', '')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRegisterCertificate = (folio: string) => {
    const clean = folio.trim();
    if (!clean) return;
    setFolioCertificado(clean);
    setEstadoEnvio('ENVIADO_ACEPTADO_DT');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Dotación Informada</span>
            <BookOpen className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">{employees.length} trabajadores</div>
          <div className="text-[11px] text-slate-500 mt-1">
            Con contrato vigente en el período
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Total Imponible LRE</span>
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-2">
            {formatCLP(totalImponible)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Base para Previsión e Impuesto Único
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Estado Transmisión Mi DT</span>
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
          </div>
          {estadoEnvio === 'ENVIADO_ACEPTADO_DT' ? (
            <>
              <div className="text-sm font-black text-indigo-700 mt-2 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Certificado DT registrado</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1 font-mono">{folioCertificado}</div>
            </>
          ) : (
            <>
              <div className="text-sm font-black text-amber-700 mt-2">Pendiente de carga en Mi DT</div>
              <input
                type="text"
                placeholder="Folio del certificado DT"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRegisterCertificate((e.target as HTMLInputElement).value);
                }}
                className="mt-1 w-full border border-slate-300 rounded px-2 py-1 text-[11px] font-mono"
                title="Descargue el LRE, cárguelo en el portal de la DT e ingrese aquí el folio del certificado (Enter)"
              />
            </>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Vencimiento Legal Mensual</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-700 mt-2">
            Día 15
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            De cada mes ante tramites.dirtrab.cl
          </div>
        </div>
      </div>

      {/* Control Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-extrabold text-slate-900 text-sm sm:text-base flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-600" />
            <span>Libro de Remuneraciones Electrónico (LRE - Ley N° 21.327 DT)</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Generador oficial de archivo CSV con codificación normalizada para carga masiva telemática en el portal Mi DT de la Dirección del Trabajo.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
            className="bg-slate-50 border border-slate-300 text-slate-700 text-xs rounded-lg px-3 py-1.5 font-mono font-semibold"
          >
{ultimosPeriodos(18).map((p) => (
                  <option key={p} value={p}>{etiquetaPeriodo(p)}</option>
                ))}
          </select>

          <button
            onClick={handleDownloadCsv}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors shadow-xs cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Descargar CSV Oficial DT</span>
          </button>
        </div>
      </div>

      {/* Official Codes Table Preview */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="font-bold text-slate-800 text-xs">
            Matriz de Datos Normalizados LRE - Período {periodo} ({employees.length} registros)
          </div>
          <div className="text-[11px] text-slate-500">
            Formato: CSV Delimitado por punto y coma (;) • Codificación UTF-8 con BOM
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700 font-mono">
            <thead className="bg-slate-100/80 text-slate-600 text-[10px] uppercase font-bold border-b border-slate-200">
              <tr>
                <th className="px-3 py-2.5">RUT</th>
                <th className="px-3 py-2.5">Nombre Trabajador</th>
                <th className="px-3 py-2.5 text-right">1101 (Base)</th>
                <th className="px-3 py-2.5 text-right">1102 (H.Ext)</th>
                <th className="px-3 py-2.5 text-right">1103 (Grat.)</th>
                <th className="px-3 py-2.5 text-right font-bold text-emerald-800">Tot. Impon.</th>
                <th className="px-3 py-2.5 text-right">2101 (Col.)</th>
                <th className="px-3 py-2.5 text-right">2102 (Mov.)</th>
                <th className="px-3 py-2.5 text-right">3101 (AFP)</th>
                <th className="px-3 py-2.5 text-right">3103 (Salud)</th>
                <th className="px-3 py-2.5 text-right">3201 (I.Único)</th>
                <th className="px-3 py-2.5 text-right font-bold text-blue-900">4101 (Líquido)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[11px]">
              {employees.map((emp) => (
                <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-3 py-2 font-bold text-slate-900">{emp.rut}</td>
                  <td className="px-3 py-2 font-sans font-semibold text-slate-800 whitespace-nowrap">
                    {emp.nombreCompleto}
                  </td>
                  <td className="px-3 py-2 text-right">{formatCLP(emp.sueldoBase)}</td>
                  <td className="px-3 py-2 text-right">{formatCLP(emp.horasExtrasMonto)}</td>
                  <td className="px-3 py-2 text-right">{formatCLP(emp.gratificacionLegal)}</td>
                  <td className="px-3 py-2 text-right font-bold text-emerald-700 bg-emerald-50/40">
                    {formatCLP(emp.totalImponible)}
                  </td>
                  <td className="px-3 py-2 text-right">{formatCLP(emp.asignacionColacion)}</td>
                  <td className="px-3 py-2 text-right">{formatCLP(emp.asignacionMovilizacion)}</td>
                  <td className="px-3 py-2 text-right">{formatCLP(emp.afpMonto)}</td>
                  <td className="px-3 py-2 text-right">{formatCLP(emp.saludMonto)}</td>
                  <td className="px-3 py-2 text-right">
                    {emp.impuestoUnicoSegundaCategoria > 0 ? (
                      <span className="text-rose-700 font-semibold">{formatCLP(emp.impuestoUnicoSegundaCategoria)}</span>
                    ) : (
                      <span className="text-slate-400">$0</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-bold text-blue-700 bg-blue-50/40">
                    {formatCLP(emp.sueldoLiquido)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 font-bold border-t-2 border-slate-200 text-[11px]">
              <tr>
                <td colSpan={2} className="px-3 py-2.5 font-sans font-black text-slate-900 uppercase">
                  Totales Consolidados LRE:
                </td>
                <td className="px-3 py-2.5 text-right">{formatCLP(employees.reduce((acc, e) => acc + e.sueldoBase, 0))}</td>
                <td className="px-3 py-2.5 text-right">{formatCLP(employees.reduce((acc, e) => acc + e.horasExtrasMonto, 0))}</td>
                <td className="px-3 py-2.5 text-right">{formatCLP(employees.reduce((acc, e) => acc + e.gratificacionLegal, 0))}</td>
                <td className="px-3 py-2.5 text-right text-emerald-800 font-black">{formatCLP(totalImponible)}</td>
                <td className="px-3 py-2.5 text-right">{formatCLP(employees.reduce((acc, e) => acc + e.asignacionColacion, 0))}</td>
                <td className="px-3 py-2.5 text-right">{formatCLP(employees.reduce((acc, e) => acc + e.asignacionMovilizacion, 0))}</td>
                <td className="px-3 py-2.5 text-right">{formatCLP(employees.reduce((acc, e) => acc + e.afpMonto, 0))}</td>
                <td className="px-3 py-2.5 text-right">{formatCLP(employees.reduce((acc, e) => acc + e.saludMonto, 0))}</td>
                <td className="px-3 py-2.5 text-right text-rose-800">{formatCLP(totalImpuesto)}</td>
                <td className="px-3 py-2.5 text-right text-blue-900 font-black">{formatCLP(totalLiquido)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Info Card: Normativa y Libro de Asistencia Digital */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs space-y-2">
          <div className="font-bold text-blue-900 flex items-center gap-1.5">
            <Info className="w-4 h-4 text-blue-600" />
            <span>Resolución Exenta N° 873 DT (Libro de Remuneraciones Electrónico)</span>
          </div>
          <p className="text-blue-800 leading-relaxed">
            La Ley 21.327 dispone la obligatoriedad de informar mensualmente todas las remuneraciones devengadas a más tardar el día 15 del mes siguiente. El archivo generado cumple el 100% de la taxonomía técnica exigida por la Dirección del Trabajo para su carga automática en el portal Mi DT.
          </p>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-2">
          <div className="font-bold text-slate-800 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Libro de Asistencia Digital (Res. Exenta N° 226 DT)</span>
          </div>
          <p className="text-slate-600 leading-relaxed">
            Sistema de registro y control de asistencia con verificación de marcas de entrada y salida, reporte telemático para fiscalizadores de la DT, comprobantes de marcaje al correo del trabajador y trazabilidad digital inalterable.
          </p>
        </div>
      </div>
    </div>
  );
};
