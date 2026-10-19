import { readFileSync } from 'node:fs';
import type {
  NotificationCopy,
  NotificationLocale,
} from '@/notifications/application/ports/out/notification.ports';
import type { MerchantNotificationCopy } from '@/notifications/application/ports/out/merchant-notification.ports';

interface NotificationTestMessages {
  Notifications: {
    email: Required<NotificationCopy>;
    merchant: Required<MerchantNotificationCopy>;
  };
}

/** Repository-owned JSON fixtures; Core does not import the web application's aliases. */
export function readNotificationTestMessages(locale: NotificationLocale): NotificationTestMessages {
  const path = new URL(`../../../../../../apps/web/messages/${locale}.json`, import.meta.url);
  return JSON.parse(readFileSync(path, 'utf8')) as NotificationTestMessages;
}
