import { describe, expect, it } from 'vitest';
import {
  CART_RETENTION_BATCH_SIZE,
  CART_RETENTION_INTERVAL_MS,
  loadCartRetentionWorkerConfig,
} from '@/carts/infrastructure/cart-retention-worker-config';

describe('loadCartRetentionWorkerConfig', (): void => {
  it('uses a 15 minute interval and a bounded batch', (): void => {
    const config = loadCartRetentionWorkerConfig({
      CART_RETENTION_DATABASE_URL: 'postgres://u:p@db.example:5432/postgres',
    });
    expect(config.intervalMs).toBe(15 * 60_000);
    expect(config.intervalMs).toBe(CART_RETENTION_INTERVAL_MS);
    expect(config.batchSize).toBe(CART_RETENTION_BATCH_SIZE);
    expect(config.batchSize).toBeLessThanOrEqual(1000);
  });

  it.each([undefined, '', 'not a url', 'http://db.example'])(
    'rejects %s without echoing it',
    (value: string | undefined): void => {
      expect(() => loadCartRetentionWorkerConfig({ CART_RETENTION_DATABASE_URL: value })).toThrow(
        'Invalid CART_RETENTION_DATABASE_URL',
      );
    },
  );

  it('does not leak credentials in the error', (): void => {
    try {
      loadCartRetentionWorkerConfig({ CART_RETENTION_DATABASE_URL: 'mysql://u:hunter2@h/db' });
      expect.unreachable();
    } catch (error: unknown) {
      expect((error as Error).message).not.toContain('hunter2');
    }
  });
});
