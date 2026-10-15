import {
  loadMessagingWorkerConfig,
  loadSmtpConfig,
  runNotificationWorker,
} from '@canaldigital/packages/core';
import es from '@/messages/es.json';
import en from '@/messages/en.json';

async function main(): Promise<void> {
  const config = loadMessagingWorkerConfig(process.env, 'NOTIFICATION_DATABASE_URL');
  const smtp = loadSmtpConfig(process.env);
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
      controller.signal,
      console,
    );
  } finally {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
  }
}

void main().catch((): void => {
  console.error('Notification worker startup failed; verify worker and SMTP configuration');
  process.exitCode = 1;
});
