import type postgres from 'postgres';
import type {
  ShipmentCreationSource,
  ShipmentCreationSourcePort,
} from '@/shipment-creation/application/ports/out/shipment-creation-source.port';
import type { ShipmentPackageItem } from '@/shipment-creation/domain/shipment-package';
import { InfrastructureException } from '@/shared/application/exceptions/infrastructure.exception';

export class ShipmentCreationSourceException extends InfrastructureException {
  public constructor(cause: unknown) {
    super('Shipment creation source read failed', cause);
    this.name = 'ShipmentCreationSourceException';
  }
}

interface OrderRow {
  status: string;
  name: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  has_recorded_shipment: boolean;
}

interface ItemRow {
  quantity: number;
  weight_grams: number | null;
  length_mm: number | null;
  width_mm: number | null;
  height_mm: number | null;
}

function item(row: ItemRow): ShipmentPackageItem {
  const complete =
    row.weight_grams !== null &&
    row.length_mm !== null &&
    row.width_mm !== null &&
    row.height_mm !== null;
  return {
    quantity: Number(row.quantity),
    packageData: complete
      ? {
          weightGrams: Number(row.weight_grams),
          lengthMm: Number(row.length_mm),
          widthMm: Number(row.width_mm),
          heightMm: Number(row.height_mm),
        }
      : null,
  };
}

export class PostgresShipmentCreationSource implements ShipmentCreationSourcePort {
  public constructor(private readonly sql: postgres.Sql<Record<string, unknown>>) {}

  public async load(tenantId: string, orderId: string): Promise<ShipmentCreationSource | null> {
    try {
      const orders = await this.sql<OrderRow[]>`
        SELECT o.status, c.name, c.phone, o.shipping_address_street AS street,
          o.shipping_address_city AS city, o.shipping_address_state AS state,
          o.shipping_address_zip_code AS zip_code, o.shipping_address_country AS country,
          EXISTS (SELECT 1 FROM sales.manual_shipments m
            WHERE m.order_id = o.id AND m.tenant_id = o.tenant_id AND m.tracking_number IS NOT NULL)
            AS has_recorded_shipment
        FROM sales.orders o
        JOIN sales.customers c ON c.id = o.customer_id AND c.tenant_id = o.tenant_id
        WHERE o.id = ${orderId}::uuid AND o.tenant_id = ${tenantId}::uuid`;
      const order = orders[0];
      if (!order) return null;
      // LEFT JOIN: a product that is missing or belongs to another tenant has no package data.
      const items = await this.sql<ItemRow[]>`
        SELECT oi.quantity, p.weight_grams, p.length_mm, p.width_mm, p.height_mm
        FROM sales.order_items oi
        LEFT JOIN catalog.products p ON p.id = oi.product_id AND p.tenant_id = ${tenantId}::uuid
        WHERE oi.order_id = ${orderId}::uuid
        ORDER BY oi.id`;
      return {
        orderStatus: order.status,
        hasRecordedShipment: order.has_recorded_shipment === true,
        recipient: {
          name: order.name,
          phone: order.phone,
          street: order.street,
          city: order.city,
          state: order.state,
          zipCode: order.zip_code,
          country: order.country,
        },
        items: items.map(item),
      };
    } catch (error: unknown) {
      throw new ShipmentCreationSourceException(error);
    }
  }
}
