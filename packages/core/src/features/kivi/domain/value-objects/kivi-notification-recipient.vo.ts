import { InvalidKiviNotificationRecipientException } from '@/kivi/domain/exceptions/invalid-kivi-notification-recipient.exception';

const INTERNATIONAL_PHONE = /^[1-9][0-9]{7,14}$/;

export class KiviNotificationRecipient {
  private constructor(
    private readonly phone: string | null,
    private readonly orderNumber: string,
  ) {}

  public static capture(phone: string, orderNumber: string): KiviNotificationRecipient {
    const canonical = phone.replace(/[\s-]/g, '').replace(/^\+/, '');
    // A phone typed at checkout is often local (0999...). A country is never guessed: it is
    // left out and Kivi notifies the WhatsApp chat linked to the order instead.
    return KiviNotificationRecipient.reconstitute({
      phone: INTERNATIONAL_PHONE.test(canonical) ? canonical : null,
      orderNumber,
    });
  }

  public static reconstitute(snapshot: unknown): KiviNotificationRecipient {
    if (
      typeof snapshot !== 'object' ||
      snapshot === null ||
      Array.isArray(snapshot) ||
      !('phone' in snapshot) ||
      (snapshot.phone !== null &&
        (typeof snapshot.phone !== 'string' || !INTERNATIONAL_PHONE.test(snapshot.phone))) ||
      !('orderNumber' in snapshot) ||
      typeof snapshot.orderNumber !== 'string' ||
      snapshot.orderNumber.trim().length === 0
    ) {
      throw new InvalidKiviNotificationRecipientException('SNAPSHOT_INVALID');
    }
    return new KiviNotificationRecipient(snapshot.phone, snapshot.orderNumber);
  }

  public toSnapshot(): { phone: string | null; orderNumber: string } {
    return { phone: this.phone, orderNumber: this.orderNumber };
  }
}
