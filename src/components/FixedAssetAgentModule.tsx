import React, { useState, useMemo } from 'react';
import {
  FixedAsset,
  FixedAssetCategory,
  FixedAssetStatus,
  DepreciationMethod,
  AccountingEntry,
  ClientCompany,
} from '../types';
import {
  formatCLP,
  createFixedAssetAcquisitionEntry,
  createFixedAssetDepreciationEntry,
  createFixedAssetMonetaryCorrectionEntry,
  createFixedAssetDisposalEntry,
} from '../utils/chileanAccounting';
import {
  Layers,
  TrendingDown,
  Calendar,
  AlertTriangle,
  PlusCircle,
  FileSpreadsheet,
  CheckCircle2,
  Cpu,
  Search,
  BookOpen,
  DollarSign,
  QrCode,
  ShieldAlert,
  ArrowUpRight,
  Calculator,
  RefreshCw,
} from 'lucide-react';

interface FixedAssetAgentModuleProps {
  currentClient: ClientCompany;
  assets?: FixedAsset[];
  fixedAssets?: FixedAsset[];
  onAddAsset: (asset: FixedAsset) => void;
  onUpdateAsset: (asset: FixedAsset) => void;
  onAddAccountingEntry: (entry: AccountingEntry) => void;
  accountingEntries?: AccountingEntry[];
  indicators?: any;
}

