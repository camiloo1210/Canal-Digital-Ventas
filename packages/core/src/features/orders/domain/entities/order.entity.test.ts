import { DiscountExceedsTotalException } from '@/orders/domain/exceptions/discount-exceeds-total.exception';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Order, type OrderProps } from '@/orders/domain/entities/order.entity';
import { OrderItem } from '@/orders/domain/entities/order-item.entity';
import { InvalidOrderStateException } from '@/orders/domain/exceptions/invalid-order-state.exception';
import { InvalidOrderAttributeException } from '@/orders/domain/exceptions/invalid-order-attribute.exception';
import { createPaymentGatewayId } from '@/orders/domain/types/payment-gateway-id.type';
import { OrderStatus, nextLogisticsStatus } from '@/orders/domain/enums/order-status.enum';
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

const GATEWAY = createPaymentGatewayId('gateway-1');

function orderIn(
  status: OrderStatus,
  paymentGatewayId: ReturnType<typeof createPaymentGatewayId> | null = null,
): Order {
  return Order.reconstitute({ ...props(), status, paymentGatewayId });
}

interface Transition {
  name: string;
  allowed: OrderStatus[];
  target: OrderStatus;
  event: string;
  run: (order: Order) => void;
}

const TRANSITIONS: Transition[] = [
  {
    name: 'confirm',
    allowed: [OrderStatus.DRAFT],
    target: OrderStatus.CONFIRMED,
    event: 'OrderConfirmedEvent',
    run: (order: Order): void => order.confirm(),
  },
  {
    name: 'markAsPaid',
    allowed: [OrderStatus.PENDING_PAYMENT, OrderStatus.CONFIRMED],
    target: OrderStatus.PAID,
    event: 'OrderPaidEvent',
    run: (order: Order): void => order.markAsPaid(GATEWAY),
  },
  {
    name: 'markAsProcessing',
    allowed: [OrderStatus.PAID],
    target: OrderStatus.PROCESSING,
    event: 'OrderProcessingEvent',
    run: (order: Order): void => order.markAsProcessing(),
  },
  {
    name: 'markAsShipped',
    allowed: [OrderStatus.PROCESSING],
    target: OrderStatus.SHIPPED,
    event: 'OrderShippedEvent',
    run: (order: Order): void => order.markAsShipped(),
  },
  {
    name: 'markAsDelivered',
    allowed: [OrderStatus.SHIPPED],
    target: OrderStatus.DELIVERED,
    event: 'OrderDeliveredEvent',
    run: (order: Order): void => order.markAsDelivered(),
  },
  {
    name: 'cancel',
    allowed: [OrderStatus.CONFIRMED, OrderStatus.PROCESSING],
    target: OrderStatus.CANCELLED,
    event: 'OrderCancelledEvent',
    run: (order: Order): void => order.cancel(),
  },
  {
    name: 'applyObservedFullRefund',
    allowed: [
      OrderStatus.CONFIRMED,
      OrderStatus.PAID,
      OrderStatus.PROCESSING,
      OrderStatus.SHIPPED,
      OrderStatus.DELIVERED,
    ],
    target: OrderStatus.REFUNDED,
    event: 'OrderRefundedEvent',
    run: (order: Order): void => order.applyObservedFullRefund(GATEWAY),
  },
];

const PAIRS: [string, OrderStatus, boolean][] = TRANSITIONS.flatMap(
  (t: Transition): [string, OrderStatus, boolean][] =>
    Object.values(OrderStatus).map((status: OrderStatus): [string, OrderStatus, boolean] => [
      t.name,
      status,
      t.allowed.includes(status),
    ]),
);

