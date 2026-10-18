import amqp, { type ChannelModel, type ConfirmChannel } from 'amqplib';
import postgres from 'postgres';
import { setTimeout as delay } from 'node:timers/promises';
import type { MessagingWorkerConfig } from '@/shared/infrastructure/messaging/messaging-worker-config';
import type { OutboxWorkerLogger } from '@/shared/infrastructure/messaging/outbox-worker';
import {
  assertReliableQueueTopology,
  processReliableQueueMessage,
} from '@/shared/infrastructure/messaging/reliable-queue-consumer';
import { PostgresTransactionManagerAdapter } from '@/shared/infrastructure/adapters/postgres-transaction-manager.adapter';
import { PostgresEventBusAdapter } from '@/shared/infrastructure/adapters/postgres-event-bus.adapter';
import { PostgresProductRepository } from '@/products/infrastructure/repositories/postgres-product.repository';
import { PostgresOrderRepository } from '@/orders/infrastructure/repositories/postgres-order.repository';
import { PostgresOrderPaymentCoordinationAdapter } from '@/orders/infrastructure/repositories/postgres-order-payment-coordination.adapter';
import { PostgresOrderPaymentAutomationAdapter } from '@/orders/infrastructure/repositories/postgres-order-payment-automation.adapter';
import { MarkOrderPaidUseCase } from '@/orders/application/use-cases/mark-order-paid.use-case';
import { ApplyObservedRefundToOrderUseCase } from '@/orders/application/use-cases/apply-observed-refund-to-order.use-case';
import { CancelExpiredOrderUseCase } from '@/orders/application/use-cases/cancel-expired-order.use-case';
import { HandlePaymentOrderEventUseCase } from '@/orders/application/use-cases/handle-payment-order-event.use-case';
import { decodePaymentOrderEvent } from '@/orders/infrastructure/payment-order-event.decoder';
import { MessagingException } from '@/shared/application/exceptions/messaging.exception';
import { RepairPaymentOrdersUseCase } from '@/orders/application/use-cases/repair-payment-orders.use-case';
import { PostgresPaymentOrderRepairReadAdapter } from '@/orders/infrastructure/repositories/postgres-payment-order-repair-read.adapter';

export const PAYMENT_ORDER_EVENT_TYPES = [
  'sales.payment.completed',
  'sales.payment.checkout_expired',
  'sales.payment.refund_observed',
  'sales.payment.late_payment',
];
// Audit identity for the dedicated system process, not a customer authentication identity.
const SYSTEM_ACTOR_ID = '00000000-0000-4000-8000-000000000041';

export async function runPaymentOrderWorker(
  config: MessagingWorkerConfig,
  signal: AbortSignal,
  logger: OutboxWorkerLogger,
  onReady: (ready: boolean) => void,
): Promise<void> {
  const sql = postgres(config.databaseUrl, {
    max: 1,
    prepare: false,
    connect_timeout: 5,
    idle_timeout: 20,
    connection: { statement_timeout: 10000, application_name: 'canaldigital-payments-domain' },
  });
  const events = new PostgresEventBusAdapter();
  const orders = new PostgresOrderRepository(events, sql);
  const products = new PostgresProductRepository(sql);
  const transactions = new PostgresTransactionManagerAdapter(sql);
  const coordination = new PostgresOrderPaymentCoordinationAdapter();
  const payments = new PostgresOrderPaymentAutomationAdapter();
  const paid = new MarkOrderPaidUseCase(
    orders,
    coordination,
    payments,
    events,
    transactions,
    SYSTEM_ACTOR_ID,
  );
  const expired = new CancelExpiredOrderUseCase(
    orders,
    products,
    coordination,
    payments,
    events,
    transactions,
    SYSTEM_ACTOR_ID,
  );
  const refunded = new ApplyObservedRefundToOrderUseCase(
    orders,
    coordination,
    payments,
    events,
    transactions,
    SYSTEM_ACTOR_ID,
  );
  const handler = new HandlePaymentOrderEventUseCase(paid, expired, refunded);
  const repair = new RepairPaymentOrdersUseCase(
    new PostgresPaymentOrderRepairReadAdapter(sql),
    paid,
    expired,
    refunded,
  );
  const repairController = new AbortController();
  const stopRepair = (): void => {
    repairController.abort();
  };
  signal.addEventListener('abort', stopRepair, { once: true });
  if (signal.aborted) stopRepair();
  let repairTask: Promise<void> = Promise.resolve();
  try {
    const identity = await sql<
      { authorized: boolean }[]
    >`SELECT NOT r.rolsuper AND NOT r.rolbypassrls AND NOT r.rolcreaterole
      AND pg_catalog.pg_has_role(session_user,'payment_order_domain_role','MEMBER')
      AND NOT pg_catalog.pg_has_role(session_user,'payments_rpc_owner','MEMBER')
      AND NOT has_table_privilege(current_user,'sales.payments','UPDATE') AS authorized
      FROM pg_catalog.pg_roles r WHERE r.rolname=session_user`;
    if (identity[0]?.authorized !== true)
      throw new MessagingException('Unsafe payment domain identity.');
    repairTask = (async (): Promise<void> => {
      while (!repairController.signal.aborted) {
        try {
          const result = await repair.execute();
          if (result.applied > 0) logger.info('Payment order repair applied');
          if (result.reviewRequired > 0) logger.error('Payment order repair requires review');
        } catch {
          logger.error('Payment order repair unavailable; retry scheduled');
        }
        await delay(300000, undefined, { signal: repairController.signal }).catch((): void => {});
      }
    })();
    while (!signal.aborted) {
      let connection: ChannelModel | undefined;
      let channel: ConfirmChannel | undefined;
      try {
        connection = await amqp.connect(config.rabbitMqUrl, { timeout: 10000 });
        connection.on('error', (): void => {});
        channel = await connection.createConfirmChannel();
        channel.on('error', (): void => {});
        await assertReliableQueueTopology(channel, config.queue);
        await channel.prefetch(1);
        if (signal.aborted) continue;
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
              pending = processReliableQueueMessage(message, {
                channel: activeChannel,
                queue: config.queue,
                decode: decodePaymentOrderEvent,
                handle: handler.execute.bind(handler),
              }).catch((): void => {
                logger.error('Payment domain processing interrupted; broker will redeliver');
                stop();
              });
            },
            { noAck: false },
          );
          onReady(true);
          logger.info('Payment domain consumer connected');
          await stopped;
          await channel.cancel(consumer.consumerTag).catch((): void => {});
          await pending;
        } finally {
          signal.removeEventListener('abort', stop);
        }
      } catch {
        if (!signal.aborted) logger.error('Payment domain worker interrupted; reconnecting');
      } finally {
        onReady(false);
        await channel?.close().catch((): void => {});
        await connection?.close().catch((): void => {});
      }
      if (!signal.aborted) await delay(5000, undefined, { signal }).catch((): void => {});
    }
  } finally {
    repairController.abort();
    await repairTask;
    signal.removeEventListener('abort', stopRepair);
    onReady(false);
    await sql.end({ timeout: 5 });
  }
}
