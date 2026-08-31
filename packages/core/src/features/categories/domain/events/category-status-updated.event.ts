import { DomainEvent } from '@/shared/domain/events/domain-event.interface';
import { CategoryId } from '@/categories/domain/types/category-id.type';
import { CategoryStatus } from '@/categories/domain/enums/category-status.enum';

export class CategoryStatusUpdatedEvent implements DomainEvent {
  public readonly eventName = 'CategoryStatusUpdatedEvent';
  public readonly occurredOn: Date;
  [key: string]: unknown;

  constructor(
    public readonly categoryId: CategoryId,
    public readonly newStatus: CategoryStatus,
  ) {
    this.occurredOn = new Date();
  }
}
