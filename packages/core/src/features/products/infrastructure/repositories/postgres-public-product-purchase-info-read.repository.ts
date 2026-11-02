import type postgres from 'postgres';
import type { PublicProductPurchaseInfoReadRepositoryPort } from '@/products/application/ports/out/public-product-purchase-info-read-repository.port';
import type { PublicProductPurchaseInfoReadModel } from '@/products/application/read-models/public-product-purchase-info.model';
import { ProductRepositoryException } from '@/products/application/exceptions/product-repository.exception';

interface PurchaseInfoRow {
  gallery_urls: string[] | null;
  image_url: string | null;
  stock: number;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class PostgresPublicProductPurchaseInfoReadRepository implements PublicProductPurchaseInfoReadRepositoryPort {
  public constructor(private readonly sql: postgres.Sql<Record<string, unknown>>) {}

  public async findActive(params: {
    tenantSlug: string;
    productId: string;
  }): Promise<PublicProductPurchaseInfoReadModel | null> {
    if (!UUID_PATTERN.test(params.productId)) return null;
    try {
      const rows = await this.sql<PurchaseInfoRow[]>`
        SELECT p.gallery_urls, p.image_url, p.stock
        FROM catalog.products p
        JOIN core.tenants t ON t.id = p.tenant_id
        WHERE t.slug = ${params.tenantSlug}
          AND t.status = 'active'
          AND p.id = ${params.productId}
          AND p.status = 'active'
        LIMIT 1`;
      const row = rows[0];
      if (!row) return null;
      const gallery = row.gallery_urls ?? [];
      return {
        galleryUrls: gallery.length > 0 ? [...gallery] : row.image_url ? [row.image_url] : [],
        availableQuantity: Math.max(0, Math.trunc(row.stock)),
      };
    } catch (error: unknown) {
      throw new ProductRepositoryException(
        'Failed to read public product purchase information.',
        error,
      );
    }
  }
}
