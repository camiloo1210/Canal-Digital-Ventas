import postgres from 'postgres';
import {
  OrderRepositoryPort,
  OrderFilters,
} from '@/orders/application/ports/out/order-repository.port';
import { Order } from '@/orders/domain/entities/order.entity';
import { OrderId } from '@/orders/domain/types/order-id.type';
import { CustomerId } from '@/orders/domain/types/customer-id.type';
import { TenantId } from '@/shared/domain/types/tenant-id.type';
import { PaginatedResult, PaginationOptions } from '@/shared/domain/pagination/pagination';
import { TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';
import { OrderRepositoryException } from '@/orders/application/exceptions/order-repository.exception';
import { EventBusPort } from '@/shared/application/ports/out/event-bus.port';

export class PostgresOrderRepository implements OrderRepositoryPort {
  constructor(private readonly eventBus: EventBusPort) {}

  async save(order: Order, tx?: TransactionContext): Promise<void> {
    if (!tx) {
      throw new OrderRepositoryException(
        'PostgresOrderRepository requires a TransactionContext for mutations.',
      );
    }

    await tx.executeNative(async (sql: postgres.TransactionSql<Record<string, unknown>>) => {
      // 1. Upsert Order
      const addr = order.getShippingAddress();
      await sql`
        INSERT INTO sales.orders (
          id, order_number, customer_id, tenant_id, status, subtotal_cents, tax_amount_cents, discount_amount_cents, shipping_cost_cents, total_amount_cents,
          shipping_address_street, shipping_address_city, shipping_address_state, shipping_address_zip_code, shipping_address_country, shipping_address_reference,
          payment_gateway_id, version, created_at, updated_at
        ) VALUES (
          ${order.getId()}, ${order.getOrderNumber()}, ${order.getCustomerId()}, ${order.getTenantId()}, ${order.getStatus()}, ${order.getSubtotal().getValue()}, ${order.getTaxAmount().getValue()}, ${order.getDiscountAmount().getValue()}, ${order.getShippingCost().getValue()}, ${order.getTotalAmount().getValue()},
          ${addr.getStreet()}, ${addr.getCity()}, ${addr.getState()}, ${addr.getZipCode()}, ${addr.getCountry()}, ${addr.getReference() || null},
          ${order.getPaymentGatewayId()}, ${order.getVersion()}, ${order.getCreatedAt()}, ${order.getUpdatedAt()}
        )
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          subtotal_cents = EXCLUDED.subtotal_cents,
          tax_amount_cents = EXCLUDED.tax_amount_cents,
          discount_amount_cents = EXCLUDED.discount_amount_cents,
          shipping_cost_cents = EXCLUDED.shipping_cost_cents,
          total_amount_cents = EXCLUDED.total_amount_cents,
          shipping_address_street = EXCLUDED.shipping_address_street,
          shipping_address_city = EXCLUDED.shipping_address_city,
          shipping_address_state = EXCLUDED.shipping_address_state,
          shipping_address_zip_code = EXCLUDED.shipping_address_zip_code,
          shipping_address_country = EXCLUDED.shipping_address_country,
          shipping_address_reference = EXCLUDED.shipping_address_reference,
          payment_gateway_id = EXCLUDED.payment_gateway_id,
          version = EXCLUDED.version,
          updated_at = EXCLUDED.updated_at
        WHERE sales.orders.version = EXCLUDED.version - 1;
      `;

      // 2. Delete existing items
      await sql`DELETE FROM sales.order_items WHERE order_id = ${order.getId()}`;

      // 3. Insert items
      const items = order.getItems();
      if (items.length > 0) {
        const itemRows = items.map((i) => ({
          id: i.getId(),
          order_id: order.getId(),
          product_id: i.getProductId(),
          product_name: i.getProductName(),
          quantity: i.getQuantity(),
          unit_price_cents: i.getUnitPrice().getValue(),
          sku: i.getSku(),
          variant_id: i.getVariantId(),
          subtotal_cents: i.getSubtotal().getValue(),
        }));

        await sql`
          INSERT INTO sales.order_items ${sql(itemRows)}
        `;
      }
    });

    // Publish domain events
    await this.eventBus.publish(order.domainEvents, tx);
    order.clearDomainEvents();
  }

  async findById(
    _id: OrderId,
    _tenantId: TenantId,
    _tx?: TransactionContext,
  ): Promise<Order | null> {
    throw new Error('Not implemented for this slice (only generating order needed)');
  }

  async findPendingByCustomerId(
    _customerId: CustomerId,
    _tenantId: TenantId,
  ): Promise<Order | null> {
    throw new Error('Not implemented');
  }

  async findAll(
    _tenantId: TenantId,
    _pagination?: PaginationOptions,
  ): Promise<PaginatedResult<Order>> {
    throw new Error('Not implemented');
  }

  async searchByFilters(
    _filters: OrderFilters,
    _pagination?: PaginationOptions,
  ): Promise<PaginatedResult<Order>> {
    throw new Error('Not implemented');
  }
}
