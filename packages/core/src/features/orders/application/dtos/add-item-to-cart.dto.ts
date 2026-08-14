import { CustomerId } from '@/orders/domain/types/customer-id.type';
import { TenantId } from '@/orders/domain/types/tenant-id.type';
import { ProductId } from '@/orders/domain/types/product-id.type';
import { VariantId } from '@/orders/domain/types/variant-id.type';

export interface AddItemToCartDto {
  customerId: CustomerId;
  tenantId: TenantId;
  productId: ProductId;
  productName: string;
  sku: string;
  quantity: number;
  unitPriceValue: number;
  variantId?: VariantId;
}
