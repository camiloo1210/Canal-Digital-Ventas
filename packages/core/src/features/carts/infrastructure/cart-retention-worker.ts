import { setTimeout as delay } from 'node:timers/promises';
import postgres from 'postgres';
import type { CartRetentionWorkerConfig } from '@/carts/infrastructure/cart-retention-worker-config';
import { BuyerCartRepositoryException } from '@/carts/application/exceptions/buyer-cart-repository.exception';
import type { OutboxWorkerLogger } from '@/shared/infrastructure/messaging/outbox-worker';

async function openRestrictedCartConnection(
  databaseUrl: string,
): Promise<postgres.Sql<Record<string, unknown>>> {
  const sql = postgres(databaseUrl, {
    max: 1,
    prepare: false,
    connect_timeout: 5,
    idle_timeout: 20,
    connection: { statement_timeout: 10000, application_name: 'canaldigital-cart-retention' },
  });
  try {
    const identity = await sql<{ authorized: boolean }[]>`
      SELECT NOT r.rolsuper AND NOT r.rolbypassrls AND NOT r.rolcreaterole
        AND session_user = current_user
        AND pg_has_role(session_user, 'cart_retention_role'::name, 'MEMBER') AS authorized
      FROM pg_roles r WHERE r.rolname = session_user`;
    if (identity[0]?.authorized !== true) {
      throw new BuyerCartRepositoryException('Unsafe cart retention identity.');
    }
    return sql;
  } catch {
    await sql.end({ timeout: 5 });
    throw new BuyerCartRepositoryException('Cart retention connection failed.');
  }
}

/** Deletes expired or closed buyer carts in bounded batches until the backlog is empty. */
export async function runCartRetentionWorker(
  config: CartRetentionWorkerConfig,
  signal: AbortSignal,
  logger: OutboxWorkerLogger,
  onReady: (ready: boolean) => void,
): Promise<void> {
  const sql = await openRestrictedCartConnection(config.databaseUrl);
  try {
    while (!signal.aborted) {
      let waitMs = config.intervalMs;
      try {
        const rows = await sql<{ count: number }[]>`
          SELECT core.purge_expired_buyer_carts(${config.batchSize}) AS count`;
        onReady(true);
        const deleted = Number(rows[0]?.count ?? 0);
        if (deleted > 0) logger.info(`Buyer cart retention removed ${deleted} carts`);
        // A full batch means more is waiting: continue shortly instead of sleeping 15 minutes.
        if (deleted >= config.batchSize) waitMs = 1000;
      } catch {
        onReady(false);
        logger.error('Buyer cart retention failed; no carts changed');
        waitMs = config.retryMs;
      }
      await delay(waitMs, undefined, { signal }).catch((error: unknown): void => {
        if (!signal.aborted) throw error;
      });
    }
  } finally {
    onReady(false);
    await sql.end({ timeout: 5 });
  }
}
