import type { DomainEvent } from '@/shared/domain/events/domain-event.interface';
import type {
  DomainEventEnvelope,
  EventBusPort,
} from '@/shared/application/ports/out/event-bus.port';

/**
 * Records published events. Envelope publications go to `published`; the deprecated
 * raw-event publications (no context) go to `publishedLegacy`.
 */
export class FakeEventBus implements EventBusPort {
  public readonly published: DomainEventEnvelope[] = [];
  public readonly publishedLegacy: DomainEvent[] = [];

  publish(envelopes: DomainEventEnvelope[]): Promise<void>;
  publish(events: DomainEvent[]): Promise<void>;
  async publish(items: DomainEventEnvelope[] | DomainEvent[]): Promise<void> {
    for (const item of items) {
      if ('context' in item && 'event' in item) {
        this.published.push(item as DomainEventEnvelope);
      } else {
        this.publishedLegacy.push(item as DomainEvent);
      }
    }
  }
}
