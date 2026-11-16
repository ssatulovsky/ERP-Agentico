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

async function main() {
  assertVaultSecretPolicy();
  const empresas = listCompanies();
  console.log(`Migración K1–K4 · ${empresas.length} empresas · modo ${aplicar ? 'APLICAR' : 'SOLO INFORME'}`);
  console.log(`Carpeta de datos: ${process.cwd()}/data`);
  if (aplicar) {
    console.log('IMPORTANTE: el servidor debe estar detenido (pm2 stop erpremia). Si sigue corriendo, al guardar');
    console.log('cualquier dato vuelve a escribir su copia en memoria y deshace esta migración.');
  }
  console.log('');

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

  // 2.b Empresas del módulo de seguridad sin ficha en el servidor: se crea una ficha mínima con su
  //     id original (los usuarios, roles y anclas ya apuntan a ese id). El resto de los datos
  //     (giro, dirección, régimen) se completan después en Configuración de clientes.
  const fs = await import('node:fs');
  const path = await import('node:path');
  const rbacPath = path.join(process.cwd(), 'data', 'erp_security_rbac_state.json');
  const rbacCompanies: any[] = fs.existsSync(rbacPath) ? JSON.parse(fs.readFileSync(rbacPath, 'utf8')).companiesConfig || [] : [];
  const norm = (v: any) => String(v || '').replace(/[.\s]/g, '').toUpperCase();
  const claves = new Set(listCompanies().flatMap((c: any) => [norm(c.id), norm(c.rut)].filter(Boolean)));
  const sinFicha = rbacCompanies.filter((c: any) => !claves.has(norm(c.empresaId)) && !(c.rut && claves.has(norm(c.rut))));
  console.log(`2.b Empresas del módulo de seguridad sin ficha en el servidor: ${sinFicha.length}${sinFicha.length && aplicar ? ' → fichas creadas (completar datos en Configuración de clientes)' : ''}`);
  sinFicha.forEach((c: any) => console.log(`    - ${c.razonSocial || '(sin nombre)'} · ${c.empresaId}`));
  if (aplicar && sinFicha.length) {
    saveCompanies([
      ...listCompanies(),
      ...sinFicha.map((c: any) => ({
        id: c.empresaId,
        rut: c.rut || '',
        razonSocial: c.razonSocial || c.nombreCorto || c.empresaId,
        estadoEmpresa: c.estadoCuenta === 'BAJA' ? 'BAJA' : c.estadoCuenta === 'SUSPENDIDA_PAGO' ? 'INACTIVA' : 'ACTIVA',
        ...(c.estadoCuenta === 'SUSPENDIDA_PAGO' ? { motivoInactiva: 'Suspendida por pago antes de la migración K3 (asignar a su Cliente ERP)' } : {}),
        esEmpresaDuenaErp: Boolean(c.esEmpresaDuenaErp),
        empresasAnclasIds: c.empresasAnclasIds || [],
        origenFicha: 'MIGRACION_K_DESDE_SEGURIDAD',
      })),
    ]);
  }

  // 2.c Suspensiones del modelo anterior: el estado comercial ahora vive en el Cliente ERP. Una empresa
  //     suspendida por pago que aún no tiene Cliente ERP quedaría activa; se deja INACTIVA (bloqueada)
  //     hasta asignarla a su Cliente ERP y suspender ese cliente desde el panel SaaS.
  const suspendidas = rbacCompanies.filter((r: any) => r.estadoCuenta === 'SUSPENDIDA_PAGO');
  const aBloquear = listCompanies().filter(
    (c: any) => !c.clienteErpId && c.estadoEmpresa === 'ACTIVA' && suspendidas.some((r: any) => norm(r.empresaId) === norm(c.id) || (r.rut && norm(r.rut) === norm(c.rut)))
  );
  console.log(`2.c Empresas suspendidas por pago en el modelo anterior que quedarían activas: ${aBloquear.length}${aBloquear.length && aplicar ? ' → INACTIVAS (bloqueadas)' : ''}`);
  aBloquear.forEach((c: any) => console.log(`    - ${c.razonSocial} · ${c.id}`));
  if (aplicar && aBloquear.length) {
    const ids = new Set(aBloquear.map((c: any) => c.id));
    saveCompanies(listCompanies().map((c: any) => (ids.has(c.id) ? { ...c, estadoEmpresa: 'INACTIVA', motivoInactiva: 'Suspendida por pago antes de la migración K3 (asignar a su Cliente ERP)' } : c)));
  }

  // 3. Cliente ERP propietario
  const yaExiste = ownerAccount();
  if (yaExiste) {
    console.log(`3. Cliente ERP propietario: ya existe (${yaExiste.razonSocial})`);
  } else if (!listCompanies().some((c: any) => c.esEmpresaDuenaErp) && !rbacCompanies.some((c: any) => c.esEmpresaDuenaErp)) {
    console.log('3. Cliente ERP propietario: ninguna empresa tiene esEmpresaDuenaErp = true. Márquela en la ficha (SuperAdmin) y vuelva a ejecutar.');
  } else if (aplicar) {
    const acc = ensureOwnerAccount(rbacCompanies);
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

void main();
