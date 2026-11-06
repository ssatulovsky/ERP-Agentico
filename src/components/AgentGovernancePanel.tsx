import React, { useState, useEffect } from 'react';
import {
  Shield,
  Layers,
  Brain,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  Save,
  RefreshCw,
  Plus,
  ArrowRight,
  Sparkles,
  BookOpen,
  Lock,
  RotateCcw,
  Check,
  X,
  HelpCircle,
  Hash,
  Award
} from 'lucide-react';
import { ClientCompany } from '../types';

interface AgentGovernancePanelProps {
  clients: ClientCompany[];
  activeClientId: string;
}

export const AgentGovernancePanel: React.FC<AgentGovernancePanelProps> = ({
  clients,
  activeClientId,
}) => {
  const [selectedClientId, setSelectedClientId] = useState<string>(activeClientId || (clients[0]?.id ?? ''));
  const [selectedModule, setSelectedModule] = useState<'RRHH' | 'SII_RCV' | 'F29_TAX' | 'BANK_RECON' | 'INVENTORY_WMS' | 'ACCOUNTING_LEDGER'>('SII_RCV');

  // Estado de Directivas Especiales (Capa 3)
  const [specialInstructions, setSpecialInstructions] = useState<string>('');
  const [operationalParams, setOperationalParams] = useState<string>('{}');
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configSaveSuccess, setConfigSaveSuccess] = useState(false);

  // Estado de Aprendizajes (Capa 4)
  const [learnings, setLearnings] = useState<any[]>([]);
  const [isLoadingLearnings, setIsLoadingLearnings] = useState(false);
  const [isNewLearningModalOpen, setIsNewLearningModalOpen] = useState(false);
  const [newLearningForm, setNewLearningForm] = useState({
    categoria: 'ERROR_IMPUTACION',
    error: '',
    solucion: '',
  });

  // Estado del Inspector de Contexto en 4 Capas
  const [isBuildingContext, setIsBuildingContext] = useState(false);
  const [inspectedContext, setInspectedContext] = useState<{
    systemInstruction?: string;
    companyProfile?: any;
    learningsApplied?: any[];
  } | null>(null);

  // Estado de Prueba del Orquestador Supervisor Gatekeeper
  const [isTestingSupervisor, setIsTestingSupervisor] = useState(false);
  const [supervisorVerdict, setSupervisorVerdict] = useState<any>(null);

  const selectedClient = clients.find((c) => c.id === selectedClientId) || clients[0];

  // Cargar configuración de directivas especiales al cambiar cliente o módulo
  useEffect(() => {
    if (!selectedClient) return;
    const fetchConfig = async () => {
      try {
        const res = await fetch(`/api/governance/configs/${selectedClient.rut || selectedClient.id}/${selectedModule}`);
        if (res.ok) {
          const json = await res.json();
          if (json.data) {
            setSpecialInstructions(json.data.instruccionesEspeciales || '');
            setOperationalParams(
              JSON.stringify(json.data.parametrosOperativos || {}, null, 2)
            );
          }
        }
      } catch (err) {
        console.warn('Error cargando configuración:', err);
      }
    };
    fetchConfig();
  }, [selectedClientId, selectedModule, selectedClient]);

  // Cargar aprendizajes
  const loadLearnings = async () => {
    setIsLoadingLearnings(true);
    try {
      const res = await fetch(`/api/governance/learnings?moduloCodigo=${selectedModule}`);
      if (res.ok) {
        const json = await res.json();
        setLearnings(json.data || []);
      }
    } catch (err) {
      console.warn('Error cargando aprendizajes:', err);
    } finally {
      setIsLoadingLearnings(false);
    }
  };

  useEffect(() => {
    loadLearnings();
  }, [selectedModule]);

  // Guardar directivas especiales
  const handleSaveConfig = async () => {
    if (!selectedClient) return;
    setIsSavingConfig(true);
    setConfigSaveSuccess(false);

    try {
      let parsedParams = {};
      try {
        parsedParams = JSON.parse(operationalParams);
      } catch {
        alert('El formato de Parámetros Operativos debe ser un JSON válido.');
        setIsSavingConfig(false);
        return;
      }

      const res = await fetch('/api/governance/configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresaId: selectedClient.rut || selectedClient.id,
          moduloCodigo: selectedModule,
          instruccionesEspeciales: specialInstructions,
          parametrosOperativos: parsedParams,
          activo: true,
        }),
      });

      if (res.ok) {
        setConfigSaveSuccess(true);
        setTimeout(() => setConfigSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Error guardando directivas especiales:', err);
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Crear nuevo aprendizaje
  const handleCreateLearning = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLearningForm.error.trim() || !newLearningForm.solucion.trim()) {
      alert('Por favor complete la descripción del error y la solución obligatoria.');
      return;
    }

    try {
      const res = await fetch('/api/governance/learnings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresaId: selectedClient?.rut || null,
          modulo: selectedModule,
          categoria: newLearningForm.categoria,
          error: newLearningForm.error,
          solucion: newLearningForm.solucion,
        }),
      });

      if (res.ok) {
        setIsNewLearningModalOpen(false);
        setNewLearningForm({ categoria: 'ERROR_IMPUTACION', error: '', solucion: '' });
        loadLearnings();
      }
    } catch (err) {
      console.error('Error creando aprendizaje:', err);
    }
  };

  // Probar ensamblado de contexto en 4 capas
  const handleBuildContext = async () => {
    if (!selectedClient) return;
    setIsBuildingContext(true);
    try {
      const res = await fetch('/api/governance/build-context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresaId: selectedClient.rut || selectedClient.id,
          moduloCodigo: selectedModule,
          tareaEspecifica: `Contabilización mensual e imputación pericial para período contable 2026-09 en módulo ${selectedModule}`,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        setInspectedContext(json.data);
      }
    } catch (err) {
      console.error('Error ensamblando contexto:', err);
    } finally {
      setIsBuildingContext(false);
    }
  };

  // Probar verificación del Orquestador Supervisor Gatekeeper
  const handleTestSupervisor = async (testCase: 'CORRECT' | 'ERROR_DESCUADRE' | 'ERROR_CLOUD') => {
    setIsTestingSupervisor(true);
    setSupervisorVerdict(null);

    let proposedResult: any = {};

    if (testCase === 'CORRECT') {
      proposedResult = {
        asientoPropuesto: {
          fecha: '2026-09-04',
          periodo: '2026-09',
          glosa: 'Servicio Cloud AWS Servidores Producción Factura 18293',
          documentoRef: 'FAC-AWS-18293',
          origenModulo: 'RCV_COMPRA',
          lineas: [
            {
              codigoCuenta: '5.1.02.015',
              nombreCuenta: 'Servicios de Infraestructura Cloud y SaaS',
              debe: 850000,
              haber: 0,
              rutAuxiliar: '76.456.789-1',
            },
            {
              codigoCuenta: '1.1.07.001',
              nombreCuenta: 'IVA Crédito Fiscal (19%)',
              debe: 161500,
              haber: 0,
            },
            {
              codigoCuenta: '2.1.01.001',
              nombreCuenta: 'Proveedores Nacionales por Pagar',
              debe: 0,
              haber: 1011500,
              rutAuxiliar: '76.456.789-1',
            },
          ],
        },
      };
    } else if (testCase === 'ERROR_DESCUADRE') {
      proposedResult = {
        asientoPropuesto: {
          fecha: '2026-09-04',
          periodo: '2026-09',
          glosa: 'Factura Compra con Descuadre de Centavos',
          documentoRef: 'FAC-ERR-999',
          origenModulo: 'RCV_COMPRA',
          lineas: [
            {
              codigoCuenta: '1.1.05.001',
              nombreCuenta: 'Mercaderías',
              debe: 1000000,
              haber: 0,
            },
            {
              codigoCuenta: '2.1.01.001',
              nombreCuenta: 'Proveedores',
              debe: 0,
              haber: 999990, // Descuadre de $10
            },
          ],
        },
      };
    } else if (testCase === 'ERROR_CLOUD') {
      // Ignora directiva de cuenta 5.1.02.015 y usa Gastos Generales 6.1.01.001
      proposedResult = {
        asientoPropuesto: {
          fecha: '2026-09-04',
          periodo: '2026-09',
          glosa: 'Factura AWS Servidores Cloud Producción',
          documentoRef: 'AWS-CORP-44',
          origenModulo: 'RCV_COMPRA',
          lineas: [
            {
              codigoCuenta: '6.1.01.001', // Infringe directiva
              nombreCuenta: 'Gastos Generales de Administración',
              debe: 500000,
              haber: 0,
            },
            {
              codigoCuenta: '1.1.07.001',
              nombreCuenta: 'IVA Crédito Fiscal',
              debe: 95000,
              haber: 0,
            },
            {
              codigoCuenta: '2.1.01.001',
              nombreCuenta: 'Proveedores',
              debe: 0,
              haber: 595000,
            },
          ],
        },
      };
    }

    try {
      const res = await fetch('/api/governance/supervise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresaId: selectedClient?.rut || selectedClient?.id || '',
          modulo: selectedModule,
          proposedResult,
          contextUsed: {
            instruccionesEspeciales: specialInstructions,
            parametrosOperativos: operationalParams,
          },
        }),
      });

      if (res.ok) {
        const json = await res.json();
        setSupervisorVerdict(json.data);
      }
    } catch (err) {
      console.error('Error testeando supervisor:', err);
    } finally {
      setIsTestingSupervisor(false);
    }
  };

  const totalEvitados = learnings.reduce((acc, curr) => acc + (curr.vecesEvitado || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <span className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg border border-indigo-500/30">
                <Shield className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold tracking-tight text-white">
                Gobernanza, Contexto e Instrucciones Especiales
              </h2>
            </div>
            <p className="text-sm text-slate-300 max-w-2xl">
              Subsistema de inyección contextual en 4 capas y supervisión pericial estricta. Ningún asistente con herramientas emite declaraciones ni asientos sin la tutela y firma digital del Orquestador Senior.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-lg px-3 py-2 text-right">
              <span className="text-xs text-slate-400 block uppercase font-medium">Incidentes Evitados</span>
              <span className="text-lg font-bold text-emerald-400 font-mono">
                {totalEvitados} prevenidos
              </span>
            </div>
            <button
              onClick={() => setIsNewLearningModalOpen(true)}
              className="flex items-center space-x-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Registrar Lección</span>
            </button>
          </div>
        </div>

        {/* Selectores de Cliente y Módulo */}
        <div className="mt-6 pt-5 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1 uppercase tracking-wider">
              Empresa Cliente Bajo Tutela
            </label>
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.razonSocial} ({c.rut}) - {c.regimenTributario}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1 uppercase tracking-wider">
              Módulo Operativo del Agente
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1">
              {(['RRHH', 'SII_RCV', 'F29_TAX', 'BANK_RECON', 'INVENTORY_WMS', 'ACCOUNTING_LEDGER'] as const).map(
                (mod) => (
                  <button
                    key={mod}
                    onClick={() => setSelectedModule(mod)}
                    className={`px-2 py-1.5 rounded text-xs font-medium transition text-center ${
                      selectedModule === mod
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    {mod}
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Grid de 2 Columnas: Capa 3 (Directivas Ad-Hoc) y Capa 4 (Base de Conocimiento) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Columna Izquierda: Directivas Especiales e Instrucciones Ad-Hoc (Capa 3) */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Sliders className="w-5 h-5 text-indigo-600" />
              <h3 className="font-semibold text-slate-900">
                Directivas Especiales Ad-Hoc (Capa 3)
              </h3>
            </div>
            <span className="text-xs bg-indigo-50 text-indigo-700 font-mono px-2 py-0.5 rounded border border-indigo-200">
              {selectedModule}
            </span>
          </div>

          <p className="text-xs text-slate-500">
            Reglas de negocio personalizadas por el Estudio Contable para esta empresa en el módulo seleccionado.
          </p>

          <div>
            <label className="text-xs font-medium text-slate-700 block mb-1">
              Instrucciones Especiales y Reglas de Imputación
            </label>
            <textarea
              rows={4}
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              placeholder="Ej: Para compras de servidores AWS o Cloud, imputar en cuenta 5.1.02.015 en vez de gastos generales. No dar acuse automático a facturas de áridos sin confirmación de bodega."
              className="w-full text-xs font-mono p-3 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-700 block mb-1">
              Parámetros Operativos en Formato JSON
            </label>
            <textarea
              rows={5}
              value={operationalParams}
              onChange={(e) => setOperationalParams(e.target.value)}
              placeholder="{ 'reglasImputacionEspecificas': [...] }"
              className="w-full text-xs font-mono p-3 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            {configSaveSuccess ? (
              <span className="text-xs text-emerald-600 flex items-center space-x-1">
                <Check className="w-4 h-4" />
                <span>Directiva guardada en MySQL 8.0</span>
              </span>
            ) : (
              <span className="text-xs text-slate-400">
                Afecta inmediatamente las próximas ejecuciones.
              </span>
            )}

            <button
              onClick={handleSaveConfig}
              disabled={isSavingConfig}
              className="flex items-center space-x-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition disabled:opacity-50 shadow-sm"
            >
              {isSavingConfig ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>Guardar Directivas</span>
            </button>
          </div>
        </div>

        {/* Columna Derecha: Base de Conocimiento de Aprendizajes (Capa 4) */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Brain className="w-5 h-5 text-indigo-600" />
              <h3 className="font-semibold text-slate-900">
                Memoria de Aprendizajes & Few-Shot (Capa 4)
              </h3>
            </div>
            <span className="text-xs text-slate-500 font-mono">
              {learnings.length} lecciones activas
            </span>
          </div>

          <p className="text-xs text-slate-500">
            Casos de corrección histórica que se inyectan en el prompt para evitar reincidencias de error.
          </p>

          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {isLoadingLearnings ? (
              <div className="text-center py-8 text-xs text-slate-400">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-500" />
                Cargando aprendizajes desde MySQL...
              </div>
            ) : learnings.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 rounded-lg border border-dashed border-slate-200 text-xs text-slate-500">
                No hay incidentes registrados para este módulo.
              </div>
            ) : (
              learnings.map((l) => (
                <div
                  key={l.id}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded text-[10px] border border-indigo-100">
                      {l.categoria}
                    </span>
                    <span className="text-[11px] font-mono text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-medium">
                      {l.vecesEvitado || 0} evitados
                    </span>
                  </div>
                  <div className="text-slate-700">
                    <strong className="text-red-600">Error previo:</strong> {l.descripcionError}
                  </div>
                  <div className="text-slate-800 bg-white p-2 rounded border border-slate-200">
                    <strong className="text-emerald-700">Regla mandatoria:</strong> {l.solucionAplicada}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Herramientas de Inspección y Validación del Orquestador */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Inspector de Prompt en 4 Capas */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-white shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Layers className="w-5 h-5 text-indigo-400" />
              <h3 className="font-semibold text-white text-sm">
                Inspector de Contexto Jerárquico en 4 Capas
              </h3>
            </div>
            <button
              onClick={handleBuildContext}
              disabled={isBuildingContext}
              className="flex items-center space-x-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-medium transition disabled:opacity-50"
            >
              {isBuildingContext ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              <span>Ensamblar System Prompt</span>
            </button>
          </div>

          <p className="text-xs text-slate-400">
            Previsualiza cómo se fusionan dinámicamente Capa 1 (Leyes), Capa 2 (Perfil Empresa), Capa 3 (Directivas Ad-Hoc) y Capa 4 (Few-Shot) para este agente.
          </p>

          {inspectedContext ? (
            <div className="space-y-3">
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-[11px] font-mono text-emerald-400 max-h-60 overflow-y-auto whitespace-pre-wrap">
                {inspectedContext.systemInstruction}
              </div>
              <div className="text-[11px] text-slate-400 flex items-center justify-between font-mono">
                <span>Régimen: {inspectedContext.companyProfile?.regimenTributario}</span>
                <span>PPM: {inspectedContext.companyProfile?.tasaPpmSugerida}</span>
                <span>Lecciones inyectadas: {inspectedContext.learningsApplied?.length || 0}</span>
              </div>
            </div>
          ) : (
            <div className="p-6 bg-slate-950/60 rounded-lg border border-dashed border-slate-800 text-center text-xs text-slate-500">
              Presione "Ensamblar System Prompt" para auditar la estructura exacta de inyección contextual.
            </div>
          )}
        </div>

        {/* Orquestador Supervisor Gatekeeper: Test en Tiempo Real */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Award className="w-5 h-5 text-indigo-600" />
              <h3 className="font-semibold text-slate-900 text-sm">
                Simulador del Orquestador Supervisor (Gatekeeper)
              </h3>
            </div>
            <span className="text-xs bg-emerald-50 text-emerald-700 font-mono px-2 py-0.5 rounded border border-emerald-200">
              HMAC SHA-256
            </span>
          </div>

          <p className="text-xs text-slate-500">
            Somete propuestas al análisis forense del Orquestador Senior. Verifica balance estricto, directivas especiales y sellado pericial.
          </p>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              onClick={() => handleTestSupervisor('CORRECT')}
              disabled={isTestingSupervisor}
              className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded text-xs font-medium transition"
            >
              Test Propuesta Válida
            </button>
            <button
              onClick={() => handleTestSupervisor('ERROR_DESCUADRE')}
              disabled={isTestingSupervisor}
              className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded text-xs font-medium transition"
            >
              Test Descuadre ($10)
            </button>
            <button
              onClick={() => handleTestSupervisor('ERROR_CLOUD')}
              disabled={isTestingSupervisor}
              className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded text-xs font-medium transition"
            >
              Test Infringe Directiva Cloud
            </button>
          </div>

          {supervisorVerdict && (
            <div
              className={`p-3 rounded-lg border text-xs space-y-2 font-mono ${
                supervisorVerdict.aprobado
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              <div className="flex items-center justify-between font-bold">
                <span className="flex items-center space-x-1.5">
                  {supervisorVerdict.aprobado ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                  )}
                  <span>{supervisorVerdict.diagnosticoDetallado}</span>
                </span>
                <span>{(supervisorVerdict.scoreConformidad * 100).toFixed(0)}% Score</span>
              </div>

              {supervisorVerdict.observaciones && (
                <ul className="list-disc pl-4 space-y-1 text-[11px]">
                  {supervisorVerdict.observaciones.map((obs: string, idx: number) => (
                    <li key={idx}>{obs}</li>
                  ))}
                </ul>
              )}

              {supervisorVerdict.firmaSupervisor && (
                <div className="pt-2 border-t border-emerald-200 text-[10px] text-emerald-800 break-all">
                  <strong>Firma Pericial HMAC:</strong> {supervisorVerdict.firmaSupervisor}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal: Registrar Nueva Lección Aprendida */}
      {isNewLearningModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Brain className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900">
                  Registrar Nueva Lección en Base de Conocimiento
                </h3>
              </div>
              <button
                onClick={() => setIsNewLearningModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateLearning} className="space-y-4 text-xs">
              <div>
                <label className="font-medium text-slate-700 block mb-1">Categoría del Incidente</label>
                <select
                  value={newLearningForm.categoria}
                  onChange={(e) =>
                    setNewLearningForm({ ...newLearningForm, categoria: e.target.value })
                  }
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="ERROR_IMPUTACION">ERROR_IMPUTACION (Cuenta o auxiliar incorrecto)</option>
                  <option value="DESCUADRE_PARTIDA_DOBLE">DESCUADRE_PARTIDA_DOBLE (Debe != Haber)</option>
                  <option value="NORMATIVA_SII">NORMATIVA_SII (Tasas, retenciones, plazos)</option>
                  <option value="RECHAZO_SUPERVISOR">RECHAZO_SUPERVISOR (Falla en control interno)</option>
                  <option value="PREFERENCIA_CLIENTE">PREFERENCIA_CLIENTE (Directiva ad-hoc ignorada)</option>
                </select>
              </div>

              <div>
                <label className="font-medium text-slate-700 block mb-1">Descripción del Error</label>
                <textarea
                  rows={3}
                  required
                  value={newLearningForm.error}
                  onChange={(e) =>
                    setNewLearningForm({ ...newLearningForm, error: e.target.value })
                  }
                  placeholder="Ej: El agente imputó retención de honorarios al 13.75% en 2026."
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-medium text-slate-700 block mb-1">Solución Obligatoria (Regla Mandatoria)</label>
                <textarea
                  rows={3}
                  required
                  value={newLearningForm.solucion}
                  onChange={(e) =>
                    setNewLearningForm({ ...newLearningForm, solucion: e.target.value })
                  }
                  placeholder="Ej: Bajo la Ley 21.133, a partir del 1 de enero de 2026 la tasa de retención es estrictamente del 14.50%."
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewLearningModalOpen(false)}
                  className="px-3 py-2 border border-slate-200 text-slate-600 rounded-lg font-medium hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition shadow-sm"
                >
                  Guardar Lección
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
