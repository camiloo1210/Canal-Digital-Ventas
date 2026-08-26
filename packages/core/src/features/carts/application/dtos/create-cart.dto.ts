import { TenantId } from '@/carts/domain/types/tenant-id.type';
import { CustomerId } from '@/carts/domain/types/customer-id.type';
import { CartId } from '@/carts/domain/types/cart-id.type';

export interface CreateCartDto {
  id: CartId;
  tenantId: TenantId;
  customerId: CustomerId | null;
  expiresAt: Date;
}
