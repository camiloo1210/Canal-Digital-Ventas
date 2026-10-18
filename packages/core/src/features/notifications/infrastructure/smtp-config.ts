import { MessagingException } from '@/shared/application/exceptions/messaging.exception';
import type { NotificationLocale } from '@/notifications/application/ports/out/notification.ports';

export interface SmtpConfig {
  host: string;
  port: 465 | 587;
  secure: boolean;
  from: string;
  user?: string;
  password?: string;
  locale: NotificationLocale;
}
export function loadSmtpConfig(env: Record<string, string | undefined>): SmtpConfig {
  const host = env.SMTP_HOST?.trim() || 'smtp-relay.gmail.com';
  const port = Number(env.SMTP_PORT || '587');
  const secure = env.SMTP_SECURE === 'true';
  const from = env.SMTP_FROM_EMAIL?.trim() ?? '';
  const user = env.SMTP_USER?.trim() || undefined;
  const password = env.SMTP_PASSWORD || undefined;
  const locale = env.NOTIFICATION_LOCALE || 'es';
  if (
    (port !== 465 && port !== 587) ||
    secure !== (port === 465) ||
    (env.SMTP_SECURE && !['true', 'false'].includes(env.SMTP_SECURE)) ||
    !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(from) ||
    Boolean(user) !== Boolean(password) ||
    !['es', 'en'].includes(locale) ||
    /[\r\n]/.test(host)
  ) {
    throw new MessagingException('Invalid SMTP configuration');
  }
  return { host, port, secure, from, user, password, locale: locale as NotificationLocale };
}
