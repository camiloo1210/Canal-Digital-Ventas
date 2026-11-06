import { describe, expect, it } from 'vitest';
import { Cart } from '@/carts/domain/entities/cart.entity';
import { CartItem } from '@/carts/domain/entities/cart-item.entity';
import { createCartId } from '@/carts/domain/types/cart-id.type';
import { createCartItemId } from '@/carts/domain/types/cart-item-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { createProductId } from '@/products/domain/types/product-id.type';
import { Money, MAX_MONEY_CENTS } from '@/shared/domain/value-objects/money.vo';
import { Currency } from '@/shared/domain/enums/currency.enum';

function item(id: string, amount: number, currency: Currency = Currency.COP): CartItem {
  return CartItem.create(
    createCartItemId(id),
    createProductId(id),
    id,
    1,
    Money.from(amount, currency),
    id,
  );
}

describe('Cart atomic monetary changes', (): void => {
  it('keeps stored items and totals after overflow or currency mismatch', (): void => {
    const cart = Cart.create(
      createCartId('cart'),
      createTenantId('tenant'),
      null,
      new Date(Date.now() + 60000),
      Currency.COP,
    );
    cart.addItem(item('product', MAX_MONEY_CENTS));
    expect((): void => cart.addItem(item('extra', 1))).toThrow();
    expect((): void => cart.addItem(item('product', 1, Currency.USD))).toThrow();
    expect((): void => cart.changeItemQuantity(createCartItemId('product'), 2)).toThrow();
    expect(cart.getItems()).toHaveLength(1);
    expect(cart.getItems()[0].getQuantity()).toBe(1);
    expect(cart.getSubtotal().getValue()).toBe(MAX_MONEY_CENTS);
    expect(cart.getVersion()).toBe(1);
  });
  it('isolates items supplied to addition and restoration, and getter snapshots', (): void => {
    const cart = Cart.create(
      createCartId('cart'),
      createTenantId('tenant'),
      null,
      new Date(Date.now() + 60000),
      Currency.COP,
    );
    const source = item('product', 10);
    cart.addItem(source);
    const restored = Cart.reconstitute({
      id: cart.getId(),
      tenantId: cart.getTenantId(),
      customerId: null,
      items: [source],
      status: cart.getStatus(),
      subtotal: cart.getSubtotal(),
      expiresAt: cart.getExpiresAt(),
      createdAt: cart.getCreatedAt(),
      updatedAt: cart.getUpdatedAt(),
      version: cart.getVersion(),
    });
    source.changeQuantity(2);
    for (const aggregate of [cart, restored]) {
      aggregate.getItems()[0].changeQuantity(3);
      expect(aggregate.getItems()[0].getQuantity()).toBe(1);
      expect(aggregate.getSubtotal().getValue()).toBe(10);
    }
  });
  it('rejects inconsistent persisted cart subtotals', (): void => {
    const cart = Cart.create(
      createCartId('cart'),
      createTenantId('tenant'),
      null,
      new Date(Date.now() + 60000),
      Currency.COP,
    );
    expect((): Cart =>
      Cart.reconstitute({
        id: cart.getId(),
        tenantId: cart.getTenantId(),
        customerId: null,
        items: [item('product', 10)],
        status: cart.getStatus(),
        subtotal: Money.from(9, Currency.COP),
        expiresAt: cart.getExpiresAt(),
        createdAt: cart.getCreatedAt(),
        updatedAt: cart.getUpdatedAt(),
        version: 0,
      }),
    ).toThrow();
  });
  it('keeps a CLP cart at face value and rejects items in another currency', (): void => {
    const cart = Cart.create(
      createCartId('cart'),
      createTenantId('tenant'),
      null,
      new Date(Date.now() + 60000),
      Currency.CLP,
    );
    expect(cart.getSubtotal().getCurrency()).toBe(Currency.CLP);
    cart.addItem(item('clp', 5000, Currency.CLP));
    expect(cart.getSubtotal().getValue()).toBe(5000);
    expect((): void => cart.addItem(item('cop', 1, Currency.COP))).toThrow();
    expect((): void => cart.addItem(item('clp', 1, Currency.USD))).toThrow();
    expect(cart.getSubtotal().getValue()).toBe(5000);
  });
  it('rejects the first item when its currency differs from the cart currency', (): void => {
    const cart = Cart.create(
      createCartId('cart'),
      createTenantId('tenant'),
      null,
      new Date(Date.now() + 60000),
      Currency.COP,
    );
    expect((): void => cart.addItem(item('usd', 1, Currency.USD))).toThrow();
    expect(cart.getItems()).toHaveLength(0);
  });
});
