import { DomainEvent } from '@/shared/domain/events/domain-event.interface';
import { CategoryId } from '@/categories/domain/types/category-id.type';

export class CategoryArchivedEvent implements DomainEvent {
  public readonly eventName = 'CategoryArchivedEvent';
  public readonly occurredOn: Date;
  [key: string]: unknown;

  constructor(public readonly categoryId: CategoryId) {
    this.occurredOn = new Date();
  }
}
