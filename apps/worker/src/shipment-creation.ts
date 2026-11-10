import { readShipmentCreationConfig } from '@/worker/shipment-creation-config';
import { runShipmentCreationWorker } from '@/worker/shipment-creation-runtime';
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
  const config = readShipmentCreationConfig(process.env);
  const health = await startWorkerHealth(loadWorkerHealthPort(process.env, 8094));
  const controller = new AbortController();
  const stop = (): void => controller.abort();
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
  try {
    if (!config) {
      // Disabled deployments stay healthy and idle instead of restarting in a loop.
      console.info(
        'Sandbox shipment creation is disabled; set SHIPMENT_CREATION_SANDBOX_ENABLED=true.',
      );
      health.setReady(true);
      await waitForAbort(controller.signal);
      return;
    }
    await runShipmentCreationWorker(config, controller.signal, health.setReady, (line): void => {
      console.error(line);
    });
  } finally {
    process.removeListener('SIGTERM', stop);
    process.removeListener('SIGINT', stop);
    await health.close();
  }
}
void main().catch((): void => {
  console.error('Sandbox shipment creation worker stopped; check configuration and permissions.');
  process.exitCode = 1;
});
