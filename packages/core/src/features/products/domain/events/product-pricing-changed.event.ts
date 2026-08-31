import { DomainEvent } from '@/shared/domain/events/domain-event.interface';
import { ProductId } from '@/products/domain/types/product-id.type';

export class ProductPricingChangedEvent implements DomainEvent {
  public readonly eventName = 'ProductPricingChangedEvent';
  public readonly occurredOn = new Date();
  [key: string]: unknown;

  constructor(public readonly productId: ProductId) {}
}
