import { beforeEach, describe, expect, it } from 'vitest';
import { useCartStore, type CartItem } from '@/features/cart/store/cart.store';

const item: CartItem = { productId: 'product', name: 'Product', price: 15, quantity: 1 };

describe('public cart capped by available units', (): void => {
  beforeEach((): void => {
    useCartStore.setState({ tenantSlug: null, items: [] });
  });

  it('never lets repeated adds exceed the available units and refreshes display data', (): void => {
    const capped = { ...item, maxQuantity: 3 };
    for (let i = 0; i < 5; i += 1) useCartStore.getState().addItem(capped, 'shop');
    expect(useCartStore.getState().items[0]?.quantity).toBe(3);
    useCartStore.getState().addItem({ ...capped, name: 'Updated', price: 16 }, 'shop');
    expect(useCartStore.getState().items).toEqual([
      { ...capped, name: 'Updated', price: 16, quantity: 3 },
    ]);
  });

  it('clamps manual quantity changes to the stored available units', (): void => {
    useCartStore.setState({
      tenantSlug: 'shop',
      items: [{ ...item, quantity: 1, maxQuantity: 4 }],
    });
    useCartStore.getState().updateQuantity(item.productId, 99);
    expect(useCartStore.getState().items[0]?.quantity).toBe(4);
  });

  it('does not add a product with zero available units', (): void => {
    useCartStore.getState().addItem({ ...item, maxQuantity: 0 }, 'shop');
    expect(useCartStore.getState().items).toEqual([]);
  });

  it('keeps legacy items without a ceiling unlimited until the product is viewed again', (): void => {
    useCartStore.setState({ tenantSlug: 'shop', items: [{ ...item, quantity: 2 }] });
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
