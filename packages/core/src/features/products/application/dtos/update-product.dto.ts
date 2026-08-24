import { ProductId } from '@/products/domain/types/product-id.type';
import { CategoryId } from '@/products/domain/types/category-id.type';
import { TenantId } from '@/products/domain/types/tenant-id.type';

export interface UpdateProductDto {
  id: ProductId;
  tenantId: TenantId;
  name?: string;
  price?: number;
  cost?: number;
  wholesalePrice?: number;
  description?: string;
  stock?: number;
  categoryId?: CategoryId;
  sku?: string;
  seasonIds?: string[];
  isVatExempt?: boolean;
  status?: string;
  expirationDate?: string;
  imagePath?: string;
  imageUrl?: string;
  image?: unknown;
  hasVariants?: boolean;
  variants?: unknown[];
}
