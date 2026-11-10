import { describe, expect, it, vi } from 'vitest';
import type postgres from 'postgres';
import { PostgresSellerOrderReadRepository } from '@/orders/infrastructure/repositories/postgres-seller-order-read.repository';
import { OrderRepositoryException } from '@/orders/application/exceptions/order-repository.exception';

const actor = '550e8400-e29b-41d4-a716-446655440000';
const tenant = '650e8400-e29b-41d4-a716-446655440000';
const row = {
  id: '750e8400-e29b-41d4-a716-446655440000',
  orderNumber: 'ORD-51',
  status: 'paid',
  version: 4,
  totalAmountCents: 12345,
  currency: 'USD',
  createdAt: '2026-10-19T12:00:00Z',
  customerName: 'Customer',
  shippingAddress: 'Address',
  items: [{ id: 'item', productName: 'Product', quantity: 3 }],
};

describe('seller order search projection', (): void => {
  it('searches the complete tenant catalog and paginates deterministically with a full count', async (): Promise<void> => {
    const sql = vi.fn().mockResolvedValue([{ total: 51, canManage: true, items: [row] }]);
    const repository = new PostgresSellerOrderReadRepository(
      sql as unknown as postgres.Sql<Record<string, unknown>>,
    );
    const result = await repository.findBySeller(actor, tenant, 3, {
      query: '50%_',
      status: 'paid',
    });
    expect(result).toMatchObject({
      authorized: true,
      page: 3,
      totalItems: 51,
      totalPages: 3,
      hasNext: false,
      items: [
        {
          nextStatus: 'processing',
          totalAmountCents: 12345,
          createdAt: '2026-10-19T12:00:00.000Z',
        },
      ],
    });
    const [parts, ...parameters] = sql.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
    const statement = parts.join('?');
    expect(parameters).toEqual([
      tenant,
      actor,
      'paid',
      'paid',
      '50%_',
      '%50\\%\\_%',
      '%50\\%\\_%',
      null,
      null,
      tenant,
      50,
    ]);
    expect(statement).toContain(
      "m.status='active' AND core.member_has_permission(m.user_id, m.tenant_id, ARRAY['VIEW_ORDERS','MANAGE_ORDERS']::text[])",
    );
    expect(statement).toContain('c.tenant_id=o.tenant_id');
    expect(statement).toContain('own.tenant_id=?::uuid');
    expect(statement).toContain("o.status<>'draft'");
    expect(statement).toContain('SELECT count(*)::int FROM filtered');
    expect(statement).toContain('o.order_number ILIKE ? OR c.name ILIKE ?');
    expect(sql).toHaveBeenCalledTimes(3);
  });
  it('does not offer shipment editing to viewers without management permission', async (): Promise<void> => {
    const sql = vi
      .fn()
      .mockResolvedValueOnce([{ total: 1, canManage: false, items: [row] }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const repository = new PostgresSellerOrderReadRepository(
      sql as unknown as postgres.Sql<Record<string, unknown>>,
    );
    const result = await repository.findBySeller(actor, tenant, 1);
    expect(result.items[0]?.canManageShipment).toBe(false);
    expect(result.items[0]?.nextStatus).toBeNull();
  });
  it('projects shipment details and enables editing for a manager', async (): Promise<void> => {
    const sql = vi
      .fn()
      .mockResolvedValueOnce([{ total: 1, canManage: true, items: [row] }])
      .mockResolvedValueOnce([
        { order_id: row.id, carrier: 'Carrier', tracking_number: 'ABC', version: 2 },
      ])
      .mockResolvedValueOnce([]);
    const repository = new PostgresSellerOrderReadRepository(
      sql as unknown as postgres.Sql<Record<string, unknown>>,
    );
    const result = await repository.findBySeller(actor, tenant, 1);
    expect(result.items[0]).toMatchObject({
      canManageShipment: true,
      shipment: { carrier: 'Carrier', trackingNumber: 'ABC', version: 2 },
    });
  });
  it('projects the shipment creation job scoped by tenant and order without exposing the label path', async (): Promise<void> => {
    const sql = vi
      .fn()
      .mockResolvedValueOnce([{ total: 2, canManage: true, items: [row, { ...row, id: 'other' }] }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          order_id: row.id,
          state: 'needs_attention',
          reason: 'AMBIGUOUS_RESULT',
          label_path: null,
          provider_tracking_number: '794600000001',
        },
      ]);
    const repository = new PostgresSellerOrderReadRepository(
      sql as unknown as postgres.Sql<Record<string, unknown>>,
    );
    const result = await repository.findBySeller(actor, tenant, 1);
    expect(result.items[0]?.shipmentJob).toEqual({
      state: 'needs_attention',
      reason: 'AMBIGUOUS_RESULT',
      hasLabel: false,
      providerTrackingNumber: '794600000001',
    });
    expect(result.items[1]?.shipmentJob).toBeNull();
    const [parts, ...parameters] = sql.mock.calls[2] as [TemplateStringsArray, ...unknown[]];
    expect(parts.join('?')).toContain('j.tenant_id = ?::uuid');
    expect(parameters).toContain(tenant);
    expect(parameters).toContain(actor);
  });
  it('reports a done job with a stored label', async (): Promise<void> => {
    const sql = vi
      .fn()
      .mockResolvedValueOnce([{ total: 1, canManage: true, items: [row] }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          order_id: row.id,
          state: 'done',
          reason: null,
          label_path: tenant + '/x.pdf',
          provider_tracking_number: null,
        },
      ]);
    const repository = new PostgresSellerOrderReadRepository(
      sql as unknown as postgres.Sql<Record<string, unknown>>,
    );
    const result = await repository.findBySeller(actor, tenant, 1);
    expect(result.items[0]?.shipmentJob).toEqual({
      state: 'done',
      reason: null,
      hasLabel: true,
      providerTrackingNumber: null,
    });
    expect(JSON.stringify(result)).not.toContain('x.pdf');
  });
  it('keeps the list available when the job table is not accessible', async (): Promise<void> => {
    const sql = vi
      .fn()
      .mockResolvedValueOnce([{ total: 1, canManage: true, items: [row] }])
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce({ code: '42P01' });
    const repository = new PostgresSellerOrderReadRepository(
      sql as unknown as postgres.Sql<Record<string, unknown>>,
    );
    const result = await repository.findBySeller(actor, tenant, 1);
    expect(result.items[0]?.shipmentJob).toBeNull();
  });
  it('keeps the order list available when shipment storage is not accessible', async (): Promise<void> => {
    const sql = vi
      .fn()
      .mockResolvedValueOnce([{ total: 1, canManage: true, items: [row] }])
      .mockRejectedValueOnce({ code: '42501' })
      .mockResolvedValueOnce([]);
    const repository = new PostgresSellerOrderReadRepository(
      sql as unknown as postgres.Sql<Record<string, unknown>>,
    );
    const result = await repository.findBySeller(actor, tenant, 1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.shipmentAvailability).toBe('unavailable');
    expect(result.items[0]?.canManageShipment).toBe(false);
    expect(result.items[0]?.nextStatus).toBe('processing');
  });
  it('supports a scoped detail link independently of the current list filters', async (): Promise<void> => {
    const sql = vi
      .fn()
      .mockResolvedValue([{ total: 1, items: [{ ...row, status: 'pending_payment' }] }]);
    const repository = new PostgresSellerOrderReadRepository(
      sql as unknown as postgres.Sql<Record<string, unknown>>,
    );
    const result = await repository.findBySeller(actor, tenant, 1, { orderId: row.id });
    expect(result.items[0].nextStatus).toBeNull();
    expect(sql.mock.calls[0]).toContain(row.id);
  });
  it('distinguishes missing manager access from a real empty store and normalizes bad page numbers', async (): Promise<void> => {
    const sql = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total: 0, items: [] }]);
    const repository = new PostgresSellerOrderReadRepository(
      sql as unknown as postgres.Sql<Record<string, unknown>>,
    );
    expect(await repository.findBySeller(actor, tenant, -1)).toMatchObject({
      authorized: false,
      page: 1,
      totalItems: 0,
    });
    expect(await repository.findBySeller(actor, tenant, 1)).toMatchObject({
      authorized: true,
      items: [],
      totalPages: 1,
    });
  });
  it('translates database errors without fabricating an empty queue', async (): Promise<void> => {
    const repository = new PostgresSellerOrderReadRepository(
      vi.fn().mockRejectedValue(new Error('database detail')) as unknown as postgres.Sql<
        Record<string, unknown>
      >,
    );
    await expect(repository.findBySeller(actor, tenant, 1)).rejects.toThrow(
      OrderRepositoryException,
    );
  });
});
