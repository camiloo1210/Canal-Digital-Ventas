import { loadMessagingWorkerConfig, runOutboxWorker } from '@canaldigital/packages/core';

async function main(): Promise<void> {
  const config = loadMessagingWorkerConfig(process.env);
  const controller = new AbortController();
  const stop = (): void => {
    controller.abort();
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  try {
    await runOutboxWorker(config, controller.signal, console);
  } finally {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
  }
}

void main().catch((): void => {
  console.error('Outbox worker startup failed; verify worker configuration');
  process.exitCode = 1;
});
