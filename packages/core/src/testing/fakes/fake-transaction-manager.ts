import type {
  TransactionContext,
  TransactionManagerPort,
} from '@/shared/application/ports/out/transaction-manager.port';

/** Transaction context whose native connection is an empty placeholder object. */
export class FakeTransactionContext implements TransactionContext {
  async executeNative<TConnection, TResult>(
    callback: (conn: TConnection) => Promise<TResult>,
  ): Promise<TResult> {
    return callback(Object.create(null) as TConnection);
  }
}

/** Runs the operation inline and records commit / rollback, rethrowing failures. */
export class FakeTransactionManager implements TransactionManagerPort {
  public readonly calls: { userId: string; tenantId?: string }[] = [];
  public committed = 0;
  public rolledBack = 0;

  async runInTransaction<T>(
    operation: (tx: TransactionContext) => Promise<T>,
    options: { userId: string; tenantId?: string },
  ): Promise<T> {
    this.calls.push({ ...options });
    try {
      const result = await operation(new FakeTransactionContext());
      this.committed++;
      return result;
    } catch (error: unknown) {
      this.rolledBack++;
      throw error;
    }
  }
}
