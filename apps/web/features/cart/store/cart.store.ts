import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  imageUrl?: string;
  quantity: number;
  maxStock: number;
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
    (set, get) => ({
      tenantSlug: null,
      items: [],

      setTenant: (tenantSlug: string): void => {
        set({ tenantSlug });
      },

      addItem: (item: CartItem, newTenantSlug: string): void => {
        const currentTenant = get().tenantSlug;
        const currentItems = get().items;

        if (!currentTenant || currentTenant !== newTenantSlug) {
          set({ tenantSlug: newTenantSlug, items: [{ ...item, quantity: Math.min(item.quantity, item.maxStock) }] });
          return;
        }

        const existingItem = currentItems.find((i) => i.productId === item.productId);

        if (existingItem) {
          set({
            items: currentItems.map((i) =>
              i.productId === item.productId
                ? { ...i, quantity: Math.min(i.quantity + item.quantity, i.maxStock) }
                : i
            ),
          });
        } else {
          set({ items: [...currentItems, { ...item, quantity: Math.min(item.quantity, item.maxStock) }] });
        }
      },

      removeItem: (productId: string): void => {
        set((state) => ({
          items: state.items.filter((i) => i.productId !== productId),
        }));
      },

      updateQuantity: (productId: string, quantity: number): void => {
        set((state) => ({
          items: state.items.map((i) =>
            i.productId === productId ? { ...i, quantity: Math.min(Math.max(1, quantity), i.maxStock) } : i
          ),
        }));
      },

      clearCart: (): void => {
        set({ items: [] });
      },
    }),
    {
      name: 'canal-digital-cart',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
