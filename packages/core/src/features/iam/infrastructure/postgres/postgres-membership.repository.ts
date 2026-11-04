import type { TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';
import type {
  MemberRecord,
  MembershipRepositoryPort,
} from '@/iam/application/ports/out/membership-repository.port';
import { runInTx, type TxSql } from '@/iam/infrastructure/postgres/user-management-sql';

export class PostgresMembershipRepository implements MembershipRepositoryPort {
  public async find(
    tenantId: string,
    memberUserId: string,
    tx: TransactionContext,
  ): Promise<MemberRecord | null> {
    return runInTx(
      tx,
      'Unable to load the member',
      async (sql: TxSql): Promise<MemberRecord | null> => {
        const rows = await sql<
          MemberRecord[]
        >`SELECT m.user_id AS "userId", m.role AS "baseRole", m.status,
          u.managed_by_tenant_id AS "accountManagedByTenantId"
        FROM core.tenant_memberships m
        JOIN core.users u ON u.id = m.user_id
        WHERE m.tenant_id = ${tenantId}::uuid AND m.user_id = ${memberUserId}::uuid
        FOR UPDATE OF m`;
        return rows[0] ?? null;
      },
    );
  }

  public async assignCustomRole(
    tenantId: string,
    memberUserId: string,
    roleId: string | null,
    tx: TransactionContext,
  ): Promise<void> {
    await runInTx(tx, 'Unable to assign the role', async (sql: TxSql): Promise<void> => {
      await sql`UPDATE core.tenant_memberships
        SET custom_role_id = ${roleId}::uuid, updated_at = now()
        WHERE tenant_id = ${tenantId}::uuid AND user_id = ${memberUserId}::uuid
          AND role <> 'OWNER'`;
    });
  }

  public async remove(
    tenantId: string,
    memberUserId: string,
    tx: TransactionContext,
  ): Promise<void> {
    await runInTx(tx, 'Unable to unlink the member', async (sql: TxSql): Promise<void> => {
      await sql`DELETE FROM core.tenant_memberships
        WHERE tenant_id = ${tenantId}::uuid AND user_id = ${memberUserId}::uuid
          AND role <> 'OWNER'`;
    });
  }

  public async setStatus(
    tenantId: string,
    memberUserId: string,
    status: 'active' | 'suspended',
    tx: TransactionContext,
  ): Promise<void> {
    await runInTx(tx, 'Unable to change the member status', async (sql: TxSql): Promise<void> => {
      await sql`UPDATE core.tenant_memberships
        SET status = ${status}, updated_at = now()
        WHERE tenant_id = ${tenantId}::uuid AND user_id = ${memberUserId}::uuid
          AND role <> 'OWNER'`;
    });
  }

  public async countForUser(memberUserId: string, tx: TransactionContext): Promise<number> {
    return runInTx(tx, 'Unable to count memberships', async (sql: TxSql): Promise<number> => {
      const rows = await sql<Array<{ total: number }>>`SELECT count(*)::int AS total
        FROM core.tenant_memberships WHERE user_id = ${memberUserId}::uuid`;
      return rows[0]?.total ?? 0;
    });
  }
}
