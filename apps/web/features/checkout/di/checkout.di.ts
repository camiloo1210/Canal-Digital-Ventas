import 'server-only';
import { sql } from '@/lib/postgres/server';
import {
  GenerateCommercialOrderUseCase,
  PostgresOrderRepository,
  PostgresProductRepository,
  LocalEventBus,
  PostgresTransactionManagerAdapter,
  PostgresOrderTenantRepository,
} from '@canaldigital/packages/core';

class CheckoutDIContainer {
  private generateCommercialOrderUseCase: GenerateCommercialOrderUseCase | null = null;

  public async resolveGenerateCommercialOrderUseCase(): Promise<GenerateCommercialOrderUseCase> {
    if (!this.generateCommercialOrderUseCase) {
      const transactionManager = new PostgresTransactionManagerAdapter(sql);
      const eventBus = new LocalEventBus();

      const orderRepository = new PostgresOrderRepository(eventBus);
      const productRepository = new PostgresProductRepository(sql);
      const orderTenantRepository = new PostgresOrderTenantRepository();

      this.generateCommercialOrderUseCase = new GenerateCommercialOrderUseCase(
        orderRepository,
        productRepository,
        orderTenantRepository,
        transactionManager,
      );
    }
    return this.generateCommercialOrderUseCase;
  }
}

export const checkoutDi = new CheckoutDIContainer();
