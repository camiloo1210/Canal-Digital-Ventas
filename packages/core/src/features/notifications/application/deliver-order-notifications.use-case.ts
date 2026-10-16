import type { IntegrationEvent } from '@/shared/application/ports/out/integration-event-publisher.port';
import type { NotificationResult } from '@/notifications/application/deliver-order-notification.use-case';
import { NotificationPermanentException } from '@/notifications/application/exceptions/notification-permanent.exception';

interface NotificationHandler {
  execute(event: IntegrationEvent, attempt: number): Promise<NotificationResult>;
}

/** Each audience owns its delivery receipts; a failed buyer must not suppress the owner. */
export class DeliverOrderNotificationsUseCase {
  public constructor(private readonly handlers: readonly NotificationHandler[]) {}

  public async execute(event: IntegrationEvent, attempt: number): Promise<NotificationResult> {
    let failure: unknown;
    let busy = false;
    let dead = false;
    for (const handler of this.handlers) {
      try {
        const result = await handler.execute(event, attempt);
        busy ||= result === 'BUSY';
        dead ||= result === 'DEAD';
      } catch (error: unknown) {
        if (error instanceof NotificationPermanentException || attempt >= 5) dead = true;
        else failure = error;
      }
    }
    if (failure !== undefined) throw failure;
    return busy ? 'BUSY' : dead ? 'DEAD' : 'SENT';
  }
}
