import type { MembershipRepositoryPort } from '@/iam/application/ports/out/membership-repository.port';
import type { TenantRoleRepositoryPort } from '@/iam/application/ports/out/tenant-role-repository.port';
import type { TenantOwnershipPort } from '@/iam/application/ports/out/tenant-ownership.port';
import type {
  TransactionContext,
  TransactionManagerPort,
} from '@/shared/application/ports/out/transaction-manager.port';
import { assertStoreOwner } from '@/iam/application/assert-store-owner';
import { MemberNotFoundException } from '@/iam/application/exceptions/member-not-found.exception';
import { MemberNotActiveException } from '@/iam/application/exceptions/member-not-active.exception';
import { ProtectedMemberException } from '@/iam/application/exceptions/protected-member.exception';
import { TenantRoleNotFoundException } from '@/iam/application/exceptions/tenant-role-not-found.exception';

export interface AssignMemberRoleDto {
  /** Authenticated actor; must be the store owner. */
  userId: string;
  tenantId: string;
  memberUserId: string;
  /** Tenant role to assign, or null to clear the member's role. */
  roleId: string | null;
}

export class AssignMemberRoleUseCase {
  public constructor(
    private readonly memberships: MembershipRepositoryPort,
    private readonly roles: TenantRoleRepositoryPort,
    private readonly ownership: TenantOwnershipPort,
    private readonly transactions: TransactionManagerPort,
  ) {}

  public async execute(dto: AssignMemberRoleDto): Promise<void> {
    await this.transactions.runInTransaction(
      async (tx: TransactionContext): Promise<void> => {
        await assertStoreOwner(this.ownership, dto.userId, dto.tenantId, tx);
        const member = await this.memberships.find(dto.tenantId, dto.memberUserId, tx);
        if (!member) throw new MemberNotFoundException();
        if (member.baseRole === 'OWNER') throw new ProtectedMemberException();
        if (member.status !== 'active') throw new MemberNotActiveException();
        if (dto.roleId !== null) {
          const role = await this.roles.findById(dto.roleId, dto.tenantId, tx);
          if (!role) throw new TenantRoleNotFoundException();
        }
        await this.memberships.assignCustomRole(dto.tenantId, dto.memberUserId, dto.roleId, tx);
      },
      { userId: dto.userId, tenantId: dto.tenantId },
    );
  }
}
