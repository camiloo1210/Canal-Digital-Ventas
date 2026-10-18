import { Category } from '@/categories/domain/entities/category.entity';
import { PaginationOptions, PaginatedResult } from '@/shared/domain/pagination/pagination';
import { CategoryStatus } from '@/categories/domain/enums/category-status.enum';
import { CategoryId } from '@/categories/domain/types/category-id.type';
import { TenantId } from '@/shared/domain/types/tenant-id.type';
import { TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';

export interface CategoryFilters {
  id?: CategoryId;
  name?: string;
  tenantId: TenantId;
  status?: CategoryStatus;
}

export interface CategoryRepositoryPort {
  save(category: Category, tx?: TransactionContext): Promise<void>;

  deleteById(id: CategoryId, tenantId: TenantId, tx?: TransactionContext): Promise<void>;

  findById(id: CategoryId, tenantId: TenantId, tx?: TransactionContext): Promise<Category | null>;

  findAll(tenantId: TenantId, pagination?: PaginationOptions): Promise<PaginatedResult<Category>>;

  searchByFilters(
    filters: CategoryFilters,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<Category>>;

  searchCategoriesByName(query: string, tenantId: TenantId): Promise<Category[]>;
}
