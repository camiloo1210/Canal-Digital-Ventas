import type {
  NotificationOrderDetails,
  NotificationOrderItem,
} from '@/notifications/application/ports/out/notification-order-details';
import { MessagingException } from '@/shared/application/exceptions/messaging.exception';

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new MessagingException('Invalid notification order projection');
  return value as Record<string, unknown>;
}
function string(value: unknown): string {
  if (typeof value !== 'string') throw new MessagingException('Invalid notification string');
  return value;
}
function nullableString(value: unknown): string | null {
  return value === null ? null : string(value);
}
function integer(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
    throw new MessagingException('Invalid notification amount');
  return value;
}
export function parseNotificationOrder(value: unknown): NotificationOrderDetails {
  const row = record(value);
  if (!Array.isArray(row.items)) throw new MessagingException('Invalid notification items');
  const createdAt = string(row.createdAt);
  const currency = string(row.currency);
  if (!Number.isFinite(Date.parse(createdAt)) || !/^[A-Z]{3}$/.test(currency))
    throw new MessagingException('Invalid notification date or currency');
  return {
    orderId: string(row.orderId),
    tenantSlug: string(row.tenantSlug),
    logoUrl: nullableString(row.logoUrl),
    contactEmail: nullableString(row.contactEmail),
    customerName: string(row.customerName),
    createdAt,
    currency,
    subtotalCents: integer(row.subtotalCents),
    taxAmountCents: integer(row.taxAmountCents),
    discountAmountCents: integer(row.discountAmountCents),
    shippingCostCents: integer(row.shippingCostCents),
    totalAmountCents: integer(row.totalAmountCents),
    shippingAddress: string(row.shippingAddress),
    items: row.items.map((value: unknown): NotificationOrderItem => {
      const item = record(value);
      const quantity = integer(item.quantity);
      if (quantity === 0) throw new MessagingException('Invalid notification quantity');
      return {
        name: string(item.name),
        sku: string(item.sku),
        quantity,
        unitPriceCents: integer(item.unitPriceCents),
        subtotalCents: integer(item.subtotalCents),
        imageUrl: nullableString(item.imageUrl),
      };
    }),
  };
}
