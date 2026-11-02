import type { CompleteBuyerCartDto } from '@/carts/application/dtos/buyer-cart.dto';
import type { BuyerCartRepositoryPort } from '@/carts/application/ports/out/buyer-cart-repository.port';
import type {
  TransactionContext,
  TransactionManagerPort,
} from '@/shared/application/ports/out/transaction-manager.port';
import {
  assertBuyerCartIdentity,
  defaultClock,
  type Clock,
} from '@/carts/application/services/buyer-cart-service';

/** Marks the buyer's active cart as converted after a successful order. No-op without a cart. */
export class CompleteBuyerCartUseCase {
  constructor(
    private readonly carts: BuyerCartRepositoryPort,
    private readonly transactions: TransactionManagerPort,
    private readonly clock: Clock = defaultClock,
  ) {}

  public async execute(dto: CompleteBuyerCartDto): Promise<void> {
    assertBuyerCartIdentity(dto.userId, dto.tenantId);
    await this.transactions.runInTransaction(
      async (tx: TransactionContext): Promise<void> => {
        await this.carts.markConverted(
          { tenantId: dto.tenantId, buyerUserId: dto.userId, now: this.clock() },
          tx,
        );
      },
      { userId: dto.userId, tenantId: dto.tenantId },
    );
  }
}
