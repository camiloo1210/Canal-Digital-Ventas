import type postgres from 'postgres';
import type {
  KiviProductAvailability,
  KiviProductLookupItem,
  KiviProductLookupQuery,
  KiviProductLookupReadPort,
} from '@/kivi/application/ports/out/kivi-product-lookup-read.port';
import { centsToDecimalString } from '@/kivi/application/kivi-product.mapper';
import { KiviProductLookupReadException } from '@/kivi/infrastructure/kivi-product-lookup-read.exception';

const MAX_RESULTS = 5;
/** Same thresholds as the storefront (get_public_products_by_slug). */
const LOW_STOCK_CEILING = 20;

interface ProductRow {
  currency: string;
  name: string;
  sku: string;
  category: string;
  price_cents: number;
  wholesale_price_cents: number;
  wholesale_min_quantity: number;
  stock: number;
}

function escapeLike(value: string): string {
  // '!' is the LIKE escape character: a backslash is not reliable through the driver and
  // pooler (verified against Postgres: ESCAPE '\\' left '%' acting as a wildcard).
  return value.replace(/[!%_]/g, (char: string): string => `!${char}`);
}

function availabilityOf(stock: number): KiviProductAvailability {
  if (stock > LOW_STOCK_CEILING) return 'available';
  if (stock >= 1) return 'low_stock';
  return 'out_of_stock';
}

export class PostgresKiviProductLookupReadRepository implements KiviProductLookupReadPort {
  public constructor(private readonly sql: postgres.Sql<Record<string, unknown>>) {}

  public async findProducts(query: KiviProductLookupQuery): Promise<KiviProductLookupItem[]> {
    const term = query.query.trim();
    if (term.length === 0) return [];
    const escaped = escapeLike(term);
    const contains = `%${escaped}%`;
    const prefix = `${escaped}%`;
    try {
      const rows = await this.sql<ProductRow[]>`
        SELECT t.base_currency AS currency, p.name, p.sku, c.name AS category, p.price_cents,
               p.wholesale_price_cents, p.wholesale_min_quantity, p.stock
        FROM catalog.products p
        JOIN core.tenants t ON t.id = p.tenant_id
        JOIN catalog.categories c ON c.id = p.category_id AND c.tenant_id = p.tenant_id
        WHERE p.tenant_id = ${query.tenantId}
          AND p.status IN ('active', 'out_of_stock')
          AND (
            p.name ILIKE ${contains} ESCAPE '!'
            OR lower(p.sku) = lower(${term}::text)
            OR p.sku ILIKE ${prefix} ESCAPE '!'
          )
        ORDER BY (lower(p.sku) = lower(${term}::text)) DESC, p.name ASC
        LIMIT ${MAX_RESULTS}
      `;
      return rows.map((row): KiviProductLookupItem => {
        const hasWholesale = row.wholesale_price_cents > 0 && row.wholesale_min_quantity >= 1;
        return {
          name: row.name,
          sku: row.sku,
          category: row.category,
          price: centsToDecimalString(row.price_cents, row.currency),
          currency: row.currency,
          wholesale_price: hasWholesale
            ? centsToDecimalString(row.wholesale_price_cents, row.currency)
            : null,
          wholesale_min_quantity: hasWholesale ? row.wholesale_min_quantity : null,
          availability: availabilityOf(row.stock),
        };
      });
    } catch (error: unknown) {
      throw new KiviProductLookupReadException(error);
    }
  }
}
