import postgres from 'postgres';
import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import { PostgresBusinessIntelligenceReadAdapter } from '@/dashboard/infrastructure/postgres-business-intelligence-read.adapter';

const databaseUrl = process.env.BUSINESS_INTELLIGENCE_TEST_DATABASE_URL;

/** Opt-in, read-only probe against a migrated database containing an existing store manager. */
describe.skipIf(!databaseUrl)('business intelligence PostgreSQL tenant isolation', (): void => {
  let sql: postgres.Sql<Record<string, unknown>>;
  beforeAll((): void => {
    sql = postgres(databaseUrl!, { prepare: false, max: 1, connect_timeout: 10 });
  });
  afterAll(async (): Promise<void> => {
    if (sql) await sql.end({ timeout: 5 });
  });

  it('matches real net sales and denies nonmembers and unknown tenants', async (): Promise<void> => {
    const [manager] = await sql<{ user_id: string; tenant_id: string }[]>`
      SELECT user_id,tenant_id FROM core.tenant_memberships
      WHERE status='active' AND role IN ('OWNER','ADMIN') LIMIT 1`;
    expect(manager, 'An existing active store manager is required').toBeDefined();
    const adapter = new PostgresBusinessIntelligenceReadAdapter(sql);
    const query = { days: 30 as const, leadTimeDays: 7, targetCoverageDays: 30 };
    const report = await adapter.findForManager(manager.user_id, manager.tenant_id, query);
    expect(report).not.toBeNull();
    const [totals] = await sql<{ revenue: string; orders: number }[]>`
      SELECT coalesce(sum(greatest(0,subtotal_cents::bigint-discount_amount_cents)),0)::text AS revenue,count(*)::int AS orders
      FROM sales.orders WHERE tenant_id=${manager.tenant_id}::uuid
        AND status IN ('paid','processing','shipped','delivered')
        AND created_at >= (date_trunc('day',current_timestamp AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') - interval '30 days'
        AND created_at < date_trunc('day',current_timestamp AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'`;
    expect(report?.revenueCents).toBe(Number(totals.revenue));
    expect(report?.orderCount).toBe(totals.orders);
    expect(await adapter.findForManager(crypto.randomUUID(), manager.tenant_id, query)).toBeNull();
    expect(await adapter.findForManager(manager.user_id, crypto.randomUUID(), query)).toBeNull();
  });
});
