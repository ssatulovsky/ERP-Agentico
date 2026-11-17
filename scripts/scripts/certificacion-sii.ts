/**
 * 4.3 Verificación en el ambiente de certificación del SII (plan de corrección, fase 4).
 *
 * Revisa, con datos reales de una empresa de prueba, que:
 *   1. El servidor está en certificación (DTE_AMBIENTE=1) y sin simulación de DTE.
 *   2. El servicio HTTP-DTE responde.
 *   3. La bóveda tiene certificado propio y un CAF de factura (33) con firma oficial y folios.
 *   4. (--emitir) Se emite una factura de prueba: el DTE vuelve con timbre y Track ID, y el
 *      resultado del SII se consulta por el Track ID hasta que deja de estar en proceso.
 *   5. (--rcv) Playwright descarga el RCV del mes anterior desde el portal del SII.
 *
 * Uso:
 *   CERT_RUT=76123456-0 DTE_AMBIENTE=1 HTTP_DTE_URL=http://localhost:8050 \
 *     node ./node_modules/tsx/dist/cli.mjs scripts/certificacion-sii.ts [--emitir] [--rcv]
 *
 * Variables: CERT_RUT (empresa de prueba), CERT_RAZON_SOCIAL, CERT_RECEPTOR_RUT y
 * CERT_RECEPTOR_RAZON_SOCIAL (receptor de la factura de prueba), SII_CLAVE (clave tributaria
 * para --rcv; si falta se usa la de la bóveda), CERT_ESPERA_MAX_SEG (consulta del Track ID, 600).
 *
 * Nada se da por bueno sin respuesta real: un paso sin datos queda OMITIDO con su motivo, y el
 * informe se guarda en docs/plan-correccion/certificacion-sii-<fecha>.md.
 */
import fs from 'node:fs';
import path from 'node:path';
import { HttpDteBillingService } from '../src/services/httpDteBillingService';
import { SiiPlaywrightRunner } from '../src/services/siiPlaywrightRunner';
import { isOfflineDteSimulationAllowed } from '../src/config/dteSimulationPolicy';
import { periodoActual, ultimosPeriodos } from '../src/utils/periodo';

type Estado = 'OK' | 'FALLA' | 'OMITIDO';
interface Paso {
  paso: string;
  estado: Estado;
  detalle: string;
}

