import 'server-only';
import { sql } from '@/lib/postgres/server';
import { createClient as createSupabaseServerClient } from '@/lib/supabase/server';
import { trackingSandboxConfig } from '@/features/orders/server/tracking-sandbox-config';
import { isShipmentCreationEnabled } from '@/features/orders/server/shipment-creation-sandbox-config';
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
  PostgresShipmentJobQueueAdapter,
  PostgresSellerOrderAccessAdapter,
  PostgresSellerOrderReadRepository,
  type SellerOrderReadRepositoryPort,
  RetryShipmentUseCase,
  GetLabelUrlUseCase,
  PostgresShipmentJobRepository,
  PostgresShipmentLabelReadAdapter,
  SupabaseLabelStorageAdapter,
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
      // Only the sandbox worker consumes jobs: never enqueue outside an opted-in sandbox deployment.
      isShipmentCreationEnabled(process.env) ? new PostgresShipmentJobQueueAdapter() : undefined,
    );
  }

  public resolveRetryShipmentUseCase(): RetryShipmentUseCase {
    return new RetryShipmentUseCase(
      new PostgresSellerOrderAccessAdapter(),
      new PostgresShipmentJobRepository(sql),
      new PostgresTransactionManagerAdapter(sql),
    );
  }

  /**
   * Signs with the seller's own session: the private label bucket only lets active members of the
   * folder's tenant with VIEW/MANAGE_ORDERS read, so no service-role key is needed in the web app.
   */
  public async resolveGetLabelUrlUseCase(): Promise<GetLabelUrlUseCase> {
    const supabase = await createSupabaseServerClient();
    return new GetLabelUrlUseCase(
      new PostgresSellerOrderAccessAdapter(),
      new PostgresShipmentLabelReadAdapter(),
      new SupabaseLabelStorageAdapter(supabase.storage),
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
