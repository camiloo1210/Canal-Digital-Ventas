import { Order, type OrderProps } from '@/orders/domain/entities/order.entity';
import { OrderItem } from '@/orders/domain/entities/order-item.entity';
import { OrderStatus } from '@/orders/domain/enums/order-status.enum';
import { createOrderId } from '@/orders/domain/types/order-id.type';
import { createCustomerId } from '@/orders/domain/types/customer-id.type';
import { createOrderItemId } from '@/orders/domain/types/order-item-id.type';
import { createProductId } from '@/products/domain/types/product-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { Money } from '@/shared/domain/value-objects/money.vo';
import { Currency } from '@/shared/domain/enums/currency.enum';
import { Address } from '@/shared/domain/value-objects/adress.vo';

export const PAYABLE_ORDER_TENANT_ID = 'tenant-1';
export const PAYABLE_ORDER_ID = 'order-1';
/** Total of the default order, in minor units. */
export const PAYABLE_ORDER_TOTAL_CENTS = 100;

/** Valid, event-free order (reconstituted), CONFIRMED by default. Deterministic. */
export function buildPayableOrder(overrides: Partial<OrderProps> = {}): Order {
  return Order.reconstitute({
    id: createOrderId(PAYABLE_ORDER_ID),
    orderNumber: 'ORD-000001',
    customerId: createCustomerId('customer-1'),
    tenantId: createTenantId(PAYABLE_ORDER_TENANT_ID),
    items: [
      OrderItem.reconstitute({
        id: createOrderItemId('item-1'),
        productId: createProductId('product-1'),
        variantId: null,
        productName: 'Gaming Mouse',
        sku: 'SKU-GM-01',
        unitPrice: Money.from(50, Currency.USD),
        quantity: 2,
        subtotal: Money.from(100, Currency.USD),
      }),
    ],
    status: OrderStatus.CONFIRMED,
    subtotal: Money.from(PAYABLE_ORDER_TOTAL_CENTS, Currency.USD),
    taxAmount: Money.from(0, Currency.USD),
    discountAmount: Money.from(0, Currency.USD),
    shippingCost: Money.from(0, Currency.USD),
    totalAmount: Money.from(PAYABLE_ORDER_TOTAL_CENTS, Currency.USD),
    shippingAddress: Address.create('Main St 123', 'City', 'State', '12345', 'US'),
    paymentGatewayId: null,
    createdAt: new Date('2026-01-15T12:00:00.000Z'),
    updatedAt: new Date('2026-01-15T12:00:00.000Z'),
    version: 0,
    ...overrides,
  });
}
