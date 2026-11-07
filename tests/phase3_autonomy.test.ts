/**
 * Fase 3 — Autonomía real (plan de corrección).
 * 3.1 Herramientas por agente · 3.2 Contexto y memoria · 3.3 Ejecuciones programadas
 * 3.4 Alertas proactivas · 3.5 Límites y costos.
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
import { recordAgentCorrection } from '../src/services/agentLearningFeedbackService';
import { agentSchedulerService, computeNextRun, AGENT_SCHEDULED_TASKS } from '../src/services/agentSchedulerService';
import { diskPersistence } from '../src/services/diskPersistenceService';
import { HrManagementService } from '../src/services/hrManagementService';
import { getAllowedTools } from '../src/config/agentToolPolicy';
import { agentAlertService } from '../src/services/agentAlertService';

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

  // ---------------------------------------------------------------- 3.2
  console.log('\n--- 3.2 Contexto y memoria ---');

  await test('El historial de la conversación llega al modelo, en orden y antes de la consulta', async () => {
    process.env.GEMINI_API_KEY = 'clave-de-prueba';
    const calls: Call[] = [];
    AutonomousAgentEngine.modelClientFactory = scriptedModel([textAnswer('Listo.')], calls);
    await AutonomousAgentEngine.executeAutonomousAgentLoop(
      req({
        query: '¿y en la bodega 2?',
        history: [
          { role: 'user', text: '¿Cuánto stock hay de tornillos?' },
          { role: 'assistant', text: 'En la bodega 1 hay 120 unidades.' },
          { role: 'system', text: 'turno inválido' },
        ],
      })
    );
    const contents = calls[0].contents;
    assert.deepStrictEqual(contents.map((c: any) => c.role), ['user', 'model', 'user']);
    assert.strictEqual(contents[0].parts[0].text, '¿Cuánto stock hay de tornillos?');
    assert.strictEqual(contents[2].parts[0].text, '¿y en la bodega 2?');
  });

  await test('La instrucción de sistema incluye el perfil operativo y las herramientas del agente', async () => {
    const calls: Call[] = [];
    AutonomousAgentEngine.modelClientFactory = scriptedModel([textAnswer('Listo.')], calls);
    await AutonomousAgentEngine.executeAutonomousAgentLoop(req({ query: 'kardex' }));
    const si: string = calls[0].config.systemInstruction;
    assert.match(si, /PERFIL OPERATIVO DE LA EMPRESA/);
    assert.match(si, /Herramientas autorizadas: tool_inventory_kardex/);
    assert.ok(!/Banco de Chile Cuenta Corriente/.test(si), 'Plan de cuentas inventado');
  });

  await test('Criterio 3.2: una corrección registrada cambia la respuesta siguiente del mismo agente', async () => {
    const regla = 'Valorizar las salidas de bodega a costo promedio ponderado, nunca FIFO';
    // El doble responde según lo que el motor le entregó: si la regla está en el prompt, la aplica.
    const reactive = () => ({
      models: {
        generateContent: async (args: any) =>
          textAnswer(String(args.config.systemInstruction).includes(regla) ? 'Salida valorizada a PMP.' : 'Salida valorizada a FIFO.'),
      },
    });
    AutonomousAgentEngine.modelClientFactory = reactive;
    const antes = await AutonomousAgentEngine.executeAutonomousAgentLoop(req({ query: 'valoriza la salida 15' }));
    assert.match(antes.finalText, /FIFO/);

    const learning = await recordAgentCorrection({
      empresaId: EMPRESA,
      modulo: 'INVENTORY_WMS',
      categoria: 'ERROR_IMPUTACION' as any,
      error: 'Se valorizó una salida con FIFO',
      solucion: regla,
    });
    const despues = await AutonomousAgentEngine.executeAutonomousAgentLoop(req({ query: 'valoriza la salida 15' }));
    assert.match(despues.finalText, /PMP/);
    assert.ok(despues.learningsApplied?.includes(learning.id), 'La respuesta informa la corrección aplicada');
  });

  await test('Las correcciones de otra empresa no se inyectan', async () => {
    const calls: Call[] = [];
    AutonomousAgentEngine.modelClientFactory = scriptedModel([textAnswer('Listo.')], calls);
    await recordAgentCorrection({
      empresaId: '99.888.777-6',
      modulo: 'INVENTORY_WMS',
      categoria: 'ERROR_IMPUTACION' as any,
      error: 'Regla privada de otra empresa',
      solucion: 'REGLA-PRIVADA-OTRA-EMPRESA',
    });
    await AutonomousAgentEngine.executeAutonomousAgentLoop(req({ query: 'kardex' }));
    assert.ok(!calls[0].config.systemInstruction.includes('REGLA-PRIVADA-OTRA-EMPRESA'));
  });

  // ---------------------------------------------------------------- 3.3
  console.log('\n--- 3.3 Ejecuciones programadas ---');
  process.env.GEMINI_API_KEY = '';
  AutonomousAgentEngine.modelClientFactory = prevFactory;

  await test('Próxima ejecución en hora de Chile (verano y horario de invierno)', () => {
    const iso = (d: Date) => d.toISOString().slice(0, 16);
    // 6 nov 2026, 09:00 en Santiago (UTC-3): la de las 07:00 pasa al día siguiente.
    assert.strictEqual(iso(computeNextRun({ tipo: 'DIARIA', hora: '07:00' }, new Date('2026-11-06T12:00:00Z'))), '2026-11-07T10:00');
    assert.strictEqual(iso(computeNextRun({ tipo: 'MENSUAL', dia: 5, hora: '08:00' }, new Date('2026-11-06T12:00:00Z'))), '2026-12-05T11:00');
    // Julio (UTC-4)
    assert.strictEqual(iso(computeNextRun({ tipo: 'DIARIA', hora: '07:00' }, new Date('2026-07-10T00:00:00Z'))), '2026-07-10T11:00');
  });

  // Empresa propia de la prueba (identificador único para no chocar con datos de otras corridas)
  const EMP = `77${String(Date.now()).slice(-6)}-5`;
  const T0 = new Date('2026-11-30T12:00:00Z');
  const T1 = new Date('2026-12-05T12:00:00Z'); // 09:00 del día 5 en Santiago
  const snapshot: any = diskPersistence.getSnapshot();
  diskPersistence.updateCollection('clients', [
    ...(snapshot.clients || []),
    { id: EMP, rut: EMP, razonSocial: 'Prueba Programada SpA', tasaPpm: 0.01, regimenTributario: '14_A' },
  ]);
  diskPersistence.saveBankMovements([
    { id: `${EMP}-mov1`, fecha: '2026-12-03', monto: 119000, abono: 119000, descripcion: 'TEF cliente', estado: 'PENDIENTE' },
    { id: `${EMP}-mov2`, fecha: '2026-12-03', monto: 5555, cargo: 5555, descripcion: 'Comisión', estado: 'PENDIENTE' },
  ], EMP);
  diskPersistence.addAccountingEntry({
    id: `${EMP}-ent1`, empresaId: EMP, fecha: '2026-12-03', periodo: '2026-12', concepto: 'Cobro cliente',
    totalDebe: 119000, totalHaber: 119000,
    lineas: [
      { cuentaCodigo: '1.1.01', debe: 119000, haber: 0 },
      { cuentaCodigo: '1.1.03', debe: 0, haber: 119000 },
    ],
  });
  diskPersistence.saveDtes(EMP, [
    { id: `${EMP}-v1`, tipoOperacion: 'VENTA', tipoDte: '33', folio: 10, periodo: '2026-11', fechaEmision: '2026-11-10', montoNeto: 1000000, montoIva: 190000, montoTotal: 1190000, rutEmisor: EMP },
    { id: `${EMP}-c1`, tipoOperacion: 'COMPRA', tipoDte: '33', folio: 77, periodo: '2026-11', fechaEmision: '2026-11-12', montoNeto: 400000, montoIva: 76000, montoTotal: 476000, rutReceptor: EMP },
    { id: `${EMP}-v2`, tipoOperacion: 'VENTA', tipoDte: '33', folio: 11, periodo: '2026-12', fechaEmision: '2026-12-02', montoNeto: 100000, montoIva: 19000, montoTotal: 119000, rutEmisor: EMP },
  ]);
  diskPersistence.setFixedAssets(EMP, [
    { id: `${EMP}-af1`, empresaId: EMP, codigoPlaca: 'AF-1', nombre: 'Camioneta de reparto', categoria: 'VEHICULOS', estado: 'OPERATIVO',
      valorAdquisicionOriginal: 12000000, vidaUtilMesesFinanciera: 60, vidaUtilMesesTributaria: 36, vidaUtilRestanteMeses: 50 },
  ]);

  // 3.4: doble del puente WhatsApp. Solo hay un número autorizado, con alcance de conciliación.
  const enviados: Array<{ telefono: string; mensaje: string }> = [];
  let whatsappConectado = true;
  agentAlertService.setWhatsappPort(async () => ({
    listRecipients: (_emp: string, scope: string) => (scope === 'BANCOS_CONCILIACION' ? [{ telefono: '56911112222', nombre: 'Tesorera' }] : []),
    isAuthorized: (tel: string) => tel === '56911112222',
    send: async (telefono: string, mensaje: string) => {
      if (!whatsappConectado) return { success: false, mode: 'FALLBACK_REQUIRED', message: 'WhatsApp Web aún no está vinculado.' };
      enviados.push({ telefono, mensaje });
      return { success: true, mode: 'LIVE_SOCKET', message: 'enviado' };
    },
  }));

  for (const t of AGENT_SCHEDULED_TASKS) {
    agentSchedulerService.upsertSchedule({ empresaId: EMP, tareaId: t.id, usuarioId: 'test', now: T0 });
  }
  const runs = await agentSchedulerService.tick(T1);
  const byTask = Object.fromEntries(runs.map((r) => [r.tareaId, r]));

  await test('Cada programación vencida se ejecuta una vez en el despachador', () => {
    assert.deepStrictEqual(runs.map((r) => r.tareaId).sort(), AGENT_SCHEDULED_TASKS.map((t) => t.id).sort());
    assert.ok(runs.every((r) => r.disparo === 'PROGRAMADO' && r.slot));
  });

  await test('Criterio 3.3: al menos 3 agentes terminan en una solicitud de aprobación humana', () => {
    const conPropuesta = runs.filter((r) => r.estado === 'PROPUESTA_CREADA' && r.approvalIds.length > 0);
    const agentes = new Set(conPropuesta.map((r) => r.modulo));
    assert.ok(agentes.size >= 3, `Agentes con propuesta: ${[...agentes].join(', ')} · ${runs.map((r) => `${r.tareaId}=${r.estado}: ${r.resumen}`).join(' | ')}`);
    for (const r of conPropuesta) {
      for (const id of r.approvalIds) {
        const ap = HrManagementService.getApprovals(EMP).find((a) => a.id === id);
        assert.ok(ap, `Aprobación ${id} no registrada`);
        assert.strictEqual(ap!.estado, 'PENDIENTE');
        assert.strictEqual(ap!.modulo, r.modulo, 'La aprobación pertenece al módulo del agente');
      }
    }
  });

  await test('Cada ejecución queda en la bitácora de auditoría', () => {
    const logs = diskPersistence.getAuditLogs(EMP).filter((l: any) => l.entidadTipo === 'AGENT_SCHEDULED_RUN');
    for (const r of runs) assert.ok(logs.some((l: any) => l.entidadId === r.id), `Sin auditoría para ${r.tareaId}`);
  });

  await test('Las tareas solo usan herramientas de su agente', () => {
    for (const r of runs) {
      const allowed = getAllowedTools(r.modulo);
      for (const p of r.pasos) assert.ok(allowed.includes(p.herramienta), `${r.tareaId} usó ${p.herramienta}`);
    }
  });

  await test('Conciliación: propone solo el calce real y deja el resto pendiente', () => {
    const r = byTask.CONCILIACION_DIARIA;
    assert.strictEqual(r.estado, 'PROPUESTA_CREADA');
    const ap: any = HrManagementService.getApprovals(EMP).find((a) => a.id === r.approvalIds[0]);
    assert.deepStrictEqual(ap.datosOperacion.calces.map((c: any) => c.movimientoId), [`${EMP}-mov1`]);
    assert.match(r.resumen, /1 movimiento\(s\) sin calce/);
  });

  await test('RCV: las diferencias contra el Libro Mayor quedan como alerta, sin propuesta inventada', () => {
    const r = byTask.RCV_DIARIO;
    assert.strictEqual(r.estado, 'REQUIERE_ATENCION', r.resumen);
    assert.strictEqual(r.approvalIds.length, 0);
    assert.ok(r.requiereAccion);
  });

  await test('Un horario ya atendido no se vuelve a ejecutar', async () => {
    const again = await agentSchedulerService.tick(T1);
    assert.strictEqual(again.length, 0);
  });

  await test('Una nueva ejecución no duplica propuestas pendientes', async () => {
    const sched = agentSchedulerService.listSchedules(EMP).find((s) => s.tareaId === 'CONCILIACION_DIARIA')!;
    const antes = HrManagementService.getApprovals(EMP, 'CONCILIACION').length;
    const r = await agentSchedulerService.runScheduleNow(sched.id, 'test', T1);
    assert.strictEqual(r.disparo, 'MANUAL');
    assert.strictEqual(r.estado, 'SIN_CAMBIOS', r.resumen);
    assert.strictEqual(HrManagementService.getApprovals(EMP, 'CONCILIACION').length, antes);
    const f29 = agentSchedulerService.listSchedules(EMP).find((s) => s.tareaId === 'BORRADOR_F29')!;
    assert.strictEqual((await agentSchedulerService.runScheduleNow(f29.id, 'test', T1)).estado, 'SIN_CAMBIOS');
  });

  await test('Al aprobar los calces, el movimiento queda conciliado con su asiento', async () => {
    const id = byTask.CONCILIACION_DIARIA.approvalIds[0];
    const res = await HrManagementService.resolveApproval(id, 'contador-prueba', true);
    assert.strictEqual(res.estado, 'EJECUTADO', res.resultadoEjecucion);
    const mov = diskPersistence.getBankMovements(EMP).find((m: any) => m.id === `${EMP}-mov1`);
    assert.strictEqual(mov.estado, 'CONCILIADO');
    assert.strictEqual(mov.asientoGeneradoId, `${EMP}-ent1`);
    assert.strictEqual(mov.usuarioConciliador, 'contador-prueba');
    const otro = diskPersistence.getBankMovements(EMP).find((m: any) => m.id === `${EMP}-mov2`);
    assert.notStrictEqual(otro.estado, 'CONCILIADO');
  });

  await test('Sin datos, la tarea informa SIN_DATOS y no crea aprobaciones', async () => {
    const vacia = `78${String(Date.now()).slice(-6)}-1`;
    const r = await agentSchedulerService.runTask({ empresaId: vacia, tareaId: 'CONCILIACION_DIARIA', usuarioId: 'test' });
    assert.strictEqual(r.estado, 'SIN_DATOS');
    assert.strictEqual(r.approvalIds.length, 0);
    assert.strictEqual(HrManagementService.getApprovals(vacia).length, 0);
  });

  // ---------------------------------------------------------------- 3.4
  console.log('\n--- 3.4 Alertas proactivas ---');
  const alertas = agentAlertService.list({ empresaId: EMP, limit: 1000 });

  await test('Cada ejecución que requiere acción genera una alerta en el panel', () => {
    for (const r of runs.filter((x) => x.requiereAccion)) {
      const a = alertas.find((x) => x.runId === r.id);
      assert.ok(a, `Sin alerta para ${r.tareaId}`);
      assert.ok(a!.canales.some((c) => c.canal === 'PANEL' && c.estado === 'ENTREGADA'));
    }
    const conciliacion = alertas.find((a) => a.runId === byTask.CONCILIACION_DIARIA.id)!;
    assert.strictEqual(conciliacion.tipo, 'APROBACION_PENDIENTE');
    assert.deepStrictEqual(conciliacion.approvalIds, byTask.CONCILIACION_DIARIA.approvalIds);
  });

  await test('Criterio 3.4: el responsable recibe la alerta por WhatsApp sin abrir el módulo', () => {
    const msg = enviados.find((e) => e.telefono === '56911112222' && /conciliaci/i.test(e.mensaje));
    assert.ok(msg, `Mensajes enviados: ${JSON.stringify(enviados)}`);
    assert.match(msg!.mensaje, /propuesta\(s\) para aprobar/);
    const a = alertas.find((x) => x.runId === byTask.CONCILIACION_DIARIA.id)!;
    assert.ok(a.canales.some((c) => c.canal === 'WHATSAPP' && c.estado === 'ENVIADA' && c.destino === '+56911112222'));
  });

  await test('Sin número autorizado para el módulo, el canal queda como SIN_DESTINATARIO (no se informa envío)', () => {
    const a = alertas.find((x) => x.runId === byTask.BORRADOR_F29.id)!;
    const wa = a.canales.find((c) => c.canal === 'WHATSAPP')!;
    assert.strictEqual(wa.estado, 'SIN_DESTINATARIO');
  });

  await test('Con WhatsApp desconectado, la alerta queda en el panel y el canal informa NO_CONECTADO', async () => {
    whatsappConectado = false;
    const r = await agentSchedulerService.runTask({ empresaId: EMP, tareaId: 'CONCILIACION_DIARIA', usuarioId: 'test', now: T1 });
    // Tras aprobar mov1, queda mov2 sin calce: requiere revisión.
    assert.strictEqual(r.estado, 'REQUIERE_ATENCION', r.resumen);
    const a = agentAlertService.list({ empresaId: EMP }).find((x) => x.runId === r.id)!;
    assert.ok(a, 'Debe existir la alerta');
    assert.strictEqual(a.canales.find((c) => c.canal === 'WHATSAPP')!.estado, 'NO_CONECTADO');
    whatsappConectado = true;
  });

  await test('Una ejecución sin nada que hacer no genera alerta', async () => {
    const vacia = `79${String(Date.now()).slice(-6)}-2`;
    const r = await agentSchedulerService.runTask({ empresaId: vacia, tareaId: 'CONCILIACION_DIARIA', usuarioId: 'test' });
    assert.strictEqual(r.requiereAccion, false);
    assert.strictEqual(agentAlertService.list({ empresaId: vacia }).length, 0);
  });

  await test('El responsable marca la alerta como revisada', () => {
    const a = alertas[0];
    const leida = agentAlertService.markRead(a.id, 'contador-prueba')!;
    assert.ok(leida.leidaEn);
    assert.strictEqual(leida.leidaPor, 'contador-prueba');
    assert.ok(!agentAlertService.list({ empresaId: EMP, soloNoLeidas: true, limit: 1000 }).some((x) => x.id === a.id));
  });

  AutonomousAgentEngine.modelClientFactory = prevFactory;
  process.env.GEMINI_API_KEY = prevKey;
  agentAlertService.setWhatsappPort(null);
  console.log(`\nRESULTADO FASE 3: ${passed} de ${total} pruebas pasaron.`);
  process.exit(passed === total ? 0 : 1);
}

run();
