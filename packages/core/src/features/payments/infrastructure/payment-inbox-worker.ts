import { setTimeout as delay } from 'node:timers/promises';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { ProcessPaymentInboxUseCase } from '@/payments/application/use-cases/process-payment-inbox.use-case';
import { PostgresPaymentInboxProcessingAdapter } from '@/payments/infrastructure/adapters/postgres-payment-inbox-processing.adapter';
import type { PaymentWorkerConfig } from '@/payments/infrastructure/payment-worker-config';
import { PaymentRepositoryException } from '@/payments/application/exceptions/payment-repository.exception';

interface PaymentWorkerLogger {
  info(message: string): void;
  error(message: string): void;
}

/** Node worker composition root; financial state transitions are driven through application ports. */
export async function runPaymentInboxWorker(
  config: PaymentWorkerConfig,
  signal: AbortSignal,
  logger: PaymentWorkerLogger,
  onReady: (ready: boolean) => void,
): Promise<void> {
  const sql = postgres(config.databaseUrl, {
    max: 1,
    prepare: false,
    connect_timeout: 5,
    idle_timeout: 20,
    connection: { statement_timeout: 10000, application_name: 'canaldigital-payments-inbox' },
  });
  try {
    const identity = await sql<{ authorized: boolean }[]>`SELECT (
      NOT r.rolsuper AND NOT r.rolbypassrls AND NOT r.rolcreaterole
      AND pg_catalog.pg_has_role(session_user,'payment_worker_role','MEMBER')
      AND NOT pg_catalog.pg_has_role(session_user,'payments_rpc_owner','MEMBER')
      AND NOT pg_catalog.pg_has_role(session_user,'payment_reconciliation_role','MEMBER')
      AND NOT pg_catalog.pg_has_role(session_user,'payment_checkout_role','MEMBER')
      AND NOT pg_catalog.pg_has_role(session_user,'payment_ingestion_role','MEMBER')
    ) AS authorized FROM pg_catalog.pg_roles r WHERE r.rolname=session_user`;
    if (identity[0]?.authorized !== true)
      throw new PaymentRepositoryException('Unsafe payment worker identity.');
    const useCase = new ProcessPaymentInboxUseCase(new PostgresPaymentInboxProcessingAdapter(sql));
    logger.info('Payment inbox worker connected');
    while (!signal.aborted) {
      let pauseMs = config.pollIntervalMs;
      try {
        const outcome = await useCase.execute(randomUUID());
        onReady(true);
        if (outcome === 'RETRY_SCHEDULED' || outcome === 'LEASE_LOST') {
          logger.error('Payment inbox attempt deferred; inspect retry/dead-letter monitoring');
        } else if (outcome !== 'IDLE') {
          logger.info(`Payment inbox outcome: ${outcome}`);
          pauseMs = 0;
        }
      } catch {
        onReady(false);
        logger.error('Payment inbox unavailable; retrying connection');
        pauseMs = 5000;
      }
      if (pauseMs > 0) {
        try {
          await delay(pauseMs, undefined, { signal });
        } catch (error: unknown) {
          if (!signal.aborted) throw error;
        }
      }
    }
  } finally {
    onReady(false);
    await sql.end({ timeout: 5 });
  }
}
