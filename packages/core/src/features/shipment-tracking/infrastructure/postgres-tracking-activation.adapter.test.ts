import { describe, expect, it, vi } from 'vitest';
import { PostgresTrackingActivationAdapter } from '@/shipment-tracking/infrastructure/postgres-tracking-activation.adapter';
import type { TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';

describe('tracking activation persistence', (): void => {
  it('reads guide by order and tenant from the same transaction', async (): Promise<void> => {
    const query = vi.fn().mockResolvedValue([{ tracking_number: 'abc', version: 4 }]);
    const tx: TransactionContext = {
      executeNative: async <C, R>(fn: (connection: C) => Promise<R>): Promise<R> =>
        fn(query as unknown as C),
    };
    const adapter = new PostgresTrackingActivationAdapter(
      (): string => 'ref',
      '00000000-0000-4000-8000-000000000001',
    );
    expect(await adapter.readForUpdate('tenant', 'order', tx)).toEqual({
      trackingNumber: 'abc',
      version: 4,
    });
    expect(query.mock.calls[0].slice(1)).toEqual(['order', 'tenant']);
  });
  it('rejects activation if the expected database sandbox marker is missing', async (): Promise<void> => {
    const query = vi.fn().mockResolvedValue([]);
    const tx: TransactionContext = {
      executeNative: async <C, R>(fn: (connection: C) => Promise<R>): Promise<R> =>
        fn(query as unknown as C),
    };
    const adapter = new PostgresTrackingActivationAdapter(
      (): string => 'ref',
      '00000000-0000-4000-8000-000000000001',
    );
    await expect(
      adapter.enable(
        { tenantId: 'tenant', orderId: 'order', trackingNumber: 'abc', provider: 'fedex' },
        tx,
      ),
    ).rejects.toThrow();
    const first = (query.mock.calls[0][0] as TemplateStringsArray).join('?');
    expect(first).toContain('shipment_tracking_environment');
  });
  it('keeps an already active association without restarting its generation', async (): Promise<void> => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ order_id: 'order' }]);
    const tx: TransactionContext = {
      executeNative: async <C, R>(fn: (connection: C) => Promise<R>): Promise<R> =>
        fn(query as unknown as C),
    };
    const adapter = new PostgresTrackingActivationAdapter(
      (): string => 'ref',
      '00000000-0000-4000-8000-000000000001',
    );
    await expect(
      adapter.enable(
        { tenantId: 'tenant', orderId: 'order', trackingNumber: 'abc', provider: 'fedex' },
        tx,
      ),
    ).resolves.toBeUndefined();
  });
  it('disables only the specified tenant and fences any outstanding claim', async (): Promise<void> => {
    const query = vi.fn().mockResolvedValue([]);
    const tx: TransactionContext = {
      executeNative: async <C, R>(fn: (connection: C) => Promise<R>): Promise<R> =>
        fn(query as unknown as C),
    };
    const adapter = new PostgresTrackingActivationAdapter(
      (): string => 'ref',
      '00000000-0000-4000-8000-000000000001',
    );
    await adapter.disable('tenant', 'order', tx);
    const sql = (query.mock.calls[0][0] as TemplateStringsArray).join('?');
    expect(sql).toContain('generation = generation + 1');
    expect(query.mock.calls[0].slice(1)).toEqual([
      'order',
      'tenant',
      '00000000-0000-4000-8000-000000000001',
    ]);
  });
  it('does not activate if the tenant has no configured credential reference', async (): Promise<void> => {
    const query = vi.fn();
    const tx: TransactionContext = {
      executeNative: async <C, R>(fn: (connection: C) => Promise<R>): Promise<R> =>
        fn(query as unknown as C),
    };
    const adapter = new PostgresTrackingActivationAdapter(
      (): null => null,
      '00000000-0000-4000-8000-000000000001',
    );
    await expect(
      adapter.enable(
        { tenantId: 'tenant', orderId: 'order', trackingNumber: 'abc', provider: 'fedex' },
        tx,
      ),
    ).rejects.toThrow();
    expect(query).not.toHaveBeenCalled();
  });
});
