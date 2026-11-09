import { Cart, type CartProps } from '@/carts/domain/entities/cart.entity';
import type { CartId } from '@/carts/domain/types/cart-id.type';
import type { CustomerId } from '@/carts/domain/types/customer-id.type';
import type { TenantId } from '@/shared/domain/types/tenant-id.type';
import { CartStatus } from '@/carts/domain/enums/cart-status.enum';
import type { CartRepositoryPort } from '@/carts/application/ports/out/cart-repository.port';

function snapshotOf(cart: Cart): CartProps {
  return {
    id: cart.getId(),
    tenantId: cart.getTenantId(),
    customerId: cart.getCustomerId(),
    items: cart.getItems(),
    status: cart.getStatus(),
    subtotal: cart.getSubtotal(),
    expiresAt: new Date(cart.getExpiresAt()),
    createdAt: new Date(cart.getCreatedAt()),
    updatedAt: new Date(cart.getUpdatedAt()),
    version: cart.getVersion(),
  };
}

/**
 * Tenant-scoped in-memory cart repository. Stores snapshots: `save` copies, every read returns
 * a fresh instance without domain events, so unsaved mutations never leak into the store.
 */
export class InMemoryCartRepository implements CartRepositoryPort {
  private readonly store = new Map<string, CartProps>();
  public saveCount = 0;
  public deleteCount = 0;

  private static key(tenantId: string, cartId: string): string {
    return `${tenantId}::${cartId}`;
  }

  /** Test setup helper: stores a snapshot without counting as a `save`. */
  public seed(...carts: Cart[]): void {
    for (const cart of carts) {
      this.store.set(
        InMemoryCartRepository.key(cart.getTenantId(), cart.getId()),
        snapshotOf(cart),
      );
    }
  }

  async save(cart: Cart): Promise<void> {
    this.saveCount++;
    this.seed(cart);
  }

  async findById(id: CartId, tenantId: TenantId): Promise<Cart | null> {
    const props = this.store.get(InMemoryCartRepository.key(tenantId, id));
    return props ? Cart.reconstitute(props) : null;
  }

  async findActiveByCustomerId(customerId: CustomerId, tenantId: TenantId): Promise<Cart | null> {
    const match = [...this.store.values()].find(
      (props): boolean =>
        props.tenantId === tenantId &&
        props.customerId === customerId &&
        props.status === CartStatus.ACTIVE,
    );
    return match ? Cart.reconstitute(match) : null;
  }

  async delete(id: CartId, tenantId: TenantId): Promise<void> {
    this.deleteCount++;
    this.store.delete(InMemoryCartRepository.key(tenantId, id));
  }
}
