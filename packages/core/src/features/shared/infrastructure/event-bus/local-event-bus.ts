import { EventBusPort } from '@/shared/application/ports/out/event-bus.port';
import { DomainEvent } from '@/shared/domain/events/domain-event.interface';

export class LocalEventBus implements EventBusPort {
  async publish(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      console.log(`[EventBus] Publishing event: ${event.eventName}`, event);
      // Here you could integrate with a real event emitter, SNS, RabbitMQ, Kafka, etc.
    }
  }
}
