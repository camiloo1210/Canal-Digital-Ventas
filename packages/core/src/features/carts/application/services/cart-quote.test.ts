import { describe, expect, it } from 'vitest';
import {
  quoteCartLine,
  quoteCartSubtotal,
  isCartQuoteWithinLimit,
} from '@/carts/application/services/cart-quote';
import { normalizeBuyerCart } from '@/carts/application/services/buyer-cart-normalizer';
import { catalogProduct, productId } from '@/carts/application/buyer-cart-test-doubles';

const pricing = {
  retailPriceCents: 12345,
  wholesalePriceCents: 10001,
  wholesaleMinQuantity: 3,
  currency: 'COP',
};

describe('cart pricing projection', (): void => {
  it('uses the retail price below the threshold and wholesale at or above it', (): void => {
    expect(quoteCartLine({ ...pricing, quantity: 2 })).toEqual({
      unitPriceCents: 12345,
      totalCents: 24690,
    });
    expect(quoteCartLine({ ...pricing, quantity: 3 })).toEqual({
      unitPriceCents: 10001,
      totalCents: 30003,
    });
    expect(
      quoteCartSubtotal([
        { ...pricing, quantity: 3 },
        { ...pricing, quantity: 2 },
      ]),
    ).toBe(54693);
  });

  it('ignores disabled or incomplete wholesale terms', (): void => {
    for (const override of [
      { wholesalePriceCents: 0 },
      { wholesalePriceCents: null },
      { wholesaleMinQuantity: null },
      { wholesaleMinQuantity: 0 },
    ]) {
      expect(quoteCartLine({ ...pricing, ...override, quantity: 3 }).unitPriceCents).toBe(12345);
    }
  });

  it('blocks totals beyond the persisted order limit and rejects mixed currency totals', (): void => {
    const expensive = {
      ...pricing,
      retailPriceCents: 2147483647,
      wholesalePriceCents: null,
      quantity: 2,
    };
    expect(quoteCartLine(expensive).totalCents).toBe(4294967294);
    expect(isCartQuoteWithinLimit([expensive])).toBe(false);
    expect((): number =>
      quoteCartSubtotal([
        { ...pricing, quantity: 1 },
        { ...pricing, quantity: 1, currency: 'USD' },
      ]),
    ).toThrow();
    expect((): unknown => quoteCartLine({ ...pricing, quantity: 1.5 })).toThrow();
  });

  it('quotes the stock-clamped quantity and preserves currency and retail terms', (): void => {
    const product = catalogProduct(1, {
      unitPriceCents: 12345,
      wholesalePriceCents: 10001,
      wholesaleMinQuantity: 3,
      availableQuantity: 2,
      currency: 'COP',
    });
    const result = normalizeBuyerCart(
      [{ productId: productId(1), quantity: 5 }],
      new Map([[product.productId, product]]),
    );
    expect(result.items[0]).toMatchObject({
      unitPriceCents: 12345,
      retailPriceCents: 12345,
      currency: 'COP',
      wholesalePriceCents: 10001,
      wholesaleMinQuantity: 3,
      quantity: 2,
    });
  });
});

describe('cart quote currency', (): void => {
  it('keeps CLP amounts unscaled and rejects unsupported or mixed currencies', (): void => {
    const clp = {
      ...pricing,
      currency: 'CLP',
      retailPriceCents: 5000,
      wholesalePriceCents: null,
      wholesaleMinQuantity: null,
    };
    expect(quoteCartLine({ ...clp, quantity: 1 })).toEqual({
      unitPriceCents: 5000,
      totalCents: 5000,
    });
    expect((): unknown => quoteCartLine({ ...clp, currency: 'XXX', quantity: 1 })).toThrow();
    expect((): unknown =>
      quoteCartSubtotal([
        { ...clp, quantity: 1 },
        { ...clp, currency: 'COP', quantity: 1 },
      ]),
    ).toThrow();
  });
});
