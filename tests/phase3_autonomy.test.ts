/**
 * Fase 3 — Autonomía real (plan de corrección).
 * 3.1 Herramientas por agente.
 *
 * El modelo se reemplaza por un doble (AutonomousAgentEngine.modelClientFactory) que registra
 * exactamente lo que el motor le envía: herramientas declaradas, instrucción de sistema e historial.
 */
import './setup/enableDemoMode';
import assert from 'node:assert';
import {
  AutonomousAgentEngine,
  AGENT_FUNCTION_DECLARATIONS,
  getAgentFunctionDeclarations,
} from '../src/services/autonomousAgentEngine';
import { MODULE_AGENTS_REGISTRY } from '../src/services/moduleAgentGovernanceService';
import { AGENT_TOOL_POLICY } from '../src/config/agentToolPolicy';

type Call = { model: string; contents: any[]; config: any };

/** Doble del modelo: devuelve las respuestas del guion en orden y registra cada llamada. */
export function scriptedModel(script: any[], calls: Call[]) {
  let i = 0;
  return () => ({
    models: {
      generateContent: async (args: any) => {
        calls.push(JSON.parse(JSON.stringify(args)));
        return script[Math.min(i++, script.length - 1)];
      },
    },
  });
}
export const fnCall = (name: string, args: any = {}) => ({ candidates: [{ content: { parts: [{ functionCall: { name, args } }] } }] });
export const textAnswer = (text: string) => ({ candidates: [{ content: { parts: [{ text }] } }], text });

const EMPRESA = '76.555.444-3';
const req = (over: any = {}): any => ({
  empresaId: EMPRESA,
  module: 'INVENTARIO',
  agentRole: 'Agente de prueba',
  query: 'prueba',
  context: {},
  ...over,
});

async function run() {
  let passed = 0;
  let total = 0;
  async function test(name: string, fn: () => void | Promise<void>) {
    total++;
    try {
      await fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ❌ [FAIL] ${name}:`, err.message);
    }
  }

  console.log('=== FASE 3: AUTONOMÍA REAL ===\n');
  const prevKey = process.env.GEMINI_API_KEY;
  const prevFactory = AutonomousAgentEngine.modelClientFactory;
  const declared = new Set(AGENT_FUNCTION_DECLARATIONS.map((d: any) => d.name));

  // ---------------------------------------------------------------- 3.1
  console.log('--- 3.1 Herramientas por agente ---');

  await test('Cada agente del registro declara herramientas existentes en el catálogo', () => {
    for (const agent of MODULE_AGENTS_REGISTRY) {
      assert.ok(agent.herramientasPermitidas.length > 0, `${agent.moduloId} sin herramientas`);
      for (const t of agent.herramientasPermitidas) assert.ok(declared.has(t), `${agent.moduloId}: ${t} no existe`);
    }
    assert.deepStrictEqual(
      MODULE_AGENTS_REGISTRY.map((a) => a.moduloId).sort(),
      Object.keys(AGENT_TOOL_POLICY).sort(),
      'Registro y política deben cubrir los mismos módulos'
    );
  });

  await test('Toda herramienta del catálogo pertenece al menos a un agente', () => {
    const asignadas = new Set(Object.values(AGENT_TOOL_POLICY).flat());
    const huerfanas = [...declared].filter((t) => !asignadas.has(t));
    assert.deepStrictEqual(huerfanas, []);
  });

  await test('Criterio 3.1: el agente de inventario no puede llamar tool_hr_calculate_finiquito', async () => {
    const out = await AutonomousAgentEngine.executeToolForAgent('INVENTARIO', 'tool_hr_calculate_finiquito', { rut: '1-9', sueldoBase: 900000 }, req());
    assert.strictEqual(out.status, 'TOOL_NOT_ALLOWED');
    assert.deepStrictEqual(out.modulosAutorizados, ['RRHH']);
    assert.ok(!('totalFiniquitoLiquido' in out), 'No debe calcular nada');
  });

  await test('Al modelo solo se envían las herramientas del agente', () => {
    const names = getAgentFunctionDeclarations('INVENTARIO').map((d: any) => d.name);
    assert.deepStrictEqual(names.sort(), [...AGENT_TOOL_POLICY.INVENTARIO].sort());
    assert.ok(!names.includes('tool_hr_calculate_finiquito'));
  });

  await test('Bucle con IA: si el modelo pide una herramienta ajena, el motor la rechaza (TOOL_NOT_ALLOWED)', async () => {
    process.env.GEMINI_API_KEY = 'clave-de-prueba';
    const calls: Call[] = [];
    AutonomousAgentEngine.modelClientFactory = scriptedModel(
      [fnCall('tool_hr_calculate_finiquito', { rut: '1-9', sueldoBase: 900000 }), textAnswer('No tengo esa herramienta; corresponde al agente de RRHH.')],
      calls
    );
    const r = await AutonomousAgentEngine.executeAutonomousAgentLoop(req({ query: 'calcula el finiquito de Juan' }));
    const sent = calls[0].config.tools[0].functionDeclarations.map((d: any) => d.name);
    assert.ok(!sent.includes('tool_hr_calculate_finiquito'), 'La herramienta no debió declararse');
    assert.strictEqual(r.steps[0].toolOutput.status, 'TOOL_NOT_ALLOWED');
    const observacion = calls[1].contents.at(-1).parts[0].functionResponse.response;
    assert.strictEqual(observacion.status, 'TOOL_NOT_ALLOWED', 'El modelo recibe el rechazo como observación');
  });

  await test('Sin IA, el núcleo de reglas también respeta la lista del agente', async () => {
    process.env.GEMINI_API_KEY = '';
    const r = await AutonomousAgentEngine.executeAutonomousAgentLoop(
      req({ query: 'calcula el finiquito', context: { payroll: { rut: '1-9', sueldoBase: 900000 } } })
    );
    assert.strictEqual(r.success, false);
    assert.strictEqual(r.code, 'TOOL_NOT_ALLOWED');
  });

  await test('Un módulo sin agente registrado devuelve MODULE_UNKNOWN y no ejecuta nada', async () => {
    const r = await AutonomousAgentEngine.executeAutonomousAgentLoop(req({ module: 'MARKETING', query: 'kardex' }));
    assert.strictEqual(r.success, false);
    assert.strictEqual(r.code, 'MODULE_UNKNOWN');
    assert.strictEqual(r.steps.length, 0);
  });

  AutonomousAgentEngine.modelClientFactory = prevFactory;
  process.env.GEMINI_API_KEY = prevKey;
  console.log(`\nRESULTADO FASE 3: ${passed} de ${total} pruebas pasaron.`);
  process.exit(passed === total ? 0 : 1);
}

run();
