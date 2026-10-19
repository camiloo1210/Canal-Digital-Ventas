import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import es from '@/messages/es.json';
import en from '@/messages/en.json';
import {
  renderNotificationEmail,
  escapeEmailHtml,
} from '@/notifications/infrastructure/notification-email-template';
import type { NotificationOrderDetails } from '@/notifications/application/ports/out/notification-order-details';
import type { NotificationLocale } from '@/notifications/application/ports/out/notification.ports';
import type { OrderNotificationType } from '@/notifications/application/notification-events';
import type { MerchantNotificationKind } from '@/notifications/application/ports/out/merchant-notification.ports';

/** Offline fixtures only. Does not load credentials, connect to a database or send mail. */
async function main(): Promise<void> {
  const directory = fileURLToPath(
    new URL('../../../.local/notification-previews/', import.meta.url),
  );
  await mkdir(directory, { recursive: true });
  const order: NotificationOrderDetails = {
    orderId: 'demo-order',
    tenantSlug: 'casa-nativa',
    logoUrl: 'https://preview.example.test/logo.svg',
    contactEmail: 'hola@example.test',
    customerName: 'María García',
    createdAt: '2026-10-19T16:30:00Z',
    currency: 'USD',
    subtotalCents: 8500,
    taxAmountCents: 850,
    discountAmountCents: 500,
    shippingCostCents: 500,
    totalAmountCents: 9350,
    shippingAddress: 'Av. del Parque 120, Quito, Ecuador',
    items: [
      {
        name: 'Bolso tejido natural',
        sku: 'BOL-001',
        quantity: 1,
        unitPriceCents: 5500,
        subtotalCents: 5500,
        imageUrl: 'https://preview.example.test/bag.svg',
      },
      {
        name: 'Taza de cerámica artesanal',
        sku: 'TAZ-004',
        quantity: 2,
        unitPriceCents: 1500,
        subtotalCents: 3000,
        imageUrl: 'https://preview.example.test/cup.svg',
      },
    ],
  };
  const assets: Record<string, string> = {
    'logo.svg':
      '<rect width="100" height="100" rx="20" fill="#166534"/><path d="M25 62V38l25-17 25 17v24H58V48H42v14Z" fill="#fff"/><text x="50" y="83" fill="#fff" font-family="Arial" text-anchor="middle" font-size="12">NATIVA</text>',
    'bag.svg':
      '<rect width="100" height="100" fill="#faf4e9"/><path d="M33 35V28a17 17 0 0 1 34 0v7" stroke="#8f673e" stroke-width="5" fill="none"/><path d="M22 35h56l-5 51H27Z" fill="#c69c69"/><path d="M28 45h44M27 55h46M28 65h44M29 75h42M36 36v49M48 36v49M60 36v49" stroke="#e8c79b" stroke-width="3"/>',
    'cup.svg':
      '<rect width="100" height="100" fill="#eff3ed"/><path d="M70 39h10c18 0 13 30-10 27" fill="none" stroke="#a66d4d" stroke-width="7"/><path d="M24 32h48v39c0 18-48 18-48 0Z" fill="#b88160"/><ellipse cx="48" cy="32" rx="24" ry="7" fill="#e8c7a9"/><ellipse cx="48" cy="32" rx="18" ry="4" fill="#79533d"/>',
  };
  for (const [name, body] of Object.entries(assets)) {
    await writeFile(
      resolve(directory, name),
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${body}</svg>`,
    );
  }
  const links: string[] = [];
  for (const locale of ['es', 'en'] as NotificationLocale[]) {
    const messages = locale === 'es' ? es : en;
    const expand = (value: string): string =>
      value.replaceAll('{tenantName}', 'Casa Nativa').replaceAll('{orderNumber}', 'ORD-018755');
    for (const audience of ['buyer', 'merchant'] as const) {
      const kinds =
        audience === 'buyer'
          ? ['confirmed', 'paid', 'processing', 'shipped', 'delivered', 'cancelled']
          : ['new_order', 'paid', 'cancelled', 'low_stock'];
      for (const kind of kinds) {
        const copy =
          audience === 'buyer' ? messages.Notifications.email : messages.Notifications.merchant;
        const subject =
          audience === 'buyer'
            ? messages.Notifications.email.subjects[kind as OrderNotificationType]
            : messages.Notifications.merchant.subjects[kind as MerchantNotificationKind];
        const intro =
          audience === 'buyer'
            ? messages.Notifications.email.intros[kind as OrderNotificationType]
            : messages.Notifications.merchant.intros[kind as MerchantNotificationKind];
        const rendered = renderNotificationEmail({
          subject: expand(subject),
          intro: expand(intro),
          tenantName: 'Casa Nativa',
          orderNumber: 'ORD-018755',
          locale,
          kind,
          order,
          copy: copy.presentation,
          appUrl: 'https://sales.example.test',
          merchant: audience === 'merchant',
          stockItems: [
            {
              productId: 'demo-product',
              name: order.items[0].name,
              sku: order.items[0].sku,
              stock: 3,
            },
          ],
        });
        const name = `${locale}-${audience}-${kind}`;
        // Substitute only fixture images so the preview works offline; production uses HTTPS URLs.
        await writeFile(
          resolve(directory, `${name}.html`),
          rendered.html.replaceAll('https://preview.example.test/', ''),
        );
        await writeFile(resolve(directory, `${name}.txt`), rendered.text);
        links.push(
          `<li><a href="${name}.html" target="preview">${locale} · ${audience} · ${escapeEmailHtml(expand(subject))}</a> <a href="${name}.txt">TXT</a></li>`,
        );
      }
    }
  }
  await writeFile(
    resolve(directory, 'index.html'),
    `<!doctype html><html lang="es"><meta charset="utf-8"><title>Email previews · demo</title><style>body{margin:0;display:flex;height:100vh;font:14px Arial;color:#0f172a}nav{width:310px;overflow:auto;padding:24px;background:#fff}ul{list-style:none;padding:0}li{margin:0 0 16px}a{color:#166534;line-height:1.6}iframe{flex:1;border:0;background:#f1f5f9}@media(max-width:700px){body{display:block}nav{width:auto;height:150px}iframe{width:100%;height:800px}}</style><nav><h1>Email previews · demo</h1><ul>${links.join('')}</ul></nav><iframe name="preview" title="Email preview" src="es-buyer-delivered.html"></iframe></html>`,
  );
  console.info(`20 HTML + text previews: ${resolve(directory, 'index.html')}`);
}

void main().catch((): void => {
  console.error('Unable to generate email previews');
  process.exitCode = 1;
});
