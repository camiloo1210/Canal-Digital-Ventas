import { describe, expect, it } from 'vitest';
import type postgres from 'postgres';
import { PostgresKiviProductLookupReadRepository } from '@/kivi/infrastructure/postgres-kivi-product-lookup-read.repository';
import { KiviProductLookupReadException } from '@/kivi/infrastructure/kivi-product-lookup-read.exception';

const TENANT = '11111111-1111-4111-8111-111111111111';

interface Call {
  text: string;
  values: unknown[];
}

function fakeSql(rows: unknown[] | Error): {
  sql: postgres.Sql<Record<string, unknown>>;
  calls: Call[];
} {
  const calls: Call[] = [];
  const tag = (strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown[]> => {
    calls.push({ text: strings.join('?'), values });
    return rows instanceof Error ? Promise.reject(rows) : Promise.resolve(rows);
  };
  return { sql: tag as unknown as postgres.Sql<Record<string, unknown>>, calls };
}

function row(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: 'Cafe molido',
    sku: 'CAF-001',
    category: 'Bebidas',
    price_cents: 350,
    wholesale_price_cents: 275,
    wholesale_min_quantity: 12,
    stock: 50,
    // Extra internals a careless query might select; they must never be returned.
    id: 'internal-id',
    cost_cents: 100,
    ...overrides,
  };
}

describe('PostgresKiviProductLookupReadRepository', (): void => {
  it('parameterizes tenant and search terms and escapes LIKE wildcards', async (): Promise<void> => {
    const { sql, calls } = fakeSql([]);
    await new PostgresKiviProductLookupReadRepository(sql).findProducts({
      tenantId: TENANT,
      query: ' 50%_off!x ',
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].values).toEqual([
      TENANT,
      '%50!%!_off!!x%',
      '50%_off!x',
      '50!%!_off!!x%',
      '50%_off!x',
      5,
    ]);
    expect(calls[0].text).toContain('p.tenant_id = ?');
    expect(calls[0].text).toContain("p.status IN ('active', 'out_of_stock')");
    expect(calls[0].text).toContain('JOIN catalog.categories');
    expect(calls[0].text).toContain('LIMIT ?');
    expect(calls[0].text).not.toContain('50');
  });

  it('does not query for a blank search', async (): Promise<void> => {
    const { sql, calls } = fakeSql([]);
    await expect(
      new PostgresKiviProductLookupReadRepository(sql).findProducts({
        tenantId: TENANT,
        query: '  ',
      }),
    ).resolves.toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it('maps rows with decimal prices, wholesale and availability, leaking nothing else', async (): Promise<void> => {
    const { sql } = fakeSql([
      row(),
      row({ stock: 20, wholesale_price_cents: 0, wholesale_min_quantity: 0, price_cents: 5 }),
      row({ stock: 1 }),
      row({ stock: 21 }),
      row({ stock: 0 }),
    ]);
    const items = await new PostgresKiviProductLookupReadRepository(sql).findProducts({
      tenantId: TENANT,
      query: 'cafe',
    });
    expect(items[0]).toEqual({
      name: 'Cafe molido',
      sku: 'CAF-001',
      category: 'Bebidas',
      price: '3.50',
      currency: 'USD',
      wholesale_price: '2.75',
      wholesale_min_quantity: 12,
      availability: 'available',
    });
    expect(items[1]).toMatchObject({
      price: '0.05',
      wholesale_price: null,
      wholesale_min_quantity: null,
      availability: 'low_stock',
    });
    expect(items.map((i): string => i.availability)).toEqual([
      'available',
      'low_stock',
      'low_stock',
      'available',
      'out_of_stock',
    ]);
    const serialized = JSON.stringify(items);
    expect(serialized).not.toMatch(/"stock"|cost|internal-id|"id"/);
    for (const item of items) {
      expect(Object.keys(item).sort()).toEqual(
        [
          'availability',
          'category',
          'currency',
          'name',
          'price',
          'sku',
          'wholesale_min_quantity',
          'wholesale_price',
        ].sort(),
      );
    }
  });

  it('wraps database failures without the search text', async (): Promise<void> => {
    const { sql } = fakeSql(new Error('boom secret-query'));
    const error = await new PostgresKiviProductLookupReadRepository(sql)
      .findProducts({ tenantId: TENANT, query: 'secret-query' })
      .catch((e: unknown): unknown => e);
    expect(error).toBeInstanceOf(KiviProductLookupReadException);
    expect((error as Error).message).not.toContain('secret-query');
  });
});
