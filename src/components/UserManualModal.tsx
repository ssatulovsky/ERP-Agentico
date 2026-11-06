import React, { useState } from 'react';
import {
  BookOpen,
  X,
  Search,
  CheckCircle2,
  Building2,
  Sliders,
  Receipt,
  Landmark,
  FileSpreadsheet,
  UserCheck,
  Users,
  Boxes,
  Factory,
  TrendingUp,
  Home,
  Scale,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Copy,
  Check,
  HelpCircle,
} from 'lucide-react';

interface UserManualModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToTab: (tabId: string) => void;
}

export const UserManualModal: React.FC<UserManualModalProps> = ({
  isOpen,
  onClose,
  onNavigateToTab,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSection, setSelectedSection] = useState<'onboarding' | 'pdc' | 'modules' | 'sandbox'>('onboarding');
  const [copiedText, setCopiedText] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const sections = [
    { id: 'onboarding', label: '1. Onboarding & Clientes', icon: Building2, desc: 'Alta de empresa, RUT, Régimen SII y Claves' },
    { id: 'pdc', label: '2. Plan de Cuentas & Parámetros', icon: Sliders, desc: 'PDC IFRS, 11 atributos y Art. 16 C.T.' },
    { id: 'modules', label: '3. Guía por Módulos', icon: BookOpen, desc: 'Instrucciones operativas de los 12 módulos' },
    { id: 'sandbox', label: '4. Casuística Real de Pruebas', icon: Scale, desc: 'Paso a paso para probar el circuito completo' },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-[#0f172a] text-white border-b-2 border-blue-600 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center font-black text-white shadow-md">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Manual de Usuario & Guía de Operación
                </h2>
                <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 border border-blue-400/30 rounded text-[10px] font-mono font-bold uppercase">
                  Audicón ERP v2.6
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Instrucciones paso a paso para enfrentar el sistema, configurar clientes, activar cuentas y probar casuística real
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Cerrar Manual"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Section Tabs & Search */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            {sections.map((sec) => {
              const Icon = sec.icon;
              const isActive = selectedSection === sec.id;
              return (
                <button
                  key={sec.id}
                  onClick={() => setSelectedSection(sec.id as any)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-blue-600'}`} />
                  <span>{sec.label}</span>
                </button>
              );
            })}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar en el manual (ej: F29, DTE, PDC)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg pl-8 pr-3 py-1 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Modal Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-slate-800 text-xs sm:text-sm">
          {/* SECTION 1: ONBOARDING & CLIENTES */}
          {selectedSection === 'onboarding' && (
            <div className="space-y-5">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-bold text-blue-950 text-base mb-1 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-700" />
                  Paso 1: ¿Cómo enfrentar la plataforma y dar de alta un Cliente desde 0?
                </h3>
                <p className="text-slate-700 text-xs leading-relaxed">
                  El sistema funciona bajo arquitectura <strong>Multi-Empresa / Estudio Contable</strong>. En la esquina superior izquierda verás la empresa activa. Para ingresar una nueva empresa cliente o modificar la existente:
                </p>
              </div>

              {/* Steps Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-slate-200 rounded-lg p-4 bg-white shadow-xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-slate-900 flex items-center gap-2">
                      <span className="w-5 h-5 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-mono">1</span>
                      Acceder a "Agentes & Clientes"
                    </span>
                    <button
                      onClick={() => { onNavigateToTab('agents'); onClose(); }}
                      className="text-[11px] text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      Ir ahora <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                  <p className="text-slate-600 text-xs">
                    Haz clic en la pestaña <strong>"Agentes & Clientes"</strong> del menú lateral o en el botón <strong>"Configuración Agentes & SII"</strong> de la barra superior.
                  </p>
                </div>

                <div className="border border-slate-200 rounded-lg p-4 bg-white shadow-xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-slate-900 flex items-center gap-2">
                      <span className="w-5 h-5 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-mono">2</span>
                      Abrir modal "+ Nuevo Cliente Ancla"
                    </span>
                  </div>
                  <p className="text-slate-600 text-xs">
                    En la barra de herramientas superior de color pizarra, haz clic en el botón con borde azul <strong>"+ Nuevo Cliente Ancla"</strong> para desplegar la ficha maestra.
                  </p>
                </div>
              </div>

              {/* Data dictionary table */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 font-bold text-xs text-slate-800 flex items-center justify-between">
                  <span>Campos Mandatorios y Reglas de Negocio Tributarias</span>
                  <span className="text-slate-500 font-mono text-[11px]">Validación Módulo 11 SII</span>
                </div>
                <div className="divide-y divide-slate-200 text-xs">
                  <div className="p-3 bg-white grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="font-mono font-bold text-blue-800">RUT Empresa (con DV)</div>
                    <div className="sm:col-span-2 text-slate-700">
                      RUT chileno válido (ej. <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">76.543.210-K</code>). El sistema valida automáticamente el dígito verificador matemático según algoritmo de la Tesorería General y SII.
                    </div>
                  </div>
                  <div className="p-3 bg-white grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="font-mono font-bold text-blue-800">Régimen Tributario</div>
                    <div className="sm:col-span-2 text-slate-700">
                      <strong>14 D3 (ProPyme General)</strong> o <strong>14 A (Semi-Integrado)</strong>. Define si la depreciación es instantánea o acelerada, y las tasas base de PPM aplicables en el motor del F29.
                    </div>
                  </div>
                  <div className="p-3 bg-white grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="font-mono font-bold text-blue-800">Tasa PPM Obligatoria (%)</div>
                    <div className="sm:col-span-2 text-slate-700">
                      Porcentaje de Pago Provisional Mensual sobre ventas netas (ej: <strong>0.25%</strong> para ProPymes en sus primeros años, o <strong>1.00% / 1.50%</strong> para Régimen General).
                    </div>
                  </div>
                  <div className="p-3 bg-white grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="font-mono font-bold text-blue-800">Clave Tributaria / Certificado</div>
                    <div className="sm:col-span-2 text-slate-700">
                      Clave de acceso al portal tributario y certificado digital (.pfx) que habilita al asistente con herramientas para sincronizar en tiempo real el RCV (Registro de Compras y Ventas).
                    </div>
                  </div>
                  <div className="p-3 bg-white grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="font-mono font-bold text-blue-800">Giro & Códigos Actividad</div>
                    <div className="sm:col-span-2 text-slate-700">
                      Actividad económica principal según tabla SII (ej. 620100 para software, 461000 comercio). Afecta el cálculo de exención o afectación a IVA.
                    </div>
                  </div>
                </div>
              </div>

              {/* Sample Data Card */}
              <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-3 text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-amber-900 flex items-center gap-1.5">
                    <Copy className="w-3.5 h-3.5 text-amber-700" />
                    Datos de Ejemplo Rápido para Crear un Cliente de Prueba:
                  </span>
                  <button
                    onClick={() => handleCopy('RUT: 76.892.450-3\nRazón Social: Acuícola y Servicios Marinos Austral SpA\nNombre Fantasía: Mar Austral\nGiro: Cultivo y cosecha de recursos marinos\nRégimen: 14D3_PROPYME_GENERAL\nTasa PPM: 0.25%')}
                    className="text-[11px] text-amber-800 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {copiedText ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    {copiedText ? 'Copiado' : 'Copiar datos'}
                  </button>
                </div>
                <p className="text-amber-800 font-mono text-[11px]">
                  RUT: 76.892.450-3 | Razón: Acuícola y Servicios Marinos Austral SpA | Régimen: 14 D3 | PPM: 0.25%
                </p>
              </div>
            </div>
          )}

          {/* SECTION 2: PDC & PARAMETROS */}
          {selectedSection === 'pdc' && (
            <div className="space-y-5">
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                <h3 className="font-bold text-indigo-950 text-base mb-1 flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-indigo-700" />
                  Paso 2: ¿Cómo Activar un Plan de Cuentas (PDC) y Configurar Parámetros?
                </h3>
                <p className="text-slate-700 text-xs leading-relaxed">
                  El Plan de Cuentas opera bajo <strong>norma IFRS y codificación jerárquica de 5 niveles</strong> (ej: <code>1.1.01.001</code>). Cada cuenta tiene atributos de control que impiden errores de imputación contable.
                </p>
              </div>

              {/* Instructions to open modal */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-slate-200 rounded-lg p-4 bg-white shadow-xs">
                  <h4 className="font-bold text-slate-900 mb-1 flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-blue-600" />
                    1. Catálogo IFRS (PDC)
                  </h4>
                  <p className="text-slate-600 text-xs leading-relaxed mb-2">
                    En <strong>Agentes & Clientes</strong>, haz clic en el botón <strong>"Plan de Cuentas (PDC)"</strong>. Podrás ver la jerarquía completa: Activos, Pasivos, Patrimonio, Ingresos y Costos/Gastos.
                  </p>
                  <div className="bg-slate-100 p-2 rounded text-[11px] font-mono text-slate-700">
                    Nivel 1: 1 (Activo) → Nivel 2: 1.1 (Activo Corriente) → Nivel 3: 1.1.01 (Efectivo) → Nivel 5: 1.1.01.001 (Banco Estado CLP)
                  </div>
                </div>

                <div className="border border-slate-200 rounded-lg p-4 bg-white shadow-xs">
                  <h4 className="font-bold text-slate-900 mb-1 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    2. Los 11 Atributos de Imputación
                  </h4>
                  <p className="text-slate-600 text-xs leading-relaxed">
                    Al crear o editar una cuenta imputable, activa los switches según su naturaleza:
                  </p>
                  <ul className="text-xs text-slate-700 space-y-1 mt-1 font-mono">
                    <li>• <strong>Auxiliar</strong>: Exige RUT de cliente o proveedor (ej. Clientes Nacionales).</li>
                    <li>• <strong>DocRef</strong>: Exige número de factura, fecha y tipo DTE.</li>
                    <li>• <strong>Centro de Costos</strong>: Obligatorio para cuentas de gastos clase 5.</li>
                    <li>• <strong>Conciliación</strong>: Permite cuadratura con cartolas bancarias.</li>
                  </ul>
                </div>
              </div>

              {/* General ERP & Article 16 Parameters */}
              <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-blue-700" />
                  Parámetros Generales de Sistema & Art. 16 Código Tributario
                </h4>
                <p className="text-slate-600 text-xs mb-3">
                  Para que las centralizaciones automáticas cuadren al peso y el cierre de balance sea perfecto, revisa el modal <strong>"Parámetros Generales"</strong>:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="bg-white p-2.5 rounded border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">Ajuste por Sencillo:</span>
                    <span className="font-mono font-bold text-slate-800">5.2.09.099</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Absorbe diferencias de centavos</span>
                  </div>
                  <div className="bg-white p-2.5 rounded border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">Resultado del Ejercicio:</span>
                    <span className="font-mono font-bold text-slate-800">3.3.02.001</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Cierre cuentas clase 4 y 5</span>
                  </div>
                  <div className="bg-white p-2.5 rounded border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">Dif. Cambio Ganancia:</span>
                    <span className="font-mono font-bold text-slate-800">4.2.01.005</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Fluctuaciones USD/UF</span>
                  </div>
                  <div className="bg-white p-2.5 rounded border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">Fecha Cierre Anual:</span>
                    <span className="font-mono font-bold text-slate-800">31 de Diciembre</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Art. 16 Cód. Tributario</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 3: GUIA POR MODULOS */}
          {selectedSection === 'modules' && (
            <div className="space-y-4">
              <div className="bg-slate-100 border border-slate-200 rounded-lg p-3">
                <h3 className="font-bold text-slate-900 text-sm mb-1 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-blue-600" />
                  Operación y Funcionalidad de los 12 Módulos
                </h3>
                <p className="text-slate-600 text-xs">
                  Haz clic en cualquier módulo para navegar directamente a él y revisar su casuística:
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* RCV */}
                <div className="border border-slate-200 rounded-lg p-3 bg-white hover:border-blue-400 transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                      <Receipt className="w-4 h-4 text-blue-600" />
                      Registro Compras y Ventas (RCV)
                    </span>
                    <button
                      onClick={() => { onNavigateToTab('rcv'); onClose(); }}
                      className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-bold hover:bg-blue-100 cursor-pointer"
                    >
                      Abrir
                    </button>
                  </div>
                  <p className="text-slate-600 text-[11px] leading-tight mb-2">
                    Gestiona facturas electrónicas (DTE 33), exentas (34), notas de crédito (61) y boletas de honorarios (BHE).
                  </p>
                  <div className="bg-slate-50 p-2 rounded text-[10px] text-slate-700 space-y-0.5">
                    <div>• <strong>Acuse de Recibo Ley 19.983:</strong> Otorga acuse comercial en los 8 días para validar Crédito Fiscal IVA.</div>
                    <div>• <strong>Carga Manual o XML:</strong> Usa el botón "+ Registro Manual" para simular facturas emitidas y recibidas.</div>
                  </div>
                </div>

                {/* Conciliación Bancaria */}
                <div className="border border-slate-200 rounded-lg p-3 bg-white hover:border-blue-400 transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                      <Landmark className="w-4 h-4 text-emerald-600" />
                      Conciliación Bancaria
                    </span>
                    <button
                      onClick={() => { onNavigateToTab('reconciliation'); onClose(); }}
                      className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-bold hover:bg-emerald-100 cursor-pointer"
                    >
                      Abrir
                    </button>
                  </div>
                  <p className="text-slate-600 text-[11px] leading-tight mb-2">
                    Carga cartolas de Banco de Chile, Santander, BCI o BancoEstado y compáralas con el Libro Mayor de Bancos.
                  </p>
                  <div className="bg-slate-50 p-2 rounded text-[10px] text-slate-700 space-y-0.5">
                    <div>• <strong>Match 1 a 1:</strong> Concilia un movimiento bancario con una factura de compra o venta exacta.</div>
                    <div>• <strong>Novedades & Comisiones:</strong> Genera asientos automáticos para gastos bancarios no registrados.</div>
                  </div>
                </div>

                {/* Motor F29 */}
                <div className="border border-slate-200 rounded-lg p-3 bg-white hover:border-blue-400 transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                      <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
                      Agente Fiscal F29 & SII
                    </span>
                    <button
                      onClick={() => { onNavigateToTab('f29'); onClose(); }}
                      className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-bold hover:bg-indigo-100 cursor-pointer"
                    >
                      Abrir
                    </button>
                  </div>
                  <p className="text-slate-600 text-[11px] leading-tight mb-2">
                    Liquidador automático del Formulario 29 del SII según normativa de la Ley de IVA y Renta.
                  </p>
                  <div className="bg-slate-50 p-2 rounded text-[10px] text-slate-700 space-y-0.5">
                    <div>• <strong>Cálculo IVA Neto:</strong> Débito Fiscal menos Crédito Fiscal y remanente histórico con UTM.</div>
                    <div>• <strong>PPM & Postergación:</strong> Aplica tasa sobre ventas y botón de postergación de IVA a 60 días (Ley 20.780).</div>
                  </div>
                </div>

                {/* RRHH & Karin */}
                <div className="border border-slate-200 rounded-lg p-3 bg-white hover:border-blue-400 transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                      <UserCheck className="w-4 h-4 text-purple-600" />
                      Agente RRHH & Ley Karin
                    </span>
                    <button
                      onClick={() => { onNavigateToTab('hr_agent'); onClose(); }}
                      className="text-[10px] bg-purple-50 text-purple-700 px-2 py-0.5 rounded font-bold hover:bg-purple-100 cursor-pointer"
                    >
                      Abrir
                    </button>
                  </div>
                  <p className="text-slate-600 text-[11px] leading-tight mb-2">
                    Cumplimiento laboral: contratos (Art. 10), vacaciones, finiquitos (Art. 161) y protocolo Ley Karin N° 21.643.
                  </p>
                  <div className="bg-slate-50 p-2 rounded text-[10px] text-slate-700 space-y-0.5">
                    <div>• <strong>Canal de Denuncias:</strong> Registro confidencial con medidas de resguardo y bitácora de investigación.</div>
                    <div>• <strong>Simulador Finiquitos:</strong> Cálculo de indemnizaciones por años de servicio y feriado proporcional.</div>
                  </div>
                </div>

                {/* Remuneraciones */}
                <div className="border border-slate-200 rounded-lg p-3 bg-white hover:border-blue-400 transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                      <Users className="w-4 h-4 text-sky-600" />
                      Remuneraciones & Nómina DT
                    </span>
                    <button
                      onClick={() => { onNavigateToTab('payroll'); onClose(); }}
                      className="text-[10px] bg-sky-50 text-sky-700 px-2 py-0.5 rounded font-bold hover:bg-sky-100 cursor-pointer"
                    >
                      Abrir
                    </button>
                  </div>
                  <p className="text-slate-600 text-[11px] leading-tight mb-2">
                    Nómina con topes imponibles chilenos 2026 (90.0 UF para AFP/Salud, 135.2 UF para AFC y 1.0% aporte patronal Ley 21.735).
                  </p>
                  <div className="bg-slate-50 p-2 rounded text-[10px] text-slate-700 space-y-0.5">
                    <div>• <strong>Gratificación Art. 50:</strong> 25% del sueldo con tope de 4.75 ingresos mínimos mensuales.</div>
                    <div>• <strong>Centralización LRE:</strong> Genera asiento contable automático con pasivos de Previred e imposiciones.</div>
                  </div>
                </div>

                {/* Inventario WMS */}
                <div className="border border-slate-200 rounded-lg p-3 bg-white hover:border-blue-400 transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                      <Boxes className="w-4 h-4 text-amber-600" />
                      Inventario & Bodegas (WMS)
                    </span>
                    <button
                      onClick={() => { onNavigateToTab('inventory'); onClose(); }}
                      className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded font-bold hover:bg-amber-100 cursor-pointer"
                    >
                      Abrir
                    </button>
                  </div>
                  <p className="text-slate-600 text-[11px] leading-tight mb-2">
                    Múltiples bodegas, alertas de quiebre de stock, Kardex valorizado bajo método PMP y Guías de Despacho (DTE 52).
                  </p>
                  <div className="bg-slate-50 p-2 rounded text-[10px] text-slate-700 space-y-0.5">
                    <div>• <strong>Transferencias Internas:</strong> Traslado de insumos entre bodegas con asignación de costo.</div>
                    <div>• <strong>Consumo a Producción:</strong> Integración directa con órdenes de fabricación.</div>
                  </div>
                </div>

                {/* Agente Contable Senior & Cierre */}
                <div className="border border-slate-200 rounded-lg p-3 bg-white hover:border-blue-400 transition-colors md:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                      <Scale className="w-4 h-4 text-rose-600" />
                      Agente Contable Senior, Balance 8 Columnas & Cierre de Ejercicio
                    </span>
                    <button
                      onClick={() => { onNavigateToTab('ledger'); onClose(); }}
                      className="text-[10px] bg-rose-50 text-rose-700 px-2 py-0.5 rounded font-bold hover:bg-rose-100 cursor-pointer"
                    >
                      Abrir
                    </button>
                  </div>
                  <p className="text-slate-600 text-[11px] leading-tight mb-2">
                    El corazón del sistema: Libro Diario, Libro Mayor, Balance Tributario IFRS, Cierre Anual y Auditoría Continua.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px] text-slate-700">
                    <div className="bg-slate-50 p-2 rounded">
                      <strong>Asientos Manuales:</strong> Permite ingresar comprobantes de ajuste con validación estricta de partida doble.
                    </div>
                    <div className="bg-slate-50 p-2 rounded">
                      <strong>Balance 8 Columnas:</strong> Columnas Tributarias y Financieras con cálculo automático de utilidad/pérdida.
                    </div>
                    <div className="bg-slate-50 p-2 rounded">
                      <strong>Cierre de Ejercicio:</strong> Bloquea períodos cerrados y cancela cuentas de resultado al 31 de Diciembre.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 4: SANDBOX / CASUISTICA REAL */}
          {selectedSection === 'sandbox' && (
            <div className="space-y-5">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <h3 className="font-bold text-emerald-950 text-base mb-1 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  Paso a Paso: Secuencia Recomendada para Probar Casuística Real
                </h3>
                <p className="text-slate-700 text-xs leading-relaxed">
                  Sigue esta secuencia de 5 pasos para verificar el ciclo contable y tributario completo sin errores:
                </p>
              </div>

              <div className="space-y-3">
                <div className="border border-slate-200 rounded-lg p-3 bg-white flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-xs shrink-0 font-mono mt-0.5">
                    1
                  </div>
                  <div className="flex-1 text-xs">
                    <div className="flex items-center justify-between">
                      <strong className="text-slate-900 text-sm">Selecciona o Crea un Cliente</strong>
                      <span className="text-[10px] font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">Dropdown Superior</span>
                    </div>
                    <p className="text-slate-600 mt-1">
                      Usa el selector superior y elige <strong>"Mar Austral SpA"</strong> (o tu nuevo cliente creado). Nota cómo la tasa de PPM, indicadores y régimen cambian instantáneamente en toda la aplicación.
                    </p>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-lg p-3 bg-white flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-xs shrink-0 font-mono mt-0.5">
                    2
                  </div>
                  <div className="flex-1 text-xs">
                    <div className="flex items-center justify-between">
                      <strong className="text-slate-900 text-sm">Registra una Venta y una Compra en el RCV</strong>
                      <button
                        onClick={() => { onNavigateToTab('rcv'); onClose(); }}
                        className="text-[10px] text-blue-600 font-bold hover:underline"
                      >
                        Ir al RCV →
                      </button>
                    </div>
                    <p className="text-slate-600 mt-1">
                      En la pestaña <strong>Registro Compras/Ventas</strong>, haz clic en <strong>"+ Registro Manual de DTE"</strong>. Crea una Factura de Venta (DTE 33) por $10.000.000 + IVA ($1.900.000). Observa cómo se centraliza automáticamente al Libro Diario.
                    </p>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-lg p-3 bg-white flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-xs shrink-0 font-mono mt-0.5">
                    3
                  </div>
                  <div className="flex-1 text-xs">
                    <div className="flex items-center justify-between">
                      <strong className="text-slate-900 text-sm">Concilia el Abono Bancario</strong>
                      <button
                        onClick={() => { onNavigateToTab('reconciliation'); onClose(); }}
                        className="text-[10px] text-emerald-600 font-bold hover:underline"
                      >
                        Ir a Conciliación →
                      </button>
                    </div>
                    <p className="text-slate-600 mt-1">
                      Ve a <strong>Conciliación Bancaria</strong>. Observa el abono de $11.900.000 en la cartola bancaria. Haz clic en <strong>"Conciliar"</strong> para cruzar el movimiento bancario con la factura emitida. El estado pasará a "CONCILIADO".
                    </p>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-lg p-3 bg-white flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-xs shrink-0 font-mono mt-0.5">
                    4
                  </div>
                  <div className="flex-1 text-xs">
                    <div className="flex items-center justify-between">
                      <strong className="text-slate-900 text-sm">Audita la Propuesta del F29 y Centralízala</strong>
                      <button
                        onClick={() => { onNavigateToTab('f29'); onClose(); }}
                        className="text-[10px] text-indigo-600 font-bold hover:underline"
                      >
                        Ir al F29 →
                      </button>
                    </div>
                    <p className="text-slate-600 mt-1">
                      Ve a <strong>Agente Fiscal F29</strong>. Revisa la casilla de Débito Fiscal ($1.900.000), el cálculo del PPM (ej. 1% = $100.000) y pulsa <strong>"Generar Asiento Centralización F29"</strong> para enviar el compromiso tributario al Libro Diario.
                    </p>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-lg p-3 bg-white flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-xs shrink-0 font-mono mt-0.5">
                    5
                  </div>
                  <div className="flex-1 text-xs">
                    <div className="flex items-center justify-between">
                      <strong className="text-slate-900 text-sm">Inspecciona el Balance de 8 Columnas y Cierre Anual</strong>
                      <button
                        onClick={() => { onNavigateToTab('ledger'); onClose(); }}
                        className="text-[10px] text-rose-600 font-bold hover:underline"
                      >
                        Ir al Núcleo ERP →
                      </button>
                    </div>
                    <p className="text-slate-600 mt-1">
                      En <strong>Agente Contable Senior</strong>, revisa la pestaña <strong>"Balance Tributario IFRS"</strong>. Verifica que la suma de Débitos y Créditos esté cuadrada al peso, y explora el submódulo <strong>"Cierre de Ejercicio"</strong> para simular el cierre de año contable.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Normativa Vigente: SII Chilenos, Código Tributario Art. 16, Ley Karin 21.643 y NIC/NIIF.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
          >
            Entendido, volver a la aplicación
          </button>
        </div>
      </div>
    </div>
  );
};
