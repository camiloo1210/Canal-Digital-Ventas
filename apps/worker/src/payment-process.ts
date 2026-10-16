import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import { startWorkerHealth, loadWorkerHealthPort } from '@/worker/health';

export type PaymentProcessProfile =
  'inbox' | 'domain' | 'relay' | 'dispatch' | 'reconciliation' | 'egress' | 'retention';
export function loadIsolatedPaymentEnvironment(profile: PaymentProcessProfile): void {
  try {
    loadEnvFile(
      fileURLToPath(new URL(`../../../.local/payment-runtime/${profile}.env`, import.meta.url)),
    );
  } catch (error: unknown) {
    // Deployment can inject only this process's environment instead of mounting a local file.
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT')
      return;
    throw error;
  }
}
export async function runPaymentProcess(
  profile: PaymentProcessProfile,
  port: number,
  run: (signal: AbortSignal, setReady: (ready: boolean) => void) => Promise<void>,
): Promise<void> {
  loadIsolatedPaymentEnvironment(profile);
  const health = await startWorkerHealth(loadWorkerHealthPort(process.env, port));
  const controller = new AbortController();
  const stop = (): void => {
    controller.abort();
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  try {
    await run(controller.signal, health.setReady);
  } finally {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
    await health.close();
  }
}
export function paymentSetting(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing payment setting: ${name}`);
  return value;
}
