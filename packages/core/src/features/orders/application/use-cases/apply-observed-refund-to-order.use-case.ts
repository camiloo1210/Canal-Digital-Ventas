import type {
  OrderLifecycleRepositoryPort,
  OrderPaymentAutomationPort,
  OrderPaymentEventDto,
} from '@/orders/application/ports/out/order-payment-automation.port';
import type { OrderPaymentCoordinationPort } from '@/orders/application/ports/out/order-payment-coordination.port';
import type {
  EventBusPort,
  DomainEventEnvelope,
} from '@/shared/application/ports/out/event-bus.port';
import type { TransactionManagerPort } from '@/shared/application/ports/out/transaction-manager.port';
import type { DomainEvent } from '@/shared/domain/events/domain-event.interface';
import { createOrderId } from '@/orders/domain/types/order-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { createPaymentGatewayId } from '@/orders/domain/types/payment-gateway-id.type';
import { OrderStatus } from '@/orders/domain/enums/order-status.enum';
import { ORDER_AGGREGATE_TYPE } from '@/orders/application/outbox/order-aggregate.constants';

export class ApplyObservedRefundToOrderUseCase {
  public constructor(
    private readonly orders: OrderLifecycleRepositoryPort,
    private readonly coordination: OrderPaymentCoordinationPort,
    private readonly payments: OrderPaymentAutomationPort,
    private readonly events: EventBusPort,
    private readonly transactions: TransactionManagerPort,
    private readonly systemActorId: string,
  ) {}
  public async execute(dto: OrderPaymentEventDto): Promise<'APPLIED' | 'NOOP' | 'MISMATCH'> {
    const orderId = createOrderId(dto.orderId);
    const tenantId = createTenantId(dto.tenantId);
    return this.transactions.runInTransaction(
      async (tx): Promise<'APPLIED' | 'NOOP' | 'MISMATCH'> => {
        await this.coordination.lockAndReadPayment(orderId, tx);
        const order = await this.orders.findByIdForUpdate(orderId, tenantId, tx);
        if (
          !order ||
          [
            OrderStatus.CANCELLED,
            OrderStatus.REFUNDED,
            OrderStatus.DRAFT,
            OrderStatus.PENDING_PAYMENT,
          ].includes(order.getStatus())
        )
          return 'NOOP';
        const payment = await this.payments.read(orderId, tenantId, tx);
        if (
          !payment ||
          payment.paymentId !== dto.paymentId ||
          payment.tenantId !== tenantId ||
          payment.amountCents !== order.getTotalAmount().getValue() ||
          !payment.providerOrderId ||
          (order.getPaymentGatewayId() !== null &&
            order.getPaymentGatewayId() !== payment.providerOrderId)
        )
          return 'MISMATCH';
        if (
          payment.excluded ||
          payment.environment === 'legacy_unclassified' ||
          payment.status !== 'refunded'
        )
          return 'NOOP';
        order.applyObservedFullRefund(createPaymentGatewayId(payment.providerOrderId));
        await this.orders.saveLifecycle(order, tx);
        await this.events.publish(
          order.domainEvents.map((event: DomainEvent): DomainEventEnvelope => ({
            context: { tenantId, aggregateType: ORDER_AGGREGATE_TYPE, aggregateId: orderId },
            event,
          })),
          tx,
        );
        order.clearDomainEvents();
        return 'APPLIED';
      },
      { userId: this.systemActorId, tenantId },
    );
  }
}
