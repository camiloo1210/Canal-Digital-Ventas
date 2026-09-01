import { DomainEvent } from '@/shared/domain/events/domain-event.interface';
import { TenantId } from '@/shared/domain/types/tenant-id.type';

export class TenantCreatedEvent implements DomainEvent {
  public readonly eventName = 'TenantCreatedEvent';
  public readonly occurredOn: Date;
  [key: string]: unknown;

  constructor(public readonly tenantId: TenantId) {
    this.occurredOn = new Date();
  }
}
