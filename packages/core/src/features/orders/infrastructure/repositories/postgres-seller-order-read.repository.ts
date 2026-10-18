import type postgres from 'postgres';
import type { SellerOrderReadRepositoryPort } from '@/orders/application/ports/out/seller-order-read-repository.port';
import type {
  SellerOrderPage,
  SellerOrderReadModel,
} from '@/orders/application/read-models/seller-order.read-model';
import { nextLogisticsStatus, parseOrderStatus } from '@/orders/domain/enums/order-status.enum';
import { OrderRepositoryException } from '@/orders/application/exceptions/order-repository.exception';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { createGlobalAuthId } from '@/sales/domain/types/global-auth-id.type';

interface SellerOrderRow {
  id: string;
  order_number: string;
  status: string;
  version: number;
  total_amount_cents: number;
  currency: string;
  created_at: Date;
  customer_name: string;
  shipping_address: string;
}

export class PostgresSellerOrderReadRepository implements SellerOrderReadRepositoryPort {
  public constructor(private readonly sql: postgres.Sql<Record<string, unknown>>) {}

  public async findBySeller(
    userId: string,
    tenantId: string,
    requestedPage: number,
  ): Promise<SellerOrderPage> {
    const actor = createGlobalAuthId(userId);
    const tenant = createTenantId(tenantId);
    const page =
      Number.isSafeInteger(requestedPage) && requestedPage > 0 && requestedPage <= 100000
        ? requestedPage
        : 1;
    try {
      const rows = await this.sql<SellerOrderRow[]>`SELECT o.id,o.order_number,o.status,o.version,
        o.total_amount_cents,t.base_currency AS currency,o.created_at,c.name AS customer_name,
        concat_ws(', ',o.shipping_address_street,o.shipping_address_city,o.shipping_address_state,
          o.shipping_address_zip_code,o.shipping_address_country) AS shipping_address
        FROM sales.orders o JOIN core.tenants t ON t.id=o.tenant_id
        JOIN sales.customers c ON c.id=o.customer_id AND c.tenant_id=o.tenant_id
        JOIN core.tenant_memberships m ON m.tenant_id=o.tenant_id AND m.user_id=${actor}::uuid
          AND m.status='active' AND m.role IN ('OWNER','ADMIN')
        WHERE o.tenant_id=${tenant}::uuid AND o.status<>'draft'
        ORDER BY o.created_at DESC,o.id DESC LIMIT 26 OFFSET ${(page - 1) * 25}`;
      const visible = rows.slice(0, 25);
      if (visible.length === 0) return { items: [], page, hasNext: false };
      const ids = visible.map((row: SellerOrderRow): string => row.id);
      const items = await this.sql<
        { id: string; order_id: string; product_name: string; quantity: number }[]
      >`
        SELECT i.id,i.order_id,i.product_name,i.quantity FROM sales.order_items i
        JOIN sales.orders o ON o.id=i.order_id
        JOIN core.tenant_memberships m ON m.tenant_id=o.tenant_id AND m.user_id=${actor}::uuid
          AND m.status='active' AND m.role IN ('OWNER','ADMIN')
        WHERE o.tenant_id=${tenant}::uuid AND o.id IN ${this.sql(ids)} ORDER BY i.id`;
      return {
        page,
        hasNext: rows.length > 25,
        items: visible.map((row: SellerOrderRow): SellerOrderReadModel => ({
          id: row.id,
          orderNumber: row.order_number,
          status: row.status,
          nextStatus: nextLogisticsStatus(parseOrderStatus(row.status)),
          version: row.version,
          totalAmountCents: Number(row.total_amount_cents),
          currency: row.currency,
          createdAt: row.created_at.toISOString(),
          customerName: row.customer_name,
          shippingAddress: row.shipping_address,
          items: items
            .filter((item): boolean => item.order_id === row.id)
            .map((item): SellerOrderReadModel['items'][number] => ({
              id: item.id,
              productName: item.product_name,
              quantity: Number(item.quantity),
            })),
        })),
      };
    } catch (error: unknown) {
      throw new OrderRepositoryException('Seller order list failed.', error);
    }
  }
}
