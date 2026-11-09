/**
 * 4.2 Evaluación de los agentes con un LLM real (plan de corrección, fase 4).
 *
 * Uso:
 *   GEMINI_API_KEY=... npm run eval:llm                 # 240 consultas (20 por agente)
 *   GEMINI_API_KEY=... npm run eval:llm -- --modulo RRHH --limite 5
 *   npm run eval:llm -- --autoprueba                    # sin clave: valida datos, casos y criterios
 *
 * Mide, por consulta, si el agente eligió la herramienta correcta y si su dictamen solo cita
 * montos que entregaron las herramientas o el usuario. Umbral: 90 % de aciertos (EVAL_UMBRAL).
 * Deja un informe en evals/llm/resultados/ y termina con código 1 bajo el umbral.
 */
import fs from 'node:fs';
import path from 'node:path';
import { AutonomousAgentEngine, type AutonomousAgentRequest } from '../../src/services/autonomousAgentEngine';
import { MODULE_AGENTS_REGISTRY } from '../../src/services/moduleAgentGovernanceService';
import { aiRouterService } from '../../src/services/aiRouterService';
import { buildCases, fill, type EvalCase } from './cases';
import { scoreCase, extractAmounts, type CaseScore } from './scoring';
import { seedEvalCompany, removeEvalCompany, type EvalFixture } from './fixtures';

const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(`--${name}`);
const opt = (name: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const UMBRAL = Number(process.env.EVAL_UMBRAL || 0.9);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname));

const clp = (n: number) => `$${Math.round(n).toLocaleString('es-CL')}`;
const fnCall = (name: string, args: any) => ({ candidates: [{ content: { parts: [{ functionCall: { name, args } }] } }] });
const text = (t: string) => ({ candidates: [{ content: { parts: [{ text: t }] } }], text: t });

/**
 * Autoprueba: modelo oráculo que hace lo correcto en cada caso. Si no obtiene el 100 %, el problema
 * está en los datos de prueba o en los criterios, no en el modelo.
 */
function oracleModel(c: EvalCase, vars: Record<string, string>) {
  let turno = 0;
  return () => ({
    models: {
      generateContent: async (args: any) => {
        turno++;
        if (c.tipo === 'HERRAMIENTA' && turno === 1) return fnCall(c.herramienta!, fill(c.args || {}, vars));
        if (c.tipo === 'HERRAMIENTA') {
          const obs = args.contents.at(-1)?.parts?.[0]?.functionResponse?.response || {};
          const montos = extractAmounts(JSON.stringify(obs).replace(/"(\w+)":(\d{4,})/g, (_m: string, k: string, v: string) => `"${k}":"${clp(Number(v))}"`)).slice(0, 2);
          return text(`Resultado de ${c.herramienta}: ${obs.status}. ${montos.length ? `Cifras: ${montos.map(clp).join(' y ')}.` : ''}`);
        }
        if (c.tipo === 'PIDE_DATOS') return text('Para hacerlo necesito más datos. ¿Me indica el documento, el monto y la fecha?');
        return text(`Eso no me corresponde: lo resuelve el agente del módulo ${c.derivarA} (${derivarTexto(c.derivarA!)}).`);
      },
    },
  });
}

/** Autoprueba negativa: un modelo que inventa. Los criterios deben reprobarlo casi siempre. */
function inventorModel() {
  return () => ({ models: { generateContent: async () => text('Listo. El resultado es $4.247.668 y quedó registrado.') } });
}

function derivarTexto(m: string): string {
  return (
    {
      RRHH: 'RRHH y remuneraciones',
      TRIBUTARIO_SII: 'Tributario SII y F29',
      INVENTARIO: 'inventario y bodega',
      FACTURACION_DTE: 'facturación DTE',
      CONCILIACION: 'conciliación bancaria',
      FLUJO_CAJA: 'flujo de caja',
      ACTIVO_FIJO: 'activo fijo y depreciación',
      COSTOS_PRODUCCION: 'producción y costeo',
    } as Record<string, string>
  )[m] || m;
}

