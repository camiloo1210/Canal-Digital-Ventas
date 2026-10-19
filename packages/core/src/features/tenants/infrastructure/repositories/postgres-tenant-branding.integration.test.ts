import postgres from 'postgres';
import { readFileSync } from 'node:fs';
import { rootCertificates } from 'node:tls';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  PostgresTenantBrandingRepository,
  PostgresTenantBrandingReadRepository,
} from '@/tenants/infrastructure/repositories/postgres-tenant-branding.repository';
import { UpdateTenantBrandingUseCase } from '@/tenants/application/use-cases/update-tenant-branding.use-case';
import { PostgresEventBusAdapter } from '@/shared/infrastructure/adapters/postgres-event-bus.adapter';
import { PostgresTransactionManagerAdapter } from '@/shared/infrastructure/adapters/postgres-transaction-manager.adapter';
import { ApplicationException } from '@/shared/application/exceptions/application.exception';
import { TenantNotFoundException } from '@/tenants/application/exceptions/tenant-not-found.exception';
import { OptimisticConcurrencyException } from '@/shared/application/exceptions/optimistic-concurrency.exception';
import { TenantSlugAlreadyInUseException } from '@/tenants/application/exceptions/tenant-slug-already-in-use.exception';
import { TenantSlug } from '@/tenants/domain/value-objects/tenant-slug.vo';
import { PostgresPublicTenantDirectoryReadAdapter } from '@/tenants/infrastructure/repositories/postgres-public-tenant-directory-read.adapter';

const databaseUrl = process.env.STORE_BRANDING_TEST_DATABASE_URL;
class BrandingRollback extends ApplicationException {}

