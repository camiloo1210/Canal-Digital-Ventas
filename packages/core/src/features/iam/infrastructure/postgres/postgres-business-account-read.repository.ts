import type postgres from 'postgres';
import type { BusinessAccountReadPort } from '@/iam/application/ports/out/business-account-read.port';
import { UserManagementRepositoryException } from '@/iam/application/exceptions/user-management-repository.exception';

type Sql = postgres.Sql<Record<string, unknown>>;

/**
 * Reads the single central rule core.is_business_account (executable only by the privileged web
 * database login). The database trigger on core.tenant_memberships remains the authority; this is
 * the early, friendly check.
 */
export class PostgresBusinessAccountReadRepository implements BusinessAccountReadPort {
  public constructor(private readonly sql: Sql) {}

  public async isBusinessAccount(userId: string): Promise<boolean> {
    try {
      const rows = await this.sql<Array<{ bound: boolean }>>`
        SELECT core.is_business_account(${userId}::uuid) AS bound`;
      return rows[0]?.bound === true;
    } catch (error: unknown) {
      throw new UserManagementRepositoryException('Unable to check the account type', error);
    }
  }

  public async isBoundToOtherTenant(userId: string, tenantId: string): Promise<boolean> {
    try {
      const rows = await this.sql<Array<{ bound: boolean }>>`
        SELECT (core.is_business_account(${userId}::uuid)
          AND NOT core.is_business_account(${userId}::uuid, ${tenantId}::uuid)) AS bound`;
      return rows[0]?.bound === true;
    } catch (error: unknown) {
      throw new UserManagementRepositoryException('Unable to check the account type', error);
    }
  }
}
