import type postgres from 'postgres';
import type {
  BuyerCartCatalogProduct,
  BuyerCartCatalogReadPort,
} from '@/carts/application/ports/out/buyer-cart-catalog-read.port';
import { BuyerCartRepositoryException } from '@/carts/application/exceptions/buyer-cart-repository.exception';

interface ProductRow {
  id: string;
  name: string;
  sku: string;
  price_cents: number;
  currency: string;
  wholesale_price_cents: number | null;
  wholesale_min_quantity: number | null;
  stock: number;
  image_url: string | null;
  gallery_urls: string[] | null;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class PostgresBuyerCartCatalogReadRepository implements BuyerCartCatalogReadPort {
  constructor(private readonly sql: postgres.Sql<Record<string, unknown>>) {}

  public async findActiveTenantIdBySlug(tenantSlug: string): Promise<string | null> {
    try {
      const rows = await this.sql<{ id: string }[]>`
        SELECT t.id FROM core.tenants t
        WHERE t.slug = ${tenantSlug} AND t.status = 'active'
        LIMIT 1`;
      return rows[0]?.id ?? null;
    } catch (error: unknown) {
      throw new BuyerCartRepositoryException('Failed to resolve the store.', error);
    }
  }

  public async findProducts(
    tenantId: string,
    productIds: string[],
    userId: string,
  ): Promise<BuyerCartCatalogProduct[]> {
    const ids = productIds.filter((id: string): boolean => UUID_PATTERN.test(id));
    if (ids.length === 0) return [];
    try {
      // Same visibility as the storefront: active product, active store, active (or no) category.
      const rows = await this.sql<ProductRow[]>`
        SELECT p.id, p.name, p.sku, p.price_cents, t.base_currency AS currency, CASE WHEN EXISTS (SELECT 1 FROM core.users u WHERE u.id = ${userId}::uuid AND u.wholesale_enabled) OR EXISTS (SELECT 1 FROM core.tenant_memberships m WHERE m.user_id = ${userId}::uuid AND m.tenant_id = p.tenant_id AND m.status = 'active') THEN p.wholesale_price_cents ELSE NULL END AS wholesale_price_cents,
          CASE WHEN EXISTS (SELECT 1 FROM core.users u WHERE u.id = ${userId}::uuid AND u.wholesale_enabled) OR EXISTS (SELECT 1 FROM core.tenant_memberships m WHERE m.user_id = ${userId}::uuid AND m.tenant_id = p.tenant_id AND m.status = 'active') THEN p.wholesale_min_quantity ELSE NULL END AS wholesale_min_quantity, p.stock, p.image_url, p.gallery_urls
        FROM catalog.products p
        JOIN core.tenants t ON t.id = p.tenant_id AND t.status = 'active'
        LEFT JOIN catalog.categories c ON c.id = p.category_id AND c.tenant_id = p.tenant_id
        WHERE p.tenant_id = ${tenantId}
          AND p.status = 'active'
          AND (p.category_id IS NULL OR c.status = 'active')
          AND p.id = ANY(${ids}::uuid[])`;
      return rows.map((row: ProductRow): BuyerCartCatalogProduct => ({
        productId: row.id,
        name: row.name,
        sku: row.sku,
        unitPriceCents: Number(row.price_cents),
        currency: row.currency,
        wholesalePriceCents:
          row.wholesale_price_cents === null ? null : Number(row.wholesale_price_cents),
        wholesaleMinQuantity:
          row.wholesale_min_quantity === null ? null : Number(row.wholesale_min_quantity),
        availableQuantity: Math.max(0, Math.trunc(Number(row.stock))),
        imageUrl: row.gallery_urls?.[0] ?? row.image_url ?? null,
      }));
    } catch (error: unknown) {
      throw new BuyerCartRepositoryException('Failed to read the catalog for the cart.', error);
    }
  }
}
