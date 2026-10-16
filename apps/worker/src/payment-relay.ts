import {
  loadMessagingWorkerConfig,
  runOutboxWorker,
  PAYMENT_ORDER_EVENT_TYPES,
} from '@canaldigital/packages/core';
import { startWorkerHealth, loadWorkerHealthPort } from '@/worker/health';
import { loadIsolatedPaymentEnvironment } from '@/worker/payment-process';

async function main(): Promise<void> {
  loadIsolatedPaymentEnvironment('relay');
  const config = loadMessagingWorkerConfig({
    ...process.env,
    RABBITMQ_QUEUE: process.env.PAYMENT_DOMAIN_QUEUE ?? 'canaldigital.payments.domain',
  });
  const health = await startWorkerHealth(loadWorkerHealthPort(process.env, 8085));
  const controller = new AbortController();
  const stop = (): void => {
    controller.abort();
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  try {
    await runOutboxWorker(
      config,
      controller.signal,
      console,
      PAYMENT_ORDER_EVENT_TYPES,
      health.setReady,
      'Payment',
    );
  } finally {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
    await health.close();
  }
}
void main().catch((): void => {
  console.error('Payment relay startup failed; verify restricted configuration');
  process.exitCode = 1;
});
