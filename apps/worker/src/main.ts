import {
  loadMessagingWorkerConfig,
  runOutboxWorker,
  ORDER_NOTIFICATION_EVENT_TYPES,
} from '@canaldigital/packages/core';
import { startWorkerHealth, loadWorkerHealthPort } from '@/worker/health';
import { loadWorkerEnvironment } from '@/worker/environment';

async function main(): Promise<void> {
  loadWorkerEnvironment();
  const config = loadMessagingWorkerConfig(process.env);
  const health = await startWorkerHealth(loadWorkerHealthPort(process.env, 8081));
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
      ORDER_NOTIFICATION_EVENT_TYPES,
      health.setReady,
    );
  } finally {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
    await health.close();
  }
}

void main().catch((): void => {
  console.error('Outbox worker startup failed; verify worker configuration');
  process.exitCode = 1;
});
