import 'server-only';
import { sql } from '@/lib/postgres/server';
import {
  CancelOrderUseCase,
  PostgresOrderRepository,
  PostgresOrderPaymentCoordinationAdapter,
  PostgresProductRepository,
  PostgresStoreCustomerRepository,
  PostgresEventBusAdapter,
  PostgresTransactionManagerAdapter,
  PostgresBuyerOrderReadRepository,
  BuyerOrderReadRepositoryPort,
  ChangeOrderStatusUseCase,
  PostgresSellerOrderAccessAdapter,
  PostgresSellerOrderReadRepository,
  type SellerOrderReadRepositoryPort,
} from '@canaldigital/packages/core';

class OrdersDIContainer {
  public resolveChangeOrderStatusUseCase(): ChangeOrderStatusUseCase {
    const events = new PostgresEventBusAdapter();
    return new ChangeOrderStatusUseCase(
      new PostgresOrderRepository(events, sql),
      new PostgresSellerOrderAccessAdapter(),
      new PostgresOrderPaymentCoordinationAdapter(),
      events,
      new PostgresTransactionManagerAdapter(sql),
    );
  }

  public resolveSellerOrderReadRepository(): SellerOrderReadRepositoryPort {
    return new PostgresSellerOrderReadRepository(sql);
  }

  private cancelOrderUseCase: CancelOrderUseCase | null = null;
  private buyerOrderReadRepository: BuyerOrderReadRepositoryPort | null = null;

  public resolveCancelOrderUseCase(): CancelOrderUseCase {
    if (!this.cancelOrderUseCase) {
      const transactionManager = new PostgresTransactionManagerAdapter(sql);
      const eventBus = new PostgresEventBusAdapter();

      const orderRepository = new PostgresOrderRepository(eventBus, sql);
      const productRepository = new PostgresProductRepository(sql);
      const storeCustomerRepository = new PostgresStoreCustomerRepository();

      this.cancelOrderUseCase = new CancelOrderUseCase(
        orderRepository,
        productRepository,
        storeCustomerRepository,
        eventBus,
        transactionManager,
        new PostgresOrderPaymentCoordinationAdapter(),
      );
    }
    return this.cancelOrderUseCase;
  }

  public resolveBuyerOrderReadRepository(): BuyerOrderReadRepositoryPort {
    if (!this.buyerOrderReadRepository) {
      this.buyerOrderReadRepository = new PostgresBuyerOrderReadRepository(sql);
    }
    return this.buyerOrderReadRepository;
  }
}

export const ordersDi = new OrdersDIContainer();
