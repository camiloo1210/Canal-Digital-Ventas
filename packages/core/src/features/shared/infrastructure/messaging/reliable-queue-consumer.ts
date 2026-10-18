import type { ConfirmChannel, ConsumeMessage, Message } from 'amqplib';
import { PermanentMessageException } from '@/shared/application/exceptions/permanent-message.exception';
import { MessagingException } from '@/shared/application/exceptions/messaging.exception';

export const QUEUE_RETRY_DELAYS = [30000, 120000, 600000, 1800000] as const;
export interface ReliableConsumerChannel extends Pick<ConfirmChannel, 'sendToQueue' | 'ack'> {
  on(event: 'return', listener: (message: Message) => void): unknown;
  removeListener(event: 'return', listener: (message: Message) => void): unknown;
}
export interface ReliableConsumerDependencies<TMessage> {
  readonly channel: ReliableConsumerChannel;
  readonly queue: string;
  decode(body: string): TMessage;
  handle(message: TMessage): Promise<void>;
}

export async function assertReliableQueueTopology(
  channel: ConfirmChannel,
  queue: string,
): Promise<void> {
  await channel.assertQueue(`${queue}.dead-letter`, { durable: true });
  await channel.assertQueue(queue, {
    durable: true,
    deadLetterExchange: '',
    deadLetterRoutingKey: `${queue}.dead-letter`,
  });
  for (const ttl of QUEUE_RETRY_DELAYS) {
    await channel.assertQueue(`${queue}.retry.${ttl}`, {
      durable: true,
      messageTtl: ttl,
      deadLetterExchange: '',
      deadLetterRoutingKey: queue,
    });
  }
}

/** ACK follows either the successful application commit or a confirmed transfer to retry/DLQ. */
export async function processReliableQueueMessage<TMessage>(
  raw: ConsumeMessage,
  deps: ReliableConsumerDependencies<TMessage>,
): Promise<void> {
  const header: unknown = raw.properties.headers?.['x-consumer-attempt'] ?? 1;
  let attempt = 1;
  try {
    if (typeof header !== 'number' || !Number.isInteger(header) || header < 1 || header > 5)
      throw new PermanentMessageException('Invalid delivery attempt.');
    attempt = header;
    const decoded = deps.decode(raw.content.toString('utf8'));
    await deps.handle(decoded);
  } catch (error: unknown) {
    const terminal = error instanceof PermanentMessageException || attempt >= 5;
    const queue = terminal
      ? `${deps.queue}.dead-letter`
      : `${deps.queue}.retry.${QUEUE_RETRY_DELAYS[attempt - 1]}`;
    await transfer(raw, deps.channel, queue, terminal ? attempt : attempt + 1);
  }
  deps.channel.ack(raw);
}

async function transfer(
  raw: ConsumeMessage,
  channel: ReliableConsumerChannel,
  queue: string,
  attempt: number,
): Promise<void> {
  const id = raw.properties.messageId ?? crypto.randomUUID();
  let returned = false;
  const onReturn = (message: Message): void => {
    if (message.properties.messageId === id) returned = true;
  };
  channel.on('return', onReturn);
  try {
    await new Promise<void>((resolve, reject): void => {
      const timeout = setTimeout((): void => {
        reject(new MessagingException('Queue transfer timed out.'));
      }, 10000);
      try {
        channel.sendToQueue(
          queue,
          raw.content,
          {
            persistent: true,
            mandatory: true,
            contentType: 'application/json',
            messageId: id,
            type: raw.properties.type,
            headers: { ...raw.properties.headers, 'x-consumer-attempt': attempt },
          },
          (error: unknown): void => {
            clearTimeout(timeout);
            if (error || returned) reject(new MessagingException('Queue transfer not confirmed.'));
            else resolve();
          },
        );
      } catch (error: unknown) {
        clearTimeout(timeout);
        reject(new MessagingException('Queue transfer failed.', error));
      }
    });
  } finally {
    channel.removeListener('return', onReturn);
  }
}
