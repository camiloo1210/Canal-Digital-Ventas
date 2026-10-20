import type postgres from 'postgres';
import type {
  AdminCatalogReadPort,
  AdminCatalogQuery,
  AdminCatalogPage,
  AdminProductCatalogItem,
  AdminCategoryCatalogItem,
  ProductFormContextReadModel,
} from '@/dashboard/application/ports/out/admin-catalog-read.port';
import { AdminCatalogReadException } from '@/dashboard/application/exceptions/admin-catalog-read.exception';

interface CatalogRow<T> {
  total: number;
  items: T[];
}

function pattern(q: string): string {
  return '%' + q.replace(/[\\%_]/g, '\\$&') + '%';
}

function toPage<T>(
  row: CatalogRow<T> | undefined,
  query: AdminCatalogQuery,
): AdminCatalogPage<T> | null {
  if (!row) return null;
  return {
    items: row.items,
    totalItems: row.total,
    totalPages: Math.max(1, Math.ceil(row.total / query.limit)),
    currentPage: query.page,
  };
}

export class PostgresAdminCatalogReadAdapter implements AdminCatalogReadPort {
  constructor(private readonly sql: postgres.Sql<Record<string, unknown>>) {}

  async findProductFormContextForManager(
    userId: string,
    tenantId: string,
    currentCategoryId?: string,
  ): Promise<ProductFormContextReadModel | null> {
    try {
      const rows = await this.sql<ProductFormContextReadModel[]>`
        SELECT t.base_currency AS currency,
          coalesce((SELECT jsonb_agg(c ORDER BY c.name,c.id) FROM (
            SELECT id,name,status FROM catalog.categories
            WHERE tenant_id=t.id AND (status='active' OR id=${currentCategoryId ?? null}::uuid)
          ) c),'[]'::jsonb) AS categories
        FROM core.tenants t JOIN core.tenant_memberships m ON m.tenant_id=t.id
        WHERE t.id=${tenantId}::uuid AND m.user_id=${userId}::uuid
          AND m.status='active' AND m.role IN ('OWNER','ADMIN')`;
      return rows[0] ?? null;
    } catch (error: unknown) {
      throw new AdminCatalogReadException(error);
    }
  }

  async findProductsForManager(
    userId: string,
    tenantId: string,
    query: AdminCatalogQuery,
  ): Promise<AdminCatalogPage<AdminProductCatalogItem> | null> {
    try {
      const rows = await this.sql<CatalogRow<AdminProductCatalogItem>[]>`
        WITH authorized AS (
          SELECT t.id,t.base_currency FROM core.tenants t
          JOIN core.tenant_memberships m ON m.tenant_id=t.id
          WHERE t.id=${tenantId}::uuid AND m.user_id=${userId}::uuid
            AND m.status='active' AND m.role IN ('OWNER','ADMIN')
        ), filtered AS (
          SELECT p.id,p.name,p.sku,c.name AS "categoryName",p.price_cents AS "priceCents",
            t.base_currency AS currency,p.stock,p.status,p.image_url AS "imageUrl",p.created_at
          FROM catalog.products p JOIN authorized t ON t.id=p.tenant_id
          JOIN catalog.categories c ON c.id=p.category_id AND c.tenant_id=p.tenant_id
          WHERE (${query.status}='all' OR p.status=${query.status})
            AND (${query.q}='' OR p.name ILIKE ${pattern(query.q)} OR p.sku ILIKE ${pattern(query.q)})
        )
        SELECT (SELECT count(*)::int FROM filtered) AS total,
          coalesce((SELECT jsonb_agg(r ORDER BY r.created_at DESC,r.id DESC) FROM (
            SELECT * FROM filtered ORDER BY created_at DESC,id DESC
            LIMIT ${query.limit} OFFSET ${(query.page - 1) * query.limit}
          ) r),'[]'::jsonb) AS items
        FROM authorized`;
      return toPage(rows[0], query);
    } catch (error: unknown) {
      throw new AdminCatalogReadException(error);
    }
  }

  async findCategoriesForManager(
    userId: string,
    tenantId: string,
    query: AdminCatalogQuery,
  ): Promise<AdminCatalogPage<AdminCategoryCatalogItem> | null> {
    try {
      const rows = await this.sql<CatalogRow<AdminCategoryCatalogItem>[]>`
        WITH authorized AS (
          SELECT t.id FROM core.tenants t JOIN core.tenant_memberships m ON m.tenant_id=t.id
          WHERE t.id=${tenantId}::uuid AND m.user_id=${userId}::uuid
            AND m.status='active' AND m.role IN ('OWNER','ADMIN')
        ), filtered AS (
          SELECT c.id,c.name,c.description,c.status,c.created_at,c.tenant_id
          FROM catalog.categories c JOIN authorized t ON t.id=c.tenant_id
          WHERE (${query.status}='all' OR c.status=${query.status})
            AND (${query.q}='' OR c.name ILIKE ${pattern(query.q)})
        )
        SELECT (SELECT count(*)::int FROM filtered) AS total,
          coalesce((SELECT jsonb_agg(r ORDER BY r.created_at DESC,r.id DESC) FROM (
            SELECT c.id,c.name,c.description,c.status,c.created_at,
              (SELECT count(*)::int FROM catalog.products p WHERE p.tenant_id=c.tenant_id AND p.category_id=c.id) AS "productCount"
            FROM filtered c ORDER BY c.created_at DESC,c.id DESC
            LIMIT ${query.limit} OFFSET ${(query.page - 1) * query.limit}
          ) r),'[]'::jsonb) AS items
        FROM authorized`;
      return toPage(rows[0], query);
    } catch (error: unknown) {
      throw new AdminCatalogReadException(error);
    }
  }
}
