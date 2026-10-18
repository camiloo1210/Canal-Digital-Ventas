import { OrderRepositoryPort } from '@/orders/application/ports/out/order-repository.port';
import { ProductRepositoryPort } from '@/products/application/ports/out/product-repository.port';
import { StoreCustomerRepositoryPort } from '@/sales/application/ports/out/store-customer-repository.port';
import { EventBusPort } from '@/shared/application/ports/out/event-bus.port';
import { TransactionManagerPort } from '@/shared/application/ports/out/transaction-manager.port';
import { CancelOrderDto } from '@/orders/application/dtos/cancel-order.dto';
import { OrderNotFoundException } from '@/orders/application/exceptions/order-not-found.exception';
import { createOrderId } from '@/orders/domain/types/order-id.type';
import { createGlobalAuthId } from '@/sales/domain/types/global-auth-id.type';
import { ORDER_AGGREGATE_TYPE } from '@/orders/application/outbox/order-aggregate.constants';
import type { OrderPaymentCoordinationPort } from '@/orders/application/ports/out/order-payment-coordination.port';
import type { OrderItem } from '@/orders/domain/entities/order-item.entity';
import { InvalidOrderStateException } from '@/orders/domain/exceptions/invalid-order-state.exception';

export class CancelOrderUseCase {
  constructor(
    private readonly orderRepository: OrderRepositoryPort,
    private readonly productRepository: ProductRepositoryPort,
    private readonly storeCustomerRepository: StoreCustomerRepositoryPort,
    private readonly eventBus: EventBusPort,
    private readonly transactionManager: TransactionManagerPort,
    private readonly paymentCoordination: OrderPaymentCoordinationPort,
  ) {}

  async execute(dto: CancelOrderDto): Promise<void> {
    const orderId = createOrderId(dto.orderId);
    const globalAuthId = createGlobalAuthId(dto.authenticatedBuyerId);

    await this.transactionManager.runInTransaction(
      async (tx): Promise<void> => {
        const payment = await this.paymentCoordination.lockAndReadPayment(orderId, tx);
        // 1. Fetch the order within the transaction
        const order = await this.orderRepository.findById(orderId, undefined, tx);
        if (!order) {
          throw new OrderNotFoundException();
        }

        // 2. Anti-IDOR: Verify that the customer associated with the order belongs to this authenticated user in this tenant
        const customer = await this.storeCustomerRepository.findByGlobalAuthId(
          globalAuthId,
          order.getTenantId(),
          tx,
        );

        if (!customer || (customer.getId() as string) !== (order.getCustomerId() as string)) {
          // Unified error to avoid leaking existence of resources
          throw new OrderNotFoundException();
        }

        if (
          payment &&
          !['pending', 'failed', 'expired_unpaid_awaiting_reconciliation'].includes(payment.status)
        ) {
          throw new InvalidOrderStateException(
            'A collected payment requires the refund workflow before cancellation.',
          );
        }

        // 3. Pre-cancellation check for inventory restoration
        const shouldRestore = order.shouldRestoreInventory();

        // 4. Cancel the domain entity (strict whitelist CONFIRMED / PROCESSING)
        order.cancel();

        // 5. Persist the updated order state (optimistic locking enforced)
        await this.orderRepository.save(order, tx);

        // 6. Conditional stock restoration (strictly arithmetic, zero status mutation)
        if (shouldRestore) {
          const items = order
            .getItems()
            .sort((left: OrderItem, right: OrderItem): number =>
              left.getProductId().localeCompare(right.getProductId()),
            );
          for (const item of items) {
            await this.productRepository.increaseStock(
              item.getProductId(),
              order.getTenantId(),
              item.getQuantity(),
              tx,
            );
          }
        }

        // 7. Persist domain events in Transactional Outbox
        if (order.domainEvents.length > 0) {
          await this.eventBus.publish(
            order.domainEvents.map((event) => ({
              context: {
                tenantId: order.getTenantId(),
                aggregateType: ORDER_AGGREGATE_TYPE,
                aggregateId: order.getId(),
              },
              event,
            })),
            tx,
          );
          order.clearDomainEvents();
        }
      },
      { userId: dto.authenticatedBuyerId },
    );
  }
}
