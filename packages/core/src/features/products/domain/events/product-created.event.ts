import { DomainEvent } from '@/shared/domain/events/domain-event.interface';
import { ProductId } from '@/products/domain/types/product-id.type';

export class ProductCreatedEvent implements DomainEvent {
  public readonly eventName = 'ProductCreatedEvent';
  public readonly occurredOn = new Date();
  [key: string]: unknown;

  constructor(public readonly productId: ProductId) {}
}
