import { randomUUID } from 'node:crypto';
import type postgres from 'postgres';
import type { TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';

type Sql = postgres.Sql<Record<string, unknown>>;
type TxSql = postgres.TransactionSql<Record<string, unknown>>;

export interface RolledBackTenantContext {
  tenantId: string;
  sql: TxSql;
}

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);

/** Refuses to run against anything but a local database unless explicitly opted in. */
function assertLocalDatabase(sql: Sql): void {
  const hosts = (sql.options as { host: string[] }).host;
  const remote = hosts.filter((host): boolean => !LOCAL_HOSTS.has(host));
  if (remote.length > 0 && process.env.ALLOW_REMOTE_INTEGRATION_DB !== '1') {
    throw new Error(
      `Refusing to run integration tests against non-local host: ${remote.join(',')}`,
    );
  }
}

class RollbackSentinel extends Error {
  constructor() {
    super('rollback sentinel');
    this.name = 'RollbackSentinel';
  }
}

/**
 * Opens a transaction, inserts a fresh tenant, runs `work` and ALWAYS rolls back.
 * Nothing written inside `work` survives, so tests never depend on or pollute shared data.
 */
export async function withRolledBackTenant<T>(
  sql: Sql,
  work: (ctx: RolledBackTenantContext) => Promise<T>,
): Promise<T> {
  assertLocalDatabase(sql);
  const tenantId = randomUUID();
  let result: T | undefined;

  try {
    await sql.begin(async (tx): Promise<void> => {
      await tx`
        INSERT INTO core.tenants (id, name, slug, contact_email, base_currency, status)
        VALUES (
          ${tenantId}, ${`Test tenant ${tenantId}`}, ${`test-${tenantId}`},
          ${`${tenantId}@example.test`}, 'USD', 'active'
        )
      `;
      result = await work({ tenantId, sql: tx });
      throw new RollbackSentinel();
    });
  } catch (error: unknown) {
    if (!(error instanceof RollbackSentinel)) throw error;
  }

  return result as T;
}

/** Wraps an open transaction as the application-level TransactionContext. */
export function toTransactionContext(tx: TxSql): TransactionContext {
  return {
    executeNative: async <TConnection, TResult>(
      callback: (conn: TConnection) => Promise<TResult>,
    ): Promise<TResult> => callback(tx as unknown as TConnection),
  };
}

/**
 * Returns a `Sql`-shaped handle bound to an open (rolled-back) transaction whose `begin`
 * opens a SAVEPOINT. Adapters that call `sql.begin` (e.g. the transaction manager) therefore
 * commit/rollback only their own nested scope while the outer transaction stays disposable.
 */
export function savepointSql(tx: TxSql): Sql {
  return new Proxy(tx, {
    get(target, property, receiver): unknown {
      if (property === 'begin') {
        return (callback: (inner: TxSql) => Promise<unknown>): Promise<unknown> =>
          target.savepoint((inner): Promise<unknown> => callback(inner as TxSql));
      }
      return Reflect.get(target, property, receiver) as unknown;
    },
  }) as unknown as Sql;
}

/** Inserts a category owned by `tenantId` (needed by products through foreign keys). */
export async function insertTestCategory(
  tx: TxSql,
  tenantId: string,
  categoryId: string,
): Promise<void> {
  await tx`
    INSERT INTO catalog.categories (id, name, tenant_id, description, status, slug)
    VALUES (${categoryId}, 'Test category', ${tenantId}, 'Test category', 'active', ${`cat-${categoryId}`})
  `;
}
