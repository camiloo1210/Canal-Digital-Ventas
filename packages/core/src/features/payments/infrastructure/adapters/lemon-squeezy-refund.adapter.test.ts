import { afterEach, describe, expect, it, vi } from 'vitest';
import { LemonSqueezyRefundAdapter } from '@/payments/infrastructure/adapters/lemon-squeezy-refund.adapter';
import type { DispatchProviderRefund } from '@/payments/application/ports/out/provider-refund.port';

const input: DispatchProviderRefund = {
  providerOrderId: '123',
  storeId: '12',
  currency: 'USD',
  environment: 'test',
  amountCents: 500,
};
function response(attributes: Record<string, unknown> = {}, id = '123'): Response {
  return Response.json({
    data: {
      type: 'orders',
      id,
      attributes: { store_id: 12, currency: 'USD', test_mode: true, ...attributes },
    },
  });
}
describe('Lemon Squeezy refund transport', (): void => {
  afterEach((): void => {
    vi.unstubAllGlobals();
  });
  it('sends one refund POST with unchanged minor units and never fabricates a refund identifier', async (): Promise<void> => {
    const request = vi.fn(async (): Promise<Response> => response());
    vi.stubGlobal('fetch', request);
    await expect(new LemonSqueezyRefundAdapter('private-key').dispatch(input)).resolves.toEqual({
      providerOrderId: '123',
    });
    expect(request).toHaveBeenCalledTimes(1);
    const [url, options] = request.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.lemonsqueezy.com/v1/orders/123/refund');
    expect(options).toMatchObject({ method: 'POST', redirect: 'error' });
    expect(JSON.parse(String(options.body))).toEqual({
      data: { type: 'orders', id: '123', attributes: { amount: 500 } },
    });
  });
  it.each([400, 401, 403, 404, 422])(
    'classifies HTTP %i as a definitive rejection',
    async (httpStatus: number): Promise<void> => {
      const request = vi.fn(
        async (): Promise<Response> => new Response('', { status: httpStatus }),
      );
      vi.stubGlobal('fetch', request);
      await expect(new LemonSqueezyRefundAdapter('key').dispatch(input)).rejects.toMatchObject({
        outcome: 'REJECTED',
        httpStatus,
      });
      expect(request).toHaveBeenCalledTimes(1);
    },
  );
  it.each([408, 409, 429, 500, 502, 503])(
    'keeps HTTP %i ambiguous without retrying',
    async (httpStatus: number): Promise<void> => {
      const request = vi.fn(
        async (): Promise<Response> => new Response('', { status: httpStatus }),
      );
      vi.stubGlobal('fetch', request);
      await expect(new LemonSqueezyRefundAdapter('key').dispatch(input)).rejects.toMatchObject({
        outcome: 'AMBIGUOUS',
        httpStatus,
      });
      expect(request).toHaveBeenCalledTimes(1);
    },
  );
  it.each([{ store_id: 99 }, { currency: 'EUR' }, { test_mode: false }])(
    'treats successful mismatched correlation as ambiguous',
    async (attributes: Record<string, unknown>): Promise<void> => {
      vi.stubGlobal('fetch', async (): Promise<Response> => response(attributes));
      await expect(new LemonSqueezyRefundAdapter('key').dispatch(input)).rejects.toMatchObject({
        outcome: 'AMBIGUOUS',
      });
    },
  );
  it('treats a different response order as ambiguous', async (): Promise<void> => {
    vi.stubGlobal('fetch', async (): Promise<Response> => response({}, '999'));
    await expect(new LemonSqueezyRefundAdapter('key').dispatch(input)).rejects.toMatchObject({
      outcome: 'AMBIGUOUS',
    });
  });
  it('does not repeat a POST after a transport timeout', async (): Promise<void> => {
    const request = vi.fn(async (): Promise<Response> => {
      throw new DOMException('private diagnostic', 'TimeoutError');
    });
    vi.stubGlobal('fetch', request);
    await expect(new LemonSqueezyRefundAdapter('key').dispatch(input)).rejects.toMatchObject({
      outcome: 'AMBIGUOUS',
      httpStatus: null,
    });
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('rejects malformed local input before sending anything', async (): Promise<void> => {
    const request = vi.fn();
    vi.stubGlobal('fetch', request);
    await expect(
      new LemonSqueezyRefundAdapter('key').dispatch({
        ...input,
        providerOrderId: '123/../../checkouts',
      }),
    ).rejects.toMatchObject({ outcome: 'REJECTED' });
    expect(request).not.toHaveBeenCalled();
  });
});
