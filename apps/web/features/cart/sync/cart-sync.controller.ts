import { isCartSnapshot } from '@/features/cart/store/cart.store';
import { quoteCartLine } from '@canaldigital/packages/core/cart-pricing';
import type { CartHydrationStatus, CartItem, CartState } from '@/features/cart/store/cart.store';
import type {
  CartApiCart,
  CartApiDropped,
  CartApiItem,
  CartLineInput,
} from '@/features/cart/types/cart-api.types';

const CART_URL = '/api/store/cart';
const SYNC_URL = '/api/store/cart/sync';
const MERGE_URL = '/api/store/cart/merge';
export const CART_SYNC_DEBOUNCE_MS = 1500;

export interface CartStoreLike {
  getState: () => CartState;
  subscribe: (listener: (state: CartState) => void) => () => void;
}

export interface CartSyncOptions {
  tenantSlug: string;
  store: CartStoreLike;
  fetchFn: typeof fetch;
  sendBeacon: ((url: string, data: Blob) => boolean) | null;
  debounceMs?: number;
  /** Names (when known) of the lines the server dropped or clamped; non-blocking notice. */
  onDropped?: (notice: { names: string[]; count: number }) => void;
}

export interface CartSyncController {
  start: () => Promise<void>;
  /** Sends pending local changes right away (page hidden / pagehide). */
  flush: () => void;
  /**
   * Sends pending changes with an awaited request (the session must still be valid) and stops
   * syncing, so clearing the local cart afterwards can never wipe the server copy.
   */
  flushAndStop: () => Promise<void>;
  /** Call when the page becomes visible again: refreshes the version after a beacon flush. */
  markVisible: () => void;
  stop: () => void;
}

interface ApiResponse {
  status: number;
  json: unknown;
}

function snapshotOf(items: readonly CartLineInput[]): string {
  return items
    .map((item): string => `${item.productId}:${item.quantity}`)
    .sort()
    .join('|');
}

