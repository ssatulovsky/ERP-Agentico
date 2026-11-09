import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { hashPassword } from '../utils/passwordCrypto';
import { DEFAULT_SECURITY_RBAC_STATE, SecurityUser } from '../services/securityRbacService';
import { isDemoModeEnabled } from '../config/demoMode';
import { validateRutChileno } from '../utils/chileanAccounting';

/**
 * Script Oficial de Instalación Inicial del Sistema ERPremIA v2.0.0.
 *
 * Cumplimiento de Seguridad y Auditoría:
 * - Instalación inicial SIN contraseñas conocidas ni predeterminadas.
 * - Generación aleatoria criptográficamente segura de claves únicas por usuario.
 * - Hashing obligatorio con scrypt (N=16384, r=8, p=1).
 * - Marcado forzoso de 'debeCambiarPassword: true' en todos los usuarios.
 * - Bloqueo de rutas de negocio hasta que el usuario cambie su clave temporal.
 *
 * Ejecución (instalación real): solo la empresa y el administrador indicados, sin datos de ejemplo.
 *   npx tsx src/scripts/installSystem.ts --empresa-rut 76.123.456-0 --razon-social "Mi Empresa SpA" \
 *     [--admin usuario] [--nombre "Nombre Apellido"] [--email correo@empresa.cl]
 *
 * Con DEMO_MODE=true se instalan las empresas y los usuarios de ejemplo de la demostración.
 */
export function generateSecureOneTimePassword(length = 16): string {
  const bytes = crypto.randomBytes(length);
  const base = bytes.toString('base64url').replace(/[^a-zA-Z0-9]/g, '');
  return `Init_${base.slice(0, length)}!26`;
}

export interface FirstCompanyInput {
  empresaRut: string;
  razonSocial: string;
  adminUsername?: string;
  adminNombre?: string;
  adminEmail?: string;
}

/**
 * 4.5: estado de seguridad de una instalación real: la empresa indicada y un administrador
 * (SuperAdmin) asignado a ella. Antes toda instalación traía las empresas y usuarios de ejemplo
 * (InnovAgile, Retail Logistics…), también en producción.
 */
export function buildFirstInstallState(input: FirstCompanyInput, tempPassword: string) {
  const rut = String(input.empresaRut || '').trim();
  if (!validateRutChileno(rut)) throw new Error(`RUT de empresa inválido: "${rut}".`);
  if (!String(input.razonSocial || '').trim()) throw new Error('Falta la razón social de la empresa.');
  const empresaId = rut.replace(/\./g, '').toUpperCase();
  const hoy = new Date().toISOString().slice(0, 10);
  const username = (input.adminUsername || 'admin').trim();
  const user: SecurityUser = {
    // Id propio: no debe coincidir con los usuarios de la demostración.
    id: `usr-admin-${crypto.randomUUID().slice(0, 8)}`,
    username,
    password: hashPassword(tempPassword),
    nombreCompleto: input.adminNombre || 'Administrador del sistema',
    cargo: 'Administrador',
    email: input.adminEmail || '',
    telefonoWhatsapp: '',
    estado: 'ACTIVO',
    rolId: 'role-superadmin',
    empresaPrincipalId: empresaId,
    empresasAnclasPermitidas: [empresaId],
    recibirAudioWhatsapp: false,
    debeCambiarPassword: true,
  } as SecurityUser;
  const state = {
    ...DEFAULT_SECURITY_RBAC_STATE,
    version: Date.now(),
    mostrarPanelPruebasLogin: false,
    companiesConfig: [
      {
        empresaId,
        rut,
        razonSocial: input.razonSocial.trim(),
        nombreCorto: input.razonSocial.trim(),
        estadoCuenta: 'ACTIVA',
        esEmpresaDuenaErp: true,
        empresasAnclasIds: [],
        fechaUltimoCambioEstado: hoy,
      },
    ],
    users: [user],
  };
  const client = { id: empresaId, rut, razonSocial: input.razonSocial.trim(), activo: true, fechaCreacion: hoy };
  return { state, client, username, empresaId };
}

