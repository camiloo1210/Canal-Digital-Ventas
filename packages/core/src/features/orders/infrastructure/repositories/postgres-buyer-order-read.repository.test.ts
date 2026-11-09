import { describe, expect, it, vi } from 'vitest';
import type postgres from 'postgres';
import { PostgresBuyerOrderReadRepository } from '@/orders/infrastructure/repositories/postgres-buyer-order-read.repository';

function mockTransaction(sql: unknown): postgres.Sql<Record<string, unknown>> {
  const target = sql as {
    begin?: (
      options: string,
      callback: (connection: unknown) => Promise<unknown>,
    ) => Promise<unknown>;
    savepoint?: (callback: (connection: unknown) => Promise<unknown>) => Promise<unknown>;
  };
  target.begin ??= async (_options, callback): Promise<unknown> => callback(sql);
  target.savepoint ??= async (callback): Promise<unknown> => callback(sql);
  return sql as postgres.Sql<Record<string, unknown>>;
}
describe('buyer cancellation eligibility', (): void => {
  it.each([
    ['confirmed', 0, null, false, true],
    ['processing', 1, 'pending', false, true],
    ['confirmed', 1, 'expired_unpaid_awaiting_reconciliation', false, true],
    ['processing', 1, 'completed', false, false],
    ['confirmed', 2, 'pending', false, false],
    ['confirmed', 0, null, true, false],
    ['shipped', 0, null, false, false],
  ])(
    'projects %s with %s active payments and status %s',
    async (status, count, paymentStatus, foreignPayment, expected): Promise<void> => {
      const query = vi
        .fn()
        .mockResolvedValue([])
        .mockResolvedValueOnce([
          {
            id: 'order',
            order_number: 'ORD-1',
            tenant_id: 'tenant',
            tenant_name: 'Store',
            tenant_slug: 'store',
            currency: 'USD',
            status,
            total_amount_cents: 100,
            subtotal_cents: 100,
            tax_amount_cents: 0,
            shipping_cost_cents: 0,
            created_at: '2026-11-08T00:00:00Z',
            active_payment_count: count,
            active_payment_status: paymentStatus,
            shipment: { carrier: 'Carrier', trackingNumber: 'ABC' },
            has_foreign_payment: foreignPayment,
          },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ order_id: 'order', carrier: 'Carrier', tracking_number: 'ABC' }]);
      const sql = (first: TemplateStringsArray | string[]): unknown =>
        'raw' in first ? query(first) : first;
      const repository = new PostgresBuyerOrderReadRepository(mockTransaction(sql));
      const orders = await repository.findOrdersByBuyerId('buyer');
      expect(orders[0]?.canCancel).toBe(expected);
      if (status === 'processing') expect(orders[0]?.nextStep).toBe('await_shipment');
      if (status === 'shipped') expect(orders[0]?.nextStep).toBe('await_delivery');
      expect(orders[0]?.paymentStatus).toBe(
        count === 1 && ['pending', 'completed'].includes(paymentStatus ?? '')
          ? paymentStatus
          : 'unavailable',
      );
      expect(orders[0]?.shipment).toEqual({ carrier: 'Carrier', trackingNumber: 'ABC' });
      const statement = (query.mock.calls[0]?.[0] as TemplateStringsArray).join('?');
      expect(statement).not.toContain('JOIN sales.manual_shipments');
      expect(statement).toContain('p.order_id = o.id');
      expect(statement).toContain('p.tenant_id = o.tenant_id');
      expect(statement).toContain("p.status <> 'failed'");
      expect(statement).toContain('p.tenant_id <> o.tenant_id');
    },
  );
  it('attaches observations only to their matching authorized orders', async (): Promise<void> => {
    const base = {
      tenant_id: 'tenant',
      tenant_name: 'Store',
      tenant_slug: 'store',
      currency: 'USD',
      status: 'confirmed',
      total_amount_cents: 100,
      subtotal_cents: 100,
      tax_amount_cents: 0,
      shipping_cost_cents: 0,
      created_at: '2026-11-08T00:00:00Z',
      active_payment_count: 0,
      active_payment_status: null,
      has_foreign_payment: false,
    };
    const query = vi
      .fn()
      .mockResolvedValue([])
      .mockResolvedValueOnce([
        { ...base, id: 'one', order_number: '1' },
        { ...base, id: 'two', order_number: '2' },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          order_id: 'one',
          from_status: null,
          to_status: 'confirmed',
          changed_at: '2026-11-08T01:00:00Z',
        },
        {
          order_id: 'two',
          from_status: 'confirmed',
          to_status: 'cancelled',
          changed_at: '2026-11-08T02:00:00Z',
        },
        {
          order_id: 'one',
          from_status: 'paid',
          to_status: 'processing',
          changed_at: '2026-11-08T03:00:00Z',
        },
        { order_id: 'other', to_status: 'paid', changed_at: '2026-11-08T04:00:00Z' },
      ]);
    const sql = (first: TemplateStringsArray | string[], ...values: unknown[]): unknown =>
      'raw' in first ? query(first, ...values) : first;
    const repository = new PostgresBuyerOrderReadRepository(mockTransaction(sql));
    const orders = await repository.findOrdersByBuyerId('buyer');
    expect(orders[0]).toMatchObject({
      history: [
        { status: 'confirmed', changedAt: null },
        { status: 'processing', changedAt: '2026-11-08T03:00:00.000Z' },
      ],
    });
    expect(orders[1]).toMatchObject({
      history: [{ status: 'cancelled', changedAt: '2026-11-08T02:00:00.000Z' }],
    });
    const [parts, ...values] = query.mock.calls[2] as [TemplateStringsArray, ...unknown[]];
    const statement = parts.join('?');
    expect(statement).toContain('c.global_auth_id = ?');
    expect(statement).toContain('c.tenant_id = o.tenant_id');
    expect(statement).toContain('h.tenant_id = o.tenant_id');
    expect(statement).toContain('ORDER BY h.changed_at, h.id');
    expect(values).toContain('buyer');
  });

  it('scopes a single order read to its buyer and identifier', async (): Promise<void> => {
    const sql = vi.fn().mockResolvedValue([]);
    const repository = new PostgresBuyerOrderReadRepository(mockTransaction(sql));
    expect(
      await repository.findOrderByBuyerId('buyer', '550e8400-e29b-41d4-a716-446655440000'),
    ).toBeNull();
    const [parts, ...values] = sql.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
    expect(parts.join('?')).toContain('o.id = ?::uuid');
    expect(values).toContain('buyer');
    expect(values).toContain('550e8400-e29b-41d4-a716-446655440000');
  });
  it('reads the purchase projection from one repeatable snapshot', async (): Promise<void> => {
    const sql = vi.fn().mockResolvedValue([]);
    const begin = vi.fn(
      async (
        _options: string,
        callback: (connection: unknown) => Promise<unknown>,
      ): Promise<unknown> => callback(sql),
    );
    Object.assign(sql, { begin });
    const repository = new PostgresBuyerOrderReadRepository(mockTransaction(sql));
    expect(await repository.findOrdersByBuyerId('buyer')).toEqual([]);
    expect(begin).toHaveBeenCalledWith(
      'isolation level repeatable read read only',
      expect.any(Function),
    );
  });
  it('returns no order for a malformed identifier without querying PostgreSQL', async (): Promise<void> => {
    const sql = vi.fn();
    const repository = new PostgresBuyerOrderReadRepository(mockTransaction(sql));
    expect(await repository.findOrderByBuyerId('buyer', 'invalid')).toBeNull();
    expect(sql).not.toHaveBeenCalled();
  });
  it('preserves purchases when shipment storage is unavailable', async (): Promise<void> => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([
        {
          id: 'one',
          order_number: '1',
          tenant_id: 'tenant',
          tenant_name: 'Store',
          tenant_slug: 'store',
          currency: 'USD',
          status: 'confirmed',
          total_amount_cents: 100,
          subtotal_cents: 100,
          tax_amount_cents: 0,
          shipping_cost_cents: 0,
          created_at: '2026-11-08T00:00:00Z',
          active_payment_count: 0,
          active_payment_status: null,
          has_foreign_payment: false,
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce({ code: '42P01' });
    const sql = (first: TemplateStringsArray | string[]): unknown =>
      'raw' in first ? query(first) : first;
    const repository = new PostgresBuyerOrderReadRepository(mockTransaction(sql));
    const order = (await repository.findOrdersByBuyerId('buyer'))[0];
    expect(order?.shipment).toBeNull();
    expect(order?.shipmentAvailability).toBe('unavailable');
  });
  it('preserves purchases when history storage is not accessible', async (): Promise<void> => {
    const query = vi
      .fn()
      .mockResolvedValue([])
      .mockResolvedValueOnce([
        {
          id: 'one',
          order_number: '1',
          tenant_id: 'tenant',
          tenant_name: 'Store',
          tenant_slug: 'store',
          currency: 'USD',
          status: 'confirmed',
          total_amount_cents: 100,
          subtotal_cents: 100,
          tax_amount_cents: 0,
          shipping_cost_cents: 0,
          created_at: '2026-11-08T00:00:00Z',
          active_payment_count: 0,
          active_payment_status: null,
          has_foreign_payment: false,
        },
      ])
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce({ code: '42501' });
    const sql = (first: TemplateStringsArray | string[]): unknown =>
      'raw' in first ? query(first) : first;
    const repository = new PostgresBuyerOrderReadRepository(mockTransaction(sql));
    expect((await repository.findOrdersByBuyerId('buyer'))[0]?.history).toBeNull();
  });
});
