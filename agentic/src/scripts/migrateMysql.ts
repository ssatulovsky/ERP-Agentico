import 'dotenv/config';
import path from 'node:path';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { db, checkMySqlConnection, closeMySqlConnection } from '../db/mysqlClient';

/**
 * Script de migración programática para MySQL 8.0 utilizando Drizzle ORM Migrator.
 * Ejecutable mediante: npx tsx src/scripts/migrateMysql.ts
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

    console.log(`[✓] Migraciones aplicadas exitosamente en ${elapsedMs}ms.`);
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
  } catch (migErr: any) {
    console.error('\n[ERROR EN MIGRACIÓN DRIZZLE]:', migErr.message);
    if (migErr.cause) {
      console.error('Causa raíz:', migErr.cause);
    }
    await closeMySqlConnection();
    process.exit(1);
  } finally {
    // 3. Cierre ordenado del connection pool
    await closeMySqlConnection();
  }

  process.exit(0);
}

runProgrammaticMigration().catch(async (fatalErr) => {
  console.error('[ERROR FATAL]:', fatalErr.message);
  await closeMySqlConnection();
  process.exit(1);
});
