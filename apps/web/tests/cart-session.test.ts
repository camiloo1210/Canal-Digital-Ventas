import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCartStore } from '@/features/cart/store/cart.store';
import { endCartSession, registerActiveCartSync } from '@/features/cart/sync/cart-session';
import type { CartSyncController } from '@/features/cart/sync/cart-sync.controller';

function controllerWith(flushAndStop: () => Promise<void>): CartSyncController {
  return {
    start: vi.fn(),
    flush: vi.fn(),
    flushAndStop,
    markVisible: vi.fn(),
    stop: vi.fn(),
  } as unknown as CartSyncController;
}

describe('endCartSession', (): void => {
  beforeEach((): void => {
    vi.useFakeTimers();
    useCartStore.setState({
      tenantSlug: 'shop',
      items: [
        {
          productId: 'p1',
          name: 'Pen',
          unitPriceCents: 100,
          retailPriceCents: 100,
          currency: 'COP',
          wholesalePriceCents: null,
          wholesaleMinQuantity: null,
          quantity: 2,
          maxQuantity: 5,
        },
      ],
      serverVersion: 4,
      hydration: 'ready',
    });
  });
  afterEach((): void => {
    registerActiveCartSync(null);
    vi.useRealTimers();
  });

  it('saves first and forgets the cart on this browser afterwards', async (): Promise<void> => {
    const order: string[] = [];
    registerActiveCartSync(
      controllerWith(async (): Promise<void> => {
        order.push(`saved:${useCartStore.getState().items.length}`);
      }),
    );
    await endCartSession();
    order.push(`cleared:${useCartStore.getState().items.length}`);
    expect(order).toEqual(['saved:1', 'cleared:0']);
    expect(useCartStore.getState()).toMatchObject({
      tenantSlug: null,
      serverVersion: null,
      hydration: 'idle',
    });
  });

  it('clears the cart even when there is no sync controller (guest or dashboard)', async (): Promise<void> => {
    await endCartSession();
    expect(useCartStore.getState().items).toEqual([]);
  });

  it('never blocks sign-out: a hung or failing save still clears the cart', async (): Promise<void> => {
    registerActiveCartSync(
      controllerWith((): Promise<void> => new Promise<void>((): undefined => undefined)),
    );
    const pending = endCartSession();
    await vi.advanceTimersByTimeAsync(3000);
    await pending;
    expect(useCartStore.getState().items).toEqual([]);

    useCartStore.setState({
      items: [
        {
          productId: 'p2',
          name: 'X',
          unitPriceCents: 100,
          retailPriceCents: 100,
          currency: 'COP',
          wholesalePriceCents: null,
          wholesaleMinQuantity: null,
          quantity: 1,
        },
      ],
    });
    registerActiveCartSync(controllerWith((): Promise<void> => Promise.reject(new Error('down'))));
    await endCartSession();
    expect(useCartStore.getState().items).toEqual([]);
  });
});
