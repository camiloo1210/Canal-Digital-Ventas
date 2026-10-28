import type { IntegrationEvent } from '@/shared/application/ports/out/integration-event-publisher.port';
import type { NotificationResult } from '@/notifications/application/deliver-order-notification.use-case';
import type {
  KiviOrderNotificationReadPort,
  KiviOrderNotificationGatewayPort,
} from '@/kivi/application/ports/out/kivi-order-notification.port';
import { resolveOrderNotificationType } from '@/notifications/application/notification-events';
import { NotificationPermanentException } from '@/notifications/application/exceptions/notification-permanent.exception';
import { KiviGatewayException } from '@/kivi/application/exceptions/kivi-gateway.exception';

export class DeliverKiviOrderNotificationUseCase {
  public constructor(
    private readonly source: KiviOrderNotificationReadPort,
    private readonly gateway: KiviOrderNotificationGatewayPort,
  ) {}
  public async execute(event: IntegrationEvent): Promise<NotificationResult> {
    if (
      event.aggregateType !== 'Order' ||
      event.payload.orderId !== event.aggregateId ||
      !resolveOrderNotificationType(event.eventType)
    )
      throw new NotificationPermanentException('INVALID_KIVI_ORDER_EVENT');
    const source = await this.source.find(event);
    if (!source) return 'SENT';
    try {
      await this.gateway.deliver(source, event);
    } catch (error: unknown) {
      if (error instanceof KiviGatewayException && error.failure === 'rejected')
        throw new NotificationPermanentException('KIVI_NOTIFICATION_REJECTED');
      throw error;
    }
    return 'SENT';
  }
}
