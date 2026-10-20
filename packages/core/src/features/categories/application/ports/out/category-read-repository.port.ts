import type { CategoryReadModel } from '@/categories/application/read-models/category-read.model';
import type { CategoryFilters } from '@/categories/application/ports/out/category-repository.port';
import type { PaginationOptions, PaginatedResult } from '@/shared/domain/pagination/pagination';

export interface CategoryReadRepositoryPort {
  findById(id: string, tenantId: string): Promise<CategoryReadModel | null>;
  findAll(
    tenantId: string,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<CategoryReadModel>>;
  searchByFilters(
    filters: CategoryFilters,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<CategoryReadModel>>;
}
