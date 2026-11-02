import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCartStore, type CartItem } from '@/features/cart/store/cart.store';
import { createCartSyncController } from '@/features/cart/sync/cart-sync.controller';
import type { CartApiCart, CartApiItem } from '@/features/cart/types/cart-api.types';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

function apiItem(productId: string, quantity: number, maxQuantity = 10): CartApiItem {
  return {
    productId,
    name: `Name ${productId.slice(0, 2)}`,
    sku: 'sku',
    unitPriceCents: 1250,
    quantity,
    maxQuantity,
    imageUrl: null,
  };
}
function apiCart(items: CartApiItem[], version: number): CartApiCart {
  return { items, version, updatedAt: 'u', expiresAt: 'e' };
}
function local(productId: string, quantity: number): CartItem {
  return { productId, name: `Local ${productId.slice(0, 2)}`, price: 5, quantity, maxQuantity: 10 };
}
function reply(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

type Call = { url: string; method: string; body: unknown };
const calls: Call[] = [];
const fetchMock = vi.fn();
const queue: Response[] = [];
let hold: Promise<Response> | null = null;
const sendBeacon = vi.fn();

const controllers: ReturnType<typeof createCartSyncController>[] = [];
function setup(
  tenantSlug = 'shop',
  onDropped?: (n: { names: string[]; count: number }) => void,
): ReturnType<typeof createCartSyncController> {
  const controller = createCartSyncController({
    tenantSlug,
    store: useCartStore,
    fetchFn: fetchMock as unknown as typeof fetch,
    sendBeacon,
    onDropped,
  });
  controllers.push(controller);
  return controller;
}
function syncCalls(): Call[] {
  return calls.filter((call): boolean => call.url.endsWith('/sync'));
}
async function started(controller: ReturnType<typeof createCartSyncController>): Promise<void> {
  await controller.start();
  await vi.advanceTimersByTimeAsync(0);
}

describe('cart sync controller', (): void => {
  beforeEach((): void => {
    vi.useFakeTimers();
    calls.length = 0;
    queue.length = 0;
    hold = null;
    fetchMock.mockReset().mockImplementation(async (url: string, init?: RequestInit) => {
      if (hold) return hold;
      calls.push({
        url,
        method: init?.method ?? 'GET',
        body: init?.body ? JSON.parse(init.body as string) : undefined,
      });
      return queue.shift() ?? reply(500, {});
    });
    sendBeacon.mockReset().mockReturnValue(true);
    useCartStore.setState({
      tenantSlug: null,
      items: [],
      serverVersion: null,
      hydration: 'idle',
    });
  });
  afterEach((): void => {
    for (const controller of controllers.splice(0)) controller.stop();
    vi.useRealTimers();
  });

  it('hydrates with GET when the local cart is empty and maps cents to price', async (): Promise<void> => {
    queue.push(reply(200, { cart: apiCart([apiItem(A, 2)], 4) }));
    await started(setup());
    expect(calls[0]).toMatchObject({ url: '/api/store/cart?tenant=shop', method: 'GET' });
    const state = useCartStore.getState();
    expect(state.hydration).toBe('ready');
    expect(state.serverVersion).toBe(4);
    expect(state.tenantSlug).toBe('shop');
    expect(state.items).toEqual([
      { productId: A, name: 'Name 11', price: 12.5, quantity: 2, maxQuantity: 10 },
    ]);
  });

  it('merges the guest cart first when local items exist, then replaces local with the result', async (): Promise<void> => {
    useCartStore.setState({ tenantSlug: 'shop', items: [local(A, 1)] });
    queue.push(reply(200, { cart: apiCart([apiItem(A, 3), apiItem(B, 1)], 7), dropped: [] }));
    await started(setup());
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      url: '/api/store/cart/merge',
      body: { tenant: 'shop', items: [{ productId: A, quantity: 1 }] },
    });
    expect(useCartStore.getState().items.map((i): number => i.quantity)).toEqual([3, 1]);
    // Applying the server response must not trigger a sync.
    await vi.advanceTimersByTimeAsync(5000);
    expect(syncCalls()).toHaveLength(0);
  });

  it('never sends the local cart of another tenant', async (): Promise<void> => {
    useCartStore.setState({ tenantSlug: 'other', items: [local(A, 2)] });
    queue.push(reply(200, { cart: apiCart([], 1) }));
    await started(setup('shop'));
    expect(calls[0]?.url).toBe('/api/store/cart?tenant=shop');
    expect(useCartStore.getState().tenantSlug).toBe('other');
    expect(useCartStore.getState().items).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(5000);
    expect(syncCalls()).toHaveLength(0);
  });

  it('debounces local changes into one sync with the base version, then adopts the new version', async (): Promise<void> => {
    queue.push(reply(200, { cart: apiCart([], 1) }));
    await started(setup());
    useCartStore.getState().addItem(local(A, 1), 'shop');
    await vi.advanceTimersByTimeAsync(1000);
    useCartStore.getState().updateQuantity(A, 3);
    await vi.advanceTimersByTimeAsync(1499);
    expect(syncCalls()).toHaveLength(0);
    queue.push(reply(200, { cart: apiCart([apiItem(A, 3)], 2), dropped: [] }));
    await vi.advanceTimersByTimeAsync(1);
    expect(syncCalls()).toHaveLength(1);
    expect(syncCalls()[0]?.body).toEqual({
      tenant: 'shop',
      items: [{ productId: A, quantity: 3 }],
      baseVersion: 1,
    });
    expect(useCartStore.getState().serverVersion).toBe(2);
    await vi.advanceTimersByTimeAsync(10000);
    expect(syncCalls()).toHaveLength(1);
  });

  it('applies the normalised cart and reports dropped products', async (): Promise<void> => {
    queue.push(reply(200, { cart: apiCart([], 1) }));
    const onDropped = vi.fn();
    await started(setup('shop', onDropped));
    useCartStore.getState().addItem(local(A, 5), 'shop');
    useCartStore.getState().addItem(local(B, 1), 'shop');
    queue.push(
      reply(200, {
        cart: apiCart([apiItem(A, 2, 2)], 2),
        dropped: [{ productId: B, reason: 'unavailable' }],
      }),
    );
    await vi.advanceTimersByTimeAsync(1500);
    expect(useCartStore.getState().items.map((i): number => i.quantity)).toEqual([2]);
    expect(onDropped).toHaveBeenCalledWith({ names: ['Local 22'], count: 1 });
    await vi.advanceTimersByTimeAsync(10000);
    expect(syncCalls()).toHaveLength(1);
  });

  it('on 409 merges with max quantity and retries exactly once', async (): Promise<void> => {
    queue.push(reply(200, { cart: apiCart([], 1) }));
    await started(setup());
    useCartStore.getState().addItem(local(A, 2), 'shop');
    queue.push(reply(409, { error: 'conflict', cart: apiCart([apiItem(A, 5), apiItem(B, 1)], 9) }));
    queue.push(reply(409, { error: 'conflict', cart: apiCart([], 10) }));
    await vi.advanceTimersByTimeAsync(1500);
    const sent = syncCalls();
    expect(sent).toHaveLength(2);
    expect(sent[1]?.body).toEqual({
      tenant: 'shop',
      items: [
        { productId: A, quantity: 5 },
        { productId: B, quantity: 1 },
      ],
      baseVersion: 9,
    });
    await vi.advanceTimersByTimeAsync(20000);
    expect(syncCalls()).toHaveLength(2);
  });

  it('does not retry on network failure and does not loop', async (): Promise<void> => {
    queue.push(reply(200, { cart: apiCart([], 1) }));
    await started(setup());
    useCartStore.getState().addItem(local(A, 1), 'shop');
    await vi.advanceTimersByTimeAsync(60000);
    expect(syncCalls()).toHaveLength(1);
  });

  it('does not sync while hydration is in flight or after it failed', async (): Promise<void> => {
    let release: (r: Response) => void = (): void => undefined;
    hold = new Promise<Response>((resolve): void => {
      release = resolve;
    });
    const controller = setup();
    const pending = controller.start();
    useCartStore.getState().addItem(local(A, 1), 'shop');
    await vi.advanceTimersByTimeAsync(5000);
    expect(syncCalls()).toHaveLength(0);
    release(reply(500, {}));
    hold = null;
    await pending;
    expect(useCartStore.getState().hydration).toBe('failed');
    useCartStore.getState().addItem(local(B, 1), 'shop');
    await vi.advanceTimersByTimeAsync(5000);
    expect(syncCalls()).toHaveLength(0);
  });

  it('flushes immediately with sendBeacon (application/json blob) when hidden', async (): Promise<void> => {
    queue.push(reply(200, { cart: apiCart([], 6) }));
    const controller = setup();
    await started(controller);
    useCartStore.getState().addItem(local(A, 4), 'shop');
    controller.flush();
    expect(sendBeacon).toHaveBeenCalledTimes(1);
    const [url, blob] = sendBeacon.mock.calls[0] as [string, Blob];
    expect(url).toBe('/api/store/cart/sync');
    expect(blob.type).toBe('application/json');
    expect(JSON.parse(await blob.text())).toEqual({
      tenant: 'shop',
      items: [{ productId: A, quantity: 4 }],
      baseVersion: 6,
    });
    await vi.advanceTimersByTimeAsync(5000);
    expect(syncCalls()).toHaveLength(0);
    controller.flush();
    expect(sendBeacon).toHaveBeenCalledTimes(1);
  });

  it('falls back to fetch keepalive when sendBeacon is refused', async (): Promise<void> => {
    queue.push(reply(200, { cart: apiCart([], 1) }));
    const controller = setup();
    await started(controller);
    sendBeacon.mockReturnValue(false);
    useCartStore.getState().addItem(local(A, 1), 'shop');
    controller.flush();
    const init = fetchMock.mock.calls.at(-1)?.[1] as RequestInit;
    expect(init.keepalive).toBe(true);
    expect(syncCalls()).toHaveLength(1);
  });

  it('flush is a no-op for guests (never started) and for another tenant cart', async (): Promise<void> => {
    useCartStore.setState({ tenantSlug: 'other', items: [local(A, 1)], hydration: 'ready' });
    const controller = setup('shop');
    controller.flush();
    expect(sendBeacon).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refreshes the version after returning visible post-flush', async (): Promise<void> => {
    queue.push(reply(200, { cart: apiCart([], 1) }));
    const controller = setup();
    await started(controller);
    useCartStore.getState().addItem(local(A, 2), 'shop');
    controller.flush();
    queue.push(reply(200, { cart: apiCart([apiItem(A, 2)], 2) }));
    controller.markVisible();
    await vi.advanceTimersByTimeAsync(0);
    expect(useCartStore.getState().serverVersion).toBe(2);
    await vi.advanceTimersByTimeAsync(5000);
    expect(syncCalls()).toHaveLength(0);
  });

  it('flushAndStop saves pending edits with an awaited request, then never syncs again', async (): Promise<void> => {
    queue.push(reply(200, { cart: apiCart([apiItem(A, 1)], 1) }));
    const controller = setup();
    await started(controller);
    useCartStore.getState().addItem(local(A, 3), 'shop');
    queue.push(reply(200, { cart: apiCart([apiItem(A, 3)], 2) }));
    await controller.flushAndStop();
    expect(syncCalls()).toHaveLength(1);
    expect(syncCalls()[0].body).toMatchObject({ tenant: 'shop', baseVersion: 1 });
    // Clearing the local cart afterwards (sign-out) must not wipe the server copy.
    useCartStore.getState().resetForSignOut();
    await vi.advanceTimersByTimeAsync(5000);
    expect(syncCalls()).toHaveLength(1);
  });

  it('flushAndStop sends nothing when there is nothing new, and still stops', async (): Promise<void> => {
    queue.push(reply(200, { cart: apiCart([apiItem(A, 1)], 1) }));
    const controller = setup();
    await started(controller);
    await controller.flushAndStop();
    useCartStore.getState().resetForSignOut();
    await vi.advanceTimersByTimeAsync(5000);
    expect(syncCalls()).toHaveLength(0);
  });

  it('stop cancels pending timers', async (): Promise<void> => {
    queue.push(reply(200, { cart: apiCart([], 1) }));
    const controller = setup();
    await started(controller);
    useCartStore.getState().addItem(local(A, 1), 'shop');
    controller.stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(syncCalls()).toHaveLength(0);
  });
});
