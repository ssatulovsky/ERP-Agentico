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

    // Paso defensivo: si cost_centers ya existía con el ENUM restrictivo previo, ampliarlo a VARCHAR(100)
    try {
      await connection.query("ALTER TABLE `cost_centers` MODIFY COLUMN `categoria` VARCHAR(100) NOT NULL DEFAULT 'ADMINISTRACION';");
      console.log(`[✓] Columna cost_centers.categoria verificada/ampliada preventivamente a VARCHAR(100).`);
    } catch {
      // Si la tabla no existe aún, se creará correctamente en el script
    }

    // Paso defensivo: asegurar las columnas de los 5 conceptos contables avanzados
    const defensiveColumns = [
      { table: 'chart_of_accounts', col: 'maneja_multimoneda', type: 'BOOLEAN NOT NULL DEFAULT FALSE' },
      { table: 'chart_of_accounts', col: 'requiere_doc_ref', type: 'BOOLEAN NOT NULL DEFAULT FALSE' },
      { table: 'chart_of_accounts', col: 'es_efectivo_equivalente', type: 'BOOLEAN NOT NULL DEFAULT FALSE' },
      { table: 'chart_of_accounts', col: 'es_contracuenta_efectivo', type: 'BOOLEAN NOT NULL DEFAULT FALSE' },
      { table: 'chart_of_accounts', col: 'requiere_proyecto', type: 'BOOLEAN NOT NULL DEFAULT FALSE' },
      { table: 'chart_of_accounts', col: 'moneda_codigo', type: "VARCHAR(10) NULL DEFAULT 'CLP'" },
      { table: 'chart_of_accounts', col: 'notas_explicativas', type: 'JSON NULL' },
      { table: 'chart_of_accounts_master', col: 'es_efectivo_equivalente', type: 'BOOLEAN NOT NULL DEFAULT FALSE' },
      { table: 'chart_of_accounts_master', col: 'es_contracuenta_efectivo', type: 'BOOLEAN NOT NULL DEFAULT FALSE' },
      // companies: Gobernanza y multimoneda
      { table: 'companies', col: 'ejercicios_cerrados', type: 'JSON NULL' },
      { table: 'companies', col: 'reapertura_extraordinaria_activa', type: 'JSON NULL' },
      { table: 'companies', col: 'auditoria_reaperturas', type: 'JSON NULL' },
      { table: 'companies', col: 'moneda_defecto', type: "VARCHAR(10) NOT NULL DEFAULT 'CLP'" },
      { table: 'companies', col: 'monedas_habilitadas', type: 'JSON NULL' },
      { table: 'companies', col: 'cuenta_dif_cambio_ganancia_id', type: "VARCHAR(30) NULL DEFAULT '7.1.01.002'" },
      { table: 'companies', col: 'cuenta_dif_cambio_perdida_id', type: "VARCHAR(30) NULL DEFAULT '7.2.01.002'" },
      // accounting_entries: Multi-Estudio y Referencia formal extendida
      { table: 'accounting_entries', col: 'firm_id', type: "VARCHAR(36) NOT NULL DEFAULT 'firm-default-001'" },
      { table: 'accounting_entries', col: 'documento_referencia', type: 'VARCHAR(150) NULL' },
      { table: 'accounting_entries', col: 'tipo_documento_ref', type: 'VARCHAR(50) NULL' },
      { table: 'accounting_entries', col: 'folio_documento_ref', type: 'VARCHAR(100) NULL' },
      // accounting_entry_lines: Correlativo, documentos no-SII y multimoneda
      { table: 'accounting_entry_lines', col: 'linea_numero', type: 'INT NOT NULL DEFAULT 1' },
      { table: 'accounting_entry_lines', col: 'proyecto', type: 'VARCHAR(100) NULL' },
      { table: 'accounting_entry_lines', col: 'documento_ref', type: 'VARCHAR(150) NULL' },
      { table: 'accounting_entry_lines', col: 'dte_id_asociado', type: 'VARCHAR(36) NULL' },
      { table: 'accounting_entry_lines', col: 'tipo_documento_ref', type: 'VARCHAR(50) NULL' },
      { table: 'accounting_entry_lines', col: 'folio_documento_ref', type: 'VARCHAR(100) NULL' },
      { table: 'accounting_entry_lines', col: 'monto_documento_ref', type: 'DECIMAL(15, 2) NULL' },
      { table: 'accounting_entry_lines', col: 'fecha_documento_ref', type: 'DATE NULL' },
      { table: 'accounting_entry_lines', col: 'fecha_vencimiento_ref', type: 'DATE NULL' },
      { table: 'accounting_entry_lines', col: 'documento_operacion', type: 'VARCHAR(100) NULL' },
      { table: 'accounting_entry_lines', col: 'tipo_documento_operacion', type: 'VARCHAR(50) NULL' },
      { table: 'accounting_entry_lines', col: 'fecha_documento_operacion', type: 'DATE NULL' },
      { table: 'accounting_entry_lines', col: 'documento_conciliacion', type: 'VARCHAR(100) NULL' },
      { table: 'accounting_entry_lines', col: 'tipo_documento_conciliacion', type: 'VARCHAR(50) NULL' },
      { table: 'accounting_entry_lines', col: 'moneda_original', type: 'VARCHAR(10) NULL' },
      { table: 'accounting_entry_lines', col: 'monto_moneda_original', type: 'DECIMAL(15, 2) NULL' },
      { table: 'accounting_entry_lines', col: 'tipo_cambio', type: 'DECIMAL(12, 4) NULL' },
      // bank_transactions: Conciliación, criterios y desambiguación
      { table: 'bank_transactions', col: 'cargo', type: 'DECIMAL(15, 2) NOT NULL DEFAULT 0.00' },
      { table: 'bank_transactions', col: 'abono', type: 'DECIMAL(15, 2) NOT NULL DEFAULT 0.00' },
      { table: 'bank_transactions', col: 'documento_ref', type: 'VARCHAR(100) NULL' },
      { table: 'bank_transactions', col: 'codigo_conciliacion', type: 'VARCHAR(50) NULL' },
      { table: 'bank_transactions', col: 'fecha_conciliacion', type: 'DATETIME(3) NULL' },
      { table: 'bank_transactions', col: 'match_criterio', type: 'VARCHAR(255) NULL' },
      { table: 'bank_transactions', col: 'usuario_conciliador', type: 'VARCHAR(100) NULL' },
      { table: 'bank_transactions', col: 'asiento_generado_id', type: 'VARCHAR(36) NULL' },
      { table: 'bank_transactions', col: 'partida_contable_detalle', type: 'JSON NULL' },
      { table: 'bank_transactions', col: 'es_ambiguo', type: 'BOOLEAN NOT NULL DEFAULT FALSE' },
      { table: 'bank_transactions', col: 'candidatos_matches_count', type: 'INT NULL DEFAULT 0' },
    ];

    for (const def of defensiveColumns) {
      try {
        await connection.query(`ALTER TABLE \`${def.table}\` ADD COLUMN \`${def.col}\` ${def.type};`);
        console.log(`[✓] Columna agregada: ${def.table}.${def.col}`);
      } catch (colErr: any) {
        // Ignorar si la columna ya existe (1060 / ER_DUP_FIELDNAME) o si la tabla no existe aún (1146)
      }
    }

    // Paso defensivo: eliminar índices únicos restrictivos que bloquean múltiples comprobantes válidos
    try {
      await connection.query("ALTER TABLE `accounting_entries` DROP INDEX `uq_entries_empresa_origen_doc`;");
      console.log(`[✓] Índice único uq_entries_empresa_origen_doc liberado a índice ordinario.`);
    } catch {}
    try {
      await connection.query("ALTER TABLE `accounting_entries` DROP INDEX `uq_entries_empresa_doc`;");
      console.log(`[✓] Índice único uq_entries_empresa_doc liberado a índice ordinario.`);
    } catch {}
    try {
      await connection.query("ALTER TABLE `accounting_entries` ADD KEY `idx_entries_empresa_origen_doc` (`empresa_id`, `periodo`, `origen_modulo`, `documento_ref`);");
    } catch {}
    
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
        // Auto-reparación pericial si la columna categoria en cost_centers era un ENUM anterior
        if (stmtErr.message && stmtErr.message.includes("Data truncated for column 'categoria'")) {
          console.warn(`[!] Auto-reparando columna cost_centers.categoria a VARCHAR(100)...`);
          try {
            await connection.query("ALTER TABLE `cost_centers` MODIFY COLUMN `categoria` VARCHAR(100) NOT NULL DEFAULT 'ADMINISTRACION';");
            await connection.query(stmt);
            appliedCount++;
            continue;
          } catch (retryErr: any) {
            console.error(`[!] Falló reintento tras auto-reparar: ${retryErr.message}`);
          }
        }

        // Tolerancia a idempotencia: columna ya existe (1060), índice ya existe (1061), tabla ya existe (1050), objeto a dropear no existe (1091)
        const isIdempotencyError =
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

        if (isIdempotencyError) {
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

const isDirectRun =
  Boolean(process.argv[1] && (process.argv[1].endsWith('updateMysqlDb.ts') || process.argv[1].endsWith('updateMysqlDb.js'))) ||
  (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module);

if (isDirectRun) {
  updateMysqlDatabase().then((res) => {
    process.exit(res.success ? 0 : 1);
  });
}
