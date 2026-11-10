import type { TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';
import type {
  ShippingOrigin,
  ShippingOriginProps,
} from '@/tenants/domain/value-objects/shipping-origin.vo';

export interface ShippingOriginRepositoryPort {
  /** True when the user is an active member holding the store-settings manage permission. */
  canManageStore(userId: string, tenantId: string, tx: TransactionContext): Promise<boolean>;
  save(tenantId: string, origin: ShippingOrigin, tx: TransactionContext): Promise<void>;
  find(tenantId: string): Promise<ShippingOriginProps | null>;
}
