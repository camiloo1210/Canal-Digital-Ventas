import type postgres from 'postgres';
import type {
  DashboardOverviewReadModel,
  DashboardOverviewReadPort,
} from '@/dashboard/application/ports/out/dashboard-overview-read.port';
import { DashboardOverviewReadException } from '@/dashboard/application/exceptions/dashboard-overview-read.exception';

interface OverviewRow {
  name: string;
  slug: string;
  currency: string;
  observed_at: Date;
  awaiting_preparation: number;
  processing: number;
  shipped: number;
  pending_payment: number;
  active_products: number;
  active_categories: number;
  out_of_stock: number;
  without_image: number;
  recent_orders: {
    id: string;
    order_number: string;
    status: string;
    created_at: string;
    customer_name: string;
    total_amount_cents: number;
  }[];
}

export class PostgresDashboardOverviewReadAdapter implements DashboardOverviewReadPort {
  constructor(private readonly sql: postgres.Sql<Record<string, unknown>>) {}

  async findForManager(
    userId: string,
    tenantId: string,
  ): Promise<DashboardOverviewReadModel | null> {
    try {
      // One statement gives counts and the recent list the same database snapshot.
      const rows = await this.sql<OverviewRow[]>`
        SELECT t.name,t.slug,t.base_currency AS currency,current_timestamp AS observed_at,
          o.awaiting_preparation,o.processing,o.shipped,o.pending_payment,
          p.active_products,p.out_of_stock,p.without_image,
          (SELECT count(*)::int FROM catalog.categories c WHERE c.tenant_id=t.id AND c.status='active') AS active_categories,
          coalesce((SELECT jsonb_agg(r ORDER BY r.created_at DESC,r.id DESC) FROM (
            SELECT ord.id,ord.order_number,ord.status,ord.created_at,ord.total_amount_cents,
              c.name AS customer_name
            FROM sales.orders ord JOIN sales.customers c ON c.id=ord.customer_id AND c.tenant_id=ord.tenant_id
            WHERE ord.tenant_id=t.id AND ord.status<>'draft'
            ORDER BY ord.created_at DESC,ord.id DESC LIMIT 5
          ) r),'[]'::jsonb) AS recent_orders
        FROM core.tenants t JOIN core.tenant_memberships m ON m.tenant_id=t.id
          AND m.user_id=${userId}::uuid AND m.status='active' AND m.role IN ('OWNER','ADMIN')
        CROSS JOIN LATERAL (
          SELECT count(*) FILTER (WHERE status='paid')::int AS awaiting_preparation,
            count(*) FILTER (WHERE status='processing')::int AS processing,
            count(*) FILTER (WHERE status='shipped')::int AS shipped,
            count(*) FILTER (WHERE status='pending_payment')::int AS pending_payment
          FROM sales.orders WHERE tenant_id=t.id
        ) o
        CROSS JOIN LATERAL (
          SELECT count(*) FILTER (WHERE status='active')::int AS active_products,
            count(*) FILTER (WHERE status IN ('active','out_of_stock') AND stock=0)::int AS out_of_stock,
            count(*) FILTER (WHERE status='active' AND image_url IS NULL)::int AS without_image
          FROM catalog.products WHERE tenant_id=t.id
        ) p
        WHERE t.id=${tenantId}::uuid`;
      const row = rows[0];
      if (!row) return null;
      return {
        tenantName: row.name,
        tenantSlug: row.slug,
        observedAt: row.observed_at.toISOString(),
        awaitingPreparation: row.awaiting_preparation,
        processing: row.processing,
        shipped: row.shipped,
        pendingPayment: row.pending_payment,
        activeProducts: row.active_products,
        activeCategories: row.active_categories,
        outOfStock: row.out_of_stock,
        withoutImage: row.without_image,
        recentOrders: row.recent_orders.map(
          (order): DashboardOverviewReadModel['recentOrders'][number] => ({
            id: order.id,
            orderNumber: order.order_number,
            status: order.status,
            createdAt: new Date(order.created_at).toISOString(),
            customerName: order.customer_name,
            totalAmountCents: Number(order.total_amount_cents),
            currency: row.currency,
          }),
        ),
      };
    } catch (error: unknown) {
      throw new DashboardOverviewReadException(error);
    }
  }
}