async function runCase(c: EvalCase, fx: EvalFixture, vars: Record<string, string>, validarDatos = false): Promise<CaseScore> {
  const agent = MODULE_AGENTS_REGISTRY.find((a) => a.moduloId === c.modulo)!;
  const consulta = fill(c.consulta, vars);
  const request: AutonomousAgentRequest = {
    empresaId: fx.empresaId,
    module: c.modulo,
    agentRole: `${agent.agenteNombre} - ${agent.agenteCargo}`,
    query: consulta,
    context: { selectedPeriod: undefined },
    userId: 'EVALUACION_LLM',
  };
  try {
    const r = await AutonomousAgentEngine.executeAutonomousAgentLoop(request);
    const score = scoreCase(c, r, consulta);
    // Autoprueba: la herramienta esperada debe encontrar los datos de prueba.
    const paso = (r.steps || []).find((st) => st.toolCall === c.herramienta);
    const st = String(paso?.toolOutput?.status || '');
    if (validarDatos && c.tipo === 'HERRAMIENTA' && /NO_DATA|NOT_FOUND|MISSING_PARAMS|ERROR|NOT_ALLOWED/.test(st)) {
      return { ...score, aprobado: false, herramientaCorrecta: false, motivo: `Datos de prueba: ${c.herramienta} respondió ${st} ${paso?.toolOutput?.mensaje || JSON.stringify(paso?.toolOutput?.faltantes || '')}` };
    }
    return score;
  } catch (e: any) {
    return {
      id: c.id, modulo: c.modulo, tipo: c.tipo, herramientaCorrecta: false, dictamenCoincide: false, aprobado: false,
      herramientasLlamadas: [], montosInventados: [], motivo: `Excepción: ${e?.message || e}`, respuesta: '',
    };
  }
}

function resumen(scores: CaseScore[]) {
  const pct = (a: number, b: number) => (b ? a / b : 0);
  const porModulo = new Map<string, CaseScore[]>();
  for (const s of scores) porModulo.set(s.modulo, [...(porModulo.get(s.modulo) || []), s]);
  return {
    total: scores.length,
    aprobados: scores.filter((s) => s.aprobado).length,
    aciertoHerramienta: pct(scores.filter((s) => s.herramientaCorrecta).length, scores.length),
    dictamenCoincide: pct(scores.filter((s) => s.dictamenCoincide).length, scores.length),
    acierto: pct(scores.filter((s) => s.aprobado).length, scores.length),
    porModulo: [...porModulo.entries()].map(([m, l]) => ({
      modulo: m,
      casos: l.length,
      acierto: pct(l.filter((s) => s.aprobado).length, l.length),
      herramienta: pct(l.filter((s) => s.herramientaCorrecta).length, l.length),
      dictamen: pct(l.filter((s) => s.dictamenCoincide).length, l.length),
    })),
  };
}

function informe(titulo: string, scores: CaseScore[], extra: string[]): string {
  const r = resumen(scores);
  const p = (x: number) => `${(x * 100).toFixed(1)} %`;
  const lines = [
    `# ${titulo}`,
    '',
    ...extra,
    '',
    `**Acierto total: ${p(r.acierto)}** (${r.aprobados} de ${r.total}) · umbral ${p(UMBRAL)} · ${r.acierto >= UMBRAL ? 'CUMPLE' : 'NO CUMPLE'}`,
    '',
    `Herramienta correcta: ${p(r.aciertoHerramienta)} · Dictamen sin montos inventados: ${p(r.dictamenCoincide)}`,
    '',
    '| Agente | Casos | Acierto | Herramienta | Dictamen |',
    '| --- | --- | --- | --- | --- |',
    ...r.porModulo.map((m) => `| ${m.modulo} | ${m.casos} | ${p(m.acierto)} | ${p(m.herramienta)} | ${p(m.dictamen)} |`),
    '',
    '## Casos reprobados',
    '',
    '| Caso | Tipo | Motivo | Herramientas | Respuesta (extracto) |',
    '| --- | --- | --- | --- | --- |',
    ...scores
      .filter((s) => !s.aprobado)
      .map((s) => `| ${s.id} | ${s.tipo} | ${s.motivo.replace(/\|/g, '/')} | ${s.herramientasLlamadas.join(', ')} | ${s.respuesta.replace(/\s+/g, ' ').replace(/\|/g, '/').slice(0, 160)} |`),
  ];
  return lines.join('\n') + '\n';
}

