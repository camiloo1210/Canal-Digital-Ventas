import { DomainEvent } from '@/shared/domain/events/domain-event.interface';
import { OrderId } from '@/orders/domain/types/order-id.type';

export class OrderCancelledEvent implements DomainEvent {
  public readonly eventName = 'OrderCancelledEvent';
  public readonly occurredOn = new Date();
  [key: string]: unknown;

  constructor(public readonly orderId: OrderId) {}
}
