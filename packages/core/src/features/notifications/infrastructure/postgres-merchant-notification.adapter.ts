import type postgres from 'postgres';
import type { DeliveryClaim } from '@/notifications/application/ports/out/notification.ports';
import type {
  MerchantDeliveryKey,
  MerchantNotificationDeliveryPort,
  MerchantNotificationReadPort,
  MerchantOrderRecipient,
  MerchantStockItem,
} from '@/notifications/application/ports/out/merchant-notification.ports';
import { MessagingException } from '@/shared/application/exceptions/messaging.exception';
import { NotificationPermanentException } from '@/notifications/application/exceptions/notification-permanent.exception';

interface MerchantRow {
  user_id: string;
  email: string;
  order_number: string;
  tenant_name: string;
  stock_items: unknown;
}

export class PostgresMerchantNotificationAdapter
  implements MerchantNotificationReadPort, MerchantNotificationDeliveryPort
{
  public constructor(
    private readonly sql: postgres.Sql<Record<string, unknown>>,
    private readonly owner: string,
  ) {}

  public async findRecipients(
    messageId: string,
    tenantId: string,
    orderId: string,
    eventType: string,
  ): Promise<MerchantOrderRecipient[]> {
    try {
      const rows = await this.sql<
        MerchantRow[]
      >`SELECT * FROM core.read_merchant_order_notification(${messageId}::uuid,${tenantId}::uuid,${orderId}::uuid,${eventType}::text)`;
      return rows.map((row: MerchantRow): MerchantOrderRecipient => ({
        userId: row.user_id,
        email: row.email,
        orderNumber: row.order_number,
        tenantName: row.tenant_name,
        stockItems: parseStockItems(row.stock_items),
      }));
    } catch (error: unknown) {
      throw new MessagingException('Unable to read merchant notification recipients', error);
    }
  }

  public async claim(key: MerchantDeliveryKey): Promise<DeliveryClaim> {
    try {
      const [row] = await this.sql<
        { result: DeliveryClaim | 'INVALID' }[]
      >`SELECT core.claim_merchant_notification_delivery(${key.messageId}::uuid,${key.userId}::uuid,${key.kind}::text,${this.owner}::uuid) AS result`;
      if (!row || row.result === 'INVALID')
        throw new NotificationPermanentException('INVALID_MERCHANT_NOTIFICATION');
      return row.result;
    } catch (error: unknown) {
      if (error instanceof NotificationPermanentException) throw error;
      throw new MessagingException('Unable to claim merchant notification', error);
    }
  }

  public async complete(key: MerchantDeliveryKey): Promise<void> {
    await this.finish(key, 'SENT');
  }
  public async fail(key: MerchantDeliveryKey, terminal: boolean): Promise<void> {
    await this.finish(key, terminal ? 'DEAD' : 'RETRY');
  }

  private async finish(key: MerchantDeliveryKey, status: string): Promise<void> {
    try {
      const [row] = await this.sql<
        { accepted: boolean }[]
      >`SELECT core.finish_merchant_notification_delivery(${key.messageId}::uuid,${key.userId}::uuid,${key.kind}::text,${this.owner}::uuid,${status}::text) AS accepted`;
      if (!row?.accepted) throw new MessagingException('Merchant notification lease was lost');
    } catch (error: unknown) {
      throw new MessagingException('Unable to finish merchant notification', error);
    }
  }
}

function parseStockItems(value: unknown): MerchantStockItem[] {
  if (!Array.isArray(value)) throw new MessagingException('Invalid stock notification projection');
  return value.map((item: unknown): MerchantStockItem => {
    if (
      typeof item !== 'object' ||
      item === null ||
      !('productId' in item) ||
      typeof item.productId !== 'string' ||
      !('name' in item) ||
      typeof item.name !== 'string' ||
      !('sku' in item) ||
      typeof item.sku !== 'string' ||
      !('stock' in item) ||
      typeof item.stock !== 'number' ||
      !Number.isSafeInteger(item.stock) ||
      item.stock < 0
    )
      throw new MessagingException('Invalid stock notification projection');
    return { productId: item.productId, name: item.name, sku: item.sku, stock: item.stock };
  });
}
