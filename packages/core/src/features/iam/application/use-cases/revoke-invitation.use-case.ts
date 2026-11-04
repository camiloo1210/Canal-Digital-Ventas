import type { InvitationRepositoryPort } from '@/iam/application/ports/out/invitation-repository.port';
import type { TenantOwnershipPort } from '@/iam/application/ports/out/tenant-ownership.port';
import type {
  TransactionContext,
  TransactionManagerPort,
} from '@/shared/application/ports/out/transaction-manager.port';
import { assertStoreOwner } from '@/iam/application/assert-store-owner';
import { InvitationNotFoundException } from '@/iam/application/exceptions/invitation-not-found.exception';

export interface RevokeInvitationDto {
  userId: string;
  tenantId: string;
  invitationId: string;
}

export class RevokeInvitationUseCase {
  public constructor(
    private readonly invitations: InvitationRepositoryPort,
    private readonly ownership: TenantOwnershipPort,
    private readonly transactions: TransactionManagerPort,
    private readonly now: () => Date = (): Date => new Date(),
  ) {}

  public async execute(dto: RevokeInvitationDto): Promise<void> {
    await this.transactions.runInTransaction(
      async (tx: TransactionContext): Promise<void> => {
        await assertStoreOwner(this.ownership, dto.userId, dto.tenantId, tx);
        const invitation = await this.invitations.findById(dto.invitationId, dto.tenantId, tx);
        if (!invitation) throw new InvitationNotFoundException();
        invitation.revoke(this.now());
        await this.invitations.save(invitation, tx);
      },
      { userId: dto.userId, tenantId: dto.tenantId },
    );
  }
}
