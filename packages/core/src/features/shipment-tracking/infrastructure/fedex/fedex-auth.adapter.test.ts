import { describe, expect, it, vi } from 'vitest';
import { FedexAuthAdapter } from '@/shipment-tracking/infrastructure/fedex/fedex-auth.adapter';

describe('FedEx sandbox authorization', (): void => {
  it('uses sandbox credentials and reuses the token for the same credential reference', async (): Promise<void> => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ access_token: 'token-a', token_type: 'bearer', expires_in: 3600 }),
          { status: 200 },
        ),
      );
    const resolver = {
      resolve: vi.fn().mockResolvedValue({ clientId: 'id', clientSecret: 'secret' }),
    };
    const auth = new FedexAuthAdapter(resolver, fetcher, (): number => 1000);
    expect(await auth.getToken('shop-a')).toBe('token-a');
    expect(await auth.getToken('shop-a')).toBe('token-a');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]?.[0]).toBe('https://apis-sandbox.fedex.com/oauth/token');
  });
  it('does not reuse a different store credential or expired token', async (): Promise<void> => {
    let now = 0;
    const fetcher = vi
      .fn()
      .mockImplementation(
        async (): Promise<Response> =>
          new Response(
            JSON.stringify({ access_token: 'a', token_type: 'bearer', expires_in: 120 }),
            { status: 200 },
          ),
      );
    const auth = new FedexAuthAdapter(
      { resolve: vi.fn().mockResolvedValue({ clientId: 'id', clientSecret: 'secret' }) },
      fetcher,
      (): number => now,
    );
    await auth.getToken('shop-a');
    await auth.getToken('shop-b');
    now = 61000;
    await auth.getToken('shop-a');
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it('marks temporary authorization server failures as retryable', async (): Promise<void> => {
    const auth = new FedexAuthAdapter(
      { resolve: vi.fn().mockResolvedValue({ clientId: 'id', clientSecret: 'secret' }) },
      vi.fn().mockResolvedValue(new Response('', { status: 503 })),
      (): number => 0,
    );
    await expect(auth.getToken('store')).rejects.toMatchObject({ retryable: true });
  });
  it('preserves a rate-limit delay from the OAuth endpoint', async (): Promise<void> => {
    const auth = new FedexAuthAdapter(
      { resolve: vi.fn().mockResolvedValue({ clientId: 'id', clientSecret: 'secret' }) },
      vi
        .fn()
        .mockResolvedValue(new Response('', { status: 429, headers: { 'Retry-After': '120' } })),
      (): number => 0,
    );
    await expect(auth.getToken('store')).rejects.toMatchObject({
      retryable: true,
      retryAfterSeconds: 120,
    });
  });
  it('rejects invalid responses without exposing secrets', async (): Promise<void> => {
    const auth = new FedexAuthAdapter(
      { resolve: vi.fn().mockResolvedValue({ clientId: 'id', clientSecret: 'private-secret' }) },
      vi.fn().mockResolvedValue(new Response('private-secret', { status: 401 })),
      (): number => 0,
    );
    await expect(auth.getToken('shop')).rejects.toThrow('FedEx authorization failed');
  });
});
