import type { TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';
import type {
  SignupDemographicsCommand,
  SignupDemographicsPort,
} from '@/iam/application/ports/out/signup-demographics.port';
import { runInTx, type TxSql } from '@/iam/infrastructure/postgres/user-management-sql';

/** Calls the SECURITY DEFINER core.record_signup_demographics RPC. */
export class PostgresSignupDemographicsAdapter implements SignupDemographicsPort {
  public async record(command: SignupDemographicsCommand, tx: TransactionContext): Promise<void> {
    await runInTx(tx, 'Unable to record signup demographics', async (sql: TxSql): Promise<void> => {
      await sql`SELECT core.record_signup_demographics(
        ${command.userId}::uuid, ${command.consent}, ${command.tenantId}::uuid,
        ${command.ageRange}, ${command.gender}, ${command.province})`;
    });
  }
}
