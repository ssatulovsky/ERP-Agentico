import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/mysqlSchema.ts',
  out: './drizzle/migrations-mysql',
  dialect: 'mysql',
  dbCredentials: process.env.MYSQL_URL
    ? {
        url: process.env.MYSQL_URL,
      }
    : {
        host: process.env.MYSQL_HOST || '127.0.0.1',
        port: Number(process.env.MYSQL_PORT) || 3306,
        user: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_PASSWORD || '',
        database: process.env.MYSQL_DATABASE || 'chile_erp',
      },
  verbose: true,
  strict: true,
});
