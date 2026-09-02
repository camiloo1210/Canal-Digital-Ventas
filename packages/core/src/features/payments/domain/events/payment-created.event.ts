import { DomainEvent } from '@/shared/domain/events/domain-event.interface';
import { PaymentId } from '@/payments/domain/types/payment-id.type';

export class PaymentCreatedEvent implements DomainEvent {
  public readonly eventName = 'PaymentCreatedEvent';
  public readonly occurredOn: Date;
  [key: string]: unknown;

  constructor(public readonly paymentId: PaymentId) {
    this.occurredOn = new Date();
  }
}
