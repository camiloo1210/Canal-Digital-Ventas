import type { DomainEvent } from '@/shared/domain/events/domain-event.interface';
import type { OrderId } from '@/orders/domain/types/order-id.type';

export class OrderDeliveredEvent implements DomainEvent {
  public readonly eventName = 'OrderDeliveredEvent';
  public readonly occurredOn = new Date();
  [key: string]: unknown;
  public constructor(public readonly orderId: OrderId) {}
}
