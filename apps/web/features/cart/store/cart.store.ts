import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  imageUrl?: string;
  quantity: number;
}

export interface CartState {
  tenantSlug: string | null;
  items: CartItem[];
  setTenant: (tenantSlug: string) => void;
  addItem: (item: CartItem, tenantSlug: string) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get): CartState => ({
      tenantSlug: null,
      items: [],

      setTenant: (tenantSlug: string): void => {
        set({ tenantSlug });
      },

      addItem: (item: CartItem, newTenantSlug: string): void => {
        if (!Number.isSafeInteger(item.quantity) || item.quantity < 1) return;
        const currentTenant = get().tenantSlug;
        const currentItems = get().items;

        if (!currentTenant || currentTenant !== newTenantSlug) {
          set({
            tenantSlug: newTenantSlug,
            items: [{ ...item, quantity: item.quantity }],
          });
          return;
        }

        const existingItem = currentItems.find((i): boolean => i.productId === item.productId);

        if (existingItem && !Number.isSafeInteger(existingItem.quantity + item.quantity)) return;
        if (existingItem) {
          set({
            items: currentItems.map((i): CartItem =>
              i.productId === item.productId
                ? { ...item, quantity: i.quantity + item.quantity }
                : i,
            ),
          });
        } else {
          set({
            items: [...currentItems, { ...item, quantity: item.quantity }],
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
            i.productId === productId ? { ...i, quantity: Math.max(1, quantity) } : i,
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
    },
  ),
);
