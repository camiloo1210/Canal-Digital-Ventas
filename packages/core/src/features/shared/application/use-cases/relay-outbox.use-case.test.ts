import { describe, expect, it } from 'vitest';
import { RelayOutboxUseCase } from '@/shared/application/use-cases/relay-outbox.use-case';
import type { IntegrationEvent } from '@/shared/application/ports/out/integration-event-publisher.port';
import type { RelayOutboxPort } from '@/shared/application/ports/out/relay-outbox.port';

const event: IntegrationEvent = {
  messageId: 'event-1',
  tenantId: 'tenant-1',
  aggregateType: 'Order',
  aggregateId: 'order-1',
  eventType: 'OrderCancelled',
  occurredAt: '2026-10-15T00:00:00.000Z',
  payload: { orderId: 'order-1' },
};

class MemoryOutbox implements RelayOutboxPort {
  public pending: IntegrationEvent[] = [event];
  public completed: string[] = [];
  public retried: string[] = [];
  public async claim(): Promise<IntegrationEvent | null> {
    return this.pending.shift() ?? null;
  }
  public async complete(messageId: string): Promise<void> {
    this.completed.push(messageId);
  }
  public async retry(messageId: string): Promise<void> {
    this.retried.push(messageId);
  }
}

describe('RelayOutboxUseCase', (): void => {
  it('completes only after broker confirmation and preserves tenant and event identity', async (): Promise<void> => {
    const outbox = new MemoryOutbox();
    let published: IntegrationEvent | undefined;
    const relay = new RelayOutboxUseCase(outbox, {
      publish: async (message: IntegrationEvent): Promise<void> => {
        expect(outbox.completed).toEqual([]);
        published = message;
      },
    });
    expect(await relay.execute()).toBe(true);
    expect(published).toEqual(event);
    expect(outbox.completed).toEqual(['event-1']);
    expect(await relay.execute()).toBe(false);
  });

  it('leaves failed publications retryable without completing them', async (): Promise<void> => {
    const outbox = new MemoryOutbox();
    const relay = new RelayOutboxUseCase(outbox, {
      publish: async (): Promise<void> => {
        throw new Error('broker unavailable');
      },
    });
    await expect(relay.execute()).rejects.toThrow('broker unavailable');
    expect(outbox.completed).toEqual([]);
    expect(outbox.retried).toEqual(['event-1']);
  });

  it('retries with the same message ID if database completion fails after publication', async (): Promise<void> => {
    const outbox = new MemoryOutbox();
    outbox.complete = async (): Promise<void> => {
      throw new Error('lease lost');
    };
    const relay = new RelayOutboxUseCase(outbox, { publish: async (): Promise<void> => {} });
    await expect(relay.execute()).rejects.toThrow('lease lost');
    expect(outbox.retried).toEqual(['event-1']);
  });
});
