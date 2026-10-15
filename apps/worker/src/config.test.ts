import { describe, expect, it } from 'vitest';
import { loadMessagingWorkerConfig } from '@/shared/infrastructure/messaging/messaging-worker-config';

describe('messaging worker configuration', (): void => {
  const valid: Record<string, string> = {
    OUTBOX_DATABASE_URL: 'postgres://worker:secret@localhost:5432/postgres',
    RABBITMQ_URL: 'amqp://worker:secret@localhost:5672?heartbeat=30',
  };
  it('rejects missing configuration without exposing credentials', (): void => {
    expect((): unknown => loadMessagingWorkerConfig({})).toThrow('OUTBOX_DATABASE_URL');
    expect((): unknown =>
      loadMessagingWorkerConfig({ ...valid, RABBITMQ_URL: 'https://worker:secret@localhost' }),
    ).toThrow('RABBITMQ_URL');
  });
  it('rejects invalid polling and queue settings', (): void => {
    for (const value of ['0', '-1', '1.5', 'NaN', '60001']) {
      expect((): unknown =>
        loadMessagingWorkerConfig({ ...valid, OUTBOX_POLL_INTERVAL_MS: value }),
      ).toThrow('OUTBOX_POLL_INTERVAL_MS');
    }
    expect((): unknown =>
      loadMessagingWorkerConfig({ ...valid, RABBITMQ_QUEUE: 'amq.reserved' }),
    ).toThrow('RABBITMQ_QUEUE');
  });
  it('loads isolated worker credentials and safe defaults', (): void => {
    expect(loadMessagingWorkerConfig(valid)).toEqual({
      databaseUrl: valid.OUTBOX_DATABASE_URL,
      rabbitMqUrl: valid.RABBITMQ_URL,
      queue: 'canaldigital.events',
      pollIntervalMs: 1000,
    });
  });
});
