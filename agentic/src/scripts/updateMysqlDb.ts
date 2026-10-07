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

    // Paso defensivo: asegurar las columnas de los 5 conceptos contables avanzados y DTEs/RCV
    const defensiveColumns = [
      { table: 'chart_of_accounts', col: 'maneja_multimoneda', type: 'BOOLEAN NOT NULL DEFAULT FALSE' },
      { table: 'chart_of_accounts', col: 'requiere_doc_ref', type: 'BOOLEAN NOT NULL DEFAULT FALSE' },
      { table: 'chart_of_accounts', col: 'es_efectivo_equivalente', type: 'BOOLEAN NOT NULL DEFAULT FALSE' },
      { table: 'chart_of_accounts', col: 'es_contracuenta_efectivo', type: 'BOOLEAN NOT NULL DEFAULT FALSE' },
      { table: 'chart_of_accounts', col: 'requiere_proyecto', type: 'BOOLEAN NOT NULL DEFAULT FALSE' },
      { table: 'chart_of_accounts_master', col: 'es_efectivo_equivalente', type: 'BOOLEAN NOT NULL DEFAULT FALSE' },
      { table: 'chart_of_accounts_master', col: 'es_contracuenta_efectivo', type: 'BOOLEAN NOT NULL DEFAULT FALSE' },
      // Columnas críticas de dtes_rcv para agente SII RPA y Drizzle
      { table: 'dtes_rcv', col: 'periodo', type: "VARCHAR(7) NOT NULL DEFAULT '2026-08'" },
      { table: 'dtes_rcv', col: 'monto_iva_recuperable', type: 'DECIMAL(15, 2) NOT NULL DEFAULT 0.00' },
      { table: 'dtes_rcv', col: 'monto_iva_no_recuperable', type: 'DECIMAL(15, 2) NOT NULL DEFAULT 0.00' },
      { table: 'dtes_rcv', col: 'estado_acuse', type: 'VARCHAR(50) NULL' },
      { table: 'dtes_rcv', col: 'estado_contable', type: "ENUM('PENDIENTE', 'CENTRALIZADO') NOT NULL DEFAULT 'PENDIENTE'" },
      { table: 'dtes_rcv', col: 'entry_id_ref', type: 'VARCHAR(36) NULL' },
      { table: 'dtes_rcv', col: 'track_id', type: 'VARCHAR(100) NULL' },
      { table: 'dtes_rcv', col: 'ted_xml', type: 'TEXT NULL' },
      { table: 'dtes_rcv', col: 'xml_timbrado', type: 'MEDIUMTEXT NULL' },
      { table: 'dtes_rcv', col: 'pdf_url', type: 'VARCHAR(500) NULL' },
      { table: 'dtes_rcv', col: 'ambiente_sii', type: 'INT NOT NULL DEFAULT 1' },
      // Columnas críticas de boletas_honorarios
      { table: 'boletas_honorarios', col: 'rut_emisor', type: "VARCHAR(20) NOT NULL DEFAULT ''" },
      { table: 'boletas_honorarios', col: 'nombre_emisor', type: "VARCHAR(255) NOT NULL DEFAULT ''" },
      { table: 'boletas_honorarios', col: 'periodo', type: "VARCHAR(7) NOT NULL DEFAULT '2026-08'" },
      { table: 'boletas_honorarios', col: 'monto_bruto', type: 'DECIMAL(15, 2) NOT NULL DEFAULT 0.00' },
      { table: 'boletas_honorarios', col: 'tasa_retencion', type: 'DECIMAL(5, 4) NOT NULL DEFAULT 0.1450' },
      { table: 'boletas_honorarios', col: 'retencion_monto', type: 'DECIMAL(15, 2) NOT NULL DEFAULT 0.00' },
      { table: 'boletas_honorarios', col: 'liquido_pagado', type: 'DECIMAL(15, 2) NOT NULL DEFAULT 0.00' },
      { table: 'boletas_honorarios', col: 'descripcion_servicio', type: 'TEXT NULL' },
      { table: 'boletas_honorarios', col: 'bhe_estado_contable', type: "ENUM('PENDIENTE', 'CENTRALIZADO') NOT NULL DEFAULT 'PENDIENTE'" },
      { table: 'boletas_honorarios', col: 'entry_id_ref', type: 'VARCHAR(36) NULL' },
      // Columnas críticas de f29_declarations
      { table: 'f29_declarations', col: 'total_iva_debito', type: 'DECIMAL(15, 2) NOT NULL DEFAULT 0.00' },
      { table: 'f29_declarations', col: 'total_iva_credito', type: 'DECIMAL(15, 2) NOT NULL DEFAULT 0.00' },
      { table: 'f29_declarations', col: 'remanente_siguiente_mes', type: 'DECIMAL(15, 2) NOT NULL DEFAULT 0.00' },
      { table: 'f29_declarations', col: 'ppm_determinado', type: 'DECIMAL(15, 2) NOT NULL DEFAULT 0.00' },
      { table: 'f29_declarations', col: 'retenciones_segunda_cat', type: 'DECIMAL(15, 2) NOT NULL DEFAULT 0.00' },
      { table: 'f29_declarations', col: 'estado_declaracion', type: "ENUM('PROPUESTA', 'DECLARADO', 'PAGADO') NOT NULL DEFAULT 'PROPUESTA'" },
      { table: 'f29_declarations', col: 'json_casillas', type: 'JSON NULL' },
      // Columnas críticas de payroll_periods
      { table: 'payroll_periods', col: 'uf_fin_mes', type: 'DECIMAL(10, 2) NOT NULL DEFAULT 0.00' },
      { table: 'payroll_periods', col: 'utm_mes', type: 'DECIMAL(10, 2) NOT NULL DEFAULT 0.00' },
      { table: 'payroll_periods', col: 'total_haberes', type: 'DECIMAL(15, 2) NOT NULL DEFAULT 0.00' },
      { table: 'payroll_periods', col: 'total_descuentos', type: 'DECIMAL(15, 2) NOT NULL DEFAULT 0.00' },
      { table: 'payroll_periods', col: 'liquido_a_pagar', type: 'DECIMAL(15, 2) NOT NULL DEFAULT 0.00' },
      { table: 'payroll_periods', col: 'total_leyes_sociales', type: 'DECIMAL(15, 2) NOT NULL DEFAULT 0.00' },
      { table: 'payroll_periods', col: 'payroll_estado', type: "ENUM('BORRADOR', 'CERRADO', 'PAGADO', 'PREVIRED_GENERADO') NOT NULL DEFAULT 'BORRADOR'" },
      { table: 'payroll_periods', col: 'entry_id_ref', type: 'VARCHAR(36) NULL' },
      // Columnas críticas de agent_audit_logs (Bitácora Forense de Agentes IA)
      { table: 'agent_audit_logs', col: 'firm_id', type: "VARCHAR(36) NOT NULL DEFAULT 'firm-default-001'" },
      { table: 'agent_audit_logs', col: 'modulo', type: "VARCHAR(60) NOT NULL DEFAULT 'CONTABILIDAD'" },
      { table: 'agent_audit_logs', col: 'accion', type: "VARCHAR(100) NOT NULL DEFAULT 'COMMIT_ASIENTO'" },
      { table: 'agent_audit_logs', col: 'estado_transicion', type: "VARCHAR(50) NOT NULL DEFAULT 'APROBADO'" },
      { table: 'agent_audit_logs', col: 'prompt_tokens', type: "INT NULL" },
      { table: 'agent_audit_logs', col: 'completion_tokens', type: "INT NULL" },
      { table: 'agent_audit_logs', col: 'model_name', type: "VARCHAR(50) NULL" },
      { table: 'agent_audit_logs', col: 'prompt_hash', type: "VARCHAR(64) NULL" },
      { table: 'agent_audit_logs', col: 'payload_input', type: "JSON NULL" },
      { table: 'agent_audit_logs', col: 'payload_output', type: "JSON NULL" },
      { table: 'agent_audit_logs', col: 'diff_contable', type: "JSON NULL" },
      { table: 'agent_audit_logs', col: 'supervisor_veredicto', type: "VARCHAR(50) NULL" },
      { table: 'agent_audit_logs', col: 'supervisor_signature', type: "VARCHAR(128) NULL" },
      { table: 'agent_audit_logs', col: 'tiempo_ejecucion_ms', type: "INT NOT NULL DEFAULT 0" },
    ];

    // Asegurar estructura base de agent_audit_logs si no existe
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS \`agent_audit_logs\` (
          \`id\` VARCHAR(36) NOT NULL,
          \`trace_id\` VARCHAR(64) NOT NULL,
          \`firm_id\` VARCHAR(36) NOT NULL DEFAULT 'firm-default-001',
          \`empresa_id\` VARCHAR(36) NOT NULL,
          \`agente_nombre\` VARCHAR(60) NOT NULL,
          \`modulo\` VARCHAR(60) NOT NULL DEFAULT 'CONTABILIDAD',
          \`accion\` VARCHAR(100) NOT NULL DEFAULT 'COMMIT_ASIENTO',
          \`estado_transicion\` VARCHAR(50) NOT NULL DEFAULT 'APROBADO',
          \`prompt_tokens\` INT NULL,
          \`completion_tokens\` INT NULL,
          \`model_name\` VARCHAR(50) NULL,
          \`prompt_hash\` VARCHAR(64) NULL,
          \`payload_input\` JSON NULL,
          \`payload_output\` JSON NULL,
          \`diff_contable\` JSON NULL,
          \`supervisor_veredicto\` VARCHAR(50) NULL,
          \`supervisor_signature\` VARCHAR(128) NULL,
          \`tiempo_ejecucion_ms\` INT NOT NULL DEFAULT 0,
          \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          PRIMARY KEY (\`id\`),
          KEY \`idx_audit_trace\` (\`trace_id\`),
          KEY \`idx_audit_empresa_created\` (\`empresa_id\`, \`created_at\`),
          KEY \`idx_audit_firm\` (\`firm_id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      console.log('[✓] Tabla agent_audit_logs verificada / creada preventivamente.');
    } catch {}

    // Ajustar columnas legacy si la tabla fue creada con esquemas anteriores restrictivos
    try {
      await connection.query("ALTER TABLE `agent_audit_logs` MODIFY COLUMN `tipo_evento` VARCHAR(50) NULL;");
    } catch {}
    try {
      await connection.query("ALTER TABLE `agent_audit_logs` MODIFY COLUMN `payload_entrada` JSON NULL;");
    } catch {}
    try {
      await connection.query("ALTER TABLE `agent_audit_logs` MODIFY COLUMN `resultado_validacion` JSON NULL;");
    } catch {}
    try {
      await connection.query("ALTER TABLE `agent_audit_logs` MODIFY COLUMN `tiempo_inferencia_ms` INT NULL DEFAULT 0;");
    } catch {}
    try {
      await connection.query("ALTER TABLE `agent_audit_logs` MODIFY COLUMN `trace_id` VARCHAR(64) NOT NULL;");
    } catch {}
    try {
      await connection.query("ALTER TABLE `agent_audit_logs` MODIFY COLUMN `empresa_id` VARCHAR(36) NOT NULL;");
    } catch {}
    try {
      await connection.query("ALTER TABLE `agent_audit_logs` MODIFY COLUMN `payload_input` JSON NULL;");
    } catch {}
    try {
      await connection.query("ALTER TABLE `agent_audit_logs` MODIFY COLUMN `payload_output` JSON NULL;");
    } catch {}

    // Ajustes defensivos para tablas de Rendición de Gastos (RindeGastos) VARCHAR(64)
    try {
      await connection.query("ALTER TABLE `expense_reports` MODIFY COLUMN `id` VARCHAR(64) NOT NULL;");
      await connection.query("ALTER TABLE `expense_reports` MODIFY COLUMN `empresa_id` VARCHAR(64) NOT NULL;");
      await connection.query("ALTER TABLE `expense_reports` MODIFY COLUMN `rendidor_id` VARCHAR(64) NULL;");
      await connection.query("ALTER TABLE `expense_reports` MODIFY COLUMN `centro_costo_id` VARCHAR(64) NULL;");
      await connection.query("ALTER TABLE `expense_reports` MODIFY COLUMN `proyecto_id` VARCHAR(64) NULL;");
      await connection.query("ALTER TABLE `expense_reports` MODIFY COLUMN `asiento_contable_id` VARCHAR(64) NULL;");
      await connection.query("ALTER TABLE `expense_items` MODIFY COLUMN `id` VARCHAR(64) NOT NULL;");
      await connection.query("ALTER TABLE `expense_items` MODIFY COLUMN `expense_report_id` VARCHAR(64) NOT NULL;");
      await connection.query("ALTER TABLE `expense_items` MODIFY COLUMN `empresa_id` VARCHAR(64) NOT NULL;");
      await connection.query("ALTER TABLE `expense_items` MODIFY COLUMN `centro_costo_id` VARCHAR(64) NULL;");
      await connection.query("ALTER TABLE `expense_items` MODIFY COLUMN `proyecto_id` VARCHAR(64) NULL;");
      await connection.query("ALTER TABLE `expense_projects` MODIFY COLUMN `id` VARCHAR(64) NOT NULL;");
      await connection.query("ALTER TABLE `expense_projects` MODIFY COLUMN `empresa_id` VARCHAR(64) NOT NULL;");
      console.log('[✓] Columnas de Rendición de Gastos (expense_*) verificadas/ampliadas preventivamente a VARCHAR(64).');
    } catch (expErr: any) {
      // Ignorar si las tablas aún no existen
    }

    for (const def of defensiveColumns) {
      try {
        await connection.query(`ALTER TABLE \`${def.table}\` ADD COLUMN \`${def.col}\` ${def.type};`);
        console.log(`[✓] Columna agregada: ${def.table}.${def.col}`);
      } catch (colErr: any) {
        // Ignorar si la columna ya existe (1060 / ER_DUP_FIELDNAME) o si la tabla no existe aún (1146)
      }
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
