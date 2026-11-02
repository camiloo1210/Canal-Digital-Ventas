import { loadCartRetentionWorkerConfig, runCartRetentionWorker } from '@canaldigital/packages/core';
import { startWorkerHealth, loadWorkerHealthPort } from '@/worker/health';
import { loadWorkerEnvironment } from '@/worker/environment';

async function main(): Promise<void> {
  loadWorkerEnvironment();
  const config = loadCartRetentionWorkerConfig(process.env);
  const health = await startWorkerHealth(loadWorkerHealthPort(process.env, 8092));
  const controller = new AbortController();
  const stop = (): void => {
    controller.abort();
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  try {
    await runCartRetentionWorker(config, controller.signal, console, health.setReady);
  } finally {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
    await health.close();
  }
}

void main().catch((): void => {
  console.error('Cart retention worker startup failed; verify worker configuration');
  process.exitCode = 1;
});
