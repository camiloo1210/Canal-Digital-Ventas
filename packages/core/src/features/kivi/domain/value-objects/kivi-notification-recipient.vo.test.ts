import { describe, expect, it } from 'vitest';
import { KiviNotificationRecipient } from '@/kivi/domain/value-objects/kivi-notification-recipient.vo';
import { InvalidKiviNotificationRecipientException } from '@/kivi/domain/exceptions/invalid-kivi-notification-recipient.exception';

describe('Kivi notification recipient', (): void => {
  it.each(['+593 99 999 9999', '+593-99-999-9999', '593999999999'])(
    'captures an international recipient from %s',
    (phone: string): void => {
      expect(KiviNotificationRecipient.capture(phone, 'ORD-1').toSnapshot()).toEqual({
        phone: '593999999999',
        orderNumber: 'ORD-1',
      });
    },
  );

  it.each(['0999999999', '+593abc', '', '1'.repeat(16)])(
    'rejects an invalid recipient without guessing a country: %s',
    (phone: string): void => {
      expect((): KiviNotificationRecipient =>
        KiviNotificationRecipient.capture(phone, 'ORD-1'),
      ).toThrow(InvalidKiviNotificationRecipientException);
    },
  );

  it.each([
    null,
    [],
    { phone: '0999999999', orderNumber: 'ORD-1' },
    { phone: '593999999999', orderNumber: ' ' },
  ])('rejects an invalid stored snapshot: %j', (snapshot: unknown): void => {
    expect((): KiviNotificationRecipient =>
      KiviNotificationRecipient.reconstitute(snapshot),
    ).toThrow(InvalidKiviNotificationRecipientException);
  });
});
