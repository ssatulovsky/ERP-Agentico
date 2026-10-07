import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Camera,
  Upload,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  FileText,
  ArrowRight,
  ShieldCheck,
  DollarSign,
  Building2,
  User,
  ChevronRight,
  Sparkles,
  X,
  Plus,
  Calendar,
  Clock,
  Receipt,
  Smartphone,
  ArrowLeft,
  Send,
  Check,
  AlertCircle,
  Eye,
  Info,
  Layers,
  Tag,
  Briefcase,
  HelpCircle,
  Maximize2,
  Minimize2,
  FileDown,
  MessageCircle,
  Mail,
  Download,
  Share2,
} from 'lucide-react';
import {
  ExpenseReport,
  ExpenseItem,
  ExpenseProject,
  CostCenterMaster,
  ScannedReceiptResult,
  ExpenseCategory,
  ExpenseDocumentType,
} from '../../../types';
import { expenseApiService } from '../../../services/expenseApiService';
import { formatCLP } from '../../../utils/expenseManagementAgent';
import {
  downloadAndShareExpenseReportPDF,
  getWhatsAppExpenseShareUrl,
  getEmailExpenseShareUrl,
} from '../../../utils/expensePdfGenerator';

interface CollaboratorExpenseMobileAppProps {
  empresaRut?: string;
  empresaNombre?: string;
  costCenters: CostCenterMaster[];
  onExitMobileView?: () => void;
  initialReportId?: string;
}

