import { runFedexSandboxWorker } from '@canaldigital/packages/core';
import { readTrackingWorkerConfig } from '@/worker/shipment-tracking-config';
import { loadWorkerEnvironment } from '@/worker/environment';
import { loadWorkerHealthPort, startWorkerHealth } from '@/worker/health';

async function main(): Promise<void> {
  loadWorkerEnvironment();
  const config = readTrackingWorkerConfig(process.env);
  const health = await startWorkerHealth(loadWorkerHealthPort(process.env, 8093));
  const controller = new AbortController();
  const stop = (): void => controller.abort();
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
  try {
    await runFedexSandboxWorker(
      config,
      controller.signal,
      undefined,
      undefined,
      (result): void => {
        console.info('shipment_tracking_result', result);
      },
      (metrics): void => {
        console.info('shipment_tracking_metrics', JSON.stringify(metrics));
      },
      health.setReady,
    );
  } finally {
    process.removeListener('SIGTERM', stop);
    process.removeListener('SIGINT', stop);
    await health.close();
  }
}
void main().catch((): void => {
  console.error('Sandbox shipment tracking worker stopped; check configuration and permissions.');
  process.exitCode = 1;
});
