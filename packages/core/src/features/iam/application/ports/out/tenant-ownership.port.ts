import type { TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';

export interface TenantOwnershipPort {
  isStoreOwner(userId: string, tenantId: string, tx: TransactionContext): Promise<boolean>;
}
