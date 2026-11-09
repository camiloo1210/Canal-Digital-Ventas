import postgres from 'postgres';
import { describe, expect, it } from 'vitest';
import { PostgresTrackingRepository } from '@/shipment-tracking/infrastructure/postgres-tracking.repository';
import { PostgresBuyerTrackingReadAdapter } from '@/shipment-tracking/infrastructure/postgres-buyer-tracking-read.adapter';

const adminUrl = process.env.TRACKING_TEST_DATABASE_URL;
const workerUrl = process.env.TRACKING_TEST_WORKER_DATABASE_URL;
const tenant = process.env.TRACKING_TEST_TENANT_ID;
const order = process.env.TRACKING_TEST_ORDER_ID;
const buyer = process.env.TRACKING_TEST_BUYER_ID;
const otherBuyer = process.env.TRACKING_TEST_OTHER_BUYER_ID;
const deployment = process.env.TRACKING_TEST_DEPLOYMENT_ID;
const enabled =
  process.env.TRACKING_TEST_ALLOW_MUTATION === '1' &&
  !!adminUrl &&
  !!workerUrl &&
  !!tenant &&
  !!order &&
  !!buyer &&
  !!otherBuyer &&
  !!deployment;

describe.skipIf(!enabled)('tracking fencing (disposable local fixture)', (): void => {
  it('enforces tenant ownership, exclusive claims, stale fencing and rollback', async (): Promise<void> => {
    const adminAddress = new URL(adminUrl as string);
    const workerAddress = new URL(workerUrl as string);
    for (const address of [adminAddress, workerAddress]) {
      if (
        !['localhost', '127.0.0.1', '[::1]'].includes(address.hostname) ||
        address.port !== '55439' ||
        !/^\/cdv_tracking_test(?:_[a-z0-9_]+)?$/.test(address.pathname)
      )
        throw new Error('Dedicated local tracking test database required');
    }
    if (
      adminAddress.hostname !== workerAddress.hostname ||
      adminAddress.port !== workerAddress.port ||
      adminAddress.pathname !== workerAddress.pathname
    )
      throw new Error('Both test roles must use the same disposable database');
    const admin = postgres(adminAddress.href, { max: 1, prepare: false, connect_timeout: 5 });
    const workers = postgres(workerAddress.href, { max: 2, prepare: false, connect_timeout: 5 });
    try {
      const [fixture] = await admin<
        {
          tracking_number: string;
          carrier: string | null;
          original_link: Record<string, unknown>;
        }[]
      >`
        SELECT m.tracking_number, m.carrier, row_to_json(l) AS original_link
        FROM sales.manual_shipments m JOIN sales.shipment_tracking_links l ON l.order_id = m.order_id AND l.tenant_id = m.tenant_id
        JOIN sales.shipment_tracking_environment env ON env.singleton AND env.environment = 'sandbox'
        WHERE m.order_id = ${order}::uuid AND m.tenant_id = ${tenant}::uuid AND env.deployment_id = ${deployment}::uuid AND m.tracking_number = l.tracking_number`;
      if (!fixture)
        throw new Error('Provision a matching sandbox order fixture before running this test');
      const other = await admin<
        { count: number }[]
      >`SELECT count(*)::int AS count FROM sales.shipment_tracking_links WHERE active AND NOT paused AND order_id <> ${order}::uuid AND next_poll_at <= clock_timestamp()`;
      if (other[0]?.count !== 0) throw new Error('The disposable fixture must be the only due job');
      try {
        await admin`UPDATE sales.shipment_tracking_links SET active = true, paused = false, next_poll_at = clock_timestamp() - interval '1 minute', lease_token = NULL, lease_until = NULL WHERE order_id = ${order}::uuid AND tenant_id = ${tenant}::uuid`;
        const repo = new PostgresTrackingRepository(workers);
        const now = new Date().toISOString();
        const claims = await Promise.all([
          repo.claimDue(now, crypto.randomUUID()),
          repo.claimDue(now, crypto.randomUUID()),
        ]);
        const claimed = claims.filter((item): boolean => item !== null);
        expect(claimed).toHaveLength(1);
        const claim = claims.find((item) => item !== null);
        if (!claim) throw new Error('No claim obtained');
        expect(claim.tenantId).toBe(tenant);
        await admin`UPDATE sales.shipment_tracking_links SET lease_until = clock_timestamp() - interval '1 second' WHERE order_id = ${order}::uuid AND tenant_id = ${tenant}::uuid`;
        const recovered = await repo.claimDue(new Date().toISOString(), crypto.randomUUID());
        expect(recovered).not.toBeNull();
        expect(await repo.apply(claim, { kind: 'found', observations: [] }, now)).toBe('stale');
        if (!recovered) throw new Error('Lease could not be recovered');
        const reader = new PostgresBuyerTrackingReadAdapter(admin, now);
        expect(
          await reader.findByBuyer(buyer as string, order as string, deployment as string),
        ).not.toBeNull();
        expect(
          await reader.findByBuyer(otherBuyer as string, order as string, deployment as string),
        ).toBeNull();
        expect(
          await reader.findByBuyer(buyer as string, order as string, crypto.randomUUID()),
        ).toBeNull();
        await admin`UPDATE sales.manual_shipments SET tracking_number = 'replacement-integration-test' WHERE order_id = ${order}::uuid AND tenant_id = ${tenant}::uuid`;
        expect(await repo.apply(recovered, { kind: 'found', observations: [] }, now)).toBe('stale');
        const [before] = await admin<
          { generation: number }[]
        >`SELECT generation FROM sales.shipment_tracking_links WHERE order_id = ${order}::uuid`;
        await expect(
          admin.begin(async (tx): Promise<void> => {
            await tx`UPDATE sales.shipment_tracking_links SET generation = generation + 1 WHERE order_id = ${order}::uuid`;
            throw new Error('force rollback');
          }),
        ).rejects.toThrow('force rollback');
        const [after] = await admin<
          { generation: number }[]
        >`SELECT generation FROM sales.shipment_tracking_links WHERE order_id = ${order}::uuid`;
        expect(Number(after?.generation)).toBe(Number(before?.generation));
      } finally {
        await admin.begin(async (tx): Promise<void> => {
          await tx`UPDATE sales.manual_shipments SET tracking_number = ${fixture.tracking_number}, carrier = ${fixture.carrier} WHERE order_id = ${order}::uuid AND tenant_id = ${tenant}::uuid`;
          await tx`UPDATE sales.shipment_tracking_links SET (tracking_number, credential_ref, generation, active, paused, next_poll_at, last_success_at, last_error_at, lease_token, lease_until, attempts, result) =
            (x.tracking_number, x.credential_ref, x.generation, x.active, x.paused, x.next_poll_at, x.last_success_at, x.last_error_at, x.lease_token, x.lease_until, x.attempts, x.result)
            FROM json_populate_record(NULL::sales.shipment_tracking_links, ${JSON.stringify(fixture.original_link)}::json) x
            WHERE sales.shipment_tracking_links.order_id = ${order}::uuid AND sales.shipment_tracking_links.tenant_id = ${tenant}::uuid`;
        });
      }
    } finally {
      await workers.end({ timeout: 5 });
      await admin.end({ timeout: 5 });
    }
  }, 30000);
});
