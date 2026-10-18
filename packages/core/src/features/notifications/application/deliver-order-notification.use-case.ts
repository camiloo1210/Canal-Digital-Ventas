import type { IntegrationEvent } from '@/shared/application/ports/out/integration-event-publisher.port';
import { resolveOrderNotificationType } from '@/notifications/application/notification-events';
import { NotificationPermanentException } from '@/notifications/application/exceptions/notification-permanent.exception';
import type {
  NotificationDeliveryPort,
  NotificationEmailPort,
  NotificationLocale,
  OrderNotificationReadPort,
} from '@/notifications/application/ports/out/notification.ports';

export type NotificationResult = 'SENT' | 'DUPLICATE' | 'BUSY' | 'DEAD';

export class DeliverOrderNotificationUseCase {
  constructor(
    private readonly deliveries: NotificationDeliveryPort,
    private readonly orders: OrderNotificationReadPort,
    private readonly email: NotificationEmailPort,
    private readonly locale: NotificationLocale,
  ) {}

  public async execute(event: IntegrationEvent, attempt: number): Promise<NotificationResult> {
    const type = resolveOrderNotificationType(event.eventType);
    if (!type || event.aggregateType !== 'Order' || event.payload.orderId !== event.aggregateId) {
      throw new NotificationPermanentException('INVALID_NOTIFICATION_EVENT');
    }
    const claim = await this.deliveries.claim(event);
    if (claim === 'SENT') return 'DUPLICATE';
    if (claim !== 'CLAIMED') return claim;
    try {
      const recipient = await this.orders.findRecipient(event.tenantId, event.aggregateId);
      if (!recipient) throw new NotificationPermanentException('RECIPIENT_NOT_FOUND');
      await this.email.send({
        ...recipient,
        messageId: event.messageId,
        type,
        locale: this.locale,
      });
      await this.deliveries.complete(event.messageId);
      return 'SENT';
    } catch (error: unknown) {
      await this.deliveries.fail(
        event.messageId,
        error instanceof NotificationPermanentException || attempt >= 5,
      );
      throw error;
    }
  }
}
