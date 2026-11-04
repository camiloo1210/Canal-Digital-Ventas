import type { TenantRoleRepositoryPort } from '@/iam/application/ports/out/tenant-role-repository.port';
import type { TenantOwnershipPort } from '@/iam/application/ports/out/tenant-ownership.port';
import type {
  TransactionContext,
  TransactionManagerPort,
} from '@/shared/application/ports/out/transaction-manager.port';
import { assertStoreOwner } from '@/iam/application/assert-store-owner';
import { TenantRoleNotFoundException } from '@/iam/application/exceptions/tenant-role-not-found.exception';
import { TenantRoleNameTakenException } from '@/iam/application/exceptions/tenant-role-name-taken.exception';

export interface UpdateTenantRoleDto {
  userId: string;
  tenantId: string;
  roleId: string;
  name: string;
  permissions: string[];
}

export class UpdateTenantRoleUseCase {
  public constructor(
    private readonly roles: TenantRoleRepositoryPort,
    private readonly ownership: TenantOwnershipPort,
    private readonly transactions: TransactionManagerPort,
  ) {}

  public async execute(dto: UpdateTenantRoleDto): Promise<void> {
    await this.transactions.runInTransaction(
      async (tx: TransactionContext): Promise<void> => {
        await assertStoreOwner(this.ownership, dto.userId, dto.tenantId, tx);
        const role = await this.roles.findById(dto.roleId, dto.tenantId, tx);
        if (!role) throw new TenantRoleNotFoundException();
        role.rename(dto.name);
        role.setPermissions(dto.permissions);
        if (await this.roles.nameExists(dto.tenantId, role.getName(), role.getId(), tx)) {
          throw new TenantRoleNameTakenException();
        }
        await this.roles.save(role, tx);
      },
      { userId: dto.userId, tenantId: dto.tenantId },
    );
  }
}
