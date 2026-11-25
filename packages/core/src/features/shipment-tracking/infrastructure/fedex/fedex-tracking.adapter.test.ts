import { describe, expect, it, vi } from 'vitest';
import { FedexTrackingAdapter } from '@/shipment-tracking/infrastructure/fedex/fedex-tracking.adapter';

const response = {
  output: {
    completeTrackResults: [
      {
        trackingNumber: '123',
        trackResults: [
          {
            trackingNumberInfo: { trackingNumber: '123' },
            scanEvents: [
              {
                eventType: 'DL',
                date: '2026-11-09T10:00:00-05:00',
                recipient: 'private person',
                scanLocation: { streetLines: ['private address'] },
              },
              { eventType: 'NEW', date: '2026-11-09' },
            ],
          },
        ],
      },
    ],
  },
};
const input = { trackingNumber: '123', credentialRef: 'store', environment: 'sandbox' as const };
function setup(payload: unknown): FedexTrackingAdapter {
  return new FedexTrackingAdapter(
    { getToken: vi.fn().mockResolvedValue('token'), invalidate: vi.fn() },
    vi
      .fn()
      .mockImplementation(
        async (): Promise<Response> => new Response(JSON.stringify(payload), { status: 200 }),
      ),
    (): Date => new Date('2026-11-09T16:00:00Z'),
  );
}
describe('FedEx tracking adapter', (): void => {
  it('normalizes documented events and drops private provider fields', async (): Promise<void> => {
    const result = await setup(response).track(input);
    expect(result.kind).toBe('found');
    if (result.kind !== 'found') return;
    expect(result.observations.map((item): string => item.status)).toEqual([
      'delivered',
      'unknown',
    ]);
    expect(result.observations[1]?.occurredAt).toBeNull();
    expect(result.observations[1]?.dateOnly).toBe('2026-11-09');
    expect(JSON.stringify(result)).not.toContain('private');
  });
  it('rejects results belonging to a different guide', async (): Promise<void> => {
    await expect(setup(response).track({ ...input, trackingNumber: '999' })).rejects.toThrow();
  });
  it('refreshes an expired access token once after a 401', async (): Promise<void> => {
    const auth = {
      getToken: vi.fn().mockResolvedValueOnce('old').mockResolvedValueOnce('new'),
      invalidate: vi.fn(),
    };
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(response), { status: 200 }));
    const adapter = new FedexTrackingAdapter(auth, fetcher);
    expect((await adapter.track(input)).kind).toBe('found');
    expect(auth.invalidate).toHaveBeenCalledWith('store');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('classifies a repeated 401 as an authorization failure', async (): Promise<void> => {
    const auth = { getToken: vi.fn().mockResolvedValue('token'), invalidate: vi.fn() };
    const adapter = new FedexTrackingAdapter(
      auth,
      vi.fn().mockImplementation(async (): Promise<Response> => new Response('', { status: 401 })),
    );
    await expect(adapter.track(input)).rejects.toMatchObject({ code: 'TRACKING_AUTHORIZATION' });
  });
  it('rejects multiple packages rather than attributing one to the order', async (): Promise<void> => {
    const group = response.output.completeTrackResults[0];
    const payload = {
      output: {
        completeTrackResults: [
          { ...group, trackResults: [group.trackResults[0], group.trackResults[0]] },
        ],
      },
    };
    await expect(setup(payload).track(input)).rejects.toThrow();
  });
  it('preserves the provider retry delay when rate limited', async (): Promise<void> => {
    const adapter = new FedexTrackingAdapter(
      { getToken: vi.fn().mockResolvedValue('token'), invalidate: vi.fn() },
      vi
        .fn()
        .mockResolvedValue(new Response('', { status: 429, headers: { 'Retry-After': '120' } })),
    );
    await expect(adapter.track(input)).rejects.toMatchObject({ retryAfterSeconds: 120 });
  });
  it('accepts an HTTP date in Retry-After', async (): Promise<void> => {
    const adapter = new FedexTrackingAdapter(
      { getToken: vi.fn().mockResolvedValue('token'), invalidate: vi.fn() },
      vi.fn().mockResolvedValue(
        new Response('', {
          status: 429,
          headers: { 'Retry-After': 'Mon, 09 Nov 2026 16:02:00 GMT' },
        }),
      ),
      (): Date => new Date('2026-11-09T16:00:00Z'),
    );
    await expect(adapter.track(input)).rejects.toMatchObject({ retryAfterSeconds: 120 });
  });
  it('reports authenticated delivery as unsupported', async (): Promise<void> => {
    expect(
      await setup({ errors: [{ code: 'TRACKING.AUTHENTICATEDDELIVERY.ERROR' }] }).track(input),
    ).toEqual({ kind: 'unsupported' });
  });
});