export const CollaboratorExpenseMobileApp: React.FC<CollaboratorExpenseMobileAppProps> = ({
  empresaRut = 'client-retail-01',
  empresaNombre = 'Mar Austral Alimentos SpA',
  costCenters = [],
  onExitMobileView,
  initialReportId,
}) => {
  // Colaboradores estándar disponibles en la empresa
  const availableCollaborators = [
    {
      id: 'emp-001',
      nombre: 'Gonzalo Silva Valenzuela',
      rut: '14.238.192-8',
      cargo: 'Supervisor Comercial & Operaciones',
      email: 'gonzalo.silva@maraustral.cl',
      centroCostoDefault: 'cc-02',
    },
    {
      id: 'emp-002',
      nombre: 'Ing. Rodrigo Cárdenas Soto',
      rut: '13.914.882-K',
      cargo: 'Jefe de Planta Quellón',
      email: 'rodrigo.cardenas@maraustral.cl',
      centroCostoDefault: 'cc-03',
    },
    {
      id: 'emp-003',
      nombre: 'Marcelo Gallardo Troncoso',
      rut: '15.820.119-3',
      cargo: 'Jefe de Terreno & Logística',
      email: 'marcelo.gallardo@maraustral.cl',
      centroCostoDefault: 'cc-04',
    },
  ];

  const [activeCollaborator, setActiveCollaborator] = useState(availableCollaborators[0]);
  const [reports, setReports] = useState<ExpenseReport[]>([]);
  const [projects, setProjects] = useState<ExpenseProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeReportId, setActiveReportId] = useState<string | null>(initialReportId || null);

  // Pestañas móviles: 'CAMARA' | 'MI_RENDICION' | 'HISTORIAL'
  const [mobileTab, setMobileTab] = useState<'CAMARA' | 'MI_RENDICION' | 'HISTORIAL'>('CAMARA');

  // Estado de Captura y Análisis de IA
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStepMessage, setScanStepMessage] = useState('');
  const [aiScannedResult, setAiScannedResult] = useState<ScannedReceiptResult | null>(null);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modo simulador de marco telefónico en Desktop
  const [isPhoneFrameMode, setIsPhoneFrameMode] = useState(true);

  // Formulario editable del comprobante tras escaneo
  const [editedComprobante, setEditedComprobante] = useState<{
    tipoDocumento: ExpenseDocumentType;
    proveedorRut: string;
    proveedorRazonSocial: string;
    folioDocumento: string;
    fecha: string;
    montoTotalClp: number;
    montoNeto: number;
    montoIva: number;
    montoExento: number;
    categoria: ExpenseCategory;
    descripcionGlosa: string;
    centroCostoId: string;
    proyectoId: string;
    cuentaContableCodigo: string;
    cuentaContableNombre: string;
    esGastoRechazadoArt21: boolean;
  }>({
    tipoDocumento: 'BOLETA_ELECTRONICA',
    proveedorRut: '',
    proveedorRazonSocial: '',
    folioDocumento: '',
    fecha: new Date().toISOString().substring(0, 10),
    montoTotalClp: 0,
    montoNeto: 0,
    montoIva: 0,
    montoExento: 0,
    categoria: 'ALIMENTACION',
    descripcionGlosa: '',
    centroCostoId: 'cc-02',
    proyectoId: '',
    cuentaContableCodigo: '4.2.01.006',
    cuentaContableNombre: 'Gastos de Alimentación & Viáticos',
    esGastoRechazadoArt21: false,
  });

  const fileInputCameraRef = useRef<HTMLInputElement>(null);
  const fileInputGalleryRef = useRef<HTMLInputElement>(null);

  // Carga de rendiciones desde MySQL 8.0 / Ledger en disco
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [fetchedReports, fetchedProjects] = await Promise.all([
        expenseApiService.getExpenseReports(empresaRut),
        expenseApiService.getExpenseProjects(empresaRut),
      ]);
      setReports(fetchedReports);
      setProjects(fetchedProjects);

      // Si no hay reporte activo seleccionado, asignar el primero abierto o en borrador
      if (!activeReportId && fetchedReports.length > 0) {
        const collabReport = fetchedReports.find(
          (r) => r.rendidorRut === activeCollaborator.rut && r.estado !== 'CONTABILIZADA_PAGADA'
        ) || fetchedReports[0];
        setActiveReportId(collabReport.id);
      }
    } catch (e) {
      console.error('[MobileApp] Error al cargar rendiciones:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [empresaRut, activeCollaborator.rut]);

  // Rendición seleccionada por el colaborador
  const activeReport = useMemo(() => {
    return reports.find((r) => r.id === activeReportId) || reports[0] || null;
  }, [reports, activeReportId]);

  // Comprobantes de la rendición activa
  const activeReportComprobantes = useMemo(() => {
    return activeReport?.comprobantes || [];
  }, [activeReport]);

  // Totales de la rendición
  const reportTotals = useMemo(() => {
    if (!activeReport) return { fondo: 0, rendido: 0, saldoReembolso: 0, saldoReintegro: 0 };
    const totalRendido = activeReportComprobantes.reduce((acc, c) => acc + (Number(c.montoTotalClp) || 0), 0);
    const fondo = activeReport.fondoAsignadoClp || 0;
    const saldoReembolso = Math.max(0, totalRendido - fondo);
    const saldoReintegro = Math.max(0, fondo - totalRendido);
    return { fondo, rendido: totalRendido, saldoReembolso, saldoReintegro };
  }, [activeReport, activeReportComprobantes]);

  // Estado para generación de PDF formal
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfShareModal, setPdfShareModal] = useState<{
    isOpen: boolean;
    filename: string;
    whatsappUrl: string;
    emailUrl: string;
  } | null>(null);

  // Generación y descarga de documento formal de rendición (jsPDF + auditoría)
  const handleDownloadPDF = async () => {
    if (!activeReport) {
      setSubmissionError('No hay rendición activa seleccionada para generar el PDF.');
      return;
    }
    setIsGeneratingPdf(true);
    setSubmissionError(null);
    try {
      const res = await downloadAndShareExpenseReportPDF({
        empresaNombre,
        empresaRut,
        report: activeReport,
        comprobantes: activeReportComprobantes,
        collaboratorInfo: {
          nombre: activeCollaborator.nombre,
          rut: activeCollaborator.rut,
          cargo: activeCollaborator.cargo,
          email: activeCollaborator.email,
        },
      });

      const waUrl = getWhatsAppExpenseShareUrl(
        activeReport,
        empresaNombre,
        reportTotals.rendido,
        reportTotals.saldoReembolso
      );
      const mailUrl = getEmailExpenseShareUrl(
        activeReport,
        empresaNombre,
        reportTotals.rendido,
        reportTotals.saldoReembolso
      );

      setPdfShareModal({
        isOpen: true,
        filename: res.filename,
        whatsappUrl: waUrl,
        emailUrl: mailUrl,
      });
    } catch (err: any) {
      console.error('[MobileApp] Error al generar documento PDF formal:', err);
      setSubmissionError('Ocurrió un inconveniente al generar el PDF de rendición. Intente nuevamente.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Procesamiento de imagen seleccionada con IA
  const handleProcessImage = async (file: File) => {
    setIsScanning(true);
    setSubmissionSuccess(false);
    setSubmissionError(null);
    setScanStepMessage('Comprimiendo y preparando comprobante...');

    try {
      // 1. Convertir a Base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64String = reader.result as string;
        setPreviewImage(base64String);

        setScanStepMessage('Enviando a Agente Vision (Gemini 3.8 Flash)...');
        await new Promise((r) => setTimeout(r, 400));

        setScanStepMessage('Extrayendo RUT, Folio, Neto e IVA Crédito Fiscal...');
        
        // 2. Invocar endpoint inteligente
        const aiResponse = await expenseApiService.scanReceiptWithAI(
          base64String,
          file.type || 'image/jpeg',
          file.name,
          empresaRut
        );

        if (aiResponse.success && aiResponse.data) {
          const data = aiResponse.data;
          setAiScannedResult(data);

          // Rellenar formulario editable
          setEditedComprobante({
            tipoDocumento: data.tipoDocumento || 'BOLETA_ELECTRONICA',
            proveedorRut: data.proveedorRut || '',
            proveedorRazonSocial: data.proveedorRazonSocial || 'Comercio Local',
            folioDocumento: data.folioDocumento || `B-${Math.floor(100000 + Math.random() * 899999)}`,
            fecha: data.fecha || new Date().toISOString().substring(0, 10),
            montoTotalClp: data.montoTotalClp || 0,
            montoNeto: data.montoNeto || Math.round((data.montoTotalClp || 0) / 1.19),
            montoIva: data.montoIva || ((data.montoTotalClp || 0) - Math.round((data.montoTotalClp || 0) / 1.19)),
            montoExento: data.montoExento || 0,
            categoria: data.categoria || 'ALIMENTACION',
            descripcionGlosa: data.descripcionGlosa || 'Gasto operacional en terreno',
            centroCostoId: activeReport?.centroCostoId || activeCollaborator.centroCostoDefault,
            proyectoId: activeReport?.proyectoId || (projects[0]?.id || ''),
            cuentaContableCodigo: data.cuentaContableCodigo || '4.2.01.006',
            cuentaContableNombre: data.cuentaContableNombre || 'Gastos Operacionales',
            esGastoRechazadoArt21: Boolean(data.esGastoRechazadoArt21),
          });
        } else {
          throw new Error(aiResponse.error || 'No se pudo extraer la información del comprobante.');
        }
        setIsScanning(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error('[MobileApp] Error al escanear comprobante:', err);
      setIsScanning(false);
      setSubmissionError(err.message || 'Error al procesar la foto con el Agente de IA.');
    }
  };

  // Manejo de input de archivos
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleProcessImage(file);
    }
  };

  // Cargar una foto de prueba predefinida para demostración rápida en navegador
  const handleLoadDemoReceipt = (demoType: 'COMBUSTIBLE' | 'HOTEL' | 'RESTAURANTE') => {
    setIsScanning(true);
    setSubmissionSuccess(false);
    setScanStepMessage('Cargando comprobante de prueba...');

    setTimeout(() => {
      let demoData: ScannedReceiptResult;
      let demoPreview = '';

      if (demoType === 'COMBUSTIBLE') {
        demoData = {
          tipoDocumento: 'BOLETA_ELECTRONICA',
          proveedorRut: '99.520.000-7',
          proveedorRazonSocial: 'Compañía de Petróleos de Chile COPEC S.A.',
          folioDocumento: `B-${Math.floor(400000 + Math.random() * 99999)}`,
          fecha: new Date().toISOString().substring(0, 10),
          montoTotalClp: 45000,
          montoNeto: 37815,
          montoIva: 7185,
          montoExento: 0,
          categoria: 'COMBUSTIBLE',
          descripcionGlosa: 'Carga de Diesel camioneta terreno Dalcahue',
          cuentaContableCodigo: '4.2.01.009',
          cuentaContableNombre: 'Combustibles & Lubricantes',
          esGastoRechazadoArt21: false,
          diagnosticoAgente: 'Comprobante emitido con RUT emisor válido. Imputable a CC Ventas y Distribución.',
          confianzaScore: 97,
        };
        demoPreview = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"><rect width="300" height="200" fill="%23f1f5f9"/><text x="150" y="70" font-family="monospace" font-size="16" font-weight="bold" fill="%230f172a" text-anchor="middle">COPEC S.A.</text><text x="150" y="100" font-family="monospace" font-size="12" fill="%23475569" text-anchor="middle">RUT: 99.520.000-7</text><text x="150" y="140" font-family="monospace" font-size="20" font-weight="black" fill="%23047857" text-anchor="middle">$45.000 CLP</text></svg>';
      } else if (demoType === 'HOTEL') {
        demoData = {
          tipoDocumento: 'FACTURA_ELECTRONICA_33',
          proveedorRut: '76.128.490-2',
          proveedorRazonSocial: 'Hotel & Cabañas del Sur SpA (Castro)',
          folioDocumento: `F-${Math.floor(80000 + Math.random() * 19999)}`,
          fecha: new Date().toISOString().substring(0, 10),
          montoTotalClp: 89250,
          montoNeto: 75000,
          montoIva: 14250,
          montoExento: 0,
          categoria: 'ALOJAMIENTO',
          descripcionGlosa: 'Alojamiento 1 noche comisión técnica terreno',
          cuentaContableCodigo: '4.2.01.007',
          cuentaContableNombre: 'Alojamiento & Estadía Terreno',
          esGastoRechazadoArt21: false,
          diagnosticoAgente: 'Factura 33 con IVA Crédito Fiscal 100% recuperable ($14.250 CLP). Art. 31 LIR conforme.',
          confianzaScore: 99,
        };
        demoPreview = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"><rect width="300" height="200" fill="%23f8fafc"/><text x="150" y="60" font-family="sans-serif" font-size="16" font-weight="bold" fill="%231e293b" text-anchor="middle">HOTEL CASTRO</text><text x="150" y="90" font-family="sans-serif" font-size="12" fill="%2364748b" text-anchor="middle">FACTURA ELECTRONICA 33</text><text x="150" y="140" font-family="sans-serif" font-size="20" font-weight="black" fill="%232563eb" text-anchor="middle">$89.250 CLP</text></svg>';
      } else {
        demoData = {
          tipoDocumento: 'BOLETA_ELECTRONICA',
          proveedorRut: '77.819.200-5',
          proveedorRazonSocial: 'Restaurante Sabor Chilote SpA',
          folioDocumento: `B-${Math.floor(10000 + Math.random() * 89999)}`,
          fecha: new Date().toISOString().substring(0, 10),
          montoTotalClp: 24500,
          montoNeto: 20588,
          montoIva: 3912,
          montoExento: 0,
          categoria: 'ALIMENTACION',
          descripcionGlosa: 'Almuerzo en terreno durante supervisión de jaulas',
          cuentaContableCodigo: '4.2.01.006',
          cuentaContableNombre: 'Gastos de Alimentación & Viáticos',
          esGastoRechazadoArt21: false,
          diagnosticoAgente: 'Boleta fidedigna dentro de los rangos autorizados de viático por día.',
          confianzaScore: 94,
        };
        demoPreview = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"><rect width="300" height="200" fill="%23fffbeb"/><text x="150" y="60" font-family="sans-serif" font-size="16" font-weight="bold" fill="%2392400e" text-anchor="middle">RINCON CHILOTE</text><text x="150" y="90" font-family="sans-serif" font-size="12" fill="%23b45309" text-anchor="middle">ALIMENTACION VIATICO</text><text x="150" y="140" font-family="sans-serif" font-size="20" font-weight="black" fill="%23b45309" text-anchor="middle">$24.500 CLP</text></svg>';
      }

      setPreviewImage(demoPreview);
      setAiScannedResult(demoData);
      setEditedComprobante({
        tipoDocumento: demoData.tipoDocumento,
        proveedorRut: demoData.proveedorRut,
        proveedorRazonSocial: demoData.proveedorRazonSocial,
        folioDocumento: demoData.folioDocumento,
        fecha: demoData.fecha,
        montoTotalClp: demoData.montoTotalClp,
        montoNeto: demoData.montoNeto,
        montoIva: demoData.montoIva,
        montoExento: demoData.montoExento,
        categoria: demoData.categoria,
        descripcionGlosa: demoData.descripcionGlosa,
        centroCostoId: activeReport?.centroCostoId || activeCollaborator.centroCostoDefault,
        proyectoId: activeReport?.proyectoId || (projects[0]?.id || ''),
        cuentaContableCodigo: demoData.cuentaContableCodigo,
        cuentaContableNombre: demoData.cuentaContableNombre,
        esGastoRechazadoArt21: demoData.esGastoRechazadoArt21,
      });
      setIsScanning(false);
    }, 600);
  };

  // Enviar comprobante al servidor para que el agente de rendición de gastos lo registre
  const handleSubmitReceiptToServer = async () => {
    if (!activeReport) {
      setSubmissionError('Debes seleccionar o tener una rendición activa para registrar el comprobante.');
      return;
    }

    setIsSubmitting(true);
    setSubmissionError(null);

    try {
      const selectedCc = costCenters.find((c) => c.id === editedComprobante.centroCostoId);
      const selectedPry = projects.find((p) => p.id === editedComprobante.proyectoId);

      const newItem = {
        expenseReportId: activeReport.id,
        empresaId: empresaRut,
        fecha: editedComprobante.fecha,
        tipoDocumento: editedComprobante.tipoDocumento,
        folioDocumento: editedComprobante.folioDocumento,
        proveedorRut: editedComprobante.proveedorRut,
        proveedorRazonSocial: editedComprobante.proveedorRazonSocial,
        categoria: editedComprobante.categoria,
        descripcionGlosa: editedComprobante.descripcionGlosa,
        montoNeto: editedComprobante.montoNeto,
        montoIva: editedComprobante.montoIva,
        montoExento: editedComprobante.montoExento,
        montoTotalClp: editedComprobante.montoTotalClp,
        monedaOriginal: 'CLP' as const,
        tipoCambio: 1,
        centroCostoId: editedComprobante.centroCostoId,
        centroCostoCodigo: selectedCc?.codigo || activeReport.centroCostoCodigo,
        proyectoId: editedComprobante.proyectoId,
        proyectoCodigo: selectedPry?.codigo || activeReport.proyectoCodigo,
        cuentaContableCodigo: editedComprobante.cuentaContableCodigo,
        cuentaContableNombre: editedComprobante.cuentaContableNombre,
        comprobanteArchivoNombre: `${editedComprobante.tipoDocumento}_${editedComprobante.folioDocumento}.jpg`,
        comprobantePreviewBase64: previewImage || undefined,
        esGastoRechazadoArt21: editedComprobante.esGastoRechazadoArt21,
        validadoPorAgente: true,
        observacionAgente: aiScannedResult?.diagnosticoAgente || 'Registrado desde Rinde Móvil AI.',
      };

      const result = await expenseApiService.addExpenseItem(activeReport.id, newItem);

      if (result) {
        setSubmissionSuccess(true);
        // Limpiar estado de captura
        setPreviewImage(null);
        setAiScannedResult(null);

        // Recargar rendiciones para reflejar nuevos totales
        await loadData();

        // Tras 2 segundos, cambiar a la vista de comprobantes
        setTimeout(() => {
          setSubmissionSuccess(false);
          setMobileTab('MI_RENDICION');
        }, 1800);
      } else {
        throw new Error('El servidor no devolvió confirmación del comprobante.');
      }
    } catch (err: any) {
      console.error('[MobileApp] Error al enviar comprobante:', err);
      setSubmissionError(err.message || 'Error al persistir el comprobante en MySQL.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`min-h-screen bg-slate-950 flex flex-col items-center justify-start p-0 sm:p-4 text-slate-100 ${isPhoneFrameMode ? '' : 'w-full'}`}>
      
      {/* Barra de herramientas superior para Desarrollador / Tester */}
      <div className="w-full max-w-md bg-slate-900/90 border-b sm:border border-slate-800 p-2.5 flex items-center justify-between text-xs text-slate-300 rounded-none sm:rounded-t-2xl">
        <div className="flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-emerald-400" />
          <span className="font-bold text-white tracking-tight">Rinde Móvil AI</span>
          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.2 rounded font-mono">
            Colaborador
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsPhoneFrameMode(!isPhoneFrameMode)}
            className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors cursor-pointer hidden sm:block"
            title={isPhoneFrameMode ? 'Ver en ancho completo' : 'Simular tamaño smartphone'}
          >
            {isPhoneFrameMode ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
          </button>

          {onExitMobileView && (
            <button
              type="button"
              onClick={onExitMobileView}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Consola ERP</span>
            </button>
          )}
        </div>
      </div>

      {/* Contenedor del Smartphone */}
      <div
        className={`w-full bg-slate-900 flex flex-col shadow-2xl overflow-hidden relative ${
          isPhoneFrameMode
            ? 'max-w-md min-h-[820px] max-h-[880px] sm:rounded-b-3xl border-x sm:border border-slate-800'
            : 'max-w-4xl min-h-[85vh] rounded-none sm:rounded-b-2xl border border-slate-800'
        }`}
      >
        {/* Cabecera del Smartphone */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white p-4 pt-3 shadow-md">
          {/* Fila 1: Logo y Selector de Colaborador */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center font-black text-sm">
                RG
              </div>
              <div>
                <h2 className="text-sm font-bold leading-tight">Rendición de Gastos</h2>
                <p className="text-[11px] text-blue-200 truncate max-w-[170px]">{empresaNombre}</p>
              </div>
            </div>

            {/* Selector rápido de colaborador */}
            <select
              value={activeCollaborator.id}
              onChange={(e) => {
                const found = availableCollaborators.find((c) => c.id === e.target.value);
                if (found) setActiveCollaborator(found);
              }}
              className="bg-black/30 text-white text-xs border border-white/20 rounded-xl px-2.5 py-1.5 font-medium outline-hidden cursor-pointer"
            >
              {availableCollaborators.map((c) => (
                <option key={c.id} value={c.id} className="bg-slate-900 text-white">
                  {c.nombre.split(' ')[0]} ({c.cargo.substring(0, 14)}...)
                </option>
              ))}
            </select>
          </div>

          {/* Fila 2: Tarjeta Resumen del Fondo, Saldo y Acción Rápida 'Descargar PDF' */}
          {activeReport ? (
            <div className="mt-3 bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/15">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-blue-200 uppercase font-bold tracking-wider block">
                    Rendición Activa
                  </span>
                  <span className="font-mono text-xs font-bold text-white">{activeReport.folio}</span>
                  <span className="text-[10px] text-blue-200 block truncate max-w-[190px]">
                    {activeReport.titulo}
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-blue-200 uppercase font-bold tracking-wider block">
                    {reportTotals.saldoReembolso > 0 ? 'A mi Favor (Reembolso)' : 'Fondo Restante'}
                  </span>
                  <span
                    className={`text-base font-mono font-black ${
                      reportTotals.saldoReembolso > 0 ? 'text-emerald-300' : 'text-amber-200'
                    }`}
                  >
                    {reportTotals.saldoReembolso > 0
                      ? `+${formatCLP(reportTotals.saldoReembolso)}`
                      : formatCLP(reportTotals.saldoReintegro)}
                  </span>
                  <span className="text-[10px] text-blue-100 block">
                    Rendido: {formatCLP(reportTotals.rendido)} / {formatCLP(reportTotals.fondo)}
                  </span>
                </div>
              </div>

              {/* Botón de Acción Rápida: Descargar PDF Formal + Accesos Directos WhatsApp / Correo */}
              <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handleDownloadPDF}
                  disabled={isGeneratingPdf}
                  className="flex-1 bg-white hover:bg-blue-50 text-blue-900 font-bold text-xs py-2 px-3 rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                  title="Generar documento formal jsPDF de la rendición con comprobantes validados"
                >
                  <FileDown className="w-4 h-4 text-blue-700 shrink-0" />
                  <span>{isGeneratingPdf ? 'Generando PDF...' : 'Descargar PDF'}</span>
                  <span className="text-[9px] bg-blue-100 text-blue-800 font-semibold px-1.5 py-0.2 rounded-full ml-0.5">
                    {activeReportComprobantes.length} docs
                  </span>
                </button>

                <div className="flex items-center gap-1.5">
                  <a
                    href={getWhatsAppExpenseShareUrl(
                      activeReport,
                      empresaNombre,
                      reportTotals.rendido,
                      reportTotals.saldoReembolso
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-emerald-500/25 hover:bg-emerald-500/35 text-emerald-200 border border-emerald-400/30 rounded-xl flex items-center justify-center transition-colors"
                    title="Enviar aviso por WhatsApp"
                  >
                    <MessageCircle className="w-4 h-4" />
                  </a>

                  <a
                    href={getEmailExpenseShareUrl(
                      activeReport,
                      empresaNombre,
                      reportTotals.rendido,
                      reportTotals.saldoReembolso
                    )}
                    className="p-2 bg-sky-500/25 hover:bg-sky-500/35 text-sky-200 border border-sky-400/30 rounded-xl flex items-center justify-center transition-colors"
                    title="Enviar aviso por Correo Electrónico"
                  >
                    <Mail className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-3 bg-white/10 backdrop-blur-md rounded-2xl p-2.5 border border-white/15 flex items-center justify-between">
              <span className="text-xs text-blue-200">Sin rendición activa seleccionada</span>
              <button
                type="button"
                onClick={handleDownloadPDF}
                disabled={isGeneratingPdf}
                className="bg-white text-blue-900 font-bold text-xs py-1.5 px-3 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <FileDown className="w-3.5 h-3.5 text-blue-700" />
                <span>Descargar PDF</span>
              </button>
            </div>
          )}
        </div>

        {/* Contenido Principal según Pestaña Móvil */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
          
          {/* ================================================================ */}
          {/* PESTAÑA 1: CÁMARA & ESCANEO IA */}
          {/* ================================================================ */}
          {mobileTab === 'CAMARA' && (
            <div className="space-y-4">
              {/* Notificación de éxito al enviar */}
              {submissionSuccess && (
                <div className="bg-emerald-950/80 border border-emerald-500/50 rounded-2xl p-4 text-center animate-in zoom-in-95 duration-200">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center mb-2">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <h3 className="text-sm font-bold text-emerald-200">¡Gasto Registrado con Éxito!</h3>
                  <p className="text-xs text-emerald-300/80 mt-1">
                    El Agente de Rendición de Gastos auditó y persistió el comprobante en MySQL 8.0.
                  </p>
                </div>
              )}

              {/* Notificación de Error */}
              {submissionError && (
                <div className="bg-rose-950/80 border border-rose-500/50 rounded-2xl p-3 text-xs text-rose-300 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-bold">Aviso del Sistema:</strong>
                    <span>{submissionError}</span>
                  </div>
                </div>
              )}

              {/* Estado Inicial: Captura de Foto con Cámara del Smartphone */}
              {!previewImage && !isScanning && (
                <div className="space-y-4">
                  <div className="text-center py-2">
                    <h3 className="text-base font-bold text-white">Capturar Comprobante</h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Toma una foto de tu boleta o factura. La IA extraerá montos, IVA y RUT automáticamente.
                    </p>
                  </div>

                  {/* Input Nativo Oculto para Cámara */}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    ref={fileInputCameraRef}
                    onChange={handleFileChange}
                    className="hidden"
                  />

                  {/* Input Nativo Oculto para Galería */}
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    ref={fileInputGalleryRef}
                    onChange={handleFileChange}
                    className="hidden"
                  />

                  {/* Botón Principal de Cámara (Grande, Táctil, Destacado) */}
                  <button
                    type="button"
                    onClick={() => fileInputCameraRef.current?.click()}
                    className="w-full py-8 bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 text-white rounded-3xl shadow-xl flex flex-col items-center justify-center gap-3 transition-all active:scale-95 cursor-pointer border border-blue-400/30"
                  >
                    <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner">
                      <Camera className="w-8 h-8 text-white" />
                    </div>
                    <div className="text-center">
                      <span className="text-base font-bold block">Tomar Foto con Cámara</span>
                      <span className="text-xs text-blue-200 mt-0.5 block">
                        Abre la cámara del celular al instante
                      </span>
                    </div>
                  </button>

                  {/* Botón Secundario: Seleccionar desde Galería */}
                  <button
                    type="button"
                    onClick={() => fileInputGalleryRef.current?.click()}
                    className="w-full py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-2xl border border-slate-700 font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
                  >
                    <Upload className="w-4 h-4 text-slate-400" />
                    <span>Subir desde Galería o Archivos</span>
                  </button>

                  {/* Atajos de Prueba Rápida (para testing en navegador de escritorio) */}
                  <div className="bg-slate-800/60 rounded-2xl p-3 border border-slate-800 mt-4">
                    <span className="text-[11px] font-bold text-slate-400 block mb-2 text-center uppercase tracking-wider">
                      Pruebas Rápidas de IA (Sin Cámara)
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => handleLoadDemoReceipt('COMBUSTIBLE')}
                        className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-center border border-slate-700 cursor-pointer text-[11px] font-medium text-slate-200"
                      >
                        ⛽ Copec
                      </button>
                      <button
                        type="button"
                        onClick={() => handleLoadDemoReceipt('HOTEL')}
                        className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-center border border-slate-700 cursor-pointer text-[11px] font-medium text-slate-200"
                      >
                        🏨 Hotel 33
                      </button>
                      <button
                        type="button"
                        onClick={() => handleLoadDemoReceipt('RESTAURANTE')}
                        className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-center border border-slate-700 cursor-pointer text-[11px] font-medium text-slate-200"
                      >
                        🍽️ Almuerzo
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Estado: Escaneando con IA Multimodal (Gemini 3.8 Flash) */}
              {isScanning && (
                <div className="py-12 px-4 text-center space-y-5 bg-slate-900/90 border border-slate-800 rounded-3xl">
                  <div className="relative w-28 h-28 mx-auto flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full border-4 border-blue-500/20 animate-ping"></div>
                    <div className="w-24 h-24 rounded-2xl bg-blue-600/20 border-2 border-blue-400 flex items-center justify-center relative overflow-hidden shadow-lg">
                      <Sparkles className="w-10 h-10 text-blue-400 animate-pulse" />
                      {/* Línea Láser de Escáner */}
                      <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_8px_#22d3ee] animate-bounce"></div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-white tracking-tight">
                      Analizando Comprobante con IA
                    </h3>
                    <p className="text-xs text-blue-400 font-mono mt-1 animate-pulse">
                      {scanStepMessage}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-2">
                      Gemini 3.8 Flash Vision • Detección de IVA y Art. 31 LIR
                    </p>
                  </div>
                </div>
              )}

              {/* Estado: Datos Leídos por la IA listos para Confirmar y Enviar */}
              {previewImage && !isScanning && aiScannedResult && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  {/* Banner Diagnóstico del Agente IA */}
                  <div className="bg-emerald-950/60 border border-emerald-500/40 rounded-2xl p-3 flex items-start gap-2.5">
                    <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-emerald-300">
                          Lectura Inteligente IA ({aiScannedResult.confianzaScore || 95}% Confianza)
                        </span>
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-mono">
                          Art. 31 LIR Conforme
                        </span>
                      </div>
                      <p className="text-[11px] text-emerald-400/90 mt-0.5">
                        {aiScannedResult.diagnosticoAgente}
                      </p>
                    </div>
                  </div>

                  {/* Miniatura de la Foto Capturada con Opción de Retomar */}
                  <div className="relative rounded-2xl overflow-hidden border border-slate-700 bg-slate-950 h-32 flex items-center justify-center">
                    <img
                      src={previewImage}
                      alt="Comprobante capturado"
                      className="w-full h-full object-contain"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewImage(null);
                        setAiScannedResult(null);
                      }}
                      className="absolute top-2 right-2 bg-slate-900/80 hover:bg-rose-900/80 text-white p-1.5 rounded-full text-xs font-semibold backdrop-blur-xs transition-colors cursor-pointer"
                      title="Retomar foto"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Formulario de Confirmación Editable en el Teléfono */}
                  <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700 space-y-3 text-xs">
                    
                    {/* Monto Total Grande */}
                    <div className="bg-slate-900 p-3 rounded-xl border border-slate-700 text-center">
                      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                        Monto Total Pagado (CLP)
                      </span>
                      <div className="flex items-center justify-center gap-1.5 mt-0.5">
                        <span className="text-2xl font-black text-emerald-400 font-mono">
                          $
                        </span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={editedComprobante.montoTotalClp ? editedComprobante.montoTotalClp.toLocaleString('es-CL') : ''}
                          onChange={(e) => {
                            const clean = e.target.value.replace(/\D/g, '');
                            const val = clean ? parseInt(clean, 10) : 0;
                            const neto = Math.round(val / 1.19);
                            setEditedComprobante({
                              ...editedComprobante,
                              montoTotalClp: val,
                              montoNeto: neto,
                              montoIva: val - neto,
                            });
                          }}
                          placeholder="0"
                          className="text-2xl font-black text-emerald-400 font-mono bg-transparent w-36 text-center outline-hidden border-b border-emerald-500/40 focus:border-emerald-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>
                      <div className="flex items-center justify-center gap-4 text-[10px] text-slate-400 mt-1 font-mono">
                        <span>Neto: {formatCLP(editedComprobante.montoNeto)}</span>
                        <span>IVA 19%: {formatCLP(editedComprobante.montoIva)}</span>
                      </div>
                    </div>

                    {/* Comercio y RUT */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-400 font-bold block mb-1">
                          Comercio / Proveedor
                        </label>
                        <input
                          type="text"
                          value={editedComprobante.proveedorRazonSocial}
                          onChange={(e) =>
                            setEditedComprobante({ ...editedComprobante, proveedorRazonSocial: e.target.value })
                          }
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 font-bold block mb-1">
                          RUT Emisor
                        </label>
                        <input
                          type="text"
                          value={editedComprobante.proveedorRut}
                          onChange={(e) =>
                            setEditedComprobante({ ...editedComprobante, proveedorRut: e.target.value })
                          }
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono"
                        />
                      </div>
                    </div>

                    {/* Folio y Tipo de Documento */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-400 font-bold block mb-1">
                          Folio / Número
                        </label>
                        <input
                          type="text"
                          value={editedComprobante.folioDocumento}
                          onChange={(e) =>
                            setEditedComprobante({ ...editedComprobante, folioDocumento: e.target.value })
                          }
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 font-bold block mb-1">
                          Tipo de Documento
                        </label>
                        <select
                          value={editedComprobante.tipoDocumento}
                          onChange={(e) =>
                            setEditedComprobante({
                              ...editedComprobante,
                              tipoDocumento: e.target.value as ExpenseDocumentType,
                            })
                          }
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white"
                        >
                          <option value="BOLETA_ELECTRONICA">Boleta Electrónica</option>
                          <option value="FACTURA_ELECTRONICA_33">Factura Electrónica 33</option>
                          <option value="TICKET_PEAJE">Ticket de Peaje / TAG</option>
                          <option value="BOLETA_HONORARIOS">Boleta de Honorarios</option>
                          <option value="RECIBO_MOVILIZACION">Recibo de Movilidad</option>
                        </select>
                      </div>
                    </div>

                    {/* Categoría y Centro de Costo */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-400 font-bold block mb-1">
                          Categoría de Gasto
                        </label>
                        <select
                          value={editedComprobante.categoria}
                          onChange={(e) =>
                            setEditedComprobante({
                              ...editedComprobante,
                              categoria: e.target.value as ExpenseCategory,
                            })
                          }
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white"
                        >
                          <option value="ALIMENTACION">🍽️ Alimentación</option>
                          <option value="COMBUSTIBLE">⛽ Combustible</option>
                          <option value="ALOJAMIENTO">🏨 Alojamiento</option>
                          <option value="PEAJES_ESTACIONAMIENTOS">🛣️ Peajes & TAG</option>
                          <option value="MATERIALES_INSUMOS">🔩 Materiales / Insumos</option>
                          <option value="TRANSPORTE_MOVILIZACION">🚕 Transporte</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 font-bold block mb-1">
                          Centro de Costo
                        </label>
                        <select
                          value={editedComprobante.centroCostoId}
                          onChange={(e) =>
                            setEditedComprobante({ ...editedComprobante, centroCostoId: e.target.value })
                          }
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white"
                        >
                          {costCenters.map((cc) => (
                            <option key={cc.id} value={cc.id}>
                              {cc.codigo}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Glosa Descriptiva */}
                    <div>
                      <label className="text-[10px] text-slate-400 font-bold block mb-1">
                        Glosa Explicativa
                      </label>
                      <input
                        type="text"
                        value={editedComprobante.descripcionGlosa}
                        onChange={(e) =>
                          setEditedComprobante({ ...editedComprobante, descripcionGlosa: e.target.value })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white"
                        placeholder="Motivo del gasto en terreno..."
                      />
                    </div>
                  </div>

                  {/* Botón de Envío al Agente y Registro en Servidor */}
                  <button
                    type="button"
                    onClick={handleSubmitReceiptToServer}
                    disabled={isSubmitting}
                    className="w-full py-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-2xl font-bold text-sm shadow-xl flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        <span>Registrando en Servidor...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        <span>Enviar al Agente de Gastos</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ================================================================ */}
          {/* PESTAÑA 2: MI RENDICIÓN & DETALLE DE GASTOS PRESENTADOS */}
          {/* ================================================================ */}
          {mobileTab === 'MI_RENDICION' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Comprobantes Rendidos</h3>
                  <p className="text-xs text-slate-400">
                    {activeReportComprobantes.length} comprobantes ingresados en {activeReport?.folio}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadPDF}
                    disabled={isGeneratingPdf}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors disabled:opacity-50"
                    title="Descargar documento formal en PDF"
                  >
                    <FileDown className="w-3.5 h-3.5 text-blue-400" />
                    <span>PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobileTab('CAMARA')}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Agregar</span>
                  </button>
                </div>
              </div>

              {activeReportComprobantes.length === 0 ? (
                <div className="py-12 text-center text-slate-400 bg-slate-800/40 rounded-2xl border border-slate-800 p-6 space-y-3">
                  <Receipt className="w-10 h-10 mx-auto text-slate-600" />
                  <p className="text-xs">Aún no has registrado comprobantes en esta rendición.</p>
                  <button
                    type="button"
                    onClick={() => setMobileTab('CAMARA')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Tomar Primera Foto</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {activeReportComprobantes.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-3 flex items-center justify-between gap-3 shadow-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center text-base shrink-0 font-bold">
                          {item.categoria === 'COMBUSTIBLE' && '⛽'}
                          {item.categoria === 'ALOJAMIENTO' && '🏨'}
                          {item.categoria === 'ALIMENTACION' && '🍽️'}
                          {item.categoria === 'PEAJES_ESTACIONAMIENTOS' && '🛣️'}
                          {item.categoria === 'MATERIALES_INSUMOS' && '🔩'}
                          {!['COMBUSTIBLE', 'ALOJAMIENTO', 'ALIMENTACION', 'PEAJES_ESTACIONAMIENTOS', 'MATERIALES_INSUMOS'].includes(item.categoria) && '🧾'}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs text-white truncate max-w-[150px]">
                              {item.proveedorRazonSocial}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              #{item.folioDocumento}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-300 truncate max-w-[180px]">
                            {item.descripcionGlosa}
                          </p>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {item.fecha} • {item.cuentaContableCodigo}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-mono font-bold text-sm text-emerald-400 block">
                          {formatCLP(item.montoTotalClp)}
                        </span>
                        {item.montoIva > 0 && (
                          <span className="text-[10px] text-blue-300 font-mono block">
                            IVA: {formatCLP(item.montoIva)}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-400 bg-emerald-950/80 px-1 py-0.2 rounded border border-emerald-800">
                          <Check className="w-2.5 h-2.5" />
                          Validado
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ================================================================ */}
          {/* PESTAÑA 3: MIS FONDOS & HISTORIAL */}
          {/* ================================================================ */}
          {mobileTab === 'HISTORIAL' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-white">Historial de Rendiciones</h3>
              <div className="space-y-2.5">
                {reports.map((rep) => (
                  <div
                    key={rep.id}
                    onClick={() => {
                      setActiveReportId(rep.id);
                      setMobileTab('MI_RENDICION');
                    }}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                      rep.id === activeReport?.id
                        ? 'bg-blue-950/40 border-blue-500/50'
                        : 'bg-slate-800/60 border-slate-700/60 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-white">{rep.folio}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            rep.estado === 'APROBADA'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : rep.estado === 'CONTABILIZADA_PAGADA'
                              ? 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                              : 'bg-amber-950 text-amber-300 border border-amber-800'
                          }`}
                        >
                          {rep.estado}
                        </span>
                      </div>
                      <span className="font-mono font-bold text-xs text-white">
                        {formatCLP(rep.montoTotalRendidoClp)}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 mt-1 line-clamp-1">{rep.titulo}</p>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-700/60">
                      <span>Rendidor: {rep.rendidorNombre.split(' ')[0]}</span>
                      <span>Comprobantes: {rep.comprobantes?.length || 0}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Barra de Navegación Inferior (Estilo App Móvil Nativa) */}
        <div className="absolute bottom-0 left-0 right-0 bg-slate-950/95 backdrop-blur-md border-t border-slate-800 py-2 px-6 flex items-center justify-around z-20">
          <button
            type="button"
            onClick={() => setMobileTab('CAMARA')}
            className={`flex flex-col items-center gap-1 py-1 cursor-pointer transition-all ${
              mobileTab === 'CAMARA' ? 'text-blue-400 font-bold scale-105' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Camera className="w-5 h-5" />
            <span className="text-[10px]">Capturar</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileTab('MI_RENDICION')}
            className={`flex flex-col items-center gap-1 py-1 cursor-pointer transition-all relative ${
              mobileTab === 'MI_RENDICION' ? 'text-blue-400 font-bold scale-105' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Receipt className="w-5 h-5" />
            <span className="text-[10px]">Mi Rendición</span>
            {activeReportComprobantes.length > 0 && (
              <span className="absolute top-0 right-1 w-4 h-4 bg-blue-600 text-white rounded-full text-[9px] flex items-center justify-center font-bold">
                {activeReportComprobantes.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setMobileTab('HISTORIAL')}
            className={`flex flex-col items-center gap-1 py-1 cursor-pointer transition-all ${
              mobileTab === 'HISTORIAL' ? 'text-blue-400 font-bold scale-105' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Clock className="w-5 h-5" />
            <span className="text-[10px]">Historial</span>
          </button>
        </div>

        {/* Modal / Sheet: PDF Listo para Enviar por WhatsApp o Correo */}
        {pdfShareModal?.isOpen && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-3 z-50 animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-700/80 rounded-3xl p-5 w-full max-w-sm shadow-2xl text-white space-y-3.5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                    <FileDown className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white leading-tight">Documento PDF Descargado</h3>
                    <p className="text-[11px] text-emerald-300 font-mono mt-0.5 truncate max-w-[210px]">
                      {pdfShareModal.filename}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPdfShareModal(null)}
                  className="p-1 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-slate-800/70 rounded-2xl p-3 border border-slate-700/60 text-xs text-slate-300 space-y-1.5">
                <div className="flex justify-between text-slate-400 text-[11px]">
                  <span>Folio de Rendición:</span>
                  <span className="font-mono font-bold text-white">{activeReport?.folio}</span>
                </div>
                <div className="flex justify-between text-slate-400 text-[11px]">
                  <span>Total Gastos Rendidos:</span>
                  <span className="font-bold text-emerald-400">{formatCLP(reportTotals.rendido)}</span>
                </div>
                <div className="flex justify-between text-slate-400 text-[11px]">
                  <span>Comprobantes Validados:</span>
                  <span className="font-bold text-white">{activeReportComprobantes.length} documentos</span>
                </div>
                <div className="flex justify-between text-slate-400 text-[11px]">
                  <span>Liquidación Saldo:</span>
                  <span className="font-bold text-amber-300">
                    {reportTotals.saldoReembolso > 0
                      ? `Reembolso colaborador ${formatCLP(reportTotals.saldoReembolso)}`
                      : `Reintegro empresa ${formatCLP(reportTotals.saldoReintegro)}`}
                  </span>
                </div>
                <p className="text-[10px] text-blue-300/90 pt-1.5 border-t border-slate-700/80">
                  ✓ Documento formal con validez tributaria Art. 31 LIR y certificación digital del Agente IA.
                </p>
              </div>

              {/* Botones de acción rápida: WhatsApp y Correo */}
              <div className="space-y-2 pt-1">
                <a
                  href={pdfShareModal.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30 transition-all cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Enviar aviso por WhatsApp</span>
                </a>

                <a
                  href={pdfShareModal.emailUrl}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-900/30 transition-all cursor-pointer"
                >
                  <Mail className="w-4 h-4" />
                  <span>Enviar por Correo a Finanzas</span>
                </a>

                <button
                  type="button"
                  onClick={() => setPdfShareModal(null)}
                  className="w-full py-1.5 text-center text-xs text-slate-400 hover:text-slate-200 transition-colors"
                >
                  Listo / Continuar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