describe.skipIf(!databaseUrl)('Store branding PostgreSQL (all writes rolled back)', (): void => {
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

  it('checks manager access, optimistic locking, atomic outbox writes and rollback', async (): Promise<void> => {
    const [manager] = await sql<
      { user_id: string; tenant_id: string }[]
    >`SELECT m.user_id,m.tenant_id
      FROM core.tenant_memberships m JOIN core.tenants t ON t.id=m.tenant_id
      WHERE m.status='active' AND m.role IN ('OWNER','ADMIN') AND t.status='active' LIMIT 1`;
    expect(
      manager,
      'An existing active store manager is required for this opt-in probe.',
    ).toBeDefined();
    const reader = new PostgresTenantBrandingReadRepository(sql);
    const baseline = await reader.findForManager(manager.user_id, manager.tenant_id);
    expect(baseline).not.toBeNull();
    expect(await reader.findForManager(crypto.randomUUID(), manager.tenant_id)).toBeNull();
    const [beforeEvents] = await sql<
      { count: number }[]
    >`SELECT count(*)::int AS count FROM core.outbox_events WHERE aggregate_id=${manager.tenant_id}::uuid`;
    const transactions = new PostgresTransactionManagerAdapter(sql);
    await expect(
      transactions.runInTransaction(
        async (tx): Promise<void> => {
          await tx.executeNative<postgres.TransactionSql<Record<string, unknown>>, void>(
            async (conn): Promise<void> => {
              await conn`SET LOCAL statement_timeout='15s'`;
              await conn`SET LOCAL lock_timeout='5s'`;
            },
          );
          const useCase = new UpdateTenantBrandingUseCase(
            new PostgresTenantBrandingRepository(),
            {
              runInTransaction: async <T>(
                operation: (context: typeof tx) => Promise<T>,
              ): Promise<T> => operation(tx),
            },
            new PostgresEventBusAdapter(),
          );
          const dto = {
            userId: manager.user_id,
            tenantId: manager.tenant_id,
            name: baseline!.name,
            slug: `store-${crypto.randomUUID()}`,
            description: 'Rollback-only store customization probe',
            version: baseline!.version,
          };
          const occupiedSlug = `taken-${crypto.randomUUID()}`;
          await tx.executeNative<postgres.TransactionSql<Record<string, unknown>>, void>(
            async (conn): Promise<void> => {
              await conn`INSERT INTO core.tenants (id,name,slug,contact_email,base_currency,status)
              VALUES (${crypto.randomUUID()},'Slug collision probe',${occupiedSlug},'slug@example.test','USD','active')`;
            },
          );
          await expect(useCase.execute({ ...dto, slug: occupiedSlug })).rejects.toBeInstanceOf(
            TenantSlugAlreadyInUseException,
          );
          await expect(
            useCase.execute({ ...dto, userId: crypto.randomUUID() }),
          ).rejects.toBeInstanceOf(TenantNotFoundException);
          await useCase.execute(dto);
          await expect(useCase.execute(dto)).rejects.toBeInstanceOf(OptimisticConcurrencyException);
          await tx.executeNative<postgres.TransactionSql<Record<string, unknown>>, void>(
            async (conn): Promise<void> => {
              const [row] = await conn<
                { description: string; version: number; slug: string }[]
              >`SELECT description,version,slug FROM core.tenants WHERE id=${manager.tenant_id}::uuid`;
              expect(row).toEqual({
                description: dto.description,
                version: dto.version + 1,
                slug: dto.slug,
              });
              const [events] = await conn<
                { count: number }[]
              >`SELECT count(*)::int AS count FROM core.outbox_events WHERE aggregate_id=${manager.tenant_id}::uuid`;
              expect(events.count).toBe(beforeEvents.count + 1);
              // Simulate the database conflict that can occur after an availability check.
              await expect(
                conn.savepoint(async (savepoint): Promise<void> => {
                  const context = {
                    executeNative: async <TConnection, TResult>(
                      callback: (connection: TConnection) => Promise<TResult>,
                    ): Promise<TResult> => callback(savepoint as unknown as TConnection),
                  };
                  const repository = new PostgresTenantBrandingRepository();
                  const tenant = await repository.findForManager(
                    manager.user_id,
                    manager.tenant_id,
                    context,
                  );
                  expect(tenant).not.toBeNull();
                  tenant!.customizeStore(
                    dto.name,
                    TenantSlug.create(occupiedSlug),
                    dto.description,
                    tenant!.getLogoUrl(),
                    tenant!.getBannerUrl(),
                  );
                  await repository.update(tenant!, dto.version + 1, context);
                }),
              ).rejects.toBeInstanceOf(TenantSlugAlreadyInUseException);
            },
          );
          throw new BrandingRollback('Rollback-only validation');
        },
        { userId: manager.user_id, tenantId: manager.tenant_id },
      ),
    ).rejects.toBeInstanceOf(BrandingRollback);
    expect(await reader.findForManager(manager.user_id, manager.tenant_id)).toEqual(baseline);
    const [afterEvents] = await sql<
      { count: number }[]
    >`SELECT count(*)::int AS count FROM core.outbox_events WHERE aggregate_id=${manager.tenant_id}::uuid`;
    expect(afterEvents.count).toBe(beforeEvents.count);
  }, 30000);

  it('searches all active stores by name or slug before paginating and treats wildcard input literally', async (): Promise<void> => {
    await expect(
      sql.begin(async (conn): Promise<void> => {
        await conn`SET LOCAL statement_timeout='15s'`;
        const prefix = `directory-${crypto.randomUUID()}`;
        const slugPrefix = `lookup-${crypto.randomUUID()}`;
        for (let index = 0; index < 27; index++) {
          const name = index === 25 ? `${prefix} %_special` : `${prefix} Store ${index}`;
          await conn`INSERT INTO core.tenants (id,name,slug,contact_email,base_currency,status)
          VALUES (${crypto.randomUUID()},${name},${`${slugPrefix}-${index}`},'directory@example.test','USD',${index === 26 ? 'suspended' : 'active'})`;
        }
        const repository = new PostgresPublicTenantDirectoryReadAdapter(
          conn as unknown as postgres.Sql<Record<string, unknown>>,
        );
        const first = await repository.searchActive(1, 24, prefix.toUpperCase());
        expect(first.total).toBe(26);
        expect(first.items).toHaveLength(24);
        expect(first.totalPages).toBe(2);
        const second = await repository.searchActive(2, 24, prefix);
        expect(second.items).toHaveLength(2);
        expect(
          new Set([...first.items, ...second.items].map((item): string => item.slug)).size,
        ).toBe(26);
        expect((await repository.searchActive(1, 24, slugPrefix)).total).toBe(26);
        const literal = await repository.searchActive(1, 24, `${prefix} %_`);
        expect(literal.total).toBe(1);
        expect(literal.items[0].name).toBe(`${prefix} %_special`);
        expect((await repository.searchActive(1, 24, `${prefix}-missing`)).total).toBe(0);
        throw new BrandingRollback('Rollback-only directory search validation');
      }),
    ).rejects.toBeInstanceOf(BrandingRollback);
  }, 30000);

  it('validates the storage migration and rejects uploads to a different tenant folder', async (): Promise<void> => {
    await expect(
      sql.begin(async (conn): Promise<void> => {
        await conn`SET LOCAL statement_timeout='15s'`;
        await conn`SET LOCAL lock_timeout='5s'`;
        const [manager] = await conn<
          { user_id: string; tenant_id: string }[]
        >`SELECT user_id,tenant_id FROM core.tenant_memberships WHERE status='active' AND role IN ('OWNER','ADMIN') LIMIT 1`;
        const policies =
          await conn`SELECT 1 FROM pg_policies WHERE schemaname='storage' AND policyname='Store branding manager upload'`;
        if (!policies.length)
          await conn.unsafe(
            readFileSync(
              resolve('supabase/migrations/20261019000000_store_branding_storage.sql'),
              'utf8',
            ),
          );
        await conn`SELECT set_config('request.jwt.claims', ${JSON.stringify({ sub: manager.user_id, role: 'authenticated' })}, true)`;
        await conn`SET LOCAL ROLE authenticated`;
        await conn`INSERT INTO storage.objects (bucket_id,name) VALUES ('store-branding',${`${manager.tenant_id}/${crypto.randomUUID()}.png`})`;
        await expect(
          conn.savepoint(async (savepoint): Promise<void> => {
            await savepoint`INSERT INTO storage.objects (bucket_id,name) VALUES ('store-branding',${`${crypto.randomUUID()}/${crypto.randomUUID()}.png`})`;
          }),
        ).rejects.toMatchObject({ code: '42501' });
        throw new BrandingRollback('Rollback-only storage validation');
      }),
    ).rejects.toBeInstanceOf(BrandingRollback);
  }, 30000);
});
