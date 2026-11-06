import type postgres from 'postgres';
import type {
  DashboardOverviewPeriod,
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
  period_ends: Date;
  period_revenue: string;
  previous_revenue: string;
  period_orders: number;
  lifetime_revenue: string;
  lifetime_orders: number;
  foreign_currency_orders: number;
  buying_customers: number;
  total_customers: number;
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
    currency: string;
  }[];
}

function safeInteger(value: string | bigint | number): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result)) throw new Error('Overview value exceeds safe integer range');
  return result;
}

export class PostgresDashboardOverviewReadAdapter implements DashboardOverviewReadPort {
  constructor(private readonly sql: postgres.Sql<Record<string, unknown>>) {}

  async findForManager(
    userId: string,
    tenantId: string,
    period: DashboardOverviewPeriod,
  ): Promise<DashboardOverviewReadModel | null> {
    if (!Number.isInteger(period.days) || period.days < 1 || period.days > 366)
      throw new DashboardOverviewReadException(new Error('Invalid overview period'));
    try {
      const endDate = period.endDate ?? null;
      // One statement gives counts and the recent list the same database snapshot.
      const rows = await this.sql<OverviewRow[]>`
        SELECT t.name,t.slug,t.base_currency AS currency,current_timestamp AS observed_at,
          k.period_ends,k.period_revenue,k.previous_revenue,k.period_orders,k.lifetime_revenue,
          k.lifetime_orders,k.buying_customers,k.foreign_currency_orders,
          (SELECT count(*)::int FROM sales.customers cu WHERE cu.tenant_id=t.id) AS total_customers,
          o.awaiting_preparation,o.processing,o.shipped,o.pending_payment,
          p.active_products,p.out_of_stock,p.without_image,
          (SELECT count(*)::int FROM catalog.categories c WHERE c.tenant_id=t.id AND c.status='active') AS active_categories,
          coalesce((SELECT jsonb_agg(r ORDER BY r.created_at DESC,r.id DESC) FROM (
            SELECT ord.id,ord.order_number,ord.status,ord.created_at,ord.total_amount_cents,ord.currency,
              c.name AS customer_name
            FROM sales.orders ord JOIN sales.customers c ON c.id=ord.customer_id AND c.tenant_id=ord.tenant_id
            WHERE ord.tenant_id=t.id AND ord.status<>'draft'
            ORDER BY ord.created_at DESC,ord.id DESC LIMIT 5
          ) r),'[]'::jsonb) AS recent_orders
        FROM core.tenants t JOIN core.tenant_memberships m ON m.tenant_id=t.id
          AND m.user_id=${userId}::uuid AND m.status='active' AND core.member_has_permission(m.user_id, m.tenant_id, ARRAY['VIEW_OVERVIEW']::text[])
        CROSS JOIN LATERAL (
          SELECT CASE WHEN ${endDate}::date IS NULL
            THEN date_trunc('day',current_timestamp AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
            ELSE ((${endDate}::date + 1)::timestamp AT TIME ZONE 'UTC') END AS ends
        ) b
        CROSS JOIN LATERAL (
          -- Net merchandise per order: items minus discount capped at items (same policy as business intelligence).
          SELECT b.ends AS period_ends,
            coalesce(sum(n.net) FILTER (WHERE n.currency=t.base_currency AND n.created_at>=b.ends-${period.days}::int*interval '1 day' AND n.created_at<b.ends),0)::text AS period_revenue,
            coalesce(sum(n.net) FILTER (WHERE n.currency=t.base_currency AND n.created_at>=b.ends-${period.days}::int*2*interval '1 day' AND n.created_at<b.ends-${period.days}::int*interval '1 day'),0)::text AS previous_revenue,
            (count(*) FILTER (WHERE n.created_at>=b.ends-${period.days}::int*interval '1 day' AND n.created_at<b.ends))::int AS period_orders,
            coalesce(sum(n.net) FILTER (WHERE n.currency=t.base_currency),0)::text AS lifetime_revenue,
            (count(*) FILTER (WHERE n.currency<>t.base_currency))::int AS foreign_currency_orders,
            count(n.customer_id)::int AS lifetime_orders,
            (count(DISTINCT n.customer_id) FILTER (WHERE n.created_at>=b.ends-${period.days}::int*interval '1 day' AND n.created_at<b.ends))::int AS buying_customers
          FROM (
            SELECT ord.customer_id,ord.created_at,ord.currency,g.gross-least(ord.discount_amount_cents::bigint,g.gross) AS net
            FROM sales.orders ord CROSS JOIN LATERAL (
              SELECT coalesce(sum(i.subtotal_cents),0)::bigint AS gross FROM sales.order_items i WHERE i.order_id=ord.id
            ) g
            WHERE ord.tenant_id=t.id AND ord.status IN ('paid','processing','shipped','delivered')
          ) n
        ) k
        CROSS JOIN LATERAL (
          SELECT count(*) FILTER (WHERE status='paid')::int AS awaiting_preparation,
            count(*) FILTER (WHERE status='processing')::int AS processing,
            count(*) FILTER (WHERE status='shipped')::int AS shipped,
            count(*) FILTER (WHERE status IN ('confirmed','pending_payment'))::int AS pending_payment
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
      const day = 86400000;
      const ends = row.period_ends.getTime();
      const revenue = BigInt(row.period_revenue);
      const previous = BigInt(row.previous_revenue);
      return {
        kpis: {
          currency: row.currency,
          periodStart: new Date(ends - period.days * day).toISOString().slice(0, 10),
          periodEnd: new Date(ends - day).toISOString().slice(0, 10),
          revenueCents: safeInteger(revenue),
          previousRevenueCents: safeInteger(previous),
          revenueChangeBps:
            previous === BigInt(0)
              ? null
              : safeInteger(((revenue - previous) * BigInt(10000)) / previous),
          excludedCurrencyOrders: row.foreign_currency_orders ?? 0,
          orderCount: row.period_orders,
          lifetimeRevenueCents: safeInteger(row.lifetime_revenue),
          lifetimeOrderCount: row.lifetime_orders,
          totalCustomers: row.total_customers,
          buyingCustomers: row.buying_customers,
        },
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
            totalAmountCents: safeInteger(order.total_amount_cents),
            currency: order.currency,
          }),
        ),
      };
    } catch (error: unknown) {
      throw new DashboardOverviewReadException(error);
    }
  }
}
