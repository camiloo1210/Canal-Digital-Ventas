import type { ConfirmChannel, ConsumeMessage, Message } from 'amqplib';
import type { JsonObject } from '@/shared/domain/types/json.type';
import type { IntegrationEvent } from '@/shared/application/ports/out/integration-event-publisher.port';
import type { NotificationResult } from '@/notifications/application/deliver-order-notification.use-case';
import { NotificationPermanentException } from '@/notifications/application/exceptions/notification-permanent.exception';
import { MessagingException } from '@/shared/application/exceptions/messaging.exception';

export const NOTIFICATION_RETRY_DELAYS = [30_000, 120_000, 600_000, 1_800_000] as const;
export interface NotificationChannel extends Pick<ConfirmChannel, 'sendToQueue' | 'ack'> {
  on(event: 'return', listener: (message: Message) => void): unknown;
  removeListener(event: 'return', listener: (message: Message) => void): unknown;
}
export interface NotificationConsumerDependencies {
  channel: NotificationChannel;
  queue: string;
  deliver(event: IntegrationEvent, attempt: number): Promise<NotificationResult>;
}

export async function assertNotificationTopology(
  channel: ConfirmChannel,
  queue: string,
): Promise<void> {
  await channel.assertQueue(`${queue}.dead-letter`, { durable: true });
  await channel.assertQueue(queue, {
    durable: true,
    deadLetterExchange: '',
    deadLetterRoutingKey: `${queue}.dead-letter`,
  });
  for (const delay of NOTIFICATION_RETRY_DELAYS) {
    await channel.assertQueue(`${queue}.retry.${delay}`, {
      durable: true,
      messageTtl: delay,
      deadLetterExchange: '',
      deadLetterRoutingKey: queue,
    });
  }
}

export async function processNotificationMessage(
  raw: ConsumeMessage,
  deps: NotificationConsumerDependencies,
): Promise<void> {
  let event: IntegrationEvent;
  const header: unknown = raw.properties.headers?.['x-notification-attempt'] ?? 1;
  let attempt: number;
  try {
    event = decodeNotificationEvent(raw.content.toString('utf8'));
    if (typeof header !== 'number' || !Number.isInteger(header) || header < 1 || header > 5) {
      throw new NotificationPermanentException('INVALID_NOTIFICATION_ATTEMPT');
    }
    attempt = header;
  } catch {
    await publishCopy(raw, deps, `${deps.queue}.dead-letter`, 1, 'INVALID_NOTIFICATION_MESSAGE');
    deps.channel.ack(raw);
    return;
  }

  let result: NotificationResult;
  try {
    result = await deps.deliver(event, attempt);
  } catch (error: unknown) {
    const terminal = error instanceof NotificationPermanentException || attempt >= 5;
    const target = terminal
      ? `${deps.queue}.dead-letter`
      : `${deps.queue}.retry.${NOTIFICATION_RETRY_DELAYS[attempt - 1]}`;
    await publishCopy(
      raw,
      deps,
      target,
      terminal ? attempt : attempt + 1,
      terminal ? 'DELIVERY_FAILED' : 'DELIVERY_RETRY',
    );
    deps.channel.ack(raw);
    return;
  }
  if (result === 'BUSY') {
    await publishCopy(
      raw,
      deps,
      `${deps.queue}.retry.${NOTIFICATION_RETRY_DELAYS[0]}`,
      attempt,
      'DELIVERY_BUSY',
    );
  } else if (result === 'DEAD') {
    await publishCopy(raw, deps, `${deps.queue}.dead-letter`, attempt, 'DELIVERY_FAILED');
  }
  deps.channel.ack(raw);
}

export function decodeNotificationEvent(body: string): IntegrationEvent {
  const value: unknown = JSON.parse(body);
  if (!isRecord(value) || !isRecord(value.payload))
    throw new NotificationPermanentException('INVALID_NOTIFICATION_MESSAGE');
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  for (const key of ['messageId', 'tenantId', 'aggregateId']) {
    if (typeof value[key] !== 'string' || !uuid.test(value[key]))
      throw new NotificationPermanentException('INVALID_NOTIFICATION_MESSAGE');
  }
  if (
    typeof value.eventType !== 'string' ||
    value.aggregateType !== 'Order' ||
    typeof value.occurredAt !== 'string' ||
    !Number.isFinite(Date.parse(value.occurredAt))
  ) {
    throw new NotificationPermanentException('INVALID_NOTIFICATION_MESSAGE');
  }
  return {
    messageId: value.messageId as string,
    tenantId: value.tenantId as string,
    aggregateId: value.aggregateId as string,
    aggregateType: value.aggregateType,
    eventType: value.eventType,
    occurredAt: value.occurredAt,
    payload: value.payload as JsonObject,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function publishCopy(
  raw: ConsumeMessage,
  deps: NotificationConsumerDependencies,
  queue: string,
  attempt: number,
  code: string,
): Promise<void> {
  const messageId = raw.properties.messageId || crypto.randomUUID();
  let returned = false;
  const onReturn = (message: Message): void => {
    if (message.properties.messageId === messageId) returned = true;
  };
  deps.channel.on('return', onReturn);
  try {
    await new Promise<void>((resolve, reject): void => {
      const timer = setTimeout((): void => {
        reject(new MessagingException('Notification transfer timed out'));
      }, 10_000);
      try {
        deps.channel.sendToQueue(
          queue,
          raw.content,
          {
            persistent: true,
            mandatory: true,
            contentType: 'application/json',
            messageId,
            type: raw.properties.type,
            headers: {
              ...raw.properties.headers,
              'x-notification-attempt': attempt,
              'x-notification-code': code,
            },
          },
          (error: unknown): void => {
            clearTimeout(timer);
            if (error || returned)
              reject(new MessagingException('Notification transfer was not confirmed', error));
            else resolve();
          },
        );
      } catch (error: unknown) {
        clearTimeout(timer);
        reject(new MessagingException('Notification transfer failed', error));
      }
    });
  } finally {
    deps.channel.removeListener('return', onReturn);
  }
}
