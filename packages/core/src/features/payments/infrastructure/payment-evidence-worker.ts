import { setTimeout as delay } from 'node:timers/promises';
import { openRestrictedPaymentConnection } from '@/payments/infrastructure/restricted-payment-connection';
import { LemonSqueezyEvidenceEgressAdapter } from '@/payments/infrastructure/adapters/lemon-squeezy-evidence-egress.adapter';
import { PostgresPaymentEvidenceRecorderAdapter } from '@/payments/infrastructure/adapters/postgres-payment-evidence-recorder.adapter';
import { startPaymentEvidenceServer } from '@/payments/infrastructure/payment-evidence-server';
import { paymentFailureCode } from '@/payments/infrastructure/payment-failure-code';
import type { OutboxWorkerLogger } from '@/shared/infrastructure/messaging/outbox-worker';

export async function runPaymentEvidenceWorker(
  config: {
    databaseUrl: string;
    apiKey: string;
    environment: 'test' | 'production';
    port: number;
    token: string;
  },
  signal: AbortSignal,
  logger: OutboxWorkerLogger,
  onReady: (ready: boolean) => void,
): Promise<void> {
  const sql = await openRestrictedPaymentConnection(config.databaseUrl, 'payment_egress_role');
  let server: { close(): Promise<void> } | undefined;
  try {
    server = await startPaymentEvidenceServer(
      config.port,
      config.token,
      new LemonSqueezyEvidenceEgressAdapter(
        config.apiKey,
        config.environment,
        new PostgresPaymentEvidenceRecorderAdapter(sql),
      ),
      (error: unknown): void => {
        logger.error(`Independent evidence recording failed (${paymentFailureCode(error)})`);
      },
    );
    onReady(true);
    logger.info('Independent GET evidence service listening on localhost');
    if (!signal.aborted)
      await new Promise<void>((resolve): void => {
        signal.addEventListener('abort', (): void => resolve(), { once: true });
        if (signal.aborted) resolve();
      });
  } finally {
    onReady(false);
    await server?.close();
    await sql.end({ timeout: 5 });
  }
}

export async function runPaymentRetentionWorker(
  databaseUrl: string,
  signal: AbortSignal,
  logger: OutboxWorkerLogger,
  onReady: (ready: boolean) => void,
): Promise<void> {
  const sql = await openRestrictedPaymentConnection(databaseUrl, 'payment_retention_role');
  try {
    while (!signal.aborted) {
      let ms = 3600000;
      try {
        const result = await sql<
          { count: number }[]
        >`SELECT sales.purge_payment_pii(30,100) AS count`;
        onReady(true);
        if ((result[0]?.count ?? 0) > 0) {
          logger.info('Payment evidence retention batch completed');
          ms = 1000;
        }
      } catch {
        onReady(false);
        logger.error('Payment retention failed; no raw evidence changed');
        ms = 60000;
      }
      await delay(ms, undefined, { signal }).catch((error: unknown): void => {
        if (!signal.aborted) throw error;
      });
    }
  } finally {
    onReady(false);
    await sql.end({ timeout: 5 });
  }
}
