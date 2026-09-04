import * as schema from './schema';
import type { PgDatabase } from 'drizzle-orm/pg-core';

/**
 * Cliente de base de datos Drizzle ORM.
 * Soporta conexión PostgreSQL transaccional o instancia inyectada para testing.
 */
let _dbInstance: any = null;

export function getDb(): any {
  if (_dbInstance) {
    return _dbInstance;
  }
  // Si existe conexión real PostgreSQL configurada en variables de entorno:
  const connectionString = process.env.DATABASE_URL;
  if (connectionString) {
    try {
      // Lazy import para evitar fallos si el driver no está presente
      const { drizzle } = require('drizzle-orm/node-postgres');
      const { Pool } = require('pg');
      const pool = new Pool({ connectionString });
      _dbInstance = drizzle(pool, { schema });
      return _dbInstance;
    } catch (e) {
      console.warn('[DB] Fallback al mock transaccional de Drizzle:', e);
    }
  }

  // Fallback transaccional conforme a Drizzle ORM API
  const inMemoryEntries: any[] = [];
  const inMemoryLines: any[] = [];
  const inMemoryLogs: any[] = [];

  const mockTx: any = {
    insert: (table: any) => ({
      values: (val: any) => ({
        returning: async () => {
          const valuesArray = Array.isArray(val) ? val : [val];
          const results = valuesArray.map((item) => ({
            id: item.id || `mock-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            createdAt: new Date(),
            ...item,
          }));

          if (table === schema.accountingEntries) {
            inMemoryEntries.push(...results);
          } else if (table === schema.accountingEntryLines) {
            inMemoryLines.push(...results);
          } else if (table === schema.agentAuditLogs) {
            inMemoryLogs.push(...results);
          }
          return Array.isArray(val) ? results : [results[0]];
        },
      }),
    }),
  };

  _dbInstance = {
    ...mockTx,
    transaction: async <T>(callback: (tx: any) => Promise<T>): Promise<T> => {
      return await callback(mockTx);
    },
  };

  return _dbInstance;
}

export function setDbInstance(customDb: any) {
  _dbInstance = customDb;
}

export const db = new Proxy({} as any, {
  get(_target, prop) {
    const instance = getDb();
    return instance[prop];
  },
});

export * from './schema';
