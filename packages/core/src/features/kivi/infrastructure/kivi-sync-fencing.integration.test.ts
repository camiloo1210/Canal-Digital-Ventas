import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresKiviSyncStoreAdapter } from '@/kivi/infrastructure/postgres-kivi-sync-store.adapter';
import { PostgresKiviConnectionRepository } from '@/kivi/infrastructure/postgres-kivi-connection.repository';
import { KiviConnection } from '@/kivi/domain/entities/kivi-connection.entity';
import { KiviBaseUrl } from '@/kivi/domain/value-objects/kivi-base-url.vo';
import { KiviSecretRef } from '@/kivi/domain/value-objects/kivi-secret-ref.vo';
import type { TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';
import { RunKiviSyncCycleUseCase } from '@/kivi/application/use-cases/run-kivi-sync-cycle.use-case';
import { KiviDeliveryException } from '@/kivi/application/exceptions/kivi-delivery.exception';

const url = process.env.KIVI_TEST_DATABASE_URL;
type Sql = postgres.Sql<Record<string, unknown>>;
class KiviFixtureException extends Error {}

describe.skipIf(!url)('Kivi synchronization fencing in disposable PostgreSQL', (): void => {
  let sql: Sql;
  let store: PostgresKiviSyncStoreAdapter;

  beforeAll(async (): Promise<void> => {
    const target = new URL(url!);
    if (
      !['localhost', '127.0.0.1'].includes(target.hostname) ||
      target.pathname !== '/cdv_kivi_audit'
    ) {
      throw new KiviFixtureException(
        'Kivi integration tests require the disposable local audit database.',
      );
    }
    sql = postgres(url!, { max: 4, prepare: false, connection: { statement_timeout: 5000 } });
    const [database] = await sql<{ name: string }[]>`SELECT current_database() AS name`;
    if (database.name !== 'cdv_kivi_audit')
      throw new KiviFixtureException('Unexpected fixture database.');
    store = new PostgresKiviSyncStoreAdapter(sql, {});
  });

  afterAll(async (): Promise<void> => {
    if (sql) await sql.end({ timeout: 5 });
  });

  async function withTenant(
    work: (tenantId: string, connectionId: string) => Promise<void>,
  ): Promise<void> {
    const tenantId = crypto.randomUUID();
    const connectionId = crypto.randomUUID();
    await sql`INSERT INTO core.tenants (id) VALUES (${tenantId}::uuid)`;
    try {
      await saveLink(tenantId, connectionId);
      await work(tenantId, connectionId);
    } finally {
      await sql`DELETE FROM core.tenants WHERE id = ${tenantId}::uuid`;
    }
  }

  async function saveLink(tenantId: string, connectionId: string): Promise<void> {
    const connection = KiviConnection.link({
      tenantId,
      connectionId,
      baseUrl: KiviBaseUrl.from('https://api.kivi.example'),
      secretRef: KiviSecretRef.from('KIVI_CONNECTION_TOKEN_AUDIT'),
    });
    await sql.begin(async (tx): Promise<void> => {
      const context: TransactionContext = {
        executeNative: async <TConnection, TResult>(
          callback: (connection: TConnection) => Promise<TResult>,
        ): Promise<TResult> => callback(tx as unknown as TConnection),
      };
      await new PostgresKiviConnectionRepository().save(connection, context);
    });
  }

  async function withBatch(work: (ids: string[]) => Promise<void>): Promise<void> {
    const ids = Array.from({ length: 51 }, (): string => crypto.randomUUID());
    await sql`INSERT INTO core.tenants ${sql(
      ids.map((id): { id: string } => ({ id })),
      'id',
    )}`;
    try {
      await sql`INSERT INTO core.kivi_connections (tenant_id, base_url, connection_id, secret_ref, status, updated_at)
        SELECT id, 'https://api.kivi.example', gen_random_uuid(), 'KIVI_CONNECTION_TOKEN_AUDIT', 'pending',
          CASE WHEN id = ${ids[50]}::uuid THEN '2001-01-01'::timestamptz ELSE '2000-01-01'::timestamptz END
        FROM core.tenants WHERE id = ANY(${ids}::uuid[])`;
      await work(ids);
    } finally {
      await sql`DELETE FROM core.tenants WHERE id = ANY(${ids}::uuid[])`;
    }
  }

  function cycle(attempts: string[], succeeds?: string): RunKiviSyncCycleUseCase {
    return new RunKiviSyncCycleUseCase(
      store,
      {
        execute: async (tenantId: string): Promise<{ sent: number; conflicts: number }> => {
          attempts.push(tenantId);
          if (tenantId !== succeeds) throw new KiviDeliveryException('transient');
          return { sent: 0, conflicts: 0 };
        },
      },
      {
        execute: async (): Promise<never> => {
          throw new KiviFixtureException('Only pending fixtures are expected.');
        },
      },
      { reconcileIntervalMs: 3600000, retryIntervalMs: 300000 },
    );
  }

  it('reaches store 51 while the oldest 50 fail, including after a worker restart', async (): Promise<void> => {
    await withBatch(async (ids: string[]): Promise<void> => {
      const attempts: string[] = [];
      const now = new Date();
      expect((await cycle(attempts, ids[50]).execute(now)).failures).toBe(50);
      const restarted = cycle(attempts, ids[50]);
      expect((await restarted.execute(new Date(now.getTime() + 1000))).initialLoads).toBe(1);
      expect(attempts).toHaveLength(51);
      expect(new Set(attempts).size).toBe(51);
    });
  });

  it('moves past 50 invalid URL rows without contacting them', async (): Promise<void> => {
    await withBatch(async (ids: string[]): Promise<void> => {
      await sql`UPDATE core.kivi_connections SET base_url = 'https://localhost' WHERE tenant_id = ANY(${ids.slice(0, 50)}::uuid[])`;
      const attempts: string[] = [];
      const now = new Date();
      await cycle(attempts, ids[50]).execute(now);
      await cycle(attempts, ids[50]).execute(new Date(now.getTime() + 1000));
      expect(attempts).toEqual([ids[50]]);
    });
  });

  it('gives concurrent schedulers disjoint bounded batches', async (): Promise<void> => {
    await withBatch(async (): Promise<void> => {
      const attempts: string[] = [];
      const now = new Date();
      const results = await Promise.all([
        cycle(attempts).execute(now),
        cycle(attempts).execute(now),
      ]);
      expect(
        results.map((result): number => result.failures).sort((a, b): number => a - b),
      ).toEqual([1, 50]);
      expect(new Set(attempts).size).toBe(51);
    });
  });

  it.each([false, true])(
    'rejects stale completion after re-pairing (same remote id: %s)',
    async (sameId: boolean): Promise<void> => {
      await withTenant(async (tenantId: string, connectionId: string): Promise<void> => {
        const old = (await store.findConnection(tenantId))!;
        await saveLink(tenantId, sameId ? connectionId : crypto.randomUUID());
        old.completeInitialLoad(new Date());
        await expect(store.saveConnectionState(old)).rejects.toMatchObject({
          name: 'KiviStaleSyncException',
        });
        expect((await store.findConnection(tenantId))?.getStatus()).toBe('pending');
      });
    },
  );

  it('allows exactly one concurrent completion of the same snapshot', async (): Promise<void> => {
    await withTenant(async (tenantId: string): Promise<void> => {
      const first = (await store.findConnection(tenantId))!;
      const second = (await store.findConnection(tenantId))!;
      first.completeInitialLoad(new Date());
      second.completeInitialLoad(new Date());
      const results = await Promise.allSettled([
        store.saveConnectionState(first),
        store.saveConnectionState(second),
      ]);
      expect(results.filter((result): boolean => result.status === 'fulfilled')).toHaveLength(1);
      expect((await store.findConnection(tenantId))?.getStatus()).toBe('active');
    });
  });

  it('does not revive an unlinked row or report its stale save as successful', async (): Promise<void> => {
    await withTenant(async (tenantId: string): Promise<void> => {
      const old = (await store.findConnection(tenantId))!;
      await sql`UPDATE core.kivi_connections SET status = 'unlinked' WHERE tenant_id = ${tenantId}::uuid`;
      old.completeInitialLoad(new Date());
      await expect(store.saveConnectionState(old)).rejects.toMatchObject({
        name: 'KiviStaleSyncException',
      });
    });
  });

  it('advances the persisted generation only after an accepted save', async (): Promise<void> => {
    await withTenant(async (tenantId: string): Promise<void> => {
      const current = (await store.findConnection(tenantId))!;
      current.completeInitialLoad(new Date());
      await store.saveConnectionState(current);
      expect((await store.findConnection(tenantId))?.getGeneration()).toBe(
        current.getGeneration() + 1,
      );
    });
  });

  it.each(['active', 'pending', 'needs_reconcile'])(
    'preserves a new DEAD-event repair request during an in-flight %s snapshot',
    async (status: string): Promise<void> => {
      await withTenant(async (tenantId: string): Promise<void> => {
        await sql`UPDATE core.kivi_connections SET status = ${status} WHERE tenant_id = ${tenantId}::uuid`;
        const snapshot = (await store.findConnection(tenantId))!;
        const eventId = crypto.randomUUID();
        await sql`INSERT INTO core.outbox_events (id, tenant_id, aggregate_type, event_type, status)
        VALUES (${eventId}::uuid, ${tenantId}::uuid, 'Product', 'ProductStockAdjustedEvent', 'DEAD')`;
        try {
          expect(await store.flagConnectionsWithDeadProductEvents()).toBe(1);
          snapshot.markReconciled(new Date());
          await expect(store.saveConnectionState(snapshot)).rejects.toMatchObject({
            name: 'KiviStaleSyncException',
          });
          const current = (await store.findConnection(tenantId))!;
          expect(current.getStatus()).toBe(status === 'pending' ? 'pending' : 'needs_reconcile');
          expect(current.getGeneration()).toBe(snapshot.getGeneration() + 1);
          expect(await store.flagConnectionsWithDeadProductEvents()).toBe(0);
        } finally {
          await sql`DELETE FROM core.outbox_events WHERE id = ${eventId}::uuid`;
        }
      });
    },
  );

  it('denies unauthenticated-role access to the worker functions', async (): Promise<void> => {
    await sql.begin(async (tx): Promise<void> => {
      await tx`SET LOCAL SESSION AUTHORIZATION authenticated`;
      await expect(
        tx.savepoint(
          async (sp): Promise<unknown> =>
            sp`SELECT * FROM core.kivi_sync_get_connection_v3(${crypto.randomUUID()}::uuid)`,
        ),
      ).rejects.toMatchObject({ code: '42501' });
    });
  });

  it('allows the worker read surface while denying direct tables and the obsolete writer', async (): Promise<void> => {
    await sql.begin(async (tx): Promise<void> => {
      await tx`SET LOCAL SESSION AUTHORIZATION canaldigital_kivi_sync`;
      expect(
        await tx`SELECT * FROM core.kivi_sync_get_connection_v3(${crypto.randomUUID()}::uuid)`,
      ).toHaveLength(0);
      await expect(
        tx.savepoint(async (sp): Promise<unknown> => sp`SELECT * FROM core.kivi_connections`),
      ).rejects.toMatchObject({ code: '42501' });
      await expect(
        tx.savepoint(
          async (sp): Promise<unknown> =>
            sp`SELECT core.kivi_sync_save_state(${crypto.randomUUID()}::uuid, 'active', now())`,
        ),
      ).rejects.toMatchObject({ code: '42501' });
    });
  });
});
