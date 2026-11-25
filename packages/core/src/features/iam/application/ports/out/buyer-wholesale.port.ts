import type { TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';

export interface BuyerWholesalePort {
  setEnabled(userId: string, enabled: boolean, tx: TransactionContext): Promise<void>;
  isEligible(userId: string, tenantId: string, tx: TransactionContext): Promise<boolean>;
}
