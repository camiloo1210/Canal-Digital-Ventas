import { Cart } from '@/carts/domain/entities/cart.entity';
import { CartId } from '@/carts/domain/types/cart-id.type';
import { CustomerId } from '@/carts/domain/types/customer-id.type';
import { TenantId } from '@/carts/domain/types/tenant-id.type';

export interface CartRepositoryPort {
  save(cart: Cart): Promise<void>;

  findById(id: CartId, tenantId: TenantId): Promise<Cart | null>;

  findActiveByCustomerId(customerId: CustomerId, tenantId: TenantId): Promise<Cart | null>;

  delete(id: CartId, tenantId: TenantId): Promise<void>;
}
