import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Order } from '@/orders/domain/entities/order.entity';
import { OrderItem } from '@/orders/domain/entities/order-item.entity';
import { InvalidOrderAttributeException } from '@/orders/domain/exceptions/invalid-order-attribute.exception';
import { InvalidOrderStateException } from '@/orders/domain/exceptions/invalid-order-state.exception';
import { createOrderId, type OrderId } from '@/orders/domain/types/order-id.type';
import { createOrderItemId } from '@/orders/domain/types/order-item-id.type';
import { createCustomerId, type CustomerId } from '@/orders/domain/types/customer-id.type';
import { createTenantId, type TenantId } from '@/shared/domain/types/tenant-id.type';
import { createProductId } from '@/products/domain/types/product-id.type';
import { Money } from '@/shared/domain/value-objects/money.vo';
import { Currency } from '@/shared/domain/enums/currency.enum';
import { Address } from '@/shared/domain/value-objects/adress.vo';

// Targets mutants that survived the baseline Stryker run on order.entity.ts.
const cop = (amount: number): Money => Money.from(amount, Currency.COP);

function item(id: string, productId: string, quantity: number, unit: number): OrderItem {
  return OrderItem.create(
    createOrderItemId(id),
    createProductId(productId),
    'Product',
    quantity,
    cop(unit),
    'SKU',
  );
}

function draft(
  overrides: { id?: string; orderNumber?: string; customerId?: string; tenantId?: string } = {},
): Order {
  return Order.create(
    (overrides.id ?? 'order-1') as OrderId,
    overrides.orderNumber ?? 'ORD-1',
    (overrides.customerId ?? 'buyer-1') as CustomerId,
    (overrides.tenantId ?? 'tenant-1') as TenantId,
    [item('item-1', 'product-1', 1, 10)],
    cop(10),
    cop(0),
    cop(0),
    cop(0),
    Address.create('Street', 'City', 'State', '123', 'CO'),
  );
}

describe('Order mutation baseline: creation identity guards', (): void => {
  beforeEach((): void => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
  });
  afterEach((): void => {
    vi.useRealTimers();
  });

  it.each(['', '   '])(
    'rejects blank id, order number, customer and tenant (%j)',
    (blank: string): void => {
      expect((): Order => draft({ id: blank })).toThrow('Order ID is required.');
      expect((): Order => draft({ orderNumber: blank })).toThrow('Order number is required.');
      expect((): Order => draft({ customerId: blank })).toThrow('Customer ID is required.');
      expect((): Order => draft({ tenantId: blank })).toThrow(
        'Tenant ID is required and must be a valid string.',
      );
    },
  );

  it('rejects a missing shipping address and empty item list on creation', (): void => {
    const valid = draft();
    expect((): Order =>
      Order.create(
        createOrderId('o'),
        'ORD-2',
        createCustomerId('b'),
        createTenantId('t'),
        valid.getItems(),
        cop(10),
        cop(0),
        cop(0),
        cop(0),
        null as unknown as Address,
      ),
    ).toThrow(InvalidOrderAttributeException);
    expect((): Order =>
      Order.create(
        createOrderId('o'),
        'ORD-2',
        createCustomerId('b'),
        createTenantId('t'),
        [],
        cop(0),
        cop(0),
        cop(0),
        cop(0),
        Address.create('Street', 'City', 'State', '123', 'CO'),
      ),
    ).toThrow(InvalidOrderAttributeException);
  });
});

describe('Order mutation baseline: draft item editing', (): void => {
  it('merges an added line of the same product by summing quantities and subtotal', (): void => {
    const order = draft();
    order.addOrderItem(item('item-2', 'product-1', 2, 10));
    expect(order.getItems()).toHaveLength(1);
    expect(order.getItems()[0]?.getQuantity()).toBe(3);
    expect(order.getSubtotal().getValue()).toBe(30);
    expect(order.getTotalAmount().getValue()).toBe(30);
  });

  it('appends a line of a different product and recomputes totals', (): void => {
    const order = draft();
    order.addOrderItem(item('item-2', 'product-2', 2, 5));
    expect(order.getItems()).toHaveLength(2);
    expect(order.getSubtotal().getValue()).toBe(20);
    expect(order.getTotalAmount().getValue()).toBe(20);
  });

  it('rejects an added line in another currency', (): void => {
    const order = draft();
    const usd = OrderItem.create(
      createOrderItemId('item-3'),
      createProductId('product-3'),
      'Product',
      1,
      Money.from(10, Currency.USD),
      'SKU',
    );
    expect((): void => order.addOrderItem(usd)).toThrow(
      'Order items must share the order currency.',
    );
  });

  it('changes only the targeted line quantity and updates the totals', (): void => {
    const order = draft();
    order.addOrderItem(item('item-2', 'product-2', 1, 5));
    order.changeItemQuantity('item-2', 4);
    expect(order.getItems()[0]?.getQuantity()).toBe(1);
    expect(order.getItems()[1]?.getQuantity()).toBe(4);
    expect(order.getTotalAmount().getValue()).toBe(30);
  });

  it('removes a line and refuses to remove the last one', (): void => {
    const order = draft();
    order.addOrderItem(item('item-2', 'product-2', 1, 5));
    order.removeOrderItem('item-1');
    expect(order.getItems().map((i: OrderItem): string => i.getId())).toEqual(['item-2']);
    expect(order.getTotalAmount().getValue()).toBe(5);
    expect((): void => order.removeOrderItem('item-2')).toThrow(InvalidOrderAttributeException);
  });

  it('refuses unknown lines and non-draft edits with exact messages', (): void => {
    const order = draft();
    expect((): void => order.changeItemQuantity('missing', 1)).toThrow('Item not found in order.');
    order.confirm();
    expect((): void => order.addOrderItem(item('item-9', 'product-9', 1, 1))).toThrow(
      new InvalidOrderStateException('Items can only be added to draft orders.'),
    );
    expect((): void => order.removeOrderItem('item-1')).toThrow(
      'Items can only be removed from draft orders.',
    );
    expect((): void => order.changeItemQuantity('item-1', 2)).toThrow(
      'Item quantities can only change in draft orders.',
    );
  });
});
