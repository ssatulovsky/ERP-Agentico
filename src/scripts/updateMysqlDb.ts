import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';

/**
 * Script para aplicar actualizaciones incrementales de esquema DDL en MySQL 8.0.
 * Ejecución:
 *   npm run db:update:mysql
 *   o
 *   npx tsx src/scripts/updateMysqlDb.ts
 */
export async function updateMysqlDatabase(): Promise<{
  success: boolean;
  message: string;
}> {
  console.log('================================================================');
  console.log('  ACTUALIZACIÓN INCREMENTAL DE ESQUEMAS EN MYSQL 8.0');
  console.log('  Sistema ERP Agéntico Contable Chileno');
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

  console.log(`[1/3] Conectando a MySQL en ${host}:${port} (BD: ${database})...`);

  let connection: mysql.Connection | null = null;
  try {
    if (connectionUri) {
      connection = await mysql.createConnection({
        uri: connectionUri,
        multipleStatements: true,
      });
    } else {
      connection = await mysql.createConnection({
        host,
        port,
        user,
        password,
        database,
        multipleStatements: true,
      });
    }
    console.log(`[✓] Conexión establecida.`);
  } catch (connErr: any) {
    console.error(`\n[ERROR DE CONEXIÓN MYSQL 8.0]: ${connErr.message}`);
    return {
      success: false,
      message: connErr.message,
    };
  }

  try {
    await connection.query(`USE \`${database}\`;`);

    const sqlFilePath = path.resolve(process.cwd(), 'scripts/update_erp_tenancy_mysql.sql');
    console.log(`[2/3] Leyendo script de actualización DDL: ${sqlFilePath}...`);

    if (!fs.existsSync(sqlFilePath)) {
      throw new Error(`El archivo de migración '${sqlFilePath}' no existe.`);
    }

    let sqlScript = fs.readFileSync(sqlFilePath, 'utf-8');

    // Sanitizar directivas específicas de MySQL CLI (como DELIMITER) que no son parte del protocolo wire
    sqlScript = sqlScript
      .replace(/^[\t ]*DELIMITER\s+.*$/gim, '')
      .replace(/\$\$/g, ';');

    console.log(`[3/3] Aplicando cambios DDL (Centros de Costo, DTEs, Activos Fijos, etc.)...`);
    await connection.query(sqlScript);
    console.log(`[✓] Actualización de esquemas completada exitosamente.`);

    console.log('\n================================================================');
    console.log('  BASE DE DATOS MYSQL 8.0 ACTUALIZADA CORRECTAMENTE');
    console.log('================================================================\n');

    await connection.end();
    return {
      success: true,
      message: 'Base de datos MySQL actualizada exitosamente.',
    };
  } catch (err: any) {
    console.error(`\n[ERROR AL ACTUALIZAR]: ${err.message}`);
    if (connection) {
      await connection.end();
    }
    return {
      success: false,
      message: err.message,
    };
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  updateMysqlDatabase().then((res) => {
    process.exit(res.success ? 0 : 1);
  });
}
