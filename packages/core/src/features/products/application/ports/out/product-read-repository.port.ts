import type { ProductReadModel } from '@/products/application/read-models/product-read.model';
import type { ProductFilters } from '@/products/application/ports/out/product-repository.port';
import type { PaginationOptions, PaginatedResult } from '@/shared/domain/pagination/pagination';

export interface ProductReadRepositoryPort {
  getProductForEdit(id: string, tenantId: string): Promise<ProductReadModel | null>;
  findAll(
    tenantId: string,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<ProductReadModel>>;
  searchByFilters(
    filters: ProductFilters,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<ProductReadModel>>;
}
