import { ProductId } from '@/products/domain/types/product-id.type';
import { TenantId } from '@/products/domain/types/tenant-id.type';

export interface DeleteProductDto {
  id: ProductId;
  tenantId: TenantId;
}
