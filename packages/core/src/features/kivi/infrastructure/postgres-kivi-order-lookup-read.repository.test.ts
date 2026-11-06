import { describe, expect, it, vi } from 'vitest';
import type postgres from 'postgres';
import { PostgresKiviOrderLookupReadRepository } from '@/kivi/infrastructure/postgres-kivi-order-lookup-read.repository';
import { KiviOrderLookupReadException } from '@/kivi/infrastructure/kivi-order-lookup-read.exception';

const TENANT = '11111111-1111-4111-8111-111111111111';
const ORDER_ID = '33333333-3333-4333-8333-333333333333';

interface Call {
  text: string;
  values: unknown[];
}

function fakeSql(results: unknown[][]): {
  sql: postgres.Sql<Record<string, unknown>>;
  calls: Call[];
} {
  const calls: Call[] = [];
  const queue = [...results];
  const tag = (strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown[]> => {
    calls.push({ text: strings.join('?'), values });
    return Promise.resolve(queue.shift() ?? []);
  };
  return { sql: tag as unknown as postgres.Sql<Record<string, unknown>>, calls };
}

describe('PostgresKiviOrderLookupReadRepository', (): void => {
  it('returns empty without querying orders when the store has no active connection', async (): Promise<void> => {
    const { sql, calls } = fakeSql([[]]);
    const repo = new PostgresKiviOrderLookupReadRepository(sql);
    await expect(
      repo.findLatestOrders({ tenantId: TENANT, phone: '573001112233', orderNumber: null }),
    ).resolves.toEqual([]);
    expect(calls).toHaveLength(1);
  });

  it('parameterizes every input and maps rows with their contents', async (): Promise<void> => {
    const { sql, calls } = fakeSql([
      [{ tenant_id: TENANT }],
      [
        {
          id: ORDER_ID,
          order_number: 'ORD-1',
          status: 'shipped',
          updated_at: new Date('2026-10-01T10:00:00Z'),
          created_at: new Date('2026-09-30T08:00:00Z'),
          total_amount_cents: 3650,
          currency: 'USD',
        },
      ],
      [
        {
          order_id: ORDER_ID,
          product_name: 'Test 3',
          quantity: 2,
          unit_price_cents: 1200,
          image_url: 'https://cdn.example.test/a.jpg',
        },
        {
          order_id: ORDER_ID,
          product_name: 'mixwell',
          quantity: 1,
          unit_price_cents: 1250,
          image_url: null,
        },
        {
          order_id: 'other-order',
          product_name: 'not mine',
          quantity: 1,
          unit_price_cents: 100,
          image_url: null,
        },
      ],
    ]);
    const repo = new PostgresKiviOrderLookupReadRepository(sql);
    const result = await repo.findLatestOrders({
      tenantId: TENANT,
      phone: '573001112233',
      orderNumber: ' #Ord-1 ',
    });
    expect(result).toEqual([
      {
        orderNumber: 'ORD-1',
        status: 'shipped',
        updatedAt: '2026-10-01T10:00:00.000Z',
        createdAt: '2026-09-30T08:00:00.000Z',
        currency: 'USD',
        total: '36.50',
        items: [
          {
            name: 'Test 3',
            quantity: 2,
            unitPrice: '12.00',
            imageUrl: 'https://cdn.example.test/a.jpg',
          },
          { name: 'mixwell', quantity: 1, unitPrice: '12.50', imageUrl: null },
        ],
      },
    ]);
    expect(calls[0].values).toEqual([TENANT]);
    expect(calls[0].text).toContain('k.tenant_id =');
    expect(calls[1].values).toContain(TENANT);
    expect(calls[1].values).toContain('573001112233');
    expect(calls[1].values).toContain('ord1');
    expect(calls[1].text).not.toContain('573001112233');
    expect(calls[1].text).toContain("o.status <> 'draft'");
    expect(calls[1].text).toContain('LIMIT 5');
    expect(calls[2].values).toContainEqual([ORDER_ID]);
    // Nothing about who bought it or where it goes is ever selected.
    const selected = [calls[1], calls[2]]
      .map((call): string => call.text.split('FROM')[0])
      .join(' ');
    expect(selected).not.toMatch(/phone|email|shipping_address|payment|customer/i);
  });

  it('shares only plain public https photos', async (): Promise<void> => {
    const row = {
      id: ORDER_ID,
      order_number: 'ORD-K7M3-9QXD-4TWB',
      status: 'paid',
      updated_at: '2026-10-01T10:00:00Z',
      created_at: '2026-10-01T09:00:00Z',
      total_amount_cents: 100,
      currency: 'USD',
    };
    const bad = [
      'http://cdn.example.test/a.jpg',
      'javascript:alert(1)',
      'https://cdn.example.test/a b.jpg',
      `https://cdn.example.test/${'a'.repeat(2100)}`,
    ];
    const { sql } = fakeSql([
      [{ tenant_id: TENANT }],
      [row],
      bad.map((image_url): Record<string, unknown> => ({
        order_id: ORDER_ID,
        product_name: 'p',
        quantity: 1,
        unit_price_cents: 100,
        image_url,
      })),
    ]);
    const repo = new PostgresKiviOrderLookupReadRepository(sql);
    const [order] = await repo.findLatestOrders({
      tenantId: TENANT,
      phone: null,
      orderNumber: row.order_number,
    });
    expect(order.items.map((line): string | null => line.imageUrl)).toEqual([
      null,
      null,
      null,
      null,
    ]);
  });

  it('looks an order up by an unguessable reference alone, ignoring separators and case', async (): Promise<void> => {
    const { sql, calls } = fakeSql([
      [{ tenant_id: TENANT }],
      [
        {
          id: ORDER_ID,
          order_number: 'ORD-K7M3-9QXD-4TWB',
          status: 'paid',
          updated_at: '2026-10-01T10:00:00Z',
          created_at: '2026-10-01T09:00:00Z',
          total_amount_cents: 100,
          currency: 'USD',
        },
      ],
    ]);
    const repo = new PostgresKiviOrderLookupReadRepository(sql);
    const result = await repo.findLatestOrders({
      tenantId: TENANT,
      phone: null,
      orderNumber: '#ord k7m3-9qxd 4twb',
    });
    expect(result).toHaveLength(1);
    expect(calls[1].values).toContain('ordk7m39qxd4twb');
    expect(calls[1].values).toContain(null);
  });

  it('never answers an anonymous lookup for a guessable or missing reference', async (): Promise<void> => {
    for (const orderNumber of ['ORD-268738', null, '1', 'ORD-K7M3-9QXD']) {
      const { sql, calls } = fakeSql([[{ tenant_id: TENANT }], [{ order_number: 'ORD-268738' }]]);
      const repo = new PostgresKiviOrderLookupReadRepository(sql);
      await expect(
        repo.findLatestOrders({ tenantId: TENANT, phone: null, orderNumber }),
      ).resolves.toEqual([]);
      expect(calls).toHaveLength(1); // only the connection check, never the orders table
    }
  });

  it('translates driver failures without leaking them', async (): Promise<void> => {
    const sql = vi.fn().mockRejectedValue(new Error('boom 573001112233'));
    const repo = new PostgresKiviOrderLookupReadRepository(
      sql as unknown as postgres.Sql<Record<string, unknown>>,
    );
    const failure = repo.findLatestOrders({
      tenantId: TENANT,
      phone: '573001112233',
      orderNumber: null,
    });
    await expect(failure).rejects.toBeInstanceOf(KiviOrderLookupReadException);
    await expect(failure).rejects.toHaveProperty('message', 'Kivi order lookup read failed');
  });
});
