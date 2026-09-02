import { DomainEvent } from '@/shared/domain/events/domain-event.interface';
import { CategoryId } from '@/categories/domain/types/category-id.type';

export class CategoryNameUpdatedEvent implements DomainEvent {
  public readonly eventName = 'CategoryNameUpdatedEvent';
  public readonly occurredOn: Date;
  [key: string]: unknown;

  constructor(
    public readonly categoryId: CategoryId,
    public readonly newName: string,
  ) {
    this.occurredOn = new Date();
  }
}
