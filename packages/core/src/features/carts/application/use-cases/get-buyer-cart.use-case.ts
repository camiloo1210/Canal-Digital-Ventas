import type { GetBuyerCartDto } from '@/carts/application/dtos/buyer-cart.dto';
import type { BuyerCartReadModel } from '@/carts/application/read-models/buyer-cart.read-model';
import type { BuyerCartRepositoryPort } from '@/carts/application/ports/out/buyer-cart-repository.port';
import type { BuyerCartCatalogReadPort } from '@/carts/application/ports/out/buyer-cart-catalog-read.port';
import type { TransactionManagerPort } from '@/shared/application/ports/out/transaction-manager.port';
import {
  assertBuyerCartIdentity,
  BuyerCartService,
  defaultClock,
  type Clock,
} from '@/carts/application/services/buyer-cart-service';

export class GetBuyerCartUseCase {
  private readonly service: BuyerCartService;

  constructor(
    private readonly carts: BuyerCartRepositoryPort,
    catalog: BuyerCartCatalogReadPort,
    transactions: TransactionManagerPort,
    clock: Clock = defaultClock,
  ) {
    this.service = new BuyerCartService(carts, catalog, transactions, clock);
  }

  public async execute(dto: GetBuyerCartDto): Promise<BuyerCartReadModel> {
    assertBuyerCartIdentity(dto.userId, dto.tenantSlug);
    const tenantId = await this.service.requireTenantId(dto.tenantSlug);
    const stored = await this.carts.findActive({ tenantId, buyerUserId: dto.userId });
    return this.service.viewOf(tenantId, stored, this.service.clock(), dto.userId);
  }
}
