import type postgres from 'postgres';
import type { Tenant } from '@/tenants/domain/entities/tenant.entity';
import type { TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';
import type {
  TenantBrandingRepositoryPort,
  TenantBrandingReadRepositoryPort,
} from '@/tenants/application/ports/out/tenant-branding-repository.port';
import type { TenantBrandingReadModel } from '@/tenants/application/read-models/tenant-branding.read-model';
import type { DbTenantRow } from '@/tenants/infrastructure/types/supabase-tenant.types';
import { SupabaseTenantMapper } from '@/tenants/infrastructure/mappers/supabase-tenant.mapper';
import { TenantRepositoryException } from '@/tenants/application/exceptions/tenant-repository.exception';
import { OptimisticConcurrencyException } from '@/shared/application/exceptions/optimistic-concurrency.exception';
import { TenantSlugAlreadyInUseException } from '@/tenants/application/exceptions/tenant-slug-already-in-use.exception';

export class PostgresTenantBrandingRepository implements TenantBrandingRepositoryPort {
  public async isSlugInUse(
    slug: string,
    excludingTenantId: string,
    tx: TransactionContext,
  ): Promise<boolean> {
    try {
      return await tx.executeNative<postgres.TransactionSql<Record<string, unknown>>, boolean>(
        async (sql): Promise<boolean> => {
          const rows =
            await sql`SELECT id FROM core.tenants WHERE slug=${slug} AND id<>${excludingTenantId}::uuid LIMIT 1`;
          return rows.length > 0;
        },
      );
    } catch (error: unknown) {
      throw new TenantRepositoryException('Cannot check store URL availability.', error);
    }
  }

  public async findForManager(
    userId: string,
    tenantId: string,
    tx: TransactionContext,
  ): Promise<Tenant | null> {
    try {
      return await tx.executeNative<
        postgres.TransactionSql<Record<string, unknown>>,
        Tenant | null
      >(async (sql): Promise<Tenant | null> => {
        const rows = await sql<DbTenantRow[]>`SELECT t.* FROM core.tenants t
          JOIN core.tenant_memberships m ON m.tenant_id=t.id
          WHERE t.id=${tenantId}::uuid AND m.user_id=${userId}::uuid
            AND m.status='active' AND m.role IN ('OWNER','ADMIN') FOR UPDATE OF t FOR SHARE OF m`;
        return rows[0] ? SupabaseTenantMapper.toDomain(rows[0]) : null;
      });
    } catch (error: unknown) {
      throw new TenantRepositoryException('Cannot load store customization.', error);
    }
  }

  public async update(
    tenant: Tenant,
    expectedVersion: number,
    tx: TransactionContext,
  ): Promise<void> {
    try {
      await tx.executeNative<postgres.TransactionSql<Record<string, unknown>>, void>(
        async (sql): Promise<void> => {
          const rows = await sql`UPDATE core.tenants SET name=${tenant.getName().getValue()},
          slug=${tenant.getSlug().getValue()},
          description=${tenant.getDescription()}, logo_url=${tenant.getLogoUrl()}, banner_url=${tenant.getBannerUrl()},
          updated_at=${tenant.getUpdatedAt()}, version=${tenant.getVersion()}
          WHERE id=${tenant.getId()}::uuid AND version=${expectedVersion} RETURNING id`;
          if (rows.length !== 1) throw new OptimisticConcurrencyException('Tenant', tenant.getId());
        },
      );
    } catch (error: unknown) {
      if (error instanceof OptimisticConcurrencyException) throw error;
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === '23505' &&
        'constraint_name' in error &&
        error.constraint_name === 'tenants_slug_key'
      ) {
        throw new TenantSlugAlreadyInUseException();
      }
      throw new TenantRepositoryException('Cannot save store customization.', error);
    }
  }
}

export class PostgresTenantBrandingReadRepository implements TenantBrandingReadRepositoryPort {
  public constructor(private readonly sql: postgres.Sql<Record<string, unknown>>) {}

  public async findForManager(
    userId: string,
    tenantId: string,
  ): Promise<TenantBrandingReadModel | null> {
    try {
      const rows = await this.sql<TenantBrandingReadModel[]>`SELECT t.name,t.slug,
        coalesce(t.description,'') AS description,t.logo_url AS "logoUrl",t.banner_url AS "bannerUrl",t.version
        FROM core.tenants t JOIN core.tenant_memberships m ON m.tenant_id=t.id
        WHERE t.id=${tenantId}::uuid AND m.user_id=${userId}::uuid
          AND m.status='active' AND m.role IN ('OWNER','ADMIN')`;
      return rows[0] ?? null;
    } catch (error: unknown) {
      throw new TenantRepositoryException('Cannot read store customization.', error);
    }
  }
}
