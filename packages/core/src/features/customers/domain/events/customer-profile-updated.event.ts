import { DomainEvent } from '@/shared/domain/events/domain-event.interface';
import { CustomerId } from '@/customers/domain/types/customer-id.type';

export class CustomerProfileUpdatedEvent implements DomainEvent {
  public readonly eventName = 'CustomerProfileUpdatedEvent';
  public readonly occurredOn: Date;
  [key: string]: unknown;

  constructor(public readonly customerId: CustomerId) {
    this.occurredOn = new Date();
  }
}
