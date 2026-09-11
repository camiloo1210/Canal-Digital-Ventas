import { DomainEvent } from '@/shared/domain/events/domain-event.interface';
import { UserId } from '@/iam/domain/types/user-id.type';

export class UserSuspendedEvent implements DomainEvent {
  public readonly eventName = 'UserSuspendedEvent';
  public readonly occurredOn = new Date();
  [key: string]: unknown;

  constructor(public readonly userId: UserId) {}
}
