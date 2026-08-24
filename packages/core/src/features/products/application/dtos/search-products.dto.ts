import { PaginationOptions } from '@/shared/domain/pagination/pagination';
import { ProductId } from '@/products/domain/types/product-id.type';
import { CategoryId } from '@/products/domain/types/category-id.type';
import { TenantId } from '@/products/domain/types/tenant-id.type';

export interface SearchProductsDto {
  id?: ProductId;
  name?: string;
  categoryId?: CategoryId;
  sku?: string;
  tenantId: TenantId;
  status?: string;
  pagination?: PaginationOptions;
}
