import { afterEach, describe, expect, it, vi } from 'vitest';
import { LemonSqueezyCheckoutAdapter } from '@/payments/infrastructure/adapters/lemon-squeezy-checkout.adapter';
import type { CreateProviderCheckout } from '@/payments/application/ports/out/provider-checkout.port';

const input: CreateProviderCheckout = {
  paymentId: '550e8400-e29b-41d4-a716-446655440001',
  orderId: '550e8400-e29b-41d4-a716-446655440002',
  tenantId: '550e8400-e29b-41d4-a716-446655440003',
  amountCents: 1500,
  currency: 'USD',
  storeId: '12',
  expiresAt: '2026-10-16T12:00:00.000Z',
  environment: 'test',
};

function response(overrides: Record<string, unknown> = {}): Response {
  return Response.json({
    data: {
      type: 'checkouts',
      id: 'checkout-1',
      attributes: {
        url: 'https://demo.lemonsqueezy.com/checkout/custom/checkout-1',
        store_id: 12,
        variant_id: 34,
        test_mode: true,
        expires_at: input.expiresAt,
        preview: { currency: 'USD', subtotal: 1500, total: 1500, tax: 0, discount_total: 0 },
        ...overrides,
      },
    },
  });
}

describe('Lemon Squeezy checkout HTTP boundary', (): void => {
  afterEach((): void => {
    vi.unstubAllGlobals();
  });

  it('uses the whole-second expiry returned by the real provider', async (): Promise<void> => {
    let request: unknown;
    vi.stubGlobal('fetch', async (_url: string, options: RequestInit): Promise<Response> => {
      request = JSON.parse(String(options.body));
      return response({ expires_at: '2026-10-16T12:00:00Z' });
    });
    await expect(
      new LemonSqueezyCheckoutAdapter('secret', '34', 'https://app.example.test/').create({
        ...input,
        expiresAt: '2026-10-16T12:00:00.825Z',
      }),
    ).resolves.toHaveProperty('checkoutId', 'checkout-1');
    expect(request).toMatchObject({
      data: { attributes: { expires_at: '2026-10-16T12:00:00.000Z' } },
    });
  });

  it('sends 1500 cents unchanged, expiry, test mode and only the configured variant', async (): Promise<void> => {
    let request: Record<string, unknown> | undefined;
    vi.stubGlobal('fetch', async (_url: string, options: RequestInit): Promise<Response> => {
      request = JSON.parse(String(options.body)) as Record<string, unknown>;
      return response();
    });
    const result = await new LemonSqueezyCheckoutAdapter(
      'secret',
      '34',
      'https://app.example.test/',
    ).create(input);
    expect(request).toMatchObject({
      data: {
        attributes: {
          custom_price: 1500,
          test_mode: true,
          expires_at: input.expiresAt,
          preview: true,
          product_options: {
            enabled_variants: [34],
            redirect_url: `https://app.example.test/#order-${input.orderId}`,
            receipt_link_url: `https://app.example.test/#order-${input.orderId}`,
          },
          checkout_options: { discount: false },
          checkout_data: {
            custom: {
              payment_id: input.paymentId,
              order_id: input.orderId,
              tenant_id: input.tenantId,
            },
          },
        },
      },
    });
    expect(result).toEqual({
      checkoutId: 'checkout-1',
      checkoutUrl: 'https://demo.lemonsqueezy.com/checkout/custom/checkout-1',
    });
  });

  it.each([
    '',
    '/purchases',
    'javascript:alert(1)',
    'http://app.example.test/',
    'https://user:password@app.example.test/',
    'https://user@app.example.test/',
  ])(
    'rejects an unsafe return URL before contacting the provider: %s',
    async (url: string): Promise<void> => {
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
      await expect(
        new LemonSqueezyCheckoutAdapter('secret', '34', url).create(input),
      ).rejects.toMatchObject({
        outcome: 'REJECTED',
        reasonCode: 'INVALID_CONFIGURATION',
      });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it('allows a local test checkout to return to the development app', async (): Promise<void> => {
    const fetchMock = vi.fn().mockResolvedValue(response());
    vi.stubGlobal('fetch', fetchMock);
    await new LemonSqueezyCheckoutAdapter('secret', '34', 'http://localhost:3000/').create(input);
    const options: RequestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(options.body))).toMatchObject({
      data: {
        attributes: {
          product_options: { redirect_url: `http://localhost:3000/#order-${input.orderId}` },
        },
      },
    });
  });

  it('rejects HTTP localhost return URLs for live payments', async (): Promise<void> => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      new LemonSqueezyCheckoutAdapter('secret', '34', 'http://localhost:3000/').create({
        ...input,
        environment: 'production',
      }),
    ).rejects.toMatchObject({ outcome: 'REJECTED', reasonCode: 'INVALID_CONFIGURATION' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    { url: 'https://lemonsqueezy.com.attacker.test/pay' },
    { url: 'http://demo.lemonsqueezy.com/pay' },
    { url: 'https://user:pass@demo.lemonsqueezy.com/pay' },
    { preview: { currency: 'EUR', total: 1500 } },
    { preview: { currency: 'USD', total: 1600 } },
    { store_id: 99 },
    { test_mode: false },
    { variant_id: 99 },
    { expires_at: null },
  ])(
    'rejects an untrusted or financially different response %j',
    async (attributes: Record<string, unknown>): Promise<void> => {
      vi.stubGlobal('fetch', async (): Promise<Response> => response(attributes));
      await expect(
        new LemonSqueezyCheckoutAdapter('secret', '34', 'https://app.example.test/').create(input),
      ).rejects.toMatchObject({ outcome: 'AMBIGUOUS' });
    },
  );

  it.each([429, 500, 502])(
    'never retries an ambiguous HTTP %s',
    async (status: number): Promise<void> => {
      let calls = 0;
      vi.stubGlobal('fetch', async (): Promise<Response> => {
        calls++;
        return new Response('provider secret', { status });
      });
      await expect(
        new LemonSqueezyCheckoutAdapter('secret', '34', 'https://app.example.test/').create(input),
      ).rejects.toMatchObject({ outcome: 'AMBIGUOUS' });
      expect(calls).toBe(1);
    },
  );

  it('classifies a definitive 422 without exposing provider content', async (): Promise<void> => {
    vi.stubGlobal(
      'fetch',
      async (): Promise<Response> => new Response('private API key secret', { status: 422 }),
    );
    await expect(
      new LemonSqueezyCheckoutAdapter('secret', '34', 'https://app.example.test/').create(input),
    ).rejects.toMatchObject({ outcome: 'REJECTED', reasonCode: 'HTTP_422' });
    await expect(
      new LemonSqueezyCheckoutAdapter('secret', '34', 'https://app.example.test/').create(input),
    ).rejects.not.toThrow('private API');
  });

  it('classifies a network failure as ambiguous without retrying', async (): Promise<void> => {
    let calls = 0;
    vi.stubGlobal('fetch', async (): Promise<Response> => {
      calls++;
      throw new TypeError('network');
    });
    await expect(
      new LemonSqueezyCheckoutAdapter('secret', '34', 'https://app.example.test/').create(input),
    ).rejects.toMatchObject({ outcome: 'AMBIGUOUS' });
    expect(calls).toBe(1);
  });

  it('does not send invalid minor units to the provider', async (): Promise<void> => {
    let calls = 0;
    vi.stubGlobal('fetch', async (): Promise<Response> => {
      calls++;
      return response();
    });
    await expect(
      new LemonSqueezyCheckoutAdapter('secret', '34', 'https://app.example.test/').create({
        ...input,
        amountCents: 1.5,
      }),
    ).rejects.toThrow();
    expect(calls).toBe(0);
  });
});
