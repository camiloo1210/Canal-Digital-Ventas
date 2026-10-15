import type postgres from 'postgres';
import type { IntegrationEvent } from '@/shared/application/ports/out/integration-event-publisher.port';
import type { RelayOutboxPort } from '@/shared/application/ports/out/relay-outbox.port';
import { OutboxRelayException } from '@/shared/application/exceptions/outbox-relay.exception';
import type { JsonObject } from '@/shared/domain/types/json.type';

interface ClaimedRow {
  id: string;
  tenant_id: string;
  aggregate_type: string;
  aggregate_id: string;
  event_type: string;
  payload: JsonObject;
  occurred_at: Date;
}

/** Uses only narrow worker RPCs; no service-role key or direct table access. */
export class PostgresRelayOutboxAdapter implements RelayOutboxPort {
  constructor(
    private readonly sql: postgres.Sql<Record<string, unknown>>,
    private readonly workerToken: string,
  ) {}

  public async claim(): Promise<IntegrationEvent | null> {
    try {
      const rows = await this.sql<ClaimedRow[]>`
        SELECT * FROM core.claim_relay_outbox_event(${this.workerToken}::uuid)
      `;
      const row = rows[0];
      if (!row) return null;
      return {
        messageId: row.id,
        tenantId: row.tenant_id,
        aggregateType: row.aggregate_type,
        aggregateId: row.aggregate_id,
        eventType: row.event_type,
        occurredAt: row.occurred_at.toISOString(),
        payload: row.payload,
      };
    } catch (error: unknown) {
      throw new OutboxRelayException('Unable to claim an outbox event', error);
    }
  }

  public async complete(messageId: string): Promise<void> {
    try {
      const rows = await this.sql<{ accepted: boolean }[]>`
        SELECT core.complete_outbox_event(${messageId}::uuid, ${this.workerToken}::uuid) AS accepted
      `;
      if (!rows[0]?.accepted) throw new OutboxRelayException('Outbox completion lease was lost');
    } catch (error: unknown) {
      if (error instanceof OutboxRelayException) throw error;
      throw new OutboxRelayException('Unable to complete an outbox event', error);
    }
  }

  public async retry(messageId: string): Promise<void> {
    try {
      const rows = await this.sql<{ accepted: boolean }[]>`
        SELECT core.retry_outbox_event(${messageId}::uuid, ${this.workerToken}::uuid) AS accepted
      `;
      if (!rows[0]?.accepted) throw new OutboxRelayException('Outbox retry lease was lost');
    } catch (error: unknown) {
      if (error instanceof OutboxRelayException) throw error;
      throw new OutboxRelayException('Unable to retry an outbox event', error);
    }
  }
}
