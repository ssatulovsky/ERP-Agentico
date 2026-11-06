import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, 
  Bot, 
  Key, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  Download, 
  Upload, 
  Sparkles, 
  Layers, 
  Split, 
  Check, 
  X, 
  DollarSign, 
  Calendar, 
  BookOpen, 
  FileSpreadsheet, 
  ArrowRight, 
  Sliders, 
  ShieldCheck, 
  Send,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Landmark,
  CreditCard,
  Monitor,
  Camera,
  Laptop,
  ExternalLink,
  LogOut,
  Terminal,
  Copy,
  Search,
  Filter
} from 'lucide-react';
import { 
  DteDocument, 
  DteSplitItem, 
  SupplierAccountRule, 
  SiiCentralizationConfig, 
  SiiPendingPeriodDiagnostic,
  AccountingEntry,
  CompanyProfile, 
  ClientCompany,
  CostCenterMaster,
} from '../types';
import { SEED_COST_CENTERS } from '../data/seedCostCenters';
import { formatCLP } from '../utils/chileanAccounting';
import { 
  detectPendingSiiMonths, 
  getSuggestedAccountForDte, 
  validateDteSplit, 
  generateLibroCompras, 
  generateLibroVentas, 
  generateLibroHonorarios, 
  generateMonthlyCentralizationEntry, 
  generateDetailedCentralizationEntries,
  generatePaymentEntry, 
  generateCollectionEntry, 
  parseSiiRcvCsv,
  DEFAULT_SUPPLIER_RULES,
  DEFAULT_CENTRALIZATION_CONFIG,
  ACCESSIBLE_ACCOUNTS
} from '../utils/siiAutomation';
import { getStoredAuthToken } from '../services/apiClient';

interface SiiAutonomousEngineModalProps {
  isOpen: boolean;
  onClose: () => void;
  company: CompanyProfile | ClientCompany;
  dtes: DteDocument[];
  onAddMultipleDtes: (dtes: DteDocument[], autoSyncCashFlow: boolean) => void;
  onUpdateDte: (dte: DteDocument) => void;
  onAddAccountingEntry: (entry: AccountingEntry) => void | Promise<any>;
  onClearAllDtes?: () => void;
  costCenters?: CostCenterMaster[];
}

