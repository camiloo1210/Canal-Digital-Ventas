import { DiscountExceedsTotalException } from '@/orders/domain/exceptions/discount-exceeds-total.exception';
import { describe, expect, it } from 'vitest';
import { Order, type OrderProps } from '@/orders/domain/entities/order.entity';
import { OrderItem } from '@/orders/domain/entities/order-item.entity';
import { OrderStatus } from '@/orders/domain/enums/order-status.enum';
import { createOrderId } from '@/orders/domain/types/order-id.type';
import { createOrderItemId } from '@/orders/domain/types/order-item-id.type';
import { createCustomerId } from '@/orders/domain/types/customer-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { createProductId } from '@/products/domain/types/product-id.type';
import { Money, MAX_MONEY_CENTS } from '@/shared/domain/value-objects/money.vo';
import { Currency } from '@/shared/domain/enums/currency.enum';
import { Address } from '@/shared/domain/value-objects/adress.vo';

function props(amount: number = 10): OrderProps {
  const price = Money.from(amount, Currency.COP);
  return {
    id: createOrderId('order'),
    orderNumber: 'ORD-1',
    customerId: createCustomerId('buyer'),
    tenantId: createTenantId('tenant'),
    status: OrderStatus.DRAFT,
    items: [
      OrderItem.create(
        createOrderItemId('item'),
        createProductId('product'),
        'Product',
        1,
        price,
        'SKU',
      ),
    ],
    subtotal: price,
    taxAmount: Money.from(0, Currency.COP),
    discountAmount: Money.from(0, Currency.COP),
    shippingCost: Money.from(0, Currency.COP),
    totalAmount: price,
    shippingAddress: Address.create('Street', 'City', 'State', '123', 'CO'),
    paymentGatewayId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 0,
  };
}

function create(data: OrderProps): Order {
  return Order.create(
    data.id,
    data.orderNumber,
    data.customerId,
    data.tenantId,
    data.items,
    data.subtotal,
    data.taxAmount,
    data.discountAmount,
    data.shippingCost,
    data.shippingAddress,
  );
}

describe('Order monetary integrity', (): void => {
  it('rejects line subtotal mismatch on creation and restoration', (): void => {
    const data = { ...props(), subtotal: Money.from(9, Currency.COP) };
    expect((): Order => create(data)).toThrow();
    expect((): Order => Order.reconstitute(data)).toThrow();
  });
  it('rejects mixed line and amount currencies and incorrect restored totals', (): void => {
    const data = props();
    expect((): Order => create({ ...data, subtotal: Money.from(10, Currency.USD) })).toThrow();
    expect((): Order => create({ ...data, taxAmount: Money.from(0, Currency.USD) })).toThrow();
    expect((): Order =>
      Order.reconstitute({ ...data, totalAmount: Money.from(10, Currency.USD) }),
    ).toThrow();
    expect((): Order =>
      Order.reconstitute({ ...data, totalAmount: Money.from(9, Currency.COP) }),
    ).toThrow();
  });
  it('checks the exact net total after discount even when gross exceeds int4', (): void => {
    const data = props(MAX_MONEY_CENTS);
    const order = create({
      ...data,
      taxAmount: Money.from(1, Currency.COP),
      discountAmount: Money.from(1, Currency.COP),
    });
    expect(order.getTotalAmount().getValue()).toBe(MAX_MONEY_CENTS);
  });
  it('throws DiscountExceedsTotalException when discount exceeds the gross total', (): void => {
    const data = props();
    expect((): Order =>
      create({ ...data, discountAmount: Money.from(MAX_MONEY_CENTS, Currency.COP) }),
    ).toThrow(DiscountExceedsTotalException);
  });
  it('isolates items supplied to creation, restoration and addition, and getter snapshots', (): void => {
    const data = props();
    const created = create(data);
    const restored = Order.reconstitute(data);
    data.items[0].changeQuantity(2);
    for (const order of [created, restored]) {
      order.getItems()[0].changeQuantity(3);
      expect(order.getItems()[0].getQuantity()).toBe(1);
      expect(order.getSubtotal().getValue()).toBe(10);
      expect(order.getTotalAmount().getValue()).toBe(10);
    }
    const extra = OrderItem.create(
      createOrderItemId('extra'),
      createProductId('extra'),
      'Extra',
      1,
      Money.from(5, Currency.COP),
      'EXTRA',
    );
    created.addOrderItem(extra);
    extra.changeQuantity(4);
    created.getItems()[1].changeQuantity(5);
    expect(created.getItems()[1].getQuantity()).toBe(1);
    expect(created.getSubtotal().getValue()).toBe(15);
    expect(created.getTotalAmount().getValue()).toBe(15);
  });
  it('retains items, amounts and version after rejected aggregate changes', (): void => {
    const order = create(props(MAX_MONEY_CENTS));
    const extra = OrderItem.create(
      createOrderItemId('extra'),
      createProductId('extra'),
      'Extra',
      1,
      Money.from(1, Currency.COP),
      'EXTRA',
    );
    expect((): void => order.addOrderItem(extra)).toThrow();
    expect((): void => order.changeItemQuantity('item', 2)).toThrow();
    expect((): void => order.removeOrderItem('item')).toThrow();
    expect(order.getItems()).toHaveLength(1);
    expect(order.getItems()[0].getQuantity()).toBe(1);
    expect(order.getSubtotal().getValue()).toBe(MAX_MONEY_CENTS);
    expect(order.getTotalAmount().getValue()).toBe(MAX_MONEY_CENTS);
    expect(order.getVersion()).toBe(0);
  });
});
