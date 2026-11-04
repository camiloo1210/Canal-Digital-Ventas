import type { TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';

export interface SignupDemographicsCommand {
  userId: string;
  consent: boolean;
  ageRange: string | null;
  gender: string | null;
  province: string | null;
  tenantId: string | null;
}

export interface SignupDemographicsPort {
  /** Records consent and one unlinked sample. Callers must not invoke it without consent. */
  record(command: SignupDemographicsCommand, tx: TransactionContext): Promise<void>;
}
