import type { SyncBuyerCartDto } from '@/carts/application/dtos/buyer-cart.dto';
import type { BuyerCartSyncResult } from '@/carts/application/read-models/buyer-cart.read-model';
import type {
  BuyerCartRecord,
  BuyerCartRepositoryPort,
} from '@/carts/application/ports/out/buyer-cart-repository.port';
import type { BuyerCartCatalogReadPort } from '@/carts/application/ports/out/buyer-cart-catalog-read.port';
import type { TransactionManagerPort } from '@/shared/application/ports/out/transaction-manager.port';
import {
  assertBuyerCartIdentity,
  BuyerCartService,
  defaultClock,
  type Clock,
} from '@/carts/application/services/buyer-cart-service';
import type { NormalizedBuyerCart } from '@/carts/application/services/buyer-cart-normalizer';
import { CartVersionConflictException } from '@/carts/application/exceptions/cart-version-conflict.exception';
import { InvalidBuyerCartInputException } from '@/carts/application/exceptions/invalid-buyer-cart-input.exception';

export class SyncBuyerCartUseCase {
  private readonly service: BuyerCartService;

  constructor(
    carts: BuyerCartRepositoryPort,
    catalog: BuyerCartCatalogReadPort,
    transactions: TransactionManagerPort,
    clock: Clock = defaultClock,
  ) {
    this.service = new BuyerCartService(carts, catalog, transactions, clock);
  }

  public async execute(dto: SyncBuyerCartDto): Promise<BuyerCartSyncResult> {
    assertBuyerCartIdentity(dto.userId, dto.tenantSlug);
    if (dto.baseVersion !== null && (!Number.isInteger(dto.baseVersion) || dto.baseVersion < 0)) {
      throw new InvalidBuyerCartInputException(
        'baseVersion must be null or a non-negative integer.',
      );
    }
    const tenantId = await this.service.requireTenantId(dto.tenantSlug);
    const normalized = await this.service.normalize(tenantId, dto.items, dto.userId);
    return this.service.persist({
      userId: dto.userId,
      tenantId,
      guard: async (live: BuyerCartRecord | null, now: Date): Promise<void> => {
        // No stored (or expired) cart counts as version 0; null means "I have no server state".
        const stale =
          dto.baseVersion === null ? live !== null : dto.baseVersion !== (live ? live.version : 0);
        if (stale) {
          throw new CartVersionConflictException(
            await this.service.viewOf(tenantId, live, now, dto.userId),
          );
        }
      },
      resolve: async (): Promise<NormalizedBuyerCart> => normalized,
    });
  }
}
