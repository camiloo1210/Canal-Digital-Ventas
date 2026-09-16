import { DomainEvent } from '@/shared/domain/events/domain-event.interface';
import { StoreCustomerId } from '@/sales/domain/types/customer-id.type';
import { TenantId } from '@/shared/domain/types/tenant-id.type';

export class StoreCustomerCreatedEvent implements DomainEvent {
  public readonly eventName = 'StoreCustomerCreatedEvent';
  public readonly occurredOn: Date;
  [key: string]: unknown;

  constructor(
    public readonly customerId: StoreCustomerId,
    public readonly tenantId: TenantId,
  ) {
    this.occurredOn = new Date();
  }
}
