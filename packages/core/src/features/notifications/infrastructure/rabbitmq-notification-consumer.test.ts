import { EventEmitter } from 'node:events';
import type { ConsumeMessage, Options } from 'amqplib';
import { describe, expect, it } from 'vitest';
import {
  processNotificationMessage,
  type NotificationChannel,
} from '@/notifications/infrastructure/rabbitmq-notification-consumer';
import { NotificationPermanentException } from '@/notifications/application/exceptions/notification-permanent.exception';

class Channel extends EventEmitter implements NotificationChannel {
  public ackCount = 0;
  public copies: { queue: string; options: Options.Publish }[] = [];
  public failCopy = false;
  public ack(): void {
    this.ackCount++;
  }
  public sendToQueue(
    queue: string,
    _body: Buffer,
    options: Options.Publish,
    confirm: (error: Error | null) => void,
  ): boolean {
    this.copies.push({ queue, options });
    confirm(this.failCopy ? new Error('nack') : null);
    return true;
  }
}
function message(attempt: number = 1): ConsumeMessage {
  const id = '11111111-1111-4111-8111-111111111111';
  return {
    content: Buffer.from(
      JSON.stringify({
        messageId: id,
        tenantId: id,
        aggregateId: id,
        aggregateType: 'Order',
        eventType: 'OrderCancelledEvent',
        occurredAt: '2026-10-15T00:00:00Z',
        payload: { orderId: id },
      }),
    ),
    properties: {
      messageId: id,
      headers: { 'x-notification-attempt': attempt },
      contentType: 'application/json',
      contentEncoding: undefined,
      deliveryMode: 2,
      priority: undefined,
      correlationId: undefined,
      replyTo: undefined,
      expiration: undefined,
      timestamp: undefined,
      type: 'OrderCancelledEvent',
      userId: undefined,
      appId: undefined,
      clusterId: undefined,
    },
    fields: {
      consumerTag: 'test',
      deliveryTag: 1,
      redelivered: false,
      exchange: '',
      routingKey: 'notifications',
    },
  };
}
describe('RabbitMQ notification consumption', (): void => {
  it('acknowledges only after the delivery finishes', async (): Promise<void> => {
    const channel = new Channel();
    await processNotificationMessage(message(), {
      channel,
      queue: 'notifications',
      deliver: async (): Promise<'SENT'> => {
        expect(channel.ackCount).toBe(0);
        return 'SENT';
      },
    });
    expect(channel.ackCount).toBe(1);
    expect(channel.copies).toEqual([]);
  });
  it('schedules a confirmed retry on transient SMTP failure', async (): Promise<void> => {
    const channel = new Channel();
    await processNotificationMessage(message(), {
      channel,
      queue: 'notifications',
      deliver: async (): Promise<never> => {
        throw new Error('SMTP unavailable');
      },
    });
    expect(channel.copies[0]).toMatchObject({
      queue: 'notifications.retry.30000',
      options: { persistent: true, mandatory: true, headers: { 'x-notification-attempt': 2 } },
    });
    expect(channel.ackCount).toBe(1);
  });
  it.each([1, 5])(
    'quarantines permanent rejections and exhausted retries at attempt %i',
    async (attempt: number): Promise<void> => {
      const channel = new Channel();
      await processNotificationMessage(message(attempt), {
        channel,
        queue: 'notifications',
        deliver: async (): Promise<never> => {
          if (attempt === 1) throw new NotificationPermanentException('REJECTED');
          throw new Error('unavailable');
        },
      });
      expect(channel.copies[0].queue).toBe('notifications.dead-letter');
      expect(channel.ackCount).toBe(1);
    },
  );
  it('keeps the original unacknowledged when the retry copy is not confirmed', async (): Promise<void> => {
    const channel = new Channel();
    channel.failCopy = true;
    await expect(
      processNotificationMessage(message(), {
        channel,
        queue: 'notifications',
        deliver: async (): Promise<never> => {
          throw new Error('unavailable');
        },
      }),
    ).rejects.toThrow('not confirmed');
    expect(channel.ackCount).toBe(0);
  });
  it('quarantines malformed messages without attempting delivery', async (): Promise<void> => {
    const channel = new Channel();
    const raw = message();
    raw.content = Buffer.from('{}');
    let delivered = false;
    await processNotificationMessage(raw, {
      channel,
      queue: 'notifications',
      deliver: async (): Promise<'SENT'> => {
        delivered = true;
        return 'SENT';
      },
    });
    expect(delivered).toBe(false);
    expect(channel.copies[0].queue).toBe('notifications.dead-letter');
  });
  it('delays a busy duplicate without consuming a delivery attempt', async (): Promise<void> => {
    const channel = new Channel();
    await processNotificationMessage(message(2), {
      channel,
      queue: 'notifications',
      deliver: async (): Promise<'BUSY'> => 'BUSY',
    });
    expect(channel.copies[0].options.headers?.['x-notification-attempt']).toBe(2);
  });
});
