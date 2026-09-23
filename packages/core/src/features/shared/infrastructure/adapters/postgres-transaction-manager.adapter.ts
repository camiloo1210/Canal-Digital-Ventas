import postgres from 'postgres';
import {
  TransactionManagerPort,
  TransactionContext,
} from '@/shared/application/ports/out/transaction-manager.port';
import { TransactionException } from '@/shared/application/exceptions/transaction.exception';

export class PostgresTransactionManagerAdapter implements TransactionManagerPort {
  constructor(private readonly sql: postgres.Sql<Record<string, unknown>>) {}

  async runInTransaction<T>(
    operation: (tx: TransactionContext) => Promise<T>,
    options: { userId: string },
  ): Promise<T> {
    try {
      return (await this.sql.begin(async (sqlTx) => {
        await sqlTx`
          SELECT set_config(
            'request.jwt.claims',
            ${JSON.stringify({ sub: options.userId })},
            true
          );
        `;

        const context: TransactionContext = {
          executeNative: async <TConnection, TResult>(
            callback: (conn: TConnection) => Promise<TResult>,
          ): Promise<TResult> => {
            return callback(sqlTx as unknown as TConnection);
          },
        };

        return await operation(context);
      })) as T;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new TransactionException(`Transaction failed: ${message}`, error);
    }
  }
}
