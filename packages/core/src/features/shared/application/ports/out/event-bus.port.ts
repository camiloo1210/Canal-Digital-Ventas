import { DomainEvent } from '@/shared/domain/events/domain-event.interface';

import { TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';

export interface EventContext {
  readonly tenantId: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
}

export interface DomainEventEnvelope {
  readonly event: DomainEvent;
  readonly context: EventContext;
}

export interface EventBusPort {
  publish(envelopes: DomainEventEnvelope[], tx: TransactionContext): Promise<void>;
  /** @deprecated Migrate to V5 Envelope Pattern */
  publish(events: DomainEvent[], tx?: TransactionContext): Promise<void>;
}
