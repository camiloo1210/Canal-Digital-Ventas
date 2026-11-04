import type postgres from 'postgres';
import type { TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';
import { ApplicationException } from '@/shared/application/exceptions/application.exception';
import { DomainException } from '@/shared/domain/exceptions/domain.exception';
import { BusinessAccountBoundException } from '@/iam/application/exceptions/business-account-bound.exception';
import { UserManagementRepositoryException } from '@/iam/application/exceptions/user-management-repository.exception';

export type TxSql = postgres.TransactionSql<Record<string, unknown>>;

export function postgresErrorCode(error: unknown): string | null {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code: unknown }).code;
    return typeof code === 'string' ? code : null;
  }
  return null;
}

/** Runs a statement on the transaction connection, wrapping vendor errors in a typed exception. */
export async function runInTx<T>(
  tx: TransactionContext,
  message: string,
  callback: (sql: TxSql) => Promise<T>,
): Promise<T> {
  try {
    return await tx.executeNative<TxSql, T>(callback);
  } catch (error: unknown) {
    if (error instanceof ApplicationException || error instanceof DomainException) throw error;
    // P0004: core.enforce_business_account_single_tenant (membership writes, accept_invitation).
    if (postgresErrorCode(error) === 'P0004') throw new BusinessAccountBoundException();
    throw new UserManagementRepositoryException(message, error);
  }
}
