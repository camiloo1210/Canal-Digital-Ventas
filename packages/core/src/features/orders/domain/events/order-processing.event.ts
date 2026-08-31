import { DomainEvent } from '@/shared/domain/events/domain-event.interface';
import { OrderId } from '@/orders/domain/types/order-id.type';

export class OrderProcessingEvent implements DomainEvent {
  public readonly eventName = 'OrderProcessingEvent';
  public readonly occurredOn = new Date();
  [key: string]: unknown;

  constructor(public readonly orderId: OrderId) {}
}
