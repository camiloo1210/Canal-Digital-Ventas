import type { TenantOwnershipPort } from '@/iam/application/ports/out/tenant-ownership.port';
import type { TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';
import { UserManagementForbiddenException } from '@/iam/application/exceptions/user-management-forbidden.exception';

/** Server-side anti-IDOR gate shared by every user-management mutation. */
export async function assertStoreOwner(
  ownership: TenantOwnershipPort,
  userId: string,
  tenantId: string,
  tx: TransactionContext,
): Promise<void> {
  if (!(await ownership.isStoreOwner(userId, tenantId, tx))) {
    throw new UserManagementForbiddenException();
  }
}
