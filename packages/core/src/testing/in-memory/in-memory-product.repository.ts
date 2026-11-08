import { Product, type ProductProps } from '@/products/domain/entities/product.entity';
import { Sku } from '@/products/domain/value-objects/sku.vo';
import { ProductName } from '@/products/domain/value-objects/product-name.vo';
import { createProductId, type ProductId } from '@/products/domain/types/product-id.type';
import { createCategoryId, type CategoryId } from '@/products/domain/types/category-id.type';
import { createTenantId, type TenantId } from '@/shared/domain/types/tenant-id.type';
import { createSeasonId } from '@/products/domain/types/season-id.type';
import type {
  ProductFilters,
  ProductRepositoryPort,
} from '@/products/application/ports/out/product-repository.port';
import type { PaginatedResult, PaginationOptions } from '@/shared/domain/pagination/pagination';

function snapshotOf(product: Product): ProductProps {
  const expiration = product.getExpirationDate();
  return {
    id: createProductId(product.getId()),
    name: ProductName.from(product.getName()),
    price: product.getPrice(),
    cost: product.getCost(),
    wholesalePrice: product.getWholesalePrice(),
    wholesaleMinQuantity: product.getWholesaleMinQuantity(),
    description: product.getDescription(),
    stock: product.getStock(),
    categoryId: createCategoryId(product.getCategory()),
    expirationDate: expiration ? new Date(expiration) : null,
    status: product.getStatus(),
    sku: Sku.from(product.getSku()),
    tenantId: createTenantId(product.getTenantId()),
    seasonIds: product
      .getSeasonIds()
      .map((id): ReturnType<typeof createSeasonId> => createSeasonId(id)),
    imagePath: product.getImagePath(),
    imageUrl: product.getImageUrl(),
    galleryUrls: product.getGalleryUrls(),
    hasVariants: product.getHasVariants(),
    variants: product.getVariants(),
    isVatExempt: product.getIsVatExempt(),
    updatedAt: new Date(product.getUpdatedAt()),
    version: product.getVersion(),
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
 * fresh instance without domain events, so unsaved mutations never leak into the store.
 * Insertion order is the listing order.
 */
export class InMemoryProductRepository implements ProductRepositoryPort {
  private readonly store = new Map<string, ProductProps>();
  public saveCount = 0;
  public deleteCount = 0;

  private static key(tenantId: string, productId: string): string {
    return `${tenantId}::${productId}`;
  }

  /** Test setup helper: stores a snapshot without counting as a `save`. */
  public seed(...products: Product[]): void {
    for (const product of products) {
      this.store.set(
        InMemoryProductRepository.key(product.getTenantId(), product.getId()),
        snapshotOf(product),
      );
    }
  }

  private inTenant(tenantId: TenantId): Product[] {
    return [...this.store.values()]
      .filter((props) => props.tenantId === tenantId)
      .map((props): Product => Product.reconstitute(props));
  }

  async save(product: Product): Promise<void> {
    this.saveCount++;
    this.seed(product);
  }

  async delete(id: ProductId, tenantId: TenantId): Promise<void> {
    this.deleteCount++;
    this.store.delete(InMemoryProductRepository.key(tenantId, id));
  }

  async decreaseStock(id: ProductId, tenantId: TenantId, quantity: number): Promise<void> {
    const product = await this.findById(id, tenantId);
    if (!product) return;
    product.decreaseStock(quantity);
    this.seed(product);
  }

  async increaseStock(id: ProductId, tenantId: TenantId, quantity: number): Promise<void> {
    const props = this.store.get(InMemoryProductRepository.key(tenantId, id));
    if (!props) return;
    this.store.set(InMemoryProductRepository.key(tenantId, id), {
      ...props,
      stock: props.stock + quantity,
    });
  }

  async findById(id: ProductId, tenantId: TenantId): Promise<Product | null> {
    const props = this.store.get(InMemoryProductRepository.key(tenantId, id));
    return props ? Product.reconstitute(props) : null;
  }

  async findAll(
    tenantId: TenantId,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<Product>> {
    return paginate(this.inTenant(tenantId), pagination);
  }

  async searchByFilters(
    filters: ProductFilters,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<Product>> {
    const matches = this.inTenant(filters.tenantId).filter(
      (product): boolean =>
        (filters.id === undefined || product.getId() === filters.id) &&
        (filters.name === undefined ||
          product.getName().toLowerCase().includes(filters.name.toLowerCase())) &&
        (filters.categoryId === undefined || product.getCategory() === filters.categoryId) &&
        (filters.sku === undefined || product.getSku() === filters.sku.trim().toUpperCase()) &&
        (filters.status === undefined || product.getStatus() === filters.status),
    );
    return paginate(matches, pagination);
  }

  async findByCategoryId(categoryId: CategoryId, tenantId: TenantId): Promise<Product[]> {
    return this.inTenant(tenantId).filter(
      (product): boolean => product.getCategory() === categoryId,
    );
  }

  async searchProductsByName(query: string, tenantId: TenantId): Promise<Product[]> {
    return this.inTenant(tenantId).filter((product): boolean =>
      product.getName().toLowerCase().includes(query.toLowerCase()),
    );
  }
}
