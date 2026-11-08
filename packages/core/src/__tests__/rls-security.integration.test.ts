import { Currency } from '@/shared/domain/enums/currency.enum';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import { PostgresTransactionManagerAdapter } from '@/shared/infrastructure/adapters/postgres-transaction-manager.adapter';
import { PostgresProductRepository } from '@/products/infrastructure/repositories/postgres-product.repository';
import { Product } from '@/products/domain/entities/product.entity';
import { ProductName } from '@/products/domain/value-objects/product-name.vo';
import { createProductId } from '@/products/domain/types/product-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { Sku } from '@/products/domain/value-objects/sku.vo';
import { createCategoryId } from '@/products/domain/types/category-id.type';
import { Money } from '@/shared/domain/value-objects/money.vo';
import {
  insertTestCategory,
  savepointSql,
  withRolledBackTenant,
} from '@/testing/integration/with-rolled-back-tenant';

const DATABASE_URL = process.env.DATABASE_URL;
const CATEGORY_ID = 'c0000000-0000-4000-8000-000000000001';
const PRODUCT_ID = '33333333-3333-4333-8333-333333333333';
const MEMBER_ID = 'e0000000-0000-4000-8000-000000000001';
const STRANGER_ID = 'e0000000-0000-4000-8000-000000000002';
const OTHER_TENANT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

describe.skipIf(!DATABASE_URL)('RLS Cross-Tenant Security Integration', (): void => {
  let sql: postgres.Sql<Record<string, unknown>>;

  beforeAll((): void => {
    sql = postgres(DATABASE_URL as string);
  });

  afterAll(async (): Promise<void> => {
    await sql.end();
  });

  const buildProduct = (tenantId: string, name: string, sku: string): Product =>
    Product.create(
      createProductId(PRODUCT_ID),
      ProductName.from(name),
      Money.from(100, Currency.USD),
      Money.from(50, Currency.USD),
      'Desc',
      10,
      createCategoryId(CATEGORY_ID),
      Sku.from(sku),
      createTenantId(tenantId),
      null,
      null,
      [],
      null,
      [],
      false,
      Money.from(0, Currency.USD),
      null,
    );

  it('should DENY Tenant A from updating a product belonging to Tenant B (application tenant scoping; RLS is covered below)', async (): Promise<void> => {
    await withRolledBackTenant(sql, async ({ tenantId, sql: tx }): Promise<void> => {
      const scoped = savepointSql(tx);
      const repository = new PostgresProductRepository(scoped);
      const manager = new PostgresTransactionManagerAdapter(scoped);
      await insertTestCategory(tx, tenantId, CATEGORY_ID);
      await tx`
        INSERT INTO core.tenants (id, name, slug, contact_email, base_currency, status)
        VALUES (${OTHER_TENANT_ID}, 'Tenant A', ${`test-${OTHER_TENANT_ID}`}, 'a@example.test', 'USD', 'active')
      `;
      // Tenant B (the fresh tenant) owns the product.
      await repository.save(buildProduct(tenantId, 'Tenant B Product', 'TEST-B-SKU'));

      await manager.runInTransaction(
        async (context): Promise<void> => {
          const visible = await repository.findById(
            createProductId(PRODUCT_ID),
            createTenantId(OTHER_TENANT_ID),
            context,
          );
          expect(visible).toBeNull();

          // Tenant A guesses the id and tries to overwrite it with its own aggregate.
          await repository.save(buildProduct(OTHER_TENANT_ID, 'Hacked', 'HACK-SKU-1'), context);
        },
        { userId: OTHER_TENANT_ID },
      );

      const stored = await repository.findById(
        createProductId(PRODUCT_ID),
        createTenantId(tenantId),
      );
      expect(stored?.getName()).toBe('Tenant B Product');
    });
  });

  const asAuthenticated = (
    tx: postgres.TransactionSql<Record<string, unknown>>,
    userId: string,
    work: (inner: postgres.TransactionSql<Record<string, unknown>>) => Promise<number>,
  ): Promise<number> =>
    tx.savepoint(async (inner): Promise<number> => {
      await inner.unsafe('SET LOCAL ROLE authenticated');
      await inner`SELECT set_config('request.jwt.claims', ${JSON.stringify({
        sub: userId,
        role: 'authenticated',
      })}, true)`;
      try {
        return await work(inner);
      } finally {
        await inner.unsafe('RESET ROLE');
      }
    });

  it('should apply RLS: members read the product, strangers neither read nor update it', async (): Promise<void> => {
    await withRolledBackTenant(sql, async ({ tenantId, sql: tx }): Promise<void> => {
      await insertTestCategory(tx, tenantId, CATEGORY_ID);
      await new PostgresProductRepository(savepointSql(tx)).save(
        buildProduct(tenantId, 'Tenant B Product', 'TEST-B-SKU'),
      );
      await tx`INSERT INTO auth.users (id, email) VALUES
        (${MEMBER_ID}, 'member@example.test'), (${STRANGER_ID}, 'stranger@example.test')`;
      await tx`INSERT INTO core.tenant_memberships (user_id, tenant_id, role, status)
        VALUES (${MEMBER_ID}, ${tenantId}, 'OWNER', 'active')`;

      const count = async (
        inner: postgres.TransactionSql<Record<string, unknown>>,
      ): Promise<number> => {
        const rows = await inner<{ n: number }[]>`
          SELECT count(*)::int AS n FROM catalog.products WHERE id = ${PRODUCT_ID}`;
        return rows[0].n;
      };

      const asMember = await asAuthenticated(tx, MEMBER_ID, count);
      const asStranger = await asAuthenticated(tx, STRANGER_ID, count);
      const strangerUpdated = await asAuthenticated(tx, STRANGER_ID, async (inner) => {
        const rows = await inner`
          UPDATE catalog.products SET name = 'Hacked' WHERE id = ${PRODUCT_ID} RETURNING id`;
        return rows.length;
      }).catch((): number => 0);
      const [stored] = await tx<{ name: string }[]>`
        SELECT name FROM catalog.products WHERE id = ${PRODUCT_ID}`;

      expect(asMember).toBe(1);
      expect(asStranger).toBe(0);
      expect(strangerUpdated).toBe(0);
      expect(stored.name).toBe('Tenant B Product');
    });
  });
});
