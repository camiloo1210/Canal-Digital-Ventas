import type { MembershipRepositoryPort } from '@/iam/application/ports/out/membership-repository.port';
import type { TenantOwnershipPort } from '@/iam/application/ports/out/tenant-ownership.port';
import type {
  TransactionContext,
  TransactionManagerPort,
} from '@/shared/application/ports/out/transaction-manager.port';
import { assertStoreOwner } from '@/iam/application/assert-store-owner';
import { isManagedBy, loadNonOwnerMember } from '@/iam/application/managed-member';

export interface UnlinkMemberDto {
  /** Authenticated actor; must be the store owner. */
  userId: string;
  tenantId: string;
  memberUserId: string;
}

export interface UnlinkMemberResult {
  accountKind: 'MANAGED' | 'PERSONAL';
}

/**
 * Removes the membership. A personal account stays untouched and becomes a regular buyer. For a
 * business-managed account with no other active membership a database trigger on
 * core.tenant_memberships (same transaction) bans the sign-in account and revokes its sessions.
 */
export class UnlinkMemberUseCase {
  public constructor(
    private readonly memberships: MembershipRepositoryPort,
    private readonly ownership: TenantOwnershipPort,
    private readonly transactions: TransactionManagerPort,
  ) {}

  public async execute(dto: UnlinkMemberDto): Promise<UnlinkMemberResult> {
    return this.transactions.runInTransaction(
      async (tx: TransactionContext): Promise<UnlinkMemberResult> => {
        await assertStoreOwner(this.ownership, dto.userId, dto.tenantId, tx);
        const member = await loadNonOwnerMember(
          this.memberships,
          dto.tenantId,
          dto.memberUserId,
          tx,
        );
        await this.memberships.remove(dto.tenantId, dto.memberUserId, tx);
        return { accountKind: isManagedBy(member, dto.tenantId) ? 'MANAGED' : 'PERSONAL' };
      },
      { userId: dto.userId, tenantId: dto.tenantId },
    );
  }
}
