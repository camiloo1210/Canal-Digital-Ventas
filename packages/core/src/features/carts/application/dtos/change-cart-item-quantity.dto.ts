import { TenantId } from '@/carts/domain/types/tenant-id.type';
import { CartId } from '@/carts/domain/types/cart-id.type';
import { CartItemId } from '@/carts/domain/types/cart-item-id.type';

export interface ChangeCartItemQuantityDto {
  cartId: CartId;
  tenantId: TenantId;
  itemId: CartItemId;
  quantity: number;
}
