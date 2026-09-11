import { DomainEvent } from '@/shared/domain/events/domain-event.interface';
import { UserId } from '@/iam/domain/types/user-id.type';
import { UserRole } from '@/iam/domain/enums/role.enum';

export class UserRoleChangedEvent implements DomainEvent {
  public readonly eventName = 'UserRoleChangedEvent';
  public readonly occurredOn = new Date();
  [key: string]: unknown;

  constructor(
    public readonly userId: UserId,
    public readonly oldRole: UserRole,
    public readonly newRole: UserRole,
  ) {}
}
