import { TenantId } from '@/carts/domain/types/tenant-id.type';
import { CartId } from '@/carts/domain/types/cart-id.type';
import { CustomerId } from '@/carts/domain/types/customer-id.type';

export interface AssignCustomerToCartDto {
  cartId: CartId;
  tenantId: TenantId;
  customerId: CustomerId;
}
