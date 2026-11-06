import { describe, it, expect, vi } from 'vitest';
import type postgres from 'postgres';
import { PostgresBusinessIntelligenceReadAdapter } from '@/dashboard/infrastructure/postgres-business-intelligence-read.adapter';

const query = { days: 30, leadTimeDays: 7, targetCoverageDays: 30 };
describe('authorized business intelligence projection', (): void => {
  it('scopes all sources to the authorized manager and limits eligible orders', async (): Promise<void> => {
    const sql = vi.fn().mockResolvedValue([
      {
        observed_at: new Date('2026-10-25T12:00:00Z'),
        currency: 'USD',
        products: [],
        orders: [],
        flow_orders: [],
      },
    ]);
    const report = await new PostgresBusinessIntelligenceReadAdapter(
      sql as unknown as postgres.Sql<Record<string, unknown>>,
    ).findForManager('actor', 'tenant', query);
    expect(report?.revenueCents).toBe(0);
    expect(report?.daily).toHaveLength(30);
    const [parts, ...values] = sql.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
    const statement = parts.join('?');
    expect(values).toEqual(['actor', 'tenant', null, null, 30]);
    expect(statement).toContain(
      "core.member_has_permission(m.user_id, m.tenant_id, ARRAY['VIEW_REPORTS']::text[])",
    );
    expect(statement).toContain("m.status='active'");
    expect(statement).toContain('m.user_id=');
    expect(statement).toContain('p.tenant_id=a.id');
    expect(statement).toContain('c.tenant_id=p.tenant_id');
    expect(statement).toContain('o.tenant_id=a.id');
    expect(statement).toContain("o.status IN ('paid','processing','shipped','delivered')");
    expect(statement).toContain('i.order_id=o.id');
    expect(statement).toContain('sales.order_status_history h');
    expect(statement).toContain("date_trunc('day',current_timestamp AT TIME ZONE 'UTC')");
  });
  it('does not reveal data to an unauthorized tenant/manager pair', async (): Promise<void> => {
    const sql = vi.fn().mockResolvedValue([]);
    expect(
      await new PostgresBusinessIntelligenceReadAdapter(
        sql as unknown as postgres.Sql<Record<string, unknown>>,
      ).findForManager('outsider', 'tenant', query),
    ).toBeNull();
  });
  it('translates database failures into typed infrastructure failures', async (): Promise<void> => {
    const sql = vi.fn().mockRejectedValue(new Error('database password'));
    await expect(
      new PostgresBusinessIntelligenceReadAdapter(
        sql as unknown as postgres.Sql<Record<string, unknown>>,
      ).findForManager('actor', 'tenant', query),
    ).rejects.toMatchObject({ name: 'BusinessIntelligenceReadException' });
  });
});