const argv = process.argv.slice(2);
const pasos: Paso[] = [];
const registrar = (paso: string, estado: Estado, detalle: string) => {
  pasos.push({ paso, estado, detalle });
  console.log(`${estado === 'OK' ? '✅' : estado === 'FALLA' ? '❌' : '⏭️ '} ${paso}: ${detalle}`);
};
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const rut = process.env.CERT_RUT || '';
  const razonSocial = process.env.CERT_RAZON_SOCIAL || 'Empresa de certificación';

  // 1. Ambiente
  const ambiente = Number(process.env.DTE_AMBIENTE || 1);
  if (ambiente !== 1) registrar('Ambiente', 'FALLA', `DTE_AMBIENTE=${ambiente}. La verificación se hace solo en certificación (1).`);
  else if (isOfflineDteSimulationAllowed()) registrar('Ambiente', 'FALLA', 'ALLOW_OFFLINE_DTE_SIMULATION=true: con simulación no se verifica nada. Desactívela.');
  else registrar('Ambiente', 'OK', 'Certificación SII (DTE_AMBIENTE=1), sin simulación de DTE.');
  const ambienteOk = pasos[0].estado === 'OK';

  if (!rut) {
    registrar('Empresa de prueba', 'FALLA', 'Falta CERT_RUT (RUT de la empresa habilitada en certificación).');
    return terminar();
  }

  // 2. HTTP-DTE
  const health = await HttpDteBillingService.checkHealth();
  registrar('Servicio HTTP-DTE', health.ok ? 'OK' : 'FALLA', health.ok ? `${health.url} respondió en ${health.latencyMs} ms.` : `${health.url}: ${health.error || 'sin respuesta'}`);

  // 3. Bóveda: certificado y CAF 33
  const vault = HttpDteBillingService.getTenantVaultStatus(rut, razonSocial);
  const certOk = vault.hasOwnCert && vault.modoFirma !== 'DEMO_SIMULADO';
  registrar(
    'Certificado digital',
    certOk ? 'OK' : 'FALLA',
    certOk ? `${vault.certNombre || 'certificado propio'}${vault.certVencimiento ? `, vence ${vault.certVencimiento}` : ''}.` : `Sin certificado propio en la bóveda (modo ${vault.modoFirma}). Cárguelo en Agentes & Clientes › Bóveda.`
  );
  const caf33 = vault.cafs.find((c) => c.tipoDte === 33);
  const cafOk = Boolean(caf33?.exists && caf33.cafStatus === 'VALID_OFFICIAL' && Number(caf33.foliosDisponibles) > 0);
  registrar(
    'CAF factura electrónica (33)',
    cafOk ? 'OK' : 'FALLA',
    caf33?.exists
      ? `Estado ${caf33.cafStatus}, folios ${caf33.rangoDesde}–${caf33.rangoHasta}, disponibles ${caf33.foliosDisponibles ?? 'desconocido'}.`
      : 'No hay CAF tipo 33 en la bóveda. Solicítelo en el sitio de certificación del SII y cárguelo.'
  );

  // 4. Emisión y Track ID
  if (!argv.includes('--emitir')) {
    registrar('Emisión de prueba', 'OMITIDO', 'Agregue --emitir para emitir una factura de prueba en certificación.');
  } else if (!(ambienteOk && health.ok && certOk && cafOk)) {
    registrar('Emisión de prueba', 'OMITIDO', 'No se emite: falta cumplir los pasos anteriores.');
  } else if (!process.env.CERT_RECEPTOR_RUT) {
    registrar('Emisión de prueba', 'OMITIDO', 'Falta CERT_RECEPTOR_RUT (receptor de la factura de prueba).');
  } else {
    const hoy = new Date().toISOString().slice(0, 10);
    const draft: any = {
      id: `cert-${Date.now()}`,
      tipoDte: 33,
      fechaEmision: hoy,
      condicionVenta: 'CONTADO',
      fechaVencimiento: hoy,
      rutReceptor: process.env.CERT_RECEPTOR_RUT,
      razonSocialReceptor: process.env.CERT_RECEPTOR_RAZON_SOCIAL || 'Receptor de certificación',
      giroReceptor: 'Certificación',
      direccionReceptor: 'Sin dirección',
      comunaReceptor: 'Santiago',
      ciudadReceptor: 'Santiago',
      emailReceptorDte: '',
      items: [{ id: 'i1', nombre: 'Ítem de certificación', cantidad: 1, unidadMedida: 'C/U', precioUnitario: 1000, montoTotal: 1000 }],
      montoNeto: 1000,
      montoExento: 0,
      montoIva: 190,
      montoTotal: 1190,
    };
    const res = await HttpDteBillingService.emitirDteDesdeBorrador(draft, { rut, razonSocial }, { ambiente: 1, maxRetries: 0 });
    if (!res.success) {
      registrar('Emisión de prueba', 'FALLA', res.error || 'El servicio rechazó la emisión.');
    } else if (!res.trackId) {
      registrar('Emisión de prueba', 'FALLA', `Folio ${res.folio} timbrado, pero el servicio no informó Track ID: el DTE no se envió al SII (estado PENDIENTE).`);
    } else {
      registrar('Emisión de prueba', 'OK', `Folio ${res.folio} timbrado y enviado. Track ID ${res.trackId}.`);
      const maxSeg = Number(process.env.CERT_ESPERA_MAX_SEG || 600);
      const inicio = Date.now();
      let final: any = null;
      while (Date.now() - inicio < maxSeg * 1000) {
        const q = await HttpDteBillingService.consultarEstadoEnvio({ rutEmisor: rut, trackId: res.trackId, ambiente: 1 });
        if (q.ok === false) {
          final = q;
          break;
        }
        if (q.estadoSii !== 'ENVIADO') {
          final = q;
          break;
        }
        console.log(`   … Track ID ${res.trackId}: ${q.codigoSii} (${q.glosa || 'en proceso'})`);
        await esperar(20_000);
      }
      if (!final) registrar('Resultado del SII', 'FALLA', `El envío sigue en proceso tras ${maxSeg} s. Consulte de nuevo más tarde.`);
      else if (final.ok === false) registrar('Resultado del SII', 'FALLA', final.error);
      else
        registrar(
          'Resultado del SII',
          final.estadoSii === 'RECHAZADO' ? 'FALLA' : 'OK',
          `${final.estadoSii} (${final.codigoSii}${final.glosa ? `: ${final.glosa}` : ''}).`
        );
      if (final && final.ok) await HttpDteBillingService.actualizarEstadosEnvio(rut);
    }
  }

  // 5. Descarga RCV con Playwright
  if (!argv.includes('--rcv')) {
    registrar('Descarga RCV (Playwright)', 'OMITIDO', 'Agregue --rcv para descargar el RCV del mes anterior desde el portal del SII.');
  } else {
    const periodo = ultimosPeriodos(2, periodoActual())[1];
    const r = await SiiPlaywrightRunner.execute({ rut, password: process.env.SII_CLAVE, periodo, tipo: 'ALL', headless: true });
    registrar(
      'Descarga RCV (Playwright)',
      r.success ? 'OK' : 'FALLA',
      r.success
        ? `${periodo}: ${r.documentos.length} documento(s) en ${r.csvFiles.length} archivo(s) CSV.`
        : `${periodo}: ${r.error || 'sin detalle'}. Últimos pasos: ${r.logs.slice(-3).join(' | ')}`
    );
  }

  return terminar();
}

function terminar() {
  const fallas = pasos.filter((p) => p.estado === 'FALLA').length;
  const fecha = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  const out = [
    `# 4.3 Verificación en certificación SII · ${new Date().toISOString()}`,
    '',
    `Empresa: ${process.env.CERT_RUT || '(sin CERT_RUT)'} · Resultado: ${fallas === 0 ? 'sin fallas' : `${fallas} falla(s)`}`,
    '',
    '| Paso | Estado | Detalle |',
    '| --- | --- | --- |',
    ...pasos.map((p) => `| ${p.paso} | ${p.estado} | ${p.detalle.replace(/\|/g, '/')} |`),
    '',
  ].join('\n');
  const dir = path.join(process.cwd(), 'docs', 'plan-correccion');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `certificacion-sii-${fecha}.md`);
  fs.writeFileSync(file, out);
  console.log(`\nInforme: ${path.relative(process.cwd(), file)}`);
  process.exit(fallas === 0 ? 0 : 1);
}

main().catch((e) => {
  registrar('Ejecución', 'FALLA', e?.message || String(e));
  terminar();
});
