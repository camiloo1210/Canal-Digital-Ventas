import { describe, expect, it } from 'vitest';
import { readNotificationTestMessages } from '@/notifications/infrastructure/notification-test-messages.fixture';
import {
  renderNotificationEmail,
  safeEmailImage,
} from '@/notifications/infrastructure/notification-email-template';
import { parseNotificationOrder } from '@/notifications/infrastructure/notification-order-projection';
import { loadSmtpConfig } from '@/notifications/infrastructure/smtp-config';
import type { NotificationOrderDetails } from '@/notifications/application/ports/out/notification-order-details';
import type { NotificationLocale } from '@/notifications/application/ports/out/notification.ports';
import type { OrderNotificationType } from '@/notifications/application/notification-events';
import type { MerchantNotificationKind } from '@/notifications/application/ports/out/merchant-notification.ports';

const es = readNotificationTestMessages('es');
const en = readNotificationTestMessages('en');

const order: NotificationOrderDetails = {
  orderId: 'order-1',
  tenantSlug: 'tienda-uno',
  logoUrl: 'https://cdn.example.test/logo.png',
  contactEmail: 'help@example.test',
  customerName: 'Ana <Buyer>',
  createdAt: '2026-10-19T12:00:00Z',
  currency: 'USD',
  subtotalCents: 2599,
  taxAmountCents: 200,
  discountAmountCents: 100,
  shippingCostCents: 300,
  totalAmountCents: 2999,
  shippingAddress: 'Street 1 & Main',
  items: [
    {
      name: 'Product <script>alert(1)</script>',
      sku: 'SKU-1',
      quantity: 2,
      unitPriceCents: 1300,
      subtotalCents: 2599,
      imageUrl: 'https://cdn.example.test/product.png',
    },
  ],
};

describe('transactional email presentation', (): void => {
  for (const locale of ['es', 'en'] as NotificationLocale[]) {
    const messages = locale === 'es' ? es : en;
    for (const kind of [
      'confirmed',
      'paid',
      'processing',
      'shipped',
      'delivered',
      'cancelled',
    ] as OrderNotificationType[]) {
      it(`renders buyer ${kind} in ${locale} with stored totals and a protected order link`, (): void => {
        const copy = messages.Notifications.email;
        const result = renderNotificationEmail({
          subject: copy.subjects[kind],
          intro: copy.intros[kind],
          tenantName: 'Store & Co',
          orderNumber: 'ORD-1',
          locale,
          kind,
          order,
          copy: copy.presentation,
          appUrl: 'https://sales.example.test',
        });
        expect(result.html).toContain(`lang="${locale}"`);
        expect(result.html).toContain('https://cdn.example.test/logo.png');
        expect(result.html).toContain('https://cdn.example.test/product.png');
        expect(result.html).toContain('https://sales.example.test/purchases#order-order-1');
        expect(result.html).toContain('Store &amp; Co');
        expect(result.html).not.toContain('<script>');
        expect(result.html).toContain('&lt;script&gt;');
        expect(result.text).toContain(locale === 'es' ? '25,99' : '25.99');
        expect(result.text).toContain(locale === 'es' ? '29,99' : '29.99');
        expect(result.text).toContain('SKU-1');
        expect(result.text).toContain('Street 1 & Main');
        expect(result.html).not.toContain('undefined');
      });
    }
    for (const kind of [
      'new_order',
      'paid',
      'cancelled',
      'low_stock',
    ] as MerchantNotificationKind[]) {
      it(`renders merchant ${kind} in ${locale} with the correct dashboard destination`, (): void => {
        const copy = messages.Notifications.merchant;
        const result = renderNotificationEmail({
          subject: copy.subjects[kind],
          intro: copy.intros[kind],
          tenantName: 'Store',
          orderNumber: 'ORD-1',
          locale,
          kind,
          order,
          copy: copy.presentation,
          merchant: true,
          appUrl: 'https://sales.example.test',
          stockItems: [{ productId: 'p1', name: 'Low <stock>', sku: 'LOW', stock: 0 }],
        });
        expect(result.html).toContain(
          kind === 'low_stock' ? '/dashboard/catalog/products' : '/dashboard/orders',
        );
        if (kind === 'low_stock') {
          expect(result.html).toContain('Low &lt;stock&gt;');
          expect(result.text).toContain('0');
          expect(result.html).not.toContain(order.shippingAddress);
        } else {
          expect(result.html).toContain('SKU-1');
        }
      });
    }
  }
  it('omits unsafe images, missing logo and unconfigured buttons without losing order data', (): void => {
    const result = renderNotificationEmail({
      subject: 'Order',
      intro: 'Hello',
      tenantName: 'Store',
      orderNumber: 'ORD-1',
      locale: 'en',
      kind: 'confirmed',
      order: {
        ...order,
        logoUrl: null,
        items: [{ ...order.items[0], imageUrl: 'javascript:alert(1)' }],
      },
      copy: en.Notifications.email.presentation,
    });
    expect(result.html).not.toContain('<img');
    expect(result.html).not.toContain('javascript:');
    expect(result.html).not.toContain('href="https://sales');
    expect(result.text).toContain('SKU-1');
  });
  it('bounds long item lists and keeps the authoritative full order total', (): void => {
    const result = renderNotificationEmail({
      subject: 'Order',
      intro: 'Hello',
      tenantName: 'Store',
      orderNumber: 'ORD-1',
      locale: 'en',
      kind: 'confirmed',
      order: {
        ...order,
        items: Array.from(
          { length: 250 },
          (): NotificationOrderDetails['items'][number] => order.items[0],
        ),
      },
      copy: en.Notifications.email.presentation,
    });
    expect(result.text).toContain('230 more products');
    expect(result.text).toContain('29.99');
    expect(Buffer.byteLength(result.html)).toBeLessThan(80_000);
  });
  it.each([
    'javascript:alert(1)',
    'data:image/svg+xml,test',
    'file:///etc/passwd',
    'http://cdn.test/image.png',
    'https://user:password@cdn.test/image.png',
  ])('rejects unsafe image %s', (url: string): void => {
    expect(safeEmailImage(url)).toBeNull();
  });
  it('validates worker projections before formatting amounts or dates', (): void => {
    expect(parseNotificationOrder(order)).toEqual(order);
    for (const invalid of [
      { ...order, totalAmountCents: 1.1 },
      { ...order, createdAt: 'bad' },
      { ...order, items: [{}] },
      { ...order, currency: '<svg>' },
      null,
    ]) {
      expect((): NotificationOrderDetails => parseNotificationOrder(invalid)).toThrow();
    }
  });
  it('accepts only a configured secure public origin or a loopback development origin', (): void => {
    expect(
      loadSmtpConfig({
        SMTP_FROM_EMAIL: 'sales@example.test',
        NOTIFICATION_APP_URL: 'https://sales.example.test',
      }).appUrl,
    ).toBe('https://sales.example.test');
    expect(
      loadSmtpConfig({
        SMTP_FROM_EMAIL: 'sales@example.test',
        NOTIFICATION_APP_URL: 'http://localhost:3000',
      }).appUrl,
    ).toBe('http://localhost:3000');
    for (const url of [
      'javascript:alert(1)',
      'http://public.example.test',
      'https://user:pass@example.test',
      'https://example.test/path',
      'https://example.test?next=other',
    ]) {
      expect((): unknown =>
        loadSmtpConfig({ SMTP_FROM_EMAIL: 'sales@example.test', NOTIFICATION_APP_URL: url }),
      ).toThrow();
    }
  });
});
