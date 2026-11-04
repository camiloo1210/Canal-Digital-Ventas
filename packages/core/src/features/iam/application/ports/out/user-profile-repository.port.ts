import type { TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';

export interface UserProfileUpdate {
  userId: string;
  firstName: string;
  lastName: string;
  demographicConsent: boolean;
  /** Set when consent is granted, null when withdrawn. */
  demographicConsentAt: Date | null;
}

export interface UserProfileRepositoryPort {
  update(update: UserProfileUpdate, tx: TransactionContext): Promise<void>;
  /** Names only; consent and email are untouched. */
  rename(
    userId: string,
    firstName: string,
    lastName: string,
    tx: TransactionContext,
  ): Promise<void>;
}
