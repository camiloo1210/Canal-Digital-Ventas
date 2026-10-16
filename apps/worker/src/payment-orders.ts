import { loadMessagingWorkerConfig, runPaymentOrderWorker } from '@canaldigital/packages/core';
import { startWorkerHealth, loadWorkerHealthPort } from '@/worker/health';
import { loadIsolatedPaymentEnvironment } from '@/worker/payment-process';

async function main(): Promise<void> {
  loadIsolatedPaymentEnvironment('domain');
  const config = loadMessagingWorkerConfig(
    {
      ...process.env,
      RABBITMQ_QUEUE: process.env.PAYMENT_DOMAIN_QUEUE ?? 'canaldigital.payments.domain',
    },
    'PAYMENT_DOMAIN_DATABASE_URL',
  );
  const health = await startWorkerHealth(loadWorkerHealthPort(process.env, 8084));
  const controller = new AbortController();
  const stop = (): void => {
    controller.abort();
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  try {
    await runPaymentOrderWorker(config, controller.signal, console, health.setReady);
  } finally {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
    await health.close();
  }
}
void main().catch((): void => {
  console.error('Payment domain startup failed; verify restricted configuration');
  process.exitCode = 1;
});
