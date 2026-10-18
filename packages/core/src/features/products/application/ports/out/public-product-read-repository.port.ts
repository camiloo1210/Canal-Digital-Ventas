import { PublicProductReadModel } from '@/products/application/read-models/public-product-read.model';
import { PublicProductDetailReadModel } from '@/products/application/read-models/public-product-detail-read.model';
import { PaginatedResult, PaginationOptions } from '@/shared/domain/pagination/pagination';

export interface PublicProductFilters {
  categorySlug?: string;
  name?: string;
}

export interface PublicProductReadRepositoryPort {
  searchActiveByTenantSlug(
    tenantSlug: string,
    filters: PublicProductFilters,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<PublicProductReadModel>>;

  findDetail(params: {
    tenantSlug: string;
    productId: string;
  }): Promise<PublicProductDetailReadModel | null>;
}
