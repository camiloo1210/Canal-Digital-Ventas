import type {
  IntegrationEvent,
  IntegrationEventPublisherPort,
} from '@/shared/application/ports/out/integration-event-publisher.port';
import type { RelayOutboxPort } from '@/shared/application/ports/out/relay-outbox.port';

export class RelayOutboxUseCase {
  constructor(
    private readonly outbox: RelayOutboxPort,
    private readonly publisher: IntegrationEventPublisherPort,
    private readonly shouldPublish: (event: IntegrationEvent) => boolean = (): boolean => true,
  ) {}

  public async execute(): Promise<boolean> {
    const event = await this.outbox.claim();
    if (!event) return false;

    try {
      if (this.shouldPublish(event)) await this.publisher.publish(event);
      await this.outbox.complete(event.messageId);
      return true;
    } catch (error: unknown) {
      await this.outbox.retry(event.messageId);
      throw error;
    }
  }
}
