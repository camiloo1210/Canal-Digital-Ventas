import { afterEach, beforeEach, describe, it, vi } from 'vitest';
import fc from 'fast-check';
import { Order } from '@/orders/domain/entities/order.entity';
import { OrderItem } from '@/orders/domain/entities/order-item.entity';
import { OrderStatus } from '@/orders/domain/enums/order-status.enum';
import { InvalidOrderStateException } from '@/orders/domain/exceptions/invalid-order-state.exception';
import { DiscountExceedsTotalException } from '@/orders/domain/exceptions/discount-exceeds-total.exception';
import { InvalidMoneyException } from '@/shared/domain/exceptions/invalid-money.exception';
import { createPaymentGatewayId } from '@/orders/domain/types/payment-gateway-id.type';
import { createOrderId } from '@/orders/domain/types/order-id.type';
import { createOrderItemId } from '@/orders/domain/types/order-item-id.type';
import { createCustomerId } from '@/orders/domain/types/customer-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { createProductId } from '@/products/domain/types/product-id.type';
import { Money, MAX_MONEY_CENTS } from '@/shared/domain/value-objects/money.vo';
import { Currency } from '@/shared/domain/enums/currency.enum';
import { Address } from '@/shared/domain/value-objects/adress.vo';

const SEED: number = Number(process.env.FC_SEED ?? 20261108);
const CONFIG: fc.Parameters<unknown> = { numRuns: 500, seed: SEED };
const GATEWAY = createPaymentGatewayId('gateway-1');

interface Transition {
  name: string;
  allowed: OrderStatus[];
  target: OrderStatus;
  run: (order: Order) => void;
}

// Allowed graph, mirrored from the Order matrix in order.entity.test.ts.
const TRANSITIONS: Transition[] = [
  {
    name: 'confirm',
    allowed: [OrderStatus.DRAFT],
    target: OrderStatus.CONFIRMED,
    run: (o: Order): void => o.confirm(),
  },
  {
    name: 'markAsPaid',
    allowed: [OrderStatus.PENDING_PAYMENT, OrderStatus.CONFIRMED],
    target: OrderStatus.PAID,
    run: (o: Order): void => o.markAsPaid(GATEWAY),
  },
  {
    name: 'markAsProcessing',
    allowed: [OrderStatus.PAID],
    target: OrderStatus.PROCESSING,
    run: (o: Order): void => o.markAsProcessing(),
  },
  {
    name: 'markAsShipped',
    allowed: [OrderStatus.PROCESSING],
    target: OrderStatus.SHIPPED,
    run: (o: Order): void => o.markAsShipped(),
  },
  {
    name: 'markAsDelivered',
    allowed: [OrderStatus.SHIPPED],
    target: OrderStatus.DELIVERED,
    run: (o: Order): void => o.markAsDelivered(),
  },
  {
    name: 'cancel',
    allowed: [OrderStatus.CONFIRMED, OrderStatus.PROCESSING],
    target: OrderStatus.CANCELLED,
    run: (o: Order): void => o.cancel(),
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
    run: (o: Order): void => o.applyObservedFullRefund(GATEWAY),
  },
];

// pending_payment has no inbound transition, so it is not reachable from create().
const REACHABLE_FROM_DRAFT: OrderStatus[] = Object.values(OrderStatus).filter(
  (s: OrderStatus): boolean => s !== OrderStatus.PENDING_PAYMENT,
);

const TERMINAL_EXITS: Record<string, OrderStatus[]> = {
  [OrderStatus.CANCELLED]: [OrderStatus.CANCELLED],
  [OrderStatus.REFUNDED]: [OrderStatus.REFUNDED],
  [OrderStatus.DELIVERED]: [OrderStatus.DELIVERED, OrderStatus.REFUNDED],
};

const address: Address = Address.create('Street', 'City', 'State', '123', 'CO');

function buildOrder(
  unit: number,
  quantity: number,
  tax: number,
  discount: number,
  shipping: number,
): Order {
  const price = Money.from(unit, Currency.COP);
  const item = OrderItem.create(
    createOrderItemId('item'),
    createProductId('product'),
    'Product',
    quantity,
    price,
    'SKU',
  );
  return Order.create(
    createOrderId('order'),
    'ORD-1',
    createCustomerId('buyer'),
    createTenantId('tenant'),
    [item],
    item.getSubtotal(),
    Money.from(tax, Currency.COP),
    Money.from(discount, Currency.COP),
    Money.from(shipping, Currency.COP),
    address,
  );
}

