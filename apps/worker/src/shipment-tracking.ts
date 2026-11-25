import { runFedexSandboxWorker } from '@canaldigital/packages/core';
import {
  isTrackingSandboxEnabled,
  readTrackingWorkerConfig,
} from '@/worker/shipment-tracking-config';
import { loadWorkerEnvironment } from '@/worker/environment';
import { loadWorkerHealthPort, startWorkerHealth } from '@/worker/health';

function waitForAbort(signal: AbortSignal): Promise<void> {
  return new Promise<void>((resolve): void => {
    if (signal.aborted) resolve();
    else signal.addEventListener('abort', (): void => resolve(), { once: true });
  });
}

async function main(): Promise<void> {
  loadWorkerEnvironment();
  const enabled = isTrackingSandboxEnabled(process.env);
  const config = enabled ? readTrackingWorkerConfig(process.env) : null;
  const health = await startWorkerHealth(loadWorkerHealthPort(process.env, 8093));
  const controller = new AbortController();
  const stop = (): void => controller.abort();
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
  try {
    if (!config) {
      // Disabled deployments stay healthy and idle instead of restarting in a loop.
      console.info('Sandbox shipment tracking is disabled; set TRACKING_SANDBOX_ENABLED=true.');
      health.setReady(true);
      await waitForAbort(controller.signal);
      return;
    }
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
