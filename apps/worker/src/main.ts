import { loadMessagingWorkerConfig, runOutboxWorker } from '@canaldigital/packages/core';
import { startWorkerHealth, loadWorkerHealthPort } from '@/worker/health';
import { loadWorkerEnvironment } from '@/worker/environment';
import { orderEventTypesForWorker, shouldPublishOrderEvent } from '@/worker/order-event-types';
import type { IntegrationEvent } from '@canaldigital/packages/core';

async function main(): Promise<void> {
  loadWorkerEnvironment();
  const config = loadMessagingWorkerConfig(process.env);
  if (
    process.env.REFUND_NOTIFICATIONS_ENABLED === 'true' &&
    !orderEventTypesForWorker(process.env).includes('OrderRefundedEvent')
  )
    console.error('Refund notifications disabled: configure a valid UTC cutoff.');
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
      orderEventTypesForWorker(process.env),
      health.setReady,
      'Order',
      (event: IntegrationEvent): boolean => shouldPublishOrderEvent(event, process.env),
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
