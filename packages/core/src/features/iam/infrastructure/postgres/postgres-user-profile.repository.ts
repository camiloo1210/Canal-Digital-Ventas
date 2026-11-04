import type { TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';
import type {
  UserProfileRepositoryPort,
  UserProfileUpdate,
} from '@/iam/application/ports/out/user-profile-repository.port';
import { runInTx, type TxSql } from '@/iam/infrastructure/postgres/user-management-sql';

/**
 * Only the consent flag is stored on the user. Withdrawing it never deletes past samples:
 * they are unlinked from any identity by design.
 */
export class PostgresUserProfileRepository implements UserProfileRepositoryPort {
  public async update(update: UserProfileUpdate, tx: TransactionContext): Promise<void> {
    await runInTx(tx, 'Unable to update the profile', async (sql: TxSql): Promise<void> => {
      await sql`UPDATE core.users
        SET first_name = ${update.firstName}, last_name = ${update.lastName},
            demographic_consent = ${update.demographicConsent},
            demographic_consent_at = ${update.demographicConsentAt},
            updated_at = now()
        WHERE id = ${update.userId}::uuid`;
    });
  }

  public async rename(
    userId: string,
    firstName: string,
    lastName: string,
    tx: TransactionContext,
  ): Promise<void> {
    await runInTx(tx, 'Unable to rename the account', async (sql: TxSql): Promise<void> => {
      await sql`UPDATE core.users
        SET first_name = ${firstName}, last_name = ${lastName}, updated_at = now()
        WHERE id = ${userId}::uuid`;
    });
  }
}
