import { describe, expect, it } from 'vitest';
import { CartItem, type CartItemProps } from '@/carts/domain/entities/cart-item.entity';
import { Money, MAX_MONEY_CENTS } from '@/shared/domain/value-objects/money.vo';
import { Currency } from '@/shared/domain/enums/currency.enum';
import { createCartItemId } from '@/carts/domain/types/cart-item-id.type';
import { createProductId } from '@/products/domain/types/product-id.type';

function props(): CartItemProps {
  return {
    id: createCartItemId('item'),
    productId: createProductId('product'),
    productName: 'Product',
    quantity: 2,
    unitPrice: Money.from(5, Currency.COP),
    variantId: null,
    sku: 'SKU',
    subtotal: Money.from(10, Currency.COP),
  };
}

describe('CartItem monetary invariants', (): void => {
  it.each([NaN, Infinity, -Infinity, 0, -1, 0.5, Number.MAX_SAFE_INTEGER + 1])(
    'rejects quantity %s in creation, restoration and changes',
    (quantity: number): void => {
      const data = props();
      expect((): CartItem =>
        CartItem.create(
          data.id,
          data.productId,
          data.productName,
          quantity,
          data.unitPrice,
          data.sku,
        ),
      ).toThrow();
      expect((): CartItem => CartItem.reconstitute({ ...data, quantity })).toThrow();
      const item = CartItem.reconstitute(data);
      expect((): void => item.changeQuantity(quantity)).toThrow();
      expect(item.getQuantity()).toBe(2);
      expect(item.getSubtotal().getValue()).toBe(10);
    },
  );
  it('rejects inconsistent stored subtotals and currencies', (): void => {
    expect((): CartItem =>
      CartItem.reconstitute({ ...props(), subtotal: Money.from(9, Currency.COP) }),
    ).toThrow();
    expect((): CartItem =>
      CartItem.reconstitute({ ...props(), subtotal: Money.from(10, Currency.USD) }),
    ).toThrow();
  });
  it('retains quantity and subtotal when multiplication exceeds the commercial limit', (): void => {
    const data = props();
    const item = CartItem.create(
      data.id,
      data.productId,
      data.productName,
      1,
      Money.from(MAX_MONEY_CENTS, Currency.COP),
      data.sku,
    );
    expect((): void => item.changeQuantity(2)).toThrow();
    expect(item.getQuantity()).toBe(1);
    expect(item.getSubtotal().getValue()).toBe(MAX_MONEY_CENTS);
  });
});
