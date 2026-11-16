/**
 * Migración de datos existentes a K1–K4 (configuración de clientes y SaaS).
 *
 * Uso:  npm run migrate:k            → solo informa (no cambia nada)
 *       npm run migrate:k -- --aplicar → aplica los cambios automáticos
 *
 * Cambios automáticos (con --aplicar):
 *  1. Cifra en la bóveda las claves SII guardadas en texto plano en la ficha de empresa.
 *  2. Completa estadoEmpresa = ACTIVA en las empresas que no lo tienen.
 *  3. Crea el Cliente ERP propietario a partir de la empresa marcada esEmpresaDuenaErp.
 *  4. Migra los planes de cuentas guardados por RUT al id canónico de la empresa.
 *
 * Lo que informa y queda para decisión humana:
 *  - Empresas sin Cliente ERP (no se cobran ni cuentan contra límites): asignarlas en el panel SaaS.
 *  - Empresas sin plan de cuentas (sus asientos serán rechazados): inicializarlo desde Contabilidad.
 *  - Empresas sin cuentas por defecto en los parámetros de sistema.
 */
import { listCompanies, saveCompanies } from '../services/companyRegistryService';
import { encryptToVaultString, isVaultString, assertVaultSecretPolicy } from '../utils/vaultCrypto';
import { ensureOwnerAccount, ownerAccount } from '../services/saasAccountService';
import { getCompanyChartState, getCompanySystemParameters } from '../services/chartOfAccountsServerService';
import { diskPersistence } from '../services/diskPersistenceService';

const aplicar = process.argv.includes('--aplicar');

function main() {
  assertVaultSecretPolicy();
  const empresas = listCompanies();
  console.log(`Migración K1–K4 · ${empresas.length} empresas · modo ${aplicar ? 'APLICAR' : 'SOLO INFORME'}\n`);

  // 1 y 2. Clave SII en texto plano y estado de empresa
  let clavesPlanas = 0;
  let sinEstado = 0;
  const actualizadas = empresas.map((c: any) => {
    const next = { ...c };
    if (c.claveSii && !isVaultString(String(c.claveSii))) {
      clavesPlanas++;
      next.claveSii = encryptToVaultString(String(c.claveSii));
    }
    if (!c.estadoEmpresa) {
      sinEstado++;
      next.estadoEmpresa = c.activa === false || c.inactivo === true ? 'INACTIVA' : 'ACTIVA';
    }
    return next;
  });
  console.log(`1. Claves SII en texto plano: ${clavesPlanas}${clavesPlanas && aplicar ? ' → cifradas' : ''}`);
  console.log(`2. Empresas sin estadoEmpresa: ${sinEstado}${sinEstado && aplicar ? ' → completado' : ''}`);
  if (aplicar && (clavesPlanas || sinEstado)) saveCompanies(actualizadas);

  // 3. Cliente ERP propietario
  const yaExiste = ownerAccount();
  if (yaExiste) {
    console.log(`3. Cliente ERP propietario: ya existe (${yaExiste.razonSocial})`);
  } else if (!listCompanies().some((c: any) => c.esEmpresaDuenaErp)) {
    console.log('3. Cliente ERP propietario: ninguna empresa tiene esEmpresaDuenaErp = true. Márquela en la ficha (SuperAdmin) y vuelva a ejecutar.');
  } else if (aplicar) {
    const acc = ensureOwnerAccount();
    console.log(`3. Cliente ERP propietario: creado (${acc?.razonSocial})`);
  } else {
    console.log('3. Cliente ERP propietario: se creará con --aplicar');
  }

  // 4. Planes de cuentas (getCompanyChartState migra los guardados por RUT al leerlos)
  const sinPlan: string[] = [];
  const sinParametros: string[] = [];
  const sinCliente: string[] = [];
  for (const c of listCompanies()) {
    const etiqueta = `${c.razonSocial || '(sin razón social)'} · ${c.rut || c.id}`;
    if (c.estadoEmpresa === 'BAJA') continue;
    const tienePlan = aplicar
      ? getCompanyChartState(c.id).estado !== 'SIN_PLAN'
      : [c.id, c.rut, String(c.rut || '').replace(/\./g, '')].some((k) => k && (diskPersistence.getCompanyChart(k) || []).length > 0);
    if (!tienePlan) sinPlan.push(etiqueta);
    const p: any = getCompanySystemParameters(c.id) || {};
    if (!Object.keys(p).some((k) => k.startsWith('cuenta') && p[k])) sinParametros.push(etiqueta);
    if (!c.clienteErpId) sinCliente.push(etiqueta);
  }
  console.log(`4. Planes de cuentas guardados por RUT: ${aplicar ? 'migrados al id de la empresa' : 'se migran con --aplicar (o solos, al primer uso)'}`);


  console.log(`\nPendientes de decisión humana:`);
  console.log(`- Empresas SIN plan de cuentas (${sinPlan.length}) — sus asientos se rechazarán hasta inicializarlo en Contabilidad → Plan de cuentas:`);
  sinPlan.forEach((e) => console.log(`  - ${e}`));
  console.log(`- Empresas sin Cliente ERP (${sinCliente.length}) — asignar en Administración SaaS (no se facturan ni cuentan contra límites):`);
  sinCliente.forEach((e) => console.log(`  - ${e}`));
  console.log(`- Empresas sin cuentas por defecto en parámetros de sistema (${sinParametros.length}) — configurar en Parámetros de sistema:`);
  sinParametros.forEach((e) => console.log(`  - ${e}`));
}

main();
