import { DomainEvent } from '@canaldigital/packages/core';
import { EventBusPort, DomainEventEnvelope, TransactionContext } from '@canaldigital/packages/core';

export class InMemoryEventBus implements EventBusPort {
  private events: (DomainEvent | DomainEventEnvelope)[] = [];

  async publish(envelopes: DomainEventEnvelope[], tx: TransactionContext): Promise<void>;
  async publish(events: DomainEvent[], tx?: TransactionContext): Promise<void>;
  async publish(items: (DomainEvent | DomainEventEnvelope)[], tx?: TransactionContext): Promise<void> {
    this.events.push(...items);
  }

  getPublishedEvents(): (DomainEvent | DomainEventEnvelope)[] {
    return this.events;
  }

  clear(): void {
    this.events = [];
  }
}
