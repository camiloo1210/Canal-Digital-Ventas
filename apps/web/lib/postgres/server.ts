import 'server-only';
import postgres from 'postgres';

const globalForPostgres = globalThis as unknown as {
  sql: postgres.Sql<Record<string, unknown>> | undefined;
};

export const sql =
  globalForPostgres.sql ??
  postgres(process.env.DATABASE_URL || '', {
    max: 10,
    idle_timeout: 20,
    max_lifetime: 60 * 30,
  });

if (process.env.NODE_ENV !== 'production') globalForPostgres.sql = sql;
