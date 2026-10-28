import { InvalidKiviNotificationRecipientException } from '@/kivi/domain/exceptions/invalid-kivi-notification-recipient.exception';

const INTERNATIONAL_PHONE = /^[1-9][0-9]{7,14}$/;

export class KiviNotificationRecipient {
  private constructor(
    private readonly phone: string,
    private readonly orderNumber: string,
  ) {}

  public static capture(phone: string, orderNumber: string): KiviNotificationRecipient {
    const canonical = phone.replace(/[\s-]/g, '').replace(/^\+/, '');
    if (!INTERNATIONAL_PHONE.test(canonical)) {
      throw new InvalidKiviNotificationRecipientException('PHONE_INVALID');
    }
    return KiviNotificationRecipient.reconstitute({ phone: canonical, orderNumber });
  }

  public static reconstitute(snapshot: unknown): KiviNotificationRecipient {
    if (
      typeof snapshot !== 'object' ||
      snapshot === null ||
      Array.isArray(snapshot) ||
      !('phone' in snapshot) ||
      typeof snapshot.phone !== 'string' ||
      !INTERNATIONAL_PHONE.test(snapshot.phone) ||
      !('orderNumber' in snapshot) ||
      typeof snapshot.orderNumber !== 'string' ||
      snapshot.orderNumber.trim().length === 0
    ) {
      throw new InvalidKiviNotificationRecipientException('SNAPSHOT_INVALID');
    }
    return new KiviNotificationRecipient(snapshot.phone, snapshot.orderNumber);
  }

  public toSnapshot(): { phone: string; orderNumber: string } {
    return { phone: this.phone, orderNumber: this.orderNumber };
  }
}
