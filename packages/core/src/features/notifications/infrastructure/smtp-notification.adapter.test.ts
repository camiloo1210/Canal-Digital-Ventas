import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SmtpNotificationAdapter } from '@/notifications/infrastructure/smtp-notification.adapter';
import { loadSmtpConfig } from '@/notifications/infrastructure/smtp-config';
import type { NotificationCopies } from '@/notifications/application/ports/out/notification.ports';
import { NotificationPermanentException } from '@/notifications/application/exceptions/notification-permanent.exception';
import { readNotificationTestMessages } from '@/notifications/infrastructure/notification-test-messages.fixture';
import type { NotificationOrderDetails } from '@/notifications/application/ports/out/notification-order-details';

const es = readNotificationTestMessages('es');
const en = readNotificationTestMessages('en');

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
  delivered: 'Delivered {orderNumber}',
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
  it('passes complete HTML and text order content to SMTP without changing its authorized envelope', async (): Promise<void> => {
    const order: NotificationOrderDetails = {
      orderId: 'order-1',
      tenantSlug: 'store',
      logoUrl: 'https://cdn.example.test/logo.png',
      contactEmail: 'help@example.test',
      customerName: 'Ana',
      createdAt: '2026-10-19T12:00:00Z',
      currency: 'USD',
      subtotalCents: 1000,
      taxAmountCents: 0,
      discountAmountCents: 0,
      shippingCostCents: 0,
      totalAmountCents: 1000,
      shippingAddress: 'Street 1',
      items: [
        {
          name: 'Paper',
          sku: 'PAPER',
          quantity: 1,
          unitPriceCents: 1000,
          subtotalCents: 1000,
          imageUrl: 'https://cdn.example.test/paper.png',
        },
      ],
    };
    const adapter = new SmtpNotificationAdapter(
      loadSmtpConfig({
        SMTP_FROM_EMAIL: 'sales@example.test',
        NOTIFICATION_APP_URL: 'https://sales.example.test',
      }),
      { es: es.Notifications.email, en: en.Notifications.email },
      { es: es.Notifications.merchant, en: en.Notifications.merchant },
    );
    await adapter.send({
      email: 'buyer@example.test',
      tenantName: 'Store',
      orderNumber: 'ORD-1',
      messageId: 'event-1',
      type: 'delivered',
      locale: 'es',
      order,
    });
    expect(smtp.send).toHaveBeenLastCalledWith(
      expect.objectContaining({
        from: { name: 'Store', address: 'sales@example.test' },
        envelope: { from: 'sales@example.test', to: 'buyer@example.test' },
        html: expect.stringContaining('https://cdn.example.test/paper.png'),
        text: expect.stringContaining('https://sales.example.test/#order-order-1'),
        disableFileAccess: true,
        disableUrlAccess: true,
      }),
    );
    await adapter.sendMerchant({
      email: 'owner@example.test',
      tenantName: 'Store',
      orderNumber: 'ORD-1',
      messageId: 'event-1',
      userId: 'owner-1',
      kind: 'low_stock',
      locale: 'en',
      order,
      stockItems: [{ productId: 'product-1', name: 'Paper', sku: 'PAPER', stock: 0 }],
    });
    expect(smtp.send).toHaveBeenLastCalledWith(
      expect.objectContaining({
        to: 'owner@example.test',
        messageId: '<event-1.owner-1.low_stock@example.test>',
        html: expect.stringContaining('https://cdn.example.test/logo.png'),
        text: expect.stringContaining('https://sales.example.test/dashboard/catalog/products'),
      }),
    );
  });
  it('matches STARTTLS, optional authentication and certificate verification', (): void => {
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
        from: { name: 'Store', address: 'sales@example.test' },
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
  it('addresses the owner separately and uses a distinct stable receipt for low stock', async (): Promise<void> => {
    const merchantCopy = {
      subjects: {
        new_order: 'New {orderNumber}',
        paid: 'Paid {orderNumber}',
        cancelled: 'Cancelled {orderNumber}',
        low_stock: 'Low stock {tenantName}',
      },
      body: '{tenantName}: {status}. {orderNumber}',
      stockLine: '{name} ({sku}): {stock}',
    };
    const adapter = new SmtpNotificationAdapter(
      loadSmtpConfig({ SMTP_FROM_EMAIL: 'sales@example.test' }),
      copies,
      { es: merchantCopy, en: merchantCopy },
    );
    await adapter.sendMerchant({
      messageId: 'event-1',
      userId: 'owner-1',
      email: 'owner@example.test',
      orderNumber: 'ORD-1',
      tenantName: 'Store',
      kind: 'low_stock',
      locale: 'es',
      stockItems: [{ productId: 'product-1', name: 'Paper', sku: 'PAPER', stock: 10 }],
    });
    expect(smtp.send).toHaveBeenLastCalledWith(
      expect.objectContaining({
        to: 'owner@example.test',
        messageId: '<event-1.owner-1.low_stock@example.test>',
        subject: 'Low stock Store',
        text: 'Store: Low stock Store. ORD-1\nPaper (PAPER): 10',
      }),
    );
  });
});
