import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Cart } from '@/carts/domain/entities/cart.entity';
import { CartItem } from '@/carts/domain/entities/cart-item.entity';
import { createCartId } from '@/carts/domain/types/cart-id.type';
import { createCartItemId } from '@/carts/domain/types/cart-item-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { createProductId } from '@/products/domain/types/product-id.type';
import { Money, MAX_MONEY_CENTS } from '@/shared/domain/value-objects/money.vo';
import { CartStatus } from '@/carts/domain/enums/cart-status.enum';
import { createCustomerId } from '@/carts/domain/types/customer-id.type';
import { InvalidCartStateException } from '@/carts/domain/exceptions/invalid-cart-state.exception';
import { InvalidCartAttributeException } from '@/carts/domain/exceptions/invalid-cart-attribute.exception';
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

const NOW = new Date('2026-01-15T12:00:00.000Z');

function activeCart(): Cart {
  return Cart.create(
    createCartId('cart'),
    createTenantId('tenant'),
    null,
    new Date(NOW.getTime() + 60000),
    Currency.COP,
  );
}

function cartIn(status: CartStatus, withItem: boolean = true): Cart {
  const items: CartItem[] = withItem ? [item('product', 10)] : [];
  return Cart.reconstitute({
    id: createCartId('cart'),
    tenantId: createTenantId('tenant'),
    customerId: null,
    items,
    status,
    subtotal: Money.from(withItem ? 10 : 0, Currency.COP),
    expiresAt: new Date(NOW.getTime() + 60000),
    createdAt: NOW,
    updatedAt: NOW,
    version: 3,
  });
}

function eventNames(cart: Cart): string[] {
  return cart.domainEvents.map((e: { eventName: string }): string => e.eventName);
}

