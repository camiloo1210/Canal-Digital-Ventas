import type { OrderLifecycleRepositoryPort } from '@/orders/application/ports/out/order-payment-automation.port';
import type { OrderPaymentCoordinationPort } from '@/orders/application/ports/out/order-payment-coordination.port';
import type { SellerOrderAccessPort } from '@/orders/application/ports/out/seller-order-access.port';
import type {
  EventBusPort,
  DomainEventEnvelope,
} from '@/shared/application/ports/out/event-bus.port';
import type { TransactionManagerPort } from '@/shared/application/ports/out/transaction-manager.port';
import type { DomainEvent } from '@/shared/domain/events/domain-event.interface';
import type { ChangeOrderStatusDto } from '@/orders/application/dtos/change-order-status.dto';
import { parseOrderStatus, OrderStatus } from '@/orders/domain/enums/order-status.enum';
import { createOrderId } from '@/orders/domain/types/order-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { OrderNotFoundException } from '@/orders/application/exceptions/order-not-found.exception';
import { UnsupportedOrderStatusException } from '@/orders/application/exceptions/unsupported-order-status.exception';
import { InvalidOrderStateException } from '@/orders/domain/exceptions/invalid-order-state.exception';
import { OptimisticConcurrencyException } from '@/shared/application/exceptions/optimistic-concurrency.exception';
import { createGlobalAuthId } from '@/sales/domain/types/global-auth-id.type';
import { ORDER_AGGREGATE_TYPE } from '@/orders/application/outbox/order-aggregate.constants';

export class ChangeOrderStatusUseCase {
  public constructor(
    private readonly orders: OrderLifecycleRepositoryPort,
    private readonly access: SellerOrderAccessPort,
    private readonly coordination: OrderPaymentCoordinationPort,
    private readonly events: EventBusPort,
    private readonly transactions: TransactionManagerPort,
  ) {}

  public async execute(dto: ChangeOrderStatusDto): Promise<void> {
    const orderId = createOrderId(dto.orderId);
    const tenantId = createTenantId(dto.tenantId);
    const actor = createGlobalAuthId(dto.authenticatedSellerId);
    const status = parseOrderStatus(dto.status);
    if (![OrderStatus.PROCESSING, OrderStatus.SHIPPED, OrderStatus.DELIVERED].includes(status)) {
      throw new UnsupportedOrderStatusException(status);
    }
    if (!Number.isSafeInteger(dto.expectedVersion) || dto.expectedVersion < 0) {
      throw new OptimisticConcurrencyException('Order', orderId);
    }
    await this.transactions.runInTransaction(
      async (tx): Promise<void> => {
        await this.access.assertCanManage(actor, tenantId, orderId, tx);
        const payment = await this.coordination.lockAndReadPayment(orderId, tx);
        const order = await this.orders.findByIdForUpdate(orderId, tenantId, tx);
        if (!order) throw new OrderNotFoundException();
        if (order.getVersion() !== dto.expectedVersion) {
          throw new OptimisticConcurrencyException('Order', orderId);
        }
        if (!payment || !['completed', 'partially_refunded'].includes(payment.status)) {
          throw new InvalidOrderStateException('A settled payment is required for fulfillment.');
        }
        switch (status) {
          case OrderStatus.PROCESSING:
            order.markAsProcessing();
            break;
          case OrderStatus.SHIPPED:
            order.markAsShipped();
            break;
          case OrderStatus.DELIVERED:
            order.markAsDelivered();
            break;
        }
        await this.orders.saveLifecycle(order, tx);
        await this.events.publish(
          order.domainEvents.map((event: DomainEvent): DomainEventEnvelope => ({
            context: { tenantId, aggregateType: ORDER_AGGREGATE_TYPE, aggregateId: orderId },
            event,
          })),
          tx,
        );
        order.clearDomainEvents();
      },
      { userId: actor, tenantId },
    );
  }
}
