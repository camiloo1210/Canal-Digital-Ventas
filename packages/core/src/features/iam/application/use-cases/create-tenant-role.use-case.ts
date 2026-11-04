import type { TenantRoleRepositoryPort } from '@/iam/application/ports/out/tenant-role-repository.port';
import type { TenantOwnershipPort } from '@/iam/application/ports/out/tenant-ownership.port';
import type {
  TransactionContext,
  TransactionManagerPort,
} from '@/shared/application/ports/out/transaction-manager.port';
import { TenantRole } from '@/iam/domain/entities/tenant-role.entity';
import { assertStoreOwner } from '@/iam/application/assert-store-owner';
import { TenantRoleNameTakenException } from '@/iam/application/exceptions/tenant-role-name-taken.exception';

export interface CreateTenantRoleDto {
  userId: string;
  tenantId: string;
  name: string;
  permissions: string[];
}

export class CreateTenantRoleUseCase {
  public constructor(
    private readonly roles: TenantRoleRepositoryPort,
    private readonly ownership: TenantOwnershipPort,
    private readonly transactions: TransactionManagerPort,
    private readonly newId: () => string = (): string => crypto.randomUUID(),
  ) {}

  public async execute(dto: CreateTenantRoleDto): Promise<{ roleId: string }> {
    return this.transactions.runInTransaction(
      async (tx: TransactionContext): Promise<{ roleId: string }> => {
        await assertStoreOwner(this.ownership, dto.userId, dto.tenantId, tx);
        const role = TenantRole.create({
          id: this.newId(),
          tenantId: dto.tenantId,
          name: dto.name,
          permissions: dto.permissions,
        });
        if (await this.roles.nameExists(dto.tenantId, role.getName(), null, tx)) {
          throw new TenantRoleNameTakenException();
        }
        await this.roles.save(role, tx);
        return { roleId: role.getId() };
      },
      { userId: dto.userId, tenantId: dto.tenantId },
    );
  }
}
