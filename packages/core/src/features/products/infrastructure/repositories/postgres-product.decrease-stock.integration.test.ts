import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import postgres from 'postgres';
import { PostgresProductRepository } from '@/products/infrastructure/repositories/postgres-product.repository';
import { ProductOutOfStockException } from '@/products/application/exceptions/product-out-of-stock.exception';
import { createProductId } from '@/products/domain/types/product-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import {
  insertTestCategory,
  toTransactionContext,
  withRolledBackTenant,
  type RolledBackTenantContext,
} from '@/testing/integration/with-rolled-back-tenant';

const DATABASE_URL = process.env.DATABASE_URL;
const CATEGORY_ID = 'c0000000-0000-4000-8000-000000000001';
const PRODUCT_ID = 'd0000000-0000-4000-8000-000000000001';

interface StockRow {
  stock: number;
  status: string;
}

describe.skipIf(!DATABASE_URL)('PostgresProductRepository.decreaseStock (SQL)', (): void => {
  let sql: postgres.Sql<Record<string, unknown>>;

  beforeAll((): void => {
    sql = postgres(DATABASE_URL as string);
  });

  afterAll(async (): Promise<void> => {
    await sql.end();
  });

  const seedProduct = async (
    { tenantId, sql: tx }: RolledBackTenantContext,
    stock: number,
  ): Promise<void> => {
    await insertTestCategory(tx, tenantId, CATEGORY_ID);
    await tx`
      INSERT INTO catalog.products (
        id, name, price_cents, cost_cents, wholesale_price_cents, wholesale_min_quantity,
        description, stock, category_id, status, sku, tenant_id
      ) VALUES (
        ${PRODUCT_ID}, 'Stock item', 1000, 400, 0, 0,
        'Stock item', ${stock}, ${CATEGORY_ID}, 'active', 'STOCK-ITEM-1', ${tenantId}
      )
    `;
  };

  const readRow = async ({ sql: tx }: RolledBackTenantContext): Promise<StockRow> => {
    const rows = await tx<StockRow[]>`
      SELECT stock, status FROM catalog.products WHERE id = ${PRODUCT_ID}
    `;
    return rows[0];
  };

  it('decrements the stock by the requested quantity', async (): Promise<void> => {
    await withRolledBackTenant(sql, async (ctx): Promise<void> => {
      await seedProduct(ctx, 5);
      const repository = new PostgresProductRepository(sql);

      await repository.decreaseStock(
        createProductId(PRODUCT_ID),
        createTenantId(ctx.tenantId),
        2,
        toTransactionContext(ctx.sql),
      );

      expect((await readRow(ctx)).stock).toBe(3);
    });
  });

  // FINDING: decreaseStock never repairs the status: selling the last units leaves the product
  // 'active' with stock 0, whereas Product.adjustStock moves it to 'out_of_stock' and
  // changeStatus(ACTIVE) refuses stock 0. An out-of-stock product must be unsellable.
  it.fails(
    'moves the product to out_of_stock when the stock reaches zero',
    async (): Promise<void> => {
      await withRolledBackTenant(sql, async (ctx): Promise<void> => {
        await seedProduct(ctx, 2);
        const repository = new PostgresProductRepository(sql);

        await repository.decreaseStock(
          createProductId(PRODUCT_ID),
          createTenantId(ctx.tenantId),
          2,
          toTransactionContext(ctx.sql),
        );

        const row = await readRow(ctx);
        expect(row.stock).toBe(0);
        expect(row.status).toBe('out_of_stock');
      });
    },
  );

  it('raises ProductOutOfStockException and leaves the stock unchanged when decreasing more than available', async (): Promise<void> => {
    await withRolledBackTenant(sql, async (ctx): Promise<void> => {
      await seedProduct(ctx, 2);
      const repository = new PostgresProductRepository(sql);

      await expect(
        repository.decreaseStock(
          createProductId(PRODUCT_ID),
          createTenantId(ctx.tenantId),
          3,
          toTransactionContext(ctx.sql),
        ),
      ).rejects.toBeInstanceOf(ProductOutOfStockException);

      expect((await readRow(ctx)).stock).toBe(2);
    });
  });

  // Rows written inside a rolled-back transaction are invisible to other connections, so both
  // calls share the transaction connection. The guard is a single conditional UPDATE, so
  // exactly one of the two calls may take the last unit.
  it('lets exactly one of two simultaneous decreases of the last unit succeed', async (): Promise<void> => {
    await withRolledBackTenant(sql, async (ctx): Promise<void> => {
      await seedProduct(ctx, 1);
      const repository = new PostgresProductRepository(sql);
      const decrease = (): Promise<void> =>
        repository.decreaseStock(
          createProductId(PRODUCT_ID),
          createTenantId(ctx.tenantId),
          1,
          toTransactionContext(ctx.sql),
        );

      const outcomes = await Promise.allSettled([decrease(), decrease()]);

      expect(outcomes.filter((o): boolean => o.status === 'fulfilled')).toHaveLength(1);
      const rejected = outcomes.filter((o): o is PromiseRejectedResult => o.status === 'rejected');
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason).toBeInstanceOf(ProductOutOfStockException);
      expect((await readRow(ctx)).stock).toBe(0);
    });
  });
});
