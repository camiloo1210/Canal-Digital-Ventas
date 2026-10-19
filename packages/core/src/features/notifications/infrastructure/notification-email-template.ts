import type { NotificationLocale } from '@/notifications/application/ports/out/notification.ports';
import type {
  NotificationOrderDetails,
  NotificationOrderItem,
  NotificationPresentationCopy,
} from '@/notifications/application/ports/out/notification-order-details';
import type { MerchantStockItem } from '@/notifications/application/ports/out/merchant-notification.ports';

interface TemplateInput {
  subject: string;
  intro: string;
  tenantName: string;
  orderNumber: string;
  locale: NotificationLocale;
  kind: string;
  order?: NotificationOrderDetails;
  copy?: NotificationPresentationCopy;
  stockItems?: MerchantStockItem[];
  appUrl?: string;
  merchant?: boolean;
}

export interface RenderedNotification {
  html: string;
  text: string;
}

export function escapeEmailHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character: string): string =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ??
      character,
  );
}

/** Only remote HTTPS images: never turn a catalog URL into a worker-side fetch. */
export function safeEmailImage(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function renderNotificationEmail(input: TemplateInput): RenderedNotification {
  const { subject, intro, tenantName, orderNumber, locale, order, copy } = input;
  const escape = escapeEmailHtml;
  const cancelled = input.kind === 'cancelled';
  const accent = cancelled || input.kind === 'low_stock' ? '#9a3412' : '#166534';
  const tint = cancelled || input.kind === 'low_stock' ? '#fff7ed' : '#f0fdf4';
  const money = (cents: number): string =>
    new Intl.NumberFormat(locale === 'es' ? 'es-CO' : 'en-US', {
      style: 'currency',
      currency: order?.currency ?? 'USD',
    }).format(cents / 100);
  const logo = safeEmailImage(order?.logoUrl);
  const text: string[] = [intro];
  let details = '';
  let actions = '';
  if (order && copy) {
    const lowStock = input.kind === 'low_stock';
    const date = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(
      new Date(order.createdAt),
    );
    text.push(`${copy.order}: ${orderNumber}`, `${copy.placedOn}: ${date}`);
    details += `<p style="margin:0 0 24px;color:#64748b;font-size:13px">${escape(copy.placedOn)} ${escape(date)}</p>`;
    if (lowStock) {
      const stock = input.stockItems ?? [];
      text.push(copy.stock);
      details += `<h2 style="font-size:18px;margin:24px 0 12px">${escape(copy.stock)}</h2><table role="presentation" width="100%" cellspacing="0" cellpadding="0">`;
      for (const item of stock.slice(0, 20)) {
        const image = safeEmailImage(
          order.items.find((line: NotificationOrderItem): boolean => line.sku === item.sku)
            ?.imageUrl,
        );
        text.push(`${item.name} (${item.sku}): ${item.stock} — ${copy.availability}`);
        details += `<tr><td style="padding:16px 12px 16px 0;border-bottom:1px solid #e2e8f0">${image ? `<img src="${escape(image)}" alt="${escape(item.name)}" width="52" height="52" style="display:block;border:0;border-radius:8px;object-fit:contain;margin-bottom:8px">` : ''}<strong>${escape(item.name)}</strong><br><span style="font-size:12px;color:#64748b">${escape(copy.sku)}: ${escape(item.sku)}</span></td><td align="right" style="padding:16px 0;border-bottom:1px solid #e2e8f0;color:${accent}"><strong>${item.stock}</strong><br><span style="font-size:12px">${escape(copy.availability)}</span></td></tr>`;
      }
      details += '</table>';
      if (stock.length > 20) {
        const more = copy.moreItems.replaceAll('{count}', String(stock.length - 20));
        text.push(more);
        details += `<p style="color:#64748b;font-size:13px">${escape(more)}</p>`;
      }
    } else {
      text.push(copy.summary);
      details += `<h2 style="font-size:18px;margin:24px 0 12px">${escape(copy.summary)}</h2><table role="presentation" width="100%" cellspacing="0" cellpadding="0">`;
      for (const item of order.items.slice(0, 20)) {
        const image = safeEmailImage(item.imageUrl);
        text.push(itemText(item, copy, money));
        details += `<tr><td width="76" valign="top" style="padding:16px 12px 16px 0;border-bottom:1px solid #e2e8f0">${image ? `<img src="${escape(image)}" alt="${escape(item.name)}" width="64" height="64" style="display:block;border:0;border-radius:8px;object-fit:contain;background:#f8fafc">` : '<div style="width:64px;height:64px;background:#f1f5f9;border-radius:8px;text-align:center;line-height:64px;color:#64748b" aria-hidden="true">&#9633;</div>'}</td><td valign="top" style="padding:16px 8px 16px 0;border-bottom:1px solid #e2e8f0"><strong style="font-size:14px">${escape(item.name)}</strong><br><span style="font-size:12px;color:#64748b">${escape(copy.sku)}: ${escape(item.sku)}<br>${escape(copy.quantity)}: ${item.quantity} &middot; ${escape(money(item.unitPriceCents))}</span></td><td align="right" valign="top" style="padding:16px 0;border-bottom:1px solid #e2e8f0;font-size:14px;white-space:nowrap">${escape(money(item.subtotalCents))}</td></tr>`;
      }
      details += '</table>';
      if (order.items.length > 20) {
        const more = copy.moreItems.replaceAll('{count}', String(order.items.length - 20));
        details += `<p style="color:#64748b;font-size:13px">${escape(more)}</p>`;
        text.push(more);
      }
      const totals: [string, number][] = [
        [copy.subtotal, order.subtotalCents],
        [copy.discount, -order.discountAmountCents],
        [copy.tax, order.taxAmountCents],
        [copy.shipping, order.shippingCostCents],
        [copy.total, order.totalAmountCents],
      ];
      details +=
        '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0">';
      for (const [label, amount] of totals) {
        if (label === copy.discount && amount === 0) continue;
        const isTotal = label === copy.total;
        details += `<tr><td style="padding:8px 0;${isTotal ? 'border-top:1px solid #cbd5e1;font-weight:bold;font-size:18px' : 'color:#64748b;font-size:14px'}">${escape(label)}</td><td align="right" style="padding:8px 0;${isTotal ? 'border-top:1px solid #cbd5e1;font-weight:bold;font-size:18px' : 'font-size:14px'}">${escape(money(amount))}</td></tr>`;
        text.push(`${label}: ${money(amount)}`);
      }
      details += '</table>';
      details += `<div style="background:#f8fafc;padding:20px;border-radius:12px;font-size:14px;line-height:1.7"><strong>${escape(copy.customer)}</strong><br>${escape(order.customerName)}<br><br><strong>${escape(copy.delivery)}</strong><br>${escape(order.shippingAddress)}</div>`;
      text.push(
        `${copy.customer}: ${order.customerName}`,
        `${copy.delivery}: ${order.shippingAddress}`,
      );
    }
    if (input.appUrl) {
      const primary = new URL(
        input.merchant
          ? lowStock
            ? '/dashboard/catalog/products'
            : '/dashboard/orders'
          : `/purchases#order-${encodeURIComponent(order.orderId)}`,
        input.appUrl,
      ).href;
      const store = new URL(`/store/${encodeURIComponent(order.tenantSlug)}`, input.appUrl).href;
      actions = `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:28px 0 16px"><tr><td bgcolor="${accent}" style="border-radius:8px;mso-padding-alt:16px 28px"><a href="${escape(primary)}" style="display:inline-block;padding:16px 28px;color:#ffffff;font-weight:bold;text-decoration:none;font-size:15px">${escape(lowStock ? copy.stock : copy.viewOrder)}</a></td></tr></table><a href="${escape(store)}" style="color:${accent};font-size:14px">${escape(copy.visitStore)}</a>`;
      text.push(
        `${lowStock ? copy.stock : copy.viewOrder}: ${primary}`,
        `${copy.visitStore}: ${store}`,
      );
    }
    if (order.contactEmail && /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(order.contactEmail)) {
      actions += `<p style="font-size:13px;color:#64748b;margin:24px 0 0">${escape(copy.support)} <a href="mailto:${escape(order.contactEmail)}" style="color:${accent}">${escape(order.contactEmail)}</a></p>`;
      text.push(`${copy.support} ${order.contactEmail}`);
    }
    text.push(copy.footer.replaceAll('{tenantName}', tenantName));
  }
  const html = `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escape(subject)}</title><style>@media only screen and (max-width:600px){.email-body{padding:24px 16px!important}.email-title{font-size:27px!important}}table{border-collapse:collapse}a{word-break:break-word}</style></head><body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a"><div style="display:none;font-size:1px;color:#f1f5f9;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all">${escape(intro)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#f1f5f9"><tr><td align="center" style="padding:32px 12px"><!--[if mso]><table role="presentation" width="640"><tr><td><![endif]--><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #e2e8f0"><tr><td style="height:5px;background:${accent}"></td></tr><tr><td class="email-body" style="padding:36px 40px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>${logo ? `<td width="68"><img src="${escape(logo)}" alt="${escape(tenantName)}" width="52" height="52" style="display:block;object-fit:contain;border:0;border-radius:8px"></td>` : ''}<td><strong style="font-size:20px">${escape(tenantName)}</strong>${copy ? `<br><span style="font-size:11px;letter-spacing:1.5px;color:#64748b">${escape(copy.eyebrow)}</span>` : ''}</td></tr></table><div style="margin:32px 0 20px"><span style="display:inline-block;background:${tint};color:${accent};font-size:12px;font-weight:bold;padding:8px 12px;border-radius:6px">${escape(copy?.order ?? '#')} ${escape(orderNumber)}</span><h1 class="email-title" style="font-size:32px;line-height:1.2;letter-spacing:-1px;margin:18px 0 14px">${escape(subject)}</h1><p style="font-size:16px;line-height:1.7;color:#475569;margin:0">${escape(intro)}</p></div>${details}${actions}</td></tr></table>${copy ? `<p style="max-width:560px;font-size:12px;line-height:1.6;color:#64748b;margin:20px 12px">${escape(copy.footer.replaceAll('{tenantName}', tenantName))}</p>` : ''}<!--[if mso]></td></tr></table><![endif]--></td></tr></table></body></html>`;
  return { html, text: text.join('\n\n') };
}

function itemText(
  item: NotificationOrderItem,
  copy: NotificationPresentationCopy,
  money: (cents: number) => string,
): string {
  return `${item.name} (${item.sku}) — ${copy.quantity}: ${item.quantity} × ${money(item.unitPriceCents)} — ${money(item.subtotalCents)}`;
}