function orderIn(status: OrderStatus): Order {
  const price = Money.from(10, Currency.COP);
  const zero = Money.from(0, Currency.COP);
  return Order.reconstitute({
    id: createOrderId('order'),
    orderNumber: 'ORD-1',
    customerId: createCustomerId('buyer'),
    tenantId: createTenantId('tenant'),
    status,
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
    taxAmount: zero,
    discountAmount: zero,
    shippingCost: zero,
    totalAmount: price,
    shippingAddress: address,
    paymentGatewayId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 0,
  });
}

const transitionArb: fc.Arbitrary<Transition> = fc.constantFrom(...TRANSITIONS);
const sequenceArb: fc.Arbitrary<Transition[]> = fc.array(transitionArb, { maxLength: 12 });

describe('Order property tests', (): void => {
  beforeEach((): void => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:00.000Z'));
  });
  afterEach((): void => {
    vi.useRealTimers();
  });

  it('property: random call sequences follow the allowed graph exactly and stay reachable', (): void => {
    fc.assert(
      fc.property(sequenceArb, (calls: Transition[]): boolean => {
        const order = buildOrder(10, 1, 0, 0, 0);
        let model: OrderStatus = OrderStatus.DRAFT;
        for (const call of calls) {
          const legal = call.allowed.includes(model);
          const version = order.getVersion();
          const events = order.domainEvents.length;
          let threw = false;
          try {
            call.run(order);
          } catch (error: unknown) {
            if (!(error instanceof InvalidOrderStateException)) return false;
            threw = true;
          }
          if (threw === legal) return false;
          if (legal) {
            model = call.target;
            if (order.getVersion() !== version + 1 || order.domainEvents.length !== events + 1) {
              return false;
            }
          } else if (
            order.getVersion() !== version ||
            order.domainEvents.length !== events ||
            order.getStatus() !== model
          ) {
            return false;
          }
          if (order.getStatus() !== model) return false;
          if (!REACHABLE_FROM_DRAFT.includes(order.getStatus())) return false;
        }
        return true;
      }),
      CONFIG,
    );
  });

  it('property: terminal statuses never leave their set except delivered to refunded', (): void => {
    fc.assert(
      fc.property(
        fc.constantFrom(OrderStatus.CANCELLED, OrderStatus.REFUNDED, OrderStatus.DELIVERED),
        sequenceArb,
        (start: OrderStatus, calls: Transition[]): boolean => {
          const order = orderIn(start);
          let current: OrderStatus = start;
          for (const call of calls) {
            try {
              call.run(order);
            } catch (error: unknown) {
              if (!(error instanceof InvalidOrderStateException)) return false;
            }
            const next = order.getStatus();
            if (!TERMINAL_EXITS[current].includes(next)) return false;
            current = next;
          }
          return true;
        },
      ),
      CONFIG,
    );
  });

  it('property: an illegal call from any starting status never mutates the order', (): void => {
    fc.assert(
      fc.property(
        fc.constantFrom(...Object.values(OrderStatus)),
        transitionArb,
        (start: OrderStatus, call: Transition): boolean => {
          fc.pre(!call.allowed.includes(start));
          const order = orderIn(start);
          try {
            call.run(order);
            return false;
          } catch (error: unknown) {
            return (
              error instanceof InvalidOrderStateException &&
              order.getStatus() === start &&
              order.getVersion() === 0 &&
              order.domainEvents.length === 0 &&
              order.getPaymentGatewayId() === null
            );
          }
        },
      ),
      CONFIG,
    );
  });

  it('property: total equals subtotal plus tax plus shipping minus discount in integer cents', (): void => {
    const amount: fc.Arbitrary<number> = fc.integer({ min: 0, max: MAX_MONEY_CENTS });
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100_000 }),
        fc.integer({ min: 1, max: 20_000 }),
        amount,
        amount,
        amount,
        (
          unit: number,
          quantity: number,
          tax: number,
          discount: number,
          shipping: number,
        ): boolean => {
          const subtotal = BigInt(unit) * BigInt(quantity);
          fc.pre(subtotal <= BigInt(MAX_MONEY_CENTS));
          const expected = subtotal + BigInt(tax) + BigInt(shipping) - BigInt(discount);
          try {
            const order = buildOrder(unit, quantity, tax, discount, shipping);
            return (
              expected >= BigInt(0) &&
              expected <= BigInt(MAX_MONEY_CENTS) &&
              BigInt(order.getTotalAmount().getValue()) === expected &&
              order.getSubtotal().getValue() === Number(subtotal)
            );
          } catch (error: unknown) {
            if (expected < BigInt(0)) return error instanceof DiscountExceedsTotalException;
            return expected > BigInt(MAX_MONEY_CENTS) && error instanceof InvalidMoneyException;
          }
        },
      ),
      CONFIG,
    );
  });
});
