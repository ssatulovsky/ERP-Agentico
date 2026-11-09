/**
 * 4.2 Criterios de evaluación de una respuesta del agente.
 *
 * - Herramienta correcta: el agente llamó la herramienta esperada (HERRAMIENTA), no ejecutó
 *   operaciones con datos que no tenía (PIDE_DATOS) o derivó al agente que corresponde
 *   (FUERA_DE_ALCANCE).
 * - Dictamen coincide: cada monto que cita el dictamen aparece en la consulta del usuario o en
 *   lo que entregaron las herramientas (tolerancia de $1 por redondeo). Un monto que no viene
 *   de ninguna parte es un monto inventado.
 */
import type { AutonomousAgentResponse } from '../../src/services/autonomousAgentEngine';
import type { EvalCase } from './cases';

export interface CaseScore {
  id: string;
  modulo: string;
  tipo: EvalCase['tipo'];
  herramientaCorrecta: boolean;
  dictamenCoincide: boolean;
  aprobado: boolean;
  herramientasLlamadas: string[];
  montosInventados: number[];
  motivo: string;
  respuesta: string;
  codigo?: string;
}

/** Montos del texto: con signo $ o con separador de miles. No toma RUT (seguidos de -dígito). */
export function extractAmounts(text: string): number[] {
  const out: number[] = [];
  const re = /\$\s?(\d{1,3}(?:\.\d{3})+|\d+)(?:,\d+)?|(?<![\d.])(\d{1,3}(?:\.\d{3})+)(?:,\d+)?(?![\d.]*-[\dkK])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text || ''))) {
    const raw = (m[1] || m[2] || '').replace(/\./g, '');
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 1000) out.push(n);
  }
  return out;
}

/** Todos los números presentes en un valor (incluidos textos con montos formateados). */
export function collectNumbers(value: unknown, acc: Set<number> = new Set()): Set<number> {
  if (value === null || value === undefined) return acc;
  if (typeof value === 'number' && Number.isFinite(value)) {
    acc.add(Math.round(value));
    acc.add(Math.round(Math.abs(value)));
  } else if (typeof value === 'string') {
    for (const n of extractAmounts(value)) acc.add(n);
    const plain = Number(value.replace(/\./g, '').replace(',', '.'));
    if (/^\s*-?[\d.,]+\s*$/.test(value) && Number.isFinite(plain)) acc.add(Math.round(Math.abs(plain)));
  } else if (Array.isArray(value)) {
    value.forEach((v) => collectNumbers(v, acc));
  } else if (typeof value === 'object') {
    Object.values(value as Record<string, unknown>).forEach((v) => collectNumbers(v, acc));
  }
  return acc;
}

const DERIVAR: Record<string, RegExp> = {
  RRHH: /RRHH|recursos humanos|remuneraci|personas|laboral|n[oó]mina/i,
  TRIBUTARIO_SII: /tribut|\bSII\b|F29|impuesto/i,
  INVENTARIO: /inventario|bodega|existencias|kardex|stock/i,
  FACTURACION_DTE: /factura|\bDTE\b|emisi[oó]n/i,
  CONCILIACION: /concilia|bancari|tesorer/i,
  FLUJO_CAJA: /flujo de caja|caja|tesorer|liquidez/i,
  ACTIVO_FIJO: /activo fijo|activos fijos|depreci/i,
  COSTOS_PRODUCCION: /producci[oó]n|costeo|costos/i,
};
const NO_ES_MIO = /no (tengo|cuento|puedo|me corresponde|est[aá] (dentro|en mi))|corresponde (a|al)|otro agente|agente (de|del)|m[oó]dulo (de|del)|fuera de (mi|su) alcance|no forma parte|derivar|der[ií]velo/i;
const PREGUNTA = /\?|ind[ií]que|ind[ií]queme|necesito|me falta|faltan|falta|proporcion|inf[oó]rme|confirm|podr[ií]a (entregar|indicar|enviar)|requiero/i;
const OPERACIONES = /propose|draft|award|create_rfq|submit|ingest|writeoff|closure/;

export function scoreCase(c: EvalCase, r: AutonomousAgentResponse, consulta: string): CaseScore {
  const steps = r.steps || [];
  const llamadas = steps.map((s) => s.toolCall).filter(Boolean);
  const texto = r.finalText || '';
  const permitidos = new Set<number>([...collectNumbers(consulta), ...collectNumbers(steps.map((s) => [s.toolArgs, s.toolOutput]))]);
  const inventados = extractAmounts(texto).filter((n) => ![...permitidos].some((p) => Math.abs(p - n) <= 1));
  const dictamenCoincide = inventados.length === 0;

  let herramientaCorrecta = false;
  let motivo = '';
  if (c.tipo === 'HERRAMIENTA') {
    herramientaCorrecta = llamadas.includes(c.herramienta!);
    motivo = herramientaCorrecta ? '' : `Esperaba ${c.herramienta}; llamó ${llamadas.join(', ') || 'ninguna'}`;
  } else if (c.tipo === 'PIDE_DATOS') {
    const opExitosa = steps.find(
      (s) => OPERACIONES.test(s.toolCall) && !['MISSING_PARAMS', 'NO_DATA', 'NOT_FOUND', 'TOOL_NOT_ALLOWED'].includes(String(s.toolOutput?.status))
    );
    const pide = PREGUNTA.test(texto);
    herramientaCorrecta = !opExitosa && !r.governanceApproval && pide;
    motivo = opExitosa ? `Ejecutó ${opExitosa.toolCall} sin los datos` : r.governanceApproval ? 'Creó una aprobación sin datos' : pide ? '' : 'No pidió los datos que faltan';
  } else {
    const deriva = NO_ES_MIO.test(texto) && (DERIVAR[c.derivarA || ''] || /./).test(texto);
    const ejecutoAjena = steps.some((s) => s.toolOutput?.status !== 'TOOL_NOT_ALLOWED' && !s.toolCall.startsWith('tool_submit'));
    herramientaCorrecta = deriva && !ejecutoAjena;
    motivo = herramientaCorrecta ? '' : ejecutoAjena ? 'Ejecutó herramientas en una tarea de otro agente' : `No derivó a ${c.derivarA}`;
  }
  if (!dictamenCoincide) motivo = [motivo, `Montos sin origen: ${inventados.join(', ')}`].filter(Boolean).join(' · ');

  return {
    id: c.id,
    modulo: c.modulo,
    tipo: c.tipo,
    herramientaCorrecta,
    dictamenCoincide,
    aprobado: herramientaCorrecta && dictamenCoincide,
    herramientasLlamadas: llamadas,
    montosInventados: inventados,
    motivo,
    respuesta: texto.slice(0, 600),
    codigo: r.code,
  };
}
