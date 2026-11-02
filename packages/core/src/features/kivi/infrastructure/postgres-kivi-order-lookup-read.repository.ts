import type postgres from 'postgres';
import type {
  KiviOrderLookupItem,
  KiviOrderLookupQuery,
  KiviOrderLookupReadPort,
} from '@/kivi/application/ports/out/kivi-order-lookup-read.port';
import { KiviOrderLookupReadException } from '@/kivi/infrastructure/kivi-order-lookup-read.exception';

interface OrderRow {
  order_number: string;
  status: string;
  updated_at: Date | string;
}

function normalizeOrderNumber(value: string | null): string | null {
  if (value === null) return null;
  const normalized = value.replace(/[#\s]/g, '').toLowerCase();
  return normalized.length > 0 ? normalized : null;
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
      const orderNumber = normalizeOrderNumber(query.orderNumber);
      const rows = await this.sql<OrderRow[]>`
        SELECT o.order_number, o.status, o.updated_at
        FROM sales.orders o
        JOIN sales.customers c ON c.id = o.customer_id AND c.tenant_id = o.tenant_id
        WHERE o.tenant_id = ${connection.tenant_id}
          AND o.status <> 'draft'
          AND regexp_replace(c.phone, '[^0-9]', '', 'g') = ${query.phone}
          AND (
            ${orderNumber}::text IS NULL
            OR lower(regexp_replace(o.order_number, '[#[:space:]]', '', 'g')) = ${orderNumber}::text
          )
        ORDER BY o.updated_at DESC
        LIMIT 5
      `;
      return rows.map((row): KiviOrderLookupItem => ({
        orderNumber: row.order_number,
        status: row.status,
        updatedAt: new Date(row.updated_at).toISOString(),
      }));
    } catch (error: unknown) {
      throw new KiviOrderLookupReadException(error);
    }
  }
}
