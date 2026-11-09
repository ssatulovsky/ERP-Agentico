/**
 * 4.4 Búsqueda de marcadores de simulación (plan de corrección, fase 4).
 * Sin coincidencias fuera de src/data/seed* y pruebas para:
 *  - Math.random en montos, folios, claves o contraseñas;
 *  - setTimeout usado como espera de "procesamiento";
 *  - success: true dentro de un catch.
 */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { generatePeriodClosingAdjustments } from '../src/utils/accountingOrchestratorEngine';
import { calculatePreF29 } from '../src/utils/f29SeniorEngine';
import { DEFAULT_INDICATORS } from '../src/utils/chileanAccounting';
import { AutonomousAgentEngine } from '../src/services/autonomousAgentEngine';
import { commercialProcurementService } from '../src/services/commercialProcurementService';
import { diskPersistence } from '../src/services/diskPersistenceService';
import { calculateExecutiveDashboardMetrics } from '../src/utils/executiveDashboardEngine';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(e.name) && !/src[\\/]data[\\/]seed/.test(full)) out.push(full);
    }
  };
  walk(path.join(ROOT, 'src'));
  out.push(path.join(ROOT, 'server.ts'));
  return out;
}

/** Archivos cuyo uso de Math.random/setTimeout está detrás de DEMO_MODE (comprobantes de ejemplo). */
const DEMO_ONLY = ['CollaboratorExpenseMobileApp.tsx', 'AddExpenseItemModal.tsx'];

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
  console.log('=== 4.4 BÚSQUEDA DE MARCADORES DE SIMULACIÓN (y 4.1 cobertura de regresiones) ===\n');
  const files = sourceFiles();

  await test('Sin Math.random en montos, folios, claves ni contraseñas', () => {
    const offenders: string[] = [];
    for (const f of files) {
      if (DEMO_ONLY.some((d) => f.endsWith(d))) continue;
      fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        if (/^\s*(\/\/|\*)/.test(line)) return;
        if (line.includes('Math.random') && !line.includes('Math.random().toString(36)') && /folio|monto|precio|total|saldo|neto|clave|pass|salt|codigo|sku|rut/i.test(line)) {
          offenders.push(`${path.relative(ROOT, f)}:${i + 1}`);
        }
      });
    }
    assert.deepStrictEqual(offenders, []);
  });

  await test('Sin setTimeout usado como espera de "procesamiento"', () => {
    const offenders: string[] = [];
    for (const f of files) {
      if (DEMO_ONLY.some((d) => f.endsWith(d))) continue;
      const src = fs.readFileSync(f, 'utf8');
      // await new Promise(r => setTimeout(r, N)): solo se admite el backoff de reintentos HTTP-DTE
      const awaits = src.match(/await new Promise\(\(?\w*\)? => setTimeout\(\w+, [^)]+\)\)/g) || [];
      for (const a of awaits) {
        if (!(f.endsWith('httpDteBillingService.ts') && a.includes('backoffMs'))) offenders.push(`${path.relative(ROOT, f)}: ${a}`);
      }
      // Simulaciones conocidas que se eliminaron
      for (const marker of ['Realistic simulation delay', 'Simular Captura OCR', 'Auto-completar desde SII', 'Datos extraídos del Registro Tributario SII', 'handleManualRefresh', 'handleReAudit']) {
        if (src.includes(marker)) offenders.push(`${path.relative(ROOT, f)}: ${marker}`);
      }
    }
    assert.deepStrictEqual(offenders, []);
  });

  await test('Sin success: true dentro de un catch', () => {
    const offenders: string[] = [];
    for (const f of files) {
      const src = fs.readFileSync(f, 'utf8');
      const re = /catch\s*(\([^)]*\))?\s*\{/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(src))) {
        let depth = 1;
        let j = m.index + m[0].length;
        while (depth > 0 && j < src.length) {
          if (src[j] === '{') depth++;
          else if (src[j] === '}') depth--;
          j++;
        }
        const block = src.slice(m.index + m[0].length, j);
        if (/success:\s*true|status:\s*['"]SUCCESS['"]/.test(block)) {
          offenders.push(`${path.relative(ROOT, f)}:${src.slice(0, m.index).split('\n').length}`);
        }
      }
    }
    assert.deepStrictEqual(offenders, []);
  });

  await test('Sin folios oficiales inventados (DT, licencias, REL)', () => {
    const offenders: string[] = [];
    for (const f of files) {
      const src = fs.readFileSync(f, 'utf8');
      for (const re of [/CERT-DT-\$\{/, /`LME-\$\{Math/, /`REL-\$\{new Date/, /'CERT-DT-\d+-\d+'/]) {
        if (re.test(src)) offenders.push(`${path.relative(ROOT, f)}: ${re}`);
      }
    }
    assert.deepStrictEqual(offenders, []);
  });

  await test('Sin montos de respaldo (|| 1234…) en montos, folios ni tasas', () => {
    const offenders: string[] = [];
    const permitido = /timeout|Timeout|TIMEOUT|Ms\b|ms\b|PORT|port|limit|Limit|retries|1000 \*|indicators|Indicators|\butm\b|\buf\b|UTM|imm|dolar|euro|umbral/;
    for (const f of files) {
      if (DEMO_ONLY.some((d) => f.endsWith(d))) continue;
      fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        if (/(\|\||\?\?) ?[0-9]{4,}(\.[0-9]+)?\b/.test(line) && !permitido.test(line)) offenders.push(`${path.relative(ROOT, f)}:${i + 1}`);
        if (/tasaPpm\)? \|\| 0\.0[0-9]+/.test(line)) offenders.push(`${path.relative(ROOT, f)}:${i + 1} (tasa PPM supuesta)`);
      });
    }
    assert.deepStrictEqual(offenders, []);
  });

  await test('Sin datos, el cierre de período no propone ajustes inventados', () => {
    const adj = generatePeriodClosingAdjustments({}, {} as any, [], [], []);
    assert.deepStrictEqual(adj, [], `Se propusieron ajustes sin datos: ${adj.map((a) => a.id).join(', ')}`);
  });

  await test('F29: postergación según el período y PPM sin tasa supuesta', () => {
    const company: any = { rut: '76.999.888-1', razonSocial: 'X', regimenTributario: '14A_GENERAL' };
    const r: any = calculatePreF29(company, [], [], DEFAULT_INDICATORS as any, { periodo: '2026-10' });
    assert.ok(r.alertas_fiscales.some((a: any) => /tasa PPM/.test(a.descripcion)), 'Debe alertar la falta de tasa PPM');
    const post = JSON.stringify(r);
    assert.ok(!post.includes('2026-11-20'), 'Fecha de postergación fija');
  });

  await test('4.1 Cada hallazgo #1 a #10 tiene al menos una prueba de regresión dentro de npm test', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    const suites: string[] = (pkg.scripts.test.match(/tests\/[\w.]+\.test\.ts/g) || []);
    const nombres = suites.flatMap((s) =>
      [...fs.readFileSync(path.join(ROOT, s), 'utf8').matchAll(/await test\('([^']+)'/g)].map((m) => m[1])
    );
    const sinPrueba = Array.from({ length: 10 }, (_, i) => i + 1).filter(
      (n) => !nombres.some((t) => new RegExp(`(^|[^0-9])#${n}([^0-9]|$)`).test(t))
    );
    assert.deepStrictEqual(sinPrueba, [], `Hallazgos sin prueba: ${sinPrueba.map((n) => '#' + n).join(', ')}`);
  });

  await test('4.2 (hallazgo de la evaluación) La comparativa de cotizaciones usa lo ofertado, sin plazo ni puntaje supuestos', async () => {
    const emp = `75${String(Date.now()).slice(-6)}-4`;
    const rfq = commercialProcurementService.createRfq(emp, {
      titulo: 'Prueba comparativa',
      items: [{ sku: 'X', descripcion: 'Insumo', cantidad: 10, unidad: 'UND' } as any],
      proveedorRuts: ['78.555.666-7', '79.111.000-2'],
    });
    const req: any = { empresaId: emp, module: 'COMERCIAL_COMPRAS', agentRole: 't', query: 't', context: {} };
    const vacia = await AutonomousAgentEngine.executeTool('tool_procurement_compare_quotes', { rfqId: rfq.id }, req);
    assert.strictEqual(vacia.status, 'NO_DATA');
    commercialProcurementService.submitSupplierQuote(emp, rfq.id, '78.555.666-7', { montoNetoOfertado: 500000, plazoEntregaDiasOfertado: 7, condicionPagoOfertada: '30 días', costoFleteClp: 90000 });
    commercialProcurementService.submitSupplierQuote(emp, rfq.id, '79.111.000-2', { montoNetoOfertado: 540000, plazoEntregaDiasOfertado: 4, condicionPagoOfertada: 'Contado' });
    const r = await AutonomousAgentEngine.executeTool('tool_procurement_compare_quotes', { rfqId: rfq.id }, req);
    assert.strictEqual(r.status, 'SUCCESS', 'Antes: NO_DATA aunque hubiera ofertas registradas');
    assert.strictEqual(r.totalCotizacionesRecibidas, 2);
    assert.strictEqual(r.mejorOfertaPorCostoTotal.proveedorRut, '79.111.000-2', 'La mejor oferta considera el flete');
    assert.strictEqual(r.cuadroComparativo.find((q: any) => q.proveedorRut === '78.555.666-7').plazoEntregaDias, 7);
    assert.ok(!JSON.stringify(r).includes('"score":85'), 'Puntaje 85 supuesto');
  });

  await test('4.5 Variaciones de producción: sin presupuesto estándar no se calculan (antes: estándar = real × 0,95)', async () => {
    const emp = `75${String(Date.now()).slice(-6)}-6`;
    diskPersistence.setProductionOrders(emp, [{ id: `${emp}-op`, folioOP: 'OP-SIN-PPTO', productoNombre: 'X', costoMateriaPrimaReal: 1000000, costoManoObraReal: 200000, costoCifReal: 100000 }]);
    const r = await AutonomousAgentEngine.executeTool('tool_production_variance_standard_vs_real', { folioOP: 'OP-SIN-PPTO' }, { empresaId: emp, module: 'COSTOS_PRODUCCION', agentRole: 't', query: 't', context: {} } as any);
    assert.strictEqual(r.status, 'NO_DATA');
    assert.ok(!('costoEstandarPresupuestado' in r));
  });

  await test('4.5 Dashboard: sin presupuestos ni registros no inventa variaciones, costos de ausencia ni reparto por departamento', () => {
    const m: any = calculateExecutiveDashboardMetrics({
      company: { rut: '76.000.000-0', razonSocial: 'X' } as any,
      productionOrders: [{ id: 'op1', folioOP: 'OP-1', productoNombre: 'X', estado: 'TERMINADA', costoTotalProduccion: 1000000, costoDirectoMateriales: 700000, costoDirectoManoObra: 200000, costoIndirectoCif: 100000 } as any],
      vacations: [{ rut: '1-9', diasTomadosHistorico: 5 } as any],
      absenteeismList: [{ rut: '2-7', tipo: 'PERMISO_ADMINISTRATIVO', diasInasistencia: 1 } as any],
    });
    assert.deepStrictEqual(m.productionCostDeviations, [], 'Una OP sin presupuesto no tiene desvío');
    assert.ok(m.hrAbsenceMetrics.chartData.every((c: any) => c.tipo.startsWith('Licencias') || c.tipo.startsWith('Inasistencias') || c.costo === 0));
    assert.deepStrictEqual(m.hrAbsenceMetrics.departamentoData, []);
  });

  await test('4.5 La orden de compra adjudicada usa el plazo y la condición de la oferta, sin suponerlos', async () => {
    const emp = `75${String(Date.now()).slice(-6)}-7`;
    const rfq = commercialProcurementService.createRfq(emp, { titulo: 'OC', items: [{ sku: 'X', descripcion: 'Insumo', cantidad: 10, unidad: 'UND' } as any], proveedorRuts: ['78.555.666-7'] });
    commercialProcurementService.submitSupplierQuote(emp, rfq.id, '78.555.666-7', { montoNetoOfertado: 500000, plazoEntregaDiasOfertado: 9, condicionPagoOfertada: '60 días' });
    const r = await AutonomousAgentEngine.executeTool('tool_procurement_award_purchase_order', { rfqId: rfq.id, proveedorRut: '78555666-7', montoTotalNeto: 500000, motivoAdjudicacion: 'Única oferta' }, { empresaId: emp, module: 'COMERCIAL_COMPRAS', agentRole: 't', query: 't', context: {} } as any);
    assert.strictEqual(r.status, 'SUCCESS');
    const ap: any = diskPersistence.getApprovals(emp, 'COMERCIAL_COMPRAS').find((a: any) => a.id === r.approvalId);
    assert.strictEqual(ap.datosOperacion.plazoEntregaDias, 9);
    assert.strictEqual(ap.datosOperacion.condicionPago, '60 días');
  });

  console.log(`\nRESULTADO 4.4: ${passed} de ${total} pruebas pasaron.`);
  process.exit(passed === total ? 0 : 1);
}

run();
