import type { TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';
import type { TenantRole } from '@/iam/domain/entities/tenant-role.entity';

export interface TenantRoleRepositoryPort {
  findById(roleId: string, tenantId: string, tx: TransactionContext): Promise<TenantRole | null>;
  /** Case-insensitive. `excludeRoleId` lets a role keep its own name when edited. */
  nameExists(
    tenantId: string,
    name: string,
    excludeRoleId: string | null,
    tx: TransactionContext,
  ): Promise<boolean>;
  /** Inserts or updates. Implementations map unique violations to TenantRoleNameTakenException. */
  save(role: TenantRole, tx: TransactionContext): Promise<void>;
  delete(roleId: string, tenantId: string, tx: TransactionContext): Promise<void>;
  countMembers(roleId: string, tenantId: string, tx: TransactionContext): Promise<number>;
}
