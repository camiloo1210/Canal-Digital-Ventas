import 'server-only';
import { sql } from '@/lib/postgres/server';
import {
  CompleteBuyerCartUseCase,
  GetBuyerCartUseCase,
  MergeBuyerCartUseCase,
  PostgresBuyerCartRepository,
  PostgresBuyerCartCatalogReadRepository,
  PostgresTransactionManagerAdapter,
  SyncBuyerCartUseCase,
} from '@canaldigital/packages/core';

class CartDIContainer {
  public resolveGetBuyerCartUseCase(): GetBuyerCartUseCase {
    return new GetBuyerCartUseCase(
      new PostgresBuyerCartRepository(sql),
      new PostgresBuyerCartCatalogReadRepository(sql),
      new PostgresTransactionManagerAdapter(sql),
    );
  }

  public resolveSyncBuyerCartUseCase(): SyncBuyerCartUseCase {
    return new SyncBuyerCartUseCase(
      new PostgresBuyerCartRepository(sql),
      new PostgresBuyerCartCatalogReadRepository(sql),
      new PostgresTransactionManagerAdapter(sql),
    );
  }

  public resolveMergeBuyerCartUseCase(): MergeBuyerCartUseCase {
    return new MergeBuyerCartUseCase(
      new PostgresBuyerCartRepository(sql),
      new PostgresBuyerCartCatalogReadRepository(sql),
      new PostgresTransactionManagerAdapter(sql),
    );
  }

  public resolveCompleteBuyerCartUseCase(): CompleteBuyerCartUseCase {
    return new CompleteBuyerCartUseCase(
      new PostgresBuyerCartRepository(sql),
      new PostgresTransactionManagerAdapter(sql),
    );
  }

  /** Resolves the active tenant id of a store slug (needed to complete the cart after checkout). */
  public async resolveActiveTenantId(tenantSlug: string): Promise<string | null> {
    return new PostgresBuyerCartCatalogReadRepository(sql).findActiveTenantIdBySlug(tenantSlug);
  }
}

export const cartDi = new CartDIContainer();
