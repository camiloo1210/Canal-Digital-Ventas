import type { DomainEvent } from '@/shared/domain/events/domain-event.interface';
import type { OrderId } from '@/orders/domain/types/order-id.type';
import type { PaymentGatewayId } from '@/orders/domain/types/payment-gateway-id.type';

export class OrderRefundedEvent implements DomainEvent {
  public readonly eventName = 'OrderRefundedEvent';
  public readonly occurredOn = new Date();
  [key: string]: unknown;
  public constructor(
    public readonly orderId: OrderId,
    public readonly paymentGatewayId: PaymentGatewayId,
  ) {}
}
