import type { DomainEvent } from '@/shared/domain/events/domain-event.interface';
import type { OrderId } from '@/orders/domain/types/order-id.type';

export class OrderShipmentUpdatedEvent implements DomainEvent {
  public readonly eventName = 'OrderShipmentUpdatedEvent';
  public readonly occurredOn = new Date();
  [key: string]: unknown;
  public constructor(public readonly orderId: OrderId) {}
}
