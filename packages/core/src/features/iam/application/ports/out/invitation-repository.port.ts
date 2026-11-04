import type { TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';
import type { Invitation } from '@/iam/domain/entities/invitation.entity';

export interface InvitationRepositoryPort {
  findById(
    invitationId: string,
    tenantId: string,
    tx: TransactionContext,
  ): Promise<Invitation | null>;
  save(invitation: Invitation, tx: TransactionContext): Promise<void>;
}
