import { DomainEvent } from '@/shared/domain/events/domain-event.interface';
import { OrderId } from '@/orders/domain/types/order-id.type';
import { PaymentGatewayId } from '@/orders/domain/types/payment-gateway-id.type';

export class OrderPaidEvent implements DomainEvent {
  public readonly eventName = 'OrderPaidEvent';
  public readonly occurredOn = new Date();
  [key: string]: unknown;

  constructor(
    public readonly orderId: OrderId,
    public readonly paymentGatewayId: PaymentGatewayId,
  ) {}
}