describe('Order state machine', (): void => {
  beforeEach((): void => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:00.000Z'));
  });
  afterEach((): void => {
    vi.useRealTimers();
  });

  it('covers 9 statuses times 7 transition methods', (): void => {
    expect(Object.values(OrderStatus)).toHaveLength(9);
    expect(PAIRS).toHaveLength(63);
  });

  it.each(PAIRS)(
    '%s from %s allowed=%s',
    (name: string, from: OrderStatus, allowed: boolean): void => {
      const t = TRANSITIONS.find((candidate: Transition): boolean => candidate.name === name);
      if (!t) throw new Error('unknown transition');
      const order = orderIn(from);
      const versionBefore = order.getVersion();
      if (allowed) {
        t.run(order);
        expect(order.getStatus()).toBe(t.target);
        expect(order.domainEvents.map((e: { eventName: string }): string => e.eventName)).toEqual([
          t.event,
        ]);
        expect(order.getVersion()).toBe(versionBefore + 1);
      } else {
        expect((): void => t.run(order)).toThrow(InvalidOrderStateException);
        expect(order.getStatus()).toBe(from);
        expect(order.domainEvents).toHaveLength(0);
        expect(order.getVersion()).toBe(versionBefore);
      }
    },
  );

  it('markAsPaid stores the gateway id and puts it in the event', (): void => {
    const order = orderIn(OrderStatus.PENDING_PAYMENT);
    order.markAsPaid(GATEWAY);
    expect(order.getPaymentGatewayId()).toBe(GATEWAY);
    expect(order.domainEvents[0]).toMatchObject({
      orderId: createOrderId('order'),
      paymentGatewayId: GATEWAY,
    });
  });

  it('confirm refuses a non-draft order with the exact message', (): void => {
    expect((): void => orderIn(OrderStatus.PAID).confirm()).toThrow(
      'Invalid order state: Only draft orders can be confirmed.',
    );
  });

  it.each([
    [
      'markAsShipped',
      (o: Order): void => o.markAsShipped(),
      'Order must be processing to be shipped.',
    ],
    [
      'markAsDelivered',
      (o: Order): void => o.markAsDelivered(),
      'Order must be shipped to be delivered.',
    ],
    [
      'markAsProcessing',
      (o: Order): void => o.markAsProcessing(),
      'Order must be paid to be processed.',
    ],
    [
      'markAsPaid',
      (o: Order): void => o.markAsPaid(GATEWAY),
      'Order must be pending or confirmed to be paid.',
    ],
    [
      'cancel',
      (o: Order): void => o.cancel(),
      'Only confirmed or processing orders can be cancelled.',
    ],
    [
      'applyObservedFullRefund',
      (o: Order): void => o.applyObservedFullRefund(GATEWAY),
      'Order cannot receive an observed refund in its current state.',
    ],
  ])(
    '%s rejection message from a draft/cancelled order',
    (_n: string, run: (o: Order) => void, message: string): void => {
      expect((): void => run(orderIn(OrderStatus.CANCELLED))).toThrow(
        `Invalid order state: ${message}`,
      );
    },
  );

  it('confirm of a draft without items throws the item message (unreachable through the factory)', (): void => {
    // Items cannot be emptied on a draft: removeOrderItem and the factories reject it.
    expect((): void => orderIn(OrderStatus.DRAFT).removeOrderItem('item')).toThrow(
      InvalidOrderAttributeException,
    );
    expect((): Order => Order.reconstitute({ ...props(), items: [] })).toThrow(
      'Invalid order attribute: Order must have at least one item.',
    );
  });

  describe('applyObservedFullRefund gateway match', (): void => {
    it('rejects a different gateway id and leaves the order untouched', (): void => {
      const order = orderIn(OrderStatus.PAID, GATEWAY);
      expect((): void => order.applyObservedFullRefund(createPaymentGatewayId('other'))).toThrow(
        'Invalid order state: Refund provider order does not match the paid order.',
      );
      expect(order.getStatus()).toBe(OrderStatus.PAID);
      expect(order.getPaymentGatewayId()).toBe(GATEWAY);
      expect(order.domainEvents).toHaveLength(0);
    });
    it('accepts the same gateway id', (): void => {
      const order = orderIn(OrderStatus.PAID, GATEWAY);
      order.applyObservedFullRefund(GATEWAY);
      expect(order.getStatus()).toBe(OrderStatus.REFUNDED);
    });
    it('adopts the gateway id when none was stored', (): void => {
      const order = orderIn(OrderStatus.CONFIRMED);
      order.applyObservedFullRefund(GATEWAY);
      expect(order.getPaymentGatewayId()).toBe(GATEWAY);
    });
  });

  describe('shouldRestoreInventory', (): void => {
    it.each(Object.values(OrderStatus))('for %s', (status: OrderStatus): void => {
      const expected = status === OrderStatus.CONFIRMED || status === OrderStatus.PROCESSING;
      expect(orderIn(status).shouldRestoreInventory()).toBe(expected);
    });
  });

  describe('cancelDueToPaymentExpiry', (): void => {
    it.each(Object.values(OrderStatus))('from %s', (status: OrderStatus): void => {
      const order = orderIn(status);
      if (status === OrderStatus.CONFIRMED) {
        order.cancelDueToPaymentExpiry();
        expect(order.getStatus()).toBe(OrderStatus.CANCELLED);
        expect(order.domainEvents.map((e: { eventName: string }): string => e.eventName)).toEqual([
          'OrderCancelledEvent',
        ]);
      } else {
        expect((): void => order.cancelDueToPaymentExpiry()).toThrow(
          'Invalid order state: Only a confirmed order may expire.',
        );
        expect(order.getStatus()).toBe(status);
      }
    });
  });

  describe('changeShippingAddress', (): void => {
    const allowed = [
      OrderStatus.DRAFT,
      OrderStatus.CONFIRMED,
      OrderStatus.PENDING_PAYMENT,
      OrderStatus.PROCESSING,
    ];
    const newAddress = Address.create('Other', 'Town', 'State', '999', 'CO');
    it.each(Object.values(OrderStatus))('from %s', (status: OrderStatus): void => {
      const order = orderIn(status);
      const before = order.getShippingAddress();
      if (allowed.includes(status)) {
        order.changeShippingAddress(newAddress);
        expect(order.getShippingAddress()).toBe(newAddress);
        expect(order.getVersion()).toBe(1);
        expect(order.getUpdatedAt()).toEqual(new Date('2026-01-15T12:00:00.000Z'));
      } else {
        expect((): void => order.changeShippingAddress(newAddress)).toThrow(
          'Invalid order state: Shipping address can only change while the order is draft, confirmed, awaiting payment or processing.',
        );
        expect(order.getShippingAddress()).toBe(before);
        expect(order.getVersion()).toBe(0);
      }
    });
  });

  describe('nextLogisticsStatus', (): void => {
    it.each(Object.values(OrderStatus))('for %s', (status: OrderStatus): void => {
      const expected: Partial<Record<OrderStatus, OrderStatus>> = {
        [OrderStatus.PAID]: OrderStatus.PROCESSING,
        [OrderStatus.PROCESSING]: OrderStatus.SHIPPED,
        [OrderStatus.SHIPPED]: OrderStatus.DELIVERED,
      };
      expect(nextLogisticsStatus(status)).toBe(expected[status] ?? null);
    });
  });

  it('create starts as draft, version 0, with one OrderCreatedEvent', (): void => {
    const order = create(props());
    expect(order.getStatus()).toBe(OrderStatus.DRAFT);
    expect(order.getVersion()).toBe(0);
    expect(order.domainEvents.map((e: { eventName: string }): string => e.eventName)).toEqual([
      'OrderCreatedEvent',
    ]);
    order.clearDomainEvents();
    expect(order.domainEvents).toHaveLength(0);
  });
});
