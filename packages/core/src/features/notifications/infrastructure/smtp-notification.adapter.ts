import nodemailer, { type Transporter } from 'nodemailer';
import type SMTPPool from 'nodemailer/lib/smtp-pool';
import type {
  NotificationCopies,
  NotificationEmail,
  NotificationEmailPort,
} from '@/notifications/application/ports/out/notification.ports';
import type { SmtpConfig } from '@/notifications/infrastructure/smtp-config';
import { MessagingException } from '@/shared/application/exceptions/messaging.exception';
import { NotificationPermanentException } from '@/notifications/application/exceptions/notification-permanent.exception';

export class SmtpNotificationAdapter implements NotificationEmailPort {
  private readonly transport: Transporter<SMTPPool.SentMessageInfo>;
  constructor(
    private readonly config: SmtpConfig,
    private readonly copies: NotificationCopies,
  ) {
    this.transport = nodemailer.createTransport({
      pool: true,
      host: config.host,
      port: config.port,
      secure: config.secure,
      requireTLS: !config.secure,
      auth:
        config.user && config.password ? { user: config.user, pass: config.password } : undefined,
      tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true, servername: config.host },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 60_000,
      logger: false,
      debug: false,
    });
  }
  public async verify(): Promise<void> {
    try {
      await this.transport.verify();
    } catch (error: unknown) {
      throw new MessagingException('SMTP verification failed', error);
    }
  }
  public async send(email: NotificationEmail): Promise<void> {
    const copy = this.copies[email.locale];
    const subject = copy.subjects[email.type].replaceAll('{orderNumber}', email.orderNumber);
    const text = copy.body
      .replaceAll('{orderNumber}', email.orderNumber)
      .replaceAll('{tenantName}', email.tenantName)
      .replaceAll('{status}', subject);
    try {
      const result = await this.transport.sendMail({
        from: this.config.from,
        to: email.email,
        envelope: { from: this.config.from, to: email.email },
        messageId: `<${email.messageId}@${this.config.from.split('@')[1]}>`,
        subject,
        text,
      });
      if (result.rejected.length > 0)
        throw new NotificationPermanentException('SMTP_RECIPIENT_REJECTED');
      if (result.accepted.length === 0)
        throw new MessagingException('SMTP did not accept the recipient');
    } catch (error: unknown) {
      if (error instanceof NotificationPermanentException) throw error;
      if (
        typeof error === 'object' &&
        error !== null &&
        'responseCode' in error &&
        typeof error.responseCode === 'number' &&
        error.responseCode >= 500 &&
        error.responseCode < 600
      ) {
        throw new NotificationPermanentException('SMTP_PERMANENT_REJECTION');
      }
      throw new MessagingException('SMTP notification delivery failed', error);
    }
  }
  public close(): void {
    this.transport.close();
  }
}
