import type { MergeBuyerCartDto } from '@/carts/application/dtos/buyer-cart.dto';
import type { BuyerCartSyncResult } from '@/carts/application/read-models/buyer-cart.read-model';
import type {
  BuyerCartRecord,
  BuyerCartRepositoryPort,
  BuyerCartStoredLine,
} from '@/carts/application/ports/out/buyer-cart-repository.port';
import type { BuyerCartCatalogReadPort } from '@/carts/application/ports/out/buyer-cart-catalog-read.port';
import type { TransactionManagerPort } from '@/shared/application/ports/out/transaction-manager.port';
import {
  assertBuyerCartIdentity,
  BuyerCartService,
  defaultClock,
  type Clock,
} from '@/carts/application/services/buyer-cart-service';
import type {
  CartLineCandidate,
  NormalizedBuyerCart,
} from '@/carts/application/services/buyer-cart-normalizer';

/** One-shot merge after login: union of server and guest lines, max quantity per product. */
export class MergeBuyerCartUseCase {
  private readonly service: BuyerCartService;

  constructor(
    carts: BuyerCartRepositoryPort,
    catalog: BuyerCartCatalogReadPort,
    transactions: TransactionManagerPort,
    clock: Clock = defaultClock,
  ) {
    this.service = new BuyerCartService(carts, catalog, transactions, clock);
  }

  public async execute(dto: MergeBuyerCartDto): Promise<BuyerCartSyncResult> {
    assertBuyerCartIdentity(dto.userId, dto.tenantSlug);
    const tenantId = await this.service.requireTenantId(dto.tenantSlug);
    return this.service.persist({
      userId: dto.userId,
      tenantId,
      // Server lines first: they keep their position and win the line cap; dedupe keeps the max.
      resolve: async (live: BuyerCartRecord | null): Promise<NormalizedBuyerCart> =>
        this.service.normalize(tenantId, [
          ...(live?.lines ?? []).map((line: BuyerCartStoredLine): CartLineCandidate => ({
            productId: line.productId,
            quantity: line.quantity,
          })),
          ...dto.items,
        ]),
    });
  }
}
