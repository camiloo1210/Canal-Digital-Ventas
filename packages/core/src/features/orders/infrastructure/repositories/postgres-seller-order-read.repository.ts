import type postgres from 'postgres';
import type { SellerOrderReadRepositoryPort } from '@/orders/application/ports/out/seller-order-read-repository.port';
import type {
  SellerOrderPage,
  SellerOrderReadModel,
  SellerOrderFilters,
} from '@/orders/application/read-models/seller-order.read-model';
import { nextLogisticsStatus, parseOrderStatus } from '@/orders/domain/enums/order-status.enum';
import { OrderRepositoryException } from '@/orders/application/exceptions/order-repository.exception';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { createGlobalAuthId } from '@/sales/domain/types/global-auth-id.type';

interface SellerOrderProjection {
  total: number;
  items: Omit<SellerOrderReadModel, 'nextStatus'>[];
}

export class PostgresSellerOrderReadRepository implements SellerOrderReadRepositoryPort {
  public constructor(private readonly sql: postgres.Sql<Record<string, unknown>>) {}

  public async findBySeller(
    userId: string,
    tenantId: string,
    requestedPage: number,
    filters: SellerOrderFilters = {},
  ): Promise<SellerOrderPage> {
    const actor = createGlobalAuthId(userId);
    const tenant = createTenantId(tenantId);
    const page =
      Number.isSafeInteger(requestedPage) && requestedPage > 0 && requestedPage <= 100000
        ? requestedPage
        : 1;
    const query = filters.query ?? '';
    const pattern = '%' + query.replace(/[\\%_]/g, '\\$&') + '%';
    const status = filters.status ?? 'all';
    try {
      const rows = await this.sql<SellerOrderProjection[]>`
        WITH authorized AS (
          SELECT t.id,t.base_currency FROM core.tenants t JOIN core.tenant_memberships m ON m.tenant_id=t.id
          WHERE t.id=${tenant}::uuid AND m.user_id=${actor}::uuid AND m.status='active' AND m.role IN ('OWNER','ADMIN')
        ), filtered AS (
          SELECT o.id,o.order_number AS "orderNumber",o.status,o.version,o.total_amount_cents AS "totalAmountCents",
            t.base_currency AS currency,o.created_at AS "createdAt",c.name AS "customerName",
            concat_ws(', ',o.shipping_address_street,o.shipping_address_city,o.shipping_address_state,o.shipping_address_zip_code,o.shipping_address_country) AS "shippingAddress"
          FROM sales.orders o JOIN authorized t ON t.id=o.tenant_id
          JOIN sales.customers c ON c.id=o.customer_id AND c.tenant_id=o.tenant_id
          WHERE o.status<>'draft' AND (${status}='all' OR o.status=${status})
            AND (${query}='' OR o.order_number ILIKE ${pattern} OR c.name ILIKE ${pattern})
            AND (${filters.orderId ?? null}::uuid IS NULL OR o.id=${filters.orderId ?? null}::uuid)
        )
        SELECT (SELECT count(*)::int FROM filtered) AS total,
          coalesce((SELECT jsonb_agg(r ORDER BY r."createdAt" DESC,r.id DESC) FROM (
            SELECT f.*,coalesce((SELECT jsonb_agg(jsonb_build_object('id',i.id,'productName',i.product_name,'quantity',i.quantity) ORDER BY i.id)
              FROM sales.order_items i JOIN sales.orders own ON own.id=i.order_id
              WHERE i.order_id=f.id AND own.tenant_id=${tenant}::uuid),'[]'::jsonb) AS items
            FROM filtered f ORDER BY f."createdAt" DESC,f.id DESC LIMIT 25 OFFSET ${(page - 1) * 25}
          ) r),'[]'::jsonb) AS items
        FROM authorized`;
      const row = rows[0];
      if (!row)
        return { authorized: false, items: [], totalItems: 0, totalPages: 1, page, hasNext: false };
      const totalPages = Math.max(1, Math.ceil(row.total / 25));
      return {
        authorized: true,
        page,
        totalItems: row.total,
        totalPages,
        hasNext: page < totalPages,
        items: row.items.map((order): SellerOrderReadModel => ({
          ...order,
          nextStatus: nextLogisticsStatus(parseOrderStatus(order.status)),
          totalAmountCents: Number(order.totalAmountCents),
          createdAt: new Date(order.createdAt).toISOString(),
        })),
      };
    } catch (error: unknown) {
      throw new OrderRepositoryException('Seller order list failed.', error);
    }
  }
}
