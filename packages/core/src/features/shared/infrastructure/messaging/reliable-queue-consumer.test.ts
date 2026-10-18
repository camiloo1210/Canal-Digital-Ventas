import { EventEmitter } from 'node:events';
import type { ConsumeMessage, Options } from 'amqplib';
import { describe, expect, it } from 'vitest';
import {
  processReliableQueueMessage,
  type ReliableConsumerChannel,
} from '@/shared/infrastructure/messaging/reliable-queue-consumer';
import { PermanentMessageException } from '@/shared/application/exceptions/permanent-message.exception';

class Channel extends EventEmitter implements ReliableConsumerChannel {
  public acknowledgements = 0;
  public copies: { queue: string; options: Options.Publish }[] = [];
  public failCopy = false;
  public ack(): void {
    this.acknowledgements++;
  }
  public sendToQueue(
    queue: string,
    body: Buffer,
    options: Options.Publish,
    confirm: (error: Error | null) => void,
  ): boolean {
    if (body.length === 0) throw new Error('Empty message');
    this.copies.push({ queue, options });
    confirm(this.failCopy ? new Error('NACK') : null);
    return true;
  }
}
function message(attempt: unknown = 1): ConsumeMessage {
  return {
    content: Buffer.from('{}'),
    fields: {
      consumerTag: 'test',
      deliveryTag: 1,
      redelivered: false,
      exchange: '',
      routingKey: 'payments',
    },
    properties: {
      messageId: 'test',
      headers: { 'x-consumer-attempt': attempt },
      contentType: 'application/json',
      contentEncoding: undefined,
      deliveryMode: 2,
      priority: undefined,
      correlationId: undefined,
      replyTo: undefined,
      expiration: undefined,
      timestamp: undefined,
      type: 'payment',
      userId: undefined,
      appId: undefined,
      clusterId: undefined,
    },
  };
}

describe('reliable payment queue consumption', (): void => {
  it('acknowledges after the domain transaction finishes', async (): Promise<void> => {
    const channel = new Channel();
    await processReliableQueueMessage(message(), {
      channel,
      queue: 'payments',
      decode: (): string => 'event',
      handle: async (): Promise<void> => {
        expect(channel.acknowledgements).toBe(0);
      },
    });
    expect(channel.acknowledgements).toBe(1);
    expect(channel.copies).toHaveLength(0);
  });
  it('confirms a delayed copy before acknowledging a transient failure', async (): Promise<void> => {
    const channel = new Channel();
    await processReliableQueueMessage(message(), {
      channel,
      queue: 'payments',
      decode: (): string => 'event',
      handle: async (): Promise<never> => {
        throw new Error('Database unavailable');
      },
    });
    expect(channel.copies[0]).toMatchObject({
      queue: 'payments.retry.30000',
      options: { persistent: true, mandatory: true, headers: { 'x-consumer-attempt': 2 } },
    });
    expect(channel.acknowledgements).toBe(1);
  });
  it('leaves the original unacknowledged if the retry publish fails', async (): Promise<void> => {
    const channel = new Channel();
    channel.failCopy = true;
    await expect(
      processReliableQueueMessage(message(), {
        channel,
        queue: 'payments',
        decode: (): string => 'event',
        handle: async (): Promise<never> => {
          throw new Error('Database unavailable');
        },
      }),
    ).rejects.toThrow('not confirmed');
    expect(channel.acknowledgements).toBe(0);
  });
  it.each([0, 6, '2', Number.NaN])(
    'quarantines malformed attempt %s without invoking the domain',
    async (attempt: unknown): Promise<void> => {
      const channel = new Channel();
      let invoked = false;
      await processReliableQueueMessage(message(attempt), {
        channel,
        queue: 'payments',
        decode: (): string => 'event',
        handle: async (): Promise<void> => {
          invoked = true;
        },
      });
      expect(invoked).toBe(false);
      expect(channel.copies[0].queue).toBe('payments.dead-letter');
      expect(channel.acknowledgements).toBe(1);
    },
  );
  it('quarantines permanent domain correlation failures', async (): Promise<void> => {
    const channel = new Channel();
    await processReliableQueueMessage(message(), {
      channel,
      queue: 'payments',
      decode: (): never => {
        throw new PermanentMessageException('Wrong tenant');
      },
      handle: async (): Promise<void> => {
        throw new Error('Must not execute');
      },
    });
    expect(channel.copies[0].queue).toBe('payments.dead-letter');
  });
  it('stops retrying after the fifth delivery', async (): Promise<void> => {
    const channel = new Channel();
    await processReliableQueueMessage(message(5), {
      channel,
      queue: 'payments',
      decode: (): string => 'event',
      handle: async (): Promise<never> => {
        throw new Error('Database unavailable');
      },
    });
    expect(channel.copies[0].queue).toBe('payments.dead-letter');
  });
});
