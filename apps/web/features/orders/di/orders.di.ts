import 'server-only';
import { sql } from '@/lib/postgres/server';
import { trackingSandboxConfig } from '@/features/orders/server/tracking-sandbox-config';
import {
  CancelOrderUseCase,
  RegisterManualShipmentUseCase,
  EnableTrackingUseCase,
  DisableTrackingUseCase,
  PostgresTrackingActivationAdapter,
  PostgresTrackingInvalidationAdapter,
  PostgresBuyerTrackingReadAdapter,
  type BuyerTrackingReadPort,
  PostgresSellerTrackingReadAdapter,
  type SellerTrackingReadPort,
  PostgresManualShipmentRepository,
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
  public resolveBuyerTracking(): {
    readonly repository: BuyerTrackingReadPort;
    readonly deploymentId: string;
  } | null {
    const config = trackingSandboxConfig(process.env);
    return config
      ? {
          repository: new PostgresBuyerTrackingReadAdapter(sql, new Date().toISOString()),
          deploymentId: config.deploymentId,
        }
      : null;
  }
  public resolveSellerTracking(): {
    readonly repository: SellerTrackingReadPort;
    readonly deploymentId: string;
  } | null {
    const config = trackingSandboxConfig(process.env);
    return config
      ? {
          repository: new PostgresSellerTrackingReadAdapter(sql, new Date().toISOString()),
          deploymentId: config.deploymentId,
        }
      : null;
  }
  public resolveDisableTrackingUseCase(): DisableTrackingUseCase | null {
    const config = trackingSandboxConfig(process.env);
    if (!config) return null;
    return new DisableTrackingUseCase(
      new PostgresSellerOrderAccessAdapter(),
      new PostgresTrackingActivationAdapter(
        (tenantId): string | null => config.refs[tenantId] ?? null,
        config.deploymentId,
      ),
      new PostgresTransactionManagerAdapter(sql),
      true,
    );
  }
  public resolveEnableTrackingUseCase(): EnableTrackingUseCase | null {
    const config = trackingSandboxConfig(process.env);
    if (!config) return null;
    return new EnableTrackingUseCase(
      new PostgresSellerOrderAccessAdapter(),
      new PostgresTrackingActivationAdapter(
        (tenantId): string | null => config.refs[tenantId] ?? null,
        config.deploymentId,
      ),
      new PostgresTransactionManagerAdapter(sql),
      true,
    );
  }
  public resolveRegisterManualShipmentUseCase(): RegisterManualShipmentUseCase {
    return new RegisterManualShipmentUseCase(
      new PostgresSellerOrderAccessAdapter(),
      new PostgresOrderRepository(new PostgresEventBusAdapter(), sql),
      new PostgresManualShipmentRepository(),
      new PostgresTransactionManagerAdapter(sql),
      process.env.SHIPMENT_NOTIFICATIONS_ENABLED === 'true' ? new PostgresEventBusAdapter() : null,
      trackingSandboxConfig(process.env) ? new PostgresTrackingInvalidationAdapter() : null,
    );
  }

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
