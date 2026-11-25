import { describe, expect, it, vi } from 'vitest';
import {
  PostgresShipmentJobQueueAdapter,
  ShipmentJobQueueException,
} from '@/shipment-creation/infrastructure/postgres-shipment-job-queue.adapter';
import type { TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';

function txWith(query: ReturnType<typeof vi.fn>): TransactionContext {
  return {
    executeNative: async <C, R>(fn: (connection: C) => Promise<R>): Promise<R> =>
      fn(query as unknown as C),
  };
}

describe('postgres shipment job queue adapter', (): void => {
  it('inserts a queued job idempotently by order id', async (): Promise<void> => {
    const query = vi.fn().mockResolvedValue([]);
    const adapter = new PostgresShipmentJobQueueAdapter();
    await adapter.enqueue('tenant', 'order', txWith(query));
    await adapter.enqueue('tenant', 'order', txWith(query));
    const text = (query.mock.calls[0][0] as TemplateStringsArray).join('?');
    expect(text).toContain('INSERT INTO sales.shipment_creation_jobs');
    expect(text).toContain('ON CONFLICT (order_id) DO NOTHING');
    expect(query.mock.calls[0].slice(1)).toEqual(['order', 'tenant']);
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('translates driver failures into a typed infrastructure exception', async (): Promise<void> => {
    const query = vi.fn().mockRejectedValue(new Error('boom'));
    await expect(
      new PostgresShipmentJobQueueAdapter().enqueue('tenant', 'order', txWith(query)),
    ).rejects.toBeInstanceOf(ShipmentJobQueueException);
  });
});
