import { DomainEvent } from '@/shared/domain/events/domain-event.interface';
import { ProductId } from '@/products/domain/types/product-id.type';

export class ProductStockAdjustedEvent implements DomainEvent {
  public readonly eventName = 'ProductStockAdjustedEvent';
  public readonly occurredOn = new Date();
  [key: string]: unknown;

  constructor(
    public readonly productId: ProductId,
    public readonly stock: number,
  ) {}
}
