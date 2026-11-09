import { describe, expect, it, vi } from 'vitest';
import type postgres from 'postgres';
import { PostgresSellerTrackingReadAdapter } from '@/shipment-tracking/infrastructure/postgres-seller-tracking-read.adapter';
describe('seller tracking reader', (): void => {
  it('marks a paused connection for seller attention', async (): Promise<void> => {
    const query = vi.fn().mockResolvedValue([
      {
        active: true,
        paused: true,
        result: 'found',
        last_success_at: new Date('2026-11-09T11:00:00Z'),
        last_error_at: new Date('2026-11-09T11:30:00Z'),
        events: [],
      },
    ]) as unknown as postgres.Sql<Record<string, unknown>>;
    const reader = new PostgresSellerTrackingReadAdapter(query, '2026-11-09T12:00:00Z');
    expect(
      await reader.findBySeller(
        '00000000-0000-4000-8000-000000000001',
        '00000000-0000-4000-8000-000000000002',
        '00000000-0000-4000-8000-000000000003',
        '00000000-0000-4000-8000-000000000004',
      ),
    ).toMatchObject({ state: 'unavailable', needsAttention: true });
  });
  it('returns no tracking when tenant access is missing', async (): Promise<void> => {
    const query = vi.fn().mockResolvedValue([]) as unknown as postgres.Sql<Record<string, unknown>>;
    const reader = new PostgresSellerTrackingReadAdapter(query, '2026-11-09T12:00:00Z');
    expect(
      await reader.findBySeller(
        '00000000-0000-4000-8000-000000000001',
        '00000000-0000-4000-8000-000000000002',
        '00000000-0000-4000-8000-000000000003',
        '00000000-0000-4000-8000-000000000004',
      ),
    ).toBeNull();
  });
});
