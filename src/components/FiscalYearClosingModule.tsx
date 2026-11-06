import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Lock,
  Unlock,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  Zap,
  HelpCircle,
  Building2,
  FileText,
  Clock,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  KeyRound,
  AlertOctagon,
} from 'lucide-react';
import { ExtraordinaryFiscalYearReopenModal } from './accounting/ExtraordinaryFiscalYearReopenModal';
import {
  AccountingEntry,
  Balance8ColumnasReport,
  CompanyProfile,
  EmployeePayroll,
  F29Declaration,
  CatchUpPeriodConfig,
  PeriodLockValidationResult,
  SystemGeneralParameters,
} from '../types';
import { DEFAULT_SYSTEM_GENERAL_PARAMETERS } from '../config/erpMasterConfig';
import {
  getFiscalYearDates,
  validateEntryFiscalPeriod,
  generateClosingResultEntry,
  generateClosingBalanceEntry,
  generateOpeningEntryFromPreviousClosing,
  generateRetroactiveCatchUpPack,
} from '../utils/accountingOrchestratorEngine';
import { formatCLP } from '../utils/chileanAccounting';

interface FiscalYearClosingModuleProps {
  company: CompanyProfile;
  onUpdateCompany: (updated: Partial<CompanyProfile>) => void;
  entries: AccountingEntry[];
  balance8Col: Balance8ColumnasReport;
  payrolls: EmployeePayroll[];
  f29: F29Declaration;
  onAddEntry: (entry: AccountingEntry) => void;
  dispatchEntry?: (entry: AccountingEntry, context?: any) => Promise<any>;
  onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  convertAmount: (clpAmount: number) => string;
  systemParams?: SystemGeneralParameters;
  onUpdateSystemParams?: (params: SystemGeneralParameters) => void;
}

