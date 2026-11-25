import { describe, expect, it, vi } from 'vitest';
import type { ClaimedJob } from '@canaldigital/packages/core';
import type postgres from 'postgres';
import { TrackingShipmentJobRepository } from '@/worker/shipment-creation-runtime';

const createJob = (leaseToken: string): ClaimedJob => ({
  tenantId: 'tenant-123',
  orderId: 'order-123',
  leaseToken,
  leaseSeconds: 180,
  attempts: 1,
  claimedFrom: 'queued',
});

describe('TrackingShipmentJobRepository', (): void => {
  it('tracks leases that attempted creating and allows forgetting them', async (): Promise<void> => {
    const fakeSql = vi.fn() as unknown as postgres.Sql<Record<string, unknown>>;
    const repo = new TrackingShipmentJobRepository(fakeSql);
    const job = createJob('lease-abc-123');

    expect(repo.wasMarkedCreating(job)).toBe(false);

    vi.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(repo)), 'markCreating').mockResolvedValue(
      true,
    );

    const result = await repo.markCreating(job);
    expect(result).toBe(true);
    expect(repo.wasMarkedCreating(job)).toBe(true);

    repo.forget(job);
    expect(repo.wasMarkedCreating(job)).toBe(false);
  });
});
