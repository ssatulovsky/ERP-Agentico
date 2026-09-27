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

    console.log(`[3/3] Aplicando cambios DDL (Centros de Costo, DTEs, RRHH, Órdenes de Trabajo, etc.)...`);

    // Paso defensivo: si cost_centers ya existía con el ENUM restrictivo previo, ampliarlo a VARCHAR(50)
    try {
      await connection.query('ALTER TABLE `cost_centers` MODIFY COLUMN `categoria` VARCHAR(50) NOT NULL;');
      console.log(`[✓] Columna cost_centers.categoria verificada/ampliada a VARCHAR(50).`);
    } catch {
      // Si la tabla no existe aún, se creará correctamente en el script
    }
    
    // Función auxiliar para dividir el script SQL respetando strings entre comillas
    const statements = splitSqlStatements(sqlScript);
    console.log(`[i] Total de sentencias DDL/DML identificadas: ${statements.length}`);

    let appliedCount = 0;
    let skippedCount = 0;

    for (const stmt of statements) {
      try {
        await connection.query(stmt);
        appliedCount++;
      } catch (stmtErr: any) {
        // Tolerancia a idempotencia: columna ya existe (1060), índice ya existe (1061), tabla ya existe (1050)
        if (
          stmtErr.errno === 1060 ||
          stmtErr.code === 'ER_DUP_FIELDNAME' ||
          stmtErr.errno === 1061 ||
          stmtErr.code === 'ER_DUP_KEYNAME' ||
          stmtErr.errno === 1050 ||
          stmtErr.code === 'ER_TABLE_EXISTS_ERROR' ||
          (stmtErr.message && stmtErr.message.includes('Duplicate column name'))
        ) {
          skippedCount++;
        } else {
          console.error(`\n[!] Error ejecutando sentencia DDL:`);
          console.error(stmt.substring(0, 160) + (stmt.length > 160 ? '...' : ''));
          console.error(`Causa: ${stmtErr.message}\n`);
          throw stmtErr;
        }
      }
    }

    console.log(`[✓] Actualización de esquemas completada: ${appliedCount} sentencias ejecutadas, ${skippedCount} existentes omitidas.`);

    console.log('\n================================================================');
    console.log('  BASE DE DATOS MYSQL 8.0 ACTUALIZADA CORRECTAMENTE');
    console.log('================================================================\n');

    await connection.end();
    return {
      success: true,
      message: `Base de datos MySQL actualizada exitosamente (${appliedCount} aplicadas, ${skippedCount} omitidas).`,
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

/**
 * Divide un script SQL en sentencias individuales respetando delimitadores y literales de texto.
 */
function splitSqlStatements(sql: string): string[] {
  // Eliminar comentarios de bloque /* ... */
  const cleanSql = sql.replace(/\/\*[\s\S]*?\*\//g, '');
  
  const statements: string[] = [];
  let current = '';
  let inString = false;
  let stringChar = '';

  for (let i = 0; i < cleanSql.length; i++) {
    const char = cleanSql[i];
    const prevChar = i > 0 ? cleanSql[i - 1] : '';

    if (!inString && (char === "'" || char === '"' || char === '`')) {
      inString = true;
      stringChar = char;
      current += char;
    } else if (inString && char === stringChar && prevChar !== '\\') {
      inString = false;
      current += char;
    } else if (!inString && char === ';') {
      const trimmed = current.trim();
      if (trimmed.length > 0) {
        statements.push(trimmed);
      }
      current = '';
    } else {
      current += char;
    }
  }

  const lastTrimmed = current.trim();
  if (lastTrimmed.length > 0) {
    statements.push(lastTrimmed);
  }

  // Filtrar declaraciones vacías o que solo contengan comentarios de línea
  return statements.filter((stmt) => {
    const stripped = stmt.replace(/^--.*$/gm, '').trim();
    return stripped.length > 0;
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  updateMysqlDatabase().then((res) => {
    process.exit(res.success ? 0 : 1);
  });
}
