import { describe, expect, it, vi } from 'vitest';
import type postgres from 'postgres';
import { PostgresBuyerTrackingReadAdapter } from '@/shipment-tracking/infrastructure/postgres-buyer-tracking-read.adapter';

describe('buyer tracking reader', (): void => {
  it('returns no tracking when no authorized association exists', async (): Promise<void> => {
    const sql = vi.fn().mockResolvedValue([]) as unknown as postgres.Sql<Record<string, unknown>>;
    const adapter = new PostgresBuyerTrackingReadAdapter(sql, '2026-11-09T12:00:00Z');
    expect(
      await adapter.findByBuyer(
        '00000000-0000-4000-8000-000000000001',
        '00000000-0000-4000-8000-000000000002',
        '00000000-0000-4000-8000-000000000003',
      ),
    ).toBeNull();
  });
  it('orders date-only events by their date instead of their insertion order', async (): Promise<void> => {
    const query = vi.fn().mockResolvedValue([]);
    const reader = new PostgresBuyerTrackingReadAdapter(
      query as unknown as postgres.Sql<Record<string, unknown>>,
      '2026-11-09T12:00:00Z',
    );
    await reader.findByBuyer(
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000002',
      '00000000-0000-4000-8000-000000000003',
    );
    expect((query.mock.calls[0][0] as TemplateStringsArray).join('?')).toMatch(
      /ORDER BY COALESCE\(.*date_only/i,
    );
  });
  it('projects only minimal tracking fields', async (): Promise<void> => {
    const sql = vi.fn().mockResolvedValue([
      {
        active: true,
        result: 'found',
        last_success_at: new Date('2026-11-09T11:00:00Z'),
        events: [{ status: 'delivered', occurredAt: '2026-11-09T10:00:00Z', dateOnly: null }],
      },
    ]) as unknown as postgres.Sql<Record<string, unknown>>;
    const adapter = new PostgresBuyerTrackingReadAdapter(sql, '2026-11-09T12:00:00Z');
    expect(
      await adapter.findByBuyer(
        '00000000-0000-4000-8000-000000000001',
        '00000000-0000-4000-8000-000000000002',
        '00000000-0000-4000-8000-000000000003',
      ),
    ).toEqual({
      state: 'current',
      lastSuccessfulAt: '2026-11-09T11:00:00.000Z',
      events: [{ status: 'delivered', occurredAt: '2026-11-09T10:00:00Z', dateOnly: null }],
    });
  });
});
