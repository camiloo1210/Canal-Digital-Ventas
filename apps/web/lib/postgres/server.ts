import 'server-only';
import postgres from 'postgres';

import { TransactionException } from '@canaldigital/packages/core';

const globalForPostgres = globalThis as unknown as {
  sql: postgres.Sql<Record<string, unknown>> | undefined;
};

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new TransactionException('DATABASE_URL environment variable is missing. Please configure it in your Vercel settings and REDEPLOY.');
}

export const sql =
  globalForPostgres.sql ??
  postgres(connectionString, {
    max: 10,
    idle_timeout: 20,
    max_lifetime: 60 * 30,
  });

if (process.env.NODE_ENV !== 'production') globalForPostgres.sql = sql;
