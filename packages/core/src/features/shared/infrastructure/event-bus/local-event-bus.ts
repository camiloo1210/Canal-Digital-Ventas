import { EventBusPort, DomainEventEnvelope } from '@/shared/application/ports/out/event-bus.port';
import { DomainEvent } from '@/shared/domain/events/domain-event.interface';
import { TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';

export class LocalEventBus implements EventBusPort {
  async publish(envelopes: DomainEventEnvelope[], tx: TransactionContext): Promise<void>;
  async publish(events: DomainEvent[], tx?: TransactionContext): Promise<void>;
  async publish(
    items: (DomainEvent | DomainEventEnvelope)[],
    tx?: TransactionContext,
  ): Promise<void> {
    for (const item of items) {
      const isEnvelope = 'context' in item && 'event' in item;
      const event = isEnvelope ? (item as DomainEventEnvelope).event : (item as DomainEvent);
      console.log(`[EventBus] Publishing event: ${event.eventName}`, event);
    }
  }
}
