import postgres from 'postgres';
import { readFileSync } from 'node:fs';
import { rootCertificates } from 'node:tls';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresAdminCatalogReadAdapter } from '@/dashboard/infrastructure/postgres-admin-catalog-read.adapter';
import { ApplicationException } from '@/shared/application/exceptions/application.exception';
import { PostgresSellerOrderReadRepository } from '@/orders/infrastructure/repositories/postgres-seller-order-read.repository';

const databaseUrl = process.env.ADMIN_CATALOG_TEST_DATABASE_URL;
class CatalogProbeRollback extends ApplicationException {}

describe.skipIf(!databaseUrl)('Admin catalog PostgreSQL (all fixtures rolled back)', (): void => {
  let sql: postgres.Sql<Record<string, unknown>>;
  beforeAll((): void => {
    const url = new URL(databaseUrl!);
    const remote = !['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname);
    url.searchParams.delete('sslmode');
    url.searchParams.delete('ssl');
    sql = postgres(url.href, {
      max: 1,
      prepare: false,
      connect_timeout: 10,
      ssl: remote
        ? {
            rejectUnauthorized: true,
            ca: [
              ...rootCertificates,
              readFileSync(resolve('apps/worker/certificates/supabase-prod-ca-2021.crt'), 'utf8'),
            ],
          }
        : false,
    });
  });
  afterAll(async (): Promise<void> => {
    if (sql) await sql.end({ timeout: 5 });
  });

  it('reaches record 51 in both catalogs, searches outside page one, isolates tenants and rolls back fixtures', async (): Promise<void> => {
    const prefix = 'catalog-probe-' + crypto.randomUUID();
    const rollback = new CatalogProbeRollback('Rollback catalog verification fixtures');
    await expect(
      sql.begin(async (tx): Promise<void> => {
        await tx`SET LOCAL statement_timeout='15s'`;
        const [manager] = await tx<
          { user_id: string; tenant_id: string }[]
        >`SELECT user_id,tenant_id FROM core.tenant_memberships WHERE status='active' AND role IN ('OWNER','ADMIN') LIMIT 1`;
        expect(
          manager,
          'This opt-in probe requires an existing active store manager',
        ).toBeDefined();
        // Test fixtures remain invisible to other connections and are never committed.
        await tx`INSERT INTO catalog.categories (id,name,slug,description,status,tenant_id,created_at)
        SELECT gen_random_uuid(),${prefix} || '-category-' || n,${prefix} || '-' || n,'Rollback-only fixture','active',${manager.tenant_id}::uuid,
          '2026-01-01'::timestamptz + (52-n)*interval '1 second' FROM generate_series(1,51) n`;
        const [category] = await tx<
          { id: string }[]
        >`SELECT id FROM catalog.categories WHERE tenant_id=${manager.tenant_id}::uuid AND name=${prefix + '-category-1'}`;
        await tx`INSERT INTO catalog.products (id,name,sku,description,price_cents,cost_cents,wholesale_price_cents,stock,category_id,tenant_id,status,created_at)
        SELECT gen_random_uuid(),${prefix} || '-product-' || n,${prefix} || '-sku-' || n,'Rollback-only fixture',12345,100,0,10,${category.id}::uuid,${manager.tenant_id}::uuid,
          CASE WHEN n=51 THEN 'archived' ELSE 'active' END,
          '2026-01-01'::timestamptz + (52-n)*interval '1 second' FROM generate_series(1,51) n`;
        const reader = new PostgresAdminCatalogReadAdapter(
          tx as unknown as postgres.Sql<Record<string, unknown>>,
        );
        const query = { q: prefix, status: 'all', page: 3, limit: 25 } as const;
        const products = await reader.findProductsForManager(
          manager.user_id,
          manager.tenant_id,
          query,
        );
        expect(products).toMatchObject({ totalItems: 51, totalPages: 3, currentPage: 3 });
        expect(products?.items).toHaveLength(1);
        expect(products?.items[0]).toMatchObject({
          name: prefix + '-product-51',
          priceCents: 12345,
          status: 'archived',
        });
        const categories = await reader.findCategoriesForManager(
          manager.user_id,
          manager.tenant_id,
          query,
        );
        expect(categories).toMatchObject({ totalItems: 51, totalPages: 3, currentPage: 3 });
        expect(categories?.items[0].name).toBe(prefix + '-category-51');
        const bySku = await reader.findProductsForManager(manager.user_id, manager.tenant_id, {
          ...query,
          q: prefix + '-sku-51',
          page: 1,
        });
        expect(bySku?.items[0].name).toBe(prefix + '-product-51');
        const archived = await reader.findProductsForManager(manager.user_id, manager.tenant_id, {
          ...query,
          status: 'archived',
          page: 1,
        });
        expect(archived?.totalItems).toBe(1);
        const associations = await reader.findCategoriesForManager(
          manager.user_id,
          manager.tenant_id,
          { ...query, q: prefix + '-category-1', page: 1 },
        );
        expect(
          associations?.items.find((item): boolean => item.name === prefix + '-category-1')
            ?.productCount,
        ).toBe(51);
        expect(
          await reader.findProductsForManager(crypto.randomUUID(), manager.tenant_id, query),
        ).toBeNull();
        expect(
          await reader.findCategoriesForManager(manager.user_id, crypto.randomUUID(), query),
        ).toBeNull();
        const literal = await reader.findProductsForManager(manager.user_id, manager.tenant_id, {
          ...query,
          q: prefix + '%',
          page: 1,
        });
        expect(literal?.totalItems).toBe(0);
        const form = await reader.findProductFormContextForManager(
          manager.user_id,
          manager.tenant_id,
        );
        expect(
          form?.categories.filter((item): boolean => item.name.startsWith(prefix)),
        ).toHaveLength(51);
        expect(form?.currency).toMatch(/^[A-Z]{3}$/);
        await tx`UPDATE catalog.categories SET status='archived' WHERE id=${category.id}::uuid`;
        const createForm = await reader.findProductFormContextForManager(
          manager.user_id,
          manager.tenant_id,
        );
        expect(createForm?.categories.some((item): boolean => item.id === category.id)).toBe(false);
        const editForm = await reader.findProductFormContextForManager(
          manager.user_id,
          manager.tenant_id,
          category.id,
        );
        expect(editForm?.categories.some((item): boolean => item.id === category.id)).toBe(true);
        expect(
          await reader.findProductFormContextForManager(crypto.randomUUID(), manager.tenant_id),
        ).toBeNull();
        const orderReader = new PostgresSellerOrderReadRepository(
          tx as unknown as postgres.Sql<Record<string, unknown>>,
        );
        const orderPage = await orderReader.findBySeller(manager.user_id, manager.tenant_id, 1);
        expect(orderPage.authorized).toBe(true);
        expect(orderPage.items.length).toBeLessThanOrEqual(25);
        const noOrders = await orderReader.findBySeller(manager.user_id, manager.tenant_id, 1, {
          query: prefix,
        });
        expect(noOrders).toMatchObject({ authorized: true, totalItems: 0, items: [] });
        const unauthorized = await orderReader.findBySeller(
          crypto.randomUUID(),
          manager.tenant_id,
          1,
        );
        expect(unauthorized).toMatchObject({ authorized: false, totalItems: 0, items: [] });
        throw rollback;
      }),
    ).rejects.toBe(rollback);
    const [remaining] = await sql<
      { total: number }[]
    >`SELECT count(*)::int AS total FROM catalog.categories WHERE name LIKE ${prefix + '%'}`;
    expect(remaining.total).toBe(0);
  }, 30000);
});
