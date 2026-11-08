import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import {
  insertTestCategory,
  withRolledBackTenant,
} from '@/testing/integration/with-rolled-back-tenant';

const DATABASE_URL = process.env.DATABASE_URL;
const CATEGORY_ID = 'c0000000-0000-4000-8000-000000000001';
const PRODUCT_ID = 'd0000000-0000-4000-8000-000000000001';
const MEMBER_ID = 'e0000000-0000-4000-8000-000000000001';
const STRANGER_ID = 'e0000000-0000-4000-8000-000000000002';

interface PublicProductRow {
  id: string;
  price_cents: number;
  wholesale_price_cents: number | null;
  wholesale_min_quantity: number | null;
}

describe.skipIf(!DATABASE_URL)('B2B Wholesale Authorization RPC Matrix', (): void => {
  let sql: postgres.Sql<Record<string, unknown>>;

  beforeAll((): void => {
    sql = postgres(DATABASE_URL as string);
  });

  afterAll(async (): Promise<void> => {
    await sql.end();
  });

  const readAs = (
    tx: postgres.TransactionSql<Record<string, unknown>>,
    role: 'anon' | 'authenticated',
    userId: string | null,
    slug: string,
  ): Promise<PublicProductRow[]> =>
    tx.savepoint(async (inner): Promise<PublicProductRow[]> => {
      await inner.unsafe(`SET LOCAL ROLE ${role}`);
      await inner`SELECT set_config('request.jwt.claims', ${JSON.stringify(
        userId ? { sub: userId, role } : { role },
      )}, true)`;
      try {
        return await inner<PublicProductRow[]>`
          SELECT id, price_cents, wholesale_price_cents, wholesale_min_quantity
          FROM public.get_public_products_by_slug(${slug}::varchar)
        `;
      } finally {
        await inner.unsafe('RESET ROLE');
      }
    });

  it('should expose wholesale rules ONLY to authorized tenant members', async (): Promise<void> => {
    await withRolledBackTenant(sql, async ({ tenantId, sql: tx }): Promise<void> => {
      const [tenant] = await tx<{ slug: string }[]>`
        SELECT slug FROM core.tenants WHERE id = ${tenantId}
      `;
      await insertTestCategory(tx, tenantId, CATEGORY_ID);
      await tx`
        INSERT INTO catalog.products (
          id, name, price_cents, cost_cents, wholesale_price_cents, wholesale_min_quantity,
          description, stock, category_id, status, sku, tenant_id
        ) VALUES (
          ${PRODUCT_ID}, 'Wholesale item', 1000, 400, 800, 10,
          'Wholesale item', 50, ${CATEGORY_ID}, 'active', 'WHOLESALE-1', ${tenantId}
        )
      `;
      await tx`
        INSERT INTO auth.users (id, email)
        VALUES (${MEMBER_ID}, 'member@example.test'), (${STRANGER_ID}, 'stranger@example.test')
      `;
      await tx`
        INSERT INTO core.tenant_memberships (user_id, tenant_id, role, status)
        VALUES (${MEMBER_ID}, ${tenantId}, 'MEMBER', 'active')
      `;

      const anon = await readAs(tx, 'anon', null, tenant.slug);
      const stranger = await readAs(tx, 'authenticated', STRANGER_ID, tenant.slug);
      const member = await readAs(tx, 'authenticated', MEMBER_ID, tenant.slug);

      expect(anon).toHaveLength(1);
      expect(anon[0].price_cents).toBe(1000);
      expect(anon[0].wholesale_price_cents).toBeNull();
      expect(anon[0].wholesale_min_quantity).toBeNull();
      expect(stranger[0].wholesale_price_cents).toBeNull();
      expect(member[0].wholesale_price_cents).toBe(800);
      expect(member[0].wholesale_min_quantity).toBe(10);
    });
  });
});