describe('Cart state machine', (): void => {
  beforeEach((): void => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach((): void => {
    vi.useRealTimers();
  });

  it('create yields an active empty cart, version 0, one CartCreatedEvent', (): void => {
    const cart = activeCart();
    expect(cart.getStatus()).toBe(CartStatus.ACTIVE);
    expect(cart.getVersion()).toBe(0);
    expect(cart.getItems()).toHaveLength(0);
    expect(eventNames(cart)).toEqual(['CartCreatedEvent']);
    cart.clearDomainEvents();
    expect(cart.domainEvents).toHaveLength(0);
  });

  it('create rejects blank id, blank tenant and past expiry', (): void => {
    expect((): Cart =>
      Cart.create(
        createCartId('c'),
        createTenantId('t'),
        null,
        new Date(NOW.getTime() - 1),
        Currency.COP,
      ),
    ).toThrow('Invalid cart attribute: Expiration date cannot be in the past.');
    expect((): Cart =>
      Cart.create(
        '' as ReturnType<typeof createCartId>,
        createTenantId('t'),
        null,
        NOW,
        Currency.COP,
      ),
    ).toThrow(InvalidCartAttributeException);
    expect((): Cart =>
      Cart.create(
        createCartId('c'),
        '' as ReturnType<typeof createTenantId>,
        null,
        NOW,
        Currency.COP,
      ),
    ).toThrow();
  });

  it('abandon moves active to abandoned and emits CartAbandonedEvent', (): void => {
    const cart = cartIn(CartStatus.ACTIVE);
    cart.abandon();
    expect(cart.getStatus()).toBe(CartStatus.ABANDONED);
    expect(cart.getVersion()).toBe(4);
    expect(eventNames(cart)).toEqual(['CartAbandonedEvent']);
  });

  it('complete moves a non-empty active cart to completed and emits CartCompletedEvent', (): void => {
    const cart = cartIn(CartStatus.ACTIVE);
    cart.complete();
    expect(cart.getStatus()).toBe(CartStatus.COMPLETED);
    expect(eventNames(cart)).toEqual(['CartCompletedEvent']);
  });

  it('complete rejects an empty cart and leaves it unchanged', (): void => {
    const cart = cartIn(CartStatus.ACTIVE, false);
    expect((): void => cart.complete()).toThrow(
      'Invalid cart state: Cannot complete an empty cart.',
    );
    expect(cart.getStatus()).toBe(CartStatus.ACTIVE);
    expect(cart.domainEvents).toHaveLength(0);
  });

  it('assignCustomer sets the customer and bumps version without events', (): void => {
    const cart = cartIn(CartStatus.ACTIVE);
    cart.assignCustomer(createCustomerId('buyer'));
    expect(cart.getCustomerId()).toBe('buyer');
    expect(cart.getVersion()).toBe(4);
    expect(cart.getUpdatedAt()).toEqual(NOW);
    expect(cart.domainEvents).toHaveLength(0);
  });

  it('clear empties items and zeroes subtotal', (): void => {
    const cart = cartIn(CartStatus.ACTIVE);
    cart.clear();
    expect(cart.getItems()).toHaveLength(0);
    expect(cart.getSubtotal().getValue()).toBe(0);
    expect(cart.getVersion()).toBe(4);
  });

  it('removeItem drops the line and recalculates the subtotal; unknown id is a no-op that still bumps version', (): void => {
    const cart = cartIn(CartStatus.ACTIVE);
    cart.removeItem(createCartItemId('missing'));
    expect(cart.getItems()).toHaveLength(1);
    cart.removeItem(createCartItemId('product'));
    expect(cart.getItems()).toHaveLength(0);
    expect(cart.getSubtotal().getValue()).toBe(0);
  });

  it('changeItemQuantity updates a line and rejects an unknown item', (): void => {
    const cart = cartIn(CartStatus.ACTIVE);
    cart.changeItemQuantity(createCartItemId('product'), 3);
    expect(cart.getSubtotal().getValue()).toBe(30);
    expect((): void => cart.changeItemQuantity(createCartItemId('nope'), 1)).toThrow(
      'Invalid cart attribute: Item not found in cart.',
    );
  });

  it('addItem merges quantities for the same product and variant', (): void => {
    const cart = cartIn(CartStatus.ACTIVE);
    cart.addItem(item('product', 10));
    expect(cart.getItems()).toHaveLength(1);
    expect(cart.getItems()[0].getQuantity()).toBe(2);
    expect(cart.getSubtotal().getValue()).toBe(20);
  });

  const MUTATIONS: [string, (c: Cart) => void][] = [
    ['abandon', (c: Cart): void => c.abandon()],
    ['complete', (c: Cart): void => c.complete()],
    ['clear', (c: Cart): void => c.clear()],
    ['assignCustomer', (c: Cart): void => c.assignCustomer(createCustomerId('buyer'))],
    ['removeItem', (c: Cart): void => c.removeItem(createCartItemId('product'))],
    ['changeItemQuantity', (c: Cart): void => c.changeItemQuantity(createCartItemId('product'), 2)],
    ['addItem', (c: Cart): void => c.addItem(item('other', 5))],
  ];
  const INACTIVE: CartStatus[] = [CartStatus.ABANDONED, CartStatus.COMPLETED];
  const CASES: [string, CartStatus, (c: Cart) => void][] = MUTATIONS.flatMap(
    ([name, run]: [string, (c: Cart) => void]): [string, CartStatus, (c: Cart) => void][] =>
      INACTIVE.map((s: CartStatus): [string, CartStatus, (c: Cart) => void] => [name, s, run]),
  );

  it.each(CASES)(
    '%s on a %s cart throws InvalidCartStateException and changes nothing',
    (_n: string, status: CartStatus, run: (c: Cart) => void): void => {
      const cart = cartIn(status);
      expect((): void => run(cart)).toThrow(InvalidCartStateException);
      expect((): void => run(cart)).toThrow(
        `Invalid cart state: Cart is no longer active (current status: ${status}).`,
      );
      expect(cart.getStatus()).toBe(status);
      expect(cart.getItems()).toHaveLength(1);
      expect(cart.getSubtotal().getValue()).toBe(10);
      expect(cart.getVersion()).toBe(3);
      expect(cart.domainEvents).toHaveLength(0);
    },
  );

  it('an expired active cart rejects changes with the expiry message and flips to abandoned', (): void => {
    const cart = cartIn(CartStatus.ACTIVE);
    vi.setSystemTime(new Date(NOW.getTime() + 60001));
    expect((): void => cart.assignCustomer(createCustomerId('buyer'))).toThrow(
      'Invalid cart state: Cart has expired and was marked as abandoned.',
    );
    expect(cart.getStatus()).toBe(CartStatus.ABANDONED);
    expect(cart.getCustomerId()).toBeNull();
  });

  it('a cart is still active exactly at its expiry instant', (): void => {
    const cart = cartIn(CartStatus.ACTIVE);
    vi.setSystemTime(new Date(NOW.getTime() + 60000));
    cart.assignCustomer(createCustomerId('buyer'));
    expect(cart.getStatus()).toBe(CartStatus.ACTIVE);
  });
});
