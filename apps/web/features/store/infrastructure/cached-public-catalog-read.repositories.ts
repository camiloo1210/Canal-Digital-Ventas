import 'server-only';

import type {
  PublicCategoryReadModel,
  PublicCategoryReadRepositoryPort,
  PublicTenantReadModel,
  PublicTenantReadRepositoryPort,
} from '@canaldigital/packages/core';
import { rememberPublicCatalogValue } from '@/lib/cache/public-catalog-cache';

export class CachedPublicTenantReadRepository implements PublicTenantReadRepositoryPort {
  constructor(private readonly source: PublicTenantReadRepositoryPort) {}

  public findBySlug(slug: string): Promise<PublicTenantReadModel | null> {
    return rememberPublicCatalogValue(slug, ['tenant'], (): Promise<PublicTenantReadModel | null> =>
      this.source.findBySlug(slug),
    );
  }
}

export class CachedPublicCategoryReadRepository implements PublicCategoryReadRepositoryPort {
  constructor(private readonly source: PublicCategoryReadRepositoryPort) {}

  public searchActiveByTenantSlug(tenantSlug: string): Promise<PublicCategoryReadModel[]> {
    return rememberPublicCatalogValue(
      tenantSlug,
      ['categories'],
      (): Promise<PublicCategoryReadModel[]> => this.source.searchActiveByTenantSlug(tenantSlug),
    );
  }
}
