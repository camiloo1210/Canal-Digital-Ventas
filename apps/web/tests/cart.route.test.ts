import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/store/cart/route';
import { POST as SYNC } from '@/app/api/store/cart/sync/route';
import { POST as MERGE } from '@/app/api/store/cart/merge/route';
import { createClient } from '@/lib/supabase/server';
import { cartDi } from '@/features/cart/di/cart.di';

vi.mock('@/lib/supabase/server', (): object => ({ createClient: vi.fn() }));
vi.mock('@/features/cart/di/cart.di', (): object => ({
  cartDi: {
    resolveGetBuyerCartUseCase: vi.fn(),
    resolveSyncBuyerCartUseCase: vi.fn(),
    resolveMergeBuyerCartUseCase: vi.fn(),
  },
}));

const sessionUser = crypto.randomUUID();
const productId = crypto.randomUUID();
const cart = { items: [], version: 3, updatedAt: 'a', expiresAt: 'b' };
const getExecute = vi.fn();
const syncExecute = vi.fn();
const mergeExecute = vi.fn();

function named(name: string, extra: object = {}): Error {
  const error = Object.assign(new Error(name), extra);
  error.name = name;
  return error;
}

function post(path: string, body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(`https://shop.test/api/store/cart${path}`, {
    method: 'POST',
    headers: { host: 'shop.test', 'sec-fetch-site': 'same-origin', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const validSync = { tenant: 'my-store', items: [{ productId, quantity: 2 }], baseVersion: 1 };

describe('buyer cart route handlers', (): void => {
  beforeEach((): void => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation((): void => undefined);
    getExecute.mockReset().mockResolvedValue(cart);
    syncExecute.mockReset().mockResolvedValue({ cart, dropped: [] });
    mergeExecute.mockReset().mockResolvedValue({ cart, dropped: [] });
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: sessionUser } } }) },
    } as unknown as Awaited<ReturnType<typeof createClient>>);
    vi.mocked(cartDi.resolveGetBuyerCartUseCase).mockReturnValue({
      execute: getExecute,
    } as unknown as ReturnType<typeof cartDi.resolveGetBuyerCartUseCase>);
    vi.mocked(cartDi.resolveSyncBuyerCartUseCase).mockReturnValue({
      execute: syncExecute,
    } as unknown as ReturnType<typeof cartDi.resolveSyncBuyerCartUseCase>);
    vi.mocked(cartDi.resolveMergeBuyerCartUseCase).mockReturnValue({
      execute: mergeExecute,
    } as unknown as ReturnType<typeof cartDi.resolveMergeBuyerCartUseCase>);
  });

  it('GET returns the cart with no-store', async (): Promise<void> => {
    const response = await GET(
      new Request('https://shop.test/api/store/cart?tenant=my-store', {
        headers: { host: 'shop.test', 'sec-fetch-site': 'same-origin' },
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ cart });
    expect(getExecute).toHaveBeenCalledWith({ userId: sessionUser, tenantSlug: 'my-store' });
  });

  it('GET rejects an invalid tenant slug', async (): Promise<void> => {
    const response = await GET(
      new Request('https://shop.test/api/store/cart?tenant=Bad_Slug', {
        headers: { host: 'shop.test', 'sec-fetch-site': 'same-origin' },
      }),
    );
    expect(response.status).toBe(400);
  });

  it('returns 401 for guests', async (): Promise<void> => {
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    } as unknown as Awaited<ReturnType<typeof createClient>>);
    const response = await SYNC(post('/sync', validSync));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'unauthorized' });
    expect(syncExecute).not.toHaveBeenCalled();
  });

  it('returns 403 for cross-site and header-less requests', async (): Promise<void> => {
    const cross = await SYNC(post('/sync', validSync, { 'sec-fetch-site': 'cross-site' }));
    expect(cross.status).toBe(403);
    const bareHeaders = new Request('https://shop.test/api/store/cart/sync', {
      method: 'POST',
      body: JSON.stringify(validSync),
    });
    expect((await SYNC(bareHeaders)).status).toBe(403);
    const wrongOrigin = new Request('https://shop.test/api/store/cart/sync', {
      method: 'POST',
      headers: { host: 'shop.test', origin: 'https://evil.test' },
      body: JSON.stringify(validSync),
    });
    expect((await SYNC(wrongOrigin)).status).toBe(403);
    expect(syncExecute).not.toHaveBeenCalled();
  });

  it('accepts a matching Origin when Sec-Fetch-Site is absent', async (): Promise<void> => {
    const request = new Request('https://shop.test/api/store/cart/sync', {
      method: 'POST',
      headers: { host: 'shop.test', origin: 'https://shop.test' },
      body: JSON.stringify(validSync),
    });
    expect((await SYNC(request)).status).toBe(200);
  });

  it('returns 413 on actual bytes even without a content-length header', async (): Promise<void> => {
    const big = JSON.stringify({ ...validSync, pad: 'x'.repeat(17 * 1024) });
    const response = await SYNC(post('/sync', big));
    expect(response.status).toBe(413);
    expect(syncExecute).not.toHaveBeenCalled();
  });

  it('returns 400 for malformed JSON and invalid bodies', async (): Promise<void> => {
    expect((await SYNC(post('/sync', '{nope'))).status).toBe(400);
    const invalid = [
      { ...validSync, items: [{ productId: 'nope', quantity: 1 }] },
      { ...validSync, items: [{ productId, quantity: 0 }] },
      { ...validSync, items: [{ productId, quantity: 100 }] },
      { ...validSync, items: [{ productId, quantity: 1.5 }] },
      { ...validSync, baseVersion: -1 },
      { ...validSync, baseVersion: 'x' },
      { ...validSync, tenant: 'UPPER' },
      {
        ...validSync,
        items: Array.from({ length: 51 }, (): object => ({
          productId: crypto.randomUUID(),
          quantity: 1,
        })),
      },
      {
        ...validSync,
        items: [
          { productId, quantity: 1 },
          { productId, quantity: 1 },
        ],
      },
    ];
    for (const body of invalid) expect((await SYNC(post('/sync', body))).status).toBe(400);
    expect((await MERGE(post('/merge', { tenant: 'my-store' }))).status).toBe(400);
    expect(syncExecute).not.toHaveBeenCalled();
  });

  it('syncs using the session user, never a body-provided user, and parses text/plain beacons', async (): Promise<void> => {
    const response = await SYNC(
      post(
        '/sync',
        { ...validSync, userId: 'attacker', tenantId: 'x' },
        { 'content-type': 'text/plain;charset=UTF-8' },
      ),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ cart, dropped: [] });
    expect(syncExecute).toHaveBeenCalledWith({
      userId: sessionUser,
      tenantSlug: 'my-store',
      items: [{ productId, quantity: 2 }],
      baseVersion: 1,
    });
  });

  it('merges using the session user', async (): Promise<void> => {
    const response = await MERGE(
      post('/merge', { tenant: 'my-store', items: [{ productId, quantity: 1 }], userId: 'evil' }),
    );
    expect(response.status).toBe(200);
    expect(mergeExecute).toHaveBeenCalledWith({
      userId: sessionUser,
      tenantSlug: 'my-store',
      items: [{ productId, quantity: 1 }],
    });
  });

  it('maps a version conflict to 409 with the server cart', async (): Promise<void> => {
    syncExecute.mockRejectedValue(named('CartVersionConflictException', { serverCart: cart }));
    const response = await SYNC(post('/sync', validSync));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'conflict', cart });
  });

  it('maps an unknown store to 404 and anything else to a masked 500', async (): Promise<void> => {
    mergeExecute.mockRejectedValue(named('BuyerCartStoreNotFoundException'));
    expect((await MERGE(post('/merge', { tenant: 'my-store', items: [] }))).status).toBe(404);
    syncExecute.mockRejectedValue(new Error('password=secret'));
    const response = await SYNC(post('/sync', validSync));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'unavailable' });
    expect(console.error).toHaveBeenCalledWith('[Cart] request failed', 'Error');
  });
});
