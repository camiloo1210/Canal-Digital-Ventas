import amqp, { type ChannelModel, type ConfirmChannel } from 'amqplib';
import postgres from 'postgres';
import { setTimeout as delay } from 'node:timers/promises';
import type { MessagingWorkerConfig } from '@/shared/infrastructure/messaging/messaging-worker-config';
import type { OutboxWorkerLogger } from '@/shared/infrastructure/messaging/outbox-worker';
import type { NotificationCopies } from '@/notifications/application/ports/out/notification.ports';
import type { SmtpConfig } from '@/notifications/infrastructure/smtp-config';
import { SmtpNotificationAdapter } from '@/notifications/infrastructure/smtp-notification.adapter';
import { PostgresNotificationAdapter } from '@/notifications/infrastructure/postgres-notification.adapter';
import { DeliverOrderNotificationUseCase } from '@/notifications/application/deliver-order-notification.use-case';
import {
  assertNotificationTopology,
  processNotificationMessage,
} from '@/notifications/infrastructure/rabbitmq-notification-consumer';
import { MessagingException } from '@/shared/application/exceptions/messaging.exception';
import { PostgresMerchantNotificationAdapter } from '@/notifications/infrastructure/postgres-merchant-notification.adapter';
import { DeliverMerchantNotificationsUseCase } from '@/notifications/application/deliver-merchant-notifications.use-case';
import { DeliverOrderNotificationsUseCase } from '@/notifications/application/deliver-order-notifications.use-case';
import type { MerchantNotificationCopies } from '@/notifications/application/ports/out/merchant-notification.ports';

export async function runNotificationWorker(
  config: MessagingWorkerConfig,
  smtp: SmtpConfig,
  copies: NotificationCopies,
  merchantCopies: MerchantNotificationCopies,
  signal: AbortSignal,
  logger: OutboxWorkerLogger,
  onReady: (ready: boolean) => void = (): void => {},
): Promise<void> {
  const sql = postgres(config.databaseUrl, {
    max: 1,
    prepare: false,
    connect_timeout: 10,
    connection: { statement_timeout: 10_000, application_name: 'canaldigital-notifications' },
  });
  const email = new SmtpNotificationAdapter(smtp, copies, merchantCopies);
  try {
    while (!signal.aborted) {
      let connection: ChannelModel | undefined;
      let channel: ConfirmChannel | undefined;
      try {
        await email.verify();
        const [database] = await sql<{ authorized: boolean }[]>`
          SELECT pg_catalog.pg_has_role(session_user, 'notification_worker_role', 'MEMBER')
            AND has_function_privilege(current_user, 'core.claim_notification_delivery(uuid,uuid,uuid,text,uuid)', 'EXECUTE')
            AND has_function_privilege(current_user, 'core.finish_notification_delivery(uuid,uuid,text)', 'EXECUTE')
            AND has_function_privilege(current_user, 'core.read_order_notification(uuid,uuid)', 'EXECUTE')
            AND has_function_privilege(current_user, 'core.read_merchant_order_notification(uuid,uuid,uuid,text)', 'EXECUTE')
            AND has_function_privilege(current_user, 'core.claim_merchant_notification_delivery(uuid,uuid,text,uuid)', 'EXECUTE')
            AND has_function_privilege(current_user, 'core.finish_merchant_notification_delivery(uuid,uuid,text,uuid,text)', 'EXECUTE') AS authorized
        `;
        if (!database?.authorized)
          throw new MessagingException('Notification database access is unavailable');
        connection = await amqp.connect(config.rabbitMqUrl, { timeout: 10_000 });
        connection.on('error', (): void => {});
        channel = await connection.createConfirmChannel();
        channel.on('error', (): void => {});
        await assertNotificationTopology(channel, config.queue);
        await channel.prefetch(1);
        if (signal.aborted) continue;
        const deliveries = new PostgresNotificationAdapter(sql, crypto.randomUUID());
        const buyer = new DeliverOrderNotificationUseCase(
          deliveries,
          deliveries,
          email,
          smtp.locale,
        );
        const merchantDeliveries = new PostgresMerchantNotificationAdapter(
          sql,
          crypto.randomUUID(),
        );
        const merchant = new DeliverMerchantNotificationsUseCase(
          merchantDeliveries,
          merchantDeliveries,
          email,
          smtp.locale,
        );
        const useCase = new DeliverOrderNotificationsUseCase([buyer, merchant]);
        const activeChannel = channel;
        let pending: Promise<void> = Promise.resolve();
        let stop: () => void = (): void => {};
        const stopped = new Promise<void>((resolve): void => {
          stop = resolve;
        });
        signal.addEventListener('abort', stop, { once: true });
        connection.once('close', stop);
        channel.once('close', stop);
        channel.once('error', stop);
        if (signal.aborted) stop();
        try {
          const consumer = await channel.consume(
            config.queue,
            (message): void => {
              if (!message || signal.aborted) {
                stop();
                return;
              }
              pending = processNotificationMessage(message, {
                channel: activeChannel,
                queue: config.queue,
                deliver: useCase.execute.bind(useCase),
              }).catch((): void => {
                logger.error('Notification processing interrupted; message will be redelivered');
                stop();
              });
            },
            { noAck: false },
          );
          logger.info('Notification consumer connected; SMTP verified');
          onReady(true);
          await stopped;
          await channel.cancel(consumer.consumerTag).catch((): void => {});
          await pending;
        } finally {
          signal.removeEventListener('abort', stop);
        }
      } catch {
        if (!signal.aborted) logger.error('Notification worker interrupted; reconnecting');
      } finally {
        onReady(false);
        await channel?.close().catch((): void => {});
        await connection?.close().catch((): void => {});
      }
      if (!signal.aborted) await delay(5000, undefined, { signal }).catch((): void => {});
    }
  } finally {
    email.close();
    await sql.end({ timeout: 5 });
  }
}
