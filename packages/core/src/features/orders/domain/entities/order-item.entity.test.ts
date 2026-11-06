import { describe, expect, it } from 'vitest';
import { OrderItem, type OrderItemProps } from '@/orders/domain/entities/order-item.entity';
import { Money, MAX_MONEY_CENTS } from '@/shared/domain/value-objects/money.vo';
import { Currency } from '@/shared/domain/enums/currency.enum';
import { createOrderItemId } from '@/orders/domain/types/order-item-id.type';
import { createProductId } from '@/products/domain/types/product-id.type';

function props(): OrderItemProps {
  return {
    id: createOrderItemId('item'),
    productId: createProductId('product'),
    productName: 'Product',
    quantity: 2,
    unitPrice: Money.from(5, Currency.COP),
    variantId: null,
    sku: 'SKU',
    subtotal: Money.from(10, Currency.COP),
  };
}

describe('OrderItem monetary invariants', (): void => {
  it.each([NaN, Infinity, -Infinity, 0, -1, 0.5, Number.MAX_SAFE_INTEGER + 1])(
    'rejects quantity %s in creation, restoration and changes',
    (quantity: number): void => {
      const data = props();
      expect((): OrderItem =>
        OrderItem.create(
          data.id,
          data.productId,
          data.productName,
          quantity,
          data.unitPrice,
          data.sku,
        ),
      ).toThrow();
      expect((): OrderItem => OrderItem.reconstitute({ ...data, quantity })).toThrow();
      const item = OrderItem.reconstitute(data);
      expect((): void => item.changeQuantity(quantity)).toThrow();
      expect(item.getQuantity()).toBe(2);
      expect(item.getSubtotal().getValue()).toBe(10);
    },
  );
  it('rejects inconsistent stored subtotals and currencies', (): void => {
    expect((): OrderItem =>
      OrderItem.reconstitute({ ...props(), subtotal: Money.from(9, Currency.COP) }),
    ).toThrow();
    expect((): OrderItem =>
      OrderItem.reconstitute({ ...props(), subtotal: Money.from(10, Currency.USD) }),
    ).toThrow();
  });
  it('retains quantity and subtotal when multiplication exceeds the commercial limit', (): void => {
    const data = props();
    const item = OrderItem.create(
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