async function main() {
  const autoprueba = flag('autoprueba');
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!autoprueba && !apiKey) {
    console.error('4.2 requiere GEMINI_API_KEY (o use --autoprueba para validar el banco de casos sin modelo).');
    process.exit(2);
  }
  let cases = buildCases();
  if (opt('modulo')) cases = cases.filter((c) => c.modulo === opt('modulo'));
  if (opt('limite')) {
    const lim = Number(opt('limite'));
    const porMod = new Map<string, number>();
    cases = cases.filter((c) => {
      const n = (porMod.get(c.modulo) || 0) + 1;
      porMod.set(c.modulo, n);
      return n <= lim;
    });
  }

  const fx = seedEvalCompany();
  const vars: Record<string, string> = { ...fx } as any;
  const usoAntes = aiRouterService.getDailyUsage(fx.empresaId);
  const prevFactory = AutonomousAgentEngine.modelClientFactory;
  console.log(`Empresa de evaluación ${fx.empresaId} · ${cases.length} casos · ${autoprueba ? 'AUTOPRUEBA' : 'LLM real'}`);

  const scores: CaseScore[] = [];
  const negativos: CaseScore[] = [];
  for (const c of cases) {
    if (autoprueba) {
      process.env.GEMINI_API_KEY = 'autoprueba';
      AutonomousAgentEngine.modelClientFactory = oracleModel(c, vars);
    }
    const s = await runCase(c, fx, vars, autoprueba);
    scores.push(s);
    console.log(`${s.aprobado ? '✅' : '❌'} ${s.id} ${s.tipo}${s.aprobado ? '' : ` — ${s.motivo}`}`);
    if (autoprueba) {
      AutonomousAgentEngine.modelClientFactory = inventorModel();
      negativos.push(await runCase(c, fx, vars));
    }
  }
  AutonomousAgentEngine.modelClientFactory = prevFactory;

  const r = resumen(scores);
  const uso = aiRouterService.getDailyUsage(fx.empresaId);
  const fecha = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  const extra = [
    `Fecha: ${new Date().toISOString()} · Empresa de evaluación: ${fx.empresaId} · Modelo: ${autoprueba ? 'oráculo (autoprueba)' : process.env.AGENT_MODEL || 'según aiRouterService'}`,
    autoprueba ? '' : `Consumo: ${uso.llamadas - usoAntes.llamadas} llamadas, ${(uso.tokens - usoAntes.tokens).toLocaleString('es-CL')} tokens, ${clp(uso.gastoClp - usoAntes.gastoClp)} estimados.`,
  ].filter(Boolean);
  const dir = path.join(ROOT, 'resultados');
  fs.mkdirSync(dir, { recursive: true });
  const base = path.join(dir, `${autoprueba ? 'autoprueba' : 'llm'}-${fecha}`);
  fs.writeFileSync(`${base}.md`, informe(autoprueba ? '4.2 Autoprueba del banco de casos' : '4.2 Evaluación con LLM real', scores, extra));
  fs.writeFileSync(`${base}.json`, JSON.stringify({ resumen: r, casos: scores }, null, 2));
  console.log(`\nAcierto ${(r.acierto * 100).toFixed(1)} % (${r.aprobados}/${r.total}) · informe: ${path.relative(process.cwd(), base)}.md`);

  if (!flag('conservar')) removeEvalCompany(fx.empresaId);

  if (autoprueba) {
    const neg = resumen(negativos);
    console.log(`Autoprueba negativa (modelo que inventa): acierto ${(neg.acierto * 100).toFixed(1)} %`);
    const ok = r.acierto === 1 && neg.acierto <= 0.05;
    process.exit(ok ? 0 : 1);
  }
  process.exit(r.acierto >= UMBRAL ? 0 : 1);
}

main();
