import { ProductId } from '@/products/domain/types/product-id.type';
import { CategoryId } from '@/products/domain/types/category-id.type';
import { TenantId } from '@/products/domain/types/tenant-id.type';

export interface CreateProductDto {
  id: ProductId;
  name: string;
  price: number;
  cost: number;
  wholesalePrice: number | null;
  description: string;
  stock: number;
  categoryId: CategoryId;
  sku: string;
  tenantId: TenantId;
  seasonIds: string[];
  isVatExempt: boolean;
  image: unknown | null;
}
