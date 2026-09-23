import postgres from 'postgres';
import { EventBusPort, DomainEventEnvelope } from '@/shared/application/ports/out/event-bus.port';
import { DomainEvent } from '@/shared/domain/events/domain-event.interface';
import { TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';
import { toJsonObject } from '@/shared/domain/types/json.type';

export class PostgresEventBusAdapter implements EventBusPort {
  async publish(envelopes: DomainEventEnvelope[], tx: TransactionContext): Promise<void>;
  async publish(events: DomainEvent[], tx?: TransactionContext): Promise<void>;
  async publish(
    items: (DomainEvent | DomainEventEnvelope)[],
    tx?: TransactionContext,
  ): Promise<void> {
    if (items.length === 0) return;

    if (!tx) {
      throw new Error("TransactionContext is required in PostgresEventBusAdapter");
    }

    await tx.executeNative<postgres.TransactionSql<Record<string, unknown>>, void>(async (conn) => {
      for (const item of items) {
        const isEnvelope = 'context' in item && 'event' in item;
        if (!isEnvelope) {
          throw new Error("DomainEventEnvelope required for PostgresEventBusAdapter");
        }
        
        const envelope = item as DomainEventEnvelope;
        const payload = toJsonObject(envelope.event);
        
        await conn`
          INSERT INTO core.outbox_events (
            id, tenant_id, aggregate_type, aggregate_id, event_type, payload, status
          ) VALUES (
            ${crypto.randomUUID()},
            ${envelope.context.tenantId},
            ${envelope.context.aggregateType},
            ${envelope.context.aggregateId},
            ${envelope.event.eventName},
            ${conn.json(payload)},
            'PENDING'
          )
        `;
      }
    });
  }
}