export const FixedAssetAgentModule: React.FC<FixedAssetAgentModuleProps> = ({
  currentClient,
  assets,
  fixedAssets,
  onAddAsset,
  onUpdateAsset,
  onAddAccountingEntry,
  accountingEntries = [],
}) => {
  const assetList = useMemo(() => {
    return Array.isArray(assets) ? assets : Array.isArray(fixedAssets) ? fixedAssets : [];
  }, [assets, fixedAssets]);

  const [activeTab, setActiveTab] = useState<'INVENTARIO' | 'DEPRECIACION' | 'CUADRO_OFICIAL' | 'MANTENCION' | 'CONTABILIDAD'>('INVENTARIO');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('TODAS');
  const [selectedStatus, setSelectedStatus] = useState<string>('TODOS');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedAssetDetail, setSelectedAssetDetail] = useState<FixedAsset | null>(null);
  const [showDisposalModal, setShowDisposalModal] = useState<FixedAsset | null>(null);
  const [disposalPrice, setDisposalPrice] = useState<number>(0);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  // Periodo para ejecución de depreciación
  const [depreciationPeriod, setDepreciationPeriod] = useState<string>('2026-08');
  const [ipcRatePeriod, setIpcRatePeriod] = useState<number>(0.3); // 0.3% IPC mensual de ejemplo

  // Form State para Nuevo Activo Fijo
  const [newAssetForm, setNewAssetForm] = useState<Partial<FixedAsset>>({
    codigoPlaca: `AF-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
    nombre: '',
    descripcion: '',
    categoria: 'MAQUINARIA_EQUIPOS',
    cuentaContableActivo: '1.2.05',
    cuentaContableDepreciacion: '1.2.99',
    cuentaContableGasto: '5.2.13',
    fechaAdquisicion: new Date().toISOString().split('T')[0],
    fechaInicioUso: new Date().toISOString().split('T')[0],
    proveedorRut: '',
    proveedorRazonSocial: '',
    folioDteCompra: undefined,
    valorAdquisicionOriginal: 0,
    valorResidualFinanciero: 0,
    vidaUtilMesesFinanciera: 60,
    vidaUtilMesesTributaria: 36,
    metodoDepreciacion: 'LINEAL_IFRS',
    ubicacionFisica: 'Planta Central',
    responsableCustodio: '',
    estado: 'OPERATIVO',
    esFabrilProduccion: false,
    marcaModelo: '',
    numeroSerie: '',
    notasTecnicas: '',
  });

  // Notificación temporal
  const triggerSuccess = (msg: string) => {
    setActionSuccessMessage(msg);
    setTimeout(() => setActionSuccessMessage(null), 4500);
  };

  // Filtrado de activos
  const filteredAssets = useMemo(() => {
    return assetList.filter((item) => {
      const matchSearch =
        item.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.codigoPlaca.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.ubicacionFisica.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.responsableCustodio && item.responsableCustodio.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchCat = selectedCategory === 'TODAS' || item.categoria === selectedCategory;
      const matchStatus = selectedStatus === 'TODOS' || item.estado === selectedStatus;
      return matchSearch && matchCat && matchStatus;
    });
  }, [assetList, searchTerm, selectedCategory, selectedStatus]);

  // Métricas Consolidadas
  const metrics = useMemo(() => {
    let totalBruto = 0;
    let totalDepFin = 0;
    let totalDepTrib = 0;
    let totalCuotaMensual = 0;
    let totalFabrilCif = 0;
    let enMantencion = 0;

    assetList.forEach((a) => {
      if (a.estado !== 'DADO_DE_BAJA' && a.estado !== 'ENAJENADO') {
        totalBruto += a.valorAdquisicionOriginal;
        totalDepFin += a.depreciacionAcumuladaFinanciera;
        totalDepTrib += a.depreciacionAcumuladaTributaria;
        totalCuotaMensual += a.cuotaDepreciacionMensualFinanciera;
        if (a.esFabrilProduccion) {
          totalFabrilCif += a.cuotaDepreciacionMensualFinanciera;
        }
      }
      if (a.estado === 'MANTENCION') {
        enMantencion += 1;
      }
    });

    const valorLibroTotal = totalBruto - totalDepFin;
    const diffTemporalNic12 = totalDepTrib - totalDepFin; // Diferencia temporal para impuesto diferido

    return {
      totalActivos: assetList.length,
      activosActivos: assetList.filter((a) => a.estado === 'OPERATIVO').length,
      totalBruto,
      totalDepFin,
      totalDepTrib,
      valorLibroTotal,
      totalCuotaMensual,
      totalFabrilCif,
      diffTemporalNic12,
      enMantencion,
    };
  }, [assetList]);

  // Asientos relacionados con Activo Fijo
  const assetEntries = useMemo(() => {
    const safeEntries = Array.isArray(accountingEntries) ? accountingEntries : [];
    return safeEntries.filter(
      (e) =>
        e.origen === 'ACTIVO_FIJO' ||
        e.concepto.toLowerCase().includes('activo fijo') ||
        e.concepto.toLowerCase().includes('depreciación') ||
        e.lineas.some((l) => l.cuentaCodigo.startsWith('1.2.'))
    );
  }, [accountingEntries]);

  // Handler para Registrar Nuevo Activo
  const handleCreateAsset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAssetForm.nombre || !newAssetForm.valorAdquisicionOriginal) {
      alert('Por favor ingrese el nombre y el valor de adquisición del activo.');
      return;
    }

    const valorNeto = Number(newAssetForm.valorAdquisicionOriginal);
    const vidaUtilFin = Number(newAssetForm.vidaUtilMesesFinanciera) || 60;
    const vidaUtilTrib = Number(newAssetForm.vidaUtilMesesTributaria) || 36;
    const cuotaFin = Math.round(valorNeto / vidaUtilFin);
    const cuotaTrib = Math.round(valorNeto / vidaUtilTrib);

    const assetId = `af-${Date.now()}`;
    const newAsset: FixedAsset = {
      id: assetId,
      empresaId: currentClient.id || 'CLIENTE_ACTUAL',
      codigoPlaca: newAssetForm.codigoPlaca || `AF-${Date.now().toString().slice(-4)}`,
      codigoQr: `QR-${newAssetForm.codigoPlaca}`,
      nombre: newAssetForm.nombre || 'Nuevo Activo',
      descripcion: newAssetForm.descripcion || '',
      categoria: (newAssetForm.categoria as FixedAssetCategory) || 'MAQUINARIA_EQUIPOS',
      cuentaContableActivo: newAssetForm.cuentaContableActivo || '1.2.05',
      cuentaContableDepreciacion: newAssetForm.cuentaContableDepreciacion || '1.2.99',
      cuentaContableGasto: newAssetForm.esFabrilProduccion ? '5.1.04' : (newAssetForm.cuentaContableGasto || '5.2.13'),
      fechaAdquisicion: newAssetForm.fechaAdquisicion || new Date().toISOString().split('T')[0],
      fechaInicioUso: newAssetForm.fechaInicioUso || new Date().toISOString().split('T')[0],
      proveedorRut: newAssetForm.proveedorRut,
      proveedorRazonSocial: newAssetForm.proveedorRazonSocial,
      folioDteCompra: newAssetForm.folioDteCompra ? Number(newAssetForm.folioDteCompra) : undefined,
      valorAdquisicionOriginal: valorNeto,
      valorResidualFinanciero: Number(newAssetForm.valorResidualFinanciero) || 0,
      vidaUtilMesesFinanciera: vidaUtilFin,
      vidaUtilMesesTributaria: vidaUtilTrib,
      mesesDepreciados: 0,
      vidaUtilRestanteMeses: vidaUtilFin,
      metodoDepreciacion: (newAssetForm.metodoDepreciacion as DepreciationMethod) || 'LINEAL_IFRS',
      depreciacionAcumuladaFinanciera: 0,
      valorLibroFinanciero: valorNeto,
      cuotaDepreciacionMensualFinanciera: cuotaFin,
      factorCorreccionMonetariaAcum: 0,
      correccionMonetariaAcumulada: 0,
      depreciacionAcumuladaTributaria: 0,
      valorTributarioNeto: valorNeto,
      cuotaDepreciacionMensualTributaria: cuotaTrib,
      ubicacionFisica: newAssetForm.ubicacionFisica || 'Sede Central',
      responsableCustodio: newAssetForm.responsableCustodio || 'Administración',
      estado: (newAssetForm.estado as FixedAssetStatus) || 'OPERATIVO',
      numeroSerie: newAssetForm.numeroSerie,
      marcaModelo: newAssetForm.marcaModelo,
      esFabrilProduccion: Boolean(newAssetForm.esFabrilProduccion),
      ultimaInspeccionFecha: new Date().toISOString().split('T')[0],
      proximaMantencionFecha: '',
      notasTecnicas: newAssetForm.notasTecnicas,
    };

    // Generar Asiento Contable Automático de Alta
    const altaEntry = createFixedAssetAcquisitionEntry(newAsset);
    newAsset.asientoAltaId = altaEntry.id;

    onAddAsset(newAsset);
    onAddAccountingEntry(altaEntry);

    setShowAddModal(false);
    triggerSuccess(`Activo ${newAsset.codigoPlaca} registrado e incorporado al Libro Diario contable (Asiento #${altaEntry.id.slice(-6)}).`);
  };

  // Handler para Ejecutar Depreciación del Mes
  const handleRunMonthlyDepreciation = () => {
    const eligibleAssets = assetList.filter(
      (a) => a.estado === 'OPERATIVO' || a.estado === 'MANTENCION'
    );

    if (eligibleAssets.length === 0) {
      alert('No hay activos operativos disponibles para depreciar.');
      return;
    }

    const depreciacionesCalculadas = eligibleAssets.map((a) => {
      const cuotaFin = a.cuotaDepreciacionMensualFinanciera > 0
        ? a.cuotaDepreciacionMensualFinanciera
        : Math.round(a.valorAdquisicionOriginal / (a.vidaUtilMesesFinanciera || 60));
      return {
        activo: a,
        cuotaFinanciera: cuotaFin,
        cuotaFabrilCif: a.esFabrilProduccion ? cuotaFin : 0,
      };
    });

    // Crear Asiento Contable
    const depEntry = createFixedAssetDepreciationEntry(
      depreciationPeriod,
      depreciacionesCalculadas
    );
    onAddAccountingEntry(depEntry);

    // Actualizar valores en los activos
    eligibleAssets.forEach((a) => {
      const cuota = a.cuotaDepreciacionMensualFinanciera;
      const nuevaDepFin = a.depreciacionAcumuladaFinanciera + cuota;
      const nuevoValorLibro = Math.max(0, a.valorAdquisicionOriginal - nuevaDepFin);
      const nuevaDepTrib = a.depreciacionAcumuladaTributaria + a.cuotaDepreciacionMensualTributaria;

      onUpdateAsset({
        ...a,
        depreciacionAcumuladaFinanciera: nuevaDepFin,
        valorLibroFinanciero: nuevoValorLibro,
        depreciacionAcumuladaTributaria: nuevaDepTrib,
        mesesDepreciados: a.mesesDepreciados + 1,
        vidaUtilRestanteMeses: Math.max(0, a.vidaUtilRestanteMeses - 1),
      });
    });

    triggerSuccess(
      `Proceso de Depreciación ${depreciationPeriod} ejecutado exitosamente. Asiento contable de ${formatCLP(
        depEntry.totalDebe
      )} contabilizado automáticamente en Libro Diario.`
    );
  };

  // Handler para Corrección Monetaria IPC (Art. 41 LIR)
  const handleRunMonetaryCorrection = () => {
    const ipcFactor = (ipcRatePeriod || 0.3) / 100;
    let totalCmActivos = 0;
    let totalCmDep = 0;

    assetList.forEach((a) => {
      if (a.estado !== 'DADO_DE_BAJA' && a.estado !== 'ENAJENADO') {
        const cmAct = Math.round(a.valorAdquisicionOriginal * ipcFactor);
        const cmDp = Math.round(a.depreciacionAcumuladaFinanciera * ipcFactor);
        totalCmActivos += cmAct;
        totalCmDep += cmDp;

        onUpdateAsset({
          ...a,
          correccionMonetariaAcumulada: (a.correccionMonetariaAcumulada || 0) + cmAct,
          valorTributarioNeto: a.valorTributarioNeto + (cmAct - cmDp),
        });
      }
    });

    const cmEntry = createFixedAssetMonetaryCorrectionEntry(
      depreciationPeriod,
      totalCmActivos,
      totalCmDep
    );
    onAddAccountingEntry(cmEntry);

    triggerSuccess(
      `Corrección Monetaria Art. 41 LIR aplicada (IPC ${ipcRatePeriod}%). Asiento #${cmEntry.id.slice(
        -6
      )} registrado por reajuste neto de ${formatCLP(totalCmActivos - totalCmDep)}.`
    );
  };

  // Handler para Dar de Baja / Enajenar Activo
  const handleConfirmDisposal = () => {
    if (!showDisposalModal) return;
    const asset = showDisposalModal;
    const precio = Number(disposalPrice) || 0;

    const disposalEntry = createFixedAssetDisposalEntry(asset, precio);
    onAddAccountingEntry(disposalEntry);

    onUpdateAsset({
      ...asset,
      estado: precio > 0 ? 'ENAJENADO' : 'DADO_DE_BAJA',
      valorLibroFinanciero: 0,
      notasTecnicas: `${asset.notasTecnicas || ''}\nBaja/Enajenación el ${new Date().toISOString().split('T')[0]} por ${formatCLP(precio)}. Asiento ${disposalEntry.id}.`,
    });

    setShowDisposalModal(null);
    setDisposalPrice(0);
    triggerSuccess(
      `Activo ${asset.codigoPlaca} dado de baja/enajenado. Asiento de retiro y resultado extraordinario asentado en Libro Diario.`
    );
  };

  return (
    <div id="fixed-asset-agent-module" className="space-y-6">
      {/* Header con Perfil del Agente */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-white relative overflow-hidden shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-amber-500/20 border border-amber-500/30 rounded-xl text-amber-400">
              <Layers className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight">
                  Agente de Administración del Activo Fijo & Propiedades
                </h2>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  NIC 16 / Art. 31 N° 5 LIR
                </span>
              </div>
              <p className="text-slate-400 text-sm mt-1 max-w-3xl">
                Control físico de bienes, placas de identificación, cálculo de amortización y depreciación
                financiera IFRS vs acelerada tributaria, reajuste de corrección monetaria (Art. 41) e
                integración directa en el Libro Diario contable.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAddModal(true)}
              id="btn-register-fixed-asset"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              Incorporar Activo Fijo
            </button>
          </div>
        </div>

        {/* Notificación de Éxito Flotante */}
        {actionSuccessMessage && (
          <div className="mt-4 p-3 bg-emerald-950/80 border border-emerald-700/60 rounded-lg flex items-center gap-2 text-emerald-300 text-sm animate-fade-in">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span>{actionSuccessMessage}</span>
          </div>
        )}
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Inversión Histórica Bruta</span>
            <DollarSign className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-2xl font-bold text-slate-100">
            {formatCLP(metrics.totalBruto)}
          </div>
          <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
            <span className="text-amber-400 font-semibold">{metrics.totalActivos} bienes</span> inventariados ({metrics.activosActivos} operativos)
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Depreciación Acumulada IFRS</span>
            <TrendingDown className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-rose-300">
            {formatCLP(metrics.totalDepFin)}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Cuota mensual regular: <span className="text-slate-200 font-medium">{formatCLP(metrics.totalCuotaMensual)}/mes</span>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Valor Libro Neto (NIC 16)</span>
            <BookOpen className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400">
            {formatCLP(metrics.valorLibroTotal)}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Patrimonio neto inmovilizado en operaciones
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Depreciación Fabril (CIF)</span>
            <Cpu className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-cyan-300">
            {formatCLP(metrics.totalFabrilCif)}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Imputable a Costos Indirectos de Fabricación
          </div>
        </div>
      </div>

      {/* Tabs de Navegación */}
      <div className="border-b border-slate-800 flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('INVENTARIO')}
          className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
            activeTab === 'INVENTARIO'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          Inventario de Activos ({filteredAssets.length})
        </button>

        <button
          onClick={() => setActiveTab('DEPRECIACION')}
          className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
            activeTab === 'DEPRECIACION'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          Motor de Depreciación & IPC
        </button>

        <button
          onClick={() => setActiveTab('CUADRO_OFICIAL')}
          className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
            activeTab === 'CUADRO_OFICIAL'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          Cuadro Tributario F22 / DJ 1926
        </button>

        <button
          onClick={() => setActiveTab('MANTENCION')}
          className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
            activeTab === 'MANTENCION'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          Inspecciones & Custodios ({metrics.enMantencion} alertas)
        </button>

        <button
          onClick={() => setActiveTab('CONTABILIDAD')}
          className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
            activeTab === 'CONTABILIDAD'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          Asientos en Libro Diario ({assetEntries.length})
        </button>
      </div>

      {/* TAB 1: INVENTARIO DE ACTIVOS */}
      {activeTab === 'INVENTARIO' && (
        <div className="space-y-4">
          {/* Barra de Filtros */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/40 p-3 rounded-lg border border-slate-800">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por placa, nombre o custodio..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value="TODAS">Todas las Categorías</option>
                <option value="INSTALACIONES_REDES">Instalaciones & Redes Acuícolas</option>
                <option value="MAQUINARIA_EQUIPOS">Maquinaria & Equipos</option>
                <option value="TECNOLOGIA_COMPUTO">Tecnología & Cómputo</option>
                <option value="VEHICULOS">Vehículos & Flota</option>
                <option value="INFRAESTRUCTURA_EDIFICIOS">Infraestructura & Edificios</option>
                <option value="MUEBLES_UTILES">Muebles & Útiles</option>
              </select>

              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value="TODOS">Todos los Estados</option>
                <option value="OPERATIVO">Operativo</option>
                <option value="MANTENCION">En Mantención</option>
                <option value="DADO_DE_BAJA">Dado de Baja</option>
                <option value="ENAJENADO">Enajenado</option>
              </select>
            </div>
          </div>

          {/* Tabla de Activos */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/80 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3.5 px-4">Código / Placa</th>
                    <th className="py-3.5 px-4">Descripción del Activo</th>
                    <th className="py-3.5 px-4">Ubicación / Custodio</th>
                    <th className="py-3.5 px-4 text-right">Costo Histórico</th>
                    <th className="py-3.5 px-4 text-right">Deprec. Acumulada</th>
                    <th className="py-3.5 px-4 text-right">Valor Libro IFRS</th>
                    <th className="py-3.5 px-4 text-center">Estado</th>
                    <th className="py-3.5 px-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredAssets.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500">
                        No se encontraron activos fijos con los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    filteredAssets.map((asset) => (
                      <tr key={asset.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-medium text-amber-400">
                          <div className="flex items-center gap-1.5">
                            <QrCode className="w-3.5 h-3.5 text-slate-500" />
                            {asset.codigoPlaca}
                          </div>
                          <span className="text-xs text-slate-500 block font-sans">
                            {asset.cuentaContableActivo}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-200">{asset.nombre}</div>
                          <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                            <span className="bg-slate-800 px-1.5 py-0.5 rounded text-[11px] text-slate-300">
                              {asset.categoria.replace('_', ' ')}
                            </span>
                            {asset.esFabrilProduccion && (
                              <span className="bg-cyan-950 text-cyan-300 border border-cyan-800 px-1.5 py-0.5 rounded text-[10px] font-semibold">
                                FABRIL / CIF
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="text-slate-200">{asset.ubicacionFisica}</div>
                          <div className="text-xs text-slate-400">{asset.responsableCustodio}</div>
                        </td>

                        <td className="py-3.5 px-4 text-right font-mono font-medium text-slate-200">
                          {formatCLP(asset.valorAdquisicionOriginal)}
                        </td>

                        <td className="py-3.5 px-4 text-right font-mono text-rose-300">
                          {formatCLP(asset.depreciacionAcumuladaFinanciera)}
                        </td>

                        <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-400">
                          {formatCLP(asset.valorLibroFinanciero)}
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              asset.estado === 'OPERATIVO'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : asset.estado === 'MANTENCION'
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : 'bg-slate-700/40 text-slate-400 border border-slate-600'
                            }`}
                          >
                            {asset.estado}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setSelectedAssetDetail(asset)}
                              title="Ver Ficha Técnica"
                              className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-amber-300 rounded transition-colors"
                            >
                              <BookOpen className="w-4 h-4" />
                            </button>

                            {asset.estado !== 'DADO_DE_BAJA' && asset.estado !== 'ENAJENADO' && (
                              <button
                                onClick={() => setShowDisposalModal(asset)}
                                title="Dar de Baja o Enajenar"
                                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-rose-400 rounded transition-colors"
                              >
                                <TrendingDown className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MOTOR DE DEPRECIACIÓN & CORRECCIÓN MONETARIA */}
      {activeTab === 'DEPRECIACION' && (
        <div className="space-y-6">
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Calculator className="w-5 h-5 text-amber-400" />
              Ejecución Mensual de Depreciación & Reajuste Art. 41 LIR
            </h3>
            <p className="text-sm text-slate-400 mt-1 max-w-3xl">
              El agente calcula simultáneamente la depreciación financiera según NIC 16 (vida útil
              económica y valor residual) y la depreciación tributaria conforme al Art. 31 N° 5 de la
              Ley de la Renta (con opción de depreciación acelerada de 1/3 de la vida útil normal e
              instantánea Pyme).
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-4 border-t border-slate-800">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Período Contable
                </label>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-500" />
                  <input
                    type="month"
                    value={depreciationPeriod}
                    onChange={(e) => setDepreciationPeriod(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500 w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Variación IPC Período (%) - Art. 41 N° 2 LIR
                </label>
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-slate-500" />
                  <input
                    type="number"
                    step="0.1"
                    value={ipcRatePeriod}
                    onChange={(e) => setIpcRatePeriod(Number(e.target.value))}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500 w-full"
                  />
                </div>
              </div>

              <div className="flex items-end gap-2">
                <button
                  onClick={handleRunMonthlyDepreciation}
                  id="btn-run-monthly-depreciation"
                  className="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-semibold py-2 px-3 rounded-lg text-sm transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  <TrendingDown className="w-4 h-4" />
                  Contabilizar Depreciación
                </button>

                <button
                  onClick={handleRunMonetaryCorrection}
                  id="btn-run-monetary-correction"
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold py-2 px-3 rounded-lg text-sm transition-colors flex items-center justify-center gap-1.5 border border-slate-700"
                  title="Aplicar Reajuste Art. 41 LIR"
                >
                  <RefreshCw className="w-4 h-4 text-amber-400" />
                  Reajuste IPC
                </button>
              </div>
            </div>
          </div>

          {/* Tabla Comparativa: Financiera vs Tributaria por Activo */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between">
              <span className="font-semibold text-sm text-slate-200">
                Detalle de Cuotas Calculadas para el Período {depreciationPeriod}
              </span>
              <span className="text-xs text-slate-400">
                {assets.length} activos evaluados por el motor
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Activo</th>
                    <th className="py-3 px-4 text-right">Valor Adquisición</th>
                    <th className="py-3 px-4 text-center">Vida Útil IFRS / Trib.</th>
                    <th className="py-3 px-4 text-right">Cuota Financiera (NIC 16)</th>
                    <th className="py-3 px-4 text-right">Cuota Tributaria (LIR)</th>
                    <th className="py-3 px-4 text-right">Diferencia Temporal</th>
                    <th className="py-3 px-4 text-center">Imputación</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {assets.map((item) => {
                    const diffCuota = item.cuotaDepreciacionMensualTributaria - item.cuotaDepreciacionMensualFinanciera;
                    return (
                      <tr key={item.id} className="hover:bg-slate-800/20">
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-200">{item.nombre}</div>
                          <span className="font-mono text-xs text-amber-400">{item.codigoPlaca}</span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                          {formatCLP(item.valorAdquisicionOriginal)}
                        </td>
                        <td className="py-3 px-4 text-center text-xs">
                          <span className="text-emerald-400 font-medium">{item.vidaUtilMesesFinanciera}m</span>
                          {' / '}
                          <span className="text-amber-400 font-medium">{item.vidaUtilMesesTributaria}m</span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-rose-300">
                          {formatCLP(item.cuotaDepreciacionMensualFinanciera)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-amber-300">
                          {formatCLP(item.cuotaDepreciacionMensualTributaria)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-xs">
                          <span className={diffCuota >= 0 ? 'text-amber-400' : 'text-slate-400'}>
                            {formatCLP(diffCuota)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {item.esFabrilProduccion ? (
                            <span className="bg-cyan-950 text-cyan-300 border border-cyan-800 px-2 py-0.5 rounded text-xs font-semibold">
                              CIF Fabril (5.1.04)
                            </span>
                          ) : (
                            <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-xs">
                              Gasto Admin (5.2.13)
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CUADRO TRIBUTARIO F22 / DJ 1926 */}
      {activeTab === 'CUADRO_OFICIAL' && (
        <div className="space-y-4">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                Cuadro Oficial de Activo Fijo (Estándar SII - DJ 1926 & F22)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Cumplimiento de la Circular N° 65 del SII y Resolución Exenta N° 84 para acreditación
                del gasto por depreciación tributaria y reajuste por corrección monetaria.
              </p>
            </div>
            <button
              onClick={() => {
                alert('Generando archivo exportable formato SII CSV / Excel para DJ 1926...');
              }}
              className="px-3 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1.5 transition-colors self-start md:self-auto"
            >
              <ArrowUpRight className="w-4 h-4" />
              Exportar DJ 1926
            </button>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-x-auto shadow-sm">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-3">Código</th>
                  <th className="py-3 px-3">Bien / Especie</th>
                  <th className="py-3 px-3">F. Adq.</th>
                  <th className="py-3 px-3 text-right">Valor Histórico</th>
                  <th className="py-3 px-3 text-right">CM Art. 41</th>
                  <th className="py-3 px-3 text-right">Valor Actualizado</th>
                  <th className="py-3 px-3 text-right">Deprec. Ejercicio</th>
                  <th className="py-3 px-3 text-right">Deprec. Acumulada</th>
                  <th className="py-3 px-3 text-right">Valor Tributario Neto</th>
                  <th className="py-3 px-3 text-center">Régimen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {assets.map((a) => {
                  const valorAct = a.valorAdquisicionOriginal + (a.correccionMonetariaAcumulada || 0);
                  return (
                    <tr key={a.id} className="hover:bg-slate-800/30">
                      <td className="py-2.5 px-3 font-semibold text-amber-400">{a.codigoPlaca}</td>
                      <td className="py-2.5 px-3 font-sans text-slate-200">{a.nombre}</td>
                      <td className="py-2.5 px-3 text-slate-400">{a.fechaAdquisicion}</td>
                      <td className="py-2.5 px-3 text-right text-slate-300">
                        {formatCLP(a.valorAdquisicionOriginal)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-amber-300">
                        +{formatCLP(a.correccionMonetariaAcumulada || 0)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-100 font-bold">
                        {formatCLP(valorAct)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-rose-300">
                        {formatCLP(a.cuotaDepreciacionMensualTributaria * 12)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-rose-400 font-semibold">
                        {formatCLP(a.depreciacionAcumuladaTributaria)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-emerald-400 font-bold">
                        {formatCLP(a.valorTributarioNeto)}
                      </td>
                      <td className="py-2.5 px-3 text-center font-sans">
                        <span className="bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded text-[10px]">
                          {a.metodoDepreciacion === 'ACELERADA_TRIBUTARIA' ? '1/3 ACEL.' : 'LINEAL'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: MANTENCIÓN, INSPECCIONES Y AUDITORÍA IA */}
      {activeTab === 'MANTENCION' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {assets.map((asset) => (
              <div
                key={asset.id}
                className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-3 relative"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      {asset.codigoPlaca}
                    </span>
                    <h4 className="font-bold text-slate-100 text-base mt-1.5">{asset.nombre}</h4>
                    <p className="text-xs text-slate-400">{asset.ubicacionFisica}</p>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                      asset.estado === 'OPERATIVO'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    {asset.estado}
                  </span>
                </div>

                <div className="bg-slate-950/60 rounded-lg p-3 text-xs space-y-1.5 border border-slate-800/80">
                  <div className="flex justify-between text-slate-400">
                    <span>Responsable / Custodio:</span>
                    <span className="text-slate-200 font-medium">{asset.responsableCustodio}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Última Inspección Técnica:</span>
                    <span className="text-slate-200 font-medium">{asset.ultimaInspeccionFecha || 'Sin registro'}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Próxima Mantención Programada:</span>
                    <span className="text-amber-400 font-medium">{asset.proximaMantencionFecha || 'No calendarizada'}</span>
                  </div>
                </div>

                {asset.notasTecnicas && (
                  <div className="text-xs text-slate-400 bg-slate-950/40 p-2.5 rounded border border-slate-800">
                    <span className="font-semibold text-slate-300 block mb-0.5">Diagnóstico IA & Bitácora:</span>
                    {asset.notasTecnicas}
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
                  <span className="text-slate-400">
                    Marca: <strong className="text-slate-300">{asset.marcaModelo || 'N/A'}</strong>
                  </span>
                  <button
                    onClick={() => {
                      const nuevaFecha = new Date().toISOString().split('T')[0];
                      onUpdateAsset({
                        ...asset,
                        ultimaInspeccionFecha: nuevaFecha,
                        estado: 'OPERATIVO',
                      });
                      triggerSuccess(`Inspección física del activo ${asset.codigoPlaca} visada correctamente.`);
                    }}
                    className="text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Visar Inspección Hoy
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: ASIENTOS CONTABLES EN LIBRO DIARIO */}
      {activeTab === 'CONTABILIDAD' && (
        <div className="space-y-4">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-100 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-amber-400" />
                Comprobantes Contables Generados por el Módulo de Activo Fijo
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Todos los movimientos (altas, cuotas de depreciación, reajustes IPC y bajas) quedan
                asentados de forma balanceada (Debe = Haber) en el Libro Diario Central.
              </p>
            </div>
            <span className="px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-semibold">
              {assetEntries.length} Asientos Registrados
            </span>
          </div>

          <div className="space-y-3">
            {assetEntries.length === 0 ? (
              <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-8 text-center text-slate-500 text-sm">
                No hay asientos de activo fijo aún. Ejecute una depreciación o incorpore un nuevo bien.
              </div>
            ) : (
              assetEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                        {entry.id}
                      </span>
                      <span className="text-xs text-slate-400">{entry.fecha}</span>
                      <span className="text-sm font-semibold text-slate-200">{entry.concepto}</span>
                    </div>
                    <span className="text-xs font-mono font-bold text-emerald-400 self-start sm:self-auto">
                      Total: {formatCLP(entry.totalDebe)}
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left text-slate-300">
                      <thead className="text-slate-500 uppercase border-b border-slate-800/60">
                        <tr>
                          <th className="py-1.5 px-3">Cuenta</th>
                          <th className="py-1.5 px-3">Glosa Cuenta</th>
                          <th className="py-1.5 px-3 text-right">Debe</th>
                          <th className="py-1.5 px-3 text-right">Haber</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/40 font-mono">
                        {entry.lineas.map((line, idx) => (
                          <tr key={idx}>
                            <td className="py-1.5 px-3 text-amber-400 font-semibold">{line.cuentaCodigo}</td>
                            <td className="py-1.5 px-3 font-sans text-slate-300">{line.cuentaNombre}</td>
                            <td className="py-1.5 px-3 text-right text-emerald-300">
                              {line.debe > 0 ? formatCLP(line.debe) : '-'}
                            </td>
                            <td className="py-1.5 px-3 text-right text-rose-300">
                              {line.haber > 0 ? formatCLP(line.haber) : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* MODAL: INCORPORAR NUEVO ACTIVO FIJO */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full p-6 space-y-4 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-amber-400" />
                Alta de Activo Fijo con Integración Contable
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-200 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateAsset} className="space-y-4 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Código Placa / Identificador
                  </label>
                  <input
                    type="text"
                    required
                    value={newAssetForm.codigoPlaca || ''}
                    onChange={(e) => setNewAssetForm({ ...newAssetForm, codigoPlaca: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Categoría del Bien
                  </label>
                  <select
                    value={newAssetForm.categoria}
                    onChange={(e) =>
                      setNewAssetForm({
                        ...newAssetForm,
                        categoria: e.target.value as FixedAssetCategory,
                        cuentaContableActivo:
                          e.target.value === 'INSTALACIONES_REDES' ? '1.2.06' :
                          e.target.value === 'TECNOLOGIA_COMPUTO' ? '1.2.04' :
                          e.target.value === 'VEHICULOS' ? '1.2.07' :
                          e.target.value === 'INFRAESTRUCTURA_EDIFICIOS' ? '1.2.08' : '1.2.05',
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500"
                  >
                    <option value="MAQUINARIA_EQUIPOS">Maquinaria, Equipos y Embarcaciones</option>
                    <option value="INSTALACIONES_REDES">Instalaciones, Redes y Fondeos Acuícolas</option>
                    <option value="TECNOLOGIA_COMPUTO">Tecnología, Servidores y Cómputo</option>
                    <option value="VEHICULOS">Vehículos y Flota</option>
                    <option value="INFRAESTRUCTURA_EDIFICIOS">Infraestructura, Plantas y Galpones</option>
                    <option value="MUEBLES_UTILES">Muebles y Útiles de Oficina</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Nombre o Denominación del Activo
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ej: Red Pecera HDPE 30x30m con Relinga Reforzada"
                    value={newAssetForm.nombre || ''}
                    onChange={(e) => setNewAssetForm({ ...newAssetForm, nombre: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Valor Adquisición Neto ($ CLP)
                  </label>
                  <input
                    type="number"
                    required
                    value={newAssetForm.valorAdquisicionOriginal || ''}
                    onChange={(e) =>
                      setNewAssetForm({ ...newAssetForm, valorAdquisicionOriginal: Number(e.target.value) })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Folio Factura Electrónica (DTE 33)
                  </label>
                  <input
                    type="number"
                    placeholder="ej: 14890"
                    value={newAssetForm.folioDteCompra || ''}
                    onChange={(e) => setNewAssetForm({ ...newAssetForm, folioDteCompra: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Vida Útil IFRS (Meses)
                  </label>
                  <input
                    type="number"
                    value={newAssetForm.vidaUtilMesesFinanciera || 60}
                    onChange={(e) =>
                      setNewAssetForm({ ...newAssetForm, vidaUtilMesesFinanciera: Number(e.target.value) })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Vida Útil Tributaria LIR (Meses)
                  </label>
                  <input
                    type="number"
                    value={newAssetForm.vidaUtilMesesTributaria || 36}
                    onChange={(e) =>
                      setNewAssetForm({ ...newAssetForm, vidaUtilMesesTributaria: Number(e.target.value) })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Ubicación Física
                  </label>
                  <input
                    type="text"
                    placeholder="ej: Centro Hornopirén #3"
                    value={newAssetForm.ubicacionFisica || ''}
                    onChange={(e) => setNewAssetForm({ ...newAssetForm, ubicacionFisica: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Responsable / Custodio
                  </label>
                  <input
                    type="text"
                    placeholder="ej: Cap. Patricio Andrade"
                    value={newAssetForm.responsableCustodio || ''}
                    onChange={(e) =>
                      setNewAssetForm({ ...newAssetForm, responsableCustodio: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="sm:col-span-2 flex items-center gap-3 p-3 bg-slate-950/60 rounded-lg border border-slate-800">
                  <input
                    type="checkbox"
                    id="chk-es-fabril"
                    checked={newAssetForm.esFabrilProduccion || false}
                    onChange={(e) =>
                      setNewAssetForm({
                        ...newAssetForm,
                        esFabrilProduccion: e.target.checked,
                        cuentaContableGasto: e.target.checked ? '5.1.04' : '5.2.13',
                      })
                    }
                    className="rounded text-amber-500 focus:ring-amber-500 w-4 h-4"
                  />
                  <label htmlFor="chk-es-fabril" className="text-xs text-slate-300 cursor-pointer">
                    <strong>Activo Afecto a Procesos Productivos / Fabriles:</strong> Su depreciación se
                    imputará automáticamente a la cuenta <strong>5.1.04 Costos Indirectos de Fabricación (CIF)</strong>{' '}
                    y entrará al costeo de las órdenes de producción.
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-lg text-sm transition-colors shadow-sm"
                >
                  Confirmar Alta y Generar Asiento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: FICHA TÉCNICA DETALLADA */}
      {selectedAssetDetail && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-xl w-full p-6 space-y-4 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="font-mono text-xs text-amber-400 font-bold">
                  {selectedAssetDetail.codigoPlaca}
                </span>
                <h3 className="text-lg font-bold text-slate-100">{selectedAssetDetail.nombre}</h3>
              </div>
              <button
                onClick={() => setSelectedAssetDetail(null)}
                className="text-slate-400 hover:text-slate-200 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-950 p-3 rounded-lg border border-slate-800">
                <div>
                  <span className="text-slate-400 block">Costo Histórico Adquisición:</span>
                  <strong className="text-slate-200 font-mono text-sm">
                    {formatCLP(selectedAssetDetail.valorAdquisicionOriginal)}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400 block">Valor Libro IFRS Actual:</span>
                  <strong className="text-emerald-400 font-mono text-sm">
                    {formatCLP(selectedAssetDetail.valorLibroFinanciero)}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400 block">Depreciación Acumulada:</span>
                  <strong className="text-rose-400 font-mono text-sm">
                    {formatCLP(selectedAssetDetail.depreciacionAcumuladaFinanciera)}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400 block">Valor Tributario Neto:</span>
                  <strong className="text-amber-400 font-mono text-sm">
                    {formatCLP(selectedAssetDetail.valorTributarioNeto)}
                  </strong>
                </div>
              </div>

              <div className="space-y-1 text-slate-300">
                <p><strong>Ubicación:</strong> {selectedAssetDetail.ubicacionFisica}</p>
                <p><strong>Custodio:</strong> {selectedAssetDetail.responsableCustodio}</p>
                <p><strong>Fecha Adquisición:</strong> {selectedAssetDetail.fechaAdquisicion}</p>
                <p><strong>Proveedor:</strong> {selectedAssetDetail.proveedorRazonSocial || 'N/A'}</p>
                <p><strong>Marca / Modelo:</strong> {selectedAssetDetail.marcaModelo || 'N/A'}</p>
                <p><strong>N° Serie:</strong> {selectedAssetDetail.numeroSerie || 'N/A'}</p>
                <p><strong>Cuenta Activo:</strong> {selectedAssetDetail.cuentaContableActivo}</p>
                <p><strong>Cuenta Depreciación:</strong> {selectedAssetDetail.cuentaContableDepreciacion}</p>
                <p><strong>Cuenta Gasto:</strong> {selectedAssetDetail.cuentaContableGasto}</p>
              </div>

              {selectedAssetDetail.notasTecnicas && (
                <div className="bg-slate-950 p-3 rounded border border-slate-800">
                  <strong className="text-slate-300 block mb-1">Notas Técnicas:</strong>
                  <p className="text-slate-400 whitespace-pre-line">{selectedAssetDetail.notasTecnicas}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                onClick={() => setSelectedAssetDetail(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: BAJA O ENAJENACIÓN */}
      {showDisposalModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-rose-400 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5" />
                Baja o Enajenación de Activo Fijo
              </h3>
              <button
                onClick={() => setShowDisposalModal(null)}
                className="text-slate-400 hover:text-slate-200 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Está a punto de dar de baja el activo{' '}
              <strong className="text-slate-100">{showDisposalModal.nombre}</strong> (
              <span className="font-mono text-amber-400">{showDisposalModal.codigoPlaca}</span>). Valor libro
              actual:{' '}
              <strong className="text-emerald-400">{formatCLP(showDisposalModal.valorLibroFinanciero)}</strong>.
            </p>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300 uppercase">
                Precio de Venta Neto ($ CLP) — Deje en 0 si es destrucción o chatarra
              </label>
              <input
                type="number"
                value={disposalPrice}
                onChange={(e) => setDisposalPrice(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono font-bold focus:outline-none focus:border-amber-500 text-sm"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setShowDisposalModal(null)}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDisposal}
                className="px-3 py-2 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-lg text-xs shadow-sm"
              >
                Confirmar Baja y Asentar Contablemente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
