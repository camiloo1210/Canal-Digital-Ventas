import { formatMinorUnits } from '@/notifications/infrastructure/notification-email-template';
import type {
  NotificationCopy,
  NotificationLocale,
} from '@/notifications/application/ports/out/notification.ports';
import type { OrderNotificationType } from '@/notifications/application/notification-events';
import type {
  NotificationOrderDetails,
  NotificationOrderItem,
} from '@/notifications/application/ports/out/notification-order-details';

/** WhatsApp text messages accept at most 4096 characters; keep a margin for the footer. */
const MAX_MESSAGE_LENGTH = 4096;
const ITEMS_BUDGET = 2600;
const MAX_ITEMS = 20;
const MAX_FIELD = 300;

const GREETING: Record<NotificationLocale, string> = { es: 'Hola {name},', en: 'Hi {name},' };

export interface KiviOrderMessageInput {
  type: OrderNotificationType;
  locale: NotificationLocale;
  copy: NotificationCopy;
  orderNumber: string;
  /** Absent when the order projection could not be read: only headline and intro are sent. */
  order?: NotificationOrderDetails;
  /** Public Canal Digital origin used for the order and store links. */
  appUrl?: string;
}

/** One line, bounded: buyer-controlled text must not be able to forge sections of the message. */
function inline(value: string, limit: number = MAX_FIELD): string {
  const flat = value.replace(/\s+/g, ' ').trim();
  return flat.length > limit ? `${flat.slice(0, limit - 1)}…` : flat;
}

function firstName(fullName: string): string {
  return inline(fullName).split(' ')[0] ?? '';
}

/**
 * Plain-text order status for WhatsApp, carrying the same information as the SMTP email
 * (headline, personal intro, order summary, totals, address, links) with no Meta template.
 * `{tenantName}` is left in place: Kivi, which knows the connected business, substitutes it.
 */
export function renderKiviOrderMessage(input: KiviOrderMessageInput): string {
  const { type, locale, copy, orderNumber, order, appUrl } = input;
  const headline = copy.subjects[type].replaceAll('{orderNumber}', orderNumber);
  const intro = (copy.intros?.[type] ?? copy.body)
    .replaceAll('{orderNumber}', orderNumber)
    .replaceAll('{status}', headline);
  const presentation = copy.presentation;
  if (!order || !presentation) return `*${headline}*\n\n${intro}`;

  const money = (minor: number): string => formatMinorUnits(minor, order.currency, locale);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(
    new Date(order.createdAt),
  );
  const name = firstName(order.customerName);
  const greeting = name ? `${GREETING[locale].replace('{name}', name)}\n` : '';

  const head = [
    `${greeting}*${headline}*`,
    intro,
    `${presentation.order}: ${inline(orderNumber)}\n${presentation.placedOn}: ${date}`,
  ].join('\n\n');

  const totals = [
    `${presentation.subtotal}: ${money(order.subtotalCents)}`,
    ...(order.discountAmountCents > 0
      ? [`${presentation.discount}: ${money(-order.discountAmountCents)}`]
      : []),
    `${presentation.tax}: ${money(order.taxAmountCents)}`,
    `${presentation.shipping}: ${money(order.shippingCostCents)}`,
    `*${presentation.total}: ${money(order.totalAmountCents)}*`,
  ].join('\n');

  const links: string[] = [];
  if (appUrl) {
    links.push(
      `${presentation.viewOrder}: ${new URL(`/purchases/${encodeURIComponent(order.orderId)}`, appUrl).href}`,
      `${presentation.visitStore}: ${new URL(`/store/${encodeURIComponent(order.tenantSlug)}`, appUrl).href}`,
    );
  }
  if (order.contactEmail && /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(order.contactEmail)) {
    links.push(`${presentation.support} ${order.contactEmail}`);
  }

  const delivery = [
    `*${presentation.customer}:* ${inline(order.customerName)}`,
    `*${presentation.delivery}:* ${inline(order.shippingAddress)}`,
  ].join('\n');

  const itemLines: string[] = [];
  let used = 0;
  let shown = 0;
  for (const item of order.items.slice(0, MAX_ITEMS)) {
    const line = itemLine(item, presentation.quantity, money);
    if (used + line.length + 1 > ITEMS_BUDGET) break;
    itemLines.push(line);
    used += line.length + 1;
    shown += 1;
  }
  const hidden = order.items.length - shown;
  const items = [
    `*${presentation.summary}*`,
    ...itemLines,
    ...(hidden > 0 ? [presentation.moreItems.replaceAll('{count}', String(hidden))] : []),
  ].join('\n');

  const footer = presentation.footer;
  const message = [head, items, totals, delivery, links.join('\n'), footer]
    .filter((section: string): boolean => section.length > 0)
    .join('\n\n');
  return message.length <= MAX_MESSAGE_LENGTH
    ? message
    : `${message.slice(0, MAX_MESSAGE_LENGTH - 1)}…`;
}

function itemLine(
  item: NotificationOrderItem,
  quantityLabel: string,
  money: (minor: number) => string,
): string {
  return `• ${inline(item.name, 120)} (${inline(item.sku, 40)}) — ${quantityLabel}: ${item.quantity} × ${money(item.unitPriceCents)} — ${money(item.subtotalCents)}`;
}
