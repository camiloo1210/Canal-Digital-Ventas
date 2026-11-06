import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresDashboardOverviewReadAdapter } from '@/dashboard/infrastructure/postgres-dashboard-overview-read.adapter';
import { PostgresBusinessIntelligenceReadAdapter } from '@/dashboard/infrastructure/postgres-business-intelligence-read.adapter';

const databaseUrl = process.env.SECURITY_TEST_DATABASE_URL;
const OWNER = '10000000-0000-4000-8000-000000000001';
const MEMBER = '10000000-0000-4000-8000-000000000002';
const OTHER = '10000000-0000-4000-8000-000000000003';
const TENANT = '20000000-0000-4000-8000-000000000001';
const TENANT_B = '20000000-0000-4000-8000-000000000002';
const CUSTOMER = '30000000-0000-4000-8000-000000000001';
const CATEGORY = '40000000-0000-4000-8000-000000000001';
const PRODUCT = '50000000-0000-4000-8000-000000000001';
const PRODUCT_B = '50000000-0000-4000-8000-000000000002';

class ProbeRollback extends Error {
  constructor(readonly result: unknown) {
    super('test rollback');
  }
}

describe.skipIf(!databaseUrl)(
  'security remediation and owner HU-22..25 (isolated PostgreSQL)',
  (): void => {
    let sql: postgres.Sql<Record<string, unknown>>;
    let maintenance: postgres.Sql<Record<string, unknown>>;
    let name: string;
    let localDatabaseUrl: string;

    async function asActor<T>(
      actor: string | null,
      role: 'anon' | 'authenticated',
      work: (tx: postgres.TransactionSql<Record<string, unknown>>) => Promise<T>,
    ): Promise<T> {
      try {
        await sql.begin(async (tx): Promise<void> => {
          await tx`SELECT set_config('request.jwt.claims',${JSON.stringify({ sub: actor })},true)`;
          if (role === 'anon') await tx`SET LOCAL ROLE anon`;
          else await tx`SET LOCAL ROLE authenticated`;
          throw new ProbeRollback(await work(tx));
        });
      } catch (error: unknown) {
        if (error instanceof ProbeRollback) return error.result as T;
        throw error;
      }
      throw new Error('Expected rollback');
    }

    beforeAll(async (): Promise<void> => {
      const url = new URL(databaseUrl!);
      if (
        !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
        !/^\/cdv_security_test(?:_[a-z0-9_]+)?$/.test(url.pathname) ||
        url.port !== '55439' ||
        url.username !== 'cdv_test'
      )
        throw new Error('Dedicated local security test cluster required');
      name = `cdv_security_test_${crypto.randomUUID().replaceAll('-', '')}`;
      url.pathname = '/postgres';
      maintenance = postgres(url.href, { max: 1, prepare: false, connect_timeout: 5 });
      await maintenance.unsafe(`CREATE DATABASE "${name}"`);
      url.pathname = `/${name}`;
      localDatabaseUrl = url.href;
      sql = postgres(url.href, {
        max: 1,
        prepare: false,
        connect_timeout: 5,
        onnotice: (): void => undefined,
      });
      await sql.unsafe(readFileSync(resolve('supabase/tests/security-fixture.sql'), 'utf8'));
      const files = [
        '20260902143522_initial_schema.sql',
        '20260902184244_update_rls_and_grants.sql',
        '20260902184400_create_core_users.sql',
        '20260902184500_upsert_tenant_rpc.sql',
        '20260915175201_v5_auth_multi_tenancy.sql',
        '20260915200000_sync_auth_users.sql',
        '20260917001602_products_v5_hardening.sql',
        '20260918060000_outbox_pattern.sql',
        '20260924000000_tenant_profile_enrichment.sql',
        '20260925000000_create_products_storage_bucket.sql',
        '20261014000000_add_confirmed_to_orders_status.sql',
        '20261019000000_store_branding_storage.sql',
        '20261101000000_product_gallery.sql',
        '20261103020000_user_management.sql',
        '20261103030000_invitation_account_mode.sql',
        '20261103040000_member_account_management.sql',
        '20261103050000_membership_hardening.sql',
        '20261103060000_audit_fixes.sql',
        '20261103070000_business_account_single_tenant.sql',
        '20261103080000_member_permission_check.sql',
        '20261103090000_default_tenant_roles.sql',
        '20261105000000_order_status_history.sql',
      ];
      for (const file of files)
        await sql.unsafe(readFileSync(resolve('supabase/migrations', file), 'utf8'));
      // Replay the actual financial table definitions and browser-read policies, without provisioning external workers/vault.
      await sql`ALTER TABLE sales.payments ADD UNIQUE(id,order_id,tenant_id)`;
      for (const [file, table] of [
        ['20261015182007_payments_v41_settlement_and_expiry.sql', 'compensation_obligations'],
        ['20261016033957_payments_v41_refund_ledger_and_dispatch.sql', 'refund_operations'],
      ]) {
        const source = readFileSync(resolve('supabase/migrations', file), 'utf8');
        const statement = source.match(
          new RegExp(`CREATE TABLE IF NOT EXISTS sales\\.${table} [\\s\\S]*?\\n\\);`),
        );
        if (!statement) throw new Error(`Missing actual table definition: ${table}`);
        await sql.unsafe(statement[0]);
        await sql.unsafe(`ALTER TABLE sales.${table} ENABLE ROW LEVEL SECURITY`);
        const revoke = source.match(new RegExp(`REVOKE ALL ON sales\\.${table} FROM [^;]+;`));
        if (!revoke) throw new Error('Missing financial ACL');
        await sql.unsafe(revoke[0]);
      }
      await sql`DROP POLICY IF EXISTS "Enable read/write for authenticated users" ON sales.payments`;
      for (const [file, policy, table] of [
        [
          '20261016041424_payments_v41_retention_and_financial_fencing.sql',
          'payments_tenant_read',
          'payments',
        ],
        [
          '20261016033957_payments_v41_refund_ledger_and_dispatch.sql',
          'refund_tenant_read',
          'refund_operations',
        ],
      ]) {
        const source = readFileSync(resolve('supabase/migrations', file), 'utf8');
        const policySql = source.match(
          new RegExp(`CREATE POLICY ${policy} ON sales\\.${table}[^;]+;`),
        );
        if (!policySql) throw new Error('Missing actual financial read policy');
        await sql.unsafe(`GRANT SELECT ON sales.${table} TO authenticated`);
        await sql.unsafe(policySql[0]);
      }
      await sql`ALTER TABLE sales.orders ADD COLUMN currency text NOT NULL DEFAULT 'USD'`;
      const migration = readdirSync(resolve('supabase/migrations')).find((file): boolean =>
        file.endsWith('_security_authorization_boundaries.sql'),
      );
      expect(migration).toBeDefined();
      await sql.unsafe(readFileSync(resolve('supabase/migrations', migration!), 'utf8'));
      const legacyGrantFix = readdirSync(resolve('supabase/migrations')).find((file): boolean =>
        file.endsWith('_close_legacy_browser_rpc_grants.sql'),
      );
      expect(legacyGrantFix).toBeDefined();
      await sql.unsafe(readFileSync(resolve('supabase/migrations', legacyGrantFix!), 'utf8'));
      await sql`INSERT INTO auth.users(id,email) VALUES (${OWNER},'owner@example.test'),(${MEMBER},'member@example.test'),(${OTHER},'other@example.test')`;
      await sql`INSERT INTO core.tenants(id,name,slug,contact_email,base_currency,status) VALUES
      (${TENANT},'Owner Store','owner-store','owner@example.test','USD','active'),
      (${TENANT_B},'Other Store','other-store','other@example.test','USD','active')`;
      await sql`INSERT INTO core.tenant_memberships(user_id,tenant_id,role,status) VALUES
      (${OWNER},${TENANT},'OWNER','active'),(${OTHER},${TENANT_B},'OWNER','active')`;
      await sql`INSERT INTO core.tenant_memberships(user_id,tenant_id,role,status,custom_role_id)
      SELECT ${MEMBER},${TENANT},'MEMBER','active',id FROM core.tenant_roles WHERE tenant_id=${TENANT} AND system_key='catalog'`;
      await sql`INSERT INTO catalog.categories(id,name,tenant_id,description,status) VALUES (${CATEGORY},'Category',${TENANT},'fixture','active')`;
      await sql`INSERT INTO catalog.products(id,name,tenant_id,category_id,description,status,sku,price_cents,cost_cents,wholesale_price_cents,stock)
      VALUES (${PRODUCT},'High revenue',${TENANT},${CATEGORY},'fixture','active','A',1000,200,800,10),
      (${PRODUCT_B},'High units',${TENANT},${CATEGORY},'fixture','active','B',100,20,80,20)`;
      await sql`INSERT INTO sales.customers(id,tenant_id,name,email,phone,document_id,status,address_street,address_city,address_state,address_zip_code,address_country)
      VALUES (${CUSTOMER},${TENANT},'Private Customer','buyer@example.test','5551234567','test','active','private street','city','state','zip','EC')`;
      await sql`INSERT INTO sales.customers(id,tenant_id,name,email,phone,document_id,status,address_street,address_city,address_state,address_zip_code,address_country)
      VALUES (${crypto.randomUUID()},${TENANT},'No orders','no-orders@example.test','5557654321','test','active','street','city','state','zip','EC')`;
      const orders = [
        {
          status: 'delivered',
          days: 2,
          amount: 2000,
          discount: 200,
          product: PRODUCT,
          units: 2,
          unit: 1000,
        },
        {
          status: 'processing',
          days: 3,
          amount: 500,
          discount: 0,
          product: PRODUCT_B,
          units: 5,
          unit: 100,
        },
        {
          status: 'cancelled',
          days: 4,
          amount: 9000,
          discount: 0,
          product: PRODUCT,
          units: 9,
          unit: 1000,
        },
        {
          status: 'paid',
          days: 40,
          amount: 1000,
          discount: 0,
          product: PRODUCT,
          units: 1,
          unit: 1000,
        },
      ];
      for (const [index, order] of orders.entries()) {
        const id = crypto.randomUUID();
        await sql`INSERT INTO sales.orders(id,order_number,customer_id,tenant_id,status,subtotal_cents,tax_amount_cents,discount_amount_cents,shipping_cost_cents,total_amount_cents,
        shipping_address_street,shipping_address_city,shipping_address_state,shipping_address_zip_code,shipping_address_country,created_at)
        VALUES (${id},${`ORDER-${index}`},${CUSTOMER},${TENANT},${order.status},${order.amount},0,${order.discount},0,${order.amount - order.discount},
          'private street','city','state','zip','EC',date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' - ${order.days} * interval '1 day')`;
        await sql`INSERT INTO sales.order_items(id,order_id,product_id,product_name,quantity,unit_price_cents,sku,subtotal_cents)
        VALUES (${crypto.randomUUID()},${id},${order.product},'fixture',${order.units},${order.unit},'fixture',${order.amount})`;
        if (index === 0) {
          await sql`DELETE FROM sales.order_status_history WHERE order_id=${id}`;
          for (const [stage, hours] of [
            ['paid', 48],
            ['processing', 24],
            ['shipped', 12],
            ['delivered', 0],
          ] as const) {
            await sql`INSERT INTO sales.order_status_history(order_id,tenant_id,to_status,changed_at)
            SELECT id,tenant_id,${stage},created_at + ${48 - hours} * interval '1 hour' FROM sales.orders WHERE id=${id}`;
          }
        }
      }
    }, 30_000);

    afterAll(async (): Promise<void> => {
      if (sql) await sql.end({ timeout: 5 });
      if (maintenance) {
        if (name && /^cdv_security_test_[a-f0-9]+$/.test(name))
          await maintenance.unsafe(`DROP DATABASE IF EXISTS "${name}"`);
        await maintenance.end({ timeout: 5 });
      }
    });

    it('does not grant anonymous execution of any legacy write RPC', async (): Promise<void> => {
      const rows = await sql<
        { allowed: boolean }[]
      >`SELECT has_function_privilege('anon',oid,'EXECUTE') AS allowed
      FROM pg_proc WHERE oid IN ('public.upsert_tenant_transactional(jsonb)'::regprocedure,
        'public.upsert_user_transactional(jsonb)'::regprocedure,'core.onboard_tenant_transactional(uuid,uuid,jsonb,jsonb)'::regprocedure)`;
      expect(rows).toHaveLength(3);
      expect(rows.every((row): boolean => !row.allowed)).toBe(true);
    });
    it('rejects another store owner changing a tenant through the privileged RPC', async (): Promise<void> => {
      await expect(
        asActor(
          OTHER,
          'authenticated',
          async (tx): Promise<unknown> => tx`SELECT public.upsert_tenant_transactional(
      jsonb_build_object('id',${TENANT}::text,'version',999,'name','Hijacked','slug','hijacked','contact_email','bad@example.test','base_currency','USD','status','active'))`,
        ),
      ).rejects.toMatchObject({ code: '42501' });
    });
    it('rejects profile impersonation and onboarding for another identity', async (): Promise<void> => {
      await expect(
        asActor(
          OTHER,
          'authenticated',
          async (tx): Promise<unknown> => tx`SELECT public.upsert_user_transactional(
      jsonb_build_object('id',${OWNER}::text,'version',999,'email','bad@example.test','status','active','first_name','Forged'))`,
        ),
      ).rejects.toMatchObject({ code: '42501' });
      await expect(
        asActor(
          OTHER,
          'authenticated',
          async (tx): Promise<unknown> => tx`SELECT core.onboard_tenant_transactional(
      ${crypto.randomUUID()}::uuid,${OWNER}::uuid,'{}'::jsonb,'{}'::jsonb)`,
        ),
      ).rejects.toMatchObject({ code: '42501' });
    });
    it('allows the owner to update their own store and profile', async (): Promise<void> => {
      await expect(
        asActor(
          OWNER,
          'authenticated',
          async (tx): Promise<unknown> => tx`SELECT public.upsert_tenant_transactional(
      jsonb_build_object('id',${TENANT}::text,'version',1,'name','Renamed','slug','owner-store','contact_email','owner@example.test','base_currency','USD','status','active'))`,
        ),
      ).resolves.toBeDefined();
      await expect(
        asActor(
          OWNER,
          'authenticated',
          async (tx): Promise<unknown> => tx`SELECT public.upsert_user_transactional(
      jsonb_build_object('id',${OWNER}::text,'version',2,'email','owner@example.test','status','active','first_name','Owner','last_name','Name'))`,
        ),
      ).resolves.toBeDefined();
    });
    it('rejects spoofed email/status even when the target profile is the caller', async (): Promise<void> => {
      for (const [email, status] of [
        ['bad@example.test', 'active'],
        ['owner@example.test', 'suspended'],
      ]) {
        await expect(
          asActor(
            OWNER,
            'authenticated',
            async (tx): Promise<unknown> => tx`SELECT public.upsert_user_transactional(
        jsonb_build_object('id',${OWNER}::text,'version',999,'email',${email}::text,'status',${status}::text,'first_name','Owner'))`,
          ),
        ).rejects.toMatchObject({ code: '42501' });
      }
    });
    it('preserves authenticated personal-account onboarding with an owner scoped to the new store', async (): Promise<void> => {
      const id = crypto.randomUUID();
      expect(
        await asActor(OWNER, 'authenticated', async (tx): Promise<unknown> => {
          await tx`SELECT core.onboard_tenant_transactional(${crypto.randomUUID()}::uuid,${OWNER}::uuid,
        jsonb_build_object('id',${id}::text,'name','New Store','slug',${`new-${id}`}::text,'contact_email','owner@example.test','base_currency','USD','status','active'),
        jsonb_build_object('email','owner@example.test','first_name','Owner','last_name','Name'))`;
          return tx`SELECT role FROM core.tenant_memberships WHERE tenant_id=${id}`;
        }),
      ).toEqual([{ role: 'OWNER' }]);
    });
    it('denies customer/order PII to catalog-only members and all other tenants', async (): Promise<void> => {
      expect(
        await asActor(
          MEMBER,
          'authenticated',
          async (tx): Promise<unknown> =>
            tx`SELECT email,phone,address_street FROM sales.customers`,
        ),
      ).toHaveLength(0);
      expect(
        await asActor(
          MEMBER,
          'authenticated',
          async (tx): Promise<unknown> => tx`SELECT shipping_address_street FROM sales.orders`,
        ),
      ).toHaveLength(0);
      expect(
        await asActor(
          OTHER,
          'authenticated',
          async (tx): Promise<unknown> =>
            tx`SELECT * FROM sales.customers WHERE tenant_id=${TENANT}`,
        ),
      ).toHaveLength(0);
      expect(
        await asActor(
          OWNER,
          'authenticated',
          async (tx): Promise<unknown> =>
            tx`SELECT * FROM sales.customers WHERE tenant_id=${TENANT}`,
        ),
      ).toHaveLength(2);
    });
    it('allows catalog reads but prevents direct aggregate mutations even for owners', async (): Promise<void> => {
      expect(
        await asActor(
          MEMBER,
          'authenticated',
          async (tx): Promise<unknown> => tx`SELECT * FROM catalog.products`,
        ),
      ).toHaveLength(2);
      await expect(
        asActor(
          OWNER,
          'authenticated',
          async (tx): Promise<unknown> => tx`UPDATE sales.orders SET status='paid'`,
        ),
      ).rejects.toMatchObject({ code: '42501' });
      await expect(
        asActor(
          MEMBER,
          'authenticated',
          async (tx): Promise<unknown> => tx`UPDATE catalog.products SET price_cents=1`,
        ),
      ).rejects.toMatchObject({ code: '42501' });
    });
    it('only permits product uploads with MANAGE_CATALOG in the destination store', async (): Promise<void> => {
      await expect(
        asActor(
          OTHER,
          'authenticated',
          async (tx): Promise<unknown> =>
            tx`INSERT INTO storage.objects(bucket_id,name) VALUES ('products',${`${TENANT}/test.jpg`})`,
        ),
      ).rejects.toMatchObject({ code: '42501' });
      await expect(
        asActor(
          MEMBER,
          'authenticated',
          async (tx): Promise<unknown> =>
            tx`INSERT INTO storage.objects(bucket_id,name) VALUES ('products',${`${TENANT}/test.jpg`})`,
        ),
      ).resolves.toBeDefined();
      await sql`UPDATE core.tenant_memberships SET custom_role_id=NULL WHERE user_id=${MEMBER}`;
      await expect(
        asActor(
          MEMBER,
          'authenticated',
          async (tx): Promise<unknown> =>
            tx`INSERT INTO storage.objects(bucket_id,name) VALUES ('products',${`${TENANT}/test.jpg`})`,
        ),
      ).rejects.toMatchObject({ code: '42501' });
    });
    it('HU-22: owner sees net period/lifetime revenue and customers without a platform admin', async (): Promise<void> => {
      const report = await new PostgresDashboardOverviewReadAdapter(sql).findForManager(
        OWNER,
        TENANT,
        { days: 30 },
      );
      expect(report?.kpis).toMatchObject({
        revenueCents: 2300,
        lifetimeRevenueCents: 3300,
        totalCustomers: 2,
        orderCount: 2,
        buyingCustomers: 1,
      });
      expect(
        await new PostgresDashboardOverviewReadAdapter(sql).findForManager(OTHER, TENANT, {
          days: 30,
        }),
      ).toBeNull();
    });
    it('HU-23..25: owner gets daily history, measured stage durations, stuck orders and two rankings', async (): Promise<void> => {
      const reader = new PostgresBusinessIntelligenceReadAdapter(sql);
      const query = { days: 30, leadTimeDays: 7, targetCoverageDays: 30 };
      const report = await reader.findForManager(OWNER, TENANT, query);
      expect(report?.revenueCents).toBe(2300);
      expect(report?.previousRevenueCents).toBe(1000);
      expect(report?.daily).toHaveLength(30);
      expect(report?.daily.reduce((sum, point): number => sum + point.revenueCents, 0)).toBe(2300);
      expect(
        report?.orderFlow.stages.find((stage): boolean => stage.from === 'paid'),
      ).toMatchObject({ averageMinutes: 1440, samples: 1 });
      expect(
        report?.orderFlow.stages.find((stage): boolean => stage.from === 'processing'),
      ).toMatchObject({ averageMinutes: 720, samples: 1 });
      expect(
        report?.orderFlow.stages.find((stage): boolean => stage.from === 'shipped'),
      ).toMatchObject({ averageMinutes: 720, samples: 1 });
      expect(report?.orderFlow.stuckCount).toBeGreaterThan(0);
      expect(report?.productRankings.units[0].id).toBe(PRODUCT_B);
      expect(report?.productRankings.revenue[0].id).toBe(PRODUCT);
      expect(await reader.findForManager(OTHER, TENANT, query)).toBeNull();
      expect(await reader.findForManager(MEMBER, TENANT, query)).toBeNull();
    });
    it('HU-23: selected historical dates change the revenue series and preserve zero-sale days', async (): Promise<void> => {
      const endDate = new Date(Date.now() - 20 * 86400000).toISOString().slice(0, 10);
      const report = await new PostgresBusinessIntelligenceReadAdapter(sql).findForManager(
        OWNER,
        TENANT,
        {
          days: 30,
          endDate,
          leadTimeDays: 7,
          targetCoverageDays: 30,
        },
      );
      expect(report?.revenueCents).toBe(1000);
      expect(report?.daily).toHaveLength(30);
      expect(report?.daily.filter((point): boolean => point.revenueCents > 0)).toHaveLength(1);
      expect(report?.daily[29].date).toBe(endDate);
    });
    it('HU-24: the database records status transitions made by the authorized backend', async (): Promise<void> => {
      const [order] = await sql<{ id: string }[]>`UPDATE sales.orders SET status='shipped'
        WHERE order_number='ORDER-1' AND tenant_id=${TENANT} RETURNING id`;
      expect(order).toBeDefined();
      const history = await sql<
        { to_status: string }[]
      >`SELECT to_status FROM sales.order_status_history
        WHERE order_id=${order.id}::uuid ORDER BY changed_at DESC,id DESC LIMIT 1`;
      expect(history).toEqual([{ to_status: 'shipped' }]);
    });
    it('denies direct payment and refund reads while the owner backend retains access', async (): Promise<void> => {
      const [order] = await sql<
        { id: string }[]
      >`SELECT id FROM sales.orders WHERE tenant_id=${TENANT} LIMIT 1`;
      const payment = crypto.randomUUID();
      await sql`INSERT INTO sales.payments(id,order_id,tenant_id,customer_id,status,gateway,amount_cents,gateway_transaction_id)
        VALUES (${payment},${order.id},${TENANT},${CUSTOMER},'completed','cash',500,'provider-private')`;
      await sql`INSERT INTO sales.refund_operations(payment_id,order_id,tenant_id,provider_order_id,environment,amount_cents,baseline_refunded_cents,intention,idempotency_key,request_hash,worker_token)
        VALUES (${payment},${order.id},${TENANT},'123','test',500,0,'CUSTOMER_REQUEST','fixture',${'0'.repeat(64)},${crypto.randomUUID()})`;
      for (const actor of [MEMBER, OWNER]) {
        await expect(
          asActor(
            actor,
            'authenticated',
            async (tx): Promise<unknown> =>
              tx`SELECT amount_cents,gateway_transaction_id FROM sales.payments`,
          ),
        ).rejects.toMatchObject({ code: '42501' });
        await expect(
          asActor(
            actor,
            'authenticated',
            async (tx): Promise<unknown> =>
              tx`SELECT amount_cents,worker_token FROM sales.refund_operations`,
          ),
        ).rejects.toMatchObject({ code: '42501' });
      }
      expect(await sql`SELECT * FROM sales.payments WHERE tenant_id=${TENANT}`).toHaveLength(1);
      expect(
        await sql`SELECT * FROM sales.refund_operations WHERE tenant_id=${TENANT}`,
      ).toHaveLength(1);
    });
    it('permits delegated brand assets only in the authorized destination store', async (): Promise<void> => {
      const role = crypto.randomUUID();
      await sql`INSERT INTO core.tenant_roles(id,tenant_id,name,permissions) VALUES (${role},${TENANT},'Brand editor',ARRAY['MANAGE_STORE'])`;
      await sql`UPDATE core.tenant_memberships SET custom_role_id=${role} WHERE user_id=${MEMBER}`;
      await expect(
        asActor(MEMBER, 'authenticated', async (tx): Promise<unknown> => {
          const [asset] = await tx<
            { id: string }[]
          >`INSERT INTO storage.objects(bucket_id,name) VALUES ('store-branding',${`${TENANT}/brand.jpg`}) RETURNING id`;
          const removed = await tx`DELETE FROM storage.objects WHERE id=${asset.id} RETURNING id`;
          expect(removed).toHaveLength(1);
        }),
      ).resolves.toBeUndefined();
      await expect(
        asActor(
          OTHER,
          'authenticated',
          async (tx): Promise<unknown> =>
            tx`INSERT INTO storage.objects(bucket_id,name) VALUES ('store-branding',${`${TENANT}/brand.jpg`})`,
        ),
      ).rejects.toMatchObject({ code: '42501' });
    });
    it('prevents a branding editor reactivating an archived store through the legacy RPC', async (): Promise<void> => {
      await sql`UPDATE core.tenants SET status='archived' WHERE id=${TENANT}`;
      try {
        await expect(
          asActor(
            MEMBER,
            'authenticated',
            async (tx): Promise<unknown> => tx`SELECT public.upsert_tenant_transactional(
          jsonb_build_object('id',${TENANT}::text,'version',1,'name','Owner Store','slug','owner-store','contact_email','owner@example.test','base_currency','USD','status','active'))`,
          ),
        ).rejects.toMatchObject({ code: '42501' });
      } finally {
        await sql`UPDATE core.tenants SET status='active' WHERE id=${TENANT}`;
      }
    });
    it('rejects arbitrary version jumps for both store and self profile', async (): Promise<void> => {
      await expect(
        asActor(
          OWNER,
          'authenticated',
          async (tx): Promise<unknown> => tx`SELECT public.upsert_tenant_transactional(
        jsonb_build_object('id',${TENANT}::text,'version',2147483647,'name','Owner Store','slug','owner-store','contact_email','owner@example.test','base_currency','USD','status','active'))`,
        ),
      ).rejects.toMatchObject({ code: 'P0001' });
      await expect(
        asActor(
          OWNER,
          'authenticated',
          async (tx): Promise<unknown> => tx`SELECT public.upsert_user_transactional(
        jsonb_build_object('id',${OWNER}::text,'version',2147483647,'email','owner@example.test','status','active','first_name','Owner','last_name','Name'))`,
        ),
      ).rejects.toMatchObject({ code: 'P0001' });
    });
    it('allows exactly one of two concurrent writes with the same preceding version', async (): Promise<void> => {
      await sql.unsafe(`CREATE FUNCTION core.test_slow_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_sleep(0.1); RETURN NEW; END $$;
        CREATE TRIGGER test_slow_update BEFORE UPDATE ON core.tenants FOR EACH ROW EXECUTE FUNCTION core.test_slow_update()`);
      const racing = postgres(localDatabaseUrl, { max: 2, prepare: false, connect_timeout: 5 });
      const write = async (): Promise<unknown> =>
        racing.begin(async (tx): Promise<unknown> => {
          await tx`SELECT set_config('request.jwt.claims',${JSON.stringify({ sub: OWNER })},true)`;
          await tx`SET LOCAL ROLE authenticated`;
          return tx`SELECT public.upsert_tenant_transactional(jsonb_build_object('id',${TENANT}::text,'version',1,'name','Edited','slug','owner-store','contact_email','owner@example.test','base_currency','USD','status','active'))`;
        });
      try {
        const outcomes = await Promise.allSettled([write(), write()]);
        expect(outcomes.filter((result): boolean => result.status === 'fulfilled')).toHaveLength(1);
        expect(outcomes.filter((result): boolean => result.status === 'rejected')).toHaveLength(1);
      } finally {
        await racing.end({ timeout: 5 });
        await sql`DROP TRIGGER test_slow_update ON core.tenants`;
        await sql`DROP FUNCTION core.test_slow_update()`;
      }
    });
    it('HU-24 includes confirmed checkout orders, including the older open backlog', async (): Promise<void> => {
      await sql`UPDATE sales.orders SET status='confirmed' WHERE tenant_id=${TENANT} AND order_number IN ('ORDER-1','ORDER-3')`;
      await sql`UPDATE sales.order_status_history h SET changed_at=o.created_at FROM sales.orders o WHERE h.order_id=o.id AND h.to_status='confirmed' AND o.tenant_id=${TENANT}`;
      const report = await new PostgresBusinessIntelligenceReadAdapter(sql).findForManager(
        OWNER,
        TENANT,
        { days: 30, leadTimeDays: 7, targetCoverageDays: 30 },
      );
      expect(
        report?.orderFlow.statusCounts.find((row): boolean => row.status === 'confirmed')?.count,
      ).toBe(1);
      expect(
        report?.orderFlow.stuckOrders.some((row): boolean => row.orderNumber === 'ORDER-3'),
      ).toBe(true);
      const overview = await new PostgresDashboardOverviewReadAdapter(sql).findForManager(
        OWNER,
        TENANT,
        { days: 30 },
      );
      expect(overview?.pendingPayment).toBe(2);
      await sql`UPDATE sales.orders SET status=CASE order_number WHEN 'ORDER-1' THEN 'processing' ELSE 'paid' END WHERE tenant_id=${TENANT} AND order_number IN ('ORDER-1','ORDER-3')`;
    });
    it('HU-22/23/25 never combine historical foreign money with base money, but retain physical demand', async (): Promise<void> => {
      const id = crypto.randomUUID();
      await sql`INSERT INTO sales.orders(id,order_number,customer_id,tenant_id,currency,status,subtotal_cents,tax_amount_cents,discount_amount_cents,shipping_cost_cents,total_amount_cents,
        shipping_address_street,shipping_address_city,shipping_address_state,shipping_address_zip_code,shipping_address_country,created_at)
        VALUES (${id},'EUR-ORDER',${CUSTOMER},${TENANT},'EUR','paid',100000,0,0,0,100000,'street','city','state','zip','EC',now()-interval '1 day')`;
      await sql`INSERT INTO sales.order_items(id,order_id,product_id,product_name,quantity,unit_price_cents,sku,subtotal_cents)
        VALUES (${crypto.randomUUID()},${id},${PRODUCT_B},'Foreign sale',10,10000,'B',100000)`;
      const overview = await new PostgresDashboardOverviewReadAdapter(sql).findForManager(
        OWNER,
        TENANT,
        { days: 30 },
      );
      expect(overview?.kpis).toMatchObject({
        revenueCents: 2300,
        lifetimeRevenueCents: 3300,
        orderCount: 3,
        excludedCurrencyOrders: 1,
      });
      expect(overview?.recentOrders.find((row): boolean => row.id === id)?.currency).toBe('EUR');
      const report = await new PostgresBusinessIntelligenceReadAdapter(sql).findForManager(
        OWNER,
        TENANT,
        { days: 30, leadTimeDays: 7, targetCoverageDays: 30 },
      );
      expect(report).toMatchObject({
        revenueCents: 2300,
        estimatedProfitCents: 1800,
        orderCount: 3,
        unitsSold: 17,
        excludedCurrencyOrders: 1,
      });
      expect(report?.productRankings.revenue[0].id).toBe(PRODUCT);
      expect(report?.products.find((row): boolean => row.id === PRODUCT_B)).toMatchObject({
        unitsSold: 15,
        revenueCents: 500,
        estimatedProfitCents: 400,
      });
    });
    it('closes all six obsolete RPC capabilities to browser roles while preserving their internal owner', async (): Promise<void> => {
      const signatures = [
        'catalog.acquire_idempotency_lease(uuid,text,uuid)',
        'catalog.renew_idempotency_lease(uuid,uuid,integer)',
        'catalog.complete_idempotency(uuid,uuid,jsonb)',
        'catalog.consume_image_upload(uuid,uuid)',
        'core.append_outbox_event(character varying,uuid,character varying,jsonb)',
        'catalog.append_product_audit(uuid,character varying,jsonb)',
      ];
      for (const signature of signatures) {
        const rows = await sql<
          { role: string; allowed: boolean }[]
        >`SELECT role,has_function_privilege(role,${signature},'EXECUTE') AS allowed
          FROM unnest(ARRAY['anon','authenticated','service_role']) AS role`;
        expect(rows, signature).toEqual([
          { role: 'anon', allowed: false },
          { role: 'authenticated', allowed: false },
          { role: 'service_role', allowed: false },
        ]);
        const [internal] = await sql<
          { allowed: boolean }[]
        >`SELECT has_function_privilege('app_rpc_owner',${signature},'EXECUTE') AS allowed`;
        expect(internal.allowed, signature).toBe(true);
      }
    });
    it('rejects an obsolete RPC even when the caller holds a stale legacy tenant claim', async (): Promise<void> => {
      await expect(
        asActor(OWNER, 'authenticated', async (tx): Promise<unknown> => {
          await tx`SELECT set_config('request.jwt.claims',${JSON.stringify({ sub: OWNER, app_tenant_id: TENANT })},true)`;
          return tx`SELECT core.append_outbox_event('User',${OWNER}::uuid,'UserRegisteredEvent','{}'::jsonb)`;
        }),
      ).rejects.toMatchObject({
        code: '42501',
        message: 'permission denied for function append_outbox_event',
      });
    });
  },
);
