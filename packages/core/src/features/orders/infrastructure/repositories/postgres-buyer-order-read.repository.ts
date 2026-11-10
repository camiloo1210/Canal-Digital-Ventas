import postgres from 'postgres';
import { BuyerOrderReadRepositoryPort } from '@/orders/application/ports/out/buyer-order-read-repository.port';
import {
  BuyerOrderReadModel,
  BuyerOrderItemReadModel,
  BuyerOrderHistoryEntry,
} from '@/orders/application/read-models/buyer-order.read-model';

export class PostgresBuyerOrderReadRepository implements BuyerOrderReadRepositoryPort {
  constructor(private readonly sql: postgres.Sql<Record<string, unknown>>) {}

  public async findOrdersByBuyerId(buyerAuthId: string): Promise<BuyerOrderReadModel[]> {
    return this.readOrders(buyerAuthId, null);
  }

  public async findOrderByBuyerId(
    buyerAuthId: string,
    orderId: string,
  ): Promise<BuyerOrderReadModel | null> {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId))
      return null;
    const orders = await this.readOrders(buyerAuthId, orderId);
    return orders[0] ?? null;
  }

  private async readOrders(
    buyerAuthId: string,
    orderId: string | null,
  ): Promise<BuyerOrderReadModel[]> {
    return this.sql.begin(
      'isolation level repeatable read read only',
      async (tx): Promise<BuyerOrderReadModel[]> => this.readSnapshot(tx, buyerAuthId, orderId),
    );
  }

  private async readSnapshot(
    sql: postgres.TransactionSql<Record<string, unknown>>,
    buyerAuthId: string,
    orderId: string | null,
  ): Promise<BuyerOrderReadModel[]> {
    const ordersData = await sql`
      SELECT 
        o.id,
        o.order_number,
        o.tenant_id,
        t.name as tenant_name,
        t.slug as tenant_slug,
        o.currency as currency,
        o.status,
        o.total_amount_cents,
        o.subtotal_cents,
        o.tax_amount_cents,
        o.shipping_cost_cents,
        concat_ws(', ', o.shipping_address_street, o.shipping_address_city, o.shipping_address_state, o.shipping_address_zip_code, o.shipping_address_country) AS shipping_address,
        o.created_at,
        payment.active_payment_count,
        payment.active_payment_status,
        EXISTS (SELECT 1 FROM sales.payments p WHERE p.order_id = o.id AND p.tenant_id <> o.tenant_id AND p.status <> 'failed') AS has_foreign_payment
      FROM sales.orders o
      INNER JOIN sales.customers c ON o.customer_id = c.id AND c.tenant_id = o.tenant_id
      INNER JOIN core.tenants t ON o.tenant_id = t.id
      CROSS JOIN LATERAL (
        SELECT count(*)::int AS active_payment_count, min(p.status) AS active_payment_status
        FROM sales.payments p
        WHERE p.order_id = o.id AND p.tenant_id = o.tenant_id AND p.status <> 'failed'
      ) payment
      WHERE c.global_auth_id = ${buyerAuthId} AND (${orderId}::uuid IS NULL OR o.id = ${orderId}::uuid)
      ORDER BY o.created_at DESC;
    `;

    if (ordersData.length === 0) {
      return [];
    }

    const orderIds = ordersData.map((o): string => o.id as string);

    const itemsData = await sql`
      SELECT
        oi.id,
        oi.order_id,
        oi.product_id,
        oi.product_name,
        oi.quantity,
        oi.unit_price_cents,
        oi.subtotal_cents,
        p.image_url
      FROM sales.order_items oi
      LEFT JOIN catalog.products p ON p.id = oi.product_id
      WHERE oi.order_id IN ${sql(orderIds)};
    `;

    let historyAvailable = true;
    let historyData: {
      order_id: string;
      from_status: string | null;
      to_status: string;
      changed_at: Date;
    }[] = [];
    try {
      historyData = await sql.savepoint(
        async (nested): Promise<typeof historyData> => nested`
      SELECT h.order_id, h.from_status, h.to_status, h.changed_at
      FROM sales.order_status_history h
      INNER JOIN sales.orders o ON h.order_id = o.id AND h.tenant_id = o.tenant_id
      INNER JOIN sales.customers c ON o.customer_id = c.id AND c.tenant_id = o.tenant_id
      WHERE c.global_auth_id = ${buyerAuthId} AND (${orderId}::uuid IS NULL OR o.id = ${orderId}::uuid) AND o.id IN ${sql(orderIds)}
      ORDER BY h.changed_at, h.id;
      `,
      );
    } catch (error: unknown) {
      if (
        typeof error !== 'object' ||
        error === null ||
        !('code' in error) ||
        !['42501', '42P01'].includes(String(error.code))
      )
        throw error;
      historyAvailable = false;
    }

    let shipmentAvailable = true;
    const shipmentByOrderId = new Map<
      string,
      { carrier: string | null; trackingNumber: string | null }
    >();
    try {
      const shipments = await sql.savepoint(
        async (
          nested,
        ): Promise<
          { order_id: string; carrier: string | null; tracking_number: string | null }[]
        > => nested`SELECT ms.order_id, ms.carrier, ms.tracking_number FROM sales.manual_shipments ms
        JOIN sales.orders o ON o.id = ms.order_id AND o.tenant_id = ms.tenant_id
        JOIN sales.customers c ON c.id = o.customer_id AND c.tenant_id = o.tenant_id
        WHERE c.global_auth_id = ${buyerAuthId} AND (${orderId}::uuid IS NULL OR o.id = ${orderId}::uuid) AND o.id IN ${sql(orderIds)}`,
      );
      for (const shipment of shipments)
        shipmentByOrderId.set(shipment.order_id as string, {
          carrier: shipment.carrier as string | null,
          trackingNumber: shipment.tracking_number as string | null,
        });
    } catch (error: unknown) {
      if (
        typeof error !== 'object' ||
        error === null ||
        !('code' in error) ||
        !['42501', '42P01'].includes(String(error.code))
      )
        throw error;
      shipmentAvailable = false;
    }
    const historyByOrderId = new Map<string, BuyerOrderHistoryEntry[]>();
    for (const entry of historyData) {
      const orderId = entry.order_id as string;
      const history = historyByOrderId.get(orderId) || [];
      history.push({
        status: entry.to_status as string,
        changedAt:
          entry.from_status == null
            ? null
            : new Date(entry.changed_at as string | Date).toISOString(),
      });
      historyByOrderId.set(orderId, history);
    }

    const itemsByOrderId = new Map<string, BuyerOrderItemReadModel[]>();
    for (const item of itemsData) {
      const orderId = item.order_id as string;
      const list = itemsByOrderId.get(orderId) || [];
      list.push({
        id: item.id as string,
        productId: item.product_id as string,
        productName: item.product_name as string,
        quantity: Number(item.quantity),
        unitPriceCents: Number(item.unit_price_cents),
        subtotalCents: Number(item.subtotal_cents),
        imageUrl: typeof item.image_url === 'string' && item.image_url ? item.image_url : null,
      });
      itemsByOrderId.set(orderId, list);
    }

    return ordersData.map((o): BuyerOrderReadModel => {
      const status = (o.status as string).toLowerCase();
      const activePaymentCount = Number(o.active_payment_count);
      const paymentAllowsCancellation =
        activePaymentCount === 0 ||
        (activePaymentCount === 1 &&
          ['pending', 'expired_unpaid_awaiting_reconciliation'].includes(
            o.active_payment_status as string,
          ));
      const canCancel =
        (status === 'confirmed' || status === 'processing') &&
        paymentAllowsCancellation &&
        o.has_foreign_payment === false;
      return {
        id: o.id as string,
        orderNumber: o.order_number as string,
        tenantId: o.tenant_id as string,
        tenantName: o.tenant_name as string,
        tenantSlug: o.tenant_slug as string,
        status: o.status as string,
        currency: o.currency as string,
        totalAmountCents: Number(o.total_amount_cents),
        subtotalCents: Number(o.subtotal_cents),
        taxAmountCents: Number(o.tax_amount_cents),
        shippingCostCents: Number(o.shipping_cost_cents),
        createdAt: new Date(o.created_at as string | Date).toISOString(),
        canCancel,
        nextStep:
          status === 'paid'
            ? 'await_preparation'
            : status === 'processing'
              ? 'await_shipment'
              : status === 'shipped'
                ? 'await_delivery'
                : null,
        shippingAddress: (o.shipping_address as string | undefined) ?? '',
        paymentStatus:
          activePaymentCount === 1 &&
          typeof o.active_payment_status === 'string' &&
          ['pending', 'completed', 'refunded', 'partially_refunded'].includes(
            o.active_payment_status,
          )
            ? (o.active_payment_status as NonNullable<BuyerOrderReadModel['paymentStatus']>)
            : 'unavailable',
        shipment: shipmentByOrderId.get(o.id as string) ?? null,
        shipmentAvailability: shipmentAvailable ? 'available' : 'unavailable',
        history: historyAvailable ? historyByOrderId.get(o.id as string) || [] : null,
        items: itemsByOrderId.get(o.id as string) || [],
      };
    });
  }
}
