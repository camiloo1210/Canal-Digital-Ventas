import type {
  OrderLifecycleRepositoryPort,
  OrderPaymentAutomationPort,
  OrderPaymentEventDto,
} from '@/orders/application/ports/out/order-payment-automation.port';
import type { OrderPaymentCoordinationPort } from '@/orders/application/ports/out/order-payment-coordination.port';
import type { ProductRepositoryPort } from '@/products/application/ports/out/product-repository.port';
import type {
  EventBusPort,
  DomainEventEnvelope,
} from '@/shared/application/ports/out/event-bus.port';
import type { TransactionManagerPort } from '@/shared/application/ports/out/transaction-manager.port';
import type { OrderItem } from '@/orders/domain/entities/order-item.entity';
import { createOrderId } from '@/orders/domain/types/order-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { OrderStatus } from '@/orders/domain/enums/order-status.enum';
import { ORDER_AGGREGATE_TYPE } from '@/orders/application/outbox/order-aggregate.constants';
import type { DomainEvent } from '@/shared/domain/events/domain-event.interface';

export type ExpireOrderResult = 'APPLIED' | 'NOOP' | 'MISMATCH' | 'EXCLUDED';

export class CancelExpiredOrderUseCase {
  public constructor(
    private readonly orders: OrderLifecycleRepositoryPort,
    private readonly products: ProductRepositoryPort,
    private readonly coordination: OrderPaymentCoordinationPort,
    private readonly payments: OrderPaymentAutomationPort,
    private readonly events: EventBusPort,
    private readonly transactions: TransactionManagerPort,
    private readonly systemActorId: string,
  ) {}

  public async execute(dto: OrderPaymentEventDto): Promise<ExpireOrderResult> {
    const orderId = createOrderId(dto.orderId);
    const tenantId = createTenantId(dto.tenantId);
    return this.transactions.runInTransaction(
      async (tx): Promise<ExpireOrderResult> => {
        await this.coordination.lockAndReadPayment(orderId, tx);
        const order = await this.orders.findByIdForUpdate(orderId, tenantId, tx);
        if (!order || order.getStatus() !== OrderStatus.CONFIRMED) return 'NOOP';
        const payment = await this.payments.read(orderId, tenantId, tx);
        if (!payment || payment.paymentId !== dto.paymentId || payment.tenantId !== tenantId)
          return 'MISMATCH';
        if (payment.excluded || payment.environment === 'legacy_unclassified') return 'EXCLUDED';
        if (
          !['expired_unpaid_awaiting_reconciliation', 'late_payment_pending_compensation'].includes(
            payment.status,
          )
        )
          return 'NOOP';
        if (!(await this.payments.reserveExpiryCancellation(orderId, dto.paymentId, tenantId, tx)))
          return 'NOOP';
        const items = order
          .getItems()
          .sort((left: OrderItem, right: OrderItem): number =>
            left.getProductId().localeCompare(right.getProductId()),
          );
        for (const item of items) {
          await this.products.increaseStock(item.getProductId(), tenantId, item.getQuantity(), tx);
        }
        order.cancelDueToPaymentExpiry();
        await this.orders.saveLifecycle(order, tx);
        const envelopes = order.domainEvents.map((event: DomainEvent): DomainEventEnvelope => ({
          context: { tenantId, aggregateType: ORDER_AGGREGATE_TYPE, aggregateId: orderId },
          event,
        }));
        await this.events.publish(envelopes, tx);
        order.clearDomainEvents();
        return 'APPLIED';
      },
      { userId: this.systemActorId, tenantId },
    );
  }
}
