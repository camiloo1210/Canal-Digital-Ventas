import { MAX_LINE_QUANTITY } from '@canaldigital/packages/core/cart-pricing';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  useCartStore,
  migrateLegacyCart,
  isCartSnapshot,
  type CartItem,
} from '@/features/cart/store/cart.store';

const item: CartItem = {
  productId: 'product',
  name: 'Product',
  unitPriceCents: 1500,
  retailPriceCents: 1500,
  currency: 'COP',
  wholesalePriceCents: null,
  wholesaleMinQuantity: null,
  quantity: 1,
};

describe('public cart capped by available units', (): void => {
  beforeEach((): void => {
    useCartStore.setState({ tenantSlug: null, items: [] });
  });

  it('never lets repeated adds exceed the available units and refreshes display data', (): void => {
    const capped = { ...item, maxQuantity: 3 };
    for (let i = 0; i < 5; i += 1) useCartStore.getState().addItem(capped, 'shop');
    expect(useCartStore.getState().items[0]?.quantity).toBe(3);
    useCartStore.getState().addItem(
      {
        ...capped,
        name: 'Updated',
        unitPriceCents: 1600,
        retailPriceCents: 1600,
        currency: 'COP',
        wholesalePriceCents: null,
        wholesaleMinQuantity: null,
      },
      'shop',
    );
    expect(useCartStore.getState().items).toEqual([
      {
        ...capped,
        name: 'Updated',
        unitPriceCents: 1600,
        retailPriceCents: 1600,
        currency: 'COP',
        wholesalePriceCents: null,
        wholesaleMinQuantity: null,
        quantity: 3,
      },
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

  it('keeps an existing quote stable when refreshed stock reaches zero', (): void => {
    useCartStore
      .getState()
      .addItem(
        { ...item, wholesalePriceCents: 1200, wholesaleMinQuantity: 2, quantity: 2 },
        'shop',
      );
    expect((): void =>
      useCartStore.getState().addItem({ ...item, maxQuantity: 0 }, 'shop'),
    ).not.toThrow();
    expect(useCartStore.getState().items[0]).toMatchObject({
      quantity: 2,
      maxQuantity: 0,
      unitPriceCents: 1500,
    });
  });

  it('keeps legacy items without a ceiling unlimited until the product is viewed again', (): void => {
    useCartStore.setState({ tenantSlug: 'shop', items: [{ ...item, quantity: 2 }] });
    useCartStore.getState().updateQuantity(item.productId, 5);
    expect(useCartStore.getState().items[0]?.quantity).toBe(5);
  });

  it('reprices in integer minor units in both directions at the wholesale threshold', (): void => {
    useCartStore.getState().addItem(
      {
        ...item,
        retailPriceCents: 12345,
        unitPriceCents: 12345,
        wholesalePriceCents: 10001,
        wholesaleMinQuantity: 3,
        maxQuantity: 10,
      },
      'shop',
    );
    useCartStore.getState().updateQuantity(item.productId, 3);
    expect(useCartStore.getState().items[0]).toMatchObject({
      unitPriceCents: 10001,
      currency: 'COP',
    });
    useCartStore.getState().updateQuantity(item.productId, 2);
    expect(useCartStore.getState().items[0]).toMatchObject({
      unitPriceCents: 12345,
      retailPriceCents: 12345,
    });
  });

  it('applies wholesale to the combined quantity added in separate selections', (): void => {
    const wholesale = {
      ...item,
      retailPriceCents: 1500,
      wholesalePriceCents: 1000,
      wholesaleMinQuantity: 5,
      maxQuantity: 20,
    };
    useCartStore.getState().addItem({ ...wholesale, quantity: 3 }, 'shop');
    expect(useCartStore.getState().items[0]).toMatchObject({ quantity: 3, unitPriceCents: 1500 });
    useCartStore.getState().addItem({ ...wholesale, quantity: 2 }, 'shop');
    expect(useCartStore.getState().items[0]).toMatchObject({ quantity: 5, unitPriceCents: 1000 });
    useCartStore.getState().updateQuantity(item.productId, 4);
    expect(useCartStore.getState().items[0]).toMatchObject({ quantity: 4, unitPriceCents: 1500 });
  });

  it('keeps retail pricing when wholesale terms are unavailable to the buyer', (): void => {
    useCartStore.getState().addItem({ ...item, quantity: 8, maxQuantity: 20 }, 'shop');
    expect(useCartStore.getState().items[0]).toMatchObject({ quantity: 8, unitPriceCents: 1500 });
  });

  it('invalidates legacy decimal snapshots instead of interpreting them as cents', async (): Promise<void> => {
    expect(migrateLegacyCart()).toEqual({ tenantSlug: null, items: [] });
  });

  it('rejects malformed persisted monetary snapshots', (): void => {
    expect(isCartSnapshot({ ...item, currency: 'INVALID' })).toBe(false);
    expect(isCartSnapshot({ ...item, unitPriceCents: 12.34 })).toBe(false);
    expect(isCartSnapshot({ ...item, quantity: Number.MAX_SAFE_INTEGER })).toBe(false);
  });

  it('keeps high-stock and unspecified-stock quantities valid after serialization and reload', (): void => {
    for (const maxQuantity of [1000, undefined]) {
      useCartStore.setState({ tenantSlug: null, items: [] });
      for (let count = 0; count < 110; count += 1) {
        useCartStore.getState().addItem({ ...item, maxQuantity }, 'shop');
      }
      expect(useCartStore.getState().items[0].quantity).toBe(MAX_LINE_QUANTITY);
      useCartStore.getState().updateQuantity(item.productId, 1000);
      const serialized: unknown = JSON.parse(JSON.stringify(useCartStore.getState().items[0]));
      expect(isCartSnapshot(serialized)).toBe(true);
      expect(serialized).toMatchObject({ quantity: MAX_LINE_QUANTITY });
    }
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