function argValue(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

export async function runSystemInstallation(): Promise<{
  success: boolean;
  credentials: Array<{ username: string; tempPass: string; role: string }>;
}> {
  if (!isDemoModeEnabled()) return runFirstCompanyInstallation();

  console.log('========================================================================');
  console.log('   INSTALACIÓN INICIAL ERPremIA: GENERACIÓN DE CREDENCIALES SEGURAS     ');
  console.log('========================================================================\n');

  const generatedCredentials: Array<{ username: string; tempPass: string; role: string }> = [];

  const freshUsers: SecurityUser[] = DEFAULT_SECURITY_RBAC_STATE.users.map((u) => {
    const tempPassword = generateSecureOneTimePassword(16);
    generatedCredentials.push({
      username: u.username,
      tempPass: tempPassword,
      role: u.rolId,
    });

    return {
      ...u,
      password: hashPassword(tempPassword),
      debeCambiarPassword: true,
    };
  });

  const freshRbacState = {
    ...DEFAULT_SECURITY_RBAC_STATE,
    version: Date.now(),
    users: freshUsers,
  };

  const dataDir = path.resolve(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const rbacPath = path.join(dataDir, 'erp_security_rbac_state.json');
  fs.writeFileSync(rbacPath, JSON.stringify(freshRbacState, null, 2), 'utf-8');

  console.log(`[✓] Estado de seguridad RBAC inicializado en: ${rbacPath}`);
  console.log('[✓] Hashes scrypt calculados con salt criptográfico individual.');
  console.log('[✓] Flag `debeCambiarPassword: true` activado para todos los perfiles.\n');

  console.log('------------------------------------------------------------------------');
  console.log('  CREDENCIALES TEMPORALES GENERADAS ALEATORIAMENTE (USO ÚNICO):');
  console.log('------------------------------------------------------------------------');
  for (const cred of generatedCredentials) {
    console.log(`  👤 Usuario: ${cred.username.padEnd(16)} | Clave Temporal: ${cred.tempPass.padEnd(26)} | Rol: ${cred.role}`);
  }
  console.log('------------------------------------------------------------------------');
  console.log('⚠️  AVISO DE AUDITORÍA Y SEGURIDAD:');
  console.log('   Estas credenciales son de uso único. El sistema exigirá un cambio de clave');
  console.log('   obligatorio (12+ caracteres) en el primer inicio de sesión.');
  console.log('========================================================================\n');

  return {
    success: true,
    credentials: generatedCredentials,
  };
}

/** Instalación real: escribe el estado de seguridad y registra la empresa como cliente del ERP. */
async function runFirstCompanyInstallation() {
  const empresaRut = argValue('empresa-rut') || process.env.INSTALL_EMPRESA_RUT || '';
  const razonSocial = argValue('razon-social') || process.env.INSTALL_RAZON_SOCIAL || '';
  if (!empresaRut || !razonSocial) {
    throw new Error(
      'Indique la primera empresa: --empresa-rut 76.123.456-0 --razon-social "Mi Empresa SpA" ' +
        '(o DEMO_MODE=true para instalar la demostración).'
    );
  }
  const tempPassword = generateSecureOneTimePassword(16);
  const { state, client, username, empresaId } = buildFirstInstallState(
    { empresaRut, razonSocial, adminUsername: argValue('admin'), adminNombre: argValue('nombre'), adminEmail: argValue('email') },
    tempPassword
  );

  const dataDir = path.resolve(process.cwd(), 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  const rbacPath = path.join(dataDir, 'erp_security_rbac_state.json');
  if (fs.existsSync(rbacPath) && !process.argv.includes('--reemplazar')) {
    throw new Error(`Ya existe ${rbacPath}. Use --reemplazar para reinstalar (se pierden los usuarios actuales).`);
  }
  fs.writeFileSync(rbacPath, JSON.stringify(state, null, 2), 'utf-8');

  const { diskPersistence } = await import('../services/diskPersistenceService');
  const snap: any = diskPersistence.getSnapshot();
  const otros = (snap.clients || []).filter((c: any) => c.id !== empresaId);
  diskPersistence.updateCollection('clients', [...otros, client]);
  diskPersistence.flushToDiskSync();

  console.log('========================================================================');
  console.log('   INSTALACIÓN INICIAL ERPremIA');
  console.log('========================================================================');
  console.log(`  Empresa: ${client.razonSocial} (${client.rut}) · id ${empresaId}`);
  console.log(`  👤 Usuario: ${username} | Clave Temporal: ${tempPassword} | Rol: role-superadmin`);
  console.log('  La clave es de uso único: el sistema exige cambiarla (12+ caracteres) al primer ingreso.');
  console.log('  Otros usuarios y empresas se crean desde Seguridad, Roles & Empresas.');
  console.log('========================================================================');
  return { success: true, credentials: [{ username, tempPass: tempPassword, role: 'role-superadmin' }] };
}

if (process.argv[1] && process.argv[1].endsWith('installSystem.ts')) {
  runSystemInstallation().catch((err) => {
    console.error('Error durante la instalación inicial:', err);
    process.exit(1);
  });
}
