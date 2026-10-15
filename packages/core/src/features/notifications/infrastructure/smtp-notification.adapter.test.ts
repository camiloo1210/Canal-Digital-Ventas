import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SmtpNotificationAdapter } from '@/notifications/infrastructure/smtp-notification.adapter';
import { loadSmtpConfig } from '@/notifications/infrastructure/smtp-config';
import type { NotificationCopies } from '@/notifications/application/ports/out/notification.ports';
import { NotificationPermanentException } from '@/notifications/application/exceptions/notification-permanent.exception';

const smtp = vi.hoisted(
  (): {
    create: ReturnType<typeof vi.fn>;
    send: ReturnType<typeof vi.fn>;
    verify: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  } => ({ create: vi.fn(), send: vi.fn(), verify: vi.fn(), close: vi.fn() }),
);
vi.mock('nodemailer', (): object => ({ default: { createTransport: smtp.create } }));
const subjects = {
  confirmed: 'Confirmed {orderNumber}',
  cancelled: 'Cancelled {orderNumber}',
  paid: 'Paid {orderNumber}',
  processing: 'Processing {orderNumber}',
  shipped: 'Shipped {orderNumber}',
};
const copies: NotificationCopies = {
  es: { subjects, body: '{tenantName}: {status}' },
  en: { subjects, body: '{tenantName}: {status}' },
};
beforeEach((): void => {
  smtp.create.mockReturnValue({ sendMail: smtp.send, verify: smtp.verify, close: smtp.close });
  smtp.send.mockResolvedValue({ accepted: ['buyer@example.test'], rejected: [] });
});

describe('Kiroku SMTP relay adaptation', (): void => {
  it('matches ema3 STARTTLS, optional authentication and certificate verification', (): void => {
    new SmtpNotificationAdapter(loadSmtpConfig({ SMTP_FROM_EMAIL: 'sales@example.test' }), copies);
    expect(smtp.create).toHaveBeenLastCalledWith(
      expect.objectContaining({
        host: 'smtp-relay.gmail.com',
        port: 587,
        secure: false,
        requireTLS: true,
        auth: undefined,
        tls: {
          minVersion: 'TLSv1.2',
          rejectUnauthorized: true,
          servername: 'smtp-relay.gmail.com',
        },
        logger: false,
        debug: false,
      }),
    );
  });
  it('supports authenticated implicit TLS and refuses incomplete credentials', (): void => {
    new SmtpNotificationAdapter(
      loadSmtpConfig({
        SMTP_FROM_EMAIL: 'sales@example.test',
        SMTP_PORT: '465',
        SMTP_SECURE: 'true',
        SMTP_USER: 'sender',
        SMTP_PASSWORD: 'test-secret',
      }),
      copies,
    );
    expect(smtp.create).toHaveBeenLastCalledWith(
      expect.objectContaining({
        port: 465,
        secure: true,
        auth: { user: 'sender', pass: 'test-secret' },
      }),
    );
    for (const env of [
      {},
      { SMTP_FROM_EMAIL: 'sales@example.test', SMTP_USER: 'sender' },
      { SMTP_FROM_EMAIL: 'sales@example.test', SMTP_PORT: '465' },
    ]) {
      expect((): unknown => loadSmtpConfig(env)).toThrow('Invalid SMTP');
    }
  });
  it('sets an explicit envelope and a stable Message-ID', async (): Promise<void> => {
    const adapter = new SmtpNotificationAdapter(
      loadSmtpConfig({ SMTP_FROM_EMAIL: 'sales@example.test' }),
      copies,
    );
    await adapter.send({
      email: 'buyer@example.test',
      orderNumber: 'ORD-1',
      tenantName: 'Store',
      messageId: 'event-1',
      type: 'cancelled',
      locale: 'en',
    });
    expect(smtp.send).toHaveBeenLastCalledWith(
      expect.objectContaining({
        from: 'sales@example.test',
        to: 'buyer@example.test',
        messageId: '<event-1@example.test>',
        envelope: { from: 'sales@example.test', to: 'buyer@example.test' },
        subject: 'Cancelled ORD-1',
        text: 'Store: Cancelled ORD-1',
      }),
    );
  });
  it('treats SMTP 5xx responses as permanent delivery failures', async (): Promise<void> => {
    smtp.send.mockRejectedValueOnce({ responseCode: 550 });
    const adapter = new SmtpNotificationAdapter(
      loadSmtpConfig({ SMTP_FROM_EMAIL: 'sales@example.test' }),
      copies,
    );
    await expect(
      adapter.send({
        email: 'buyer@example.test',
        orderNumber: 'ORD-1',
        tenantName: 'Store',
        messageId: 'event-1',
        type: 'confirmed',
        locale: 'es',
      }),
    ).rejects.toBeInstanceOf(NotificationPermanentException);
  });
});
