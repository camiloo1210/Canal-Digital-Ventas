import amqp, { type ChannelModel, type ConfirmChannel, type Message } from 'amqplib';
import type {
  IntegrationEvent,
  IntegrationEventPublisherPort,
} from '@/shared/application/ports/out/integration-event-publisher.port';
import { MessagingException } from '@/shared/application/exceptions/messaging.exception';

export class RabbitMqEventPublisherAdapter implements IntegrationEventPublisherPort {
  private closed = false;
  private tail: Promise<void> = Promise.resolve();

  private constructor(
    private readonly connection: ChannelModel,
    private readonly channel: ConfirmChannel,
    private readonly queue: string,
    private readonly confirmTimeoutMs: number,
  ) {
    const invalidate = (): void => {
      this.closed = true;
    };
    connection.on('error', invalidate);
    connection.on('close', invalidate);
    channel.on('error', invalidate);
    channel.on('close', invalidate);
  }

  public static async connect(
    url: string,
    queue: string,
    confirmTimeoutMs: number = 10_000,
  ): Promise<RabbitMqEventPublisherAdapter> {
    let connection: ChannelModel | undefined;
    try {
      connection = await amqp.connect(url, { timeout: 10_000 });
      // Handle connection errors even while topology is being declared.
      connection.on('error', (): void => {});
      const channel = await connection.createConfirmChannel();
      const publisher = new RabbitMqEventPublisherAdapter(
        connection,
        channel,
        queue,
        confirmTimeoutMs,
      );
      await channel.assertQueue(`${queue}.dead-letter`, { durable: true });
      await channel.assertQueue(queue, {
        durable: true,
        deadLetterExchange: '',
        deadLetterRoutingKey: `${queue}.dead-letter`,
      });
      return publisher;
    } catch (error: unknown) {
      await connection?.close().catch((): void => {});
      throw new MessagingException('Unable to initialize RabbitMQ publisher', error);
    }
  }

  public publish(event: IntegrationEvent): Promise<void> {
    // One outstanding message per channel bounds memory and respects backpressure.
    const pending = this.tail.then((): Promise<void> => this.publishConfirmed(event));
    this.tail = pending.catch((): void => {});
    return pending;
  }

  private async publishConfirmed(event: IntegrationEvent): Promise<void> {
    if (this.closed) throw new MessagingException('RabbitMQ publisher is closed');
    let returned = false;
    const onReturn = (message: Message): void => {
      if (message.properties.messageId === event.messageId) returned = true;
    };
    this.channel.on('return', onReturn);
    try {
      await new Promise<void>((resolve, reject): void => {
        const timer = setTimeout((): void => {
          this.closed = true;
          reject(new MessagingException('RabbitMQ confirmation timed out'));
        }, this.confirmTimeoutMs);
        try {
          this.channel.sendToQueue(
            this.queue,
            Buffer.from(JSON.stringify(event)),
            {
              persistent: true,
              mandatory: true,
              contentType: 'application/json',
              messageId: event.messageId,
              type: event.eventType,
              headers: { 'x-tenant-id': event.tenantId, 'x-schema-version': 1 },
            },
            (error: unknown): void => {
              clearTimeout(timer);
              if (error)
                reject(new MessagingException('RabbitMQ did not confirm publication', error));
              else if (returned) reject(new MessagingException('RabbitMQ message is unroutable'));
              else resolve();
            },
          );
        } catch (error: unknown) {
          clearTimeout(timer);
          reject(new MessagingException('RabbitMQ publication failed', error));
        }
      });
    } finally {
      this.channel.removeListener('return', onReturn);
    }
  }

  public async close(): Promise<void> {
    this.closed = true;
    await this.channel.close().catch((): void => {});
    await this.connection.close().catch((): void => {});
  }
}
