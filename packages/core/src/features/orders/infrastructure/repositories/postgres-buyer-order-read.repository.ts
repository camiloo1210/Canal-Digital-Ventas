import postgres from 'postgres';
import { BuyerOrderReadRepositoryPort } from '@/orders/application/ports/out/buyer-order-read-repository.port';
import {
  BuyerOrderReadModel,
  BuyerOrderItemReadModel,
} from '@/orders/application/read-models/buyer-order.read-model';

export class PostgresBuyerOrderReadRepository implements BuyerOrderReadRepositoryPort {
  constructor(private readonly sql: postgres.Sql<Record<string, unknown>>) {}

  async findOrdersByBuyerId(buyerAuthId: string): Promise<BuyerOrderReadModel[]> {
    const ordersData = await this.sql`
      SELECT 
        o.id,
        o.order_number,
        o.tenant_id,
        t.name as tenant_name,
        t.slug as tenant_slug,
        t.base_currency as currency,
        o.status,
        o.total_amount_cents,
        o.subtotal_cents,
        o.tax_amount_cents,
        o.shipping_cost_cents,
        o.created_at
      FROM sales.orders o
      INNER JOIN sales.customers c ON o.customer_id = c.id AND c.tenant_id = o.tenant_id
      INNER JOIN core.tenants t ON o.tenant_id = t.id
      WHERE c.global_auth_id = ${buyerAuthId}
      ORDER BY o.created_at DESC;
    `;

    if (ordersData.length === 0) {
      return [];
    }

    const orderIds = ordersData.map((o): string => o.id as string);

    const itemsData = await this.sql`
      SELECT 
        id,
        order_id,
        product_id,
        product_name,
        quantity,
        unit_price_cents,
        subtotal_cents
      FROM sales.order_items
      WHERE order_id IN ${this.sql(orderIds)};
    `;

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
      });
      itemsByOrderId.set(orderId, list);
    }

    return ordersData.map((o): BuyerOrderReadModel => {
      const status = (o.status as string).toLowerCase();
      const canCancel = status === 'confirmed' || status === 'processing';
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
        items: itemsByOrderId.get(o.id as string) || [],
      };
    });
  }
}
