import { setTimeout as delay } from 'node:timers/promises';
import postgres from 'postgres';
import { RelayOutboxUseCase } from '@/shared/application/use-cases/relay-outbox.use-case';
import { PostgresRelayOutboxAdapter } from '@/shared/infrastructure/adapters/postgres-relay-outbox.adapter';
import { RabbitMqEventPublisherAdapter } from '@/shared/infrastructure/adapters/rabbitmq-event-publisher.adapter';
import type { MessagingWorkerConfig } from '@/shared/infrastructure/messaging/messaging-worker-config';
import { MessagingException } from '@/shared/application/exceptions/messaging.exception';

export interface OutboxWorkerLogger {
  info(message: string): void;
  error(message: string): void;
}

/** Composition root for the Node worker driving adapter, independent of Next.js. */
export async function runOutboxWorker(
  config: MessagingWorkerConfig,
  signal: AbortSignal,
  logger: OutboxWorkerLogger,
  eventTypes: string[],
  onReady: (ready: boolean) => void = (): void => {},
): Promise<void> {
  const sql = postgres(config.databaseUrl, {
    max: 1,
    connect_timeout: 10,
    idle_timeout: 20,
    connection: { statement_timeout: 10_000, application_name: 'canaldigital-outbox' },
  });
  try {
    while (!signal.aborted) {
      let publisher: RabbitMqEventPublisherAdapter | undefined;
      try {
        publisher = await RabbitMqEventPublisherAdapter.connect(config.rabbitMqUrl, config.queue);
        const outbox = new PostgresRelayOutboxAdapter(sql, crypto.randomUUID(), eventTypes);
        const relay = new RelayOutboxUseCase(outbox, publisher);
        logger.info('Outbox relay connected');
        while (!signal.aborted) {
          const published = await relay.execute();
          if (!publisher.isConnected())
            throw new MessagingException('RabbitMQ publisher disconnected');
          onReady(true);
          if (!published) await pause(config.pollIntervalMs, signal);
        }
      } catch {
        if (!signal.aborted) logger.error('Outbox relay interrupted; reconnecting');
      } finally {
        onReady(false);
        await publisher?.close();
      }
      if (!signal.aborted) await pause(5000, signal);
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function pause(milliseconds: number, signal: AbortSignal): Promise<void> {
  try {
    await delay(milliseconds, undefined, { signal });
  } catch (error: unknown) {
    if (!signal.aborted) throw error;
  }
}
