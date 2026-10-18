import { DomainEvent } from '@/shared/domain/events/domain-event.interface';

export interface EventBusPort {
  publish(events: DomainEvent[]): Promise<void>;
}
