import type { TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';
import type { TenantOwnershipPort } from '@/iam/application/ports/out/tenant-ownership.port';
import { runInTx, type TxSql } from '@/iam/infrastructure/postgres/user-management-sql';

export class PostgresTenantOwnershipAdapter implements TenantOwnershipPort {
  public async isStoreOwner(
    userId: string,
    tenantId: string,
    tx: TransactionContext,
  ): Promise<boolean> {
    return runInTx(tx, 'Unable to verify store ownership', async (sql: TxSql): Promise<boolean> => {
      const rows = await sql`SELECT 1 FROM core.tenant_memberships
        WHERE user_id = ${userId}::uuid AND tenant_id = ${tenantId}::uuid
          AND status = 'active' AND role = 'OWNER' FOR SHARE`;
      return rows.length > 0;
    });
  }
}
