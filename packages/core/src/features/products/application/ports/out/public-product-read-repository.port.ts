import { PublicProductReadModel } from '@/products/application/read-models/public-product-read.model';
import { PaginatedResult, PaginationOptions } from '@/shared/domain/pagination/pagination';
import { CategoryId } from '@/products/domain/types/category-id.type';

export interface PublicProductFilters {
  categorySlug?: string;
  name?: string;
}

export interface PublicProductReadRepositoryPort {
  searchActiveByTenantSlug(
    tenantSlug: string,
    filters: PublicProductFilters,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<PublicProductReadModel>>;
}
