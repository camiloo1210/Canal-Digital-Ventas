import { DomainEvent } from '@/shared/domain/events/domain-event.interface';
import { OrderId } from '@/orders/domain/types/order-id.type';

export class OrderShippedEvent implements DomainEvent {
  public readonly eventName = 'OrderShippedEvent';
  public readonly occurredOn = new Date();
  [key: string]: unknown;

  constructor(public readonly orderId: OrderId) {}
}
