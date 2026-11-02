import { useCartStore } from '@/features/cart/store/cart.store';
import type { CartSyncController } from '@/features/cart/sync/cart-sync.controller';

const FLUSH_TIMEOUT_MS = 2500;

let active: CartSyncController | null = null;

/** The sync controller of the page currently mounted, so sign-out can reach it. */
export function registerActiveCartSync(controller: CartSyncController | null): void {
  active = controller;
}

/**
 * Ends the buyer's cart session on this browser: saves pending changes to the server (while the
 * session is still valid), then forgets the cart locally. The server copy stays, so the same
 * buyer finds it again after signing back in, and the next person at a shared computer sees none.
 */
export async function endCartSession(): Promise<void> {
  const controller = active;
  if (controller) {
    await Promise.race([
      controller.flushAndStop().catch((): void => undefined),
      new Promise<void>((resolve): void => {
        setTimeout(resolve, FLUSH_TIMEOUT_MS);
      }),
    ]);
  }
  useCartStore.getState().resetForSignOut();
}
