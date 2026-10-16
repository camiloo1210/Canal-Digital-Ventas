import amqp, { type ChannelModel, type Channel } from 'amqplib';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RabbitMqEventPublisherAdapter } from '@/shared/infrastructure/adapters/rabbitmq-event-publisher.adapter';
import type { IntegrationEvent } from '@/shared/application/ports/out/integration-event-publisher.port';

const url = process.env.RABBITMQ_TEST_URL;

describe.skipIf(!url)('RabbitMQ real broker integration', (): void => {
  let connection: ChannelModel;
  let observer: Channel;
  let publisher: RabbitMqEventPublisherAdapter;
  let queue: string;
  const event: IntegrationEvent = {
    messageId: crypto.randomUUID(),
    tenantId: crypto.randomUUID(),
    aggregateType: 'Order',
    aggregateId: crypto.randomUUID(),
    eventType: 'OrderCancelled',
    occurredAt: '2026-10-15T00:00:00.000Z',
    payload: { orderId: 'order-1' },
  };

  beforeEach(async (): Promise<void> => {
    queue = `canaldigital.test.${crypto.randomUUID()}`;
    connection = await amqp.connect(url!);
    connection.on('error', (): void => {});
    observer = await connection.createChannel();
    publisher = await RabbitMqEventPublisherAdapter.connect(url!, queue);
  });

  afterEach(async (): Promise<void> => {
    await publisher?.close();
    if (observer) {
      await observer.deleteQueue(queue);
      await observer.deleteQueue(`${queue}.dead-letter`);
      await observer.close();
    }
    await connection?.close();
  });

  it('delivers a persistent, tenant-scoped message after broker confirmation', async (): Promise<void> => {
    await publisher.publish(event);
    const message = await observer.get(queue, { noAck: true });
    expect(message).not.toBe(false);
    if (!message) throw new Error('Confirmed message was not queued');
    expect(JSON.parse(message.content.toString())).toEqual(event);
    expect(message.properties.messageId).toBe(event.messageId);
    expect(message.properties.deliveryMode).toBe(2);
    expect(message.properties.headers?.['x-tenant-id']).toBe(event.tenantId);
  });

  it('rejects a mandatory return from a deleted queue', async (): Promise<void> => {
    await observer.deleteQueue(queue);
    await expect(publisher.publish(event)).rejects.toThrow('unroutable');
  });
});