export const SiiAutonomousEngineModal: React.FC<SiiAutonomousEngineModalProps> = ({
  isOpen,
  onClose,
  company,
  dtes = [],
  onAddMultipleDtes,
  onUpdateDte,
  onAddAccountingEntry,
  onClearAllDtes,
  costCenters,
}) => {
  const safeDtes = Array.isArray(dtes) ? dtes : [];
  const availableCostCenters = useMemo(() => {
    return Array.isArray(costCenters) && costCenters.length > 0 ? costCenters : SEED_COST_CENTERS;
  }, [costCenters]);
  // Tabs principales del motor autónomo
  const [activeTab, setActiveTab] = useState<
    'DIAGNOSTICO_MESES' | 'PENDIENTES_CONTABILIZAR' | 'LIBROS_AUXILIARES' | 'CENTRALIZACION' | 'COBROS_PAGOS' | 'VISOR_CHROMIUM' | 'TERMINAL_LOGS' | 'PARAMETROS'
  >('DIAGNOSTICO_MESES');

  // Capturas de pantalla reales de Chromium en ejecución
  const [liveScreenshots, setLiveScreenshots] = useState<{ step: string; timestamp: string; url: string; imageBase64: string }[]>([]);
  const [selectedScreenshotIndex, setSelectedScreenshotIndex] = useState<number>(0);
  const [isTestingPlaywright, setIsTestingPlaywright] = useState<boolean>(false);

  // Filtros y búsqueda de logs para la consola
  const [logFilter, setLogFilter] = useState<'ALL' | 'ERROR' | 'PLAYWRIGHT' | 'INTERCEPTOR' | 'DIAGNOSTIC'>('ALL');
  const [logSearchQuery, setLogSearchQuery] = useState<string>('');
  const [copiedLogs, setCopiedLogs] = useState<boolean>(false);

  // Credenciales SII activas (tomadas de la configuración del cliente activo)
  const clientData = company && 'claveSii' in company ? (company as ClientCompany) : null;
  const [siiRut, setSiiRut] = useState(clientData?.rutAutenticacion || company?.rut || '');
  const [siiClave, setSiiClave] = useState(clientData?.claveSii || '');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (company?.rut) {
      setSiiRut(clientData?.rutAutenticacion || company.rut);
    }
    if (clientData?.claveSii) {
      setSiiClave(clientData.claveSii);
    }
  }, [company, clientData]);

  // Período de trabajo
  const [selectedPeriod, setSelectedPeriod] = useState<string>('2026-08');

  // Reglas de proveedores con historial contable
  const [supplierRules, setSupplierRules] = useState<SupplierAccountRule[]>(DEFAULT_SUPPLIER_RULES);

  // Configuración de cuentas para centralización mensual
  const [centralizationConfig, setCentralizationConfig] = useState<SiiCentralizationConfig>(DEFAULT_CENTRALIZATION_CONFIG);

  // Estado de sincronización automática con SII
  const [isSyncingSii, setIsSyncingSii] = useState(false);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [syncProgress, setSyncProgress] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Helper centralizado para incorporar logs en tiempo real
  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString('es-CL');
    setSyncLogs(prev => [...prev, `[${time}] ${msg}`]);
  };

  // Normalizador seguro de datos de imagen base64 (evita duplicar prefijo data:image/...)
  const normalizeImageData = (imgStr?: string) => {
    if (!imgStr) return '';
    if (imgStr.startsWith('data:image/')) return imgStr;
    return `data:image/jpeg;base64,${imgStr}`;
  };

  // Formateador seguro de hora/timestamp para evitar 'Invalid Date'
  const formatTimestamp = (ts?: string) => {
    if (!ts) return '';
    if (ts.includes(':') && (ts.includes('a') || ts.includes('p') || ts.includes('m') || ts.includes('M') || ts.length <= 15) && !ts.includes('T')) {
      return ts;
    }
    try {
      const d = new Date(ts);
      return isNaN(d.getTime()) ? ts : d.toLocaleTimeString('es-CL');
    } catch {
      return ts;
    }
  };

  const handleCopyLogs = () => {
    const text = syncLogs.join('\n');
    navigator.clipboard.writeText(text);
    setCopiedLogs(true);
    showToast('¡Bitácora completa copiada al portapapeles!');
    setTimeout(() => setCopiedLogs(false), 2500);
  };

  const handleDownloadLogs = () => {
    const text = syncLogs.join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sii-playwright-logs-${selectedPeriod}-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Descargando archivo de logs .txt');
  };

  // Modal de desglose de factura en varias partidas (Split)
  const [splitModalDte, setSplitModalDte] = useState<DteDocument | null>(null);
  const [splitPartidas, setSplitPartidas] = useState<DteSplitItem[]>([]);

  // Selección de DTEs para Cobros y Pagos
  const [selectedDtesForPayment, setSelectedDtesForPayment] = useState<string[]>([]);
  const [selectedDtesForCollection, setSelectedDtesForCollection] = useState<string[]>([]);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>('1.1.01');

  // Diagnóstico automático de meses sin actualizar
  const diagnostics = useMemo(() => {
    return detectPendingSiiMonths(safeDtes, 2026, 9);
  }, [safeDtes]);

  const mesesDesactualizados = useMemo(() => {
    return (diagnostics || []).filter(d => d.estado === 'DESACTUALIZADO' || d.estado === 'PARCIAL');
  }, [diagnostics]);

  // Movimientos pendientes de contabilizar
  const pendingToAccountDtes = useMemo(() => {
    return safeDtes.filter(d => {
      // Si no ha sido centralizado aún
      return !d.asientoCentralizacionId && (d.imputacionEstado !== 'CENTRALIZADO');
    });
  }, [safeDtes]);

  // Toast Helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  if (!isOpen) return null;

  // Ejecución del Agente: Descarga e Importación Automática desde SII
  const handleRunSiiAutoDownload = async (targetPeriodo?: string) => {
    setIsSyncingSii(true);
    setSyncLogs([]);
    setSyncProgress(10);

    const periodosToDownload = targetPeriodo ? [targetPeriodo] : (
      mesesDesactualizados.length > 0 ? mesesDesactualizados.map(m => m.periodo) : [selectedPeriod]
    );

    try {
      addLog(`[RPA Playwright] Conectando a Portal Oficial zeusr.sii.cl...`);
      addLog(`[Credenciales] RUT: ${siiRut || company?.rut || ''}`);
      setSyncProgress(25);

      let totalImportedDtes: DteDocument[] = [];

      for (let i = 0; i < periodosToDownload.length; i++) {
        const per = periodosToDownload[i];
        addLog(`Iniciando Chromium headless para consultar RCV período ${per}...`);
        
        let newBatch: DteDocument[] = [];
        try {
          const res = await fetch('/api/sii/run-playwright', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              rut: siiRut || company?.rut || '',
              password: siiClave,
              periodo: per,
              tipo: 'ALL',
              headless: true,
            }),
          });

          const data = await res.json();
          if (data.logs && Array.isArray(data.logs)) {
            data.logs.forEach((l: string) => addLog(l));
          }

          if (data.screenshots && Array.isArray(data.screenshots) && data.screenshots.length > 0) {
            setLiveScreenshots(data.screenshots);
          }

          if (data.success && data.documentos && Array.isArray(data.documentos) && data.documentos.length > 0) {
            newBatch = data.documentos;
            addLog(`[Playwright SII] Se descargaron e interpretaron ${data.documentos.length} documentos oficiales desde el CSV del período ${per}.`);
          } else if (data.success) {
            addLog(`[Playwright SII] Sin documentos registrados en RCV para período ${per}. Cero datos ficticios.`);
          } else {
            addLog(`[Playwright Alerta] ${data.error || 'No se pudo completar la extracción automática.'}`);
            addLog(`[Solución Oficial] Si el SII requiere resolución interactiva de Captcha o acceso desde IP residencial, utilice el botón de carga manual del archivo CSV oficial exportado de sii.cl.`);
          }
        } catch (fetchErr: any) {
          addLog(`[Error Playwright] Fallo en la comunicación con el bot de automatización: ${fetchErr.message}`);
        }

        // Si y sólo si Playwright devolvió documentos oficiales:
        if (newBatch.length > 0) {
          const processedBatch = newBatch.map(d => {
            if (d.tipoOperacion === 'COMPRA') {
              const sug = getSuggestedAccountForDte(d, supplierRules, company);
              return {
                ...d,
                cuentaCodigoAsignada: sug.cuentaCodigo,
                cuentaNombreAsignada: sug.cuentaNombre,
                reglaSugeridaOrigen: sug.origen,
                proveedorHistoricoDetectado: sug.esHistorico,
                imputacionEstado: 'IMPUTADO' as const
              };
            }
            return d;
          });
          totalImportedDtes = [...totalImportedDtes, ...processedBatch];
        }
      }

      setSyncProgress(90);

      if (totalImportedDtes.length > 0) {
        onAddMultipleDtes(totalImportedDtes, true);
        setSyncProgress(100);
        addLog(`¡Importación oficial finalizada! Se incorporaron ${totalImportedDtes.length} documentos reales.`);
        showToast(`¡Playwright importó ${totalImportedDtes.length} documentos reales!`);
      } else {
        setSyncProgress(100);
        addLog(`[Finalizado] No se descargaron documentos. Si el portal del SII solicita Captcha, cargue directamente el archivo CSV oficial descargado de sii.cl.`);
        showToast(`Sin documentos descargados. Puede cargar el CSV oficial.`);
      }
    } catch (err: any) {
      addLog(`Error en ejecución Playwright: ${err.message}`);
    } finally {
      setIsSyncingSii(false);
    }
  };

  // Inspección y captura en vivo de pantallas de Chromium contra zeusr.sii.cl
  const handleRunPlaywrightInspection = async () => {
    setIsTestingPlaywright(true);
    addLog(`[Chromium Inspector] Iniciando sesión para inspección visual y captura en período ${selectedPeriod}...`);
    showToast('Lanzando Chromium en Cloud Run para inspeccionar zeusr.sii.cl...');
    try {
      const res = await fetch('/api/sii/run-playwright', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rut: siiRut || company?.rut || '',
          password: siiClave,
          periodo: selectedPeriod,
          tipo: 'ALL',
          headless: true,
        }),
      });
      const data = await res.json();
      if (data.logs && Array.isArray(data.logs)) {
        data.logs.forEach((l: string) => addLog(l));
      }
      if (data.screenshots && Array.isArray(data.screenshots) && data.screenshots.length > 0) {
        setLiveScreenshots(data.screenshots);
        setSelectedScreenshotIndex(0);
        setActiveTab('VISOR_CHROMIUM');
        showToast(`¡Se obtuvieron ${data.screenshots.length} capturas en vivo de Chromium!`);
      } else {
        showToast(data.error || 'Chromium ejecutó la sesión en el servidor.');
      }
    } catch (err: any) {
      addLog(`[Error Inspección] ${err.message}`);
      showToast(`Error al ejecutar Chromium: ${err.message}`);
    } finally {
      setIsTestingPlaywright(false);
    }
  };

  // Liberación activa de sesiones concurrentes en zeusr.sii.cl (Error 01.01.112.500.720.27)
  const [isClosingSessions, setIsClosingSessions] = useState(false);
  const handleCloseSiiSessions = async () => {
    setIsClosingSessions(true);
    addLog('[Sesiones SII] Solicitando liberación de sesiones activas en zeusr.sii.cl/cgi_AUT2000/CAutFin.cgi...');
    showToast('Enviando instrucción de cierre de sesiones a pasarela zeusr.sii.cl...');
    try {
      const res = await fetch('/api/sii/close-sessions', { method: 'POST' });
      const data = await res.json();
      if (data.logs && Array.isArray(data.logs)) {
        data.logs.forEach((l: string) => addLog(l));
      }
      if (data.success) {
        addLog('[Sesiones SII] Sesiones concurrentes liberadas correctamente en el SII.');
        showToast('¡Sesiones concurrentes liberadas en el SII! Puede reintentar la sincronización.');
      } else {
        addLog(`[Aviso Sesiones] ${data.error || 'Compruebe sesiones activas en navegador.'}`);
        showToast('Instrucción enviada a zeusr.sii.cl/cgi_AUT2000/CAutFin.cgi.');
      }
    } catch (e: any) {
      addLog(`[Error Cierre Sesiones] ${e.message}`);
      showToast('Solicitud enviada al servidor.');
    } finally {
      setIsClosingSessions(false);
    }
  };

  // Estado para subida de archivo oficial CSV del SII
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreviewDtes, setCsvPreviewDtes] = useState<DteDocument[]>([]);
  const [isParsingCsv, setIsParsingCsv] = useState(false);
  const [csvError, setCsvError] = useState<string | null>(null);

  const handleCsvFileUpload = (file: File) => {
    setCsvFile(file);
    setIsParsingCsv(true);
    setCsvError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = (e.target?.result as string) || '';
        const parsed = parseSiiRcvCsv(text, 'COMPRA');
        if (parsed.length === 0) {
          setCsvError('No se encontraron registros en el archivo. Verifique que sea un archivo oficial CSV descargado de sii.cl (Registro de Compras, Registro de Ventas o Boletas de Honorarios).');
          setCsvPreviewDtes([]);
        } else {
          // Asignar reglas sugeridas a compras
          const enriched = parsed.map(d => {
            if (d.tipoOperacion === 'COMPRA') {
              const sug = getSuggestedAccountForDte(d, supplierRules, company);
              return {
                ...d,
                cuentaCodigoAsignada: sug.cuentaCodigo,
                cuentaNombreAsignada: sug.cuentaNombre,
                reglaSugeridaOrigen: sug.origen,
                proveedorHistoricoDetectado: sug.esHistorico,
                imputacionEstado: 'IMPUTADO' as const
              };
            }
            return d;
          });
          setCsvPreviewDtes(enriched);
        }
      } catch (err: any) {
        setCsvError(`Error al procesar el archivo CSV: ${err.message}`);
        setCsvPreviewDtes([]);
      } finally {
        setIsParsingCsv(false);
      }
    };
    reader.onerror = () => {
      setCsvError('Error al leer el archivo seleccionado.');
      setIsParsingCsv(false);
    };
    reader.readAsText(file, 'ISO-8859-1');
  };

  const handleConfirmCsvImport = () => {
    if (csvPreviewDtes.length === 0) return;
    onAddMultipleDtes(csvPreviewDtes, true);
    showToast(`¡Se importaron ${csvPreviewDtes.length} documentos oficiales desde el archivo CSV!`);
    setCsvPreviewDtes([]);
    setCsvFile(null);
  };

  // Abrir modal de Split de Factura
  const handleOpenSplitModal = (dte: DteDocument) => {
    setSplitModalDte(dte);
    if (dte.partidasDesglosadas && dte.partidasDesglosadas.length > 0) {
      setSplitPartidas([...dte.partidasDesglosadas]);
    } else {
      // Partida inicial con el total neto
      const sug = getSuggestedAccountForDte(dte, supplierRules, company);
      setSplitPartidas([
        {
          id: `split-1-${Date.now()}`,
          cuentaCodigo: sug.cuentaCodigo,
          cuentaNombre: sug.cuentaNombre,
          concepto: dte.glosa || 'Partida principal de mercadería / servicio',
          montoNeto: dte.montoNeto,
          centroCostoId: dte.centroCostoId,
          centroCostoCodigo: dte.centroCostoCodigo,
          centroCostoNombre: dte.centroCostoNombre,
        }
      ]);
    }
  };

  // Agregar partida al split
  const handleAddSplitItem = () => {
    if (!splitModalDte) return;
    const currentSum = splitPartidas.reduce((s, p) => s + (p.montoNeto || 0), 0);
    const remaining = Math.max(0, splitModalDte.montoNeto - currentSum);

    setSplitPartidas([
      ...splitPartidas,
      {
        id: `split-${Date.now()}`,
        cuentaCodigo: '5.1.07',
        cuentaNombre: 'Gasto Fletes y Transporte de Envíos',
        concepto: 'Gasto complementario / Flete asociado a la compra',
        montoNeto: remaining,
        centroCostoId: splitModalDte.centroCostoId,
        centroCostoCodigo: splitModalDte.centroCostoCodigo,
        centroCostoNombre: splitModalDte.centroCostoNombre,
      }
    ]);
  };

  // Guardar desglose de la factura
  const handleSaveSplit = () => {
    if (!splitModalDte) return;
    const val = validateDteSplit(splitModalDte, splitPartidas);
    if (!val.valido) {
      alert(val.mensaje);
      return;
    }

    const updated: DteDocument = {
      ...splitModalDte,
      partidasDesglosadas: splitPartidas,
      imputacionEstado: 'IMPUTADO',
      reglaSugeridaOrigen: 'MANUAL',
      glosa: `Factura desglosada en ${splitPartidas.length} partidas contables`
    };

    onUpdateDte(updated);
    setSplitModalDte(null);
    showToast(`¡Factura Folio ${updated.folio} desglosada exitosamente en ${splitPartidas.length} partidas!`);
  };

  // Ejecución de Centralización de Compras o Ventas (Resumen o Detallado) con Certificación Agéntica
  const handleGenerateCentralization = async (tipo: 'COMPRA' | 'VENTA') => {
    try {
      // 1. Auditoría y certificación por el Agente Autónomo Tributario SII (ReAct Loop)
      try {
        const authToken = getStoredAuthToken();
        const docsCount = safeDtes.filter(d => (tipo === 'COMPRA' ? d.tipoOperacion === 'COMPRA' : d.tipoOperacion === 'VENTA') && (d.periodo === selectedPeriod || d.fechaEmision?.startsWith(selectedPeriod))).length;
        const agentRes = await fetch('/api/agents/autonomous/execute', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          },
          body: JSON.stringify({
            module: 'TRIBUTARIO_SII',
            modulo: 'TRIBUTARIO_SII',
            empresaId: company.rut,
            query: `Certificar y centralizar ${docsCount} documentos de ${tipo === 'COMPRA' ? 'Compras' : 'Ventas'} para el período ${selectedPeriod} al Libro Diario.`,
            context: {
              empresa: company,
              company,
              periodo: selectedPeriod,
              tipo,
              dtes: safeDtes,
            },
          }),
        });
        if (agentRes.ok) {
          const aData = await agentRes.json();
          if (aData.decision || aData.finalText) {
            addLog(`🤖 [Agente Tributario SII] ${((aData.decision || aData.finalText) as string).slice(0, 150)}...`);
          }
        }
      } catch (agentErr) {
        console.warn('[SiiAutonomousEngineModal] Fallback agéntico:', agentErr);
      }

      const isDetailed = centralizationConfig.modoRegistroContable === 'DETALLADO_DOCUMENTO';

      if (isDetailed) {
        const result = generateDetailedCentralizationEntries(
          selectedPeriod,
          tipo,
          safeDtes,
          centralizationConfig,
          company,
          supplierRules
        );

        for (const entry of result.asientos) {
          await Promise.resolve(onAddAccountingEntry(entry));
        }

        result.dtesAfectadosIds.forEach(id => {
          const doc = safeDtes.find(d => d.id === id);
          if (doc) {
            onUpdateDte({
              ...doc,
              imputacionEstado: 'CENTRALIZADO',
              asientoCentralizacionId: `centraliz-det-${selectedPeriod}-${doc.folio}`
            });
          }
        });

        showToast(`¡Se han generado exitosamente ${result.asientos.length} asientos contables individuales (movimiento a movimiento) para ${tipo === 'COMPRA' ? 'Compras' : 'Ventas'} (${selectedPeriod}) en el Libro Diario!`);
      } else {
        const result = generateMonthlyCentralizationEntry(
          selectedPeriod,
          tipo,
          safeDtes,
          centralizationConfig,
          company,
          supplierRules
        );

        // Esperar persistencia atómica en el backend / MySQL
        await Promise.resolve(onAddAccountingEntry(result.asiento));

        // Marcar los DTEs involucrados como centralizados
        result.dtesAfectadosIds.forEach(id => {
          const doc = safeDtes.find(d => d.id === id);
          if (doc) {
            onUpdateDte({
              ...doc,
              imputacionEstado: 'CENTRALIZADO',
              asientoCentralizacionId: result.asiento.id
            });
          }
        });

        showToast(`¡Asiento de Centralización Resumen de ${tipo === 'COMPRA' ? 'Compras' : 'Ventas'} (${selectedPeriod}) generado e incorporado al Libro Diario!`);
      }
    } catch (err: any) {
      console.error('[SiiAutonomousEngineModal] Error al centralizar:', err);
      alert(`Error al generar centralización: ${err?.message || String(err)}`);
    }
  };

  // Ejecutar Pago Masivo / Individual de Compras
  const handleExecutePayment = async () => {
    if (selectedDtesForPayment.length === 0) {
      alert('Seleccione al menos una factura de compra para generar el pago.');
      return;
    }

    try {
      const docsToPay = safeDtes.filter(d => selectedDtesForPayment.includes(d.id));
      const cuentaBanco = ACCESSIBLE_ACCOUNTS.find(a => a.codigo === selectedBankAccountId) || {
        codigo: '1.1.01',
        nombre: 'Banco Santander - Cta Cte'
      };

      const asientoPago = generatePaymentEntry(
        docsToPay,
        cuentaBanco,
        centralizationConfig.cuentaComprasPasivo,
        new Date().toISOString().split('T')[0]
      );

      await Promise.resolve(onAddAccountingEntry(asientoPago));

      // Actualizar estado a PAGADO
      docsToPay.forEach(d => {
        onUpdateDte({
          ...d,
          estadoPago: 'PAGADO'
        });
      });

      setSelectedDtesForPayment([]);
      showToast(`¡Comprobante de pago a proveedores registrado exitosamente en contabilidad por ${formatCLP(asientoPago.totalDebe)}!`);
    } catch (err: any) {
      console.error('[SiiAutonomousEngineModal] Error al registrar pago:', err);
      alert(`Error al registrar pago: ${err?.message || String(err)}`);
    }
  };

  // Ejecutar Cobro Masivo / Individual de Ventas
  const handleExecuteCollection = async () => {
    if (selectedDtesForCollection.length === 0) {
      alert('Seleccione al menos una factura de venta para registrar su cobro.');
      return;
    }

    try {
      const docsToCollect = safeDtes.filter(d => selectedDtesForCollection.includes(d.id));
      const cuentaBanco = ACCESSIBLE_ACCOUNTS.find(a => a.codigo === selectedBankAccountId) || {
        codigo: '1.1.01',
        nombre: 'Banco Santander - Cta Cte'
      };

      const asientoCobro = generateCollectionEntry(
        docsToCollect,
        cuentaBanco,
        centralizationConfig.cuentaVentasActivo,
        new Date().toISOString().split('T')[0]
      );

      await Promise.resolve(onAddAccountingEntry(asientoCobro));

      // Actualizar estado a COBRADO
      docsToCollect.forEach(d => {
        onUpdateDte({
          ...d,
          estadoPago: 'COBRADO'
        });
      });

      setSelectedDtesForCollection([]);
      showToast(`¡Cobro de clientes registrado en Libro Diario y Cartola por ${formatCLP(asientoCobro.totalDebe)}!`);
    } catch (err: any) {
      console.error('[SiiAutonomousEngineModal] Error al registrar cobro:', err);
      alert(`Error al registrar cobro: ${err?.message || String(err)}`);
    }
  };

  // Libros Auxiliares Calculados para el período seleccionado
  const libroCompras = useMemo(() => generateLibroCompras(safeDtes, selectedPeriod), [safeDtes, selectedPeriod]);
  const libroVentas = useMemo(() => generateLibroVentas(safeDtes, selectedPeriod), [safeDtes, selectedPeriod]);
  const libroHonorarios = useMemo(() => generateLibroHonorarios(safeDtes, selectedPeriod), [safeDtes, selectedPeriod]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col border border-slate-200 overflow-hidden">
        
        {/* Modal Top Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/30 rounded-lg border border-blue-500/40 text-blue-400">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">Agente Autónomo SII & Imputación Contable</h2>
                <span className="bg-emerald-500/20 text-emerald-400 text-xs px-2 py-0.5 rounded-full font-mono font-medium border border-emerald-500/30">
                  RCV + BHE + Centralización
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Empresa activa: <strong className="text-slate-200">{company?.razonSocial || 'Empresa'}</strong> ({company?.rut || siiRut}) | SII Clave Tributaria activa
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Period Selector */}
            <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 text-xs">
              <Calendar className="w-4 h-4 text-blue-400" />
              <span className="text-slate-400">Período Fiscal:</span>
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="bg-transparent font-bold text-white outline-none cursor-pointer"
              >
                <option value="2026-09" className="bg-slate-800">Septiembre 2026</option>
                <option value="2026-08" className="bg-slate-800">Agosto 2026</option>
                <option value="2026-07" className="bg-slate-800">Julio 2026</option>
                <option value="2026-06" className="bg-slate-800">Junio 2026</option>
                <option value="2026-05" className="bg-slate-800">Mayo 2026</option>
                <option value="2026-04" className="bg-slate-800">Abril 2026</option>
                <option value="2026-03" className="bg-slate-800">Marzo 2026</option>
                <option value="2026-02" className="bg-slate-800">Febrero 2026</option>
                <option value="2026-01" className="bg-slate-800">Enero 2026</option>
              </select>
            </div>

            {dtes.length > 0 && (
              <button
                onClick={() => {
                  if (onClearAllDtes) {
                    onClearAllDtes();
                  } else {
                    onAddMultipleDtes([], false);
                  }
                  showToast('Se eliminaron todos los documentos de memoria. Base limpia en cero.');
                }}
                className="bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                title="Eliminar documentos actuales y dejar la base en blanco"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Vaciar Base ({dtes.length})</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Sub-Tabs */}
        <div className="bg-slate-50 border-b border-slate-200 px-5 flex items-center justify-between overflow-x-auto">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab('DIAGNOSTICO_MESES')}
              className={`py-3 px-3 text-xs font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
                activeTab === 'DIAGNOSTICO_MESES'
                  ? 'border-blue-600 text-blue-700 bg-blue-50/50'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <RefreshCw className="w-4 h-4" />
              Diagnóstico de Meses SII
              {mesesDesactualizados.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                  {mesesDesactualizados.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('PENDIENTES_CONTABILIZAR')}
              className={`py-3 px-3 text-xs font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
                activeTab === 'PENDIENTES_CONTABILIZAR'
                  ? 'border-blue-600 text-blue-700 bg-blue-50/50'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-4 h-4" />
              Movimientos & Imputación
              {pendingToAccountDtes.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-blue-600 text-white text-[10px] font-bold">
                  {pendingToAccountDtes.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('LIBROS_AUXILIARES')}
              className={`py-3 px-3 text-xs font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
                activeTab === 'LIBROS_AUXILIARES'
                  ? 'border-blue-600 text-blue-700 bg-blue-50/50'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              Libros Auxiliares (Compras / Ventas / BHE)
            </button>

            <button
              onClick={() => setActiveTab('CENTRALIZACION')}
              className={`py-3 px-3 text-xs font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
                activeTab === 'CENTRALIZACION'
                  ? 'border-blue-600 text-blue-700 bg-blue-50/50'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sliders className="w-4 h-4" />
              Centralización Mensual Parametrizada
            </button>

            <button
              onClick={() => setActiveTab('COBROS_PAGOS')}
              className={`py-3 px-3 text-xs font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
                activeTab === 'COBROS_PAGOS'
                  ? 'border-blue-600 text-blue-700 bg-blue-50/50'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              Cobros & Pagos a Partidas
            </button>

            <button
              onClick={() => setActiveTab('VISOR_CHROMIUM')}
              className={`py-3 px-3 text-xs font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
                activeTab === 'VISOR_CHROMIUM'
                  ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50 font-bold'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Monitor className="w-4 h-4 text-indigo-600" />
              <span>Visor Chromium en Vivo (SII)</span>
              {liveScreenshots.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-indigo-600 text-white text-[10px] font-bold font-mono">
                  {liveScreenshots.length} Capturas
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('TERMINAL_LOGS')}
              className={`py-3 px-3 text-xs font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
                activeTab === 'TERMINAL_LOGS'
                  ? 'border-slate-900 text-slate-900 bg-slate-100 font-bold'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Terminal className="w-4 h-4 text-slate-700" />
              <span>Terminal y Logs SII</span>
              {syncLogs.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-white text-[10px] font-bold font-mono">
                  {syncLogs.length}
                </span>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500 font-mono">
              RUT: <strong>{siiRut}</strong>
            </span>
          </div>
        </div>

        {/* Toast Alert */}
        {toastMessage && (
          <div className="bg-emerald-600 text-white text-xs px-4 py-2 font-medium flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>{toastMessage}</span>
            </div>
            <button onClick={() => setToastMessage(null)}><X className="w-3.5 h-3.5" /></button>
          </div>
        )}

        {/* Tab Body */}
        <div className="p-6 overflow-y-auto flex-1 bg-white">

          {/* =========================================================
              TAB 1: DIAGNÓSTICO DE MESES SII & DESCARGA AUTOMÁTICA
             ========================================================= */}
          {activeTab === 'DIAGNOSTICO_MESES' && (
            <div className="space-y-6">
              {/* Credential Status Box */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-100 text-blue-700 rounded-lg">
                    <Key className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">Credenciales de Acceso al SII (Portal RCV / consdcvinternetui)</h4>
                    <p className="text-xs text-slate-500">
                      Utilizadas por el agente para iniciar sesión y descargar archivos CSV de compras, ventas y honorarios.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                  <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-300 text-xs">
                    <span className="text-slate-400 font-mono">RUT:</span>
                    <input
                      type="text"
                      value={siiRut}
                      onChange={(e) => setSiiRut(e.target.value)}
                      className="font-mono font-bold text-slate-800 w-28 bg-transparent outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-300 text-xs">
                    <span className="text-slate-400 font-mono">Clave:</span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={siiClave}
                      onChange={(e) => setSiiClave(e.target.value)}
                      className="font-mono font-bold text-slate-800 w-24 bg-transparent outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <button
                    onClick={() => handleRunSiiAutoDownload()}
                    disabled={isSyncingSii}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm disabled:opacity-50 transition-all shrink-0"
                  >
                    {isSyncingSii ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Sincronizando con SII...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4" />
                        Descargar Meses Sin Actualizar ({mesesDesactualizados.length})
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleCloseSiiSessions}
                    disabled={isClosingSessions}
                    title="Cierra sesiones huérfanas en zeusr.sii.cl para solucionar el error 01.01.112.500.720.27"
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm disabled:opacity-50 transition-all shrink-0 cursor-pointer"
                  >
                    <LogOut className={`w-3.5 h-3.5 text-amber-600 ${isClosingSessions ? 'animate-spin' : ''}`} />
                    <span>{isClosingSessions ? 'Liberando...' : 'Liberar Sesiones SII'}</span>
                  </button>
                </div>
              </div>

              {/* Importación Directa de CSV Oficial y Control de Integridad */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Panel de Carga CSV Oficial */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                        <Upload className="w-4 h-4 text-blue-600" />
                        Cargar Archivo Oficial CSV de sii.cl
                      </h4>
                      <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-mono font-semibold">
                        RCV Compras / Ventas / BHE
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Cargue directamente el archivo CSV descargado desde el portal del SII. El sistema parsea automáticamente el separador y mapea las columnas sin datos simulados.
                    </p>
                  </div>

                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <label className="cursor-pointer bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors shadow-xs">
                        <Upload className="w-3.5 h-3.5 text-blue-600" />
                        <span>{csvFile ? csvFile.name : 'Seleccionar Archivo .csv / .txt'}</span>
                        <input
                          type="file"
                          accept=".csv,.txt,.tsv"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleCsvFileUpload(e.target.files[0]);
                            }
                          }}
                        />
                      </label>
                      {csvFile && (
                        <button
                          onClick={() => {
                            setCsvFile(null);
                            setCsvPreviewDtes([]);
                            setCsvError(null);
                          }}
                          className="text-slate-400 hover:text-slate-600 p-1"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {isParsingCsv && (
                      <div className="text-xs text-blue-600 flex items-center gap-1.5 font-medium">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Analizando archivo del SII...
                      </div>
                    )}

                    {csvError && (
                      <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 p-2 rounded-lg font-medium">
                        {csvError}
                      </div>
                    )}

                    {csvPreviewDtes.length > 0 && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 flex items-center justify-between text-xs">
                        <div>
                          <span className="font-bold text-emerald-800">
                            {csvPreviewDtes.length} documentos válidos detectados
                          </span>
                          <div className="text-[11px] text-emerald-600 font-mono">
                            Total: {formatCLP(csvPreviewDtes.reduce((s, d) => s + d.montoTotal, 0))}
                          </div>
                        </div>
                        <button
                          onClick={handleConfirmCsvImport}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs"
                        >
                          Importar al Libro
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Panel de Limpieza de Registros de Muestra */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        Integridad de Datos & Registros de Muestra
                      </h4>
                      <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-mono font-semibold">
                        {dtes.length} docs en memoria
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Si la empresa contiene datos iniciales de plantilla y desea comenzar desde cero con los documentos 100% reales de su negocio, puede vaciarlos con este botón.
                    </p>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-slate-600 font-medium">
                      {dtes.length === 0 ? 'Empresa limpia (0 documentos cargados).' : `${dtes.length} documentos registrados actualmente.`}
                    </span>
                    {dtes.length > 0 && (
                      <button
                        onClick={() => {
                          if (onClearAllDtes) {
                            onClearAllDtes();
                          } else {
                            onAddMultipleDtes([], false);
                          }
                          showToast('Se eliminaron todos los documentos de memoria. Registros en cero.');
                        }}
                        className="bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-white" />
                        <span>Vaciar Registros ({dtes.length})</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Terminal Logs si está sincronizando */}
              {syncLogs.length > 0 && (
                <div className="bg-slate-900 text-slate-200 rounded-xl p-4 font-mono text-xs border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-slate-400 font-bold">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      Consola de Conexión & Automatización SII (Playwright / Web Services API)
                    </div>
                    <span>{syncProgress}%</span>
                  </div>
                  <div className="max-h-36 overflow-y-auto space-y-0.5 pt-2">
                    {syncLogs.map((log, idx) => (
                      <div key={idx} className="leading-relaxed text-slate-300">
                        {log}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Grid de Meses Evaluados */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    Estado de Sincronización Mensual del Año Fiscal 2026
                  </h3>
                  <span className="text-xs text-slate-500">
                    {mesesDesactualizados.length === 0 ? (
                      <span className="text-emerald-600 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> Todos los meses están actualizados
                      </span>
                    ) : (
                      <span className="text-amber-600 font-semibold flex items-center gap-1">
                        <AlertTriangle className="w-4 h-4" /> {mesesDesactualizados.length} períodos requieren actualización desde SII
                      </span>
                    )}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {diagnostics.map((diag) => {
                    const isDesactualizado = diag.estado === 'DESACTUALIZADO';
                    const isParcial = diag.estado === 'PARCIAL';
                    const isActualizado = diag.estado === 'ACTUALIZADO' || diag.estado === 'PENDIENTE_SINCRONIZAR';

                    return (
                      <div
                        key={diag.periodo}
                        className={`border rounded-xl p-4 transition-all ${
                          isDesactualizado
                            ? 'bg-rose-50/40 border-rose-200'
                            : isParcial
                            ? 'bg-amber-50/40 border-amber-200'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-slate-800">{diag.nombreMes}</span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                              isDesactualizado
                                ? 'bg-rose-100 text-rose-700 border border-rose-300'
                                : isParcial
                                ? 'bg-amber-100 text-amber-700 border border-amber-300'
                                : 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                            }`}
                          >
                            {diag.estado}
                          </span>
                        </div>

                        <div className="mt-3 space-y-1.5 text-xs text-slate-600 font-mono">
                          <div className="flex items-center justify-between">
                            <span>Documentos RCV:</span>
                            <strong className="text-slate-800">{diag.totalDocumentosRegistrados} docs</strong>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Compras RCV:</span>
                            <span>{diag.comprasSincronizadas ? '✅ Al día' : '❌ Falta'}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Ventas RCV:</span>
                            <span>{diag.ventasSincronizadas ? '✅ Al día' : '❌ Falta'}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>BHE Honorarios:</span>
                            <span>{diag.honorariosSincronizados ? '✅ Al día' : '❌ Falta'}</span>
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between">
                          <button
                            onClick={() => {
                              setSelectedPeriod(diag.periodo);
                              setActiveTab('PENDIENTES_CONTABILIZAR');
                            }}
                            className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
                          >
                            Ver Detalle <ChevronRight className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleRunSiiAutoDownload(diag.periodo)}
                            disabled={isSyncingSii}
                            className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-2 py-1 rounded transition-colors"
                          >
                            Bajar SII
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* =========================================================
              TAB 2: MOVIMIENTOS PENDIENTES DE CONTABILIZAR & MOTOR IMPUTACIÓN
             ========================================================= */}
          {activeTab === 'PENDIENTES_CONTABILIZAR' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-blue-600" />
                    Movimientos Pendientes de Contabilizar ({pendingToAccountDtes.length})
                  </h3>
                  <p className="text-xs text-slate-500">
                    El agente coteja cada proveedor con la memoria contable. Si tiene historial repite el código contable, si es nuevo sugiere con IA, y permite abrir en varias partidas.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {dtes.length > 0 && (
                    <button
                      onClick={() => {
                        if (onClearAllDtes) {
                          onClearAllDtes();
                        } else {
                          onAddMultipleDtes([], false);
                        }
                        showToast('Todos los documentos han sido eliminados de la memoria. Base limpia en cero.');
                      }}
                      className="bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                      title="Eliminar documentos cargados y dejar la base en 0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Vaciar Base ({dtes.length})</span>
                    </button>
                  )}
                  <button
                    onClick={() => handleGenerateCentralization('COMPRA')}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    Centralizar Compras del Mes
                  </button>
                  <button
                    onClick={() => handleGenerateCentralization('VENTA')}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    Centralizar Ventas del Mes
                  </button>
                </div>
              </div>

              <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>
                    <strong>Modo Contabilidad Real:</strong> No se inyecta ningún registro de prueba. Los datos sólo se obtienen desde el RCV oficial vía Chromium o subiendo el archivo CSV exportado del SII. Si existen datos previos en pantalla, use <strong>"Limpiar Base"</strong> para iniciar en blanco.
                  </span>
                </div>
              </div>

              {/* Tabla de Movimientos */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                      <th className="py-2.5 px-3">Tipo / Folio</th>
                      <th className="py-2.5 px-3">Fecha</th>
                      <th className="py-2.5 px-3">RUT & Proveedor / Cliente</th>
                      <th className="py-2.5 px-3 text-right text-amber-800">Exento ($)</th>
                      <th className="py-2.5 px-3 text-right">Neto ($)</th>
                      <th className="py-2.5 px-3 text-right">IVA ($)</th>
                      <th className="py-2.5 px-3 text-right">Total ($)</th>
                      <th className="py-2.5 px-3">Imputación Contable Asignada</th>
                      <th className="py-2.5 px-3 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dtes.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-slate-400">
                          No existen movimientos en el sistema. Ejecuta la descarga automática desde el SII en la pestaña Diagnóstico.
                        </td>
                      </tr>
                    ) : (
                      dtes.slice(0, 30).map((dte) => {
                        const sug = getSuggestedAccountForDte(dte, supplierRules, company);
                        const codFinal = dte.cuentaCodigoAsignada || dte.cuentaContableDebe || sug.cuentaCodigo;
                        const nomFinal = dte.cuentaNombreAsignada || sug.cuentaNombre;
                        const esSplit = dte.partidasDesglosadas && dte.partidasDesglosadas.length > 0;

                        const displayRazon = (dte.razonSocialContraparte && dte.razonSocialContraparte !== '-' && dte.razonSocialContraparte !== dte.rutContraparte)
                          ? dte.razonSocialContraparte
                          : (dte.rutContraparte?.includes('76431675') || dte.rutContraparte?.includes('76.431.675'))
                            ? 'VETERINARY HISTOPATHOLOGY CENTER SPA'
                            : (dte.tipoOperacion === 'VENTA' ? 'CLIENTE REGISTRADO SII' : 'PROVEEDOR REGISTRADO SII');

                        return (
                          <tr key={dte.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2.5 px-3 font-mono">
                              <span className="font-bold text-slate-800">
                                {dte.tipoDte === '33' ? 'Factura 33' : dte.tipoDte === '34' ? 'Factura Exenta 34' : dte.tipoDte === '61' ? 'NC 61' : dte.tipoDte}
                              </span>
                              <div className="text-[11px] text-slate-500">Folio: {dte.folio}</div>
                            </td>

                            <td className="py-2.5 px-3 font-mono text-slate-600 whitespace-nowrap">
                              {dte.fechaEmision}
                            </td>

                            <td className="py-2.5 px-3">
                              <div className="font-bold text-slate-800">{displayRazon}</div>
                              <div className="text-[11px] font-mono text-slate-500">{dte.rutContraparte}</div>
                            </td>

                            <td className="py-2.5 px-3 text-right font-mono font-medium text-amber-700">
                              {formatCLP(dte.montoExento || 0)}
                            </td>

                            <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-700">
                              {formatCLP(dte.montoNeto)}
                            </td>

                            <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                              {formatCLP(dte.montoIva)}
                            </td>

                            <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                              {formatCLP(dte.montoTotal)}
                            </td>

                            <td className="py-2.5 px-3">
                              {esSplit ? (
                                <div className="space-y-1">
                                  <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-[11px] font-bold">
                                    <Split className="w-3 h-3" />
                                    Desglosada en {dte.partidasDesglosadas!.length} partidas
                                  </span>
                                  <div className="text-[10px] text-slate-500 font-mono flex flex-wrap gap-1">
                                    {dte.partidasDesglosadas!.map((p, pIdx) => (
                                      <span key={p.id || pIdx} className="bg-slate-100 border border-slate-200 px-1 py-0.2 rounded">
                                        {p.cuentaCodigo}
                                        {p.centroCostoCodigo && (
                                          <span className="ml-1 text-indigo-700 font-bold font-sans">
                                            [{p.centroCostoCodigo}]
                                          </span>
                                        )}: {formatCLP(p.montoNeto)}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono font-bold text-blue-700">{codFinal}</span>
                                    {sug.esHistorico ? (
                                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-semibold px-1.5 py-0.2 rounded" title="Proveedor con historial contable previo">
                                        Historial OK
                                      </span>
                                    ) : (
                                      <span className="bg-purple-100 text-purple-800 text-[10px] font-semibold px-1.5 py-0.2 rounded" title="Sugerido inteligentemente por Agente IA">
                                        Sugerencia IA
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-slate-600 truncate max-w-xs">{nomFinal}</div>
                                </div>
                              )}
                            </td>

                            <td className="py-2.5 px-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => handleOpenSplitModal(dte)}
                                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors"
                                  title="Abrir o dividir en varias partidas contables"
                                >
                                  <Split className="w-3.5 h-3.5 text-purple-600" />
                                  <span className="hidden sm:inline">Desglosar</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* =========================================================
              TAB 3: LIBROS AUXILIARES OFICIALES
             ========================================================= */}
          {activeTab === 'LIBROS_AUXILIARES' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    Libros Auxiliares Tributarios Oficiales - Período {selectedPeriod}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Generación reglamentaria de acuerdo al Art. 56 del DL 825 de IVA y Resolución Exenta del SII.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => window.print()}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Exportar / Imprimir
                  </button>
                </div>
              </div>

              {/* Libro de Compras */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-blue-100 text-blue-700 rounded-md">
                      <TrendingDown className="w-4 h-4" />
                    </span>
                    <h4 className="text-sm font-bold text-slate-800">Libro Auxiliar de Compras</h4>
                    <span className="text-xs text-slate-500 font-mono">({libroCompras.totalDocumentos} documentos)</span>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-mono">
                    <div>Neto: <strong>{formatCLP(libroCompras.totalNeto)}</strong></div>
                    <div>IVA Crédito: <strong className="text-blue-700">{formatCLP(libroCompras.totalIvaRecuperable)}</strong></div>
                    <div>Total: <strong className="text-slate-900">{formatCLP(libroCompras.totalBruto)}</strong></div>
                  </div>
                </div>

                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg bg-white">
                  <table className="w-full text-left text-[11px] font-mono">
                    <thead className="bg-slate-100 text-slate-700 font-semibold border-b">
                      <tr>
                        <th className="p-2">Tipo</th>
                        <th className="p-2">Folio</th>
                        <th className="p-2">Fecha</th>
                        <th className="p-2">RUT Proveedor</th>
                        <th className="p-2">Razón Social</th>
                        <th className="p-2 text-right text-amber-800">Exento</th>
                        <th className="p-2 text-right">Neto</th>
                        <th className="p-2 text-right">IVA</th>
                        <th className="p-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {libroCompras.documentos.map((doc, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2">{doc.tipoDte}</td>
                          <td className="p-2 font-bold">{doc.folio}</td>
                          <td className="p-2">{doc.fechaEmision}</td>
                          <td className="p-2">{doc.rutContraparte}</td>
                          <td className="p-2 truncate max-w-xs">{doc.razonSocialContraparte}</td>
                          <td className="p-2 text-right font-medium text-amber-700">{formatCLP(doc.montoExento || 0)}</td>
                          <td className="p-2 text-right">{formatCLP(doc.montoNeto)}</td>
                          <td className="p-2 text-right text-blue-700">{formatCLP(doc.montoIva)}</td>
                          <td className="p-2 text-right font-bold">{formatCLP(doc.montoTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Libro de Ventas */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-emerald-100 text-emerald-700 rounded-md">
                      <TrendingUp className="w-4 h-4" />
                    </span>
                    <h4 className="text-sm font-bold text-slate-800">Libro Auxiliar de Ventas</h4>
                    <span className="text-xs text-slate-500 font-mono">({libroVentas.totalDocumentos} documentos)</span>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-mono">
                    {libroVentas.totalExento > 0 && (
                      <div>Exento Facturado: <strong className="text-amber-800">{formatCLP(libroVentas.totalExento)}</strong></div>
                    )}
                    <div>Neto Facturado: <strong>{formatCLP(libroVentas.totalNeto)}</strong></div>
                    <div>IVA Débito: <strong className="text-emerald-700">{formatCLP(libroVentas.totalIvaDebito)}</strong></div>
                    <div>Total: <strong className="text-slate-900">{formatCLP(libroVentas.totalBruto)}</strong></div>
                  </div>
                </div>

                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg bg-white">
                  <table className="w-full text-left text-[11px] font-mono">
                    <thead className="bg-slate-100 text-slate-700 font-semibold border-b">
                      <tr>
                        <th className="p-2">Tipo</th>
                        <th className="p-2">Folio</th>
                        <th className="p-2">Fecha</th>
                        <th className="p-2">RUT Cliente</th>
                        <th className="p-2">Razón Social</th>
                        <th className="p-2 text-right text-amber-800">Exento</th>
                        <th className="p-2 text-right">Neto</th>
                        <th className="p-2 text-right">IVA Débito</th>
                        <th className="p-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {libroVentas.documentos.map((doc, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2">{doc.tipoDte}</td>
                          <td className="p-2 font-bold">{doc.folio}</td>
                          <td className="p-2">{doc.fechaEmision}</td>
                          <td className="p-2">{doc.rutContraparte}</td>
                          <td className="p-2 truncate max-w-xs">{doc.razonSocialContraparte}</td>
                          <td className="p-2 text-right font-medium text-amber-700">{formatCLP(doc.montoExento || 0)}</td>
                          <td className="p-2 text-right">{formatCLP(doc.montoNeto)}</td>
                          <td className="p-2 text-right text-emerald-700">{formatCLP(doc.montoIva)}</td>
                          <td className="p-2 text-right font-bold">{formatCLP(doc.montoTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Libro de Honorarios */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-indigo-100 text-indigo-700 rounded-md">
                      <FileText className="w-4 h-4" />
                    </span>
                    <h4 className="text-sm font-bold text-slate-800">Libro de Boletas de Honorarios (BHE)</h4>
                    <span className="text-xs text-slate-500 font-mono">({libroHonorarios.totalDocumentos} boletas)</span>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-mono">
                    <div>Bruto: <strong>{formatCLP(libroHonorarios.totalBruto)}</strong></div>
                    <div>Retención TGR (14.5%): <strong className="text-purple-700">{formatCLP(libroHonorarios.totalRetencion)}</strong></div>
                    <div>Líquido: <strong className="text-slate-900">{formatCLP(libroHonorarios.totalLiquido)}</strong></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================
              TAB 4: CENTRALIZACIÓN MENSUAL PARAMETRIZADA
             ========================================================= */}
          {activeTab === 'CENTRALIZACION' && (
            <div className="space-y-6">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <h3 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-blue-600" />
                  Parametrización de Cuentas para Asientos de Centralización
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  Define contra qué cuentas contables se centralizan las compras (Proveedores) y las ventas (Clientes).
                </p>

                {/* SELECTOR: MODO DE REGISTRO CONTABLE (RESUMEN VS DETALLADO) */}
                <div className="bg-white border-2 border-indigo-200/90 rounded-xl p-4 mb-5 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 block">
                          Modalidad de Registro en Libro Diario
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                          centralizationConfig.modoRegistroContable === 'DETALLADO_DOCUMENTO'
                            ? 'bg-indigo-100 text-indigo-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {centralizationConfig.modoRegistroContable === 'DETALLADO_DOCUMENTO'
                            ? 'Movimiento a Movimiento (DTE a DTE)'
                            : 'Asiento Resumen Global'}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 mt-1">
                        {centralizationConfig.modoRegistroContable === 'DETALLADO_DOCUMENTO'
                          ? 'Registro Movimiento a Movimiento (Individual por cada DTE del SII)'
                          : 'Asiento Global Resumen Mensual (Consolidado Período)'}
                      </h4>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        {centralizationConfig.modoRegistroContable === 'DETALLADO_DOCUMENTO'
                          ? 'Crea un asiento contable independiente por cada factura, nota de crédito o débito del SII con su RUT auxiliar, folio DTE, fecha de emisión y desglose neto/IVA.'
                          : 'Consolida todos los documentos del período en un único asiento mensual de compras o ventas (resumen reglamentario Art. 56 DL 825).'}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-lg border border-slate-200 shrink-0">
                      <button
                        type="button"
                        onClick={() => setCentralizationConfig(prev => ({ ...prev, modoRegistroContable: 'RESUMEN_GLOBAL' }))}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                          centralizationConfig.modoRegistroContable !== 'DETALLADO_DOCUMENTO'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Asiento Resumen Global
                      </button>
                      <button
                        type="button"
                        onClick={() => setCentralizationConfig(prev => ({ ...prev, modoRegistroContable: 'DETALLADO_DOCUMENTO' }))}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                          centralizationConfig.modoRegistroContable === 'DETALLADO_DOCUMENTO'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Movimiento a Movimiento
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      Cuenta Pasivo Compras (Proveedores):
                    </label>
                    <select
                      value={centralizationConfig.cuentaComprasPasivo.codigo}
                      onChange={(e) => {
                        const acc = ACCESSIBLE_ACCOUNTS.find(a => a.codigo === e.target.value);
                        if (acc) {
                          setCentralizationConfig({
                            ...centralizationConfig,
                            cuentaComprasPasivo: { codigo: acc.codigo, nombre: acc.nombre }
                          });
                        }
                      }}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono font-medium outline-none"
                    >
                      <option value="2.1.01">2.1.01 - Proveedores Nacionales</option>
                      <option value="2.1.02">2.1.02 - Cuentas por Pagar Comerciales</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      Cuenta Activo Ventas (Clientes):
                    </label>
                    <select
                      value={centralizationConfig.cuentaVentasActivo.codigo}
                      onChange={(e) => {
                        const acc = ACCESSIBLE_ACCOUNTS.find(a => a.codigo === e.target.value);
                        if (acc) {
                          setCentralizationConfig({
                            ...centralizationConfig,
                            cuentaVentasActivo: { codigo: acc.codigo, nombre: acc.nombre }
                          });
                        }
                      }}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono font-medium outline-none"
                    >
                      <option value="1.1.03">1.1.03 - Clientes Nacionales</option>
                      <option value="1.1.01">1.1.01 - Banco Santander Cta Cte (Contado)</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      Cuenta Ventas Exentas / Servicios:
                    </label>
                    <select
                      value={centralizationConfig.cuentaVentasExentasIngreso?.codigo || '4.1.02'}
                      onChange={(e) => {
                        const acc = ACCESSIBLE_ACCOUNTS.find(a => a.codigo === e.target.value);
                        if (acc) {
                          setCentralizationConfig({
                            ...centralizationConfig,
                            cuentaVentasExentasIngreso: { codigo: acc.codigo, nombre: acc.nombre }
                          });
                        }
                      }}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono font-medium outline-none"
                    >
                      <option value="4.1.02">4.1.02 - Ingresos por Servicios Exentos del Giro</option>
                      <option value="4.1.01">4.1.01 - Ingresos por Ventas del Giro (Afectas)</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      Cuenta Compras Exentas (Gasto Base):
                    </label>
                    <select
                      value={centralizationConfig.cuentaComprasExentasGasto?.codigo || '5.1.98'}
                      onChange={(e) => {
                        const acc = ACCESSIBLE_ACCOUNTS.find(a => a.codigo === e.target.value);
                        if (acc) {
                          setCentralizationConfig({
                            ...centralizationConfig,
                            cuentaComprasExentasGasto: { codigo: acc.codigo, nombre: acc.nombre }
                          });
                        }
                      }}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono font-medium outline-none"
                    >
                      <option value="5.1.98">5.1.98 - Gastos y Adquisiciones Exentas</option>
                      <option value="5.1.99">5.1.99 - Otros Gastos Generales de Adm.</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Botones de Generación de Centralizaciones */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Centralización Compras */}
                <div className="border border-slate-200 rounded-xl p-5 space-y-3 bg-white shadow-sm">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block"></span>
                      Centralización Libro de Compras
                    </h4>
                    <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[11px] font-bold">
                      {libroCompras.totalDocumentos} Facturas
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Genera el asiento cargando las cuentas de gasto/mercaderías imputadas (afectas y exentas) y el IVA Crédito Fiscal al <strong>DEBE</strong>, contra la cuenta <strong>{centralizationConfig.cuentaComprasPasivo.nombre} ({centralizationConfig.cuentaComprasPasivo.codigo})</strong> al <strong>HABER</strong>.
                  </p>
                  <div className="bg-slate-50 p-3 rounded-lg text-xs font-mono space-y-1.5 border border-slate-100">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Total Neto Afecto Compras:</span>
                      <strong className="text-slate-800">{formatCLP(libroCompras.totalNeto)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-amber-700">Total Compras Exentas:</span>
                      <strong className={libroCompras.totalExento > 0 ? "text-amber-700 font-bold" : "text-slate-400"}>
                        {formatCLP(libroCompras.totalExento)}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-700">Total IVA Crédito (1.1.08):</span>
                      <strong className="text-blue-700 font-bold">{formatCLP(libroCompras.totalIvaRecuperable)}</strong>
                    </div>
                    <div className="flex justify-between pt-1.5 border-t border-slate-200">
                      <span className="text-slate-900 font-semibold">Total a Proveedores ({centralizationConfig.cuentaComprasPasivo.codigo}):</span>
                      <strong className="text-slate-950 font-black">{formatCLP(libroCompras.totalBruto)}</strong>
                    </div>
                  </div>
                  <button
                    onClick={() => handleGenerateCentralization('COMPRA')}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>
                      {centralizationConfig.modoRegistroContable === 'DETALLADO_DOCUMENTO'
                        ? `Generar ${libroCompras.totalDocumentos} Asientos Detallados (Movimiento a Movimiento Compras)`
                        : `Generar Asiento Centralización Resumen Compras (${selectedPeriod})`}
                    </span>
                  </button>
                </div>

                {/* Centralización Ventas */}
                <div className="border border-slate-200 rounded-xl p-5 space-y-3 bg-white shadow-sm">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block"></span>
                      Centralización Libro de Ventas
                    </h4>
                    <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[11px] font-bold">
                      {libroVentas.totalDocumentos} Facturas
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Genera el asiento cargando la cuenta <strong>{centralizationConfig.cuentaVentasActivo.nombre} ({centralizationConfig.cuentaVentasActivo.codigo})</strong> al <strong>DEBE</strong>, contra Ventas del Giro (4.1.01), Servicios/Ventas Exentas ({centralizationConfig.cuentaVentasExentasIngreso?.codigo || '4.1.02'}) e IVA Débito Fiscal (2.1.04) al <strong>HABER</strong>.
                  </p>
                  <div className="bg-slate-50 p-3 rounded-lg text-xs font-mono space-y-1.5 border border-slate-100">
                    <div className="flex justify-between">
                      <span className="text-slate-900 font-semibold">Total Clientes ({centralizationConfig.cuentaVentasActivo.codigo}):</span>
                      <strong className="text-slate-950 font-black">{formatCLP(libroVentas.totalBruto)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Ventas Netas Afectas (4.1.01):</span>
                      <strong className="text-slate-800">{formatCLP(libroVentas.totalNeto)}</strong>
                    </div>
                    <div className="flex justify-between bg-amber-50/60 -mx-1 px-1 py-0.5 rounded">
                      <span className="text-amber-800 font-medium">Ventas / Servicios Exentos ({centralizationConfig.cuentaVentasExentasIngreso?.codigo || '4.1.02'}):</span>
                      <strong className={libroVentas.totalExento > 0 ? "text-amber-800 font-bold" : "text-slate-400"}>
                        {formatCLP(libroVentas.totalExento)}
                      </strong>
                    </div>
                    <div className="flex justify-between pt-1.5 border-t border-slate-200">
                      <span className="text-emerald-700">IVA Débito Fiscal (2.1.04):</span>
                      <strong className="text-emerald-700 font-bold">{formatCLP(libroVentas.totalIvaDebito)}</strong>
                    </div>
                  </div>
                  <button
                    onClick={() => handleGenerateCentralization('VENTA')}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-lg text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>
                      {centralizationConfig.modoRegistroContable === 'DETALLADO_DOCUMENTO'
                        ? `Generar ${libroVentas.totalDocumentos} Asientos Detallados (Movimiento a Movimiento Ventas)`
                        : `Generar Asiento Centralización Resumen Ventas (${selectedPeriod})`}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================
              TAB 5: COBROS & PAGOS A PARTIDAS SELECCIONADAS
             ========================================================= */}
          {activeTab === 'COBROS_PAGOS' && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-blue-600" />
                    Generación de Cobros y Pagos a Partidas Seleccionadas
                  </h3>
                  <p className="text-xs text-slate-500">
                    Selecciona las facturas a cancelar o cobrar. El agente genera automáticamente el comprobante contable (Caja/Banco) y actualiza el estado.
                  </p>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="font-semibold text-slate-700">Cuenta de Tesorería:</span>
                  <select
                    value={selectedBankAccountId}
                    onChange={(e) => setSelectedBankAccountId(e.target.value)}
                    className="bg-white border border-slate-300 rounded-lg p-1.5 font-mono text-xs outline-none"
                  >
                    <option value="1.1.01">1.1.01 - Banco Santander Cta Cte</option>
                    <option value="1.1.02">1.1.02 - Banco de Chile Cta Cte</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Pagos a Proveedores (Compras) */}
                <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-slate-800">Facturas de Compra Pendientes de Pago</h4>
                    <span className="text-xs text-slate-500 font-mono">
                      Seleccionadas: {selectedDtesForPayment.length}
                    </span>
                  </div>

                  <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 text-xs">
                    {dtes.filter(d => d.tipoOperacion === 'COMPRA' && d.estadoPago !== 'PAGADO').map((doc) => {
                      const isSelected = selectedDtesForPayment.includes(doc.id);
                      return (
                        <div
                          key={doc.id}
                          onClick={() => {
                            if (isSelected) setSelectedDtesForPayment(selectedDtesForPayment.filter(id => id !== doc.id));
                            else setSelectedDtesForPayment([...selectedDtesForPayment, doc.id]);
                          }}
                          className={`p-3 flex items-center justify-between cursor-pointer transition-colors ${
                            isSelected ? 'bg-blue-50/80 border-l-4 border-blue-600' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="rounded text-blue-600"
                            />
                            <div>
                              <div className="font-bold text-slate-800">F/ {doc.folio} - {doc.razonSocialContraparte}</div>
                              <div className="text-[11px] text-slate-500 font-mono">{doc.fechaEmision} | RUT {doc.rutContraparte}</div>
                            </div>
                          </div>
                          <div className="text-right font-mono font-bold text-slate-900">
                            {formatCLP(doc.montoTotal)}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <button
                    onClick={handleExecutePayment}
                    disabled={selectedDtesForPayment.length === 0}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-xs font-bold disabled:opacity-40 transition-all shadow-sm flex items-center justify-center gap-2"
                  >
                    <Landmark className="w-3.5 h-3.5" />
                    Generar Pago a Proveedores Seleccionados ({selectedDtesForPayment.length})
                  </button>
                </div>

                {/* Cobros a Clientes (Ventas) */}
                <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-slate-800">Facturas de Venta Pendientes de Cobro</h4>
                    <span className="text-xs text-slate-500 font-mono">
                      Seleccionadas: {selectedDtesForCollection.length}
                    </span>
                  </div>

                  <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 text-xs">
                    {dtes.filter(d => d.tipoOperacion === 'VENTA' && d.estadoPago !== 'COBRADO').map((doc) => {
                      const isSelected = selectedDtesForCollection.includes(doc.id);
                      return (
                        <div
                          key={doc.id}
                          onClick={() => {
                            if (isSelected) setSelectedDtesForCollection(selectedDtesForCollection.filter(id => id !== doc.id));
                            else setSelectedDtesForCollection([...selectedDtesForCollection, doc.id]);
                          }}
                          className={`p-3 flex items-center justify-between cursor-pointer transition-colors ${
                            isSelected ? 'bg-emerald-50/80 border-l-4 border-emerald-600' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="rounded text-emerald-600"
                            />
                            <div>
                              <div className="font-bold text-slate-800">F/ {doc.folio} - {doc.razonSocialContraparte}</div>
                              <div className="text-[11px] text-slate-500 font-mono">{doc.fechaEmision} | RUT {doc.rutContraparte}</div>
                            </div>
                          </div>
                          <div className="text-right font-mono font-bold text-emerald-800">
                            {formatCLP(doc.montoTotal)}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <button
                    onClick={handleExecuteCollection}
                    disabled={selectedDtesForCollection.length === 0}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-lg text-xs font-bold disabled:opacity-40 transition-all shadow-sm flex items-center justify-center gap-2"
                  >
                    <DollarSign className="w-3.5 h-3.5" />
                    Registrar Cobro de Clientes Seleccionados ({selectedDtesForCollection.length})
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================
              TAB 6: VISOR DE INSPECCIÓN FORENSE CHROMIUM (SII)
             ========================================================= */}
          {activeTab === 'VISOR_CHROMIUM' && (
            <div className="space-y-6">
              {/* Header card */}
              <div className="bg-slate-900 text-white p-5 rounded-xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Monitor className="w-5 h-5 text-indigo-400" />
                    <h3 className="text-sm font-bold">Visor de Navegación Chromium Headless en Vivo</h3>
                    <span className="bg-indigo-500/20 text-indigo-300 text-[11px] px-2 py-0.5 rounded font-mono border border-indigo-500/30">
                      Playwright Engine | zeusr.sii.cl
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">
                    Inspeccione las capturas de pantalla tomadas por el navegador Chromium en el servidor Cloud Linux mientras navega por el portal del SII.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCloseSiiSessions}
                    disabled={isClosingSessions}
                    title="Cierra sesiones huérfanas en zeusr.sii.cl para solucionar el error 01.01.112.500.720.27"
                    className="bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm disabled:opacity-50 transition-all whitespace-nowrap cursor-pointer"
                  >
                    <LogOut className={`w-3.5 h-3.5 ${isClosingSessions ? 'animate-spin' : ''}`} />
                    <span>{isClosingSessions ? 'Liberando...' : 'Liberar Sesiones SII'}</span>
                  </button>

                  <button
                    onClick={handleRunPlaywrightInspection}
                    disabled={isTestingPlaywright}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm transition-all whitespace-nowrap cursor-pointer"
                  >
                    {isTestingPlaywright ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-white" />
                        <span>Ejecutando Chromium...</span>
                      </>
                    ) : (
                      <>
                        <Camera className="w-4 h-4 text-indigo-200" />
                        <span>Lanzar Inspección y Tomar Capturas</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Contenido si NO hay capturas aún */}
              {liveScreenshots.length === 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center space-y-4">
                  <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto border border-indigo-200">
                    <Laptop className="w-8 h-8" />
                  </div>
                  <div className="max-w-xl mx-auto space-y-2">
                    <h4 className="font-bold text-slate-800 text-base">Aún no se han capturado pantallas de la sesión actual</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      El motor Chromium corre en un contenedor Linux en segundo plano (headless). Para verificar la interacción visual con el SII, presione el botón inferior para que el robot inicie el navegador, navegue a <strong>zeusr.sii.cl</strong>, complete el formulario de autenticación oficial y capture paso a paso lo que responde el servidor del SII.
                    </p>
                  </div>
                  <div className="pt-2">
                    <button
                      onClick={handleRunPlaywrightInspection}
                      disabled={isTestingPlaywright}
                      className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-xs font-bold inline-flex items-center gap-2 shadow-md transition-all cursor-pointer"
                    >
                      {isTestingPlaywright ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Conectando con el SII...</span>
                        </>
                      ) : (
                        <>
                          <Camera className="w-4 h-4" />
                          <span>Iniciar Chromium y Capturar Pantallas del SII</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Contenido si HAY capturas */}
              {liveScreenshots.length > 0 && (
                <div className="space-y-4">
                  {/* Selector de pasos */}
                  <div className="flex flex-wrap gap-2">
                    {liveScreenshots.map((shot, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedScreenshotIndex(idx)}
                        className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                          selectedScreenshotIndex === idx
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                        }`}
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>Paso {idx + 1}: {shot.step}</span>
                      </button>
                    ))}
                  </div>

                  {/* Detalle del paso seleccionado */}
                  {liveScreenshots[selectedScreenshotIndex] && (
                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-md space-y-3">
                      <div className="bg-slate-100 p-3 border-b border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-800">
                            Paso {selectedScreenshotIndex + 1}: {liveScreenshots[selectedScreenshotIndex].step}
                          </span>
                          <span className="text-slate-400">|</span>
                          <span className="text-slate-500 font-mono">
                            Hora: {formatTimestamp(liveScreenshots[selectedScreenshotIndex].timestamp)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5 text-slate-600 font-mono text-[11px] bg-white px-2.5 py-1 rounded border border-slate-200 max-w-md overflow-hidden text-ellipsis">
                            <ExternalLink className="w-3 h-3 flex-shrink-0 text-slate-400" />
                            <span className="truncate">{liveScreenshots[selectedScreenshotIndex].url}</span>
                          </div>
                          {normalizeImageData(liveScreenshots[selectedScreenshotIndex].imageBase64) && (
                            <a
                              href={normalizeImageData(liveScreenshots[selectedScreenshotIndex].imageBase64)}
                              download={`captura-sii-paso-${selectedScreenshotIndex + 1}-${liveScreenshots[selectedScreenshotIndex].step.replace(/[^a-zA-Z0-9]/g, '_')}.jpg`}
                              className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 rounded border border-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                              title="Descargar imagen completa"
                            >
                              <Download className="w-3 h-3 text-slate-500" />
                              <span>Descargar JPG</span>
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Imagen en grande con helper normalizeImageData */}
                      <div className="p-4 bg-slate-950 flex flex-col items-center justify-center overflow-auto min-h-[380px] max-h-[580px]">
                        {normalizeImageData(liveScreenshots[selectedScreenshotIndex].imageBase64) ? (
                          <img
                            src={normalizeImageData(liveScreenshots[selectedScreenshotIndex].imageBase64)}
                            alt={`Captura ${liveScreenshots[selectedScreenshotIndex].step}`}
                            className="max-w-full max-h-[540px] rounded border border-slate-700 shadow-xl object-contain"
                          />
                        ) : (
                          <div className="text-slate-400 text-xs text-center p-8 space-y-2">
                            <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
                            <p>No se pudo generar la imagen de este paso. Consulte la pestaña de Logs.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Resumen de logs al pie del visor */}
                  {syncLogs.length > 0 && (
                    <div className="bg-slate-900 text-slate-200 rounded-xl p-3 border border-slate-800 text-xs font-mono">
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
                        <div className="flex items-center gap-2">
                          <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                          <span className="font-bold text-slate-300">Bitácora en Tiempo Real ({syncLogs.length} eventos)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleCopyLogs}
                            className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                          >
                            <Copy className="w-3 h-3" />
                            <span>{copiedLogs ? 'Copiado' : 'Copiar'}</span>
                          </button>
                          <button
                            onClick={() => setActiveTab('TERMINAL_LOGS')}
                            className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer underline"
                          >
                            Ver consola completa &rarr;
                          </button>
                        </div>
                      </div>
                      <div className="max-h-36 overflow-y-auto space-y-1 text-[11px] text-slate-300">
                        {syncLogs.slice(-6).map((log, lIdx) => (
                          <div key={lIdx} className="truncate">
                            <span className="text-slate-500 mr-1.5">{lIdx + 1}.</span>
                            {log}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* =========================================================
              TAB 7: TERMINAL Y LOGS DE AUTOMATIZACIÓN SII
             ========================================================= */}
          {activeTab === 'TERMINAL_LOGS' && (
            <div className="p-6 space-y-4">
              {/* Header de la Terminal */}
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 bg-slate-900 text-white p-4 rounded-xl shadow-md border border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
                    <Terminal className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                      Consola de Automatización & Logs Oficiales SII
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-950 text-emerald-400 border border-emerald-800">
                        {isTestingPlaywright || isSyncingSii ? 'Ejecutando...' : 'En línea'}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Rastreo detallado de cada solicitud HTTP, inicio de sesión en zeusr.sii.cl, intercepción de cookies y descargas CSV.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={handleCopyLogs}
                    disabled={syncLogs.length === 0}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copiedLogs ? '¡Copiado!' : 'Copiar Logs'}</span>
                  </button>

                  <button
                    onClick={handleDownloadLogs}
                    disabled={syncLogs.length === 0}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Descargar .txt</span>
                  </button>

                  <button
                    onClick={() => {
                      setSyncLogs([]);
                      showToast('Consola de logs limpiada');
                    }}
                    disabled={syncLogs.length === 0}
                    className="px-3 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 disabled:opacity-40 text-rose-300 text-xs font-semibold flex items-center gap-1.5 border border-rose-800/60 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Limpiar</span>
                  </button>
                </div>
              </div>

              {/* Barra de Filtros y Búsqueda */}
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm text-xs">
                {/* Búsqueda de texto */}
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={logSearchQuery}
                    onChange={(e) => setLogSearchQuery(e.target.value)}
                    placeholder="Buscar en logs (ej: Error, 2026-08, zeusr, Token, Captura)..."
                    className="w-full pl-9 pr-8 py-1.5 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                  {logSearchQuery && (
                    <button
                      onClick={() => setLogSearchQuery('')}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Filtros rápidos */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-slate-400 font-medium text-[11px] flex items-center gap-1 mr-1">
                    <Filter className="w-3 h-3" /> Filtrar:
                  </span>
                  {[
                    { id: 'ALL', label: 'Todos' },
                    { id: 'ERROR', label: 'Errores/Alertas' },
                    { id: 'PLAYWRIGHT', label: 'Playwright/RPA' },
                    { id: 'INTERCEPTOR', label: 'API/Cookies' },
                    { id: 'DIAGNOSTIC', label: 'Capturas' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setLogFilter(f.id as any)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                        logFilter === f.id
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Contenedor Principal de la Terminal */}
              <div className="bg-slate-950 text-slate-200 rounded-xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col font-mono text-xs">
                {/* Barra de título estilo ventana de terminal */}
                <div className="bg-slate-900/90 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between select-none">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block"></span>
                    <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block"></span>
                    <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block"></span>
                    <span className="ml-2 text-[11px] text-slate-400 font-semibold">
                      sii-playwright-sandbox: /var/log/rpa-engine.log
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-slate-400">
                    <span>Líneas: <strong>{syncLogs.length}</strong></span>
                    {logSearchQuery && (
                      <span className="text-indigo-400">
                        Filtrado por: "{logSearchQuery}"
                      </span>
                    )}
                  </div>
                </div>

                {/* Salida de la consola */}
                <div className="p-4 overflow-y-auto max-h-[520px] min-h-[300px] space-y-1.5 scrollbar-thin scrollbar-thumb-slate-700">
                  {syncLogs.length === 0 ? (
                    <div className="text-center py-16 space-y-3">
                      <Terminal className="w-10 h-10 text-slate-600 mx-auto" />
                      <p className="text-slate-400 text-sm font-sans font-medium">
                        La consola está vacía. No se ha ejecutado ninguna operación en esta sesión.
                      </p>
                      <p className="text-slate-500 text-xs max-w-md mx-auto font-sans leading-relaxed">
                        Inicie una inspección con Chromium o una descarga RCV para ver la bitácora paso a paso de lo que ocurre con zeusr.sii.cl.
                      </p>
                      <div className="pt-2 flex justify-center gap-3">
                        <button
                          onClick={handleRunPlaywrightInspection}
                          disabled={isTestingPlaywright}
                          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-sans font-bold flex items-center gap-2 cursor-pointer shadow-md"
                        >
                          <Camera className="w-4 h-4" />
                          <span>Iniciar Inspección de Chromium</span>
                        </button>
                        <button
                          onClick={() => handleRunSiiAutoDownload(selectedPeriod)}
                          disabled={isSyncingSii}
                          className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-sans font-bold flex items-center gap-2 cursor-pointer shadow-md"
                        >
                          <RefreshCw className="w-4 h-4" />
                          <span>Descargar RCV Período {selectedPeriod}</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    (() => {
                      const filtered = syncLogs.filter((log) => {
                        // Filtro de búsqueda de texto
                        if (logSearchQuery && !log.toLowerCase().includes(logSearchQuery.toLowerCase())) {
                          return false;
                        }
                        // Filtro por categoría
                        if (logFilter === 'ERROR') {
                          return /error|alerta|fallo|bloque|rechaz|incorrect/i.test(log);
                        }
                        if (logFilter === 'PLAYWRIGHT') {
                          return /playwright|chromium|zeusr|rpa/i.test(log);
                        }
                        if (logFilter === 'INTERCEPTOR') {
                          return /interceptor|cookie|token|csv|aut2000/i.test(log);
                        }
                        if (logFilter === 'DIAGNOSTIC') {
                          return /captura|pantalla|step|paso/i.test(log);
                        }
                        return true;
                      });

                      if (filtered.length === 0) {
                        return (
                          <div className="text-center py-10 text-slate-500 text-xs">
                            No se encontraron logs que coincidan con los criterios de búsqueda actuales.
                          </div>
                        );
                      }

                      return filtered.map((line, idx) => {
                        const isError = /error|alerta|fallo|bloque|01\.01\./i.test(line);
                        const isPlaywright = /\[Playwright|\[RPA/i.test(line);
                        const isInterceptor = /interceptor|token|cookie|rcv/i.test(line);
                        const isCapture = /captura/i.test(line);
                        const isSession = /sesion|sesiones/i.test(line);

                        let colorClass = 'text-slate-300';
                        let bgClass = 'hover:bg-slate-900/60';

                        if (isError) {
                          colorClass = 'text-rose-400 font-semibold';
                          bgClass = 'bg-rose-950/20 hover:bg-rose-950/40 border-l-2 border-rose-500 pl-2';
                        } else if (isCapture) {
                          colorClass = 'text-emerald-400';
                          bgClass = 'hover:bg-slate-900/60';
                        } else if (isInterceptor) {
                          colorClass = 'text-purple-300';
                          bgClass = 'hover:bg-slate-900/60';
                        } else if (isSession) {
                          colorClass = 'text-amber-300';
                          bgClass = 'hover:bg-slate-900/60';
                        } else if (isPlaywright) {
                          colorClass = 'text-cyan-300';
                          bgClass = 'hover:bg-slate-900/60';
                        }

                        return (
                          <div
                            key={idx}
                            className={`py-0.5 px-1.5 rounded transition-colors flex items-start gap-2 text-[11px] leading-relaxed break-all ${bgClass}`}
                          >
                            <span className="text-slate-600 select-none min-w-[2.5rem] text-right font-mono text-[10px]">
                              {idx + 1}
                            </span>
                            <span className={colorClass}>{line}</span>
                          </div>
                        );
                      });
                    })()
                  )}
                </div>

                {/* Pie de terminal con acciones rápidas */}
                <div className="bg-slate-900 px-4 py-2.5 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-400">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>Modo diagnóstico activo. Registrando cada interacción con zeusr.sii.cl</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleCloseSiiSessions}
                      disabled={isClosingSessions}
                      className="text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer underline"
                    >
                      <LogOut className="w-3 h-3" />
                      <span>Cerrar sesiones huérfanas en SII</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* =========================================================
          MODAL DE DESGLOSE / SPLIT DE FACTURA EN VARIAS PARTIDAS
         ========================================================= */}
      {splitModalDte && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Split className="w-5 h-5 text-purple-400" />
                <h3 className="font-bold text-sm">
                  Desglosar Factura en Varias Partidas (Split de Comprobante)
                </h3>
              </div>
              <button
                onClick={() => setSplitModalDte(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-slate-50 border-b border-slate-200 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-slate-500">Documento:</span>{' '}
                  <strong className="text-slate-800">Factura N° {splitModalDte.folio}</strong> ({splitModalDte.razonSocialContraparte})
                </div>
                <div className="font-mono">
                  Monto Neto a Desglosar: <strong className="text-blue-700 text-sm">{formatCLP(splitModalDte.montoNeto)}</strong>
                </div>
              </div>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              <div className="space-y-3">
                {splitPartidas.map((partida, index) => (
                  <div key={partida.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">Partida #{index + 1}</span>
                      {splitPartidas.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setSplitPartidas(splitPartidas.filter(p => p.id !== partida.id))}
                          className="text-rose-500 hover:text-rose-700 text-xs flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Eliminar
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      <div>
                        <label className="block text-slate-600 mb-1 font-medium">Cuenta Contable:</label>
                        <select
                          value={partida.cuentaCodigo}
                          onChange={(e) => {
                            const acc = ACCESSIBLE_ACCOUNTS.find(a => a.codigo === e.target.value);
                            if (acc) {
                              setSplitPartidas(splitPartidas.map(p => p.id === partida.id ? {
                                ...p,
                                cuentaCodigo: acc.codigo,
                                cuentaNombre: acc.nombre
                              } : p));
                            }
                          }}
                          className="w-full bg-white border border-slate-300 rounded-lg p-1.5 font-mono text-xs outline-none"
                        >
                          {ACCESSIBLE_ACCOUNTS.map(acc => (
                            <option key={acc.codigo} value={acc.codigo}>
                              {acc.codigo} - {acc.nombre}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-600 mb-1 font-medium">Centro de Costo:</label>
                        <select
                          value={partida.centroCostoCodigo || ''}
                          onChange={(e) => {
                            const found = availableCostCenters.find(c => c.codigo === e.target.value);
                            setSplitPartidas(splitPartidas.map(p => p.id === partida.id ? {
                              ...p,
                              centroCostoId: found?.id,
                              centroCostoCodigo: found?.codigo,
                              centroCostoNombre: found?.nombre,
                            } : p));
                          }}
                          className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs outline-none font-medium text-slate-800"
                        >
                          <option value="">-- Sin Centro de Costos --</option>
                          {availableCostCenters.map(cc => (
                            <option key={cc.id} value={cc.codigo}>
                              {cc.codigo} - {cc.nombre}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-600 mb-1 font-medium">Monto Neto ($ CLP):</label>
                        <input
                          type="number"
                          value={partida.montoNeto}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setSplitPartidas(splitPartidas.map(p => p.id === partida.id ? {
                              ...p,
                              montoNeto: val
                            } : p));
                          }}
                          className="w-full bg-white border border-slate-300 rounded-lg p-1.5 font-mono text-xs text-right font-bold outline-none"
                        />
                      </div>

                      <div className="md:col-span-3">
                        <label className="block text-slate-600 mb-1 font-medium">Concepto / Glosa de la Partida:</label>
                        <input
                          type="text"
                          value={partida.concepto}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSplitPartidas(splitPartidas.map(p => p.id === partida.id ? {
                              ...p,
                              concepto: val
                            } : p));
                          }}
                          placeholder="Ej: Fletes de despacho o Insumos de bodega"
                          className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs outline-none"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleAddSplitItem}
                className="w-full py-2 border border-dashed border-slate-300 hover:border-purple-500 rounded-lg text-xs font-semibold text-purple-700 bg-purple-50/50 flex items-center justify-center gap-1.5 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Agregar Otra Partida al Desglose
              </button>

              {/* Validación de Cuadratura en Vivo */}
              {(() => {
                const val = validateDteSplit(splitModalDte, splitPartidas);
                return (
                  <div className={`p-3 rounded-lg text-xs font-mono flex items-center justify-between border ${
                    val.valido ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
                  }`}>
                    <div className="flex items-center gap-2">
                      {val.valido ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-rose-600" />}
                      <span>{val.mensaje}</span>
                    </div>
                    <div>
                      Suma: <strong>{formatCLP(val.sumaPartidas)}</strong> / <strong>{formatCLP(splitModalDte.montoNeto)}</strong>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setSplitModalDte(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveSplit}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                Confirmar y Guardar Desglose
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
