import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { DispatchRefundUseCase } from '@/payments/application/use-cases/dispatch-refund.use-case';
import { ReconcileRefundUseCase } from '@/payments/application/use-cases/reconcile-refund.use-case';
import { PostgresRefundDispatchAdapter } from '@/payments/infrastructure/adapters/postgres-refund-dispatch.adapter';
import { LemonSqueezyRefundAdapter } from '@/payments/infrastructure/adapters/lemon-squeezy-refund.adapter';
import { PostgresRefundReconciliationAdapter } from '@/payments/infrastructure/adapters/postgres-refund-reconciliation.adapter';
import { LocalPaymentEvidenceClientAdapter } from '@/payments/infrastructure/adapters/local-payment-evidence-client.adapter';
import { openRestrictedPaymentConnection } from '@/payments/infrastructure/restricted-payment-connection';
import { StartPaymentCompensationUseCase } from '@/payments/application/use-cases/start-payment-compensation.use-case';
import { PostgresPaymentCompensationAdapter } from '@/payments/infrastructure/adapters/postgres-payment-compensation.adapter';
import type { PaymentWorkerConfig } from '@/payments/infrastructure/payment-worker-config';
import { paymentFailureCode } from '@/payments/infrastructure/payment-failure-code';
import type { OutboxWorkerLogger } from '@/shared/infrastructure/messaging/outbox-worker';

async function pause(signal: AbortSignal, ms: number): Promise<void> {
  await delay(ms, undefined, { signal }).catch((error: unknown): void => {
    if (!signal.aborted) throw error;
  });
}

export async function runPaymentRefundDispatchWorker(
  config: PaymentWorkerConfig & { apiKey: string },
  signal: AbortSignal,
  logger: OutboxWorkerLogger,
  onReady: (ready: boolean) => void,
): Promise<void> {
  const sql = await openRestrictedPaymentConnection(config.databaseUrl, 'payment_worker_role');
  const dispatch = new DispatchRefundUseCase(
    new PostgresRefundDispatchAdapter(sql),
    new LemonSqueezyRefundAdapter(config.apiKey),
  );
  const compensate = new StartPaymentCompensationUseCase(
    new PostgresPaymentCompensationAdapter(sql),
  );
  try {
    while (!signal.aborted) {
      let ms = config.pollIntervalMs;
      try {
        await compensate.execute();
        const result = await dispatch.execute(randomUUID());
        onReady(true);
        if (result !== 'IDLE') {
          logger.info(`Refund dispatch outcome: ${result}`);
          ms = 0;
        }
      } catch {
        onReady(false);
        logger.error(
          'Refund dispatch interrupted; abandoned lease recovery will preserve exposure',
        );
        ms = 5000;
      }
      if (ms > 0) await pause(signal, ms);
    }
  } finally {
    onReady(false);
    await sql.end({ timeout: 5 });
  }
}

export async function runPaymentReconciliationWorker(
  config: PaymentWorkerConfig & { egressPort: number; egressToken: string },
  signal: AbortSignal,
  logger: OutboxWorkerLogger,
  onReady: (ready: boolean) => void,
): Promise<void> {
  const sql = await openRestrictedPaymentConnection(
    config.databaseUrl,
    'payment_reconciliation_role',
  );
  const repository = new PostgresRefundReconciliationAdapter(sql);
  const reconcile = new ReconcileRefundUseCase(
    repository,
    new LocalPaymentEvidenceClientAdapter(config.egressPort, config.egressToken),
  );
  let nextMaintenance = 0;
  try {
    while (!signal.aborted) {
      let ms = config.pollIntervalMs;
      try {
        if (Date.now() >= nextMaintenance) {
          await repository.recoverAbandoned();
          for (let i = 0; i < 100 && !signal.aborted; i++) {
            const rows = await sql<
              { expired: boolean }[]
            >`SELECT sales.execute_checkout_timeout_transition(NULL) AS expired`;
            if (rows[0]?.expired !== true) break;
          }
          nextMaintenance = Date.now() + 30000;
        }
        const token = randomUUID();
        const events = await sql<
          { event_id: string }[]
        >`SELECT event_id FROM sales.claim_inbox_events(${token}::uuid,'order_refunded')`;
        if (events[0]) {
          try {
            await sql`SELECT sales.reconcile_external_refund_delta(NULL,NULL,${events[0].event_id}::uuid,${token}::uuid)`;
          } catch {
            await sql`SELECT sales.mark_inbox_event_failed(${events[0].event_id}::uuid,${token}::uuid)`;
            logger.error('Refund inbox deferred; inspect retry monitoring');
          }
          ms = 0;
        }
        const result = await reconcile.execute(randomUUID(), 'SETTLEMENT');
        if (result !== 'IDLE') {
          logger.info(`Refund reconciliation outcome: ${result}`);
          ms = 0;
        }
        const evidence = await reconcile.execute(randomUUID(), 'EVIDENCE');
        if (evidence !== 'IDLE') {
          logger.info('Ambiguous refund evidence refreshed for human review');
          ms = 0;
        }
        onReady(true);
      } catch (error: unknown) {
        onReady(false);
        logger.error(
          `Payment reconciliation interrupted (${paymentFailureCode(error)}); no refund POST is repeated`,
        );
        ms = 5000;
      }
      if (ms > 0) await pause(signal, ms);
    }
  } finally {
    onReady(false);
    await sql.end({ timeout: 5 });
  }
}
