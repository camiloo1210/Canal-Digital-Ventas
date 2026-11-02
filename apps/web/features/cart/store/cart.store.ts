import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  imageUrl?: string;
  quantity: number;
  /** Units available when the product was last viewed. The server re-checks at checkout. */
  maxQuantity?: number;
}

function capQuantity(quantity: number, maxQuantity: number | undefined): number {
  if (maxQuantity === undefined) return quantity;
  if (!Number.isSafeInteger(maxQuantity) || maxQuantity < 0) return quantity;
  return Math.min(quantity, maxQuantity);
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
            items: [{ ...item, quantity }],
          });
          return;
        }

        const existingItem = currentItems.find((i): boolean => i.productId === item.productId);

        if (existingItem && !Number.isSafeInteger(existingItem.quantity + item.quantity)) return;
        if (existingItem) {
          const quantity = capQuantity(existingItem.quantity + item.quantity, item.maxQuantity);
          set({
            items: currentItems.map((i): CartItem =>
              i.productId === item.productId
                ? { ...item, quantity: item.maxQuantity === 0 ? i.quantity : Math.max(1, quantity) }
                : i,
            ),
          });
        } else {
          const quantity = capQuantity(item.quantity, item.maxQuantity);
          if (quantity < 1) return;
          set({
            items: [...currentItems, { ...item, quantity }],
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
      storage: createJSONStorage((): Storage => localStorage),
      partialize: (state): Pick<CartState, 'tenantSlug' | 'items'> => ({
        tenantSlug: state.tenantSlug,
        items: state.items,
      }),
    },
  ),
);
