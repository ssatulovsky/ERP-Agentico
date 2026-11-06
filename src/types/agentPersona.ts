export type AgentGender = 'FEMENINO' | 'MASCULINO' | 'NEUTRO';

export type AgentModuleArea = 
  | 'AGENTE_GENERAL_VERA'
  | 'CONTABILIDAD_SENIOR'
  | 'TRIBUTARIO_F29'
  | 'TESORERIA_BANCOS'
  | 'FACTURACION_DTE'
  | 'RRHH_PERSONAS'
  | 'BODEGA_INVENTARIO'
  | 'PRODUCCION_COSTOS'
  | 'ACTIVO_FIJO'
  | 'RENDICION_GASTOS'
  | 'COMERCIAL_APROVISIONAMIENTO';

export interface AgentVoiceConfig {
  voiceURI?: string;
  voiceName?: string;
  lang: string;
  pitch: number;  // 0.5 a 1.8 (ej: 1.15 para voces femeninas, 0.9 para masculinas)
  rate: number;   // 0.7 a 1.4 (1.0 normal)
  volume: number; // 0 a 1.0
  neuralModel?: 'gemini' | 'piper' | 'browser'; // Motor de voz: Gemini Ultra-Natural, Piper VITS o Navegador
  geminiVoiceName?: 'Aoede' | 'Fenrir' | 'Kore' | 'Puck' | 'Charon' | string;
  piperVoiceId?: 'es_AR-daniela-high' | 'es_MX-ald-medium' | 'es_ES-sharvard-medium' | 'es_ES-davefx-medium' | 'es_ES-carlfm-x_low' | string;
}

export interface CashflowScenarioItem {
  tipo: 'INGRESO' | 'EGRESO';
  entidad: string;
  folio?: string;
  monto: number;
  fechaOriginal: string;
  fechaSimulada: string;
  diasDiferencia: number;
  motivo: string;
}

export interface CashflowScenarioResult {
  id: string;
  titulo: string;
  saldoInicialCaja: number;
  ingresosBase: number;
  ingresosSimulados: number;
  egresosBase: number;
  egresosSimulados: number;
  saldoFinalBase: number;
  saldoFinalSimulado: number;
  variacionNeta: number;
  itemsAfectados: CashflowScenarioItem[];
  whatsappSummaryText: string;
  fechaCalculo: string;
}

export interface AgentSuggestedAction {
  id: string;
  label: string;
  prompt: string;
  categoria: 'CONSULTA' | 'EJECUCION' | 'AUDITORIA';
  icon?: string;
  targetTab?: string;
}

export interface AgentPersona {
  id: AgentModuleArea;
  nombre: string;
  sexo: AgentGender;
  cargo: string;
  area: string;
  color: string;
  avatarBg: string;
  avatarText: string;
  avatarUrl?: string;
  descripcion: string;
  saludoPersonal: string;
  voz: AgentVoiceConfig;
  accionesSugeridas: AgentSuggestedAction[];
  isExecutiveGeneral?: boolean;
}
