import type { BuyerWholesalePort } from '@/iam/application/ports/out/buyer-wholesale.port';
import type {
  TransactionContext,
  TransactionManagerPort,
} from '@/shared/application/ports/out/transaction-manager.port';

export class SetBuyerWholesaleUseCase {
  public constructor(
    private readonly wholesale: BuyerWholesalePort,
    private readonly transactions: TransactionManagerPort,
  ) {}

  public async execute(dto: { userId: string; enabled: boolean }): Promise<void> {
    await this.transactions.runInTransaction(
      (tx: TransactionContext): Promise<void> =>
        this.wholesale.setEnabled(dto.userId, dto.enabled, tx),
      { userId: dto.userId },
    );
  }
}
