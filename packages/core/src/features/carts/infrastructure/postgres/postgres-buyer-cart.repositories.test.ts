import { describe, expect, it } from 'vitest';
import type postgres from 'postgres';
import { PostgresBuyerCartRepository } from '@/carts/infrastructure/postgres/postgres-buyer-cart.repository';
import { PostgresBuyerCartCatalogReadRepository } from '@/carts/infrastructure/postgres/postgres-buyer-cart-catalog-read.repository';
import { BuyerCartWriteConflictException } from '@/carts/application/exceptions/buyer-cart-write-conflict.exception';
import { BuyerCartRepositoryException } from '@/carts/application/exceptions/buyer-cart-repository.exception';
import type { TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';

const TENANT = '11111111-1111-4111-8111-111111111111';
const USER = '22222222-2222-4222-8222-222222222222';
const PRODUCT = '33333333-3333-4333-8333-333333333333';
const NOW = new Date('2026-11-03T12:00:00.000Z');

interface Call {
  text: string;
  values: unknown[];
}

function fakeSql(results: unknown[][]): {
  sql: postgres.Sql<Record<string, unknown>>;
  tx: TransactionContext;
  calls: Call[];
} {
  const calls: Call[] = [];
  const queue = [...results];
  const tag = (strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown[]> => {
    calls.push({ text: strings.join('?'), values });
    return Promise.resolve(queue.shift() ?? []);
  };
  const tx: TransactionContext = {
    executeNative: async <TConnection, TResult>(
      callback: (conn: TConnection) => Promise<TResult>,
    ): Promise<TResult> => callback(tag as unknown as TConnection),
  };
  return { sql: tag as unknown as postgres.Sql<Record<string, unknown>>, tx, calls };
}

const line = {
  productId: PRODUCT,
  name: 'Name',
  sku: 'SKU',
  unitPriceCents: 1500,
  quantity: 2,
};

describe('PostgresBuyerCartRepository', (): void => {
  it('reads the cart and lines scoped by tenant and buyer, locking inside a transaction', async (): Promise<void> => {
    const { sql, tx, calls } = fakeSql([
      [{ id: 'c1', version: 3, updated_at: NOW, expires_at: NOW }],
      [
        {
          product_id: PRODUCT,
          product_name: 'Name',
          sku: 'SKU',
          unit_price_cents: 1500,
          quantity: 2,
        },
      ],
    ]);
    const record = await new PostgresBuyerCartRepository(sql).findActive(
      { tenantId: TENANT, buyerUserId: USER },
      tx,
    );
    expect(record?.lines).toEqual([line]);
    expect(record?.version).toBe(3);
    for (const call of calls) {
      expect(call.values).toContain(TENANT);
      expect(call.values).toContain(USER);
      expect(call.text).toContain('tenant_id =');
    }
    expect(calls[0].text).toContain('FOR UPDATE');
  });

  it('does not lock without a transaction and returns null when absent', async (): Promise<void> => {
    const { sql, calls } = fakeSql([[]]);
    const record = await new PostgresBuyerCartRepository(sql).findActive({
      tenantId: TENANT,
      buyerUserId: USER,
    });
    expect(record).toBeNull();
    expect(calls).toHaveLength(1);
    expect(calls[0].text).not.toContain('FOR UPDATE');
  });

  it('creates with ON CONFLICT DO NOTHING and scopes the item insert to the tenant', async (): Promise<void> => {
    const { sql, tx, calls } = fakeSql([[{ id: 'new' }], []]);
    const version = await new PostgresBuyerCartRepository(sql).save(
      {
        tenantId: TENANT,
        buyerUserId: USER,
        existingCartId: null,
        expectedVersion: 0,
        lines: [line],
        now: NOW,
        expiresAt: NOW,
      },
      tx,
    );
    expect(version).toBe(1);
    expect(calls[0].text).toContain('ON CONFLICT');
    expect(calls[0].text).toContain('subtotal_cents, currency, expires_at');
    expect(calls[0].text).toContain('t.base_currency');
    expect(calls[0].text).toContain('FROM core.tenants t');
    expect(calls[0].text).toContain("t.status = 'active'");
    expect(calls[0].values).toContain(TENANT);
    expect(calls[0].values).toContain(3000);
    expect(calls[1].values).toContain(TENANT);
    expect(calls[1].text).toContain('p.tenant_id =');
    expect(calls[1].values).toContainEqual([PRODUCT]);
    expect(calls[1].values).toContainEqual(['3000']);
  });

  it('throws a write conflict when the create loses the race or the version moved', async (): Promise<void> => {
    const repo = (
      results: unknown[][],
    ): { repo: PostgresBuyerCartRepository; tx: TransactionContext } => {
      const { sql, tx } = fakeSql(results);
      return { repo: new PostgresBuyerCartRepository(sql), tx };
    };
    const base = {
      tenantId: TENANT,
      buyerUserId: USER,
      expectedVersion: 4,
      lines: [line],
      now: NOW,
      expiresAt: NOW,
    };
    const created = repo([[]]);
    await expect(
      created.repo.save({ ...base, existingCartId: null }, created.tx),
    ).rejects.toBeInstanceOf(BuyerCartWriteConflictException);
    const updated = repo([[]]);
    await expect(
      updated.repo.save({ ...base, existingCartId: 'c1' }, updated.tx),
    ).rejects.toBeInstanceOf(BuyerCartWriteConflictException);
  });

  it('updates under a version check, replaces lines and scopes every statement', async (): Promise<void> => {
    const { sql, tx, calls } = fakeSql([[{ version: 5 }], [], []]);
    const version = await new PostgresBuyerCartRepository(sql).save(
      {
        tenantId: TENANT,
        buyerUserId: USER,
        existingCartId: 'c1',
        expectedVersion: 4,
        lines: [line],
        now: NOW,
        expiresAt: NOW,
      },
      tx,
    );
    expect(version).toBe(5);
    expect(calls).toHaveLength(3);
    expect(calls[0].text).toContain('version = ');
    expect(calls[0].values).toContain(4);
    for (const call of calls) expect(call.values).toContain(TENANT);
    expect(calls[1].text).toContain('DELETE FROM sales.cart_items');
  });

  it('scopes touch and markConverted by tenant and buyer', async (): Promise<void> => {
    const { sql, tx, calls } = fakeSql([[], []]);
    const repo = new PostgresBuyerCartRepository(sql);
    await repo.touch(
      { tenantId: TENANT, buyerUserId: USER, cartId: 'c1', now: NOW, expiresAt: NOW },
      tx,
    );
    await repo.markConverted({ tenantId: TENANT, buyerUserId: USER, now: NOW }, tx);
    for (const call of calls) {
      expect(call.values).toContain(TENANT);
      expect(call.values).toContain(USER);
    }
    expect(calls[1].text).toContain("status = 'converted'");
  });

  it('translates driver failures without leaking them', async (): Promise<void> => {
    const failing = ((): Promise<never> =>
      Promise.reject(new Error('password=secret'))) as unknown as postgres.Sql<
      Record<string, unknown>
    >;
    const error = await new PostgresBuyerCartRepository(failing)
      .findActive({ tenantId: TENANT, buyerUserId: USER })
      .catch((e: unknown): unknown => e);
    expect(error).toBeInstanceOf(BuyerCartRepositoryException);
    expect((error as Error).message).not.toContain('secret');
  });
});

describe('PostgresBuyerCartCatalogReadRepository', (): void => {
  it('resolves only active stores by slug with a bound parameter', async (): Promise<void> => {
    const { sql, calls } = fakeSql([[{ id: TENANT }]]);
    await expect(
      new PostgresBuyerCartCatalogReadRepository(sql).findActiveTenantIdBySlug('tienda'),
    ).resolves.toBe(TENANT);
    expect(calls[0].values).toEqual(['tienda']);
    expect(calls[0].text).toContain("status = 'active'");
  });

  it('scopes products by tenant, filters invalid ids and maps stock and first image', async (): Promise<void> => {
    const { sql, calls } = fakeSql([
      [
        {
          id: PRODUCT,
          name: 'N',
          sku: 'S',
          price_cents: 250,
          currency: 'COP',
          wholesale_price_cents: 200,
          wholesale_min_quantity: 3,
          stock: -3,
          image_url: 'cover.jpg',
          gallery_urls: ['g1.jpg', 'g2.jpg'],
        },
      ],
    ]);
    const repo = new PostgresBuyerCartCatalogReadRepository(sql);
    const products = await repo.findProducts(TENANT, [PRODUCT, "x'; DROP TABLE a;--"]);
    expect(products).toEqual([
      {
        productId: PRODUCT,
        name: 'N',
        sku: 'S',
        unitPriceCents: 250,
        currency: 'COP',
        wholesalePriceCents: 200,
        wholesaleMinQuantity: 3,
        availableQuantity: 0,
        imageUrl: 'g1.jpg',
      },
    ]);
    expect(calls[0].values).toContain(TENANT);
    expect(calls[0].values).toContainEqual([PRODUCT]);
    expect(calls[0].text).toContain('p.tenant_id =');
    expect(calls[0].text).toContain("p.status = 'active'");
  });

  it('skips the query when no id is valid', async (): Promise<void> => {
    const { sql, calls } = fakeSql([]);
    await expect(
      new PostgresBuyerCartCatalogReadRepository(sql).findProducts(TENANT, ['nope']),
    ).resolves.toEqual([]);
    expect(calls).toHaveLength(0);
  });
});
