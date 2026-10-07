import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';

/**
 * Script de inicialización y migración DDL nativa para MySQL 8.0.
 * Crea la base de datos `chile_erp`, todas las tablas operativas y los datos semilla.
 *
 * Ejecución:
 *   npx tsx src/scripts/initMysqlDb.ts
 */
export async function initializeMysqlDatabase(): Promise<{
  success: boolean;
  tablesCreated: string[];
  message: string;
}> {
  console.log('================================================================');
  console.log('  INICIALIZACIÓN DE BASE DE DATOS Y TABLAS EN MYSQL 8.0');
  console.log('  Sistema ERP Contable Chileno - Persistencia Robusta');
  console.log('================================================================\n');

  const connectionUri = process.env.MYSQL_URL || process.env.DATABASE_URL;
  const host = process.env.MYSQL_HOST || '127.0.0.1';
  const port = Number(process.env.MYSQL_PORT) || 3306;
  const user = process.env.MYSQL_USER || 'root';
  const password = process.env.MYSQL_PASSWORD || '';
  let database = process.env.MYSQL_DATABASE || '';
  if (!database && connectionUri) {
    try {
      const parsedUrl = new URL(connectionUri.replace(/^mysql:\/\//i, 'http://'));
      database = parsedUrl.pathname.replace(/^\//, '').split('?')[0];
    } catch {}
  }
  if (!database) {
    database = 'erp_contable';
  }

  console.log(`[1/4] Estableciendo conexión con servidor MySQL en ${host}:${port} (Usuario: ${user}, BD: ${database})...`);

  let connection: mysql.Connection | null = null;
  try {
    if (connectionUri) {
      connection = await mysql.createConnection({
        uri: connectionUri,
        multipleStatements: true,
      });
    } else {
      // Conectar inicialmente sin especificar base de datos para poder crearla si no existe
      connection = await mysql.createConnection({
        host,
        port,
        user,
        password,
        multipleStatements: true,
      });
    }
  } catch (connErr: any) {
    console.error(`\n[ERROR DE CONEXIÓN MYSQL 8.0]: ${connErr.message}`);
    console.warn(`Verifique que MySQL esté corriendo y que las credenciales en .env sean correctas.`);
    return {
      success: false,
      tablesCreated: [],
      message: connErr.message,
    };
  }

  try {
    // 2. Crear base de datos si no existe o usar existente
    console.log(`[2/4] Asegurando existencia y selección de la base de datos \`${database}\`...`);
    try {
      await connection.query(
        `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
      );
    } catch (createErr: any) {
      console.log(`[i] Permisos directos sobre BD \`${database}\` (sin permiso global CREATE DATABASE): continuando.`);
    }
    await connection.query(`USE \`${database}\`;`);
    console.log(`[✓] Base de datos \`${database}\` lista y seleccionada.`);

    // 3. Leer archivo SQL de inicialización
    const sqlFilePath = path.resolve(process.cwd(), 'scripts/init_mysql_database.sql');
    console.log(`[3/4] Leyendo script DDL desde: ${sqlFilePath}...`);

    if (!fs.existsSync(sqlFilePath)) {
      throw new Error(`El archivo de inicialización '${sqlFilePath}' no existe.`);
    }

    const sqlScript = fs.readFileSync(sqlFilePath, 'utf-8');

    console.log(`[3/4] Ejecutando DDL, relaciones y datos semilla en MySQL 8.0...`);
    await connection.query(sqlScript);
    console.log(`[✓] Sentencias SQL ejecutadas correctamente.`);

    // 4. Verificación de tablas creadas
    console.log(`\n[4/4] Verificando tablas creadas en \`${database}\`...`);
    const [rows]: [any[], any] = await connection.query(`SHOW TABLES;`);
    const tableKey = Object.keys(rows[0] || {})[0];
    const tables: string[] = rows.map((r: any) => r[tableKey]);

    console.log(`[✓] Se detectaron ${tables.length} tablas en MySQL 8.0:`);
    tables.forEach((t, idx) => {
      console.log(`    ${String(idx + 1).padStart(2, ' ')}. ${t}`);
    });

    console.log('\n================================================================');
    console.log('  BASE DE DATOS INICIALIZADA EXITOSAMENTE EN MYSQL 8.0');
    console.log('================================================================\n');

    return {
      success: true,
      tablesCreated: tables,
      message: `Base de datos ${database} inicializada con ${tables.length} tablas.`,
    };
  } catch (execErr: any) {
    console.error(`\n[ERROR AL EJECUTAR SCRIPT SQL]: ${execErr.message}`);
    return {
      success: false,
      tablesCreated: [],
      message: execErr.message,
    };
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Ejecución directa si se invoca desde la terminal
if (process.argv[1]?.includes('initMysqlDb')) {
  initializeMysqlDatabase()
    .then((res) => {
      if (!res.success) {
        process.exit(1);
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error('[ERROR FATAL]:', err);
      process.exit(1);
    });
}
