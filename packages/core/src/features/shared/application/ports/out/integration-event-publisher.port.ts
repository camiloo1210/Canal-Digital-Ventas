import type { JsonObject } from '@/shared/domain/types/json.type';

/** Stable, tenant-scoped wire contract. Consumers deduplicate by messageId. */
export interface IntegrationEvent {
  messageId: string;
  tenantId: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  occurredAt: string;
  payload: JsonObject;
}

export interface IntegrationEventPublisherPort {
  /** Resolves only after the transport accepts responsibility for the message. */
  publish(event: IntegrationEvent): Promise<void>;
}
