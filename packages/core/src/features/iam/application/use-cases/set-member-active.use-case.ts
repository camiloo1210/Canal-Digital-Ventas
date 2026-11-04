import type { MembershipRepositoryPort } from '@/iam/application/ports/out/membership-repository.port';
import type { TenantOwnershipPort } from '@/iam/application/ports/out/tenant-ownership.port';
import type {
  TransactionContext,
  TransactionManagerPort,
} from '@/shared/application/ports/out/transaction-manager.port';
import { assertStoreOwner } from '@/iam/application/assert-store-owner';
import { assertManagedBy, loadNonOwnerMember } from '@/iam/application/managed-member';

export interface SetMemberActiveDto {
  userId: string;
  tenantId: string;
  memberUserId: string;
  active: boolean;
}

/**
 * Only the membership status changes here. A database trigger on core.tenant_memberships, in the
 * same transaction, bans or unbans the sign-in account of business-managed users.
 */
export class SetMemberActiveUseCase {
  public constructor(
    private readonly memberships: MembershipRepositoryPort,
    private readonly ownership: TenantOwnershipPort,
    private readonly transactions: TransactionManagerPort,
  ) {}

  public async execute(dto: SetMemberActiveDto): Promise<void> {
    return this.transactions.runInTransaction(
      async (tx: TransactionContext): Promise<void> => {
        await assertStoreOwner(this.ownership, dto.userId, dto.tenantId, tx);
        const member = await loadNonOwnerMember(
          this.memberships,
          dto.tenantId,
          dto.memberUserId,
          tx,
        );
        assertManagedBy(member, dto.tenantId);
        await this.memberships.setStatus(
          dto.tenantId,
          dto.memberUserId,
          dto.active ? 'active' : 'suspended',
          tx,
        );
      },
      { userId: dto.userId, tenantId: dto.tenantId },
    );
  }
}
