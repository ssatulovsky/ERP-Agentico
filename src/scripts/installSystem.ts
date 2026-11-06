import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { hashPassword } from '../utils/passwordCrypto';
import { DEFAULT_SECURITY_RBAC_STATE, SecurityUser } from '../services/securityRbacService';

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
 * Ejecución:
 *   npx tsx src/scripts/installSystem.ts
 */
export function generateSecureOneTimePassword(length = 16): string {
  const bytes = crypto.randomBytes(length);
  const base = bytes.toString('base64url').replace(/[^a-zA-Z0-9]/g, '');
  return `Init_${base.slice(0, length)}!26`;
}

export async function runSystemInstallation(): Promise<{
  success: boolean;
  credentials: Array<{ username: string; tempPass: string; role: string }>;
}> {
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

if (process.argv[1] && process.argv[1].endsWith('installSystem.ts')) {
  runSystemInstallation().catch((err) => {
    console.error('Error durante la instalación inicial:', err);
    process.exit(1);
  });
}
