import { Product } from '@/products/domain/entities/product.entity';
import { ProductStatus } from '@/products/domain/enums/product-status.enum';
import { PaginationOptions, PaginatedResult } from '@/shared/domain/pagination/pagination';
import { ProductId } from '@/products/domain/types/product-id.type';
import { CategoryId } from '@/products/domain/types/category-id.type';
import { TenantId } from '@/shared/domain/types/tenant-id.type';
import { TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';

export interface ProductFilters {
  id?: ProductId;
  name?: string;
  categoryId?: CategoryId;
  sku?: string;
  tenantId: TenantId;
  status?: ProductStatus;
}

export interface ProductRepositoryPort {
  save(product: Product, tx?: TransactionContext): Promise<void>;

  delete(id: ProductId, tenantId: TenantId, tx?: TransactionContext): Promise<void>;

  findById(id: ProductId, tenantId: TenantId, tx?: TransactionContext): Promise<Product | null>;

  findAll(tenantId: TenantId, pagination?: PaginationOptions): Promise<PaginatedResult<Product>>;

  searchByFilters(
    filters: ProductFilters,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<Product>>;

  findByCategoryId(categoryId: CategoryId, tenantId: TenantId): Promise<Product[]>;

  searchProductsByName(query: string, tenantId: TenantId): Promise<Product[]>;
}