export const FiscalYearClosingModule: React.FC<FiscalYearClosingModuleProps> = ({
  company,
  onUpdateCompany,
  entries = [],
  balance8Col,
  payrolls = [],
  f29,
  onAddEntry,
  dispatchEntry,
  onShowToast,
  convertAmount,
  systemParams,
  onUpdateSystemParams,
}) => {
  // Configuración de Ejercicio Fiscal Local
  const dates = useMemo(() => getFiscalYearDates(company), [company]);

  const [mesCierre, setMesCierre] = useState<number>(
    systemParams?.mesCierreEjercicio ?? company.mesCierreEjercicio ?? 12
  );
  const [diaCierre, setDiaCierre] = useState<number>(
    systemParams?.diaCierreEjercicio ?? company.diaCierreEjercicio ?? 31
  );
  const [ejercicioActivo, setEjercicioActivo] = useState<number>(
    systemParams?.ejercicioActivo ?? company.ejercicioActivo ?? 2026
  );
  const [resolucionSii, setResolucionSii] = useState<string>(
    systemParams?.resolucionSiiCierreEspecial ?? company.resolucionSiiCierreEspecial ?? ''
  );
  const [bloqueoActivo, setBloqueoActivo] = useState<boolean>(
    systemParams?.bloqueoPeriodoCerrado ?? (company.bloqueoPeriodoCerrado !== false)
  );
  const [periodosCerrados, setPeriodosCerrados] = useState<string[]>(
    company.periodosCerrados || ['2026-01', '2026-02']
  );
  const [isReopenModalOpen, setIsReopenModalOpen] = useState<boolean>(false);

  // Subpestaña activa del módulo
  const [subTab, setSubTab] = useState<'CONFIG' | 'CIERRE_APERTURA' | 'CATCH_UP'>('CONFIG');

  // Estado del Asistente Catch-Up (Puesta al Día de Movimientos Atrasados)
  const [selectedCatchUpPeriod, setSelectedCatchUpPeriod] = useState<string>('2026-01');
  const [catchUpGeneratedPack, setCatchUpGeneratedPack] = useState<ReturnType<typeof generateRetroactiveCatchUpPack> | null>(null);
  const [expandedCatchUpVoucher, setExpandedCatchUpVoucher] = useState<string | null>(null);

  // Previews de Asientos de Cierre / Apertura
  const [previewClosingResult, setPreviewClosingResult] = useState<AccountingEntry | null>(null);
  const [previewClosingBalance, setPreviewClosingBalance] = useState<AccountingEntry | null>(null);
  const [previewOpening, setPreviewOpening] = useState<AccountingEntry | null>(null);

  // Meses del ejercicio contable activo
  const mesesEjercicio = useMemo(() => {
    const list: string[] = [];
    if (mesCierre === 12) {
      for (let m = 1; m <= 12; m++) {
        list.push(`${ejercicioActivo}-${String(m).padStart(2, '0')}`);
      }
    } else {
      // Cierre especial: Desde mes N+1 del año anterior hasta mes N del ejercicio activo
      const startYear = ejercicioActivo - 1;
      for (let m = mesCierre + 1; m <= 12; m++) {
        list.push(`${startYear}-${String(m).padStart(2, '0')}`);
      }
      for (let m = 1; m <= mesCierre; m++) {
        list.push(`${ejercicioActivo}-${String(m).padStart(2, '0')}`);
      }
    }
    return list;
  }, [mesCierre, ejercicioActivo]);

  // Conteo de asientos registrados por período
  const entriesCountByPeriod = useMemo(() => {
    const map: Record<string, number> = {};
    entries.forEach(e => {
      const p = e.fecha.substring(0, 7);
      map[p] = (map[p] || 0) + 1;
    });
    return map;
  }, [entries]);

  // Guardar configuración del ejercicio fiscal en el perfil de empresa
  const handleSaveFiscalConfig = () => {
    let dia = diaCierre;
    if (mesCierre === 12) dia = 31;
    else if (mesCierre === 6 || mesCierre === 9) dia = 30;
    else if (mesCierre === 3) dia = 31;

    let fInicio = `${ejercicioActivo}-01-01`;
    let fFin = `${ejercicioActivo}-${String(mesCierre).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    if (mesCierre !== 12) {
      fInicio = `${ejercicioActivo - 1}-${String(mesCierre + 1).padStart(2, '0')}-01`;
    }

    onUpdateCompany({
      mesCierreEjercicio: mesCierre,
      diaCierreEjercicio: dia,
      ejercicioActivo,
      fechaInicioEjercicio: fInicio,
      fechaFinEjercicio: fFin,
      periodosCerrados,
      bloqueoPeriodoCerrado: bloqueoActivo,
      resolucionSiiCierreEspecial: resolucionSii,
    });

    if (onUpdateSystemParams) {
      onUpdateSystemParams({
        ...(systemParams || DEFAULT_SYSTEM_GENERAL_PARAMETERS),
        ejercicioActivo: ejercicioActivo,
        mesCierreEjercicio: mesCierre,
        diaCierreEjercicio: dia,
        bloqueoPeriodoCerrado: bloqueoActivo,
        resolucionSiiCierreEspecial: resolucionSii || undefined,
      });
    }

    onShowToast('Parámetros de ejercicio fiscal y política de bloqueo guardados con éxito en la empresa y parámetros globales.', 'success');
  };

  // Toggle bloqueo de un período mensual
  const togglePeriodoBloqueo = (p: string) => {
    let updated: string[];
    if (periodosCerrados.includes(p)) {
      updated = periodosCerrados.filter(item => item !== p);
      onShowToast(`Período ${p} DESBLOQUEADO para edición contable.`, 'info');
    } else {
      updated = [...periodosCerrados, p];
      onShowToast(`Período ${p} BLOQUEADO con candado tributario.`, 'success');
    }
    setPeriodosCerrados(updated);
    onUpdateCompany({ periodosCerrados: updated });
  };

  // Manejo de Reapertura Extraordinaria Justificada (NIC 8 / Art. 16 Código Tributario)
  const handleConfirmReopen = ({
    ejercicio,
    motivoLegal,
    usuario,
    resolucionSii,
  }: {
    ejercicio: number;
    motivoLegal: string;
    usuario: string;
    resolucionSii?: string;
  }) => {
    const currentClosed =
      company.ejerciciosCerrados && company.ejerciciosCerrados.length > 0
        ? company.ejerciciosCerrados
        : [ejercicioActivo - 2, ejercicioActivo - 1];
    const newClosed = currentClosed.filter((y) => y !== ejercicio);
    const auditEntry = {
      id: `reopen-${ejercicio}-${Date.now()}`,
      fecha: new Date().toISOString().substring(0, 10),
      ejercicio,
      usuario,
      motivoLegal,
      resolucionSii,
      timestamp: new Date().toISOString(),
    };
    const updatedAudit = [auditEntry, ...(company.auditoriaReaperturas || [])];

    onUpdateCompany({
      ejerciciosCerrados: newClosed,
      auditoriaReaperturas: updatedAudit,
      reaperturaExtraordinariaActiva: {
        ejercicio,
        fechaReapertura: new Date().toISOString().substring(0, 10),
        motivoLegal,
        usuario,
        resolucionSii,
      },
    });

    onShowToast(
      `Ejercicio fiscal ${ejercicio} reabierto extraordinariamente bajo régimen de auditoría. Puede proceder con los ajustes legales.`,
      'info'
    );
  };

  const handleRecloseExtraordinary = (ejercicio: number) => {
    const currentClosed = company.ejerciciosCerrados || [];
    const newClosed = currentClosed.includes(ejercicio)
      ? currentClosed
      : [...currentClosed, ejercicio];

    onUpdateCompany({
      ejerciciosCerrados: newClosed,
      reaperturaExtraordinariaActiva: undefined,
    });

    onShowToast(
      `Ejercicio fiscal ${ejercicio} cerrado y bloqueado formalmente tras concluir los ajustes extraordinarios.`,
      'success'
    );
  };

  // Despacho de asientos con trazabilidad
  const handleCommit = async (entry: AccountingEntry, glosaAccion: string) => {
    if (dispatchEntry) {
      try {
        await dispatchEntry(entry, {
          agenteNombre: 'AGENTE_ORQUESTADOR_SENIOR',
          accion: glosaAccion,
        });
        onShowToast(`Comprobante "${entry.documento}" registrado y cuadrado en el Libro Mayor.`, 'success');
      } catch (err: any) {
        onShowToast(`Error al asentar comprobante: ${err.message}`, 'error');
      }
    } else {
      onAddEntry(entry);
      onShowToast(`Comprobante "${entry.documento}" añadido a la contabilidad.`, 'success');
    }
  };

  // Generar y previsualizar Asiento de Cierre de Resultados
  const handleGenerateClosingResult = () => {
    const entry = generateClosingResultEntry(balance8Col, dates.fechaFin, dates.ejercicioActivo);
    setPreviewClosingResult(entry);
    onShowToast('Asiento de Cierre de Cuentas de Resultado formulado según Balance 8 Columnas.', 'info');
  };

  // Generar y previsualizar Asiento de Cierre de Balance
  const handleGenerateClosingBalance = () => {
    const entry = generateClosingBalanceEntry(balance8Col, dates.fechaFin, dates.ejercicioActivo);
    setPreviewClosingBalance(entry);
    onShowToast('Asiento de Cierre Patrimonial formulado para finiquito de libros.', 'info');
  };

  // Generar y previsualizar Asiento de Apertura del Nuevo Ejercicio
  const handleGenerateOpening = () => {
    const nuevoAno = dates.ejercicioActivo + 1;
    let fechaApertura = `${nuevoAno}-01-01`;
    if (dates.esCierreEspecial) {
      fechaApertura = `${dates.ejercicioActivo}-${String(dates.mesCierre + 1).padStart(2, '0')}-01`;
    }
    const entry = generateOpeningEntryFromPreviousClosing(balance8Col, fechaApertura, nuevoAno);
    setPreviewOpening(entry);
    onShowToast(`Comprobante de Apertura N° 1 formulado para el Ejercicio ${nuevoAno}.`, 'info');
  };

  // Generar paquete Catch-Up para el período seleccionado
  const handleGenerateCatchUpPack = () => {
    const pack = generateRetroactiveCatchUpPack(selectedCatchUpPeriod, payrolls, f29);
    setCatchUpGeneratedPack(pack);
    onShowToast(`Cadena contable para período atrasado ${selectedCatchUpPeriod} formulada con 5 comprobantes.`, 'info');
  };

  // Asentar todos los comprobantes del paquete Catch-Up
  const handleCommitAllCatchUp = async () => {
    if (!catchUpGeneratedPack) return;
    try {
      for (const entry of catchUpGeneratedPack.todosLosAsientos) {
        await handleCommit(entry, `REGULARIZACION_CATCHUP_${selectedCatchUpPeriod}`);
      }
      onShowToast(`¡Éxito! 5 comprobantes del período ${selectedCatchUpPeriod} regularizados y asentados en el Libro Diario.`, 'success');
      setCatchUpGeneratedPack(null);
    } catch (err: any) {
      onShowToast(`Error en regularización: ${err.message}`, 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Encabezado Principal de Ejercicio Fiscal */}
      <div className="bg-gradient-to-r from-[#0f172a] via-[#1e293b] to-[#0f172a] text-white p-6 rounded-xl border border-slate-700 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs px-2.5 py-0.5 rounded-full font-mono font-semibold flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                ART. 16 CÓDIGO TRIBUTARIO
              </span>
              <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs px-2.5 py-0.5 rounded-full font-mono">
                Ejercicio Activo: {dates.ejercicioActivo}
              </span>
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs px-2.5 py-0.5 rounded-full font-mono">
                Cierre: {dates.diaCierre}/{String(dates.mesCierre).padStart(2, '0')} {dates.esCierreEspecial ? '(Cierre Especial SII)' : '(Regla General 31/12)'}
              </span>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-mono flex items-center gap-1 ${
                bloqueoActivo ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}>
                {bloqueoActivo ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                {bloqueoActivo ? 'Bloqueo Estricto Activo' : 'Edición Sin Candado'}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white mt-2 flex items-center gap-2.5">
              <Calendar className="w-6 h-6 text-amber-400" />
              <span>Gestión de Ejercicio Fiscal, Cierre, Apertura & Regularización Atrasada</span>
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-3xl leading-relaxed">
              Supervisión de períodos contables, bloqueo de meses cerrados para impedir alteraciones retroactivas indebidas, 
              generación automática de asientos de cierre/apertura y asistente de regularización ("Catch-Up") para incorporar 
              meses atrasados de remuneraciones y F29 con fechas históricas fidedignas.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 shrink-0">
            <button
              onClick={() => setSubTab('CONFIG')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                subTab === 'CONFIG' ? 'bg-amber-500 text-slate-900 shadow-md' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Configuración & Bloqueos</span>
            </button>
            <button
              onClick={() => setSubTab('CIERRE_APERTURA')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                subTab === 'CIERRE_APERTURA' ? 'bg-amber-500 text-slate-900 shadow-md' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Asientos Cierre / Apertura</span>
            </button>
            <button
              onClick={() => setSubTab('CATCH_UP')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                subTab === 'CATCH_UP' ? 'bg-purple-500 text-white shadow-md' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
              }`}
            >
              <Zap className="w-4 h-4" />
              <span>Puesta al Día (Atrasados)</span>
            </button>
          </div>
        </div>
      </div>

      {/* SUB-PESTAÑA 1: CONFIGURACIÓN DEL EJERCICIO Y BLOQUEO DE PERÍODOS */}
      {subTab === 'CONFIG' && (
        <div className="space-y-6">
          {/* Card de Configuración de Fecha de Cierre */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  <span>Parámetros del Ejercicio Contable & Fecha de Cierre</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  El artículo 16 del Código Tributario establece que el ejercicio termina por regla general el 31 de diciembre, pero autoriza a contribuyentes específicos a practicar balance al 30 de junio u otras fechas.
                </p>
              </div>
              <button
                onClick={handleSaveFiscalConfig}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Guardar Parámetros</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Año de Ejercicio Activo</label>
                <input
                  type="number"
                  value={ejercicioActivo}
                  onChange={e => setEjercicioActivo(parseInt(e.target.value, 10) || 2026)}
                  className="w-full text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900"
                />
                <span className="text-[10px] text-slate-500">Ejercicio contable y tributario</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mes de Cierre de Ejercicio</label>
                <select
                  value={mesCierre}
                  onChange={e => {
                    const m = parseInt(e.target.value, 10);
                    setMesCierre(m);
                    if (m === 12) setDiaCierre(31);
                    else if (m === 6 || m === 9) setDiaCierre(30);
                    else if (m === 3) setDiaCierre(31);
                  }}
                  className="w-full text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900"
                >
                  <option value={12}>Diciembre (31/12 - Regla General)</option>
                  <option value={6}>Junio (30/06 - Agrícola / Acuícola / Filiales)</option>
                  <option value={9}>Septiembre (30/09 - Corporativo)</option>
                  <option value={3}>Marzo (31/03 - Ciclo Especial)</option>
                </select>
                <span className="text-[10px] text-slate-500">Mes formal de balance financiero</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Día de Cierre</label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={diaCierre}
                  onChange={e => setDiaCierre(parseInt(e.target.value, 10) || 31)}
                  className="w-full text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900"
                />
                <span className="text-[10px] text-slate-500">Último día del ejercicio</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Resolución Exenta SII (Si aplica)</label>
                <input
                  type="text"
                  placeholder="Ej: Res. Ex. N° 412/2024 SII"
                  value={resolucionSii}
                  onChange={e => setResolucionSii(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900"
                />
                <span className="text-[10px] text-slate-500">Autorización Director Regional</span>
              </div>
            </div>

            {/* Resumen de Fechas del Ejercicio */}
            <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-4">
                <div>
                  <span className="text-slate-500 block text-[11px]">Fecha Inicio de Ejercicio:</span>
                  <span className="font-mono font-bold text-slate-900">{dates.fechaInicio}</span>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400" />
                <div>
                  <span className="text-slate-500 block text-[11px]">Fecha Término de Ejercicio:</span>
                  <span className="font-mono font-bold text-slate-900">{dates.fechaFin}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="toggle-bloqueo"
                  checked={bloqueoActivo}
                  onChange={e => setBloqueoActivo(e.target.checked)}
                  className="w-4 h-4 text-rose-600 rounded cursor-pointer"
                />
                <label htmlFor="toggle-bloqueo" className="text-xs font-bold text-slate-800 cursor-pointer">
                  Activar Política de Bloqueo Estricto (Impide registrar en meses cerrados o fuera de fecha)
                </label>
              </div>
            </div>

            {/* Parámetros Generales de Sistema ERP (Conexión Centralizada) */}
            <div className="mt-4 p-4 bg-blue-50/50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-blue-700" />
                  <span className="text-xs font-bold text-blue-900 uppercase tracking-wider">
                    Parámetros Generales Contables ERP (Sincronizados)
                  </span>
                </div>
                <span className="text-[11px] font-mono px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-semibold">
                  Art. 16 Código Tributario
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-[11px]">
                <div className="bg-white p-2 rounded border border-blue-100">
                  <span className="text-slate-500 block">Moneda Base:</span>
                  <span className="font-bold text-slate-900 font-mono">{systemParams?.monedaNacional || 'CLP'}</span>
                </div>
                <div className="bg-white p-2 rounded border border-blue-100">
                  <span className="text-slate-500 block">Tolerancia Centavos:</span>
                  <span className="font-bold text-slate-900 font-mono">${systemParams?.toleranciaCentavosAsiento || 0}</span>
                </div>
                <div className="bg-white p-2 rounded border border-blue-100">
                  <span className="text-slate-500 block">Ajuste Sencillo:</span>
                  <span className="font-bold text-slate-900 font-mono">{systemParams?.cuentaAjusteSencillo || '5.2.09.099'}</span>
                </div>
                <div className="bg-white p-2 rounded border border-blue-100">
                  <span className="text-slate-500 block">Dif. Cambio Ganancia:</span>
                  <span className="font-bold text-slate-900 font-mono">{systemParams?.cuentaDiferenciaCambioGanancia || '4.2.01.005'}</span>
                </div>
                <div className="bg-white p-2 rounded border border-blue-100">
                  <span className="text-slate-500 block">Dif. Cambio Pérdida:</span>
                  <span className="font-bold text-slate-900 font-mono">{systemParams?.cuentaDiferenciaCambioPerdida || '5.2.01.008'}</span>
                </div>
                <div className="bg-white p-2 rounded border border-blue-100">
                  <span className="text-slate-500 block">Resultado Ejercicio:</span>
                  <span className="font-bold text-slate-900 font-mono">{systemParams?.cuentaResultadoEjercicio || '3.3.02.001'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Matriz de Bloqueo de Períodos Mensuales */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-rose-600" />
                  <span>Matriz de Períodos Mensuales y Candados Contables</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Haga clic sobre un período para bloquearlo o liberarlo. Los períodos bloqueados impiden la creación o modificación de comprobantes.
                </p>
              </div>
              <div className="text-xs font-mono font-bold text-slate-600">
                {periodosCerrados.length} de {mesesEjercicio.length} meses bloqueados
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 mt-4">
              {mesesEjercicio.map(periodo => {
                const isLocked = periodosCerrados.includes(periodo);
                const count = entriesCountByPeriod[periodo] || 0;
                return (
                  <div
                    key={periodo}
                    onClick={() => togglePeriodoBloqueo(periodo)}
                    className={`p-3 rounded-lg border transition-all cursor-pointer select-none ${
                      isLocked
                        ? 'bg-rose-50/70 border-rose-200 hover:border-rose-300'
                        : 'bg-emerald-50/70 border-emerald-200 hover:border-emerald-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-xs text-slate-900">{periodo}</span>
                      {isLocked ? (
                        <Lock className="w-3.5 h-3.5 text-rose-600" />
                      ) : (
                        <Unlock className="w-3.5 h-3.5 text-emerald-600" />
                      )}
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[11px]">
                      <span className={isLocked ? 'text-rose-700 font-bold' : 'text-emerald-700 font-bold'}>
                        {isLocked ? 'CERRADO' : 'ABIERTO'}
                      </span>
                      <span className="text-slate-500 font-mono">{count} asientos</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Panel de Ejercicios Anuales y Régimen de Reapertura Extraordinaria */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-700 shrink-0">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <span>Ejercicios Fiscales Anuales y Régimen de Reapertura Extraordinaria</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-extrabold uppercase">
                      NIC 8 / SII
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Control de ejercicios cerrados, reapertura restringida por error grave y auditoría inmutable.
                  </p>
                </div>
              </div>

              {!company.reaperturaExtraordinariaActiva && (
                <button
                  type="button"
                  onClick={() => setIsReopenModalOpen(true)}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs shrink-0"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  <span>Solicitar Reapertura Extraordinaria</span>
                </button>
              )}
            </div>

            {/* Banner si hay una reapertura extraordinaria activa */}
            {company.reaperturaExtraordinariaActiva ? (
              <div className="p-3.5 bg-rose-50 border-2 border-rose-400 rounded-xl text-xs space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span className="font-black text-rose-950 text-xs sm:text-sm">
                      EJERCICIO FISCAL {company.reaperturaExtraordinariaActiva.ejercicio} EN RÉGIMEN DE REAPERTURA EXTRAORDINARIA
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRecloseExtraordinary(company.reaperturaExtraordinariaActiva!.ejercicio)}
                    className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-bold cursor-pointer transition-colors flex items-center gap-1"
                  >
                    <Lock className="w-3 h-3" />
                    <span>Finalizar Ajustes y Volver a Cerrar {company.reaperturaExtraordinariaActiva.ejercicio}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px] text-rose-900 font-mono">
                  <div><strong>Fecha Reapertura:</strong> {company.reaperturaExtraordinariaActiva.fechaReapertura}</div>
                  <div><strong>Autorizado por:</strong> {company.reaperturaExtraordinariaActiva.usuario}</div>
                  <div><strong>Folio/Respaldo SII:</strong> {company.reaperturaExtraordinariaActiva.resolucionSii || 'S/N'}</div>
                </div>

                <div className="text-[11px] text-rose-950 bg-white/70 p-2 rounded border border-rose-200">
                  <strong>Fundamentación legal del ajuste:</strong> {company.reaperturaExtraordinariaActiva.motivoLegal}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg">
                  <div className="text-[11px] font-bold text-emerald-900">Ejercicio Activo en Curso</div>
                  <div className="text-lg font-black font-mono text-emerald-950 mt-0.5">{ejercicioActivo}</div>
                  <div className="text-[10px] text-emerald-800 mt-1">Operaciones corrientes abiertas</div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg sm:col-span-2">
                  <div className="text-[11px] font-bold text-slate-800">Ejercicios Históricos Cerrados y Auditados</div>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {(company.ejerciciosCerrados && company.ejerciciosCerrados.length > 0
                      ? company.ejerciciosCerrados
                      : [ejercicioActivo - 2, ejercicioActivo - 1]
                    ).map((yr) => (
                      <span
                        key={yr}
                        className="px-2.5 py-1 rounded-md bg-slate-200 text-slate-800 font-mono font-bold text-xs flex items-center gap-1.5 border border-slate-300"
                      >
                        <Lock className="w-3 h-3 text-rose-600" />
                        <span>Ejercicio {yr}</span>
                      </span>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1.5">
                    Prohíbe asientos manuales salvo autorización de Reapertura Extraordinaria bajo fe pública de auditoría.
                  </p>
                </div>
              </div>
            )}

            {/* Historial de Auditoría de Reaperturas */}
            {company.auditoriaReaperturas && company.auditoriaReaperturas.length > 0 && (
              <div className="pt-2 border-t border-slate-100">
                <span className="text-[11px] font-bold text-slate-700 block mb-1.5">
                  Bitácora Inmutable de Auditoría de Reaperturas Extraordinarias:
                </span>
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px] text-left">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="p-1.5">Fecha</th>
                        <th className="p-1.5">Ejercicio</th>
                        <th className="p-1.5">Autorizado Por</th>
                        <th className="p-1.5">Folio / Caso SII</th>
                        <th className="p-1.5">Motivo Técnico-Legal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {company.auditoriaReaperturas.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="p-1.5 text-slate-600 whitespace-nowrap">{item.fecha}</td>
                          <td className="p-1.5 font-bold text-rose-800">{item.ejercicio}</td>
                          <td className="p-1.5 font-sans text-slate-800">{item.usuario}</td>
                          <td className="p-1.5 text-blue-800">{item.resolucionSii || 'S/N'}</td>
                          <td className="p-1.5 font-sans text-slate-600 truncate max-w-xs" title={item.motivoLegal}>
                            {item.motivoLegal}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Guía Contable Técnica para el Contador */}
          <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-4 text-xs text-blue-900 flex items-start gap-3">
            <HelpCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold block text-sm">¿Cómo maneja el sistema los movimientos anteriores y retroactivos?</span>
              <p>
                <strong>1. Movimientos del mismo ejercicio ingresados tarde:</strong> Si el contador se sienta hoy a registrar meses anteriores 
                (ej: remuneraciones de enero a agosto del ejercicio activo 2026), el sistema <strong>permite su ingreso directo con las fechas históricas</strong>, 
                siempre que el período no haya sido expresamente cerrado con candado. No fuerce la fecha a "hoy".
              </p>
              <p>
                <strong>2. Movimientos de ejercicios anteriores ya cerrados:</strong> Si se contrató el servicio en 2026 y el ejercicio 2025 ya concluyó, 
                <strong>está legal y normativamente prohibido</strong> ingresar facturas o sueldos de 2025 como asientos corrientes. 
                Los saldos iniciales deben ingresarse exclusivamente mediante el <strong>Asiento de Apertura al 01/01/2026</strong> o regularizarse 
                contra la cuenta patrimonial <code>3.1.02.001 Resultados Acumulados</code> conforme a la <strong>NIC 8 (Políticas Contables, Cambios en Estimaciones y Errores)</strong>.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SUB-PESTAÑA 2: GENERADOR DE ASIENTOS DE CIERRE Y APERTURA */}
      {subTab === 'CIERRE_APERTURA' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Tarjeta 1: Cierre de Resultados */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold font-mono bg-rose-100 text-rose-800 px-2 py-0.5 rounded">
                    ASIENTO N° 1 DE CIERRE
                  </span>
                  <span className="text-xs text-slate-500 font-mono">{dates.fechaFin}</span>
                </div>
                <h4 className="text-sm font-bold text-slate-900 mt-2">Cierre de Cuentas de Resultado</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Salda a cero todas las cuentas de pérdida (gastos y costos) y de ganancia (ingresos) contra el Patrimonio (Resultado del Ejercicio).
                </p>

                <div className="mt-4 p-3 bg-slate-50 rounded-lg space-y-1.5 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Total Ganancias:</span>
                    <span className="text-emerald-700 font-bold">{convertAmount(balance8Col.totales.total_ganancia)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Total Pérdidas:</span>
                    <span className="text-rose-700 font-bold">{convertAmount(balance8Col.totales.total_perdida)}</span>
                  </div>
                  <div className="flex justify-between pt-1.5 border-t border-slate-200 font-bold">
                    <span className="text-slate-900">Resultado Neto:</span>
                    <span className={balance8Col.resultado_del_ejercicio.tipo === 'UTILIDAD' ? 'text-emerald-700' : 'text-rose-700'}>
                      {balance8Col.resultado_del_ejercicio.tipo === 'UTILIDAD' ? '+' : '-'}
                      {convertAmount(balance8Col.resultado_del_ejercicio.monto)} ({balance8Col.resultado_del_ejercicio.tipo})
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-5 space-y-2">
                <button
                  onClick={handleGenerateClosingResult}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold py-2 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Previsualizar Asiento de Cierre</span>
                </button>
              </div>
            </div>

            {/* Tarjeta 2: Cierre Patrimonial e Inventario */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold font-mono bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                    ASIENTO N° 2 DE CIERRE
                  </span>
                  <span className="text-xs text-slate-500 font-mono">{dates.fechaFin}</span>
                </div>
                <h4 className="text-sm font-bold text-slate-900 mt-2">Cierre Patrimonial e Inventario</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Finiquito formal de libros: salda a cero todas las cuentas de Activo (abono) contra Pasivo y Patrimonio (cargo), dejando el Libro Mayor en saldo cero al corte.
                </p>

                <div className="mt-4 p-3 bg-slate-50 rounded-lg space-y-1.5 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Total Activos:</span>
                    <span className="text-slate-900 font-bold">{convertAmount(balance8Col.totales.total_activo)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Total Pasivos:</span>
                    <span className="text-slate-900 font-bold">{convertAmount(balance8Col.totales.total_pasivo)}</span>
                  </div>
                  <div className="flex justify-between pt-1.5 border-t border-slate-200 font-bold">
                    <span className="text-slate-900">Cuadratura Inventario:</span>
                    <span className="text-emerald-700">100% Equilibrado</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 space-y-2">
                <button
                  onClick={handleGenerateClosingBalance}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold py-2 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                  <span>Previsualizar Cierre de Libros</span>
                </button>
              </div>
            </div>

            {/* Tarjeta 3: Asiento de Apertura del Nuevo Ejercicio */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold font-mono bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                    COMPROBANTE APERTURA N° 1
                  </span>
                  <span className="text-xs text-slate-500 font-mono">
                    {dates.esCierreEspecial ? `${dates.ejercicioActivo}-${String(dates.mesCierre + 1).padStart(2, '0')}-01` : `${dates.ejercicioActivo + 1}-01-01`}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-slate-900 mt-2">Apertura del Nuevo Ejercicio</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Inaugura el nuevo período contable cargando Activos (DEBE), abonando Pasivos (HABER) y trasladando el Resultado a Resultados Acumulados.
                </p>

                <div className="mt-4 p-3 bg-slate-50 rounded-lg space-y-1.5 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Nuevo Ejercicio:</span>
                    <span className="text-emerald-700 font-bold">{dates.ejercicioActivo + 1}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Traspaso a Acumulados:</span>
                    <span className="text-indigo-700 font-bold">{convertAmount(balance8Col.resultado_del_ejercicio.monto)}</span>
                  </div>
                  <div className="flex justify-between pt-1.5 border-t border-slate-200 font-bold">
                    <span className="text-slate-900">Base Apertura:</span>
                    <span className="text-slate-900">{balance8Col.cuentas.length} cuentas de balance</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 space-y-2">
                <button
                  onClick={handleGenerateOpening}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                  <span>Previsualizar Asiento de Apertura</span>
                </button>
              </div>
            </div>
          </div>

          {/* Modal / Panel de Previsualización y Asiento de Cierre de Resultados */}
          {previewClosingResult && (
            <div className="bg-white border-2 border-rose-300 rounded-xl p-5 shadow-md">
              <div className="flex items-center justify-between pb-3 border-b border-rose-100">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-rose-600" />
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">{previewClosingResult.concepto}</h4>
                    <span className="text-xs text-slate-500 font-mono">Fecha: {previewClosingResult.fecha} | {previewClosingResult.lineas.length} Partidas</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCommit(previewClosingResult, 'CIERRE_RESULTADOS')}
                    className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Asentar en Libro Diario</span>
                  </button>
                  <button
                    onClick={() => setPreviewClosingResult(null)}
                    className="text-xs font-bold text-slate-500 hover:text-slate-800 px-3 py-2 cursor-pointer"
                  >
                    Cerrar
                  </button>
                </div>
              </div>

              <div className="mt-4 max-h-72 overflow-y-auto border border-slate-200 rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0">
                    <tr>
                      <th className="p-2 text-left">Código</th>
                      <th className="p-2 text-left">Cuenta</th>
                      <th className="p-2 text-right">Debe</th>
                      <th className="p-2 text-right">Haber</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {previewClosingResult.lineas.map((l, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="p-2 text-slate-500">{l.cuentaCodigo}</td>
                        <td className="p-2 font-sans text-slate-800">{l.cuentaNombre}</td>
                        <td className="p-2 text-right text-emerald-700">{l.debe > 0 ? convertAmount(l.debe) : '-'}</td>
                        <td className="p-2 text-right text-blue-700">{l.haber > 0 ? convertAmount(l.haber) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-900 text-white font-bold font-mono">
                    <tr>
                      <td colSpan={2} className="p-2 text-left">TOTALES IGUALES:</td>
                      <td className="p-2 text-right text-emerald-400">{convertAmount(previewClosingResult.totalDebe)}</td>
                      <td className="p-2 text-right text-blue-400">{convertAmount(previewClosingResult.totalHaber)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Modal / Panel de Previsualización y Asiento de Cierre de Balance */}
          {previewClosingBalance && (
            <div className="bg-white border-2 border-blue-300 rounded-xl p-5 shadow-md">
              <div className="flex items-center justify-between pb-3 border-b border-blue-100">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-blue-600" />
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">{previewClosingBalance.concepto}</h4>
                    <span className="text-xs text-slate-500 font-mono">Fecha: {previewClosingBalance.fecha} | {previewClosingBalance.lineas.length} Partidas</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCommit(previewClosingBalance, 'CIERRE_BALANCE')}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Asentar Cierre en Libro Diario</span>
                  </button>
                  <button
                    onClick={() => setPreviewClosingBalance(null)}
                    className="text-xs font-bold text-slate-500 hover:text-slate-800 px-3 py-2 cursor-pointer"
                  >
                    Cerrar
                  </button>
                </div>
              </div>

              <div className="mt-4 max-h-72 overflow-y-auto border border-slate-200 rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0">
                    <tr>
                      <th className="p-2 text-left">Código</th>
                      <th className="p-2 text-left">Cuenta</th>
                      <th className="p-2 text-right">Debe</th>
                      <th className="p-2 text-right">Haber</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {previewClosingBalance.lineas.map((l, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="p-2 text-slate-500">{l.cuentaCodigo}</td>
                        <td className="p-2 font-sans text-slate-800">{l.cuentaNombre}</td>
                        <td className="p-2 text-right text-emerald-700">{l.debe > 0 ? convertAmount(l.debe) : '-'}</td>
                        <td className="p-2 text-right text-blue-700">{l.haber > 0 ? convertAmount(l.haber) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-900 text-white font-bold font-mono">
                    <tr>
                      <td colSpan={2} className="p-2 text-left">TOTALES IGUALES:</td>
                      <td className="p-2 text-right text-emerald-400">{convertAmount(previewClosingBalance.totalDebe)}</td>
                      <td className="p-2 text-right text-blue-400">{convertAmount(previewClosingBalance.totalHaber)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Modal / Panel de Previsualización y Asiento de Apertura */}
          {previewOpening && (
            <div className="bg-white border-2 border-emerald-300 rounded-xl p-5 shadow-md">
              <div className="flex items-center justify-between pb-3 border-b border-emerald-100">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">{previewOpening.concepto}</h4>
                    <span className="text-xs text-slate-500 font-mono">Fecha: {previewOpening.fecha} | {previewOpening.lineas.length} Partidas</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCommit(previewOpening, 'APERTURA_EJERCICIO')}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Asentar Comprobante de Apertura N° 1</span>
                  </button>
                  <button
                    onClick={() => setPreviewOpening(null)}
                    className="text-xs font-bold text-slate-500 hover:text-slate-800 px-3 py-2 cursor-pointer"
                  >
                    Cerrar
                  </button>
                </div>
              </div>

              <div className="mt-4 max-h-72 overflow-y-auto border border-slate-200 rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0">
                    <tr>
                      <th className="p-2 text-left">Código</th>
                      <th className="p-2 text-left">Cuenta</th>
                      <th className="p-2 text-right">Debe</th>
                      <th className="p-2 text-right">Haber</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {previewOpening.lineas.map((l, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="p-2 text-slate-500">{l.cuentaCodigo}</td>
                        <td className="p-2 font-sans text-slate-800">{l.cuentaNombre}</td>
                        <td className="p-2 text-right text-emerald-700">{l.debe > 0 ? convertAmount(l.debe) : '-'}</td>
                        <td className="p-2 text-right text-blue-700">{l.haber > 0 ? convertAmount(l.haber) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-900 text-white font-bold font-mono">
                    <tr>
                      <td colSpan={2} className="p-2 text-left">TOTALES IGUALES:</td>
                      <td className="p-2 text-right text-emerald-400">{convertAmount(previewOpening.totalDebe)}</td>
                      <td className="p-2 text-right text-blue-400">{convertAmount(previewOpening.totalHaber)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-PESTAÑA 3: ASISTENTE DE PUESTA AL DÍA (CATCH-UP RETROACTIVO) */}
      {subTab === 'CATCH_UP' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-purple-600" />
                  <span>Asistente de Regularización & Puesta al Día ("Catch-Up")</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Resuelve el dolor del contador: genera automáticamente los devengos y cancelaciones bancarias de meses atrasados (Remuneraciones, Previred, F29) con fechas históricas sin tipear asientos a mano.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={selectedCatchUpPeriod}
                  onChange={e => setSelectedCatchUpPeriod(e.target.value)}
                  className="text-xs font-mono font-bold bg-purple-50 border border-purple-200 text-purple-900 rounded-lg p-2"
                >
                  {mesesEjercicio.map(p => (
                    <option key={p} value={p}>Período: {p}</option>
                  ))}
                </select>
                <button
                  onClick={handleGenerateCatchUpPack}
                  className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Formular Cadena Contable</span>
                </button>
              </div>
            </div>

            {/* Panel de Fechas Históricas Calculadas */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4 text-xs font-mono">
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 block font-sans">1. Devengo Sueldos:</span>
                <span className="font-bold text-slate-900">{selectedCatchUpPeriod}-31</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 block font-sans">2. Pago Sueldos:</span>
                <span className="font-bold text-slate-900">Mes +1 (Día 05)</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 block font-sans">3. Pago Previred:</span>
                <span className="font-bold text-slate-900">Mes +1 (Día 13)</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 block font-sans">4. Devengo F29:</span>
                <span className="font-bold text-slate-900">{selectedCatchUpPeriod}-31</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 block font-sans">5. Pago F29 (SII):</span>
                <span className="font-bold text-slate-900">Mes +1 (Día 20)</span>
              </div>
            </div>

            {/* Si ya se formuló la cadena Catch-Up */}
            {catchUpGeneratedPack && (
              <div className="mt-5 space-y-4 pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <div>
                      <span className="font-bold text-slate-900 text-sm">
                        Cadena Contable Completa para {selectedCatchUpPeriod} (5 Comprobantes Generados)
                      </span>
                      <span className="text-xs text-slate-500 block">
                        Partida doble 100% verificada, conciliada con cuenta corriente banco y débitos/créditos legales.
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={handleCommitAllCatchUp}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-lg transition-colors cursor-pointer flex items-center gap-2 shadow-md"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Asentar los 5 Comprobantes al Libro Diario</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {catchUpGeneratedPack.todosLosAsientos.map((voucher, idx) => {
                    const isExpanded = expandedCatchUpVoucher === voucher.id;
                    return (
                      <div key={voucher.id} className="border border-slate-200 rounded-lg p-3 bg-slate-50/50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="bg-slate-900 text-white text-[10px] font-mono px-2 py-0.5 rounded font-bold">
                              #{idx + 1}
                            </span>
                            <div>
                              <span className="font-bold text-slate-900 text-xs block">{voucher.concepto}</span>
                              <span className="text-[11px] text-slate-500 font-mono">
                                Fecha: {voucher.fecha} | Ref: {voucher.documento} | Debe/Haber: {convertAmount(voucher.totalDebe)}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleCommit(voucher, `CATCHUP_${selectedCatchUpPeriod}_${idx}`)}
                              className="bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-[11px] font-bold px-3 py-1.5 rounded cursor-pointer"
                            >
                              Asentar este
                            </button>
                            <button
                              onClick={() => setExpandedCatchUpVoucher(isExpanded ? null : voucher.id)}
                              className="text-slate-500 hover:text-slate-900 p-1 cursor-pointer"
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        {/* Líneas desglosadas al expandir */}
                        {isExpanded && (
                          <div className="mt-3 pt-3 border-t border-slate-200">
                            <table className="w-full text-[11px]">
                              <thead className="text-slate-500 font-semibold border-b border-slate-200">
                                <tr>
                                  <th className="text-left pb-1">Código</th>
                                  <th className="text-left pb-1">Cuenta</th>
                                  <th className="text-right pb-1">Debe</th>
                                  <th className="text-right pb-1">Haber</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 font-mono">
                                {voucher.lineas.map((l, lineIdx) => (
                                  <tr key={lineIdx}>
                                    <td className="py-1 text-slate-500">{l.cuentaCodigo}</td>
                                    <td className="py-1 font-sans text-slate-800">{l.cuentaNombre}</td>
                                    <td className="py-1 text-right text-emerald-700">{l.debe > 0 ? convertAmount(l.debe) : '-'}</td>
                                    <td className="py-1 text-right text-blue-700">{l.haber > 0 ? convertAmount(l.haber) : '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de Reapertura Extraordinaria Justificada (NIC 8 / SII) */}
      <ExtraordinaryFiscalYearReopenModal
        isOpen={isReopenModalOpen}
        onClose={() => setIsReopenModalOpen(false)}
        company={company}
        onConfirmReopen={handleConfirmReopen}
      />
    </div>
  );
};
