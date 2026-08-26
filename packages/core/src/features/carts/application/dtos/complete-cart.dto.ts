import { TenantId } from '@/carts/domain/types/tenant-id.type';
import { CartId } from '@/carts/domain/types/cart-id.type';

export interface CompleteCartDto {
  cartId: CartId;
  tenantId: TenantId;
}
