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
import { EventBusPort, DomainEventEnvelope } from '@/shared/application/ports/out/event-bus.port';
import { ORDER_AGGREGATE_TYPE } from '@/orders/application/outbox/order-aggregate.constants';

import { OptimisticConcurrencyException } from '@/shared/application/exceptions/optimistic-concurrency.exception';
import { SupabaseOrderMapper } from '@/orders/infrastructure/mappers/supabase-order.mapper';
import { DbOrderRow } from '@/orders/infrastructure/types/supabase-order.types';

export class PostgresOrderRepository implements OrderRepositoryPort {
  constructor(
    private readonly eventBus: EventBusPort,
    private readonly sql?: postgres.Sql<Record<string, unknown>>,
  ) {}

  async save(order: Order, tx?: TransactionContext): Promise<void> {
    if (!tx) {
      throw new OrderRepositoryException(
        'PostgresOrderRepository requires a TransactionContext for mutations.',
      );
    }

    await tx.executeNative(async (sql: postgres.TransactionSql<Record<string, unknown>>) => {
      // 1. Upsert Order
      const addr = order.getShippingAddress();
      const rows = await sql`
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
        WHERE sales.orders.version = EXCLUDED.version - 1
        RETURNING id;
      `;

      if (rows.length === 0) {
        throw new OptimisticConcurrencyException('Order', order.getId());
      }

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
    if (order.domainEvents.length > 0) {
      const envelopes: DomainEventEnvelope[] = order.domainEvents.map((event) => ({
        context: {
          tenantId: order.getTenantId(),
          aggregateType: ORDER_AGGREGATE_TYPE,
          aggregateId: order.getId(),
        },
        event,
      }));
      await this.eventBus.publish(envelopes, tx);
      order.clearDomainEvents();
    }
  }

  async findById(id: OrderId, tenantId?: TenantId, tx?: TransactionContext): Promise<Order | null> {
    const executeQuery = async (
      conn:
        postgres.Sql<Record<string, unknown>> | postgres.TransactionSql<Record<string, unknown>>,
    ): Promise<Order | null> => {
      const orderRows = tenantId
        ? await conn`
            SELECT * FROM sales.orders
            WHERE id = ${id} AND tenant_id = ${tenantId}
          `
        : await conn`
            SELECT * FROM sales.orders
            WHERE id = ${id}
          `;

      if (orderRows.length === 0) return null;

      const orderRow = orderRows[0];
      const itemRows = await conn`
        SELECT * FROM sales.order_items
        WHERE order_id = ${id}
      `;

      const dbOrderRow: DbOrderRow = {
        id: orderRow.id as string,
        order_number: orderRow.order_number as string,
        customer_id: orderRow.customer_id as string,
        tenant_id: orderRow.tenant_id as string,
        status: orderRow.status as string,
        subtotal_cents: Number(orderRow.subtotal_cents),
        tax_amount_cents: Number(orderRow.tax_amount_cents),
        discount_amount_cents: Number(orderRow.discount_amount_cents),
        shipping_cost_cents: Number(orderRow.shipping_cost_cents),
        total_amount_cents: Number(orderRow.total_amount_cents),
        shipping_address: {
          street: orderRow.shipping_address_street as string,
          city: orderRow.shipping_address_city as string,
          state: orderRow.shipping_address_state as string,
          zipCode: orderRow.shipping_address_zip_code as string,
          country: orderRow.shipping_address_country as string,
          reference: (orderRow.shipping_address_reference as string) || undefined,
        },
        payment_gateway_id: (orderRow.payment_gateway_id as string) || null,
        created_at: new Date(orderRow.created_at as string | Date).toISOString(),
        updated_at: new Date(orderRow.updated_at as string | Date).toISOString(),
        version: Number(orderRow.version ?? 0),
        order_items: itemRows.map((i) => ({
          id: i.id as string,
          order_id: i.order_id as string,
          product_id: i.product_id as string,
          variant_id: (i.variant_id as string) || null,
          product_name: i.product_name as string,
          sku: i.sku as string,
          unit_price_cents: Number(i.unit_price_cents),
          quantity: Number(i.quantity),
          subtotal_cents: Number(i.subtotal_cents),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })),
      };

      return SupabaseOrderMapper.toDomain(dbOrderRow);
    };

    if (tx) {
      return tx.executeNative<postgres.TransactionSql<Record<string, unknown>>, Order | null>(
        executeQuery,
      );
    }

    if (!this.sql) {
      throw new OrderRepositoryException(
        'PostgresOrderRepository requires a sql connection or a TransactionContext for findById.',
      );
    }

    return executeQuery(this.sql);
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
