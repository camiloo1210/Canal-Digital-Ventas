import 'server-only';

import type {
  PaginatedResult,
  PaginationOptions,
  PublicCategoryReadModel,
  PublicCategoryReadRepositoryPort,
  PublicProductDetailReadModel,
  PublicProductFilters,
  PublicProductReadModel,
  PublicProductReadRepositoryPort,
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

export class CachedPublicProductReadRepository implements PublicProductReadRepositoryPort {
  constructor(private readonly source: PublicProductReadRepositoryPort) {}

  public searchActiveByTenantSlug(
    tenantSlug: string,
    filters: PublicProductFilters,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<PublicProductReadModel>> {
    const normalizedFilters: PublicProductFilters = { ...filters, name: filters.name?.trim() };
    return rememberPublicCatalogValue(
      tenantSlug,
      [
        'products',
        normalizedFilters.categorySlug ?? '',
        normalizedFilters.name ?? '',
        String(pagination?.page ?? ''),
        String(pagination?.limit ?? ''),
      ],
      (): Promise<PaginatedResult<PublicProductReadModel>> =>
        this.source.searchActiveByTenantSlug(tenantSlug, normalizedFilters, pagination),
    );
  }

  public findDetail(params: {
    tenantSlug: string;
    productId: string;
  }): Promise<PublicProductDetailReadModel | null> {
    return rememberPublicCatalogValue(
      params.tenantSlug,
      ['product-detail', params.productId],
      (): Promise<PublicProductDetailReadModel | null> => this.source.findDetail(params),
    );
  }
}
