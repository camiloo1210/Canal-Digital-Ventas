import { describe, expect, it, vi } from 'vitest';
import { PostgresTrackingInvalidationAdapter } from '@/shipment-tracking/infrastructure/postgres-tracking-invalidation.adapter';
import type { TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';

describe('tracking invalidation persistence', (): void => {
  it('limits invalidation to the tenant and order and compares the new guide', async (): Promise<void> => {
    const query = vi.fn().mockResolvedValue([]);
    const tx: TransactionContext = {
      executeNative: async <C, R>(fn: (connection: C) => Promise<R>): Promise<R> =>
        fn(query as unknown as C),
    };
    await new PostgresTrackingInvalidationAdapter().invalidateIfChanged(
      'tenant',
      'order',
      'new-guide',
      tx,
    );
    const [parts, ...values] = query.mock.calls[0];
    expect((parts as TemplateStringsArray).join('?')).toMatch(/tenant_id\s*=\s*\?::uuid/i);
    expect((parts as TemplateStringsArray).join('?')).toMatch(/order_id\s*=\s*\?::uuid/i);
    expect((parts as TemplateStringsArray).join('?')).toMatch(
      /tracking_number\s+IS DISTINCT FROM/i,
    );
    expect(values).toEqual(['order', 'tenant', 'new-guide']);
  });
});
