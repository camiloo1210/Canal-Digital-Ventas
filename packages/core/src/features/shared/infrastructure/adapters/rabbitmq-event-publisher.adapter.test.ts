import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import type { Options } from 'amqplib';
import { RabbitMqEventPublisherAdapter } from '@/shared/infrastructure/adapters/rabbitmq-event-publisher.adapter';
import type { IntegrationEvent } from '@/shared/application/ports/out/integration-event-publisher.port';

const transport = vi.hoisted((): { connect: ReturnType<typeof vi.fn> } => ({ connect: vi.fn() }));
vi.mock('amqplib', (): object => ({ default: { connect: transport.connect } }));

class FakeChannel extends EventEmitter {
  public queues: string[] = [];
  public body: Buffer | undefined;
  public options: Options.Publish | undefined;
  public confirm: ((error: Error | null) => void) | undefined;
  public async assertQueue(queue: string): Promise<void> {
    this.queues.push(queue);
  }
  public sendToQueue(
    _queue: string,
    body: Buffer,
    options: Options.Publish,
    confirm: (error: Error | null) => void,
  ): boolean {
    this.body = body;
    this.options = options;
    this.confirm = confirm;
    return false;
  }
  public async close(): Promise<void> {
    this.emit('close');
  }
}

const event: IntegrationEvent = {
  messageId: 'event-1',
  tenantId: 'tenant-1',
  aggregateType: 'Order',
  aggregateId: 'order-1',
  eventType: 'OrderCancelled',
  occurredAt: '2026-10-15T00:00:00.000Z',
  payload: { orderId: 'order-1' },
};

async function setup(
  timeoutMs: number = 1000,
): Promise<{ channel: FakeChannel; publisher: RabbitMqEventPublisherAdapter }> {
  const channel = new FakeChannel();
  const connection = new EventEmitter();
  Object.assign(connection, {
    createConfirmChannel: async (): Promise<FakeChannel> => channel,
    close: async (): Promise<void> => {},
  });
  transport.connect.mockResolvedValue(connection);
  const publisher = await RabbitMqEventPublisherAdapter.connect(
    'amqp://localhost',
    'events',
    timeoutMs,
  );
  return { channel, publisher };
}

describe('RabbitMqEventPublisherAdapter', (): void => {
  it('waits for confirmation even when sendToQueue reports backpressure', async (): Promise<void> => {
    const { channel, publisher } = await setup();
    let completed = false;
    const pending = publisher.publish(event).then((): void => {
      completed = true;
    });
    await vi.waitFor((): void => {
      expect(channel.body).toBeDefined();
    });
    expect(completed).toBe(false);
    expect(JSON.parse(channel.body!.toString())).toEqual(event);
    expect(channel.options).toMatchObject({
      persistent: true,
      mandatory: true,
      messageId: 'event-1',
      contentType: 'application/json',
      type: 'OrderCancelled',
    });
    channel.confirm!(null);
    await pending;
    expect(completed).toBe(true);
    expect(channel.queues).toEqual(['events.dead-letter', 'events']);
    await publisher.close();
  });

  it('rejects a returned mandatory message even when the broker confirms it', async (): Promise<void> => {
    const { channel, publisher } = await setup();
    const pending = publisher.publish(event);
    const assertion = expect(pending).rejects.toThrow('unroutable');
    await vi.waitFor((): void => {
      expect(channel.confirm).toBeDefined();
    });
    channel.emit('return', { properties: { messageId: 'event-1' } });
    channel.confirm!(null);
    await assertion;
    await publisher.close();
  });

  it('rejects negative broker confirmation', async (): Promise<void> => {
    const { channel, publisher } = await setup();
    const pending = publisher.publish(event);
    const assertion = expect(pending).rejects.toThrow('confirm');
    await vi.waitFor((): void => {
      expect(channel.confirm).toBeDefined();
    });
    channel.confirm!(new Error('nack'));
    await assertion;
    await publisher.close();
  });

  it('bounds the confirmation wait so the database lease can expire safely', async (): Promise<void> => {
    const { publisher } = await setup(20);
    await expect(publisher.publish(event)).rejects.toThrow('timed out');
    await publisher.close();
  });

  it('rejects publication after connection loss', async (): Promise<void> => {
    const { channel, publisher } = await setup();
    channel.emit('error', new Error('closed'));
    await expect(publisher.publish(event)).rejects.toThrow('closed');
    await publisher.close();
  });
});
