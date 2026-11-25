import { Category, type CategoryProps } from '@/categories/domain/entities/category.entity';
import type {
  CategoryFilters,
  CategoryRepositoryPort,
} from '@/categories/application/ports/out/category-repository.port';
import { createCategoryId, type CategoryId } from '@/categories/domain/types/category-id.type';
import { createTenantId, type TenantId } from '@/shared/domain/types/tenant-id.type';
import { CategoryName } from '@/categories/domain/value-objects/category-name.vo';
import { CategorySlug } from '@/categories/domain/value-objects/category-slug.vo';
import { CategoryDescription } from '@/categories/domain/value-objects/category-description.vo';
import type { PaginatedResult, PaginationOptions } from '@/shared/domain/pagination/pagination';

function snapshotOf(category: Category): CategoryProps {
  return {
    id: createCategoryId(category.getId()),
    name: CategoryName.from(category.getName()),
    slug: CategorySlug.create(category.getSlug()),
    tenantId: createTenantId(category.getTenantId()),
    description: CategoryDescription.from(category.getDescription()),
    status: category.getStatus(),
    version: category.getVersion(),
  };
}

function paginate<T>(items: T[], pagination?: PaginationOptions): PaginatedResult<T> {
  if (!pagination) {
    return { items, totalItems: items.length, totalPages: 1, currentPage: 1 };
  }
  const start = (pagination.page - 1) * pagination.limit;
  return {
    items: items.slice(start, start + pagination.limit),
    totalItems: items.length,
    totalPages: Math.max(1, Math.ceil(items.length / pagination.limit)),
    currentPage: pagination.page,
  };
}

/**
 * Tenant-scoped in-memory repository. Stores snapshots: `save` copies, every read returns a
 * fresh instance without domain events. Insertion order is the listing order.
 * `setProductCount` stands in for the non-archived products of a category.
 */
export class InMemoryCategoryRepository implements CategoryRepositoryPort {
  private readonly store = new Map<string, CategoryProps>();
  private readonly productCounts = new Map<string, number>();
  public saveCount = 0;
  public deleteCount = 0;

  private static key(tenantId: string, categoryId: string): string {
    return `${tenantId}::${categoryId}`;
  }

  /** Test setup helper: stores a snapshot without counting as a `save`. */
  public seed(...categories: Category[]): void {
    for (const category of categories) {
      this.store.set(
        InMemoryCategoryRepository.key(category.getTenantId(), category.getId()),
        snapshotOf(category),
      );
    }
  }

  public setProductCount(id: string, tenantId: string, count: number): void {
    this.productCounts.set(InMemoryCategoryRepository.key(tenantId, id), count);
  }

  private inTenant(tenantId: TenantId): Category[] {
    return [...this.store.values()]
      .filter((props): boolean => props.tenantId === tenantId)
      .map((props): Category => Category.reconstitute(props));
  }

  async save(category: Category): Promise<void> {
    this.saveCount++;
    this.seed(category);
  }

  async deleteById(id: CategoryId, tenantId: TenantId): Promise<void> {
    this.deleteCount++;
    this.store.delete(InMemoryCategoryRepository.key(tenantId, id));
  }

  async findById(id: CategoryId, tenantId: TenantId): Promise<Category | null> {
    const props = this.store.get(InMemoryCategoryRepository.key(tenantId, id));
    return props ? Category.reconstitute(props) : null;
  }

  async countProductsInCategory(id: CategoryId, tenantId: TenantId): Promise<number> {
    return this.productCounts.get(InMemoryCategoryRepository.key(tenantId, id)) ?? 0;
  }

  async findAll(
    tenantId: TenantId,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<Category>> {
    return paginate(this.inTenant(tenantId), pagination);
  }

  async searchByFilters(
    filters: CategoryFilters,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<Category>> {
    const matches = this.inTenant(filters.tenantId).filter(
      (category): boolean =>
        (filters.id === undefined || category.getId() === filters.id) &&
        (filters.name === undefined ||
          category.getName().toLowerCase().includes(filters.name.toLowerCase())) &&
        (filters.status === undefined || category.getStatus() === filters.status),
    );
    return paginate(matches, pagination);
  }

  async searchCategoriesByName(query: string, tenantId: TenantId): Promise<Category[]> {
    return this.inTenant(tenantId).filter((category): boolean =>
      category.getName().toLowerCase().includes(query.toLowerCase()),
    );
  }
}
