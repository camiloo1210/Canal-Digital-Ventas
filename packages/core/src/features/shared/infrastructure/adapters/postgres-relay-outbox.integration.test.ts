import postgres from 'postgres';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PostgresRelayOutboxAdapter } from '@/shared/infrastructure/adapters/postgres-relay-outbox.adapter';
import { PostgresNotificationAdapter } from '@/notifications/infrastructure/postgres-notification.adapter';

// Explicitly opt in using an isolated, migrated database whose name contains "test".
const url = process.env.OUTBOX_TEST_DATABASE_URL;

describe.skipIf(!url)('PostgreSQL outbox relay fencing integration', (): void => {
  let sql: postgres.Sql<Record<string, unknown>>;
  let first: PostgresRelayOutboxAdapter;
  let second: PostgresRelayOutboxAdapter;
  const tenantId = crypto.randomUUID();
  let eventId: string;

  beforeAll(async (): Promise<void> => {
    if (!new URL(url!).pathname.includes('test'))
      throw new Error('An isolated test database is required');
    sql = postgres(url!, { max: 3 });
    const [row] = await sql<
      { count: number }[]
    >`SELECT COUNT(*)::int AS count FROM core.outbox_events`;
    if (row.count !== 0) throw new Error('Test database outbox must be empty');
    await sql`
      INSERT INTO core.tenants (id, name, slug, contact_email, base_currency, status)
      VALUES (${tenantId}, 'Relay test', ${`relay-test-${tenantId}`}, 'relay@example.test', 'USD', 'active')
    `;
    first = new PostgresRelayOutboxAdapter(sql, crypto.randomUUID(), ['OrderCancelledEvent']);
    second = new PostgresRelayOutboxAdapter(sql, crypto.randomUUID(), ['OrderCancelledEvent']);
  });

  beforeEach(async (): Promise<void> => {
    await sql`DELETE FROM core.outbox_events WHERE tenant_id = ${tenantId}`;
    eventId = crypto.randomUUID();
    await sql`
      INSERT INTO core.outbox_events (id, tenant_id, aggregate_type, aggregate_id, event_type, payload)
      VALUES (${eventId}, ${tenantId}, 'Order', ${crypto.randomUUID()}, 'OrderCancelledEvent', '{"orderId":"order-1"}'::jsonb)
    `;
  });

  afterAll(async (): Promise<void> => {
    if (sql) {
      await sql`DELETE FROM core.tenants WHERE id = ${tenantId}`;
      await sql.end();
    }
  });

  it('allows only one concurrent worker to claim an event', async (): Promise<void> => {
    const claims = await Promise.all([first.claim(), second.claim()]);
    const claimed = claims.filter((item): boolean => item !== null);
    expect(claimed).toHaveLength(1);
    expect(claimed[0]).toMatchObject({
      messageId: eventId,
      tenantId,
      payload: { orderId: 'order-1' },
    });
  });

  it('leaves non-notification events pending instead of consuming or completing them', async (): Promise<void> => {
    const unrelatedId = crypto.randomUUID();
    await sql`
      INSERT INTO core.outbox_events (id, tenant_id, aggregate_type, aggregate_id, event_type, payload)
      VALUES (${unrelatedId}, ${tenantId}, 'Product', ${crypto.randomUUID()}, 'ProductCreatedEvent', '{}'::jsonb)
    `;
    const event = await first.claim();
    expect(event?.messageId).toBe(eventId);
    await first.complete(eventId);
    expect(await first.claim()).toBeNull();
    const [row] = await sql<
      { status: string; attempt_count: number }[]
    >`SELECT status, attempt_count FROM core.outbox_events WHERE id = ${unrelatedId}`;
    expect(row).toMatchObject({ status: 'PENDING', attempt_count: 0 });
  });

  it('deduplicates sent notifications and rejects messages with a forged tenant', async (): Promise<void> => {
    const event = await first.claim();
    if (!event) throw new Error('Missing notification fixture');
    const deliveries = new PostgresNotificationAdapter(sql, crypto.randomUUID());
    expect(await deliveries.claim(event)).toBe('CLAIMED');
    await deliveries.complete(event.messageId);
    expect(await deliveries.claim(event)).toBe('SENT');
    await expect(deliveries.claim({ ...event, tenantId: crypto.randomUUID() })).rejects.toThrow(
      'INVALID_NOTIFICATION_EVENT',
    );
  });

  it('fences delivery completion to its notification consumer', async (): Promise<void> => {
    const event = await first.claim();
    if (!event) throw new Error('Missing notification fixture');
    const deliveries = new PostgresNotificationAdapter(sql, crypto.randomUUID());
    const other = new PostgresNotificationAdapter(sql, crypto.randomUUID());
    expect(await deliveries.claim(event)).toBe('CLAIMED');
    expect(await other.claim(event)).toBe('BUSY');
    await expect(other.complete(event.messageId)).rejects.toThrow('lease');
    await deliveries.complete(event.messageId);
  });

  it('rejects completion by a worker that does not own the lease', async (): Promise<void> => {
    await first.claim();
    await expect(second.complete(eventId)).rejects.toThrow('lease');
    await first.complete(eventId);
    const [row] = await sql<
      { status: string }[]
    >`SELECT status FROM core.outbox_events WHERE id = ${eventId}`;
    expect(row.status).toBe('COMPLETED');
  });

  it('reclaims expired leases and fences out the former owner', async (): Promise<void> => {
    await first.claim();
    await sql`UPDATE core.outbox_events SET lease_until = NOW() - INTERVAL '1 second' WHERE id = ${eventId}`;
    expect(await second.claim()).toMatchObject({ messageId: eventId });
    await expect(first.complete(eventId)).rejects.toThrow('lease');
    await second.complete(eventId);
  });

  it('honors backoff and stops retrying after five attempts', async (): Promise<void> => {
    await first.claim();
    await first.retry(eventId);
    expect(await second.claim()).toBeNull();
    await sql`UPDATE core.outbox_events SET attempt_count = 4, next_attempt_at = NOW() - INTERVAL '1 second' WHERE id = ${eventId}`;
    await second.claim();
    await second.retry(eventId);
    const [row] = await sql<
      { status: string }[]
    >`SELECT status FROM core.outbox_events WHERE id = ${eventId}`;
    expect(row.status).toBe('DEAD');
    expect(await first.claim()).toBeNull();
  });

  it('does not expose the worker RPC to authenticated web sessions', async (): Promise<void> => {
    await expect(
      sql.begin(async (tx): Promise<void> => {
        await tx`SET LOCAL ROLE authenticated`;
        await tx`SELECT * FROM core.claim_notification_outbox_event(${crypto.randomUUID()}::uuid, ARRAY['OrderCancelledEvent']::text[])`;
      }),
    ).rejects.toMatchObject({ code: '42501' });
  });
});
