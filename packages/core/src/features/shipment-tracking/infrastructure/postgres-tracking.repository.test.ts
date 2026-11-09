import { describe, expect, it, vi } from 'vitest';
import type postgres from 'postgres';
import { PostgresTrackingRepository } from '@/shipment-tracking/infrastructure/postgres-tracking.repository';
import type { TrackingClaim } from '@/shipment-tracking/application/ports/out/tracking-repository.port';

const claim: TrackingClaim = {
  tenantId: crypto.randomUUID(),
  orderId: crypto.randomUUID(),
  trackingNumber: '123',
  credentialRef: 'ref',
  generation: 1,
  attempts: 1,
  environment: 'sandbox',
  leaseToken: crypto.randomUUID(),
};
describe('tracking fencing persistence', (): void => {
  it('uses the configured interval when scheduling the next successful poll', async (): Promise<void> => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([{ order_id: claim.orderId }])
      .mockResolvedValueOnce([]);
    const pool = {
      begin: async <T>(work: (sql: typeof query) => Promise<T>): Promise<T> => work(query),
    } as unknown as postgres.Sql<Record<string, unknown>>;
    const repository = new PostgresTrackingRepository(pool, 900000);
    expect(
      await repository.apply(claim, { kind: 'found', observations: [] }, '2026-11-09T12:00:00Z'),
    ).toBe('applied');
    expect(query.mock.calls[1]).toContain(900000);
  });
  it('uses a slower reconciliation interval after a confirmed delivery', async (): Promise<void> => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([{ order_id: claim.orderId }])
      .mockResolvedValue([]);
    const pool = {
      begin: async <T>(work: (sql: typeof query) => Promise<T>): Promise<T> => work(query),
    } as unknown as postgres.Sql<Record<string, unknown>>;
    const repository = new PostgresTrackingRepository(pool, 900000, 86400000);
    const observation = {
      providerCode: 'DL',
      providerEventId: null,
      status: 'delivered' as const,
      occurredAt: '2026-11-09T10:00:00Z',
      dateOnly: null,
      receivedAt: '2026-11-09T10:01:00Z',
      fingerprint: 'hash',
      mappingVersion: 1,
    };
    await repository.apply(
      claim,
      { kind: 'found', observations: [observation] },
      '2026-11-09T12:00:00Z',
    );
    expect(query.mock.calls[2]).toContain(86400000);
  });
  it('removes only expired observations while preserving the newest active observation', async (): Promise<void> => {
    const query = vi.fn().mockResolvedValue([]);
    const repository = new PostgresTrackingRepository(
      query as unknown as postgres.Sql<Record<string, unknown>>,
    );
    await repository.purgeExpired('2026-08-01T00:00:00Z');
    const statement = (query.mock.calls[0][0] as TemplateStringsArray).join('?');
    expect(statement).toMatch(/DELETE FROM sales\.shipment_tracking_observations/i);
    expect(statement).toMatch(/MAX\(.*id\)/i);
    expect(statement).toMatch(/MAX\(.*occurred_at\)/i);
    expect(statement).toMatch(/MAX\(.*date_only\)/i);
    expect(query.mock.calls[0]).toContain('2026-08-01T00:00:00Z');
  });
  it('returns operational counts without exposing order or tenant identifiers', async (): Promise<void> => {
    const query = vi.fn().mockResolvedValue([
      {
        active_count: 4,
        paused_count: 1,
        failed_count: 2,
        due_count: 3,
        oldest_age_seconds: 7200,
      },
    ]);
    const repository = new PostgresTrackingRepository(
      query as unknown as postgres.Sql<Record<string, unknown>>,
    );
    expect(await repository.readOperationalMetrics()).toEqual({
      active: 4,
      paused: 1,
      failed: 2,
      due: 3,
      oldestAgeSeconds: 7200,
    });
  });
  it('reports an unknown age when no query has succeeded', async (): Promise<void> => {
    const query = vi.fn().mockResolvedValue([
      {
        active_count: 1,
        paused_count: 0,
        failed_count: 0,
        due_count: 1,
        oldest_age_seconds: null,
      },
    ]);
    const repository = new PostgresTrackingRepository(
      query as unknown as postgres.Sql<Record<string, unknown>>,
    );
    expect((await repository.readOperationalMetrics()).oldestAgeSeconds).toBeNull();
  });
  it('only claims tracking when the saved manual guide still matches', async (): Promise<void> => {
    const query = vi.fn().mockResolvedValue([]);
    const repository = new PostgresTrackingRepository(
      query as unknown as postgres.Sql<Record<string, unknown>>,
    );
    await repository.claimDue('2026-11-09T12:00:00Z', crypto.randomUUID());
    expect((query.mock.calls[0][0] as TemplateStringsArray).join('?')).toMatch(/manual_shipments/i);
  });
  it('does not write observations when generation or lease is no longer current', async (): Promise<void> => {
    const query = vi.fn().mockResolvedValue([]);
    const pool = {
      begin: async <T>(work: (sql: typeof query) => Promise<T>): Promise<T> => work(query),
    } as unknown as postgres.Sql<Record<string, unknown>>;
    const repository = new PostgresTrackingRepository(pool);
    const result = await repository.apply(
      claim,
      { kind: 'found', observations: [] },
      '2026-11-09T12:00:00Z',
    );
    expect(result).toBe('stale');
    expect(query).toHaveBeenCalledTimes(1);
  });
});
