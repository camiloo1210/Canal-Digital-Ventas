import { DomainEvent } from '@/shared/domain/events/domain-event.interface';
import { UserId } from '@/iam/domain/types/user-id.type';
import { TenantId } from '@/shared/domain/types/tenant-id.type';
import { UserRole } from '@/iam/domain/enums/role.enum';
import { Email } from '@/shared/domain/value-objects/email.vo';

export class UserInvitedEvent implements DomainEvent {
  public readonly eventName = 'UserInvitedEvent';
  public readonly occurredOn = new Date();
  [key: string]: unknown;

  constructor(
    public readonly userId: UserId,
    public readonly tenantId: TenantId,
    public readonly email: Email,
    public readonly role: UserRole,
  ) {}
}
