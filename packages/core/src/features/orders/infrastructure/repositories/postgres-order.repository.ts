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
      await sql`
        INSERT INTO public.orders (
          id, order_number, customer_id, tenant_id, status, subtotal, tax_amount, discount_amount, shipping_cost, total_amount, payment_gateway_id, version, created_at, updated_at
        ) VALUES (
          ${order.getId()}, ${order.getOrderNumber()}, ${order.getCustomerId()}, ${order.getTenantId()}, ${order.getStatus()}, ${order.getSubtotal().getValue()}, ${order.getTaxAmount().getValue()}, ${order.getDiscountAmount().getValue()}, ${order.getShippingCost().getValue()}, ${order.getTotalAmount().getValue()}, ${order.getPaymentGatewayId()}, ${order.getVersion()}, ${order.getCreatedAt()}, ${order.getUpdatedAt()}
        )
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          subtotal = EXCLUDED.subtotal,
          tax_amount = EXCLUDED.tax_amount,
          discount_amount = EXCLUDED.discount_amount,
          shipping_cost = EXCLUDED.shipping_cost,
          total_amount = EXCLUDED.total_amount,
          payment_gateway_id = EXCLUDED.payment_gateway_id,
          version = EXCLUDED.version,
          updated_at = EXCLUDED.updated_at
        WHERE orders.version = EXCLUDED.version - 1;
      `;

      // 2. Delete existing items
      await sql`DELETE FROM public.order_items WHERE order_id = ${order.getId()}`;

      // 3. Insert items
      const items = order.getItems();
      if (items.length > 0) {
        const itemRows = items.map((i) => ({
          id: i.getId(),
          order_id: order.getId(),
          product_id: i.getProductId(),
          product_name: i.getProductName(),
          quantity: i.getQuantity(),
          unit_price: i.getUnitPrice().getValue(),
          sku: i.getSku(),
          variant_id: i.getVariantId(),
        }));

        await sql`
          INSERT INTO public.order_items ${sql(itemRows)}
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
