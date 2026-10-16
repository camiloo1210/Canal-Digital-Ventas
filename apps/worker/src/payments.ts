import { loadPaymentWorkerConfig, runPaymentInboxWorker } from '@canaldigital/packages/core';
import { startWorkerHealth, loadWorkerHealthPort } from '@/worker/health';
import { loadIsolatedPaymentEnvironment } from '@/worker/payment-process';

async function main(): Promise<void> {
  loadIsolatedPaymentEnvironment('inbox');
  const config = loadPaymentWorkerConfig(process.env);
  const health = await startWorkerHealth(loadWorkerHealthPort(process.env, 8083));
  const controller = new AbortController();
  const stop = (): void => {
    controller.abort();
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  try {
    await runPaymentInboxWorker(config, controller.signal, console, health.setReady);
  } finally {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
    await health.close();
  }
}

void main().catch((): void => {
  console.error(
    'Payment inbox worker startup failed; verify restricted credentials and migrations',
  );
  process.exitCode = 1;
});
