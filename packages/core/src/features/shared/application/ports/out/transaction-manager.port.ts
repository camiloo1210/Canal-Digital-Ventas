export type TransactionContext = unknown;

export interface TransactionManagerPort {
  /**
   * Executes the provided operation within a transactional boundary.
   * If the operation throws an exception, the transaction is rolled back.
   * If it succeeds, the transaction is committed.
   *
   * @param operation The callback to execute within the transaction, receiving the context.
   * @param options The execution options, including userId to configure RLS inside the transaction.
   */
  runInTransaction<T>(
    operation: (tx: TransactionContext) => Promise<T>,
    options: { userId: string },
  ): Promise<T>;
}