function linesOf(items: readonly CartLineInput[]): CartLineInput[] {
  return items.map((item): CartLineInput => ({
    productId: item.productId,
    quantity: item.quantity,
  }));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isCart(value: unknown): value is CartApiCart {
  return (
    isRecord(value) &&
    Array.isArray(value.items) &&
    value.items.length <= 50 &&
    typeof value.version === 'number' &&
    value.items.every(
      (item: unknown): boolean =>
        isRecord(item) && (value.items as Record<string, unknown>[])[0]?.currency === item.currency,
    ) &&
    value.items.every(
      (item: unknown): boolean =>
        isRecord(item) && isCartSnapshot({ ...item, imageUrl: item.imageUrl ?? undefined }),
    )
  );
}

function droppedOf(json: unknown): CartApiDropped[] {
  if (!isRecord(json) || !Array.isArray(json.dropped)) return [];
  return json.dropped.filter(
    (entry: unknown): entry is CartApiDropped =>
      isRecord(entry) && typeof entry.productId === 'string',
  );
}

function toCartItem(item: CartApiItem): CartItem {
  return {
    productId: item.productId,
    name: item.name,
    unitPriceCents: item.unitPriceCents,
    retailPriceCents: item.retailPriceCents,
    currency: item.currency,
    wholesalePriceCents: item.wholesalePriceCents,
    wholesaleMinQuantity: item.wholesaleMinQuantity,
    quantity: item.quantity,
    maxQuantity: item.maxQuantity,
    ...(item.imageUrl ? { imageUrl: item.imageUrl } : {}),
  };
}

/** Union by product, keeping the highest quantity; server-only lines use the server data. */
function mergeMax(
  serverItems: readonly CartApiItem[],
  localItems: readonly CartItem[],
): CartItem[] {
  const merged = new Map<string, CartItem>();
  for (const item of serverItems) merged.set(item.productId, toCartItem(item));
  for (const local of localItems) {
    const existing = merged.get(local.productId);
    if (!existing) {
      merged.set(local.productId, local);
      continue;
    }
    const quantity = Math.max(existing.quantity, local.quantity);
    merged.set(local.productId, {
      ...existing,
      unitPriceCents: quoteCartLine({ ...existing, quantity }).unitPriceCents,
      quantity,
    });
  }
  return [...merged.values()];
}

export function createCartSyncController(options: CartSyncOptions): CartSyncController {
  const { tenantSlug, store, fetchFn, sendBeacon, onDropped } = options;
  const debounceMs = options.debounceMs ?? CART_SYNC_DEBOUNCE_MS;
  let lastSynced = '';
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight = false;
  let stopped = false;
  let applying = false;
  /** Snapshot the store held after our own last write; a different one means a user edit. */
  let ownSnapshot = '';
  let versionStale = false;
  let unsubscribe: (() => void) | null = null;

  const isOwnTenant = (state: CartState): boolean => state.tenantSlug === tenantSlug;
  const localItems = (): CartItem[] => {
    const state = store.getState();
    return isOwnTenant(state) ? state.items : [];
  };

  async function request(url: string, init?: RequestInit): Promise<ApiResponse | null> {
    try {
      const response = await fetchFn(url, init);
      let json: unknown = null;
      try {
        json = await response.json();
      } catch {
        json = null;
      }
      return { status: response.status, json };
    } catch {
      return null;
    }
  }

  function postJson(url: string, body: object): Promise<ApiResponse | null> {
    return request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'same-origin',
    });
  }

  function setHydration(status: CartHydrationStatus): void {
    store.getState().setHydration(status);
  }

  function applyItems(items: CartItem[], version: number): void {
    applying = true;
    ownSnapshot = snapshotOf(items);
    try {
      const state = store.getState();
      if (items.length === 0 && !isOwnTenant(state)) {
        // Never wipe another store's local cart with an empty server cart for this store.
        state.setServerVersion(version);
      } else {
        state.replaceFromServer(tenantSlug, items, version);
      }
    } finally {
      applying = false;
    }
  }

  function applyServerCart(cart: CartApiCart): void {
    lastSynced = snapshotOf(cart.items);
    applyItems(cart.items.map(toCartItem), cart.version);
  }

  function notifyDropped(dropped: CartApiDropped[], known: readonly CartItem[]): void {
    if (dropped.length === 0 || !onDropped) return;
    const names = dropped
      .map(
        (entry): string | undefined =>
          known.find((item): boolean => item.productId === entry.productId)?.name,
      )
      .filter((name): name is string => typeof name === 'string');
    onDropped({ names, count: dropped.length });
  }

  function schedule(): void {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout((): void => {
      timer = null;
      void syncNow();
    }, debounceMs);
  }

  function onChange(state: CartState): void {
    if (stopped || applying || state.hydration !== 'ready' || !isOwnTenant(state)) return;
    if (snapshotOf(state.items) === lastSynced) {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      return;
    }
    schedule();
  }

  function handleSuccess(res: ApiResponse, sent: readonly CartItem[]): void {
    if (!isRecord(res.json) || !isCart(res.json.cart)) return;
    const cart = res.json.cart;
    const dropped = droppedOf(res.json);
    const state = store.getState();
    const untouched = isOwnTenant(state) && snapshotOf(state.items) === snapshotOf(sent);
    lastSynced = snapshotOf(cart.items);
    if (untouched && (dropped.length > 0 || lastSynced !== snapshotOf(sent))) {
      applyItems(cart.items.map(toCartItem), cart.version);
    } else {
      state.setServerVersion(cart.version);
    }
    notifyDropped(dropped, sent);
  }

  async function syncNow(): Promise<void> {
    if (stopped) return;
    const state = store.getState();
    if (inFlight || state.hydration !== 'ready' || !isOwnTenant(state)) return;
    const sent = state.items;
    const sentSnapshot = snapshotOf(sent);
    if (sentSnapshot === lastSynced) return;
    ownSnapshot = sentSnapshot;
    inFlight = true;
    try {
      const first = await postJson(SYNC_URL, {
        tenant: tenantSlug,
        items: linesOf(sent),
        baseVersion: state.serverVersion,
      });
      if (!first || stopped) return;
      if (first.status === 200) {
        handleSuccess(first, sent);
      } else if (first.status === 409 && isRecord(first.json) && isCart(first.json.cart)) {
        const serverCart = first.json.cart;
        const merged = mergeMax(serverCart.items, localItems());
        applyItems(merged, serverCart.version);
        // Single retry: never loop on repeated conflicts.
        const second = await postJson(SYNC_URL, {
          tenant: tenantSlug,
          items: linesOf(merged),
          baseVersion: serverCart.version,
        });
        if (second && second.status === 200 && !stopped) handleSuccess(second, merged);
      }
    } finally {
      inFlight = false;
    }
    if (stopped) return;
    const after = store.getState();
    // Reschedule only when the user changed the cart while the request was running.
    if (
      isOwnTenant(after) &&
      snapshotOf(after.items) !== ownSnapshot &&
      snapshotOf(after.items) !== lastSynced
    ) {
      schedule();
    }
  }

  async function start(): Promise<void> {
    if (stopped) return;
    setHydration('loading');
    store.getState().setServerVersion(null);
    const local = localItems();
    const res =
      local.length > 0
        ? await postJson(MERGE_URL, { tenant: tenantSlug, items: linesOf(local) })
        : await request(`${CART_URL}?tenant=${encodeURIComponent(tenantSlug)}`, {
            method: 'GET',
            credentials: 'same-origin',
          });
    if (stopped) return;
    if (!res || res.status !== 200 || !isRecord(res.json) || !isCart(res.json.cart)) {
      setHydration('failed');
      return;
    }
    applyServerCart(res.json.cart);
    notifyDropped(droppedOf(res.json), local);
    setHydration('ready');
    unsubscribe = store.subscribe(onChange);
  }

  function flush(): void {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    const state = store.getState();
    if (stopped || state.hydration !== 'ready' || !isOwnTenant(state)) return;
    const snapshot = snapshotOf(state.items);
    if (snapshot === lastSynced) return;
    const payload = JSON.stringify({
      tenant: tenantSlug,
      items: linesOf(state.items),
      baseVersion: state.serverVersion,
    });
    let queued = false;
    if (sendBeacon) {
      try {
        queued = sendBeacon(SYNC_URL, new Blob([payload], { type: 'application/json' }));
      } catch {
        queued = false;
      }
    }
    if (!queued) {
      void fetchFn(SYNC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
        credentials: 'same-origin',
      }).catch((): void => undefined);
    }
    lastSynced = snapshot;
    versionStale = true;
  }

  async function flushAndStop(): Promise<void> {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    const state = store.getState();
    const pending =
      !stopped &&
      state.hydration === 'ready' &&
      isOwnTenant(state) &&
      snapshotOf(state.items) !== lastSynced;
    // Stop listening first: the caller clears the local cart right after this resolves.
    unsubscribe?.();
    unsubscribe = null;
    if (pending) {
      await postJson(SYNC_URL, {
        tenant: tenantSlug,
        items: linesOf(state.items),
        baseVersion: state.serverVersion,
      });
    }
    stopped = true;
  }

  function markVisible(): void {
    if (stopped || !versionStale) return;
    versionStale = false;
    void (async (): Promise<void> => {
      const res = await request(`${CART_URL}?tenant=${encodeURIComponent(tenantSlug)}`, {
        method: 'GET',
        credentials: 'same-origin',
      });
      if (stopped || !res || res.status !== 200 || !isRecord(res.json) || !isCart(res.json.cart)) {
        return;
      }
      const state = store.getState();
      lastSynced = snapshotOf(res.json.cart.items);
      state.setServerVersion(res.json.cart.version);
      if (isOwnTenant(state) && snapshotOf(state.items) !== lastSynced) schedule();
    })();
  }

  function stop(): void {
    stopped = true;
    if (timer !== null) clearTimeout(timer);
    timer = null;
    unsubscribe?.();
    unsubscribe = null;
  }

  return { start, flush, flushAndStop, markVisible, stop };
}
