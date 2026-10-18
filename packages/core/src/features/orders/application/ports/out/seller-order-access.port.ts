import type { TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';

export interface SellerOrderAccessPort {
  assertCanManage(
    userId: string,
    tenantId: string,
    orderId: string,
    tx: TransactionContext,
  ): Promise<void>;
}
