import { DomainEvent } from '@/shared/domain/events/domain-event.interface';

export class UserProfileUpdatedEvent implements DomainEvent {
  public readonly occurredOn: Date;
  public readonly eventName = 'UserProfileUpdatedEvent';

  [key: string]: unknown;

  constructor(
    public readonly userId: string,
    public readonly tenantId: string,
    public readonly firstName: string,
    public readonly lastName: string,
  ) {
    this.occurredOn = new Date();
  }
}
