import type postgres from 'postgres';
import type {
  KiviOrderLookupItem,
  KiviOrderLookupLine,
  KiviOrderLookupQuery,
  KiviOrderLookupReadPort,
} from '@/kivi/application/ports/out/kivi-order-lookup-read.port';
import { centsToDecimalString } from '@/kivi/application/kivi-product.mapper';
import {
  isUnguessableOrderNumber,
  normalizeOrderNumber,
} from '@/orders/domain/value-objects/order-number.vo';
import { KiviOrderLookupReadException } from '@/kivi/infrastructure/kivi-order-lookup-read.exception';

interface OrderRow {
  currency: string;
  id: string;
  order_number: string;
  status: string;
  updated_at: Date | string;
  created_at: Date | string;
  total_amount_cents: number;
}

interface LineRow {
  order_id: string;
  product_name: string;
  quantity: number;
  unit_price_cents: number;
  image_url: string | null;
}

const MAX_LINES_PER_ORDER = 20;
const MAX_IMAGE_URL_LENGTH = 2048;
// Same currency the catalog is sent to Kivi in.

/** Only a plain public https URL is shared; anything else is dropped rather than repaired. */
function publicImageUrl(value: string | null): string | null {
  if (value === null || value.length > MAX_IMAGE_URL_LENGTH) return null;
  if (!value.startsWith('https://') || /[\u0000- \u007f]/.test(value)) return null;
  return value;
}

function reference(value: string | null): string | null {
  if (value === null) return null;
  const normalized = normalizeOrderNumber(value);
  return normalized.length > 0 ? normalized : null;
}

function safeMinor(value: number | string | bigint): number {
  const amount = Number(value);
  if (!Number.isSafeInteger(amount))
    throw new KiviOrderLookupReadException('Unsafe minor-unit amount from database');
  return amount;
}

export class PostgresKiviOrderLookupReadRepository implements KiviOrderLookupReadPort {
  public constructor(private readonly sql: postgres.Sql<Record<string, unknown>>) {}

  public async findLatestOrders(query: KiviOrderLookupQuery): Promise<KiviOrderLookupItem[]> {
    try {
      const [connection] = await this.sql<{ tenant_id: string }[]>`
        SELECT k.tenant_id
        FROM core.kivi_connections k
        WHERE k.tenant_id = ${query.tenantId} AND k.status <> 'unlinked'
      `;
      if (!connection) return [];
      const orderNumber = reference(query.orderNumber);
      // Anonymous lookups (no verified phone) need an unguessable reference: the reference is the secret.
      if (
        query.phone === null &&
        (orderNumber === null || !isUnguessableOrderNumber(orderNumber))
      ) {
        return [];
      }
      const rows = await this.sql<OrderRow[]>`
        SELECT o.currency, o.id, o.order_number, o.status, o.updated_at, o.created_at, o.total_amount_cents
        FROM sales.orders o
        JOIN sales.customers c ON c.id = o.customer_id AND c.tenant_id = o.tenant_id
        WHERE o.tenant_id = ${connection.tenant_id}
          AND o.status <> 'draft'
          AND (${query.phone}::text IS NULL OR regexp_replace(c.phone, '[^0-9]', '', 'g') = ${query.phone}::text)
          AND (
            ${orderNumber}::text IS NULL
            OR lower(regexp_replace(o.order_number, '[#[:space:]-]', '', 'g')) = ${orderNumber}::text
          )
        ORDER BY o.updated_at DESC
        LIMIT 5
      `;
      if (rows.length === 0) return [];
      const lines = await this.sql<LineRow[]>`
        SELECT i.order_id, i.product_name, i.quantity, i.unit_price_cents,
               COALESCE(NULLIF(p.gallery_urls[1], ''), p.image_url) AS image_url
        FROM sales.order_items i
        LEFT JOIN catalog.products p ON p.id = i.product_id AND p.tenant_id = ${connection.tenant_id}
        WHERE i.order_id = ANY(${rows.map((row): string => row.id)}::uuid[])
        ORDER BY i.id
      `;
      return rows.map((row): KiviOrderLookupItem => ({
        orderNumber: row.order_number,
        status: row.status,
        updatedAt: new Date(row.updated_at).toISOString(),
        createdAt: new Date(row.created_at).toISOString(),
        currency: row.currency,
        total: centsToDecimalString(safeMinor(row.total_amount_cents), row.currency),
        items: lines
          .filter((line): boolean => line.order_id === row.id)
          .slice(0, MAX_LINES_PER_ORDER)
          .map((line): KiviOrderLookupLine => ({
            name: line.product_name,
            quantity: Number(line.quantity),
            unitPrice: centsToDecimalString(safeMinor(line.unit_price_cents), row.currency),
            imageUrl: publicImageUrl(line.image_url),
          })),
      }));
    } catch (error: unknown) {
      throw new KiviOrderLookupReadException(error);
    }
  }
}
