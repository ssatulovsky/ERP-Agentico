/**
 * Sincroniza la base MySQL con el esquema del código (src/db/mysqlSchema.ts), sin borrar nada.
 *
 * Las migraciones históricas no crean todas las columnas que el código usa (p. ej.
 * bank_accounts.estado_conexion, bank_transactions.matched_dte_id), y cada consulta a una columna
 * faltante falla con "Unknown column". Este script compara tabla por tabla y:
 *   - crea las tablas que faltan (columnas, clave primaria e índices únicos);
 *   - agrega las columnas que faltan en las tablas existentes.
 * Nunca elimina tablas ni columnas, ni cambia el tipo de una columna existente.
 *
 * Uso (desde la carpeta del proyecto, con el .env de MySQL):
 *   npm run db:sync:mysql              # muestra los cambios sin aplicarlos
 *   npm run db:sync:mysql -- --aplicar # los aplica
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';
import { is, SQL } from 'drizzle-orm';
import { MySqlTable, getTableConfig, type MySqlColumn } from 'drizzle-orm/mysql-core';
import * as schema from '../db/mysqlSchema';

const aplicar = process.argv.includes('--aplicar');

function renderSql(value: SQL): string {
  return (value as any).queryChunks
    .map((ch: any) => (Array.isArray(ch?.value) ? ch.value.join('') : typeof ch === 'string' ? ch : ''))
    .join('');
}

function renderDefault(col: MySqlColumn): string | null {
  const d: any = (col as any).default;
  if (d === undefined) return null;
  if (d === null) return 'NULL';
  if (is(d, SQL)) return `(${renderSql(d)})`.replace(/^\((CURRENT_TIMESTAMP(\(\d\))?)\)$/i, '$1');
  if (typeof d === 'boolean') return d ? 'TRUE' : 'FALSE';
  if (typeof d === 'number' || typeof d === 'bigint') return String(d);
  if (d instanceof Date) return `'${d.toISOString().slice(0, 19).replace('T', ' ')}'`;
  if (typeof d === 'object') return `('${JSON.stringify(d).replace(/'/g, "''")}')`;
  return `'${String(d).replace(/'/g, "''")}'`;
}

/** DDL de una columna. `forzarNull`: en tablas con filas, NOT NULL sin valor por defecto se agrega como NULL. */
function columnDdl(col: MySqlColumn, forzarNull = false): { ddl: string; aviso?: string } {
  const c: any = col;
  const partes = [`\`${c.name}\``, c.getSQLType()];
  const def = renderDefault(col);
  const auto = Boolean(c.autoIncrement);
  let aviso: string | undefined;
  if (c.notNull && !forzarNull) partes.push('NOT NULL');
  else if (c.notNull && forzarNull && def === null && !auto) {
    partes.push('NULL');
    aviso = `se agrega como NULL porque la tabla tiene filas y la columna no tiene valor por defecto`;
  } else if (c.notNull) partes.push('NOT NULL');
  else partes.push('NULL');
  if (auto) partes.push('AUTO_INCREMENT');
  if (def !== null && !(c.getSQLType().match(/^(text|blob|json|longtext|mediumtext)/i) && def.startsWith("'"))) partes.push(`DEFAULT ${def}`);
  if (c.hasOnUpdateNow || c.onUpdateFn) {
    const m = c.getSQLType().match(/\((\d)\)/);
    partes.push(`ON UPDATE CURRENT_TIMESTAMP${m ? `(${m[1]})` : ''}`);
  }
  return { ddl: partes.join(' '), aviso };
}

