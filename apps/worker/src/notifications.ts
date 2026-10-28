import {
  loadMessagingWorkerConfig,
  loadSmtpConfig,
  runNotificationWorker,
  loadKiviTokenCipher,
} from '@canaldigital/packages/core';
import es from '@/messages/es.json';
import en from '@/messages/en.json';
import { startWorkerHealth, loadWorkerHealthPort } from '@/worker/health';
import { loadWorkerEnvironment } from '@/worker/environment';

async function main(): Promise<void> {
  loadWorkerEnvironment();
  const config = loadMessagingWorkerConfig(process.env, 'NOTIFICATION_DATABASE_URL');
  const smtp = loadSmtpConfig(process.env);
  const health = await startWorkerHealth(loadWorkerHealthPort(process.env, 8082));
  const controller = new AbortController();
  const stop = (): void => {
    controller.abort();
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  try {
    await runNotificationWorker(
      config,
      smtp,
      { es: es.Notifications.email, en: en.Notifications.email },
      { es: es.Notifications.merchant, en: en.Notifications.merchant },
      controller.signal,
      console,
      health.setReady,
      process.env.KIVI_NOTIFICATIONS_ENABLED === 'true'
        ? loadKiviTokenCipher(process.env)
        : undefined,
    );
  } finally {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
    await health.close();
  }
}

void main().catch((): void => {
  console.error('Notification worker startup failed; verify worker and SMTP configuration');
  process.exitCode = 1;
});
