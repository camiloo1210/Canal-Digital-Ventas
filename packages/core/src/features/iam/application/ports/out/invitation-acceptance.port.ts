import type { TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';

export interface InvitationAcceptanceCommand {
  tokenHash: string;
  userId: string;
  consent: boolean;
  ageRange: string | null;
  gender: string | null;
  province: string | null;
  firstName: string | null;
  lastName: string | null;
}

export interface InvitationAcceptanceResult {
  tenantId: string;
  roleId: string;
}

export interface InvitationAcceptancePort {
  /** Atomic. Throws InvitationNotUsableException or AlreadyMemberException. */
  accept(
    command: InvitationAcceptanceCommand,
    tx: TransactionContext,
  ): Promise<InvitationAcceptanceResult>;
}
