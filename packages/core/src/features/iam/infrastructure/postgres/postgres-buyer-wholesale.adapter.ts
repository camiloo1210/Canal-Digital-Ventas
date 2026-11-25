import type { BuyerWholesalePort } from '@/iam/application/ports/out/buyer-wholesale.port';
import { UserManagementRepositoryException } from '@/iam/application/exceptions/user-management-repository.exception';
import { runInTx, type TxSql } from '@/iam/infrastructure/postgres/user-management-sql';
import type { TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';

export class PostgresBuyerWholesaleAdapter implements BuyerWholesalePort {
  public async setEnabled(userId: string, enabled: boolean, tx: TransactionContext): Promise<void> {
    await runInTx(tx, 'Unable to update wholesale mode', async (sql: TxSql): Promise<void> => {
      const rows = await sql<
        { id: string }[]
      >`UPDATE core.users SET wholesale_enabled = ${enabled}, updated_at = now() WHERE id = ${userId}::uuid RETURNING id`;
      if (rows.length !== 1) throw new UserManagementRepositoryException('Profile not found');
    });
  }

  public async isEligible(
    userId: string,
    tenantId: string,
    tx: TransactionContext,
  ): Promise<boolean> {
    return runInTx(
      tx,
      'Unable to read wholesale eligibility',
      async (sql: TxSql): Promise<boolean> => {
        const rows = await sql<
          { eligible: boolean }[]
        >`SELECT EXISTS (SELECT 1 FROM core.users WHERE id = ${userId}::uuid AND wholesale_enabled) OR EXISTS (SELECT 1 FROM core.tenant_memberships WHERE user_id = ${userId}::uuid AND tenant_id = ${tenantId}::uuid AND status = 'active') AS eligible`;
        return rows[0]?.eligible === true;
      },
    );
  }
}
