import { runFedexSandboxWorker } from '@canaldigital/packages/core';
import { readTrackingWorkerConfig } from '@/worker/shipment-tracking-config';

const controller = new AbortController();
process.once('SIGTERM', (): void => controller.abort());
process.once('SIGINT', (): void => controller.abort());

async function main(): Promise<void> {
  const config = readTrackingWorkerConfig(process.env);
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
  );
}
main().catch((): void => {
  console.error('Sandbox shipment tracking worker stopped; check configuration and permissions.');
  process.exitCode = 1;
});
