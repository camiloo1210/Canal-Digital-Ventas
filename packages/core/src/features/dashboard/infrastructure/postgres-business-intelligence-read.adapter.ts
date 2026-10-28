import type postgres from 'postgres';
import type { BusinessIntelligenceReadPort } from '@/dashboard/application/ports/out/business-intelligence-read.port';
import { BusinessIntelligenceReadException } from '@/dashboard/application/exceptions/business-intelligence-read.exception';
import {
  analyzeBusinessIntelligence,
  type BusinessIntelligenceReport,
  type IntelligenceQuery,
  type IntelligenceSnapshot,
} from '@/dashboard/domain/business-intelligence';

interface SnapshotRow {
  observed_at: Date;
  currency: string;
  products: IntelligenceSnapshot['products'];
  orders: IntelligenceSnapshot['orders'];
}

export class PostgresBusinessIntelligenceReadAdapter implements BusinessIntelligenceReadPort {
  constructor(private readonly sql: postgres.Sql<Record<string, unknown>>) {}

  async findForManager(
    userId: string,
    tenantId: string,
    query: IntelligenceQuery,
  ): Promise<BusinessIntelligenceReport | null> {
    try {
      // Authorization and every projection share one statement/snapshot. No report is cached across actors.
      const rows = await this.sql<SnapshotRow[]>`
        WITH authorized AS (
          SELECT t.id,t.base_currency FROM core.tenants t
          WHERE EXISTS (SELECT 1 FROM core.tenant_memberships m WHERE m.tenant_id=t.id
            AND m.user_id=${userId}::uuid AND m.status='active' AND m.role IN ('OWNER','ADMIN'))
          AND t.id=${tenantId}::uuid
        ), bounds AS (
          SELECT date_trunc('day',current_timestamp AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' AS ends,
            ${query.days}::int AS days
        )
        SELECT current_timestamp AS observed_at,a.base_currency AS currency,
          coalesce((SELECT jsonb_agg(jsonb_build_object(
            'id',p.id,'name',p.name,'sku',p.sku,'category',c.name,'stock',p.stock,
            'costCents',p.cost_cents,'priceCents',p.price_cents,'status',p.status,'hasVariants',p.has_variants
          ) ORDER BY p.name,p.id) FROM catalog.products p
            JOIN catalog.categories c ON c.id=p.category_id AND c.tenant_id=p.tenant_id
            WHERE p.tenant_id=a.id),'[]'::jsonb) AS products,
          coalesce((SELECT jsonb_agg(jsonb_build_object(
            'id',o.id,'createdAt',o.created_at,'discountCents',o.discount_amount_cents,
            'items',(SELECT coalesce(jsonb_agg(jsonb_build_object(
              'productId',i.product_id,'quantity',i.quantity,'subtotalCents',i.subtotal_cents
            ) ORDER BY i.id),'[]'::jsonb) FROM sales.order_items i WHERE i.order_id=o.id)
          ) ORDER BY o.created_at,o.id) FROM sales.orders o CROSS JOIN bounds b
            WHERE o.tenant_id=a.id AND o.status IN ('paid','processing','shipped','delivered')
              AND o.created_at>=b.ends - (b.days * 2) * interval '1 day' AND o.created_at<b.ends
          ),'[]'::jsonb) AS orders
        FROM authorized a`;
      const row = rows[0];
      return row
        ? analyzeBusinessIntelligence(
            {
              observedAt: row.observed_at.toISOString(),
              currency: row.currency,
              products: row.products,
              orders: row.orders,
            },
            query,
          )
        : null;
    } catch (error: unknown) {
      throw new BusinessIntelligenceReadException(error);
    }
  }
}
