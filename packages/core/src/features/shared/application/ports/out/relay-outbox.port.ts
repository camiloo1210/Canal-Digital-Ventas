import type { IntegrationEvent } from '@/shared/application/ports/out/integration-event-publisher.port';

/** Implementations fence all state transitions using the current worker's lease. */
export interface RelayOutboxPort {
  claim(): Promise<IntegrationEvent | null>;
  complete(messageId: string): Promise<void>;
  retry(messageId: string): Promise<void>;
}
