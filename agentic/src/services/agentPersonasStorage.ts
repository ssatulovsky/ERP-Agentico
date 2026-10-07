import { AgentPersona, AgentVoiceConfig } from '../types/agentPersona';
import { DEFAULT_AGENT_PERSONAS } from '../data/defaultAgentPersonas';

const STORAGE_KEY_PREFIX = 'erp_agent_personas_v1';

export const agentPersonasStorage = {
  /**
   * Obtiene la lista de personas agénticas para la empresa o cliente activo
   */
  getPersonas(clientId: string = 'default'): AgentPersona[] {
    try {
      if (typeof window === 'undefined') return DEFAULT_AGENT_PERSONAS;
      const key = `${STORAGE_KEY_PREFIX}_${clientId}`;
      const saved = localStorage.getItem(key);
      if (!saved) return DEFAULT_AGENT_PERSONAS;

      const parsed: AgentPersona[] = JSON.parse(saved);
      // Garantizar que todos los 9 agentes existan (merge con los defaults por si se agregaron nuevos)
      return DEFAULT_AGENT_PERSONAS.map(def => {
        const found = parsed.find(p => p.id === def.id);
        if (!found) return def;

        const effectiveSex = found.sexo || def.sexo;
        // Si el agente es masculino y su pitch guardado era el antiguo (>= 0.75),
        // migrarlo automáticamente al nuevo perfil barítono para que no suene como mujer
        let pitch = found.voz?.pitch ?? def.voz.pitch;
        if (effectiveSex === 'MASCULINO' && pitch >= 0.75) {
          pitch = def.voz.pitch;
        }

        return {
          ...def,
          nombre: found.nombre || def.nombre,
          sexo: effectiveSex,
          cargo: found.cargo || def.cargo,
          saludoPersonal: found.saludoPersonal || def.saludoPersonal,
          voz: {
            ...def.voz,
            ...(found.voz || {}),
            pitch,
          },
        };
      });
    } catch (e) {
      console.warn('[agentPersonasStorage] Error cargando personas desde localStorage:', e);
      return DEFAULT_AGENT_PERSONAS;
    }
  },

  /**
   * Guarda la lista completa de personas para el cliente
   */
  saveAllPersonas(clientId: string = 'default', personas: AgentPersona[]): void {
    try {
      if (typeof window === 'undefined') return;
      const key = `${STORAGE_KEY_PREFIX}_${clientId}`;
      localStorage.setItem(key, JSON.stringify(personas));
    } catch (e) {
      console.error('[agentPersonasStorage] Error guardando personas:', e);
    }
  },

  /**
   * Actualiza una persona específica
   */
  updatePersona(clientId: string = 'default', updated: AgentPersona): AgentPersona[] {
    const list = this.getPersonas(clientId);
    const updatedList = list.map(p => (p.id === updated.id ? updated : p));
    this.saveAllPersonas(clientId, updatedList);
    return updatedList;
  },

  /**
   * Restablece las personas a los valores por defecto
   */
  resetToDefaults(clientId: string = 'default'): AgentPersona[] {
    try {
      if (typeof window !== 'undefined') {
        const key = `${STORAGE_KEY_PREFIX}_${clientId}`;
        localStorage.removeItem(key);
      }
    } catch (e) {
      console.warn('[agentPersonasStorage] Error reseteando:', e);
    }
    return DEFAULT_AGENT_PERSONAS;
  },
};
