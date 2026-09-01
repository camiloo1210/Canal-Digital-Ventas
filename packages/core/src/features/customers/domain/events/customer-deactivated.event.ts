import { DomainEvent } from '@/shared/domain/events/domain-event.interface';
import { CustomerId } from '@/customers/domain/types/customer-id.type';

export class CustomerDeactivatedEvent implements DomainEvent {
  public readonly eventName = 'CustomerDeactivatedEvent';
  public readonly occurredOn: Date;
  [key: string]: unknown;

  constructor(public readonly customerId: CustomerId) {
    this.occurredOn = new Date();
  }
}
