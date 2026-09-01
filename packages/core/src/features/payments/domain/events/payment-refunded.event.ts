import { DomainEvent } from '@/shared/domain/events/domain-event.interface';
import { PaymentId } from '@/payments/domain/types/payment-id.type';
import { OrderId } from '@/payments/domain/types/order-id.type';

export class PaymentRefundedEvent implements DomainEvent {
  public readonly eventName = 'PaymentRefundedEvent';
  public readonly occurredOn: Date;
  [key: string]: unknown;

  constructor(
    public readonly paymentId: PaymentId,
    public readonly orderId: OrderId,
  ) {
    this.occurredOn = new Date();
  }
}