function createTableDdl(table: MySqlTable): string {
  const cfg = getTableConfig(table);
  const lineas = cfg.columns.map((c) => '  ' + columnDdl(c).ddl);
  const pkCols = cfg.columns.filter((c: any) => c.primary).map((c) => `\`${c.name}\``);
  const pkCompuesta = cfg.primaryKeys[0]?.columns.map((c) => `\`${c.name}\``);
  const pk = pkCompuesta?.length ? pkCompuesta : pkCols;
  if (pk.length) lineas.push(`  PRIMARY KEY (${pk.join(', ')})`);
  for (const idx of cfg.indexes) {
    const ic: any = idx.config;
    const cols = ic.columns.map((c: any) => `\`${c.name}\``).join(', ');
    lineas.push(`  ${ic.unique ? 'UNIQUE KEY' : 'KEY'} \`${ic.name}\` (${cols})`);
  }
  for (const u of cfg.uniqueConstraints || []) {
    lineas.push(`  UNIQUE KEY \`${u.getName()}\` (${u.columns.map((c) => `\`${c.name}\``).join(', ')})`);
  }
  return `CREATE TABLE IF NOT EXISTS \`${cfg.name}\` (\n${lineas.join(',\n')}\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;
}

async function main() {
  const conn = process.env.MYSQL_URL
    ? await mysql.createConnection(process.env.MYSQL_URL)
    : await mysql.createConnection({
        host: process.env.MYSQL_HOST || '127.0.0.1',
        port: Number(process.env.MYSQL_PORT) || 3306,
        user: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_PASSWORD || '',
        database: process.env.MYSQL_DATABASE || 'erp_contable',
      });
  const [[{ db }]]: any = await conn.query('SELECT DATABASE() AS db');
  console.log(`Base de datos: ${db} · modo: ${aplicar ? 'APLICAR' : 'solo mostrar (agregue --aplicar para ejecutar)'}\n`);

  const [cols]: any = await conn.query(
    'SELECT TABLE_NAME AS t, COLUMN_NAME AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()'
  );
  const existentes = new Map<string, Set<string>>();
  for (const r of cols) {
    if (!existentes.has(r.t)) existentes.set(r.t, new Set());
    existentes.get(r.t)!.add(r.c);
  }

  const tablas = Object.values(schema).filter((v) => is(v, MySqlTable)) as MySqlTable[];
  const vistas = new Set<string>();
  const cambios: Array<{ sql: string; desc: string }> = [];
  for (const t of tablas) {
    const cfg = getTableConfig(t);
    if (vistas.has(cfg.name)) continue;
    vistas.add(cfg.name);
    const actuales = existentes.get(cfg.name);
    if (!actuales) {
      cambios.push({ sql: createTableDdl(t), desc: `Crear tabla ${cfg.name}` });
      continue;
    }
    const faltantes = cfg.columns.filter((c) => !actuales.has(c.name));
    if (faltantes.length === 0) continue;
    const [[{ n }]]: any = await conn.query(`SELECT COUNT(*) AS n FROM \`${cfg.name}\``);
    for (const c of faltantes) {
      const { ddl, aviso } = columnDdl(c, Number(n) > 0);
      cambios.push({ sql: `ALTER TABLE \`${cfg.name}\` ADD COLUMN ${ddl}`, desc: `${cfg.name}.${c.name}${aviso ? ` (${aviso})` : ''}` });
    }
  }

  if (cambios.length === 0) {
    console.log(`✅ La base ya tiene todas las tablas y columnas del código (${vistas.size} tablas revisadas).`);
    await conn.end();
    return;
  }
  // Primero las tablas nuevas (otras columnas pueden referirse a ellas).
  cambios.sort((a, b) => Number(b.desc.startsWith('Crear')) - Number(a.desc.startsWith('Crear')));
  let ok = 0;
  const errores: string[] = [];
  for (const ch of cambios) {
    if (!aplicar) {
      console.log(`• ${ch.desc}\n    ${ch.sql.replace(/\n/g, '\n    ')}`);
      continue;
    }
    try {
      await conn.query(ch.sql);
      ok++;
      console.log(`✅ ${ch.desc}`);
    } catch (e: any) {
      errores.push(`${ch.desc}: ${e.message}`);
      console.log(`❌ ${ch.desc}: ${e.message}`);
    }
  }
  console.log(
    aplicar
      ? `\n${ok} de ${cambios.length} cambios aplicados${errores.length ? `; ${errores.length} con error (revise arriba)` : ''}.`
      : `\n${cambios.length} cambio(s) pendientes. Ejecute con --aplicar para aplicarlos.`
  );
  await conn.end();
  process.exit(errores.length ? 1 : 0);
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
