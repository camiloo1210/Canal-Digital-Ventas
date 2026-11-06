import {
  quoteCartLine,
  MAX_LINE_QUANTITY,
  type CartPricing,
} from '@canaldigital/packages/core/cart-pricing';
import { MAX_MONEY_CENTS } from '@canaldigital/packages/core/money-limits';
import { isSupportedCurrencyCode } from '@canaldigital/packages/core/money-format';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface CartItem extends CartPricing {
  productId: string;
  name: string;
  unitPriceCents: number;
  imageUrl?: string;
  quantity: number;
  /** Units available when the product was last viewed. The server re-checks at checkout. */
  maxQuantity?: number;
}

function capQuantity(quantity: number, maxQuantity: number | undefined): number {
  if (maxQuantity === undefined) return Math.min(quantity, MAX_LINE_QUANTITY);
  if (!Number.isSafeInteger(maxQuantity) || maxQuantity < 0)
    return Math.min(quantity, MAX_LINE_QUANTITY);
  return Math.min(quantity, maxQuantity, MAX_LINE_QUANTITY);
}

export interface CartState {
  tenantSlug: string | null;
  items: CartItem[];
  setTenant: (tenantSlug: string) => void;
  addItem: (item: CartItem, tenantSlug: string) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  /** Last server cart version known for the synchronised (authenticated) cart. */
  serverVersion: number | null;
  hydration: CartHydrationStatus;
  setServerVersion: (version: number | null) => void;
  setHydration: (status: CartHydrationStatus) => void;
  /** Replaces the local cart with the normalised server cart without clearing the tenant guard. */
  replaceFromServer: (tenantSlug: string, items: CartItem[], version: number) => void;
  /** Forgets the cart on this browser (sign-out on a shared computer). The server copy is kept. */
  resetForSignOut: () => void;
}

export type CartHydrationStatus = 'idle' | 'loading' | 'ready' | 'failed';

/** Persisted browser state is untrusted, including snapshots from older app versions. */
export function isCartSnapshot(value: unknown): value is CartItem {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  const validAmount = (amount: unknown): boolean =>
    typeof amount === 'number' &&
    Number.isSafeInteger(amount) &&
    amount >= 0 &&
    amount <= MAX_MONEY_CENTS;
  return (
    typeof item.productId === 'string' &&
    typeof item.name === 'string' &&
    typeof item.currency === 'string' &&
    isSupportedCurrencyCode(item.currency) &&
    validAmount(item.unitPriceCents) &&
    validAmount(item.retailPriceCents) &&
    (item.wholesalePriceCents === null || validAmount(item.wholesalePriceCents)) &&
    (item.wholesaleMinQuantity === null ||
      (typeof item.wholesaleMinQuantity === 'number' &&
        Number.isSafeInteger(item.wholesaleMinQuantity) &&
        item.wholesaleMinQuantity >= 1)) &&
    typeof item.quantity === 'number' &&
    Number.isSafeInteger(item.quantity) &&
    item.quantity >= 1 &&
    item.quantity <= MAX_LINE_QUANTITY &&
    (item.imageUrl === undefined || typeof item.imageUrl === 'string') &&
    (item.maxQuantity === undefined ||
      (typeof item.maxQuantity === 'number' &&
        Number.isSafeInteger(item.maxQuantity) &&
        item.maxQuantity >= 0))
  );
}

