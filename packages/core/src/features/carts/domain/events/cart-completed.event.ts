import { DomainEvent } from '@/shared/domain/events/domain-event.interface';
import { CartId } from '@/carts/domain/types/cart-id.type';

export class CartCompletedEvent implements DomainEvent {
  public readonly eventName = 'CartCompletedEvent';
  public readonly occurredOn: Date;
  [key: string]: unknown;

  constructor(public readonly cartId: CartId) {
    this.occurredOn = new Date();
  }
}
