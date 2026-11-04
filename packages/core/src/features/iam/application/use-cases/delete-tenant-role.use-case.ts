import type { TenantRoleRepositoryPort } from '@/iam/application/ports/out/tenant-role-repository.port';
import type { TenantOwnershipPort } from '@/iam/application/ports/out/tenant-ownership.port';
import type {
  TransactionContext,
  TransactionManagerPort,
} from '@/shared/application/ports/out/transaction-manager.port';
import { assertStoreOwner } from '@/iam/application/assert-store-owner';
import { TenantRoleNotFoundException } from '@/iam/application/exceptions/tenant-role-not-found.exception';
import { TenantRoleInUseException } from '@/iam/application/exceptions/tenant-role-in-use.exception';

export interface DeleteTenantRoleDto {
  userId: string;
  tenantId: string;
  roleId: string;
}

export class DeleteTenantRoleUseCase {
  public constructor(
    private readonly roles: TenantRoleRepositoryPort,
    private readonly ownership: TenantOwnershipPort,
    private readonly transactions: TransactionManagerPort,
  ) {}

  public async execute(dto: DeleteTenantRoleDto): Promise<void> {
    await this.transactions.runInTransaction(
      async (tx: TransactionContext): Promise<void> => {
        await assertStoreOwner(this.ownership, dto.userId, dto.tenantId, tx);
        const role = await this.roles.findById(dto.roleId, dto.tenantId, tx);
        if (!role) throw new TenantRoleNotFoundException();
        if ((await this.roles.countMembers(dto.roleId, dto.tenantId, tx)) > 0) {
          throw new TenantRoleInUseException();
        }
        await this.roles.delete(dto.roleId, dto.tenantId, tx);
      },
      { userId: dto.userId, tenantId: dto.tenantId },
    );
  }
}
