import { beforeEach, describe, expect, it } from 'vitest';
import { useCartStore, type CartItem } from '@/features/cart/store/cart.store';

const item: CartItem = { productId: 'product', name: 'Product', price: 15, quantity: 1 };

describe('public cart without an invented inventory ceiling', (): void => {
  beforeEach((): void => {
    useCartStore.setState({ tenantSlug: null, items: [] });
  });

  it('ignores legacy stock guesses and refreshes product display data when adding again', (): void => {
    const legacy = { ...item, quantity: 2, maxStock: 2 };
    useCartStore.setState({ tenantSlug: 'shop', items: [legacy] });
    useCartStore.getState().addItem({ ...item, name: 'Updated product', price: 16 }, 'shop');
    expect(useCartStore.getState().items).toEqual([
      { ...item, name: 'Updated product', price: 16, quantity: 3 },
    ]);
  });

  it('lets the server confirm inventory rather than clamping to a persisted guess', (): void => {
    useCartStore.setState({ tenantSlug: 'shop', items: [{ ...item, maxStock: 1 } as CartItem] });
    useCartStore.getState().updateQuantity(item.productId, 5);
    expect(useCartStore.getState().items[0]?.quantity).toBe(5);
  });

  it('keeps quantities safe integers for serialization', (): void => {
    useCartStore.getState().addItem(item, 'shop');
    for (const quantity of [NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      useCartStore.getState().updateQuantity(item.productId, quantity);
      useCartStore.getState().addItem({ ...item, quantity }, 'shop');
    }
    expect(useCartStore.getState().items[0]?.quantity).toBe(1);
  });
});
