export type AgentGender = 'FEMENINO' | 'MASCULINO' | 'NEUTRO';

export type AgentModuleArea = 
  | 'CONTABILIDAD_SENIOR'
  | 'TRIBUTARIO_F29'
  | 'TESORERIA_BANCOS'
  | 'FACTURACION_DTE'
  | 'RRHH_PERSONAS'
  | 'BODEGA_INVENTARIO'
  | 'PRODUCCION_COSTOS'
  | 'ACTIVO_FIJO'
  | 'RENDICION_GASTOS';

export interface AgentVoiceConfig {
  voiceURI?: string;
  voiceName?: string;
  lang: string;
  pitch: number;  // 0.5 a 1.8 (ej: 1.15 para voces femeninas, 0.9 para masculinas)
  rate: number;   // 0.7 a 1.4 (1.0 normal)
  volume: number; // 0 a 1.0
}

export interface AgentSuggestedAction {
  id: string;
  label: string;
  prompt: string;
  categoria: 'CONSULTA' | 'EJECUCION' | 'AUDITORIA';
  icon?: string;
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
}
