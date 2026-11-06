import { describe, expect, it, vi } from 'vitest';
import type postgres from 'postgres';
import { PostgresDashboardOverviewReadAdapter } from '@/dashboard/infrastructure/postgres-dashboard-overview-read.adapter';
import { DashboardOverviewReadException } from '@/dashboard/application/exceptions/dashboard-overview-read.exception';

const period = { days: 7 };
const row = {
  name: 'Store',
  slug: 'store',
  currency: 'USD',
  observed_at: new Date('2026-10-19T17:00:00Z'),
  awaiting_preparation: 37,
  processing: 2,
  shipped: 3,
  pending_payment: 4,
  period_ends: new Date('2026-10-19T00:00:00Z'),
  period_revenue: '50000',
  previous_revenue: '40000',
  period_orders: 5,
  lifetime_revenue: '900000',
  lifetime_orders: 40,
  buying_customers: 3,
  total_customers: 21,
  active_products: 150,
  active_categories: 9,
  out_of_stock: 7,
  without_image: 11,
  recent_orders: [
    {
      id: 'order',
      order_number: 'ORD-1',
      status: 'paid',
      created_at: '2026-10-19T16:00:00Z',
      customer_name: 'Customer',
      total_amount_cents: 12345,
    },
  ],
};

describe('dashboard operational projection', (): void => {
  it('keeps full counts independent of the recent sample and serializes minor units', async (): Promise<void> => {
    const sql = vi.fn().mockResolvedValue([row]);
    const adapter = new PostgresDashboardOverviewReadAdapter(
      sql as unknown as postgres.Sql<Record<string, unknown>>,
    );
    const result = await adapter.findForManager('actor', 'tenant', period);
    expect(result).toMatchObject({
      awaitingPreparation: 37,
      activeProducts: 150,
      outOfStock: 7,
      observedAt: '2026-10-19T17:00:00.000Z',
    });
    expect(result?.recentOrders).toEqual([
      {
        id: 'order',
        orderNumber: 'ORD-1',
        status: 'paid',
        createdAt: '2026-10-19T16:00:00.000Z',
        customerName: 'Customer',
        totalAmountCents: 12345,
        currency: 'USD',
      },
    ]);
    expect(sql).toHaveBeenCalledTimes(1);
    const [parts, ...parameters] = sql.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
    const statement = parts.join('?');
    expect(parameters[0]).toBe('actor');
    expect(parameters[parameters.length - 1]).toBe('tenant');
    expect(parameters.filter((value): boolean => value === null)).toHaveLength(2);
    expect(parameters.filter((value): boolean => value === 7).length).toBeGreaterThan(0);
    expect(result?.kpis).toEqual({
      currency: 'USD',
      periodStart: '2026-10-12',
      periodEnd: '2026-10-18',
      revenueCents: 50000,
      previousRevenueCents: 40000,
      revenueChangeBps: 2500,
      orderCount: 5,
      lifetimeRevenueCents: 900000,
      lifetimeOrderCount: 40,
      totalCustomers: 21,
      buyingCustomers: 3,
    });
    expect(statement).toContain("ord.status IN ('paid','processing','shipped','delivered')");
    expect(statement).toContain('ord.tenant_id=t.id');
    expect(statement).toContain(
      "m.status='active' AND core.member_has_permission(m.user_id, m.tenant_id, ARRAY['VIEW_OVERVIEW']::text[])",
    );
    expect(statement).toContain('m.user_id=?::uuid');
    expect(statement).toContain('WHERE t.id=?::uuid');
    expect(statement).toContain("WHERE ord.tenant_id=t.id AND ord.status<>'draft'");
    expect(statement).toContain('FROM sales.orders WHERE tenant_id=t.id');
    expect(statement).toContain('FROM catalog.products WHERE tenant_id=t.id');
  });
  it('returns no information when the manager/tenant pair has no visible row', async (): Promise<void> => {
    const adapter = new PostgresDashboardOverviewReadAdapter(
      vi.fn().mockResolvedValue([]) as unknown as postgres.Sql<Record<string, unknown>>,
    );
    expect(await adapter.findForManager('outsider', 'other-tenant', period)).toBeNull();
  });
  it('preserves real zero counts and an empty order list', async (): Promise<void> => {
    const adapter = new PostgresDashboardOverviewReadAdapter(
      vi
        .fn()
        .mockResolvedValue([
          { ...row, awaiting_preparation: 0, active_products: 0, recent_orders: [] },
        ]) as unknown as postgres.Sql<Record<string, unknown>>,
    );
    const result = await adapter.findForManager('actor', 'tenant', period);
    expect(result?.awaitingPreparation).toBe(0);
    expect(result?.activeProducts).toBe(0);
    expect(result?.recentOrders).toEqual([]);
  });
  it('translates database errors instead of returning a misleading empty summary', async (): Promise<void> => {
    const adapter = new PostgresDashboardOverviewReadAdapter(
      vi.fn().mockRejectedValue(new Error('database detail')) as unknown as postgres.Sql<
        Record<string, unknown>
      >,
    );
    await expect(adapter.findForManager('actor', 'tenant', period)).rejects.toThrow(
      DashboardOverviewReadException,
    );
  });
  it('rejects monetary totals that cannot be serialized without precision loss', async (): Promise<void> => {
    for (const field of ['period_revenue', 'previous_revenue', 'lifetime_revenue']) {
      const sql = vi.fn().mockResolvedValue([{ ...row, [field]: '9007199254740993' }]);
      const adapter = new PostgresDashboardOverviewReadAdapter(
        sql as unknown as postgres.Sql<Record<string, unknown>>,
      );
      await expect(adapter.findForManager('actor', 'tenant', period)).rejects.toThrow(
        DashboardOverviewReadException,
      );
    }
  });
  it('preserves the largest safe total exactly', async (): Promise<void> => {
    const sql = vi.fn().mockResolvedValue([
      {
        ...row,
        period_revenue: String(Number.MAX_SAFE_INTEGER),
        previous_revenue: String(Number.MAX_SAFE_INTEGER),
        lifetime_revenue: String(Number.MAX_SAFE_INTEGER),
      },
    ]);
    const adapter = new PostgresDashboardOverviewReadAdapter(
      sql as unknown as postgres.Sql<Record<string, unknown>>,
    );
    const result = await adapter.findForManager('actor', 'tenant', period);
    expect(result?.kpis.revenueCents).toBe(Number.MAX_SAFE_INTEGER);
    expect(result?.kpis.previousRevenueCents).toBe(Number.MAX_SAFE_INTEGER);
    expect(result?.kpis.lifetimeRevenueCents).toBe(Number.MAX_SAFE_INTEGER);
    expect(result?.kpis.revenueChangeBps).toBe(0);
  });
  it('rejects unsafe basis points even when revenue totals are safe', async (): Promise<void> => {
    const sql = vi.fn().mockResolvedValue([
      {
        ...row,
        period_revenue: String(Number.MAX_SAFE_INTEGER),
        previous_revenue: '1',
      },
    ]);
    const adapter = new PostgresDashboardOverviewReadAdapter(
      sql as unknown as postgres.Sql<Record<string, unknown>>,
    );
    await expect(adapter.findForManager('actor', 'tenant', period)).rejects.toThrow(
      DashboardOverviewReadException,
    );
  });
  it('rejects an out-of-range period before touching the database', async (): Promise<void> => {
    const sql = vi.fn();
    const adapter = new PostgresDashboardOverviewReadAdapter(
      sql as unknown as postgres.Sql<Record<string, unknown>>,
    );
    await expect(adapter.findForManager('actor', 'tenant', { days: 0 })).rejects.toThrow(
      DashboardOverviewReadException,
    );
    expect(sql).not.toHaveBeenCalled();
  });
});
