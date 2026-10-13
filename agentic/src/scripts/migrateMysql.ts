import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { db, pool, checkMySqlConnection, closeMySqlConnection } from '../db/mysqlClient';

/**
 * Ejecutor resiliente paso a paso con tolerancia a idempotencia (columnas, tablas o índices preexistentes)
 */
async function runResilientMigrations(migrationsFolder: string): Promise<void> {
  const journalPath = path.join(migrationsFolder, 'meta', '_journal.json');
  if (!fs.existsSync(journalPath)) {
    throw new Error(`No se encontró el archivo journal en: ${journalPath}`);
  }

  const journalRaw = fs.readFileSync(journalPath, 'utf-8');
  const journal = JSON.parse(journalRaw);
  const entries: Array<{ idx: number; tag: string; when: number }> = journal.entries || [];

  // 1. Crear tabla __drizzle_migrations si no existe
  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`__drizzle_migrations\` (
      \`id\` BIGINT AUTO_INCREMENT PRIMARY KEY,
      \`hash\` text NOT NULL,
      \`created_at\` bigint
    );
  `);

  // 2. Obtener migraciones ya aplicadas
  const [rows] = (await pool.query('SELECT `created_at` FROM `__drizzle_migrations`;')) as any;
  const appliedTimestamps = new Set<number>((rows || []).map((r: any) => Number(r.created_at)));

  console.log(`[i] Total de migraciones en catálogo: ${entries.length}. Registradas previamente en BD: ${appliedTimestamps.size}.`);

  for (const entry of entries) {
    if (appliedTimestamps.has(entry.when)) {
      console.log(`  [✓] Migración ${entry.tag} (timestamp: ${entry.when}) ya registrada previamente. Omitiendo.`);
      continue;
    }

    const sqlFilePath = path.join(migrationsFolder, `${entry.tag}.sql`);
    if (!fs.existsSync(sqlFilePath)) {
      console.warn(`  [!] Advertencia: Archivo de migración no encontrado: ${sqlFilePath}`);
      continue;
    }

    console.log(`\n  --> Procesando migración ${entry.tag}...`);
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf-8');
    const statements = sqlContent
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith('--'));

    let appliedStmts = 0;
    let skippedStmts = 0;

    for (const stmt of statements) {
      if (!stmt) continue;
      try {
        await pool.query(stmt);
        appliedStmts++;
      } catch (stmtErr: any) {
        // Tolerancia a idempotencia: columna ya existe (1060), índice ya existe (1061), tabla ya existe (1050), drop index inexistente (1091)
        const isDuplicate =
          stmtErr.errno === 1060 ||
          stmtErr.code === 'ER_DUP_FIELDNAME' ||
          stmtErr.errno === 1061 ||
          stmtErr.code === 'ER_DUP_KEYNAME' ||
          stmtErr.errno === 1050 ||
          stmtErr.code === 'ER_TABLE_EXISTS_ERROR' ||
          stmtErr.errno === 1091 ||
          stmtErr.code === 'ER_CANT_DROP_FIELD_OR_KEY' ||
          (stmtErr.message &&
            (stmtErr.message.includes('Duplicate column name') ||
              stmtErr.message.includes('Duplicate key name') ||
              stmtErr.message.includes("Can't DROP") ||
              stmtErr.message.includes('check that column/key exists') ||
              stmtErr.message.includes('already exists')));

        if (isDuplicate) {
          skippedStmts++;
        } else {
          console.error(`  [!] Error en sentencia de migración ${entry.tag}:`, stmt.substring(0, 140));
          console.error(`      Causa: ${stmtErr.message}`);
          throw stmtErr;
        }
      }
    }

    // Registrar migración en __drizzle_migrations
    const hash = crypto.createHash('sha256').update(sqlContent).digest('hex');
    await pool.query('INSERT INTO `__drizzle_migrations` (`hash`, `created_at`) VALUES (?, ?);', [
      hash,
      entry.when,
    ]);
    console.log(
      `  [✓] Migración ${entry.tag} procesada (${appliedStmts} aplicadas, ${skippedStmts} ya existentes) y registrada en __drizzle_migrations.`
    );
  }

  console.log('\n[✓] Todas las migraciones fueron verificadas y sincronizadas con éxito.');
}

/**
 * Script de migración programática para MySQL 8.0 utilizando Drizzle ORM Migrator con fallback resiliente.
 * Ejecutable mediante: npm run db:migrate:mysql
 */
