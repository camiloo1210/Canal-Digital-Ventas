import { DomainEvent } from '@/shared/domain/events/domain-event.interface';
import { CategoryId } from '@/categories/domain/types/category-id.type';

export class CategoryDescriptionUpdatedEvent implements DomainEvent {
  public readonly eventName = 'CategoryDescriptionUpdatedEvent';
  public readonly occurredOn: Date;
  [key: string]: unknown;

  constructor(
    public readonly categoryId: CategoryId,
    public readonly newDescription: string,
  ) {
    this.occurredOn = new Date();
  }
}
