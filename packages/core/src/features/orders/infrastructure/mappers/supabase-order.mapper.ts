import { Order } from '@/orders/domain/entities/order.entity';
import { OrderItem } from '@/orders/domain/entities/order-item.entity';
import { DbOrderRow, DbOrderItemRow } from '@/orders/infrastructure/types/supabase-order.types';
import { Money } from '@/shared/domain/value-objects/money.vo';
import { Currency } from '@/shared/domain/enums/currency.enum';
import { Address } from '@/shared/domain/value-objects/adress.vo';
import { parseOrderStatus } from '@/orders/domain/enums/order-status.enum';
import { OrderId } from '@/orders/domain/types/order-id.type';
import { CustomerId } from '@/orders/domain/types/customer-id.type';
import { TenantId } from '@/shared/domain/types/tenant-id.type';
import { PaymentGatewayId } from '@/orders/domain/types/payment-gateway-id.type';
import { OrderItemId } from '@/orders/domain/types/order-item-id.type';
import { ProductId } from '@/orders/domain/types/product-id.type';
import { VariantId } from '@/orders/domain/types/variant-id.type';

export class SupabaseOrderMapper {
  static toDomain(row: DbOrderRow): Order {
    const items = (row.order_items || []).map((itemRow: DbOrderItemRow) =>
      OrderItem.reconstitute({
        id: itemRow.id as OrderItemId,
        productId: itemRow.product_id as ProductId,
        variantId: itemRow.variant_id ? (itemRow.variant_id as VariantId) : null,
        productName: itemRow.product_name,
        sku: itemRow.sku,
        unitPrice: Money.from(itemRow.unit_price_cents, Currency.USD),
        quantity: itemRow.quantity,
        subtotal: Money.from(itemRow.subtotal_cents, Currency.USD),
      }),
    );

    let shippingAddress: Address | null = null;
    if (row.shipping_address) {
      shippingAddress = Address.create(
        row.shipping_address.street,
        row.shipping_address.city,
        row.shipping_address.state,
        row.shipping_address.zipCode,
        row.shipping_address.country,
        row.shipping_address.reference,
      );
    }

    return Order.reconstitute({
      id: row.id as OrderId,
      orderNumber: row.order_number,
      customerId: row.customer_id as CustomerId,
      tenantId: row.tenant_id as TenantId,
      items,
      status: parseOrderStatus(row.status),
      subtotal: Money.from(row.subtotal_cents, Currency.USD),
      taxAmount: Money.from(row.tax_amount_cents, Currency.USD),
      discountAmount: Money.from(row.discount_amount_cents, Currency.USD),
      shippingCost: Money.from(row.shipping_cost_cents, Currency.USD),
      totalAmount: Money.from(row.total_amount_cents, Currency.USD),
      shippingAddress: shippingAddress as Address,
      paymentGatewayId: row.payment_gateway_id
        ? (row.payment_gateway_id as PaymentGatewayId)
        : null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      version: row.version ?? 0,
    });
  }

  static toPersistence(order: Order): { orderRow: DbOrderRow; orderItemsRows: DbOrderItemRow[] } {
    const orderRow: DbOrderRow = {
      id: order.getId(),
      order_number: order.getOrderNumber(),
      customer_id: order.getCustomerId(),
      tenant_id: order.getTenantId(),
      status: order.getStatus(),
      subtotal_cents: order.getSubtotal().getValue(),
      tax_amount_cents: order.getTaxAmount().getValue(),
      discount_amount_cents: order.getDiscountAmount().getValue(),
      shipping_cost_cents: order.getShippingCost().getValue(),
      total_amount_cents: order.getTotalAmount().getValue(),
      shipping_address: order.getShippingAddress()
        ? {
            street: order.getShippingAddress().getStreet(),
            city: order.getShippingAddress().getCity(),
            state: order.getShippingAddress().getState(),
            zipCode: order.getShippingAddress().getZipCode(),
            country: order.getShippingAddress().getCountry(),
            reference: order.getShippingAddress().getReference() || undefined,
          }
        : null,
      payment_gateway_id: order.getPaymentGatewayId(),
      created_at: order.getCreatedAt().toISOString(),
      updated_at: order.getUpdatedAt().toISOString(),
      version: order.getVersion(),
    };

    const orderItemsRows: DbOrderItemRow[] = order.getItems().map((item: OrderItem) => ({
      id: item.getId(),
      order_id: order.getId(),
      product_id: item.getProductId(),
      variant_id: item.getVariantId(),
      product_name: item.getProductName(),
      sku: item.getSku(),
      unit_price_cents: item.getUnitPrice().getValue(),
      quantity: item.getQuantity(),
      subtotal_cents: item.getSubtotal().getValue(),
      created_at: order.getCreatedAt().toISOString(),
      updated_at: order.getUpdatedAt().toISOString(),
    }));

    return { orderRow, orderItemsRows };
  }
}
