import { DomainEvent } from '@/shared/domain/events/domain-event.interface';
import { CustomerId } from '@/customers/domain/types/customer-id.type';

export class CustomerCreatedEvent implements DomainEvent {
  public readonly eventName = 'CustomerCreatedEvent';
  public readonly occurredOn: Date;
  [key: string]: unknown;

  constructor(public readonly customerId: CustomerId) {
    this.occurredOn = new Date();
  }
}
