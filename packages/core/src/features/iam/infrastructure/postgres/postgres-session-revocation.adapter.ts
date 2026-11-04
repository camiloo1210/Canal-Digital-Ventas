import type postgres from 'postgres';
import type { SessionRevocationPort } from '@/iam/application/ports/out/session-revocation.port';
import { UserManagementRepositoryException } from '@/iam/application/exceptions/user-management-repository.exception';

/**
 * Calls the narrow SECURITY DEFINER function core.revoke_user_sessions on the pool, as its own
 * statement (deliberately outside any application transaction).
 */
export class PostgresSessionRevocationAdapter implements SessionRevocationPort {
  public constructor(private readonly sql: postgres.Sql<Record<string, unknown>>) {}

  public async revokeSessions(userId: string): Promise<void> {
    try {
      await this.sql`SELECT core.revoke_user_sessions(${userId}::uuid)`;
    } catch (error: unknown) {
      throw new UserManagementRepositoryException('Unable to revoke account sessions', error);
    }
  }
}
