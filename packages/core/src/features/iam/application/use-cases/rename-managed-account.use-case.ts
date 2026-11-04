import type { MembershipRepositoryPort } from '@/iam/application/ports/out/membership-repository.port';
import type { UserProfileRepositoryPort } from '@/iam/application/ports/out/user-profile-repository.port';
import type { TenantOwnershipPort } from '@/iam/application/ports/out/tenant-ownership.port';
import type {
  TransactionContext,
  TransactionManagerPort,
} from '@/shared/application/ports/out/transaction-manager.port';
import { assertStoreOwner } from '@/iam/application/assert-store-owner';
import { assertManagedBy, loadNonOwnerMember } from '@/iam/application/managed-member';
import { PersonName } from '@/shared/domain/value-objects/person-name.vo';

export interface RenameManagedAccountDto {
  userId: string;
  tenantId: string;
  memberUserId: string;
  firstName: string;
  lastName: string;
}

/** Only names change; the login email of a managed account stays as generated. */
export class RenameManagedAccountUseCase {
  public constructor(
    private readonly memberships: MembershipRepositoryPort,
    private readonly profiles: UserProfileRepositoryPort,
    private readonly ownership: TenantOwnershipPort,
    private readonly transactions: TransactionManagerPort,
  ) {}

  public async execute(dto: RenameManagedAccountDto): Promise<void> {
    const firstName = PersonName.create(dto.firstName).getValue();
    const lastName = PersonName.create(dto.lastName).getValue();
    await this.transactions.runInTransaction(
      async (tx: TransactionContext): Promise<void> => {
        await assertStoreOwner(this.ownership, dto.userId, dto.tenantId, tx);
        const member = await loadNonOwnerMember(
          this.memberships,
          dto.tenantId,
          dto.memberUserId,
          tx,
        );
        assertManagedBy(member, dto.tenantId);
        await this.profiles.rename(dto.memberUserId, firstName, lastName, tx);
      },
      { userId: dto.userId, tenantId: dto.tenantId },
    );
  }
}