export function migrateLegacyCart(): Pick<CartState, 'tenantSlug' | 'items'> {
  return { tenantSlug: null, items: [] };
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get): CartState => ({
      tenantSlug: null,
      items: [],
      serverVersion: null,
      hydration: 'idle',

      setServerVersion: (version: number | null): void => {
        set({ serverVersion: version });
      },

      setHydration: (status: CartHydrationStatus): void => {
        set({ hydration: status });
      },

      replaceFromServer: (tenantSlug: string, items: CartItem[], version: number): void => {
        set({ tenantSlug, items, serverVersion: version });
      },

      resetForSignOut: (): void => {
        set({ tenantSlug: null, items: [], serverVersion: null, hydration: 'idle' });
      },

      setTenant: (tenantSlug: string): void => {
        set({ tenantSlug });
      },

      addItem: (item: CartItem, newTenantSlug: string): void => {
        if (!Number.isSafeInteger(item.quantity) || item.quantity < 1) return;
        const currentTenant = get().tenantSlug;
        const currentItems = get().items;

        if (!currentTenant || currentTenant !== newTenantSlug) {
          const quantity = capQuantity(item.quantity, item.maxQuantity);
          if (quantity < 1) return;
          set({
            tenantSlug: newTenantSlug,
            items: [
              {
                ...item,
                unitPriceCents: quoteCartLine({ ...item, quantity }).unitPriceCents,
                quantity,
              },
            ],
          });
          return;
        }

        const existingItem = currentItems.find((i): boolean => i.productId === item.productId);

        if (existingItem && !Number.isSafeInteger(existingItem.quantity + item.quantity)) return;
        if (existingItem) {
          const quantity =
            item.maxQuantity === 0
              ? existingItem.quantity
              : capQuantity(existingItem.quantity + item.quantity, item.maxQuantity);
          set({
            items: currentItems.map((i): CartItem =>
              i.productId === item.productId
                ? {
                    ...item,
                    unitPriceCents: quoteCartLine({ ...item, quantity }).unitPriceCents,
                    quantity: Math.max(1, quantity),
                  }
                : i,
            ),
          });
        } else {
          const quantity = capQuantity(item.quantity, item.maxQuantity);
          if (quantity < 1) return;
          set({
            items: [
              ...currentItems,
              {
                ...item,
                unitPriceCents: quoteCartLine({ ...item, quantity }).unitPriceCents,
                quantity,
              },
            ],
          });
        }
      },

      removeItem: (productId: string): void => {
        set((state): Partial<CartState> => ({
          items: state.items.filter((i): boolean => i.productId !== productId),
        }));
      },

      updateQuantity: (productId: string, quantity: number): void => {
        if (!Number.isSafeInteger(quantity)) return;
        set((state): Partial<CartState> => ({
          items: state.items.map((i): CartItem =>
            i.productId === productId
              ? {
                  ...i,
                  unitPriceCents: quoteCartLine({
                    ...i,
                    quantity:
                      i.maxQuantity === 0
                        ? i.quantity
                        : Math.max(1, capQuantity(quantity, i.maxQuantity)),
                  }).unitPriceCents,
                  quantity:
                    i.maxQuantity === 0
                      ? i.quantity
                      : Math.max(1, capQuantity(quantity, i.maxQuantity)),
                }
              : i,
          ),
        }));
      },

      clearCart: (): void => {
        set({ items: [] });
      },
    }),
    {
      name: 'canal-digital-cart',
      version: 1,
      merge: (persisted: unknown, current: CartState): CartState => {
        if (typeof persisted !== 'object' || persisted === null) return current;
        const snapshot = persisted as Record<string, unknown>;
        if (
          typeof snapshot.tenantSlug !== 'string' ||
          !Array.isArray(snapshot.items) ||
          snapshot.items.length > 50 ||
          !snapshot.items.every(isCartSnapshot)
        )
          return current;
        const currency = snapshot.items[0]?.currency;
        if (snapshot.items.some((item: CartItem): boolean => item.currency !== currency))
          return current;
        return {
          ...current,
          tenantSlug: snapshot.tenantSlug,
          items: snapshot.items.map((item: CartItem): CartItem => ({
            ...item,
            unitPriceCents: quoteCartLine(item).unitPriceCents,
          })),
        };
      },
      // Legacy decimal prices have no currency or wholesale terms. Require a fresh catalog snapshot.
      migrate: migrateLegacyCart,
      storage: createJSONStorage((): Storage => localStorage),
      partialize: (state): Pick<CartState, 'tenantSlug' | 'items'> => ({
        tenantSlug: state.tenantSlug,
        items: state.items,
      }),
    },
  ),
);
