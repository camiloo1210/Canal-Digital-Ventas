import { DomainEvent } from '@/shared/domain/events/domain-event.interface';
import { TenantId } from '@/shared/domain/types/tenant-id.type';

export class TenantSuspendedEvent implements DomainEvent {
  public readonly eventName = 'TenantSuspendedEvent';
  public readonly occurredOn: Date;
  [key: string]: unknown;

  constructor(
    public readonly tenantId: TenantId,
    public readonly reason: string,
  ) {
    this.occurredOn = new Date();
  }
}
