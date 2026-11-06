/**
 * Política de simulación de DTE (tarea 1.4 del plan de corrección).
 *
 * La simulación offline (timbre SIMULATED_TED_KEY_OK y certificado de demostración) solo se admite
 * cuando ALLOW_OFFLINE_DTE_SIMULATION=true, fuera de producción y fuera del ambiente SII de producción.
 * Un DTE simulado se guarda con estado SIMULADO y nunca cuenta para el libro de ventas ni el F29.
 */

export const SIMULATED_TED_SIGNATURE = 'SIMULATED_TED_KEY_OK';

const isProductionRuntime = () => (process.env.NODE_ENV || '').trim().toLowerCase() === 'production';
const isSiiProductionAmbiente = () => Number(process.env.DTE_AMBIENTE) === 2;
const simulationFlag = () => (process.env.ALLOW_OFFLINE_DTE_SIMULATION || '').trim().toLowerCase() === 'true';

export function isOfflineDteSimulationAllowed(): boolean {
  return simulationFlag() && !isProductionRuntime() && !isSiiProductionAmbiente();
}

/**
 * Se invoca al arrancar el servidor. Con NODE_ENV=production o DTE_AMBIENTE=2 y la simulación
 * activada, el servidor no arranca.
 */
export function assertDteSimulationPolicy(): void {
  if (!simulationFlag()) return;
  if (isProductionRuntime()) {
    throw new Error(
      'Configuración inválida: ALLOW_OFFLINE_DTE_SIMULATION=true no está permitido con NODE_ENV=production. ' +
        'Desactive la simulación de DTE para iniciar el servidor.'
    );
  }
  if (isSiiProductionAmbiente()) {
    throw new Error(
      'Configuración inválida: ALLOW_OFFLINE_DTE_SIMULATION=true no está permitido con DTE_AMBIENTE=2 (producción SII).'
    );
  }
}

/** Un DTE simulado (o con timbre simulado) no tiene validez tributaria. */
export function isSimulatedDte(d: { estadoSii?: string; tedXml?: string } | null | undefined): boolean {
  if (!d) return false;
  return d.estadoSii === 'SIMULADO' || Boolean(d.tedXml && d.tedXml.includes(SIMULATED_TED_SIGNATURE));
}
