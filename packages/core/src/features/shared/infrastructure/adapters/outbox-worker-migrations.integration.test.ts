import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Opt in with the project database URL. Each case runs in exactly one transaction that is always
// rolled back (write cases) or is READ ONLY and rolled back (catalog cases). Expected errors are
// isolated with savepoints inside that transaction. supabase/tests/integration-test-containment
// statically enforces this structure.
const url = process.env.OUTBOX_TEST_DATABASE_URL;

type Sql = postgres.Sql<Record<string, unknown>>;
type Tx = postgres.TransactionSql<Record<string, unknown>>;

class RollbackSignal extends Error {}

interface ClaimedRow {
  id: string;
  aggregate_type: string;
  event_type: string;
  attempt_count?: number;
}

describe.skipIf(!url)('Corrected outbox worker migrations (rolled-back transactions)', (): void => {
  let sql: Sql;

  async function rolledBack(work: (tx: Tx, tenantId: string) => Promise<void>): Promise<void> {
    const tenantId = crypto.randomUUID();
    try {
      await sql.begin(async (tx: Tx): Promise<void> => {
        await tx`SET LOCAL statement_timeout = '15s'`;
        await tx`SET LOCAL lock_timeout = '5s'`;
        await tx`SET LOCAL idle_in_transaction_session_timeout = '30s'`;
        await tx`
          INSERT INTO core.tenants (id, name, slug, contact_email, base_currency, status)
          VALUES (${tenantId}, 'Migration test', ${`migration-test-${tenantId}`}, 'migration@example.test', 'USD', 'active')
        `;
        await work(tx, tenantId);
        throw new RollbackSignal();
      });
    } catch (error: unknown) {
      if (!(error instanceof RollbackSignal)) throw error;
    }
  }

  async function readOnly(work: (tx: Tx) => Promise<void>): Promise<void> {
    try {
      await sql.begin('read only', async (tx: Tx): Promise<void> => {
        await tx`SET LOCAL statement_timeout = '15s'`;
        await tx`SET LOCAL lock_timeout = '5s'`;
        await tx`SET LOCAL idle_in_transaction_session_timeout = '30s'`;
        await work(tx);
        throw new RollbackSignal();
      });
    } catch (error: unknown) {
      if (!(error instanceof RollbackSignal)) throw error;
    }
  }

  async function insertEvent(
    tx: Tx,
    tenantId: string,
    aggregateType: string,
    eventType: string,
    aggregateId: string = crypto.randomUUID(),
  ): Promise<string> {
    const id = crypto.randomUUID();
    await tx`
      INSERT INTO core.outbox_events (id, tenant_id, aggregate_type, aggregate_id, event_type, payload)
      VALUES (${id}, ${tenantId}, ${aggregateType}, ${aggregateId}, ${eventType}, '{}'::jsonb)
    `;
    return id;
  }

  async function allowRoute(
    tx: Tx,
    aggregateType: string,
    eventType: string,
    workerRole: string = 'outbox_worker_role',
  ): Promise<void> {
    await tx`
      INSERT INTO core.outbox_relay_routes (worker_role, aggregate_type, event_type)
      VALUES (${workerRole}, ${aggregateType}, ${eventType})
      ON CONFLICT DO NOTHING
    `;
  }

  async function expectSqlState(
    tx: Tx,
    code: string,
    work: (sp: Tx) => Promise<unknown>,
  ): Promise<void> {
    await expect(tx.savepoint(work)).rejects.toMatchObject({ code });
  }

  async function makeSweepable(tx: Tx, id: string): Promise<void> {
    await tx`
      UPDATE core.outbox_events
      SET status = 'RETRY', attempt_count = 5, next_attempt_at = NOW() - INTERVAL '1 second'
      WHERE id = ${id}
    `;
  }

  async function claimByType(
    tx: Tx,
    token: string,
    aggregateType: string,
    eventTypes: string[],
  ): Promise<ClaimedRow[]> {
    return tx<ClaimedRow[]>`
      SELECT * FROM core.claim_outbox_event_by_type(${token}::uuid, ${aggregateType}, ${eventTypes}::text[])
    `;
  }

  async function statusOf(tx: Tx, id: string): Promise<string> {
    const [row] = await tx<
      { status: string }[]
    >`SELECT status FROM core.outbox_events WHERE id = ${id}`;
    return row.status;
  }

  beforeAll((): void => {
    sql = postgres(url!, { max: 1, prepare: false });
  });

  afterAll(async (): Promise<void> => {
    if (sql) await sql.end({ timeout: 5 });
  });

  it('claims only the requested aggregate type and event types', async (): Promise<void> => {
    await rolledBack(async (tx: Tx, tenantId: string): Promise<void> => {
      const token = crypto.randomUUID();
      await allowRoute(tx, 'Probe', 'ProbeEvent');
      await allowRoute(tx, 'Probe', 'OtherProbeEvent');
      await allowRoute(tx, 'OtherAggregate', 'ProbeEvent');
      const wanted = await insertEvent(tx, tenantId, 'Probe', 'ProbeEvent');
      await insertEvent(tx, tenantId, 'Probe', 'OtherProbeEvent');
      await insertEvent(tx, tenantId, 'OtherAggregate', 'ProbeEvent');
      const claimed = await claimByType(tx, token, 'Probe', ['ProbeEvent']);
      expect(claimed.map((row: ClaimedRow): string => row.id)).toEqual([wanted]);
      expect(await claimByType(tx, token, 'Probe', ['ProbeEvent'])).toHaveLength(0);
    });
  });

  it('runs claim, renew, retry, dead-letter and complete without a missing role function', async (): Promise<void> => {
    await rolledBack(async (tx: Tx, tenantId: string): Promise<void> => {
      const token = crypto.randomUUID();
      await allowRoute(tx, 'Probe', 'ProbeEvent');
      const first = await insertEvent(tx, tenantId, 'Probe', 'ProbeEvent');
      expect(await claimByType(tx, token, 'Probe', ['ProbeEvent'])).toHaveLength(1);
      const [renewed] = await tx<
        { ok: boolean }[]
      >`SELECT core.renew_outbox_lease(${first}::uuid, ${token}::uuid, 30) AS ok`;
      expect(renewed.ok).toBe(true);
      const [retried] = await tx<
        { ok: boolean }[]
      >`SELECT core.retry_outbox_event(${first}::uuid, ${token}::uuid) AS ok`;
      expect(retried.ok).toBe(true);
      expect(await statusOf(tx, first)).toBe('RETRY');

      await tx`UPDATE core.outbox_events SET next_attempt_at = NOW() - INTERVAL '1 second' WHERE id = ${first}`;
      expect(await claimByType(tx, token, 'Probe', ['ProbeEvent'])).toHaveLength(1);
      const [dead] = await tx<
        { ok: boolean }[]
      >`SELECT core.dead_letter_outbox_event(${first}::uuid, ${token}::uuid) AS ok`;
      expect(dead.ok).toBe(true);
      expect(await statusOf(tx, first)).toBe('DEAD');

      const second = await insertEvent(tx, tenantId, 'Probe', 'ProbeEvent');
      expect(await claimByType(tx, token, 'Probe', ['ProbeEvent'])).toHaveLength(1);
      const [done] = await tx<
        { ok: boolean }[]
      >`SELECT core.complete_outbox_event(${second}::uuid, ${token}::uuid) AS ok`;
      expect(done.ok).toBe(true);
      expect(await statusOf(tx, second)).toBe('COMPLETED');
    });
  });

  it('claims through the untyped function without an ambiguous column reference', async (): Promise<void> => {
    await rolledBack(async (tx: Tx, tenantId: string): Promise<void> => {
      await allowRoute(tx, 'Probe', 'ProbeEvent');
      const mine = await insertEvent(tx, tenantId, 'Probe', 'ProbeEvent');
      const rows = await tx<
        ClaimedRow[]
      >`SELECT * FROM core.claim_outbox_events(${crypto.randomUUID()}::uuid, 100)`;
      const own = rows.find((row: ClaimedRow): boolean => row.id === mine);
      expect(own?.attempt_count).toBe(1);
    });
  });

  it('never claims an excluded event, keeps it pending, and claims it after release', async (): Promise<void> => {
    await rolledBack(async (tx: Tx, tenantId: string): Promise<void> => {
      const token = crypto.randomUUID();
      await allowRoute(tx, 'Probe', 'ProbeEvent');
      const id = await insertEvent(tx, tenantId, 'Probe', 'ProbeEvent');
      await tx`INSERT INTO core.outbox_relay_exclusions (event_id, reason) VALUES (${id}, 'test-exclusion')`;
      expect(await claimByType(tx, token, 'Probe', ['ProbeEvent'])).toHaveLength(0);
      const untyped = await tx<
        ClaimedRow[]
      >`SELECT * FROM core.claim_outbox_events(${token}::uuid, 100)`;
      expect(untyped.map((row: ClaimedRow): string => row.id)).not.toContain(id);
      expect(await statusOf(tx, id)).toBe('PENDING');
      await tx`DELETE FROM core.outbox_relay_exclusions WHERE event_id = ${id}`;
      expect(await claimByType(tx, token, 'Probe', ['ProbeEvent'])).toHaveLength(1);
    });
  });

  it('rejects an unrouted event type with SQLSTATE 42501 and touches no event', async (): Promise<void> => {
    await rolledBack(async (tx: Tx, tenantId: string): Promise<void> => {
      const token = crypto.randomUUID();
      await allowRoute(tx, 'Probe', 'ProbeEvent');
      const routed = await insertEvent(tx, tenantId, 'Probe', 'ProbeEvent');
      const unrouted = await insertEvent(tx, tenantId, 'Probe', 'UnroutedProbeEvent');
      const sweepable = await insertEvent(tx, tenantId, 'Probe', 'UnroutedProbeEvent');
      await makeSweepable(tx, sweepable);
      await expectSqlState(tx, '42501', (sp: Tx): Promise<ClaimedRow[]> =>
        claimByType(sp, token, 'Probe', ['UnroutedProbeEvent']),
      );
      await expectSqlState(tx, '42501', (sp: Tx): Promise<ClaimedRow[]> =>
        claimByType(sp, token, 'Probe', ['ProbeEvent', 'UnroutedProbeEvent']),
      );
      await expectSqlState(
        tx,
        '42501',
        (sp: Tx): Promise<ClaimedRow[]> =>
          sp<ClaimedRow[]>`
            SELECT * FROM core.claim_notification_outbox_event(${token}::uuid, ARRAY['UnroutedProbeEvent']::text[])
          `,
      );
      expect(await statusOf(tx, routed)).toBe('PENDING');
      expect(await statusOf(tx, unrouted)).toBe('PENDING');
      expect(await statusOf(tx, sweepable)).toBe('RETRY');
    });
  });

  it('rejects a route owned by a role the session login is not a member of', async ({
    skip,
  }): Promise<void> => {
    let foreignRoleFound = false;
    await rolledBack(async (tx: Tx, tenantId: string): Promise<void> => {
      const [foreign] = await tx<{ rolname: string }[]>`
        SELECT r.rolname FROM pg_catalog.pg_roles r
        WHERE r.rolname NOT LIKE 'pg\_%'
          AND NOT pg_catalog.pg_has_role(session_user, r.oid, 'MEMBER')
        ORDER BY r.rolname LIMIT 1
      `;
      foreignRoleFound = foreign !== undefined;
      if (!foreign) return;
      const role = foreign.rolname;
      await allowRoute(tx, 'Probe', 'ForeignProbeEvent', role);
      const id = await insertEvent(tx, tenantId, 'Probe', 'ForeignProbeEvent');
      await expectSqlState(tx, '42501', (sp: Tx): Promise<ClaimedRow[]> =>
        claimByType(sp, crypto.randomUUID(), 'Probe', ['ForeignProbeEvent']),
      );
      expect(await statusOf(tx, id)).toBe('PENDING');
    });
    // Uses an existing role the login does not belong to, so the case runs no DDL.
    skip(!foreignRoleFound, 'every existing role is one the session login is a member of');
  });

  it('never claims or dead-letters events without a permitted route through the untyped claim', async (): Promise<void> => {
    await rolledBack(async (tx: Tx, tenantId: string): Promise<void> => {
      await allowRoute(tx, 'Probe', 'ProbeEvent');
      const routed = await insertEvent(tx, tenantId, 'Probe', 'ProbeEvent');
      const unrouted = await insertEvent(tx, tenantId, 'Probe', 'UnroutedProbeEvent');
      const sweepable = await insertEvent(tx, tenantId, 'Probe', 'UnroutedProbeEvent');
      await makeSweepable(tx, sweepable);
      const rows = await tx<
        ClaimedRow[]
      >`SELECT * FROM core.claim_outbox_events(${crypto.randomUUID()}::uuid, 100)`;
      const ids = rows.map((row: ClaimedRow): string => row.id);
      expect(ids).toContain(routed);
      expect(ids).not.toContain(unrouted);
      expect(ids).not.toContain(sweepable);
      const [unpermitted] = await tx<{ n: number }[]>`
        SELECT COUNT(*)::int AS n
        FROM pg_catalog.unnest(${ids}::uuid[]) AS claimed(claimed_id)
        JOIN core.outbox_events e ON e.id = claimed.claimed_id
        WHERE NOT EXISTS (
          SELECT 1 FROM core.outbox_relay_routes r
          JOIN pg_catalog.pg_roles wr ON wr.rolname = r.worker_role
          WHERE r.aggregate_type = e.aggregate_type AND r.event_type = e.event_type
            AND pg_catalog.pg_has_role(session_user, wr.oid, 'MEMBER')
        )
      `;
      expect(unpermitted.n).toBe(0);
      expect(await statusOf(tx, unrouted)).toBe('PENDING');
      expect(await statusOf(tx, sweepable)).toBe('RETRY');
    });
  });

  it('seeds the order notification routes and closes the routes table to web roles', async (): Promise<void> => {
    await readOnly(async (tx: Tx): Promise<void> => {
      const seeded = await tx<{ event_type: string }[]>`
        SELECT r.event_type FROM core.outbox_relay_routes r
        WHERE r.worker_role = 'outbox_worker_role' AND r.aggregate_type = 'Order'
        ORDER BY r.event_type
      `;
      expect(seeded.map((row: { event_type: string }): string => row.event_type)).toEqual(
        expect.arrayContaining([
          'OrderCancelledEvent',
          'OrderConfirmedEvent',
          'OrderPaidEvent',
          'OrderProcessingEvent',
          'OrderShippedEvent',
        ]),
      );
      const [access] = await tx<{ n: number }[]>`
        SELECT COUNT(*)::int AS n FROM pg_catalog.pg_roles r
        CROSS JOIN pg_catalog.unnest(ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE']) AS p(privilege)
        WHERE r.rolname IN ('anon', 'authenticated', 'service_role')
          AND pg_catalog.has_table_privilege(r.oid, 'core.outbox_relay_routes'::regclass, p.privilege)
      `;
      expect(access.n).toBe(0);
    });
  });

  it('keeps every historical order event excluded and pending', async (): Promise<void> => {
    await readOnly(async (tx: Tx): Promise<void> => {
      const rows = await tx<{ status: string; excluded: boolean }[]>`
        SELECT e.status,
               EXISTS (SELECT 1 FROM core.outbox_relay_exclusions x WHERE x.event_id = e.id) AS excluded
        FROM core.outbox_events e
        WHERE e.aggregate_type = 'Order'
          AND e.created_at < TIMESTAMPTZ '2026-10-15 00:00:00+00'
          AND e.status NOT IN ('COMPLETED', 'DEAD')
      `;
      for (const row of rows) {
        expect(row.excluded).toBe(true);
        expect(row.status).toBe('PENDING');
      }
    });
  });

  it('rejects invalid claim parameters with SQLSTATE 22023', async (): Promise<void> => {
    await rolledBack(async (tx: Tx): Promise<void> => {
      await expectSqlState(tx, '22023', (sp: Tx): Promise<ClaimedRow[]> =>
        claimByType(sp, crypto.randomUUID(), 'Probe', []),
      );
      await expectSqlState(tx, '22023', (sp: Tx): Promise<ClaimedRow[]> =>
        claimByType(sp, crypto.randomUUID(), 'bad type!', ['ProbeEvent']),
      );
      await expectSqlState(
        tx,
        '22023',
        (sp: Tx): Promise<ClaimedRow[]> =>
          sp<
            ClaimedRow[]
          >`SELECT * FROM core.claim_outbox_event_by_type(NULL::uuid, 'Probe', ARRAY['ProbeEvent']::text[])`,
      );
    });
  });

  it('does not expose the claim functions to authenticated web sessions', async (): Promise<void> => {
    await rolledBack(async (tx: Tx): Promise<void> => {
      await expectSqlState(tx, '42501', async (sp: Tx): Promise<ClaimedRow[]> => {
        await sp`SET LOCAL ROLE authenticated`;
        return sp<
          ClaimedRow[]
        >`SELECT * FROM core.claim_outbox_event_by_type(${crypto.randomUUID()}::uuid, 'Order', ARRAY['OrderCancelledEvent']::text[])`;
      });
      await expectSqlState(tx, '42501', async (sp: Tx): Promise<ClaimedRow[]> => {
        await sp`SET LOCAL ROLE authenticated`;
        return sp<
          ClaimedRow[]
        >`SELECT * FROM core.claim_outbox_events(${crypto.randomUUID()}::uuid, 1)`;
      });
    });
  });

  it('refuses to deliver a notification for an excluded event and delivers once released', async (): Promise<void> => {
    await rolledBack(async (tx: Tx, tenantId: string): Promise<void> => {
      await tx`
        DO $$
        BEGIN
          IF NOT pg_catalog.pg_has_role(session_user, 'notification_worker_role', 'MEMBER') THEN
            EXECUTE format('GRANT notification_worker_role TO %I', session_user);
          END IF;
        END;
        $$
      `;
      const orderId = crypto.randomUUID();
      const owner = crypto.randomUUID();
      const eventId = await insertEvent(tx, tenantId, 'Order', 'OrderCancelledEvent', orderId);
      await tx`INSERT INTO core.outbox_relay_exclusions (event_id, reason) VALUES (${eventId}, 'test-exclusion')`;
      const [excluded] = await tx<{ result: string }[]>`
        SELECT core.claim_notification_delivery(${eventId}::uuid, ${tenantId}::uuid, ${orderId}::uuid, 'OrderCancelledEvent', ${owner}::uuid) AS result
      `;
      expect(excluded.result).toBe('INVALID');
      await tx`DELETE FROM core.outbox_relay_exclusions WHERE event_id = ${eventId}`;
      const [released] = await tx<{ result: string }[]>`
        SELECT core.claim_notification_delivery(${eventId}::uuid, ${tenantId}::uuid, ${orderId}::uuid, 'OrderCancelledEvent', ${owner}::uuid) AS result
      `;
      expect(released.result).toBe('CLAIMED');
    });
  });

  it('leaves no temporary CREATE privilege and no function that calls has_role', async (): Promise<void> => {
    await readOnly(async (tx: Tx): Promise<void> => {
      const [schema] = await tx<{ outbox: boolean; notification: boolean }[]>`
        SELECT has_schema_privilege('outbox_rpc_owner', 'core', 'CREATE') AS outbox,
               has_schema_privilege('notification_rpc_owner', 'core', 'CREATE') AS notification
      `;
      expect(schema).toEqual({ outbox: false, notification: false });
      const [legacy] = await tx<{ n: number }[]>`
        SELECT COUNT(*)::int AS n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname IN ('core', 'catalog', 'public') AND p.prosrc ~ '(^|[^_a-z])has_role\\('
      `;
      expect(legacy.n).toBe(0);
    });
  });
});
