import type postgres from 'postgres';
import type { PublicTenantDirectorySearchRepositoryPort } from '@/tenants/application/ports/out/public-tenant-directory-read-repository.port';
import type {
  PublicTenantDirectoryItem,
  PublicTenantDirectoryResult,
} from '@/tenants/application/read-models/public-tenant-directory-item.model';
import { TenantRepositoryException } from '@/tenants/application/exceptions/tenant-repository.exception';

export class PostgresPublicTenantDirectoryReadAdapter implements PublicTenantDirectorySearchRepositoryPort {
  public constructor(private readonly sql: postgres.Sql<Record<string, unknown>>) {}

  public async searchActive(
    requestedPage: number,
    requestedLimit: number,
    query: string,
  ): Promise<PublicTenantDirectoryResult> {
    const page =
      Number.isSafeInteger(requestedPage) && requestedPage > 0 && requestedPage <= 100000
        ? requestedPage
        : 1;
    const limit =
      Number.isSafeInteger(requestedLimit) && requestedLimit > 0
        ? Math.min(requestedLimit, 24)
        : 24;
    const search = query.trim().slice(0, 100);
    // Treat LIKE metacharacters as literal input, not as wildcard searches.
    const pattern = `%${search.replace(/[\\%_]/g, '\\$&')}%`;
    try {
      const [rows, counts] = await Promise.all([
        this.sql<
          PublicTenantDirectoryItem[]
        >`SELECT name,slug,description,logo_url AS "logoUrl",banner_url AS "bannerUrl"
          FROM core.tenants WHERE status='active' AND (name ILIKE ${pattern} OR slug ILIKE ${pattern})
          ORDER BY name ASC,id ASC LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
        this.sql<{ total: number }[]>`SELECT count(*)::int AS total FROM core.tenants
          WHERE status='active' AND (name ILIKE ${pattern} OR slug ILIKE ${pattern})`,
      ]);
      const total = counts[0].total;
      return { items: [...rows], total, currentPage: page, totalPages: Math.ceil(total / limit) };
    } catch (error: unknown) {
      throw new TenantRepositoryException('Failed to search the public store directory.', error);
    }
  }
}