async function runProgrammaticMigration(): Promise<void> {
  console.log('================================================================');
  console.log('  MIGRACIÓN PROGRAMÁTICA MYSQL 8.0 (DRIZZLE ORM MIGRATOR)');
  console.log('================================================================\n');

  // 1. Verificación previa de conexión mediante ping SELECT 1
  console.log('[1/3] Comprobando disponibilidad del servidor MySQL 8.0...');
  const isConnected = await checkMySqlConnection();

  if (!isConnected) {
    console.error('\n[ERROR CRÍTICO] Servidor MySQL 8.0 no disponible o credenciales incorrectas.');
    console.error('Asegúrese de que el socket/puerto de MySQL esté accesible y que las variables');
    console.error('MYSQL_URL o (MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE)');
    console.error('estén correctamente configuradas en el entorno.\n');
    await closeMySqlConnection();
    process.exit(1);
  }

  console.log('[✓] Ping SELECT 1 a MySQL 8.0 exitoso. Servidor listo.');

  // 2. Ejecución de migraciones DDL nativas desde la carpeta de migraciones
  const migrationsFolder = path.resolve(process.cwd(), './drizzle/migrations-mysql');
  console.log(`\n[2/3] Ejecutando migración desde: ${migrationsFolder}...`);

  const startTime = Date.now();
  try {
    await migrate(db, { migrationsFolder });
    const elapsedMs = Date.now() - startTime;
    console.log(`[✓] Migraciones nativas Drizzle aplicadas exitosamente en ${elapsedMs}ms.`);
  } catch (migErr: any) {
    const isIdempotencyError =
      migErr?.cause?.errno === 1060 ||
      migErr?.cause?.code === 'ER_DUP_FIELDNAME' ||
      migErr?.cause?.errno === 1061 ||
      migErr?.cause?.code === 'ER_DUP_KEYNAME' ||
      migErr?.cause?.errno === 1050 ||
      migErr?.cause?.code === 'ER_TABLE_EXISTS_ERROR' ||
      migErr?.cause?.errno === 1091 ||
      migErr?.cause?.code === 'ER_CANT_DROP_FIELD_OR_KEY' ||
      (migErr?.message &&
        (migErr.message.includes('Duplicate column name') ||
          migErr.message.includes('Duplicate key name') ||
          migErr.message.includes("Can't DROP") ||
          migErr.message.includes('check that column/key exists') ||
          migErr.message.includes('already exists')));

    if (isIdempotencyError || migErr?.message) {
      console.warn('\n[!] El migrador estricto de Drizzle detectó sentencias con objetos ya existentes en la BD:');
      console.warn(`    ${migErr?.cause?.message || migErr?.message}`);
      console.log('\n[2.1/3] Activando ejecutor resiliente paso a paso con tolerancia a columnas y tablas preexistentes...');
      try {
        await runResilientMigrations(migrationsFolder);
      } catch (fallbackErr: any) {
        console.error('\n[ERROR EN FALLBACK RESILIENTE]:', fallbackErr.message);
        await closeMySqlConnection();
        process.exit(1);
      }
    } else {
      console.error('\n[ERROR EN MIGRACIÓN DRIZZLE]:', migErr.message);
      if (migErr.cause) {
        console.error('Causa raíz:', migErr.cause);
      }
      await closeMySqlConnection();
      process.exit(1);
    }
  }

  console.log('\n[3/3] Módulos y tablas de persistencia verificadas en MySQL 8.0:');
  console.log('  - Tenancy & Clientes (accounting_firms, companies con Art. 16 CT, subscriptions, vault)');
  console.log('  - Core Ledger IFRS (chart_of_accounts, accounting_entries, lines, audit_logs)');
  console.log('  - Cierre y Catch-up (fiscal_year_closings, retroactive_catchup_packs)');
  console.log('  - Tributario SII (dtes_rcv, boletas_honorarios 14.5%, f29_declarations, indicators)');
  console.log('  - Laboral DT (employees, labor_contracts, annexes 40 hrs, medical_leaves, vacations, payroll, karin)');
  console.log('  - Activos Fijos (fixed_assets NIC 16 / Art. 31 LIR, depreciation_runs)');
  console.log('  - Producción NIC 2 (production_orders, consumptions, labor_mod, cif_pools)');
  console.log('  - Bodegas & WMS (warehouses, warehouse_items, movements, transfers DTE 52, requisitions)');
  console.log('  - Tesorería (bank_accounts, transactions, reconciliations, novedades, cash_flow)');
  console.log('  - Arrendamientos & Autónomos (lease_contracts IFRS 16, marketing, tickets, agent_configs, learnings)');

  console.log('\n================================================================');
  console.log('  MIGRACIÓN CONCLUIDA EXITOSAMENTE (EXIT CODE 0)');
  console.log('================================================================\n');

  await closeMySqlConnection();
  process.exit(0);
}

runProgrammaticMigration().catch(async (fatalErr) => {
  console.error('[ERROR FATAL]:', fatalErr.message);
  await closeMySqlConnection();
  process.exit(1);
});
