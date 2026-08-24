import { Product } from '@/products/domain/entities/product.entity';
import { ProductStatus } from '@/products/domain/enums/product-status.enum';
import { PaginationOptions, PaginatedResult } from '@/shared/domain/pagination/pagination';
import { ProductId } from '@/products/domain/types/product-id.type';
import { CategoryId } from '@/products/domain/types/category-id.type';
import { TenantId } from '@/products/domain/types/tenant-id.type';

export interface ProductFilters {
  id?: ProductId;
  name?: string;
  categoryId?: CategoryId;
  sku?: string;
  tenantId: TenantId;
  status?: ProductStatus;
}

export interface ProductRepositoryPort {
  save(product: Product): Promise<void>;

  delete(id: ProductId, tenantId: TenantId): Promise<void>;

  findById(id: ProductId, tenantId: TenantId): Promise<Product | null>;

  findAll(tenantId: TenantId, pagination?: PaginationOptions): Promise<PaginatedResult<Product>>;

  searchByFilters(
    filters: ProductFilters,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<Product>>;

  findByCategoryId(categoryId: CategoryId, tenantId: TenantId): Promise<Product[]>;

  searchProductsByName(query: string, tenantId: TenantId): Promise<Product[]>;
}
