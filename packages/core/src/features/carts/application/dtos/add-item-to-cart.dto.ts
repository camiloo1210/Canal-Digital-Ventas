import { TenantId } from '@/carts/domain/types/tenant-id.type';
import { CartId } from '@/carts/domain/types/cart-id.type';
import { ProductId } from '@/carts/domain/types/product-id.type';
import { VariantId } from '@/carts/domain/types/variant-id.type';

export interface AddItemToCartDto {
  cartId: CartId;
  tenantId: TenantId;
  productId: ProductId;
  productName: string;
  sku: string;
  quantity: number;
  unitPriceValue: number;
  variantId?: VariantId;
}
