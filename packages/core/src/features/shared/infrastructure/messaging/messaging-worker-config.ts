import { MessagingException } from '@/shared/application/exceptions/messaging.exception';

export interface MessagingWorkerConfig {
  databaseUrl: string;
  rabbitMqUrl: string;
  queue: string;
  pollIntervalMs: number;
}

export function loadMessagingWorkerConfig(
  env: Record<string, string | undefined>,
): MessagingWorkerConfig {
  const databaseUrl = env.OUTBOX_DATABASE_URL ?? '';
  const rabbitMqUrl = env.RABBITMQ_URL ?? '';
  validateUrl(databaseUrl, ['postgres:', 'postgresql:'], 'OUTBOX_DATABASE_URL');
  validateUrl(rabbitMqUrl, ['amqp:', 'amqps:'], 'RABBITMQ_URL');
  const queue = env.RABBITMQ_QUEUE ?? 'canaldigital.events';
  if (!/^[a-zA-Z0-9._-]{1,200}$/.test(queue) || queue.startsWith('amq.')) {
    throw new MessagingException('Invalid RABBITMQ_QUEUE');
  }
  const pollIntervalMs = Number(env.OUTBOX_POLL_INTERVAL_MS ?? '1000');
  if (!Number.isInteger(pollIntervalMs) || pollIntervalMs < 1 || pollIntervalMs > 60_000) {
    throw new MessagingException('Invalid OUTBOX_POLL_INTERVAL_MS');
  }
  return { databaseUrl, rabbitMqUrl, queue, pollIntervalMs };
}

function validateUrl(value: string, protocols: string[], variable: string): void {
  try {
    const parsed = new URL(value);
    if (!protocols.includes(parsed.protocol) || !parsed.hostname) throw new Error();
  } catch {
    // Never include the supplied URL: it contains credentials.
    throw new MessagingException(`Invalid ${variable}`);
  }
}
