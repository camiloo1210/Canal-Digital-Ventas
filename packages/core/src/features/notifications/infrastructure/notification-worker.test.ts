import { describe, expect, it, vi } from 'vitest';
import { runNotificationWorker } from '@/notifications/infrastructure/notification-worker';
import { loadSmtpConfig } from '@/notifications/infrastructure/smtp-config';
import { readNotificationTestMessages } from '@/notifications/infrastructure/notification-test-messages.fixture';
import { MessagingException } from '@/shared/application/exceptions/messaging.exception';

const es = readNotificationTestMessages('es');
const en = readNotificationTestMessages('en');

const probes = vi.hoisted((): { verify: ReturnType<typeof vi.fn> } => ({ verify: vi.fn() }));
vi.mock('@/notifications/infrastructure/smtp-notification.adapter', (): object => ({
  SmtpNotificationAdapter: class {
    public verify = probes.verify;
    public close(): void {}
    public async send(): Promise<void> {}
  },
}));
vi.mock('postgres', (): object => ({
  default: (): object =>
    Object.assign(vi.fn().mockResolvedValue([{ authorized: true }]), {
      end: vi.fn().mockResolvedValue(undefined),
    }),
}));
vi.mock('amqplib', (): object => ({
  default: {
    connect: async (): Promise<object> => ({
      on: vi.fn(),
      once: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
      createConfirmChannel: async (): Promise<object> => ({
        on: vi.fn(),
        once: vi.fn(),
        assertQueue: vi.fn(),
        prefetch: vi.fn(),
        consume: vi.fn().mockResolvedValue({ consumerTag: 'test' }),
        cancel: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  },
}));

describe('notification worker channel independence', (): void => {
  it('starts consuming for Kivi even when the SMTP health probe fails', async (): Promise<void> => {
    probes.verify.mockRejectedValue(new MessagingException('SMTP is unavailable'));
    const controller = new AbortController();
    const readiness: boolean[] = [];
    const timeout = setTimeout((): void => controller.abort(), 100);
    try {
      await runNotificationWorker(
        {
          databaseUrl: 'postgres://test',
          rabbitMqUrl: 'amqp://test',
          queue: 'test',
          pollIntervalMs: 1,
        },
        loadSmtpConfig({ SMTP_FROM_EMAIL: 'test@example.test' }),
        { es: es.Notifications.email, en: en.Notifications.email },
        { es: es.Notifications.merchant, en: en.Notifications.merchant },
        controller.signal,
        { info: vi.fn(), error: vi.fn() },
        (ready: boolean): void => {
          readiness.push(ready);
          if (ready) controller.abort();
        },
        { encrypt: vi.fn(), decrypt: vi.fn() },
      );
      expect(readiness).toContain(true);
    } finally {
      clearTimeout(timeout);
    }
  });
});
