import { describe, expect, it, vi } from 'vitest';
import type postgres from 'postgres';
import { PostgresDashboardOverviewReadAdapter } from '@/dashboard/infrastructure/postgres-dashboard-overview-read.adapter';
import { DashboardOverviewReadException } from '@/dashboard/application/exceptions/dashboard-overview-read.exception';

const row = {
  name: 'Store',
  slug: 'store',
  currency: 'USD',
  observed_at: new Date('2026-10-19T17:00:00Z'),
  awaiting_preparation: 37,
  processing: 2,
  shipped: 3,
  pending_payment: 4,
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
    const result = await adapter.findForManager('actor', 'tenant');
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
    expect(parameters).toEqual(['actor', 'tenant']);
    expect(statement).toContain("m.status='active' AND m.role IN ('OWNER','ADMIN')");
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
    expect(await adapter.findForManager('outsider', 'other-tenant')).toBeNull();
  });
  it('preserves real zero counts and an empty order list', async (): Promise<void> => {
    const adapter = new PostgresDashboardOverviewReadAdapter(
      vi
        .fn()
        .mockResolvedValue([
          { ...row, awaiting_preparation: 0, active_products: 0, recent_orders: [] },
        ]) as unknown as postgres.Sql<Record<string, unknown>>,
    );
    const result = await adapter.findForManager('actor', 'tenant');
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
    await expect(adapter.findForManager('actor', 'tenant')).rejects.toThrow(
      DashboardOverviewReadException,
    );
  });
});
