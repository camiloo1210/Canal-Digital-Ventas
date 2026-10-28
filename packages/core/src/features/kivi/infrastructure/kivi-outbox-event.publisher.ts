import type {
  IntegrationEvent,
  IntegrationEventPublisherPort,
} from '@/shared/application/ports/out/integration-event-publisher.port';

/**
 * Adapts the outbox relay to Kivi delivery: publish() resolves only after Kivi accepted the
 * write (or the event needs no delivery), so RelayOutboxUseCase completes the event only then.
 */
export class KiviOutboxEventPublisher implements IntegrationEventPublisherPort {
  public constructor(
    private readonly delivery: { execute(event: IntegrationEvent): Promise<void> },
  ) {}

  public async publish(event: IntegrationEvent): Promise<void> {
    await this.delivery.execute(event);
  }
}
