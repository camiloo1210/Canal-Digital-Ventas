import { DomainEvent } from '@/shared/domain/events/domain-event.interface';

export class UserPermissionsUpdatedEvent implements DomainEvent {
  public readonly occurredOn: Date;
  public readonly eventName = 'UserPermissionsUpdatedEvent';

  [key: string]: unknown;

  constructor(
    public readonly userId: string,
    public readonly tenantId: string,
    public readonly permissions: string[],
  ) {
    this.occurredOn = new Date();
  }
}
