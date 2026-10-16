import type { IntegrationEvent } from '@/shared/application/ports/out/integration-event-publisher.port';
import type { NotificationLocale } from '@/notifications/application/ports/out/notification.ports';
import type { NotificationResult } from '@/notifications/application/deliver-order-notification.use-case';
import type {
  MerchantNotificationDeliveryPort,
  MerchantNotificationEmailPort,
  MerchantNotificationKind,
  MerchantNotificationReadPort,
  MerchantStockItem,
} from '@/notifications/application/ports/out/merchant-notification.ports';
import { NotificationPermanentException } from '@/notifications/application/exceptions/notification-permanent.exception';
import { isLowStock } from '@/notifications/domain/merchant-notification.policy';

export class DeliverMerchantNotificationsUseCase {
  public constructor(
    private readonly recipients: MerchantNotificationReadPort,
    private readonly deliveries: MerchantNotificationDeliveryPort,
    private readonly email: MerchantNotificationEmailPort,
    private readonly locale: NotificationLocale,
  ) {}

  public async execute(event: IntegrationEvent, attempt: number): Promise<NotificationResult> {
    const kind: MerchantNotificationKind | null =
      event.eventType === 'OrderConfirmedEvent'
        ? 'new_order'
        : event.eventType === 'OrderPaidEvent'
          ? 'paid'
          : event.eventType === 'OrderCancelledEvent'
            ? 'cancelled'
            : null;
    if (!kind) return 'DUPLICATE';
    if (event.aggregateType !== 'Order' || event.payload.orderId !== event.aggregateId)
      throw new NotificationPermanentException('INVALID_NOTIFICATION_EVENT');
    let busy = false;
    let dead = false;
    for (const recipient of await this.recipients.findRecipients(
      event.messageId,
      event.tenantId,
      event.aggregateId,
      event.eventType,
    )) {
      const lowStock = recipient.stockItems.filter((item: MerchantStockItem): boolean =>
        isLowStock(item.stock),
      );
      const kinds: MerchantNotificationKind[] = [kind];
      if (kind === 'new_order' && lowStock.length > 0) kinds.push('low_stock');
      for (const notice of kinds) {
        const key = { messageId: event.messageId, userId: recipient.userId, kind: notice };
        const claim = await this.deliveries.claim(key);
        if (claim === 'SENT') continue;
        if (claim === 'BUSY') {
          busy = true;
          continue;
        }
        if (claim === 'DEAD') {
          dead = true;
          continue;
        }
        try {
          await this.email.sendMerchant({
            ...recipient,
            ...key,
            stockItems: notice === 'low_stock' ? lowStock : [],
            locale: this.locale,
          });
          await this.deliveries.complete(key);
        } catch (error: unknown) {
          const terminal = error instanceof NotificationPermanentException || attempt >= 5;
          await this.deliveries.fail(key, terminal);
          if (!terminal) throw error;
          dead = true;
        }
      }
    }
    return busy ? 'BUSY' : dead ? 'DEAD' : 'SENT';
  }
}
