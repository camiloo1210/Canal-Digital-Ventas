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
  canManage: boolean;
  items: Omit<SellerOrderReadModel, 'nextStatus'>[];
}

interface ShipmentJobRow {
  order_id: string;
  state: 'queued' | 'creating' | 'done' | 'needs_attention' | 'failed';
  reason: string | null;
  label_path: string | null;
  provider_tracking_number: string | null;
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
          SELECT t.id,t.base_currency,core.member_has_permission(m.user_id,m.tenant_id,ARRAY['MANAGE_ORDERS']::text[]) AS can_manage FROM core.tenants t JOIN core.tenant_memberships m ON m.tenant_id=t.id
          WHERE t.id=${tenant}::uuid AND m.user_id=${actor}::uuid AND m.status='active' AND core.member_has_permission(m.user_id, m.tenant_id, ARRAY['VIEW_ORDERS','MANAGE_ORDERS']::text[])
        ), filtered AS (
          SELECT o.id,o.order_number AS "orderNumber",o.status,o.version,o.total_amount_cents AS "totalAmountCents",
            o.currency AS currency,o.created_at AS "createdAt",c.name AS "customerName",
            concat_ws(', ',o.shipping_address_street,o.shipping_address_city,o.shipping_address_state,o.shipping_address_zip_code,o.shipping_address_country) AS "shippingAddress"
          FROM sales.orders o JOIN authorized t ON t.id=o.tenant_id
          JOIN sales.customers c ON c.id=o.customer_id AND c.tenant_id=o.tenant_id
          WHERE o.status<>'draft' AND (${status}='all' OR o.status=${status})
            AND (${query}='' OR o.order_number ILIKE ${pattern} OR c.name ILIKE ${pattern})
            AND (${filters.orderId ?? null}::uuid IS NULL OR o.id=${filters.orderId ?? null}::uuid)
        )
        SELECT (SELECT count(*)::int FROM filtered) AS total, (SELECT can_manage FROM authorized LIMIT 1) AS "canManage",
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
      let shipmentAvailable = true;
      const shipments = new Map<
        string,
        { carrier: string | null; trackingNumber: string | null; version: number }
      >();
      if (row.items.length > 0) {
        try {
          const orderIds = row.items.map((item): string => item.id);
          const values = await this
            .sql`SELECT ms.order_id, ms.carrier, ms.tracking_number, ms.version FROM sales.manual_shipments ms
            JOIN core.tenant_memberships m ON m.tenant_id = ms.tenant_id
            WHERE ms.tenant_id = ${tenant}::uuid AND m.user_id = ${actor}::uuid AND m.status = 'active'
              AND core.member_has_permission(m.user_id, m.tenant_id, ARRAY['VIEW_ORDERS','MANAGE_ORDERS']::text[])
              AND ms.order_id = ANY(${orderIds}::uuid[])`;
          for (const item of values)
            shipments.set(item.order_id as string, {
              carrier: item.carrier as string | null,
              trackingNumber: item.tracking_number as string | null,
              version: Number(item.version),
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
      }
      const jobs = new Map<string, NonNullable<SellerOrderReadModel['shipmentJob']>>();
      if (row.items.length > 0) {
        try {
          const orderIds = row.items.map((item): string => item.id);
          const values = await this.sql<ShipmentJobRow[]>`
            SELECT j.order_id, j.state, j.reason, j.label_path, j.provider_tracking_number
            FROM sales.shipment_creation_jobs j
            JOIN core.tenant_memberships m ON m.tenant_id = j.tenant_id
            WHERE j.tenant_id = ${tenant}::uuid AND m.user_id = ${actor}::uuid AND m.status = 'active'
              AND core.member_has_permission(m.user_id, m.tenant_id, ARRAY['VIEW_ORDERS','MANAGE_ORDERS']::text[])
              AND j.order_id = ANY(${orderIds}::uuid[])`;
          for (const job of values)
            jobs.set(job.order_id, {
              state: job.state,
              reason: job.reason,
              hasLabel: job.label_path !== null,
              providerTrackingNumber: job.provider_tracking_number,
            });
        } catch (error: unknown) {
          if (
            typeof error !== 'object' ||
            error === null ||
            !('code' in error) ||
            !['42501', '42P01'].includes(String(error.code))
          )
            throw error;
        }
      }
      const totalPages = Math.max(1, Math.ceil(row.total / 25));
      return {
        authorized: true,
        page,
        totalItems: row.total,
        totalPages,
        hasNext: page < totalPages,
        items: row.items.map((order): SellerOrderReadModel => ({
          ...order,
          nextStatus:
            row.canManage === true ? nextLogisticsStatus(parseOrderStatus(order.status)) : null,
          shipment: shipments.get(order.id) ?? null,
          shipmentJob: jobs.get(order.id) ?? null,
          shipmentAvailability: shipmentAvailable ? 'available' : 'unavailable',
          canManageShipment:
            shipmentAvailable &&
            row.canManage === true &&
            ['paid', 'processing', 'shipped', 'delivered'].includes(order.status),
          totalAmountCents: Number(order.totalAmountCents),
          createdAt: new Date(order.createdAt).toISOString(),
        })),
      };
    } catch (error: unknown) {
      throw new OrderRepositoryException('Seller order list failed.', error);
    }
  }
}
